import assert from 'node:assert/strict';
import {randomUUID,createHmac} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {AccountRadarRpc,accountMacKey} from '../../src/lib/patrimonial-radar-server/account-rpc.ts';
import {PatrimonialRadarService} from '../../src/lib/patrimonial-radar-server/service.ts';
import {SERVICE_NOTICE_VERSION} from '../../src/lib/patrimonial-radar-server/contracts.ts';
import {personalLinks} from '../../../architetti/src/referral-links.ts';
export const referralProof={scope:'NATIVE_LOOPBACK_SYNTHETIC_ONLY',remoteWrites:0,highLevel:'OFF_NO_TRANSPORT'};
export async function verifyArchitectReferrals({db,cfg,secret,account,complete,staff,hub,check}){
 const call=async(a,name,body={})=>{const r=await fetch(cfg.postgrestUrl+'/rpc/'+name,{method:'POST',headers:{...(a?{Authorization:'Bearer '+a.token}:{}),'Content-Type':'application/json','Content-Profile':'hub','Accept-Profile':'hub'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 const personal=(a,cid,caseId=null)=>call(a,'architetti_personal_radar',{p_contact_id:cid,p_case_id:caseId});
 const contact=async a=>(await db.query("select contact_id from patrimonial_radar_private.contact_bindings where person_id=$1 and state='VERIFIED'",[a.personId])).rows[0]?.contact_id;
 const caseFor=async id=>(await db.query('select id,intent_id from patrimonial_radar_private.cases where assessment_id=$1',[id])).rows[0];
 const owner=async cid=>(await db.query('select assigned_operator_id from public.patrimonial_contacts where id=$1',[cid])).rows[0].assigned_operator_id;
 const attributed=async id=>(await db.query('select * from patrimonial_radar_private.assessment_referrals where assessment_id=$1',[id])).rows[0];
 const referred=(email,code,first='Persona',last='Inventata')=>account(email,first,last,undefined,undefined,code);
 const withCode=(a,code)=>({...a,service:new PatrimonialRadarService(new AccountRadarRpc({url:cfg.postgrestUrl,key:'sb_publishable_synthetic',secret,token:a.token,uid:a.uid,sid:a.session_id,profile:a.profile,referralCode:code,fetchImpl:(url,init)=>fetch(url.replace('/rest/v1',''),init)}),{kind:'SIMULATED',async sendCode(){throw Error('No email');}},secret)});
 const validate=async(code,extra={})=>{const envelope=JSON.stringify({purpose:'radar-referral-1',issuedAt:Math.floor(Date.now()/1000),code,...extra}),mac=createHmac('sha256',accountMacKey(secret)).update(envelope).digest('hex');return call(null,'patrimonial_radar_referral_check',{p_envelope:envelope,p_mac:mac});};
 const event=async(email,name,code)=>{
  const e={eventId:randomUUID(),locationId:'referral-synthetic-only',externalContactId:email,fullName:name,email,phone:null,source:'Funnel Evento',sourcePath:'/benessere-patrimoniale/evento',consent:true,marketingConsent:false,referralCode:code};
  return (await db.transaction(c=>c.query('select public.architetti_event_ingest($1) d',[e]),'service_role')).rows[0].d.contactId;
 };
 const a=await staff('ReferralA',['LIST','PERSON','ADVISOR'],true),b=await staff('ReferralB',['LIST','PERSON','ADVISOR'],true),admin=await staff('ReferralAdmin',['LIST','PERSON','ASSIGN']);
 let codeA,codeB,clientA,radarA,cidA,clientB,radarB,cidB;
 await check('39 one registered code generates both personal links; enabled own operator only',async()=>{
  const ra=await call(a,'architetti_referral_link'),rb=await call(b,'architetti_referral_link');assert.equal(ra.status,200);assert.equal(rb.status,200);
  codeA=ra.data.code;codeB=rb.data.code;const links=personalLinks(ra.data);assert.equal(links.event,ra.data.url);assert.equal(links.radar,'https://horyzon.it/radar-patrimoniale?ref='+codeA);assert.notEqual(codeA,codeB);
  assert.equal((await call(a,'architetti_referral_link')).data.code,codeA);assert.equal((await db.query('select count(*)::int n from public.patrimonial_architect_referral_links where operator_id=$1',[a.op])).rows[0].n,1);
  const outsider=await account('no-operator-referral@example.invalid');assert.equal((await call(outsider,'architetti_referral_link')).status,403);
  const valid=await validate(codeA);assert.equal(valid.data.valid,true);assert.deepEqual(Object.keys(valid.data).sort(),['ok','valid']);
 });
 await check('40 new verified Radar referral A assigns contact and canonical P1 intent to A',async()=>{
  clientA=await referred('referral-new-a@example.invalid',codeA);radarA=await complete(clientA);cidA=await contact(clientA);assert.equal(await owner(cidA),a.op);
  assert.equal((await attributed(radarA.id)).attribution_status,'ASSIGNED_NEW');const c=await caseFor(radarA.id);
  const row=(await db.query('select current_operator_id from public.patrimonial_intents where id=$1',[c.intent_id])).rows[0];assert.equal(row.current_operator_id,a.op);
  assert.equal((await db.query('select count(*)::int n from public.patrimonial_assignments where intent_id=$1 and released_at is null',[c.intent_id])).rows[0].n,1);
 });
 await check('41 existing Event A and Radar A share one contact without confirming attendance or requiring HighLevel',async()=>{
  const cid=await event('referral-event-a@example.invalid','Evento Inventato',codeA);assert.equal(await owner(cid),a.op);
  const u=await referred('referral-event-a@example.invalid',codeA,'Evento','Inventato'),x=await complete(u);assert.equal(await contact(u),cid);assert.equal((await attributed(x.id)).attribution_status,'EXISTING_SAME_OWNER');
  const er=(await db.query('select registration_status from public.patrimonial_contact_event_registrations where contact_id=$1',[cid])).rows;assert(er.length===1&&er[0].registration_status!=='CONFIRMED');
  const pc=await personal(a,cid);assert.equal(pc.data.ok,true);assert(pc.data.data.assessments.some(row=>row.id===x.id&&row.reportId===x.snapshot.id));
 });
 await check('42 a second Radar preserves one contact, two canonical assessments and immutable snapshots',async()=>{
  const second=await complete(clientA);assert.notEqual(second.id,radarA.id);assert.equal(await contact(clientA),cidA);assert.equal((await clientA.service.history(clientA.opaque)).length,2);
  const list=(await personal(a,cidA)).data.data.assessments;assert.equal(list.length,2);assert(list.some(x=>x.reportId===radarA.snapshot.id));
 });
 await check('43 existing owner B is preserved when the customer uses referral A; A gets no personal access',async()=>{
  cidB=await event('referral-owner-b@example.invalid','Cliente Assegnato',codeB);clientB=await referred('referral-owner-b@example.invalid',codeA,'Cliente','Assegnato');radarB=await complete(clientB);
  assert.equal(await owner(cidB),b.op);assert.equal((await attributed(radarB.id)).attribution_status,'EXISTING_OTHER_OWNER');assert.equal((await attributed(radarB.id)).referred_operator_id,a.op);
  const c=await caseFor(radarB.id);assert.equal((await personal(a,cidB)).data.ok,false);assert.equal((await personal(a,cidB,c.id)).data.ok,false);assert.equal((await personal(b,cidB,c.id)).data.ok,true);
 });
 await check('44 invalid, revoked and disabled referral codes preserve the private assessment with no assignment',async()=>{
  const c=await staff('ReferralRevoked',[],true),rc=await call(c,'architetti_referral_link'),code=rc.data.code;
  assert.equal((await validate(code)).data.valid,true);await db.query('update public.patrimonial_architect_referral_links set revoked_at=now() where operator_id=$1',[c.op]);
  assert.equal((await call(c,'architetti_referral_link')).status,403);assert.equal((await validate(code)).data.valid,false);
  const disabled=await staff('ReferralDisabled',[],true),rd=await call(disabled,'architetti_referral_link');await db.query('update public.patrimonial_operators set active=false,revision=revision+1 where id=$1',[disabled.op]);assert.equal((await call(disabled,'architetti_referral_link')).status,403);
  for(const [n,value] of [['revoked',code],['invalid','0'.repeat(32)],['malformed',null],['disabled',rd.data.code]]){
   const u=await referred('referral-'+n+'@example.invalid',value),x=await complete(u),cc=await caseFor(x.id);assert.equal((await attributed(x.id)).attribution_status,'REFERRAL_REVIEW');
   assert.equal((await db.query('select current_operator_id,contact_id from public.patrimonial_intents where id=$1',[cc.intent_id])).rows[0].current_operator_id,null);
   assert.equal((await u.service.read(u.opaque,x.id)).id,x.id);
  }
 });
 await check('45 direct Radar remains unchanged and creates no referral provenance',async()=>{
  const u=await account('direct-after-referrals@example.invalid'),x=await complete(u);assert.equal(await attributed(x.id),undefined);assert.equal(await owner(await contact(u)),null);
 });
 await check('46 own metadata is separate from Advisor authority; no Hub membership is needed or granted',async()=>{
  const no=await staff('ReferralNoAdvisor',[],true);await db.query('delete from hub.user_roles where user_id=$1',[no.uid]);const code=(await call(no,'architetti_referral_link')).data.code;
  const u=await referred('referral-no-advisor@example.invalid',code),x=await complete(u),cid=await contact(u),cc=await caseFor(x.id);
  assert.equal((await personal(no,cid)).data.ok,true);assert.equal((await personal(no,cid,cc.id)).data.ok,false);assert.equal((await personal(a,cid)).data.ok,false);
 });
 await check('47 P1 reassignment revokes the previous architect immediately and preserves all canonical IDs',async()=>{
  const c=await caseFor(radarA.id),rev=(await db.query('select operator_revision from public.patrimonial_intents where id=$1',[c.intent_id])).rows[0].operator_revision;
  assert.equal((await hub(admin,{method:'reassign',id:c.id,operatorId:b.op,expectedRevision:Number(rev),requestId:randomUUID()})).ok,true);
  assert.equal((await personal(a,cidA,c.id)).data.ok,false);const allowed=await personal(b,cidA,c.id);assert.equal(allowed.data.ok,true);assert.equal(allowed.data.data.snapshot.id,radarA.snapshot.id);
  assert.equal((await personal(a,cidA)).data.ok,false);const again=await complete(clientA);assert.equal(await owner(cidA),b.op);assert.equal((await attributed(again.id)).attribution_status,'EXISTING_OTHER_OWNER');
 });
 await check('48 referring architect cannot read or modify a different customer financial identity',async()=>{
  await assert.rejects(clientA.service.read(clientA.opaque,radarB.id));await assert.rejects(clientA.service.save(clientA.opaque,radarB.id,{requestId:randomUUID(),expectedRevision:0,questionId:'RP-S01',state:'UNKNOWN'}));
  assert.equal((await personal(a,cidB,(await caseFor(radarB.id)).id)).data.ok,false);
 });
 await check('49 Hub list, Clienti and personal portal use the same canonical assessment/report IDs with HighLevel OFF',async()=>{
  const c=await caseFor(radarB.id),list=await hub(admin,{method:'list'}),row=list.data.rows.find(x=>x.id===c.id);assert.equal(row.assessmentId,radarB.id);assert.equal(row.reportId,radarB.snapshot.id);
  const detail=(await db.transaction(conn=>conn.query('select hub.architetti_client_detail($1) d',[cidB]),'authenticated',admin.claims)).rows[0].d;
  assert(detail.assessments.some(x=>x.id===row.assessmentId&&x.reportId===row.reportId));const port=(await personal(b,cidB)).data;assert(port.data.assessments.some(x=>x.id===row.assessmentId&&x.reportId===row.reportId));
  assert.equal((await personal(b,cidB,c.id)).data.data.snapshot.id,row.reportId);
 });
 await check('50 pre-auth code validation needs server MAC; original account boundary cannot be invoked directly',async()=>{
  assert.equal((await validate(codeA,{purpose:'different'})).data.ok,false);
  assert.equal((await call(null,'patrimonial_radar_referral_check',{p_envelope:'{}',p_mac:'0'.repeat(64)})).data.ok,false);
  const old=await call(clientA,'patrimonial_radar_account_command_pre_referral',{p_envelope:'{}',p_mac:null});assert.equal(old.status,403);assert.equal(old.data.code,'42501');
  await assert.rejects(db.transaction(c=>c.query("select patrimonial_radar_private.attribute_referral($1,$2)",[radarB.id,codeA]),'authenticated',clientA.claims),e=>e.code==='42501');
 });
 await check('51 current staff session and Advisor grant are checked on every personal report read',async()=>{
  const c=await caseFor(radarB.id);await db.query("update hub.patrimonial_radar_permissions set revoked_at=now(),revision=revision+1 where user_id=$1 and permission='RADAR_PATRIMONIAL_ADVISOR'",[b.uid]);assert.equal((await personal(b,cidB,c.id)).data.ok,false);
  await assert.rejects(db.query("update hub.patrimonial_radar_permissions set revoked_at=null,revision=revision+1 where user_id=$1 and permission='RADAR_PATRIMONIAL_ADVISOR'",[b.uid]));
  await db.query("insert into hub.patrimonial_radar_permissions(user_id,permission,operator_id,expires_at,evidence_ref) values($1,'RADAR_PATRIMONIAL_ADVISOR',$2,now()+interval '1 hour','SYNTHETIC_REFERRAL_REGRANT')",[b.uid,b.op]);assert.equal((await personal(b,cidB,c.id)).data.ok,true);
  const sid=b.sid;await db.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1",[sid]);assert.equal((await personal(b,cidB)).data.ok,false);await db.query("update auth.sessions set not_after=now()+interval '1 hour' where id=$1",[sid]);
 });
 await check('52 concurrent first Radars create one contact and one P1 owner per canonical intent',async()=>{
  const u=await referred('referral-concurrent@example.invalid',codeA);const [x,y]=await Promise.all([complete(u),complete(u)]);assert.notEqual(x.id,y.id);assert.equal(await owner(await contact(u)),a.op);
  assert.equal((await db.query("select count(*)::int n from public.patrimonial_contacts where email='referral-concurrent@example.invalid'")).rows[0].n,1);
  for(const v of [x,y])assert.equal((await db.query('select count(*)::int n from public.patrimonial_assignments where intent_id=$1 and released_at is null',[(await caseFor(v.id)).intent_id])).rows[0].n,1);
 });
 await check('53 referral replay is idempotent and a changed code cannot rewrite attribution',async()=>{
  const u=await referred('referral-replay@example.invalid',codeA),body={requestId:randomUUID(),noticeVersion:SERVICE_NOTICE_VERSION};const x=await u.service.create(u.opaque,body),again=await u.service.create(u.opaque,body);assert.equal(x.id,again.id);
  const other=withCode(u,codeB);await assert.rejects(other.service.create(other.opaque,body));assert.equal((await attributed(x.id)).referral_code,codeA);assert.equal((await u.service.history(u.opaque)).length,1);
 });
 await check('54 ambiguous identity keeps the assessment private and never assigns from the referral',async()=>{
  const cid=await event('referral-ambiguous@example.invalid','Nome Originario',codeB);const u=await referred('referral-ambiguous@example.invalid',codeA,'Nome','Diverso'),x=await complete(u);
  assert.equal(await contact(u),undefined);assert.equal(await owner(cid),b.op);assert.equal((await attributed(x.id)).attribution_status,'IDENTITY_REVIEW');
 });
 await check('55 invalid referral holds only the new assessment, preserving the existing contact and previous B dossier',async()=>{
  const invalid=withCode(clientB,null),x=await complete(invalid),c=await caseFor(x.id);
  const row=(await db.query('select current_operator_id,contact_id,operator_revision from public.patrimonial_intents where id=$1',[c.intent_id])).rows[0];assert.equal(row.current_operator_id,null);assert.equal(row.contact_id,cidB);assert.equal(await owner(cidB),b.op);
  assert.equal((await personal(b,cidB,c.id)).data.ok,false);assert.equal((await personal(b,cidB,(await caseFor(radarB.id)).id)).data.ok,true);
  assert.equal((await hub(admin,{method:'assign',id:c.id,operatorId:b.op,expectedRevision:Number(row.operator_revision),requestId:randomUUID()})).ok,true);
  assert.equal((await personal(b,cidB,c.id)).data.ok,true);assert.equal((await attributed(x.id)).attribution_status,'REFERRAL_REVIEW');
 });
 await check('56 private provenance is append-only, has no financial fields, and closed gate denies new entrypoints',async()=>{
  await assert.rejects(db.query('update patrimonial_radar_private.assessment_referrals set referral_code=null where assessment_id=$1',[radarB.id]));
  const columns=(await db.query("select column_name from information_schema.columns where table_schema='patrimonial_radar_private' and table_name='assessment_referrals'")).rows.map(x=>x.column_name);assert.deepEqual(columns.sort(),['assessment_id','referral_code','referred_operator_id','attribution_status','created_at'].sort());
  await db.query('update patrimonial_radar_private.account_gate set enabled=false');assert.equal((await validate(codeA)).data.ok,false);assert.equal((await personal(b,cidB)).data.ok,false);await db.query('update patrimonial_radar_private.account_gate set enabled=true');
 });
 referralProof.canonicalIdsAgree=true;referralProof.codeRegistry='public.patrimonial_architect_referral_links';
 // Synthetic browser harness seed only. Never committed, never a real token.
 await writeFile(new URL('../../../referral-browser-private.json',import.meta.url),JSON.stringify({a,b,admin,codeA,codeB,cidA,cidB,radarA,radarB,secret,cfg}));
}
