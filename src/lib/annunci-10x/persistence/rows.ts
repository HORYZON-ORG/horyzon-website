import {
  ANNUNCI10X_DATA_CONTRACT_VERSION,
  ANNUNCI10X_METHOD_VERSION,
  ANNUNCI10X_PROMPT_PACK_VERSION,
  ANNUNCI10X_RUBRIC_VERSION,
  ANNUNCI10X_RUBRIC_VERSION_V2,
  ANNUNCI10X_STRATEGY_VERSION,
} from '../constants.ts';
import { validateScoreResultV2 } from '../score-v2.ts';
import {
  validateChannelVariant,
  validateCommercialContext,
  validateCommunicationStrategy,
  validateGeneratedAd,
  validatePublicationGate,
  validateRoleCard,
  validateRoleProfile,
  validateScoreResult,
} from '../validation.ts';
import type { Annunci10xSession, ChannelVariant, EvaluationTarget, GeneratedAd } from '../types.ts';
import type {
  Annunci10xOutputType,
  Annunci10xPersistenceFlow,
  PersistedAnalysisRun,
  PersistedAiOperation,
  PersistedAnnunci10xSession,
  PersistedAnswer,
  PersistedEmailDelivery,
  PersistedEmailVerification,
  PersistedEntitlementGrant,
  PersistedEvaluation,
  PersistedEvent,
  PersistedLead,
  PersistedOutput,
  PersistedPurchase,
  PersistedSnapshot,
  PersistedStripeEvent,
  EffectiveEntitlements,
} from './types.ts';

export const ANNUNCI10X_PERSISTENCE_VERSIONS = {
  dataContractVersion: ANNUNCI10X_DATA_CONTRACT_VERSION,
  methodVersion: ANNUNCI10X_METHOD_VERSION,
  rubricVersion: ANNUNCI10X_RUBRIC_VERSION,
  strategyVersion: ANNUNCI10X_STRATEGY_VERSION,
  promptVersion: ANNUNCI10X_PROMPT_PACK_VERSION,
} as const;

export function parseSessionRow(row: Record<string, unknown>): PersistedAnnunci10xSession {
  const commercial = validateCommercialContext(row.commercial_context);
  if (!commercial.ok) throw new Error(`Malformed Annunci 10x commercial_context: ${commercial.errors.join('; ')}`);
  const flow = assertFlow(row.flow);
  const session: Annunci10xSession = {
    id: requireString(row.id, 'session.id'),
    state: requireString(row.state, 'session.state') as Annunci10xSession['state'],
    entryMode: flow === 'CREATE' ? 'BUILD' : 'ANALYZE',
    createdAt: requireString(row.created_at, 'session.created_at'),
    updatedAt: requireString(row.updated_at, 'session.updated_at'),
    commercialContext: commercial.value,
    currentSnapshotId: optionalString(row.current_snapshot_id) ?? undefined,
  };
  return {
    ...session,
    flow,
    selectedChannel: optionalString(row.selected_channel) as PersistedAnnunci10xSession['selectedChannel'],
    expiresAt: optionalString(row.expires_at),
  };
}

export function parseAnswerRow(row: Record<string, unknown>): PersistedAnswer {
  return {
    id: requireString(row.id, 'answer.id'),
    sessionId: requireString(row.session_id, 'answer.session_id'),
    interviewStep: requireString(row.interview_step, 'answer.interview_step') as PersistedAnswer['interviewStep'],
    questionId: requireString(row.question_id, 'answer.question_id'),
    clarificationId: optionalString(row.clarification_id),
    rawAnswer: requireString(row.raw_answer, 'answer.raw_answer'),
    createdAt: requireString(row.created_at, 'answer.created_at'),
  };
}

