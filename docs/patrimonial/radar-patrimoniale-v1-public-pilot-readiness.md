# Radar Patrimoniale V1 — Public pilot readiness, Fase 4P.1

19 ottobre 2026. **Candidata locale pronta per revisione e successiva Preview separata; NO-GO alla pubblicazione sul dominio in questa fase.** Non pubblicata, flag remoti non letti né modificati. Il GO operativo richiede le approvazioni e i controlli di ambiente indicati sotto.

## 1. Isolamento e riferimenti

Branch dedicato `feat/radar-patrimoniale-public-pilot`, worktree `C:\Users\emanu\.codex\worktrees\radar-public-pilot\horyzon-website`. Creato esattamente da **ac56a874ef6a7aefb948c45c738ea9df4b91e0ca**. Nessun merge/cherry-pick P1/P2B o import delle revisioni funnel successive.

Letti AGENTS, DESIGN e i report 4A–4D.2C; guide Next installate su layout, route e Proxy/CSP; applicate le skill di verifica e revisione React. Inventariati i tre worktree attivi e i branch locali (inventario completo nei log QA). Al controllo remoto read-only main=9146f6372b19fdac6db1770d05f6b0ca10c1f1e5, funnel=8fd4feb229871b135f11f614247fd8df444df76e; nessun branch Radar/public-pilot restituito da ls-remote. Il main locale b0b62e686bd120e2770e2408bc7a14fd59593e92 non è stato spostato.

Checkout assegnazioni originale ancora b242752102542e5280bba8b6ba0c4aecf9fcd722, stesso branch e soli non tracciati audit Fase 1 e tmp/. Worktree Radar principale ancora ac56a87, pulito. Nessun file concorrente modificato, spostato, cancellato o incluso. Il branch correttivo P1/P2B a7c2b925a01c87ee2bfa480419d3bea02e6cd7bc è rimasto separato. Nessun processo Git concorrente rilevato.

## 2. Architettura effettiva

```text
Flag server → /radar-patrimoniale
  PUBLIC_ANONYMOUS
    → documento senza script terzi → AnonymousRadarClient
    → QuestionFields/GoalsFields/MoneyInput 4B riutilizzati
    → risposte e bozze nella sola memoria React
    → recordAnswer/resolveAnswers/validateValue/diagnose del dominio 4A
    → customerProjection pura → ResultPreview con testi per modalità anonima

  VERIFIED_PERSISTENT
    → solo gate locale preesistente + nuovo flag esplicito
    → client 4C.2, API/sessioni e backend 4C.1 preservati
    → sempre negata su Vercel/contesti pubblici
```

Nessun secondo scoring o catalogo diagnostico. Dominio 4A, versioni, formule, soglie, ID, opzioni e dipendenze invariati. Il nuovo client riprende il flusso in memoria della 4B, separato dal client persistente; non importa radarApi, store, Auth, Advisor o CRM. La proiezione cliente viene riutilizzata, senza copiarne la logica: l'unico cambiamento nel suo modulo è il parametro TypeScript `Pick<Snapshot,'result'>`, coerente con ciò che la funzione già leggeva. Il corpo è identico al commit iniziale.

Risultato: sei settori descrittivi uguali, fotografia generale, massimo due punti di forza supportati, priorità ed eventuali altri fatti, informazioni insufficienti, dettagli delle sei aree e obiettivi effettivamente dichiarati. Nessun voto globale, proposta di prodotti, rendimento o prenotazione. Gli stati derivano soltanto dal motore; risultato e bozze non escono dal browser.

Il passaggio futuro alla persistenza non richiede un altro motore. Oggi non esiste migrazione/reconciliation delle risposte anonime, nemmeno per uguaglianza email. Chi desiderasse una versione persistente dovrà iniziare un percorso separatamente autorizzato.

## 3. Esperienza umana e revisione delle 40 domande

Confronto integrale prima/dopo di domande e aiuti: [revisione del linguaggio](radar-patrimoniale-v1-public-pilot-language-review.md).

Tutte le 40 domande e le rispettive modalità sono state esaminate. Sei titoli semplificati nel solo livello di presentazione: S03/S04, A03, C04, E01, X06. Aiuti canonici conservati con ragioni sintetiche per i dati delicati e libertà esplicita di non conoscere/non comunicare. Eliminati dai testi pubblici i rimandi tecnici C04/A02/B02, conservandone il significato. Variante pensione F02 mantenuta.

