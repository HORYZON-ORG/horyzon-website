# Annunci 10x Unit Economics v1

Source of truth:
- `docs/annunci-10x/live-validation/openai-live-validation-v1.md`
- `docs/annunci-10x/live-validation/cost-benchmark-v1.json`
- `docs/annunci-10x/live-validation/create-live-validation-v1.md`
- `docs/annunci-10x/live-validation/create-cost-benchmark-v1.json`

FASE 10A made no new calls and analyzed the first live benchmark. FASE 10F adds 29 local/server-side OpenAI calls for structured Create-from-zero validation. No Supabase migration, Vercel env change, AI Score change, legacy change, checkout, or pricing configuration was made.

## Data Check

| Metric | Value |
| --- | ---: |
| Live calls in successful benchmark | 35 |
| Model | `gpt-5-mini` |
| Pricing used | $0.25 / 1M input, $0.025 / 1M cached input, $2.00 / 1M output |
| Successful-run input tokens | 83,423 |
| Successful-run cached tokens | 4,096 |
| Successful-run output tokens | 77,195 |
| Successful-run total tokens | 160,618 |
| Successful-run OpenAI cost | $0.174324 |
| Cumulative benchmark cost reported | $0.198662 |
| Prior benchmark cost included in cumulative guardrail | $0.024338 |

The report-level cumulative cost is $0.198662. Product journey calculations below use successful operation records from the completed benchmark, because the prior $0.024338 is not attributable to a repeatable customer journey.

## Cost By Operation

| Operation | Calls | Input | Cached | Output | Total tokens | Total cost | Avg cost/call | Avg latency | Median latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| PRECHECK | 4 | 1,844 | 0 | 1,569 | 3,413 | $0.003600 | $0.000900 | 5,486 ms | 4,768 ms |
| EXTRACT | 3 | 2,125 | 0 | 5,181 | 7,306 | $0.010893 | $0.003631 | 21,440 ms | 17,063 ms |
| CLARIFY | 2 | 1,771 | 0 | 1,618 | 3,389 | $0.003679 | $0.001839 | 14,042 ms | 14,042 ms |
| PROFILE | 3 | 4,244 | 1,408 | 5,111 | 9,355 | $0.010966 | $0.003655 | 23,364 ms | 24,276 ms |
| STRATEGY | 3 | 8,292 | 2,688 | 10,950 | 19,242 | $0.023368 | $0.007789 | 38,277 ms | 40,417 ms |
| GENERATE | 3 | 11,375 | 0 | 11,637 | 23,012 | $0.026118 | $0.008706 | 45,175 ms | 48,020 ms |
| VALIDATE | 5 | 9,337 | 0 | 13,758 | 23,095 | $0.029850 | $0.005970 | 34,294 ms | 31,783 ms |
| REVISE | 1 | 1,918 | 0 | 1,022 | 2,940 | $0.002523 | $0.002523 | 10,219 ms | 10,219 ms |
| EVALUATE | 5 | 32,568 | 0 | 19,469 | 52,037 | $0.047080 | $0.009416 | 52,280 ms | 52,395 ms |
| CHANNEL_ADAPTER | 2 | 4,067 | 0 | 3,545 | 7,612 | $0.008107 | $0.004054 | 20,064 ms | 20,064 ms |
| EDIT_CLASSIFIER | 4 | 5,882 | 0 | 3,335 | 9,217 | $0.008141 | $0.002035 | 10,842 ms | 10,519 ms |

Most expensive by total observed operation cost:

| Rank | Operation | Total cost |
| ---: | --- | ---: |
| 1 | EVALUATE | $0.047080 |
| 2 | VALIDATE | $0.029850 |
| 3 | GENERATE | $0.026118 |
| 4 | STRATEGY | $0.023368 |
| 5 | PROFILE | $0.010966 |
| 6 | EXTRACT | $0.010893 |
| 7 | EDIT_CLASSIFIER | $0.008141 |
| 8 | CHANNEL_ADAPTER | $0.008107 |
| 9 | CLARIFY | $0.003679 |
| 10 | PRECHECK | $0.003600 |
| 11 | REVISE | $0.002523 |

