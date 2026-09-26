# Annunci 10x Analyze UX wiring

Status: FASE 2D implemented. This is UX/API wiring on top of the V2 durable
foundation, not public V2 scoring activation.

## Purpose

The Analyze path is now wired around the durable `AnalysisRun` lifecycle and
the lead/email verification foundation already applied to the canonical
Supabase project.

The product flow is:

`SOURCE -> ANALYSIS STARTS IMMEDIATELY -> CONTACT DATA -> EMAIL VERIFICATION -> RESULT`

The analysis branch and the contact/verification branch are intentionally
parallel:

- source submission creates or resumes an `AnalysisRun`;
- polling starts immediately;
- the contact form is shown without waiting for AI processing;
- email verification can complete while the analysis is still running;
- the free result is revealed only when the run is ready and the email is
  verified server-side.

## Source Modes

The Analyze UI supports:

- `PASTED_TEXT`: user pastes the job ad text.
- `PUBLIC_URL`: user submits a public URL for server-side extraction.

The first step no longer asks for `roleHint` or `companyHint`, because the
durable AnalysisRun path does not require those client hints.

If public URL ingestion fails, the UI shows a customer-safe message and a
fallback action to paste the text. It does not attempt alternate crawlers,
browser automation, search engine lookup, anti-bot bypass, or paywall bypass.

## Polling And Resume

After `POST /api/annunci-10x/analysis`, the browser polls:

`GET /api/annunci-10x/analysis/[id]`

The client uses a controlled timeout cadence of about 2.5 seconds, keeps only
one polling request active at a time, cleans up timers on unmount, and stops on
`READY` or `FAILED`.

On refresh, the page calls:

`GET /api/annunci-10x/session/resume`

The resume response is intentionally minimal. It restores only safe state:

- session id and entry mode;
- latest AnalysisRun public status;
- safe progress label;
- `contactSaved`;
- `emailVerified`;
- `resultEligible`.

It does not return score, gate, checks, evidence, raw input, prompt data,
provider data, model data, token usage, email, name, or company PII.

## Customer-Safe Progress

Technical stages are mapped to customer-facing labels in one testable helper:

- `SOURCE_VALIDATION`, `PRECHECK`, `EXTRACT`: "Stiamo leggendo il tuo annuncio"
- `PROFILE`, `STRATEGY`: "Stiamo ricostruendo il ruolo"
- `EVALUATE`, `CLARIFY`: "Stiamo verificando i criteri Annunci 10x"
- `COMPLETE`: "Il risultato e pronto"

The UI does not expose internal stage names such as `PRECHECK`, `EXTRACT`,
`PROFILE`, `STRATEGY`, `EVALUATE`, or `CLARIFY`.

## Contact And Email Verification

The contact form collects:

- first name;
- last name;
- company name;
- business role;
- business email;
- optional marketing consent.

It does not collect phone number.

Supported role values:

- `OWNER_ENTREPRENEUR`
- `HR`
- `INTERNAL_RECRUITER`
- `CONSULTANT`
- `OTHER`

Email verification uses the existing server endpoints:

- `POST /api/annunci-10x/email-verification/request`
- `POST /api/annunci-10x/email-verification/verify`

The OTP input preserves leading zeroes and uses browser-friendly attributes:
numeric input mode, one-time-code autocomplete, and a six-character maximum.

Mock email remains for automated tests and development only. No public API or
UI path reveals a mock OTP, accepts a fixed OTP, or supports skip flags.

If the email provider is unavailable, the UI shows:

`La verifica email e temporaneamente non disponibile.`

No bypass is introduced.

## Result Gate

The only free result API is:

`GET /api/annunci-10x/analysis/[id]/result`

It verifies server-side:

1. session cookie exists;
2. session owns the exact AnalysisRun;
3. the analysis is ready;
4. the lead email is verified;
5. the result is eligible;
6. the exact evaluation referenced by the AnalysisRun exists and belongs to the
   same session.

If the analysis is not ready, the API returns a customer-safe lock response.
If email is not verified, the API denies the result. Client flags are never
authoritative.

The route logs only a safe `result_revealed` event and does not start AI work.

## Free Result Contract

The free payload is versioned and minimal:

```json
{
  "analysisRunId": "...",
  "resultVersion": "V1_COMPAT",
  "score": {
    "value": 72,
    "max": 100,
    "range": null,
    "coverage": 100
  },
  "band": null,
  "interpretation": "...",
  "nextAction": {
    "type": "REWRITE_EXISTING_AD",
    "label": "Migliora questo annuncio"
  }
}
```

Forbidden from the free payload:

- checks;
- evidence;
- missing items;
- gate internals;
- operations;
- provider/model/request ids;
- token usage;
- raw job ad text;
- role card internals;
- lead data and PII.

## V1 Compatibility

Current public AnalysisRun evaluation remains V1.

For V1 evaluations:

- `resultVersion` is `V1_COMPAT`;
- a single score value is preserved when V1 produced one;
- a V1 range is preserved when V1 produced an interval;
- V2 bands are not applied;
- `band` remains `null` to avoid presenting V1 as V2.

This avoids renaming or visually recasting V1 output as V2.

## Future V2 Compatibility

The result presentation helper already supports a future `V2` payload shape:

- single score;
- deterministic V2 band;
- no interval.

This is covered by a synthetic pure test only. It does not activate
`annunci10x.evaluate.v2.3` in public runtime and does not perform live OpenAI
calibration.

## Bypass Closure

The old public Analyze routes no longer return ungated results:

- `POST /api/annunci-10x/analyze` returns HTTP 410 `ANALYSIS_FLOW_MOVED`;
- `POST /api/annunci-10x/clarify` returns HTTP 410 `ANALYSIS_FLOW_MOVED`.

The internal `runFreeAnnunci10xAnalysis()` path remains available for the
durable AnalysisRun worker/orchestrator.

The create-specific route remains untouched:

`/api/annunci-10x/create/clarify`

## Operational Status

Implemented:

- source-first Analyze UI;
- parallel contact and polling;
- email verification UI wiring;
- gated result endpoint;
- minimal free result contract;
- resume leakage closure;
- old Analyze result bypass closure.

Deferred:

- real email provider integration;
- production result reveal until email delivery is configured;
- full FASE 2E visual redesign;
- photographic hero;
- checkout/payment;
- HighLevel/Rizzo Flow;
- public V2.3 scoring activation.

## Supabase Status

No database migration was added in this phase.

This phase assumes the canonical Supabase project already has:

- AnalysisRun foundation applied;
- lead verification foundation applied;
- email verification hardening applied;
- old email RPC overloads removed;
- no residual synthetic test data from the prior production round-trip.

