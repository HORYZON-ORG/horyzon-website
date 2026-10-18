# Patrimonial remote activation preflight v1 — P2C-A

18 ottobre 2026. Repo HORYZON-ORG/horyzon-website, branch feat/patrimonial-pilot-funnels. HEAD iniziale e origin dopo fetch: f5908827babeaae1a5c8d9ee5b7893a3cf80b315. **Verdetto: BLOCKED. Nessuna migration remota approvata/applicata da questo preflight.**

La compatibilità delle righe osservate è positiva, ma l'applicazione remota non è ancora approvabile: storico migration non riconciliato e health check senza capability P1/P2B. Il percorso owner nuovo fallisce senza nuovi command, ma il controllo health base restituisce comunque successo. Non correggiamo questi problemi silenziosamente in una fase read-only.

## Evidenza e confine delle verifiche

R1: controlli MCP Supabase effettivi, solo get_project, list_migrations e SELECT su cataloghi/aggregati. Project horyzon, ref pmkyeqrfkunypfkbjnyg, ACTIVE_HEALTHY, PostgreSQL 17.6.1.166. Nessuna credenziale, env, riga reale, nome, email o telefono letto/esportato. Il dataset di prova contiene solo ID generati, struttura e categorie sintetiche.

R2: schema rilevante confrontato nel database effimero con la baseline locale: colonne/default/nullability delle tre tabelle modificate, CHECK/FK/UNIQUE e hash md5 dei corpi di tutte le 10 funzioni patrimoniali base coincidono. Le versioni nello storico, invece, differiscono. Il confronto dei corpi non certifica identità di tutto il DDL storico o dei prodotti esterni al perimetro patrimoniale.

R3: dry-run locale PGlite e adapter RPC reali corrente e pre-P2B (dfd2e7b7b7d4af301c0429bd2ba75fa4c12b4739, transpilation soltanto in memoria). La versione engine locale è riportata dal verify: PG18.6, mentre il remoto è PG17.6. I cataloghi NOT NULL differiscono: confrontati attraverso information_schema, escludendo solo contype=n dal confronto pg_constraint. Non si dichiara un'esecuzione nativa PG17; una prova PG17 equivalente resta condizione prudenziale prima dell'applicazione, insieme ai blocker principali.

R4: evidenza HighLevel esterna fornita dall'utente: Location/users/membership e scopes read verificati, search con 0 opportunity, nessuna write/round-trip. Non è una verifica del token Vercel. Documentazione ufficiale riletta in questa fase, nessuna chiamata a dati account HighLevel.

Evidenza riproducibile senza PII: scripts/fixtures/patrimonial-preflight-evidence.json. Verify locale: scripts/verify-patrimonial-activation-preflight.mjs. Entrambi non contengono credenziali né record reali. La fixture di evidenza è una fotografia del 18 ottobre: non sostituisce un controllo fresco al momento di una futura approvazione.

## Stato remoto effettivo e dati da preservare

| Tabella | Righe |
| --- | ---: |
| patrimonial_intents | 4 |
| patrimonial_requests | 3 |
| patrimonial_outbox_operations | 13 |
| patrimonial_domain_events | 4 |
| patrimonial_consent_evidence | 6 |
| patrimonial_event_editions | 0 |
| patrimonial_participations | 0 |

Intent: 3 PROVISIONAL/architect-path/SYNC_PENDING/revision 0; 1 OPPORTUNITY/architect-path/OPEN/A01/revision 1 con remote ID presente e sync_state SYNCED. Tutti owner_ref null. Nessun ID reale copiato. Le 3 provisional non hanno revision nel JSON per contratto: NON sono inconsistenze e NON richiedono backfill. Identità id/kind se presente coerente; opportunity revision/status/stage/ownerRef/businessKey/Location/contact/remote ID coerenti con colonne. Revision e lease verificati: nessun valore incompatibile.

