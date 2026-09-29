# Paid Radar d'Impresa Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the public Radar journey to the Website, preserve every partial response in the shared database for Hub visibility, and gate the detailed result behind a Stripe purchase or audited server-side preview PIN.

**Architecture:** The Next.js Website owns the public session, questionnaire, recovery, checkout and result APIs. Additive `hub` schema objects persist progress, purchases, Stripe events and access grants; the TanStack Hub reads the same records as an authenticated internal console. Checkout and preview remain fail-closed behind server configuration, while legacy Hub public routes redirect only after the Website flow is verified.

**Tech Stack:** Next.js 16.3.5, React 19, TypeScript 5, Supabase/PostgreSQL, Stripe Node SDK 22.6.2, TanStack Start, Bun test, ESLint.

**Spec:** `docs/superpowers/specs/2026-09-29-paid-radar-migration-design.md`

## Global Constraints

- Work directly on canonical `main`; do not create branches or pull requests and never force-push.
- Before each repository's first edit, run full fetch, `pull --ff-only`, clean-tree and ancestry checks.
- Website owns public Radar; Hub contains no new customer-facing behavior.
- Use the existing shared Supabase project and canonical `hub.radar_assessments`; do not create a Supabase project or duplicate the Radar foundation.
- Database changes are additive migration files only. Do not apply production migrations or mutate real data without separate authorization.
- Do not modify Vercel environment variables or deploy without separate authorization.
- Never expose Supabase service-role credentials, Stripe secrets, webhook secrets or the preview PIN to browser code.
- `789987` is the approved preview value, supplied only through server environment configuration; preview never produces `PAID` state.
- Supabase is authoritative. Browser storage contains only versioned non-PII answers and progress.
- Checkout remains disabled until an approved Stripe Price ID and amount exist.
- Use Stripe Checkout Sessions, dynamic payment methods, webhook signature verification and idempotent fulfilment.
- Run relevant tests, typecheck, lint and build after code changes in each repository.

## Review Focus

1. Two tabs save different answers against the same revision: reject the stale write with `409` and preserve the newer server version (Task 3).
2. Local recovery data belongs to an expired or different questionnaire version: discard it without sending stale answers (Task 5).
3. Stripe delivers duplicate or out-of-order success/refund events: create at most one grant and end in the event-authoritative state (Task 6).
4. The preview PIN is brute-forced or replayed for another assessment: rate-limit it and scope the grant to one session (Task 4).
5. A customer reaches the success URL before the webhook: show processing and withhold detailed scores until trusted entitlement status changes (Task 6).

---

### Task 1: Establish the Website Radar domain and regression contract

**Files:**
- Create: `src/lib/radar/types.ts`
- Create: `src/lib/radar/domain.ts`
- Create: `src/lib/radar/public-projection.ts`
- Create: `scripts/verify-radar-domain.mjs`
- Modify: `package.json`
- Source reference: `../horyzon-hub/src/lib/radar.ts`

**Interfaces:**
- Produces `RadarAnswers`, `RadarScores`, `RadarStep`, `radarSteps()`, `calculateRadarScores()`, `lockedRadarProjection()` and `unlockedRadarProjection()`.
- Later tasks consume these exact exports; the browser never receives `RadarScores` from a locked projection.

- [ ] **Step 1: Write the failing domain verifier**

```js
import assert from 'node:assert/strict';
import { calculateRadarScores, radarSteps } from '../src/lib/radar/domain.ts';
import { lockedRadarProjection } from '../src/lib/radar/public-projection.ts';

assert.equal(radarSteps().length, 30);
const locked = lockedRadarProjection({ status: 'PAYMENT_REQUIRED', answeredCount: 30 });
assert.equal('scores' in locked, false);
assert.deepEqual(calculateRadarScores({}), { amministrazione: 0, produzione: 0, commerciale: 0, marketing: 0, 'risorse-umane': 0, globale: 0 });
```

