# Inventario patrimoniale HighLevel v1 — FASE 2B.2A

Data: 14 ottobre 2026. Repo canonica: `HORYZON-ORG/horyzon-website`.
Branch: `feat/patrimonial-pilot-funnels`.
Baseline: `d3b7b6de1b886c21542653f39c869cd548c4d385`.
Contratto vincolante, riletto integralmente: [contratto 2B.1](patrimonial-highlevel-contract-v1.md).

## 1. Executive summary

**REMOTE INVENTORY: PARTIALLY VERIFIED — aggiornamenti forniti dall'utente per le FASI 2B.2B-2 e 2B.2B-3.**

La precedente classificazione BLOCKED descriveva l'accesso disponibile durante la FASE 2B.2A; non è più lo stato assoluto dell'account. L'utente comunica una verifica ChatGPT in sola lettura sulla connessione attiva del sub-account **High Level - HORYZON**, timezone `Europe/Rome`, website `https://www.horyzon.it`, con contacts, opportunities, appointments/calendars, workflows e tags abilitati. Questa evidenza è fornita dall'utente: non sono state effettuate nuove chiamate remote dall'agente per confermarla.

Impostazioni comunicate: `allowDuplicateContact=false`, `contactUniqueIdentifiers=[email, phone]`, `allowDuplicateOpportunity=false`. Pipeline presente: **Marketing Pipeline**, stage nell'ordine New Lead, Contacted, Qualified, Proposal Sent, Negotiation, Closed. La location ha restituito **0 custom fields**; lo scope dell'oggetto/lettura non è ulteriormente dettagliato, quindi il mapping dei campi resta da validare prima di CREATE. Opportunity search ammette `open`, `won`, `lost`, `abandoned`; questo non certifica gli enum o i permessi di scrittura.

Ulteriore verifica comunicata per 2B.2B-3: il rifiuto di opportunity duplicate riguarda **lo stesso contatto nella stessa pipeline**, non pipeline differenti. Non serve un test remoto per questa domanda. Il dominio consente A/E/C separati per lo stesso contatto; Evento usa una sola relazione E collegata a Participation distinte per contatto + edizione.

Restano UNKNOWN: user ID, elenco completo calendari, workflow effettivi, catalogo tag, native close reason, booking/write e webhook. Nessun ID location o risorsa viene inventato. L'abilitazione di una funzione nell'account non certifica endpoint, scope, paginazione o semantica create-only. L'adapter 2B.2B-2 richiede configurazioni server dichiarate verificate; non installa lookup o mapping tag presunti. Le sezioni di inventario originale sotto restano evidenza storica della baseline 2B.2A e vanno lette insieme a questi aggiornamenti, che prevalgono per i fatti ora comunicati.

### Implementazione locale 2B.2B-3

[patrimonial-routing.ts](../../src/lib/public-leads/patrimonial-routing.ts) definisce le tre pipeline, stage, status, close reason, comandi con revisione attesa, attori e prerequisiti. Richieste successive preservano stage e first touch; chiusure richiedono un motivo, riaperture un comando owner con evidenza (A WON non riapribile). Ogni OPEN richiede next step e data; cambi di stage/prossima azione richiedono una data futura esplicita. Il no-show della presentazione torna A02 solo se è richiesta riprogrammazione, altrimenti rimane A03/REVIEW. Nessuna assenza chiude automaticamente A o crea C.

Evento usa una E per contatto, indipendente dall'edizione; Participation ha revisione, snapshot edizione, registrazione, presenza ed evidenze proprie. Scelta della seconda edizione non duplica E e non azzera lo stage. Il generico PENDING_EDITION viene promosso oppure assorbito nella partecipazione esistente preservando request ID e storico. Non esistono mirror `hz_event_*` sull'opportunity, compreso slug/CURRENT/LATEST: quei dati restano nel registro e negli snapshot delle richieste. Riapertura esplicita conserva remote ID e cicli; C mantiene più origini, ma nasce solo da richiesta esplicita o azione umana autorizzata.

`PatrimonialPipelineMapping` è solo server-side, con location/pipeline/stage/field ID iniziali `null`, incluso il binding close reason UNRESOLVED. Il sync esplicito richiede V2 + CRM_WRITE + OPPORTUNITY_WRITE, mapping completo per la pipeline interessata e capability read/write. Blocca pipeline ID coincidenti, revisioni obsolete e scritture su modifiche umane remote; create con esito incerto/409 richiedono riconciliazione esatta, senza retry create ciechi. Altri programmi A/finalità C già presenti nella medesima pipeline con chiave diversa vanno in revisione, senza tentare una seconda create.

I tre metodi opportunity del provider reale sono stub senza trasporto anche con flag true. Il contratto di update futuro richiede una versione provider per confronto atomico: questo supporto non è certificato né attivato. Store di produzione e collegamento al form restano non configurati; lo store memory e il provider completi sono soltanto test. Nessun nuovo scheduler, endpoint, booking, messaggio o migration. La suite `npm run test:patrimonial-opportunities` copre i 30 casi richiesti e le regressioni ledger/contatti/legacy/2A/Radar. Zero chiamate HighLevel, Supabase, Composio o altri servizi e zero risorse reali create/modificate in questa fase.

### Implementazione locale 2B.2B-2

L'[adapter patrimoniale](../../src/lib/public-leads/patrimonial-highlevel.ts) e il worker esplicito in [patrimonial-sync.ts](../../src/lib/public-leads/patrimonial-sync.ts) separano RESOLVE_CONTACT, UPSERT_CONTACT, ADD_TAGS e ADD_NOTE, con checkpoint, dipendenze e lease/fencing nello store. Il contatto esistente non viene aggiornato con dichiarazioni anonime: source, owner e telefono restano preservati. Per NEW è richiesto un binding create-only verificato, così un contatto comparso nel frattempo non viene sovrascritto tramite upsert. Lookup e decodifica/paginazione restano binding server da verificare, non endpoint inventati. I quattro tag pilota richiedono una allowlist verificata; notesRead resta UNKNOWN per default e impedisce il blind retry della nota. Nessuna configurazione reale o flag è stato attivato.

Il worker si invoca esplicitamente: nessun cron, endpoint worker, messaggio o attivazione automatica dal form. Lo store durevole di produzione resta uno stub non attivabile della fase precedente; le verifiche locali usano esclusivamente fixture memory/provider fake. Non sono state introdotte opportunity, calendari, booking, workflow, webhook o custom field. Lo stato PARTIALLY VERIFIED descrive le evidenze dell'account fornite dall'utente, non un collaudo live dell'adapter.

### Baseline storica FASE 2B.2A

In quella fase la parte locale era completata. Nessun accesso remoto era stato usato: zero chiamate HighLevel, Composio, Supabase o altri servizi; zero risorse remote lette; zero scritture remote e zero messaggi. Non erano stati avviati browser, server, canary, migrazioni o test live. Il resto del documento conserva quella fotografia della baseline, con l'aggiornamento corrente sopra.

Nella baseline 2B.2A il blocco scattava prima delle chiamate perché l'agente non poteva verificare connessione e location; il solo adapter allora presente era POST. Questo non provava che il token fosse write-only o che HighLevel non supportasse letture. La discovery Composio non era stata chiamata. Le evidenze di location ora comunicate dall'utente sono registrate sopra, mentre scope specifici e binding mancanti restano gate futuri.

L'ispezione delle configurazioni ha estratto esclusivamente **nomi**, senza stampare valori: `.env.example` dichiara `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; nessun nome pertinente HighLevel/Supabase/patrimoniale/Redis/Postgres è risultato in `.env.local` o nelle variabili del processo. I nomi `HIGHLEVEL_PRIVATE_TOKEN` e `HIGHLEVEL_LOCATION_ID` esistono nel codice. Ciò non descrive le env di produzione, che non sono state lette, e non verifica se i valori del template siano configurati.

Risultati utilizzabili:

- Trasporto CRM locale: upsert contatto, aggiunta tag e nota; nessun lookup CRM, opportunity, calendario o webhook patrimoniale implementato.
- Pattern durevoli disponibili nel codice: Supabase/Postgres via REST/RPC, vincoli unici, lock e lease in Annunci 10x, revisioni Radar e runtime store AI Score. Applicazione delle migration, raggiungibilità, piano/costi e permessi remoti sono sconosciuti.
- Primaria raccomandata: riuso dell'infrastruttura Supabase/Postgres Horyzon, **se verificata**, con ledger/outbox patrimoniali dedicati e RPC atomiche. Nessuna tabella di altri prodotti da riutilizzare come contenitore.
- Unico fallback operativo: mantenere la baseline 2A, con v2 non attivata e gestione umana dei casi incerti. Non è un secondo store durevole e non soddisfa le garanzie v2; non è ammesso un downgrade automatico di richieste v2 alla 2A.
- Mapping interamente `UNKNOWN`/`VERIFY`, senza ID inventati. Nessuna risorsa può essere classificata `MISSING` senza un inventario remoto completo e autorizzato.
- Prossimo intervento proposto: 2B.2B-1, solo dopo approvazione dello store e dei confini del contratto; non autorizzato né implementato da questo report.

È creato soltanto questo documento. Codice, `.env.local`, `.gitignore`, contratto 2B.1 e `tmp/` restano intatti. Restano esclusi push, deploy, merge, modifiche a `/benessere-patrimoniale`, modifiche funzionali a `/contatti`, nuove pipeline, automazioni o servizi esterni in questa fase. Le configurazioni future elencate sotto richiederanno autorizzazione separata.

## 2. Capacità locali

### Fonti ed evidenza

