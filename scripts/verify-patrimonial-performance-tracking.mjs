import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { executePatrimonialAssignment } from '../src/lib/public-leads/patrimonial-assignments.ts';
import { SupabasePatrimonialStore } from '../src/lib/public-leads/patrimonial-supabase.ts';
import {
  recordPatrimonialPerformanceEvent, makePatrimonialPerformanceEvent, patrimonialHighLevelPerformanceReadiness,
} from '../src/lib/public-leads/patrimonial-performance.ts';
import { PatrimonialConflictError } from '../src/lib/public-leads/patrimonial-store.ts';
import { db,sql,seed,env as baseEnv,actor,setup,externalAttempts } from './patrimonial-owner-test-fixture.mjs';

await setup();
await db.exec(await readFile(new URL('../supabase/migrations/20261018224500_patrimonial_performance_tracking.sql',import.meta.url),'utf8'));

let performanceCalls=0;
const fetchImpl=async(url,init)=>{
  assert.equal(new URL(url).origin,'https://performance.invalid');
  assert.equal(init.method,'POST');
  const name=new URL(url).pathname.split('/').at(-1), body=JSON.parse(init.body);
  if(name.startsWith('patrimonial_performance') || name==='patrimonial_record_performance_event') performanceCalls++;
  try {
    const result=await db.transaction(async tx=>{
      await tx.exec('set local role service_role');
      if(name==='patrimonial_store_health') return (await tx.query('select public.patrimonial_store_health() as result')).rows[0].result;
      if(name==='patrimonial_store_capabilities') return (await tx.query('select public.patrimonial_store_capabilities() as result')).rows[0].result;
      if(name==='patrimonial_performance_capabilities') return (await tx.query('select public.patrimonial_performance_capabilities() as result')).rows[0].result;
      if(name==='patrimonial_record_performance_event') return (await tx.query('select public.patrimonial_record_performance_event($1::jsonb) as result',[JSON.stringify(body.p_event)])).rows[0].result;
      if(name==='patrimonial_performance_resolve') return (await tx.query('select public.patrimonial_performance_resolve($1,$2::timestamptz) as result',[body.p_remote_opportunity_id,body.p_occurred_at])).rows[0].result;
      if(name==='patrimonial_store_transaction') return (await tx.query('select public.patrimonial_store_transaction($1::jsonb,$2::jsonb,$3::boolean) as result',[JSON.stringify(body.p_commands),JSON.stringify(body.p_expected),body.p_preview])).rows[0].result;
      throw new Error('unexpected rpc '+name);
    });
    return Response.json(result);
  } catch(error) {
    return Response.json({code:error.code,message:error.message},{status:error.code==='PT409'?409:500});
  }
};
const store=new SupabasePatrimonialStore({url:'https://performance.invalid',serviceRoleKey:'fixture-service-role',fetchImpl});
const enabledEnv=()=>({...baseEnv(),PATRIMONIAL_OWNER_SYNC_ENABLED:'false',PATRIMONIAL_PERFORMANCE_TRACKING_ENABLED:'true'});
const at=(minutes)=>new Date(Date.parse('2026-10-18T10:00:00.000Z')+minutes*60_000).toISOString();

await store.performanceHealth();
const capability=(await sql('select public.patrimonial_performance_capabilities() result'))[0].result;
assert.deepEqual(capability,{contract:'patrimonial-performance-capabilities-v1',performanceTracking:'p3-v1'});

const intent=await seed({owner:null});
const remoteId='fixture-performance-opportunity';
const remote={id:remoteId,syncedRevision:intent.revision,pipelineId:'N2hsjiShcdMbzAITjxOA',stageId:'stage-a',status:'open',version:'v1',assignedTo:null};
await sql("update public.patrimonial_intents set remote_opportunity_id=$2,record=jsonb_set(record,'{remote}',$3::jsonb) where id=$1",[intent.id,remoteId,JSON.stringify(remote)]);

const createOperator=async(key,remoteRef,minute)=>{
  const result=await executePatrimonialAssignment(store,{
    type:'createOperator',commandKey:'perf-'+key,actor,
    operator:{operatorKey:key,displayName:'Synthetic '+key,remoteUserRef:remoteRef},
  },{env:enabledEnv,now:()=>new Date(at(minute))});
  assert(result.operator); return result.operator;
};
const op1=await createOperator('perf-op-1','remote-user-1',0);
const op2=await createOperator('perf-op-2','remote-user-2',0);

