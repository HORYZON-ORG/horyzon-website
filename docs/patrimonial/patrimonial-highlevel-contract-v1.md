# Contratto patrimoniale HighLevel v1 — FASE 2B.1

Data: 14 ottobre 2026. Repository: `HORYZON-ORG/horyzon-website`.
Branch di riferimento: `feat/patrimonial-pilot-funnels`.
Baseline applicativa analizzata: `78c1d638f30db43b870b93a1242322c78b0f82cf`.

**Stato: specifica locale, non attivata.** Le regole tecniche sono il contratto proposto per la FASE 2B.2; owner, SLA, calendari, criteri commerciali e autorizzazioni dei messaggi richiedono le decisioni elencate nella sezione 18. Nessun ID remoto, capacità dell'account, pipeline, calendario o workflow è stato verificato tramite API. I nomi di tipo campo sono raccomandazioni per la configurazione, non payload API certificati. Non sono state chiamate API esterne.

Terminologia vincolante: **Horyzon Benessere Patrimoniale**, **Percorso Architetto Patrimoniale**, **Architetto Patrimoniale**, **Horyzon Architetti Patrimoniali**. Il ruolo non viene qualificato come consulente finanziario. Il titolo dell'evento è configurabile e non identifica un'edizione.

**Aggiornamento Evento 2B.2B-3:** l'utente ha fornito la verifica che HighLevel rifiuta opportunity duplicate dello stesso contatto **nella stessa pipeline**, non tra pipeline differenti. Il modello Evento viene quindi adattato a una sola opportunity di relazione per contatto, con partecipazioni locali separate per edizione. Le modifiche Evento sotto prevalgono sulla proposta originale 2B.1; la verifica remota è evidenza comunicata dall'utente, senza nuove chiamate dell'agente.

**Aggiornamento store locale 2B.2B-4A:** implementato l'[adapter Supabase/Postgres](../../src/lib/public-leads/patrimonial-supabase.ts), con factory di produzione in [patrimonial-store.ts](../../src/lib/public-leads/patrimonial-store.ts), e creata una sola [migration locale](../../supabase/migrations/20261014225059_patrimonial_lead_v2.sql), **NON applicata**. Usa lo schema `public`, coerente con il pattern Annunci, con sette tabelle dedicate `patrimonial_requests`, `patrimonial_intents`, `patrimonial_consent_evidence`, `patrimonial_participations`, `patrimonial_event_editions`, `patrimonial_outbox_operations`, `patrimonial_domain_events`. Non riusa dati, sessioni, entitlement o segreti di altri prodotti. La tabella edizioni non contiene seed; gli snapshot forniti dal dominio vengono persistiti con chiave logica distinta dall'UUID interno. Aggiornamento di un'edizione esistente con dati differenti richiede una futura operazione di registro esplicita e per ora è rifiutato.

Le transazioni dell'adapter raccolgono un journal limitato a 128 comandi. Per restituire valori al callback, una RPC esegue una preview in una sottotransazione PostgreSQL **sempre annullata**, comprese scritture e lock. La RPC finale `acquire_patrimonial_request_v2` ricontrolla i risultati precedentemente osservati ed esegue acquisizione, consensi, intenzione provvisoria, outbox ed evento in un solo commit; errori o snapshot cambiati annullano tutto. Snapshot cambiato: callback locale rieseguito al massimo quattro volte, esclusivamente con operazioni store/dominio; nessun fetch provider nel callback. Risposta persa dopo commit: 503 e retry con lo stesso request ID; nessun retry cieco del commit e nessun fallback. I claim/RPC usano lock transazionali brevi, `SKIP LOCKED`, token, versione, scadenza verificata sull'orologio DB e riconciliazione delle lease scadute. Nessun lock sopravvive a una RPC o copre una chiamata esterna. Il lock di namespace privilegia la correttezza e serializza brevemente le mutazioni patrimoniali; volume e prestazioni DB non sono stati collaudati.

Il payload validato viene conservato una sola volta nello snapshot JSONB server-side della richiesta: serve al worker contatti/note differito e al confronto canonico per replay. Non viene salvato il corpo HTTP grezzo né un token provider; niente PII nei log. I campi indicizzati e le proiezioni sono scritti nella stessa transazione degli snapshot. Consensi e domain event restano append-oriented; marketing false è uno snapshot, non una revoca. I domain event esportano solo fatti selezionati, senza risposte aperte. Sono predisposti marker/indici di retention, senza purge o scadenze legali automatiche; le durate di 30/90 giorni e sei mesi restano proposte. Il riferimento replay di 90 giorni già presente nella fase precedente non cancella né riacquisisce record scaduti.

RLS e FORCE RLS sono previste su tutte le tabelle, accesso/EXECUTE revocati a public/anon/authenticated, privilegi limitati al service role server-side; le RPC sono SECURITY INVOKER con search_path esplicito. Il contenuto delle evidenze non riceve UPDATE: è aggiornabile solo il collegamento differito intent_id. La produzione resta **non attivata**: V2/CRM_WRITE/OPPORTUNITY_WRITE false per default e nuovo gate `PATRIMONIAL_DURABLE_STORE_READY` false per default, da autorizzare separatamente dopo applicazione e verifica dello schema. Anche con readiness e credenziali configurate è richiesta la health RPC con versione/schema corretti; assenza/errore produce 503. La factory costruisce solo lo store Supabase, mai memory o 2A. Supabase remoto, schema installato, privilegi e salute dell'ambiente non sono stati verificati. I test di questa fase usano esclusivamente trasporto RPC simulato e controlli SQL statici: **nessuna esecuzione PostgreSQL, migration applicata, chiamata remota, configurazione o messaggio**.

## 1. Architettura CRM consigliata

### Evidenza attuale e confini

| Fonte locale | Comportamento verificato nel codice |
| --- | --- |
| [Form](../../src/components/patrimonial-lead-form.tsx) | Modalità `legacy/public`, `architect-path`, `patrimonial-event`; timeout client 35 secondi; blocco del doppio submit durante l'invio; nessun request ID durevole; redirect pilota solo dopo `ok: true`; successo legacy inline |
| [Handler](../../src/lib/public-leads/handler.ts) e [route](../../src/app/api/public-leads/route.ts) | Origin check, JSON entro 12.000 byte, honeypot, limite process-local di 5 tentativi/minuto per chiave IP hashata; upsert, tag e nota in sequenza; timeout di 10 secondi per chiamata; 503 senza configurazione; 502 anche dopo scritture parziali |
| [Contratto pilota](../../src/lib/public-leads/patrimonial-funnels.ts) | Discriminante obbligatorio per i nuovi payload, allowlist dei campi, source path coerente col modo; consensi booleani, enum e UTM validati; nessun mapping opportunity/custom field |
| [Contenuto pilota](../../src/content/patrimonial-funnels.ts) | Titolo evento configurabile; nessuna chiave edizione o data operativa ISO; privacy `patrimonial-pilot-privacy-v1`, marketing `patrimonial-pilot-marketing-v1` |
| [Contratto pubblico](../../src/content/patrimonial.ts) | Interessi legacy `evento-patrimoniale` e `percorso-consulenti`; privacy `patrimoniale-privacy-v1`; richiesta informazioni/ricontatto, senza marketing e senza prenotazione |
| [Adapter HighLevel](../../src/lib/radar/highlevel.ts) | API base LeadConnector, versione `2021-07-28`, token e location da `HIGHLEVEL_PRIVATE_TOKEN`/`HIGHLEVEL_LOCATION_ID`; trasporto attuale solo POST; upsert senza tag, aggiunta tag separata, note separate |
| Radar: [avvio](../../src/app/api/radar/session/route.ts), [completamento](../../src/app/api/radar/complete/route.ts) | Sync CRM tramite `after()` e wrapper che registra gli errori senza bloccare il Radar; non è una coda durevole di retry CRM |
| Annunci 10x: [webhook commerce](../../src/lib/annunci-10x/payments/commerce.ts), [consegna report](../../src/lib/annunci-10x/score-report-email.ts), [runner](../../src/lib/annunci-10x/analysis-run.ts) | Esistono pattern di claim persistente, lease, eventi elaborati e stato di consegna. Riutilizzare il disegno, non tabelle, sessioni, entitlement o credenziali di quel prodotto |

La ricerca nel codice non ha individuato altri adapter HighLevel, endpoint `/opportunities`, mapping `pipelineId`/`pipelineStageId`, custom field remoti o calendario HighLevel. Le “opportunities” di AI Score e le “pipeline” AI di Annunci sono concetti diversi, non mapping commerciali. Non si deduce da questo che l'account HighLevel sia privo di configurazioni: lo stato remoto è sconosciuto.

### Modello raccomandato

1. **Un contatto CRM per persona risolta**, condiviso con Radar, Annunci e gli altri funnel; nessuna copia per divisione.
2. **Pipeline Architetto**: una opportunità aperta per contatto e programma professionale.
3. **Pipeline Evento**: una sola opportunità di relazione evento attiva per contatto; un record Participation unico per contatto + edizione mantiene la granularità delle registrazioni. Prima della scelta, una partecipazione generica PENDING_EDITION resta distinta dalle registrazioni confermate.
4. **Pipeline Confronti Benessere Patrimoniale**: separata dalle registrazioni, aperta solo su richiesta esplicita di confronto; una opportunità aperta per contatto e finalità di confronto, anche se proviene da più edizioni.
5. **Registro applicativo durevole** per richieste, identità risolte, edizioni, partecipazioni, evidenze dei consensi, operazioni CRM e messaggi. Necessario per idempotenza affidabile; note e memoria di processo non lo sostituiscono.

Le tre pipeline separano obiettivi diversi: attivazione professionale, relazione evento con partecipazioni per edizione, confronto individuale. Il termine `WON` nelle ultime due indica il rispettivo obiettivo operativo, **non un ricavo o una vendita**; nessun valore economico è inventato. Evitare report di “vendite vinte” aggregati tra queste pipeline.

### Contratto dati applicativo per 2B.2

L'endpoint resta `/api/public-leads`. Il payload pilota futuro usa `contractVersion = patrimonial-lead-v2` e il discriminante `mode` esistente. Il parser legacy e i payload 2A restano separati e compatibili; nessuna conversione implicita da richiesta informazioni a registrazione o candidatura.

| Dato | Origine e regola normativa |
| --- | --- |
| `requestId` / header `Idempotency-Key` | UUID generato una volta per tentativo logico; stessi dati e stesso ID nei retry; non è un ID HighLevel né la chiave della persona |
| `mode` | `architect-path` oppure `patrimonial-event`; non accettare altri valori come legacy |
| `sourcePath` | I due path pilota già ammessi; il server li deriva/verifica, non accetta provenienze arbitrarie |
| `firstName`, `lastName` | Obbligatori, trim, massimo 120 caratteri ciascuno, niente CR/LF; aggiornamento dei dati stabili secondo sezione 7 |
| `email` | Obbligatoria, trim e lowercase come in 2A, massimo 254; nessuna rimozione di punti o suffissi `+`; non equivale a email verificata |
| `phone` | Obbligatorio Architetto, facoltativo Evento; massimo 40 in ingresso, normalizzazione E.164 con helper corrente; chiarire paese per numeri esteri prima di ampliare il mercato |
| `province` | Obbligatoria, 2–80 caratteri in 2A; in 2B.2 vocabolario Italia/estero da approvare senza inventare province da IP o prefisso telefonico |
| `profile` | Facoltativo; enum specifico del funnel riportato sotto; vuoto significa sconosciuto, non “Altro” |
| `experience`, `goal`, `availability` | Solo Architetto, facoltativi; enum sotto; vietati nel payload Evento |
| `message` | Facoltativo, massimo 1.500; risposta aperta con scopo dichiarato; non trasmetterla agli analytics |
| `consent` | Presa visione e richiesta di ricontatto: deve essere `true` per ricevere la richiesta; non è consenso marketing o WhatsApp |
| `marketingConsent` | Booleano esplicito, inizialmente `false`; snapshot della scelta su quel form, non revoca implicita di un consenso precedente |
| `utm` | Solo i cinque campi già previsti, massimo 100 caratteri ciascuno, niente CR/LF; facoltativi; assenza non sovrascrive dati storici |
| `eventEditionId` | Solo Evento; facoltativo per interesse generico, obbligatorio per conferma; deve risolvere un'edizione nel registro server. Un campo inviato dal browser non basta a renderla confermabile |
| Programma, titolo, date, versioni privacy/marketing, finalità, timestamp | Risolti dal server e salvati come snapshot; il browser non può scegliere una vecchia informativa o dichiarare un timestamp di consenso autorevole |
| `contactId`, `opportunityId`, owner/stage/appointment ID | Solo server da mapping validato o risposta del provider; mai affidarsi a ID inviati dal form pubblico |

