# Radar Patrimoniale — activation readiness 5B.2

21 ottobre 2026. **Preparazione locale completata; NO-GO per il primo collaudo con servizi reali allo stato attuale.** Implementati e verificati adapter email, trasporto remoto circoscritto, autorizzazione amministrativa e review dei binding. Nessuna attivazione effettuata.

Destinazione amministrativa invariata: **https://hub.horyzon.it/rete-architetti → Clienti**. Contatto amministrativo in public.patrimonial_contacts; persona, risposte e snapshot in patrimonial_radar_private; collegamento verificato e revocabile fra UUID distinti. P1 rimane l'unica autorità di assegnazione. Radar d'Impresa e HighLevel restano separati dal dossier.

## 1. Provenienza e preservazione

Letti AGENTS.md, DESIGN.md Website, istruzioni Hub, report 5A, integrazione 5B.1R e relative evidenze del consolidamento 5B.1. Non esiste un report separato 5B.1 nei riferimenti consegnati: il consolidamento è documentato nel report 5B.1R e in consolidamento-5b1-evidence. Consultate le guide Next 16.3.5 installate su route handler/autenticazione e la documentazione corrente Supabase, Resend e Vercel.

| Repository | SHA iniziale completo verificato |
| --- | --- |
| Website | 50a1708474fe93b38a910688e0e5f2be4bdc3cf8 |
| Hub | 9692d34443ba36bcad61acdfdc1ad3561ab911c4 |
| Platform | e31cf8e635d93c960edea0507c65d259fb8c1113 |

Tre nuovi worktree, ciascuno sul branch locale **codex/radar-activation-5b2**, sotto:

`C:/Users/emanu/.codex/visualizations/2026/10/18/01a14e5a-6067-71a0-a210-f3859cab8329/fase-5b2/`

Sottodirectory website, hub e platform. Nessun merge. Conservati worktree 5A/5B.1/5B.1R, inclusa l'integrazione Platform 5B.1 pendente. Negli originali: HEAD/branch/diff e hash dei **2772 file non tracciati Website** invariati; lock Hub/Platform preesistenti conservati. Nessun reset, clean, stash o commit del lavoro concorrente.

Lettura finale GitHub senza modificare i checkout:

| Riferimento remoto | SHA osservato |
| --- | --- |
| Website main | 9146f6372b19fdac6db1770d05f6b0ca10c1f1e5 |
| Funnel | 9d5be015b4cd00ee8e77f1cadeed48ceb2534cb4 |
| Hub main | 892b1ae30dd906b40d123c739ea81a6496863ce1 |
| Platform main | e062f03a69371a9818858c227939dbc4baf8bd88 |

Funnel, Hub e Platform sono avanzati rispetto al preflight 5B.1R. **Non incorporati né certificati dalle prove 5B.2**: serve confronto selettivo prima di utilizzare queste modifiche in un rilascio corrente.

## 2. Componenti implementati

