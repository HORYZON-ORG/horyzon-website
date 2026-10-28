# Radar Patrimoniale — correzioni dei blocchi 5D

Data: 26 ottobre 2026. Ambito: **solo codice, candidate SQL, prove e commit locali**.

**I tre difetti Website originali sono risolti.** Il verificatore 5D originale è rimasto identico e passa tutti e quattro i controlli. La candidata SQL è stata circoscritta e collaudata; Hub integra la 5C conservando selezione, inviti e permessi del main verificato.

**Correttivo ACL finale: PASS locale, 38 gruppi nativi.** Riprodotto prima il diniego HTTP 403/SQL 42501 con gli ACL Horyzon comunicati; corretto l'ingresso account nello schema `hub`, senza concedere USAGE su `public`. Il corpo della funzione protetta e le autorizzazioni delle RPC Hub preesistenti restano invariati. Nessun collaudo remoto è stato eseguito.

**GO per la revisione delle correzioni locali; NO-GO all'attivazione remota e al pubblico.** Restano le autorizzazioni e verifiche operative della matrice seguente. Non servono una nuova architettura, broker, issuer, PoP, container o nuovi servizi HighLevel.

Questo report aggiorna il preflight del commit `15560b000c4e490b608bf25ee049a611462866e7`. Le [evidenze iniziali](preview-5d-evidence/manifest.json), inclusi i tre FAIL precedenti, restano conservate. Le istruzioni SQL correnti sono esclusivamente quelle della nuova catena qui sotto: **non applicare cumulativamente M2/M3 storiche e alternative 5D**.

## SHA, worktree e conservazione

| Repository | Punto di partenza | Commit locale del codice verificato |
| --- | --- | --- |
| Website | Correttivo ACL da `1e5f2f141544ce26af5dace47940da4ddb06bf5a`, sopra i gate `fd060bb5b5ed618956458a3bca880562328c5ee2` e la 5C `47c2bac00913589852ebfc4df82e5e2526f69449` | **`3d186057e059f3ca4b0abd625cf749eceec5e89c`** |
| Platform | Correttivo ACL da `34122f561a6050149f15986b0272027efc72bcf2`, sopra la 5C `ba20bc08578663e3a330e014a433445a0734a429` | **`9abf8ac07f7c886b786eae0669ef34aaf1f7c41d`** |
| Hub | main verificato `2c0bfe15f1997b4add06a8b695082e2bc3127176` + 5C `abce931d47049be9998e90faa4b9b1005278c3af` | **`0f65332ef3e7f38938320f49ec79f0df6dcd4d93`** |

Radice dei worktree: `C:/Users/emanu/.codex/visualizations/2026/10/18/01a14e5a-6067-71a0-a210-f3859cab8329/fase-5d`.
Website: `website` / `codex/radar-preview-5d`. Platform e Hub: `platform` e `hub` / `codex/radar-fixes-5d`. Il commit documentale conclusivo Website è riportato nella consegna, distinto dal commit del runtime sopra.

Il correttivo usa i main acquisiti in lettura nel preflight del 26 ottobre: Website `9146f6372b19fdac6db1770d05f6b0ca10c1f1e5`, Platform `cb329b14a987a334dd2e96e103bc65b8eb0adfa1`, Hub `2c0bfe15f1997b4add06a8b695082e2bc3127176`. Non è stato effettuato un nuovo fetch durante l'intervento autorizzato solo locale. Prima di una futura operazione remota servirà una nuova verifica di drift.

**34/34 checkout preesistenti invariati**, inclusi tutti i worktree 5C e il Website originale a `b242752102542e5280bba8b6ba0c4aecf9fcd722` con 2.772 file non tracciati. Il controllo confronta HEAD, branch, diff, stato, hash degli untracked e lock; non certifica cache ignorate. Nessun reset, clean, stash o commit del lavoro concorrente.

