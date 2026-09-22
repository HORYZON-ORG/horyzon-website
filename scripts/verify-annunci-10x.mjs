import assert from 'node:assert/strict';
import {
  ANNUNCI10X_METHOD_FIXTURES,
  ANNUNCI10X_PROMPT_PACK_VERSION,
  ANNUNCI10X_RUBRIC,
  ANNUNCI10X_RUBRIC_DIMENSIONS,
  ANNUNCI10X_SCORE_BANDS,
  CHECK_STATUSES,
  FACT_SOURCES,
  FACT_STATUSES,
  PRODUCT_CODES,
  PUBLICATION_STATUSES,
  REQUIREMENT_CLASSIFICATIONS,
  assessScoreBand,
  calculateAnnunci10xScore,
  canTransition,
  createFact,
  criticalMissingData,
  deriveAnnunci10xStrategyRules,
  evaluateAnnunci10xCompleteness,
  evaluatePublicationGate,
  getPointsForCheckStatus,
  invalidCta,
  materialConflict,
  unconfirmedClaim,
  validateAdEvaluation,
  validateAnnunci10xRubric,
  validateAnnunci10xSession,
  validateChannelVariant,
  validateClaimCheck,
  validateCommunicationStrategy,
  validateEvaluationCheck,
  validateEvaluationTarget,
  validateFact,
  validateGeneratedAd,
  validateInterviewDecision,
  validateOriginalAd,
  validateProductCode,
  validatePublicationGate,
  validateRoleCard,
  validateRoleProfile,
  validateScoreResult,
  validateUserAnswer,
} from '../src/lib/annunci-10x/index.ts';

const now = '2026-09-22T00:00:00.000Z';

const serverEntitlements = {
  guide: true,
  adGeneration: false,
  bundle: false,
  source: 'PURCHASE',
  verification: 'SERVER_VERIFIED',
  checkedAt: now,
  serverAuthorityId: 'server-entitlements-1',
};

const commercialContext = {
  productCode: 'AD_GENERATION',
  entitlements: serverEntitlements,
  reservedOfferEligible: true,
  reservedOfferReason: 'OWNS_GUIDE',
  price: 'OPEN_DECISION',
  discountValue: 'OPEN_DECISION',
};

const confirmed = (value, sourceId) => createFact(value, 'USER_CONFIRMED', { sourceId, publishable: true, confidence: 95 });
const declared = (value, sourceId) => createFact(value, 'USER_DECLARED', { sourceId, publishable: true, confidence: 80 });

const requiredRequirement = {
  id: 'req-1',
  label: confirmed('Esperienza nella gestione di clienti B2B', 'answer-req'),
  classification: 'REQUIRED',
};

const roleCard = {
  title: confirmed('Responsabile commerciale B2B', 'answer-title'),
  mission: confirmed('Sviluppare un portafoglio clienti nel territorio assegnato', 'answer-mission'),
  outcomes: [confirmed('Aprire nuove relazioni commerciali qualificate', 'answer-outcome')],
  responsibilities: [confirmed('Gestire prospect, proposta e follow-up settimanale', 'answer-responsibility')],
  requirements: [
    requiredRequirement,
    { id: 'req-2', label: declared('Conoscenza CRM', 'answer-pref'), classification: 'PREFERRED' },
    { id: 'req-3', label: declared('Disponibilita ad affiancamento iniziale', 'answer-trainable'), classification: 'TRAINABLE' },
  ],
  compensation: {
    amountText: createFact('OPEN_DECISION', 'USER_DECLARED', { publishable: false }),
    visibility: confirmed('OPEN_DECISION', 'answer-compensation'),
  },
  attractionContext: {
    companyName: confirmed('Horyzon Test Company', 'answer-company'),
    workMode: confirmed('Ibrido', 'answer-work-mode'),
    attractivenessEvidence: [confirmed('Affiancamento iniziale e obiettivi condivisi', 'answer-attraction')],
  },
};

const roleProfile = {
  roleCard,
  rolePopularity: createFact('UNKNOWN', 'USER_DECLARED', { publishable: false }),
  companyAttractiveness: confirmed('HIGH', 'answer-attraction-level'),
  challengeLevel: confirmed('HIGH', 'answer-challenge'),
  routineLevel: confirmed('MEDIUM', 'answer-routine'),
  qualificationLevel: confirmed('MEDIUM', 'answer-qualification'),
  commitmentLevel: confirmed('HIGH', 'answer-commitment'),
  technicality: confirmed('LOW', 'answer-technicality'),
};

