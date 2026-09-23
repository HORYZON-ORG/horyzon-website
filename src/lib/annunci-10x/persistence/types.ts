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
  saveOutput(input: SaveOutputInput): Promise<PersistedOutput>;
  appendEvent(input: AppendEventInput): Promise<PersistedEvent>;
}
