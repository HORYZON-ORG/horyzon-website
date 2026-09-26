import assert from 'node:assert/strict';
import {
  MemoryAnnunci10xPersistenceAdapter,
  MockAnnunci10xProvider,
  createAnonymousAnalyzeSession,
  createAnalysisInputIdentity,
  fetchPublicJobAd,
  getAnnunci10xAnalysisRunStatus,
  prepareAnnunci10xSource,
  runAnnunci10xAnalysisRun,
  startAnnunci10xAnalysisRun,
} from '../src/lib/annunci-10x/index.ts';

const VALID_AD = [
  'Customer Care Specialist per azienda SaaS B2B a Milano.',
  'Gestirai richieste inbound via ticket ed email, aggiornerai il CRM e passerai al team tecnico i casi complessi.',
  'Il risultato atteso e mantenere tempi di risposta ordinati e ridurre passaggi persi tra cliente e reparto tecnico.',
  'Richiediamo italiano scritto chiaro, esperienza in assistenza clienti B2B e uso base di strumenti CRM.',
  'Contratto full-time, sede Milano Lambrate, lavoro ibrido, RAL 28-32k.',
  'Candidati compilando il form aziendale indicato nell annuncio.',
].join(' ');

const html = (body) => new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } });
const text = (body, type = 'text/plain') => new Response(body, { headers: { 'content-type': type } });
const redirect = (location) => new Response('', { status: 302, headers: { location } });
const resolver = async (hostname) => {
  if (hostname === 'public.test' || hostname === 'next.test') return ['93.184.216.34'];
  if (hostname === 'private.test') return ['127.0.0.1'];
  if (hostname === 'lan.test') return ['192.168.1.10'];
  return ['93.184.216.34'];
};

const pasted = await prepareAnnunci10xSource({ kind: 'PASTED_TEXT', text: `  ${VALID_AD}\r\n` });
assert.equal(pasted.sourceStatus, 'READY');
assert.equal(pasted.targetText, VALID_AD);
assert.match(pasted.sourceHash, /^[0-9a-f]{64}$/);
await assert.rejects(() => prepareAnnunci10xSource({ kind: 'PASTED_TEXT', text: 'troppo breve' }), /troppo breve/);
await assert.rejects(() => prepareAnnunci10xSource({ kind: 'PASTED_TEXT', text: 'x'.repeat(12_001) }), /limite massimo/);

const fetchedHtml = await prepareAnnunci10xSource({
  kind: 'PUBLIC_URL',
  url: 'https://public.test/job',
}, {
  resolveHost: resolver,
  fetchImpl: async () => html(`
    <html><body><main>
      <h1>Customer Care Specialist</h1>
      <p>${VALID_AD}</p>
    </main></body></html>
  `),
});
assert.equal(fetchedHtml.sourceStatus, 'READY');
assert.match(fetchedHtml.targetText ?? '', /Customer Care Specialist/);

const fetchedJsonLd = await prepareAnnunci10xSource({
  kind: 'PUBLIC_URL',
  url: 'https://public.test/jsonld',
}, {
  resolveHost: resolver,
  fetchImpl: async () => html(`
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Addetto assistenza clienti","description":"${VALID_AD}"}
    </script>
  `),
});
assert.equal(fetchedJsonLd.sourceStatus, 'READY');
assert.match(fetchedJsonLd.targetText ?? '', /Addetto assistenza clienti/);

for (const blockedUrl of [
  'http://localhost/job',
  'http://127.0.0.1/job',
  'http://[::1]/job',
  'http://lan.test/job',
]) {
  const result = await prepareAnnunci10xSource({ kind: 'PUBLIC_URL', url: blockedUrl }, { resolveHost: resolver, fetchImpl: async () => text(VALID_AD) });
  assert.equal(result.sourceStatus, 'URL_FETCH_FAILED', blockedUrl);
}

const privateRedirect = await prepareAnnunci10xSource({ kind: 'PUBLIC_URL', url: 'https://public.test/redirect' }, {
  resolveHost: resolver,
  fetchImpl: async () => redirect('http://private.test/job'),
});
assert.equal(privateRedirect.sourceStatus, 'URL_FETCH_FAILED');
assert.equal(privateRedirect.retrievalMetadata.code, 'URL_PRIVATE_ADDRESS_BLOCKED');

await assert.rejects(() => fetchPublicJobAd('https://public.test/loop', {
  resolveHost: resolver,
  maxRedirects: 1,
  fetchImpl: async () => redirect('https://public.test/loop'),
}), /Too many redirects/);

await assert.rejects(() => fetchPublicJobAd('https://public.test/large', {
  resolveHost: resolver,
  maxBytes: 10,
  fetchImpl: async () => text('x'.repeat(100)),
}), /Response too large/);

await assert.rejects(() => fetchPublicJobAd('https://public.test/json', {
  resolveHost: resolver,
  fetchImpl: async () => text('{"ok":true}', 'application/json'),
}), /Unsupported content type/);