[Inventario precedente dei file e SHA](corrections-5d-evidence/code-inventory.json): Website 16 file, Platform 2 candidate nuove, Hub 15 file rispetto al main. Il correttivo ACL tocca ulteriori **5 file Website** (client RPC, singolo pin, fixture, suite nativa e nuovo helper ACL) e **1 candidata Platform**; nessun file Hub. [Diff e preservazione del correttivo](account-acl-5d-evidence/preservation.json). Nessuna dipendenza applicativa cambiata. AGENTS.md, DESIGN.md e report 5C sono stati riletti; consultate le guide Next 16.3.5 locali per layout, Proxy e header e le checklist Supabase/Postgres/React.

## 1. Website — tre FAIL risolti

| Difetto del preflight | Correzione | Esito |
| --- | --- | --- |
| Account nativo escluso dall'isolamento | `public-mode.ts` usa lo stesso `accountConfig` della pagina e dell'API | **PASS** |
| Contesto Production accettato | Rifiuto esplicito di `VERCEL_ENV=production` e `VERCEL_TARGET_ENV=production` | **PASS** |
| Altro progetto Vercel accettato | Preview ammessa solo per `prj_bJvIOswh4GacqtUootXATXeAkSUO`, con identità deployment presente | **PASS** |

Le correzioni dei gate riguardano `account-config.ts` e `public-mode.ts`. Il correttivo ACL aggiunge soltanto `Content-Profile: hub` e `Accept-Profile: hub` al trasporto server `account-rpc.ts`, con aggiornamento del suo singolo pin dopo verifica del diff esatto. Layout, SiteDocument, Proxy, CSP, altre pagine, motore e questionario restano invariati. Nessuna directory è esclusa dai controlli. La fixture del test 5C dichiara un contesto Vercel Preview completo; i suoi assert sono conservati.

### Origin del futuro deployment

In Preview l'Origin è derivato esclusivamente dalla configurazione server `VERCEL_URL`: `https://<hostname-immutabile-del-deployment>`. Non deriva da Host, Forwarded, parametri o cookie del chiamante.
`PATRIMONIAL_RADAR_ACCOUNT_ORIGIN` può essere **omessa**; se presente deve coincidere esattamente con l'origine derivata. Alias, percorsi, query, credenziali URL, porte e hostname malformati sono rifiutati. Non occorrono un primo deployment per conoscere l'URL, un alias o un secondo deployment di bootstrap.

Restano obbligatori Origin esatto, provenienza della richiesta e CSRF; accesso al DB soltanto attraverso il server. Il contesto `local-test` è recintato a loopback e non può essere usato su Vercel. Un bundle Node in modalità production può essere collaudato localmente: il diniego remoto riguarda il contesto **Vercel Production**, distinto da NODE_ENV.

Per il futuro pilot usare l'URL immutabile corrispondente a VERCEL_URL. Non utilizzare automaticamente l'alias di branch o un dominio diverso.

### Prove del documento effettivo

[Verificatore originale invariato](corrections-5d-evidence/original-verifier-preserved.json), [4 PASS](corrections-5d-evidence/local-gates-fixed.json), [8 gruppi aggiuntivi](corrections-5d-evidence/account-gates-extended.json).

Lo script originale conserva i suoi messaggi e il campo statico `sourceCommit` storici: il risultato corrente è nelle righe `checks` e nell'exit code 0; il commit effettivamente provato è registrato nell'inventario esterno.

Sull'applicazione **compilata**, quattro server loopback con configurazioni sintetiche hanno restituito:

| Contesto simulato | Pagina Radar | API sessione | Risultato |
| --- | --- | --- | --- |
| Locale autorizzato | 200 | 401, prima del login | Documento isolato |
| Vercel Preview pilota, senza Origin preconfigurata | 200 | 403 dall'Origin HTTP locale errata | Documento isolato; provenienza non aggirata |
| Vercel Production | 404 | 404 | Percorso negato |
| Altro progetto Vercel | 404 | 404 | Percorso negato |

HTML senza tag Iubenda, Analytics, Speed Insights o Toolbar; script caricati soltanto da `/_next/`. CSP del Proxy con script/connect limitati a self, risposta Radar no-store e nessun secret sintetico serializzato. Il marker anonimo fornito dal chiamante non prevale sul Proxy. La prova HTTP della richiesta OTP usa un trasporto sintetico in memoria, verifica cookie Secure/HttpOnly/SameSite e nega CSRF assente/errato prima del trasporto.

