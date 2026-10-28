import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID,createHmac} from 'node:crypto';
import {resolve} from 'node:path';
import {foundationDatabase} from './lib/patrimonial-foundation-db.mjs';
import {PatrimonialRadarService} from '../src/lib/patrimonial-radar-server/service.ts';
import {ResendRadarEmail} from '../src/lib/patrimonial-radar-server/resend-email.ts';
import {RemoteRadarRpc} from '../src/lib/patrimonial-radar-server/remote-store.ts';
import {protectedRemoteConfigured} from '../src/lib/patrimonial-radar-server/remote-config.ts';
import {vercelNetworkKey} from '../src/lib/patrimonial-radar-server/remote-runtime.ts';
import {createPatrimonialRadarHandler} from '../src/lib/patrimonial-radar-server/http.ts';
import {PatrimonialFoundation} from '../src/lib/patrimonial-radar-server/foundation.ts';
import {SERVICE_NOTICE_VERSION} from '../src/lib/patrimonial-radar-server/contracts.ts';
import {radarAdminCommand} from '../src/lib/patrimonial-radar-server/admin-contract.ts';
import {handleRemoteHubGateway,remoteHubReport} from '../src/lib/patrimonial-radar-server/remote-hub.ts';
const platform=process.argv.find(a=>a.startsWith('--network-platform='))?.slice(19);
const config=process.argv.find(a=>a.startsWith('--local-config='))?.slice(15);
if(!platform||!config)throw Error('Explicit local Platform/config required');
const cfg=JSON.parse(await readFile(config,'utf8'));
assert.equal(cfg.postgrestUrl,'http://127.0.0.1:15440');
const db=await foundationDatabase({networkPlatform:platform}),passed=[];
const secret='synthetic-activation-secret-00000000000000',mail=new Map(),calls=[];
const email=new ResendRadarEmail({key:'re_synthetic_credential_only',from:'radar@horyzon.it',replyTo:'info@horyzon.it',fetchImpl:async(url,init)=>{
 assert.equal(url,'https://api.resend.com/emails');const body=JSON.parse(init.body);assert(body.to[0].endsWith('.invalid'),'No real recipient permitted in verifier');
 calls.push({headers:init.headers,body});mail.set(body.to[0],body.text.match(/\d{8}/)[0]);return Response.json({id:'synthetic-provider-message'});
}});
async function check(name,fn){await fn();passed.push(name);console.log('PASS '+name);}
async function staff(){const sub=randomUUID(),session_id=randomUUID();await db.query('insert into auth.users(id) values($1)',[sub]);await db.query("insert into auth.sessions values($1,$2,now()+interval '1 hour')",[session_id,sub]);await db.query("insert into hub.user_roles(user_id,email,role) values($1,$2,'superadmin')",[sub,sub+'@example.invalid']);return {sub,session_id};}
const cmd=(claims,command)=>db.transaction(c=>c.query('select hub.patrimonial_radar_admin_command($1) value',[JSON.stringify({contract:'radar-admin-5b2-1',requestId:randomUUID(),evidenceRef:'SYNTHETIC_APPROVAL_ONLY',...command})]),'authenticated',claims).then(r=>r.rows[0].value);
let admin,unapproved,person,binding,contact,grant;
const sign=claims=>{const h=Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),p=Buffer.from(JSON.stringify(claims)).toString('base64url');return h+'.'+p+'.'+createHmac('sha256',cfg.secret).update(h+'.'+p).digest('base64url');};
try{
 await db.query('drop role if exists patrimonial_radar_runtime');
 await db.query(await readFile(resolve(platform,'packages/database/pending/20261021191024_patrimonial_radar_activation_candidate.sql'),'utf8'));
 await check('Empty runtime/admin registries and NOLOGIN NOBYPASSRLS scoped role',async()=>{
  const role=(await db.query("select rolcanlogin,rolbypassrls,rolsuper from pg_roles where rolname='patrimonial_radar_runtime'")).rows[0];assert.deepEqual(role,{rolcanlogin:false,rolbypassrls:false,rolsuper:false});
  for(const t of ['hub.patrimonial_radar_administrators','patrimonial_radar_private.runtime_deployments','hub.patrimonial_radar_permissions'])assert.equal((await db.query('select count(*)::int n from '+t)).rows[0].n,0);
 });
 await check('Strict admin client contract and remote Advisor boundary default closed',async()=>{
  const input={method:'review_binding',id:randomUUID(),requestId:randomUUID(),evidenceRef:'SYNTHETIC_REVIEW_ONLY',expectedRevision:0,contactRevision:0,state:'VERIFIED'};
  assert.equal(radarAdminCommand(input).contract,'radar-admin-5b2-1');
  for(const patch of [{isAdmin:true},{answers:[]},{state:'MERGE'},{evidenceRef:'user@example.invalid'},{expectedRevision:-1}])assert.throws(()=>radarAdminCommand({...input,...patch}));
  assert.equal((await handleRemoteHubGateway(new Request('https://synthetic.test'),{})).status,404);
  let external=0;
  await assert.rejects(remoteHubReport('invalid',{method:'report',id:randomUUID()},'sb_publishable_synthetic',async()=>{external++;throw Error();}));
  assert.equal(external,0);
  await assert.rejects(remoteHubReport('header.payload.signature',{method:'report',id:randomUUID()},'sb_publishable_synthetic',async()=>new Response('',{status:401})),{code:'UNAUTHENTICATED'});
 });
 const service=new PatrimonialRadarService(db.rpc,email,secret);
 await check('Resend adapter intercepted, one-time challenge, generic request and existing DB anti-abuse',async()=>{
  const one=await service.requestCode('activation@example.invalid','synthetic-origin');
  const two=await service.requestCode('activation@example.invalid','synthetic-origin');
  assert.equal(calls.length,1);assert.equal(one.message,two.message);
  assert.match(calls[0].headers['Idempotency-Key'],/^radar-otp:/);
  assert(!/https:|<img|snapshot|answers|marketing/.test(calls[0].body.text));
  person=await service.verifyCode({challengeId:one.challengeId,code:mail.get('activation@example.invalid')},one.binding,one.csrf,'synthetic-origin');
  await assert.rejects(service.verifyCode({challengeId:one.challengeId,code:mail.get('activation@example.invalid')},one.binding,one.csrf,'synthetic-origin'),{code:'UNAUTHENTICATED'});
 });
 await check('Provider transient retry same body/key; permanent errors sanitized, no recipient/OTP in exception',async()=>{
  let count=0,first;const provider=new ResendRadarEmail({key:'re_synthetic_credential_only',from:'radar@horyzon.it',replyTo:'info@horyzon.it',fetchImpl:async(_url,init)=>{count++;if(!first)first=init;else{assert.equal(init.body,first.body);assert.deepEqual(init.headers,first.headers);}return new Response('',{status:count===1?503:200});}});
  await provider.sendCode({email:'retry@example.invalid',code:'12345678',expiresInSeconds:600,challengeId:randomUUID()});assert.equal(count,2);
  const fail=new ResendRadarEmail({key:'re_synthetic_credential_only',from:'radar@horyzon.it',replyTo:'info@horyzon.it',fetchImpl:async()=>new Response('12345678 retry@example.invalid',{status:403})});
  await assert.rejects(fail.sendCode({email:'retry@example.invalid',code:'12345678',expiresInSeconds:600,challengeId:randomUUID()}),e=>e.message==='UNAVAILABLE');
 });
 await check('HttpOnly Secure session, exact Origin/CSRF, no token in JSON, current-session revoke',async()=>{
  const handler=createPatrimonialRadarHandler(service,{origin:'https://synthetic.test',production:true,enabled:true,foundation:new PatrimonialFoundation(db.rpc,secret)});
  let r=await handler(new Request('https://synthetic.test/api/patrimonial-radar/identity/request',{method:'POST',headers:{Origin:'https://evil.invalid','Content-Type':'application/json','X-Patrimonial-CSRF':'request-code'},body:'{"email":"other@example.invalid"}'}));assert.equal(r.status,403);
  r=await handler(new Request('https://synthetic.test/api/patrimonial-radar/identity/request',{method:'POST',headers:{Origin:'https://synthetic.test','Content-Type':'application/json','X-Patrimonial-CSRF':'request-code'},body:'{"email":"http@example.invalid"}'}));assert.equal(r.status,202);
  const cookie=r.headers.get('set-cookie').split(';')[0],challenge=await r.json();assert.match(r.headers.get('set-cookie'),/HttpOnly; SameSite=Strict; Max-Age=600; Secure/);
  r=await handler(new Request('https://synthetic.test/api/patrimonial-radar/identity/verify',{method:'POST',headers:{Origin:'https://synthetic.test','Content-Type':'application/json','X-Patrimonial-CSRF':challenge.csrf,Cookie:cookie},body:JSON.stringify({challengeId:challenge.challengeId,code:mail.get('http@example.invalid')})}));assert.equal(r.status,200);assert(!('token' in await r.json()));assert(r.headers.get('set-cookie').includes('__Host-pr_session='));
  const sessionCookie=r.headers.getSetCookie().find(c=>c.startsWith('__Host-pr_session=')).split(';')[0];
  const s=await (await handler(new Request('https://synthetic.test/api/patrimonial-radar/session',{headers:{Cookie:sessionCookie}}))).json();
  r=await handler(new Request('https://synthetic.test/api/patrimonial-radar/session/revoke',{method:'POST',headers:{Origin:'https://synthetic.test','Content-Type':'application/json','X-Patrimonial-CSRF':s.csrf,Cookie:sessionCookie},body:'{}'}));assert.equal(r.status,200);
  assert.equal((await handler(new Request('https://synthetic.test/api/patrimonial-radar/session',{headers:{Cookie:sessionCookie}}))).status,401);
 });
 await check('Administrative authority is nominative, no generic superadmin escalation',async()=>{
  admin=await staff();unapproved=await staff();
  assert.equal((await cmd(unapproved,{method:'grant_permission',userId:unapproved.sub,permission:'RADAR_PATRIMONIAL_LIST',expiresAt:new Date(Date.now()+3600000).toISOString()})).code,'FORBIDDEN');
  for(const scope of ['PERMISSIONS','IDENTITY'])await db.query("insert into hub.patrimonial_radar_administrators values($1,$2,now()+interval '1 hour',null,'SYNTHETIC_NOMINATIVE_ONLY')",[admin.sub,scope]);
  const r=await cmd(admin,{method:'grant_permission',userId:unapproved.sub,permission:'RADAR_PATRIMONIAL_LIST',expiresAt:new Date(Date.now()+3600000).toISOString()});assert.equal(r.ok,true);grant=r.data;
  assert.equal((await cmd(admin,{method:'grant_permission',userId:unapproved.sub,permission:'RADAR_PATRIMONIAL_ADVISOR',operatorId:randomUUID(),expiresAt:new Date(Date.now()+3600000).toISOString()})).code,'FORBIDDEN');
  const revoked=await cmd(admin,{method:'revoke_permission',id:grant.id,expectedRevision:grant.revision});assert.equal(revoked.ok,true);
  assert.equal((await db.query('select revoked_at is not null revoked from hub.patrimonial_radar_permissions where id=$1',[grant.id])).rows[0].revoked,true);
 });
 await check('All four permission contracts can be provisioned/revoked, with authoritative Advisor operator binding',async()=>{
  const operatorId=randomUUID();
  await db.query("insert into public.patrimonial_operators(id,operator_key,display_name,user_id,network_enabled,network_role) values($1,$2,'Operatore sintetico',$3,true,'architect')",[operatorId,'activation-'+operatorId,unapproved.sub]);
  for(const suffix of ['LIST','PERSON','ASSIGN','ADVISOR']){
   const r=await cmd(admin,{method:'grant_permission',userId:unapproved.sub,permission:'RADAR_PATRIMONIAL_'+suffix,...(suffix==='ADVISOR'?{operatorId}:{}),expiresAt:new Date(Date.now()+3600000).toISOString()});
   assert.equal(r.ok,true);
   const row=(await db.query('select operator_id from hub.patrimonial_radar_permissions where id=$1',[r.data.id])).rows[0];assert.equal(row.operator_id,suffix==='ADVISOR'?operatorId:null);
   assert.equal((await cmd(admin,{method:'revoke_permission',id:r.data.id,expectedRevision:0})).ok,true);
  }
  assert.equal((await cmd(admin,{method:'grant_permission',userId:unapproved.sub,permission:'RADAR_PATRIMONIAL_LIST',expiresAt:new Date(Date.now()+31*86400000).toISOString()})).code,'INVALID');
 });
 await check('Candidate review CAS/evidence, stable person/contact IDs, repeat Radar preservation',async()=>{
  const draft=await service.create(person.token,{requestId:randomUUID(),noticeVersion:SERVICE_NOTICE_VERSION});
  const c=(await db.query('select * from patrimonial_radar_private.contact_bindings where person_id=$1',[person.personId])).rows[0];contact=c.contact_id;
  // Independent candidate person, not a financial merge.
  const another=await service.requestCode('candidate.activation@example.invalid','another-origin');
  const candidate=await service.verifyCode({challengeId:another.challengeId,code:mail.get('candidate.activation@example.invalid')},another.binding,another.csrf,'another-origin');
  const cid=randomUUID();await db.query("insert into public.patrimonial_contacts(id,full_name,source) values($1,'Candidato sintetico','manual')",[cid]);
  const proposed=await cmd(admin,{method:'propose_binding',id:cid,personId:candidate.personId});assert.equal(proposed.ok,true);binding=proposed.data;
  assert.equal((await cmd(admin,{method:'review_binding',id:binding.id,expectedRevision:99,contactRevision:0,state:'VERIFIED'})).code,'CONFLICT');
  const review={method:'review_binding',id:binding.id,expectedRevision:0,contactRevision:0,state:'VERIFIED',requestId:randomUUID()};
  const verified=await cmd(admin,review);assert.equal(verified.ok,true);
  assert.deepEqual(await cmd(admin,review),verified);
  assert.equal((await cmd(admin,{...review,state:'REVOKED'})).code,'CONFLICT');
  assert.equal((await service.read(person.token,draft.id)).id,draft.id);
  await service.create(person.token,{requestId:randomUUID(),noticeVersion:SERVICE_NOTICE_VERSION});
  assert.equal((await db.query("select count(*)::int n from patrimonial_radar_private.contact_bindings where person_id=$1 and state='VERIFIED'",[person.personId])).rows[0].n,1);
 });
 await check('Already-bound contact, revoked binding and changed/shared mailbox never merge financial identities',async()=>{
  assert.equal((await cmd(admin,{method:'propose_binding',id:contact,personId:person.personId})).code,'CONFLICT');
  const b=(await db.query('select * from patrimonial_radar_private.contact_bindings where id=$1',[binding.id])).rows[0];
  const rev=await cmd(admin,{method:'review_binding',id:b.id,expectedRevision:b.revision,contactRevision:1,state:'REVOKED'});assert.equal(rev.ok,true);
  assert.equal((await cmd(admin,{method:'review_binding',id:b.id,expectedRevision:b.revision+1,contactRevision:2,state:'VERIFIED'})).code,'CONFLICT');
  const key=service.secrets.hash('email-v1','activation@example.invalid');
  assert.equal((await cmd(admin,{method:'quarantine_mailbox',emailKey:key,reason:'EMAIL_CHANGE'})).ok,true);
  await assert.rejects(service.session(person.token),{code:'FORBIDDEN'});
  assert.equal((await db.query('select count(*)::int n from patrimonial_radar_private.assessments where person_id=$1',[person.personId])).rows[0].n,2);
 });
 await check('Live admin session revocation, append-only audit and no client table grants',async()=>{
  await db.query('delete from auth.sessions where id=$1',[admin.session_id]);
  assert.equal((await cmd(admin,{method:'revoke_permission',id:grant.id,expectedRevision:1})).code,'FORBIDDEN');
  const audit=(await db.query('select distinct outcome from hub.patrimonial_radar_admin_audit')).rows.map(r=>r.outcome);assert(audit.includes('AUTHORIZED'));assert(audit.includes('DENIED'));assert(audit.includes('CONFLICT'));
  await assert.rejects(db.query('delete from hub.patrimonial_radar_admin_audit'));
  for(const role of ['anon','authenticated','patrimonial_radar_runtime'])for(const table of ['patrimonial_radar_private.snapshots','hub.patrimonial_radar_permissions','hub.patrimonial_radar_administrators'])assert.equal((await db.query('select has_table_privilege($1,$2,\'SELECT\') allowed',[role,table])).rows[0].allowed,false);
 });
 await check('Remote deployment gates reject foreign runtime, project, target, anonymous flags, ingress lists',async()=>{
  const env={PATRIMONIAL_RADAR_BACKEND_ENABLED:'true',PATRIMONIAL_RADAR_BACKEND_CONTEXT:'protected-remote',PATRIMONIAL_RADAR_FOUNDATION_CONTEXT:'protected-remote',VERCEL:'1',VERCEL_ENV:'preview',VERCEL_PROJECT_ID:'prj_bJvIOswh4GacqtUootXATXeAkSUO',VERCEL_DEPLOYMENT_ID:'dpl_synthetic',VERCEL_URL:'synthetic.vercel.app',PATRIMONIAL_RADAR_REMOTE_ORIGIN:'https://synthetic.vercel.app',PATRIMONIAL_RADAR_SUPABASE_URL:'https://pmkyeqrfkunypfkbjnyg.supabase.co',PATRIMONIAL_RADAR_MODE:'VERIFIED_PERSISTENT',PATRIMONIAL_RADAR_VERIFIED_PERSISTENT_ENABLED:'true',PATRIMONIAL_RADAR_ACTIVATION_APPROVAL_REF:'SYNTHETIC_ONLY',PATRIMONIAL_RADAR_NOTICE_APPROVAL:SERVICE_NOTICE_VERSION};
  assert(protectedRemoteConfigured(env));
  for(const key of ['PATRIMONIAL_CRM_WRITE_ENABLED','PATRIMONIAL_OPPORTUNITY_WRITE_ENABLED','PATRIMONIAL_BOOKING_ENABLED','PATRIMONIAL_MESSAGES_ENABLED','PATRIMONIAL_WEBHOOK_ENABLED','PATRIMONIAL_ASSIGNMENTS_ENABLED','PATRIMONIAL_OWNER_SYNC_ENABLED','PATRIMONIAL_HIGHLEVEL_PERFORMANCE_WEBHOOK_ENABLED'])assert(!protectedRemoteConfigured({...env,[key]:'true'}),'Remote writers must keep activation closed: '+key);
  for(const change of [{VERCEL_ENV:'production'},{VERCEL:'0'},{VERCEL_PROJECT_ID:'other'},{PATRIMONIAL_RADAR_PUBLIC_ANONYMOUS_ENABLED:'true'},{PATRIMONIAL_RADAR_REMOTE_ORIGIN:'https://evil.invalid'},{PATRIMONIAL_RADAR_NOTICE_APPROVAL:''}])assert(!protectedRemoteConfigured({...env,...change}));
  assert.equal(vercelNetworkKey(new Request('https://synthetic.test',{headers:{'x-forwarded-for':'192.0.2.14'}})),'192.0.2.14');
  assert.throws(()=>vercelNetworkKey(new Request('https://synthetic.test',{headers:{'x-forwarded-for':'192.0.2.14, 192.0.2.15'}})));
 });
 await check('Real PostgREST signature + scoped runtime role, registration and revocation; no raw table/service access',async()=>{
  await db.query("notify pgrst,'reload schema'");await new Promise(r=>setTimeout(r,400));
  const jti=randomUUID(),claims={role:'patrimonial_radar_runtime',ref:'pmkyeqrfkunypfkbjnyg',jti,deployment_id:'dpl_synthetic',exp:Math.floor(Date.now()/1000)+600},token=sign(claims);
  // Explicit loopback rewrite is TEST-ONLY; production adapter's URL remains pinned.
  const wire=async(url,init)=>{assert.equal(new URL(url).origin,'https://pmkyeqrfkunypfkbjnyg.supabase.co');return fetch(cfg.postgrestUrl+new URL(url).pathname.replace('/rest/v1',''),init);};
  const rpc=new RemoteRadarRpc({url:'https://pmkyeqrfkunypfkbjnyg.supabase.co',apiKey:'sb_publishable_synthetic_only',runtimeToken:token,fetchImpl:wire});
  await assert.rejects(rpc.attest('dpl_synthetic'),{code:'UNAVAILABLE'});
  await db.query("insert into patrimonial_radar_private.runtime_deployments values($1,'pmkyeqrfkunypfkbjnyg','dpl_synthetic',now()+interval '10 minutes',null,'SYNTHETIC_RUNTIME_ONLY')",[jti]);
  await rpc.attest('dpl_synthetic');
  assert.equal((await fetch(cfg.postgrestUrl+'/rpc/patrimonial_radar_runtime_health',{method:'POST',headers:{Authorization:'Bearer '+token.slice(0,-4)+'xxxx','Content-Type':'application/json'},body:'{}'})).status,401);
  assert(!(await fetch(cfg.postgrestUrl+'/rpc/patrimonial_radar_command',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{"p_command":{}}'})).ok);
  const remoteService=new PatrimonialRadarService(rpc,email,secret),r=await remoteService.requestCode('remote.runtime@example.invalid','remote-network-synthetic');
  const s=await remoteService.verifyCode({challengeId:r.challengeId,code:mail.get('remote.runtime@example.invalid')},r.binding,r.csrf,'remote-network-synthetic');
  assert.equal((await remoteService.session(s.token)).personId,s.personId);
  await db.query('update patrimonial_radar_private.runtime_deployments set revoked_at=now() where token_id=$1',[jti]);
  await assert.rejects(remoteService.session(s.token),{code:'UNAVAILABLE'});
 });
 console.log(JSON.stringify({status:'PASS',groups:passed.length,passed,provider:'INTERCEPTED_RESEND_NO_EMAIL',auth:'SYNTHETIC_USERS_AND_SIGNING_KEY',database:'NATIVE_POSTGRESQL_POSTGREST',remoteWrites:0},null,2));
}finally{await db.close();}
