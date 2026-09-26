-- Annunci 10x lead identity, email verification, and result eligibility foundation.
-- Additive only. Depends on 20260926153000_annunci10x_analysis_runs.sql.

create table if not exists public.annunci10x_leads (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.annunci10x_sessions(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  company_name text not null,
  business_role text not null,
  email_normalized text not null,
  email_verified_at timestamptz,
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  marketing_consent_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint annunci10x_leads_one_per_session unique (session_id),
  constraint annunci10x_leads_business_role check (business_role in ('OWNER_ENTREPRENEUR', 'HR', 'INTERNAL_RECRUITER', 'CONSULTANT', 'OTHER')),
  constraint annunci10x_leads_email_normalized check (char_length(email_normalized) between 3 and 254 and email_normalized = lower(email_normalized) and email_normalized like '%@%.%'),
  constraint annunci10x_leads_names check (char_length(first_name) between 1 and 80 and char_length(last_name) between 1 and 80),
  constraint annunci10x_leads_company check (char_length(company_name) between 1 and 160),
  constraint annunci10x_leads_marketing_timestamp check (
    (marketing_consent and marketing_consent_at is not null and marketing_consent_version is not null)
    or ((not marketing_consent) and marketing_consent_at is null)
  )
);

create table if not exists public.annunci10x_email_verifications (
  id uuid primary key,
  session_id uuid not null references public.annunci10x_sessions(id) on delete cascade,
  lead_id uuid not null references public.annunci10x_leads(id) on delete cascade,
  email_normalized text not null,
  code_hash text not null,
  status text not null default 'PENDING_SEND',
  expires_at timestamptz not null,
  sent_at timestamptz,
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  consumed_at timestamptz,
  invalidated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint annunci10x_email_verifications_status check (status in ('PENDING_SEND', 'SENT', 'CONSUMED', 'INVALIDATED', 'FAILED_SEND')),
  constraint annunci10x_email_verifications_email check (char_length(email_normalized) between 3 and 254 and email_normalized = lower(email_normalized) and email_normalized like '%@%.%'),
  constraint annunci10x_email_verifications_hash check (code_hash ~ '^[0-9a-f]{64}$'),
  constraint annunci10x_email_verifications_attempts check (attempt_count >= 0 and max_attempts between 1 and 10),
  constraint annunci10x_email_verifications_sent check (status <> 'SENT' or sent_at is not null),
  constraint annunci10x_email_verifications_consumed check (status <> 'CONSUMED' or consumed_at is not null),
  constraint annunci10x_email_verifications_invalidated check (status <> 'INVALIDATED' or invalidated_at is not null)
);

create unique index if not exists annunci10x_email_verifications_one_active_idx
  on public.annunci10x_email_verifications(lead_id, email_normalized)
  where status in ('PENDING_SEND', 'SENT') and consumed_at is null and invalidated_at is null;

create index if not exists annunci10x_leads_session_idx
  on public.annunci10x_leads(session_id);

create index if not exists annunci10x_email_verifications_session_created_idx
  on public.annunci10x_email_verifications(session_id, created_at desc);

alter table public.annunci10x_leads enable row level security;
alter table public.annunci10x_email_verifications enable row level security;

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
      when excluded.marketing_consent then coalesce(public.annunci10x_leads.marketing_consent_at, v_now)
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
  p_max_attempts integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_lead public.annunci10x_leads%rowtype;
  v_verification public.annunci10x_email_verifications%rowtype;
  v_now timestamptz := now();
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
  p_code_hash text
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
  where session_id = p_session_id
    and status = 'SENT'
    and consumed_at is null
    and invalidated_at is null
  order by created_at desc
  limit 1
  for update;

  if v_verification.id is null then
    return jsonb_build_object('outcome', v_outcome, 'lead', to_jsonb(v_lead), 'verification', null);
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

  if v_verification.code_hash <> p_code_hash then
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

comment on table public.annunci10x_leads is 'Session-bound Annunci 10x free-analysis contact identity. Email is not globally unique.';
comment on table public.annunci10x_email_verifications is 'Session-bound OTP verification state. Codes are HMAC hashes only; plaintext OTP is never stored.';

revoke all on table public.annunci10x_leads from public, anon, authenticated;
revoke all on table public.annunci10x_email_verifications from public, anon, authenticated;

grant select, insert, update on table public.annunci10x_leads to service_role;
grant select, insert, update on table public.annunci10x_email_verifications to service_role;

revoke all on function public.annunci10x_save_lead(uuid, text, text, text, text, text, text, boolean, text) from public, anon, authenticated;
revoke all on function public.annunci10x_create_email_verification(uuid, uuid, text, uuid, text, text, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.annunci10x_mark_email_verification_sent(uuid, text) from public, anon, authenticated;
revoke all on function public.annunci10x_mark_email_verification_failed(uuid, text) from public, anon, authenticated;
revoke all on function public.annunci10x_verify_email_code(uuid, text, text) from public, anon, authenticated;

grant execute on function public.annunci10x_save_lead(uuid, text, text, text, text, text, text, boolean, text) to service_role;
grant execute on function public.annunci10x_create_email_verification(uuid, uuid, text, uuid, text, text, timestamptz, integer) to service_role;
grant execute on function public.annunci10x_mark_email_verification_sent(uuid, text) to service_role;
grant execute on function public.annunci10x_mark_email_verification_failed(uuid, text) to service_role;
grant execute on function public.annunci10x_verify_email_code(uuid, text, text) to service_role;

notify pgrst, 'reload schema';
