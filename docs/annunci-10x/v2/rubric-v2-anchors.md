# Annunci 10x rubric v2 anchors

Status: methodological design. Not implemented in runtime.

This document defines provider-agnostic 0-10 anchors for the 20 Annunci 10x V2 controls before any runtime scoring implementation.

## Scope

This file does not modify:

- runtime scoring;
- prompts;
- UI;
- API routes;
- Supabase;
- Vercel;
- checkout;
- email;
- HighLevel;
- AI Score;
- legacy `/annuncio-10x`.

## Ownership

LLM/provider:

- returns per-control structured numeric evaluation;
- returns `checkId`;
- returns `score` as integer `0..10` or `null`;
- returns `evidence[]`;
- returns `reason`;
- returns `missing[]`;
- returns `confidence` from `0..100`;
- returns applicability/status.

TypeScript:

- validates schema and bounds;
- distinguishes `MISSING` from `N/D`;
- aggregates scores;
- calculates final score;
- calculates coverage;
- assigns band;
- calculates publication gate.

The provider does not own final score `/100`, final coverage, final band, or final publication gate.

Formula:

`finalScore = 100 * sum(perCheckScore) / (10 * evaluableCheckCount)`

`coverage = evaluableCheckCount / 20 * 100`

V2 produces one final score. It does not use V1-style `minScore`, `maxScore`, or score intervals.

## Global 0-10 Grammar

| Score | Meaning |
| --- | --- |
| 0 | Complete absence of the evaluated requirement, or complete incompatibility with the criterion when applicable. |
| 1-2 | Minimal, vague, generic, or substantially insufficient presence. |
| 3-4 | Partial presence. Relevant elements exist, but substantial gaps, ambiguity, or genericity remain. |
| 5-6 | Basic/adequate level. The criterion is understandable and useful, but important improvements remain. |
| 7-8 | Strong level. The criterion is clear, concrete, and substantially complete. |
| 9 | Very strong level. Very precise, relevant, and well represented. Only minor limits remain. |
| 10 | Full satisfaction of the criterion for the actually evaluable target, with no material gaps. |

Important:

- `10` is not automatically the old `PASS`.
- `5` is not failure.
- Odd values are allowed only when the evidence truly falls between adjacent anchors.
- Every value must be justified by evidence.
- This global grammar does not replace check-specific anchors.

## Evidence Rule

If target is `ORIGINAL_AD`, the score evaluates the original ad.

RoleCard, Profile, Strategy, later declarations, and clarifications can help understand what to look for, but they do not become positive evidence unless the information appears in the evaluated target.

If target is `GENERATED_MASTER`, the score evaluates the Master.

If target is `CHANNEL_VARIANT`, the score evaluates that variant.

Example: if the customer later declares compensation, that compensation does not retroactively improve the compensation score of the original ad if it was absent from the original ad.

## MISSING vs NOT_EVALUABLE

`MISSING`:

- criterion is applicable;
- expected information or quality is absent;
- numeric score is required;
- complete absence normally scores `0`.

`NOT_EVALUABLE`:

- criterion is genuinely not applicable; or
- available data is insufficient to apply it legitimately;
- score is `null`;
- excluded from numerator and denominator;
- reduces coverage.

Do not use `N/D` to avoid penalizing a real absence.

## Confidence

`confidence` is `0..100`.

It means how reliable the evaluation is given the available material.

It does not mean:

- ad quality;
- probability of hiring;
- statistical probability of success.

Example: `score = 0` and `confidence = 99` is valid when a title is clearly absent.

Fase 1B implementation note: confidence is validated and preserved, but not used for score, coverage, band, gate, fallback, retry, or automation thresholds.

## Provider-Agnostic Design

Anchors must be usable by:

- structured-output LLM providers;
- closed decision engines;
- deterministic validators where applicable.

The anchors are explicit, ordered, semantically distinguishable, and independent from provider-specific behavior.

## Future Accelerator Suitability Labels

These labels are hypothetical only. They do not decide the future engine.

- `DETERMINISTIC_CANDIDATE`: could plausibly be handled by rules when structured facts are available.
- `CLOSED_DECISION_CANDIDATE`: could plausibly be benchmarked with a closed decision engine.
- `LLM_COMPLEX`: likely needs richer semantic interpretation, extraction, explanation, or synthesis.

Every future accelerator capability must pass Annunci 10x-specific shadow benchmark before production use.

## Check 01 - Role Title Recognizability

A. ID: `01`

B. Canonical question: "Il titolo rende immediatamente riconoscibile il ruolo?"

C. What it measures: whether the target title lets a candidate immediately understand the role family and role identity.

D. Why it matters: unclear or creative titles hide the opportunity from the right candidates and distort search/platform matching.

E. Target evidence: title line, heading, role label, visible job title metadata, repeated role naming inside the target.

F. Context allowed: role hints can help interpret ambiguous wording, but cannot replace an absent or unclear target title.

G. Anchors:

