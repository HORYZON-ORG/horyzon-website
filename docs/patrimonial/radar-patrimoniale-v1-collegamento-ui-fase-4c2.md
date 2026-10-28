# Radar Patrimoniale V1 — Collegamento UI, fase 4C.2

## 1. Architettura e perimetro

Worktree esclusivo `C:\Users\emanu\.codex\worktrees\radar-patrimoniale-v1\horyzon-website`, branch `feat/radar-patrimoniale-v1`, HEAD iniziale verificato `58f510add18e78b3a01299346a073104aa28cf43`, working tree inizialmente pulito. Nessun processo Git concorrente o lock rilevato. Nessun reset, clean, stash, push, merge o deploy.

Percorso effettivo: pagina Next → client React → API same-origin → handler/servizio 4C.1 → adapter server loopback → RPC SQL privata → registro e snapshot → proiezione cliente server → sei settori. Il motore 4A, le sue versioni e regole restano immutati. Il browser riusa il dominio per controlli/applicabilità e avvisi provvisori; non approva il risultato definitivo. Nessuna nuova migration.

Nei test: due istanze `next start` della build standard, flag ON/OFF esclusivamente nei processi figli locali; PostgreSQL embedded 17.5, trasporto HTTP di test che esegue la vera RPC SQL e provider simulato in memoria. Il trasporto del test **non è PostgREST**. Il runtime applicativo non importa PGlite o il relativo harness e non ha fallback in memoria.

## 2. Endpoint e componenti

Tutti sotto `/api/patrimonial-radar`:

| Metodo / endpoint | Utilizzo collegato |
| --- | --- |
| POST identity/request | Email sintetica, messaggio generico, challenge e binding HttpOnly |
| POST identity/verify | Codice, binding e CSRF; sessione verificata |
| GET session | Bootstrap e verifica corrente |
| POST session/revoke | Uscita dal dispositivo o da tutti |
| GET assessments | Storico della sola persona |
| POST assessments | Nuovo episodio esplicito e idempotente |
| GET assessments/:id | Ultime risposte, revisione, stati e percorso del dominio |
| POST assessments/:id/answer | Conferma CAS/idempotente |
| POST assessments/:id/complete | Snapshot atomico e proiezione cliente |
| GET assessments/:id/snapshot | Consultazione del risultato immutabile autorizzato |

`radar-client.tsx` orchestra identificazione, storico, compilazione, riepilogo, conflitti e risultato. `controls`, `question-fields` e `goals-fields` sono identici alla 4B. `result-preview` mantiene geometria, legenda e sei settori della 4B, ricevendo ora soltanto `CustomerResult`. `api.ts` è l'unico trasporto browser dedicato; `customer-projection.ts` costruisce l'allowlist sul server. `simulated-email.ts` è una porta server per il sink di test.

Next 16.3.5 rappresenta internamente alcune richieste con hostname localhost anche se raggiunto su 127.0.0.1: verificato con debugger locale leggendo soltanto booleani dei controlli. `localNextRequest` normalizza esclusivamente localhost con Host, porta e protocollo esatti della configurazione loopback già validata. Query, origini remote, Host diverso e forwarding header non superano i controlli. Origin dei POST, Fetch Metadata e CSRF restano obbligatori.

## 3. Identità

La persona nasce solo dopo verifica email e mantiene il proprio UUID attraverso nuovi accessi e dispositivi. L'interfaccia non deduce proprietà da un ID, dall'email digitata o dall'Evento. Elenca le bozze e gli episodi già completati, senza creazione automatica al login. Un refresh autenticato recupera una bozza esistente; più bozze restano raggiungibili dallo storico. Le date della fotografia non cambiano riprendendo una compilazione.

Il percorso Evento resta predisposto, senza collegamento a partecipazioni, CRM, owner o assegnazioni. La UI crea episodi DIRECT. Nessuna regola di assegnazione è stata importata dal checkout concorrente.