Enum di ingresso v1, mantenuti dalle fonti 2A:

- Profilo Architetto: `Imprenditore`, `Commerciale`, `Professionista`, `Networker`, `Dipendente`, `Altro`.
- Esperienza: `Sì`, `No`; obiettivo: `Cambio professionale`, `Attività aggiuntiva`, `Nuovo progetto imprenditoriale`, `Sto esplorando`; disponibilità: `Da definire`, `Part-time`, `Full-time`.
- Profilo Evento: `Privato`, `Imprenditore`, `Professionista`, `Altro`.
- La configurazione remota mappa questi valori semantici alle opzioni effettive: non presume ID delle opzioni e non mescola i due profili.

Entità logiche minime del registro (non schema SQL, non create in questa fase):

| Entità | Chiave/invarianti | Dati principali |
| --- | --- | --- |
| Richiesta | `request_id` unico; hash canonico immutabile del payload | Modo, snapshot, ricevuta server, stato, contatto/intenzione risolti, evidenze consenso |
| Intenzione/opportunità | Chiavi business della sezione 8 | Ciclo, versione, owner, remote ID, stato commerciale, next step, legami alle richieste |
| Edizione | ID interno immutabile | Slug evento stabile, titolo snapshot, inizio/fine UTC, fuso IANA `Europe/Rome`, stato, modalità di accesso e regola capienza approvati |
| Partecipazione | Unica per contatto + edizione; prima della scelta, una generica attiva per contatto + slug | Legame alla stessa relazione E, revisione propria, request ID, snapshot edizione, registrazione, booking, presenza, evidenze e rettifiche |
| Operazione/outbox | Unica per intenzione + effetto + versione | Stato di ogni scrittura, lease, tentativi, remote ID, errore sanificato, prossima esecuzione |
| Evidenza/evento | ID unico e collegamenti tipizzati | Cambi di stato, consensi per finalità/canale, webhook, messaggi; storico append-only salvo retention/rettifiche |

Queste entità possono essere consolidate fisicamente in uno store esistente, purché transazioni e vincoli unici siano reali. Un semplice JSON locale su serverless non è uno store durevole condiviso. La scelta dello store e l'eventuale migration richiedono approvazione 2B.2; nessuna nuova infrastruttura è autorizzata da questo documento.

## 2. Pipeline Architetto definitiva proposta

Chiave logica di configurazione: `ARCHITECT_PATH`. È un nome interno, non un ID remoto. Programma stabile separato dal titolo pubblico. Stati dominio `OPEN`, `WON`, `LOST`, `ABANDONED`; mapping ai valori effettivi HighLevel da validare in 2B.2.

| Stage | Label | Stato | Criterio di ingresso/uscita |
| --- | --- | --- | --- |
| A01 | Nuovo interesse | OPEN | Richiesta valida acquisita durevolmente; risolvere identità e owner |
| A02 | Presentazione da prenotare | OPEN | Invito pronto/inviato a una sessione realmente prenotabile |
| A03 | Presentazione prenotata | OPEN | Prenotazione confermata e sessione identificata; un click non basta |
| A04 | Da qualificare | OPEN | Partecipazione verificata; la presenza è un dato, non uno stage transitorio aggiuntivo |
| A05 | Colloquio da fissare | OPEN | Qualificazione completata e decisione umana di proporre colloquio |
| A06 | Colloquio fissato | OPEN | Appuntamento confermato; reminder legati alla sua revisione |
| A07 | Valutazione e prossimo passo | OPEN | Colloquio svolto; esito, idoneità e accordi da registrare o avvio da concordare |
| A08 | Percorso avviato | OPEN | Accordo e avvio effettivo documentati; non è ancora attivazione |
| A09 | Architetto Patrimoniale attivato | WON | Responsabile autorizzato conferma i criteri di attivazione approvati |
| A10 | Chiuso senza attivazione | LOST / ABANDONED | Motivo obbligatorio e autore; nessuna chiusura per semplice errore tecnico |

Riduzione della proposta originale: “Presentazione partecipata” diventa evidenza/presenza; “Colloquio svolto” diventa evento con esito; “Idoneo / prossimo step” è rappresentato dall'idoneità e da A07; “Non idoneo” è una chiusura motivata, non un passaggio aperto. “Consulente attivato” viene denominato con il ruolo approvato, senza attribuire qualifiche finanziarie.

Esito del colloquio: `PENDING`, `PROCEED`, `DO_NOT_PROCEED`, `NEEDS_FOLLOW_UP`. Idoneità: `PENDING`, `ELIGIBLE`, `NOT_ELIGIBLE`, `WITHDRAWN`. Sono concetti distinti: un colloquio positivo non avvia automaticamente il percorso. No-show/cancellazione sono stati dell'appuntamento e non idoneità negativa.

Motivi di chiusura: `NOT_ELIGIBLE`, `NOT_INTERESTED`, `WITHDRAWN`, `UNREACHABLE_AFTER_REVIEW`, `DUPLICATE_MERGED`, `INVALID_REQUEST`. `ABANDONED` è riservato a ritiro/abbandono effettivo; non confonderlo con `LOST`. L'esatta distinzione statistica è da approvare. Rinvio concordato: resta OPEN con data e next step; nessuna opportunità aperta senza una prossima azione o revisione.

## 3. Pipeline Evento definitiva proposta

### Relazione evento e registrazioni — `PATRIMONIAL_EVENT`

E rappresenta la relazione operativa, mentre Participation è la fonte di verità per ciascuna edizione. Lo stage E sintetizza il percorso raggiunto: una nuova richiesta o seconda edizione non lo riporta indietro. E02 non conferma tutte le partecipazioni; i gate si applicano al singolo record. E05 richiede che tutte le partecipazioni collegate siano risolte; una nuova richiesta su E chiusa richiede revisione e riapertura esplicita del medesimo record CRM, conservando cicli e storico.

| Stage | Label | Stato | Criterio |
| --- | --- | --- | --- |
| E01 | Richiesta di partecipazione | OPEN | Interesse generico o richiesta per edizione; conferma ancora assente |
| E02 | Iscrizione confermata | OPEN | Almeno una partecipazione ha superato tutte le condizioni tecniche della sezione 11 |
| E03 | Esito da registrare | OPEN | Un'edizione confermata è conclusa; attendere evidenza di presenza sulla partecipazione |
| E04 | Follow-up | OPEN | Esito noto; gestire follow-up appropriato o richiesta di nuova edizione |
| E05 | Conclusa | WON / LOST / ABANDONED | Attività evento concluse e motivo registrato |

`WON`: presenza verificata e follow-up operativo eseguito o motivatamente non necessario. `LOST`: no-show dopo gestione, richiesta non confermabile chiusa, non interessato. `ABANDONED`: cancellazione/ritiro. L'esito del confronto individuale non tiene aperta questa opportunità.

Accorpamenti: “Nuovo iscritto” e “Iscrizione da confermare” confluiscono in E01, che non chiama iscritto chi ha solo fatto richiesta. “Evento imminente” è una condizione temporale, non uno stage. “Partecipato” e “No-show” sono valori di presenza; “Interesse post-evento” è una nuova intenzione documentata, non una prenotazione implicita.

Presenza: `UNKNOWN`, `ATTENDED`, `NO_SHOW`, `CANCELLED`, `NOT_APPLICABLE`. Non impostare `NO_SHOW` per assenza di dati, per iscrizione ancora non confermata o per edizione cancellata. Chiusura temporale proposta: classificazione entro 1 giorno lavorativo dall'evento, con revisione owner dei casi sconosciuti.

### Confronti individuali — `PATRIMONIAL_CONSULTATION`

| Stage | Label | Stato | Criterio |
| --- | --- | --- | --- |
| C01 | Appuntamento richiesto | OPEN | Richiesta esplicita della persona; associare owner |
| C02 | Appuntamento fissato | OPEN | Booking confermato |
| C03 | Esito da registrare | OPEN | Appuntamento svolto, esito da verificare |
| C04 | Approfondimento concordato | OPEN | Esiste una prossima azione concreta concordata |
| C05 | Concluso | WON / LOST / ABANDONED | Obiettivo del confronto concluso o rinuncia motivata |

Esiti: `PENDING`, `INFORMATION_PROVIDED`, `QUALIFIED_FOLLOW_UP`, `NOT_INTERESTED`, `OUT_OF_SCOPE`. Un no-show resta nello storico dell'appuntamento e porta a riprogrammazione o chiusura motivata; non è automaticamente `NOT_INTERESTED`.

Una nuova opportunità C viene creata **solo dopo richiesta di confronto**, anche durante il webinar o da un no-show che lo richieda. Non per ogni partecipante, apertura email o click “Parliamone”. Collegare tutte le registrazioni d'origine, mantenendo una sola opportunità C aperta per persona/finalità. Più edizioni producono partecipazioni distinte collegate alla stessa E e possono riferirsi alla stessa C.

## 4. Contact fields

“Obbligatorio” significa necessario al dominio nel momento indicato; non implica rendere globalmente obbligatorio un campo HighLevel per contatti Radar/Annunci. I tipi consigliati vanno verificati nell'account. Le chiavi `hz_` sono nomi tecnici proposti, non ID remoti esistenti.

| Nome tecnico | Label | Oggetto | Tipo consigliato | Valori ammessi | Obbligatorio | Origine | Funnel | Note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `firstName`, `lastName` nativi | Nome, Cognome | contact | Testo nativo | Testo validato | Sì al form | Form / verifica owner | Entrambi | Non creare copie `hz_`; preservare anagrafica verificata in caso di conflitto |
| `email` nativo | Email | contact | Email nativa | Normalizzata | Sì al form | Form / identità risolta | Entrambi | Non equivale a proprietà verificata |
| `phone` nativo | Telefono | contact | Telefono E.164 | Numero valido o assente | Architetto sì; Evento no | Form / verifica | Entrambi | Un telefono condiviso non prova identità |
| `hz_province` | Provincia dichiarata | contact | Testo; select dopo vocabolario approvato | Provincia / estero da definire | Sì al form | Form | Entrambi | Non usare `state` nativo senza verificarne il significato; snapshot anche sulla richiesta |
| `hz_marketing_consent` | Stato marketing Horyzon | contact | Select singolo | UNKNOWN / PENDING_VERIFICATION / GRANTED / DENIED / WITHDRAWN | No per servizio | Registro consensi | Entrambi | Proiezione per finalità definita, non autorizzazione universale per canale |
| `hz_marketing_consent_version` | Versione consenso marketing efficace | contact | Testo | Versione registrata | Se GRANTED | Registro consensi | Entrambi | Non usare la versione di un form con checkbox non selezionata per sostituire un grant precedente |
| `hz_marketing_consent_at` | Data evidenza marketing efficace | contact | Testo ISO 8601 UTC | Timestamp server | Se stato risolto | Registro consensi | Entrambi | Il tipo Data semplice non conserva l'ora; usare ISO se manca un tipo data/ora adeguato |
| `assignedTo` nativo, alias di progetto `hz_assigned_owner` | Referente contatto | contact | Owner nativo | Utente effettivamente mappato | No | CRM / coordinamento | Tutti | Non creare custom field duplicato; preservare owner preesistente, usare owner opportunità per il funnel |

