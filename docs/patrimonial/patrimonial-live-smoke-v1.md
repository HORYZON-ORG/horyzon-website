# Patrimonial live synthetic smoke — FASE 2B.2B-4D

Preparato il 15 ottobre 2026 sulla baseline `c61ed43d1a1811069cbf0ecc6c21498bea76c03d`, branch `feat/patrimonial-pilot-funnels`. **LIVE_NOT_EXECUTED**: questa consegna prepara l'harness e verifica solo moduli importabili con trasporti fake. Nessuna esecuzione di `run-patrimonial-live-smoke.mjs`, neppure dry-run; nessuna chiamata remota, modifica env reale, migration, push, deploy o merge. `tmp/` preesistente completamente intatta.

**Fix dry-run sulla baseline `74557d400d109b7c67144ea3b5d1a85e68a9f299`:** il precedente ritorno anticipato NOT_RUN è sostituito da un pre-flight locale reale. L'affermazione sopra sulla mancata esecuzione descrive la consegna 4D originaria; il fix prevede una successiva invocazione esclusivamente `--dry-run`, con report nuovi e senza toccare quelli preesistenti. Nessuna attivazione live o nuova validazione remota.

## 1. Entry point e modalità

[run-patrimonial-live-smoke.mjs](../../scripts/run-patrimonial-live-smoke.mjs) è un comando CLI separato dal sito. Senza argomenti seleziona `--dry-run`: verifica configurazioni, mapping, guardie sintetiche, binding e percorso report. Esito `DRY_RUN_PASS` oppure `BLOCKED` con nomi esatti mancanti/non validi; mai PASS di un test live. Non costruisce il runtime live e non chiama health/RPC/HTTP. L'oggetto store viene soltanto costruito localmente con un trasporto vietato, per validare URL e service key.

Le seguenti sono istruzioni per una **futura esecuzione autorizzata**, non comandi eseguiti in 4D:

```text
npm run smoke:patrimonial -- --dry-run
npm run smoke:patrimonial -- --execute --confirm-live-write --bindings <modulo-server-verificato.mjs>
npm run smoke:patrimonial -- --verify --report tmp/patrimonial-live-smoke-<timestamp>.json --bindings <modulo-server-verificato.mjs>
npm run smoke:patrimonial -- --cleanup --confirm-live-write --report tmp/patrimonial-live-smoke-<timestamp>.json --bindings <modulo-server-verificato.mjs>
npm run smoke:patrimonial -- --simulate-provider-failure
```

Scegliere una sola modalità. Verify richiede un report di esecuzione completata e non dispatcha write CRM. Cleanup è separato, mai implicito in execute. Failure injection è ammessa solo nel percorso locale dry-run: insieme a execute/verify/cleanup viene rifiutata prima di costruire i trasporti. Non viene caricato automaticamente alcun `.env` o `.env.local`.

## 2. Gate

Prima di costruire i trasporti live devono essere letteralmente `true`: `PATRIMONIAL_SYNTHETIC_TEST_ENABLED`, `PATRIMONIAL_V2_ENABLED`, `PATRIMONIAL_CRM_WRITE_ENABLED`, `PATRIMONIAL_OPPORTUNITY_WRITE_ENABLED`. Execute e cleanup richiedono inoltre `--confirm-live-write`. Questi gate valgono anche per le letture remote di verify, esclusa la conferma di write. Booking/messages/webhook devono restare disabilitati.

Il mapping centrale deve validarsi; `PATRIMONIAL_DURABLE_STORE_READY=true`, URL Supabase e service role dello stesso progetto sono prerequisiti server. La health dello store viene chiamata prima dell'acquisizione o di qualsiasi lettura/write HighLevel; errore/versione incompatibile impediscono il test. I gate vengono ricontrollati prima di ogni trasporto e mutazione. Credenziali, valori env, risposte grezze ed errori provider non vengono stampati.

Questi requisiti di abilitazione e health riguardano i percorsi live. In dry-run i flag assenti/vuoti restano false per default, e false è una configurazione valida: non vengono accesi per superare il pre-flight. Sono rifiutati valori diversi da true/false e l'abilitazione di booking/messages/webhook. Il report indica separatamente `liveGuardsEnabled`; `storeReady` riguarda soltanto la configurazione locale costruibile (`storeReadinessScope=LOCAL_CONFIG_ONLY`, `storeHealthChecked=false`). Non attesta credenziali funzionanti, progetto raggiungibile o schema installato.

Default di tutti e sette i flag funzionali: **false**. È aggiunta solo la voce `PATRIMONIAL_SYNTHETIC_TEST_ENABLED=false` a `.env.example`; i sei flag precedenti e il gate store non sono modificati. La configurazione produzione non è stata letta né cambiata.

