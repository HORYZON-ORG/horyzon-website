import assert from 'node:assert/strict';
import {
  ANNUNCI10X_PROMPT_PACK_VERSION,
  ANNUNCI10X_RUBRIC,
  MemoryAnnunci10xPersistenceAdapter,
  calculateAnnunci10xScore,
  createFact,
  evaluatePublicationGate,
  parseSnapshotRow,
  validateCommercialContext,
} from '../src/lib/annunci-10x/index.ts';

const now = '2026-09-22T00:00:00.000Z';

const serverEntitlements = {
  guide: false,
  adGeneration: false,
  bundle: false,
  source: 'OPEN_DECISION',
  verification: 'SERVER_VERIFIED',
  checkedAt: now,
  serverAuthorityId: 'annunci10x-server',
};

const commercialContext = {
  productCode: 'AD_GENERATION',
  entitlements: serverEntitlements,
  reservedOfferEligible: false,
  reservedOfferReason: 'NONE',
  price: 'OPEN_DECISION',
  discountValue: 'OPEN_DECISION',
};

const confirmed = (value, sourceId) => createFact(value, 'USER_CONFIRMED', { sourceId, publishable: true, confidence: 95 });

const roleCard = {
  title: confirmed('Addetto customer care', 'answer-title'),
  mission: confirmed('Gestire richieste clienti e risolvere problemi ricorrenti', 'answer-mission'),
  outcomes: [confirmed('Ridurre i tempi di risposta e aumentare la soddisfazione', 'answer-outcome')],
  responsibilities: [confirmed('Rispondere ai ticket e aggiornare il CRM', 'answer-responsibility')],
  requirements: [{ id: 'req-1', label: confirmed('Italiano scritto chiaro', 'answer-req'), classification: 'REQUIRED' }],
  attractionContext: {
    companyName: confirmed('Horyzon Test', 'answer-company'),
    workMode: confirmed('Ibrido', 'answer-work-mode'),
    attractivenessEvidence: [confirmed('Affiancamento iniziale', 'answer-attraction')],
  },
};

const generatedMaster = {
  id: 'master-1',
  sessionId: 'session-placeholder',
  kind: 'MASTER',
  sections: [{
    id: 'section-1',
    type: 'TITLE',
    key: 'title',
    title: 'Titolo',
    body: 'Addetto customer care',
    sourceFactIds: ['answer-title'],
  }],
  sourceOfTruth: true,
  generatedAt: now,
  promptVersion: ANNUNCI10X_PROMPT_PACK_VERSION,
};

const score = calculateAnnunci10xScore(ANNUNCI10X_RUBRIC.checks.map((definition) => ({
  id: definition.id,
  status: 'PASS',
  evidence: [`${definition.id} evidence`],
})));

const gate = evaluatePublicationGate({ evaluatedAt: now });

const adapter = new MemoryAnnunci10xPersistenceAdapter();

const sessionA = await adapter.createSession({ flow: 'CREATE', commercialContext, selectedChannel: 'LINKEDIN' });
const sessionB = await adapter.createSession({ flow: 'ANALYZE', commercialContext });

assert.equal(sessionA.session.flow, 'CREATE');
assert.equal(sessionA.session.entryMode, 'BUILD');
assert.equal(sessionA.session.selectedChannel, 'LINKEDIN');
assert.ok(sessionA.sessionSecret.length >= 32);

assert.equal(await adapter.getSession(sessionA.session.id, sessionA.sessionSecret).then(Boolean), true, 'correct owner can read session');
assert.equal(await adapter.getSession(sessionA.session.id, 'wrong-secret-that-is-long-enough-to-hash').then(Boolean), false, 'wrong secret cannot read session');
const collectingSession = await adapter.updateSession({ sessionId: sessionA.session.id, sessionSecret: sessionA.sessionSecret, state: 'COLLECTING', selectedChannel: 'LINKEDIN' });
assert.equal(collectingSession.state, 'COLLECTING');
assert.equal(collectingSession.selectedChannel, 'LINKEDIN');

await assert.rejects(
  () => adapter.appendAnswer({
    sessionId: sessionA.session.id,
    sessionSecret: sessionB.sessionSecret,
    interviewStep: 'ROLE',
    questionId: 'role-title',
    rawAnswer: 'Non dovrebbe passare',
  }),
  /ownership/i,
  'session B secret cannot write session A',
);

const answer = await adapter.appendAnswer({
  sessionId: sessionA.session.id,
  sessionSecret: sessionA.sessionSecret,
  interviewStep: 'ROLE',
  questionId: 'role-title',
  clarificationId: 'clarification-1',
  rawAnswer: 'Vorrei un annuncio per customer care, con testo RAW preservato.',
});
assert.equal(answer.rawAnswer, 'Vorrei un annuncio per customer care, con testo RAW preservato.');
const sessionAnswers = await adapter.getAnswers(sessionA.session.id, sessionA.sessionSecret);
assert.equal(sessionAnswers.length, 1);
assert.equal(sessionAnswers[0].questionId, 'role-title');

