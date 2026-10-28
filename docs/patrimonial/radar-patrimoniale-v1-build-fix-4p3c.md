# Radar Patrimoniale V1 — Build fix, Fase 4P.3C

19 ottobre 2026. **Blocco di build corretto localmente. NO-GO al terzo deployment Preview: resta aperto il contratto HTTP di cache Readable descritto nella sezione 6.** Nessun push, deploy o accesso alle piattaforme operative remote eseguito in questa fase.

## 1. Provenienza, commit e conservazione

- Repository: HORYZON-ORG/horyzon-website.
- Worktree: `C:\Users\emanu\.codex\worktrees\radar-public-pilot\horyzon-website`.
- Branch: `feat/radar-patrimoniale-public-pilot`.
- Commit iniziale: `d77bb70f6caf7ca2ba75e0b89c5b4ba5f12b57cd`.
- **Nuovo commit del codice e dei test verificati: `bf32a4d08575b717f1e2e43e619ced89c2a4cdde`.** Questo report e le evidenze selezionate vengono registrati con un successivo commit esclusivamente documentale; il suo SHA finale è riportato nella consegna e ricavabile con `git log -1 --format=%H -- docs/patrimonial/radar-patrimoniale-v1-build-fix-4p3c.md`.

Il checkout originale rimane su feat/patrimonial-pilot-funnels, SHA b242752102542e5280bba8b6ba0c4aecf9fcd722, con i soli non tracciati audit Fase 1 e tmp/. Il Radar principale rimane pulito su ac56a874ef6a7aefb948c45c738ea9df4b91e0ca. Nessun loro file modificato, spostato, cancellato o consolidato. I due report 4P.2 presenti nel worktree pubblico sono conservati come non tracciati e non inclusi nei commit. Nessun reset, clean, stash o modifica di altri branch. Nessun processo Git concorrente rilevato al controllo iniziale e prima della registrazione.

Letti AGENTS, DESIGN, readiness 4P.1 e i due documenti 4P.2. Le risultanze 4P.3/4P.3B sono state rilette negli artefatti locali delle fasi precedenti: non erano report committati nel repository. Consultate le guide della versione Next installata su layout, route groups, headers, script e global-not-found; applicate le skill Vercel verification e React best practices. Nessuna istruzione storica di pubblicazione in DESIGN è stata applicata: prevale il divieto corrente.

## 2. Causa verificata

Nel commit iniziale src/app/layout.tsx leggeva headers() quando la modalità era PUBLIC_ANONYMOUS. Essendo il layout comune, la Dynamic API rendeva dinamica anche `/`. Il log del secondo deployment, dpl_J3szQjANkXSV8JsJfgYqPcFgVYW1, mostrava tutte le pagine dinamiche, compilazione e TypeScript riusciti, poi ENOENT su `.next/server/app/index.html` nel postbuild.

Lo script scripts/build-readable.mjs legge correttamente il vero HTML prerenderizzato della home, verifica body/H1, converte quel contenuto e applica gli assert sul Markdown. Non poteva produrre l'output senza quel file. Il problema era il confine del layout, non il convertitore.

## 3. Soluzione e alternative

Due layout radice indipendenti, senza un layout condiviso sopra di essi:

- `src/app/(site)/layout.tsx`: documento ordinario statico, con gli script Iubenda originali.
- `src/app/radar-patrimoniale/layout.tsx`: legge headers() soltanto nel proprio ramo anonimo. Richiede il marcatore impostato dal Proxy; un marcatore mancante in modalità anonima produce notFound().
- `src/app/site-document.tsx`: estrazione della shell precedente. Mantiene HTML/body, font, CSS, metadata, viewport, icone, structured data, configurazione e strategie di caricamento Iubenda. Riceve una proprietà server isolated, con default false; non legge informazioni di richiesta.

Le route ordinarie sono state inserite nel gruppo `(site)`, che non modifica gli URL. **33 spostamenti senza modifiche al contenuto**, incluse le risorse vicine alle route. Il font WOFF2 resta byte-identico; per i testi il confronto Git normalizza soltanto CRLF/LF. Due import CSS esterni alle route sono stati aggiornati al nuovo percorso: patrimonial-pilot-shell e job-ad-builder. Il verificatore confronta esattamente il prima/dopo con la sola sostituzione dell'import.

Per conservare anche il 404 ordinario è stato aggiunto global-not-found.tsx, che riutilizza il documento e il componente 404 esistenti, con la singola opzione locale Next `experimental.globalNotFound`. Nessun flag applicativo o remoto cambiato. Il 404 è stato verificato nel browser con stile, font, navigazione e shell ordinaria.

