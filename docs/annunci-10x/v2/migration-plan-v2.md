# Annunci 10x migration plan v2

Status: implementation blueprint. Do not execute automatically.

## Goal

Migrate Annunci 10x from current V1 runtime semantics to V2 while preserving:

- existing production stability;
- legacy `/annuncio-10x`;
- AI provider configurability;
- no silent OpenAI-to-mock fallback;
- private distribution rules for paid assets;
- score/gate separation;
- original-ad evidence integrity.

## Phase 0: documentation baseline

This phase creates V2 docs only.

No runtime, migration, provider, deploy, Supabase, checkout, email, CRM, or UI changes.

## Phase 1: runtime constants and versions

Future work:

- add V2 method/rubric/score/commercial version constants;
- keep V1 constants for historical records;
- add tests that V1 and V2 versions are explicit;
- avoid changing user-visible behavior until the V2 route state is selected.

## Phase 2: rubric and score anchors

Fase 1B implemented the isolated TypeScript scoring core for:

- V2 20-control rubric representation;
- V2 status enum `EVALUATED`, `MISSING`, `UNSUPPORTED`, `CONFLICT`, `NOT_EVALUABLE`;
- per-check validation of `score`, `evidence`, `reason`, `missing`, and `confidence`;
- deterministic aggregation;
- coverage calculation;
- raw score band mapping;
- V2 unit/regression verifier.

This core remains additive and isolated. It is not wired into public `/annunci-10x`, the V1 EVALUATE prompt, providers, persistence, UI, or API routes.

Remaining future work:

- connect provider output to the V2 per-control schema;
- write full channel policies;
- define customer-facing rounding;
- define minimum coverage policy;
- implement future V2 gate interface.

The provider must produce bounded per-control numeric evaluations. Do not let the provider calculate final score `/100`, final coverage, final band, or final publication gate.

## Phase 3: prompt and schema alignment

Fase 1C implemented an isolated V2 provider contract for shadow evaluation:

- `src/lib/annunci-10x/ai/prompts/evaluate-v2.ts` renders prompt version `annunci10x.evaluate.v2.2` from the TypeScript V2 rubric;
- `src/lib/annunci-10x/ai/schemas-v2.ts` validates the V2 structured output and rejects provider-owned aggregate fields;
- `src/lib/annunci-10x/ai/evaluate-v2.ts` projects TARGET and CONTEXT separately, runs the provider with operation type `EVALUATE`, retries schema repair once, and aggregates through `calculateAnnunci10xScoreV2()`;
- `scripts/verify-annunci-10x-ai-v2.mjs` tests the contract with a fake provider and `OpenAiAnnunci10xProvider` fake fetch only.

This remains additive and isolated. It is not wired into public `/annunci-10x`, V1 `EVALUATE`, persistence, UI, API routes, Supabase, checkout, or commercial runtime.

Fase 1C.1 refined the projection boundary: TARGET preserves legitimate target-bundle evidence such as application email/phone/URL/name fields while removing technical secret keys; CONTEXT remains whitelisted to `roleCard`, `roleProfile`, and `communicationStrategy` and removes lead PII plus commercial/payment metadata. The V2 prompt no longer renders per-check `gateRelevance` or `acceleratorSuitability` metadata; those remain TypeScript/runtime architecture metadata, not provider scoring instructions.

Remaining future work:

- live-calibrate the V2 prompt with controlled benchmark fixtures;
- preserve unsupported-claim detection;
- benchmark prompt cost and semantic quality;
- define minimum coverage policy and publication gate V2;
- decide if and when the public product can switch from V1 to V2.

## Phase 3A: context capsule

Future work:

- prevent AI calls from receiving the entire funnel history by default;
- build operation-specific Context Capsules from structured source of truth;
- keep raw answers, normalized facts, RoleCard, RoleProfile, Strategy, and current snapshot distinct;
- preserve missing facts, conflicts, unsupported claims, and `DO_NOT_CLAIM`;
- keep capsule generation deterministic in TypeScript first;
- use any future semantic accelerator only after benchmark validation.

Do not implement Context Capsule during Fase 1C.

## Phase 4: data model

Future work:

- design additive Supabase migration;
- add source input model for public URL or pasted text;
- add contact identity and email verification state;
- add marketing consent fields;
- add V2 score detail records;
- add report delivery state;
- add entitlement/payment state if checkout phase begins.

Stop for explicit authorization before SQL migration.

## Phase 5: Analyze UX

Future work:

- implement pain-led entry copy;
- support source-first analysis;
- collect contact data during processing;
- require email verification before free score/report delivery;
- display focused free result;
- move detailed report to private/email output.

Preserve `noindex,nofollow` and unlisted state until explicitly changed.

## Phase 6: Create UX

Future work:

- replace monolithic creation experience with staged wizard;
- map steps to V2 sheet areas;
- pre-process completed steps in background;
- keep paid generation blocked until entitlement is verified.

## Phase 7: Commercial implementation

Future work:

- implement catalog prices;
- implement checkout;
- verify payment server-side;
- implement entitlements;
- implement upgrade credit rule;
- implement private delivery for Agent Recruiter / Premium Guide;
- optionally sync CRM after authoritative state exists.

Do not implement checkout without explicit authorization.

## Phase 8: Premium assets and Agent Recruiter package

Future work:

- create faithful machine-readable method markdown;
- create setup docs for ChatGPT, Claude, and generic LLM;
- package Premium Guide through private delivery;
- make sure free Anteprima and Premium Guide have consistent wording around examples/cases.

Recommended editorial fix: replace "3 casi reali" with "3 casi applicativi" or equivalent where appropriate.

## Phase 9: Validation

Before enabling V2 publicly:

- run unit tests for rubric, scoring, gates, and data normalization;
- run prompt/schema tests with mock provider;
- run live OpenAI validation only when API credit and authorization are available;
- run browser E2E for analyze and create paths;
- verify sitemap/header/footer/home constraints;
- verify robots and `X-Robots-Tag`;
- verify no public Premium Guide asset exposure;
- verify no legacy `/annuncio-10x` change.

## Future local decision accelerator feasibility

Rizzo Flow is not a required part of Annunci 10x architecture. It is a possible local accelerator only for closed tasks and only after domain-specific benchmark validation.

Potential future benchmark candidates:

- `PRECHECK`: job ad / teaser / incomplete / invalid.
- Routing: which wizard area needs clarification.
- Sufficiency: data sufficient yes/no.
- Semantic filtering: which block is relevant for a future Context Capsule.
- Lead classification: recruiting problem / CRM routing.
- Simple guardrails: suspicious input / prompt-injection prefilter.
- Some 0-10 score checks only after specific benchmark validation.

Do not use a closed decision accelerator for:

- text generation;
- ad rewriting;
- free extraction;
- email;
- textual reports;
- Master generation;
- variants;
- complex reasoning.

Missing-evidence weakness must be treated as a first-class risk. `MISSING` vs `N/D` must not be delegated automatically to a local accelerator.

Future adoption rule:

1. Shadow benchmark on Annunci 10x fixtures.
2. Compare against primary LLM and deterministic rules.
3. Review missing-evidence behavior.
4. Approve a capability-specific GO before production use.

## Rollback principle

V2 should be additive until stable.

Avoid destructive migrations and avoid removing V1 docs/assets until explicit archival policy is approved.
