export type AiScoreProviderId =
  | 'openai_web_search'
  | 'google_search_grounding'
  | 'perplexity_sonar'
  | 'perplexity_search';

export type ProviderRuntimeMode = 'DISABLED' | 'TEST_ONLY' | 'PUBLIC';
export type ProviderCircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
export type ProviderBudgetState = 'AVAILABLE' | 'MISSING_BUDGET' | 'EXHAUSTED' | 'NO_PERSISTENT_STORE' | 'UNKNOWN';
export type ProviderHealthStatus = 'AVAILABLE' | 'DEGRADED' | 'UNAVAILABLE' | 'NOT_CONFIGURED' | 'DISABLED';

export interface ProviderRuntimeDefinition {
  id: AiScoreProviderId;
  label: string;
  surface: 'AI_VISIBILITY' | 'EXTERNAL_BRAND_FOOTPRINT';
  apiKeyEnv: 'OPENAI_API_KEY' | 'GOOGLE_AI_API_KEY' | 'PERPLEXITY_API_KEY';
  enabledEnv: string;
  dailyBudgetEnv: string;
  estimatedUnitCostUsd: number;
  defaultEnabled: false;
  publicPriority: number;
}

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

export class NoopProviderUsageStore implements ProviderUsageStore {
  persistent = false;

  getDailyUsage(providerId: AiScoreProviderId, date: string): ProviderUsageSnapshot {
    return { providerId, date, spentUsd: 0, requestCount: 0, consecutiveFailures: 0 };
  }

  recordUsage(_providerId: AiScoreProviderId, _usage: { date: string; spentUsd: number; requestCount: number }): void {}
  recordFailure(_providerId: AiScoreProviderId, _failure: { date: string; code: string }): void {}
  resetFailures(_providerId: AiScoreProviderId): void {}
}

export interface ProviderRuntimeState {
  providerId: AiScoreProviderId;
  label: string;
  surface: ProviderRuntimeDefinition['surface'];
  configured: boolean;
  enabled: boolean;
  publicEnabled: boolean;
  mode: ProviderRuntimeMode;
  circuitState: ProviderCircuitState;
  budgetState: ProviderBudgetState;
  health: ProviderHealthStatus;
  dailyBudgetUsd: number | null;
  spentTodayUsd: number;
  estimatedCostUsd: number;
  publicPriority: number;
  blockers: string[];
}

export interface ProviderRuntimeOptions {
  usageStore?: ProviderUsageStore;
  estimatedCostUsd?: number;
  scanProfileBudgetUsd?: number;
  at?: Date;
}

export const providerRuntimeDefinitions: Record<AiScoreProviderId, ProviderRuntimeDefinition> = {
  openai_web_search: {
    id: 'openai_web_search',
    label: 'OpenAI Web Search',
    surface: 'AI_VISIBILITY',
    apiKeyEnv: 'OPENAI_API_KEY',
    enabledEnv: 'AI_SCORE_OPENAI_VISIBILITY_ENABLED',
    dailyBudgetEnv: 'AI_SCORE_OPENAI_DAILY_BUDGET_USD',
    estimatedUnitCostUsd: 0.01,
    defaultEnabled: false,
    publicPriority: 1,
  },
  google_search_grounding: {
    id: 'google_search_grounding',
    label: 'Google Search Grounding',
    surface: 'AI_VISIBILITY',
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
    enabledEnv: 'AI_SCORE_GOOGLE_VISIBILITY_ENABLED',
    dailyBudgetEnv: 'AI_SCORE_GOOGLE_DAILY_BUDGET_USD',
    estimatedUnitCostUsd: 0.01,
    defaultEnabled: false,
    publicPriority: 2,
  },
  perplexity_sonar: {
    id: 'perplexity_sonar',
    label: 'Perplexity Sonar',
    surface: 'AI_VISIBILITY',
    apiKeyEnv: 'PERPLEXITY_API_KEY',
    enabledEnv: 'AI_SCORE_PERPLEXITY_VISIBILITY_ENABLED',
    dailyBudgetEnv: 'AI_SCORE_PERPLEXITY_DAILY_BUDGET_USD',
    estimatedUnitCostUsd: 0.01,
    defaultEnabled: false,
    publicPriority: 3,
  },
  perplexity_search: {
    id: 'perplexity_search',
    label: 'Perplexity Search API',
    surface: 'EXTERNAL_BRAND_FOOTPRINT',
    apiKeyEnv: 'PERPLEXITY_API_KEY',
    enabledEnv: 'AI_SCORE_PERPLEXITY_FOOTPRINT_ENABLED',
    dailyBudgetEnv: 'AI_SCORE_PERPLEXITY_DAILY_BUDGET_USD',
    estimatedUnitCostUsd: 0.01,
    defaultEnabled: false,
    publicPriority: 1,
  },
};

