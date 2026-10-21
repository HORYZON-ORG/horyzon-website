# Evento → Radar Patrimoniale → Hub → HighLevel | Piano esecutivo e confini

Data: 20 ottobre 2026. Workstream: EVENT + SHARED CORE (nessuna contaminazione di ARCHITECT RECRUITMENT). Branch di lavoro: `feat/patrimonial-event-integration-foundation`.

## Decisioni canoniche

- **Hub/Supabase** è autorevole per identità Horyzon, dati integrali Radar Patrimoniale, partecipazioni, qualificazione, assegnazioni, permessi e audit.
- **HighLevel** gestisce contatto unico remoto, comunicazioni, appuntamenti e pipeline EVENT/CONSULT.
- Una persona ha `horyzon_contact_id` stabile, indipendente dalla mail. Le email sono chiavi di matching provvisorie; se telefono/email/external ID confliggono, `IDENTITY_REVIEW`, nessuna fusione silenziosa.
- Un solo contact HighLevel per identità risolta; una relazione E per contatto, Participation separata per edizione.
- Radar Patrimoniale è un prodotto distinto dal Radar d’Impresa su `/radar`. **Non collegare** tabelle, API, score o tag del Radar d'Impresa per analogia.
- L'Architetto di rete può vedere esclusivamente i suoi contatti, enforce server/SQL, non con filtro UI. Supervisor vede rete intera. L’assegnazione interna e il remote owner HighLevel sono identità diverse.
- La richiesta di colloquio è un desiderio dichiarato; non equivale ad appuntamento confermato né crea automaticamente una pipeline C.
- I dati Radar sono dichiarativi, non prova di idoneità o patrimonio certificato. Una qualificazione non autorizza raccomandazioni personalizzate automatizzate o profilazione commerciale non consentita.

## Inventario verificato (letture, nessuna mutazione)

- Git: deploy preview allineato a `feat/patrimonial-pilot-funnels` al commit `cc15e5d0731a8227eac2a3df39d7e7b0e2242ac3`.
- HighLevel Horyzon: pipeline Evento (5 stage), Confronti (5 stage) e Percorso Architetto (10 stage), con field catalog registrato; workflow Evento **0**; utenti censiti 2.
- Supabase Horyzon: migrations patrimonial P1, owner sync, runtime capability, P3, `0056_architetti_workspace` applicate; RLS e comandi network presenti. Zero event editions, zero participations, zero operator pools; non assumere onboarding operatori completato.
- Frontend Evento: `eventScenes`, `eventProfiles`, `eventInstruments`, `eventKnowledgeLevels` raccolti nello stato React ma serializzati in testo `message`; checkbox del confronto serializzata in messaggio. Non adatti oggi a routing strutturato.
- `patrimonial-lead-v2` è attuale contratto pubblico; `contractVersion` non si attiva automaticamente; niente attivazione v3 implicita.
- Il nuovo file `patrimonial-event-qualification.ts` è una libreria **isolata**, senza nuova API né scritture.

## Flusso target e identità

1. `event_registration_received`: invio con idempotency key, consent evidence, UTM, payload qualificazione separato per versione.
2. `identity_resolved`: `horyzon_contact_id` e `highlevel_contact_id` mappati come due ID distinti, con stato NEW/REUSE/REVIEW. Email normalizzata solo per lookup, non PK.
3. `participation_requested`: `edition_id` reale oppure `PENDING_EDITION`; mai CONFIRMED senza edizione/capienza/criterio.
4. `participation_confirmed`: evento validato, invio workflow transazionale idempotente; marketing separato.
5. `radar_invited`: URL monouso o token firmato a scadenza contenente riferimento opaco server-side al contact + participation; niente PII nella query. Link non deve autorizzare a leggere altri Radar.
6. `radar_completed`: collegamento a assessment indipendente, versione quiz, timestamp, risultato semplice cliente / analisi interna per operatori autorizzati. Non ricopiare risposte grezze nei custom field HighLevel.
7. `qualification_snapshot`: unione di segnali Evento e Radar solo con provenienza e finalità esplicite, senza parsing retroattivo delle note.
8. `assignment`: selezione di operatori attivi nel pool, capacity e compatibilità regole verificabili; in partenza round robin tra eleggibili, MANUAL per casi ambigui. Snapshot immutabile e storico.
9. `owner_sync`: solo dopo mapping `operator_id -> highlevel_user_id` e location+permessi verificati; enqueue/reconcile, non chiamata diretta non tracciata.
10. `post_event_follow_up`: attended/no-show da fonte certa; contatto reale tracciato; confronto C solo con richiesta esplicita/azione autorizzata; conversioni non equiparate a semplice presenza.

