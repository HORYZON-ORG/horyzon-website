import type {
  AiOperationStatus,
  AiOperationType,
  Annunci10xSession,
  CommercialContext,
  CommunicationStrategy,
  EvaluationTarget,
  GeneratedAd,
  ChannelVariant,
  PublicationChannel,
  PublicationGate,
  RoleCard,
  RoleProfile,
  ScoreResult,
  SessionState,
} from '../types.ts';

export type Annunci10xPersistenceFlow = 'ANALYZE' | 'CREATE';
export type Annunci10xSnapshotReason = 'INITIAL_EXTRACTION' | 'USER_ANSWER' | 'USER_EDIT' | 'USER_CONFIRMATION' | 'POST_GENERATION_EDIT';
export type Annunci10xOutputType = 'MASTER' | 'CHANNEL_VARIANT';
export type Annunci10xAnalysisSourceKind = 'PASTED_TEXT' | 'PUBLIC_URL';
export type Annunci10xAnalysisSourceStatus = 'READY' | 'URL_FETCH_FAILED' | 'INVALID_SOURCE';
export type Annunci10xAnalysisRunStatus = 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED';
export type Annunci10xAnalysisRunStage = 'SOURCE_VALIDATION' | 'PRECHECK' | 'EXTRACT' | 'PROFILE' | 'STRATEGY' | 'EVALUATE' | 'CLARIFY' | 'COMPLETE';
export type Annunci10xAnalysisEvaluationMode = 'V1' | 'V2_SHADOW';

export interface PersistedAnnunci10xSession extends Annunci10xSession {
  flow: Annunci10xPersistenceFlow;
  selectedChannel?: PublicationChannel;
  expiresAt?: string | null;
}

export interface CreateSessionInput {
  flow: Annunci10xPersistenceFlow;
  selectedChannel?: PublicationChannel;
  commercialContext: CommercialContext;
  expiresAt?: string | null;
}

export interface CreateSessionResult {
  session: PersistedAnnunci10xSession;
  sessionSecret: string;
}

export interface AppendAnswerInput {
  sessionId: string;
  sessionSecret: string;
  interviewStep: 'ROLE' | 'OUTCOMES' | 'REQUIREMENTS' | 'CONDITIONS' | 'ATTRACTION' | 'CHANNEL';
  questionId: string;
  rawAnswer: string;
  clarificationId?: string;
}

export interface PersistedAnswer {
  id: string;
  sessionId: string;
  interviewStep: AppendAnswerInput['interviewStep'];
  questionId: string;
  clarificationId?: string | null;
  rawAnswer: string;
  createdAt: string;
}

export interface UpdateSessionInput {
  sessionId: string;
  sessionSecret: string;
  state?: SessionState;
  selectedChannel?: PublicationChannel | null;
  currentSnapshotId?: string | null;
}

export interface AppendSnapshotInput {
  sessionId: string;
  sessionSecret: string;
  roleCard: RoleCard;
  roleProfile?: RoleProfile | null;
  communicationStrategy?: CommunicationStrategy | null;
  reason: Annunci10xSnapshotReason;
}

export interface PersistedSnapshot {
  id: string;
  sessionId: string;
  version: number;
  roleCard: RoleCard;
  roleProfile?: RoleProfile | null;
  communicationStrategy?: CommunicationStrategy | null;
  reason: Annunci10xSnapshotReason;
  createdAt: string;
}

export interface StartAiOperationInput {
  sessionId: string;
  sessionSecret: string;
  operationType: AiOperationType;
  inputSnapshotId?: string | null;
  promptVersion: string;
  idempotencyKey: string;
  model?: string | null;
}

export interface PersistedAiOperation {
  id: string;
  sessionId: string;
  operationType: AiOperationType;
  status: AiOperationStatus;
  inputSnapshotId?: string | null;
  outputSnapshotId?: string | null;
  outputPayload?: Record<string, unknown> | null;
  model?: string | null;
  promptVersion: string;
  idempotencyKey: string;
  startedAt: string;
  completedAt?: string | null;
  errorPayload?: Record<string, unknown> | null;
}

export interface CompleteAiOperationInput {
  operationId: string;
  sessionSecret: string;
  outputSnapshotId?: string | null;
  outputPayload?: Record<string, unknown> | null;
}

export interface FailAiOperationInput {
  operationId: string;
  sessionSecret: string;
  errorPayload: Record<string, unknown>;
}

export interface SaveEvaluationInput {
  sessionId: string;
  sessionSecret: string;
  target: EvaluationTarget;
  targetRef: string;
  targetOutputId?: string | null;
  score: ScoreResult;
  gate: PublicationGate;
}

export interface PersistedEvaluation {
  id: string;
  sessionId: string;
  target: EvaluationTarget['kind'];
  targetRef: string;
  targetOutputId?: string | null;
  score: ScoreResult;
  gate: PublicationGate;
  createdAt: string;
}

