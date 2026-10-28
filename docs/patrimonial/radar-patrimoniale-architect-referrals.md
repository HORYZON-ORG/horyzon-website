# Radar Patrimoniale — link personali Architetti

Report conclusivo locale, 26–27 ottobre 2026 (Europe/Rome).

**Esito:** estensione Radar implementata e collaudata localmente. Lo stesso codice registrato produce i due link personali; l'attribuzione passa dai controlli server e da P1. **NO-GO per attivazione remota o pubblicazione:** migrazioni candidate, configurazioni 5D e provider reale non sono stati attivati. Rimane inoltre il limite del contratto HTTP Evento v2 descritto sotto.

## 1. Baseline, isolamento e SHA

Tutti i nuovi checkout si trovano in:

`C:/Users/emanu/.codex/visualizations/2026/10/18/01a14e5a-6067-71a0-a210-f3859cab8329/radar-architect-referrals/`

Branch dedicato nei quattro checkout: `codex/radar-architect-referrals`.

| Repository / sottocartella | Base | SHA codice verificato |
| --- | --- | --- |
| Website / website | `b25b5e5b9f6a2fe75c2af913232f6e5a8504ee35` | `4646dbf0fe28039394335d9011f751cadcfbb8dc` |
| Platform / platform | `9abf8ac07f7c886b786eae0669ef34aaf1f7c41d` | `d3cbcb517e5b992fe26529398b0ceb40f06cc6a5` |
| Portale / architetti | main `df2c27b3e3eb4a085d032e8137612dbd5fee4eed` | `e84f91804a8a529e351f7eb54df9933cb3031530` |
| Hub / hub | `0f65332ef3e7f38938320f49ec79f0df6dcd4d93` | invariato, stesso SHA |

Questo report e le evidenze sono un successivo commit documentale Website: il relativo HEAD è riportato nella consegna finale. I test si riferiscono agli SHA codice della tabella.

Verificati AGENTS.md, DESIGN.md, documentazione 5D e contratti correnti. Sono stati usati cache Git indipendenti e nuovi checkout. Nessun merge Git eseguito. Dal ramo portale `feat/evento-link-personale` (`f2db958882aa37938a79c62e21ffb328f3446c13`) sono state applicate selettivamente le modifiche esistenti necessarie, preservando il main del portale e la formazione concorrente.

**39/39 checkout preesistenti censiti invariati:** HEAD, branch, diff, stato e hash dei file non tracciati controllati. Il checkout originario Website resta a `b242752102542e5280bba8b6ba0c4aecf9fcd722`, sul branch `feat/patrimonial-pilot-funnels`, con i suoi 2.772 file non tracciati. La verifica non certifica il contenuto delle cache ignorate; per i test sono state usate copie locali separate delle dipendenze. [Evidenza di conservazione](architect-referrals-evidence/preservation.json).

## 2. Preflight remoto, esclusivamente in lettura

Ref osservate:

| Riferimento remoto | SHA |
| --- | --- |
| Website main | `9146f6372b19fdac6db1770d05f6b0ca10c1f1e5` |
| Website feat/patrimonial-event-referrals | `0647ca44a01037ca879f971d23d5ab0ea14056df` |
| Platform main | `2fdcaed683391631267bb681705b3a1fd4ef5e31` |
| Hub main | `2c0bfe15f1997b4add06a8b695082e2bc3127176` |
| Architetti main | `df2c27b3e3eb4a085d032e8137612dbd5fee4eed` |

Platform main è avanzato rispetto al precedente rilievo: esaminate le modifiche concorrenti, prevalentemente formazione e contesto personale; non importate né sovrascritte nella base 5D. Il nuovo codice non costituisce un'integrazione generale dei main.

Sul progetto Supabase `pmkyeqrfkunypfkbjnyg` sono stati letti soltanto catalogo, definizioni e metadati ACL. Nessuna riga cliente, codice referral reale o credenziale acquisita. Non è stata invocata la RPC reale che genera un link.

Confermati:

