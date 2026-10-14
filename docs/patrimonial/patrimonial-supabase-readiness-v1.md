# Patrimonial Supabase readiness v1 — FASE 2B.2B-4B

Data: 14 ottobre 2026, Europe/Rome. Repo canonica: `HORYZON-ORG/horyzon-website`.
Branch: `feat/patrimonial-pilot-funnels`. Baseline: `2a2432ce26ced04a1341b13430b8ff30891b7b06`.

**Esito: NOT_READY per l'apply remoto.** Verifiche statiche e simulazioni locali superate; restano i gate PostgreSQL/ambiente/privilegi descritti in §15. La migration non è stata applicata e questo documento non ne autorizza l'applicazione. Zero chiamate remote, ispezioni delle configurazioni di produzione, messaggi, push, deploy o merge. Solo questo documento viene creato; codice, migration e `tmp/` restano invariati.

## 1. Migration summary

Candidata: [20261014225059_patrimonial_lead_v2.sql](../../supabase/migrations/20261014225059_patrimonial_lead_v2.sql), 667 righe non contando la riga vuota finale. SHA-256 del contenuto UTF-8 con terminatori normalizzati LF:

```text
5680a1d16f2cb0c136e5033f765b3e4242aa8ba1b11995e8fb816ff14b947cbb
```

Il contenuto corrisponde alla baseline. Sono previsti sette nuovi oggetti tabella, dieci funzioni, 19 indici espliciti, sette PK, otto vincoli UNIQUE e 13 FK. Gli indici attesi complessivi sono 34: 19 espliciti più quelli di sette PK e otto UNIQUE. Non contiene ALTER su tabelle di altri prodotti, seed di edizioni, purge, scheduler, subscription webhook o effetti di rete. `BEGIN`/`COMMIT` racchiudono DDL e privilegi; una failure deve annullare l'intera applicazione.

Fonti rilette: [AGENTS.md](../../AGENTS.md), [DESIGN.md](../../DESIGN.md), [contratto patrimoniale](patrimonial-highlevel-contract-v1.md), migration candidata, [adapter Supabase](../../src/lib/public-leads/patrimonial-supabase.ts), [factory/interfacce](../../src/lib/public-leads/patrimonial-store.ts), [routing](../../src/lib/public-leads/patrimonial-routing.ts), [handler](../../src/lib/public-leads/handler.ts), tutte le 17 migration precedenti e i pattern Annunci/Radar/AI Score. I vincoli correnti di questa fase prevalgono sulla precedente autorizzazione generica al push riportata in DESIGN.md.

## 2. Schema

Schema target: `public`, coerente con Annunci e AI Score. Radar usa invece `hub`; non trasferire quel profilo nell'adapter patrimoniale.

| Tabella dedicata | Identità e finalità | Relazioni principali |
| --- | --- | --- |
| `patrimonial_intents` | PK UUID; separa PROVISIONAL e OPPORTUNITY, gruppo/ciclo/revisione/stage, prossimo passo e checkpoint sync | Nessuna FK verso sessioni/entitlement di altri prodotti |
| `patrimonial_requests` | PK request UUID, hash, snapshot validato, ricevuta, scadenza replay | `intent_id` nullable verso intents |
| `patrimonial_consent_evidence` | PK UUID interno; evidence_key mantiene l'ID logico request:purpose | request obbligatoria, intent nullable con collegamento differito |
| `patrimonial_event_editions` | PK UUID interno, edition_key logica distinta, date/fuso/revisione/snapshot | Nessuna edizione iniziale; nessun calendario remoto |
| `patrimonial_participations` | PK UUID, registrazione/presenza/revisione; una relazione E può avere più partecipazioni | intent, edition nullable, source_request obbligatoria |
| `patrimonial_outbox_operations` | PK UUID, effetto/versione/richiesta, dipendenze, tentativi, token/versione/scadenza lease | intent, request nullable, self-FK depends_on |
| `patrimonial_domain_events` | PK UUID e event_key logica, audit con metadati selezionati | intent, request/participation nullable, self-FK supersedes_event_id |

Tutte le 13 FK puntano a PK UUID delle sette tabelle dedicate; non risultano riferimenti a tabelle Annunci/Radar/AI Score. La FK evento → participation è `DEFERRABLE INITIALLY DEFERRED`, coerente con audit e partecipazione salvati nella stessa transazione. Le altre sono immediate. Non è previsto `ON DELETE CASCADE`: il futuro trattamento della retention dovrà rispettare i legami, senza cancellazioni automatiche.

