# Annunci 10x funnel redesign

Status: FASE 2E.2 implemented. This phase is visual, copy, UX, and editorial
flow only.

## Editorial Flow

The landing now follows a simpler Hook -> Story -> Offer structure:

1. Hero compatta
2. Story / pain narrative
3. Central insight
4. Free-score solution
5. Compact how-it-works timeline
6. Workspace
7. Method / reason to believe
8. Role examples
9. Horyzon Recruiting bridge
10. Final CTA

The previous pain cards, isolated audience section, solution block, and
Analyze/Create marketing choice cards were merged into a continuous editorial
area before the workspace.

## Language Pass

The public Annunci 10x UI received an Italian grammar, accent, and apostrophe
pass across the landing, Analyze flow, and Create flow.

Examples corrected include:

- perché, può, più, finché, già;
- realtà, responsabilità, opportunità, attività, modalità;
- tecnicità, stabilità, complessità, ciò, sarà, dovrà;
- l’annuncio, dell’annuncio, l’azienda, dell’imprenditore;
- un’alternativa, l’analisi, c’è, quell’opportunità.

## Hero

Canonical headline:

`Le persone giuste esistono. Il tuo annuncio riesce ad attirarle?`

Supporting copy:

`Ricevi CV fuori target? Fai colloqui che non portano a una scelta? O rimandi una sostituzione perché temi di non trovare alternative? Prima di aumentare budget o cambiare portale, verifica se il problema parte dall’annuncio.`

Micro-line:

`Scoprilo gratis con Annunci 10x Score.`

Primary CTA:

`Calcola gratis il tuo Annunci 10x Score`

Secondary CTA:

`Devo creare un annuncio da zero`

The hero keeps the compact 2E.1 behavior and does not return to a near-full
viewport layout.

## Story

Story headline:

`Il problema non è avere più CV. È arrivare alle persone giuste.`

Story beats:

- Pubblichi un annuncio. Arrivano candidature. Ma molte non c’entrano davvero
  con il lavoro.
- Fai colloqui. Sulla carta sembravano candidati adatti. Poi scopri che ruolo,
  responsabilità e aspettative erano stati capiti in modo diverso.
- Intanto il team copre il vuoto, i manager perdono tempo e una posizione che
  doveva sostenere la crescita diventa un freno.
- Oppure rimandi una sostituzione perché trovare un’alternativa sembra ancora
  più difficile che convivere con il problema.

The target is integrated into the story, with primary focus on entrepreneurs and
business owners, followed by HR and internal recruiting teams.

## Central Insight And Offer

Central insight:

`L’annuncio inizia a selezionare prima ancora che arrivi il primo CV.`

Offer explanation:

`Annunci 10x Score controlla gratuitamente se il tuo annuncio sta spiegando il lavoro reale alla persona giusta.`

The copy intentionally avoids promising hiring outcomes. It states that the
product clarifies role, activities, requirements, conditions, and expectations.

## Cards Reduction

Marketing content moved away from repeated boxed sections. The page now uses:

- open editorial rows;
- large statements;
- subtle dividers;
- wider reading measures;
- one compact timeline;
- functional boxes only for forms, OTP, result, and Create workflow states.

The workspace remains the main visual mode change.

## Typography And Measure

Marketing body copy was raised toward a 1.15rem-1.3rem range, important leads
toward 1.3rem+, and story statements toward large editorial sizes. Paragraphs
use comfortable reading widths around 55-66ch where appropriate.

## Workspace Position

The workspace now appears immediately after:

Hero -> Story -> Insight / Solution -> How it works

This removes the long marketing runway from 2E.1 and brings the interactive
product closer to the initial hook.

## Method Presentation

The reason-to-believe section remains after the workspace:

`Prima la realtà del ruolo. Poi le parole.`

Subcopy:

`Un annuncio efficace non nasce da una frase più creativa. Nasce da una comprensione più precisa del lavoro e della persona che serve.`

The method sequence and four lenses remain, but they are presented as a flow and
open columns instead of heavy cards.

The 20-controls statement is now a large editorial question rather than a box:

`20 controlli. Una domanda sola: questo annuncio aiuta la persona giusta a capire se questo è davvero il lavoro per lei?`

## Commercial Reveal

No commercial price reveal is shown on the landing.

Paid moments remain contextual and out of scope for this phase:

- rewrite after an analyzed existing ad and a user decision to improve it;
- create after the user completes the role information needed for generation;
- Agent Recruiter only as a contextual upsell at the appropriate later moment.

## Unchanged

Unchanged by design:

- Analyze behavior;
- Create behavior;
- result gate;
- AnalysisRun architecture;
- email verification;
- Supabase persistence;
- scoring;
- OpenAI provider;
- premium backend;
- commercial domain logic;
- checkout state.