Non mettere sul contatto profilo del singolo funnel, edizione, presenza, stage, obiettivo professionale o stato appuntamento. La stessa persona può dichiarare profili diversi nei due contesti. La presa visione privacy viene salvata per richiesta, non ridotta a un solo flag globale. Non copiare gli UTM del nuovo funnel nel campo sorgente originaria di un contatto Radar.

## 5. Opportunity fields

Le colonne “obbligatorio” e “origine” distinguono ingresso, transizione e dati facoltativi. Owner, stage e stato si usano nativi; i nomi di ID sono risolti solo server-side.

### Comuni

| Nome tecnico | Label | Oggetto | Tipo consigliato | Valori ammessi | Obbligatorio | Origine | Funnel | Note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `hz_intent_key` | Chiave intenzione | opportunity | Testo | Chiave opaca stabile, senza email/telefono in chiaro | Sì | Server | A/E/C | Mirror per riconciliazione; non presumere vincolo univoco remoto |
| `hz_funnel` | Percorso di origine | opportunity | Select singolo | architect-path / patrimonial-event / patrimonial-consultation | Sì | Server | A/E/C | Separato dal nome pubblico |
| `hz_source` | Sorgente acquisizione | opportunity | Testo controllato | website-pilot / legacy-information / manual-request | Sì | Server / operatore auditato | A/E/C | Legacy non viene promosso automaticamente a iscrizione |
| `hz_source_path` | Pagina della prima richiesta | opportunity | Testo | Path allowlist o provenienza manuale esplicita | Sì | Server | A/E/C | Immutable first touch dell'intenzione, non della persona |
| `hz_utm_source` | UTM source | opportunity | Testo | Fino a 100 caratteri | No | Form validato | A/E/C | First request; C eredita snapshot dalla richiesta esplicita e riferimenti all'edizione |
| `hz_utm_medium` | UTM medium | opportunity | Testo | Fino a 100 caratteri | No | Form validato | A/E/C | Stessa regola |
| `hz_utm_campaign` | UTM campaign | opportunity | Testo | Fino a 100 caratteri | No | Form validato | A/E/C | Stessa regola |
| `hz_utm_content` | UTM content | opportunity | Testo | Fino a 100 caratteri | No | Form validato | A/E/C | Stessa regola |
| `hz_utm_term` | UTM term | opportunity | Testo | Fino a 100 caratteri | No | Form validato | A/E/C | Stessa regola |
| `hz_requested_at` | Prima richiesta ricevuta | opportunity | Testo ISO UTC | Timestamp server | Sì | Registro richieste | A/E/C | Nuovi invii conservati nello storico, non riscrivono la prima data |
| `hz_privacy_version` | Versione informativa della prima richiesta | opportunity | Testo | Snapshot server | Sì per form | Registro consensi | A/E/C | Le successive versioni restano nelle evidenze per richiesta |
| `hz_marketing_consent_snapshot` | Marketing nella prima richiesta | opportunity | Select singolo | NOT_GRANTED_THIS_REQUEST / GRANTED_THIS_REQUEST | Sì per form | Snapshot booleano del form | A/E/C | Non sostituisce lo stato efficace sul contatto |
| `hz_next_step` | Prossima azione | opportunity | Select singolo | ASSIGN / INVITE_PRESENTATION / BOOK_PRESENTATION / QUALIFY / BOOK_INTERVIEW / RECORD_OUTCOME / AGREE_PATH_START / CONFIRM_EDITION / RECORD_ATTENDANCE / FOLLOW_UP / BOOK_CONSULTATION / REVIEW / NONE | Sì se OPEN | Transizione / owner | A/E/C | Task con scadenza collegato; NONE solo per terminali |
| `hz_next_step_at` | Scadenza prossima azione | opportunity | Testo ISO UTC | Timestamp o assente | Sì se OPEN | Regola SLA / owner | A/E/C | Date nel fuso dell'utente in UI, UTC nello storico |
| `assignedTo` nativo, alias `hz_assigned_owner` | Owner percorso | opportunity | Owner nativo | Utente mappato e disponibile | Sì dopo assegnazione | Routing | A/E/C | Nessun custom field owner parallelo |
| `pipelineId`, `pipelineStageId`, `status` nativi | Pipeline, fase, stato | opportunity | Campi nativi | Mapping delle sezioni 2–3 | Sì | Motore transizioni / owner | A/E/C | Non creare custom field speculari |
| Motivo chiusura nativo, altrimenti `hz_close_reason` | Motivo chiusura | opportunity | Nativo / select | Motivi specificati dal percorso | Alla chiusura | Owner / evento autorizzato | A/E/C | Creare il custom solo se il nativo non copre il contratto |

Lo storico completo UTM e le modifiche non richiedono dieci campi first/last sul CRM: conservarli per richiesta nel registro, con nota sintetica del nuovo interesse. L'origine iniziale di un'intenzione non viene riscritta da un retry.

### Architetto

| Nome tecnico | Label | Oggetto | Tipo consigliato | Valori ammessi | Obbligatorio | Origine | Funnel | Note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `hz_architect_profile` | Profilo professionale dichiarato | opportunity | Select singolo | I sei valori Architetto della sezione 1, oppure vuoto | No | Form | A | Non trasferire su profilo Evento |
| `hz_architect_sales_experience` | Esperienza commerciale/relazionale | opportunity | Select singolo | Sì / No / vuoto | No | Form | A | Vuoto non è No |
| `hz_architect_goal` | Cosa sta cercando | opportunity | Select singolo | I quattro obiettivi della sezione 1 | No | Form | A | Aggiornare solo con nuova dichiarazione esplicita, conservando storico |
| `hz_architect_availability` | Disponibilità | opportunity | Select singolo | Da definire / Part-time / Full-time / vuoto | No | Form | A | Non è disponibilità calendario |
| `hz_architect_open_answer` | Motivazione dichiarata | opportunity | Testo lungo | Fino a 1.500 caratteri | No | Form | A | Snapshot operativo corrente; no dati sensibili richiesti |
| `hz_architect_presentation_date` | Presentazione prenotata | opportunity | Testo ISO UTC | Inizio sessione confermata | In A03 | Booking/sessione | A | Mirror, ID sessione e storico nel registro |
| `hz_architect_presentation_attended` | Presenza presentazione | opportunity | Select singolo | UNKNOWN / ATTENDED / NO_SHOW / CANCELLED | Dopo sessione, se evidenza | Fonte presenza / owner | A | Non booleano, non derivato dall'apertura email |
| `hz_architect_interview_date` | Colloquio prenotato | opportunity | Testo ISO UTC | Inizio booking confermato | In A06 | Appuntamento | A | Il booking nativo rimane la verità operativa |
| `hz_architect_interview_outcome` | Esito colloquio | opportunity | Select singolo | PENDING / PROCEED / DO_NOT_PROCEED / NEEDS_FOLLOW_UP | Dopo colloquio | Owner autorizzato | A | Non comprende no-show: quello è attendance del booking |
| `hz_architect_eligibility` | Valutazione idoneità | opportunity | Select singolo | PENDING / ELIGIBLE / NOT_ELIGIBLE / WITHDRAWN | Prima avvio/chiusura | Decisione umana motivata | A | Nessuno scoring automatico o inferenza da dati sensibili |

Non creare `hz_architect_path_started` e `hz_architect_activated` come checkbox: stage/eventi `architect_path_started` e `architect_activated`, con timestamp e autore nel registro, evitano coppie incoerenti “false ma stage avviato”. Se serve un mirror data per un report CRM, introdurlo solo su esigenza dimostrata.

### Evento: dati nel registro locale, senza mirror sull'opportunity

Non creare alcun `hz_event_*` su E, neppure slug o presenza “CURRENT/LATEST”: una relazione può comprendere più edizioni e interessi, quindi tali mirror sarebbero ambigui. Slug, titolo/date/fuso/revisione edizione, stato registrazione e presenza vivono in Participation; profilo e domanda restano negli snapshot delle richieste collegate. Le precedenti proposte `hz_event_slug`, `hz_event_title`, `hz_event_edition`, `hz_event_date`, `hz_event_profile`, `hz_event_question`, `hz_event_registration_status`, `hz_event_attendance` sono ritirate dal mapping remoto. E conserva soltanto i campi comuni. Nessuna granularità per edizione è persa e nessuna lista di edizioni viene copiata sul contatto.

### Confronto

| Nome tecnico | Label | Oggetto | Tipo consigliato | Valori ammessi | Obbligatorio | Origine | Funnel | Note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `hz_origin_event_edition` | Edizione che ha originato il confronto | opportunity | Testo | Edizione o vuoto se origine diversa | Se da evento identificato | Richiesta esplicita | C | Prima origine; ulteriori edizioni sono relazioni nello storico |
| `hz_consultation_outcome` | Esito confronto | opportunity | Select singolo | PENDING / INFORMATION_PROVIDED / QUALIFIED_FOLLOW_UP / NOT_INTERESTED / OUT_OF_SCOPE | Dopo confronto | Owner | C | Non esito di vendita o raccomandazione finanziaria |

Non creare `hz_event_consultation_requested` sul contatto: esistono intenzione C ed evento `consultation_requested`. `hz_event_consultation_date` è rappresentata dall'appuntamento nativo di C; `hz_event_consultation_outcome` confluisce in `hz_consultation_outcome` su C. Nessun duplicato di stage/campo su E che possa divergere da C.

### Note e record dedicato

Nota CRM per una **nuova richiesta logica**: marker opaco request ID, modo, path, timestamp, qualificazione/risposta, versioni e scelte del form, UTM, riferimento all'intenzione. Note successive solo per nuovi eventi o rettifiche: non a ogni retry. Le note non sono la fonte di verità dei consensi, dell'idempotenza o delle presenze. Il registro edizione contiene date, variazioni, accesso e partecipazioni; non salvare una lista di edizioni in un campo contatto.

## 6. Tag

| Categoria | Tag | Regola |
| --- | --- | --- |
| Identità divisione | `horyzon-patrimoniale` | Aggiungere, senza sostituire i tag esistenti |
| Appartenenza funnel | `percorso-architetto-patrimoniale` | Persistente per chi ha espresso questo interesse; non significa idoneità o attivazione |
| Appartenenza funnel | `evento-patrimoniale` | Persistente; non significa iscrizione confermata o presenza |
| Coorte pilota | `pilot` | Mantenere durante il pilot; non usarlo come trigger operativo o consenso. In produzione non aggiungerlo ai nuovi ingressi; conservare la coorte storica nel registro, rimozione dai vecchi contatti solo con decisione separata |
| Legacy | `horyzon-benessere-patrimoniale`, `horyzon-evento-patrimoniale`, `horyzon-percorso-consulenti` | Restano invariati per `/contatti`; nessuna rimozione/rinomina massiva e nessuna equiparazione automatica al pilota |

