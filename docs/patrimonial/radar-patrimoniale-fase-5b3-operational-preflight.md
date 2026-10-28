# Radar Patrimoniale — preflight operativo 5B.3

21 ottobre 2026. **GO per review del bundle locale; NO-GO per l'attivazione identificata con servizi reali.** Il percorso Evento ristretto e il replay concorrente sono chiusi tecnicamente e collaudati. Rimane un blocco concreto di consegna/rotazione del token sul deployment immutabile, oltre alle approvazioni e configurazioni remote. Nessuna operazione di attivazione è stata eseguita.

Destinazione unica: **https://hub.horyzon.it/rete-architetti → Clienti**. Evento o Radar diretto → OTP → Radar → report privato → scheda → assegnazione P1 → HighLevel futuro. Nessun nuovo CRM, modalità anonima, report duplicato o secondo sistema di assegnazione.

## 1. Baseline, sorgenti e preservazione

Letti AGENTS.md, DESIGN.md e il report completo [5B.2](radar-patrimoniale-fase-5b2-activation-readiness.md); consultate le guide Next installate per route handler/autenticazione, le istruzioni Hub e le skill Supabase, email e Vercel CLI pertinenti.

| Repository | Baseline esatta | Commit locale codice 5B.3 |
| --- | --- | --- |
| Website | 1d5684a0a1be031ab109ec873171945f284f1022; codice precedente f5f776250925e525000dc6f4973987f11979a823 | **ce9b47c7b050126c8e982f883908d6da703cce80** |
| Hub | 39ff38b82c4a03efb4dd530b0dd47093bae25510 | **invariato: 39ff38b82c4a03efb4dd530b0dd47093bae25510** |
| Platform | 4d35e8930fbd0a6c1efede8ab6d99da6aa0abb11 | **6439bc0e94a60abf327dc335ab24d016d4db68fd** |

Worktree separati sotto:

`C:/Users/emanu/.codex/visualizations/2026/10/18/01a14e5a-6067-71a0-a210-f3859cab8329/fase-5b3/`

Sottocartelle website, hub, platform; branch locale **codex/radar-operational-5b3** in ciascun repository. Nessun merge. Hub non richiede nuove modifiche di codice. Il commit documentale Website segue quello del codice e viene indicato nella consegna, evitando un autoriferimento nel report.

Lettura GitHub finale, senza fetch o modifica dei riferimenti locali:

| Riferimento | SHA remoto osservato |
| --- | --- |
| Website main | 9146f6372b19fdac6db1770d05f6b0ca10c1f1e5 |
| Funnel | 9d5be015b4cd00ee8e77f1cadeed48ceb2534cb4 |
| Hub main | 892b1ae30dd906b40d123c739ea81a6496863ce1 |
| Platform main | e062f03a69371a9818858c227939dbc4baf8bd88 |

Invariati rispetto alla lettura iniziale 5B.3. Non sono stati integrati altri main: il collaudo riguarda le baseline richieste e le dipendenze concorrenti SQL riprodotte, non certifica ogni modifica successiva dei main.

[Preservazione originali](operational-5b3-evidence/workspace-preservation.json): HEAD/branch/diff invariati; **2772 file non tracciati Website** verificati; lavoro assegnazioni e lock Hub/Platform preesistenti conservati. Anche i worktree Radar/public-pilot precedenti risultano invariati. Nessun reset, clean, stash o commit del lavoro concorrente. Nessun processo Git concorrente rilevato ai controlli; i lock storici non sono stati rimossi. Dipendenze/build e supabase/.temp del nuovo worktree non entrano nei commit.

## 2. Blocco Evento chiuso

Implementati:

- **RemoteEventIntake** e collegamento server della route /api/public-leads. Selezione solo per Evento v2 nel contesto protected-remote approvato; default chiuso. Architetto e CV continuano sul proprio percorso, senza usare il nuovo port.
- Quarta RPC limitata **public.patrimonial_radar_runtime_event(p_request jsonb,p_consents jsonb)** nel candidato Platform **20261021203241_patrimonial_event_intake_candidate.sql**, generato tramite CLI. EXECUTE soltanto al ruolo patrimonial_radar_runtime; nessuna nuova lettura di tabelle o funzione generica del ledger.
- Payload canonico chiuso, versione/source/mode fissi, UUID v4, normalizzazione, hash ricalcolato dal DB, ricevuta pending e due evidenze di consenso coerenti. Non accetta comandi ledger, risposte finanziarie o scelta di funzioni.
- Ricevuta/richiesta, contatto amministrativo, intento provvisorio, consensi, evento e operazione outbox nella stessa transazione. Replay identico non duplica; payload diverso **409**; riferimento scaduto **410**. Nessuna compensazione o fallback CRM dopo un esito incerto.
- Continuazione opaca solo dopo persistenza confermata; riferimento nel fragment, senza email o token di sessione. OTP e conferma esplicita successivi mantengono distinta la persona verificata dal contatto.
- HighLevel OFF: l'outbox conserva SYNC_REQUEST ma non avvia un worker o una scrittura provider. Raggruppamento provvisorio per email/edizione non costituisce identità verificata o possesso della casella.

Il collaudo ha corretto due problemi nel nuovo candidato: durata replay espressa in **2160 ore**, coerente con il contratto anche al cambio d'ora; esecuzione dei due constraint trigger P1 differiti **dentro il definer**, prima del ritorno al ruolo runtime senza table grants. Il controllo P1 viene realmente eseguito, non disabilitato. Le eccezioni gestite annullano le scritture parziali.

[Inventario codice](operational-5b3-evidence/code-file-inventory.json): 20 file Website fra sorgenti, test, pin e fixture; due file Platform, candidato e gate drift; zero file di codice Hub. Motore, questionario, CSS, layout, routing generale e cache del sito non sono modificati. Aggiornati puntualmente i soli pin dei cinque sorgenti modificati e del nuovo intake dopo review/test; prove negative di preservazione conservate.

## 3. Oggetti remoti concorrenti e scheda Clienti

Lettura fresca del solo catalogo: **pmkyeqrfkunypfkbjnyg**, PostgreSQL 17.6.1.166; ultime migration fino a **20261021181255**. Il namespace privato Radar non è installato. Guardia P1 normalizzata **753e1a961d78bb0f7faf0fdd026452f9** e sei contratti Rete coincidono con la baseline verificata. [Metadati, ACL, vincoli, trigger e fingerprint](operational-5b3-evidence/remote-metadata.json).

Riprodotte tutte e sette le migration concorrenti: account_search, training_mcp, training_arena, architect_candidates, candidate_activation, **20261021173411 event_radar_contact_link**, activation_reconcile. Fixture revisionate con digest in scripts/fixtures/remote-schema-5b3; normalizzati solo LF/EOF, corpi confrontati con il remoto dal gate SQL.

Clone strutturale **circoscritto** su PostgreSQL 17.6 / PostgREST 16.5 nativi, loopback 15439/15440, database radar_5a_test. Prerequisiti identity/OAuth/Hub da migration canoniche Platform; Auth/sessioni e audit sink restano fixture sintetiche, non una copia completa di GoTrue/Storage/Audit di produzione. Nessun dato personale remoto importato.

La migration 20261021173411 conserva registrazioni amministrative e riferimenti Radar. Il parametro legacy verifiedEmail fornito dal backend **non prova** l'OTP e non autorizza Advisor. Le sue funzioni/tabelle restano inalterate; fingerprint di funzioni, RLS, ACL, vincoli e trigger introdotti dalle sette migration risultano uguali prima/dopo l'integrazione locale.

Il nuovo Evento usa contact_requests e il dettaglio Clienti canonico già predisposto. Non scrive location_ref inventati nelle registrazioni CRM legacy e non duplica un archivio. **Non serve un'altra proiezione:** architetti_client_detail espone già riferimenti/stati degli assessment collegati tramite contact_bindings; il report resta nel privato. Test: un riferimento COMPLETED inserito soltanto nella tabella legacy non crea binding, assessment canonico o autorità Advisor.

