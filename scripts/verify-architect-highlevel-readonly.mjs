import assert from 'node:assert/strict';
import { checkArchitectHighLevelReadOnly as verify } from './architect-highlevel-readonly-preflight.mjs';

const env={
  VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'feat/patrimonial-pilot-funnels',
  PATRIMONIAL_ARCHITECT_HIGHLEVEL_READONLY_PREFLIGHT:'true',
  HIGHLEVEL_PRIVATE_TOKEN:'synthetic-only',HIGHLEVEL_LOCATION_ID:'exampleLocation123',
};
let requests=0;
const mock=async (url,init)=>{
  requests++;
  assert.equal(url,'https://services.leadconnectorhq.com/locations/exampleLocation123');
  assert.equal(init.method,'GET');
  assert.equal(init.redirect,'error');
  assert.equal(init.headers.Version,'v3');
  assert.equal(init.headers.Authorization,'Bearer synthetic-only');
  return Response.json({location:{id:'exampleLocation123',name:'SYNTHETIC PRIVATE ACCOUNT'}});
};
assert.deepEqual(await verify({},async()=>{throw new Error('should not call provider')}),{skipped:true});
assert.deepEqual(await verify(env,mock),{skipped:false,location:'VERIFIED',scope:'locations.readonly'});
assert.equal(requests,1);
await assert.rejects(()=>verify({...env,HIGHLEVEL_PRIVATE_TOKEN:''},mock),/CONFIG_MISSING/);
await assert.rejects(()=>verify(env,async()=>new Response('sensitive provider body',{status:403})),/ACCESS_DENIED/);
await assert.rejects(()=>verify(env,async()=>Response.json({location:{id:'differentLocation'}})),/LOCATION_MISMATCH/);
await assert.rejects(()=>verify(env,async()=>new Response('{}',{status:500})),/UNAVAILABLE/);
console.log('PASS: HighLevel probe uses only GET, validates location ID and fails closed without printing secrets');