import assert from 'node:assert/strict';
import { validatePilotLead, validatePatrimonialV2 } from '../src/lib/public-leads/patrimonial-funnels.ts';
import { validateArchitectEventReferral } from '../src/lib/public-leads/patrimonial-referral-preflight.ts';
import { handlePublicLead } from '../src/lib/public-leads/handler.ts';
import { pilotForms } from '../src/content/patrimonial-funnels.ts';
import { PATRIMONIAL_V2 } from '../src/lib/public-leads/patrimonial-contract.ts';

const code = 'b'.repeat(32);
const env = {
  NODE_ENV: 'test',
  SUPABASE_URL: 'https://fixture.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture-private-secret',
  HIGHLEVEL_PRIVATE_TOKEN: 'fixture-token',
  HIGHLEVEL_LOCATION_ID: 'fixture-location',
  HORYZON_HUB_EVENT_INGRESS_ENABLED: 'true',
};
const base = {
  mode: 'patrimonial-event', sourcePath: pilotForms['patrimonial-event'].path,
  firstName: 'Persona', lastName: 'Test',
  email: 'person@example.invalid', phone: '', province: 'Milano',
  profile: 'Privato', message: '', consent: true, marketingConsent: false,
  website: '', utm: {}, referralCode: code,
};
assert.equal(validatePilotLead(base)?.referralCode, code);
for (const referralCode of ['','A'.repeat(32),'none',null,{},code+'x']) {
  assert.equal(validatePilotLead({ ...base, referralCode }), null, 'invalid referral must be rejected');
}
assert.equal(validatePilotLead({ ...base, mode: 'architect-path', sourcePath: pilotForms['architect-path'].path, experience: '', goal: '', availability: '' }), null);
assert.equal(validatePatrimonialV2({ ...base, contractVersion: PATRIMONIAL_V2 }),null);

let count = 0;
const records = [];
const fake = async (url, init) => {
  const address = new URL(url);
  const body = JSON.parse(init.body);
  count++;
  if (address.pathname === '/rest/v1/rpc/architetti_referral_validate') {
    assert.equal(body.p_code, code);
    return Response.json({ valid: true });
  }
  if (address.pathname === '/contacts/upsert')
    return Response.json({ contact: { id: 'fixture-contact' } });
  if (address.pathname.endsWith('/tags') || address.pathname.endsWith('/notes'))
    return Response.json({});
  if (address.pathname === '/rest/v1/rpc/architetti_event_ingest') {
    assert.equal(body.p_event.referralCode, code);
    records.push(body.p_event);
    return Response.json({
      contactId: '123e4567-e89b-42d3-a456-426614174000',
      registrationId: '123e4567-e89b-42d3-a456-426614174001',
      state: 'PENDING_EDITION',attributionStatus: 'ASSIGNED_NEW',
    });
  }
  throw new Error('Unexpected endpoint ' + address.pathname);
};
await validateArchitectEventReferral({ code, env, fetchImpl: fake });
assert.equal(count,1);
await assert.rejects(
  () => validateArchitectEventReferral({ code, env: {...env, HORYZON_HUB_EVENT_INGRESS_ENABLED:'false'}, fetchImpl: fake }),
  /REFERRAL_VALIDATION_UNAVAILABLE/
);
assert.equal(count,1);
await assert.rejects(
  () => validateArchitectEventReferral({ code, env, fetchImpl: async()=>Response.json({valid:false}) }),
  /REFERRAL_VALIDATION_UNAVAILABLE/
);
const req = data=>new Request('https://horyzon.it/api/public-leads', {
  method:'POST', headers:{origin:'https://horyzon.it','content-type':'application/json'},body:JSON.stringify(data),
});
const received=await handlePublicLead(req(base),{env,fetchImpl:fake});
assert.equal(received.status,200);
assert.equal(records.length,1);
assert.equal(count,6,'preflight then 3 CRM operations then one Hub save, plus direct preflight');
assert.equal(records[0].referralCode,code);
const countAtSuccess=count;
const bad=await handlePublicLead(req({...base,referralCode:'bogus'}),{env,fetchImpl:fake});
assert.equal(bad.status,400);
assert.equal(count,countAtSuccess);
const unavailable=await handlePublicLead(req(base),{
  env:{...env,HORYZON_HUB_EVENT_INGRESS_ENABLED:'false'},fetchImpl:fake,
});
assert.equal(unavailable.status,503,'referral cannot be silently discarded if routing is disabled');
assert.equal(count,countAtSuccess);
const invalidUpstream=await handlePublicLead(req(base),{
  env,fetchImpl:async(url,init)=>{
    if (new URL(url).pathname === '/rest/v1/rpc/architetti_referral_validate')
      return Response.json({valid:false});
    throw new Error('CRM MUST NOT BE CALLED');
  },
});
assert.equal(invalidUpstream.status,503);
const closed=await handlePublicLead(req(base),{
  env:{...env,NODE_ENV:'production',PATRIMONIAL_EVENT_SIGNUP_ENABLED:'false'},
  fetchImpl:async()=>{throw new Error('NO CALLS');},
});
assert.equal(closed.status,503);
console.log('Architect referral: event-only validation, protected preflight, CRM-first Hub attribution, closed gates PASS');