const versions = {
  dataContractVersion: 'annunci10x-data-contracts-v1',
  methodVersion: 'annunci10x-method-v1',
  rubricVersion: 'annunci10x-rubric-v1',
  strategyVersion: 'annunci10x-strategy-v1',
  promptVersion: ANNUNCI10X_PROMPT_PACK_VERSION,
};

const blockingClarification = {
  id: 'clarification-1',
  stepId: 'CONDITIONS',
  fieldKey: 'contractType',
  question: 'Che contratto viene offerto?',
  reason: 'Serve per evitare condizioni implicite.',
  requiredFor: 'GENERATION',
  priority: 'CRITICAL',
  blocking: true,
  answered: false,
};

const generatedSection = {
  id: 'section-1',
  type: 'TITLE',
  key: 'title',
  title: 'Titolo',
  body: 'Responsabile commerciale B2B',
  sourceFactIds: ['answer-title'],
};

const master = {
  id: 'master-1',
  sessionId: 'session-1',
  kind: 'MASTER',
  sections: [generatedSection],
  sourceOfTruth: true,
  generatedAt: now,
  promptVersion: ANNUNCI10X_PROMPT_PACK_VERSION,
};

const score = {
  value: 100,
  max: 100,
  coverage: 90,
  checks: [{
    id: 'role_title_specificity',
    label: 'Role title specificity',
    score: 5,
    maxScore: 5,
    status: 'PASS',
    evidence: ['title is specific'],
    gateImpact: 'NONE',
  }],
  rubricVersion: 'annunci10x-rubric-v1',
};

const blockedGate = {
  status: 'BLOCKED',
  codes: ['UNSUPPORTED_CLAIM'],
  blockingReasons: ['Unsupported claim found'],
  warnings: [],
  evaluatedAt: now,
};

assert.deepEqual(FACT_SOURCES, ['EXTRACTED', 'USER_DECLARED', 'SYSTEM_INFERRED', 'USER_CONFIRMED']);
assert.deepEqual(FACT_STATUSES, ['RAW', 'NORMALIZED', 'CONFIRMED', 'REJECTED', 'STALE']);
assert.deepEqual(REQUIREMENT_CLASSIFICATIONS.slice(0, 3), ['REQUIRED', 'PREFERRED', 'TRAINABLE']);

const inferred = createFact('Probabile benefit non confermato', 'SYSTEM_INFERRED', { status: 'NORMALIZED', publishable: true });
assert.equal(inferred.source, 'SYSTEM_INFERRED');
assert.equal(inferred.status === 'CONFIRMED', false, 'SYSTEM_INFERRED must not be equivalent to USER_CONFIRMED');
assert.equal(inferred.publishable, false, 'SYSTEM_INFERRED must not be automatically publishable');
assert.equal(validateFact({ ...inferred, publishable: true }).ok, false, 'runtime validation rejects publishable SYSTEM_INFERRED');

assert.equal(validateRoleCard(roleCard).ok, true, 'minimum RoleCard should validate');
assert.equal(validateRoleCard({ ...roleCard, title: undefined }).ok, false, 'RoleCard without title should fail');
assert.equal(validateRoleCard({ ...roleCard, requirements: roleCard.requirements.filter((item) => item.classification !== 'REQUIRED') }).ok, false, 'RoleCard requires REQUIRED requirement');
assert.equal(validateRoleProfile(roleProfile).ok, true, 'RoleProfile should validate and preserve UNKNOWN values');

const unknownAnswer = {
  id: 'answer-unknown',
  sessionId: 'session-1',
  questionKey: 'compensation',
  rawAnswer: 'Non lo so',
  answerKind: 'UNKNOWN',
  normalizedFacts: [createFact('UNKNOWN', 'USER_DECLARED', { publishable: false })],
  answeredAt: now,
};
assert.equal(validateUserAnswer(unknownAnswer).ok, true, 'Non lo so must be representable without invented data');

const originalAd = {
  id: 'original-1',
  sessionId: 'session-1',
  type: 'PASTED_TEXT',
  rawText: 'Cerchiamo commerciale dinamico.',
  uploadedAt: now,
  immutable: true,
};
assert.equal(validateOriginalAd(originalAd).ok, true, 'OriginalAd type and immutable flag should validate');

