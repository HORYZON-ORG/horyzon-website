import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

async function text(path) {
  return readFile(path, 'utf8');
}

function count(source, needle) {
  return source.split(needle).length - 1;
}

function cssBlock(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`${escaped} \\{[\\s\\S]*?\\n\\}`))?.[0] ?? '';
}

const page = await text('src/app/annunci-10x/page.tsx');
const client = await text('src/components/annunci-10x/annunci-10x-client.tsx');
const flow = await text('src/components/annunci-10x/annunci-10x-analyze-flow.tsx');
const commerceClient = await text('src/components/annunci-10x/annunci-10x-commerce-client.ts');
const createFlow = await text('src/lib/annunci-10x/create-flow.ts');
const identityGate = await text('src/components/annunci-10x/annunci-10x-identity-gate.tsx');
const css = await text('src/components/annunci-10x/annunci-10x.module.css');
const landingCss = await text('src/app/annunci-10x/annunci-landing.css');
const kitCss = await text('src/styles/horyzon-landing.css');
const adSheet = await text('src/components/annunci-10x/landing/ad-sheet.tsx');
const story = await text('src/components/annunci-10x/landing/candidate-story.tsx');
const createCta = await text('src/components/annunci-10x/landing/create-cta.tsx');
const radarPage = await text('src/app/radar/page.tsx');
const commercial = await text('src/lib/annunci-10x/commercial.ts');
const sitemap = await text('src/app/sitemap.ts');
const shell = await text('src/components/site-shell.tsx');
const home = await text('src/components/experience.tsx');
const contract = await text('docs/annunci-10x/commercial-contract-v3.md');
const brandPath = 'public/annunci-10x/horyzon-consulting-recruiting-white.png';
const guidePreviewPath = 'public/annunci-10x/annunci-10x-anteprima.pdf';
const oldBrandPath = '/annunci-10x/horyzon-consulting-recruiting.png';
const brandPublicPath = '/annunci-10x/horyzon-consulting-recruiting-white.png';
const brandBuffer = await readFile(brandPath);
const brandStat = await stat(brandPath);
const guidePreviewBuffer = await readFile(guidePreviewPath);
const guidePreviewStat = await stat(guidePreviewPath);

const publicSource = `${page}\n${client}\n${flow}\n${identityGate}\n${adSheet}\n${story}`;
const guaranteeCopy = '7 € per un annuncio, una versione e un canale. Dopo la conferma del pagamento generiamo il testo completo e te lo rendiamo disponibile. Se non ti è utile, puoi chiedere il rimborso integrale entro 14 giorni dalla consegna, senza motivazione, scrivendo a info@horyzon.it dall’email usata per l’acquisto.';
const scoreDisclaimer = 'Il punteggio valuta la chiarezza e la completezza delle informazioni disponibili nell’annuncio. Non prevede il numero di candidature né sostituisce la valutazione delle persone.';

assert.equal(page.includes('SiteHeader'), false, 'Annunci 10x route must not use global SiteHeader');
assert.equal(page.includes('SiteFooter'), false, 'Annunci 10x route must not use global SiteFooter');
assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false,\s*nocache:\s*true\s*\}/s, 'route must stay noindex,nofollow,nocache');
assert.match(page, /Annunci 10x — Score di chiarezza e annuncio pronto a 7 €/, 'metadata title must use V3 score/product copy');
assert.match(page, /Valuta gratis chiarezza e completezza del tuo annuncio/, 'metadata description must use V3 score/product copy');
assert.match(page, /siteName:\s*'Horyzon Consulting Recruiting'/, 'OG site name must use recruiting brand');

assert.equal(sitemap.includes('annunci-10x'), false, 'Annunci 10x must stay out of sitemap source');
assert.equal(shell.includes('annunci-10x'), false, 'Annunci 10x must stay out of global header/footer shell');
assert.equal(home.includes('annunci-10x'), false, 'Annunci 10x must stay out of home experience');

const headerBlock = `${page.match(/function Brand[\s\S]*?\n}/)?.[0] ?? ''}\n${page.match(/<header className="rd-header">[\s\S]*?<\/header>/)?.[0] ?? ''}`;
assert.equal(headerBlock.includes('Metodo'), false, 'funnel header must not link Metodo');
assert.equal(headerBlock.includes('Prodotti'), false, 'funnel header must not link Prodotti');
assert.equal(headerBlock.includes('FAQ'), false, 'funnel header must not link FAQ');
assert.equal(headerBlock.includes('Valuta gratis'), true, 'funnel header must keep the single CTA');
assert.match(headerBlock, /\/annunci-10x\/horyzon-consulting-recruiting-white\.png/, 'canonical transparent Recruiting logo asset must be used in the header');
assert.equal(headerBlock.includes(oldBrandPath), false, 'old Recruiting logo asset must not be used in the header');
assert.equal(headerBlock.includes(brandPublicPath), true, 'new Recruiting logo public path missing from header');
assert.match(headerBlock, /unoptimized/, 'header logo must bypass image optimization to preserve the approved PNG asset');
assert.match(headerBlock, /width=\{2048\}\s+height=\{768\}/, 'header logo must use the attached 8:3 PNG dimensions');
assert.match(landingCss, /\.ax-brand img\{[^}]*width:clamp\(168px,16vw,220px\)[^}]*height:auto[^}]*object-fit:contain/, 'header logo must use a responsive width and preserve ratio without cropping');
assert.equal(css.includes('border-radius: 18px'), false, 'old white-panel logo border radius must be removed');
assert.match(headerBlock, /aria-label="Horyzon Consulting Recruiting"/, 'header logo link must keep an accessible brand label');
assert.equal(headerBlock.includes('<span>Horyzon Consulting</span>'), false, 'typographic brand fallback must be removed');
assert.equal(headerBlock.includes('Horyzon Consulting</span>'), false, 'header must not include a textual brand fallback');

