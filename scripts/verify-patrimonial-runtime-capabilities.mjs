import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { SupabasePatrimonialStore,PatrimonialCapabilityUnavailableError } from '../src/lib/public-leads/patrimonial-supabase.ts';
import { executePatrimonialAssignment } from '../src/lib/public-leads/patrimonial-assignments.ts';

let network=0;globalThis.fetch=async()=>{network++;throw new Error('Network forbidden');};
const names=['20261014225059_patrimonial_lead_v2.sql','20261015100912_patrimonial_opportunity_jsonb_precedence.sql','20261018094926_patrimonial_assignment_management.sql','20261018163245_patrimonial_owner_sync.sql','20261018180107_patrimonial_runtime_capabilities.sql'];
const sources=await Promise.all(names.map(n=>readFile(new URL(`../supabase/migrations/${n}`,import.meta.url),'utf8')));
let oldSource=execFileSync('git',['show','5b8a997f83c296c6cac4a319df18568e6273be9e:src/lib/public-leads/patrimonial-supabase.ts'],{encoding:'utf8'});
oldSource=oldSource.replace(/from '(\.\/[^']+)'/g,(_,p)=>`from '${pathToFileURL(`${process.cwd()}/src/lib/public-leads/${p.slice(2)}`).href}'`);
const OldStore=(await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(oldSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64')}`)).SupabasePatrimonialStore;
const currentSource=await readFile(new URL('../src/lib/public-leads/patrimonial-supabase.ts',import.meta.url),'utf8');
const healthBody=s=>s.replaceAll('\r\n','\n').match(/  async health\(\): Promise<void> \{[\s\S]*?\n  \}/)?.[0];
assert(healthBody(oldSource));assert.equal(healthBody(currentSource),healthBody(oldSource));
assert(currentSource.includes("PATRIMONIAL_STORE_VERSION = 'patrimonial-v2-store-1'"));
async function fixture(level,probe) {
  const db=new PGlite(),calls=[];let override=null;
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to anon,authenticated,service_role;');
  for(const source of sources.slice(0,level)) await db.exec(source);
  if(probe) await db.exec(sources[4]);
  const fetchImpl=async(url,init)=>{
    assert.equal(new URL(url).origin,'https://capability.invalid');const name=new URL(url).pathname.split('/').at(-1),body=JSON.parse(init.body);calls.push({name,body});
    if(name==='patrimonial_store_capabilities'&&override) return Response.json(override);
    try {const result=await db.transaction(async tx=>{
      await tx.exec('set local role service_role');
      if(['patrimonial_store_health','patrimonial_store_capabilities'].includes(name)) return (await tx.query(`select public.${name}() value`)).rows[0].value;
      assert.equal(name,'patrimonial_store_transaction');return (await tx.query('select public.patrimonial_store_transaction($1::jsonb,$2::jsonb,$3::boolean) value',[JSON.stringify(body.p_commands),JSON.stringify(body.p_expected),body.p_preview])).rows[0].value;
    });return Response.json(result);}catch(e){return Response.json({code:e.code,message:e.message},{status:e.code==='PT409'?409:503});}
  };
  const config={url:'https://capability.invalid',serviceRoleKey:'fixture',fetchImpl};
  return {db,calls,store:new SupabasePatrimonialStore(config),old:new OldStore(config),setOverride:v=>{override=v;}};
}
const rejected=e=>e instanceof PatrimonialCapabilityUnavailableError&&e.code==='PATRIMONIAL_CAPABILITY_UNAVAILABLE';
const command={type:'createOperator',commandKey:'capability-operator',actor:{type:'ADMIN',ref:'synthetic-admin'},operator:{operatorKey:'synthetic-operator',displayName:'Synthetic'}};
const assigned=store=>executePatrimonialAssignment(store,command,{env:()=>({PATRIMONIAL_ASSIGNMENTS_ENABLED:'true'})});
const all=[];
try {
  const old=await fixture(2,false);all.push(old);await old.store.health();await assert.rejects(old.store.assignmentHealth(),rejected);await assert.rejects(old.store.ownerSyncHealth(),rejected);
  await assert.rejects(assigned(old.store),rejected);await assert.rejects(old.store.claimOwnerOperations({now:new Date().toISOString(),limit:1}),rejected);assert(!old.calls.some(c=>c.name==='patrimonial_store_transaction'));
  console.log('PASS A/F: OLD DB base healthy; explicit capability error; no new/mutation journal command sent');
  const baseProbe=await fixture(2,true);all.push(baseProbe);await assert.rejects(baseProbe.store.assignmentHealth(),rejected);await assert.rejects(baseProbe.store.ownerSyncHealth(),rejected);
  const p1=await fixture(3,true);all.push(p1);await p1.store.health();await p1.store.assignmentHealth();await assert.rejects(p1.store.ownerSyncHealth(),rejected);const result=await assigned(p1.store);assert.equal(result.operator.operatorKey,'synthetic-operator');
  const beforeOwner=p1.calls.length;await assert.rejects(p1.store.claimOwnerOperations({now:new Date().toISOString(),limit:1}),rejected);assert(!p1.calls.slice(beforeOwner).some(c=>c.name==='patrimonial_store_transaction'));
  const beforePlan=p1.calls.length;await assert.rejects(p1.store.transaction(tx=>tx.commitAssignmentPlan({commandKey:'owner-plan-blocked',payloadHash:'a'.repeat(64),at:new Date().toISOString(),result:{},writes:[{kind:'ownerOperation',value:{}}]},1)),rejected);assert(!p1.calls.slice(beforePlan).some(c=>c.name==='patrimonial_store_transaction'));
  console.log('PASS B/G: P1-only + adaptive probe: real assignment allowed; owner rejected before journal');
  const noProbe=await fixture(4,false);all.push(noProbe);await noProbe.store.health();await assert.rejects(assigned(noProbe.store),rejected);await assert.rejects(noProbe.store.ownerSyncHealth(),rejected);assert(!noProbe.calls.some(c=>c.name==='patrimonial_store_transaction'));
  console.log('PASS C: P1+P2B without capability RPC deliberately unavailable');
  const full=await fixture(4,true);all.push(full);await full.store.health();await full.store.assignmentHealth();await full.store.ownerSyncHealth();await assigned(full.store);assert.equal((await full.store.claimOwnerOperations({now:new Date().toISOString(),limit:1})).length,0);
  console.log('PASS D/H: full DB base/assignment/owner capability and command readiness');
  await full.old.health();assert.equal(await full.old.getRequest('00000000-0000-4000-8000-000000000001'),null);assert.equal((await full.old.claimOperations({now:new Date().toISOString(),limit:1})).length,0);assert.equal((await old.old.claimOperations({now:new Date().toISOString(),limit:1})).length,0);
  console.log('PASS E: old app + new DB legacy health/read/claim intact; old app + old DB intact');
  const probe=async (db,nested=false)=>{
    if(nested){await db.exec('set local role service_role');return (await db.query('select public.patrimonial_store_capabilities() value')).rows[0].value;}
    return db.transaction(async tx=>{await tx.exec('set local role service_role');return (await tx.query('select public.patrimonial_store_capabilities() value')).rows[0].value;});
  };
  const expected=await probe(full.db);assert.deepEqual(expected,{contract:'patrimonial-runtime-capabilities-v1',base:'patrimonial-v2-store-1',assignmentManagement:'p1-v1',ownerSync:'p2b-v1'});
  // Rollback each synthetic partial installation; never repair it automatically.
  for(const [change,assignment,owner] of [
    ['alter table public.patrimonial_intents drop column owner_checkpoint',true,false],
    ['alter table public.patrimonial_intents alter column operator_revision drop default',false,false],
    ['alter table public.patrimonial_assignments disable trigger patrimonial_assignment_history_guard',false,false],
    ['alter table public.patrimonial_outbox_operations drop constraint patrimonial_outbox_operations_effect_type_check',true,false],
    ['drop index public.patrimonial_owner_outbox',true,false],
    ['alter function public.patrimonial_owner_finish(jsonb) security definer',true,false],
    ['grant select on public.patrimonial_operators to anon',false,false],
    ['revoke insert on public.patrimonial_operators from service_role',false,false],
    ['grant execute on function public.claim_patrimonial_operations(jsonb,jsonb) to authenticated',true,false],
    ['alter table public.patrimonial_assignments no force row level security',false,false],
    ['grant execute on function public.patrimonial_store_capabilities() to anon',false,false],
    ['alter function public.patrimonial_capability_objects(jsonb) security definer',false,false],
    ['alter function public.patrimonial_capability_objects(jsonb) reset all',false,false],
    ["create or replace function public.patrimonial_execute_command(p_command jsonb) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$ begin return 'null'::jsonb; end $$",false,false],
  ]) {
    await full.db.exec('begin');try{await full.db.exec(change);const value=await probe(full.db,true);assert.equal(value.assignmentManagement!==null,assignment,change);assert.equal(value.ownerSync!==null,owner,change);}finally{await full.db.exec('rollback');}
  }
  console.log('PASS I: partial columns/default/CHECK/index/trigger/routine security/ACL/RLS never produce false owner readiness');
  for(const role of ['anon','authenticated']) await assert.rejects(full.db.transaction(async tx=>{await tx.exec(`set local role ${role}`);await tx.query('select public.patrimonial_store_capabilities()');}),e=>e.code==='42501');
  await full.db.transaction(async tx=>{await tx.exec('set local role service_role');await tx.exec('set transaction read only');const a=(await tx.query('select public.patrimonial_store_capabilities() value')).rows[0].value,b=(await tx.query('select public.patrimonial_store_capabilities() value')).rows[0].value;assert.deepEqual(a,b);});
  const procs=(await full.db.query("select proname,provolatile,prosecdef from pg_proc where proname in ('patrimonial_store_capabilities','patrimonial_capability_objects')")).rows;assert(procs.every(p=>p.provolatile==='s'&&!p.prosecdef));console.log('PASS J: service-role-only EXECUTE; STABLE/INVOKER and READ ONLY transaction');
  for(const bad of [{...expected,ownerSync:true},{...expected,contract:'unknown'},{...expected,assignmentManagement:null},{...expected,ownerSync:'p2b-v2'}]){full.setOverride(bad);await assert.rejects(full.store.ownerSyncHealth(),rejected);}full.setOverride(null);
  const start=full.calls.length;await full.store.ownerSyncHealth();const next=full.calls.slice(start);assert.deepEqual(next.map(c=>c.name),['patrimonial_store_health','patrimonial_store_capabilities']);
  // Re-probe immediately before final commit, even after a valid preview.
  await assert.rejects(full.store.transaction(async tx=>{await tx.getAssignmentContext('mutation-blocked',[],null);await tx.commitAssignmentPlan({commandKey:'mutation-blocked',payloadHash:'a'.repeat(64),at:new Date().toISOString(),result:{},writes:[]},1);full.setOverride({...expected,assignmentManagement:null});}),rejected);full.setOverride(null);
  assert(!full.calls.some(c=>c.body.p_preview===false&&c.body.p_commands.some(cmd=>cmd.args[0]?.commandKey==='mutation-blocked')));
  assert.equal(network,0);console.log('PASS unsupported schema/version responses, no cache across calls/commit, zero external calls; A–J complete');
} finally {await Promise.all(all.map(f=>f.db.close()));}
