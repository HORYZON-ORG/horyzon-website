# Patrimonial assignment management — P1 v1

18 ottobre 2026. Baseline effettiva `88fafcba8811e4a02b3575e2e2cd36368b818be8`, branch `feat/patrimonial-pilot-funnels`. La decisione canonica approvata sostituisce lo STOP del precedente audit. P1 implementata e verificata localmente; **non attivata e non applicata a Supabase remoto**.

## Identità canoniche

| Campo | Significato | P1 |
| --- | --- | --- |
| `owner_ref` / record `ownerId` | Remote CRM/provider owner reference | Invariato durante assign/reassign/release, anche con mapping disponibile |
| `current_operator_id` | UUID interno Horyzon, FK operators | Responsabilità interna, storico, capacity ed esperimenti |
| `operator.remote_user_ref` | Mapping remoto opzionale | Solo funzione pura `resolveRemoteOwner`; nessuna owner write |
| `operator_revision` | CAS assegnazione interna | Indipendente dalla business/CRM revision |

Operatore senza mapping: `LOCAL_ASSIGNED / REMOTE_OWNER_UNMAPPED`, valido per assegnazioni ed esperimenti. Operatore con mapping: `LOCAL_ASSIGNED / REMOTE_OWNER_SYNC_DISABLED`. Nei batch `assignmentStates` espone lo stato per ogni assignment, senza attribuire a tutti il mapping dell'ultimo operatore. Mai copiare un UUID interno in owner_ref/assignedTo. Il flag owner-sync è riservato e non abilita implementazioni P2.

Un operatore interno non soddisfa implicitamente i prerequisiti legacy che richiedono owner remoto. Le transizioni lifecycle e la riconciliazione `remote.assignedTo` restano identiche. Un save legacy aggiorna le sue colonne esplicite preservando current_operator_id/operator_revision. P1 non modifica record, business revision, lease o sync state.

## Schema locale

Migration forward-only `supabase/migrations/20261018094926_patrimonial_assignment_management.sql`, generata con Supabase CLI. Migration precedenti immutate. Nessun seed di persone, enum personale o limite numerico agli operatori.

| Tabella | Campi e vincoli |
| --- | --- |
| `patrimonial_operators` | UUID PK default gen_random_uuid, operator_key UNIQUE stabile, display_name, remote_user_ref nullable, active true, role nullable, capacity nullable >=0, sort_order 0, metadata {}, revision, created_at/updated_at |
| `patrimonial_operator_pools` | UUID PK, pool_key UNIQUE, name, active, assignment_policy checked text, metadata {}, revision, timestamp |
| `patrimonial_operator_pool_members` | UUID PK, FK pool/operator, active, weight nullable >0, joined_at/left_at; UNIQUE pool/operator dove active. Rimozione chiude intervallo, non elimina |
| `patrimonial_assignment_experiments` | UUID PK, experiment_key UNIQUE, name, status checked text, pool_id nullable, method, target_per_operator nullable >0, configuration, revision, started_at/ended_at, timestamp |
| `patrimonial_assignment_experiment_operators` | PK experiment/operator, FK, included. Scelte modificabili in DRAFT; congelate dal primo ACTIVE, anche in PAUSED |
| `patrimonial_lead_snapshots` | UUID PK, snapshot_key UNIQUE, FK intent/request opzionale, funnel, source/medium/campaign/profile nullable, maturity/consultation NULL in P1, attributes {}, schema_version 1, captured_at; immutabile |
| `patrimonial_assignments` | UUID PK, assignment_key UNIQUE, FK intent/operator/pool opzionale/experiment opzionale/snapshot opzionale; method, assigned/released/reason, actor type/ref, command_key, revision, metadata, created_at |
| `patrimonial_assignment_cursors` | Scope PK e ultimo UUID operatore; uno scope per pool oppure global, condiviso fra esperimenti dello stesso pool |
| `patrimonial_assignment_state` | Singleton tecnico con revisione globale; nessuna metrica performance |
| `patrimonial_assignment_commands` | command_key PK, SHA-256 payload canonico, risultato recuperabile, timestamp; ricevuta, non event ledger/retry queue |

Nessuna leaderboard/conversion_rate/operator_score materializzata. Weight e assignment_policy del pool sono configurazione: il comando sceglie esplicitamente il metodo e i pesi non sono applicati in v1. Nessuna logica territoriale. Aggiungere il 30° operatore richiede un INSERT, non schema change.

## Comandi e autorizzazione

`executePatrimonialAssignment` estende il dominio/store esistente tramite `PatrimonialAssignmentTransaction`, implementata dallo stesso `SupabasePatrimonialStore` e journal. Nessun endpoint pubblico o UI admin. Un futuro chiamante server deve derivare actor/autorizzazione da un contesto fidato, mai dal form pubblico.

