import {
  AI_OPERATION_STATUSES,
  AI_OPERATION_TYPES,
  ANNUNCI10X_ERROR_CODES,
  ANNUNCI10X_RUBRIC_VERSION,
  CHECK_STATUSES,
  CLAIM_CHECK_STATUSES,
  EMPHASIS_VALUES,
  ENTITLEMENT_SOURCES,
  EVALUATION_TARGET_KINDS,
  FACT_SOURCES,
  FACT_STATUSES,
  GENERATED_SECTION_TYPES,
  INTERVIEW_STEP_IDS,
  ORIGINAL_AD_TYPES,
  PRODUCT_CODES,
  PUBLICATION_CHANNELS,
  PUBLICATION_GATE_CODES,
  PUBLICATION_STATUSES,
  PURCHASE_STATUSES,
  REQUIREMENT_CLASSIFICATIONS,
  SESSION_STATES,
} from './constants.ts';
import type {
  AdEvaluation,
  AiOperation,
  Annunci10xError,
  Annunci10xSession,
  Annunci10xSnapshot,
  AttractionContext,
  ChannelVariant,
  ClaimCheck,
  CommercialContext,
  CommunicationStrategy,
  Compensation,
  ContractVersions,
  Entitlements,
  EvaluationCheck,
  EvaluationTarget,
  Fact,
  FactSource,
  FactStatus,
  GeneratedAd,
  GeneratedOutput,
  GeneratedSection,
  OriginalAd,
  ProductCode,
  PublicationGate,
  Purchase,
  Requirement,
  RoleCard,
  RoleProfile,
  ScoreResult,
  UserAnswer,
  InterviewDecision,
  Clarification,
} from './types.ts';

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export function createFact<T>(value: T, source: FactSource, options: Partial<Omit<Fact<T>, 'value' | 'source'>> = {}): Fact<T> {
  const status = options.status ?? (source === 'USER_CONFIRMED' ? 'CONFIRMED' : 'NORMALIZED');
  return {
    value,
    source,
    status,
    confidence: options.confidence,
    publishable: source === 'SYSTEM_INFERRED' ? false : options.publishable ?? source === 'USER_CONFIRMED',
    sourceId: options.sourceId,
    notes: options.notes,
  };
}

export function isFactSource(value: unknown): value is FactSource {
  return isOneOf(value, FACT_SOURCES);
}

export function isFactStatus(value: unknown): value is FactStatus {
  return isOneOf(value, FACT_STATUSES);
}

export function validateFact(value: unknown, path = 'fact'): ValidationResult<Fact<unknown>> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid(`${path} must be an object`);
  if (!('value' in value)) errors.push(`${path}.value is required`);
  if (!isFactSource(value.source)) errors.push(`${path}.source is invalid`);
  if (!isFactStatus(value.status)) errors.push(`${path}.status is invalid`);
  if (typeof value.publishable !== 'boolean') errors.push(`${path}.publishable must be boolean`);
  if (value.confidence !== undefined && !isConfidence(value.confidence)) errors.push(`${path}.confidence must be 0-100`);
  if (value.source === 'SYSTEM_INFERRED' && value.publishable === true) errors.push(`${path} SYSTEM_INFERRED cannot be publishable`);
  if (value.source === 'SYSTEM_INFERRED' && value.status === 'CONFIRMED') errors.push(`${path} SYSTEM_INFERRED is not USER_CONFIRMED`);
  return errors.length ? { ok: false, errors } : { ok: true, value: value as unknown as Fact<unknown> };
}

export function validateOriginalAd(value: unknown): ValidationResult<OriginalAd> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid('originalAd must be an object');
  requireString(value.id, 'originalAd.id', errors);
  requireString(value.sessionId, 'originalAd.sessionId', errors);
  if (!isOneOf(value.type, ORIGINAL_AD_TYPES)) errors.push('originalAd.type is invalid');
  requireString(value.rawText, 'originalAd.rawText', errors);
  requireString(value.uploadedAt, 'originalAd.uploadedAt', errors);
  if (value.immutable !== true) errors.push('originalAd.immutable must be true');
  if (value.language !== undefined) append(errors, validateFact(value.language, 'originalAd.language'));
  return result(value, errors);
}

