import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

async function text(path) {
  return readFile(path, 'utf8');
}

function count(source, needle) {
  return source.split(needle).length - 1;
}

const page = await text('src/app/annunci-10x/page.tsx');
const client = await text('src/components/annunci-10x/annunci-10x-client.tsx');
const flow = await text('src/components/annunci-10x/annunci-10x-analyze-flow.tsx');
const commerceClient = await text('src/components/annunci-10x/annunci-10x-commerce-client.ts');
const createFlow = await text('src/lib/annunci-10x/create-flow.ts');
const identityGate = await text('src/components/annunci-10x/annunci-10x-identity-gate.tsx');
const css = await text('src/components/annunci-10x/annunci-10x.module.css');
const commercial = await text('src/lib/annunci-10x/commercial.ts');
const sitemap = await text('src/app/sitemap.ts');
const shell = await text('src/components/site-shell.tsx');
const home = await text('src/components/experience.tsx');
const contract = await text('docs/annunci-10x/commercial-contract-v3.md');
const heroBuffer = await readFile('public/annunci-10x/hero.jpeg');
const heroStat = await stat('public/annunci-10x/hero.jpeg');
const brandPath = 'public/annunci-10x/horyzon-consulting-recruiting-white.png';
const oldBrandPath = '/annunci-10x/horyzon-consulting-recruiting.png';
const brandPublicPath = '/annunci-10x/horyzon-consulting-recruiting-white.png';
const brandBuffer = await readFile(brandPath);
const brandStat = await stat(brandPath);

const publicSource = `${page}\n${client}\n${flow}\n${identityGate}`;
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

const headerBlock = client.match(/function FunnelHeader[\s\S]*?\n}/)?.[0] ?? '';
assert.equal(headerBlock.includes('Metodo'), false, 'funnel header must not link Metodo');
assert.equal(headerBlock.includes('Prodotti'), false, 'funnel header must not link Prodotti');
assert.equal(headerBlock.includes('FAQ'), false, 'funnel header must not link FAQ');
assert.equal(headerBlock.includes('Valuta gratis'), true, 'funnel header must keep the single CTA');
assert.match(headerBlock, /\/annunci-10x\/horyzon-consulting-recruiting-white\.png/, 'canonical transparent Recruiting logo asset must be used in the header');
assert.equal(headerBlock.includes(oldBrandPath), false, 'old Recruiting logo asset must not be used in the header');
assert.equal(headerBlock.includes(brandPublicPath), true, 'new Recruiting logo public path missing from header');
assert.match(headerBlock, /unoptimized/, 'header logo must bypass image optimization to preserve the approved PNG asset');
assert.match(headerBlock, /width=\{2048\}\s+height=\{768\}/, 'header logo must use the attached 8:3 PNG dimensions');
assert.match(css, /\.brand[\s\S]*width:\s*clamp\(220px,\s*18vw,\s*240px\)[\s\S]*overflow:\s*visible/, 'header brand must use responsive desktop width without clipping');
assert.match(css, /\.brandLogo[\s\S]*height:\s*auto\s*!important[\s\S]*object-fit:\s*contain/, 'header logo must preserve ratio without cropping');
assert.equal(css.includes('border-radius: 18px'), false, 'old white-panel logo border radius must be removed');
assert.match(headerBlock, /aria-label="Horyzon Consulting Recruiting"/, 'header logo link must keep an accessible brand label');
assert.equal(headerBlock.includes('<span>Horyzon Consulting</span>'), false, 'typographic brand fallback must be removed');
assert.equal(headerBlock.includes('Horyzon Consulting</span>'), false, 'header must not include a textual brand fallback');