Le FK verso intent non distinguono da sole PROVISIONAL/OPPORTUNITY: dispatcher e routing controllano il tipo. `record` JSONB conserva i contratti TypeScript, con colonne relazionali per vincoli, ricerca e lease. Le CHECK verificano parte della coerenza; non sostituiscono la validazione dominio del chiamante server. Le risposte aperte restano negli snapshot necessari al worker, senza copia nei metadati audit o nei log.

Gli ID nativi HighLevel sono nullable e non vengono inventati. Il contact_ref interno è derivato da location/contatto risolti, mentre le chiavi provvisorie non equivalgono a un'identità verificata. La tabella edizioni richiede un'operazione futura esplicita per cambiare uno snapshot già registrato; oggi dati differenti sulla stessa edition_key sono rifiutati.

## 3. RPC

Tutte le funzioni sono nello schema `public`, `SECURITY INVOKER`, `search_path = pg_catalog, public`. Non sono presenti SECURITY DEFINER.

| Funzione e firma | Risultato | Impiego |
| --- | --- | --- |
| `patrimonial_store_health()` | jsonb | Versione/schema/letture minime |
| `patrimonial_store_transaction(jsonb,jsonb,boolean)` | jsonb | Journal, expected values, preview o commit |
| `acquire_patrimonial_request_v2(jsonb,jsonb)` | jsonb | Commit acquisizione tramite il runner, senza preview |
| `patrimonial_execute_command(jsonb)` | jsonb | Dispatcher dei metodi dello store |
| `patrimonial_put_operation(jsonb)` | void | Snapshot e colonne outbox nello stesso statement |
| `claim_patrimonial_operations(jsonb,jsonb)` | jsonb | Selezione atomica e token generati dal server applicativo |
| `patrimonial_owned_operation(jsonb)` | jsonb | Verifica claim corrente |
| `renew_patrimonial_operation_lease(jsonb)` | void | Rinnovo di lease valida |
| `complete_patrimonial_operation(jsonb)` | void | Completion/checkpoint/follow-up atomici |
| `fail_patrimonial_operation(jsonb)` | void | Failure sanificata/manual review |

L'adapter chiama via REST soltanto health, runner e acquire. Gli altri nomi sono helper eseguiti dal dispatcher, pur essendo funzioni nello schema esposto: anche per essi EXECUTE deve essere consentito soltanto al ruolo server. Non vanno presentati come API browser.

La preview esegue il journal in un blocco PL/pgSQL con eccezione controllata `PZ001`: dati e lock del blocco vengono annullati e i risultati calcolati sono restituiti. Il commit ricontrolla i risultati già osservati tramite `p_expected`. Acquisizioni incomplete, con consensi/outbox/evento mancanti, sono rifiutate anche dal runner generico. Non esiste fetch esterna dentro SQL o callback transazionale.

Claim: namespace advisory `(741920,2)`, `FOR UPDATE SKIP LOCKED`, filtro scadenza e dipendenze, serializzazione per identity_lock_key, massimo cinque tentativi. Ogni mutazione outbox controlla stato SYNCING, token, lease_version e scadenza sull'orologio DB. Una lease scaduta viene ripresa con riconciliazione; non autorizza una seconda create remota. Il sync opportunity conserva token, scadenza e dispatch marker in intents e verifica anche expectedRevision. I lock durano una RPC, senza coprire la successiva fetch provider.

## 4. Index

Gli ID risolti e scope necessari sono obbligatori per OPPORTUNITY: gli UNIQUE non possono essere aggirati mediante NULL su contatto/location/scope. Il generico Evento è gestito con un indice parziale separato.

| UNIQUE esplicito | Colonne | Predicato/invariante |
| --- | --- | --- |
| `patrimonial_architect_open` | location_ref, remote_contact_id, scope_key | OPPORTUNITY + architect-path + OPEN; una aperta per programma, anche tra cicli |
| `patrimonial_event_relationship` | location_ref, remote_contact_id | OPPORTUNITY + patrimonial-event; una relazione anche dopo chiusura, riapertura esplicita della stessa riga |
| `patrimonial_consultation_open` | location_ref, remote_contact_id, scope_key | OPPORTUNITY + patrimonial-consultation + OPEN; una aperta per finalità |
| `patrimonial_business_cycle` | business_key, cycle | Solo OPPORTUNITY |
| `patrimonial_participation_edition` | location_ref, contact_ref, edition_id | edition_id non NULL; nessuna seconda partecipazione per la stessa edizione |
| `patrimonial_participation_generic` | location_ref, contact_ref, event_slug | edition_id NULL + PENDING_EDITION; nessun secondo generico attivo |

