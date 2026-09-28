import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  MemoryAnnunci10xPersistenceAdapter,
  MockAnnunci10xProvider,
  createFact,
  createProductionGenerationAuthorizationProvider,
  requestAnnunci10xPremiumEdit,
  resumeAnnunci10xPremiumOutput,
  runAnnunci10xReservationBackedPremiumGeneration,
  sanitizeGenerationClientPayload,
} from '../src/lib/annunci-10x/index.ts';

process.env.ANNUNCI10X_EMAIL_VERIFICATION_PEPPER = `${randomUUID()}${randomUUID()}`;

const now = '2026-09-28T00:00:00.000Z';
const confirmed = (value, sourceId) => createFact(value, 'USER_CONFIRMED', { sourceId, publishable: true, confidence: 95 });

const commercialContext = {
  productCode: 'AD_GENERATION',
  entitlements: {
    guide: false,
    adGeneration: false,
    bundle: false,
    source: 'OPEN_DECISION',
    verification: 'SERVER_VERIFIED',
    checkedAt: now,
    serverAuthorityId: 'annunci10x-open-decision',
  },
  reservedOfferEligible: false,
  reservedOfferReason: 'NONE',
  price: 'OPEN_DECISION',
  discountValue: 'OPEN_DECISION',
};

const roleCard = {
  title: confirmed('Addetto pulizie uffici', 'answer-title'),
  mission: confirmed('Mantenere puliti uffici e spazi comuni', 'answer-mission'),
  outcomes: [confirmed('Garantire spazi ordinati a inizio giornata', 'answer-outcome')],
  responsibilities: [confirmed('Pulizia uffici, corridoi e spazi comuni', 'answer-responsibility')],
  requirements: [{ id: 'req-1', label: confirmed('Precisione e puntualita', 'answer-req'), classification: 'REQUIRED' }],
  compensation: { visibility: confirmed('OPEN_DECISION', 'answer-compensation-visibility') },
  attractionContext: {
    workMode: confirmed('In presenza', 'answer-work-mode'),
    location: confirmed('Bari', 'answer-location'),
    contractType: confirmed('Part-time', 'answer-contract'),
    schedule: confirmed('Mattina dal lunedi al venerdi', 'answer-schedule'),
    attractivenessEvidence: [confirmed('Orari definiti e affiancamento iniziale', 'answer-attraction')],
  },
};

const roleProfile = {
  roleCard,
  rolePopularity: confirmed('UNKNOWN', 'profile-demand'),
  companyAttractiveness: confirmed('MEDIUM', 'profile-company'),
  challengeLevel: confirmed('LOW', 'profile-challenge'),
  routineLevel: confirmed('HIGH', 'profile-routine'),
  qualificationLevel: confirmed('LOW', 'profile-qualification'),
  commitmentLevel: confirmed('MEDIUM', 'profile-commitment'),
  technicality: confirmed('LOW', 'profile-technicality'),
};

const strategy = {
  id: 'strategy-1',
  sessionId: 'session-1',
  summary: 'Puntare su routine chiara, condizioni concrete e affidabilita.',
  candidateAngle: 'Persona affidabile che cerca orari e aspettative definite.',
  emphasis: { challenge: 'LOW', routine: 'HIGH', qualification: 'LOW', commitment: 'MEDIUM', technicality: 'LOW' },
  proofPoints: [confirmed('Pulizia uffici e spazi comuni', 'proof-1')],
  reasons: [{ id: 'reason-1', label: 'La chiarezza operativa riduce aspettative sbagliate.', factIds: ['answer-responsibility'] }],
  riskNotes: [],
  missingFacts: [],
  channelPriorities: ['LINKEDIN'],
  versions: versions(),
};

function makeContext(provider = new MockAnnunci10xProvider('success')) {
  return { persistence: new MemoryAnnunci10xPersistenceAdapter(), provider, configuredProvider: 'MOCK' };
}

