# Assignment data readiness — P1 v1

Data: 18 ottobre 2026. Baseline effettiva: `88fafcba8811e4a02b3575e2e2cd36368b818be8`, branch `feat/patrimonial-pilot-funnels`, verificata contro il remoto e acquisita con fast-forward da `90af143760e9f0c87180a2db6d3ca9ebe2d8ca1c`.

**P1 locale implementata con la separazione approvata fra owner remoto e responsabile interno.** Questo documento non prova che lo store v2 o i flag siano attivi in preview/produzione. Nessuna introspezione di dati, credenziali o configurazioni remote; nessuna migration remota applicata.

## Readiness dei segnali

«Strutturato» significa un campo separato validato dal contratto server. Non significa identità verificata, dichiarazione certificata o autorizzazione per finalità ulteriori. UTM e risposte pubbliche sono dichiarazioni del browser. In particolare, non usare il profilo o la provincia per dedurre disponibilità economica, idoneità o competenza.

| SIGNAL | CURRENT SOURCE | STRUCTURED? | SAFE FOR ASSIGNMENT? | GAP | RECOMMENDED NEXT STEP |
| --- | --- | --- | --- | --- | --- |
| Funnel | `PilotLead.mode`, `PatrimonialV2Lead.mode`, intent `funnel`/`pipeline` | Sì, enum server | Sì come dimensione descrittiva | Il ledger provvisorio e la pratica OPPORTUNITY sono aggregati distinti | Assegnare inizialmente solo pratiche risolte OPEN; non confondere i due UUID |
| Source path | `sourcePath`, `pilotForms[mode].path`, `firstRequest.sourcePath` | Sì, validato | Sì | Non è la campagna | Usare il percorso validato, non URL/query completi |
| Source operativo | `PatrimonialRequestContext.source` | Sì, enum `website-pilot` / `legacy-information` / `manual-request` | Sì | Presente nella pratica risolta, non enum aggiunto al form pubblico | Conservare il significato distinto da `utm_source` |
| Source/medium/campaign UTM | `payload.utm` nel ledger v2; `firstRequest.utm` nella pratica; note 2A | Sì, chiavi allowlist e testi limitati a 100 caratteri | Solo come classificazione dichiarata e minimizzata | I valori restano testo libero; possono contenere PII o campagne non canoniche. La sola nota 2A non è fonte strutturata | Dizionario server di campagne/codici approvati; snapshot di categorie, non copia indiscriminata del testo |
| Profile API Evento | `eventProfileValue` → `profile`: Privato / Imprenditore / Professionista / Altro | Sì, enum validato | Sì a questa granularità | Lavoratore dipendente e Pensionato diventano entrambi Privato; Genitore diventa Altro | Usare soltanto il valore server esistente finché non c'è un nuovo contract |
| Profile preciso Evento | Chip UI; `eventNotes` → `message`: «Chi sei: …» | No come campo server distinto | No | La nota non distingue formalmente schema, versione e provenienza del segnale | Proposta v3: `qualification.audienceProfile` enum |
| Scene / livello di maturità Evento | `scene` React e `eventScenes.level` 1–4; testo «Profilo: …» dentro `eventNotes` | No nel contratto backend | No | Il livello esiste strutturato solo nel client, poi viene serializzato in prosa | Proposta v3: `qualification.awarenessLevel` e chiave scena allowlist; nessun parser delle note |
| Conoscenza strumenti Evento | Stato React `known`, `eventKnowledgeLevels`, `eventInstruments`; testo «Strumenti: …» | No nel contratto backend | No | Nome strumento e livello sono concatenati dentro `message` | Proposta v3: array di ID strumento e livello enum, con limiti e versione |
| Richiesta confronto Evento | Checkbox `architectCall`, stato locale; frase «Confronto 40 minuti …: sì» nel messaggio | No nel contratto backend | No | Il form condiviso non invia `architectCall` come proprietà del payload. Assenza della frase non equivale a false certificato | Proposta v3: boolean nullable `qualification.consultationRequested`; UNKNOWN per il pregresso, non parsing |
| Importo / orizzonte del calcolatore | Stato React `amount` / `years` | No, non inviati separatamente | No | Interazione illustrativa, non dato patrimoniale verificato | Non acquisire per assignment in questa fase; non inferire patrimonio o capacità economica |
| Profilo Architetto | `profile` nel form e nel payload; `architect.profile` nella pratica | Sì, enum | Sì come dichiarazione | Profilo UI non verifica esperienza o idoneità | Conservare valore originale validato e provenienza |
| Esperienza / obiettivo / disponibilità Architetto | `experience`, `goal`, `availability`; `architect.salesExperience` / `goal` / `availability` | Sì, enum opzionali | Sì se pertinenti e non vuoti | Non sono score e non certificano la qualificazione | Dimensioni opzionali, senza inventare valori mancanti o ranking |
| Risposta libera / note CRM | `message`, `architect.openAnswer`, `pilotCrmDetails`, worker `ADD_NOTE` | Stringa, non qualificazione strutturata | No | Contiene prosa e potenzialmente PII | Nessuna copia nello snapshot; nessun parser per decisioni critiche |
| Identità e recapiti | `firstName`, `lastName`, `email`, `phone`, `province` nel ledger; riferimenti CRM | Sì, con validazione sintattica | Non come dimensioni di bilanciamento | Una corrispondenza email non prova identità; esiste un gate di risoluzione separato | Solo riferimenti a intent/request nello snapshot; non duplicare PII |
| Consensi | `consent`, `marketingConsent`, `patrimonial_consent_evidence` | Sì, con finalità separate | Gate di finalità, non score | Privacy/ricontatto non abilita marketing, booking o messaggistica | Conservare le evidenze esistenti; nessun riuso implicito |
| Edizione / presenza | Edizioni e participations separate dalla relazione Evento | Sì nel dominio v2 | Sì solo con evidenza e stato pertinente | Il form corrente non imposta un'edizione reale; la sessione visuale non è inventario CRM | Non usare countdown/posti demo; non creare retroattivamente presenze o conferme |
| Richiesta confronto C | `CONSULTATION_REQUESTED`, `explicitRequest`, evidence del dominio risolto | Sì quando esiste realmente quella transizione | Sì come fatto, riferito al ciclo corretto | La checkbox in una nota non crea questo fatto | Nessuna conversione automatica della nota in pratica/appuntamento |
| Owner remoto | SQL `owner_ref` ↔ record `ownerId` ↔ `assignedTo` nel sync legacy | Sì, riferimento provider | Non come identità interna | Binding/permessi/user-location/reconciliation reali non verificati | P1 lo preserva in assign/reassign/release; P2 futura separata |
| Responsabile interno | SQL `current_operator_id` FK operators, `operator_revision` CAS | Sì, UUID interno separato | Sì per storico/capacity/esperimenti | Operatore può non avere utente CRM | `remote_user_ref` nullable; LOCAL_ASSIGNED / REMOTE_OWNER_UNMAPPED valido; mai UUID locale al provider |

