# Annunci 10x funnel redesign

Status: FASE 2E.1 implemented. This phase is visual, copy, UX, and commercial
positioning only.

## Page Order

Final page order:

1. Hero compatta e pain-first
2. Pain
3. Conseguenze
4. Per chi e / beneficio
5. Soluzione: perche partire dall annuncio
6. Come funziona
7. Analyze vs Create
8. Workspace / flow interattivo
9. Metodo Annunci 10x
10. 20 controlli / 4 lenti
11. Esempi ruoli
12. Horyzon Recruiting bridge
13. Final CTA

Removed from the landing:

- "Per chi non e"
- Product ladder
- Price grid
- Agent Recruiter promotional block
- Credit note

## Hero Correction

Canonical headline:

`Le persone giuste esistono. Il tuo annuncio riesce ad attirarle?`

Supporting copy:

`Se ricevi CV fuori target, fai colloqui che non portano a nulla o rimandi una sostituzione perche temi di non trovare alternative, il problema puo iniziare da come stai presentando il ruolo. Scoprilo gratis con Annunci 10x Score.`

Primary CTA:

`Calcola gratis il tuo Annunci 10x Score`

Secondary CTA:

`Devo creare un annuncio da zero`

The hero was corrected from a near-full-viewport section to a compact commercial
hero. The target behavior is that eyebrow, H1, supporting copy, primary CTA, and
secondary CTA are visible above the fold on common laptop viewports.

## Hero Asset

Final asset path:

`public/annunci-10x/hero.jpeg`

The page uses the user-provided canonical image through `next/image` with
`fill`, `sizes="100vw"`, and `preload`. Desktop and mobile use the same image;
only CSS object position, overlay, and spacing adapt by viewport.

## Pain Positioning

Pain headline:

`Il problema non e avere piu CV. E trovare la persona giusta.`

Four primary pains:

- Tanti CV. Pochi candidati davvero adatti.
- Colloqui che non portano a una scelta.
- Hai bisogno di sostituire qualcuno, ma non trovi alternative.
- La crescita si ferma perche manca la persona giusta.

Consequence framing:

`Una posizione scoperta o coperta dalla persona sbagliata non resta un problema HR.`

The page focuses on time, manager load, errors, delays, lost opportunities, team
overload, and slowed growth. No invented statistics are used.

## Audience Focus

Audience headline:

`Se assumere sta diventando un freno, Annunci 10x e per te.`

The section is situation-first rather than role-list-first. The primary target
is an entrepreneur or business owner with a real hiring problem, followed by HR
or internal recruiters, growing companies blocked by hiring, and companies that
need to replace a mismatched person.

Consultants remain a secondary audience only when they work on concrete client
roles.

## Solution Framing

The solution appears only after pain, consequences, and audience:

`Prima di cambiare portale, aumentare budget o concludere che i candidati non esistono, controlla il punto da cui tutto comincia: l annuncio.`

Annunci 10x Score is presented as the free first check to understand whether the
ad explains the real role to the right person.

## Commercial Reveal Principle

The landing exposes only the free score entry point.

Paid offers are intentionally not shown as a catalog:

- rewrite appears only after an analyzed existing ad and a user decision to
  improve it;
- create appears only after the user completes the information needed to create
  from zero, immediately before generation;
- Agent Recruiter appears only as a contextual upsell at the appropriate moment.

This phase does not implement purchase moments, checkout, or provider
integrations.

## Analyze And Create

Unchanged:

- Analyze behavior
- Create behavior
- result gate
- AnalysisRun architecture
- email verification
- Supabase persistence
- scoring
- OpenAI provider
- premium backend
- commercial domain logic

Visual priority is Analyze / free score. Create remains available as a
secondary path.

## Method Presentation

Central principle:

`Prima la realta del ruolo. Poi le parole.`

The method section supports the commercial promise: Annunci 10x does not polish
a wrong description. It starts from work, person, conditions, and attractiveness.

## Pending

Still pending by design:

- real email provider integration;
- payment / checkout implementation;
- public V2.3 scoring activation.
