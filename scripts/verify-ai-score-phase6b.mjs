import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MemoryProviderRuntimeStore,
  classifyProviderFailure,
  readBudgetConfig,
  readRateLimitConfig,
} from '../src/lib/ai-score/runtime-store.ts';
import { validateProviderExecutionPlan } from '../src/lib/ai-score/provider-runtime.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeStore = readFileSync(join(root, 'src/lib/ai-score/runtime-store.ts'), 'utf8');
const runtime = readFileSync(join(root, 'src/lib/ai-score/provider-runtime.ts'), 'utf8');
const migration = readFileSync(join(root, 'supabase/migrations/20260922041000_ai_score_runtime_store.sql'), 'utf8');
const script = readFileSync(join(root, 'scripts/ai-score-test-provider.mjs'), 'utf8');
const docs = readFileSync(join(root, 'docs/ai-score-provider-activation.md'), 'utf8');
const packageJson = readFileSync(join(root, 'package.json'), 'utf8');

assert.match(runtimeStore, /interface ProviderRuntimeStore extends ProviderUsageStore/, 'Persistent runtime store interface must extend ProviderUsageStore');
assert.match(runtimeStore, /reserveBudget/, 'Budget reservation API must exist');
assert.match(runtimeStore, /reconcileBudget/, 'Budget reconciliation API must exist');
assert.match(runtimeStore, /checkRateLimit/, 'Rate limit API must exist');
assert.match(runtimeStore, /recordProviderSuccess/, 'Circuit success API must exist');
assert.match(runtimeStore, /recordProviderFailure/, 'Circuit failure API must exist');
assert.match(runtimeStore, /openCircuit/, 'Open circuit API must exist');
assert.match(runtimeStore, /tryHalfOpen/, 'Half-open circuit API must exist');
assert.match(runtimeStore, /createHmac\('sha256'/, 'Rate limit identifiers must use HMAC');
assert.match(runtimeStore, /SUPABASE_SERVICE_ROLE_KEY/, 'Server-side Supabase service credential must be server-only');
assert.match(runtimeStore, /AI_SCORE_RUNTIME_STORE_ENABLED/, 'Runtime store activation flag must exist');
assert.match(runtimeStore, /AI_SCORE_RATE_LIMIT_HMAC_SECRET/, 'Rate limit HMAC secret must exist');
assert.doesNotMatch(runtimeStore, /NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/, 'Service role must never be public');
assert.match(runtime, /NO_PERSISTENT_STORE/, 'Noop store must remain fail-closed');

assert.match(migration, /create table if not exists public\.provider_daily_usage/, 'Provider usage table migration must exist');
assert.match(migration, /primary key \(budget_date, provider_id, mode\)/, 'Provider usage logical key must include date and provider');
assert.match(migration, /create table if not exists public\.provider_runtime_state/, 'Circuit table migration must exist');
assert.match(migration, /create table if not exists public\.ai_score_rate_limit/, 'Rate limit table migration must exist');
assert.match(migration, /for update/, 'Budget reservation must use row locking');
assert.match(migration, /on conflict \(bucket_key, window_start\)[\s\S]*do update/, 'Rate limit must use atomic upsert');
assert.match(migration, /enable row level security/, 'Runtime tables must enable RLS');
assert.match(migration, /revoke all on table public\.provider_daily_usage from anon, authenticated/, 'Usage table must not be browser-accessible');
assert.match(migration, /security definer/, 'RPC functions must be server-side functions');

assert.match(script, /runtimeStore/, 'Dry-run must print runtime store state');
assert.match(script, /budgetConfiguration/, 'Dry-run must print budget configuration');
assert.match(script, /rateLimitState/, 'Dry-run must print rate limit state');
assert.match(script, /providerEligibility/, 'Dry-run must print provider eligibility');
assert.match(script, /networkCalls: 0/, 'Dry-run must keep zero provider network calls');
assert.match(packageJson, /verify-ai-score-phase6b\.mjs/, 'Phase 6B verifier must run with AI Score tests');

for (const envName of [
  'AI_SCORE_RUNTIME_STORE_ENABLED',
  'AI_SCORE_TEST_DAILY_BUDGET_USD',
  'AI_SCORE_RATE_LIMIT_MAX',
  'AI_SCORE_RATE_LIMIT_WINDOW_SECONDS',
  'AI_SCORE_DOMAIN_LIMIT_MAX',
  'AI_SCORE_DOMAIN_LIMIT_WINDOW_SECONDS',
  'AI_SCORE_RATE_LIMIT_HMAC_SECRET',
]) {
  assert.match(docs, new RegExp(envName), `Docs must mention ${envName}`);
}

await testBudgetReservation();
await testReconciliation();
await testCircuit();
await testRateLimit();
testNoopFailClosed();
testFailureClassification();
testConfigParsing();

const hardcodedSecretPattern = /(sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{20,}|pplx-[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{20,})/;
for (const [name, content] of Object.entries({ runtimeStore, runtime, migration, script, docs, packageJson })) {
  assert.doesNotMatch(content, hardcodedSecretPattern, `${name} must not contain hardcoded secrets`);
}

console.log('AI Score Phase 6B verifier passed');

async function testBudgetReservation() {
  const store = new MemoryProviderRuntimeStore({ persistent: true });
  const first = await store.reserveBudget({ providerId: 'openai_web_search', mode: 'PUBLIC', estimatedCostUsd: 0.04, estimatedRequests: 4, providerDailyBudgetUsd: 0.05, globalDailyBudgetUsd: 0.09 });
  const second = await store.reserveBudget({ providerId: 'openai_web_search', mode: 'PUBLIC', estimatedCostUsd: 0.02, estimatedRequests: 2, providerDailyBudgetUsd: 0.05, globalDailyBudgetUsd: 0.09 });
  assert.equal(first.allowed, true, 'First reservation under budget should pass');
  assert.equal(second.allowed, false, 'Second reservation must not pass if provider budget would be exceeded');
  assert.equal(second.reason, 'provider_budget_exhausted');

  const global = new MemoryProviderRuntimeStore({ persistent: true });
  const [a, b] = await Promise.all([
    global.reserveBudget({ providerId: 'openai_web_search', mode: 'PUBLIC', estimatedCostUsd: 0.04, estimatedRequests: 4, providerDailyBudgetUsd: 0.1, globalDailyBudgetUsd: 0.05 }),
    global.reserveBudget({ providerId: 'google_search_grounding', mode: 'PUBLIC', estimatedCostUsd: 0.04, estimatedRequests: 4, providerDailyBudgetUsd: 0.1, globalDailyBudgetUsd: 0.05 }),
  ]);
  assert.equal([a, b].filter((result) => result.allowed).length, 1, 'Concurrent global reservations must not both pass when combined spend exceeds global budget');

  const missing = await store.reserveBudget({ providerId: 'openai_web_search', mode: 'PUBLIC', estimatedCostUsd: 0.01, estimatedRequests: 1, providerDailyBudgetUsd: null, globalDailyBudgetUsd: 1 });
  assert.equal(missing.reason, 'missing_budget');
}

async function testReconciliation() {
  const store = new MemoryProviderRuntimeStore({ persistent: true });
  await store.reserveBudget({ providerId: 'openai_web_search', mode: 'PUBLIC', estimatedCostUsd: 0.05, estimatedRequests: 5, providerDailyBudgetUsd: 1, globalDailyBudgetUsd: 1 });
  await store.reconcileBudget({ providerId: 'openai_web_search', mode: 'PUBLIC', estimatedCostUsd: 0.05, actualCostUsd: 0.03, success: true });
  assert.equal(store.getDailyUsage('openai_web_search', new Date().toISOString().slice(0, 10)).spentUsd, 0.03, 'Actual cost below estimate should reconcile down');
  await store.reconcileBudget({ providerId: 'openai_web_search', mode: 'PUBLIC', estimatedCostUsd: 0.01, actualCostUsd: 0.02, success: false });
  assert.equal(store.getDailyUsage('openai_web_search', new Date().toISOString().slice(0, 10)).spentUsd, 0.04, 'Failed calls can still keep actual cost');
  await store.reconcileBudget({ providerId: 'openai_web_search', mode: 'PUBLIC', estimatedCostUsd: 0.01, actualCostUsd: null, success: false });
  assert.equal(store.getDailyUsage('openai_web_search', new Date().toISOString().slice(0, 10)).spentUsd, 0.04, 'Unavailable actual cost keeps reserved estimate');
}

async function testCircuit() {
  const store = new MemoryProviderRuntimeStore({ persistent: true });
  assert.equal((await store.recordProviderFailure('openai_web_search', { errorCode: '500', failureClass: 'PROVIDER' })).circuitState, 'CLOSED');
  assert.equal((await store.recordProviderFailure('openai_web_search', { errorCode: '500', failureClass: 'PROVIDER' })).circuitState, 'CLOSED');
  assert.equal((await store.recordProviderFailure('openai_web_search', { errorCode: '500', failureClass: 'PROVIDER' })).circuitState, 'OPEN');
  assert.equal((await store.tryHalfOpen('openai_web_search')).circuitState, 'HALF_OPEN');
  assert.equal((await store.recordProviderSuccess('openai_web_search')).circuitState, 'CLOSED');
  assert.equal((await store.recordProviderFailure('openai_web_search', { errorCode: '401', failureClass: 'AUTH' })).circuitState, 'OPEN');
}

async function testRateLimit() {
  process.env.AI_SCORE_RATE_LIMIT_HMAC_SECRET = 'test-secret';
  const store = new MemoryProviderRuntimeStore({ persistent: true });
  const first = await store.checkRateLimit({ scope: 'client', rawIdentifier: '192.0.2.1', limit: 2, windowSeconds: 60 });
  const second = await store.checkRateLimit({ scope: 'client', rawIdentifier: '192.0.2.1', limit: 2, windowSeconds: 60 });
  const third = await store.checkRateLimit({ scope: 'client', rawIdentifier: '192.0.2.1', limit: 2, windowSeconds: 60 });
  const other = await store.checkRateLimit({ scope: 'client', rawIdentifier: '192.0.2.2', limit: 2, windowSeconds: 60 });
  const domain = await store.checkRateLimit({ scope: 'domain', rawIdentifier: 'horyzon.it', limit: 1, windowSeconds: 60 });
  const domainSecond = await store.checkRateLimit({ scope: 'domain', rawIdentifier: 'horyzon.it', limit: 1, windowSeconds: 60 });
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.equal(other.allowed, true);
  assert.equal(domain.allowed, true);
  assert.equal(domainSecond.allowed, false);
  assert.doesNotMatch(first.bucketKey, /192\.0\.2\.1|horyzon\.it/, 'Bucket key must not contain raw identifier');
  delete process.env.AI_SCORE_RATE_LIMIT_HMAC_SECRET;
}

function testNoopFailClosed() {
  const store = new MemoryProviderRuntimeStore({ persistent: false });
  const plan = validateProviderExecutionPlan({ providerId: 'openai_web_search', estimatedCostUsd: 0.01, scanProfileBudgetUsd: 0.05, usageStore: store });
  assert.equal(plan.ok, false, 'Non-persistent stores must not allow public provider execution');
}

function testFailureClassification() {
  assert.equal(classifyProviderFailure({ status: 401 }), 'AUTH');
  assert.equal(classifyProviderFailure({ status: 403 }), 'AUTH');
  assert.equal(classifyProviderFailure({ status: 429 }), 'RATE_LIMIT');
  assert.equal(classifyProviderFailure({ status: 500 }), 'PROVIDER');
  assert.equal(classifyProviderFailure({ errorCode: 'timeout' }), 'TIMEOUT');
  assert.equal(classifyProviderFailure({ errorCode: 'malformed_json' }), 'MALFORMED_RESPONSE');
}

function testConfigParsing() {
  process.env.AI_SCORE_OPENAI_DAILY_BUDGET_USD = '0';
  process.env.AI_SCORE_DAILY_BUDGET_USD = 'wat';
  assert.equal(readBudgetConfig('openai_web_search').state, 'invalid');
  delete process.env.AI_SCORE_OPENAI_DAILY_BUDGET_USD;
  delete process.env.AI_SCORE_DAILY_BUDGET_USD;
  assert.equal(readBudgetConfig('openai_web_search').state, 'missing');
  assert.equal(readRateLimitConfig().client.limit, 6);
}