## 4. OTP e simulazione

Email di test con suffisso `.invalid` al confine HTTP; nessuna casella reale viene acquisita da questa UI. Messaggio di richiesta uguale per casella nuova/esistente, throttling o consegna non disponibile. Codice a otto cifre, durata e tentativi verificati dal DB come in 4C.1. Reinvio con cooldown UI basato su una scadenza temporale, robusto anche dopo sospensione della scheda; il limite DB resta autoritativo.

Il sink accetta solo POST autenticati server-side e indirizzi `.invalid`, su loopback. Non consegna email e non espone una casella GET. Il codice viene letto dai test nel processo Node del simulatore, mai restituito alla UI tramite endpoint tecnico, URL o log. `PATRIMONIAL_RADAR_LOCAL_SIMULATED_EMAIL_URL` è facoltativo: senza sink, il runtime resta senza consegna e fallisce chiuso. Nessun servizio o credenziale email reale.

## 5. Salvataggio, recupero e bozze

Una conferma valida genera un requestId stabile e invia expectedRevision al servizio. Avanzamento e nuova revisione arrivano solo dopo il salvataggio e la rilettura server. Le operazioni sono serializzate nella scheda; navigazione e completamento restano bloccati durante una scrittura o un esito ambiguo. Il retry riutilizza lo stesso corpo, UUID e revisione, anche dopo risposta persa successiva al commit.

Gli stati visibili distinguono salvataggio in corso, salvato, rete/servizio indisponibile, revisione in conflitto e sessione scaduta. Gli errori di validazione/completamento incompleto permettono di correggere il percorso; non impongono un retry inutile. La bozza non confermata resta in RAM, con avviso prima di chiudere la scheda o scartarla cambiando episodio. Dopo chiusura/refresh sopravvivono soltanto le risposte confermate sul server. Nessun localStorage/sessionStorage/IndexedDB, analytics o beacon per dati economici.

## 6. PostgreSQL nativo

**NON ESEGUITO:** nessun postgres/psql/pg_ctl/initdb nel PATH né installazione standard PostgreSQL 17 rinvenuta. Docker installato, ma daemon locale indisponibile (pipe dockerDesktopLinuxEngine assente). Nessuna modifica a Docker/WSL/OS. Le connessioni native indipendenti, i lock wait/deadlock e il comportamento MVCC con processi separati restano da verificare.

**PASS su embedded:** suite backend su PGlite/PostgreSQL 17.5 e 18.6. SQL reale, non mock di query: ACL, FORCE RLS, owner, revisioni, consumo OTP, rollback di snapshot/stato/ricevuta/audit, restore a freddo. La singola connessione embedded non prova la concorrenza nativa. I test browser usano il runtime 17.5 esterno al repository già disponibile; nessuna dipendenza aggiunta.

## 7. PostgREST e oggetti privati

**PostgREST reale NON ESEGUITO:** eseguibile e stack Docker non disponibili. Il test browser attraversa il vero adapter HTTP `LocalSupabaseRadarRpc`, ma il destinatario è un facade di test esplicitamente identificato come tale. Sono verificati protocollo applicativo, errori, proprietà e transazioni SQL; non vengono dichiarati provati schema cache, JWT/role switching o privilegi effettivi di un processo PostgREST.

Schema privato, dodici tabelle FORCE RLS, RPC invoker e grants 4C.1 conservati. Nessuna esposizione di tabelle, nuova policy permissiva o modifica Supabase remota. L'intero progetto remoto non è stato utilizzato in 4C.2, neppure in lettura.

## 8. Concorrenza e riconferme

CAS impedisce che una revisione obsoleta sovrascriva dati recenti. La UI conserva il tentativo locale, spiega il conflitto e permette la rilettura esplicita. Mostra affiancabili il valore server e il modulo della bozza; la persona può scartare quest'ultima o riconfermarla sulla nuova revisione. Nessun merge automatico dei valori economici.

