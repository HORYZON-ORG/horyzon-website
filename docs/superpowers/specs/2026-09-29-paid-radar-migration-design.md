# Paid Radar d'Impresa Migration Design

**Date:** 2026-09-29
**Status:** Proposed for implementation review
**Owners:** Horyzon Website (public product), Horyzon Hub (internal operations)

## 1. Purpose

Move the customer-facing Radar d'Impresa journey from `hub.horyzon.it` to
`horyzon.it` and turn it into a paid Website product. The Website owns product
discovery, qualification, questionnaire, checkout, recovery and the unlocked
result. The Hub remains an internal console that observes every started journey,
its progress, commercial state and completed result.

The two applications use the existing shared Supabase project and the canonical
`hub.radar_assessments` record. The migration must not create a second Radar
foundation or copy customer data between stores.

## 2. Confirmed product decisions

- The Radar is a paid product.
- The public Website may collect the full questionnaire before payment, but it
  must not disclose the detailed result until a trusted entitlement exists.
- The exact public price and the eventual inclusion of a consultant debrief are
  deferred commercial decisions. Checkout remains fail-closed until a valid
  server-side Stripe Price ID and amount are configured.
- A discreet preview control opens a PIN prompt. PIN `789987` unlocks the same
  result presentation as a paid customer for internal demonstrations.
- Preview access never creates a purchase, payment receipt or `PAID` state.
- Every started session and its latest answered step must be visible in Hub,
  including abandoned and unpaid journeys.
- The browser keeps a recovery copy of non-PII answers and progress so an
  accidental refresh does not lose work. Supabase remains authoritative.

## 3. Ownership boundaries

### Website

The Website owns:

- `/radar`, the canonical commercial page;
- creation and recovery of public Radar sessions;
- the qualification form and 30-step questionnaire;
- progressive autosave and offline/refresh recovery;
- the payment gate and Stripe Checkout creation;
- payment-processing and unlocked-result states;
- the internal PIN preview interaction;
- public server routes that mediate every database operation.

The browser never receives a Supabase service-role key, Stripe secret key,
webhook secret, raw PIN or database privilege.

### Hub

The Hub owns:

- the internal Radar pipeline;
- progress, abandonment and payment-status visibility;
- assessment assignment and company linkage;
- completed answers, scores, history and consultant debrief;
- operational filters and follow-up.

The Hub no longer hosts customer-facing Radar pages. After the Website cutover,
the old public Hub routes redirect to the canonical Website entry or the mapped
Website session URL. Internal administrative routes remain in Hub.

## 4. Public journey

1. The customer opens `/radar` and sees the product proposition and a clear
   paid-product disclosure. The price appears only when an active catalog entry
   exists.
2. Starting creates a server-owned session and an opaque owner secret. The raw
   secret is stored only in an encrypted, secure, HTTP-only, same-site cookie;
   Supabase stores its SHA-256 verifier.
3. Qualification data is persisted server-side. PII is never written to browser
   recovery storage.
4. Each answer is persisted on explicit Next/Back navigation and through a
   short debounced autosave. The response records `current_step`,
   `answered_count`, `progress_percent` and `last_activity_at`.
5. The browser stores a versioned recovery envelope containing session ID,
   questionnaire version, current step, non-PII answers and last local update.
6. On resume, the server version wins. Unsynced local changes are replayed only
   when their expected server revision still matches; otherwise the customer is
   shown the server state and warned that a newer version already exists.
7. Completing the questionnaire computes and stores the result server-side but
   returns only a payment-gate projection. Detailed scores, chart geometry,
   interpretation and report stay withheld.
8. Checkout is created server-side from the catalog. Browser-supplied amount,
   currency, Price ID, email, redirect or entitlement values are rejected.
9. Stripe webhook reconciliation grants the paid entitlement. The success page
   only polls trusted status and cannot grant access itself.
10. A paid or preview entitlement unlocks the same result component. Its visible
    origin remains distinguishable internally for audit.

## 5. Preview PIN

The discreet preview control is present on the payment gate. It is intentionally
low-prominence, not a security boundary. Security comes from server validation.

