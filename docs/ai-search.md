# Ricerca e assistenti AI — criteri operativi

Aggiornato il 21 settembre 2026. Ambito: sito pubblico Horyzon; nessuna modifica a Hub, Platform o dati tenant.

## Fonti pubbliche e priorità

1. HTML statico completo, pagine canoniche accessibili, metadati specifici e link navigabili.
2. Descrizioni verificabili, persone responsabili e distinzione tra capacità disponibili, configurazione e direzione evolutiva.
3. Misurazione dell'indicizzazione, delle citazioni e dei contatti. Il completamento tecnico non prova che un assistente citerà il sito.
4. `/llms.txt` e `/index.md` sono risorse opzionali. Google Search non le usa come segnale speciale: non attribuire loro un miglioramento di ranking.

Le risposte pubbliche in `src/content/public-guide.ts` alimentano sia l'HTML di `/radar-impresa` sia la sintesi Markdown. Metodo e capacità sono importati dalle fonti già usate nelle pagine; la sintesi conserva le categorie di disponibilità. Non aggiungere casi, numeri, clienti o attivazioni senza prove e autorizzazione alla pubblicazione.

## Crawler e indicizzazione

La policy aperta preesistente è conservata. I bot di ricerca (`OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`, Googlebot e Bingbot) e gli agenti su richiesta (`ChatGPT-User`, `Claude-User`, `Perplexity-User`) sono espliciti in robots.txt. Gli agenti su richiesta non applicano necessariamente robots nello stesso modo dei crawler.

`GPTBot` e `ClaudeBot` riguardano addestramento; `CCBot` e `Bytespider` restano sotto la regola generale. `Google-Extended` riguarda training e alcuni usi di grounding esterni a Google Search; `Applebot-Extended` controlla l'uso per addestramento distinto da Applebot. La presente modifica non cambia il consenso tecnico preesistente a questi agenti. Un'eventuale scelta di esclusione va trattata separatamente dalla ricerca/citazione.

Il dominio canonico è `https://horyzon.it`. La produzione deve servire direttamente questo hostname e reindirizzare `www` verso di esso. I domini sono già presenti nel progetto Vercel esistente; non crearne altri, non modificare DNS per questa operazione. Le preview mantengono i canonical di produzione.

`/radar` è una landing commerciale deliberatamente noindex, distinta da `/radar-impresa`. Policy provvisorie e biglietti `/v/*` restano noindex; tutti esclusi dalla sitemap. Le risorse testuali sono accessibili ma noindex per mantenere le pagine HTML come destinazioni di ricerca. Le traduzioni storiche non ricevono hreflang prima della verifica dell'equivalenza editoriale; il `<main>` ha già la lingua appropriata, con cornice italiana.

## Sicurezza e compatibilità

Gli header sono configurati in Next e verificati sulle risposte HTTP, anche dei file testuali e della 404. La CSP conserva la generazione statica: `unsafe-inline` è necessario alla hydration Next e agli stili animati esistenti; `unsafe-eval` è escluso dalla produzione. Questo limite è esplicito: non è una policy XSS con nonce/hash. Oggetti e framing sono bloccati, sorgenti limitate al sito e ai formati locali necessari.

Nessun tracker GA4/GTM o cookie banner è presente nell'implementazione verificata. Non aggiungere preventivamente domini analytics alla CSP. Un futuro strumento di misurazione richiede inventario del traffico, configurazione del consenso e una modifica mirata alla policy. Il modulo prepara una bozza nel client email; non invia messaggi da un backend.

## Verifica e misurazione

La homepage supporta `Accept: text/markdown` sullo stesso URL, con `Vary: Accept`. La rappresentazione viene generata dall'HTML prerenderizzato a ogni build in `public/home.md`, senza duplicare il testo editoriale. HTML resta il formato predefinito; preferenze HTTP, esclusione `q=0` e richieste RSC sono rispettate. La risorsa diretta `/home.md` è noindex; la rappresentazione negoziata della homepage conserva l'indicizzabilità. `/index.md` resta la sintesi generale del sito, distinta dalla trascrizione della homepage. Le altre pagine continuano a servire HTML statico.

Eseguire `npm run test:readable` e `npm run test:readable -- https://horyzon.it` per verificare negoziazione, cache separate HTML/Markdown, MIME e indicizzabilità. Il file generato non è versionato: usare sempre `npm run build`, anche su Vercel. Il rapporto testo/codice di scanner esterni non misura la percentuale di contenuto effettivamente compresa dagli assistenti.

Eseguire `npm run build`, `npm run lint`, `npm run typecheck`, `npm test` e `npm run test:search`. Il controllo search usa l'output reale della build; `node scripts/verify-search.mjs https://horyzon.it` controlla anche status, MIME e header della produzione. Verificare inoltre browser desktop/mobile, riduzione movimento, CTA, link, console e assenza di overflow.

Lighthouse misura laboratorio: non riportare TBT come INP né i suoi risultati come 75° percentile sul campo. `/radar` perde punti SEO per il noindex voluto; non rimuoverlo per aumentare il punteggio. Non esiste un punteggio universale AI-readiness: presentare i controlli tecnici, poi separatamente la visibilità osservata.

Baseline e controlli a 30/60/90 giorni (nessuna automazione creata):

- Google Search Console: pagine indicizzate, canonical scelto, problemi di scansione e report disponibili nella proprietà.
- Bing Webmaster Tools AI Performance: citazioni, pagine e grounding query sulle superfici supportate da Microsoft. Non generalizzare a tutti gli assistenti e non confondere citazioni con click.
- Analytics, se autorizzate: referral riconoscibili e contatti effettivi; un click sul Radar non prova la compilazione nel diverso prodotto Hub.
- Campione dichiarato di domande: data, lingua, motore, ricerca abilitata, risposta e fonti. Le variazioni non dimostrano causalità.

IndexNow è un'opzione futura per notificare modifiche effettive, senza garanzie di indicizzazione. Non sono state create chiavi, variabili o connessioni a proprietà esterne. Restano necessari accessi autorizzati ai pannelli per la misurazione reale, informative definitive e prove pubblicabili per eventuali casi studio.

## Riferimenti ufficiali consultati

- https://vercel.com/blog/making-agent-friendly-pages-with-content-negotiation

- https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.google.com/search/updates (ritiro FAQ rich results, 7 maggio 2026)
- https://developers.openai.com/api/docs/bots
- https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler
- https://docs.perplexity.ai/docs/resources/perplexity-crawlers
- https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c
- https://www.indexnow.org/faq

I report operativi e le catture sono conservati in `.preview/seo-audit`, `.preview/seo-live` e `.preview/seo-browser`, esclusi da Git come gli altri report runtime del repository.