| Fonte | Evidenza osservata, non deduzione sul remoto |
| --- | --- |
| [AGENTS.md](../../AGENTS.md), [DESIGN.md](../../DESIGN.md) | Riletti; lavoro solo documentale, nessun codice Next scritto. Il vecchio permesso di push in DESIGN non prevale sul divieto corrente |
| [Adapter Radar](../../src/lib/radar/highlevel.ts) | Base `https://services.leadconnectorhq.com`; header `Version: 2021-07-28`; Bearer server-side; `callHighLevel` usa sempre POST; `fetchImpl` iniettabile |
| [Handler pubblico](../../src/lib/public-leads/handler.ts) | Pilota e legacy chiamano upsert → tags → notes; timeout 10 s/chiamata nel percorso pubblico; 502 può seguire effetti parziali; nessun ledger |
| [Validazione pilota](../../src/lib/public-leads/patrimonial-funnels.ts), [contenuti](../../src/content/patrimonial-funnels.ts) | Due mode, enum, source path, consensi e UTM; titolo evento configurabile ma nessuna edizione/booking reale |
| [Persistenza Radar](../../src/lib/radar/persistence/adapter.ts) | Supabase REST/RPC, profilo schema `hub`, controllo ownership/revisioni; factory richiede URL e service role |
| [Persistenza Annunci](../../src/lib/annunci-10x/persistence/adapter.ts), [runner](../../src/lib/annunci-10x/analysis-run.ts) | REST GET/POST/PATCH e RPC Postgres; claim persistenti e lease; adapter memory separato per simulazioni |
| [Runtime store AI Score](../../src/lib/ai-score/runtime-store.ts) | `supabase_rpc` oppure memory non persistente; fallback memory se flag/config mancanti. Non copiare questo fallback per ricevute patrimoniali |
| [package.json](../../package.json), `supabase/migrations/` | Migration SQL versionate; nessun client Redis/KV o driver Postgres diretto nelle dipendenze; uso Supabase tramite fetch |
| Ricerca locale in `src`, `scripts`, file tracciati e metadata tool | Nessun helper CRM ulteriore o mapping locale pipeline/utenti/calendari trovato; nessun file MCP/Composio tracciato trovato. Il catalogo tool Composio è orchestration, non prova di accesso al sub-account |

Nessuna ricerca ha usato `tmp/` come sorgente. Il semplice stato Git `?? tmp/` non è un inventario del suo contenuto. Le “opportunities” AI Score e le “pipeline” di generazione non sono opportunità/pipeline HighLevel.

### Matrice obbligatoria, completata prima di qualsiasi chiamata remota

“No” in READ/WRITE significa helper non presente nel repository analizzato, non limite del prodotto. Le autorizzazioni qui sono **capacità minime da verificare**, non scope concessi: gli slug OAuth/PIT esatti non sono dichiarati nel codice e restano `UNKNOWN`. Non proporre un token admin generico per aggirare questa verifica.

| RISORSA | READ SUPPORTATO LOCALMENTE? | WRITE SUPPORTATO LOCALMENTE? | API/TOOL | SCOPE NECESSARIO | VERIFICATO / NON VERIFICATO |
| --- | --- | --- | --- | --- | --- |
| Location | No | No | `locationId` solo da config/payload; nessun endpoint di lettura | Lettura identità, timezone, impostazioni della singola location; slug UNKNOWN | Dipendenza locale verificata; location/scope non verificati |
| Contacts | No | Sì, upsert | POST `/contacts/upsert` | Lettura lookup email/telefono e contatto; scrittura contatti; slug UNKNOWN | Metodo/payload locali verificati; account e matching non verificati |
| Notes contatto | No | Sì, append | POST `/contacts/{id}/notes` | Lettura note per riconciliazione e scrittura note; slug UNKNOWN | Implementazione verificata; lookup e permessi non verificati |
| Opportunities | No | No | Nessun helper; Composio discovery non eseguita | Lettura/search opportunity e scrittura stage/status/owner/campi nella location; slug UNKNOWN | Assenza locale verificata; remoto non verificato |
| Pipelines/stage | No | No | Nessun helper | Lettura configurazione pipeline/stage; futura gestione solo se autorizzata; slug UNKNOWN | Locale verificato; remoto non verificato |
| Custom fields | No | No | Nessun helper per schema contact/opportunity o relativo mapping | Lettura definizioni/opzioni; futura scrittura schema e valori separatamente; slug UNKNOWN | Locale verificato; remoto non verificato |
| Calendars | No | No | Nessun helper | Lettura calendari, team e disponibilità; futura gestione separata; slug UNKNOWN | Locale verificato; remoto non verificato |
| Users | No | No | Nessun helper | Lettura utenti assegnabili della location, stato e permessi minimi; slug UNKNOWN | Locale verificato; remoto non verificato |
| Workflows | No | No | Nessun helper | Lettura metadata, stato e trigger se esposti; nessuna modifica ora; slug UNKNOWN | Locale verificato; remoto non verificato |
| Tags | No, neppure catalogo | Sì, add al contatto; non CRUD del catalogo | POST `/contacts/{id}/tags` | Lettura catalogo/assegnazioni e aggiunta tag; slug UNKNOWN | Chiamata locale verificata; esistenza tag/scope non verificata |
| Appointments | No | No | Nessun helper | Lettura status/booking e futura creazione/update/cancellazione; slug UNKNOWN | Locale verificato; remoto non verificato |
| Webhooks HighLevel | No | No | Nessuna sottoscrizione o route patrimoniale | Eventi/autenticazione compatibili con tipo di integrazione; eventuali permessi di subscription UNKNOWN | Locale verificato; remoto non verificato |

L'adapter condiviso non offre GET, PUT, PATCH o DELETE configurabili. Un POST potrebbe essere una ricerca in un'API futura, ma i tre path presenti sono scritture: **non usarli per verificare credenziali/location**. I webhook Stripe di altri prodotti non provano autenticazione o supporto degli eventi HighLevel.

Il trasporto condiviso include una porzione di body remoto negli errori; l'handler patrimoniale li intercetta senza esporli. Il futuro adapter deve sanificare errori/log all'origine, senza modificare il comportamento Radar in questo intervento.

## 3. Inventario remoto, se autorizzato

**REMOTE INVENTORY: PARTIALLY VERIFIED**, secondo l'aggiornamento dell'utente in §1. La tabella seguente conserva i risultati storici della FASE 2B.2A; nome, timezone, website e impostazioni ora comunicati sono aggiornati in §1. Nessuna nuova richiesta è stata inviata dall'agente, neppure per testare token o capacità. L'implementazione 2B.2B-2 usa soltanto provider fake: zero scritture e zero letture remote in questa fase.

| Elemento richiesto | Risultato | Evidenza necessaria per sbloccare |
| --- | --- | --- |
| Location ID effettivamente usata | UNKNOWN; nessun ID da mascherare | Riferimento Horyzon attendibile e connessione legata a quella location, senza credenziali nel report |
| Nome location | UNKNOWN | Metadata di location letti nel contesto verificato |
| Timezone | UNKNOWN | Valore effettivo; `Europe/Rome` nel contratto è proposta dominio, non evidenza dell'account |
| Settings rilevanti | UNKNOWN | Matching duplicati, permessi/tipo integrazione e capacità piano leggibili |
| Accesso read e scope | UNKNOWN | Connessione autorizzata, read consentito, selezione esplicita account/location |
| Token/config produzione | Non letti | Non necessari al documento; nessuna richiesta di incollarli in chat |

Procedura futura di sola lettura, da eseguire dopo sblocco: fissare la location e l'account autorizzati → leggere identità/location con tool che esponga lo scope → confrontare ID e nome attesi → interrompere su mismatch → leggere metadata pipeline/campi/tag/utenti/calendari/workflow e impostazioni dedup → registrare permessi, paginazione, timestamp e completezza. Terminare tutte le pagine prima di dichiarare un elemento assente. Mascherare location ID nel report condiviso; mantenere il mapping integrale solo nella configurazione server autorizzata.

Per gli utenti usare alias funzionali/ID e soltanto ruoli/stato necessari; omettere email, telefono e dati personali superflui. Non elencare contatti o appuntamenti reali per scoprire capacità: consultare schema/config e, se necessario, descrivere un test sintetico futuro. Una ricerca restituita vuota per permessi insufficienti non prova assenza.

## 4. Pipeline esistenti

Inventario effettivo: **UNKNOWN**, non lista vuota. Nomi, ID, stage, ordine e status remoti non sono stati letti. Nessuna pipeline candidata al riuso è verificata.

| Pipeline logica | Struttura richiesta dal contratto | Verifica remota necessaria | Esito |
| --- | --- | --- | --- |
| ARCHITECT_PATH | A01–A10, ordine contrattuale; A09 WON, A10 LOST/ABANDONED | Nome/ID, stage ID e ordine, status e motivo chiusura, compatibilità con opportunità aperta per programma/ciclo | UNKNOWN |
| PATRIMONIAL_EVENT | E01–E05, una relazione E per contatto + Participation per contatto/edizione | Pipeline/stage; riuso E tra edizioni, stati registrazione/presenza locali separati | UNKNOWN |
| PATRIMONIAL_CONSULTATION | C01–C05, richiesta esplicita e ciclo propri | Pipeline/stage, riuso C aperta tra edizioni e riferimenti a E | UNKNOWN |

Lo stato dominio ABANDONED non è dimostrato come enum nativo HighLevel: nessun mapping automatico a LOST o altro senza decisione e verifica. Non duplicare una pipeline esistente soltanto perché il nome differisce. Non rinominare o riordinare pipeline condivise per adattarle al pilota. WON operativo Evento/Confronto resta separato dai ricavi.

## 5. Custom fields

Inventario remoto contact/opportunity: **UNKNOWN**. Nessun campo `hz_*` remoto verificato. Il codice 2A invia qualificazioni e consensi in nota, non in custom field: presenza in nota e presenza dello schema CRM sono cose diverse.

Classificazione da usare dopo lettura completa:

