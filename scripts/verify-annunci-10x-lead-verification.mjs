import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

process.env.ANNUNCI10X_EMAIL_PROVIDER = 'MOCK';
const TEST_PEPPER = `${randomUUID()}${randomUUID()}`;
process.env.ANNUNCI10X_EMAIL_VERIFICATION_PEPPER = TEST_PEPPER;

const {
  Annunci10xPublicError,
  MemoryAnnunci10xPersistenceAdapter,
  MockAnnunci10xEmailProvider,
  constantTimeHashEquals,
  createAnonymousAnalyzeSession,
  createAnnunci10xEmailProvider,
  generateSixDigitOtp,
  getAnnunci10xResultEligibility,
  hashEmailVerificationCode,
  requestAnnunci10xEmailVerification,
  saveAnnunci10xLeadContact,
  verifyAnnunci10xEmailCode,
} = await import('../src/lib/annunci-10x/index.ts');

const context = makeContext();
const created = await createAnonymousAnalyzeSession(context);
const session = { sessionId: created.session.id, sessionSecret: created.sessionSecret };

const saved = await saveAnnunci10xLeadContact({
  session,
  context,
  firstName: '  Ada ',
  lastName: ' Lovelace ',
  companyName: ' Horyzon Test ',
  businessRole: 'HR',
  email: ' ADA.LOVELACE@EXAMPLE.COM ',
  marketingConsent: false,
  phone: '+390000000000',
});
assert.equal(saved.contactSaved, true);
assert.equal(saved.verificationRequired, true);
assert.equal(saved.emailVerified, false);
let lead = await context.persistence.getLead(session.sessionId, session.sessionSecret);
assert.equal(lead.firstName, 'Ada');
assert.equal(lead.lastName, 'Lovelace');
assert.equal(lead.companyName, 'Horyzon Test');
assert.equal(lead.businessRole, 'HR');
assert.equal(lead.emailNormalized, 'ada.lovelace@example.com');
assert.equal(lead.marketingConsent, false);
assert.equal(lead.marketingConsentAt, null);
assert.equal('phone' in lead, false);

const resubmitted = await saveAnnunci10xLeadContact({
  session,
  context,
  firstName: 'Ada',
  lastName: 'Lovelace',
  companyName: 'Horyzon Test',
  businessRole: 'HR',
  email: 'ada.lovelace@example.com',
  marketingConsent: true,
});
assert.equal(resubmitted.lead.id, lead.id, 'identical resubmit updates same lead');
assert.equal(resubmitted.lead.marketingConsent, true);
assert.ok(resubmitted.lead.marketingConsentAt);

await assert.rejects(
  () => saveAnnunci10xLeadContact({ session, context, firstName: 'Ada', lastName: 'Lovelace', companyName: 'Horyzon', businessRole: 'CEO', email: 'ada@example.com' }),
  /Ruolo aziendale non valido/,
);
await assert.rejects(
  () => saveAnnunci10xLeadContact({ session, context, firstName: 'Ada', lastName: 'Lovelace', companyName: 'Horyzon', businessRole: 'HR', email: 'not-an-email' }),
  /Email aziendale non valida/,
);

for (let index = 0; index < 10; index += 1) assert.match(generateSixDigitOtp(), /^\d{6}$/);
assert.notEqual(
  hashEmailVerificationCode(TEST_PEPPER, 'v1', 'ada@example.com', '004219'),
  hashEmailVerificationCode(TEST_PEPPER, 'v1', 'ada@example.com', '4219'),
  'leading zero is part of the OTP value',
);
const hmac = hashEmailVerificationCode(TEST_PEPPER, 'v1', 'ada@example.com', '004219');
assert.equal(constantTimeHashEquals(hmac, hmac), true);

const firstRequest = await requestAnnunci10xEmailVerification({
  session,
  context,
  provider: context.emailProvider,
  requestFingerprint: '127.0.0.1',
  env: process.env,
});
assert.deepEqual(Object.keys(firstRequest).sort(), ['expiresInSeconds', 'resendAfterSeconds', 'sent']);
assert.equal(firstRequest.sent, true);
assert.equal(context.emailProvider.sent.length, 1);
const firstCode = context.emailProvider.sent[0].code;
assert.match(firstCode, /^\d{6}$/);
let active = await context.persistence.getActiveEmailVerification(session.sessionId, session.sessionSecret);
assert.ok(active);
assert.notEqual(active.codeHash, firstCode, 'plain OTP is never stored');
assert.match(active.codeHash, /^[0-9a-f]{64}$/);

const cooldown = await requestAnnunci10xEmailVerification({
  session,
  context,
  provider: context.emailProvider,
  requestFingerprint: '127.0.0.1',
  env: process.env,
});
assert.equal(cooldown.sent, false, 'resend inside cooldown does not send');
assert.equal(context.emailProvider.sent.length, 1);