## 3. Binding necessari prima del primo live

Il report delle risorse verifica ID, non endpoint, payload, paginazione, create-only, delete o side effect. L'[adapter reale del harness](../../scripts/lib/patrimonial-live-smoke-runtime.mjs) usa il provider contatti configurato e lo store Supabase esistenti; aggiunge un trasporto opportunity esclusivamente per questa CLI. Il provider opportunity dell'applicazione rimane uno stub. Non viene inventato un binding o un lost reason per superare i suoi gate.

Un modulo server attendibile passato con `--bindings` deve esportare `bindings` con questo contratto:

| Proprietà | Contratto da verificare sul target prima dell'uso |
| --- | --- |
| `verified`, `sideEffectsReviewed` | Entrambi `true`; audit delle automazioni esterne e degli invii impliciti completato dall'operatore |
| `locationId` | ID reale della location autorizzata, uguale a HIGHLEVEL_LOCATION_ID; non inventato né derivato dai nomi |
| `contacts.bindings` | Tipo `PatrimonialHighLevelBindings` del provider esistente: email/phone search complete e paginate, contact get, create verificato con `createOnly=true`; il provider applicativo resta create-only |
| `contacts.upsert` | Solo CLI, opt-in ufficiale `real`: HTTP binding verificato per POST `/contacts/upsert`; esito CREATED oppure REUSED_UPDATED, senza attribuire ownership al riuso |
| `contacts.capabilities` | contactsRead/contactsWrite/tagsWrite/notesWrite verificati; notesRead solo se esiste noteLookup verificato, altrimenti UNKNOWN/false |
| `tags` | `{verified:true, request(locationId), decode(body)}`: GET catalogo completo sotto `/locations/`; risultato `{complete:true,tags:[{id,name,locationId}]}` |
| `opportunities.verified` | `true` solo dopo verifica di schema, scope, ricerca completa e create |
| `opportunities.search` | Binding verificato request(query)/decode(body); normalizza in `{complete:true,opportunities:[...]}` e completa tutte le pagine; query location/contact/pipeline |
| `opportunities.get` | Binding verificato request(id)/decode(body); una sola opportunity normalizzata; 404 significa assenza solo nell'endpoint specifico verificato |
| `opportunities.create` | Binding verificato request(input)/decode(body); conserva gli ID dei custom field, nessuna dipendenza dai fieldKey generati |
| `opportunities.delete` | Opzionale, binding verificato request(id)/decode(body); DELETE solo dell'ID sintetico provato |
| `contactDelete` | Opzionale, binding verificato request(id)/decode(body); DELETE solo del contatto provato |
| `contactOpportunities` | Opzionale ma necessario per cancellare il contatto: request(contactId,locationId)/decode(body), `{complete:true,opportunities:[]}` su **tutte** le pipeline; impedisce di cancellare relazioni ulteriori |

I nuovi binding HTTP condividono `{verified:true, request(...args):{method,path,body?}, decode(body)}`. L'origine HighLevel è quella esistente, redirect vietati, timeout 10 secondi, no-store, nessun retry automatico. Opportunity read/search/create sono confinati a `/opportunities/`; i DELETE devono puntare all'ID specifico. Tag/contact rispettano i confini del provider precedente. Le ricerche devono restituire una pagina finale completa; non certificare una pagina parziale come completa. Una opportunity normalizzata contiene `id`, `version` effettiva, `locationId`, `contactId`, `pipelineId`, `pipelineStageId`, `status`, `customFields` come record ID → valore. Un contatto normalizzato conserva anche firstName/lastName/email/phone/tags/locationId. Le note usano il binding e marker già esistenti.

Il modulo non va collocato in `tmp/`: i report sono dati, mai sorgenti eseguibili. I binding personalizzati nel dry-run sono soltanto analizzati staticamente. Il binding ufficiale `real`, descritto sotto, è codice locale revisionato con un pre-flight remoto di sola lettura; il PASS non certifica permessi di scrittura che possono essere provati soltanto dal live autorizzato.

Nel dry-run il percorso `--bindings` viene letto come testo e analizzato staticamente dal [pre-flight](../../scripts/lib/patrimonial-live-smoke-preflight.mjs). È ammesso un solo `export const bindings = {...}` dichiarativo, con oggetti annidati, stringhe/booleani, arrow/function expression e riferimento `process.env.HIGHLEVEL_LOCATION_ID`. Si verificano marker verified, audit dichiarato, corrispondenza location, capability e presenza delle funzioni request/decode richieste. Le funzioni non sono chiamate. Import, helper, getter, spread e codice top-level non analizzabile producono un blocker specifico; nessun fallback a import/eval. L'esistenza o la forma dei binding non certifica endpoint o risposte reali. Modulo assente → `--bindings missing`.

