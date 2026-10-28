// Narrow release-fence checks only. Auth/RPC transport is synthetic; no network.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {accountConfig,ACCOUNT_WEBSITE_PROJECT,ACCOUNT_WEBSITE_TEAM} from '../src/lib/patrimonial-radar-server/account-config.ts';
import {handleAccountRadar} from '../src/lib/patrimonial-radar-server/account-http.ts';
import {patrimonialRadarMode} from '../src/lib/patrimonial-radar-ui/public-mode.ts';
import {localEventRadarContract} from '../src/lib/patrimonial-radar-server/event-gate.ts';
const origin='https://horyzon.it',email='tester@company.invalid';
const env={VERCEL:'1',VERCEL_ENV:'production',VERCEL_TARGET_ENV:'production',VERCEL_PROJECT_ID:ACCOUNT_WEBSITE_PROJECT,VERCEL_ORG_ID:ACCOUNT_WEBSITE_TEAM,VERCEL_DEPLOYMENT_ID:'dpl_synthetic_beta',
 PATRIMONIAL_RADAR_ACCOUNT_ENABLED:'true',PATRIMONIAL_RADAR_BETA_ENABLED:'true',PATRIMONIAL_RADAR_ACCOUNT_CONTEXT:'website-beta',PATRIMONIAL_RADAR_ACCOUNT_ORIGIN:origin,
 PATRIMONIAL_RADAR_BETA_EMAILS:email,PATRIMONIAL_RADAR_PUBLISHABLE_KEY:'sb_publishable_synthetic',PATRIMONIAL_RADAR_IDENTITY_SECRET:'SYNTHETIC_ONLY_BETA_RELEASE_TEST_000000000000000000'};