Il passaggio fra i due layout radice provoca una nuova navigazione documentale. Il controllo difensivo già presente nel client anonimo e l'uscita con location.assign restano invariati. Il Proxy continua a sostituire il marcatore ricevuto; i flag sono sempre server-side e OFF per default.

Alternative scartate: rimozione/aggiramento Readable; index.html artificiale; force-static su dati realmente dipendenti dalla richiesta; controllo Iubenda tardivo nel client; layout annidato sotto la shell con script già caricati; duplicazione dei layout ordinari per ogni singola route. Le prime alternative violerebbero i contratti, le ultime aumenterebbero duplicazione o navigazioni complete fra pagine ordinarie.

## 4. File e guardie

Inventario completo del commit del codice, con rinomine e percorsi prima/dopo: [files-changed.txt](build-fix-4p3c-qa/files-changed.txt). A questo inventario si aggiungono il presente report e le evidenze nella cartella build-fix-4p3c-qa. Il mapping dei 33 spostamenti è in scripts/fixtures/patrimonial-app-route-moves.json, fissato al commit iniziale.

Oltre ai layout e ai due import descritti sopra, sono modificati:

- next.config.ts: esclusivamente l'opzione per il 404 globale.
- Manifest e helper di preservazione: 14 sorgenti approvate fissate integralmente, confronto dei 33 spostamenti con d77bb70, inventario chiuso del gruppo e rifiuto di route duplicate o aggiunte inattese.
- Verificatori di integrazione, funnel, presentazioni, tema, UI, Advisor, Annunci e AI Score: percorsi di lettura aggiornati; baseline Git storiche conservate. Le guardie di configurazione tollerano soltanto la precisa riga globalNotFound, verificata anche contro il sorgente iniziale completo.
- Nuovo verify-patrimonial-document-layouts.mjs: estrazione esatta della shell, import-only changes, letture di richiesta nel solo Radar, Proxy/flag/client/Readable build invariati e prova negativa di modifica a una route spostata.
- Runner browser e nuovo helper per i documenti reali: navigazione Next reale, quattro larghezze, landing, temi e 404.
- verify-readable.mjs: H1 effettivo con testo enfatizzato, senza pretendere una stringa contigua nel markup; token Vary confrontati esattamente. Accept-Encoding non soddisfa più erroneamente il controllo di Accept. Gli assert su cache, Vercel, RSC, rappresentazioni, ETag, HEAD e robots restano presenti.

Nessuna modifica a dominio diagnostico, widget, formule, questionario, client anonimo/persistente, API, runtime backend, schema, migration, routing CRM, ledger, outbox, assegnazioni, fotografie o dipendenze. Nessuna nuova funzionalità Radar Patrimoniale.

## 5. Build ON e OFF

Build completa tramite il comando originale `npm run build`, con ambiente di processo ripulito e senza file env locali o credenziali di provider. ON con i sette valori richiesti:

```text
PATRIMONIAL_RADAR_MODE=PUBLIC_ANONYMOUS
PATRIMONIAL_RADAR_PUBLIC_ANONYMOUS_ENABLED=true
PATRIMONIAL_RADAR_VERIFIED_PERSISTENT_ENABLED=false
PATRIMONIAL_RADAR_BACKEND_ENABLED=false
PATRIMONIAL_RADAR_ADVISOR_PREVIEW_ENABLED=false
PATRIMONIAL_RADAR_DEMO_ENABLED=false
VERCEL_PREVIEW_FEEDBACK_ENABLED=0
```

Nel processo ON sono stati aggiunti soltanto VERCEL=1 e VERCEL_ENV=preview per simulare i gate del contesto pubblico. Nella build OFF i flag Radar erano assenti; nessuna variabile operativa ereditata. Versioni locali: Node 24.17.0, Next 16.3.5. La build Vercel precedente usava Node 24.21.0: non si dichiara identità completa dei runtime.

| Verifica | ON | OFF/default |
| --- | --- | --- |
| Compilazione Next | PASS | PASS |
| TypeScript della build | PASS | PASS |
| Generazione pagine | PASS, 145/145 | PASS, 145/145 |
| Home classificata statica | PASS, ○ / | PASS, ○ / |
| Vero `.next/server/app/index.html` | 90.184 byte | 90.149 byte |
| Postbuild Readable originale | PASS | PASS |
| Markdown da HTML reale | 5.796 byte | 5.796 byte |
| H1 e link/contenuti home | PASS | PASS |

[Evidenza ON](build-fix-4p3c-qa/build-on.json), [evidenza OFF](build-fix-4p3c-qa/build-off.json). La build OFF emette avvisi Next metadataBase durante la generazione dei fallback; gli HTML finali di home e 404 controllati contengono immagini social e icone Horyzon corrette, senza URL metadata localhost. Gli avvisi non sono stati nascosti. Typecheck separato PASS; lint globale 0 errori e 65 warning preesistenti, lint mirato dei nuovi sorgenti/test PASS senza warning.