await assert.rejects(() => fetchPublicJobAd('https://public.test/timeout', {
  resolveHost: resolver,
  timeoutMs: 5,
  fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }),
}), /Aborted/);

const context = makeContext();
const created = await createAnonymousAnalyzeSession(context);
const session = { sessionId: created.session.id, sessionSecret: created.sessionSecret };

const started = await startAnnunci10xAnalysisRun({
  session,
  source: { kind: 'PASTED_TEXT', text: VALID_AD, declaredChannel: 'LINKEDIN' },
  context,
});
assert.equal(started.run.status, 'QUEUED');
assert.equal(started.run.stage, 'SOURCE_VALIDATION');

const duplicate = await startAnnunci10xAnalysisRun({
  session,
  source: { kind: 'PASTED_TEXT', text: VALID_AD, declaredChannel: 'LINKEDIN' },
  context,
});
assert.equal(duplicate.run.id, started.run.id);

const [firstRun, secondRun] = await Promise.all([
  runAnnunci10xAnalysisRun({ analysisRunId: started.run.id, session, context }),
  runAnnunci10xAnalysisRun({ analysisRunId: started.run.id, session, context }),
]);
const completed = firstRun ?? secondRun;
assert.equal(completed?.status, 'READY');
assert.equal(completed?.stage, 'COMPLETE');
assert.ok(completed?.evaluationId);
assert.equal(context.provider.calls.length, 6);

const status = await getAnnunci10xAnalysisRunStatus({ analysisRunId: started.run.id, session, context });
assert.deepEqual(status && {
  status: status.status,
  stage: status.stage,
  sourceStatus: status.sourceStatus,
  ready: status.ready,
}, {
  status: 'READY',
  stage: 'COMPLETE',
  sourceStatus: 'READY',
  ready: true,
});

const failed = await context.persistence.createOrGetAnalysisRun({
  sessionId: session.sessionId,
  sessionSecret: session.sessionSecret,
  sourceKind: 'PUBLIC_URL',
  sourceStatus: 'URL_FETCH_FAILED',
  originalInput: 'https://public.test/missing',
  sourceUrl: 'https://public.test/missing',
  fetchedText: null,
  targetText: null,
  retrievalMetadata: { code: 'URL_FETCH_FAILED' },
  failureCode: 'URL_FETCH_FAILED',
  failureMessage: 'URL non accessibile.',
  targetKind: 'ORIGINAL_AD',
  sourceHash: 'a'.repeat(64),
  inputIdentity: 'a10x_run_failed_source',
  methodVersion: 'annunci10x-method-v1',
  rubricVersion: 'annunci10x-rubric-v1',
  promptVersion: 'annunci10x-prompts-v1',
  scoreSemanticsVersion: 'annunci10x-score-semantics-v1',
  model: 'gpt-5-mini',
  provider: 'MOCK',
  evaluationMode: 'V1',
});
assert.equal(failed.status, 'FAILED');
const failedStatus = await getAnnunci10xAnalysisRunStatus({ analysisRunId: failed.id, session, context });
assert.equal(failedStatus?.failureCode, 'URL_FETCH_FAILED');

const identityV1 = createAnalysisInputIdentity({
  sourceHash: pasted.sourceHash,
  targetKind: 'ORIGINAL_AD',
  declaredChannel: 'LINKEDIN',
  methodVersion: 'annunci10x-method-v1',
  rubricVersion: 'annunci10x-rubric-v1',
  promptVersion: 'annunci10x-prompts-v1',
  scoreSemanticsVersion: 'annunci10x-score-semantics-v1',
  model: 'gpt-5-mini',
  evaluationMode: 'V1',
});
const identityV2 = createAnalysisInputIdentity({
  sourceHash: pasted.sourceHash,
  targetKind: 'ORIGINAL_AD',
  declaredChannel: 'LINKEDIN',
  methodVersion: 'annunci10x-method-v1',
  rubricVersion: 'annunci10x-rubric-v1',
  promptVersion: 'annunci10x-prompts-v1',
  scoreSemanticsVersion: 'annunci10x-score-semantics-v1',
  model: 'gpt-5-mini',
  evaluationMode: 'V2_SHADOW',
});
assert.notEqual(identityV1, identityV2);

const rateOne = await context.persistence.checkRateLimit({ scope: 'analysis_test', subject: 's1', limit: 1, windowSeconds: 60 });
const rateTwo = await context.persistence.checkRateLimit({ scope: 'analysis_test', subject: 's1', limit: 1, windowSeconds: 60 });
assert.equal(rateOne.allowed, true);
assert.equal(rateTwo.allowed, false);

console.log('Annunci 10x analysis foundation verifier passed');

function makeContext() {
  return {
    persistence: new MemoryAnnunci10xPersistenceAdapter(),
    provider: new MockAnnunci10xProvider('success'),
    configuredProvider: 'MOCK',
  };
}
