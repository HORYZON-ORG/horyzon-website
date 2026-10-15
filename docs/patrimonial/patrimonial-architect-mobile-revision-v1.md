# Revisione visiva/mobile Architetto

Baseline: `03209c3861517c993ac5028cdb1e0c7c9ccbc87c`. Scope: solo `/benessere-patrimoniale/percorso-architetto-patrimoniale`, branch `feat/patrimonial-pilot-funnels`.

La richiesta utente allegata prevale sul documento di supporto. I file effettivi consegnati sono `index (6).html`, `PROMPT-PER-CHATGPT (6).md`, 12 JPG e i quattro screenshot `1-hero`, `2-scene`, `3-ruolo`, `4-form`. L'HTML è stato letto per intero. È una revisione dei componenti esistenti, senza ricostruzione della landing o del form.

## File

| File | Modifica |
| --- | --- |
| `src/components/patrimonial-architect-landing.tsx` | Classi mobile/reveal, due indicazioni swipe, aree carosello accessibili da tastiera, colori delle SVG; stato/profili/osservatori e session clock invariati |
| `src/components/patrimonial-architect.module.css` | 196 dichiarazioni esistenti aggiornate al nuovo HTML, palette canonica e intero blocco mobile 700px |
| `src/components/patrimonial-architect-form.tsx` | Solo colore SVG della profile note: usa `var(--olive)`; campi e logica invariati |
| `scripts/verify-patrimonial-architect-browser.mjs` | Quattro viewport, caroselli interni, schema/timeline, ticket, form e regressioni; motion/reduced motion |
| `scripts/verify-patrimonial-architect-presentation.mjs` | Nuovi controlli statici: logica e form confrontati con baseline, nessun dato sessione inventato |
| `scripts/verify-patrimonial-event-presentation.mjs` | Aggiornato il perimetro dei pin: la revisione visiva Architetto autorizzata ha il proprio test; Evento/backend restano vincolati alla baseline |
| Questo documento | Scope, asset, verifiche e limiti |

## Palette e desktop

Ink `#07171D`, ink-2 `#102229`, ink-3 `#16303A`, lime `#D8FF42`, olive `#5F7010`, cream `#F7F4E8`, sand `#EFEDE6`, muted `#A3B1B0`, soft-dark `#CDD6D4`, soft-light `#41545A`. Ink e lime riusano i token globali esistenti; i token mancanti sono dichiarati esclusivamente sulla pagina, senza alterare il sito o Evento. Le trasparenze mantengono gli RGBA del nuovo HTML.

Accenti oro/ottone rimossi dall'interfaccia Architetto. CTA principali lime/scuro, raggio 6px, peso 800; chip profilo conservano la forma tonda e i valori previsti dal sorgente. Space Grotesk / IBM Plex Sans / IBM Plex Mono e i relativi `next/font` già esistenti restano invariati. Desktop segue le dichiarazioni del nuovo HTML; sopra 700px tornano griglie, flussi e roadmap desktop, con wrapping naturale a 768px come nel sorgente.

## Mobile

- Hero verticale e padding ridotti; CTA primaria full-width, topbar compatta e ticket a 12px dai bordi dentro la foto.
- Numeri in griglia 2×2.
- Scene e testimonianze in due caroselli orizzontali: card 84% dello spazio del contenitore, snap al centro, gap 14px, scrollbar nascosta, indicazione «SCORRI LE SCHEDE →». Lo scorrimento è interno e non allarga la pagina. Le regioni hanno nome accessibile, focus visibile e rispondono alle frecce della tastiera.
- La selezione profilo mantiene sottotitolo/CTA, scena con bordo e badge lime, testimonianza corrispondente e profile note. Nessun cambiamento al mapping UI→API: «Sto esplorando» resta `Altro`.
- Schema ruolo in colonna con nodo Architetto centrale e linee verticali animate; tavola edificio/annotazioni in colonna.
- Roadmap come timeline verticale: traccia/progresso a sinistra, nodi e testi allineati, spaziatori desktop nascosti.
- Form a una colonna, padding 24px/18px, progress bar lime, CTA scura con testo lime full-width. Il passo 1 non invia; provincia e campi del passo 2 mantengono contratto e comportamento.
- Sticky CTA su una riga con posti e pulsante, raggio 14px e `calc(16px + env(safe-area-inset-bottom, 0px))`. Gli IntersectionObserver esistenti la nascondono su hero e sezione form; quando nascosta è anche `inert`/`aria-hidden`.
- Animazioni di ingresso aggiunte solo dentro `@supports (animation-timeline: view())`; nessuna opacity iniziale nascosta fuori da quel miglioramento progressivo. `prefers-reduced-motion` disattiva ingresso, pulse e flow.

