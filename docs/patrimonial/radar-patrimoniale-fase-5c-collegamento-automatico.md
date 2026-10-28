# Radar Patrimoniale — Fase 5C: collegamento automatico

Data: 26 ottobre 2026. Ambito: **implementazione e collaudo locali**, dati sintetici. Nessuna pubblicazione, chiamata a servizi operativi, email reale o modifica remota.

## Esito e limiti della consegna

Implementato il percorso Supabase Auth con OTP email, riconciliazione automatica amministrativa, più assessment per persona, sezione Hub indipendente e consultazione degli stessi report dalla scheda Clienti. Il percorso nuovo usa Website, Hub e PostgreSQL/PostgREST esistenti. Non richiede il broker OIDC, l'ingresso PostgREST dedicato o i container 5B.4–5B.6, che restano conservati e inattivi.

**GO per la revisione locale della candidate; NO-GO per attivazione remota e pubblico.** L'Auth usata nei test è un provider sintetico con JWT e schema Auth di fixture: non è un collaudo del servizio GoTrue/Supabase reale, di SMTP, di una Preview o di volontari. PostgreSQL e PostgREST sono invece processi nativi reali. Restano gate di applicazione SQL, configurazione Auth, recapito OTP, permessi nominativi, privacy e verifica remota autorizzata. Il difetto storico ETag nelle risposte HTML 304 rimane **FAIL aperto**, senza modifica degli assert HTTP.

## Baseline, SHA e preservazione

| Repository | Baseline verificata | Commit locale di implementazione |
|---|---|---|
| Website | `fddc787630836118e47576944e252f49aff876bc` | `1ff228bad9780723a56f6433627aec00938984e6` |
| Platform | `1613c6195ed80cfd3b769096a9671ba2dcc4deff` | `ba20bc08578663e3a330e014a433445a0734a429` |
| Hub | `39ff38b82c4a03efb4dd530b0dd47093bae25510` | `abce931d47049be9998e90faa4b9b1005278c3af` |

Tutti i nuovi worktree usano `codex/radar-simple-5c`, sotto:

`C:/Users/emanu/.codex/visualizations/2026/10/18/01a14e5a-6067-71a0-a210-f3859cab8329/fase-5c/{website,platform,hub}`.

I checkout originali avevano HEAD differenti dalle baseline della fase: sono stati inventariati e preservati, senza riallinearli. Snapshot iniziale di 31 checkout preesistenti: HEAD, branch, diff binario rispetto a HEAD, stato Git, hash dei file non tracciati e presenza di index.lock. Il confronto finale li trova invariati; include i 2.772 file non tracciati nel Website originale. Non certifica byte per byte cache e dipendenze ignorate. Non sono stati usati reset, clean, stash o commit del lavoro concorrente. Il commit finale Website aggiunge il report, le evidenze e il rafforzamento delle prove di revoca/egress, senza ulteriori modifiche al runtime. Gli SHA finali documentali sono quelli della consegna conclusiva; questo documento identifica gli SHA del codice per evitare un riferimento circolare al proprio commit.

## Modello persona–contatto–assessment

| Entità | Funzione e confine |
|---|---|
| `auth.users` / `auth.sessions` | Account e sessione nativi; email confermata, account non anonimo, non eliminato o sospeso, sessione corrente non scaduta |
| `patrimonial_radar_private.persons` | Identità finanziaria stabile, UUID distinto da account, contatto e richiesta Evento |
| `account_profiles` / `account_sessions` | Collegamento account–persona e contesto della sessione; anagrafica coerente ed eventuale isolamento di una sessione ambigua |
| `public.patrimonial_contacts` | Unica scheda amministrativa compatibile: nome, email, provenienza, responsabilità; nessuna risposta o risultato finanziario |
| `contact_bindings` | Relazione versionata CANDIDATE/VERIFIED/REVOKED, senza trasferire l'archivio finanziario |
| Assessment, revisioni e snapshot privati esistenti | Un nuovo episodio per ogni nuova compilazione esplicita; i completati restano immutabili |
| `account_reviews` / `account_link_audit` | Coda dei conflitti e audit append-only delle decisioni automatiche/manuali |
| P1 esistente | Unico registro delle assegnazioni, con CAS, replay, storico e vincoli tra registro e proiezione |

