import { createHash } from 'node:crypto';
import {
  ANNUNCI10X_METHOD_VERSION,
  ANNUNCI10X_METHOD_VERSION_V2,
  ANNUNCI10X_PROMPT_PACK_VERSION,
  ANNUNCI10X_RUBRIC_VERSION,
  ANNUNCI10X_RUBRIC_VERSION_V2,
  ANNUNCI10X_SCORE_SEMANTICS_VERSION_V2,
} from './constants.ts';
import { getAnnunci10xModelForOperation } from './ai/models.ts';
import { ANNUNCI10X_EVALUATE_PROMPT_VERSION_V2 } from './ai/prompts/evaluate-v2.ts';
import { Annunci10xAiError, isAnnunci10xAiOperationInProgressError, sanitizeAiErrorPayload } from './ai/errors.ts';
import { Annunci10xAiOrchestrator } from './ai/orchestrator.ts';
import { runPersistedAnnunci10xEvaluateV2 } from './ai/evaluate-v2.ts';
import type {
  Annunci10xEvaluateOutput,
  Annunci10xExtractOutput,
  Annunci10xProfileOutput,
  Annunci10xStrategyOutput,
} from './ai/schemas.ts';
import { validateAiOutputForOperation } from './ai/schemas.ts';
import { ANNUNCI10X_RUBRIC } from './rubric.ts';
import type { AiOperationType, CommunicationStrategy, OriginalAd, PublicationChannel, PublicationGate, RoleCard, RoleProfile } from './types.ts';
import type { Annunci10xRuntimeContext, Annunci10xSessionCookie } from './product-flow.ts';
import {
  Annunci10xPublicError,
  buildEvaluateInputV2,
  buildRoleCardFromExtract,
  buildRoleProfile,
  createAnnunci10xRuntimeContext,
  normalizeStrategy,
  scoreAndGate,
} from './product-flow.ts';
import {
  createAnalysisInputIdentity,
  prepareAnnunci10xSource,
  type Annunci10xPreparedSource,
  type Annunci10xSourceInput,
} from './source-ingestion.ts';
import { maybeSendAnnunci10xScoreReport } from './score-report-email.ts';
import type {
  Annunci10xAnalysisEvaluationMode,
  Annunci10xAnalysisRunStage,
  Annunci10xPersistedScoreResult,
  PersistedAnalysisRun,
  PersistedEvaluation,
  PersistedSnapshot,
} from './persistence/types.ts';

export interface StartAnalysisRunInput {
  session: Annunci10xSessionCookie;
  source: Annunci10xSourceInput;
  context?: Annunci10xRuntimeContext;
  evaluationMode?: Annunci10xAnalysisEvaluationMode;
}

export interface StartAnalysisRunResult {
  run: PersistedAnalysisRun;
  createdOrReused: 'CREATED_OR_EXISTING';
}

export interface PublicAnalysisRunStatus {
  id: string;
  status: PersistedAnalysisRun['status'];
  stage: PersistedAnalysisRun['stage'];
  sourceStatus: PersistedAnalysisRun['sourceStatus'];
  ready: boolean;
  failureCode?: string;
}

type DurableOperationStage = Exclude<Annunci10xAnalysisRunStage, 'SOURCE_VALIDATION' | 'COMPLETE'>;

const SCORE_SEMANTICS_VERSION_V1 = 'annunci10x-score-semantics-v1';
const ANALYSIS_RUN_LEASE_SECONDS = 120;
const ROLE_SNAPSHOT_REF = 'ROLE_SNAPSHOT';
const CONTEXT_SNAPSHOT_REF = 'CONTEXT_SNAPSHOT';