## 4. Dati e acquisizione

Una nuova run v2 genera UUID v4 distinti per run/request/effetti; email `patrimonial-test+<runId>@example.invalid` (local-part di 53 byte), nome Horyzon, cognome Synthetic Test, provincia TEST, nessun telefono. I report v1 conservano esattamente l'identità precedente con timestamp (67 byte), leggibile per audit ma rifiutata da nuove write. Nessun report o dato esistente viene migrato. Solo ARCHITECT_PATH/A01/open; marketing false. Profilo, esperienza, obiettivo e disponibilità sono selezionati dalle enum locali esistenti.

Il parser del form pubblico Architetto richiede un telefono e resta invariato. Il test è quindi **CLI → acquisizione v2 nello store → CRM → rilettura**, con ingresso sintetico server dedicato e guardia esatta sui dati, non un collaudo browser o del parser HTTP. Usa canonicalizzazione, consent evidence e RPC di acquisizione esistenti. Nessun numero finto viene usato per aggirare la validazione pubblica.

Prima di ogni write si controllano dati e location; una ricerca email completa deve trovare zero contatti prima dell'acquisizione e dell'upsert. Qualsiasi contatto preesistente osservato blocca la run. Se un contatto compare tra ricerca e upsert, il provider può restituire `new=false`: il runtime estrae l'ID ma arresta il test con IDENTITY/MANUAL_REVIEW e `contactCreatedByRun=false`, senza cleanup. L'upsert può aggiornare i soli campi minimi inviati, secondo il contratto remoto; non promette atomicamente create-only. Il provider applicativo mantiene il precedente comportamento create-only.

## 5. Outbox e isolamento

Non si avvia `runPatrimonialCrmOnce` e non si chiama `claimOperations`, perché la RPC installata pesca globalmente e può aggiornare anche righe con tentativi esauriti. La run crea soltanto i propri cinque effetti, con ID e operationKey noti: SYNC_REQUEST, RESOLVE_CONTACT, UPSERT_CONTACT, ADD_TAGS, ADD_NOTE.

Il primo effetto nasce con lease nella transazione di acquisizione; ciascun effetto successivo nasce con lease nella stessa completion atomica del predecessore. Questa è una procedura riservata al harness per **righe nuove proprie**; non è un nuovo algoritmo di claim della coda applicativa. Le RPC esistenti verificano token/versione/scadenza DB prima di rinnovo e completion; nessun lock attraversa una fetch provider. Non viene modificata alcuna migration o tabella.

Errori o commit incerti non provocano nuove create automatiche. La richiesta conserva i checkpoint: effetti incerti sono RECONCILE_REQUIRED; execute rifiuta qualsiasi run/request già persistita. Dopo un'interruzione si ispezionano report e audit, senza ripartire con nuovi identificativi per nascondere l'esito. Verifica/cleanup automatici richiedono evidenze complete; una run incompleta richiede riconciliazione manuale mirata.

## 6. Opportunity e custom field

`receivePatrimonialOpportunity` crea il dominio A con scope `synthetic:<runId>`. Claim e autorizzazione write sono per il suo solo intent, con revisione/token/scadenza. La CLI cerca prima per contatto/pipeline: risultati preesistenti bloccano la create. Crea soltanto A01/open, senza close reason o owner inventati, e rilegge prima di salvare il remote checkpoint.

Vengono scritti per ID i dodici campi richiesti: hz_intent_key, hz_funnel, hz_source, hz_source_path, hz_requested_at, hz_privacy_version, hz_marketing_consent_snapshot, hz_next_step, hz_architect_profile, hz_architect_sales_experience, hz_architect_goal, hz_architect_availability. Valori derivati dalla proiezione di dominio; nessun ID duplicato nel harness rispetto alla config centrale.

La CLI è limitata a questa singola opportunity OPEN senza motivo di chiusura. Non cambia il gate conservativo closeReason unresolved nel sync applicativo. Lost reasons, Evento, booking, webhook, workflow e messaggi restano fuori scope.

## 7. Nota e verifica remota

Una sola nota con marker `horyzon-patrimonial-request:<requestId>`, SYNTHETIC TEST, run ID, request ID, ARCHITECT_PATH, timestamp e NO PRODUCTION LEAD. Nessun secret. Tag: horyzon-patrimoniale, percorso-architetto-patrimoniale, pilot; il provider verifica catalogo nome/ID/location prima dell'assegnazione e non crea tag.

