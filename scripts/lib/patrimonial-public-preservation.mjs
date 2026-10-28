import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
// Explicitly reviewed public-pilot source files and byte-preserved route moves. Every other historical
// path keeps its own original baseline. The manifest pins the entire new source,
// rather than permitting arbitrary edits in an excluded directory.
const routeMoves=JSON.parse(readFileSync(new URL('../fixtures/patrimonial-app-route-moves.json',import.meta.url),'utf8'));
export const currentAppSource=file=>routeMoves.moves[file]??file;
export function assertRouteMoves() {
  assert.equal(routeMoves.baseline,'d77bb70f6caf7ca2ba75e0b89c5b4ba5f12b57cd');
  assert(!existsSync('src/app/layout.tsx'),'Shared request-aware root must stay removed');
  const reviewed=JSON.parse(readFileSync(new URL('../fixtures/patrimonial-foundation-source-manifest.json',import.meta.url),'utf8'));
  for(const [old,next] of Object.entries(routeMoves.moves)) {
    assert.equal(next,old.replace('src/app/','src/app/(site)/'));
    assert(!existsSync(old),old+' must have exactly one route');
    const actual=readFileSync(next),expected=execFileSync('git',['show',routeMoves.baseline+':'+old]);
    if(reviewed[next]) { assert.equal(createHash('sha256').update(actual.toString().replaceAll('\r\n','\n')).digest('hex'),reviewed[next],next+' reviewed route'); continue; }
    assert(/\.woff2$/.test(old)?actual.equals(expected):actual.toString().replaceAll('\r\n','\n')===expected.toString().replaceAll('\r\n','\n'),next+' must preserve baseline content');
  }
  const inventory=readdirSync('src/app/(site)',{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>(e.parentPath??e.path).replaceAll('\\','/')+'/'+e.name).map(p=>p.slice(p.indexOf('src/app/')));
  assert.deepEqual(inventory.sort(),[...Object.values(routeMoves.moves),'src/app/(site)/layout.tsx'].sort(),'No unreviewed route-group files');
}
export function assertPublicPilotPreservation(baseline,paths) {
  assertRouteMoves();
  const approved=JSON.parse(readFileSync(new URL('../fixtures/patrimonial-public-source-manifest.json',import.meta.url),'utf8'));
  for(const [file,hash] of Object.entries(approved)) assert.equal(createHash('sha256').update(readFileSync(file,'utf8').replaceAll('\r\n','\n')).digest('hex'),hash,file);
  const assets=JSON.parse(readFileSync(new URL('../fixtures/patrimonial-consolidation-assets.json',import.meta.url),'utf8'));
  for(const [file,ref] of Object.entries(assets))assert(readFileSync(file).equals(execFileSync('git',['show',ref+':'+file])),'Reviewed recruitment photo: '+file);
  execFileSync('git',['diff','--exit-code',baseline,'--',...paths,...[...Object.keys(approved),...Object.keys(assets),'src/app/layout.tsx',...Object.keys(routeMoves.moves),...Object.values(routeMoves.moves)].map(p=>`:(exclude)${p}`)],{stdio:'pipe'});
}