export async function startAnnunci10xAnalysisRun(input: StartAnalysisRunInput): Promise<StartAnalysisRunResult> {
  const context = input.context ?? createAnnunci10xRuntimeContext();
  const evaluationMode = input.evaluationMode ?? resolveAnnunci10xPublicScoreEvaluationMode();
  if (evaluationMode === 'V2_SHADOW') {
    throw new Annunci10xPublicError('INVALID_INPUT', 'EVALUATE V2 shadow non e attivo su questa route.', 409);
  }
  const source = await prepareAnnunci10xSource(input.source);
  const model = getAnnunci10xModelForOperation('EVALUATE');
  const versions = versionsForEvaluationMode(evaluationMode);
  const identity = buildRunIdentity(source, model, evaluationMode);
  const run = await context.persistence.createOrGetAnalysisRun({
    sessionId: input.session.sessionId,
    sessionSecret: input.session.sessionSecret,
    sourceKind: source.kind,
    sourceStatus: source.sourceStatus,
    originalInput: source.originalInput,
    sourceUrl: source.sourceUrl ?? null,
    fetchedText: source.fetchedText ?? null,
    targetText: source.targetText ?? null,
    retrievalMetadata: source.retrievalMetadata,
    failureCode: source.failureCode ?? null,
    failureMessage: source.failureMessage ?? null,
    targetKind: 'ORIGINAL_AD',
    declaredChannel: source.declaredChannel ?? null,
    sourceHash: source.sourceHash,
    inputIdentity: identity,
    methodVersion: versions.methodVersion,
    rubricVersion: versions.rubricVersion,
    promptVersion: versions.promptVersion,
    scoreSemanticsVersion: versions.scoreSemanticsVersion,
    model,
    provider: context.configuredProvider,
    evaluationMode,
  });
  return { run, createdOrReused: 'CREATED_OR_EXISTING' };
}

export async function getAnnunci10xAnalysisRunStatus(input: {
  analysisRunId: string;
  session: Annunci10xSessionCookie;
  context?: Annunci10xRuntimeContext;
}): Promise<PublicAnalysisRunStatus | null> {
  const context = input.context ?? createAnnunci10xRuntimeContext();
  const run = await context.persistence.getAnalysisRun(input.analysisRunId, input.session.sessionSecret);
  return run ? toPublicAnalysisRunStatus(run) : null;
}

export async function runAnnunci10xAnalysisRun(input: {
  analysisRunId: string;
  session: Annunci10xSessionCookie;
  context?: Annunci10xRuntimeContext;
}): Promise<PersistedAnalysisRun | null> {
  const context = input.context ?? createAnnunci10xRuntimeContext();
  const claimed = await context.persistence.claimAnalysisRun(input.analysisRunId, input.session.sessionSecret, ANALYSIS_RUN_LEASE_SECONDS);
  if (!claimed) return null;
  if (claimed.sourceStatus !== 'READY' || !claimed.targetText) return failSourceValidation(claimed, input.session, context);
  if (claimed.evaluationMode === 'V2_SHADOW') return failUnsupportedEvaluationMode(claimed, input.session, context);

  try {
    return await runOneDurableStage(claimed, input.session, context);
  } catch (error) {
    if (isAnnunci10xAiOperationInProgressError(error)) {
      return context.persistence.updateAnalysisRun({
        analysisRunId: claimed.id,
        sessionSecret: input.session.sessionSecret,
        status: 'RUNNING',
        stage: claimed.stage,
        operationRefs: claimed.operationRefs,
        errorPayload: null,
        leaseExpiresAt: null,
      });
    }
    return context.persistence.updateAnalysisRun({
      analysisRunId: claimed.id,
      sessionSecret: input.session.sessionSecret,
      status: 'FAILED',
      failedAt: new Date().toISOString(),
      errorPayload: sanitizeAnalysisRunError(error),
      leaseExpiresAt: null,
    });
  }
}

export function toPublicAnalysisRunStatus(run: PersistedAnalysisRun): PublicAnalysisRunStatus {
  const payload: PublicAnalysisRunStatus = {
    id: run.id,
    status: run.status,
    stage: run.stage,
    sourceStatus: run.sourceStatus,
    ready: run.status === 'READY',
  };
  const code = typeof run.errorPayload?.code === 'string' ? run.errorPayload.code : undefined;
  if (code) payload.failureCode = code;
  return payload;
}