- [ ] **Step 2: Run the verifier and observe the missing-module failure**

Run: `node --no-warnings --experimental-strip-types scripts/verify-radar-domain.mjs`

Expected: FAIL because `src/lib/radar/domain.ts` does not exist.

- [ ] **Step 3: Port the canonical 30-step definitions and scoring into focused modules**

```ts
export type RadarJourneyStatus = 'STARTED' | 'IN_PROGRESS' | 'PAYMENT_REQUIRED' | 'PAID' | 'COMPLETED' | 'ABANDONED' | 'EXPIRED';
export interface LockedRadarProjection { status: RadarJourneyStatus; answeredCount: number; resultLocked: true }
export function lockedRadarProjection(input: Omit<LockedRadarProjection, 'resultLocked'>): LockedRadarProjection {
  return { ...input, resultLocked: true };
}
```

Copy the existing question copy, keys and scoring rules exactly, correct stale public references to 29 questions, and keep sector interpretation out of the browser projection.

- [ ] **Step 4: Register and run the focused verifier**

Add `"test:radar": "node --no-warnings --experimental-strip-types scripts/verify-radar-domain.mjs"` to `package.json`.

Run: `npm run test:radar && npm run typecheck`

Expected: PASS with 30 steps and no locked score fields.

- [ ] **Step 5: Commit the Website domain**

```powershell
git add package.json scripts/verify-radar-domain.mjs src/lib/radar
git commit -m "feat: add Website Radar domain contract"
```

### Task 2: Add the additive Radar persistence and commerce migration

**Files:**
- Create via CLI: the exact file printed by `supabase migration new paid_radar_foundation`
- Create: `scripts/verify-paid-radar-migration.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces additive `hub.radar_purchases`, `hub.radar_entitlement_grants`, `hub.radar_stripe_events`, `hub.radar_access_events` and narrowly scoped service-role RPCs.
- Extends `hub.radar_assessments` with progress, revision, ownership verifier and commercial fields.

- [ ] **Step 1: Write a failing SQL contract verifier**

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const sql = await readFile(process.argv[2], 'utf8');
for (const fragment of ['hub.radar_purchases', 'hub.radar_entitlement_grants', 'hub.radar_stripe_events', 'hub.radar_access_events', 'owner_secret_hash', 'progress_percent', 'revoke all']) assert(sql.toLowerCase().includes(fragment));
assert(!/grant\s+.+\s+to\s+anon/i.test(sql));
```

- [ ] **Step 2: Generate the migration shell and verify RED**

Run: `supabase migration new paid_radar_foundation`

Run: `$radarMigration = Get-ChildItem supabase/migrations/*_paid_radar_foundation.sql | Sort-Object LastWriteTime -Descending | Select-Object -First 1; node scripts/verify-paid-radar-migration.mjs $radarMigration.FullName`

Expected: FAIL because the generated migration is empty. Use the exact path printed by the CLI in the subsequent command; do not invent its timestamp.

- [ ] **Step 3: Implement schema, constraints, indexes and RPCs**

The migration must include validated enums/check constraints, optimistic revision updates, one pending purchase per assessment/offer, unique Stripe identifiers, idempotent event claiming, paid-grant creation, refund revocation, and superadmin-only Hub reads. Every `SECURITY DEFINER` function must set `search_path`, revoke default execution and grant only to `service_role`.

```sql
alter table hub.radar_assessments
  add column if not exists journey_status text not null default 'STARTED',
  add column if not exists current_step integer not null default 0,
  add column if not exists answered_count integer not null default 0,
  add column if not exists progress_percent integer not null default 0,
  add column if not exists revision integer not null default 0,
  add column if not exists owner_secret_hash text,
  add column if not exists last_activity_at timestamptz not null default now(),
  add column if not exists expires_at timestamptz;
```

- [ ] **Step 4: Verify migration text and local migration ordering without applying production**

