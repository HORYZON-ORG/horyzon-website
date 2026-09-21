# Horyzon AI Score methodology v1.0

Initial implementation: `horyzon-ai-readiness-v1`.

## Public product boundary

The public `/ai-score` flow runs the audit before the locked state and returns only the `FREE` projection to the browser:

- AI Readiness;
- AI Visibility;
- Evidence confidence;
- short interpretation;
- aggregate opportunity count;
- aggregate severity count;
- locked CTA for future premium access.

The server keeps a premium-shaped payload for future `PREMIUM_AUDIT` and `OPTIMIZATION_PLAN` access, but this first version does not expose category breakdowns, findings, evidence detail or remediation steps to the client.

## AI Readiness weights

`horyzon-ai-readiness-v1` keeps the requested weights unchanged:

| Category | Weight |
| --- | ---: |
| Crawlability & Indexability | 15 |
| Content Quality & Citability | 20 |
| Entity & Semantic Clarity | 15 |
| Structured Data | 10 |
| Authority, Trust & Evidence | 15 |
| Technical Quality & UX | 10 |
| Freshness & Content Maintenance | 5 |
| AI / Agent Readiness | 5 |
| External Brand Footprint | 5 |
| Total | 100 |

Only measured categories contribute to the normalized free Readiness result. Unavailable provider-backed categories lower evidence confidence instead of producing invented values.

## Evidence confidence

The internal confidence value is numeric from `0` to `100`.

Initial mapping:

- `80-100`: `HIGH`;
- `50-79`: `MEDIUM`;
- `0-49`: `LOW`.

The current formula combines:

- applicable checks actually measured;
- verified evidence ratio;
- measured category coverage.

## AI Visibility

AI Visibility is deliberately separate from AI Readiness. It cannot be derived from page HTML.

The first release includes the data model and weights for:

- Brand Mention Rate: 25%;
- Citation Rate: 25%;
- Prompt Coverage: 20%;
- Share of Voice: 15%;
- Cross-engine Consistency: 10%;
- Citation / Source Diversity: 5%.

Current state: `not_measured`.

Blocker: the repository does not currently include a reliable provider or approved infrastructure for querying AI engines and verifying brand mentions, citations, source URLs and competitors. Until that exists, the UI must show `Not measured` and must not generate placeholder visibility scores.

## SSRF and crawl limits

The audit endpoint validates untrusted URLs server-side:

- only `http` and `https` are accepted;
- embedded credentials are rejected;
- hostname and URL are normalized;
- DNS is resolved before fetch;
- localhost, loopback, private, link-local, metadata and reserved destinations are blocked;
- redirects are manual and revalidated;
- redirect count, timeout and response size are limited;
- the user agent identifies Horyzon AI Score.

This endpoint is an auditor, not a generic proxy.

## Future hardening

Before high-volume production use, add persistent job storage, rate limiting, abuse controls, background workers, retry policy, provider credentials stored outside the client bundle and signed access checks for premium payloads.
