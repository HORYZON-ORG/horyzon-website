# Radar Patrimoniale V1 — Contratti di accesso Advisor, Fase 4D.2B

19 ottobre 2026. Versione proposta: **RP-ACCESS-4D2B-DRAFT-1**.

Questo documento definisce sei contratti e componenti locali di verifica. **La proposta non è approvata per uso operativo e non attiva autorizzazioni.** Le fonti reali, il workflow di approvazione e la topologia Auth/DB restano da confermare. Nessun mapping reale, grant, migration o accesso a dossier reali creato. Un risultato locale CANDIDATE_ONLY non è un'autorizzazione.

## 1. Stato iniziale e fonti verificate

Worktree: `C:\Users\emanu\.codex\worktrees\radar-patrimoniale-v1\horyzon-website`, branch `feat/radar-patrimoniale-v1`, HEAD atteso/effettivo `b70edc22ddcbce2ed460543c9a33d0843edbdfd7`, working tree inizialmente pulito. Originale: `C:\Users\emanu\Desktop\horyzon\horyzon-website`, branch `feat/patrimonial-pilot-funnels`, HEAD `b242752102542e5280bba8b6ba0c4aecf9fcd722`, soli non tracciati audit Fase 1 e `tmp/`. Nessun processo Git concorrente rilevato.

HEAD verificati sul server con `git ls-remote`, uguali ai tracking locali:

- main: `9146f6372b19fdac6db1770d05f6b0ca10c1f1e5`;
- funnel: `8fd4feb229871b135f11f614247fd8df444df76e`.

Il remoto funnel è ancora quello della 4D.2A, verificato senza presumerlo. Nessun fetch necessario, merge o cherry-pick. Letti AGENTS, DESIGN, report 4D.1/4D.2A, AdvisorAccessPorts/P1AdvisorReadModel, P1, P2B/readiness/P2D, capability, Website staff Auth e strutture Radar 4C.1. La versione Next installata e la guida locale Auth distinguono controllo della route e controllo autorevole sui dati.

P1 è un registro operatori/assegnazioni già consolidato sul ramo funnel. Nessuna struttura Hub–operatore o permesso RADAR_ADVISOR_READ è emersa nei contratti esaminati. Il Website staff Auth verifica l'utente Supabase e superadmin per il Radar d'Impresa: non verifica un diritto Advisor sul contatto. Non si presume di avere letto il repository o lo schema effettivo di Hub, non disponibile qui.

La capability `patrimonial-runtime-capabilities-v1`, base `patrimonial-v2-store-1`, assignment `p1-v1`, owner `p2b-v1` certifica prerequisiti strutturali del chiamante server, non un diritto staff. Il P2D remoto è evidenza documentale pregressa; non ripetuto. L'attuale `integration_links` Radar ammette soltanto UNRESOLVED e l'audit 4C.1 non contempla letture staff: entrambi rimangono invariati.

## 2. I sei contratti

### C1 — Identità Hub Auth e operatore P1

Entità proposte: `staff_operator_bindings`, con UUID binding, issuerKey fidato, UUID Auth user, UUID operatore P1, stato ACTIVE/CONFLICT/REVOKED, revisione monotona, riferimento immutabile all'evidenza originaria, attore e tempo dell'ultimo cambiamento. L'issuer è una configurazione server verificata; non un valore scelto dal browser. FK operatore verso **il registro P1 esistente**, senza duplicarne nome, ruolo, capacity o remote_user_ref. FK Auth soltanto dopo prova di identità del database/issuer e compatibilità dello schema.

Un solo binding non revocato per issuer/user e per operatore. CONFLICT sospende e riserva il soggetto: non consente che una seconda riga aggiri l'ambiguità. Identificativi e prova originaria immutabili; cambi di identità richiedono revoca e nuovo binding con nuova evidenza. Lo storico non viene cancellato. Nessuna uguaglianza nome/email, remote_user_ref o owner CRM crea il legame.

La creazione richiede un workflow di gestione identità **ancora da approvare**: verificatore autorizzato, controllo dell'identità staff e del riferimento al registro P1, evidenza registrata, controllo unicità nel DB, CAS e audit atomico. Non si attribuisce tale facoltà al ruolo superadmin per default. I campi actor/evidence dei modelli locali non sono una prova che l'attore abbia il potere di approvare.

