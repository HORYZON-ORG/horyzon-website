-- Annunci 10x persistence MVP.
-- Additive only: isolated annunci10x_* tables, server-side access, no payment provider tables.

create table if not exists public.annunci10x_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_secret_hash text not null,
  flow text not null,
  state text not null default 'STARTED',
  current_snapshot_id uuid,
  selected_channel text,
  method_version text not null,
  rubric_version text not null,
  strategy_version text not null,
  prompt_pack_version text not null,
  data_contract_version text not null,
  commercial_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint annunci10x_sessions_owner_hash check (owner_secret_hash ~ '^[0-9a-f]{64}$'),
  constraint annunci10x_sessions_flow check (flow in ('ANALYZE', 'CREATE')),
  constraint annunci10x_sessions_state check (state in ('STARTED', 'COLLECTING', 'PRECHECKED', 'ANALYZING', 'ANALYSIS_READY', 'CLARIFYING', 'BUILDING', 'ROLE_CARD_READY', 'USER_CONFIRMED', 'READY_FOR_PURCHASE', 'PAYMENT_REQUIRED', 'PURCHASE_PENDING', 'ENTITLED', 'GENERATING', 'OUTPUT_READY', 'NEEDS_VERIFICATION', 'ERROR', 'ABANDONED')),
  constraint annunci10x_sessions_channel check (selected_channel is null or selected_channel in ('LINKEDIN', 'INDEED', 'ATS', 'EMAIL', 'CUSTOM')),
  constraint annunci10x_sessions_commercial_context check (jsonb_typeof(commercial_context) = 'object')
);

create table if not exists public.annunci10x_answers (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.annunci10x_sessions(id) on delete cascade,
  interview_step text not null,
  question_id text not null,
  clarification_id text,
  raw_answer text not null,
  created_at timestamptz not null default now(),
  constraint annunci10x_answers_interview_step check (interview_step in ('ROLE', 'OUTCOMES', 'REQUIREMENTS', 'CONDITIONS', 'ATTRACTION', 'CHANNEL')),
  constraint annunci10x_answers_question_id check (char_length(question_id) between 1 and 160),
  constraint annunci10x_answers_raw_answer check (char_length(raw_answer) between 1 and 20000)
);

create table if not exists public.annunci10x_snapshots (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.annunci10x_sessions(id) on delete cascade,
  version integer not null,
  role_card jsonb not null,
  role_profile jsonb,
  communication_strategy jsonb,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint annunci10x_snapshots_version check (version > 0),
  constraint annunci10x_snapshots_role_card check (jsonb_typeof(role_card) = 'object'),
  constraint annunci10x_snapshots_role_profile check (role_profile is null or jsonb_typeof(role_profile) = 'object'),
  constraint annunci10x_snapshots_strategy check (communication_strategy is null or jsonb_typeof(communication_strategy) = 'object'),
  constraint annunci10x_snapshots_reason check (reason in ('INITIAL_EXTRACTION', 'USER_ANSWER', 'USER_EDIT', 'USER_CONFIRMATION', 'POST_GENERATION_EDIT')),
  constraint annunci10x_snapshots_unique_version unique (session_id, version)
);

alter table public.annunci10x_sessions
  add constraint annunci10x_sessions_current_snapshot_fk
  foreign key (current_snapshot_id)
  references public.annunci10x_snapshots(id)
  on delete set null
  deferrable initially deferred;