| Classe | Criterio | Azione futura, mai eseguita qui |
| --- | --- | --- |
| REUSE | Stesso oggetto, semantica, tipo, key e opzioni compatibili | Mappare ID reale, preservare altri utilizzatori |
| CREATE | Assenza accertata con permessi e paginazione completi | Proporre solo il campo minimo mancante; creazione autorizzata separatamente |
| CONFLICT | Nome/key simili ma oggetto, tipo, opzioni o significato incompatibili | Fermare mapping e concordare adattamento, senza sovrascritture |
| VERIFY | Schema non letto o evidenza incompleta | Mantenere UNKNOWN, nessuna creazione dedotta |

Tutti i campi del mapping §15 sono ora **VERIFY**. Alla futura lettura registrare per ciascuno nome reale, ID, object contact/opportunity, tipo effettivo, key/name e opzioni complete con relativi identificativi se esistenti. Le definizioni e gli enum vincolanti restano nelle sezioni 1, 4 e 5 del contratto: nessuna opzione accorciata o convertita arbitrariamente.

Verifiche particolari: timestamp ISO UTC non ridotti a data senza ora; testo lungo fino a 1.500 caratteri; enum distinti tra profili A/E; owner/stage/status nativi; motivo chiusura nativo prima del custom condizionale `hz_close_reason`. `hz_assigned_owner` è alias del nativo, non un custom field da creare. Non creare checkbox path_started/activated o mirror del confronto sul contatto/Evento.

## 6. Tag

| Nome esatto richiesto | Uso locale/contrattuale | Esistenza e ID remoti | Azione successiva |
| --- | --- | --- | --- |
| horyzon-patrimoniale | Base pilota A/E | UNKNOWN | Lettura catalogo, preservare eventuali usi |
| percorso-architetto-patrimoniale | Interesse A | UNKNOWN | Verificare, non implica idoneità |
| evento-patrimoniale | Interesse E | UNKNOWN | Verificare, non implica conferma |
| pilot | Coorte pilota | UNKNOWN | Decisione sulla coorte futura; nessuna rimozione ora |
| horyzon-benessere-patrimoniale | Legacy | UNKNOWN | Preservare |
| horyzon-evento-patrimoniale | Legacy evento | UNKNOWN | Preservare |
| horyzon-percorso-consulenti | Legacy percorso | UNKNOWN | Preservare |

Nessun tag aggiunto/rimosso. Il fatto che una POST possa aggiungere tag non prova che i sette tag siano già presenti o privi di workflow collegati. Verificare conflitti prima di qualsiasi successiva scrittura, compresa una scrittura contatto che sembri innocua. Conservare i tag Radar; niente tag per consenso, stage o presenza.

## 7. Users

Utenti disponibili, user ID, stato attivo/inattivo, ruolo/permesso e assegnabilità: **UNKNOWN**. Nessun nome candidato del contratto diventa assegnazione reale.

| Ruolo logico da mappare | Remote user ID | Verifica/decisione futura |
| --- | --- | --- |
| ARCHITECT_COORDINATOR | UNKNOWN | Incarico, accesso coda iniziale e sostituto |
| ARCHITECT_OWNER | UNKNOWN | Pool ammesso, continuità relazione, carico |
| ARCHITECT_INTERVIEWER | UNKNOWN | Competenza, calendario e disponibilità |
| ARCHITECT_ACTIVATION_APPROVER | UNKNOWN | Autorità per criteri/attivazione |
| EVENT_COORDINATOR | UNKNOWN | Gestione edizioni e classificazione presenza |
| EVENT_HOST | UNKNOWN | Host reale e sostituto; volto pubblico non basta |
| PATRIMONIAL_CONSULTATION_OWNER | UNKNOWN | Competenza, incarico e calendario |

Verificare appartenenza alla location e permessi effettivi, non solo stato “attivo”. Disponibilità calendario e possibilità di assignment sono controlli distinti. Nessun round robin iniziale; nessuna riassegnazione di owner contatto Radar per assegnare un'opportunità patrimoniale. Coda senza owner possibile solo se presidiata da un responsabile nominato; in assenza non si attiva il routing automatico.

## 8. Calendars

Calendari esistenti e candidati riutilizzabili: **UNKNOWN**. Non sono noti nome, ID, tipo, durata, owner/team, timezone, disponibilità, capienza/gruppo o reminder.

| Chiave logica proposta di mapping | Nome desiderato dal contratto | Requisito da confrontare, non configurazione attuale |
| --- | --- | --- |
| ARCHITECT_PRESENTATION_CALENDAR | Presentazione Architetto Patrimoniale | Sessioni di gruppo, 30–40 min indicativi; host/sostituto; buffer proposto 10 min; invito riservato |
| ARCHITECT_INTERVIEW_CALENDAR | Colloquio Architetto Patrimoniale | 30 min proposti; intervistatore; buffer 10 min proposti; accesso dopo qualificazione |
| PATRIMONIAL_CONSULTATION_CALENDAR | Appuntamento Benessere Patrimoniale | 30 min proposti; owner competente; disponibilità e sostituzioni approvate |

Controllare orario settimanale/eccezioni, fuso IANA e DST, gestione cancellazioni/riprogrammazioni, modalità d'accesso, reminder già attivi e invii nativi che la creazione del booking potrebbe innescare. L'edizione webinar richiede registro/accessi propri; non si presume un quarto calendario né una piattaforma esterna nuova.

## 9. Workflows

Inventario nome/ID/stato active-draft/trigger principale: **UNKNOWN**. Nessun workflow è stato letto, creato, attivato o disattivato. L'assenza di codice workflow nel repository non dimostra un account senza automazioni.

| Superficie di conflitto da leggere | Rischio da verificare prima di attivare v2 |
| --- | --- |
| Sette tag patrimoniali/legacy, anche tag già presenti | Messaggi o opportunity duplicate; reingresso non osservabile da tag persistenti |
| Nuovo contatto/upsert/aggiornamento contatto | Invii indipendenti dai flag applicativi |
| Creazione opportunity/cambio stage/status/owner | Avanzamenti e task concorrenti al motore patrimoniale |
| Booking calendario | Conferma/reminder CRM più invii applicativi |
| No-show/appointment status/cancellazione | Vecchi reminder, chiusure o classificazioni incoerenti |

Se il tool permette solo il nome/stato, il trigger resta UNKNOWN e l'audit non è completo. In un futuro test di scrittura il flag messaggi false **non impedisce** workflow nativi preesistenti: gate di audit e neutralizzazione in ambiente controllato autorizzato prima di creare contatti/booking sintetici. Scegliere un solo esecutore per ciascun messaggio, non attivare workflow per dedurre presenza o consenso dai tag.

## 10. Opportunities API

| Operazione richiesta | Helper locale | Capacità/permesso account | Verifica futura senza write in questa fase |
| --- | --- | --- | --- |
| List/search per location, contatto, pipeline e intent key | Assente | UNKNOWN | Schema, filtri, paginazione, campi ricercabili e più risultati |
| Create | Assente | UNKNOWN | Metodo/schema, campi richiesti e risposta ID; nessuna creazione per scoprirli |
| Update | Assente | UNKNOWN | Campi aggiornabili, update parziale e possibilità di preservare revisioni umane |
| Stage change | Assente | UNKNOWN | Pipeline/stage ID coerenti, permessi e side effect workflow |
| Status | Assente | UNKNOWN | Enum effettivi; mapping OPEN/WON/LOST/ABANDONED esplicito |
| assignedTo | Assente | UNKNOWN | Utenti ammessi e separazione owner contatto/opportunity |
| Custom fields | Assente | UNKNOWN | Oggetto, payload, opzioni e limiti; query per `hz_intent_key` da verificare |
| Motivo chiusura nativo | Assente | UNKNOWN | Campo/API reali, obbligatorietà e vocabolario; custom solo se necessario |

Non sono certificati endpoint, scope string o garanzie di idempotenza opportunity: il codice non li contiene e non sono state consultate API/documentazioni remote. Il futuro adapter deve gestire `RECONCILE_REQUIRED` dopo timeout create; se la ricerca per intent key non esiste, valutare ricerca per contatto/pipeline più mapping locale e revisione, senza scegliere il primo record o ricreare alla cieca.

## 11. Booking API

| Capacità | Stato locale | Stato remoto / prova richiesta |
| --- | --- | --- |
| Leggere calendari e disponibilità | Assente | UNKNOWN; tipo calendario, pool, gruppo, capacità |
| Create booking | Assente | UNKNOWN; schema, risposta appointment ID, conferma reale e notifiche implicite |
| Update booking | Assente | UNKNOWN; campi consentiti, owner e revisioni |
| Cancel | Assente | UNKNOWN; cancellazione logica/fisica, motivi e side effect |
| Read status | Assente | UNKNOWN; enum e fonte autorevole |
| No-show/presenza | Assente | UNKNOWN; chi può registrarli e quale evidenza li sostiene |
| Reschedule | Assente | UNKNOWN; stesso appointment ID o sostituzione, invalidazione vecchi reminder |
| Eventi webhook | Assente | UNKNOWN; schema, autenticazione e disponibilità per integrazione |

Un response 2xx o un click calendario non bastano per confermare l'iscrizione: servono edizione reale, contatto risolto, capienza/accesso, registrazione univoca e commit dei gate della sezione 11 del contratto. Email fallita non annulla un booking già confermato né autorizza un secondo booking. Nessun appuntamento reale è stato letto; test futuri soltanto sintetici e autorizzati.

## 12. Webhooks

Nessun webhook HighLevel patrimoniale locale o remoto verificato. I seguenti sono **famiglie di eventi richieste**, non nomi provider certificati.

