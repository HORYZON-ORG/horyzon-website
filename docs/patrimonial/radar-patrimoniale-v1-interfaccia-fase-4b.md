# Radar Patrimoniale V1 — Interfaccia, fase 4B

## Esito e base verificata

Implementata `/radar-patrimoniale` come demo locale con questionario adattivo e preview diagnostica, usando il catalogo e il motore della 4A senza modificarli. Supportate tutte le **40 domande: 29 ordinarie e 11 approfondimenti**. Il percorso browser completo esercita tutti i 40 identificativi attraverso i controlli reali.

Worktree: `C:\Users\emanu\.codex\worktrees\radar-patrimoniale-v1\horyzon-website`. Branch: `feat/radar-patrimoniale-v1`. Partenza verificata pulita: `489ed590b113bca1b9530c2c177a8d275a477fc5`. Letti AGENTS, DESIGN e report 4A; analizzati Radar d'Impresa, funnel Evento, catalogo, validatori, registro delle revisioni e risultato canonico. Consultate le guide installate di Next 16.3.5 prima delle modifiche.

Nessun conflitto Git. Nessun file del checkout originale è stato scritto, consolidato o importato da questa attività. Il checkout originale resta sul branch patrimoniale, con i suoi file temporanei e non tracciati disponibili; non si presume che altre attività lo lascino immobile.

Il commit locale finale è quello che introduce questo report: è identificato nella consegna della chat e con `git log -1 -- docs/patrimonial/radar-patrimoniale-v1-interfaccia-fase-4b.md`, evitando un hash autoreferenziale nel documento.

## Architettura e percorso

La pagina server controlla il flag prima del rendering del client e riceve soltanto la data di riferimento. Il client contiene introduzione, questionario, hub facoltativo e preview. Il registro confermato e le bozze rimangono esclusivamente nella memoria React della scheda.

Le domande e gli aiuti provengono da `QUESTION_CATALOG` e `questionText`; non esiste un secondo catalogo dei quesiti. L'adattatore UI traduce gli enum in etichette comprensibili, prepara campi vuoti espliciti e usa `recordAnswer`, `resolveAnswers`, `validateValue`, `ordinaryRoute` e `diagnose`. Il dominio 4A resta invariato.

Una domanda principale alla volta; pulsanti precedente/conferma, navigazione per sezione, lettura parziale e ritorno alle risposte. Anche una bozza non confermata sopravvive alla navigazione nella sessione. La preview avverte della presenza di bozze e usa solo il registro confermato. Il refresh azzera tutto. Il reset richiede una conferma locale.

La sequenza è bilancio, equilibrio, debiti, liquidità, protezione, patrimonio, pianificazione. Le condizioni sono quelle del motore: il numero non è sempre 29. La fixture T02 percorre tutte le 29 ordinarie; T01 ne richiede 26; assenze strutturali verificate possono ridurlo ancora. La progressione distingue posizione e risposte confermate nel percorso applicabile. Gli approfondimenti restano separati e sono mostrati soltanto quando applicabili.

Una modifica a monte aggiorna il percorso e rende esplicita la riconferma dei dati dipendenti. I dati inattivi non contribuiscono alla lettura; perimetro e data dei campi monetari vengono riallineati solo dopo conferma esplicita, mai durante il rendering. Ripetere una conferma invariata non crea revisioni inutili.

## Campi e obiettivi

Controlli nativi etichettati per scelte singole/multiple, importi, fasce, periodi, matrici e stati mancanti. Le alternative esclusive non convivono con selezioni positive. Zero è un valore distinto da sconosciuto, rifiutato e da completare. Gli importi accettano formato italiano, stime e dati da riepilogo; T12 distingue media mensile, totale annuale e copertura parziale. Gli errori monetari sono immediati; la conferma applica inoltre i validatori canonici.

