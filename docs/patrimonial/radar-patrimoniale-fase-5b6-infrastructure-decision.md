# Radar Patrimoniale — decisione infrastrutturale e fattibilità, 5B.6

26 ottobre 2026. **Configurazione raccomandata: opzione 2, broker e ingresso PostgREST come servizi distinti in un ambiente Linux/container dedicato. NO-GO all'attivazione.** L'ingresso è stato verificato nativamente con la configurazione candidata; non sono stati installati container o servizi remoti. La consegna PoP esclusiva su Vercel rimane non dimostrata.

Questa è una decisione operativa proposta al referente, con file e prove riproducibili. Non autorizza provisioning, modifiche al database condiviso o un cambiamento di hosting del Radar. La soluzione container alternativa richiede anche una diversa identità del workload cliente: spostare soltanto broker/PostgREST non risolve la PoP del Radar che resta su Vercel.

## 1. Baseline e preservazione

| Repository | Baseline verificata localmente | Commit codice 5B.6 |
| --- | --- | --- |
| Website | b5b159a608bb563b08004f89b783f7112d8c962d | 6485782152b56e43a6825a291c021d087919a938 |
| Platform | df948883aebd34390b30610760d4fcde14409b94 | 1613c6195ed80cfd3b769096a9671ba2dcc4deff |
| Hub | 39ff38b82c4a03efb4dd530b0dd47093bae25510 | invariato |

Nuovi worktree website/platform/hub sotto C:/Users/emanu/.codex/visualizations/2026/10/18/01a14e5a-6067-71a0-a210-f3859cab8329/fase-5b6, branch locale codex/radar-infrastructure-decision-5b6 in ciascun repository. Nessun fetch/push: le baseline sono oggetti Git verificati, non un'attestazione degli HEAD remoti correnti.

Letti AGENTS.md e DESIGN.md Website, istruzioni Hub, rapporto 5B.5 e contratti broker/SQL/test. Nessun processo Git attivo rilevato al preflight; preservati i lock già presenti. [Confronto dei 28 checkout preesistenti](infrastructure-decision-5b6-evidence/preservation-all-result.json): HEAD, branch, diff, file non tracciati non ignorati e lock invariati. Il Website originale conserva i 2.772 file non tracciati rilevati. Le cache ignorate non sono certificate byte per byte; nei soli nuovi worktree sono state collegate dipendenze già presenti.

Nessuna modifica a migration o test preesistenti Platform/Hub. I [cinque hash SQL](infrastructure-decision-5b6-evidence/migration-bundle-unchanged.json) coincidono con 5B.5. Website aggiunge quattro righe alla fixture per esercitare il nuovo probe facoltativo, conservando gli assert precedenti. Non cambia codice di prodotto, UI, questionario, pin della sorgente, assegnazioni o flag. Il commit documentale successivo, contenente questo report e le evidenze, è identificato nella consegna finale per evitare autoreferenze.

## 2. A — configurazione minima dell'ingresso

Gli asset autoritativi sono in Platform, services/radar-credential-broker/infra/5b6, al commit indicato sopra. I link seguenti sono risolvibili nel layout locale dei tre worktree fratelli:

| Asset | Funzione e stato |
| --- | --- |
| [postgrest.conf.in](../../../platform/services/radar-credential-broker/infra/5b6/postgrest.conf.in) | Configurazione PostgREST 16.5 realmente usata dal probe locale dopo sostituzione dei percorsi e delle sole porte/bind loopback |
| [login-contract.json](../../../platform/services/radar-credential-broker/infra/5b6/login-contract.json) | Attributi, membership, quattro firme RPC e separazione dei login; nessun login reale creato |
| [pre-request.sql.in](../../../platform/services/radar-credential-broker/infra/5b6/pre-request.sql.in) | Guard INVOKER da sottoporre al DBA, applicato soltanto al cluster sintetico; **non è una migration** |
| [audit-logins.sql](../../../platform/services/radar-credential-broker/infra/5b6/audit-logins.sql) | Query di sola lettura per futura verifica ACL/membership/overload sul target autorizzato |
| [nginx.conf](../../../platform/services/radar-credential-broker/infra/5b6/nginx.conf) | TLS, metodi/path esatti, limiti e assenza di retry delle scritture; non avviato |
| [compose.candidate.yaml](../../../platform/services/radar-credential-broker/infra/5b6/compose.candidate.yaml) | Manifest candidato a tre servizi, profilo esplicito, digest obbligatori, niente build/pull; validato dal parser Compose |
| [README operativo](../../../platform/services/radar-credential-broker/infra/5b6/README.md) | Rendering, input runtime, rete, custodia, limiti e rollback |