| Area | Metadata/contratto da verificare | Stato |
| --- | --- | --- |
| Contact | Eventi create/update, identificativo evento, location, cambi dati/soppressioni pertinenti | UNKNOWN |
| Opportunity | Create/update/stage/status/owner, revisione/timestamp e identità risorsa | UNKNOWN |
| Appointment | Create/update/cancel/reschedule/status/no-show, eventuale ID sostitutivo | UNKNOWN |
| Autenticazione | Meccanismo firma reale, header, verifica raw body se prevista, timestamp/replay e rotazione chiavi | UNKNOWN |
| Consegna | Retry, timeout, ACK, redelivery, finestre di conservazione e rate limit documentabili | UNKNOWN |
| Ordering | Garanzie provider e revisioni confrontabili; non assumerle | UNKNOWN |

Nessuna subscription creata. Prima dell'attivazione futura: fonte ufficiale/schema effettivo del tipo d'integrazione, validazione firma e location, limiti payload, deduplica durevole `(provider, location, event_id)`, ACK solo dopo commit. Se event ID manca, valutare una chiave deterministica su campi stabili, documentando collisioni e limiti; mai dedurre presenza da payload non autenticati. Gestire out-of-order e cancellazione senza riaccendere reminder vecchi. Incertezza su versione/firma/risorsa blocca gli effetti e porta a revisione, non a write esplorative.

## 13. Deduplica

Locale verificato: trim/lowercase email nel pilota, helper E.164 con prefisso italiano implicito, upsert email+eventuale telefono, nessun lookup preliminare, lock identità, deduplica note o request ID. La guardia in memoria e il blocco doppio submit proteggono un ambito limitato, non garantiscono idempotenza. L'upsert 2A invia anche source: possibile sovrascrittura della sorgente originaria da verificare, non dato remoto osservato.

| Verifica account richiesta | Risultato odierno |
| --- | --- |
| Matching email, telefono, priorità e impostazione duplicati | UNKNOWN |
| Search email/telefono, normalizzazione, paginazione e collisioni | UNKNOWN |
| Comportamento upsert con email e telefono appartenenti a persone diverse | UNKNOWN |
| Conservazione telefono/source/owner se omessi nell'update | UNKNOWN |
| Note lookup e recupero ID dopo risposta incerta | UNKNOWN |

Test sintetico futuro, solo dopo autorizzazione distinta e audit workflow: ambiente/location controllata, destinatari di test e invii neutralizzati; creare fixture dichiarate di due persone → ripetere stessa email → provare email diversa/telefono condiviso e conflitto incrociato → caso telefono omesso → timeout simulato dopo commit → verificare contatti, source, owner e note. Registrare ID e risultati minimizzati senza esportare contatti reali. Non eseguire fusioni automatiche; gestione finale fixture esplicitamente approvata, nessuna cancellazione di massa.

Prima di questo test verificare schema/impostazioni in sola lettura. La regola di dominio resta: email come ricerca primaria; telefono come segnale, conflitti in IDENTITY_REVIEW, mai fusione cieca. Non confondere mancata ricerca con “nessun match”. Nessun test sintetico è stato eseguito ora.

## 14. Gap analysis vs contratto

La classificazione considera separatamente capacità locale e fattibilità **effettiva nell'account**. `SUPPORTED` richiede evidenza sufficiente nel perimetro indicato; `SUPPORTED WITH CHANGE` identifica un percorso locale concreto da estendere; `NOT SUPPORTED` vale solo per un limite dimostrato; `UNKNOWN` significa gate remoto aperto. Nessuna capacità remota è dichiarata NOT SUPPORTED soltanto per mancata lettura.

| Elemento contrattuale | Classe account/contratto complessivo | Gap locale e azione necessaria |
| --- | --- | --- |
| Pipeline ARCHITECT_PATH | UNKNOWN | Nessun mapping; leggere compatibilità e ottenere decisione commerciale |
| Pipeline PATRIMONIAL_EVENT | UNKNOWN | Mapping remoto unresolved; una E, Participation per edizione e generico separato |
| Pipeline PATRIMONIAL_CONSULTATION | UNKNOWN | Nessun mapping; richiesta esplicita e C unica aperta |
| Stage A01–A10/E01–E05/C01–C05 | UNKNOWN | Nessun ID; verificare ordine, stati e transizioni |
| Contact fields | UNKNOWN | Nativi parzialmente scritti; custom in nota soltanto |
| Opportunity fields | UNKNOWN | Nessuna scrittura strutturata; tipi/opzioni da confrontare |
| Owner nativo contact/opportunity | UNKNOWN | Nessun routing/mapping; preservare owner preesistente |
| Native close reason | UNKNOWN | Verificare copertura prima del custom condizionale |
| Calendar | UNKNOWN | Tre mapping, disponibilità e gruppo da verificare |
| Appointment | UNKNOWN | Nessun adapter/ID/status/revisione |
| Attendance/no-show | UNKNOWN | Fonte evidenza e stati separati da stage |
| Webhook | UNKNOWN | Nessun receiver, firma o eventi verificati |
| Tags | UNKNOWN | Add locale presente; catalogo e trigger remoti sconosciuti |
| Custom field definitions/values | UNKNOWN | Oggetto, opzioni e API assenti localmente |
| Contact lookup | UNKNOWN | Non implementato; indispensabile per conflitti |
| Opportunity lookup | UNKNOWN | Non implementato; indispensabile dopo create incerta |
| Note lookup | UNKNOWN | Non implementato; blocca retry append incerto |
| Deduplica account | UNKNOWN | Settings e comportamento non verificati |
| Workflow triggers | UNKNOWN | Inventario e conflitti non verificati |
| Form/validazione pilota 2A | SUPPORTED, solo locale | Due mode, allowlist, consensi e UTM presenti; non è v2 |
| Trasporto upsert/tag/nota | SUPPORTED WITH CHANGE, solo locale | Riutilizzabile come pattern, aggiungere letture/risoluzione/errori; scope remoti UNKNOWN |
| Ledger/outbox/idempotenza v2 | SUPPORTED WITH CHANGE, architettura locale | Pattern SQL/RPC presenti in altri prodotti; creare schema dedicato, non dichiarare già operativo |
| Memory/after() come unico ledger durevole | NOT SUPPORTED per requisito v2 | Memoria e lifecycle processo non forniscono persistenza condivisa; vietato fallback silenzioso |

## 15. Mapping logico → remoto

Tabella di preparazione, **non mapping attivabile**. Tutti i REMOTE NAME/ID sono UNKNOWN perché non letti. Le label nelle ACTION NEXT sono nomi desiderati del contratto, non nomi esistenti. `VERIFY` significa leggere prima di REUSE/CREATE/CONFLICT. `MISSING` sarà usato solo per assenza accertata con autorizzazioni e paginazione complete. I nomi delle tre chiavi calendario sono proposte locali esplicite, non ID provider.