Outbox: SYNC_REQUEST 3 SYNCED; RESOLVE_CONTACT 3 SYNCED; UPSERT_CONTACT 2 SYNCED + 1 RECONCILE_REQUIRED; ADD_TAGS 2 SYNCED; ADD_NOTE 2 SYNCED. Attempt e lease version 1; nessuna lease attiva/incoerente, tipo sconosciuto o mismatch record/native. La reconciliation esistente deve restare tale: non è consumata, chiusa o riprovata da questo audit. Eventi: 3 request_received + 1 ARCHITECT_INTEREST_RECEIVED, nessun nome riservato a esperimenti P1.

P1 e P2B assenti nello storico, tutte le tabelle P1 e tutte le nuove colonne/funzioni P1/P2B assenti: nessuna applicazione parziale rilevata. Tutte le 7 tabelle base hanno ENABLE + FORCE RLS, nessuna policy cliente e nessun grant tabella ad anon/authenticated/PUBLIC. Tutte le 10 routine base sono INVOKER con search_path fissato e ACL postgres/service_role. Indici patrimoniali osservati: 34. L'accesso MCP non prova l'accesso della service key runtime.

## Storico migration e ordine

Ultima migration remota: 20261015122405_radar_v4_positioning. I file locali P1 20261018094926 e P2B 20261018163245 non sono applicati. Nel repository non esiste una terza migration intermedia fra baseline patrimoniale/P1/P2B necessaria a queste dipendenze.

Drift patrimoniale esplicito:

| Nome | Versione locale | Versione remota |
| --- | --- | --- |
| patrimonial_lead_v2 | 20261014225059 | 20261014215416 |
| patrimonial_opportunity_jsonb_precedence | 20261015100912 | 20261015101816 |

Altri 15 file locali già applicati hanno timestamp diversi nello storico remoto, oltre a numerose migration platform/social solo remote e radar_v4_positioning solo remota. L'elenco completo osservato e il confronto per nome/versione sono nella fixture/verify. Nessun rename, repair o insert nella history è stato fatto. Non usare un db push indiscriminato: può considerare pendenti baseline già presenti. Occorre una riconciliazione formale della lineage e del metodo di applicazione, autorizzata separatamente; i 10 hash routine uguali non autorizzano a riparare automaticamente lo storico.

Ordine tecnico provato solo localmente: BASELINE → P1 → P2B. P2B dipende dalle tabelle P1 nei tipi PL/pgSQL: applicarla prima fallisce per patrimonial_assignments mancante e la transazione rollbacka anche ALTER/CHECK iniziali. Non è un'installazione parziale da recuperare manualmente. La dipendenza è espressa da oggetti/commento, non da una custom migration-version assertion.

## Audit integrale delle due migration

P1 è additiva: crea 10 tabelle di registro/assegnazione/esperimenti/supporto, aggiunge current_operator_id nullable con FK al nuovo registro vuoto e operator_revision NOT NULL DEFAULT 0 CHECK >=0. Sulle 4 righe esistenti produce null/0 senza cambiare dati/JSON, owner_ref, business revision, stage/status o altri campi. Nessun backfill richiesto. Le nuove FK non hanno valori legacy non-null da validare.

La ledger eventi riceve experiment_id nullable, intent_id DROP NOT NULL e un CHECK di aggregate: i 4 eventi osservati hanno intent_id e nomi non riservati agli esperimenti, quindi restano validi. DROP NOT NULL allenta il vincolo, non elimina dati. I trigger nuovi su intent scattano su insert/update di current_operator_id, non riscrivono righe all'installazione. Il confronto differito null/null con assenza di assignment è valido per gli intent legacy. Tutte le nuove tabelle sono FORCE RLS/service_role only; INVOKER e revoche esplicite sui nuovi helper. L'unico insert di installazione è singleton tecnico assignment_state, non un seed di persone/operatori. Nessun collaboratore hardcoded, DELETE, TRUNCATE, reset, DROP TABLE/COLUMN o update retroattivo di record.

