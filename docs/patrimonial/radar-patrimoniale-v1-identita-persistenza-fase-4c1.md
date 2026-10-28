# Radar Patrimoniale V1 — Identità e persistenza, fase 4C.1

## Esito e perimetro

Backend dedicato implementato e verificato localmente: persona con UUID stabile, verifica del possesso email, sessioni opache revocabili, bozze riprendibili, risposte versionate e completamento atomico tramite motore 4A. Nessun collegamento della UI 4B al salvataggio, nessuna raccolta pubblica attivata, email reale o effetto HighLevel. La route e il backend restano OFF per default.

Worktree esclusivo: `C:\Users\emanu\.codex\worktrees\radar-patrimoniale-v1\horyzon-website`. Branch `feat/radar-patrimoniale-v1`, partenza pulita al commit atteso `90592d99f3bf930a968cadab71ea312abfacc858`. Nessun conflitto Git. Nessun file del checkout originale scritto, copiato, consolidato o importato. I documenti delle assegnazioni nell'altro checkout sono stati letti solo come contesto, senza assumere che le loro precedenti note di mancata applicazione descrivano ancora il remoto.

Fonti locali: AGENTS e DESIGN; report 4A/4B; specifiche 3C di obiettivi, revisioni e doppia vista; contratti Supabase/HighLevel, store, ledger/outbox e migrazioni patrimoniali; documentazione delle identità operatori/owner e readiness. Consultate le guide Next 16.3.5 installate, le skill Supabase, Postgres, email e autenticazione. I vincoli della richiesta prevalgono sulla vecchia autorizzazione generica al push in DESIGN.

## Stato effettivo delle capability esistenti

Introspezione remota **solo in lettura** sul progetto Horyzon il 18 ottobre 2026, senza leggere record personali o configurazioni segrete:

| Verifica | Evidenza osservata |
| --- | --- |
| PostgreSQL remoto | `17.6.1.166`, major 17 |
| Health | `patrimonial-v2-store-1` |
| Contratto capability | `patrimonial-runtime-capabilities-v1` |
| Assegnazioni | `assignmentManagement: p1-v1` |
| Owner sync | `ownerSync: p2b-v1` |
| Migration history | Presenti `patrimonial_lead_v2`, correzione precedence, assignment management, owner sync e runtime capabilities |
| Ruoli | anon/authenticated senza BYPASSRLS; service_role con BYPASSRLS |
| Tabelle ledger/intents/participations/outbox | ENABLE e FORCE RLS osservati |
| Nuovo schema e RPC Radar | `patrimonial_radar_private` e `public.patrimonial_radar_command(jsonb)` assenti sul remoto |

Queste evidenze provano presenza/versione degli oggetti osservati, non attivazione dei flag, permessi HighLevel o funzionamento live del worker. Le nuove capability di assegnazione non sono importate nel branch Radar. Nessuna loro tabella, funzione o regola è modificata dalla candidata.

La history remota ha timestamp diversi da alcuni file storici locali: per esempio lead v2 `20261014215416` sul remoto e `20261014225059` nel repository; correzione `20261015101816` contro `20261015100912`. Prima di un futuro rilascio serve un piano esplicito di allineamento/verifica history e contenuti. Non sono stati eseguiti repair, pull, push o applicazioni remote.

## Identità e verifica email

`persons.id` è un UUID interno, indipendente da compilazione, contatto, opportunità e operatore. `verified_emails` associa una chiave HMAC dell'email normalizzata al profilo verificato. Una nuova compilazione o un nuovo dispositivo non creano una nuova persona per la stessa casella verificata. Il modello consente in futuro più indirizzi per persona, ma non implementa fusioni o cambi email automatici.

La verifica attesta il possesso della casella, non l'identità anagrafica o il diritto sui dati di tutti i componenti del nucleo. Caselle condivise, cambio email, rettifica dell'identità e recupero account richiedono procedure dedicate prima dell'uso reale. Non vengono dedotte equivalenze da telefono, alias del provider, email funnel o owner CRM.

OTP crittograficamente casuale a otto cifre, scadenza DB di dieci minuti, massimo cinque tentativi. Persistono solo HMAC con separazione degli scopi, binding della richiesta e timestamp/stati. Codici, token e indirizzi email in chiaro non sono salvati nel database. L'indirizzo e il codice esistono transitoriamente solo per la porta email simulata nei test; nessun log o risposta HTTP li restituisce.

