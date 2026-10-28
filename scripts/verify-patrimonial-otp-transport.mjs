import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ResendRadarEmail} from '../src/lib/patrimonial-radar-server/resend-email.ts';
import {remoteEventIntakePort} from '../src/lib/patrimonial-radar-server/event-intake.ts';
const passed=[];
const input={email:'otp.transport@example.invalid',code:'12345678',expiresInSeconds:600,challengeId:randomUUID()};
const provider=fetchImpl=>new ResendRadarEmail({key:'re_synthetic_credential_only',from:'radar@horyzon.it',replyTo:'info@horyzon.it',fetchImpl});
async function check(n,f){await f();passed.push(n);console.log('PASS '+n);}
await check('No ambient email credentials or Event intake; closed defaults',async()=>{
 assert.throws(()=>new ResendRadarEmail({key:'',from:'radar@horyzon.it',replyTo:'info@horyzon.it'}));
 assert.equal(remoteEventIntakePort({}),undefined);
 assert.equal(remoteEventIntakePort({PATRIMONIAL_V2_ENABLED:'true',PATRIMONIAL_EVENT_RADAR_CONTEXT:'protected-remote'}),undefined);
});
await check('429, network failure and 503 retry one time with identical content/idempotency',async()=>{
 for(const error of [429,503,'network']){
  const calls=[];await provider(async(url,init)=>{assert.equal(url,'https://api.resend.com/emails');calls.push(init);if(calls.length===1){if(error==='network')throw Error('synthetic private provider body');return new Response('',{status:error});}return Response.json({id:'synthetic'});}).sendCode(input);
  assert.equal(calls.length,2);assert.equal(calls[0].body,calls[1].body);assert.deepEqual(calls[0].headers,calls[1].headers);
  assert.equal(calls[0].headers['Idempotency-Key'],'radar-otp:'+input.challengeId);
 }
});
await check('Permanent rejection/suppression and exhausted throttle fail closed, errors contain no recipient/code',async()=>{
 for(const status of [400,401,403,422,429,503]){
  let n=0;await assert.rejects(provider(async()=>{n++;return new Response('12345678 otp.transport@example.invalid hard bounce',{status});}).sendCode(input),e=>e.code==='UNAVAILABLE'&&e.message==='UNAVAILABLE');
  assert.equal(n,status>=500||status===429?2:1);
 }
});
await check('Real AbortSignal timeout bounds each attempt, retry retains challenge',async()=>{
 let calls=0;const start=Date.now();
 const keepAlive=setInterval(()=>{},1000);
 try{await assert.rejects(provider(async(_url,init)=>{calls++;assert(init.signal);return new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true}));}).sendCode(input),{code:'UNAVAILABLE'});}
 finally{clearInterval(keepAlive);}
 assert.equal(calls,2);assert(Date.now()-start>=10000);assert(Date.now()-start<16000);
});
await check('No financial payload, tracking, link, HTML, marketing or extra recipient',async()=>{
 await provider(async(url,init)=>{assert.equal(url,'https://api.resend.com/emails');const body=JSON.parse(init.body);assert.deepEqual(Object.keys(body).sort(),['from','reply_to','subject','text','to']);assert.deepEqual(body.to,[input.email]);assert(!/https:|<|answers|snapshot|marketing/.test(body.text));return Response.json({id:'synthetic'});}).sendCode(input);
});
console.log(JSON.stringify({status:'PASS',groups:passed.length,passed,provider:'INTERCEPTED_ONLY_NO_EMAIL',asynchronousBounce:'NOT_OPERATIONAL_MANUAL_PILOT_PROCESS_REQUIRED',remoteWrites:0},null,2));
