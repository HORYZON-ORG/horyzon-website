# Patrimonial remote activation preflight v1 — P2C-A / P2C-B

18 ottobre 2026. Repo HORYZON-ORG/horyzon-website, branch feat/patrimonial-pilot-funnels. P2C-B parte da 5b8a997f83c296c6cac4a319df18568e6273be9e, confermato dopo fetch. **Verdetto locale: READY_FOR_REMOTE_MIGRATION_APPROVAL. NON READY_FOR_LIVE.** Nessuna migration remota, history repair, db push, env/flag o HighLevel write eseguita.

## Stato dei blocker

RESOLVED — MIGRATION_HISTORY_DRIFT come impedimento operativo: adottata la strategia managed/targeted SQL esplicito, senza modificare lo storico. La divergenza storica resta presente e generic db push resta UNSAFE. La [lineage canonica](patrimonial-migration-lineage-v1.md) distingue filename/versione locale, versione remota, nome logico, prove schema e metodo di apply. Non rieseguire baseline già esistenti.

RESOLVED — STORE_HEALTH_CAPABILITY_GAP: health base v1 resta backward compatible; nuova RPC catalog-only e controlli app bloccano nuovi command prima di qualsiasi journal/mutazione se capability mancanti, parziali o di versione ignota. Nessun fallback dal health base positivo. Probe rifatta prima di preview e commit, senza cache permanente.

STILL BLOCKED per le fasi successive: autorizzazione esplicita apply remoto; autorizzazione smoke sintetico; RUNTIME_TOKEN_NOT_VERIFIED; OPPORTUNITY_NONEMPTY_READ_UNVERIFIED; ASSIGNEDTO_LIVE_SHAPE_UNVERIFIED; OWNER_ROUNDTRIP_UNVERIFIED. OWNER_CLEAR_UNSUPPORTED e REMOTE_CAS_UNVERIFIED restano limiti distinti, non risolti localmente.

## Evidenza remota P2C-A — fotografia, non nuove chiamate P2C-B

P2C-A ha verificato read-only il progetto horyzon, pmkyeqrfkunypfkbjnyg, ACTIVE_HEALTHY, PostgreSQL 17.6.1.166; history fino a 20261015122405_radar_v4_positioning. P1/P2B e loro nuovi oggetti assenti. P2C-B non rilegge segreti né modifica/ricertifica lo stato remoto.

Counts: 4 intent (3 PROVISIONAL/SYNC_PENDING e 1 OPPORTUNITY/OPEN/A01/revision 1, architect-path), 3 request, 13 outbox, 4 eventi, 6 consensi, 0 edition/participation. Tutti owner_ref null; 1 UPSERT_CONTACT in RECONCILE_REQUIRED, altre 12 operation SYNCED. Nessun mismatch JSON/native, owner malformato, revision negativa o lease incoerente. Le provisional senza revision JSON sono conformi al contratto, non richiedono backfill.

Sette tabelle base ENABLE+FORCE RLS, nessun grant cliente/policy, dieci routine INVOKER/search_path fissato/service_role. Confrontati colonne/default/nullability rilevanti, CHECK/FK/UNIQUE e dieci hash routine: equivalenza rilevante locale/remoto. Nessun record reale esportato; evidenza solo schema/categorie/aggregati in scripts/fixtures/patrimonial-preflight-evidence.json. La verifica runtime Supabase service key è distinta dall'accesso MCP dell'audit.

## Lineage e preservazione

Le baseline patrimoniali remote non vanno rieseguite: patrimonial_lead_v2 locale 20261014225059/remoto 20261014215416; patrimonial_opportunity_jsonb_precedence locale 20261015100912/remoto 20261015101816. Altri 15 drift timestamp e migration remote-only rendono non sicuro un db push automatico. Non si rinominano file né si inseriscono fake history entries.