async function createPaidReadySession(context, flow) {
  const created = await context.persistence.createSession({ flow, selectedChannel: 'LINKEDIN', commercialContext });
  const session = { sessionId: created.session.id, sessionSecret: created.sessionSecret };
  await context.persistence.updateSession({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    state: flow === 'CREATE' ? 'PAYMENT_REQUIRED' : 'ANALYSIS_READY',
  });
  const snapshot = await context.persistence.appendSnapshot({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    roleCard,
    roleProfile,
    communicationStrategy: { ...strategy, sessionId: session.sessionId },
    reason: flow === 'CREATE' ? 'USER_CONFIRMATION' : 'INITIAL_EXTRACTION',
  });
  await context.persistence.updateSession({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    currentSnapshotId: snapshot.id,
  });
  await verifyLead(context, session);
  await paidPurchase(context, session, flow === 'CREATE' ? 'ANNUNCI10X_CREATE' : 'ANNUNCI10X_REWRITE');
  if (flow === 'ANALYZE') await markAnalysisReady(context, session);
  return { ...session, snapshot };
}

async function verifyLead(context, session) {
  const lead = await context.persistence.saveLead({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    firstName: 'Ada',
    lastName: 'Lovelace',
    companyName: null,
    businessRole: null,
    emailNormalized: `ada.${randomUUID()}@example.com`,
    marketingConsent: false,
    marketingConsentVersion: 'test',
  });
  const verificationId = randomUUID();
  await context.persistence.createEmailVerification({
    id: verificationId,
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    leadId: lead.id,
    emailNormalized: lead.emailNormalized,
    codeHash: 'synthetic-hash',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    maxAttempts: 5,
    pendingGraceSeconds: 1,
  });
  await context.persistence.markEmailVerificationSent(verificationId, session.sessionSecret);
  await context.persistence.verifyEmailCode({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    verificationId,
    codeMatches: true,
  });
}

async function paidPurchase(context, session, offerCode) {
  const lead = await context.persistence.getLead(session.sessionId, session.sessionSecret);
  assert.ok(lead, 'verified lead required before synthetic purchase');
  const purchase = await context.persistence.createOrGetPurchase({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    leadId: lead.id,
    offerCode,
    expectedAmountCents: 700,
    currency: 'EUR',
    stripePriceId: `price_${offerCode.toLowerCase()}`,
  });
  const checkoutId = `cs_${purchase.id.replaceAll('-', '').slice(0, 24)}`;
  await context.persistence.attachCheckoutSession({
    purchaseId: purchase.id,
    sessionSecret: session.sessionSecret,
    stripeCheckoutSessionId: checkoutId,
  });
  return context.persistence.completePaidPurchase({
    purchaseId: purchase.id,
    stripeCheckoutSessionId: checkoutId,
    amountCents: 700,
    currency: 'eur',
    stripePaymentIntentId: `pi_${purchase.id.replaceAll('-', '').slice(0, 24)}`,
  });
}

async function markAnalysisReady(context, session) {
  const evaluation = await context.persistence.saveEvaluation({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    target: { kind: 'ORIGINAL_AD', originalAdId: 'original-synthetic' },
    targetRef: 'original-synthetic',
    score: syntheticScore(64),
    gate: { status: 'READY_WITH_WARNINGS', codes: ['NO_BLOCKERS'], blockingReasons: [], warnings: ['Fixture warning'], evaluatedAt: now },
  });
  const run = await context.persistence.createOrGetAnalysisRun({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    sourceKind: 'PASTED_TEXT',
    sourceStatus: 'READY',
    originalInput: 'Annuncio sintetico completo.',
    targetText: 'Annuncio sintetico completo.',
    targetKind: 'ORIGINAL_AD',
    sourceHash: randomUUID(),
    inputIdentity: randomUUID(),
    methodVersion: 'test-method',
    rubricVersion: 'annunci10x-rubric-v1',
    promptVersion: 'test-prompt',
    scoreSemanticsVersion: 'test-score',
    model: 'mock',
    provider: 'MOCK',
    evaluationMode: 'V2_PUBLIC',
  });
  await context.persistence.updateAnalysisRun({
    analysisRunId: run.id,
    sessionSecret: session.sessionSecret,
    status: 'READY',
    stage: 'COMPLETE',
    sourceStatus: 'READY',
    evaluationId: evaluation.id,
    resultReference: evaluation.id,
    completedAt: now,
  });
}