| LOGICAL KEY | REMOTE TYPE | REMOTE NAME | REMOTE ID | STATUS | ACTION NEXT |
| --- | --- | --- | --- | --- | --- |
| ARCHITECT_PATH | pipeline | UNKNOWN | UNKNOWN | VERIFY | Confrontare Percorso Architetto Patrimoniale e 10 stage |
| PATRIMONIAL_EVENT | pipeline | UNKNOWN | UNKNOWN | VERIFY | Confrontare registrazioni Evento e 5 stage |
| PATRIMONIAL_CONSULTATION | pipeline | UNKNOWN | UNKNOWN | VERIFY | Confrontare Confronti Benessere Patrimoniale e 5 stage |
| A01 | stage | UNKNOWN | UNKNOWN | VERIFY | Nuovo interesse, ordine 1 |
| A02 | stage | UNKNOWN | UNKNOWN | VERIFY | Presentazione da prenotare, ordine 2 |
| A03 | stage | UNKNOWN | UNKNOWN | VERIFY | Presentazione prenotata, ordine 3 |
| A04 | stage | UNKNOWN | UNKNOWN | VERIFY | Da qualificare, ordine 4 |
| A05 | stage | UNKNOWN | UNKNOWN | VERIFY | Colloquio da fissare, ordine 5 |
| A06 | stage | UNKNOWN | UNKNOWN | VERIFY | Colloquio fissato, ordine 6 |
| A07 | stage | UNKNOWN | UNKNOWN | VERIFY | Valutazione e prossimo passo, ordine 7 |
| A08 | stage | UNKNOWN | UNKNOWN | VERIFY | Percorso avviato, ordine 8 |
| A09 | stage | UNKNOWN | UNKNOWN | VERIFY | Architetto Patrimoniale attivato, ordine 9/WON |
| A10 | stage | UNKNOWN | UNKNOWN | VERIFY | Chiuso senza attivazione, ordine 10; motivo e mapping status |
| E01 | stage | UNKNOWN | UNKNOWN | VERIFY | Richiesta di partecipazione, ordine 1 |
| E02 | stage | UNKNOWN | UNKNOWN | VERIFY | Iscrizione confermata, ordine 2 |
| E03 | stage | UNKNOWN | UNKNOWN | VERIFY | Esito da registrare, ordine 3 |
| E04 | stage | UNKNOWN | UNKNOWN | VERIFY | Follow-up, ordine 4 |
| E05 | stage | UNKNOWN | UNKNOWN | VERIFY | Conclusa, ordine 5; chiusure motivate |
| C01 | stage | UNKNOWN | UNKNOWN | VERIFY | Appuntamento richiesto, ordine 1 |
| C02 | stage | UNKNOWN | UNKNOWN | VERIFY | Appuntamento fissato, ordine 2 |
| C03 | stage | UNKNOWN | UNKNOWN | VERIFY | Esito da registrare, ordine 3 |
| C04 | stage | UNKNOWN | UNKNOWN | VERIFY | Approfondimento concordato, ordine 4 |
| C05 | stage | UNKNOWN | UNKNOWN | VERIFY | Concluso, ordine 5; chiusure motivate |
| contact.firstName | native contact field | UNKNOWN | UNKNOWN | VERIFY | Verificare nativo, nessuna copia hz_ |
| contact.lastName | native contact field | UNKNOWN | UNKNOWN | VERIFY | Verificare nativo |
| contact.email | native contact field | UNKNOWN | UNKNOWN | VERIFY | Verificare lookup/precedenza |
| contact.phone | native contact field | UNKNOWN | UNKNOWN | VERIFY | Verificare E.164 e omissione |
| contact.hz_province | contact custom field | UNKNOWN | UNKNOWN | VERIFY | Testo; vocabolario select solo se approvato |
| contact.hz_marketing_consent | contact custom field | UNKNOWN | UNKNOWN | VERIFY | Select 5 stati del contratto |
| contact.hz_marketing_consent_version | contact custom field | UNKNOWN | UNKNOWN | VERIFY | Testo, evidenza efficace |
| contact.hz_marketing_consent_at | contact custom field | UNKNOWN | UNKNOWN | VERIFY | ISO UTC con ora |
| contact.hz_assigned_owner | native contact owner alias | UNKNOWN | UNKNOWN | VERIFY | assignedTo nativo, nessun custom |
| opportunity.hz_intent_key | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | Testo opaco; cercabilità non presunta |
| opportunity.hz_funnel | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | Select 3 funnel |
| opportunity.hz_source | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | Testo controllato; first touch intenzione |
| opportunity.hz_source_path | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | Testo allowlist |
| opportunity.hz_utm_source | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | Testo max 100 |
| opportunity.hz_utm_medium | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | Testo max 100 |
| opportunity.hz_utm_campaign | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | Testo max 100 |
| opportunity.hz_utm_content | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | Testo max 100 |
| opportunity.hz_utm_term | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | Testo max 100 |
| opportunity.hz_requested_at | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | ISO UTC prima richiesta |
| opportunity.hz_privacy_version | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | Snapshot server |
| opportunity.hz_marketing_consent_snapshot | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | Select GRANTED_THIS_REQUEST / NOT_GRANTED_THIS_REQUEST |
| opportunity.hz_next_step | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | Select completo contratto §5 |
| opportunity.hz_next_step_at | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | ISO UTC, obbligatorio se OPEN |
| opportunity.hz_assigned_owner | native opportunity owner alias | UNKNOWN | UNKNOWN | VERIFY | assignedTo nativo, nessun custom |
| opportunity.pipelineId | native opportunity field | UNKNOWN | UNKNOWN | VERIFY | Pipeline ID del mapping validato |
| opportunity.pipelineStageId | native opportunity field | UNKNOWN | UNKNOWN | VERIFY | Stage ID e appartenenza pipeline |
| opportunity.status | native opportunity field | UNKNOWN | UNKNOWN | VERIFY | Enum reali e mapping ABANDONED |
| opportunity.close_reason | native opportunity field candidate | UNKNOWN | UNKNOWN | VERIFY | Verificare nome/API reali; logical key, non payload certificato |
| opportunity.hz_close_reason | conditional opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | Solo se nativo insufficiente e dopo decisione |
| opportunity.hz_architect_profile | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | Sei opzioni A e vuoto |
| opportunity.hz_architect_sales_experience | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | Sì / No / vuoto |
| opportunity.hz_architect_goal | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | Quattro obiettivi A |
| opportunity.hz_architect_availability | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | Da definire / Part-time / Full-time / vuoto |
| opportunity.hz_architect_open_answer | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | Testo lungo max 1500 |
| opportunity.hz_architect_presentation_date | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | ISO UTC booking verificato |
| opportunity.hz_architect_presentation_attended | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | UNKNOWN / ATTENDED / NO_SHOW / CANCELLED |
| opportunity.hz_architect_interview_date | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | ISO UTC, mirror booking |
| opportunity.hz_architect_interview_outcome | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | Quattro esiti colloquio del contratto |
| opportunity.hz_architect_eligibility | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | PENDING / ELIGIBLE / NOT_ELIGIBLE / WITHDRAWN |
| local.hz_event_slug | participation / request snapshot | N/A | N/A | LOCAL_ONLY | Dato locale; precedente mirror opportunity ritirato in 2B.2B-3 |
| local.hz_event_title | participation / request snapshot | N/A | N/A | LOCAL_ONLY | Dato locale; precedente mirror opportunity ritirato in 2B.2B-3 |
| local.hz_event_edition | participation / request snapshot | N/A | N/A | LOCAL_ONLY | Dato locale; precedente mirror opportunity ritirato in 2B.2B-3 |
| local.hz_event_date | participation / request snapshot | N/A | N/A | LOCAL_ONLY | Dato locale; precedente mirror opportunity ritirato in 2B.2B-3 |
| local.hz_event_profile | participation / request snapshot | N/A | N/A | LOCAL_ONLY | Dato locale; precedente mirror opportunity ritirato in 2B.2B-3 |
| local.hz_event_question | participation / request snapshot | N/A | N/A | LOCAL_ONLY | Dato locale; precedente mirror opportunity ritirato in 2B.2B-3 |
| local.hz_event_registration_status | participation / request snapshot | N/A | N/A | LOCAL_ONLY | Dato locale; precedente mirror opportunity ritirato in 2B.2B-3 |
| local.hz_event_attendance | participation / request snapshot | N/A | N/A | LOCAL_ONLY | Dato locale; precedente mirror opportunity ritirato in 2B.2B-3 |
| opportunity.hz_origin_event_edition | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | Prima origine C; altre relazioni nel ledger |
| opportunity.hz_consultation_outcome | opportunity custom field | UNKNOWN | UNKNOWN | VERIFY | Cinque esiti confronto del contratto |
| horyzon-patrimoniale | tag | UNKNOWN | UNKNOWN | VERIFY | Leggere catalogo e workflow |
| percorso-architetto-patrimoniale | tag | UNKNOWN | UNKNOWN | VERIFY | Leggere catalogo e workflow |
| evento-patrimoniale | tag | UNKNOWN | UNKNOWN | VERIFY | Leggere catalogo e workflow |
| pilot | tag | UNKNOWN | UNKNOWN | VERIFY | Leggere; policy coorte separata |
| horyzon-benessere-patrimoniale | tag | UNKNOWN | UNKNOWN | VERIFY | Preservare legacy |
| horyzon-evento-patrimoniale | tag | UNKNOWN | UNKNOWN | VERIFY | Preservare legacy |
| horyzon-percorso-consulenti | tag | UNKNOWN | UNKNOWN | VERIFY | Preservare legacy |
| ARCHITECT_COORDINATOR | user assignment | UNKNOWN | UNKNOWN | VERIFY | Nomina umana + utente attivo/location |
| ARCHITECT_OWNER | user assignment | UNKNOWN | UNKNOWN | VERIFY | Pool e sostituto |
| ARCHITECT_INTERVIEWER | user assignment | UNKNOWN | UNKNOWN | VERIFY | Competenza e disponibilità |
| ARCHITECT_ACTIVATION_APPROVER | user assignment | UNKNOWN | UNKNOWN | VERIFY | Autorità approvata |
| EVENT_COORDINATOR | user assignment | UNKNOWN | UNKNOWN | VERIFY | Nomina operativa |
| EVENT_HOST | user assignment | UNKNOWN | UNKNOWN | VERIFY | Host e sostituto |
| PATRIMONIAL_CONSULTATION_OWNER | user assignment | UNKNOWN | UNKNOWN | VERIFY | Referente competente |
| ARCHITECT_PRESENTATION_CALENDAR | calendar | UNKNOWN | UNKNOWN | VERIFY | Presentazione di gruppo |
| ARCHITECT_INTERVIEW_CALENDAR | calendar | UNKNOWN | UNKNOWN | VERIFY | Colloquio riservato |
| PATRIMONIAL_CONSULTATION_CALENDAR | calendar | UNKNOWN | UNKNOWN | VERIFY | Confronto su richiesta |

Workflow, subscription webhook, edizioni e booking non hanno risorse individuali identificate: nessun ID di configurazione statico da assegnare ora. Gli ID di istanza contatto/opportunity/appointment/note verranno restituiti dal provider e salvati per operazione nel ledger; mai hardcoded nel form o scelti dal browser.

## 16. Store durevole consigliato

### Alternative effettivamente osservate

| Alternativa locale | Transazioni / unique | Locking / lease | Serverless safety | Retention / query / migration | Costi e riuso |
| --- | --- | --- | --- | --- | --- |
| Supabase/Postgres via RPC, pattern Annunci 10x | Funzioni PL/pgSQL con più istruzioni atomiche; UNIQUE e PK SQL | `FOR UPDATE`, claim, lease_expires_at e attempt_count | Store condiviso esterno al processo; worker/cron patrimoniale ancora da progettare | Query REST/RPC; file SQL versionati; retention patrimoniale non implementata | Riuso infrastruttura già referenziata; nessun nuovo provider richiesto; piano/capienza/applicazione schema remoti UNKNOWN |
| Supabase REST/RPC Radar, schema hub | RPC di ownership/revisione; una sequenza di fetch REST non è una transazione multi-tabella | Revisioni/controllo concorrenza; non outbox CRM generica | Adatto come trasporto HTTP se DB configurato; nessuna coda CRM durevole da presumere | Migration Radar e profilo hub già nel codice; nessuna retention patrimoniale | Stessa famiglia d'infrastruttura, non un secondo database indipendente |
| AI Score supabase_rpc | RPC budget/limiti e PK con lock | Pattern lock server-side; dominio diverso | Persistente solo col backend Supabase effettivo | Query aggregate specifiche; migration SQL; non ledger patrimoniale | Stessa infrastruttura; flag/config non provano attivazione remota |
| Adapter memory / Map / after() | Nessuna transazione condivisa o unique DB | Solo stato del processo; perso a restart/concorrenza multi-istanza | Non soddisfa requisiti v2 | Query locali di test; nessuna retention durevole/migration | Nessun costo infrastrutturale; solo test o fallback operativo esplicitamente limitato |