Cambio di contesto e non applicabilità sono determinati da resolveAnswers/recordAnswer 4A. Gli input inattivi restano nel registro server ed escono dai calcoli; le risposte RECONFIRM non diventano attive per il solo fatto di essere visualizzate. Gli identificativi delle nuove righe obiettivo sono UUID, evitando collisioni dopo ripresa da un altro dispositivo.

## 9. Completamento e snapshot

Il riepilogo permette approfondimenti e revisione prima dell'approvazione. Non è presentato come risultato definitivo. Non si completa con richieste pendenti o bozze locali da confermare. Il server valida tutte le ordinarie applicabili, revisione e riconferme e calcola diagnose sul registro completo. Una sola transazione registra snapshot, ricevuta, stato e audit; il replay restituisce la medesima fotografia.

Il risultato completato è immutabile; correzioni successive richiedono un nuovo episodio esplicito. La proiezione `RP-CLIENT-4C2-1` deriva solo dal risultato già memorizzato: sei stati, evidenze e limiti, completezza informativa, fino a due forze supportate, prime priorità con ulteriori fatti materiali accessibili, sintesi minima degli obiettivi. Non contiene risposte, storico, formule, indicatori, matrici, risorse dettagliate, esperienza, profili o domande del dossier Advisor. Gli importi obiettivo non sono proiettati. I metadata tecnici dello snapshot restano nel contratto autenticato, senza essere presentati come contenuto diagnostico.

## 10. Accesso e sicurezza

PASS nel browser e al confine HTTP: persona nuova/esistente, codice errato/scaduto/precedente/consumato, cooldown e reinvio, cookie HttpOnly/Secure/SameSite Strict, CSRF contraffatto negato, sessione scaduta e rinnovata, revoca su tutti i dispositivi. L'OTP consumato è rifiutato anche ripresentando nel test il binding originale. I limiti persistenti e l'assenza di enumerazione sono coperti anche dalla suite SQL 4C.1.

Un'altra persona verificata non vede episodi altrui e riceve NOT_FOUND su read/save/complete/snapshot di UUID copiati. Login e cambio dispositivo non creano nuove compilazioni. Nessuna chiave privilegiata nel client; solo CSRF in RAM e cookie di sessione HttpOnly. Route/API OFF rispondono 404. Intercettazione browser: sole richieste same-origin, metodi di scrittura limitati alle nuove API, zero chiamate esterne, storage e beacon bloccati attivamente. Log browser e Next controllati contro importi sintetici, email, OTP e chiavi di test.

Le asserzioni HTTP dirette del test usano i cookie del proprio browser context, letti soltanto dal driver Node: Chromium accetta Secure su loopback, mentre il cookie jar HTTP di APIRequestContext applica diversamente tale eccezione. Il codice applicativo continua a usare fetch con credentials same-origin; nessun token diventa leggibile dal JavaScript della pagina.

## 11. QA grafica e responsive

QA reale in Edge/Chromium headless a **320, 390, 768 e 1440 px**, più landscape. Verificati intro, identità/OTP, domande, matrici, obiettivi/risorse/esperienza, riepilogo, conflitto e risultato salvato. Nessun overflow orizzontale o overflow hidden sul documento; immagini caricate; Manrope, focus visibile e sul titolo, target principale almeno 44 px e reduced motion conservati.

Ispezionati screenshot desktop/mobile di identità, matrice a 320, conflitto e snapshot. Tema scuro/crema/lime, JetBrains Mono, logo e foto del funnel preservati; widget e CSS originari 4B verificati rispetto al commit storico. Non è una certificazione WCAG o prova su dispositivi fisici.

Screenshot con soli dati sintetici e `verification.json` fuori dal repository:
`C:\Users\emanu\.codex\visualizations\2026\10\18\01a14e5a-6067-71a0-a210-f3859cab8329\radar-patrimoniale-4c2`.