Limiti persistenti: una richiesta al minuto e cinque in trenta minuti per casella; venti richieste l'ora per chiave di rete fidata; trenta verifiche in dieci minuti per chiave di rete, oltre al limite della singola challenge. La nuova challenge revoca quelle precedenti ancora aperte. I rifiuti OTP ritornano dal SQL senza sollevare eccezioni nella transazione: il contatore viene quindi realmente committato prima del rifiuto applicativo. Un solo verificatore concorrente può consumare il codice e creare la sessione.

La risposta di richiesta è identica per nuova casella, casella esistente, throttling e fallimento di consegna. Una challenge non accettata non permette verifiche. La verifica richiede anche il binding HttpOnly della richiesta originaria e il relativo CSRF. La futura UI dovrà rispettare il cooldown prima del reinvio.

Un'impronta del secret è vincolata persistentemente allo store: una sostituzione accidentale del pepper fallisce chiusa anziché creare identità parallele. Non è una rotazione automatica. Gestione, backup e rotazione del secret richiedono un piano che preservi la mappatura delle identità e revochi le sessioni interessate; nessun secret reale è stato creato o acquisito in questa fase.

## Sessioni e confine HTTP

Token opaco casuale da 256 bit; solo HMAC nel database. Durata assoluta di otto ore e inattività di trenta minuti, entrambe controllate sul tempo DB. Revoca del dispositivo corrente o di tutti i dispositivi. Ogni comando autenticato ricontrolla sessione, scadenze, revoca e persona attiva, anche al commit dopo una lettura precedente.

Cookie host-only, HttpOnly e SameSite=Strict. In produzione: Secure, prefisso `__Host-` e Path=/; nei soli test HTTP locali cookie non Secure. Token mai nel JSON di risposta o negli URL. Il CSRF restituito al client non autorizza richieste senza cookie e sessione DB validi.

Ogni POST richiede Origin esatta configurata sul server, JSON e header dedicato. Richiesta OTP iniziale: header non semplice `X-Patrimonial-CSRF: request-code`; verifica OTP: HMAC legato al binding; modifiche autenticate: HMAC legato alla sessione. Fetch Metadata rifiuta origini cross-site e same-site non identiche; non vengono abilitate CORS permissive. Nessuna fiducia in forwarding/IP header inviati dal browser. L'adapter di questa fase usa una sola chiave di rete locale; il futuro ingress pubblico deve derivare la chiave da proxy esplicitamente fidati.

Parser con limite effettivo di 64 KiB, profondità e numero di nodi limitati, rifiuto di chiavi pericolose e proprietà non previste. Query string non ammesse. Risposte private/no-store; errori esposti come codici generici, senza payload o cause del provider.

### Contratto API dedicato

Prefisso `/api/patrimonial-radar`, route Next catch-all separata dagli endpoint Radar d'Impresa.

| Metodo e suffisso | Input essenziale | Comportamento |
| --- | --- | --- |
| POST `/identity/request` | email | 202 generico, challengeId/CSRF e cookie di binding; nessun OTP restituito |
| POST `/identity/verify` | challengeId, code | Cookie di sessione; UUID persona, scadenza e CSRF |
| GET `/session` | Cookie | Verifica corrente e CSRF |
| POST `/session/revoke` | allDevices opzionale | Revoca DB e cancellazione cookie |
| POST `/assessments` | requestId UUID v4, entryMode opzionale | Crea o riprende idempotentemente lo stesso episodio |
| GET `/assessments` | Cookie | Storico metadata della sola persona corrente |
| GET `/assessments/:id` | Cookie | Bozza con ultima revisione per domanda, metadata degli stati e percorso applicabile |
| POST `/assessments/:id/answer` | requestId, expectedRevision, questionId, state, value se pertinente | Salvataggio CAS o replay |
| POST `/assessments/:id/complete` | requestId, expectedRevision | Calcolo 4A e snapshot atomico; risposta con soli metadata |
| GET `/assessments/:id/snapshot` | Cookie | Metadata dello snapshot della sola persona corrente |

Identità proprietaria, revisioni delle singole domande, versioni del motore e risultato non sono accettati come autorità dal browser. Accessi a UUID di altre persone restituiscono NOT_FOUND anche per save/complete/snapshot. Sessione invalida: UNAUTHENTICATED; CSRF/Origin errati: FORBIDDEN; revisione obsoleta o chiave riusata con payload diverso: CONFLICT.