Ordine futuro unico: 20261018094926_patrimonial_assignment_management.sql → 20261018163245_patrimonial_owner_sync.sql → 20261018180107_patrimonial_runtime_capabilities.sql. Nessuna migration intermedia mancante. Ogni targeted apply richiede verifiche assenza/history/oggetti/schema/hash/counts/invarianti/flag prima e verifica schema/ACL/RLS/counts/RPC/invarianti dopo. Manifest con digest e versione effettivamente restituita dal metodo managed; ACK incerto significa read-first, non replay. Nessun apply ora.

Audit P1/P2B e dry-run preservano le righe esistenti: current_operator_id null, operator_revision 0, checkpoint revision 0 e checkpoint null, nessuna riscrittura dati/JSON o backfill. P1 crea soltanto singleton tecnico, nessun operatore seed. P1 rilassa intent_id NOT NULL solo per eventi esperimento e aggiunge CHECK compatibile coi quattro eventi; P2B sostituisce atomicamente il CHECK effect_type con un superset. Nessun DROP TABLE/COLUMN, DELETE, TRUNCATE o reset. P2B prima di P1 fallisce e rollbacka. Tutti i file precedenti restano immutati.

## Contratto capability adattivo

Nuova migration locale 20261018180107_patrimonial_runtime_capabilities.sql: solo due funzioni STABLE/SECURITY INVOKER, search_path fissato e grants EXECUTE service_role only. Nessuna query a dati business, seed, backfill, journal o lock applicativo. Il probe legge cataloghi PG17 compatibili e restituisce soltanto:

- contract: patrimonial-runtime-capabilities-v1;
- base: patrimonial-v2-store-1 se health routine riconosciuta;
- assignmentManagement: p1-v1 se oggetti P1 completi, altrimenti null;
- ownerSync: p2b-v1 solo con P1 + P2B completi, altrimenti null.

Controlli: tutte le colonne P1 e colonne aggiunte ai ledger, tipi/nullability/default, vincoli validi, indici validi/ready, trigger attivi, routine con firma/return type/volatility/INVOKER/search_path/hash attesi, RLS e privilegi effettivi client/service. Il wrapper pubblico P1 o P2B è riconosciuto per assignment; owner richiede wrapper P2B, precedente P1, claim filtrato e checkpoint. Nessun valore true dedotto dalla sola installazione del probe. Corpi sconosciuti o metadata parziali → capability null, nessuna auto-repair. Le fingerprint non sono un'autorizzazione di scrittura né una difesa contro un amministratore DB malevolo; sono attestazioni di compatibilità del contratto.

Scelta adattiva confermata esplicitamente dall'utente: il probe può essere installato nel laboratorio su P1-only e consente solo assignment; senza P1/P2B non abilita nuove feature. Questo risolve la matrice richiesta senza cambiare P1/P2B. L'ordine operativo remoto resta P1 → P2B → capability; non si propone apply anticipato remoto.

SupabasePatrimonialStore aggiunge assignmentHealth/ownerSyncHealth, mantenendo health() e PATRIMONIAL_STORE_VERSION immutati. Il journal verifica capability prima di inviare getAssignmentContext/commitAssignmentPlan e i quattro command owner. Un assignment plan con ownerOperation richiede anche ownerSync. Errore esplicito PatrimonialCapabilityUnavailableError (sottoclasse PatrimonialStoreUnavailableError, code PATRIMONIAL_CAPABILITY_UNAVAILABLE) in caso di RPC assente/non autorizzata, contract ignoto o capability non supportata. Non vengono inviati i nuovi command; le operazioni legacy non richiedono il probe.

## Matrice app/database verificata localmente

| App | DB | Status | Risultato |
| --- | --- | --- | --- |
| OLD | OLD baseline | SAFE | Health/read/claim legacy funzionanti |
| NEW | OLD baseline senza probe | FAIL_CLOSED | Base health PASS; errore readiness esplicito prima del nuovo journal |
| OLD | FULL nuovo DB | SAFE | Base health v1 e behavior legacy invariati; claim default contatti |
| NEW | P1-only senza probe | FAIL_CLOSED | Non si assume P1 presente dalla sola health base |
| NEW | P1-only con probe adattivo | SAFE | Assignment PASS; owner FAIL_CLOSED prima dei command |
| NEW | P1+P2B senza probe | FAIL_CLOSED | Attendere capability migration |
| NEW | P1+P2B+probe | SAFE | Base/assignment/owner readiness PASS; feature flag invariati |
| NEW | schema parziale con probe | FAIL_CLOSED | Capability interessata null; owner richiede anche assignment |

