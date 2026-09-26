# Annunci 10x V2 canonical specification

Status: V2 specification plus isolated shadow-runtime building blocks. Not public runtime.

Canonical route: `/annunci-10x`

Legacy route, not part of this domain: `/annuncio-10x` is `NON TOCCARE`.

## Scope

This folder defines the V2 product, method, funnel, scoring semantics, UX, data, commercial, and migration contract for Annunci 10x.

It does not change UI, API routes, Supabase schema, checkout, email delivery, HighLevel, Vercel, AI Score, or the legacy `/annuncio-10x` prototype.

## Source hierarchy

The V2 editorial source is the pair of external PDFs supplied by the product owner:

- `Annunci_10x_Anteprima.pdf`
- `Annunci_10x_Guida_Premium.pdf`

Those PDFs are source material for this specification. They are not committed here, copied here, or redistributed by this repository.

The existing V1/V1.1 files under `docs/annunci-10x/guide/` remain historical artifacts. They are superseded as methodological source by the V2 PDFs, but must not be deleted or rewritten during this documentation phase.

## Canonical V2 principle

Annunci 10x V2 is based on this sequence:

1. Lavoro reale.
2. Persona necessaria.
3. Strategia.
4. Annuncio.
5. Verifica.

The operating principle is:

> Prima la realta del ruolo. Poi le parole.

The product must not sell volume guarantees. "10x" means quality and decision value, not a mathematical promise of ten times more CVs, candidates, or hires.

## Current implementation relationship

Current public runtime is still V1-oriented and remains valid until a future migration is explicitly implemented.

Fase 1B added an isolated TypeScript V2 scoring core for rubric definitions, per-check validation, deterministic aggregation, coverage, and band mapping.

Fase 1C added an isolated V2 provider contract and shadow runner:

- prompt version `annunci10x.evaluate.v2.3`;
- schema name `annunci10x_evaluate_v2`;
- structured TARGET vs CONTEXT input projection;
- one schema-repair retry;
- deterministic aggregation through `calculateAnnunci10xScoreV2()`;
- deterministic tests only, including `OpenAiAnnunci10xProvider` with fake fetch.

Fase 1D.1 clarifies that the V2 provider is a compact fast scoring pass, not the final customer-facing report writer. Evidence and missing arrays are bounded to two short items per check.

The V2 projection is boundary-aware: TARGET preserves legitimate ad/bundle evidence such as application email, phone, URL, named contact, role name, and company text, while technical secret keys are removed. CONTEXT is limited to `roleCard`, `roleProfile`, and `communicationStrategy` and strips lead PII, secrets, and commercial/payment metadata.

These additions are not wired to `/annunci-10x`, V1 `EVALUATE`, persistence, UI, API routes, or public product behavior. The V2.3 live pilot is documented separately as calibration evidence only, not production validation.

Important current files:

- `src/lib/annunci-10x/rubric.ts`
- `src/lib/annunci-10x/score.ts`
- `src/lib/annunci-10x/gates.ts`
- `src/lib/annunci-10x/strategy-rules.ts`
- `src/lib/annunci-10x/create-flow.ts`
- `src/lib/annunci-10x/commercial.ts`
- `src/components/annunci-10x/annunci-10x-client.tsx`
- `src/lib/annunci-10x/ai/prompts/evaluate.ts`

Isolated V2 scoring files:

- `src/lib/annunci-10x/types-v2.ts`
- `src/lib/annunci-10x/rubric-v2.ts`
- `src/lib/annunci-10x/score-v2.ts`
- `scripts/verify-annunci-10x-score-v2.mjs`

Isolated V2 provider contract files:

- `src/lib/annunci-10x/ai/prompts/evaluate-v2.ts`
- `src/lib/annunci-10x/ai/schemas-v2.ts`
- `src/lib/annunci-10x/ai/evaluate-v2.ts`
- `scripts/verify-annunci-10x-ai-v2.mjs`

The V2 docs identify future changes. They do not claim those changes are already implemented.

## Documents

- `decision-log.md`: decided, deferred, obsolete, and open product decisions.
- `product-contract-v2.md`: product boundaries and non-goals.
- `funnel-v2.md`: pain-led funnel and future analysis journey.
- `method-v2.md`: canonical V2 method.
- `guide-mapping-v2.md`: mapping from V2 guide questions and sheet areas to current runtime.
- `score-semantics-v2.md`: future score semantics and publication gate separation.
- `rubric-v2-anchors.md`: provider-agnostic 0-10 anchors for the 20 V2 controls.
- `calibration-fixtures-v2.md`: methodological calibration fixtures and monotonicity/stability expectations.
- `ux-contract-v2.md`: future UX constraints and public/private output rules.
- `data-contracts-v2.md`: conceptual data model and migration needs.
- `commercial-v2.md`: decided commercial architecture without checkout implementation.
- `migration-plan-v2.md`: safe migration plan from current V1 runtime.

## Safety rules

- Do not expose the Premium Guide through a public repo or public static route.
- Do not make `/annunci-10x` navigable from home, header, or footer until explicit authorization.
- Keep `/annunci-10x` unlisted, excluded from sitemap, and `noindex,nofollow` until explicit authorization changes that.
- Do not couple Annunci 10x V2 to AI Score implementation details.
- Do not silently fallback from OpenAI to mock. Mock is an explicit development/test provider only.
