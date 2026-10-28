# Radar Patrimoniale V1 — Stabilizzazione dipendenze, Fase 4D.2C

19 ottobre 2026. **P1/P2B stabilizzati localmente; collegamento operativo Advisor ancora NON READY.** Nessun accesso reale attivato. Policy **PROPOSED**, anche quando i modelli locali restituiscono CANDIDATE_ONLY. Nessuna nuova migration.

## 1. Stato Git e conservazione

Letti AGENTS.md, DESIGN.md e i report 4D.2A/4D.2B; consultata la guida route della versione Next installata prima del test del suo handler. Skill Supabase applicata per l'introspezione di soli metadati. Nessun processo Git concorrente o lock rilevato ai controlli; nessun reset, clean, stash, consolidamento del lavoro altrui o modifica del checkout originale.

| Riferimento | SHA iniziale verificato e controllo remoto conclusivo |
| --- | --- |
| origin/main | 9146f6372b19fdac6db1770d05f6b0ca10c1f1e5 |
| origin/feat/patrimonial-pilot-funnels | 8fd4feb229871b135f11f614247fd8df444df76e |
| Radar iniziale feat/radar-patrimoniale-v1 | 40e591f23321bf292b1533daca8fc780c976bc9f |
| Checkout originale feat/patrimonial-pilot-funnels | b242752102542e5280bba8b6ba0c4aecf9fcd722 |

Radar: `C:\Users\emanu\.codex\worktrees\radar-patrimoniale-v1\horyzon-website`, inizialmente pulito. Originale: `C:\Users\emanu\Desktop\horyzon\horyzon-website`, stesso HEAD/branch alla fine, stessi due percorsi non tracciati (audit Fase 1 e tmp/). Nessun test o build eseguito lì. Nessun file di quel checkout è stato modificato, spostato, cancellato, importato o incluso nei commit; lavoro sulle assegnazioni e temporanei conservati.

Checkout temporaneo funnel: `C:\Users\emanu\AppData\Local\Temp\horyzon-4d2c-funnel-1792362222867`, nuovo branch `codex/patrimonial-verifier-stabilization` da 8fd4feb, dipendenze esistenti esposte mediante sola junction. Dopo verifica di percorso assoluto, HEAD, stato pulito e target della junction è stato rimosso soltanto questo checkout posseduto dalla fase, mantenendo il branch e il commit. I due worktree preesistenti restano. Nessun merge/cherry-pick nel Radar o aggiornamento del branch funnel originale/remoto.

## 2. Esito definitivo P1 e P2B

**Entrambi PASS completi nel checkout isolato.** Commit locale dei correttivi: **a7c2b925a01c87ee2bfa480419d3bea02e6cd7bc**, branch `codex/patrimonial-verifier-stabilization`; include report dettagliato `docs/patrimonial/patrimonial-verifier-stabilization-4d2c.md`.

P1 mantiene la baseline 88fafcba e tutti gli assert funzionali. Il nuovo helper riconosce la sola route P3B, fissandone l'intero sorgente al commit bc2bb10f4a5c5efe304e6afdfa5c122571fb4987. P2B incontra anche il decoder readiness già aggiornato: quel singolo file è fissato a ccbb34aa2745476c24e572046f9d5cf37495b149. Le altre protezioni rimangono sulle rispettive baseline; non è stata riposizionata tutta src/app o esclusa la directory. Probe negative hanno rifiutato modifiche della route, del decoder e di un altro file applicativo; i byte temporaneamente modificati nella sola copia test sono stati ripristinati.

Il provider di produzione viene esercitato con vere Response/JSON sintetiche: undefined sparisce dalla proprietà sul wire, quindi segue la regola dell'omissione. Omissione e null richiedono proof indipendenti; owner esplicito valido resta distinto da vuoto/tipi malformati. Aggiunte 24 combinazioni al provider e 24 al decoder readiness; conservati tutti i casi A–AE, fencing, checkpoint, read-back, kill switch e dinieghi. Nessun provider/decoder di produzione modificato. Corretta anche una fixture decoder che lasciava una outbox pendente interferendo con l'assert successivo OPPORTUNITY_NOT_READY: il test di decoder non crea più intent/operatore/outbox inutili.