I due stati P1-only sono distinti: il deployment canonico mantiene bloccati i command fino all'installazione finale del probe; la possibilità diagnostica su P1-only è dimostrata nella matrice, non inventata su un DB dove la RPC manca.

## Readiness matrix

| ITEM | STATUS | EVIDENCE | BLOCKER | NEXT ACTION |
| --- | --- | --- | --- | --- |
| P1 migration | READY | Audit + dry-run popolato PASS, file immutato | Solo approvazione futura | Targeted apply P1 dopo preflight fresco |
| P2B migration | READY | Superset CHECK e preservazione PASS | P1 prima | Targeted apply P2B e controlli |
| Capability migration | READY | Probe adattivo locale A–J PASS | P1/P2B prima nel rollout | Targeted apply finale e verifica read-only |
| Migration order/lineage | READY_WITH_CONDITION | SAFE_WITH_PREFLIGHT; nessuna dipendenza mancante | Vietato db push generico | Usare solo procedura puntuale documentata |
| Existing data compatibility | READY_WITH_CONDITION | Snapshot shape preservata, nessun backfill | Stato remoto può cambiare | Checks freschi prima/dopo ogni apply |
| ACL | READY | Client denied, servizio verificato dal probe | Verifica post-apply | Controllare privilegi effettivi |
| RLS | READY | FORCE RLS e partial negativi | Verifica post-apply | Controllare tabelle target |
| RPC compatibility | READY | Delega legacy e adapter vecchio testati | Nessuno locale | Readiness e legacy probe post-apply |
| Store version | READY | Core v1 invariata, capability additiva | Nessuno locale | Non usare health base come attestazione P1/P2B |
| Deployment order | READY_WITH_CONDITION | Sequenza sotto | Autorizzazione apply separata | Deploy app flag false, poi tre apply puntuali |
| Feature flags | READY_WITH_CONDITION | Exact true/default false, non modificati | Valori remoti non letti | Attestare assignments=false/ownerSync=false |
| Runtime Supabase access | READY_WITH_CONDITION | Factory canonical server, readiness esplicita | Credenziale runtime non provata | Verifica read-only prima di attivare feature |
| Runtime HighLevel token | BLOCKED | Evidenza esterna non equivale a runtime | RUNTIME_TOKEN_NOT_VERIFIED | Prova read-only usando credenziale effettiva |
| Users read | READY_WITH_CONDITION | Shape esterna riferita e mock | GET target/runtime non provato | Verificare id/deleted/membership |
| Location read | READY_WITH_CONDITION | Audit esterno VERIFIED | Runtime non confrontato | Verifica Location canonica con token effettivo |
| Opportunity read | BLOCKED | LOCALLY_VERIFIED_ONLY | OPPORTUNITY_NONEMPTY_READ_UNVERIFIED | Fixture sintetica autorizzata, lookup ID |
| assignedTo decoder | BLOCKED | String/null/missing distinti | ASSIGNEDTO_LIVE_SHAPE_UNVERIFIED | Verifica response non vuota prima del PUT |
| Owner write | BLOCKED | Payload esclusivamente assignedTo | Token/permission/smoke approval | Una write sintetica autorizzata |
| Owner round-trip | BLOCKED | Nessuna write live | OWNER_ROUNDTRIP_UNVERIFIED | Read-back e checkpoint sul sintetico |
| Owner clear | NOT_APPLICABLE | OWNER_CLEAR_UNSUPPORTED | Fuori scope smoke | Nessun clear/null/empty write |
| Race/CAS | READY_WITH_CONDITION | READ→PUT→READ-BACK | REMOTE_CAS_UNVERIFIED; produzione separata | Solo sintetico senza concorrenza umana, un worker/una write |
| Cleanup | READY_WITH_CONDITION | Piano per ID esatti | Permission runtime non provata | Verificare cleanup prima della create sintetica |
| PG17_NATIVE_DRY_RUN | READY_WITH_CONDITION | SQL usa oggetti/funzioni PG17 documentati | Locale PGlite 18.6; Docker daemon assente | PG17 nativo quando disponibile, nessuna installazione ora |

