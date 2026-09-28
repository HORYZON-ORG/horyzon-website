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
import type { ScoreResultV2 } from '../types-v2.ts';

export type Annunci10xPersistenceFlow = 'ANALYZE' | 'CREATE';
export type Annunci10xSnapshotReason = 'INITIAL_EXTRACTION' | 'USER_ANSWER' | 'USER_EDIT' | 'USER_CONFIRMATION' | 'POST_GENERATION_EDIT';
export type Annunci10xOutputType = 'MASTER' | 'CHANNEL_VARIANT';
export type Annunci10xAnalysisSourceKind = 'PASTED_TEXT' | 'PUBLIC_URL';
export type Annunci10xAnalysisSourceStatus = 'READY' | 'URL_FETCH_FAILED' | 'INVALID_SOURCE';
export type Annunci10xAnalysisRunStatus = 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED';
export type Annunci10xAnalysisRunStage = 'SOURCE_VALIDATION' | 'PRECHECK' | 'EXTRACT' | 'PROFILE' | 'STRATEGY' | 'EVALUATE' | 'CLARIFY' | 'COMPLETE';
export type Annunci10xAnalysisEvaluationMode = 'V1' | 'V2_SHADOW' | 'V2_PUBLIC';
export type Annunci10xBusinessRole = 'OWNER_ENTREPRENEUR' | 'HR' | 'INTERNAL_RECRUITER' | 'CONSULTANT' | 'OTHER';
export type Annunci10xEmailVerificationStatus = 'PENDING_SEND' | 'SENT' | 'CONSUMED' | 'INVALIDATED' | 'FAILED_SEND';
export type Annunci10xEmailDeliveryKind = 'SCORE_REPORT';
export type Annunci10xEmailDeliveryStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED';
export type Annunci10xPersistedOfferCode = 'ANNUNCI10X_REWRITE' | 'ANNUNCI10X_CREATE' | 'AGENT_RECRUITER';
export type Annunci10xPurchaseStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELED' | 'REFUNDED';
export type Annunci10xPurchaseProvider = 'STRIPE';
export type Annunci10xPersistedEntitlementCapability = 'REWRITE_CREDIT' | 'CREATE_CREDIT' | 'GUIDE_ACCESS' | 'AGENT_RECRUITER_ACCESS';
export type Annunci10xReservableCapability = Extract<Annunci10xPersistedEntitlementCapability, 'REWRITE_CREDIT' | 'CREATE_CREDIT'>;
export type Annunci10xCreditReservationStatus = 'RESERVED' | 'CONSUMED' | 'RELEASED' | 'EXPIRED';
export type Annunci10xStripeEventStatus = 'RECEIVED' | 'PROCESSED' | 'IGNORED' | 'FAILED';
export type Annunci10xPersistedScoreResult = ScoreResult | ScoreResultV2;

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
  score: Annunci10xPersistedScoreResult;
  gate: PublicationGate | null;
}