- The submitted PIN is sent over HTTPS to a rate-limited server route.
- The expected value is read from `RADAR_PREVIEW_PIN`; it is never embedded in a
  client bundle or database row.
- Local development documentation may state that the approved preview value is
  `789987`. No `.env` file or production secret is committed.
- Verification uses a constant-time comparison.
- Five failed attempts per session and IP window trigger a temporary lock.
- Success creates a short-lived, session-scoped, HTTP-only preview grant.
- Preview unlock is recorded as `PREVIEW_GRANTED` with timestamp and session,
  without storing the submitted PIN.
- Preview cannot mint a Stripe entitlement, alter purchase state or be reused
  for a different assessment.

## 6. Persistence model

All structural changes are additive, versioned migrations. Existing Radar rows
remain readable.

### `hub.radar_assessments`

Add or normalize fields for:

- questionnaire and scoring version;
- journey status: `STARTED`, `IN_PROGRESS`, `PAYMENT_REQUIRED`, `PAID`,
  `COMPLETED`, `ABANDONED`, `EXPIRED`;
- current step, answered count, progress percentage and revision;
- first/last activity, payment-gate, completion and expiry timestamps;
- owner-secret verifier;
- result lock state and source (`PURCHASE` or `PREVIEW`).

The existing `risposte` JSONB remains the canonical answer payload for this
increment. Updates merge validated answer keys and use optimistic revision
checks; clients cannot replace metadata or computed fields.

### Commerce tables in `hub`

Add Radar-specific tables rather than reusing Annunci 10x purchases:

- `hub.radar_purchases`: expected catalog identity, amount, currency, Stripe
  references and lifecycle state;
- `hub.radar_entitlement_grants`: append-only paid result grants linked to one
  purchase and assessment;
- `hub.radar_stripe_events`: idempotent webhook receipt and processing ledger;
- `hub.radar_access_events`: append-only paid/preview access audit without PIN,
  secrets or questionnaire content.

No `anon` or broad `authenticated` grants are added. Website access is
server-only through narrowly scoped operations. Internal Hub access retains the
existing superadmin authorization boundary.

## 7. Stripe contract

The implementation reuses the proven Annunci 10x architecture but keeps a
separate Radar catalog and entitlement namespace.

- API: Stripe Checkout Sessions, one-time payment.
- Product name: `Radar d'Impresa Horyzon`.
- Offer code: `RADAR_IMPRESA_REPORT`.
- Capability: `RADAR_RESULT_ACCESS` quantity 1.
- Currency: EUR.
- Amount: server configuration tied to the Stripe Price; checkout is disabled
  until the commercial price is approved and the Price ID is configured.
- Product creation is authorized in a Stripe sandbox. Live catalog creation and
  production activation require a separate explicit go-live checkpoint.
- Checkout idempotency is keyed by purchase ID.
- Metadata contains only internal opaque IDs and offer code.
- Fulfilment accepts `checkout.session.completed` and
  `checkout.session.async_payment_succeeded` only when payment is confirmed.
- Expiration, failure and refund events reconcile purchase/access state.
- Webhook signatures are verified against the raw request body.
- Duplicate and out-of-order events are safe and auditable.
- The webhook remains active when new checkout creation is disabled.

Environment contract:

- `STRIPE_SECRET_KEY` (server only; restricted key preferred);
- `STRIPE_WEBHOOK_SECRET` (server only);
- `RADAR_PUBLIC_BASE_URL`;
- `RADAR_STRIPE_PRICE_REPORT`;
- `RADAR_CHECKOUT_ENABLED=0|1`;
- `RADAR_PREVIEW_ENABLED=0|1`;
- `RADAR_PREVIEW_PIN` (server only).

No environment value is changed in Vercel as part of code implementation.
Activation documentation lists the exact values that operators must configure.

## 8. Server interfaces

Website route handlers provide:

- create session;
- read/resume owned session;
- save one validated answer with expected revision;
- complete questionnaire and return locked projection;
- create Checkout Session;
- receive Stripe webhooks;
- read entitlement/payment status;
- validate preview PIN;
- read the unlocked result.