Controllo browser reale locale: desktop 1440×1000 e mobile 390×844, introduzione e modulo identità vuoto, nessun overflow orizzontale, immagini visibili e nessuno script esterno nel DOM. [Desktop](corrections-5d-evidence/desktop-5d.png), [mobile](corrections-5d-evidence/mobile-5d.png). Nessuna compilazione con dati personali o richiesta di codice dal browser.

Home e `/radar` rispondono 200. Restano Radar d'Impresa v4 con **34 schermate**, le **35 fotografie**, i funnel Evento/Architetto, temi e tipografia. Le suite di preservazione passano.

### HTTP: limiti mantenuti visibili

Il test documentale completo esce **1**, per un controllo aggiuntivo esatto su `Vary: Accept`: in locale la risposta Markdown espone soltanto `Vary: Accept-Encoding`. Non è stato usato il falso positivo `includes('Accept')` per dichiararlo PASS.

Il [confronto prima/dopo](corrections-5d-evidence/http-baseline-comparison.json) usa una copia separata dell'artefatto 5C, con il suo Markdown generato identico: entrambi rispondono 200, Markdown 5.796 byte e stesso Vary privo di Accept. Anche HTML home (90.149 byte), Vary e policy `private, no-store` coincidono. Quindi il comportamento locale è **preesistente**; nessuna correzione a home, Proxy o routing è stata introdotta in questo intervento. Questo confronto non prova il comportamento del CDN Vercel.

Il difetto **ETag mancante nelle risposte HTML 304 rimane FAIL storico aperto**, non ritestato su remoto, non risolto né riclassificato. Nessun ticket inviato e nessun GO pubblico.

## 2. Candidate SQL circoscritte

Catena minima corrente, **non applicata in remoto**, nel progetto Supabase `pmkyeqrfkunypfkbjnyg`:

| Passo | File | SHA256, testo normalizzato LF |
| --- | --- | --- |
| M1 invariata | Website `supabase/migrations/20261018191940_patrimonial_radar_identity_sessions.sql` | `4b121673988723f407017a0ef1720dbe2bcb7b0002c6a0d88d012472c8923543` |
| **M2-5D alternativa** | Platform `packages/database/pending/20261026160057_patrimonial_radar_preview_foundation.sql` | `83a9c7077324d1e98f991622d9bacc008e30aa54467d618f29c8984f81e7f7ca` |
| **M3-5D alternativa, corretta ACL** | Platform `packages/database/pending/20261026160106_patrimonial_radar_preview_auth.sql` | `2c509fbb8f484745ce961241803f33081fa9865dfbe33967957856b6273f8191` |

I due nuovi nomi sono stati generati con Supabase CLI `migration new`. Le candidate storiche restano intatte: M2 `20261021171340` e M3 `20261026123529` **non devono essere applicate insieme alle alternative**. Nessuna migration già applicata viene riscritta o ripetuta. Sono esclusi i bundle 5B di attivazione broker/issuer/PoP/container e i duplicati della fondazione 5A.

M3-5D è ancora una candidata mai applicata: è stata corretta localmente nello stesso file. Il suo precedente hash `787c1b0950ae966a3ac8747edf30aadf1a2c120287df2fec6823fd0b39d666fe` è superato e conservato nelle evidenze. **M1 e M2-5D hanno gli stessi hash della baseline.** [Catena corrente e hash](account-acl-5d-evidence/migration-chain.json).

### Riduzione dell'impatto

