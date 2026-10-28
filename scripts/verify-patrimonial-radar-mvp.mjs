// Focused native rehearsal for the M1/M2-5D/M3-5D/M4/M6 chain WITHOUT M5.
// Reuses the fenced 5D baseline and existing engine fixtures; no real Auth/email.
import assert from 'node:assert/strict';
import {randomUUID,createHmac,createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {foundationDatabase} from './lib/patrimonial-preview-db-5d.mjs';
import {baseline5d,beforePreviewCandidate,afterPreviewCandidate} from './lib/patrimonial-preview-baseline-5d.mjs';
import {beforeAccountAcl,afterAccountAcl} from './lib/patrimonial-account-acl-5d.mjs';
import {AccountRadarRpc,accountToken,accountMacKey} from '../src/lib/patrimonial-radar-server/account-rpc.ts';
import {PatrimonialRadarService} from '../src/lib/patrimonial-radar-server/service.ts';
import {SERVICE_NOTICE_VERSION} from '../src/lib/patrimonial-radar-server/contracts.ts';
import {buildFixture} from './patrimonial-radar-fixtures.mjs';
import {dependencyOrder} from '../src/lib/patrimonial-radar/answers.ts';
const arg=k=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3);
for(const k of ['network-platform','pg-module','local-config','evidence'])assert(arg(k),'Missing '+k);
const cfg=JSON.parse(await readFile(arg('local-config'),'utf8'));
assert.equal(cfg.databaseUrl,'postgres://postgres@127.0.0.1:15449/radar_5d_test');
assert.equal(cfg.postgrestUrl,'http://127.0.0.1:15450');
const sql=async f=>(await readFile(f,'utf8')).replaceAll('\r\n','\n');
const candidate=f=>arg('network-platform')+'/packages/database/pending/'+f;
const m3=candidate('20261026160106_patrimonial_radar_preview_auth.sql');
const m4=candidate('20261026220758_patrimonial_radar_architect_referrals.sql');
const m6=candidate('20261027092211_patrimonial_radar_handoff_metadata.sql');
const proof={scope:'NATIVE_PG_POSTGREST_LOCAL_SYNTHETIC_WITHOUT_M5',remoteWrites:0,realAuth:'NOT_RUN',realEmail:'NOT_SENT',checks:[]};
const check=async(name,f)=>{await f();proof.checks.push({name,status:'PASS'});console.log('PASS '+name);};
const db=await foundationDatabase({networkPlatform:arg('network-platform'),replayConcurrent:true,beforeCandidate:async client=>{
 await beforePreviewCandidate(client);
 const manifest=JSON.parse(await readFile('scripts/fixtures/referral-runtime-current/manifest.json','utf8'));
 for(const f of manifest){const text=await sql('scripts/fixtures/referral-runtime-current/'+f.file);assert.equal(createHash('sha256').update(text).digest('hex'),f.sha256);await client.query(text);}
 baseline5d.eventResult=(await client.query('select public.architetti_event_ingest($1) d',[baseline5d.event])).rows[0].d;
 await beforeAccountAcl(client);
}});
const secret='synthetic-account-5c-secret-0000000000000000000000000000000000';
function token(claims){const p=[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,...claims})).toString('base64url')].join('.');return p+'.'+createHmac('sha256',cfg.secret).update(p).digest('base64url');}
async function rpc(a,name,body={}){
 const r=await fetch(cfg.postgrestUrl+'/rpc/'+name,{method:'POST',headers:{...(a?{Authorization:'Bearer '+a.token}:{}),'Content-Type':'application/json','Content-Profile':'hub','Accept-Profile':'hub'},body:JSON.stringify(body)});
 return{status:r.status,body:await r.json()};
}
const hub=async(a,c)=>(await rpc(a,'patrimonial_radar_simple_command',{p_command:c})).body;
async function account(email,uid=randomUUID(),referralCode){
 const sid=randomUUID(),profile={email,firstName:'Persona',lastName:'Inventata'};
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()) on conflict(id) do nothing',[uid,email]);
 await db.query("insert into auth.sessions(id,user_id,not_after) values($1,$2,now()+interval '1 hour')",[sid,uid]);
 const t=token({sub:uid,session_id:sid}),opaque=accountToken(secret,uid,sid);
 const service=new PatrimonialRadarService(new AccountRadarRpc({url:cfg.postgrestUrl,key:'sb_publishable_synthetic',secret,token:t,uid,sid,profile,referralCode,fetchImpl:(url,init)=>{assert.equal(new URL(url).origin,cfg.postgrestUrl);return fetch(url.replace('/rest/v1',''),init);}}),{kind:'SIMULATED',async sendCode(){throw Error('No email permitted');}},secret);
 const identity=await service.session(opaque);return{uid,sid,token:t,opaque,profile,service,personId:identity.personId};
}
async function complete(a){
 const c=await a.service.create(a.opaque,{requestId:randomUUID(),noticeVersion:SERVICE_NOTICE_VERSION});
 const current=await a.service.read(a.opaque,c.id),input=buildFixture('T02');let rev=0;
 const dates=x=>!x||typeof x!=='object'?x:Array.isArray(x)?x.map(dates):Object.fromEntries(Object.entries(x).map(([k,v])=>[k,k==='asOf'?current.input.asOf:dates(v)]));
 for(const q of dependencyOrder()){
  const r=input.answers.filter(a=>a.id===q).at(-1);if(!r)continue;
  try{rev=(await a.service.save(a.opaque,c.id,{requestId:randomUUID(),expectedRevision:rev,questionId:q,state:r.state,...(r.state==='VALUE'?{value:dates(r.value)}:{})})).revision;}catch(e){if(e.code!=='INVALID')throw e;}
 }
 return{id:c.id,snapshot:await a.service.complete(a.opaque,c.id,{requestId:randomUUID(),expectedRevision:rev})};
}
async function staff(name,permissions=[],isOperator=false){
 const uid=randomUUID(),sid=randomUUID(),op=isOperator?randomUUID():null;
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[uid,name+'@staff.invalid']);
 await db.query("insert into auth.sessions(id,user_id,not_after) values($1,$2,now()+interval '1 hour')",[sid,uid]);
 await db.query("insert into hub.user_roles(user_id,email,role) values($1,$2,'superadmin')",[uid,name+'@staff.invalid']);
 if(op)await db.query("insert into public.patrimonial_operators(id,operator_key,display_name,user_id,network_enabled,network_role) values($1,$2,$3,$4,true,'architect')",[op,'mvp-'+op,name,uid]);
 for(const p of permissions)await db.query("insert into hub.patrimonial_radar_permissions(user_id,permission,operator_id,expires_at,evidence_ref) values($1,$2,$3,now()+interval '1 hour','SYNTHETIC_MVP_ONLY')",[uid,'RADAR_PATRIMONIAL_'+p,p==='ADVISOR'?op:null]);
 return{uid,sid,op,token:token({sub:uid,session_id:sid})};
}
const rows=async a=>{const r=await hub(a,{method:'list'});assert.equal(r.ok,true,JSON.stringify(r));return r.data.rows;};
const rowFor=async(a,id)=>(await rows(a)).find(r=>r.assessmentId===id);
const eventBoundary=async()=>(await db.query(`select p.oid::regprocedure::text name,md5(pg_get_functiondef(p.oid)) hash,p.proacl::text acl from pg_proc p where p.oid in ('architetti_private.ingest(jsonb)'::regprocedure,'architetti_private.ingest_event(jsonb)'::regprocedure,'architetti_private.ingest_event_referred(jsonb)'::regprocedure) order by name`)).rows;
try{
 await db.query('alter table auth.users add column email_confirmed_at timestamptz');
 const eventBefore=await eventBoundary();
 await db.query(await sql(m3));await db.query(await sql(m4));
 await afterPreviewCandidate(db);await afterAccountAcl(db);
 await check('1 M6 independent preflight rejects missing M4; five-step chain installs with M5 absent',async()=>{
  const text=await sql(m6),guard=text.match(/do \$\$ begin[\s\S]*?end \$\$;/)?.[0];assert(guard);
  const c=await db.pool.connect();try{await c.query('begin');await c.query('alter function patrimonial_radar_private.attribute_referral(uuid,text) rename to synthetic_missing_m4');await assert.rejects(c.query(guard),/RADAR_HANDOFF_BASELINE_MISMATCH/);}finally{await c.query('rollback');c.release();}
  await db.query(text);
  assert.equal((await db.query("select to_regprocedure('public.acquire_patrimonial_event_referral_v2(jsonb,jsonb)') fn")).rows[0].fn,null);
  assert.deepEqual(await eventBoundary(),eventBefore);
  const provider=(await db.query("select pg_get_constraintdef(oid) def from pg_constraint where conrelid='public.patrimonial_contact_external_refs'::regclass and conname='patrimonial_contact_external_refs_provider_check'")).rows[0].def;
  assert(!provider.includes('website-v2'));
  assert.equal((await db.query('select patrimonial_radar_private.pilot_enabled() enabled')).rows[0].enabled,false);
  proof.sharedEvent={functions:eventBefore,providerConstraint:provider,M5:'NOT_INSTALLED'};
 });
 await db.query('insert into patrimonial_radar_private.account_gate values(true,$1,true)',[accountMacKey(secret)]);
 await db.query("notify pgrst,'reload schema'");
 // A fresh PostgREST starts before the synthetic roles/schema exist. Its native
 // reconnect backoff can exceed six seconds; await the real RPC, not a timer.
 let ready=false;const deadline=Date.now()+60000;
 while(Date.now()<deadline){try{const r=await rpc(null,'patrimonial_radar_simple_command',{p_command:{method:'list'}});if(r.status===401&&r.body.code==='42501'){ready=true;break;}}catch{}await new Promise(ok=>setTimeout(ok,100));}assert(ready,'Native PostgREST must expose the RPC and deny anonymous EXECUTE');
 const admin=await staff('MvpAdmin',['LIST','PERSON','ASSIGN']),a=await staff('MvpA',['LIST','PERSON','ADVISOR'],true),b=await staff('MvpB',['LIST','PERSON','ADVISOR'],true);
 const code=(await rpc(a,'architetti_referral_link')).body.code;assert.match(code,/^[a-f0-9]{32}$/);
 let direct,first,directRow,referred,refReport,refRow,second;
 await check('2 direct verified account compiles, persists and enters Hub unassigned without Event or HighLevel',async()=>{
  const events=(await db.query('select count(*)::int n from public.patrimonial_contact_event_registrations')).rows[0].n;
  direct=await account('mvp-direct@example.invalid');first=await complete(direct);directRow=await rowFor(admin,first.id);
  assert.equal(directRow.handoff.assignmentState,'UNASSIGNED');assert.equal(directRow.handoff.reportState,'COMPLETED');
  assert.equal(directRow.reportId,first.snapshot.id);assert(directRow.contactId);assert.equal(directRow.handoff.source,'DIRECT');
  assert((await direct.service.read(direct.opaque,first.id)).input.answers.length>0);
  assert.equal((await direct.service.snapshot(direct.opaque,first.id)).id,first.snapshot.id);
  assert.equal((await db.query('select count(*)::int n from public.patrimonial_contact_event_registrations')).rows[0].n,events);
 });
 await check('3 direct personal Radar link assigns the existing contact/P1 authority and same report in Hub/portal',async()=>{
  referred=await account('mvp-referral@example.invalid',undefined,code);refReport=await complete(referred);refRow=await rowFor(admin,refReport.id);
  assert.equal(refRow.operatorId,a.op);assert.equal(refRow.handoff.assignmentState,'ASSIGNED');
  const owner=(await db.query('select assigned_operator_id from public.patrimonial_contacts where id=$1',[refRow.contactId])).rows[0];assert.equal(owner.assigned_operator_id,a.op);
  const personal=(await rpc(a,'architetti_personal_radar',{p_contact_id:refRow.contactId,p_case_id:refRow.id})).body;
  assert.equal(personal.ok,true,JSON.stringify(personal));assert.equal(personal.data.snapshot.id,refReport.snapshot.id);
  const network=(await rpc(admin,'architetti_client_detail',{p_contact:refRow.contactId})).body;
  assert(network.assessments.some(r=>r.id===refReport.id&&r.reportId===refReport.snapshot.id));
 });
 await check('4 second assessment/login preserves one person/contact, owner and two separate immutable reports',async()=>{
  const again=await account(referred.profile.email,referred.uid);assert.equal(again.personId,referred.personId);second=await complete(again);
  const secondRow=await rowFor(admin,second.id);assert.equal(secondRow.contactId,refRow.contactId);assert.equal(secondRow.operatorId,a.op);assert.notEqual(second.snapshot.id,refReport.snapshot.id);
  const history=await again.service.history(again.opaque);assert.equal(history.length,2);assert.equal((await hub(admin,{method:'person',id:again.personId})).data.assessments.length,2);
  assert.equal((await db.query('select count(*)::int n from public.patrimonial_contacts where email=$1',[again.profile.email])).rows[0].n,1);
  await assert.rejects(db.query('delete from patrimonial_radar_private.snapshots where id=$1',[refReport.snapshot.id]),/IMMUTABLE/);
 });
 await check('5 current contact owner B survives a later Radar link A; no second responsibility registry',async()=>{
  const r=await hub(admin,{method:'assign',id:directRow.id,operatorId:b.op,expectedRevision:directRow.assignmentRevision,requestId:randomUUID()});assert.equal(r.ok,true,JSON.stringify(r));
  const again=await account(direct.profile.email,direct.uid,code),report=await complete(again),row=await rowFor(admin,report.id);
  assert.equal(row.operatorId,b.op);assert.equal(row.contactId,directRow.contactId);
  const attribution=(await db.query('select attribution_status from patrimonial_radar_private.assessment_referrals where assessment_id=$1',[report.id])).rows[0];assert.equal(attribution.attribution_status,'EXISTING_OTHER_OWNER');
  const ps=await db.query('select i.current_operator_id,count(pa.id)::int assignments from public.patrimonial_intents i join public.patrimonial_assignments pa on pa.intent_id=i.id and pa.released_at is null where i.contact_id=$1 group by i.id',[row.contactId]);assert(ps.rows.every(x=>x.current_operator_id===b.op&&x.assignments===1));
 });
 await check('6 invalid referral goes to review; an ambiguous person never enters the distributable queue',async()=>{
  const who=await account('mvp-review@example.invalid',undefined,'0'.repeat(32)),report=await complete(who),row=await rowFor(admin,report.id);
  assert.equal(row.handoff.assignmentState,'REVIEW');assert.equal(row.operatorId,null);assert.equal(row.linkReview,true);
 });
 await check('7 Auth/Advisor/ownership/revocation and private-schema ACL remain enforced',async()=>{
  assert.equal((await hub(admin,{method:'report',id:refRow.id})).ok,false);
  assert.equal((await hub(a,{method:'report',id:refRow.id})).ok,true);
  assert.equal((await hub(b,{method:'report',id:refRow.id})).ok,false);
  await assert.rejects(direct.service.read(direct.opaque,refReport.id));
  assert.equal((await hub(direct,{method:'list'})).ok,false);
  await assert.rejects(db.transaction(c=>c.query('select * from patrimonial_radar_private.snapshots'),'authenticated',{sub:direct.uid,session_id:direct.sid}),e=>e.code==='42501');
  assert.deepEqual((await db.query("select has_schema_privilege('authenticated','public','USAGE') ap,has_schema_privilege('anon','public','USAGE') np,has_schema_privilege('authenticated','hub','USAGE') ah")).rows[0],{ap:false,np:false,ah:true});
  await db.query("update hub.patrimonial_radar_permissions set revoked_at=now(),revision=revision+1 where user_id=$1 and permission='RADAR_PATRIMONIAL_ADVISOR'",[a.uid]);
  assert.equal((await hub(a,{method:'report',id:refRow.id})).ok,false);
  await db.query('delete from auth.sessions where id=$1',[referred.sid]);await assert.rejects(referred.service.read(referred.opaque,refReport.id));
 });
 await check('8 shared Event definitions unchanged, kill switch denies reads/writes, reports retained',async()=>{
  assert.deepEqual(await eventBoundary(),eventBefore);
  const before=(await db.query('select count(*)::int n from patrimonial_radar_private.snapshots')).rows[0].n;
  await db.query('update patrimonial_radar_private.account_gate set enabled=false');
  await assert.rejects(direct.service.read(direct.opaque,first.id));await assert.rejects(direct.service.create(direct.opaque,{requestId:randomUUID(),noticeVersion:SERVICE_NOTICE_VERSION}));
  assert.equal((await hub(admin,{method:'list'})).code,'UNAVAILABLE');
  assert.equal((await db.query('select count(*)::int n from patrimonial_radar_private.snapshots')).rows[0].n,before);
  proof.reportsRetained=before;proof.baseline5dChecks=baseline5d.passed;
 });
}finally{await writeFile(arg('evidence'),JSON.stringify(proof,null,2)+'\n');await db.close();}
