import {assertPublicPilotPreservation} from './lib/patrimonial-public-preservation.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { db,store,sql,run,seed,env,actor,setup,externalAttempts } from './patrimonial-owner-test-fixture.mjs';
import { runPatrimonialOwnerSyncOnce } from '../src/lib/public-leads/patrimonial-owner-sync.ts';
import { PatrimonialHighLevelOwnerProvider,resolveOwnerUserMapping } from '../src/lib/public-leads/patrimonial-owner-provider.ts';
import { PatrimonialHighLevelProvider } from '../src/lib/public-leads/patrimonial-highlevel.ts';
import { getPatrimonialRemoteMapping } from '../src/lib/public-leads/patrimonial-highlevel-config.ts';
import { contactEffectKinds } from '../src/lib/public-leads/patrimonial-owner-operations.ts';
import { PatrimonialConflictError,PatrimonialStaleLeaseError,PatrimonialStoreUnavailableError,patrimonialFlags } from '../src/lib/public-leads/patrimonial-store.ts';
const passed=[];
const proof={runtimeTokenVerified:true,verifiedLocationId:'fixture-location',version:'v3',usersRead:true,opportunityOwnerRead:true,opportunityOwnerWrite:true,ownerOnlyUpdate:true,nullableAssignedTo:true,omittedAssignedToMeansUnassigned:true};
const stamp=()=>new Date().toISOString();
let n=0;
const pipelineId=getPatrimonialRemoteMapping({}).pipelines.ARCHITECT_PATH.id;
const rows=async id=>sql("select * from public.patrimonial_outbox_operations where intent_id=$1 and effect_type='ASSIGN_OPPORTUNITY_OWNER' order by created_at,id",[id]);
const intentRow=async id=>(await sql('select * from public.patrimonial_intents where id=$1',[id]))[0];
const claimFor=op=>({operationId:op.id,leaseToken:op.leaseToken,leaseVersion:op.leaseVersion,now:stamp()});
async function fixture({owner=null,mapping='fixture-user',enabled=true,remote=true}={}) {
  const intent=await seed({owner}),operator=(await run({type:'createOperator',operator:{operatorKey:`owner-fixture-${++n}`,displayName:'Synthetic',remoteUserRef:mapping}})).operator;
  const remoteId=`fixture-opportunity-${n}`;
  if(remote) await sql("update public.patrimonial_intents set remote_opportunity_id=$2,record=jsonb_set(record,'{remote}',$3::jsonb) where id=$1",[intent.id,remoteId,JSON.stringify({id:remoteId,pipelineId,stageId:'fixture-stage',status:'open',version:'fixture-version',syncedRevision:intent.revision,assignedTo:owner})]);
  const command={type:'assignProspect',method:'MANUAL',intentId:intent.id,operatorId:operator.id,expectedRevision:0,commandKey:`enqueue-${++n}`,actor};
  const selectedEnv=()=>({...env(),PATRIMONIAL_OWNER_SYNC_ENABLED:String(enabled)});
  const result=await run(command,{env:selectedEnv});
  const remoteRow={id:remoteId,locationId:intent.locationId,contactId:intent.contactId,pipelineId,assignedTo:owner,customFields:[],updatedAt:'fixture-version'};
  const state={target:mapping,updates:0,reads:0,users:0,requests:[],user:{id:mapping,deleted:false,roles:{role:'user',type:'account',locationIds:['fixture-location']},name:'NEVER PERSIST',email:'never@example.invalid',phone:'never'},row:remoteRow,
    timeout:false,applyTimeout:false,failReadBack:false,afterUser:null,afterWrite:null};
  const provider=new PatrimonialHighLevelOwnerProvider({env:selectedEnv,proof,fetchImpl:async(url,init)=>{
    const path=new URL(url).pathname;state.requests.push({path,method:init.method});assert.equal(init.headers.Version,'v3');
    assert.equal(new URL(url).origin,'https://services.leadconnectorhq.com');
    assert(!url.includes(operator.id),'internal UUID must never go to HighLevel');
    if(path.startsWith('/users/')) {state.users++;await state.afterUser?.();return Response.json(state.user);}
    assert.equal(path,`/opportunities/${remoteId}`);
    if(init.method==='PUT') {
      assert.deepEqual(JSON.parse(init.body),{assignedTo:state.target});state.updates++;
      assert.equal((await intentRow(intent.id)).owner_ref,owner,'checkpoint must wait for separate read-back');
      const persisted=(await rows(intent.id)).find(o=>o.status==='SYNCING');assert.equal(persisted.record.owner.effectMayHaveCommitted,true);
      if(!state.timeout||state.applyTimeout) state.row.assignedTo=state.target;
      await state.afterWrite?.();if(state.timeout) throw new TypeError('synthetic timeout');return Response.json({opportunity:{assignedTo:'UNTRUSTED UPDATE BODY'}});
    }
    assert.equal(init.method,'GET');assert.equal(init.body,undefined);state.reads++;
    if(state.updates&&state.failReadBack) return new Response('',{status:503});
    return Response.json({opportunity:state.row});
  }});
  const work=options=>runPatrimonialOwnerSyncOnce(store,provider,{env:selectedEnv,...options});
  return {intent,operator,result,command,state,provider,work,selectedEnv};
}
async function settle(f) {for(const row of await rows(f.intent.id)) if(!['SYNCED','MANUAL_REVIEW'].includes(row.status)) await sql("update public.patrimonial_outbox_operations set status='MANUAL_REVIEW',lease_token=null,lease_expires_at=null,record=record||'{\"technicalState\":\"MANUAL_REVIEW\",\"leaseToken\":null,\"leaseExpiresAt\":null}'::jsonb where id=$1",[row.id]);}
try {
  await setup(async()=>{
    await assert.rejects(store.claimOwnerOperations({now:stamp(),limit:1}),PatrimonialStoreUnavailableError);
    assert.equal((await sql('select count(*)::integer n from public.patrimonial_outbox_operations'))[0].n,0);
  });
  const off=await fixture({enabled:false});assert.equal((await rows(off.intent.id)).length,0);assert.equal((await off.work()).state,'DISABLED');assert.equal(off.state.requests.length,0);passed.push('A');
  const unmapped=await fixture({mapping:null});assert.equal((await rows(unmapped.intent.id)).length,0);assert.equal(unmapped.result.remoteOwnerState,'REMOTE_OWNER_UNMAPPED');passed.push('B');
  const unverified=await fixture();const noProof=new PatrimonialHighLevelOwnerProvider({env});assert(Object.values(noProof.capabilities).every(v=>v===false));
  assert.equal((await runPatrimonialOwnerSyncOnce(store,noProof,{env})).state,'HOLD');assert.equal(unverified.state.updates,0);passed.push('C');
  for(const [letter,patch] of [['D',{roles:{locationIds:['other-location']}}],['E',{deleted:true}]]) {
    const f=await fixture();Object.assign(f.state.user,patch);assert.equal((await f.work()).state,'HOLD');assert.equal(f.state.updates,0);passed.push(letter);
  }
  const eligible=await fixture();assert.equal((await eligible.work()).state,'CONFIRMED');assert.equal(eligible.state.updates,1);passed.push('F','G');
  await run(eligible.command);assert.equal((await rows(eligible.intent.id)).length,1);passed.push('H');
  const existing=await fixture({enabled:false});const request={type:'requestOwnerSync',intentId:existing.intent.id,expectedRevision:1,commandKey:'request-existing',actor};
  await run(request);await run(request);await run({...request,commandKey:'request-existing-again'});assert.equal((await rows(existing.intent.id)).length,1);await settle(existing);passed.push('I');
  const isolated=await fixture();assert.equal((await store.claimOperations({now:stamp(),limit:100,kinds:contactEffectKinds})).length,0);passed.push('J');
  const contact={id:randomUUID(),operationKey:'contact-isolation',requestId:isolated.intent.firstRequest.requestId,intentId:isolated.intent.id,kind:'SYNC_REQUEST',technicalState:'SYNC_PENDING',createdAt:stamp(),nextAttemptAt:stamp(),attemptCount:0,leaseToken:null,leaseVersion:0,leaseExpiresAt:null,reconcileRequired:false,lastErrorCode:null};
  await store.enqueueOperation(contact);const ownerClaim=(await store.claimOwnerOperations({now:stamp(),limit:1}))[0];assert.equal(ownerClaim.kind,'ASSIGN_OPPORTUNITY_OWNER');assert.notEqual(ownerClaim.id,contact.id);
  await store.finishOwnerOperation({...claimFor(ownerClaim),outcome:'HOLD',reason:'FIXTURE'});const [contactClaim]=await store.claimOperations({now:stamp(),limit:1,kinds:contactEffectKinds});assert.equal(contactClaim.id,contact.id);await store.completeOperation(claimFor(contactClaim));passed.push('K');
  const stale=await fixture();const other=(await run({type:'createOperator',operator:{operatorKey:'other-owner',displayName:'Synthetic',remoteUserRef:'fixture-other-user'}})).operator;
  await run({type:'reassignProspect',method:'MANUAL',intentId:stale.intent.id,operatorId:other.id,expectedRevision:1});
  const history=await rows(stale.intent.id);assert.equal(history.find(r=>r.record.owner.operatorId===stale.operator.id).record.outcome,'SUPERSEDED');assert.equal(history.filter(r=>r.status==='SYNC_PENDING').length,1);
  stale.state.target='fixture-other-user';stale.state.user.id='fixture-other-user';assert.equal((await stale.work()).state,'CONFIRMED');assert.equal(stale.state.updates,1);
  assert(!stale.state.requests.some(r=>r.path==='/users/fixture-user'));assert.equal((await intentRow(stale.intent.id)).owner_ref,'fixture-other-user');passed.push('L','AC');
  const same=await fixture();same.state.row.assignedTo='fixture-user';assert.equal((await same.work()).state,'CONFIRMED');assert.equal(same.state.updates,0);assert.equal((await intentRow(same.intent.id)).owner_ref,'fixture-user');passed.push('M');
  const empty=await fixture();assert.equal((await empty.work()).state,'CONFIRMED');assert.equal(empty.state.updates,1);passed.push('N');
  const previous=await fixture({owner:'fixture-old-owner'});const before=await intentRow(previous.intent.id);assert.equal((await previous.work()).state,'CONFIRMED');const after=await intentRow(previous.intent.id);assert.equal(previous.state.updates,1);passed.push('O','Q','W');
  assert.equal(after.current_operator_id,before.current_operator_id);assert.equal(after.revision,before.revision);assert.equal(after.stage,before.stage);assert.equal(after.status,before.status);assert.equal(after.owner_checkpoint_revision,1);assert.equal(after.record.ownerId,after.owner_ref);passed.push('X');
  const drift=await fixture();drift.state.row.assignedTo='fixture-human-owner';assert.equal((await drift.work()).reason,'REMOTE_CHANGED');assert.equal(drift.state.updates,0);passed.push('P');
  const failed=await fixture();failed.state.failReadBack=true;assert.equal((await failed.work()).state,'RECONCILE_REQUIRED');assert.equal((await intentRow(failed.intent.id)).owner_ref,null);passed.push('R');
  failed.state.failReadBack=false;assert.equal((await failed.work()).state,'CONFIRMED');assert.equal(failed.state.updates,1);passed.push('T');
  const timeout=await fixture();timeout.state.timeout=true;assert.equal((await timeout.work()).state,'RECONCILE_REQUIRED');assert.equal(timeout.state.updates,1);passed.push('S');
  assert.equal((await timeout.work()).state,'REPLAN');assert.equal(timeout.state.updates,1);timeout.state.timeout=false;assert.equal((await timeout.work()).state,'CONFIRMED');assert.equal(timeout.state.updates,2);passed.push('U');
  const uncertain=await fixture();uncertain.state.timeout=true;assert.equal((await uncertain.work()).state,'RECONCILE_REQUIRED');uncertain.state.row.assignedTo='fixture-human-owner';assert.equal((await uncertain.work()).reason,'REMOTE_CHANGED');assert.equal(uncertain.state.updates,1);passed.push('V');
  const release=await fixture({owner:'fixture-release-owner'});await run({type:'releaseProspect',intentId:release.intent.id,expectedRevision:1,reason:'MANUAL_RELEASE'});assert.equal(release.state.updates,0);assert.equal((await intentRow(release.intent.id)).owner_ref,'fixture-release-owner');assert.equal((await rows(release.intent.id))[0].record.outcome,'SUPERSEDED');
  const user=await eligible.provider.readRemoteUser('fixture-user'),remote=await eligible.provider.getOpportunity(eligible.state.row.id);await assert.rejects(eligible.provider.updateOpportunityOwner(remote,{...user,remoteUserId:''}));passed.push('Y');
  const generic=new PatrimonialHighLevelProvider({env,verifiedLocationId:'fixture-location',capabilities:{opportunitiesRead:true,opportunitiesWrite:true}});
  for(const [method,args] of [['searchOpportunities',[{}]],['createOpportunity',[{}]],['updateOpportunity',['fixture',{}]]]) await assert.rejects(generic[method](...args),e=>e.code==='CONFIG');passed.push('Z');
  const noOwnerEnv=()=>({...env(),PATRIMONIAL_OPPORTUNITY_WRITE_ENABLED:'true',PATRIMONIAL_OWNER_SYNC_ENABLED:'false'});await assert.rejects(generic.updateOpportunity('fixture',{}),e=>e.code==='CONFIG');assert.equal((await runPatrimonialOwnerSyncOnce(store,eligible.provider,{env:noOwnerEnv})).state,'DISABLED');passed.push('AA');
  for(const row of await sql("select record from public.patrimonial_outbox_operations where effect_type='ASSIGN_OPPORTUNITY_OWNER'")) {const text=JSON.stringify(row.record);for(const forbidden of ['NEVER PERSIST','never@example.invalid','displayName','profilePhoto','phone']) assert(!text.includes(forbidden));}passed.push('AB');
  const fenced=await fixture();const [lease]=await store.claimOwnerOperations({now:stamp(),limit:1});assert.equal((await store.claimOwnerOperations({now:stamp(),limit:1})).length,0);
  await sql("update public.patrimonial_outbox_operations set lease_expires_at=clock_timestamp()-interval '1 second' where id=$1",[lease.id]);
  const [successor]=await store.claimOwnerOperations({now:stamp(),limit:1});assert(successor.leaseVersion>lease.leaseVersion);assert.equal(successor.reconcileRequired,true);
  await assert.rejects(store.authorizeOwnerWrite(claimFor(lease)),PatrimonialStaleLeaseError);await store.finishOwnerOperation({...claimFor(successor),outcome:'HOLD',reason:'FIXTURE_FENCED'});assert.equal(fenced.state.updates,0);passed.push('AD');
  const mid=await fixture();let active=true;mid.state.afterUser=()=>{active=false;};assert.equal((await mid.work({env:()=>({...env(),PATRIMONIAL_OWNER_SYNC_ENABLED:String(active)})})).state,'HOLD');assert.equal(mid.state.updates,0);passed.push('AE');
  const concurrent=await fixture();const workers=await Promise.all([concurrent.work(),concurrent.work()]);assert.equal(workers.filter(r=>r.state==='CONFIRMED').length,1);assert.equal(workers.filter(r=>r.state==='IDLE').length,1);assert.equal(concurrent.state.updates,1);
  // Decoder distinctions, exact identity and runtime availability, beyond A–AE.
  for(const patch of [{assignedTo:''},{locationId:'other-location'},{contactId:'other-contact'},{pipelineId:'other-pipeline'}]) {
    const f=await fixture();Object.assign(f.state.row,patch);assert.equal((await f.work()).state,'HOLD');assert.equal(f.state.updates,0);
  }
  // JSON cannot carry undefined: Response.json serializes it as an omitted key.
  const undefinedWire=await fixture();undefinedWire.state.row.assignedTo=undefined;assert.equal((await undefinedWire.work()).state,'CONFIRMED');assert.equal(undefinedWire.state.updates,1);
  const omitted=await fixture();delete omitted.state.row.assignedTo;assert.equal((await omitted.work()).state,'CONFIRMED');assert.equal(omitted.state.updates,1);
  const missingContract=await fixture();delete missingContract.state.row.assignedTo;
  const noOmissionProof=new PatrimonialHighLevelOwnerProvider({env:missingContract.selectedEnv,proof:{...proof,omittedAssignedToMeansUnassigned:false},fetchImpl:async()=>Response.json({opportunity:missingContract.state.row})});
  await assert.rejects(noOmissionProof.getOpportunity(missingContract.state.row.id),e=>e.code==='SCHEMA');
  // A direct decoder assertion does not consume its queued fixture operation.
  // Settle it before the next worker scenario, so that scenario tests its own intent.
  await settle(missingContract);
  const missing=await fixture({remote:false});assert.equal((await missing.work()).reason,'OPPORTUNITY_NOT_READY');assert.equal(missing.state.requests.length,0);
  const unknown=await fixture();delete unknown.state.user.deleted;assert.equal((await unknown.work()).state,'HOLD');assert.equal(unknown.state.updates,0);
  const recovered=await fixture();recovered.state.user.deleted=true;assert.equal((await recovered.work()).state,'HOLD');recovered.state.user.deleted=false;
  await run({type:'requestOwnerSync',intentId:recovered.intent.id,expectedRevision:1,commandKey:'recover-current-owner',actor});assert.equal((await recovered.work()).state,'CONFIRMED');assert.equal((await rows(recovered.intent.id)).length,1);
  const mappedLater=await fixture({mapping:null});await run({type:'updateOperator',operatorId:mappedLater.operator.id,expectedRevision:0,patch:{remoteUserRef:'fixture-later-user'}});
  mappedLater.state.target='fixture-later-user';mappedLater.state.user.id='fixture-later-user';await run({type:'requestOwnerSync',intentId:mappedLater.intent.id,expectedRevision:1,commandKey:'mapping-later',actor});assert.equal((await mappedLater.work()).state,'CONFIRMED');
  const staleBusiness={...after.record,ownerId:'fixture-stale-owner',revision:after.revision+1};await assert.rejects(store.transaction(tx=>tx.saveOpportunityIntent(staleBusiness,after.revision)),PatrimonialConflictError);assert.equal((await intentRow(previous.intent.id)).owner_ref,'fixture-user');
  const badEvidence=await fixture();const [badClaim]=await store.claimOwnerOperations({now:stamp(),limit:1});const badObservation=await badEvidence.provider.getOpportunity(badEvidence.state.row.id);
  await assert.rejects(store.finishOwnerOperation({...claimFor(badClaim),outcome:'CONFIRMED',reason:'FIXTURE_BAD_PROOF',observation:{...badObservation,assignedTo:'fixture-wrong-target'}}),PatrimonialConflictError);
  assert.equal((await intentRow(badEvidence.intent.id)).owner_ref,null);await store.finishOwnerOperation({...claimFor(badClaim),outcome:'HOLD',reason:'FIXTURE_FINISH'});
  assert.equal(resolveOwnerUserMapping(null,null,'fixture-location'),'UNMAPPED');assert.equal(resolveOwnerUserMapping('fixture-user',null,'fixture-location'),'MAPPED_UNVERIFIED');assert.equal(resolveOwnerUserMapping('fixture-user',await eligible.provider.readRemoteUser('fixture-user'),'fixture-location'),'MAPPED_VERIFIED');
  const readOnlyBinding=new PatrimonialHighLevelOwnerProvider({env,proof:{...proof,nullableAssignedTo:false},fetchImpl:async()=>Response.json({opportunity:{...eligible.state.row,assignedTo:null}})});await assert.rejects(readOnlyBinding.getOpportunity(eligible.state.row.id),e=>e.code==='SCHEMA');
  const late=await fixture();late.state.afterUser=async()=>{if(late.state.users===2) await run({type:'reassignProspect',method:'MANUAL',intentId:late.intent.id,operatorId:other.id,expectedRevision:1});};assert.notEqual((await late.work()).state,'CONFIRMED');assert.equal(late.state.updates,0);await settle(late);
  assert(Object.values(patrimonialFlags({})).every(v=>v===false));assert.equal(externalAttempts,0);
  const protectedPaths=['src/app','src/components','src/content','public','src/lib/public-leads/patrimonial-highlevel.ts','src/lib/public-leads/patrimonial-owner-readiness.ts','src/lib/public-leads/patrimonial-contract.ts','src/lib/public-leads/patrimonial-routing.ts','supabase/migrations/20261014225059_patrimonial_lead_v2.sql','supabase/migrations/20261015100912_patrimonial_opportunity_jsonb_precedence.sql','supabase/migrations/20261018094926_patrimonial_assignment_management.sql'];
  assertPublicPilotPreservation('33724abcfc04ebf6b073f14cf5039948a83a4cb4',protectedPaths);
  const migration=await readFile(new URL('../supabase/migrations/20261018163245_patrimonial_owner_sync.sql',import.meta.url),'utf8');assert(!/security definer/i.test(migration));
  for(const role of ['anon','authenticated']) await assert.rejects(db.transaction(async tx=>{await tx.exec(`set local role ${role}`);await tx.query('select public.patrimonial_owner_context($1::jsonb)',['{}']);}),e=>e.code==='42501');
  const functions=await sql("select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'patrimonial_owner_%'");
  for(const f of functions) for(const role of ['anon','authenticated']) assert.equal((await sql('select has_function_privilege($1,$2,\'execute\') allowed',[role,f.signature]))[0].allowed,false);
  for(const table of ['patrimonial_intents','patrimonial_outbox_operations']) {const [security]=await sql('select relrowsecurity,relforcerowsecurity from pg_class where oid=$1::regclass',[`public.${table}`]);assert.equal(security.relrowsecurity,true);assert.equal(security.relforcerowsecurity,true);}
  assert.equal(new Set(passed).size,31);console.log('PASS owner-sync A–AE:',[...new Set(passed)].sort().join(', '));console.log('PASS actual five-migration SQL, production RPC adapter, HTTP payload/decoder, fencing, ACL, protected paths; external requests: 0');
} finally {await db.close();}
