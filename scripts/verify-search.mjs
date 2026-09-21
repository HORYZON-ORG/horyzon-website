import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.argv[2]?.replace(/\/$/, '');
const origin = 'https://horyzon.it';
const decode = value => value?.replaceAll('&amp;', '&').replaceAll('&#x27;', "'").replaceAll('&quot;', '"');
const tagValue = (html, key, value) => {
 const tag = [...html.matchAll(/<(?:meta|link)\b[^>]*>/g)].map(match => match[0]).find(tag => tag.includes(`${key}="${value}"`));
 return decode(tag?.match(/(?:content|href)="([^"]*)"/)?.[1]);
};
async function get(route, body = false) {
 if (base) {
  const response = await fetch(base + route, { redirect: 'manual' });
  assert.equal(response.status, 200, `${route} must return 200 without redirects`);
  return response.text();
 }
 const name = route === '/' ? 'index' : route.slice(1);
 return readFile(path.join('.next/server/app', name + (body ? '.body' : '.html')), 'utf8');
}
const sitemap = await get('/sitemap.xml', true);
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => decode(match[1]));
assert(urls.length > 10, 'Sitemap unexpectedly empty');
assert.equal(new Set(urls).size, urls.length, 'Duplicate sitemap URL');
const excluded = ['/radar', '/privacy-policy', '/cookie-policy', '/v/frank', '/llms.txt', '/index.md'];
const titleSet = new Set();
let schemaCount = 0;
for (const url of urls) {
 assert.equal(new URL(url).origin, origin);
 const route = new URL(url).pathname;
 assert(!excluded.includes(route) && !route.startsWith('/v/'), `Excluded URL in sitemap: ${route}`);
 const html = await get(route);
 assert(!/name="robots" content="[^"]*noindex/.test(html), `Noindex in sitemap: ${route}`);
 const canonical = tagValue(html, 'rel', 'canonical');
 assert.equal(canonical?.replace(/\/$/, ''), url.replace(/\/$/, ''), `Canonical mismatch: ${route}`);
 assert.equal((html.match(/<h1\b/g) || []).length, 1, `H1 count: ${route}`);
 const title = decode(html.match(/<title>([^<]+)<\/title>/)?.[1]);
 assert(title, `Missing title: ${route}`);
 const languageTitle = `${route.match(/^\/(en|de|fr)(?:\/|$)/)?.[1] ?? 'it'}:${title}`;
 assert(!titleSet.has(languageTitle), `Duplicate title within language: ${route}: ${title}`);
 titleSet.add(languageTitle);
 const description = tagValue(html, 'name', 'description');
 assert(description?.length > 15, `Missing description: ${route}`);
 assert.equal(tagValue(html, 'property', 'og:title'), title, `OG title mismatch: ${route}`);
 assert.equal(tagValue(html, 'property', 'og:description'), description, `OG description mismatch: ${route}`);
 assert.equal(tagValue(html, 'property', 'og:url')?.replace(/\/$/, ''), canonical?.replace(/\/$/, ''), `OG URL mismatch: ${route}`);
 assert.equal(tagValue(html, 'name', 'twitter:card'), 'summary_large_image');
 const nodes = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap(match => {
  const value = JSON.parse(match[1]);
  assert.equal(value['@context'], 'https://schema.org');
  return value['@graph'] ?? [value];
 });
 const ids = new Set(nodes.map(node => node['@id']));
 assert(nodes.some(node => node['@type'] === 'Organization'));
 assert(nodes.some(node => node['@type'] === 'WebSite'));
 const page = nodes.find(node => ['WebPage', 'AboutPage', 'ProfilePage', 'ContactPage'].includes(node['@type']));
 assert(page, `Missing page entity: ${route}`);
 assert.equal(page.inLanguage, route.match(/^\/(en|de|fr)(?:\/|$)/)?.[1] ?? 'it');
 assert(ids.has(page.isPartOf['@id']));
 assert(ids.has(page.publisher['@id']));
 if (page.breadcrumb) {
  const breadcrumb = nodes.find(node => node['@id'] === page.breadcrumb['@id']);
  assert(breadcrumb);
  assert(breadcrumb.itemListElement.every((item, index) => item.position === index + 1 && item.item.startsWith(origin)));
 }
 assert(!nodes.some(node => ['FAQPage', 'HowTo', 'AggregateRating'].includes(node['@type'])));
 schemaCount += nodes.length;
}
for (const route of excluded.filter(route => !route.includes('.'))) {
 const html = await get(route);
 assert.match(html, /name="robots" content="[^"]*noindex/, `Missing intentional noindex: ${route}`);
}
const robots = await get('/robots.txt', true);
for (const agent of ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot', 'ChatGPT-User', 'Claude-User', 'Perplexity-User']) assert(robots.includes(agent));
assert(!robots.includes('Disallow: /'));
assert(robots.includes(`${origin}/sitemap.xml`));
const markdown = await get('/index.md', true);
const llms = await get('/llms.txt', true);
assert(markdown.startsWith('# Horyzon Consulting'));
assert(llms.startsWith('# Horyzon Consulting'));
assert(markdown.includes('https://hub.horyzon.it/radar'));
assert(!markdown.includes('https://hub.horyzon.it/radar?'));
assert(!markdown.includes('29 domande'));
for (const state of ['Disponibile oggi', 'Configurato nel percorso', 'Direzione evolutiva']) assert(markdown.includes(state), `Missing capability state: ${state}`);
const radar = await get('/radar-impresa');
assert(radar.includes('Qual è la differenza tra Hub e Platform?'));
assert(radar.includes('Le integrazioni sono già attive per ogni azienda?'));
assert((await get('/')).includes('type="text/markdown"'));

if (base) {
 for (const route of ['/', '/radar', '/frank', '/index.md', '/llms.txt', '/not-a-real-horyzon-page-404']) {
  const response = await fetch(base + route, { redirect: 'manual' });
  assert.equal(response.status, route.includes('-404') ? 404 : 200);
  for (const header of ['content-security-policy', 'strict-transport-security', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy']) assert(response.headers.has(header), `${route}: missing ${header}`);
  const csp = response.headers.get('content-security-policy');
  assert(csp.includes("frame-ancestors 'none'"));
  assert(csp.includes("object-src 'none'"));
  assert(!csp.includes('unsafe-eval'), 'Production CSP must not allow eval');
  if (route === '/index.md') assert.match(response.headers.get('content-type'), /^text\/markdown;\s*charset=utf-8$/i);
  if (route === '/llms.txt' || route === '/index.md') assert.match(response.headers.get('x-robots-tag'), /noindex/);
 }
 const image = await fetch(base + '/opengraph-image');
 assert.equal(image.status, 200);
 assert.match(image.headers.get('content-type'), /^image\//);
}
console.log(JSON.stringify({ source: base || 'production build', sitemapPages: urls.length, structuredEntities: schemaCount, uniqueTitles: titleSet.size, intentionalNoindex: 'preserved', robots: 'passed', publicGuides: 'passed', headers: base ? 'passed' : 'requires HTTP check' }, null, 2));