Il perimetro non viene inventato: senza bilancio individuale/familiare noto, il campo monetario spiega come tornare alla sezione iniziale oppure lasciare il dato mancante. X04 riprende l'inventario attivo senza ricopiare la liquidità già dichiarata; le matrici riprendono solo le esposizioni attive.

X06 v2 gestisce fino a tre obiettivi con identificativi locali stabili. Nessuna priorità è inferita dalla prima riga: la persona sceglie i ranghi o conferma esplicitamente l'ordine. Spostare le righe azzera i ranghi fino alla nuova scelta. Orizzonte anche in mesi, incluso zero, natura e importo facoltativo sono indipendenti.

X09 distingue quota da mantenere, quota eventualmente destinabile, attribuzioni agli obiettivi, altre risorse da esaminare senza somme aggiuntive e vincoli con accessibilità/rigidità. X10 raccoglie esperienza personale, aspettative e dubbi senza dedurre competenza dal possesso. X11 separa utilità desiderata dal colloquio e futura partecipazione alle decisioni. Nessuna prenotazione o pressione commerciale.

## Design e preview

Palette locale scuro/crema/lime, Manrope e JetBrains Mono già disponibili, superfici chiare per compilare, pulsanti e focus ben distinguibili, transizioni leggere. CSS Module e token `--pr-*` isolano il nuovo percorso. Nessuna modifica ai CSS delle landing o al layout globale.

Riutilizzato direttamente **`/benessere-patrimoniale/evento/radar.jpg`**, oltre al logo canonico esistente; nessuna copia dei 35 asset. La fotografia compare nell'introduzione, senza immagini aggiunte a ogni domanda. Non è promessa una durata di compilazione.

La preview usa il risultato reale di `diagnose`: sei settori SVG di identica dimensione, simboli, etichette, tratteggio per dati insufficienti, legenda e sei schede testuali. Nessun punteggio globale, poligono quantitativo o raggio numerico. Visualizza presidi dichiarati, struttura descritta neutrale, approfondimento, attenzione e informazioni insufficienti secondo gli stati del dominio. La non applicabilità riguarda le componenti verificate dal motore; non viene inventato un sesto stato delle aree né nascosta una dimensione.

Sono mostrati evidenze canoniche, copertura informativa locale, incoerenze, obiettivi effettivi e confronti sulle risorse, con collegamenti per correggere o riconfermare. Copertura e compatibilità non sono presentate come salute, sicurezza, adeguatezza o finanziabilità. È una preview tecnica educativa; il report definitivo della 4D resta da realizzare.

## Flag e minimizzazione

Il flag server è **OFF per default**. Occorrono entrambe le variabili di processo `PATRIMONIAL_RADAR_DEMO_ENABLED=true` e `PATRIMONIAL_RADAR_DEMO_CONTEXT=local-test`; l'esecuzione su Vercel o con `VERCEL_ENV=production` è comunque rifiutata. È ammessa la build di produzione eseguita localmente per il QA. Nessuna variabile pubblica, parametro URL o solo `noindex` può attivarla.

Esempio PowerShell, esclusivamente nel worktree e per dati sintetici:

```powershell
$env:PATRIMONIAL_RADAR_DEMO_ENABLED='true'
$env:PATRIMONIAL_RADAR_DEMO_CONTEXT='local-test'
npm run start -- --hostname 127.0.0.1 --port 3321
```

Per la prova OFF si usa un processo senza queste due variabili. Non sono stati creati file `.env`, impostazioni remote o nuovi secret. I server sono stati avviati solo sul loopback durante il QA.

Route dinamica, metadati noindex/nofollow/nocache, header X-Robots-Tag e referrer disabilitato. Una CSP dedicata impedisce alla pagina di eseguire gli script di terze parti ereditati dal layout, compresi quelli del consenso: nessun codice esterno può leggere i campi della demo. I cinque inserimenti di `next.config.ts` si applicano solo alla nuova route; gli header preesistenti sono verificati invariati. La policy conserva gli inline necessari a Next; non è dichiarata una CSP con nonce. Menu e sitemap non modificati.