P2B aggiunge owner_checkpoint_revision NOT NULL DEFAULT 0 CHECK >=0 e owner_checkpoint nullable JSON object. Sostituisce il solo CHECK effect_type con un superset dei 5 tipi precedenti + ASSIGN_OPPORTUNITY_OWNER, dentro un'unica transazione; il DROP CONSTRAINT non è DROP dati. Le 13 operation mantengono tipo, JSON, status, lease, tentativi e reconciliation identici; nessuna diventa owner operation. Non ci sono seed, DELETE, TRUNCATE o DROP TABLE/COLUMN. Gli helper e il dispatcher sono INVOKER con EXECUTE solo service_role.

Dispatcher: P1 rinomina il vecchio e delega tutti gli altri command; P2B rinomina il wrapper P1 e delega gli altri command. Il corpo del dispatcher legacy dopo entrambe coincide esattamente con quello remoto base (hash). I 25 command legacy restano nella catena. P2B intercetta saveOpportunityIntent per bloccare ownerId obsoleto solo dopo owner_checkpoint_revision>0: tutte le righe correnti ricevono 0, perciò nessuna reinterpretazione legacy al rollout. Questa restrizione futura è intenzionale, da considerare dopo lo smoke.

## Risultato dry-run popolato

La baseline locale è popolata PRIMA di P1: 4 intent, 3 request, 13 operation, 4 eventi, 6 consensi, 0 edition/participation. Forma kind/funnel/status/stage/revision/sync state e presenza remote ID confrontata con aggregati remoti. Nessun contenuto remoto copiato.

- P1: PASS; righe e tutti i campi preesistenti/JSON identici, nuovi campi null/0, registro senza operatori/assignment.
- P2B: PASS; stessi valori legacy, checkpoint null/0, nessun required backfill.
- P2B prima di P1: rifiuto e rollback totale verificati.
- Adapter pre-P2B e attuale: getRequest/getOpportunity e normale claim invariati sulla fixture, più hash del dispatcher preservato.
- OLD APP su NEW DB: claim senza kinds esclude una owner operation sintetica aggiunta DOPO la prova di preservazione. NEW APP owner claim non prende il contatto in reconciliation; il vecchio claim reconciliation legge soltanto UPSERT_CONTACT. Queste mutazioni sono solo nel DB locale effimero.
- ACL/RLS: anon/authenticated senza EXECUTE sulle routine; tabelle FORCE RLS. Le suite owner/assignment verificano anche i comandi e il fencing.

## Store version e compatibilità app/database

PATRIMONIAL_STORE_VERSION e patrimonial_store_health restano patrimonial-v2-store-1. La funzione verifica sette tabelle base e colonne originali: nessuna attestazione di assignment/owner schema, wrapper, claim filtering o checkpoint. Il verify riproduce health() positivo sul vecchio DB e owner command rifiutato: **STORE_HEALTH_CAPABILITY_GAP**. I nuovi command falliscono prima di effetti ma health non è una prova di supporto. È un blocker rispetto al requisito del preflight; non è stato corretto in questa fase.

| App | DB | Status | Evidenza / limite |
| --- | --- | --- | --- |
| OLD pre-P2B | OLD baseline | SAFE | Contratto contatti/business base, nessun owner supportato |
| NEW P2B | OLD baseline | UNSAFE | Come controllo di readiness: health falso positivo; command nuovi FAIL_CLOSED e rollbackano, ma health da sola non distingue lo schema |
| OLD pre-P2B | NEW P1+P2B | SAFE | Claim SQL default contatti; non ruba owner effects; delega legacy conservata. Non abilita owner-sync |
| NEW P2B | NEW P1+P2B | SAFE | Con verifica schema/capability separata e flag owner false; smoke live ancora BLOCKED per credenziali/decoder/autorizzazione |

Prima di approvare serve una readiness esplicita P1/P2B: ad esempio una capability/schema response dedicata, verificata dall'app prima dei nuovi command. Un bump globale indiscriminato può rompere OLD APP + NEW DB: occorre definire un contratto compatibile e provarne i quattro casi. Non si propone né applica una patch nascosta alla migration già committata.

## Matrice readiness