- **Nessun trigger né hook nuovo su public.patrimonial_requests.** Eliminata dalla candidata l'acquisizione Evento incondizionata.
- **Nessun backfill.** Se M1 contiene già assessment, M2 richiede una revisione esplicita e si arresta.
- I nuovi ingressi Radar sono chiusi finché manca o è disabilitata la riga del **gate HMAC M3 esistente**. Nessuna seconda autorità di attivazione: il piccolo helper SQL consulta quel gate e restituisce false prima dell'installazione di M3.
- A gate OFF, comando e snapshot Architetti delegano alle implementazioni correnti conservate. Un contatto senza Radar mantiene il contratto precedente, anche senza nuovo requestId.
- A gate ON, il comando corrente continua a gestire contatto e opportunità HORYZON_OPPORTUNITY; l'estensione sincronizza **solo RADAR** tramite P1. Nessun secondo registro di responsabilità.
- Il collegamento del solo account verificato legge richieste canoniche e registrazioni Evento/ingressi correnti. Non installa un collettore globale. Nome/email discordanti, duplicati o provenienza insufficiente rimangono in review.
- Le due viste conservano gli stessi assessment e snapshot. Nessun risultato finanziario viene copiato nel ledger amministrativo o nei contatti.
- Dopo una riassegnazione operativa durante gate OFF, la riapertura non riabilita un vecchio Advisor su una proiezione incoerente: il report è negato, il caso emerge nella review e serve una riassegnazione P1 esplicita.

### Modifiche globali residue — richiedono approvazione

La candidata **non è innocua per il backend condiviso**:

| Oggetto condiviso | Modifica inevitabile nella candidata |
| --- | --- |
| `patrimonial_intents_kind_check` | Aggiunge RADAR |
| `patrimonial_intents_funnel_check` | Aggiunge patrimonial-radar |
| `patrimonial_radar_intent_minimal` | Nuovo vincolo: intent Radar minimale, senza risultati finanziari o routing CRM |
| `patrimonial_lead_snapshots_funnel_check` | Estende il funnel ammesso |
| `public.patrimonial_assignment_guard()` | Estensione puntuale del tipo RADAR |
| `public.patrimonial_assignment_commit(jsonb,bigint)` | Estende il controllo di revisione a RADAR, conservando il comportamento corrente HORYZON_OPPORTUNITY |
| `public.patrimonial_store_capabilities()` | Riconosce il nuovo fingerprint P1 revisionato |
| `architetti_private.command(text,jsonb)` e `snapshot(text)` | Conserva le versioni correnti con suffisso pre_clienti e inserisce wrapper condizionati al gate |
| Nuove tabelle/RPC/trigger privati e ACL specifiche | Fondazione Radar, audit, sessioni e permessi; dati vuoti e gate chiuso all'installazione |

La transazione usa lock_timeout 5s e statement_timeout 60s. Vincoli e definizioni condivise richiedono comunque lock e invalidazione delle cache dei piani; a gate OFF resta il costo della delega/lettura del gate. Servono finestra, backup e controllo post-migration approvati.

M2 verifica esattamente le definizioni di cinque funzioni condivise — guard, commit, capabilities, command e snapshot — prima di modificarne i vincoli. Drift di sorgente o configurazione causa arresto. La prova negativa modifica solo una configurazione sintetica in transazione e dimostra il rifiuto, poi esegue rollback.

### Rehearsal effettivo e limiti

[Rehearsal finale con ACL corretti](account-acl-5d-evidence/native-acl-result.json): **38 gruppi PASS**, PostgreSQL 17.6/PostgREST 16.5 loopback separati, più le verifiche preliminari di gate e baseline. La precedente [prova da 33 gruppi](corrections-5d-evidence/native-result.json) rimane come evidenza storica; non certificava gli ACL di schema ora corretti.

Ricostruzione del perimetro rilevante con DDL canonico e metadati acquisiti nel preflight: **55 definizioni di funzione corrispondenti, 30 stati RLS e 60 vincoli confrontati**, incluse le quattro evoluzioni training successive al precedente replay. pgcrypto è nello schema **extensions**, come nel progetto condiviso. Una copia di fixture perde soltanto una riga vuota finale: hash upstream e trasformazione sono dichiarati nel manifest.

Le prove comprendono: gate OFF; snapshot/RPC Evento correnti; account e sessioni sintetici; MAC assente/forgiato; secondo assessment; concorrenza e replay; sessione scaduta/revocata; accesso tra soggetti; grant Advisor, revoca e riassegnazione; due viste canoniche; Eventi senza ledger storico; caso misto Radar/opportunità; riapertura con drift di responsabilità. L'accesso diretto authenticated alle tabelle finanziarie e alla RPC generica è negato.

### Correttivo ACL finale — ingresso account ristretto