Semplificazioni scartate e documentate: S02 limitata a entrate/spese restringerebbe la completezza del perimetro; D02 formulata come intenzione futura cambierebbe la strategia già individuata. Nessuna di queste modifiche diagnostiche è stata applicata. E02 conserva la distinzione fra singola esposizione e macrovoce; X07 conserva l'esercizio numerico, spiegandone il carattere facoltativo e senza voto.

L'introduzione parte dai progetti personali. Non è stato anticipato un campo obiettivi prima del perimetro: dipendenze e riconferme rimangono quelle approvate. Le 29 ordinarie si adattano alle risposte; gli 11 approfondimenti restano facoltativi. Si può chiedere una lettura parziale, tornare alle risposte, confermare modifiche o ricominciare. Una bozza non confermata non entra nel risultato e viene segnalata.

Fasce come scelta iniziale, stime e zero esplicito; importi esatti non obbligatori. UNKNOWN, DECLINED, UNANSWERED e non applicabilità verificata restano distinti. I testi non attribuiscono valore personale a risparmi, debiti o mancata conoscenza. La comprensione effettiva richiede comunque il pilot con volontari: nessuna validazione cognitiva dichiarata dai soli test software.

## 4. Informativa anonima e sito esistente

Prima dell'avvio, vicino al pulsante, e durante il percorso è visibile che le risposte:

- restano solo nella memoria della scheda durante la sessione;
- non vengono inviate a Horyzon;
- non vengono salvate o recuperate;
- possono andare perse chiudendo o aggiornando la pagina;
- non richiedono registrazione, email o dati identificativi.

L'approfondimento «Le risposte e la tua riservatezza» distingue queste risposte dalle normali richieste tecniche di pagine, immagini e font. Il testo è una bozza soggetta a revisione, non una certificazione GDPR. Nessuna promessa di email, dossier conservati, appuntamenti o recupero successivo.

La shell ordinaria carica Iubenda. Nel documento anonimo il layout **omette** configurazione e script Iubenda; il resto del sito mantiene la shell preesistente. Non ci si limita a nascondere il banner o sperare nel consenso. Non sono stati aggiunti analytics, session replay, beacon o monitoraggi del questionario.

Il layout condiviso App Router potrebbe ereditare codice da una pagina precedente: prima di mostrare controlli, il client verifica il marcatore del documento isolato. In sua assenza forza una nuova navigazione documentale, senza URL contenenti risposte. Anche l'uscita verso la home è una navigazione completa. Il solo avviso lint su tale navigazione ha una soppressione puntuale motivata dal confine privacy; non sono stati disabilitati controlli di sicurezza o regole globali.

L'informativa generale del sito non viene dichiarata sufficiente per la futura profilazione/persistenza/Advisor. Quella versione richiederà informative, finalità, autorizzazioni, retention, diritti e processo di collegamento distinti.

## 5. Controlli tecnici di riservatezza

- Flag letti solo sul server, OFF per default, senza NEXT_PUBLIC, cookie o query di attivazione; configurazioni contraddittorie negate.
- Proxy limitato al percorso nuovo, mantenendo integralmente il corpo preesistente di negoziazione HTML/Markdown della home e il suo matcher.
- Marcatore anonimo sovrascritto dal Proxy. Layout senza script terzi, header no-store/private, no-referrer e noindex/nofollow.
- CSP produzione: connessioni `connect-src 'none'`, form/frame/worker disabilitati e asset/font locali. Inline necessari a Next restano ammessi: non è una certificazione XSS o una CSP con nonce.
- Nessun fetch/transport, storage browser, log o secret nel grafo del client anonimo. Nessun payload finanziario in URL o richieste.
- Scansione dei **31 chunk browser**: nessuna occorrenza delle configurazioni server sensibili/RPC cercate, incluse SUPABASE_SERVICE_ROLE_KEY, PATRIMONIAL_RADAR_LOCAL_SECRET e LocalSupabaseRadarRpc.
- API persistenti GET/POST e Advisor HTTP 404 nella build pubblica, anche forzando i loro flag nei processi di test che simulano Vercel/production.
- Pagina assente con flag OFF. Navigazione e sitemap non modificate; verificatori search/readable/no-platform PASS. **Noindex non è usato come controllo di sicurezza.**

