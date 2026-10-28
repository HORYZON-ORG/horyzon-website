# Evento v2 → registrazione → Radar → architetto assegnato

Report conclusivo locale — 27 ottobre 2026, Europe/Rome.

**PASS: il percorso HTTP Evento v2 → registrazione canonica → Radar con email verificata → architetto assegnato è finalmente dimostrato su servizi locali nativi.**

L'iscrizione della nuova prova attraversa il vero `POST /api/public-leads` del server Next in esecuzione. Nessuna chiamata diretta SQL sostituisce l'iscrizione HTTP; nessun POST viene intercettato o simulato. Le query del verificatore preparano identità/operatori sintetici e leggono le evidenze. PostgREST e PostgreSQL eseguono il codice SQL candidato chiamato dall'applicazione.

La precedente limitazione del [report referral](radar-patrimoniale-architect-referrals.md), §5, è chiusa **localmente**. Nulla è stato attivato sul remoto.

## Baseline e commit

Nuovi checkout indipendenti Website e Platform:

`C:/Users/emanu/.codex/visualizations/2026/10/18/01a14e5a-6067-71a0-a210-f3859cab8329/event-v2-radar/`

Branch: `codex/event-v2-radar`. Il collegamento locale `architetti` punta alla baseline precedente soltanto per importare il helper puro dei link nei test; nessun codice portale o Hub modificato.

| Repository | Baseline verificata | SHA codice finale |
| --- | --- | --- |
| Website | `3e835566bbcb34dbb47e4d5447381754127ec590` | `1eacda6cba665cb82363c31b293ab10ef1564eda` |
| Platform | `d3cbcb517e5b992fe26529398b0ceb40f06cc6a5` | `d57f3a47f88c4b26dd2b21f4e7758fb67bee3811` |
| Architetti | `e84f91804a8a529e351f7eb54df9933cb3031530` | invariato |
| Hub | `0f65332ef3e7f38938320f49ec79f0df6dcd4d93` | invariato |

Il successivo commit documentale Website è indicato nella consegna finale, evitando un hash autoreferenziale nel report. [Inventario file e SHA](evento-v2-radar-evidence/code.json).

AGENTS.md, DESIGN.md, report precedente e guide Next 16.3.5 locali consultati. Le baseline coincidono con gli HEAD iniziali; nuovi HEAD remoti non sono stati interrogati in questa attività. **43/43 checkout preesistenti censiti invariati** per HEAD, branch, diff, stato e hash dei file non tracciati. Le cache ignorate non sono comprese in tale certificazione. [Conservazione](evento-v2-radar-evidence/preservation.json).

## Correzione circoscritta

### Contratto e form

`referralCode` è ora un campo opzionale del solo Evento v2:

- Esattamente 32 caratteri esadecimali minuscoli. Null, vuoto, formato errato, parametri URL duplicati e campi operator_id arbitrari sono rifiutati.
- Il form acquisisce `?ref=` e lo conserva in memoria durante i due passaggi; la query consente di recuperarlo al reload. Nessun nuovo storage delle risposte o dei dati del form.
- Il codice partecipa all'hash canonico e all'idempotenza. Una richiesta già ricevuta con un codice diverso restituisce 409.
- Le richieste senza codice conservano il precedente payload canonico/hash. Il validatore 2A e il ramo legacy rimangono invariati.
- Se il form non è abilitato a v2, un link personale viene fermato con un messaggio esplicito: nessuna iscrizione legacy implicita.
- Origin, JSON, limite del body, honeypot, rate guard e corrispondenza dell'Idempotency-Key rimangono operativi.

La landing riconosce il percorso account nativo già approvato, con i gate server esistenti. `connection()` viene usato **soltanto sulla pagina Evento** per valutare tali gate al runtime, evitando una versione del form congelata durante il build. URL e cookie non abilitano il contratto.

Il percorso runtime storico incapace di salvare la provenienza referral risponde 503 prima dell'acquisizione: non perde il codice e non ripiega sul CRM.

### Acquisizione atomica senza HighLevel

Il durable store seleziona la nuova RPC ristretta `public.acquire_patrimonial_event_referral_v2(jsonb,jsonb)` soltanto per una richiesta Evento v2 riferita e con `HORYZON_HUB_EVENT_INGRESS_ENABLED=true`. Senza tale autorizzazione locale/configurazione, il percorso è chiuso.

Nella stessa transazione la RPC:

1. Richiama l'acquisizione v2 esistente, mantenendo ledger, ricevuta, consensi, intent provvisorio e outbox.
2. Legge la richiesta canonica acquisita, senza accettare un operatore dal client.
3. Valida il codice attraverso `architetti_private.validate_referral`, verificando anche il binding all'UUID utente dell'operatore e mantenendo il lock/controlli di attività.
4. Invoca `public.architetti_event_ingest`, quindi il referral/resolver già installati, per registrazione, provenienza e responsabilità.
5. Annulla tutto se validazione o registrazione falliscono. Nessuna ricevuta 202 viene emessa su un salvataggio parziale.