### C2 — Concessione RADAR_ADVISOR_READ

Entità proposta `advisor_permissions`: UUID concessione, FK binding staff, valore esatto RADAR_ADVISOR_READ, Location esplicita, scadenza eventuale, stato, revisione, evidenza originaria e attore/tempo. La finalità è la consultazione patrimoniale pertinente; nessuna Location wildcard, diritto commerciale o permesso di scrittura derivato. Una sola concessione non revocata per binding/Location/permesso.

Concessione/revoca esplicite con evidenza e audit. Permesso revocato, scaduto, sospeso o legato a un vecchio binding non abilita lettura. La revoca del binding nega accesso anche se la riga grant rimane a fini storici. Una nuova concessione usa un nuovo UUID, per rilevare il caso revoca–riconcessione durante una richiesta anche a revisione numerica apparentemente uguale.

Il grant è necessario ma non sufficiente: occorrono C3, C4, C5 e C6. Nessuna autorizzazione da ruolo generico, supervisor implicito, user_metadata o owner provider. Autorità competente a concedere/revocare, durata e processo di approvazione restano decisioni da adottare, non nuovi grant inventati nel codice.

### C3 — Persona Radar, Location e contatto HighLevel

Entità proposta `person_contact_bindings`: UUID binding, FK persona Radar, Location e Contact ID distinti, stato/revisione, metodo OPERATOR_APPROVED_EVIDENCE, evidenza originaria, riferimento all'evidenza di riconoscimento della persona, attore/tempo. Proposta iniziale conservativa: una sola coppia non revocata per persona e una sola persona per Location/Contact ID. Identità condivise, fusioni e più contatti della stessa persona richiedono risoluzione esplicita prima di derogare a questa cardinalità.

Processo proposto, **non implementato né approvato per dati reali**:

1. Aprire una pratica di collegamento contestualizzata a persona, contatto e Location, con stato non autorizzante; un riferimento UNRESOLVED può essere un indizio, mai la prova.
2. Verificare separatamente la persona e il contesto CRM tramite un operatore con facoltà esplicitamente approvata. OTP attesta la casella, non la titolarità di tutto il contatto CRM. Nome/email, note, telefono o owner non sostituiscono la verifica.
3. Registrare evidenza minima della verifica e del riconoscimento della persona per questa associazione/finalità. Modalità, contenuto, accesso e conservazione dell'evidenza devono essere approvati. Nel binding restano riferimenti tecnici, non copie di documenti, email o risposte economiche.
4. Ricontrollare unicità in entrambe le direzioni, revoche, identità esatte e autorizzazione dell'approvatore; creare il binding nuovo con audit nello stesso commit. Non aggiornare automaticamente integration_links a VERIFIED e non fondere contatti.
5. Duplicati o discordanza → CONFLICT e accesso negato; revoca → REVOKED, incremento revisione, audit. Sostituzione richiede nuova evidenza e nuovo UUID. Contact merge/deletion richiede sospensione/riconciliazione esplicita, senza trasferire accesso al nuovo ID per sola email.

Un invito contestualizzato rimane alternativa futura: servono destinatario e contesto verificati, nonce monouso scadente legato al server, protezione da forwarding/replay, conferma e audit. **Nessun invito, token, link di accesso o invio email aggiunto qui.** Non viene proposto un flusso apparentemente completo senza il contratto di verifica.

### C4 — Relazione che autorizza il dossier

Policy iniziale **proposta**: una relazione Evento o Consulenza OPEN, verificata e pertinente, con operatore P1 attivo/corrente, può essere candidata a consentire la consultazione del dossier espressamente incluso nel suo scope. Reclutamento ARCHITECT_PATH, owner del contatto, assignedTo opportunità e follower non autorizzano.

Entità proposta `purpose_episode_scopes`: evidenza di finalità e pertinenza legata a persona/binding, intent, ciclo corrente, revisione, eventuale partecipazione e **assessment espressamente inclusi**. Non è una seconda assignment e non sceglie l'operatore: il responsabile si rilegge sempre da P1. Il modello locale riceve la proiezione di tale evidenza, non ne crea la verifica. Un collegamento al contatto non include automaticamente tutti gli episodi storici.

