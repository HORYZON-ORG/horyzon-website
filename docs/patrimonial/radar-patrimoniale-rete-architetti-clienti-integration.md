# Radar Patrimoniale — scheda unica Clienti nella Rete Architetti

Fase 5B.1R, 21 ottobre 2026. **Integrazione locale collaudata; attivazione sui dati reali NON autorizzata e NON eseguita.** Destinazione definitiva: `https://hub.horyzon.it/rete-architetti`, sottosezione **Clienti** dell'esistente `NetworkWorkspace`. Nessun secondo archivio amministrativo; nessun uso del Radar d'Impresa per i dossier patrimoniali.

## 1. Fonti canoniche e stato verificato

| Repository | Base 5A conservata | Remoto letto durante il preflight 5B.1R |
| --- | --- | --- |
| Website | `435747b7592b85b66c482ab22eaf0736de3a07bd` | main `9146f6372b19fdac6db1770d05f6b0ca10c1f1e5`; funnel `cc15e5d0731a8227eac2a3df39d7e7b0e2242ac3` |
| Hub | `f9b401642c249aecacbd4a817dd0d4aaa1322071` | main `b3a3a8439020e614659c5525e406c7c0d5b73054`, successivo al riferimento utente `61eb27e` |
| Platform | `3c885eb87b5aa2e80413c5cd0d2571dcf2a96fc5` | main `78eb49e709938fe287723d340e88a2ffd8855b67` |

L'archivio amministrativo è **`public.patrimonial_contacts`**, definito nella fonte Platform immutabile `packages/database/pending/0056_architetti_workspace.sql`. Il dossier finanziario resta nella persistenza privata 4C; `persons.id` identifica la persona Radar e NON coincide per assunzione con `patrimonial_contacts.id`. Il journal **P1** resta l'unico registro delle assegnazioni. HighLevel resta una proiezione futura.

Preflight Supabase Horyzon `pmkyeqrfkunypfkbjnyg` eseguito con transazioni **read only**, interrogando esclusivamente metadati e migration history: presenti contatti, assegnazioni, `hub.architetti_snapshot(text)` e `hub.architetti_command(text,jsonb)`; assenti `patrimonial_radar_private.persons` e `hub.patrimonial_radar_permissions`. Confermate le colonne provider `auth.users.id/deleted_at/banned_until` e `auth.sessions.id/user_id/not_after`; nessuna loro modifica.

History remota pertinente: `20261014215416` lead v2; `20261015101816` precedence; `20261018184007` P1; `20261018184045` owner sync; `20261018184114` capabilities; `20261018205124` performance; **`20261020184209 / 0056_architetti_workspace`**; `20261021101555` ricerca account; `20261021150003` training MCP; `20261021165945` training arena. Guardia P1 installata: fingerprint `753e1a961d78bb0f7faf0fdd026452f9`; tipi di pratica esistenti `PROVISIONAL`, `OPPORTUNITY`, `HORYZON_OPPORTUNITY`.

La candidata 5A originaria avrebbe sostituito i vincoli con un insieme privo di `HORYZON_OPPORTUNITY` e cercato una diversa guardia P1. **Non va riprodotta sul database con 0056.** È stata preparata una candidata alternativa Platform, `20261021171340_patrimonial_network_foundation_candidate.sql`: conserva i contratti e l'implementazione privata 5A, unisce i tipi della Rete e RADAR, aggiunge binding/RPC/trigger, senza ricreare contatti o riscrivere SQL applicata.

Percorso candidato verificato: baseline P1/P2B/performance → 0056 → candidata Website 4C.1 `20261018191940_patrimonial_radar_identity_sessions.sql` → **alternativa Platform 5B.1R**. La 5A `20261020134559` e la correzione primo Evento `20261020165515` rimangono disponibili per il percorso storico locale: **non applicarle anche dopo l'alternativa**, che incorpora quella correzione. Nessuna applicazione remota o history repair.

## 2. Binding e riconciliazione