La verifica locale dimostra assenza di invio delle risposte nel perimetro testato. Non certifica una futura configurazione CDN, un'iniezione automatica di strumenti sul deployment, altri browser o software esterno al sito. Un qualunque strumento che acquisisca domande/risposte o un canale non dimostrato comporta **NO-GO** alla pubblicazione anonima.

## 6. Flag previsti per ambiente — nessuna modifica remota

| Ambiente | MODE | PUBLIC_ANONYMOUS_ENABLED | VERIFIED_PERSISTENT_ENABLED | BACKEND / Advisor |
| --- | --- | --- | --- | --- |
| Default / produzione non approvata | assente | OFF | OFF | OFF |
| QA anonima locale, processi effimeri | PUBLIC_ANONYMOUS | ON | OFF | OFF |
| Futuro Preview separato, dopo autorizzazione | PUBLIC_ANONYMOUS | ON | OFF | OFF |
| Futuro dominio, dopo GO esplicito | PUBLIC_ANONYMOUS | ON | OFF | OFF |
| Regressione persistente locale sintetica | VERIFIED_PERSISTENT | OFF | ON | solo gate local-test preesistenti |
| Versione persistente pubblica futura | non abilitabile dalla sola tabella | OFF | OFF fino a nuova autorizzazione | prerequisiti ancora mancanti |

Prefisso completo delle variabili: `PATRIMONIAL_RADAR_MODE`, `PATRIMONIAL_RADAR_PUBLIC_ANONYMOUS_ENABLED`, `PATRIMONIAL_RADAR_VERIFIED_PERSISTENT_ENABLED`. I gate backend/Advisor conservano i nomi e il rifiuto dei contesti pubblici già presenti. Due modalità ON insieme, valore non esatto, mode sconosciuto o backend/preview Advisor attivo nella configurazione anonima → pagina negata. La modalità persistente richiede inoltre i gate DEMO/BACKEND locali esistenti.

I valori remoti effettivi non sono stati letti o attivati. Gli ON di questa fase sono soltanto variabili dei processi loopback di test con ambiente ripulito.

## 7. Test eseguiti

| Verifica | Esito |
| --- | --- |
| Build finale Next 16.3.5 + readable | PASS |
| Typecheck | PASS |
| Lint globale | PASS: 0 errori, 65 warning preesistenti |
| Lint mirato nuovo codice e QA | PASS, nessun warning |
| test:patrimonial-radar-public | PASS: default/conflict flags, 40 domande, 14 fixture deterministiche e customer, grafo senza trasporto/storage/secret, preservazione e modifica negativa rifiutata |
| Motore 4A | PASS 72 gruppi; limiti metodologici precedenti conservati: 57 scenari PASS, quattro PARTIAL, CT-27 NOT RUN |
| Projection / UI / backend | PASS, rispettivamente 14 fixture, contratti UI e 14 gruppi DB embedded esistenti |
| Advisor / access / access-contracts / controlled-linking | PASS; moduli Advisor invariati e non collegati al pubblico |
| Radar v4 e sei regressioni patrimoniali | PASS: Radar, funnel, ledger, CRM, opportunità, persistenza, remote mapping |
| Integrazione e presentazioni Evento/Architetto/tema | PASS: 34 schermate Radar v4, 56 file Radar main, 11 file CRM, migration e 35 fotografie byte-identici |
| no-platform / search / readable | PASS, nessuna aggiunta a navigazione/sitemap |
| Browser anonimo produzione, Edge/Chromium | PASS 29 ordinarie + 11 approfondimenti, annuali/importi/fasce, matrici, due obiettivi con rango esplicito, riconferma, refresh e reset |
| Zero/UNKNOWN/DECLINED | PASS: zero reale, inattività strutturale, incompletezza; prova browser aggiuntiva di DECLINED confermato/riaperto distinto da UNKNOWN |
| Responsive/accessibilità | PASS 320/390/768/1440 e landscape, nessun overflow documento, tastiera/focus visibile, target CTA >=44px, reduced motion, immagini/font caricati e descrizioni non basate solo sul colore |
| Rete anonima | PASS: **133 richieste tecniche GET/HEAD, 0 scritture, 0 richieste esterne, 0 errori browser**; storage/beacon/IndexedDB/service-worker registration bloccati dal test |
| Confine documentale | PASS: fixture di layout ereditato forza due documenti, cancella il globale sintetico precedente e non mostra controlli prima del documento sicuro; uscita completa, 0 invii/esterni |
| Gate produzione | PASS pagina OFF, API persistenti GET/POST e Advisor 404, shell home e negoziazione Markdown preservate |
| Regressione browser persistente locale | PASS: OTP simulato, sessione, recupero/refresh, due dispositivi, CAS, risposte perse/retry, identità incrociate, CSRF, snapshot canonico e revoca |
| PostgreSQL nativo / PostgREST | NOT RUN; nessuna nuova persistenza anonima. La regressione persistente usa solo lo stack embedded/simulato esistente |
| Browser diversi da Edge/Chromium, dispositivi fisici, screen reader completo | NOT RUN |
| Deployment / persone volontarie / prove sul dominio | NOT RUN, fuori autorizzazione di questa fase |

