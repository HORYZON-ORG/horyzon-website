# Annunci 10x Lead Verification Foundation

Status: FASE 2B foundation plus FASE 2B.1 email-verification hardening. No public UX redesign, no real email provider, no checkout, no HighLevel, no Rizzo Flow, no V2.3 public activation.

## Funnel Scope

The future Analyze funnel is:

`SOURCE -> ANALYSIS STARTS -> CONTACT DATA -> EMAIL VERIFICATION -> RESULT`

FASE 2A implemented source ingestion and durable `AnalysisRun`. FASE 2B implements only contact persistence, session-bound email verification, and result eligibility.

## Lead Contract

Free-analysis contact data:

- `firstName`
- `lastName`
- `companyName`
- `businessRole`
- `email`
- optional `marketingConsent`

`businessRole` enum:

- `OWNER_ENTREPRENEUR`
- `HR`
- `INTERNAL_RECRUITER`
- `CONSULTANT`
- `OTHER`

The free gate intentionally does not collect phone, industry, company size, or hiring frequency.

## Email Normalization

Email is trimmed, lowercased, capped at 254 characters, and checked with a pragmatic syntax rule requiring one `@`, no whitespace, and a dotted domain. Consumer providers are not blocked in this phase.

No SMTP probing, enrichment, or third-party validation is implemented.

## Marketing Consent

Marketing consent is separate from the requested service. Default is `false`.

Users can request the OTP and access the requested result without consenting to marketing. If consent is `false`, no consent timestamp is invented. Service emails such as OTP, future result delivery, and receipts are operational communications and do not imply marketing consent.

Legal copy still requires legal review before launch.

## OTP Lifecycle

Default operational policy:

- OTP length: 6 digits, generated with Node CSPRNG via `crypto.randomInt`.
- TTL: 10 minutes.
- Resend cooldown: 60 seconds.
- Pending-send concurrency grace: 15 seconds.
- Max attempts per OTP: 5.
- Send rate limit: 5 sends per hour per private session/email/request fingerprint subject.
- Verify rate limit: separate brute-force defense scope.

Verification status:

- `PENDING_SEND`
- `SENT`
- `CONSUMED`
- `INVALIDATED`
- `FAILED_SEND`

Only one active verification can exist for a lead/email. Creating a new verification invalidates previous unconsumed verification rows, except that a duplicate request inside the pending-send grace window reuses the existing `PENDING_SEND` row and does not trigger a second provider send.

Legal state transitions are intentionally narrow:

- `PENDING_SEND -> SENT`
- `PENDING_SEND -> FAILED_SEND`
- `SENT -> CONSUMED`
- `SENT -> INVALIDATED`

Invalidated, consumed, and failed-send verifications cannot be moved back to `SENT`.

## OTP Hashing

Plain OTP codes are never stored, returned by HTTP APIs, written to events, or logged by domain code.

The stored value is:

`HMAC-SHA256(ANNUNCI10X_EMAIL_VERIFICATION_PEPPER, verificationId + emailNormalized + code)`

The pepper is server-only and must not be committed, logged, exposed to the browser, or stored in Supabase.

Production fails closed if the pepper or email provider is unavailable.

At verification time, the runtime hashes the user-entered code and performs the constant-time comparison against the active verification hash. Persistence receives only the exact verification id and the boolean comparison result; it does not receive the plaintext OTP or candidate hash.

## Provider Abstraction

`Annunci10xEmailProvider` currently exposes:

`sendVerificationCode({ recipient, code, expiresAt, firstName })`

Only a MOCK provider exists in this phase. It is for tests and development only, captures the code in memory for automated tests, and is rejected in production configuration. No Brevo, HighLevel, Resend, SendGrid, SMTP, or external provider is integrated.

CRM/nurturing and email delivery remain separate concepts.

## APIs

Additive routes:

- `POST /api/annunci-10x/contact`
- `POST /api/annunci-10x/email-verification/request`
- `POST /api/annunci-10x/email-verification/verify`

The existing `GET /api/annunci-10x/analysis/[id]` is extended with:

- `verificationRequired`
- `emailVerified`
- `resultEligible`

It still does not expose score details, checks, email, lead PII, raw prompt, token usage, or provider internals.

## Result Eligibility

Canonical eligibility output:

| AnalysisRun | Email | resultEligible |
| --- | --- | --- |
| RUNNING | unverified | false |
| RUNNING | verified | false |
| READY with source READY and result reference | unverified | false |
| READY with source READY and result reference | verified | true |
| FAILED | verified | false |
| READY without result/evaluation reference | verified | false |

The browser is not trusted for eligibility. No localStorage, query string, or client flag can reveal the result.

## Privacy And Telemetry

Forbidden event metadata:

- name
- email
- company
- OTP
- code hash
- phone
- raw body

Allowed events use non-identifying metadata:

- `contact_saved`
- `email_verification_requested`
- `email_verified`
- `email_verification_failed`

## Persistence

New additive objects:

- `annunci10x_leads`
- `annunci10x_email_verifications`
- RPC functions for session-owned lead upsert, verification creation, sent/failed status, and verification attempts.

Security model follows the existing Annunci 10x pattern:

- RLS enabled;
- anon/authenticated revoked;
- service role only;
- session-secret ownership checks in server-side RPC.

Email is not globally unique. A person may legitimately create multiple sessions.

## Migration State

FASE 2A migration: APPLIED TO PRODUCTION SUPABASE AND ROUND-TRIP VERIFIED.

FASE 2B migration: APPLIED TO PRODUCTION SUPABASE AND ROUND-TRIP VERIFIED.

FASE 2B.1 migration: APPLIED TO PRODUCTION SUPABASE AND ROUND-TRIP VERIFIED.

FASE 2C cleanup migration: APPLIED TO PRODUCTION SUPABASE AND ROUND-TRIP VERIFIED.

Canonical Supabase project:

- project: horyzon
- project ref: pmkyeqrfkunypfkbjnyg

The old RPC overloads for `annunci10x_create_email_verification(...8 args)` and `annunci10x_verify_email_code(uuid,text,text)` were removed during FASE 2C. The canonical round-trip verified durable AnalysisRun, lead persistence, hardened email verification, and `resultEligible = true`. Synthetic test data was removed after verification.

Real email delivery remains pending provider integration. Do not weaken the email gate to work around that operational blocker.

## Future Work

- Connect the new UX to these APIs.
- Integrate a real email provider.
- Add future private cross-device report token or magic link without PII in URLs.
- Reveal the result payload only after `resultEligible = true`.
