import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {AccountRadarRpc,accountToken} from '../../src/lib/patrimonial-radar-server/account-rpc.ts';
import {PatrimonialRadarService} from '../../src/lib/patrimonial-radar-server/service.ts';

// Only the loopback native rehearsal imports this module. No grant is added here.
export const accountAcl5d={source:'Horyzon ACL facts supplied by the user; canonical Hub DDL',remoteWrites:0};
const schemas=async db=>(await db.query(`select
 has_schema_privilege('authenticated','public','USAGE') authenticated_public,
 has_schema_privilege('anon','public','USAGE') anon_public,
 has_schema_privilege('authenticated','hub','USAGE') authenticated_hub`)).rows[0];
const assertSchemas=acl=>assert.deepEqual(acl,{authenticated_public:false,anon_public:false,authenticated_hub:true});
const hubAcl=async db=>(await db.query(`select p.proname name,pg_get_function_identity_arguments(p.oid) args,
 pg_get_userbyid(p.proowner) owner,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='hub' and p.prokind='f' order by p.proname,args`)).rows;

export async function beforeAccountAcl(db){
 accountAcl5d.before=await schemas(db);assertSchemas(accountAcl5d.before);
 accountAcl5d.existingHubRpcAcl=await hubAcl(db);
 accountAcl5d.originalP1=(await db.query("select md5(replace(prosrc,E'\\r\\n',E'\\n')) hash from pg_proc where oid='public.patrimonial_assignment_guard()'::regprocedure")).rows[0].hash;
 assert.equal(accountAcl5d.originalP1,'753e1a961d78bb0f7faf0fdd026452f9');
}

export async function afterAccountAcl(db){
 accountAcl5d.after=await schemas(db);assertSchemas(accountAcl5d.after);
 const current=await hubAcl(db);
 for(const old of accountAcl5d.existingHubRpcAcl)assert.deepEqual(current.find(r=>r.name===old.name&&r.args===old.args),old,'Existing Hub RPC ACL/owner changed: '+old.name);
 assert.equal((await db.query("select to_regprocedure('public.patrimonial_radar_account_command(text,text)') absent")).rows[0].absent,null);
 const boundary=(await db.query(`select p.prosecdef,p.proconfig,pg_get_userbyid(p.proowner) owner,
 has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated,
 has_function_privilege('anon',p.oid,'EXECUTE') anon,
 has_function_privilege('service_role',p.oid,'EXECUTE') service_role
 from pg_proc p where p.oid='hub.patrimonial_radar_account_command(text,text)'::regprocedure`)).rows[0];
 assert.equal(boundary.prosecdef,true);assert.deepEqual(boundary.proconfig,['search_path=pg_catalog']);
 assert.equal(boundary.authenticated,true);assert.equal(boundary.anon,false);assert.equal(boundary.service_role,false);
 assert(!['authenticated','anon','service_role','authenticator'].includes(boundary.owner));
 assert.equal((await db.query("select has_function_privilege('authenticated','public.patrimonial_radar_command(jsonb)','EXECUTE') allowed")).rows[0].allowed,false);
 accountAcl5d.boundary=boundary;accountAcl5d.existingHubRpcCount=accountAcl5d.existingHubRpcAcl.length;
}