- `anon` e `authenticated` senza USAGE su `public`; entrambi con USAGE su `hub`.
- Schema Radar e nuova RPC di validazione ancora assenti.
- Guardia P1 con fingerprint del corpo `753e1a961d78bb0f7faf0fdd026452f9`.
- Registro unico `public.patrimonial_architect_referral_links`, registrazioni Evento e funzioni esistenti di validazione, ingest e link personale.
- Definizioni condivise necessarie al rehearsal confrontate con il catalogo attuale.

[Evidenza preflight](architect-referrals-evidence/remote-preflight.json). Nessuna scrittura remota effettuata.

## 3. Estensione realizzata

### Due link, un solo registro

Il portale personale legge/genera attraverso la RPC esistente il codice dell'operatore autenticato e mostra:

- `https://horyzon.it/benessere-patrimoniale/evento?ref=CODICE`
- `https://horyzon.it/radar-patrimoniale?ref=CODICE`

Due comandi Copia verificati nel browser. Nessun campo operator_id selezionabile. Operatore non abilitato, inattivo o codice revocato non ottiene un nuovo link operativo dall'interfaccia.

Non esiste un secondo registro codici. La nuova tabella privata registra soltanto la provenienza immutabile dell'assessment e l'esito dell'attribuzione; non contiene risposte finanziarie.

### Acquisizione e identità

La pagina nativa Radar acquisisce soltanto un singolo codice di 32 caratteri esadecimali minuscoli. Parametri duplicati o malformati portano alla revisione.

La chiamata same-origin `POST /api/patrimonial-radar/referral` conserva i controlli Origin/provenienza/CSRF e accetta soltanto il codice. La verifica server firma un messaggio con scopo e timestamp e invoca la RPC ristretta nello schema hub. Il database riusa `architetti_private.validate_referral` e verifica operatore attivo e collegamento al suo UUID.

Il codice passa in un cookie cifrato HttpOnly, SameSite Strict, Secure in Preview, con scadenza di otto ore; è conservato anche nel passaggio OTP cifrato e viene rimosso dalla query visibile dopo l'acquisizione. Nel browser locale è stato verificato il mantenimento attraverso l'OTP sintetico. Assenza del servizio di acquisizione non fa proseguire silenziosamente perdendo la provenienza.

Il codice non autentica il cliente e non conferisce accesso al dossier. Identificazione, email verificata, sessione e riconciliazione restano quelli 5D. Il referral è incluso nell'envelope HMAC soltanto per la creazione esplicita dell'assessment, separato dall'identità.

Restano chiusi i gate predefiniti, Production e progetti Vercel non autorizzati. Il verificatore 5D originale è rimasto identico e passa.

### Assegnazione e casi da verificare

| Caso | Comportamento verificato |
| --- | --- |
| Nuovo contatto valido da A | Un contatto, assegnazione ad A attraverso P1, audit e idempotenza |
| Contatto Evento A compatibile | Stesso contatto; nessuna partecipazione Evento confermata dal completamento Radar |
| Contatto già di A | Responsabile mantenuto |
| Contatto già di B che segue A | B mantenuto, provenienza A conservata; A non legge il dossier |
| Contatto preesistente senza responsabile | Revisione conservativa, nessuna adozione automatica dal referral |
| Identità ambigua | Assessment privato conservato; nessuna assegnazione automatica |
| Codice invalido/revocato/operatore disabilitato | Assessment privato conservato e avviso di verifica; nessuna attribuzione automatica |
| Secondo Radar | Stessa persona/contatto, nuovo assessment e storico precedente immutato |
| Radar diretto | Comportamento 5D invariato; nessuna provenienza referral creata |

Se un cliente di B usa un codice invalido, viene sospesa soltanto la nuova pratica: il contatto verificato resta collegato, il responsabile e i report precedenti restano invariati. Il test nativo verifica anche che una successiva assegnazione manuale autorizzata, attraverso il comando P1 esistente, renda consultabile la nuova pratica. La provenienza originaria rimane immutabile.

La scrittura usa lo stesso lock P1, i vincoli differiti e una nuova verifica di sessione/gate al termine della transazione. Replay con codice cambiato rifiutato; due prime compilazioni concorrenti non duplicano il contatto.

### Tre viste, stessi identificativi

Le viste Hub indipendente e Rete Architetti → Clienti mantengono le implementazioni 5D esistenti. Nessuna modifica al codice Hub.