Una persona ordinaria autenticata torna sullo stesso `person_id`; la nuova compilazione produce un nuovo assessment e un nuovo snapshot. Le due viste Hub leggono gli stessi `caseId`, `assessmentId`, `reportId` e revisioni. Nessun secondo archivio dei report, nessuna copia delle risposte nei contatti o nel Radar d'Impresa.

## Identificazione e riconciliazione unica

1. Nome, cognome ed email sono obbligatori. Il Website richiede il codice al servizio Auth nativo; non introduce username, password o un nuovo servizio di identità.
2. Prima di qualsiasi operazione privata il server verifica il bearer con `/auth/v1/user`. SQL verifica autonomamente utente, email confermata e `session_id` corrente; ripete il controllo prima di restituire il risultato della scrittura. Un JWT ancora formalmente valido non basta dopo la revoca SQL della sessione.
3. `account_reconcile` serializza la riconciliazione. Normalizza email con trim/lower, nomi con trim/lower/spazi; conserva punti e suffissi `+`. Nessuna ricerca approssimativa autorizza un collegamento.
4. Cerca sia l'email della scheda sia le email dichiarate nelle richieste canoniche associate: individua anche i contatti candidati con email di scheda nulla. Due schede riferibili alla stessa email impediscono l'associazione automatica.
5. Una singola scheda richiede nome coerente, assenza di binding conflittuali/revocati e provenienza attendibile. Una registrazione Evento non verificata è solo evidenza amministrativa: deve essere una richiesta canonica v2 ricevuta, con dati esatti e senza review. La verifica OTP attuale dimostra il possesso della casella; non certifica identità civile o presenza all'evento.
6. In assenza di corrispondenze crea la scheda amministrativa e il binding. La successiva registrazione Evento riusa la scheda tramite il percorso canonico già esistente.
7. Una scheda con responsabilità invalida resta in verifica; la compilazione viene conservata senza sostituire automaticamente il responsabile.

Nome discordante, più contatti, casella condivisa, email cambiata, account verificato diverso, identità OTP storica non riconciliata o binding revocato producono **Collegamento da verificare**. Non unificano persone finanziarie e non aprono report altrui. Per una sessione con identità contraddittoria viene creato un ambito finanziario isolato e vengono invalidate le sessioni Radar precedenti pertinenti alla casella in conflitto. Questo può richiedere una successiva verifica umana per recuperare lo storico: la continuità ambigua non viene risolta attribuendo vecchi dossier alla sola email.

Nessun backfill generalizzato. Il collegamento manuale amministrativo non trasferisce dossier, non cambia l'account proprietario e non riattiva implicitamente un binding revocato; il recupero di identità storiche o contraddittorie richiede una decisione documentata separata.

## Confine server minimo e sicurezza

Il motore deterministico e la validazione dei comandi restano quelli di `PatrimonialRadarService`. Una semplice RPC di completamento aperta ad `authenticated` permetterebbe di inviare risultati costruiti dal client: è quindi mantenuto il confine Node del Website esistente.

`AccountRadarRpc` presenta **sia** il JWT Auth del chiamante **sia** un HMAC-SHA256 sul comando validato, soggetto, sessione, profilo e istante. La chiave HMAC dedicata è derivata con separazione di dominio dall'identity secret applicativo; SQL conserva solo la chiave derivata in una tabella privata non accessibile a PUBLIC/anon/authenticated/service_role. La candidate non contiene né popola chiavi reali: la tabella del gate è vuota e `enabled` ha default false.