await assert.rejects(
  () => verifyAnnunci10xEmailCode({ session, context, code: '000000' === firstCode ? '000001' : '000000', requestFingerprint: '127.0.0.1', env: process.env }),
  (error) => error instanceof Annunci10xPublicError && error.code === 'VERIFICATION_INVALID',
);
active = await context.persistence.getActiveEmailVerification(session.sessionId, session.sessionSecret);
assert.equal(active.attemptCount, 1);

const runningRun = await createRun(context, session, 'RUNNING');
let verified = await verifyAnnunci10xEmailCode({ session, context, code: firstCode, analysisRunId: runningRun.id, requestFingerprint: '127.0.0.1', env: process.env });
assert.equal(verified.verified, true);
assert.equal(verified.resultEligible, false, 'RUNNING + verified is not eligible');
lead = await context.persistence.getLead(session.sessionId, session.sessionSecret);
assert.ok(lead.emailVerifiedAt);
assert.equal(await context.persistence.getActiveEmailVerification(session.sessionId, session.sessionSecret), null, 'consumed code is not active');

await assert.rejects(
  () => verifyAnnunci10xEmailCode({ session, context, code: firstCode, analysisRunId: runningRun.id, requestFingerprint: '127.0.0.1', env: process.env }),
  (error) => error instanceof Annunci10xPublicError && error.code === 'VERIFICATION_INVALID',
  'consumed code is rejected',
);

const readyRun = await createRun(context, session, 'READY');
let eligibility = await getAnnunci10xResultEligibility({ session, context, analysisRunId: readyRun.id });
assert.deepEqual(eligibility, { analysisReady: true, emailVerified: true, resultEligible: true });

await saveAnnunci10xLeadContact({
  session,
  context,
  firstName: 'Ada',
  lastName: 'Lovelace',
  companyName: 'Horyzon Test',
  businessRole: 'HR',
  email: 'ada.changed@example.com',
  marketingConsent: true,
});
eligibility = await getAnnunci10xResultEligibility({ session, context, analysisRunId: readyRun.id });
assert.deepEqual(eligibility, { analysisReady: true, emailVerified: false, resultEligible: false }, 'email change resets verification');

const secondRequest = await requestAnnunci10xEmailVerification({ session, context, provider: context.emailProvider, requestFingerprint: '127.0.0.1', env: process.env });
assert.equal(secondRequest.sent, true);
const secondCode = context.emailProvider.sent.at(-1).code;
const newActive = await context.persistence.getActiveEmailVerification(session.sessionId, session.sessionSecret);
assert.ok(newActive);
assert.notEqual(newActive.id, active.id, 'resend after email change creates a new verification');

for (let index = 0; index < 5; index += 1) {
  await assert.rejects(
    () => verifyAnnunci10xEmailCode({ session, context, code: '999999' === secondCode ? '999998' : '999999', requestFingerprint: `brute-${index}`, env: process.env }),
    Annunci10xPublicError,
  );
}
assert.equal(await context.persistence.getActiveEmailVerification(session.sessionId, session.sessionSecret), null, 'max attempts invalidates active OTP');

const expiredId = randomUUID();
await context.persistence.createEmailVerification({
  id: expiredId,
  sessionId: session.sessionId,
  sessionSecret: session.sessionSecret,
  leadId: (await context.persistence.getLead(session.sessionId, session.sessionSecret)).id,
  emailNormalized: 'ada.changed@example.com',
  codeHash: hashEmailVerificationCode(TEST_PEPPER, expiredId, 'ada.changed@example.com', '111111'),
  expiresAt: new Date(Date.now() - 1000).toISOString(),
  maxAttempts: 5,
});
await context.persistence.markEmailVerificationSent(expiredId, session.sessionSecret);
await assert.rejects(
  () => verifyAnnunci10xEmailCode({ session, context, code: '111111', requestFingerprint: 'expired', env: process.env }),
  (error) => error instanceof Annunci10xPublicError && error.code === 'VERIFICATION_EXPIRED',
);

await assert.rejects(
  () => requestAnnunci10xEmailVerification({ session, context, provider: context.emailProvider, requestFingerprint: 'missing-pepper', env: { NODE_ENV: 'test' } }),
  (error) => error instanceof Annunci10xPublicError && error.code === 'EMAIL_VERIFICATION_UNAVAILABLE',
);
assert.throws(
  () => createAnnunci10xEmailProvider({ NODE_ENV: 'production', ANNUNCI10X_EMAIL_PROVIDER: 'MOCK' }),
  /Provider email non disponibile/,
);

