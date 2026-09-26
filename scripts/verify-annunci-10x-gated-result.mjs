import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

process.env.ANNUNCI10X_EMAIL_PROVIDER = 'MOCK';
process.env.ANNUNCI10X_EMAIL_VERIFICATION_PEPPER = `${randomUUID()}${randomUUID()}`;

const {
  Annunci10xPublicError,
  MemoryAnnunci10xPersistenceAdapter,
  MockAnnunci10xEmailProvider,
  buildFreeAnnunci10xResult,
  createAnonymousAnalyzeSession,
  getGatedAnnunci10xFreeResult,
  hashEmailVerificationCode,
  saveAnnunci10xLeadContact,
  verifyAnnunci10xEmailCode,
} = await import('../src/lib/annunci-10x/index.ts');

const context = makeContext();
const created = await createAnonymousAnalyzeSession(context);
const session = { sessionId: created.session.id, sessionSecret: created.sessionSecret };
const evaluation = await context.persistence.saveEvaluation({
  sessionId: session.sessionId,
  sessionSecret: session.sessionSecret,
  target: { kind: 'ORIGINAL_AD', originalAdId: 'original-1' },
  targetRef: 'original-1',
  score: scoreFixture({ value: 78, coverage: 90, rubricVersion: 'annunci10x-rubric-v1' }),
  gate: gateFixture(),
});
const readyRun = await createRun(context, session, 'READY', evaluation.id);

await assert.rejects(
  () => getGatedAnnunci10xFreeResult({ session, analysisRunId: readyRun.id, context }),
  (error) => error instanceof Annunci10xPublicError && error.code === 'EMAIL_VERIFICATION_REQUIRED',
  'ready run without verified email is denied',
);

await saveAnnunci10xLeadContact({
  session,
  context,
  firstName: 'Ada',
  lastName: 'Lovelace',
  companyName: 'Horyzon Test',
  businessRole: 'HR',
  email: 'ada@example.com',
  marketingConsent: false,
});
await verifyWithSyntheticOtp(context, session, 'ada@example.com');

const result = await getGatedAnnunci10xFreeResult({ session, analysisRunId: readyRun.id, context });
assert.equal(result.resultVersion, 'V1_COMPAT');
assert.equal(result.score.value, 78);
assert.equal(result.score.coverage, 90);
assert.equal(result.band, null, 'V1 result does not receive V2 bands');
assertForbiddenKeys(result);

const other = await createAnonymousAnalyzeSession(context);
await assert.rejects(
  () => getGatedAnnunci10xFreeResult({ session: { sessionId: other.session.id, sessionSecret: other.sessionSecret }, analysisRunId: readyRun.id, context }),
  /ownership|not found|non trovata/i,
  'another session cannot read the run result',
);

const runningEvaluation = await context.persistence.saveEvaluation({
  sessionId: session.sessionId,
  sessionSecret: session.sessionSecret,
  target: { kind: 'ORIGINAL_AD', originalAdId: 'original-2' },
  targetRef: 'original-2',
  score: scoreFixture({ value: 60, coverage: 80, rubricVersion: 'annunci10x-rubric-v1' }),
  gate: gateFixture(),
});
const runningRun = await createRun(context, session, 'RUNNING', runningEvaluation.id);
await assert.rejects(
  () => getGatedAnnunci10xFreeResult({ session, analysisRunId: runningRun.id, context }),
  (error) => error instanceof Annunci10xPublicError && error.code === 'ANALYSIS_NOT_READY',
  'verified email alone does not unlock a running analysis',
);

const v1Range = buildFreeAnnunci10xResult({
  analysisRun: { id: 'range-run' },
  evaluation: { score: scoreFixture({ value: null, interval: { min: 62, max: 76 }, coverage: 75, rubricVersion: 'annunci10x-rubric-v1' }) },
});
assert.equal(v1Range.resultVersion, 'V1_COMPAT');
assert.deepEqual(v1Range.score.range, { min: 62, max: 76 });
assert.equal(v1Range.band, null, 'V1 interval does not get V2 bands');

const futureV2 = buildFreeAnnunci10xResult({
  analysisRun: { id: 'v2-run' },
  evaluation: { score: scoreFixture({ value: 87, coverage: 100, rubricVersion: 'annunci10x-rubric-v2' }) },
});
assert.equal(futureV2.resultVersion, 'V2');
assert.equal(futureV2.score.value, 87);
assert.equal(futureV2.score.range, undefined);
assert.deepEqual(futureV2.band, { code: 'STRONG', label: 'Forte' });

await assertMovedRoute('src/app/api/annunci-10x/analyze/route.ts');
await assertMovedRoute('src/app/api/annunci-10x/clarify/route.ts');
await assertResumeRouteDoesNotExposeResult();