Run: `$radarMigration = Get-ChildItem supabase/migrations/*_paid_radar_foundation.sql | Sort-Object LastWriteTime -Descending | Select-Object -First 1; node scripts/verify-paid-radar-migration.mjs $radarMigration.FullName`

Run: `supabase migration list --local`

Expected: verifier PASS; migration appears last locally. Do not execute it against the remote project.

- [ ] **Step 5: Commit the migration foundation**

```powershell
git add package.json scripts/verify-paid-radar-migration.mjs supabase/migrations
git commit -m "feat: add paid Radar persistence foundation"
```

### Task 3: Implement server-only persistence and conflict-safe autosave

**Files:**
- Create: `src/lib/radar/persistence/types.ts`
- Create: `src/lib/radar/persistence/security.ts`
- Create: `src/lib/radar/persistence/adapter.ts`
- Create: `scripts/verify-radar-persistence.mjs`
- Modify: `src/lib/radar/index.ts`

**Interfaces:**
- Produces `RadarPersistence`, `createRadarPersistence()`, `createMemoryRadarPersistence()`, `createOwnerSecret()`, `hashOwnerSecret()` and `RadarRevisionConflictError`.
- `saveAnswer({ assessmentId, ownerSecretHash, answerKey, value, expectedRevision })` returns the new revision and progress.

- [ ] **Step 1: Write failing persistence tests for ownership, progress and revision conflicts**

```js
const store = createMemoryRadarPersistence();
const session = await store.createAssessment(seedQualification);
const saved = await store.saveAnswer({ assessmentId: session.id, ownerSecretHash: session.ownerSecretHash, answerKey: 'amministrazione#1', value: 3, expectedRevision: 0 });
assert.equal(saved.revision, 1);
assert.equal(saved.answeredCount, 1);
await assert.rejects(() => store.saveAnswer({ assessmentId: session.id, ownerSecretHash: session.ownerSecretHash, answerKey: 'produzione#1', value: 2, expectedRevision: 0 }), RadarRevisionConflictError);
```

- [ ] **Step 2: Run RED**

Run: `node --no-warnings --experimental-strip-types scripts/verify-radar-persistence.mjs`

Expected: FAIL because the persistence adapter is missing.

- [ ] **Step 3: Implement memory and Supabase adapters**

Use SHA-256 owner-secret verification, explicit row parsing, answer-key allowlisting, optimistic revision matching and server-computed progress. Reject attempts to write `_storico`, scores, payment fields or metadata through `saveAnswer`.

```ts
export interface RadarPersistence {
  createAssessment(input: RadarQualificationInput): Promise<RadarOwnedSession>;
  resumeAssessment(input: RadarOwnership): Promise<RadarResumeProjection>;
  saveAnswer(input: SaveRadarAnswerInput): Promise<RadarProgressProjection>;
  completeAssessment(input: CompleteRadarInput): Promise<RadarLockedProjection>;
}
```

- [ ] **Step 4: Verify GREEN including stale-tab coverage**

Run: `node --no-warnings --experimental-strip-types scripts/verify-radar-persistence.mjs`

Expected: PASS, including invalid owner, invalid key and stale revision cases.

- [ ] **Step 5: Commit persistence**

```powershell
git add scripts/verify-radar-persistence.mjs src/lib/radar
git commit -m "feat: persist Radar progress server-side"
```

### Task 4: Add owned-session APIs and audited preview entitlement

**Files:**
- Create: `src/app/api/radar/_shared.ts`
- Create: `src/app/api/radar/session/route.ts`
- Create: `src/app/api/radar/session/resume/route.ts`
- Create: `src/app/api/radar/answer/route.ts`
- Create: `src/app/api/radar/complete/route.ts`
- Create: `src/app/api/radar/preview/route.ts`
- Create: `src/app/api/radar/result/route.ts`
- Create: `src/lib/radar/preview.ts`
- Create: `scripts/verify-radar-api.mjs`

