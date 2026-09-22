#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getProviderRuntimeState,
  providerRuntimeDefinitions,
} from '../src/lib/ai-score/provider-runtime.ts';
import {
  MemoryProviderRuntimeStore,
  createProviderRuntimeStore,
  readBudgetConfig,
  readRateLimitConfig,
  runtimeStoreDiagnostics,
} from '../src/lib/ai-score/runtime-store.ts';
import {
  MockOpenAIResponsesTransport,
  OpenAIWebSearchAdapter,
  mapOpenAIWebSearchFailureToRuntime,
} from '../src/lib/ai-score/openai-web-search.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const provider = args.provider;
const domain = normalizeDomain(args.domain);
const execute = args.execute === true;
const mockProvider = args['mock-provider'] === true;
const dryRun = args['dry-run'] === true || !execute;

if (!provider || !(provider in providerRuntimeDefinitions)) {
  fail(`Provider non valido. Usa uno tra: ${Object.keys(providerRuntimeDefinitions).join(', ')}`);
}

if (!domain) {
  fail('Dominio mancante. Esempio: npm run ai-score:test-provider -- --provider=openai_web_search --domain=horyzon.it --dry-run');
}

const definition = providerRuntimeDefinitions[provider];
const profile = { id: 'FREE_QUICK_SCAN', promptCount: 5, maxEstimatedCost: 0.05, timeoutMs: 15_000 };
const entityProfile = buildScriptEntityProfile(domain);
const generatedPrompts = generateVisibilityPrompts({ auditId: 'test-only-phase7a', entity: entityProfile, profile });
const promptFreeze = freezeVisibilityPromptSet({ prompts: generatedPrompts, entity: entityProfile });
const prompts = promptFreeze.prompts;
const plannedRequests = 5;
const estimatedCostUsd = plannedRequests * definition.estimatedUnitCostUsd;
const store = mockProvider ? new MemoryProviderRuntimeStore({ persistent: true }) : createProviderRuntimeStore();
const budget = readBudgetConfig(provider);
const effectiveBudget = mockProvider
  ? { providerDailyBudgetUsd: budget.providerDailyBudgetUsd ?? 1, globalDailyBudgetUsd: budget.globalDailyBudgetUsd ?? 1, state: 'available' }
  : budget;
const restoreHmac = ensureMockHmac(mockProvider);
const rateLimit = readRateLimitConfig();
const runtime = getProviderRuntimeState(provider, { estimatedCostUsd, scanProfileBudgetUsd: profile.maxEstimatedCost, usageStore: store });
const storeState = runtimeStoreDiagnostics(store);
const circuit = await store.getCircuitState(provider);
const circuitState = circuit?.circuitState ?? runtime.circuitState;
const preflight = await buildPreflight();
let executionStatus = preflight.ok && execute ? 'ready' : 'blocked';
let blockedReason = preflight.ok ? (dryRun ? 'dry_run' : null) : preflight.reason;
let observation = null;
let mockTransportCalls = 0;
let realNetworkCalls = 0;
let budgetReservation = null;
let budgetReconciliation = null;
let observationExtraction = 'NOT_RUN';
let citationExtraction = 'NOT_RUN';
let mentionExtraction = 'NOT_RUN';
let usageParsing = 'NOT_RUN';