## Journey Costs

The journey costs below are arithmetic combinations of measured operation averages. They are not price recommendations.

### Free Analysis

`FREE_ANALYSIS_NO_CLARIFY` uses: PRECHECK + EXTRACT + PROFILE + STRATEGY + EVALUATE ORIGINAL.

| Journey | Calls | Input | Cached | Output | Total tokens | Cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| FREE_ANALYSIS_NO_CLARIFY | 5 | 10,985 | 1,365 | 11,684 | 22,669 | $0.025807 |
| FREE_ANALYSIS_WITH_CLARIFY | 6 | 11,871 | 1,365 | 12,493 | 24,363 | $0.027646 |

For `FREE_ANALYSIS_WITH_CLARIFY`, the benchmark measured one CLARIFY addition. It did not measure a consequent post-clarification re-evaluation sequence, so that consequent cost is N/D.

### Rewrite Existing Ad

`ANALYZE_PREMIUM_INCREMENT` uses: GENERATE + VALIDATE generated master + EVALUATE generated master + CHANNEL_ADAPTER.

| Journey | Calls | Input | Cached | Output | Total tokens | Cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| ANALYZE_PREMIUM_INCREMENT, no revision | 4 | 14,964 | 0 | 12,233 | 27,197 | $0.028207 |
| ANALYZE_PREMIUM_TOTAL, no clarification, no revision | 9 | 25,949 | 1,365 | 23,917 | 49,866 | $0.054014 |
| ANALYZE_PREMIUM_TOTAL, with clarification, no revision | 10 | 26,835 | 1,365 | 24,726 | 51,560 | $0.055853 |
| ANALYZE_PREMIUM_INCREMENT, with one revision | N/D | N/D | N/D | N/D | N/D | N/D |

The benchmark measured one REVISE call, but did not measure a complete post-revision VALIDATE + EVALUATE sequence. Therefore a complete premium-with-revision journey cost is N/D.

### Create From Zero, Pre Payment

FASE 10F measured two full Create-from-zero pre-payment journeys through the structured `CREALO` form: seven answer-step `EXTRACT` calls, then `PROFILE` and `STRATEGY`.

| Journey | Calls | Input | Cached | Output | Total tokens | Cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CUSTOMER_CARE_PRE_PAYMENT | 9 | 12,019 | 0 | 24,989 | 37,008 | $0.052984 |
| B2B_COMMERCIALE_PRE_PAYMENT | 9 | 12,065 | 0 | 25,976 | 38,041 | $0.054967 |

Observed clarification count: 0 in both structured journeys. The previous partial lower-bound subset ($0.039652 total subset; $0.011445 pre-payment subset) remains historical and incomplete.

### Create From Zero, Premium

FASE 10F measured premium generation after server-side test authorization. Customer Care completed without revision. Commerciale B2B triggered automatic `REVISE`, followed by post-revision `VALIDATE` and `EVALUATE`.

| Journey | Calls | Input | Cached | Output | Total tokens | Cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CUSTOMER_CARE_PREMIUM | 4 | 16,546 | 0 | 11,835 | 28,381 | $0.027807 |
| B2B_COMMERCIALE_PREMIUM, with automatic revision | 6 | 21,998 | 0 | 16,120 | 38,118 | $0.037741 |
| CUSTOMER_CARE_TOTAL | 13 | 28,565 | 0 | 36,824 | 65,389 | $0.080791 |
| B2B_COMMERCIALE_TOTAL | 15 | 34,063 | 0 | 42,096 | 76,159 | $0.092708 |

Sample size: 2. These values are observed provider costs, not pricing recommendations and not a stable statistical forecast. The B2B quality result was `NEEDS_TUNING`: automatic revision exposed a runtime section-preservation bug, fixed after the benchmark without extra live retest because the phase reached 29/30 allowed calls.

## Central Comparison

