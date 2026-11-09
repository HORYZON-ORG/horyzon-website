import {createHmac,timingSafeEqual} from 'node:crypto';
import {kitPaths} from './model.ts';
export const TEMPO_BASE='/benessere-digitale/dai-valore-al-tuo-tempo';
export type Env=Record<string,string|undefined>;
function key(env:Env){const k=env.TEMPO_ACCESS_SECRET||env.CRON_SECRET;if(!k||k.length<20)throw Error('TEMPO_ACCESS_NOT_CONFIGURED');return k;}
export function accessToken(category:string,requestId:string,env:Env=process.env,now=Date.now()){
 if(!kitPaths[category]||!/^[a-f0-9-]{36}$/.test(requestId))throw Error('INVALID_ACCESS');
 const body=['v1',category,requestId,String(Math.floor(now/1000)+7*86400)].join('.');
 return body+'.'+createHmac('sha256',key(env)).update('horyzon-tempo-access:'+body).digest('base64url');
}
export function verifyAccess(token:string,category:string,env:Env=process.env,now=Date.now()){
 if(token.length>240||!kitPaths[category])return false;const p=token.split('.');
 if(p.length!==5||p[0]!=='v1'||p[1]!==category||!/^[a-f0-9-]{36}$/.test(p[2])||!/^\d{10}$/.test(p[3])||Number(p[3])<=now/1000||Number(p[3])>now/1000+7*86400+60)return false;
 try{const sig=createHmac('sha256',key(env)).update('horyzon-tempo-access:'+p.slice(0,4).join('.')).digest('base64url');return Buffer.byteLength(sig)===Buffer.byteLength(p[4])&&timingSafeEqual(Buffer.from(sig),Buffer.from(p[4]));}catch{return false;}
}
export function kitLink(category:string,requestId:string,env:Env=process.env,now=Date.now()){return 'https://horyzon.it'+TEMPO_BASE+'/'+kitPaths[category]+'?access='+accessToken(category,requestId,env,now);}
export function serveTempoKit(request:Request,category:string,html:string,env:Env=process.env){
 const url=new URL(request.url),token=url.searchParams.get('access'),cookie=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('horyzon-tempo-'+category+'='))?.split('=').slice(1).join('=');
 const headers:Record<string,string>={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'};
 if(token&&verifyAccess(token,category,env)){url.search='';headers.Location=url.toString();headers['Set-Cookie']='horyzon-tempo-'+category+'='+token+'; HttpOnly; Secure; SameSite=Lax; Path='+TEMPO_BASE+'/; Max-Age=604800';return new Response(null,{status:303,headers});}
 if(cookie&&verifyAccess(cookie,category,env))return new Response(html,{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
 return new Response(null,{status:303,headers:{...headers,Location:TEMPO_BASE+'?kit='+category+'#tempo-offers'}});
}