if (execute && preflight.ok && provider === 'openai_web_search') {
  const fixture = readFixture('test/fixtures/openai-web-search/branded-mention-horyzon-citation.json');
  const transport = new MockOpenAIResponsesTransport({ fixture: fixture.response });
  const adapter = new OpenAIWebSearchAdapter({
    enabled: true,
    apiKey: mockProvider ? 'test-only-mock-key' : process.env.OPENAI_API_KEY,
    transport,
    timeoutMs: profile.timeoutMs,
  });
  const started = Date.now();
  budgetReservation = await store.reserveBudget({
    providerId: provider,
    mode: 'TEST_ONLY',
    estimatedCostUsd,
    estimatedRequests: plannedRequests,
    estimatedObservations: plannedRequests,
    providerDailyBudgetUsd: effectiveBudget.providerDailyBudgetUsd,
    globalDailyBudgetUsd: effectiveBudget.globalDailyBudgetUsd,
  });

  if (!budgetReservation.allowed) {
    executionStatus = 'blocked';
    blockedReason = budgetReservation.reason ?? 'budget_blocked';
  } else {
    observation = await adapter.execute(prompts[0], {
      auditId: 'test-only-phase7a',
      entity: entityProfile,
      profileId: profile.id,
      timeoutMs: profile.timeoutMs,
      startedAt: new Date().toISOString(),
    });
    const success = observation.status === 'SUCCESS' || observation.status === 'PARTIAL';
    budgetReconciliation = await store.reconcileBudget({
      providerId: provider,
      mode: 'TEST_ONLY',
      estimatedCostUsd,
      actualCostUsd: estimateActualCost(observation.providerUsage),
      success,
      latencyMs: Date.now() - started,
    });
    if (success) {
      await store.recordProviderSuccess(provider);
      executionStatus = 'completed';
      blockedReason = null;
    } else {
      await store.recordProviderFailure(provider, {
        errorCode: observation.errorCode ?? 'unknown',
        failureClass: mapOpenAIWebSearchFailureToRuntime(observation.failureClass ?? 'UNKNOWN'),
      });
      executionStatus = 'failed';
      blockedReason = observation.errorCode ?? 'provider_failure';
    }
    observationExtraction = observation.evidence ? 'PASS' : 'FAIL';
    citationExtraction = observation.sources?.some((source) => isDomainCitation(source.url, domain)) ? 'PASS' : 'FAIL';
    mentionExtraction = observation.brandMentioned ? 'PASS' : 'FAIL';
    usageParsing = observation.providerUsage?.totalTokens ? 'PASS' : 'FAIL';
  }
  mockTransportCalls = transport.mockTransportCalls;
  realNetworkCalls = transport.realNetworkCalls;
}

restoreHmac();

const report = {
  provider,
  surface: definition.surface,
  domain,
  mode: mockProvider ? 'TEST_ONLY' : runtime.mode,
  configured: mockProvider || runtime.configured,
  enabled: mockProvider || runtime.enabled,
  publicEnabled: false,
  runtimeStore: storeState,
  budgetConfiguration: {
    state: effectiveBudget.state,
    providerDailyBudgetConfigured: effectiveBudget.providerDailyBudgetUsd !== null,
    globalDailyBudgetConfigured: effectiveBudget.globalDailyBudgetUsd !== null,
  },
  rateLimitState: {
    hmacConfigured: mockProvider || rateLimit.hmacConfigured,
    clientWindowSeconds: rateLimit.client.windowSeconds,
    clientLimit: rateLimit.client.limit,
    domainWindowSeconds: rateLimit.domain.windowSeconds,
    domainLimit: rateLimit.domain.limit,
  },
  circuitState,
  providerEligibility: {
    eligible: preflight.ok,
    reason: preflight.ok ? 'eligible_for_test_only_execution' : preflight.reason,
  },
  promptCount: prompts.length,
  plannedPromptOrQueryCount: prompts.length,
  promptSetHash: promptFreeze.promptSetHash,
  promptValidation: {
    valid: promptFreeze.valid,
    errors: promptFreeze.validationErrors,
  },
  plannedRequests,
  estimatedCostUsd,
  dryRun,
  executeRequested: execute,
  executionStatus,
  blockedReason,
  networkCalls: 0,
  realNetworkCalls,
  ...(mockProvider ? { mockTransportCalls } : {}),
  budgetReservation,
  budgetReconciliation,
  extractionChecks: {
    observation: observationExtraction,
    citation: citationExtraction,
    mention: mentionExtraction,
    usage: usageParsing,
  },
  prompts: prompts.map((prompt) => ({
    category: prompt.category,
    branded: Boolean(prompt.branded),
    query: prompt.query,
    valid: !prompt.validationErrors?.length,
  })),
  observation: observation ? {
    status: observation.status,
    brandMentioned: observation.brandMentioned,
    domainCited: observation.domainCited,
    citedUrls: observation.citedUrls,
    sourceTitles: observation.sources?.map((source) => source.title).filter(Boolean),
    providerResponseId: observation.providerResponseId,
    providerResponseStatus: observation.providerResponseStatus,
    providerUsage: observation.providerUsage,
    redactedDebug: observation.redactedDebug,
  } : null,
};

console.log(JSON.stringify(report, null, 2));

