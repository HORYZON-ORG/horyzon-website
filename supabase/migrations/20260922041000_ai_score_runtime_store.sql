-- Horyzon AI Score runtime safety store.
-- Prepared in Phase 6B. Apply only to the authorized Horyzon database.
-- Budget dates are UTC dates supplied by the server runtime.

create table if not exists public.provider_daily_usage (
  budget_date date not null,
  provider_id text not null,
  mode text not null default 'PUBLIC',
  request_count integer not null default 0,
  observation_count integer not null default 0,
  estimated_cost_usd numeric(12, 6) not null default 0,
  actual_cost_usd numeric(12, 6),
  success_count integer not null default 0,
  failure_count integer not null default 0,
  total_latency_ms bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (budget_date, provider_id, mode),
  constraint provider_daily_usage_non_negative check (request_count >= 0 and observation_count >= 0 and estimated_cost_usd >= 0 and (actual_cost_usd is null or actual_cost_usd >= 0) and success_count >= 0 and failure_count >= 0 and total_latency_ms >= 0)
);

create table if not exists public.provider_runtime_state (
  provider_id text primary key,
  circuit_state text not null default 'CLOSED',
  consecutive_failures integer not null default 0,
  opened_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error_code text,
  updated_at timestamptz not null default now(),
  constraint provider_runtime_state_circuit check (circuit_state in ('CLOSED', 'OPEN', 'HALF_OPEN')),
  constraint provider_runtime_state_failures check (consecutive_failures >= 0)
);

create table if not exists public.ai_score_rate_limit (
  bucket_key text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (bucket_key, window_start),
  constraint ai_score_rate_limit_count check (request_count >= 0)
);

alter table public.provider_daily_usage enable row level security;
alter table public.provider_runtime_state enable row level security;
alter table public.ai_score_rate_limit enable row level security;