| Path | Calls | Input | Cached | Output | OpenAI cost |
| --- | ---: | ---: | ---: | ---: | ---: |
| Analisi gratuita senza chiarimenti | 5 | 10,985 | 1,365 | 11,684 | $0.025807 |
| Analisi gratuita con chiarimenti | 6 | 11,871 | 1,365 | 12,493 | $0.027646 |
| Riscrittura premium - incremento | 4 | 14,964 | 0 | 12,233 | $0.028207 |
| Riscrittura premium - totale | 9 | 25,949 | 1,365 | 23,917 | $0.054014 |
| Creazione da zero - pre pagamento, low observed | 9 | 12,019 | 0 | 24,989 | $0.052984 |
| Creazione da zero - pre pagamento, high observed | 9 | 12,065 | 0 | 25,976 | $0.054967 |
| Creazione da zero - premium incremento, low observed | 4 | 16,546 | 0 | 11,835 | $0.027807 |
| Creazione da zero - premium incremento, high observed | 6 | 21,998 | 0 | 16,120 | $0.037741 |
| Creazione da zero - totale, low observed | 13 | 28,565 | 0 | 36,824 | $0.080791 |
| Creazione da zero - totale, high observed | 15 | 34,063 | 0 | 42,096 | $0.092708 |

`COST_TO_HORYZON_REWRITE_EXISTING_AD`: $0.054014 observed without clarification/revision; $0.055853 with one clarification and no revision.

`COST_TO_HORYZON_CREATE_FROM_ZERO`: $0.080791-$0.092708 observed across two complete structured Create journeys. Mean observed: $0.086750. Sample size = 2.

Rewrite/create difference using observed mean: +$0.032736.

Create/rewrite ratio using observed mean: 1.606x.

## Revision Cost

| Component | Calls | Input | Cached | Output | Total tokens | Cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| REVISE only | 1 | 1,918 | 0 | 1,022 | 2,940 | $0.002523 |
| Post-revision VALIDATE | 1 | 1,594 | 0 | 2,129 | 3,723 | $0.004576 |
| Post-revision EVALUATE | 1 | 7,227 | 0 | 4,849 | 12,076 | $0.009967 |
| Complete one-revision cycle | 3 | 13,240 | 0 | 8,085 | 21,325 | $0.017862 |

## Channel Variant Cost

Observed average per `CHANNEL_ADAPTER` call: $0.004054.

Pure arithmetic projection:

| Variants | Calls | Input | Cached | Output | Total tokens | Cost |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 2,034 | 0 | 1,773 | 3,806 | $0.004054 |
| 2 | 2 | 4,067 | 0 | 3,545 | 7,612 | $0.008107 |
| 3 | 3 | 6,101 | 0 | 5,318 | 11,418 | $0.012161 |

## Free Analysis Scale

OpenAI-only cost using observed average journey cost:

| Volume | No clarification | With clarification |
| ---: | ---: | ---: |
| 100 | $2.580667 | $2.764617 |
| 1,000 | $25.806667 | $27.646167 |
| 10,000 | $258.066667 | $276.461667 |

## Cost Drivers

For free analysis without clarification:

| Operation | Approx. share | Observed driver |
| --- | ---: | --- |
| EVALUATE ORIGINAL | 38% | large rubric output, 20 checks |
| STRATEGY | 30% | longer generated structured strategy |
| PROFILE | 14% | structured role profile output |
| EXTRACT | 14% | fact extraction output |
| PRECHECK | 3% | short classification output |

For premium increment without revision:

| Operation | Approx. share | Observed driver |
| --- | ---: | --- |
| EVALUATE GENERATED_MASTER | 32% | large rubric output, 20 checks |
| GENERATE | 31% | long master ad output |
| VALIDATE GENERATED_MASTER | 22% | detailed claim validation output |
| CHANNEL_ADAPTER | 14% | channel-specific rewritten sections |

Across the successful benchmark, the largest total operation cost was EVALUATE ($0.047080), followed by VALIDATE ($0.029850), GENERATE ($0.026118), and STRATEGY ($0.023368).

## Latency Context

These are sums of observed API latencies, not UX promises.

| Journey | Approx. API latency |
| --- | ---: |
| FREE_ANALYSIS_NO_CLARIFY | 146 s |
| FREE_ANALYSIS_WITH_CLARIFY | 161 s |
| REWRITE premium increment, no revision | 148 s |
| REWRITE total, no clarification/revision | 294 s |
| CREATE_FROM_ZERO low observed | 474 s |
| CREATE_FROM_ZERO high observed | 499 s |
| REVISION_CYCLE observed | 92 s |

