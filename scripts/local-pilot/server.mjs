// Local infrastructure fixture; real application components/handlers are unchanged.
// This is NOT a Supabase Auth implementation or proof of a production identity.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
import {randomUUID,randomBytes,createHmac} from 'node:crypto';
if(!process.argv.includes('--synthetic-local-only')||process.env.VERCEL)throw Error('Explicit synthetic runner required');
const cfg=JSON.parse(fs.readFileSync(process.env.RADAR_LOCAL_CONFIG,'utf8'));
if(cfg.databaseUrl!=='postgres://postgres@127.0.0.1:15439/radar_5a_test'||cfg.postgrestUrl!=='http://127.0.0.1:15440')throw Error('Dedicated local database only');
const {default:pg}=await import(pathToFileURL(path.resolve(process.env.RADAR_PG_MODULE)).href);
const db=new pg.Pool({connectionString:cfg.databaseUrl});
function jwt(claims){const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),p=Buffer.from(JSON.stringify({...claims,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+86400})).toString('base64url'),v=h+'.'+p;return v+'.'+createHmac('sha256',cfg.secret).update(v).digest('base64url');}
const users=new Map(),objects=new Map(),mail=new Map(),events=[];
for(const [name,permissions,op] of [['admin',['LIST','PERSON','ASSIGN'],false],['a',['LIST','PERSON','ADVISOR'],true],['b',['LIST','PERSON','ADVISOR'],true],['generic',[],false]]){
  const id=randomUUID(),sid=randomUUID(),operatorId=op?randomUUID():null,email=`${name}.staff@example.invalid`;
  await db.query('insert into auth.users(id) values($1)',[id]);
  await db.query("insert into auth.sessions(id,user_id,not_after) values($1,$2,now()+interval '24 hours')",[sid,id]);
  const network=(await db.query("select to_regclass('public.patrimonial_contacts') is not null ready")).rows[0].ready;
  if(op)await db.query(network?"insert into public.patrimonial_operators(id,operator_key,display_name,user_id,network_enabled,network_role) values($1,$2,$3,$4,true,'architect')":'insert into public.patrimonial_operators(id,operator_key,display_name) values($1,$2,$3)',network?[operatorId,'browser-5b1-'+id,'Consulente sintetico '+name.toUpperCase(),id]:[operatorId,'browser-5b1-'+id,'Consulente sintetico '+name.toUpperCase()]);
  if(network)await db.query("insert into hub.user_roles(user_id,email,role) values($1,$2,$3)",[id,email,op?'client':'superadmin']);
  for(const p of permissions)await db.query("insert into hub.patrimonial_radar_permissions(user_id,permission,operator_id,expires_at,evidence_ref) values($1,$2,$3,now()+interval '24 hours','SYNTHETIC_BROWSER_5B1_ONLY')",[id,'RADAR_PATRIMONIAL_'+p,p==='ADVISOR'?operatorId:null]);
  const user={id,aud:'authenticated',role:'authenticated',email,app_metadata:{provider:'synthetic-local-only',providers:['synthetic-local-only']},user_metadata:{},created_at:new Date().toISOString()};
  users.set(email,{name,user,operatorId,token:jwt({sub:id,role:'authenticated',session_id:sid,aud:'authenticated',iss:'synthetic-local-5b1'})});
}
const serverKey=randomBytes(32).toString('hex'),service=jwt({role:'service_role'});
const origin='http://127.0.0.1:15444',website='http://127.0.0.1:15443',hub='http://127.0.0.1:15445';
const env={
  RADAR_SYNTHETIC_LOCAL_ONLY:'5b1',
  PATRIMONIAL_V2_ENABLED:'true',PATRIMONIAL_DURABLE_STORE_READY:'true',
  SUPABASE_URL:origin,SUPABASE_SERVICE_ROLE_KEY:serverKey,
  HIGHLEVEL_PRIVATE_TOKEN:'SYNTHETIC_NO_REMOTE_DELIVERY',HIGHLEVEL_LOCATION_ID:'SYNTHETIC_RECRUITMENT_ONLY',
  PATRIMONIAL_RADAR_BACKEND_ENABLED:'true',PATRIMONIAL_RADAR_BACKEND_CONTEXT:'local-test',
  PATRIMONIAL_RADAR_FOUNDATION_CONTEXT:'local-test',PATRIMONIAL_EVENT_RADAR_CONTEXT:'local-test',
  PATRIMONIAL_RADAR_LOCAL_ORIGIN:website,PATRIMONIAL_RADAR_LOCAL_SUPABASE_URL:origin,
  PATRIMONIAL_RADAR_LOCAL_SERVER_KEY:serverKey,PATRIMONIAL_RADAR_LOCAL_SECRET:process.env.RADAR_LOCAL_SYNTHETIC_SECRET??randomBytes(48).toString('hex'),
  PATRIMONIAL_RADAR_LOCAL_SIMULATED_EMAIL_URL:origin+'/simulated-email',
  PATRIMONIAL_RADAR_MODE:'VERIFIED_PERSISTENT',PATRIMONIAL_RADAR_VERIFIED_PERSISTENT_ENABLED:'true',
  PATRIMONIAL_RADAR_DEMO_ENABLED:'true',PATRIMONIAL_RADAR_DEMO_CONTEXT:'local-test',
  PATRIMONIAL_RADAR_HUB_CONTEXT:'local-test',PATRIMONIAL_RADAR_HUB_LOCAL_ORIGIN:hub,
  PATRIMONIAL_RADAR_HUB_LOCAL_POSTGREST:cfg.postgrestUrl,
  PATRIMONIAL_RADAR_HUB_LOCAL_GATEWAY:website+'/api/internal/patrimonial-hub',
  VITE_SUPABASE_URL:origin,VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic_local_5b1',
  SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic_local_5b1',VITE_SUPABASE_SCHEMA:'hub',
};
fs.writeFileSync(process.env.RADAR_LOCAL_ENV,JSON.stringify(env));
const reply=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'});res.end(JSON.stringify(value));};
const server=createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,origin),o=req.headers.origin;
  if(o&&![website,hub].includes(o))return reply(res,403,{error:'origin'});
  if(o){res.setHeader('Access-Control-Allow-Origin',o);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','authorization,apikey,content-type,x-client-info,x-supabase-api-version,content-profile,accept-profile');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');}
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>6*1024*1024)throw Error('size');chunks.push(chunk);}const body=Buffer.concat(chunks);
  const json=()=>JSON.parse(body.toString()||'{}');
  if(u.pathname==='/simulated-email'){
    if(req.headers.apikey!==serverKey)return reply(res,403,{});
    const m=json();if(!m.email.endsWith('.invalid'))return reply(res,400,{});
    mail.set(m.email,m.code);return reply(res,200,{ok:true});
  }
  // Deliberate synthetic inbox UI for browser tests; no endpoint in the application.
  if(u.pathname==='/synthetic-inbox'){
    res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});
    return res.end('<h1>Casella OTP sintetica locale — nessuna email inviata</h1>'+[...mail].map(([e,c])=>`<p>${e}: <strong>${c}</strong></p>`).join(''));
  }
  if(u.pathname==='/auth/v1/token'){
    const p=json(),s=users.get(p.email);if(!s||p.password!=='synthetic-local-only')return reply(res,400,{message:'Synthetic credentials only'});
    return reply(res,200,{access_token:s.token,token_type:'bearer',expires_in:86400,refresh_token:'SYNTHETIC_'+s.name,user:s.user});
  }
  if(u.pathname==='/auth/v1/logout')return reply(res,200,{});
  const user=[...users.values()].find(s=>'Bearer '+s.token===req.headers.authorization);
  if(u.pathname==='/auth/v1/user')return reply(res,user?200:401,user?.user??{});
  if(u.pathname==='/rest/v1/user_roles')return reply(res,user?200:401,user?{role:'superadmin',company_id:null,can_edit:false,can_import:false,can_export:false}:{});
  if(u.pathname.startsWith('/rest/v1/rpc/')){
    const name=u.pathname.split('/').at(-1),networkRpc=['architetti_snapshot','architetti_command','architetti_client_detail'].includes(name);
    if(networkRpc?!user:req.headers.apikey!==serverKey)return reply(res,403,{});
    const r=await fetch(cfg.postgrestUrl+u.pathname.replace('/rest/v1',''),{method:req.method,headers:{Authorization:'Bearer '+(networkRpc?user.token:service),'Content-Type':'application/json',...(networkRpc?{'Content-Profile':'hub','Accept-Profile':'hub'}:{})},body:req.method==='GET'?undefined:body});res.writeHead(r.status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(Buffer.from(await r.arrayBuffer()));return;
  }
  if(u.pathname.startsWith('/storage/v1/object/')){
    if(req.headers.apikey!==serverKey)return reply(res,403,{});
    const p=u.pathname.replace('/storage/v1/object/','');
    if(p==='move'){const v=json(),bytes=objects.get(v.sourceKey);if(!bytes)return reply(res,404,{});objects.set(v.destinationKey,bytes);objects.delete(v.sourceKey);events.push({kind:'CV_CLAIMED'});return reply(res,200,{});}
    if(p.startsWith('info/architect-cv/'))return reply(res,objects.has(p.slice(18))?200:404,{});
    if(p.startsWith('architect-cv/')&&req.method==='POST'){objects.set(p.slice(13),body);events.push({kind:'CV_STORED'});return reply(res,200,{ok:true});}
    return reply(res,404,{});
  }
  if(u.pathname.startsWith('/synthetic-crm/')){events.push({kind:'CRM_SIMULATED',path:u.pathname,hasCandidateCv:[...objects.keys()].some(k=>k.startsWith('candidates/'))});return reply(res,200,u.pathname.endsWith('/contacts/upsert')?{contact:{id:'SYNTHETIC_CV_RECRUITMENT'}}:{ok:true});}
  if(u.pathname==='/evidence'){const counts=(await db.query("select (select count(*) from patrimonial_radar_private.persons) persons,(select count(*) from patrimonial_radar_private.snapshots) reports,(select count(*) from public.patrimonial_requests) requests,(select count(*) from public.patrimonial_assignments) assignments")).rows[0];return reply(res,200,{fixture:'SYNTHETIC_ONLY',counts,events,storage:[...objects.keys()],operators:[...users.values()].map(s=>({name:s.name,id:s.user.id,operatorId:s.operatorId}))});}
  reply(res,404,{error:'not_found'});
 }catch(e){console.error('Synthetic runner request failed:',e.code??e.message);reply(res,500,{error:'fixture_failure'});}
});
server.listen(15444,'127.0.0.1',()=>console.log('5B.1 synthetic infrastructure ready: loopback 15444; no production identity or delivery'));
process.on('SIGINT',()=>{server.close();void db.end();});
