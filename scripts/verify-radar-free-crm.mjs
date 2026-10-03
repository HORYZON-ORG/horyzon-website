import assert from 'node:assert/strict';
import { createMemoryRadarPersistence } from '../src/lib/radar/persistence/adapter.ts';
import { createRadarService, RadarAccessError } from '../src/lib/radar/service.ts';
import { radarSteps } from '../src/lib/radar/domain.ts';
import { normalizePhone, radarLeadNote, radarOutcomeTags, syncRadarLeadCompleted, syncRadarLeadStarted } from '../src/lib/radar/highlevel.ts';
import { bearerToken, staffOrigins, verifyRadarStaff } from '../src/lib/radar/staff-auth.ts';

// Free Radar: completing opens the result, no purchase or PIN.
const persistence = createMemoryRadarPersistence();
const free = createRadarService({ persistence, freeAccess: true });
const qualification = { aziendaNome: 'Acme', referenteNome: 'Ada Lovelace', referenteEmail: 'ada@example.com', referenteTelefono: '333 123 4567', settore: 'Servizi', volumeAffari: '1 – 5 milioni €', numeroDipendenti: '6-20', seasonal: false };
const owner = await free.createAssessment(qualification);
await assert.rejects(() => free.readStaffReport(owner.id), /non è ancora completo/);
let revision = 0;
let currentStep = 0;
for (const step of radarSteps().filter((item) => item.id !== 'qualificazione#stagionale')) {
  currentStep += 1;
  const saved = await free.saveAnswer({ assessmentId: owner.id, ownerSecret: owner.ownerSecret, answerKey: step.id, value: step.kind === 'OWNER_HOURS' ? [0, 60, 0] : step.kind === 'COMPANY_PROFIT' ? [0, 30000] : step.kind === 'AI_MULTI' ? [0] : 2, expectedRevision: revision, currentStep });
  revision = saved.revision;
}
const completed = await free.completeAssessment(owner.id, owner.ownerSecret);
assert.equal(completed.status, 'COMPLETED');
assert.equal('scores' in completed, false);
assert.equal((await free.resumeAssessment(owner.id, owner.ownerSecret)).status, 'COMPLETED');
const result = await free.readFreeResult(owner.id, owner.ownerSecret);
assert.equal(result.resultLocked, false);
assert.equal(result.scores.ownerEconomics.monthlyProfit, 2500);
await assert.rejects(() => free.readFreeResult(owner.id, 'wrong-secret'), /owner secret|ownership/i);

// Paid mode keeps the gate.
const paid = createRadarService({ persistence });
await assert.rejects(() => paid.readFreeResult(owner.id, owner.ownerSecret), RadarAccessError);

// Staff report: by id, without the owner secret.
const staffReport = await free.readStaffReport(owner.id);
assert.equal(staffReport.company.aziendaNome, 'Acme');
assert.ok(staffReport.economics && staffReport.economics.hourlyProfit > 0);
await assert.rejects(() => free.readStaffReport('00000000-0000-0000-0000-000000000000'), /not found/i);

// HighLevel: upsert without tags (they would replace existing ones), then add tags, then the note.
assert.equal(normalizePhone('333 123 4567'), '+393331234567');
assert.equal(normalizePhone('0039 333 1234567'), '+393331234567');
assert.equal(normalizePhone('+41 79 123 45 67'), '+41791234567');
assert.equal(normalizePhone(''), '');
const calls = [];
const fakeFetch = async (url, init) => {
  calls.push({ url, init, body: JSON.parse(init.body) });
  const payload = url.endsWith('/contacts/upsert') ? { contact: { id: 'ct_1' }, new: true } : { ok: true };
  return new Response(JSON.stringify(payload), { status: 200 });
};
const config = { token: 'pit-test', locationId: 'loc_1', fetchImpl: fakeFetch };
await syncRadarLeadStarted(config, qualification);
assert.equal(calls[0].url, 'https://services.leadconnectorhq.com/contacts/upsert');
assert.equal(calls[0].init.headers.Authorization, 'Bearer pit-test');
assert.equal(calls[0].init.headers.Version, '2021-07-28');
assert.deepEqual({ ...calls[0].body, source: undefined }, { locationId: 'loc_1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '+393331234567', companyName: 'Acme', source: undefined });
assert.equal('tags' in calls[0].body, false);
assert.equal(calls[1].url, 'https://services.leadconnectorhq.com/contacts/ct_1/tags');
assert.deepEqual(calls[1].body.tags, ['radar-impresa', 'radar-avviato']);

calls.length = 0;
await syncRadarLeadCompleted(config, qualification, staffReport);
assert.equal(calls.length, 3);
assert.deepEqual(calls[1].body.tags, radarOutcomeTags(staffReport));
assert.ok(calls[1].body.tags.includes('radar-completato'));
assert.ok(calls[1].body.tags.some((tag) => tag.startsWith('radar-indice-')));
assert.equal(calls[2].url, 'https://services.leadconnectorhq.com/contacts/ct_1/notes');
assert.match(calls[2].body.body, /Indice globale: \d+\/100/);
assert.match(calls[2].body.body, /Utile per ora lavorata/);
assert.equal(radarLeadNote(qualification, staffReport), calls[2].body.body);

const failing = { ...config, fetchImpl: async () => new Response('{"message":"Unauthorized"}', { status: 401 }) };
await assert.rejects(() => syncRadarLeadStarted(failing, qualification), /HighLevel contacts 401/);

// Staff auth: Supabase session, then the superadmin role in hub.user_roles.
assert.equal(bearerToken('Bearer abc.def'), 'abc.def');
assert.throws(() => bearerToken(null), RadarAccessError);
assert.deepEqual(staffOrigins({}), ['https://hub.horyzon.it']);
assert.deepEqual(staffOrigins({ RADAR_STAFF_ORIGINS: 'https://a.example, https://b.example/' }), ['https://a.example', 'https://b.example']);
const env = { SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'service' };
const authFetch = (roles, userStatus = 200) => async (url, init) => {
  if (url.endsWith('/auth/v1/user')) {
    assert.equal(init.headers.Authorization, 'Bearer user-jwt');
    return new Response(JSON.stringify({ id: 'user-1' }), { status: userStatus });
  }
  assert.match(url, /\/rest\/v1\/user_roles\?user_id=eq\.user-1&role=eq\.superadmin/);
  assert.equal(init.headers['Accept-Profile'], 'hub');
  return new Response(JSON.stringify(roles), { status: 200 });
};
assert.equal(await verifyRadarStaff('user-jwt', env, authFetch([{ user_id: 'user-1' }])), 'user-1');
await assert.rejects(() => verifyRadarStaff('user-jwt', env, authFetch([])), (error) => error instanceof RadarAccessError && error.status === 403);
await assert.rejects(() => verifyRadarStaff('user-jwt', env, authFetch([], 401)), (error) => error instanceof RadarAccessError && error.status === 401);

console.log('Free Radar, staff PDF and HighLevel verifier passed');