Comandi: createOperator, updateOperator, deactivateOperator; createPool, setPoolMembership; assignProspect, reassignProspect, releaseProspect; createAssignmentExperiment, setExperimentOperators, activateAssignmentExperiment, pauseAssignmentExperiment, completeAssignmentExperiment; assignBalancedBatch.

Registry/membership/lifecycle esperimenti e MANUAL richiedono ADMIN. ROUND_ROBIN/BALANCED_BATCH ammettono ADMIN/SYSTEM/WORKER. Actor ref opachi. Per assegnazioni expectedRevision significa **operator_revision**, non business revision.

Disattivare preserva storico e assignment correnti, blocca nuovi ingressi. Capacity NULL è non configurata; 0 blocca auto assignment. Il conteggio deriva dalle righe attive in ogni pool/esperimento. Override solo ADMIN MANUAL, `overrideCapacity === true`, metadata `reasonCode=capacity-override`. Non supera inattività, membership o target esperimento.

Assign/reassign richiedono OPPORTUNITY OPEN. Reassign chiude la precedente con REASSIGNED, crea snapshot/successore, aggiorna current_operator_id ed evento atomicamente. Mai DELETE storico. Release chiude la corrente, proietta NULL ed evento; non azzera owner_ref. Una chiusura lifecycle **non libera automaticamente capacity**: serve releaseProspect esplicita con INTENT_CLOSED e revisione corrente, sequenza testata. Nessuna presenza/prenotazione/esito inventato.

## Transazione e invarianti

Il journal esistente esegue preview in subtransaction sempre annullata e ricontrolla al commit i valori osservati. Metodi aggiunti: getAssignmentContext e commitAssignmentPlan. Il nuovo dispatcher delega ogni comando legacy alla precedente funzione rinominata; nessuna riscrittura del corpo applicato.

Lock advisory transazionale `(741920,2)` condiviso con lo store/lifecycle esistente: nessun lock sopravvive alla RPC o copre fetch provider. Il contesto contiene registro, membership, assignment attive, storico esperimento selezionato, snapshot pertinenti e solo gli intent richiesti. Non include message/recapiti. CAS globale, operator_revision e revisione pratica osservata proteggono la decisione. Snapshot cambiato causa ricalcolo entro il limite tecnico esistente; expectedRevision obsoleta termina in CONFLICT.

Partial UNIQUE su intent WHERE released_at IS NULL e constraint trigger differiti garantiscono una sola assignment attiva e coincidenza con current_operator_id al commit, anche per scritture service_role dirette. Trigger impediscono cancellazione/riscrittura della storia, cambio operator_key, modifica snapshot e partecipanti/configurazione di esperimenti avviati. Inserimento SQL ricontrolla active, capacity, membership, target e relazione snapshot/intent.

Ricevuta, storia, snapshot, proiezione, cursore ed eventi sono un commit. Stessa commandKey/payload canonico restituisce il risultato originale anche dopo modifiche al registro; payload diverso produce conflitto. Campi oggetto ordinati, array con ordine significativo; nessuna scadenza/purge automatica. ACK perso non viene ritentato ciecamente: il chiamante recupera la ricevuta con la stessa chiave. Testati rollback a metà piano e ACK perso dopo commit.

Il lock globale conserva l'architettura esistente: è un possibile limite di throughput, non di numerosità operatori. Paginazione e lock per scope richiederanno verifica dedicata equivalente. Nessun cursore o contatore mutabile solo in memoria.

## Politiche deterministiche

ROUND_ROBIN ordina sort_order, operator_key (collation esplicita en nel dominio), UUID. Riparte dopo l'ultimo UUID persistito, salta inattivi/non membri/saturi, salva il cursore con l'assegnazione. Se l'ultimo esce dagli eleggibili riparte dal primo corrente; display_name mai usato. Test: 25 registrati, 3 nel pool, 9 prospect, nuove istanze store fra turni → **3/3/3**.

BALANCED_BATCH ordina lead per intent UUID e usa priorità lessicografiche:

1. Minori ingressi per operatore nel cohort: tutto lo storico dell'esperimento, oppure solo il batch senza esperimento.
2. Minore incremento della somma dei quadrati marginali delle categorie osservate: delta `2*n+1`, peso unitario per funnel/profile/source/campaign/maturity/consultation.
3. Ordine stabile operatori sopra descritto.

NULL/stringhe vuote ignorati, niente microstrati cartesiani, parsing message o patrimonio stimato. Policy marginal-balance-v1 registrata, snapshot immutabili consentono ricalcolo; nessun performance score materializzato. Minimizzazione greedy deterministica per ingresso, non ottimo globale né statistical randomisation. Test: **30/3 target10 → 10/10/10**, spread marginale profile/source <=2 nella fixture; attributi mancanti gestiti.

Target conta ogni ingresso storico, inclusi rilasci e riassegnazioni; release libera capacity, non il target sperimentale. ACTIVE consente ingressi, PAUSED li blocca, COMPLETED è terminale. CANCELLED è uno stato riservato nello schema: P1 non espone cancel. Membership 10 e 25 verificate; nessun limite di schema.

