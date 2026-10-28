# Radar Patrimoniale V1 — Identità staff e autorizzazione Advisor, Fase 4D.2A

18 ottobre 2026. Esito: completata la parte autonoma verificabile; **integrazione con identità, assegnazioni e dossier reali bloccata dai contratti mancanti descritti sotto**. Nessun accesso Advisor reale attivato.

## 1. Stato dei contratti e verifica Git corrente

Worktree Radar: `C:\Users\emanu\.codex\worktrees\radar-patrimoniale-v1\horyzon-website`, branch `feat/radar-patrimoniale-v1`, HEAD iniziale atteso ed effettivo `aab329da61931c46d3754dcc12d0aaf39852d28e`, inizialmente pulito. Checkout originale: `C:\Users\emanu\Desktop\horyzon\horyzon-website`, branch `feat/patrimonial-pilot-funnels`, HEAD `b242752102542e5280bba8b6ba0c4aecf9fcd722`, soli non tracciati audit Fase 1 e `tmp/`. Nessun processo Git concorrente rilevato.

Verificati gli HEAD sul server con `git ls-remote` e aggiornati soltanto gli oggetti/riferimenti Git con fetch mirato, senza checkout, merge o import:

| Riferimento | SHA effettivo |
| --- | --- |
| `origin/main` | `9146f6372b19fdac6db1770d05f6b0ca10c1f1e5` |
| `origin/feat/patrimonial-pilot-funnels` | `8fd4feb229871b135f11f614247fd8df444df76e` |
| Tracking funnel prima del fetch | `b242752102542e5280bba8b6ba0c4aecf9fcd722` |

Il remoto funnel è avanzato di **43 commit**, con 18 file differenti rispetto a b242752. Il Radar iniziale ha 47 commit esclusivi rispetto a main, main zero esclusivi; rispetto al funnel remoto ha 15 commit esclusivi contro 48. Merge-base Radar/main = 9146f637; Radar/funnel = 88fafcba8811e4a02b3575e2e2cd36368b818be8. Secondo controllo e controllo conclusivo `ls-remote`: stessi SHA. Non si presume che b242752 rappresenti il remoto corrente.

P1 (`patrimonial-assignments.ts`, migration assignment), worker P2B (`patrimonial-owner-sync.ts`), migration P2B, migration runtime capabilities e Website staff Auth non hanno differenze fra b242752 e 8fd4feb. Sono invece aggiornati decoder/provider owner, readiness e documenti di rollout. P3/performance e webhook sono nuovi: nessuna loro parte è stata importata o attivata.

Le appendici più recenti di `patrimonial-owner-sync-p2b-v1.md` e `patrimonial-owner-sync-readiness-v1.md` riportano installazione P1/P2B/capability e successivo P2D sintetico end-to-end con worker/outbox/checkpoint. Queste evidenze documentali superano le frasi storiche «non applicato» ancora presenti nelle sezioni iniziali. **Non sono state ripetute né certificate qui**: nessuna introspezione Supabase/HighLevel/Vercel, lettura di credenziali o prova live. Il P2D documenta owner opportunity; non dimostra un binding Hub Auth–operatore o persona Radar–contatto.

P1 rimane il sistema canonico di assegnazione: registro `patrimonial_operators`, assignment storiche, `current_operator_id`, CAS `operator_revision`, una sola assignment attiva per intent e corrispondenza della proiezione al commit. La disattivazione dell'operatore preserva lo storico e le assignment ma non deve concedere lettura Advisor. P2B gestisce owner remoto separatamente, con fencing/checkpoint e limite CAS HighLevel dichiarato. Nessun sistema parallelo introdotto.

## 2. Mappa delle identità

