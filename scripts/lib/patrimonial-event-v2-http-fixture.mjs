import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {createHmac,randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
/** Synthetic fixture: never loaded by application runtime. No outbound provider. */
export async function startEventV2HttpFixture({db,cfg,secret,evidence}) {
 assert(fs.existsSync(resolve('.next/BUILD_ID')), 'Complete npm run build before the HTTP rehearsal');
 assert.equal(cfg.databaseUrl,'postgres://postgres@127.0.0.1:15449/radar_5d_test');
 assert.equal(cfg.postgrestUrl,'http://127.0.0.1:15450');
 const origin='http://127.0.0.1:15451',gatewayOrigin='http://127.0.0.1:15452';
 const jwt=claims=>{const p=[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,...claims})).toString('base64url')].join('.');return p+'.'+createHmac('sha256',cfg.secret).update(p).digest('base64url');};
 const counters={auth:0,postgrest:0,highlevel:0,emails:0,deniedPaths:0},pending=new Set(),refreshes=new Map(),rpcNames={};
 const gateway=http.createServer(async(req,res)=>{
  const reply=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
  try{
   const url=new URL(req.url,gatewayOrigin),chunks=[];let size=0;for await(const b of req){size+=b.length;if(size>300000)return reply(413,{});chunks.push(b);}const raw=Buffer.concat(chunks),b=raw.length?JSON.parse(raw):{};
   if(url.pathname.startsWith('/rest/v1/rpc/')){
    counters.postgrest++;const name=url.pathname.split('/').at(-1);rpcNames[name]=(rpcNames[name]??0)+1;
    const result=await fetch(cfg.postgrestUrl+url.pathname.replace('/rest/v1',''),{method:'POST',headers:{'Content-Type':'application/json','Content-Profile':req.headers['content-profile']??'hub','Accept-Profile':req.headers['accept-profile']??'hub',...(req.headers.authorization?{Authorization:req.headers.authorization}:{})},body:raw});
    res.writeHead(result.status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(await result.text());return;
   }
   counters.auth++;
   if(url.pathname==='/auth/v1/otp'){if(typeof b.email!=='string'||!b.email.endsWith('.invalid'))return reply(400,{});pending.add(b.email);return reply(200,{});}
   if(url.pathname==='/auth/v1/verify'){
    if(!pending.has(b.email)||b.token!=='123456')return reply(401,{});pending.delete(b.email);
    let u=(await db.query('select id from auth.users where email=$1',[b.email])).rows[0];
    if(!u){u={id:randomUUID()};await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[u.id,b.email]);}
    const sid=randomUUID();await db.query("insert into auth.sessions(id,user_id,not_after) values($1,$2,now()+interval '1 hour')",[sid,u.id]);
    const refresh=randomUUID();refreshes.set(refresh,{uid:u.id,sid});return reply(200,{access_token:jwt({sub:u.id,session_id:sid}),refresh_token:refresh});
   }
   if(url.pathname==='/auth/v1/user'){
    const token=(req.headers.authorization??'').replace('Bearer ',''),parts=token.split('.');
    if(parts.length!==3||createHmac('sha256',cfg.secret).update(parts[0]+'.'+parts[1]).digest('base64url')!==parts[2])return reply(401,{});
    const c=JSON.parse(Buffer.from(parts[1],'base64url'));if(c.exp<=Date.now()/1000)return reply(401,{});
    const u=(await db.query('select u.id,u.email,u.email_confirmed_at,u.is_anonymous from auth.users u join auth.sessions s on s.user_id=u.id where u.id=$1 and s.id=$2 and s.not_after>now() and u.deleted_at is null',[c.sub,c.session_id])).rows[0];return reply(u?200:401,u??{});
   }
   if(url.pathname==='/auth/v1/token'){const c=refreshes.get(b.refresh_token);return c?reply(200,{access_token:jwt({sub:c.uid,session_id:c.sid}),refresh_token:b.refresh_token}):reply(401,{});}
   if(url.pathname==='/auth/v1/logout')return reply(200,{});
   counters.deniedPaths++;return reply(404,{});
  }catch{return reply(503,{});}
 });
 await new Promise((ok,no)=>gateway.listen(15452,'127.0.0.1',ok).once('error',no));
 // Deliberate environment allowlist: no inherited provider keys or production flags.
 const env=Object.fromEntries(['PATH','SystemRoot','USERPROFILE','TEMP','TMP','APPDATA','LOCALAPPDATA'].map(k=>[k,process.env[k]]).filter(([,v])=>v));
 Object.assign(env,{NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',PATRIMONIAL_V2_ENABLED:'true',PATRIMONIAL_DURABLE_STORE_READY:'true',HORYZON_HUB_EVENT_INGRESS_ENABLED:'true',SUPABASE_URL:gatewayOrigin,SUPABASE_SERVICE_ROLE_KEY:jwt({role:'service_role'}),
 PATRIMONIAL_RADAR_ACCOUNT_ENABLED:'true',PATRIMONIAL_RADAR_ACCOUNT_CONTEXT:'local-test',PATRIMONIAL_RADAR_ACCOUNT_ORIGIN:origin,PATRIMONIAL_RADAR_ACCOUNT_SUPABASE_URL:gatewayOrigin,PATRIMONIAL_RADAR_PUBLISHABLE_KEY:'sb_publishable_synthetic',PATRIMONIAL_RADAR_IDENTITY_SECRET:secret});
 const log=fs.openSync(resolve(evidence,'http-next.log'),'a');
 const child=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','15451'],{cwd:process.cwd(),env,windowsHide:true,stdio:['ignore',log,log]});
 const close=async()=>{if(child.exitCode===null){child.kill();await new Promise(ok=>child.once('exit',ok));}gateway.closeAllConnections();await new Promise(ok=>gateway.close(ok));fs.closeSync(log);};
 let ready=false;
 for(let i=0;i<120;i++){try{const r=await fetch(origin+'/api/patrimonial-radar/session');if(r.status===401){ready=true;break;}}catch{}if(child.exitCode!==null)break;await new Promise(ok=>setTimeout(ok,250));}
 if(!ready){await close();throw Error('Actual Next HTTP fixture unavailable');}
 return{origin,jwt,counters,rpcNames,close};
}
