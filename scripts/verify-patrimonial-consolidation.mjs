import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localEventRadarContract} from '../src/lib/patrimonial-radar-server/event-gate.ts';
import {PATRIMONIAL_V2} from '../src/lib/public-leads/patrimonial-contract.ts';
import {radarApi} from '../src/lib/patrimonial-radar-ui/api.ts';
const env={PATRIMONIAL_RADAR_BACKEND_ENABLED:'true',PATRIMONIAL_RADAR_BACKEND_CONTEXT:'local-test',PATRIMONIAL_RADAR_FOUNDATION_CONTEXT:'local-test',PATRIMONIAL_EVENT_RADAR_CONTEXT:'local-test',PATRIMONIAL_V2_ENABLED:'true'};
assert.equal(localEventRadarContract(env),PATRIMONIAL_V2);
for(const key of Object.keys(env))assert.equal(localEventRadarContract({...env,[key]:undefined}),undefined);
for(const extra of [{VERCEL:'1'},{VERCEL_ENV:'production'},{PATRIMONIAL_EVENT_RADAR_CONTEXT:'production'}])assert.equal(localEventRadarContract({...env,...extra}),undefined);
assert.equal(localEventRadarContract({}),undefined);
const fetchOriginal=globalThis.fetch,calls=[];
globalThis.fetch=async(url,init)=>{calls.push({url,init});return Response.json({ok:true});};
try{
 for(const p of ['/event/propose','/event/confirm','/event/link-assessment','/assessments/12345678-1234-4000-8000-123456789abc/notice'])await radarApi(p,{synthetic:true},'synthetic-csrf');
 assert.equal(calls.length,4);
 for(const c of calls){assert(c.url.startsWith('/api/patrimonial-radar/'));assert.equal(c.init.method,'POST');assert.equal(c.init.credentials,'same-origin');assert.equal(c.init.cache,'no-store');assert.equal(c.init.headers['X-Patrimonial-CSRF'],'synthetic-csrf');}
 for(const p of ['/event/merge','/event/confirm?email=a@example.invalid','https://remote.invalid','/../event/confirm','/assessments/x/notice','/event/report'])await assert.rejects(radarApi(p,{}),{code:'INVALID'});
 assert.equal(calls.length,4);
}finally{globalThis.fetch=fetchOriginal;}
const form=readFileSync('src/components/patrimonial-lead-form.tsx','utf8');
assert(form.includes("mode === 'patrimonial-event' && typeof result.radarNextStep"));
assert(form.includes('acceptReceipt(response.status, result)'));
assert(form.includes('router.push(`${form.path}/grazie#radar='));
const receipt=readFileSync('src/components/patrimonial-event-radar-receipt.tsx','utf8');
assert(receipt.includes('replaceState')&&!/sessionStorage|localStorage|fetch\(/.test(receipt));
console.log('PASS 5B.1: default-off server gate and production refusal; real client API admits exact foundation routes with CSRF, rejects unapproved routes; canonical Event-only receipt and memory-only continuation.');