assert.equal(validateEvaluationTarget({ kind: 'ORIGINAL_AD', originalAdId: 'original-1' }).ok, true);
assert.equal(validateEvaluationTarget({ kind: 'GENERATED_MASTER', generatedAdId: 'master-1' }).ok, true);
assert.equal(validateEvaluationTarget({ kind: 'CHANNEL_VARIANT', channelVariantId: 'variant-1', masterAdId: 'master-1' }).ok, true);
assert.equal(validateEvaluationTarget({ kind: 'MASTER', generatedAdId: 'master-1' }).ok, false, 'legacy target name must be rejected');

assert.deepEqual(CHECK_STATUSES, ['PASS', 'PARTIAL', 'MISSING', 'CONFLICT', 'NOT_EVALUABLE']);
for (const status of CHECK_STATUSES) {
  const expectedScore = status === 'NOT_EVALUABLE' ? null : getPointsForCheckStatus(status);
  assert.equal(validateEvaluationCheck({ ...score.checks[0], status, score: expectedScore }).ok, true, `CheckStatus ${status} should validate`);
}

const rubricValidation = validateAnnunci10xRubric();
assert.equal(rubricValidation.ok, true, rubricValidation.errors.join('\n'));
assert.equal(ANNUNCI10X_RUBRIC.checks.length, 20, 'rubric must contain exactly 20 controls');
assert.equal(rubricValidation.totalMaxPoints, 100, 'rubric total must be 100');
assert.equal(new Set(ANNUNCI10X_RUBRIC.checks.map((item) => item.id)).size, 20, 'rubric ids must be unique');
for (const dimension of ANNUNCI10X_RUBRIC_DIMENSIONS) {
  const dimensionTotal = ANNUNCI10X_RUBRIC.checks
    .filter((item) => item.dimensionId === dimension.id)
    .reduce((sum, item) => sum + item.maxPoints, 0);
  assert.equal(dimensionTotal, dimension.maxPoints, `${dimension.id} must total ${dimension.maxPoints}`);
}

assert.equal(getPointsForCheckStatus('PASS'), 5);
assert.equal(getPointsForCheckStatus('PARTIAL'), 2.5);
assert.equal(getPointsForCheckStatus('MISSING'), 0);
assert.equal(getPointsForCheckStatus('CONFLICT'), 0);
assert.equal(getPointsForCheckStatus('NOT_EVALUABLE'), null);

const allPassScore = calculateAnnunci10xScore(ANNUNCI10X_RUBRIC.checks.map((definition) => ({
  id: definition.id,
  status: 'PASS',
  evidence: ['pass evidence'],
  score: 0,
})));
assert.equal(allPassScore.finalScore, 100);
assert.equal(allPassScore.minScore, 100);
assert.equal(allPassScore.maxScore, 100);
assert.equal(allPassScore.coverage, 100);
assert.equal(allPassScore.band.kind, 'DEFINITE');
assert.equal(allPassScore.band.kind === 'DEFINITE' && allPassScore.band.band.id, 'GOOD_COMPLETENESS');
assert.equal(allPassScore.checks[0].score, 5, 'caller-provided score must be ignored');
assert.equal(validateScoreResult(allPassScore).ok, true, 'calculated score remains compatible with ScoreResult');

const ndScore = calculateAnnunci10xScore(ANNUNCI10X_METHOD_FIXTURES.scoreWithNotEvaluable);
assert.equal(ndScore.value, null);
assert.equal(ndScore.finalScore, null);
assert.equal(ndScore.minScore, 57.5);
assert.equal(ndScore.maxScore, 77.5);
assert.deepEqual(ndScore.interval, { min: 57.5, max: 77.5 });
assert.equal(ndScore.coverage, 80);
assert.equal(ndScore.band.kind, 'RANGE', 'N/D interval crossing bands must not produce a definitive band');
assert.equal(ndScore.band.kind === 'RANGE' && ndScore.band.minBand.id, 'NEEDS_REINFORCEMENT');
assert.equal(ndScore.band.kind === 'RANGE' && ndScore.band.maxBand.id, 'USABLE_BASE');
assert.notEqual(ndScore.value, 71.875, 'score must not be normalized over observable max');

assert.equal(ANNUNCI10X_SCORE_BANDS.length, 4);
assert.equal(assessScoreBand(80).kind, 'DEFINITE');
assert.equal(assessScoreBand(39).kind, 'DEFINITE');
assert.equal(assessScoreBand(57.5, 77.5).kind, 'RANGE');

