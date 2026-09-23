# Annunci 10x UX contract v1

Canonical route: `/annunci-10x`

Legacy route, not part of this UX: `/annuncio-10x` is `NON TOCCARE`.

This document defines the user experience contract and records the implemented UI status.

Current UI status:

- Product page: implemented on `/annunci-10x`.
- Analyze flow: implemented and tested with `ANNUNCI10X_AI_PROVIDER=MOCK`; OpenAI live validation remains pending API credit.
- Build / Crea da zero: implemented through user confirmation and the pre-payment commercial screen; checkout and final generation are not implemented.
- Guide: visible as product option, purchase not implemented.
- Commercial architecture: implemented as a server-side catalog plus deterministic offer engine. Offers are disabled, price/discount remain `OPEN_DECISION`, and browser state is never authoritative for entitlements.
- Premium generation: domain pipeline and persisted output rendering are implemented with `MOCK` test coverage. Public generation remains locked because checkout and durable entitlement are not implemented.

## Global UX principles

- The product page is reachable by direct URL but unlisted during development.
- No header, footer, or home link is added during development.
- No page should imply that `/annuncio-10x` is the same product.
- Loading states map to real operations.
- Back and edit must preserve session state.
- Mobile is first-class.
- Accessibility is required for forms, errors, progress, and generated output.
- The UI must distinguish score from publication status.
- The UI must distinguish confirmed facts from inferred or missing facts.

## S - Product page

The first page presents Annunci 10x and three ways to use it:

1. `Analizza gratis`
2. `Crea da zero`
3. `Guida Annunci 10x`

The Guide must be visible and purchasable autonomously.

Commercial display rules:

- If `entitlements.guide=true`, show the reserved generation offer automatically.
- Do not ask the user to manually enter a coupon as the canonical path.
- If `GUIDE_PLUS_AD` is available, show it as a bundle option.
- Prices and discount values are `OPEN DECISION` until set server-side.
- The Analyze conversion area and the Create commercial screen consume the same server-side offer contract.
- `CREATE` must not show an early generation paywall while state is `COLLECTING`.

Route visibility rules:

- noindex,nofollow;
- `X-Robots-Tag: noindex,nofollow`;
- excluded from sitemap;
- no public navigation links.

## A - Analyze flow

Sequence:

1. Input.
2. Pre-check.
3. Analysis.
4. Score/interval plus coverage.
5. Strengths.
6. Three priorities.
7. Clarifications.
8. Full diagnosis.
9. Offers.

Input:

- paste existing ad;
- optional role/company hints if needed;
- explicit notice that pasted text is treated as user content, not instructions.

Pre-check:

- validates that the text is likely a job ad or usable brief;
- blocks unrelated or insufficient input;
- does not create a final score.

Analysis:

- extracts facts;
- evaluates the original ad as `EvaluationTarget.ORIGINAL_AD`;
- computes deterministic score and coverage;
- returns `N/D` where needed.

Score display:

- show value or interval when coverage requires uncertainty;
- show coverage separately;
- do not show fake precision.

Clarifications:

- ask only high-value questions;
- allow skip when not blocking;
- mark answers as raw answers plus normalized facts.

Diagnosis:

- includes strengths;
- includes three priorities;
- includes claim and missing information risks;
- can lead to generation offer.

Offers:

- guide standalone;
- generation;
- bundle where supported;
- reserved generation offer when `entitlements.guide=true`.
- disabled purchase controls while `purchaseEnabled=false`.

Comparison:

- Analyze path can show comparison between original and generated output after generation.

## B - Build flow

Sequence:

1. Introduction.
2. Seven macro-steps.
3. Adaptive questions.
4. Channel/application preferences.
5. Scheda 10x.
6. Synthetic strategy.
7. Edit.
8. Confirmation.
9. Pre-payment commercial screen.
10. Payment, not implemented in this phase.
11. Generation, not implemented in this phase.

Seven macro-steps:

1. `ROLE_CONTEXT`.
2. `PRIMARY_CONTRIBUTION`.
3. `WORK_REALITY`.
4. `REQUIREMENTS`.
5. `ATTRACTION`.
6. `OFFER`.
7. `CHANNEL_APPLICATION`.

Adaptive questions:

- depend on missing facts and risk;
- avoid repeating confirmed facts;
- distinguish required from optional questions.

Scheda 10x:

- summarizes normalized facts;
- shows provenance where useful;
- flags inferred facts as needing confirmation.

Synthetic strategy:

- explains candidate angle;
- challenge/routine balance;
- qualification and technicality;
- attractiveness gaps.