async function assertFulfillmentOffFailsBeforeSideEffects() {
  const provider = new MockAnnunci10xProvider('success');
  const context = makeContext(provider);
  const session = await createPaidReadySession(context, 'CREATE');
  let reserveCalls = 0;
  const reserveGenerationCredit = context.persistence.reserveGenerationCredit.bind(context.persistence);
  context.persistence.reserveGenerationCredit = (input) => {
    reserveCalls += 1;
    return reserveGenerationCredit(input);
  };
  await assert.rejects(
    () => runAnnunci10xReservationBackedPremiumGeneration({
      sessionId: session.sessionId,
      sessionSecret: session.sessionSecret,
      context,
      fulfillmentEnabled: false,
    }),
    /Generazione temporaneamente non disponibile/,
  );
  assert.equal(reserveCalls, 0, 'fulfillment OFF must not reserve credit');
  assert.equal(provider.calls.length, 0, 'fulfillment OFF must not call AI');
  assert.equal(await context.persistence.getLatestOutput(session.sessionId, session.sessionSecret, 'MASTER'), null);
}

async function assertAnalyzeSuccess() {
  const context = makeContext(new MockAnnunci10xProvider(['success', 'success', 'success', 'success']));
  const session = await createPaidReadySession(context, 'ANALYZE');
  const result = await runAnnunci10xReservationBackedPremiumGeneration({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    context,
    fulfillmentEnabled: true,
  });
  assert.equal(result.provider, 'MOCK');
  assert.equal(result.master.kind, 'MASTER');
  assert.equal(result.channelVariant?.channel, 'LINKEDIN');
  assert.equal(result.operations.map((operation) => operation.type).join('>'), 'GENERATE>VALIDATE>EVALUATE>CHANNEL_ADAPTER');
  const reservation = await context.persistence.getLatestConsumedGenerationReservation(session.sessionId, session.sessionSecret, 'REWRITE_CREDIT');
  assert.equal(reservation?.status, 'CONSUMED');
  assert.equal(reservation?.outputId, result.outputId);
  const resumed = await resumeAnnunci10xPremiumOutput({ sessionId: session.sessionId, sessionSecret: session.sessionSecret, context, fulfillmentEnabled: true });
  assert.equal(resumed?.outputId, result.outputId);
  assert.equal((await context.persistence.getSession(session.sessionId, session.sessionSecret))?.state, 'ANALYSIS_READY');
  assert.equal((await context.persistence.getEffectiveEntitlements(session.sessionId, session.sessionSecret)).rewriteCredits, 0);
}

async function assertCreateSuccess() {
  const context = makeContext(new MockAnnunci10xProvider(['success', 'success', 'success', 'success']));
  const session = await createPaidReadySession(context, 'CREATE');
  const result = await runAnnunci10xReservationBackedPremiumGeneration({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    context,
    fulfillmentEnabled: true,
  });
  const reservation = await context.persistence.getLatestConsumedGenerationReservation(session.sessionId, session.sessionSecret, 'CREATE_CREDIT');
  assert.equal(reservation?.outputId, result.outputId);
  assert.equal((await context.persistence.getEffectiveEntitlements(session.sessionId, session.sessionSecret)).createCredits, 0);
  assert.ok(['OUTPUT_READY', 'NEEDS_VERIFICATION'].includes((await context.persistence.getSession(session.sessionId, session.sessionSecret))?.state ?? ''));
}

async function assertAiFailureReleasesCredit() {
  const context = makeContext(new MockAnnunci10xProvider('provider_error'));
  const session = await createPaidReadySession(context, 'CREATE');
  await assert.rejects(
    () => runAnnunci10xReservationBackedPremiumGeneration({
      sessionId: session.sessionId,
      sessionSecret: session.sessionSecret,
      context,
      fulfillmentEnabled: true,
    }),
    /Generazione temporaneamente non disponibile/,
  );
  assert.equal((await context.persistence.getEffectiveEntitlements(session.sessionId, session.sessionSecret)).createCredits, 1);
  assert.equal(await resumeAnnunci10xPremiumOutput({ sessionId: session.sessionId, sessionSecret: session.sessionSecret, context, fulfillmentEnabled: true }), null);
  assert.equal((await context.persistence.getSession(session.sessionId, session.sessionSecret))?.state, 'ENTITLED');
}

