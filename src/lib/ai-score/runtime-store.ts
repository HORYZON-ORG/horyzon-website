import { createHmac } from 'node:crypto';

export type AiScoreProviderId =
  | 'openai_web_search'
  | 'google_search_grounding'
  | 'perplexity_sonar'
  | 'perplexity_search';
export type ProviderRuntimeMode = 'DISABLED' | 'TEST_ONLY' | 'PUBLIC';
export type ProviderCircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface ProviderUsageSnapshot {
  providerId: AiScoreProviderId;
  date: string;
  spentUsd: number;
  requestCount: number;
  consecutiveFailures: number;
}

export interface ProviderUsageStore {
  persistent: boolean;
  getDailyUsage(providerId: AiScoreProviderId, date: string): ProviderUsageSnapshot;
  recordUsage(providerId: AiScoreProviderId, usage: { date: string; spentUsd: number; requestCount: number }): void;
  recordFailure(providerId: AiScoreProviderId, failure: { date: string; code: string }): void;
  resetFailures(providerId: AiScoreProviderId): void;
}

export type ProviderFailureClass = 'AUTH' | 'RATE_LIMIT' | 'PROVIDER' | 'TIMEOUT' | 'MALFORMED_RESPONSE' | 'INTERNAL';
export type RuntimeStoreKind = 'noop' | 'memory' | 'supabase_rpc';

export interface BudgetReservation {
  allowed: boolean;
  reason?: 'missing_budget' | 'provider_budget_exhausted' | 'global_budget_exhausted' | 'invalid_budget' | 'store_unavailable';
  reservedCostUsd: number;
  dailyUsage: ProviderUsageSnapshot;
  globalUsage?: ProviderUsageSnapshot;
  dailyBudgetUsd: number | null;
  globalBudgetUsd: number | null;
}

export interface BudgetReconciliation {
  providerId: AiScoreProviderId;
  date: string;
  estimatedCostUsd: number;
  actualCostUsd: number | null;
  success: boolean;
}

export interface RuntimeRateLimitResult {
  allowed: boolean;
  bucketKey: string;
  windowStart: string;
  expiresAt: string;
  requestCount: number;
  limit: number;
  retryAfterSeconds: number;
  reason?: 'rate_limited' | 'store_unavailable' | 'missing_hmac_secret';
}

export interface RuntimeCircuitSnapshot {
  providerId: AiScoreProviderId;
  circuitState: ProviderCircuitState;
  consecutiveFailures: number;
  openedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastErrorCode: string | null;
}

export interface ProviderRuntimeStore extends ProviderUsageStore {
  kind: RuntimeStoreKind;
  reserveBudget(input: BudgetReservationInput): Promise<BudgetReservation>;
  reconcileBudget(input: BudgetReconciliationInput): Promise<BudgetReconciliation>;
  checkRateLimit(input: RuntimeRateLimitInput): Promise<RuntimeRateLimitResult>;
  getCircuitState(providerId: AiScoreProviderId): Promise<RuntimeCircuitSnapshot | null>;
  recordProviderSuccess(providerId: AiScoreProviderId, at?: Date): Promise<RuntimeCircuitSnapshot>;
  recordProviderFailure(providerId: AiScoreProviderId, failure: { errorCode: string; failureClass: ProviderFailureClass; at?: Date }): Promise<RuntimeCircuitSnapshot>;
  openCircuit(providerId: AiScoreProviderId, reason: { errorCode: string; failureClass: ProviderFailureClass; at?: Date }): Promise<RuntimeCircuitSnapshot>;
  tryHalfOpen(providerId: AiScoreProviderId, at?: Date): Promise<RuntimeCircuitSnapshot>;
}

export interface BudgetReservationInput {
  providerId: AiScoreProviderId;
  mode: ProviderRuntimeMode;
  estimatedCostUsd: number;
  estimatedRequests: number;
  estimatedObservations?: number;
  providerDailyBudgetUsd: number | null;
  globalDailyBudgetUsd: number | null;
  at?: Date;
}

export interface BudgetReconciliationInput {
  providerId: AiScoreProviderId;
  mode: ProviderRuntimeMode;
  estimatedCostUsd: number;
  actualCostUsd?: number | null;
  success: boolean;
  latencyMs?: number;
  at?: Date;
}

export interface RuntimeRateLimitInput {
  scope: 'client' | 'domain';
  rawIdentifier: string;
  limit: number;
  windowSeconds: number;
  at?: Date;
}

export const GLOBAL_PROVIDER_USAGE_ID = '__global__' as AiScoreProviderId;

