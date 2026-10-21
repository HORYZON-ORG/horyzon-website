import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { executePatrimonialAssignment } from '../src/lib/public-leads/patrimonial-assignments.ts';
import { SupabasePatrimonialStore } from '../src/lib/public-leads/patrimonial-supabase.ts';
import {
  ingestPatrimonialHighLevelPerformanceWebhook,
  PatrimonialHighLevelWebhookError,
  verifyPatrimonialHighLevelWebhookSignature,
} from '../src/lib/public-leads/patrimonial-performance-highlevel.ts';
import { PatrimonialConflictError } from '../src/lib/public-leads/patrimonial-store.ts';
import { db,sql,seed,actor,setup } from './patrimonial-owner-test-fixture.mjs';

await setup();
await db.exec(await readFile(new URL('../supabase/migrations/20261018224500_patrimonial_performance_tracking.sql',import.meta.url),'utf8'));

const fetchImpl=async(url,init)=>{
  assert.equal(new URL(url).origin,'https://performance-webhook.invalid');
  const name=new URL(url).pathname.split('/').at(-1),body=JSON.parse(init.body);
  try {
    const result=await db.transaction(async tx=>{
      await tx.exec('set local role service_role');
      if(name==='patrimonial_store_health') return (await tx.query('select public.patrimonial_store_health() result')).rows[0].result;
      if(name==='patrimonial_store_capabilities') return (await tx.query('select public.patrimonial_store_capabilities() result')).rows[0].result;
      if(name==='patrimonial_performance_capabilities') return (await tx.query('select public.patrimonial_performance_capabilities() result')).rows[0].result;
      if(name==='patrimonial_performance_resolve') return (await tx.query(
        'select public.patrimonial_performance_resolve($1,$2::timestamptz) result',
        [body.p_remote_opportunity_id,body.p_occurred_at],
      )).rows[0].result;
      if(name==='patrimonial_record_performance_event') return (await tx.query(
        'select public.patrimonial_record_performance_event($1::jsonb) result',
        [JSON.stringify(body.p_event)],
      )).rows[0].result;
      if(name==='patrimonial_store_transaction') return (await tx.query(
        'select public.patrimonial_store_transaction($1::jsonb,$2::jsonb,$3::boolean) result',
        [JSON.stringify(body.p_commands),JSON.stringify(body.p_expected),body.p_preview],
      )).rows[0].result;
      throw new Error('unexpected rpc '+name);
    });
    return Response.json(result);
  } catch(error) {
    return Response.json({code:error.code,message:error.message},{status:error.code==='PT409'?409:500});
  }
};

const store=new SupabasePatrimonialStore({
  url:'https://performance-webhook.invalid',
  serviceRoleKey:'fixture-service-role',
  fetchImpl,
});
const enabledEnv=()=>({
  PATRIMONIAL_V2_ENABLED:'true',
  PATRIMONIAL_ASSIGNMENTS_ENABLED:'true',
  PATRIMONIAL_PERFORMANCE_TRACKING_ENABLED:'true',
  PATRIMONIAL_HIGHLEVEL_PERFORMANCE_WEBHOOK_ENABLED:'true',
  HIGHLEVEL_LOCATION_ID:'fixture-location',
});

const intent=await seed({owner:null});
const remoteOpportunityId='fixture-webhook-opportunity';
await sql(
  "update public.patrimonial_intents set remote_opportunity_id=$2,record=jsonb_set(record,'{remote}',$3::jsonb) where id=$1",
  [intent.id,remoteOpportunityId,JSON.stringify({
    id:remoteOpportunityId,syncedRevision:intent.revision,pipelineId:'N2hsjiShcdMbzAITjxOA',
    stageId:'1506fbbf-c48e-4896-a52e-1464a7105460',status:'open',version:'fixture-v1',assignedTo:null,
  })],
);

const created=await executePatrimonialAssignment(store,{
  type:'createOperator',commandKey:'webhook-create-operator',actor,
  operator:{operatorKey:'webhook-op',displayName:'Webhook Operator',remoteUserRef:'fixture-remote-user'},
},{env:enabledEnv});
const operator=created.operator; assert(operator);
const assigned=await executePatrimonialAssignment(store,{
  type:'assignProspect',commandKey:'webhook-assign',actor,method:'MANUAL',
  intentId:intent.id,expectedRevision:0,operatorId:operator.id,
},{env:enabledEnv});
const assignment=assigned.assignments?.[0]; assert(assignment);
const assignedAt=(await sql('select assigned_at from public.patrimonial_assignments where id=$1',[assignment.id]))[0].assigned_at;
const eventAt=new Date(new Date(assignedAt).getTime()+1000).toISOString();

const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const publicKeyPem=publicKey.export({type:'spki',format:'pem'}).toString();
const signed=(payload)=>{
  const rawBody=JSON.stringify(payload);
  const signature=sign(null,Buffer.from(rawBody,'utf8'),privateKey).toString('base64');
  return {rawBody,signature};
};
const ingest=async(payload,options={})=>{
  const {rawBody,signature}=signed(payload);
  return ingestPatrimonialHighLevelPerformanceWebhook({
    rawBody,signature,storeFactory:()=>store,env:enabledEnv,publicKeyPem,...options,
  });
};

