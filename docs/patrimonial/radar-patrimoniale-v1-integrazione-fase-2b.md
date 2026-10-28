# Radar Patrimoniale V1 — integrazione e correzioni fase 2B

18 ottobre 2026. Repository HORYZON-ORG/horyzon-website.

I tre blocchi della fase 2A sono risolti. Build standard, test richiesti e QA
browser della revisione finale passano. È emerso anche un FAIL aggiuntivo del
controllo HTTP Markdown della home, descritto separatamente sotto: non viene
presentato come PASS né corretto estendendo questa fase alla home.

## Perimetro Git e protezione delle assegnazioni

Worktree esclusivo: `C:/Users/emanu/.codex/worktrees/radar-patrimoniale-v1/horyzon-website`.
Branch: `feat/radar-patrimoniale-v1`.

Il merge iniziato in 2A viene conservato, senza abort/reset/stash o riavvio:

- primo parent main: `9146f6372b19fdac6db1770d05f6b0ca10c1f1e5`;
- secondo parent funnel: `88fafcba8811e4a02b3575e2e2cd36368b818be8`.

Questi sono i parent esplicitamente richiesti per la ripresa, non una
dichiarazione sugli HEAD remoti a fine fase. Non sono stati importati commit
successivi delle assegnazioni. Nessun conflitto testuale, indice senza entry
unmerged. Le fusioni automatiche di package.json, template env, noindex e sitemap
sono state rilette. Nessuna strategia di preferenza indiscriminata di un ramo.

Il checkout originale è rimasto sul branch `feat/patrimonial-pilot-funnels`,
HEAD `e781f8dd3bafbd2fca7b3d85c077559811936f61`, già avanzato esternamente prima
della fase 2B. All'ingresso aveva soltanto audit Fase 1 e tmp non tracciati.
Nessun comando di scrittura è stato eseguito in quel checkout. Uno snapshot nel
worktree, ignorato da Git, registra SHA-256 di 3.397 file tracciati/non tracciati
per il confronto finale, oltre a branch, HEAD e status. Le modifiche alle
assegnazioni rimangono disponibili nella directory originale.
Confronto prima del commit: tutti i 3.397 hash, HEAD, branch e status identici;
nessun file cambiato o rimosso nello snapshot di questa fase.

Il commit locale completa il merge solo dopo le verifiche riportate qui. Il suo
SHA viene indicato nel messaggio conclusivo; questo documento è incluso nel
medesimo commit, identificabile con `git rev-parse HEAD` nel worktree Radar.
Nessun push, modifica di main o deploy.

## Cause e correzioni

### Font Evento e Turbopack

