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
const home = await readFile('.next/server/app/index.html', 'utf8');
assert.equal((home.match(new RegExp(`href="${radarUrl}"`, 'g')) || []).length, 2, 'home: expected two canonical Radar links');
for (const phrase of ['cinque reparti', 'organizzazione obiettivo', 'reparto prioritario', 'progresso misurabile']) {
  assert(home.toLowerCase().includes(phrase), `home: missing ${phrase}`);
}
const platform = await readFile('.next/server/app/piattaforma.html', 'utf8');
for (const phrase of ['Hub', 'ChatGPT Work', 'Platform', 'KPI', 'report', 'sincronizzazione', 'attivazione']) assert(platform.includes(phrase), `piattaforma: missing ${phrase}`);
const method = await readFile('.next/server/app/metodo.html', 'utf8');
for (const title of ['Definire la destinazione','Leggere il presente','Disegnare l’organizzazione obiettivo','Mappare persone e responsabilità','Misurare il divario','Scegliere il reparto prioritario','Costruire il programma operativo','Attivare con prove','Verificare e continuare']) assert(method.includes(title), `metodo: missing ${title}`);
const system = await readFile('.next/server/app/le-tre-aree.html', 'utf8');
for (const phrase of ['Nucleo organizzativo','Abilitazione digitale','Continuità finanziaria']) assert(system.includes(phrase), `le-tre-aree: missing ${phrase}`);
const frank = await readFile('.next/server/app/frank.html', 'utf8');
for (const phrase of ['debrief', 'obiettivi', 'organizzazione obiettivo', 'reparto prioritario']) assert(frank.toLowerCase().includes(phrase), `frank: missing ${phrase}`);
assert(!/risultati garantiti|autonomia entro \d+/i.test(frank), 'frank: unsupported guarantee');
const contact = await readFile('.next/server/app/contatti.html', 'utf8');
for (const phrase of ['Inizia il Radar','Richiedi il debrief','Descrivi il reparto prioritario']) assert(contact.includes(phrase), `contatti: missing ${phrase}`);
console.log('Narrative checks passed.');
