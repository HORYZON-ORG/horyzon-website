import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const landing=readFileSync(new URL('../src/components/patrimonial-event-landing.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/components/patrimonial-event.module.css',import.meta.url),'utf8');
assert.match(landing,/<div data-event-section="agenda" hidden aria-hidden="true"/,'program remains in code but hidden');
assert.match(css,/\[data-event-section="agenda"\]\[hidden\]\{display:none!important\}/);
assert.match(landing,/Un incontro, una domanda di fondo/,'hidden agenda content must be preserved');
assert.doesNotMatch(landing,/Vuoi capire oro, argento, immobili, ETF/);
assert.doesNotMatch(landing,/Investi già e vuoi vedere come ragionano i grandi patrimoni/);
assert.doesNotMatch(landing,/className=\{styles\.vRadar\}/,'no Radar bonus advertised');
assert.doesNotMatch(landing,/Cos’è il Radar Patrimoniale\?/,'no FAQ promise for removed bonus');
assert.match(landing,/BONUS 1<\/span><br \/><strong[^>]+>La lista delle domande da fare prima di firmare/);
assert.match(landing,/BONUS 2<\/span><br \/><strong[^>]+>40 minuti solo per te, con un Architetto Patrimoniale/);
assert.doesNotMatch(landing,/quali strumenti vuoi approfondire/);
const speaker=landing.indexOf('data-event-section="speaker"');
const bonus=landing.indexOf('data-event-section="bonuses"');
assert(speaker>=0&&speaker<bonus,'speaker section precedes benefits');
assert(!landing.includes('data-event-section="other-speakers"'),'no separate speaker section');
const section=landing.slice(speaker,bonus);
for(const [name,role,file] of [
  ['Frank Cannoletta','Moderatore evento','/benessere-patrimoniale/evento/speakers/frank-cannoletta-ritratto-approvato.webp'],
  ['Francesco Aquilanti','Area Manager CIG (Care is Gold)','/benessere-patrimoniale/evento/speakers/francesco-aquilanti-ritratto-originale.webp'],
  ['Gianni Mazzotta','Architetto Patrimoniale','/benessere-patrimoniale/evento/speakers/gianni-mazzotta-ritratto-originale.webp'],
  ['Angelo Ria Chetta','Founder Horyzon','/benessere-patrimoniale/evento/speakers/angelo-ria-chetta-ritratto-approvato.webp'],
]){
 assert(landing.includes(name)&&landing.includes(role)&&landing.includes(file),name+' correct original portrait and role');
}
assert(!section.includes('Mi ero affidato')&&!section.includes('11 anni')&&!section.includes('<blockquote'));
assert.match(css,/\.page \.vSpeakerRosterGrid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(css,/\.page \.vSpeakerRosterPortrait\{position:relative;aspect-ratio:1/,'large photos are square');
assert(!landing.includes('vSpeakerRosterCircle'),'square photos replace circular portraits');
const source=readFileSync(new URL('../src/content/patrimonial-event-content.ts',import.meta.url),'utf8');
assert.doesNotMatch(landing,/radar\s+patrimoniale|il tuo radar/i,'no radar copy even in hidden agenda');
assert.doesNotMatch(source,/radar\s+patrimoniale|il tuo radar/i,'no radar promise in dynamic profile copy');
assert.doesNotMatch(css,/\.page \.vRadar/,'obsolete Radar bonus CSS removed');
for(const path of [
  '../src/app/(event-live)/evento/quello-che-le-banche-non-dicono/page.tsx',
  '../src/app/(event-live)/evento/quello-che-le-banche-non-dicono/grazie/page.tsx',
  '../src/components/patrimonial-event-form.tsx',
  '../src/components/patrimonial-lead-form.tsx',
]){
 const text=readFileSync(new URL(path,import.meta.url),'utf8');
 assert.doesNotMatch(text,/radar-patrimoniale|Radar Patrimoniale|Il tuo Radar/i,'no Radar link or promise in active event flow: '+path);
}
const expectedNames=['Frank Cannoletta','Francesco Aquilanti','Gianni Mazzotta','Angelo Ria Chetta'];
const speakerDefs=landing.slice(landing.indexOf('const eventSpeakers = ['),landing.indexOf('] as const;',landing.indexOf('const eventSpeakers = [')));
assert.deepEqual([...speakerDefs.matchAll(/name: '([^']+)'/g)].map(m=>m[1]),expectedNames,'speaker order Frank Francesco Gianni Angelo');
assert(landing.indexOf('vSpeakerRosterPortrait')<landing.indexOf('vSpeakerRosterBody'),'photo above title');
assert.match(css,/@media\(max-width:650px\)/);
for(const file of ['frank-cannoletta-ritratto-approvato.webp','angelo-ria-chetta-ritratto-approvato.webp','gianni-mazzotta-ritratto-originale.webp','francesco-aquilanti-ritratto-originale.webp']){
 const data=readFileSync(join(process.cwd(),'public','benessere-patrimoniale','evento','speakers',file));
 assert(data.length>10000&&data.subarray(0,4).toString('ascii')==='RIFF'&&data.subarray(8,12).toString('ascii')==='WEBP','original photo still present '+file);
}
const francesco=readFileSync(join(process.cwd(),'public','benessere-patrimoniale','evento','speakers','francesco-aquilanti-ritratto-originale.webp'));
assert.equal(francesco.subarray(12,16).toString('ascii'),'VP8L','lossless WebP contains exact original pixels');
assert.equal(francesco[20],0x2f,'valid VP8L signature');
const geometry=francesco.readUInt32LE(21);
assert.equal((geometry & 0x3fff)+1,1122,'Francesco original width unchanged');
assert.equal(((geometry>>14)&0x3fff)+1,1402,'Francesco original height unchanged');
assert.match(css,/\.page \.vSpeakerFrancescoPortrait img\{object-fit:contain;object-position:center center;filter:none\}/,'Francesco portrait fully visible, no crop or filter');
assert.match(landing,/person\.name === 'Francesco Aquilanti' \? styles\.vSpeakerFrancescoPortrait : ''/,'only Francesco uses full-body framing');
const gianni=readFileSync(join(process.cwd(),'public','benessere-patrimoniale','evento','speakers','gianni-mazzotta-ritratto-originale.webp'));
assert.equal(gianni.subarray(12,16).toString('ascii'),'VP8L','Gianni WebP preserves uploaded portrait losslessly');
assert.equal(gianni[20],0x2f,'valid Gianni lossless WebP header');
const gianniGeometry=gianni.readUInt32LE(21);
assert.equal((gianniGeometry & 0x3fff)+1,1024,'Gianni uploaded portrait original width');
assert.equal(((gianniGeometry>>14)&0x3fff)+1,1536,'Gianni uploaded portrait original height');
assert.match(css,/\.page \.vSpeakerGianniPortrait img\{object-fit:contain;object-position:center center;filter:none\}/,'Gianni whole figure is visible without crop');
assert.match(landing,/person\.name === 'Gianni Mazzotta' \? styles\.vSpeakerGianniPortrait : ''/,'Gianni framing applies only to his own card');
const angelo=readFileSync(join(process.cwd(),'public','benessere-patrimoniale','evento','speakers','angelo-ria-chetta-ritratto-approvato.webp'));
assert.equal(angelo.subarray(12,16).toString('ascii'),'VP8L','approved Angelo photo has lossless WebP pixels');
assert.equal(angelo[20],0x2f,'approved Angelo VP8L signature');
const angeloGeometry=angelo.readUInt32LE(21);
assert.equal((angeloGeometry & 0x3fff)+1,1254,'approved Angelo square image native width');
assert.equal(((angeloGeometry>>14)&0x3fff)+1,1254,'approved Angelo square image native height');
assert.match(css,/\.page \.vSpeakerRosterPortrait \.vSpeakerAngeloPhoto\{object-fit:contain;object-position:center center;filter:none;transform:none\}/,'Angelo square image fully visible with no crop or grayscale alteration');

const frank=readFileSync(join(process.cwd(),'public','benessere-patrimoniale','evento','speakers','frank-cannoletta-ritratto-approvato.webp'));
assert.equal(frank.subarray(12,16).toString('ascii'),'VP8L','approved Frank photo stored as lossless WebP');
assert.equal(frank[20],0x2f,'valid Frank lossless WebP signature');
const frankGeometry=frank.readUInt32LE(21);
assert.equal((frankGeometry & 0x3fff)+1,1254,'Frank approved square width unchanged');
assert.equal(((frankGeometry>>14)&0x3fff)+1,1254,'Frank approved square height unchanged');
assert.match(css,/\.page \.vSpeakerFrankPortrait img\{object-fit:contain;object-position:center center;filter:none;transform:none\}/,'Frank photo fits square card without cropping');
assert.match(landing,/person\.name === 'Frank Cannoletta' \? styles\.vSpeakerFrankPortrait : ''/,'Frank light background applied only to his card');
console.log('Event copy and all four speakers, including approved Frank portrait, PASS');