assert.match(page, /Il candidato sbagliato non ha dubbi\.[\s\S]*Quello giusto sì\./, 'hero headline missing');
assert.match(page, /Un annuncio vago fa passare oltre chi sarebbe adatto e attira chi si candida a tutto\. Lo Score di chiarezza ti mostra che cosa capisce davvero chi lo legge\./, 'hero lead missing');
assert.match(page, /Annunci 10x <i>·<\/i> Score gratuito <i>·<\/i> 2 minuti/, 'hero label missing');
assert.match(page, /Valuta il mio annuncio/, 'primary CTA missing');
assert.match(page, /href="#ax-story-title">Prima fammi vedere/, 'soft secondary CTA must lead to the story');
assert.match(page, /Non ho ancora un annuncio: crealo a 7 €/, 'create CTA missing');
assert.equal(page.includes('Il tuo annuncio fa capire il lavoro alle persone giuste?'), false, 'V3 hero headline must not remain');
assert.equal(client.includes('Il tuo annuncio sceglie i candidati prima di te.'), false, 'old hero headline must not remain');
assert.equal(client.includes('Vedi subito lo Score'), false, 'old instant-score promise must not remain');
assert.equal(client.includes('<strong>37<small>/100</small></strong>'), false, 'artificial 37/100 hero demo must not remain');
assert.equal(client.includes('ScoreDemoCard'), false, 'hero score demo component must be removed');

