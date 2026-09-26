-- FASE 2B.1: harden Annunci 10x email verification concurrency and state transitions.

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
    p_company_name,
    p_business_role,
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

create or replace function public.annunci10x_create_email_verification(
  p_verification_id uuid,
  p_session_id uuid,
  p_owner_secret_hash text,
  p_lead_id uuid,
  p_email_normalized text,
  p_code_hash text,
  p_expires_at timestamptz,
  p_max_attempts integer,
  p_pending_grace_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_lead public.annunci10x_leads%rowtype;
  v_pending public.annunci10x_email_verifications%rowtype;
  v_verification public.annunci10x_email_verifications%rowtype;
  v_now timestamptz := now();
  v_pending_grace interval := make_interval(secs => greatest(5, least(120, coalesce(p_pending_grace_seconds, 15))));
begin
  if not public.annunci10x_verify_session_secret(p_session_id, p_owner_secret_hash) then
    raise exception 'session ownership verification failed';
  end if;

  select * into v_lead
  from public.annunci10x_leads
  where id = p_lead_id
    and session_id = p_session_id
    and email_normalized = p_email_normalized
  for update;

  if v_lead.id is null then
    raise exception 'lead ownership verification failed';
  end if;

  select * into v_pending
  from public.annunci10x_email_verifications
  where session_id = p_session_id
    and lead_id = p_lead_id
    and email_normalized = p_email_normalized
    and status = 'PENDING_SEND'
    and consumed_at is null
    and invalidated_at is null
    and created_at + v_pending_grace > v_now
  order by created_at desc
  limit 1
  for update;

  if v_pending.id is not null then
    return to_jsonb(v_pending);
  end if;

  update public.annunci10x_email_verifications
  set status = 'INVALIDATED',
      invalidated_at = coalesce(invalidated_at, v_now),
      updated_at = v_now
  where lead_id = p_lead_id
    and email_normalized = p_email_normalized
    and consumed_at is null
    and invalidated_at is null
    and status in ('PENDING_SEND', 'SENT');

  insert into public.annunci10x_email_verifications (
    id,
    session_id,
    lead_id,
    email_normalized,
    code_hash,
    status,
    expires_at,
    max_attempts
  )
  values (
    p_verification_id,
    p_session_id,
    p_lead_id,
    p_email_normalized,
    p_code_hash,
    'PENDING_SEND',
    p_expires_at,
    greatest(1, least(10, p_max_attempts))
  )
  returning * into v_verification;

  return to_jsonb(v_verification);
end;
$$;

create or replace function public.annunci10x_mark_email_verification_sent(
  p_verification_id uuid,
  p_owner_secret_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_verification public.annunci10x_email_verifications%rowtype;
  v_now timestamptz := now();
begin
  select v.* into v_verification
  from public.annunci10x_email_verifications v
  join public.annunci10x_sessions s on s.id = v.session_id
  where v.id = p_verification_id
    and s.owner_secret_hash = p_owner_secret_hash
  for update of v;

  if v_verification.id is null then
    raise exception 'verification ownership verification failed';
  end if;

  if v_verification.status <> 'PENDING_SEND'
    or v_verification.consumed_at is not null
    or v_verification.invalidated_at is not null then
    raise exception 'illegal email verification transition to SENT';
  end if;

  update public.annunci10x_email_verifications
  set status = 'SENT',
      sent_at = v_now,
      updated_at = v_now
  where id = p_verification_id
  returning * into v_verification;

  return to_jsonb(v_verification);
end;
$$;

create or replace function public.annunci10x_mark_email_verification_failed(
  p_verification_id uuid,
  p_owner_secret_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_verification public.annunci10x_email_verifications%rowtype;
  v_now timestamptz := now();
begin
  select v.* into v_verification
  from public.annunci10x_email_verifications v
  join public.annunci10x_sessions s on s.id = v.session_id
  where v.id = p_verification_id
    and s.owner_secret_hash = p_owner_secret_hash
  for update of v;

  if v_verification.id is null then
    raise exception 'verification ownership verification failed';
  end if;

  if v_verification.status <> 'PENDING_SEND'
    or v_verification.consumed_at is not null
    or v_verification.invalidated_at is not null then
    raise exception 'illegal email verification transition to FAILED_SEND';
  end if;

  update public.annunci10x_email_verifications
  set status = 'FAILED_SEND',
      invalidated_at = coalesce(invalidated_at, v_now),
      updated_at = v_now
  where id = p_verification_id
  returning * into v_verification;

  return to_jsonb(v_verification);
end;
$$;

create or replace function public.annunci10x_verify_email_code(
  p_session_id uuid,
  p_owner_secret_hash text,
  p_verification_id uuid,
  p_code_matches boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_verification public.annunci10x_email_verifications%rowtype;
  v_lead public.annunci10x_leads%rowtype;
  v_now timestamptz := now();
  v_outcome text := 'VERIFICATION_INVALID';
begin
  if not public.annunci10x_verify_session_secret(p_session_id, p_owner_secret_hash) then
    raise exception 'session ownership verification failed';
  end if;

  select * into v_lead
  from public.annunci10x_leads
  where session_id = p_session_id
  for update;

  select * into v_verification
  from public.annunci10x_email_verifications
  where id = p_verification_id
    and session_id = p_session_id
  for update;

  if v_verification.id is null then
    return jsonb_build_object('outcome', v_outcome, 'lead', to_jsonb(v_lead), 'verification', null);
  end if;

  if v_verification.status <> 'SENT'
    or v_verification.consumed_at is not null
    or v_verification.invalidated_at is not null then
    return jsonb_build_object('outcome', v_outcome, 'lead', to_jsonb(v_lead), 'verification', to_jsonb(v_verification));
  end if;

  if v_verification.expires_at <= v_now then
    update public.annunci10x_email_verifications
    set status = 'INVALIDATED',
        invalidated_at = coalesce(invalidated_at, v_now),
        updated_at = v_now
    where id = v_verification.id
    returning * into v_verification;
    return jsonb_build_object('outcome', 'VERIFICATION_EXPIRED', 'lead', to_jsonb(v_lead), 'verification', to_jsonb(v_verification));
  end if;

  if v_verification.attempt_count >= v_verification.max_attempts then
    update public.annunci10x_email_verifications
    set status = 'INVALIDATED',
        invalidated_at = coalesce(invalidated_at, v_now),
        updated_at = v_now
    where id = v_verification.id
    returning * into v_verification;
    return jsonb_build_object('outcome', 'MAX_ATTEMPTS_REACHED', 'lead', to_jsonb(v_lead), 'verification', to_jsonb(v_verification));
  end if;

  if not coalesce(p_code_matches, false) then
    update public.annunci10x_email_verifications
    set attempt_count = attempt_count + 1,
        status = case when attempt_count + 1 >= max_attempts then 'INVALIDATED' else status end,
        invalidated_at = case when attempt_count + 1 >= max_attempts then v_now else invalidated_at end,
        updated_at = v_now
    where id = v_verification.id
    returning * into v_verification;
    v_outcome := case when v_verification.status = 'INVALIDATED' then 'MAX_ATTEMPTS_REACHED' else 'VERIFICATION_INVALID' end;
    return jsonb_build_object('outcome', v_outcome, 'lead', to_jsonb(v_lead), 'verification', to_jsonb(v_verification));
  end if;

  update public.annunci10x_email_verifications
  set status = 'CONSUMED',
      consumed_at = v_now,
      updated_at = v_now
  where id = v_verification.id
  returning * into v_verification;

  update public.annunci10x_leads
  set email_verified_at = v_now,
      updated_at = v_now
  where id = v_verification.lead_id
    and session_id = p_session_id
    and email_normalized = v_verification.email_normalized
  returning * into v_lead;

  return jsonb_build_object('outcome', 'VERIFIED', 'lead', to_jsonb(v_lead), 'verification', to_jsonb(v_verification));
end;
$$;

revoke all on function public.annunci10x_create_email_verification(uuid, uuid, text, uuid, text, text, timestamptz, integer) from public, anon, authenticated, service_role;
revoke all on function public.annunci10x_verify_email_code(uuid, text, text) from public, anon, authenticated, service_role;

revoke all on function public.annunci10x_save_lead(uuid, text, text, text, text, text, text, boolean, text) from public, anon, authenticated;
revoke all on function public.annunci10x_create_email_verification(uuid, uuid, text, uuid, text, text, timestamptz, integer, integer) from public, anon, authenticated;
revoke all on function public.annunci10x_mark_email_verification_sent(uuid, text) from public, anon, authenticated;
revoke all on function public.annunci10x_mark_email_verification_failed(uuid, text) from public, anon, authenticated;
revoke all on function public.annunci10x_verify_email_code(uuid, text, uuid, boolean) from public, anon, authenticated;

grant execute on function public.annunci10x_save_lead(uuid, text, text, text, text, text, text, boolean, text) to service_role;
grant execute on function public.annunci10x_create_email_verification(uuid, uuid, text, uuid, text, text, timestamptz, integer, integer) to service_role;
grant execute on function public.annunci10x_mark_email_verification_sent(uuid, text) to service_role;
grant execute on function public.annunci10x_mark_email_verification_failed(uuid, text) to service_role;
grant execute on function public.annunci10x_verify_email_code(uuid, text, uuid, boolean) to service_role;

notify pgrst, 'reload schema';