Il servizio interno può leggere il risultato canonico per calcolo e verifiche. Il confine HTTP restituisce solo i metadata del completamento, senza dossier, formule, domande interne o riferimenti dell'intero storico. La ripresa espone solo l'ultima dichiarazione per domanda, necessaria alla compilazione/riconferma, senza le cifre superate e senza duplicare i valori negli stati risolti. Le proiezioni cliente/operatore e il percorso separato di accesso ai dati personali completi restano da realizzare nelle fasi pertinenti.

## Schema e migration candidata

Generata con Supabase CLI 2.121.0: `supabase/migrations/20261018191940_patrimonial_radar_identity_sessions.sql`. **Non applicata al remoto.** Transazione DDL unica, schema privato nuovo e una sola RPC pubblica SECURITY INVOKER. Tutte le funzioni hanno search_path fissato e riferimenti qualificati.

| Tabella privata | Finalità |
| --- | --- |
| settings | Binding del secret per impedire divergenze accidentali d'identità |
| persons | UUID stabile, stato di cancellazione futura e review retention |
| verified_emails | Chiave HMAC unica, persona e verifica |
| rate_limits | Finestre e contatori persistenti |
| challenges | HMAC OTP/binding, tentativi, consegna, scadenza, consumo/revoca |
| sessions | HMAC token, persona, scadenze e revoca |
| assessments | Episodio, persona, chiave creazione, data e versioni congelate, revisione/stato |
| answer_revisions | Registro append-only, revisione domanda e compilazione, envelope canonico |
| receipts | Idempotenza per episodio/richiesta, hash e ricevuta tecnica senza copia finanziaria |
| snapshots | Un risultato canonico immutabile per episodio, hash, versione e riferimenti approvati |
| integration_links | Riferimenti futuri, solo UNRESOLVED, senza writer runtime o consegna |
| audit_events | UUID, azione tecnica, revisione e tempo; nessuna risposta, recapito o profilo |

ENABLE e FORCE RLS sulle dodici tabelle, nessuna policy client. Revocati privilegi e execute a PUBLIC/anon/authenticated; service_role ha solo gli accessi server necessari, senza DELETE e con UPDATE limitato alle colonne mutabili. Non può riassegnare la persona di sessioni, email verificate o compilazioni. Lo schema privato non viene esposto alla Data API. La RPC pubblica non è invocabile dai ruoli browser; i controlli di proprietà e sessione sono comunque presenti al suo interno. Nessuna service_role nel client. Revisioni, snapshot e ricevute hanno protezione di immutabilità. FK e indici dedicati, nessuna modifica a schemi/tabelle dei prodotti precedenti.

Il trasporto applicativo ammette esclusivamente un endpoint Supabase locale loopback, non legge le variabili Supabase di produzione e non ripete automaticamente un commit ambiguo. La suite SQL verifica la stessa RPC tramite un adapter database parametrizzato, non tramite un PostgREST reale: handshake REST completo ancora da provare in uno stack locale/native autorizzato.

## Revisioni, ripresa e completamento

Creazione idempotente per persona e requestId; nuovo requestId esplicito = nuovo episodio. Le chiavi tecniche non danno accesso. La data della fotografia è fissata dal DB alla creazione; la ripresa non la cambia silenziosamente. Una nuova fotografia temporale richiede un episodio esplicito.

`save` legge il registro, controlla proprietà/versioni e applicabilità, valida con il dominio 4A e genera server-side l'envelope tramite `recordAnswer`. Le risposte monetarie devono corrispondere a data e perimetro della compilazione. Il commit ricontrolla sessione e expectedRevision sotto lock. Per ogni nuova risposta la revisione complessiva e quella della domanda crescono; una conferma identica ancora attiva è un no-op con ricevuta, per non invalidare inutilmente le dipendenze. Una richiesta ripetuta restituisce la ricevuta; payload diverso sulla stessa chiave viene rifiutato. Nessun retry cieco dopo esito ambiguo.

La ripresa restituisce gli stati ACTIVE/INACTIVE/RECONFIRM del dominio, preservando lo storico. Dati condizionali inattivi non partecipano al risultato. Un cambio perimetro non riconferma automaticamente i dati economici. Gli stati zero, UNKNOWN, DECLINED e UNANSWERED rimangono distinti.

