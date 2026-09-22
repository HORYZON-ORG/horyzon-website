# Annunci 10x method v1

Canonical route: `/annunci-10x`

Legacy route, not part of this method: `/annuncio-10x` is `NON TOCCARE`.

## Purpose

The method separates facts, inferences, scoring, publication gates, channel adaptation, and commercial access. It must make the generated ad more clear and verifiable without inventing facts or hiding uncertainty.

## Method versioning

Every durable snapshot and AI operation must carry:

- `methodVersion`;
- `rubricVersion`;
- `strategyVersion`;
- `promptVersion`;
- `dataContractVersion`;
- `createdAt`.

The first canonical labels are:

- `annunci10x-method-v1`;
- `annunci10x-rubric-v1`;
- `annunci10x-strategy-v1`;
- `annunci10x-prompts-v1`;
- `annunci10x-data-contracts-v1`.

## Core separation

Annunci 10x distinguishes:

- facts from inferences;
- raw user answers from normalized facts;
- score from publication gates;
- master output from channel variants;
- role popularity from company attractiveness;
- role work reality from communication strategy;
- deterministic TypeScript decisions from AI text generation.

## Facts vs inferences

Facts are represented as `Fact<T>`.

Allowed provenance:

- `EXTRACTED`: found in the original ad or uploaded text.
- `USER_DECLARED`: provided directly by the user.
- `SYSTEM_INFERRED`: inferred by the system and not automatically publishable.
- `USER_CONFIRMED`: confirmed by the user after extraction or inference.

Rules:

- `SYSTEM_INFERRED` facts must not be published automatically.
- `SYSTEM_INFERRED` facts can guide clarification questions or internal strategy.
- `USER_CONFIRMED` is required before a sensitive inferred claim can appear in final copy.
- The original ad is immutable and remains separate from normalized facts.

## Role popularity and company attractiveness

Role popularity and company attractiveness are separate dimensions.

Role popularity answers:

- how common the role is;
- how competitive candidate supply may be;
- whether candidates likely compare many similar openings;
- whether the role needs stronger specificity to stand out.

Company attractiveness answers:

- why a candidate should choose this company;
- whether the company can credibly show context, growth, stability, autonomy, mission, compensation, or learning;
- whether the offer has enough concrete reasons to apply.

The system must not collapse these into one generic "appeal" score.

## Challenge and routine

A good ad describes both:

- `challenge`: the meaningful problem, responsibility, or result the person will own;
- `routine`: the repeated weekly work, constraints, handoffs, and operational cadence.

The final strategy should balance both. An ad with only challenge can sound vague. An ad with only routine can sound flat.

## Qualification

Qualification identifies who should apply and who should not apply.

It must distinguish:

- essential requirements;
- preferred requirements;
- disqualifying constraints;
- trainable gaps;
- evidence required from the candidate.

The method should reduce inflated requirements when they are not tied to real work.

## Commitment and difficulty

The method must make commitment visible:

- time demand;
- responsibility level;
- autonomy expected;
- emotional or relational load;
- physical or logistic constraints;
- learning curve;
- decision pressure.

Difficulty is not a defect. Hidden difficulty is a risk.

## Technicality

Technicality measures how much the role depends on specialized skills, tools, regulations, domain language, or measurable procedures.

Technicality affects:

- vocabulary level;
- requirement precision;
- need for examples;
- channel variant tone;
- validation depth.

## Strategy Engine

The Strategy Engine produces `CommunicationStrategy` from `RoleProfile`, `AttractionContext`, evaluation signals, and confirmed facts.

It decides:

- core promise of the role;
- candidate angle;
- clarity risks;
- proof points;
- missing facts that block confident publication;
- channel adaptation priorities.

It must not set a target numeric score for generation.

## Variability from work, not randomness

Variability in generated ads must derive from the work and context:

- role profile;
- challenge/routine balance;
- technicality;
- attractiveness evidence;
- publication channel;
- qualification level;
- confirmed user preferences.

The system must not introduce random style variation as a substitute for strategy.

## Claim Check

Claim Check reviews every final claim against facts and provenance.

Allowed claim states:

- `SUPPORTED`;
- `NEEDS_CONFIRMATION`;
- `UNSUPPORTED`;
- `CONTRADICTED`;
- `NOT_APPLICABLE`.

Publishing rule:

- `UNSUPPORTED` and `CONTRADICTED` claims cannot pass the final gate.
- `NEEDS_CONFIRMATION` can remain only if the final copy labels the uncertainty or removes the claim.

## Twenty evaluation checks

The v1 rubric has 20 checks:

1. Role title specificity.
2. Role mission clarity.
3. Challenge clarity.
4. Routine clarity.
5. Required outcomes.
6. Essential requirements grounded in work.
7. Preferred requirements separated.
8. Candidate qualification clarity.
9. Compensation clarity.
10. Location and work mode clarity.
11. Contract and schedule clarity.
12. Company attractiveness evidence.
13. Growth and learning evidence.
14. Difficulty and commitment transparency.
15. Technical detail fit.
16. Inclusiveness and bias risk.
17. Application instructions.
18. Claim support.
19. Channel fit.
20. Overall publication readiness.

Each check can return a measured result or `N/D`.

Canonical deterministic check statuses:

- `PASS`: full credit.
- `PARTIAL`: partial credit.
- `MISSING`: zero points because the expected information is absent.
- `CONFLICT`: zero points because available information contradicts itself; may also feed a publication gate.
- `NOT_EVALUABLE`: no direct score; reduces coverage and produces a score interval.

## N/D

`N/D` means the check is not applicable or not determinable from available facts.

Rules:

- `N/D` must not be silently scored as failure.
- `N/D` lowers coverage when the missing information matters.
- `N/D` can create a clarification or gate warning.
- `N/D` maps to the implementation status `NOT_EVALUABLE`.
- Scores are not normalized over the observable maximum. If 20 points are not evaluable and the observed score is 57.5, the interval is 57.5-77.5 with 80 coverage.

## Score and gate separation

Score answers "how strong is the ad according to the rubric?"

Gate answers "is this safe and complete enough to publish?"

The score can be acceptable while the gate blocks publication due to a critical missing fact, unsupported claim, or legal/commercial ambiguity.

Publication gate statuses:

- `READY`;
- `READY_WITH_WARNINGS`;
- `NEEDS_VERIFICATION`;
- `BLOCKED`.

## Channel Adapter

The Channel Adapter derives channel variants from the Master output.

Rules:

- the Master is the source of truth;
- variants cannot introduce new facts;
- variants can compress, reorder, and adapt tone;
- each variant must preserve required conditions and claim support;
- channel-specific edits must be traceable to the Master.

## Anatomy of the Master

The Master ad contains:

- role title;
- opening promise;
- company/context paragraph;
- mission and outcomes;
- responsibilities;
- essential requirements;
- preferred requirements;
- compensation and conditions;
- growth and support;
- difficulty/commitment transparency where relevant;
- application instructions;
- equal/inclusive language check;
- claim check summary;
- publication status.

## Final output

The final output is `GeneratedOutput`.

It contains:

- immutable session reference;
- Master ad;
- deterministic score result;
- deterministic publication gate;
- rationale;
- Claim Check;
- optional channel variants;
- commercial entitlement state used for generation;
- method/rubric/strategy/prompt versions.

## Legacy boundary

`/annuncio-10x` and its files remain `NON TOCCARE`. The method is for `/annunci-10x` only.