La prova server non emette JWT, ruoli o identità. SQL lega la sessione Radar alla persona risolta dal JWT: anche un HMAC valido non può sostituire l'hash della sessione di un altro soggetto. Sono ammessi soltanto i comandi Radar necessari, con scadenza dell'envelope, schema/progetto configurato e sessione Auth attuale. Nessun service-role nel browser o nelle nuove chiamate server; nessun nuovo login SQL o signer globale Supabase. L'eventuale compromissione del Website rimane un rischio da proteggere e monitorare: HMAC e controllo di possesso email non sono una certificazione dell'identità civile.

Access/refresh token sono cookie HttpOnly, SameSite Strict e Secure/host-only fuori dalla fixture locale. Profilo e challenge sono cifrati con AES-GCM; Origin e CSRF restano verificati. Refresh usa il servizio Auth nativo. Le risposte e i dossier rimangono in memoria del componente durante la consultazione, senza localStorage/sessionStorage finanziario. Hub cancella il dossier su cambio sessione, chiusura e perdita di visibilità/focus; scarta le risposte asincrone obsolete. Una revoca impedisce nuove letture; non può richiamare dati già visualizzati su un dispositivo autorizzato.

La rotazione del secret applicativo richiede una procedura controllata per il binding del vecchio store, i cookie e il gate HMAC. Non è stata eseguita e non equivale al rinnovo ordinario di un JWT Auth. Non si usano chiavi globali di firma del progetto.

## Hub, Clienti e P1

Ripristinata la route interna `/radar-patrimoniale` e la voce autonoma nella sidebar, separata da Radar d'Impresa e Rete Clienti. La lista mostra soltanto nome/email, data, stato, origine del Radar, richieste Evento correlate senza dedurne presenze, responsabile, numero di compilazioni e review.

Sono presenti Tutti, Da assegnare, Assegnati, Completati, In corso, Collegamento da verificare; filtri email, date e responsabile. Lo storico mostra schede delle compilazioni e responsabilità nel tempo. Controlli di gestione sono subordinati ai permessi restituiti; ogni apertura del report richiede comunque una nuova autorizzazione SQL.

`hub.patrimonial_radar_simple_command` riusa la fondazione e i grant patrimoniali espliciti. La coda indipendente non richiede un binding Clienti per gestire una pratica. Nella scheda Clienti, il dettaglio esistente mantiene eventi, partecipazioni, revisioni e assegnazioni e mostra i Radar solo attraverso binding verificati. Anagrafica, attività, follow-up e riferimenti CRM dell'attuale Rete non vengono riscritti.

Le due viste condividono il componente di presentazione `CanonicalDossier`: legge l'analisi già salvata, con etichette riutilizzate dal formatter Advisor esistente, senza eseguire un secondo motore diagnostico. Indicatori, unità, evidenze e domande di approfondimento provengono dal risultato approvato. I controlli e gli altri componenti Advisor storici restano conservati.

Per una scheda verificata, assegnare/riassegnare/rilasciare usa `assign_contact` e `network_assign_intents` esistenti, aggiornando P1 per i Radar pertinenti. Un Radar successivo conserva un responsabile corrente valido. Senza binding si riusa l'assegnazione P1 della fondazione. `account_staff_receipts` aggiunge solo idempotenza al comando composito di collegamento, non un secondo registro di assegnazioni.

Advisor richiede grant `RADAR_PATRIMONIAL_ADVISOR`, operatore attivo, sessione Hub corrente e assegnazione P1 effettiva. LIST, ruolo superadmin, email uguale o semplice assegnazione non sostituiscono il grant Advisor. Riassegnazione A→B nega immediatamente nuove letture ad A. La revoca di un binding distacca soltanto i Radar della persona, ne rilascia le responsabilità tramite P1 e conserva il responsabile delle altre attività della scheda commerciale.

## File e candidate SQL