Gli otto UNIQUE dichiarati sulle tabelle sono: intents.provisional_key e group_key; consent.evidence_key e (request_id,purpose); editions.edition_key; outbox.operation_key e (intent_id,effect_type,effect_version); events.event_key. Per outbox effect_version riceve l'operationKey comprensiva di request ID: una nuova richiesta può quindi generare una nuova nota, preservando deduplica del retry.

Gli altri 13 indici espliciti sono `patrimonial_intents_review`, `patrimonial_requests_intent`, `patrimonial_requests_retention`, `patrimonial_participations_intent`, `patrimonial_participations_source`, `patrimonial_outbox_due`, `patrimonial_outbox_identity`, `patrimonial_outbox_request`, `patrimonial_outbox_dependency`, `patrimonial_events_intent`, `patrimonial_events_request`, `patrimonial_events_participation`, `patrimonial_events_supersedes`.

Coprono legami, coda, dipendenze e marker retention. Non sono disponibili EXPLAIN o misure di carico PostgreSQL; la correttezza statica degli indici non dimostra prestazioni della coda.

## 5. RLS

Il blocco finale della migration abilita e forza RLS sulle sette tabelle tramite allowlist esplicita. Non crea policy per public, anon o authenticated. Le funzioni invoker conservano i limiti del ruolo chiamante.

Il percorso previsto richiede un service_role effettivamente autorizzato a superare RLS, oltre ai grant sugli oggetti. Il solo nome del ruolo o la presenza della variabile non lo dimostrano. Con FORCE RLS e nessuna policy, un ruolo privo di BYPASSRLS non soddisfa questo percorso. Verificare attributi e ruolo assunto dalla Data API; non risolvere eventuali errori concedendo accesso ai browser o convertendo le RPC in definer.

## 6. Grants

| Oggetto | Privilegi previsti per service_role | Browser/public |
| --- | --- | --- |
| Requests, intents, editions, participations, outbox | SELECT, INSERT, UPDATE | REVOKE ALL a PUBLIC, anon, authenticated |
| Consent evidence | SELECT, INSERT; UPDATE soltanto della colonna intent_id | Stessa revoca |
| Domain events | SELECT, INSERT | Stessa revoca |
| Tutte le dieci funzioni | EXECUTE | REVOKE ALL a PUBLIC, anon, authenticated |

Non è presente un GRANT pubblico accidentale nel testo SQL. La migration non richiede sequence grant: gli ID usano UUID. La USAGE di `public` per service_role è già prevista dalla migration `20260922130000_grant_ai_score_runtime_schema_usage.sql`; applicazione reale e privilegi effettivi restano da verificare.

**Gate ACL:** la candidata revoca public/anon/authenticated ma non azzera prima i grant già eventualmente assegnati a service_role dai default ACL del creatore. Un GRANT aggiunge privilegi, non restringe quelli esistenti. Se i default concedono UPDATE generale su consent/events o DELETE, i GRANT limitati non li rimuovono. Non è stato riscontrato questo stato remoto: è una verifica obbligatoria ancora aperta, specialmente per la promessa append-oriented. Esaminare pg_default_acl, ACL di tabelle/colonne/funzioni e membership del ruolo. Se l'effettivo set eccede quello approvato, fermare il piano e preparare una correzione separatamente autorizzata; non dichiarare least privilege solo dal sorgente.

## 7. Adapter compatibility

REST server-side `/rest/v1/rpc/<nome>`, profili Accept/Content `public`, apikey service role; per chiave JWT anche Authorization Bearer, per chiavi `sb_` comportamento coerente con il runtime AI Score. Costruttore rifiuta chiavi publishable e URL non ammessi; timeout 10 secondi, redirect vietati, cache disabilitata, errori senza corpo provider o secret. Le variabili reali non sono state lette.

| Metodi TypeScript | Dispatcher/helper SQL |
| --- | --- |
| createOrReplayRequest | Lookup/hash/scadenza e INSERT requests; commit finale acquire |
| getRequest, getOperation, getConsentEvidence | Proiezioni JSONB; consensi ordinati per purpose |
| createOrReuseIntent, attachIntent | Riuso provisional_key, legame request/intento/evidenze |
| appendConsentEvidence, appendEvent, enqueueOperation | Insert dedicati e chiavi di deduplica |
| claimOperations, renewLease | claim_patrimonial_operations con tokens; renew_patrimonial_operation_lease |
| completeOperation, completeCrmOperation | complete_patrimonial_operation; checkpoint/remote ID/dipendenze nello stesso commit |
| failOperation, markManualReview | fail_patrimonial_operation con stato esplicito |
| scheduleRetry, holdOperation | Dispatcher con validazione lease; retry incerto vietato |
| findOpportunityIntent, getOpportunityIntent, saveOpportunityIntent | Lookup group_key/id, CAS revision, snapshot/audit e invalidazione claim obsoleto |
| listParticipations, saveParticipations | Proiezioni ordinate per UUID, verifica snapshot/revisioni, mapping edition_key → UUID interno |
| claimOpportunitySync, authorizeOpportunityWrite, finishOpportunitySync | CAS revisione + token/scadenza; dispatch marker e checkpoint persistenti |

