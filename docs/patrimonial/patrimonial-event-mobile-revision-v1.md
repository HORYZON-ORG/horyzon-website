# Evento patrimoniale — revisione mobile della preview

Baseline approvata: `1a3061098ad5601918564c0de5dfad3ba5fe771d`, branch `feat/patrimonial-pilot-funnels`. Scope esclusivo: presentazione di `/benessere-patrimoniale/evento`. La pagina Architetto conserva integralmente pagina, CSS, form, logica, configurazione e asset.

## Fonti e precedenza

La richiesta nel testo incollato prevale sulle istruzioni del documento di supporto. Fonti effettive: `index (8).html`, letto integralmente; `PROMPT-PER-CHATGPT (8).md`; desktop 01–06 e mobile 01–10; otto JPG originali. Il suffisso degli allegati effettivi differisce da quello citato nel testo. Nessuna ricerca web, immagine rigenerata o nuova dipendenza.

La revisione mantiene componenti, 18 parti della pagina, stato React e contratti già validati. Il CSS locale conserva le identità `s000…s222` e adatta le dichiarazioni al riferimento, evitando cambiamenti a CSS globale o altre route.

## File modificati

| File | Modifica |
| --- | --- |
| `src/app/(patrimonial-pilot)/benessere-patrimoniale/evento/page.tsx` | Manrope e JetBrains Mono tramite `next/font/google`, limitati alla route; metadata invariati |
| `src/components/patrimonial-event-landing.tsx` | Classi della nuova presentazione, quattro regioni swipe accessibili, chip titoli, hint, timeline, chiusura e footer |
| `src/components/patrimonial-event.module.css` | Palette, tipografia, layout a 820px, form scuro, motion e safe area |
| `src/components/patrimonial-event-form.tsx` | Classe CTA e contenitore inline dell'etichetta cellulare; comportamento invariato |
| `scripts/verify-patrimonial-event-presentation.mjs` | Pin della baseline per backend, Architetto, logica Evento, form condiviso e 20 asset; contratto del nuovo design |
| `scripts/verify-patrimonial-event-browser.mjs` | Verifica 360/390/768/1440, caroselli/tastiera, font, palette, timeline, hero, motion e form già esistente |
| `docs/patrimonial/patrimonial-event-mobile-revision-v1.md` | Questo resoconto e limiti della preview |

Gli otto file runtime in `public/benessere-patrimoniale/evento/` sono verificati byte per byte contro gli allegati più recenti e sono identici: `hero.jpg`, `pyramid.jpg`, `coins.jpg`, `single.jpg`, `s_bank.jpg`, `s_business.jpg`, `s_cart.jpg`, `s_hourglass.jpg`. Nessuna sostituzione binaria necessaria; gli screenshot non diventano asset del sito.

## Presentazione

| Token | Colore |
| --- | --- |
| ink / ink-2 / ink-3 / ink-deep | `#07171D` / `#102229` / `#16303A` / `#040E12` |
| lime / olive | `#D8FF42` / `#5F7010` |
| cream / sand | `#F7F4E8` / `#EFEDE6` |
| muted / soft-dark / soft-light | `#A3B1B0` / `#CDD6D4` / `#41545A` |
| loss | `#FF9D7A` |

Nessun accento oro nell'interfaccia. Manrope per testo e titoli, titoli 800 con tracking negativo; JetBrains Mono per label, eyebrow, preset e microcopy tecnico. Le cifre grandi del countdown e del calcolatore mantengono Manrope 800, come nell'HTML. CTA lime/ink, variante ink/lime nelle sezioni lime, radius 6px.

Sotto 820px: immagine hero in alto, testo con padding superiore 250px, countdown a quattro colonne, CTA e riprova sociale impilate, disponibilità a tutta larghezza. Quattro caroselli con scroll-snap e schede 84% per scene, domande, confronto oro e testimonianze; hint dedicati visibili solo su mobile e regioni con nome accessibile e focus da tastiera. La scena selezionata conserva `aria-pressed`, bordo ink, alone lime, spunta e pannello dinamico a tutta larghezza.

Calcolatore scuro, valore lime, perdita corallo e preset rettangolari; le monete seguono il pannello su mobile, con tag ridotti e riposizionati. Piramide con label desktop ed elenco prima dell'immagine su mobile. Sei domande su lime, ultima card scura. Timeline orizzontale desktop e verticale mobile con linea a sinistra, nodi 1–4 e ?. Audience su due card impilate su mobile. Frank conserva FC e placeholder, ritratto alto 320px su mobile. Testimonianze e value stack conservano testo e placeholder. FAQ con `details/summary` e plus olive; chiusura con chip «per fortuna». Footer ink-deep e link reali `/privacy-policy`, `/cookie-policy`, `mailto:info@horyzon.it`.

Sticky CTA: titolo/data/countdown/posti su desktop; solo pulsante a tutta larghezza su mobile; padding inferiore con `env(safe-area-inset-bottom)`. Cascade hero, live-dot e secondi animati; reveal titoli solo dentro `@supports (animation-timeline: view())`; feedback al tocco, hover senza trasformazione su touch e disattivazione animazioni/transizioni con reduced motion.

