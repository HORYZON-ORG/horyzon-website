import assert from 'node:assert/strict';
import {parseDigitalSubmission, digitalTerritory} from '../src/lib/digital-leads/contract.ts';
import {acquireDigitalLead, DigitalStoreError} from '../src/lib/digital-leads/store.ts';
import {runDigitalCrmDrain} from '../src/lib/digital-leads/crm.ts';

const id='123e4567-e89b-42d3-a456-426614174000';
const input={
 requestId:id,firstName:' Ada ',lastName:' Lovelace ',company:' Impresa Prova ',
 email:' ADA@EXAMPLE.TEST ',phone:'0832123456',province:' Lecce ',
 activity:'Ogni giorno ricopiamo richieste email e prepariamo preventivi a mano.',
 frequency:'daily',tools:'Excel',website:'',consent:true,
};
const valid=parseDigitalSubmission(input,id);
assert(valid,'a complete submission is valid');
assert.equal(valid.requestId,id);
assert.equal(valid.payload.email,'ada@example.test');
assert.equal(valid.payload.phone,'+390832123456');
assert.equal(valid.payload.territory,'salento');
assert.equal(valid.payload.privacy_version,'digital-intake-v1');
assert.equal(valid.hash.length,64);
assert.equal(parseDigitalSubmission({...input,email:'ada@example.test'},id)?.hash,valid.hash,'same business fields normalize to the same hash');
assert.equal(digitalTerritory('Bari'),'barese');
assert.equal(digitalTerritory('Milano'),'nazionale');
assert.equal(digitalTerritory('Taranto'),'salento');
assert.equal(parseDigitalSubmission({...input,consent:false},id),null);
assert.equal(parseDigitalSubmission({...input,website:'hacker'},id),null);
assert.equal(parseDigitalSubmission({...input,activity:'troppo breve'},id),null);
assert.equal(parseDigitalSubmission(input,'another-request-id'),null);
assert.equal(parseDigitalSubmission({...input,frequency:'every second'},id),null);
assert.equal(parseDigitalSubmission({...input,phone:'abc'},id),null);
assert.equal(parseDigitalSubmission({...input,firstName:'X'.repeat(81)},id),null);
assert.equal(parseDigitalSubmission({...input,requestId:'abc'},'abc'),null);

const env={NODE_ENV:'test',SUPABASE_URL:'https://example.supabase.co',
 SUPABASE_SERVICE_ROLE_KEY:'mock-server-key',
 DIGITAL_CRM_SYNC_ENABLED:'true',HIGHLEVEL_PRIVATE_TOKEN:'mock-highlevel',
 HIGHLEVEL_LOCATION_ID:'test-location',DIGITAL_PIPELINE_ID:'pipeline-digital',
 DIGITAL_PIPELINE_STAGE_NEW_ID:'stage-new'};