## 6. Readable: generazione PASS, contratto HTTP ancora FAIL

Lo script di build e il comando build sono identici al commit iniziale: nessun postbuild saltato, errore ignorato o assert rimosso. I test di parsing Accept sono PASS, compresi i nuovi controlli sui token Vary. HTML e Markdown restituiscono il contenuto reale corretto.

Il test HTTP completo `node --no-warnings --experimental-strip-types scripts/verify-readable.mjs http://localhost:3365` è invece **FAIL**. Evidenza separata: [esito](build-fix-4p3c-qa/readable-http-final.json), [header effettivi](build-fix-4p3c-qa/readable-default-probe.json).

Con hostname locale allineato:

- `/`, Accept text/markdown: 200, text/markdown, Vary comprende Accept e RSC, canonical corretto, nessun noindex trasferito alla home.
- `/`, Accept text/html: 200 e H1 reale corretto, ma Vary contiene RSC e Accept-Encoding, **non il token Accept**; Cache-Control è s-maxage=31536000.
- `/home.md` diretto mantiene il suo noindex, come previsto.

Il tracing locale mostra il gestore App Page generato da Next che riscrive Vary. Il Proxy applicativo non è stato modificato. Il fallback già previsto dal verificatore richiede un server Vercel verificato e max-age=0/must-revalidate; il server locale non soddisfa tale condizione. Non viene simulato l'header Server per ottenere PASS. L'assenza di Vary Accept lascia un rischio di rappresentazione errata presso cache intermedie che non distinguano autonomamente Accept.

Un primo probe su 127.0.0.1 incontrava inoltre una riscrittura assoluta verso localhost, con passaggio HTTP aggiuntivo e header del file diretto. Il runner ora usa localhost coerentemente, senza cambiare il Proxy. Un altro assert storico cercava il titolo contiguo nell'HTML, ignorando `<em>`: ora verifica più precisamente il testo del vero H1. Queste correzioni ai test non chiudono il problema di cache e non sono usate per dichiararlo PASS.

Non è dimostrato in questa fase come il CDN Vercel servirebbe il nuovo commit: nessuna interrogazione o pubblicazione remota autorizzata. Il limite viene lasciato esplicito, senza ampliare la correzione dei layout a una sostituzione della pipeline di serving o delle policy del sito.

## 7. Privacy e browser anonimo

Test reali Edge/Chromium headless, soli dati sintetici, su build di produzione locale:

- PASS tutte le 29 domande ordinarie e gli 11 approfondimenti tramite i controlli reali, matrici, importi/fasce, conversione annuale, due obiettivi ordinati e riconferme.
- PASS confronto del risultato con il motore canonico, sei aree, zero reale, UNKNOWN e DECLINED confermato/riaperto, risultato parziale, refresh senza recupero delle risposte.
- PASS 320/390/768/1440 px, landscape, tastiera/focus, CTA, reduced motion, immagini e font; ispezione visiva degli screenshot effettuata.
- **126 richieste tecniche GET/HEAD, zero scritture, zero richieste esterne, zero errori browser** nel test anonimo completo. Storage, beacon, IndexedDB e registrazione service worker vietati attivamente dal test. Nessun payload economico o risposta in rete/URL/storage.
- PASS CSP connect-src 'none', no-store/private, no-referrer, noindex; nessuna configurazione/script Iubenda nel documento anonimo. Il marcatore ricevuto dal client viene sostituito dal Proxy. [Header](build-fix-4p3c-qa/anonymous-headers.json).
- PASS home reale → router Next reale → Radar → home alle quattro larghezze: tre documenti osservati, globale sintetico della home eliminato prima dei controlli e shell ordinaria ripristinata all'uscita. La home non ha ricevuto nuovi link di prodotto: l'ingresso viene esercitato tramite l'istanza del router già caricata.
- Conservata anche la precedente fixture sintetica di layout ereditato, con ricaricamento preventivo e distinzione DECLINED/UNKNOWN. Nessuna fixture HTML sostituisce le vere pagine nel nuovo test di navigazione.
- Le richieste Iubenda delle sole pagine ordinarie sono intercettate con risposte JavaScript inerti: si verificano shell e confine senza eseguire codice del provider o contattarlo. Nel documento anonimo non compaiono neppure richieste terze. L'assenza di toolbar/analytics è verificata localmente; eventuali iniezioni della piattaforma restano NOT RUN.

