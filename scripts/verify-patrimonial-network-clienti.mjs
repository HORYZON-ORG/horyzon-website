import assert from 'node:assert/strict';
import {randomUUID,createHash,createHmac} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {foundationDatabase} from './lib/patrimonial-foundation-db.mjs';
import {PatrimonialRadarService} from '../src/lib/patrimonial-radar-server/service.ts';
import {PatrimonialFoundation} from '../src/lib/patrimonial-radar-server/foundation.ts';
import {SERVICE_NOTICE_VERSION} from '../src/lib/patrimonial-radar-server/contracts.ts';
import {buildFixture} from './patrimonial-radar-fixtures.mjs';
import {dependencyOrder} from '../src/lib/patrimonial-radar/answers.ts';
import {handlePublicLead} from '../src/lib/public-leads/handler.ts';
import {RemoteRadarRpc} from '../src/lib/patrimonial-radar-server/remote-store.ts';
import {RemoteEventIntake} from '../src/lib/patrimonial-radar-server/event-intake.ts';
import {fingerprintConcurrent} from './lib/patrimonial-concurrent-replay.mjs';
import {resolve} from 'node:path';
import {canonicalPatrimonialPayload} from '../src/lib/public-leads/patrimonial-contract.ts';
import {patrimonialConsentEvidence} from '../src/lib/public-leads/patrimonial-consents.ts';
const arg=process.argv.find(a=>a.startsWith('--network-platform='));if(!arg)throw Error('Supply canonical isolated Platform worktree');
const operational=process.argv.includes('--operational-preflight');
const db=await foundationDatabase({networkPlatform:arg.slice(19),replayConcurrent:operational}),secret='synthetic-network-only-secret-0000000000000000',mail=new Map(),passed=[];
let rpc=db.rpc,eventIntake,runtimeJti,cfg,sign,wire,oidc;
if(operational){
 if(!process.argv.includes('--activation-candidate'))throw Error('Activation candidate required for restricted-runtime test');
 cfg=JSON.parse(await readFile(process.argv.find(a=>a.startsWith('--local-config='))?.slice(15),'utf8'));
 assert.equal(cfg.postgrestUrl,'http://127.0.0.1:15440');
 await db.query(await readFile(resolve(arg.slice(19),'packages/database/pending/20261021203241_patrimonial_event_intake_candidate.sql'),'utf8'));
 sign=claims=>{const h=Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),p=Buffer.from(JSON.stringify(claims)).toString('base64url');return h+'.'+p+'.'+createHmac('sha256',cfg.secret).update(h+'.'+p).digest('base64url');};
 runtimeJti=randomUUID();const token=sign({role:'patrimonial_radar_runtime',ref:'pmkyeqrfkunypfkbjnyg',jti:runtimeJti,deployment_id:'dpl_synthetic',exp:Math.floor(Date.now()/1000)+1800});
 await db.query("insert into patrimonial_radar_private.runtime_deployments values($1,'pmkyeqrfkunypfkbjnyg','dpl_synthetic',now()+interval '30 minutes',null,'SYNTHETIC_RUNTIME_ONLY')",[runtimeJti]);
 wire=async(url,init)=>{assert.equal(new URL(url).origin,'https://pmkyeqrfkunypfkbjnyg.supabase.co');const r=await fetch(cfg.postgrestUrl+new URL(url).pathname.replace('/rest/v1',''),init);const result=await r.clone().json();if(!r.ok||result.ok===false)console.error('SYNTHETIC RPC',new URL(url).pathname,r.status,result.code,result.message??'');return r;};
 rpc=new RemoteRadarRpc({url:'https://pmkyeqrfkunypfkbjnyg.supabase.co',apiKey:'sb_publishable_synthetic_only',runtimeToken:token,fetchImpl:wire});
 if(process.argv.includes('--oidc-broker')){const {oidcFixture}=await import('./lib/patrimonial-runtime-oidc-fixture.mjs');oidc=await oidcFixture(db,cfg,arg.slice(19),wire);rpc=oidc.rpc;}
 await db.query("notify pgrst,'reload schema'");
 // The synthetic schema reset triggers several asynchronous cache reloads.
 // Poll only this startup health check; no production write is retried.
 for(let n=0;;n++){try{await rpc.attest('dpl_synthetic');break;}catch(e){if(n===29)throw e;await new Promise(r=>setTimeout(r,100));}}
 eventIntake=new RemoteEventIntake(rpc);
}
const service=new PatrimonialRadarService(rpc,{kind:'SIMULATED',async sendCode({email,code}){mail.set(email,code);}},secret),foundation=new PatrimonialFoundation(rpc,secret);
async function check(n,f){await f();passed.push(n);console.log('PASS '+n);}
async function identity(email){const r=await service.requestCode(email,'synthetic-network-'+email);return service.verifyCode({challengeId:r.challengeId,code:mail.get(email)},r.binding,r.csrf,'synthetic-network-'+email);}
async function event(email,name='Alice Inventata',extra={}){
 const payload={contractVersion:'patrimonial-lead-v2',requestId:randomUUID(),mode:'patrimonial-event',sourcePath:'/benessere-patrimoniale/evento',firstName:name.split(' ')[0],lastName:name.split(' ').slice(1).join(' '),email,phone:'',province:'Milano',profile:'',message:'Nota non strutturata: presente',consent:true,marketingConsent:false,utm:{},website:'',...extra};
 const r=await submit(payload);
 assert.equal(r.status,202,await r.clone().text());return {payload,receipt:await r.json()};
}
function submit(payload){
 return handlePublicLead(new Request('http://127.0.0.1:15441/api/public-leads',{method:'POST',headers:{Origin:'http://127.0.0.1:15441','Content-Type':'application/json','Idempotency-Key':payload.requestId},body:JSON.stringify(payload)}),{env:{NODE_ENV:'test',PATRIMONIAL_V2_ENABLED:'true',PATRIMONIAL_RADAR_FOUNDATION_CONTEXT:'local-test'},...(operational?{eventIntake:eventIntake.acquire.bind(eventIntake)}:{store:db.leadStore}),eventRadarNextStep:foundation.prepareEvent.bind(foundation)});
}
async function complete(s){
 const c=await service.create(s.token,{requestId:randomUUID(),noticeVersion:SERVICE_NOTICE_VERSION});const a=await service.read(s.token,c.id),input=buildFixture('T02');let rev=0;
 if(oidc)await oidc.renew();
 function dates(x){if(!x||typeof x!=='object')return x;if(Array.isArray(x))return x.map(dates);return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,k==='asOf'?a.input.asOf:dates(v)]));}
 for(const q of dependencyOrder()){const r=input.answers.filter(a=>a.id===q).at(-1);if(!r)continue;try{rev=(await service.save(s.token,c.id,{requestId:randomUUID(),expectedRevision:rev,questionId:q,state:r.state,...(r.state==='VALUE'?{value:dates(r.value)}:{})})).revision;}catch(e){if(e.code!=='INVALID')throw e;}}
 return {id:c.id,snapshot:await service.complete(s.token,c.id,{requestId:randomUUID(),expectedRevision:rev})};
}
const network=(claims,fn,args)=>db.transaction(c=>c.query(`select hub.${fn}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args),'authenticated',claims).then(r=>r.rows[0].value);
const snapshot=c=>network(c,'architetti_snapshot',['']);const detail=(c,id)=>network(c,'architetti_client_detail',[id]);const command=(c,action,input)=>network(c,'architetti_command',[action,input]);
async function staff(name,permissions=[],op=false){const sub=randomUUID(),session_id=randomUUID(),operatorId=op?randomUUID():null;await db.query('insert into auth.users(id) values($1)',[sub]);await db.query("insert into auth.sessions(id,user_id,not_after) values($1,$2,now()+interval '1 hour')",[session_id,sub]);
 await db.query("insert into hub.user_roles(user_id,email,role) values($1,$2,'superadmin')",[sub,name+'@example.invalid']);
 if(op)await db.query("insert into public.patrimonial_operators(id,operator_key,display_name,user_id,network_enabled,network_role) values($1,$2,$3,$4,true,'architect')",[operatorId,'network-'+sub,name,sub]);
 for(const p of permissions)await db.query("insert into hub.patrimonial_radar_permissions(user_id,permission,operator_id,expires_at,evidence_ref) values($1,$2,$3,now()+interval '1 hour','SYNTHETIC_NETWORK_TEST_ONLY')",[sub,'RADAR_PATRIMONIAL_'+p,p==='ADVISOR'?operatorId:null]);return {sub,session_id,operatorId};}
let alice,bob,first,second,direct,contactId,caseId,admin,a,b,nogrant,assignment;
try{
 await check('Canonical 0056 installed before alternative foundation; existing contacts not recreated',async()=>{
  assert.equal((await db.query("select count(*)::int n from information_schema.tables where table_schema='public' and table_name='patrimonial_contacts'")).rows[0].n,1);
  assert((await db.query("select pg_get_constraintdef(oid) d from pg_constraint where conname='patrimonial_intents_kind_check'")).rows[0].d.includes('HORYZON_OPPORTUNITY'));
 });
 await check('Real canonical Event acquisition with HighLevel OFF creates exactly one administrative lead',async()=>{
  first=await event('alice.network@example.invalid');contactId=(await db.query('select contact_id from patrimonial_radar_private.contact_requests where request_id=$1',[first.receipt.requestId])).rows[0].contact_id;
  assert.equal((await db.query('select status from public.patrimonial_contacts where id=$1',[contactId])).rows[0].status,'prospect');
  assert.equal((await db.query('select count(*)::int n from public.patrimonial_participations')).rows[0].n,0);
  assert(!/@|token|session/.test(first.receipt.radarNextStep.href));
 });
 await check('OTP + opaque reference is candidate only; explicit reconciliation binds separate person/contact IDs',async()=>{
  alice=await identity('alice.network@example.invalid');const p=await foundation.proposeEvent(alice.token,first.receipt.radarNextStep.href.split('=')[1]);assert.equal(p.state,'CANDIDATE');
  assert.equal((await db.query('select state from patrimonial_radar_private.contact_bindings where contact_id=$1',[contactId])).rows[0].state,'CANDIDATE');
  await foundation.confirmEvent(alice.token,p.id,0);assert.notEqual(alice.personId,contactId);
  direct=await complete(alice);await foundation.linkAssessment(alice.token,direct.id,p.id);
  assert.equal((await db.query('select count(*)::int n from public.patrimonial_contacts')).rows[0].n,1);
  caseId=(await db.query('select id from patrimonial_radar_private.cases where assessment_id=$1',[direct.id])).rows[0].id;
 });
 await check('Direct Radar creates one Clienti record, two episodes preserve one person and all reports',async()=>{
  bob=await identity('bob.network@example.invalid');await complete(bob);second=await complete(alice);
  assert.equal((await db.query('select count(*)::int n from public.patrimonial_contacts')).rows[0].n,2);
  assert.equal((await db.query('select count(*)::int n from patrimonial_radar_private.snapshots s join patrimonial_radar_private.assessments a on a.id=s.assessment_id where a.person_id=$1',[alice.personId])).rows[0].n,2);
 });
 await check('Repeated Event requests preserve history; funnel-only and candidate identities stay nonfinancial',async()=>{
  await event('alice.network@example.invalid');const only=await event('funnel.only@example.invalid','Funnel Soltanto');
  const r=await event('candidate.network@example.invalid','Candidato Inventato');const s=await identity('candidate.network@example.invalid');await foundation.proposeEvent(s.token,r.receipt.radarNextStep.href.split('=')[1]);
  admin=await staff('Admin sintetico',['ASSIGN']);a=await staff('Consulente A',['ADVISOR'],true);b=await staff('Consulente B',['ADVISOR'],true);nogrant=await staff('Staff senza Advisor',[],true);
  const ss=await snapshot(admin);const row=ss.contacts.find(c=>c.id===contactId);assert.equal(row.radar.events,2);assert.equal(row.radar.completed,2);assert(ss.contacts.some(c=>c.radar.review));
  assert.equal((await detail(admin,contactId)).events.length,2);assert.equal((await detail(admin,contactId)).assessments.length,2);
  assert(!/approvedInput|answers|amount|snapshot|email_key/.test(JSON.stringify(ss)));
  assert.equal((await db.query('select count(*)::int n from public.patrimonial_participations')).rows[0].n,0,'Textual note is not attendance');
 });
 await check('Clienti assignment uses canonical P1 for every RADAR intent: CAS, replay and atomic history',async()=>{
  let row=(await snapshot(admin)).contacts.find(c=>c.id===contactId);
  assignment={contactId,revision:row.revision,operatorId:a.operatorId,requestId:randomUUID()};const result=await command(admin,'assign_contact',assignment);assert.deepEqual(await command(admin,'assign_contact',assignment),result);
  await assert.rejects(command(admin,'assign_contact',{...assignment,operatorId:b.operatorId}));
  await assert.rejects(command(admin,'assign_contact',{...assignment,requestId:randomUUID()}));
  const rows=(await db.query("select i.current_operator_id,a.operator_id from public.patrimonial_intents i left join public.patrimonial_assignments a on a.intent_id=i.id and a.released_at is null where i.contact_id=$1 and i.kind='RADAR'",[contactId])).rows;assert.equal(rows.length,2);for(const r of rows){assert.equal(r.current_operator_id,a.operatorId);assert.equal(r.operator_id,a.operatorId);}
  assert((await db.hub(a,{method:'report',id:caseId})).ok);assert.equal((await db.hub(admin,{method:'report',id:caseId})).code,'FORBIDDEN');
 });
 if(oidc)await check('Renewal after report and P1 assignment preserves all business rows, customer access and Advisor authority',async()=>{
  const rows=await oidc.fingerprint(),assessment=await service.read(alice.token,second.id),clients=await detail(admin,contactId);
  assert((await db.hub(a,{method:'report',id:caseId})).ok);await oidc.renew(true);
  assert.deepEqual(await oidc.fingerprint(),rows);assert.deepEqual(await service.read(alice.token,second.id),assessment);
  assert.deepEqual(await detail(admin,contactId),clients);assert((await db.hub(a,{method:'report',id:caseId})).ok);
 });
 await check('Existing HORYZON_OPPORTUNITY shares P1 responsibility; exhausted capacity rolls back the entire contact operation',async()=>{
  const stage=randomUUID();await db.query("insert into public.patrimonial_workspace_stages(id,label,position) values($1,'Fase sintetica',0)",[stage]);
  const row=(await snapshot(admin)).contacts.find(c=>c.id===contactId);
  await command(admin,'create_opportunity',{contactId,revision:row.revision,stageId:stage,title:'Pratica sintetica',nextAction:'Confronto sintetico',dueAt:'2028-01-02T10:00:00Z'});
  const full=await staff('Capacità esaurita',[],true);await db.query('update public.patrimonial_operators set capacity=0,revision=revision+1 where id=$1',[full.operatorId]);
  const before=(await snapshot(admin)).contacts.find(c=>c.id===contactId);const key=randomUUID();
  await assert.rejects(command(admin,'assign_contact',{contactId,revision:before.revision,operatorId:full.operatorId,requestId:key}));
  assert.equal((await snapshot(admin)).contacts.find(c=>c.id===contactId).revision,before.revision);
  assert.equal((await db.query("select count(*)::int n from public.patrimonial_intents where contact_id=$1 and kind in ('RADAR','HORYZON_OPPORTUNITY') and current_operator_id=$2",[contactId,a.operatorId])).rows[0].n,3);
  assert.equal((await db.query('select count(*)::int n from patrimonial_radar_private.contact_commands where command_id=$1',[key])).rows[0].n,0);
 });
 await check('Reassignment revokes prior Advisor; assignment alone grants no financial permission; release preserves P1 history',async()=>{
  let row=(await snapshot(admin)).contacts.find(c=>c.id===contactId);await command(admin,'assign_contact',{contactId,revision:row.revision,operatorId:b.operatorId,requestId:randomUUID()});
  assert.equal((await db.hub(a,{method:'report',id:caseId})).code,'FORBIDDEN');assert((await db.hub(b,{method:'report',id:caseId})).ok);
  row=(await snapshot(admin)).contacts.find(c=>c.id===contactId);await command(admin,'assign_contact',{contactId,revision:row.revision,operatorId:nogrant.operatorId,requestId:randomUUID()});assert.equal((await db.hub(nogrant,{method:'report',id:caseId})).code,'FORBIDDEN');
  row=(await snapshot(admin)).contacts.find(c=>c.id===contactId);await command(admin,'assign_contact',{contactId,revision:row.revision,operatorId:null,requestId:randomUUID()});
  assert((await detail(admin,contactId)).assignments.some(a=>a.releaseReason==='MANUAL_RELEASE'));assert.equal((await db.query('select count(*)::int n from public.patrimonial_assignments a join public.patrimonial_intents i on i.id=a.intent_id where i.contact_id=$1 and a.released_at is null',[contactId])).rows[0].n,0);
 });
 await check('Discordant identity and shared mailbox deny reconciliation and dossier without merging contacts',async()=>{
  const mismatch=await foundation.proposeEvent(bob.token,first.receipt.radarNextStep.href.split('=')[1]);assert.equal(mismatch.state,'CONFLICT');await assert.rejects(foundation.confirmEvent(bob.token,mismatch.id,0),{code:'CONFLICT'});
  const shared=await event('alice.network@example.invalid','Identita Discordante');const proposed=await foundation.proposeEvent(alice.token,shared.receipt.radarNextStep.href.split('=')[1]);await assert.rejects(foundation.confirmEvent(alice.token,proposed.id,0),{code:'CONFLICT'});
  let row=(await snapshot(admin)).contacts.find(c=>c.id===contactId);await command(admin,'assign_contact',{contactId,revision:row.revision,operatorId:a.operatorId,requestId:randomUUID()});
  await db.query("insert into patrimonial_radar_private.mailbox_reviews(email_key,reason,state,evidence_ref) values($1,'SHARED','CONFLICT','SYNTHETIC_SHARED_MAILBOX')",[service.secrets.hash('email-v1','alice.network@example.invalid')]);assert.equal((await db.hub(a,{method:'report',id:caseId})).code,'FORBIDDEN');
  assert((await db.query("select count(*)::int n from hub.patrimonial_radar_read_audit where action='report' and outcome='DENIED'")).rows[0].n>=3);
 });
 await check('Revocable versioned binding, immutable history, no direct table access, current sessions required',async()=>{
  const binding=(await db.query("select * from patrimonial_radar_private.contact_bindings where person_id=$1 and state='VERIFIED'",[bob.personId])).rows[0];
  const row=(await snapshot(admin)).contacts.find(c=>c.id===binding.contact_id);await command(admin,'assign_contact',{contactId:binding.contact_id,revision:row.revision,operatorId:a.operatorId,requestId:randomUUID()});
  const bobCase=(await db.query('select id from patrimonial_radar_private.cases where person_id=$1',[bob.personId])).rows[0].id;assert((await db.hub(a,{method:'report',id:bobCase})).ok);
  await assert.rejects(db.query("update patrimonial_radar_private.contact_bindings set state='REVOKED' where id=$1",[binding.id]));
  const writer=await db.pool.connect();try{
   await writer.query('begin');await writer.query("update patrimonial_radar_private.contact_bindings set state='REVOKED',revision=revision+1 where id=$1",[binding.id]);
   let settled=false;const read=db.hub(a,{method:'report',id:bobCase}).then(r=>{settled=true;return r;});await new Promise(r=>setTimeout(r,60));assert.equal(settled,false,'The pending identity revocation fences the dossier read');await writer.query('commit');assert.equal((await read).code,'FORBIDDEN');
  }finally{await writer.query('rollback');writer.release();}
  await assert.rejects(db.query("update patrimonial_radar_private.contact_bindings set state='VERIFIED',revision=revision+1 where id=$1",[binding.id]));
  for(const table of ['public.patrimonial_contacts','patrimonial_radar_private.contact_bindings','patrimonial_radar_private.snapshots'])await assert.rejects(db.transaction(c=>c.query('select * from '+table),'authenticated',admin));
  await assert.rejects(snapshot({...admin,session_id:randomUUID()}));
 });
 await check('Separate Event editions retain structured request/attendance history, never inferred from prose',async()=>{
  const editions=[randomUUID(),randomUUID()];const requestRows=[];
  for(const [n,id] of editions.entries()){
   await db.query("insert into public.patrimonial_event_editions(id,edition_key,event_slug,title_snapshot,starts_at,ends_at,timezone,status,revision,record) values($1::uuid,$1::text,'benessere-patrimoniale','Edizione sintetica',now()+interval '1 year',now()+interval '1 year 2 hours','Europe/Rome','ACTIVE',0,$2)",[id,JSON.stringify({id})]);
   const r=await event('edizioni.network@example.invalid','Edizioni Inventate',{eventEditionId:id});requestRows.push(r.receipt.requestId);
  }
  const cid=(await db.query('select contact_id from patrimonial_radar_private.contact_requests where request_id=$1',[requestRows[0]])).rows[0].contact_id;
  assert.equal((await detail(admin,cid)).events.length,2);
  assert.deepEqual(new Set((await detail(admin,cid)).events.map(e=>e.editionId)),new Set(editions));
  assert((await detail(admin,cid)).events.every(e=>e.participations.length===0));
  const request=(await db.query('select intent_id from public.patrimonial_requests where request_id=$1',[requestRows[0]])).rows[0];const id=randomUUID();
  await db.query("insert into public.patrimonial_participations(id,intent_id,location_ref,contact_ref,event_slug,edition_id,registration_status,attendance,revision,requested_at,source_request_id,record) values($1,$2,'SYNTHETIC_NO_PROVIDER','SYNTHETIC_ONLY','benessere-patrimoniale',$3,'CONFIRMED','ATTENDED',0,now(),$4,$5)",[id,request.intent_id,editions[0],requestRows[0],JSON.stringify({id,revision:0,relationId:request.intent_id})]);
  assert((await detail(admin,cid)).events.some(e=>e.participations.some(p=>p.registrationStatus==='CONFIRMED'&&p.attendance==='ATTENDED')),'Attendance exists only after an explicit disposable fixture, never request acquisition');
 });
 await check('A direct person later reaching another Event contact remains in review; unauthenticated callers cannot probe reconciliation',async()=>{
  const s=await identity('direct.later@example.invalid');await complete(s);
  const e=await event('direct.later@example.invalid','Diretta Successiva');const rec=await foundation.proposeEvent(s.token,e.receipt.radarNextStep.href.split('=')[1]);assert.equal(rec.state,'CANDIDATE');
  await assert.rejects(foundation.confirmEvent(s.token,rec.id,0),{code:'CONFLICT'});
  assert.equal((await db.query('select state from patrimonial_radar_private.reconciliations where id=$1',[rec.id])).rows[0].state,'CANDIDATE');
  assert.equal((await db.query("select count(*)::int n from patrimonial_radar_private.contact_bindings where person_id=$1 and state='VERIFIED'",[s.personId])).rows[0].n,1);
  await assert.rejects(foundation.confirmEvent('a'.repeat(43),rec.id,0),{code:'UNAUTHENTICATED'});
 });
 await check('PostgREST validates JWT and exposes only authorized network RPCs, never private dossiers',async()=>{
  const ca=process.argv.find(a=>a.startsWith('--local-config='));if(!ca)throw Error('local configuration required');const cfg=JSON.parse(await readFile(ca.slice(15),'utf8'));
  assert.equal(cfg.postgrestUrl,'http://127.0.0.1:15440');const header=Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),body=Buffer.from(JSON.stringify({role:'authenticated',sub:admin.sub,session_id:admin.session_id,exp:Math.floor(Date.now()/1000)+600})).toString('base64url');const token=header+'.'+body+'.'+createHmac('sha256',cfg.secret).update(header+'.'+body).digest('base64url');
  await db.query("notify pgrst,'reload schema'");let r;
  for(let i=0;i<30;i++){r=await fetch(cfg.postgrestUrl+'/rpc/architetti_snapshot',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Content-Profile':'hub'},body:'{"p_query":""}'});if(r.status!==404)break;await new Promise(r=>setTimeout(r,100));}
  assert.equal(r.status,200,await r.clone().text());assert((await r.json()).contacts.length>0);
  assert.equal((await fetch(cfg.postgrestUrl+'/rpc/architetti_snapshot',{method:'POST',headers:{Authorization:'Bearer '+token.slice(0,-4)+'xxxx','Content-Type':'application/json','Content-Profile':'hub'},body:'{"p_query":""}'})).status,401);
  assert(!(await fetch(cfg.postgrestUrl+'/contact_bindings',{headers:{Authorization:'Bearer '+token,'Accept-Profile':'patrimonial_radar_private'}})).ok);
 });
 if(operational){
  await check('Restricted Event concurrent replay: one receipt/contact/outbox, changed payload 409, expired 410',async()=>{
   const payload={...first.payload,requestId:randomUUID(),email:'replay.remote@example.invalid',utm:{utm_term:'term',utm_source:'source'}};
   const replies=await Promise.all([submit(payload),submit(payload)]);for(const r of replies)assert.equal(r.status,202);
   assert.equal((await db.query('select count(*)::int n from public.patrimonial_requests where request_id=$1',[payload.requestId])).rows[0].n,1);
   assert.equal((await db.query('select count(*)::int n from public.patrimonial_outbox_operations where request_id=$1',[payload.requestId])).rows[0].n,1);
   assert.equal((await db.query('select count(*)::int n from public.patrimonial_consent_evidence where request_id=$1',[payload.requestId])).rows[0].n,2);
   assert.equal((await submit({...payload,lastName:'Modificato'})).status,409);
   await db.query("update public.patrimonial_requests set expires_at=now()-interval '1 second',record=jsonb_set(record,'{replayExpiresAt}',to_jsonb(now()-interval '1 second')) where request_id=$1",[payload.requestId]);
   assert.equal((await submit(payload)).status,410);
  });
  await check('Closed Event payload, consent tampering, invalid hash and injected ledger commands denied with no partial writes',async()=>{
   const request=(await db.query('select record from public.patrimonial_requests where request_id=$1',[first.payload.requestId])).rows[0].record;
   const fresh=()=>{const id=randomUUID(),stamp=new Date(),payload={...request.payload,email:'invalid.intake@example.invalid'};return {...request,id,intentId:null,technicalState:'RECEIVED',payload,payloadHash:createHash('sha256').update(canonicalPatrimonialPayload(payload)).digest('hex'),receivedAt:stamp.toISOString(),replayExpiresAt:new Date(+stamp+90*86400000).toISOString(),receipt:{ok:true,requestId:id,receiptStatus:'received',crmStatus:'pending'}};};
   for(const alter of [r=>({...r,commands:[]}),r=>({...r,payload:{...r.payload,mode:'architect-path'}}),r=>({...r,payload:{...r.payload,answers:[]}}),r=>({...r,payloadHash:'0'.repeat(64)}),r=>({...r,receipt:{...r.receipt,crmStatus:'synced'}})]){
    const bad=alter(fresh());await assert.rejects(rpc.acquireEvent(bad,patrimonialConsentEvidence(bad)),{code:'INVALID'});
    assert.equal((await db.query('select count(*)::int n from public.patrimonial_requests where request_id=$1',[bad.id])).rows[0].n,0);
   }
   const bad=fresh(),consents=patrimonialConsentEvidence(bad);consents[1].choice=true;await assert.rejects(rpc.acquireEvent(bad,consents),{code:'INVALID'});
   assert.equal((await db.query('select count(*)::int n from public.patrimonial_requests where request_id=$1',[bad.id])).rows[0].n,0);
   // Fail after request/contact insertion: FK/invariant failure rolls everything back.
   await db.query("create function public.synthetic_intake_abort() returns trigger language plpgsql as $$begin raise check_violation; end$$; create trigger synthetic_intake_abort before insert on public.patrimonial_outbox_operations for each row execute function public.synthetic_intake_abort()");
   try{const abort=fresh();await assert.rejects(rpc.acquireEvent(abort,patrimonialConsentEvidence(abort)),{code:'CONFLICT'});assert.equal((await db.query('select count(*)::int n from public.patrimonial_requests where request_id=$1',[abort.id])).rows[0].n,0);}
   finally{await db.query('drop trigger synthetic_intake_abort on public.patrimonial_outbox_operations;drop function public.synthetic_intake_abort()');}
  });
  await check('Legacy Event/Radar references cannot establish verified identity or Advisor authority; concurrent contracts preserved',async()=>{
   const contact=randomUUID(),assessment=randomUUID();
   const before=(await db.query('select count(*)::int n from patrimonial_radar_private.contact_bindings')).rows[0].n;
   await db.query("insert into public.patrimonial_contacts(id,full_name,email,source) values($1,'Legacy inventato','legacy@example.invalid','manual')",[contact]);
   await db.query("insert into public.patrimonial_contact_radar_links(assessment_ref,contact_id,questionnaire_version,status) values($1,$2,'SYNTHETIC_LEGACY','COMPLETED')",[assessment,contact]);
   assert.equal((await db.query('select count(*)::int n from patrimonial_radar_private.contact_bindings')).rows[0].n,before);
   assert.equal((await detail(admin,contact)).assessments.length,0);
   assert.equal((await db.hub(a,{method:'report',id:assessment})).ok,false);
   assert.deepEqual(await fingerprintConcurrent(db.pool),db.pool.concurrentFingerprint);
   assert(db.pool.concurrentFingerprint.functions.length>=20);assert(db.pool.concurrentFingerprint.tables.length>=5);
  });
  await check('Signed PostgREST Advisor positive then live-session revoke, with canonical P1 assignment',async()=>{
   const owner=await identity('advisor.wire@example.invalid'),report=await complete(owner);
   const binding=(await db.query("select contact_id from patrimonial_radar_private.contact_bindings where person_id=$1 and state='VERIFIED'",[owner.personId])).rows[0];
   const row=(await snapshot(admin)).contacts.find(c=>c.id===binding.contact_id);await command(admin,'assign_contact',{contactId:row.id,revision:row.revision,operatorId:a.operatorId,requestId:randomUUID()});
   const id=(await db.query('select id from patrimonial_radar_private.cases where assessment_id=$1',[report.id])).rows[0].id;
   const advisor=sign({role:'authenticated',sub:a.sub,session_id:a.session_id,exp:Math.floor(Date.now()/1000)+600});
   const read=()=>fetch(cfg.postgrestUrl+'/rpc/patrimonial_radar_command',{method:'POST',headers:{Authorization:'Bearer '+advisor,'Content-Type':'application/json','Content-Profile':'hub'},body:JSON.stringify({p_command:{contract:'patrimonial-foundation-5a-1',method:'report',id}})}).then(r=>r.json());
   assert.equal((await read()).ok,true);await db.query('delete from auth.sessions where id=$1',[a.session_id]);assert.equal((await read()).code,'FORBIDDEN');
  });
  if(oidc)await check('OIDC broker: cryptographic negatives, multiple processes, rotation/recovery and current revocation',async()=>{await oidc.negatives();});
  else await check('Runtime rotation overlap, immediate revocation, expiry, signature and generic ledger denial',async()=>{
   const token=(jti,extra={})=>sign({role:'patrimonial_radar_runtime',ref:'pmkyeqrfkunypfkbjnyg',jti,deployment_id:'dpl_synthetic',exp:Math.floor(Date.now()/1000)+600,...extra});
   const create=t=>new RemoteRadarRpc({url:'https://pmkyeqrfkunypfkbjnyg.supabase.co',apiKey:'sb_publishable_synthetic_only',runtimeToken:t,fetchImpl:wire});
   const next=randomUUID();await db.query("insert into patrimonial_radar_private.runtime_deployments values($1,'pmkyeqrfkunypfkbjnyg','dpl_synthetic',now()+interval '10 minutes',null,'SYNTHETIC_ROTATION_ONLY')",[next]);
   const rotated=create(token(next));await rotated.attest('dpl_synthetic');await rpc.attest('dpl_synthetic');
   await db.query('update patrimonial_radar_private.runtime_deployments set revoked_at=now() where token_id=$1',[runtimeJti]);await assert.rejects(rpc.attest('dpl_synthetic'),{code:'UNAVAILABLE'});await rotated.attest('dpl_synthetic');
   const scoped=token(next),headers={Authorization:'Bearer '+scoped,'Content-Type':'application/json'};
   for(const fn of ['patrimonial_execute_command','patrimonial_store_transaction','architetti_event_ingest','architetti_radar_link'])assert.equal((await db.query("select has_function_privilege('patrimonial_radar_runtime',oid,'EXECUTE') allowed from pg_proc where proname=$1",[fn])).rows[0].allowed,false);
   for(const table of ['patrimonial_intents','patrimonial_requests','patrimonial_outbox_operations'])assert(!(await fetch(cfg.postgrestUrl+'/'+table,{headers})).ok);
   for(const extra of [{deployment_id:'dpl_other'},{ref:'other'}]){
    const r=await fetch(cfg.postgrestUrl+'/rpc/patrimonial_radar_runtime_health',{method:'POST',headers:{...headers,Authorization:'Bearer '+token(next,extra)},body:'{}'});assert.equal((await r.json()).ok,false);
   }
   // PostgREST has JWT clock-skew leeway. The DB lease gate denies even inside
   // that leeway; an older expired signature must also be rejected by ingress.
   assert.equal((await (await fetch(cfg.postgrestUrl+'/rpc/patrimonial_radar_runtime_health',{method:'POST',headers:{...headers,Authorization:'Bearer '+token(next,{exp:Math.floor(Date.now()/1000)-1})},body:'{}'})).json()).ok,false);
   assert.equal((await fetch(cfg.postgrestUrl+'/rpc/patrimonial_radar_runtime_health',{method:'POST',headers:{...headers,Authorization:'Bearer '+token(next,{exp:Math.floor(Date.now()/1000)-120})},body:'{}'})).status,401);
   await db.query("update patrimonial_radar_private.runtime_deployments set expires_at=now()-interval '1 second' where token_id=$1",[next]);await assert.rejects(rotated.attest('dpl_synthetic'),{code:'UNAVAILABLE'});
  });
 }
 if(process.argv.includes('--prepare-browser')){
  const e=await event('giulia.browser@example.invalid','Giulia Inventata');const s=await identity('giulia.browser@example.invalid');const rec=await foundation.proposeEvent(s.token,e.receipt.radarNextStep.href.split('=')[1]);await foundation.confirmEvent(s.token,rec.id,0);await complete(s);await complete(s);console.log('Prepared disposable browser contact: Giulia Inventata');
 }
 console.log(JSON.stringify({status:'PASS',groups:passed.length,passed,remoteWrites:0,identityProvider:'SIMULATED_LOCAL_ONLY',database:'PostgreSQL 17.6 / PostgREST 16.5'},null,2));
}finally{await db.close();}
