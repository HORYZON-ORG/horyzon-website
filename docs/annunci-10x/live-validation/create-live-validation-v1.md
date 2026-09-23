# Annunci 10x Create Live Validation v1

Generated at: 2026-09-23T16:26:15.329Z
Baseline: `5918fb081dfedb8e1e000a181ba3f1ca965808b3`
Provider: `OPENAI` local/server-side harness. Production provider remains `MOCK`.
Model: `gpt-5-mini`
Pricing source: https://developers.openai.com/api/docs/models/gpt-5-mini accessed 2026-09-23T16:09:50.109Z

## Guardrails

- Live calls: 29/30
- Estimated live cost: $0.175813 / $1.000000
- No Production OpenAI calls.
- No web search tools configured.
- No chain-of-thought requested or saved.

## Scenario Decisions

| Scenario | Decision | Clarifications | Score | Coverage | Gate | Cost | Latency |
| --- | --- | ---: | --- | ---: | --- | ---: | ---: |
| Customer Care Specialist | READY_WITH_FINDINGS | 0 | 87.5/100 | 100% | READY | $0.080791 | 473653 ms |
| Commerciale B2B | NEEDS_TUNING | 0 | 12.5-22.5/100 | 90% | NEEDS_VERIFICATION | $0.092708 | 498970 ms |

## Journey Costs

| Journey | Calls | Input | Cached | Output | Total | Latency | Cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| CUSTOMER_CARE_PRE_PAYMENT | 9 | 12019 | 0 | 24989 | 37008 | 332089 ms | $0.052984 |
| CUSTOMER_CARE_PREMIUM | 4 | 16546 | 0 | 11835 | 28381 | 141564 ms | $0.027807 |
| CUSTOMER_CARE_TOTAL | 13 | 28565 | 0 | 36824 | 65389 | 473653 ms | $0.080791 |
| B2B_COMMERCIALE_PRE_PAYMENT | 9 | 12065 | 0 | 25976 | 38041 | 298658 ms | $0.054967 |
| B2B_COMMERCIALE_PREMIUM | 6 | 21998 | 0 | 16120 | 38118 | 200312 ms | $0.037741 |
| B2B_COMMERCIALE_TOTAL | 15 | 34063 | 0 | 42096 | 76159 | 498970 ms | $0.092708 |

## Operation Costs

| Task | Calls | Model | Input | Cached | Output | Total | Avg latency | Cost |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| EXTRACT | 14 | gpt-5-mini | 15205 | 0 | 40217 | 55422 | 35684 ms | $0.084234 |
| PROFILE | 2 | gpt-5-mini | 2897 | 0 | 3337 | 6234 | 23732 ms | $0.007399 |
| STRATEGY | 2 | gpt-5-mini | 5982 | 0 | 7411 | 13393 | 41852 ms | $0.016318 |
| GENERATE | 2 | gpt-5-mini | 8147 | 0 | 8029 | 16176 | 45816 ms | $0.018095 |
| VALIDATE | 3 | gpt-5-mini | 5714 | 0 | 6726 | 12440 | 28282 ms | $0.014881 |
| EVALUATE | 2 | gpt-5-mini | 16605 | 0 | 7593 | 24198 | 49760 ms | $0.019338 |
| CHANNEL_ADAPTER | 2 | gpt-5-mini | 3659 | 0 | 4500 | 8159 | 26010 ms | $0.009915 |
| REVISE | 1 | gpt-5-mini | 4419 | 0 | 1107 | 5526 | 13861 ms | $0.003319 |
| EDIT_CLASSIFIER | 1 | gpt-5-mini | 2000 | 0 | 908 | 2908 | 8997 ms | $0.002316 |

## Fact And Requirement Audit

### Customer Care Specialist