Sono presenti tutti i 25 command name emessi dall'adapter e le firme dei tre endpoint REST corrispondono ai payload. Snapshot cambiato produce PT409/PATRIMONIAL_SNAPSHOT_CHANGED e fino a quattro esecuzioni del callback; conflitto hash/revisione e stale lease sono distinti. Replay scaduto produce PT410. Esito commit ambiguo: unavailable/503 e riuso dello stesso request ID, senza retry automatico del commit.

La factory richiede readiness esplicita e URL/chiave; non costruisce memory e non ripiega su 2A. Health attesa: versione `patrimonial-v2-store-1`. La funzione health risolve colonne e SELECT LIMIT 0 sulle sette tabelle: **non dimostra INSERT/UPDATE, correttezza dei rami PL/pgSQL o passaggio dati sotto RLS**. Serve lo smoke test §11 prima di abilitare intake.

## 8. Migration order

Lettura programmatica di tutti i file SQL locali, scansione nomi/namespace/privilegi/dipendenze e riesame dei pattern pertinenti: 18 file complessivi, 17 precedenti, nessun successivo o timestamp duplicato. Nessuno dei nomi di tabella, indice o funzione nuovi compare nelle precedenti; nemmeno il namespace advisory `(741920,2)` risulta già utilizzato nel codice SQL precedente.

| Ordine | Migration precedente |
| --- | --- |
| 1 | 20260922041000_ai_score_runtime_store.sql |
| 2 | 20260922130000_grant_ai_score_runtime_schema_usage.sql |
| 3 | 20260922195436_annunci10x_persistence.sql |
| 4 | 20260922195633_annunci10x_fk_indexes.sql |
| 5 | 20260926153000_annunci10x_analysis_runs.sql |
| 6 | 20260926172000_annunci10x_lead_verification.sql |
| 7 | 20260926183000_annunci10x_email_verification_hardening.sql |
| 8 | 20260926194000_annunci10x_email_verification_cleanup.sql |
| 9 | 20260926203000_annunci10x_v2_public_score.sql |
| 10 | 20260928113000_annunci10x_score_report_email_deliveries.sql |
| 11 | 20260928143000_annunci10x_stripe_commerce_foundation.sql |
| 12 | 20260928180000_annunci10x_generation_credit_reservations.sql |
| 13 | 20260928193000_annunci10x_optional_lead_context.sql |
| 14 | 20260929101224_paid_radar_foundation.sql |
| 15 | 20260930122252_radar_owner_hourly_profit.sql |
| 16 | 20260930170000_radar_report_advice.sql |
| 17 | 20261006120000_radar_v3_owner_context.sql |

La candidata occupa l'ordine 18. `20261014225059` è una versione valida di 14 cifre, successiva alla precedente; il filename non attesta un fuso UTC o la data di applicazione. Nessuna migration storica è modificata, riordinata o proposta per replay automatico.

Dipendenze: schema public e ruoli Supabase preesistenti; PL/pgSQL; funzioni native gen_random_uuid, jsonb, advisory lock, pg_timezone_names, md5 e cataloghi. La candidata non usa `extensions.gen_random_uuid`, non crea estensioni e non dipende da pgcrypto per i propri UUID: va verificata la disponibilità di `pg_catalog.gen_random_uuid()` nel PostgreSQL target (core da PostgreSQL 13). Tutte le altre dipendenze applicative sono create nello stesso file prima del loro uso operativo. Il dispatcher PL/pgSQL precede alcuni helper: la validazione statica non prova la risoluzione dei corpi SQL al primo utilizzo; lo smoke dovrà percorrere quei rami.

La history locale non certifica quella remota. `supabase/config.toml` non risulta presente: non c'è una configurazione locale che dimostri progetto collegato o schema esposto. Non dedurre il target dai riferimenti di altri prodotti.

## 9. Pre-flight

Checklist futura, **non eseguita sul remoto in questa fase**. Registrare l'evidenza in un verbale operativo protetto, senza credenziali, PII o valori env nel repository.

