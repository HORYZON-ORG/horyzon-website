# Annunci 10x score calibration v1

Status: RUN
Date: 2026-09-23
Provider: OPENAI
Model: `gpt-5-mini`
Prompt after calibration: `annunci10x.evaluate.v3`

No Production environment, Supabase schema, Vercel setting, checkout, AI Score, or legacy `/annuncio-10x` file was changed.

Raw fixture text is intentionally not reproduced in this report.

## Git Baseline

- Baseline before Phase 10B work: `ce3a28b3c24cbc0b159541930b86ada887753191`
- `ce3a28b` was local-only at start, then pushed safely before score work.
- `origin/main` after synchronization: `ce3a28b3c24cbc0b159541930b86ada887753191`

## Diagnosis

Initial diagnosis showed two issues:

1. `EVALUATE` input projection removed the target text. The product flow supplied `originalAd`, but `projectAnnunci10xAiInput` did not pass it to the provider.
2. The `MOCK` evaluator returned a near-perfect fixed score for incomplete original ads, masking score-semantics bugs during local/Product provider mode.

Pre-fix Customer Care diagnostic:

| Provider | Prompt | Score | Coverage | Gate | PASS | PARTIAL | MISSING | CONFLICT | N/D |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| MOCK | `annunci10x.evaluate.v1` | 90-95 | 95 | READY | 18 | 0 | 1 | 0 | 1 |
| OPENAI | `annunci10x.evaluate.v1` | 57.5-67.5 | 90 | READY | 8 | 7 | 3 | 0 | 2 |

## Changes Made

- `EVALUATE` projection now includes evaluated target artifacts: `originalAd`, `generatedAd`, `master`, `channelVariant`, and `claimCheck` where supplied.
- Premium generated Master evaluation now passes the generated Master text to `EVALUATE`.
- `EVALUATE` prompt was calibrated to `annunci10x.evaluate.v3` with target-evidence rules.
- Deterministic gate mapping now blocks material conflicts on conditions/channel/CTA-sensitive checks.
- `MOCK` evaluation now derives statuses from target text heuristics instead of fixed mostly-PASS output.
- Deterministic regression tests were added for target projection, incomplete original ads, clarification context, requirement separation, unknown/custom channel, activities-vs-results, and material work-mode conflict.

## Final Customer Care

Synthetic Customer Care incomplete fixture, target `ORIGINAL_AD`.

| Provider | Prompt | Score | Coverage | Gate | PASS | PARTIAL | MISSING | CONFLICT | N/D |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| MOCK | `annunci10x.evaluate.v2.mock-final` | 55-70 | 85 | READY | 7 | 8 | 2 | 0 | 3 |
| OPENAI | `annunci10x.evaluate.v3` | 57.5-72.5 | 85 | READY | 9 | 5 | 3 | 0 | 3 |

Final OPENAI per-check statuses:

| Check | Status |
| --- | --- |
| 01 | PASS |
| 02 | PARTIAL |
| 03 | PASS |
| 04 | MISSING |
| 05 | PARTIAL |
| 06 | NOT_EVALUABLE |
| 07 | PASS |
| 08 | PASS |
| 09 | PASS |
| 10 | MISSING |
| 11 | PASS |
| 12 | PASS |
| 13 | PARTIAL |
| 14 | MISSING |
| 15 | PARTIAL |
| 16 | NOT_EVALUABLE |
| 17 | NOT_EVALUABLE |
| 18 | PASS |
| 19 | PASS |
| 20 | PARTIAL |

Key corrected semantics:

- Activity did not satisfy result check 04.
- Single requirements list did not satisfy check 10.
- Generic part-time/shift wording was PARTIAL, not PASS, for check 13.
- Missing compensation stayed MISSING.
- Company/name context did not create attractiveness PASS.
- UNKNOWN/CUSTOM channel did not auto-PASS checks 16/17.
- CTA without precise destination was PARTIAL, not PASS.

## Context A/B/C