- Raw answers preserved: YES
- Requirement preservation: NO
- UNKNOWN preservation: YES
- Fact audit: `{"role":"PRESERVED","result":"PRESERVED","activities":"PRESERVED","location":"PRESERVED","workMode":"PRESERVED","contract":"PRESERVED","schedule":"PRESERVED","shifts":"OMITTED","compensation":"N/A","benefits":"N/A","required":"PRESERVED","preferred":"ALTERED","trainable":"ALTERED","context":"PRESERVED","cta":"OMITTED"}`
- Validator: unsupported=13, gate=READY
- Channel variant introduced facts: 0

### Commerciale B2B

- Raw answers preserved: YES
- Requirement preservation: NO
- UNKNOWN preservation: YES
- Fact audit: `{"role":"OMITTED","result":"OMITTED","activities":"OMITTED","location":"OMITTED","workMode":"OMITTED","contract":"OMITTED","schedule":"OMITTED","shifts":"N/A","compensation":"N/A","benefits":"N/A","required":"OMITTED","preferred":"OMITTED","trainable":"OMITTED","context":"OMITTED","cta":"OMITTED"}`
- Validator: unsupported=3, gate=NEEDS_VERIFICATION
- Channel variant introduced facts: 0

## Differentiation

- Status: PASS
- Opening different: true
- Strategy different: true
- Profile different: false

## Revision Cycle

- Source: AUTOMATIC_PREMIUM_PIPELINE
- Cost: $0.017862
- Problem fixed: NO
- New problems introduced: YES
- Note: the live B2B path triggered automatic `REVISE`, but the post-revision Master lost material sections. Runtime fix applied after benchmark: partial revised sections are merged into the existing Master instead of replacing all sections. No extra live retest was run because the benchmark reached 29/30 calls.

## Unit Economics

| Product/Journey | Observed cost | Sample | Notes |
| --- | ---: | ---: | --- |
| FREE_ANALYSIS_NO_CLARIFY | $0.025807 | prior | FASE 10A source of truth |
| FREE_ANALYSIS_WITH_CLARIFY | $0.027646 | prior | FASE 10A source of truth |
| REWRITE_EXISTING_AD | $0.054014 | prior | observed no clarification/revision |
| CREATE_FROM_ZERO_LOW | $0.080791 | 2 | live observed 10F |
| CREATE_FROM_ZERO_HIGH | $0.092708 | 2 | live observed 10F |
| CREATE_FROM_ZERO_MEAN | $0.086750 | 2 | arithmetic mean, not stable forecast |
| REVISION_CYCLE | $0.017862 | 1 | REVISE + VALIDATE + EVALUATE |
| CHANNEL_VARIANT | $0.004958 | 2 | live 10F average if available |

## Pricing Readiness

- Rewrite pricing data: SUFFICIENT
- Create pricing data: SUFFICIENT
- Revision pricing data: SUFFICIENT
- Channel variant pricing data: SUFFICIENT
- Overall: DATA_SUFFICIENT_FOR_PRICING

## Findings

- P2 CUSTOMER_CARE fact-audit: Material omissions: cta
- P2 B2B_COMMERCIALE fact-audit: Material omissions: role, result, activities, location, workMode, contract, required, cta
- P1 B2B_COMMERCIALE premium-revision: automatic REVISE live output lost material master sections. Runtime fix applied; live retest pending due 30-call budget.

## Decisions

- CUSTOMER_CARE_CREATE: READY_WITH_FINDINGS
- COMMERCIALE_B2B_CREATE: NEEDS_TUNING
- CREATE_STRUCTURED_INPUT: READY
- ROLE_CARD: READY
- PROFILE: READY
- STRATEGY: READY
- GENERATED_MASTER: NEEDS_TUNING
- VALIDATOR: READY
- REVISION_CYCLE: NEEDS_TUNING
- EVALUATOR: READY
- CHANNEL_ADAPTER: READY
- FACTUAL_FIDELITY: NEEDS_TUNING
- REQUIREMENT_PRESERVATION: NEEDS_TUNING
- CREATE_COST_BENCHMARK: SUFFICIENT
- OVERALL_CREATE: NEEDS_TUNING
- FASE_10F: NEEDS_TUNING
