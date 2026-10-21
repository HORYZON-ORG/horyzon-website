import assert from 'node:assert/strict';
import { handleArchitectCvUpload } from '../src/lib/public-leads/architect-cv-upload.ts';
import { handlePublicLead } from '../src/lib/public-leads/handler.ts';
import { claimCv, eligibleCandidateCvs, isPdf, purgeExpiredCvs } from '../src/lib/public-leads/architect-cv.ts';

// Finto Storage Supabase in memoria: object, info, move, list, delete.
function fakeStorage() {
  const objects = new Map();
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url); const path = u.pathname.replace('/storage/v1/object/', ''); calls.push(`${init.method ?? 'GET'} ${path}`);
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (path === 'move') {
      const { sourceKey, destinationKey } = JSON.parse(init.body);
      if (!objects.has(sourceKey)) return json(400, { error: 'not_found' });
      objects.set(destinationKey, objects.get(sourceKey)); objects.delete(sourceKey); return json(200, {});
    }
    if (path.startsWith('info/architect-cv/')) return objects.has(path.slice(18)) ? json(200, {}) : json(404, {});
    if (path === 'list/architect-cv') {
      const { prefix } = JSON.parse(init.body);
      return json(200, [...objects].filter(([k]) => k.startsWith(prefix + '/')).map(([k, v]) => ({ name: k.slice(prefix.length + 1), id: k, created_at: v.createdAt })));
    }
    if (path === 'architect-cv' && init.method === 'DELETE') { for (const k of JSON.parse(init.body).prefixes) objects.delete(k); return json(200, []); }
    const key = path.slice('architect-cv/'.length);
    if (init.method === 'POST') { objects.set(key, { body: Buffer.from(init.body), createdAt: new Date().toISOString() }); return json(200, { Key: key }); }
    return objects.has(key) ? new Response(objects.get(key).body, { status: 200 }) : json(404, {});
  };
  return { storage: { url: 'https://db.test', key: 'service', fetchImpl }, objects, calls };
}
const pdf = (size = 2000) => { const b = Buffer.alloc(size, 32); b.write('%PDF-1.7\n'); b.write('\n%%EOF\n', size - 7); return b; };
const env = { NODE_ENV: 'test', HIGHLEVEL_PRIVATE_TOKEN: 't', HIGHLEVEL_LOCATION_ID: 'loc' };
const origin = 'http://localhost:3000';
const upload = (s, body, type = 'application/pdf') => handleArchitectCvUpload(new Request(`${origin}/api/public-leads/cv`, { method: 'POST', headers: { origin, 'content-type': type }, body }), { env, storage: s.storage });