Nessun tag sorgente nuovo: UTM e source field bastano; preservare gli eventuali tag `radar-fonte-*` aggiunti dal Radar. Nessun tag temporaneo indispensabile: retry e task usano stato outbox/next step. Evitare tag per stage, provincia, no-show, edizione, reminder inviato, consenso o “errore sync”: producono proliferazione e non sostituiscono dati strutturati. Eventuali tag operativi futuri devono avere owner, TTL e motivo non coperto dai campi.

Non avviare workflow su “tag aggiunto” per ogni invio: il tag potrebbe esserci già da mesi. Il trigger robusto è un evento business deduplicato legato alla richiesta/intenzione. La [documentazione Radar](../radar/operations.md) suggerisce trigger sui tag per quel percorso; non dimostra workflow esistenti e non è una garanzia di consegna per i nuovi funnel.

## 7. Regole deduplica

Identificatore canonico dopo risoluzione: `location_id + contact_id` HighLevel. Prima della risoluzione: email normalizzata come chiave primaria di ricerca, con alias interno protetto; telefono E.164 come segnale secondario, **non prova autonoma di identità**. Non promettere “zero duplicati” basandosi sul solo `/contacts/upsert`: dipende dalle impostazioni remote e dalle collisioni.

| Caso | Comportamento |
| --- | --- |
| Stessa email, stesso telefono o telefono non fornito | Riutilizzare il contatto univoco; non cancellare il telefono esistente perché il nuovo form lo omette; nuova intenzione o aggiornamento secondo sezione 8 |
| Stessa email, nuovo telefono non collegato ad altri | Conservare il dichiarato nella richiesta; aggiornare il dato stabile solo secondo verifica/precedenza approvata; non rimpiazzare un numero verificato con uno anonimo |
| Stessa email, telefono appartenente a un altro contatto | `IDENTITY_REVIEW`; nessuna fusione o sovrascrittura automatica, nessun invio al nuovo numero |
| Email diversa, stesso telefono | Conservare la nuova richiesta e sospendere la risoluzione; possibile persona nuova, email alternativa o numero condiviso. Non unire automaticamente e non sovrascrivere email |
| Nessun match email, match telefonico univoco senza email sul CRM | Fallback ammesso solo dopo verifica del titolare da owner/procedura approvata; il form pubblico da solo non autorizza il collegamento |
| Più match per email o telefono | Revisione manuale; annotare candidati nel registro con accesso limitato, non scegliere il primo risultato |
| Nessun match | Creare/upsertare una volta sotto lock dell'identità; salvare subito il contact ID; su timeout incerto riconciliare prima di ricreare |
| Contatto già da Radar | Riutilizzare il contact ID risolto; mantenere tag, sorgente originaria, owner contatto, note e dati Radar; nuova opportunity patrimoniale separata |
| Contatto già da Annunci 10x | Se già presente in HighLevel, stessa regola. La repo non dimostra sync CRM Annunci: non presumere che ogni lead Annunci sia un contatto remoto o importarne gli utenti automaticamente |
| Contatto dall'altro funnel patrimoniale | Stesso contatto, opportunità distinta; qualificazione, owner e consensi per finalità non si sovrascrivono |
| Nuovo invio esplicito della stessa persona | Nuovo request ID e snapshot; conservare la nuova intenzione anche se si riusa l'opportunità aperta; aggiornare solo i campi dichiarati non vuoti con regola di precedenza |
| Retry del medesimo invio | Stesso request ID, stessi dati: riprendere l'operazione; nessuna nuova nota/opportunità/evento di conversione |

Le richieste pubbliche non verificano proprietà dell'email: una corrispondenza permette di associare l'intenzione al caso da gestire, non di cambiare dati anagrafici verificati, abilitare WhatsApp o modificare diritti di accesso. Precedenza dei dati stabili: verifica umana/profilo verificato > dato già affidabile > nuova dichiarazione non verificata; conflitti conservati per revisione. Non spostare automaticamente l'owner contatto da un altro team.

Il trasporto 2A può upsertare insieme email e telefono senza lettura preliminare: in 2B.2 occorrono lookup e gestione collisioni prima di usare l'upsert per i payload v2. Scelta dei parametri di deduplica effettivi, scope di lettura e comportamento email/telefono del sub-account sono gate remoti da verificare, non assunti.

Inoltre 2A invia `source` a ogni upsert: non garantisce che la sorgente originaria di un contatto esistente resti intatta. Il futuro adapter deve omettere l'aggiornamento della source nativa sui contatti già risolti e salvare la nuova provenienza sull'intenzione/richiesta; verificare questa precedenza nell'account prima del cutover.

## 8. Regole opportunity

| Intenzione | Chiave business | Creazione e riuso |
| --- | --- | --- |
| Architetto | Contatto risolto + programma stabile + ciclo | Al primo interesse; vincolo di una sola OPEN per contatto/programma. Nuovo invio su OPEN aggiunge richiesta e aggiornamenti pertinenti, senza tornare ad A01 |
| Relazione evento | Contatto risolto + relazione evento patrimoniale + ciclo | Una sola E per contatto nella pipeline; massimo una OPEN. Nuove edizioni riusano E e preservano lo stage; ciclo nuovo solo per riapertura esplicita, conservando il remote ID |
| Interesse evento senza edizione | Contatto + slug evento + interesse generico attivo | Partecipazione PENDING_EDITION sotto la stessa E, senza meeting o prenotazione; prima richiesta crea E01 |
| Iscrizione evento | Contatto + edizione | Una sola Participation per edizione, anche con più invii. Nuova edizione = nuova Participation, stessa E; revisione e conferma indipendenti |
| Confronto individuale | Contatto + finalità patrimoniale + ciclo | Una sola C OPEN per finalità; richieste da più webinar si collegano allo stesso caso. Un evento diverso non crea da solo un secondo appuntamento |

Promuovere interesse generico a edizione soltanto dopo scelta/accettazione dell'edizione o conferma manuale documentata. Se esiste già Participation per quell'edizione, assorbire i request ID nella partecipazione esistente e conservare il riferimento del generico superato, senza duplicare E o Participation. Usare transazione e lock nel registro; il titolo non entra nella chiave.

Una persona può avere contemporaneamente A, una E collegata a più Participation per edizioni diverse e una C. Il vincolo provider è per contatto nella stessa pipeline: non applicare un vincolo globale tra A/E/C.

Opportunità chiuse: nessuna riapertura automatica da un form generico. Per A già attivata, registrare il nuovo contatto e avvisare l'owner; per nuova candidatura dopo chiusura, nuovo ciclo solo con revisione. Per una Participation già confermata, invio duplicato non aumenta iscritti; una partecipazione cancellata non viene riprenotata implicitamente. E chiusa riceve la richiesta con revisione owner, senza cambiare stato; solo un comando autorizzato riapre il ciclo conservando la stessa opportunity remota. Edizione passata: nessuna conferma retroattiva. Per C chiusa, una nuova richiesta sostanziale può aprire un nuovo ciclo mantenendo lo storico.

Le transizioni sono comandi con revisione attesa, prerequisiti, autore, timestamp ed evidenza. Non forzare lo stage iniziale su un'opportunità preesistente; non sovrascrivere una scelta umana più recente con un job vecchio. Cancellazione o nuova edizione non cancellano gli eventi precedenti.

## 9. Retry e idempotenza

### Garanzia progettata

Con il codice 2A non esistono idempotenza server, replay della risposta, deduplica note o ripresa della scrittura interrotta. Il blocco client non copre refresh, più schede, timeout dopo commit remoto o doppio webhook. Un marker temporale da solo non distingue retry da nuova intenzione.

Per 2B.2 è richiesto un registro transazionale durevole con outbox, claim/lease e vincoli unici. La garanzia è **acquisizione locale una volta, effetti remoti riconciliati almeno una volta**, non una transazione distribuita atomica con HighLevel. Non assumere supporto di una header idempotency HighLevel per contatti/note/opportunità senza verifica specifica.

Sequenza progettata:

1. Validare origin, formato, limiti, payload/versione, consenso e idempotency key. La chiave non sostituisce honeypot/rate limit.
2. Inserire richiesta + hash canonico + evidenze consenso + intenzione/outbox in una transazione. Stessa chiave/stesso hash restituisce la stessa ricevuta; stessa chiave/dati diversi restituisce 409 senza mutazioni.
3. Restituire ricevuta durevole del pilota, eventualmente HTTP 202 con `ok: true`, `requestId`, `receiptStatus: received`, `crmStatus: pending`. Questo significa solo richiesta acquisita. Legacy resta col contratto attuale, senza modifica implicita della sua risposta.
4. Worker con lease acquisisce l'intenzione; risolve identità, esegue ciascun effetto e salva remote ID/stato prima del successivo. Non usare `after()` come unica coda: un job persistente deve poter ripartire dopo crash.
5. Prima di ogni creazione incerta cercare il risultato remoto con chiave/mapping; dopo successo locale pubblicare una sola volta l'evento business in outbox. Messaggi e conversioni consumano tale evento, non il retry HTTP.
6. Eventuale status endpoint espone solo stato minimo, con capability/sessione protetta e scadenza; nessuna ricerca pubblica per email o esposizione di PII. Idempotency key non è un sistema di autenticazione dei dati della persona.

Il client conserva solo request ID/riferimento opaco in sessionStorage, non PII o contenuti del form. Mantiene lo snapshot del tentativo per retry; se l'utente cambia dati dopo invio deve iniziare una nuova revisione/request ID. Dopo reload, risolvere lo stato della ricevuta prima di ricreare una richiesta; non attribuire automaticamente una nuova conversione.

### Ripresa degli effetti

| Errore | Stato e azione |
| --- | --- |
| Contatto creato, tag fallito | Contact ID già salvato; riprovare solo aggiunta tag mancanti. Non ripetere create e non rimuovere tag preesistenti |
| Contatto creato, nota fallita | Riprendere la nota col medesimo marker request ID. Se la risposta è incerta, cercare marker/note o sospendere per revisione; mai append cieco |
| Opportunity creata, stage update fallito | Remote opportunity ID e revisione sono salvati; ritentare update se ancora pertinente, non creare una seconda opportunity |
| Timeout dopo create remoto prima del salvataggio ID | Stato `RECONCILE_REQUIRED`; lookup per contatto/intent key e finestra dell'operazione; se non risolvibile con certezza, operatore. Non assumere che timeout significhi “non creato” |
| Timeout client | Ricevuta può già esistere; retry con la stessa chiave restituisce stato salvato, senza rifare tutti gli effetti |
| Retry manuale | Comando sul medesimo request/operation ID con audit, non nuovo modulo inviato dall'operatore |
| Doppio submit / due worker | Vincolo request ID e lock/lease intenzione; solo un worker attivo. Stesso intento con due request ID conserva due dichiarazioni ma una sola opportunity secondo sezione 8 |
| Doppio webhook | Vincolo provider + location + event ID; ACK dopo acquisizione durevole. Se non è deduplicabile, hashing deterministico solo su campi stabili e revisione, con documentazione della collisione possibile |
| Webhook fuori ordine | Confrontare appointment ID, revisione e evento autorevole; conservare storico, ignorare effetti obsoleti. Un vecchio booking non riattiva reminder cancellati |

