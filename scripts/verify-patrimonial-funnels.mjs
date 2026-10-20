import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { handlePublicLead } from '../src/lib/public-leads/handler.ts';
import { pilotCrmDetails, validatePilotLead } from '../src/lib/public-leads/patrimonial-funnels.ts';
import { architectPath, patrimonialEvent, pilotForms, PATRIMONIAL_PILOT_PRIVACY_VERSION } from '../src/content/patrimonial-funnels.ts';

// Every provider call is intercepted. Running this verifier cannot create CRM contacts.
const localFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('External fetch forbidden in pilot verifier'); };
const env = { NODE_ENV: 'test', HIGHLEVEL_PRIVATE_TOKEN: 'test-token', HIGHLEVEL_LOCATION_ID: 'test-location' };
const now = () => new Date('2026-10-14T10:00:00Z');
let calls = [];
// CV della candidatura Architetto: storage finto che conferma il collegamento del PDF (vedi verify-architect-cv.mjs).
const cvStorage = { url: 'https://cv.test', key: 'test', fetchImpl: async () => new Response('{}', { status: 200 }) };
const CV_ID = '11111111-1111-4111-8111-111111111111';
const provider = async (url, init) => {
  calls.push({ url, body: JSON.parse(init.body) });
  return new Response(JSON.stringify(url.endsWith('/upsert') ? { contact: { id: 'test-contact' } } : {}), { status: 200 });
};
const request = (body, extraHeaders = {}, origin = 'https://horyzon.it') => new Request('https://horyzon.it/api/public-leads', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...extraHeaders }, body: JSON.stringify(body) });
const payload = mode => ({
  mode, sourcePath: pilotForms[mode].path, firstName: 'Ada', lastName: 'Lovelace', email: 'ADA@example.com',
  phone: mode === 'architect-path' ? '333 123 4567' : '', province: 'Milano', profile: 'Imprenditore',
  message: 'Vorrei approfondire.', consent: true, marketingConsent: false, website: '',
  utm: { utm_source: 'invito', utm_medium: 'link', utm_campaign: 'pilot', utm_content: 'hero', utm_term: 'patrimonio' },
  ...(mode === 'architect-path' ? { experience: 'Sì', goal: 'Sto esplorando', availability: 'Da definire', cvId: CV_ID } : {}),
});
for (const mode of ['architect-path', 'patrimonial-event']) {
  calls = [];
  const input = payload(mode);
  const response = await handlePublicLead(request(input), { env, cvStorage, now, fetchImpl: provider });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, message: pilotForms[mode].success });
  assert.equal(calls.length, 3);
  assert.equal(calls[0].body.email, 'ada@example.com');
  assert.equal(calls[0].body.firstName, 'Ada');
  assert.equal(calls[0].body.lastName, 'Lovelace');
  assert.equal(calls[0].body.phone, mode === 'architect-path' ? '+393331234567' : undefined);
  assert(!Object.hasOwn(calls[0].body, 'tags'));
  assert.deepEqual(calls[1].body.tags, ['horyzon-patrimoniale', mode === 'architect-path' ? 'percorso-architetto-patrimoniale' : 'evento-patrimoniale', 'pilot']);
  for (const text of [mode, input.sourcePath, now().toISOString(), 'Milano', 'Consenso marketing: no', PATRIMONIAL_PILOT_PRIVACY_VERSION, ...Object.values(input.utm)]) assert(calls[2].body.body.includes(text));
  if (mode === 'architect-path') for (const text of ['Sì', 'Sto esplorando', 'Da definire']) assert(calls[2].body.body.includes(text));
  if (mode === 'architect-path') {
    const { cvId: _cv, ...withoutCv } = input;
    assert.equal((await handlePublicLead(request(withoutCv), { env, cvStorage, fetchImpl: provider })).status, 400, 'candidatura Architetto senza CV');
    assert(calls[2].body.body.includes(`rif. ${CV_ID}`));
  } else assert.equal((await handlePublicLead(request({ ...input, cvId: CV_ID }), { env, cvStorage, fetchImpl: provider })).status, 400, 'evento senza CV');
  const { cvId: _cvId, ...pilotFields } = input;
  const marketing = validatePilotLead({ ...pilotFields, marketingConsent: true });
  assert(marketing);
  assert(pilotCrmDetails(marketing, now()).note.includes('Consenso marketing: sì'));
  const invalid = [
    { firstName: '' }, { lastName: '' }, { firstName: 'Ada\nforged' }, { province: '' }, { province: 'x'.repeat(81) }, { email: 'bad' },
    { consent: false }, { consent: 'true' }, { marketingConsent: 'true' }, { message: 'x'.repeat(1501) },
    { phone: 'not-phone' }, { sourcePath: '/contatti' }, { website: 'bot' }, { profile: 'Inventato' },
    { name: 'legacy name', interest: 'evento-patrimoniale' }, { utm: [] }, { utm: { utm_source: 'x'.repeat(101) } },
    { utm: { unknown: 'x' } }, { utm: { utm_source: 'x\nforged' } },
    ...(mode === 'architect-path' ? [{ phone: '' }, { experience: 'forse' }, { goal: 'inventato' }, { availability: 'inventata' }] : [{ experience: 'Sì' }]),
  ];
  for (const change of invalid) {
    calls = [];
    assert.equal((await handlePublicLead(request({ ...input, ...change }), { env, cvStorage, fetchImpl: provider })).status, 400, JSON.stringify(change));
    assert.equal(calls.length, 0);
  }
  for (const missing of ['mode', 'firstName', 'lastName', 'email', 'province', 'consent', 'marketingConsent', 'sourcePath']) {
    const malformed = { ...input }; delete malformed[missing];
    assert.equal((await handlePublicLead(request(malformed), { env, cvStorage, fetchImpl: provider })).status, 400, `Missing ${missing}`);
  }
  assert.equal((await handlePublicLead(request(input, {}, 'https://evil.example'), { env, cvStorage, fetchImpl: provider })).status, 403);
  assert.equal((await handlePublicLead(request(input), { env: {}, cvStorage, fetchImpl: provider })).status, 503);
  for (const failedStep of [1, 2, 3]) {
    let step = 0;
    const response = await handlePublicLead(request(input), { env, cvStorage, fetchImpl: (...args) => ++step === failedStep ? Promise.resolve(new Response('private provider body', { status: 500 })) : provider(...args) });
    assert.equal(response.status, 502);
    assert(!JSON.stringify(await response.json()).includes('private provider body'));
  }
}
const legacy = { name: 'Ada Lovelace', email: 'ada@example.com', phone: '', message: '', consent: true, website: '', interest: 'evento-patrimoniale' };
for (const mode of [undefined, 'legacy/public']) {
  calls = [];
  assert.equal((await handlePublicLead(request({ ...legacy, ...(mode ? { mode } : {}) }), { env, cvStorage, now, fetchImpl: provider })).status, 200);
  assert.deepEqual(calls[1].body.tags, ['horyzon-benessere-patrimoniale', 'horyzon-evento-patrimoniale']);
  assert(calls[2].body.body.includes('Provenienza: horyzon.it/contatti'));
  assert(calls[2].body.body.includes('nessuna iscrizione a campagne marketing'));
}
for (const mix of [{ mode: 'invented' }, { mode: 'architect-path' }, { mode: 'patrimonial-event' }, { firstName: 'Ada' }, { marketingConsent: true }]) {
  calls = [];
  assert.equal((await handlePublicLead(request({ ...legacy, ...mix }), { env, cvStorage, fetchImpl: provider })).status, 400);
  assert.equal(calls.length, 0);
}
for (let i = 0; i < 6; i++) assert.equal((await handlePublicLead(request(payload('patrimonial-event'), { 'x-forwarded-for': '192.0.2.51' }), { env: { ...env, NODE_ENV: 'production' }, cvStorage, now, fetchImpl: provider })).status, i < 5 ? 200 : 429);
assert.equal((await handlePublicLead(new Request('https://horyzon.it/api/public-leads', { method: 'POST', headers: { Origin: 'https://horyzon.it', 'Content-Type': 'application/json' }, body: 'x'.repeat(12001) }), { env, cvStorage, fetchImpl: provider })).status, 413);

