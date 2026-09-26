# Annunci 10x score semantics v2

Status: V2 scoring specification plus isolated runtime implementation. Not public runtime.

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

The V2 core preserves the raw deterministic decimal value internally. Future UI may decide display rounding, but banding uses the raw value. For example, `49.9` remains `CRITICAL`, while `50.0` is `WEAK`.

Example:

- evaluable controls: `18`;
- sum of per-control scores: `139`;
- maximum applicable score: `180`;
- final score: `77.2/100`.

Coverage remains separate:

`coverage = evaluableCheckCount / 20 * 100`

V2 produces one final score. It must not reintroduce V1-style `minScore` / `maxScore` or UI score ranges as canonical V2 output.

If future coverage is too low for a reliable score, the system may refuse to publish the score according to a future minimum coverage threshold. That threshold is `OPEN`.

## Status model

Fase 1B runtime status names are final for the isolated V2 scoring core:

- `EVALUATED`: criterion is normally evaluable.
- `MISSING`: expected information/quality is completely absent.
- `UNSUPPORTED`: a relevant claim is present but not supported.
- `CONFLICT`: a material contradiction exists for that control.
- `NOT_EVALUABLE`: criterion is not applicable or cannot be determined legitimately.

Do not use `STRONG`, `WEAK`, or `ADEQUATE` as runtime status names. Quality is represented by the numeric `0..10` score.

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

Runtime metadata uses explicit half-open ranges:

- `CRITICAL`: `minInclusive = 0`, `maxExclusive = 50`.
- `WEAK`: `minInclusive = 50`, `maxExclusive = 70`.
- `GOOD_BASE`: `minInclusive = 70`, `maxExclusive = 85`.
- `STRONG`: `minInclusive = 85`, `maxExclusive = 95`.
- `EXCELLENT`: `minInclusive = 95`, `maxExclusive = null`.

This preserves the existing thresholds while making the exclusive upper bounds explicit.

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

Confidence is preserved as provider-reported diagnostic metadata only. It is validated as integer `0..100`, but it is not a calibrated probability and must not affect score, coverage, band, gate, fallback, or retry automation until real calibration exists.

Fase 1C adds a provider contract and isolated shadow runner for V2 evaluation:

- prompt version `annunci10x.evaluate.v2.3`;
- output schema `annunci10x_evaluate_v2`;
- explicit TARGET vs CONTEXT input boundary;
- one schema-repair retry after invalid provider output;
- deterministic aggregation through the V2 scoring core.

Fase 1D.1 keeps the provider as a fast scoring pass: it returns compact per-control evidence, missing signals, status, score, reason, and confidence. Customer narrative, recommendations, publication decisions, and commercial output remain owned by later deterministic/product layers.

Fase 1C.1 keeps the output schema and scoring semantics unchanged, but refines input minimization: TARGET preserves legitimate application/contact evidence that belongs to the evaluated ad or bundle; CONTEXT strips lead PII, secrets, payment, entitlement, pricing, discount, and commercial metadata. The prompt also excludes per-check gate and accelerator metadata because the provider evaluates controls while TypeScript owns gate and architecture decisions.

The isolated V2 runner does not persist operations, does not calculate a publication gate, and does not replace V1 `EVALUATE`. The V2.3 live pilot is calibration evidence only, not production validation.

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
