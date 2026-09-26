-- Annunci 10x durable analysis runs.
-- Additive only: orchestrates lifecycle/source ingestion while ai_operations stays the single-call AI ledger.

create table if not exists public.annunci10x_analysis_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null references public.annunci10x_sessions(id) on delete cascade,
  source_kind text not null,
  source_status text not null,
  source_url text,
  original_input text not null,
  fetched_text text,
  target_text text,
  retrieval_metadata jsonb not null default '{}'::jsonb,
  target_kind text not null,
  declared_channel text,
  source_hash text not null,
  input_identity text not null,
  method_version text not null,
  rubric_version text not null,
  prompt_version text not null,
  score_semantics_version text not null,
  model text not null,
  provider text not null,
  evaluation_mode text not null default 'V1',
  status text not null default 'QUEUED',
  stage text not null default 'SOURCE_VALIDATION',
  evaluation_id uuid references public.annunci10x_evaluations(id) on delete set null,
  result_reference text,
  operation_refs jsonb not null default '{}'::jsonb,
  error_payload jsonb,
  attempt_count integer not null default 0,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  constraint annunci10x_analysis_runs_source_kind check (source_kind in ('PASTED_TEXT', 'PUBLIC_URL')),
  constraint annunci10x_analysis_runs_source_status check (source_status in ('READY', 'URL_FETCH_FAILED', 'INVALID_SOURCE')),
  constraint annunci10x_analysis_runs_target_kind check (target_kind in ('ORIGINAL_AD', 'GENERATED_MASTER', 'CHANNEL_VARIANT')),
  constraint annunci10x_analysis_runs_declared_channel check (declared_channel is null or declared_channel in ('LINKEDIN', 'INDEED', 'ATS', 'EMAIL', 'CUSTOM')),
  constraint annunci10x_analysis_runs_provider check (provider in ('MOCK', 'OPENAI')),
  constraint annunci10x_analysis_runs_evaluation_mode check (evaluation_mode in ('V1', 'V2_SHADOW')),
  constraint annunci10x_analysis_runs_status check (status in ('QUEUED', 'RUNNING', 'READY', 'FAILED')),
  constraint annunci10x_analysis_runs_stage check (stage in ('SOURCE_VALIDATION', 'PRECHECK', 'EXTRACT', 'PROFILE', 'STRATEGY', 'EVALUATE', 'CLARIFY', 'COMPLETE')),
  constraint annunci10x_analysis_runs_source_hash check (source_hash ~ '^[0-9a-f]{64}$'),
  constraint annunci10x_analysis_runs_input_identity check (char_length(input_identity) between 16 and 200),
  constraint annunci10x_analysis_runs_retrieval_metadata check (jsonb_typeof(retrieval_metadata) = 'object'),
  constraint annunci10x_analysis_runs_operation_refs check (jsonb_typeof(operation_refs) = 'object'),
  constraint annunci10x_analysis_runs_error_payload check (error_payload is null or jsonb_typeof(error_payload) = 'object'),
  constraint annunci10x_analysis_runs_attempt_count check (attempt_count >= 0),
  constraint annunci10x_analysis_runs_ready_result check (status <> 'READY' or evaluation_id is not null),
  constraint annunci10x_analysis_runs_failed_error check (status <> 'FAILED' or error_payload is not null),
  constraint annunci10x_analysis_runs_unique_identity unique (session_id, input_identity)
);

create table if not exists public.annunci10x_rate_limits (
  scope text not null,
  subject text not null,
  count integer not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (scope, subject),
  constraint annunci10x_rate_limits_scope check (scope ~ '^[a-z][a-z0-9_]{1,80}$'),
  constraint annunci10x_rate_limits_subject check (char_length(subject) between 1 and 240),
  constraint annunci10x_rate_limits_count check (count >= 0)
);

create index if not exists annunci10x_analysis_runs_session_created_idx
  on public.annunci10x_analysis_runs(session_id, created_at desc);

create index if not exists annunci10x_analysis_runs_status_lease_idx
  on public.annunci10x_analysis_runs(status, lease_expires_at)
  where status in ('QUEUED', 'RUNNING');

create index if not exists annunci10x_analysis_runs_evaluation_idx
  on public.annunci10x_analysis_runs(evaluation_id)
  where evaluation_id is not null;

create index if not exists annunci10x_rate_limits_reset_idx
  on public.annunci10x_rate_limits(reset_at);