create table if not exists public.annunci10x_ai_operations (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.annunci10x_sessions(id) on delete cascade,
  operation_type text not null,
  status text not null default 'PENDING',
  input_snapshot_id uuid references public.annunci10x_snapshots(id) on delete set null,
  input_snapshot_identity uuid generated always as (coalesce(input_snapshot_id, '00000000-0000-0000-0000-000000000000'::uuid)) stored,
  output_snapshot_id uuid references public.annunci10x_snapshots(id) on delete set null,
  output_payload jsonb,
  model text,
  prompt_version text not null,
  idempotency_key text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_payload jsonb,
  constraint annunci10x_ai_operations_type check (operation_type in ('PRECHECK', 'EXTRACT', 'CLARIFY', 'PROFILE', 'STRATEGY', 'GENERATE', 'VALIDATE', 'EVALUATE', 'CHANNEL_ADAPTER', 'EDIT_CLASSIFIER', 'REVISE')),
  constraint annunci10x_ai_operations_status check (status in ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED')),
  constraint annunci10x_ai_operations_output_payload check (output_payload is null or jsonb_typeof(output_payload) = 'object'),
  constraint annunci10x_ai_operations_error_payload check (error_payload is null or jsonb_typeof(error_payload) = 'object'),
  constraint annunci10x_ai_operations_idempotency_key check (char_length(idempotency_key) between 16 and 200),
  constraint annunci10x_ai_operations_unique_idempotency unique (session_id, operation_type, input_snapshot_identity, prompt_version, idempotency_key)
);

create table if not exists public.annunci10x_outputs (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.annunci10x_sessions(id) on delete cascade,
  snapshot_id uuid not null references public.annunci10x_snapshots(id) on delete restrict,
  output_type text not null,
  channel text,
  generated_content jsonb not null,
  parent_master_id uuid references public.annunci10x_outputs(id) on delete restrict,
  validation_state text not null default 'NEEDS_VERIFICATION',
  created_at timestamptz not null default now(),
  constraint annunci10x_outputs_type check (output_type in ('MASTER', 'CHANNEL_VARIANT')),
  constraint annunci10x_outputs_channel check (channel is null or channel in ('LINKEDIN', 'INDEED', 'ATS', 'EMAIL', 'CUSTOM')),
  constraint annunci10x_outputs_content check (jsonb_typeof(generated_content) = 'object'),
  constraint annunci10x_outputs_validation_state check (validation_state in ('READY', 'READY_WITH_WARNINGS', 'NEEDS_VERIFICATION', 'BLOCKED')),
  constraint annunci10x_outputs_variant_parent check (
    (output_type = 'MASTER' and parent_master_id is null) or
    (output_type = 'CHANNEL_VARIANT' and parent_master_id is not null and channel is not null)
  )
);

create table if not exists public.annunci10x_evaluations (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.annunci10x_sessions(id) on delete cascade,
  target text not null,
  target_ref text not null,
  target_output_id uuid references public.annunci10x_outputs(id) on delete set null,
  checks jsonb not null,
  score_result jsonb not null,
  gates jsonb not null,
  rubric_version text not null,
  created_at timestamptz not null default now(),
  constraint annunci10x_evaluations_target check (target in ('ORIGINAL_AD', 'GENERATED_MASTER', 'CHANNEL_VARIANT')),
  constraint annunci10x_evaluations_checks check (jsonb_typeof(checks) = 'array'),
  constraint annunci10x_evaluations_score_result check (jsonb_typeof(score_result) = 'object'),
  constraint annunci10x_evaluations_gates check (jsonb_typeof(gates) = 'object'),
  constraint annunci10x_evaluations_output_target check (
    target = 'ORIGINAL_AD' or target_output_id is not null
  )
);

create table if not exists public.annunci10x_events (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid references public.annunci10x_sessions(id) on delete set null,
  event_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint annunci10x_events_event_name check (event_name ~ '^[a-z][a-z0-9_]{1,80}$'),
  constraint annunci10x_events_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint annunci10x_events_metadata_safe check (
    not (metadata ?| array['raw_answer', 'rawAnswer', 'original_ad', 'originalAd', 'ad_text', 'adText', 'compensation', 'company_name', 'companyName', 'personal_data', 'pii'])
  )
);

create index if not exists annunci10x_sessions_owner_hash_idx on public.annunci10x_sessions(owner_secret_hash);
create index if not exists annunci10x_sessions_updated_at_idx on public.annunci10x_sessions(updated_at desc);
create index if not exists annunci10x_answers_session_created_idx on public.annunci10x_answers(session_id, created_at);
create index if not exists annunci10x_snapshots_latest_idx on public.annunci10x_snapshots(session_id, version desc);
create index if not exists annunci10x_ai_operations_session_idx on public.annunci10x_ai_operations(session_id, started_at desc);
create index if not exists annunci10x_outputs_session_idx on public.annunci10x_outputs(session_id, created_at desc);
create index if not exists annunci10x_outputs_parent_master_idx on public.annunci10x_outputs(parent_master_id) where parent_master_id is not null;
create index if not exists annunci10x_evaluations_session_idx on public.annunci10x_evaluations(session_id, created_at desc);
create index if not exists annunci10x_events_session_idx on public.annunci10x_events(session_id, created_at desc);

alter table public.annunci10x_sessions enable row level security;
alter table public.annunci10x_answers enable row level security;
alter table public.annunci10x_snapshots enable row level security;
alter table public.annunci10x_ai_operations enable row level security;
alter table public.annunci10x_outputs enable row level security;
alter table public.annunci10x_evaluations enable row level security;
alter table public.annunci10x_events enable row level security;

create or replace function public.annunci10x_verify_session_secret(
  p_session_id uuid,
  p_owner_secret_hash text
)
returns boolean
language sql
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.annunci10x_sessions s
    where s.id = p_session_id
      and s.owner_secret_hash = p_owner_secret_hash
      and (s.expires_at is null or s.expires_at > now())
  );
