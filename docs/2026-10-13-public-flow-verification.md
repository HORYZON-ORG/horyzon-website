# Public website changes — 2026-10-13

Local implementation and verification only. No new push/deployment,
environment change, migration, live CRM contact, email or paid provider call.

## Wellbeing pages

The shared “Le connessioni contano” cross-area section is removed from all
three landing pages. The area switcher at the top remains. Introductory copy
stays focused on the selected area. The skip link and floating Iubenda
collection-notice widget are removed. Footer privacy/cookie links and cookie
preferences control remain; this does not prove the vendor popup works.

Desktop 1440×1000 and mobile 390×844 were checked, including the top switcher
and absence of horizontal overflow. Local UI commit: `e3879f3`.

## Annunci 10x → HighLevel

The existing contact route saves its owned lead first, then runs CRM delivery.
It uses the existing server transport/location configuration, upserts contact
identity without overwriting tags or DND, adds separate Annunci tags, and writes
a note containing the actual request, verification and marketing-consent state.
It does not grant entitlements, verify email, subscribe or activate campaigns.

Delivery receipts use existing `public.annunci10x_events`. The existing atomic
`annunci10x_check_rate_limit` provides a 60-second shared lease. The worker checks
lease expiry, runs within 25 seconds, and re-reads receipts after acquiring it.
Mock tests include separate module instances sharing the lease, restart/stale
reads, partial retry, expired lease and ambiguous note acknowledgement. This is
not a production multi-worker load test. Lost acknowledgement/5xx/408 on a note
is marked uncertain and does not cause automatic re-posting. No autonomous
retry worker is introduced: a repeat submission can resume a definite partial
failure after the lease; uncertainty needs an operator check.

Vercel metadata confirms shared `HIGHLEVEL_PRIVATE_TOKEN` is linked to the
existing website project for production/preview and a project location ID is
present. Secret values were not read. Credentials/scopes and actual delivery
still require an explicitly authorized live test.

## AI Score runtime

The existing OpenAI web-search adapter is connected through its canonical public
switches, persistent rate/budget store and circuit breaker. No additional search
provider is implemented or enabled. The public route accepts only a URL; model,
profile, execution and timeout fields in a public body cannot alter runtime.

The scan has a 45-second deadline, optional providers a maximum 15-second window,
store RPCs 5 seconds, request body 4 KiB/5 seconds, and public URL 2048 characters.
Cancellation stops the running stream. EOF without a terminal result/error is
reported as an error in the browser and enables retry. HTTP failures/non-HTML
homepages do not generate a score. A provider failure preserves technical
evidence and displays missing visibility. Readiness coverage and actual crawl
attempt/failure counts are exposed independently of provider availability.

SSRF protections pin validated DNS, reject mixed private/public DNS and mapped
private IPv6, recheck redirects, and bound compressed and decoded bytes. They
also admit valid public WordPress addresses previously rejected by an overly
broad subnet check. The scan reads initial HTML and does not render JavaScript;
client-only content may be outside the sample. Canonical score weights/formulas
are unchanged. Observation/audit persistence remains the existing no-op storage;
duplicate-result cache and concurrency slots are process-local, while provider
spend/rate/circuit protections use existing Supabase RPCs.

Provider success requires completed response, executed search, answer text and
verifiable HTTP(S) source evidence. Consulted source URLs alone never count as
domain citations. Valid negative search evidence is distinct from no evidence.
Reservations remain charged on uncertain cost/outcome; no automatic zero-cost
refund or retry of ambiguous reconciliation. Verified evidence survives a
bookkeeping failure. Each request permits one tool call, a 2048-byte prompt and
700 output tokens; unsupported model configuration fails closed.

## Model and budget decision still pending

Current project/shared metadata has no `AI_SCORE_OPENAI_RESPONSES_MODEL` override;
the effective code fallback is `gpt-5`. This is not a real model execution proof.
The existing FREE_QUICK_SCAN profile budget is **$0.05**, with five planned prompts.

| Allowed model | Prudent reservation/query | Queries affordable at $0.05 |
| --- | ---: | ---: |
| `gpt-5` (unchanged fallback) | $0.18 | 0 |
| `gpt-4.1-mini` (tested option, not activated) | $0.016 | 3 |

GPT-5 estimate includes $0.01 tool, up to 128k search-context tokens plus 2k
prompt allowance at $1.25/M input and 700 tokens at $10/M output, rounded upward.
GPT-4.1-mini includes $0.01 tool, the documented fixed 8k billed search-input
block plus 3k prompt allowance at $0.40/M and 700 output at $1.60/M, rounded up.
These are conservative engineering reservations, not invoice reconciliation or
provider-enforced monetary caps. Pricing/model availability must be rechecked
before activation; the current official catalog marks these older models
deprecated. Daily provider/global budget variable names exist in production
metadata, but their sensitive values are not retrievable through this connector.
The same limitation applies to runtime/master/provider/test-mode switch values.
Presence alone does not prove public execution is enabled.

Two reviewable alternatives, neither applied:

1. Keep GPT-5 and approve a profile allowance of at least $0.18 for one query
   ($0.90 for five), with compatible provider/global daily limits. Code must
   still stop if runtime/rate/budget/circuit gates reject it.
2. If still available for the account, explicitly select `gpt-4.1-mini`; the
   unchanged $0.05 profile supports three queries ($0.048 reserved), showing
   partial coverage. Its model configuration change and a paid canary require
   separate authorization. All five prompts remain visible as planned coverage.

Live Supabase function signatures were inspected read-only: existing budget
reserve/reconcile, rate-limit and circuit RPCs match the adapter contract. No
missing RPC was found. `PERPLEXITY_API_KEY` is absent from inspected website and
shared metadata and external-footprint adapter remains disabled. Other live
provider states/quotas/circuits have not been exercised. No secret was stored.

## Evidence

Build: 141 pages; full npm test including Annunci and AI Score; typecheck and
ESLint; patrimonial content/CRM mocks; search/sitemap verification. Browser QA
uses the actual built client with a separate local synthetic endpoint, proving
desktop/mobile results, 403 without score, truncated EOF with retry and no
horizontal overflow. It is not a live provider/CRM proof.

Screenshots and local-only QA fixture are outside the repository at
`C:/work/HORYZON/website-review/2026-10-13-wellbeing-cleanup/`.

Primary documentation checked:
- [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search)
- [OpenAI tool pricing](https://developers.openai.com/api/docs/pricing)
- [GPT-5 pricing](https://developers.openai.com/api/docs/models/gpt-5)
- [GPT-4.1-mini pricing](https://developers.openai.com/api/docs/models/gpt-4.1-mini)
- [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [HighLevel add tags](https://marketplace.gohighlevel.com/docs/2021-07-28/ghl/contacts/add-tags/index.html)