Ordine conservato: **4C.1 → alternativa Platform 5B.1R → activation 5B.2 → solo nuovo intake 5B.3**. [Bundle ordinato e digest](operational-5b3-evidence/migration-bundle.json). Il gate read-only Platform **patrimonial-radar-5b3-drift-gate.sql** è stato eseguito sul remoto: **READ_ONLY_BASELINE_GATE_PASS**, inclusi i digest dei sette corpi SQL concorrenti. Non applica DDL e non sostituisce la review completa di ACL/default grants e backup.

Controllo aggiuntivo dei privilegi ereditati da PUBLIC: **zero table grant PUBLIC e zero funzioni SECURITY DEFINER eseguibili da PUBLIC negli schemi public/hub**. L'ACL corrente dello schema public non concede USAGE a PUBLIC. [Metadati](operational-5b3-evidence/public-privileges-metadata.json). Il ruolo runtime non è stato creato sul remoto: al momento dell'applicazione ripetere il controllo, comprese eventuali funzioni INVOKER, default ACL e altri schemi raggiungibili; questo riscontro non autorizza grant generali.

## 4. OTP, credenziali e staff

Adapter Resend 5B.2 conservato. Lettura metadata: **horyzon.it verified**, sending enabled, eu-west-1, open/click tracking false; due chiavi denominate Start e Supabase Integration. Il connettore non restituisce gli scope: **non è dimostrata una chiave Radar dedicata e limitata al dominio**. Nessun valore segreto letto o allegato, chiave creata o email inviata.

Contratto proposto: sending_access e domain_id Horyzon, mittente/reply-to presidiati; contenuto OTP imposto dall'app, non un presunto scope provider «OTP-only». Verificati localmente timeout reali AbortSignal, retry singolo per 429/5xx/rete, idempotenza, diniego permanente/suppression, errori sanitizzati, cooldown/limiti DB, consumo unico, cinque tentativi, sessioni e revoche.

**Accettazione API non equivale a recapito.** Nessun webhook bounce automatico operativo; per un test breve serve approvare presidio manuale di consegna/bounce/suppression e stop/revoca, descritti nel manifest. Nessuna eccezione a Deployment Protection aperta per webhook.

**Blocco runtime aperto:** il token è breve e legato al deployment; oggi viene letto dalle env. Non è presente un canale di erogazione/rotazione sul deployment immutabile. Non basta creare un token prima del deploy o aggiornarlo con un redeploy che cambia deployment_id. Il manifest descrive autorità di firma/verifier, workload OIDC e consegna server necessari, lease/overlap/revoca e il vincolo anche sull'origine. Non dichiara un broker operativo. Una lease di 45 minuti è soltanto pianificata, non creata/installata.

Staff remoto: **quattro superadmin attivi, un solo operatore P1 attivo/network-enabled con user mapping**. Minimo reale: un amministratore specificamente approvato PERMISSIONS/IDENTITY + ASSIGN, e un consulente con ADVISOR associato al proprio operator_id. Durata proposta 45 minuti, ragione, riferimento nominativo custodito separatamente, CAS/revoca e audit. Nessun Advisor implicito dal ruolo superadmin. Nominativi/approvazioni non forniti: nessun grant reale.

A→B passa **soltanto con utenti sintetici**. Prova reale di riassegnazione **NOT RUN**, richiede un secondo consulente approvato e mappato separatamente.

## 5. Vercel verificato in lettura

