import assert from 'node:assert/strict';
import {
  MemoryAnnunci10xPersistenceAdapter,
  MockAnnunci10xProvider,
  buildCandidateWriterView,
  composeHybridWriterMaster,
  createFact,
  createAnnunci10xTruthLedger,
  createProductionGenerationAuthorizationProvider,
  createTestGenerationAuthorizationProvider,
  requestAnnunci10xPremiumEdit,
  resumeAnnunci10xPremiumOutput,
  runAnnunci10xPremiumGeneration,
  sanitizeGenerationClientPayload,
  validateEditorialCoreOutput,
  validateChannelAdapterOutput,
} from '../src/lib/annunci-10x/index.ts';
import {
  CUSTOMER_CARE_CANONICAL_FIXTURE,
  MAGAZZINIERE_CANONICAL_FIXTURE,
} from './support/annunci-10x-canonical-fixtures.ts';

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
  requirements: [
    { id: 'req-1', label: confirmed('Precisione e puntualita', 'answer-req'), classification: 'REQUIRED' },
    { id: 'req-trainable', label: confirmed('procedure aziendali interne', 'answer-trainable'), classification: 'TRAINABLE' },
  ],
  applicationInstructions: confirmed('tramite il canale dell annuncio', 'answer-application'),
  compensation: {
    visibility: confirmed('VISIBLE', 'answer-compensation-visibility'),
    amountText: confirmed('Retribuzione da definire in base all esperienza', 'answer-compensation'),
  },
  attractionContext: {
    workMode: confirmed('In presenza', 'answer-work-mode'),
    location: confirmed('Bari', 'answer-location'),
    contractType: confirmed('Part-time', 'answer-contract'),
    schedule: confirmed('Mattina dal lunedi al venerdi', 'answer-schedule'),
    attractivenessEvidence: [confirmed('Orari definiti e affiancamento iniziale', 'answer-attraction')],
  },
};