const stagePayload={
  type:'OpportunityStageUpdate',locationId:'fixture-location',id:remoteOpportunityId,contactId:intent.contactId,
  pipelineId:'N2hsjiShcdMbzAITjxOA',pipelineStageId:'fcdfe082-9a69-43ba-b178-4550bc968b46',
  status:'open',timestamp:eventAt,webhookId:'wh-stage-1',
};
const stage=await ingest(stagePayload);
assert.equal(stage.state,'RECORDED');
const replay=await ingest(stagePayload);
assert.equal(replay.state,'RECORDED');
assert.equal(replay.eventId,stage.eventId);

let rows=await sql('select event_type,pipeline_stage_to,provider_status,source_ref from public.patrimonial_performance_events where id=$1',[stage.eventId]);
assert.deepEqual(rows.map(r=>({...r})),[{event_type:'STAGE_CHANGED',pipeline_stage_to:'A02',provider_status:'open',source_ref:'wh-stage-1'}]);

await assert.rejects(
  ingest({...stagePayload,pipelineStageId:'c0068e27-ac31-4a11-99e4-2782979c2423'}),
  error=>error instanceof PatrimonialConflictError,
);

const won=await ingest({
  ...stagePayload,type:'OpportunityStatusUpdate',status:'won',webhookId:'wh-status-won-1',
  timestamp:new Date(Date.parse(eventAt)+1000).toISOString(),
});
assert.equal(won.state,'RECORDED');
rows=await sql('select event_type,provider_status from public.patrimonial_performance_events where id=$1',[won.eventId]);
assert.deepEqual(rows.map(r=>({...r})),[{event_type:'CLOSED_WON',provider_status:'won'}]);

assert.equal((await ingest({...stagePayload,type:'OpportunityStatusUpdate',status:'open',webhookId:'wh-open'})).state,'IGNORED_STATUS_OPEN');
assert.equal((await ingest({...stagePayload,webhookId:'wh-no-time',timestamp:undefined})).state,'IGNORED_MISSING_TIMESTAMP');
assert.equal((await ingest({...stagePayload,locationId:'other-location',webhookId:'wh-location'})).state,'IGNORED_LOCATION');
assert.equal((await ingest({...stagePayload,pipelineId:'unknown-pipeline',webhookId:'wh-pipeline'})).state,'IGNORED_UNKNOWN_PIPELINE');
assert.equal((await ingest({...stagePayload,pipelineStageId:'unknown-stage',webhookId:'wh-stage'})).state,'IGNORED_UNKNOWN_STAGE');
assert.equal((await ingest({...stagePayload,type:'OutboundMessage',webhookId:'wh-message'})).state,'IGNORED_UNSUPPORTED');
assert.equal((await ingest({...stagePayload,contactId:'wrong-contact',webhookId:'wh-contact'})).state,'IGNORED_IDENTITY');
assert.equal((await ingest({
  ...stagePayload,pipelineId:'RGRNXX0TAFbZc24Q4n77',pipelineStageId:'ed092495-1c21-436f-bcc2-a947a6935199',
  webhookId:'wh-funnel',
})).state,'IGNORED_IDENTITY');

const noIdPayload={...stagePayload,webhookId:undefined,timestamp:new Date(Date.parse(eventAt)+2000).toISOString()};
const noId1=await ingest(noIdPayload);
const noId2=await ingest(noIdPayload);
assert.equal(noId1.state,'RECORDED');
assert.equal(noId2.eventId,noId1.eventId);
rows=await sql('select source_ref from public.patrimonial_performance_events where id=$1',[noId1.eventId]);
assert.match(rows[0].source_ref,/^body:[0-9a-f]{64}$/);

const valid=signed(stagePayload);
assert.equal(verifyPatrimonialHighLevelWebhookSignature(valid.rawBody,valid.signature,publicKeyPem),true);
assert.equal(verifyPatrimonialHighLevelWebhookSignature(valid.rawBody+' ',valid.signature,publicKeyPem),false);
await assert.rejects(
  ingestPatrimonialHighLevelPerformanceWebhook({
    rawBody:valid.rawBody,signature:'not-a-valid-signature',storeFactory:()=>store,env:enabledEnv,publicKeyPem,
  }),
  error=>error instanceof PatrimonialHighLevelWebhookError && error.code==='SIGNATURE',
);

let disabledStoreCalls=0;
const disabled=await ingestPatrimonialHighLevelPerformanceWebhook({
  ...valid,
  storeFactory:()=>{disabledStoreCalls++;return store;},
  env:()=>({...enabledEnv(),PATRIMONIAL_HIGHLEVEL_PERFORMANCE_WEBHOOK_ENABLED:'false'}),
  publicKeyPem,
});
assert.equal(disabled.state,'DISABLED');
assert.equal(disabledStoreCalls,0);

const beforeCount=(await sql('select count(*)::integer n from public.patrimonial_performance_events'))[0].n;
assert.equal(beforeCount,3);

console.log('Patrimonial HighLevel performance webhook P3B: PASS');