- [ ] Ottenere autorizzazione separata al target e all'apply; rivalutare §15 dopo chiusura blocker.
- [ ] Confrontare organizzazione/project ref/ambiente con il target approvato, verificando che URL e service key appartengano allo stesso progetto. Il nome database da solo non identifica il progetto.
- [ ] Confermare ambiente di prova prima di produzione e versione PostgreSQL; validare la candidata su PostgreSQL isolato compatibile con ruoli Supabase, senza attivare CRM o messaggi.
- [ ] Verificare backup/snapshot recente, punto di ripristino, responsabile, accessibilità e procedura di restore verificata; annotare orari e perimetro, senza eseguire un restore sul progetto condiviso.
- [ ] Acquisire migration history remota, confrontare le 17 versioni precedenti, rilevare modifiche manuali e confermare assenza della versione candidata. Drift o altre migration pending fermano il piano; niente applicazione cumulativa automatica.
- [ ] Verificare assenza di tutti i nuovi nomi in pg_class/pg_proc, incluse overload, indici e oggetti creati manualmente. CREATE non è IF NOT EXISTS: una collisione richiede riconciliazione, non DROP o rinomina cieca.
- [ ] Verificare public, PL/pgSQL, gen_random_uuid, ruoli, USAGE, BYPASSRLS, default ACL del ruolo che creerà gli oggetti, membership e privilegi delegati.
- [ ] Verificare Data API abilitata, public esposto, ruolo assunto dalla service key e possibilità di eseguire le tre RPC dal runtime server; nessun accesso browser necessario.
- [ ] Verificare logging/redazione, orologi app/DB e assenza di trigger/webhook globali che possano inviare dati o messaggi dalle nuove tabelle.
- [ ] Mantenere tutti i flag patrimoniali e readiness disabilitati; fermare eventuali invocazioni worker e attendere gli effetti in volo. L'apply non deve abilitarli.
- [ ] Congelare baseline e checksum; approvare piano che contenga esclusivamente questa candidata, con rollback §12 e finestra operativa.

Query di sola lettura da eseguire **solo in una successiva verifica remota autorizzata**, senza riportare dati sensibili:

```sql
select current_database(), current_user, version();
select to_regnamespace('public'), to_regprocedure('pg_catalog.gen_random_uuid()');
select rolname, rolbypassrls, rolsuper from pg_roles
where rolname in ('service_role','anon','authenticated');
select has_schema_privilege('service_role','public','USAGE');
select to_regclass('supabase_migrations.schema_migrations');
-- Eseguire solo se la relazione di history esiste:
select version from supabase_migrations.schema_migrations order by version;
-- Esaminare i default del ruolo effettivo di creazione, senza modificarli:
select pg_get_userbyid(defaclrole) as creator, defaclnamespace::regnamespace,
       defaclobjtype, defaclacl from pg_default_acl;
```

## 10. Apply checklist

Nessuna istruzione di questa sezione è stata eseguita. Il futuro operatore deve prima chiudere §9 e ottenere autorizzazione.

1. Confermare checksum §1, baseline e che il piano dello strumento di migration verificato comprenda solo `20261014225059_patrimonial_lead_v2.sql`. Non lanciare comandi generici che applichino anche le migration pendenti di altri prodotti.
2. Applicare il file integralmente nel target approvato, tramite procedura che registri correttamente la history. Non eseguirlo come SQL ad hoc ignorando la history. Conservare esito transazionale e audit; al primo errore fermarsi, senza replay automatico.
3. Confrontare sette tabelle e colonne con §2; verificare sette PK, otto UNIQUE e tutte le 13 FK validate, compresa la sola FK participation dell'audit differita. Edizioni e dati business devono essere vuoti prima dello smoke.
4. Verificare dieci funzioni, firme, invoker e search_path di §3. Confrontare i 19 indici espliciti e quelli di supporto a PK/UNIQUE, per totale atteso 34, con indici validi e predicati corretti.
5. Verificare RLS e FORCE RLS su tutte le tabelle e assenza di policy/grant browser aggiunti. Controllare ACL effettivi, default ereditati e privilegi a livello colonna di §6; non limitarsi a contare i GRANT nel file.
6. Verificare USAGE service_role e negazione di EXECUTE ai ruoli browser su tutte le dieci funzioni. Eventuali privilegi extra o appartenenze inattese fermano l'abilitazione.
7. Verificare history con una sola nuova versione e nessun cambiamento alle versioni precedenti. Aggiornare/verificare la cache dello schema PostgREST se necessario: la candidata non include un NOTIFY esplicito, presente in alcune migration precedenti. Eseguire un eventuale reload solo secondo la procedura autorizzata.
8. Verificare health dal vero runtime server e poi lo smoke completo §11; flag pubblici e worker restano spenti. L'esito dell'apply non costituisce autorizzazione all'intake o alle scritture CRM.

