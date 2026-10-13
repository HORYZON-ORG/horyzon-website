import assert from 'node:assert/strict';
import { handlePublicLead } from '../src/lib/public-leads/handler.ts';

const env = { NODE_ENV: 'test', HIGHLEVEL_PRIVATE_TOKEN: 'test-token', HIGHLEVEL_LOCATION_ID: 'test-location' };
const valid = { name: 'Ada Lovelace', email: 'ada@example.com', phone: '333 123 4567', message: 'Vorrei informazioni.', interest: 'evento-patrimoniale', consent: true, website: '' };
const request = (payload = valid, origin = 'https://horyzon.it') => new Request('https://horyzon.it/api/public-leads', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
let calls = [];
const provider = async (url, init) => {
  calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
  return new Response(JSON.stringify(url.endsWith('/upsert') ? { contact: { id: 'test-contact' } } : {}), { status: 200 });
};
for (const interest of ['evento-patrimoniale', 'percorso-consulenti']) {
  calls = [];
  const response = await handlePublicLead(request({ ...valid, interest }), { env, fetchImpl: provider });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].body.locationId, 'test-location');
  assert.equal(calls[0].body.firstName, 'Ada');
  assert.equal(calls[0].body.lastName, 'Lovelace');
  assert.equal(calls[0].body.phone, '+393331234567');
  assert.equal(calls[0].headers.Authorization, 'Bearer test-token');
  assert.equal('tags' in calls[0].body, false, 'upsert must preserve existing tags');
  assert.match(calls[1].url, /test-contact\/tags$/);
  assert(calls[1].body.tags.includes(`horyzon-${interest}`));
  assert(!JSON.stringify(calls).includes('radar'), 'no Radar scores, tags or sources');
  assert.match(calls[2].body.body, /privacy.*v1/i);
  assert.match(calls[2].body.body, /Ricontatto richiesto: sì/);
}
for (const change of [{ consent: false }, { email: 'bad' }, { interest: 'radar' }, { phone: 'no phone' }, { message: 'x'.repeat(1501) }, { website: 'bot' }]) {
  calls = [];
  const response = await handlePublicLead(request({ ...valid, ...change }), { env, fetchImpl: provider });
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0, 'invalid input must not reach CRM');
}
assert.equal((await handlePublicLead(request(valid, 'https://evil.example'), { env, fetchImpl: provider })).status, 403);
const local = new Request('http://localhost:3020/api/public-leads', { method: 'POST', headers: { Origin: 'http://127.0.0.1:3020', 'Content-Type': 'application/json' }, body: JSON.stringify(valid) });
assert.equal((await handlePublicLead(local, { env, fetchImpl: provider })).status, 200, 'localhost and 127.0.0.1 refer to the same local preview');
assert.equal((await handlePublicLead(request(), { env: {}, fetchImpl: provider })).status, 503);
const failure = await handlePublicLead(request(), { env, fetchImpl: async () => new Response('secret-provider-payload', { status: 500 }) });
assert.equal(failure.status, 502);
assert(!JSON.stringify(await failure.json()).includes('secret-provider-payload'));
let step = 0;
const partial = await handlePublicLead(request(), { env, fetchImpl: async (...args) => ++step === 2 ? new Response('tag failure', { status: 500 }) : provider(...args) });
assert.equal(partial.status, 502, 'partial CRM write must never report success');
assert.equal((await handlePublicLead(new Request('https://horyzon.it/api/public-leads', { method: 'POST', headers: { Origin: 'https://horyzon.it', 'Content-Type': 'application/json' }, body: 'x'.repeat(13000) }), { env, fetchImpl: provider })).status, 413);
console.log('Patrimonial leads: validated inputs, separate interests, preserved tags, privacy, provider failures and no live CRM writes.');