| Oggetto | Riscontro fresco |
| --- | --- |
| Team | horyzon-consulting / team_LsT2CKLXy6aIHfeH9SPKpDIz |
| Pilota | horyzon-radar-pilot / prj_bJvIOswh4GacqtUootXATXeAkSUO; **Authentication ALL** |
| Hub effettivo | horyzon-hub / prj_RltJaUziQT9bOGVwWQueRb2KfEjv; hub.horyzon.it verificato; protezione all_except_custom_domains |
| Artefatto conservato | dpl_WHyLB43axP3D8H9MSqNGEYFRzdxj READY; metadato radarSourceCommit **accd6b70b498cbccb7e1dbedb551e165fa38f820** |
| Target REST | **null** nella risposta API; dato originale conservato, contesto Preview storico. Nessuna nuova creazione/promozione dedotta. |
| Accesso senza autenticazione | URL /radar-patrimoniale → **302 verso vercel.com**, nessun bypass usato |
| OIDC | attivo, issuerMode team su entrambi |
| Trusted Sources | nessuna regola dedicata dimostrata: pilota proprietà non restituita; Hub null. Non dichiarata attiva la comunicazione fra progetti. |

[Metadati sicuri](operational-5b3-evidence/vercel-metadata.json) e [protezioni](operational-5b3-evidence/vercel-protection-details.json): env soltanto nomi/scope/presenza, mai valori. Pilota con sette flag Preview esistenti e nessun Git link; Hub collegato GitHub/main, con env Production e override di altri branch Preview. Nessun override copiato. La service-role già presente nell'Hub non viene trasferita al pilota.

Configurazione futura precisa: **sul pilota**, Trusted Source source project **prj_RltJaUziQT9bOGVwWQueRb2KfEjv**, **from preview → to preview**. Nessuna autorizzazione Production/development o reciproca implicita. Header OIDC dal server Hub soltanto all'endpoint Radar pin-nato; il bearer staff e i controlli DB restano separati. Una regola progetto/ambiente copre quell'ambiente del progetto, non certifica una singola branch Preview: il pin applicativo e le autorizzazioni staff restano necessari. La [documentazione Vercel](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources) conferma il matching per progetto/ambiente e l'uso dell'header OIDC.

Analytics/Speed Insights hanno ID di configurazione su entrambi i progetti: **non sono prova dell'iniezione di script né della sua assenza**. Feedback Preview disattivato sul pilota; sul Hub non ricertificato dal solo dato omesso. Nessun browser autenticato della nuova versione remota: il controllo rete/toolbar/script dei futuri artefatti resta obbligatorio. Non sono stati modificati ALL, regole o configurazioni.

ETag HTML 304: **FAIL APERTO**. [Ticket completo e addendum](operational-5b3-evidence/vercel-ticket-addendum.md) pronti per autorizzazione separata, mai inviati. Nessun assert allentato o modifica indiscriminata a no-store/home; nessun nuovo probe 304 autenticato in questa fase.

## 6. Test effettivamente eseguiti

| Verifica | Esito fresco / limiti |
| --- | --- |
| Percorso operativo completo + replay sette migration, ruolo runtime, PostgREST, P1 e riferimenti legacy | **18 gruppi PASS**; [log](operational-5b3-evidence/native-operational.txt) |
| Amministrazione/permessi, binding, runtime, sessioni e trasporto email intercettato 5B.2 | **12 gruppi PASS** nativi; [log](operational-5b3-evidence/native-activation.txt) |
| OTP/sessioni/persistenza e boundary HTTP backend | **14 gruppi PASS** su PostgreSQL WASM/PGlite, distinto dai test nativi; [log](operational-5b3-evidence/backend-regression.txt) |
| Adapter email / timeout / retry / rate / contenuto | **5 gruppi PASS**, provider intercettato, nessun recapito reale; [log](operational-5b3-evidence/otp-transport.txt) |
| Motore, Advisor, UI, public, consolidamento, piano CRM, CV, ledger, CRM, opportunità, persistenza, remote mapping, funnel, Radar d'Impresa, readable, preservazione, presentazione Evento/Architetto | **19 suite PASS**, exit code derivati dalle esecuzioni; [elenco](operational-5b3-evidence/regressions.json) |
| Website typecheck / build | **PASS / PASS** |
| Website lint | **PASS**, 0 errori / 76 warning |
| Hub test / build | **197 PASS, 0 FAIL / PASS** |
| Hub typecheck / lint | **FAIL: 79 errori TS / 348 errori e 14 warning lint**, codice Hub identico alla baseline 5B.2; non nascosti né corretti fuori perimetro |
| Platform database | **30 PASS in 7 file**, database effimeri sul cluster locale, nessun default 5432 o remoto |
| Gate drift remoto | **PASS**, transazione read-only + rollback, nessuna applicazione |
| Browser mobile/desktop 5B.3, recapito OTP, sessioni provider reali, Trusted Sources effettiva | **NOT RUN**: nessun nuovo artefatto remoto o utente abilitato; nessun TSX/CSS/layout modificato |
| Contratto ETag HTML 304 remoto | **FAIL storico conservato**, non ritestato né risolto |