export class MemoryProviderRuntimeStore implements ProviderRuntimeStore {
  persistent: boolean;
  kind: RuntimeStoreKind = 'memory';
  private usage = new Map<string, ProviderUsageSnapshot>();
  private circuits = new Map<AiScoreProviderId, RuntimeCircuitSnapshot>();
  private buckets = new Map<string, { count: number; windowStart: string; expiresAt: string }>();

  constructor(options: { persistent?: boolean } = {}) {
    this.persistent = options.persistent ?? false;
  }

  getDailyUsage(providerId: AiScoreProviderId, date: string): ProviderUsageSnapshot {
    return this.usage.get(usageKey(providerId, date)) ?? emptyUsage(providerId, date);
  }

  recordUsage(providerId: AiScoreProviderId, usage: { date: string; spentUsd: number; requestCount: number }): void {
    const current = this.getDailyUsage(providerId, usage.date);
    this.usage.set(usageKey(providerId, usage.date), {
      ...current,
      spentUsd: roundMoney(current.spentUsd + usage.spentUsd),
      requestCount: current.requestCount + usage.requestCount,
    });
  }

  recordFailure(providerId: AiScoreProviderId, failure: { date: string; code: string }): void {
    const current = this.getDailyUsage(providerId, failure.date);
    this.usage.set(usageKey(providerId, failure.date), {
      ...current,
      consecutiveFailures: current.consecutiveFailures + 1,
    });
  }

  resetFailures(providerId: AiScoreProviderId): void {
    for (const [key, value] of this.usage.entries()) {
      if (value.providerId === providerId) this.usage.set(key, { ...value, consecutiveFailures: 0 });
    }
  }

  async reserveBudget(input: BudgetReservationInput): Promise<BudgetReservation> {
    const date = budgetDate(input.at);
    if (!this.persistent) return denied(input, date, 'store_unavailable');
    if (!isPositiveMoney(input.providerDailyBudgetUsd) || !isPositiveMoney(input.globalDailyBudgetUsd)) return denied(input, date, 'missing_budget');
    if (!isPositiveMoney(input.estimatedCostUsd)) return denied(input, date, 'invalid_budget');

    const providerUsage = this.getDailyUsage(input.providerId, date);
    const globalUsage = this.getDailyUsage(GLOBAL_PROVIDER_USAGE_ID, date);
    if (providerUsage.spentUsd + input.estimatedCostUsd > input.providerDailyBudgetUsd) return denied(input, date, 'provider_budget_exhausted');
    if (globalUsage.spentUsd + input.estimatedCostUsd > input.globalDailyBudgetUsd) return denied(input, date, 'global_budget_exhausted');

    const nextProvider = addUsage(providerUsage, input);
    const nextGlobal = addUsage(globalUsage, input);
    this.usage.set(usageKey(input.providerId, date), nextProvider);
    this.usage.set(usageKey(GLOBAL_PROVIDER_USAGE_ID, date), nextGlobal);
    return { allowed: true, reservedCostUsd: input.estimatedCostUsd, dailyUsage: nextProvider, globalUsage: nextGlobal, dailyBudgetUsd: input.providerDailyBudgetUsd, globalBudgetUsd: input.globalDailyBudgetUsd };
  }

  async reconcileBudget(input: BudgetReconciliationInput): Promise<BudgetReconciliation> {
    const date = budgetDate(input.at);
    const actualCostUsd = typeof input.actualCostUsd === 'number' && input.actualCostUsd >= 0 ? input.actualCostUsd : null;
    const delta = actualCostUsd === null ? 0 : actualCostUsd - input.estimatedCostUsd;
    for (const providerId of [input.providerId, GLOBAL_PROVIDER_USAGE_ID]) {
      const current = this.getDailyUsage(providerId, date);
      this.usage.set(usageKey(providerId, date), {
        ...current,
        spentUsd: roundMoney(Math.max(0, current.spentUsd + delta)),
      });
    }
    return { providerId: input.providerId, date, estimatedCostUsd: input.estimatedCostUsd, actualCostUsd, success: input.success };
  }