- 0: no role title, or title is unusable for identifying the role.
- 2: creative/generic title with only weak role hints, such as "Customer Happiness Hero".
- 4: professional family is inferable, but role remains broad or ambiguous.
- 6: recognizable role title, but missing useful specificity such as function, specialization, or scope.
- 8: clear and specific role title recognizable to target candidates.
- 10: immediately recognizable, specific, search-friendly title with no keyword stuffing or ambiguity.

H. Intermediate values: `1`, `3`, `5`, `7`, `9` are allowed only between adjacent anchors.

I. MISSING rule: applicable target without recognizable title is `MISSING`, normally `0`.

J. NOT_EVALUABLE rule: only when the target format genuinely has no title field and no role label can be expected.

K. CONFLICT rule: conflicting titles for different roles can create a conflict and possible gate issue.

L. Gate impact: material title-role mismatch can warn or block publication.

M. Synthetic examples:

- Weak: "Cerchiamo persona dinamica".
- Medium: "Addetto clienti".
- Strong: "Customer Care Specialist".

N. Avoid: do not reward keyword stuffing; do not reward brand-like creativity over recognizability.

O. Future accelerator suitability: `CLOSED_DECISION_CANDIDATE`.

## Check 02 - Level, Perimeter, Responsibilities

A. ID: `02`

B. Canonical question: "Si capiscono livello, perimetro e responsabilita?"

C. What it measures: whether the target clarifies seniority or operating level, scope, and responsibility perimeter.

D. Why it matters: candidates self-select better when they know whether the role is execution, coordination, ownership, or leadership.

E. Target evidence: seniority, autonomy, reporting line, scope, area/reparto, responsibility statements, decision rights, accountability.

F. Context allowed: role type can explain what level/perimeter would normally matter, but cannot add absent responsibilities.

G. Anchors:

- 0: no level, perimeter, or responsibility evidence.
- 2: vague hints such as "responsabile di varie attivita" without actual perimeter.
- 4: partial scope or responsibility visible, but material ambiguity remains.
- 6: level/perimeter/responsibility understandable enough for basic self-selection.
- 8: clear operating perimeter and main responsibilities; formal junior/mid/senior label not required when scope is clear.
- 10: very clear level, scope, autonomy, responsibility, and interfaces with no material ambiguity.

H. Intermediate values: allowed only between adjacent anchors.

I. MISSING rule: when responsibility/perimeter should be visible but is absent, score numerically.

J. NOT_EVALUABLE rule: only for target formats where level/perimeter cannot reasonably be represented.

K. CONFLICT rule: contradictory seniority or responsibility statements can trigger conflict.

L. Gate impact: material responsibility mismatch can block generated output publication.

M. Synthetic examples:

- Weak: "Ruolo operativo in azienda".
- Medium: "Gestirai richieste clienti e collaborerai con il team tecnico".
- Strong: "Gestirai in autonomia il primo livello di assistenza, aprirai ticket tecnici e coordinerai i passaggi con il reparto tecnico".

N. Avoid: do not require formal junior/mid/senior labels when the operational perimeter is clear.

O. Future accelerator suitability: `LLM_COMPLEX`.

## Check 03 - Concrete Daily Activities

A. ID: `03`

B. Canonical question: "Le attivita quotidiane sono concrete?"

C. What it measures: whether the target describes observable work, not generic traits or slogans.

D. Why it matters: concrete activities let candidates understand the real work before applying.

E. Target evidence: recurring tasks, workflows, tools, handoffs, actions, frequency, observable responsibilities.

F. Context allowed: RoleCard or declared context can suggest what activities to look for, but cannot supply target evidence.

G. Anchors:

- 0: no concrete activities.
- 2: generic activity labels only, such as "gestione clienti, CRM, problem solving".
- 4: some activities appear, but remain broad, mixed with traits, or incomplete.
- 6: several useful activities are understandable, with some lack of specificity.
- 8: concrete daily/weekly activities are clear and observable.
- 10: activities are concrete, role-specific, ordered enough to understand the actual work, and not confused with results.

H. Intermediate values: allowed only between adjacent anchors.

I. MISSING rule: applicable role with no concrete work activity is `MISSING`.

J. NOT_EVALUABLE rule: rare; only when target is not meant to describe work activities and no activity evidence is expected.

K. CONFLICT rule: contradictory activity descriptions can create conflict.

L. Gate impact: low activity clarity may block strong publication readiness but is usually not a hard gate by itself.

M. Synthetic examples:

- Weak: "Gestione clienti e problem solving".
- Medium: "Risponderai alle richieste clienti e aggiornerai il CRM".
- Strong: "Riceverai richieste, raccoglierai informazioni, aprirai ticket, aggiornerai il CRM e coinvolgerai il reparto tecnico quando serve".

N. Avoid: do not confuse activities with the role result.

O. Future accelerator suitability: `LLM_COMPLEX`.

## Check 04 - Observable Role Result

A. ID: `04`

B. Canonical question: "E chiaro quale risultato deve produrre il ruolo?"

C. What it measures: whether the target explains why the role exists and what works better because of the role.

D. Why it matters: the result is central to alignment between work, candidate expectations, and business need.