La decisione deve considerare l'inventario completo di tutte le relazioni pertinenti del contatto nella Location, compresi cicli, stati e revisioni. Un set parziale non permette di ignorare un altro responsabile. Non si seleziona la prima riga o solo la pratica comoda. Il fingerprint della proposta include l'intero inventario tecnico, con ordinamento deterministico.

| Caso | Comportamento della proposta locale; adozione operativa non acquisita |
| --- | --- |
| Evento OPEN E01–E04 | Richiesta/funnel/OTP non bastano. Candidato solo con finalità indipendente verificata per l'episodio e partecipazione specifica CONFIRMED con edizione nota |
| PENDING_EDITION / PENDING_CONFIRMATION | DECISION_REQUIRED. Non inventare un'edizione o un consenso Advisor dal modulo pubblico |
| Partecipazione CANCELLED/DECLINED | DENIED. Un'eventuale diversa partecipazione va provata e selezionata esplicitamente nello scope |
| NO_SHOW / follow-up E04 | DECISION_REQUIRED per finalità/durata del seguito. P1 consente follow-up anche dopo no-show, ma ciò non prova un'autorizzazione Advisor |
| Consulenza OPEN C01–C04 | Candidato soltanto con explicitRequest canonico e prova pertinente del dossier; una checkbox in nota non è una transizione CONSULTATION_REQUESTED |
| Solo ARCHITECT_PATH | DENIED, indipendentemente da owner o potenziale commerciale |
| Evento + Consulenza stesso responsabile | Candidato solo se entrambe sono coerenti e lo scope dell'episodio è provato; conservare tutti i riferimenti/revisioni, nessun intent rappresentativo scelto implicitamente |
| Relazioni OPEN con responsabili differenti | DECISION_REQUIRED, accesso negato fino a risoluzione autorevole. Nessuna priorità automatica di pipeline |
| OPEN senza assignment / operatore inattivo | DENIED, anche quando owner CRM coincide con lo staff |
| Pratica chiusa con assignment ancora attiva | DECISION_REQUIRED. P1 non libera automaticamente l'assegnazione alla chiusura: non riscrivere P1 o presumere la continuità del diritto |
| Pratiche soltanto chiuse e rilasciate | DENIED nella proposta iniziale. Eventuale accesso successivo richiede policy separata |
| Riapertura/ciclo nuovo | Le evidenze del ciclo precedente non diventano automaticamente pertinenti al nuovo: nuova conferma dello scope |
| Riassegnazione | Nuove richieste del precedente responsabile negate, comprese richieste allo storico. Nuovo responsabile candidato solo con binding/grant propri e episodio esplicitamente incluso nella relazione corrente |
| Supervisor | Nessun bypass; occorre una regola separata da approvare |

Coerenza con i flussi: Evento usa una relazione per contatto (`event-relationship`) e partecipazioni/edizioni separate; l'iscrizione CONFIRMED verifica accesso/capacity/identità/finalità della registrazione, non il binding con la persona Radar. Consulenza distingue richiesta esplicita, booking e conclusione; NO_SHOW non crea automaticamente una Consulenza. Pipeline, ciclo, business revision, operator_revision e revisione assignment restano spazi distinti. La policy non modifica alcuna transizione canonica.

### C5 — Sessione staff corrente

Contratto proposto di evidenza normalizzata, non di colonne Auth inventate: issuer/user/session ID verificati, credenziale con firma/issuer/audience/scadenza validati da un verificatore fidato; identità del DB autorevole; verifica corrente della sessione e dell'utente; scadenza effettiva e policy di durata/inattività valutate. I booleani del modello locale sono **input sintetici di una porta fidata da realizzare**, mai proprietà accettabili dal browser.

Semplice decode JWT, getSession client, user_metadata e sola presenza dell'utente non bastano. Serve corrispondenza del session_id verificato alla sessione corrente dell'utente, assenza di revoca e applicazione esplicita delle policy temporali: la presenza di una riga può sopravvivere a una scadenza. Non si aggiunge un secondo registro sessioni o un session_revision fittizio in auth.sessions. La precedente sessionRevision di 4D.2A era una prova astratta, non una colonna reale; il suo mapping/versionamento va risolto nel contratto Auth prima di collegare l'adapter.