async function runOneDurableStage(
  run: PersistedAnalysisRun,
  session: Annunci10xSessionCookie,
  context: Annunci10xRuntimeContext,
): Promise<PersistedAnalysisRun> {
  const stage = nextExecutableStage(run.stage);
  if (stage === 'PRECHECK') return runPrecheckStage(run, session, context);
  if (stage === 'EXTRACT') return runExtractStage(run, session, context);
  if (stage === 'PROFILE') return runProfileStage(run, session, context);
  if (stage === 'STRATEGY') return runStrategyStage(run, session, context);
  if (stage === 'EVALUATE') return runEvaluateStage(run, session, context);
  if (stage === 'CLARIFY') return runClarifyStage(run, session, context);
  return context.persistence.updateAnalysisRun({
    analysisRunId: run.id,
    sessionSecret: session.sessionSecret,
    status: 'READY',
    stage: 'COMPLETE',
    completedAt: run.completedAt ?? new Date().toISOString(),
    leaseExpiresAt: null,
  });
}

async function runPrecheckStage(
  run: PersistedAnalysisRun,
  session: Annunci10xSessionCookie,
  context: Annunci10xRuntimeContext,
): Promise<PersistedAnalysisRun> {
  await context.persistence.appendEvent({
    sessionId: run.sessionId,
    eventName: 'original_ad_submitted',
    metadata: { lengthBucket: bucketLength(requireTargetText(run)) },
  });
  const precheck = await orchestrator(context).runTask({
    sessionId: run.sessionId,
    sessionSecret: session.sessionSecret,
    operationType: 'PRECHECK',
    input: {
      rawText: requireTargetText(run),
      declaredChannel: run.declaredChannel ?? 'LINKEDIN',
      roleHint: null,
      companyHint: null,
      entryMode: 'ANALYZE',
    },
    idempotencyInputIdentityOverride: stageIdentity(run, 'PRECHECK'),
  });
  const operationRefs = withRef(run.operationRefs, 'PRECHECK', precheck.operation.id);
  await context.persistence.appendEvent({
    sessionId: run.sessionId,
    eventName: 'precheck_completed',
    metadata: { detectedType: precheck.output.detectedType, canRunFullAnalysis: precheck.output.canRunFullAnalysis },
  });
  if (!precheck.output.canRunFullAnalysis || precheck.output.detectedType === 'NOT_JOB_AD' || precheck.output.detectedType === 'UNUSABLE') {
    return context.persistence.updateAnalysisRun({
      analysisRunId: run.id,
      sessionSecret: session.sessionSecret,
      status: 'FAILED',
      stage: 'PRECHECK',
      operationRefs,
      failedAt: new Date().toISOString(),
      errorPayload: { code: 'INVALID_INPUT', status: 422 },
      leaseExpiresAt: null,
    });
  }
  return updateRunStage(run, session, context, 'EXTRACT', operationRefs);
}

async function runExtractStage(
  run: PersistedAnalysisRun,
  session: Annunci10xSessionCookie,
  context: Annunci10xRuntimeContext,
): Promise<PersistedAnalysisRun> {
  await requireOperationOutput(context, session.sessionSecret, run.operationRefs, 'PRECHECK');
  const originalAd = originalAdForRun(run);
  const extract = await orchestrator(context).runTask({
    sessionId: run.sessionId,
    sessionSecret: session.sessionSecret,
    operationType: 'EXTRACT',
    input: { originalAd, existingRoleCard: null },
    idempotencyInputIdentityOverride: stageIdentity(run, 'EXTRACT'),
  });
  let operationRefs = withRef(run.operationRefs, 'EXTRACT', extract.operation.id);
  const roleCard = buildRoleCardFromExtract(requireTargetText(run), extract.output as Annunci10xExtractOutput);
  const roleSnapshot = await getOrCreateRoleSnapshot(run, session, context, operationRefs, roleCard);
  operationRefs = withRef(operationRefs, ROLE_SNAPSHOT_REF, roleSnapshot.id);
  return updateRunStage(run, session, context, 'PROFILE', operationRefs);
}