async function buildPreflight() {
  if (provider !== 'openai_web_search') return { ok: false, reason: 'provider_not_supported_in_phase7a' };
  if (!promptFreeze.valid) return { ok: false, reason: 'invalid_frozen_prompts' };
  const nonBrandedBrandPrompts = prompts.filter((prompt) => !prompt.branded && matchesBrand(prompt.query, buildBrandMatcher(entityProfile)));
  if (nonBrandedBrandPrompts.length > 0) return { ok: false, reason: 'brand_in_non_branded_prompt' };
  if (dryRun) {
    if (!runtime.configured && !mockProvider) return { ok: false, reason: 'provider_not_configured' };
    return { ok: false, reason: 'dry_run' };
  }
  if (!mockProvider && !runtime.configured) return { ok: false, reason: 'provider_not_configured' };
  if (!mockProvider && !runtime.enabled) return { ok: false, reason: 'provider_disabled' };
  if (!store.persistent) return { ok: false, reason: 'persistent_store_required' };
  if (effectiveBudget.state !== 'available') return { ok: false, reason: effectiveBudget.state === 'invalid' ? 'budget_invalid' : 'budget_required' };
  if (!(mockProvider || rateLimit.hmacConfigured)) return { ok: false, reason: 'rate_limit_hmac_required' };
  if (circuitState !== 'CLOSED') return { ok: false, reason: 'circuit_not_closed' };
  const clientRateLimit = await store.checkRateLimit({ scope: 'client', rawIdentifier: 'test-only-client', limit: rateLimit.client.limit, windowSeconds: rateLimit.client.windowSeconds });
  if (!clientRateLimit.allowed) return { ok: false, reason: clientRateLimit.reason ?? 'client_rate_limited' };
  const domainRateLimit = await store.checkRateLimit({ scope: 'domain', rawIdentifier: domain, limit: rateLimit.domain.limit, windowSeconds: rateLimit.domain.windowSeconds });
  if (!domainRateLimit.allowed) return { ok: false, reason: domainRateLimit.reason ?? 'domain_rate_limited' };
  return { ok: true, reason: null };
}

