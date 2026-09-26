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
let capturedVerifyInput = null;
const originalVerifyEmailCode = context.persistence.verifyEmailCode.bind(context.persistence);
context.persistence.verifyEmailCode = async (input) => {
  capturedVerifyInput = input;
  return originalVerifyEmailCode(input);
};
await assert.rejects(
  () => verifyAnnunci10xEmailCode({ session, context, code: '000000' === firstCode ? '000001' : '000000', requestFingerprint: 'constant-time-false', env: process.env }),
  (error) => error instanceof Annunci10xPublicError && error.code === 'VERIFICATION_INVALID',
);
assert.equal(capturedVerifyInput.verificationId, active.id, 'runtime verifies the exact active verification');
assert.equal(capturedVerifyInput.codeMatches, false, 'runtime compare result is authoritative for wrong code');
assert.equal('codeHash' in capturedVerifyInput, false, 'candidate hash is not passed to persistence verification');
active = await context.persistence.getActiveEmailVerification(session.sessionId, session.sessionSecret);
assert.equal(active.attemptCount, 2);

const runningRun = await createRun(context, session, 'RUNNING');
capturedVerifyInput = null;
let verified = await verifyAnnunci10xEmailCode({ session, context, code: firstCode, analysisRunId: runningRun.id, requestFingerprint: '127.0.0.1', env: process.env });
assert.equal(capturedVerifyInput.verificationId, active.id, 'runtime keeps the same verification id for a matching code');
assert.equal(capturedVerifyInput.codeMatches, true, 'runtime compare result is authoritative for correct code');
context.persistence.verifyEmailCode = originalVerifyEmailCode;
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
  pendingGraceSeconds: 15,
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
  pendingGraceSeconds: 15,
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

await runConcurrencyAndSecurityHardeningChecks();

console.log('Annunci 10x lead verification verifier passed');

