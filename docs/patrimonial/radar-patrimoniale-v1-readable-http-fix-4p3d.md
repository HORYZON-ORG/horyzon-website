# Radar Patrimoniale V1 — Readable HTTP fix, Fase 4P.3D

19 ottobre 2026. **Blocco HTTP locale risolto mediante l'alternativa autorizzata: caching HTTP disabilitato per entrambe le rappresentazioni della home. GO tecnico locale per un futuro terzo Preview protetto, soltanto dopo nuova autorizzazione. Nessun deployment eseguito.**

## 1. Stato iniziale e conservazione

Repository HORYZON-ORG/horyzon-website; branch feat/radar-patrimoniale-public-pilot; worktree C:/Users/emanu/.codex/worktrees/radar-public-pilot/horyzon-website. Commit iniziale verificato: f8fd35ff139c3ed3a66cb28aef1c76ec2eadc6e2. Letti integralmente AGENTS, DESIGN e report 4P.3C; consultate le guide Next installate, il codice della pipeline e la skill Vercel CDN caching.

Il checkout originale e il worktree Radar principale non sono stati modificati. I due report 4P.2 restano non tracciati ed esclusi dai commit; i relativi hash sono stati confrontati e risultano invariati. Nessun reset, clean, stash o modifica di altri branch. Nessuna credenziale o variabile remota letta o modificata.

## 2. Causa precisa e riproduzione

La riproduzione iniziale sul build precedente ha confermato HTML 200 con Vary privo del token Accept e Cache-Control: s-maxage=31536000. Il Markdown negoziato era corretto e conservava Vary: Accept. [Header iniziali](readable-http-4p3d-qa/baseline-http.json).

In Next **16.3.5**, node_modules/next/dist/build/templates/app-page-runtime.js, riga 459, esegue res.setHeader('Vary', varyHeader), con il valore prodotto da routeModule.getVaryHeader. Questa assegnazione sostituisce il Vary già impostato da configurazione e Proxy; non è un append. L'aggiunta dei token RSC in BaseServer avviene prima e non impedisce tale sovrascrittura. La compressione aggiunge poi Accept-Encoding, che non equivale ad Accept.