**Interfaces:**
- Produces the HTTP contract consumed by the Website client.
- Cookie name: `horyzon_radar_session`; cookie payload contains assessment ID plus raw owner secret and is encrypted/signed server-side.
- `POST /api/radar/preview` accepts `{ pin: string }` and returns only `{ unlocked: true, source: 'PREVIEW' }` after server validation.

- [ ] **Step 1: Write failing API and preview tests**

```js
assert.equal(timingSafePinMatch('789987', '789987'), true);
assert.equal(timingSafePinMatch('789986', '789987'), false);
const grant = await service.grantPreview({ assessmentId: first.id, pin: '789987', ipKey: 'test-ip' });
assert.equal(grant.source, 'PREVIEW');
await assert.rejects(() => service.readUnlockedResult({ assessmentId: second.id, previewGrant: grant.token }));
```

- [ ] **Step 2: Run RED**

Run: `node --no-warnings --experimental-strip-types scripts/verify-radar-api.mjs`

Expected: FAIL because preview/session services do not exist.

- [ ] **Step 3: Implement handlers and fail-closed preview service**

Use Next.js 16 async cookie APIs, Zod-style explicit validation without adding a new dependency, constant-time comparison, five-attempt lock window, short-lived HTTP-only preview cookie and append-only access events. Return `409` for revision conflicts, `423` for locked preview attempts and `402` for a valid session without entitlement.

```ts
export const RADAR_SESSION_COOKIE = 'horyzon_radar_session';
export const RADAR_PREVIEW_COOKIE = 'horyzon_radar_preview';
export type RadarAccessSource = 'PURCHASE' | 'PREVIEW';
```

- [ ] **Step 4: Verify handlers and inspect for leaked server configuration**

Run: `node --no-warnings --experimental-strip-types scripts/verify-radar-api.mjs`

Run: `rg -n "RADAR_PREVIEW_PIN|STRIPE_SECRET_KEY|SUPABASE_SERVICE_ROLE" src/app src/components`

Expected: tests PASS; secret names appear only in server modules and never in client components.

- [ ] **Step 5: Commit APIs**

```powershell
git add scripts/verify-radar-api.mjs src/app/api/radar src/lib/radar
git commit -m "feat: add secure Radar session APIs"
```

### Task 5: Build the questionnaire, recovery cache and payment gate

**Files:**
- Create: `src/components/radar/radar-client.tsx`
- Create: `src/components/radar/radar-questionnaire.tsx`
- Create: `src/components/radar/radar-payment-gate.tsx`
- Create: `src/components/radar/radar-result.tsx`
- Create: `src/components/radar/radar-recovery.ts`
- Create: `src/components/radar/radar.module.css`
- Create: `scripts/verify-radar-client.mjs`
- Modify: `src/app/radar/page.tsx`
- Modify: `src/app/radar/radar-commercial.css`

**Interfaces:**
- Consumes Task 1 projections and Task 4 APIs.
- `RadarRecoveryEnvelope` contains only version, assessment ID, revision, step, answers and update timestamp.

- [ ] **Step 1: Write failing recovery and UI contract tests**

```js
const envelope = createRecoveryEnvelope({ assessmentId: 'opaque-id', revision: 2, currentStep: 4, answers: { 'amministrazione#1': 3 }, questionnaireVersion: 'radar-v1' });
assert.equal(JSON.stringify(envelope).includes('email'), false);
assert.equal(shouldRestoreRecovery(envelope, { assessmentId: 'opaque-id', questionnaireVersion: 'radar-v2' }), false);
assert(source.includes('non ancora sincronizzato'));
assert(source.includes('Sblocca anteprima'));
```

- [ ] **Step 2: Run RED**

Run: `node --no-warnings --experimental-strip-types scripts/verify-radar-client.mjs`

Expected: FAIL because recovery/UI modules do not exist.