async function assertMidPipelineFailureLeavesOrphanUndeliverable() {
  const context = makeContext(new MockAnnunci10xProvider(['success', 'success', 'success', 'provider_error']));
  const session = await createPaidReadySession(context, 'CREATE');
  await assert.rejects(
    () => runAnnunci10xReservationBackedPremiumGeneration({
      sessionId: session.sessionId,
      sessionSecret: session.sessionSecret,
      context,
      fulfillmentEnabled: true,
    }),
    /Generazione temporaneamente non disponibile/,
  );
  assert.ok(await context.persistence.getLatestOutput(session.sessionId, session.sessionSecret, 'MASTER'), 'mid-pipeline fixture leaves an orphan master');
  assert.equal(await resumeAnnunci10xPremiumOutput({ sessionId: session.sessionId, sessionSecret: session.sessionSecret, context, fulfillmentEnabled: true }), null);
  assert.equal((await context.persistence.getEffectiveEntitlements(session.sessionId, session.sessionSecret)).createCredits, 1);
}

async function assertConsumeFailureReleasesCredit() {
  const context = makeContext(new MockAnnunci10xProvider(['success', 'success', 'success', 'success']));
  const session = await createPaidReadySession(context, 'CREATE');
  const consumeGenerationCredit = context.persistence.consumeGenerationCredit.bind(context.persistence);
  context.persistence.consumeGenerationCredit = async () => {
    throw new Error('synthetic consume failure');
  };
  await assert.rejects(
    () => runAnnunci10xReservationBackedPremiumGeneration({
      sessionId: session.sessionId,
      sessionSecret: session.sessionSecret,
      context,
      fulfillmentEnabled: true,
    }),
    /Completa l'acquisto/,
  );
  context.persistence.consumeGenerationCredit = consumeGenerationCredit;
  assert.equal((await context.persistence.getEffectiveEntitlements(session.sessionId, session.sessionSecret)).createCredits, 1);
  assert.equal(await resumeAnnunci10xPremiumOutput({ sessionId: session.sessionId, sessionSecret: session.sessionSecret, context, fulfillmentEnabled: true }), null);
}

async function assertRetryAfterSuccessIsIdempotent() {
  const provider = new MockAnnunci10xProvider(['success', 'success', 'success', 'success']);
  const context = makeContext(provider);
  const session = await createPaidReadySession(context, 'CREATE');
  const first = await runAnnunci10xReservationBackedPremiumGeneration({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    context,
    fulfillmentEnabled: true,
  });
  const callsAfterFirst = provider.calls.length;
  const second = await runAnnunci10xReservationBackedPremiumGeneration({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    context,
    fulfillmentEnabled: true,
  });
  assert.equal(second.outputId, first.outputId);
  assert.equal(provider.calls.length, callsAfterFirst);
}

async function assertConcurrentGenerateConsumesOnce() {
  const provider = new SlowMockProvider(['success', 'success', 'success', 'success', 'success', 'success', 'success', 'success']);
  const context = makeContext(provider);
  const session = await createPaidReadySession(context, 'CREATE');
  const attempts = await Promise.allSettled([
    runAnnunci10xReservationBackedPremiumGeneration({ sessionId: session.sessionId, sessionSecret: session.sessionSecret, context, fulfillmentEnabled: true }),
    runAnnunci10xReservationBackedPremiumGeneration({ sessionId: session.sessionId, sessionSecret: session.sessionSecret, context, fulfillmentEnabled: true }),
  ]);
  assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
  assert.equal(attempts.filter((attempt) => attempt.status === 'rejected').length, 1);
  const fulfilled = attempts.find((attempt) => attempt.status === 'fulfilled')?.value;
  assert.ok(fulfilled);
  const reservation = await context.persistence.getLatestConsumedGenerationReservation(session.sessionId, session.sessionSecret, 'CREATE_CREDIT');
  assert.equal(reservation?.outputId, fulfilled.outputId);
  assert.equal((await context.persistence.getEffectiveEntitlements(session.sessionId, session.sessionSecret)).createCredits, 0);
  const resumed = await resumeAnnunci10xPremiumOutput({ sessionId: session.sessionId, sessionSecret: session.sessionSecret, context, fulfillmentEnabled: true });
  assert.equal(resumed?.outputId, fulfilled.outputId);
}

