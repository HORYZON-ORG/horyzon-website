alter table hub.architect_startup_pending_leads
  add column utm jsonb not null default '{}'::jsonb;

alter table hub.architect_startup_pending_leads
  add constraint architect_startup_pending_leads_utm_check
  check (jsonb_typeof(utm) = 'object' and pg_column_size(utm) < 1000);

create or replace function hub.architect_startup_lead_begin_v2(
  p_token_hash text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_privacy_version text,
  p_ip_hash text,
  p_consent boolean,
  p_utm jsonb
) returns boolean
language plpgsql
security definer
set search_path to pg_catalog, hub
as $function$
begin
  if p_consent is distinct from true
    or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$'
    or p_first_name is null or length(btrim(p_first_name)) not between 1 and 120
    or p_last_name is null or length(btrim(p_last_name)) not between 1 and 120
    or p_email is null or length(btrim(p_email)) not between 3 and 254
    or lower(btrim(p_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_phone is null or btrim(p_phone) !~ '^\+[1-9][0-9]{7,14}$'
    or p_privacy_version is null or length(btrim(p_privacy_version)) not between 1 and 80
    or jsonb_typeof(coalesce(p_utm, '{}'::jsonb)) <> 'object'
    or pg_column_size(coalesce(p_utm, '{}'::jsonb)) >= 1000
    or exists (
      select 1
      from jsonb_each(coalesce(p_utm, '{}'::jsonb)) as attribution(key, value)
      where attribution.key not in ('utm_source','utm_medium','utm_campaign','utm_content','utm_term')
        or jsonb_typeof(attribution.value) <> 'string'
        or length(attribution.value #>> '{}') > 100
        or (attribution.value #>> '{}') ~ E'[\r\n]'
    )
  then return false; end if;

  if (select count(*) from hub.architect_startup_pending_leads
      where ip_hash = p_ip_hash and issued_at > now() - interval '1 hour') >= 10
  then return false; end if;

  insert into hub.architect_startup_pending_leads (
    token_hash, first_name, last_name, email, phone, privacy_version, ip_hash, utm
  ) values (
    p_token_hash, btrim(p_first_name), btrim(p_last_name),
    lower(btrim(p_email)), btrim(p_phone), btrim(p_privacy_version), p_ip_hash,
    coalesce(p_utm, '{}'::jsonb)
  );
  return true;
end
$function$;

revoke execute on function hub.architect_startup_lead_begin_v2(
  text,text,text,text,text,text,text,boolean,jsonb
) from public, anon, authenticated;
grant execute on function hub.architect_startup_lead_begin_v2(
  text,text,text,text,text,text,text,boolean,jsonb
) to service_role;

create or replace function hub.architect_startup_lead_confirm_v1(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path to pg_catalog, hub
as $function$
declare
  v_pending hub.architect_startup_pending_leads%rowtype;
  v_id uuid;
  v_at timestamptz := clock_timestamp();
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
  then return false; end if;

  select * into v_pending from hub.architect_startup_pending_leads
    where token_hash = p_token_hash for update;
  if not found then return false; end if;
  if v_pending.candidate_id is not null then return true; end if;
  if v_pending.expires_at <= v_at then return false; end if;
  if v_pending.video_completed_at is null then return false; end if;

  insert into hub.architect_candidates (
    cv_id, intake_hash, first_name, last_name, email, phone, province,
    source_path, utm, privacy_version, marketing_consent,
    startup_confirmed_at, received_at
  ) values (
    null, p_token_hash, v_pending.first_name, v_pending.last_name,
    v_pending.email, v_pending.phone, 'Non richiesta',
    '/candidature/architetti-patrimoniali/startup', v_pending.utm,
    v_pending.privacy_version, false, v_at, v_at
  ) returning id into v_id;

  insert into hub.architect_candidate_history(candidate_id,kind,recorded_at)
  values (v_id,'received',v_at),(v_id,'startup_confirmed',v_at);

  update hub.architect_startup_pending_leads set
    first_name=null,last_name=null,email=null,phone=null,privacy_version=null,
    utm='{}'::jsonb,confirmed_at=v_at,candidate_id=v_id
  where token_hash=p_token_hash;
  return true;
end
$function$;

revoke execute on function hub.architect_startup_lead_confirm_v1(text)
  from public, anon, authenticated;
grant execute on function hub.architect_startup_lead_confirm_v1(text)
  to service_role;
