import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MemoryProviderRuntimeStore,
} from '../src/lib/ai-score/runtime-store.ts';
import {
  MockOpenAIResponsesTransport,
  OpenAIWebSearchAdapter,
  classifyOpenAIWebSearchFailure,
  mapOpenAIWebSearchFailureToRuntime,
  parseOpenAIWebSearchResponse,
  redactOpenAIResponse,
} from '../src/lib/ai-score/openai-web-search.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const openaiAdapter = readFileSync(join(root, 'src/lib/ai-score/openai-web-search.ts'), 'utf8');
const visibility = readFileSync(join(root, 'src/lib/ai-score/visibility.ts'), 'utf8');
const runtime = readFileSync(join(root, 'src/lib/ai-score/runtime-store.ts'), 'utf8');
const route = readFileSync(join(root, 'src/app/api/ai-score/route.ts'), 'utf8');
const script = readFileSync(join(root, 'scripts/ai-score-test-provider.mjs'), 'utf8');
const packageJson = readFileSync(join(root, 'package.json'), 'utf8');
const docs = readFileSync(join(root, 'docs/ai-score-provider-activation.md'), 'utf8');
const fixturesDir = join(root, 'test/fixtures/openai-web-search');

assert.match(openaiAdapter, /class OpenAIWebSearchAdapter/, 'Real OpenAI web search adapter must exist');
assert.match(openaiAdapter, /class RealOpenAIResponsesTransport/, 'Real transport must be separate');
assert.match(openaiAdapter, /class MockOpenAIResponsesTransport/, 'Mock transport must be available');
assert.match(openaiAdapter, /https:\/\/api\.openai\.com\/v1\/responses/, 'Adapter must target Responses API');
assert.match(openaiAdapter, /type: 'web_search'/, 'Adapter must use web_search tool');
assert.match(openaiAdapter, /process\.env\.OPENAI_API_KEY/, 'OpenAI key must be read server-side');
assert.doesNotMatch(openaiAdapter, /NEXT_PUBLIC_OPENAI_API_KEY/, 'OpenAI key must not be public');
assert.match(openaiAdapter, /AbortController/, 'Adapter must implement timeout');
assert.match(openaiAdapter, /url_citation/, 'Citations must be parsed from native annotations');
assert.match(openaiAdapter, /redactOpenAIResponse/, 'Adapter must produce redacted debug');
assert.doesNotMatch(openaiAdapter, /sk-[A-Za-z0-9_-]{20,}/, 'Adapter must not contain hardcoded keys');

assert.match(visibility, /freezeVisibilityPromptSet/, 'Prompt freeze must exist');
assert.match(visibility, /promptSetHash/, 'Prompt hash must exist');
assert.match(visibility, /VISIBILITY_PROMPT_CATEGORIES: VisibilityPromptCategory\[\] = \['BRANDED', 'CATEGORY', 'SERVICE', 'PROBLEM', 'DISCOVERY'\]/, 'Phase 7A categories must be exact');
assert.match(runtime, /reserveBudget/, 'Budget reservation must exist');
assert.match(runtime, /reconcileBudget/, 'Budget reconciliation must exist');
assert.match(runtime, /checkRateLimit/, 'Rate limit integration must exist');
assert.match(runtime, /recordProviderFailure/, 'Provider failure must feed circuit breaker');
assert.match(route, /const url = isRecord\(payload\) && typeof payload\.url === 'string' \? payload\.url : ''/, 'Public route must only accept url');
assert.doesNotMatch(route, /OpenAIWebSearchAdapter|MockOpenAIResponsesTransport|--execute|mock-provider/, 'Public API must not import test-only adapter execution');
assert.match(script, /realNetworkCalls/, 'Provider script must report realNetworkCalls');
assert.match(script, /mockTransportCalls/, 'Provider script must report mock transport calls');
assert.match(script, /provider_not_configured/, 'Provider script must block missing key before transport');
assert.match(packageJson, /verify-ai-score-phase7a\.mjs/, 'Phase 7A verifier must be wired');
assert.match(docs, /OpenAI Web Search - TEST_ONLY/, 'Docs must include OpenAI test-only section');
assert.match(docs, /DO NOT RUN UNTIL PHASE 7B AUTHORIZED/, 'Docs must warn against Phase 7B real execution');