const calls=[];
const sampleRow={
 id:'00000000-0000-4000-8000-000000000001',
 request_id:id,first_name:'Ada',last_name:'Lovelace',
 company_name:'Impresa Prova',email:'ada@example.test',phone:'+390832123456',
 province:'Lecce',activity:input.activity,frequency:'daily',
 tools:'Excel',territory:'salento',privacy_version:'digital-intake-v1',
 crm_contact_id:null,crm_step:'upsert',crm_opportunity_id:null,
 crm_lease_token:'00000000-0000-4000-8000-000000000002',crm_attempts:1,
};
let existingOpportunity=null;
let breakNote=false;
const fetcher=async (target,opts={})=>{
 const url=new URL(String(target));
 const body=opts.body?JSON.parse(opts.body):null;
 calls.push({host:url.hostname,path:url.pathname,method:opts.method,body});
 if(url.hostname==='example.supabase.co'){
  assert.equal(opts.headers['Accept-Profile'],'hub');
  assert.equal(opts.headers['Content-Profile'],'hub');
  if(url.pathname.endsWith('/digital_intake_submit_v1')){
    assert.equal(body.p_request_id,id);
    assert.equal(body.p_payload.territory,'salento');
    return Response.json({id:sampleRow.id,replay:false});
  }
  if(url.pathname.endsWith('/digital_crm_claim_v1'))return Response.json([sampleRow]);
  if(url.pathname.endsWith('/digital_crm_progress_v1'))return Response.json(true);
  if(url.pathname.endsWith('/digital_crm_opportunity_record_v1'))return Response.json(true);
  if(url.pathname.endsWith('/digital_crm_finish_v1'))return Response.json(true);
  throw new Error('Unexpected RPC '+url.pathname);
 }
 assert.equal(url.hostname,'services.leadconnectorhq.com');
 if(url.pathname==='/contacts/upsert')return Response.json({contact:{id:'contactABC123'}});
 if(url.pathname.endsWith('/tags'))return Response.json({ok:true});
 if(url.pathname.endsWith('/notes')){
  if(breakNote)throw Error('Network timeout after note write');
  return Response.json({ok:true});
 }
 if(url.pathname==='/opportunities/search')return Response.json({opportunities:existingOpportunity
  ?[{id:existingOpportunity,contactId:'contactABC123',pipelineId:'pipeline-digital'}]:[]});
 if(url.pathname==='/opportunities/')return Response.json({opportunity:{id:'opportunityXYZ123'}});
 throw new Error('Unexpected CRM route '+url.pathname);
};

const receipt=await acquireDigitalLead(valid,'b'.repeat(64),env,fetcher);
assert.equal(receipt.id,sampleRow.id);
assert.equal(receipt.replay,false);
let stats=await runDigitalCrmDrain({env,requestId:id,fetcher});
assert.deepEqual(stats,{claimed:1,synced:1,retry:0});
assert.equal(calls.filter(c=>c.path==='/contacts/upsert').length,1);
const upsert=calls.find(c=>c.path==='/contacts/upsert');
assert(!Object.hasOwn(upsert.body,'tags'),'contact upsert must not overwrite existing tags');
assert.equal(calls.filter(c=>c.path==='/opportunities/').length,1);
const opportunity=calls.find(c=>c.path==='/opportunities/');
assert.equal(opportunity.body.pipelineId,env.DIGITAL_PIPELINE_ID);
assert.equal(opportunity.body.pipelineStageId,env.DIGITAL_PIPELINE_STAGE_NEW_ID);
assert.equal(calls.find(c=>c.path.endsWith('/digital_crm_opportunity_record_v1')).body.p_opportunity_id,'opportunityXYZ123');
assert.equal(calls.find(c=>c.path.endsWith('/digital_crm_finish_v1')).body.p_success,true);

calls.length=0;
existingOpportunity='preexistingOpportunity123';
stats=await runDigitalCrmDrain({env,requestId:id,fetcher});
assert.equal(stats.synced,1);
assert.equal(calls.some(c=>c.path==='/opportunities/'),false,'existing CRM opportunity is reused');

calls.length=0;
breakNote=true;
stats=await runDigitalCrmDrain({env,requestId:id,fetcher});
assert.equal(stats.retry,1);
assert.equal(calls.find(c=>c.path.endsWith('/digital_crm_finish_v1')).body.p_error,'CRM_NOTE_UNCERTAIN',
 'ambiguous note must be manual review, not automatic duplicate retry');

calls.length=0;
const disabled=await runDigitalCrmDrain({env:{...env,DIGITAL_CRM_SYNC_ENABLED:'false'},fetcher});
assert.deepEqual(disabled,{claimed:0,synced:0,retry:0});
assert.equal(calls.length,0);

await assert.rejects(()=>acquireDigitalLead(valid,'b'.repeat(64),{...env,SUPABASE_SERVICE_ROLE_KEY:''},fetcher),
 error=>error instanceof DigitalStoreError && error.code==='STORE_NOT_CONFIGURED');

console.log('PASS digital funnel: validation, territory, durable receipt, CRM pipeline, deduplication, partial error, disabled flag.');