`patrimonial_radar_private.contact_bindings` collega UUID distinti con stato `CANDIDATE/VERIFIED/CONFLICT/REVOKED`, evidenza, revisione CAS, storico immutabile e unicità del collegamento verificato per persona e scheda. Revoca terminale; scritture e letture dossier sono serializzate con la stessa barriera P1. Nessun permesso diretto alle tabelle per browser/anonimi.

- **Evento → Radar:** richiesta canonica → scheda amministrativa → riferimento opaco temporaneo → OTP → proposta candidata → conferma esplicita → binding verificato → assessment della stessa persona/scheda. L'uguaglianza dell'email non concede accesso finanziario.
- **Radar diretto:** dopo OTP e creazione dell'assessment proprio viene creata una scheda nuova, senza cercare vecchi clienti per hash/email. Nome provvisorio `Persona Radar …`, recapiti amministrativi da completare. Il binding documenta possesso casella e contesto dell'assessment, non certifica l'identità anagrafica.
- **Più assessment:** una persona e una scheda verificata; episodi e snapshot separati, senza sovrascrivere lo storico.
- **Ambiguità:** email/nome/telefono discordanti, collisioni, casella condivisa o altra scheda già verificata restano in review. Nessuna fusione automatica. Anche il percorso inverso Radar diretto → nuova scheda Evento richiede review: la conferma non viene falsamente dichiarata verificata.
- Prima di interrogare gli impedimenti alla conferma viene autenticata la sessione della persona: un chiamante senza sessione non può sondare riconciliazioni altrui.

La review amministrativa di casi ambigui, l'approvazione di un'eventuale unificazione e la gestione delle revoche reali richiedono una procedura e un canale privilegiato approvati separatamente. Questa fase rende visibili gli stati e impedisce l'apertura indebita; non introduce un pulsante di fusione o un provisioning di permessi.

## 3. UI Clienti modificata

Riutilizzati elenco e dialog dell'esistente `NetworkWorkspace`, con ricerca, assegnazione e questi filtri: Tutti; Da assegnare; Assegnati; Evento senza Radar; Radar in corso; Radar completato; Collegamento da verificare. La lista contiene metadati amministrativi e contatori, mai importi, risposte o risultati finanziari.

La scheda mostra anagrafica e provenienza; possesso casella/binding; richieste ed edizioni Evento con stato effettivo; assessment con date, revisione e snapshot approvato; apertura separata del dossier; responsabile corrente e storico P1; prossimo passo, cronologia e pianificazione di un follow-up operativo. Un lead rimane `prospect`: viene chiamato cliente acquisito solo secondo il contratto esistente, non perché ha compilato il Radar.

Nuovo `ClientRadarDetails.tsx`: legge metadati da `hub.architetti_client_detail(uuid)` e richiede separatamente la proiezione Advisor attraverso il trasporto 5A. Dossier solo in memoria del componente; pulizia al cambio utente/contatto/revisione e alla chiusura; richieste tardive invalidate. Nessun dossier in Query cache o storage browser. La vista riusa lettura e agenda 4D; non introduce formule o raccomandazioni nuove.

La precedente route amministrativa Hub `/radar-patrimoniale` è una compatibilità che rimanda a `/rete-architetti`. La route **Website** `/radar-patrimoniale` per la persona resta distinta e conservata. Sidebar e pagine Radar d'Impresa, Social e aziende restano quelle del main Hub verificato.

## 4. Evento, Radar e recruitment

Il vero funnel `/benessere-patrimoniale/evento` usa l'acquisizione v2 canonica nel contesto locale esplicito. Un trigger sulla richiesta valida registra la relazione scheda–richiesta anche con HighLevel disattivato. Nessun parsing delle note: una nota che contiene «presente» non diventa una presenza.

La ricevuta dichiara **richiesta ricevuta**, non iscrizione/partecipazione confermata. Il passaggio ricevuta → Radar usa un riferimento casuale con scadenza 24 ore nel fragment, rimosso dal documento e mantenuto solo in memoria. Nessuna email, risposta o sessione negli URL; il riferimento non autorizza un report.

