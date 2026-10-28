# Radar Patrimoniale — contratto operativo Hub / Architetti

27 ottobre 2026. Candidata locale, nessuna attivazione remota.

Website codice: `d38b8fdc8c43534c3594768533a05d2a8247e25e`.
Platform: `dc61c8060fc676f514159fb32fba1ed2aa905ebd`.
Hub e portale mantengono le baseline del [report conclusivo](radar-patrimoniale-chiusura-funzionale.md).

## Ingresso e ricevuta

Evento usa il vero `POST /api/public-leads`, contratto `patrimonial-lead-v2`, con `referralCode` opzionale acquisito da `?ref=`.
La RPC server canonica per l'Evento riferito è `public.acquire_patrimonial_event_referral_v2(jsonb,jsonb)`: soltanto il server autorizzato la invoca, senza obbligo HighLevel. Non invocarla dal browser.

La risposta HTTP 202 è una ricevuta, non una conferma commerciale. Il contenuto della pagina grazie e il messaggio di successo sono esclusivamente:

> Abbiamo ricevuto la tua richiesta di partecipazione all'evento.

Restano il marchio e il footer legale comuni. Nessun posto confermato, presenza, chiamata, appuntamento o vendita è registrato da questa ricevuta. Radar usa Supabase Auth, il trasporto server HMAC e le RPC account già implementate. L'email dichiarata nel form Evento da sola non autorizza l'accesso ai report.

## Lettura amministrativa canonica

Con sessione Supabase Auth corrente dell'operatore, attraverso il client Hub esistente:

```ts
supabase.schema('hub').rpc('patrimonial_radar_simple_command', {
  p_command: { method: 'list', filters: { status: 'COMPLETED' } }
})
```

Il risultato conserva `{ok,data:{rows,totals,...}}`. Ogni riga mantiene tutti i campi precedenti e aggiunge **`handoff`**, versione `radar-handoff-1`, tramite la candidata M6. La lettura richiede il permesso corrente `RADAR_PATRIMONIAL_LIST`, sessione viva e gate SQL; errori e dinieghi restano quelli della RPC. Nessun nuovo accesso diretto a tabelle private o schema public.

M6 è necessaria perché le RPC precedenti non esponevano la provenienza privata M4 né il timestamp di completamento senza aprire il dossier Advisor. Non crea una tabella o una seconda anagrafica.

| Campo di rows[].handoff | Origine / significato |
| --- | --- |
| version | `radar-handoff-1` |
| personId | Identità finanziaria stabile, `persons.id`; non è l'ID Auth |
| contactId | Contatto amministrativo della binding attualmente VERIFIED; null se non verificata |
| caseId | Pratica Radar; coincide con `rows[].id` |
| intentId | Intent canonico di tipo RADAR governato da P1 |
| assessmentId | Singola compilazione; una persona può averne molte |
| reportId | Snapshot immutabile; null per una bozza |
| receivedAt | `assessments.created_at`: creazione della compilazione, non ricezione Evento |
| completedAt | `snapshots.completed_at`; null fino al completamento |
| reportState | Stato effettivo `DRAFT` / `COMPLETED`; non una fase commerciale |
| source | `RADAR_LINK`, altrimenti `EVENT` se esiste provenienza Evento verificata/associata antecedente, altrimenti `DIRECT` |
| radarEntry | Ingresso esplicito della compilazione: `RADAR_LINK` oppure entry_mode canonico (`DIRECT/EVENT/POST_EVENT`) |
| referralOperatorId | Provenienza immutabile del link Radar M4; non il proprietario attuale |
| referralAttribution | Esito M4 originario, eventualmente *_REVIEW; non l'autorità corrente |
| p1OperatorId | Proiezione corrente P1, indipendente dalla provenienza del referral |
| assignmentRevision | Revisione P1 corrente, da rileggere prima di un comando |
| assignmentId / assignedAt | Assegnazione P1 non rilasciata della pratica; null se assente |
| assignmentState | `ASSIGNED`, `UNASSIGNED` o `REVIEW`, derivati in lettura; nessun nuovo registro |
| eventRegistrations[] | ID canonico registrazione, receivedAt=registered_at, status effettivo, referralOperatorId e referralAttribution di quella registrazione |
| eventRequests[] | ID canonico request_id, receivedAt e receiptStatus della ricevuta ledger Evento collegata |

Le liste Evento comprendono soltanto collegamenti al contatto verificato, antecedenti alla creazione del Radar; registrazioni CANCELLED e ricevute in review sono escluse dalla relativa lista. Non scegliere arbitrariamente “l'ultimo Evento”: possono esistere più iscrizioni. I due array hanno identificativi distinti e non devono essere fusi per somiglianza.

