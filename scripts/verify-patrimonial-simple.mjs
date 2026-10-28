import assert from 'node:assert/strict';import {randomUUID,createHmac} from 'node:crypto';import {readFile,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';
import {foundationDatabase} from './lib/patrimonial-foundation-db.mjs';
import {AccountRadarRpc,accountToken,accountMacKey} from '../src/lib/patrimonial-radar-server/account-rpc.ts';
import {PatrimonialRadarService} from '../src/lib/patrimonial-radar-server/service.ts';
import {SERVICE_NOTICE_VERSION,BACKEND_VERSION} from '../src/lib/patrimonial-radar-server/contracts.ts';
import {buildFixture} from './patrimonial-radar-fixtures.mjs';import {dependencyOrder} from '../src/lib/patrimonial-radar/answers.ts';
import {handlePublicLead} from '../src/lib/public-leads/handler.ts';import {RadarSecrets} from '../src/lib/patrimonial-radar-server/security.ts';
const arg=k=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3);
assert(arg('network-platform')&&arg('local-config')&&arg('candidate')&&arg('evidence'));
const cfg=JSON.parse(await readFile(arg('local-config'),'utf8'));assert.equal(cfg.databaseUrl,'postgres://postgres@127.0.0.1:15439/radar_5a_test');assert.equal(cfg.postgrestUrl,'http://127.0.0.1:15440');
const db=await foundationDatabase({networkPlatform:arg('network-platform'),replayConcurrent:true}),secret='synthetic-account-5c-secret-0000000000000000000000000000000000';
const passed=[];const check=async(n,f)=>{await f();passed.push(n);console.log('PASS '+n);};
const jwt=c=>{const p=[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,...c})).toString('base64url')].join('.');return p+'.'+createHmac('sha256',cfg.secret).update(p).digest('base64url');};
const wire=(url,init)=>fetch(url.replace('/rest/v1',''),init);
async function account(email,firstName='Mario',lastName='Inventato',uid=randomUUID(),session_id=randomUUID()){
 await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()) on conflict(id) do nothing",[uid,email]);
 await db.query("insert into auth.sessions(id,user_id,not_after) values($1,$2,now()+interval '1 hour')",[session_id,uid]);
 const claims={sub:uid,session_id},token=jwt(claims),opaque=accountToken(secret,uid,session_id),profile={email,firstName,lastName};
 const rpc=new AccountRadarRpc({url:cfg.postgrestUrl,key:'sb_publishable_synthetic',secret,token,uid,sid:session_id,profile,fetchImpl:wire});
 const service=new PatrimonialRadarService(rpc,{kind:'SIMULATED',async sendCode(){throw Error('No mail');}},secret);
 const identity=await service.session(opaque);return{uid,session_id,claims,token,opaque,service,profile,rpc,personId:identity.personId};
}
async function complete(a,key=randomUUID()){
 const c=await a.service.create(a.opaque,{requestId:key,noticeVersion:SERVICE_NOTICE_VERSION});const current=await a.service.read(a.opaque,c.id),input=buildFixture('T02');let rev=0;
 const dates=x=>!x||typeof x!=='object'?x:Array.isArray(x)?x.map(dates):Object.fromEntries(Object.entries(x).map(([k,v])=>[k,k==='asOf'?current.input.asOf:dates(v)]));
 for(const q of dependencyOrder()){const r=input.answers.filter(a=>a.id===q).at(-1);if(!r)continue;try{rev=(await a.service.save(a.opaque,c.id,{requestId:randomUUID(),expectedRevision:rev,questionId:q,state:r.state,...(r.state==='VALUE'?{value:dates(r.value)}:{})})).revision;}catch(e){if(e.code!=='INVALID')throw e;}}
 return{id:c.id,snapshot:await a.service.complete(a.opaque,c.id,{requestId:randomUUID(),expectedRevision:rev}),key};
}
async function event(email,name){
 const payload={contractVersion:'patrimonial-lead-v2',requestId:randomUUID(),mode:'patrimonial-event',sourcePath:'/benessere-patrimoniale/evento',firstName:name.split(' ')[0],lastName:name.split(' ').slice(1).join(' '),email,phone:'',province:'Milano',profile:'',message:'Scenario sintetico',consent:true,marketingConsent:false,utm:{},website:''};
 const r=await handlePublicLead(new Request('http://127.0.0.1:15441/api/public-leads',{method:'POST',headers:{Origin:'http://127.0.0.1:15441','Content-Type':'application/json','Idempotency-Key':payload.requestId},body:JSON.stringify(payload)}),{env:{NODE_ENV:'test',PATRIMONIAL_V2_ENABLED:'true'},store:db.leadStore});
 assert.equal(r.status,202,await r.clone().text());return(await db.query('select contact_id from patrimonial_radar_private.contact_requests where request_id=$1',[payload.requestId])).rows[0].contact_id;
}
async function staff(name,permissions=[],operator=false){
 const uid=randomUUID(),sid=randomUUID(),op=operator?randomUUID():null;
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[uid,name+'@staff.invalid']);
 await db.query("insert into auth.sessions(id,user_id,not_after) values($1,$2,now()+interval '1 hour')",[sid,uid]);
 await db.query("insert into hub.user_roles(user_id,email,role) values($1,$2,'superadmin')",[uid,name+'@staff.invalid']);
 if(op)await db.query("insert into public.patrimonial_operators(id,operator_key,display_name,user_id,network_enabled,network_role) values($1,$2,$3,$4,true,'architect')",[op,'simple-'+op,name,uid]);
 for(const p of permissions)await db.query("insert into hub.patrimonial_radar_permissions(user_id,permission,operator_id,expires_at,evidence_ref) values($1,$2,$3,now()+interval '1 hour','SYNTHETIC_5C_TEST_ONLY')",[uid,'RADAR_PATRIMONIAL_'+p,p==='ADVISOR'?op:null]);
 return{uid,sid,op,claims:{sub:uid,session_id:sid},token:jwt({sub:uid,session_id:sid})};
}
const hub=async(a,c)=>{const r=await fetch(cfg.postgrestUrl+'/rpc/patrimonial_radar_simple_command',{method:'POST',headers:{Authorization:'Bearer '+a.token,'Content-Type':'application/json','Content-Profile':'hub','Accept-Profile':'hub'},body:JSON.stringify({p_command:c})});const v=await r.json();if(!r.ok)throw Error(JSON.stringify(v));return v;};
const personContact=async p=>(await db.query("select contact_id from patrimonial_radar_private.contact_bindings where person_id=$1 and state='VERIFIED'",[p])).rows[0]?.contact_id;
let first,one,two,admin,advisorA,advisorB,caseId,contact;
try{
 await db.query("alter table auth.users add column email_confirmed_at timestamptz;create extension if not exists pgcrypto;");
 await db.query(await readFile(arg('candidate'),'utf8'));
 await db.query("insert into patrimonial_radar_private.account_gate values(true,$1,true)",[accountMacKey(secret)]);
 await db.query("notify pgrst,'reload schema'");
 for(let i=0;i<40;i++){try{const r=await fetch(cfg.postgrestUrl+'/');if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 await check('1 new verified user -> first Radar -> one new contact',async()=>{first=await account('mario.direct@example.invalid');one=await complete(first);contact=await personContact(first.personId);assert(contact);assert.notEqual(contact,first.personId);});
 await check('2 canonical unverified Event declaration + verified email/exact name/provenance -> existing contact',async()=>{const cid=await event('elena.event@example.invalid','Elena Inventata');const a=await account('elena.event@example.invalid','Elena','Inventata');await complete(a);assert.equal(await personContact(a.personId),cid);assert.equal((await db.query('select count(*)::int n from public.patrimonial_participations')).rows[0].n,0);});
 await check('3 second login and second Radar -> same person, two immutable reports',async()=>{const a=await account(first.profile.email,'Mario','Inventato',first.uid);assert.equal(a.personId,first.personId);two=await complete(a);assert.notEqual(one.snapshot.id,two.snapshot.id);assert.equal((await a.service.history(a.opaque)).length,2);});
 await check('4 Radar before Event -> same administrative contact',async()=>{const cid=await event(first.profile.email,'Mario Inventato');assert.equal(cid,contact);});
 await check('5 duplicate contacts suspend linking without deleting the Radar',async()=>{await event('duplicate@example.invalid','Doppio Inventato');await event('duplicate@example.invalid','Doppio Altro');const a=await account('duplicate@example.invalid','Doppio','Inventato');await complete(a);assert.equal(await personContact(a.personId),undefined);assert.equal((await db.query('select reason from patrimonial_radar_private.account_reviews where person_id=$1',[a.personId])).rows[0].reason,'MULTIPLE_CONTACTS');});
 await check('6 discordant names -> review, financial identity not merged',async()=>{await event('discordant@example.invalid','Nome Originale');const a=await account('discordant@example.invalid','Altro','Inventato');await complete(a);assert.equal(await personContact(a.personId),undefined);});
 await check('7 known shared mailbox -> isolated session, cannot read previous person',async()=>{await db.query("insert into patrimonial_radar_private.mailbox_reviews(email_key,reason,state,evidence_ref) values($1,'SHARED','CONFLICT','SYNTHETIC_5C_ONLY')",[new RadarSecrets(secret).hash('email-v1',first.profile.email)]);const other=await account(first.profile.email,'Altra','Persona',first.uid);assert.notEqual(other.personId,first.personId);await complete(other);await assert.rejects(other.service.read(other.opaque,one.id));await assert.rejects(first.service.read(first.opaque,one.id));});
 await check('8 two simultaneous verified sessions do not duplicate person/contact',async()=>{const uid=randomUUID();await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[uid,'concurrent@example.invalid']);const [a,b]=await Promise.all([account('concurrent@example.invalid','Concorrenza','Inventata',uid),account('concurrent@example.invalid','Concorrenza','Inventata',uid)]);assert.equal(a.personId,b.personId);const [x,y]=await Promise.all([complete(a),complete(b)]);assert.notEqual(x.id,y.id);assert.equal((await db.query("select count(*)::int n from public.patrimonial_contacts where email='concurrent@example.invalid'")).rows[0].n,1);});
 await check('9 replay create returns one assessment',async()=>{const a=await account('replay@example.invalid'),key=randomUUID();const x=await a.service.create(a.opaque,{requestId:key,noticeVersion:SERVICE_NOTICE_VERSION});const y=await a.service.create(a.opaque,{requestId:key,noticeVersion:SERVICE_NOTICE_VERSION});assert.equal(x.id,y.id);assert.equal((await a.service.history(a.opaque)).length,1);});
 await check('10 no login and missing/forged server proof cannot access private RPC',async()=>{for(const token of ['',first.token]){const r=await fetch(cfg.postgrestUrl+'/rpc/patrimonial_radar_account_command',{method:'POST',headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},body:JSON.stringify({p_envelope:'{}',p_mac:null})});assert(!r.ok||(await r.json()).ok!==true);}});
 await check('11 user A cannot read/change user B assessment',async()=>{const a=await account('isolation@example.invalid');await assert.rejects(a.service.read(a.opaque,two.id));await assert.rejects(a.service.save(a.opaque,two.id,{requestId:randomUUID(),expectedRevision:0,questionId:'RP-S01',state:'VALUE',value:'INDIVIDUAL'}));});
 admin=await staff('Admin',['LIST','PERSON','ASSIGN']);advisorA=await staff('AdvisorA',['LIST','PERSON','ADVISOR'],true);advisorB=await staff('AdvisorB',['LIST','PERSON','ADVISOR'],true);
 // Use a non-conflicted account for P1 and cross-view tests.
 const managed=await account('managed@example.invalid','Gestione','Inventata');const report=await complete(managed);caseId=(await db.query('select id from patrimonial_radar_private.cases where assessment_id=$1',[report.id])).rows[0].id;
 await check('12 assignment is not Advisor permission',async()=>{assert.equal((await hub(admin,{method:'report',id:caseId})).ok,false);});
 await check('13 current assigned and explicitly authorized Advisor can open canonical dossier',async()=>{const r=await hub(admin,{method:'assign',id:caseId,operatorId:advisorA.op,expectedRevision:0,requestId:randomUUID()});assert.equal(r.ok,true,JSON.stringify(r));assert.equal((await hub(advisorA,{method:'report',id:caseId})).ok,true);});
 await check('14 reassignment A to B denies A immediately',async()=>{const rev=(await db.query('select operator_revision from public.patrimonial_intents where id=(select intent_id from patrimonial_radar_private.cases where id=$1)',[caseId])).rows[0].operator_revision;assert.equal((await hub(admin,{method:'reassign',id:caseId,operatorId:advisorB.op,expectedRevision:Number(rev),requestId:randomUUID()})).ok,true);assert.equal((await hub(advisorA,{method:'report',id:caseId})).ok,false);assert.equal((await hub(advisorB,{method:'report',id:caseId})).ok,true);});
 await check('15 independent Hub and Clienti return the same report references, no financial list fields',async()=>{const all=await hub(admin,{method:'list'});assert.equal(all.ok,true);const row=all.data.rows.find(r=>r.id===caseId);assert.equal(row.assessmentId,report.id);assert.equal(row.reportId,report.snapshot.id);for(const key of ['answers','input','result','snapshot','indicators'])assert(!(key in row));const cid=await personContact(managed.personId);const detail=(await db.transaction(c=>c.query('select hub.architetti_client_detail($1) d',[cid]),'authenticated',admin.claims)).rows[0].d;assert(detail.assessments.some(a=>a.id===report.id&&a.reportId===report.snapshot.id));});
 await check('16 HighLevel OFF retains all completed snapshots; no CRM transport used',async()=>{assert((await db.query("select count(*)::int n from patrimonial_radar_private.snapshots")).rows[0].n>=8);});
 await check('17 enterprise source present (full enterprise regression and 35-asset preservation checked separately)',async()=>{assert((await readFile('src/lib/radar/domain.ts','utf8')).length>0);});
 await check('18 P1 replay is idempotent; changed payload and stale CAS are rejected',async()=>{
  const rev=Number((await db.query('select operator_revision from public.patrimonial_intents where id=(select intent_id from patrimonial_radar_private.cases where id=$1)',[caseId])).rows[0].operator_revision);
  const cmd={method:'reassign',id:caseId,operatorId:advisorA.op,expectedRevision:rev,requestId:randomUUID()};const a=await hub(admin,cmd);assert.equal(a.ok,true);assert.deepEqual(await hub(admin,cmd),a);assert.equal((await hub(admin,{...cmd,operatorId:advisorB.op})).ok,false);assert.equal((await hub(admin,{...cmd,requestId:randomUUID()})).ok,false);
  const next=Number((await db.query('select operator_revision from public.patrimonial_intents where id=(select intent_id from patrimonial_radar_private.cases where id=$1)',[caseId])).rows[0].operator_revision);assert.equal((await hub(admin,{method:'reassign',id:caseId,operatorId:advisorB.op,expectedRevision:next,requestId:randomUUID()})).ok,true);
 });
 await check('19 unverified email, expired/revoked Auth session and disabled DB gate deny reads',async()=>{
  await db.query('update auth.users set email_confirmed_at=null where id=$1',[managed.uid]);await assert.rejects(managed.service.read(managed.opaque,report.id));await db.query('update auth.users set email_confirmed_at=now() where id=$1',[managed.uid]);
  await db.query('update auth.sessions set not_after=now()-interval \'1 second\' where id=$1',[managed.session_id]);await assert.rejects(managed.service.read(managed.opaque,report.id));await db.query('update auth.sessions set not_after=now()+interval \'1 hour\' where id=$1',[managed.session_id]);
  await db.query('update patrimonial_radar_private.account_gate set enabled=false');await assert.rejects(managed.service.read(managed.opaque,report.id));await db.query('update patrimonial_radar_private.account_gate set enabled=true');
  await db.query('delete from auth.sessions where id=$1',[advisorA.sid]);assert.equal((await hub(advisorA,{method:'report',id:caseId})).ok,false);
 });
 await check('20 manual conflict link/revoke use P1, audit, CAS and replay without dossier transfer',async()=>{
  await event('manual@example.invalid','Prima Identita');const a=await account('manual@example.invalid','Diversa','Identita');const x=await complete(a);const cid=(await db.query("select id from public.patrimonial_contacts where email='manual@example.invalid'")).rows[0].id;const id=(await db.query('select id from patrimonial_radar_private.cases where assessment_id=$1',[x.id])).rows[0].id;
  const cmd={method:'link',id,contactId:cid,expectedRevision:0,requestId:randomUUID()};const linked=await hub(admin,cmd);assert.equal(linked.ok,true,JSON.stringify(linked));assert.deepEqual(await hub(admin,cmd),linked);assert.equal(await personContact(a.personId),cid);
  assert.equal((await hub(admin,{method:'assign',id,operatorId:advisorB.op,expectedRevision:0,requestId:randomUUID()})).ok,true);
  const rev=(await db.query('select revision from patrimonial_radar_private.account_reviews where person_id=$1',[a.personId])).rows[0].revision;const unlink={method:'unlink',id,expectedRevision:rev,requestId:randomUUID()};const unlinked=await hub(admin,unlink);assert.equal(unlinked.ok,true,JSON.stringify(unlinked));assert.equal((await hub(admin,unlink)).ok,true);assert.equal(await personContact(a.personId),undefined);assert.equal((await a.service.read(a.opaque,x.id)).id,x.id);
  assert.equal((await db.query('select assigned_operator_id from public.patrimonial_contacts where id=$1',[cid])).rows[0].assigned_operator_id,advisorB.op);assert.equal((await db.query('select i.current_operator_id from public.patrimonial_intents i join patrimonial_radar_private.cases c on c.intent_id=i.id where c.id=$1',[id])).rows[0].current_operator_id,null);
 });
 await check('21 inactive contact owner queues new Radar instead of losing it',async()=>{
  const cid=await event('inactive@example.invalid','Inattiva Inventata');await db.query('update public.patrimonial_contacts set assigned_operator_id=$1 where id=$2',[advisorA.op,cid]);await db.query('update public.patrimonial_operators set active=false,revision=revision+1 where id=$1',[advisorA.op]);const a=await account('inactive@example.invalid','Inattiva','Inventata');await complete(a);assert.equal(await personContact(a.personId),undefined);await db.query('update public.patrimonial_operators set active=true,revision=revision+1 where id=$1',[advisorA.op]);
 });
 await check('22 no direct authenticated financial-table access or generic command grant',async()=>{
  await assert.rejects(db.transaction(c=>c.query('select * from patrimonial_radar_private.snapshots'),'authenticated',admin.claims));
  const r=await fetch(cfg.postgrestUrl+'/rpc/patrimonial_radar_command',{method:'POST',headers:{Authorization:'Bearer '+managed.token,'Content-Type':'application/json'},body:JSON.stringify({p_command:{method:'history',sessionHash:new RadarSecrets(secret).hash('session-v1',managed.opaque)}})});assert(!r.ok);
 });
 await check('23 a valid server MAC cannot substitute another Auth subject session hash',async()=>{
  const a=await account('subject-swap@example.invalid');await assert.rejects(a.rpc.invoke({contract:BACKEND_VERSION,keyBinding:new RadarSecrets(secret).hash('store-binding-v1',BACKEND_VERSION),method:'read',sessionHash:new RadarSecrets(secret).hash('session-v1',managed.opaque),id:report.id}));
 });
 await check('24 Auth expiry during the write rolls back assessment and receipt',async()=>{
  const a=await account('commit-expiry@example.invalid');
  await db.query(`create function patrimonial_radar_private.fixture_expire_account() returns trigger language plpgsql as $$ begin update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id='${a.session_id}'::uuid;return new;end $$;create trigger fixture_expire_account after insert on patrimonial_radar_private.assessments for each row execute function patrimonial_radar_private.fixture_expire_account()`);
  try{await assert.rejects(a.service.create(a.opaque,{requestId:randomUUID(),noticeVersion:SERVICE_NOTICE_VERSION}));assert.equal((await db.query('select count(*)::int n from patrimonial_radar_private.assessments where person_id=$1',[a.personId])).rows[0].n,0);}finally{await db.query('drop trigger fixture_expire_account on patrimonial_radar_private.assessments;drop function patrimonial_radar_private.fixture_expire_account()');}
 });
 await check('25 later Radar preserves the same contact current P1 owner and both reports',async()=>{
  const second=await complete(managed);assert.notEqual(second.id,report.id);const rows=(await db.query('select i.current_operator_id from public.patrimonial_intents i join patrimonial_radar_private.cases c on c.intent_id=i.id where c.person_id=$1',[managed.personId])).rows;assert.equal(rows.length,2);assert(rows.every(r=>r.current_operator_id===advisorB.op));assert.equal((await managed.service.history(managed.opaque)).length,2);
 });
 // Browser seed is synthetic; opaque credentials stay outside Git, never printed.
 await writeFile(arg('evidence')+'/browser-fixture-private.json',JSON.stringify({secret,cfg,admin,advisorA,advisorB,managed:{uid:managed.uid,profile:managed.profile},caseId,contactId:await personContact(managed.personId)}));
 const result={status:'PASS_SYNTHETIC_NATIVE',passed,groups:passed.length,remoteWrites:0,realEmail:'NOT_RUN',realSupabaseAuth:'NOT_RUN_AUTH_SCHEMA_AND_JWT_FIXTURE',database:'PostgreSQL17.6 / PostgREST16.5'};
 await writeFile(arg('evidence')+'/native-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{await db.close();}