| ITEM | STATUS | EVIDENCE | BLOCKER | NEXT ACTION |
| --- | --- | --- | --- | --- |
| P1 migration | READY_WITH_CONDITION | Audit integrale e dry-run popolato PASS | History non riconciliata; approvazione assente | Riconciliare lineage, poi approvazione specifica |
| P2B migration | READY_WITH_CONDITION | Superset CHECK, checkpoint null/0, rollback ordine errato PASS | P1 non installata; health gap | P1 prima, risolvere capability readiness |
| Migration order | BLOCKED | P1→P2B corretto; nessuna terza dipendenza locale | Timestamp history diversi | Definire procedura puntuale autorizzata; niente db push generico |
| Existing data compatibility | READY_WITH_CONDITION | SELECT aggregate coerenti e fixture preservata | Foto del momento; locale PG18/remoto PG17 | Ripetere checks freschi e dry-run PG17 prima dell'apply |
| ACL | READY | Service-only su remoto base e nuovi helper locali | Nessun grant cliente rilevato | Verificare ACL effettive post-apply |
| RLS | READY | FORCE RLS su 7 base e nuove locali | Nessuno nello scope osservato | Verificare post-apply |
| RPC compatibility | READY_WITH_CONDITION | 10 hash base identici, 25 command delegati, adapter old/new testati | Health non certifica nuovi command | Capability probe non mutativa dedicata |
| Store version | BLOCKED | v1 invariata; nuovo codice/vecchio DB health positivo | STORE_HEALTH_CAPABILITY_GAP | Disegnare/verificare readiness P1/P2B separata |
| Deployment order | READY_WITH_CONDITION | Sequenza sotto preserva baseline | History/health bloccano applicazione | Completare remediation e ripetere preflight |
| Feature flags | READY_WITH_CONDITION | Exact true, default false nel codice | Valori remoti volutamente non letti | Mantenere assignments/ownerSync false, attestazione rollout senza secret |
| Runtime Supabase access | BLOCKED | MCP progetto funziona; env canonica nel factory | Service key/URL readiness runtime non verificata | Prova read-only nel runtime effettivo |
| Runtime HighLevel token | BLOCKED | Solo connessione audit esterna verificata | RUNTIME_TOKEN_NOT_VERIFIED | Prova read-only con credenziale effettiva senza log/env change |
| Users read | READY_WITH_CONDITION | R4 e decoder mock coerenti con shape riferita | GET esatto con token runtime non provato | Verificare id/deleted/roles sul target corretto |
| Location read | READY_WITH_CONDITION | R4 identity/membership verificate | Token runtime e HIGHLEVEL_LOCATION_ID non confrontati | Check read-only runtime con ref canonico |
| Opportunity read | BLOCKED | LOCALLY_VERIFIED_ONLY; R4 search=0 | Nessuna risposta GET non vuota runtime | Fixture sintetica autorizzata e GET per ID |
| assignedTo decoder | BLOCKED | String/null/empty/missing distinti nei test | Shape/nullability live non provate | Verificare valore reale e proof nullable esplicita |
| Owner write | BLOCKED | PUT dedicato solo assignedTo, stub generici invariati | Permesso/token/schema runtime e autorizzazione mancanti | Una write sintetica solo in fase separata |
| Owner round-trip | BLOCKED | Nessuna write live | Read-back/checkpoint live non verificati | Smoke controllato con una write |
| Owner clear | NOT_APPLICABLE | UNSUPPORTED/UNVERIFIED, nessun clear nel percorso | Fuori scope smoke | Non inviare null/empty/omissione come clear |
| Remote race/CAS | READY_WITH_CONDITION | Read→PUT→read-back; nessuna CAS verificata | Accettazione solo sintetico controllato; produzione separata | Un worker, nessuna modifica umana, una write, read-back immediato |
| Cleanup strategy | READY_WITH_CONDITION | Piano per ID esatti, endpoint delete documentati | Permission/delete semantics non provati runtime | Verificare capacità cleanup prima della creazione sintetica |

## Ordine rollout raccomandato — solo piano

