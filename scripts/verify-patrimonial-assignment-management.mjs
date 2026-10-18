import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { executePatrimonialAssignment, resolveRemoteOwner } from '../src/lib/public-leads/patrimonial-assignments.ts';
import { SupabasePatrimonialStore } from '../src/lib/public-leads/patrimonial-supabase.ts';
import { patrimonialFlags, PatrimonialConflictError, PatrimonialStoreUnavailableError } from '../src/lib/public-leads/patrimonial-store.ts';
import { receivePatrimonialOpportunity, applyPatrimonialCommand } from '../src/lib/public-leads/patrimonial-routing.ts';

// Actual PostgreSQL constraints/functions in an ephemeral WASM database. No URL,
// credentials, remote database, provider or mock-only production repository.
let externalAttempts=0;
globalThis.fetch=async()=>{externalAttempts++;throw new Error('Network forbidden in assignment verifier');};
const db=new PGlite();
const passed=[];
const now='2026-10-18T10:00:00.000Z';
const actor={type:'ADMIN',ref:'fixture-admin'};
const env=()=>({PATRIMONIAL_ASSIGNMENTS_ENABLED:'true'});
let counter=0,loseAck=false,snapshotConflicts=0;
const requests=[];
const sql=async(query,args=[]) => (await db.query(query,args)).rows;
const fetchImpl=async(url,init)=>{
  assert.equal(new URL(url).origin,'https://assignment.invalid');
  assert.equal(init.method,'POST');
  const name=new URL(url).pathname.split('/').at(-1), body=JSON.parse(init.body);
  requests.push(name);
  assert(['patrimonial_store_health','patrimonial_store_transaction'].includes(name));
  try {
    const result=await db.transaction(async tx=>{
      await tx.exec('set local role service_role');
      const query=name==='patrimonial_store_health'
        ? await tx.query('select public.patrimonial_store_health() as result')
        : await tx.query('select public.patrimonial_store_transaction($1::jsonb,$2::jsonb,$3::boolean) as result',[JSON.stringify(body.p_commands),JSON.stringify(body.p_expected),body.p_preview]);
      return query.rows[0].result;
    });
    if(loseAck && body.p_preview===false && body.p_commands.some(c=>c.method==='commitAssignmentPlan')) {loseAck=false;throw new TypeError('Lost ACK after local commit');}
    return Response.json(result);
  } catch(error) {
    if(error instanceof TypeError) throw error;
    if(error.message==='PATRIMONIAL_SNAPSHOT_CHANGED') snapshotConflicts++;
    if(error.code!=='PT409' && error.code!=='23505' && error.message!=='Unknown assignment write') console.error('SQL fixture failure:',error.code,error.message,error.where);
    return Response.json({code:error.code==='23505'?'PT409':error.code,message:error.code==='23505'?'PATRIMONIAL_CONFLICT':error.message},{status:['PT409','23505'].includes(error.code)?409:500});
  }
};
const makeStore=()=>new SupabasePatrimonialStore({url:'https://assignment.invalid',serviceRoleKey:'fixture-service-role',fetchImpl});
const store=makeStore();
const run=(command,options={})=>executePatrimonialAssignment(store,{commandKey:`fixture-${++counter}`,actor,...command},{env,now:()=>new Date(now),...options});
const context=(ids=[],experiment=null)=>store.transaction(tx=>tx.getAssignmentContext('fixture-inspect',ids,experiment));
const assignment=(intentId,operatorId,extra={})=>({type:'assignProspect',method:'MANUAL',intentId,operatorId,expectedRevision:0,...extra});
const counts=rows=>Object.values(rows.reduce((out,a)=>{out[a.operatorId]=(out[a.operatorId]??0)+1;return out;},{})).sort((a,b)=>a-b);
async function seed({profile='',source=null,campaign=null,owner='fixture-remote-owner',funnel='architect-path'}={}) {
  const requestId=randomUUID(),utm={...(source?{utm_source:source}:{}),...(campaign?{utm_campaign:campaign}:{})};
  const record={id:requestId,contractVersion:'patrimonial-lead-v2',payloadHash:'a'.repeat(64),payload:{profile,utm,
    firstName:'Synthetic',lastName:'Fixture',email:'fixture@example.invalid',phone:'+390000000000',address:'synthetic',
    message:'Maturity: 4; consultation requested: yes; free text must never be parsed'}};
  await sql(`insert into public.patrimonial_requests(request_id,contract_version,mode,payload_hash,source_path,received_at,status,receipt_status,crm_status,record,expires_at)
    values($1,'patrimonial-lead-v2',$2,$3,'/fixture',$4,'RECEIVED','received','pending',$5::jsonb,'2026-11-01')`,[requestId,funnel,'a'.repeat(64),now,JSON.stringify(record)]);
  const intent=await receivePatrimonialOpportunity(store,{
    pipeline:funnel==='architect-path'?'ARCHITECT_PATH':'PATRIMONIAL_EVENT',
    contact:{id:`fixture-contact-${++counter}`,locationId:'fixture-location',identityResolved:true},scopeKey:`fixture-scope-${counter}`,
    request:{requestId,receivedAt:now,source:'website-pilot',sourcePath:'/fixture',privacyVersion:'fixture-v1',marketingConsent:false,utm},
    actor:{id:'fixture-system',type:'SYSTEM'},nextStepAt:'2026-10-19T10:00:00.000Z',...(owner===null?{}:{ownerId:owner}),
    ...(funnel==='patrimonial-event'?{eventSlug:'fixture-event'}:{}),
  });
  return intent;
}
async function createExperiment(operatorIds,{poolId,method='BALANCED_BATCH',targetPerOperator}={}) {
  let {experiment}=await run({type:'createAssignmentExperiment',experimentKey:`fixture-exp-${++counter}`,name:'Fixture experiment',method,...(poolId?{poolId}:{}),...(targetPerOperator?{targetPerOperator}:{})});
  ({experiment}=await run({type:'setExperimentOperators',experimentId:experiment.id,expectedRevision:experiment.revision,operatorIds}));
  ({experiment}=await run({type:'activateAssignmentExperiment',experimentId:experiment.id,expectedRevision:experiment.revision}));
  return experiment;
}
try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;');
  for(const name of ['20261014225059_patrimonial_lead_v2.sql','20261015100912_patrimonial_opportunity_jsonb_precedence.sql','20261018094926_patrimonial_assignment_management.sql']) await db.exec(await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8'));
  passed.push('local SQL: all three migrations compile and execute; real service_role journal');
  assert(Object.values(patrimonialFlags({})).every(value=>value===false));
  let forbiddenStore=0;
  await assert.rejects(executePatrimonialAssignment({transaction(){forbiddenStore++;}}, {type:'createOperator',commandKey:'disabled',actor,operator:{operatorKey:'disabled',displayName:'Disabled'}},{env:()=>({})}),e=>e.code==='DISABLED');
  assert.equal(forbiddenStore,0);

  const operators=[];
  for(let i=0;i<25;i++) operators.push((await run({type:'createOperator',operator:{operatorKey:`operator-${String(i).padStart(4,'0')}`,displayName:`Fixture operator ${25-i}`,sortOrder:0,...(i===24?{remoteUserRef:'fixture-mapped-user'}:{})}})).operator);
  assert.equal((await context()).operators.length,25);passed.push('A: 25 operators; dynamic registry; no schema change');
  const ids=operators.slice(0,3).map(o=>o.id);
  let {pool}=await run({type:'createPool',poolKey:'fixture-pool',name:'Fixture pool'});
  ({pool}=await run({type:'setPoolMembership',poolId:pool.id,expectedRevision:0,operatorIds:ids}));
  await run({type:'deactivateOperator',operatorId:operators[3].id,expectedRevision:0});
  const inactive=await seed();
  await assert.rejects(run(assignment(inactive.id,operators[3].id)),e=>e.code==='NO_ELIGIBLE_OPERATOR');
  passed.push('B: inactive operator excluded; history retained');
  const rr=[];
  for(let i=0;i<9;i++) {
    const lead=await seed();
    // Fresh store instances prove the cursor is in PostgreSQL, not service memory.
    const result=await executePatrimonialAssignment(makeStore(),{type:'assignProspect',method:'ROUND_ROBIN',poolId:pool.id,intentId:lead.id,expectedRevision:0,commandKey:`rr-${i}`,actor:{type:'WORKER',ref:'fixture-worker'}},{env,now:()=>new Date(now)});
    rr.push(...result.assignments);
  }
  assert.deepEqual(counts(rr),[3,3,3]);assert.deepEqual(rr.slice(0,3).map(a=>a.operatorId),ids);passed.push('C: persisted ROUND_ROBIN 9/3 = 3/3/3, stable key order');

  const capped=operators[4];
  await run({type:'updateOperator',operatorId:capped.id,expectedRevision:0,patch:{capacity:2}});
  let {pool:capPool}=await run({type:'createPool',poolKey:'fixture-capacity',name:'Fixture capacity'});
  ({pool:capPool}=await run({type:'setPoolMembership',poolId:capPool.id,expectedRevision:0,operatorIds:[capped.id]}));
  for(let i=0;i<2;i++) await run({type:'assignProspect',method:'ROUND_ROBIN',poolId:capPool.id,intentId:(await seed()).id,expectedRevision:0});
  const third=await seed();
  await assert.rejects(run({type:'assignProspect',method:'ROUND_ROBIN',poolId:capPool.id,intentId:third.id,expectedRevision:0}),e=>e.code==='NO_ELIGIBLE_OPERATOR');
  await assert.rejects(run(assignment(third.id,capped.id)),e=>e.code==='CAPACITY');
  const override=await run(assignment(third.id,capped.id,{overrideCapacity:true}));assert.equal(override.assignments[0].metadata.reasonCode,'capacity-override');
  passed.push('D/E: capacity 2 refuses third auto/manual; explicit ADMIN MANUAL override audited');
  const manualLead=await seed(),manualCommand={...assignment(manualLead.id,ids[0]),commandKey:'manual-replay'};
  const first=await run(manualCommand);
  assert.equal(first.assignments[0].operatorId,ids[0]);
  await assert.rejects(run({...manualCommand,commandKey:'different-command',expectedRevision:1}),e=>e.code==='NOT_ASSIGNABLE');
  const snapshot=first.assignments[0].qualitySnapshotId;
  const row=(await sql('select * from public.patrimonial_assignments where id=$1',[first.assignments[0].id]))[0];
  // Actual SQL unique index, not only the service check.
  await assert.rejects(sql('insert into public.patrimonial_assignments select (jsonb_populate_record(null::public.patrimonial_assignments,$1::jsonb)).*',[JSON.stringify({...row,id:randomUUID(),assignment_key:'duplicate-active'})]),e=>e.code==='23505');
  passed.push('F: duplicate active assignment refused in domain and SQL');
  assert.deepEqual(await run(manualCommand),first);
  await assert.rejects(run({...manualCommand,operatorId:ids[1]}),PatrimonialConflictError);
  passed.push('I/J: identical command replay; changed payload under same key conflicts');
  const beforeOwner=(await context([manualLead.id])).intents[0];
  const next=await run({type:'reassignProspect',method:'MANUAL',intentId:manualLead.id,operatorId:ids[1],expectedRevision:1});
  let history=await sql('select * from public.patrimonial_assignments where intent_id=$1 order by revision desc',[manualLead.id]);
  assert.equal(history.length,2);assert.equal(history.filter(a=>a.released_at===null).length,1);assert.equal(history.find(a=>a.id===row.id).release_reason,'REASSIGNED');
  assert.equal((await context([manualLead.id])).intents[0].currentOperatorId,ids[1]);passed.push('G: atomic reassignment preserves closed history and successor snapshot');
  await run({type:'releaseProspect',intentId:manualLead.id,expectedRevision:2,reason:'MANUAL_RELEASE'});
  const afterOwner=(await context([manualLead.id])).intents[0];
  assert.equal(afterOwner.currentOperatorId,null);assert.equal(afterOwner.ownerRef,beforeOwner.ownerRef);assert.equal(afterOwner.revision,beforeOwner.revision);
  assert.equal((await sql('select count(*)::int as n from public.patrimonial_assignments where intent_id=$1 and released_at is null',[manualLead.id]))[0].n,0);passed.push('H: release clears internal projection only, frees capacity');
  assert.equal(next.remoteOwnerState,'REMOTE_OWNER_UNMAPPED');

  const race=await seed();
  const contenders=await Promise.allSettled([run(assignment(race.id,ids[0])),run(assignment(race.id,ids[1]))]);
  assert.equal(contenders.filter(r=>r.status==='fulfilled').length,1);assert(contenders.find(r=>r.status==='rejected').reason instanceof PatrimonialConflictError);
  assert(snapshotConflicts>0,'interleaved previews must exercise the real journal snapshot retry');
  assert.equal((await context([race.id])).assignments.filter(a=>a.intentId===race.id&&a.releasedAt===null).length,1);
  passed.push('K: concurrent same-intent commands: single winner, no double owner');

  const balancedExperiment=await createExperiment(ids,{poolId:pool.id,targetPerOperator:10});
  const batch=[];
  // Real domain UUIDs vary between runs. Populate the synthetic categorical
  // fixture in UUID order BEFORE assignment so this outcome assertion is repeatable.
  for(let i=0;i<30;i++) batch.push(await seed({profile:i%2?'Privato':'Professionista',source:`source-${i%3}`,campaign:`campaign-${i%2}`}));
  const sortedBatch=[...batch].sort((a,b)=>a.id.localeCompare(b.id));
  for(const [index,lead] of sortedBatch.entries()) {
    // Three repeating categories would be completely segregated by simple RR:
    // 10/0/0 each. Balanced must use categories, not just total cohort counts.
    const utm={utm_source:`source-${index%3}`,utm_campaign:`campaign-${index%3}`};
    await sql(`update public.patrimonial_requests set record=jsonb_set(jsonb_set(record,'{payload,profile}',$2::jsonb),'{payload,utm}',$3::jsonb) where request_id=$1`,[lead.firstRequest.requestId,JSON.stringify(['Privato','Professionista','Imprenditore'][index%3]),JSON.stringify(utm)]);
    await sql(`update public.patrimonial_intents set record=jsonb_set(record,'{firstRequest,utm}',$2::jsonb) where id=$1`,[lead.id,JSON.stringify(utm)]);
  }
  const balanced=await run({type:'assignBalancedBatch',poolId:pool.id,experimentId:balancedExperiment.id,leads:batch.map(l=>({intentId:l.id,expectedRevision:0}))});
  assert.deepEqual(counts(balanced.assignments),[10,10,10]);passed.push('L: BALANCED_BATCH 30/3 = 10/10/10');
  const state=await context([],balancedExperiment.id);
  for(const dim of ['profile','source']) {
    const categories=[...new Set(state.snapshots.filter(s=>balanced.assignments.some(a=>a.qualitySnapshotId===s.id)).map(s=>s[dim]))];
    for(const category of categories) {
      const distribution=ids.map(id=>balanced.assignments.filter(a=>a.operatorId===id&&state.snapshots.find(s=>s.id===a.qualitySnapshotId)?.[dim]===category).length);
      assert(Math.max(...distribution)-Math.min(...distribution)<=2,`${dim}: bounded marginal imbalance`);
    }
  }
  passed.push('M: three categorical profiles/sources balanced (spread <=2; simple RR would segregate 10/0/0)');
  const missing=await seed();const missingResult=await run({type:'assignBalancedBatch',leads:[{intentId:missing.id,expectedRevision:0}]});assert.equal(missingResult.assignments.length,1);
  const quality=(await sql('select * from public.patrimonial_lead_snapshots where id=$1',[missingResult.assignments[0].qualitySnapshotId]))[0];
  assert.equal(quality.maturity_level,null);assert.equal(quality.consultation_requested,null);assert.equal(quality.campaign,null);passed.push('N: missing dimensions ignored, qualification NULL, message never parsed');
  for(const number of [10,25]) {
    const participantIds=operators.slice(0,number).map(o=>o.id);
    // Re-enable previously deactivated fixture; no historic deletion.
    if(number===10) await run({type:'updateOperator',operatorId:operators[3].id,expectedRevision:1,patch:{active:true}});
    const experiment=await createExperiment(participantIds);
    assert.equal((await context([],experiment.id)).experimentOperators.filter(m=>m.experimentId===experiment.id).length,number);
    await assert.rejects(run({type:'setExperimentOperators',experimentId:experiment.id,expectedRevision:experiment.revision,operatorIds:ids}),e=>e.code==='EXPERIMENT_STATE');
    await assert.rejects(sql('update public.patrimonial_assignment_experiment_operators set included=false where experiment_id=$1',[experiment.id]),e=>e.code==='PT409');
    let paused=(await run({type:'pauseAssignmentExperiment',experimentId:experiment.id,expectedRevision:experiment.revision})).experiment;
    await assert.rejects(run({type:'assignBalancedBatch',experimentId:experiment.id,leads:[{intentId:(await seed()).id,expectedRevision:0}]}),e=>e.code==='EXPERIMENT_STATE');
    ({experiment:paused}=await run({type:'activateAssignmentExperiment',experimentId:experiment.id,expectedRevision:paused.revision}));
    await run({type:'completeAssignmentExperiment',experimentId:experiment.id,expectedRevision:paused.revision});
    passed.push(`${number===10?'O':'P'}: ${number} frozen experiment participants; pause/resume/complete`);
  }
  assert.equal(resolveRemoteOwner(operators[0]),null);assert.equal(resolveRemoteOwner(operators[24]),'fixture-mapped-user');
  const mappedLead=await seed();const mapped=await run(assignment(mappedLead.id,operators[24].id),{env:()=>({PATRIMONIAL_ASSIGNMENTS_ENABLED:'true',PATRIMONIAL_OWNER_SYNC_ENABLED:'true'})});
  assert.equal(mapped.remoteOwnerState,'REMOTE_OWNER_SYNC_DISABLED');assert.equal((await context([mappedLead.id])).intents[0].ownerRef,'fixture-remote-owner');
  assert.equal(mapped.assignmentStates[mapped.assignments[0].id].remoteOwnerState,'REMOTE_OWNER_SYNC_DISABLED');
  const noRemoteOwner=await seed({owner:null});
  await run(assignment(noRemoteOwner.id,ids[0]));
  assert.equal((await context([noRemoteOwner.id])).intents[0].ownerRef,null);
  await run({type:'reassignProspect',method:'MANUAL',intentId:noRemoteOwner.id,operatorId:operators[24].id,expectedRevision:1});
  assert.equal((await context([noRemoteOwner.id])).intents[0].ownerRef,null);
  passed.push('Q: unmapped valid LOCAL_ASSIGNED / REMOTE_OWNER_UNMAPPED; mapped still sync-disabled');
  const remoteRows=await sql('select owner_ref,record,current_operator_id from public.patrimonial_intents');
  assert(remoteRows.every(r=>(r.owner_ref===null||r.owner_ref==='fixture-remote-owner') && r.record.ownerId===r.owner_ref && (r.current_operator_id===null||r.owner_ref!==r.current_operator_id)));
  assert.equal((await sql('select count(*)::int as n from public.patrimonial_outbox_operations'))[0].n,0);
  const sync=await readFile(new URL('../src/lib/public-leads/patrimonial-sync.ts',import.meta.url),'utf8');assert(sync.includes('assignedTo: intent.ownerId'));assert(!sync.includes('currentOperatorId'));
  passed.push('R/S: every owner_ref + legacy ownerId unchanged; no local UUID to assignedTo; zero owner outbox effects');
  for(const s of await sql('select * from public.patrimonial_lead_snapshots')) {
    for(const name of ['firstName','lastName','first_name','last_name','email','phone','address','message']) assert(!Object.hasOwn(s,name));
    assert(!JSON.stringify(s).includes('fixture@example.invalid'));assert.deepEqual(s.attributes,{});
  }
  passed.push('T: strict snapshot allowlist, no direct PII/message, NULL unavailable qualification');

  // Extra transactional and storage defenses.
  await assert.rejects(sql('update public.patrimonial_intents set current_operator_id=null where id=$1',[missing.id]),e=>e.code==='PT409');
  await assert.rejects(sql('update public.patrimonial_lead_snapshots set profile=$1 where id=$2',['changed',snapshot]),e=>e.code==='PT409');
  await assert.rejects(sql('update public.patrimonial_operators set operator_key=$1,revision=revision+1 where id=$2',['renamed',ids[0]]),e=>e.code==='PT409');
  const capacityOne=operators[5];await run({type:'updateOperator',operatorId:capacityOne.id,expectedRevision:0,patch:{capacity:1}});
  const capRaceLeads=[await seed(),await seed()];
  const capRace=await Promise.allSettled(capRaceLeads.map(lead=>run(assignment(lead.id,capacityOne.id))));
  assert.equal(capRace.filter(r=>r.status==='fulfilled').length,1);assert.equal((await context()).assignments.filter(a=>a.operatorId===capacityOne.id&&a.releasedAt===null).length,1);
  const ambiguous=await seed();const ackCommand={...assignment(ambiguous.id,ids[0]),commandKey:'lost-ack'};loseAck=true;
  await assert.rejects(run(ackCommand),PatrimonialStoreUnavailableError);const recovered=await run(ackCommand);assert.equal(recovered.assignments.length,1);
  assert.equal((await sql('select count(*)::int as n from public.patrimonial_assignments where command_key=$1',['lost-ack']))[0].n,1);
  const beforeRollback=(await context()).revision;
  const disabledMidFlight=await seed();let flagReads=0;
  await assert.rejects(run(assignment(disabledMidFlight.id,ids[0]),{env:()=>({PATRIMONIAL_ASSIGNMENTS_ENABLED:++flagReads<3?'true':'false'})}),e=>e.code==='DISABLED');
  assert.equal((await context([disabledMidFlight.id])).intents[0].currentOperatorId,null);
  await assert.rejects(store.transaction(async tx=>{
    await tx.getAssignmentContext('rollback',[],null);
    await tx.commitAssignmentPlan({commandKey:'rollback',payloadHash:'b'.repeat(64),at:now,result:{},writes:[{kind:'cursor',value:{scope:'rollback',operatorId:ids[0]}},{kind:'unknown',value:{}}]},beforeRollback);
  }),PatrimonialStoreUnavailableError);
  assert.equal((await sql("select count(*)::int as n from public.patrimonial_assignment_cursors where scope='rollback'"))[0].n,0);assert.equal((await context()).revision,beforeRollback);
  // Existing lifecycle changes do not erase assignments or alter their revision.
  const closed=await seed();await run(assignment(closed.id,ids[0]));
  await applyPatrimonialCommand(store,closed.id,{type:'ARCHITECT_CLOSED',expectedRevision:closed.revision,actor:{id:'fixture-owner',type:'OWNER'},at:now,reason:'NOT_INTERESTED',evidenceId:'fixture-close-evidence'});
  await run({type:'releaseProspect',intentId:closed.id,expectedRevision:1,reason:'INTENT_CLOSED'});
  await assert.rejects(run(assignment(closed.id,ids[0],{expectedRevision:2})),e=>e.code==='NOT_ASSIGNABLE');
  // A release does not replenish the experiment target (all historic entrants count).
  const assigned=balanced.assignments[0];await run({type:'releaseProspect',intentId:assigned.intentId,expectedRevision:1,reason:'MANUAL_RELEASE'});
  await assert.rejects(run({type:'assignBalancedBatch',poolId:pool.id,experimentId:balancedExperiment.id,leads:[{intentId:(await seed()).id,expectedRevision:0}]}),e=>e.code==='NO_ELIGIBLE_OPERATOR');
  for(const role of ['anon','authenticated']) await assert.rejects(db.transaction(async tx=>{await tx.exec(`set local role ${role}`);await tx.query('select * from public.patrimonial_operators');}),e=>e.code==='42501');
  for(const role of ['anon','authenticated']) await assert.rejects(db.transaction(async tx=>{await tx.exec(`set local role ${role}`);await tx.query("select public.patrimonial_assignment_context('test','[]',null)");}),e=>e.code==='42501');
  const acl=await sql("select relname,relrowsecurity,relforcerowsecurity from pg_class where relname in ('patrimonial_operators','patrimonial_assignments','patrimonial_lead_snapshots')");assert(acl.every(t=>t.relrowsecurity&&t.relforcerowsecurity));
  passed.push('extras: DB projection/history/ACL/RLS; concurrent capacity; rollback; lost ACK replay; mid-flight kill switch; closed-intent release; experiment historic target');

  // Public contracts, both funnels, assets and applied migrations remain byte-identical.
  const baseline='88fafcba8811e4a02b3575e2e2cd36368b818be8';
  const protectedPaths=['src/app',':(glob)src/components/patrimonial*','src/content','public','scripts/verify-patrimonial-event-browser.mjs','scripts/verify-patrimonial-architect-browser.mjs','scripts/verify-patrimonial-event-presentation.mjs','scripts/verify-patrimonial-architect-presentation.mjs','src/lib/public-leads/patrimonial-contract.ts','src/lib/public-leads/patrimonial-funnels.ts','src/lib/public-leads/patrimonial-sync.ts','src/lib/public-leads/patrimonial-routing.ts','supabase/migrations/20261014225059_patrimonial_lead_v2.sql','supabase/migrations/20261015100912_patrimonial_opportunity_jsonb_precedence.sql'];
  const diff=execFileSync('git',['diff',baseline,'--',...protectedPaths],{encoding:'utf8'});assert.equal(diff,'');
  assert.equal(externalAttempts,0);assert(requests.length>0);
  passed.push('protected baseline byte-identical; v2/sync/funnels/assets unchanged; flags default false; zero external calls');
  console.log(passed.map(message=>`PASS ${message}`).join('\n'));
} finally {await db.close();}
