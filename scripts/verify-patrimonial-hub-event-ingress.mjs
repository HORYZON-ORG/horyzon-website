import assert from 'node:assert/strict';
import { recordEventLeadInHub } from '../src/lib/public-leads/patrimonial-hub-event-ingress.ts';

const lead = {
  mode: 'patrimonial-event', firstName: 'Mario', lastName: 'Rossi',
  email: 'mario@example.invalid', phone: '+393331234567', province: 'Milano',
  profile: 'Privato', message: 'Informazioni webinar', consent: true,
  marketingConsent: false, utm: { utm_source: 'test' },
  qualification: {
    schemaVersion: 1, audienceProfile: 'Professionista', sceneId: 'fermi',
    consultationRequested: false, instruments: [{ instrumentId: 'oro', knowledgeLevel: 'So come funziona' }],
  },
};
const config = {
  SUPABASE_URL: 'https://fixture.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture-secret-never-real',
  HORYZON_HUB_EVENT_INGRESS_ENABLED: 'true',
};
let calls = 0;
const eventKeys = [];
const success = async (url, init) => {
  calls++;
  assert.equal(new URL(url).pathname, '/rest/v1/rpc/architetti_event_ingest');
  assert.equal(init.method, 'POST');
  const value = JSON.parse(init.body).p_event;
  assert.equal(value.email, lead.email);
  assert.equal(value.externalContactId, 'verified-contact');
  assert.equal(value.locationId, 'verified-location');
  assert.equal(value.marketingConsent, false);
  assert.equal(value.editionId, null);
  assert.deepEqual(value.qualification, lead.qualification);
  assert.equal(value.sourcePath, '/benessere-patrimoniale/evento');
  assert.ok(value.eventId.startsWith('webinar:'));
  eventKeys.push(value.eventId);
  return Response.json({
    contactId: '123e4567-e89b-42d3-a456-426614174000',
    registrationId: '123e4567-e89b-42d3-a456-426614174001',
    state: 'PENDING_EDITION',
  });
};
const base = {
  lead, highlevelContactId: 'verified-contact',
  highlevelLocationId: 'verified-location',
  source: 'Evento Benessere Patrimoniale',
};
assert.equal(await recordEventLeadInHub({ ...base, env: { ...config, HORYZON_HUB_EVENT_INGRESS_ENABLED: 'false' }, fetchImpl: success }), 'DISABLED');
assert.equal(calls, 0);
assert.equal(await recordEventLeadInHub({ ...base, env: config, fetchImpl: success }), 'RECORDED');
assert.equal(calls, 1);
assert.equal(await recordEventLeadInHub({ ...base, env: config, fetchImpl: success }), 'RECORDED');
assert.equal(calls, 2);
assert.equal(eventKeys[0],eventKeys[1], 'same normalized pilot payload must reuse the same event key');
await assert.rejects(() => recordEventLeadInHub({ ...base, env: { ...config, SUPABASE_URL: 'http://evil.test' }, fetchImpl: success }), /HUB_INGRESS_CONFIG/);
await assert.rejects(() => recordEventLeadInHub({ ...base, env: config, fetchImpl: async () => new Response('', { status: 503 }) }), /HUB_INGRESS_UNCONFIRMED/);
assert.equal(calls, 2);
console.log('Hub event ingress: gated transport, explicit identity, no fake edition, receipts PASS');
