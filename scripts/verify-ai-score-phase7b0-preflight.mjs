import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPhase7BEntityProfile,
  runOpenAIProviderPreflight,
} from '../src/lib/ai-score/internal-preflight.ts';
import { MemoryProviderRuntimeStore } from '../src/lib/ai-score/runtime-store.ts';
import { POST, isAuthorizedInternalPreflightRequest } from '../src/app/api/internal/ai-score/provider-preflight/route.ts';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const route = readFileSync(join(root, 'src/app/api/internal/ai-score/provider-preflight/route.ts'), 'utf8');
const preflight = readFileSync(join(root, 'src/lib/ai-score/internal-preflight.ts'), 'utf8');
const publicRoute = readFileSync(join(root, 'src/app/api/ai-score/route.ts'), 'utf8');

assert.match(route, /AI_SCORE_INTERNAL_PREFLIGHT_TOKEN/, 'Internal preflight route must use a dedicated auth token');
assert.match(route, /timingSafeEqual/, 'Internal preflight auth must use constant-time comparison');
assert.doesNotMatch(route, /OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|AI_SCORE_RATE_LIMIT_HMAC_SECRET/, 'Internal preflight route must not use provider/runtime secrets as auth');
assert.match(preflight, /realNetworkCalls: 0/, 'Preflight must report zero real network calls');
assert.doesNotMatch(preflight, /OpenAIWebSearchAdapter|RealOpenAIResponsesTransport|api\.openai\.com|\/v1\/models|\/v1\/responses/, 'Preflight must not instantiate or call OpenAI transport');
assert.doesNotMatch(publicRoute, /internal-preflight|runOpenAIProviderPreflight|provider-preflight/, 'Public AI Score route must not use internal preflight');

const secretValues = {
  OPENAI_API_KEY: 'phase7b0-openai-secret',
  SUPABASE_SERVICE_ROLE_KEY: 'phase7b0-service-role-secret',
  AI_SCORE_RATE_LIMIT_HMAC_SECRET: 'phase7b0-hmac-secret',
  AI_SCORE_INTERNAL_PREFLIGHT_TOKEN: 'phase7b0-internal-token',
};