Redis/KV, un altro database serverless e Postgres diretto indipendente **non risultano integrati** nelle dipendenze/adapters/config pertinenti analizzati: non sono alternative già disponibili e non vengono raccomandati come nuovi servizi. L'assenza di nomi nelle env locali non prova assenza nell'organizzazione, ma non autorizza a dichiararli utilizzabili qui.

### Primaria unica

**Supabase/Postgres Horyzon, mediante REST/RPC server-side e tabelle patrimoniali dedicate.** Scelta architetturale raccomandata, non disponibilità remota certificata. Prima del codice/schema verificare progetto autorizzato, ambiente, versione DB, migration applicate, Data API/schema esposto, privilegi, backup/ripristino e capienza/costi effettivi. Non usare nomi o riferimenti di progetto trovati in script di altri prodotti come autorizzazione a collegarsi.

Evidenza concreta: [analysis runs SQL](../../supabase/migrations/20260926153000_annunci10x_analysis_runs.sql) contiene UNIQUE `(session_id, input_identity)`, insert on conflict, claim con `FOR UPDATE`, contatore e scadenza lease; [email deliveries SQL](../../supabase/migrations/20260928113000_annunci10x_score_report_email_deliveries.sql) contiene UNIQUE `(kind, analysis_run_id, recipient_normalized)`, claim, stato e limite tentativi. Entrambe abilitano RLS e limitano privilegi/EXECUTE ai ruoli previsti. [Runtime SQL AI Score](../../supabase/migrations/20260922041000_ai_score_runtime_store.sql) mostra ulteriori lock e PK. Sono prove nel sorgente, non test DB né verifica di schema applicato.

Riutilizzare pattern e trasporto, non sessioni, ownership secret, tabelle, entitlement o RPC di Annunci/Radar. Non copiare indiscriminatamente SECURITY DEFINER: preferire invoker; eventuali funzioni privilegiate richiedono motivazione, search_path controllato, revoca EXECUTE pubblico e autorizzazione server. Service role mai nel browser; RLS/privilegi espliciti, schema e Data API da verificare. Una serie di POST/PATCH dal client server non sostituisce una RPC transazionale.

### Requisiti minimi del disegno futuro, nessuna migration creata

| Entità | Vincolo/operazione richiesta |
| --- | --- |
| Request ledger | UUID request unico nel namespace/location/versione definiti; hash canonico immutabile; stessa chiave/hash replay, chiave/dati diversi 409 |
| Intent/opportunity mapping | Unica A OPEN per contatto+programma; una E per contatto con Participation per contatto+edizione; interesse generico distinto; C OPEN per contatto+finalità; cicli e remote ID |
| Event edition / participation | Edizione immutabile e revisioni date/accesso; UNIQUE contatto+edizione; interesse senza edizione non aggira UNIQUE tramite NULL |
| Attendance / consent evidence | Evidenze versionate con autore/fonte, finalità e canale; UNKNOWN distinto da NO_SHOW; checkbox false non revoca grant precedente |
| Outbox / operation state | UNIQUE effetto+intenzione+versione; request/evidenze/outbox inseriti nella stessa transazione; stato per ogni effetto e remote ID |
| Lease / fencing | Claim atomico, scadenza e token/versione del claim; update accettato solo dal detentore corrente; mai mantenere lock DB durante fetch remoto |
| Webhook inbox | UNIQUE provider+location+event ID, stato acquisito prima di ACK e nessun effetto se flag write spenti |
| Retention / query | Indici su stato+next_attempt_at/lease, request/intent/edition; purge approvato, tombstone minimizzate, mapping incerti protetti fino a revisione |

Lease indicativa 60 s e retry massimo 5 tentativi secondo il contratto; recupero lease non autorizza create remote nuove. Fencing evita che il worker scaduto sovrascriva lo stato locale, ma non può annullare una fetch remota già in volo: riconciliare prima di ripetere. Nessuna promessa exactly-once distribuita.

Serve un esecutore riprendibile autorizzato: il repo dimostra claim persistenti, **non** uno scheduler patrimoniale pronto. Pianificare worker protetto/infrastruttura esistente da verificare, senza creare nuove automazioni esterne. Retention 30 giorni tecnici/90 giorni replay/revisione lead a 6 mesi restano proposte legali/operative del contratto; un expires_at non è prova di cancellazione automatica o backup conforme. Non aggiungere cron/migration ora.

### Fallback unico

**Mantenere la baseline 2A, senza attivare v2, e presidiare manualmente le ricezioni incerte tramite i canali esistenti.** Non c'è un secondo store durevole dimostrato: presentare memory, file locale o CRM note come equivalente sarebbe scorretto. Il fallback mantiene i limiti 2A (possibili note duplicate/effetti parziali, nessuna ricevuta durevole) e non consente booking, conferme o messaggi v2 automatici.

Se v2 è già in uso e il DB non è disponibile, il futuro handler deve rifiutare **prima degli effetti** la nuova richiesta v2 con errore temporaneo; niente `ok: true`, niente 202 e niente inoltro silenzioso a 2A. Conservare la stessa chiave per il retry e le ricevute già committate; non invitare a reinviare un caso incerto come nuova richiesta. Ripristino del frontend 2A solo come cutover deliberato e controllato. Il fallback non cambia ora nessun form né invia messaggi; il canale volontario `info@horyzon.it` è già presente nella baseline.

## 17. Feature flag

Progetto server-side, **nessuna env aggiunta e nessun flag implementato**. Default per tutti `false`; parser futuro strettamente booleano, assente/non valido → false, configurazione non pubblica. I flag concedono un sottoinsieme di effetti dopo i gate: non sostituiscono scope, autorizzazione, location, workflow audit o consenso.

| Flag | Default | Effetto ammesso se true e prerequisiti soddisfatti | Dipendenze / comportamento false |
| --- | --- | --- | --- |
| PATRIMONIAL_V2_ENABLED | false | Acquisizione contratto v2 con ledger verificato e ricevuta durevole | DB sano e schema/mapping versione approvati; false rifiuta nuovi payload v2, non li tratta come legacy/2A |
| PATRIMONIAL_CRM_WRITE_ENABLED | false | Upsert/update contatto, tag additivi, nota riconciliata | V2 + location/read/scope/workflow audit; false sospende tutti gli effetti CRM v2, mantiene ledger e riconciliazione in lettura |
| PATRIMONIAL_OPPORTUNITY_WRITE_ENABLED | false | Create/update opportunity/stage/status/campi/owner | V2 + CRM_WRITE + mapping validato + identità risolta; false nessuna opportunity nuova o update |
| PATRIMONIAL_BOOKING_ENABLED | false | Create/update/cancel/reschedule booking richiesti esplicitamente | V2 + CRM_WRITE + OPPORTUNITY_WRITE + owner/calendario/edizione/accesso verificati; false nessuna write booking o nuova conferma automatica dipendente da booking |
| PATRIMONIAL_MESSAGES_ENABLED | false | Esecuzione delivery autorizzata della matrice, una sola per chiave | V2 + outbox/consensi/soppressioni + unico esecutore; booking/reminder richiedono anche gate BOOKING e revisione corrente. CRM_WRITE/OPPORTUNITY_WRITE necessari se il messaggio dipende da quegli effetti non ancora confermati |
| PATRIMONIAL_WEBHOOK_ENABLED | false | Intake autenticato nel registro durevole; non abilita effetti | Firma/location/schema/DB verificati; può restare true con write/messages false per acquisire e accodare in hold. Non richiede V2 per drenare sottoscrizioni già attive |

Ogni effetto rilegge i flag immediatamente prima della fetch, non soltanto all'avvio del job. Acquisizione/dedup locale, lettura stato e audit possono continuare con scritture CRM sospese; nessuna nuova ricevuta senza commit. Riattivare V2 non autorizza un replay indiscriminato: rivalutare stato/versione, consensi e operazioni incerte. Tenere i delivery separati dalla conferma business.

Webhook spento: non creare subscription. Se una subscription è già attiva, rollback preferibile **WEBHOOK true + tutti gli effetti false**, con inbox durevole in hold. Se intake deve essere disabilitato o DB è giù, non rispondere 2xx a un evento valido non acquisito; usare errore temporaneo/Retry-After se compatibile col provider e allertare l'operatore, con finestra retry da verificare. Pianificare anche la sospensione remota della subscription con autorizzazione separata; non supporre retry infiniti. Firma non valida → rifiuto, non persistenza arbitraria. ACK dei duplicati solo se il commit precedente è accertato.

Questi flag futuri controllano **solo v2**. Non spengono il trasporto 2A/legacy attuale, il Radar, workflow HighLevel o notifiche native calendario. Un kill switch globale richiederebbe un intervento esplicito distinto e non può essere promesso dal report. BOOKINGS false non cancella appuntamenti già esistenti: serve presidio umano delle cancellazioni urgenti senza aggirare il blocco con write automatiche.

## 18. Migrazione 2A → v2

Nessuna migrazione/import/riconciliazione remota eseguita. Non è stato verificato se esistano richieste reali 2A. Strategia proposta:

1. Definire un cutoff UTC e una coorte `pre-v2` documentata, non una data di consenso ricostruita. Conservare la baseline e i riferimenti di release; richieste dopo cutoff con contratto v2 hanno request ID autentico e ricevuta propria.
2. Dopo autorizzazione e location verificata, inventario mirato/minimizzato degli interessi pilota con filtri tag/source/note disponibili. I tag non provano ricezione completa, persona unica o consenso; niente export massivo di contatti Radar/Annunci o PII nel repository.
3. Con operatore autorizzato, riconciliare contact ID e fatti verificabili (timestamp provider, eventuali note esistenti, funnel, evidenze). Doppie note da retry non diventano due lead; note prive di marker non si distinguono con certezza solo dal testo o timestamp. Casi ambigui restano in review, senza cancellazione/fusione automatica.
4. Se si approva un import futuro, assegnare un ID **di riconciliazione** distinto dal request ID originale inesistente, con provenienza `pre-v2`, livello di certezza, autore e snapshot minimo. Vincolo sull'identità dell'import/provider record per non importarlo due volte; ciò dà idempotenza dell'import, non retroattiva del submit 2A.
5. Nessun replay automatico upsert/tag/note, nessuna nota “di migrazione” obbligatoria. Riconciliare tramite ID e ledger; un eventuale nuovo audit CRM va approvato e deduplicato come effetto distinto.
6. Nessuna promozione automatica legacy/pilota a iscrizione confermata, candidatura qualificata, consenso efficace, C o booking. Scelta edizione, volontà di confronto e valutazioni umane restano gate. Marketing non ricostruito dai tag; evidenze incomplete → UNKNOWN/review.
7. Preparare cutover v2 per coorte approvata: nuovi request ID autentici, vecchie ricevute non inventate, nessuna doppia emissione 2A/v2. Un submit ancora 2A durante transizione resta tale; non attribuirgli retroattivamente l'evento v2 `form_submit_success`.
8. Collaudo con fixture finte, campione reale solo se autorizzato separatamente e senza invii; controllo conteggi e conflitti; poi eventuale attivazione progressiva con flags separati. Nessun import o workflow avviato da questo documento.

Rollback: fermare nuove scritture/messaggi, mantenere ledger e riconciliazione in lettura/inbox in hold; non eliminare opportunità/consensi per “ripristinare” lo stato e non rinviare tutti i form. Pre-v2 esclusa dai KPI v2 o coorte separata con copertura/certainty dichiarate; nessuna conversione storica dalla visita thank-you.

## 19. Decisioni umane

Checklist estratta dal contratto. Nessuna casella risulta approvata per effetto di questo report. “Nessuno” significa che non esiste un default commerciale/legale neutro.

### COMMERCIALE

| Decisione da approvare | Impatto | Resta bloccato | Default tecnicamente neutro |
| --- | --- | --- | --- |
| [ ] Tre pipeline, chiavi programma/ciclo e significato WON/LOST/ABANDONED | Relazioni e reporting | Mapping e attivazione opportunity | Nessuno; mantenere separazione operativa dal fatturato |
| [ ] Qualificazione, idoneità e criteri attivazione/approvatore | Accesso al percorso professionale | A05/A08/A09 e comunicazioni di esito | Nessuna valutazione automatica |
| [ ] Policy nuovi cicli/riapertura/chiusura, massimo ricontatti | Continuità della relazione | Routing dopo chiusura e follow-up | Revisione umana, non riapertura da form |
| [ ] SLA commerciali, modalità confronto e policy pilot | Promesse e coorti | Automazioni di follow-up e uso futuro del tag | Nessuna promessa nuova; preservare coorte storica |

### OPERATIVO

| Decisione da approvare | Impatto | Resta bloccato | Default tecnicamente neutro |
| --- | --- | --- | --- |
| [ ] Sette incarichi, pool, sostituti e presidio coda | Responsabilità e disponibilità | Assignment e appuntamenti | Nessun ID fittizio; round robin spento |
| [ ] Sessioni presentazione e host | Prenotabilità concreta | Inviti A02/booking A03 | Interesse ricevuto, nessun link inventato |
| [ ] Edizione reale, data/fuso, accesso, capienza o assenza limite deliberata | Conferma e partecipazione | E02 e reminder | PENDING_EDITION, non CONFIRMED |
| [ ] Durate/buffer/orari/SLA/cancellazione e riprogrammazione | Slot e tempi operativi | Calendari/booking | Proposte contratto da validare, non pubblicare |
| [ ] Fonte presenza e autore classificazione UNKNOWN/no-show | Esiti e report | Follow-up per presenza | UNKNOWN fino a evidenza |
| [ ] Unico esecutore messaggi, escalation delivery e casi incerti | Evitare duplicati | Invii e retry operativi | Nessun invio finché non deciso |

### TECNICO

| Decisione da approvare/verificare | Impatto | Resta bloccato | Default tecnicamente neutro |
| --- | --- | --- | --- |
| [ ] Location Horyzon e connessione read autorizzata con scope selettivi | Isolamento account | Intero inventario remoto | Stop senza chiamate |
| [ ] Supabase/progetto/ambiente esistenti, schema, backup e migration | Durabilità e ripristino | Ledger/outbox production | Primaria §16 condizionata; nessun nuovo provider |
| [ ] Worker e sua autorizzazione/scheduling esistente | Ripresa dopo crash | Automazioni affidabili | Nessun after() come unica coda |
| [ ] Mapping reali/tipi/opzioni, lookup note e opportunity | Effetti e riconciliazione | CRM write e create incerte | UNKNOWN/hold, non create cieche |
| [ ] Policy identità e precedenza dati, comportamento upsert reale | Preservare persone/sorgenti | Risoluzione automatica | Conflitto → review |
| [ ] Cutoff/coorti pre-v2, import mirato e test sintetici | Transizione verificabile | Migrazione reale | Nessun import/replay |
| [ ] Fonte eventi/KPI, attribuzione, costi e policy telemetria | Misurazione attendibile | Tracking client/dashboard pubblicabili | Registro business prima di provider analytics |

### PRIVACY/LEGAL

| Decisione da validare | Impatto | Resta bloccato | Default tecnicamente neutro |
| --- | --- | --- | --- |
| [ ] Finalità, informative/versioni e prova richiesta/ricontatto | Evidenze valide | Attivazione trattamento v2 e copy legale nuovo | Nessuna attestazione di compliance |
| [ ] Marketing per finalità/canale, verifica email, revoche/DND | Invii leciti e soppressioni | Marketing/WhatsApp e nuove sequenze | Nessun consenso inferito; nessun reset DND |
| [ ] Retention, tombstone, cancellazione, rettifica e backup | Conservazione e diritti | Purge automatizzato e promessa replay | Durate contratto soltanto proposte |
| [ ] Accessi per ruolo, risposte aperte e valutazione candidati | Minimizzazione e appropriatezza | Uso ulteriore delle qualificazioni | No dati sensibili aggiuntivi; niente PII analytics |
| [ ] Classificazione di ciascun messaggio e ruoli fornitori | Separare servizio/promozione | Template/sender e canali | Nessun invio fino a validazione |

### CONTENUTI

| Decisione da approvare | Impatto | Resta bloccato | Default tecnicamente neutro |
| --- | --- | --- | --- |
| [ ] Titolo definitivo e slug stabile evento, dettagli edizione | Identità pubblica/logistica | Pubblicazione dettagli e conferme | Titolo di lavoro non genera edizione |
| [ ] Copy A-M1…A-M8 incluso A-M2b, E-M1…E-M9 e reminder | Aspettative e CTA | Messaggi/template | Matrice di intenti soltanto |
| [ ] Mittenti, risorse/link reali, accessi e istruzioni cancellazione | Comunicazioni utilizzabili | Inviti/reminder/follow-up | Nessun replay/meeting link inventato |
| [ ] Vocabolario provincia/estero e label ruolo | Qualità input e linguaggio | Select/routing esteso | Testo validato, terminologia contrattuale |
| [ ] Label KPI, coorti e distinzione WON operativo | Evitare risultati ingannevoli | Dashboard e confronti costi | N/D se dati/denominatori mancanti |

## 20. Piano 2B.2B

Tutti i percorsi sotto sono **proposte future**, non file creati in 2B.2A. Implementazione e attivazione sono gate separati. L'autorizzazione odierna non include migration, nuove pipeline o servizi, neppure in bozza remota.

### 2B.2B-1 — Contratto v2 + ledger + outbox + idempotenza

- Prerequisiti: decisione store/ambiente, schema e accessi, contratto ricevuta e retention, worker riprendibile concordati. Inventario CRM non indispensabile per test locali, ma necessario prima di effetti remoti.
- File proposti: `src/lib/public-leads/patrimonial-contract.ts`, `patrimonial-store.ts`, `patrimonial-sync.ts`, `patrimonial-consents.ts`; dispatch in `handler.ts`, validazione in `patrimonial-funnels.ts`, request ID in `src/components/patrimonial-lead-form.tsx`; eventuale status route protetta e worker interno; migration nel framework Supabase esistente solo dopo autorizzazione. `.env.example`/package solo se necessario e successivamente autorizzato.
- Test: stessa chiave/stesso hash replay; chiave/dati diversi 409; due istanze, atomicità request+consensi+outbox, crash, lease/fencing e timeout; DB giù prima/dopo commit; replay scaduto/tombstone; status senza PII/IDOR; compatibilità legacy/2A e tutti i flag false. Test DB locale autorizzato con migrazione dedicata, mai sul progetto remoto implicito.
- Remote changes: nessuna per test finti; eventuale applicazione schema su DB esistente richiede gate/backup/autorizzazione separati. Nessun CRM/message.
- Rollback: V2 false per nuove richieste, conservare ricevute/outbox esistenti e mapping; nessun drop schema o inoltro automatico a 2A.

### 2B.2B-2 — Adapter HighLevel read/write dietro flag

- Prerequisiti: location e read/scope verificati, inventory completo, lookup/precedenza dati, audit workflow e gestione risposte incerte approvati; blocco 1 disponibile per effetti affidabili.
- File proposti: `src/lib/public-leads/patrimonial-highlevel.ts`, mapping server dedicato, `patrimonial-sync.ts`; mantenere `src/lib/radar/highlevel.ts` e legacy stabili; `scripts/verify-patrimonial-crm.mjs` proposto.
- Test: trasporto fake con location mismatch, credenziali/scope falliti, paginazione, 429/Retry-After, timeout dopo create, source/owner preservati, conflitti email/telefono, tag additivi e note deduplicate; nessuna fetch write con flag false; errori sanificati.
- Remote changes: nessuna per implementazione/mocks; successivo test sintetico contatti/tag/note solo su autorizzazione, dopo audit automazioni. Nessuna discovery tramite write.
- Rollback: CRM_WRITE false; mantenere lookup/hold e remote ID, nessun replay globale; v2 può acquisire durevolmente richieste se presidiate senza promettere sync.