export interface CreateAnalysisRunInput {
  sessionId: string;
  sessionSecret: string;
  sourceKind: Annunci10xAnalysisSourceKind;
  sourceStatus: Annunci10xAnalysisSourceStatus;
  originalInput: string;
  sourceUrl?: string | null;
  fetchedText?: string | null;
  targetText?: string | null;
  retrievalMetadata?: Record<string, unknown> | null;
  failureCode?: string | null;
  failureMessage?: string | null;
  targetKind: EvaluationTarget['kind'];
  sourceHash: string;
  inputIdentity: string;
  methodVersion: string;
  rubricVersion: string;
  promptVersion: string;
  scoreSemanticsVersion: string;
  model: string;
  provider: string;
  evaluationMode: Annunci10xAnalysisEvaluationMode;
  declaredChannel?: PublicationChannel | null;
}

export interface PersistedAnalysisRun {
  id: string;
  sessionId: string;
  sourceKind: Annunci10xAnalysisSourceKind;
  sourceStatus: Annunci10xAnalysisSourceStatus;
  sourceUrl?: string | null;
  originalInput: string;
  fetchedText?: string | null;
  targetText?: string | null;
  retrievalMetadata: Record<string, unknown>;
  targetKind: EvaluationTarget['kind'];
  declaredChannel?: PublicationChannel | null;
  sourceHash: string;
  inputIdentity: string;
  methodVersion: string;
  rubricVersion: string;
  promptVersion: string;
  scoreSemanticsVersion: string;
  model: string;
  provider: string;
  evaluationMode: Annunci10xAnalysisEvaluationMode;
  status: Annunci10xAnalysisRunStatus;
  stage: Annunci10xAnalysisRunStage;
  evaluationId?: string | null;
  resultReference?: string | null;
  operationRefs: Record<string, unknown>;
  errorPayload?: Record<string, unknown> | null;
  attemptCount: number;
  leaseExpiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
}

export interface UpdateAnalysisRunInput {
  analysisRunId: string;
  sessionSecret: string;
  status?: Annunci10xAnalysisRunStatus;
  stage?: Annunci10xAnalysisRunStage;
  sourceStatus?: Annunci10xAnalysisSourceStatus;
  evaluationId?: string | null;
  resultReference?: string | null;
  operationRefs?: Record<string, unknown>;
  retrievalMetadata?: Record<string, unknown>;
  errorPayload?: Record<string, unknown> | null;
  leaseExpiresAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  incrementAttemptCount?: boolean;
}

export interface CheckRateLimitInput {
  scope: string;
  subject: string;
  limit: number;
  windowSeconds: number;
}

export interface CheckRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
  resetAt: string;
}

export interface SaveOutputInput {
  sessionId: string;
  sessionSecret: string;
  snapshotId: string;
  outputType: Annunci10xOutputType;
  generatedContent: GeneratedAd | ChannelVariant | Record<string, unknown>;
  channel?: PublicationChannel | null;
  parentMasterId?: string | null;
  validationState: PublicationGate['status'];
}

export interface PersistedOutput {
  id: string;
  sessionId: string;
  snapshotId: string;
  outputType: Annunci10xOutputType;
  channel?: PublicationChannel | null;
  generatedContent: GeneratedAd | ChannelVariant | Record<string, unknown>;
  parentMasterId?: string | null;
  validationState: PublicationGate['status'];
  createdAt: string;
}

export interface AppendEventInput {
  sessionId?: string | null;
  eventName: string;
  metadata?: Record<string, unknown>;
}

export interface PersistedEvent {
  id: string;
  sessionId?: string | null;
  eventName: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Annunci10xPersistenceAdapter {
  createSession(input: CreateSessionInput): Promise<CreateSessionResult>;
  getSession(sessionId: string, sessionSecret: string): Promise<PersistedAnnunci10xSession | null>;
  updateSession(input: UpdateSessionInput): Promise<PersistedAnnunci10xSession>;
  appendAnswer(input: AppendAnswerInput): Promise<PersistedAnswer>;
  getAnswers(sessionId: string, sessionSecret: string): Promise<PersistedAnswer[]>;
  appendSnapshot(input: AppendSnapshotInput): Promise<PersistedSnapshot>;
  getLatestSnapshot(sessionId: string, sessionSecret: string): Promise<PersistedSnapshot | null>;
  startAiOperation(input: StartAiOperationInput): Promise<PersistedAiOperation>;
  completeAiOperation(input: CompleteAiOperationInput): Promise<PersistedAiOperation>;
  failAiOperation(input: FailAiOperationInput): Promise<PersistedAiOperation>;
  saveEvaluation(input: SaveEvaluationInput): Promise<PersistedEvaluation>;
  getLatestEvaluation(sessionId: string, sessionSecret: string): Promise<PersistedEvaluation | null>;
  createOrGetAnalysisRun(input: CreateAnalysisRunInput): Promise<PersistedAnalysisRun>;
  getAnalysisRun(analysisRunId: string, sessionSecret: string): Promise<PersistedAnalysisRun | null>;
  claimAnalysisRun(analysisRunId: string, sessionSecret: string, leaseSeconds: number): Promise<PersistedAnalysisRun | null>;
  updateAnalysisRun(input: UpdateAnalysisRunInput): Promise<PersistedAnalysisRun>;
  checkRateLimit(input: CheckRateLimitInput): Promise<CheckRateLimitResult>;
  saveOutput(input: SaveOutputInput): Promise<PersistedOutput>;
  getLatestOutput(sessionId: string, sessionSecret: string, outputType?: Annunci10xOutputType, parentMasterId?: string | null): Promise<PersistedOutput | null>;
  appendEvent(input: AppendEventInput): Promise<PersistedEvent>;
}
