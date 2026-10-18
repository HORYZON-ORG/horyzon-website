# Patrimonial owner sync readiness — P2A v1

18 ottobre 2026. Repository HORYZON-ORG/horyzon-website, branch feat/patrimonial-pilot-funnels. HEAD iniziale effettivo `e781f8dd3bafbd2fca7b3d85c077559811936f61`, confermato anche sul remoto. **P2B non autorizzata e readiness complessiva BLOCKED.** Nessuna owner write, migrazione, modifica env/scopes/token o attivazione flag.

## Provenienza e limiti dell'evidenza

- **E1 — audit esterno riportato dall'utente in questa richiesta.** MCP HighLevel attivo sul sub-account Horyzon; lette le tre pipeline con stage; ricerca opportunity riuscita con **0 risultati**. Tool/schema espongono assignedTo e body_assignedTo. Users read fallita con **401, token not authorized for this scope**, scope richiesti riportati locations.readonly e users.readonly. Nessuna write eseguita nell'audit esterno.
- **E2 — codice locale al HEAD iniziale.** Audit dei moduli highlevel, sync, store, assignments, highlevel-config, verify patrimoniali e documenti P1. Configura un catalogo di 3 pipeline/20 stage; remoteMappingReady certifica associazioni statiche, non permessi, identità runtime o binding HTTP.
- **E3 — prove locali P2A.** Fixture sintetiche normalizzate e mock, senza rete/credenziali o dati live. Confermano regole del planner e fail-closed, non il comportamento reale di HighLevel.

E1 è una verifica reale **riferita dall'utente**, non ripetuta dall'agente. Non sono stati forniti Location ID canonico, log grezzi, pagina opportunity non vuota, inventario utenti, endpoint/paginazione completi o prova che credenziali MCP e token dell'app coincidano. Non sono stati letti file env. Nessun ID utente/location inventato o estratto da ipotesi.

Gli unici stati della matrice sono VERIFIED, PARTIALLY_VERIFIED, UNVERIFIED, BLOCKED. VERIFIED ha sempre lo scope dell'evidenza dichiarata: non equivale a runtime abilitato.

## Capability matrix