const noopProviderUsageStore = new NoopProviderUsageStore();
const CIRCUIT_FAILURE_THRESHOLD = parsePositiveInteger(process.env.AI_SCORE_PROVIDER_CIRCUIT_FAILURE_THRESHOLD) ?? 3;

export function getProviderRuntimeStatus(options: ProviderRuntimeOptions = {}): ProviderRuntimeState[] {
  return Object.values(providerRuntimeDefinitions)
    .map((definition) => getProviderRuntimeState(definition.id, options))
    .sort((a, b) => a.surface.localeCompare(b.surface) || a.publicPriority - b.publicPriority);
}

export function getProviderRuntimeState(providerId: AiScoreProviderId, options: ProviderRuntimeOptions = {}): ProviderRuntimeState {
  const definition = providerRuntimeDefinitions[providerId];
  const store = options.usageStore ?? noopProviderUsageStore;
  const date = formatBudgetDate(options.at ?? new Date());
  const usage = store.getDailyUsage(providerId, date);
  const configured = hasSecret(definition.apiKeyEnv);
  const enabled = isTruthyEnv(process.env[definition.enabledEnv]) || definition.defaultEnabled;
  const masterEnabled = isTruthyEnv(process.env.AI_SCORE_LIVE_PROVIDERS);
  const testOnly = isTruthyEnv(process.env.AI_SCORE_PROVIDER_TEST_MODE);
  const dailyBudgetUsd = readDailyBudgetUsd(definition);
  const estimatedCostUsd = options.estimatedCostUsd ?? 0;
  const circuitState = getCircuitState(providerId, usage);
  const budgetState = getBudgetState({ configured, enabled, store, usage, dailyBudgetUsd, estimatedCostUsd });
  const blockers = runtimeBlockers({
    configured,
    enabled,
    masterEnabled,
    testOnly,
    circuitState,
    budgetState,
    scanProfileBudgetUsd: options.scanProfileBudgetUsd,
    estimatedCostUsd,
  });
  const mode = !enabled ? 'DISABLED' : masterEnabled && !testOnly ? 'PUBLIC' : 'TEST_ONLY';
  const publicEnabled = mode === 'PUBLIC' && blockers.length === 0;
  return {
    providerId,
    label: definition.label,
    surface: definition.surface,
    configured,
    enabled,
    publicEnabled,
    mode,
    circuitState,
    budgetState,
    health: providerHealth({ configured, enabled, publicEnabled, circuitState, budgetState }),
    dailyBudgetUsd,
    spentTodayUsd: usage.spentUsd,
    estimatedCostUsd,
    publicPriority: definition.publicPriority,
    blockers,
  };
}

export function validateProviderExecutionPlan(input: {
  providerId: AiScoreProviderId;
  estimatedCostUsd: number;
  scanProfileBudgetUsd: number;
  usageStore?: ProviderUsageStore;
}): { ok: true; state: ProviderRuntimeState } | { ok: false; state: ProviderRuntimeState; reason: string } {
  const state = getProviderRuntimeState(input.providerId, {
    estimatedCostUsd: input.estimatedCostUsd,
    scanProfileBudgetUsd: input.scanProfileBudgetUsd,
    usageStore: input.usageStore,
  });
  if (state.publicEnabled) return { ok: true, state };
  return { ok: false, state, reason: state.blockers[0] ?? 'Provider execution is disabled.' };
}