alter table public.annunci10x_analysis_runs enable row level security;
alter table public.annunci10x_rate_limits enable row level security;

create or replace function public.annunci10x_create_or_get_analysis_run(
  p_session_id uuid,
  p_owner_secret_hash text,
  p_source_kind text,
  p_source_status text,
  p_original_input text,
  p_source_url text,
  p_fetched_text text,
  p_target_text text,
  p_retrieval_metadata jsonb,
  p_failure_code text,
  p_failure_message text,
  p_target_kind text,
  p_declared_channel text,
  p_source_hash text,
  p_input_identity text,
  p_method_version text,
  p_rubric_version text,
  p_prompt_version text,
  p_score_semantics_version text,
  p_model text,
  p_provider text,
  p_evaluation_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_run public.annunci10x_analysis_runs%rowtype;
  v_now timestamptz := now();
  v_status text := case when p_source_status = 'READY' then 'QUEUED' else 'FAILED' end;
  v_error jsonb := case
    when p_source_status = 'READY' then null
    else jsonb_build_object('code', coalesce(p_failure_code, 'URL_FETCH_FAILED'), 'message', coalesce(p_failure_message, 'Source ingestion failed.'))
  end;
begin
  if not public.annunci10x_verify_session_secret(p_session_id, p_owner_secret_hash) then
    raise exception 'session ownership verification failed';
  end if;

  insert into public.annunci10x_analysis_runs (
    session_id,
    source_kind,
    source_status,
    source_url,
    original_input,
    fetched_text,
    target_text,
    retrieval_metadata,
    target_kind,
    declared_channel,
    source_hash,
    input_identity,
    method_version,
    rubric_version,
    prompt_version,
    score_semantics_version,
    model,
    provider,
    evaluation_mode,
    status,
    stage,
    error_payload,
    failed_at
  )
  values (
    p_session_id,
    p_source_kind,
    p_source_status,
    p_source_url,
    p_original_input,
    p_fetched_text,
    p_target_text,
    coalesce(p_retrieval_metadata, '{}'::jsonb),
    p_target_kind,
    p_declared_channel,
    p_source_hash,
    p_input_identity,
    p_method_version,
    p_rubric_version,
    p_prompt_version,
    p_score_semantics_version,
    p_model,
    p_provider,
    p_evaluation_mode,
    v_status,
    'SOURCE_VALIDATION',
    v_error,
    case when v_status = 'FAILED' then v_now else null end
  )
  on conflict (session_id, input_identity)
  do update set input_identity = excluded.input_identity
  returning * into v_run;

  return to_jsonb(v_run);
end;
$$;

create or replace function public.annunci10x_claim_analysis_run(
  p_analysis_run_id uuid,
  p_owner_secret_hash text,
  p_lease_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_run public.annunci10x_analysis_runs%rowtype;
begin
  select r.* into v_run
  from public.annunci10x_analysis_runs r
  join public.annunci10x_sessions s on s.id = r.session_id
  where r.id = p_analysis_run_id
    and s.owner_secret_hash = p_owner_secret_hash
    and (s.expires_at is null or s.expires_at > now())
  for update of r;

  if v_run.id is null then
    raise exception 'analysis run ownership verification failed';
  end if;

  if v_run.status in ('READY', 'FAILED') then
    return null;
  end if;

  if v_run.status = 'RUNNING' and v_run.lease_expires_at is not null and v_run.lease_expires_at > now() then
    return null;
  end if;

  update public.annunci10x_analysis_runs
  set status = 'RUNNING',
      started_at = coalesce(started_at, now()),
      lease_expires_at = now() + make_interval(secs => greatest(1, p_lease_seconds)),
      attempt_count = attempt_count + 1,
      updated_at = now()
  where id = p_analysis_run_id
  returning * into v_run;

  return to_jsonb(v_run);
end;
$$;

create or replace function public.annunci10x_update_analysis_run(
  p_analysis_run_id uuid,
  p_owner_secret_hash text,
  p_status text default null,
  p_stage text default null,
  p_source_status text default null,
  p_evaluation_id uuid default null,
  p_result_reference text default null,
  p_operation_refs jsonb default null,
  p_retrieval_metadata jsonb default null,
  p_error_payload jsonb default null,
  p_lease_expires_at timestamptz default null,
  p_started_at timestamptz default null,
  p_completed_at timestamptz default null,
  p_failed_at timestamptz default null,
  p_increment_attempt_count boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_run public.annunci10x_analysis_runs%rowtype;
begin
  select r.* into v_run
  from public.annunci10x_analysis_runs r
  join public.annunci10x_sessions s on s.id = r.session_id
  where r.id = p_analysis_run_id
    and s.owner_secret_hash = p_owner_secret_hash
    and (s.expires_at is null or s.expires_at > now());

  if v_run.id is null then
    raise exception 'analysis run ownership verification failed';
  end if;

  update public.annunci10x_analysis_runs
  set status = coalesce(p_status, status),
      stage = coalesce(p_stage, stage),
      source_status = coalesce(p_source_status, source_status),
      evaluation_id = coalesce(p_evaluation_id, evaluation_id),
      result_reference = coalesce(p_result_reference, result_reference),
      operation_refs = coalesce(p_operation_refs, operation_refs),
      retrieval_metadata = coalesce(p_retrieval_metadata, retrieval_metadata),
      error_payload = p_error_payload,
      lease_expires_at = p_lease_expires_at,
      started_at = coalesce(p_started_at, started_at),
      completed_at = coalesce(p_completed_at, completed_at),
      failed_at = coalesce(p_failed_at, failed_at),
      attempt_count = attempt_count + case when p_increment_attempt_count then 1 else 0 end,
      updated_at = now()
  where id = p_analysis_run_id
  returning * into v_run;

  return to_jsonb(v_run);
end;
$$;

create or replace function public.annunci10x_check_rate_limit(
  p_scope text,
  p_subject text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row public.annunci10x_rate_limits%rowtype;
  v_now timestamptz := now();
  v_reset timestamptz := now() + make_interval(secs => greatest(1, p_window_seconds));
  v_allowed boolean;
begin
  insert into public.annunci10x_rate_limits(scope, subject, count, reset_at)
  values (p_scope, p_subject, 1, v_reset)
  on conflict (scope, subject)
  do update set
    count = case
      when public.annunci10x_rate_limits.reset_at <= v_now then 1
      else public.annunci10x_rate_limits.count + 1
    end,
    reset_at = case
      when public.annunci10x_rate_limits.reset_at <= v_now then v_reset
      else public.annunci10x_rate_limits.reset_at
    end,
    updated_at = v_now
  returning * into v_row;

  v_allowed := v_row.count <= p_limit;
  return jsonb_build_object(
    'allowed', v_allowed,
    'remaining', greatest(0, p_limit - v_row.count),
    'retry_after_seconds', case when v_allowed then 0 else greatest(1, ceil(extract(epoch from (v_row.reset_at - v_now)))::integer) end,
    'reset_at', v_row.reset_at
  );
end;
$$;

comment on table public.annunci10x_analysis_runs is 'Durable Annunci 10x analysis lifecycle and immutable source target. Individual AI calls remain in annunci10x_ai_operations.';
comment on table public.annunci10x_rate_limits is 'Persistent coarse rate limits for costly Annunci 10x server-side actions.';

revoke all on table public.annunci10x_analysis_runs from public, anon, authenticated;
revoke all on table public.annunci10x_rate_limits from public, anon, authenticated;

grant select, insert, update on table public.annunci10x_analysis_runs to service_role;
grant select, insert, update on table public.annunci10x_rate_limits to service_role;

revoke all on function public.annunci10x_create_or_get_analysis_run(uuid, text, text, text, text, text, text, text, jsonb, text, text, text, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.annunci10x_claim_analysis_run(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.annunci10x_update_analysis_run(uuid, text, text, text, text, uuid, text, jsonb, jsonb, jsonb, timestamptz, timestamptz, timestamptz, timestamptz, boolean) from public, anon, authenticated;
revoke all on function public.annunci10x_check_rate_limit(text, text, integer, integer) from public, anon, authenticated;

grant execute on function public.annunci10x_create_or_get_analysis_run(uuid, text, text, text, text, text, text, text, jsonb, text, text, text, text, text, text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.annunci10x_claim_analysis_run(uuid, text, integer) to service_role;
grant execute on function public.annunci10x_update_analysis_run(uuid, text, text, text, text, uuid, text, jsonb, jsonb, jsonb, timestamptz, timestamptz, timestamptz, timestamptz, boolean) to service_role;
grant execute on function public.annunci10x_check_rate_limit(text, text, integer, integer) to service_role;

notify pgrst, 'reload schema';
