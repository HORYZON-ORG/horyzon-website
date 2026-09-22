import type {
  AI_OPERATION_STATUSES,
  AI_OPERATION_TYPES,
  ANNUNCI10X_ERROR_CODES,
  CHECK_STATUSES,
  CLAIM_CHECK_STATUSES,
  COMPARISON_CHANGE_TYPES,
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
} from './constants';

export type Id = string;
export type ISODateTime = string;
export type Confidence = number;

export type FactSource = (typeof FACT_SOURCES)[number];
export type FactStatus = (typeof FACT_STATUSES)[number];
export type OriginalAdType = (typeof ORIGINAL_AD_TYPES)[number];
export type RequirementClassification = (typeof REQUIREMENT_CLASSIFICATIONS)[number];
export type Emphasis = (typeof EMPHASIS_VALUES)[number];
export type InterviewStepId = (typeof INTERVIEW_STEP_IDS)[number];
export type SessionState = (typeof SESSION_STATES)[number];
export type EvaluationTargetKind = (typeof EVALUATION_TARGET_KINDS)[number];
export type CheckStatus = (typeof CHECK_STATUSES)[number];
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];
export type PublicationGateCode = (typeof PUBLICATION_GATE_CODES)[number];
export type GeneratedSectionType = (typeof GENERATED_SECTION_TYPES)[number];
export type ClaimCheckStatus = (typeof CLAIM_CHECK_STATUSES)[number];
export type PublicationChannel = (typeof PUBLICATION_CHANNELS)[number];
export type ComparisonChangeType = (typeof COMPARISON_CHANGE_TYPES)[number];
export type AiOperationType = (typeof AI_OPERATION_TYPES)[number];
export type AiOperationStatus = (typeof AI_OPERATION_STATUSES)[number];
export type Annunci10xErrorCode = (typeof ANNUNCI10X_ERROR_CODES)[number];
export type ProductCode = (typeof PRODUCT_CODES)[number];
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];
export type EntitlementSource = (typeof ENTITLEMENT_SOURCES)[number];

export interface ContractVersions {
  dataContractVersion: string;
  methodVersion: string;
  rubricVersion: string;
  strategyVersion: string;
  promptVersion: string;
}

export interface Fact<T> {
  value: T;
  source: FactSource;
  status: FactStatus;
  sourceId?: Id;
  confidence?: Confidence;
  publishable: boolean;
  notes?: string;
}

export interface Annunci10xSnapshot<T = unknown> {
  id: Id;
  sessionId: Id;
  createdAt: ISODateTime;
  versions: ContractVersions;
  payload: T;
  checksum?: string;
}

export interface OriginalAd {
  id: Id;
  sessionId: Id;
  type: OriginalAdType;
  rawText: string;
  language?: Fact<string>;
  uploadedAt: ISODateTime;
  immutable: true;
}

export interface Requirement {
  id: Id;
  label: Fact<string>;
  classification: RequirementClassification;
  evidence?: Fact<string>;
}

export interface Compensation {
  amountText?: Fact<string>;
  minAmount?: Fact<number>;
  maxAmount?: Fact<number>;
  currency?: Fact<string>;
  cadence?: Fact<'HOURLY' | 'MONTHLY' | 'YEARLY' | 'PROJECT' | 'UNKNOWN'>;
  visibility: Fact<'PUBLIC' | 'PRIVATE' | 'OPEN_DECISION' | 'UNKNOWN'>;
}

export interface AttractionContext {
  companyName?: Fact<string>;
  companyDescription?: Fact<string>;
  workMode?: Fact<string>;
  location?: Fact<string>;
  contractType?: Fact<string>;
  schedule?: Fact<string>;
  growth?: Fact<string>;
  teamContext?: Fact<string>;
  attractivenessEvidence: Fact<string>[];
}

export interface RoleCard {
  title?: Fact<string>;
  mission?: Fact<string>;
  outcomes: Fact<string>[];
  responsibilities: Fact<string>[];
  requirements: Requirement[];
  compensation?: Compensation;
  attractionContext: AttractionContext;
}

export interface RoleProfile {
  roleCard: RoleCard;
  rolePopularity?: Fact<Emphasis>;
  companyAttractiveness?: Fact<Emphasis>;
  challengeLevel?: Fact<Emphasis>;
  routineLevel?: Fact<Emphasis>;
  qualificationLevel?: Fact<Emphasis>;
  commitmentLevel?: Fact<Emphasis>;
  technicality?: Fact<Emphasis>;
}

export interface StrategyReason {
  id: Id;
  label: string;
  factIds: Id[];
}

export interface CommunicationStrategy {
  id: Id;
  sessionId: Id;
  summary: string;
  candidateAngle: string;
  emphasis: {
    challenge: Emphasis;
    routine: Emphasis;
    qualification: Emphasis;
    commitment: Emphasis;
    technicality: Emphasis;
  };
  proofPoints: Fact<string>[];
  reasons: StrategyReason[];
  riskNotes: string[];
  missingFacts: Clarification[];
  channelPriorities: PublicationChannel[];
  versions: ContractVersions;
}

export interface Clarification {
  id: Id;
  stepId: InterviewStepId;
  fieldKey: string;
  question: string;
  reason: string;
  requiredFor: 'SCORE' | 'GATE' | 'GENERATION' | 'CHANNEL_ADAPTER';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  blocking: boolean;
  answered: boolean;
}