assert.equal(flow.includes('Analizza gratis il tuo annuncio'), true, 'source form title missing');
assert.equal(flow.includes('Analizza il mio annuncio — gratis'), true, 'source CTA missing');
assert.equal(flow.includes('Incolla qui il testo del tuo annuncio'), true, 'pasted-text placeholder missing');
assert.equal(flow.includes('Incolla il testo o il link pubblico. Ti mostriamo lo Score'), false, 'redundant source subtitle must be removed');
assert.match(flow, /rows=\{text\.trim\(\) \? 10 : 3\}/, 'textarea must use compact empty rows and expanded filled rows');
assert.match(css, /\.sourceTextarea\[data-empty="true"\][\s\S]*min-height:\s*84px/, 'empty source textarea compact min-height missing');
assert.match(css, /\.sourceTextarea[\s\S]*min-height:\s*220px/, 'filled source textarea min-height missing');
assert.equal(flow.includes('Ti mandiamo un codice di 6 cifre'), true, 'OTP copy missing');
assert.equal(flow.includes('Stiamo applicando i 20 controlli'), true, 'progress copy missing');
assert.match(flow, /const hasWorkspace = Boolean\(busy === 'source' \|\| analysisRun \|\| sourceFailed \|\| statusMessage \|\| error \|\| result\)/, 'post-analysis workspace visibility guard missing');
assert.match(flow, /data-flow="analyze" data-has-workspace=\{hasWorkspace\}/, 'analyze shell must expose workspace state to CSS');
assert.match(flow, /ref=\{workspaceRef\} className=\{styles\.analysisWorkspace\}/, 'post-analysis states must render in a dedicated workspace surface');
assert.match(flow, /const flowCycleRef = useRef\(0\)/, 'analyze flow must guard stale async responses with a local cycle token');
assert.match(flow, /if \(cycle !== flowCycleRef\.current\) return;[\s\S]*setResult\(payload\.result\)/, 'stale result responses must not repopulate a reset analyze flow');
assert.match(flow, /setCommercial\(null\);[\s\S]*setCommercialStatus\(null\);[\s\S]*setIdentityResetKey/, 'new analyze cycles must clear stale commercial and identity state');
assert.match(flow, /const nextRun = normalizeRun\(payload\.run\);[\s\S]*setAnalysisRun\(nextRun\);[\s\S]*setContactSaved\(Boolean\(nextRun\.contactSaved\)\);[\s\S]*setEmailVerified\(Boolean\(nextRun\.emailVerified\)\);/, 'new analysis runs must derive identity state from the normalized server run');
assert.match(flow, /function analyzeAnother\(\)[\s\S]*flowCycleRef\.current \+= 1[\s\S]*setText\(''\)[\s\S]*setUrl\(''\)[\s\S]*setCommercial\(null\)/, 'Analyze another must fully reset source, result and offer state');
assert.match(flow, /function recoverUrlAsText\(\)[\s\S]*setSourceMode\('PASTED_TEXT'\)[\s\S]*setAnalysisRun\(null\)[\s\S]*focusSourceTextarea\(\)/, 'URL fetch failure must reopen the pasted-text form and focus the textarea');
assert.match(flow, /ref=\{sourceTextareaRef\}/, 'pasted-text textarea must be focusable after URL fetch recovery');
assert.match(flow, /const canShowContact = Boolean\(analysisRun\?\.id && !sourceFailed\)/, 'URL fetch failures must not continue into the contact/OTP step');
assert.match(flow, /onKeyDown=\{handleSourceToggleKeyDown\}/, 'source radiogroup must support keyboard arrow selection');
assert.match(flow, /const textRadioRef = useRef<HTMLButtonElement \| null>\(null\);[\s\S]*const linkRadioRef = useRef<HTMLButtonElement \| null>\(null\);/, 'source radiogroup must keep refs for roving focus');
assert.match(flow, /tabIndex=\{sourceMode === 'PASTED_TEXT' \? 0 : -1\}/, 'pasted-text radio must be the only tabbable item when checked');
assert.match(flow, /tabIndex=\{sourceMode === 'PUBLIC_URL' \? 0 : -1\}/, 'public-url radio must be the only tabbable item when checked');
assert.match(flow, /ArrowLeft[\s\S]*ArrowUp[\s\S]*Home[\s\S]*selectSourceMode\('PASTED_TEXT', \{ focusRadio: true, focusTextarea: false \}\)/, 'left/up/home must select and focus the pasted-text radio without focusing the textarea');
assert.match(flow, /ArrowRight[\s\S]*ArrowDown[\s\S]*End[\s\S]*selectSourceMode\('PUBLIC_URL', \{ focusRadio: true, focusTextarea: false \}\)/, 'right/down/end must select and focus the public-url radio without focusing the textarea');
assert.equal(flow.includes('resultRef.current.scrollIntoView'), false, 'post-analysis result must not force page scroll or stretch the hero');
assert.equal(flow.includes('workspaceRef.current?.scrollTo'), false, 'post-analysis card must not rely on internal scroll reset');
assert.match(page, /import '@\/styles\/horyzon-landing\.css';/, 'landing must use the shared landing kit');
assert.match(radarPage, /import '@\/styles\/horyzon-landing\.css';/, 'Radar must use the same shared landing kit');
assert.match(page, /<div className="rd ax">/, 'landing must use the kit root and the Annunci modifier');
assert.match(page, /<AdSheet className="ax-hero-sheet" scan \/>/, 'hero must show the ad under the lens');
assert.equal(/Image[^>]*hero\.jpeg/.test(`${page}\n${client}`), false, 'stock hero photo must not return');
assert.match(kitCss, /--lime:#d8ff42/, 'landing kit palette missing');
assert.equal(/amber|#e7c06e/.test(`${css}\n${landingCss}`), false, 'no gold: DESIGN.md palette only');
assert.match(css, /\.heroPanel \.createShell > \.form \{[\s\S]*border-radius:\s*12px[\s\S]*box-shadow:\s*0 28px 95px/, 'the analyze form must render as a lifted card');
assert.equal(/\.heroPanel \.createShell\[data-has-workspace="true"\] > \.form \{[\s\S]*display:\s*none/.test(css), false, 'source form must remain visible when the result workspace exists');
assert.match(flow, /<form className=\{styles\.form\}[\s\S]*<\/form>\s*\n\s*\{hasWorkspace && <div ref=\{workspaceRef\}/, 'analysis form must remain rendered before the separate workspace');
const analysisWorkspaceBlock = cssBlock('.analysisWorkspace');
assert.equal(/position:\s*absolute/.test(analysisWorkspaceBlock), false, 'post-analysis workspace must stay in normal flow so it never covers the next section');
assert.match(analysisWorkspaceBlock, /width:\s*100%/, 'workspace must align to the form card width');
assert.match(analysisWorkspaceBlock, /overflow:\s*visible/, 'post-analysis workspace must not clip the card');
assert.equal(/overflow-y:\s*auto/.test(analysisWorkspaceBlock), false, 'post-analysis card must not have internal vertical scroll');
assert.equal(/max-height:/.test(analysisWorkspaceBlock), false, 'post-analysis card must not rely on a capped desktop height');
assert.equal(/\.analysisWorkspace[\s\S]*?overflow-y:\s*auto/.test(css), false, 'workspace must never introduce an internal scrollbar');
assert.equal(/\.analysisWorkspace[\s\S]*?max-height:/.test(css), false, 'workspace must never use max-height caps');
assert.equal(/\.analysisWorkspace \{[^}]*position:\s*absolute/.test(css), false, 'mobile analyze workspace must stay in normal flow without internal scroll');

// The free result is a single-column report card; the paid rewrite is a separate card after it, never inside.
const resultBlock = cssBlock('.analysisWorkspace .result');
assert.match(resultBlock, /display:\s*grid/, 'workspace result must render as a report card');
assert.equal(/grid-template-columns/.test(resultBlock), false, 'workspace result must keep score and interpretation vertical');
assert.match(flow, /<FreeResultCard result=\{result\} \/>\s*\n\s*<RewriteOfferCard /, 'rewrite offer must follow the report as its own card');
const freeResultCardBlock = flow.slice(flow.indexOf('function FreeResultCard'), flow.indexOf('function RewriteOfferCard'));
assert.equal(freeResultCardBlock.includes('RewriteOfferCard'), false, 'the report card must not contain the offer');
assert.match(flow, /className=\{styles\.flowSteps\}/, 'the free Score must show its three steps');
assert.equal(page.includes('className="rd-steps"'), false, 'steps must not be duplicated above the flow');

assert.equal(count(client, '<Annunci10xAnalyzeFlow'), 1, 'Annunci10xAnalyzeFlow must render exactly once');
assert.equal(count(page, '<Annunci10xClient'), 1, 'the interactive client must render exactly once, inside #valuta');
assert.match(page, /<section id="valuta"[\s\S]*<Annunci10xClient \/>[\s\S]*<\/section>/, 'free Score must live in the "Tocca a te" section');
assert.equal(brandStat.isFile(), true, 'Recruiting logo asset file missing');
assert.equal(brandStat.size > 0, true, 'Recruiting logo asset must not be empty');
assert.deepEqual([...brandBuffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'Recruiting logo asset must be a PNG');
assert.equal(brandBuffer.readUInt32BE(16), 2048, 'Recruiting logo PNG width changed');
assert.equal(brandBuffer.readUInt32BE(20), 768, 'Recruiting logo PNG height changed');
assert.equal(brandBuffer[25], 6, 'Recruiting logo PNG must keep alpha transparency');

assert.match(publicSource, /Score di chiarezza/, 'public score name missing');
assert.equal(publicSource.includes('Annunci 10x Score'), false, 'old public score name must not remain');
assert.match(publicSource, new RegExp(escapeRegExp(scoreDisclaimer)), 'score disclaimer missing');
assert.equal(publicSource.includes('Performia'), false, 'Performia must be absent from the public funnel');
assert.equal(publicSource.includes('49,00'), false, '49 EUR package must be hidden from the public funnel');
assert.equal(/(^|[^\d])9 €/.test(publicSource), false, 'old 9 EUR CREATE price must not remain');
assert.equal(publicSource.includes('9,00'), false, 'old 9 EUR CREATE price must not remain');
assert.match(publicSource, /Annuncio 10x/, 'single public product name missing');
assert.match(publicSource, new RegExp(escapeRegExp(guaranteeCopy)), 'guarantee copy missing or altered');

for (const label of ['Critico', 'Debole', 'Buona base', 'Forte', 'Eccellente']) {
  assert.equal(flow.includes(label), true, `flow score band label missing: ${label}`);
}
assert.equal(client.includes("'Base'"), false, 'old client score label Base must not remain');
assert.equal(client.includes("'Buono'"), false, 'old client score label Buono must not remain');
assert.equal(flow.includes("'Base'"), false, 'old flow score label Base must not remain');
assert.equal(flow.includes("'Buono'"), false, 'old flow score label Buono must not remain');
assert.match(css, /\.scoreBandBar[\s\S]*grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/, 'score band must visually render five segments');

for (const role of ['Operaio di produzione', 'Saldatore', 'Manutentore meccanico', 'Elettricista', 'Tecnico installatore', 'Magazziniere carrellista', 'Autista patente C', 'Commerciale B2B', 'Impiegato amministrativo', 'Addetto alla contabilità', 'Cuoco', 'Cameriere di sala']) {
  assert.equal(page.toLowerCase().includes(role.toLowerCase()), true, `updated role example missing: ${role}`);
}
assert.equal(client.includes("const roles = ['Magazziniere'"), false, 'old flat role list must not remain');
assert.equal(client.includes('Automation Engineer'), false, 'old role list item must not remain');

assert.equal((adSheet.match(/\n    area: '/g) ?? []).length, 5, 'the job ad must carry five rewrites');
assert.match(adSheet, /Cameriere\/a di sala/, 'the job ad must use the common role');
assert.match(adSheet, /AD_FINAL_STEP = AD_REWRITES\.length \+ 1/, 'the rewrite must end on the clear ad');
assert.match(story, /Lo stesso annuncio, <em>riscritto riga per riga\.<\/em>/, 'rewrite story heading missing');
assert.match(story, /Esempio illustrativo: i dati veri li metti tu, noi li rendiamo chiari\./, 'the clear ad must be labelled as an illustrative example');
assert.match(story, /<AdSheet className="ax-story-sheet" step=\{AD_FINAL_STEP\} \/>/, 'static story must show the finished ad');
assert.match(story, /prefers-reduced-motion: no-preference/, 'candidate story must fall back to a static list');
assert.equal(/\d{1,3}\s*\/\s*100/.test(adSheet), false, 'the ad sheet must never show an invented score');
assert.equal(client.includes('Tanti visualizzano'), false, 'old funnel visual copy must not remain');
assert.equal(client.includes('prime correzioni pratiche'), false, 'landing must not promise specific practical corrections');
assert.match(page, /Le indicazioni operative arrivano nel report via email/, 'result must defer operational advice to email report');
assert.match(page, /Non un voto\. <span>Una lista di priorità\.<\/span>/, 'result heading missing');
assert.equal(client.includes('Caso reale in preparazione'), false, 'case-real-in-preparation block must be replaced');
assert.equal(/[0-9]{1,3}\s*(?:→|->)\s*[0-9]{1,3}/.test(client), false, 'before/after must not invent numeric score improvement');

assert.match(client, /7 €/, 'V3 price missing');
assert.match(client, /1 annuncio/, 'single-ad unit missing');
assert.match(client, /1 versione/, 'single-version unit missing');
assert.match(client, /1 canale/, 'single-channel unit missing');
assert.equal(commerceClient.includes('Disponibile a breve'), true, 'checkout-disabled customer-safe CTA missing');
// V3 keeps Annuncio 10x as the paid rewrite/create service and adds the Guide as a separate informational product.
const priceBlock = page.match(/<section id="annuncio-10x"[\s\S]*?<\/section>/)?.[0] ?? '';
assert.match(priceBlock, /<strong>7 €<\/strong>[\s\S]*1 annuncio[\s\S]*1 versione[\s\S]*1 canale/, 'price section must state 7 EUR and its units');
assert.match(priceBlock, /<CreateCta[^>]*>Non ho ancora un annuncio: crealo a 7 €/, 'price section must open the create-from-zero flow');
assert.match(priceBlock, /\{guaranteeCopy\}/, 'guarantee must sit under the price');
assert.equal(priceBlock.includes('Valuta'), false, 'price section must not make the free evaluation look paid');
const guideBlock = page.match(/<section id="guida-annunci-10x"[\s\S]*?<\/section>/)?.[0] ?? '';
assert.match(guideBlock, /Guida Annunci 10x/, 'guide section must be published on the landing');
assert.match(guideBlock, /<strong>49 €<\/strong>/, 'guide section must state the fixed 49 EUR price');
assert.match(guideBlock, /Scopri la guida — 49 €/, 'guide primary CTA missing');
assert.match(guideBlock, /Acquisto online non ancora attivo/, 'guide checkout availability note missing');
assert.match(guideBlock, /href=\{guidePreviewPath\}[\s\S]*target="_blank"[\s\S]*Anteprima/, 'guide preview CTA must open the official PDF in a new tab');
assert.match(page, /const guidePreviewPath = '\/annunci-10x\/annunci-10x-anteprima\.pdf'/, 'guide preview public path missing');
assert.equal(guidePreviewStat.isFile(), true, 'Guide preview PDF asset file missing');
assert.equal(guidePreviewStat.size > 0, true, 'Guide preview PDF asset must not be empty');
assert.deepEqual([...guidePreviewBuffer.subarray(0, 4)], [37, 80, 68, 70], 'Guide preview asset must be a PDF');
assert.match(createCta, /ANNUNCI10X_CREATE_EVENT = 'annunci10x:create'/, 'create CTA event missing');
assert.match(client, /addEventListener\(ANNUNCI10X_CREATE_EVENT/, 'client must open the create flow from landing CTAs');
assert.match(client, /window\.location\.hash === '#crea-annuncio'/, 'create flow deep link missing');

assert.equal(flow.includes('Copertura'), false, 'free result must not expose Copertura as a visible KPI label');
assert.equal(client.includes('Copertura'), false, 'funnel must not expose Copertura as a visible KPI label');
assert.equal(client.includes('/checkout'), false, 'funnel must not wire checkout route');
assert.equal(client.toLowerCase().includes('stripe'), false, 'funnel must not wire Stripe');
assert.equal(client.includes('/api/annunci-10x/commercial/purchase'), false, 'funnel must not add paid purchase API calls');
assert.equal(client.includes('/api/annunci-10x/premium/output'), false, 'funnel must not fetch premium output on page load');

assert.equal(client.includes('type ProductCode'), false, 'client commercial type must not use legacy ProductCode');
assert.equal(client.includes("productCode: ProductCode"), false, 'client offers must not use legacy productCode');
assert.equal(client.includes('GUIDE_PLUS_AD'), false, 'client must not expose legacy GUIDE_PLUS_AD commerce code');
assert.equal(client.includes('AD_GENERATION'), false, 'client must not expose legacy AD_GENERATION commerce code');
assert.equal(client.includes('discountReason'), false, 'client must not use legacy discountReason');
assert.match(commerceClient, /type Annunci10xOfferCode = 'ANNUNCI10X_REWRITE' \| 'ANNUNCI10X_CREATE' \| 'AGENT_RECRUITER'/, 'V3 offer code union missing');
assert.match(commerceClient, /version:\s*'annunci10x-commercial-v3'/, 'client commercial version must be V3');
assert.match(commerceClient, /Paga 7 € e genera il mio annuncio/, 'checkout CTA helper must use V3 paid CTA');
assert.match(commerceClient, /fetch\('\/api\/annunci-10x\/commercial\/offers'/, 'commercial offers fetch helper missing');
assert.match(commerceClient, /fetch\('\/api\/annunci-10x\/commercial\/checkout'/, 'checkout helper missing');
assert.match(commerceClient, /JSON\.stringify\(\{\s*offerCode\s*\}\)/s, 'checkout helper must post offerCode only');
const checkoutBody = commerceClient.match(/body:\s*JSON\.stringify\(([\s\S]*?)\),/)?.[1] ?? '';
assert.equal(checkoutBody.trim(), '{ offerCode }', 'checkout POST body must contain offerCode only');
for (const forbidden of ['amountCents', 'stripePriceId', 'successUrl', 'cancelUrl', 'customerEmail', 'entitlements', 'paid']) {
  assert.equal(checkoutBody.includes(forbidden), false, `checkout helper must not send ${forbidden}`);
}

assert.match(flow, /requestNonce:\s*analysisRequestNonceRef\.current/, 'analysis submit must carry a stable client request nonce');
assert.match(flow, /analysisRequestNonceRef\.current = createAnalysisRequestNonce\(\)/, 'new analysis cycle must rotate the request nonce');
assert.match(flow, /new URLSearchParams\(window\.location\.search\)\.get\('analysis'\)/, 'email analysis links must restore the requested run when the session is still available');
assert.match(flow, /Vuoi trasformarlo\?/, 'free result paid bridge missing');
assert.match(flow, /ANNUNCI10X_REWRITE/, 'analyze rewrite offer must be wired');
assert.equal(flow.includes('AGENT_RECRUITER'), false, 'analyze flow must not surface Agent Recruiter');
assert.match(client, /ANNUNCI10X_CREATE/, 'create offer must be wired');
assert.match(client, /Dove ti mandiamo il tuo annuncio\?/, 'CREATE identity gate title missing');
assert.match(identityGate, /Dati facoltativi/, 'optional lead context section missing');
assert.match(identityGate, /companyName:\s*''/, 'company must start empty and optional');
assert.match(identityGate, /businessRole:\s*'' as BusinessRole \| ''/, 'business role must start empty and optional');
assert.match(identityGate, /analysisRunId \? \{ code: otpCode, analysisRunId: props\.analysisRunId \} : \{ code: otpCode \}/, 'CREATE OTP verify must omit analysisRunId');
assert.match(client, /Pagamento ricevuto\./, 'checkout success banner missing');
assert.match(client, /Pagamento annullato\./, 'checkout cancel banner missing');
assert.match(client, /delays = \[0, 1500, 3000, 5000\]/, 'success refresh must be bounded to four attempts');

const createWizardConfig = client.match(/const createWizardSteps: readonly \{[\s\S]*?\n\];/)?.[0] ?? '';
assert.match(client, /type CreateWizardStepId = 'ROLE_RESULT' \| 'PERSON_WORK' \| 'CONDITIONS_APPLICATION'/, 'create wizard step type missing');
assert.match(createWizardConfig, /id:\s*'ROLE_RESULT'[\s\S]*title:\s*'Ruolo e risultato'[\s\S]*Partiamo da ciò che questa persona dovrà fare davvero e dal risultato che dovrà produrre\.[\s\S]*Avanti — Persona e lavoro[\s\S]*domainStepIds:\s*\['ROLE_CONTEXT', 'PRIMARY_CONTRIBUTION'\]/, 'create wizard step 1 mapping/copy missing');
assert.match(createWizardConfig, /id:\s*'PERSON_WORK'[\s\S]*title:\s*'Persona e lavoro'[\s\S]*Descrivi il lavoro reale e la persona che serve davvero per svolgerlo\.[\s\S]*Avanti — Condizioni e candidatura[\s\S]*domainStepIds:\s*\['WORK_REALITY', 'REQUIREMENTS'\]/, 'create wizard step 2 mapping/copy missing');
assert.match(createWizardConfig, /id:\s*'CONDITIONS_APPLICATION'[\s\S]*title:\s*'Condizioni e candidatura'[\s\S]*Completa l'offerta e spiega con chiarezza come candidarsi\.[\s\S]*domainStepIds:\s*\['ATTRACTION', 'OFFER', 'CHANNEL_APPLICATION'\]/, 'create wizard step 3 mapping/copy missing');
assert.match(createWizardConfig, /requiredFields:\s*\[\{ key: 'role', id: 'create-role' \}, \{ key: 'primaryResult', id: 'create-result' \}\]/, 'step 1 required fields missing');
assert.match(createWizardConfig, /requiredFields:\s*\[\{ key: 'activities', id: 'create-activities' \}, \{ key: 'requiredRequirements', id: 'create-required' \}, \{ key: 'operatingContext', id: 'create-context' \}\]/, 'step 2 required fields missing');
assert.match(createWizardConfig, /requiredFields:\s*\[\{ key: 'application', id: 'create-application' \}\]/, 'step 3 required fields missing');

const structuredFormBlock = client.match(/function StructuredCreateForm[\s\S]*?\nfunction CreateSummary/)?.[0] ?? '';
assert.match(structuredFormBlock, /useState<CreateWizardStepId>\(\(\) => inferCreateWizardStep\(props\.state\)\)/, 'wizard must open from resume-aware state');
assert.match(client, /key=\{createWizardResumeKey\(props\.state\)\}/, 'wizard must remount from resumed create state');
assert.match(structuredFormBlock, /aria-current=\{isActive \? 'step' : undefined\}/, 'active wizard step must expose aria-current="step"');
assert.match(structuredFormBlock, /Step \{activeStepIndex \+ 1\}\/3/, 'wizard must show current step count');
assert.match(structuredFormBlock, /<CreateGuidanceNote \/>/, 'each create wizard card must show the guidance note');
assert.match(client, /Più informazioni ci dai, più completo e preciso sarà il tuo annuncio\./, 'create guidance main note missing');
assert.match(client, /Compila almeno i campi contrassegnati con \*; aggiungi gli altri dettagli quando li conosci\./, 'create guidance secondary note missing');
assert.match(client, /\* Campo necessario per continuare/, 'required marker convention note missing');
assert.equal(client.includes('<em>opzionale</em>'), false, 'create form must not show an Opzionale marker');
assert.match(structuredFormBlock, /const invalid = validateCreateWizardStep\(props\.draft, activeStep\)[\s\S]*focusCreateField\(invalid\.id\)/, 'next must validate only the active step and focus the first problem');
assert.match(structuredFormBlock, /function previousStep\(\)[\s\S]*moveToStep\(previous\.id\)/, 'back navigation must not validate or clear data');
assert.match(structuredFormBlock, /const invalid = firstInvalidCreateWizardField\(props\.draft\)[\s\S]*moveToStepAndFocusField\(invalid\.stepId, invalid\.id\)/, 'final submit must find hidden invalid fields and focus them');
assert.match(structuredFormBlock, /window\.setTimeout\(\(\) => \{[\s\S]*scrollToElement\(formRef\.current\)[\s\S]*stepHeadingRef\.current\?\.focus\(\)/, 'step changes must scroll and focus the card heading');
assert.match(structuredFormBlock, /activeStepConfig\.nextLabel[\s\S]*type="button"[\s\S]*type="submit"/, 'final submit CTA must render only when there is no next step');
assert.match(structuredFormBlock, /onDraft:\s*\(value: CreateDraft\) => void/, 'wizard must keep using the existing CreateDraft model');
assert.equal(structuredFormBlock.includes('useState<CreateDraft>'), false, 'wizard must not duplicate CreateDraft in local state');
assert.match(client, /function FieldExample\(props: \{ children: ReactNode \}\)/, 'persistent field example helper missing');
assert.match(css, /\.fieldExample[\s\S]*font-size:\s*\.86rem/, 'field examples must stay visually secondary');
assert.match(css, /\.createGuidanceNote[\s\S]*border-left:\s*3px solid var\(--lime\)/, 'guidance note must be lightweight and coherent with the funnel');

const roleWizardPanel = structuredFormBlock.match(/activeStep === 'ROLE_RESULT'[\s\S]*?\{activeStep === 'PERSON_WORK'/)?.[0] ?? '';
assert.match(roleWizardPanel, /create-role/, 'step 1 must contain role');
assert.match(roleWizardPanel, /create-company/, 'step 1 must contain company/context');
assert.match(roleWizardPanel, /create-result/, 'step 1 must contain primary result');
assert.equal(roleWizardPanel.includes('create-activities'), false, 'step 1 must not include work reality fields');
assert.match(roleWizardPanel, /id="create-role" required aria-required="true"[\s\S]*placeholder="Es\. Addetto customer care"/, 'role must be required and keep the requested placeholder example');
assert.match(roleWizardPanel, /placeholder="Quale risultato deve riuscire a produrre o garantire questa persona\?"/, 'primary result question placeholder missing');
assert.match(roleWizardPanel, /Esempio: Gestire le richieste clienti entro 24 ore mantenendo aggiornato il CRM\./, 'primary result persistent example missing');

const personWizardPanel = structuredFormBlock.match(/activeStep === 'PERSON_WORK'[\s\S]*?\{activeStep === 'CONDITIONS_APPLICATION'/)?.[0] ?? '';
for (const field of ['create-activities', 'create-context', 'create-autonomy', 'create-incidents', 'create-required', 'create-preferred', 'create-trainable', 'create-disqualifying']) {
  assert.match(personWizardPanel, new RegExp(escapeRegExp(field)), `step 2 field missing: ${field}`);
}
assert.equal(personWizardPanel.includes('create-application'), false, 'step 2 must not include application CTA field');
assert.match(personWizardPanel, /id="create-activities" required aria-required="true"/, 'activities must remain required');
assert.match(personWizardPanel, /Esempio: Rispondere ai ticket, aggiornare il CRM e richiamare i clienti con richieste aperte\./, 'activities example missing');
assert.match(personWizardPanel, /id="create-required" required aria-required="true"/, 'required requirements must remain required');
assert.match(personWizardPanel, /Esempio: Uso CRM, italiano scritto chiaro e gestione di richieste clienti\./, 'required requirements example missing');
assert.equal(/id="create-preferred"[\s\S]{0,120}required/.test(personWizardPanel), false, 'preferred requirements must not become required');
assert.equal(/id="create-trainable"[\s\S]{0,120}required/.test(personWizardPanel), false, 'trainable requirements must not become required');

const conditionsWizardPanel = structuredFormBlock.match(/activeStep === 'CONDITIONS_APPLICATION'[\s\S]*?<div className=\{styles\.actions\}>/)?.[0] ?? '';
for (const field of ['create-benefits', 'create-growth', 'create-location', 'create-workmode', 'create-contract', 'create-schedule', 'create-shifts', 'create-availability', 'create-compensation', 'create-channel', 'create-application']) {
  assert.match(conditionsWizardPanel, new RegExp(escapeRegExp(field)), `step 3 field missing: ${field}`);
}
assert.match(conditionsWizardPanel, /placeholder="Es\. RAL 24-28k"/, 'compensation example missing');
assert.match(conditionsWizardPanel, /id="create-application" required aria-required="true"/, 'application must remain required');
assert.match(conditionsWizardPanel, /Esempio: Invia CV a recruiting@azienda\.it indicando “Addetto customer care” nell’oggetto\./, 'application example missing');
assert.equal(/id="create-compensation"[\s\S]{0,160}required/.test(conditionsWizardPanel), false, 'compensation must not become required');
assert.equal(/id="create-channel"[\s\S]{0,160}FieldExample/.test(conditionsWizardPanel), false, 'channel select must not add unnecessary example microcopy');
assert.match(client, /function inferCreateWizardStep[\s\S]*currentStep === 'SUMMARY' \|\| state\.currentStep === 'COMMERCIAL'[\s\S]*completedSteps/, 'resume must infer a sensible create wizard step');
assert.match(client, /function firstInvalidCreateWizardField[\s\S]*for \(const step of createWizardSteps\)/, 'final validation must cover all wizard steps');
assert.match(client, /function focusCreateField[\s\S]*control\?\.focus\(\)[\s\S]*control\?\.reportValidity\?\.\(\)/, 'wizard validation must focus and report the first invalid field');
assert.match(css, /\.createStepIndicator[\s\S]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/, 'desktop wizard step indicator must use three readable columns');
assert.match(css, /\.createStepIndicator li\[data-state="active"\][\s\S]*background:\s*var\(--lime\)/, 'active wizard step must use Horyzon lime');
assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.createStepIndicator[\s\S]*grid-template-columns:\s*1fr/, 'mobile wizard step indicator must stack without horizontal overflow');

assert.match(createFlow, /checkoutEnabled:\s*boolean/, 'PublicCreateState checkoutEnabled must be boolean');
assert.match(createFlow, /pricingStatus:\s*'FIXED'/, 'PublicCreateState pricingStatus must be FIXED');
assert.match(createFlow, /entitlementSummary:\s*\{[\s\S]*guide:\s*boolean[\s\S]*rewriteCredits:\s*number[\s\S]*createCredits:\s*number[\s\S]*agentRecruiterAccess:\s*boolean[\s\S]*source:\s*string/s, 'PublicCreateState V3 entitlement summary missing');
assert.match(createFlow, /const identityVerified = Boolean\(lead\?\.emailVerifiedAt\)/, 'identityVerified must be server-derived from lead');
assert.match(createFlow, /const checkoutEnabled = isAnnunci10xCheckoutEnabled\(\)/, 'checkoutEnabled must be server-derived from env helper');
assert.match(createFlow, /identityVerified,\s*\n\s*entitlementProvider:\s*createPersistenceAnnunci10xCommerceEntitlementProvider/s, 'commercial resolver must receive identityVerified and session entitlement provider independently from checkout');

assert.match(commercial, /ANNUNCI10X_AGENT_RECRUITER_ENABLED/, 'Agent Recruiter visibility flag missing');
assert.match(commercial, /isAnnunci10xAgentRecruiterEnabled/, 'Agent Recruiter env helper missing');
assert.match(commercial, /\.filter\(\(item\) => item\.offerCode !== 'AGENT_RECRUITER' \|\| Boolean\(input\.agentRecruiterEnabled\)\)/, 'Agent Recruiter must be hidden by default');

for (const fakeProof of ['STERIMED', 'Ahumados', 'De Ridder', '181%', 'testimonial']) {
  assert.equal(`${page}\n${client}`.includes(fakeProof), false, `fake proof/testimonial marker found: ${fakeProof}`);
}

// Radar-style FAQ: five questions, answers in native <details>. The other V3 answers moved into sections:
// what the Score measures -> "Il risultato", guarantee -> price. The standalone Frank section is intentionally absent from this landing.
const faqBlock = page.match(/const faqs = \[[\s\S]*?\n\] as const;/)?.[0] ?? '';
assert.equal(count(faqBlock, "\n  ['"), 6, 'FAQ must contain exactly 6 questions');
for (const question of [
  'Devo sostituire una persona: da dove parto?',
  'Quanto costa?',
  'Perché mi chiedete l’email?',
  'Mi garantite più candidature?',
  'Usate l’intelligenza artificiale?',
  'Funziona anche per ruoli operativi?',
]) {
  assert.equal(faqBlock.includes(question), true, `FAQ question missing: ${question}`);
}
assert.equal(/privacy/i.test(faqBlock), false, 'FAQ must not invent a privacy answer');
assert.match(page, /<details key=\{question\}><summary>/, 'FAQ must use native details like /radar');

const finalBlock = page.match(/<section id="ax-final"[\s\S]*?<\/section>/)?.[0] ?? '';
assert.match(finalBlock, /Prima di ripubblicare lo stesso annuncio, <em>scopri che cosa non si capisce\.<\/em>/, 'final headline missing');
assert.equal(count(finalBlock, '<Cta '), 1, 'final section must contain exactly one primary CTA');

assert.match(contract, /Commercial contract V3/, 'commercial contract V3 doc missing');
assert.match(contract, /Public products: Annuncio 10x; Guida Annunci 10x/, 'public products contract missing');
assert.match(contract, /Guida Annunci 10x is a separate public informational product/, 'guide public product contract missing');
assert.match(contract, /Price: 7 EUR/, 'V3 price contract missing');
assert.match(contract, /Price: 49 EUR/, 'guide price contract missing');
assert.match(contract, /annunci-10x-anteprima\.pdf/, 'guide preview asset contract missing');
assert.match(contract, /1 job ad, 1 version, 1 publication channel/, 'V3 unit contract missing');
assert.match(contract, /legal review of the guarantee wording/, 'legal go-live blocker missing');
assert.equal(contract.includes('BRAND_ASSET_PENDING'), false, 'resolved brand asset must not remain pending');
assert.match(contract, /horyzon-consulting-recruiting-white\.png/, 'canonical transparent Recruiting logo path missing from commercial contract');

console.log('Annunci 10x funnel v2 verifier passed');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