const checks=[],check=async(name,fn)=>{await fn();checks.push({name,status:'PASS'});console.log('PASS '+name);};
const cookies=new Map(),uid=randomUUID(),sid=randomUUID(),personId=randomUUID(),access='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:uid,session_id:sid})).toString('base64url')+'.synthetic';
let currentEmail=email,confirmed=true,csrf='request-code',calls=0,rpc=0,refreshes=0,accessValid=true,otpAvailable=true;
const transport=async(url,init)=>{
 calls++;assert(url.startsWith('https://pmkyeqrfkunypfkbjnyg.supabase.co/'));
 assert.equal(init.cache,'no-store');assert.equal(init.redirect,'error');
 if(url.endsWith('/auth/v1/otp'))return otpAvailable?Response.json({}):Response.json({error:'SYNTHETIC_OTP_RATE_LIMIT'},{status:429});
 if(url.endsWith('/auth/v1/verify'))return Response.json({access_token:access,refresh_token:'synthetic-refresh'});
 if(url.endsWith('/auth/v1/user'))return accessValid?Response.json({id:uid,email:currentEmail,email_confirmed_at:confirmed?'2026-10-27T00:00:00Z':null,is_anonymous:false}):Response.json({}, {status:401});
 if(url.endsWith('/auth/v1/token?grant_type=refresh_token')){refreshes++;accessValid=true;return Response.json({access_token:access,refresh_token:'synthetic-refresh-next'});}
 if(url.endsWith('/auth/v1/logout?scope=local'))return Response.json({});
 assert(url.endsWith('/rest/v1/rpc/patrimonial_radar_account_command'));rpc++;
 const {p_envelope,p_mac}=JSON.parse(init.body),e=JSON.parse(p_envelope);assert.match(p_mac,/^[a-f0-9]{64}$/);
 assert.equal(e.subject,uid);assert.equal(e.sessionId,sid);
 return Response.json({ok:true,data:e.command.method==='history'?[]:{personId,expiresAt:'2026-10-28T00:00:00Z'}});
};
async function request(path,body,options={}){
 const headers={Origin:origin,'Content-Type':'application/json','X-Patrimonial-CSRF':csrf,Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...options.headers};
 const r=await handleAccountRadar(new Request((options.origin??origin)+'/api/patrimonial-radar'+path,{method:body===undefined?'GET':'POST',headers,...(body===undefined?{}:{body:JSON.stringify(body)})}),options.env??env,transport);
 for(const raw of r.headers.getSetCookie()){const pair=raw.split(';')[0],i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1));}
 return r;
}
await check('Production default OFF; only exact Website/team/context/origin may opt in',()=>{
 assert.equal(accountConfig({}),null);
 for(const patch of [{PATRIMONIAL_RADAR_BETA_ENABLED:undefined},{PATRIMONIAL_RADAR_BETA_ENABLED:'false'},{VERCEL_PROJECT_ID:'prj_other'},{VERCEL_ORG_ID:'team_other'},{VERCEL_DEPLOYMENT_ID:undefined},{PATRIMONIAL_RADAR_ACCOUNT_CONTEXT:'local-test'},{PATRIMONIAL_RADAR_ACCOUNT_ORIGIN:'https://www.horyzon.it'},{VERCEL_ENV:'preview'},{VERCEL_TARGET_ENV:'preview'}])assert.equal(accountConfig({...env,...patch}),null);
 assert.equal(accountConfig(env).beta,true);assert.equal(accountConfig(env).origin,origin);assert.equal(patrimonialRadarMode(env),'VERIFIED_PERSISTENT');
 assert.equal(accountConfig({...env,VERCEL_ORG_ID:undefined}).beta,true);
 for(const list of ['',email+','+email,'*@horyzon.it',Array(21).fill(email).join(',')])assert.throws(()=>accountConfig({...env,PATRIMONIAL_RADAR_BETA_EMAILS:list}));
});
await check('non-allowlisted email, wrong Origin, alias and CSRF deny before Auth transport',async()=>{
 const b={email,firstName:'Tester',lastName:'Inventato'},before=calls;
 assert.equal((await request('/identity/request',{...b,email:'other@company.invalid'})).status,403);
 for(const headers of [{Origin:'https://other.invalid'},{Origin:''},{'X-Patrimonial-CSRF':''},{'Sec-Fetch-Site':'cross-site'}])assert.equal((await request('/identity/request',b,{headers})).status,403);
 assert.equal((await request('/identity/request',b,{origin:'https://alias.vercel.app'})).status,403);
 assert.equal(calls,before);
});
await check('failed Supabase OTP delivery does not create a pending challenge or pretend success',async()=>{
 otpAvailable=false;const before=calls;
 const response=await request('/identity/request',{email,firstName:'Tester',lastName:'Inventato'});
 otpAvailable=true;
 assert.equal(response.status,503);assert.equal(response.headers.getSetCookie().length,0);assert.equal(calls,before+1);
});
await check('allowed OTP and verified session keep Secure/HttpOnly/Strict cookies and HMAC RPC',async()=>{
 const r=await request('/identity/request',{email,firstName:'Tester',lastName:'Inventato'});assert.equal(r.status,200);
 for(const cookie of r.headers.getSetCookie())for(const flag of ['__Host-pr_','Secure','HttpOnly','SameSite=Strict'])assert(cookie.includes(flag));
 const c=await r.json();csrf=c.csrf;
 const v=await request('/identity/verify',{challengeId:c.challengeId,code:'123456'});assert.equal(v.status,200);
 const data=await v.json();csrf=data.csrf;assert.equal(data.personId,personId);assert.equal(rpc,1);
});
await check('current verified Auth email is rechecked; unconfirmed and removed users denied',async()=>{
 let before=rpc;confirmed=false;assert.equal((await request('/session')).status,401);confirmed=true;
 currentEmail='intruder@company.invalid';assert.equal((await request('/session')).status,403);currentEmail=email;
 assert.equal((await request('/session',undefined,{env:{...env,PATRIMONIAL_RADAR_BETA_EMAILS:'another@company.invalid'}})).status,403);assert.equal(rpc,before);
});
await check('refresh preserved; private responses explicitly forbid browser and CDN caches',async()=>{
 accessValid=false;const r=await request('/assessments');assert.equal(r.status,200);assert.equal(refreshes,1);assert.deepEqual(await r.json(),[]);
 for(const h of ['cache-control','cdn-cache-control','vercel-cdn-cache-control'])assert(r.headers.get(h).includes('no-store'));
 assert(r.headers.get('x-robots-tag').includes('noindex'));
});
await check('beta opens no experimental Event/Advisor routes and never activates Event landing',async()=>{
 const before=calls;for(const path of ['/event/propose','/advisor','/admin'])assert.equal((await request(path,{})).status,404);assert.equal(calls,before);
 assert.equal(localEventRadarContract({...env,PATRIMONIAL_V2_ENABLED:'true',HORYZON_HUB_EVENT_INGRESS_ENABLED:'true'}),undefined);
});
await check('kill flag closes account API without deleting or touching persisted data',async()=>{
 const before=calls;assert.equal((await request('/assessments',undefined,{env:{...env,PATRIMONIAL_RADAR_BETA_ENABLED:'false'}})).status,404);assert.equal(calls,before);
 assert.equal((await request('/session/revoke',{allDevices:false})).status,200);
});
await check('noindex, isolated root and scoped Proxy; public navigation sources preserved',()=>{
 assert(readFileSync('src/app/radar-patrimoniale/page.tsx','utf8').includes('index: false'));
 assert(readFileSync('src/app/radar-patrimoniale/layout.tsx','utf8').includes('isolated={anonymous || identified}'));
 const sitemap=readFileSync('src/app/sitemap.ts','utf8');assert(sitemap.includes("'radar-patrimoniale'"));
 const proxy=readFileSync('src/proxy.ts','utf8');assert(proxy.includes('request.nextUrl.origin!==account.origin'));assert(proxy.includes("if(request.nextUrl.pathname==='/radar-patrimoniale')"));
});
const result={scope:'LOCAL_RELEASE_FENCES_SYNTHETIC_TRANSPORT_NO_NETWORK',checks,realOtp:'NOT_RUN',remoteWrites:0};
const out=process.argv.find(x=>x.startsWith('--output='))?.slice(9);if(out)writeFileSync(out,JSON.stringify(result,null,2)+'\n');