Edit and confirmation:

- user can go back and edit facts;
- user confirms before purchase/generation;
- unconfirmed inferred facts remain excluded from final copy.

Pre-payment:

- appears only after user confirmation;
- shows `OPEN_DECISION` price/discount state;
- keeps checkout disabled;
- does not grant entitlement;
- does not start final ad generation.
- renders offers calculated server-side for the current journey state.

Payment:

- happens after confirmation and offers;
- before generation;
- skipped only when server-side entitlement already grants generation.
- not implemented in Phase 6 or Phase 7.

Generation:

- starts only after entitlement is confirmed server-side.
- implemented as a server-side Phase 8 pipeline.
- not publicly unlockable from the browser until a future checkout/entitlement phase.

No fake before/after score:

- Build path must not show a false "before" score when no original ad exists.
- It may show projected readiness or missing-info coverage only if clearly labeled and deterministic.

## O - Output flow

Sequence:

1. Master.
2. Score.
3. Publication status.
4. Rationale.
5. Channel variant.
6. Edit.
7. Comparison layer only in Analyze path.

Master:

- source of truth;
- complete ad anatomy;
- no unconfirmed inferred facts.

Score:

- deterministic;
- tied to `EvaluationTarget.MASTER`;
- shown separately from gate.

Publication status:

- `READY`;
- `READY_WITH_WARNINGS`;
- `NEEDS_VERIFICATION`;
- `BLOCKED`.

Rationale:

- explain the main reasons for score and gate;
- cite missing or unsupported claims where relevant.

Channel variant:

- derived from Master;
- cannot introduce new facts;
- can be selected, regenerated for another channel, or edited.

Edit:

- classify edit intent;
- if edit adds facts, require confirmation;
- run validation again after revision.
- editorial edits can produce a new validated output version when server-side generation authorization exists;
- factual or strategic edits update the source of truth and require regeneration;
- unsupported claims require confirmation and do not modify output.

Comparison layer:

- only in Analyze path;
- compares immutable `OriginalAd` to Master output;
- not shown as a fake improvement in Build path.

## Resume session

Resume must restore:

- session state;
- raw answers;
- normalized facts;
- current snapshot;
- commercial context;
- completed AI operations;
- generated output if available.

Open decisions:

- `OPEN DECISION`: authentication and cross-device resume.
- `OPEN DECISION`: retention period.
- `OPEN DECISION`: resume token policy.

## Back and edit

Back/edit behavior:

- user can return to previous macro-step;
- edits create new snapshots;
- previous snapshots remain available for audit;
- affected strategy/evaluation/output becomes stale and must be recomputed where needed.

## Loading states

Loading states map to real operations:

- pre-check running;
- extraction running;
- analysis running;
- clarification planning;
- strategy building;
- entitlement checking;
- generation running;
- validation running;
- channel adaptation running.

No generic fake progress should imply work that is not happening.

## Error states

Required states:

- invalid input;
- insufficient input;
- schema invalid after one retry;
- payment required;
- entitlement missing;
- generation blocked;
- needs verification;
- rate limited;
- provider unavailable;
- internal error.

Errors should explain the next available action.

## Mobile

Mobile requirements:

- single-column forms;
- sticky progress only if it does not cover controls;
- tappable controls;
- generated output readable without horizontal scroll;
- long text areas with clear labels;
- summary cards before dense sections.

## Accessibility

Accessibility requirements:

- semantic headings;
- labels for every input;
- field-level errors;
- `aria-live` for operation status;
- keyboard-accessible tabs or segmented controls;
- focus management after generation and errors;
- contrast sufficient for warnings and blockers;
- no information conveyed by color alone.

## Entitlement UI behavior

When `entitlements.guide=true`:

- show Guide as already owned or accessible;
- show generation reserved offer automatically;
- do not require coupon entry;
- keep `GUIDE_PLUS_AD` logic from double-charging for guide access;
- still require server-side entitlement check before generation.

When `entitlements.adGeneration=true`:

- skip payment for generation;
- move from confirmation to generation after explicit user action.

When no entitlement exists:

- show Guide standalone;
- show generation offer;
- show bundle if enabled.

Phase 8 UI implementation notes:

- The page does not add a public "generate now" unlock.
- If a server-authorized premium output already exists for the session, the UI can resume it, show Master, score, gate, rationale, checklist, comparison for Analyze, channel variant, claim check, and copy controls.
- The public `generate` and `edit` API routes return controlled authorization errors until production has a real server-side entitlement source.