  async checkRateLimit(input: RuntimeRateLimitInput): Promise<RuntimeRateLimitResult> {
    const now = input.at ?? new Date();
    const key = rateLimitBucketKey(input);
    if (key.reason) return key.reason;
    const windowStart = windowStartIso(now, input.windowSeconds);
    const expiresAt = new Date(new Date(windowStart).getTime() + input.windowSeconds * 1000).toISOString();
    const existing = this.buckets.get(key.bucketKey);
    const active = existing && new Date(existing.expiresAt).getTime() > now.getTime() && existing.windowStart === windowStart;
    const count = active ? existing.count + 1 : 1;
    this.buckets.set(key.bucketKey, { count, windowStart, expiresAt });
    const retryAfterSeconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 1000));
    return { allowed: count <= input.limit, bucketKey: key.bucketKey, windowStart, expiresAt, requestCount: count, limit: input.limit, retryAfterSeconds, reason: count <= input.limit ? undefined : 'rate_limited' };
  }

  async getCircuitState(providerId: AiScoreProviderId): Promise<RuntimeCircuitSnapshot | null> {
    return this.circuits.get(providerId) ?? null;
  }

  async recordProviderSuccess(providerId: AiScoreProviderId, at = new Date()): Promise<RuntimeCircuitSnapshot> {
    const previous = this.circuits.get(providerId);
    const snapshot = { providerId, circuitState: 'CLOSED' as const, consecutiveFailures: 0, openedAt: null, lastSuccessAt: at.toISOString(), lastFailureAt: previous?.lastFailureAt ?? null, lastErrorCode: null };
    this.circuits.set(providerId, snapshot);
    return snapshot;
  }

  async recordProviderFailure(providerId: AiScoreProviderId, failure: { errorCode: string; failureClass: ProviderFailureClass; at?: Date }): Promise<RuntimeCircuitSnapshot> {
    const now = failure.at ?? new Date();
    const previous = this.circuits.get(providerId);
    const failures = (previous?.consecutiveFailures ?? 0) + 1;
    const shouldOpen = failure.failureClass === 'AUTH' || failures >= circuitFailureThreshold();
    const snapshot = { providerId, circuitState: shouldOpen ? 'OPEN' as const : previous?.circuitState ?? 'CLOSED' as const, consecutiveFailures: failures, openedAt: shouldOpen ? now.toISOString() : previous?.openedAt ?? null, lastSuccessAt: previous?.lastSuccessAt ?? null, lastFailureAt: now.toISOString(), lastErrorCode: failure.errorCode };
    this.circuits.set(providerId, snapshot);
    return snapshot;
  }

  async openCircuit(providerId: AiScoreProviderId, reason: { errorCode: string; failureClass: ProviderFailureClass; at?: Date }): Promise<RuntimeCircuitSnapshot> {
    const now = reason.at ?? new Date();
    const previous = this.circuits.get(providerId);
    const snapshot = { providerId, circuitState: 'OPEN' as const, consecutiveFailures: Math.max(1, previous?.consecutiveFailures ?? 0), openedAt: now.toISOString(), lastSuccessAt: previous?.lastSuccessAt ?? null, lastFailureAt: now.toISOString(), lastErrorCode: reason.errorCode };
    this.circuits.set(providerId, snapshot);
    return snapshot;
  }

  async tryHalfOpen(providerId: AiScoreProviderId, at = new Date()): Promise<RuntimeCircuitSnapshot> {
    const previous = this.circuits.get(providerId);
    const snapshot = { providerId, circuitState: 'HALF_OPEN' as const, consecutiveFailures: previous?.consecutiveFailures ?? 0, openedAt: previous?.openedAt ?? at.toISOString(), lastSuccessAt: previous?.lastSuccessAt ?? null, lastFailureAt: previous?.lastFailureAt ?? null, lastErrorCode: previous?.lastErrorCode ?? null };
    this.circuits.set(providerId, snapshot);
    return snapshot;
  }
}

export class SupabaseProviderRuntimeStore implements ProviderRuntimeStore {
  persistent = true;
  kind: RuntimeStoreKind = 'supabase_rpc';
  private readonly url: string;
  private readonly serviceRoleKey: string;

  constructor(config: { url: string; serviceRoleKey: string }) {
    this.url = config.url.replace(/\/$/, '');
    this.serviceRoleKey = config.serviceRoleKey;
  }

  getDailyUsage(providerId: AiScoreProviderId, date: string): ProviderUsageSnapshot {
    return emptyUsage(providerId, date);
  }

  recordUsage(_providerId: AiScoreProviderId, _usage: { date: string; spentUsd: number; requestCount: number }): void {}
  recordFailure(_providerId: AiScoreProviderId, _failure: { date: string; code: string }): void {}
  resetFailures(_providerId: AiScoreProviderId): void {}

