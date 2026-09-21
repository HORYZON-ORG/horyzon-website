# Horyzon AI Score methodology

Public product path: `/ai-score`

Public methodology path: `/ai-score/methodology`

## Versions

- Readiness methodology: `horyzon-ai-readiness-v1`
- Display label: `Horyzon AI Score methodology v1.0`
- Effective date: `2026-09-21`
- Evidence confidence formula: `horyzon-confidence-v2`
- Visibility methodology: `horyzon-ai-visibility-v1`

## Scoring principles

AI Readiness and AI Visibility are separate metrics.

AI Readiness is calculated from measured technical, semantic, content and trust signals. AI Visibility is not derived from HTML: it requires real observations from supported AI answer engines through a trusted provider.

The implementation must not synthesize missing data. If a metric cannot be measured, it is returned as `not_measured` and lowers Evidence confidence instead of producing a fallback score.

## AI Readiness categories

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

Total: 100 points.

The Phase 2 engine defines 73 atomic checks. Most are deterministic checks over fetched HTML, response headers, robots.txt, sitemap.xml, llms.txt and a controlled multi-page sample. Provider-backed checks remain `unknown`/`not_measured` until a real provider exists.

## Evidence model

Each measured check can carry evidence with:

- evidence id;
- check id;
- source URL;
- source type;
- page classification;
- collected timestamp;
- verification state (`present`, `verified`, `inferred`);
- verification level (`direct`, `derived`, `heuristic`, `external`, `provider`, `not_measured`);
- confidence value.

Findings and remediation summaries must reference evidence ids. Generic remediation is not treated as personalized unless tied to a measured failed or partial check.

## Evidence confidence v2

Evidence confidence is numeric and mapped to labels:

- `80-100`: HIGH
- `50-79`: MEDIUM
- `0-49`: LOW

The v2 formula combines:

- applicable check coverage: 28%;
- evidence quality: 22%;
- category coverage: 18%;
- crawl depth coverage: 16%;
- External Brand Footprint provider coverage: 8%;
- AI Visibility provider coverage: 8%.

A one-page audit without AI Visibility or External Brand Footprint provider should not be HIGH confidence.

## Crawl limits and SSRF controls

The server-side auditor:

- accepts only HTTP/HTTPS;
- rejects embedded credentials;
- rejects localhost, loopback, private, link-local, multicast, reserved and metadata destinations;
- resolves DNS before request;
- pins the selected public address through the Node `lookup` callback;
- revalidates the socket remote address;
- revalidates redirects;
- limits redirects, bytes, timeout and page count;
- uses an identifiable user-agent;
- does not expose raw fetch output as a proxy.

Current controlled limits live in `src/lib/ai-score/limits.ts`.

## Anti-abuse

Phase 2 adds in-memory safeguards:

- per-IP request window;
- global concurrent audit limit;
- duplicate-result cache;
- per-page timeout;
- response-size limit;
- page-count limit.

These safeguards are process-local. Production scale should replace or complement them with durable edge/application rate limiting.

## Persistence

No durable database, KV store or sanctioned persistence layer is present in this repository. The code exposes an `AuditRepository` contract and a no-op adapter. Production persistence should implement the same contract without changing the audit engine.

No new Supabase or database project has been created.

## External Brand Footprint

External Brand Footprint requires a trusted provider for independent brand mentions, profiles, reviews, backlinks or directory evidence. Phase 2 implements the provider interface and returns `not_measured` until a provider is configured.

The readiness score does not invent external footprint values.

## AI Visibility

The visibility model includes prompt, engine, timestamp, brand mention, domain citation, cited URL, competitors, source position, evidence, provider and confidence.

Phase 2 keeps AI Visibility as `not_measured` because no provider is configured for verifiable engine observations.

Visibility weights are:

| Signal | Weight |
| --- | ---: |
| Brand Mention Rate | 25% |
| Citation Rate | 25% |
| Prompt Coverage | 20% |
| Share of Voice | 15% |
| Cross-engine Consistency | 10% |
| Citation / Source Diversity | 5% |

## Potential score

Potential score is no longer estimated from the number of remediation items. It is returned as `not_calculated` until remediation scenarios can be validated against actual changes or a trustworthy simulation model.

## Access levels

The audit engine can produce an internal payload for future premium levels, but the public API returns only the free projection:

- `FREE`
- `PREMIUM_AUDIT`
- `OPTIMIZATION_PLAN`

Pricing is intentionally not hardcoded in the UI.
