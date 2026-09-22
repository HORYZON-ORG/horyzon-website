import { getProviderRuntimeState, isTruthyEnv } from './provider-runtime.ts';
import {
  createProviderRuntimeStore,
  readBudgetConfig,
  readRateLimitConfig,
  runtimeStoreDiagnostics,
  type AiScoreProviderId,
  type ProviderRuntimeStore,
} from './runtime-store.ts';
import {
  buildBrandMatcher,
  freezeVisibilityPromptSet,
  generateVisibilityPrompts,
  matchesBrand,
  visibilityScanProfiles,
  type VisibilityScanProfile,
} from './visibility.ts';
import type { EntityProfile, VisibilityPrompt } from './types.ts';

const providerId = 'openai_web_search' as const satisfies AiScoreProviderId;
const expectedPromptSetHash = '2c2e91941c2515d24b05f6c8102d6b1127ded32fd8e0d9b4b3561ddd8ce7a18b';

export interface OpenAIProviderPreflightResult {
  provider: 'openai_web_search';
  configured: boolean;
  enabled: boolean;
  mode: 'DISABLED' | 'TEST_ONLY' | 'PUBLIC';
  publicEnabled: boolean;
  masterPublicSwitch: boolean;
  testMode: boolean;
  runtimeStore: {
    kind: string;
    persistent: boolean;
    enabled: boolean;
  };
  budget: {
    globalConfigured: boolean;
    providerConfigured: boolean;
    available: boolean;
    state: string;
  };
  rateLimit: {
    configured: boolean;
    available: boolean;
    clientLimit: number;
    domainLimit: number;
  };
  circuit: {
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  };
  entityProfile: {
    brand: string | null;
    domain: string;
    category: string | null;
    serviceContext: string[];
    problemContext: string[];
    discoveryContext: string[];
  };
  prompts: {
    count: number;
    valid: boolean;
    hash: string;
    expectedHash: string;
    items: Array<{ category: string; branded: boolean; query: string; valid: boolean }>;
    nonBrandedContainingHoryzon: number;
  };
  eligibility: {
    eligible: boolean;
    reason: string | null;
  };
  realNetworkCalls: 0;
  providerCalls: {
    openai: 0;
    google: 0;
    perplexity: 0;
  };
}