Stati tecnici separati dagli stage: `RECEIVED`, `IDENTITY_REVIEW`, `SYNC_PENDING`, `SYNCING`, `RETRY_SCHEDULED`, `RECONCILE_REQUIRED`, `SYNCED`, `MANUAL_REVIEW`, `REJECTED`. Lease proposta 60 secondi rinnovabile; un lease scaduto permette claim, non una nuova creazione remota senza riconciliazione.

La finestra di replay garantito proposta è 90 giorni e deve essere esplicitata nella ricevuta/contratto. Rimuovere il payload per retention non deve eliminare subito il mapping minimo di una scrittura ancora incerta. Chiavi note ma scadute restituiscono stato terminale/scadenza (410 proposto), non vengono elaborate come nuove richieste; il client richiede riconciliazione o un nuovo invio consapevole. Una chiave mai vista non prova la data di creazione: nessuna promessa di idempotenza illimitata dopo la cancellazione del mapping. Durata delle tombstone minimizzate e gestione delle richieste irrisolte devono essere approvate insieme alla retention.

Policy proposta, da configurare: timeout 10 secondi per chiamata mantenuto; retry su rete/429/5xx con backoff e jitter, rispettando Retry-After. Fino a 5 tentativi complessivi con attese indicative 1, 5, 30, 120 minuti, poi MANUAL_REVIEW; nessun loop infinito. Timeout/5xx su create sono prima casi di riconciliazione. 400 di schema, 401/403 di credenziali/scope, 404 di ID configurati sono bloccanti fino a correzione. Non esporre body provider, token o PII nei log.

Note deduplicate: marker testuale opaco e mapping locale `request_id -> note_id` sotto lock. Se API/permessi non consentono una lettura affidabile delle note dopo un timeout, mantenere l'operazione sospesa per verifica manuale: non dichiarare exactly-once. Tag aggiuntivi, custom field e stage vengono riconciliati verso lo stato atteso senza sovrascrivere aggiornamenti successivi.

## 10. Flusso Architetto

SLA e timeout sotto sono proposte operative, non promesse pubbliche. `EA` indica owner opportunity Architetto; `CA` coordinatore da nominare. Tag minimi applicati una volta all'acquisizione, senza tag di transizione. Messaggi richiamano le righe della sezione 13, non copy definitivi.

| Passaggio / trigger | Condizione | Stage / dati | Tag | Messaggio | Owner | Timeout proposto / fallback | KPI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Form valido acquisito | Transazione richiesta completata | A01, request timestamp, qualificazione, evidenze consenso | Base + Architetto + pilot se coorte | A-M1 ricevuta | CA, poi EA | Assegnare entro 1 giorno lavorativo; coda manuale se identità incerta | Lead unici, completion |
| Invito presentazione | Identità instradabile; sessione reale disponibile | A02, next step prenotazione | Nessuno nuovo | A-M2 invito | EA | Entro 1 giorno lavorativo dalla disponibilità; se nessuna data, task senza link fittizio | Inviti, booking |
| Booking presentazione | Conferma del sistema prenotazioni o operatore, session ID valido | A03, data/ID sessione e booking | Nessuno | Conferma booking operativa | EA / host | Slot esaurito/cancellato: nuova scelta, non prenotazione forzata | Presentation booking |
| Timer reminder | Booking attivo, versione corrente, sessione futura | A03, delivery job deduplicato | Nessuno | A-M3 / A-M4 | Sistema autorizzato, supervisione EA | 24h / 1h prima; se già oltre soglia, saltare il reminder scaduto | Consegne, show-up |
| Presenza registrata | Check-in/report/manuale auditato | ATTENDED -> A04; NO_SHOW -> A02 se riprenotazione voluta; UNKNOWN -> revisione | Nessuno | A-M5 / A-M6 | Host e EA | Entro 1 giorno lavorativo; no-show non è rifiuto | Show-up, no-show |
| Qualificazione | Presentazione partecipata, dati sufficienti e valutazione umana | A04 -> A05 o A10; eligibility PENDING fino alla decisione appropriata | Nessuno | A-M7 se colloquio proposto | EA | Entro 2 giorni lavorativi; richiedere solo informazioni pertinenti mancanti | Qualification |
| Colloquio prenotato | Slot accettato e owner disponibile | A06, interview date/booking ID | Nessuno | A-M8 | Intervistatore assegnato | Se annullato, A05; no-show da riprogrammare, non NOT_ELIGIBLE | Interview booking |
| Colloquio svolto | Evidenza completamento e autore | A07, outcome e eligibility separati | Nessuno | Comunicazione esito personale da approvare | Intervistatore / responsabile | Esito entro 2 giorni lavorativi; review se disaccordo | Interview show-up, eligibility |
| Avvio concordato | ELIGIBLE e decisione di entrambe le parti documentata | A08, evento path_started e data | Nessuno | Istruzioni operative future, fuori matrice automatica minima | Responsabile percorso | Data concordata; se rinvio, next step con scadenza | Path start |
| Attivazione | Criteri di attivazione approvati e verificati | A09/WON, activated_at, autore | Nessuno | Onboarding futuro da progettare separatamente | Responsabile percorso | Nessun termine inventato; audit prima di WON | Activation |
| Rinuncia / non idoneità | Decisione esplicita o revisione documentata | A10, status e close reason | Nessuno | Solo comunicazione pertinente autorizzata | EA | Un follow-up consentito, poi revisione entro 14 giorni di mancato riscontro; non chiusura automatica universale | Motivi chiusura |

Un motore non decide idoneità/attivazione da profilo o risposta aperta. I responsabili devono definire criteri verificabili e appropriati al ruolo prima di abilitare quelle transizioni.

## 11. Flusso Evento

`EE` è owner registrazione, `EC` owner confronto, `CE` coordinatore evento. Frank è il volto dell'incontro, non automaticamente owner di ogni lead/appuntamento. Tag base + Evento + pilot solo all'acquisizione.

Gli stage della tabella descrivono il primo avanzamento della relazione E. Richieste/conferme di edizioni successive aggiornano la propria Participation e preservano lo stage già raggiunto. La classificazione della presenza aggiorna soltanto Participation; E04 richiede il comando owner esplicito di avvio follow-up, dopo l'evidenza.

| Passaggio / trigger | Condizione | Stage / dati | Tag | Messaggio | Owner | Timeout proposto / fallback | KPI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Form acquisito | Richiesta valida e durevole | E01; REQUESTED/PENDING_EDITION | Base + Evento + pilot se coorte | E-M1 ricevuta | CE, poi EE | Triage entro 1 giorno lavorativo; dati edizione mancanti mantengono semplice interesse | Lead, completion |
| Conferma | Tutti i gate sotto verificati | E02, CONFIRMED, confirmed_at, registration ID | Nessuno nuovo | E-M2 conferma | EE / sistema autorizzato | Nessuna conferma automatica con data o accesso indefiniti | Confirmation |
| Reminder | CONFIRMED, edizione e registrazione attive, recapito utilizzabile | E02, delivery state separato | Nessuno | E-M3 / E-M4 / E-M5 | Sistema / CE | 3 giorni, 24h, 1h prima; saltare quelli già scaduti | Delivery, show-up |
| Fine evento | Edizione effettivamente conclusa | E03, attendance UNKNOWN iniziale | Nessuno | Nessun follow-up di presenza prima dell'evidenza | Host / EE | Entro 1 giorno lavorativo; se report assente, task manuale | Copertura presenza |
| Presenza classificata | Evidenza da fonte approvata | E04, ATTENDED oppure NO_SHOW; cancellati separati | Nessuno | E-M6 / E-M7 | EE | Entro 1 giorno lavorativo dalla classificazione | Show-up, no-show |
| Interesse post-evento | Richiesta esplicita; non mera apertura/click | Collegare richiesta; E resta sul proprio flusso | Nessuno | E-M8 se richiesto/consentito | EE, poi EC | Riscontro entro 1 giorno lavorativo; niente pressione automatica | Consultation request |
| Appuntamento richiesto | Finalità e volontà documentate | Creare/riusare C01, legame a E | Nessuno | Invito a scelta slot | EC | Se già una C OPEN, riusarla senza doppio invito | Request, opportunity linkage |
| Booking confronto | Slot confermato e owner assegnato | C02, appointment ID/data/revisione | Nessuno | E-M9 conferma | EC | Cancellazione/riprogrammazione aggiorna lo stesso caso | Consultation booking |
| Appuntamento svolto | Evidenza appuntamento | C03; registrare outcome, poi C04 o C05 | Nessuno | Follow-up personale secondo esito | EC | Esito entro 2 giorni lavorativi; UNKNOWN non è svolto | Show-up, opportunity |
| Chiusura | Obiettivo E o C concluso, motivo e autore | E05 o C05 indipendenti | Nessuno | Nessuna sequenza implicita marketing | EE / EC | No-show: un tentativo pertinente, poi revisione; nuova edizione solo su volontà della persona | Esiti |

### Gate da “richiesta ricevuta” a “iscrizione confermata”

Devono esistere: (1) contatto risolto senza conflitti bloccanti; (2) edizione selezionata/accettata, attiva, con titolo snapshot, data/ora/fuso e modalità definiti; (3) condizioni di partecipazione approvate, compresa capienza esplicita oppure assenza di limite deliberata; (4) record di registrazione univoco contatto+edizione; (5) disponibilità/assegnazione di accesso confermata dal sistema operativo scelto, oppure procedura manuale auditata; (6) consenso/finalità e recapito utilizzabili verificati secondo policy; (7) commit durevole di `CONFIRMED` e del relativo evento, con accodamento deduplicato della comunicazione.

L'invio email non è una transazione con la registrazione: una mancata consegna lascia la registrazione confermata ma apre un problema di delivery e un task. Non riprenotare né conteggiare una seconda conferma per ritentare l'email. Se la modalità di accesso non esiste, non si passa a CONFIRMED e non si mostra un meeting link inventato. La thank-you attuale resta “richiesta di partecipazione ricevuta”; non è fonte di conferma.

Se l'edizione cambia data: aggiornamento versionato, notifica pertinente solo ai registrati coinvolti, invalidazione dei reminder precedenti. Se cancellata: stato CANCELLED, niente no-show; rimborso non pertinente finché non esiste un'offerta a pagamento autorizzata. Una nuova edizione richiede nuova chiave e nuova partecipazione.

## 12. Calendari

Nessun calendario viene creato qui. Durata 30–40 minuti della presentazione proviene dal contenuto approvato; altri tempi sono proposte da validare, non dati pubblicabili.

| Calendario logico | Accesso | Durata | Owner | Round robin | Buffer proposto | Reminder | No-show | Cancellazione / riprogrammazione |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Presentazione Architetto Patrimoniale | Link su invito; non menu pubblico; sessione di gruppo | 30–40 min indicativi | Host confermato + sostituto | No; assegnare sessione/host | 10 min tra sessioni, da approvare | Conferma, 24h, 1h | Fonte presenza/manuale, proposta nuova sessione | Cancellare booking e reminder; nuova sessione sullo stesso percorso, storico preservato |
| Colloquio Architetto Patrimoniale | Link riservato ai qualificati | 30 min proposti | Intervistatore competente | No all'inizio; solo dopo pool approvato | 10 min prima/dopo proposti | Conferma, 24h, 1h proposti | Un ricontatto, poi owner decide | Stessa opportunity, booking aggiornato/versionato; non inviare reminder del vecchio slot |
| Appuntamento Benessere Patrimoniale | Link su richiesta di confronto | 30 min proposti | Referente competente e disponibile | No all'inizio; eventuale distribuzione controllata | 10 min prima/dopo proposti | Conferma, 24h, 1h proposti | Riprogrammazione o chiusura motivata | Preservare owner se disponibile; sostituzione comunicata, storico e origine evento preservati |