La regressione persistente è stata avviata con il nuovo flag nel solo helper di test. Client persistente, API, runtime server, schema e migration sono byte-identici al commit iniziale, salvo il restringimento al campo result del tipo della proiezione pura. Le scritture e OTP del relativo browser test riguardano esclusivamente DB effimero e provider simulato: nessuna email o migrazione remota.

Le precedenti guardie Git sono state adeguate soltanto per otto file sorgente autorizzati, ciascuno fissato integralmente nel manifest SHA-256. Tutti gli altri percorsi conservano le proprie baseline; assert funzionali e confronto esatto della geometria SVG mantenuti. Prima del PASS finale i test hanno rilevato e fatto correggere codifica di accenti/simboli e preservazione Proxy home. Due assunzioni della vecchia suite browser sono state aggiornate alla proiezione corrente e all'attesa della transizione React, conservando controllo della riconferma e dei sei settori.

Il FAIL storico live-smoke della guardia globale resta noto/non rieseguito; nessuno smoke operativo. I PASS locali non validano scientificamente la metodologia o autorizzazioni Advisor reali.

## 8. Screenshot e prove

**Solo fixture sintetiche**, nessun cliente o contatto reale. 23 screenshot del percorso anonimo prodotti. Ispezione visiva di introduzione desktop/320, matrice 320, obiettivi e risultati desktop/390; sei esempi conservati nel repository:

- [Introduzione desktop](public-pilot-qa/intro-desktop-1440.png)
- [Introduzione 320 px](public-pilot-qa/intro-320.png)
- [Domanda mobile 320 px](public-pilot-qa/question-mobile-320.png)
- [Due obiettivi sintetici](public-pilot-qa/goals-desktop-1440.png)
- [Risultato desktop](public-pilot-qa/result-desktop-1440.png)
- [Risultato mobile, dati insufficienti](public-pilot-qa/result-mobile-390.png)

[Contatori e domande esercitate](public-pilot-qa/verification.json), [confine documentale e distinzione stati](public-pilot-qa/boundary-verification.json). Artefatti completi e log: `C:\Users\emanu\.codex\visualizations\2026\10\18\01a14e5a-6067-71a0-a210-f3859cab8329\radar-public-pilot`, sottocartella persistent-regression per il percorso simulato con salvataggio.

Riproduzione, dopo npm run build:

```text
npm run test:patrimonial-radar-public
node scripts/run-patrimonial-public-local-qa.mjs <directory-artefatti> --playwright-module=<percorso-assoluto-playwright/index.mjs> --executable=<percorso-assoluto-browser>
```

Il runner avvia due processi sul loopback 3361/3362 con ambiente ripulito e li termina in finally; richiede porte libere. Nessun file env, servizio remoto o dipendenza scaricata. `--boundary-only` esegue soltanto gate/confine/stati aggiuntivi.

## 9. Piano di rilascio e GO/NO-GO

