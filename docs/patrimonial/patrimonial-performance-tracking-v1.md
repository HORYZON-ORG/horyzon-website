# Patrimonial performance tracking — P3 v1

18 ottobre 2026. Branch feat/patrimonial-pilot-funnels. Baseline P2D: 38eb1caafff923e52edcb56291281eb538574f45.

**P3 v1 è una fondazione locale, non un'attivazione live.** Non applica migration al Supabase remoto, non abilita webhook, non modifica HighLevel, non crea dashboard e non imposta feature flag remoti.

## Obiettivo

Misurare il percorso successivo all'assegnazione senza confondere qualità del funnel e lavoro del responsabile. Le unità di analisi sono pratica patrimoniale risolta, singolo intervallo di responsabilità, operatore interno Horyzon, snapshot qualità/origine associato all'assegnazione ed eventi operativi osservabili nel tempo.

Non esiste un operator score. P3 conserva fatti e tempi; P4 potrà mostrare conteggi, percentuali, distribuzioni e cohort comparabili.

## Tassonomia v1

Eventi normalizzati: OWNERSHIP_TAKEN, CONTACT_ATTEMPTED, CONTACT_ESTABLISHED, APPOINTMENT_BOOKED, APPOINTMENT_RESCHEDULED, APPOINTMENT_CANCELLED, APPOINTMENT_ATTENDED, APPOINTMENT_NO_SHOW, FOLLOW_UP_STARTED, STAGE_CHANGED, CLOSED_WON, CLOSED_LOST, CLOSED_ABANDONED.

Primo tentativo e primo contatto stabilito sono distinti. Questo evita di attribuire come “contattato” un semplice SMS, email o chiamata senza risposta. OWNERSHIP_TAKEN è una presa in carico esplicita e non viene dedotta dal solo assignedTo HighLevel.

## Attribuzione

Ogni evento porta sempre intent_id, assignment_id e operator_id. Il database verifica che assignment→intent e assignment→operator coincidano, che occurred_at cada dentro l'intervallo di assegnazione e che eventuali remote opportunity/contact ID coincidano con la pratica.

Questa regola è essenziale per le riassegnazioni: un webhook consegnato in ritardo viene attribuito all'operatore che aveva realmente la pratica al momento dell'evento, non al responsabile corrente.

La funzione patrimonial_performance_resolve(remoteOpportunityId, occurredAt) restituisce una pratica/assignment soltanto se la corrispondenza è univoca. Zero match restituisce null; più match produce conflitto. Nessun fallback su nome, email o testo libero.

## HighLevel: segnali e limiti

Documentazione ufficiale v3 verificata il 18 ottobre 2026:

- Webhook catalog: https://marketplace.gohighlevel.com/docs/category/webhook/
- OutboundMessage: https://marketplace.gohighlevel.com/docs/webhook/OutboundMessage/
- Appointment API v3: gli stati documentati sono new, confirmed, cancelled, showed, noshow, invalid, completed, active.
- Le firme webhook correnti usano X-GHL-Signature Ed25519; la firma legacy RSA è deprecata.

Readiness P3 v1:

| Segnale HighLevel | Stato P3 | Motivo |
| --- | --- | --- |
| OpportunityStageUpdate | RESOLVABLE_BY_OPPORTUNITY_ID | contiene opportunity ID, contact, pipeline e stage |
| OpportunityStatusUpdate | RESOLVABLE_BY_OPPORTUNITY_ID | contiene opportunity ID e status |
| OpportunityAssignedToUpdate | NON equivale a presa in carico | owner CRM non significa accettazione operativa |
| OutboundMessage | NEEDS_PRACTICE_BINDING | identifica il contatto, non quale pratica patrimoniale |
| InboundMessage | NEEDS_PRACTICE_BINDING | stesso problema di attribuzione |
| AppointmentCreate/Update | NEEDS_CALENDAR_OR_PRACTICE_BINDING | contiene contact/calendar, non opportunity patrimoniale |

P3 non collega automaticamente messaggi o appuntamenti a una pratica usando soltanto contactId. Uno stesso contatto può avere relazione Evento, Percorso Architetto e Confronto contemporaneamente. Prima del webhook adapter servirà un binding esplicito calendario/pratica oppure una relazione provider verificata.

## Persistenza

Migration locale: supabase/migrations/20261018224500_patrimonial_performance_tracking.sql.

Nuovi oggetti:

- patrimonial_performance_events: ledger append-only, senza PII diretta;
- patrimonial_assignment_performance_v1: vista analitica per assignment;
- patrimonial_performance_guard(): difende attribution e intervalli anche da INSERT service-role diretti;
- patrimonial_performance_immutable(): vieta UPDATE/DELETE;
- patrimonial_performance_resolve(...): risoluzione temporale opportunity→assignment;
- patrimonial_record_performance_event(...): insert/replay idempotente;
- patrimonial_performance_capabilities(): fail-closed p3-v1.