export function validateRequirement(value: unknown, path = 'requirement'): ValidationResult<Requirement> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid(`${path} must be an object`);
  requireString(value.id, `${path}.id`, errors);
  append(errors, validateFact(value.label, `${path}.label`));
  if (!isOneOf(value.classification, REQUIREMENT_CLASSIFICATIONS)) errors.push(`${path}.classification is invalid`);
  if (value.evidence !== undefined) append(errors, validateFact(value.evidence, `${path}.evidence`));
  return result(value, errors);
}

export function validateCompensation(value: unknown): ValidationResult<Compensation> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid('compensation must be an object');
  for (const key of ['amountText', 'minAmount', 'maxAmount', 'currency', 'cadence'] as const) {
    if (value[key] !== undefined) append(errors, validateFact(value[key], `compensation.${key}`));
  }
  append(errors, validateFact(value.visibility, 'compensation.visibility'));
  return result(value, errors);
}

export function validateAttractionContext(value: unknown): ValidationResult<AttractionContext> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid('attractionContext must be an object');
  for (const key of ['companyName', 'companyDescription', 'workMode', 'location', 'contractType', 'schedule', 'growth', 'teamContext'] as const) {
    if (value[key] !== undefined) append(errors, validateFact(value[key], `attractionContext.${key}`));
  }
  validateArray(value.attractivenessEvidence, 'attractionContext.attractivenessEvidence', errors, validateFact);
  return result(value, errors);
}

export function validateRoleCard(value: unknown): ValidationResult<RoleCard> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid('roleCard must be an object');
  append(errors, validateRequiredFact(value.title, 'roleCard.title'));
  append(errors, validateRequiredFact(value.mission, 'roleCard.mission'));
  validateArray(value.outcomes, 'roleCard.outcomes', errors, validateFact);
  validateArray(value.responsibilities, 'roleCard.responsibilities', errors, validateFact);
  validateArray(value.requirements, 'roleCard.requirements', errors, validateRequirement);
  append(errors, validateAttractionContext(value.attractionContext));
  if (value.compensation !== undefined) append(errors, validateCompensation(value.compensation));
  if (Array.isArray(value.outcomes) && value.outcomes.length === 0) errors.push('roleCard.outcomes needs at least one item');
  if (Array.isArray(value.responsibilities) && value.responsibilities.length === 0) errors.push('roleCard.responsibilities needs at least one item');
  if (Array.isArray(value.requirements) && !value.requirements.some((item) => isRecord(item) && item.classification === 'REQUIRED')) {
    errors.push('roleCard.requirements needs at least one REQUIRED item');
  }
  return result(value, errors);
}

export function hasMinimumRoleCard(roleCard: unknown): roleCard is RoleCard {
  return validateRoleCard(roleCard).ok;
}

export function validateRoleProfile(value: unknown): ValidationResult<RoleProfile> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid('roleProfile must be an object');
  append(errors, validateRoleCard(value.roleCard));
  for (const key of ['rolePopularity', 'companyAttractiveness', 'challengeLevel', 'routineLevel', 'qualificationLevel', 'commitmentLevel', 'technicality'] as const) {
    if (value[key] !== undefined) {
      append(errors, validateFact(value[key], `roleProfile.${key}`));
      if (isRecord(value[key]) && !isOneOf(value[key].value, EMPHASIS_VALUES)) errors.push(`roleProfile.${key}.value is invalid`);
    }
  }
  return result(value, errors);
}

export function validateCommunicationStrategy(value: unknown): ValidationResult<CommunicationStrategy> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid('communicationStrategy must be an object');
  requireString(value.id, 'communicationStrategy.id', errors);
  requireString(value.sessionId, 'communicationStrategy.sessionId', errors);
  requireString(value.summary, 'communicationStrategy.summary', errors);
  requireString(value.candidateAngle, 'communicationStrategy.candidateAngle', errors);
  if (!isRecord(value.emphasis)) errors.push('communicationStrategy.emphasis must be an object');
  else for (const key of ['challenge', 'routine', 'qualification', 'commitment', 'technicality']) if (!isOneOf(value.emphasis[key], EMPHASIS_VALUES)) errors.push(`communicationStrategy.emphasis.${key} is invalid`);
  validateArray(value.proofPoints, 'communicationStrategy.proofPoints', errors, validateFact);
  validateArray(value.reasons, 'communicationStrategy.reasons', errors, validateStrategyReason);
  validateStringArray(value.riskNotes, 'communicationStrategy.riskNotes', errors);
  validateArray(value.missingFacts, 'communicationStrategy.missingFacts', errors, validateClarification);
  validateArray(value.channelPriorities, 'communicationStrategy.channelPriorities', errors, (item, path) => isOneOf(item, PUBLICATION_CHANNELS) ? { ok: true, value: item } : invalid(`${path} is invalid`));
  append(errors, validateVersions(value.versions));
  return result(value, errors);
}