Il completamento usa esclusivamente il registro server e `VERSIONS` della 4A. Domande ordinarie mai confermate, errori o riconferme ordinarie pendenti bloccano il completamento; mancanti espliciti sono consentiti e producono limiti diagnostici. I dettagli facoltativi inattivi/da riconfermare restano esclusi dal motore, senza diventare dati approvati implicitamente.

Calcolo fuori dalla transazione, poi nuovo controllo di sessione/revisione e commit unico di snapshot, stato COMPLETED, ricevuta e audit. Una modifica concorrente rende obsoleto il calcolo e causa CONFLICT. Unique per episodio impedisce due risultati anche con chiavi completion diverse. Snapshot e compilazione completata non sono riscrivibili tramite API. Gli hash canonici escludono timestamp operativi e identificativi del completamento; riferimenti e registro append-only consentono di ricostruire esattamente gli input usati, senza un'ulteriore copia integrale delle risposte nello snapshot.

## CRM, eventi e percorsi futuri

Nessun nuovo worker/coda, contatto, opportunità, assegnazione, owner sync o evento consegnabile. L'audit tecnico COMPLETED è privato e atomico col risultato; non è un messaggio CRM. `integration_links` non viene popolata dall'API e non attribuisce alcun diritto di accesso.

Estensione futura proposta del ledger/outbox esistente: evento versionato `radar_completed` con chiave `assessmentId:approvedRevision`, FK/riferimento esplicito allo snapshot e allowlist di soli riferimenti opachi, revisione e stato operativo. Nessun importo, risposta, profilo, PDF o evidenza economica nel payload CRM. Aggiungere in modo esplicito il caso Radar ai vincoli del ledger, senza intent fittizi o riuso dell'owner come persona. Il futuro evento va inserito dalla stessa transazione del risultato. La relativa operazione outbox dovrà restare HOLD/non consegnabile finché contratto, worker e flag dedicato non saranno autorizzati; claim/lease/fencing/retry rimangono quelli esistenti. Questa estensione non è applicata qui perché il ledger corrente richiede aggregati di altri flussi e non deve essere forzato per il solo completamento Radar.

Ingresso A: login verificato, avvio autonomo e nuova compilazione esplicita. Ingresso B: stesso login, eventuale relazione con una partecipazione solo dopo prova server dedicata; entryMode=EVENT è contesto dichiarato, non prova. Ingresso C: nuova verifica su altro dispositivo, stessa persona, elenco/ripresa della bozza o nuovo episodio dopo il completamento. Email digitata, parametri URL e request UUID non autorizzano collegamenti o letture. Partecipazione, identità cliente e operatore responsabile restano relazioni distinte.

## Privacy e attivazione

Solo email transitoria per la verifica; nessun nome, telefono, documento o nominativo familiare. Nessun consenso marketing acquisito o dedotto da funnel, nessun PDF/email di risultato. Base giuridica, nuova informativa di servizio e gestione dei bilanci condivisi restano da approvare prima della raccolta. Le autorizzazioni operatori e le proiezioni Client/Advisor non sono implementate da questa fase.

Retention parametrizzabile come review marker (`retentionReviewDays`, default non configurato); i trenta giorni usati nelle fixture sono un dato di test, non una policy approvata. Nessun purge/scheduler. Stato persona inattiva e revoca preparano i confini di rettifica/cancellazione; il workflow verificato di erasure/export/riconciliazione email e l'eventuale eccezione controllata all'immutabilità per cancellazione devono essere realizzati dopo la policy, non sono dichiarati operativi.

La porta email accetta solo provider SIMULATED. Nei test è iniettato un provider in memoria. Il runtime Next resta senza consegna: fallisce chiuso e non offre endpoint per leggere OTP. Provider reale e collegamento UI non sono simulati come funzionalità già pronte. Il test HTTP positivo usa il medesimo handler con database vero locale e porta simulata iniettati, senza attivare l'ambiente Next.

Anche il backend ha un gate separato OFF: occorrerebbero `PATRIMONIAL_RADAR_BACKEND_ENABLED=true` e `PATRIMONIAL_RADAR_BACKEND_CONTEXT=local-test`; Vercel/VERCEL_ENV=production sono sempre negati. L'eventuale configurazione locale usa esclusivamente `PATRIMONIAL_RADAR_LOCAL_ORIGIN`, `PATRIMONIAL_RADAR_LOCAL_SUPABASE_URL`, `PATRIMONIAL_RADAR_LOCAL_SERVER_KEY`, `PATRIMONIAL_RADAR_LOCAL_SECRET`. Nessun file env o valore remoto è stato creato o copiato; questi flag non sono stati attivati nella build testata. Il flag della pagina 4B è invariato.