## Quality Context

Observed quality findings from FASE 10:

| Area | Result |
| --- | --- |
| PRECHECK | PASS on full job ad, social teaser, not-job-ad, and prompt injection fixture |
| EXTRACT | PASS; extracted explicit facts only in tested cases; prompt injection not executed |
| CLARIFY | PASS; conflict and insufficient-info cases produced clarification |
| PROFILE | PASS; structured role profile outputs valid |
| STRATEGY | PASS; structured strategy outputs valid |
| GENERATE | PASS; generated master ads schema-valid |
| VALIDATE | PASS; unsupported benefit and altered requirement were detected |
| EVALUATE | PASS; provider did not compute score fields; deterministic TypeScript scoring used |
| CHANNEL_ADAPTER | PASS; introducedFactIds remained 0 |
| EDIT_CLASSIFIER | PASS for editorial, factual, unsupported fact; WARN for strategic request classified as EDITORIAL |
| CREATE_FROM_ZERO structured form | PASS for raw answer preservation, requirement categories, UNKNOWN compensation, and 0 clarification in two fixtures |
| CREATE_FROM_ZERO premium B2B | NEEDS_TUNING; automatic revision exposed a section-preservation bug fixed after the benchmark |

`EDIT_CLASSIFIER strategic`: WARN - classified as EDITORIAL. No correction is made in FASE 10A.

## Unit Economics Inputs

| Product | Observed OpenAI cost | What the client receives |
| --- | ---: | --- |
| FREE_ANALYSIS | $0.025807 without clarification; $0.027646 with clarification | Analysis result, score/range/coverage, strengths/priorities, possible clarification |
| GUIDE | $0 / N/A | Already produced PDF guide assets |
| REWRITE_EXISTING_AD | $0.054014 without clarification/revision; $0.055853 with clarification/no revision | Free analysis plus generated Annuncio 10x, validation/evaluation, one channel variant |
| CREATE_FROM_ZERO | $0.080791-$0.092708 observed; mean $0.086750; sample size 2 | Structured create form, RoleCard, generated Annuncio 10x, validation/evaluation, one channel variant |
| GUIDE_PLUS_REWRITE | Same OpenAI delivery cost as REWRITE_EXISTING_AD; guide adds $0 API delivery cost | Guide plus rewrite journey |
| GUIDE_PLUS_CREATE | Create API cost observed above; guide adds $0 API delivery cost | Guide plus create-from-zero journey |

Excluded from this analysis: payment fees, VAT, marketing, labor, hosting, support, and non-OpenAI infrastructure.

## Pricing Inputs Only

A. API cost free analysis: $0.025807 without clarification; $0.027646 with one clarification.

B. API cost rewrite: $0.054014 without clarification/revision; $0.055853 with clarification/no revision.

C. API cost create: $0.080791-$0.092708 observed; mean $0.086750; sample size 2. Historical incomplete lower-bound subset: $0.039652.

D. API cost revision: complete observed cycle $0.017862 for REVISE + post-revision VALIDATE + EVALUATE.

E. API cost channel variant: $0.004958 average in FASE 10F; previous FASE 10A average $0.004054.

F. Rewrite/create economic difference using observed Create mean: +$0.032736; Create/Rewrite ratio 1.606x.

G. Quality findings: Create cost benchmark is sufficient, but B2B premium quality is NEEDS_TUNING until the post-benchmark revision merge fix is live-retested.

H. Value inputs without price decision: rewrite has measured full journey; create likely has extra interview extraction and clarification cost not measured; guide delivery has no OpenAI cost; EVALUATE/GENERATE/VALIDATE/STRATEGY drive most API spend; latency is material for multi-operation paths.

Assessment: `DATA_SUFFICIENT_FOR_PRICING` for OpenAI provider cost discussion, with a separate product-quality caveat: `CREATE_FROM_ZERO` needs a targeted live retest after the revision merge fix before it should be called product-ready.