const fixtureNames = readdirSync(fixturesDir).filter((file) => file.endsWith('.json'));
for (const expected of [
  'branded-mention-horyzon-citation.json',
  'non-branded-no-match.json',
  'mention-without-citation.json',
  'own-domain-citation.json',
  'false-domain-citation.json',
  'horizon-homonym.json',
  'http-500.json',
  'auth-401.json',
  'rate-limit-429.json',
  'invalid-response.json',
  'secret-redaction.json',
  'runtime-blocks.json',
]) {
  assert.ok(fixtureNames.includes(expected), `Missing fixture ${expected}`);
  const content = readFileSync(join(fixturesDir, expected), 'utf8');
  assert.match(content, /"testOnly": true/, `${expected} must be marked testOnly`);
  assert.match(content, /TEST ONLY - NOT REAL PROVIDER DATA/, `${expected} must carry test-only notice`);
}

const visibilityScanProfile = { id: 'FREE_QUICK_SCAN', promptCount: 5, timeoutMs: 15_000 };
const entity = buildEntityProfile('horyzon.it');
const prompts = generateVisibilityPrompts({ auditId: 'phase7a', entity, profile: visibilityScanProfile });
const freezeA = freezeVisibilityPromptSet({ prompts, entity });
const freezeB = freezeVisibilityPromptSet({ prompts, entity });
assert.equal(freezeA.valid, true, 'Frozen prompt set must be valid');
assert.equal(freezeA.prompts.length, 5, 'Frozen prompt set must contain five prompts');
assert.equal(freezeA.promptSetHash, freezeB.promptSetHash, 'Prompt hash must be deterministic');
assert.equal(freezeA.prompts.filter((prompt) => !prompt.branded && /horyzon/i.test(prompt.query)).length, 0, 'Non-branded prompts must not contain Horyzon');

const branded = parseOpenAIWebSearchResponse(fixture('branded-mention-horyzon-citation.json').response);
assert.equal(matchesBrand(branded.text, buildBrandMatcher(entity)), true, 'Mention detection should find Horyzon');
assert.equal(branded.sources.some((source) => isDomainCitation(source.url, 'horyzon.it')), true, 'Citation detection should find horyzon.it');
assert.equal(branded.usage.totalTokens, 160, 'Usage must parse total tokens');
assert.ok(branded.sources.some((source) => source.title === 'Horyzon AI Score'), 'Source titles must parse');

const noMatch = parseOpenAIWebSearchResponse(fixture('non-branded-no-match.json').response);
assert.equal(matchesBrand(noMatch.text, buildBrandMatcher(entity)), false, 'Non-branded fixture must not match brand');

const mentionOnly = parseOpenAIWebSearchResponse(fixture('mention-without-citation.json').response);
assert.equal(matchesBrand(mentionOnly.text, buildBrandMatcher(entity)), true, 'Mention-only fixture must mention brand');
assert.equal(mentionOnly.sources.some((source) => isDomainCitation(source.url, 'horyzon.it')), false, 'Mention-only fixture must not cite domain');

const ownDomain = parseOpenAIWebSearchResponse(fixture('own-domain-citation.json').response);
assert.equal(ownDomain.sources.some((source) => isDomainCitation(source.url, 'horyzon.it')), true, 'Subdomain citation must count as own-domain');

const falseDomain = parseOpenAIWebSearchResponse(fixture('false-domain-citation.json').response);
assert.equal(falseDomain.sources.some((source) => isDomainCitation(source.url, 'horyzon.it')), false, 'horyzon.it.example.com must not count as own-domain');

const horizon = parseOpenAIWebSearchResponse(fixture('horizon-homonym.json').response);
assert.equal(matchesBrand(horizon.text.replace('Horyzon.', ''), buildBrandMatcher(entity)), false, 'Horizon must not match Horyzon');