[Questionario/rete](build-fix-4p3c-qa/verification.json), [documenti e route reali](build-fix-4p3c-qa/real-document-verification.json), [fixture di confine](build-fix-4p3c-qa/boundary-verification.json).

## 8. Persistenza simulata e regressioni

**31 gruppi/comandi di regressione PASS**, con dettaglio riproducibile in [regressions-final.json](build-fix-4p3c-qa/regressions-final.json): pubblico, motore, projection, UI, backend embedded, Advisor/access/access-contracts/controlled-linking, Radar, patrimonial/leads/content, funnel, ledger, CRM, opportunità, persistenza, remote mapping, no-platform, search, Readable unit, Annunci 10x, AI Score, typecheck, lint, integrazione, presentazioni Evento/Architetto, tema, build/editorial/narrative.

Tre controlli degli artefatti sono stati inizialmente invalidati da una build simultanea che riscriveva .next: tutti rieseguiti dopo la sua conclusione, PASS, senza cambiare gli assert. I precedenti errori di import font/CSS e percorsi di test sono stati corretti; nessun test è stato saltato per ottenere il risultato finale. Il verificatore HTTP Readable è aggiuntivo a queste 31 suite e rimane FAIL, come sopra.

**Radar d'Impresa v4 presente: 34 schermate**, sorgenti storici preservati, landing controllata nel browser. **Entrambi i funnel presenti**, chiaro/scuro effettivamente attivati e controllati, metadata/immagini/font corretti, 35 fotografie byte-identiche. Smoke browser di 17 percorsi/varianti ordinari e del 404 senza inviare form o pagamenti.

Regressione browser persistente separata: PASS 29+11, OTP simulato, refresh/recupero, due dispositivi, CAS e retry di risposta persa, CSRF/IDOR, snapshot e revoca. 567 richieste locali, 112 scritture autenticate esclusivamente nello stack effimero, zero esterne, zero errori. Nessuna scrittura anonima viene confusa con queste scritture del test persistente. Suite completa confermata anche sulla build OFF finale: [evidenza persistente](build-fix-4p3c-qa/persistent-verification.json).

Pagina anonima con flag OFF e API persistenti GET/POST/Advisor restituiscono 404, anche con marcatore client forgiato e nella simulazione di flag persistenti in contesto Vercel. [Gate default OFF](build-fix-4p3c-qa/default-off-gates.json). PostgreSQL nativo, PostgREST, Advisor reale, email/CRM reali, dispositivi fisici e collaudo Vercel: NOT RUN.

## 9. Screenshot ed evidenze

Screenshot locali esaminati, soltanto contenuti sintetici:

- [Introduzione 320](build-fix-4p3c-qa/intro-320.png), [domanda 320](build-fix-4p3c-qa/question-mobile-320.png), [risultato desktop](build-fix-4p3c-qa/result-desktop-1440.png).
- [Home reale mobile dopo l'uscita](build-fix-4p3c-qa/real-home-390.png), [Radar d'Impresa](build-fix-4p3c-qa/business-radar.png).
- [Evento chiaro](build-fix-4p3c-qa/event-chiaro.png), [Architetto scuro](build-fix-4p3c-qa/architect-scuro.png), [404 ordinario](build-fix-4p3c-qa/ordinary-404.png).

Riepilogo: [summary.json](build-fix-4p3c-qa/summary.json). Log completi, altri screenshot e stack persistente: `C:\Users\emanu\.codex\visualizations\2026\10\18\01a14e5a-6067-71a0-a210-f3859cab8329\radar-public-pilot-4p3c`.

## 10. Decisione e arresto

La causa del fallimento postbuild è corretta: home statica e Readable reale funzionano con flag ON e OFF, preservando il confine anonimo. **Non si dichiara completata la qualificazione HTTP della candidata. NO-GO al terzo deployment Preview nello stato attuale**, finché il contratto di cache HTML/Markdown non viene chiuso oppure viene definito e autorizzato esplicitamente un collaudo di piattaforma limitato a tale verifica. Nessuna deroga implicita agli assert; nessuna attestazione che il CDN soddisfi già il contratto.

Qualunque futura operazione deve usare il nuovo SHA, una nuova autorizzazione esplicita e il solo progetto pilota isolato. Protezione, target Preview effettivo, header/cache, assenza di iniezioni e test browser remoti dovranno essere verificati prima dei volontari. NO-GO a volontari e dominio Horyzon; informative e approvazioni umane precedenti restano pendenti.

Non sono stati modificati Vercel, GitHub remoto, Supabase, HighLevel, Resend, Shared/Production, flag remoti o i due deployment esistenti. Nessun push, deploy, migration, rilascio pubblico o nuova funzionalità. Fase arrestata alla consegna locale.
