import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {startEventV2HttpFixture} from './patrimonial-event-v2-http-fixture.mjs';
import {eventReferralFromSearch} from '../../src/lib/public-leads/patrimonial-event-referral.ts';
import {validatePatrimonialV2,validatePilotLead} from '../../src/lib/public-leads/patrimonial-funnels.ts';
import {canonicalPatrimonialPayload} from '../../src/lib/public-leads/patrimonial-contract.ts';
import {SERVICE_NOTICE_VERSION} from '../../src/lib/patrimonial-radar-server/contracts.ts';
import {buildFixture} from '../patrimonial-radar-fixtures.mjs';
import {dependencyOrder} from '../../src/lib/patrimonial-radar/answers.ts';
import {SupabasePatrimonialStore} from '../../src/lib/public-leads/patrimonial-supabase.ts';
import {handlePublicLead} from '../../src/lib/public-leads/handler.ts';
export const eventV2Proof={scope:'ACTUAL_NEXT_HTTP_TO_NATIVE_POSTGREST',remoteWrites:0,realAuth:'NOT_RUN_SYNTHETIC_GOTRUE',realEmail:'NOT_RUN',httpRegistrations:0,results:[]};
export async function verifyEventV2HttpChain({db,cfg,secret,staff,check,evidence}){
 const fx=await startEventV2HttpFixture({db,cfg,secret,evidence});let ip=0;
 const payload=(email,code,firstName='Http',lastName='Inventata')=>({contractVersion:'patrimonial-lead-v2',requestId:randomUUID(),mode:'patrimonial-event',sourcePath:'/benessere-patrimoniale/evento',firstName,lastName,email,phone:'',province:'Milano',profile:'',message:'Scenario interamente inventato',consent:true,marketingConsent:false,utm:{},website:'',...(code!==undefined?{referralCode:code}:{})});
 const postEvent=async(body,headers={})=>{
  const r=await fetch(fx.origin+'/api/public-leads',{method:'POST',headers:{Origin:fx.origin,'Content-Type':'application/json','Idempotency-Key':body.requestId,'X-Forwarded-For':'198.51.100.'+(++ip),...headers},body:JSON.stringify(body)});
  return{status:r.status,body:await r.json()};
 };
 const call=async(actor,name,body={})=>{
  const r=await fetch(cfg.postgrestUrl+'/rpc/'+name,{method:'POST',headers:{Authorization:'Bearer '+actor.token,'Content-Type':'application/json','Content-Profile':'hub','Accept-Profile':'hub'},body:JSON.stringify(body)});
  return{status:r.status,body:await r.json()};
 };
 const codeFor=async actor=>(await call(actor,'architetti_referral_link')).body.code;
 const reg=async id=>(await db.query("select * from public.patrimonial_contact_event_registrations where location_ref='horyzon-website-event-v2' and event_key=$1",[id])).rows[0];
 const contact=async personId=>(await db.query("select contact_id from patrimonial_radar_private.contact_bindings where person_id=$1 and state='VERIFIED'",[personId])).rows[0]?.contact_id;
 const owner=async cid=>(await db.query('select assigned_operator_id from public.patrimonial_contacts where id=$1',[cid])).rows[0]?.assigned_operator_id;
 async function login(lead){
  const cookies=new Map();let csrf='request-code';
  async function request(path,body){
   const r=await fetch(fx.origin+'/api/patrimonial-radar'+path,{method:body===undefined?'GET':'POST',headers:{Origin:fx.origin,'Content-Type':'application/json','X-Patrimonial-CSRF':csrf,Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')},...(body===undefined?{}:{body:JSON.stringify(body)})});
   for(const raw of r.headers.getSetCookie()){const pair=raw.split(';')[0],i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1));}
   const v=await r.json();if(!r.ok)throw Object.assign(Error(v.error??'HTTP '+r.status),{code:v.error,status:r.status});
   if(v.csrf)csrf=v.csrf;return v;
  }
  const challenge=await request('/identity/request',{email:lead.email,firstName:lead.firstName,lastName:lead.lastName});
  const identity=await request('/identity/verify',{challengeId:challenge.challengeId,code:'123456'});
  return{request,identity};
 }
 async function complete(client){
  const c=await client.request('/assessments',{requestId:randomUUID(),noticeVersion:SERVICE_NOTICE_VERSION});
  const current=(await client.request('/assessments/'+c.id)).assessment;
  const input=buildFixture('T02');let rev=0;
  const dates=x=>!x||typeof x!=='object'?x:Array.isArray(x)?x.map(dates):Object.fromEntries(Object.entries(x).map(([k,v])=>[k,k==='asOf'?current.input.asOf:dates(v)]));
  for(const q of dependencyOrder()){
   const a=input.answers.filter(a=>a.id===q).at(-1);if(!a)continue;
   try{rev=(await client.request('/assessments/'+c.id+'/answer',{requestId:randomUUID(),expectedRevision:rev,questionId:q,state:a.state,...(a.state==='VALUE'?{value:dates(a.value)}:{})})).revision;}
   catch(e){if(e.code!=='INVALID')throw e;}
  }
  return{id:c.id,snapshot:await client.request('/assessments/'+c.id+'/complete',{requestId:randomUUID(),expectedRevision:rev})};
 }
 const a=await staff('HttpReferralA',['LIST','PERSON','ADVISOR'],true),b=await staff('HttpReferralB',['LIST','PERSON','ADVISOR'],true);
 const codeA=await codeFor(a),codeB=await codeFor(b);let leadA,registrationA,clientA,radarA,radarA2,leadB,registrationB,radarB;
 try{
  await check('57 optional v2 Event referral preserves old hashes and rejects malformed/duplicate/Architect or operator input',async()=>{
   const direct=payload('contract-http@example.invalid');const normalized=validatePatrimonialV2(direct);
   assert(normalized);assert(!Object.hasOwn(normalized,'referralCode'));const oldCanonical=JSON.parse(canonicalPatrimonialPayload(normalized));assert(!('referralCode'in oldCanonical));
   const referred=validatePatrimonialV2({...direct,referralCode:codeA});assert(referred);assert.equal(JSON.parse(canonicalPatrimonialPayload(referred)).referralCode,codeA);
   assert.notEqual(createHash('sha256').update(canonicalPatrimonialPayload(normalized)).digest('hex'),createHash('sha256').update(canonicalPatrimonialPayload(referred)).digest('hex'));
   for(const value of [null,'',codeA.toUpperCase(),'bad',123])assert.equal(validatePatrimonialV2({...direct,referralCode:value}),null);
   assert.equal(validatePatrimonialV2({...direct,operator_id:a.op,referralCode:codeA}),null);
   assert.equal(validatePatrimonialV2({...direct,mode:'architect-path',sourcePath:'/benessere-patrimoniale/architetto-patrimoniale',phone:'+393331234567',referralCode:codeA}),null);
   assert.equal(validatePilotLead({...direct,contractVersion:undefined,referralCode:codeA}),null);
   assert.equal(eventReferralFromSearch('?ref='+codeA),codeA);assert.equal(eventReferralFromSearch(''),undefined);
   assert.equal(eventReferralFromSearch('?ref='+codeA+'&ref='+codeA),null);assert.equal(eventReferralFromSearch('?ref=bad'),null);
  });
  await check('58 personal link A -> actual HTTP Event v2 -> canonical persisted registration and owner A with no CRM',async()=>{
   const url=new URL('/benessere-patrimoniale/evento?ref='+codeA,fx.origin);const page=await fetch(url);assert.equal(page.status,200);
   assert((await page.text()).includes('La ricevuta conferma la richiesta.'),'The real landing must render the v2 form from native runtime gates');
   leadA=payload('http-event-a@example.invalid',eventReferralFromSearch(url.search));
   const r=await postEvent(leadA);assert.equal(r.status,202,JSON.stringify(r));eventV2Proof.httpRegistrations++;
   assert.deepEqual(r.body,{ok:true,requestId:leadA.requestId,receiptStatus:'received',crmStatus:'pending'});
   registrationA=await reg(leadA.requestId);assert(registrationA);
   assert.equal(registrationA.referral_code,codeA);assert.equal(registrationA.referred_operator_id,a.op);assert.equal(registrationA.attribution_status,'ASSIGNED_NEW');
   assert.equal(registrationA.registration_status,'PENDING_EDITION');assert.equal(await owner(registrationA.contact_id),a.op);
   const ingress=(await db.query("select provider from public.patrimonial_contact_ingress where event_id=$1 and location_ref='horyzon-website-event-v2'",[leadA.requestId])).rows;
   assert.deepEqual(ingress,[{provider:'website-v2'}]);
   assert.equal((await db.query("select count(*)::int n from public.patrimonial_contact_external_refs where provider='highlevel' and location_ref='horyzon-website-event-v2'")).rows[0].n,0);
   assert.equal((await db.query('select count(*)::int n from public.patrimonial_consent_evidence where request_id=$1',[leadA.requestId])).rows[0].n,2);
  });
  await check('59 same email verified through HTTP account OTP -> completed Radar -> same contact and P1 owner A',async()=>{
   clientA=await login(leadA);radarA=await complete(clientA);
   assert.equal(await contact(clientA.identity.personId),registrationA.contact_id);
   const c=(await db.query('select c.id,i.current_operator_id from patrimonial_radar_private.cases c join public.patrimonial_intents i on i.id=c.intent_id where assessment_id=$1',[radarA.id])).rows[0];
   assert.equal(c.current_operator_id,a.op);
   assert.equal((await db.query('select count(*)::int n from public.patrimonial_assignments where intent_id=(select intent_id from patrimonial_radar_private.cases where id=$1) and released_at is null and operator_id=$2',[c.id,a.op])).rows[0].n,1);
   const view=await call(a,'architetti_personal_radar',{p_contact_id:registrationA.contact_id,p_case_id:c.id});assert.equal(view.body.ok,true);assert.equal(view.body.data.snapshot.id,radarA.snapshot.id);
   eventV2Proof.results.push({case:'new-A',requestId:leadA.requestId,contactId:registrationA.contact_id,assessmentId:radarA.id,reportId:radarA.snapshot.id,operatorId:a.op});
  });
  await check('60 second HTTP Radar preserves one contact, both immutable reports and current owner',async()=>{
   radarA2=await complete(clientA);assert.notEqual(radarA2.id,radarA.id);
   const history=await clientA.request('/assessments');assert.equal(history.length,2);assert(history.some(x=>x.id===radarA.id));
   assert.equal((await clientA.request('/assessments/'+radarA.id+'/snapshot')).resultHash,radarA.snapshot.resultHash);
   assert.equal(await contact(clientA.identity.personId),registrationA.contact_id);assert.equal(await owner(registrationA.contact_id),a.op);
  });
  await check('61 existing B customer follows HTTP Event A -> same contact, B remains owner and A is denied',async()=>{
   const original=payload('http-existing-b@example.invalid',codeB,'Cliente','Assegnato');assert.equal((await postEvent(original)).status,202);eventV2Proof.httpRegistrations++;
   const initial=await reg(original.requestId);assert.equal(await owner(initial.contact_id),b.op);
   leadB={...original,requestId:randomUUID(),referralCode:codeA};assert.equal((await postEvent(leadB)).status,202);eventV2Proof.httpRegistrations++;
   registrationB=await reg(leadB.requestId);assert.equal(registrationB.contact_id,initial.contact_id);assert.equal(registrationB.attribution_status,'EXISTING_OTHER_OWNER');
   assert.equal(registrationB.referred_operator_id,a.op);assert.equal(await owner(initial.contact_id),b.op);
   const client=await login(leadB);radarB=await complete(client);assert.equal(await contact(client.identity.personId),initial.contact_id);
   const c=(await db.query('select id from patrimonial_radar_private.cases where assessment_id=$1',[radarB.id])).rows[0];
   assert.equal((await call(a,'architetti_personal_radar',{p_contact_id:initial.contact_id,p_case_id:c.id})).body.ok,false);
   assert.equal((await call(b,'architetti_personal_radar',{p_contact_id:initial.contact_id,p_case_id:c.id})).body.ok,true);
  });
  await check('62 invalid, revoked and unbound referral fail HTTP atomically, with no ledger/contact/registration or fallback',async()=>{
   const revoked=await staff('HttpRevoked',[],true),unbound=await staff('HttpUnbound',[],true);
   const revokedCode=await codeFor(revoked),unboundCode=await codeFor(unbound);
   await db.query('update public.patrimonial_architect_referral_links set revoked_at=now() where operator_id=$1',[revoked.op]);
   await assert.rejects(db.query('update public.patrimonial_operators set user_id=null,revision=revision+1 where id=$1',[unbound.op]),e=>e.code==='23514');
   await db.query('update public.patrimonial_operators set user_id=null,network_enabled=false,revision=revision+1 where id=$1',[unbound.op]);
   for(const [n,code] of [['invalid','0'.repeat(32)],['revoked',revokedCode],['unbound',unboundCode]]){
    const lead=payload('http-'+n+'@example.invalid',code),r=await postEvent(lead);assert.equal(r.status,503);
    assert.equal((await db.query('select count(*)::int n from public.patrimonial_requests where request_id=$1',[lead.requestId])).rows[0].n,0);
    assert.equal(await reg(lead.requestId),undefined);assert.equal((await db.query('select count(*)::int n from public.patrimonial_contacts where email=$1',[lead.email])).rows[0].n,0);
   }
  });
  await check('63 same HTTP request replays once, changed referral conflicts, old receipt survives revocation without reassigning',async()=>{
   assert.equal((await postEvent(leadA)).status,202);assert.equal((await postEvent({...leadA,referralCode:codeB})).status,409);
   await db.query('update public.patrimonial_architect_referral_links set revoked_at=now() where operator_id=$1',[a.op]);
   assert.equal((await postEvent(leadA)).status,202);assert.equal((await reg(leadA.requestId)).id,registrationA.id);assert.equal(await owner(registrationA.contact_id),a.op);
   await db.query('update public.patrimonial_architect_referral_links set revoked_at=null where operator_id=$1',[a.op]);
  });
  await check('64 actual HTTP v2 keeps Origin, honeypot, idempotency and unknown-field validation',async()=>{
   const x=payload('http-denied@example.invalid',codeA);
   for(const [body,headers,status] of [[x,{Origin:'https://untrusted.invalid'},403],[{...x,website:'spam'},{},400],[{...x,operatorId:a.op},{},400],[{...x,referralCode:'bad'},{},400],[x,{'Idempotency-Key':randomUUID()},400]]){
    assert.equal((await postEvent(body,headers)).status,status);
   }
   assert.equal((await db.query('select count(*)::int n from public.patrimonial_requests where request_id=$1',[x.requestId])).rows[0].n,0);
  });
  await check('65 no Advisor grant means no dossier even for the correctly referred owner',async()=>{
   const actor=await staff('HttpNoAdvisor',[],true),code=await codeFor(actor),lead=payload('http-no-advisor@example.invalid',code);
   assert.equal((await postEvent(lead)).status,202);eventV2Proof.httpRegistrations++;
   const er=await reg(lead.requestId),client=await login(lead),r=await complete(client),c=(await db.query('select id from patrimonial_radar_private.cases where assessment_id=$1',[r.id])).rows[0];
   assert.equal(await owner(er.contact_id),actor.op);assert.equal((await call(actor,'architetti_personal_radar',{p_contact_id:er.contact_id})).body.ok,true);
   assert.equal((await call(actor,'architetti_personal_radar',{p_contact_id:er.contact_id,p_case_id:c.id})).body.ok,false);
  });
  await check('66 native ACL, no new ledger triggers and real HTTP composition use the installed ingress without HighLevel',async()=>{
   assert.equal((await db.query("select has_schema_privilege('authenticated','public','USAGE') ok")).rows[0].ok,false);
   for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_function_privilege($1,'public.acquire_patrimonial_event_referral_v2(jsonb,jsonb)','EXECUTE') ok",[role])).rows[0].ok,false);
   assert(fx.rpcNames.acquire_patrimonial_event_referral_v2>=8);
   assert.equal(fx.counters.highlevel,0);assert.equal(fx.counters.emails,0);
   assert.equal((await db.query("select count(*)::int n from public.patrimonial_participations where attendance='ATTENDED'")).rows[0].n,0);
  });
  await check('67 concurrent real HTTP Event requests preserve one contact and the existing referral owner',async()=>{
   const x=payload('http-concurrent@example.invalid',codeA),y={...x,requestId:randomUUID()};
   const results=await Promise.all([postEvent(x),postEvent(y)]);assert(results.every(r=>r.status===202),JSON.stringify(results));eventV2Proof.httpRegistrations+=2;
   const rx=await reg(x.requestId),ry=await reg(y.requestId);assert.equal(rx.contact_id,ry.contact_id);assert.equal(await owner(rx.contact_id),a.op);
   assert.deepEqual([rx.attribution_status,ry.attribution_status].sort(),['ASSIGNED_NEW','EXISTING_SAME_OWNER']);
   assert.equal((await db.query('select count(*)::int n from public.patrimonial_contacts where email=$1',[x.email])).rows[0].n,1);
  });
  await check('68 disabled ingress and superseded runtime intake fail closed before any registration or legacy fallback',async()=>{
   const lead=payload('http-closed-gate@example.invalid',codeA);let calls=0;
   const store=new SupabasePatrimonialStore({url:'http://127.0.0.1:15452',serviceRoleKey:fx.jwt({role:'service_role'}),eventReferralIngress:false,fetchImpl:async(...args)=>{calls++;return fetch(...args);}});
   const request=()=>new Request(fx.origin+'/api/public-leads',{method:'POST',headers:{Origin:fx.origin,'Content-Type':'application/json','Idempotency-Key':lead.requestId},body:JSON.stringify(lead)});
   assert.equal((await handlePublicLead(request(),{env:{NODE_ENV:'test',PATRIMONIAL_V2_ENABLED:'true'},store})).status,503);assert.equal(calls,1); // health only
   let oldIntake=0;assert.equal((await handlePublicLead(request(),{env:{NODE_ENV:'test',PATRIMONIAL_V2_ENABLED:'true'},eventIntake:async()=>{oldIntake++;throw Error('Must not run');}})).status,503);assert.equal(oldIntake,0);
   assert.equal((await db.query('select count(*)::int n from public.patrimonial_requests where request_id=$1',[lead.requestId])).rows[0].n,0);
  });
  eventV2Proof.status='PASS';eventV2Proof.highLevel='OFF_NO_CONFIG_NO_TRANSPORT';eventV2Proof.httpEndpoint='/api/public-leads';eventV2Proof.radarEndpoint='/api/patrimonial-radar';
  eventV2Proof.counters={...fx.counters};eventV2Proof.rpcNames={...fx.rpcNames};
  await writeFile(evidence+'/event-v2-result.json',JSON.stringify(eventV2Proof,null,2)+'\n');
 }finally{await fx.close();}
}