Le richieste ripetute restano separate per edizione. Iscrizioni e presenze provengono esclusivamente da `patrimonial_participations` e dagli identificativi canonici; non sono fabbricate alla ricezione. Nei test la presenza `ATTENDED` compare solo dopo una fixture esplicita, marcata sintetica.

Conservata la versione recruitment `cc15e5d`: CV PDF obbligatorio sul percorso reale, controlli formato/dimensione/origine, bucket privato, claim e gestione retention. La candidatura Architetto non crea persone Radar, pratiche finanziarie o permessi Advisor. Nessun cron Vercel importato o attivato; Storage Supabase reale e scheduling della retention NON collaudati operativamente da questa fase.

## 5. Assegnazioni P1

`assign_contact` non si ferma più alla proiezione amministrativa e alle sole pratiche `HORYZON_OPPORTUNITY`: usa `patrimonial_assignment_commit` per **tutte le pratiche RADAR e HORYZON_OPPORTUNITY aperte pertinenti**, nella stessa transazione del contatto. Nuovi assessment di una scheda già assegnata ereditano la responsabilità tramite lo stesso journal.

Controlli: sessione provider corrente; supervisione Rete; permesso patrimoniale ASSIGN quando esistono pratiche Radar; operatore abilitato e associato a un utente; revisione contatto CAS; request ID idempotente; conflitto se la stessa chiave viene riutilizzata con payload diverso; capacità P1; storico release/reassign; eventi canonici; audit amministrativo. Il fallimento di una pratica annulla **l'intera** operazione, senza contatto e intenti divergenti. Il replay restituisce l'esito originario senza riscrivere lo storico.

La vecchia API di assegnazione della sezione Radar indipendente è negata nell'alternativa Rete. Non è possibile assegnare un singolo episodio da quel canale lasciando incoerente la scheda. I registri P2B/outbox operativi e la loro autorità restano invariati; nessuna operazione owner HighLevel è creata dal piano locale di simulazione.

## 6. Permessi Advisor e fonte del report

Ogni apertura verifica JWT tramite PostgREST, `auth.uid()` e sessione provider esistente/non scaduta; utente non cancellato o sospeso; permesso Advisor esplicito, corrente e associato all'operatore; abilitazione della Rete; binding persona–scheda verificato; contatto accessibile; assegnazione del contatto, proiezione dell'intento e assegnazione P1 attiva coerenti; assenza di blocchi per casella condivisa; persona non cancellata. Audit delle aperture autorizzate e negate.

Il precedente responsabile perde accesso dopo la riassegnazione. La sola assegnazione, il ruolo UI o il ruolo Hub `superadmin` non concedono il dossier. Una revoca del binding già in corso serializza una lettura concorrente: il test verifica che questa attenda e venga poi negata.

Motore 4A, persistenza/snapshot 4C e proiezioni persona/Advisor 4D conservati. Il gateway controlla hash, revisioni e fonte canonica prima della proiezione Advisor; nessuna copia delle risposte nei contatti o nello snapshot generale Rete.

## 7. Collaudo eseguito e limiti delle prove