Il portale personale usa la nuova RPC `hub.architetti_personal_radar(uuid,uuid)` e gli stessi assessment_id, case_id e report canonici. La lista contiene metadati, non risposte finanziarie. Il dettaglio è richiesto soltanto all'apertura esplicita e viene cancellato dall'interfaccia quando cambia contatto/account, la pagina perde visibilità o viene smontata.

Il contatto deve appartenere all'architetto corrente anche se l'utente ha privilegi Hub superiori. Per il dossier sono necessari sessione staff viva, assegnazione P1 corrente e permesso esplicito `RADAR_PATRIMONIAL_ADVISOR`; il referral non attribuisce tale permesso. Revoca Advisor e riassegnazione P1 negano la lettura successiva. Nessun nuovo privilegio generale o service-role nel browser.

## 4. Candidata SQL e compatibilità 5D

Unica nuova candidata Platform:

`packages/database/pending/20261026220758_patrimonial_radar_architect_referrals.sql`

**SHA256 LF:** `66a40de3f7f6ac9a97d7002bc8077347ceea5e2a440e7ba2fe4376f869faf5fa`.

La catena locale ripetuta è **M1 → M2-5D → M3-5D → M4**. M1, M2-5D e M3-5D conservano i precedenti hash, senza riscritture. [Hash e ordine](architect-referrals-evidence/migration-chain.json).

M4:

- Aggiunge provenienza privata append-only con FORCE RLS, senza accesso diretto alle tabelle per i ruoli browser.
- Aggiunge validazione pre-auth HMAC con scopo, finestra di 30 secondi e gate; EXECUTE selettivo ad anon/authenticated nello schema hub già utilizzabile. Risposta di sola validità, nessun UUID proprietario.
- Mantiene il confine account 5D completo dietro il nuovo ingresso SECURITY DEFINER, con `search_path=pg_catalog`; revoca agli utenti l'invocazione diretta del vecchio ingresso rinominato.
- Aggiunge l'ingresso personale, delegando il dettaglio ai controlli Advisor/P1 esistenti.
- Non concede USAGE su public, non installa trigger globali sul ledger Evento, non modifica le definizioni Event/P1 condivise della baseline, non abilita gate e non inserisce chiavi o permessi staff.

Le tre migration referral/personali già installate sono state riprodotte **solo nelle fixture native** per riflettere il catalogo attuale: non vanno riapplicate al remoto. Le copie di test rimuovono esclusivamente righe vuote finali; manifest con hash originali e trasformazione sotto `scripts/fixtures/referral-runtime-current/`.

Il rehearsal non è un clone completo del database remoto: confronta 55 definizioni, 30 stati RLS e 60 vincoli della baseline rilevante, aggiungendo i tre DDL correnti necessari al referral. Auth, chiavi e utenti sono sintetici. La fixture Auth minima non abilita USAGE auth per una SELECT diretta su user_roles: quel diniego resta distinto dai cinque test amministrativi RPC, che verificano esplicitamente i rispettivi errori di autorizzazione.

## 5. Compatibilità Evento: prova e limite aperto

Il ramo Website referral indicato è stato esaminato e conservato. Il suo contratto corrente **rifiuta esplicitamente referralCode nel percorso HTTP Evento v2**. Non è stato modificato quel contratto né importato l'intero ramo nella base Radar 5D.

La prova “Evento A → Radar A → stessa scheda” usa il vero ingresso PostgreSQL/PostgREST canonico già installato per l'Evento riferito, poi l'identità verificata Radar. Questa prova è PASS, con HighLevel OFF e senza trasporto CRM. La regressione dell'ingresso Website Evento v2 diretto è PASS.

**Non è quindi dimostrato un percorso HTTP completo Evento v2 con referral.** La composizione del futuro artefatto Website e la scelta del contratto Evento v2 restano un prerequisito di rilascio da decidere esplicitamente. Nessuna eliminazione silenziosa del codice o fallback obbligatorio su HighLevel introdotti. Iscrizione richiesta, partecipazione confermata e completamento Radar restano stati distinti.

## 6. Prove effettivamente eseguite