Il test avvia e termina autonomamente due server Next e il sink/database effimero. Comando riproducibile:

```text
npm run test:patrimonial-radar-browser -- --playwright-module=<playwright/index.mjs> --executable=<Edge-o-Chromium> --artifacts=<directory-esterna> --pg-module=<pglite-PG17/dist/index.js>
```

Senza pg-module usa il dev runtime embedded 18.6; il test di questa fase è stato eseguito su 17.5. Non richiede un server remoto o un inbox pubblico.

## 12. Build e regressioni

- Motore 4A: 72 gruppi PASS. Conservata la distinzione metodologica: 57 scenari PASS, 4 PARTIAL (CT-26/28/37/40), CT-27 NON ESEGUITO nella suite storica 4A. I nuovi test cliente non certificano autorizzazioni/assegnazioni operatori future.
- UI 4B: PASS, aggiunte guardie puntuali per widget, CSS originale e geometria SVG identici. Modificata solo la guardia backend che vietava qualsiasi modifica alla UI 4B: il perimetro 4C.2 ora è autorizzato e coperto dai test collegati. Prodotti precedenti e dominio restano protetti.
- Backend 4C.1: 14 gruppi PASS su 17.5 e 18.6, inclusa la minimizzazione HTTP della nuova proiezione. Il controllo audit ora valida chiavi/tipi/action allowlist anziché cercare cifre di importi dentro UUID casuali; copertura rafforzata, nessun dato nuovo ammesso.
- Proiezione: 14 fixture canoniche PASS, stessi sei stati/copertura, nessuna vulnerabilità materiale troncata, mancanti significativi conservati, zero campi Advisor. Normalizzazione Next testata anche con Host/porta/protocollo falsi.
- Radar d'Impresa: dieci verificatori PASS. Integrazione: v4/34 schermate, 56 file Radar, 11 file CRM, 35 fotografie identiche, 20 migration storiche immutate più la candidata già presente 4C.1.
- Funnel, ledger, CRM, opportunità, persistenza, remote mapping: PASS con provider/trasporti finti, zero chiamate remote. Presentazioni Evento/Architetto e tema condiviso: PASS, nessuna modifica a quei verificatori.
- Contenuti patrimoniali, no-platform, search, readable: PASS dopo build. Un'esecuzione dei contenuti durante rigenerazione build aveva trovato index.html non ancora disponibile; ripetuta a build conclusa con esito PASS.
- Typecheck e build standard: PASS. Lint globale senza errori, 65 warning preesistenti fuori dal perimetro; lint dei file Radar nuovi/modificati senza warning dopo rimozione di un import inutilizzato nel test.
- E2E completo: PASS sui 12 gruppi browser, incluse tutte le 40 domande, risultato server, errori/retry, identità, sicurezza, refresh e nuovi episodi. PASS anche agli stati UNKNOWN/DECLINED/UNANSWERED espliciti nel percorso con zeri e al salvataggio simultaneo da due schede: una risposta 200, una 409 e una sola nuova revisione.

**FAIL storico separato:** `test:patrimonial-live-smoke` resta incompatibile con la baseline Git globale c61ed43..., già prima della fase; non modificato, non promosso a PASS e non rieseguito qui. Mai eseguito lo smoke operativo `smoke:patrimonial`, che può produrre scritture reali.

## 13. File modificati

