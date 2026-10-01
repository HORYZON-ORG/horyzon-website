import assert from 'node:assert/strict';
import {
  MemoryAnnunci10xPersistenceAdapter,
  MockAnnunci10xProvider,
  createFact,
  createProductionGenerationAuthorizationProvider,
  createTestGenerationAuthorizationProvider,
  requestAnnunci10xPremiumEdit,
  resumeAnnunci10xPremiumOutput,
  runAnnunci10xPremiumGeneration,
  sanitizeGenerationClientPayload,
  validateChannelAdapterOutput,
} from '../src/lib/annunci-10x/index.ts';

const now = '2026-09-23T00:00:00.000Z';

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

const confirmed = (value, sourceId) => createFact(value, 'USER_CONFIRMED', { sourceId, publishable: true, confidence: 95 });
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

function makeContext(provider) {
  const persistence = new MemoryAnnunci10xPersistenceAdapter();
  return { persistence, provider, configuredProvider: 'MOCK' };
}

async function createReadySession(context, flow = 'CREATE') {
  const created = await context.persistence.createSession({ flow, selectedChannel: 'LINKEDIN', commercialContext });
  await context.persistence.updateSession({ sessionId: created.session.id, sessionSecret: created.sessionSecret, state: 'PAYMENT_REQUIRED' });
  const snapshot = await context.persistence.appendSnapshot({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    roleCard,
    roleProfile,
    communicationStrategy: { ...strategy, sessionId: created.session.id },
    reason: flow === 'CREATE' ? 'USER_CONFIRMATION' : 'INITIAL_EXTRACTION',
  });
  await context.persistence.updateSession({ sessionId: created.session.id, sessionSecret: created.sessionSecret, currentSnapshotId: snapshot.id });
  if (flow === 'ANALYZE') {
    await context.persistence.saveEvaluation({
      sessionId: created.session.id,
      sessionSecret: created.sessionSecret,
      target: { kind: 'ORIGINAL_AD', originalAdId: 'original-synthetic' },
      targetRef: 'original-synthetic',
      score: {
        value: null,
        max: 100,
        interval: { min: 55, max: 75 },
        coverage: 82,
        checks: Array.from({ length: 20 }, (_, index) => ({
          id: String(index + 1),
          label: `Check ${index + 1}`,
          score: index === 5 ? null : 5,
          maxScore: 5,
          status: index === 5 ? 'NOT_EVALUABLE' : 'PASS',
          evidence: ['synthetic'],
        })),
        rubricVersion: 'annunci10x-rubric-v1',
      },
      gate: { status: 'READY', codes: ['NO_BLOCKERS'], blockingReasons: [], warnings: [], evaluatedAt: now },
    });
  }
  return created;
}

assert.deepEqual(
  sanitizeGenerationClientPayload({
    authorized: true,
    credits: 99,
    paid: true,
    testAuthorization: true,
    reservationId: 'reservation-client-value',
    capability: 'CREATE_CREDIT',
    channel: 'LINKEDIN',
  }),
  { channel: 'LINKEDIN' },
  'browser payload cannot authorize premium generation',
);

{
  const context = makeContext(new MockAnnunci10xProvider('success'));
  const created = await createReadySession(context);
  await assert.rejects(
    () => runAnnunci10xPremiumGeneration({
      sessionId: created.session.id,
      sessionSecret: created.sessionSecret,
      context,
      authorizationProvider: createProductionGenerationAuthorizationProvider(),
    }),
    /Checkout e acquisto Annunci 10x non sono ancora attivi/,
    'production provider denies premium generation before checkout exists',
  );
}

{
  const context = makeContext(new MockAnnunci10xProvider(['success', 'success', 'success', 'success']));
  const created = await createReadySession(context, 'ANALYZE');
  const result = await runAnnunci10xPremiumGeneration({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    context,
    authorizationProvider: createTestGenerationAuthorizationProvider({ credits: 1 }),
  });
  assert.equal(result.provider, 'MOCK');
  assert.equal(result.master.kind, 'MASTER');
  assert.equal(result.channelVariant?.channel, 'LINKEDIN');
  assert.equal(result.operations.map((operation) => operation.type).join('>'), 'GENERATE>VALIDATE>EVALUATE>CHANNEL_ADAPTER');
  assert.equal(result.score.checks.length, 20);
  assert.equal(result.score.rubricVersion, 'annunci10x-rubric-v2');
  assert.equal(result.score.scoreSemanticsVersion, 'annunci10x-score-semantics-v2');
  assert.equal(result.versions.methodVersion, 'annunci10x-method-v2');
  assert.equal(result.versions.rubricVersion, 'annunci10x-rubric-v2');
  assert.equal(result.versions.scoreSemanticsVersion, 'annunci10x-score-semantics-v2');
  assert.equal(result.versions.promptVersion, 'annunci10x-prompts-v2');
  assert.equal(result.comparison?.generatedAdId, result.master.id, 'Analyze path includes comparison');
  assert.equal(JSON.stringify(context.provider.calls).includes('commercialContext'), false, 'generation prompts do not receive commercial context');
  assert.equal(JSON.stringify(context.provider.calls).includes('"payment"'), false, 'generation prompts do not receive payment state');
  const evaluateCall = context.provider.calls.find((call) => call.operationType === 'EVALUATE');
  assert.equal(evaluateCall?.outputSchemaName, 'annunci10x_evaluate_v2', 'premium evaluates generated master through V2 schema');
  assert.equal(evaluateCall?.input?.target?.kind, 'GENERATED_MASTER', 'premium V2 evaluate target is GENERATED_MASTER');
  assert.equal(JSON.stringify(evaluateCall?.input?.target ?? {}).includes('Addetto pulizie'), true, 'premium V2 evaluate target includes generated master text');
  assert.equal(JSON.stringify(evaluateCall?.input?.target ?? {}).includes('roleCard'), false, 'premium V2 evaluate target does not embed role card as fallback evidence');
  const evaluation = await context.persistence.getLatestEvaluation(created.session.id, created.sessionSecret);
  assert.equal(evaluation?.target, 'GENERATED_MASTER');
  assert.equal(evaluation?.score.rubricVersion, 'annunci10x-rubric-v2');
  assert.equal(evaluation?.gate, null, 'V2 evaluation is score-only; publication gate remains separate');
  const resumed = await resumeAnnunci10xPremiumOutput({ sessionId: created.session.id, sessionSecret: created.sessionSecret, context });
  assert.equal(resumed?.outputId, result.outputId, 'premium output resumes from persisted records');
  assert.equal(resumed?.score.rubricVersion, 'annunci10x-rubric-v2', 'resumed premium output preserves V2 score');
  assert.equal(resumed?.gate.status, result.gate.status, 'resumed premium output reads gate from premium payload');
}

