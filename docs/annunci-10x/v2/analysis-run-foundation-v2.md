# Annunci 10x AnalysisRun foundation

Status: FASE 2A foundation. Not production validation for V2 scoring.

## Purpose

`AnalysisRun` is the durable lifecycle object for the future Analyze funnel:

`SOURCE -> ANALYSIS STARTS IMMEDIATELY -> CONTACT DATA -> EMAIL VERIFICATION -> RESULT`

This phase implements only `SOURCE -> ANALYSIS RUN` plus status recovery. It does not redesign the landing page, implement email verification, checkout, HighLevel, or Rizzo Flow.

## Source Model

Supported sources:

- `PASTED_TEXT`: original pasted input is preserved, canonical target text is trimmed only, and `sourceHash` is calculated from normalized content.
- `PUBLIC_URL`: server-side retrieval preserves original URL, final URL, fetched text, extraction metadata, source status, and sanitized failure code.

The analyzed target text is immutable for the run. Later clarifications can create new snapshots/evaluations, but they do not rewrite the original run target or original score.

## URL Security

Public URL ingestion allows only `http` and `https`.

Blocked:

- `localhost` and internal hostnames;
- loopback;
- RFC1918/private ranges;
- link-local;
- multicast/reserved ranges;
- `file:`, `ftp:`, `data:`, `javascript:`, and any non-http scheme.

Every redirect is revalidated. The fetch uses an identifiable Horyzon user agent, no cookies, no credentials, no auth header forwarding, timeout, redirect limit, byte limit, and content-type allowlist.

DNS is resolved before each fetch/redirect and all resolved addresses must be public. In Vercel/Next serverless, the final outbound `fetch` still resolves independently at transport time, so this reduces SSRF risk but is not a hard network egress firewall against DNS rebinding. A future stronger production design should add platform/network-level egress controls if available.

## HTML Extraction

Extraction is single-page only:

1. JSON-LD `JobPosting`;
2. `main` / `article`;
3. semantic job-description containers;
4. controlled text fallback.

No web search, crawling, secondary link traversal, login bypass, paywall bypass, anti-bot bypass, or CAPTCHA bypass is implemented.

## Lifecycle

`status` is the lifecycle state:

- `QUEUED`
- `RUNNING`
- `READY`
- `FAILED`

`stage` is the current/last completed work unit:

- `SOURCE_VALIDATION`
- `PRECHECK`
- `EXTRACT`
- `PROFILE`
- `STRATEGY`
- `EVALUATE`
- `CLARIFY`
- `COMPLETE`

Public status responses expose only:

- id;
- status;
- stage;
- sourceStatus;
- ready;
- sanitized failureCode.

They do not expose raw prompt, provider request id, token usage, model internals, stack traces, session secret, raw provider error, or raw job ad text.

## Idempotency

`inputIdentity` is derived from:

- normalized source content hash;
- target kind;
- declared channel;
- method version;
- rubric version;
- prompt version;
- score semantics version;
- model;
- evaluation mode.

Unique `(session_id, input_identity)` prevents double click, refresh, and retry from creating duplicate analysis runs for the same compatible source/version.

`annunci10x_ai_operations` remains the idempotent ledger for individual AI calls. `AnalysisRun` is only the orchestrator/lifecycle object.

## Durability Model

Next.js 16.3.5 supports `after()` in Route Handlers, and Vercel supports the underlying `waitUntil` primitive. This can continue work after the HTTP response, but it is still bounded by function lifetime and is not a durable queue.

Therefore the foundation uses:

- persistent `AnalysisRun`;
- claim/lease;
- stage checkpoints;
- idempotent AI operations;
- status endpoint that can safely kick/resume queued or stale runs.

If a function stops mid-run, the persisted stage and AI operation ledger allow a later server trigger to resume without assuming browser request continuity. A future dedicated worker/queue/cron can reuse the same claim/resume primitive.

## Latency Rationale

The EVALUATE V2.3 pilot measured:

- median latency: about 32.5s;
- p95 latency: about 44s.

The UX must not be designed as a blocking spinner tied to one 30-45s request. The intended strategy is:

start early + persist + poll/status + reveal when ready.

## Evaluation Mode

Current public runtime remains V1. `evaluationMode` supports `V1` and reserves `V2_SHADOW`, but `V2_SHADOW` is not activated by public routes in this phase.

V2.3 status: `CURRENT CANDIDATE`, not production validated.

## Persistence

New additive tables:

- `annunci10x_analysis_runs`;
- `annunci10x_rate_limits`.

Security follows the existing Annunci 10x pattern:

- RLS enabled;
- anon/authenticated revoked;
- service role only;
- ownership verified through session secret hash in server-side persistence/RPC.

## Remaining for FASE 2B

- lead/contact data;
- email verification/OTP;
- customer result access rules;
- report email;
- marketing consent;
- UI wiring for source URL and polling;
- optional worker/queue/cron hardening for production-grade resume.