[Log build/typecheck/lint/test dei tre repository](operational-5b3-evidence/). Platform full build/typecheck non rieseguiti: questa fase modifica esclusivamente SQL/review, verificati dal replay nativo e dai test database. Non riportati i 1141 test di una fase precedente come eseguiti oggi.

Nei log allegati sono normalizzati soltanto terminatori e spazi di fine riga; esiti, conteggi e messaggi restano quelli delle esecuzioni. Gli output originali sono conservati nella directory locale fase-5b3 fuori dal bundle Git.

La matrice nativa copre Evento persistito → riferimento opaco → OTP simulato → compilazione/risultato → Clienti → assegnazione → Advisor; Radar diretto, più assessment, ambiguità, conflitti, replay concorrente, rollback, revoche e dinieghi. Una prova Advisor positiva e la revoca di sessione passano anche attraverso PostgREST con JWT firmato sintetico. La scadenza viene negata dal DB anche nella tolleranza temporale del gateway JWT; oltre tale tolleranza PostgREST restituisce 401.

**Radar d'Impresa v4 presente, 34 schermate; entrambi i funnel e tutti i 35 asset fotografici preservati.** Le prove statiche non sostituiscono il browser. PostgreSQL/PostgREST della prova sono arrestati al termine; nessun servizio remoto o app originale fermato.

## 7. Informativa, operazioni successive e decisione

[Testo completo da approvare](operational-5b3-evidence/informativa-da-approvare.md): compilazione/conservazione, accesso cliente/Advisor, Evento/richiesta, marketing separato, fornitori/dati tecnici, durate proposte e diritti. **RP-SERVICE-5A-DRAFT-1 resta non approvata**; nessun NOTICE_APPROVAL attivato. Titolare/canale diritti e basi/retention richiedono conferma umana. La review tecnica non garantisce una cancellazione automatica: retention_review_days è un promemoria di revisione.

L'unico [manifest operativo ordinato](operational-5b3-evidence/manifest-operativo.md) contiene destinazioni, comandi DDL subordinati all'autorizzazione, impatti, stop su drift, backup/restore, credenziali, regola Hub Preview→Radar Preview, minimo nominativo, prova reale e revoche. Non è un'autorizzazione implicita e non è stato eseguito.

**Decisione concreta:** intake e compatibilità delle sette migration sono pronti per review. **Non attivare la Preview identificata oggi.** Prima occorrono: canale operativo per lease/origine sul deployment esatto; chiave email dedicata e presidio bounce approvato; staff e testi/retention approvati; backup e autorizzazione SQL; futuri artefatti Preview corretti e regola OIDC collaudata. Il debito Hub rimane visibile e il FAIL ETag impedisce una dichiarazione di readiness pubblica.

Non basta cambiare sette flag sulla vecchia Preview accd6b7: non contiene questi sorgenti. Nessuna autorizzazione a push/deploy o trasformazione del sito corrente deriva da questo report.

**Zero push, merge, deployment, migration remota, grant reale, invito, email reale, credenziale creata, flag remoto, scrittura HighLevel o pubblicazione.** Fase terminata con documentazione e commit soltanto locali.
