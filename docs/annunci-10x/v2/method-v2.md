# Annunci 10x method v2

Status: canonical method specification. Not implemented in runtime yet.

## Principle

Annunci 10x V2 starts before copywriting.

Canonical sequence:

1. Lavoro reale.
2. Persona necessaria.
3. Strategia.
4. Annuncio.
5. Verifica.

The guiding principle is:

> Prima la realta del ruolo. Poi le parole.

An ad becomes stronger when the decisions behind it become clearer.

## What the method must protect

The method protects against:

- generic job titles;
- vague activities;
- missing result;
- invented benefits;
- inflated requirements;
- hidden conditions;
- confusing "nice to have" with "must have";
- hiding routine behind inspirational tone;
- technical jargon used as decoration;
- company fame mistaken for company attractiveness;
- channel variants that change facts;
- publication before material facts are clear enough.

## Four lenses

### 1. Popolarita

Question: how much must the ad attract or select?

This lens is about the role and market context. It is not the same as company attractiveness.

If a role is common or highly compared, the ad needs clarity and credible differentiation. If the role is scarce or highly selective, the ad must also help self-selection.

### 2. Sfida / routine

Question: how predictable is the work?

The method must not make routine work artificially adventurous. It must not make difficult work artificially simple. Routine can be a strength when precision, reliability, continuity, or order matter.

### 3. Qualificazione

Question: what must already exist, and what can be learned?

Every requirement should be connected to an activity, result, condition, or responsibility. If the person does not need it on day one, it may be preferenziale or apprendibile instead of indispensabile.

### 4. Tecnicita

Question: how much specialist detail is required?

Technical precision is not the same as difficult language. Simplicity removes unnecessary jargon, but must not remove the precision needed by a qualified candidate.

## Role popularity vs company attractiveness

These are separate.

Role popularity answers:

- how recognizable the role is;
- how competitive the candidate market may be;
- whether candidates compare many similar ads;
- how much the role needs selection vs attraction.

Company attractiveness answers:

- why this company is worth considering;
- what concrete facts support the offer;
- whether the company can show context, learning, support, stability, autonomy, compensation, or growth;
- whether the ad gives evidence instead of slogans.

A known company is not automatically attractive. An unknown company is not automatically unattractive.

## Scheda Annuncio 10x V2

The V2 operational sheet has ten areas:

1. Ruolo: title, level, perimeter, area/reparto.
2. Risultato principale: what improves if the person works well for six months.
3. Attivita reali: daily/weekly work, tools, interlocutors.
4. Indispensabili: what must already exist at entry, and why.
5. Preferenziali: useful but not blocking.
6. Apprendibili: what can be learned with training, support, and practice.
7. Contesto: collaborators, autonomy, responsibilities.
8. Condizioni: location, mode, contract, schedule, shifts, availability, pay when defined.
9. Offerta: concrete support, training, benefits, and reasons to consider the opportunity.
10. Candidatura: where the ad will be published, how to apply, and verified destination.

## Strategy

Strategy organizes facts. It does not create facts.

Future strategy should answer:

- which information matters most for this search;
- what must be visible early;
- what must be explained with precision;
- what can be simplified without losing truth.

There is no universal best opening, length, order, or tone. The right structure depends on the role, work reality, qualification, technicality, conditions, channel, and candidate decision risk.

## Master and variants

The Master is the source of truth.

Channel variants can change:

- length;
- order;
- opening;
- tone;
- detail level;
- formatting.

Channel variants must not change facts:

- location;
- work mode;
- requirements;
- salary or compensation;
- conditions;
- application destination;
- concrete benefits.

## Claim check

Every benefit or attraction claim must be supported by a concrete fact.

The method must not call something a benefit if it is only a normal baseline expectation.

Unsupported benefits should be flagged, removed, or converted into factual statements.

## Human self-evaluation

The guide asks the user to answer the 20 checks with:

- Si.
- In parte.
- No.
- N/D.

The human guide does not turn those answers into a numeric score.

The software product may calculate a score only through structured per-control scoring and deterministic aggregation.

In V2, the LLM/provider must return a bounded per-control evaluation for each of the 20 controls: `checkId`, `score` as integer `0..10` or `null`, evidence, reason, missing signals, confidence, and applicability/status. Those per-control scores must be constrained by explicit V2 anchors.

The provider must not own final score `/100`, coverage, band, or publication gate. TypeScript validates the 20 control results and computes the final product result.

## 20 V2 controls

1. Il titolo rende immediatamente riconoscibile il ruolo?
2. Si capiscono livello, perimetro e responsabilita?
3. Le attivita quotidiane sono concrete?
4. E chiaro quale risultato deve produrre il ruolo?
5. Si capiscono contesto, interlocutori e ambiente operativo?
6. L'annuncio mette in evidenza le informazioni piu utili per questa ricerca?
7. Routine, imprevisti e sfide sono rappresentati fedelmente?
8. Impegno, responsabilita e condizioni impegnative sono visibili quando contano?
9. Il livello tecnico del linguaggio e adatto al lavoro?
10. Indispensabili, preferenziali e apprendibili sono distinti?
11. Ogni requisito e collegato a un'attivita, un risultato o una condizione reale?
12. Sede e modalita di lavoro sono chiare?
13. Contratto, orari, turni e tempi sono sufficientemente chiari?
14. Il compenso e gestito con chiarezza quando e disponibile o necessario?
15. Esistono ragioni concrete e verificabili per considerare l'offerta?
16. La struttura e adatta al canale in cui verra pubblicata?
17. Testo, campi del portale e destinazione raccontano gli stessi fatti?
18. L'annuncio si legge e si scandisce facilmente?
19. Il linguaggio e concreto, preciso e privo di ripetizioni inutili?
20. Una persona sa esattamente come candidarsi?