| CAPABILITY | STATUS | EVIDENCE | BLOCKER | REQUIRED BEFORE P2B |
| --- | --- | --- | --- | --- |
| HighLevel connection | VERIFIED | E1: connessione MCP attiva, letture riuscite | Non prova l'autorizzazione del token applicativo | Verificare credenziale effettivamente usata dal futuro worker, senza confondere MCP e app |
| Location identity | PARTIALLY_VERIFIED | E1: sub-account Horyzon; E2: guard verifiedLocationId contro config | ID canonico e corrispondenza MCP/app non forniti | Legare ID esatto a token, risorse, operatore remoto e worker |
| Pipelines read | VERIFIED | E1: Percorso Architetto Patrimoniale, Evento Benessere Patrimoniale, Confronti Benessere Patrimoniale leggibili | Non abilita write/binding app | Riconciliare ID/catalogo e location col token destinato al worker |
| Stages read | VERIFIED | E1: stage configurati nelle tre pipeline; E2: 20 stage nel catalogo locale | Nessun nuovo dump di ID/stage nell'audit P2A | Confermare appartenenza pipeline/location e mapping corrente prima del rollout |
| Opportunities search/read | PARTIALLY_VERIFIED | E1: ricerca live riuscita, 0 opportunity | Nessuna riga non vuota o envelope/paginazione provati | Binding GET/read verificato e completezza inventario; lettura di una opportunity reale quando disponibile |
| Opportunity assignedTo field | PARTIALLY_VERIFIED | E1: campo esposto dallo schema | Nessun valore response live; nullability/omissione non provate | Response non vuota con tipo e provenienza verificati |
| Opportunity update assignedTo schema | VERIFIED | E1: tool update espone body_assignedTo | Schema potenziale, non permesso o risultato di write | Verificare contratto HTTP nativo e autorizzare separatamente eventuale prova P2B |
| Users read | BLOCKED | E1: 401, token not authorized for this scope; E2: usersRead UNKNOWN | Copertura della coppia locations.readonly/users.readonly non autorizzata nell'audit; non si deduce quale singolo scope manchi | Entrambi gli scope richiesti concessi dal titolare e inventario completo letto; P2A non modifica scope/token |
| User/location membership | BLOCKED | E1: inventario utenti non leggibile | Nessun utente/location verificabile | Evidenza server recente che lo specifico remote_user_ref appartiene alla Location corretta |
| Opportunity owner round-trip | UNVERIFIED | 0 opportunity; nessuna write/read-back | Nessun target scritto e riletto | Opportunity identificata, mapping verificato e prova autorizzata di read-back; mai dichiararla in base al solo schema |
| Owner write permission | UNVERIFIED | Nessuna write, create/update stub CONFIG | Schema update non prova permessi dell'account | Prova permesso/contratto sotto autorizzazione P2B separata |
| Timeout reconciliation | UNVERIFIED | E3: planner richiede lettura prima del retry; E2: lease/dispatch/reconciliation legacy | Comportamento owner reale e lettura/versioning non provati | Verificare outcome uncertain, read-back completo e checkpoint; niente blind retry |
| Owner clear semantics | UNVERIFIED | Nessuna prova di null, stringa vuota o omissione in update | Valori non equivalenti per assunzione | Contratto/evidenza provider specifici; clear escluso dalla prima owner write finché manca |
| Disabled user behavior | UNVERIFIED | Nessuna prova API/inventario o gestione owner esistente | Disable, rimozione dalla Location, delete e opportunity già assegnata sconosciuti | Verificare tutti i casi e policy hold/review senza clear automatico |
| Read pagination completeness | UNVERIFIED | E1: solo ricerca vuota; E3: incomplete/cursor residuo rifiutati | Envelope/cursor/limiti reali non provati | Contratto completo, test pagine multiple, duplicati e risultati parziali |
| Conditional update / provider version | UNVERIFIED | E2: interfaccia expectedProviderVersion, implementazione stub | Non prova supporto CAS remoto | Primitiva condizionale verificata; read-then-write da solo non protegge dalle modifiche umane concorrenti |

La mancanza di scope users è il blocco esplicito attuale; rimuoverlo non rende automaticamente VERIFIED round-trip, clear, permessi, disponibilità utenti o concorrenza provider.

## Audit codice e stato dei binding

`patrimonial-highlevel.ts`: searchOpportunities, createOpportunity e updateOpportunity sono deliberate stub, tutte lanciano CONFIG prima di qualsiasi HTTP. Il transport implementato è limitato ai binding contatto esistenti; non viene allargato ad endpoint opportunity ipotizzati. `PatrimonialConfiguredHighLevelProvider` mantiene usersRead UNKNOWN anche se un'opzione di costruzione tenta di dichiararlo true.

**Nessun read binding opportunity implementato in P2A.** E1 prova che la ricerca MCP funziona, ma non fornisce endpoint/schema HTTP, decode di righe non vuote e contratto di paginazione richiesti per un binding verificato. Non si aggiunge getOpportunity inutilizzato. OpportunitiesRead/Write dell'app restano UNKNOWN di default e tutti gli stub rimangono byte-identici. Non si promuovono capability runtime a true sulla sola evidenza MCP.

`patrimonial-sync.ts`: il sync legacy proietta ownerId su assignedTo; non legge current_operator_id. I suoi gate sono v2/crmWrite/opportunityWrite, **non ownerSync**. Oggi gli stub impediscono HTTP opportunity anche con gate true. Prima di introdurre write P2B occorre preservare questo confine: un futuro update binding condiviso non deve rendere il percorso legacy una via alternativa alle verifiche owner/flag. Nessun cambiamento a quel runtime in P2A.