Conservate le protezioni di larghezza già presenti per le griglie da 320/340px. Il ticket mantiene il contenimento tablet; su mobile valgono i valori nuovi del sorgente. Nessuna modifica globale per correggere il layout.

## Asset e dati

Ricopiati senza ritocchi nei percorsi esistenti: `hero.jpg`, `scene-domenica.jpg`, `scene-caffe.jpg`, `scene-opportunita.jpg`, `blueprint.jpg`, `founder.jpg`, `story-1.jpg`, `story-2.jpg`, `story-3.jpg`, `stuck.jpg`, `new.jpg`, `skyline.jpg` sotto `public/benessere-patrimoniale/percorso-architetto/`.

Tutti e 12 gli allegati risultano byte-identici agli originali già presenti nella baseline: la copia è stata verificata, quindi non ci sono delta binari nel commit e i nomi runtime restano gli stessi. Immagini AI provvisorie; nessun video o contenuto operativo attivato.

`src/content/patrimonial-architect-session.ts` è invariato: `status: PLACEHOLDER`, `sessionDate: null`, posti null. Non importati `2026-10-29T18:30:00+01:00`, 40 o 27 dal demo HTML. La UI conserva la struttura del countdown con trattini e posti `[N]`, mentre la topbar dice «CHIUSURA DA CONFERMARE» e mantiene l'indicazione pilot su desktop. Questo è il solo adeguamento del copy demo necessario per rispettare la richiesta di non fabbricare disponibilità. Nessun collegamento a un'edizione CRM.

Preservati `[N]`, `[N]%`, `[DURATA]`, `[NOME FONDATORE]`, `[Ruolo]`, `[DATA SUCCESSIVA]`, testimonianze, nota sul perimetro del ruolo, risposte compliance e modello economico. Da confermare prima della produzione: dati sessione, disponibilità, testimonianze, foto reali, contenuti operativi e sezioni ruolo/FAQ. Nessuna attestazione di conformità introdotta.

## Verifica

Browser locale: 360 / 390 / 768 / 1440 px. Verificati assenza di overflow orizzontale della pagina, scroll/snap/tastiera solo dentro i caroselli mobile, hint, schema ruolo, roadmap, griglia numeri, ticket nella foto, form, sticky, profili, scene/story highlight, passo 1→2 senza POST, payload finale, guard doppio invio, errore/riprova, thank-you e noindex/nofollow. Verificati reduced motion e card visibili con motion attivo. Il fallback dei browser senza view timelines è garantito dalla struttura CSS `@supports`; non è stato eseguito un motore browser privo della feature.

Regressione Evento: presentazione e browser 390/768/1440 PASS; 41 file protetti Evento/backend e 8 asset Evento identici alla baseline. Suite patrimonial, persistence, CRM, opportunities e remote mapping PASS tramite provider/store fake locali. Typecheck senza emissione con `tmp/` escluso soltanto in memoria; ESLint e diff check sui file pertinenti.

Ogni POST browser è intercettato e risposto prima del server. Solo GET verso il server locale, tutte le altre chiamate bloccate. Nessun live smoke o write CRM/Supabase. Backend, `/api/public-leads`, trasporto condiviso, form/payload, UTM, consensi, honeypot, timeout, replay/idempotenza, opportunity/outbox, thank-you, session config, env/flag, shell e funnel Evento invariati. Nessun merge/push main o deploy manuale/produzione.