### Confine SQL e quattro RPC

Collegamento futuro **allo stesso database Horyzon**, attraverso una connessione diretta PostgreSQL TLS e un login nuovo radar_ingress_login: LOGIN, NOINHERIT, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE, NOREPLICATION, limite connessioni 6. Membership unica patrimonial_radar_runtime con INHERIT FALSE, SET TRUE, ADMIN FALSE. Verificare anche la chiusura transitiva del ruolo runtime: il nome della membership immediata non basta.

Login broker diverso, radar_broker_login, solo patrimonial_radar_issuer, senza amministrazione né tabelle. La membership issuer ha INHERIT TRUE e SET FALSE, coerentemente con l'attestazione del broker storico e le due funzioni private broker_origin(uuid)/broker_register(jsonb). Nessuno dei due login riceve authenticated, service_role, postgres, authenticator o ruoli Platform. Nessun segreto/grant del gateway Supabase viene riutilizzato.

L'ingresso espone soltanto POST su:

- /rpc/patrimonial_radar_runtime_health — firma SQL ().
- /rpc/patrimonial_radar_runtime_command — (jsonb).
- /rpc/patrimonial_radar_runtime_foundation — (jsonb).
- /rpc/patrimonial_radar_runtime_event — **(jsonb,jsonb)**, parametri p_request e p_consents.

Sono le funzioni storiche: conservano runtime_allowed, registro jti/origin, revoche, sessioni cliente/staff, controlli P1 e audit. Nessun dato viene copiato in un secondo dominio finanziario. Non viene introdotta un'API SQL arbitraria.

Il proxy applica path esatti, POST, niente query/CORS, body massimo 64 KiB e nessun retry upstream. Il guard PostgREST, indipendente dal proxy, rifiuta altri path/metodi/schema, issuer diverso e audience mancante/null/array/diversa. Questo chiude anche gli accessor di contesto PUBLIC già esistenti, senza revocarli globalmente nel DB condiviso. Guard INVOKER, owner non-login non amministrativo, nessuna nuova autorità sui dati. Sono necessarie review di owner/overload e delle funzioni PUBLIC/extension: nessun grant globale viene proposto come scorciatoia.

La sola chiave ES256 compromessa può firmare un token service_role, ma il login dell'ingresso non può assumere quel ruolo. Il [probe nativo](infrastructure-decision-5b6-evidence/ingress-result.json) lo verifica fuori dal codice del broker. **Non registrare questa chiave come Custom OIDC nel Supabase condiviso**: quel percorso non offre qui un tetto autorevole per issuer, come già documentato nella 5B.5. Nessuna prova di exploit del gateway Supabase reale è stata eseguita.

### JWT, TLS, pool e rete

JWKS pubblico locale al verifier, solo EC P-256, alg ES256, use sig, kid unici approvati; nessuna privata o chiave HS globale. L'operatore valida il file prima di pubblicarlo: il signer non controlla la fiducia del verifier. JWT cache disabilitata nella prova; db-config e canale di configurazione DB disabilitati, anon/OpenAPI/plan disabilitati. Il guard fissa issuer, audience stringa authenticated, exp/iat e durata massima 300 secondi. [PostgREST documenta](https://docs.postgrest.org/en/stable/references/auth.html) che jwt-aud da solo ammette audience omessa: il guard aggiuntivo è necessario.