export function parseSnapshotRow(row: Record<string, unknown>): PersistedSnapshot {
  const roleCard = validateRoleCard(row.role_card);
  if (!roleCard.ok) throw new Error(`Malformed Annunci 10x role_card JSONB: ${roleCard.errors.join('; ')}`);
  const roleProfile = row.role_profile === null || row.role_profile === undefined ? null : validateRoleProfile(row.role_profile);
  if (roleProfile && !roleProfile.ok) throw new Error(`Malformed Annunci 10x role_profile JSONB: ${roleProfile.errors.join('; ')}`);
  const strategy = row.communication_strategy === null || row.communication_strategy === undefined ? null : validateCommunicationStrategy(row.communication_strategy);
  if (strategy && !strategy.ok) throw new Error(`Malformed Annunci 10x communication_strategy JSONB: ${strategy.errors.join('; ')}`);

  return {
    id: requireString(row.id, 'snapshot.id'),
    sessionId: requireString(row.session_id, 'snapshot.session_id'),
    version: requireNumber(row.version, 'snapshot.version'),
    roleCard: roleCard.value,
    roleProfile: roleProfile?.value ?? null,
    communicationStrategy: strategy?.value ?? null,
    reason: requireString(row.reason, 'snapshot.reason') as PersistedSnapshot['reason'],
    createdAt: requireString(row.created_at, 'snapshot.created_at'),
  };
}

export function parseAiOperationRow(row: Record<string, unknown>): PersistedAiOperation {
  return {
    id: requireString(row.id, 'operation.id'),
    sessionId: requireString(row.session_id, 'operation.session_id'),
    operationType: requireString(row.operation_type, 'operation.operation_type') as PersistedAiOperation['operationType'],
    status: requireString(row.status, 'operation.status') as PersistedAiOperation['status'],
    inputSnapshotId: optionalString(row.input_snapshot_id),
    outputSnapshotId: optionalString(row.output_snapshot_id),
    outputPayload: optionalRecord(row.output_payload, 'operation.output_payload'),
    model: optionalString(row.model),
    promptVersion: requireString(row.prompt_version, 'operation.prompt_version'),
    idempotencyKey: requireString(row.idempotency_key, 'operation.idempotency_key'),
    startedAt: requireString(row.started_at, 'operation.started_at'),
    completedAt: optionalString(row.completed_at),
    errorPayload: optionalRecord(row.error_payload, 'operation.error_payload'),
  };
}

export function parseEvaluationRow(row: Record<string, unknown>): PersistedEvaluation {
  const isV2 = row.rubric_version === ANNUNCI10X_RUBRIC_VERSION_V2
    || (typeof row.score_result === 'object' && row.score_result !== null && (row.score_result as Record<string, unknown>).rubricVersion === ANNUNCI10X_RUBRIC_VERSION_V2);
  const score = isV2 ? validateScoreResultV2(row.score_result) : validateScoreResult(row.score_result);
  if (!score.ok) throw new Error(`Malformed Annunci 10x score_result JSONB: ${score.errors.join('; ')}`);
  const gate = isV2 ? validateV2GateEnvelope(row.gates) : validatePublicationGate(row.gates);
  if (!gate.ok) throw new Error(`Malformed Annunci 10x gates JSONB: ${gate.errors.join('; ')}`);
  return {
    id: requireString(row.id, 'evaluation.id'),
    sessionId: requireString(row.session_id, 'evaluation.session_id'),
    target: requireString(row.target, 'evaluation.target') as EvaluationTarget['kind'],
    targetRef: requireString(row.target_ref, 'evaluation.target_ref'),
    targetOutputId: optionalString(row.target_output_id),
    score: score.value,
    gate: isV2 ? null : gate.value,
    createdAt: requireString(row.created_at, 'evaluation.created_at'),
  };
}