Nessun endpoint, storage browser, analytics, log di risposte, dati identificativi, email o invio CRM. Nessun salvataggio tramite Radar d'Impresa. Non è un sistema autenticato: questa gate locale non autorizza la raccolta di dati reali o l'esposizione pubblica.

## Test e QA eseguiti

| Controllo | Esito |
| --- | --- |
| `test:patrimonial-radar-ui` | PASS: flag, adattività, riconferma, campi mancanti, matrici, liquidità collegata, protezione file e header esistenti, dipendenze invariate |
| `test:patrimonial-radar-browser` | PASS su Edge/Chromium reale, build compilata locale, dati sintetici, due server flag ON/OFF |
| `test:patrimonial-radar` | PASS: 72 gruppi, mantenendo la distinzione 4A fra scenari completi, parziali e CT-27 non eseguito |
| `typecheck` | PASS; anche la build finale completa il controllo TypeScript |
| `lint` | PASS: zero errori, 65 warning preesistenti; lint dedicato sui nuovi file senza warning |
| `build` | PASS, inclusa generazione Markdown; build finale dopo la correzione delle etichette SVG |
| `test:radar` | PASS: suite esistenti Radar d'Impresa |
| `test:patrimonial`, `test:patrimonial-funnels` | PASS |
| `test:patrimonial-ledger`, `test:patrimonial-crm`, `test:patrimonial-opportunities` | PASS |
| `test:patrimonial-persistence`, `test:patrimonial-remote-mapping` | PASS con fixture/trasporti finti |
| Verificatori form, Evento, Architetto, tema e integrazione | PASS |
| Preservazione integrazione | PASS: 34 schermate v4, 56 file Radar, 11 file CRM, 20 migrazioni e 35 foto preservati |
| `test:annunci-10x`, `test:ai-score` | PASS con fixture; nessuna chiamata provider/CRM reale |
| `test:no-platform`, `test:search`, `test:readable` | PASS; sitemap pubblica a 99 pagine |
| `test:patrimonial-live-smoke` | FAIL PREESISTENTE della guardia Git storica, descritto sotto; non è stato eseguito il comando operativo live |

Il browser attraversa 29 ordinarie e 11 facoltative; confronta i sei stati della preview con la fixture T02 del motore; prova annuali/fasce/importi invalidi, matrici, due obiettivi con priorità esplicite, attribuzioni, vincoli, esperienza, ritorno con bozza conservata, cambio nucleo/individuo e riconferma. Un secondo percorso distingue zeri, dati mancanti, assenza di debiti/attività/esposizioni e arretrati ancora segnalati. Il refresh riparte dall'introduzione.

Rete intercettata nel browser, chiamate esterne e metodi diversi da GET/HEAD bloccati, scritture storage e beacon trasformati in errori: **zero richieste esterne, zero invii di risposte, zero scritture storage, zero errori browser non gestiti**. La prova OFF verifica HTTP 404 e assenza del questionario. I controlli automatici non sostituiscono una futura valutazione completa di sicurezza.

QA reale a **320, 390, 768 e 1440 px**, anche landscape; matrici, obiettivi, risorse e esperienza provati a 320/390/768. Nessun overflow orizzontale; nessun overflow hidden sul documento. Verificati immagine caricata, Manrope, focus da tastiera visibile, focus sul nuovo titolo, target del pulsante principale almeno 44 px, transizioni disabilitate con reduced motion. Ispezionati screenshot desktop e mobile; corretta la sovrapposizione tra simboli e nomi nel grafico. Le principali coppie di testo/palette sono state calcolate fra 5,92:1 e 16,58:1. Etichette native, fieldset e descrizione SVG sono presenti; non è dichiarata una certificazione WCAG né una prova completa con screen reader o dispositivi fisici.

## Screenshot locali

Directory esterna al repository, con soli dati sintetici:

`C:\Users\emanu\.codex\visualizations\2026\10\18\01a14e5a-6067-71a0-a210-f3859cab8329\radar-patrimoniale-4b`

Principali file: `intro-desktop-1440.png`, `intro-390.png`, `question-mobile-320.png`, `question-mobile-390.png`, `matrix-desktop-1440.png`, `matrix-320.png`, `goals-desktop-1440.png`, `optional-x6-390.png`, `optional-x9-320.png`, `optional-x10-390.png`, `result-desktop-1440.png`, `result-mobile-390.png`. `verification.json` contiene gli identificativi esercitati, gli esiti e i contatori di rete, senza payload delle risposte. Gli screenshot non sono aggiunti al commit.

Il test richiede un runtime Playwright e un eseguibile Chromium/Edge espliciti, senza aggiungere dipendenze al progetto:

```text
npm run test:patrimonial-radar-browser -- --base=http://127.0.0.1:3321 --disabled-base=http://127.0.0.1:3322 --playwright-module=<percorso-assoluto-playwright/index.mjs> --executable=<percorso-assoluto-browser> --artifacts=<directory-screenshot>
```

Accetta esclusivamente destinazioni loopback. Il runtime usato è quello locale già disponibile in Codex; il lockfile è invariato.

## Problemi residui e readiness 4C

Il verificatore smoke locale fallisce alla guardia `git diff --exit-code c61ed43d1a1811069cbf0ecc6c21498bea76c03d -- src .gitignore`, già incompatibile con il commit iniziale 4B. Confermato separatamente che il confronto fra tale baseline e `489ed590...` restituisce differenze. Non si dichiara PASS dei controlli successivi non raggiunti e non è stata alterata la copertura per ottenere verde. La sua baseline richiede una revisione separata. `smoke:patrimonial` non eseguito.

Restano i limiti della 4A: metodologia draft da validare professionalmente, pilot cognitivo e durata, privacy/servizio, minimizzazione delle future proiezioni e verifiche effettive di identità, ruoli, assegnazioni e revoche. I casi metodologici parziali e CT-27 non vengono promossi a PASS grazie a questa UI. La preview non realizza le proiezioni complete Client/Staff o il report 4D. QA eseguito su Chromium/Edge desktop con viewport; altre famiglie browser, screen reader completi e hardware mobile restano da verificare.

**Readiness 4C: base tecnica pronta per sviluppare e verificare la fase successiva con questi limiti espliciti.** La demo resta disattivata fuori dai test locali autorizzati. Nessuna identità, database, migrazione, configurazione remota, HighLevel o automazione implementata in 4B. Nessun push, merge su main o deploy.

## File della fase

| File | Ruolo |
| --- | --- |
| `src/app/radar-patrimoniale/page.tsx` | Route server e metadati |
| `src/lib/patrimonial-radar-ui/demo-gate.ts` | Flag locale server-side |
| `src/lib/patrimonial-radar-ui/presentation.ts` | Adattatore UI e traduzioni degli enum |
| `src/components/patrimonial-radar/radar-client.tsx` | Fasi, navigazione e stato in memoria |
| `src/components/patrimonial-radar/controls.tsx` | Controlli accessibili e monetari |
| `src/components/patrimonial-radar/question-fields.tsx` | Rendering del catalogo completo |
| `src/components/patrimonial-radar/goals-fields.tsx` | Obiettivi, risorse, esperienza |
| `src/components/patrimonial-radar/result-preview.tsx` | Settori e lettura del risultato canonico |
| `src/components/patrimonial-radar/radar.module.css` | Stili locali e responsive |
| `scripts/verify-patrimonial-radar-ui.mjs` | Contratti e preservazione |
| `scripts/verify-patrimonial-radar-browser.mjs` | Test browser sintetico e screenshot |
| `next.config.ts` | Cinque righe di header dedicate alla route |
| `package.json` | Due comandi test, nessuna dipendenza nuova |
| Questo report | Esito e limiti 4B |