export function recordProviderExecutionTelemetry(event: {
  event: 'blocked' | 'planned' | 'success' | 'failure';
  providerId: AiScoreProviderId;
  mode: ProviderRuntimeMode;
  publicEnabled: boolean;
  status: string;
  reason?: string;
  latencyMs?: number;
  estimatedCostUsd?: number;
  requestCount?: number;
}): void {
  if (process.env.AI_SCORE_PROVIDER_TELEMETRY !== '1') return;
  console.info('ai-score.provider_runtime', {
    event: event.event,
    providerId: event.providerId,
    mode: event.mode,
    publicEnabled: event.publicEnabled,
    status: event.status,
    reason: event.reason,
    latencyMs: event.latencyMs ?? 0,
    estimatedCostUsd: event.estimatedCostUsd ?? 0,
    requestCount: event.requestCount ?? 0,
  });
}

export function isTruthyEnv(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true';
}

function getBudgetState(input: {
  configured: boolean;
  enabled: boolean;
  store: ProviderUsageStore;
  usage: ProviderUsageSnapshot;
  dailyBudgetUsd: number | null;
  estimatedCostUsd: number;
}): ProviderBudgetState {
  if (!input.enabled || !input.configured) return 'UNKNOWN';
  if (!input.store.persistent) return 'NO_PERSISTENT_STORE';
  if (input.dailyBudgetUsd === null) return 'MISSING_BUDGET';
  if (input.usage.spentUsd + input.estimatedCostUsd > input.dailyBudgetUsd) return 'EXHAUSTED';
  return 'AVAILABLE';
}

function runtimeBlockers(input: {
  configured: boolean;
  enabled: boolean;
  masterEnabled: boolean;
  testOnly: boolean;
  circuitState: ProviderCircuitState;
  budgetState: ProviderBudgetState;
  scanProfileBudgetUsd?: number;
  estimatedCostUsd: number;
}): string[] {
  const blockers: string[] = [];
  if (!input.enabled) blockers.push('provider flag disabled');
  if (!input.configured) blockers.push('provider credential not configured');
  if (!input.masterEnabled) blockers.push('AI_SCORE_LIVE_PROVIDERS is disabled');
  if (input.testOnly) blockers.push('provider runtime is TEST_ONLY');
  if (input.circuitState === 'OPEN') blockers.push('provider circuit is OPEN');
  if (input.budgetState === 'NO_PERSISTENT_STORE') blockers.push('persistent ProviderUsageStore is required for public execution');
  if (input.budgetState === 'MISSING_BUDGET') blockers.push('daily provider budget is not configured');
  if (input.budgetState === 'EXHAUSTED') blockers.push('daily provider budget is exhausted');
  if (typeof input.scanProfileBudgetUsd === 'number' && input.estimatedCostUsd > input.scanProfileBudgetUsd) blockers.push('scan profile budget exceeded');
  return blockers;
}

function providerHealth(input: {
  configured: boolean;
  enabled: boolean;
  publicEnabled: boolean;
  circuitState: ProviderCircuitState;
  budgetState: ProviderBudgetState;
}): ProviderHealthStatus {
  if (!input.enabled) return 'DISABLED';
  if (!input.configured) return 'NOT_CONFIGURED';
  if (input.publicEnabled) return 'AVAILABLE';
  if (input.circuitState === 'OPEN' || input.budgetState === 'EXHAUSTED') return 'UNAVAILABLE';
  return 'DEGRADED';
}

function readDailyBudgetUsd(definition: ProviderRuntimeDefinition): number | null {
  return parsePositiveNumber(process.env[definition.dailyBudgetEnv])
    ?? parsePositiveNumber(process.env.AI_SCORE_DAILY_BUDGET_USD);
}

function getCircuitState(providerId: AiScoreProviderId, usage: ProviderUsageSnapshot): ProviderCircuitState {
  const envPrefix = providerId.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  if (isTruthyEnv(process.env[`AI_SCORE_${envPrefix}_CIRCUIT_OPEN`])) return 'OPEN';
  return usage.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD ? 'OPEN' : 'CLOSED';
}

function hasSecret(envName: string): boolean {
  return Boolean(process.env[envName]?.trim());
}

function parsePositiveNumber(value: string | undefined): number | null {
  if (!value) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parsePositiveInteger(value: string | undefined): number | null {
  const number = parsePositiveNumber(value);
  return number ? Math.floor(number) : null;
}

function formatBudgetDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
