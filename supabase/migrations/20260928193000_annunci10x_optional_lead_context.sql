-- FASE 2I.3: make Annunci 10x lead company/business role optional.

alter table public.annunci10x_leads
  alter column company_name drop not null,
  alter column business_role drop not null;

alter table public.annunci10x_leads
  drop constraint if exists annunci10x_leads_company,
  drop constraint if exists annunci10x_leads_business_role;

alter table public.annunci10x_leads
  add constraint annunci10x_leads_company
    check (company_name is null or char_length(company_name) between 1 and 160),
  add constraint annunci10x_leads_business_role
    check (business_role is null or business_role in ('OWNER_ENTREPRENEUR', 'HR', 'INTERNAL_RECRUITER', 'CONSULTANT', 'OTHER'));

create or replace function public.annunci10x_save_lead(
  p_session_id uuid,
  p_owner_secret_hash text,
  p_first_name text,
  p_last_name text,
  p_company_name text,
  p_business_role text,
  p_email_normalized text,
  p_marketing_consent boolean,
  p_marketing_consent_version text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_existing public.annunci10x_leads%rowtype;
  v_lead public.annunci10x_leads%rowtype;
  v_now timestamptz := now();
  v_email_changed boolean := false;
begin
  if not public.annunci10x_verify_session_secret(p_session_id, p_owner_secret_hash) then
    raise exception 'session ownership verification failed';
  end if;

  select * into v_existing
  from public.annunci10x_leads
  where session_id = p_session_id
  for update;

  v_email_changed := v_existing.id is not null and v_existing.email_normalized <> p_email_normalized;

  insert into public.annunci10x_leads (
    session_id,
    first_name,
    last_name,
    company_name,
    business_role,
    email_normalized,
    email_verified_at,
    marketing_consent,
    marketing_consent_at,
    marketing_consent_version
  )
  values (
    p_session_id,
    p_first_name,
    p_last_name,
    nullif(btrim(p_company_name), ''),
    nullif(btrim(p_business_role), ''),
    p_email_normalized,
    null,
    coalesce(p_marketing_consent, false),
    case when coalesce(p_marketing_consent, false) then v_now else null end,
    case when coalesce(p_marketing_consent, false) then p_marketing_consent_version else null end
  )
  on conflict (session_id)
  do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    company_name = excluded.company_name,
    business_role = excluded.business_role,
    email_normalized = excluded.email_normalized,
    email_verified_at = case
      when public.annunci10x_leads.email_normalized <> excluded.email_normalized then null
      else public.annunci10x_leads.email_verified_at
    end,
    marketing_consent = excluded.marketing_consent,
    marketing_consent_at = case
      when excluded.marketing_consent
        and (
          public.annunci10x_leads.marketing_consent_at is null
          or public.annunci10x_leads.marketing_consent_version is distinct from excluded.marketing_consent_version
        )
        then v_now
      when excluded.marketing_consent then public.annunci10x_leads.marketing_consent_at
      else null
    end,
    marketing_consent_version = case
      when excluded.marketing_consent then excluded.marketing_consent_version
      else null
    end,
    updated_at = v_now
  returning * into v_lead;

  if v_email_changed then
    update public.annunci10x_email_verifications
    set status = 'INVALIDATED',
        invalidated_at = coalesce(invalidated_at, v_now),
        updated_at = v_now
    where lead_id = v_lead.id
      and consumed_at is null
      and invalidated_at is null
      and status in ('PENDING_SEND', 'SENT');
  end if;

  return to_jsonb(v_lead);
end;
$$;

revoke all on function public.annunci10x_save_lead(uuid, text, text, text, text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.annunci10x_save_lead(uuid, text, text, text, text, text, text, boolean, text) to service_role;