// 1. Validazione PDF
assert.equal(isPdf(pdf()), true);
assert.equal(isPdf(Buffer.from('MZ fake exe '.repeat(20))), false, 'un file non PDF rinominato .pdf viene rifiutato');
const s = fakeStorage();
assert.equal((await upload(s, Buffer.from('<html>'.repeat(30)))).status, 400);
assert.equal((await upload(s, pdf(), 'image/png')).status, 415);
assert.equal((await upload(s, pdf(5 * 1024 * 1024 + 10))).status, 413, 'oltre 5 MB rifiutato');
assert.equal((await handleArchitectCvUpload(new Request(`${origin}/x`, { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/pdf' }, body: pdf() }), { env, storage: s.storage })).status, 403);
assert.equal((await handleArchitectCvUpload(new Request(`${origin}/x`, { method: 'POST', headers: { origin, 'content-type': 'application/pdf' }, body: pdf() }), { env, storage: null })).status, 503, 'senza storage: errore esplicito, mai finto successo');
const ok = await (await upload(s, pdf())).json();
assert.equal(ok.ok, true); assert.match(ok.cvId, /^[0-9a-f-]{36}$/);
assert(s.objects.has(`pending/${ok.cvId}.pdf`), 'salvato in pending, nome file del candidato mai usato');

// 2. Candidatura: CV obbligatorio, collegato prima del CRM, nota senza file
const lead = (extra = {}) => ({ mode: 'architect-path', sourcePath: '/benessere-patrimoniale/percorso-architetto-patrimoniale', firstName: 'Anna', lastName: 'Rossi', email: 'anna@example.com', phone: '3331234567', province: 'Milano', profile: '', message: '', consent: true, marketingConsent: false, website: '', utm: {}, experience: '', goal: '', availability: '', ...extra });
const post = (body, opts) => handlePublicLead(new Request(`${origin}/api/public-leads`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }), opts);
const crmCalls = []; let failNotes = false;
const crmFetch = async (url, init) => {
  crmCalls.push(`${init.method} ${new URL(url).pathname}`);
  if (url.includes('/contacts/upsert')) return Response.json({ contact: { id: 'c1' } });
  if (url.includes('/notes') && failNotes) return new Response('{}', { status: 500 });
  return Response.json({ ok: true });
};
assert.equal((await post(lead(), { env, fetchImpl: crmFetch, cvStorage: s.storage })).status, 400, 'candidatura senza CV rifiutata');
assert.equal(crmCalls.length, 0, 'nessuna scrittura CRM senza CV');
assert.equal((await post(lead({ cvId: '00000000-0000-4000-8000-000000000000' }), { env, fetchImpl: crmFetch, cvStorage: s.storage })).status, 400, 'CV inesistente o scaduto');
assert.equal(crmCalls.length, 0);
assert.equal((await post({ ...lead({ cvId: ok.cvId }), mode: 'patrimonial-event', sourcePath: '/benessere-patrimoniale/evento' }, { env, fetchImpl: crmFetch, cvStorage: s.storage })).status, 400, 'il modulo evento non accetta CV');

failNotes = true;
assert.equal((await post(lead({ cvId: ok.cvId }), { env, fetchImpl: crmFetch, cvStorage: s.storage })).status, 502);
assert(s.objects.has(`candidates/${ok.cvId}.pdf`), 'il CV resta al sicuro anche se il CRM fallisce');
failNotes = false; crmCalls.length = 0;
const accepted = await post(lead({ cvId: ok.cvId }), { env, fetchImpl: async (url, init) => { if (url.includes('/notes')) crmCalls.push(JSON.parse(init.body).body); return crmFetch(url, init); }, cvStorage: s.storage });
assert.equal(accepted.status, 200, 'retry con lo stesso CV dopo errore CRM: accettato (claim idempotente)');
const note = crmCalls.find(n => typeof n === 'string' && n.includes('Curriculum'));
assert(note && note.includes(`rif. ${ok.cvId}`) && !note.includes('%PDF'), 'nota CRM con riferimento, senza contenuto del file');
assert(note.includes('campo CV HighLevel non ancora configurato'));

// 3. Caricamento nel campo file HighLevel quando configurato; un errore non blocca
const s2 = fakeStorage(); const up2 = await (await upload(s2, pdf())).json();
const hl = [];
const res2 = await post(lead({ cvId: up2.cvId }), { env: { ...env, HIGHLEVEL_CV_FIELD_ID: 'fld1' }, cvStorage: s2.storage, fetchImpl: async (url, init) => {
  if (url.includes('upload-custom-files')) { hl.push([...init.body.keys()][0]); return new Response('{}', { status: 500 }); }
  if (url.includes('/notes')) hl.push(JSON.parse(init.body).body);
  return crmFetch(url, init);
} });
assert.equal(res2.status, 200, 'errore upload HighLevel non fa perdere la candidatura');
assert(hl.some(k => /^fld1_[0-9a-f-]{36}$/.test(k)), 'chiave multipart <fieldId>_<uuid>');
assert(hl.some(n => typeof n === 'string' && n.includes('verifica manuale')), 'segnalazione di verifica manuale');

// 4. Integrazione Hub opt-in: CV -> registrazione canonica -> CRM -> receipt.
const connectedEnv = { ...env, PATRIMONIAL_ARCHITECT_HUB_INTAKE_ENABLED: 'true', SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'secret' };
const s4 = fakeStorage(); const up4 = await (await upload(s4, pdf())).json();
const sequence = [];
const hubFetch = async (url, init) => {
  const body = JSON.parse(init.body);
  sequence.push(new URL(url).pathname + ':' + (body.p_success ?? 'intake'));
  assert.equal(init.headers['Content-Profile'], 'hub');
  if (url.endsWith('/architect_candidate_intake_v1')) {
    assert.equal(body.p_cv_id, up4.cvId);
    assert.match(body.p_hash, /^[0-9a-f]{64}$/);
    assert.equal(body.p_data.email, 'anna@example.com');
    return Response.json('92b5c71f-0e7b-4828-ae6c-5228e1811a94');
  }
  assert.equal(body.p_contact_id, 'c1');
  return Response.json(null);
};
const acceptedHub = await post(lead({ cvId: up4.cvId }), {
  env: connectedEnv, cvStorage: s4.storage, hubFetchImpl: hubFetch,
  fetchImpl: async (url, init) => { sequence.push(new URL(url).pathname); return crmFetch(url, init); },
});
assert.equal(acceptedHub.status, 200);
assert(sequence[0].includes('architect_candidate_intake_v1'), 'Hub intake before HighLevel');
assert(sequence.some(x => x.includes('/contacts/upsert')));
assert(sequence.at(-1).includes('architect_candidate_crm_v1:true'), 'Hub CRM receipt');
assert(s4.objects.has(`candidates/${up4.cvId}.pdf`), 'documento privato rimane in storage');

const s5 = fakeStorage(); const up5 = await (await upload(s5, pdf())).json();
let attemptedCrm = false;
const rejectedHub = await post(lead({ cvId: up5.cvId }), {
  env: connectedEnv, cvStorage: s5.storage,
  hubFetchImpl: async () => new Response('{}', { status: 503 }),
  fetchImpl: async () => { attemptedCrm = true; return Response.json({}); },
});
assert.equal(rejectedHub.status, 503, 'intake Hub indisponibile: fail-closed');
assert.equal(attemptedCrm, false, 'nessuna scrittura HighLevel se Hub fallisce');
assert(s5.objects.has(`candidates/${up5.cvId}.pdf`), 'CV trattenuto per retry idempotente');

// 5. La receipt Hub resta valida anche quando HighLevel fallisce.
const s6 = fakeStorage(); const up6 = await (await upload(s6, pdf())).json();
const crmEvents = [];
const crmUnavailable = await post(lead({ cvId: up6.cvId }), {
  env: connectedEnv, cvStorage: s6.storage,
  hubFetchImpl: async (url, init) => {
    const body = JSON.parse(init.body);
    crmEvents.push({ name: new URL(url).pathname, body });
    if (url.includes('/architect_candidate_intake_v1')) return Response.json('92b5c71f-0e7b-4828-ae6c-5228e1811a94');
    return Response.json(null);
  },
  fetchImpl: async () => new Response('{}', { status: 502 }),
});
assert.equal(crmUnavailable.status, 200, 'candidatura conservata nell’Hub non si perde per un guasto CRM');
assert(crmEvents.some(e => e.name.includes('architect_candidate_crm_v1') && e.body.p_success === false), 'stato CRM da riconciliare');
const s7 = fakeStorage(); const up7 = await (await upload(s7, pdf())).json();
let crmTried = false;
const hubOnly = await post(lead({ cvId: up7.cvId }), {
  env: { ...connectedEnv, HIGHLEVEL_PRIVATE_TOKEN: '' }, cvStorage: s7.storage,
  hubFetchImpl: async (_url, init) => {
    const body = JSON.parse(init.body);
    assert.equal(body.p_cv_id, up7.cvId);
    return Response.json('92b5c71f-0e7b-4828-ae6c-5228e1811a94');
  },
  fetchImpl: async () => { crmTried = true; return Response.json({}); },
});
assert.equal(hubOnly.status, 200, 'il CRM assente non annulla la ricevuta Horyzon');
assert.equal(crmTried, false);

// 6. Retention
const s3 = fakeStorage();
const day = 86400000, now = Date.now();
s3.objects.set('pending/old.pdf', { body: pdf(), createdAt: new Date(now - 2 * day).toISOString() });
s3.objects.set('pending/new.pdf', { body: pdf(), createdAt: new Date(now - 3600000).toISOString() });
s3.objects.set('candidates/old.pdf', { body: pdf(), createdAt: new Date(now - 366 * day).toISOString() });
s3.objects.set('candidates/new.pdf', { body: pdf(), createdAt: new Date(now - 300 * day).toISOString() });
assert.deepEqual(await purgeExpiredCvs(s3.storage, new Date(now)), { pending: 1, candidates: 0 },
  'senza verifica dello stato, nessun CV di candidato viene cancellato');
assert(s3.objects.has('candidates/old.pdf'), 'il CV storico resta protetto finché non è autorizzato');
assert.deepEqual(
  await purgeExpiredCvs(s3.storage, new Date(now), async ids => new Set(ids.filter(id => id === 'old'))),
  { pending: 0, candidates: 1 },
  'solo file confermati come eliminabili dalla verifica Horyzon');
assert.deepEqual([...s3.objects.keys()].sort(), ['candidates/new.pdf', 'pending/new.pdf']);
assert.equal(await claimCv(s3.storage, 'new'), 'claimed');

const oldAt = new Date(now - 400 * day).toISOString();
const youngAt = new Date(now - 100 * day).toISOString();
const approvedId = '11111111-1111-4111-8111-111111111111';
const closedId = '22222222-2222-4222-8222-222222222222';
const trainingId = '33333333-3333-4333-8333-333333333333';
const recentId = '44444444-4444-4444-8444-444444444444';
const rows = [
  { cv_id: approvedId, status: 'approved', updated_at: oldAt },
  { cv_id: closedId, status: 'rejected', updated_at: oldAt },
  { cv_id: trainingId, status: 'training', updated_at: oldAt },
  { cv_id: recentId, status: 'received', updated_at: youngAt },
];
const allowed = await eligibleCandidateCvs({
  url: 'https://db.test', key: 'service', fetchImpl: async (url, init) => {
    assert(new URL(url).pathname.endsWith('/rest/v1/architect_candidates'));
    assert.equal(init.headers['Accept-Profile'], 'hub');
    return Response.json(rows);
  },
}, new Date(now), [approvedId, closedId, trainingId, recentId]);
assert.deepEqual([...allowed], [closedId], 'approvato, in formazione e candidatura recente sono protetti');

console.log('PASS architect CV: solo PDF reali ≤5 MB, origin e storage fail-closed, CV obbligatorio prima di ogni scrittura CRM, retry idempotente, nota senza contenuto, campo HighLevel opzionale e non bloccante, retention 24h/12 mesi condizionata allo stato della selezione.');
