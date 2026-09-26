# Annunci 10x V2.3 live calibration pilot

Status: PILOT. NON PRODUCTION VALIDATION.

This document summarizes a controlled live OpenAI regression for the isolated Annunci 10x EVALUATE V2 runner. It does not switch production behavior, does not persist V2 evaluations, and does not validate V2 for public release.

## Metadata

- Date: 2026-09-26T13:12:49.766Z
- Baseline commit: 81bb1a61b35483d72703cb8b8c9b4978af94c7ee
- Model: gpt-5-mini
- Prompt version: annunci10x.evaluate.v2.3
- Rubric version: annunci10x-rubric-v2
- Score semantics version: annunci10x-score-semantics-v2
- Prompt character count: 28035
- Completed runs: 15
- Live provider requests: 15
- Stopped reason: NONE

## Semantic Changes Under Test

- Prompt advanced from `annunci10x.evaluate.v2.2` to `annunci10x.evaluate.v2.3`.
- Applicability now takes precedence over absence: not legitimately applicable or determinable becomes `NOT_EVALUABLE/null`.
- Applicable complete absence becomes `MISSING/0`.
- Present but incomplete evidence remains `EVALUATED` with score `1..10`.
- `UNSUPPORTED` and `CONFLICT` keep numeric scores.
- Check 14 compensation precedence separates genuinely unknown compensation from known/required compensation.
- Evidence and missing arrays are capped at two compact items.
- EVALUATE V2 remains a fast scoring pass, not a customer narrative report.

## Run Plan

- 15 live calls maximum, all synthetic fixtures.
- Focused repeats: Case 10 x3, Case 11 x2, Case 02 x2, Case 04 x2, Case 15 x2.
- Single runs: Case 03, Case 09, Case 13, Case 14.
- Prompt injection regression is offline-only in this phase.

## Aggregate Usage

| Metric | Min | Median | Mean | Max | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Input tokens | 6889 | 6922 | 6964.47 | 7249 | 104467 |
| Cached tokens | 0 | 5888 | 5947.73 | 7168 | 89216 |
| Output tokens | 3042 | 4022 | 3837.33 | 4535 | 57560 |
| Total tokens | 9964 | 10946 | 10801.8 | 11426 | 162027 |

Cached/input ratio observed: 85.4%.

## Token Comparison vs V2.2

| Metric | V2.2 baseline | V2.3 observed | Change |
| --- | ---: | ---: | ---: |
| Mean input tokens | 6617.89 | 6964.47 | 346.58 |
| Cached input ratio | 86.18% | 85.4% | -0.78 pp |
| Mean output tokens | 4019.83 | 3837.33 | 4.54% reduction |
| Mean total tokens | 10637.72 | 10801.8 | 1.54% increase |
| Median latency ms | 32902 | 32514 | 1.18% reduction |

## Latency

- Min: 19096 ms
- Median: 32514 ms
- Mean: 31787.8 ms
- p95: 43975 ms
- Max: 43975 ms

## Schema Reliability

- First-attempt valid: 15
- Schema repairs: 0
- Hard invalid: 0
- Success rate: 100%
- Hard invariant failures: 0

## Hard Invariants

| Case | Check | Expected | Observed | Result |
| --- | --- | --- | --- | --- |
| case-10-repeat-1 | 14 | NOT_EVALUABLE/null | NOT_EVALUABLE/null | PASS |
| case-10-repeat-2 | 14 | NOT_EVALUABLE/null | NOT_EVALUABLE/null | PASS |
| case-09 | 12 | CONFLICT/ANY_NUMERIC | CONFLICT/1 | PASS |
| case-10 | 14 | NOT_EVALUABLE/null | NOT_EVALUABLE/null | PASS |
| case-11-repeat-1 | 14 | MISSING/0 | MISSING/0 | PASS |
| case-11 | 14 | MISSING/0 | MISSING/0 | PASS |
| case-13 | 16 | NOT_EVALUABLE/null | NOT_EVALUABLE/null | PASS |
| case-14 | 17 | CONFLICT/ANY_NUMERIC | CONFLICT/2 | PASS |

## Monotonicity Summary

| Pair | Raw score | Coverage | Improved checks | Worsened checks |
| --- | ---: | ---: | --- | --- |
| Pulizie | 24.285714285714285 -> 75.625 | 70 -> 80 | 02, 03, 04, 05, 06, 12, 13, 15, 19, 20 | - |

## Stability Summary

| Case | Final score abs delta | Coverage delta | Max per-check delta | Median per-check delta | Status flips | N/D flips |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| case-10 | 0 | 0 | 2 | 0 | 1 | 0 |
| case-10 | 2.86 | 0 | 4 | 0 | 1 | 0 |
| case-11 | 2.83 | 5 | 2 | 0 | 2 | 1 |
| case-02 | 0 | 0 | 2 | 0 | 1 | 0 |
| case-04 | 2.68 | 5 | 2 | 0 | 3 | 3 |
| case-15 | 4.21 | 0 | 2 | 0 | 0 | 0 |

## Focused Stability 04 / 07 / 11 / 14

| Case | Repeat | Check deltas | Status flips | N/D flips |
| --- | --- | --- | ---: | ---: |
| case-10 | case-10-repeat-1 | 04: d0; 07: status-only; 11: status-only; 14: status-only | 1 | 0 |
| case-10 | case-10-repeat-2 | 04: d0; 07: status-only; 11: status-only; 14: status-only | 1 | 0 |
| case-11 | case-11-repeat-1 | 04: d0; 07: status-only; 11: status-only; 14: d0 | 2 | 1 |
| case-02 | case-02-repeat-1 | 04: d0; 07: status-only; 11: d0; 14: d0 | 1 | 0 |
| case-04 | case-04-repeat-1 | 04: d2; 07: status-only (status flip, N/D flip); 11: status-only; 14: status-only (status flip, N/D flip) | 3 | 3 |
| case-15 | case-15-repeat-1 | 04: d2; 07: d0; 11: d0; 14: d0 | 0 | 0 |