- **Stesso DB provato:** controllo della riga Auth e del suo utente/policy nella transazione finale, insieme agli altri contratti; privilegi e versione Auth devono essere verificati. Non basta dichiarare nel payload SAME_DATABASE_TRANSACTION.
- **Auth esterno / DB indipendente / topologia ignota:** il controllo remoto non partecipa al commit P1/Radar. La proposta restrittiva rifiuta l'accesso operativo: una lettura recente non è una garanzia atomica contro revoca durante il commit. Eventuale modello con tolleranza temporale richiede approvazione esplicita e un protocollo verificabile, non un TTL scelto arbitrariamente qui.

Il verificatore locale restituisce CURRENT_CANDIDATE soltanto per evidenza coerente del primo caso, sempre con authorizesAccess=false. Non verifica firme, non decodifica token, non contatta Auth e non prova che il deployment reale abbia questa topologia.

### C6 — Decisione finale e audit atomico

Contratto proposto: la restituzione richiede sessione corrente, C1 e C2 validi, C3 verificato, C4 pertinente/corrente e commit dell'audit senza dati economici. Il servizio 4D.2A conserva doppio controllo e ricevuta obbligatoria; non viene collegato ai nuovi modelli proposti.

Protocollo DB candidato, **da implementare e provare dopo la definizione delle dipendenze**:

1. Verifica crittografica credenziale sul server; derivazione dei soli riferimenti fidati, senza ruoli da user_metadata o email. Nessuna prova di autorizzazione dal browser.
2. Nella transazione autorevole, serializzare letture e ogni modifica che possa cambiare il diritto. P1 usa già l'advisory lock transazionale `(741920,2)`: il suo riuso è una possibilità, non una prova che ogni writer diretto vi partecipi. Vanno coperti grant/binding/scope, operatori, assign/reassign/release, lifecycle/cicli e nuove relazioni del contatto.
3. Bloccare/verificare le righe della sessione/utente, binding e grant, poi rileggere l'inventario completo e gli episodi approvati. Confrontare identificativi e tutte le revisioni osservate, incluse quelle dell'insieme: un nuovo intent pertinente è un cambiamento, non solo una nuova riga da ignorare.
4. Ricontrollare scadenze e revoche con il tempo del DB, soggetto esatto e snapshot immutabile; inserire la decisione audit e impegnare nello stesso confine. In caso di conflitto/serializzazione, rivalutare l'intera autorizzazione; non riusare una precedente decisione positiva o restituire un vecchio dossier dalla cache.
5. Il server accetta soltanto la ricevuta coerente con richiesta/prove e sessione ancora valida prima della restituzione. ACK perso/discordante o audit indisponibile → nessun dossier restituito. Un record di autorizzazione non prova che il browser abbia ricevuto i byte.

Il solo lock su assignment esistenti non previene un nuovo intent concorrente. Prima dell'operatività bisogna dimostrare il fencing di **tutti** i writer, compresi service-role diretti e revoca Auth: può servire una estensione forward-only di trigger/privilegi/protocollo, senza alterare la semantica P1/P2B. Non si assume che SERIALIZABLE o il lock del journal, da soli, garantiscano una fotografia finale aggiornata per writer non cooperanti. Ordine lock, deadlock, phantom e revoca multiconnessione vanno testati su PostgreSQL nativo.

Transazioni esterne non vengono incluse per dichiarazione: nessun lock DB viene mantenuto durante HTTP HighLevel. La politica si basa su mapping interni verificati e versionati, non sull'owner remoto corrente. Merge/deletion esterni devono sospendere il binding tramite il workflow approvato; non esiste una garanzia atomica fra un DB locale e una modifica CRM remota. Un evento o una prova mancante/discordante non abilita accesso. La revoca successiva al punto di decisione non può ritirare byte già consegnati; ogni nuova richiesta, anche allo storico, deve rivalutare tutto.

Audit proposto in tabelle private append-only distinte dall'audit cliente 4C.1:

- **modifiche binding/grant/scope:** record UUID, operazione, attore UUID, evidence UUID, revisioni prima/dopo e tempo DB; provenienza originaria immutabile, nuova evidenza di modifica separata;
- **letture Advisor:** request UUID server, operazione/esito, reason code tecnico allowlist, UUID staff/session/binding/grant/persona/assessment/snapshot, riferimenti intent/assignment e revisioni/fingerprint dell'insieme, policy version e tempo DB. Nessun campo libero contenente payload o cause del provider;
- nessun nome, email, OTP, token, cookie, risposta, obiettivo, importo o profilo. L'evento non riceve il risultato canonico. Errori pubblici generici; URL senza credenziali o dati economici; risposte reali future private/no-store e senza cache condivisa;
- ricevute senza dossier; idempotenza di registrazione non equivale a replay del diritto. Guasto totale dell'audit può impedire anche la registrazione del diniego, ma deve impedire il rilascio dei dati.

## 3. Modello dati proposto e dipendenze

Sole estensioni additive proposte in uno schema accesso privato, con nomi da confermare nella revisione DDL:

| Entità proposta | Dipendenze / vincoli necessari |
| --- | --- |
| staff_operator_bindings | Registro operatori P1, issuer/utente Auth autorevoli, unique parziali su soggetti non revocati, evidenza immutabile, CAS |
| advisor_permissions | FK binding, permesso esatto/Location, stato/revisione/scadenza, unique non revocati, audit |
| person_contact_bindings | FK persona Radar, Location/Contact ID, prova/riconoscimento, unique bidirezionali conservativi, conflitto/revoca |
| purpose_episode_scopes | Persona/binding, assessment espressi, intent/ciclo e partecipazione pertinenti, evidenza/revisione; non contiene operatori assegnati |
| binding_change_audit | Append-only tecnico; include creazione, modifica, sospensione/revoca nel medesimo commit del cambiamento |
| advisor_access_audit | Append-only tecnico e ricevuta; controllo finale/fencing nella transazione autorevole |

Nessun secondo registro operatori, contatti, assignment, sessioni, dossier, motore, ledger/outbox o archivio di risposte. Nessun ampliamento automatico di integration_links, nessuna riscrittura delle migration storiche. Requisiti di sicurezza proposti: schema non esposto; RLS/FORCE RLS e privilegi minimi; nessun grant client/anon/authenticated; helper privati con search_path fisso e SECURITY INVOKER dove compatibile; nessun SECURITY DEFINER o accesso ad auth.sessions introdotto per aggirare un privilegio mancante. Le funzioni staff non possono accettare actor/ruolo/prova Verified dal corpo HTTP.

**Migration candidata: nessuna creata.** Restano mancanti l'autorità di gestione identità/permessi, il processo di evidenza e relativi diritti, l'adozione di C4 (incluse scelte di prodotto sotto), la topologia/versione/privilegi Auth, l'integrazione Git/DB P1 e il protocollo che copra tutti i writer. Creare ora DDL eseguibile significherebbe fingere FK, grant o garanzie non accertati. La 4C.1 resta candidata invariata; la presenza documentata remota di P1/P2B non dimostra che Radar, Hub e P1 condividano oggi un'unica autorità transazionale.

Compatibilità adapter: P1AdvisorReadModel 4D.2A contiene uno scope selezionato e un solo intent nella prova. Prima di applicare C4 serviranno pipeline/ciclo/partecipazioni e inventario completo, e un insieme di riferimenti/revisioni nella prova finale. Non si riduce il risultato multiplo a un intent arbitrario. Il nuovo valutatore **non restituisce CurrentAdvisorAuthority o VerifiedBinding** e non è importato dall'adapter attuale. AdvisorAccessPorts.commitDecision rimane una porta da realizzare, non una transazione SQL già disponibile.

## 4. Componenti locali realizzati

- `access-contracts-proposal.ts`: tipi dei binding/grant proposti, validazione della forma e unicità del catalogo, valutazione non autorizzante di binding/permesso, piani puri di revoca/sospensione con CAS/fingerprint e audit tecnico, verifica della coerenza dell'evidenza di sessione proposta.
- `relationship-policy-proposal.ts`: valutatore della policy draft su un inventario completo sintetico. Esiti CANDIDATE_ONLY, DECISION_REQUIRED o DENIED; sempre authorizesAccess=false e policyStatus=PROPOSED. Riferisce tutte le relazioni e mantiene fingerprint indipendente dall'ordine dei record.
- `verify-patrimonial-radar-access-contracts.mjs` e relativo comando npm: test di contratti/proposta, non repository persistente o integrazione Auth.