assert.match(client, /Il tuo annuncio fa capire il lavoro alle persone giuste\?/, 'V3 hero headline missing');
assert.match(client, /Incolla il link o il testo dell’annuncio\. Ricevi uno Score di chiarezza su 100 e i punti da migliorare dopo la verifica dell’email\./, 'V3 hero subtitle missing');
assert.match(client, /Valuta gratis il mio annuncio/, 'primary CTA missing');
assert.match(client, /Non ho ancora un annuncio: crealo a 7 €/, 'secondary CTA missing');
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
assert.equal(flow.includes('resultRef.current.scrollIntoView'), false, 'post-analysis result must not force page scroll or stretch the hero');
assert.match(css, /\.createShell\[data-flow="analyze"\]\[data-has-workspace="true"\][\s\S]*min-height:\s*clamp\(430px,\s*68svh,\s*760px\)/, 'desktop analyze workspace must reserve bounded height');
assert.match(css, /\.analysisWorkspace[\s\S]*position:\s*absolute[\s\S]*max-height:\s*min\(74svh,\s*760px\)[\s\S]*overflow-y:\s*auto/, 'post-analysis workspace must float and scroll internally on desktop');
assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.analysisWorkspace[\s\S]*position:\s*static[\s\S]*max-height:\s*72svh/, 'mobile analyze workspace must become a controlled block');

assert.equal(count(client, '<Annunci10xAnalyzeFlow'), 1, 'Annunci10xAnalyzeFlow must render exactly once');
assert.equal(client.includes('/annunci-10x/hero.jpeg'), true, 'hero image must remain wired');
assert.equal(heroStat.size, 221692, 'hero.jpeg size changed');
assert.equal(createHash('sha256').update(heroBuffer).digest('hex'), '8cadafee04583b2e0905c08ae779f2d2f56ff9a599cc3b2468605a8882f326dc', 'hero.jpeg hash changed');
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
assert.equal(publicSource.includes('49 €'), false, '49 EUR package must be hidden from the public funnel');
assert.equal(publicSource.includes('49,00'), false, '49 EUR package must be hidden from the public funnel');
assert.equal(publicSource.includes('9 €'), false, 'old 9 EUR CREATE price must not remain');
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
  assert.equal(client.includes(role), true, `updated role example missing: ${role}`);
}
assert.equal(client.includes("const roles = ['Magazziniere'"), false, 'old flat role list must not remain');
assert.equal(client.includes('Automation Engineer'), false, 'old role list item must not remain');

assert.match(client, /ANNUNCIO VAGO/, 'vague ad funnel visual missing');
assert.match(client, /ANNUNCIO CHIARO/, 'clear ad funnel visual missing');
assert.equal(client.includes('Tanti visualizzano'), false, 'old funnel visual copy must not remain');
assert.equal(client.includes('prime correzioni pratiche'), false, 'landing must not promise specific practical corrections');
assert.match(client, /Le indicazioni operative arrivano nel report via email/, 'product explainer must defer operational advice to email report');
assert.match(client, /Anteprima del report/, 'report preview heading missing');
assert.equal(client.includes('Caso reale in preparazione'), false, 'case-real-in-preparation block must be replaced');
assert.equal(/[0-9]{1,3}\s*(?:→|->)\s*[0-9]{1,3}/.test(client), false, 'before/after must not invent numeric score improvement');