await withEnv({
  ...secretValues,
  AI_SCORE_OPENAI_VISIBILITY_ENABLED: 'true',
  AI_SCORE_PROVIDER_TEST_MODE: 'true',
  AI_SCORE_LIVE_PROVIDERS: 'false',
  AI_SCORE_RUNTIME_STORE_ENABLED: 'true',
  AI_SCORE_OPENAI_DAILY_BUDGET_USD: '1',
  AI_SCORE_DAILY_BUDGET_USD: '1',
}, async () => {
  const request = new Request('https://horyzon.it/api/internal/ai-score/provider-preflight', {
    method: 'POST',
    headers: { authorization: `Bearer ${secretValues.AI_SCORE_INTERNAL_PREFLIGHT_TOKEN}` },
  });
  assert.equal(isAuthorizedInternalPreflightRequest(request), true, 'Valid internal token must authorize');
  assert.equal(isAuthorizedInternalPreflightRequest(new Request(request.url, { method: 'POST' })), false, 'Missing token must reject');

  const unauthorized = await POST(new Request(request.url, { method: 'POST' }));
  assert.equal(unauthorized.status, 401, 'Anonymous preflight route access must be rejected');

  const authorizedLocal = await POST(request);
  assert.notEqual(authorizedLocal.status, 401, 'Authorized route must pass auth before runtime gating');
  const authorizedBody = await authorizedLocal.json();
  assert.equal(JSON.stringify(authorizedBody).includes(secretValues.OPENAI_API_KEY), false, 'Route must not return OpenAI key');
  assert.equal(JSON.stringify(authorizedBody).includes(secretValues.SUPABASE_SERVICE_ROLE_KEY), false, 'Route must not return service role key');
  assert.equal(JSON.stringify(authorizedBody).includes(secretValues.AI_SCORE_RATE_LIMIT_HMAC_SECRET), false, 'Route must not return HMAC key');
  assert.equal(JSON.stringify(authorizedBody).includes(secretValues.AI_SCORE_INTERNAL_PREFLIGHT_TOKEN), false, 'Route must not return auth token');

  const success = await runOpenAIProviderPreflight({ store: new MemoryProviderRuntimeStore({ persistent: true }) });
  assert.equal(success.configured, true, 'Fake OpenAI secret must configure provider');
  assert.equal(success.mode, 'TEST_ONLY', 'Preflight must require TEST_ONLY mode');
  assert.equal(success.publicEnabled, false, 'Preflight must keep public execution disabled');
  assert.equal(success.masterPublicSwitch, false, 'Preflight must keep master public switch disabled');
  assert.equal(success.runtimeStore.persistent, true, 'Persistent store is required');
  assert.equal(success.budget.available, true, 'Budget must be available');
  assert.equal(success.rateLimit.available, true, 'Rate limit must be available');
  assert.equal(success.circuit.state, 'CLOSED', 'Circuit must be closed');
  assert.equal(success.prompts.count, 5, 'Five prompts must be generated');
  assert.equal(success.prompts.valid, true, 'Prompts must validate');
  assert.equal(success.prompts.hash, '2c2e91941c2515d24b05f6c8102d6b1127ded32fd8e0d9b4b3561ddd8ce7a18b', 'Prompt hash must match Phase 7A baseline');
  assert.equal(success.prompts.nonBrandedContainingHoryzon, 0, 'Non-branded prompts must not contain Horyzon');
  assert.equal(success.eligibility.eligible, true, 'All gates satisfied should be eligible');
  assert.equal(success.realNetworkCalls, 0, 'Preflight must not call provider transport');
  assert.equal(success.providerCalls.openai, 0, 'OpenAI calls must be zero');
  assert.equal(success.providerCalls.google, 0, 'Google calls must be zero');
  assert.equal(success.providerCalls.perplexity, 0, 'Perplexity calls must be zero');

  const persistentBlocked = await runOpenAIProviderPreflight({ store: new MemoryProviderRuntimeStore({ persistent: false }) });
  assert.equal(persistentBlocked.eligibility.eligible, false, 'Non-persistent store must block');
  assert.equal(persistentBlocked.eligibility.reason, 'persistent_store_required');

  await withEnv({ AI_SCORE_OPENAI_DAILY_BUDGET_USD: undefined }, async () => {
    const budgetBlocked = await runOpenAIProviderPreflight({ store: new MemoryProviderRuntimeStore({ persistent: true }) });
    assert.equal(budgetBlocked.eligibility.eligible, false, 'Missing OpenAI budget must block');
    assert.match(budgetBlocked.eligibility.reason ?? '', /budget/, 'Budget blocker must be reported');
  });

  const openCircuitStore = new MemoryProviderRuntimeStore({ persistent: true });
  await openCircuitStore.openCircuit('openai_web_search', { errorCode: 'test', failureClass: 'PROVIDER' });
  const circuitBlocked = await runOpenAIProviderPreflight({ store: openCircuitStore });
  assert.equal(circuitBlocked.eligibility.eligible, false, 'Open circuit must block');
  assert.equal(circuitBlocked.eligibility.reason, 'circuit_not_closed');

  const invalidEntity = buildPhase7BEntityProfile('horyzon.it');
  invalidEntity.services = { value: ['Horyzon'], source: 'readiness_audit' };
  const promptBlocked = await runOpenAIProviderPreflight({
    store: new MemoryProviderRuntimeStore({ persistent: true }),
    entityProfile: invalidEntity,
  });
  assert.equal(promptBlocked.eligibility.eligible, false, 'Invalid prompt set must block');
  assert.ok(['invalid_frozen_prompts', 'prompt_hash_mismatch', 'brand_in_non_branded_prompt'].includes(promptBlocked.eligibility.reason ?? ''), 'Prompt blocker must be reported');

  await withEnv({ AI_SCORE_LIVE_PROVIDERS: 'true', AI_SCORE_PROVIDER_TEST_MODE: 'false' }, async () => {
    const publicBlocked = await runOpenAIProviderPreflight({ store: new MemoryProviderRuntimeStore({ persistent: true }) });
    assert.equal(publicBlocked.mode, 'PUBLIC', 'Fixture must enter PUBLIC mode');
    assert.equal(publicBlocked.eligibility.eligible, false, 'PUBLIC mode must block internal preflight');
    assert.equal(publicBlocked.eligibility.reason, 'public_mode_not_allowed');
  });
});

console.log('AI Score Phase 7B.0.1 secure preflight verifier passed');

async function withEnv(overrides, fn) {
  const previous = new Map();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