const firstAssign=await executePatrimonialAssignment(store,{
  type:'assignProspect',commandKey:'perf-assign-1',actor,method:'MANUAL',intentId:intent.id,expectedRevision:0,operatorId:op1.id,
},{env:enabledEnv,now:()=>new Date(at(1))});
const a1=firstAssign.assignments?.[0]; assert(a1);

const base={intentId:intent.id,assignmentId:a1.id,operatorId:op1.id,recordedByType:'WORKER',recordedByRef:'fixture-worker'};
const ownership={...base,eventKey:'perf:ownership:1',eventType:'OWNERSHIP_TAKEN',occurredAt:at(2),source:'HORYZON_INTERNAL'};
const first=await recordPatrimonialPerformanceEvent(store,ownership,{env:enabledEnv});
const replay=await recordPatrimonialPerformanceEvent(store,ownership,{env:enabledEnv});
assert.equal(replay.id,first.id);

const sourceReplay=await recordPatrimonialPerformanceEvent(store,{
  ...base,eventKey:'perf:contact:alternate-key',eventType:'CONTACT_ATTEMPTED',occurredAt:at(3),source:'HIGHLEVEL_WEBHOOK',
  sourceRef:'message-1',providerEventType:'OutboundMessage',remoteContactId:intent.contactId,channel:'SMS',
},{env:enabledEnv});
const sourceReplay2=await recordPatrimonialPerformanceEvent(store,{
  ...base,eventKey:'perf:contact:other-key',eventType:'CONTACT_ATTEMPTED',occurredAt:at(3),source:'HIGHLEVEL_WEBHOOK',
  sourceRef:'message-1',providerEventType:'OutboundMessage',remoteContactId:intent.contactId,channel:'SMS',
},{env:enabledEnv});
assert.equal(sourceReplay2.id,sourceReplay.id);

await recordPatrimonialPerformanceEvent(store,{
  ...base,eventKey:'perf:contact-established:1',eventType:'CONTACT_ESTABLISHED',occurredAt:at(4),source:'MANUAL',
  recordedByType:'ADMIN',recordedByRef:'fixture-admin',
},{env:enabledEnv});
await recordPatrimonialPerformanceEvent(store,{
  ...base,eventKey:'perf:stage:1',eventType:'STAGE_CHANGED',occurredAt:at(5),source:'HIGHLEVEL_WEBHOOK',
  sourceRef:'stage-change-1',providerEventType:'OpportunityStageUpdate',remoteOpportunityId:remoteId,remoteContactId:intent.contactId,
  pipelineStageFrom:'stage-a',pipelineStageTo:'stage-b',
},{env:enabledEnv});

await assert.rejects(
  recordPatrimonialPerformanceEvent(store,{...ownership,occurredAt:at(6)},{env:enabledEnv}),
  error=>error instanceof PatrimonialConflictError,
);

const c1=await store.resolvePerformanceContext(remoteId,at(5));
assert.equal(c1?.assignmentId,a1.id);
assert.equal(c1?.operatorId,op1.id);

const secondAssign=await executePatrimonialAssignment(store,{
  type:'reassignProspect',commandKey:'perf-assign-2',actor,method:'MANUAL',intentId:intent.id,expectedRevision:1,operatorId:op2.id,
},{env:enabledEnv,now:()=>new Date(at(10))});
const a2=secondAssign.assignments?.[0]; assert(a2);

const oldContext=await store.resolvePerformanceContext(remoteId,at(5));
const newContext=await store.resolvePerformanceContext(remoteId,at(12));
assert.equal(oldContext?.assignmentId,a1.id);
assert.equal(newContext?.assignmentId,a2.id);
assert.equal(newContext?.operatorId,op2.id);

await recordPatrimonialPerformanceEvent(store,{
  ...base,eventKey:'perf:late-stage:1',eventType:'STAGE_CHANGED',occurredAt:at(6),source:'HIGHLEVEL_RECONCILIATION',
  sourceRef:'late-stage-1',providerEventType:'OpportunityStageUpdate',remoteOpportunityId:remoteId,
  pipelineStageFrom:'stage-b',pipelineStageTo:'stage-c',
},{env:enabledEnv});
await assert.rejects(
  recordPatrimonialPerformanceEvent(store,{
    ...base,eventKey:'perf:wrong-interval:1',eventType:'FOLLOW_UP_STARTED',occurredAt:at(12),source:'HORYZON_INTERNAL',
  },{env:enabledEnv}),
  error=>error instanceof PatrimonialConflictError,
);