  async reserveBudget(input: BudgetReservationInput): Promise<BudgetReservation> {
    return this.rpc('ai_score_reserve_provider_budget', {
      p_provider_id: input.providerId,
      p_mode: input.mode,
      p_budget_date: budgetDate(input.at),
      p_estimated_cost_usd: input.estimatedCostUsd,
      p_request_count: input.estimatedRequests,
      p_observation_count: input.estimatedObservations ?? input.estimatedRequests,
      p_provider_budget_usd: input.providerDailyBudgetUsd,
      p_global_budget_usd: input.globalDailyBudgetUsd,
    });
  }

  async reconcileBudget(input: BudgetReconciliationInput): Promise<BudgetReconciliation> {
    return this.rpc('ai_score_reconcile_provider_budget', {
      p_provider_id: input.providerId,
      p_mode: input.mode,
      p_budget_date: budgetDate(input.at),
      p_estimated_cost_usd: input.estimatedCostUsd,
      p_actual_cost_usd: input.actualCostUsd ?? null,
      p_success: input.success,
      p_latency_ms: input.latencyMs ?? 0,
    });
  }

  async checkRateLimit(input: RuntimeRateLimitInput): Promise<RuntimeRateLimitResult> {
    const key = rateLimitBucketKey(input);
    if (key.reason) return key.reason;
    const at = input.at ?? new Date();
    const windowStart = windowStartIso(at, input.windowSeconds);
    const expiresAt = new Date(new Date(windowStart).getTime() + input.windowSeconds * 1000).toISOString();
    return this.rpc('ai_score_check_rate_limit', {
      p_bucket_key: key.bucketKey,
      p_window_start: windowStart,
      p_expires_at: expiresAt,
      p_limit: input.limit,
    });
  }

  async getCircuitState(providerId: AiScoreProviderId): Promise<RuntimeCircuitSnapshot | null> {
    return this.rpc('ai_score_get_provider_circuit', { p_provider_id: providerId });
  }

  async recordProviderSuccess(providerId: AiScoreProviderId, at = new Date()): Promise<RuntimeCircuitSnapshot> {
    return this.rpc('ai_score_record_provider_success', { p_provider_id: providerId, p_at: at.toISOString() });
  }

  async recordProviderFailure(providerId: AiScoreProviderId, failure: { errorCode: string; failureClass: ProviderFailureClass; at?: Date }): Promise<RuntimeCircuitSnapshot> {
    return this.rpc('ai_score_record_provider_failure', { p_provider_id: providerId, p_error_code: failure.errorCode, p_failure_class: failure.failureClass, p_at: (failure.at ?? new Date()).toISOString() });
  }

  async openCircuit(providerId: AiScoreProviderId, reason: { errorCode: string; failureClass: ProviderFailureClass; at?: Date }): Promise<RuntimeCircuitSnapshot> {
    return this.rpc('ai_score_open_provider_circuit', { p_provider_id: providerId, p_error_code: reason.errorCode, p_failure_class: reason.failureClass, p_at: (reason.at ?? new Date()).toISOString() });
  }

  async tryHalfOpen(providerId: AiScoreProviderId, at = new Date()): Promise<RuntimeCircuitSnapshot> {
    return this.rpc('ai_score_try_provider_half_open', { p_provider_id: providerId, p_at: at.toISOString() });
  }

  private supabaseHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      apikey: this.serviceRoleKey,
      'content-type': 'application/json',
    };

    if (!this.serviceRoleKey.startsWith('sb_')) {
      headers.authorization = `Bearer ${this.serviceRoleKey}`;
    }

    return headers;
  }

  private async rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: this.supabaseHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`AI Score runtime store RPC failed: ${fn}`);
    return response.json() as Promise<T>;
  }
}

export function createProviderRuntimeStore(): ProviderRuntimeStore {
  if (!isTruthyEnv(process.env.AI_SCORE_RUNTIME_STORE_ENABLED)) return new MemoryProviderRuntimeStore({ persistent: false });
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return new MemoryProviderRuntimeStore({ persistent: false });
  return new SupabaseProviderRuntimeStore({ url, serviceRoleKey });
}

export function classifyProviderFailure(input: { status?: number; errorCode?: string }): ProviderFailureClass {
  if (input.status === 401 || input.status === 403) return 'AUTH';
  if (input.status === 429) return 'RATE_LIMIT';
  if (input.status && input.status >= 500) return 'PROVIDER';
  if (/timeout/i.test(input.errorCode ?? '')) return 'TIMEOUT';
  if (/malformed|parse|schema/i.test(input.errorCode ?? '')) return 'MALFORMED_RESPONSE';
  return 'INTERNAL';
}

export function runtimeStoreDiagnostics(store: ProviderRuntimeStore) {
  return { kind: store.kind, persistent: store.persistent, enabled: isTruthyEnv(process.env.AI_SCORE_RUNTIME_STORE_ENABLED) };
}

