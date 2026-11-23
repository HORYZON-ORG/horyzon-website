import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { architectStartupEnabled, architectStartupConfirmationEnabled, architectStartupVideoUrl } from '../src/lib/public-leads/architect-startup-config.ts';
import {
  registerArchitectCandidate,
  issueArchitectStartupLink,
  confirmArchitectStartupInterest,
} from '../src/lib/public-leads/architect-hub-intake.ts';

const candidateId = '8fb24e11-1317-449b-9496-6b8733a624e6';
const cvId = '0f381c57-b9d5-4a3a-8a36-b1021e0e764f';
const env = {
  NODE_ENV: 'test',
  PATRIMONIAL_ARCHITECT_HUB_INTAKE_ENABLED: 'true',
  SUPABASE_URL: 'https://pmkyeqrfkunypfkbjnyg.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-only',
};
assert.equal(architectStartupEnabled(env), false, 'senza flag il passaggio alla startup resta spento');
assert.equal(architectStartupEnabled({ ...env, PATRIMONIAL_ARCHITECT_STARTUP_ENABLED: 'true' }), true, 'la pagina startup è raggiungibile anche senza video');
assert.equal(architectStartupConfirmationEnabled({ ...env, PATRIMONIAL_ARCHITECT_STARTUP_ENABLED: 'true' }), false, 'nessuna conferma senza video');
assert.equal(architectStartupVideoUrl({ ARCHITECT_STARTUP_VIDEO_URL: 'https://horyzon.it/presentazione.mp4' }), 'https://horyzon.it/presentazione.mp4');
assert.equal(architectStartupVideoUrl({ ARCHITECT_STARTUP_VIDEO_URL: 'https://video.example.invalid/watch' }), '', 'provider senza evento ended non abilitato');
assert.equal(architectStartupConfirmationEnabled({ ...env, ARCHITECT_STARTUP_VIDEO_URL: 'https://horyzon.it/presentazione.mp4', PATRIMONIAL_ARCHITECT_STARTUP_ENABLED: 'true' }), true);
const calls = [];
let issued = '';
const mockFetch = async (url, init) => {
  const rpc = new URL(url).pathname.split('/').at(-1);
  const args = JSON.parse(init.body);
  calls.push({ rpc, args });
  assert.equal(init.headers['Content-Profile'], 'hub');
  assert.equal(init.headers['Cache-Control'], 'no-store');
  if (rpc === 'architect_candidate_intake_v1') return Response.json(candidateId);
  if (rpc === 'architect_candidate_startup_issue_v1') {
    assert.equal(args.p_candidate_id, candidateId);
    assert.match(args.p_token_hash, /^[0-9a-f]{64}$/);
    issued = args.p_token_hash;
    return Response.json(true);
  }
  if (rpc === 'architect_candidate_startup_confirm_v1') {
    return Response.json(args.p_token_hash === issued);
  }
  return new Response('{}', { status: 400 });
};
const lead = {
  mode: 'architect-path', firstName: 'Persona', lastName: 'Test',
  email: 'candidate@example.invalid', phone: '+393331234567',
  province: 'Milano', profile: '', message: '', consent: true,
  marketingConsent: false, utm: {}, experience: '', goal: '', availability: '',
};
const received = await registerArchitectCandidate(env, cvId, lead, mockFetch);
assert.equal(received, candidateId, 'l’intake restituisce id Hub, non dati personali in URL');

const href = await issueArchitectStartupLink(env, received, mockFetch);
assert.match(href, /^\/candidature\/architetti-patrimoniali\/startup#token=[A-Za-z0-9_-]{43}$/);
assert(!href.includes(lead.email) && !href.includes(lead.phone) && !href.includes(candidateId));
const token = href.split('token=')[1];
assert.equal(createHash('sha256').update(token).digest('hex'), issued, 'server stores only hash');
assert.equal(await confirmArchitectStartupInterest(env, token, mockFetch), true);
assert.equal(await confirmArchitectStartupInterest(env, 'invalid', mockFetch), false);
assert.equal(await confirmArchitectStartupInterest(env, 'z'.repeat(43), mockFetch), false);
assert.equal(await registerArchitectCandidate({ ...env, PATRIMONIAL_ARCHITECT_HUB_INTAKE_ENABLED: 'false' }, cvId, lead, mockFetch), null);
assert.deepEqual(calls.map(x => x.rpc), [
  'architect_candidate_intake_v1',
  'architect_candidate_startup_issue_v1',
  'architect_candidate_startup_confirm_v1',
  'architect_candidate_startup_confirm_v1',
]);
console.log('PASS: candidate-linked startup token, no PII, page without video, confirmation gated by video');