export function validateClarification(value: unknown, path = 'clarification'): ValidationResult<Clarification> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid(`${path} must be an object`);
  requireString(value.id, `${path}.id`, errors);
  if (!isOneOf(value.stepId, INTERVIEW_STEP_IDS)) errors.push(`${path}.stepId is invalid`);
  requireString(value.fieldKey, `${path}.fieldKey`, errors);
  requireString(value.question, `${path}.question`, errors);
  requireString(value.reason, `${path}.reason`, errors);
  if (!isOneOf(value.requiredFor, ['SCORE', 'GATE', 'GENERATION', 'CHANNEL_ADAPTER'] as const)) errors.push(`${path}.requiredFor is invalid`);
  if (!isOneOf(value.priority, ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const)) errors.push(`${path}.priority is invalid`);
  if (typeof value.blocking !== 'boolean') errors.push(`${path}.blocking must be boolean`);
  if (typeof value.answered !== 'boolean') errors.push(`${path}.answered must be boolean`);
  return result(value, errors);
}

export function validateInterviewDecision(value: unknown): ValidationResult<InterviewDecision> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid('interviewDecision must be an object');
  validateArray(value.askNext, 'interviewDecision.askNext', errors, validateClarification);
  if (value.stopReason !== undefined && !isOneOf(value.stopReason, ['ENOUGH_FOR_ANALYSIS', 'ENOUGH_FOR_GENERATION', 'USER_SKIPPED', 'BLOCKED'] as const)) errors.push('interviewDecision.stopReason is invalid');
  return result(value, errors);
}

export function validateUserAnswer(value: unknown): ValidationResult<UserAnswer> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid('userAnswer must be an object');
  requireString(value.id, 'userAnswer.id', errors);
  requireString(value.sessionId, 'userAnswer.sessionId', errors);
  requireString(value.questionKey, 'userAnswer.questionKey', errors);
  if (typeof value.rawAnswer !== 'string') errors.push('userAnswer.rawAnswer must be string');
  if (!isOneOf(value.answerKind, ['KNOWN', 'UNKNOWN', 'NOT_APPLICABLE'] as const)) errors.push('userAnswer.answerKind is invalid');
  validateArray(value.normalizedFacts, 'userAnswer.normalizedFacts', errors, validateFact);
  requireString(value.answeredAt, 'userAnswer.answeredAt', errors);
  return result(value, errors);
}

export function validateEvaluationTarget(value: unknown): ValidationResult<EvaluationTarget> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid('evaluationTarget must be an object');
  if (!isOneOf(value.kind, EVALUATION_TARGET_KINDS)) errors.push('evaluationTarget.kind is invalid');
  if (value.kind === 'ORIGINAL_AD') requireString(value.originalAdId, 'evaluationTarget.originalAdId', errors);
  if (value.kind === 'GENERATED_MASTER') requireString(value.generatedAdId, 'evaluationTarget.generatedAdId', errors);
  if (value.kind === 'CHANNEL_VARIANT') {
    requireString(value.channelVariantId, 'evaluationTarget.channelVariantId', errors);
    requireString(value.masterAdId, 'evaluationTarget.masterAdId', errors);
  }
  return result(value, errors);
}

export function validateEvaluationCheck(value: unknown, path = 'evaluationCheck'): ValidationResult<EvaluationCheck> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid(`${path} must be an object`);
  requireString(value.id, `${path}.id`, errors);
  requireString(value.label, `${path}.label`, errors);
  if (!(value.score === null || isNonNegativeNumber(value.score))) errors.push(`${path}.score must be number or null`);
  if (!isPositiveNumber(value.maxScore)) errors.push(`${path}.maxScore must be positive number`);
  if (!isOneOf(value.status, CHECK_STATUSES)) errors.push(`${path}.status is invalid`);
  validateStringArray(value.evidence, `${path}.evidence`, errors);
  if (value.gateImpact !== undefined && !isOneOf(value.gateImpact, ['NONE', 'WARNING', 'BLOCKING'] as const)) errors.push(`${path}.gateImpact is invalid`);
  return result(value, errors);
}