I piani non persistono dati e non contengono create/verify/grant writer. Verificare la forma di un evidence UUID non verifica la sua esistenza, veridicità o l'autorità dell'approvatore. Un catalogo VALID_SHAPE non è un catalogo autorizzato. L'applicazione CAS dei test è un modello in memoria, senza garanzie di concorrenza PostgreSQL. Nessun modulo nuovo è usato da route, preview, API cliente, backend, access.ts o p1-access-adapter.ts.

## 5. Prove eseguite ed esiti mancanti

| Verifica | Esito / perimetro |
| --- | --- |
| `test:patrimonial-radar-access-contracts` | PASS, sei gruppi: shape/unicità/provenienza, revoche/CAS/audit tecnico, 21 casi negativi relazione, relazioni multiple/riassegnazione/storico, 13 negazioni sessione, isolamento. Nessuna autorizzazione prodotta |
| `test:patrimonial-radar-advisor-access` | PASS: 64 richieste con rifiuto atteso, 38 casi iniziali, 20 revoche/cambi durante richiesta, audit e storico sintetici |
| `test:patrimonial-radar-advisor` | PASS: 25 snapshot sintetici e identità degli indicatori/proiezioni, isolamento cliente |
| Motore / customer projection / UI / Radar | PASS: 72 gruppi 4A, 14 fixture cliente, contratti UI e dieci verificatori Radar; distinzione 4A CT-26/28/37/40 PARTIAL e CT-27 NOT RUN preservata |
| CRM/funnel/ledger/opportunità/persistenza/mapping | PASS nei sei comandi esistenti, soli trasporti locali |
| Backend Radar embedded | PASS 14 gruppi su PostgreSQL 18.6 WASM/PGlite 0.5.10, non nativo; nessuno schema accesso nuovo applicato |
| Typecheck / lint mirato / build | PASS: zero errori TS, lint mirato senza warning, build completa di 145 pagine. Lint globale 0 errori e 65 warning preesistenti |
| Preservazione integrazione | PASS: Radar v4/34 schermate e tutte le 35 fotografie byte-identiche; contratti CRM, migrazioni e dipendenze protetti |
| PostgreSQL 17 nativo / PostgREST locale | NOT RUN: binari non reperiti nel PATH, daemon Docker non disponibile; nessun servizio installato/avviato per aggirare il limite |
| Nuovi vincoli SQL/privilegi accesso, Auth reale, revoca multiconnessione, phantom/deadlock | NOT RUN: nessuna migration o adapter autorevole disponibile. I modelli e il backend embedded esistente non li certificano |

### Verificatori P1/P2B correnti eseguiti in isolamento

Preparato un worktree temporaneo detached **esattamente a 8fd4feb**, con dipendenze già installate rese disponibili tramite junction; nessun env scaricato, nessun file sorgente modificato, nessun test avviato nel checkout originale. I verificatori bloccano fetch reali e usano PostgreSQL embedded/trasporti sintetici. Copia temporanea e sola junction poi rimosse dopo verifica di SHA/stato, lasciando i due worktree originali e i loro file invariati.

- **`verify-patrimonial-assignment-management.mjs`: FAIL preesistente nel ramo funnel.** Raggiunge la guardia finale a riga 245: il confronto con 88fafcba segnala la nuova route P3B `src/app/api/webhooks/highlevel/patrimonial-performance/route.ts`. Non è una modifica 4D.2B. Il corpo precedente è stato attraversato, ma l'intera suite non è PASS e l'aggregato finale non viene stampato. Nessuna baseline aggiornata o assert eliminato.
- **`verify-patrimonial-owner-sync.mjs`: FAIL preesistente nel ramo funnel**, riga 100, expected HOLD / actual CONFIRMED. Il caso Object.assign(...,{assignedTo:undefined}) viene serializzato dal mock HTTP con JSON: il campo sparisce, esattamente come l'omissione che il decoder aggiornato ammette quando omittedAssignedToMeansUnassigned=true. Il test conserva però l'attesa HOLD, distinta dal successivo caso di omissione esplicita atteso CONFIRMED. È un'incoerenza fra fixture/assert e trasporto wire attuale da rivedere separatamente; non si cambia né il provider né il test qui. La suite e gli assert successivi al punto di arresto non sono dichiarati PASS.
- **`verify-patrimonial-runtime-capabilities.mjs`: PASS A–J**, database legacy/P1/parziale/completo, ACL/RLS/INVOKER, nessuna cache delle capability e nessuna chiamata esterna.

