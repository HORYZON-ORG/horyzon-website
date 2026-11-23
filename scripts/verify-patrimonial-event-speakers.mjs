import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';

const landing=readFileSync(new URL('../src/components/patrimonial-event-landing.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/components/patrimonial-event.module.css',import.meta.url),'utf8');
assert.doesNotMatch(landing,/Nessuna vendita durante l['’]evento/i,'obsolete no-sales copy must be gone');
assert.match(landing,/Gratuito · Online · 60 minuti \+ eventuali domande/);
const frank=landing.indexOf('data-event-section="speaker"');
const additional=landing.indexOf('data-event-section="other-speakers"');
const bonuses=landing.indexOf('data-event-section="bonuses"');
const signup=landing.indexOf('data-event-section="request"');
assert(frank>=0 && frank<additional && additional<bonuses && bonuses<signup,'guest portraits must be between Frank and registration');
for(const [name,role,file] of [
 ['Angelo Ria Chetta','Founder Horyzon','angelo-ria-chetta.webp'],
 ['Gianni Mazzotta','Architetto Patrimoniale','gianni-mazzotta.webp'],
 ['Francesco Aquilanti','Care is Gold','francesco-aquilanti.webp'],
]){
 assert(landing.includes(name)&&landing.includes(role)&&landing.includes('/benessere-patrimoniale/evento/speakers/'+file));
 const data=readFileSync(join(process.cwd(),'public','benessere-patrimoniale','evento','speakers',file));
 assert(data.length>10000,'actual photo must be nonempty '+name);
 assert.equal(data.subarray(0,4).toString('ascii'),'RIFF','photo must be WebP '+name);
 assert.equal(data.subarray(8,12).toString('ascii'),'WEBP','photo must be WebP '+name);
}
assert.match(css,/vSpeakerRosterGrid/);
assert.match(css,/@media\(max-width:650px\)/);
assert.match(landing,/vSpeakerRosterCircle/);
console.log('Event speakers: authentic photo assets, exact names/roles, section order and responsive layout PASS');