Riprodotto `npm run build` con Next 16.3.5: 12 errori nella CSS JetBrains Mono,
con `next/font/google queries have exactly one entry` e mancata risoluzione del
loader interno. La CSS generata in `.next/static/chunks/03d3np_ozv19t.css`
contiene realmente URL `https://fonts.gstatic.com/l/font?...&skey=...&v=v24`
senza estensione. Non era un package interno da aggiungere alle dipendenze.
È la forma di URL che il parser query del loader interpreta come più entry,
coerente con il difetto documentato nella
[issue Next.js 99114](https://github.com/vercel/next.js/issues/99114).
Le richieste diagnostiche successive a Google hanno anche restituito la forma
ordinaria `.woff2`: la variabilità della risposta spiega perché riprovare la
rete non costituisce una correzione stabile.

La sola route Evento usa ora `next/font/local` per JetBrains Mono. Famiglia,
pesi effettivi 500/600, normal, swap e variabile `--event-mono` sono conservati.
Manrope e gli altri font restano invariati. Nessun upgrade di dipendenze,
disattivazione di controlli o patch a node_modules.

Valutati i WOFF del repository con fontkit: Manrope statico 400/600/800 e
JetBrains Mono statico 500, tutti con OFL 1.1. Il Mono esistente non contiene il
peso 600. Per non simularlo è stata aggiunta la versione WOFF2 variabile della
stessa famiglia da Google Fonts, 40.404 byte, asse wght 100–800, con glifi italiani
verificati, provenienza e licenza adiacenti. SHA-256:
`18be452724bfdc236c074ca94a249a7f41a86752c7d04ab258ce9ed5651f6a7e`.
I font PDF Radar non sono stati toccati.

### Export della route AI Score

La route esportava un helper oltre agli export ammessi da Next. L'helper è
stato estratto in `src/lib/ai-score/internal-preflight-auth.ts`, con `node:crypto`;
la route e l'unico test che lo importava usano il nuovo modulo Node server.
Il corpo delle funzioni di autorizzazione è identico al parent main, verificato
anche per confronto sorgente. Il POST, i codici report e gli algoritmi AI Score
sono invariati.

Restano confronto SHA-256/timingSafeEqual, Bearer case-insensitive, trim del
token ricevuto, rifiuto di configurazione assente/vuota e confronto esatto del
token configurato. Test aggiuntivi coprono token errato, schema Basic, Bearer
vuoto, suffisso indebito, spazi e risposte 401. Il nome della variabile interna
è assente da tutti gli asset JS/CSS client prodotti dalla build; nessun segreto
è stato copiato o introdotto nell'ambiente.

### Overflow mobile Evento

Responsabile: il testo `Centinaia` nella statistica del relatore, classe locale
`s171`, nella griglia `s170`. A 390 px la griglia storica aveva tre colonne da
107,34 px. Il range del testo terminava a x=394,125 px, propagando scrollWidth
394 al documento. I caroselli fuori viewport non erano la causa.

La sola griglia delle tre statistiche passa a due colonne nel breakpoint
esistente <=820 px. Font, contenuti, griglia desktop, caroselli e touch restano
gli stessi. Nessun overflow hidden/clip aggiunto al documento.

Controprova nel browser, in entrambi i temi: revisione corretta 390 px;
riapplicando temporaneamente tre colonne nel DOM 394 px; ripristinando il CSS
corretto 390 px. Il verificatore controlla anche il range effettivo del testo.

La QA visiva ha inoltre evidenziato che la foto scura dell'hero rendeva poco
leggibili logo e CTA dell'intestazione nel tema chiaro tablet. Una seconda
regola circoscritta dà alla sola intestazione chiara <=820 px il fondo crema
già usato dalla landing. Non sposta foto, contenuti o CTA e non cambia il tema
scuro. Screenshot prima/dopo e assert browser sul fondo documentano la verifica.

## Test e QA realmente eseguiti

| Controllo | Esito |
| --- | --- |
| npm run build, standard Turbopack | PASS dopo le correzioni; ripetuto PASS sulla revisione finale, 145 pagine e build-readable |
| Build Webpack | Non ripetuta in 2B: il controllo route/types passa nella build standard; il FAIL storico resta documentato in 2A |
| npm run typecheck | PASS, anche dopo la build finale |
| npm run lint | PASS: 0 errori, 65 warning preesistenti |
| ESLint sui file di codice nuovi/modificati | PASS, zero warning/errori |
| npm run test:radar | PASS, v4, positioning, dominio, persistenza, API, client, report, Stripe, CRM e operations con fixture |
| npm run test:patrimonial | PASS, compreso controllo contenuti prima bloccato dalla build |
| test:patrimonial-funnels / ledger / crm | PASS, tutti e tre |
| test:patrimonial-opportunities / persistence / remote-mapping | PASS, tutti e tre, provider/trasporti simulati |
| verify-patrimonial-event-presentation.mjs | PASS, baseline corrente e font locale aggiornato |
| verify-patrimonial-architect-presentation.mjs | PASS, contenuti 30 minuti e foto correnti |
| verify-patrimonial-theme.mjs | PASS, SSR, precedenza URL/storage, toggle, storage negato, aria-pressed e stili isolati |
| verify-patrimonial-integration.mjs | PASS, parent, inventari, font e auth invariata |
| npm test | PASS, inclusi build/editorial/narrative, Annunci 10x e suite AI Score con preflight aggiornato |
| verify-search.mjs http://127.0.0.1:3310 | PASS, 99 pagine sitemap, 802 entità, titoli, robots, guide, esclusione dei funnel e header |
| verify-readable.mjs, senza server | PASS, casi unitari di negoziazione Accept |
| verify-readable.mjs http://127.0.0.1:3310 | FAIL aggiuntivo su Vary, dettagli sotto |
| verify-patrimonial-integration-browser.mjs | PASS completo sulla build finale, Chrome headless reale e Playwright |

La matrice browser copre Evento e Architetto, chiaro/scuro, a 320/390/768/1440 px
(16 casi); Radar agli stessi quattro viewport (4 casi); ulteriori due casi a
390 px con motion normale, frecce tastiera e swipe touch Chromium simulato.

Verificati assenza di overflow documentale, 35/35 foto HTTP 200, immagini
decodificate, font, singolo h1, sezioni 17/15, header, CTA e moduli, selettore
tema anche via tastiera, focus/Tab, campi obbligatori, micro-step locale,
deduplicazione, errore/retry e pagina grazie. La CTA Radar è stata attivata da
tastiera fino alla qualificazione, senza creare sessioni.

Tutte le 18 richieste di invio della matrice finale sono state soddisfatte dall'intercettore browser,
con payload validati dal contratto corrente. Qualsiasi altra richiesta non GET
o esterna è abortita. Nessuna scrittura ha raggiunto server, Supabase o HighLevel.
Nei casi tablet, il test forza il caricamento delle immagini lazy ancora fuori
soglia per controllare ogni immagine, senza escludere quelle non caricate.

Sono stati esaminati screenshot effettivi di entrambi i funnel e temi, inclusi
mobile/tablet/desktop, form, caroselli, intestazione corretta e Radar. Artefatti
e log sono in `.preview/`, ignorati da Git. È QA Chrome con emulazione touch,
non un collaudo su dispositivi fisici o Safari/Firefox.

## Preservazione e rilievi residui

Radar v4 resta a **34 schermate**, con una POSITIONING: i 56 file Radar protetti
coincidono con main. Gli 11 file public-leads protetti coincidono con il parent
funnel; ledger, outbox, routing CRM, assegnazioni, mapping e contratti non hanno
correzioni ulteriori. Le 20 migration sono l'unione esatta dei parent; nessuna
è stata creata, modificata o applicata in 2B. Tutte le 35 foto restano identiche
byte per byte. Dipendenze, lockfile e script dei parent sono conservati.

Nessun file assignment, migration assignment, env locale, secret o tmp del
checkout originale è entrato nel worktree Radar. Nessun flag è stato abilitato.

Il controllo HTTP Markdown aggiuntivo fallisce richiedendo RSC nel Vary della
risposta Markdown: ricevuto `Accept-Encoding`. Anche Accept non è presente come
token autonomo. GET con Accept markdown restituisce 200/text-markdown, GET HTML
200/text-html; il difetto osservato è nel contratto degli header, non nei funnel.
Proxy, accept-markdown, route index.md e verificatore coincidono esattamente con
main; next.config conserva le regole della home, aggiungendo solo noindex delle
route patrimoniali. Non è stata eseguita una seconda build separata del parent
main: la preesistenza runtime è un'inferenza dai sorgenti invariati, non un
confronto browser fra due build. Rilievo aperto, da trattare separatamente prima
di attestare l'intera negoziazione/cache pubblica. Il test non è stato indebolito.

Il diff applicativo 2B non introduce altri cambi di dominio. `git diff --check`
sulle correzioni passa. Il controllo dell'intero merge segnala una riga con
whitespace finale in patrimonial-event-form.tsx:59, già identica in 88fafcb;
è conservata per non alterare il form protetto. Non è un errore di esecuzione.

## Readiness e consegna

I tre blocchi richiesti sono chiusi e la base Radar/funnel è pronta per la
**progettazione metodologica della Fase 3**, con il rilievo HTTP home dichiarato.
Non si attesta che ogni controllo possibile del repository sia PASS né che il
sistema sia pronto a deploy. Il modello diagnostico patrimoniale non è stato
progettato o implementato. Nessuna operazione remota o smoke con scritture reali.

Le correzioni applicative 2B sono limitate a route font Evento, font/licenza,
estrazione helper AI Score e due regole CSS Evento. I test e la documentazione
completano questi interventi e quelli preparati in 2A. Il report 2A rimane
storico e non viene riscritto.

## Inventario completo dei file rispetto al parent main

Comprende il merge dei funnel, le verifiche 2A e le correzioni 2B; viene
generato dal diff e dai nuovi file destinati al commit, escludendo gli ignorati.

118 file.

- .env.example
- docs/patrimonial/patrimonial-architect-mobile-revision-v1.md
- docs/patrimonial/patrimonial-architect-redesign-v1.md
- docs/patrimonial/patrimonial-event-mobile-revision-v1.md
- docs/patrimonial/patrimonial-event-redesign-v1.md
- docs/patrimonial/patrimonial-highlevel-contract-v1.md
- docs/patrimonial/patrimonial-highlevel-inventory-v1.md
- docs/patrimonial/patrimonial-live-smoke-v1.md
- docs/patrimonial/patrimonial-supabase-readiness-v1.md
- docs/patrimonial/radar-patrimoniale-v1-integrazione-fase-2a.md
- docs/patrimonial/radar-patrimoniale-v1-integrazione-fase-2b.md
- next.config.ts
- package.json
- public/benessere-patrimoniale/evento/argento.jpg
- public/benessere-patrimoniale/evento/coins.jpg
- public/benessere-patrimoniale/evento/collezione.jpg
- public/benessere-patrimoniale/evento/crescita.jpg
- public/benessere-patrimoniale/evento/cripto.jpg
- public/benessere-patrimoniale/evento/diversificazione.jpg
- public/benessere-patrimoniale/evento/etf.jpg
- public/benessere-patrimoniale/evento/hero.jpg
- public/benessere-patrimoniale/evento/immobili.jpg
- public/benessere-patrimoniale/evento/obbligazioni.jpg
- public/benessere-patrimoniale/evento/profilo-1.jpg
- public/benessere-patrimoniale/evento/profilo-2.jpg
- public/benessere-patrimoniale/evento/profilo-3.jpg
- public/benessere-patrimoniale/evento/profilo-4.jpg
- public/benessere-patrimoniale/evento/pyramid.jpg
- public/benessere-patrimoniale/evento/radar.jpg
- public/benessere-patrimoniale/evento/s_bank.jpg
- public/benessere-patrimoniale/evento/s_business.jpg
- public/benessere-patrimoniale/evento/s_cart.jpg
- public/benessere-patrimoniale/evento/s_hourglass.jpg
- public/benessere-patrimoniale/evento/serata-1.jpg
- public/benessere-patrimoniale/evento/serata-2.jpg
- public/benessere-patrimoniale/evento/single.jpg
- public/benessere-patrimoniale/percorso-architetto/blueprint.jpg
- public/benessere-patrimoniale/percorso-architetto/conversazione.jpg
- public/benessere-patrimoniale/percorso-architetto/founder.jpg
- public/benessere-patrimoniale/percorso-architetto/hero.jpg
- public/benessere-patrimoniale/percorso-architetto/scene-caffe.jpg
- public/benessere-patrimoniale/percorso-architetto/scene-domenica.jpg
- public/benessere-patrimoniale/percorso-architetto/scene-opportunita.jpg
- public/benessere-patrimoniale/percorso-architetto/skyline.jpg
- public/benessere-patrimoniale/percorso-architetto/story-1.jpg
- public/benessere-patrimoniale/percorso-architetto/story-2.jpg
- public/benessere-patrimoniale/percorso-architetto/story-3.jpg
- public/benessere-patrimoniale/percorso-architetto/stuck.jpg
- scripts/build-patrimonial-light-theme.mjs
- scripts/fixtures/highlevel-contact-upsert.mjs
- scripts/fixtures/patrimonial-memory-store.ts
- scripts/fixtures/patrimonial-post-crm.mjs
- scripts/fixtures/patrimonial-supabase-transport.mjs
- scripts/lib/patrimonial-integration-baselines.mjs
- scripts/lib/patrimonial-live-smoke-bindings.mjs
- scripts/lib/patrimonial-live-smoke-contact.mjs
- scripts/lib/patrimonial-live-smoke-env.mjs
- scripts/lib/patrimonial-live-smoke-preflight.mjs
- scripts/lib/patrimonial-live-smoke-runtime.mjs
- scripts/lib/patrimonial-live-smoke.mjs
- scripts/run-patrimonial-live-smoke.mjs
- scripts/verify-ai-score-phase7b0-preflight.mjs
- scripts/verify-patrimonial-architect-browser.mjs
- scripts/verify-patrimonial-architect-presentation.mjs
- scripts/verify-patrimonial-crm.mjs
- scripts/verify-patrimonial-event-browser.mjs
- scripts/verify-patrimonial-event-presentation.mjs
- scripts/verify-patrimonial-form-presentation.mjs
- scripts/verify-patrimonial-funnels.mjs
- scripts/verify-patrimonial-integration-browser.mjs
- scripts/verify-patrimonial-integration.mjs
- scripts/verify-patrimonial-ledger.mjs
- scripts/verify-patrimonial-live-smoke.mjs
- scripts/verify-patrimonial-opportunities.mjs
- scripts/verify-patrimonial-opportunity-sql.mjs
- scripts/verify-patrimonial-persistence.mjs
- scripts/verify-patrimonial-remote-mapping.mjs
- scripts/verify-patrimonial-theme.mjs
- scripts/verify-search.mjs
- src/app/(patrimonial-pilot)/benessere-patrimoniale/evento/grazie/page.tsx
- src/app/(patrimonial-pilot)/benessere-patrimoniale/evento/page.tsx
- src/app/(patrimonial-pilot)/benessere-patrimoniale/percorso-architetto-patrimoniale/grazie/page.tsx
- src/app/(patrimonial-pilot)/benessere-patrimoniale/percorso-architetto-patrimoniale/page.tsx
- src/app/(patrimonial-pilot)/fonts/OFL-jetbrains-mono.txt
- src/app/(patrimonial-pilot)/fonts/README.md
- src/app/(patrimonial-pilot)/fonts/jetbrains-mono-latin-wght-normal.woff2
- src/app/(patrimonial-pilot)/funnel.module.css
- src/app/(patrimonial-pilot)/layout.tsx
- src/app/api/internal/ai-score/provider-preflight/route.ts
- src/app/sitemap.ts
- src/components/patrimonial-architect-form.tsx
- src/components/patrimonial-architect-landing.tsx
- src/components/patrimonial-architect.module.css
- src/components/patrimonial-event-clock.tsx
- src/components/patrimonial-event-form.tsx
- src/components/patrimonial-event-landing.tsx
- src/components/patrimonial-event.module.css
- src/components/patrimonial-lead-form.tsx
- src/components/patrimonial-pilot-shell.tsx
- src/components/patrimonial-theme-frame.tsx
- src/components/patrimonial-theme.module.css
- src/content/patrimonial-architect-session.ts
- src/content/patrimonial-event-content.ts
- src/content/patrimonial-event-session.ts
- src/content/patrimonial-funnels.ts
- src/lib/ai-score/internal-preflight-auth.ts
- src/lib/public-leads/handler.ts
- src/lib/public-leads/patrimonial-consents.ts
- src/lib/public-leads/patrimonial-contract.ts
- src/lib/public-leads/patrimonial-funnels.ts
- src/lib/public-leads/patrimonial-highlevel-config.ts
- src/lib/public-leads/patrimonial-highlevel.ts
- src/lib/public-leads/patrimonial-routing.ts
- src/lib/public-leads/patrimonial-store.ts
- src/lib/public-leads/patrimonial-supabase.ts
- src/lib/public-leads/patrimonial-sync.ts
- supabase/migrations/20261014225059_patrimonial_lead_v2.sql
- supabase/migrations/20261015100912_patrimonial_opportunity_jsonb_precedence.sql
