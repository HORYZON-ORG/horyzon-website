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
const sitemap = await text('src/app/sitemap.ts');
const shell = await text('src/components/site-shell.tsx');
const home = await text('src/components/experience.tsx');
const heroBuffer = await readFile('public/annunci-10x/hero.jpeg');
const heroStat = await stat('public/annunci-10x/hero.jpeg');

assert.equal(page.includes('SiteHeader'), false, 'Annunci 10x route must not use global SiteHeader');
assert.equal(page.includes('SiteFooter'), false, 'Annunci 10x route must not use global SiteFooter');
assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false,\s*nocache:\s*true\s*\}/s, 'route must stay noindex,nofollow,nocache');
assert.match(page, /Il tuo annuncio attira i candidati giusti\? Scoprilo gratis/, 'metadata title must be updated');
assert.match(page, /Incolla il tuo annuncio di lavoro e scopri in 2 minuti/, 'metadata description must be updated');

assert.equal(sitemap.includes('annunci-10x'), false, 'Annunci 10x must stay out of sitemap source');
assert.equal(shell.includes('annunci-10x'), false, 'Annunci 10x must stay out of global header/footer shell');
assert.equal(home.includes('annunci-10x'), false, 'Annunci 10x must stay out of home experience');

const headerBlock = client.match(/function FunnelHeader[\s\S]*?\n}/)?.[0] ?? '';
assert.equal(headerBlock.includes('Metodo'), false, 'funnel header must not link Metodo');
assert.equal(headerBlock.includes('Prodotti'), false, 'funnel header must not link Prodotti');
assert.equal(headerBlock.includes('FAQ'), false, 'funnel header must not link FAQ');
assert.equal(headerBlock.includes('Analizza gratis'), true, 'funnel header must keep the single CTA');

assert.match(client, /Il tuo annuncio sceglie i candidati prima di te\./, 'new hero headline missing');
assert.equal(client.includes('Le persone giuste esistono. Il tuo annuncio riesce ad attirarle?'), false, 'old hero headline must not remain');
assert.equal(client.includes('Workspace'), false, 'legacy workspace label must not remain visible');
assert.equal(client.includes('Devi ancora scriverlo? Crea l&apos;annuncio da zero — 9 €'), false, 'hero secondary create action must not show 9 euro');
assert.match(client, /Devi ancora scriverlo\? Crea l&apos;annuncio da zero/, 'hero secondary create action missing');

assert.equal(flow.includes('Analizza gratis il tuo annuncio'), true, 'source form title missing');
assert.equal(flow.includes('Analizza il mio annuncio — gratis'), true, 'source CTA missing');
assert.equal(flow.includes('Incolla qui il testo del tuo annuncio'), true, 'pasted-text placeholder missing');
assert.equal(flow.includes('Incolla il testo o il link pubblico. Ti mostriamo lo Score'), false, 'redundant source subtitle must be removed');
assert.match(flow, /rows=\{text\.trim\(\) \? 10 : 3\}/, 'textarea must use compact empty rows and expanded filled rows');
assert.match(flow, /className=\{styles\.sourceTextarea\}/, 'source textarea class missing');
assert.match(css, /\.sourceTextarea\[data-empty="true"\][\s\S]*min-height:\s*84px/, 'empty source textarea compact min-height missing');
assert.match(css, /\.sourceTextarea[\s\S]*min-height:\s*220px/, 'filled source textarea min-height missing');
assert.equal(flow.includes("Incolla il link pubblico dell'annuncio"), true, 'public URL placeholder missing');
assert.equal(flow.includes('Ti mandiamo un codice di 6 cifre'), true, 'OTP copy missing');
assert.equal(flow.includes('Stiamo applicando i 20 controlli'), true, 'progress copy missing');

