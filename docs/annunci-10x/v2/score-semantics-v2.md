# Annunci 10x score semantics v2

Status: future scoring specification. Not implemented.

## Human guide vs software score

The Premium Guide self-evaluation is not a numeric score. It uses:

- Si.
- In parte.
- No.
- N/D.

The software product can still produce a numeric score, but only with structured per-control provider output and deterministic aggregation.

The LLM/provider must produce a numeric evaluation for each individual control. It must not produce or own the final score.

## Score question

The score answers:

How strong is the evaluated target according to the 20 V2 controls, evidence, anchors, and coverage?

The evaluated target must be explicit:

- `ORIGINAL_AD`
- `GENERATED_MASTER`
- `CHANNEL_VARIANT`

Context can guide interpretation, but context does not become target evidence unless the evaluated target contains the fact.

## Future V2 scoring model

Recommended target model:

- 20 controls.
- Each provider control result includes `checkId`, `score`, `evidence`, `reason`, `missing`, `confidence`, and applicability/status.
- Each control can be scored by the provider as integer `0..10` or `null`.
- Per-control scoring must be constrained by explicit V2 anchors.
- `null` means N/D or not determinable under the scoring contract.
- Final score is a single normalized `/100` value computed by TypeScript.
- Coverage shown separately.
- Reasons and evidence stored for every control result.
- Missing, partial, unsupported, and not-evaluable states remain visible.

This is a future migration from the current V1 implementation, where each check is worth 5 points and statuses map to deterministic values.

## Final score formula

For evaluable controls:

`finalScore = 100 * sum(perCheckScore) / (10 * evaluableCheckCount)`

Customer-facing rounding is still an implementation decision, with integer rounding preferred.

Example:

- evaluable controls: `18`;
- sum of per-control scores: `139`;
- maximum applicable score: `180`;
- final score: `77.2/100`.

Coverage remains separate:

`coverage = evaluableCheckCount / 20 * 100`

V2 produces one final score. It must not reintroduce V1-style `minScore` / `maxScore` or UI score ranges as canonical V2 output.

If future coverage is too low for a reliable score, the system may refuse to publish the score according to a future minimum coverage threshold. That threshold is `OPEN`.

## Suggested status model

Future V2 can keep status language while adding anchors:

- `STRONG`: clear direct evidence.
- `ADEQUATE`: enough evidence, some room to improve.
- `WEAK`: partial or vague evidence.
- `MISSING`: expected information absent.
- `UNSUPPORTED`: claim present but unsupported by source facts.
- `CONFLICT`: material contradiction.
- `NOT_EVALUABLE`: not applicable or not determinable.

The exact enum names are implementation decisions. The required distinction is semantic, not naming.

## N/D vs MISSING

`N/D` / `NOT_EVALUABLE`:

- not applicable;
- not available in a legitimate way;
- not determinable from the declared target/channel;
- provider score is `null`;
- excluded from the score numerator;
- excluded from the score denominator;
- reduces coverage.

`MISSING`:

- expected information is absent;
- the absence weakens the evaluated target.
- still evaluable;
- scored by V2 anchors;
- normally scores `0` when the expected information is completely absent.

The product must not treat `N/D` as zero, and must not let `N/D` hide critical missing information.

## Publication gate

Publication gate remains separate from numeric score.

Material issues can block or warn independently:

- contradictory location/work mode;
- inconsistent contract/schedule facts;
- unsupported compensation or benefit claims;
- unusable application destination;
- channel field mismatch;
- generated text changing facts from the Master;
- required facts absent for a specific channel.

## Score bands

Current V2 product bands:

| Range | Band | Meaning direction |
| --- | --- | --- |
| 0-49 | Critico | The ad likely fails to communicate essential role reality or candidate action. |
| 50-69 | Debole | Some useful facts exist, but the ad leaves important uncertainty. |
| 70-84 | Buona base | The ad is usable but has clear opportunities for higher precision and relevance. |
| 85-94 | Forte | The ad is materially clear, coherent, and candidate-oriented. |
| 95-100 | Eccellente | The ad is exceptionally complete and coherent under the rubric. |

Future calibration must verify evaluation quality, monotonicity, stability, anchor distributions, and public wording. It does not authorize Codex or implementation work to change the thresholds autonomously. If benchmarks suggest the numeric thresholds are problematic, the question must return to the product owner.

Band wording must not imply hiring guarantees.

## Claim boundaries

Forbidden score claims:

- "95+ guarantees many candidates."
- "10x more candidates."
- "Guaranteed hiring success."
- "Guaranteed better hire."
- "Guaranteed choice embarrassment."

Allowed direction:

- better clarity can improve relevance;
- stronger evidence can reduce irrelevant applications;
- a small number of coherent candidates can be more valuable than many irrelevant applications.

## Deterministic ownership

The deterministic TypeScript layer owns:

- final score;
- coverage;
- band;
- gate;
- control status mapping;
- treatment of N/D and missing values.

The provider may return:

- `checkId`;
- per-control `score` as integer `0..10` or `null`;
- structured evidence;
- reason;
- missing signals;
- confidence;
- applicability/status;
- unsupported claim flags.

The provider must not decide final score `/100`, final coverage, final band, or final publication gate.

Conceptual ownership:

`LLM = numeric evaluation of individual controls. TypeScript = deterministic aggregation of final result.`

## Migration note

Do not switch runtime from V1 to V2 score semantics until:

- V2 anchors are written;
- prompt output schema supports required evidence;
- deterministic calculator supports `0..10/null`;
- calibration fixtures exist;
- UI can display score, band, coverage, and gate distinctly;
- regression tests cover original ad, generated master, channel variants, missing facts, N/D, unsupported claims, and conflicts.