```text
Hub Auth user / sessione corrente
  ── binding staff–operatore verificato [MANCANTE] ──► operatore interno UUID
  ── concessione specifica RADAR_ADVISOR_READ [MANCANTE]
       operatore ── P1 assignment corrente / operator_revision ──► intent OPPORTUNITY
       intent.record ── Location + Contact ID ──► contatto HighLevel
       persona Radar ── binding verificato [MANCANTE] ──► Location + Contact ID
       dossier ── ambito di relazione autorizzante esplicito [MANCANTE] ──► intent P1
       persona ── assessments.person_id ──► assessment ──► snapshot + registro approvato
```

| Identificativo | Significato disponibile e limiti |
| --- | --- |
| Hub Auth user | `auth/v1/user` nello staff Auth Website restituisce l'utente; il controllo esistente successivo su `hub.user_roles`/superadmin è specifico del Radar d'Impresa. Non viene riutilizzato come permesso Advisor |
| `current_operator_id` | UUID interno, FK al registro operatori, riferito alla pratica P1, non utente Supabase o HighLevel |
| `operator_revision` | CAS della responsabilità interna. Distinto da business revision, revisione registro operatore, revisione riga assignment e owner checkpoint |
| `remote_user_ref` | Mapping opzionale verso utente HighLevel; P2B ne verifica identità e Location prima dell'effetto remoto. Non è un Hub Auth user ID verificato |
| `owner_ref` | Riferimento/checkpoint provider. Nel percorso OPPORTUNITY P2B converge con `record.ownerId` e `record.remote.assignedTo`, senza diventare responsabilità interna |
| Owner del contatto | Concetto HighLevel distinto dall'owner opportunità. Nessuna equivalenza usata per leggere un dossier; neppure i follower osservati nel P2D sono un'ACL |
| Contact ID + Location | Identità provider della relazione commerciale. Il record OPPORTUNITY contiene questa coppia; da sola non identifica la persona Radar |
| Opportunity ID | `record.remote.id`, identificativo provider, distinto dall'UUID intent e dall'UUID assignment |
| `persons.id` Radar | UUID stabile emesso dall'identificazione Radar. `assessments.person_id` e snapshot/ledger sono collegati nel DB privato |
| Email / email key | OTP e chiave normalizzata/hash identificano il percorso Radar; uguaglianza con un recapito CRM non prova il binding fra i sistemi e non attribuisce accesso staff |

## 3. Binding già disponibili

- Nel codice P1 consolidato remoto: operatore–assignment–intent corrente, con rilascio/riassegnazione/storico e revisione CAS.
- Nel record OPPORTUNITY: intent–Location–Contact ID, e riferimento opportunità provider quando disponibile.
- Nel Radar 4C.1: persona–assessment–snapshot e registro revisioni approvato; proiezioni cliente e Advisor basate sullo stesso risultato canonico.
- Nel Website: contratto di verifica staff Hub per Radar d'Impresa; non contiene un permesso Advisor specifico o la relazione con P1.
- Capability remota definita nel codice: `patrimonial-runtime-capabilities-v1`, base `patrimonial-v2-store-1`, assignment `p1-v1`, owner `p2b-v1`. È una prova di schema/capability per il chiamante server, **non una concessione di accesso a un contatto**.

Disponibilità nel codice e rollout documentato non equivalgono a lettura autorizzata di dati reali in questa fase.

## 4. Binding e contratti mancanti: blocco preciso