Il Vary corretto era già presente sia in src/proxy.ts sia in next.config.ts: ripeterlo nello stesso punto non risolverebbe il problema. La casistica è coerente con la [issue Next #85852](https://github.com/vercel/next.js/issues/85852), ma la diagnosi di questa fase si basa anche sul codice effettivamente installato e sulla risposta HTTP locale.

Il confine di cache è diverso: node_modules/next/dist/server/send-payload.js, riga 60, applica il valore generato dal framework soltanto se Cache-Control non è già presente, consentendo esplicitamente la personalizzazione tramite next.config. [Punti della pipeline e versione](readable-http-4p3d-qa/framework-cause.json).

Nessuna modifica o monkey patch di node_modules, del server Next o dei suoi oggetti di risposta; nessun Server: Vercel simulato.

## 3. Soluzione applicata e alternative valutate

La sola modifica applicativa consiste in **nove righe aggiunte a next.config.ts**: una policy condivisa applicata esattamente a / e /home.md.

    Cache-Control: private, no-store, max-age=0, must-revalidate
    CDN-Cache-Control: no-store
    Vercel-CDN-Cache-Control: no-store

È l'alternativa richiesta quando Vary: Accept non sopravvive sul documento HTML. Non si dichiara riparato il Vary del framework: si impedisce il riuso delle due rappresentazioni da parte delle cache HTTP, comprese quelle con intestazioni CDN dedicate. La [documentazione Vercel sui controlli di cache](https://vercel.com/docs/caching/cache-control-headers) distingue questi scope e le loro priorità; tutti e tre i valori sono verificati nelle risposte locali finali.

URL pubblico, scelta HTML/Markdown, canonical, robots, ETag, RSC e contenuti sono conservati. La home continua a essere prerenderizzata, e Readable continua a leggere il suo vero index.html. Nessuna force-static aggiunta e nessuna Dynamic API introdotta.

Valutate e scartate: un'altra assegnazione Vary nel Proxy/configurazione, che precederebbe comunque la sovrascrittura; un custom server o adapter di piattaforma, che allargherebbero l'architettura senza necessità; una diversa route pubblica, una copia HTML parallela o la rimozione della negoziazione, che cambierebbero i contratti; upgrade o patch di Next, esclusi dai vincoli. Le API adapter consultate riguardano integrazione build/piattaforma; non è stato introdotto alcun wrapper del confine di risposta.

**Tradeoff intenzionale:** la home e la sua copia Markdown rinunciano al caching HTTP. Il documento resta statico e non viene renderizzato dinamicamente per ogni visita. Nessuna misura di costo o prestazione CDN è stata effettuata. Le altre route e gli asset conservano le policy precedenti: GET /radar e /contatti mantengono s-maxage=31536000 e non ricevono le nuove intestazioni CDN.

## 4. File modificati e guardie

[Inventario del commit del codice](readable-http-4p3d-qa/files-changed.txt); a questo si aggiungono il presente report e la cartella di prove.

- next.config.ts: sola policy di cache sopra.
- scripts/verify-readable.mjs e scripts/lib/readable-cache-contract.mjs: parser Accept originale conservato, token Vary esatti, alternativa no-store subordinata alla sicurezza di entrambe le rappresentazioni, rifiuto degli override CDN e delle policy insufficienti.
- scripts/lib/readable-http-checks.mjs: matrice HTTP reale, body/metadata/header, ETag, HEAD, redirect e RSC.
- scripts/run-readable-local-qa.mjs: server Next di produzione locale su porta dinamica, ambiente ripulito, gate, matrice e confronto byte per byte con gli artefatti reali.
- scripts/lib/readable-cache-config.mjs: rimuove per i soli confronti storici esclusivamente la dichiarazione e le due applicazioni esatte della policy approvata.
- scripts/verify-patrimonial-document-layouts.mjs, verify-patrimonial-radar-ui.mjs e verify-patrimonial-radar-advisor.mjs: usano tale confronto e conservano le baseline storiche.
- scripts/fixtures/patrimonial-public-source-manifest.json: aggiornato soltanto l'hash del next.config.ts approvato.

Le prove negative rifiutano una policy applicata soltanto a HTML o Markdown, no-cache senza no-store, private qualificato per soli header, s-maxage e riattivazioni CDN. Anche le guardie dei sorgenti rifiutano una dichiarazione diversa: non vengono eliminati blocchi generici o aggiornate baseline a HEAD.

Proxy, layout, pagina home, Radar d'Impresa, tutti i file sotto src, script build-readable, package/lock e dipendenze sono **identici al commit iniziale**. Nessun nuovo Radar, schema, migration, routing CRM, ledger, outbox o assegnazione.

## 5. Header finali effettivi

Misurati mediante richieste HTTP al server di produzione locale, senza riscriverne le risposte:

| Header | HTML / | Markdown negoziato / |
| --- | --- | --- |
| Content-Type | text/html; charset=utf-8 | text/markdown; charset=utf-8 |
| Vary | RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch, Accept-Encoding | Accept più i medesimi token |
| Cache-Control | private, no-store, max-age=0, must-revalidate | identico |
| CDN-Cache-Control | no-store | no-store |
| Vercel-CDN-Cache-Control | no-store | no-store |
| ETag | presente, forte | presente, debole, distinto dall'HTML |
| Canonical | link HTML a https://horyzon.it | Link HTTP a https://horyzon.it |
| X-Robots-Tag | nessun noindex | nessun noindex |

La capitalizzazione dei token Vary è normalizzata nella tabella. HEAD conserva gli stessi header del GET corrispondente ed è privo di body. /home.md diretto mantiene contenuto Markdown, canonical e noindex, con la stessa policy no-store.

Tutti i valori esatti, inclusi ETag di entrambe le build, status e hash dei body: [HTTP ON](readable-http-4p3d-qa/on-readable-http.json), [HTTP OFF](readable-http-4p3d-qa/off-readable-http.json).

## 6. Matrice HTTP obbligatoria

**24 richieste per modalità, 48 complessive, tutte PASS.** Nessuna richiesta viene sostituita da un controllo statico. Il client Node HTTP permette il caso realmente privo di Accept, invece di aggiungere automaticamente */*.

| Caso | Metodo | Accept | ON | OFF |
| --- | --- | --- | --- | --- |
| GET HTML | GET | text/html | 200 | 200 |
| GET Markdown | GET | text/markdown | 200 | 200 |
| GET absent Accept | GET | assente | 200 | 200 |
| GET default wildcard | GET | */* | 200 | 200 |
| GET Markdown rejected | GET | text/markdown;q=0, text/html | 200 | 200 |
| HEAD html | HEAD | text/html | 200 | 200 |
| HEAD markdown | HEAD | text/markdown | 200 | 200 |
| Direct Markdown | GET | assente | 200 | 200 |
| Alternate 0 | GET | text/html | 200 | 200 |
| Alternate 1 | GET | text/markdown | 200 | 200 |
| Alternate 2 | GET | text/html | 200 | 200 |
| Alternate 3 | GET | text/markdown | 200 | 200 |
| Alternate 4 | GET | text/html | 200 | 200 |
| Alternate 5 | GET | text/markdown | 200 | 200 |
| Foreign ETag GET html | GET | text/html | 200 | 200 |
| Matching ETag GET html | GET | text/html | 304 | 304 |
| Foreign ETag HEAD html | HEAD | text/html | 200 | 200 |
| Matching ETag HEAD html | HEAD | text/html | 304 | 304 |
| Foreign ETag GET markdown | GET | text/markdown | 200 | 200 |
| Matching ETag GET markdown | GET | text/markdown | 304 | 304 |
| Foreign ETag HEAD markdown | HEAD | text/markdown | 200 | 200 |
| Matching ETag HEAD markdown | HEAD | text/markdown | 304 | 304 |
| RSC native normalization | GET | text/markdown | 307 | 307 |
| RSC bypasses Markdown | GET | text/markdown | 200 | 200 |

Le sei richieste alternate restituiscono sempre il body esatto della rappresentazione selezionata. L'ETag della rappresentazione opposta produce sempre 200 con il contenuto corretto, mai 304. L'ETag corrispondente produce 304 senza body sia per GET sia per HEAD; i divieti di caching restano presenti anche nelle risposte condizionali.

Next richiede una normalizzazione nativa del flusso RSC senza il suo parametro tecnico: 307 verso /?_rsc, poi 200 text/x-component. Il test la registra e segue esplicitamente, senza modificare il router. Le normali rappresentazioni HTML/Markdown e /home.md non subiscono redirect. Tutti e quattro i token Vary necessari a Flight restano verificati.

Il vecchio fallback basato sul solo nome Server non viene usato: il PASS dipende dalle policy effettive. Se una rappresentazione non varia su Accept, il verificatore richiede il divieto di memorizzazione per **tutte** le risposte della coppia, incluse HEAD e condizionali. Accept-Encoding non soddisfa il controllo di Accept.

## 7. Build ON/OFF e contenuti genuini

Entrambe le build complete eseguono il comando originale npm run build, incluso il postbuild Readable, con ambiente ripulito. ON usa i sette valori già autorizzati in 4P.3C e il contesto locale VERCEL=1/VERCEL_ENV=preview; OFF omette i flag Radar. Nessuna modifica di variabili remote o file env.

| Verifica | ON | OFF |
| --- | --- | --- |
| Next build, TypeScript, 145 pagine | PASS | PASS |
| Home statica e vero index.html | PASS, 90184 byte | PASS, 90149 byte |
| Postbuild Readable | PASS, 5796 byte | PASS, 5796 byte |
| Body HTTP uguale al vero HTML generato | PASS | PASS |
| Body HTTP uguale al vero Markdown postbuild | PASS | PASS |
| Matrice HTTP Readable | PASS | PASS |
| Typecheck separato | PASS | PASS |
| Lint globale | PASS, 0 errori, 65 warning preesistenti | PASS, 0 errori, 65 warning preesistenti |

Il Markdown è byte-identico nelle due modalità, SHA-256 53b62937bfc64cf966344b72c49d5faa967669ba1a3526e4d4a1b385d9f68753. Gli avvisi Next metadataBase già osservati in 4P.3C durante la build OFF non vengono nascosti; non sono il blocco HTTP e nessun metadata applicativo è stato modificato.

[Evidenza statica ON](readable-http-4p3d-qa/on-static-content.json), [OFF](readable-http-4p3d-qa/off-static-content.json), [build ON](readable-http-4p3d-qa/build-on.json), [OFF](readable-http-4p3d-qa/build-off.json).

## 8. Regressioni, privacy e conservazione

**31 suite PASS in ON e 31 in OFF**: motore/public/projection/UI/backend embedded, Advisor e accessi/contratti/linking, Radar d'Impresa, funnel/leads/content, ledger, CRM, opportunità, persistenza, remote mapping, no-platform, search, Readable unit, Annunci 10x, AI Score, typecheck/lint, integrazione, presentazioni Evento/Architetto, tema e controlli degli artefatti build/editorial/narrative. [ON](readable-http-4p3d-qa/on-regressions.json), [OFF](readable-http-4p3d-qa/off-regressions.json).

Radar v4 resta presente con 34 schermate; le 35 fotografie dei due funnel sono byte-identiche. Nessuna modifica funzionale alle landing o ad Advisor.

Browser anonimo: PASS 29 ordinarie + 11 approfondimenti, risultato deterministico, zero/UNKNOWN/DECLINED, obiettivi e riconferme, refresh e perdita dello stato; 320/390/768/1440, tastiera, reduced motion, immagini/font e navigazione reale home → Radar → home. **126 richieste tecniche, 0 scritture, 0 esterne, zero errori**; storage/beacon/IndexedDB/service worker vietati nel test. CSP e gate restano attivi. Le sole risposte Iubenda dei documenti ordinari sono stub inerti, senza esecuzione del provider; nel documento anonimo non vi sono richieste terze. [Verifica anonima](readable-http-4p3d-qa/anonymous-verification.json), [documenti reali](readable-http-4p3d-qa/real-document-verification.json), [fixture di confine](readable-http-4p3d-qa/boundary-verification.json).

Persistenza browser simulata separata: PASS OTP, 29+11, recupero/refresh, due dispositivi, CAS/retry, CSRF/IDOR, snapshot e revoca; 567 richieste e 112 scritture esclusivamente nello stack effimero locale, zero esterne/errori. [Evidenza](readable-http-4p3d-qa/persistent-verification.json). Nessuna email o scrittura reale.

I gate [ON](readable-http-4p3d-qa/on-gates.json)/[OFF](readable-http-4p3d-qa/off-gates.json) confermano pagina anonima raggiungibile solo nella modalità prevista e API persistenti/Advisor 404. Nessun dato patrimoniale entra in URL o header; i parametri _rsc sono esclusivamente tecnici e i test HTTP usano la home pubblica.

Screenshot correnti esaminati: [introduzione 320](readable-http-4p3d-qa/intro-320.png), [home mobile dopo l'uscita](readable-http-4p3d-qa/home-390.png). Altri screenshot e log completi nella directory locale C:/Users/emanu/.codex/visualizations/2026/10/18/01a14e5a-6067-71a0-a210-f3859cab8329/radar-public-pilot-4p3d.

## 9. SHA, limiti e decisione

**Commit locale del codice e dei test verificati: 3ee0c5489889a60202bfdc3de7c1b1daf7bb4531.** Il successivo commit documentale aggiunge soltanto questo report e le evidenze; SHA finale nella consegna e in git log -1 --format=%H -- docs/patrimonial/radar-patrimoniale-v1-readable-http-fix-4p3d.md.

**GO tecnico locale per un terzo deployment Preview protetto**, da autorizzare separatamente sul nuovo SHA. Il precedente NO-GO HTTP locale è chiuso con il divieto effettivo di caching su entrambe le rappresentazioni, non con una deroga al test. Nessun blocco tecnico locale residuo rilevato.

**CDN Vercel NOT RUN.** Il collaudo locale non dimostra il comportamento dei nodi CDN, l'eventuale consumo delle intestazioni dedicate, cache preesistenti, protezione del deployment o script iniettati dalla piattaforma. Il futuro collaudo autorizzato dovrà verificare target Preview/SHA/protezione, header finali e alternanza/ETag dopo CDN, mantenendo backend e Advisor OFF. Un override che riabiliti la cache o una contaminazione rende nuovamente NO-GO la condivisione.

Nessun GO a volontari o dominio Horyzon da questa fase. Nessun push, deploy, migration, modifica GitHub/Vercel/Supabase/HighLevel/Resend, flag remoto, altro worktree o deployment esistente. Fermata dopo report e commit locali.