0. Risolvere history drift e health/capability gap con lavoro autorizzato separatamente; completare prova PG17 e ripetere preflight. Nessun apply approvato finché BLOCKED.
1. Confermare codice revisionato effettivamente deployato sull'ambiente designato con assignments/ownerSync false; nessuna deduzione dal solo push Git. Non effettuato qui.
2. Applicare SOLO P1 autorizzata; verificare tabelle/colonne/default/trigger/ACL e contatori/invarianti, preservare audit e reconciliation.
3. Applicare SOLO P2B autorizzata; verificare CHECK/claim filtering/checkpoint/dispatcher/readiness e contatori invariati.
4. Flag ancora false; verificare credenziali Supabase e HighLevel nel runtime effettivo con sole letture, senza esporre valori.
5. Autorizzazione separata allo smoke sintetico e cleanup; completare fixture/permissions/ID e-mail controllata.
6. Solo allora abilitazione controllata del singolo runner trusted, una owner write e read-back; ripristino dei gate allo stato approvato al termine.

assignments e ownerSync devono restare false. opportunityWrite deve restare disabilitato: il generico è comunque stub CONFIG. Booking/messages/webhook non necessari allo smoke e nessuna nuova attivazione. v2/crmWrite sono ulteriori gate richiesti dalla futura dispatch; non li attiviamo né assumiamo il loro stato effettivo. Tutti i flag sono exact-string true, assenza/valore differente false. DURABLE_STORE_READY da solo attesta approvazione configurativa, non prova P1/P2B.

## Runtime e contratto HighLevel

Il factory Supabase legge SUPABASE_URL o NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY solo server, richiede DURABLE_STORE_READY. Non abbiamo letto env o secret. Il provider owner legge HIGHLEVEL_PRIVATE_TOKEN/HIGHLEVEL_LOCATION_ID dall'env runtime canonica, verifica che non cambino durante le chiamate e richiede proof trusted esplicita. Nessun fallback dal token MCP alla credenziale app e nessun provider live costruito in questo preflight.