E. Target evidence: mission, outcome, effect, qualitative or quantitative result, improved condition, service level, reliability, order, speed, safety, continuity.

F. Context allowed: context can clarify expected outcome, but cannot score as target evidence if absent.

G. Anchors:

- 0: no result; only title, traits, or activities.
- 2: aspirational or generic result with little role connection.
- 4: result partially inferable, but not stated clearly.
- 6: observable result is understandable, but broad or weakly connected to activities.
- 8: clear, observable result connected to the role.
- 10: precise, role-specific result explaining what improves after good performance, numeric or qualitative, with no material ambiguity.

H. Intermediate values: allowed only between adjacent anchors.

I. MISSING rule: if the role should have an expected result and the target lacks it, score numerically, normally low.

J. NOT_EVALUABLE rule: only when a result cannot legitimately be represented in the target format.

K. CONFLICT rule: conflicting result promises or impossible outcomes can trigger conflict.

L. Gate impact: central quality issue; may block high readiness when absent.

M. Synthetic examples:

- Weak: "Supportare il team".
- Medium: "Aiutare i clienti a ricevere risposte piu rapide".
- Strong: "Garantire che le richieste clienti vengano raccolte, qualificate e inoltrate al reparto corretto senza passaggi persi".

N. Avoid: do not let an activity list automatically produce a high result score.

O. Future accelerator suitability: `LLM_COMPLEX`.

## Check 05 - Context, Interlocutors, Operating Environment

A. ID: `05`

B. Canonical question: "Si capiscono contesto, interlocutori e ambiente operativo?"

C. What it measures: whether the target makes the work setting and main interactions understandable.

D. Why it matters: context reduces false expectations and helps candidates understand collaboration and autonomy.

E. Target evidence: team, manager, stakeholders, customers, suppliers, tools, work environment, autonomy, collaboration model.

F. Context allowed: company/role context can help identify relevant interlocutors, but cannot replace target evidence.

G. Anchors:

- 0: no operating context.
- 2: generic corporate context with no useful work setting.
- 4: one or two context hints, but key interlocutors/environment remain unclear.
- 6: enough context to understand basic work setting.
- 8: team/interlocutors/environment are clear and relevant.
- 10: context, interlocutors, tools/environment, and autonomy are very clear without unnecessary corporate description.

H. Intermediate values: allowed only between adjacent anchors.

I. MISSING rule: expected context absent from an ad is scoreable as missing.

J. NOT_EVALUABLE rule: only when channel constraints genuinely prevent context representation.

K. CONFLICT rule: incompatible environment statements can trigger conflict.

L. Gate impact: usually warning/priority, unless conflict affects work mode or safety.

M. Synthetic examples:

- Weak: "Ambiente giovane e dinamico".
- Medium: "Lavorerai con il team customer care".
- Strong: "Lavorerai con customer care e reparto tecnico, usando CRM e ticketing per gestire richieste dei clienti".

N. Avoid: do not reward generic corporate description.

O. Future accelerator suitability: `LLM_COMPLEX`.

## Check 06 - Priority Of Useful Information

A. ID: `06`

B. Canonical question: "L'annuncio mette in evidenza le informazioni piu utili per questa ricerca?"

C. What it measures: whether the target gives priority to the facts that matter most for this specific search.

D. Why it matters: different roles require different emphasis. The ad should not bury the deciding information.

E. Target evidence: visible order, emphasis, opening, section weight, repeated facts, placement of result/work/requirements/conditions/offer.

F. Context allowed: the four lenses help determine what should matter. Context may define expected priority but cannot become target evidence.

G. Anchors:

- 0: target emphasis is unrelated to what the search needs, or critical information is absent.
- 2: generic emphasis; useful facts, if present, are buried or weak.
- 4: some relevant priorities visible, but major emphasis gaps remain.
- 6: broadly useful information is visible, though not optimally prioritized.
- 8: target clearly emphasizes the information most useful for this search.
- 10: emphasis is strongly aligned with the four lenses and makes the decisive information immediately accessible.

H. Intermediate values: allowed only between adjacent anchors.

I. MISSING rule: if priority can be determined and decisive target information is missing/buried, score numerically.

J. NOT_EVALUABLE rule: if available context is insufficient to determine what emphasis would be correct.

K. CONFLICT rule: target emphasizing facts contradicted elsewhere can trigger conflict.

L. Gate impact: usually priority/quality issue; can contribute to gate when missing facts are material.

M. Synthetic examples:

- Weak: a scarce technical role focused mostly on generic company slogans.
- Medium: role tasks visible but critical conditions buried.
- Strong: routine precision role foregrounds reliability, schedule, real activities, and concrete conditions.

N. Avoid: do not reduce this to high/low role popularity; use all four lenses.

Implementation caveat: Check 06 must not apply an automatic duplicate penalty for every fact already handled by another control. Example: missing compensation is primarily Check 14. Check 06 worsens for compensation only when, given the search context, wrong/missing emphasis on compensation is itself a strategic priority problem.

O. Future accelerator suitability: `LLM_COMPLEX`.

