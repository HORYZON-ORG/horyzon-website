import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

// Offline only. Metadata photograph, never a remote history repair/apply runner.
const evidence=JSON.parse(await readFile(new URL('./fixtures/patrimonial-preflight-evidence.json',import.meta.url),'utf8'));
const doc=await readFile(new URL('../docs/patrimonial/patrimonial-migration-lineage-v1.md',import.meta.url),'utf8');
const baseline=[['20261014225059','20261014215416','patrimonial_lead_v2'],['20261015100912','20261015101816','patrimonial_opportunity_jsonb_precedence']];
const bodies=new Map();
for(const [local,remote,name] of baseline) {
  assert.notEqual(local,remote);assert.equal(evidence.remoteHistory.find(m=>m.name===name)?.version,remote);
  const source=(await readFile(new URL(`../supabase/migrations/${local}_${name}.sql`,import.meta.url),'utf8')).replaceAll('\r\n','\n');
  for(const m of source.matchAll(/create(?: or replace)? function public\.(\w+)\([\s\S]*?\bas\s+\$\$([\s\S]*?)\$\$;/gi)) bodies.set(m[1],createHash('md5').update(m[2]).digest('hex'));
  for(const value of [local,remote,name]) assert(doc.includes(value));
}
for(const f of evidence.functions) assert.equal(bodies.get(f.name),f.hash,`schema routine evidence drift: ${f.name}`);
assert.equal(evidence.functions.length,10);assert(evidence.constraints.every(c=>c.validated));assert(evidence.rls.every(t=>t.rls&&t.force));assert.equal(evidence.clientGrants.length,0);
const order=['20261018094926_patrimonial_assignment_management.sql','20261018163245_patrimonial_owner_sync.sql','20261018180107_patrimonial_runtime_capabilities.sql'];
for(const name of order) {
  assert(!evidence.remoteHistory.some(m=>m.version===name.slice(0,14)||m.name===name.slice(15,-4)));
  await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8');assert(doc.includes(name));
}
assert.deepEqual(order,[...order].sort());
const assignmentSql=await readFile(new URL('../supabase/migrations/'+order[0],import.meta.url),'utf8');
const p1Tables=[...assignmentSql.matchAll(/create table public\.(\w+)/g)].map(m=>m[1]);assert.equal(p1Tables.length,10);
assert(!evidence.rls.some(t=>p1Tables.includes(t.table)));
assert(!evidence.columns.some(c=>['current_operator_id','operator_revision','owner_checkpoint_revision','owner_checkpoint','experiment_id'].includes(c.column)));
assert(!evidence.functions.some(f=>/patrimonial_(assignment_|owner_|execute_command_pre_)/.test(f.name)));
assert.match(doc,/genericDbPush:\s*UNSAFE/);assert.match(doc,/targetedExplicitApply:\s*SAFE_WITH_PREFLIGHT/);
for(const requirement of ['NO_HISTORY_REPAIR','NO_BASELINE_REEXECUTION','PRE_APPLY_CHECKS','POST_APPLY_CHECKS','P1 → P2B → CAPABILITIES']) assert(doc.includes(requirement));
const protectedFiles=['20261014225059_patrimonial_lead_v2.sql','20261015100912_patrimonial_opportunity_jsonb_precedence.sql',...order.slice(0,2)].map(n=>'supabase/migrations/'+n);
assert.equal(execFileSync('git',['diff','5b8a997f83c296c6cac4a319df18568e6273be9e','--',...protectedFiles],{encoding:'utf8'}),'');
console.log('PASS logical baseline names, expected version divergence, 10 routine hashes, validated schema evidence, no P1/P2B partial objects in P2C-A photograph');
console.log('PASS P1 → P2B → CAPABILITIES; genericDbPush=UNSAFE; targetedExplicitApply=SAFE_WITH_PREFLIGHT; no network/history repair/baseline replay');