Rilettura contatto: nome, cognome, email esatta, telefono assente, location e tag. Rilettura opportunity: ID contatto, pipeline, stage A01, status open e tutti i dodici custom field. Ricerche complete confermano una sola identità e una sola opportunity. Se notesRead è verificato, si verifica il note ID tramite marker; altrimenti nota SKIPPED e warning NOTE_READ_SKIPPED, senza far fallire il resto.

## 8. Verifica Supabase e replay

Riletture RPC: request e payload hash, intent provvisorio, due consent evidence, cinque effetti SYNCED con ID della run, contact checkpoint, intent A e remote opportunity ID. Letture Data API server con service role: riga intent PROVISIONAL/contatto, intent OPPORTUNITY/SYNCED/remote ID e domain event sia request_received sia del dominio. Nessun grant browser o schema nuovo.

Il retry della stessa requestId attraversa nuovamente la RPC di acquisizione e deve restituire replay/receipt/intent invariati. Non dispatcha effetti CRM. Report e verifiche registrano il replay; i test locali contano una create contatto, una opportunity e una nota logica.

## 9. Cleanup

Solo `--cleanup --confirm-live-write` con report precedente, mapping/location coerenti, dati esatti e prove nello store. Richiede contactCreatedByRun, ricerca iniziale vuota, checkpoint resolution NEW ed effetto UPSERT_CONTACT SYNCED con lo stesso remote ID; non basta alterare il JSON del report.

Si rilegge prima il contatto e l'opportunity. Si elimina soltanto l'opportunity provata, se il binding delete è verificato; si conferma l'assenza. Il contatto si elimina solo dopo, con nome/email/telefono/location ancora coerenti e inventario completo senza altre opportunity. Delete non disponibile o inventario insufficiente → MANUAL_CLEANUP_REQUIRED. Relazioni estranee → stop. Cleanup ripetuto riconosce ALREADY_ABSENT. Audit Supabase sempre preservato; nessun DROP, reset, purge, cancellazione di pipeline/stage/custom field/tag globali.

## 10. Report

Ogni futura invocazione CLI crea esclusivamente `tmp/patrimonial-live-smoke-<timestamp>-<uuid>.json` e `.md`, anche in dry-run/abort. Apertura esclusiva `wx`, permessi restrittivi ove supportati; gli handle aggiornano soltanto i due file nuovi. Nessun elenco/pulizia/overwrite dei file preesistenti. Checkpoint report prima e dopo le operazioni; errore di persistenza blocca le operazioni successive.

Campi: run ID, request ID, ID contatto/opportunity/intents, effetti, verifiche, replay, cleanup, PASS/FAIL/NOT_RUN e warning. Allowlist di campi, credenziali redatte anche se compaiono in un valore, niente token lease, env, body provider o stack. Verify/cleanup creano un nuovo report mantenendo l'identità della run originale; non sovrascrivono il report sorgente.

Report dry-run: `mode=DRY_RUN`, `status=PASS/BLOCKED`, `result=DRY_RUN_PASS/BLOCKED`, `configReady`, `mappingReady`, `storeReady`, `providerBindingReady`, `syntheticGuardReady`, `reportPathReady`, `mappingChecks`, blocker e `writesAttempted=false`. Per binding personalizzati `remoteReads=[]` e `storeReadinessScope=LOCAL_CONFIG_ONLY`. Con `real`, `storeReadinessScope=REMOTE_HEALTH`, `storeHealthChecked` e `remoteReads` distinguono health effettiva e read tentate, comprese quelle fallite; nessun URL/token/body entra nel report. Percorsi JSON/MD validati nella sola directory tmp e scrittura esclusiva confermata prima di restituire l'esito.

## 11. Test locali della consegna

`npm run test:patrimonial-live-smoke` importa solo i moduli libreria, con report in memoria e fetch globale vietata. Copre i dieci casi richiesti, flusso completo fake RPC/CRM, assenza di modifiche a righe outbox estranee, replay, nota opzionale, cleanup ripetuto, failure injection locale e redazione JSON/Markdown. La suite mapping/persistence/CRM/opportunity/legacy/2A/Radar resta verifica regressiva separata. Nessuna esecuzione PostgreSQL o test live viene attestato dai fake.

Test del fix: dry-run completo anche con flag spenti, env assenti o invalidi con diagnostica specifica, fallback URL coerente con il runtime, mapping incompleto, binding mancanti/incompleti/non analizzabili, percorso report non valido, guardie sintetiche, redazione, zero runtime live/provider write/mutazioni Supabase. Le regressioni del verificatore usano esclusivamente fixture.

