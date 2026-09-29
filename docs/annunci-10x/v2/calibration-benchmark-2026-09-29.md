# Annunci 10x calibration benchmark - 2026-09-29

Status: manual calibration reference. Not statistical ground truth and not production validation.

## Why this exists

A first real-ad review showed two product issues:

1. original ads were receiving scores that were too generous because implicit or merely present information was rewarded too much;
2. generated ads were clearer, but still too short and list-like to let a candidate mentally picture the role.

This benchmark fixes a working target before changing runtime scoring and generation.

## Product principle

> Prima la realta del ruolo. Poi le parole.

The generator must not merely improve copy. It should reconstruct the work in the candidate's mind using only confirmed facts.

## Score calibration

Keep unchanged:

- 20 controls;
- 0..10/null per check;
- deterministic /100 aggregation;
- coverage;
- public bands 0-49 / 50-69 / 70-84 / 85-94 / 95-100;
- gate separate from score.

Tighten:

- no halo bonus for information density;
- inference-only evidence cannot by itself justify >4;
- choose the lower adjacent score when evidence does not clearly earn the higher anchor;
- 8-10 require explicit, concrete, coherent evidence;
- 10 is exceptional;
- material conflicts normally score 0-2 on the affected control and remain gate-relevant;
- a task list does not automatically satisfy workflow/result/context;
- an undifferentiated requirement list is normally 2 on Check 10;
- generic employer slogans do not create offer value.

## Manual before/after targets

| Case | Original | Rewritten | Gate |
| --- | ---: | ---: | --- |
| Receptionist Hotel - Rome | 52 | 72 | BLOCKED: compensation conflict |
| Customer Care B2B German C1/C2 | 52 | 75 | BLOCKED: work-mode conflict |
| Production Machine Operator - Cologne | 68 | 90 | OK |
| Italy/Export Sales - Food | 72 | 91 | OK |

Average: 61 -> 82.

The first two intentionally remain below Strong because better prose cannot repair contradictory material facts.

## Communication-first recalibration - 2026-09-29

A later four-role review showed that original ads were still scoring too generously when they contained many facts but presented them as disconnected inventories.

Working recalibrated original-ad targets:

| Case | Earlier estimate | Communication-first target |
| --- | ---: | ---: |
| Digital Marketing Specialist | 65 | 57 |
| Chef Pasticcere | 67 | 60 |
| Infermiere/a di reparto | 72 | 63 |
| Buyer Tecnico / Responsabile Acquisti | 75 | 68 |

Decision:

- information presence is necessary but not sufficient;
- the candidate's effort to reconstruct the role is part of quality;
- list-like ads with weak role/result/context connections should normally remain in the 50-69 band;
- 70+ requires a genuinely understandable job model, not merely complete fields;
- 85+ requires the candidate to understand what work happens, why it matters, how requirements connect, and whether the opportunity fits;
- 95+ must remain exceptional.

The runtime now enforces these principles through deterministic communication-readiness ceilings after the raw per-check aggregate.

## Generation target

The Master should help the candidate understand:

- what role this is and why it exists;
- what work actually happens;
- how confirmed activities relate to each other;
- what result should improve;
- who/what the person interacts with when known;
- what is indispensable, preferred, or trainable;
- why a requirement matters when the source supports the connection;
- which conditions affect compatibility;
- what concrete, verifiable reasons exist to consider the offer;
- exactly how to apply.

### Descriptive depth

Working editorial targets:

- simple/operational: about 350-500 words when facts support it;
- professional/technical/commercial: about 500-750 words when facts support it.

Runtime prompt mapping:

- SHORT: 350-450;
- MEDIUM: 450-600;
- LONG: 600-750.

These are not quotas. Missing source depth must make the output shorter, never more inventive.

## Anti-hallucination boundary

Descriptive does not mean fictional.

Allowed:

- connect supported facts editorially;
- group related activities;
- explain a supported relationship between requirement and responsibility;
- make conditions prominent;
- turn a fragmented list into coherent prose.

Forbidden unless sourced:

- inventing a typical day;
- inventing sequence or frequency;
- inventing colleagues, tools, pressure, peaks, customers, metrics, autonomy, benefits, or growth;
- choosing between contradictory salary/work-mode/contract facts;
- turning UNKNOWN into a public claim.

## Reference examples

### Receptionist

Before: a good list of front-office tasks and requirements, but limited role purpose and a compensation contradiction.

After target: explain the receptionist as the guest's reference point and a coordination node across stay phases, while preserving the compensation conflict as blocking.

### Customer Care

Before: inbound, complaints, back office, German C1/C2, but the work is fragmented and the work-mode fields conflict.

After target: connect contact -> information capture -> handling/back office -> continuity, while leaving the work-mode conflict unresolved and blocking.

### Production Machine Operator

Before: concrete machine and quality-control bullets.

After target: make the candidate picture the relationship between machine setup, monitoring, anomaly handling, output inspection, and quality responsibility without inventing a fictional shift sequence.

### Italy/Export Sales

Before: already information-rich.

After target: make the commercial cycle intelligible - market/prospecting -> contact -> follow-up -> negotiation -> relationship - while distinguishing required from preferred qualifications and surfacing concrete offer facts.

## Implementation affected by this benchmark

- `src/lib/annunci-10x/ai/prompts/evaluate-v2.ts`
- `src/lib/annunci-10x/rubric-v2.ts`
- `src/lib/annunci-10x/ai/prompts/generate.ts`
- `docs/annunci-10x/v2/rubric-v2-anchors.md`
- `scripts/verify-annunci-10x-ai-v2.mjs`

Public band thresholds, checkout, public route, and payment behavior are unchanged. The score calculation now adds deterministic communication-readiness ceilings after the raw aggregate.
