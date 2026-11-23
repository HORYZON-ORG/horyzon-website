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
assert.match(landing,/BONUS 2 · SE LO DESIDERI/);
assert.doesNotMatch(landing,/quali strumenti vuoi approfondire/);
const speaker=landing.indexOf('data-event-section="speaker"');
const bonus=landing.indexOf('data-event-section="bonuses"');
assert(speaker>=0&&speaker<bonus,'speaker section precedes benefits');
assert(!landing.includes('data-event-section="other-speakers"'),'no separate speaker section');
const section=landing.slice(speaker,bonus);
for(const [name,role,file] of [
  ['Frank Cannoletta','Moderatore evento','/people/frank-no-badge.png'],
  ['Francesco Aquilanti','Area Manager CIG (Care is Gold)','/benessere-patrimoniale/evento/speakers/francesco-aquilanti.webp'],
  ['Gianni Mazzotta','Architetto Patrimoniale','/benessere-patrimoniale/evento/speakers/gianni-mazzotta.webp'],
  ['Angelo Ria Chetta','Founder Horyzon','/benessere-patrimoniale/evento/speakers/angelo-ria-chetta.webp'],
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
const order=section.match(/name: ['\x22][^'\x22]+/g)||[];
const expectedNames=['Frank Cannoletta','Francesco Aquilanti','Gianni Mazzotta','Angelo Ria Chetta'];
const speakerDefs=landing.slice(landing.indexOf('const eventSpeakers = ['),landing.indexOf('] as const;',landing.indexOf('const eventSpeakers = [')));
assert.deepEqual([...speakerDefs.matchAll(/name: '([^']+)'/g)].map(m=>m[1]),expectedNames,'speaker order Frank Francesco Gianni Angelo');
assert(landing.indexOf('vSpeakerRosterPortrait')<landing.indexOf('vSpeakerRosterBody'),'photo above title');
assert.match(css,/@media\(max-width:650px\)/);
for(const file of ['angelo-ria-chetta.webp','gianni-mazzotta.webp','francesco-aquilanti.webp']){
 const data=readFileSync(join(process.cwd(),'public','benessere-patrimoniale','evento','speakers',file));
 assert(data.length>10000&&data.subarray(0,4).toString('ascii')==='RIFF'&&data.subarray(8,12).toString('ascii')==='WEBP','original photo still present '+file);
}
console.log('Event simplified copy and four authentic speakers PASS');
