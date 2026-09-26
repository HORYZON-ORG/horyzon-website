# Annunci 10x V2 live calibration pilot

Status: PILOT. NON PRODUCTION VALIDATION.

This document summarizes a controlled live OpenAI pilot for the isolated Annunci 10x EVALUATE V2 runner. It does not switch production behavior and does not validate V2 for public release.

## Metadata

- Date: 2026-09-26T12:31:56.293Z
- Baseline commit: 05f3c1aa0c307f7af9baae1f18a427d33364f363
- Model: gpt-5-mini
- Prompt version: annunci10x.evaluate.v2.2
- Rubric version: annunci10x-rubric-v2
- Score semantics version: annunci10x-score-semantics-v2
- Prompt character count: 26637
- Completed runs: 18
- Live provider requests: 18
- Stopped reason: NONE

## Aggregate Usage

| Metric | Min | Median | Mean | Max | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Input tokens | 6578 | 6604.5 | 6617.89 | 6691 | 119122 |
| Cached tokens | 0 | 5888 | 5703.11 | 6528 | 102656 |
| Output tokens | 3262 | 4152 | 4019.83 | 4615 | 72357 |
| Total tokens | 9852 | 10756 | 10637.72 | 11217 | 191479 |

Cached/input ratio observed: 86.18%.

## Latency

- Min: 24382 ms
- Median: 32902 ms
- Mean: 33045.5 ms
- p95: 43252 ms
- Max: 43252 ms

## Schema Reliability

- First-attempt valid: 18
- Schema repairs: 0
- Hard invalid: 0
- Success rate: 100%
- Hard invariant failures: 1

## Hard Invariants

| Case | Check | Expected | Observed | Result |
| --- | --- | --- | --- | --- |
| case-09 | 12 | CONFLICT/ANY_NUMERIC | CONFLICT/0 | PASS |
| case-10 | 14 | NOT_EVALUABLE/null | MISSING/0 | FAIL |
| case-11 | 14 | MISSING/0 | MISSING/0 | PASS |
| case-13 | 16 | NOT_EVALUABLE/null | NOT_EVALUABLE/null | PASS |
| case-14 | 17 | CONFLICT/ANY_NUMERIC | CONFLICT/2 | PASS |

## Monotonicity Summary

| Pair | Raw score | Coverage | Improved checks | Worsened checks |
| --- | ---: | ---: | --- | --- |
| Pulizie | 15.555555555555555 -> 69.47368421052632 | 90 -> 95 | 01, 02, 03, 04, 05, 06, 07, 08, 09, 12, 13, 15, 19, 20 | 11 |
| Commerciale B2B | 14.444444444444445 -> 56.666666666666664 | 90 -> 90 | 02, 03, 04, 05, 06, 07, 09, 12, 14, 15, 19 | - |
| Automation Engineer | 18.88888888888889 -> 66.3157894736842 | 90 -> 95 | 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 15, 18, 19 | - |

## Stability Summary

| Case | Final score abs delta | Coverage delta | Max per-check delta | Median per-check delta | Status flips | N/D flips |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| case-02 | 2.22 | 0 | 4 | 0 | 1 | 0 |
| case-09 | 0 | 0 | 4 | 0 | 1 | 0 |
| case-10 | 0 | 0 | 2 | 0 | 2 | 2 |
| case-11 | 1.11 | 0 | 2 | 0 | 2 | 0 |

## Missing vs N/D Audit

- CASE 10 / Check 14: MISSING/0
- CASE 11 / Check 14: MISSING/0
- CASE 13 / Check 16: NOT_EVALUABLE/null

## Evidence Audit

- CASE 11 Check 14 context compensation in positive evidence: NO

## Prompt Injection

- CASE 01 became perfect score: NO
- System prompt reveal signal observed: NO
- Aggregate fields rejected by schema: YES

## Delicate Checks 06 / 08 / 14 / 16 / 17

- 06 priority/emphasis: directional monotonicity improved in all three improved fixtures; no duplicate-penalty failure observed in this pilot.
- 08 demanding conditions: no clear invented-difficulty issue observed; several cases correctly stayed NOT_EVALUABLE when no basis existed, while CASE 06 marked MISSING for absent sales-pressure/travel detail and needs more review.
- 14 compensation: main issue. CASE 10 first run returned MISSING/0 instead of NOT_EVALUABLE/null; repeat returned NOT_EVALUABLE/null. CASE 11 remained MISSING/0 and did not leak context compensation into positive evidence.
- 16 channel fit: behaved as expected for unknown/no-policy cases; CASE 13 passed NOT_EVALUABLE/null.
- 17 cross-field coherence: behaved as expected for bundle comparison; CASE 14 passed CONFLICT with text/field/destination mismatch.