export function parseAnalysisRunRow(row: Record<string, unknown>): PersistedAnalysisRun {
  return {
    id: requireString(row.id, 'analysisRun.id'),
    sessionId: requireString(row.session_id, 'analysisRun.session_id'),
    sourceKind: requireString(row.source_kind, 'analysisRun.source_kind') as PersistedAnalysisRun['sourceKind'],
    sourceStatus: requireString(row.source_status, 'analysisRun.source_status') as PersistedAnalysisRun['sourceStatus'],
    sourceUrl: optionalString(row.source_url),
    originalInput: requireString(row.original_input, 'analysisRun.original_input'),
    fetchedText: optionalString(row.fetched_text),
    targetText: optionalString(row.target_text),
    retrievalMetadata: optionalRecord(row.retrieval_metadata, 'analysisRun.retrieval_metadata') ?? {},
    targetKind: requireString(row.target_kind, 'analysisRun.target_kind') as PersistedAnalysisRun['targetKind'],
    declaredChannel: optionalString(row.declared_channel) as PersistedAnalysisRun['declaredChannel'],
    sourceHash: requireString(row.source_hash, 'analysisRun.source_hash'),
    inputIdentity: requireString(row.input_identity, 'analysisRun.input_identity'),
    methodVersion: requireString(row.method_version, 'analysisRun.method_version'),
    rubricVersion: requireString(row.rubric_version, 'analysisRun.rubric_version'),
    promptVersion: requireString(row.prompt_version, 'analysisRun.prompt_version'),
    scoreSemanticsVersion: requireString(row.score_semantics_version, 'analysisRun.score_semantics_version'),
    model: requireString(row.model, 'analysisRun.model'),
    provider: requireString(row.provider, 'analysisRun.provider'),
    evaluationMode: requireString(row.evaluation_mode, 'analysisRun.evaluation_mode') as PersistedAnalysisRun['evaluationMode'],
    status: requireString(row.status, 'analysisRun.status') as PersistedAnalysisRun['status'],
    stage: requireString(row.stage, 'analysisRun.stage') as PersistedAnalysisRun['stage'],
    evaluationId: optionalString(row.evaluation_id),
    resultReference: optionalString(row.result_reference),
    operationRefs: optionalRecord(row.operation_refs, 'analysisRun.operation_refs') ?? {},
    errorPayload: optionalRecord(row.error_payload, 'analysisRun.error_payload'),
    attemptCount: requireNumber(row.attempt_count, 'analysisRun.attempt_count'),
    leaseExpiresAt: optionalString(row.lease_expires_at),
    createdAt: requireString(row.created_at, 'analysisRun.created_at'),
    updatedAt: requireString(row.updated_at, 'analysisRun.updated_at'),
    startedAt: optionalString(row.started_at),
    completedAt: optionalString(row.completed_at),
    failedAt: optionalString(row.failed_at),
  };
}

export function parseLeadRow(row: Record<string, unknown>): PersistedLead {
  return {
    id: requireString(row.id, 'lead.id'),
    sessionId: requireString(row.session_id, 'lead.session_id'),
    firstName: requireString(row.first_name, 'lead.first_name'),
    lastName: requireString(row.last_name, 'lead.last_name'),
    companyName: requireString(row.company_name, 'lead.company_name'),
    businessRole: requireString(row.business_role, 'lead.business_role') as PersistedLead['businessRole'],
    emailNormalized: requireString(row.email_normalized, 'lead.email_normalized'),
    emailVerifiedAt: optionalString(row.email_verified_at),
    marketingConsent: row.marketing_consent === true,
    marketingConsentAt: optionalString(row.marketing_consent_at),
    marketingConsentVersion: optionalString(row.marketing_consent_version),
    createdAt: requireString(row.created_at, 'lead.created_at'),
    updatedAt: requireString(row.updated_at, 'lead.updated_at'),
  };
}

export function parseEmailVerificationRow(row: Record<string, unknown>, options: { includeHash?: boolean } = {}): PersistedEmailVerification {
  const parsed: PersistedEmailVerification = {
    id: requireString(row.id, 'emailVerification.id'),
    sessionId: requireString(row.session_id, 'emailVerification.session_id'),
    leadId: requireString(row.lead_id, 'emailVerification.lead_id'),
    emailNormalized: requireString(row.email_normalized, 'emailVerification.email_normalized'),
    status: requireString(row.status, 'emailVerification.status') as PersistedEmailVerification['status'],
    expiresAt: requireString(row.expires_at, 'emailVerification.expires_at'),
    sentAt: optionalString(row.sent_at),
    attemptCount: requireNumber(row.attempt_count, 'emailVerification.attempt_count'),
    maxAttempts: requireNumber(row.max_attempts, 'emailVerification.max_attempts'),
    consumedAt: optionalString(row.consumed_at),
    invalidatedAt: optionalString(row.invalidated_at),
    createdAt: requireString(row.created_at, 'emailVerification.created_at'),
    updatedAt: requireString(row.updated_at, 'emailVerification.updated_at'),
  };
  if (options.includeHash) parsed.codeHash = requireString(row.code_hash, 'emailVerification.code_hash');
  return parsed;
}