Questi esiti sono riproduzioni sul commit remoto pulito, non regressioni causate dai moduli proposti nel Radar. Sono comunque problemi aperti da risolvere prima dell'integrazione operativa. Il live-smoke storico del Radar (baseline c61ed43) non è stato rieseguito o promosso a PASS; nessuno smoke operativo con scritture reali.

## 6. Decisioni ancora necessarie

1. Autorità e workflow per approvare/revocare C1/C2/C3: chi può farlo, evidenze, eventuale separazione dei compiti e gestione delle controversie. Nessun superadmin universale per implicazione.
2. Conferma della cardinalità conservativa 1:1; regole per caselle/contatti condivisi, più contatti della stessa persona, fusioni e recupero identità.
3. Approvazione della policy Evento/Consulenza, requisito di partecipazione confermata, trattamento di no-show, pratiche chiuse ancora assegnate, durata del follow-up e relazione pertinente al dossier.
4. Regola esplicita per responsabilità discordanti e per lo storico; nessuna estensione automatica a tutti gli episodi. Supervisor escluso fino a regola propria.
5. Processo di riconoscimento persona–contatto, accettazione del collegamento, provenienza/accesso/conservazione evidenze e finalità privacy. Non è stata attestata conformità legale o definita una retention arbitraria.
6. Identità del progetto/DB Auth rispetto a P1/Radar, versione/privilegi e policy effettiva delle sessioni. Per autorità esterne, adozione di un protocollo o rifiuto; nessuna tolleranza alla revoca scelta automaticamente.
7. Protocollo transazionale/fencing di tutti i writer e audit; piano di integrazione Git selettiva e verifica SQL nativa/PostgREST. Prima correggere o riconciliare i due verificatori funnel senza diminuire copertura.

Non è stata acquisita un'approvazione operativa per queste decisioni durante la fase. La richiesta autorizza a formularle e verificarne i modelli locali, non a creare mapping fittizi o attivare la policy.

## 7. Preservazione, commit e readiness

Cinque file della fase: questo documento, i due moduli proposta, il nuovo verificatore e un comando test aggiunto a package.json. Nessuna dipendenza o lockfile nuovo. Adapter 4D.2A, motore, questionario, risultato cliente, route, UI, migration storiche, CRM, immagini e flag protetti con confronto a b70edc2. Nessuna nuova modifica visiva, nessuna nuova QA browser dichiarata in questa fase. Radar v4, funnel e asset rimangono preservati.

Commit locale dei soli componenti verificati identificato nella consegna e con `git log -1 -- docs/patrimonial/radar-patrimoniale-v1-access-contracts-4d2b.md`, senza hash autoreferenziale. Controllo conclusivo: originale ancora a b242752 sullo stesso branch e con i due percorsi non tracciati iniziali; remoti ancora 9146f637/8fd4feb; nessun processo Git concorrente o lock rilevato. La copia test temporanea è stata rimossa e restano soltanto i due worktree iniziali. Nessun push/deploy/merge, db push, migration remota, HighLevel, email o accesso reale.

**Readiness:** contratti e criteri di accettazione pronti per la revisione di prodotto/architettura; integrazione operativa **non pronta**. La parte locale non sostituisce approvazione, binding persistenti, verificatore Auth o audit atomico. Nessuna migration candidata fintanto che le dipendenze indispensabili non sono risolte. Fermata al termine 4D.2B.

## Riferimenti tecnici

Contratti repository agli SHA dichiarati e report precedenti. [Sessioni Supabase](https://supabase.com/docs/guides/auth/sessions): session_id e verifica della sessione autorevole sono distinti dalla validità residua della credenziale; le policy temporali vanno valutate e la pulizia delle righe può essere differita. Il riferimento è progettuale, non un'ispezione dello schema/versione Hub reale. Consultate le skill Supabase/Auth già applicate e la guida della versione Next installata. Nessuna nuova integrazione o configurazione remota eseguita.