Tabella FORCE RLS, nessuna policy client, service-role only. Le funzioni sono SECURITY INVOKER con search_path fissato.

### Idempotenza

Due chiavi separate: event_key per Horyzon e la coppia source/source_ref per provider. payload_hash rappresenta il contenuto semantico e non include event_key. Un retry provider con stesso source_ref e stessa semantica viene riusato anche se un chiamante costruisce una event key diversa; payload diverso produce conflitto.

## Minimizzazione

Il ledger non contiene nome, cognome, email, telefono, address, body messaggio, note o testo libero del prospect. Conserva soltanto UUID interni, riferimenti provider opachi, tipo evento, timestamp, stage/status normalizzati e canale normalizzato.

Gli UTM/profile restano nello snapshot P1 associato all'assignment; P3 non li duplica e non esegue parsing retroattivo di message.

## Vista analitica

patrimonial_assignment_performance_v1 espone per assignment funnel e dimensioni snapshot già disponibili, presa in carico, primo tentativo, primo contatto stabilito, prima prenotazione, primo show, primo no-show, primo follow-up, primo stage change, chiusure won/lost/abandoned, conteggi operativi e minuti dall'assegnazione ai primi eventi.

La vista non calcola ranking o punteggi. P4 potrà confrontare per cohort omogenee tempo mediano alla presa in carico, tempo al primo tentativo/contatto, booking rate, show/no-show rate, follow-up rate e conversione won/lost. Con campioni piccoli vanno mostrati sempre N e percentuale, non classifiche assolute.

## Flag

Nuovo flag PATRIMONIAL_PERFORMANCE_TRACKING_ENABLED. Default false.

Il dominio recordPatrimonialPerformanceEvent rifiuta prima di qualsiasi RPC quando il flag non è esplicitamente true. Nessun env remoto viene modificato in P3 v1.

## Verifica locale

Script: npm run test:patrimonial-performance.

Copre capability P3, RLS/grants, create operator + assignment, replay event_key, replay source_ref, conflitto same key/different payload, eventi fuori intervallo assignment, riassegnazione e delayed-event attribution, risoluzione opportunity→assignment per timestamp, vista e metriche temporali, assenza di colonne PII dirette e flag off senza RPC P3.

## Passo successivo

Prima di applicare P3 al remoto: eseguire test locali/build, verificare lineage e preflight schema remoto, autorizzare separatamente la migration P3, applicare targeted e mai supabase db push, verificare capability/ACL/RLS e zero backfill. Solo dopo va progettato P3B HighLevel ingestion con verifica X-GHL-Signature Ed25519 e mapping prudente dei soli eventi attribuibili.

P3 v1 non modifica Production né main.


## Remote rollout — 18 ottobre 2026

Autorizzazione esplicita ricevuta e migration P3 applicata al progetto Supabase Horyzon con managed targeted apply, senza `supabase db push` e senza history repair.

- file locale: `20261018224500_patrimonial_performance_tracking.sql`
- migration name: `patrimonial_performance_tracking`
- versione remota effettiva: `20261018205124`
- esito apply: SUCCESS

Preflight remoto prima dell'apply:

- P1/P2B health e capability sane;
- oggetti P3 assenti;
- `PATRIMONIAL_PERFORMANCE_TRACKING_ENABLED`, assignments e owner-sync non attivi nel Preview branch;
- counts legacy/assignment acquisiti senza PII.

Post-apply:

- `patrimonial_performance_events`, vista analitica e RPC P3 presenti;
- `performanceTracking=p3-v1`;
- base health, `assignmentManagement=p1-v1` e `ownerSync=p2b-v1` invariati;
- zero performance events creati automaticamente;
- counts preesistenti invariati;
- FORCE RLS attivo;
- service_role: SELECT/INSERT soltanto sulla tabella performance;
- anon/authenticated: nessun accesso diretto;
- funzioni P3 SECURITY INVOKER con search_path fissato;
- trigger attribution e immutabilità attivi;
- tutti i FK P3 hanno covering index;
- vista `security_invoker=true`.

Gli advisor Supabase segnalano `RLS enabled no policy` sulla tabella P3: è intenzionale perché il ledger è service-role only. Gli altri warning di sicurezza/performance rilevati sono preesistenti o attesi su indici appena creati e vuoti.

Stato: **P3 REMOTE INSTALLED / TRACKING NOT ACTIVATED**. Nessun webhook HighLevel, endpoint ingestion o feature flag è stato attivato.
