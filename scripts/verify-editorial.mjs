import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('.next/prerender-manifest.json', 'utf8'));
const routes = ['benessere-organizzativo','benessere-patrimoniale','benessere-digitale','benessere-organizzativo/analisi-organizzativa','benessere-digitale/imprese','le-tre-aree','metodo','persone','angelo','frank','gianluca','biblioteca','libro/management-umano','misura','contatti','entra-in-horyzon','horyzon','privacy-policy','cookie-policy'];
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
  for (const anchor of ['comprendere','ambiti','primo-passo']) assert(html.includes(`id="${anchor}"`), `${route}: missing ${anchor}`);
  assert.equal((html.match(/class="service-row"/g) || []).length, 3);
 }
}
console.log(`Editorial checks passed: ${routes.length} representative routes, headings, internal links, area sections, no videos.`);