L'evento online richiede anche una **edizione webinar** con orario/accesso/host: non è automaticamente un quarto calendario di appuntamenti. Scegliere la gestione di gruppo e l'eventuale integrazione solo dopo aver verificato strumenti già disponibili; non serve creare un calendario per ogni lead. Tutti i timestamp operativi in UTC con fuso IANA; gestire ora legale, non memorizzare soltanto un offset fisso.

## 13. Email / WhatsApp matrix

Questa è una matrice di intenti di messaggio, **non copy definitivo**. Email è il canale base proposto perché presente in entrambi i form. WhatsApp è opzionale e disattivato fino a verifica di numero, autorizzazione di canale, configurazione e template/policy applicabili; telefono obbligatorio non equivale a opt-in WhatsApp. “Entrambi” significa attivazione successiva consapevole, non duplicazione automatica di tutti i reminder.

Servizio richiesto e promozione restano finalità distinte. La classificazione e la base utilizzabile di ogni messaggio vanno verificate prima dell'attivazione; nessuna conclusione legale è dedotta dalla tabella. Ogni invio ricontrolla stato registrazione/booking, revoche, soppressioni e revisione corrente. Non azzerare un unsubscribe/DND per effetto del form.

| ID | Trigger | Canale proposto | Obiettivo | Destinatario | Timing | CTA funzionale | Dati necessari |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A-M1 | Richiesta Architetto acquisita | Email | Ricevuta, senza accettazione | Richiedente | Dopo commit ricevuta | Attendere prossimo passo / contatto | Request ID, nome, email, finalità |
| A-M2 | Presentazione disponibile/invito autorizzato | Email; WhatsApp eventuale alternativa | Scelta della sessione | Interessato instradato | Entro SLA owner | Prenota presentazione | Sessioni reali, owner, autorizzazione messaggio |
| A-M2b | Presentazione prenotata | Email | Conferma logistica della sessione | Prenotato | Dopo conferma booking | Accedi / modifica prenotazione | Session ID, booking, data/fuso, accesso reale |
| A-M3 | Booking attivo | Email; WhatsApp opzionale | Promemoria | Prenotato | T−24h | Accedi / riprogramma | Booking/sessione, fuso, revisione, accesso |
| A-M4 | Booking attivo | Email oppure WhatsApp autorizzato | Promemoria vicino alla sessione | Prenotato | T−1h | Accedi | Dati A-M3; non duplicare canali senza regola |
| A-M5 | ATTENDED verificato | Email | Passaggio alla qualificazione | Partecipante | Entro 1 giorno lavorativo | Completa informazioni / richiedi confronto | Presenza, richiesta, owner |
| A-M6 | NO_SHOW verificato | Email | Consentire riprenotazione | Assente confermato | Entro 1 giorno lavorativo | Scegli nuova sessione | Booking precedente, sessioni future; niente replay inventato |
| A-M7 | Qualificazione favorevole e invito deciso | Email; WhatsApp opzionale | Proporre colloquio | Persona qualificata | Dopo decisione | Scegli colloquio | Esito qualificazione, intervistatore, disponibilità |
| A-M8 | Colloquio confermato | Email; WhatsApp opzionale | Confermare dati logistici | Prenotato | Alla conferma | Accedi / modifica appuntamento | Booking, data/fuso, owner, accesso |
| E-M1 | Richiesta Evento acquisita | Email | Ricevuta di richiesta, non posto confermato | Richiedente | Dopo commit ricevuta | Attendere dettagli / contatto | Request ID, nome, titolo; edizione se nota |
| E-M2 | CONFIRMED persistito | Email; WhatsApp solo su scelta autorizzata | Confermare iscrizione reale | Registrato confermato | Dopo gate sezione 11 | Dati accesso / gestione partecipazione | Registration ID, edizione, data/fuso, accesso |
| E-M3 | Registrazione attiva | Email | Preparazione incontro | Confermato | T−3 giorni | Consulta dettagli | Edizione e booking correnti; saltare se iscrizione successiva |
| E-M4 | Registrazione attiva | Email; WhatsApp opzionale | Promemoria | Confermato | T−24h | Accedi / gestisci partecipazione | Come E-M2 |
| E-M5 | Registrazione attiva | Email oppure WhatsApp autorizzato | Promemoria prossimo all'evento | Confermato | T−1h | Accedi | Come E-M2; controllo cancellazioni immediato |
| E-M6 | ATTENDED verificato | Email | Seguito pertinente all'incontro | Partecipante | Entro 1 giorno lavorativo | Richiedi confronto, se pertinente e autorizzato | Presenza, owner, risorse realmente disponibili |
| E-M7 | NO_SHOW verificato | Email | Consentire nuova richiesta | Assente confermato | Entro 1 giorno lavorativo | Richiedi prossima edizione | Presenza, edizioni disponibili; nessun link a registrazione inesistente |
| E-M8 | Richiesta confronto / invito autorizzato | Email; WhatsApp opzionale | Passare alla scelta slot | Persona che lo ha richiesto; altri solo con presupposto verificato | Entro 1 giorno lavorativo | Prenota confronto | Intenzione C, owner, calendario reale |
| E-M9 | Appuntamento confermato | Email; WhatsApp opzionale | Conferma logistica | Prenotato | Alla conferma | Accedi / modifica | Booking ID, data/fuso, owner, finalità |

Reminder 24h/1h dei colloqui e confronti possono riusare il meccanismo logistico sopra, con chiavi proprie di booking. Non riutilizzare le finalità evento per campagne professionali o viceversa. Ogni delivery ha chiave `(business_event_id, message_kind, channel, recipient, appointment_revision)`; un retry della consegna non genera nuovo evento di conferma/iscrizione.

## 14. Owner / assignment

| Ruolo logico | Responsabilità | Persone candidate / decisione mancante |
| --- | --- | --- |
| ARCHITECT_COORDINATOR | Coda iniziale, sessioni e sostituzioni | Angelo, Gianni, Frank o altro: incarico da confermare |
| ARCHITECT_OWNER | Relazione sul singolo percorso | Pool e priorità da approvare |
| ARCHITECT_INTERVIEWER | Colloquio ed esito documentato | Competenze e disponibilità da confermare |
| ARCHITECT_ACTIVATION_APPROVER | Avvio e attivazione | Responsabile e criteri da approvare |
| EVENT_COORDINATOR | Edizioni, conferme e dati presenza | Referente commerciale/operativo da definire |
| EVENT_HOST | Conduzione incontro | Frank come volto dell'evento; sostituto da definire |
| PATRIMONIAL_CONSULTATION_OWNER | Confronto individuale | Consulenti/referenti ammessi da identificare, senza attribuire qualifiche non verificate |

Assegnare l'owner dell'opportunità all'acquisizione/risoluzione, entro lo SLA proposto. Prima mantenere una coda non assegnata presidiata dal coordinatore, con task e scadenza: non inventare un user ID per riempire un campo. Mantenere lo stesso owner fino all'appuntamento quando competente e disponibile. Un cambio richiede motivo, autore e notifica operativa.

Round robin inizialmente **no**: introdurlo solo con pool di utenti reali, disponibilità, competenze, massimo carico e sostituti approvati. Provincia può aiutare routing/fuso o relazione locale solo dopo mappa esplicita; nessuna deduzione di capacità economica o idoneità dalla provincia. Owner contatto esistente e owner opportunità possono differire; evitare riassegnazioni tra Radar e patrimoniale.

Assenza del referente: delega temporanea a sostituto abilitato, conservando titolare della relazione; fermare la prenotazione di slot non presidiati. Se nessun sostituto, mantenere coda e avvisare coordinatore con SLA, senza inviare link di appuntamento non disponibili.

## 15. KPI

Definizioni: `A` = contatto+programma+ciclo Architetto; `R` = contatto+edizione Evento; `C` = contatto+finalità+ciclo confronto. Contare identità risolte uniche, escludere test/spam/retry e riportare separatamente i conflitti in revisione. Mai contare note, tag, job o visite thank-you come lead.

Per Evento, R è una Participation e non una opportunity: il numero di E non misura iscrizioni o presenze per edizione. Le metriche per edizione leggono conferme ed evidenze dal registro partecipazioni, collegato alla stessa relazione E.

Ogni report dichiara periodo/coorte, data di maturazione, fuso Europe/Rome, filtri e attribution model. Numeratore e denominatore devono riferirsi alla stessa coorte; non dividere attivazioni storiche per lead del mese corrente. Tasso con denominatore zero = N/D. Appuntamenti cancellati in anticipo sono esclusi dalla base attesa; cancellazioni e sconosciuti sono riportati separatamente, non nascosti nei no-show. Riprenotazioni: tassi per persona/ciclo alla prima sessione dovuta, con recupero su sessioni successive riportato a parte.

Fonti future: `V` telemetria client autorizzata/sessioni landing, `J` registro richieste/eventi durevole, `B` booking/edizioni e presenze verificate, `O` opportunity e decisioni owner riconciliate, `S` costi effettivi per campagna forniti/collegati con autorizzazione. Oggi V/J/B/O strutturati patrimoniali non sono implementati e nessun costo è disponibile: questi KPI sono definizioni, non risultati misurati.

### Architetto

| KPI | Numeratore | Denominatore | Fonte / formula |
| --- | --- | --- | --- |
| Landing conversion rate | Sessioni landing con almeno una richiesta A valida acquisita | Sessioni landing eleggibili osservate nella stessa coorte | V+J; N/D senza join consentito; mostrare anche volume A unico separato |
| Form completion rate | Tentativi logici iniziati che arrivano ad acquisizione durevole | Tentativi logici con form_start | V+J; retry non è nuovo tentativo |
| Presentation booking rate | A con almeno una presentazione prenotata | A con invito effettivamente reso disponibile/inviato | J+B; escludere interesse in attesa di sessioni dal denominatore e mostrarlo separato |
| Presentation show-up rate | A con presenza verificata alla prima sessione dovuta | A prenotati attesi in sessioni concluse | B; UNKNOWN evidenziati, non classificati come presenti |
| Qualification rate | A valutati qualificati per colloquio | A partecipanti con qualificazione completata | J+O; riportare anche qualificati/tutti i partecipanti e backlog non valutato |
| Interview booking rate | A con colloquio prenotato | A qualificati invitati al colloquio | J+B+O |
| Interview show-up rate | A con colloquio svolto alla prima convocazione dovuta | A con colloquio atteso in slot concluso | B+O |
| Eligibility rate | A giudicati ELIGIBLE | A con decisione finale ELIGIBLE o NOT_ELIGIBLE | O+J; PENDING/WITHDRAWN separati |
| Path start rate | A con avvio effettivo registrato | A ELIGIBLE nella coorte maturata | J+O |
| Activation rate | A con attivazione verificata | A con percorso avviato nella coorte maturata | J+O; opzionale attivati/lead come metrica distinta |
| Cost per lead | Spesa attribuita alla campagna/coorte A | A unici validi acquisiti dalla medesima campagna | S+J; non numero di submit |
| Cost per qualified candidate | Stessa spesa della coorte | A qualificati per colloquio in quella coorte | S+J+O |
| Cost per activated consultant | Stessa spesa della coorte | A attivati in quella coorte | S+J+O; label pubblico: costo per Architetto Patrimoniale attivato |

### Evento