- **ResendRadarEmail**: adapter transazionale dedicato, endpoint HTTPS fisso, mittente/reply-to Horyzon espliciti, testo senza tracking/link/report finanziario, challenge UUID come chiave d'idempotenza, timeout e un solo retry transitorio sul medesimo payload. Nessun corpo provider o OTP negli errori/log applicativi.
- **RemoteRadarRpc**: URL Supabase fissato al progetto verificato; publishable key per il gateway API e JWT server con ruolo ristretto patrimonial_radar_runtime. Nessuna service-role per la persistenza privata Radar. Firma/ruolo/scadenza sono verificati da PostgREST; il controllo preliminare delle claim nel codice è soltanto una verifica di configurazione.
- **Attestazione del deployment**: registro vuoto runtime_deployments, token con jti e deployment_id, scadenza massima un'ora, revoca corrente controllata a ogni RPC. La riga autorizzante è bloccata durante la transazione. Tre grant EXECUTE espliciti al nuovo ruolo NOLOGIN/NOBYPASSRLS, senza grant su tabelle o funzioni generiche del ledger. Prima dell'installazione verificare anche privilegi indiretti PUBLIC/default del database condiviso.
- **Runtime protetto**: soltanto Preview del progetto pilota prj_bJvIOswh4GacqtUootXATXeAkSUO; URL di deployment e progetto Supabase concordanti, riferimenti di approvazione espliciti, modalità VERIFIED_PERSISTENT. Production e modalità anonima restano negate. Otto flag di writer/booking/messaggi/owner CRM attivi impediscono l'apertura. Default OFF invariato.
- **Gateway Advisor remoto**: identità staff verificata dal provider Auth del progetto fissato, quindi JWT dello staff inoltrato a PostgREST e controlli DB correnti. Proiezione Advisor sul server; nessuna service-role/browser, fiducia in user_metadata o booleano isAdmin del client.
- **Hub**: endpoint esatto del deployment approvato, project pin del chiamante, bearer dello staff, CSRF esistente e OIDC effimero Vercel inoltrato solo a quell'endpoint. Redirect vietati, risposte private/no-store. Manca ancora l'approvazione/configurazione della specifica regola Trusted Sources.
- **Amministrazione**: RPC hub.patrimonial_radar_admin_command con autorità nominativa separata, sessione provider corrente, scadenze, CAS, idempotenza e audit immutabile. Contratto client rigoroso radar-admin-5b2-1. Nessun amministratore o grant precaricato.

Le implementazioni locali precedenti restano disponibili e continuano a rifiutare contesti remoti. Il percorso remoto è una scelta separata, non la rimozione generale del fail-closed. Le risposte applicative non contengono token di sessione, chiavi, corpi provider o dossier nel riepilogo Clienti.

**Confine ancora da completare per Evento remoto:** la continuazione opaca e il gate v2 sono predisposti, ma il ledger Evento conserva il suo trasporto di servizio storico createProductionPatrimonialStore. Non usa il nuovo ruolo privato Radar: tale ruolo non può invocare le funzioni generiche del ledger. Prima del collaudo completo occorre approvare e verificare un trasporto di intake dedicato/minimizzato o il perimetro del servizio esistente; non copiare una service-role generale nel progetto pilota per aggirare questo prerequisito. L'acquisizione locale con HighLevel OFF è verificata. Nessun nuovo worker remoto è predisposto per l'attivazione automatica.

## 3. OTP reale e sessioni

Resend in lettura: **horyzon.it verified, sending enabled, eu-west-1, open/click tracking false**. Presenti chiavi denominate Start e Supabase Integration; il connettore non ha restituito gli scope. **Non dimostrata una chiave Radar dedicata e limitata al dominio**, né configurazione SMTP/retention del provider. Nessun valore di chiave letto o allegato.

Il backend 4C conserva OTP a otto cifre, hash HMAC, scadenza 10 minuti, consumo unico, massimo cinque tentativi; rate limit DB per identità e rete, non process-local. Risposta di richiesta uguale per indirizzo nuovo/esistente, throttling ed errore di consegna. Non è una certificazione di assenza di qualsiasi side-channel temporale. L'adapter segue il contratto [Resend Send Email](https://resend.com/docs/api-reference/emails/send-email) con chiave d'idempotenza stabile per la singola challenge.