Query di catalogo per i controlli successivi; **non eseguite qui**:

```sql
select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname like 'patrimonial\_%' escape '\'
  and c.relkind in ('r','p') order by c.relname;

select tablename, indexname, indexdef from pg_indexes
where schemaname='public' and tablename like 'patrimonial\_%' escape '\'
order by tablename,indexname;

select c.relname, k.conname, k.contype, k.convalidated,
       k.condeferrable, k.condeferred, pg_get_constraintdef(k.oid)
from pg_constraint k join pg_class c on c.oid=k.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname like 'patrimonial\_%' escape '\'
order by c.relname,k.conname;

select p.oid::regprocedure, p.prosecdef, p.proconfig, p.proacl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and (p.proname like 'patrimonial\_%' escape '\'
       or p.proname in ('claim_patrimonial_operations',
         'renew_patrimonial_operation_lease','complete_patrimonial_operation',
         'fail_patrimonial_operation','acquire_patrimonial_request_v2'));

-- La lettura raw degli ACL va integrata con privilegi effettivi/membership.
select c.relname, c.relacl from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname like 'patrimonial\_%' escape '\'
  and c.relkind in ('r','p');
select has_table_privilege('service_role',
         'public.patrimonial_consent_evidence','UPDATE') as full_consent_update,
       has_column_privilege('service_role',
         'public.patrimonial_consent_evidence','intent_id','UPDATE') as link_update,
       has_column_privilege('service_role',
         'public.patrimonial_consent_evidence','record','UPDATE') as content_update;
```

Per la matrice §6, full_consent_update/content_update devono essere negati e link_update consentito. Ripetere i controlli SELECT/INSERT/UPDATE/DELETE ed EXECUTE per ogni oggetto e per PUBLIC/anon/authenticated, incluse ACL delle colonne; proacl/relacl da soli non dimostrano i privilegi effettivi. Verificare anche indisvalid/indisready in pg_index per gli indici censiti.

## 11. Smoke test

**Eseguito ora, senza DB:** `npm run test:patrimonial-persistence` PASS, 27 casi obbligatori e aggiuntivi. Include controllo statico migration e regressioni ledger A–P, adapter contatti, 30 casi opportunity, legacy/2A/Radar. Un audit statico indipendente su tutti i file SQL ha confermato nomi, ordine, 13 riferimenti a PK UUID, firme e inventario indici. Nessun parser/runtime PostgreSQL è stato invocato: le fixture non eseguono i corpi PL/pgSQL.

| Sequenza logica simulata | Riscontro locale |
| --- | --- |
| Create request + consent evidence + intent + outbox + domain event | Un solo commit confermato; errori su consensi, intent, outbox o commit senza ricevuta ok |
| Replay / conflict | Stesso UUID/hash restituisce ricevuta; hash diverso 409; concorrenza senza doppia acquisizione |
| Create/reuse intent A/E/C | Unicità e revision conflict; E riusata tra edizioni |
| Create participation | Edizioni differenti ammesse; duplicato stessa edizione rifiutato; generico e UUID interno distinti |
| Claim / renew / expiry | Un solo worker, rinnovo, nuovo token/versione su ripresa, riconciliazione e fencing dello stale worker |
| Complete | Checkpoint/remote ID simulato e dipendenze persistiti insieme |
| Retry / manual review | Rispetto next_attempt_at, incremento tentativi, hold degli incerti e delle review |
| Domain event / lost response | Audit deduplicato e replay dopo perdita della risposta al commit |

Altri controlli locali PASS: typecheck con exclude tmp aggiunto soltanto alla configurazione in memoria, incremental disattivato/noEmit; ESLint pertinente con zero warning; `git diff --check`. Non è stato alterato tsconfig e non sono stati usati file di tmp come sorgenti. Non è stato usato il comando typecheck generico che includerebbe tmp tramite i glob esistenti.

**Smoke PostgreSQL futuro, da autorizzare separatamente:**

