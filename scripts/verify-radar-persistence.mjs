import assert from 'node:assert/strict';
import { createMemoryRadarPersistence, createRadarPersistence, RadarRevisionConflictError, SupabaseRadarPersistence } from '../src/lib/radar/persistence/adapter.ts';
import { createOwnerSecret, hashOwnerSecret } from '../src/lib/radar/persistence/security.ts';

const secret = createOwnerSecret();
assert.equal(secret.secretHash, hashOwnerSecret(secret.secret));
assert.doesNotThrow(() => createRadarPersistence({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-secret' }));

const store = createMemoryRadarPersistence();
const session = await store.createAssessment({ aziendaNome: 'Acme', referenteNome: 'Ada', referenteEmail: 'ada@example.com', referenteTelefono: '3000000000', settore: 'Servizi', volumeAffari: '1 – 5 milioni €', numeroDipendenti: '6-20', seasonal: false });
assert.equal((await store.resumeAssessment({ assessmentId: session.id, ownerSecretHash: session.ownerSecretHash })).answeredCount, 1);
const saved = await store.saveAnswer({ assessmentId: session.id, ownerSecretHash: session.ownerSecretHash, answerKey: 'amministrazione#0', value: 3, expectedRevision: 0, currentStep: 1 });
assert.deepEqual(saved, { revision: 1, currentStep: 1, answeredCount: 2, progressPercent: 6 });

await assert.rejects(
  () => store.saveAnswer({ assessmentId: session.id, ownerSecretHash: session.ownerSecretHash, answerKey: 'produzione#0', value: 2, expectedRevision: 0, currentStep: 2 }),
  RadarRevisionConflictError,
);
await assert.rejects(
  () => store.completeAssessment({ assessmentId: session.id, ownerSecretHash: session.ownerSecretHash }),
  /complete/i,
);
await store.appendAccessEvent({ assessmentId: session.id, accessSource: 'PREVIEW', eventType: 'PREVIEW_DENIED' });
assert.equal(await store.countRecentPreviewDenials(session.id), 1);
await assert.rejects(() => store.resumeAssessment({ assessmentId: session.id, ownerSecretHash: 'wrong' }), /ownership/i);
await assert.rejects(
  () => store.saveAnswer({ assessmentId: session.id, ownerSecretHash: session.ownerSecretHash, answerKey: '_storico', value: 1, expectedRevision: 1, currentStep: 2 }),
  /answer key/i,
);



// PostgREST answers an insert without `Prefer: return=representation` with 201 and an empty body:
// recording a preview attempt must not fail on it (it made every PIN attempt a 500).
const requests = [];
const supabase = new SupabaseRadarPersistence({ url: 'https://example.supabase.co', serviceRoleKey: 'server-secret', fetchImpl: async (url, init) => { requests.push({ url: String(url), init }); return new Response(null, { status: 201 }); } });
await supabase.appendAccessEvent({ assessmentId: 'a1', accessSource: 'PREVIEW', eventType: 'PREVIEW_GRANTED' });
assert.equal(requests.length, 1);
assert.match(requests[0].url, /\/rest\/v1\/radar_access_events$/);
console.log('Paid Radar persistence verifier passed');