| Verifica | Esito |
| --- | --- |
| Nuova integrazione PostgreSQL 17.6 + PostgREST 16.5 | **PASS, 13 gruppi**, da installazione locale pulita |
| Percorso nativo storico 5A | **PASS, 14 gruppi**; poi reinstallata e ricollaudata la variante Rete |
| Browser reale Hub `/rete-architetti` | **PASS locale**: scheda, filtri, assegnazione A, dossier A, follow-up, riassegnazione B, esclusione A, dossier B, diniego senza Advisor, binding candidato senza dossier |
| Responsive | **PASS** viewport 1280×900 e 375×812; larghezze documento 1265 e 360; nessun overflow orizzontale misurato |
| Hub unit test | **PASS: 195 test**, 25 file |
| Hub build | **PASS** |
| Hub typecheck completo | **FAIL preesistente: 79 diagnostici identici** alla baseline `b3a3a84`, zero nuovi |
| Hub lint completo | **FAIL preesistente: 348 errori**, come baseline; 14 warning contro 13; file di integrazione: zero errori, un warning sul ref di invalidazione richieste |
| Website build/typecheck | **PASS** |
| Website suite generale / lint | **PASS** inclusi Annunci 10x e AI Score; lint zero errori, 77 warning |
| Website regressioni patrimoniali e altri prodotti | **PASS**; dettaglio nell'evidenza allegata |
| Evento / Architetto / form / temi | **PASS**; baseline recruitment corrente, 14 sezioni; controlli utili e prove negative conservati |
| Contratti Platform | **PASS: 9 test**, typecheck e build |
| Platform complessiva | **PASS: test 29/29 task senza cache; typecheck 29/29; build 16/16; lint zero errori, tre warning** |
| Simulazione futura HighLevel | **PASS**: riferimenti verificati, checkpoint deterministici/idempotenti, autorità P1, nessuna copia finanziaria, nessuna scrittura provider |
| OTP/provider/permessi e dati reali | **NON ESEGUITI**: consegna e identità staff simulate, nessun grant operativo |

I 13 gruppi includono Evento → Radar, Radar diretto senza Evento, due assessment, funnel senza Radar, candidati, email discordanti/casella condivisa, due edizioni, P1/CRM/atomicità/capacità, replay e CAS, vecchio responsabile, assenza Advisor, revoca concorrente e isolamento PostgREST. Il CV è verificato dalle prove di sicurezza e dalle evidenze browser 5B.1 conservate; questa fase non certifica Storage o recruitment remoti.

Browser: vere applicazioni React/TanStack Hub e gateway Next, RPC HTTP PostgREST e PostgreSQL nativo; **non** una riproduzione del componente in un harness. Solo utenti/scenari `.invalid`, issuer/OTP/Storage/provider sintetici. Nessun risultato di volontari inventato. I controlli UI sono stati seguiti dal replay nativo dell'ultima candidata, comprensivo degli ulteriori controlli di revoca e riconciliazione.

Evidenza database del browser prima del reset di collaudo: una scheda, due assessment, due assegnazioni correnti B, due assegnazioni A rilasciate, **zero owner incoerenti**, un follow-up, due aperture Advisor autorizzate e un diniego per assenza di permesso. Il vecchio A vede `0 di 0 contatti`; il diniego esplicito della sua lettura dossier è inoltre verificato nativamente.

Il browser ha avuto timeout di navigazione/controllo, una sessione locale precedente interferente e una chiusura del trasporto al termine. Gli esiti citati sono quelli effettivamente letti o acquisiti nelle immagini, non i tentativi falliti. Ripristino finale viewport/chiusura dell'ultimo tab non confermati dal tool. Un input data del collaudo ha richiesto un evento da tastiera dopo il riempimento automatico; salvataggio del follow-up confermato dal database. Nessuna protezione disabilitata.

Per la suite Platform è stata recuperata la sola dipendenza fixture Architetti `16265f822abdae7155e6ce2e161e4a656c558dee`: sei SQL con Git blob hash verificati identici alle migration Website storiche. Nessuna modifica a quel prodotto. I database effimeri Platform sono separati dal database Radar e confinati alla stessa istanza PostgreSQL locale dedicata.

Riproduzione del test principale dal worktree Website, con PostgreSQL locale dedicato `127.0.0.1:15439/radar_5a_test` e PostgREST `127.0.0.1:15440` già avviati:

```powershell
npm.cmd run test:patrimonial-network-clienti -- --network-platform="<worktree Platform isolato>" --pg-module="<pg/lib/index.js>" --local-config="<config sintetica privata esterna al repository>"
npm.cmd run test:client-radar-crm-plan
npm.cmd run test:patrimonial-consolidation
```

Il primo comando **resetta soltanto gli schemi del database sintetico esatto indicato**, rifiuta un altro host/porta/database e non ha fallback remoto. Non usarlo con dati da conservare. La configurazione privata e i token locali non sono allegati né committati.

## 8. Preservation e risoluzioni