`patrimonial-store.ts`: ownerSync centralizzato in patrimonialFlags, default false; assignments default false. Nessun env reale letto/attivato per questa verifica. `patrimonial-assignments.ts`: resolveRemoteOwner restituisce il candidato remoto o null, funzione pura locale; nessun provider/outbox. Assign/reassign/release modificano solo la responsabilità interna e non owner_ref/ownerId.

## Identità e mapping

| Identità | Semantica |
| --- | --- |
| current_operator_id | Internal Horyzon operator identity; UUID locale |
| operator.remote_user_ref | Candidate HighLevel user identity mapping; sintassi valida non è verifica |
| owner_ref / ownerId | Riferimento owner remoto della opportunity/provider, destinato al checkpoint P2B; mai operatore locale |
| assignedTo | HighLevel opportunity owner field, distinto dall'owner del contatto |

Precisazione sul codice corrente: ownerId può essere ricevuto come riferimento operativo remoto nel dominio legacy; il checkpoint osservato del sync è remote.assignedTo. Non si certifica che ogni owner_ref sia già stato validato live. P2B dovrà aggiornare coerentemente owner_ref e record ownerId solo dopo read-back, sotto CAS, rispettando la business revision e la separata operator_revision. P2A non li modifica.

Stati concettuali, non nuove colonne persistite:

- UNMAPPED: remote_user_ref assente; nessun target remoto. P1 valido.
- MAPPED_UNVERIFIED: candidato presente, ma manca evidenza user/location corrispondente. P1 valido; owner write vietata.
- MAPPED_VERIFIED: evidenza server user/location pertinente e completa. Necessario ma non sufficiente per P2B: servono disponibilità utente, binding/permesso, gate e CAS verificati. In P2A esiste soltanto come fixture sintetica, non come mapping reale attestato.

Il modello read-only minimo contiene remoteUserId, locationId/membership verified, active nullable e role nullable se esposti, readAt ed evidenceRef/source. Niente profili completi, nomi/email/phone, persistenza o migration. Un futuro reader fidato deve produrre l'evidenza; non accettare un oggetto verified dal browser o dal solo inserimento manuale di remote_user_ref. Non viene inventata una durata di validità: P2B deve stabilirla e rileggere/revalidare prima del dispatch. Stato active sconosciuto non è interpretato come true; il planner conserva identità verificata ma sospende il target.

## Specifica pura P2A

`patrimonial-owner-readiness.ts` non è importato da route, handler, worker o store. Espone risoluzione mapping, validazione di **osservazioni normalizzate sintetiche** e planPatrimonialOwnerSync. Non è un decoder del payload HTTP HighLevel provato, né un executor. Input non mutati, proiezione di soli riferimenti/owner/versione, nessuna PII o risposta grezza conservata.

Il checker richiede location/contact/pipeline/native opportunity ID corrispondenti, inventario completo senza cursor residuo e al massimo una opportunity. Missing/empty/malformed assignedTo sono rifiutati. NULL è ammesso **solo con contratto nullable esplicito nelle fixture**; default false, perché la risposta live nullable non è verificata. Ciò non autorizza alcun NULL update. Versione provider mancante/non verificata impedisce un piano di write. L'envelope normalizzato non certifica da solo completezza o freschezza live: il futuro adapter dovrà provarle, legando l'osservazione al dispatch/lease e impedendo il riuso di una lettura precedente al timeout.

PatrimonialOwnerSyncPlan descrive intentId, operatorId, expectedOperatorRevision, opportunityId, remoteUserRef, expectedOwnerRef, targetOwnerRef ed expectedOpportunityVersion. Il target arriva soltanto dal mapping verificato, mai dal current_operator_id; una copia dell'UUID locale nel candidato è rifiutata. Tutti gli esiti riportano **phase=P2A_PLAN_ONLY ed executionAllowed=false**, anche nelle fixture con ownerSync true. Flag assente/false produce HOLD. WRITE_REQUIRED descrive un confronto, non autorizza un'operazione reale; IDEMPOTENT_SUCCESS descrive l'esito atteso, non aggiorna checkpoint.