Website: tre nuovi moduli `account-config.ts`, `account-http.ts`, `account-rpc.ts`; dispatch della API esistente; ramo pagina e campi nome/cognome; tre verificatori 5C; manifest di preservazione aggiornati puntualmente.

Platform: sola candidate [`20261026123529_patrimonial_radar_simple_auth.sql`](../../../platform/packages/database/pending/20261026123529_patrimonial_radar_simple_auth.sql). Nome generato con `supabase migration new`, conservato in `packages/database/pending`, non applicato a remoto. Richiede le candidate fondazione precedenti e pgcrypto esistente: non sposta l'estensione né modifica migration applicate. Le tabelle nuove hanno RLS/FORCE e nessun accesso diretto del browser; espone due RPC limitate per il cliente e lo staff. La modifica al trigger di ricezione è circoscritta alle persone gestite dal nuovo percorso.

Hub: sidebar, route interna, dettaglio Clienti; nuovi lista/storico e dossier condiviso; client RPC e sole etichette di presentazione. Nessuna funzione di sincronizzazione HighLevel aggiunta.

Gli aggiornamenti dei manifest fissano l'intero contenuto dei file autorizzati, compresi i nuovi moduli server; non escludono directory dai controlli. [Revisione dei pin](automatic-linking-5c-evidence/source-pin-review.json). Motore, 40 domande, asset, funnel, schema applicato e file storici restano sottoposti ai controlli di preservazione.

## Prove effettivamente eseguite

Evidenze: [risultati](automatic-linking-5c-evidence/results.json), [native](automatic-linking-5c-evidence/native-result.json), [browser](automatic-linking-5c-evidence/browser-result.json), [preservazione](automatic-linking-5c-evidence/preservation-all-result.json).

| Prova | Esito e ambito |
|---|---|
| PostgreSQL 17.6 / PostgREST 16.5 nativi | **PASS 25 gruppi**, database isolato loopback `15439/15440`, Auth/schema/JWT sintetici |
| 17 scenari obbligatori | Coperti: nuovo utente, Evento→Radar, secondo Radar, Radar→Evento, ambiguità, nomi, casella condivisa, concorrenza, replay, anonimo negato, isolamento A/B, Advisor negato/autorizzato, riassegnazione, viste coerenti, HighLevel OFF; preservazione Impresa verificata anche dalla suite dedicata |
| Prove aggiuntive 18–25 | Replay P1 e payload differente, CAS obsoleto, email non confermata, Auth scaduta/revocata, gate chiuso, link/unlink di una pratica assegnata con audit/replay e conservazione del responsabile commerciale, responsabile inattivo, ACL dirette, sostituzione di sessione con MAC valido negata, scadenza Auth durante scrittura con rollback, secondo Radar conserva P1 e storico |
| Browser Chrome desktop 1440×1000 / mobile 390×844 | **PASS 6 percorsi**; frontend Website reale e componenti Hub reali in harness con identità sintetica; API e database locali reali |
| Browser: compilazione | Nome/cognome/email, OTP simulata, intero percorso applicabile con Non so/Preferisco non rispondere, completamento e risultato; cookie HttpOnly e assenza di risposte nello storage browser |
| Browser: due viste | Dossier aperto dalla lista e da Clienti con **uguaglianza dell'ID snapshot**; nessun overflow orizzontale alle due larghezze; screenshot ispezionati |
| Egress del browser | Nessun tentativo di richiesta esterna ammesso; nessuna chiamata CRM/HighLevel/email operativa; la sola email del collaudo è una inbox in memoria |
| Contratti 5C / gate | **PASS** default chiuso, origin e progetto ammessi, fallback storico, motore e asset preservati |
| Website build / typecheck | **PASS**; primo tentativo build nel sandbox bloccato dalle junction Windows, ripetizione con permessi locali riuscita |
| Website lint | **PASS**, 0 errori / 76 warning preesistenti |
| Hub build | **PASS**; warning/deprecazioni storiche di TanStack presenti nel log |
| Hub test esistenti | **197 PASS**, 918 assert, 26 file |
| Hub typecheck globale | **FAIL storico**, 79 errori identici riga per riga alla baseline; nessun errore aggiunto nei file 5C. [Confronto](automatic-linking-5c-evidence/hub-typecheck-comparison.json) |
| Hub lint mirato | **PASS**, 0 errori / 2 warning sui ref di invalidazione asincrona |
| Hub lint globale | **FAIL**, 348 errori / 15 warning; debito globale fuori dalle modifiche 5C, nessun errore nei file modificati |
| Radar d'Impresa | **PASS** suite `test:radar`, incluso assert delle **34 schermate v4**; sorgenti del dominio preservate |
| Radar patrimoniale | **PASS** engine, projection, Advisor, backend e UI; backend storico comprende 14 gruppi SQL/WASM e HTTP loopback, distinto dalle nuove prove native |
| Funnel e acquisizione | **PASS** patrimonial, funnels, presentazione Evento/Architetto, CV obbligatorio, ledger, CRM, opportunità, persistenza, remote mapping e assignment management |
| Foto attuali | **35/35 preservate**; test di presentazione verificano anche temi e asset finali |
| ETag HTML 304 | **FAIL storico conservato**; non ritestato su una nuova Preview, nessun ticket inviato |

