import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('.next/prerender-manifest.json', 'utf8'));
const routes = ['benessere-organizzativo','benessere-patrimoniale','benessere-digitale','benessere-organizzativo/analisi-organizzativa','benessere-digitale/imprese','le-tre-aree','metodo','persone','angelo','frank','gianluca','biblioteca','libro/management-umano','misura','contatti','entra-in-horyzon','horyzon','impresa','economia','umanita','radar-impresa','privacy-policy','cookie-policy'];
for (const route of routes) {
 const html = await readFile(`.next/server/app/${route}.html`, 'utf8');
 assert.equal((html.match(/<h1\b/g) || []).length, 1, `${route}: one page heading`);
 assert(html.includes('editorial-page'), `${route}: shared design missing`);
 assert(!html.includes('<video'), `${route}: unexpected video`);
 if (route.endsWith('policy')) assert(!html.includes('<figure'), `${route}: legal page must stay distraction-free`);
 for (const [, href] of html.matchAll(/href="(\/[^"?#]*)"/g)) {
  if (href.startsWith('/_next/')) continue;
  if (!manifest.routes[href] && !manifest.routes[href + '/']) {
   assert(await stat(`public${href}`).then(() => true, () => false), `${route}: unresolved internal link ${href}`);
  }
 }
 if (['benessere-organizzativo','benessere-patrimoniale','benessere-digitale'].includes(route)) {
  assert(/class="rd rd-page\b/.test(html), `${route}: current shared page kit missing`);
  assert(!html.includes('inside-hero'), `${route}: legacy hero must not return`);
  assert(html.includes('data-wellbeing-scene='), `${route}: area illustration missing`);
  for (const area of ['organizzativo', 'patrimoniale', 'digitale']) assert(html.includes(`href="/benessere-${area}"`), `${route}: area navigation missing ${area}`);
  for (const anchor of ['comprendere','ambiti','primo-passo']) assert(html.includes(`id="${anchor}"`), `${route}: missing ${anchor}`);
  assert.equal((html.match(/data-wellbeing-service=""/g) || []).length, 3, `${route}: three service links`);
 }
}
for (const route of ['horyzon', 'impresa', 'economia', 'umanita']) {
 const html = await readFile(`.next/server/app/${route}.html`, 'utf8');
 assert(/class="rd rd-page\b/.test(html), `${route}: current shared page kit missing`);
 assert(!html.includes('inside-hero'), `${route}: legacy hero must not return`);
 assert(html.includes(`data-vision-scene="${route}"`), `${route}: dedicated illustration missing`);
 for (const sibling of ['horyzon', 'impresa', 'economia', 'umanita']) assert(html.includes(`href="/${sibling}"`), `${route}: vision navigation missing ${sibling}`);
 for (const anchor of ['visione', 'prospettive']) assert(html.includes(`id="${anchor}"`), `${route}: missing ${anchor}`);
 assert(html.includes('href="/contatti"'), `${route}: next step missing`);
}
const identity = await readFile('.next/server/app/horyzon.html', 'utf8');
for (const anchor of ['metodo', 'persone']) assert(identity.includes(`id="${anchor}"`), `horyzon: missing ${anchor}`);
for (const person of ['angelo', 'frank', 'gianluca', 'emanuele']) assert(identity.includes(`href="/${person}"`), `horyzon: missing person ${person}`);
const radar = await readFile('.next/server/app/radar-impresa.html', 'utf8');
assert(radar.includes('href="https://hub.horyzon.it/radar"'), 'radar-impresa: Radar link missing');
for (const label of ['Amministrazione', 'Produzione', 'Commerciale', 'Marketing', 'Persone', 'Come lavora l’impresa', 'Dove si concentra il peso', 'Da dove cominciare']) {
 assert(radar.includes(label), `radar-impresa: missing ${label}`);
}
const serviceRoutes = [
 'benessere-organizzativo/analisi-organizzativa',
 'benessere-organizzativo/sviluppo-imprenditoriale',
 'benessere-organizzativo/human-management',
 'benessere-patrimoniale/visione-patrimoniale',
 'benessere-patrimoniale/imprenditori',
 'benessere-patrimoniale/professionisti',
 'benessere-digitale/imprese',
 'benessere-digitale/competenze',
 'benessere-digitale/italia-digitale',
];
for (const route of serviceRoutes) {
 const html = await readFile(`.next/server/app/${route}.html`, 'utf8');
 assert(/class="rd rd-page\b/.test(html), `${route}: current shared page kit missing`);
 assert(!html.includes('inside-hero'), `${route}: legacy hero must not return`);
 assert(html.includes('data-wellbeing-scene='), `${route}: animated area illustration missing`);
 assert.equal((html.match(/<h1\b/g) || []).length, 1, `${route}: one page heading`);
 for (const anchor of ['quando-serve', 'percorso', 'risultati', 'primo-passo']) assert(html.includes(`id="${anchor}"`), `${route}: missing ${anchor}`);
 for (const sibling of serviceRoutes.filter(item => item.startsWith(route.split('/')[0] + '/') && item !== route)) {
  assert(html.includes(`href="/${sibling}"`), `${route}: sibling navigation missing ${sibling}`);
 }
 assert(html.includes('service-editorial'), `${route}: diagnostic story missing`);
 assert(html.includes('Quando diventa urgente'), `${route}: urgency section missing`);
 assert(html.includes('Cosa diventa visibile'), `${route}: evidence section missing`);
 assert(html.includes(`href="/${route.split('/')[0]}"`), `${route}: area return missing`);
}
for (const [route, phrase] of [
 ['benessere-organizzativo', 'Il lavoro deve potersi muovere anche senza di te.'],
 ['benessere-patrimoniale', 'Proteggere ciò che hai costruito richiede una vista completa.'],
 ['benessere-digitale', 'La tecnologia vale quando libera capacità nel lavoro reale.'],
]) {
 const html = await readFile(`.next/server/app/${route}.html`, 'utf8');
 assert(html.includes(phrase), `${route}: unique area question missing`);
 assert(html.includes('id="primo-passo"'), `${route}: first-step section missing`);
}
for (const route of ['benessere-organizzativo', 'benessere-digitale/imprese', 'horyzon', 'angelo', 'metodo']) {
 const html = await readFile(`.next/server/app/${route}.html`, 'utf8');
 assert(html.includes('site-frame'), `${route}: contained frame missing`);
}
for (const route of ['privacy-policy', 'cookie-policy']) {
 const html = await readFile(`.next/server/app/${route}.html`, 'utf8');
 assert(!html.includes('site-frame'), `${route}: contained frame must be excluded`);
}
console.log(`Editorial checks passed: ${routes.length} representative routes, headings, internal links, area sections, no videos.`);