async function runProfileStage(
  run: PersistedAnalysisRun,
  session: Annunci10xSessionCookie,
  context: Annunci10xRuntimeContext,
): Promise<PersistedAnalysisRun> {
  const roleSnapshot = await requireSnapshot(context, session, run, ROLE_SNAPSHOT_REF);
  await requireOperationOutput(context, session.sessionSecret, run.operationRefs, 'EXTRACT');
  const profile = await orchestrator(context).runTask({
    sessionId: run.sessionId,
    sessionSecret: session.sessionSecret,
    operationType: 'PROFILE',
    input: { roleCard: roleSnapshot.roleCard, originalAd: originalAdForRun(run) },
    inputSnapshotId: roleSnapshot.id,
    idempotencyInputIdentityOverride: stageIdentity(run, 'PROFILE'),
  });
  const operationRefs = withRef(run.operationRefs, 'PROFILE', profile.operation.id);
  return updateRunStage(run, session, context, 'STRATEGY', operationRefs);
}

async function runStrategyStage(
  run: PersistedAnalysisRun,
  session: Annunci10xSessionCookie,
  context: Annunci10xRuntimeContext,
): Promise<PersistedAnalysisRun> {
  const roleSnapshot = await requireSnapshot(context, session, run, ROLE_SNAPSHOT_REF);
  const profileOutput = await requireOperationOutput(context, session.sessionSecret, run.operationRefs, 'PROFILE') as Annunci10xProfileOutput;
  const roleProfile = buildRoleProfile(roleSnapshot.roleCard, profileOutput);
  const strategy = await orchestrator(context).runTask({
    sessionId: run.sessionId,
    sessionSecret: session.sessionSecret,
    operationType: 'STRATEGY',
    input: { roleCard: roleSnapshot.roleCard, roleProfile, channel: channelForRun(run) },
    inputSnapshotId: roleSnapshot.id,
    idempotencyInputIdentityOverride: stageIdentity(run, 'STRATEGY'),
  });
  let operationRefs = withRef(run.operationRefs, 'STRATEGY', strategy.operation.id);
  const communicationStrategy = normalizeStrategy((strategy.output as Annunci10xStrategyOutput).communicationStrategy, run.sessionId);
  const contextSnapshot = await getOrCreateContextSnapshot(run, session, context, operationRefs, roleSnapshot.roleCard, roleProfile, communicationStrategy);
  operationRefs = withRef(operationRefs, CONTEXT_SNAPSHOT_REF, contextSnapshot.id);
  return updateRunStage(run, session, context, 'EVALUATE', operationRefs);
}

