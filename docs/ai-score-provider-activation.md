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
AI_SCORE_LIVE_PROVIDERS=
AI_SCORE_PROVIDER_TEST_MODE=
AI_SCORE_PROVIDER_TELEMETRY=

AI_SCORE_OPENAI_VISIBILITY_ENABLED=
AI_SCORE_GOOGLE_VISIBILITY_ENABLED=
AI_SCORE_PERPLEXITY_VISIBILITY_ENABLED=
AI_SCORE_PERPLEXITY_FOOTPRINT_ENABLED=

AI_SCORE_DAILY_BUDGET_USD=
AI_SCORE_OPENAI_DAILY_BUDGET_USD=
AI_SCORE_GOOGLE_DAILY_BUDGET_USD=
AI_SCORE_PERPLEXITY_DAILY_BUDGET_USD=

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

Before setting `AI_SCORE_LIVE_PROVIDERS=true`, production must provide persistent usage accounting for:

- daily spend per provider;
- request count per provider;
- consecutive failures for the circuit breaker.

Without persistent usage storage, public execution fails closed with `NO_PERSISTENT_STORE`.

## Manual dry-run

```bash
npm run ai-score:test-provider -- --provider=openai_web_search --domain=horyzon.it --dry-run
```

Expected Phase 6A behavior:

- 5 planned prompts or queries;
- 0 network calls;
- provider shown as not configured unless its credential exists in the server environment;
- execution blocked;
- no secret values printed.

Future live checks must require the explicit flag:

```bash
npm run ai-score:test-provider -- --provider=openai_web_search --domain=horyzon.it --execute
```

In Phase 6A `--execute` still blocks unless every runtime guard passes, and no live network adapter is implemented here.