Il referente ha fornito i riscontri in lettura del progetto `pmkyeqrfkunypfkbjnyg`: authenticated ha USAGE su `hub`, authenticated e anon non hanno USAGE su `public`, RPC Hub con EXECUTE selettivo, schema Radar assente e fingerprint P1 `753e1a961d78bb0f7faf0fdd026452f9`. Sono i dati di partenza, **non nuove letture remote di questo intervento**.

Prima della correzione, la catena M1→M2-5D→M3-5D è stata eseguita con questi ACL nella fixture nativa: account/sessione validi e gate sintetico aperto producevano **SQL 42501 e HTTP 403, permission denied for schema public**. [Riproduzione prima della correzione](account-acl-5d-evidence/before-fix.json).

La candidata crea ora **`hub.patrimonial_radar_account_command(text,text)`**, direttamente SECURITY DEFINER con `search_path=pg_catalog`; nessun wrapper INVOKER e nessun nuovo ingresso account in `public`. Il corpo di sicurezza è identico alla baseline: sessione nativa presente e corrente, email confermata, subject/session_id coerenti, parametri/contratto/metodi ammessi, MAC server, gate SQL, vincoli di proprietà e nuovo controllo prima del commit. L'autorità non deriva da personId, ruolo o assegnazione inviati dal client. I riferimenti privati sono qualificati per schema.

EXECUTE viene revocato a PUBLIC, anon, authenticated e service_role, poi concesso soltanto ad authenticated; resta il diritto del proprietario della funzione. Nel rehearsal il proprietario è postgres. La funzione pubblica generica resta senza EXECUTE per authenticated. Nessuna candidata concede USAGE pubblico, accessi a tabelle private o service-role al browser. **Owner, ACL effettivi e schemi Data API devono essere ricontrollati sul provider prima dell'attivazione.**

Il client server seleziona esplicitamente `hub` in entrambi gli header PostgREST. Senza il profilo corretto il vecchio nome in public è assente: HTTP 404/PGRST202, diverso dal 403 originario quando quella funzione esisteva ma lo schema era negato. È verificata separatamente la permanenza di USAGE=false. I grant della fixture su public ad anon/authenticated sono stati rimossi; nessun grant compensativo è stato aggiunto.

| Verifica finale nativa/PostgREST | Esito |
| --- | --- |
| authenticated/public=false, anon/public=false, authenticated/hub=true prima e dopo M1→M2→M3 | **PASS** |
| Account valido: sessione, creazione, salvataggio, secondo assessment e storico | **PASS** |
| Sessione assente, session_id assente/ignoto, sessione scaduta/revocata, JWT scaduto | **PASS — negati** |
| Account A legge/modifica B; MAC valido con hash sessione altrui | **PASS — negati** |
| Nuovo utente Radar verso amministrazione candidature, modifica candidature, ricerca account, snapshot Rete e assegnazione contatto | **PASS — cinque HTTP 403/42501**, guardie CANDIDATE_ACCESS_DENIED/FORBIDDEN/NETWORK_ACCESS_DENIED effettivamente raggiunte |
| Operatore Hub senza Advisor; Advisor precedente dopo riassegnazione/revoca | **PASS — negati** |
| Advisor con grant corrente e assegnazione P1 coerente | **PASS — dossier consentito** |
| Tabelle Radar private, gate HMAC, sessioni Auth, funzioni pubbliche generiche/amministrative, scrittura ruoli Hub | **PASS — negati** |
| Owner/ACL delle **23 RPC Hub preesistenti** dopo l'intera catena | **PASS — invariati** |
| P1, Evento, opportunità, Rete Architetti, gate OFF, due viste canoniche e revoca | **PASS**, mantenuti i 33 gruppi precedenti |

**Limiti espliciti:** non è un clone completo del database né un test GoTrue/gateway Supabase reale. Auth e firma JWT sono sintetici. La fixture Auth minima non concede USAGE su auth: la SELECT diretta a hub.user_roles viene negata quando RLS valuta auth.uid(), non prova la visibilità RLS del provider reale. Questo esito è registrato e non è stato corretto concedendo privilegi; le cinque prove RPC amministrative verificano invece che il diniego provenga dalle rispettive guardie reali, senza errore sullo schema auth. Tabelle private e funzioni sottostanti hanno prove ACL distinte. Restano da collaudare signup/OTP, refresh/revoca GoTrue, Data API e ACL del progetto effettivo.