async function runEvaluateStage(
  run: PersistedAnalysisRun,
  session: Annunci10xSessionCookie,
  context: Annunci10xRuntimeContext,
): Promise<PersistedAnalysisRun> {
  const contextSnapshot = await requireSnapshot(context, session, run, CONTEXT_SNAPSHOT_REF);
  const roleProfile = requireRoleProfile(contextSnapshot);
  const communicationStrategy = requireCommunicationStrategy(contextSnapshot);
  if (run.evaluationMode === 'V2_PUBLIC') {
    const evaluate = await runPersistedAnnunci10xEvaluateV2({
      sessionId: run.sessionId,
      sessionSecret: session.sessionSecret,
      provider: context.provider,
      persistence: context.persistence,
      inputSnapshotId: contextSnapshot.id,
      idempotencyInputIdentity: stageIdentity(run, 'EVALUATE'),
      input: buildEvaluateInputV2({
        rawAdText: requireTargetText(run),
        channelHint: channelForRun(run),
        roleCard: contextSnapshot.roleCard,
        roleProfile,
        communicationStrategy,
      }),
    });
    const operationRefs = withRef(run.operationRefs, 'EVALUATE', evaluate.operation.id);
    const evaluation = await getOrSaveEvaluation(run, session, context, evaluate.score, null);
    await context.persistence.appendEvent({
      sessionId: run.sessionId,
      eventName: 'analysis_completed',
      metadata: { coverage: evaluate.score.coverage, resultVersion: 'V2', evaluationMode: 'V2_PUBLIC' },
    });
    const readyRun = await context.persistence.updateAnalysisRun({
      analysisRunId: run.id,
      sessionSecret: session.sessionSecret,
      status: 'READY',
      stage: 'COMPLETE',
      evaluationId: evaluation.id,
      resultReference: evaluation.id,
      operationRefs,
      completedAt: new Date().toISOString(),
      errorPayload: null,
      leaseExpiresAt: null,
    });
    await triggerScoreReportEmailAfterReady(readyRun, session, context);
    return readyRun;
  }

  const evaluate = await orchestrator(context).runTask({
    sessionId: run.sessionId,
    sessionSecret: session.sessionSecret,
    operationType: 'EVALUATE',
    input: {
      target: { kind: 'ORIGINAL_AD', originalAdId: originalAdForRun(run).id },
      originalAd: originalAdForRun(run),
      roleCard: contextSnapshot.roleCard,
      roleProfile,
      communicationStrategy,
      rubric: ANNUNCI10X_RUBRIC,
    },
    inputSnapshotId: contextSnapshot.id,
    idempotencyInputIdentityOverride: stageIdentity(run, 'EVALUATE'),
  });
  const extractOutput = await requireOperationOutput(context, session.sessionSecret, run.operationRefs, 'EXTRACT') as Annunci10xExtractOutput;
  const { score, gate } = scoreAndGate(evaluate.output as Annunci10xEvaluateOutput, extractOutput);
  const evaluation = await getOrSaveEvaluation(run, session, context, score, gate);
  const operationRefs = withRef(run.operationRefs, 'EVALUATE', evaluate.operation.id);
  return context.persistence.updateAnalysisRun({
    analysisRunId: run.id,
    sessionSecret: session.sessionSecret,
    status: 'RUNNING',
    stage: 'CLARIFY',
    evaluationId: evaluation.id,
    resultReference: evaluation.id,
    operationRefs,
    errorPayload: null,
    leaseExpiresAt: null,
  });
}

async function runClarifyStage(
  run: PersistedAnalysisRun,
  session: Annunci10xSessionCookie,
  context: Annunci10xRuntimeContext,
): Promise<PersistedAnalysisRun> {
  const contextSnapshot = await requireSnapshot(context, session, run, CONTEXT_SNAPSHOT_REF);
  const roleProfile = requireRoleProfile(contextSnapshot);
  const evaluation = await requireEvaluationForRun(run, session, context);
  const extractOutput = await requireOperationOutput(context, session.sessionSecret, run.operationRefs, 'EXTRACT') as Annunci10xExtractOutput;
  const clarify = await orchestrator(context).runTask({
    sessionId: run.sessionId,
    sessionSecret: session.sessionSecret,
    operationType: 'CLARIFY',
    input: {
      currentStep: 'CONDITIONS',
      roleCard: contextSnapshot.roleCard,
      roleProfile,
      unresolvedConflicts: extractOutput.possibleConflicts,
      score: evaluation.score,
    },
    inputSnapshotId: contextSnapshot.id,
    idempotencyInputIdentityOverride: stageIdentity(run, 'CLARIFY'),
  });
  const operationRefs = withRef(run.operationRefs, 'CLARIFY', clarify.operation.id);
  const gate = evaluation.gate;
  await context.persistence.appendEvent({
    sessionId: run.sessionId,
    eventName: 'analysis_completed',
    metadata: { coverage: evaluation.score.coverage, gateStatus: gate?.status ?? 'NOT_EVALUATED' },
  });
  if (clarify.output.status === 'NEEDS_CLARIFICATION') {
    await context.persistence.appendEvent({
      sessionId: run.sessionId,
      eventName: 'clarification_requested',
      metadata: { targetPath: clarify.output.clarification?.targetPath ?? 'unknown' },
    });
  }
  const readyRun = await context.persistence.updateAnalysisRun({
    analysisRunId: run.id,
    sessionSecret: session.sessionSecret,
    status: 'READY',
    stage: 'COMPLETE',
    evaluationId: evaluation.id,
    resultReference: evaluation.id,
    operationRefs,
    completedAt: new Date().toISOString(),
    errorPayload: null,
    leaseExpiresAt: null,
  });
  await triggerScoreReportEmailAfterReady(readyRun, session, context);
  return readyRun;
}