Adattamenti intenzionali rispetto al mockup: griglie con minimi limitati allo spazio disponibile; pannello scena e CTA impediscono overflow; etichette monete restano dinamiche; telefono facoltativo senza promessa WhatsApp; cognome e provincia nel micro-step finale; fine print sulla richiesta non definitiva; policy link reali. I font caricati correttamente e un countdown acquisito in momenti diversi non consentono identità raster con screenshot che usano font di ripiego.

## Form, sessione e backend

Il form mantiene primo passaggio nome/email/cellulare facoltativo/privacy e profilo; il primo submit valida e apre «Ci manca solo questo» senza POST. Cognome e provincia sono obbligatori nel secondo passaggio. Focus, ritorno con valori conservati, validazione, honeypot, UTM, timeout 35 secondi, anti doppio invio, errore/riprova e redirect `/evento/grazie` restano nel motore condiviso originale. Mapping: Privato→Privato, Imprenditore→Imprenditore, Professionista→Professionista, Genitore / famiglia→Altro. `marketingConsent=false`, nessun `eventEditionId` derivato dal mockup.

`eventSession.status=PLACEHOLDER`: 19 novembre 2026 ore 21, 100 totali / 68 occupati / 32 residui sono valori DEMO VISUAL VALUES. DOM e snapshot conservano la marcatura demo. Clock unico e formula sono invariati. Nessuna disponibilità reale, prenotazione o edizione CRM è creata da questi dati. Non si abilita V2 né alcun feature flag.

Il test statico confronta 43 file di backend/configurazione/logica/form condiviso/Architetto e 20 asset con la baseline approvata. API, payload, store, provider, mapping remoto, migrazioni, consensi, shell, contenuti e clock restano invariati. Nessuna modifica a navigazione, sitemap, thank-you, env o flag. `tmp/` preesistente non letto come sorgente, modificato o incluso nel commit.

## Review prima della produzione

**DATA/COMPLIANCE REVIEW REQUIRED BEFORE PRODUCTION**

Restano da verificare dato +17,1%, periodo 2021–2025, attribuzione ISTAT e copy interpretativo sull'inflazione. Nessuna verifica esterna in questa fase. Formula preservata: `lostRaw = amount * (1 - 1 / 1.171)`, `lost = Math.round(lostRaw / 100) * 100`, `perDay = lostRaw / 1826`, formato it-IT. A 100k: 85.400 €, −14.600 €, 8,00 €/giorno. Range 10k–1M, passo 10k; preset 50k/100k/250k/500k.

**COMPLIANCE REVIEW REQUIRED BEFORE PRODUCTION**

Copy invariato da rivedere su oro fisico / oro di carta, emittente, costi, vendita, diversificazione e frasi sulle banche. Da rivedere anche bonus, replay e confronto individuale. Nessuna raccomandazione o promessa finanziaria aggiunta.

**OPERATIONAL CONTENT — NOT ACTIVE YET.**

Checklist, replay 48 ore, link/email immediati e confronto individuale 20 minuti / [10] posti restano contenuti del mockup. Nessuna implementazione o attivazione di booking, download, email, WhatsApp o automazioni. Rimangono tutti i placeholder: `[000]+`, `[4,9/5]`, `[00]`, `[000]`, `[Nome C.]`, città/profili, testimonianze, storia di Frank, `Valore [__] €`, `[10]` e FC. Nessuna prova sociale inventata.

## Verifica

Esito finale: **PASS** Evento e Architetto a 360/390/768/1440px, motion/touch, contratti di presentazione, suite patrimonial/persistence/CRM/opportunities/remote mapping, typecheck, ESLint e diff check. Zero overflow orizzontale della pagina nelle quattro larghezze.

Browser locale Evento e regressione Architetto alle larghezze 360, 390, 768 e 1440px: controllo overflow pagina e sezioni, asset, font, scene/profili/titolo, slider/preset, clock, caroselli e tastiera, timeline, FAQ, sticky, form/micro-step senza POST anticipato, payload completo con marketing false, anti doppio invio, errore/riprova e thank-you. Verifica aggiuntiva touch con motion attivo e reduced motion. Screenshot QA conservati fuori dal repository nella cartella visualizzazioni della chat.

Ogni POST è intercettato e risposto nel browser prima del server; le altre richieste esterne sono bloccate. Suite patrimonial, persistence, CRM, opportunities e remote mapping con fake locali; SQL soltanto statico. Typecheck senza emissione con esclusione `tmp/` soltanto in memoria; ESLint pertinente e `git diff --check`. Verifica HTTP loopback per noindex/nofollow delle quattro route e parent pubblico ancora indexable.

Nessun live smoke, CRM/Supabase write, messaggio, migrazione, booking, cambio env/flag, merge su main o deploy manuale/produzione. Solo commit autorizzato e push del branch per la preview automatica.