export interface PersistedEvaluation {
  id: string;
  sessionId: string;
  target: EvaluationTarget['kind'];
  targetRef: string;
  targetOutputId?: string | null;
  score: Annunci10xPersistedScoreResult;
  gate: PublicationGate | null;
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

export interface SaveLeadInput {
  sessionId: string;
  sessionSecret: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
  businessRole: Annunci10xBusinessRole | null;
  emailNormalized: string;
  marketingConsent: boolean;
  marketingConsentVersion: string;
}

export interface PersistedLead {
  id: string;
  sessionId: string;
  firstName: string;
  lastName: string;
  companyName: string | null;
  businessRole: Annunci10xBusinessRole | null;
  emailNormalized: string;
  emailVerifiedAt?: string | null;
  marketingConsent: boolean;
  marketingConsentAt?: string | null;
  marketingConsentVersion?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmailVerificationInput {
  id?: string;
  sessionId: string;
  sessionSecret: string;
  leadId: string;
  emailNormalized: string;
  codeHash: string;
  expiresAt: string;
  maxAttempts: number;
  pendingGraceSeconds: number;
}

export interface PersistedEmailVerification {
  id: string;
  sessionId: string;
  leadId: string;
  emailNormalized: string;
  codeHash?: string;
  status: Annunci10xEmailVerificationStatus;
  expiresAt: string;
  sentAt?: string | null;
  attemptCount: number;
  maxAttempts: number;
  consumedAt?: string | null;
  invalidatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VerifyEmailCodeInput {
  sessionId: string;
  sessionSecret: string;
  verificationId: string;
  codeMatches: boolean;
}

export interface VerifyEmailCodeResult {
  outcome: 'VERIFIED' | 'VERIFICATION_INVALID' | 'VERIFICATION_EXPIRED' | 'MAX_ATTEMPTS_REACHED';
  lead?: PersistedLead | null;
  verification?: PersistedEmailVerification | null;
}

export interface PersistedEmailDelivery {
  id: string;
  sessionId: string;
  leadId: string;
  analysisRunId: string;
  kind: Annunci10xEmailDeliveryKind;
  recipientNormalized: string;
  status: Annunci10xEmailDeliveryStatus;
  provider?: string | null;
  providerRequestId?: string | null;
  attemptCount: number;
  leaseExpiresAt?: string | null;
  sentAt?: string | null;
  lastErrorCode?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClaimEmailDeliveryInput {
  sessionId: string;
  sessionSecret: string;
  analysisRunId: string;
  kind: Annunci10xEmailDeliveryKind;
  recipient: string;
  leaseSeconds: number;
}

export interface MarkEmailDeliverySentInput {
  deliveryId: string;
  sessionSecret: string;
  provider: string;
  providerRequestId?: string | null;
}

export interface MarkEmailDeliveryFailedInput {
  deliveryId: string;
  sessionSecret: string;
  errorCode: string;
}

export interface PersistedPurchase {
  id: string;
  sessionId: string;
  leadId: string;
  offerCode: Annunci10xPersistedOfferCode;
  status: Annunci10xPurchaseStatus;
  provider: Annunci10xPurchaseProvider;
  currency: 'EUR';
  expectedAmountCents: number;
  stripePriceId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeCustomerId?: string | null;
  checkoutCreatedAt?: string | null;
  paidAt?: string | null;
  failedAt?: string | null;
  canceledAt?: string | null;
  refundedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedEntitlementGrant {
  id: string;
  sessionId: string;
  leadId: string;
  purchaseId: string;
  capability: Annunci10xPersistedEntitlementCapability;
  quantity: number;
  createdAt: string;
}

export interface PersistedCreditReservation {
  id: string;
  sessionId: string;
  grantId: string;
  capability: Annunci10xReservableCapability;
  status: Annunci10xCreditReservationStatus;
  quantity: 1;
  leaseExpiresAt: string;
  outputId?: string | null;
  releaseReasonCode?: string | null;
  reservedAt: string;
  consumedAt?: string | null;
  releasedAt?: string | null;
  expiredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedStripeEvent {
  id: string;
  stripeEventId: string;
  eventType: string;
  objectId?: string | null;
  status: Annunci10xStripeEventStatus;
  errorCode?: string | null;
  attemptCount: number;
  processingStartedAt?: string | null;
  receivedAt: string;
  processedAt?: string | null;
}

export interface EffectiveEntitlements {
  rewriteCredits: number;
  createCredits: number;
  guideAccess: boolean;
  agentRecruiterAccess: boolean;
  checkedAt: string;
}

export interface CreateOrGetPurchaseInput {
  sessionId: string;
  sessionSecret: string;
  leadId: string;
  offerCode: Annunci10xPersistedOfferCode;
  expectedAmountCents: number;
  currency: 'EUR';
  stripePriceId: string;
}

export interface AttachCheckoutSessionInput {
  purchaseId: string;
  sessionSecret: string;
  stripeCheckoutSessionId: string;
}

export interface ClaimStripeEventInput {
  stripeEventId: string;
  eventType: string;
  objectId?: string | null;
}

export interface MarkStripeEventInput {
  stripeEventId: string;
  status: Exclude<Annunci10xStripeEventStatus, 'RECEIVED'>;
  errorCode?: string | null;
}

export interface CompletePaidPurchaseInput {
  purchaseId: string;
  stripeCheckoutSessionId: string;
  amountCents: number;
  currency: string;
  stripePaymentIntentId?: string | null;
  stripeCustomerId?: string | null;
}

export interface ReserveGenerationCreditInput {
  sessionId: string;
  sessionSecret: string;
  capability: Annunci10xReservableCapability;
  leaseSeconds: number;
}

export interface ConsumeGenerationCreditInput {
  reservationId: string;
  sessionSecret: string;
  outputId: string;
}

export interface ReleaseGenerationCreditInput {
  reservationId: string;
  sessionSecret: string;
  reasonCode: string;
}

export interface MarkPurchaseCanceledInput {
  stripeCheckoutSessionId: string;
}

export interface MarkPurchaseFailedInput {
  stripePaymentIntentId: string;
  purchaseId?: string | null;
}

export interface MarkPurchaseRefundedInput {
  stripePaymentIntentId: string;
  purchaseId?: string | null;
}

export interface ResultEligibility {
  analysisReady: boolean;
  emailVerified: boolean;
  resultEligible: boolean;
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
  getSnapshotById(snapshotId: string, sessionId: string, sessionSecret: string): Promise<PersistedSnapshot | null>;
  startAiOperation(input: StartAiOperationInput): Promise<PersistedAiOperation>;
  getAiOperation(operationId: string, sessionSecret: string): Promise<PersistedAiOperation | null>;
  completeAiOperation(input: CompleteAiOperationInput): Promise<PersistedAiOperation>;
  failAiOperation(input: FailAiOperationInput): Promise<PersistedAiOperation>;
  saveEvaluation(input: SaveEvaluationInput): Promise<PersistedEvaluation>;
  getLatestEvaluation(sessionId: string, sessionSecret: string): Promise<PersistedEvaluation | null>;
  getEvaluationById(evaluationId: string, sessionId: string, sessionSecret: string): Promise<PersistedEvaluation | null>;
  getEvaluationByTarget(sessionId: string, sessionSecret: string, targetRef: string): Promise<PersistedEvaluation | null>;
  createOrGetAnalysisRun(input: CreateAnalysisRunInput): Promise<PersistedAnalysisRun>;
  getAnalysisRun(analysisRunId: string, sessionSecret: string): Promise<PersistedAnalysisRun | null>;
  getLatestAnalysisRun(sessionId: string, sessionSecret: string): Promise<PersistedAnalysisRun | null>;
  claimAnalysisRun(analysisRunId: string, sessionSecret: string, leaseSeconds: number): Promise<PersistedAnalysisRun | null>;
  updateAnalysisRun(input: UpdateAnalysisRunInput): Promise<PersistedAnalysisRun>;
  checkRateLimit(input: CheckRateLimitInput): Promise<CheckRateLimitResult>;
  saveLead(input: SaveLeadInput): Promise<PersistedLead>;
  getLead(sessionId: string, sessionSecret: string): Promise<PersistedLead | null>;
  createEmailVerification(input: CreateEmailVerificationInput): Promise<PersistedEmailVerification>;
  getActiveEmailVerification(sessionId: string, sessionSecret: string): Promise<PersistedEmailVerification | null>;
  getOpenEmailVerification(sessionId: string, sessionSecret: string): Promise<PersistedEmailVerification | null>;
  markEmailVerificationSent(verificationId: string, sessionSecret: string): Promise<PersistedEmailVerification>;
  markEmailVerificationFailed(verificationId: string, sessionSecret: string): Promise<PersistedEmailVerification>;
  verifyEmailCode(input: VerifyEmailCodeInput): Promise<VerifyEmailCodeResult>;
  claimEmailDelivery(input: ClaimEmailDeliveryInput): Promise<PersistedEmailDelivery | null>;
  markEmailDeliverySent(input: MarkEmailDeliverySentInput): Promise<PersistedEmailDelivery>;
  markEmailDeliveryFailed(input: MarkEmailDeliveryFailedInput): Promise<PersistedEmailDelivery>;
  createOrGetPurchase(input: CreateOrGetPurchaseInput): Promise<PersistedPurchase>;
  attachCheckoutSession(input: AttachCheckoutSessionInput): Promise<PersistedPurchase>;
  getPurchaseById(purchaseId: string): Promise<PersistedPurchase | null>;
  getPurchaseByCheckoutSessionId(stripeCheckoutSessionId: string): Promise<PersistedPurchase | null>;
  claimStripeEvent(input: ClaimStripeEventInput): Promise<PersistedStripeEvent | null>;
  markStripeEvent(input: MarkStripeEventInput): Promise<PersistedStripeEvent>;
  completePaidPurchase(input: CompletePaidPurchaseInput): Promise<PersistedPurchase>;
  markPurchaseCanceled(input: MarkPurchaseCanceledInput): Promise<PersistedPurchase | null>;
  markPurchaseFailed(input: MarkPurchaseFailedInput): Promise<PersistedPurchase | null>;
  markPurchaseRefunded(input: MarkPurchaseRefundedInput): Promise<PersistedPurchase | null>;
  getEffectiveEntitlements(sessionId: string, sessionSecret: string): Promise<EffectiveEntitlements>;
  reserveGenerationCredit(input: ReserveGenerationCreditInput): Promise<PersistedCreditReservation | null>;
  consumeGenerationCredit(input: ConsumeGenerationCreditInput): Promise<PersistedCreditReservation>;
  releaseGenerationCredit(input: ReleaseGenerationCreditInput): Promise<PersistedCreditReservation>;
  getCreditReservationById(reservationId: string, sessionSecret: string): Promise<PersistedCreditReservation | null>;
  saveOutput(input: SaveOutputInput): Promise<PersistedOutput>;
  getLatestOutput(sessionId: string, sessionSecret: string, outputType?: Annunci10xOutputType, parentMasterId?: string | null): Promise<PersistedOutput | null>;
  appendEvent(input: AppendEventInput): Promise<PersistedEvent>;
}
