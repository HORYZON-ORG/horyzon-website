# Annunci 10x funnel redesign

Status: FASE 2E implemented. This phase is visual, copy, UX, and commercial
presentation only.

## Information Architecture

Final page order:

1. Hero
2. Pain / problema
3. Conseguenze
4. Come funziona
5. Analyze vs Create
6. Workspace / flow interattivo
7. Metodo Annunci 10x
8. 20 controlli / 4 lenti
9. Esempi ruoli
10. Per chi e / per chi non e
11. Value ladder
12. Agent Recruiter
13. Horyzon Recruiting bridge
14. Final CTA

The page is intentionally concise. It does not expose rubric, provider,
scoring, prompt, or database internals.

## Hero

Canonical headline:

`Le persone giuste esistono. Il tuo annuncio riesce ad attirarle?`

Supporting copy:

`Scopri in pochi minuti quanto il tuo annuncio riesce davvero a spiegare il ruolo, attirare persone coerenti e ridurre candidature fuori target.`

Primary CTA:

`Calcola gratis il tuo Annunci 10x Score`

Secondary CTA:

`Devo creare un annuncio da zero`

Both CTAs select the corresponding path and scroll/focus to the interactive
workspace.

## Hero Asset

Final asset path:

`public/annunci-10x/hero.jpeg`

The file was copied from the user-provided canonical image without generative
editing, scene changes, skyline changes, people changes, relighting, or stock
image replacement.

The original image is 1600x900. The page uses `next/image` with `fill`,
`sizes="100vw"`, and `preload` for the above-the-fold hero.

Desktop composition preserves the full cinematic image and uses the darker left
side as the text area with a light left-weighted overlay.

Mobile composition keeps the same file and changes only CSS crop/overlay. It
keeps the hero legible and avoids a separate mobile image.

## Visual Direction

The visual system uses:

- blue / blue-gray Horyzon base;
- light editorial surfaces;
- warm sunset-inspired neutrals;
- disciplined lime accent for primary action and progress.

It avoids generic AI gradients, neon, glassmorphism, heavy black filters, fake
glow, and stock-style replacements.

## Pain And Consequences

Pain framing:

- tanti CV, pochi davvero coerenti;
- annunci che sembrano tutti uguali;
- ruoli descritti in modo troppo vago;
- difficolta nel sostituire una persona sbagliata.

Business consequence framing:

- tempo perso;
- selezioni piu lunghe;
- manager assorbiti dal recruiting;
- persone fuori ruolo;
- errori operativi;
- crescita frenata.

No unapproved statistics are used.

## Method Presentation

Central principle:

`Prima la realta del ruolo. Poi le parole.`

Visual sequence:

`Lavoro reale -> Persona necessaria -> Strategia -> Annuncio -> Verifica`

Four lenses:

- Popolarita
- Sfida / Routine
- Qualificazione
- Tecnicita

The 20 controls are communicated through high-level categories only:

- chiarezza del ruolo;
- attivita reali;
- risultato atteso;
- requisiti;
- condizioni;
- offerta;
- candidatura;
- coerenza complessiva.

The complete rubric is not rendered in the landing page.

## Commercial Ladder

The public commercial presentation shows:

- €0 Annunci 10x Score
- €7 Migliora il tuo annuncio
- €9 Crea il tuo annuncio da zero
- €49 Agent Recruiter

This is presentation only. There is no payment implementation, no cart, no
checkout modal, no coupon, no scarcity, and no fake purchasing action.

The €7 product is described as improving an existing analyzed ad into a clearer,
more coherent version ready to adapt to the channel.

The €9 product is described as creating an ad from the real role facts, with
generation available in a later step.

Agent Recruiter is described as a future reusable package: Premium Guide,
Annunci 10x method, assistant setup, and reusable recruiting process.

The credit toward Agent Recruiter is mentioned only lightly and without
transactional logic.

## Analyze Integration

`Annunci10xAnalyzeFlow` keeps the FASE 2D behavior:

- pasted text and public URL source modes;
- immediate AnalysisRun start;
- polling while the contact form is available;
- email verification gate;
- locked result state before email verification;
- verified-waiting state while analysis completes;
- result fetch only through the gated result API.

The visual treatment was redesigned:

- segmented source selector;
- premium form surfaces;
- progress rail using safe status copy;
- lighter contact form;
- OTP form with customer-safe copy;
- result card focused on score, coverage, optional band, interpretation, and
  next action.

The UI no longer displays internal migration terms, provider names, mock/test
labels, runtime internals, prompt/stage names, or checkout status.

## Create Integration

The Create path remains semantically unchanged:

- no wizard rewrite;
- no backend changes;
- no answer semantic changes;
- no clarification behavior changes;
- no entitlement or premium pipeline changes.

Only spacing, hierarchy, and presentation were aligned to the new funnel.

## Responsive And Accessibility

Responsive decisions:

- desktop hero uses the left dark image area for text;
- mobile keeps one canonical image and changes only object position and overlay;
- grids collapse to one column below tablet widths;
- buttons expand to full width on narrow screens;
- workspace cards keep stable widths and avoid horizontal overflow.

Accessibility:

- one H1;
- semantic section headings;
- real form labels;
- focus-visible states;
- button semantics for CTAs and selectors;
- aria-live preserved for progress and status;
- OTP attributes preserved;
- reduced-motion media query gates progress animation.

## Backend And Operations

Unchanged:

- AnalysisRun architecture;
- result eligibility;
- email verification persistence;
- OTP lifecycle;
- Supabase schema;
- rate limits;
- scoring formula;
- V1 evaluation behavior;
- V2 rubric and prompts;
- provider selection.

Pending:

- real email provider integration;
- payment/checkout implementation;
- public V2.3 scoring activation.

