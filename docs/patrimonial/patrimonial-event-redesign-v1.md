# Redesign evento patrimoniale — preview

Scope: esclusivamente `/benessere-patrimoniale/evento`, baseline `2d2426dfb5cacee8c1dc9de212f663107328e629`, branch `feat/patrimonial-pilot-funnels`.

## Fonti e precedenza

La richiesta utente nel testo allegato prevale sulle istruzioni del documento di supporto. Fonti effettivamente consegnate: `index (4).html`, `PROMPT-PER-CHATGPT (4).md`, otto JPG e screenshot desktop 01–06 / mobile 01–12. L'HTML è stato letto per intero. Nessuna ricerca web.

Struttura, ordine delle 18 parti, testi, colori, gradienti, glass, spaziature, proporzioni, radius e ombre derivano dall'HTML. Le dichiarazioni inline sono trasferite in classi locali `s000…` nel CSS module. Newsreader, anche corsivo, e Manrope sono forniti da `next/font/google`, con variabili limitate alla route. Gli screenshot originali usano font di ripiego, come precisa il documento di supporto: i font corretti cambiano fisiologicamente gli ingombri del testo.

Differenze intenzionali richieste: cellulare facoltativo senza promessa WhatsApp; micro-step finale cognome/provincia; fine print sulla richiesta non definitiva; link Privacy/Cookie verso le pagine esistenti. I minimi di griglia diventano `min(320px, 100%)` / `min(300px, 100%)` e la CTA del pannello scene ha `max-width:100%` per impedire overflow mobile. Le dimensioni dei desktop restano quelle sorgente. Nessuna promessa di identità raster tra font diversi o countdown acquisiti in istanti diversi.

## File e componenti

| File | Responsabilità |
| --- | --- |
| `src/app/(patrimonial-pilot)/benessere-patrimoniale/evento/page.tsx` | Route, font locali, metadata noindex/nofollow |
| `src/components/patrimonial-event-landing.tsx` | 18 parti del mockup; scene, profilo e importo in stato React |
| `src/components/patrimonial-event-clock.tsx` | Provider con timer a 1 secondo e cleanup; solo i valori sessione consumano il clock |
| `src/components/patrimonial-event-form.tsx` | Presentazione e focus del micro-step, nessuna fetch |
| `src/components/patrimonial-event.module.css` | CSS del riferimento isolato, breakpoint 820px, reduced motion, form |
| `src/content/patrimonial-event-content.ts` | Scene/copy, titoli profilo, mapping esplicito UI→API, formula illustrativa |
| `src/content/patrimonial-event-session.ts` | Unica configurazione pubblica sessione dimostrativa |
| `src/components/patrimonial-lead-form.tsx` | Solo selezione presentazione evento e gate del primo passaggio; transport originale invariato |
| `src/components/patrimonial-pilot-shell.tsx` | Esenzione dei soli due root funnel; `/grazie` mantiene la shell esistente |
| `scripts/verify-patrimonial-event-presentation.mjs` | Contratti UI e confronto sorgenti protetti alla baseline |
| `scripts/verify-patrimonial-event-browser.mjs` | Browser locale 390/768/1440, ogni POST intercettato |
| `scripts/verify-patrimonial-architect-browser.mjs` | Solo aspettativa finale sulla nuova shell evento aggiornata; test Architetto invariati |

Otto originali byte-identici in `public/benessere-patrimoniale/evento/`: `hero.jpg`, `pyramid.jpg`, `coins.jpg`, `single.jpg`, `s_bank.jpg`, `s_business.jpg`, `s_cart.jpg`, `s_hourglass.jpg`. Nessuna rigenerazione, ritocco o aggiunta degli screenshot al sito. `next/image` conserva proporzioni e ritagli; hero resta background CSS.

## Interazioni e modulo

Le quattro scene aggiornano `aria-pressed`, bordo/spunta e pannello kicker/answer/detail/CTA; preselezionano il profilo e il relativo titolo form. Le chip consentono una scelta autonoma. FAQ con `details/summary`, focus visibile e navigazione da tastiera. Sticky CTA in flow con `position:sticky`, testo/data/countdown su desktop e solo pulsante sotto 820px. Piramide con tre label desktop e lista testuale sotto 820px.

| Profilo UI | Value API |
| --- | --- |
| Privato | Privato |
| Imprenditore | Imprenditore |
| Professionista | Professionista |
| Genitore / famiglia | Altro |

Il primo passaggio mostra profilo, nome, email, cellulare facoltativo e privacy. «Riserva il mio posto gratuito» valida solo i campi iniziali e **non esegue POST**. Nella stessa card compare «Ci manca solo questo»: cognome e provincia obbligatori, con focus sul titolo. «Conferma la richiesta» invia solo dopo la validazione. Tornare ai recapiti conserva tutti i valori; niente cognomi fittizi, provincia inferita o default ND. Profilo non scelto resta opzionale come nel contratto.