async function getOrCreateRoleSnapshot(
  run: PersistedAnalysisRun,
  session: Annunci10xSessionCookie,
  context: Annunci10xRuntimeContext,
  operationRefs: Record<string, unknown>,
  roleCard: RoleCard,
): Promise<PersistedSnapshot> {
  const existingId = stringRef(operationRefs, ROLE_SNAPSHOT_REF);
  if (existingId) {
    const existing = await context.persistence.getSnapshotById(existingId, run.sessionId, session.sessionSecret);
    if (existing) return existing;
  }
  return context.persistence.appendSnapshot({
    sessionId: run.sessionId,
    sessionSecret: session.sessionSecret,
    roleCard,
    reason: 'INITIAL_EXTRACTION',
  });
}

async function getOrCreateContextSnapshot(
  run: PersistedAnalysisRun,
  session: Annunci10xSessionCookie,
  context: Annunci10xRuntimeContext,
  operationRefs: Record<string, unknown>,
  roleCard: RoleCard,
  roleProfile: RoleProfile,
  communicationStrategy: CommunicationStrategy,
): Promise<PersistedSnapshot> {
  const existingId = stringRef(operationRefs, CONTEXT_SNAPSHOT_REF);
  if (existingId) {
    const existing = await context.persistence.getSnapshotById(existingId, run.sessionId, session.sessionSecret);
    if (existing) return existing;
  }
  return context.persistence.appendSnapshot({
    sessionId: run.sessionId,
    sessionSecret: session.sessionSecret,
    roleCard,
    roleProfile,
    communicationStrategy,
    reason: 'INITIAL_EXTRACTION',
  });
}

async function requireSnapshot(
  context: Annunci10xRuntimeContext,
  session: Annunci10xSessionCookie,
  run: PersistedAnalysisRun,
  refName: string,
): Promise<PersistedSnapshot> {
  const snapshotId = stringRef(run.operationRefs, refName);
  if (!snapshotId) throw new Annunci10xAiError('INTERNAL_ERROR', `Missing durable snapshot ref: ${refName}.`);
  const snapshot = await context.persistence.getSnapshotById(snapshotId, run.sessionId, session.sessionSecret);
  if (!snapshot) throw new Annunci10xAiError('INTERNAL_ERROR', `Durable snapshot ref not found: ${refName}.`);
  return snapshot;
}

async function requireOperationOutput<T extends AiOperationType>(
  context: Annunci10xRuntimeContext,
  sessionSecret: string,
  operationRefs: Record<string, unknown>,
  operationType: T,
): Promise<ReturnType<typeof validateAiOutputForOperation>> {
  const operationId = stringRef(operationRefs, operationType);
  if (!operationId) throw new Annunci10xAiError('INTERNAL_ERROR', `Missing durable operation ref: ${operationType}.`);
  const operation = await context.persistence.getAiOperation(operationId, sessionSecret);
  if (!operation || operation.status !== 'SUCCEEDED' || operation.outputPayload?.output === undefined) {
    throw new Annunci10xAiError('INTERNAL_ERROR', `Durable operation output unavailable: ${operationType}.`);
  }
  return validateAiOutputForOperation(operationType, operation.outputPayload.output);
}

async function getOrSaveEvaluation(
  run: PersistedAnalysisRun,
  session: Annunci10xSessionCookie,
  context: Annunci10xRuntimeContext,
  score: Annunci10xPersistedScoreResult,
  gate: PublicationGate | null,
): Promise<PersistedEvaluation> {
  const existing = await context.persistence.getEvaluationByTarget(run.sessionId, session.sessionSecret, originalAdForRun(run).id);
  if (existing) return existing;
  return context.persistence.saveEvaluation({
    sessionId: run.sessionId,
    sessionSecret: session.sessionSecret,
    target: { kind: 'ORIGINAL_AD', originalAdId: originalAdForRun(run).id },
    targetRef: originalAdForRun(run).id,
    score,
    gate,
  });
}

