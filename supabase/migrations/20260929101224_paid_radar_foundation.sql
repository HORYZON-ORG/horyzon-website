-- Paid Radar d'Impresa foundation. Additive and fail-closed.

alter table hub.radar_assessments
  add column if not exists questionnaire_version text not null default 'radar-v1',
  add column if not exists journey_status text not null default 'STARTED',
  add column if not exists current_step integer not null default 0,
  add column if not exists answered_count integer not null default 0,
  add column if not exists progress_percent integer not null default 0,
  add column if not exists revision integer not null default 0,
  add column if not exists owner_secret_hash text,
  add column if not exists result_access_source text,
  add column if not exists last_activity_at timestamptz not null default now(),
  add column if not exists payment_gate_at timestamptz,
  add column if not exists result_unlocked_at timestamptz,
  add column if not exists expires_at timestamptz;

alter table hub.radar_assessments
  drop constraint if exists radar_assessments_journey_status_check,
  add constraint radar_assessments_journey_status_check check (journey_status in ('STARTED','IN_PROGRESS','PAYMENT_REQUIRED','PAID','COMPLETED','ABANDONED','EXPIRED')),
  drop constraint if exists radar_assessments_progress_check,
  add constraint radar_assessments_progress_check check (current_step between 0 and 30 and answered_count between 0 and 30 and progress_percent between 0 and 100),
  drop constraint if exists radar_assessments_access_source_check,
  add constraint radar_assessments_access_source_check check (result_access_source is null or result_access_source in ('PURCHASE','PREVIEW'));

create index if not exists radar_assessments_journey_status_idx on hub.radar_assessments(journey_status, last_activity_at desc);

