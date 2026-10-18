import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { executePatrimonialAssignment } from '../src/lib/public-leads/patrimonial-assignments.ts';
import { SupabasePatrimonialStore } from '../src/lib/public-leads/patrimonial-supabase.ts';
import { receivePatrimonialOpportunity } from '../src/lib/public-leads/patrimonial-routing.ts';

// Actual PostgreSQL constraints/functions in an ephemeral WASM database. No URL,
// credentials, remote database, provider or mock-only production repository.
let externalAttempts=0;
globalThis.fetch=async()=>{externalAttempts++;throw new Error('Network forbidden in assignment verifier');};
const db=new PGlite();
const now=new Date().toISOString();
const actor={type:'ADMIN',ref:'fixture-admin'};
const env=()=>({PATRIMONIAL_V2_ENABLED:'true',PATRIMONIAL_ASSIGNMENTS_ENABLED:'true',PATRIMONIAL_CRM_WRITE_ENABLED:'true',PATRIMONIAL_OWNER_SYNC_ENABLED:'true',HIGHLEVEL_LOCATION_ID:'fixture-location',HIGHLEVEL_PRIVATE_TOKEN:'fixture-token'});
let counter=0;
const requests=[];
const sql=async(query,args=[]) => (await db.query(query,args)).rows;
const fetchImpl=async(url,init)=>{
  assert.equal(new URL(url).origin,'https://assignment.invalid');
  assert.equal(init.method,'POST');
  const name=new URL(url).pathname.split('/').at(-1), body=JSON.parse(init.body);
  requests.push(name);
  assert(['patrimonial_store_health','patrimonial_store_capabilities','patrimonial_store_transaction'].includes(name));
  try {
    const result=await db.transaction(async tx=>{
      await tx.exec('set local role service_role');
      const query=name==='patrimonial_store_health'
        ? await tx.query('select public.patrimonial_store_health() as result')
        : name==='patrimonial_store_capabilities' ? await tx.query('select public.patrimonial_store_capabilities() as result')
        : await tx.query('select public.patrimonial_store_transaction($1::jsonb,$2::jsonb,$3::boolean) as result',[JSON.stringify(body.p_commands),JSON.stringify(body.p_expected),body.p_preview]);
      return query.rows[0].result;
    });
    return Response.json(result);
  } catch(error) {
    if(error instanceof TypeError) throw error;
    if(error.code!=='PT409' && error.code!=='23505' && error.message!=='Unknown assignment write' && error.message!=='PATRIMONIAL_INVALID_COMMAND' && !(name==='patrimonial_store_capabilities' && error.code==='42883')) console.error('SQL fixture failure:',error.code,error.message,error.where);
    return Response.json({code:error.code==='23505'?'PT409':error.code,message:error.code==='23505'?'PATRIMONIAL_CONFLICT':error.message},{status:['PT409','23505'].includes(error.code)?409:500});
  }
};
const makeStore=()=>new SupabasePatrimonialStore({url:'https://assignment.invalid',serviceRoleKey:'fixture-service-role',fetchImpl});
const store=makeStore();
const run=(command,options={})=>executePatrimonialAssignment(store,{commandKey:`fixture-${++counter}`,actor,...command},{env,now:()=>new Date(now),...options});
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
    actor:{id:'fixture-system',type:'SYSTEM'},nextStepAt:new Date(Date.now()+86400000).toISOString(),...(owner===null?{}:{ownerId:owner}),
    ...(funnel==='patrimonial-event'?{eventSlug:'fixture-event'}:{}),
  });
  return intent;
}

export {db,store,sql,run,seed,env,actor,makeStore,externalAttempts};
export async function setup(beforeOwnerMigration=async()=>{}){
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon,authenticated,service_role;');
 for(const name of ['20261014225059_patrimonial_lead_v2.sql','20261015100912_patrimonial_opportunity_jsonb_precedence.sql','20261018094926_patrimonial_assignment_management.sql','20261018163245_patrimonial_owner_sync.sql','20261018180107_patrimonial_runtime_capabilities.sql']) {
   if(name==='20261018163245_patrimonial_owner_sync.sql') await beforeOwnerMigration();
   await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 }
}