## Test eseguiti e limiti

`npm run test:patrimonial-radar-backend`: **14 gruppi PASS**, sia su PGlite 0.5.10/PostgreSQL **18.6**, sia su runtime alternativo PGlite 0.3.16/PostgreSQL **17.5**, stessa major del remoto 17.6. Applicate esclusivamente in database effimeri le due migration patrimoniali di base e la nuova candidata. Sono esecuzioni PostgreSQL reali WASM, non mock SQL. Docker installato ma impossibilitato ad avviare il motore; nessun cluster nativo attivato. Il runtime 17 è isolato fuori dal repository, nella directory dei test locali; la sola nuova devDependency del progetto è PGlite 0.5.10 pin esatto.

| Copertura backend | Esito |
| --- | --- |
| Persona stabile, email normalizzata, due dispositivi e due persone | PASS |
| OTP valido, errato, scaduto, riusato, limite persistente, consumo concorrente e reinvio | PASS |
| Binding di verifica e CSRF, anche con CSRF valido di un binding diverso | PASS |
| Rate email/rete e provider simulato indisponibile senza enumerazione | PASS |
| Sessione scaduta, inattiva, revocata e revoca su tutti i dispositivi | PASS |
| Lettura/save/complete/snapshot incrociati, UUID copiati, scritture senza autorità | PASS |
| Creazione/salvataggio idempotenti, chiavi riusate con payload diverso e conferma invariata | PASS |
| Due dispositivi con expectedRevision uguale, save contro complete | PASS, un vincitore CAS |
| Revoca fra lettura e commit | PASS, completamento negato e nessuno snapshot |
| Snapshot uguale al motore, versioni e hash deterministici, doppio completamento | PASS |
| Inattività condizionale, zero strutturale, cambio perimetro, riconferme e versione obsoleta | PASS |
| Failure SQL dopo insert snapshot | PASS, rollback di snapshot/stato/ricevuta/audit |
| Dodici tabelle FORCE RLS e privilegi, anon/authenticated negati, RLS efficace anche sotto SELECT temporaneo | PASS |
| Snapshot immutabile, funzioni CRM di base conservate, audit senza valori economici | PASS |
| Restore a freddo del DB | PASS: persona, bozza, sessioni/revoche, tentativi e rate limit conservati |
| HTTP reale loopback con handler iniettato | PASS: cookie HttpOnly/Strict/Secure, CSRF/Origin, no token nel JSON/URL, errori minimizzati, body limit |
| CRM/network indisponibili | PASS: completamento senza dipendenze; zero chiamate esterne tentate |
| Transport REST | Mock: errore sanificato, URL remoto rifiutato, nessun retry ambiguo; PostgREST reale NON ESEGUITO |

PGlite usa una sola connessione: i test interlacciano letture e commit e verificano i fence CAS, ma **non provano lock wait/deadlock/MVCC con connessioni native indipendenti**, carico o configurazione Supabase/PostgREST. Il restore embedded non è una prova di backup/PITR del progetto remoto. Le prove cookie/HTTP non sono una nuova sessione browser end-to-end con email reale. Il kernel locale 17.5 non è identico al cluster gestito 17.6.1.166. Prima di applicare/attivare, ripetere i casi di concorrenza/RLS e il percorso completo su uno stack autorizzato corrispondente.

Regressioni 4C.1:

| Comando/controllo | Esito |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS: 0 errori, 65 warning preesistenti; lint dedicato senza nuovi warning |
| `npm run build` | PASS, inclusa generazione Markdown |
| `npm run test:radar` | PASS |
| `npm run test:patrimonial-radar` | PASS: 72 gruppi, conservati i limiti metodologici 4A |
| `test:patrimonial`, `test:patrimonial-funnels` | PASS dopo la build |
| `test:patrimonial-ledger`, `test:patrimonial-crm`, `test:patrimonial-opportunities` | PASS, fixture e provider finti |
| `test:patrimonial-persistence`, `test:patrimonial-remote-mapping` | PASS, verificatori precedenti mock/statici; nessuna chiamata remota |
| Verificatori form, Evento, Architetto e tema | PASS |
| `test:patrimonial-radar-ui` | PASS |
| `verify-patrimonial-integration.mjs` | PASS: 34 schermate v4, 56 file Radar, 11 file CRM, 20 migration immutate e 35 asset byte-identici |
| `test:no-platform`, `test:search`, `test:readable` | PASS: 99 pagine in sitemap, nuova route non aggiunta |
| HTTP sulla build Next con flag OFF | PASS: pagina e API GET/POST 404, JSON privato no-store; nessun DB configurato |
| Bundle browser della build | PASS: assenti implementazione RPC e nomi delle variabili di secret del nuovo backend |

