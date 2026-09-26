import {
  ANNUNCI10X_METHOD_VERSION,
  ANNUNCI10X_PROMPT_PACK_VERSION,
  ANNUNCI10X_RUBRIC_VERSION,
} from './constants.ts';
import { getAnnunci10xModelForOperation } from './ai/models.ts';
import { Annunci10xAiError, sanitizeAiErrorPayload } from './ai/errors.ts';
import type { Annunci10xRuntimeContext, Annunci10xSessionCookie } from './product-flow.ts';
import {
  Annunci10xPublicError,
  createAnnunci10xRuntimeContext,
  runFreeAnnunci10xAnalysis,
} from './product-flow.ts';
import {
  createAnalysisInputIdentity,
  prepareAnnunci10xSource,
  type Annunci10xPreparedSource,
  type Annunci10xSourceInput,
} from './source-ingestion.ts';
import type {
  Annunci10xAnalysisEvaluationMode,
  Annunci10xAnalysisRunStage,
  PersistedAnalysisRun,
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

const SCORE_SEMANTICS_VERSION_V1 = 'annunci10x-score-semantics-v1';
const ANALYSIS_RUN_LEASE_SECONDS = 120;

export async function startAnnunci10xAnalysisRun(input: StartAnalysisRunInput): Promise<StartAnalysisRunResult> {
  const context = input.context ?? createAnnunci10xRuntimeContext();
  const evaluationMode = input.evaluationMode ?? 'V1';
  if (evaluationMode === 'V2_SHADOW') {
    throw new Annunci10xPublicError('INVALID_INPUT', 'EVALUATE V2 shadow non e attivo su questa route.', 409);
  }
  const source = await prepareAnnunci10xSource(input.source);
  const model = getAnnunci10xModelForOperation('EVALUATE');
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
    methodVersion: ANNUNCI10X_METHOD_VERSION,
    rubricVersion: ANNUNCI10X_RUBRIC_VERSION,
    promptVersion: ANNUNCI10X_PROMPT_PACK_VERSION,
    scoreSemanticsVersion: SCORE_SEMANTICS_VERSION_V1,
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
  if (claimed.sourceStatus !== 'READY' || !claimed.targetText) {
    return context.persistence.updateAnalysisRun({
      analysisRunId: claimed.id,
      sessionSecret: input.session.sessionSecret,
      status: 'FAILED',
      stage: 'SOURCE_VALIDATION',
      failedAt: new Date().toISOString(),
      errorPayload: claimed.errorPayload ?? { code: 'URL_FETCH_FAILED' },
      leaseExpiresAt: null,
    });
  }
  if (claimed.evaluationMode !== 'V1') {
    return context.persistence.updateAnalysisRun({
      analysisRunId: claimed.id,
      sessionSecret: input.session.sessionSecret,
      status: 'FAILED',
      failedAt: new Date().toISOString(),
      errorPayload: { code: 'EVALUATION_MODE_NOT_ENABLED' },
      leaseExpiresAt: null,
    });
  }

  try {
    let operationRefs = { ...claimed.operationRefs };
    const result = await runFreeAnnunci10xAnalysis({
      sessionId: input.session.sessionId,
      sessionSecret: input.session.sessionSecret,
      rawAdText: claimed.targetText,
      channelHint: claimed.declaredChannel ?? undefined,
      context,
      stageObserver: async (stage, event) => {
        operationRefs = mergeOperationRefs(operationRefs, stage, event);
        await context.persistence.updateAnalysisRun({
          analysisRunId: claimed.id,
          sessionSecret: input.session.sessionSecret,
          stage,
          operationRefs,
          leaseExpiresAt: leaseFromNow(),
        });
      },
    });
    return context.persistence.updateAnalysisRun({
      analysisRunId: claimed.id,
      sessionSecret: input.session.sessionSecret,
      status: 'READY',
      stage: 'COMPLETE',
      evaluationId: result.evaluationId,
      resultReference: result.evaluationId,
      operationRefs,
      completedAt: new Date().toISOString(),
      errorPayload: null,
      leaseExpiresAt: null,
    });
  } catch (error) {
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

function buildRunIdentity(source: Annunci10xPreparedSource, model: string, evaluationMode: Annunci10xAnalysisEvaluationMode): string {
  return createAnalysisInputIdentity({
    sourceHash: source.sourceHash,
    targetKind: 'ORIGINAL_AD',
    declaredChannel: source.declaredChannel ?? null,
    methodVersion: ANNUNCI10X_METHOD_VERSION,
    rubricVersion: ANNUNCI10X_RUBRIC_VERSION,
    promptVersion: ANNUNCI10X_PROMPT_PACK_VERSION,
    scoreSemanticsVersion: SCORE_SEMANTICS_VERSION_V1,
    model,
    evaluationMode,
  });
}

function mergeOperationRefs(current: Record<string, unknown>, stage: Annunci10xAnalysisRunStage, event: Record<string, unknown>): Record<string, unknown> {
  const operationId = typeof event.operationId === 'string' ? event.operationId : null;
  if (!operationId) return current;
  return { ...current, [stage]: operationId };
}

function leaseFromNow(): string {
  return new Date(Date.now() + ANALYSIS_RUN_LEASE_SECONDS * 1000).toISOString();
}

function sanitizeAnalysisRunError(error: unknown): Record<string, unknown> {
  if (error instanceof Annunci10xPublicError) return { code: error.code, status: error.status };
  if (error instanceof Annunci10xAiError) return sanitizeAiErrorPayload(error);
  return { code: 'INTERNAL' };
}
