import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const radarUrl = 'https://hub.horyzon.it/radar';
for (const route of ['', 'radar-impresa', 'piattaforma', 'frank', 'contatti']) {
  const file = route ? `.next/server/app/${route}.html` : '.next/server/app/index.html';
  const html = await readFile(file, 'utf8');
  assert(html.includes(radarUrl), `${route || 'home'}: canonical Radar link missing`);
  assert(!/hub\.horyzon\.it\/radar\?/.test(html), `${route || 'home'}: Radar URL must not contain query data`);
}
const radar = await readFile('.next/server/app/radar-impresa.html', 'utf8');
for (const label of ['Amministrazione', 'Produzione', 'Commerciale', 'Marketing', 'Persone']) {
  assert(radar.includes(label), `radar-impresa: missing ${label}`);
}
console.log('Narrative checks passed.');