const customerCareRoleCard = CUSTOMER_CARE_CANONICAL_FIXTURE.roleCard;
const warehouseRoleCard = MAGAZZINIERE_CANONICAL_FIXTURE.roleCard;
const sparseAnalyzeRoleCard = {
  title: confirmed('addetto customer care', 'original-title'),
  mission: createFact('N/D - missione da chiarire', 'SYSTEM_INFERRED', {
    sourceId: 'mission-nd',
    publishable: false,
    confidence: 35,
  }),
  outcomes: [createFact('N/D - risultato atteso da chiarire', 'SYSTEM_INFERRED', {
    sourceId: 'outcome-nd',
    publishable: false,
    confidence: 35,
  })],
  compensation: {
    visibility: createFact('OPEN_DECISION', 'SYSTEM_INFERRED', {
      sourceId: 'compensation-visibility',
      publishable: false,
      confidence: 35,
    }),
  },
  requirements: [{
    id: 'req-analyze-1',
    label: confirmed('italiano scritto chiaro, precisione, disponibilità al lavoro su turni', 'original-requirement'),
    classification: 'REQUIRED',
  }],
  responsibilities: [confirmed('gestirà richieste clienti, ticket e aggiornamento CRM', 'original-responsibility')],
  attractionContext: {
    location: confirmed('Bari', 'location'),
    schedule: confirmed('turni', 'schedule'),
    workMode: confirmed('In presenza', 'work-mode'),
    contractType: confirmed('part-time', 'contract'),
    attractivenessEvidence: [],
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

async function createReadySession(context, flow = 'CREATE', snapshotRoleCard = roleCard) {
  const created = await context.persistence.createSession({ flow, selectedChannel: 'LINKEDIN', commercialContext });
  await context.persistence.updateSession({ sessionId: created.session.id, sessionSecret: created.sessionSecret, state: 'ENTITLED' });
  const lead = await context.persistence.saveLead({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    firstName: 'Test',
    lastName: 'Annunci10x',
    companyName: 'Horyzon Test',
    businessRole: 'OWNER_ENTREPRENEUR',
    emailNormalized: 'annunci10x-test@example.com',
    marketingConsent: false,
    marketingConsentVersion: 'annunci10x-marketing-consent-v1',
  });
  const verification = await context.persistence.createEmailVerification({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    leadId: lead.id,
    emailNormalized: lead.emailNormalized,
    codeHash: 'a'.repeat(64),
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    maxAttempts: 5,
    pendingGraceSeconds: 15,
  });
  await context.persistence.markEmailVerificationSent(verification.id, created.sessionSecret);
  const verified = await context.persistence.verifyEmailCode({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    verificationId: verification.id,
    codeMatches: true,
  });
  assert.equal(verified.outcome, 'VERIFIED');
  const snapshot = await context.persistence.appendSnapshot({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    roleCard: snapshotRoleCard,
    roleProfile: { ...roleProfile, roleCard: snapshotRoleCard },
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

assert.deepEqual(
  validateEditorialCoreOutput({ opening: 'Apertura', responsibilities: 'Responsabilità' }),
  { opening: 'Apertura', responsibilities: 'Responsabilità' },
  'editorial core accepts only the two AI-owned editorial bodies',
);
assert.throws(() => validateEditorialCoreOutput({ responsibilities: 'Responsabilità' }), /opening/);
assert.throws(() => validateEditorialCoreOutput({ opening: 'Apertura', responsibilities: '' }), /responsibilities/);
assert.throws(() => validateEditorialCoreOutput({ opening: 'Apertura', responsibilities: 'Responsabilità', requirements: 'Requisiti' }), /not allowed/);
assert.throws(() => validateEditorialCoreOutput({ opening: 'Apertura', responsibilities: 'Responsabilità', id: 'model-id' }), /not allowed/);
assert.throws(() => validateEditorialCoreOutput({
  generatedAd: {
    id: 'legacy',
    sessionId: 'legacy',
    kind: 'MASTER',
    sections: [],
    sourceOfTruth: true,
    generatedAt: now,
    promptVersion: 'legacy',
  },
}), /not allowed|generatedAd/);

{
  const ledger = createAnnunci10xTruthLedger(customerCareRoleCard);
  const view = buildCandidateWriterView(ledger);
  assert.equal(JSON.stringify(view).includes('procedure interne'), false, 'candidate writer view excludes TRAINABLE facts');
  const master = composeHybridWriterMaster({
    editorialCore: {
      opening: 'Apertura customer care con contesto aziendale e risultato concreto.',
      responsibilities: 'Responsabilità customer care coerenti con richieste clienti, CRM e amministrazione/commerciale.',
    },
    sessionId: 'composer-session',
    roleCard: customerCareRoleCard,
    truthLedger: ledger,
    promptVersion: 'composer-test',
  });
  assert.deepEqual(master.sections.map((section) => section.type), ['TITLE', 'OPENING', 'RESPONSIBILITIES', 'REQUIREMENTS', 'CONDITIONS', 'APPLICATION']);
  assert.equal(master.sessionId, 'composer-session');
  assert.equal(master.kind, 'MASTER');
  assert.ok(master.id, 'server assigns master id');
  assert.ok(master.generatedAt, 'server assigns generatedAt');
  assert.equal(master.promptVersion, 'composer-test');
  assert.deepEqual(master.sections.map((section) => section.key), ['title', 'hybrid-opening', 'hybrid-responsibilities', 'hybrid-requirements', 'conditions', 'application']);
  assert.equal(master.sections.find((section) => section.type === 'TITLE')?.body, 'Addetto/a Customer Care');
  assert.equal(
    master.sections.find((section) => section.type === 'REQUIREMENTS')?.body,
    [
      'Per questo ruolo servono ascolto, chiarezza nella comunicazione, pazienza, organizzazione, precisione e capacità di gestire più richieste.',
      "E gradita, ma non obbligatoria, un'esperienza di almeno 1 anno in assistenza clienti.",
    ].join('\n'),
    'requirements are composed deterministically from REQUIRED and PREFERRED facts only',
  );
  assert.match(master.sections.find((section) => section.type === 'CONDITIONS')?.body ?? '', /Compenso: RAL 23\.000-26\.000 EUR\./);
  assert.equal(master.sections.find((section) => section.type === 'APPLICATION')?.body, 'Se questa posizione ti interessa, inviaci la tua candidatura.');
  assert.deepEqual(master.sections.find((section) => section.type === 'OPENING')?.sourceFactIds.includes('model-owned-source'), false, 'sourceFactIds are server-owned');
}

{
  const context = makeContext(new MockAnnunci10xProvider('success'));
  const created = await createReadySession(context);
  const result = await runAnnunci10xPremiumGeneration({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    context,
    authorizationProvider: createProductionGenerationAuthorizationProvider(),
  });
  assert.equal(result.provider, 'MOCK');
  assert.equal(result.master.kind, 'MASTER');
  assert.equal(result.gate.status, 'READY', 'production authorization must allow verified free generation without checkout');
}

{
  const context = makeContext(new MockAnnunci10xProvider(['success', 'success', 'success', 'success']));
  const created = await createReadySession(context, 'ANALYZE', sparseAnalyzeRoleCard);
  const result = await runAnnunci10xPremiumGeneration({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    context,
    authorizationProvider: createTestGenerationAuthorizationProvider({ credits: 1 }),
  });
  assert.equal(result.provider, 'MOCK');
  assert.equal(result.master.kind, 'MASTER');
  assert.equal(result.channelVariant?.channel, 'LINKEDIN');
  assert.equal(result.operations.map((operation) => operation.type).join('>'), 'GENERATE>EVALUATE>CHANNEL_ADAPTER');
  assert.match(result.masterText, /addetto customer care/i, 'ANALYZE rewrite can generate from facts already extracted from the scored ad');
  assert.match(result.masterText, /ticket|CRM/i, 'ANALYZE rewrite preserves concrete facts from the original ad');
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
  const generateCall = context.provider.calls.find((call) => call.operationType === 'GENERATE');
  assert.equal(generateCall?.input?.communicationStrategy?.summary, strategy.summary, 'Writer receives the grounded communication strategy');
  assert.equal(generateCall?.input?.communicationStrategy?.candidateAngle, strategy.candidateAngle, 'Writer receives candidate-facing editorial direction');
  assert.equal(JSON.stringify(generateCall?.input?.communicationStrategy ?? {}).includes('commercialContext'), false, 'Writer strategy guidance remains free of commercial state');
  assert.ok(generateCall?.input?.candidateWriterView, 'hybrid writer receives a filtered candidate-facing view');
  assert.equal(JSON.stringify(generateCall?.input ?? {}).includes('"roleCard"'), false, 'hybrid writer does not receive the full RoleCard');
  assert.equal(JSON.stringify(generateCall?.input ?? {}).includes('procedure aziendali interne'), false, 'hybrid writer input excludes trainable facts');
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
  const context = makeContext(new MockAnnunci10xProvider(['success', 'success', 'success']));
  const created = await createReadySession(context);
  const result = await runAnnunci10xPremiumGeneration({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    context,
    authorizationProvider: createTestGenerationAuthorizationProvider({ credits: 1 }),
  });
  assert.equal(result.operations.filter((operation) => operation.type === 'REVISE').length, 0, 'CREATE premium does not run old editorial revisions when hard facts pass');
  assert.equal(result.master.annunci10xPremium?.automaticRevisionCount, 0, 'premium payload records zero automatic repairs for a clean hard-facts run');
  assert.deepEqual(
    result.master.sections.map((section) => section.type),
    ['TITLE', 'OPENING', 'RESPONSIBILITIES', 'REQUIREMENTS', 'CONDITIONS', 'GROWTH', 'APPLICATION'],
    'hybrid writer composes the deterministic shell around the AI editorial core',
  );
  assert.match(result.masterText, /Pulizia uffici, corridoi e spazi comuni/i, 'responsibilities survive partial revisions');
  assert.match(result.masterText, /Bari/i, 'location survives partial revisions');
  assert.match(result.masterText, /Part-time/i, 'conditions survive partial revisions');
  assert.match(result.masterText, /Compenso: Retribuzione da definire in base all esperienza\./i, 'compensation condition is deterministic and not duplicated');
  assert.match(result.masterText, /Orari definiti e affiancamento iniziale/i, 'confirmed attractiveness evidence is preserved deterministically');
  assert.match(result.masterText, /Se questa posizione ti interessa, inviaci la tua candidatura\./i, 'generic application channel becomes deterministic CTA');
  assert.equal(result.master.sections.some((section) => section.id.startsWith('confirmed-role-')), false, 'premium output must not rely on canonical RoleCard dump sections');
  assert.doesNotMatch(result.masterText, /^(Autonomia|Imprevisti e variabilit[aà]|Apprendibili|Vincoli|Benefit|Turni|Reperibilit[aà]):/im, 'premium output must not expose internal RoleCard labels');
  assert.doesNotMatch(result.masterText, /procedure operative|procedure aziendali|Elementi segnalati|Retribuzione:\s*Retribuzione|Non dichiarato|Non specificato/i, 'premium output hides trainable/internal labels and duplicated compensation wording');
  assert.equal(result.gate.status, 'READY', 'clean hard-facts output can reach READY without the old revision loop');
  assert.equal(result.claimCheck.some((claim) => claim.status === 'UNSUPPORTED'), false);
}

{
  const customerOpening = CUSTOMER_CARE_CANONICAL_FIXTURE.safeEditorialCore.opening;
  const context = makeContext(fixedEditorialCoreProvider(CUSTOMER_CARE_CANONICAL_FIXTURE.safeEditorialCore));
  const created = await createReadySession(context, 'CREATE', customerCareRoleCard);
  const result = await runAnnunci10xPremiumGeneration({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    context,
    authorizationProvider: createTestGenerationAuthorizationProvider({ credits: 1 }),
  });
  const generateCalls = context.provider.calls.filter((call) => call.operationType === 'GENERATE');
  assert.equal(generateCalls.length, 1, 'valid editorial core output passes on first attempt without schema retry');
  assert.equal(generateCalls[0]?.outputSchemaName, 'annunci10x_editorial_core', 'hybrid writer uses editorial core schema');
  const opening = result.master.sections.find((section) => section.type === 'OPENING');
  assert.equal(opening?.body, customerOpening, 'Customer Care opening is produced once by the AI editorial core and is not prepended by deterministic copy');
  assert.equal(countOccurrences(opening?.body ?? '', 'Addetto/a Customer Care'), 1, 'Customer Care opening does not repeat title and role');
  assert.equal(countOccurrences(opening?.body ?? '', 'PMI italiana'), 1, 'Customer Care opening does not repeat company context');
  assert.equal(countOccurrences(opening?.body ?? '', 'registrare le richieste nel CRM'), 1, 'Customer Care opening preserves CRM only as work activity');
  assert.doesNotMatch(opening?.body ?? '', /full-time|RAL|24\.000|28\.000|turni serali|affiancamento iniziale|ticket|email|telefono/i, 'Customer Care opening does not duplicate deterministic conditions or contaminated fixture data');
  assert.equal(opening?.sourceFactIds.includes('model-owned-source'), false, 'model cannot own sourceFactIds for editorial sections');
  assert.equal(result.gate.status, 'READY', 'Customer Care fixed editorial core output passes hard facts');
}

{
  const context = makeContext(new MockAnnunci10xProvider(['success', 'success', 'success']));
  const created = await createReadySession(context, 'CREATE', warehouseRoleCard);
  const result = await runAnnunci10xPremiumGeneration({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    context,
    authorizationProvider: createTestGenerationAuthorizationProvider({ credits: 1 }),
  });
  const generateCall = context.provider.calls.find((call) => call.operationType === 'GENERATE');
  assert.equal(JSON.stringify(generateCall?.input ?? {}).includes('organizzazione specifica del magazzino'), false, 'writer view excludes trainable warehouse procedure facts');
  assert.match(result.masterText, /autisti e ufficio ordini/i, 'canonical interlocutors are preserved');
  assert.doesNotMatch(result.masterText, /altri reparti|team logistico|altre funzioni|procedure operative|procedure interne/i, 'warehouse output does not generalize interlocutors or leak trainable procedures');
  const conditions = result.master.sections.find((section) => section.type === 'CONDITIONS');
  assert.equal(
    conditions?.body,
    [
      'Sede: Bari.',
      'Modalità: In sede.',
      'Orario: Lunedì-venerdì 08:00-17:00 con pausa pranzo.',
      'Contratto: Tempo determinato iniziale con possibilità di trasformazione a tempo indeterminato.',
      'Compenso: Retribuzione da definire in base all esperienza e nel rispetto del CCNL applicato.',
    ].join('\n'),
    'conditions are deterministic, ordered, and not written by the provider',
  );
  assert.equal(result.master.sections.find((section) => section.type === 'APPLICATION')?.body, 'Se questa posizione ti interessa, inviaci la tua candidatura.');
}

await verifyCreateRevisionContract(roleCard, 'customer care');
await verifyCreateRevisionContract(warehouseRoleCard, 'warehouse');

{
  const context = makeContext(new MockAnnunci10xProvider(['success', 'success', 'success', 'success', 'success', 'success', 'success', 'success']));
  const created = await createReadySession(context, 'ANALYZE');
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

{
  const context = makeContext(new MockAnnunci10xProvider('success'));
  const created = await createReadySession(context, 'CREATE', sparseAnalyzeRoleCard);
  await assert.rejects(
    runAnnunci10xPremiumGeneration({
      sessionId: created.session.id,
      sessionSecret: created.sessionSecret,
      context,
      authorizationProvider: createTestGenerationAuthorizationProvider({ credits: 1 }),
    }),
    /Servono alcuni chiarimenti sulla realta del ruolo/,
    'CREATE keeps the narrative sufficiency gate for sparse from-zero inputs',
  );
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

function fixedEditorialCoreProvider(editorial) {
  const delegate = new MockAnnunci10xProvider('success');
  return {
    name: 'MOCK',
    calls: delegate.calls,
    async executeStructuredTask(request) {
      if (request.operationType !== 'GENERATE') return delegate.executeStructuredTask(request);
      delegate.calls.push(request);
      return {
        output: editorial,
        provider: 'MOCK',
        model: request.model,
        providerRequestId: 'fixed-editorial-core',
        usage: { inputTokens: 12, outputTokens: 8, totalTokens: 20, cachedTokens: null },
        latencyMs: 0,
      };
    },
  };
}

function countOccurrences(value, needle) {
  return (value.match(new RegExp(escapeRegExp(needle), 'gi')) ?? []).length;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

async function verifyCreateRevisionContract(snapshotRoleCard, label) {
  const context = makeContext(new MockAnnunci10xProvider(Array.from({ length: 16 }, () => 'success')));
  const created = await createReadySession(context, 'CREATE', snapshotRoleCard);
  const generated = await runAnnunci10xPremiumGeneration({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    context,
    authorizationProvider: createTestGenerationAuthorizationProvider({ credits: 1 }),
  });
  assert.equal(generated.clientRevisionCount, 0, `${label}: starts with zero client revisions`);
  const byType = new Map(generated.master.sections.map((section) => [section.type, section]));
  const opening = byType.get('OPENING');
  const responsibilities = byType.get('RESPONSIBILITIES');
  const requirements = byType.get('REQUIREMENTS');
  const conditions = byType.get('CONDITIONS');
  assert.ok(opening?.id && responsibilities?.id && requirements?.id && conditions?.id, `${label}: expected hybrid sections`);

  const deterministic = await requestAnnunci10xPremiumEdit({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    editRequest: 'Rendi questa sezione più elegante.',
    targetPath: conditions.id,
    context,
    authorizationProvider: createTestGenerationAuthorizationProvider({ credits: 1 }),
  });
  assert.equal(deterministic.status, 'REVISION_BLOCKED', `${label}: deterministic sections are not freely revised`);
  assert.equal(deterministic.operations.length, 0, `${label}: deterministic section block does not call provider`);
  assert.equal(deterministic.revisionCount, 0, `${label}: deterministic section block does not consume revision count`);

  const deterministicRequirements = await requestAnnunci10xPremiumEdit({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    editRequest: 'Rendi il fit candidato più umano e naturale. Mantieni espliciti tutti i requisiti obbligatori e lascia chiaramente non obbligatori quelli preferenziali.',
    targetPath: requirements.id,
    context,
    authorizationProvider: createTestGenerationAuthorizationProvider({ credits: 1 }),
  });
  assert.equal(deterministicRequirements.status, 'REVISION_BLOCKED', `${label}: deterministic requirements are not freely revised`);
  assert.equal(deterministicRequirements.operations.length, 0, `${label}: deterministic requirements block does not call provider`);
  assert.equal(deterministicRequirements.revisionCount, 0, `${label}: deterministic requirements block does not consume revision count`);

  const noOp = await requestAnnunci10xPremiumEdit({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    editRequest: 'Non cambiare nulla.',
    targetPath: opening.id,
    context,
    authorizationProvider: createTestGenerationAuthorizationProvider({ credits: 1 }),
  });
  assert.equal(noOp.status, 'REVISION_BLOCKED', `${label}: no-op is blocked`);
  assert.equal(noOp.revisionCount, 0, `${label}: no-op does not consume revision count`);
  assert.equal((await resumeAnnunci10xPremiumOutput({ sessionId: created.session.id, sessionSecret: created.sessionSecret, context }))?.outputId, generated.outputId, `${label}: no-op does not persist a new output`);

  const factual = await requestAnnunci10xPremiumEdit({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    editRequest: 'Aggiungi che lo stipendio è 35.000 euro.',
    targetPath: opening.id,
    context,
    authorizationProvider: createTestGenerationAuthorizationProvider({ credits: 1 }),
  });
  assert.equal(factual.status, 'REVISION_BLOCKED', `${label}: unsupported factual edit is blocked`);
  assert.equal(factual.revisionCount, 0, `${label}: blocked factual edit does not consume revision count`);
  assert.equal((await resumeAnnunci10xPremiumOutput({ sessionId: created.session.id, sessionSecret: created.sessionSecret, context }))?.outputId, generated.outputId, `${label}: blocked factual edit does not persist a new output`);

  const revision1 = await requestAnnunci10xPremiumEdit({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    editRequest: 'Rendi l apertura più naturale e diretta per il candidato. Non aggiungere, togliere o cambiare alcun fatto.',
    targetPath: opening.id,
    context,
    authorizationProvider: createTestGenerationAuthorizationProvider({ credits: 1 }),
  });
  assertRevisionApplied(revision1, generated, opening.id, 1, label);
  const reloaded1 = await resumeAnnunci10xPremiumOutput({ sessionId: created.session.id, sessionSecret: created.sessionSecret, context });
  assert.equal(reloaded1?.outputId, revision1.output?.outputId, `${label}: reload after 1/3 sees persisted output`);

  const revision2 = await requestAnnunci10xPremiumEdit({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    editRequest: 'Rendi questa sezione più scorrevole e facile da leggere, mantenendo esattamente attività, interlocutori, autonomia e imprevisti confermati.',
    targetPath: responsibilities.id,
    context,
    authorizationProvider: createTestGenerationAuthorizationProvider({ credits: 1 }),
  });
  assertRevisionApplied(revision2, revision1.output, responsibilities.id, 2, label);
  const reloaded2 = await resumeAnnunci10xPremiumOutput({ sessionId: created.session.id, sessionSecret: created.sessionSecret, context });
  assert.equal(reloaded2?.outputId, revision2.output?.outputId, `${label}: reload after 2/3 sees persisted output`);

  const revision3 = await requestAnnunci10xPremiumEdit({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    editRequest: 'Rendi l apertura più fluida e orientata al candidato, mantenendo esattamente ruolo, contesto e condizioni confermate.',
    targetPath: opening.id,
    context,
    authorizationProvider: createTestGenerationAuthorizationProvider({ credits: 1 }),
  });
  assertRevisionApplied(revision3, revision2.output, opening.id, 3, label);
  const reloaded3 = await resumeAnnunci10xPremiumOutput({ sessionId: created.session.id, sessionSecret: created.sessionSecret, context });
  assert.equal(reloaded3?.outputId, revision3.output?.outputId, `${label}: reload after 3/3 sees persisted output`);

  const fourth = await requestAnnunci10xPremiumEdit({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    editRequest: 'Rendi ancora più naturale il testo.',
    targetPath: opening.id,
    context,
    authorizationProvider: createTestGenerationAuthorizationProvider({ credits: 1 }),
  });
  assert.equal(fourth.status, 'REVISION_LIMIT_REACHED', `${label}: fourth revision is limited`);
  assert.equal(fourth.operations.length, 0, `${label}: revision limit does not call provider`);
  assert.equal((await resumeAnnunci10xPremiumOutput({ sessionId: created.session.id, sessionSecret: created.sessionSecret, context }))?.outputId, revision3.output?.outputId, `${label}: fourth revision does not persist`);
}

function assertRevisionApplied(result, previousOutput, targetSectionId, expectedCount, label) {
  assert.equal(result.status, 'REVISION_APPLIED', `${label}: revision ${expectedCount} applies`);
  assert.equal(result.revisionCount, expectedCount, `${label}: revision count ${expectedCount}`);
  assert.ok(result.output?.outputId && result.output.outputId !== previousOutput.outputId, `${label}: outputId changes for revision ${expectedCount}`);
  assert.equal(result.output?.master.annunci10xPremium?.clientRevisionCount, expectedCount, `${label}: persisted payload count ${expectedCount}`);
  const previousSections = new Map(previousOutput.master.sections.map((section) => [section.id, section]));
  const nextSections = new Map(result.output.master.sections.map((section) => [section.id, section]));
  for (const [id, previous] of previousSections) {
    const next = nextSections.get(id);
    assert.ok(next, `${label}: section ${id} survives`);
    if (id === targetSectionId) {
      assert.notEqual(next.body, previous.body, `${label}: target section body changes`);
      assert.equal(next.type, previous.type, `${label}: target section type preserved`);
      assert.equal(next.title, previous.title, `${label}: target section title preserved`);
    } else {
      assert.equal(next.body, previous.body, `${label}: non-target section ${id} is unchanged`);
      assert.equal(next.title, previous.title, `${label}: non-target title ${id} is unchanged`);
    }
  }
  assert.equal(result.output.master.annunci10xPremium?.clientRevision?.decisionReport?.final ?? result.output.master.annunci10xPremium?.decisionEngine?.clientRevision?.decisionReport?.final, 'PASS', `${label}: hard facts pass after revision`);
}

console.log('Annunci 10x premium verifier passed');
