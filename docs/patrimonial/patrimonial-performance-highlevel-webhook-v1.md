# Patrimonial HighLevel performance ingestion — P3B v1

18 ottobre 2026. Branch `feat/patrimonial-pilot-funnels`. Baseline P3 remoto installato: `e1c46e5fdc8e9ede1594b8c7c6b5e80684c10f7f`.

**P3B v1 è implementato e verificato sul branch, ma non attivato live.** Nessun webhook HighLevel è stato sottoscritto, nessun flag remoto è stato abilitato, nessun merge/push su main e nessun evento reale è stato scritto nel ledger P3.

## Endpoint

Route server:

`POST /api/webhooks/highlevel/patrimonial-performance`

Il route legge il raw body prima del parsing e verifica esclusivamente `X-GHL-Signature` con Ed25519, usando la public key ufficiale HighLevel. Il fallback RSA legacy non è implementato: la documentazione HighLevel indica `X-WH-Signature` come legacy/deprecato e, alla data corrente, `X-GHL-Signature` è il meccanismo corrente.

Limite body: 64 KiB. Payload malformato → 400. Firma assente/non valida → 401. Store/config temporaneamente indisponibile → 503, così HighLevel può ritentare. Un conflitto idempotenza già verificato viene invece riconosciuto come MANUAL_REVIEW con 200, perché un retry cieco non può correggere semantiche divergenti.

## Eventi sottoscrivibili in v1

P3B registra soltanto:

- `OpportunityStageUpdate` → `STAGE_CHANGED`
- `OpportunityStatusUpdate` con status `won` → `CLOSED_WON`
- `OpportunityStatusUpdate` con status `lost` → `CLOSED_LOST`
- `OpportunityStatusUpdate` con status `abandoned` → `CLOSED_ABANDONED`

Status `open` viene riconosciuto ma non produce un evento P3, perché v1 non ha una semantica autonoma di "reopened".

`OpportunityAssignedToUpdate` non viene trattato come OWNERSHIP_TAKEN. Assegnazione CRM e presa in carico operativa restano fatti diversi.

Messaggi, inbound message e appointment webhook restano fuori da P3B v1: identificano contatto/calendario, ma non garantiscono quale pratica patrimoniale debba ricevere l'attribuzione. Nessun matching per email/nome/contact-only.

## Identity gates

Dopo la verifica firma, il payload deve:

1. appartenere a `HIGHLEVEL_LOCATION_ID`;
2. usare uno dei pipeline ID patrimoniali versionati;
3. per stage update, usare uno stage ID noto del pipeline;
4. avere opportunity ID + contact ID coerenti con il context P3;
5. risolvere una sola assignment valida all'istante dell'evento;
6. avere funnel della pratica coerente col pipeline HighLevel.

Un mismatch viene ignorato fail-closed e non crea performance event.

Lo stage provider viene normalizzato al codice interno (A01…A10, E01…E05, C01…C05), non conservato come etichetta arbitraria.

## Event time

Per attribuire correttamente eventi consegnati in ritardo, P3B usa solo un `timestamp` ISO presente nel payload firmato.

La documentazione specifica HighLevel di OpportunityStageUpdate / OpportunityStatusUpdate mostra `dateAdded`, ma non documenta `timestamp` nel relativo schema. `dateAdded` è il tempo di creazione dell'opportunity, quindi P3B **non** lo usa come tempo della modifica.

Se un delivery reale non contiene `timestamp`, lo stato è `IGNORED_MISSING_TIMESTAMP` e non viene scritto un evento. Il primo live smoke deve quindi verificare la shape effettiva. Se HighLevel non invia un event timestamp per questi webhook, la remediation dovrà usare una lettura provider verificata di `lastStageChangeAt` / `lastStatusChangeAt` prima di attivare il tracking live; non usare l'ora di ricezione come sostituto silenzioso.

## Idempotenza

HighLevel raccomanda di deduplicare per webhook ID. P3B usa:

- `webhookId` quando presente;
- fallback `body:<sha256(raw body)>` quando webhookId è assente.

La event key Horyzon è derivata con SHA-256 dal sourceRef e non contiene PII.

Il ledger P3 ha già UNIQUE su `(source, source_ref)` e payload hash semantico; retry dello stesso delivery restituisce la stessa riga. Stesso sourceRef con semantica diversa produce conflitto/manual review.

## Feature gates

Sono richiesti entrambi:

- `PATRIMONIAL_PERFORMANCE_TRACKING_ENABLED=true`
- `PATRIMONIAL_HIGHLEVEL_PERFORMANCE_WEBHOOK_ENABLED=true`

Se uno dei due è false/assente, un webhook validamente firmato viene riconosciuto ma risponde `DISABLED` senza costruire lo store e senza RPC.

I flag remoti non sono stati modificati.

## HighLevel authorization model

La documentazione HighLevel distingue chiaramente Private Integration Token e OAuth Marketplace App:

- Private Integration: adatto ad API interne quando **non servono webhooks**.
- OAuth Marketplace App: richiesto per webhook subscriptions.

Quindi il PIT già usato da Horyzon/Composio non è il meccanismo di subscription di P3B. Per il go-live occorre usare/configurare l'app OAuth Marketplace Horyzon, installata sulla Location corretta.

In Advanced Settings → Webhooks dell'app OAuth:

- URL futuro di produzione: `https://horyzon.it/api/webhooks/highlevel/patrimonial-performance`
- eventi iniziali: `OpportunityStageUpdate`, `OpportunityStatusUpdate`

Non sottoscrivere ancora OutboundMessage, InboundMessage, AppointmentCreate/Update o AssignedToUpdate per P3B v1.

## Verifica locale/preview

Script:

`npm run test:patrimonial-performance-webhook`

PASS verificato su build Vercel Preview.

Copertura:

- firma Ed25519 valida;
- modifica anche di un solo byte del raw body → firma non valida;
- flag off → zero store call;
- wrong location / unsupported event / unknown pipeline / unknown stage → ignore;
- missing timestamp → ignore;
- context opportunity→assignment reale su PGlite;
- stage mapping remote ID → codice interno;
- won status → CLOSED_WON;
- status open → ignore;
- contact/funnel mismatch → ignore;
- replay stesso webhook ID → stessa performance row;
- stesso webhook ID con payload diverso → conflict;
- fallback body hash senza webhookId → replay idempotente.

Build TypeScript/Next.js successiva: PASS.

## Stato e prossimo confine

P3B code: **READY_FOR_ACTIVATION_PREFLIGHT**.

Non ancora verificati live:

- presenza reale di `timestamp` / `webhookId` nei delivery OpportunityStageUpdate/StatusUpdate;
- installazione/configurazione dell'OAuth Marketplace App sulla Location Horyzon per questi due eventi;
- delivery reale firmato HighLevel → endpoint produzione → Supabase P3;
- retry reale e dashboard webhook HighLevel;
- circuit breaker/health behavior in produzione.

Per attivare in sicurezza serve: endpoint su deploy Production approvato, env Production completi, flag inizialmente off, configurazione webhook OAuth, synthetic opportunity, poi accensione controllata e smoke di stage/status con verifica dei log. Nessun main/production deploy è compreso in P3B v1.