function buildScriptEntityProfile(domainValue) {
  const rootLabel = domainValue.split('.')[0] || domainValue;
  const brandName = rootLabel.toLowerCase() === 'horyzon' ? 'Horyzon' : titleCase(rootLabel);
  return {
    organizationName: { value: brandName, source: 'readiness_audit' },
    alternateNames: { value: [brandName, domainValue], source: 'readiness_audit' },
    domain: domainValue,
    canonicalDomain: domainValue,
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

function generateVisibilityPrompts(input) {
  const now = new Date('2026-09-22T00:00:00.000Z').toISOString();
  const brand = input.entity.organizationName?.value;
  const category = input.entity.industry?.value;
  const service = input.entity.services.value[0] ?? input.entity.expertise.value[0];
  const problem = input.entity.problemsSolved.value[0];
  const audience = input.entity.audiences.value[0];
  const location = input.entity.locations.value[0];
  const planned = [
    { category: 'BRANDED', intent: 'branded', branded: true, query: brand },
    { category: 'CATEGORY', intent: 'category', branded: false, query: category ? `aziende specializzate in ${category}${location ? ` in ${location}` : ''}` : undefined },
    { category: 'SERVICE', intent: 'service', branded: false, query: service ? `societa di consulenza per ${service}${audience ? ` per ${audience}` : ''}` : undefined },
    { category: 'PROBLEM', intent: 'problem', branded: false, query: problem ? `come risolvere ${problem}${audience ? ` per ${audience}` : ''}` : undefined },
    { category: 'DISCOVERY', intent: 'recommendation_discovery', branded: false, query: service ? `partner per ${service}${location ? ` in ${location}` : ''}` : undefined },
  ];
  return planned.slice(0, input.profile.promptCount).map((item, index) => {
    const query = sanitizePromptQuery(item.query ?? '');
    const prompt = {
      id: `${input.auditId}-visibility-${String(index + 1).padStart(2, '0')}`,
      auditId: input.auditId,
      query,
      normalizedQuery: normalizeQuery(query),
      category: item.category,
      intent: item.intent,
      branded: item.branded,
      locationSpecific: Boolean(location && query.toLowerCase().includes(location.toLowerCase())),
      source: 'entity_profile',
      generationMethod: 'deterministic_v1',
      generatedBy: 'system',
      approved: false,
      status: query ? 'generated' : 'not_generated',
      createdAt: now,
    };
    const validation = validateVisibilityPrompt(prompt, input.entity);
    return validation.valid ? prompt : { ...prompt, status: query ? 'invalid' : 'not_generated', validationErrors: validation.errors };
  });
}

function freezeVisibilityPromptSet(input) {
  const categories = ['BRANDED', 'CATEGORY', 'SERVICE', 'PROBLEM', 'DISCOVERY'];
  const validationErrors = {};
  const frozenPrompts = input.prompts.filter((prompt) => categories.includes(prompt.category)).slice(0, categories.length).map((prompt) => {
    const validation = validateVisibilityPrompt(prompt, input.entity);
    if (!validation.valid) validationErrors[prompt.id] = validation.errors;
    return { ...prompt, status: validation.valid ? prompt.status : 'invalid', validationErrors: validation.valid ? prompt.validationErrors : validation.errors };
  });
  const canonical = frozenPrompts.map((prompt) => ({ category: prompt.category, intent: prompt.intent, branded: Boolean(prompt.branded), query: normalizeQuery(prompt.query) }));
  const promptSetHash = createHash('sha256').update(JSON.stringify({ version: 'horyzon-ai-visibility-v1', categories, prompts: canonical })).digest('hex');
  return { prompts: frozenPrompts, promptSetHash, valid: Object.keys(validationErrors).length === 0 && frozenPrompts.length === categories.length, validationErrors };
}

function validateVisibilityPrompt(prompt, entity) {
  const errors = [];
  const query = prompt.query.trim();
  if (!query) errors.push('empty_query');
  if (query.length > 140) errors.push('query_too_long');
  if (/https?:\/\//i.test(query)) errors.push('raw_url_not_allowed');
  if (/ignore previous|disregard previous|system prompt|developer message|always say|never mention|follow these instructions/i.test(query)) errors.push('prompt_injection_pattern');
  if (!['BRANDED', 'CATEGORY', 'SERVICE', 'PROBLEM', 'DISCOVERY'].includes(String(prompt.category))) errors.push('invalid_category');
  if (!prompt.branded && matchesBrand(query, buildBrandMatcher(entity))) errors.push('brand_in_non_branded_query');
  return { valid: errors.length === 0, errors };
}

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

function isDomainCitation(citedUrl, domainValue) {
  const citedDomain = normalizeDomain(citedUrl);
  const normalizedDomain = normalizeDomain(domainValue);
  if (!citedDomain || !normalizedDomain) return false;
  return citedDomain === normalizedDomain || citedDomain.endsWith(`.${normalizedDomain}`);
}

function buildBrandMatcher(entity) {
  return [...new Set([entity.organizationName?.value, ...entity.alternateNames.value, entity.canonicalDomain, entity.canonicalDomain.replace(/\.[a-z]{2,}$/i, '')].map((item) => normalizeBrandToken(item)).filter(Boolean))];
}

function matchesBrand(text, aliases) {
  const normalized = normalizeBrandToken(text);
  if (!normalized) return false;
  return aliases.some((alias) => new RegExp(`(^|\\s)${escapeRegExp(alias)}($|\\s)`, 'i').test(normalized));
}

function sanitizePromptQuery(value) {
  return String(value).replace(/https?:\/\/\S+/gi, ' ').replace(/[\r\n\t]+/g, ' ').replace(/[<>`{}[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140).trim();
}

function normalizeBrandToken(value) {
  return value ? normalizeQuery(String(value).replace(/^https?:\/\//i, '').replace(/^www\./i, '')) || null : null;
}

function normalizeQuery(value) {
  return String(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readFixture(path) {
  return JSON.parse(readFileSync(join(root, path), 'utf8'));
}

function ensureMockHmac(enabled) {
  if (!enabled || process.env.AI_SCORE_RATE_LIMIT_HMAC_SECRET) return () => {};
  process.env.AI_SCORE_RATE_LIMIT_HMAC_SECRET = 'TEST_ONLY_HMAC_SECRET';
  return () => { delete process.env.AI_SCORE_RATE_LIMIT_HMAC_SECRET; };
}

function estimateActualCost(usage) {
  if (!usage?.totalTokens) return null;
  return Math.max(0.000001, Math.round((usage.totalTokens / 1_000_000) * 0.5 * 1_000_000) / 1_000_000);
}

function titleCase(value) {
  return value.slice(0, 1).toUpperCase() + value.slice(1).toLowerCase();
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