export function parseEmailDeliveryRow(row: Record<string, unknown>): PersistedEmailDelivery {
  return {
    id: requireString(row.id, 'emailDelivery.id'),
    sessionId: requireString(row.session_id, 'emailDelivery.session_id'),
    leadId: requireString(row.lead_id, 'emailDelivery.lead_id'),
    analysisRunId: requireString(row.analysis_run_id, 'emailDelivery.analysis_run_id'),
    kind: requireString(row.kind, 'emailDelivery.kind') as PersistedEmailDelivery['kind'],
    recipientNormalized: requireString(row.recipient_normalized, 'emailDelivery.recipient_normalized'),
    status: requireString(row.status, 'emailDelivery.status') as PersistedEmailDelivery['status'],
    provider: optionalString(row.provider),
    providerRequestId: optionalString(row.provider_request_id),
    attemptCount: requireNumber(row.attempt_count, 'emailDelivery.attempt_count'),
    leaseExpiresAt: optionalString(row.lease_expires_at),
    sentAt: optionalString(row.sent_at),
    lastErrorCode: optionalString(row.last_error_code),
    createdAt: requireString(row.created_at, 'emailDelivery.created_at'),
    updatedAt: requireString(row.updated_at, 'emailDelivery.updated_at'),
  };
}

export function parsePurchaseRow(row: Record<string, unknown>): PersistedPurchase {
  return {
    id: requireString(row.id, 'purchase.id'),
    sessionId: requireString(row.session_id, 'purchase.session_id'),
    leadId: requireString(row.lead_id, 'purchase.lead_id'),
    offerCode: requireString(row.offer_code, 'purchase.offer_code') as PersistedPurchase['offerCode'],
    status: requireString(row.status, 'purchase.status') as PersistedPurchase['status'],
    provider: requireString(row.provider, 'purchase.provider') as PersistedPurchase['provider'],
    currency: requireString(row.currency, 'purchase.currency') as PersistedPurchase['currency'],
    expectedAmountCents: requireNumber(row.expected_amount_cents, 'purchase.expected_amount_cents'),
    stripePriceId: optionalString(row.stripe_price_id),
    stripeCheckoutSessionId: optionalString(row.stripe_checkout_session_id),
    stripePaymentIntentId: optionalString(row.stripe_payment_intent_id),
    stripeCustomerId: optionalString(row.stripe_customer_id),
    checkoutCreatedAt: optionalString(row.checkout_created_at),
    paidAt: optionalString(row.paid_at),
    failedAt: optionalString(row.failed_at),
    canceledAt: optionalString(row.canceled_at),
    refundedAt: optionalString(row.refunded_at),
    createdAt: requireString(row.created_at, 'purchase.created_at'),
    updatedAt: requireString(row.updated_at, 'purchase.updated_at'),
  };
}

export function parseEntitlementGrantRow(row: Record<string, unknown>): PersistedEntitlementGrant {
  return {
    id: requireString(row.id, 'entitlementGrant.id'),
    sessionId: requireString(row.session_id, 'entitlementGrant.session_id'),
    leadId: requireString(row.lead_id, 'entitlementGrant.lead_id'),
    purchaseId: requireString(row.purchase_id, 'entitlementGrant.purchase_id'),
    capability: requireString(row.capability, 'entitlementGrant.capability') as PersistedEntitlementGrant['capability'],
    quantity: requireNumber(row.quantity, 'entitlementGrant.quantity'),
    createdAt: requireString(row.created_at, 'entitlementGrant.created_at'),
  };
}

