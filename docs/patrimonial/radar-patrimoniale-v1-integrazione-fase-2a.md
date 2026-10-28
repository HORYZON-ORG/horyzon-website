# Radar Patrimoniale V1 integrazione isolata fase 2A

18 ottobre 2026. Repository HORYZON-ORG/horyzon-website.

**Esito: worktree protetto e integrazione preparata, non consolidata in un commit.** I test Radar e patrimoniali, il typecheck e la preservazione dei due parent passano. La build di rilascio e il controllo browser completo restano bloccati dai problemi sotto. Non è stato creato alcun nuovo Radar.

## Worktree e stato Git

- Worktree Radar: C:/Users/emanu/.codex/worktrees/radar-patrimoniale-v1/horyzon-website.
- Branch: feat/radar-patrimoniale-v1, creato da origin/main aggiornato.
- Parent main verificato via GitHub e git fetch: 9146f6372b19fdac6db1770d05f6b0ca10c1f1e5.
- Parent funnel verificato: 88fafcba8811e4a02b3575e2e2cd36368b818be8.
- Entrambi gli SHA coincidono con quelli remoti documentati nella Fase 1.
- HEAD del nuovo branch resta 9146f63; MERGE_HEAD è 88fafcb. Il merge è in corso, preparato con --no-ff --no-commit.
- Nessuno SHA finale integrato: non è stato eseguito il commit, perché la verifica complessiva non è PASS.
- Checkout originale: C:/Users/emanu/Desktop/horyzon/horyzon-website, branch feat/patrimonial-pilot-funnels e HEAD 88fafcb, conservati.

Il worktree è gestito e allegato a questa chat. Nessun worktree adatto esisteva inizialmente; nessun branch omonimo è stato riutilizzato. Il controllo iniziale non ha rilevato processi Git concorrenti o lock. Le ref origin sono state aggiornate con fetch; main locale non è stato spostato.

## Protezione del lavoro originale

Nessuna modifica di questo agente ai file del checkout delle assegnazioni. Non sono stati usati reset, clean, stash, spostamenti o commit del lavoro concorrente. Non sono stati copiati .env.local, tmp, supabase/.temp, il nuovo motore assignment o la nuova migration assignment nel worktree Radar.

Uno snapshot esterno al repository registra hash e presenza di 2.779 file locali modificati/non tracciati. Al confronto successivo non mancava alcun file. HEAD e branch originali erano identici. Quattro file dello snapshot sono cambiati per l’attività concorrente osservata: package.json, package-lock.json, patrimonial-assignments.ts e la migration assignment. Sono comparse ulteriori modifiche a store, adapter e test assignment nel checkout originale: non sono state importate né toccate.

Di conseguenza “workspace originale invariato” significa **non modificato da questa attività**, non immobile durante il lavoro di un’altra attività. Tutto il lavoro delle assegnazioni resta nella directory originale. Snapshot e controllo hash sono nella directory esterna di visualizzazioni di questo task.

## Integrazione e conflitti

Il merge dei 38 commit esclusivi del ramo funnel sui sei commit esclusivi di main non ha prodotto conflitti testuali. package.json è stato unito automaticamente, conservando gli script v4 di main e gli otto script patrimoniali. Dipendenze e lockfile restano quelli di main; PGlite aggiunto nel checkout originale non è entrato nel branch Radar.

Non sono stati cherry-picked redesign intermedi. Il finale funnel include la revisione Architetto ripristinata, la presentazione di 30 minuti, le foto aggiornate e il tema chiaro/scuro.

Conflitti nei contratti di test, risolti senza modificare l’applicazione:

| Verificatore | Problema storico | Risoluzione |
| --- | --- | --- |
| event-presentation | Pin 1a30610 su route Architetto e asset antecedenti al tema/foto finali | Pin immutabile al finale approvato 88fafcb, con confronto esatto di sorgenti e byte dei 35 asset |
| architect-presentation | Pin 03209c3 e attesa di copy 40 minuti/foto precedente | Pin 88fafcb, controlli espliciti di 30 minuti, conversazione.jpg e assenza di new.jpg |
| funnels | Uguaglianza dei contenuti pubblici con b0b62e6 | Preservazione dei medesimi file contro main 9146f63, conservando i test del form legacy |
| crm | Confronto di contatti/wellbeing con un vecchio parent | Parent main per pagine pubbliche e Radar; parent funnel per contratto patrimoniale |
| persistence | Pin del vecchio Radar v3 | Confronto completo del Radar con main v4; contratto patrimoniale con 88fafcb |

