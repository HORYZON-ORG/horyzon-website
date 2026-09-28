-- Annunci 10x score report transactional email delivery foundation.
-- Additive only. Feature flag must stay disabled until this migration is live.

create table if not exists public.annunci10x_email_deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.annunci10x_sessions(id) on delete cascade,
  lead_id uuid not null references public.annunci10x_leads(id) on delete cascade,
  analysis_run_id uuid not null references public.annunci10x_analysis_runs(id) on delete cascade,
  kind text not null,
  recipient_normalized text not null,
  status text not null default 'PENDING',
  provider text,
  provider_request_id text,
  attempt_count integer not null default 0,
  lease_expires_at timestamptz,
  sent_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint annunci10x_email_deliveries_kind check (kind in ('SCORE_REPORT')),
  constraint annunci10x_email_deliveries_status check (status in ('PENDING', 'SENDING', 'SENT', 'FAILED')),
  constraint annunci10x_email_deliveries_email check (char_length(recipient_normalized) between 3 and 254 and recipient_normalized = lower(recipient_normalized) and recipient_normalized like '%@%.%'),
  constraint annunci10x_email_deliveries_attempt_count check (attempt_count >= 0),
  constraint annunci10x_email_deliveries_sent_at check (status <> 'SENT' or sent_at is not null),
  constraint annunci10x_email_deliveries_unique unique (kind, analysis_run_id, recipient_normalized)
);

create index if not exists annunci10x_email_deliveries_session_created_idx
  on public.annunci10x_email_deliveries(session_id, created_at desc);

create index if not exists annunci10x_email_deliveries_status_lease_idx
  on public.annunci10x_email_deliveries(status, lease_expires_at);

alter table public.annunci10x_email_deliveries enable row level security;

create or replace function public.annunci10x_claim_email_delivery(
  p_session_id uuid,
  p_owner_secret_hash text,
  p_analysis_run_id uuid,
  p_kind text,
  p_recipient text,
  p_lease_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_run public.annunci10x_analysis_runs%rowtype;
  v_lead public.annunci10x_leads%rowtype;
  v_delivery public.annunci10x_email_deliveries%rowtype;
  v_now timestamptz := now();
  v_recipient text := lower(trim(p_recipient));
  v_lease_seconds integer := greatest(1, least(600, coalesce(p_lease_seconds, 120)));
begin
  if not public.annunci10x_verify_session_secret(p_session_id, p_owner_secret_hash) then
    raise exception 'session ownership verification failed';
  end if;

  if p_kind <> 'SCORE_REPORT' then
    return null;
  end if;

  select * into v_run
  from public.annunci10x_analysis_runs
  where id = p_analysis_run_id
    and session_id = p_session_id
  for update;

  if v_run.id is null
    or v_run.status <> 'READY'
    or v_run.source_status <> 'READY'
    or v_run.evaluation_id is null then
    return null;
  end if;

  select * into v_lead
  from public.annunci10x_leads
  where session_id = p_session_id
  for update;

  if v_lead.id is null
    or v_lead.email_verified_at is null
    or v_lead.email_normalized <> v_recipient then
    return null;
  end if;

  insert into public.annunci10x_email_deliveries (
    session_id,
    lead_id,
    analysis_run_id,
    kind,
    recipient_normalized,
    status
  )
  values (
    p_session_id,
    v_lead.id,
    p_analysis_run_id,
    p_kind,
    v_recipient,
    'PENDING'
  )
  on conflict (kind, analysis_run_id, recipient_normalized) do nothing;

  select * into v_delivery
  from public.annunci10x_email_deliveries
  where kind = p_kind
    and analysis_run_id = p_analysis_run_id
    and recipient_normalized = v_recipient
  for update;

  if v_delivery.id is null
    or v_delivery.status = 'SENT'
    or v_delivery.attempt_count >= 5
    or (v_delivery.status = 'SENDING' and v_delivery.lease_expires_at is not null and v_delivery.lease_expires_at > v_now) then
    return null;
  end if;

  update public.annunci10x_email_deliveries
  set status = 'SENDING',
      attempt_count = attempt_count + 1,
      lease_expires_at = v_now + make_interval(secs => v_lease_seconds),
      last_error_code = null,
      updated_at = v_now
  where id = v_delivery.id
  returning * into v_delivery;

  return to_jsonb(v_delivery);
end;
$$;

create or replace function public.annunci10x_mark_email_delivery_sent(
  p_delivery_id uuid,
  p_owner_secret_hash text,
  p_provider text,
  p_provider_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_delivery public.annunci10x_email_deliveries%rowtype;
  v_now timestamptz := now();
begin
  select d.* into v_delivery
  from public.annunci10x_email_deliveries d
  join public.annunci10x_sessions s on s.id = d.session_id
  where d.id = p_delivery_id
    and s.owner_secret_hash = p_owner_secret_hash
  for update of d;

  if v_delivery.id is null or v_delivery.status <> 'SENDING' then
    raise exception 'email delivery cannot transition to sent';
  end if;

  update public.annunci10x_email_deliveries
  set status = 'SENT',
      provider = p_provider,
      provider_request_id = p_provider_request_id,
      sent_at = v_now,
      lease_expires_at = null,
      last_error_code = null,
      updated_at = v_now
  where id = p_delivery_id
  returning * into v_delivery;

  return to_jsonb(v_delivery);
end;
$$;

create or replace function public.annunci10x_mark_email_delivery_failed(
  p_delivery_id uuid,
  p_owner_secret_hash text,
  p_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_delivery public.annunci10x_email_deliveries%rowtype;
  v_now timestamptz := now();
begin
  select d.* into v_delivery
  from public.annunci10x_email_deliveries d
  join public.annunci10x_sessions s on s.id = d.session_id
  where d.id = p_delivery_id
    and s.owner_secret_hash = p_owner_secret_hash
  for update of d;

  if v_delivery.id is null or v_delivery.status <> 'SENDING' then
    raise exception 'email delivery cannot transition to failed';
  end if;

  update public.annunci10x_email_deliveries
  set status = 'FAILED',
      lease_expires_at = null,
      last_error_code = left(coalesce(p_error_code, 'EMAIL_PROVIDER_UNAVAILABLE'), 80),
      updated_at = v_now
  where id = p_delivery_id
  returning * into v_delivery;

  return to_jsonb(v_delivery);
end;
$$;

comment on table public.annunci10x_email_deliveries is 'Durable transactional Annunci 10x email delivery claims. Stores no raw email provider body.';

revoke all on table public.annunci10x_email_deliveries from public, anon, authenticated;
grant select, insert, update on table public.annunci10x_email_deliveries to service_role;

revoke all on function public.annunci10x_claim_email_delivery(uuid, text, uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.annunci10x_mark_email_delivery_sent(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.annunci10x_mark_email_delivery_failed(uuid, text, text) from public, anon, authenticated;

grant execute on function public.annunci10x_claim_email_delivery(uuid, text, uuid, text, text, integer) to service_role;
grant execute on function public.annunci10x_mark_email_delivery_sent(uuid, text, text, text) to service_role;
grant execute on function public.annunci10x_mark_email_delivery_failed(uuid, text, text) to service_role;

notify pgrst, 'reload schema';