| Prova | Esito e ambito |
| --- | --- |
| Nuovo verificatore native referral | **56/56 PASS**, PostgreSQL 17.6 + PostgREST 16.5 locali |
| Verificatore 5D originale, invariato | **4/4 PASS** |
| Gate account esistenti | **8 PASS** |
| Nuovo confine HTTP referral | **6 PASS**, trasporto simulato, Origin/CSRF/DTO/cookie/gate |
| Regressioni Website | **19/19 PASS finali** |
| Website typecheck / build Next 16.3.5 | **PASS / PASS** |
| Website lint dei file interessati | **PASS**, 0 errori, 0 warning |
| Portale npm run check | **PASS**: 56 test in 13 file, 50 assert PostgreSQL, typecheck e build |
| Portale lint | 0 errori, **3 warning nuovi** sui contatori ref nel cleanup; nessuna regola disabilitata |
| Hub invariato | **201 PASS**, 941 assert, 27 file; build non ripetuta in questa attività |
| Conservazione checkout censiti | **39/39 PASS** |

Il primo giro Website aveva 18 PASS e un FAIL di `test:patrimonial`: il build parallelo non aveva ancora generato l'HTML francese richiesto (ENOENT). Dopo il completamento del build, lo stesso comando integrale è passato senza modifiche ad assert o codice. Il risultato iniziale è conservato nell'evidenza, insieme al retry.

Regressioni Website: Radar d'Impresa v4 e **34 schermate**, motore/proiezione/Advisor/backend/UI/public del Radar Patrimoniale, funnel, ledger, CRM, opportunità, persistenza, remote mapping, assenza dipendenze Platform, contratti semplici, presentazioni Evento/Architetto, assegnazioni e **35 asset fotografici**.

Le 56 prove native includono tutti i casi obbligatori del mandato: proprietario corrente, storico, codici invalidi/revocati/disabilitati, accessi trasversali negati, Advisor, revoche, concorrenza, replay, ambiguità e HighLevel OFF. I 33 corpi dei test nativi originari e i file originali del verificatore/ACL 5D sono invariati. Aggiornati soltanto pin espliciti dei sorgenti modificati, senza esclusioni generiche. [Revisione dei pin](architect-referrals-evidence/source-pin-review.json).

I test del portale conservano la supervisione globale Hub nelle prove DB; la chiamata API del portale personale di un supervisore senza propria competenza ora richiede 403 invece di 200, coerentemente con il confine personale già installato. Nessuna apertura della vista globale nel portale.

Restano visibili gli errori globali Hub già rilevati in 5D: **82 errori typecheck**, **513 errori e 15 warning lint**. Non sono attribuiti alle modifiche locali, perché il codice Hub è identico, e non sono dichiarati risolti.

[Evidenza native](architect-referrals-evidence/native-results.json), [5D](architect-referrals-evidence/original-5d-verifier.json), [gate](architect-referrals-evidence/account-gates.json), [HTTP](architect-referrals-evidence/referral-http.json), [regressioni](architect-referrals-evidence/regressions.json).

### Browser locale reale

Eseguiti con browser CUA, servizi loopback, account inventati su dominio .invalid e OTP sintetico; database e PostgREST nativi. Non sono risultati di volontari né prove email reali.

Verificati: codice conservato dopo OTP, avvio Radar, 29 domande ordinarie, “Non so”, “Preferisco non rispondere”, ritorno/modifica, completamento e risultato immutabile, cliente presente nel portale, apertura Advisor e diniego dopo revoca sintetica, avviso codice invalido. Testate le due copie negli appunti.

- Link personali desktop: **1280×900**.
- Link personali e avviso Radar mobile: **390×844**, scrollWidth 375, senza overflow orizzontale.
- Risultato Radar acquisito con viewport iniziale di larghezza **714**.
- Dieci script Radar osservati nel DOM, tutti same-origin /_next/, nessun src esterno.

Non è stato eseguito un capture completo della rete o un audit esaustivo dello storage browser: non si deduce tale garanzia dalla sola ispezione DOM. I nuovi componenti non persistono risposte finanziarie nello storage e il trasporto di prova non usa CRM. Il comportamento Auth ordinario del portale non è stato sostituito.