1. Usare un processo server isolato con il solo adapter store, credenziale protetta e dataset sintetico riconoscibile. Nessun worker/provider CRM, messaggio, booking o webhook. Non abilitare l'endpoint pubblico per fare il test dello store.
2. Verificare health/versione e negazione degli accessi equivalenti anon/authenticated. La prova con service role deve percorrere i rami SQL, non una fixture.
3. Acquisire una richiesta sintetica valida in una transazione completa. Attesi una request, un intento provvisorio, due evidenze, una root operation e un evento, con legami coerenti e marketing false conservato come snapshot.
4. Ripetere stesso ID/hash e poi hash diverso; verificare replay, conflitto, conteggi invariati e doppio submit concorrente da due sessioni.
5. Provocare in transazione controllata failure di consenso/outbox: nessuna riga parziale o ricevuta ok. Simulare risposta persa e recuperare lo stesso ID. Non usare manomissioni di tabelle condivise o guasti reali di infrastruttura.
6. Creare intenzioni risolte solo sintetiche, con riferimenti di richiesta esistenti e contatti opachi locali senza crearli in HighLevel; verificare vincoli A/E/C, due edizioni sintetiche sotto una E, duplicate participation e revisione obsoleta.
7. Da due worker solo-store concorrenti verificare claim esclusivo, token/versione, renew, expiry/reclaim e rifiuto di complete/renew del vecchio worker. Verificare retry differito, cinque tentativi/manual review e blocco degli effetti incerti.
8. Completare un effetto solo nel ledger con checkpoint fittizio marcato sintetico e follow-up; verificare atomicità. Testare dispatch marker/checkpoint opportunity senza invocare provider.
9. Confrontare snapshot e colonne indicizzate, audit, ACL e dati degli altri prodotti; nessuna riga patrimoniale reale o effetto esterno deve apparire. Conservare gli ID sintetici nel verbale per eventuale trattamento futuro approvato, senza purge implicito.

Una prova su ambiente isolato può usare una transazione finale annullata per i casi a sessione singola; quella prova non sostituisce i test multi-sessione di lease/concorrenza. Qualunque dato sintetico effettivamente committato resta identificato e preservato finché non sia autorizzata una specifica rimozione.

## 12. Rollback

Rollback operativo previsto, senza DROP o reset:

1. Disabilitare PATRIMONIAL_V2_ENABLED e PATRIMONIAL_DURABLE_STORE_READY nella configurazione operativa; verificare propagazione alle istanze e 503 sui nuovi invii v2. Nessun fallback a 2A/memory.
2. Disabilitare CRM_WRITE, OPPORTUNITY_WRITE, BOOKING, MESSAGES e WEBHOOK patrimoniali e sospendere le invocazioni worker pertinenti. Questi flag controllano il percorso v2, non i trasporti legacy/Radar di altri prodotti; non revocare una chiave condivisa per fermare solo il pilota.
3. Considerare acquisizioni/fetch già in volo: l'aggiornamento di un flag non annulla una transazione iniziata. Attendere o presidiare gli esiti, preservando checkpoint, token, remote ID e stati incerti; nessun replay massivo di create/note.
4. Conservare tutte le tabelle e righe eventualmente scritte. Nessun DROP, TRUNCATE, DELETE generale, riapertura di cicli o rollback cieco di stage umani. Stato RECONCILE_REQUIRED resta da verificare con procedura controllata; V2 spento mantiene i worker in HOLD.
5. Correggere mediante forward migration specifica, dopo diagnosi e autorizzazione. Restore del progetto condiviso non è il rollback ordinario di questa feature.

Una migration di rollback separata è solo ultima risorsa: richiede autorizzazione esplicita, inventario dipendenze/dati, copia recuperabile, analisi impatti sugli altri prodotti e prova in ambiente isolato. Non è creata o eseguita qui. Una migration applicata e registrata non va semplicemente rimossa dalla history.

## 13. Env

Solo nomi e regole; nessun valore reale è stato letto o riportato.

| Nome | Requisito per il futuro runtime |
| --- | --- |
| SUPABASE_URL | URL server preferito del progetto approvato; obbligatorio salvo fallback sotto |
| NEXT_PUBLIC_SUPABASE_URL | Fallback già supportato se SUPABASE_URL è assente; non necessario duplicarlo se è configurato il server URL |
| SUPABASE_SERVICE_ROLE_KEY | Credenziale server dello stesso progetto, mai browser/NEXT_PUBLIC, mai publishable key |
| PATRIMONIAL_DURABLE_STORE_READY | Gate aggiuntivo effettivamente implementato; mantenere disabilitato fino a verifica/applicazione/smoke e autorizzazione intake |
| PATRIMONIAL_V2_ENABLED | Intake v2; disabilitato per default |
| PATRIMONIAL_CRM_WRITE_ENABLED | Gate worker CRM; mantenere disabilitato |
| PATRIMONIAL_OPPORTUNITY_WRITE_ENABLED | Gate opportunity, oltre a V2/CRM/mapping; mantenere disabilitato, provider reale ancora stub |
| PATRIMONIAL_BOOKING_ENABLED | Riservato; mantenere disabilitato |
| PATRIMONIAL_MESSAGES_ENABLED | Riservato; mantenere disabilitato |
| PATRIMONIAL_WEBHOOK_ENABLED | Riservato; mantenere disabilitato |