export async function verifyAccountAcl({db,cfg,secret,jwt,account,hub,check,managed,report,caseId,advisorB}){
 const rpc=async(name,body,token,profile='hub')=>{
  const r=await fetch(cfg.postgrestUrl+'/rpc/'+name,{method:'POST',headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json','Content-Profile':profile,'Accept-Profile':profile},body:JSON.stringify(body)});
  return {status:r.status,body:await r.json()};
 };
 const denied=r=>assert(r.status>=400||r.body?.ok===false,JSON.stringify(r));
 await check('34 real schema ACL preserved through M1/M2/M3; complete guarded hub boundary and selective EXECUTE',async()=>{
  assertSchemas(await schemas(db));await afterAccountAcl(db);
  assert.equal((await managed.service.read(managed.opaque,report.id)).id,report.id);
  const wrongProfile=await rpc('patrimonial_radar_account_command',{p_envelope:'{}',p_mac:null},managed.token,'public');
  // The old public function is absent, so schema-cache lookup rejects it before SQL.
  assert.equal(wrongProfile.status,404);assert.equal(wrongProfile.body.code,'PGRST202');accountAcl5d.publicDenied=wrongProfile;
 });
 await check('35 absent/unknown/revoked Auth session and expired JWT denied at the actual hub PostgREST entry',async()=>{
  const a=await account('acl-session@example.invalid');
  const bound=(token,sid=a.session_id)=>new PatrimonialRadarService(new AccountRadarRpc({url:cfg.postgrestUrl,key:'sb_publishable_synthetic',secret,token,uid:a.uid,sid,profile:a.profile,fetchImpl:(url,init)=>fetch(url.replace('/rest/v1',''),init)}),{kind:'SIMULATED',async sendCode(){throw Error('No email');}},secret);
  const opaque=accountToken(secret,a.uid,a.session_id);
  await assert.rejects(bound('').session(opaque));
  await assert.rejects(bound(jwt({sub:a.uid})).session(opaque));
  const unknown=randomUUID();await assert.rejects(bound(jwt({sub:a.uid,session_id:unknown}),unknown).session(accountToken(secret,a.uid,unknown)));
  await assert.rejects(bound(jwt({...a.claims,exp:Math.floor(Date.now()/1000)-60})).session(opaque));
  await db.query('delete from auth.sessions where id=$1',[a.session_id]);
  await assert.rejects(a.service.session(opaque));
 });
 await check('36 new Radar account has no Hub administration, Network, selection or generic function authority',async()=>{
  const a=await account('acl-ordinary@example.invalid');
  assert.equal((await db.query('select count(*)::int n from hub.user_roles where user_id=$1',[a.uid])).rows[0].n,0);
  for(const method of ['list','contacts','report','assign','link'])assert.equal((await hub(a,{method,id:caseId,requestId:randomUUID(),expectedRevision:0})).ok,false);
  const attempts=[['architect_candidate_admin_list_v1',{}],['architect_candidate_command_v1',{p_candidate_id:randomUUID(),p_action:'approve',p_expected_revision:0}],['architetti_search_accounts',{p_query:'inventata'}],['architetti_snapshot',{p_query:''}],['architetti_command',{p_action:'assign_contact',p_input:{contactId:randomUUID(),operatorId:randomUUID(),revision:0}}]];
  accountAcl5d.adminDenials=[];
  for(const [name,body] of attempts){const r=await rpc(name,body,a.token);assert.equal(r.status,403,name);assert.equal(r.body.code,'42501',name);assert(!/permission denied for schema auth/i.test(r.body.message),name+' must reach its real authorization guard');accountAcl5d.adminDenials.push({name,status:r.status,code:r.body.code,message:r.body.message});}
  for(const name of ['patrimonial_radar_command','patrimonial_foundation_command']){const r=await rpc(name,{p_command:{method:'history'}},a.token,'public');assert.equal(r.status,403);assert.equal(r.body.code,'42501');}
 });
 await check('37 no direct private tables, gate, Auth sessions or Hub role writes from an ordinary Radar account',async()=>{
  const a=await account('acl-tables@example.invalid');
  for(const sql of ['select * from patrimonial_radar_private.snapshots','select * from patrimonial_radar_private.account_gate','select * from auth.sessions',"select public.patrimonial_assignment_commit('{}',0)"]){
   await assert.rejects(db.transaction(c=>c.query(sql),'authenticated',a.claims),e=>e.code==='42501');
  }
  await assert.rejects(db.transaction(c=>c.query("insert into hub.user_roles(user_id,email,role) values($1,'spoof@example.invalid','superadmin')",[a.uid]),'authenticated',a.claims),e=>e.code==='42501');
  // This minimal Auth fixture grants no Auth-schema USAGE. A direct table read
  // may be rejected before RLS evaluates auth.uid(); neither outcome may expose a row.
  try{const rows=await db.transaction(c=>c.query('select user_id from hub.user_roles'),'authenticated',a.claims);assert.equal(rows.rowCount,0);accountAcl5d.directHubRoles='ZERO_ROWS';}
  catch(e){assert.equal(e.code,'42501');accountAcl5d.directHubRoles={code:e.code,message:e.message};}
 });
 await check('38 valid signed envelopes cannot request administrative methods, arbitrary SQL or another account identity',async()=>{
  const a=await account('acl-params@example.invalid');
  for(const command of [{method:'assign',contract:'patrimonial-radar-backend-1'},{method:'sql',sql:'select * from hub.user_roles'},{method:'history',contract:'unapproved'}])await assert.rejects(a.rpc.invoke(command));
  denied(await rpc('patrimonial_radar_account_command',{p_envelope:'{',p_mac:'0'.repeat(64)},a.token));
  denied(await rpc('patrimonial_radar_account_command',{p_envelope:'{}',p_mac:null},a.token));
  assert.equal((await hub(advisorB,{method:'report',id:caseId})).ok,true);
 });
 accountAcl5d.final=await schemas(db);assertSchemas(accountAcl5d.final);
}