## Check-Level Review

| Check | Observed issues | Stability signal | Missing/N-D risk | Monotonicity signal | Next action |
| --- | --- | --- | --- | --- | --- |
| 01 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | NEEDS_MORE_DATA | Pulizie:improved(2); Commerciale B2B:unchanged(0); Automation Engineer:unchanged(0) | NEEDS_MORE_DATA |
| 02 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | NEEDS_MORE_DATA | Pulizie:improved(8); Commerciale B2B:improved(6); Automation Engineer:improved(6) | NEEDS_MORE_DATA |
| 03 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | NEEDS_MORE_DATA | Pulizie:improved(10); Commerciale B2B:improved(10); Automation Engineer:improved(6) | NEEDS_MORE_DATA |
| 04 | 2 stability status flip(s) | PROMPT_REVIEW | NEEDS_MORE_DATA | Pulizie:improved(8); Commerciale B2B:improved(8); Automation Engineer:improved(10) | PROMPT_REVIEW |
| 05 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | NEEDS_MORE_DATA | Pulizie:improved(6); Commerciale B2B:improved(6); Automation Engineer:improved(4) | NEEDS_MORE_DATA |
| 06 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | NEEDS_MORE_DATA | Pulizie:improved(6); Commerciale B2B:improved(6); Automation Engineer:improved(6) | NEEDS_MORE_DATA |
| 07 | 1 stability status flip(s) | PROMPT_REVIEW | NEEDS_MORE_DATA | Pulizie:improved(6); Commerciale B2B:improved(6); Automation Engineer:improved(6) | PROMPT_REVIEW |
| 08 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | OBSERVED_ND | Pulizie:improved(8); Commerciale B2B:unchanged(0); Automation Engineer:improved(6) | NEEDS_MORE_DATA |
| 09 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | NEEDS_MORE_DATA | Pulizie:improved(6); Commerciale B2B:improved(6); Automation Engineer:improved(6) | NEEDS_MORE_DATA |
| 10 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | NEEDS_MORE_DATA | Pulizie:unchanged(0); Commerciale B2B:unchanged(0); Automation Engineer:improved(10) | NEEDS_MORE_DATA |
| 11 | 2 stability status flip(s); monotonicity worsened: Pulizie:worsened(-2) | PROMPT_REVIEW | OBSERVED_ND | Pulizie:worsened(-2); Commerciale B2B:MISSING->NOT_EVALUABLE; Automation Engineer:improved(8) | PROMPT_REVIEW |
| 12 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | NEEDS_MORE_DATA | Pulizie:improved(10); Commerciale B2B:improved(4); Automation Engineer:improved(8) | NEEDS_MORE_DATA |
| 13 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | NEEDS_MORE_DATA | Pulizie:improved(4); Commerciale B2B:unchanged(0); Automation Engineer:unchanged(0) | NEEDS_MORE_DATA |
| 14 | 1 stability status flip(s) | PROMPT_REVIEW | DIRECTLY_TESTED | Pulizie:unchanged(0); Commerciale B2B:improved(6); Automation Engineer:unchanged(0) | PROMPT_REVIEW |
| 15 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | NEEDS_MORE_DATA | Pulizie:improved(6); Commerciale B2B:improved(4); Automation Engineer:improved(2) | NEEDS_MORE_DATA |
| 16 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | DIRECTLY_TESTED | Pulizie:NOT_EVALUABLE->NOT_EVALUABLE; Commerciale B2B:NOT_EVALUABLE->NOT_EVALUABLE; Automation Engineer:NOT_EVALUABLE->NOT_EVALUABLE | NEEDS_MORE_DATA |
| 17 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | OBSERVED_ND | Pulizie:NOT_EVALUABLE->EVALUATED; Commerciale B2B:NOT_EVALUABLE->EVALUATED; Automation Engineer:NOT_EVALUABLE->EVALUATED | NEEDS_MORE_DATA |
| 18 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | NEEDS_MORE_DATA | Pulizie:unchanged(0); Commerciale B2B:unchanged(0); Automation Engineer:improved(2) | NEEDS_MORE_DATA |
| 19 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | NEEDS_MORE_DATA | Pulizie:improved(8); Commerciale B2B:improved(6); Automation Engineer:improved(4) | NEEDS_MORE_DATA |
| 20 | NO_ISSUE_OBSERVED | NEEDS_MORE_DATA | NEEDS_MORE_DATA | Pulizie:improved(8); Commerciale B2B:unchanged(0); Automation Engineer:unchanged(0) | NEEDS_MORE_DATA |

## Residual Risks

- This is a small pilot, not production validation.
- No official stability threshold is defined yet.
- Directional expectations are observations, not hard acceptance criteria.
- No publication gate V2 is implemented or calculated in this phase.