assert.throws(() => parseOpenAIWebSearchResponse(fixture('invalid-response.json').response), /output text/, 'Invalid response must throw');
assert.equal(classifyOpenAIWebSearchFailure({ status: 500 }), 'SERVER_ERROR');
assert.equal(classifyOpenAIWebSearchFailure({ status: 401 }), 'AUTHENTICATION');
assert.equal(classifyOpenAIWebSearchFailure({ status: 403 }), 'AUTHENTICATION');
assert.equal(classifyOpenAIWebSearchFailure({ status: 429 }), 'RATE_LIMIT');
assert.equal(classifyOpenAIWebSearchFailure({ errorCode: 'timeout' }), 'TIMEOUT');
assert.equal(mapOpenAIWebSearchFailureToRuntime('SERVER_ERROR'), 'PROVIDER');

const redacted = JSON.stringify(redactOpenAIResponse(fixture('secret-redaction.json').response, 200));
assert.doesNotMatch(redacted, /TEST_ONLY_SECRET_MARKER/, 'Redacted debug must not include arbitrary raw secret fields');

await testAdapterFailure(500, 'SERVER_ERROR');
await testAdapterFailure(401, 'AUTHENTICATION');
await testAdapterFailure(429, 'RATE_LIMIT');
await testTimeout();
await testBlocksBeforeTransport();

console.log('AI Score Phase 7A verifier passed');

function fixture(name) {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf8'));
}

async function testAdapterFailure(status, failureClass) {
  const fx = status === 500 ? fixture('http-500.json') : status === 401 ? fixture('auth-401.json') : fixture('rate-limit-429.json');
  const transport = new MockOpenAIResponsesTransport({ fixture: fx.response, status });
  const adapter = new OpenAIWebSearchAdapter({ enabled: true, apiKey: 'test-only-mock-key', transport });
  const observation = await adapter.execute(freezeA.prompts[0], context());
  assert.equal(transport.mockTransportCalls, 1);
  assert.equal(transport.realNetworkCalls, 0);
  assert.equal(observation.status, 'FAILED');
  assert.equal(observation.failureClass, failureClass);
}

async function testTimeout() {
  const transport = new MockOpenAIResponsesTransport({ fixture: fixture('branded-mention-horyzon-citation.json').response, delayMs: 20 });
  const adapter = new OpenAIWebSearchAdapter({ enabled: true, apiKey: 'test-only-mock-key', transport, timeoutMs: 1 });
  const observation = await adapter.execute(freezeA.prompts[0], { ...context(), timeoutMs: 1 });
  assert.equal(observation.failureClass, 'TIMEOUT');
  assert.equal(transport.realNetworkCalls, 0);
}

async function testBlocksBeforeTransport() {
  const transport = new MockOpenAIResponsesTransport({ fixture: fixture('branded-mention-horyzon-citation.json').response });
  const missingKey = new OpenAIWebSearchAdapter({ enabled: true, transport });
  const observation = await missingKey.execute(freezeA.prompts[0], context());
  assert.equal(observation.status, 'NOT_CONFIGURED');
  assert.equal(transport.mockTransportCalls, 0, 'Missing key must block before transport');

  const store = new MemoryProviderRuntimeStore({ persistent: false });
  const budget = await store.reserveBudget({ providerId: 'openai_web_search', mode: 'TEST_ONLY', estimatedCostUsd: 0.01, estimatedRequests: 1, providerDailyBudgetUsd: 1, globalDailyBudgetUsd: 1 });
  assert.equal(budget.allowed, false, 'Memory/noop store must block real execution');
  assert.equal(budget.reason, 'store_unavailable');

  const persistentStore = new MemoryProviderRuntimeStore({ persistent: true });
  const exhausted = await persistentStore.reserveBudget({ providerId: 'openai_web_search', mode: 'TEST_ONLY', estimatedCostUsd: 2, estimatedRequests: 1, providerDailyBudgetUsd: 1, globalDailyBudgetUsd: 3 });
  assert.equal(exhausted.allowed, false, 'Budget exhaustion must block before transport');

  const circuit = await persistentStore.openCircuit('openai_web_search', { errorCode: 'test', failureClass: 'PROVIDER' });
  assert.equal(circuit.circuitState, 'OPEN', 'Open circuit must be representable before transport');
}

function context() {
  return {
    auditId: 'phase7a',
    entity,
    profileId: visibilityScanProfile.id,
    timeoutMs: 15_000,
    startedAt: new Date().toISOString(),
  };
}