async function requireEvaluationForRun(
  run: PersistedAnalysisRun,
  session: Annunci10xSessionCookie,
  context: Annunci10xRuntimeContext,
): Promise<PersistedEvaluation> {
  if (run.evaluationId) {
    const byId = await context.persistence.getEvaluationById(run.evaluationId, run.sessionId, session.sessionSecret);
    if (byId) return byId;
  }
  const byTarget = await context.persistence.getEvaluationByTarget(run.sessionId, session.sessionSecret, originalAdForRun(run).id);
  if (byTarget) return byTarget;
  throw new Annunci10xAiError('INTERNAL_ERROR', 'Durable evaluation not found for analysis run.');
}

function buildRunIdentity(source: Annunci10xPreparedSource, model: string, evaluationMode: Annunci10xAnalysisEvaluationMode): string {
  const versions = versionsForEvaluationMode(evaluationMode);
  return createAnalysisInputIdentity({
    sourceHash: source.sourceHash,
    targetKind: 'ORIGINAL_AD',
    declaredChannel: source.declaredChannel ?? null,
    methodVersion: versions.methodVersion,
    rubricVersion: versions.rubricVersion,
    promptVersion: versions.promptVersion,
    scoreSemanticsVersion: versions.scoreSemanticsVersion,
    model,
    evaluationMode,
  });
}

export function resolveAnnunci10xPublicScoreEvaluationMode(env: Record<string, string | undefined> = process.env): Annunci10xAnalysisEvaluationMode {
  const configured = env.ANNUNCI10X_PUBLIC_SCORE_VERSION?.trim().toUpperCase();
  if (!configured || configured === 'V1') return 'V1';
  if (configured === 'V2') return 'V2_PUBLIC';
  throw new Annunci10xPublicError('INVALID_INPUT', 'ANNUNCI10X_PUBLIC_SCORE_VERSION deve essere V1 o V2.', 500);
}

function versionsForEvaluationMode(evaluationMode: Annunci10xAnalysisEvaluationMode): {
  methodVersion: string;
  rubricVersion: string;
  promptVersion: string;
  scoreSemanticsVersion: string;
} {
  if (evaluationMode === 'V2_PUBLIC') {
    return {
      methodVersion: ANNUNCI10X_METHOD_VERSION_V2,
      rubricVersion: ANNUNCI10X_RUBRIC_VERSION_V2,
      promptVersion: ANNUNCI10X_EVALUATE_PROMPT_VERSION_V2,
      scoreSemanticsVersion: ANNUNCI10X_SCORE_SEMANTICS_VERSION_V2,
    };
  }
  return {
    methodVersion: ANNUNCI10X_METHOD_VERSION,
    rubricVersion: ANNUNCI10X_RUBRIC_VERSION,
    promptVersion: ANNUNCI10X_PROMPT_PACK_VERSION,
    scoreSemanticsVersion: SCORE_SEMANTICS_VERSION_V1,
  };
}

function updateRunStage(
  run: PersistedAnalysisRun,
  session: Annunci10xSessionCookie,
  context: Annunci10xRuntimeContext,
  stage: Annunci10xAnalysisRunStage,
  operationRefs: Record<string, unknown>,
): Promise<PersistedAnalysisRun> {
  return context.persistence.updateAnalysisRun({
    analysisRunId: run.id,
    sessionSecret: session.sessionSecret,
    status: 'RUNNING',
    stage,
    operationRefs,
    errorPayload: null,
    leaseExpiresAt: null,
  });
}

async function triggerScoreReportEmailAfterReady(
  run: PersistedAnalysisRun,
  session: Annunci10xSessionCookie,
  context: Annunci10xRuntimeContext,
): Promise<void> {
  try {
    await maybeSendAnnunci10xScoreReport({ session, analysisRunId: run.id, context });
  } catch {
    // Transactional email delivery must not invalidate a completed analysis run.
  }
}