1. **Hub Auth → operatore interno:** fonte autorevole, unicità bidirezionale o gestione esplicita di identità condivise/duplicate, verifica corrente, revoca e revisione. Il campo role libero dell'operatore non lo fornisce.
2. **Permesso Advisor:** concessione/revoca specifica, identificativo e revisione della concessione; nessun automatismo da superadmin o `user_metadata`.
3. **Persona Radar → Location/contatto:** prova verificata con provenienza, unicità, lifecycle e revoca. La tabella `patrimonial_radar_private.integration_links` esistente ha `CHECK (verification_state = 'UNRESOLVED')`, non ha writer runtime e **non può rappresentare VERIFIED**. Non è stata cambiata né interpretata come un legame autorizzante.
4. **Ambito della relazione per il dossier:** P1 assegna intent distinti per pipeline/ciclo/scope, e lo stesso contatto può avere A/E/C. Manca la regola approvata che seleziona quale responsabilità consenta accesso a quel dossier, incluse pratiche chiuse, storico e conflitti fra responsabili. Non si sceglie «la prima» o «una qualsiasi» assignment.
5. **Validità corrente della sessione staff:** il contratto Website esistente non verifica la revoca/sessione corrente con la precisione richiesta per l'Advisor. Serve un verificatore fidato di identità e sessione, non la sola decodifica di un JWT o il suo `user_metadata`.
6. **Transazione finale e audit:** `audit_events` 4C.1 ammette soltanto IDENTITY_VERIFIED/ASSESSMENT_CREATED/ANSWER_SAVED/COMPLETED/SESSION_REVOKED. Non supporta accessi staff Advisor o la verifica atomica di concessione, binding, sessione e assignment. Manca un contratto approvato per questa persistenza e il relativo confine transazionale.

Nessuna policy supervisor disponibile: resta negata. Le forme dei proof introdotte nel codice sono **interfacce server proposte per le porte mancanti**, esercitate soltanto da fixture; non dichiarano tabelle, colonne, revisioni o mapping reali già esistenti. In particolare la revisione della prova di sessione dovrà essere definita dal verificatore autorevole, non inventata come colonna di `auth.sessions`.

## 5. Adapter effettivamente realizzati

`p1-access-adapter.ts` contiene `P1AdvisorReadModel`, un sottoinsieme strutturale di AssignmentContext P1 unito ai soli riferimenti Location/contatto del record OPPORTUNITY. `authorityFromP1` proietta questi fatti in `CurrentAdvisorAuthority`; `p1AdvisorAccessPorts` compone le porte server iniettate con l'interfaccia 4D.1.

L'adapter non implementa Auth Supabase, SQL, HTTP, lookup email, contatto HighLevel, writer di mapping, assignment, owner sync o concessioni. Non importa moduli dal branch funnel. Le sole fonti disponibili nei test sono sintetiche. `readCurrentFacts`, `loadApproved` e `commitDecision` devono essere forniti da implementazioni fidate; **nessuna implementazione reale è stata installata nel runtime**.

Il contratto di lettura futuro deve restituire insiemi completi e coerenti per soggetto e per unicità inversa, senza paginazione parziale che nasconda duplicati. La policy di scope deve essere verificata autorevolmente, non scelta dal browser. Le prove di binding e permesso devono mantenere identificativi/revisioni, così una sostituzione apparentemente identica durante la richiesta è rilevabile.

## 6. Politica di autorizzazione e servizio

`readAuthorizedAdvisor` richiede audit configurato prima di qualsiasi lettura. Poi:

1. Valida il soggetto UUID esatto e risolve identità/sessione correnti tramite porta fidata.
2. Richiede operatore attivo, permesso specifico, binding verificati univoci in entrambe le direzioni e scope esplicito del dossier. Rifiuta capability P1 assente/diversa, ambiguità, identità mutabili e supervisione irrisolta.
3. L'adapter richiede una pratica OPPORTUNITY OPEN nello scope provato, corrispondenza Location/contatto, `currentOperatorId` coerente e una sola assignment non rilasciata allo stesso operatore. È un requisito restrittivo della preparazione locale, **non una nuova regola canonica P1**: gli intent chiusi non vengono automaticamente autorizzati in attesa della policy di dominio.
4. Copia la prova, legge soltanto la fonte approvata del soggetto e costruisce la proiezione con i controlli hash/versioni/ledger 4D.1. Nessun nuovo calcolo diagnostico.
5. Risolve nuovamente tutta l'autorità e ne richiede identità completa: sessione, concessione, registro operatore, binding, scope, assignment e revisioni. Nessuna cache globale di autorità.
6. Richiede `commitDecision`: il futuro adapter deve riverificare l'autorità corrente e impegnare l'audit nello stesso confine atomico, oppure rifiutare. La ricevuta deve corrispondere a richiesta, esito e hash della prova. Non si consegnano dati finanziari a questa porta. Sessione scaduta, audit indisponibile o ricevuta discordante impediscono la restituzione.