async function assertOutputExactnessIgnoresNewerOrphan() {
  const context = makeContext(new MockAnnunci10xProvider(['success', 'success', 'success', 'success']));
  const session = await createPaidReadySession(context, 'CREATE');
  const first = await runAnnunci10xReservationBackedPremiumGeneration({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    context,
    fulfillmentEnabled: true,
  });
  const orphanMaster = { ...first.master, id: randomUUID(), sections: [{ ...first.master.sections[0], body: 'Output orfano piu recente.' }] };
  const orphan = await context.persistence.saveOutput({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    snapshotId: first.snapshotId,
    outputType: 'MASTER',
    generatedContent: orphanMaster,
    validationState: 'NEEDS_VERIFICATION',
  });
  await context.persistence.saveEvaluation({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    target: { kind: 'GENERATED_MASTER', generatedAdId: orphanMaster.id },
    targetRef: orphanMaster.id,
    targetOutputId: orphan.id,
    score: syntheticScore(11),
    gate: { status: 'NEEDS_VERIFICATION', codes: ['NEEDS_USER_CONFIRMATION'], blockingReasons: [], warnings: ['Orphan warning'], evaluatedAt: now },
  });
  const resumed = await resumeAnnunci10xPremiumOutput({ sessionId: session.sessionId, sessionSecret: session.sessionSecret, context, fulfillmentEnabled: true });
  assert.equal(resumed?.outputId, first.outputId);
  assert.equal(resumed?.score.value, first.score.value);
}

async function assertEditStillProductionBlocked() {
  const context = makeContext(new MockAnnunci10xProvider(['success', 'success', 'success', 'success']));
  const session = await createPaidReadySession(context, 'CREATE');
  await runAnnunci10xReservationBackedPremiumGeneration({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    context,
    fulfillmentEnabled: true,
  });
  await assert.rejects(
    () => requestAnnunci10xPremiumEdit({
      sessionId: session.sessionId,
      sessionSecret: session.sessionSecret,
      editRequest: 'Rendilo piu sintetico',
      context,
      authorizationProvider: createProductionGenerationAuthorizationProvider(),
    }),
    /Checkout e acquisto Annunci 10x non sono ancora attivi/,
  );
}

function assertClientTamperingIgnored() {
  assert.deepEqual(
    sanitizeGenerationClientPayload({
      authorized: true,
      credits: 99,
      paid: true,
      testAuthorization: true,
      reservationId: randomUUID(),
      capability: 'CREATE_CREDIT',
      channel: 'LINKEDIN',
    }),
    { channel: 'LINKEDIN' },
  );
}

class SlowMockProvider extends MockAnnunci10xProvider {
  async executeStructuredTask(request) {
    if (request.operationType === 'GENERATE') await new Promise((resolve) => setTimeout(resolve, 30));
    return super.executeStructuredTask(request);
  }
}

function syntheticScore(value) {
  return {
    value,
    max: 100,
    interval: null,
    coverage: 100,
    checks: Array.from({ length: 20 }, (_, index) => ({
      id: String(index + 1).padStart(2, '0'),
      label: `Check ${index + 1}`,
      score: index < 10 ? Math.min(5, Math.max(0, Math.round(value / 20))) : 3,
      maxScore: 5,
      status: 'PASS',
      evidence: ['synthetic'],
    })),
    rubricVersion: 'annunci10x-rubric-v1',
  };
}

function versions() {
  return {
    dataContractVersion: 'annunci10x-data-contracts-v1',
    methodVersion: 'annunci10x-method-v1',
    rubricVersion: 'annunci10x-rubric-v1',
    strategyVersion: 'annunci10x-strategy-v1',
    promptVersion: 'annunci10x-prompts-v1',
  };
}

await assertFulfillmentOffFailsBeforeSideEffects();
await assertAnalyzeSuccess();
await assertCreateSuccess();
await assertAiFailureReleasesCredit();
await assertMidPipelineFailureLeavesOrphanUndeliverable();
await assertConsumeFailureReleasesCredit();
await assertRetryAfterSuccessIsIdempotent();
await assertConcurrentGenerateConsumesOnce();
await assertOutputExactnessIgnoresNewerOrphan();
await assertEditStillProductionBlocked();
assertClientTamperingIgnored();

console.log('Annunci 10x fulfillment verifier passed');