Payload: `mode=patrimonial-event`, `sourcePath=/benessere-patrimoniale/evento`, `firstName`, `lastName`, `email`, `phone`, `province`, `profile` mappato, `message=''`, `consent`, `marketingConsent=false`, `website` honeypot e UTM originali. Nessun `eventEditionId` derivato dalla configurazione demo. Nessuna attivazione V2: se il chiamante lo abilita in futuro, la gestione esistente di attempt, ricevute, replay e revisione resta di `PilotLeadForm`.

Timeout 35 secondi, sending guard, controllo risultato, errore/riprova e redirect a `/evento/grazie` restano nel transport originale. Il componente di presentazione non invia richieste. Privacy non implica marketing. La semantica resta richiesta di partecipazione REQUESTED/PENDING: **«La richiesta non conferma ancora la partecipazione definitiva.»** Nessuna modifica alla thank-you.

## Demo e revisioni necessarie

**DO NOT SHIP AS REAL AVAILABILITY.**

`eventSession.status = 'PLACEHOLDER'`. Data `2026-11-19T21:00:00+01:00`, etichetta giovedì 19 novembre ore 21, 100 posti / 68 occupati / 32 residui sono DEMO VISUAL VALUES autorizzati per questa preview. DOM e snapshot marcano esplicitamente il dato demo. Il countdown si aggiorna ogni secondo, non determina disponibilità reale e non abilita/disabilita invii o backend. Nessun collegamento a edizioni CRM, prenotazioni o inventario reale.

Rimangono tutti i placeholder originali: `[000]+`, `[4,9/5]`, `[00]`, `[000]`, `[Nome C.]`, `[Imprenditore, Bari]`, `[Professionista, Milano]`, `[Privato, Roma]`, `Valore [__] €`, `[10]`, testi delle testimonianze, storia di Frank, FC e «RITRATTO IN ARRIVO». Nessuna prova sociale inventata.

**DATA/COMPLIANCE REVIEW REQUIRED BEFORE PRODUCTION**

Da verificare prima della produzione: dato +17,1%, periodo 2021–2025, attribuzione ISTAT e copy interpretativo sull'inflazione. Nessuna verifica esterna eseguita in questa fase. Formula preservata: `lostRaw = amount * (1 - 1 / 1.171)`, `lost = Math.round(lostRaw / 100) * 100`, `perDay = lostRaw / 1826`; formato it-IT. Range 10.000–1.000.000, passo 10.000, preset 50k/100k/250k/500k. A 100k: 85.400 € reali illustrativi, −14.600 €, 8,00 €/giorno. Anche le etichette sulle monete seguono l'importo selezionato.

**COMPLIANCE REVIEW REQUIRED BEFORE PRODUCTION**

Sezione oro fisico / «oro di carta»: mantenuto il copy originale su possesso, emittente, costi e vendita. Necessaria revisione prima della produzione. Nessuna raccomandazione, previsione, convenienza o rendimento aggiunto.

**OPERATIONAL CONTENT — NOT ACTIVE YET.**

Checklist, replay 48 ore, link/email immediati, promemoria e confronto individuale 20 minuti / [10] posti sono contenuti visivi del mockup da rendere operativi e verificare separatamente prima della produzione. Questa modifica non implementa download, automazioni, email, WhatsApp, replay o booking. Il campo cellulare non promette il promemoria WhatsApp. Nessuna modifica a env o flag.

## Verifica e confini

PASS: test patrimonial, persistence (include ledger/CRM/opportunity), remote mapping (include regressioni CRM/opportunity), presentazione Architetto ed Evento. Tutti i provider/store delle suite sono fake locali; SQL solo statico. Il test presentazione evento confronta 38 file protetti con la baseline: API, dominio/store/provider/routing/contratto, migrazioni, presentazione/configurazione Architetto e thank-you.

PASS browser per entrambi i funnel a 390 / 768 / 1440 px: nessun overflow, asset caricati, profili, stati selezionati, focus/tastiera, sticky, dati preservati, invio incompleto, POST completo, anti-doppio invio, errore/riprova e thank-you. Evento verifica anche tutte le scene/pannelli/titoli, slider/preset, clock, FAQ, piramide e micro-step. Ogni POST `/api/public-leads` è intercettato e risposto nel browser prima di raggiungere il server. Tutte le altre chiamate esterne sono bloccate. Screenshot QA fuori dal repository, nella cartella visualizzazioni della chat.

PASS typecheck senza emissione: esclusione di `tmp/` soltanto in memoria, senza cambiare tsconfig. PASS ESLint sui file pertinenti e `git diff --check`. Nessun live smoke, contatto, opportunity, migrazione, chiamata Supabase/HighLevel, invio messaggi, deploy manuale/produzione o merge su main. Nessuna modifica a navigazione o sitemap. Architetto conserva file, asset e comportamento; cambia soltanto l'aspettativa del suo test sulla root evento, ora dotata di shell propria.

Comandi browser: `node --no-warnings --experimental-strip-types scripts/verify-patrimonial-event-browser.mjs --base=http://127.0.0.1:3100 --playwright-module=<runtime Playwright> --executable=<Chrome> --artifacts=<cartella QA esterna>` e omologo `verify-patrimonial-architect-browser.mjs`. Non installano dipendenze né caricano segreti. Non usare i test browser contro preview o produzione: lo script impone loopback.