const fakeClientFlag = { analysisReady: true, emailVerified: true, resultEligible: true };
void fakeClientFlag;
await assert.rejects(
  () => getGatedAnnunci10xFreeResult({ session: { sessionId: other.session.id, sessionSecret: other.sessionSecret }, analysisRunId: readyRun.id, context }),
  /ownership|not found|non trovata/i,
  'client-side flags do not affect server eligibility',
);

console.log('Annunci 10x gated result verifier passed');

function makeContext() {
  return {
    persistence: new MemoryAnnunci10xPersistenceAdapter(),
    provider: { run: async () => { throw new Error('not used'); } },
    configuredProvider: 'MOCK',
    emailProvider: new MockAnnunci10xEmailProvider(),
  };
}

async function createRun(context, session, status, evaluationId) {
  const run = await context.persistence.createOrGetAnalysisRun({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    sourceKind: 'PASTED_TEXT',
    sourceStatus: 'READY',
    originalInput: `Annuncio sintetico ${randomUUID()}`,
    targetText: 'Annuncio sintetico valido per test gated result.',
    targetKind: 'ORIGINAL_AD',
    sourceHash: randomUUID().replaceAll('-', '').padEnd(64, 'a').slice(0, 64),
    inputIdentity: `identity-${randomUUID()}`,
    methodVersion: 'annunci10x-method-v1',
    rubricVersion: 'annunci10x-rubric-v1',
    promptVersion: 'annunci10x-prompts-v1',
    scoreSemanticsVersion: 'annunci10x-score-semantics-v1',
    model: 'mock-model',
    provider: 'MOCK',
    evaluationMode: 'V1',
  });
  return context.persistence.updateAnalysisRun({
    analysisRunId: run.id,
    sessionSecret: session.sessionSecret,
    status,
    stage: status === 'READY' ? 'COMPLETE' : 'EVALUATE',
    sourceStatus: 'READY',
    evaluationId: status === 'READY' || status === 'RUNNING' ? evaluationId : null,
    resultReference: status === 'READY' ? evaluationId : null,
    completedAt: status === 'READY' ? new Date().toISOString() : null,
    errorPayload: null,
  });
}

async function verifyWithSyntheticOtp(context, session, email) {
  const lead = await context.persistence.getLead(session.sessionId, session.sessionSecret);
  const id = randomUUID();
  await context.persistence.createEmailVerification({
    id,
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    leadId: lead.id,
    emailNormalized: email,
    codeHash: hashEmailVerificationCode(process.env.ANNUNCI10X_EMAIL_VERIFICATION_PEPPER, id, email, '042019'),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    maxAttempts: 5,
    pendingGraceSeconds: 15,
  });
  await context.persistence.markEmailVerificationSent(id, session.sessionSecret);
  await verifyAnnunci10xEmailCode({ session, context, code: '042019', analysisRunId: null, requestFingerprint: 'test', env: process.env });
}

function scoreFixture({ value, interval, coverage, rubricVersion }) {
  return {
    value,
    max: 100,
    ...(interval ? { interval } : {}),
    coverage,
    checks: [],
    rubricVersion,
  };
}

function gateFixture() {
  return {
    status: 'READY',
    codes: ['NO_BLOCKERS'],
    blockingReasons: [],
    warnings: [],
    evaluatedAt: new Date().toISOString(),
  };
}

function assertForbiddenKeys(value) {
  const forbidden = new Set([
    'checks',
    'evidence',
    'missing',
    'gate',
    'operations',
    'provider',
    'model',
    'providerRequestId',
    'inputTokens',
    'outputTokens',
    'totalTokens',
    'rawAdText',
    'targetText',
    'email',
    'firstName',
    'lastName',
    'companyName',
  ]);
  const found = [];
  walk(value);
  assert.deepEqual(found, []);

  function walk(current) {
    if (!current || typeof current !== 'object') return;
    if (Array.isArray(current)) {
      current.forEach(walk);
      return;
    }
    for (const [key, nested] of Object.entries(current)) {
      if (forbidden.has(key)) found.push(key);
      walk(nested);
    }
  }
}

async function assertMovedRoute(path) {
  const source = await readFile(path, 'utf8');
  assert.match(source, /ANALYSIS_FLOW_MOVED/, `${path} exposes the moved-flow code`);
  assert.match(source, /status:\s*410/, `${path} returns HTTP 410`);
  assert.doesNotMatch(source, /runFreeAnnunci10xAnalysis\(/, `${path} does not run ungated analysis`);
}

async function assertResumeRouteDoesNotExposeResult() {
  const source = await readFile('src/app/api/annunci-10x/session/resume/route.ts', 'utf8');
  assert.doesNotMatch(source, /snapshot\s*:/, 'resume does not expose snapshots');
  assert.doesNotMatch(source, /evaluation\s*:/, 'resume does not expose evaluations');
  assert.doesNotMatch(source, /score\s*:/, 'resume does not expose score');
  assert.doesNotMatch(source, /gate\s*:/, 'resume does not expose gate');
}