DSN in file runtime, senza password negli argomenti: host esatto approvato, sslmode=verify-full, CA montata e connect_timeout=5. [libpq verify-full](https://www.postgresql.org/docs/17/libpq-ssl.html) verifica catena e hostname. Collegamento diretto IPv6 da verificare; un eventuale session pooler richiede una decisione e una prova distinta per i login personalizzati. Non usare postgres o transaction pooling come fallback. [Supabase descrive](https://supabase.com/docs/guides/database/connecting-to-postgres) le diverse modalità di connessione; qui nessuna è stata provata sul database remoto.

Pool ingresso 4, acquisizione 2 s, idle 30 s, lifetime 300 s; broker pool 4 invariato. Budget pilota massimo 12 connessioni fra i due login, inclusa riserva; una replica ciascuno, niente autoscale. DBA dovrà fissare timeout query 5 s e lock 2 s e misurare saturazione/recovery. Questi sono limiti proposti, non benchmark o SLA. [PostgREST usa transazioni per richiesta e pool limitati](https://docs.postgrest.org/en/stable/references/connection_pool.html).

Edge TLS 1.2/1.3 su 8443, host esposto solo in loopback 18443; accesso remoto della prova tramite tunnel amministrativo autenticato approvato. Admin/metrics 3001 non pubblicato. Il nome di una rete Docker non impone ACL di uscita: firewall host/egress da approvare per soli DB, DNS e JWKS OIDC del broker. Nessun docker socket/PID condiviso, privilegi, cap aggiuntive o filesystem scrivibile indiscriminato.

Il manifest mantiene **il broker privo di signer e DSN**: il veto sorgente della 5B.5 non cambia e il processo si arresta prima di leggere credenziali. Non è un deployment già funzionante del broker. Discovery/JWKS pubblici HTTPS, ingresso lease M2M e metriche sanitizzate dovranno essere configurati dopo le approvazioni; non si presume che Authentication ALL consenta discovery pubblica. La Preview Radar esistente conserva le sue protezioni.

## 3. B — fattibilità PoP su Vercel

**Esito documentale: nessuna procedura pubblica verificata soddisfa oggi tutti i vincoli; NO-GO al provisioning reale.** Questo non dimostra l'impossibilità assoluta della piattaforma.

| Canale documentato | Cosa offre | Perché non basta |
| --- | --- | --- |
| [CLI --env / --build-env](https://vercel.com/docs/cli/deploy) | Distinzione runtime/build | Un esempio KEY=PRIVATE espone argv; la sola distinzione non prova custodia ed esclusività |
| [Secret/Config di progetto](https://github.com/vercel/vercel-plugin/blob/main/commands/env.md) | Scope ambiente/branch, Secret non rileggibile | Entrambi arrivano a build e runtime; branch/progetto non identifica un solo deployment |
| [Function environment nel Build Output](https://vercel.com/docs/build-output-api/primitives) | Variabili addizionali della Function | Il valore è in .vc-config.json, parte dell'artefatto: non soddisfa il vincolo di esclusione della privata dagli artefatti |
| [OpenAPI pubblico Vercel](https://vercel.com/openapi.json) | Contratto createDeployment POST /v13/deployments | Nel contratto letto non sono esposti env o build.env: non si inventa un campo REST dal comportamento interno CLI |
| [OIDC Vercel](https://vercel.com/docs/oidc/reference) | Identità team/progetto/ambiente | Non prova possesso esclusivo per artefatto; una env deploymentId dichiarata dal chiamante non sostituisce la PoP |

Lo [schema estratto con hash della fonte](infrastructure-decision-5b6-evidence/vercel-openapi-summary.json) registra i campi effettivamente letti. Il changelog Supabase è stato consultato: avvisi TLS/CBC e PostgreSQL 17.11 restano da considerare per l'ambiente reale; nessuna patch o configurazione è stata applicata.

Preparati [piano dettagliato A/B](../../../platform/services/radar-credential-broker/infra/5b6/vercel-pop-proof-plan.md) e [fixture autonoma](../../../platform/services/radar-credential-broker/infra/5b6/vercel-pop-probe/package.json). La fixture non usa Radar, DB, email, account cliente o raccolta economica: il build registra solo presenza/assenza e fallisce se vede POP_PROBE_JWK; il runtime firma un challenge pubblico con una chiave **sintetica**, senza restituirla. Il reviewer verifica la firma con la pubblica. Nessuna chiave è stata generata o consegnata da questa fixture e nessun progetto è stato collegato.

La futura prova separa A autorizzato, B dello stesso progetto senza consegna, build A/B, browser/statici, artefatti, log e redeploy/ereditarietà. Solo dopo un canale supportato documentato si potrà consegnare una privata sintetica da memoria/input protetto, mai argv, project Secret o .vc-config. In assenza di tale contratto, **STOP prima della chiave**, non un esperimento con una credenziale reale. La prova di revoca usa un broker/DB separato interamente sintetico, senza fiducia nel Supabase Horyzon.

Matrice richiesta: build A/B privata assente; runtime A firma, B non può firmare come A; nessuna privata in argv/log/client/artefatti; origine revocata nega nuove lease e cache; riavvio non ripristina accesso. Log booleani dell'app non dimostrano da soli la custodia del control plane: occorre anche la garanzia del provider. Chiarimento/ticket Vercel preparabile dal referente, **non inviato**. Nessun invito, bypass o modifica Authentication.

## 4. C — scelta unica, alternativa PoP e costo completo

| Aspetto | 1 — broker Vercel + ingresso container | 2 — broker e ingresso nello stesso ambiente container dedicato |
| --- | --- | --- |
| Confinamento SQL | Buono con login distinto; rete fra due ambienti | Stesso confine SQL; separati processi/login/chiavi e verifier |
| Custodia signer e pool | Custodia Vercel da provare, istanze/pool variabili | Mount runtime, processi e connessioni controllati dall'operatore |
| PoP del Radar Vercel | Rimane bloccata | **Rimane bloccata se il cliente resta Vercel**; possibile prova alternativa con workload Linux esclusivo |
| Operazioni | Due control plane, incidenti egress e responsabilità incrociate | Un ambiente operativo; più patching del broker a carico Horyzon |
| Recovery | Coordinate deploy/config fra provider e container | Immagini/config firmate e revoca centralizzata, nessun fallback |
| Limite comune | Nessuna esclusività contro amministratori fidati/provider compromessi | Root/gestore container resta un confine fidato; kernel/host condiviso è un rischio esplicito |

**Raccomando soltanto l'opzione 2 per la prossima prova infrastrutturale.** Un host Linux dedicato al pilota, tre servizi separati (edge, PostgREST 16.5, broker Node 24), immagini approvate per digest, nessun dato cliente sul filesystem, nessun accesso amministrativo condiviso con Website/Hub. Il manifest attuale è chiuso: abilitarlo non abilita il signer.

Alternativa concreta alla consegna Vercel: un **workload cliente sintetico distinto per deployment**, con unit UUID e immagine immutabili, utente/mount dedicati; nuova chiave PoP e credenziale d'identità mTLS consegnate soltanto al runtime con LoadCredentialEncrypted, mai a build/image/env. [Template unit](../../../platform/services/radar-credential-broker/infra/5b6/workload-proof.service.in) e [semantica systemd](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html#LoadCredential=). Solo pubblica/thumbprint e attestazione unit/immagine entrano nel registro immutabile; secondo workload non monta la credenziale. Nessun riuso automatico dopo restart/redeploy senza la registrazione approvata; revoca DB prevale anche se la vecchia privata sopravvive.

**Compatibilità non implicita:** il broker attuale accetta identità OIDC del progetto Vercel e il client/SQL hanno pin e identificatori Vercel. Una unit Linux non può fingersi quel deployment. Per un vero client container servono approvazione del contratto d'identità (certificato mTLS specifico + registrazione immutabile), verifica del formato degli identificatori, adapter di trust/file-loading e pin dell'ingresso. Queste modifiche circoscritte **non sono implementate né autorizzate all'attivazione** nella 5B.6. Non viene costruito un nuovo identity provider, un proxy generale o un backend di business. La prima prova remota alternativa deve essere un harness sintetico, non lo spostamento del Radar operativo.

[Docker Compose consegna secret come mount per servizio](https://docs.docker.com/compose/how-tos/use-secrets/), non come vault cifrato né barriera contro root. Nel template unit servono verifica Linux/systemd/Podman, UID mapping e storage rootless; nel manifest Compose servono permessi dei file reali verificati. Materiale temporaneo su memoria protetta, niente dump/swap/backup in chiaro, nessuna directory segreti condivisa. ES256 broker, login issuer, login ingresso, TLS edge, identità cliente e PoP hanno custodi/mount distinti. Nessuna privata del broker nel verifier.

### Budget proposto, non preventivo di un fornitore

Ipotesi pilota: una VM dedicata indicativamente 2 vCPU/4 GiB, traffico modesto, nessuna HA o reperibilità 24/7. Nessun fornitore è stato selezionato, fatturato o contrattualizzato. Le seguenti cifre sono **assunzioni di budget da far quotare**, non prezzi di catalogo verificati:

| Voce mensile opzione 2 | Intervallo EUR |
| --- | --- |
| Host/volume/rete di base | 30–60 |
| Backup cifrato di sola configurazione e manifest | 5–10 |
| Monitoraggio minimo/egress/retention tecnica | 10–20 |
| Riserva recovery e custodia | 5–10 |
| Totale infrastruttura stimato | **50–100** |
| Gestione, patch, accessi, rotazione e prova recovery: 4–6 h a 70 EUR/h assunti | **280–420** |
| Totale operativo mensile stimato | **330–520 EUR**, IVA e interventi straordinari esclusi |

Preparazione iniziale da stimare separatamente: 16–24 h a 70 EUR/h assunti = 1.120–1.680 EUR, oltre a eventuali adattamenti del contratto cliente. Il costo DB Horyzon già esistente non è conteggiato come nuova sottoscrizione: capacità/pooling, backup/PITR, incident response, certificati/secret manager commerciali e SLA aggiuntivi richiedono verifica e possono aumentare il totale. Non si assume che siano gratuiti.

Per l'opzione 1 servirebbero comunque host/operazioni dell'ingresso, più coordinamento e fatturazione Vercel. [Pro elenca 20 USD/mese e credito incluso](https://vercel.com/docs/plans/pro-plan); [Functions ha costi di CPU/memoria/invocazioni](https://vercel.com/docs/functions/usage-and-pricing). Piano Horyzon, costo marginale e cambi EUR/USD non verificati; un progetto aggiuntivo non implica una nuova subscription. Non viene inventato un totale comparabile in euro o promessa di risparmio.

Disponibilità scelta per il pilota: singolo host, **SPOF dichiarato**, fail-closed se broker/DB indisponibili, nessun rinnovo statico. Obiettivo recovery da approvare/provare: RTO 4 h; RPO del business dipende dal DB condiviso esistente e non è certificato qui. Config/versioni recuperabili dai commit, chiavi da custodia cifrata oppure nuova origin/chiave con revoca della precedente. Un secondo host/HA richiede altro budget; non è simulato dal semplice restart di Compose.

## 5. D — prove effettive e criteri di accettazione

[Risultati](infrastructure-decision-5b6-evidence/results.json), [log nativo](infrastructure-decision-5b6-evidence/native-tests.log), [matrice ingresso](infrastructure-decision-5b6-evidence/ingress-result.json), [manifest delle evidenze con hash LF](infrastructure-decision-5b6-evidence/manifest.json).

| Criterio | Prova locale effettiva | Da provare sul futuro ambiente reale |
| --- | --- | --- |
| Diniego ruoli non autorizzati | **PASS**: authenticated/service_role/postgres/Platform/issuer/sconosciuto/omesso negati dall'ingresso configurato | Membership/ACL reali e ripetizione matrice sul target approvato |
| Signer senza accesso oltre Radar tramite ingresso | **PASS**: token ostili firmati sinteticamente, tabelle/altre RPC/PUBLIC helper/schema negati; HS256, alg none, kid errato e chiave diversa con kid legittimo negati | Config JWKS/algoritmi, audit di overload, owner e grant PUBLIC reali |
| Login SQL separati | **PASS**: membership e opzioni SET/INHERIT/ADMIN esatte, niente admin/table access, issuer RPC solo al login broker | Login reali, TLS, limiti e capacità della connessione Supabase effettiva |
| Quattro RPC e P1 | **PASS**: health valida e tre contratti invalidi raggiungono solo le rispettive RPC; flusso storico completo P1/rinnovo/audit preservato | Intero flusso end-to-end anche attraverso edge TLS e ingresso reale |
| Concorrenza | **PASS**: 32 richieste miste senza contaminare ruoli/claim | Saturazione, latenza, connessioni e recovery sotto carico; nessuna SLA locale |
| Revoca | **PASS** jti sull'ingresso dedicato, origin/cache e rinnovo nel flusso nativo; lease non registrata negata | Revoca su tutte le repliche, riavvio, reload JWKS e login/sessioni reali |
| Custodia e PoP per deployment | Mancanza privata/fallback già negate dai test attuali; **esclusività infrastrutturale NON PROVATA** | A/B Vercel o workload Linux, mount, build/artefatti/log e controllo del provider |
| Rollback senza dati cliente | Procedura preparata, nessuna down migration; test solo su dati sintetici | Esercitazione revoca/isolamento/restore e verifica dell'audit |

Esiti ripetuti nella 5B.6: **19 gruppi nativi PASS**, inclusi i precedenti OIDC/PoP, outage/rinnovo/revoca e la matrice 5B.5, più **11 casi del nuovo probe**; **8 test broker PASS**; build/typecheck broker PASS; verifica SDK/factory/lock PASS; preservazione Radar v4/35 foto/engine PASS; parser Compose e nove controlli strutturali PASS; pack dry-run 11 file, senza infra/test/env/chiavi. I file JavaScript del probe Vercel hanno superato node --check; l'app probe remota è **PREPARATA, NON ESEGUITA**.

Il primo test HTTP broker in sandbox ha incontrato EACCES sul socket loopback: è stato ripetuto realmente con il permesso locale appropriato, ottenendo 8/8 PASS senza cambiare assert. Nessun controllo è stato rimosso per ottenere PASS.

**NOT RUN:** avvio container, nginx -t nel container, TLS ingress/DB reali, mount e systemd Linux, gestione di chiavi reali, prova Vercel, gateway Supabase, consegna esclusiva, carico remoto e rollback operativo. Docker CLI/Compose sono disponibili ma il motore Linux non era in esecuzione: non è stato avviato o installato. Il test PostgREST è nativo Windows su loopback, non un test container.

Non ripetuti build/lint/typecheck completi Website/Hub/monorepo Platform o browser: nessun codice prodotto è cambiato. Restano gli esiti e il debito storico 5B.5, incluso **ETag HTML 304 FAIL aperto** e debito Hub; non diventano PASS per effetto dei test infrastrutturali. Tutti i servizi sintetici locali della 5B.6 sono stati arrestati.

## 6. E — responsabilità e singole autorizzazioni future

Nessuna operazione della tabella è stata eseguita. Richiedere autorizzazioni **distinte con destinazione, budget, scadenza, proprietario e teardown**, senza usare questa pianificazione come consenso.

| Operazione da autorizzare | Responsabile | Limite e prova necessaria |
| --- | --- | --- |
| 1. Accettare opzione 2, budget, custodi e finestra | Referente Horyzon | Verbale nominativo; nessun rilascio o spostamento del Radar implicito |
| 2. Provisionare un ambiente di prova isolato | Operatore infrastruttura + sicurezza | Host/container e DB **sintetico separato**; nessuna connessione al DB Horyzon, produzione o dati cliente |
| 3. Approvare immagini/digest, rete e accesso remoto | Operatore + reviewer | Versioni patch, non-root, niente socket, firewall, tunnel/MFA, admin privato; niente DNS pubblico Horyzon |
| 4. Generare sole credenziali sintetiche e applicare lo schema fixture alla sola DB di prova | DBA + custode chiavi | Due login distinti, CA/TLS e ES256/PoP inventati, percorso protetto; nessun grant/migration reale |
| 5. Eseguire prova container/mount/SQL/JWKS | QA sicurezza + DBA | Tutta la matrice negativa, quattro RPC, concorrenza, rimozione key/reload, timeout e revoca. Registrare NOT RUN se manca un livello |
| 6. Eseguire prova workload esclusivo Linux | Operatore + reviewer indipendente | Due unit/immagini distinte, chiave solo runtime A, niente build/B/log/artefatti; mTLS sintetico, revoca persistente, nessun adapter attivato nel prodotto |
| 7. Eventuale indagine Vercel A/B separata | Referente + operatore Vercel | Chiarimento del contratto prima delle chiavi; progetto vuoto isolato, esatti A/B e target verificati, Authentication attiva. Senza canale supportato: STOP; nessun tentativo ripetuto per deduzione |
| 8. Provare rollback e chiudere la finestra | Operatore + DBA | Revocare origine/jti, bloccare ingresso, invalidare solo login dedicati e terminare solo loro sessioni; dati/audit sintetici conservati, nessun dato cliente toccato |
| 9. Valutare evidenze e decidere un eventuale futuro collegamento Horyzon | Referente + sicurezza + DBA | **Nuova autorizzazione**, prima sole letture ACL/network; eventuali login/guard/grant/adapter/migration da approvare separatamente. Non inclusi nella prima prova sintetica |

Monitoraggio da approvare: stato /ready e /live, contatori esiti/latenza/pool, scadenze e revoche; nessun header, body, DSN, JWT, PoP, cookie o parametro SQL. logging:none nei manifest è un default chiuso della prova, non un sistema di osservabilità per la produzione. Audit operativo minimo opaco da conservare nella DB, collector sanitizzato prima dell'apertura. Nessun Analytics, toolbar o nuovo servizio di raccolta installato.

Rollback operativo: revocare origin/jti prima di attendere redeploy; chiudere solo edge/ingresso nuovi, fermare broker e togliere la chiave sospetta dal verifier. NOLOGIN non chiude connessioni esistenti: DBA deve terminare soltanto le sessioni dei due login nuovi. Ripristinare immagine/config chiuse, mai JWT statici o una vecchia origin revocata. Non cancellare tabelle, schemi, storico o dati cliente; non toccare gateway condiviso, chiavi globali, main, domini e deployment precedenti.

## 7. Decisione conclusiva

La barriera PostgreSQL è **fattibile e verificata nel modello nativo locale**. La configurazione raccomandata e gli asset della prova sono concreti; la sua installazione rimane da autorizzare. La PoP Vercel non ha ancora una consegna esclusiva dimostrabile. L'alternativa Linux ha un meccanismo operativo specifico, ma custodia/mount/identità e compatibilità del cliente devono superare una prova dedicata.

**NO-GO alla prima attivazione controllata e a qualsiasi collegamento al database Horyzon.** Il prossimo passo autorizzabile è soltanto la prova remota sintetica dell'opzione 2, con i responsabili e le operazioni sopra elencati. Non servono nuove funzionalità Radar, Hub, Funnel, Advisor o HighLevel per prendere questa decisione.

Nessun progetto remoto, deployment, segreto reale, migration/grant reale, push, merge, Trusted Sources, email o modifica di produzione effettuati. Nessun issuer reale configurato. La fase termina qui con documentazione, configurazioni chiuse, test ed eventuali commit esclusivamente locali.
