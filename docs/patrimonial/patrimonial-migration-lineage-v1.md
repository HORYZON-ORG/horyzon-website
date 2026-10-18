# Patrimonial migration lineage v1 — P2C-B

18 ottobre 2026. Baseline repo/branch: HORYZON-ORG/horyzon-website, feat/patrimonial-pilot-funnels, 5b8a997f83c296c6cac4a319df18568e6273be9e. Strategia approvata: MANAGED / TARGETED MIGRATION APPLICATION. Nessun apply, history repair, db push o scrittura remota effettuato.

## Classificazione operativa

- genericDbPush: UNSAFE
- targetedExplicitApply: SAFE_WITH_PREFLIGHT
- NO_HISTORY_REPAIR: non modificare Supabase schema_migrations, non creare fake entries, non eseguire migration repair.
- NO_BASELINE_REEXECUTION: non rieseguire baseline già presenti per la sola differenza di timestamp.

Per questa sequenza NON usare supabase db push come rollout automatico finché la lineage globale del repository non è riconciliata. Non rinominare o modificare le migration storiche. Il drift globale resta presente: la remediation definisce un metodo puntuale sicuro, non lo cancella.

## Identità logica e prova

| File/versione locale | Versione remota P2C-A | Nome logico | Equivalenza rilevante | Strategia |
| --- | --- | --- | --- | --- |
| 20261014225059_patrimonial_lead_v2.sql | 20261014215416 | patrimonial_lead_v2 | Colonne/default/nullability rilevanti, vincoli e routine base confrontati in P2C-A | Già installata: non rieseguire |
| 20261015100912_patrimonial_opportunity_jsonb_precedence.sql | 20261015101816 | patrimonial_opportunity_jsonb_precedence | Hash dei corpi delle 10 routine effettive identici dopo il forward fix | Già installata: non rieseguire |

La corrispondenza è nome logico + evidenza di schema/routine, non timestamp. La fotografia P2C-A (scripts/fixtures/patrimonial-preflight-evidence.json) contiene solo metadati e aggregati non PII. L'equivalenza verificata è limitata agli oggetti patrimoniali rilevanti: non certifica tutto il DDL storico o prodotti diversi. La verifica offline ricalcola i 10 hash dalle migration locali immutate. Il dry-run preflight confronta colonne e vincoli effettivi nel database effimero.

Altri 15 file locali hanno timestamp divergenti; la history remota contiene anche migration platform/social e Radar non presenti localmente. Non applicare quelle migration come effetto collaterale di questo rollout. Nessuna riconciliazione globale o riparazione richiesta per il targeted apply approvabile di questi tre SQL.

## Unica sequenza futura autorizzabile

P1 → P2B → CAPABILITIES

1. 20261018094926_patrimonial_assignment_management.sql
2. 20261018163245_patrimonial_owner_sync.sql
3. 20261018180107_patrimonial_runtime_capabilities.sql

P1/P2B sono assenti per nome e versione nella fotografia P2C-A; nessuna delle loro tabelle, colonne o routine nuove risulta presente. La nuova capability migration è locale e mai applicata. Non esiste una quarta migration intermedia necessaria a questa sequenza. I file P1/P2B restano byte-identici.

Targeted apply significa eseguire soltanto il contenuto SQL esatto del singolo file revisionato, con nome logico esplicito, digest del file e autorizzazione di quel passo. Una futura apply_migration managed può registrare la versione realmente restituita dallo strumento, anche diversa dal filename: registrarla come lineage vera, mai simulare timestamp locali. In alternativa, SQL transazionale esplicito richiede un manifest amministrativo approvato con digest/esito/oggetti; non inserire voci fittizie in history. Scelta e autorizzazione del meccanismo concreto precedono il primo apply. Questo documento non è un runner e non esegue nessuna delle alternative.

Ogni file contiene BEGIN/COMMIT: usare un executor managed che supporti il file integrale e rollback su errore. Non spezzare CREATE/ALTER/grants in chiamate non atomiche. Se l'executor non garantisce questa semantica, STOP prima dell'apply e scegliere il meccanismo transazionale documentato. Non retry automatico dopo ACK incerto: rileggere schema/history/manifest per nome e digest prima di qualsiasi nuova esecuzione.

## PRE_APPLY_CHECKS — obbligatori per ciascun passo

- Snapshot fresco: project identity, history completa, versione/nome logico del file assenti. Per P2B/capability, predecessori presenti e riconosciuti tramite schema/digest, anche con timestamp diversi.
- Oggetti target assenti: inventario completo di tabelle/colonne/funzioni/indici nuovi di quel file; niente installazione parziale. Per la capability migration verificare assenza delle due RPC patrimonial_store_capabilities e patrimonial_capability_objects. Se qualcosa esiste, STOP: non CREATE OR REPLACE, repair o replay cieco.
- Baseline schema e hash coerenti con la lineage approvata; verificare anche wrapper e helper dei predecessori dopo ciascun passo.
- Row counts e invarianti correnti in sole aggregazioni: intent/request/outbox/event/consent, owner nullable, JSON/native, revision/lease/effect e reconciliation. Nessun record reale esportato o corretto per farlo passare.
- Attestare assignments=false e ownerSync=false nell'ambiente designato senza stampare secret. Niente nuove attivazioni crm/opportunity/booking/messages/webhook.
- Digest del file locale e contenuto approvati, escluso qualsiasi altro SQL; backup/recupero secondo procedura amministrativa già autorizzata, senza purge o data fix impliciti.