Non è stato duplicato il sistema referral. La logica di assegnazione rimane nell'ingresso esistente; il successivo Radar usa la riconciliazione Auth e P1 già collaudati. Nessun nuovo codice, registro referral, motore diagnostico o archivio finanziario.

Il namespace identità **website-v2** distingue il request UUID Website dai riferimenti HighLevel. Non vengono inventati Contact ID HighLevel. L'outbox canonica resta pending con i worker CRM disattivati; nessuna chiamata CRM è necessaria per completare il percorso.

Il replay di una ricevuta già acquisita non riassegna il contatto e resta recuperabile anche dopo revoca del codice. Una nuova iscrizione con codice revocato viene negata. Un cliente già di B mantiene B anche arrivando dal link A.

## Candidata SQL e impatto dichiarato

Unica nuova candidata:

`platform/packages/database/pending/20261027080238_patrimonial_event_v2_referral.sql`

**SHA256 UTF-8 LF:** `31fbc20426c1892f50d33791fe4756df49b82fcbef72480103367ed23dbacff1`.

Nome generato con Supabase CLI; file soltanto locale e pending. [Catena e hash](evento-v2-radar-evidence/migration-chain.json).

La candidata viene dopo M1, M2-5D, M3-5D e M4, tutti invariati. I tre DDL referral/personali già installati restano prerequisiti delle fixture: non sono nuove migration da riapplicare.

Impatto puntuale, da riesaminare prima di qualsiasi applicazione reale:

| Oggetto | Modifica |
| --- | --- |
| `architetti_private.ingest(jsonb)` | Provider esplicito website-v2 oppure default highlevel; stesso resolver, identità, replay e audit |
| `architetti_private.ingest_event(jsonb)` | Propaga il provider server al resolver; omette la nuova chiave nel vecchio percorso per preservarne gli hash |
| `architetti_private.ingest_event_referred(jsonb)` | Accetta/propaga il namespace e lo usa nella ricerca del riferimento preesistente; stessa logica referral |
| CHECK provider di `patrimonial_contact_external_refs` | Ammette soltanto highlevel e website-v2 |
| Nuova RPC di acquisizione | SECURITY DEFINER, search_path pg_catalog, EXECUTE soltanto service_role |

Le tre funzioni condivise **sono modificate**, non dichiarate innocue: preflight con fingerprint esatti impedisce l'applicazione su definizioni divergenti. Il CHECK viene sostituito e rivalidato, con lock_timeout di cinque secondi; il costo su una tabella remota popolata richiede una futura valutazione autorizzata.

Nessuna migration già applicata riscritta. Nessun trigger aggiunto al ledger, nessuna modifica M5 alle funzioni P1, nessun backfill, nuovo ruolo, grant generale, USAGE public per anon/authenticated o modifica RLS. Le ACL delle funzioni esistenti sono conservate. [Catalogo finale verificato](evento-v2-radar-evidence/catalog.json).

## Prova HTTP effettiva

Database PostgreSQL 17.6 e PostgREST 16.5 nativi, indipendenti e sul loopback. Server Next avviato dal build reale. Auth GoTrue simulato sul loopback con utenti .invalid, sessioni/JWT sintetici e OTP di test; nessun provider email contattato.

| Caso | Esito |
| --- | --- |
| Link A → landing v2 reale → POST HTTP → registrazione | **PASS** |
| Persistenza referral_code, referred_operator_id, attribution_status | **PASS**, ASSIGNED_NEW per il nuovo contatto |
| Stessa email verificata → Radar completato → stessa anagrafica e P1 A | **PASS**, tramite API HTTP account e Radar reali |
| Secondo Radar | **PASS**, stesso contatto, due assessment/report e hash del primo preservato |
| Cliente B → iscrizione HTTP dal link A → Radar | **PASS**, B mantenuto, A negato |
| Codice invalido, revocato o operatore disabilitato/non collegabile | **PASS**, 503; nessun contatto, ledger o registrazione parziale |
| Due richieste HTTP concorrenti | **PASS**, due registrazioni e un solo contatto/proprietario |
| Replay e codice cambiato | **PASS**, replay unico e conflitto 409 |
| Proprietario senza Advisor | **PASS**, metadati consentiti, dossier negato |
| HighLevel OFF | **PASS**, nessuna configurazione/trasporto HighLevel utilizzato |
| Origin errato, honeypot, chiave incoerente, operatorId arbitrario | **PASS**, negati |
| Gate chiuso o vecchio intake non compatibile | **PASS**, nessuna acquisizione/fallback |

L'[evidenza HTTP](evento-v2-radar-evidence/http-chain.json) include gli identificativi canonici sintetici e i contatori dei percorsi PostgREST effettivamente attraversati. La nuova RPC è chiamata dall'adapter Website sul percorso HTTP; non direttamente dal test per simulare un'iscrizione.

I 56 casi storici restano invariati e comprendono anche fixture SQL di regressione: non sono presentati come sostituti della nuova prova HTTP. La suite estesa è **68/68 PASS**. [Risultati nativi](evento-v2-radar-evidence/native.json).