I primi tentativi di alcune suite fallivano sui pin dei file autorizzati o per le socket negate dal sandbox; i controlli sono stati ripetuti dopo la revisione puntuale dei pin e, per il backend loopback, con permessi locali. Non sono stati cancellati assert per ottenere PASS. Il dettaglio del lint Hub globale è riportato nel riepilogo delle evidenze.

La prova browser Hub monta i componenti effettivi con trasporto Supabase verso PostgREST locale, ma non collauda il login reale, il router completo o le policy del gateway Supabase remoto. Le immagini usano esclusivamente dati inventati. Esempi: [mobile identificazione](automatic-linking-5c-evidence/mobile-identity.png), [mobile Hub](automatic-linking-5c-evidence/mobile-hub.png), [desktop Clienti](automatic-linking-5c-evidence/desktop-client.png).

## Componenti necessari e componenti esclusi dal primo rilascio

| Componente | Decisione 5C |
|---|---|
| Account Supabase Auth / OTP email | Necessario; username/password personalizzati esclusi; SMTP e configurazione da autorizzare/verificare |
| Archivio privato / motore / snapshot | Riutilizzati; nessuna nuova fonte di verità finanziaria |
| P1 / grant Advisor / Auth Hub | Riutilizzati obbligatoriamente |
| Riconciliazione Evento/Radar | Funzione SQL unica, automatica solo quando coerente e univoca |
| Next server / HMAC del comando | Necessario per attestare il risultato del motore; confine ristretto nell'applicazione esistente |
| Broker OIDC / chiavi ES256 di issuer custom | Esclusi da questo percorso, conservati inattivi |
| Ingresso PostgREST aggiuntivo / container | Esclusi da questo percorso; il client usa il gateway nativo con JWT Auth e RPC ristrette |
| PoP esclusivo per artefatto della soluzione 5B | Non usato per il percorso Auth nativo; il requisito irrisolto 5B non viene dichiarato dimostrato o sbloccato |
| HighLevel / nuove pipeline commerciali | Non necessari per salvataggio o gestione; restano disattivati e senza scritture |

## Operazioni ancora necessarie e responsabilità

Tutte le operazioni remote seguenti richiedono nuova autorizzazione. Nessuna è stata eseguita.