function nextExecutableStage(stage: Annunci10xAnalysisRunStage): DurableOperationStage | 'COMPLETE' {
  if (stage === 'SOURCE_VALIDATION') return 'PRECHECK';
  return stage;
}

function failSourceValidation(
  run: PersistedAnalysisRun,
  session: Annunci10xSessionCookie,
  context: Annunci10xRuntimeContext,
): Promise<PersistedAnalysisRun> {
  return context.persistence.updateAnalysisRun({
    analysisRunId: run.id,
    sessionSecret: session.sessionSecret,
    status: 'FAILED',
    stage: 'SOURCE_VALIDATION',
    failedAt: new Date().toISOString(),
    errorPayload: run.errorPayload ?? { code: 'URL_FETCH_FAILED' },
    leaseExpiresAt: null,
  });
}

function failUnsupportedEvaluationMode(
  run: PersistedAnalysisRun,
  session: Annunci10xSessionCookie,
  context: Annunci10xRuntimeContext,
): Promise<PersistedAnalysisRun> {
  return context.persistence.updateAnalysisRun({
    analysisRunId: run.id,
    sessionSecret: session.sessionSecret,
    status: 'FAILED',
    failedAt: new Date().toISOString(),
    errorPayload: { code: 'EVALUATION_MODE_NOT_ENABLED' },
    leaseExpiresAt: null,
  });
}

function orchestrator(context: Annunci10xRuntimeContext): Annunci10xAiOrchestrator {
  return new Annunci10xAiOrchestrator({ provider: context.provider, persistence: context.persistence });
}

function originalAdForRun(run: PersistedAnalysisRun): OriginalAd {
  return {
    id: `original-${stableHash({ inputIdentity: run.inputIdentity, sourceHash: run.sourceHash }).slice(0, 16)}`,
    sessionId: run.sessionId,
    type: 'PASTED_TEXT',
    rawText: requireTargetText(run),
    uploadedAt: run.createdAt,
    immutable: true,
  };
}

function channelForRun(run: PersistedAnalysisRun): PublicationChannel {
  return run.declaredChannel ?? 'LINKEDIN';
}

function requireTargetText(run: PersistedAnalysisRun): string {
  if (!run.targetText) throw new Annunci10xAiError('INTERNAL_ERROR', 'Analysis run target text is missing.');
  return run.targetText;
}

function requireRoleProfile(snapshot: PersistedSnapshot): RoleProfile {
  if (!snapshot.roleProfile) throw new Annunci10xAiError('INTERNAL_ERROR', 'Durable context snapshot is missing role profile.');
  return snapshot.roleProfile;
}

function requireCommunicationStrategy(snapshot: PersistedSnapshot): CommunicationStrategy {
  if (!snapshot.communicationStrategy) throw new Annunci10xAiError('INTERNAL_ERROR', 'Durable context snapshot is missing communication strategy.');
  return snapshot.communicationStrategy;
}

function stageIdentity(run: PersistedAnalysisRun, operationType: AiOperationType): string {
  return stableHash({
    analysisRunIdentity: run.inputIdentity,
    operationType,
    evaluationMode: run.evaluationMode,
    methodVersion: run.methodVersion,
    rubricVersion: run.rubricVersion,
    promptVersion: run.promptVersion,
    scoreSemanticsVersion: run.scoreSemanticsVersion,
    model: run.model,
  });
}

function withRef(refs: Record<string, unknown>, key: string, value: string): Record<string, unknown> {
  return { ...refs, [key]: value };
}

function stringRef(refs: Record<string, unknown>, key: string): string | null {
  const value = refs[key];
  return typeof value === 'string' && value ? value : null;
}

function sanitizeAnalysisRunError(error: unknown): Record<string, unknown> {
  if (error instanceof Annunci10xPublicError) return { code: error.code, status: error.status };
  if (error instanceof Annunci10xAiError) return sanitizeAiErrorPayload(error);
  return { code: 'INTERNAL' };
}

function bucketLength(text: string): string {
  const length = text.length;
  if (length < 500) return 'short';
  if (length < 2_000) return 'medium';
  return 'long';
}

function stableHash(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