## Check 07 - Faithful Routine, Unexpected Events, Challenges

A. ID: `07`

B. Canonical question: "Routine, imprevisti e sfide sono rappresentati fedelmente?"

C. What it measures: whether the target represents the real rhythm of work without glamourizing or hiding it.

D. Why it matters: candidates need to know whether the job is routine, variable, demanding, reactive, or mixed.

E. Target evidence: routine, cadence, recurring tasks, unexpected events, challenge level, problem types, variability, pressure.

F. Context allowed: RoleProfile/context can indicate expected routine/challenge, but cannot provide positive target evidence.

G. Anchors:

- 0: routine/challenge materially absent or misleading.
- 2: generic "dinamico/sfidante/stimolante" without evidence.
- 4: partial signals but unclear balance between routine and challenge.
- 6: basic faithful representation of routine/challenge.
- 8: clear, concrete, balanced description of routine, imprevisti, and challenges where relevant.
- 10: fully faithful representation of work rhythm, including routine or challenge without exaggeration or concealment.

H. Intermediate values: allowed only between adjacent anchors.

I. MISSING rule: if routine/challenge materially matters and is absent, score numerically.

J. NOT_EVALUABLE rule: if there is no legitimate basis to know whether routine/challenge should be represented.

K. CONFLICT rule: target contradicts known target evidence about work rhythm.

L. Gate impact: can create gate issue if hidden challenge materially affects compatibility.

M. Synthetic examples:

- Weak: "Ambiente dinamico e sfidante".
- Medium: "Gestirai richieste quotidiane con alcune urgenze".
- Strong: "La maggior parte del lavoro e ricorrente, con picchi a fine mese e urgenze tecniche da indirizzare rapidamente".

N. Avoid: do not automatically reward glamour. Faithful routine can score `10`.

O. Future accelerator suitability: `LLM_COMPLEX`.

## Check 08 - Commitment, Responsibility, Demanding Conditions

A. ID: `08`

B. Canonical question: "Impegno, responsabilita e condizioni impegnative sono visibili quando contano?"

C. What it measures: whether material demands are visible when they affect fit.

D. Why it matters: hiding demanding conditions creates mismatched applications and weak trust.

E. Target evidence: shifts, on-call, physical effort, peaks, variable priorities, responsibility, pressure, complexity, travel, urgency.

F. Context allowed: can identify which demands matter, but cannot invent or count as target evidence.

G. Anchors:

- 0: material demanding conditions are absent or actively hidden when they should be visible.
- 2: vague demand language without concrete conditions.
- 4: some demanding aspects visible, but major material details missing.
- 6: main demands are understandable, with some incompleteness.
- 8: demanding conditions are clear and proportionate where relevant.
- 10: all material commitments/responsibilities/conditions are explicit, balanced, and not exaggerated.

H. Intermediate values: allowed only between adjacent anchors.

I. MISSING rule: known/material demands expected in target but absent are missing and scoreable.

J. NOT_EVALUABLE rule: if no evidence indicates demanding conditions are relevant and the target gives no basis to decide.

K. CONFLICT rule: contradictory demand/condition claims can trigger conflict.

L. Gate impact: material hidden conditions may block publication.

M. Synthetic examples:

- Weak: "Disponibilita e flessibilita" without specifics.
- Medium: "Richiesta disponibilita su turni".
- Strong: "Turni mattina/pomeriggio, picchi a fine mese e reperibilita concordata una settimana al mese".

N. Avoid: do not invent difficulty; evaluate visibility when it matters.

O. Future accelerator suitability: `LLM_COMPLEX`.

## Check 09 - Technical Language Adequacy

A. ID: `09`

B. Canonical question: "Il livello tecnico del linguaggio e adatto al lavoro?"

C. What it measures: whether technical detail and language precision fit the role.

D. Why it matters: too little detail weakens qualified self-selection; decorative jargon reduces clarity.

E. Target evidence: tools, processes, domain vocabulary, technical requirements, level of detail, precision of terms.

F. Context allowed: role technicality can guide expected detail, but cannot create target evidence.

G. Anchors:

- 0: technical language absent where essential, or completely mismatched.
- 2: jargon or generic terms with little role-specific precision.
- 4: partial technical fit, but important details missing or noisy.
- 6: adequate technical level for basic understanding.
- 8: strong fit between technical language and role reality.
- 10: precise, accessible, role-appropriate technical language with no ornamental complexity.

H. Intermediate values: allowed only between adjacent anchors.

I. MISSING rule: if technical detail is required for role fit and absent, score numerically.

J. NOT_EVALUABLE rule: if role technicality cannot be determined and target gives no basis.

K. CONFLICT rule: incompatible technical level or contradictory tools can trigger conflict.

L. Gate impact: usually quality issue; can gate generated claims if unsupported.

M. Synthetic examples:

- Weak: "Competenze digitali e problem solving".
- Medium: "Uso di CRM e strumenti ticketing".
- Strong: "Gestione ticket su Zendesk, lettura log base e passaggio strutturato al secondo livello tecnico".

