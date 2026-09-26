# Annunci 10x V2 decision log

Status: canonical planning record.

## Decided

### Method source

The external PDFs `Annunci_10x_Anteprima.pdf` and `Annunci_10x_Guida_Premium.pdf` are the V2 method source.

Existing repo guide V1/V1.1 remains historical and must not be deleted in this phase, but it is no longer the canonical method source for future Annunci 10x V2 work.

### Method principle

The V2 method is:

1. Lavoro reale.
2. Persona necessaria.
3. Strategia.
4. Annuncio.
5. Verifica.

The product must preserve the principle "Prima la realta del ruolo. Poi le parole."

### Four V2 lenses

The four lenses are:

- Popolarita: how much must the ad attract or select?
- Sfida / routine: how predictable is the work?
- Qualificazione: what must already exist and what can be learned?
- Tecnicita: how much specialist detail is required?

Role popularity and company attractiveness are distinct. A known company is not automatically attractive, and an unknown company is not automatically unattractive.

### Human self-evaluation

The Premium Guide human self-evaluation uses:

- Si.
- In parte.
- No.
- N/D.

The guide explicitly does not turn those answers into a numeric score.

### Software scoring ownership

The software product may still produce a numeric score, but only through a structured provider contract plus deterministic aggregation:

- 20 controls.
- For each control, the LLM/provider must return a structured evaluation with `checkId`, `score`, `evidence`, `reason`, `missing`, `confidence`, and applicability/status.
- Per-control `score` is an integer `0..10` or `null`.
- Per-control scoring must be constrained by explicit future V2 anchors and must not be arbitrary LLM judgement.
- The provider does not own final score `/100`, final coverage, final band, or final publication gate.
- TypeScript validates schema and bounds, distinguishes `MISSING` from `N/D`, aggregates per-control scores, computes final score, computes coverage, assigns band, and computes publication gate.

Conceptual formula:

`LLM = numeric evaluation of individual controls. TypeScript = deterministic aggregation of final result.`

### N/D and MISSING

`N/D` and `MISSING` are different states.

`N/D` means not applicable, not available, or not determinable under the scoring contract.

`MISSING` means the information is expected but absent from the evaluated target.

V2 must not transform `N/D` into zero and must not use score ranges to compensate for `N/D`.

### Score and publication gate

Score and publication gate are distinct.

A text can have a high score and still be blocked by a material publication issue. A text can be publishable with caveats even when score coverage is not perfect.

### V2 score bands

Current V2 product score bands:

- `0-49`: Critico.
- `50-69`: Debole.
- `70-84`: Buona base.
- `85-94`: Forte.
- `95-100`: Eccellente.

Future calibration must verify evaluation quality, monotonicity, stability, anchor distributions, and public wording. It does not authorize autonomous threshold changes. If benchmarks suggest the numeric thresholds are problematic, the question must return to the product owner.

These bands must not become hiring guarantees.

### V2 value ladder

The decided commercial ladder is:

- Free score.
- Rewrite existing ad: EUR 7 per version/platform.
- Create new ad: EUR 9.
- Agent Recruiter / Premium Guide: EUR 49.

Previous front-end purchase can become future upgrade credit only through a server-side rule.

### Checkout boundary

Checkout, discounts, payment verification, delivery, entitlement writes, and HighLevel CRM sync are not implemented in this phase.

Payment must be the server-side source of truth when implemented. HighLevel can support CRM/nurturing but must not become an entitlement source by itself.

### Premium Guide distribution

The Premium Guide must not be distributed through the public repository or a public static path.

Future delivery should use private storage, signed URLs, authenticated delivery, or another server-side protected delivery system.

### Funnel entry

The V2 funnel starts from pain, not from persona segmentation.

Primary pains include:

- Not finding suitable people.
- Too many irrelevant CVs.
- Fear of replacing the wrong person with another wrong person.
- Growth blocked by hiring difficulty.
- Mistakes, delays, and costs caused by poor recruiting.
- Dependence on weak or mismatched collaborators.

Directional entry concept:

> Le persone giuste esistono. Il tuo annuncio riesce ad attirarle?

This is a concept, not final copy.

### Future analysis flow

Future flow:

`SOURCE -> ANALYSIS STARTS -> CONTACT DATA -> EMAIL VERIFICATION -> RESULT`

The product can accept either a public ad link or pasted ad text. Analysis starts as soon as the ad source is available.

The free score/report must not be delivered until both conditions are true:

- `analysis_run` is `READY`.
- Email is `VERIFIED`.

During processing, the product can collect:

- Name.
- Surname.
- Company.
- Business role.
- Company email.
- Email verification.
- Separate marketing consent.

### Free result

The decided on-site free result contains:

- Score `/100`.
- Band.
- Brief meaning.
- Contextual CTA.

Full diagnostics should move to a private web report or dynamic email report. PDF is not an MVP requirement for the free result.

Additional teasers such as strongest signal, main weak area, or extra diagnostic previews are deferred UX decisions.

### Create flow

Create from zero should not be a monolithic form.

Future V2 likely uses a five-step wizard:

1. Ruolo + risultato.
2. Lavoro reale / attivita / contesto.
3. Persona necessaria / requisiti.
4. Condizioni + offerta.
5. Canale + candidatura.

Each completed step can be pre-processed in background before the next step. Premium generation must not happen before payment.

### 10x meaning

"10x" is a quality/value claim, not a numeric guarantee. It must not promise ten times more applications, CVs, candidates, or hires.

Allowed conceptual direction:

> 10 coherent candidates can be worth more than 100 irrelevant applications.

This should still be handled carefully as positioning, not as a measurable guarantee.

## Deferred

- Exact production copy for the V2 landing page.
- Exact legal copy for email verification and marketing consent.
- Exact checkout provider and webhook design.
- Exact private storage/delivery mechanism for the Premium Guide.
- Exact HighLevel field mapping.
- Final public wording for score thresholds and explanations.
- Migration SQL.
- Runtime provider/prompt updates.

## Obsolete or superseded

- V1/V1.1 guide content as canonical future method source.
- `OPEN_DECISION` pricing in the current runtime catalog as a future commercial decision. It remains current implementation state, but V2 pricing is now decided at specification level.
- Any claim that the Premium Guide is simply a PDF download.
- Any product framing that treats company fame as company attractiveness.

## Source inconsistency to resolve editorially

The Anteprima source refers to "3 casi reali". The Premium Guide source marks the examples/cases as fictional or didactic.

Recommended future wording: "3 casi applicativi" or equivalent.

No PDF is modified in this phase.