## Flow e outbox futuri — non implementati

```text
assignment transaction → current_operator_id → lookup operator → remote_user_ref
→ validate remote user/location/availability → durable owner-sync operation
→ claim lease/fencing → read opportunity → compare assignedTo/version
→ conditional update (solo P2B autorizzata) → read-back/reconcile
→ owner_ref / ownerId checkpoint sotto CAS
```

Future effect proposto: ASSIGN_OPPORTUNITY_OWNER, nell'outbox esistente con key idempotente per intent/revisione assignment/target, lease, dispatch marker, retry/backoff e reconciliation. **Non aggiunto all'union TS, CHECK SQL, enqueue o worker P2A.** Nessuna seconda retry queue. Prima del dispatch ricontrollare flag, assignment/operator_revision, mapping/user/location e checkpoint remoto; riassegnazione/deactivate invalida il vecchio target. La specifica expectedProviderVersion non dimostra una primitiva CAS reale del provider.

## Reconciliation design

| Caso | Decisione futura / piano locale |
| --- | --- |
| A: assignedTo già target | IDEMPOTENT_SUCCESS dopo lettura completa/identity check; nessuna update, eventuale checkpoint solo in P2B sotto CAS |
| B: assignedTo diverso | WRITE_REQUIRED solo se owner e versione corrispondono al checkpoint atteso; modifica umana o versione diversa → HOLD / REMOTE_CHANGED |
| C: timeout prima della risposta | Outcome uncertain → RECONCILE_REQUIRED, READ_BEFORE_RETRY; nuova lettura completa prima di qualunque nuovo piano, niente retry write immediato |
| D: opportunity assente | HOLD / OPPORTUNITY_NOT_FOUND; futura MANUAL_REVIEW, nessuna create implicita |
| E: più opportunity compatibili | IDENTITY / HOLD / MANUAL_REVIEW; mai scegliere la prima |
| F: mapping assente | HOLD / UNMAPPED, equivalente REMOTE_OWNER_UNMAPPED; P1 continua locale |
| G: mapping presente non verificato | HOLD / USER_EVIDENCE_UNVERIFIED, stato MAPPED_UNVERIFIED |
| H: utente non disponibile | HOLD / USER_UNAVAILABLE o disponibilità non verificata; futura MANUAL_REVIEW, nessun trasferimento/clear automatico |

OWNER CLEAR = UNVERIFIED: assignedTo null, stringa vuota e omissione non hanno semantica equivalente provata. releaseProspect P1 continua a non modificare owner_ref. Disabilitazione, rimozione dalla Location, cancellazione utente e owner su opportunity già esistente sono tutti da verificare; le fixture esercitano soltanto la nostra policy HOLD, non simulano come HighLevel reagirebbe davvero.

## Verifiche e consegna

`npm run test:patrimonial-owner-readiness`: 14 casi locali richiesti, più incomplete pagination, mismatch contact/pipeline/native ID, evidenza utente incoerente, versione/modifica umana, disponibilità sconosciuta, purezza e proiezione senza PII. Zero chiamate provider write e zero fetch. Test preserva byte-identici tutti i runtime P1/provider/sync/config, route/UI/asset e migration rispetto al HEAD iniziale.

Verifiche eseguite PASS: owner-readiness 1–14, assignment management A–T (SQL solo database effimero locale), persistence, CRM, opportunities, remote mapping, typecheck (tmp esclusa in memoria, no emissione), ESLint sui sorgenti toccati e diff --check. Nessuna migration P2A; file P1 `20261018094926_patrimonial_assignment_management.sql` immutato e **non applicato al remoto**.

Presentation Architetto/Evento restano PRE-EXISTING BASELINE FAILURE con firme prima/dopo identiche; nessun repin/fix di funnel o overflow Evento 4px. Nessun nuovo test browser/live smoke richiesto o eseguito in P2A. tmp/ e audit Radar preesistenti esclusi e intatti. Push limitato al branch autorizzato; nessun main merge/push o deploy manuale/produzione.
