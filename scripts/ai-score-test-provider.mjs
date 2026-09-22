#!/usr/bin/env node

import {
  getProviderRuntimeState,
  providerRuntimeDefinitions,
  validateProviderExecutionPlan,
} from '../src/lib/ai-score/provider-runtime.ts';
import {
  createProviderRuntimeStore,
  readBudgetConfig,
  readRateLimitConfig,
  runtimeStoreDiagnostics,
} from '../src/lib/ai-score/runtime-store.ts';

const args = parseArgs(process.argv.slice(2));
const provider = args.provider;
const domain = normalizeDomain(args.domain);
const execute = args.execute === true;
const dryRun = !execute || args['dry-run'] === true;

if (!provider || !(provider in providerRuntimeDefinitions)) {
  fail(`Provider non valido. Usa uno tra: ${Object.keys(providerRuntimeDefinitions).join(', ')}`);
}

if (!domain) {
  fail('Dominio mancante. Esempio: npm run ai-score:test-provider -- --provider=openai_web_search --domain=horyzon.it --dry-run');
}

const definition = providerRuntimeDefinitions[provider];
const plannedRequests = 5;
const estimatedCostUsd = plannedRequests * definition.estimatedUnitCostUsd;
const store = createProviderRuntimeStore();
const storeState = runtimeStoreDiagnostics(store);
const budget = readBudgetConfig(provider);
const rateLimit = readRateLimitConfig();
const runtime = getProviderRuntimeState(provider, { estimatedCostUsd, scanProfileBudgetUsd: 0.05, usageStore: store });
const plan = validateProviderExecutionPlan({ providerId: provider, estimatedCostUsd, scanProfileBudgetUsd: 0.05, usageStore: store });
const prompts = buildDryRunPrompts(domain, definition.surface);
const executionBlocked = dryRun || !plan.ok;
const providerEligibility = !executionBlocked && runtime.publicEnabled;

const report = {
  provider,
  surface: definition.surface,
  domain,
  mode: runtime.mode,
  configured: runtime.configured,
  enabled: runtime.enabled,
  publicEnabled: runtime.publicEnabled,
  circuitState: runtime.circuitState,
  budgetState: runtime.budgetState,
  health: runtime.health,
  runtimeStore: storeState,
  budgetConfiguration: {
    state: budget.state,
    providerDailyBudgetConfigured: budget.providerDailyBudgetUsd !== null,
    globalDailyBudgetConfigured: budget.globalDailyBudgetUsd !== null,
  },
  rateLimitState: {
    hmacConfigured: rateLimit.hmacConfigured,
    clientWindowSeconds: rateLimit.client.windowSeconds,
    clientLimit: rateLimit.client.limit,
    domainWindowSeconds: rateLimit.domain.windowSeconds,
    domainLimit: rateLimit.domain.limit,
  },
  providerEligibility: {
    eligible: providerEligibility,
    reason: runtime.blockers[0] ?? (dryRun ? 'dry-run requested' : 'eligible for future live adapter'),
  },
  plannedPromptOrQueryCount: prompts.length,
  plannedRequests,
  estimatedCostUsd,
  networkCalls: 0,
  dryRun,
  executeRequested: execute,
  executionStatus: executionBlocked ? 'blocked' : 'ready_for_future_live_adapter',
  blockedReason: runtime.blockers[0] ?? (dryRun ? 'dry-run requested' : 'Phase 6A does not include live provider adapters'),
  prompts,
};

console.log(JSON.stringify(report, null, 2));

if (execute && !plan.ok) process.exitCode = 2;

function parseArgs(values) {
  return values.reduce((parsed, value) => {
    if (!value.startsWith('--')) return parsed;
    const [key, raw] = value.slice(2).split('=');
    parsed[key] = raw === undefined ? true : raw;
    return parsed;
  }, {});
}

function normalizeDomain(value) {
  if (!value || typeof value !== 'string') return '';
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return value.replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./i, '').toLowerCase();
  }
}

function buildDryRunPrompts(domainValue, surface) {
  const brand = domainValue.split('.')[0] || domainValue;
  const label = surface === 'AI_VISIBILITY' ? 'visibility prompt' : 'external footprint query';
  return [
    { slot: 1, type: label, query: `Informazioni su ${brand}` },
    { slot: 2, type: label, query: `Aziende e servizi collegati a ${brand}` },
    { slot: 3, type: label, query: `Alternative e competitor per ${brand}` },
    { slot: 4, type: label, query: `Fonti indipendenti che citano ${brand}` },
    { slot: 5, type: label, query: `Profilo ufficiale e presenza web di ${brand}` },
  ];
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
