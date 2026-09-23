# Annunci 10x product contract v1

Canonical route: `/annunci-10x`

Legacy route, not part of this product: `/annuncio-10x`

## Status

This document defines the local canonical product contract for Annunci 10x and records implementation status where needed.

Phase 1 was documentation only. Phase 3 added Supabase persistence migrations and a server-side persistence adapter. Phase 4 added the server-side AI runtime and prompt registry. Phase 5 implemented the unlisted product page and the `ANALYZE` path, tested with the explicit `MOCK` provider. Phase 6 implements `BUILD` / Crea da zero through user confirmation and the pre-payment commercial screen, tested with the explicit `MOCK` provider.

Current status:

- Product page: `IMPLEMENTED`.
- Analyze: `IMPLEMENTED`, `TESTED_WITH_MOCK`, `LIVE_AI_TEST_PENDING`.
- Create: `IMPLEMENTED_THROUGH_PRE_PAYMENT`, `TESTED_WITH_MOCK`, `LIVE_AI_TEST_PENDING`.
- Guide: `PRODUCT_DEFINED`, `PURCHASE_NOT_IMPLEMENTED`.
- Commercial: `PRE_PAYMENT_UI_IMPLEMENTED`, `PRICING_OPEN`, `PAYMENT_NOT_IMPLEMENTED`, `ENTITLEMENTS_NOT_IMPLEMENTED`.
- Generation: `RUNTIME_IMPLEMENTED`, `USER_FLOW_NOT_IMPLEMENTED`, `LIVE_AI_TEST_PENDING`.
- OpenAI: `PROVIDER_IMPLEMENTED`, `LIVE_VALIDATION_PENDING_API_CREDIT`.
- Supabase: `IMPLEMENTED`, `LIVE_PERSISTENCE_VERIFIED`.
- Route: `PRODUCTION_DEPLOYED`, `UNLISTED`, `NOINDEX_NOFOLLOW`.
- Legacy `/annuncio-10x`: `UNCHANGED`.

## Canonical baseline

- Repository: `HORYZON-ORG/horyzon-website`
- Branch: `main`
- Temporary canonical baseline before Phase 6: `169020f9b64f7da7d41a2954c9115d205d6d4408`
- Local work continues directly on `main` by explicit authorization.
- Do not reset local `main` behind this baseline.
- Do not create branches or pull requests for this phase.
- Do not push or claim deployment until verified separately.

## Product definition

Annunci 10x helps a company analyze, build, validate, and adapt a job ad from role facts, company context, candidate expectations, channel constraints, and publication readiness checks.

The product has three entry modes:

- `ANALYZE`: analyze an existing ad.
- `BUILD`: create an ad from zero through guided questions.
- `GUIDE`: buy or access the Annunci 10x Guide as a standalone product.

The product must not depend on the legacy `/annuncio-10x` prototype. The legacy prototype can inform risk awareness only; it is not an authorized dependency, source module, redirect target, or rename target.

## Route and visibility contract

The new product route is `/annunci-10x`.

During development it must be designed as:

- reachable by knowing `/annunci-10x`;
- unlisted;
- absent from header, footer, and home links;
- excluded from `sitemap.ts`;
- `noindex,nofollow` in page metadata;
- `X-Robots-Tag: noindex,nofollow` at the HTTP header layer;
- no redirect from or to `/annuncio-10x`;
- no change to public pages unless explicitly authorized.

Implementation note for a later phase:

- HTML robots should not reuse the current `pageMetadata({ noindex: true })` behavior as-is if it emits `follow`.
- `X-Robots-Tag` belongs in `next.config.ts` headers or an equivalent route-level response path.
- Sitemap exclusion is achieved by keeping `/annunci-10x` outside the generated sitemap source sets.

## Commercial context

Commercial behavior is driven by server-side entitlement and purchase state, never by client-only coupon input as the canonical mechanism.

Canonical product codes:

- `GUIDE`: the Annunci 10x Guide.
- `AD_GENERATION`: paid generation of the final Annunci 10x output.
- `GUIDE_PLUS_AD`: bundle that includes guide access plus ad generation.

Rules:

- A user who owns `GUIDE` must automatically receive the reserved offer on generation.
- Manual coupons are not the canonical entitlement mechanism.
- `GUIDE_PLUS_AD` must be supported as a bundle.
- The Guide must remain visible and purchasable standalone on the product page.
- Entitlements must be evaluated server-side before price presentation, purchase creation, and generation authorization.
- Client UI may display entitlement state, but cannot be the source of truth.

Open decisions:

- `OPEN DECISION`: final prices.
- `OPEN DECISION`: exact reserved offer value for users who own `GUIDE`.
- `OPEN DECISION`: payment provider.
- `OPEN DECISION`: checkout flow and post-payment webhook shape.
- `OPEN DECISION`: authentication model.
- `OPEN DECISION`: account/session ownership model across devices.
- `OPEN DECISION`: retention period for sessions, answers, AI operations, evaluations, and generated outputs.

## Payment sequence contract

The sequence must stay consistent across all documents:

- `ANALYZE` can run before payment.
- `BUILD` guided questions can run before payment.
- Full generation is gated by entitlement or purchase.
- `GUIDE` can be purchased standalone.
- `GUIDE_PLUS_AD` can grant both guide access and generation access.
- Final generated output is produced only after entitlement confirms access to generation.
- No document may require payment after final generation for the same output.

## Legacy boundary

The following legacy files are explicitly `NON TOCCARE` unless a future request authorizes changes:

- `src/app/annuncio-10x/page.tsx`
- `src/app/annuncio-10x/annuncio-10x.module.css`
- `src/components/job-ad-builder.tsx`

The new product must not import from `src/components/job-ad-builder.tsx` because it imports the legacy CSS module and carries prototype assumptions.

## Non-goals for foundations

Historical Phase 1 non-goals, superseded only where a later phase explicitly says so:

- No route implementation yet.
- No database migration yet. Superseded by Phase 3 for isolated Supabase `annunci10x_*` persistence only.
- No payment integration yet.
- No provider integration yet.
- No public navigation link yet.
- No sitemap change yet.
- No migration or reuse of `/annuncio-10x`.

## Phase 3 persistence status

Implemented scope:

- Additive Supabase migrations for `annunci10x_*` tables, indexes, RLS, service-role-only grants, and RPC helpers.
- Local server-only persistence adapter under `src/lib/annunci-10x/persistence/`.
- Deterministic local verifier for ownership, append-only snapshots, AI operation idempotency, output parent rules, row parsing, safe event metadata, and server-verified entitlement contracts.

Still not implemented:

- `/annunci-10x` route or UI.
- Public API routes or server actions.
- Payment checkout, webhook handling, or durable entitlement source.
- Authenticated account ownership or cross-device resume.
- Retention jobs or deletion workflow.
- SEO/header/footer/sitemap changes.

## Phase 4 AI runtime status

Implemented scope:

- Server-only provider abstraction under `src/lib/annunci-10x/ai/`.
- Dedicated OpenAI provider implementation for Annunci 10x.
- Deterministic mock provider for tests.
- Versioned prompt registry for the 11 authorized operations.
- Operation orchestration with persistence, idempotency, timeout, sanitized errors, usage metadata, and one schema-repair retry.
- Generate -> Validate -> one targeted Revise -> Validate cycle primitive.

Still not implemented:

- Public API route or server action using the runtime.
- UI for `/annunci-10x`.
- Live provider smoke test when `OPENAI_API_KEY` is unavailable.
- Payment, checkout, webhook, durable entitlement source, or pricing logic.
- Vercel deploy or env mutation.
- Supabase schema changes beyond Phase 3.
