# Radar Patrimoniale — deployment readiness del broker, 5B.5

26 ottobre 2026. **Pacchetto Node/Vercel predisposto localmente; NO-GO per la prima attivazione controllata.** La decisione non dipende più soltanto da un'autorizzazione al deploy: è stato riprodotto un rischio dell'autorità di firma nel modello PostgreSQL/PostgREST condiviso. Non configurare il broker come Custom OIDC del Supabase Horyzon condiviso.

## 1. Decisione sull'issuer: blocco architetturale

Fonti correnti: [Custom OIDC Supabase](https://supabase.com/docs/guides/auth/third-party/custom-oidc), [Third-Party Auth](https://supabase.com/docs/guides/auth/third-party/overview), [ruoli PostgREST](https://docs.postgrest.org/en/stable/references/auth.html), OpenAPI pubblico **https://api.supabase.com/api/v1-json** letto senza autenticazione. Consultato anche il changelog Supabase: gli avvisi TLS/CBC e PostgreSQL17.11 non cambiano il problema dell'autorità del signer.

Il contratto Supabase documenta la scelta del ruolo dalla claim `role`; senza claim il ruolo è anon. Lo schema **CreateThirdPartyAuthBody** del Management API espone soltanto `oidc_issuer_url`, `jwks_url`, `custom_jwks`: **nessuna allowlist/mappatura di ruoli per singolo issuer è esposta da quel contratto pubblico**. Non è stata dimostrata una garanzia alternativa del gateway gestito. Non confondere questa integrazione, che accetta JWT esterni nelle Data API, con un provider OAuth di login che termina in una nuova sessione Supabase Auth.

Un controllo nel metodo broker.exchange non basta: il possesso della privata consente di firmare JWT senza eseguire quel metodo. La prova nativa lo fa realmente, con chiave ES256 sintetica, authenticator/SET ROLE/RLS reali e una tabella canarino interamente inventata. Il canarino appartiene a un UUID sintetico; authenticated ha una policy proprietario, service_role ha BYPASSRLS nel modello locale.

| Token firmato dalla stessa chiave sintetica | Ingresso ampio, canarino | Ingresso isolato, canarino |
| --- | --- | --- |
| role=authenticated, sub proprietario sintetico | **200, lettura consentita fuori Radar** | **403** |
| role=service_role | **200, lettura consentita fuori Radar** | **403** |
| role=postgres | 403: nessuna membership postgres | 403 |
| ruolo sconosciuto | 401 | 401 |
| role omessa | 401: anon senza permesso sul canarino | 401: nessun ruolo anon configurato |

Con ruolo runtime valido, l'ingresso isolato accetta la RPC health positiva. Issuer diverso, audience diversa o omessa sono respinti da verifica/pre-request del modello isolato. Nell'ingresso ampio, gli stessi tentativi health raggiungono il DB con HTTP 200 ma `ok=false`: è runtime_allowed a negarli, non una prova di filtro globale dell'issuer. La matrice include 16 richieste concorrenti valide/ostili e verifica che il pool non conservi ruolo o claim della transazione precedente.

**Questa non è una prova di exploit del gateway Supabase remoto:** quel gateway non è stato configurato o chiamato con token broker. È una dimostrazione del rischio concreto del modello e dell'insufficienza del controllo nel signer. L'assenza di un limite autorevole documentato/verificato impedisce di autorizzare la fiducia globale nel progetto condiviso. Non dichiariamo che ogni stringa role sia accettata: le membership SQL continuano a porre un limite, e postgres è effettivamente negato.

### Contenimento raccomandato da deliberare

**Ingresso PostgREST dedicato, separato dal gateway Supabase condiviso, con login PostgreSQL NOINHERIT membro esclusivamente di patrimonial_radar_runtime.** La chiave pubblica broker è fidata soltanto da questo ingresso; non è registrata in Third-Party Auth Horyzon. Nessuna membership authenticated/service_role/postgres/horyzon_platform/issuer, nessun table grant, ruolo anon assente. Verifica issuer e audience esatti prima delle quattro RPC approvate; il DB conserva registrazione jti, origine, scadenza e revoca per ogni operazione.

Il limite è posto da PostgreSQL, fuori dal controllo della chiave di firma: persino un token service_role validamente firmato non può far eseguire SET ROLE a quel login. Il processo di emissione conserva un login issuer separato, limitato alle due funzioni private di registro; non si fondono i due login. Il ruolo operativo non deve poter concedere membership o diventare amministratore. Audit di ACL/default grants e funzioni ereditate da PUBLIC rimane obbligatorio.

Questo contenimento è **verificato soltanto con un secondo processo PostgREST locale** e oggetti effimeri di test. Non è stato aggiunto un nuovo backend prodotto, modificata una migration o cambiato l'URL Supabase fissato nel RemoteRadarRpc. La futura connessione Website → ingresso isolato richiede un endpoint/progetto e un pin approvati, oltre alla review dell'esatta configurazione del login. La baseline Website non viene presentata come già compatibile con un endpoint differente.

Un progetto/database separato è un'altra possibile barriera, ma sposterebbe dati/integrazioni oggi condivise con Hub/P1: richiede una decisione di dominio e non è sviluppato qui. **La decisione richiesta al referente è l'adozione e gestione dell'ingresso ristretto**, non la creazione immediata di un'altra astrazione software.

## 2. Hosting prioritario e costi

Raccomandazione per il componente broker: **progetto Vercel indipendente**, root esatta `Platform/services/radar-credential-broker`, nessun Git link automatico, nessuna Shared Environment Variable, nessuna credenziale Website/Hub/Radar copiata. È una raccomandazione subordinata al contenimento precedente e alla prova di provisioning; non un GO all'issuer attuale.

La [documentazione Node Vercel](https://vercel.com/docs/functions/runtimes/node-js) supporta entrypoint Fetch in api/index.ts e Node 24. Il servizio preesistente avviava un listener loopback e process.exit: quel lifecycle non è usato come Function. Il nuovo entrypoint non apre socket, non esegue shutdown del processo, non conserva contesto di una richiesta in variabili globali.

| Aspetto | Vercel indipendente | Container isolato |
| --- | --- | --- |
| HTTPS/discovery/JWKS | Origin dedicata stabile; letture pubbliche solo metadati/JWK pubbliche | Reverse proxy/TLS e rinnovo certificati da gestire |
| /v1/lease | OIDC Vercel custom audience + PoP + registro; attualmente 503 obbligatorio | Stesso protocollo; cambiare host non limita da solo la firma |
| DB | TLS con verifica certificati, login issuer ristretto; percorso di rete da approvare | Più semplice concentrare broker e ingresso ristretto in rete privata, con login distinti |
| Cold start | Possibile; nessun dato persistente in memoria; latenza reale non misurata | Si può mantenere un processo attivo, pagando risorse/gestione continuative |
| Pool/concorrenza | Più istanze moltiplicano i pool; limite SQL del login, dimensionamento e budget necessari | Numero processi e connessioni più direttamente controllabile |
| Chiavi | Secret runtime isolato o autorità dedicata da approvare; env write-only non equivale a key non esportabile | Secret mount/runtime/KMS e accesso amministrativo da governare |
| Operazioni | Packaging nativo e rollback deployment; supervisione di costi/errori | Patching, ingressi, immagini, backup e reperibilità espliciti |

L'hosting Vercel non è tecnicamente escluso. Se rete privata, custodia o consegna runtime esclusiva non risultano dimostrabili sul piano approvato, **STOP e scelta umana del container**, senza abbassare i controlli. Nessun progetto/container è stato creato e nessun fornitore aggiuntivo è stato selezionato o contrattualizzato.

Costi indicativi al 26/10: [Pro](https://vercel.com/docs/plans/pro-plan) elenca 20 USD/mese di piattaforma, un seat incluso e 20 USD di credito; un nuovo progetto non viene assunto equivalente a un nuovo abbonamento. Piano/fattura reali Horyzon **non verificati**. La [tariffa Functions fra1](https://vercel.com/docs/functions/usage-and-pricing) riporta 0,184 USD/CPU-ora, 0,0152 USD/GB-ora e 0,60 USD/milione invocazioni. Un esempio ipotetico di 10.000 scambi, 100 ms CPU e 1 s totale con 2 GB ciascuno vale circa **0,142 USD di solo compute/invocazioni**, prima di crediti, rete, DB, log, build, add-on e imposte. Non è una misura di carico o un preventivo completo. Per il container/ingresso separato serve un preventivo su risorse, rete e gestione: non viene inventata una tariffa.

La Function candidata ha maxDuration 10 s e fra1; non promette una SLA. Futuri limiti: connessioni DB per login e pool complessivo, timeout di connessione/query, max 32 slot lease attivi per origine già presente, WAF/rate limit e limite di spesa con arresto approvati. Un rate limit in memoria su una singola istanza non controlla la flotta. P95/cold start, TLS del DB remoto e saturazione dei pool restano prove da svolgere prima dell'apertura.

Monitoraggio minimo: conteggi di scambi emessi/negati, latenza, errori/timeouts, slot attivi, connessioni e revoche. Solo ID opachi/esiti, nessun header Authorization, JWT, PoP, cookie, DSN o body. Disabilitare debug/request dump e controllare anche proxy/drain/provider. Costi e alert da approvare con un responsabile; non sono stati attivati Analytics, toolbar o strumenti aggiuntivi.

## 3. Adattamenti implementati, tutti inattivi

- `api/index.ts`: Fetch entrypoint Vercel, separato dal listener Node storico.
- `src/web.ts`: tre path esatti, niente query/CORS, metadati pubblici separati da signer/DB, limiti 8 KiB body/16 KiB bearer, no-store, errori sanitizzati e diniego concorrente senza fallback.
- `src/activation.ts`: veto nel codice, non un flag env. **La Function non collega alcun loadBroker, privata o login DB**; POST lease restituisce503. Anche npm start si arresta prima di leggere credenziali. Il broker iniettato resta esercitabile nei soli test sintetici.
- `vercel.json`: framework nullo, build locale/typecheck, npm ci senza script, tre rewrite e 10 s/fra1; nessun riferimento a progetto reale, secret, variabile Shared o target Production.
- `.vercelignore` e allowlist del package: esclusi env, chiavi, file temporanei, test e dipendenze dall'upload/pacchetto. npm pack è stato eseguito **solo dry-run**, senza pubblicazione.
- Test Fetch/lifecycle/metadata, matrice issuer compromesso con ingresso isolato, PoP non consegnata e concorrenza.

Dipendenze applicative broker invariate e fissate; lockfile aggiorna soltanto l'engine Node 24. Nessun cambio a motore/questionario/funnel/UI, logica Hub/P1/HighLevel o migrazioni storiche/candidate. La configurazione è distribuibile come **servizio chiuso**; tsc/dry-run non certificano routing, protezione o comportamento di una Function Vercel realmente distribuita. Non è stato eseguito vercel build/pull/link/deploy.

Il nuovo nome `RADAR_BROKER_PUBLIC_JWKS` contiene esclusivamente JWK pubbliche. Discovery/JWKS non accedono a privata ES256 o DB e non rendono quella chiave fidata da Supabase. Senza configurazione pubblica valida rispondono indisponibile. Questo consente futura pubblicazione HTTPS dei metadati senza bootstrap di credenziali; non autorizza a farlo ora.

## 4. Provisioning PoP per singolo deployment — procedura e STOP

**Consegna esclusiva Vercel NON DIMOSTRATA; gate chiuso.** Le variabili di progetto Config/Secret e quelle Shared non sono una credenziale per singolo artefatto. Le [Secret Vercel](https://vercel.com/docs/environment-variables/sensitive-environment-variables) sono write-only, con redazione dei log in certe condizioni, ma tali caratteristiche non provano esclusività runtime/build o non ereditarietà. La CLI documenta --env runtime; un valore in argv/history rimane una perdita. La redazione dei log non è una prova che il valore non sia mai stato acquisito.

Procedura futura del **provisioner fidato**, da validare con un'operazione separatamente autorizzata:

1. Referente approva SHA, progetto/team pilota, target Preview, finestra, origin UUID nuovo e riferimento di approvazione. CI verifica HEAD e working tree pulito da checkout effimero; sorgenti/dipendenze attestati, nessuna env locale nei file di upload.
2. Custode predispone il processo fidato per **una nuova coppia P-256 ES256**, da generare solo dopo la prova del canale al passo 3. La privata dovrà restare in memoria/canale protetto, mai stdout/stderr, file di repository, script arg, variabile NEXT_PUBLIC, CI output o cache/artefatto. Niente shell tracing, HTTP dump o payload in eccezioni. Solo JWK pubblica/thumbprint entrano nell'evidenza ordinaria.
3. Operatore Vercel deve identificare un canale supportato di consegna **per deployment e solo runtime**: chiamata autenticata in memoria con body protetto o equivalente attestato dal provider, senza passare il valore negli argomenti CLI. Non viene inventato qui un campo REST non verificato né usato env add project-wide come surrogato. **Se tale canale non è dimostrato, non generare/consegnare una chiave reale e fermarsi.**
4. Solo dopo quella prova e l'autorizzazione esplicita, il provisioner genera la coppia in memoria e crea l'artefatto specifico con origin UUID e PoP privata tramite quel canale; nessun riuso di deploymentId/rerun che erediti la vecchia env. Eventuali log della creazione conservano solo ID/stati. Endpoint lease rimane chiuso durante bootstrap.
5. Un verificatore indipendente legge metadati Vercel: team/project, ID effettivo, target Preview non ambiguo, SHA del sorgente approvato, URL generato, protezione Radar ALL. Non bastano il nome branch o un campo metadata impostato dallo stesso chiamante: serve provenienza del checkout/artefatto nel processo di build. Dato assente/diverso → STOP, nessuna registrazione.
6. DBA registra la JWK **pubblica** nella runtime_origins immutabile con ID, URL, SHA, issuer/audience, approval e expiry. Vincolo di non riuso e immutabilità già collaudati. Nessuna API di auto-registrazione nel broker.
7. Prova funzionale di possesso dal solo artefatto autorizzato: origine corretta passa; origine sconosciuta, chiave mancante/nuova, replay e un secondo deployment non approvato falliscono. Controllare bundle/artefatti/log senza stampare la privata; la sola regex sul client bundle non dimostra la mancata esposizione al build/provider. **Questa prova remota non è stata eseguita.**
8. Distruggere la copia in memoria del provisioner e chiudere credenziale di consegna della singola esecuzione. Nessun collegamento Production/Shared, nessuna copia automatica a nuovi deploy. Alla fine della finestra revocare l'origine e verificare il diniego di tutte le lease, anche ancora valide.

Le prove locali dimostrano: privata assente → impossibile ottenere lease, chiave diversa su origin noto → diniego, public key non riusabile, registro non modificabile e revoca origine immediata. **Non dimostrano la consegna esclusiva da Vercel.** Il blocco preciso è la mancanza di un canale/provider e di un custode CI approvati che attestino quel requisito; non lo si risolve con altro codice del Radar.

## 5. Quattro operazioni distinte sulle chiavi

| Operazione | Procedura | Revoca/propagazione |
| --- | --- | --- |
| Rinnovo ordinario JWT | SDK rilegge OIDC, PoP nuova, nuovo jti registrato, lease massima 5 min, rinnovo a 60 s, overlap DB massimo 30 s | Nessun redeploy o cambio di privata; ogni RPC verifica stato corrente; errore di rinnovo scarta cache e nega |
| Rollover firma broker | Custode prepara nuova privata distinta; pubblica prima **solo** la pubblica next con kid nuovo accanto alla current; verifica tutti i verifier; poi cambia signer | Supabase documenta fino a 30 min per recepire JWKS. Se fosse coinvolto un progetto separato, aspettare almeno tale finestra **e provare accettazione**, poi mantenere old finché lease/cache non sono scadute. Nel piano scelto il verifier è l'ingresso isolato: reload configurazione/JWKS e probe reali, non un tempo assunto |
| Nuovo deployment PoP | Nuova coppia e nuova origin, nuova approvazione SHA/ID/URL, prova possesso, poi revoca origine precedente | Mai sostituire la pubblica in una origin esistente o ereditare la privata; il solo aggiornamento env non revoca artefatti già distribuiti |
| Emergenza | DBA revoca immediatamente origin/jti, chiude ingresso ristretto e credenziale issuer dedicata se compromessa; rimuove pubblica sospetta e verifica dinieghi | Non attendere rollover, 30 min o scadenza JWT. Se per errore l'issuer fosse fidato globalmente, la revoca origin **non** protegge da token service_role: attivare il piano incidente del gateway/issuer condiviso, non dichiarare sufficiente il registro Radar |

La memoria pubblica current/next/previous è separata dalla chiave attiva: i test pubblicano due JWK senza una privata e rifiutano una JWK privata. Il rollover su un vero verifier gestito è NOT RUN. Nessuna chiave di firma globale Horyzon viene usata o ruotata. OTP cliente, segreto identità HMAC e credenziali staff restano separati: non ruotarli come parte di questa procedura tecnica.

PostgREST autonomo non viene assunto capace di recuperare automaticamente una URL JWKS: l'operatore deve consegnare al verifier il **file pubblico/config** aggiornato, da origin HTTPS fissata e senza redirect, con kid/alg/curve approvati. Aggiornamento atomico e reload config su tutte le repliche; poi prova positiva current/next e negativa della chiave rimossa. Solo a verifica completata si cambia il signer. Il broker non deve poter aggiornare da solo la propria lista di fiducia nel verifier.

## 6. Prove eseguite ed evidenze

Tutte le prove seguenti sono **locali, con dati e chiavi sintetici**. [Risultati riepilogativi](deployment-readiness-5b5-evidence/results.json), [manifest SHA-256](deployment-readiness-5b5-evidence/manifest.json) e [matrice issuer](deployment-readiness-5b5-evidence/issuer-safety-result.json) permettono di distinguere i risultati dalle attività soltanto pianificate.

| Prova | Esito effettivo | Evidenza |
| --- | --- | --- |
| Flusso PostgreSQL 17.6 / PostgREST 16.5, OIDC/PoP, identità, P1, rinnovo e revoca | **PASS**, 19 gruppi del flusso completo; ulteriori assert OIDC inclusi nello stesso gruppo broker | [log nativo](deployment-readiness-5b5-evidence/oidc-native.log) |
| Signer compromesso sintetico | **PASS del test di sicurezza**: riprodotta lettura fuori Radar per authenticated/service_role nell'ingresso ampio; negata in quello ristretto. Il rischio resta un **blocco**, non un PASS architetturale | [8 casi](deployment-readiness-5b5-evidence/issuer-safety-result.json) |
| Concorrenza e separazione dei ruoli | **PASS**, 16 richieste valide/ostili sul pool ristretto; replay concorrente, due processi broker/client e single-flight nel flusso nativo | log nativo e test broker |
| Mancata consegna PoP / broker indisponibile | **PASS**: privata mancante o proof vuota negate; indisponibilità issuer/DB/trasporto, rinnovo fallito e risposta persa non attivano fallback | log nativo, [SDK/factory](deployment-readiness-5b5-evidence/runtime-sdk-tests.log) |
| Broker unit/HTTP/Fetch/lifecycle/metadata | **8 PASS, 0 FAIL**; env non può aprire il veto, startup non carica credenziali, pubblicazione di due JWK solo pubbliche | [broker test](deployment-readiness-5b5-evidence/broker-tests.log) |
| Broker build / typecheck / lint | **PASS**, tutti exit 0 | [build](deployment-readiness-5b5-evidence/broker-build.log), [typecheck](deployment-readiness-5b5-evidence/broker-typecheck.log), [lint senza output](deployment-readiness-5b5-evidence/broker-lint.log) |
| Pacchetto broker | **PASS dry-run**, 11 file consentiti; nessuna env, privata o test | [npm pack dry-run](deployment-readiness-5b5-evidence/broker-package.json) |
| Website regressioni | **19 suite PASS**: Radar/engine, Radar UI/public/Advisor, consolidamento, piano CRM, CV, ledger, CRM, opportunità, persistenza, remote mapping, funnel, patrimonial, leggibilità, preservazione e presentazioni Evento/Architetto | [exit code delle suite](deployment-readiness-5b5-evidence/regressions.json), log individuali nel bundle |
| Website build / typecheck / lint | **PASS**, lint 0 errori e 75 warning | [build](deployment-readiness-5b5-evidence/website-build.log), [typecheck](deployment-readiness-5b5-evidence/website-typecheck.log), [lint](deployment-readiness-5b5-evidence/website-lint.log) |
| Hub | **197 PASS, 0 FAIL**, 918 assert, 26 file | [Hub test](deployment-readiness-5b5-evidence/hub-tests.log) |
| Platform database | **30 PASS**, 7 file, DB loopback dedicato | [database test](deployment-readiness-5b5-evidence/platform-database-tests.log) |
| SQL preesistente | **PASS preservazione**, cinque file identici per hash normalizzato LF al bundle 5B.4; nessuna nuova migration | [hash SQL](deployment-readiness-5b5-evidence/migration-bundle-unchanged.json) |
| Checkout concorrenti | **25/25 invariati** per HEAD, branch, diff, file non tracciati non ignorati e lock rilevati | [preservazione](deployment-readiness-5b5-evidence/preservation-all-result.json) |

Comandi principali: nel servizio broker, npm test, npm run build, npm run typecheck, lint su api/src e npm pack --dry-run --json; nel Website, npm run build/typecheck/lint e gli script indicati dai nomi delle 19 suite. Il test nativo usa scripts/verify-patrimonial-network-clienti.mjs con --network-platform, --pg-module, --operational-preflight, --activation-candidate, --oidc-broker, --issuer-safety-probe, --local-config, --postgrest-binary e --pg-bin. I percorsi devono puntare a strumenti e cluster **loopback dedicati**, mai a servizi reali; il probe aggiuntivo rifiuta URL diversi da quelli sintetici fissati. La local-config con materiale sintetico rimane fuori Git. Non sono stati rimossi assert né cambiati risultati per ottenere PASS.

Due problemi di preparazione sono stati risolti prima dell'esito finale: Turbopack non accettava node_modules tramite junction fuori dalla root, quindi il solo nuovo Website ha ricevuto npm ci offline dal lock, senza script; la suite patrimonial richiedeva il file HTML della build, quindi è stata rieseguita realmente dopo la build riuscita. Il canarino iniziale usava auth.uid senza il grant schema necessario alla fixture: la policy sintetica è stata espressa direttamente sulla stessa claim sub, conservando l'assert di accesso e il confronto dei due ingressi.

Non rieseguiti: build/typecheck/lint completi Hub e monorepo Platform. Hub ha **debito storico aperto** documentato nella 5B.4 (79 errori TypeScript, 348 errori lint e 14 warning); il suo codice è identico e i 197 test attuali non certificano la chiusura di quel debito. Non è stata effettuata verifica browser, non essendoci modifiche UI.

**NOT RUN remoto:** creazione/build Vercel reale, target e routing della Function, discovery HTTPS effettiva, TLS verso DB reale, cold start/carico/costi misurati, Custom OIDC Supabase, consegna esclusiva PoP, rotazione su verifier gestito, email/staff reali e Trusted Sources. Il **FAIL storico ETag mancante su HTML 304 resta aperto**, senza cambio assert, nuova verifica remota o invio ticket. Nessun risultato locale viene presentato come compatibilità già provata con il gateway Supabase.

## 7. Baseline, worktree e commit locali

Le tre baseline indicate sono state verificate negli oggetti Git locali e usate come parent dei nuovi worktree, senza spostare branch o checkout esistenti. Non si assume che siano gli HEAD remoti correnti: non era necessario un fetch o un push per questo lavoro.

| Repository | Baseline verificata | SHA del codice finale |
| --- | --- | --- |
| Website | 85b42c1a59393ce7f0afb638fac9661b58256b67 | c4c94cc331d4835dc4fa6857560fc8bfab4b7710 |
| Platform | c421f88fbff27a1837eee157cfba337f61facc2a | df948883aebd34390b30610760d4fcde14409b94 |
| Hub | 39ff38b82c4a03efb4dd530b0dd47093bae25510 | 39ff38b82c4a03efb4dd530b0dd47093bae25510, invariato |

Branch locale dedicato, distinto in ciascun repository: codex/radar-broker-readiness-5b5. Worktree sotto C:/Users/emanu/.codex/visualizations/2026/10/18/01a14e5a-6067-71a0-a210-f3859cab8329/fase-5b5/{website,platform,hub}. Il presente report e il bundle sono aggiunti da un commit documentale successivo al commit codice Website: il suo SHA è restituito nella consegna, evitando un riferimento autoreferenziale nel file.

[Inventario esatto dei file codice](deployment-readiness-5b5-evidence/code-inventory.json): Website modifica solo la fixture OIDC; Platform modifica 12 file nel servizio broker; Hub nessun file. Nessuna migration, file di prodotto Website/Hub, pin delle sorgenti, schema remoto o regola di assegnazione viene cambiato. La documentazione e i log normalizzati sono l'unica aggiunta Website successiva alla fixture.

Il workspace originale Website conserva anche i **2.772 file non tracciati** rilevati all'inizio. Nessun reset, clean, stash o commit del lavoro concorrente. All'inizio un percorso relativo Git ha collocato il nuovo worktree Website sotto la directory 5B.4: è stato spostato immediatamente con git worktree move al percorso isolato assoluto, rimuovendo solo il contenitore vuoto appena creato. Il confronto finale include la 5B.4 e conferma lo stato originale.

La preservazione riguarda contenuti versionati, diff, file non tracciati non ignorati e lock rilevati; non certifica ogni byte delle cache ignorate. Gli strumenti/dipendenze già presenti sono stati riutilizzati dove appropriato, senza consolidare modifiche altrui. I soli PostgreSQL/PostgREST sintetici avviati dalla 5B.5 sono stati arrestati a fine prova.

## 8. Unico piano di attivazione protetta — non eseguito

Il piano precedente che prevedeva la fiducia Custom OIDC nel Supabase Horyzon condiviso è **superato dal blocco 5B.5**. Il percorso proposto è broker Vercel indipendente + ingresso PostgREST ristretto, con la chiave broker fidata solo da quest'ultimo. Ogni operazione remota seguente richiede nuova autorizzazione esplicita: questa tabella non la concede.

| Ordine e responsabile | Prerequisito e operazione futura | Prova richiesta / arresto |
| --- | --- | --- |
| 1 — Referente Horyzon + responsabile sicurezza + DBA | Approvare il confine SQL ristretto, proprietario operativo, budget, dati sintetici e finestra; confermare che nessun issuer broker sarà registrato nel gateway condiviso | Verbale con ruoli e ACL attesi. Senza decisione infrastrutturale: STOP |
| 2 — DBA + operatore infrastruttura | Definire rete/TLS, login issuer separato e login ingresso membro solo runtime, nessun anon o grant ampio; review delle cinque SQL candidate e delle funzioni PUBLIC prima di qualsiasi applicazione autorizzata | TLS con verifica certificato, membership effettive e matrice firmata sintetica completa sul confine esatto. Non riusare automaticamente il superutente della fixture |
| 3 — Custode CI/segreti + operatore Vercel | Dimostrare il canale PoP esclusivo del §4, provenienza artefatto, non ereditarietà e custodia ES256; approvare issuer HTTPS stabile e origine JWKS fissata | Nessun segreto in argv/log/build/client; accesso soltanto al runtime individuato. Se non dimostrabile: STOP, nessun nuovo livello software sostitutivo |
| 4 — Operatore Vercel, dopo autorizzazione nominativa | Predisporre progetto broker indipendente senza Shared/Git link/Production impliciti; metadati pubblici HTTPS, lease M2M protetta da OIDC+PoP e policy di rete/rate limit approvate | Metadata pubblici non devono richiedere bypass segreti. Non assumere che Vercel Authentication ALL sia compatibile con discovery pubblica; policy broker separata dalla Preview Radar, che conserva ALL |
| 5 — Responsabile codice + reviewer | Collegare soltanto dopo i punti precedenti il broker al login issuer e all'autorità di firma; revisione esplicita del veto source-controlled e del pin Website verso l'ingresso ristretto | Nuovo commit esatto approvato, test locali ripetuti e nessuna chiave globale/static fallback. I commit 5B.5 da soli rimangono inattivi |
| 6 — Operatore deploy + verificatore indipendente + DBA | Solo con autorizzazione specifica, creare gli artefatti approvati, verificare SHA/team/project/deployment/target effettivi; provisioning PoP in memoria, registrare pubblica immutabile e origine a scadenza breve | Se un primo artefatto fosse classificato Production o la provenienza non fosse provata: STOP; nessuna apertura per deduzione dal comando. Nessuna modifica al sito pubblico o cancellazione di artefatti READY implicita |
| 7 — QA sicurezza + DBA | Abilitazione limitata alla sola origine approvata e ai quattro RPC; canarini sintetici, tutte le role ostili, issuer/audience mancanti/diversi, PoP assente/replay, due deployment, concorrenza, outage, revoca e rollover | Tutte le negative negate al confine autorevole; nessun accesso fuori Radar o dati reali. Se compare una membership/grant inattesa: chiudere ingresso e revocare subito |
| 8 — Referente Horyzon | Valutare evidenze operative, latenza/connessioni/costi e custodia; autorizzare eventualmente una prima finestra controllata nominativa | GO separato dal rilascio pubblico. Nessuna attivazione automatica Hub/funnel/CRM/email o Trusted Sources; approvazioni privacy/staff e condizioni del pilot restano autonome |
| 9 — DBA + operatore + referente | A fine finestra o al primo incidente revocare origin/jti, chiudere ingresso e credenziale issuer se necessario; verificare diniego anche delle lease in cache, conservare audit minimo | Ripristinare versione inattiva, senza fallback a vecchi JWT/statiche, senza down migration o cancellazione dei dati di business; nessuna rotazione di chiavi globali Horyzon |

Rollback preparato prima del punto 6: identificare esattamente i nuovi artefatti, credenziali e ingressi da disabilitare; tenere una versione inattiva verificata. La revoca DB/chiusura dell'ingresso precede l'attesa di un redeploy. Una firma sospetta richiede rimozione dal trust del verifier e verifiche su tutte le repliche; non basta cambiare il kid del signer. Arrestare soltanto i componenti nuovi approvati, senza interventi su horyzon.it, Horyzon Website, Hub/Platform operativi o sul primo deployment storico del pilota.

Per un futuro rilascio pubblico restano ulteriormente aperti il contratto HTTP 304/ETag, la compatibilità col main allora corrente, review SEO/accessibilità/privacy e prove con utenti realmente autorizzati. Nessun ticket, invito o pubblicazione è stato inviato in questa fase.

## 9. Decisione finale

**GO alla revisione del pacchetto locale chiuso e della proposta di contenimento. NO-GO alla prima attivazione controllata.**

I due blocchi prioritari sono: **autorità di firma non circoscritta per issuer nel gateway condiviso** (contenimento proposto e provato solo localmente) e **consegna esclusiva PoP per deployment Vercel non dimostrata**. Servono decisione infrastrutturale, custodi/DBA nominati e prove autorizzate sul confine reale; non altre funzionalità Radar o nuove astrazioni generiche.

Stato finale: nessun progetto, deploy, push, merge, migration, grant reale, segreto reale, email, Trusted Sources o cambiamento alla produzione. Non è stato configurato alcun issuer reale. Il veto resta chiuso e la fase termina con questa consegna.