Il verificatore contenuti era stato inizialmente avviato mentre la build rigenerava `.next`, producendo ENOENT; rieseguito dopo la build, PASS. Non è stata modificata la UI per ottenere verde. Le due guardie storiche di preservazione sono state estese con allowlist esatte per nuova route/migration e dipendenza di test: tutti i file/risoluzioni preesistenti restano verificati, non è stata rimossa copertura. I 65 warning lint sono esterni ai file nuovi. Restano i casi 4A parziali; CT-27 della 4A non viene promosso a PASS completo, perché l'accesso operatori/assegnazioni non è parte di 4C.1.

Il fallimento storico del verificatore smoke locale per il confronto globale con `c61ed43...` resta separato da questi esiti; non è stato rieseguito in 4C.1 né dichiarato PASS. Nessun comando operativo `smoke:patrimonial` eseguito e nessuna scrittura live.

## File modificati e readiness 4C.2

Nuovi: `src/lib/patrimonial-radar-server/{contracts,security,store,service,http,runtime}.ts`; `src/app/api/patrimonial-radar/[...segments]/route.ts`; migration candidata; `scripts/lib/patrimonial-radar-db.mjs`; `scripts/verify-patrimonial-radar-backend.mjs`; questo report.

Aggiornati: package.json (comando backend e sola devDependency PGlite), package-lock.json (soli inserimenti della dipendenza nuova), verificatori integrazione/UI (allowlist additiva con conservazione delle baseline precedenti). Nessun altro file di prodotto, motore, asset, tema o assegnazione modificato.

**Readiness 4C.2: fondamenta disponibili e testate per il successivo collegamento controllato.** Non è readiness pubblica. Restano: test native multiconnessione/PostgREST; piano migration/history e applicazione separatamente autorizzata; revisione privacy, retention e diritti; gestione sicura dei secret e ingresso proxy; provider email autorizzato e integrazione UI; verifica reale della sessione da browser; eventuali proiezioni e ACL operatori. Il collegamento verificato evento/CRM e il futuro effetto outbox richiedono un contratto esplicito, non matching per email o import automatico delle assegnazioni.

Commit locale identificato nella consegna e con `git log -1 -- docs/patrimonial/radar-patrimoniale-v1-identita-persistenza-fase-4c1.md`, senza hash autoreferenziale nel file. Nessun push, deploy, merge su main, db push, email reale, modifica HighLevel o migrazione remota.

## Riferimenti tecnici consultati

Consultati il 18 ottobre 2026: [sessioni Supabase](https://supabase.com/docs/guides/auth/sessions), [RLS e privilegi](https://supabase.com/docs/guides/database/postgres/row-level-security), [funzioni e security invoker](https://supabase.com/docs/guides/database/functions), [migration e history](https://supabase.com/docs/guides/deployment/database-migrations), [changelog](https://supabase.com/changelog). La soluzione usa sessioni opache proprie e controlli DB correnti; non presume revoca immediata da un JWT decodificato. I ruoli server e gli invoker non sostituiscono i controlli di proprietà implementati nella RPC.

Esaminati i cambiamenti pertinenti del changelog: [TLS](https://supabase.com/changelog/cbc-tls-ciphers-deprecated), [minor PostgreSQL](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes), [deprecazione adapter server](https://supabase.com/changelog/supabase-server-adapters-deprecated). Nessuna modifica di TLS, upgrade remoto, SDK o schema gestito applicata. Il codice candidato non usa gli adapter deprecati o estensioni interessate; l'idoneità dell'upgrade gestito resta da verificare nel piano operativo, non è stata dedotta dal test embedded.

Per il confine browser: [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), pattern header non semplice/Origin e token HMAC legato alla sessione; per i test SQL: [PGlite](https://pglite.dev/docs/about) e [API](https://pglite.dev/docs/api). Questi riferimenti guidano le scelte, non attestano una certificazione di sicurezza o conformità privacy.