| KPI | Numeratore | Denominatore | Fonte / formula |
| --- | --- | --- | --- |
| Landing conversion rate | Sessioni con richiesta Evento valida acquisita | Sessioni landing Evento eleggibili | V+J; non chiamarlo tasso iscrizioni confermate |
| Registration confirmation rate | R passati a CONFIRMED una volta | R validi per la stessa edizione accettata | J+B; interessi generici senza edizione separati |
| Show-up rate | R con ATTENDED verificato | R confermati e attesi nell'edizione conclusa | B+J; UNKNOWN/cancellazioni dichiarati a parte |
| No-show rate | R con NO_SHOW verificato | Stessa base attesa del show-up | B+J; show-up + no-show non deve fare 100% se esistono UNKNOWN |
| Consultation request rate | R partecipanti che hanno chiesto confronto esplicito | R con ATTENDED | J+B; richieste da no-show sono una coorte distinta |
| Consultation booking rate | C con booking confermato | C con richiesta esplicita valida nella coorte | J+B+O; una sola C aperta può collegare più R |
| Consultation show-up rate | C con appuntamento svolto alla prima convocazione dovuta | C con appuntamento atteso in slot concluso | B+O |
| Opportunity rate | Contatti partecipanti con esito QUALIFIED_FOLLOW_UP verificato | Contatti partecipanti unici della coorte/edizione maturata | O+B+J; non il numero grezzo di E create, né un ricavo |
| Cost per registration | Spesa campagna/edizione | R confermati unici attribuiti | S+J+B; distinguere costo per richiesta |
| Cost per attendee | Stessa spesa coorte | R ATTENDED verificati attribuiti | S+B |
| Cost per appointment | Stessa spesa coorte | C prenotati unici attribuiti | S+B+J; costo per appuntamento svolto va etichettato separatamente |

C attribuita a più edizioni: un solo costo di acquisizione primario secondo richiesta che l'ha originata; edizioni successive assistono senza duplicare C/spesa. Vista per edizione può mostrare relazioni assistite, dichiarando che non sono additive. Spese in valuta, perimetro IVA e modello first-touch/costi assistiti devono essere definiti prima di confrontare CPL. Nessuna integrazione ads o analytics viene scelta o attivata qui.

## 16. Tracking eventi

### Envelope comune proposto

`event_id`, `event_name`, `schema_version`, `occurred_at` (UTC), `received_at`, `producer`, `funnel`, `source_path`, `request_id`, `intent_id`, `edition_id`, `appointment_id`, `entity_revision`, `causation_id`, `correlation_id`, `is_test`. ID e proprietà sono opzionali se non pertinenti; nessuna email, telefono, nome, risposta aperta, token, URL meeting o testo nota nel flusso analytics. Le chiavi interne non vengono esposte come identificatori pubblici della persona.

Eventi client sono osservazioni della UI; eventi server sono fatti di dominio. Collector/provider analytics da scegliere solo se necessario e autorizzato. Le registrazioni tecniche business non dipendono dalla raccolta di page view. Proprietà UTM sanificate possono accompagnare acquisizione/intenzione; non unire automaticamente visite anonime a dati personali senza regola approvata.

| Evento | Dove nasce | Client/server | Proprietà specifiche oltre envelope | Fonte di verità |
| --- | --- | --- | --- | --- |
| landing_view | Caricamento effettivo della landing | Client | sessione eleggibile, page path, policy telemetria | Osservazione browser; solo dopo gate di raccolta |
| hero_cta_click | CTA hero | Client | cta_id, position=hero, target simbolico | Click UI; non prenotazione |
| mid_cta_click | CTA intermedia/finale | Client | cta_id, position, target simbolico | Click UI; non richiesta commerciale acquisita |
| form_start | Prima interazione utile nel form | Client | form_mode, attempt_id | Una volta per tentativo; non focus automatico/hydration |
| form_submit_success | Commit di richiesta valida | Server | receipt_status, duplicate_replay=false, sync_status | J; una sola volta per request ID; 202 ricevuta non è conferma evento |
| form_submit_error | Rifiuto API o errore di trasporto | Server per errori API; client per rete | error_class, attempt_id, response_status, origin=api/transport | Due osservazioni correlabili, non sommare come due fallimenti; niente body provider |
| presentation_requested | Richiesta Architetto con finalità presentazione acquisita | Server | program_key, intent_id | J; una volta per nuova intenzione, non per ogni retry |
| presentation_booked | Booking presentazione confermato | Server da fonte booking/manuale | session_id, booking_revision, start_at | B riconciliato |
| presentation_attended | Presenza verificata | Server da evidenza/owner | session_id, attendance_source, recorded_by_role | B+audit; non apertura link |
| interview_requested | Decisione di proporre colloquio accettata nel flusso | Server da owner | qualification_revision, requested_at | O+J; non click calendario |
| interview_booked | Booking colloquio confermato | Server | appointment_id, revision, start_at | B |
| interview_completed | Colloquio effettivamente svolto | Server da evidenza/owner | appointment_id, completed_at | B+O |
| architect_path_started | Avvio effettivo confermato | Server da approvatore | program_key, started_at, decision_revision | J+O, decisione umana |
| architect_activated | Attivazione approvata | Server da approvatore | program_key, activated_at, criteria_version | J+O; non stage modificato senza evidenza |
| event_request_received | Nuova richiesta di partecipazione acquisita | Server | event_slug, edition_id o assente, registration_status | J; distinta dalla conferma e deduplicata per richiesta |
| event_registration_confirmed | Gate conferma superato e commit registrazione | Server | registration_id, edition_revision, confirmed_at | Registro partecipazioni / fonte operativa |
| event_attended | Presenza evento verificata | Server | registration_id, edition_id, evidence_source | B+audit |
| event_no_show | Assenza verificata dopo edizione | Server | registration_id, edition_id, classification_at | B+audit; solo confermati attesi |
| consultation_requested | Richiesta esplicita acquisita | Server | consultation_intent_id, origin_registration_id se presente | J; non semplice click “Parliamone” |
| consultation_booked | Booking confronto confermato | Server | appointment_id, revision, consultation_intent_id | B |
| consultation_completed | Confronto effettivamente svolto | Server da evidenza/owner | appointment_id, completed_at | B+O |

Per KPI e controllo servono anche eventi interni di invito, qualificazione completata, decisione idoneità, cancellazione/riprogrammazione, chiusura opportunity, aggiornamento consensi e delivery. Restano nel registro operativo; non occorre esportarli tutti a un provider analytics. Eventi correttivi indicano `supersedes_event_id` e non cancellano silenziosamente la storia; le proiezioni KPI usano l'ultima evidenza valida.

Webhook futuri devono essere autenticati con il meccanismo verificato del provider scelto, validati per location/risorsa, acquisiti durevolmente e deduplicati prima degli effetti. Un payload anonimo non può dichiarare presenza, consenso o appuntamento. Le thank-you restano pagine statiche senza conversioni, create lead, invii o aggiornamenti CRM al semplice GET.

## 17. Privacy / data retention

### Evidenze da salvare

| Elemento | Registro richiesto | Limite dell'attuale 2A |
| --- | --- | --- |
| Presa visione privacy / richiesta di ricontatto | Request ID, booleano/scelta, finalità, versione, riferimento alla copia dell'informativa/manifest contenuto, path, timestamp server | Attestazione in nota CRM; manca ledger strutturato |
| Marketing | Scelta esatta nel form, finalità, versione del testo, canale coperto, timestamp, provenienza, eventuale conferma/revoca e autore | Booleano e versione in nota; non una preferenza cross-funnel risolta |
| Contesto | Funnel, source path, edizione/programmazione, versione contratto e UI informativa | Path e modo presenti; edizione assente |
| Stato efficace | Decisione derivata dalle evidenze e dalle soppressioni, aggiornata su revoca | Nessun motore di consenso efficace nell'adapter patrimoniale |
| Prova temporale | received_at server immutabile e occurred_at della fonte per eventi successivi | Timestamp del tentativo; un retry genera una nuova nota/data |

Le due versioni pilota sono etichette tecniche esistenti, non certificazioni dei testi collegati. La versione privacy legacy resta separata. Un consenso marketing non si trasferisce automaticamente da Annunci a patrimoniale, o da email a WhatsApp: serve compatibilità verificata di titolare, finalità, testo, canale e prova. Il falso della checkbox facoltativa significa “nessun nuovo consenso in questa richiesta”, non revoca di un grant valido già documentato. Revoche/disiscrizioni esplicite prevalgono fino a una nuova acquisizione valida, senza cancellare la storia. Lo stato PENDING_VERIFICATION è usato se la policy approvata richiede conferma dell'indirizzo; non si presume una verifica già esistente.

Separare i messaggi necessari alla richiesta da promozione/nurturing. “Follow-up” non è di per sé una categoria legale. Validare in sede legale la presa visione/ricontatto, le finalità dei due funnel, i contenuti marketing, l'uso dei canali, i fornitori, il trattamento di risposte aperte e la valutazione dei candidati. Non chiedere patrimonio dettagliato, documenti o dati sensibili nel form introduttivo. Nessun testo legale nuovo e nessuna attestazione di compliance in questo contratto.

### Retention proposta da approvare

| Classe | Regola tecnica proposta | Decisione necessaria |
| --- | --- | --- |
| Richieste incomplete/non valide | Non conservarne il corpo nei log; metadati tecnici minimizzati, fino a 30 giorni proposti | Durata e accessi con titolare/referente legale |
| Ledger operazioni/idempotenza | Finestra tecnica proposta 90 giorni per replay, poi minimizzazione; mapping business finché necessario al percorso | Coordinare cancellazione di payload, note e chiavi senza riaprire retry vecchi |
| Lead inattivi non convertiti | Revisione a 6 mesi proposta, cancellazione/anonimizzazione secondo policy approvata | Nessun termine legale dato per acquisito |
| Partecipazioni/qualificazioni | Solo per durata utile e finalità documentate; accesso per ruolo | Periodi distinti tra recruiting, evento e relazione cliente |
| Consensi/revoche e soppressioni | Prova minima e minimizzata per periodo giustificato; soppressione separata per evitare nuovi invii involontari | Base, durata, accessi e gestione dei diritti da approvare |
| Analytics/costi aggregati | Preferire aggregazione senza risposte aperte o contatti in chiaro | Durata e policy telemetria da approvare |

Cancellazione coordina store, CRM, note, outbox, messaggi e backup secondo policy. Bloccare prima i job ancora pendenti; non riaccodare una persona cancellata da un vecchio webhook. Eventuali tombstone HMAC minimizzate sono una scelta da validare, non conservazione illimitata automatica. Non introdurre un archivio immutabile incompatibile con rettifica/cancellazione: append-only è una regola di audit operativo entro la retention approvata.

## 18. Decisioni ancora mancanti

1. Approvare le tre pipeline e il significato operativo di WON/LOST/ABANDONED, separato dai ricavi.
2. Nominare coordinatori, owner, pool, intervistatori, approvatore attivazione e sostituti; nessun user ID è noto.
3. Definire criteri di qualificazione, idoneità e attivazione, con responsabilità umana e motivazioni appropriate al ruolo.
4. Definire programma/cicli Architetto e sessioni di presentazione effettive.
5. Definire slug evento stabile, prima edizione reale, data/ora/fuso, formato, host, accesso, eventuale capienza e politica di conferma/cancellazione.
6. Confermare durata/buffer di colloqui e confronti, SLA, orari di lavoro e numero massimo di ricontatti.
7. Verificare il sub-account: duplicati esistenti, matching email/telefono, oggetti/tipi campo, API e scope disponibili, lookup note/opportunity, funzionalità booking e webhook.
8. Approvare lo store durevole, i vincoli unici, il worker e l'eventuale migration. Senza questo, niente garanzia robusta di retry e niente automazioni basate su acquisizioni incerte.
9. Validare le finalità, i testi/versioni già esistenti, marketing per canale, conferma indirizzo se necessaria, retention e gestione dei diritti.
10. Scegliere chi invia ciascun messaggio: applicazione o workflow CRM, mai entrambi sullo stesso evento. Approvare mittenti, template, orari e regole di soppressione prima di abilitare invii.
11. Decidere policy telemetria, attributi di coorte, fonti costo e modello di attribuzione. Nessun provider analytics richiesto per definire il contratto.
12. Decidere il trattamento del tag `pilot` e se migrare interessi legacy su revisione manuale; nessuna conversione massiva automatica.