Every public response is projected explicitly. Raw assessment rows, contact
fields, purchase internals, secret hashes and Stripe objects are never returned.
Mutation routes apply schema validation, ownership verification, rate limits and
idempotency where relevant.

## 9. Hub experience

The existing Radar administration view gains:

- journey and payment status chips;
- progress bar and `answered_count / total_steps`;
- current section and last activity;
- filters for in progress, abandoned, awaiting payment, paid and completed;
- distinction between purchased and preview-unlocked results;
- direct access to saved partial answers for follow-up;
- no ability to infer or display the preview PIN.

An assessment becomes `ABANDONED` through a derived inactivity rule, not a
destructive rewrite. A returning customer can resume an unexpired session and
move it back to `IN_PROGRESS`.

## 10. Local recovery and privacy

The recovery key is namespaced by opaque assessment ID and questionnaire
version. The payload excludes name, email, phone, company name, Stripe state,
entitlements, computed scores and secrets. It expires automatically after the
server session expires and is cleared after successful synchronization plus
result unlock.

If browser storage is unavailable, the server journey continues normally. If
the network is unavailable, answers remain locally queued with a visible
`non ancora sincronizzato` status. The customer cannot reach checkout until all
answers are confirmed by the server.

## 11. Failure and abuse handling

- Invalid, expired or foreign session: generic recovery error without record
  disclosure.
- Autosave conflict: retain the server version and offer a safe retry of the
  unsynced answer.
- Checkout disabled or misconfigured: no Stripe call; preserve the completed
  assessment and show a recoverable unavailable state.
- Webhook delay: show payment processing and poll; do not unlock from URL
  parameters.
- Duplicate checkout request: return/reuse the pending purchase where safe.
- Duplicate webhook: acknowledge without duplicate grants.
- Refund: revoke paid entitlement while preserving purchase and audit history.
- PIN brute force: rate limit, temporary lock and audit failed attempts without
  storing the submitted value.
- Direct Supabase calls from anonymous clients: no grants and no permissive RLS
  policies.

## 12. Cutover and rollback

The release is staged and fail-closed:

1. Ship schema migration files, server adapters and tests without applying the
   production migration.
2. Ship Website journey behind disabled commerce and preview flags.
3. Ship Hub progress visibility against the additive contract.
4. Apply the migration only with separate explicit authorization.
5. Create and verify the Stripe sandbox product and price mapping after Stripe
   authentication is available.
6. Configure non-secret and secret environment values only with separate
   explicit authorization.
7. Deploy only with separate explicit authorization.
8. Run a controlled sandbox purchase, webhook replay and preview-PIN canary.
9. Enable public checkout only after price, legal terms, refunds, privacy copy,
   support and fiscal handling are approved.
10. Redirect public Hub Radar traffic only after Website runtime verification.

Rollback disables new checkout and preview grants while continuing to process
webhooks already issued. It does not delete assessments, purchases, grants or
events. The Hub remains able to inspect all preserved journeys.

## 13. Verification and acceptance

Implementation is accepted only when automated tests demonstrate:

- a started Radar appears in Hub before its first answer;
- each answer advances server progress and survives refresh;
- an interrupted session resumes from server and local recovery data safely;
- PII and secrets never enter browser recovery storage;
- an unpaid customer cannot retrieve detailed result fields;
- URL parameters and browser payloads cannot forge payment or entitlement;
- Stripe webhook signature and idempotency protections work;
- confirmed sandbox payment grants exactly one paid entitlement;
- PIN `789987` unlocks only the current session preview through server-side
  verification;
- invalid PIN attempts rate-limit and never disclose the expected value;
- preview access does not create a purchase or paid state;
- Hub distinguishes partial, unpaid, paid, completed and preview journeys;
- old public Hub routes redirect only after Website cutover is ready;
- Website and Hub test, typecheck, lint and build commands complete with any
  unrelated baseline failures reported separately.

Production database migration, Vercel environment mutation, deployment, live
Stripe catalog creation and live payment are not implicitly authorized by this
specification.