`source=EVENT` indica associazione verificata all'Evento, **non prova di un click o di presenza**. Un Radar aperto direttamente dopo un Evento ha `source=EVENT, radarEntry=DIRECT`. Se usa esplicitamente anche un link Radar, prevale `RADAR_LINK`, conservando gli array Evento. Il referral Evento resta nella propria registrazione: non viene inventato un referral Radar.

## Coda e assegnazione

- **ASSIGNED:** binding verificata, contatto e intent coerenti, assegnazione P1 corrente e architetto attivo/abilitato con identità collegata. Il proprietario è p1OperatorId, mai referralOperatorId.
- **UNASSIGNED:** contatto verificato, nessuna review aperta o incoerenza, nessun responsabile corrente. Per “Radar Patrimoniale → Da assegnare” usare reportState=COMPLETED e assignmentState=UNASSIGNED.
- **REVIEW:** identità non riconciliata, review aperta, proprietà discordante o responsabile non valido. Non distribuire automaticamente. Conservare report, audit e responsabili preesistenti.

La query può restringere `filters.operatorId='UNASSIGNED'` e `filters.status='COMPLETED'`, **ma deve poi distinguere handoff.assignmentState**: null operatorId non basta a separare coda e verifica.
I campi storici `origin`, `eventLinked`, `linkReview`, i filtri e i totali mantengono la loro semantica precedente. Non usare il vecchio origin per dedurre RADAR_LINK.

REVIEW può coesistere con un proprietario P1 preesistente: l'etichetta amministrativa non rilascia l'assegnazione né concede/revoca automaticamente il dossier. Una review personale aperta resta visibile anche dopo un'assegnazione manuale; la risoluzione esplicita del collegamento segue i comandi di revisione esistenti. Non modificare la provenienza immutabile per far sparire un avviso.

Le operazioni autorizzate restano `patrimonial_radar_simple_command` con method `assign/reassign/release/link/unlink`, requestId e revisioni previste dal contratto 5C/5D. Nessun writer P1 alternativo. Il prelievo controllato e la scelta degli architetti disponibili appartengono al task commerciale.

## Due viste Hub e portale personale

| Vista / esigenza | RPC / identificativo |
| --- | --- |
| Hub → Radar Patrimoniale | `hub.patrimonial_radar_simple_command({method:'list'})`; aprire `person` con personId; `report` con caseId |
| Hub → Rete Architetti → Clienti | `hub.architetti_client_detail(p_contact uuid)`; assessments[].id è assessmentId, caseId e reportId sono gli stessi |
| Portale personale, elenco metadati | `hub.architetti_personal_radar(p_contact_id uuid,p_case_id:null)` |
| Portale personale, dossier | Stessa RPC con caseId; richiede propria competenza P1 e Advisor |
| Dossier Hub | `hub.patrimonial_radar_simple_command({method:'report',id:caseId})`; Advisor corrente e sessione valida |

Il permesso LIST non concede il dossier. La sola qualifica Hub superiore non aggira il controllo di propria competenza del portale. Revoca Advisor, sessione non valida, operatore estraneo o riassegnazione vengono rivalutati dal database; il codice referral non è un'autorizzazione.
Non passare risposte, snapshot.result o dossier nel payload commerciale o nelle notifiche. Nessun service-role nel frontend.

## Confine con il task commerciale parallelo

Questo contratto consegna riferimenti e stati. Il task Hub/Architetti realizza coda/prelievo controllato, telefonate manuali, esiti e tentativi, appuntamenti fissati/svolti, trattative/proposte, contratti/persi con motivazione, richiami e riassegnazioni autorizzate.
Gestisce inoltre 72 ore senza contatto riuscito, nessun tentativo rispetto a tentativi senza risposta, avvisi, scadenze e performance. Tali azioni non derivano da un assessment COMPLETED.

Collegare gli eventi commerciali allo stesso contactId e alle pratiche pertinenti, senza duplicare opportunità per iscrizione/compilazione. `assignedAt` è il riferimento dell'assegnazione corrente; non receivedAt/completedAt per l'avviso delle 72 ore.
Email informative, promemoria con data/partecipazione confermate, WhatsApp e workflow HighLevel richiedono le approvazioni del task parallelo. Qui HighLevel resta OFF e nessuna comunicazione è inviata.

## Collaudo ed attivazione

11 verifiche incrementali native locali PASS, incluse iscrizione **HTTP reale Next** e visibilità degli stessi report nelle RPC delle tre viste. [Evidenza](functional-closure-evidence/handoff.json).
Le 68 prove precedenti restano distinte e verificate tramite hash. Provider Auth/SMTP, nuove Preview, utenti reali e operazioni remote sono NOT RUN.
La disponibilità remota di questo contratto richiede l'approvazione della catena M1→M2-5D→M3-5D→M4→M5→M6 e dei soli artefatti coordinati; nessuna migration è stata applicata sul progetto Horyzon.