export function validateAdEvaluation(value: unknown): ValidationResult<AdEvaluation> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid('adEvaluation must be an object');
  requireString(value.id, 'adEvaluation.id', errors);
  requireString(value.sessionId, 'adEvaluation.sessionId', errors);
  append(errors, validateEvaluationTarget(value.target));
  append(errors, validateScoreResult(value.score));
  append(errors, validatePublicationGate(value.gate));
  requireString(value.createdAt, 'adEvaluation.createdAt', errors);
  return result(value, errors);
}

export function validateGeneratedAd(value: unknown): ValidationResult<GeneratedAd> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid('generatedAd must be an object');
  requireString(value.id, 'generatedAd.id', errors);
  requireString(value.sessionId, 'generatedAd.sessionId', errors);
  if (value.kind !== 'MASTER') errors.push('generatedAd.kind must be MASTER');
  validateArray(value.sections, 'generatedAd.sections', errors, validateGeneratedSection);
  if (value.sourceOfTruth !== true) errors.push('generatedAd.sourceOfTruth must be true');
  requireString(value.generatedAt, 'generatedAd.generatedAt', errors);
  requireString(value.promptVersion, 'generatedAd.promptVersion', errors);
  return result(value, errors);
}

export function validateClaimCheck(value: unknown, path = 'claimCheck'): ValidationResult<ClaimCheck> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid(`${path} must be an object`);
  requireString(value.id, `${path}.id`, errors);
  requireString(value.claim, `${path}.claim`, errors);
  if (!isOneOf(value.status, CLAIM_CHECK_STATUSES)) errors.push(`${path}.status is invalid`);
  validateStringArray(value.sourceFactIds, `${path}.sourceFactIds`, errors);
  if (typeof value.publishable !== 'boolean') errors.push(`${path}.publishable must be boolean`);
  if ((value.status === 'UNSUPPORTED' || value.status === 'CONTRADICTED') && value.publishable) errors.push(`${path} unsupported or contradicted claims are not publishable`);
  return result(value, errors);
}

export function validateChannelVariant(value: unknown, master?: GeneratedAd): ValidationResult<ChannelVariant> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid('channelVariant must be an object');
  requireString(value.id, 'channelVariant.id', errors);
  requireString(value.masterAdId, 'channelVariant.masterAdId', errors);
  if (master && value.masterAdId !== master.id) errors.push('channelVariant.masterAdId must reference the master ad');
  if (!isOneOf(value.channel, PUBLICATION_CHANNELS)) errors.push('channelVariant.channel is invalid');
  validateArray(value.sections, 'channelVariant.sections', errors, validateGeneratedSection);
  if (!Array.isArray(value.introducedFactIds) || value.introducedFactIds.length !== 0) errors.push('channelVariant.introducedFactIds must be empty');
  if (value.adaptedFromMaster !== true) errors.push('channelVariant.adaptedFromMaster must be true');
  return result(value, errors);
}

export function validateAnnunci10xSession(value: unknown): ValidationResult<Annunci10xSession> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid('session must be an object');
  requireString(value.id, 'session.id', errors);
  if (!isOneOf(value.state, SESSION_STATES)) errors.push('session.state is invalid');
  if (!isOneOf(value.entryMode, ['ANALYZE', 'BUILD', 'GUIDE'] as const)) errors.push('session.entryMode is invalid');
  requireString(value.createdAt, 'session.createdAt', errors);
  requireString(value.updatedAt, 'session.updatedAt', errors);
  append(errors, validateCommercialContext(value.commercialContext));
  return result(value, errors);
}

export function validateEntitlements(value: unknown): ValidationResult<Entitlements> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid('entitlements must be an object');
  for (const key of ['guide', 'adGeneration', 'bundle'] as const) if (typeof value[key] !== 'boolean') errors.push(`entitlements.${key} must be boolean`);
  if (!isOneOf(value.source, ENTITLEMENT_SOURCES)) errors.push('entitlements.source is invalid');
  if (value.verification !== 'SERVER_VERIFIED') errors.push('entitlements.verification must be SERVER_VERIFIED');
  requireString(value.checkedAt, 'entitlements.checkedAt', errors);
  requireString(value.serverAuthorityId, 'entitlements.serverAuthorityId', errors);
  return result(value, errors);
}