const limitContext = makeContext();
const limitCreated = await createAnonymousAnalyzeSession(limitContext);
const limitSession = { sessionId: limitCreated.session.id, sessionSecret: limitCreated.sessionSecret };
await saveAnnunci10xLeadContact({ session: limitSession, context: limitContext, firstName: 'Alan', lastName: 'Turing', companyName: 'Horyzon', businessRole: 'CONSULTANT', email: 'alan@example.com' });
const limitRun = await createRun(limitContext, limitSession, 'RUNNING');
for (let index = 0; index < 5; index += 1) {
  await requestAnnunci10xEmailVerification({ session: limitSession, context: limitContext, provider: limitContext.emailProvider, requestFingerprint: 'send-limit', env: process.env });
  const code = limitContext.emailProvider.sent.at(-1).code;
  await getAnnunci10xResultEligibility({ session: limitSession, context: limitContext, analysisRunId: limitRun.id });
  await verifyAnnunci10xEmailCode({ session: limitSession, context: limitContext, code, analysisRunId: limitRun.id, requestFingerprint: `send-limit-verify-${index}`, env: process.env });
}
await assert.rejects(
  () => requestAnnunci10xEmailVerification({ session: limitSession, context: limitContext, provider: limitContext.emailProvider, requestFingerprint: 'send-limit', env: process.env }),
  (error) => error instanceof Annunci10xPublicError && error.code === 'RATE_LIMITED',
  'send rate limit is persistent and not affected by eligibility polling',
);

const unverifiedContext = makeContext();
const unverifiedSessionCreated = await createAnonymousAnalyzeSession(unverifiedContext);
const unverifiedSession = { sessionId: unverifiedSessionCreated.session.id, sessionSecret: unverifiedSessionCreated.sessionSecret };
await saveAnnunci10xLeadContact({ session: unverifiedSession, context: unverifiedContext, firstName: 'Grace', lastName: 'Hopper', companyName: 'Horyzon', businessRole: 'OWNER_ENTREPRENEUR', email: 'grace@example.com' });
const unverifiedReady = await createRun(unverifiedContext, unverifiedSession, 'READY');
assert.deepEqual(await getAnnunci10xResultEligibility({ session: unverifiedSession, context: unverifiedContext, analysisRunId: unverifiedReady.id }), {
  analysisReady: true,
  emailVerified: false,
  resultEligible: false,
});
const failedRun = await createRun(unverifiedContext, unverifiedSession, 'FAILED');
const verifiedLeadId = randomUUID();
await unverifiedContext.persistence.createEmailVerification({
  id: verifiedLeadId,
  sessionId: unverifiedSession.sessionId,
  sessionSecret: unverifiedSession.sessionSecret,
  leadId: (await unverifiedContext.persistence.getLead(unverifiedSession.sessionId, unverifiedSession.sessionSecret)).id,
  emailNormalized: 'grace@example.com',
  codeHash: hashEmailVerificationCode(TEST_PEPPER, verifiedLeadId, 'grace@example.com', '222222'),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  maxAttempts: 5,
});
await unverifiedContext.persistence.markEmailVerificationSent(verifiedLeadId, unverifiedSession.sessionSecret);
await verifyAnnunci10xEmailCode({ session: unverifiedSession, context: unverifiedContext, code: '222222', analysisRunId: failedRun.id, requestFingerprint: 'grace', env: process.env });
assert.deepEqual(await getAnnunci10xResultEligibility({ session: unverifiedSession, context: unverifiedContext, analysisRunId: failedRun.id }), {
  analysisReady: false,
  emailVerified: true,
  resultEligible: false,
});
const noReferenceRun = await createRun(unverifiedContext, unverifiedSession, 'READY', false);
assert.equal((await getAnnunci10xResultEligibility({ session: unverifiedSession, context: unverifiedContext, analysisRunId: noReferenceRun.id })).resultEligible, false);
await assert.rejects(
  () => getAnnunci10xResultEligibility({ session, context: unverifiedContext, analysisRunId: unverifiedReady.id }),
  /ownership/i,
  'run from another session is denied',
);

console.log('Annunci 10x lead verification verifier passed');

function makeContext() {
  return {
    persistence: new MemoryAnnunci10xPersistenceAdapter(),
    provider: { run: async () => { throw new Error('not used'); } },
    configuredProvider: 'MOCK',
    emailProvider: new MockAnnunci10xEmailProvider(),
  };
}

async function createRun(context, session, status, withReference = true) {
  const run = await context.persistence.createOrGetAnalysisRun({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    sourceKind: 'PASTED_TEXT',
    sourceStatus: 'READY',
    originalInput: `Annuncio sintetico ${randomUUID()}`,
    targetText: 'Annuncio sintetico valido per test contact e eligibility.',
    targetKind: 'ORIGINAL_AD',
    sourceHash: 'b'.repeat(64),
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
    evaluationId: status === 'READY' && withReference ? randomUUID() : null,
    resultReference: status === 'READY' && withReference ? `evaluation-${randomUUID()}` : null,
    completedAt: status === 'READY' ? new Date().toISOString() : null,
    errorPayload: status === 'FAILED' ? { code: 'TEST_FAILURE' } : null,
    failedAt: status === 'FAILED' ? new Date().toISOString() : null,
  });
}