Solo la stringa letterale di abilitazione prevista dal codice abilita i gate; assenza o valori invalidi li lasciano spenti. Le chiavi di controllo vanno rese esplicite nel manifest di produzione approvato, conservando il comportamento fail-closed. Nessuna env viene cambiata in questa fase. Il fallback URL usa `??`: una SUPABASE_URL presente ma vuota non viene sostituita da quella pubblica e provoca unavailable; evitare configurazioni ambigue o URL discordanti. HTTP è ammesso soltanto per localhost, per futuri test isolati; il target di produzione richiede HTTPS e origine senza path/query/credenziali.

Non occorrono credenziali HighLevel per applicare o collaudare questo store. Eventuali configurazioni CRM future sono un gate separato e non vengono valorizzate per lo smoke Supabase.

## 14. Risks

| Rischio o limite osservato | Gestione richiesta |
| --- | --- |
| Fixture RPC esegue JavaScript, non PL/pgSQL | Prova PostgreSQL reale isolata prima dell'apply operativo; il PASS statico non certifica compilazione/esecuzione SQL |
| Default ACL/membership possono ampliare service_role | Verifica privilegi effettivi; eventuale correzione separata prima dell'abilitazione |
| Health LIMIT 0 non è una prova di DML/RLS | Smoke read/write completo con ruolo reale e prove negative browser |
| Target/history/collisioni manuali ignoti | Pre-flight obbligatorio; nessuna deduzione dal solo repository |
| Namespace advisory globale e preview che riesegue journal | Misurare latenza/contesa su DB; limite 128 comandi e callback solo-store, senza side effect esterni |
| Lease basata su scadenza app, verificata con clock DB | Verificare sincronizzazione orologi e margini sotto latenza reale; nessun bypass dei controlli di scadenza |
| JSONB e colonne duplicate per indicizzazione | Usare RPC approvate; verificare proiezioni e invarianti, senza patch REST indipendenti |
| Helper pubblici nello schema, protetti da EXECUTE | Verificare ACL su tutte le dieci firme, non solo i tre endpoint usati dall'adapter |
| Migration non idempotente su oggetti già presenti | Stop su collisione/apply incerto; verificare schema/history prima di qualsiasi nuovo tentativo |
| Retention, variazioni edizione e attivazioni successive | Nessun purge o calendario implicito; procedure e autorizzazioni dedicate |

Non sono state riscontrate collisioni locali o incompatibilità certa nelle firme adapter/SQL. I limiti riportati non sono attestazioni di incidenti o configurazioni remote errate.

## 15. Readiness result

**NOT_READY.** È il gate per applicare al progetto target, distinto dall'esito positivo dell'audit locale.

| Blocker aperto | Evidenza disponibile | Condizione di chiusura |
| --- | --- | --- |
| B1 — Corpi SQL non eseguiti su PostgreSQL compatibile | Test statici/fake PASS, nessuna esecuzione DB | Validazione in ambiente PostgreSQL isolato autorizzato, incluse transazioni preview/commit, FK differite e concorrenza |
| B2 — Target, ambiente, backup e history non verificati | Soltanto sequenza locale di 17 precedenti e candidata | Verbale protetto §9, progetto/ambiente approvati, backup ripristinabile, history/drift risolti e piano solo-candidata |
| B3 — Prerequisiti/privilegi effettivi/RLS/Data API ignoti | SQL di revoca/grant presente; default ACL service_role non azzerati; health limitata | Verifica del target §5–§10: UUID/schema/USAGE/BYPASSRLS, ACL effettivi conformi, accessi browser negati e RPC esposte correttamente; correzione autorizzata se necessaria |

Lo smoke successivo all'apply è un gate ulteriore per l'abilitazione della feature, non una verifica già eseguita né un motivo per accendere oggi i flag. La successiva decisione READY_TO_APPLY richiede chiusura documentata dei tre blocker; non autorizza automaticamente CRM, intake pubblico, deploy o merge.

Consegna di questa fase: soltanto questo file; migration invariata e non applicata, codice invariato, staging con esclusione esplicita di tmp prima del commit, commit locale `docs: verify patrimonial Supabase readiness`. Nessun servizio remoto contattato e nessun dato reale acquisito.