async function runConcurrencyAndSecurityHardeningChecks() {
  const concurrencyContext = makeContext({ emailProvider: makeDelayedEmailProvider() });
  const concurrencyCreated = await createAnonymousAnalyzeSession(concurrencyContext);
  const concurrencySession = { sessionId: concurrencyCreated.session.id, sessionSecret: concurrencyCreated.sessionSecret };
  await saveAnnunci10xLeadContact({
    session: concurrencySession,
    context: concurrencyContext,
    firstName: 'Katherine',
    lastName: 'Johnson',
    companyName: 'Horyzon',
    businessRole: 'HR',
    email: 'katherine@example.com',
  });
  const concurrentResults = await Promise.all([
    requestAnnunci10xEmailVerification({ session: concurrencySession, context: concurrencyContext, provider: concurrencyContext.emailProvider, requestFingerprint: 'concurrent', env: process.env }),
    requestAnnunci10xEmailVerification({ session: concurrencySession, context: concurrencyContext, provider: concurrencyContext.emailProvider, requestFingerprint: 'concurrent', env: process.env }),
  ]);
  assert.equal(concurrencyContext.emailProvider.sent.length, 1, 'concurrent requests send at most one OTP');
  assert.equal(concurrentResults.filter((item) => item.sent).length, 1, 'only one concurrent request reports sent');
  assert.equal(concurrentResults.filter((item) => !item.sent).length, 1, 'duplicate concurrent request is safely deferred');
  const concurrencyOpen = await concurrencyContext.persistence.getOpenEmailVerification(concurrencySession.sessionId, concurrencySession.sessionSecret);
  assert.equal(concurrencyOpen.status, 'SENT', 'single concurrent verification is sent');

  const raceContext = makeContext();
  const race = await createContactSession(raceContext, 'dorothy@example.com');
  const first = await createPendingVerification(raceContext, race.session, 'dorothy@example.com', '123456');
  await raceContext.persistence.markEmailVerificationSent(first.id, race.session.sessionSecret);
  const second = await createPendingVerification(raceContext, race.session, 'dorothy@example.com', '654321');
  await raceContext.persistence.markEmailVerificationSent(second.id, race.session.sessionSecret);
  const oldCodeResult = await raceContext.persistence.verifyEmailCode({
    sessionId: race.session.sessionId,
    sessionSecret: race.session.sessionSecret,
    verificationId: first.id,
    codeMatches: true,
  });
  assert.equal(oldCodeResult.outcome, 'VERIFICATION_INVALID', 'old verification id cannot verify after resend invalidation');
  const raceActive = await raceContext.persistence.getActiveEmailVerification(race.session.sessionId, race.session.sessionSecret);
  assert.equal(raceActive.id, second.id, 'new verification remains active after old-code replay');
  assert.equal(raceActive.attemptCount, 0, 'old-code replay does not increment the new OTP attempts');
  assert.equal((await raceContext.persistence.getLead(race.session.sessionId, race.session.sessionSecret)).emailVerifiedAt, null);

  const transitionContext = makeContext();
  const transition = await createContactSession(transitionContext, 'mary@example.com');
  const pendingToSent = await createPendingVerification(transitionContext, transition.session, 'mary@example.com', '111111');
  assert.equal((await transitionContext.persistence.markEmailVerificationSent(pendingToSent.id, transition.session.sessionSecret)).status, 'SENT');
  await assert.rejects(
    () => transitionContext.persistence.markEmailVerificationFailed(pendingToSent.id, transition.session.sessionSecret),
    /transition|failed/i,
    'SENT cannot transition to FAILED_SEND',
  );

  const pendingToFailed = await createPendingVerification(transitionContext, transition.session, 'mary@example.com', '222222');
  assert.equal((await transitionContext.persistence.markEmailVerificationFailed(pendingToFailed.id, transition.session.sessionSecret)).status, 'FAILED_SEND');
  await assert.rejects(
    () => transitionContext.persistence.markEmailVerificationSent(pendingToFailed.id, transition.session.sessionSecret),
    /transition|sent/i,
    'FAILED_SEND cannot transition to SENT',
  );

  const invalidated = await createPendingVerification(transitionContext, transition.session, 'mary@example.com', '333333');
  await createPendingVerification(transitionContext, transition.session, 'mary@example.com', '444444');
  await assert.rejects(
    () => transitionContext.persistence.markEmailVerificationSent(invalidated.id, transition.session.sessionSecret),
    /transition|sent/i,
    'INVALIDATED cannot transition to SENT',
  );

  const consumed = await createPendingVerification(transitionContext, transition.session, 'mary@example.com', '555555');
  await transitionContext.persistence.markEmailVerificationSent(consumed.id, transition.session.sessionSecret);
  const consumedResult = await transitionContext.persistence.verifyEmailCode({
    sessionId: transition.session.sessionId,
    sessionSecret: transition.session.sessionSecret,
    verificationId: consumed.id,
    codeMatches: true,
  });
  assert.equal(consumedResult.outcome, 'VERIFIED');
  await assert.rejects(
    () => transitionContext.persistence.markEmailVerificationSent(consumed.id, transition.session.sessionSecret),
    /transition|sent/i,
    'CONSUMED cannot transition back to SENT',
  );

  const maxContext = makeContext();
  const max = await createContactSession(maxContext, 'max@example.com');
  const limited = await createPendingVerification(maxContext, max.session, 'max@example.com', '121212', 2);
  await maxContext.persistence.markEmailVerificationSent(limited.id, max.session.sessionSecret);
  assert.equal((await maxContext.persistence.verifyEmailCode({ sessionId: max.session.sessionId, sessionSecret: max.session.sessionSecret, verificationId: limited.id, codeMatches: false })).outcome, 'VERIFICATION_INVALID');
  assert.equal((await maxContext.persistence.verifyEmailCode({ sessionId: max.session.sessionId, sessionSecret: max.session.sessionSecret, verificationId: limited.id, codeMatches: false })).outcome, 'MAX_ATTEMPTS_REACHED');
  assert.equal((await maxContext.persistence.verifyEmailCode({ sessionId: max.session.sessionId, sessionSecret: max.session.sessionSecret, verificationId: limited.id, codeMatches: true })).outcome, 'VERIFICATION_INVALID');

  const consentContext = makeContext();
  const consentCreated = await createAnonymousAnalyzeSession(consentContext);
  const consentSession = { sessionId: consentCreated.session.id, sessionSecret: consentCreated.sessionSecret };
  const consentInput = {
    sessionId: consentSession.sessionId,
    sessionSecret: consentSession.sessionSecret,
    firstName: 'Sophie',
    lastName: 'Wilson',
    companyName: 'Horyzon',
    businessRole: 'OTHER',
    emailNormalized: 'sophie@example.com',
    marketingConsent: true,
  };
  const v1 = await consentContext.persistence.saveLead({ ...consentInput, marketingConsentVersion: 'annunci10x-marketing-consent-v1' });
  await delay(5);
  const v1Again = await consentContext.persistence.saveLead({ ...consentInput, marketingConsentVersion: 'annunci10x-marketing-consent-v1' });
  assert.equal(v1Again.marketingConsentAt, v1.marketingConsentAt, 'same marketing consent version keeps the original timestamp');
  await delay(5);
  const v2 = await consentContext.persistence.saveLead({ ...consentInput, marketingConsentVersion: 'annunci10x-marketing-consent-v2' });
  assert.notEqual(v2.marketingConsentAt, v1.marketingConsentAt, 'new marketing consent version records a new timestamp');
  assert.equal(v2.marketingConsentVersion, 'annunci10x-marketing-consent-v2');
}

function makeContext(options = {}) {
  return {
    persistence: new MemoryAnnunci10xPersistenceAdapter(),
    provider: { run: async () => { throw new Error('not used'); } },
    configuredProvider: 'MOCK',
    emailProvider: options.emailProvider ?? new MockAnnunci10xEmailProvider(),
  };
}

async function createContactSession(context, email) {
  const created = await createAnonymousAnalyzeSession(context);
  const session = { sessionId: created.session.id, sessionSecret: created.sessionSecret };
  const saved = await saveAnnunci10xLeadContact({
    session,
    context,
    firstName: 'Test',
    lastName: 'User',
    companyName: 'Horyzon',
    businessRole: 'HR',
    email,
  });
  return { session, lead: saved.lead };
}

async function createPendingVerification(context, session, email, code, maxAttempts = 5) {
  const lead = await context.persistence.getLead(session.sessionId, session.sessionSecret);
  const id = randomUUID();
  await context.persistence.createEmailVerification({
    id,
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    leadId: lead.id,
    emailNormalized: email,
    codeHash: hashEmailVerificationCode(TEST_PEPPER, id, email, code),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    maxAttempts,
    pendingGraceSeconds: 0,
  });
  return { id, code };
}

function makeDelayedEmailProvider() {
  return {
    kind: 'MOCK',
    sent: [],
    async sendVerificationCode(input) {
      await delay(10);
      this.sent.push(input);
      return { providerRequestId: `delayed-${this.sent.length}` };
    },
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