## Contract pubblico

`patrimonial-lead-v2` ha un'allowlist esplicita in `validatePilotLead`, riutilizzata da `validatePatrimonialV2`, e un payload canonico con ordine fisso in `canonicalPatrimonialPayload`. Aggiungere proprietà arbitrariamente le farebbe rifiutare; ignorarle nella canonicalizzazione renderebbe ambigua l'idempotenza. Non è stata apportata alcuna modifica a questi contratti.

La proposta minima è un discriminante futuro `patrimonial-lead-v3`, con `qualification.schemaVersion`, `audienceProfile`, `awarenessLevel`, `instruments[{instrumentId,knowledgeLevel}]` e `consultationRequested`. Serviranno validazione server con enum e limiti, canonicalizzazione completa, fixture hash/replay, ricevute compatibili esplicite e proiezione CRM separata. Le risposte mancanti rimangono null/UNKNOWN; il pregresso v2 non viene reinterpretato.

Nessun dato deve essere ricostruito dal messaggio: anche se oggi il client genera un testo regolare, la prosa può cambiare, essere troncata a 1400 caratteri o contenere domande libere. `firstRequest` è uno snapshot dell'origine: non sovrascriverlo con un invio successivo per riempire attributi mancanti.

## Snapshot P1 implementato

`patrimonial_lead_snapshots` registra intent/request reference, funnel, profile API, source/medium/campaign strutturati dell'origine e schema_version 1. Il request lookup usa firstRequest.requestId, requestIds e funnel coerente: request.intent_id può riferirsi all'aggregato PROVISIONAL distinto dalla OPPORTUNITY. Nessuna duplicazione diretta di nome/cognome/email/telefono/indirizzo/message. Attributes è vuoto; maturity_level e consultation_requested sono NULL, anche se la prosa sembra dichiararli. Nessun parsing message.

Snapshot immutabile per ogni assignment, captured_at server. ROUND_ROBIN e BALANCED_BATCH funzionano senza segnali opzionali. L'algoritmo ignora NULL/stringhe vuote, non li interpreta come false o livello minimo. Source operativo è fallback quando manca utm_source; UTM sono consentite dal requisito P1 ma rimangono testo dichiarato dal browser e possono contenere informazioni improprie. Occorre una futura tassonomia/codifica server prima di considerarli dati analitici curati, senza backfill da note.

Il test A–T esercita schema/store PostgreSQL locale effimero, snapshot senza PII, assenza di parsing e invarianti identità. Non dimostra disponibilità dei dati in un account remoto. Nessun performance score, dashboard o attribuzione di conversione implementato. La specifica futura è [patrimonial-lead-v3-qualification-proposal.md](./patrimonial-lead-v3-qualification-proposal.md), solo documentale.

La disponibilità del contract nel codice non dimostra che tutti gli invii correnti producano un ledger: il form seleziona v2 soltanto con `contractVersion` esplicito, mentre il percorso 2A continua a scrivere note tramite il suo handler. Non è autorizzato il backfill da note CRM o l'attivazione di v2.
