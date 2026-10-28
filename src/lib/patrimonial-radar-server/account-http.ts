import {createCipheriv,createDecipheriv,createHash,randomBytes,randomUUID} from 'node:crypto';
import {accountConfig,type AccountEnv} from './account-config.ts';
import {AccountRadarRpc,accountToken,type AccountProfile} from './account-rpc.ts';
import {RadarBackendError} from './contracts.ts';import {PatrimonialRadarService} from './service.ts';
import {createPatrimonialRadarHandler} from './http.ts';import {normalizeEmail,object,RadarSecrets} from './security.ts';
import {checkAccountReferral,type AccountReferral} from './account-referral.ts';
const headers={'Cache-Control':'private, no-store','CDN-Cache-Control':'private, no-store','Vercel-CDN-Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'};
const prefix='/api/patrimonial-radar';
function readCookie(r:Request,name:string){const a=(r.headers.get('cookie')??'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(name+'='));return a.length===1?a[0].slice(name.length+1):'';}
function seal(secret:string,data:unknown){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',createHash('sha256').update('cookie-5c:'+secret).digest(),iv);return Buffer.concat([iv,c.update(JSON.stringify(data)),c.final(),c.getAuthTag()]).toString('base64url');}
function unseal<T>(secret:string,value:string):T{try{const b=Buffer.from(value,'base64url'),d=createDecipheriv('aes-256-gcm',createHash('sha256').update('cookie-5c:'+secret).digest(),b.subarray(0,12));d.setAuthTag(b.subarray(-16));return JSON.parse(Buffer.concat([d.update(b.subarray(12,-16)),d.final()]).toString('utf8'));}catch{throw new RadarBackendError('UNAUTHENTICATED');}}
async function body(r:Request){if(r.headers.get('content-type')?.split(';')[0]!=='application/json'||!r.body)throw new RadarBackendError('INVALID');const reader=r.body.getReader(),chunks:Uint8Array[]=[];let n=0;for(;;){const p=await reader.read();if(p.done)break;n+=p.value.length;if(n>65536){await reader.cancel();throw new RadarBackendError('INVALID');}chunks.push(p.value);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw new RadarBackendError('INVALID');}}
export async function handleAccountRadar(request:Request,env:AccountEnv=process.env,fetchImpl:typeof fetch=fetch):Promise<Response>{
 const reply=(v:unknown,status=200)=>Response.json(v,{status,headers});const cookies:string[]=[];
 try{
  const cfg=accountConfig(env);if(!cfg)return reply({error:'NOT_FOUND'},404);
  const u=new URL(request.url);if(u.hostname==='localhost'&&cfg.local&&request.headers.get('host')===new URL(cfg.origin).host){request=new Request(new URL(u.pathname+u.search,cfg.origin),request);}
  const url=new URL(request.url),path=url.pathname.slice(prefix.length);
  if(url.origin!==cfg.origin||url.search||!url.pathname.startsWith(prefix+'/'))throw new RadarBackendError('FORBIDDEN');
  if(request.method==='POST'&&(request.headers.get('origin')!==cfg.origin||!['same-origin','none',null].includes(request.headers.get('sec-fetch-site'))))throw new RadarBackendError('FORBIDDEN');
  // The Production opt-in opens only the approved native account routes.
  if(cfg.beta&&!((request.method==='GET'&&(/^\/(session|assessments)$/.test(path)||/^\/assessments\/[a-f0-9-]{36}(\/snapshot)?$/i.test(path)))
    ||(request.method==='POST'&&(/^\/(identity\/(request|verify)|referral|assessments|session\/revoke)$/.test(path)||/^\/assessments\/[a-f0-9-]{36}\/(answer|complete|notice)$/i.test(path)))))return reply({error:'NOT_FOUND'},404);
  const allowedEmail=(email:string)=>!cfg.beta||cfg.betaEmails.includes(email);
  const names={access:cfg.local?'pr_auth':'__Host-pr_auth',refresh:cfg.local?'pr_refresh':'__Host-pr_refresh',profile:cfg.local?'pr_profile':'__Host-pr_profile',pending:cfg.local?'pr_pending':'__Host-pr_pending',referral:cfg.local?'pr_referral':'__Host-pr_referral'};
  const cookie=(name:string,v:string,age:number)=>name+'='+v+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+age+(cfg.local?'':'; Secure');
  const finish=(r:Response)=>{for(const [k,v] of Object.entries(headers))r.headers.set(k,v);for(const c of cookies)r.headers.append('Set-Cookie',c);return r;};
  const referral=():AccountReferral|undefined=>{const raw=readCookie(request,names.referral);if(!raw)return undefined;try{const v=unseal<AccountReferral>(cfg.secret,raw);if(v.exp>Date.now()&&(v.code===null||typeof v.code==='string'&&/^[0-9a-f]{32}$/.test(v.code)))return v;}catch{}return{code:null,exp:Date.now()+600000};};
  if(request.method==='POST'&&path==='/referral'){
   if(request.headers.get('x-patrimonial-csrf')!=='referral-context')throw new RadarBackendError('FORBIDDEN');
   const b=object(await body(request),['code']);if(b.code!==null&&(typeof b.code!=='string'||b.code.length>128))throw new RadarBackendError('INVALID');
   const code=typeof b.code==='string'&&/^[0-9a-f]{32}$/.test(b.code)?b.code:null;
   const state=await checkAccountReferral(cfg,code,fetchImpl);
   cookies.push(cookie(names.referral,seal(cfg.secret,{code,exp:Date.now()+28800000}),28800));
   return finish(reply({state}));
  }
  const auth=async(path:string,data?:unknown,token?:string)=>{const r=await fetchImpl(cfg.url+'/auth/v1/'+path,{method:data===undefined?'GET':'POST',headers:{apikey:cfg.key,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});let value;try{value=await r.json();}catch{value={};}return{ok:r.ok,value};};
  if(request.method==='POST'&&path==='/identity/request'){
   if(cfg.beta&&request.headers.get('x-patrimonial-csrf')!=='request-code')throw new RadarBackendError('FORBIDDEN');
   const b=object(await body(request),['email','firstName','lastName']);const email=normalizeEmail(b.email);
   if(!allowedEmail(email))throw new RadarBackendError('FORBIDDEN');
   for(const k of ['firstName','lastName'])if(typeof b[k]!=='string'||!b[k].trim()||b[k].length>100||/[\u0000-\u001f]/.test(b[k]))throw new RadarBackendError('INVALID');
   const pending={email,firstName:(b.firstName as string).trim(),lastName:(b.lastName as string).trim(),id:randomUUID(),binding:randomBytes(32).toString('base64url'),exp:Date.now()+600000,referral:referral()};
   // Native Supabase OTP delivers the email; no custom identity/password service.
   const delivery=await auth('otp',{email,create_user:true});
   if(!delivery.ok)throw new RadarBackendError('UNAVAILABLE');
   cookies.push(cookie(names.pending,seal(cfg.secret,pending),600));
   return finish(reply({challengeId:pending.id,csrf:new RadarSecrets(cfg.secret).csrf(pending.binding),message:'Se la richiesta può essere elaborata, riceverai un codice temporaneo.'}));
  }
  if(request.method==='POST'&&path==='/identity/verify'){
   const p=unseal<AccountProfile&{id:string;binding:string;exp:number;referral?:AccountReferral}>(cfg.secret,readCookie(request,names.pending));
   const b=object(await body(request),['challengeId','code']);
   if(!allowedEmail(p.email))throw new RadarBackendError('FORBIDDEN');
   if(p.exp<Date.now()||b.challengeId!==p.id||!new RadarSecrets(cfg.secret).checkCsrf(p.binding,request.headers.get('x-patrimonial-csrf'))||typeof b.code!=='string'||!/^\d{6,8}$/.test(b.code))throw new RadarBackendError('UNAUTHENTICATED');
   const result=await auth('verify',{email:p.email,token:b.code,type:'email'});
   if(!result.ok||!result.value.access_token||!result.value.refresh_token)throw new RadarBackendError('UNAUTHENTICATED');
   cookies.push(cookie(names.access,result.value.access_token,3600),cookie(names.refresh,result.value.refresh_token,2592000),cookie(names.profile,seal(cfg.secret,{firstName:p.firstName,lastName:p.lastName,email:p.email}),2592000),cookie(names.pending,'',0));
   if(p.referral)cookies.push(cookie(names.referral,seal(cfg.secret,p.referral),Math.max(0,Math.floor((p.referral.exp-Date.now())/1000))));
   // Re-run through the same Auth-user + SQL session fence before returning any identity.
   const h=new Headers(request.headers);h.set('cookie',names.access+'='+result.value.access_token+'; '+names.refresh+'='+result.value.refresh_token+'; '+names.profile+'='+seal(cfg.secret,{firstName:p.firstName,lastName:p.lastName,email:p.email})+(p.referral?'; '+names.referral+'='+seal(cfg.secret,p.referral):''));
   const checked=await handleAccountRadar(new Request(cfg.origin+prefix+'/session',{headers:h}),env,fetchImpl);
   if(!checked.ok)return checked;return finish(checked);
  }
  let token=readCookie(request,names.access);const refresh=readCookie(request,names.refresh);
  let identity=token?await auth('user',undefined,token):{ok:false,value:{}};
  if(!identity.ok&&refresh){const next=await auth('token?grant_type=refresh_token',{refresh_token:refresh});if(next.ok&&next.value.access_token){token=next.value.access_token;cookies.push(cookie(names.access,token,3600),cookie(names.refresh,next.value.refresh_token,2592000));identity=await auth('user',undefined,token);}}
  if(!identity.ok||!identity.value.id||!identity.value.email_confirmed_at||identity.value.is_anonymous)throw new RadarBackendError('UNAUTHENTICATED');
  // Check the current Auth user, never user_metadata or the email in the form.
  if(!allowedEmail(normalizeEmail(identity.value.email)))throw new RadarBackendError('FORBIDDEN');
  const profile=unseal<AccountProfile>(cfg.secret,readCookie(request,names.profile));
  if(normalizeEmail(identity.value.email)!==profile.email)throw new RadarBackendError('UNAUTHENTICATED');
  let claims;try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());}catch{throw new RadarBackendError('UNAUTHENTICATED');}
  if(claims.sub!==identity.value.id||typeof claims.session_id!=='string')throw new RadarBackendError('UNAUTHENTICATED');
  const opaque=accountToken(cfg.secret,identity.value.id,claims.session_id);
  const rpc=new AccountRadarRpc({url:cfg.url,key:cfg.key,secret:cfg.secret,token,uid:identity.value.id,sid:claims.session_id,profile,referralCode:referral()?.code,fetchImpl});
  const service=new PatrimonialRadarService(rpc,{kind:'SIMULATED',async sendCode(){throw new RadarBackendError('FORBIDDEN');}},cfg.secret);
  const h=new Headers(request.headers);h.set('cookie',(cfg.local?'pr_session':'__Host-pr_session')+'='+opaque);
  const internal=new Request(request,{headers:h});
  const response=await createPatrimonialRadarHandler(service,{origin:cfg.origin,production:!cfg.local,enabled:true})(internal);
  if(path==='/session/revoke'&&response.ok){await auth('logout?scope=local',{},token);for(const n of Object.values(names))cookies.push(cookie(n,'',0));}
  // Never emit the internal opaque-session cookie. Auth cookies are HttpOnly.
  response.headers.delete('Set-Cookie');return finish(response);
 }catch(e){const safe=e instanceof RadarBackendError?e:new RadarBackendError('UNAVAILABLE');return reply({error:safe.code},safe.status);}
}