const snapshot1 = await adapter.appendSnapshot({
  sessionId: sessionA.session.id,
  sessionSecret: sessionA.sessionSecret,
  roleCard,
  reason: 'USER_ANSWER',
});
const snapshot2 = await adapter.appendSnapshot({
  sessionId: sessionA.session.id,
  sessionSecret: sessionA.sessionSecret,
  roleCard: {
    ...roleCard,
    responsibilities: [...roleCard.responsibilities, confirmed('Gestire escalation semplici', 'answer-responsibility-2')],
  },
  reason: 'USER_EDIT',
});
assert.equal(snapshot1.version, 1);
assert.equal(snapshot2.version, 2);
assert.equal(snapshot1.roleCard.responsibilities.length, 1, 'previous snapshot remains preserved');
assert.equal((await adapter.getLatestSnapshot(sessionA.session.id, sessionA.sessionSecret))?.version, 2);

const operationA = await adapter.startAiOperation({
  sessionId: sessionA.session.id,
  sessionSecret: sessionA.sessionSecret,
  operationType: 'GENERATE',
  inputSnapshotId: snapshot2.id,
  promptVersion: ANNUNCI10X_PROMPT_PACK_VERSION,
  idempotencyKey: 'idem-generate-0001',
  model: 'test-model',
});
const operationB = await adapter.startAiOperation({
  sessionId: sessionA.session.id,
  sessionSecret: sessionA.sessionSecret,
  operationType: 'GENERATE',
  inputSnapshotId: snapshot2.id,
  promptVersion: ANNUNCI10X_PROMPT_PACK_VERSION,
  idempotencyKey: 'idem-generate-0001',
  model: 'test-model',
});
assert.equal(operationA.id, operationB.id, 'duplicate idempotency does not create two operations');
assert.equal((await adapter.completeAiOperation({ operationId: operationA.id, sessionSecret: sessionA.sessionSecret, outputPayload: { ok: true } })).status, 'SUCCEEDED');

await assert.rejects(
  () => adapter.completeAiOperation({ operationId: operationA.id, sessionSecret: sessionB.sessionSecret, outputPayload: { ok: true } }),
  /ownership/i,
  'operation ownership is checked',
);

const master = await adapter.saveOutput({
  sessionId: sessionA.session.id,
  sessionSecret: sessionA.sessionSecret,
  snapshotId: snapshot2.id,
  outputType: 'MASTER',
  generatedContent: { ...generatedMaster, id: 'master-output-1', sessionId: sessionA.session.id },
  validationState: 'READY',
});

await assert.rejects(
  () => adapter.saveOutput({
    sessionId: sessionA.session.id,
    sessionSecret: sessionA.sessionSecret,
    snapshotId: snapshot2.id,
    outputType: 'CHANNEL_VARIANT',
    channel: 'LINKEDIN',
    generatedContent: {
      id: 'variant-1',
      masterAdId: master.id,
      channel: 'LINKEDIN',
      sections: generatedMaster.sections,
      introducedFactIds: [],
      adaptedFromMaster: true,
    },
    validationState: 'READY',
  }),
  /master output/i,
  'channel variant cannot be orphaned',
);

const variant = await adapter.saveOutput({
  sessionId: sessionA.session.id,
  sessionSecret: sessionA.sessionSecret,
  snapshotId: snapshot2.id,
  outputType: 'CHANNEL_VARIANT',
  channel: 'LINKEDIN',
  parentMasterId: master.id,
  generatedContent: {
    id: 'variant-1',
    masterAdId: master.id,
    channel: 'LINKEDIN',
    sections: generatedMaster.sections,
    introducedFactIds: [],
    adaptedFromMaster: true,
  },
  validationState: 'READY',
});
assert.equal(variant.parentMasterId, master.id);

const evaluation = await adapter.saveEvaluation({
  sessionId: sessionA.session.id,
  sessionSecret: sessionA.sessionSecret,
  target: { kind: 'GENERATED_MASTER', generatedAdId: master.id },
  targetRef: master.id,
  targetOutputId: master.id,
  score,
  gate,
});
assert.equal(evaluation.target, 'GENERATED_MASTER');
assert.equal(evaluation.score.value, 100);

assert.throws(
  () => parseSnapshotRow({
    id: 'snapshot-bad',
    session_id: sessionA.session.id,
    version: 1,
    role_card: { malformed: true },
    reason: 'USER_EDIT',
    created_at: now,
  }),
  /Malformed Annunci 10x role_card JSONB/,
  'malformed JSONB is rejected before reaching domain code',
);

await assert.rejects(
  () => adapter.appendEvent({
    sessionId: sessionA.session.id,
    eventName: 'unsafe_event',
    metadata: { rawAnswer: 'should never be telemetry' },
  }),
  /forbidden key/,
  'event metadata rejects prohibited payload keys',
);

const event = await adapter.appendEvent({
  sessionId: sessionA.session.id,
  eventName: 'flow_started',
  metadata: { flow: 'CREATE', step: 'ROLE' },
});
assert.equal(event.eventName, 'flow_started');

assert.equal(validateCommercialContext({
  ...commercialContext,
  entitlements: { ...serverEntitlements, guide: true, verification: 'CLIENT_DECLARED' },
}).ok, false, 'client-declared entitlement cannot satisfy runtime contract');

console.log('Annunci 10x persistence verifier passed');