- [ ] **Step 3: Implement the client state machine and recovery behavior**

Keep the existing commercial page sections, change every CTA from the Hub URL to the embedded/start flow, render qualification, 30 steps, sync state, locked result, discreet PIN dialog and unlocked result. Persist non-PII recovery after each local answer; clear mismatched or expired envelopes; block checkout while a write is unsynced.

```ts
export interface RadarRecoveryEnvelope {
  version: 1;
  questionnaireVersion: string;
  assessmentId: string;
  revision: number;
  currentStep: number;
  answers: Record<string, number | string>;
  updatedAt: string;
}
```

- [ ] **Step 4: Run client verification, typecheck and responsive browser smoke test**

Run: `node --no-warnings --experimental-strip-types scripts/verify-radar-client.mjs && npm run typecheck`

Browser acceptance: desktop and 390x844; refresh midway restores step; offline answer shows unsynced; no horizontal overflow; keyboard focus reaches the preview control and dialog.

- [ ] **Step 5: Commit the Website journey**

```powershell
git add scripts/verify-radar-client.mjs src/app/radar src/components/radar
git commit -m "feat: move Radar journey into Website"
```

### Task 6: Implement Stripe Checkout, webhook reconciliation and paid result access

**Files:**
- Create: `src/lib/radar/payments/commerce.ts`
- Create: `src/lib/radar/payments/stripe.ts`
- Create: `src/app/api/radar/checkout/route.ts`
- Create: `src/app/api/radar/stripe/webhook/route.ts`
- Create: `src/app/api/radar/status/route.ts`
- Create: `scripts/verify-radar-stripe.mjs`
- Modify: `.env.example`
- Modify: `package.json`

**Interfaces:**
- Produces `createRadarPaymentGateway()`, `resolveRadarPrice()`, `handleRadarStripeEvent()` and trusted payment status polling.
- Offer code is `RADAR_IMPRESA_REPORT`; capability is `RADAR_RESULT_ACCESS`.

- [ ] **Step 1: Write failing checkout and webhook tests**

```js
assert.throws(() => resolveRadarPrice({ RADAR_CHECKOUT_ENABLED: '0' }), /non disponibile/i);
const first = await handleRadarStripeEvent(paidEvent);
const duplicate = await handleRadarStripeEvent(paidEvent);
assert.equal(first.grantsCreated, 1);
assert.equal(duplicate.grantsCreated, 0);
assert.equal((await readResult(unpaidOwner)).status, 402);
```

- [ ] **Step 2: Run RED**

Run: `node --no-warnings --experimental-strip-types scripts/verify-radar-stripe.mjs`

Expected: FAIL because Radar payment modules do not exist.

- [ ] **Step 3: Implement Checkout and webhook processing**

Instantiate `new Stripe(secretKey)` server-side, omit `payment_method_types`, add a random eight-letter suffix to `integration_identifier`, use purchase-ID idempotency, verify raw-body signatures, and fulfil only confirmed paid sessions. Process completed, asynchronous success, expired, failed and refunded events through the event ledger.

```ts
export const RADAR_OFFER_CODE = 'RADAR_IMPRESA_REPORT';
export const RADAR_CAPABILITY = 'RADAR_RESULT_ACCESS';
export function radarCheckoutIdempotencyKey(purchaseId: string) { return `radar-checkout/${purchaseId}`; }
```

- [ ] **Step 4: Verify GREEN and delayed-webhook behavior**

Run: `node --no-warnings --experimental-strip-types scripts/verify-radar-stripe.mjs`

Expected: PASS for duplicate success, success-before-redirect, redirect-before-webhook, refund and disabled-checkout cases.

- [ ] **Step 5: Commit commerce**

```powershell
git add .env.example package.json scripts/verify-radar-stripe.mjs src/app/api/radar src/lib/radar/payments
git commit -m "feat: gate Radar results with Stripe"
```