assert.deepEqual(PUBLICATION_STATUSES, ['READY', 'READY_WITH_WARNINGS', 'NEEDS_VERIFICATION', 'BLOCKED']);
const highScoreWithBlockingGate = evaluatePublicationGate({
  evaluatedAt: now,
  findings: [materialConflict('Sede indicata sia full remote sia presenza obbligatoria.')],
});
assert.equal(calculateAnnunci10xScore(ANNUNCI10X_METHOD_FIXTURES.highScoreWithGate).minScore, 95);
assert.equal(highScoreWithBlockingGate.status, 'BLOCKED', 'score 95 + material conflict must be blocked');
assert.equal(validatePublicationGate(highScoreWithBlockingGate).ok, true);

const lowScoreReadyGate = evaluatePublicationGate({ evaluatedAt: now });
assert.equal(calculateAnnunci10xScore(ANNUNCI10X_METHOD_FIXTURES.lowScoreWithoutGate).minScore, 40);
assert.equal(lowScoreReadyGate.status, 'READY', 'low score without gate must not become BLOCKED automatically');

assert.equal(evaluatePublicationGate({ evaluatedAt: now, findings: [unconfirmedClaim('Benefit non confermato.', 'WARNING')] }).status, 'NEEDS_VERIFICATION');
assert.equal(evaluatePublicationGate({ evaluatedAt: now, findings: [criticalMissingData('Contratto mancante.'), invalidCta('Link candidatura assente.')] }).status, 'BLOCKED');

const routineStrategy = deriveAnnunci10xStrategyRules(ANNUNCI10X_METHOD_FIXTURES.routineNonTechnical.strategyInput);
assert.equal(routineStrategy.levers.stability, 'HIGH');
assert.equal(routineStrategy.levers.standardContribution, 'HIGH');
assert.equal(routineStrategy.levers.toolsSupportAccessibility, 'HIGH');
assert.equal(routineStrategy.levers.technicalDepth, 'MEDIUM');
assert.ok(routineStrategy.constraints.some((item) => item.includes('artificial continuous challenge')));
assert.ok(routineStrategy.structures.preferred.includes('WORK_REALITY_FIRST'));
assert.ok(routineStrategy.structures.excluded.includes('PROBLEM_FIRST'));

const challengeStrategy = deriveAnnunci10xStrategyRules(ANNUNCI10X_METHOD_FIXTURES.qualifiedTechnicalChallenge.strategyInput);
assert.equal(challengeStrategy.levers.resultClarity, 'HIGH');
assert.equal(challengeStrategy.levers.responsibilityChallenge, 'HIGH');
assert.equal(challengeStrategy.levers.technicalDepth, 'HIGH');
assert.ok(challengeStrategy.structures.preferred.includes('RESULT_FIRST'));
assert.ok(challengeStrategy.structures.preferred.includes('PROBLEM_FIRST'));

const mixedStrategy = deriveAnnunci10xStrategyRules(ANNUNCI10X_METHOD_FIXTURES.mixedTechnical.strategyInput);
assert.equal(mixedStrategy.levers.stability, 'MEDIUM');
assert.equal(mixedStrategy.levers.responsibilityChallenge, 'HIGH');
assert.ok(mixedStrategy.constraints.some((item) => item.includes('planned work and unexpected problems')));

const unknownPopularityStrategy = deriveAnnunci10xStrategyRules(ANNUNCI10X_METHOD_FIXTURES.unknownPopularity.strategyInput);
assert.equal(unknownPopularityStrategy.preservedRolePopularity, 'UNKNOWN');
assert.ok(unknownPopularityStrategy.constraints.some((item) => item.includes('must not be coerced')));

assert.equal(evaluateAnnunci10xCompleteness({ roleCard, compensationKnown: true }).status, 'COMPLETE');
assert.equal(evaluateAnnunci10xCompleteness({ roleCard, compensationKnown: false, compensationRequired: false }).status, 'GENERABLE_WITH_VERIFICATION');
assert.equal(evaluateAnnunci10xCompleteness({ roleCard, workModeConflict: true }).status, 'BLOCKED');
assert.equal(evaluateAnnunci10xCompleteness({ roleCard: { ...roleCard, mission: undefined, outcomes: [], responsibilities: [] } }).status, 'BLOCKED');
assert.equal(evaluateAnnunci10xCompleteness({ roleCard, unsupportedGeneratedClaim: true }).status, 'GENERABLE_WITH_VERIFICATION');

assert.equal(validateAdEvaluation({
  id: 'evaluation-1',
  sessionId: 'session-1',
  target: { kind: 'GENERATED_MASTER', generatedAdId: 'master-1' },
  score,
  gate: blockedGate,
  createdAt: now,
}).ok, true, 'PublicationStatus must be separate from score');

