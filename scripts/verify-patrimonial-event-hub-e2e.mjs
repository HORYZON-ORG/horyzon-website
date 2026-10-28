// End-to-end CONTRACT simulation only: intercepts ALL outgoing HTTP requests.
// No HighLevel contacts, Supabase rows, messages, or actual bookings can be created.
import assert from 'node:assert/strict';
import { handlePublicLead } from '../src/lib/public-leads/handler.ts';
import { pilotForms } from '../src/content/patrimonial-funnels.ts';
import { PATRIMONIAL_V2 } from '../src/lib/public-leads/patrimonial-contract.ts';

const realFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('NO_EXTERNAL_REQUESTS'); };
const LOCATION = 'synthetic-horyzon-location';
const HIGHLEVEL = 'synthetic-highlevel-contact';
const CONTACT_ID = '123e4567-e89b-42d3-a456-426614174000';
const env = {
  NODE_ENV: 'test',
  HIGHLEVEL_PRIVATE_TOKEN: 'synthetic-highlevel-token',
  HIGHLEVEL_LOCATION_ID: LOCATION,
  SUPABASE_URL: 'https://fixture.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-secret',
  HORYZON_HUB_EVENT_INGRESS_ENABLED: 'true',
};
const mkLead = (change={}) => ({
  mode: 'patrimonial-event',
  sourcePath: pilotForms['patrimonial-event'].path,
  firstName: 'Persona',lastName:'Sintetica',
  email:'synthetic@example.invalid',phone:'333 555 2222',province:'Milano',
  profile:'Privato',message:'Interessato al webinar',consent:true,
  marketingConsent:false,website:'',
  utm:{utm_source:'fixture',utm_campaign:'preview'},
  qualification: {
    schemaVersion:1,audienceProfile:'Lavoratore dipendente',sceneId:'fermi',
    consultationRequested:true,
    instruments:[
      {instrumentId:'oro',knowledgeLevel:'Ne ho sentito parlare'},
      {instrumentId:'etf',knowledgeLevel:'So come funziona'},
    ],
  },
  ...change,
});
const request = (data,origin='https://horyzon.it') =>
  new Request('https://horyzon.it/api/public-leads',{
    method:'POST',headers:{origin,'content-type':'application/json'},
    body:JSON.stringify(data),
  });
const events = new Map();
const calls=[];
const fetchImpl = async (url,init) => {
  const parsed = new URL(url);
  const body = JSON.parse(init.body||'{}');
  calls.push({pathname:parsed.pathname,body});
  if (parsed.hostname === 'services.leadconnectorhq.com') {
    if (parsed.pathname === '/contacts/upsert') {
      assert.equal(body.email,'synthetic@example.invalid');
      return Response.json({contact:{id:HIGHLEVEL}});
    }
    if (parsed.pathname.endsWith('/tags') || parsed.pathname.endsWith('/notes'))
      return Response.json({});
    throw new Error('Unexpected HighLevel operation '+parsed.pathname);
  }
  if (parsed.hostname === 'fixture.supabase.co' &&
      parsed.pathname === '/rest/v1/rpc/architetti_event_ingest') {
    const lead = body.p_event;
    assert.equal(lead.locationId,LOCATION);
    assert.equal(lead.externalContactId,HIGHLEVEL);
    assert.equal(lead.sourcePath,'/evento/quello-che-le-banche-non-dicono');
    assert.equal(lead.editionId,null);
    assert.equal(typeof lead.qualification.consultationRequested,'boolean');
    assert.equal(lead.qualification.instruments.length,2);
    assert.equal(lead.marketingConsent,false);
    assert.equal(lead.email,'synthetic@example.invalid');
    assert.match(lead.eventId,/^webinar:[a-f0-9]{56}$/);
    if (!events.has(lead.eventId)) events.set(lead.eventId,crypto.randomUUID());
    return Response.json({
      contactId:CONTACT_ID,
      registrationId:events.get(lead.eventId),
      state:'PENDING_EDITION',
    });
  }
  throw new Error('Unexpected external destination '+parsed.origin+parsed.pathname);
};
const now=()=>new Date('2026-10-21T18:00:00Z');
const options={env,now,fetchImpl};
let result=await handlePublicLead(request(mkLead()),options);
assert.equal(result.status,200,'event lead accepted only by injected synthetic transport');
assert.equal(calls.length,4);
assert.equal(events.size,1);
const firstKey=[...events.keys()][0];
const firstRegistration=[...events.values()][0];
result=await handlePublicLead(request(mkLead()),options);
assert.equal(result.status,200);
assert.equal(calls.length,8);
assert.equal(events.size,1,'retries are idempotent');
assert.equal(events.get(firstKey),firstRegistration);
result=await handlePublicLead(request(mkLead({
  qualification:{...mkLead().qualification, consultationRequested:false},
})),options);
assert.equal(result.status,200);
assert.equal(events.size,2,'changed evidence is distinct, contact UUID stays stable');
for (const [invalid, expectedStatus] of [
  [mkLead({qualification:{...mkLead().qualification,consultationRequested:'true'}}), 400],
  [mkLead({qualification:{...mkLead().qualification,instruments:[
    {instrumentId:'oro',knowledgeLevel:'Ce l’ho già'},
    {instrumentId:'oro',knowledgeLevel:'Ce l’ho già'},
  ]}}), 400],
  // The v2 transport is deliberately OFF; gate checks precede v2 validation.
  [{...mkLead(),contractVersion:PATRIMONIAL_V2}, 503],
]) {
  const previousCalls=calls.length;
  assert.equal((await handlePublicLead(request(invalid),options)).status,expectedStatus);
  assert.equal(calls.length,previousCalls,'invalid/disabled data must not reach CRM');
}
const countBefore=calls.length;
const close = await handlePublicLead(request(mkLead()),{
  env:{...env,NODE_ENV:'production',PATRIMONIAL_EVENT_SIGNUP_ENABLED:'false'},
  now,fetchImpl,
});
assert.equal(close.status,503);
assert.equal(calls.length,countBefore,'closed signup cannot perform CRM or Hub writes');
const failBridge = await handlePublicLead(request(mkLead()),{
  ...options,fetchImpl:async(url,init)=>{
    if(new URL(url).hostname==='fixture.supabase.co')return Response.json({message:'stubbed failure'},{status:500});
    return fetchImpl(url,init);
  },
});
assert.equal(failBridge.status,502,'never report Hub receipt if it failed');
assert.equal(events.size,2);
assert.equal(realFetch !== globalThis.fetch,true);
console.log('Synthetic Event → HighLevel → Hub: idempotency, qualification, gating and failure semantics PASS');