export interface InterviewDecision {
  askNext: Clarification[];
  stopReason?: 'ENOUGH_FOR_ANALYSIS' | 'ENOUGH_FOR_GENERATION' | 'USER_SKIPPED' | 'BLOCKED';
}

export interface UserAnswer {
  id: Id;
  sessionId: Id;
  clarificationId?: Id;
  questionKey: string;
  rawAnswer: string;
  answerKind: 'KNOWN' | 'UNKNOWN' | 'NOT_APPLICABLE';
  normalizedFacts: Fact<unknown>[];
  answeredAt: ISODateTime;
}

export type EvaluationTarget =
  | { kind: 'ORIGINAL_AD'; originalAdId: Id }
  | { kind: 'GENERATED_MASTER'; generatedAdId: Id }
  | { kind: 'CHANNEL_VARIANT'; channelVariantId: Id; masterAdId: Id };

export interface EvaluationCheck {
  id: string;
  label: string;
  score: number | null;
  maxScore: number;
  status: CheckStatus;
  evidence: string[];
  gateImpact?: 'NONE' | 'WARNING' | 'BLOCKING';
}

export interface ScoreResult {
  value: number | null;
  max: 100;
  interval?: { min: number; max: number };
  coverage: number;
  checks: EvaluationCheck[];
  rubricVersion: string;
}

export interface PublicationGate {
  status: PublicationStatus;
  codes: PublicationGateCode[];
  blockingReasons: string[];
  warnings: string[];
  evaluatedAt: ISODateTime;
}

export interface AdEvaluation {
  id: Id;
  sessionId: Id;
  target: EvaluationTarget;
  score: ScoreResult;
  gate: PublicationGate;
  createdAt: ISODateTime;
}

export interface GeneratedSection {
  id: Id;
  type: GeneratedSectionType;
  key: string;
  title: string;
  body: string;
  sourceFactIds: Id[];
}

export interface GeneratedAd {
  id: Id;
  sessionId: Id;
  kind: 'MASTER';
  sections: GeneratedSection[];
  sourceOfTruth: true;
  generatedAt: ISODateTime;
  promptVersion: string;
}

export interface ClaimCheck {
  id: Id;
  claim: string;
  status: ClaimCheckStatus;
  sourceFactIds: Id[];
  publishable: boolean;
}

export interface ChannelVariant {
  id: Id;
  masterAdId: Id;
  channel: PublicationChannel;
  sections: GeneratedSection[];
  introducedFactIds: [];
  adaptedFromMaster: true;
}

export interface ComparisonChange {
  type: ComparisonChangeType;
  label: string;
  before?: string;
  after?: string;
}

export interface ComparisonResult {
  originalAdId: Id;
  generatedAdId: Id;
  changes: ComparisonChange[];
  improvements: string[];
  regressionsToReview: string[];
}

export interface GeneratedOutput {
  id: Id;
  sessionId: Id;
  master: GeneratedAd;
  score: ScoreResult;
  gate: PublicationGate;
  claimCheck: ClaimCheck[];
  channelVariants: ChannelVariant[];
  comparison?: ComparisonResult;
  commercialContext: CommercialContext;
  versions: ContractVersions;
}

export interface AiOperation {
  id: Id;
  sessionId: Id;
  type: AiOperationType;
  idempotencyKey: string;
  inputSnapshotId: Id;
  outputSnapshotId?: Id;
  promptVersion: string;
  modelConfigKey: string;
  status: AiOperationStatus;
  schemaValid: boolean;
  retryCount: 0 | 1;
  createdAt: ISODateTime;
  completedAt?: ISODateTime;
}

export interface Annunci10xError {
  code: Annunci10xErrorCode;
  message: string;
  retryable: boolean;
}

export type Purchase =
  | {
      id: Id;
      sessionId?: Id;
      productCode: ProductCode;
      status: Exclude<PurchaseStatus, 'PAID'>;
      provider: 'OPEN_DECISION';
      amount: 'OPEN_DECISION';
      currency: 'OPEN_DECISION';
      createdAt: ISODateTime;
    }
  | {
      id: Id;
      sessionId?: Id;
      productCode: ProductCode;
      status: 'PAID';
      provider: 'OPEN_DECISION';
      amount: 'OPEN_DECISION';
      currency: 'OPEN_DECISION';
      createdAt: ISODateTime;
      serverReceiptId: Id;
      verifiedAt: ISODateTime;
    };

export interface Entitlements {
  guide: boolean;
  adGeneration: boolean;
  bundle: boolean;
  source: EntitlementSource;
  verification: 'SERVER_VERIFIED';
  checkedAt: ISODateTime;
  serverAuthorityId: Id;
}

export interface CommercialContext {
  productCode?: ProductCode;
  entitlements: Entitlements;
  reservedOfferEligible: boolean;
  reservedOfferReason?: 'OWNS_GUIDE' | 'BUNDLE' | 'NONE';
  price: 'OPEN_DECISION';
  discountValue: 'OPEN_DECISION';
}

export interface Annunci10xSession {
  id: Id;
  state: SessionState;
  entryMode: 'ANALYZE' | 'BUILD' | 'GUIDE';
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  resumeTokenHash?: string;
  commercialContext: CommercialContext;
  currentSnapshotId?: Id;
}