Version header e proof sono entrambi v3. [Versioning ufficiale](https://marketplace.gohighlevel.com/docs/Versioning/index.html) e [update opportunity](https://marketplace.gohighlevel.com/docs/ghl/opportunities/update-opportunity/index.html) documentano v3: nessuna discrepanza documentale rilevata. L'header effettivo del tool esterno non è stato fornito; la sua accettazione non certifica il token runtime. Nessuna correzione del provider eseguita.

readRemoteUser normalizza solo remoteUserId/locationIds/deleted/role/type; match esatto, deleted boolean e membership obbligatori. La shape esterna riferita è coerente. [GET user](https://marketplace.gohighlevel.com/docs/ghl/users/get-user/index.html) mostra roles ma non deleted: il GET specifico deve dimostrare quel campo col token runtime; se omesso il decoder deve restare HOLD, non active per default.

[GET opportunity](https://marketplace.gohighlevel.com/docs/ghl/opportunities/get-opportunity/index.html): envelope opportunity con identity id/location/contact/pipeline, customFields identity se presente, assignedTo string oppure null solo se contratto autorizzato; marker eventuale. LOCALLY_VERIFIED_ONLY: la futura fixture deve confermare shape e valori col token effettivo, prima di costruire proof live. Se emerge mismatch, STOP e revisione separata.

L'owner PUT invia solo assignedTo. Nessun name/pipeline/stage/status/value/customFields/closeReason. I metodi searchOpportunities/createOpportunity/updateOpportunity generici restano CONFIG byte-identici; il binding owner non implementa l'interfaccia completa e non è passato al legacy sync. I test confermano che opportunityWrite=true non aggira ownerSync=false. Nessuna API di clear.

## Smoke sintetico futuro — non eseguito

Contatto: Horyzon QA synthetic. Email: indirizzo test controllato Horyzon già configurato/approvato; nessuno fornito/verificato in questo preflight. **SYNTHETIC_EMAIL_NOT_CONFIRMED: prima dello smoke fermarsi e chiedere quale usare.** Nessuna e-mail personale o indirizzo inventato per inviare messaggi. Nessuna automazione commerciale/messaggio deve partire dal test.

Opportunity: [TEST] Patrimonial Owner Sync <timestamp UTC + run ID>. Una sola pipeline: Percorso Architetto Patrimoniale, A01/Nuovo interesse, solo dopo verifica mapping/location/stage correnti. Nessun ID reale nuovo hardcoded. Nessun tag nuovo; test/synthetic solo se già approvato e presente, altrimenti nessun tag. Nessuna nota necessaria al solo owner-sync.

La create sintetica non può usare i metodi generici stub e NON li abilita: eventuale setup tramite strumento amministrativo esplicitamente autorizzato, registrando gli ID restituiti, non search-and-pick. Token runtime deve provare users/opportunity reads e permission write. Una sola opportunity identificata; nessun umano la modifica, un solo worker, una write owner, GET immediato, checkpoint e replay con zero ulteriori PUT. Reassignment richiede autorizzazione distinta se comporta una seconda write: non incluso nel primo smoke a una write.

Race senza CAS: accettabile solo alle condizioni sintetiche riportate dall'utente e con scope approvato. Una modifica tra ultimo GET e PUT resta possibile; il fencing locale non la rende atomica. Rischio produzione non accettato da questo documento. Timeout o esito ambiguo → sospendere la write loop, read-first/reconciliation, nessun retry cieco.

## Cleanup futuro per ID esatti — non eseguito

Prima della creazione confermare capacità di cleanup con il token/tool autorizzato. Manifest del run: ID contatto/opportunity creati, Location, run ID, eventuali note ID e soli tag aggiunti, timestamp; nessun record cliente selezionato tramite ricerca generica. Se un contatto esistente viene riusato non lo si elimina: il primo smoke deve preferire un contatto nuovo esclusivamente sintetico.

1. Fermare worker e impedire redispatch dopo pulizia; conservare outbox/checkpoint/audit locali.
2. GET dei due ID manifestati, verifica reciproca opportunity.contactId e Location/run marker; mismatch → STOP/manual review, nessun delete.
3. Eliminare esclusivamente opportunity sintetica per ID, poi contatto sintetico per ID, con autorizzazione esplicita. Endpoint documentati [DELETE opportunity](https://marketplace.gohighlevel.com/docs/ghl/opportunities/delete-opportunity/index.html) e [DELETE contact](https://marketplace.gohighlevel.com/docs/ghl/contacts/delete-contact/index.html). Nessuna chiamata delete eseguita o permission dedotta dal read-only.
4. Se esistono note/tag creati dal test, rimuovere solo quegli ID/associazioni dal manifest; non cancellare definizioni tag globali o note preesistenti. Non presumere cascade: verificare il residuo per ID ed eliminare solo oggetti sintetici esplicitamente tracciati.
5. GET per ID deve confermare assenza con risposta documentata; 401/403/5xx non valgono come assenza. Se delete non disponibile, chiusura concordata dell'opportunity e cleanup manuale autorizzato, senza ampliare il payload del provider owner. Audit Supabase resta; nessun purge o search+delete.

## Test e consegna

Verify preflight: dry-run popolato, ordine errato/rollback, preservazione JSON, confronto remoto metadata/hash, old/new adapter e claim isolation, ACL/RLS, default flag. Il PASS del verify attesta che le osservazioni sono riproducibili, **non** che il verdetto sia READY: i due blocker sono attesi e riprodotti.

Esiti finali: PASS nuovo verify preflight e tutte le sette suite richieste: owner-sync, owner-readiness, assignment-management (alias npm esistente test:patrimonial-assignment), persistence, CRM, opportunities, remote-mapping; PASS typecheck senza emissione con tmp esclusa solo in memoria, ESLint sul nuovo script a zero warning e git diff --check. Nessun file UI/produzione o migration modificato, nessun browser redesign necessario. tmp/ e documento Radar preesistenti esclusi.

Consegna esclusivamente documentazione/test/evidenza aggregata, commit docs: verify patrimonial remote activation preflight e push solo feature branch. Nessun main merge, deploy, flag, HighLevel/Supabase remote write o migration. **STOP al verdetto BLOCKED: non proseguire con applicazione o smoke.**