- `docs/patrimonial/radar-patrimoniale-v1-collegamento-ui-fase-4c2.md`
- `package.json`
- `scripts/lib/patrimonial-radar-browser-stack.mjs`
- `scripts/lib/patrimonial-radar-connected-checks.mjs`
- `scripts/verify-patrimonial-radar-backend.mjs`
- `scripts/verify-patrimonial-radar-browser.mjs`
- `scripts/verify-patrimonial-radar-projection.mjs`
- `scripts/verify-patrimonial-radar-ui.mjs`
- `src/app/radar-patrimoniale/page.tsx`
- `src/components/patrimonial-radar/radar-client.tsx`
- `src/components/patrimonial-radar/radar.module.css`
- `src/components/patrimonial-radar/result-preview.tsx`
- `src/lib/patrimonial-radar-server/customer-projection.ts`
- `src/lib/patrimonial-radar-server/http.ts`
- `src/lib/patrimonial-radar-server/runtime.ts`
- `src/lib/patrimonial-radar-server/simulated-email.ts`
- `src/lib/patrimonial-radar-ui/api.ts`
- `src/lib/patrimonial-radar-ui/customer-result.ts`

Nessuna variazione al lockfile, dipendenze runtime, motore 4A, SQL, routing CRM, asset, font, landing o checkout delle assegnazioni.

## 14. Problemi aperti e limiti

PostgreSQL nativo multiconnessione e PostgREST reale; piano futuro di applicazione/history delle migration; policy approvate di privacy, retention, diritti della persona, caselle condivise e recupero/cambio identità; provider email reale separatamente autorizzato; ingresso proxy fidato; ACL e proiezione Advisor della fase successiva. Nessuno di questi punti è reso PASS dalla simulazione locale.

Metodologia draft e validazione professionale/cognitiva restano aperte. QA browser con viewport non equivale a hardware mobile, tutte le famiglie browser o audit completo con screen reader. Nessun invio di report, contatto/opportunità, outbox CRM, raccomandazione/offerta finanziaria o automazione aggiunto.

## 15. Commit e preservazione workspace

Commit locale identificato dalla consegna e da `git log -1 -- docs/patrimonial/radar-patrimoniale-v1-collegamento-ui-fase-4c2.md`, senza hash autoreferenziale nel file. Checkout originale delle assegnazioni mai scritto, spostato, consolidato o importato. Stato iniziale originale: branch `feat/patrimonial-pilot-funnels`, HEAD b242752102542e5280bba8b6ba0c4aecf9fcd722, soli non tracciati audit fase 1 e tmp. Verifica conclusiva: stesso branch/HEAD e stessi due percorsi non tracciati. Nessuna scrittura eseguita sul checkout originale.

## 16. Readiness 4D

**Readiness 4D: base locale pronta per lo sviluppo controllato della proiezione Advisor e delle sue autorizzazioni, con i limiti espliciti sopra.** La parte nativa/PostgREST resta una verifica obbligatoria prima di qualsiasi attivazione reale, indipendente dalla possibilità di sviluppare 4D in isolamento. In ogni caso nessuna readiness pubblica: flag pagina/backend OFF per default e indisponibilità su Vercel conservati. Nessuna attivazione con persone o informazioni reali.

## Fonti tecniche

Consultati changelog Supabase, documenti correnti [Data API e grants/RLS](https://supabase.com/docs/guides/api/securing-your-api), [sessioni](https://supabase.com/docs/guides/auth/sessions) e [autenticazione PostgREST](https://docs.postgrest.org/en/stable/references/auth.html). Lo schema privato e i grants espliciti rimangono separati dai controlli sulle singole righe. Le sessioni opache del Radar sono verificate nel DB su ogni operazione, senza presumere revoca da un JWT soltanto decodificato.

Il changelog consultato il 18 ottobre 2026 segnala i cambiamenti TLS del 10 novembre, minor PostgreSQL 15.19/17.11 e deprecazione adapter server: nessuna configurazione, upgrade o SDK interessato è modificato qui. Letti AGENTS/DESIGN, report 4A/4B/4C.1, specifiche 3C pertinenti, contratti di dominio/persistenza e guide installate Next 16.3.5; applicate le skill Supabase, email, React e verifica del flusso. Le istruzioni della fase prevalgono sulla vecchia autorizzazione generica al push in DESIGN.
