# Horyzon AI Score provider activation

Phase 6A introduces the safe activation layer for future AI Visibility and External Brand Footprint providers. It does not add API keys, payment flows, live provider calls, or public provider execution.

## Runtime states

Each provider exposes three separate booleans.

- `configured`: the server environment contains the required credential variable.
- `enabled`: the provider-specific server flag is enabled.
- `publicEnabled`: public execution is allowed. This requires `configured`, `enabled`, `AI_SCORE_LIVE_PROVIDERS=true`, a closed circuit, a persistent `ProviderUsageStore`, and an available daily budget.

Provider `mode` can be:

- `DISABLED`: provider flag is off.
- `TEST_ONLY`: provider is prepared for manual server-side testing, but public execution remains blocked.
- `PUBLIC`: public execution is allowed only if every runtime guard also passes.

Circuit state can be `CLOSED`, `OPEN`, or `HALF_OPEN`. Phase 6A ships the model and fail-closed guards; persistent circuit storage must be added before live public execution.

## Environment variables

Do not commit values for these variables.

```env
AI_SCORE_RUNTIME_STORE_ENABLED=
AI_SCORE_LIVE_PROVIDERS=
AI_SCORE_PROVIDER_TEST_MODE=
AI_SCORE_PROVIDER_TELEMETRY=

AI_SCORE_OPENAI_VISIBILITY_ENABLED=
AI_SCORE_GOOGLE_VISIBILITY_ENABLED=
AI_SCORE_PERPLEXITY_VISIBILITY_ENABLED=
AI_SCORE_PERPLEXITY_FOOTPRINT_ENABLED=

AI_SCORE_DAILY_BUDGET_USD=
AI_SCORE_TEST_DAILY_BUDGET_USD=
AI_SCORE_OPENAI_DAILY_BUDGET_USD=
AI_SCORE_GOOGLE_DAILY_BUDGET_USD=
AI_SCORE_PERPLEXITY_DAILY_BUDGET_USD=

AI_SCORE_RATE_LIMIT_MAX=
AI_SCORE_RATE_LIMIT_WINDOW_SECONDS=
AI_SCORE_DOMAIN_LIMIT_MAX=
AI_SCORE_DOMAIN_LIMIT_WINDOW_SECONDS=
AI_SCORE_RATE_LIMIT_HMAC_SECRET=

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

OPENAI_API_KEY=
GOOGLE_AI_API_KEY=
PERPLEXITY_API_KEY=
```

Defaults are fail-closed. Empty variables are treated as disabled or not configured.

## Public API contract

`POST /api/ai-score` accepts only the submitted `url`. The client cannot request:

- provider selection;
- prompt or query counts;
- scan profile changes;
- premium execution;
- budget overrides;
- test mode;
- live execution.

FREE scan profiles are selected server-side. The initial free AI Visibility priority is `openai_web_search`; no automatic expensive fallback is enabled.

## Budget and usage store

`ProviderUsageStore` is the required accounting boundary for public execution. The shipped `NoopProviderUsageStore` is intentionally non-persistent, so public live calls remain blocked even if credentials and flags are present.

Phase 6B prepares a server-side `ProviderRuntimeStore` with atomic operations for:

- provider and global daily budget reservation;
- reservation reconciliation when actual provider cost is known;
- persistent circuit state;
- HMAC-based client and domain rate limiting.

The budget day is a UTC date. It must not depend on the serverless instance timezone.

Before setting `AI_SCORE_LIVE_PROVIDERS=true`, production must provide persistent usage accounting for:

- daily spend per provider;
- request count per provider;
- consecutive failures for the circuit breaker.

Without persistent usage storage, public execution fails closed with `NO_PERSISTENT_STORE`.

## Database preparation

The website repository currently does not include an authorized database client, Supabase dependency, or migration runner. Phase 6B therefore prepares the migration but does not apply it automatically:

```text
supabase/migrations/20260922041000_ai_score_runtime_store.sql
```

The migration creates only runtime safety tables:

- `provider_daily_usage`;
- `provider_runtime_state`;
- `ai_score_rate_limit`.

It does not store audited HTML, AI answers, complete prompts, personal data, or remediation evidence. RLS is enabled and anon/authenticated access is revoked; access is intended only from server-side RPC calls using an authorized server credential.

## Rate limiting

When a persistent store is configured, rate limiting should use:

- per-client/IP HMAC bucket;
- per-domain HMAC bucket;
- configurable limits and window durations.

The raw IP or raw domain must not be stored as the bucket key. `AI_SCORE_RATE_LIMIT_HMAC_SECRET` is required for persistent rate-limit keys.

If no persistent store is configured, the existing in-memory public audit limiter can keep the current website usable, but it is not sufficient for opening live providers.

## Retention

Phase 6B.1 does not introduce a new cron or background worker. Runtime data is intentionally small and scoped to provider safety:

- remove expired `ai_score_rate_limit` rows with `expires_at < now()` when operational cleanup is scheduled;
- keep `provider_daily_usage` by UTC day for budget/audit reconciliation, then archive or delete according to the future commercial reporting policy;
- keep `provider_runtime_state` as current provider health state and reset only through controlled server-side operations.

Test scripts use clearly prefixed provider identifiers and attempt to delete only their own test rows.

## Manual dry-run

```bash
npm run ai-score:test-provider -- --provider=openai_web_search --domain=horyzon.it --dry-run
```

Expected Phase 6A behavior:

- 5 planned prompts or queries;
- 0 network calls;
- provider shown as not configured unless its credential exists in the server environment;
- execution blocked;
- runtime store type and persistence state shown;
- budget and rate-limit configuration state shown;
- provider eligibility shown;
- no secret values printed.

Future live checks must require the explicit flag:

```bash
npm run ai-score:test-provider -- --provider=openai_web_search --domain=horyzon.it --execute
```

In Phase 6A `--execute` still blocks unless every runtime guard passes, and no live network adapter is implemented here.