## Ordine futuro — nessuno step eseguito ora

0. Deploy NEW APP capability-aware nell'ambiente designato con feature flags false.
1. Verifica base e lineage/schema/counts/assenza/flag freschi.
2. Targeted apply P1 autorizzata.
3. Verifica P1, preservazione e ACL/RLS.
4. Targeted apply P2B autorizzata.
5. Verifica P2B, dispatcher/claim/checkpoint e dati invariati.
6. Targeted apply runtime capabilities autorizzata.
7. Verifica RPC e base/assignment/owner; legacy app resta compatibile.
8. assignments=false, ownerSync=false; nessun altro gate attivato.
9. Verifica read-only credenziali Supabase/HighLevel effettive runtime, senza leggere/loggare secret qui.
10. Autorizzazione esplicita separata allo smoke sintetico.

PG17 nativo non disponibile: docker.exe esiste ma il daemon locale non risponde, psql/postgres non disponibili. Nessun avvio/installazione sistema. Verificata documentazione PostgreSQL 17 per [STABLE](https://www.postgresql.org/docs/17/xfunc-volatility.html), [catalog inquiry/privileges](https://www.postgresql.org/docs/17/functions-info.html) e [pg_proc](https://www.postgresql.org/docs/17/catalog-pg-proc.html). Nessuna dipendenza da NOT NULL catalog contype=n introdotta in PG18; confronti basati su attnotnull e cataloghi già PG17. Questa è compatibilità documentale e test PG18, non un dry-run PG17 inventato.

## HighLevel e smoke — invariati e non eseguiti

Provider owner separato dal generico, Version/proof v3 documentati; nessuna modifica ai suoi binding. Users/Location/scopes VERIFIED solo nella connessione esterna, non nel token HIGHLEVEL_PRIVATE_TOKEN del runtime. Decoder GET user richiede deleted esplicito e roles.locationIds: omissione → HOLD. GET opportunity non vuoto, assignedTo e round-trip restano non verificati live. Nessun workaround credenziali, capability true o flag aggiunto per aggirare i gate.

Generic search/create/update rimangono CONFIG. Il PUT owner resta solo assignedTo, nessuna create/stage/status/customFields/value/name; release locale e clear unsupported. Nessuna primitiva CAS remota inventata.

Futura fixture: contatto Horyzon QA synthetic; email test Horyzon controllata già approvata. Indirizzo non fornito: fermarsi e chiederlo prima dello smoke. Una opportunity [TEST] Patrimonial Owner Sync <timestamp UTC/run ID>, pipeline Architetto Patrimoniale A01/Nuovo interesse solo se mapping runtime coerente. Nessun tag nuovo; test/synthetic solo se già approvato, nessuna nota necessaria.

Setup/create sintetico richiede autorizzazione e strumento amministrativo dedicato: non abilitare generic sync stub. Un solo worker, opportunity esclusivamente sintetica senza modifiche umane, una owner write e GET immediato, checkpoint e replay senza secondo PUT. Seconda write/reassign richiede scope separato. Produzione richiede una decisione CAS/race distinta; timeout resta read-first.

Cleanup prima della create deve essere possibile e autorizzato: manifest con ID esatti creati, Location e run ID; stop worker; GET per ID e verifica relazione opportunity.contactId; delete solo opportunity sintetica e poi contatto nuovo sintetico, mai search+delete. Tag/notes solo associazioni/ID aggiunti nel run, nessuna definizione globale o oggetto preesistente. Confermare assenza tramite risposta documentata, 401/403/5xx non valgono come assenza. Nessuna cascade presunta; audit Supabase preservato. Mancanza permessi → gestione manuale autorizzata, non workaround nel payload owner.

## Verifiche P2C-B

Lineage offline: nomi/version divergence attesi, dieci hash, schema evidence, assenza P1/P2B nella fotografia, ordine e classificazioni. Runtime capabilities A–J: old/P1/full/probe assente, partial schema/ACL/RLS/trigger/indici/default/routine, old app compatibile, unsupported version e check prima del commit. Dry-run preflight: fixture popolata 4/3/13/4/6 preservata attraverso tutte e tre le migration e claim isolation. Zero network nei verify.

Esiti finali PASS: lineage, runtime capabilities A–J, activation preflight, owner-sync A–AE, owner-readiness, assignment management, persistence, CRM, opportunities, remote mapping; typecheck no-emit con tmp esclusa in memoria; ESLint zero warning e git diff --check. Presentation: PRE-EXISTING BASELINE FAILURE, firme identiche prima/dopo (Evento: Protected baseline changed: src/app/(patrimonial-pilot)/benessere-patrimoniale/percorso-architetto-patrimoniale/page.tsx; Architetto: No behavioral change: src/content/patrimonial-architect-session.ts). Nessuna modifica UI. tmp/ e documento Radar preesistenti esclusi dal commit.

**READY_FOR_REMOTE_MIGRATION_APPROVAL significa soltanto che i blocker locali di lineage/readiness sono rimossi. Non è autorizzazione a eseguire SQL e non abilita HighLevel. Attendere approvazione separata per ciascuna fase remota.**


## Post-approval execution — 18 ottobre 2026

L'autorizzazione remota è stata concessa e la sequenza targeted è stata eseguita con successo sul progetto Horyzon:

1. `patrimonial_assignment_management`
2. `patrimonial_owner_sync`
3. `patrimonial_runtime_capabilities`

Dopo ogni apply sono stati verificati schema, contatori legacy, RLS/privilegi e invarianti. Il probe finale remoto restituisce `base=patrimonial-v2-store-1`, `assignmentManagement=p1-v1`, `ownerSync=p2b-v1`. I dati legacy osservati nel preflight sono rimasti invariati e nessun owner effect è stato creato automaticamente.

La credenziale HighLevel runtime è stata poi configurata esclusivamente sul Preview branch e verificata dal runtime Vercel con users/location/opportunity GET. Un synthetic provider smoke autorizzato ha inoltre verificato una sola owner write `assignedTo` e read-back. HighLevel v3 omette il campo `assignedTo` quando l'opportunity è unassigned; questa shape live ha richiesto una correzione fail-closed del decoder prima della write. Gli oggetti HighLevel sintetici sono stati eliminati per ID esatti e la route temporanea è stata rimossa.

Lo stato non è ancora `READY_FOR_PRODUCTION`: restano inattivi i feature flag e non è ancora stato eseguito live il percorso completo assignment → outbox → worker → checkpoint Supabase. La race remota senza CAS e owner clear restano limiti dichiarati.


## P2D — worker/checkpoint live verified

Successivamente al provider smoke è stato eseguito il test end-to-end del percorso P2B usando Preview e una chiave Supabase server temporanea dedicata.

PASS:

- capability health Supabase remoto;
- synthetic intent/opportunity identity;
- createOperator e assignProspect;
- enqueue e claim di una sola ASSIGN_OPPORTUNITY_OWNER;
- authorizeOwnerWrite persistito prima della dispatch;
- una sola PUT HighLevel assignedTo;
- GET read-back indipendente;
- finishOwnerOperation e checkpoint Supabase;
- seconda esecuzione idempotente senza nuova write;
- cleanup locale audit-preserving;
- cleanup HighLevel per ID esatti.

Il checkpoint finale ha owner_ref/ownerId/remote.assignedTo coerenti e owner_checkpoint_revision=1. Prima del cleanup la business revision è rimasta invariata. Production e feature flag restano non attivati; nessun CAS remoto né owner-clear è stato introdotto o assunto.