### Task 7: Add progress and commercial state to the Hub console

**Files (Hub repository):**
- Modify: `src/lib/radar.ts`
- Modify: `src/lib/radar-admin.ts`
- Modify: `src/components/finance/RadarAdmin.tsx`
- Create: `src/components/finance/RadarAdmin.test.tsx`

**Interfaces:**
- Consumes the additive assessment fields from Task 2.
- `percorsoRadar(token)` returns the canonical Website URL from `VITE_HORYZON_WEBSITE_URL`, with `https://horyzon.it` as the production default.

- [ ] **Step 1: Write failing Hub tests**

```ts
test('shows partial progress and paid state', () => {
  render(<RadarAdminRow assessment={{ ...seed, journey_status: 'IN_PROGRESS', answered_count: 12, current_step: 13, progress_percent: 40, payment_status: 'PENDING' }} />);
  expect(screen.getByText('12 / 30')).toBeTruthy();
  expect(screen.getByText('In corso')).toBeTruthy();
  expect(screen.getByText('Pagamento in attesa')).toBeTruthy();
});
```

- [ ] **Step 2: Run RED**

Run: `bun test src/components/finance/RadarAdmin.test.tsx`

Expected: FAIL because the progress row fields are not rendered.

- [ ] **Step 3: Implement queries, filters and progress presentation**

Select additive fields, show all started rows, add filters for in-progress/abandoned/awaiting-payment/paid/completed, distinguish `PURCHASE` and `PREVIEW`, and replace generated Hub public links with Website links. Do not expose owner hashes, Stripe internals or the preview PIN.

- [ ] **Step 4: Verify Hub behavior**

Run: `bun test src/components/finance/RadarAdmin.test.tsx src/components/radar/SchermoRadar.test.tsx`

Run: `bun run typecheck && bun run lint && bun run build`

Expected: tests and build PASS; any unrelated baseline failure is recorded by exact command and message before proceeding.

- [ ] **Step 5: Commit Hub console changes**

```powershell
git add src/components/finance/RadarAdmin.tsx src/components/finance/RadarAdmin.test.tsx src/lib/radar.ts src/lib/radar-admin.ts
git commit -m "feat: track paid Radar journeys in Hub"
```

### Task 8: Cut over legacy Hub public routes safely

**Files (Hub repository):**
- Modify: `src/routes/radar.index.tsx`
- Modify: `src/routes/radar.$token.tsx`
- Modify: `src/components/radar/SchermoRadar.test.tsx`
- Modify: `.env.example`

**Interfaces:**
- Public Hub `/radar` redirects to `https://horyzon.it/radar`.
- Token route redirects to the Website resume endpoint only after the token mapping is supported; until then it displays a migration-safe contact/recovery state and does not lose data.

- [ ] **Step 1: Write failing redirect tests**

```ts
expect(publicRadarDestination()).toBe('https://horyzon.it/radar');
expect(tokenRadarDestination('opaque-token')).toBe('https://horyzon.it/radar/resume/opaque-token');
```

- [ ] **Step 2: Run RED**

Run: `bun test src/components/radar/SchermoRadar.test.tsx`

Expected: FAIL because destination helpers do not exist.

- [ ] **Step 3: Implement canonical destinations behind a cutover flag**

Add `VITE_RADAR_WEBSITE_CUTOVER=0` as the default contract. With the flag off, preserve the current public routes. With it on, redirect to the Website. This prevents a code release from prematurely moving live traffic.

- [ ] **Step 4: Verify both flag states and build**

Run: `bun test src/components/radar/SchermoRadar.test.tsx && bun run build`

Expected: both disabled and enabled destination tests PASS.

- [ ] **Step 5: Commit cutover controls**

```powershell
git add .env.example src/routes src/components/radar/SchermoRadar.test.tsx
git commit -m "feat: prepare Radar Website cutover"
```