Evidenze sintetiche: [desktop](architect-referrals-evidence/personal-links-desktop.jpg), [mobile](architect-referrals-evidence/personal-links-mobile.jpg), [dossier autorizzato](architect-referrals-evidence/personal-dossier-authorized.jpg), [dossier negato](architect-referrals-evidence/personal-dossier-denied.jpg), [referral invalido mobile](architect-referrals-evidence/radar-invalid-mobile.jpg), [risultato](architect-referrals-evidence/radar-result.jpg), [osservazioni](architect-referrals-evidence/browser-observations.json).

Tutti i tab creati e i soli servizi di prova sono stati chiusi; porte loopback verificate non in ascolto.

## 7. Modifiche e documentazione verificabile

L'[inventario](architect-referrals-evidence/code-inventory.json) elenca ciascun file rispetto alla base:

- Website: 6 sorgenti di acquisizione/account/UI, test HTTP e native, tre fixture SQL attuali, relativi manifest e pin espliciti; nessuna modifica a domande o motore.
- Platform: una sola nuova candidata M4.
- Portale: collegamenti personali, contesto personale Evento preesistente selezionato, metadata/dettaglio Radar, route BFF ristrette, presentazione canonica riusata, CSS e test.
- Hub: nessun file modificato.

Nessuna dipendenza o lockfile modificato. Token, chiavi sintetiche, cookie di prova, seed Auth e log completi rimangono fuori Git. Le evidenze pubblicabili contengono metadati e dati inventati; [manifest SHA256](architect-referrals-evidence/manifest.json) e [hash dei log locali](architect-referrals-evidence/test-log-hashes.json).

## 8. Prerequisiti operativi e decisione finale

**Pronto per revisione tecnica locale; non pronto per attivazione remota/pubblica.** I link con dominio horyzon.it sono preparati nel codice, non pubblicati da questa attività.

Prima di una futura attivazione servono autorizzazioni separate e una verifica dei seguenti punti:

1. Composizione degli artefatti approvati Website/Portale/Hub rispetto ai main concorrenti e decisione esplicita sul contratto HTTP Evento v2 referral.
2. Nuovo preflight del catalogo e della catena minima, backup verificabile e prova di ripristino. Nessuna riapplicazione indiscriminata delle migration storiche.
3. Approvazione e applicazione nominativa delle sole candidate necessarie M1/M2-5D/M3-5D/M4, con controllo ACL, fingerprint P1, Event ingress e gate OFF dopo ciascun passo.
4. Supabase Auth/SMTP effettivi, casella di prova autorizzata, segreto HMAC server dedicato e verifica reale OTP, refresh, revoca. Nessuna chiave nel frontend.
5. Permessi staff nominativi Advisor e assegnazioni P1 autorizzate; nessuna autorizzazione derivata dal referral.
6. Preview protette per gli artefatti approvati, Vercel Authentication conservata, Origin esatto e progetto pilota consentito; niente Production o Shared implicito.
7. Collaudo remoto sintetico dei casi locali, delle tre viste e del mancato invio a HighLevel; verifica reale di log, rete e storage senza risposte patrimoniali.
8. Approvazioni privacy/retention e gestione dei difetti HTTP ancora aperti.

Restano **FAIL** il difetto storico ETag assente sulle risposte HTML 304 e il contratto Markdown Vary: Accept già segnalato; non ritestati né dichiarati risolti. La policy no-store della home resta quella preesistente. Ticket non inviato. Nessun GO pubblico.

Rollback proposto per una futura attivazione: chiudere il gate server/SQL, revocare le autorizzazioni di prova e ripristinare gli artefatti precedenti autorizzati; verificare immediatamente diniego Radar e disponibilità Evento/P1. Conservare audit, provenienze e assessment già salvati; nessun down distruttivo o riassegnazione automatica di contatti. Il recupero database richiede il backup/restore approvato, non è stato eseguito sul remoto.

**NOT RUN:** Auth/SMTP Supabase reali, invii email, browser Hub con operatore reale, nuove Preview, collaudo provider remoto, volontari, produzione.

**Nessun push, merge, deployment, migration remota, grant reale, invio email o modifica di produzione. HighLevel resta OFF. L'attività termina con questa consegna.**