Tutti gli errori verso il chiamante diventano `ADVISOR_ACCESS_DENIED`, senza cause/raw body/risposte economiche. L'audit ha un'allowlist costruita dal servizio: request UUID, tempo server, azione/esito, UUID persona/assessment/staff/operatore/assignment/intent e revisione assignment. Nessun token, cookie, email, nome, contatto CRM, importo, risposta, profilo o eccezione originaria. Il tentativo DENIED è registrato quando la porta audit è disponibile; un guasto totale dell'audit ne impedisce anche la persistenza ma non autorizza alcuna lettura restituita.

L'esito AUTHORIZED_RELEASE identifica il confine di autorizzazione alla restituzione, non prova che il browser abbia ricevuto il dossier. Una ricevuta persa/discordante resta accesso negato; non esiste retry cieco di consegna o cache della precedente autorizzazione.

## 7. Test positivi e negativi locali

`npm run test:patrimonial-radar-advisor-access`: **PASS, sei gruppi, 64 richieste con rifiuto atteso**.

| Perimetro | Esito e prova |
| --- | --- |
| Operatore autorizzato | PASS: snapshot/indicatori canonici identici, una lettura e audit di rilascio |
| Owner CRM diverso / remote mapping assente | PASS: l'accesso interno dipende dai binding e P1, non dall'owner provider |
| 38 casi negativi prima della lettura | PASS: sessione assente/non verificata/scaduta/revocata, operatore inattivo/non assegnato, permesso assente, superadmin solo, metadata mutabili, binding mancanti/UNRESOLVED/duplicati/inversamente ambigui, persona/contatto/Location/scope discordanti, capability/revisioni non valide, assignment duplicata/rilasciata/discordante, pratica chiusa/provvisoria, email/UUID/owner soli |
| Soggetto incrociato / reader errato | PASS: altro UUID persona non legge; fonte caricata con persona errata non viene restituita |
| Storico riassegnato | PASS: vecchio operatore negato prima del caricamento; nuovo operatore con binding/permesso propri legge lo stesso snapshot storico e l'audit riferisce la nuova assignment corrente |
| Revoca/riassegnazione durante la richiesta | PASS: 20 interleaving, descritti nella sezione seguente |
| Audit | PASS: porta assente → zero letture; guasto o ricevuta con hash/richiesta/esito errati → nessun dossier restituito |
| Minimizzazione | PASS: campi audit allowlist, errori generici anche quando il reader solleva un'eccezione contenente l'intera fixture; zero chiamate di rete |
| Isolamento statico | PASS: nessun import del servizio in runtime, route, preview o backend cliente; percorsi protetti identici ad aab329d |

`test:patrimonial-radar-advisor` conserva i 25 snapshot sintetici, uguaglianza canonico/cliente, evidenze, fasce, stati, obiettivi e tutte le negazioni precedenti. Aggiornati soltanto i proof sintetici e la porta audit obbligatoria nei test, senza rimuovere assert o ridurre copertura.

## 8. Revoca, riassegnazione e limiti delle prove

Dieci cambi sono applicati sia durante il caricamento sia immediatamente prima del commit simulato: riassegnazione; revoca sessione; revoca permesso; nuova concessione con ID diverso (ABA); disattivazione operatore; scadenza sessione; revisione binding staff; revisione binding persona; revisione policy/scope; incremento revisione assignment a parità di operatore (ABA). Tutti negano la restituzione. Test separato su oggetto prova mutabile: la copia iniziale impedisce che il cambio venga nascosto da riferimenti condivisi. Cambio del solo owner CRM: nessuna concessione/revoca interna implicita.