Queste decisioni bloccano le specifiche attivazioni remote coinvolte, non la validità del disegno locale. Nessuna assenza viene riempita con un ID, una data evento o un responsabile inventato.

## 19. Rischi

| Rischio | Mitigazione richiesta |
| --- | --- |
| Duplicati o fusione di persone diverse tramite telefono | Risoluzione con conflitti, lock e revisione; test impostazioni reali prima del cutover |
| Doppie note/opportunità dopo timeout | Ledger, remote ID salvati, riconciliazione delle create incerte; nessun append cieco |
| Conferma evento senza edizione/accesso | Gate espliciti della sezione 11; richiesta e iscrizione separate |
| Perdita di intenzioni tra funnel o edizioni | Chiavi business distinte e relazioni molteplici, non singolo stage sul contatto |
| Invii duplicati o a persone disiscritte | Outbox con un solo responsabile di delivery, chiavi di messaggio e ricontrollo consensi/stato |
| Workflow da tag che non scatta sul reingresso | Eventi business deduplicati al posto di tag persistenti come trigger |
| Owner o stage riportati indietro da vecchi job | Revisione attesa, precedenza umana, eventi fuori ordine riconciliati |
| KPI gonfiati da retry, test o thank-you | Identità/coorti definite, eventi autorevoli server e flag test |
| Falsa interpretazione di WON come fatturato | Pipeline operative separate e valore economico non valorizzato senza transazione reale |
| Consenso falso sovrascrive grant precedente o viceversa | Evidenze per richiesta/finalità/canale e proiezione efficace esplicita |
| Dati sensibili liberi in note/log/analytics | Minimizzazione, accessi per ruolo, log sanificati e retention approvata |
| Disponibilità API/account non confermata | Gate documentale e test controllati autorizzati in 2B.2, nessuna assunzione di funzionalità |
| Modifica accidentale del legacy/Radar | Adapter patrimoniale dedicato, flag pilota e regressioni; non cambiare il wrapper Radar o le sue regole di risposta |
| Richieste valide già ricevute in 2A prive di ledger | Riconciliazione inventariata manualmente; non considerare un vecchio timestamp/nota come ID idempotente affidabile |

## 20. Cosa implementare nella FASE 2B.2

Ordine proposto; ogni attivazione richiede autorizzazione distinta dallo studio 2B.1:

1. Chiudere decisioni e inventario remoto in lettura autorizzata; documentare mapping reale location/utenti/campi/stage senza credenziali nel repository.
2. Implementare contratto v2, ID richiesta, ricevuta/status protetti e validazione, mantenendo legacy e 2A esplicitamente separati durante la transizione.
3. Implementare store durevole, vincoli, evidenze consenso, outbox e worker dietro flag disattivato, solo dopo scelta/autorizzazione infrastrutturale.
4. Implementare adapter patrimoniale di lookup, risoluzione identità, contatti, campi, tag additivi, note deduplicate, opportunity e transizioni; conservare il trasporto Radar senza cambiarne il comportamento.
5. Eseguire test totalmente simulati di collisioni, doppio invio, crash tra effetti, lease scaduta, risposte incerte, errori parziali, ordine webhook e revoche.
6. Configurare le risorse CRM approvate in ambiente controllato; valorizzare mapping con ID effettivamente restituiti, verificare permessi e assenza di workflow preesistenti in conflitto.
7. Collegare edizioni, sessioni e booking reali, quindi webhook autenticati e registrazione presenze. Solo dopo abilitare la transizione CONFIRMED.
8. Approvare matrice/copy/mittenti e attivare un solo meccanismo di messaggistica per evento; prima email, WhatsApp solo con i suoi gate specifici. Non è autorizzato alcun invio ora.
9. Implementare eventi/KPI operativi e, solo se deciso, telemetria client. Conservare thank-you prive di effetti al caricamento.
10. Collaudare compatibilità `/contatti`, contenuti pubblici invariati, noindex/sitemap e responsive; concordare rollback con flag di scrittura/invio separati. Rilasci/push/deploy richiedono istruzione successiva.

Rollback: bloccare nuovi invii e nuove creazioni tramite flag; mantenere riconciliazione in lettura e coda dei casi incerti. Non cancellare opportunità, richieste o consensi per “ripulire” un test; distinguere dati di test e politiche di cancellazione approvate. Rollback non significa rispedire in massa gli eventi.

## 21. File locali previsti da creare/modificare

Sono **proposte 2B.2, non file creati in 2B.1**. Percorsi relativi alla root canonica; elenco da confermare dopo decisione sullo store e sulle API disponibili. Non creare file solo per rispettare la lista.

| Azione futura | Percorso | Scopo |
| --- | --- | --- |
| Modificare | `src/components/patrimonial-lead-form.tsx` | Request ID, snapshot retry, gestione ricevuta/status pilota; legacy intatto |
| Modificare | `src/lib/public-leads/handler.ts` | Dispatch contratti, acquisizione durevole pilota e risposta distinta da conferma |
| Modificare | `src/lib/public-leads/patrimonial-funnels.ts` | Validazione v2 e mapping concordato, snapshot consensi/edizione |
| Modificare | `src/content/patrimonial-funnels.ts` | Riferimenti logici a programma/edizione e messaggi UI approvati, senza ID sensibili client |
| Creare | `src/lib/public-leads/patrimonial-contract.ts` | Tipi dominio, enum, chiavi business, schema eventi |
| Creare | `src/lib/public-leads/patrimonial-store.ts` | Interfaccia e implementazione scelta per ledger/outbox, vincoli e lease |
| Creare | `src/lib/public-leads/patrimonial-sync.ts` | Worker, retry, riconciliazione e avanzamento effetti |
| Creare | `src/lib/public-leads/patrimonial-highlevel.ts` | Adapter CRM patrimoniale e mapping server-side; riuso del trasporto esistente quando sufficiente |
| Creare | `src/lib/public-leads/patrimonial-routing.ts` | Owner, next step e regole di transizione versionate |
| Creare | `src/lib/public-leads/patrimonial-events.ts` | Eventi business e proiezioni KPI, senza provider analytics imposto |
| Creare | `src/lib/public-leads/patrimonial-consents.ts` | Evidenze e risoluzione per finalità/canale, soppressioni |
| Creare, se status necessario | `src/app/api/public-leads/status/route.ts` | Stato minimo autenticato/protetto della propria ricevuta |
| Creare, dopo scelta booking | `src/app/api/patrimonial/booking-webhook/route.ts` | Ingresso autenticato e deduplicato degli eventi appuntamento/presenza |
| Creare, dopo approvazione scheduler | `src/app/api/internal/patrimonial/sync/route.ts` | Esecuzione worker protetta, mai pubblica senza autorizzazione |
| Creare, dopo approvazione invii | `src/lib/public-leads/patrimonial-messages.ts` | Outbox delivery, template ID reali, cancellazione reminder |
| Modificare / creare | `scripts/verify-patrimonial-funnels.mjs`, `scripts/verify-patrimonial-crm.mjs` | Regressioni legacy, idempotenza, CRM, consensi e casi incerti con provider finto |
| Modificare se necessario | `package.json`, `.env.example` | Comandi e soli nomi delle nuove variabili server/flag, nessun secret |
| Da definire dopo approvazione | Migration nel sistema di persistenza scelto | Solo vincoli/schema effettivamente necessari; nessuna migration creata qui |
| Modificare | `docs/patrimonial/patrimonial-highlevel-contract-v1.md` | Mapping verificato, decisioni e limiti aggiornati |

Non sono previste modifiche a `WellbeingPage`, alla pagina pubblica `/benessere-patrimoniale`, a `src/app/contatti/page.tsx`, ai registri pubblici o a `robots.ts`. Il file `src/lib/radar/highlevel.ts` resta preferibilmente intatto: il suo trasporto POST non basta per lookup/update futuri, da aggiungere nell'adapter patrimoniale senza alterare il Radar. Le thank-you non necessitano di codice di conversione.

## 22. Configurazioni HighLevel future, manuali o via API

Nessuna delle seguenti attività è stata eseguita. Manuale e API sono modalità alternative da scegliere, non autorizzazioni implicite.

| Configurazione | Modalità proposta | Prerequisito / evidenza da registrare |
| --- | --- | --- |
| Inventario sub-account e deduplica esistente | Lettura UI/API autorizzata | Location reale, collisioni, regole matching, scope; non esportare PII inutilmente |
| Tre pipeline e relativi stage | Manuale o API supportata | Approvazione sezioni 2–3; acquisire ID reali e mapping versione, evitando creazioni duplicate al rerun |
| Custom field minimi contact/opportunity | Manuale o API supportata | Verifica oggetto/tipo/opzioni effettivi; lookup per chiave prima di creare, confronto differenze senza sovrascrittura cieca |
| Tag identificativi | Manuale o aggiunta consentita dall'adapter | Preservare legacy/Radar e policy coorte pilot; nessun trigger di iscrizione dedotto dal tag |
| Utenti/owner e code di fallback | Manuale con mappatura server | Incarichi, utenti attivi, disponibilità, ruoli e sostituti approvati |
| Tre calendari logici | Manuale, API solo se disponibile e autorizzata | Accesso, durata, fuso, buffer, disponibilità e gestione di gruppo verificati |
| Edizioni webinar e accessi | Strumento operativo scelto, eventuale CRM | Data reale, host, modalità, identificativi e registrazioni verificabili; nessuna prenotazione fittizia |
| Workflow Architetto | Bozza disattivata, poi test autorizzato | Eventi/chiavi, condizioni, owner, canali, timeout e stop definiti in sezioni 9–14 |
| Workflow Evento e confronto | Bozza disattivata, poi test autorizzato | Separare richiesta/conferma/presenza/appuntamento; non iscrivere automaticamente tutti a nurturing |
| Invio messaggi | Un solo esecutore scelto per messaggio | Mittenti, template, consensi/canali, soppressioni, test address/number approvati e kill switch |
| Webhook | Configurazione solo dopo endpoint verificato | Autenticazione supportata, risorse/location corrette, idempotenza e prove di ordine/cancellazione |
| Dashboard e report | Manuale o proiezioni applicative | Formule sezione 15, coorti, UNKNOWN, costi reali e separazione WON operativo/ricavo |

Le API lette nel codice provano esclusivamente l'esistenza del trasporto contatti/tag/note; non provano permessi o supporto di tutte queste configurazioni. In 2B.2 gli ID devono provenire dall'inventario/creazione autorizzati e rimanere nella configurazione server appropriata. Nessun ID, calendario, workflow o piano remoto viene inventato in questo documento.

### Verifica e consegna di questa fase

Creato soltanto questo documento. Nessuna modifica applicativa, nessun test che chiami CRM, nessuna migration, nessun invio email/WhatsApp, nessuna pipeline/custom field/workflow/calendario remoto creato. `tmp/` non letta come fonte e non modificata. Eventuale commit locale limitato a questo file; nessun push, deploy o modifica di `main`.