assert.equal(count(client, '<Annunci10xAnalyzeFlow'), 1, 'Annunci10xAnalyzeFlow must render exactly once');
assert.equal(client.includes('/annunci-10x/hero.jpeg'), true, 'hero image must remain wired');
assert.equal(heroStat.size, 221692, 'hero.jpeg size changed');
assert.equal(createHash('sha256').update(heroBuffer).digest('hex'), '8cadafee04583b2e0905c08ae779f2d2f56ff9a599cc3b2468605a8882f326dc', 'hero.jpeg hash changed');

for (const price of ['7 €', '9 €', '49 €']) {
  assert.equal(client.includes(price), true, `missing public price ${price}`);
}

assert.match(client, /<strong>37<small>\/100<\/small><\/strong>/, 'demo score must be 37/100');
assert.match(client, /Esempio di Score · Commerciale B2B/, 'demo must be explicitly labelled as example');
assert.match(client, /<em>Critico<\/em>/, 'demo band must be Critico');
assert.equal(client.includes('non attirerà mai'), false, 'demo copy must not use absolute non attirerà mai claim');
assert.match(client, /rischia di non attirare le persone giuste/, 'demo risk copy missing');

for (const label of ['Critico', 'Debole', 'Buona base', 'Forte', 'Eccellente']) {
  assert.equal(client.includes(label), true, `client score band label missing: ${label}`);
  assert.equal(flow.includes(label), true, `flow score band label missing: ${label}`);
}
assert.equal(client.includes("'Base'"), false, 'old client score label Base must not remain');
assert.equal(client.includes("'Buono'"), false, 'old client score label Buono must not remain');
assert.equal(flow.includes("'Base'"), false, 'old flow score label Base must not remain');
assert.equal(flow.includes("'Buono'"), false, 'old flow score label Buono must not remain');
assert.match(css, /\.scoreBandBar[\s\S]*grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/, 'score band must visually render five segments');
assert.equal(css.includes('.scoreDemo div'), false, 'score demo must not use generic div selector');
assert.equal(css.includes('.scoreDemoTop'), true, 'score demo top specific class missing');

assert.equal(client.includes('const controls = ['), false, '20 controls item list must be removed from UI source');
assert.equal(client.includes('controls.map'), false, '20 controls chips must not render');
for (const role of ['Operaio di produzione', 'Saldatore', 'Manutentore meccanico', 'Elettricista', 'Tecnico installatore', 'Magazziniere carrellista', 'Autista patente C', 'Commerciale B2B', 'Impiegato amministrativo', 'Addetto alla contabilità', 'Cuoco', 'Cameriere di sala']) {
  assert.equal(client.includes(role), true, `updated role example missing: ${role}`);
}
assert.equal(client.includes("const roles = ['Magazziniere'"), false, 'old flat role list must not remain');
assert.equal(client.includes('Automation Engineer'), false, 'old role list item must not remain');

assert.match(client, /ANNUNCIO VAGO/, 'vague ad funnel visual missing');
assert.match(client, /ANNUNCIO CHIARO/, 'clear ad funnel visual missing');
assert.equal(client.includes('Tanti visualizzano'), false, 'old funnel visual copy must not remain');
assert.match(client, /Tempo sui CV/, 'cost row Tempo sui CV missing');
assert.match(client, /Colloqui inutili/, 'cost row Colloqui inutili missing');
assert.match(client, /Rischio di assumere persona sbagliata/, 'cost row hiring risk missing');
assert.equal(client.includes('prime correzioni pratiche'), false, 'landing must not promise specific practical corrections');
assert.match(client, /Le indicazioni operative arrivano nel report via email/, 'product explainer must defer operational advice to email report');
assert.match(client, /Stesso lavoro\. Due annunci\./, 'before/after heading missing');
assert.match(client, /Caso reale in preparazione/, 'case-real-in-preparation block missing');
assert.equal(/[0-9]{1,3}\s*(?:→|->)\s*[0-9]{1,3}/.test(client), false, 'before/after must not invent numeric score improvement');

