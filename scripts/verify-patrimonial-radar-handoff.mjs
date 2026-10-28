// Incremental rehearsal: requires a COPY of the completed M1-M5 native fixture,
// then local M6. Never resets a schema or connects to a provider/database remotely.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {startEventV2HttpFixture} from './lib/patrimonial-event-v2-http-fixture.mjs';
import {buildFixture} from './patrimonial-radar-fixtures.mjs';
import {dependencyOrder} from '../src/lib/patrimonial-radar/answers.ts';
import {SERVICE_NOTICE_VERSION} from '../src/lib/patrimonial-radar-server/contracts.ts';
const arg=k=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3);
assert(arg('pg-module')&&arg('local-config')&&arg('evidence'));
const cfg=JSON.parse(fs.readFileSync(arg('local-config'),'utf8'));
assert.equal(cfg.databaseUrl,'postgres://postgres@127.0.0.1:15449/radar_5d_test');
assert.equal(cfg.postgrestUrl,'http://127.0.0.1:15450');
const {default:pg}=await import(pathToFileURL(resolve(arg('pg-module'))));
const db=new pg.Pool({connectionString:cfg.databaseUrl,max:4});
const secret='synthetic-account-5c-secret-0000000000000000000000000000000000';
const proof={scope:'INCREMENTAL_NATIVE_LOCAL_SYNTHETIC',remoteWrites:0,realAuth:'NOT_RUN_SYNTHETIC_GOTRUE',email:'NOT_RUN',checks:[],records:[]};
const check=async(name,f)=>{await f();proof.checks.push({name,status:'PASS'});console.log('PASS '+name);};
const inherited=JSON.parse(fs.readFileSync('docs/patrimonial/evento-v2-radar-evidence/manifest.json','utf8'));
for(const x of inherited.files){
 const b=fs.readFileSync('docs/patrimonial/evento-v2-radar-evidence/'+x.file);
 const normalized=/\.json$/.test(x.file)?Buffer.from(b.toString().replaceAll('\r\n','\n')):b;
 assert.equal(createHash('sha256').update(normalized).digest('hex'),x.sha256,x.file);
}
proof.inheritedEvidence={verifiedFiles:inherited.files.length,native:68,websiteSuites:19,hubTests:201,portalTests:56,rerun:false};
const fx=await startEventV2HttpFixture({db,cfg,secret,evidence:arg('evidence')});
const call=async(a,name,body={})=>{
 const r=await fetch(cfg.postgrestUrl+'/rpc/'+name,{method:'POST',headers:{...(a?{Authorization:'Bearer '+a.token}:{}),'Content-Type':'application/json','Content-Profile':'hub','Accept-Profile':'hub'},body:JSON.stringify(body)});
 return{status:r.status,body:await r.json()};
};
const hub=async(a,c)=>(await call(a,'patrimonial_radar_simple_command',{p_command:c})).body;
async function actor(name,permissions=[],operator=false){
 const uid=randomUUID(),sid=randomUUID(),op=operator?randomUUID():null;
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[uid,name+'@staff.invalid']);
 await db.query("insert into auth.sessions(id,user_id,not_after) values($1,$2,now()+interval '1 hour')",[sid,uid]);
 await db.query("insert into hub.user_roles(user_id,email,role) values($1,$2,'superadmin')",[uid,name+'@staff.invalid']);
 if(op)await db.query("insert into public.patrimonial_operators(id,operator_key,display_name,user_id,network_enabled,network_role) values($1,$2,$3,$4,true,'architect')",[op,'closure-'+op,name,uid]);
 for(const p of permissions)await db.query("insert into hub.patrimonial_radar_permissions(user_id,permission,operator_id,expires_at,evidence_ref) values($1,$2,$3,now()+interval '1 hour','SYNTHETIC_CLOSURE_ONLY')",[uid,'RADAR_PATRIMONIAL_'+p,p==='ADVISOR'?op:null]);
 return{uid,sid,op,token:fx.jwt({sub:uid,session_id:sid})};
}
async function login(lead,referralCode){
 const cookies=new Map();let csrf='request-code';
 async function request(path,body,csrfOverride){
  const r=await fetch(fx.origin+'/api/patrimonial-radar'+path,{method:body===undefined?'GET':'POST',headers:{Origin:fx.origin,'Content-Type':'application/json','X-Patrimonial-CSRF':csrfOverride??csrf,Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; ')},...(body===undefined?{}:{body:JSON.stringify(body)})});
  for(const raw of r.headers.getSetCookie()){const pair=raw.split(';')[0],i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1));}
  const v=await r.json();assert(r.ok,JSON.stringify(v));if(v.csrf)csrf=v.csrf;return v;
 }
 if(referralCode!==undefined)await request('/referral',{code:referralCode},'referral-context');
 const challenge=await request('/identity/request',{email:lead.email,firstName:lead.firstName,lastName:lead.lastName});
 const identity=await request('/identity/verify',{challengeId:challenge.challengeId,code:'123456'});
 return{request,identity};
}
async function complete(client){
 const c=await client.request('/assessments',{requestId:randomUUID(),noticeVersion:SERVICE_NOTICE_VERSION});
 const current=(await client.request('/assessments/'+c.id)).assessment,input=buildFixture('T02');let rev=0;
 const dates=x=>!x||typeof x!=='object'?x:Array.isArray(x)?x.map(dates):Object.fromEntries(Object.entries(x).map(([k,v])=>[k,k==='asOf'?current.input.asOf:dates(v)]));
 for(const q of dependencyOrder()){
  const a=input.answers.filter(a=>a.id===q).at(-1);if(!a)continue;
  try{rev=(await client.request('/assessments/'+c.id+'/answer',{requestId:randomUUID(),expectedRevision:rev,questionId:q,state:a.state,...(a.state==='VALUE'?{value:dates(a.value)}:{})})).revision;}catch(e){if(!e.message.includes('INVALID'))throw e;}
 }
 return{id:c.id,snapshot:await client.request('/assessments/'+c.id+'/complete',{requestId:randomUUID(),expectedRevision:rev})};
}
const list=async a=>{const r=await hub(a,{method:'list'});assert.equal(r.ok,true,JSON.stringify(r));return r.data.rows;};
let admin,a,code,lead,client,radar,row,refRadar,directRadar;
try{
 admin=await actor('ClosureAdmin',['LIST','PERSON','ASSIGN']);
 a=await actor('ClosureA',['LIST','PERSON','ADVISOR'],true);
 code=(await call(a,'architetti_referral_link')).body.code;assert.match(code,/^[a-f0-9]{32}$/);
 const baseline=(await db.query("select md5(pg_get_functiondef('public.patrimonial_assignment_guard()'::regprocedure)) p1,md5(pg_get_functiondef('public.patrimonial_assignment_commit(jsonb,bigint)'::regprocedure)) commit")).rows[0];
 const commercial=async()=> (await db.query("select id,kind,stage,next_step,next_step_at from public.patrimonial_intents where kind<>'RADAR' order by id")).rows;
 const before=await commercial();
 const businessTables=async()=> (await db.query("select 'activities' kind,md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,'[]')) digest from public.patrimonial_activities t union all select 'contracts',md5(coalesce(jsonb_agg(to_jsonb(t) order by t.id)::text,'[]')) from public.patrimonial_contracts t order by kind")).rows;
 const businessBefore=await businessTables();
 await check('inherited 68 native and actual HTTP evidence hashes verified; no full reset',async()=>assert.equal(proof.inheritedEvidence.verifiedFiles,13));
 await check('Event receipt is exact and has no follow-up, invitation or commercial CTA',async()=>{
  const r=await fetch(fx.origin+'/benessere-patrimoniale/evento/grazie');assert.equal(r.status,200);
  const html=await r.text(),h1=html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g,'').replaceAll('&#x27;',"'");
  assert.equal(h1,"Abbiamo ricevuto la tua richiesta di partecipazione all'evento.");
  const page=html.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1];assert(page);
  assert(!/Prima dell.evento|Ti invieremo|mailto:|event-radar|Verifica la tua email/.test(page));
 });
 await check('Event A -> ACTUAL HTTP v2 -> verified account -> Radar A; no SQL registration shortcut',async()=>{
  lead={contractVersion:'patrimonial-lead-v2',requestId:randomUUID(),mode:'patrimonial-event',sourcePath:'/benessere-patrimoniale/evento',firstName:'Chiusura',lastName:'Inventata',email:'closure-'+randomUUID()+'@example.invalid',phone:'',province:'Milano',profile:'',message:'Scenario inventato',consent:true,marketingConsent:false,utm:{},website:'',referralCode:code};
  assert.equal((await fetch(fx.origin+'/benessere-patrimoniale/evento?ref='+code)).status,200);
  const r=await fetch(fx.origin+'/api/public-leads',{method:'POST',headers:{Origin:fx.origin,'Content-Type':'application/json','Idempotency-Key':lead.requestId},body:JSON.stringify(lead)});
  assert.equal(r.status,202,await r.text());client=await login(lead);radar=await complete(client);
  row=(await list(admin)).find(x=>x.assessmentId===radar.id);assert(row);
  assert.equal(row.handoff.assignmentState,'ASSIGNED');assert.equal(row.handoff.p1OperatorId,a.op);
  assert.equal(row.handoff.source,'EVENT');assert.equal(row.handoff.radarEntry,'DIRECT');
  assert(row.handoff.eventRequests.some(x=>x.id===lead.requestId));
  assert.equal(row.handoff.eventRegistrations.length,1);assert.equal(row.handoff.eventRegistrations[0].referralOperatorId,a.op);
  assert.equal(row.handoff.eventRegistrations[0].status,'PENDING_EDITION');
  assert.equal(row.handoff.reportId,radar.snapshot.id);assert.equal(row.handoff.reportState,'COMPLETED');
  assert.equal(Date.parse(row.handoff.completedAt),Date.parse(radar.snapshot.completedAt));
  assert(Date.parse(row.handoff.receivedAt)<=Date.parse(row.handoff.completedAt));
  proof.records.push({scenario:'EVENT_A',...row.handoff});
 });
 await check('Radar link A -> same P1; direct known A preserves contact and new immutable history',async()=>{
  const fresh={firstName:'Link',lastName:'Inventato',email:'closure-link-'+randomUUID()+'@example.invalid'};
  const ref=await login(fresh,code);refRadar=await complete(ref);
  const r=(await list(admin)).find(x=>x.assessmentId===refRadar.id).handoff;
  assert.equal(r.source,'RADAR_LINK');assert.equal(r.referralOperatorId,a.op);assert.equal(r.p1OperatorId,a.op);assert.equal(r.assignmentState,'ASSIGNED');
  const direct=await login(fresh);directRadar=await complete(direct);
  const d=(await list(admin)).find(x=>x.assessmentId===directRadar.id).handoff;
  assert.equal(d.source,'DIRECT');assert.equal(d.contactId,r.contactId);assert.equal(d.personId,r.personId);assert.equal(d.p1OperatorId,a.op);
  assert.notEqual(d.assessmentId,r.assessmentId);assert.notEqual(d.reportId,r.reportId);
  const history=await direct.request('/assessments');assert.equal(history.length,2);
  assert.equal((await direct.request('/assessments/'+refRadar.id+'/snapshot')).resultHash,refRadar.snapshot.resultHash);
  proof.records.push({scenario:'RADAR_LINK_A',...r},{scenario:'DIRECT_KNOWN_A',...d});
 });
 await check('direct new -> completed private report -> UNASSIGNED administrative queue',async()=>{
  const fresh=await login({firstName:'Nuova',lastName:'Inventata',email:'closure-direct-'+randomUUID()+'@example.invalid'});
  const x=await complete(fresh),r=(await list(admin)).find(v=>v.assessmentId===x.id).handoff;
  assert.equal(r.assignmentState,'UNASSIGNED');assert(r.contactId);assert.equal(r.p1OperatorId,null);assert.equal(r.source,'DIRECT');assert.equal(r.reportState,'COMPLETED');
  assert((await list(admin)).filter(v=>v.handoff.assignmentState==='UNASSIGNED'&&v.handoff.reportState==='COMPLETED').some(v=>v.handoff.assessmentId===x.id));
  proof.records.push({scenario:'DIRECT_NEW_QUEUE',...r});
 });
 await check('existing B following A keeps B; ambiguous/revoked/discordant are REVIEW',async()=>{
  const rows=await list(admin);
  const b=rows.find(v=>v.email==='referral-owner-b@example.invalid'&&v.handoff.referralAttribution==='EXISTING_OTHER_OWNER');
  assert(b);assert.notEqual(b.handoff.referralOperatorId,b.handoff.p1OperatorId);
  const owner=(await db.query('select assigned_operator_id from public.patrimonial_contacts where id=$1',[b.handoff.contactId])).rows[0].assigned_operator_id;
  assert.equal(b.handoff.p1OperatorId,owner);
  for(const email of ['referral-ambiguous@example.invalid','referral-revoked@example.invalid','discordant@example.invalid']){
   const r=rows.find(v=>v.email===email);assert(r,email);assert.equal(r.handoff.assignmentState,'REVIEW',email);
  }
  assert.equal(rows.find(v=>v.email==='referral-ambiguous@example.invalid').handoff.contactId,null);
 });
 await check('Hub list, Rete Clienti and personal portal use identical canonical IDs/reports',async()=>{
  const response=await call(a,'architetti_client_detail',{p_contact:row.handoff.contactId});assert.equal(response.status,200,JSON.stringify(response.body));
  const detail=response.body;
  assert(detail.assessments.some(v=>v.id===radar.id&&v.caseId===row.id&&v.reportId===radar.snapshot.id),JSON.stringify(detail));
  const personal=(await call(a,'architetti_personal_radar',{p_contact_id:row.handoff.contactId,p_case_id:null})).body;
  assert.equal(personal.ok,true);assert(personal.data.assessments.some(v=>v.id===radar.id&&v.reportId===radar.snapshot.id));
  const report=await hub(a,{method:'report',id:row.id});assert.equal(report.ok,true);assert.equal(report.data.snapshot.id,radar.snapshot.id);
 });
 await check('no improper Advisor, unrelated architect, account, anon or stale session metadata access',async()=>{
  const no=await actor('ClosureNoAdvisor',['LIST','PERSON']);
  assert.equal((await hub(no,{method:'report',id:row.id})).ok,false);
  const other=await actor('ClosureOther',['ADVISOR'],true);
  assert.equal((await call(other,'architetti_personal_radar',{p_contact_id:row.handoff.contactId,p_case_id:row.id})).body.ok,false);
  const account=(await db.query("select s.user_id,s.id from auth.sessions s join auth.users u on u.id=s.user_id where u.email=$1 order by s.not_after desc limit 1",[lead.email])).rows[0];
  const consumer={token:fx.jwt({sub:account.user_id,session_id:account.id})};
  assert.equal((await hub(consumer,{method:'list'})).ok,false);
  assert.equal((await call(null,'patrimonial_radar_simple_command',{p_command:{method:'list'}})).status,401);
  await db.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1",[no.sid]);
  assert.equal((await hub(no,{method:'list'})).ok,false);
 });
 await check('metadata contains no answers/results; original list contract preserved',async()=>{
  const rows=await list(admin);for(const r of rows){
   assert.equal(r.id,r.handoff.caseId);assert.equal(r.personId,r.handoff.personId);assert.equal(r.reportId,r.handoff.reportId);
   assert(!['answers','result','profile','email','name','referralCode'].some(k=>Object.hasOwn(r.handoff,k)));
   const h=r.handoff;if(h.reportState==='DRAFT'){assert.equal(h.completedAt,null);assert.equal(h.reportId,null);}
  }
  const closed=await hub(admin,{method:'list',filters:{status:'COMPLETED',operatorId:'UNASSIGNED'}});
  assert.equal(closed.ok,true);assert(closed.data.rows.every(r=>r.operatorId===null&&r.status==='COMPLETED'));
 });
 await check('least-privilege ACL; hidden pre-handoff entry; P1 definitions unchanged',async()=>{
  for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_schema_privilege($1,'public','USAGE') ok",[role])).rows[0].ok,false);
  for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("select has_function_privilege($1,'hub.patrimonial_radar_simple_command_pre_handoff(jsonb)','EXECUTE') ok",[role])).rows[0].ok,false);
  const now=(await db.query("select md5(pg_get_functiondef('public.patrimonial_assignment_guard()'::regprocedure)) p1,md5(pg_get_functiondef('public.patrimonial_assignment_commit(jsonb,bigint)'::regprocedure)) commit")).rows[0];
  assert.deepEqual(now,baseline);proof.p1=now;
 });
 await check('no automatic sale, call, appointment, attendance or CRM transition',async()=>{
  const after=await commercial(),oldIds=new Set(before.map(x=>x.id));
  assert.deepEqual(after.filter(x=>oldIds.has(x.id)),before);
  const acquired=after.filter(x=>!oldIds.has(x.id));
  const receipt=(await db.query('select intent_id from public.patrimonial_requests where request_id=$1',[lead.requestId])).rows[0];
  // Canonical Event acquisition legitimately creates one PROVISIONAL receipt
  // intent. It must not create an opportunity or completed commercial action.
  assert.deepEqual(acquired,[{id:receipt.intent_id,kind:'PROVISIONAL',stage:null,next_step:null,next_step_at:null}]);
  assert.deepEqual(await businessTables(),businessBefore);
  const intents=(await db.query("select stage,next_step,next_step_at,remote_contact_id,remote_opportunity_id,sync_state from public.patrimonial_intents where id in (select intent_id from patrimonial_radar_private.cases where assessment_id=any($1::uuid[]))",[[radar.id,refRadar.id,directRadar.id]])).rows;
  assert(intents.every(v=>v.stage===null&&v.next_step===null&&v.next_step_at===null&&v.remote_contact_id===null&&v.remote_opportunity_id===null&&v.sync_state==='MANUAL_REVIEW'));
  assert.equal((await db.query("select count(*)::int n from public.patrimonial_participations where attendance='ATTENDED'")).rows[0].n,0);
  assert.equal(fx.counters.highlevel,0);assert.equal(fx.counters.emails,0);
  assert(fx.rpcNames.acquire_patrimonial_event_referral_v2>=1);proof.counters=fx.counters;
 });
 proof.status='PASS';fs.writeFileSync(resolve(arg('evidence'),'handoff-result.json'),JSON.stringify(proof,null,2)+'\n');
}finally{await fx.close();await db.end();}
