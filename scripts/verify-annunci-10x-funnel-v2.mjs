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

assert.match(client, /Il tuo annuncio sceglie i candidati prima di te\./, 'new hero headline missing');
assert.equal(client.includes('Le persone giuste esistono. Il tuo annuncio riesce ad attirarle?'), false, 'old hero headline must not remain');
assert.equal(client.includes('Workspace'), false, 'legacy workspace label must not remain visible');
assert.equal(flow.includes('Analizza gratis il tuo annuncio'), true, 'source form title missing');
assert.equal(flow.includes('Analizza il mio annuncio — gratis'), true, 'source CTA missing');
assert.equal(flow.includes('Incolla qui il testo del tuo annuncio'), true, 'pasted-text placeholder missing');
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

assert.equal(flow.includes('Copertura'), false, 'free result must not expose Copertura as a visible KPI label');
assert.equal(client.includes('Copertura'), false, 'funnel must not expose Copertura as a visible KPI label');
assert.equal(client.includes('/checkout'), false, 'funnel must not wire checkout route');
assert.equal(client.toLowerCase().includes('stripe'), false, 'funnel must not wire Stripe');
assert.equal(client.includes('/api/annunci-10x/commercial/purchase'), false, 'funnel must not add paid purchase API calls');
assert.equal(client.includes('/api/annunci-10x/commercial/offers'), false, 'funnel must not fetch commercial offers on page load');
assert.equal(client.includes('/api/annunci-10x/premium/output'), false, 'funnel must not fetch premium output on page load');

for (const fakeProof of ['STERIMED', 'Ahumados', 'De Ridder', '181%', 'testimonial']) {
  assert.equal(client.includes(fakeProof), false, `fake proof/testimonial marker found: ${fakeProof}`);
}

assert.equal(/[0-9]{1,3}\s*(?:→|->)\s*[0-9]{1,3}/.test(client), false, 'before/after must not invent numeric score improvement');
const faqBlock = client.match(/const faqItems = \[[\s\S]*?\n\];/)?.[0] ?? '';
assert.equal(/privacy/i.test(faqBlock), false, 'FAQ must not invent a privacy answer');

console.log('Annunci 10x funnel v2 verifier passed');