N. Avoid: simple is not poor; technical is not bureaucratic.

O. Future accelerator suitability: `LLM_COMPLEX`.

## Check 10 - Requirement Classification

A. ID: `10`

B. Canonical question: "Indispensabili, preferenziali e apprendibili sono distinti?"

C. What it measures: whether candidates can distinguish entry requirements, advantages, and learnable items.

D. Why it matters: mixed requirements reduce valid applications and inflate selection barriers.

E. Target evidence: requirement lists, labels, phrasing that separates must-have, nice-to-have, and trainable items.

F. Context allowed: role context can explain likely classification but cannot score a mixed target as separated.

G. Anchors:

- 0: requirements absent or completely mixed when required.
- 2: single generic "Requisiti" list with no semantic distinction.
- 4: some distinction implied, but many items remain mixed.
- 6: basic separation between mandatory and preferred or learnable.
- 8: clear distinction among indispensable, preferred, and trainable items.
- 10: distinction is complete, semantically unambiguous, and avoids unnecessary barriers.

H. Intermediate values: allowed only between adjacent anchors.

I. MISSING rule: when requirements exist but classification is expected and absent, score numerically.

J. NOT_EVALUABLE rule: if the target legitimately has no requirements to classify.

K. CONFLICT rule: same item classified inconsistently can trigger conflict.

L. Gate impact: usually quality issue; can gate when disqualifying requirements are unclear or contradictory.

M. Synthetic examples:

- Weak: "Requisiti: esperienza, inglese, CRM, disponibilita".
- Medium: "Richiesti esperienza e disponibilita; gradito CRM".
- Strong: "Indispensabili: disponibilita turni; Preferenziali: uso CRM; Apprendibili: procedura ticket interna".

N. Avoid: do not require exact labels if the semantic distinction is clear.

O. Future accelerator suitability: `CLOSED_DECISION_CANDIDATE`.

## Check 11 - Requirement Relevance

A. ID: `11`

B. Canonical question: "Ogni requisito e collegato a un'attivita, un risultato o una condizione reale?"

C. What it measures: whether requirements have a real reason.

D. Why it matters: arbitrary prerequisites narrow the funnel and misrepresent the role.

E. Target evidence: explicit or strongly inferable link between requirement and activity/result/condition.

F. Context allowed: role context can explain why a requirement may matter, but original-ad score needs target evidence or target basis.

G. Anchors:

- 0: requirements are arbitrary or disconnected from any visible work basis.
- 2: mostly generic prerequisites with little connection.
- 4: some requirements are connected, but important ones remain unexplained.
- 6: main requirements are plausibly connected to visible work.
- 8: requirements are clearly relevant to activities, results, or conditions.
- 10: every material requirement has a clear and proportionate work-based reason.

H. Intermediate values: allowed only between adjacent anchors.

I. MISSING rule: if requirements are listed but no work basis is present, score low rather than N/D.

J. NOT_EVALUABLE rule: if there are no requirements and no role basis to evaluate relevance.

K. CONFLICT rule: requirement contradicts role facts or conditions.

L. Gate impact: can gate when requirement creates unsupported discriminatory or impossible constraint.

M. Synthetic examples:

- Weak: "Laurea richiesta" with no reason.
- Medium: "Esperienza CRM per gestione clienti".
- Strong: "Esperienza ticketing richiesta per qualificare richieste e passare casi tecnici al secondo livello".

N. Avoid: do not accept years of experience or "problem solving" by habit.

O. Future accelerator suitability: `LLM_COMPLEX`.

## Check 12 - Location And Work Mode

A. ID: `12`

B. Canonical question: "Sede e modalita di lavoro sono chiare?"

C. What it measures: whether the target clearly states where and how work happens.

D. Why it matters: location and work mode are major compatibility filters.

E. Target evidence: city/site, remote, hybrid, on-site, travel/mobility, territory, branch.

F. Context allowed: structured fields can clarify only if target includes or is evaluated together with those fields.

G. Anchors:

- 0: no location or work mode when applicable.
- 2: vague location/work mode such as "zona" or "flessibile" without clarity.
- 4: partial location or mode; important ambiguity remains.
- 6: basic sede/modalita clear enough for self-selection.
- 8: clear location and work mode, including mobility if relevant.
- 10: complete and consistent location/work mode information with no material ambiguity.

H. Intermediate values: allowed only between adjacent anchors.

I. MISSING rule: if location/mode is applicable and absent, score numerically.

J. NOT_EVALUABLE rule: only when location/mode is genuinely not applicable to the target.

K. CONFLICT rule: remote/on-site/hybrid contradictions are material conflicts.

L. Gate impact: material contradictions can block publication.

M. Synthetic examples:

- Weak: "Sede flessibile".
- Medium: "Milano, possibilita di smart working".
- Strong: "Milano zona Lambrate, 3 giorni in sede e 2 da remoto, nessuna trasferta".

N. Avoid: do not invent legal or policy obligations not present.

O. Future accelerator suitability: `DETERMINISTIC_CANDIDATE`.

## Check 13 - Contract, Schedule, Shifts, Timing