export function parseStripeEventRow(row: Record<string, unknown>): PersistedStripeEvent {
  return {
    id: requireString(row.id, 'stripeEvent.id'),
    stripeEventId: requireString(row.stripe_event_id, 'stripeEvent.stripe_event_id'),
    eventType: requireString(row.event_type, 'stripeEvent.event_type'),
    objectId: optionalString(row.object_id),
    status: requireString(row.status, 'stripeEvent.status') as PersistedStripeEvent['status'],
    errorCode: optionalString(row.error_code),
    attemptCount: requireNumber(row.attempt_count, 'stripeEvent.attempt_count'),
    processingStartedAt: optionalString(row.processing_started_at),
    receivedAt: requireString(row.received_at, 'stripeEvent.received_at'),
    processedAt: optionalString(row.processed_at),
  };
}

export function parseEffectiveEntitlementsRow(row: Record<string, unknown>): EffectiveEntitlements {
  return {
    rewriteCredits: requireNumber(row.rewrite_credits, 'effectiveEntitlements.rewrite_credits'),
    createCredits: requireNumber(row.create_credits, 'effectiveEntitlements.create_credits'),
    guideAccess: row.guide_access === true,
    agentRecruiterAccess: row.agent_recruiter_access === true,
    checkedAt: requireString(row.checked_at, 'effectiveEntitlements.checked_at'),
  };
}

export function parseOutputRow(row: Record<string, unknown>): PersistedOutput {
  const outputType = requireString(row.output_type, 'output.output_type') as Annunci10xOutputType;
  const generatedContent = validateGeneratedContent(outputType, row.generated_content);
  return {
    id: requireString(row.id, 'output.id'),
    sessionId: requireString(row.session_id, 'output.session_id'),
    snapshotId: requireString(row.snapshot_id, 'output.snapshot_id'),
    outputType,
    channel: optionalString(row.channel) as PersistedOutput['channel'],
    generatedContent,
    parentMasterId: optionalString(row.parent_master_id),
    validationState: requireString(row.validation_state, 'output.validation_state') as PersistedOutput['validationState'],
    createdAt: requireString(row.created_at, 'output.created_at'),
  };
}

export function parseEventRow(row: Record<string, unknown>): PersistedEvent {
  return {
    id: requireString(row.id, 'event.id'),
    sessionId: optionalString(row.session_id),
    eventName: requireString(row.event_name, 'event.event_name'),
    metadata: optionalRecord(row.metadata, 'event.metadata') ?? {},
    createdAt: requireString(row.created_at, 'event.created_at'),
  };
}

function validateGeneratedContent(outputType: Annunci10xOutputType, value: unknown): GeneratedAd | ChannelVariant | Record<string, unknown> {
  if (outputType === 'MASTER') {
    const validation = validateGeneratedAd(value);
    if (!validation.ok) throw new Error(`Malformed Annunci 10x generated_content JSONB: ${validation.errors.join('; ')}`);
    return validation.value;
  }
  const validation = validateChannelVariant(value);
  if (!validation.ok) throw new Error(`Malformed Annunci 10x channel variant JSONB: ${validation.errors.join('; ')}`);
  return validation.value;
}

function assertFlow(value: unknown): Annunci10xPersistenceFlow {
  if (value === 'ANALYZE' || value === 'CREATE') return value;
  throw new Error('Malformed Annunci 10x session flow.');
}

function validateV2GateEnvelope(value: unknown): { ok: true; value: null } | { ok: false; errors: string[] } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, errors: ['V2 gates envelope must be an object.'] };
  }
  const record = value as Record<string, unknown>;
  if (record.status !== 'NOT_EVALUATED' || record.reason !== 'V2_SCORE_ONLY') {
    return { ok: false, errors: ['V2 gates envelope must declare NOT_EVALUATED / V2_SCORE_ONLY.'] };
  }
  return { ok: true, value: null };
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${path} must be a non-empty string.`);
  return value;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function requireNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${path} must be a finite number.`);
  return value;
}

function optionalRecord(value: unknown, path: string): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  throw new Error(`${path} must be an object or null.`);
}