Il commit sintetico esegue controllo fresco e append audit senza await intermedio, modellando un unico punto di decisione locale. **Non è una prova di lock SQL, durabilità audit, Auth reale, revoca distribuita o concorrenza nativa multiconnessione.** Il servizio da solo non rende atomico un adapter futuro: il contratto di `commitDecision` deve essere implementato e verificato sul DB autorevole. Una revoca successiva al punto atomico di decisione non può ritirare byte già consegnati; ogni nuova richiesta deve comunque ripetere l'intero controllo, anche per lo storico.

## 9. Dipendenze Git, ambiente e regressioni

Nessun merge/cherry-pick eseguito. Un import completo del ramo funnel trascinerebbe P1/P2B/capability/P3/webhook, store e rollout estranei alla fase; non è necessario né sufficiente per risolvere i binding mancanti. Un futuro collegamento dovrà selezionare e revisionare la sola dipendenza server/schema compatibile, preservando Radar/cliente e senza riattivare flag. Gli adapter attuali accettano soltanto proiezioni di lettura: non richiedono l'import del motore P1 e non possono assegnare o riassegnare.

| Verifica eseguita | Esito |
| --- | --- |
| Advisor access + Advisor projection | PASS come sopra |
| `typecheck` | PASS |
| `lint` | PASS, 0 errori e 65 warning preesistenti; lint mirato 0 warning |
| `build` | PASS, 145 pagine, nessuna route staff Advisor aggiunta |
| `test:patrimonial-radar-backend` | PASS, 14 gruppi su PostgreSQL 18.6 embedded/PGlite 0.5.10, sessioni/persistenza cliente e privilegi SQL esistenti |
| Motore 4A | PASS 72 gruppi; 57 scenari metodologici PASS, quattro PARTIAL CT-26/28/37/40 e CT-27 storico NOT RUN conservati |
| Customer projection, UI, Radar d'Impresa | PASS: 14 fixture cliente, contratti UI e dieci verificatori Radar |
| Funnel, ledger, CRM, opportunità, persistenza, mapping remoto | PASS nei sei comandi locali esistenti, senza trasporti reali |
| Presentazioni Evento/Architetto e tema | PASS nei verificatori correnti |
| Integrazione preservata | PASS: Radar v4/34 schermate, 35 fotografie byte-identiche, documenti/migration e CRM protetti |
| no-platform / search / readable | PASS sulla build |
| Browser preview Advisor | PASS: 25 scenari, 320/390/768/1440, tastiera/tabelle e nessun overflow; zero richieste esterne, scritture o errori di pagina; produzione con flag ON e dev con flag OFF entrambi 404 |
| PostgreSQL nativo / PostgREST locali | **NOT RUN**: `psql`, `postgres`, `postgrest` non reperiti nel PATH, nessuna installazione Program Files/PostgreSQL rilevata; Docker CLI presente ma daemon non raggiungibile. Nessun servizio avviato o scaricato |
| Verificatore live-smoke storico | **NON RIESEGUITO**: FAIL preesistente della guardia Git c61ed43 già documentato; nessuna promozione a PASS e nessuno smoke operativo |

I test P1/P2B del branch remoto sono stati esaminati come contratto/evidenza pregressa, **non eseguiti su quel checkout** né dichiarati nuova verifica del remoto. Il nuovo adapter non esegue SQL P1; le prove SQL embedded elencate riguardano la regressione del backend Radar esistente. Non si dichiara CT-27 interamente soddisfatto con simulazioni.

Artefatti browser esclusivamente sintetici, esterni al repository: `C:\Users\emanu\.codex\visualizations\2026\10\18\01a14e5a-6067-71a0-a210-f3859cab8329\radar-patrimoniale-4d2a-advisor`, con `verification.json` e 25 screenshot. È una regressione della preview invariata, non una prova E2E di staff Auth/ACL reali.