export async function runOpenAIProviderPreflight(options: {
  domain?: string;
  store?: ProviderRuntimeStore;
  entityProfile?: EntityProfile;
  profile?: VisibilityScanProfile;
} = {}): Promise<OpenAIProviderPreflightResult> {
  const domain = normalizeDomain(options.domain ?? 'horyzon.it');
  const profile = options.profile ?? visibilityScanProfiles.FREE_QUICK_SCAN;
  const entityProfile = options.entityProfile ?? buildPhase7BEntityProfile(domain);
  const prompts = generateVisibilityPrompts({ auditId: 'phase7b0-preflight', entity: entityProfile, profile });
  const frozen = freezeVisibilityPromptSet({ prompts, entity: entityProfile });
  const store = options.store ?? createProviderRuntimeStore();
  const storeState = runtimeStoreDiagnostics(store);
  const budget = readBudgetConfig(providerId);
  const rateLimit = readRateLimitConfig();
  const runtime = getProviderRuntimeState(providerId, {
    estimatedCostUsd: profile.promptCount * 0.01,
    scanProfileBudgetUsd: profile.maxEstimatedCost,
    usageStore: store,
  });
  const circuit = await store.getCircuitState(providerId);
  const circuitState = circuit?.circuitState ?? runtime.circuitState;
  const nonBrandedContainingHoryzon = countNonBrandedHoryzonPrompts(frozen.prompts, entityProfile);
  const budgetAvailable = budget.state === 'available' && runtime.budgetState === 'AVAILABLE';
  const rateLimitAvailable = rateLimit.hmacConfigured && rateLimit.client.limit > 0 && rateLimit.domain.limit > 0;
  const reasons = [
    runtime.configured ? null : 'provider_not_configured',
    runtime.enabled ? null : 'provider_disabled',
    runtime.mode === 'TEST_ONLY' ? null : runtime.mode === 'PUBLIC' ? 'public_mode_not_allowed' : 'test_only_mode_required',
    runtime.publicEnabled ? 'public_enabled_not_allowed' : null,
    isTruthyEnv(process.env.AI_SCORE_LIVE_PROVIDERS) ? 'master_public_switch_enabled' : null,
    isTruthyEnv(process.env.AI_SCORE_PROVIDER_TEST_MODE) ? null : 'provider_test_mode_required',
    store.persistent ? null : 'persistent_store_required',
    budgetAvailable ? null : budget.state === 'available' ? 'budget_unavailable' : `budget_${budget.state}`,
    rateLimitAvailable ? null : 'rate_limit_unavailable',
    circuitState === 'CLOSED' ? null : 'circuit_not_closed',
    frozen.valid && frozen.prompts.length === 5 ? null : 'invalid_frozen_prompts',
    frozen.promptSetHash === expectedPromptSetHash ? null : 'prompt_hash_mismatch',
    nonBrandedContainingHoryzon === 0 ? null : 'brand_in_non_branded_prompt',
  ].filter((reason): reason is string => Boolean(reason));

  return {
    provider: providerId,
    configured: runtime.configured,
    enabled: runtime.enabled,
    mode: runtime.mode,
    publicEnabled: runtime.publicEnabled,
    masterPublicSwitch: isTruthyEnv(process.env.AI_SCORE_LIVE_PROVIDERS),
    testMode: isTruthyEnv(process.env.AI_SCORE_PROVIDER_TEST_MODE),
    runtimeStore: storeState,
    budget: {
      globalConfigured: budget.globalDailyBudgetUsd !== null,
      providerConfigured: budget.providerDailyBudgetUsd !== null,
      available: budgetAvailable,
      state: budget.state,
    },
    rateLimit: {
      configured: rateLimit.hmacConfigured,
      available: rateLimitAvailable,
      clientLimit: rateLimit.client.limit,
      domainLimit: rateLimit.domain.limit,
    },
    circuit: { state: circuitState },
    entityProfile: {
      brand: entityProfile.organizationName?.value ?? null,
      domain: entityProfile.canonicalDomain,
      category: entityProfile.industry?.value ?? null,
      serviceContext: entityProfile.services.value,
      problemContext: entityProfile.problemsSolved.value,
      discoveryContext: [...entityProfile.services.value, ...entityProfile.locations.value],
    },
    prompts: {
      count: frozen.prompts.length,
      valid: frozen.valid,
      hash: frozen.promptSetHash,
      expectedHash: expectedPromptSetHash,
      items: frozen.prompts.map((prompt) => ({
        category: prompt.category,
        branded: Boolean(prompt.branded),
        query: prompt.query,
        valid: !prompt.validationErrors?.length,
      })),
      nonBrandedContainingHoryzon,
    },
    eligibility: {
      eligible: reasons.length === 0,
      reason: reasons[0] ?? null,
    },
    realNetworkCalls: 0,
    providerCalls: {
      openai: 0,
      google: 0,
      perplexity: 0,
    },
  };
}

export function buildPhase7BEntityProfile(domainValue: string): EntityProfile {
  const domain = normalizeDomain(domainValue);
  const rootLabel = domain.split('.')[0] || domain;
  const brandName = rootLabel.toLowerCase() === 'horyzon' ? 'Horyzon' : titleCase(rootLabel);
  return {
    organizationName: { value: brandName, source: 'readiness_audit' },
    alternateNames: { value: [brandName, domain], source: 'readiness_audit' },
    domain,
    canonicalDomain: domain,
    description: { value: 'AI visibility and readiness services for companies.', source: 'readiness_audit' },
    industry: { value: 'AI consulting', source: 'readiness_audit' },
    services: { value: ['AI Score', 'AI visibility audit'], source: 'readiness_audit' },
    products: { value: [], source: 'readiness_audit' },
    expertise: { value: ['AI Score', 'AI visibility audit'], source: 'readiness_audit' },
    audiences: { value: ['aziende B2B'], source: 'readiness_audit' },
    problemsSolved: { value: ['migliorare la visibilita nei motori di risposta AI'], source: 'readiness_audit' },
    locations: { value: ['Italia'], source: 'readiness_audit' },
    people: { value: [], source: 'readiness_audit' },
    competitors: { value: [], source: 'readiness_audit' },
  };
}

function countNonBrandedHoryzonPrompts(prompts: VisibilityPrompt[], entity: EntityProfile): number {
  const aliases = buildBrandMatcher(entity);
  return prompts.filter((prompt) => {
    if (prompt.branded) return false;
    return matchesBrand(prompt.query, aliases) || /\bhoryzon\b|horyzon consulting|horyzon\.it/i.test(prompt.query);
  }).length;
}

function normalizeDomain(value: string): string {
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return value.replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./i, '').toLowerCase();
  }
}

function titleCase(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1).toLowerCase();
}