P3B: suite ingestione/firma/SQL embedded PASS; nove casi del vero sorgente route transpiled con NextResponse reale e dipendenze sintetiche PASS, inclusi raw body/firma, lazy store in caso DISABLED, no-store, 400/401/503 e MANUAL_REVIEW con errori sanitizzati. Nessuna modifica della route. Non è un browser test né una chiamata al servizio remoto.

La semantica di omissione HighLevel è documentata dallo smoke sintetico precedente nel report readiness del funnel; **nessuna nuova ricertificazione HighLevel live**. Il PASS attuale certifica verificatori, JSON wire, decoder e gating delle proof locali. Non certifica rollout, token o provider live.

Durante le regressioni è emersa una fixture ledger con inventario di otto flag contro i dieci attuali: aggiornato il solo test. Default/valori invalidi OFF, ciascun flag abilita una sola capability, e le fixture handler precedenti mantengono i due flag P3 assenti/OFF. Ledger e suite dipendenti ora PASS; nessun flag operativo abilitato.

## 3. Topologia dimostrata tramite metadati, senza dati personali

Progetto pubblico di riferimento `horyzon / pmkyeqrfkunypfkbjnyg`, già citato nel repository. Introspezione del connettore autorizzato mediante transazioni **BEGIN READ ONLY**, soli pg_catalog/information_schema e version/name della migration history. Nessuna SELECT di righe Auth, Hub, operatori, contatti o persone; nessuna credenziale letta. Query riproducibile e risultato:

- `radar-patrimoniale-v1-topology-4d2c.sql`;
- `radar-patrimoniale-v1-topology-4d2c.json`, osservazione 2026-10-18T22:34:36.570878Z (19 ottobre in Europe/Rome).

| Oggetto/contratto | Prova e limite |
| --- | --- |
| Auth + Hub + P1 | auth.users, auth.sessions, hub.user_roles e public.patrimonial_operators/assignments/intents esistono fisicamente nello stesso database postgres, PostgreSQL 17.6 |
| Identità Hub | Il Website staff-auth usa lo stesso SUPABASE_URL per /auth/v1/user e hub.user_roles; i metadati confermano i relativi oggetti co-residenti. Configurazione/issuer del deployment Hub non letti: non certificato che ogni deployment Hub utilizzi oggi proprio questo issuer |
| Collegamento staff–operatore | Nessuna FK Auth da patrimonial_operators; nessun oggetto Advisor/binding individuato nei nomi ispezionati. Non equivale a un audit di ogni possibile contratto esterno Hub, assente da questo repository |
| Persona Radar | Modello locale previsto in patrimonial_radar_private.persons e assessment/snapshot, migration candidata 4C.1. **Schema patrimonial_radar_private assente nel progetto ispezionato** |
| Destinazione Radar runtime | Solo LocalSupabaseRadarRpc loopback/local-test, con controlli espliciti dell'origin; nessuna destinazione remota Radar configurata/abilitata dalla fase |
| Sessione corrente | auth.sessions contiene id/user_id/not_after/refreshed_at e gli altri campi del JSON; nessuna session_revision inventata. Presenza/expiry della credenziale non sostituiscono policy e revoca autorevoli |
| Transazione completa Advisor | **NON dimostrata e attualmente non disponibile**: co-residenza Auth/P1 provata, Radar non installato, grant/binding/scope/audit Advisor assenti; issuer e policy sessioni deployment non certificati |

Privilegi effettivi di catalogo, non SELECT di dati:

| Ruolo | SELECT auth.sessions/users | SELECT operatori P1 | UPDATE operatori/intents | BYPASSRLS |
| --- | --- | --- | --- | --- |
| anon / authenticated | no / no | no | no / no | no |
| service_role | no / no | sì | sì / sì | sì |
| supabase_auth_admin | sì / sì | no | no / no | no |
| postgres (ruolo dell'introspezione) | sì / sì | sì | sì / sì | sì |

Il privilegio di introspezione postgres **non è il privilegio del runtime Advisor**. Non viene adottato come credenziale applicativa. BYPASSRLS di service_role non concede SELECT alle tabelle Auth. Non sono stati aggiunti GRANT o SECURITY DEFINER per superare il limite. auth.sessions ha RLS e nessuna policy di tabella individuata; le tabelle P1 rilevate hanno RLS/FORCE RLS.

La history remota registra P1/P2B/capability/performance del 18 ottobre; non contiene installazione Radar 4C.1. I timestamp della history remota differiscono dai filename locali P1/P2B: non si rinominano né riscrivono migration applicate.

P1 journal/comandi, intent, assignment, eventi/outbox sono componenti interni al DB; il codice P1 usa lock transazionali e trigger. Ciò non rende già disponibile una decisione Advisor atomica. Il vecchio audit Radar locale ammette solo azioni cliente e non letture staff. Devono ancora essere approvati e implementati controlli sessione, writer binding/grant/scope e audit finale, con fencing di tutti i writer e prova concorrente nativa. HighLevel remoto non partecipa alla transazione del DB.

## 4. Componente locale implementato e sei passi del workflow

Nuovo `controlled-linking-review-proposal.ts`: composizione pura dei modelli 4D.2B. Verifica coerenza di soggetto fra sessione, catalogo binding/grant e inventario completo delle relazioni. Rifiuta il riuso di una sessione valida di un altro utente, oppure di prove per altra persona, episodio, operatore, Location o contatto. Produce soltanto un fingerprint tecnico del candidato; nessun dossier, binding o grant. Tutti gli esiti hanno **authorizesAccess=false** e **policyStatus=PROPOSED**, inclusi i candidati coerenti.

| Passo richiesto | Componente verificabile ora / blocco operativo |
| --- | --- |
| 1. Identificazione staff | Modello di sessione corrente e correlazione user/issuer; mancano verificatore reale, issuer/policy confermati e privilegi |
| 2. Staff → operatore P1 esistente | Validazione catalogo, unicità e corrispondenza all'operatore nell'inventario P1; nessun writer o riconciliazione automatica |
| 3. Permesso specifico da amministratore autorizzato | Grant specifico/Location/stato/scadenza verificati nel modello. **Autorità esplicita dell'approvatore e writer non disponibili**; un UUID attore o superadmin non li prova |
| 4. Persona → contatto con prova contestuale | Modello con evidence/ack e cardinalità conservativa; workflow di verifica/evidenza e persistenza ancora mancanti |
| 5. Episodio → relazione pertinente | Policy proposta sull'inventario completo, finalità indipendente verificata, ciclo e assessment esplicitamente incluso; nessuno scope creato |
| 6. Audit, verifica finale e revoca | Fingerprint cambia al variare delle revisioni; revoca e riassegnazione rifiutano nuove review. Porta audit atomica e revoca reale rimangono da implementare; il candidato non può diventare rilascio |

Nessun nuovo adapter Auth/SQL/HTTP, endpoint staff o writer installato. I modelli di fixture non sono seed/record DB e non esiste alcun percorso runtime che importi il nuovo modulo; guardie statiche lo verificano. Nessuna duplicazione di operatori, identità, sessioni, contatti, assignment o ledger.

## 5. Policy V1, ancora PROPOSED

Radar autonomo non autorizza lettura commerciale. Evento CONFIRMED, identità/finalità/episodio verificati e responsabilità corrente coerente possono produrre un candidato **prima dell'evento**, con attendance UNKNOWN; nessun requisito generale di presenza. Consulenza solo con richiesta esplicita verificata. PENDING, NO_SHOW e pratiche chiuse non concedono automaticamente accesso. Reclutamento Architetti escluso. Responsabili discordanti negano la review fino a risoluzione. Riassegnazione esclude il precedente responsabile nelle richieste successive; lo storico richiede scope esplicito al nuovo. Nessun bypass supervisor e nessun binding da uguaglianza email. I modelli precedenti già rispettavano queste regole; aggiunti casi espliciti di composizione e pre-evento, senza modificare transizioni o policy operative.

## 6. Test positivi, negativi e preservazione

Log locali esterni al repository: `C:\Users\emanu\.codex\visualizations\2026\10\18\01a14e5a-6067-71a0-a210-f3859cab8329\radar-patrimoniale-4d2c`. JSON riepilogativi separano i due branch. Test con trasporti bloccati/sintetici e DB embedded; nessuno smoke con scritture reali.

| Perimetro | Esito effettivo |
| --- | --- |
| Nuovo test:patrimonial-radar-controlled-linking | PASS: Evento futuro CONFIRMED/attendance UNKNOWN, Consulenza esplicita, 27 negativi, mixing soggetti, revoca post-candidato, riassegnazione/storico, fingerprint e isolamento |
| test:patrimonial-radar-access-contracts | PASS: binding valido/revocato/duplicato, grant presente/assente/scaduto, persona/contatto, ambiguità, CAS, policy relazioni/sessioni |
| test:patrimonial-radar-advisor-access | PASS: 64 richieste con rifiuto atteso, inclusi revoca concorrente simulata, scadenza/revoca sessione, audit assente/indisponibile/discordante e cause economiche sanitizzate |
| Advisor projection | PASS, 25 scenari sintetici |
| Motore, projection cliente, UI, backend Radar | PASS comandi esistenti; backend 14 gruppi su PGlite 0.5.10 / PostgreSQL 18.6 WASM |
| Metodologia 4A | 72/72 gruppi PASS; conservati 57 scenari PASS, quattro PARTIAL e CT-27 NOT RUN, senza promuovere a completa l'ACL reale |
| Radar d'Impresa | PASS dieci verificatori, sia sul Radar sia nel checkout funnel |
| Funnel, ledger, CRM, opportunità, persistenza, remote mapping | PASS sei comandi su entrambi i branch isolati |
| Presentazioni Evento/Architetto e tema | PASS sul Radar, compresa revisione finale e relativi asset |
| Preservazione integrazione | PASS Radar v4/34 schermate, 56 file Radar main, 11 file CRM funnel, migration/lock protetti, 35 fotografie byte-identiche |
| Radar build / typecheck | PASS build standard completa, 145 pagine; typecheck PASS |
| Radar lint | PASS globale: 0 errori, 65 warning preesistenti; nuovo modulo/test senza warning |
| Funnel P1/P2B/P2A/capability/P3B/route | PASS completi, vedi sezione 2 |
| Funnel build Turbopack | FAIL ambientale: junction dipendenze fuori root |
| Funnel build alternativa Webpack / typecheck | FAIL preesistente: export isAuthorizedInternalPreflightRequest non ammesso da Next nella route AI Score provider-preflight, sorgente invariato a 8fd4feb |
| Funnel lint globale | FAIL preesistente: prefer-const in patrimonial-performance-highlevel.ts:148, 66 warning; sei script della patch senza errori/warning |
| PostgreSQL nativo / PostgREST locali | **NOT RUN**: binari non disponibili nel PATH, daemon Docker non raggiungibile; nessun servizio installato/avviato |
| Auth reale, audit Advisor DB, revoca multiconnessione, phantom/deadlock | **NOT RUN**, prerequisiti autorevoli mancanti; simulazioni non sostituiscono questi test |
| Browser in questa fase | **NOT RERUN**: nessuna modifica UI; nessuna nuova attestazione visiva. Restano le evidenze browser sintetiche delle fasi precedenti |
| Live-smoke storico Radar | NON RIESEGUITO, precedente FAIL della guardia Git non promosso a PASS; nessuno smoke operativo |

## 7. Sicurezza, migration e contratti bloccati

Nessuna nuova migration candidata: schema Radar remoto assente, privilegio sessione del runtime insufficiente, autorità amministrativa/evidenze non approvate e protocollo atomico non implementato. Non sono stati inventati FK, ruoli, grant o colonne Auth. La candidata 4C.1 e tutte le migration storiche restano identiche. RLS, permessi minimi, nessuna lettura diretta dossier per anon/authenticated e nessun SECURITY DEFINER aggiunto.

I dinieghi del compositore contengono soli codici tecnici; nessun dato economico, PII, eccezione raw o dossier. Il servizio accesso preesistente continua a richiedere audit finale e doppia verifica dell'autorità: test di audit indisponibile/revoca concorrente tutti PASS locali. Nessuna cache autorizzante o candidato riutilizzato dal runtime. Non si rivendica una revoca di byte già restituiti.

Restano bloccati: issuer/policy Hub effettivi; session verifier con privilegi approvati; autorità di gestione identità/permessi; prova persona–contatto e lifecycle/evidenze; approvazione operativa della policy/scope; installazione/inclusione DB Radar e P1 nel percorso applicativo; audit e fencing transazionali verificati con DB nativo/PostgREST. In aggiunta, il branch funnel remoto corrente necessita dei due correttivi applicativi build/lint documentati prima di una futura integrazione. Non sono stati corretti ampliando questa patch a UI/API AI Score o codice P3B.

Nessun push, merge su main, deploy, db push, migration/applicazione remota, HighLevel, email, segreto, variabile di produzione, modifica assegnazioni o flag operativo. Le uniche operazioni remote della fase sono lettura HEAD Git e introspezione metadati Supabase read-only.

## 8. File e commit locali distinti

Branch Radar, sei file:

1. src/lib/patrimonial-radar-advisor/controlled-linking-review-proposal.ts
2. scripts/verify-patrimonial-radar-controlled-linking.mjs
3. package.json — solo comando test, nessuna dipendenza
4. docs/patrimonial/radar-patrimoniale-v1-topology-4d2c.sql
5. docs/patrimonial/radar-patrimoniale-v1-topology-4d2c.json
6. questo report

Commit Radar identificato nella consegna e con git log -1 sul report, evitando hash autoreferenziale. Il branch correttivo funnel ha il commit a7c2b925a01c87ee2bfa480419d3bea02e6cd7bc, sei script e il relativo report; il suo branch rimane locale anche dopo rimozione del worktree temporaneo. Nessuno dei due commit comprende file concorrenti o configurazioni locali.

Branch correttivo funnel, sette file esatti:

1. scripts/patrimonial-protected-baseline.mjs
2. scripts/verify-patrimonial-assignment-management.mjs
3. scripts/verify-patrimonial-owner-sync.mjs
4. scripts/verify-patrimonial-owner-readiness.mjs
5. scripts/verify-patrimonial-ledger.mjs
6. scripts/verify-patrimonial-p3b-route-contract.mjs
7. docs/patrimonial/patrimonial-verifier-stabilization-4d2c.md


## 9. Readiness

**Pronta la revisione locale verificabile dei collegamenti; NON READY il collegamento operativo Advisor.** Chiusi i due verificatori, dimostrata la co-residenza Auth/P1 e identificati impedimenti concreti invece di presumere la topologia. Il modello non autorizzante e le regressioni sono verificati; non esistono ancora condizioni sufficienti per grant/binding reali o nuove DDL. Restano approvazioni e adapter autorevoli, privilegi, persistenza Radar, audit/fencing e prove native. Fermata al termine della Fase 4D.2C, senza rilascio o prosecuzione automatica.