export function readBudgetConfig(providerId: AiScoreProviderId): { providerDailyBudgetUsd: number | null; globalDailyBudgetUsd: number | null; state: 'available' | 'missing' | 'invalid' } {
  const providerEnv = providerBudgetEnv(providerId);
  const providerDailyBudgetUsd = parseMoney(process.env[providerEnv]);
  const globalDailyBudgetUsd = parseMoney(process.env.AI_SCORE_DAILY_BUDGET_USD);
  const invalid = invalidMoney(process.env[providerEnv]) || invalidMoney(process.env.AI_SCORE_DAILY_BUDGET_USD);
  return {
    providerDailyBudgetUsd,
    globalDailyBudgetUsd,
    state: invalid ? 'invalid' : providerDailyBudgetUsd === null || globalDailyBudgetUsd === null ? 'missing' : 'available',
  };
}

export function readRateLimitConfig() {
  return {
    client: {
      limit: parseInteger(process.env.AI_SCORE_RATE_LIMIT_MAX) ?? 6,
      windowSeconds: parseInteger(process.env.AI_SCORE_RATE_LIMIT_WINDOW_SECONDS) ?? 600,
    },
    domain: {
      limit: parseInteger(process.env.AI_SCORE_DOMAIN_LIMIT_MAX) ?? 3,
      windowSeconds: parseInteger(process.env.AI_SCORE_DOMAIN_LIMIT_WINDOW_SECONDS) ?? 1800,
    },
    hmacConfigured: Boolean(process.env.AI_SCORE_RATE_LIMIT_HMAC_SECRET),
  };
}

function addUsage(current: ProviderUsageSnapshot, input: BudgetReservationInput): ProviderUsageSnapshot {
  return {
    ...current,
    spentUsd: roundMoney(current.spentUsd + input.estimatedCostUsd),
    requestCount: current.requestCount + input.estimatedRequests,
  };
}

function denied(input: BudgetReservationInput, date: string, reason: BudgetReservation['reason']): BudgetReservation {
  return { allowed: false, reason, reservedCostUsd: 0, dailyUsage: emptyUsage(input.providerId, date), globalUsage: emptyUsage(GLOBAL_PROVIDER_USAGE_ID, date), dailyBudgetUsd: input.providerDailyBudgetUsd, globalBudgetUsd: input.globalDailyBudgetUsd };
}

function rateLimitBucketKey(input: RuntimeRateLimitInput): { bucketKey: string; reason?: never } | { reason: RuntimeRateLimitResult } {
  const secret = process.env.AI_SCORE_RATE_LIMIT_HMAC_SECRET;
  if (!secret) {
    return { reason: { allowed: false, bucketKey: 'missing', windowStart: '', expiresAt: '', requestCount: 0, limit: input.limit, retryAfterSeconds: input.windowSeconds, reason: 'missing_hmac_secret' } };
  }
  const digest = createHmac('sha256', secret).update(input.rawIdentifier.trim().toLowerCase()).digest('hex');
  return { bucketKey: `ai-score:${input.scope}:${input.windowSeconds}:${digest}` };
}

function usageKey(providerId: AiScoreProviderId, date: string): string {
  return `${date}:${providerId}`;
}

function emptyUsage(providerId: AiScoreProviderId, date: string): ProviderUsageSnapshot {
  return { providerId, date, spentUsd: 0, requestCount: 0, consecutiveFailures: 0 };
}

function providerBudgetEnv(providerId: AiScoreProviderId): string {
  if (providerId === 'openai_web_search') return 'AI_SCORE_OPENAI_DAILY_BUDGET_USD';
  if (providerId === 'google_search_grounding') return 'AI_SCORE_GOOGLE_DAILY_BUDGET_USD';
  return 'AI_SCORE_PERPLEXITY_DAILY_BUDGET_USD';
}

function budgetDate(at = new Date()): string {
  return at.toISOString().slice(0, 10);
}

function windowStartIso(date: Date, windowSeconds: number): string {
  return new Date(Math.floor(date.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000).toISOString();
}

function isPositiveMoney(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function parseMoney(value: string | undefined): number | null {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function invalidMoney(value: string | undefined): boolean {
  return Boolean(value) && parseMoney(value) === null;
}

function parseInteger(value: string | undefined): number | null {
  if (!value) return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function roundMoney(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function circuitFailureThreshold(): number {
  return parseInteger(process.env.AI_SCORE_PROVIDER_CIRCUIT_FAILURE_THRESHOLD) ?? 3;
}

function isTruthyEnv(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}