assert.match(client, /Riscrittura: 7 € per versione e canale/, 'rewrite price/copy missing');
assert.match(client, /Agent Recruiter/, 'Agent Recruiter guide copy missing');
assert.equal(client.includes('In preparazione</button>'), false, 'Agent Recruiter card must not show In preparazione');
assert.match(client, /Disponibile a breve/, 'checkout-disabled customer-safe CTA missing');
assert.match(client, /ChatGPT/, 'ChatGPT guide prompt copy missing');
assert.match(client, /Claude/, 'Claude guide prompt copy missing');
assert.match(client, /Soddisfatti o rimborsati/, 'guarantee title missing');
assert.equal(client.includes('lo rivediamo con te'), false, 'old guarantee copy must not remain');
assert.match(client, /href="\/contatti"/, 'consulting CTA must link to /contatti');

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
assert.match(commerceClient, /type Annunci10xOfferCode = 'ANNUNCI10X_REWRITE' \| 'ANNUNCI10X_CREATE' \| 'AGENT_RECRUITER'/, 'V2 offer code union missing');
assert.match(commerceClient, /fetch\('\/api\/annunci-10x\/commercial\/offers'/, 'commercial offers fetch helper missing');
assert.match(commerceClient, /fetch\('\/api\/annunci-10x\/commercial\/checkout'/, 'checkout helper missing');
assert.match(commerceClient, /JSON\.stringify\(\{\s*offerCode\s*\}\)/s, 'checkout helper must post offerCode only');
const checkoutBody = commerceClient.match(/body:\s*JSON\.stringify\(([\s\S]*?)\),/)?.[1] ?? '';
assert.equal(checkoutBody.trim(), '{ offerCode }', 'checkout POST body must contain offerCode only');
for (const forbidden of ['amountCents', 'stripePriceId', 'successUrl', 'cancelUrl', 'customerEmail', 'entitlements', 'paid']) {
  assert.equal(checkoutBody.includes(forbidden), false, `checkout helper must not send ${forbidden}`);
}
assert.match(flow, /Vuoi correggerlo\?/, 'free result correction section missing');
assert.match(flow, /ANNUNCI10X_REWRITE/, 'analyze rewrite offer must be wired');
assert.match(flow, /AGENT_RECRUITER/, 'analyze Agent Recruiter offer must be wired');
assert.match(client, /ANNUNCI10X_CREATE/, 'create offer must be wired');
assert.match(client, /Dove ti mandiamo il tuo annuncio\?/, 'CREATE identity gate title missing');
assert.match(identityGate, /analysisRunId \? \{ code: otpCode, analysisRunId: props\.analysisRunId \} : \{ code: otpCode \}/, 'CREATE OTP verify must omit analysisRunId');
assert.match(client, /Pagamento ricevuto\./, 'checkout success banner missing');
assert.match(client, /Pagamento annullato\./, 'checkout cancel banner missing');
assert.match(client, /delays = \[0, 1500, 3000, 5000\]/, 'success refresh must be bounded to four attempts');
assert.match(createFlow, /checkoutEnabled:\s*boolean/, 'PublicCreateState checkoutEnabled must be boolean');
assert.match(createFlow, /pricingStatus:\s*'FIXED'/, 'PublicCreateState pricingStatus must be FIXED');
assert.match(createFlow, /entitlementSummary:\s*\{[\s\S]*guide:\s*boolean[\s\S]*rewriteCredits:\s*number[\s\S]*createCredits:\s*number[\s\S]*agentRecruiterAccess:\s*boolean[\s\S]*source:\s*string/s, 'PublicCreateState V2 entitlement summary missing');
const createCommercialInterface = createFlow.match(/commercial:\s*\{[\s\S]*?\n  \};/)?.[0] ?? '';
for (const staleField of ["price: 'OPEN_DECISION'", "discountValue: 'OPEN_DECISION'", "entitlements: 'SERVER_VERIFIED_OPEN_DECISION'"]) {
  assert.equal(createCommercialInterface.includes(staleField), false, `PublicCreateState commercial must not expose stale field ${staleField}`);
}
const clientCreateCommercialInterface = client.match(/commercial:\s*\{[\s\S]*?\n  \};/)?.[0] ?? '';
for (const staleField of ['price?: string', 'discountValue?: string', 'entitlements: string', 'adGenerationCredits']) {
  assert.equal(clientCreateCommercialInterface.includes(staleField), false, `client CreateState commercial must not expose stale field ${staleField}`);
}
assert.match(createFlow, /const identityVerified = Boolean\(lead\?\.emailVerifiedAt\)/, 'identityVerified must be server-derived from lead');
assert.match(createFlow, /const checkoutEnabled = isAnnunci10xCheckoutEnabled\(\)/, 'checkoutEnabled must be server-derived from env helper');
assert.match(createFlow, /identityVerified,\s*\n\s*entitlementProvider:\s*createPersistenceAnnunci10xCommerceEntitlementProvider/s, 'commercial resolver must receive identityVerified and session entitlement provider independently from checkout');
assert.match(createFlow, /createPersistenceAnnunci10xCommerceEntitlementProvider\(\{[\s\S]*persistence: input\.context\.persistence[\s\S]*sessionId: input\.sessionId[\s\S]*sessionSecret: input\.sessionSecret/s, 'persistence entitlement provider must be wired for CREATE state');
assert.match(client, /function commerceStateFingerprint\(commercial: Annunci10xCommercialState\): string/, 'commercial fingerprint helper missing');
assert.match(client, /baselineFingerprint === null[\s\S]*baselineFingerprint = fingerprint[\s\S]*fingerprint !== baselineFingerprint[\s\S]*setCommerceRefreshToken[\s\S]*stopPolling\(\)/s, 'success polling must stop after fingerprint change');
assert.match(client, /if \(checkoutNotice !== 'success'\) return;/, 'cancelled checkout must not start polling');
const checkoutSuccessEffectStart = client.indexOf("if (checkoutNotice !== 'success') return;");
const checkoutSuccessEffectEnd = client.indexOf('}, [checkoutNotice]);', checkoutSuccessEffectStart);
const checkoutSuccessEffect = checkoutSuccessEffectStart >= 0 && checkoutSuccessEffectEnd > checkoutSuccessEffectStart
  ? client.slice(checkoutSuccessEffectStart, checkoutSuccessEffectEnd)
  : '';
assert.equal(checkoutSuccessEffect.includes('setCreateState'), false, 'checkout=success must not authoritatively mutate create state');
assert.equal(checkoutSuccessEffect.includes('setCommercial('), false, 'checkout=success must not authoritatively mutate commercial state');

for (const fakeProof of ['STERIMED', 'Ahumados', 'De Ridder', '181%', 'testimonial']) {
  assert.equal(client.includes(fakeProof), false, `fake proof/testimonial marker found: ${fakeProof}`);
}

const faqBlock = client.match(/const faqItems = \[[\s\S]*?\n\];/)?.[0] ?? '';
assert.equal(count(faqBlock, "\n  ['"), 12, 'FAQ must contain exactly 12 questions');
for (const question of [
  'Quanto costa?',
  'Cosa ricevo con lo Score gratuito?',
  'Perché mi chiedete l’email?',
  'Che differenza c’è tra riscrittura e creazione da zero?',
  'Perché comprare la Guida se la riscrittura costa 7 €?',
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
assert.match(finalCtaBlock, /Il prossimo annuncio che pubblichi sceglierà i tuoi candidati\./, 'final CTA headline missing');
assert.match(finalCtaBlock, /Fai in modo che scelga quelli giusti\./, 'final CTA subhead missing');
assert.equal(count(finalCtaBlock, '<button'), 1, 'final CTA must contain exactly one primary CTA');
assert.equal(finalCtaBlock.includes('Crea l&apos;annuncio da zero'), false, 'final CTA must not include create action');

console.log('Annunci 10x funnel v2 verifier passed');