1. **Locale — completato:** verifiche sopra, confronto linguaggio e screenshot. Conservare questa candidata senza attivare flag remoti.
2. **Preview separato — da autorizzare:** deployment del solo branch dedicato, API/Advisor/persistenza OFF, nessuna connessione DB/email/CRM necessaria. Controllare header e risposta effettiva dopo CDN, script eventualmente iniettati dalla piattaforma, toolbar/analytics/replay e policy Iubenda. Ripetere rete/storage, deep link e ingresso da un documento ordinario. Qualunque acquisizione delle risposte → NO-GO.
3. **Volontari — non eseguito:** usare scenari inventati, chiedere se domande/scelte sono comprensibili e se le spiegazioni danno fiducia. Raccogliere feedback sul linguaggio, senza chiedere di inviare risposte economiche o screenshot finanziari. Misurare attriti e durata senza telemetria del questionario.
4. **Correzioni:** distinguere lessico da cambiamenti metodologici; i secondi richiedono revisione esplicita, non aggiustamenti estetici. Ripetere i test interessati e la rete dopo ogni intervento.
5. **Approvazione:** revisione informativa anonima, usabilità, sicurezza, artefatto/versione e approvazione esplicita del responsabile della pubblicazione.
6. **Eventuale apertura /radar-patrimoniale:** solo dopo GO, configurazione server approvata e verifica del comportamento delle altre pagine. L'uso di headers nel layout è condizionale al mode anonimo: verificare anche cache/prerender e prestazioni delle landing nel vero ambiente di build con flag previsti. Nessuna aggiunta automatica a menu/sitemap.
7. **Persistente successiva:** progetto distinto per infrastruttura, sessioni/email, applicazione DB autorizzata, retention/diritti, prove native e PostgREST, informative e successivi binding/permessi/audit Advisor. Mai importare retroattivamente le risposte anonime.

**GO locale:** candidata software verificata per revisione e preparazione Preview. **NO-GO pubblicazione oggi:** Preview reale, revisione informativa, verifica piattaforma e pilot umano non eseguiti; nessuna autorizzazione al rilascio. Non è un blocco del motore né una dipendenza da HighLevel/assegnazioni.

**Criteri GO prima del dominio:** nessuna trasmissione di risposte dimostrata nell'ambiente destinazione; script terzi esclusi anche dopo navigazione dal sito; flag OFF/isolamento/404 riprovati; dispositivo mobile e accessibilità adeguati; zero regressioni Radar/funnel; informative approvate e feedback volontari trattati. Mancanza di evidenza su uno di questi punti → NO-GO.

**Monitoraggio senza risposte:** disponibilità HTTP, errori tecnici del server e versione del deployment, senza body/risposte, query economiche o eventi per singola compilazione. Nessun SDK client di analytics/error replay e nessun evento automatico di completamento. Bug report con scenari sintetici, non registrazioni delle sessioni o schermate personali.

**Rollback:** spegnere il flag anonimo o rimuovere MODE mediante azione successivamente autorizzata, verificare HTTP 404 e che backend/Advisor restino OFF; ripristinare l'artefatto precedente se necessario. Header no-store impediscono una cache condivisa del percorso. Nessuna migration o dato CRM da annullare. Una pagina già caricata può restare in memoria nel dispositivo: il flag blocca nuove aperture, non ritira codice già consegnato; refresh/chiusura e mancanza di recupero sono spiegati.

## 10. File e commit

Prodotto: nuovo anonymous-client, public-mode e public-copy; pagina server con scelta modalità; isolamento layout/Proxy; ResultPreview con copy anonima opzionale (default persistente conservato); customerProjection con sola modifica di tipo. Nessun CSS globale, asset runtime, motore, question widget, API persistente, migration, CRM o assegnazione cambiato.

Test: due verificatori pubblici, runner loopback, helper confine/preservazione e manifest; helper browser persistente con nuovi flag solo di test; sei verificatori/shared guard adeguati puntualmente; package.json con due comandi e nessuna dipendenza. Documentazione: questo report, revisione linguaggio e sei screenshot/due JSON sintetici.

Commit locale identificato nella consegna e con git log -1 su questo report, senza hash autoreferenziale. Worktree pubblico conservato per revisione; originali e branch correttivo invariati. **Nessun push, deploy, merge su main, modifica remota, email reale, nuovo schema/migration o attivazione di flag remoti.**