$$;

create or replace function public.annunci10x_create_session(
  p_owner_secret_hash text,
  p_flow text,
  p_state text,
  p_selected_channel text,
  p_commercial_context jsonb,
  p_versions jsonb,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_session public.annunci10x_sessions%rowtype;
begin
  if p_owner_secret_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid owner secret hash';
  end if;

  insert into public.annunci10x_sessions (
    owner_secret_hash,
    flow,
    state,
    selected_channel,
    method_version,
    rubric_version,
    strategy_version,
    prompt_pack_version,
    data_contract_version,
    commercial_context,
    expires_at
  )
  values (
    p_owner_secret_hash,
    p_flow,
    coalesce(p_state, 'STARTED'),
    p_selected_channel,
    p_versions ->> 'methodVersion',
    p_versions ->> 'rubricVersion',
    p_versions ->> 'strategyVersion',
    p_versions ->> 'promptVersion',
    p_versions ->> 'dataContractVersion',
    coalesce(p_commercial_context, '{}'::jsonb),
    p_expires_at
  )
  returning * into v_session;

  return to_jsonb(v_session) - 'owner_secret_hash';
end;
$$;

create or replace function public.annunci10x_append_snapshot(
  p_session_id uuid,
  p_owner_secret_hash text,
  p_role_card jsonb,
  p_role_profile jsonb,
  p_communication_strategy jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_session public.annunci10x_sessions%rowtype;
  v_snapshot public.annunci10x_snapshots%rowtype;
  v_next_version integer;
begin
  select * into v_session
  from public.annunci10x_sessions
  where id = p_session_id
    and owner_secret_hash = p_owner_secret_hash
    and (expires_at is null or expires_at > now())
  for update;

  if v_session.id is null then
    raise exception 'session ownership verification failed';
  end if;

  select coalesce(max(version), 0) + 1 into v_next_version
  from public.annunci10x_snapshots
  where session_id = p_session_id;

  insert into public.annunci10x_snapshots (
    session_id,
    version,
    role_card,
    role_profile,
    communication_strategy,
    reason
  )
  values (
    p_session_id,
    v_next_version,
    p_role_card,
    p_role_profile,
    p_communication_strategy,
    p_reason
  )
  returning * into v_snapshot;

  update public.annunci10x_sessions
  set current_snapshot_id = v_snapshot.id,
      updated_at = now()
  where id = p_session_id;

  return to_jsonb(v_snapshot);
end;
$$;

create or replace function public.annunci10x_register_ai_operation(
  p_session_id uuid,
  p_owner_secret_hash text,
  p_operation_type text,
  p_input_snapshot_id uuid,
  p_prompt_version text,
  p_idempotency_key text,
  p_model text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_operation public.annunci10x_ai_operations%rowtype;
begin
  if not public.annunci10x_verify_session_secret(p_session_id, p_owner_secret_hash) then
    raise exception 'session ownership verification failed';
  end if;

  insert into public.annunci10x_ai_operations (
    session_id,
    operation_type,
    status,
    input_snapshot_id,
    prompt_version,
    idempotency_key,
    model
  )
  values (
    p_session_id,
    p_operation_type,
    'RUNNING',
    p_input_snapshot_id,
    p_prompt_version,
    p_idempotency_key,
    p_model
  )
  on conflict (session_id, operation_type, input_snapshot_identity, prompt_version, idempotency_key)
  do update set idempotency_key = excluded.idempotency_key
  returning * into v_operation;

  return to_jsonb(v_operation);
end;
$$;

create or replace function public.annunci10x_complete_ai_operation(
  p_operation_id uuid,
  p_owner_secret_hash text,
  p_output_snapshot_id uuid,
  p_output_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_operation public.annunci10x_ai_operations%rowtype;
begin
  select o.* into v_operation
  from public.annunci10x_ai_operations o
  join public.annunci10x_sessions s on s.id = o.session_id
  where o.id = p_operation_id
    and s.owner_secret_hash = p_owner_secret_hash
    and (s.expires_at is null or s.expires_at > now());

  if v_operation.id is null then
    raise exception 'operation ownership verification failed';
  end if;

  update public.annunci10x_ai_operations
  set status = 'SUCCEEDED',
      output_snapshot_id = p_output_snapshot_id,
      output_payload = p_output_payload,
      completed_at = now(),
      error_payload = null
  where id = p_operation_id
  returning * into v_operation;

  return to_jsonb(v_operation);
end;
$$;

create or replace function public.annunci10x_fail_ai_operation(
  p_operation_id uuid,
  p_owner_secret_hash text,
  p_error_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_operation public.annunci10x_ai_operations%rowtype;
begin
  select o.* into v_operation
  from public.annunci10x_ai_operations o
  join public.annunci10x_sessions s on s.id = o.session_id
  where o.id = p_operation_id
    and s.owner_secret_hash = p_owner_secret_hash
    and (s.expires_at is null or s.expires_at > now());

  if v_operation.id is null then
    raise exception 'operation ownership verification failed';
  end if;

  update public.annunci10x_ai_operations
  set status = 'FAILED',
      completed_at = now(),
      error_payload = coalesce(p_error_payload, '{}'::jsonb)
  where id = p_operation_id
  returning * into v_operation;

  return to_jsonb(v_operation);
end;
$$;

comment on table public.annunci10x_sessions is 'Annunci 10x anonymous sessions. owner_secret_hash stores a verifier, never the browser secret.';
comment on table public.annunci10x_answers is 'Raw interview answers only; normalized facts live in append-only snapshots.';
comment on table public.annunci10x_snapshots is 'Append-only Annunci 10x normalized state snapshots with monotonic per-session version.';
comment on table public.annunci10x_ai_operations is 'AI operation audit records without chain-of-thought.';
comment on table public.annunci10x_events is 'Minimal telemetry events; payload excludes raw answers, full ad text, compensation, company name and PII by constraint.';

revoke all on table public.annunci10x_sessions from public, anon, authenticated;
revoke all on table public.annunci10x_answers from public, anon, authenticated;
revoke all on table public.annunci10x_snapshots from public, anon, authenticated;
revoke all on table public.annunci10x_ai_operations from public, anon, authenticated;
revoke all on table public.annunci10x_outputs from public, anon, authenticated;
revoke all on table public.annunci10x_evaluations from public, anon, authenticated;
revoke all on table public.annunci10x_events from public, anon, authenticated;

grant select, insert, update on table public.annunci10x_sessions to service_role;
grant select, insert on table public.annunci10x_answers to service_role;
grant select, insert on table public.annunci10x_snapshots to service_role;
grant select, insert, update on table public.annunci10x_ai_operations to service_role;
grant select, insert on table public.annunci10x_outputs to service_role;
grant select, insert on table public.annunci10x_evaluations to service_role;
grant select, insert on table public.annunci10x_events to service_role;

revoke all on function public.annunci10x_verify_session_secret(uuid, text) from public, anon, authenticated;
revoke all on function public.annunci10x_create_session(text, text, text, text, jsonb, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.annunci10x_append_snapshot(uuid, text, jsonb, jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function public.annunci10x_register_ai_operation(uuid, text, text, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.annunci10x_complete_ai_operation(uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.annunci10x_fail_ai_operation(uuid, text, jsonb) from public, anon, authenticated;

grant execute on function public.annunci10x_verify_session_secret(uuid, text) to service_role;
grant execute on function public.annunci10x_create_session(text, text, text, text, jsonb, jsonb, timestamptz) to service_role;
grant execute on function public.annunci10x_append_snapshot(uuid, text, jsonb, jsonb, jsonb, text) to service_role;
grant execute on function public.annunci10x_register_ai_operation(uuid, text, text, uuid, text, text, text) to service_role;
grant execute on function public.annunci10x_complete_ai_operation(uuid, text, uuid, jsonb) to service_role;
grant execute on function public.annunci10x_fail_ai_operation(uuid, text, jsonb) to service_role;

notify pgrst, 'reload schema';