function buildEntityProfile(domain) {
  return {
    organizationName: { value: 'Horyzon', source: 'readiness_audit' },
    alternateNames: { value: ['Horyzon', domain], source: 'readiness_audit' },
    domain,
    canonicalDomain: domain,
    industry: { value: 'AI consulting', source: 'readiness_audit' },
    services: { value: ['AI Score'], source: 'readiness_audit' },
    products: { value: [], source: 'readiness_audit' },
    expertise: { value: ['AI Score'], source: 'readiness_audit' },
    audiences: { value: ['aziende B2B'], source: 'readiness_audit' },
    problemsSolved: { value: ['migliorare la visibilita nei motori di risposta AI'], source: 'readiness_audit' },
    locations: { value: ['Italia'], source: 'readiness_audit' },
    people: { value: [], source: 'readiness_audit' },
    competitors: { value: [], source: 'readiness_audit' },
  };
}

function generateVisibilityPrompts(input) {
  const brand = input.entity.organizationName?.value;
  const category = input.entity.industry?.value;
  const service = input.entity.services.value[0] ?? input.entity.expertise.value[0];
  const problem = input.entity.problemsSolved.value[0];
  const audience = input.entity.audiences.value[0];
  const location = input.entity.locations.value[0];
  return [
    { category: 'BRANDED', intent: 'branded', branded: true, query: brand },
    { category: 'CATEGORY', intent: 'category', branded: false, query: category ? `aziende specializzate in ${category}${location ? ` in ${location}` : ''}` : '' },
    { category: 'SERVICE', intent: 'service', branded: false, query: service ? `societa di consulenza per ${service}${audience ? ` per ${audience}` : ''}` : '' },
    { category: 'PROBLEM', intent: 'problem', branded: false, query: problem ? `come risolvere ${problem}${audience ? ` per ${audience}` : ''}` : '' },
    { category: 'DISCOVERY', intent: 'recommendation_discovery', branded: false, query: service ? `partner per ${service}${location ? ` in ${location}` : ''}` : '' },
  ].slice(0, input.profile.promptCount).map((item, index) => {
    const prompt = {
      id: `${input.auditId}-visibility-${String(index + 1).padStart(2, '0')}`,
      auditId: input.auditId,
      query: item.query,
      normalizedQuery: normalizeQuery(item.query),
      category: item.category,
      intent: item.intent,
      branded: item.branded,
      generatedBy: 'system',
      approved: false,
      status: item.query ? 'generated' : 'not_generated',
    };
    const validation = validateVisibilityPrompt(prompt, input.entity);
    return validation.valid ? prompt : { ...prompt, status: prompt.query ? 'invalid' : 'not_generated', validationErrors: validation.errors };
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

function validateVisibilityPrompt(prompt, profile) {
  const errors = [];
  if (!prompt.query.trim()) errors.push('empty_query');
  if (prompt.query.length > 140) errors.push('query_too_long');
  if (!['BRANDED', 'CATEGORY', 'SERVICE', 'PROBLEM', 'DISCOVERY'].includes(prompt.category)) errors.push('invalid_category');
  if (!prompt.branded && matchesBrand(prompt.query, buildBrandMatcher(profile))) errors.push('brand_in_non_branded_query');
  return { valid: errors.length === 0, errors };
}

function buildBrandMatcher(profile) {
  return [...new Set([profile.organizationName?.value, ...profile.alternateNames.value, profile.canonicalDomain, profile.canonicalDomain.replace(/\.[a-z]{2,}$/i, '')].map((item) => normalizeBrandToken(item)).filter(Boolean))];
}

function matchesBrand(text, aliases) {
  const normalized = normalizeBrandToken(text);
  if (!normalized) return false;
  return aliases.some((alias) => new RegExp(`(^|\\s)${escapeRegExp(alias)}($|\\s)`, 'i').test(normalized));
}

function isDomainCitation(citedUrl, domain) {
  const citedDomain = normalizeDomain(citedUrl);
  const normalizedDomain = normalizeDomain(domain);
  if (!citedDomain || !normalizedDomain) return false;
  return citedDomain === normalizedDomain || citedDomain.endsWith(`.${normalizedDomain}`);
}

function normalizeDomain(value) {
  if (!value) return null;
  try {
    return new URL(value.includes('://') ? value : `https://${value}`).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return value.replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./i, '').toLowerCase() || null;
  }
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