const protectedFiles = ['src/components/wellbeing-page.tsx', 'src/components/wellbeing-scene.tsx', 'src/components/wellbeing.module.css', 'src/app/[...slug]/page.tsx', 'src/app/contatti/page.tsx', 'src/content/patrimonial.ts', 'src/content/public-guide.ts', 'src/content/public-faq.ts', 'src/data/pages.ts', 'src/data/archive.json', 'src/components/site-shell.tsx', 'src/app/layout.tsx', 'src/app/robots.ts', 'src/app/llms.txt/route.ts', 'src/app/index.md/route.ts'];
execFileSync('git', ['diff', '--exit-code', 'b0b62e686bd120e2770e2408bc7a14fd59593e92', '--', ...protectedFiles], { stdio: 'pipe' });
const original = execFileSync('git', ['show', 'b0b62e6:src/components/patrimonial-lead-form.tsx'], { encoding: 'utf8' });
const current = (await readFile('src/components/patrimonial-lead-form.tsx', 'utf8')).replaceAll('\r\n', '\n');
const publicBody = source => source.slice(source.indexOf('  const params = useSearchParams();'), source.indexOf('\nfunction LeadForm'));
assert.equal(publicBody(current).split('\n// Same per-tab')[0].trim(), publicBody(original).trim(), 'legacy query handling must stay unchanged');
assert.equal(current.slice(current.indexOf('function LeadForm')), original.slice(original.indexOf('function LeadForm')), 'legacy form must stay unchanged');
assert(current.includes('router.push(`${form.path}/grazie`)'));
assert(current.includes('sessionStorage.setItem'));
assert(current.includes('defaultChecked={false}'));
for (const root of [architectPath.path, patrimonialEvent.path]) {
  const source = await readFile(`src/app/(patrimonial-pilot)${root}/grazie/page.tsx`, 'utf8');
  assert(!/use client|fetch\(|useEffect|dispatchEvent|data-analytics-event/.test(source));
}
const eventPage = await readFile('src/app/(patrimonial-pilot)/benessere-patrimoniale/evento/page.tsx', 'utf8');
assert(eventPage.includes('patrimonialEvent.title'));
assert(!eventPage.includes('Quello che le banche non dicono'));
const pilotCss = await readFile('src/app/(patrimonial-pilot)/funnel.module.css', 'utf8');
assert(pilotCss.includes('prefers-reduced-motion:reduce') && pilotCss.includes('animation:none!important') && pilotCss.includes('transition:none!important'));
assert(!/position:\s*(fixed|sticky)/.test(pilotCss), 'No new sticky/fixed pilot elements');

if (process.argv.includes('--build')) {
  const sitemap = await readFile('.next/server/app/sitemap.xml.body', 'utf8');
  for (const root of [architectPath.path, patrimonialEvent.path]) {
    assert(!sitemap.includes(`https://horyzon.it${root}`));
    for (const suffix of ['', '/grazie']) {
      const html = await readFile(`.next/server/app${root}${suffix}.html`, 'utf8');
      assert.match(html, /name="robots" content="noindex, nofollow"/);
      assert.equal((html.match(/<h1\b/g) || []).length, 1);
      assert(!html.includes('class="site-header"'));
      assert(!html.includes('class="site-footer"'));
    }
  }
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const file = `${dir}/${entry.name}`;
      if (entry.isDirectory()) await walk(file);
      else if (entry.name.endsWith('.html') && ![architectPath.path, patrimonialEvent.path].some(root => file.includes(root))) {
        const html = await readFile(file, 'utf8');
        for (const root of [architectPath.path, patrimonialEvent.path]) assert(!html.includes(root), `Pilot reference in public HTML ${file}`);
      }
    }
  }
  await walk('.next/server/app');
  for (const file of ['public/home.md', '.next/server/app/index.md.body', '.next/server/app/llms.txt.body']) {
    const text = await readFile(file, 'utf8');
    for (const root of [architectPath.path, patrimonialEvent.path]) assert(!text.includes(root), `Pilot reference in ${file}`);
  }
  const manifest = JSON.parse(await readFile('.next/routes-manifest.json', 'utf8'));
  for (const root of [architectPath.path, patrimonialEvent.path]) assert(manifest.headers.some(rule => new RegExp(rule.regex).test(root) && new RegExp(rule.regex).test(`${root}/grazie`) && rule.headers.some(header => header.key === 'X-Robots-Tag' && header.value === 'noindex, nofollow')));
}
const httpArgument = process.argv.find(arg => arg.startsWith('--http='));
if (httpArgument) {
  const base = new URL(httpArgument.slice('--http='.length));
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'HTTP verification is restricted to loopback');
  for (const root of [architectPath.path, patrimonialEvent.path]) for (const suffix of ['', '/grazie']) {
    const response = await localFetch(new URL(`${root}${suffix}`, base), { redirect: 'manual' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.match(await response.text(), /name="robots" content="noindex, nofollow"/);
  }
  const publicResponse = await localFetch(new URL('/benessere-patrimoniale', base), { redirect: 'manual' });
  assert.equal(publicResponse.status, 200);
  assert.equal(publicResponse.headers.get('x-robots-tag'), null, 'Pilot headers must not leak onto the public parent');
  assert(!/name="robots" content="[^"]*noindex/.test(await publicResponse.text()));
  console.log('Loopback HTTP: four routes return 200 with noindex/nofollow metadata and headers; public parent stays indexable.');
}
console.log(`Patrimonial pilot: separate payloads, CRM mapping, consents, UTM, rate limit, failures, unchanged public pages and legacy form, static thank-you pages${process.argv.includes('--build') ? ', built SEO/isolation' : ''}: passed. No external calls.`);
