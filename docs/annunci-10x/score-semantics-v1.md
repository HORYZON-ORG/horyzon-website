# Annunci 10x score semantics v1

Canonical route: `/annunci-10x`

Legacy route, not part of this document: `/annuncio-10x` is `NON TOCCARE`.

## Purpose

This document fixes the stable score semantics for Annunci 10x. It is not a benchmark report and it does not define product prices.

The score answers: how strong is the evaluated target according to the 20-check rubric?

The gate answers: is the target safe and complete enough to publish?

The target is always explicit:

- `ORIGINAL_AD`: evaluate the submitted original ad text as published/submitted.
- `GENERATED_MASTER`: evaluate the generated Master sections.
- `CHANNEL_VARIANT`: evaluate the channel variant sections against the Master/channel constraints.

RoleCard, RoleProfile, CommunicationStrategy, declared role, declared company, and clarification answers are context. They can help interpret the target, but they do not become target evidence unless the evaluated target text contains the fact.

## Provenance

Evidence used for a score check must be classified conceptually as:

- `ORIGINAL_AD`: text visible in the submitted original ad.
- `TARGET_TEXT`: text visible in the generated Master or channel variant.
- `USER_DECLARED_CONTEXT`: user-provided context outside the evaluated target.
- `USER_CONFIRMED`: facts confirmed after extraction or clarification.
- `SYSTEM_INFERRED`: internal inference, not publishable as evidence by itself.

For `ORIGINAL_AD`, PASS/PARTIAL evidence must come from `ORIGINAL_AD`. Context may explain uncertainty, but cannot turn absent original content into PASS.

For `GENERATED_MASTER`, PASS/PARTIAL evidence must come from `TARGET_TEXT`; confirmed facts are used to verify that generated claims are supported.

## Status Rules

- `PASS`: target contains enough direct evidence for the check.
- `PARTIAL`: target contains relevant but incomplete evidence.
- `MISSING`: expected information is absent from the target.
- `CONFLICT`: target contains material contradiction.
- `NOT_EVALUABLE`: check is not applicable or not determinable from available target/channel conditions.

Weights are frozen:

- `PASS = 5`
- `PARTIAL = 2.5`
- `MISSING = 0`
- `CONFLICT = 0`
- `NOT_EVALUABLE = null`

Scores are not normalized over the observable maximum. `NOT_EVALUABLE` lowers coverage and creates a score interval.

## Clarification Rule

Clarification answers improve RoleCard, Strategy, and generated output when those facts are inserted into the generated target.

Clarification answers must not retroactively improve the score of the immutable original ad. A missing original-ad compensation, schedule detail, requirement split, result, or CTA remains missing/partial for `ORIGINAL_AD` unless it was present in the original target text.

## Gate Rule

The deterministic TypeScript gate remains separate from the numeric score.

Material conflicts on work mode, schedule/conditions, compensation, channel/destination consistency, or CTA can block publication even when the numeric score is otherwise acceptable.

Product display rule:

- `READY` means no critical publication blocker was detected.
- `READY` must not be presented as "the ad is excellent" or as a substitute for Score, Coverage, Strengths, or Priorities.
- When coverage is below 100, score must be shown as a range and coverage must remain a separate concept.
- Role and company hints are context only. They can help interpret the target, but they must not replace target evidence or increase score by themselves.
- If declared role and observed role appear incompatible, the product can show a conservative warning; that warning is not a score penalty and is not an automatic publication block.

## Evidence Scope By Check

| Check | What it measures | Evidence needed for PASS | Context allowance | N/D / Missing / Partial / Conflict notes |
| --- | --- | --- | --- | --- |
| 01 | Role title specificity | Target names a recognizable role/family | Context can disambiguate but not replace absent title | Missing if no role title in target |
| 02 | Role level/perimeter | Target states seniority, scope, perimeter, reporting, or responsibility level | RoleCard can explain partial interpretation | Partial if perimeter is only implied |
| 03 | Daily activities | Target states concrete recurring activities | Context cannot replace absent activities | Missing if only slogans or generic help |
| 04 | Observable result | Target states outcome/effect/result/KPI | Context can identify likely result but not score PASS | Activities alone are MISSING |
| 05 | Operating context | Target identifies collaborators, team, stakeholders, or operating environment | Context can explain, not complete | Partial if only one interlocutor/tool is visible |
| 06 | Role/company emphasis | Target gives enough evidence to judge role popularity/company attractiveness emphasis | RoleProfile may guide N/D | Company name alone is not attractiveness evidence |
| 07 | Challenge/routine fidelity | Target represents real challenge/routine without distortion | RoleProfile helps detect mismatch | Partial if routine visible but challenge/result weak |
| 08 | Qualification/commitment | Target shows selectivity and commitment proportionately | Context may explain risk | Conflict if target contradicts commitment |
| 09 | Technical detail fit | Target uses technical/tool/domain detail at suitable depth | RoleProfile can guide level | Partial if technicality is plausible but thin |
| 10 | Requirement separation | Target explicitly separates indispensable/preferred/trainable/disqualifying | Context cannot turn one list into separation | Single `Requisiti:` list is MISSING |
| 11 | Requirement relevance | Requirements are tied to visible work | RoleCard can explain fit if target has requirements/work | N/D if no requirements or no work basis |
| 12 | Location/work mode | Target states location and work mode clearly | Context can warn | Remote/presence contradiction is CONFLICT |
| 13 | Contract/schedule/time | Target states contract plus concrete hours/days/shift windows/cadence when relevant | Context can explain later generation | Part-time + generic shifts is PARTIAL |
| 14 | Compensation | Target states compensation or disclosure policy when applicable | Context cannot complete original target | Missing if expected and absent; N/D if not determinable/not required |
| 15 | Concrete reasons to choose offer | Target gives verified reasons to choose company/offer | Company name is not enough | Generic support phrase is at most PARTIAL |
| 16 | Channel structure | Target structure fits declared channel | Channel constraints required | UNKNOWN/CUSTOM without constraints is NOT_EVALUABLE |
| 17 | Text/fields/destination coherence | Target, fields, and destination are mutually coherent | Structured fields required | UNKNOWN/CUSTOM without fields is NOT_EVALUABLE |
| 18 | Readability hierarchy | Target is scannable and ordered | Context not needed | Partial if readable but not well structured |
| 19 | Concrete language | Target avoids vague, inflated, repetitive wording | Context not needed | Partial if generic phrases dilute clarity |
| 20 | CTA/destination | Target gives usable application path | Context cannot supply absent destination | `via email con CV` without address is PARTIAL |

## Implementation Notes

- `EVALUATE` prompt version for this semantic contract: `annunci10x.evaluate.v3`.
- The provider must not return score fields.
- The deterministic calculator owns points, intervals, coverage, bands, and gate.
- `MOCK` is deterministic test infrastructure. It should not be treated as a semantic quality authority, but it must not mask obvious missing-evidence cases.