### Browser reale

Dal link personale sintetico sono stati compilati i due passaggi del form, con nome/email inventati e senza intercettare il POST. Il browser è arrivato a `/benessere-patrimoniale/evento/grazie`.

Una lettura separata del database ha confermato una sola registrazione, i tre campi referral, ASSIGNED_NEW e il responsabile del link. [Evidenza browser e registrazione](evento-v2-radar-evidence/browser.json).

![Ricevuta del modulo reale, ambiente locale sintetico](evento-v2-radar-evidence/event-http-received.jpg)

La compilazione completa Radar è stata eseguita dalla suite attraverso HTTP; questa prova browser aggiuntiva riguarda il form Evento. Non sono stati coinvolti volontari. Nessun audit completo del traffico/storage browser è dichiarato.

## Regressioni e qualità

| Controllo | Esito |
| --- | --- |
| Website | **19/19 suite PASS finali** |
| Radar d'Impresa v4 | **PASS**, 34 schermate preservate |
| Funnel/presentazioni Evento e Architetti | **PASS**, 35 asset preservati |
| Ledger, CRM, opportunità, persistenza, mapping, assegnazioni | **PASS** |
| Verificatore 5D originale | **4/4 PASS**, file invariato |
| Website build / typecheck / lint mirato | **PASS / PASS / PASS**, lint 0 errori e 0 warning |
| Hub invariato | **201 test PASS**, 941 assert, 27 file |
| Portale Architetti invariato | **56 test PASS**, 13 file; **50 assert PostgreSQL PASS** |
| P1 e trigger ledger dopo M5 | **PASS**, confronto esplicito con la baseline del rehearsal |
| Checkout preesistenti | **43/43 invariati** |

Home ancora statica: HTML 90.149 byte e Markdown 5.796 byte, stessi valori precedenti. Nessuna modifica a layout condivisi, CSS, tipografia o funnel di candidatura.

Aggiornati soltanto pin espliciti dei file modificati. Il verificatore di presentazione normalizza una sola riga esatta, vincolata a Evento v2, per includere il nuovo campo: il confronto originale del trasporto condiviso CV/attempt/timeout e del ramo Architetti rimane attivo, insieme al pin dell'intero sorgente. Nessun assert comportamentale eliminato. Il corpo del validatore 2A è invariato. [Revisione dei pin](evento-v2-radar-evidence/source-pin-review.json).

Sono conservati esiti iniziali e retry: il backend ha incontrato EACCES del sandbox sulla propria porta locale ed è passato con gli stessi assert; il portale ha avuto un blocco della cache temporanea e poi un timeout sotto carico concorrente, seguito da un giro completo PASS a carico ridotto. Il primo avvio HTTP era anticipato rispetto al build; il primo vero POST ha individuato un nome variabile SQL ambiguo, corretto. Le fixture degli operatori sono state corrette rispettando i vincoli P1 esistenti.

Build/lint/typecheck Hub e portale non ripetuti, poiché il loro codice è invariato. Restano visibili gli errori globali Hub storici: 82 typecheck, 513 errori/15 warning lint; restano i tre warning lint del portale nella baseline precedente, non dichiarati risolti.

[Regressioni](evento-v2-radar-evidence/regressions.json), [5D](evento-v2-radar-evidence/original-5d.json), [note esecuzione](evento-v2-radar-evidence/execution-notes.json), [hash log](evento-v2-radar-evidence/log-hashes.json), [manifest evidenze](evento-v2-radar-evidence/manifest.json). Log completi, fixture Auth, token e segreti sintetici restano fuori Git.

## Stato finale e limiti

**PASS locale per l'obiettivo HTTP completo richiesto. NO-GO per un'attivazione remota/pubblica in questa attività.**

Rimangono necessari i prerequisiti operativi 5D già documentati: backup/restore verificati, revisione della catena minima sul catalogo reale, autorizzazione della nuova candidata e degli artefatti, Auth/SMTP reali, HMAC server e permessi staff nominativi, Preview protetta e collaudo remoto con account autorizzati. Nessuno di questi passi viene eseguito qui.

Il difetto storico ETag assente in HTML 304 resta **FAIL**, così come il precedente problema Markdown Vary: Accept; non ritestati, risolti o aggirati. La policy no-store della home resta preesistente. Nessun GO pubblico e nessun ticket inviato.

Un futuro rollback deve chiudere i gate server dell'ingresso e ripristinare l'artefatto autorizzato precedente, conservando ricevute, riferimenti website-v2, audit e report. Non restringere nuovamente il CHECK a highlevel se esistono righe website-v2; nessun down distruttivo o riassegnazione di clienti proposto.

Il tab di prova è chiuso. Le porte 15449/15450/15451/15452 sono state verificate non in ascolto dopo lo spegnimento dei soli servizi di questa attività.

**Nessun push, merge, deploy, migration/grant remoto, invio email, creazione di credenziali reali o modifica di produzione. Nessuna nuova fase architetturale avviata.**