1. **Referente tecnico/database:** verificare bundle e ordine delle candidate precedenti, drift dello schema reale, firme RPC, Auth schema effettivo, pgcrypto, ACL e rollback. Approvare l'applicazione limitata e il collaudo con dati sintetici; non applicare backfill a clienti esistenti.
2. **Referente sicurezza:** approvare custodia del secret applicativo e provisioning del solo gate HMAC privato, rotazione/revoca, monitoraggio senza payload e dati di audit. Consegna dei valori soltanto tramite canale segreti approvato, mai chat, Git, argomenti CLI o log. Il gate rimane disabilitato fino alla verifica.
3. **Responsabile Auth/email:** approvare Supabase OTP, conferma email, durata del codice, restrizioni di signup previste per il pilot, SMTP, limiti di invio/abuso e origin/redirect. Verificare refresh, logout e sessioni revocate sul provider/gateway reale. Non usare il controllo UI del codice come prova del recapito effettivo.
4. **Responsabile Hub:** approvare account nominativi, mapping operatore e grant patrimoniali minimi con scadenza; provare nel vero Hub due operatori, assenza del grant Advisor, riassegnazione e accesso dalle due sezioni. Rigenerare i tipi dal solo schema approvato; risolvere/gestire esplicitamente il debito storico di typecheck/lint.
5. **Referente privacy/editoriale:** approvare informativa di persistenza, finalità e base del trattamento, conservazione/cancellazione, dati tecnici di accesso, destinatari e gestione delle richieste. Nessuna attestazione legale certificata è resa da questa fase.
6. **Referente rilascio:** solo dopo i punti precedenti, autorizzare una Preview protetta esatta con il percorso account e l'origin corretti. `PATRIMONIAL_RADAR_ACCOUNT_ENABLED` resta assente/false sui remoti in questa fase. Sono necessari publishable key e identity secret server, mai `NEXT_PUBLIC_*`; in locale si usa soltanto il contesto `local-test`, negato su Vercel. Non servono nuovi progetti o infrastrutture per dimostrare il percorso.
7. **Collaudatore autorizzato:** ripetere su Preview login/OTP reali autorizzati, HTTPS/Secure cookie, refresh, CSRF, ACL, concorrenza, assenza di script che raccolgano risposte, storage e log; verificare router Hub e funzionamento dei due ingressi senza harness. Primo test umano e accesso esterno richiedono identità e approvazione separate.
8. **Prima del pubblico:** chiudere o decidere formalmente il difetto ETag 304, completare le approvazioni privacy, verificare compatibilità col main allora corrente e preservazione di `/radar`. Nessun GO pubblico viene dedotto dal solo collaudo locale.

**Rollback previsto:** chiudere prima il gate 5C e il flag applicativo, revocare sessioni/grant del pilot, tornare al codice precedente approvato senza cancellare persone, assessment, snapshot o audit. Conservare schema e dati per analisi; qualsiasi rimozione di RPC/trigger candidate deve essere revisionata rispetto ai dati creati e alle dipendenze. Non modificare responsabilità commerciali o dati dei clienti per ripristinare una UI. Nessuna procedura di rollback è stata eseguita in remoto.

## Riproduzione locale

La harness è strettamente confinata al database sintetico loopback dichiarato. Non passare URL o credenziali reali.

```text
node --no-warnings --experimental-strip-types scripts/verify-patrimonial-simple.mjs
  --network-platform=<worktree-platform>
  --pg-module=<modulo-pg-locale>
  --local-config=<fixture-locale-15439-15440>
  --candidate=<candidate-20261026123529>
  --evidence=<cartella-evidenze-fuori-Git>

node --no-warnings --experimental-strip-types scripts/verify-patrimonial-simple-browser.mjs
  --evidence=<stessa-cartella-fixture>
  --hub=<worktree-hub>
  --pg-module=<modulo-pg-locale>
  --playwright=<modulo-playwright-locale>

node --no-warnings --experimental-strip-types scripts/verify-patrimonial-simple-contract.mjs
```

La prima prova ricrea solo il database sintetico esplicitamente fissato. Il browser usa porte 17820–17822, chiude i propri server e conserva fuori Git le sole credenziali sintetiche di fixture. Non usare la harness su produzione. In Git sono raccolti soltanto report, risultati depurati, log consentiti e screenshot sintetici.