assert.deepEqual(PRODUCT_CODES, ['GUIDE', 'AD_GENERATION', 'GUIDE_PLUS_AD']);
for (const product of PRODUCT_CODES) assert.equal(validateProductCode(product), true, `ProductCode ${product} should validate`);

assert.equal(validateAnnunci10xSession({
  id: 'session-1',
  state: 'USER_CONFIRMED',
  entryMode: 'BUILD',
  createdAt: now,
  updatedAt: now,
  commercialContext,
}).ok, true, 'server-verified entitlements should validate');

assert.equal(validateAnnunci10xSession({
  id: 'session-2',
  state: 'USER_CONFIRMED',
  entryMode: 'BUILD',
  createdAt: now,
  updatedAt: now,
  commercialContext: {
    ...commercialContext,
    entitlements: { ...serverEntitlements, verification: 'CLIENT_DECLARED' },
  },
}).ok, false, 'client-declared entitlements must be rejected');

assert.equal(canTransition('COLLECTING', 'PAYMENT_REQUIRED', { flow: 'CREATE', roleCard }).allowed, false, 'cannot require payment too early');
assert.equal(canTransition('ROLE_CARD_READY', 'USER_CONFIRMED', { flow: 'CREATE', roleCard }).allowed, true, 'valid RoleCard can be confirmed');
assert.equal(canTransition('USER_CONFIRMED', 'PAYMENT_REQUIRED', { flow: 'CREATE', roleCard, openClarifications: [] }).allowed, true, 'confirmed valid RoleCard can require payment');
assert.equal(canTransition('USER_CONFIRMED', 'PAYMENT_REQUIRED', { flow: 'CREATE', roleCard, openClarifications: [blockingClarification] }).allowed, false, 'blocking clarification prevents payment');
assert.equal(canTransition('COLLECTING', 'PAYMENT_REQUIRED', { flow: 'CREATE', roleCard, openClarifications: [] }).allowed, false, 'GUIDE entitlement does not skip questionnaire or confirmation');
assert.equal(canTransition('STARTED', 'PAYMENT_REQUIRED', { flow: 'GUIDE', roleCard }).allowed, false, 'Guide purchase is independent from editorial state machine');

assert.equal(validateGeneratedAd(master).ok, true);
assert.equal(validateClaimCheck({
  id: 'claim-1',
  claim: 'Affiancamento iniziale disponibile',
  status: 'SUPPORTED',
  sourceFactIds: ['answer-attraction'],
  publishable: true,
}).ok, true);
assert.equal(validateClaimCheck({
  id: 'claim-2',
  claim: 'Benefit non confermato',
  status: 'UNSUPPORTED',
  sourceFactIds: [],
  publishable: true,
}).ok, false, 'unsupported claims cannot be publishable');

const channelVariant = {
  id: 'variant-1',
  masterAdId: 'master-1',
  channel: 'LINKEDIN',
  sections: [generatedSection],
  introducedFactIds: [],
  adaptedFromMaster: true,
};
assert.equal(validateChannelVariant(channelVariant, master).ok, true, 'ChannelVariant must reference its master');
assert.equal(validateChannelVariant({ ...channelVariant, masterAdId: 'other-master' }, master).ok, false, 'ChannelVariant with wrong master should fail');
assert.equal(validateChannelVariant({ ...channelVariant, introducedFactIds: ['invented-fact'] }, master).ok, false, 'ChannelVariant cannot introduce facts');

assert.equal(validateCommunicationStrategy({
  id: 'strategy-1',
  sessionId: 'session-1',
  summary: 'Lead with challenge and concrete outcomes.',
  candidateAngle: 'Commercial profile seeking autonomy and measurable goals.',
  emphasis: { challenge: 'HIGH', routine: 'MEDIUM', qualification: 'MEDIUM', commitment: 'HIGH', technicality: 'LOW' },
  proofPoints: [confirmed('Obiettivi condivisi', 'answer-proof')],
  reasons: [{ id: 'reason-1', label: 'Role has explicit outcomes', factIds: ['answer-outcome'] }],
  riskNotes: [],
  missingFacts: [],
  channelPriorities: ['LINKEDIN'],
  versions,
}).ok, true);

assert.equal(validateInterviewDecision({ askNext: [blockingClarification], stopReason: 'BLOCKED' }).ok, true);
assert.equal(validateRoleCard({ malformed: true }).ok, false, 'runtime schema rejects malformed RoleCard payload');

console.log('Annunci 10x verifier passed');