export function validatePurchase(value: unknown): ValidationResult<Purchase> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid('purchase must be an object');
  requireString(value.id, 'purchase.id', errors);
  if (!isOneOf(value.productCode, PRODUCT_CODES)) errors.push('purchase.productCode is invalid');
  if (!isOneOf(value.status, PURCHASE_STATUSES)) errors.push('purchase.status is invalid');
  if (value.provider !== 'OPEN_DECISION') errors.push('purchase.provider must be OPEN_DECISION');
  if (value.amount !== 'OPEN_DECISION') errors.push('purchase.amount must be OPEN_DECISION');
  if (value.currency !== 'OPEN_DECISION') errors.push('purchase.currency must be OPEN_DECISION');
  requireString(value.createdAt, 'purchase.createdAt', errors);
  if (value.status === 'PAID') {
    requireString(value.serverReceiptId, 'purchase.serverReceiptId', errors);
    requireString(value.verifiedAt, 'purchase.verifiedAt', errors);
  }
  return result(value, errors);
}

export function validateProductCode(value: unknown): value is ProductCode {
  return isOneOf(value, PRODUCT_CODES);
}

export function validateGeneratedOutput(value: unknown): ValidationResult<GeneratedOutput> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid('generatedOutput must be an object');
  requireString(value.id, 'generatedOutput.id', errors);
  requireString(value.sessionId, 'generatedOutput.sessionId', errors);
  const master = validateGeneratedAd(value.master);
  append(errors, master);
  append(errors, validateScoreResult(value.score));
  append(errors, validatePublicationGate(value.gate));
  validateArray(value.claimCheck, 'generatedOutput.claimCheck', errors, validateClaimCheck);
  validateArray(value.channelVariants, 'generatedOutput.channelVariants', errors, (item) => validateChannelVariant(item, master.ok ? master.value : undefined));
  append(errors, validateCommercialContext(value.commercialContext));
  append(errors, validateVersions(value.versions));
  return result(value, errors);
}

export function validateAiOperation(value: unknown): ValidationResult<AiOperation> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid('aiOperation must be an object');
  requireString(value.id, 'aiOperation.id', errors);
  requireString(value.sessionId, 'aiOperation.sessionId', errors);
  if (!isOneOf(value.type, AI_OPERATION_TYPES)) errors.push('aiOperation.type is invalid');
  requireString(value.idempotencyKey, 'aiOperation.idempotencyKey', errors);
  requireString(value.inputSnapshotId, 'aiOperation.inputSnapshotId', errors);
  requireString(value.promptVersion, 'aiOperation.promptVersion', errors);
  requireString(value.modelConfigKey, 'aiOperation.modelConfigKey', errors);
  if (!isOneOf(value.status, AI_OPERATION_STATUSES)) errors.push('aiOperation.status is invalid');
  if (typeof value.schemaValid !== 'boolean') errors.push('aiOperation.schemaValid must be boolean');
  if (value.retryCount !== 0 && value.retryCount !== 1) errors.push('aiOperation.retryCount must be 0 or 1');
  requireString(value.createdAt, 'aiOperation.createdAt', errors);
  return result(value, errors);
}

export function validateAnnunci10xError(value: unknown): ValidationResult<Annunci10xError> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid('annunci10xError must be an object');
  if (!isOneOf(value.code, ANNUNCI10X_ERROR_CODES)) errors.push('annunci10xError.code is invalid');
  requireString(value.message, 'annunci10xError.message', errors);
  if (typeof value.retryable !== 'boolean') errors.push('annunci10xError.retryable must be boolean');
  return result(value, errors);
}

export function validateSnapshot(value: unknown): ValidationResult<Annunci10xSnapshot> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid('snapshot must be an object');
  requireString(value.id, 'snapshot.id', errors);
  requireString(value.sessionId, 'snapshot.sessionId', errors);
  requireString(value.createdAt, 'snapshot.createdAt', errors);
  append(errors, validateVersions(value.versions));
  if (!('payload' in value)) errors.push('snapshot.payload is required');
  return result(value, errors);
}

export function validateCommercialContext(value: unknown): ValidationResult<CommercialContext> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid('commercialContext must be an object');
  if (value.productCode !== undefined && !isOneOf(value.productCode, PRODUCT_CODES)) errors.push('commercialContext.productCode is invalid');
  append(errors, validateEntitlements(value.entitlements));
  if (typeof value.reservedOfferEligible !== 'boolean') errors.push('commercialContext.reservedOfferEligible must be boolean');
  if (value.reservedOfferReason !== undefined && !isOneOf(value.reservedOfferReason, ['OWNS_GUIDE', 'BUNDLE', 'NONE'] as const)) errors.push('commercialContext.reservedOfferReason is invalid');
  if (value.price !== 'OPEN_DECISION') errors.push('commercialContext.price must be OPEN_DECISION');
  if (value.discountValue !== 'OPEN_DECISION') errors.push('commercialContext.discountValue must be OPEN_DECISION');
  return result(value, errors);
}