## Eventi e SQL

Si riusa patrimonial_domain_events: prospect_assigned, prospect_reassigned, prospect_released, assignment_experiment_created, assignment_experiment_activated, assignment_experiment_paused, assignment_experiment_completed. Chiavi prefissate idempotenti, actor SYSTEM/ADMIN/WORKER, revisione namespace assignment dichiarata in metadata, UUID/metodo/motivo allowlist senza PII diretta.

Un esperimento può precedere qualunque lead: ledger aggiunge experiment_id FK e ammette intent_id NULL solo per eventi aggregate esperimento. Gli eventi legacy/assignment continuano a richiedere intent_id. Assignment sperimentali possono portare entrambi i riferimenti. Nessun intent fittizio o secondo ledger.

Nuove tabelle ENABLE/FORCE RLS, nessuna policy client. Privilegi revocati esplicitamente anche rispetto a default ACL; grant service_role-only. Funzioni SECURITY INVOKER, search_path esplicito. Snapshot/ricevute SELECT/INSERT, nessun DELETE concesso. RPC server privilegiate, non nuovo confine auth pubblico.

## Dati e futuro P2

Snapshot v1 solo attributi strutturati dell'origine: request_id pertinente se disponibile, funnel, profile, UTM source/medium/campaign e fallback source operativo. Maturity/consultation NULL, attributes vuoto. Niente nome/cognome/email/telefono/indirizzo/note/message/URL completo. UTM ammesse dal requisito restano testo dichiarato: non certificano idoneità o patrimonio e richiedono codici curati per analisi sensibili. Nessun backfill da note. Readiness e proposta v3 documentano il gap.

P2 futura, **non implementata**:

```
assignment commit → current_operator_id → operator.remote_user_ref
→ owner-sync outbox esistente → HighLevel assignedTo → owner_ref checkpoint
```

Servono verifiche di binding owner opportunity, assignedTo/clear, permessi, relazione user/location, versioning/fencing e reconciliation. Contact owner e opportunity owner distinti. Metodi opportunity reali ancora stub CONFIG. Nessun effetto owner aggiunto al CHECK outbox/worker; riutilizzare lease/retry/idempotenza esistenti senza seconda coda.

Flag centralizzati `PATRIMONIAL_ASSIGNMENTS_ENABLED` e `PATRIMONIAL_OWNER_SYNC_ENABLED`: default false. Assignment riletto prima di lettura/commit; solo fixture locali lo abilitano. Nessun env locale/remoto modificato. Il flag owner-sync non attiva write P2, neppure se impostato in una fixture.

## Verifiche e limiti

`npm run test:patrimonial-assignment`: A–T ed extra nel PostgreSQL WASM effimero PGlite (solo devDependency 0.5.10). Le tre migration sono eseguite esclusivamente lì, poi il database è distrutto. Docker non era attivo, nessun servizio avviato. Verifica PL/pgSQL/ACL/RLS/vincoli e interleaving preview/commit nello store reale; non equivale a stress multiconnessione o verifica di un cluster Supabase remoto.

PASS persistence, CRM, opportunities, remote mapping, assignment, typecheck (tmp esclusa in memoria, nessuna emissione), ESLint sui file toccati, diff --check. Gli adeguamenti ai vecchi test riguardano esclusivamente nuovi flag e ricerca comandi nella migration forward; assert originali preservati.

**PRE-EXISTING BASELINE FAILURE**, prima/dopo identici: Evento presentation `Protected baseline changed: src/app/(patrimonial-pilot)/benessere-patrimoniale/percorso-architetto-patrimoniale/page.tsx` (pin 1a30610); Architetto presentation `No behavioral change: src/content/patrimonial-architect-session.ts` (pin 03209c3). Nessun fix/repin.

Browser Architetto PASS 360/390/768/1440 con POST intercettati. Evento browser si ferma alla riga 59: 17 sezioni contro 18 attese; test e UI sono identici alla baseline. Verifica read-only supplementare di entrambe le route a quattro larghezze, temi scuro/chiaro: PASS noindex/nofollow, font correnti (Evento Manrope, Architetto Space Grotesk), singolo h1, toggle e zero errori JS. Overflow Evento preesistente di 4px a 360/390 in entrambi i temi (documentWidth 364/394); assente a 768/1440 e su Architetto a tutte le larghezze. Non corretto perché UI fuori scope e byte-identica. Nessun POST; 24 richieste Iubenda intercettate e bloccate, zero richieste esterne inviate. Nessun live smoke.

Migrazione applicata remoto: **NO**. HighLevel write/API live: **NO**. Supabase remoto, Vercel env, main, produzione, messaggi e booking invariati. tmp/ e radar-patrimoniale-v1-audit-fase-1.md esclusi. Consegna limitata al branch autorizzato.
