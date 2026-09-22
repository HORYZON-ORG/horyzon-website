import {
  ANNUNCI10X_DATA_CONTRACT_VERSION,
  ANNUNCI10X_METHOD_VERSION,
  ANNUNCI10X_PROMPT_PACK_VERSION,
  ANNUNCI10X_RUBRIC_VERSION,
  ANNUNCI10X_STRATEGY_VERSION,
} from '../constants.ts';
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
  PersistedAiOperation,
  PersistedAnnunci10xSession,
  PersistedAnswer,
  PersistedEvaluation,
  PersistedEvent,
  PersistedOutput,
  PersistedSnapshot,
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
  const score = validateScoreResult(row.score_result);
  if (!score.ok) throw new Error(`Malformed Annunci 10x score_result JSONB: ${score.errors.join('; ')}`);
  const gate = validatePublicationGate(row.gates);
  if (!gate.ok) throw new Error(`Malformed Annunci 10x gates JSONB: ${gate.errors.join('; ')}`);
  return {
    id: requireString(row.id, 'evaluation.id'),
    sessionId: requireString(row.session_id, 'evaluation.session_id'),
    target: requireString(row.target, 'evaluation.target') as EvaluationTarget['kind'],
    targetRef: requireString(row.target_ref, 'evaluation.target_ref'),
    targetOutputId: optionalString(row.target_output_id),
    score: score.value,
    gate: gate.value,
    createdAt: requireString(row.created_at, 'evaluation.created_at'),
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