I riferimenti di test sono SHA immutabili, non HEAD o branch mobili. Restano i controlli preesistenti su submit, payload, consensi, required fields, mapping, timeout, idempotenza, CAS, lease, errori, routing e provider simulati.

Nuovi verificatori testano: temi realmente eseguiti in isolamento (precedenza URL, scelta salvata, toggle, SSR, storage negato, aria-pressed); preservazione dei due parent; inventario asset; flusso browser locale con invii intercettati. Nessun assert utile è stato rimosso per ottenere PASS.

## Preservazione verificata

verify-patrimonial-integration.mjs passa e attesta:

- Radar v4 e 34 schermate, inclusa una domanda POSITIONING.
- 56 file Radar di main invariati, compresi dominio, UI, API, report, font e documenti Radar.
- 11 file del backend public-leads invariati rispetto al finale funnel.
- 20 migration già versionate, contenuto originale preservato; nessuna nuova migration creata o applicata da questa attività.
- Tutti i 35 JPG del finale funnel presenti e identici byte per byte; nessun file fotografico aggiunto/rimosso.
- Script correnti di main e script esclusivi dei funnel conservati, dipendenze e lockfile preservati.
- Assenza di patrimonial-assignments.ts e della migration assignment dal nuovo worktree.
- Entrambe le route mantengono PatrimonialThemeFrame e i font approvati: Manrope/JetBrains Mono per Evento; Space Grotesk/IBM Plex per Architetto.

Nessun sorgente applicativo è stato cambiato oltre al risultato del merge dei due parent. In particolare non sono state modificate regole owner, routing, adapter CRM, soglie Radar, flag o font per superare i test.

## Test eseguiti

| Comando o controllo | Esito |
| --- | --- |
| npm ci --ignore-scripts --no-audit --no-fund | PASS nel solo worktree, 482 package; nessuna modifica al lockfile |
| npm run test:radar | PASS, incluso posizionamento v4 e report diagnostico |
| npm run test:patrimonial-funnels | PASS |
| npm run test:patrimonial-ledger | PASS |
| npm run test:patrimonial-crm | PASS, provider fittizi |
| npm run test:patrimonial-opportunities | PASS, store/provider fittizi |
| npm run test:patrimonial-persistence | PASS, SQL statico e trasporto RPC fittizio |
| npm run test:patrimonial-remote-mapping | PASS, mapping e regressioni importate, nessuna chiamata remota |
| verify-patrimonial-event-presentation.mjs | PASS dopo riallineamento della baseline |
| verify-patrimonial-architect-presentation.mjs | PASS dopo riallineamento della baseline |
| verify-patrimonial-theme.mjs | PASS, importato anche dai due verificatori di presentazione |
| verify-patrimonial-integration.mjs | PASS, preservazione dei due parent e 35 foto |
| npm run typecheck | PASS prima della build e nuovamente dopo i tentativi di build |
| npm run lint | PASS con 65 warning nei sorgenti applicativi preesistenti, zero errori |
| ESLint sui nove file test/helper modificati o nuovi | PASS, zero warning/errori |
| git diff --check | PASS |
| npm run build, Turbopack | FAIL due volte sul caricamento JetBrains Mono; dettagli sotto |
| next build --webpack, prova diagnostica | Compilazione PASS, build FAIL al controllo degli export della route AI Score |
| npm run test:patrimonial | Lead PASS; comando complessivo FAIL perché il controllo contenuti richiede .next/server/app/index.html, assente dopo build fallita |
| verify-patrimonial-integration-browser.mjs | FAIL sul primo scenario Evento/scuro/390 per overflow pagina 394px; nessun assert aggirato |

Non sono stati avviati smoke con scritture reali. I test backend usano fixture. npm test generale non è stato eseguito: richiede una build completata; il prerequisito non è soddisfatto.

## Blocchi di build

### Turbopack e Google Fonts

Next 16.3.5 restituisce 12 errori relativi al font JetBrains Mono della route Evento, con messaggi “Can't resolve @vercel/turbopack-next/internal/font/google/font” e “next/font/google queries have exactly one entry”. L’errore è stato riprodotto in due tentativi standard.