[Comandi del rehearsal](account-acl-5d-evidence/commands.json), [risultati e ACL](account-acl-5d-evidence/native-acl-result.json), [conservazione del corpo e del verificatore](account-acl-5d-evidence/preservation.json). Per le regole generali consultate: [PostgreSQL SECURITY DEFINER](https://www.postgresql.org/docs/17/sql-createfunction.html) e [Supabase schemi API](https://supabase.com/docs/guides/api/using-custom-schemas). Le ricette di grant generali della documentazione non sono state adottate.

## 3. Hub — consolidamento con main

Merge locale con due genitori verificati: main `2c0bfe15…` e 5C `abce931d…`. Nessun merge su main e nessun push.

Un conflitto Git in `NetworkWorkspace.tsx`: mantenuti **Clienti** e filtri Radar dalla 5C, **Architetti attivi** e filtro del ruolo architect da main. Sidebar e route si sono integrate automaticamente e sono state riviste semanticamente.

Una differenza di autorizzazione richiedeva una decisione esplicita: la 5C apriva la Rete a ogni profilo interno; è stata **conservata la restrizione corrente a superadmin**. La nuova sezione Radar resta distinta e le RPC applicano i permessi nominativi; la semplice assegnazione o il ruolo superadmin non sostituiscono il grant Advisor.

Sono verificati identici a main i file di selezione, inviti/abilitazione di account esistenti, descrizione dei ruoli, Auth e root route, oltre alla route Rete. [Hash di preservazione](corrections-5d-evidence/hub-main-preserved.json). La generazione delle route conserva sia selezione-architetti sia radar-patrimoniale. Formattazione limitata ai file già toccati dal merge.

Le due viste usano il dossier canonico già esistente, senza nuovo motore o archivio. Il test SQL confronta gli ID degli snapshot dalla lista indipendente e dal dettaglio Clienti. Il browser reale con login Hub/provider effettivi rimane NOT RUN.

## 4. Risultati delle verifiche

[Evidenze iniziali delle correzioni](corrections-5d-evidence/results.json); per il correttivo finale fanno fede [38 gruppi ACL nativi](account-acl-5d-evidence/native-acl-result.json), [qualità](account-acl-5d-evidence/quality.json), [19 regressioni Website e test Hub](account-acl-5d-evidence/regressions.json), [manifest e SHA verificati](account-acl-5d-evidence/manifest.json).

| Controllo | Esito |
| --- | --- |
| Verificatore 5D originale | **4 PASS / 0 FAIL**, file e assert invariati |
| Gate/Origin/CSRF aggiuntivi | **8 gruppi PASS**, nessun provider contattato |
| HTML/layout/Proxy/CSP e diniego Production/altro progetto | **PASS locale** su build effettiva |
| Test documentale HTTP complessivo | **FAIL** per Vary: Accept preesistente, esplicitamente distinto dall'isolamento |
| Desktop/mobile | **PASS locale**, introduzione e modulo vuoto; nessun OTP inviato |
| Rehearsal SQL con ACL reali e flussi P1/Evento/Architetti/Radar | **38 gruppi PASS** + precondizioni e prova negativa di drift |
| Suite Website pertinenti | **19/19 PASS**: Radar v4, patrimoniale, projection, Advisor, backend, UI/public, funnel, ledger, CRM, opportunità, persistenza, mapping, presentazioni, assegnazioni |
| Website build / typecheck | **PASS / PASS** |
| Website lint | **PASS mirato sul correttivo ACL**, 0 errori / 0 warning; controllo globale precedente 0 errori / 76 warning preesistenti |
| Hub build | **PASS** |
| Hub test | **201 PASS**, 0 FAIL, 941 assert, 27 file |
| Hub lint sui file rivisti | **PASS**, 0 errori / 2 warning |
| Hub typecheck globale | **FAIL storico**, 82 errori; identici al main dopo generazione delle route; non ripetuto nel correttivo ACL, Hub invariato |
| Hub lint globale | **FAIL storico**, 513 errori / 15 warning; non ripetuto nel correttivo ACL, Hub invariato |
| Originali/worktree concorrenti | **34/34 invariati** |
| Auth, SMTP, OTP, refresh e gateway Supabase effettivi | **NOT RUN** |
| Backup/restore verificato, grant reali e Preview nuove | **NOT RUN** |
| ETag HTML 304 remoto | **FAIL storico aperto**, non ritestato |

Il typecheck main senza rigenerare route mostrava 84 errori; dopo build ne mostra 82, identici alla versione integrata. Non sono stati cancellati test o errori per dichiarare PASS. [Diagnostici lint globali](corrections-5d-evidence/hub-lint-diagnostics.json) e log TypeScript restano consultabili.

La prima build Website nel sandbox falliva sulla creazione di junction Windows; la ripetizione con il permesso locale appropriato è riuscita. Nessuna modifica di bundler o configurazione prodotto per aggirare il problema.

Nel correttivo ACL la build e il typecheck Website sono stati ripetuti e passano. Le 19 regressioni hanno avuto un primo esito 18 PASS/1 FAIL ambientale: il backend non poteva collegarsi al proprio socket loopback per EACCES del sandbox. Ripetuto **soltanto quel test identico** con il permesso locale appropriato: 14 gruppi PASS, risultato finale 19/19. Gli esiti di entrambi i tentativi sono conservati. Hub: ripetuti 201 test, 941 assert, tutti PASS; nessun codice Hub modificato. Le prove browser/HTTP di layout sopra sono quelle del correttivo precedente e non sono state ripetute per due header esclusivamente server.

I servizi temporanei 5D sono stati spenti, il viewport browser ripristinato. Dati e credenziali delle fixture sono esclusivamente sintetici e restano fuori dagli artefatti pubblicabili; non sono stati creati account operativi o segreti reali.

## 5. Matrice dei requisiti remoti ancora necessari

Nessuna riga è autorizzata o eseguita da questo correttivo. Ogni operazione deve specificare destinazione, artefatto/diff, identità e impatto.

| Requisito | Destinazione e prerequisito concreto | Stato / approvazione necessaria |
| --- | --- | --- |
| Backup e restore | Supabase `pmkyeqrfkunypfkbjnyg`: ID/data/stato/retention, export custodito cifrato, RPO/RTO e prova di recupero in ambiente esplicitamente autorizzato | **NOT VERIFIED / NOT RUN**; nessun export clienti o restore effettuato |
| Preflight DB e migration | Stesso progetto: ricontrollare drift rispetto agli ACL forniti, fingerprint P1, owner/EXECUTE selettivo della RPC hub, esposizione Data API, RLS e dipendenze; approvazione separata di M1→M2-5D→M3-5D con gli hash correnti sopra | ACL riprodotti localmente con PASS; **applicazione non autorizzata**, impatto condiviso da accettare |
| Supabase Auth e SMTP | Leggere configurazione signup, conferma email, template OTP, redirect, rate limit, sessioni e SMTP; preparare un diff soltanto se necessario | **NOT VERIFIED**. Configurazioni condivise con Hub/altri prodotti: nessuna modifica o invio implicito |
| HMAC server dedicato | Solo runtime Preview Radar e `account_gate` SQL. Chiave derivata `SHA256(UTF8("account-rpc-5c" + NUL + identitySecret))`, 32 byte, gate inizialmente false | **Non creato**; approvare custodia, consegna, seed, rotazione e revoca. Mai NEXT_PUBLIC/VITE, argomenti CLI o log |
| Staff nominativo | UID e operatori esistenti approvati, permessi LIST/PERSON/ASSIGN/ADVISOR strettamente necessari e a scadenza; P1 unico assegnatore | **Identità/grant non forniti né creati**. Rete conserva il ruolo superadmin; nessuna promozione implicita |
| Preview Radar | Team horyzon-consulting, progetto `horyzon-radar-pilot` / `prj_bJvIOswh4GacqtUootXATXeAkSUO`; solo SHA approvato, target effettivo Preview, Vercel Authentication all, URL immutabile | **Nessun deploy autorizzato/eseguito**. Verificare target/metadati e valori dei gate sul nuovo artefatto |
| Preview Hub | Progetto `horyzon-hub` / `prj_RltJaUziQT9bOGVwWQueRb2KfEjv`; solo SHA approvato e URL vercel.app protetto | **Nessun deploy autorizzato/eseguito**. Prima verificare ambiente effettivo e secret Preview ereditati, senza rimuovere quelli di altri sviluppi |
| OTP e report sintetico | Casella di prova nominalmente approvata, budget invii, accesso Vercel individuale, due operatori autorizzati, scenario inventato | **NOT RUN**. Approvare separatamente account, email e scritture di prova; nessun invito team o bypass condiviso |
| Privacy e retention | Approvare informativa di persistenza, finalità, destinatari, conservazione/cancellazione e normali dati tecnici di accesso | **Approvazione mancante**; nessuna attestazione legale certificata |
| HighLevel e automazioni | Nel solo artefatto pilota verificare flag commerciali OFF e assenza di credenziali/routing non necessari | **Nessuna attivazione**; nessuna scrittura o prova outbound autorizzata |
| Collaudo effettivo | OTP→Radar→persistenza→secondo assessment→Evento→due viste Hub→P1/Advisor→diniego/revoca; mobile/desktop e controllo log/storage/script dell'artefatto reale | **NOT RUN**; i PASS locali non lo sostituiscono |

Il pilota Vercel esistente `dpl_WHyLB43axP3D8H9MSqNGEYFRzdxj` contiene ancora `accd6b70…`, non queste correzioni. Nel preflight era READY nello slot Preview con campo API target letteralmente null; non va usato come prova della 5C/5D. La prima Production pilota `dpl_7RDwRCmd7fYc6UE28jJYHyAcvVcz` è rimasta intatta.

L'inventario precedente rileva solo i sette flag storici Preview nel pilota e segreti generali Preview Hub, inclusi SERVICE_ROLE e OPENAI_API_KEY, che il percorso nativo non richiede. Nessun valore è stato letto o modificato. Non presumere isolamento degli ambienti o assenza di Shared da campi null. Identificatori Analytics/Speed Insights presenti nei metadati non provano assenza o presenza degli script sul prossimo deployment: ricontrollare l'artefatto effettivo.

Non fare push Website come semplice trasporto del codice: il progetto Website collegato a Git può creare automaticamente una Preview diversa dal pilota protetto. Nessun push, Git link, alias su horyzon.it, promozione o deploy è compreso nella consegna.

## 6. Rollback e arresto

Per una futura finestra autorizzata: chiudere prima il gate SQL e il flag account Preview; revocare soltanto sessioni, grant e accessi del test identificati. Il gate OFF conserva i comandi correnti, ma **prima di riaprire** controllare la coerenza contatto/P1; un dossier incoerente è negato anche se l'Advisor precedente possiede ancora il grant.

Conservare persone, assessment, snapshot e audit. Nessun down distruttivo o restore globale come rollback ordinario. Backup delle definizioni/ACL precedenti e procedura di ripristino delle funzioni condivise devono essere approvati prima di M2. Un restore del progetto Horyzon è una procedura d'incidente con impatto su tutti i prodotti, non soltanto sulla Preview.

**Correzioni locali concluse; tre FAIL Website effettivamente risolti e ACL finale PASS.** Il prossimo passo è l'autorizzazione del collaudo remoto con i prerequisiti della matrice, non altro sviluppo. Website e M3 corretta devono essere approvati come coppia: il nuovo client seleziona hub e non usa la vecchia RPC public. Per una futura revoca chiudere i gate, conservando dati e audit; non ripristinare grant generali o candidate obsolete.

L'attivazione remota resta NO-GO finché la matrice non è soddisfatta e autorizzata per destinazione. Il pubblico resta NO-GO anche per il contratto HTTP aperto. Nessun push, deploy, migration remota, modifica Auth/SMTP, email, grant reale, scrittura HighLevel o modifica di produzione è stato eseguito. **Arresto dopo report e commit locali.**