Nel runtime Vercel diretto la chiave di rete deriva da x-forwarded-for sovrascritto dalla piattaforma, accettando un solo indirizzo IP, secondo il contratto dei [request header Vercel](https://vercel.com/docs/headers/request-headers). Proxy esterni/catene IP sono rifiutati e richiedono una review diversa. Il valore entra nell'HMAC, non nei record patrimoniali in chiaro.

Cookie __Host-, Secure, HttpOnly, SameSite=Strict; Origin esatto, header CSRF, revoca, scadenza assoluta/idle e ripresa delle bozze del proprietario. Nessun OTP o bearer restituito nel JSON o nell'URL.

L'OTP persona usa la persistenza privata 4C: **non crea automaticamente un account staff Supabase Auth o Hub**. Auth/JWT/session_id reali sono invece necessari per lo staff. Non sono state cambiate impostazioni Auth/SMTP o inviate email.

Da approvare: mittente e reply-to realmente gestiti, chiave sending-only/domain-scoped, limite/costo invii, gestione bounce/suppression, retention/accessi ai contenuti email del provider e monitoraggio senza payload. Il contenuto del messaggio OTP viene necessariamente trattato dal fornitore email: la mancata esposizione nei log applicativi non certifica la retention dei sistemi Resend.

Il JWT runtime breve richiede un'emissione/rotazione sicura esterna. Il runtime non contiene la chiave di firma e non emette credenziali con ruoli arbitrari. **Broker/rotazione continuativa non implementati**: per un singolo collaudo può essere approvato un token effimero entro la sua durata; per esercizio continuativo serve completare la rotazione. Nessun token reale generato.

## 4. Identità staff e provisioning

Metadati remoti minimi: quattro righe Hub superadmin, quattro utenti provider presenti e attivi; **un solo mapping P1 attivo/network-enabled**, con ruolo Rete architect; tre staff senza mapping P1. Un secondo operatore P1 è inattivo e privo di user binding. Non letti email, nomi, password, session token o dossier. Il report non trasforma questi fatti in deleghe di lettura.

| Permesso | Uso e limiti |
| --- | --- |
| RADAR_PATRIMONIAL_LIST | Contratto di metadati 5A preservato; non riapre la lista Radar indipendente, negata nella variante Clienti. |
| RADAR_PATRIMONIAL_PERSON | Contratto 5A preservato; non supera l'ACL Rete e non concede risposte finanziarie. |
| RADAR_PATRIMONIAL_ASSIGN | Richiesto per assegnare contatti con pratiche RADAR, insieme all'autorità di supervisione Rete; tutte le pratiche tramite P1. |
| RADAR_PATRIMONIAL_ADVISOR | Richiede operatore P1 attivo associato allo stesso user_id, binding VERIFIED, responsabilità attuale contatto/intento/assignment, persona valida e audit. |

Bootstrap futuro: referente approva nominativamente UUID, scope amministrativo PERMISSIONS/IDENTITY, durata ed evidenza; DBA autorizzato registra l'amministratore nel registro vuoto. Questi scope del piano di controllo **non sono un quinto permesso finanziario**. La RPC consente poi i quattro grant, con scadenza massima 30 giorni; Advisor non può riferirsi all'operatore di un altro utente. Revoca con id e revisione attesa; nuovo grant distinto se la precedente concessione è revocata.

Un superadmin generico senza registrazione nominativa viene negato. L'amministratore delle identità non riceve automaticamente Advisor. Revoca della sessione provider, dell'amministratore, del grant, del binding o della responsabilità P1 rimuove il rispettivo presupposto. Le revoche DBA devono rispettare lock/fencing e history del contratto; nessun DELETE delle evidenze.

Tutti i grant provati qui riguardano utenti sintetici nel database isolato. **Zero grant operativi creati.**

## 5. Review della riconciliazione

La scheda Clienti esistente fornisce gli identificativi/stati; il comando amministrativo opera separatamente dal dossier. La procedura è: identificare la candidatura → raccogliere evidenza indipendente e riferimento opaco della review → controllare UUID/revisioni/impedimenti → comando autenticato → rileggere scheda e audit. L'evidenza non deve contenere importi, email o copie di documenti; il comando accetta soltanto riferimenti operativi.

| Scenario | Esito previsto/verificato e procedura |
| --- | --- |
| Evento prima, Radar dopo | OTP + ticket → candidato → conferma esplicita se non ambiguo. Nativo Rete PASS. Review nominativa per le eccezioni. |
| Radar prima, Evento dopo | Conserva la persona/report e la scheda già verificata; altra scheda Evento resta candidata. Possibile chiusura motivata/revoca del candidato, **nessun accorpamento finanziario**. Nativo PASS. |
| Più Radar | Una persona/binding corrente, assessment e snapshot separati. Nativo PASS. |
| Email cambiata | Quarantena EMAIL_CHANGE, sessione/dossier negati, conservazione delle evidenze. Nessuno spostamento automatico di verified_emails o report; nuovo possesso casella e identificazione indipendente prima di un'eventuale procedura straordinaria. |
| Casella condivisa | Quarantena SHARED/COLLISION e diniego; email comune non prova identità individuale. Non è previsto un comando di sblocco indiscriminato della casella. |
| Scheda già associata ad altra persona | CONFLICT, nessun secondo binding VERIFIED o trasferimento dei suoi assessment. |
| Binding revocato | Stato terminale; vietata la riattivazione del medesimo record. La proposta di altro collegamento è separata e non può spostare dossier già collegati altrove. |
| Futuro contatto HighLevel già presente | Conservare riferimento candidato/minimo e review; non usare owner/email CRM come autorità e non importare risposte. Il piano CRM resta SIMULATION_ONLY/writes=[]; nessuna ricerca/scrittura reale eseguita. |

La RPC implementa propose_binding, review_binding e quarantine_mailbox; verifiche CAS, replay identico, conflitto sul riuso della chiave, stato terminale, conflitti persona/scheda e audit sono collaudati. La verifica non consente una fusione se gli intenti finanziari sono già associati a un'altra scheda. **Unificazione di identità distinte e trasferimento email non sono stati autorizzati o implementati come merge amministrativo**: restano escalation documentate, non casi falsamente risolti.

## 6. Database reale, candidata e rollback

Progetto verificato in sola lettura: **horyzon / pmkyeqrfkunypfkbjnyg / eu-central-1 / PostgreSQL 17.6.1.166**. Presenti P1/P2B, 0056, ricerca/training e successive migration candidature/attivazioni Architetti. Assenti persons Radar e registro permessi 5A. Contatti/assegnazioni esistenti con RLS FORCE.

Fingerprint prosrc della guardia P1 remota: **753e1a961d78bb0f7faf0fdd026452f9**, attesa dalla candidata. Sei corpi Rete confrontati coincidono con la baseline nativa conservata dalla 5B.1R: command, snapshot, ingest, can_contact, is_supervisor, operator_id. Nella candidata i primi due vengono conservati come pre_clienti e avvolti, non sostituiti alla cieca. Guard/commit/capabilities P1 locali hanno le differenze intenzionali RADAR della 5B.1R; non vanno dichiarati identici al remoto pre-Radar.

Confrontati ACL, SECURITY DEFINER, colonne Auth, constraint kind/funnel/operator/contact e trigger P1. Nessun trigger Radar installato nel remoto. Evidenze: [metadati](activation-5b2-evidence/remote-metadata.json), [fingerprint remote](activation-5b2-evidence/remote-source-fingerprints.json), [fingerprint locali](activation-5b2-evidence/local-source-fingerprints.json). Nessuna lettura di report personali.

**Novità remota 20261021173411 architetti_event_radar_contact_link:** tabelle amministrative patrimonial_contact_event_registrations / patrimonial_contact_radar_links e RPC di ingest/link/context, senza dossier privato. I conteggi osservati sono entrambi zero. Il link legacy verifica email fornita dal backend ma non è il binding persona–scheda 5B.1R: non va usato per autorizzare Advisor. Conservare questi oggetti; approvare una proiezione di soli riferimenti dal binding autorevole oppure lasciarli separati e disattivati nel percorso Radar. Nessun backfill. Le migration successive e i main concorrenti richiedono replay su clone prima dell'applicazione condivisa.

Ordine mirato proposto, **non eseguito sul remoto**:

1. Rileggere history/cataloghi con packages/database/review/patrimonial-radar-5b2-preflight.sql; fissare digest SQL, fingerprint, privilegi e dipendenze dell'istante autorizzato. Stop su drift non revisionato.
2. Backup consistente gestito dal DBA: snapshot/PITR disponibile e dump cifrato con schema, dati pertinenti, funzioni, ACL, ruoli e dipendenze Auth/P1. Registrare hash SHA-256, timestamp/LSN, conteggi e posizione protetta. Provare il ripristino in ambiente isolato con accessi limitati. **Nessun backup remoto creato o scaricato in questa fase.**
3. Conservare la baseline già presente P1/P2B/0056; nessun replay completo delle migration Website.
4. Applicare solo Website **20261018191940_patrimonial_radar_identity_sessions.sql**.
5. Applicare solo Platform **20261021171340_patrimonial_network_foundation_candidate.sql**.
6. Applicare Platform **20261021191024_patrimonial_radar_activation_candidate.sql**, generata tramite CLI come nuova candidata. Registri runtime/amministratori vuoti; nessun grant nominativo automatico.
7. Verificare RLS FORCE, EXECUTE PUBLIC/anon negati, schema privato non esposto, ruolo runtime senza accesso tabelle/generic ledger, sessioni/revoche, fingerprint nuovi attesi, integrità contatti/intent/assignment, audit e contract PostgREST. Ricaricare lo schema cache solo con autorizzazione operativa.

**Non applicare** la vecchia fondazione 5A 20261020134559 né 20261020165515 insieme all'alternativa, che incorpora la correzione. Nessun history repair automatico.

Rollback: prima chiudere i gate applicativi; revocare jti runtime, regola Trusted Sources dedicata e grant/amministratori di collaudo con revisioni/history corrette; ripristinare gli artefatti applicativi precedenti e verificare dinieghi. Conservare persone, snapshot e audit raccolti. Il ritorno dello schema P1 pre-RADAR è ammesso soltanto dopo verifica che non esistano dipendenze/intent RADAR; altrimenti applicare recovery mirata approvata o restore verificato. **Nessun DROP schema o restore cieco su dati condivisi.**

Retention: retention_review_at è un promemoria di review, non un purge. Il soft-delete della persona nega accessi/sessioni, ma **non costituisce cancellazione fisica completa** di snapshot, audit, backup o messaggi provider. Servono durata approvata, responsabile, procedura di diritti/cancellazione e prova di esecuzione; nessun cron/purge attivato. Storage e retention CV restano un controllo operativo separato.

## 7. Informativa e modalità finale

Preservata la UI semplificata e la metodologia delle 40 domande, 29 ordinarie + 11 approfondimenti. Integrati esclusivamente avvisi di servizio: salvataggio Horyzon, finalità educativa/ripresa/evoluzione, risultato sintetico, Advisor assegnato e autorizzato, contatto info@horyzon.it per informazioni/diritti, marketing e consulenza distinti, dati tecnici di accesso separati.

La Preview futura si presenta come **collaudo protetto con scenario inventato**, non come servizio pubblico già approvato. La versione RP-SERVICE-5A-DRAFT-1 resta una bozza: il gate di approvazione in configurazione non è prova di approvazione legale/editoriale. Necessaria approvazione esplicita del testo e della retention; se cambia la versione, serve aggiornare concordemente contratto e vincolo DB.

Nessuna promessa di consulenza/rendimento o conformità certificata. Nessun anonimo alternativo e nessun aggiramento della verifica email per accedere a compilazione/salvataggio.

## 8. Prove effettive e collaudo preparato

| Prova eseguita nella 5B.2 | Esito |
| --- | --- |
| PostgreSQL 17.6/PostgREST 16.5, nuova candidata | **PASS 12 gruppi**: OTP Resend intercettato, retry/idempotenza, cookie/CSRF/revoca, quattro grant, mapping Advisor, review/CAS/replay, audit/RLS, gate deployment/writer, firma e revoca runtime. |
| Rete con --activation-candidate | **PASS 13 gruppi**, inclusi Event/direct/repeat, P1 atomico/capacità, riassegnazione e vecchio Advisor, ambiguità/revoche/edizioni, HighLevel OFF. |
| Storico 5A nativo / PostgREST | **PASS 14 + 4 gruppi**, con concorrenza e accessi diretti negati. |
| Regressioni Website | **PASS 20 comandi**, [esiti diretti dei processi](activation-5b2-evidence/regressions.json); Radar, Advisor, backend/UI, ledger/CRM/opportunità/persistenza/mapping/funnel/CV, presentazioni e preservazione. |
| Website suite generale / build Next / typecheck | **PASS**; build Turbopack standard, altri prodotti preservati. |
| Website lint | **PASS zero errori, 77 warning**; file nuovi/modificati controllati separatamente senza errori. |
| Hub | **PASS 197 test/26 file, build PASS**; tre file cambiati: lint zero errori/warning. |
| Hub globale | **FAIL preesistente**: 79 diagnostici TypeScript identici riga per riga alla baseline; lint 348 errori/14 warning, come 5B.1R. Nessun nuovo errore patrimoniale. |
| Platform | Nuova SQL verificata nativamente; la suite globale/TS/build Platform non è stata rieseguita in 5B.2, che non modifica codice TS. Il PASS complessivo 5B.1R resta riferito al suo SHA. |
| Provider/sessioni/grant reali | **NOT RUN**; account Auth, chiave di firma, recapiti .invalid e grant di prova sono fixture locali. |
| Browser 5B.2 con servizi reali | **NOT RUN, predisposto sotto**. Le immagini 5B.1/5B.1R restano evidenze storiche; non vengono riqualificate come nuove prove. |
| ETag HTML 304 | **FAIL APERTO**, non ricollaudato né corretto. Ticket Vercel in bozza, non inviato. |

Nessuna nuova verifica visiva browser effettuata in 5B.2: build e test non la sostituiscono. Confermati staticamente **Radar d'Impresa v4/34 schermate**, dominio e componenti invariati; **35 asset fotografici correnti** e test di presentazione dei due funnel. Nessuna revisione grafica o del questionario.

Collaudo completo predisposto, da eseguire dopo approvazione su deployment esatto protetto, desktop e mobile:

1. Identificare test lead/email autorizzata e due consulenti A/B con identità proprie; scenario inventato della 4P.6. Niente credenziali altrui o dati economici reali.
2. Verificare Vercel Authentication ALL, target Preview effettivo, SHA, progetto, gate/health e pin Supabase; accesso individuale/machine identity approvato. Test negativo senza autorizzazione.
3. Richiedere OTP, verificare consegna, scadenza, nuovo invio e consumo unico; Origin/CSRF errati negati. Non allegare codice/cookie/header.
4. Leggere informativa, verificare email prima del questionario, salvare risposte sintetiche includendo Non so/Preferisco non rispondere, correggere una risposta, ricaricare/riprendere, completare e confrontare il risultato deterministico.
5. Nuova sessione con la stessa email, recupero storico e secondo episodio esplicito: stessa persona, due report canonici, nessuna duplicazione finanziaria in contatti.
6. Acquisizione dalla vera pagina Evento: ricevuta duratura, richiesta distinta da presenza, ticket opaco rimosso dall'URL, conferma dopo OTP, comparsa nella scheda Clienti. Provare anche percorso inverso/candidato.
7. Amministratore nominativo assegna A; A con Advisor apre; staff senza Advisor viene negato. Riassegnare B: A non deve riaprire, B può aprire; controllare audit e P1 corrente. Ricaricare/chiudere report già aperti: la revoca impedisce future letture, non cancella retroattivamente informazioni già viste.
8. Quarantena/identità ambigua/candidate/altra persona: nessuna fusione; replay/CAS e revoca negativi. Account/sessione revocati negati anche con JWT non ancora scaduto.
9. HighLevel e worker OFF: dati/ricevute/report restano disponibili, nessuna chiamata CRM, prenotazione o email diversa dall'OTP autorizzato.
10. Controllare richieste browser senza salvare payload sensibili, storage del browser, CSP/script/toolbar/analytics, no-store e pulizia memoria. La persistenza delle risposte è soltanto quella remota dichiarata. Raccogliere soltanto esiti e feedback qualitativo separato; nessun video/screenshot personale/HAR integrale.
11. Revocare credenziali/grant/accessi di collaudo, verificare i dinieghi e trattare dati sintetici/log secondo retention approvata. Registrare separatamente PASS/FAIL/NOT RUN per ogni passo.

## 9. Operazioni remote necessarie: nessuna ancora autorizzata

| Ordine | Operazione futura esatta | Impatto / ritorno |
| --- | --- | --- |
| 1 | Approvare sorgenti correnti, identità nominative, testi/privacy, retention, destinatari email e percorso del ledger Evento. | Decisioni necessarie; nessun effetto remoto fino all'autorizzazione. |
| 2 | Ripetere preflight e predisporre backup/restore verificato del progetto Supabase indicato. | Letture/esportazione protetta; niente copie dati in Git. |
| 3 | Applicare soltanto la sequenza 4C.1 → alternativa 5B.1R → candidata 5B.2 dopo replay delle migration concorrenti. | DDL su DB condiviso e guardie P1: rischio da approvare; rollback descritto sopra. |
| 4 | Provisionare credenziale email dedicata e identità tecnica runtime breve, registrando jti/deployment/scadenza. | Credenziali nuove; revoca mirata. Nessuna chiave di firma generale nell'app. |
| 5 | Configurare **soltanto Preview del progetto pilota** con URL/deployment e segreti server approvati. | Nessuna variabile Shared/Production del Website; annullamento tornando ai gate OFF e revocando il token. |
| 6 | Autorizzare nuovo trasferimento sorgenti/deployment e corrispondente versione Hub in ambiente protetto. | Questi componenti non sono nella Preview 4P esistente; nessun deploy eseguito ora. Mantenere primo artefatto e sito pubblico invariati. |
| 7 | Verificare project ID Hub effettivo e autorizzare la singola regola Trusted Sources chiamante/ambiente → pilota Preview; usare OIDC effimero. | Accesso macchina al solo progetto pilota; rimuovere la regola a fine prova, senza disabilitare Deployment Protection. |
| 8 | Bootstrap amministratori e quattro grant nominativi a durata limitata; verificare mapping, issuer/audience, sessioni provider reali. | Accesso sensibile esplicito; revoca con audit. Nessun invito/ruolo team automatico. |
| 9 | Eseguire la matrice browser con email reali **separatamente autorizzate** e dati patrimoniali inventati. | Invii OTP/dati di accesso effettivi: richiedono approvazione nuova e limiti noti. Stop e revoca su accesso eccessivo. |

Contratto di configurazione da approvare, **nessun valore segreto allegato**:

- Website/pilota, server: PATRIMONIAL_RADAR_BACKEND_ENABLED, BACKEND_CONTEXT, FOUNDATION_CONTEXT, REMOTE_ORIGIN, SUPABASE_URL, PUBLISHABLE_KEY, RUNTIME_TOKEN, IDENTITY_SECRET, RESEND_KEY, EMAIL_FROM, EMAIL_REPLY_TO, RETENTION_REVIEW_DAYS, ACTIVATION_APPROVAL_REF, NOTICE_APPROVAL, HUB_CONTEXT (tutti con prefisso PATRIMONIAL_RADAR_); modalità VERIFIED_PERSISTENT e relativo gate.
- Evento: PATRIMONIAL_V2_ENABLED, PATRIMONIAL_EVENT_RADAR_CONTEXT e perimetro separato del ledger duraturo, ancora da approvare/minimizzare.
- Hub/server: PATRIMONIAL_RADAR_HUB_CONTEXT, HUB_REMOTE_GATEWAY, HUB_VERCEL_PROJECT_ID, HUB_APPROVAL_REF, HUB_DEPLOYMENT_HOST con prefisso PATRIMONIAL_RADAR_; VERCEL_OIDC_TOKEN emesso dalla piattaforma. Nessuna credenziale service-role nel frontend.
- VERCEL, VERCEL_ENV, VERCEL_PROJECT_ID, VERCEL_DEPLOYMENT_ID, VERCEL_URL sono segnali trusted della piattaforma: non parametri del browser.
- CRM_WRITE, OPPORTUNITY_WRITE, BOOKING, MESSAGES, WEBHOOK, ASSIGNMENTS, OWNER_SYNC e HIGHLEVEL_PERFORMANCE_WEBHOOK (prefisso PATRIMONIAL_, suffisso _ENABLED) devono restare disattivati nel pilota. HighLevel successivo, nessuna modifica al routing operativo.

Il project ID Vercel pilota è quello autorizzato nelle fasi precedenti; **protezione e stato Vercel non ricertificati in 5B.2**. Il connettore richiedeva un identificativo di collegamento non disponibile nella chiamata; nessuna configurazione alternativa è stata scritta. La verifica fresca di Vercel Authentication ALL, metadati deployment e project ID Hub resta un requisito prima dell'attivazione. Per il primo collaudo scegliere la coppia minima **Hub Preview → pilota Preview**, dopo verifica dei due ID; nessun accesso Production implicito. L'accesso fra progetti richiede una regola esplicita secondo [Vercel Trusted Sources](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources); per il database rimangono distinti [grant e RLS Supabase](https://supabase.com/docs/guides/api/securing-your-api).

## 10. Esito e commit locali

**GO per review del codice e prosecuzione del collaudo isolato. NO-GO oggi per servizi reali o apertura pubblica.** Blocchi: approvazioni privacy/staff/email, verifica credenziali minime/intake Evento, emissione/rotazione token, configurazione/protezione remota, backup/replay migration e main concorrenti, prova browser con sessioni/provider reali.

Restano esplicitamente aperti: **ETag 304 FAIL**, debito Hub, Storage/retention CV operativi, paginazione/prestazioni con molti contatti, cancellazione/retention approvate, attivazione HighLevel successiva. La bozza del ticket Vercel conserva deployment/Next/riproduzione/RFC e non è stata inviata.

| Repository | Commit locale codice 5B.2 |
| --- | --- |
| Website | f5f776250925e525000dc6f4973987f11979a823 |
| Hub | 39ff38b82c4a03efb4dd530b0dd47093bae25510 |
| Platform | 4d35e8930fbd0a6c1efede8ab6d99da6aa0abb11 |

[Inventario completo dei file](activation-5b2-evidence/file-inventory.json) e [verifiche di chiusura](activation-5b2-evidence/verification-summary.json). Il commit documentale finale segue quello del codice Website; lo SHA è riportato nella consegna senza autoriferimento circolare.

Durante i controlli la revisione automatica ha respinto un aggiornamento manuale del riepilogo e poi uno script generale di aggiornamento dei pin. Nessuno dei due comandi è stato eseguito. Gli esiti finali derivano da una nuova esecuzione completa; l'ultimo hash è stato aggiornato puntualmente solo dopo ispezione del file e verifica nativa dell'aggiunta di ulteriori dinieghi. Conservate prove negative e FAIL reali; nessuna riduzione di copertura per ottenere PASS.

**Nessun push, merge, deploy, migration remota, flag remoto, grant reale, invito, email reale o scrittura HighLevel.** Nessuna pubblicazione o modifica al sito Horyzon.