### Task 9: Document Stripe sandbox product creation and activation

**Files:**
- Create: `docs/radar/stripe-setup.md`
- Create: `docs/radar/operations.md`
- Create: `scripts/verify-radar-operations.mjs`

**Interfaces:**
- Documents product `Radar d'Impresa Horyzon` and offer `RADAR_IMPRESA_REPORT`.
- Creates the Stripe sandbox Product when an authenticated CLI is available; no live Product or Price is created in this task.

- [ ] **Step 1: Write the failing operations verifier**

```js
for (const fragment of ['RADAR_CHECKOUT_ENABLED=0', 'RADAR_PREVIEW_ENABLED=0', 'checkout.session.completed', 'checkout.session.async_payment_succeeded', 'charge.refunded', 'rollback']) assert(operations.includes(fragment));
```

- [ ] **Step 2: Run RED**

Run: `node scripts/verify-radar-operations.mjs`

Expected: FAIL because operational documents do not exist.

- [ ] **Step 3: Write exact sandbox, environment, canary and rollback instructions**

Document installation of the current Stripe CLI, `stripe whoami --format json`, sandbox authentication, webhook forwarding, Vercel variables to be supplied later, checkout-disabled deployment order, canary purchase, refund reconciliation and rollback. Do not include actual secret values.

- [ ] **Step 4: Create the authorized sandbox Product when Stripe authentication is available**

Run: `stripe products create --name "Radar d'Impresa Horyzon" --description "Report digitale Radar d'Impresa Horyzon" --metadata "offer_code=RADAR_IMPRESA_REPORT"`

Expected: one sandbox Product. Record its human-readable name and creation evidence in the execution report; do not commit its opaque ID and do not create a Price before the amount is approved.

Run: `node scripts/verify-radar-operations.mjs`

Expected: PASS. If Stripe authentication is unavailable, code work continues and the exact external blocker is reported without requesting credentials.

- [ ] **Step 5: Commit operations documentation**

```powershell
git add docs/radar scripts/verify-radar-operations.mjs
git commit -m "docs: add paid Radar operations guide"
```

### Task 10: Full verification, security review and release-ready handoff

**Files:**
- Modify only files required to fix failures caused by Tasks 1-9.
- Review: `docs/superpowers/specs/2026-09-29-paid-radar-migration-design.md`
- Review: `docs/superpowers/plans/2026-09-29-paid-radar-migration.md`

**Interfaces:**
- Produces two clean local `main` branches with tested commits and no production mutation.

- [ ] **Step 1: Run the complete Website verification suite**

Run: `npm run test:radar && npm test && npm run typecheck && npm run lint && npm run build`

Expected: exit 0 for every command.

- [ ] **Step 2: Run the complete Hub verification suite**

Run: `bun test && bun run typecheck && bun run lint && bun run build`

Expected: exit 0 for every command, or exact pre-existing failures documented separately with proof they are unrelated.

- [ ] **Step 3: Run secret, permission and diff checks**

```powershell
rg -n "789987|sk_(live|test)|rk_(live|test)|whsec_|service_role" src public
git diff origin/main...HEAD --check
git status --short --branch
```

Expected: the PIN appears only in tests/docs that describe the approved local value; no actual secrets appear; diffs have no whitespace errors; trees are clean.

- [ ] **Step 4: Verify requirements line by line**

Confirm from test output that partial progress reaches Hub, refresh recovery works, unpaid result fields remain absent, preview is session-scoped and audited, Stripe fulfilment is idempotent, and cutover is disabled by default.

- [ ] **Step 5: Report and stop before external release operations**

Report exact commit SHAs for Website and Hub, test commands and results, Stripe sandbox Product evidence or blocker, plus the unapplied migration, unset environment variables, disabled checkout/cutover flags and undeployed status. Do not push, deploy, apply migrations, mutate Vercel variables, create a live Price or run a real payment unless separately authorized.