const base2={intentId:intent.id,assignmentId:a2.id,operatorId:op2.id,recordedByType:'WORKER',recordedByRef:'fixture-worker'};
await recordPatrimonialPerformanceEvent(store,{...base2,eventKey:'perf:followup:2',eventType:'FOLLOW_UP_STARTED',occurredAt:at(12),source:'HORYZON_INTERNAL'},{env:enabledEnv});
await recordPatrimonialPerformanceEvent(store,{
  ...base2,eventKey:'perf:booking:2',eventType:'APPOINTMENT_BOOKED',occurredAt:at(13),source:'HORYZON_INTERNAL',
  remoteAppointmentId:'appointment-2',appointmentStatus:'confirmed',
},{env:enabledEnv});
await recordPatrimonialPerformanceEvent(store,{
  ...base2,eventKey:'perf:noshow:2',eventType:'APPOINTMENT_NO_SHOW',occurredAt:at(14),source:'HIGHLEVEL_RECONCILIATION',
  sourceRef:'appointment-2-noshow',providerEventType:'AppointmentUpdate',remoteContactId:intent.contactId,
  remoteAppointmentId:'appointment-2',appointmentStatus:'noshow',
},{env:enabledEnv});
await recordPatrimonialPerformanceEvent(store,{
  ...base2,eventKey:'perf:lost:2',eventType:'CLOSED_LOST',occurredAt:at(16),source:'HIGHLEVEL_WEBHOOK',
  sourceRef:'opportunity-lost-2',providerEventType:'OpportunityStatusUpdate',remoteOpportunityId:remoteId,
  providerStatus:'lost',
},{env:enabledEnv});

const view=await sql('select * from public.patrimonial_assignment_performance_v1 where intent_id=$1 order by assigned_at',[intent.id]);
assert.equal(view.length,2);
assert.equal(Number(view[0].minutes_to_ownership),1);
assert.equal(Number(view[0].minutes_to_first_contact_attempt),2);
assert.equal(Number(view[0].minutes_to_contact_established),3);
assert.equal(view[0].contact_attempt_count,1);
assert.equal(view[0].stage_change_count,2);
assert.equal(Number(view[1].minutes_to_first_booking),3);
assert.equal(view[1].appointment_no_show_count,1);
assert.equal(view[1].follow_up_count,1);
assert.equal(new Date(view[1].closed_lost_at).toISOString(),at(16));

const columns=(await sql("select column_name from information_schema.columns where table_schema='public' and table_name='patrimonial_performance_events'")).map(x=>x.column_name);
for(const forbidden of ['email','phone','first_name','last_name','message','address','notes']) assert(!columns.includes(forbidden));
const security=(await sql("select relrowsecurity,relforcerowsecurity from pg_class where oid='public.patrimonial_performance_events'::regclass"))[0];
assert.equal(security.relrowsecurity,true); assert.equal(security.relforcerowsecurity,true);
assert.equal((await sql("select has_table_privilege('anon','public.patrimonial_performance_events','SELECT') v"))[0].v,false);
assert.equal((await sql("select has_table_privilege('authenticated','public.patrimonial_performance_events','INSERT') v"))[0].v,false);

const beforeDisabled=performanceCalls;
await assert.rejects(
  recordPatrimonialPerformanceEvent(store,{...base2,eventKey:'perf:disabled:1',eventType:'FOLLOW_UP_STARTED',occurredAt:at(17),source:'HORYZON_INTERNAL'},
    {env:()=>({...enabledEnv(),PATRIMONIAL_PERFORMANCE_TRACKING_ENABLED:'false'})}),
  error=>error.code==='DISABLED',
);
assert.equal(performanceCalls,beforeDisabled);

assert.equal(patrimonialHighLevelPerformanceReadiness.OpportunityStageUpdate,'RESOLVABLE_BY_OPPORTUNITY_ID');
assert.equal(patrimonialHighLevelPerformanceReadiness.OpportunityAssignedToUpdate,'NOT_OWNERSHIP_ACCEPTANCE');
assert.equal(patrimonialHighLevelPerformanceReadiness.AppointmentUpdate,'NEEDS_CALENDAR_OR_PRACTICE_BINDING');
assert.equal(externalAttempts,0);

const sample=makePatrimonialPerformanceEvent(ownership);
assert.match(sample.payloadHash,/^[0-9a-f]{64}$/);
console.log('Patrimonial performance tracking P3: PASS');
