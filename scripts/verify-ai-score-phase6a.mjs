import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = readFileSync(join(root, 'src/lib/ai-score/provider-runtime.ts'), 'utf8');
const route = readFileSync(join(root, 'src/app/api/ai-score/route.ts'), 'utf8');
const packageJson = readFileSync(join(root, 'package.json'), 'utf8');
const script = readFileSync(join(root, 'scripts/ai-score-test-provider.mjs'), 'utf8');
const docs = readFileSync(join(root, 'docs/ai-score-provider-activation.md'), 'utf8');
const providerErrorFixture = readFileSync(join(root, 'test/fixtures/provider-runtime/provider-errors.json'), 'utf8');

assert.match(runtime, /ProviderRuntimeMode = 'DISABLED' \| 'TEST_ONLY' \| 'PUBLIC'/, 'Provider modes must be explicit');
assert.match(runtime, /ProviderCircuitState = 'CLOSED' \| 'OPEN' \| 'HALF_OPEN'/, 'Circuit states must be explicit');
assert.match(runtime, /configured: boolean/, 'Runtime state must expose configured');
assert.match(runtime, /enabled: boolean/, 'Runtime state must expose enabled');
assert.match(runtime, /publicEnabled: boolean/, 'Runtime state must expose publicEnabled');
assert.match(runtime, /AI_SCORE_LIVE_PROVIDERS/, 'Global live-provider master switch must exist');
assert.match(runtime, /AI_SCORE_OPENAI_VISIBILITY_ENABLED/, 'OpenAI Visibility provider flag must exist');
assert.match(runtime, /AI_SCORE_GOOGLE_VISIBILITY_ENABLED/, 'Google Visibility provider flag must exist');
assert.match(runtime, /AI_SCORE_PERPLEXITY_VISIBILITY_ENABLED/, 'Perplexity Visibility provider flag must exist');
assert.match(runtime, /AI_SCORE_PERPLEXITY_FOOTPRINT_ENABLED/, 'Perplexity Footprint provider flag must exist');
assert.match(runtime, /AI_SCORE_DAILY_BUDGET_USD/, 'Global daily budget env must exist');
assert.match(runtime, /AI_SCORE_OPENAI_DAILY_BUDGET_USD/, 'OpenAI daily budget env must exist');
assert.match(runtime, /AI_SCORE_GOOGLE_DAILY_BUDGET_USD/, 'Google daily budget env must exist');
assert.match(runtime, /AI_SCORE_PERPLEXITY_DAILY_BUDGET_USD/, 'Perplexity daily budget env must exist');
assert.match(runtime, /interface ProviderUsageStore/, 'ProviderUsageStore interface must exist');
assert.match(runtime, /class NoopProviderUsageStore/, 'Noop usage store must exist');
assert.match(runtime, /persistent = false/, 'Noop usage store must be non-persistent');
assert.match(runtime, /NO_PERSISTENT_STORE/, 'Public execution must fail closed without persistent usage storage');
assert.match(runtime, /getProviderRuntimeStatus/, 'Runtime status utility must exist');
assert.match(runtime, /validateProviderExecutionPlan/, 'Execution guard must exist');
assert.match(runtime, /recordProviderExecutionTelemetry/, 'Structured telemetry hook must exist');
assert.match(runtime, /provider credential not configured/, 'Missing credentials must block execution');
assert.match(runtime, /provider flag disabled/, 'Disabled provider flag must block execution');
assert.match(runtime, /provider circuit is OPEN/, 'Open circuit must block execution');
assert.match(runtime, /scan profile budget exceeded/, 'Scan profile budget must block execution');
assert.doesNotMatch(runtime, /defaultEnabled: true/, 'Providers must not be enabled by default');

assert.match(route, /const url = isRecord\(payload\) && typeof payload\.url === 'string' \? payload\.url : ''/, 'Public API must read only url from the request body');
assert.doesNotMatch(route, /payload\.(provider|profile|promptCount|queryCount|budget|premium|test|execute)/, 'Public API must not trust paid/test execution fields');

assert.match(packageJson, /"ai-score:test-provider": "node --no-warnings --experimental-strip-types scripts\/ai-score-test-provider\.mjs"/, 'Manual provider dry-run script must be exposed');
assert.match(packageJson, /verify-ai-score-phase6a\.mjs/, 'Phase 6A verifier must run with AI Score tests');

assert.match(script, /networkCalls: 0/, 'Dry-run script must report zero network calls');
assert.match(script, /--provider=openai_web_search --domain=horyzon\.it --dry-run/, 'Dry-run usage example must be present');
assert.match(script, /executeRequested/, 'Future live execution must require explicit --execute');
assert.match(script, /plannedRequests = 5/, 'FREE provider test must plan five prompts or queries');
assert.doesNotMatch(script, /fetch\(|https\.request|axios|openai\.responses|google|perplexity\.ai/i, 'Provider test script must not make network calls in Phase 6A');

assert.match(providerErrorFixture, /"testOnly": true/, 'Provider error fixtures must be marked testOnly');
assert.match(providerErrorFixture, /UNAUTHORIZED/, 'Provider fixtures must cover credential errors');
assert.match(providerErrorFixture, /RATE_LIMITED/, 'Provider fixtures must cover budget/rate errors');
assert.match(providerErrorFixture, /PROVIDER_ERROR/, 'Provider fixtures must cover provider failures');

for (const name of [
  'AI_SCORE_LIVE_PROVIDERS',
  'AI_SCORE_OPENAI_VISIBILITY_ENABLED',
  'AI_SCORE_GOOGLE_VISIBILITY_ENABLED',
  'AI_SCORE_PERPLEXITY_VISIBILITY_ENABLED',
  'AI_SCORE_PERPLEXITY_FOOTPRINT_ENABLED',
  'AI_SCORE_DAILY_BUDGET_USD',
]) {
  assert.match(docs, new RegExp(name), `Docs must mention ${name}`);
}

const hardcodedSecretPattern = /(sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{20,}|pplx-[A-Za-z0-9_-]{20,})/;
for (const [name, content] of Object.entries({ runtime, route, packageJson, script, docs, providerErrorFixture })) {
  assert.doesNotMatch(content, hardcodedSecretPattern, `${name} must not contain hardcoded provider secrets`);
}

console.log('AI Score Phase 6A verifier passed');