### 2B.2B-3 — Pipeline/opportunity mapping

- Prerequisiti: tre pipeline e stati approvati, mapping reale stage/campi/utenti, limiti custom fields e status verificati, motivi chiusura decisi; blocchi 1–2.
- File proposti: `patrimonial-routing.ts`, `patrimonial-highlevel.ts`, `patrimonial-store.ts`, configurazione server mapping e test CRM.
- Test: A unica OPEN per programma, una E per contatto con Participation per edizione e interesse generico separato, C unica aperta cross-edizione; collisioni/riuso/chiuse, nessuna regressione da job vecchio, timeout create senza duplicazione, owner distinto e status ABANDONED esplicito.
- Remote changes: eventuale riuso/creazione pipeline/stage/campi soltanto con autorizzazione separata e piano compatibile con risorse esistenti; nessuna nuova pipeline autorizzata ora. Nessuna modifica massiva legacy.
- Rollback: OPPORTUNITY_WRITE false, mantenere ledger/read e casi incerti; nessuna cancellazione di opportunity o rollback cieco di stage umani.

### 2B.2B-4 — Edizioni/calendari/booking

- Prerequisiti: edizione/data/fuso/accesso/capienza reali, host e owner, tre calendari verificati, booking/no-show/reschedule e firma eventi documentati; blocchi 1–3 e policy presenza.
- File proposti: registro/config server edizioni/sessioni, `patrimonial-store.ts`, `patrimonial-highlevel.ts`, `src/app/api/patrimonial/booking-webhook/route.ts`; riferimenti logici in `src/content/patrimonial-funnels.ts` solo se necessario, mai ID segreti client.
- Test: capienza concorrente, evento senza data non confermato, DST Europe/Rome, cancellazione/riprogrammazione e revisioni, booking incerto, webhook duplicati/fuori ordine/firma-location errate, inbox con write false, DB down senza ACK fallace, UNKNOWN distinto da NO_SHOW.
- Remote changes: eventuale riuso/config calendari, sessioni e subscription solo autorizzati separatamente; nessun nuovo servizio webinar implicito; verificare notifiche native prima di test booking.
- Rollback: BOOKING false e messaggi logistici sospesi; inbox in hold se ancora sottoscritta; gestione umana dei booking esistenti, nessuna cancellazione automatica a cascata.

### 2B.2B-5 — Workflow/messaggi

- Prerequisiti: unico esecutore per evento, audit conflitti, copy/mittenti/finalità/canali approvati, soppressioni e consensi efficaci, dipendenze booking e delivery controllate; blocchi precedenti pertinenti.
- File proposti: `patrimonial-messages.ts`, `patrimonial-consents.ts`, `patrimonial-sync.ts`, eventuali template solo dopo scelta del meccanismo già disponibile. Nessun provider nuovo per convenienza.
- Test: un solo invio per chiave business/revisione/canale, retry incerto e riconciliazione, revoca/DND prima della fetch, reminder scaduti/cancellati, cambio edizione, delivery fallito senza nuova iscrizione, flag false e conflitto invii nativi.
- Remote changes: nessuno finché non autorizzati; eventuali workflow anche draft, mittenti/template e messaggi sintetici richiedono istruzione successiva. WhatsApp resta disabilitato fino ai gate specifici.
- Rollback: MESSAGES false, conservare delivery/casi incerti e annullare soltanto job locali obsoleti; eventuale stop workflow remoto con autorizzazione dedicata, non presumere che il flag app lo controlli.

### 2B.2B-6 — Tracking/KPI

- Prerequisiti: ledger/eventi autorevoli, formule/coorti/UNKNOWN/attribuzione approvati; telemetria client solo con policy specifica e costi reali disponibili se si vogliono KPI di costo.
- File proposti: `patrimonial-events.ts`, proiezioni/report dedicati e test; tracking nelle isole client solo se autorizzato. Le thank-you restano statiche senza conversioni al GET.
- Test: retry/test/pre-v2 esclusi o separati, stessa coorte numeratore/denominatore, zero → N/D, C collegata a più E non raddoppiata, cancellati/UNKNOWN separati, eventi correttivi, nessuna PII/meeting URL in analytics.
- Remote changes: nessuno per proiezioni locali; nessun provider analytics/ads nuovo. Eventuale dashboard CRM solo dopo autorizzazione e dati reali.
- Rollback: sospendere pubblicazione/telemetria aggiuntiva, preservare eventi business necessari e privacy; non cancellare consensi o ricevute per azzerare KPI.

Ordine consigliato: 1 con fixture e flag false → 2 in read verificata e mock write → 3 → 4 → 5 → 6; le definizioni KPI e l'audit privacy possono precedere lo sviluppo. Dopo i test pertinenti, regressioni `/contatti`, noindex/sitemap, pagine pubbliche e pilota; nessun push/deploy/merge implicito nel completamento di un blocco.

## 21. Rischi

| Rischio residuo | Conseguenza | Mitigazione/gate |
| --- | --- | --- |
| Location/scope non verificati | Lettura o scrittura nell'account sbagliato | REMOTE INVENTORY BLOCKED; identità attendibile prima della chiamata |
| UNKNOWN scambiato per MISSING | Nuove risorse duplicate o conflitti | Completezza/paginazione/permessi prima di CREATE |
| Credenziali mancanti localmente scambiate per produzione spenta | Falsa conclusione sull'operatività | Dichiarare solo nomi osservati, produzione sconosciuta |
| Workflow/booking notificano nonostante flag app false | Invii non autorizzati | Audit nativo e ambiente/test autorizzati prima di qualsiasi write |
| 2A accetta già effetti parziali senza ledger | Doppie note, provenienza incerta | Riconciliazione mirata pre-v2 e niente falsa idempotenza retroattiva |
| Upsert fonde dati tramite telefono/source | Perdita identità o attribuzione Radar | Lookup, precedenza, lock e review; test sintetico futuro |
| Ricerca note/opportunity non disponibile | Impossibile risolvere timeout create | Hold/manual review, non blind retry |
| Lease senza fencing o worker vecchio in volo | Effetti duplicati e stato sovrascritto | Claim versionato, controllo prima di fetch e riconciliazione remota |
| Migration locale scambiata per schema applicato | Ricevuta non durevole o errori runtime | Verifica DB/privilegi/progetto e test atomici prima di V2 true |
| Fallback memory/2A silenzioso | Perdita richieste e garanzie false | Rifiuto v2 prima degli effetti se ledger non disponibile |
| Webhook ACK senza inbox o retry provider finiti | Eventi persi | Commit prima di ACK, intake in hold e procedura sospensione/recovery |
| Stato assenza inventato o C automatica a tutti | KPI e relazione scorretti | UNKNOWN e richiesta esplicita, fonti presenza verificate |
| Retention elimina mapping incerto | Replay duplicato o prove perse | Policy coordinata, tombstone minimizzate e casi in revisione |
| WON operativo contato come ricavo | Report ingannevole | Pipeline/report distinti e nessun importo inventato |
| Rollback app non controlla legacy/workflow CRM | Falsa sicurezza operativa | Confini espliciti dei sei flag; presidio e autorizzazione stop remoto separati |

## 22. Stop conditions

Stop remoto storico 2B.2A: location e accesso read non erano verificabili dall'agente. In 2B.2B-2 lo stato è PARTIALLY VERIFIED per le evidenze comunicate dall'utente (§1), ma le chiamate reali restano espressamente vietate in questa fase. Nessuna richiesta di token o credenziale in chat. Identificativi e binding verificati rimangono gate di una futura configurazione server autorizzata.

Ulteriori condizioni vincolanti per il seguito:

1. Location non distinguibile, connessione non autorizzata, read assente o scope insufficienti → fermarsi prima dei servizi/effetti interessati; non provare POST upsert come check.
2. Necessità di stampare/usare credenziali in modo insicuro → fermarsi; nessun valore nei log, nel documento o nel commit.
3. Scoperta capacità che richieda creazione/modifica risorse o contatti → soltanto descrivere un test futuro; non eseguirlo sotto l'autorizzazione di sola lettura.
4. Config/schema/tipo/trigger non leggibile → UNKNOWN, non MISSING/NOT SUPPORTED; nessuna creazione per colmare un'assenza non provata.
5. DB durevole non verificato, identità in conflitto, create incerta, owner/calendario/edizione/accesso mancanti → hold degli effetti pertinenti, senza conferme/messaggi ingiustificati.
6. Nuove modifiche non correlate fuori da `tmp/` → fermarsi prima di procedere con staging/commit; `tmp/` preesistente non è un impedimento né un contenuto da ripulire.
7. Qualsiasi push, deploy, merge, modifica main, applicazione migration, nuova pipeline/campo/calendario/workflow/subscription o invio → fuori dall'autorizzazione 2B.2A; nessuno eseguito.

### Verifica della consegna locale

Unico file ammesso: `docs/patrimonial/patrimonial-highlevel-inventory-v1.md`. Prima del commit: verifica Git di branch, modifiche estranee, file staged e assenza assoluta di path `tmp/` nello staging; `git diff --cached --check`; controllo delle 22 sezioni, mapping delle chiavi, link locali e assenza di pattern di credenziali. Nessun test applicativo/live necessario per un solo documento; nessuna build avviata. Il riepilogo di consegna riporta SHA e stato effettivi dopo il commit locale `docs: inventory patrimonial HighLevel setup`.

`tmp/` non è stata letta come sorgente, modificata, spostata, cancellata o aggiunta al commit. Nessuna modifica a `.gitignore` per nasconderla. Nessuna scrittura remota, nessun invio e nessuna migrazione applicata.