- Originali Website/Hub/Platform, worktree Radar precedente e public pilot: confronto HEAD, branch, diff e inventario; **immutati**. Verificati anche i contenuti dei **2772 file non tracciati** del Website originale. Lock preesistenti Hub/Platform lasciati intatti. Nessun reset, clean o stash del lavoro concorrente.
- Conservati i worktree 5A e il lavoro locale 5B.1. Il vecchio worktree Platform 5B.1 con integrazione pendente è lasciato disponibile; la nuova candidata è nel worktree Platform 5B.1R, da `78eb49e`, con riporto dei contratti 5A.
- Radar d'Impresa v4: **34 schermate** verificate dai test autorevoli; sorgenti dominio/componenti intatti. Conservati Annunci 10x, AI Score, ricerca, contenuti e route degli altri prodotti.
- **35 fotografie correnti** presenti: 33 storiche identiche e due sostituzioni recruitment approvate in `cc15e5d` (`conversazione.jpg`, `stuck.jpg`). Non si dichiara che tutte le vecchie 35 immagini siano rimaste identiche. Tipografia, tema, riduzione movimento e isolamento delle landing sono verificati dai test di presentazione.
- Integrazione locale Hub: conflitti in `AppSidebar.tsx` e `routeTree.gen.ts`. Sidebar coerente con main corrente e destinazione Rete; eliminata l'area Radar Patrimoniale indipendente. Route tree rigenerato, con Rete e redirect di compatibilità. Non alterata l'area Impresa per assorbire il Patrimoniale.
- Consolidamento Website 5B.1: conflitti form/handler risolti conservando CV recruitment corrente e continuazione Evento; niente revisioni grafiche superate. Le differenze approvate sono elencate e fissate nei manifest; mutazioni arbitrarie su sorgenti/migration continuano a essere rifiutate.
- Corretto il contratto del layout Next: il re-export diretto esponeva la prop interna `isolated`, non ammessa come prop di route. Aggiunto un adattatore con il solo `children`; documento, metadata, font, script, isolamento Radar e staticità delle route ordinarie conservati. Il verificatore ora controlla il contratto semantico e l'hash dell'adattatore, mantenendo prove negative e controlli cache. Nessuna modifica alla policy `no-store`, al Proxy o al problema ETag.

## 9. Commit locali e file

| Repository / branch isolato | Commit codice verificato |
| --- | --- |
| Website — `codex/radar-patrimoniale-5b1` | `7f5306f1313ad19196807c50b7cb7c15647ee19b` |
| Hub — `codex/radar-patrimoniale-5b1` | `9692d34443ba36bcad61acdfdc1ad3561ab911c4` |
| Platform — `codex/radar-clienti-5b1r` | `e31cf8e635d93c960edea0507c65d259fb8c1113` |

Checkpoint Hub precedente preservato: `d895e85` (trasporto e messaggi 5B.1). Questo report viene consolidato con un commit documentale successivo nel Website; il suo SHA finale è riportato nella consegna e recuperabile dal log locale, senza un'autoriferimento impossibile nel contenuto del commit stesso.

Percorsi sotto `C:/Users/emanu/.codex/visualizations/2026/10/18/01a14e5a-6067-71a0-a210-f3859cab8329/`:

- Website: `fase-5b1/worktrees/website`.
- Hub: `fase-5b1/worktrees/hub`.
- Platform candidata: `fase-5b1r/platform`.

Nel Website resta esclusa dai commit la directory locale non tracciata `supabase/.temp/`, già presente durante il consolidamento 5B.1. Configurazioni private di test, token e log temporanei sono esterni ai repository; non sono stati aggiunti secret o file di configurazione locale.