assert.match(client, /7 €/, 'V3 price missing');
assert.match(client, /1 annuncio/, 'single-ad unit missing');
assert.match(client, /1 versione/, 'single-version unit missing');
assert.match(client, /1 canale/, 'single-channel unit missing');
assert.equal(commerceClient.includes('Disponibile a breve'), true, 'checkout-disabled customer-safe CTA missing');
assert.match(client, /href="\/contatti"/, 'consulting CTA must link to /contatti');
const productChoiceBlock = client.match(/function ProductChoiceSection[\s\S]*?\nfunction GuaranteeSection/)?.[0] ?? '';
assert.match(productChoiceBlock, /La valutazione dell’annuncio resta gratuita nel percorso sopra/, 'product section must separate free evaluation from paid create path');
assert.equal(productChoiceBlock.includes('onAnalyze'), false, 'product section must not include the free evaluation CTA');
assert.equal(productChoiceBlock.includes('Valuta gratis il mio annuncio'), false, 'product card must not make the free evaluation look paid');
assert.match(productChoiceBlock, /CREA DA ZERO[\s\S]*Annuncio 10x da brief guidato[\s\S]*<strong>7 €<\/strong>[\s\S]*Non ho ancora un annuncio: creo a 7 €/, 'create-from-zero product card must be explicit and priced at 7 EUR');
assert.match(productChoiceBlock, /Acquista la guida per creare annunci perfetti illimitati/, 'guide CTA missing from product section');
assert.match(productChoiceBlock, /aria-expanded=\{guideOpen\} aria-controls="annunci10x-guide-panel"/, 'guide CTA must open a dedicated surface');
const guidePanelBlock = productChoiceBlock.match(/id="annunci10x-guide-panel"[\s\S]*?<\/article>/)?.[0] ?? '';
assert.match(guidePanelBlock, /Guida Annunci 10x[\s\S]*Nessuna tariffa mostrata/, 'guide panel must be separate and avoid invented pricing');
assert.equal(/Guida[\s\S]{0,220}<strong>/.test(productChoiceBlock), false, 'guide card must not show a price');
assert.equal(/\d+\s*€/.test(guidePanelBlock), false, 'guide panel must not show a price');
assert.equal(/checkout/i.test(guidePanelBlock), false, 'guide panel must not mention checkout');

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
  assert.equal(client.includes(fakeProof), false, `fake proof/testimonial marker found: ${fakeProof}`);
}

const faqBlock = client.match(/const faqItems = \[[\s\S]*?\n\];/)?.[0] ?? '';
assert.equal(count(faqBlock, "\n  ['"), 13, 'FAQ must contain exactly 13 questions');
for (const question of [
  'Quanto costa?',
  'Cosa ricevo con lo Score gratuito?',
  'Che cosa misura lo Score?',
  'Perché mi chiedete l’email?',
  'Che differenza c’è tra i due percorsi?',
  'Che cosa include Annuncio 10x?',
  'Usate l’intelligenza artificiale?',
  'Funziona anche per ruoli operativi?',
  'Ho già un’agenzia o un consulente. Mi serve comunque?',
  'Mi garantite più candidature?',
  'Come funziona "soddisfatti o rimborsati"?',
  'Chi c’è dietro Annunci 10x?',
  'E se il problema non è l’annuncio?',
]) {
  assert.equal(faqBlock.includes(question), true, `FAQ question missing: ${question}`);
}
assert.equal(/privacy/i.test(faqBlock), false, 'FAQ must not invent a privacy answer');

const finalCtaBlock = client.match(/function FinalCta[\s\S]*?\n}/)?.[0] ?? '';
assert.match(finalCtaBlock, /Valuta gratis il mio annuncio/, 'final CTA must use V3 primary label');
assert.equal(finalCtaBlock.includes('Il prossimo annuncio che pubblichi sceglierà i tuoi candidati.'), false, 'old final CTA headline must not remain');
assert.equal(count(finalCtaBlock, '<button'), 1, 'final CTA must contain exactly one primary CTA');

assert.match(contract, /Commercial contract V3/, 'commercial contract V3 doc missing');
assert.match(contract, /Annuncio 10x is the only public paid product/, 'single public product contract missing');
assert.match(contract, /Price: 7 EUR/, 'V3 price contract missing');
assert.match(contract, /1 job ad, 1 version, 1 publication channel/, 'V3 unit contract missing');
assert.match(contract, /legal review of the guarantee wording/, 'legal go-live blocker missing');
assert.equal(contract.includes('BRAND_ASSET_PENDING'), false, 'resolved brand asset must not remain pending');
assert.match(contract, /horyzon-consulting-recruiting-white\.png/, 'canonical transparent Recruiting logo path missing from commercial contract');

console.log('Annunci 10x funnel v2 verifier passed');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