## POST_APPLY_CHECKS — prima del passo successivo

- Schema/object verification: colonne/default/nullability/FK/CHECK/trigger/indici attesi; tutti i vincoli validi, funzioni/versioni corrette.
- Grants e RLS: INVOKER, search_path fissato, service_role only, anon/authenticated senza EXECUTE/direct write, FORCE RLS sulle nuove tabelle.
- Counts e dati legacy invariati; nessun owner autoassegnato o operation reinterpretata. Singleton tecnico P1 previsto; nessun seed persone, backfill o reset.
- RPC legacy health/readiness coerenti. Dopo P1/P2B ma prima del probe, nuova app rimane indisponibile per i nuovi command: comportamento voluto.
- Dopo capability: base v1 invariata, assignmentManagement=p1-v1 e ownerSync=p2b-v1 solo su schema completo; test negativo partial e claim isolation già provati localmente.
- Manifest del passo con nome logico, filename locale, digest, versione remota effettiva se managed, oggetti ed esito verifiche; nessun valore token o dato cliente.

Un errore, oggetto parziale, drift inatteso, invariant failure o ACK incerto interrompe la sequenza. Non correggere dati/history automaticamente e non proseguire verso HighLevel.

## Probe adattiva e dipendenze

Scelta confermata dall'utente in P2C-B: la RPC è installabile a scopo diagnostico anche su baseline/P1-only e rileva oggetti reali. Senza P1/P2B non abilita alcuna nuova feature; su P1-only abilita soltanto assignment; owner dipende sempre da P1 + P2B completi. Non certifica capability perché il file è installato. L'ordine operativo remoto resta strettamente P1 → P2B → CAPABILITIES. Le installazioni anticipate esistono solo nelle fixture della matrice locale, non sono un rollout remoto alternativo autorizzato.

## Stato finale

MIGRATION_HISTORY_DRIFT come impedimento al metodo di applicazione: RESOLVED_BY_MANAGED_TARGETED_STRATEGY. Lo storico non è stato alterato e il drift globale non è dichiarato risolto. STORE_HEALTH_CAPABILITY_GAP: risolto dal controllo additivo, verificato separatamente. Il massimo stato è READY_FOR_REMOTE_MIGRATION_APPROVAL, mai READY_FOR_LIVE.

Restano necessarie autorizzazioni remote specifiche e smoke separato; RUNTIME_TOKEN_NOT_VERIFIED, OPPORTUNITY_NONEMPTY_READ_UNVERIFIED, ASSIGNEDTO_LIVE_SHAPE_UNVERIFIED, OWNER_ROUNDTRIP_UNVERIFIED, OWNER_CLEAR_UNSUPPORTED e REMOTE_CAS_UNVERIFIED non sono risolti da questa lineage. PG17_NATIVE_DRY_RUN è READY_WITH_CONDITION: locale PGlite 18.6, remoto 17.6, nessun PG17 nativo utilizzabile senza avviare/installare servizi. SQL usa cataloghi/funzioni documentati PG17; nessun contype=n PG18 richiesto.


## Addendum corrente — post P2D / P3

Il testo precedente conserva la diagnosi P2C-B al momento in cui fu scritto. Stato effettivo successivo, verificato il 18 ottobre 2026:

- P1 patrimonial_assignment_management: installata remoto via managed targeted apply; versione remota effettiva 20261018184007.
- P2B patrimonial_owner_sync: installata remoto via managed targeted apply; versione remota effettiva 20261018184045.
- runtime capabilities: installata remoto via managed targeted apply; versione remota effettiva 20261018184114.
- P2D owner worker/checkpoint: synthetic smoke end-to-end PASS.
- Nessuna history repair, nessun generic db push, nessuna riesecuzione delle baseline con timestamp divergenti.

Nuova migration P3 locale:

20261018224500_patrimonial_performance_tracking.sql

Stato: LOCAL_ONLY / NOT_APPLIED_REMOTE.

P3 dipende dalla fondazione P1 già installata e aggiunge esclusivamente ledger performance, vista analitica e RPC/capability dedicate. Non modifica P1/P2B/capability migration storiche e non richiede rinomina o repair di quelle versioni.

### Rollout P3 autorizzabile separatamente

La futura sequenza remota per P3 è un solo targeted apply del file 20261018224500_patrimonial_performance_tracking.sql, dopo nuovo preflight. Non usare supabase db push.

Preflight minimo:

1. rileggere project identity e migration history;
2. verificare presenti e sane le capability P1/P2B già installate;
3. verificare assenza di patrimonial_performance_events, patrimonial_assignment_performance_v1 e delle quattro RPC P3;
4. catturare counts legacy e counts assignment/operator senza PII;
5. verificare che PATRIMONIAL_PERFORMANCE_TRACKING_ENABLED non sia attivo negli ambienti target;
6. applicare soltanto P3 con autorizzazione esplicita;
7. verificare RLS/FORCE RLS, grants service-role only, trigger immutabilità/attribution e performanceTracking=p3-v1;
8. verificare zero backfill: la migration non crea eventi performance da storico, note, messaggi o domain events esistenti.

ACK incerto, oggetto P3 preesistente, drift inatteso o invariant failure => STOP. Nessun retry automatico e nessuna correzione dati/history.