create or replace function public.ai_score_reserve_provider_budget(
  p_provider_id text,
  p_mode text,
  p_budget_date date,
  p_estimated_cost_usd numeric,
  p_request_count integer,
  p_observation_count integer,
  p_provider_budget_usd numeric,
  p_global_budget_usd numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider provider_daily_usage%rowtype;
  v_global provider_daily_usage%rowtype;
begin
  if p_estimated_cost_usd <= 0 or p_request_count <= 0 then
    return jsonb_build_object('allowed', false, 'reason', 'invalid_budget', 'reservedCostUsd', 0);
  end if;

  if p_provider_budget_usd is null or p_provider_budget_usd <= 0 or p_global_budget_usd is null or p_global_budget_usd <= 0 then
    return jsonb_build_object('allowed', false, 'reason', 'missing_budget', 'reservedCostUsd', 0);
  end if;

  insert into public.provider_daily_usage (budget_date, provider_id, mode) values (p_budget_date, p_provider_id, p_mode) on conflict (budget_date, provider_id, mode) do nothing;
  insert into public.provider_daily_usage (budget_date, provider_id, mode) values (p_budget_date, '__global__', p_mode) on conflict (budget_date, provider_id, mode) do nothing;

  select * into v_provider from public.provider_daily_usage where budget_date = p_budget_date and provider_id = p_provider_id and mode = p_mode for update;
  select * into v_global from public.provider_daily_usage where budget_date = p_budget_date and provider_id = '__global__' and mode = p_mode for update;

  if v_provider.estimated_cost_usd + p_estimated_cost_usd > p_provider_budget_usd then
    return jsonb_build_object('allowed', false, 'reason', 'provider_budget_exhausted', 'reservedCostUsd', 0, 'dailyBudgetUsd', p_provider_budget_usd, 'globalBudgetUsd', p_global_budget_usd);
  end if;

  if v_global.estimated_cost_usd + p_estimated_cost_usd > p_global_budget_usd then
    return jsonb_build_object('allowed', false, 'reason', 'global_budget_exhausted', 'reservedCostUsd', 0, 'dailyBudgetUsd', p_provider_budget_usd, 'globalBudgetUsd', p_global_budget_usd);
  end if;

  update public.provider_daily_usage
  set request_count = request_count + p_request_count,
      observation_count = observation_count + coalesce(p_observation_count, p_request_count),
      estimated_cost_usd = estimated_cost_usd + p_estimated_cost_usd,
      updated_at = now()
  where budget_date = p_budget_date and provider_id in (p_provider_id, '__global__') and mode = p_mode;

  select * into v_provider from public.provider_daily_usage where budget_date = p_budget_date and provider_id = p_provider_id and mode = p_mode;
  select * into v_global from public.provider_daily_usage where budget_date = p_budget_date and provider_id = '__global__' and mode = p_mode;

  return jsonb_build_object(
    'allowed', true,
    'reservedCostUsd', p_estimated_cost_usd,
    'dailyBudgetUsd', p_provider_budget_usd,
    'globalBudgetUsd', p_global_budget_usd,
    'dailyUsage', jsonb_build_object('providerId', v_provider.provider_id, 'date', v_provider.budget_date, 'spentUsd', v_provider.estimated_cost_usd, 'requestCount', v_provider.request_count, 'consecutiveFailures', 0),
    'globalUsage', jsonb_build_object('providerId', v_global.provider_id, 'date', v_global.budget_date, 'spentUsd', v_global.estimated_cost_usd, 'requestCount', v_global.request_count, 'consecutiveFailures', 0)
  );
end;
$$;

create or replace function public.ai_score_reconcile_provider_budget(
  p_provider_id text,
  p_mode text,
  p_budget_date date,
  p_estimated_cost_usd numeric,
  p_actual_cost_usd numeric,
  p_success boolean,
  p_latency_ms integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta numeric := 0;
begin
  if p_actual_cost_usd is not null then
    v_delta := p_actual_cost_usd - p_estimated_cost_usd;
  end if;

  update public.provider_daily_usage
  set estimated_cost_usd = greatest(0, estimated_cost_usd + v_delta),
      actual_cost_usd = coalesce(actual_cost_usd, 0) + coalesce(p_actual_cost_usd, p_estimated_cost_usd),
      success_count = success_count + case when p_success then 1 else 0 end,
      failure_count = failure_count + case when p_success then 0 else 1 end,
      total_latency_ms = total_latency_ms + greatest(0, coalesce(p_latency_ms, 0)),
      updated_at = now()
  where budget_date = p_budget_date and provider_id in (p_provider_id, '__global__') and mode = p_mode;

  return jsonb_build_object('providerId', p_provider_id, 'date', p_budget_date, 'estimatedCostUsd', p_estimated_cost_usd, 'actualCostUsd', p_actual_cost_usd, 'success', p_success);
end;
$$;

create or replace function public.ai_score_check_rate_limit(p_bucket_key text, p_window_start timestamptz, p_expires_at timestamptz, p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.ai_score_rate_limit (bucket_key, window_start, request_count, expires_at)
  values (p_bucket_key, p_window_start, 1, p_expires_at)
  on conflict (bucket_key, window_start)
  do update set request_count = ai_score_rate_limit.request_count + 1,
                expires_at = greatest(ai_score_rate_limit.expires_at, excluded.expires_at),
                updated_at = now()
  returning request_count into v_count;

  return jsonb_build_object('allowed', v_count <= p_limit, 'bucketKey', p_bucket_key, 'windowStart', p_window_start, 'expiresAt', p_expires_at, 'requestCount', v_count, 'limit', p_limit, 'retryAfterSeconds', greatest(0, ceil(extract(epoch from (p_expires_at - now())))), 'reason', case when v_count <= p_limit then null else 'rate_limited' end);
end;
$$;

create or replace function public.ai_score_get_provider_circuit(p_provider_id text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select case when s.provider_id is null then null else jsonb_build_object('providerId', s.provider_id, 'circuitState', s.circuit_state, 'consecutiveFailures', s.consecutive_failures, 'openedAt', s.opened_at, 'lastSuccessAt', s.last_success_at, 'lastFailureAt', s.last_failure_at, 'lastErrorCode', s.last_error_code) end
  from (select p_provider_id as provider_id) p
  left join public.provider_runtime_state s on s.provider_id = p.provider_id;
$$;

create or replace function public.ai_score_record_provider_success(p_provider_id text, p_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.provider_runtime_state (provider_id, circuit_state, consecutive_failures, last_success_at, updated_at)
  values (p_provider_id, 'CLOSED', 0, p_at, now())
  on conflict (provider_id)
  do update set circuit_state = 'CLOSED', consecutive_failures = 0, opened_at = null, last_success_at = p_at, last_error_code = null, updated_at = now();
  return public.ai_score_get_provider_circuit(p_provider_id);
end;
$$;

create or replace function public.ai_score_record_provider_failure(p_provider_id text, p_error_code text, p_failure_class text, p_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_threshold integer := 3;
begin
  insert into public.provider_runtime_state (provider_id, circuit_state, consecutive_failures, opened_at, last_failure_at, last_error_code, updated_at)
  values (p_provider_id, case when p_failure_class = 'AUTH' then 'OPEN' else 'CLOSED' end, 1, case when p_failure_class = 'AUTH' then p_at else null end, p_at, p_error_code, now())
  on conflict (provider_id)
  do update set consecutive_failures = provider_runtime_state.consecutive_failures + 1,
                circuit_state = case when p_failure_class = 'AUTH' or provider_runtime_state.consecutive_failures + 1 >= v_threshold then 'OPEN' else provider_runtime_state.circuit_state end,
                opened_at = case when p_failure_class = 'AUTH' or provider_runtime_state.consecutive_failures + 1 >= v_threshold then p_at else provider_runtime_state.opened_at end,
                last_failure_at = p_at,
                last_error_code = p_error_code,
                updated_at = now();
  return public.ai_score_get_provider_circuit(p_provider_id);
end;
$$;

create or replace function public.ai_score_open_provider_circuit(p_provider_id text, p_error_code text, p_failure_class text, p_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.provider_runtime_state (provider_id, circuit_state, consecutive_failures, opened_at, last_failure_at, last_error_code, updated_at)
  values (p_provider_id, 'OPEN', 1, p_at, p_at, p_error_code, now())
  on conflict (provider_id)
  do update set circuit_state = 'OPEN', consecutive_failures = greatest(1, provider_runtime_state.consecutive_failures), opened_at = p_at, last_failure_at = p_at, last_error_code = p_error_code, updated_at = now();
  return public.ai_score_get_provider_circuit(p_provider_id);
end;
$$;

create or replace function public.ai_score_try_provider_half_open(p_provider_id text, p_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.provider_runtime_state (provider_id, circuit_state, consecutive_failures, opened_at, updated_at)
  values (p_provider_id, 'HALF_OPEN', 0, p_at, now())
  on conflict (provider_id)
  do update set circuit_state = 'HALF_OPEN', opened_at = coalesce(provider_runtime_state.opened_at, p_at), updated_at = now();
  return public.ai_score_get_provider_circuit(p_provider_id);
end;
$$;

revoke all on table public.provider_daily_usage from anon, authenticated;
revoke all on table public.provider_runtime_state from anon, authenticated;
revoke all on table public.ai_score_rate_limit from anon, authenticated;
revoke all on function public.ai_score_reserve_provider_budget(text, text, date, numeric, integer, integer, numeric, numeric) from anon, authenticated;
revoke all on function public.ai_score_reconcile_provider_budget(text, text, date, numeric, numeric, boolean, integer) from anon, authenticated;
revoke all on function public.ai_score_check_rate_limit(text, timestamptz, timestamptz, integer) from anon, authenticated;
revoke all on function public.ai_score_get_provider_circuit(text) from anon, authenticated;
revoke all on function public.ai_score_record_provider_success(text, timestamptz) from anon, authenticated;
revoke all on function public.ai_score_record_provider_failure(text, text, text, timestamptz) from anon, authenticated;
revoke all on function public.ai_score_open_provider_circuit(text, text, text, timestamptz) from anon, authenticated;
revoke all on function public.ai_score_try_provider_half_open(text, timestamptz) from anon, authenticated;