Inventario completo in [file-inventory.json](clienti-5b1r-evidence/file-inventory.json); esiti in [verification-summary.json](clienti-5b1r-evidence/verification-summary.json); prova nativa in [native-postgres-postgrest.txt](clienti-5b1r-evidence/native-postgres-postgrest.txt); [coerenza database browser](clienti-5b1r-evidence/browser-database.json). Le immagini allegate sono esclusivamente sintetiche: [desktop](clienti-5b1r-evidence/clienti-scheda-desktop.png), [mobile](clienti-5b1r-evidence/clienti-scheda-mobile.png), [nessun permesso Advisor](clienti-5b1r-evidence/clienti-no-advisor.png), [precedente responsabile](clienti-5b1r-evidence/clienti-old-assignee.png), [nuovo Advisor](clienti-5b1r-evidence/clienti-new-advisor-mobile.png), [candidato](clienti-5b1r-evidence/clienti-candidate.png).

## 10. Prerequisiti precisi per i dati reali

**GO per revisione e collaudo locale dell'integrazione. NO-GO per collegare o aprire dati patrimoniali reali con il solo codice attuale.** Servono tutti i passaggi seguenti, con autorizzazioni separate:

1. Rieseguire preflight dello schema/history e confronto con i main effettivi al momento del rilascio. Approvare il percorso mirato 4C.1 + alternativa Platform, backup e ripristino. Nessun replay dell'intera cronologia e nessuna ricreazione della 0056.
2. Approvare e implementare il trasporto remoto, oggi intenzionalmente rifiutato dai gateway locali quando `VERCEL` è presente. Collegare OTP reale con finalità, rate limit, scadenze, retention e monitoraggio definiti; nessun provider reale è stato testato qui.
3. Verificare issuer/audience/firma e sessioni Supabase reali; identificare per UUID gli account staff già autorizzati all'Hub e gli operatori Rete. Approvare singolarmente permessi patrimoniali, scadenze e revoche. Nessuna concessione da nome, email, ruolo UI o sola assegnazione; nessun accesso Hub automatico agli architetti esterni.
4. Approvare procedura di review dei candidati, duplicati, caselle condivise e percorso diretto → Evento; completamento anagrafica e revoca dei binding. Valutare separatamente eventuale riconciliazione dello storico: non è stato eseguito un backfill indiscriminato dei contatti/richieste già presenti.
5. Approvare testi e informativa della modalità identificata: l'accettazione servizio resta `RP-SERVICE-5A-DRAFT-1`. Definire minimizzazione, access log, retention, cancellazione e diritti, senza dichiarare conformità legale certificata. Le risposte patrimoniali rimangono distinte dai normali dati tecnici di accesso.
6. Validare carichi, paginazione dello snapshot Rete e del dettaglio, UX dei ruoli reali e presentazione Advisor con personale autorizzato. Restano il debito typecheck/lint Hub e testi/codici tecnici già presenti nella proiezione 4D da valutare editorialmente, senza cambiare il modello durante l'integrazione.
7. Verificare operativamente il bucket CV privato, le policy e la retention recruitment; nessuna credenziale recruitment deve diventare un permesso patrimoniale. Nessuno scheduler è stato attivato.
8. Mantenere HighLevel OFF finché binding Location/Contact, checkpoint, mapping owner e pipeline non siano approvati. `planClientRadarCrmSync` conserva persona, scheda Hub, richieste, partecipazioni, assessment, intento P1, revisioni e riferimenti di storico; produce solo una simulazione idempotente. L'owner remoto non cambia mai l'assegnazione interna e il dossier completo non viene copiato.
9. Conservare il **FAIL HTTP 304 senza ETag** già documentato: non risolto né ricollaudato da questa fase. Prima della pubblicazione restano revisione della policy cache/no-store sulla home, ticket Vercel da autorizzare, SEO, navigazione, accessibilità e piano di rollback.
10. Autorizzare separatamente eventuali push, applicazioni mirate, configurazioni, collaudi reali e rilascio. Il rollback applicativo può ritornare ai commit precedenti; il rollback dati richiede revoca controllata di permessi e binding e conservazione degli snapshot, non DROP automatici.

**Nessun push, merge su main, deployment, migration remota, invio email reale, attivazione di flag remoto o scrittura HighLevel eseguiti.** Il sito Horyzon e la produzione Hub non sono stati modificati. Nessun invito o ticket inviato. La fase termina con questo report e i commit locali.
