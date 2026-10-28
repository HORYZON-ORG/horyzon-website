import './verify-patrimonial-document-layouts.mjs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {patrimonialRadarMode as mode} from '../src/lib/patrimonial-radar-ui/public-mode.ts';
import {publicQuestion,publicTitles} from '../src/lib/patrimonial-radar-ui/public-copy.ts';
import {QUESTION_CATALOG} from '../src/lib/patrimonial-radar/catalog.ts';
import {diagnose} from '../src/lib/patrimonial-radar/result.ts';
import {customerProjection} from '../src/lib/patrimonial-radar-server/customer-projection.ts';
import {buildFixture} from './patrimonial-radar-fixtures.mjs';
import {assertPublicPilotPreservation} from './lib/patrimonial-public-preservation.mjs';
const anonymous={PATRIMONIAL_RADAR_MODE:'PUBLIC_ANONYMOUS',PATRIMONIAL_RADAR_PUBLIC_ANONYMOUS_ENABLED:'true'};
assert.equal(mode({}),null);
for(const context of [{},{VERCEL:'1',VERCEL_ENV:'preview'},{VERCEL:'1',VERCEL_ENV:'production'}]) assert.equal(mode({...anonymous,...context}),null);
for(const patch of [{PATRIMONIAL_RADAR_MODE:undefined},{PATRIMONIAL_RADAR_MODE:'x'},{PATRIMONIAL_RADAR_PUBLIC_ANONYMOUS_ENABLED:'false'},{PATRIMONIAL_RADAR_PUBLIC_ANONYMOUS_ENABLED:'TRUE'},{PATRIMONIAL_RADAR_PUBLIC_ANONYMOUS_ENABLED:' true '},{PATRIMONIAL_RADAR_VERIFIED_PERSISTENT_ENABLED:'true'},{PATRIMONIAL_RADAR_BACKEND_ENABLED:'true'},{PATRIMONIAL_RADAR_ADVISOR_PREVIEW_ENABLED:'true'}]) assert.equal(mode({...anonymous,...patch}),null);
const persistent={PATRIMONIAL_RADAR_MODE:'VERIFIED_PERSISTENT',PATRIMONIAL_RADAR_VERIFIED_PERSISTENT_ENABLED:'true'};
assert.equal(mode(persistent),'VERIFIED_PERSISTENT');for(const c of [{VERCEL:'1'},{VERCEL_ENV:'production'}])assert.equal(mode({...persistent,...c}),null);
assert.equal(QUESTION_CATALOG.length,40);assert.equal(QUESTION_CATALOG.filter(q=>q.optional).length,11);
const fixture=buildFixture('T02');
for(const q of QUESTION_CATALOG){const copy=publicQuestion(q.id,fixture);assert(copy.text&&copy.help);assert.match(copy.help,/Non so.*Preferisco non rispondere/);assert.equal(q.id in publicTitles,!!publicTitles[q.id]);}
for(let n=1;n<=14;n++){const input=buildFixture('T'+String(n).padStart(2,'0')),canonical=diagnose(input);assert.deepEqual(diagnose(structuredClone(input)),canonical);const projected=customerProjection({result:canonical});for(const area of ['A','B','C','D','E','F'])assert.equal(projected.areas[area].state,canonical.areas[area].state);assert.doesNotMatch(JSON.stringify(projected),/"(?:indicators|formula|answerRefs|interviewQuestions|ownerId)":/);}
// Dependency graph proof: the anonymous entry has no transport, server secret,
// client persistence or Advisor implementation. Type-only imports are erased.
const graph=new Set();
function walk(file){if(graph.has(file))return;graph.add(file);const source=readFileSync(file,'utf8');assert.doesNotMatch(source,/\bfetch\s*\(|radarApi|localStorage|sessionStorage|indexedDB|sendBeacon|console\.|process\.env|serviceRoleKey|serverKey/ ,file);for(const match of source.matchAll(/import(?!\s+type\b)[\s\S]*?from ['"]([^'"]+)['"]/g)){const target=match[1];if(!target.startsWith('.')&&!target.startsWith('@/'))continue;const path=target.startsWith('@/')?'src/'+target.slice(2):new URL(target,new URL(file,'file:///'+process.cwd().replaceAll('\\','/')+'/')).pathname.replace(/^\/([A-Za-z]:)/,'$1');const found=[path,path+'.ts',path+'.tsx'].find(p=>{try{return readFileSync(p).length>=0;}catch{return false;}});if(found)walk(found);}}
walk('src/components/patrimonial-radar/anonymous-client.tsx');
assert(![...graph].some(p=>/advisor|\/(api|store|service|runtime)\.ts$/.test(p)));
assertPublicPilotPreservation('ac56a874ef6a7aefb948c45c738ea9df4b91e0ca',['src/lib/patrimonial-radar','src/lib/radar','src/components/radar','src/lib/public-leads','src/components/patrimonial-event-landing.tsx','src/components/patrimonial-architect-landing.tsx','supabase','public','package-lock.json','src/components/patrimonial-radar/radar-client.tsx']);
// A pinned exception must still reject arbitrary edits to an allowed source.
const file='src/lib/patrimonial-radar-ui/public-copy.ts',before=readFileSync(file);
try{writeFileSync(file,Buffer.concat([before,Buffer.from('\n// forbidden test mutation\n')]));assert.throws(()=>assertPublicPilotPreservation('ac56a874ef6a7aefb948c45c738ea9df4b91e0ca',['src']));}finally{writeFileSync(file,before);}
console.log('PASS public pilot: strict OFF/conflict/server flags; 40 reviewed questions/29+11; 14 deterministic engine/customer fixtures; anonymous dependency graph without transport/storage/secret; pinned preservation and negative mutation');

const oldProxy=execFileSync('git',['show','ac56a874ef6a7aefb948c45c738ea9df4b91e0ca:src/proxy.ts'],{encoding:'utf8'}).replaceAll('\r\n','\n');
assert(readFileSync('src/proxy.ts','utf8').replaceAll('\r\n','\n').includes(oldProxy.slice(oldProxy.indexOf(' const markdown'),oldProxy.indexOf('// Match'))),'Legacy HTML/Markdown proxy body must remain identical');
