import {
  MockAnnunci10xProvider,
  createAnnunci10xPersistenceAdapter,
  createFact,
  createTestGenerationAuthorizationProvider,
  resumeAnnunci10xPremiumOutput,
  runAnnunci10xPremiumGeneration,
} from '../src/lib/annunci-10x/index.ts';

const now = new Date().toISOString();
const confirmed = (value, sourceId) => createFact(value, 'USER_CONFIRMED', { sourceId, publishable: true, confidence: 95 });

const roleCard = {
  title: confirmed('Addetto pulizie uffici', 'live-title'),
  mission: confirmed('Mantenere puliti uffici e spazi comuni', 'live-mission'),
  outcomes: [confirmed('Garantire ambienti ordinati a inizio giornata', 'live-outcome')],
  responsibilities: [confirmed('Pulizia uffici, corridoi e spazi comuni', 'live-responsibility')],
  requirements: [{ id: 'req-live-1', label: confirmed('Precisione e puntualita', 'live-req'), classification: 'REQUIRED' }],
  compensation: { visibility: confirmed('OPEN_DECISION', 'live-compensation-visibility') },
  attractionContext: {
    workMode: confirmed('In presenza', 'live-work-mode'),
    location: confirmed('Bari', 'live-location'),
    contractType: confirmed('Part-time', 'live-contract'),
    schedule: confirmed('Mattina dal lunedi al venerdi', 'live-schedule'),
    attractivenessEvidence: [confirmed('Orari definiti e affiancamento iniziale', 'live-attraction')],
  },
};

const roleProfile = {
  roleCard,
  rolePopularity: confirmed('UNKNOWN', 'live-profile-demand'),
  companyAttractiveness: confirmed('MEDIUM', 'live-profile-company'),
  challengeLevel: confirmed('LOW', 'live-profile-challenge'),
  routineLevel: confirmed('HIGH', 'live-profile-routine'),
  qualificationLevel: confirmed('LOW', 'live-profile-qualification'),
  commitmentLevel: confirmed('MEDIUM', 'live-profile-commitment'),
  technicality: confirmed('LOW', 'live-profile-technicality'),
};

const versions = {
  dataContractVersion: 'annunci10x-data-contracts-v1',
  methodVersion: 'annunci10x-method-v1',
  rubricVersion: 'annunci10x-rubric-v1',
  strategyVersion: 'annunci10x-strategy-v1',
  promptVersion: 'annunci10x-prompts-v1',
};

const context = {
  persistence: createAnnunci10xPersistenceAdapter(),
  provider: new MockAnnunci10xProvider(['success', 'success', 'success', 'success']),
  configuredProvider: 'MOCK',
};

const created = await context.persistence.createSession({
  flow: 'CREATE',
  selectedChannel: 'LINKEDIN',
  commercialContext: {
    productCode: 'AD_GENERATION',
    entitlements: {
      guide: false,
      adGeneration: false,
      bundle: false,
      source: 'OPEN_DECISION',
      verification: 'SERVER_VERIFIED',
      checkedAt: now,
      serverAuthorityId: 'annunci10x-live-smoke',
    },
    reservedOfferEligible: false,
    reservedOfferReason: 'NONE',
    price: 'OPEN_DECISION',
    discountValue: 'OPEN_DECISION',
  },
  expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
});

await context.persistence.updateSession({ sessionId: created.session.id, sessionSecret: created.sessionSecret, state: 'PAYMENT_REQUIRED' });
const snapshot = await context.persistence.appendSnapshot({
  sessionId: created.session.id,
  sessionSecret: created.sessionSecret,
  roleCard,
  roleProfile,
  communicationStrategy: {
    id: 'live-strategy-1',
    sessionId: created.session.id,
    summary: 'Puntare su routine chiara e condizioni concrete.',
    candidateAngle: 'Persona affidabile che cerca orari e aspettative definite.',
    emphasis: { challenge: 'LOW', routine: 'HIGH', qualification: 'LOW', commitment: 'MEDIUM', technicality: 'LOW' },
    proofPoints: [confirmed('Pulizia uffici e spazi comuni', 'live-proof')],
    reasons: [{ id: 'live-reason-1', label: 'La chiarezza operativa riduce aspettative sbagliate.', factIds: ['live-responsibility'] }],
    riskNotes: [],
    missingFacts: [],
    channelPriorities: ['LINKEDIN'],
    versions,
  },
  reason: 'USER_CONFIRMATION',
});
await context.persistence.updateSession({ sessionId: created.session.id, sessionSecret: created.sessionSecret, currentSnapshotId: snapshot.id });

const output = await runAnnunci10xPremiumGeneration({
  sessionId: created.session.id,
  sessionSecret: created.sessionSecret,
  context,
  authorizationProvider: createTestGenerationAuthorizationProvider({ credits: 1, authorityId: 'annunci10x-live-smoke-authority' }),
});
const resumed = await resumeAnnunci10xPremiumOutput({ sessionId: created.session.id, sessionSecret: created.sessionSecret, context });

console.log(JSON.stringify({
  ok: true,
  sessionId: created.session.id,
  snapshotId: snapshot.id,
  outputId: output.outputId,
  resumedOutputId: resumed?.outputId ?? null,
  operations: output.operations.map((operation) => operation.type),
  provider: output.provider,
  gateStatus: output.gate.status,
}, null, 2));
