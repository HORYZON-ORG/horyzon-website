import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile,readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { SupabasePatrimonialStore } from '../src/lib/public-leads/patrimonial-supabase.ts';
import { receivePatrimonialOpportunity } from '../src/lib/public-leads/patrimonial-routing.ts';
import { patrimonialFlags,PatrimonialStoreUnavailableError } from '../src/lib/public-leads/patrimonial-store.ts';

// No credentials, env files, remote records or network. Evidence contains ONLY
// schema, aggregates/categories and routine hashes from the read-only audit.
let network=0;globalThis.fetch=async()=>{network++;throw new Error('Network forbidden');};
const evidence=JSON.parse(await readFile(new URL('./fixtures/patrimonial-preflight-evidence.json',import.meta.url),'utf8'));
const migrations=['20261014225059_patrimonial_lead_v2.sql','20261015100912_patrimonial_opportunity_jsonb_precedence.sql','20261018094926_patrimonial_assignment_management.sql','20261018163245_patrimonial_owner_sync.sql','20261018180107_patrimonial_runtime_capabilities.sql'];
const sources=await Promise.all(migrations.map(name=>readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8')));
const db=new PGlite();
const query=async(sql,args=[]) => (await db.query(sql,args)).rows;
async function setup(){await db.exec('create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to anon,authenticated,service_role;');await db.exec(sources[0]);await db.exec(sources[1]);}
const transport=async(url,init)=>{
  assert.equal(new URL(url).origin,'https://preflight.invalid');
  const rpc=new URL(url).pathname.split('/').at(-1),body=JSON.parse(init.body);
  try {
    const result=await db.transaction(async tx=>{
      await tx.exec('set local role service_role');
      if(rpc==='patrimonial_store_capabilities') return (await tx.query('select public.patrimonial_store_capabilities() as result')).rows[0].result;
      if(rpc==='patrimonial_store_health') return (await tx.query('select public.patrimonial_store_health() as result')).rows[0].result;
      assert.equal(rpc,'patrimonial_store_transaction');
      return (await tx.query('select public.patrimonial_store_transaction($1::jsonb,$2::jsonb,$3::boolean) result',[JSON.stringify(body.p_commands),JSON.stringify(body.p_expected),body.p_preview])).rows[0].result;
    });return Response.json(result);
  }catch(e){return Response.json({code:e.code,message:e.message},{status:e.code==='PT409'?409:500});}
};
const config={url:'https://preflight.invalid',serviceRoleKey:'fixture-only',fetchImpl:transport};
const current=new SupabasePatrimonialStore(config);
// Run the real pre-P2B adapter, transpiled in memory; no historical file edit.
let oldSource=execFileSync('git',['show','dfd2e7b7b7d4af301c0429bd2ba75fa4c12b4739:src/lib/public-leads/patrimonial-supabase.ts'],{encoding:'utf8'});
oldSource=oldSource.replace(/from '(\.\/[^']+)'/g,(_,p)=>`from '${pathToFileURL(`${process.cwd()}/src/lib/public-leads/${p.slice(2)}`).href}'`);
const oldJs=ts.transpileModule(oldSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const OldStore=(await import(`data:text/javascript;base64,${Buffer.from(oldJs).toString('base64')}`)).SupabasePatrimonialStore;
const old=new OldStore(config);
const tables=['patrimonial_intents','patrimonial_requests','patrimonial_outbox_operations','patrimonial_domain_events','patrimonial_event_editions','patrimonial_participations','patrimonial_consent_evidence'];
const snapshot=async()=>Object.fromEntries(await Promise.all(tables.map(async t=>[t,(await query(`select to_jsonb(t) row from public.${t} t order by to_jsonb(t)::text`)).map(x=>x.row)])));
const originalColumns=await (async()=>{await setup();return query("select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name in ('patrimonial_intents','patrimonial_outbox_operations','patrimonial_domain_events') order by table_name,ordinal_position");})();
try {
  console.log('Local engine:',(await query('select version() version'))[0].version);
  assert.deepEqual(originalColumns,evidence.columns.map(c=>({table_name:c.table,column_name:c.column,data_type:c.type,is_nullable:c.nullable,column_default:c.default})),'remote relevant columns match the local baseline');
  const localFunctions=await query("select p.proname name,md5(p.prosrc) hash from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by p.proname");
  const bodyDrift=[];for(const remote of evidence.functions) {const local=localFunctions.find(f=>f.name===remote.name);if(!local||local.hash!==remote.hash) bodyDrift.push(remote.name);}
  console.log('Routine body comparison:',bodyDrift.length?JSON.stringify(bodyDrift):'10/10 exact hashes');
  assert.equal(bodyDrift.length,0,'unexpected routine body drift requires a new audit');
  const localConstraints=await query("select c.conname name,c.conrelid::regclass::text \"table\",pg_get_constraintdef(c.oid) definition,c.convalidated validated from pg_constraint c where c.contype<>'n' and c.conrelid in ('public.patrimonial_intents'::regclass,'public.patrimonial_outbox_operations'::regclass,'public.patrimonial_domain_events'::regclass) order by c.conname");
  // PGlite PG18 catalogs NOT NULL as contype=n; remote PG17 does not.
  // Nullability is already compared exactly through information_schema above.
  assert.deepEqual(localConstraints,evidence.constraints,'remote constraints match baseline');
  const now=new Date().toISOString(),requests=[],provisionals=[];
  for(let j=0;j<3;j++) {
    const id=randomUUID(),request=randomUUID();provisionals.push(id);requests.push(request);
    const provisional={id,provisionalKey:`synthetic-key-${j}`,mode:'architect-path',requestedEditionId:null,contactId:`synthetic-contact-${j}`,opportunityId:null,identityResolved:true,technicalState:'SYNC_PENDING',createdAt:now};
    await query("insert into public.patrimonial_intents(id,kind,funnel,provisional_key,status,record) values($1,'PROVISIONAL','architect-path',$2,'SYNC_PENDING',$3::jsonb)",[id,provisional.provisionalKey,JSON.stringify(provisional)]);
    const r={id:request,contractVersion:'patrimonial-lead-v2',payloadHash:'a'.repeat(64),payload:{},intentId:id};
    await query("insert into public.patrimonial_requests(request_id,contract_version,mode,payload_hash,source_path,received_at,status,intent_id,receipt_status,crm_status,record,expires_at) values($1,'patrimonial-lead-v2','architect-path',$2,'/synthetic',$3,'SYNC_PENDING',$4,'received','pending',$5::jsonb,now()+interval '30 days')",[request,r.payloadHash,now,id,JSON.stringify(r)]);
    for(const purpose of ['requested-contact','marketing']) await query("insert into public.patrimonial_consent_evidence(evidence_key,request_id,intent_id,purpose,choice,state,policy_version,source_path,received_at,record) values($1,$2,$3,$4,true,'RECORDED_TRUE','synthetic','/synthetic',$5,'{}')",[`${request}:${purpose}`,request,id,purpose,now]);
    await query("insert into public.patrimonial_domain_events(event_key,event_name,intent_id,request_id,revision,occurred_at,actor_type) values($1,'request_received',$2,$3,0,$4,'SYSTEM')",[`synthetic-event-${j}`,id,request,now]);
    for(const kind of ['SYNC_REQUEST','RESOLVE_CONTACT','UPSERT_CONTACT',...(j<2?['ADD_TAGS','ADD_NOTE']:[])]) {
      const opId=randomUUID(),state=j===2&&kind==='UPSERT_CONTACT'?'RECONCILE_REQUIRED':'SYNCED';
      const op={id:opId,operationKey:`synthetic:${j}:${kind}`,requestId:request,intentId:id,kind,technicalState:state,createdAt:now,nextAttemptAt:now,attemptCount:1,leaseToken:null,leaseVersion:1,leaseExpiresAt:null,reconcileRequired:state==='RECONCILE_REQUIRED',lastErrorCode:null};
      await query('select public.patrimonial_put_operation($1::jsonb)',[JSON.stringify(op)]);
    }
  }
  const business=await receivePatrimonialOpportunity(current,{pipeline:'ARCHITECT_PATH',contact:{id:'synthetic-contact-0',locationId:'synthetic-location',identityResolved:true},scopeKey:'synthetic-scope',request:{requestId:requests[0],receivedAt:now,source:'website-pilot',sourcePath:'/synthetic',privacyVersion:'synthetic',marketingConsent:false,utm:{}},actor:{id:'synthetic-system',type:'SYSTEM'},nextStepAt:new Date(Date.now()+86400000).toISOString()});
  const remote={id:'synthetic-opportunity',pipelineId:'synthetic-pipeline',stageId:'synthetic-stage',status:'open',version:'synthetic-version',syncedRevision:1,assignedTo:null};
  await query("update public.patrimonial_intents set remote_opportunity_id=$2,sync_state='SYNCED',record=jsonb_set(record,'{remote}',$3::jsonb) where id=$1",[business.id,remote.id,JSON.stringify(remote)]);
  const before=await snapshot();assert.deepEqual(tables.map(t=>before[t].length),[4,3,13,4,0,0,6]);
  const shape=await query("select kind,funnel,status,stage,revision,sync_state,sync_write_started,sync_reconcile_required,(remote_opportunity_id is not null) remote_id_present,count(*)::integer n from public.patrimonial_intents group by kind,funnel,status,stage,revision,sync_state,sync_write_started,sync_reconcile_required,(remote_opportunity_id is not null) order by kind,funnel");
  assert.deepEqual(shape,evidence.shape.shape);
  const legacyBehavior=async store=>({requests:await Promise.all(requests.map(id=>store.getRequest(id))),intent:await store.transaction(tx=>tx.getOpportunityIntent(business.id)),idle:await store.claimOperations({now:new Date().toISOString(),limit:1})});
  const oldBefore=await legacyBehavior(old);await current.health();
  await assert.rejects(current.claimOwnerOperations({now:new Date().toISOString(),limit:1}),PatrimonialStoreUnavailableError);
  console.log('PASS NEW APP + OLD DB: base health unchanged; missing capability blocks before owner command');
  // Wrong-order application stays inside a disposable local database transaction.
  await assert.rejects(db.exec(sources[3]),e=>/patrimonial_assignments/.test(e.message));await db.exec('rollback');
  assert.equal((await query("select count(*)::integer n from information_schema.columns where table_schema='public' and column_name='owner_checkpoint_revision'"))[0].n,0);
  assert.deepEqual(await snapshot(),before);
  await db.exec(sources[2]);
  const p1=await snapshot();for(const t of tables) assert.deepEqual(p1[t].map(r=>Object.fromEntries(Object.entries(r).filter(([k])=>!['current_operator_id','operator_revision','experiment_id'].includes(k)))),before[t]);
  assert(p1.patrimonial_intents.every(r=>r.current_operator_id===null&&r.operator_revision===0));assert.deepEqual(await legacyBehavior(old),oldBefore);
  console.log('PASS P1 on populated baseline: 4 intents/3 requests/13 operations/4 events/6 consents preserved; new operator fields null/0; legacy RPC unchanged');
  await db.exec(sources[3]);const after=await snapshot();
  for(const t of tables) assert.deepEqual(after[t].map(r=>Object.fromEntries(Object.entries(r).filter(([k])=>!['current_operator_id','operator_revision','experiment_id','owner_checkpoint_revision','owner_checkpoint'].includes(k)))),before[t]);
  assert(after.patrimonial_intents.every(r=>r.owner_checkpoint_revision===0&&r.owner_checkpoint===null));
  assert.deepEqual(await legacyBehavior(old),oldBefore);assert.deepEqual(await legacyBehavior(current),oldBefore);
  await assert.rejects(current.ownerSyncHealth(),PatrimonialStoreUnavailableError);
  await db.exec(sources[4]);await current.assignmentHealth();await current.ownerSyncHealth();
  assert.deepEqual(await snapshot(),after);
  assert.equal((await current.claimOwnerOperations({now:new Date().toISOString(),limit:1})).length,0);
  // SQL default protects the old app, even though its claim call has no kinds.
  await query("select public.patrimonial_put_operation($1::jsonb)",[JSON.stringify({id:randomUUID(),operationKey:'synthetic-owner-isolation',intentId:business.id,requestId:requests[0],kind:'ASSIGN_OPPORTUNITY_OWNER',technicalState:'SYNC_PENDING',createdAt:now,nextAttemptAt:now,attemptCount:0,leaseToken:null,leaseVersion:0,leaseExpiresAt:null,reconcileRequired:false,lastErrorCode:null,identityLockKey:`patrimonial-owner:${business.id}`,owner:{}})]);
  assert.equal((await old.claimOperations({now:new Date().toISOString(),limit:1})).length,0);
  const [owner]=await current.claimOwnerOperations({now:new Date().toISOString(),limit:1});assert.equal(owner.kind,'ASSIGN_OPPORTUNITY_OWNER');
  const [contact]=await old.claimOperations({now:new Date().toISOString(),limit:1,reconciliationOnly:true});assert.equal(contact.kind,'UPSERT_CONTACT');
  for(const role of ['anon','authenticated']) assert.equal((await query("select count(*)::integer n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'patrimonial_%' or p.proname='claim_patrimonial_operations') and has_function_privilege($1,p.oid,'execute')",[role]))[0].n,0);
  assert.equal((await query("select count(*)::integer n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'patrimonial_%' and c.relkind='r' and (not c.relrowsecurity or not c.relforcerowsecurity)"))[0].n,0);
  const methods=[...sources[1].matchAll(/^  when ([^\n]+?) then/gm)].flatMap(m=>[...m[1].matchAll(/'([A-Za-z]+)'/g)].map(v=>v[1]));assert.equal(methods.length,25);
  const [legacyDispatcher]=await query("select md5(prosrc) hash from pg_proc where oid='public.patrimonial_execute_command_pre_assignments(jsonb)'::regprocedure");assert.equal(legacyDispatcher.hash,evidence.functions.find(f=>f.name==='patrimonial_execute_command').hash);assert(sources[3].includes('else return public.patrimonial_execute_command_pre_owner_sync(p_command)'));assert(sources[2].includes('else return public.patrimonial_execute_command_pre_assignments(p_command)'));
  console.log('PASS P2B: legacy data/JSON unchanged; checkpoint null/0; old/current RPC reads equivalent; old/new claims isolated; ACL/RLS intact; no backfill');
  const localNames=await readdir(new URL('../supabase/migrations/',import.meta.url));const historyDrift=[];
  for(const name of localNames.filter(n=>n.endsWith('.sql')&&n<'20261018094926')) {const version=name.slice(0,14),slug=name.slice(15,-4),match=evidence.remoteHistory.find(m=>m.name===slug||m.name===`${version}_${slug}`);if(!match||match.version!==version) historyDrift.push({file:name,remoteVersion:match?.version??null});}
  assert(historyDrift.some(d=>d.file.includes('patrimonial_lead_v2')));assert(historyDrift.some(d=>d.file.includes('opportunity_jsonb_precedence')));
  console.log('EXPECTED historical version divergence (managed targeted strategy):',JSON.stringify(historyDrift));
  assert(Object.values(patrimonialFlags({})).every(v=>v===false));assert.equal(network,0);
  await import('./verify-patrimonial-migration-lineage.mjs');
  console.log('PASS preflight verifier; readiness READY_FOR_REMOTE_MIGRATION_APPROVAL under targeted strategy + explicit capabilities; live smoke remains unauthorized. No remote SQL/write/migration performed by this script.');
} finally {await db.close();}