## Contract qualification: fondazione implementata

La libreria nuova accetta:
- `schemaVersion: 1`
- `audienceProfile`: uno dei cinque profili UI o `null`
- `sceneId`: uno dei quattro ID scene o `null`
- `consultationRequested`: `true | false | null`
- `instruments`: array di `{ instrumentId, knowledgeLevel }` da catalogo Evento con ID unici

La canonicalizzazione ordina gli strumenti e preserva la differenza fra `null`, `false` e `[]`. Il valore `awarenessLevel` deriva da `sceneId` nel snapshot locale. Il modulo **non è ancora collegato al submit**, non modifica V2, non scrive in database, non profila lead in automatico.

## Implementazione tecnica sequenziale

### F0 — Base sicura (questo branch)
- Contratto di qualificazione isolato, validazione positiva/negativa, canonical JSON, test.
- Documentazione del modello di responsabilità e dei gate.
- Nessun go-live, migrazione, workflow o invio reali.

### F1 — Data model & compatibility (da implementare)
- Versionare il nuovo `patrimonial-lead-v3` con union discriminata; preservare completamente v2 e recruitment.
- Inserire `qualification` nel payload canonico, nell'hash idempotente, nei validator server, nelle fixture e ricevute.
- Migration additive dedicata alla raccolta dell'evidenza qualificazione e al mapping dei riferimenti Radar/contact/participation con retention/ACL; non riscrivere snapshot storici.
- Test di replay identico, stesso requestId/payload diverso 409, doppio submit, retry dopo ACK perso.
- Solo dopo: aggiornare il form Evento a v3, mantenendo rollout server-side chiuso sino a test end-to-end.

### F2 — Editions & CRM
- Registrare edizione reale (titolo, start/end, timezone, capienza, accesso/cutoff, speaker, sender) e decidere conferma manuale vs automatica.
- Event workstream E01–E05, confronto C01–C05; nessun CV o training.
- Verificare provider mapping/contact lookup e per-contact duplicate refusal nel live smoke sintetico; tracciare riconciliazione.
- Implementare workflow EVENT request/confirm/reminder/attendance/follow-up e messaggistica consensi.

### F3 — Radar & identity linking
- Audit della Fondazione 5A Radar Patrimoniale nel repository/branch sorgente e relativo store.
- Definire token di invito firmato, binding contatto+edizione e accesso all'analisi interna solo a operatori abilitati.
- Persistenza di `assessment_id` come external reference, no email join permanente e no incrocio con Radar d'Impresa.
- Verificare dati già raccolti rispetto alle finalità informative approvate.

### F4 — Operator workspace
- Onboarding account Architetti e supervisor, mapping `auth.uid() -> patrimonial_operators.id`.
- Configurare pool/capacity, policy di assegnazione; dimensioni di competenza da definire come catalogo governato (non capacità presunte).
- Allineare `patrimonial_contacts.assigned_operator_id`, `patrimonial_assignments/current_operator_id` e owner CRM con un solo comando orchestrato e compensazioni/reconciliation. Evitare due writer concorrenti.
- Verificare BOLA/IDOR: un Architetto A non può leggere tramite API/RPC gli ID di B; disattivazione revoca nuovi accessi; supervisor e audit.
- Attività/next action, SLA, storico, follow-up e tracciamento conversioni con eventi verificati.

### F5 — Go-live, solo dopo autorizzazione
- Smoke sintetico: form→identity→HighLevel→Participation→Radar→snapshot→routing→RBAC→owner-sync→workflow, cleanup controllato.
- Gate privacy/informativa, consenso marketing separato, comunicazioni, fonti dei claim finanziari, backup/rollback e monitor errori.
- Canary per un'edizione, poi apertura pubblica. Nessuna migrazione su main/production prima dei gate.

## Decisioni operative che richiedono il committente

- Data/durata, accesso e capienza della prima edizione, presenter e mittente.
- Testo/tempi di email e reminder e canali autorizzati; iscrizione manuale o automatica.
- Elenco nominativo e accessi degli Architetti con ruoli, capacity e specializzazioni effettive.
- Policy esplicita per contatto post-evento e per Radar non completato.
- Revisione del trattamento dei dati Radar e dei contenuti finanziari prima della pubblicazione.

## No-go / punti di attenzione

Non dedurre di essere pronti dal numero di migrations. Non assegnare un prospect a più operatori per errore; non fonderlo in base a email ambigua; non impostare tag/messaggi/event status senza riscontro. Mantenere recruitment completamente isolato. Non attivare workflow o inviare dati Radar completi a HighLevel senza test e autorizzazione.