La firma è compatibile con il problema di parsing degli URL Google Fonts documentato in [Next.js issue 99114](https://github.com/vercel/next.js/issues/99114). Questa corrispondenza è una diagnosi indicativa, non una correzione provata. Non sono state cambiate dipendenze, font, cache o sorgenti per mascherarlo.

### Export della route AI Score

Il tentativo Webpack compila, poi si ferma sulla route src/app/api/internal/ai-score/provider-preflight/route.ts: export aggiuntivo isAuthorizedInternalPreflightRequest non accettato dal contratto Next delle route.

Il file è identico a main 9146f63. Il verificatore scripts/verify-ai-score-phase7b0-preflight.mjs importa direttamente quell’helper dalla route. Una correzione successiva dovrebbe separare l’helper dal modulo route preservando l’autorizzazione e aggiornando l’import del test. Non è stata eseguita in questa integrazione e nessun controllo tipi è stato disattivato.

Il PASS di tsc --noEmit non sostituisce questo controllo generato dalla build Webpack: entrambi gli esiti sono riportati distintamente.

## Verifica browser reale e suoi limiti

Usati Chrome headless e Playwright già disponibili, con server Next locale avviato in modalità sviluppo Webpack su 127.0.0.1:3310. Non è una build production riuscita.

Prima dello stop:

- Tutti i 35 JPG originali hanno restituito HTTP 200.
- Evento ha risposto HTTP 200 con noindex/nofollow.
- Verificati font Manrope, singolo h1, 17 sezioni, caricamento delle immagini e toggle fra i due temi senza cambio di titolo.
- Rilevato overflow pagina di 394px rispetto al viewport di 390px, nel caso Evento/scuro.
- Raccolti screenshot e JSON con misure. Il test si è fermato prima di inviare il form: nessuna chiamata reale o simulata di scrittura è arrivata al server.

Evidenze locali: [screenshot overflow](../../.preview/integration-browser/evento-dark-390-overflow.png) e [misure JSON](../../.preview/integration-browser/evento-dark-390-overflow.json). Sono artefatti ignorati, non destinati a un commit.

I primi elementi del JSON includono tessere interne a scroller: la loro posizione fuori viewport non identifica da sola il responsabile del document scrollWidth. Il dato certo è la larghezza della pagina; non è stato attribuito automaticamente a una regressione introdotta dal merge. CSS e TSX Evento coincidono con il parent funnel, mentre gli stili globali conservano main.

Gli scenari successivi Architetto, altri viewport e Radar non sono stati eseguiti dal nuovo verificatore, che si arresta al primo fallimento. Le verifiche statiche dei due funnel passano; non si dichiara una QA visuale completa.

## File modificati in questa attività oltre al merge

- scripts/lib/patrimonial-integration-baselines.mjs, nuovo.
- scripts/verify-patrimonial-integration.mjs, nuovo.
- scripts/verify-patrimonial-integration-browser.mjs, nuovo.
- scripts/verify-patrimonial-theme.mjs, nuovo.
- scripts/verify-patrimonial-event-presentation.mjs.
- scripts/verify-patrimonial-architect-presentation.mjs.
- scripts/verify-patrimonial-funnels.mjs.
- scripts/verify-patrimonial-crm.mjs.
- scripts/verify-patrimonial-persistence.mjs.
- Questo report.

Il merge porta 106 file nuovi/modificati rispetto a main; l’elenco completo è nel diff del worktree. I due documenti assignment e l’audit Fase 1 rimangono nel checkout originale; non è stato importato il lavoro non consolidato.

## Readiness e consegna

L’integrazione è disponibile nel worktree isolato, con test aggiornati e sorgenti dei due parent preservati. **Non è ancora una base comune stabile e interamente verificata:** restano il blocco font/build, il contratto route AI Score emerso da Webpack e l’overflow mobile.

Non è stato eseguito un commit locale del merge, coerentemente con la condizione di verifica posta dall’utente. Il merge in corso e le modifiche ai test restano nel worktree dedicato, senza richiedere operazioni nel checkout delle assegnazioni.

Il modello diagnostico non è stato progettato né implementato. Prima di dichiarare pronta la base per la fase successiva occorre chiudere i tre blocchi, completare build e test dipendenti dalla build, poi terminare il controllo browser e consolidare il merge. Nessun push, merge su main, deploy, modifica remota Supabase/HighLevel, attivazione di flag o invio è stato eseguito.