{
  const context = makeContext(new MockAnnunci10xProvider([
    'unsupported_claim',
    'unsupported_claim',
    'success',
    'unsupported_claim',
    'success',
    'unsupported_claim',
    'success',
    'success',
  ]));
  const created = await createReadySession(context);
  const result = await runAnnunci10xPremiumGeneration({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    context,
    authorizationProvider: createTestGenerationAuthorizationProvider({ credits: 1 }),
  });
  assert.equal(result.operations.filter((operation) => operation.type === 'REVISE').length, 2, 'automatic repair is bounded to at most two revisions');
  assert.equal(result.master.annunci10xPremium?.automaticRevisionCount, 2, 'premium payload records both bounded automatic revisions');
  assert.equal(result.master.sections.some((section) => section.id === 'confirmed-role-responsibilities' && /Pulizia uffici, corridoi e spazi comuni/i.test(section.body)), true, 'canonical responsibilities survive partial revisions');
  assert.equal(result.master.sections.some((section) => section.id === 'confirmed-role-conditions' && /Bari/i.test(section.body) && /Part-time/i.test(section.body)), true, 'canonical conditions survive partial revisions');
  assert.equal(result.gate.status, 'NEEDS_VERIFICATION', 'residual unsupported claim after the two-revision cap prevents READY');
  assert.ok(result.claimCheck.some((claim) => claim.status === 'UNSUPPORTED'));
}

{
  const context = makeContext(new MockAnnunci10xProvider(['success', 'success', 'success', 'success', 'success', 'success', 'success', 'success']));
  const created = await createReadySession(context);
  await runAnnunci10xPremiumGeneration({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    context,
    authorizationProvider: createTestGenerationAuthorizationProvider({ credits: 2 }),
  });
  const editorial = await requestAnnunci10xPremiumEdit({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    editRequest: 'Rendilo piu sintetico',
    context,
    authorizationProvider: createTestGenerationAuthorizationProvider({ credits: 1 }),
  });
  assert.equal(editorial.status, 'EDITORIAL_REVISED');
  assert.equal(editorial.output?.score.rubricVersion, 'annunci10x-rubric-v2', 'premium editorial edits are re-evaluated with V2');
  const factual = await requestAnnunci10xPremiumEdit({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    editRequest: 'Siamo a Bari, non Lecce',
    targetPath: 'attractionContext.location',
    context,
    authorizationProvider: createTestGenerationAuthorizationProvider({ credits: 1 }),
  });
  assert.equal(factual.status, 'REQUIRES_REGENERATION');
  const unsupported = await requestAnnunci10xPremiumEdit({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    editRequest: 'Scrivi che siamo leader di mercato',
    context,
    authorizationProvider: createTestGenerationAuthorizationProvider({ credits: 1 }),
  });
  assert.equal(unsupported.status, 'CONFIRMATION_REQUIRED');
}

assert.throws(
  () => validateChannelAdapterOutput({
    channelVariant: {
      id: 'variant-bad',
      masterAdId: 'master-1',
      channel: 'LINKEDIN',
      sections: [{ id: 'section-1', type: 'TITLE', key: 'section-1', title: 'Titolo', body: 'Benefit inventato', sourceFactIds: ['answer-title'] }],
      introducedFactIds: ['invented-benefit'],
      adaptedFromMaster: true,
    },
  }),
  /introducedFactIds must be empty/,
  'channel variants cannot introduce new facts',
);

function versions() {
  return {
    dataContractVersion: 'annunci10x-data-contracts-v1',
    methodVersion: 'annunci10x-method-v1',
    rubricVersion: 'annunci10x-rubric-v1',
    strategyVersion: 'annunci10x-strategy-v1',
    promptVersion: 'annunci10x-prompts-v1',
  };
}

console.log('Annunci 10x premium verifier passed');