A. ID: `13`

B. Canonical question: "Contratto, orari, turni e tempi sono sufficientemente chiari?"

C. What it measures: whether time and contract conditions are clear enough for candidate decision.

D. Why it matters: vague time conditions produce mismatched applications and late-stage drop-off.

E. Target evidence: contract type, full/part time, duration, days, hours, shift windows, cadence, availability, start timing.

F. Context allowed: role context can identify relevant timing facts, but cannot fill target gaps.

G. Anchors:

- 0: no contract/time information when applicable.
- 2: vague "part-time con turni" or similar with insufficient detail.
- 4: some contract/time facts, but important gaps remain.
- 6: basic contract and schedule facts are understandable.
- 8: contract, schedule, shifts, and timing are clear where relevant.
- 10: complete, precise, and candidate-usable time/contract information.

H. Intermediate values: allowed only between adjacent anchors.

I. MISSING rule: expected contract/time facts absent from target are scoreable missing.

J. NOT_EVALUABLE rule: if no contract/time facts are relevant or available for legitimate reasons.

K. CONFLICT rule: contradictory hours, contract, or availability can trigger conflict.

L. Gate impact: material contradiction or unusable timing info can block publication.

M. Synthetic examples:

- Weak: "Part-time con turni".
- Medium: "Part-time 24 ore, turni da definire".
- Strong: "Part-time 24 ore, lun-sab, turni 6-10 o 17-21 comunicati con due settimane di anticipo".

N. Avoid: do not treat "turni" as complete information.

O. Future accelerator suitability: `CLOSED_DECISION_CANDIDATE`.

## Check 14 - Compensation Clarity

A. ID: `14`

B. Canonical question: "Il compenso e gestito con chiarezza quando e disponibile o necessario?"

C. What it measures: whether compensation is clear when known, available, necessary, or required.

D. Why it matters: compensation uncertainty can reduce trust and candidate fit, but not every missing RAL is automatically a defect.

E. Target evidence: salary, range, hourly rate, commission, bonus, CCNL/level, disclosure policy, explicit reason for not disclosing when appropriate.

F. Context allowed: known context can determine whether compensation was available/necessary, but if absent from original target it cannot raise original-ad score.

G. Anchors:

- 0: compensation known/required/necessary but completely omitted.
- 2: vague compensation phrase such as "commisurata all'esperienza".
- 4: partial or ambiguous compensation information.
- 6: basic compensation handling is understandable but incomplete.
- 8: clear range/formula/disclosure handling.
- 10: compensation is clear, specific, and appropriate to the context with no material ambiguity.

H. Intermediate values: allowed only between adjacent anchors.

I. MISSING rule: compensation known/available/necessary but absent is scoreable missing.

J. NOT_EVALUABLE rule: compensation genuinely not available and no rule/context makes it necessary.

K. CONFLICT rule: contradictory compensation figures or formulas can trigger conflict.

L. Gate impact: material compensation contradiction can block publication; absence may lower readiness depending on context.

M. Synthetic examples:

- Weak: "Retribuzione interessante".
- Medium: "RAL da definire in base all'esperienza".
- Strong: "RAL 28-32k, CCNL Commercio, premio variabile definito su obiettivi trimestrali".

N. Avoid: do not invent legal obligations; do not turn genuine N/D into zero.

Implementation caveat: a sentence that merely justifies not communicating compensation must not by itself produce a high score. Positive score must come from correct compensation handling according to available policy/context, not from an editorial excuse.

O. Future accelerator suitability: `CLOSED_DECISION_CANDIDATE`.

## Check 15 - Concrete Verifiable Offer Reasons

A. ID: `15`

B. Canonical question: "Esistono ragioni concrete e verificabili per considerare l'offerta?"

C. What it measures: whether the target gives factual reasons to consider the opportunity.

D. Why it matters: slogans do not help candidates decide and can create unsupported claims.

E. Target evidence: onboarding, training, autonomy, real problems, technologies, schedule, flexibility, support, team structure, concrete benefits.

F. Context allowed: company context can identify supportable proof points, but target must contain them for positive scoring.

G. Anchors:

- 0: no concrete reasons, or only unsupported claims.
- 2: generic slogans such as "azienda leader" or "ambiente stimolante".
- 4: some reasons present, but mostly generic or weakly verifiable.
- 6: basic concrete reasons exist, with limited evidence/detail.
- 8: several concrete, verifiable reasons are clear and relevant.
- 10: strong, specific, supportable reasons to consider the offer, with no inflated or unsupported claims.

H. Intermediate values: allowed only between adjacent anchors.

I. MISSING rule: if offer reasons are expected and absent, score numerically.

J. NOT_EVALUABLE rule: only when no offer context is legitimately available and no target claim exists to evaluate.

K. CONFLICT rule: unsupported, contradicted, or inflated benefits can trigger unsupported-claim flags and gate issues.

L. Gate impact: unsupported benefits can block generated output or require revision.

M. Synthetic examples:

- Weak: "Azienda leader, ambiente dinamico, crescita".
- Medium: "Formazione iniziale e affiancamento".
- Strong: "Due settimane di affiancamento, CRM gia configurato, autonomia progressiva su portafoglio clienti inbound".

N. Avoid: do not call a normal baseline a benefit without context.

O. Future accelerator suitability: `LLM_COMPLEX`.

## Check 16 - Channel Structure Fit

A. ID: `16`

B. Canonical question: "La struttura e adatta al canale in cui verra pubblicata?"

C. What it measures: whether the target structure fits the declared publication channel.

D. Why it matters: a good Master can fail when forced into the wrong channel structure.

E. Target evidence: channel, format, length, sectioning, field usage, opening, ordering, required structured fields.

F. Context allowed: channel policy can define expectations; without channel, do not invent platform rules.

G. Anchors:

- 0: declared channel structure is clearly unsuitable.
- 2: structure mostly ignores obvious channel constraints.
- 4: partial fit, but important structural issues remain.
- 6: usable basic channel fit.
- 8: strong channel structure fit.
- 10: structure is fully appropriate to declared channel and preserves facts.

H. Intermediate values: allowed only between adjacent anchors.

I. MISSING rule: declared channel with no structure fit is scoreable.

J. NOT_EVALUABLE rule: channel unknown or no explicit channel policy exists.

K. CONFLICT rule: channel variant alters Master facts or violates required fields.

L. Gate impact: channel-specific material mismatch can block publication.

M. Synthetic examples:

- Weak: long unstructured text for a field-constrained portal.
- Medium: sections present but too verbose for channel.
- Strong: Master adapted into channel fields without changing facts.

N. Avoid: do not invent platform rules without a documented channel policy.

Implementation caveat: complete V2 channel policies do not exist yet. Until a channel policy is explicit, Check 16 can be `NOT_EVALUABLE`; the scoring core must not invent LinkedIn, Indeed, Meta, ATS, or other platform rules.

O. Future accelerator suitability: `CLOSED_DECISION_CANDIDATE`.

## Check 17 - Text, Fields, Destination Coherence

A. ID: `17`

B. Canonical question: "Testo, campi del portale e destinazione raccontano gli stessi fatti?"

C. What it measures: factual consistency across ad body, structured fields, and application destination.

D. Why it matters: inconsistencies create candidate confusion and operational risk.

E. Target evidence: body text, structured portal fields, metadata, destination URL/email, application instructions.

F. Context allowed: system fields can be compared when they are part of the evaluated target bundle.

G. Anchors:

- 0: material contradictions across text/fields/destination.
- 2: multiple inconsistencies or missing fields create high confusion.
- 4: partial coherence with meaningful discrepancies.
- 6: mostly coherent with minor gaps.
- 8: coherent across available fields with no material contradiction.
- 10: complete alignment across text, fields, and destination.

H. Intermediate values: allowed only between adjacent anchors.

I. MISSING rule: if comparable fields are expected and absent, score numerically.

J. NOT_EVALUABLE rule: only text is available and no fields/destination can be compared.

K. CONFLICT rule: material contradiction is a conflict by definition.

L. Gate impact: material contradictions can block publication.

M. Synthetic examples:

- Weak: body says remoto, field says in sede.
- Medium: body says Milano, destination form says Lombardia generico.
- Strong: body, fields, and apply URL all state same role, location, and contract.

N. Avoid: do not penalize lack of portal fields when only free text is available; use N/D.

O. Future accelerator suitability: `DETERMINISTIC_CANDIDATE`.

## Check 18 - Readability And Scannability

A. ID: `18`

B. Canonical question: "L'annuncio si legge e si scandisce facilmente?"

C. What it measures: whether the target is easy to read, scan, and navigate.

D. Why it matters: candidates often scan quickly; poor structure hides useful facts.

E. Target evidence: sections, headings, paragraph length, bullet structure, order, density, hierarchy.

F. Context allowed: channel can influence expected length and structure, but cannot replace target readability.

G. Anchors:

- 0: unreadable or incoherent structure.
- 2: dense, disordered, hard to scan.
- 4: some structure, but significant density/order issues.
- 6: readable enough, with clear improvement opportunities.
- 8: clear hierarchy and good scanning.
- 10: very clear, well-ordered, scannable structure without hiding facts.

H. Intermediate values: allowed only between adjacent anchors.

I. MISSING rule: if readable structure is expected but absent, score numerically.

J. NOT_EVALUABLE rule: target too short or format too constrained to assess readability fairly.

K. CONFLICT rule: not usually a conflict unless structure hides contradictory required facts.

L. Gate impact: usually not hard gate; can affect readiness.

M. Synthetic examples:

- Weak: single dense paragraph.
- Medium: sections exist but are long and repetitive.
- Strong: concise sections for role, work, requirements, conditions, application.

N. Avoid: do not turn readability into subjective visual taste.

O. Future accelerator suitability: `CLOSED_DECISION_CANDIDATE`.

## Check 19 - Concrete Precise Language

A. ID: `19`

B. Canonical question: "Il linguaggio e concreto, preciso e privo di ripetizioni inutili?"