## 12. Binding ufficiale `real` ed env locali

`scripts/lib/patrimonial-live-smoke-env.mjs` usa `processEnv` di `@next/env`, già installato, per leggere soltanto `.env.local`. Precedenza: processo esistente (anche valore vuoto), poi file locale. Parser/logger non espongono contenuti o errori grezzi. Nessuna modifica al file, nessuna nuova dipendenza; diagnostica limitata a PRESENT/MISSING. L'import dei moduli non carica env e non avvia richieste.

`scripts/lib/patrimonial-live-smoke-bindings.mjs` collega il runtime CLI allo store durevole, al provider contatti configurato, alla proiezione e al routing opportunity già esistenti. Tutto resta fuori dai percorsi pubblici. API HighLevel fissata alla versione `2021-07-28`, origine unica `https://services.leadconnectorhq.com`, redirect vietati. Contratti verificati nella documentazione ufficiale: [contatti GET](https://marketplace.gohighlevel.com/docs/2021-07-28/ghl/contacts/get-contacts/), [create contatto](https://marketplace.gohighlevel.com/docs/2021-07-28/ghl/contacts/create-contact/), [note](https://marketplace.gohighlevel.com/docs/2021-07-28/ghl/contacts/get-all-notes/), [opportunity search](https://marketplace.gohighlevel.com/docs/2021-07-28/ghl/opportunities/search-opportunity/), [opportunity create](https://marketplace.gohighlevel.com/docs/2021-07-28/ghl/opportunities/create-opportunity/), [tag](https://marketplace.gohighlevel.com/docs/2021-07-28/ghl/locations/get-location-tags/). Gli endpoint GET contatti e search/create opportunity sono deprecati nella documentazione: vengono mantenuti per compatibilità con la versione del provider esistente; nessuna migrazione automatica alla v3.

Il dry-run ufficiale esegue in sequenza: RPC `patrimonial_store_health` (POST con corpo vuoto, funzione SQL di sola lettura), GET location, pipeline/stage, catalogo tag, custom field contatto/opportunity, ricerca dell'email sintetica. La prima anomalia interrompe le read successive. Si confrontano tutti gli ID della config centrale, appartenenza allo schema/modello/location e fieldKey effettivi; la location deve impedire contatti duplicati. Nessuna RPC transazionale o di acquisizione viene chiamata. I flag spenti rimangono spenti.

Le ricerche sono limitate a 100 righe e richiedono un totale intero non negativo uguale alle righe ricevute, entro il limite richiesto. La presenza di `nextPageUrl` o `nextPage` non invalida da sola questo conteggio: HighLevel può fornire la navigazione anche con il totale già esaurito. Totali assenti, invalidi o discordanti, conteggi parziali o eccessivi, superamento del limite ed evidenza esplicita di altri record (`hasMore`/`hasNextPage` true) bloccano il test. Nessuna assenza viene dedotta da una pagina incompleta. Il provider filtra inoltre l'identità normalizzata. Dal fix upsert il binding `real` usa il trasporto CLI descritto nella sezione 13, separato dal create-only applicativo. L'opportunity è A01/open, con nome SYNTHETIC TEST e dodici campi inviati come `{id,field_value}`; le risposte vengono normalizzate per la verifica del dominio. Le note sono rilette tramite marker. Cleanup richiede le prove di proprietà preesistenti nel harness e inventario completo su tutte le pipeline.

```sh
npm run smoke:patrimonial -- --dry-run --bindings real
# Solo dopo DRY_RUN_PASS e con autorizzazione esplicita; flag nel solo processo:
npm run smoke:patrimonial -- --execute --bindings real --confirm-live-write
npm run smoke:patrimonial -- --verify --bindings real --report tmp/patrimonial-live-smoke-<execute>.json
# Solo dopo VERIFY PASS, usando il report verificato:
npm run smoke:patrimonial -- --cleanup --bindings real --report tmp/patrimonial-live-smoke-<verify>.json --confirm-live-write
```

Per i tre comandi live sono necessari i gate temporanei V2/CRM/opportunity/synthetic/durable-store; il gate durable-store si abilita soltanto dopo health remota positiva. Booking/messages/webhook restano false. Nessuna abilitazione viene salvata in `.env.local`. `sideEffectsReviewed` certifica il perimetro del codice CLI: nessun endpoint messaggi/workflow è collegato; non afferma di aver disabilitato automazioni preesistenti nel CRM. L'upsert minimo omette anche DND per preservarlo in caso di riuso; indirizzo non recapitabile e telefono assente restano obbligatori.

I test aggiunti coprono il binding ufficiale sul trasporto HTTP fittizio per execute/replay/verify/cleanup e preservazione audit, arresto su health/location/mapping/identità, risposta incompleta, DND e dati sintetici, redazione delle read e precedenza env in un processo isolato con file fittizio in memoria. Nessun test locale legge il file secret o i report tmp preesistenti.

## 13. Diagnosi e fix UPSERT_CONTACT, senza retry live

Evidenza della run `cd3f023e-98b8-43ab-913b-4059554aa2ab`: report JSON e Markdown concordanti; SYNC_REQUEST e RESOLVE_CONTACT SYNCED, UPSERT_CONTACT RECONCILE_REQUIRED, effetti successivi PLANNED. Due sole GET Supabase limitate alla request e all'operazione confermano payload sintetico senza telefono, checkpoint NEW/contactId=null/noteId=null, attemptCount=1, leaseVersion=1, lease rilasciata, remote_id=null, last_error_code=UNKNOWN. Operazione creata alle 09:05:17.318Z e aggiornata alle 09:05:19.355648Z: circa 2,04 secondi; il timeout configurato era 10 secondi. La ricerca HighLevel esterna con risultato contact=null è evidenza fornita dall'utente, non una read ripetuta in questa fase.

**Root cause certa della classificazione:** il harness impostava `writeStarted=true` prima di invocare il provider e nel catch usava `writeStarted || error.outcomeUncertain`. Anche una validazione locale, 400, 401, 403 o 429 diventava quindi RECONCILE_REQUIRED. Il report riduceva tutto a SMOKE_FAILED/UNKNOWN, perdendo status, fase e timing del trasporto. Non si può ricostruire con certezza la risposta HTTP della vecchia run: body, classe originale e status non sono stati conservati. Nessun body storico viene inventato.

**Errore certo del payload:** l'email v1 aveva local-part ASCII di 67 byte, oltre i 64 di [RFC 5321, §4.5.3.1.1](https://www.rfc-editor.org/rfc/rfc5321#section-4.5.3.1.1). È una causa plausibile di rifiuto di validazione, non prova di un HTTP 400 effettivamente osservato. Il formato v2 mantiene l'UUID e scende a 53 byte; il binding rifiuta input legacy prima della fetch.

Trace precedente: orchestrator → real binding create → `PatrimonialConfiguredHighLevelProvider.upsertContact` ereditato (create-only) → transport provider → POST `https://services.leadconnectorhq.com/contacts/`. Corpo: locationId, firstName, lastName, email, dnd=true; niente phone, source, tag o custom field. Headers: Authorization Bearer (valore omesso), Version=2021-07-28, Content-Type/Accept=application/json. Redirect vietati, no-store, timeout 10 s, nessun retry. Parser: body.contact, ID/location e identità; una risposta 2xx indecodificabile era incerta. Il nome del metodo upsertContact non implicava l'endpoint upsert.

Trace corretto, soltanto nel runtime CLI: orchestrator → binding `contacts.upsert` → `smokeContactUpsert` → POST `/contacts/upsert`, stessa origine/versione/header/timeout. Prima della fetch si completano validazione, guardie e serializzazione. Corpo minimo `{locationId,firstName,lastName,email}`: nomi camelCase e locationId obbligatoria secondo la [documentazione HighLevel](https://marketplace.gohighlevel.com/docs/2021-07-28/ghl/contacts/upsert-contact/); non inviare first_name/last_name. Nessun phone vuoto, source, tag, custom field, assegnatario o DND; nessun ID campo inventato. ADD_TAGS resta un effetto separato.

Successo documentato: `{new:true|false,contact:{id,...},traceId?}`. `new=true` → CREATED; `new=false` → REUSED_UPDATED. Risposta minimale con ID e new validi → GET del contatto per identità/location mancanti, senza inventare valori o scartare subito un 2xx valido. Reuse è noto, non ambiguo: ID estratto, nessuna ownership e arresto MANUAL_REVIEW. ID/identità mancanti anche dopo rilettura oppure JSON indecodificabile dopo write restano ambigui.

| Evidenza | Classificazione | Stato effetto |
|---|---|---|
| Schema/guardia locale, zero dispatch | SCHEMA/CONFIG | MANUAL_REVIEW |
| HTTP 400/422 | SCHEMA, deterministic | MANUAL_REVIEW |
| HTTP 401/403 | AUTH | MANUAL_REVIEW |
| HTTP 429 | RATE_LIMIT, rispetta Retry-After | RETRY_SCHEDULED, nessuna riesecuzione automatica del comando |
| HTTP 5xx dopo invio, nessuna prova di mancato commit | PROVIDER, uncertain | RECONCILE_REQUIRED |
| Timeout/disconnect dopo possibile invio | NETWORK, uncertain | RECONCILE_REQUIRED |
| 2xx irrimediabilmente ambiguo | SCHEMA/IDENTITY, uncertain | RECONCILE_REQUIRED |
| Risposta confermata, checkpoint DB successivo incerto | Nessuna nuova create automatica | RECONCILE_REQUIRED |

Il report ora conserva solo diagnostica allowlisted: endpoint fisso, metodo, fase PREPARE/DISPATCH/HTTP_RESPONSE/DECODE/READ_BACK/CONFIRMED, HTTP status se presente, classe codice, elapsedMs, writeDispatched e outcomeUncertain; mai body, headers, token, stack o payload provider. La sanitizzazione scarta completamente i body d'errore invece di copiarne messaggi potenzialmente sensibili. Fixture costruite dal formato ufficiale, non spacciate per risposte catturate della run fallita.

Consegna esclusivamente locale: nessuna write remota, retry live o cleanup, nessun aggiornamento della vecchia riga RECONCILE_REQUIRED e nessuna modifica ai report tmp o agli env. La correzione del codice non riconcilia automaticamente la run precedente.

## 14. Persistenza opportunity: diagnosi SQL e correzione separata

Run di riferimento: request `309eda48-e7d7-44a6-9e21-4dc21758aded`, contact `I2b3PgshYo5zYHK1qg8w`. JSON e Markdown letti e concordanti: cinque effetti CRM SYNCED, contact CREATED/HTTP 201, nessun intent opportunity salvato nel report. Le verifiche esterne fornite dall'utente confermano solo PROVISIONAL e zero opportunity HighLevel; non sono state ripetute. La run live, il suo contatto, i tag, la nota e l'audit non sono stati modificati.

Il vecchio adapter scarta la risposta SQL originale e solleva `PatrimonialStoreUnavailableError`; il harness la riduce a SMOKE_FAILED. Non esiste un body storico nel report da recuperare. La riproduzione su PostgreSQL locale in memoria, con la migration originale invariata e il ruolo service_role, espone l'errore effettivo della stessa istruzione:

```text
SQLSTATE 42883: operator does not exist: boolean -> unknown
PL/pgSQL function patrimonial_execute_command(jsonb) line 97 at IF
PL/pgSQL function patrimonial_store_transaction(jsonb,jsonb,boolean) line 11 at assignment
```

Trace verificata: `runPatrimonialSmoke` → `receivePatrimonialOpportunity` → health → `tx.findOpportunityIntent(groupKey)` → `tx.listParticipations(newIntentId)` → `transitionArchitect` → `tx.saveOpportunityIntent(intent,null)` → commit del journal `[findOpportunityIntent,listParticipations,saveOpportunityIntent]` → IF del branch SQL saveOpportunityIntent. Le due read e la transizione di dominio passano; fallisce la risoluzione degli operatori SQL nell'IF, prima dell'INSERT. La funzione PL/pgSQL risolve l'espressione anche quando expectedRevision=null e il ramo update non dovrebbe scattare.

Root cause: `->` e `@>` hanno la stessa precedenza e associano a sinistra, secondo la [documentazione PostgreSQL](https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-PRECEDENCE). L'espressione `v_input->'requestIds' @> v_parent.record->'requestIds'` tenta infine di applicare `->` al booleano prodotto da `@>`. Identico difetto nel confronto events e nel controllo requestIds di saveParticipations. Correzione: `(v_input->'requestIds') @> (v_parent.record->'requestIds')`, con parentesi su entrambi gli operandi dei tre confronti. Non viene allentata la regola di immutabilità di requestIds/events.

La migration storica `20261014225059_patrimonial_lead_v2.sql` resta intatta. Il CLI Supabase 2.121.0 ha creato `20261015100912_patrimonial_opportunity_jsonb_precedence.sql`: CREATE OR REPLACE della sola patrimonial_execute_command, identica alla precedente salvo le tre parentesizzazioni. Nessuna modifica a tabelle, indici, CHECK, FK, grant o RLS; ACL, SECURITY INVOKER e search_path restano identici. Nessun backfill, cleanup, reset o modifica della run. **Migration correttiva NON applicata al remoto: il fix SQL diventa operativo soltanto dopo un apply autorizzato separatamente.**

La fixture `scripts/fixtures/patrimonial-post-crm.mjs` ricostruisce request acquisita, intent provvisorio identityResolved con remote contact ID, noteId, due consensi, cinque operazioni SYNCED e request_received. Location sostituita da fixture-location; nessun env o dato tmp usato come codice. Input dominio: ARCHITECT_PATH, Imprenditore/No/Sto esplorando/Part-time; requestContext con policy reale e marketing false; actor SYSTEM con ID sintetico, scope sintetico, nextStepAt a +24h. groupKey=SHA256([locationId,contactId,pipeline,scopeKey]), businessKey=SHA256([groupKey,1]), firstRequest invariata, requestIds con la sola request iniziale, evento ARCHITECT_INTEREST_RECEIVED/revision 1. Nessun campo obbligatorio o prerequisito era mancante.

Test aggiunto `scripts/verify-patrimonial-opportunity-sql.mjs`: PostgreSQL WASM PGlite 0.5.10, senza server o porta, DB esclusivamente in memoria. Prima del fix verifica 42883 nel punto esatto e rollback senza OPPORTUNITY; dopo verifica righe SQL/record coerenti per kind, group_key, business_key, location_ref, remote_contact_id, scope_key, revision=1, status=OPEN, stage=A01, next_step=ASSIGN, next_step_at e remote=null. Verifica poi replay, revisione 2, rifiuto della cancellazione della cronologia, ACL e preservazione delle righe request/provisional/consent/outbox originali. Nessuna chiamata HighLevel. Il contratto statico della correzione viene eseguito anche dai test harness e persistence ordinari.

Riproduzione SQL opzionale, senza nuove dipendenze del repository: installare separatamente `@electric-sql/pglite@0.5.10` in una directory temporanea del sistema con `npm install --prefix <directory> --no-save --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.5.10`, poi:

```text
node --no-warnings --experimental-strip-types scripts/verify-patrimonial-opportunity-sql.mjs --pglite-module <directory>/node_modules/@electric-sql/pglite/dist/index.js
```

Il test richiede un percorso esplicito fuori da tmp/, non installa nulla da solo e chiude il database in memoria al termine. La fixture rappresenta la situazione live ma non legge o modifica la run. Il package e il CLI sono strumenti locali temporanei; package.json e lockfile del progetto restano invariati.

## 15. Completezza delle ricerche e ripresa VERIFY

Riproduzione locale prima del fix: HTTP 200 con un contatto, `meta.total=1` e `nextPageUrl` valorizzato veniva respinto dal decoder e classificato CRM_SCHEMA. La guardia precedente trattava ogni cursore come prova di pagina incompleta. Il conteggio affidabile ora governa la completezza delle ricerche contatti e opportunity; il limite resta 100, senza introdurre fetch aggiuntive o accettare inventari parziali. Per i contatti resta supportato `count`, con rifiuto se contraddice `meta.total`.

Fixture A–G: 1/1 e 0/0 con navigazione accettati; 1/2, 100/101, totale assente e righe oltre il totale rifiutati; opportunity 1/1 con navigazione accettata. Ulteriori casi coprono totali invalidi/discordanti, limite superato e indicazioni esplicite di altri record. Il flusso HTTP fittizio completo usa ora risposte con navigazione anche sulle ricerche esaurite.

Il report `tmp/patrimonial-live-smoke-2026-10-15T10-20-55-564Z-51127145-f21c-42d5-81ed-818b2d5ecb97.json` è riprendibile senza modificarlo: JSON e Markdown concordano, request `eff51030-556f-4fb7-9746-e0d08dd0f9ea`, run `1e3dffd0-866f-425f-a49c-47ba9274a566`, execute FAIL/CRM_SCHEMA ma executed e replay true, tutti gli ID necessari presenti, cinque effetti SYNCED e cleanup non richiesto. Il parser ammette un report FAIL; il ramo verify richiede le evidenze di esecuzione, senza richiedere PASS del report sorgente. La CLI crea nuovi report con apertura esclusiva e legge soltanto quello sorgente.

`READY_FOR_EXISTING_RUN_VERIFY=YES` indica riprendibilità, non un nuovo esito remoto. La fixture di ripresa verifica la stessa identità, stato durevole invariato, sole GET HighLevel e RPC Supabase con i soli comandi `getRequest`, `getConsentEvidence`, `getOperation`, `getOpportunityIntent` (oltre alla health read-only). Il ramo VERIFY non rilancia acquisizione, replay o dispatch. Restano necessari i gate temporanei già previsti V2/CRM/opportunity/synthetic/durable-store e booking/messages/webhook false, senza modificare `.env.local`. Nessun VERIFY, execute, cleanup o chiamata HighLevel/Supabase è stato eseguito durante questo fix; report, asset sintetici e audit restano preservati.