create table if not exists hub.radar_purchases (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references hub.radar_assessments(id) on delete cascade,
  offer_code text not null check (offer_code = 'RADAR_IMPRESA_REPORT'),
  status text not null default 'PENDING' check (status in ('PENDING','PAID','FAILED','CANCELED','REFUNDED')),
  provider text not null default 'STRIPE' check (provider = 'STRIPE'),
  currency text not null default 'EUR' check (currency = 'EUR'),
  expected_amount_cents integer not null check (expected_amount_cents > 0),
  stripe_price_id text not null,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  checkout_created_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  canceled_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists radar_purchases_pending_uidx on hub.radar_purchases(assessment_id, offer_code) where status = 'PENDING';
create unique index if not exists radar_purchases_checkout_uidx on hub.radar_purchases(stripe_checkout_session_id) where stripe_checkout_session_id is not null;
create unique index if not exists radar_purchases_payment_uidx on hub.radar_purchases(stripe_payment_intent_id) where stripe_payment_intent_id is not null;

create table if not exists hub.radar_entitlement_grants (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references hub.radar_assessments(id) on delete cascade,
  purchase_id uuid not null references hub.radar_purchases(id) on delete cascade,
  capability text not null check (capability = 'RADAR_RESULT_ACCESS'),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (purchase_id, capability)
);

create index if not exists radar_entitlements_assessment_idx on hub.radar_entitlement_grants(assessment_id) where revoked_at is null;

create table if not exists hub.radar_stripe_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  object_id text,
  status text not null default 'RECEIVED' check (status in ('RECEIVED','PROCESSED','IGNORED','FAILED')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists hub.radar_access_events (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references hub.radar_assessments(id) on delete cascade,
  access_source text not null check (access_source in ('PURCHASE','PREVIEW')),
  event_type text not null check (event_type in ('PREVIEW_GRANTED','PREVIEW_DENIED','RESULT_OPENED')),
  created_at timestamptz not null default now()
);

alter table hub.radar_purchases enable row level security;
alter table hub.radar_purchases force row level security;
alter table hub.radar_entitlement_grants enable row level security;
alter table hub.radar_entitlement_grants force row level security;
alter table hub.radar_stripe_events enable row level security;
alter table hub.radar_stripe_events force row level security;
alter table hub.radar_access_events enable row level security;
alter table hub.radar_access_events force row level security;

create policy radar_purchases_superadmin_select on hub.radar_purchases for select to authenticated using (hub.is_superadmin());
create policy radar_entitlements_superadmin_select on hub.radar_entitlement_grants for select to authenticated using (hub.is_superadmin());
create policy radar_events_superadmin_select on hub.radar_access_events for select to authenticated using (hub.is_superadmin());

create or replace function hub.radar_save_answer(
  p_assessment_id uuid,
  p_owner_secret_hash text,
  p_answer_key text,
  p_answer_value jsonb,
  p_expected_revision integer,
  p_current_step integer
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, hub
as $$
declare v hub.radar_assessments%rowtype;
begin
  select * into v from hub.radar_assessments where id = p_assessment_id for update;
  if v.id is null or v.owner_secret_hash is distinct from p_owner_secret_hash then raise exception 'assessment ownership failed'; end if;
  if v.expires_at is not null and v.expires_at <= now() then raise exception 'assessment expired'; end if;
  if v.revision <> p_expected_revision then raise exception 'revision conflict'; end if;
  if p_answer_key !~ '^(amministrazione|produzione|commerciale|marketing|risorse-umane)#[0-4]$|^qualificazione#stagionale$|^ai#(uso|leva|pronti|casoUso)$' then raise exception 'invalid answer key'; end if;
  update hub.radar_assessments set
    risposte = risposte || jsonb_build_object(p_answer_key, p_answer_value),
    journey_status = 'IN_PROGRESS',
    current_step = greatest(current_step, least(30, p_current_step)),
    answered_count = (select count(*) from jsonb_object_keys(risposte || jsonb_build_object(p_answer_key, p_answer_value))),
    progress_percent = least(100, round(((select count(*) from jsonb_object_keys(risposte || jsonb_build_object(p_answer_key, p_answer_value)))::numeric / 30) * 100)),
    revision = revision + 1,
    last_activity_at = now()
  where id = p_assessment_id returning * into v;
  return jsonb_build_object('revision', v.revision, 'currentStep', v.current_step, 'answeredCount', v.answered_count, 'progressPercent', v.progress_percent);
end;
$$;

create or replace function hub.radar_grant_paid_access(p_purchase_id uuid, p_payment_intent_id text, p_customer_id text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, hub
as $$
declare p hub.radar_purchases%rowtype;
begin
  select * into p from hub.radar_purchases where id = p_purchase_id for update;
  if p.id is null then raise exception 'purchase missing'; end if;
  update hub.radar_purchases set status = 'PAID', stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_payment_intent_id), stripe_customer_id = coalesce(stripe_customer_id, p_customer_id), paid_at = coalesce(paid_at, now()), updated_at = now() where id = p.id;
  insert into hub.radar_entitlement_grants(assessment_id, purchase_id, capability) values (p.assessment_id, p.id, 'RADAR_RESULT_ACCESS') on conflict (purchase_id, capability) do nothing;
  update hub.radar_assessments set journey_status = 'PAID', result_access_source = 'PURCHASE', result_unlocked_at = coalesce(result_unlocked_at, now()) where id = p.assessment_id;
  return jsonb_build_object('assessmentId', p.assessment_id, 'status', 'PAID');
end;
$$;

revoke all on function hub.radar_save_answer(uuid,text,text,jsonb,integer,integer) from public, anon, authenticated;
grant execute on function hub.radar_save_answer(uuid,text,text,jsonb,integer,integer) to service_role;
revoke all on function hub.radar_grant_paid_access(uuid,text,text) from public, anon, authenticated;
grant execute on function hub.radar_grant_paid_access(uuid,text,text) to service_role;

revoke all on hub.radar_purchases, hub.radar_entitlement_grants, hub.radar_stripe_events, hub.radar_access_events from anon, authenticated;
grant select, insert, update on hub.radar_purchases, hub.radar_entitlement_grants, hub.radar_stripe_events, hub.radar_access_events to service_role;