C. What it measures: whether the wording avoids vagueness, cliches, bloating, and repetition.

D. Why it matters: concrete language improves trust and candidate understanding.

E. Target evidence: concrete verbs, specific nouns, repetition, cliches, buzzwords, bureaucratic phrases, inflated language.

F. Context allowed: role context can identify terms that are precise vs decorative.

G. Anchors:

- 0: language is mostly vague, inflated, repetitive, or unusable.
- 2: many cliches/buzzwords and little concrete information.
- 4: some concrete language, but generic wording remains dominant.
- 6: generally understandable and useful, with notable vagueness/repetition.
- 8: concrete, precise, and mostly concise.
- 10: consistently concrete, precise, economical language with no material filler.

H. Intermediate values: allowed only between adjacent anchors.

I. MISSING rule: if the target lacks concrete wording for material facts, score numerically.

J. NOT_EVALUABLE rule: only when target text is too limited to evaluate language.

K. CONFLICT rule: inflated unsupported claims can also trigger unsupported flags.

L. Gate impact: unsupported language can affect gate; generic language is usually quality issue.

M. Synthetic examples:

- Weak: "persona dinamica, proattiva, motivata".
- Medium: "gestione clienti e attivita operative".
- Strong: "riceverai richieste clienti, aggiornerai ticket e segnalerai anomalie al reparto tecnico".

N. Avoid: do not penalize necessary technical terms when they are precise.

O. Future accelerator suitability: `LLM_COMPLEX`.

## Check 20 - Application Clarity

A. ID: `20`

B. Canonical question: "Una persona sa esattamente come candidarsi?"

C. What it measures: whether the candidate has a usable next action.

D. Why it matters: unclear or invalid application instructions waste interest and reduce conversions.

E. Target evidence: email, URL, application button/path, required subject, documents, deadline, next step.

F. Context allowed: structured destination can count only if part of the evaluated target bundle.

G. Anchors:

- 0: no application path, or destination unusable/invalid.
- 2: vague CTA such as "Invia CV" without destination.
- 4: partial application instruction, but destination or required action incomplete.
- 6: usable basic CTA with minor ambiguity.
- 8: clear application destination and instructions.
- 10: exact, valid, candidate-usable application path with any necessary details.

H. Intermediate values: allowed only between adjacent anchors.

I. MISSING rule: expected CTA absent is missing and scoreable.

J. NOT_EVALUABLE rule: only when target format genuinely does not require an application instruction.

K. CONFLICT rule: invalid destination or conflicting destinations can trigger conflict.

L. Gate impact: unusable or invalid CTA can block publication.

M. Synthetic examples:

- Weak: "Invia CV".
- Medium: "Candidatura via email con CV".
- Strong: "Invia il CV a candidature@example.com indicando nell'oggetto Customer Care Specialist".

N. Avoid: do not assume a visible platform button exists unless the evaluated target includes it.

O. Future accelerator suitability: `DETERMINISTIC_CANDIDATE`.

## Cross-Cutting Conflict And Unsupported Claim Rules

Score measures quality of a criterion. Flags/gates manage material anomalies:

- material contradictions;
- unsupported claims;
- unusable CTA;
- channel variant altering facts;
- inconsistencies between fields.

High score never cancels a gate issue.

## Context Capsule Requirement

Future AI calls must not automatically receive the entire funnel history.

Operational source of truth should be structured:

`raw answers -> normalized facts -> RoleCard -> RoleProfile -> Strategy -> current snapshot`

Future AI calls should receive a Context Capsule specific to the operation, containing only required data.

Conceptual capsule sections:

- `ROLE`
- `RESULT`
- `ACTIVITIES`
- `REQUIREMENTS`
- `CONTEXT`
- `CONDITIONS`
- `OFFER`
- `STRATEGY`
- `MISSING`
- `CONFLICTS`
- `DO_NOT_CLAIM`

Ownership:

- TypeScript owns the first deterministic projection.
- A future accelerator may help select semantically relevant blocks only after benchmark validation.
- The primary LLM receives the capsule needed for the operation, not raw unbounded history.

Goals:

- reduce token usage;
- preserve auditability;
- avoid context drift;
- protect against prompt injection;
- keep original target, normalized facts, and generated facts distinct.

What must not be lost:

- original target text reference;
- fact provenance;
- user-confirmed vs system-inferred distinction;
- missing facts;
- conflicts;
- unsupported claims;
- publication constraints;
- `DO_NOT_CLAIM` list.

Do not implement Context Capsule in this phase.

## OPEN QUESTIONS BEFORE IMPLEMENTATION

1. Minimum coverage threshold for publishing a V2 score is still `OPEN`.
2. Customer-facing rounding policy for `finalScore` is still open, with integer rounding preferred.
3. Exact runtime status enum names for V2 per-control output are open.
4. Confidence thresholds for retry, human review, or fallback are open.
5. Stability tolerance for repeated same-target/same-model/same-prompt evaluations is open pending real calibration data.
6. Channel policies for specific platforms must be written before Check 16 can be fully automated.