UI, preview sintetica, proiezione cliente, API cliente, dominio 4A, migration, font, asset, `next.config.ts`, lockfile e flag sono identici ad aab329d. Non esiste un nuovo endpoint o una nuova risposta HTTP Advisor: i controlli su errori e audit nuovi sono del servizio locale; la prova browser della preview riguarda l'isolamento già esistente e il rifiuto in produzione. Nessun dato economico in URL/log/cache pubbliche introdotto dal nuovo servizio, che non crea URL, cache o log.

## 10. File modificati

- `src/lib/patrimonial-radar-advisor/access.ts`: prove complete, copie, doppio controllo e porta finale audit obbligatoria.
- `src/lib/patrimonial-radar-advisor/p1-access-adapter.ts`: adapter puro di lettura e contratti delle fonti fidate mancanti.
- `scripts/verify-patrimonial-radar-advisor-access.mjs`: matrice sintetica positiva/negativa, revoche, audit, isolamento.
- `scripts/verify-patrimonial-radar-advisor.mjs`: proof e audit simulato adeguati al contratto rafforzato, assert precedenti preservati.
- `package.json`: un solo comando test aggiunto, nessuna dipendenza.
- Questo report.

## 11. Commit e protezione workspace

Commit locale della fase identificato nella consegna e con `git log -1 -- docs/patrimonial/radar-patrimoniale-v1-staff-assignments-fase-4d2a.md`, senza hash autoreferenziale nel file. Il checkout originale non è stato scritto, ripulito, spostato, consolidato o importato. Il fetch ha aggiornato metadati Git condivisi, senza muovere HEAD/branch del checkout originale o modificarne i file. Ricontrollo conclusivo: stesso HEAD b242752, stesso branch e gli stessi due percorsi non tracciati; nessun processo Git concorrente o lock rilevato.

Nessuna scrittura remota, migration remota, HighLevel, email, env/segreto, flag pubblico, deploy, push o merge su main. Nessun dossier reale o staff reale collegato.

## 12. Readiness 4D.2B

**Pronta la base locale per definire i binding e il confine dati; non pronta l'attivazione o il collegamento reale.** La fase ha verificato lo stato corrente dei contratti e rafforzato il confine senza aggirare le dipendenze.

Per procedere con l'integrazione reale servono contratti approvati per i sei punti della sezione 4: binding staff/operatore, concessione specifica, binding persona/Location/contatto, scope dossier/assignment, sessione staff corrente e decisione/audit atomici. Servono poi integrazione Git selettiva compatibile, implementazione delle porte autorevoli, prove negative con Auth e DB nativi/PostgREST locali e revoca multiconnessione. Nessun mapping VERIFIED o grant deve essere creato per semplice uguaglianza email/UUID, owner CRM o ruolo generico. Supervisione, pratiche chiuse e contatti con più responsabilità richiedono una decisione esplicita di dominio prima di concedere accesso.

Rimangono i limiti metodologici e privacy/retention/identità documentati nelle fasi precedenti. Fine 4D.2A, prima di attivare l'Advisor per operatori reali.

## Fonti tecniche e provenienza

Contratti repository letti agli SHA sopra: P1 assignment management/data readiness, P2B owner sync/readiness e appendici P2D, runtime capabilities, record OPPORTUNITY, Website staff Auth, Radar identity/session SQL e proiezione 4D.1. Nessun contratto esterno Hub non disponibile nel repository è presunto verificato.

Consultati [changelog Supabase](https://supabase.com/changelog), [sessioni e revoca](https://supabase.com/docs/guides/auth/sessions) e [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). La verifica corrente della sessione è distinta dalla validità residua di un JWT; metadata modificabili dall'utente non costituiscono autorità e grants/RLS restano confini distinti. Nessun SDK, parametro o schema Supabase modificato. La risorsa changelog Markdown non era leggibile dal browser tool; usata la pagina ufficiale HTML come fallback. Letti AGENTS/DESIGN, report 4D.1 e contratti correlati; applicate skill Supabase/Auth e guida Auth della versione Next installata. I limiti della fase prevalgono sulla vecchia autorizzazione generica al push in DESIGN.