| Scenario | Score | Coverage | Gate | Notes |
| --- | ---: | ---: | --- | --- |
| B correct role/company | 57.5-72.5 | 85 | READY | Baseline final Customer Care |
| A no role/company | 60-70 | 90 | READY | Context changed some display-sensitive checks but did not solve missing original content |
| C wrong declared role | 62.5-67.5 | 95 | READY | Wrong context did not replace the role visible in original target text |

The wrong declared role did not silently become the scored role. Residual risk: role-mismatch surfacing is still implicit through target evidence/statuses rather than a dedicated structured `ROLE_MISMATCH` field.

## Clarification

| Scenario | Score | Coverage | Gate | Result |
| --- | ---: | ---: | --- | --- |
| Original after clarification context | 50-65 | 85 | READY | Original missing facts did not become PASS |
| Generated Master containing confirmed facts | 77.5-82.5 | 95 | READY | Generated target improved when facts were inserted into target text |

This confirms the target separation rule: clarification can improve a generated target, not the immutable original ad score.

## Calibration Set

| Scenario | Score | Coverage | Band | Gate | PASS | PARTIAL | MISSING | CONFLICT | N/D |
| --- | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: |
| Very weak | 12.5-52.5 | 60 | INSUFFICIENT-NEEDS_REINFORCEMENT | READY | 0 | 5 | 7 | 0 | 8 |
| Medium | 62.5-67.5 | 95 | USABLE_BASE | READY | 9 | 7 | 3 | 0 | 1 |
| Very good | 85-90 | 95 | GOOD_COMPLETENESS | READY | 15 | 4 | 0 | 0 | 1 |
| Contradictory | 27.5-37.5 | 90 | INSUFFICIENT | BLOCKED | 3 | 5 | 8 | 2 | 2 |

Monotonicity result:

- Very weak < medium < very good.
- Contradictory is blocked by gate because material conflicts remain publication blockers.

## Control Sensitivity

Single-change controls from Customer Care, tested on `annunci10x.evaluate.v2` before the final `v3` tightening:

| Control | Score | Expected direction |
| --- | ---: | --- |
| Add observable outcome | 67.5-77.5 | Improved check 04 |
| Split requirements | 62.5-72.5 | Improved check 10 |
| Add concrete reasons | 70-75 | Improved attraction/context checks |

The controls confirmed sensitivity. Final `v3` was then retested on the canonical Customer Care, very good, conflict, clarification-original, and clarification-Master cases.

## Live Usage

Phase 10B OpenAI calls:

- Pre-fix diagnostic: 1 call, estimated cost about `$0.011`.
- Post-fix broad `v2` calibration: 12 calls, estimated cost `$0.110213`.
- Final `v3` retest: 5 calls, estimated cost `$0.051680`.
- Total Phase 10B live calls: 18.
- Total estimated Phase 10B cost: about `$0.173`.

Budget guardrail:

- Hard stop: `$1`.
- Max calls: 25.
- Result: not reached.

## Root Cause

Classification: `MULTIPLE`

- `CONTEXT_PROJECTION`: target text was stripped before `EVALUATE`.
- `EVALUATOR_PROMPT`: prompt lacked strict per-check evidence rules.
- `MOCK_ONLY`: mock provider was not semantically representative enough for local/product development.
- `GATE_SEMANTICS`: material conflicts needed deterministic blocking mapping.

## Residual Risks

- Role mismatch is detectable through target evidence behavior, but there is no dedicated structured `ROLE_MISMATCH` output field.
- `READY` can still occur for incomplete original ads when no blocking conflict exists; this is consistent with current score/gate separation, but product copy should avoid presenting READY as "perfect to publish".
- Check 14 compensation remains context-sensitive; product/legal policy may later decide when it is required instead of merely missing/N/D.

## Decision

Outcome: `READY - CALIBRATED`

OpenAI live score semantics for `EVALUATE` are now calibrated for the tested cases. The provider remains configurable. No silent OpenAI-to-mock fallback was introduced.

