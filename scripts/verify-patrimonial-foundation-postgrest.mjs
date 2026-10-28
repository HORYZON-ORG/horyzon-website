import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHmac,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {LocalPatrimonialHubGateway,handleLocalHubGateway} from '../src/lib/patrimonial-radar-server/hub-gateway.ts';
const arg=process.argv.find(a=>a.startsWith('--pg-module=')),configArg=process.argv.find(a=>a.startsWith('--local-config='));
if(!arg||!configArg)throw Error('Explicit local native PG module and synthetic JWT config required; no remote fallback');
const config=JSON.parse(await readFile(resolve(configArg.slice(15)),'utf8'));
if(config.databaseUrl!=='postgres://postgres@127.0.0.1:15439/radar_5a_test'||config.postgrestUrl!=='http://127.0.0.1:15440')throw Error('Dedicated local synthetic services only');
const {default:pg}=await import(pathToFileURL(resolve(arg.slice(12))).href),db=new pg.Client({connectionString:config.databaseUrl});await db.connect();
const passed=[],check=async(name,fn)=>{await fn();passed.push(name);};
function token(sub,session_id,extra={}){const head=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');const body=Buffer.from(JSON.stringify({role:'authenticated',sub,session_id,exp:Math.floor(Date.now()/1000)+600,...extra})).toString('base64url');return head+'.'+body+'.'+createHmac('sha256',config.secret).update(head+'.'+body).digest('base64url');}
const uid=randomUUID(),sid=randomUUID();
const raw=(jwt,command)=>fetch(config.postgrestUrl+'/rpc/patrimonial_radar_command',{method:'POST',headers:{'Content-Type':'application/json','Content-Profile':'hub',...(jwt?{Authorization:'Bearer '+jwt}:{})},body:JSON.stringify({p_command:{contract:'patrimonial-foundation-5a-1',...command}})});
try{
 await db.query("NOTIFY pgrst,'reload schema'");
 // Wait for the actual function to enter PostgREST's schema cache, at most 3s.
 for(let i=0;i<30;i++){const r=await raw(null,{method:'list'});if(r.status!==404)break;await new Promise(r=>setTimeout(r,100));}
 await db.query('insert into auth.users(id) values($1)',[uid]);await db.query("insert into auth.sessions(id,user_id,not_after) values($1,$2,now()+interval '1 hour')",[sid,uid]);
 const jwt=token(uid,sid),gateway=new LocalPatrimonialHubGateway(config.postgrestUrl);
 await check('PostgREST signature, role and live session are mandatory',async()=>{
  assert([401,403,404].includes((await raw(null,{method:'list'})).status));
  assert.equal((await raw(jwt.slice(0,-8)+'invalidx',{method:'list'})).status,401);
  await assert.rejects(gateway.command(token(uid,randomUUID()),{method:'list'}),{code:'FORBIDDEN'});
  await assert.rejects(gateway.command(jwt,{method:'list'}),{code:'FORBIDDEN'});
 });
 await db.query("insert into hub.patrimonial_radar_permissions(user_id,permission,expires_at,evidence_ref) values($1,'RADAR_PATRIMONIAL_LIST',now()+interval '1 hour','SYNTHETIC_POSTGREST_ONLY')",[uid]);
 await check('Dedicated LIST returns minimized rows, grants no PERSON/ADVISOR/direct table access',async()=>{
  const list=await gateway.command(jwt,{method:'list'});const expected=(await db.query('select count(*)::int n from patrimonial_radar_private.cases c join patrimonial_radar_private.persons p on p.id=c.person_id where p.deleted_at is null')).rows[0].n;assert.equal(list.rows.length,expected);assert(expected>0);assert(!/answer|amount|email_key|resultHash/.test(JSON.stringify(list)));
  await assert.rejects(gateway.command(jwt,{method:'person',id:list.rows[0].personId}),{code:'FORBIDDEN'});
  await assert.rejects(gateway.command(jwt,{method:'report',id:list.rows[0].id}),{code:'FORBIDDEN'});
  const r=await fetch(config.postgrestUrl+'/patrimonial_radar_permissions?select=*',{headers:{Authorization:'Bearer '+jwt,'Accept-Profile':'hub'}});assert(!r.ok);
  const privateSchema=await fetch(config.postgrestUrl+'/snapshots?select=*',{headers:{Authorization:'Bearer '+jwt,'Accept-Profile':'patrimonial_radar_private'}});assert(!privateSchema.ok);
 });
 await check('HTTP gateway rejects cross-origin/CSRF/extra identities, is off outside local context',async()=>{
  const env={PATRIMONIAL_RADAR_HUB_CONTEXT:'local-test',PATRIMONIAL_RADAR_HUB_LOCAL_ORIGIN:'http://127.0.0.1:15442',PATRIMONIAL_RADAR_HUB_LOCAL_POSTGREST:config.postgrestUrl};
  const req=(patch={},body={method:'list'})=>new Request('http://127.0.0.1:15441/api/internal/patrimonial-hub',{method:'POST',headers:{Origin:env.PATRIMONIAL_RADAR_HUB_LOCAL_ORIGIN,'Content-Type':'application/json','X-Patrimonial-Hub':'5a',Authorization:'Bearer '+jwt,...patch},body:JSON.stringify(body)});
  assert.equal((await handleLocalHubGateway(req(),env)).status,200);
  assert.equal((await handleLocalHubGateway(req({Origin:'https://attacker.invalid'}),env)).status,403);
  assert.equal((await handleLocalHubGateway(req({'X-Patrimonial-Hub':''}),env)).status,403);
  assert.equal((await handleLocalHubGateway(req({}, {method:'list',userId:uid}),env)).status,400);
  assert.equal((await handleLocalHubGateway(req(),{...env,VERCEL:'1'})).status,404);
  assert.equal((await handleLocalHubGateway(req(),{})).status,404);
 });
 await check('Permission CAS/history, revocation and deleted session defeat a still-valid JWT',async()=>{
  await assert.rejects(db.query('update hub.patrimonial_radar_permissions set revoked_at=now() where user_id=$1',[uid]));
  await db.query('update hub.patrimonial_radar_permissions set revoked_at=now(),revision=revision+1 where user_id=$1',[uid]);
  await assert.rejects(gateway.command(jwt,{method:'list'}),{code:'FORBIDDEN'});
  const history=await db.query("select count(*)::int n from patrimonial_radar_private.foundation_metadata_history where registry='hub.patrimonial_radar_permissions' and record->>'user_id'=$1",[uid]);assert.equal(history.rows[0].n,2);
  await assert.rejects(db.query('delete from hub.patrimonial_radar_read_audit'));
  await db.query('delete from auth.sessions where id=$1',[sid]);await assert.rejects(gateway.command(jwt,{method:'list'}),{code:'FORBIDDEN'});
 });
 console.log(JSON.stringify({status:'PASS',postgrest:'16.5 native loopback',passed,productionIdentityProof:'NOT_RUN',remoteWrites:0},null,2));
}finally{await db.end();}
