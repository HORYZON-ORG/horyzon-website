# Annunci 10x - Commercial contract V3

Status: implemented pre-payment, checkout disabled.
Owner: Horyzon Consulting Recruiting.
Public products: Annuncio 10x; Guida Annunci 10x.

## Public offer

Annuncio 10x is the public paid rewrite/create service in the funnel.

Price: 7 EUR.
Unit: 1 job ad, 1 version, 1 publication channel.
Delivery: the complete generated text is made available only after payment confirmation.

Two public paths lead to the same product:

1. Existing ad: free Score di chiarezza first, then Annuncio 10x rewrite.
2. No ad yet: guided brief first, then Annuncio 10x creation.

Guida Annunci 10x is a separate public informational product in the funnel.

Price: 49 EUR.
Public CTA: Scopri la guida — 49 €.
Checkout status: not active. No standalone guide checkout is exposed in the public funnel.
Preview asset: `/annunci-10x/annunci-10x-anteprima.pdf`.

## Internal capabilities

The public product keeps two internal capabilities because runtime behavior is different:

| Offer code | Capability | Public name | Price |
| --- | --- | --- | --- |
| `ANNUNCI10X_REWRITE` | `REWRITE_CREDIT` x1 | Annuncio 10x | 7 EUR |
| `ANNUNCI10X_CREATE` | `CREATE_CREDIT` x1 | Annuncio 10x | 7 EUR |

`AGENT_RECRUITER` remains a backend/internal offer and entitlement package. It is not shown in the public funnel unless `ANNUNCI10X_AGENT_RECRUITER_ENABLED` is explicitly enabled server-side.

## CREATE runtime architecture

The paid CREATE runtime uses the Phase B Decision Engine path:

`Questionario -> Truth Ledger -> Decision Engine Preflight -> Base Ad factual -> Single AI Writer -> Hard Facts Decision Engine -> optional Single Surgical Repair -> READY_FOR_CLIENT`.

The previous `PROFILE -> STRATEGY -> VALIDATE -> REVISE -> VALIDATE` loop is not the canonical CREATE generation path. The existing-ad analysis path remains separate and may still use the analysis/evaluation runtime for `annuncio esistente -> EXTRACT -> ANALYZE / IMPROVE`.

Runtime rules:

- Truth Ledger is the canonical source of facts.
- Base Ad is deterministic and candidate-facing, but internal negative constraints stay metadata and must not be printed as copy.
- The Writer may develop confirmed facts into natural prose, but may not add plausible tools, processes, benefits, conditions, channels, outcomes or selection steps that are absent from the Truth Ledger.
- UNKNOWN non-critical decisions are retained as warnings and do not block delivery.
- FIX_REQUIRED allows at most one surgical repair before the Decision Engine recheck.
- BLOCK must not expose the generated Master as the paid final output.
- The persisted diagnostic payload should include Truth Ledger version, Base Ad, initial Master, Decision Report, repair request/result, final Master, final decision, UNKNOWN warnings, provider calls, cost where available and timestamps.

Client-facing post-delivery revisions are limited to 3 per Master. A revision targets one section at a time, must preserve hard facts, and must not replace the previous published section if the Decision Engine blocks the revised text. After 3 accepted revisions the product returns `REVISION_LIMIT_REACHED`.

## Free result semantics

Public score name: Score di chiarezza.

Required disclaimer:

> Il punteggio valuta la chiarezza e la completezza delle informazioni disponibili nell’annuncio. Non prevede il numero di candidature né sostituisce la valutazione delle persone.

The free result may show score, band, strengths, priorities, missing information and report preview. It must not promise candidate volume, hiring quality, selection success or market performance.

## Lead identity

Initial required fields:

- first name;
- last name;
- business email.

Optional fields:

- company name;
- business role;
- marketing consent.

Marketing consent must remain separate from transactional/service email.

## Brand

Public branding: Horyzon Consulting Recruiting.

Canonical web logo asset: `/annunci-10x/horyzon-consulting-recruiting-white.png`.

The approved asset uses the transparent white/lime Horyzon Consulting Recruiting lockup. It must stay transparent in the funnel header, without a white panel, CSS shadow or glow. The previous typographic fallback is no longer used in the funnel header.

Performia must not appear in the public Annunci 10x funnel while this contract is active.

## Guarantee

Required guarantee copy:

> 7 € per un annuncio, una versione e un canale. Dopo la conferma del pagamento generiamo il testo completo e te lo rendiamo disponibile. Se non ti è utile, puoi chiedere il rimborso integrale entro 14 giorni dalla consegna, senza motivazione, scrivendo a info@horyzon.it dall’email usata per l’acquisto.

## Go-live blockers

Checkout must remain disabled until all blockers below are explicitly cleared:

- legal review of the guarantee wording;
- refund policy confirmation;
- checkout terms and customer-facing conditions confirmed;
- delivery timing and support process confirmed;
- production Stripe prices verified for the 7 EUR product;
- post-payment fulfillment explicitly authorized.

Current flags:

- `ANNUNCI10X_CHECKOUT_ENABLED`: off.
- `ANNUNCI10X_FULFILLMENT_ENABLED`: off.
- Production premium authorization: not authorized.

## Out of scope for V3 realignment

This contract does not authorize:

- live checkout;
- Stripe calls;
- fulfillment unlock;
- OpenAI prompt or scoring changes;
- Resend provider changes;
- Supabase production writes;
- changes to the generation credit reservation migration.