export function validateScoreResult(value: unknown): ValidationResult<ScoreResult> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid('scoreResult must be an object');
  if (!(value.value === null || isNonNegativeNumber(value.value))) errors.push('scoreResult.value must be number or null');
  if (value.max !== 100) errors.push('scoreResult.max must be 100');
  if (!isPercent(value.coverage)) errors.push('scoreResult.coverage must be 0-100');
  validateArray(value.checks, 'scoreResult.checks', errors, validateEvaluationCheck);
  if (value.rubricVersion !== ANNUNCI10X_RUBRIC_VERSION) errors.push('scoreResult.rubricVersion is invalid');
  return result(value, errors);
}

export function validatePublicationGate(value: unknown): ValidationResult<PublicationGate> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid('publicationGate must be an object');
  if (!isOneOf(value.status, PUBLICATION_STATUSES)) errors.push('publicationGate.status is invalid');
  validateArray(value.codes, 'publicationGate.codes', errors, (item, path) => isOneOf(item, PUBLICATION_GATE_CODES) ? { ok: true, value: item } : invalid(`${path} is invalid`));
  validateStringArray(value.blockingReasons, 'publicationGate.blockingReasons', errors);
  validateStringArray(value.warnings, 'publicationGate.warnings', errors);
  requireString(value.evaluatedAt, 'publicationGate.evaluatedAt', errors);
  return result(value, errors);
}

function validateGeneratedSection(value: unknown, path = 'generatedSection'): ValidationResult<GeneratedSection> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid(`${path} must be an object`);
  requireString(value.id, `${path}.id`, errors);
  if (!isOneOf(value.type, GENERATED_SECTION_TYPES)) errors.push(`${path}.type is invalid`);
  requireString(value.key, `${path}.key`, errors);
  requireString(value.title, `${path}.title`, errors);
  requireString(value.body, `${path}.body`, errors);
  validateStringArray(value.sourceFactIds, `${path}.sourceFactIds`, errors);
  return result(value, errors);
}

function validateStrategyReason(value: unknown, path = 'strategyReason'): ValidationResult<unknown> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid(`${path} must be an object`);
  requireString(value.id, `${path}.id`, errors);
  requireString(value.label, `${path}.label`, errors);
  validateStringArray(value.factIds, `${path}.factIds`, errors);
  return result(value, errors);
}

function validateVersions(value: unknown): ValidationResult<ContractVersions> {
  const errors: string[] = [];
  if (!isRecord(value)) return invalid('versions must be an object');
  for (const key of ['dataContractVersion', 'methodVersion', 'rubricVersion', 'strategyVersion', 'promptVersion'] as const) requireString(value[key], `versions.${key}`, errors);
  return result(value, errors);
}

function validateRequiredFact(value: unknown, path: string): ValidationResult<Fact<unknown>> {
  const validation = validateFact(value, path);
  if (!validation.ok) return validation;
  if (typeof validation.value.value === 'string' && validation.value.value.trim()) return validation;
  return invalid(`${path}.value must be a non-empty string`);
}

function validateArray<T>(value: unknown, path: string, errors: string[], validator: (item: unknown, path: string) => ValidationResult<T>): void {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return;
  }
  value.forEach((item, index) => append(errors, validator(item, `${path}[${index}]`)));
}

function validateStringArray(value: unknown, path: string, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return;
  }
  value.forEach((item, index) => {
    if (typeof item !== 'string') errors.push(`${path}[${index}] must be string`);
  });
}

function append(errors: string[], validation: ValidationResult<unknown>): void {
  if (!validation.ok) errors.push(...validation.errors);
}

function result<T>(value: unknown, errors: string[]): ValidationResult<T> {
  return errors.length ? { ok: false, errors } : { ok: true, value: value as T };
}

function invalid(message: string): ValidationResult<never> {
  return { ok: false, errors: [message] };
}

function requireString(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== 'string' || !value.trim()) errors.push(`${path} must be a non-empty string`);
}

function isConfidence(value: unknown): boolean {
  return isPercent(value);
}

function isPercent(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

function isNonNegativeNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isPositiveNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOneOf<const T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}