## Pulizie Check 11

- Weak Case 03 / Check 11: EVALUATED/2
- Improved Case 04 / Check 11: NOT_EVALUABLE/null
- Interpretation: requirements present in TARGET are evaluated for link to real work; absence vs weak presence remains separate.

## Golden Complete Ad

- Case 15 score: 93.6842105263158/STRONG, coverage 95%.
- Case 15 repeat score: 89.47368421052632/STRONG, coverage 95%.
- NOT_EVALUABLE checks: 16.

Checks below 8:

| Check | Status | Score | Reason |
| --- | --- | ---: | --- |
| - | - | - | - |

## Missing vs N/D Audit

| Case | Check | Observed |
| --- | --- | --- |
| case-10 | 14 | NOT_EVALUABLE/null |
| case-10-repeat-1 | 14 | NOT_EVALUABLE/null |
| case-10-repeat-2 | 14 | NOT_EVALUABLE/null |
| case-11 | 14 | MISSING/0 |
| case-11-repeat-1 | 14 | MISSING/0 |
| case-13 | 16 | NOT_EVALUABLE/null |

## Evidence Audit

| Case | Context compensation in evidence | Evidence |
| --- | --- | --- |
| case-11 | NO | - |
| case-11-repeat-1 | NO | - |

Compensation context leakage observed: NO.

## Prompt Injection

- Live prompt-injection case executed: NO
- Offline verifier source: offline verifier in this phase
- Became perfect score: NO
- System prompt reveal signal observed: NO
- Aggregate fields rejected by schema: YES

## Delicate Checks 06 / 08 / 14 / 16 / 17

- 06 priority/emphasis: no duplicate-penalty failure is expected from this compact regression; broader monotonicity remains future work.
- 08 demanding conditions: no invented-difficulty issue is expected when no basis exists; broader coverage remains future work.
- 14 compensation: Case 10 must be NOT_EVALUABLE/null across all three runs; Case 11 must be MISSING/0 across both runs.
- 16 channel fit: behaved as expected for unknown/no-policy cases; CASE 13 passed NOT_EVALUABLE/null.
- 17 cross-field coherence: behaved as expected for bundle comparison; CASE 14 passed CONFLICT with text/field/destination mismatch.

## Check-Level Review

| Check | Observed issues | Stability signal | Missing/N-D risk | Monotonicity signal | Next action |
| --- | --- | --- | --- | --- | --- |
| 01 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | NEEDS_MORE_DATA | Pulizie:unchanged(0) | NEEDS_MORE_DATA |
| 02 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | NEEDS_MORE_DATA | Pulizie:improved(8) | NEEDS_MORE_DATA |
| 03 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | NEEDS_MORE_DATA | Pulizie:improved(8) | NEEDS_MORE_DATA |
| 04 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | NEEDS_MORE_DATA | Pulizie:improved(6) | NEEDS_MORE_DATA |
| 05 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | NEEDS_MORE_DATA | Pulizie:improved(8) | NEEDS_MORE_DATA |
| 06 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | NEEDS_MORE_DATA | Pulizie:improved(6) | NEEDS_MORE_DATA |
| 07 | 1 stability status flip(s) | PROMPT_REVIEW | OBSERVED_ND | Pulizie:NOT_EVALUABLE->NOT_EVALUABLE | PROMPT_REVIEW |
| 08 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | OBSERVED_ND | Pulizie:NOT_EVALUABLE->EVALUATED | NEEDS_MORE_DATA |
| 09 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | OBSERVED_ND | Pulizie:NOT_EVALUABLE->EVALUATED | NEEDS_MORE_DATA |
| 10 | 2 stability status flip(s) | PROMPT_REVIEW | OBSERVED_ND | Pulizie:EVALUATED->NOT_EVALUABLE | PROMPT_REVIEW |
| 11 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | OBSERVED_ND | Pulizie:EVALUATED->NOT_EVALUABLE | NEEDS_MORE_DATA |
| 12 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | NEEDS_MORE_DATA | Pulizie:improved(8) | NEEDS_MORE_DATA |
| 13 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | NEEDS_MORE_DATA | Pulizie:improved(4) | NEEDS_MORE_DATA |
| 14 | 1 stability status flip(s) | PROMPT_REVIEW | DIRECTLY_TESTED | Pulizie:NOT_EVALUABLE->MISSING | PROMPT_REVIEW |
| 15 | 4 stability status flip(s) | PROMPT_REVIEW | NEEDS_MORE_DATA | Pulizie:improved(6) | PROMPT_REVIEW |
| 16 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | DIRECTLY_TESTED | Pulizie:NOT_EVALUABLE->NOT_EVALUABLE | NEEDS_MORE_DATA |
| 17 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | OBSERVED_ND | Pulizie:NOT_EVALUABLE->EVALUATED | NEEDS_MORE_DATA |
| 18 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | NEEDS_MORE_DATA | Pulizie:unchanged(0) | NEEDS_MORE_DATA |
| 19 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | NEEDS_MORE_DATA | Pulizie:improved(3) | NEEDS_MORE_DATA |
| 20 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | NEEDS_MORE_DATA | Pulizie:improved(8) | NEEDS_MORE_DATA |

## Residual Risks

- This is a small pilot, not production validation.
- No official stability threshold is defined yet.
- Directional expectations are observations, not hard acceptance criteria.
- No publication gate V2 is implemented or calculated in this phase.
