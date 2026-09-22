# Annunci 10x data contracts v1

Canonical route: `/annunci-10x`

Legacy route, not part of these contracts: `/annuncio-10x` is `NON TOCCARE`.

These contracts are TypeScript-like pseudotypes. They are not implementation code and must not be converted into a migration in this phase.

## Shared primitives

```ts
type Id = string;
type ISODateTime = string;
type Version = string;

type Provenance =
  | 'EXTRACTED'
  | 'USER_DECLARED'
  | 'SYSTEM_INFERRED'
  | 'USER_CONFIRMED';

type ProductCode = 'GUIDE' | 'AD_GENERATION' | 'GUIDE_PLUS_AD';

type FactStatus =
  | 'RAW'
  | 'NORMALIZED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'STALE';

type Fact<T> = {
  value: T;
  provenance: Provenance;
  status: FactStatus;
  sourceId?: Id;
  confidence?: number;
  publishable: boolean;
  notes?: string;
};
```

Rule: a `Fact<T>` with `provenance: 'SYSTEM_INFERRED'` must default to `publishable: false` until it is converted into `USER_CONFIRMED`.

## Versioned snapshots

```ts
type SnapshotVersions = {
  dataContractVersion: 'annunci10x-data-contracts-v1';
  methodVersion: string;
  rubricVersion: string;
  strategyVersion: string;
  promptVersion: string;
};

type VersionedSnapshot<T> = {
  id: Id;
  sessionId: Id;
  createdAt: ISODateTime;
  versions: SnapshotVersions;
  payload: T;
  checksum?: string;
};
```

Snapshots are append-only. They capture normalized state at a point in time and never mutate `OriginalAd`.

## Session

```ts
type SessionState =
  | 'STARTED'
  | 'PRECHECKED'
  | 'ANALYZING'
  | 'ANALYSIS_READY'
  | 'CLARIFYING'
  | 'BUILDING'
  | 'READY_FOR_PURCHASE'
  | 'PURCHASE_PENDING'
  | 'ENTITLED'
  | 'GENERATING'
  | 'OUTPUT_READY'
  | 'NEEDS_VERIFICATION'
  | 'ERROR'
  | 'ABANDONED';

type Annunci10xSession = {
  id: Id;
  state: SessionState;
  entryMode: 'ANALYZE' | 'BUILD' | 'GUIDE';
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  resumeTokenHash?: string;
  commercialContext: CommercialContext;
  entitlements?: Entitlements;
  currentSnapshotId?: Id;
};
```

## Original ad and answers

```ts
type OriginalAd = {
  id: Id;
  sessionId: Id;
  rawText: string;
  language?: Fact<string>;
  uploadedAt: ISODateTime;
  immutable: true;
};

type UserAnswer = {
  id: Id;
  sessionId: Id;
  clarificationId?: Id;
  questionKey: string;
  rawAnswer: string;
  normalizedFacts: Fact<unknown>[];
  answeredAt: ISODateTime;
};
```

Rules:

- `rawAnswer` is stored separately from normalized facts.
- normalization never overwrites the raw answer.
- `OriginalAd` is immutable and remains available for comparison.

## Role model

```ts
type Requirement = {
  id: Id;
  label: Fact<string>;
  kind: 'ESSENTIAL' | 'PREFERRED' | 'DISQUALIFYING' | 'TRAINABLE';
  evidence?: Fact<string>;
};

type Compensation = {
  amountText?: Fact<string>;
  minAmount?: Fact<number>;
  maxAmount?: Fact<number>;
  currency?: Fact<string>;
  cadence?: Fact<'HOURLY' | 'MONTHLY' | 'YEARLY' | 'PROJECT'>;
  visibility: Fact<'PUBLIC' | 'PRIVATE' | 'OPEN_DECISION'>;
};

type AttractionContext = {
  companyName?: Fact<string>;
  companyDescription?: Fact<string>;
  workMode?: Fact<string>;
  location?: Fact<string>;
  contractType?: Fact<string>;
  schedule?: Fact<string>;
  growth?: Fact<string>;
  teamContext?: Fact<string>;
  attractivenessEvidence: Fact<string>[];
};

type RoleCard = {
  title?: Fact<string>;
  mission?: Fact<string>;
  outcomes: Fact<string>[];
  responsibilities: Fact<string>[];
  requirements: Requirement[];
  compensation?: Compensation;
  attractionContext: AttractionContext;
};

type RoleProfile = {
  roleCard: RoleCard;
  rolePopularity?: Fact<'LOW' | 'MEDIUM' | 'HIGH' | 'N/D'>;
  companyAttractiveness?: Fact<'LOW' | 'MEDIUM' | 'HIGH' | 'N/D'>;
  challengeLevel?: Fact<'LOW' | 'MEDIUM' | 'HIGH' | 'N/D'>;
  routineLevel?: Fact<'LOW' | 'MEDIUM' | 'HIGH' | 'N/D'>;
  qualificationLevel?: Fact<'LOW' | 'MEDIUM' | 'HIGH' | 'N/D'>;
  commitmentLevel?: Fact<'LOW' | 'MEDIUM' | 'HIGH' | 'N/D'>;
  technicality?: Fact<'LOW' | 'MEDIUM' | 'HIGH' | 'N/D'>;
};
```

## Strategy and clarification

```ts
type CommunicationStrategy = {
  id: Id;
  sessionId: Id;
  summary: string;
  candidateAngle: string;
  proofPoints: Fact<string>[];
  riskNotes: string[];
  missingFacts: Clarification[];
  channelPriorities: string[];
  versions: SnapshotVersions;
};

type Clarification = {
  id: Id;
  fieldKey: string;
  question: string;
  reason: string;
  requiredFor: 'SCORE' | 'GATE' | 'GENERATION' | 'CHANNEL_ADAPTER';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
};

type InterviewDecision = {
  askNext: Clarification[];
  stopReason?: 'ENOUGH_FOR_ANALYSIS' | 'ENOUGH_FOR_GENERATION' | 'USER_SKIPPED' | 'BLOCKED';
};
```

## Evaluation

```ts
type EvaluationTarget =
  | { kind: 'ORIGINAL_AD'; originalAdId: Id }
  | { kind: 'MASTER'; generatedAdId: Id }
  | { kind: 'CHANNEL_VARIANT'; channelVariantId: Id };

type EvaluationCheck = {
  id: string;
  label: string;
  score: number | null;
  maxScore: number;
  status: 'PASS' | 'PARTIAL' | 'MISSING' | 'CONFLICT' | 'NOT_EVALUABLE';
  evidence: string[];
  gateImpact?: 'NONE' | 'WARNING' | 'BLOCKING';
};

type ScoreResult = {
  value: number | null;
  minScore?: number;
  maxScore?: number;
  max: 100;
  interval?: { min: number; max: number };
  coverage: number;
  checks: EvaluationCheck[];
  rubricVersion: string;
};

type PublicationStatus = 'READY' | 'READY_WITH_WARNINGS' | 'NEEDS_VERIFICATION' | 'BLOCKED';

type PublicationGate = {
  status: PublicationStatus;
  blockingReasons: string[];
  warnings: string[];
  evaluatedAt: ISODateTime;
};

type AdEvaluation = {
  id: Id;
  sessionId: Id;
  target: EvaluationTarget;
  score: ScoreResult;
  gate: PublicationGate;
  createdAt: ISODateTime;
};
```

Evaluation targets are separate. The original ad, Master, and channel variants are not scored as the same artifact.

Deterministic score rules:

- `PASS` derives full check points.
- `PARTIAL` derives half check points.
- `MISSING` and `CONFLICT` derive zero points.
- `NOT_EVALUABLE` derives `null`, reduces coverage, and creates an interval.
- callers must not provide arbitrary points for a check.

## Generated output

```ts
type GeneratedSection = {
  id: Id;
  key: string;
  title: string;
  body: string;
  sourceFactIds: Id[];
};

type GeneratedAd = {
  id: Id;
  sessionId: Id;
  kind: 'MASTER';
  sections: GeneratedSection[];
  sourceOfTruth: true;
  generatedAt: ISODateTime;
  promptVersion: string;
};

type ClaimCheck = {
  id: Id;
  claim: string;
  status:
    | 'SUPPORTED'
    | 'NEEDS_CONFIRMATION'
    | 'UNSUPPORTED'
    | 'CONTRADICTED'
    | 'NOT_APPLICABLE';
  sourceFactIds: Id[];
  publishable: boolean;
};

type ChannelVariant = {
  id: Id;
  masterAdId: Id;
  channel: 'LINKEDIN' | 'INDEED' | 'ATS' | 'EMAIL' | 'CUSTOM';
  sections: GeneratedSection[];
  introducedFactIds: never[];
  adaptedFromMaster: true;
};

type ComparisonResult = {
  originalAdId: Id;
  generatedAdId: Id;
  changedAreas: string[];
  improvements: string[];
  regressionsToReview: string[];
};

type GeneratedOutput = {
  id: Id;
  sessionId: Id;
  master: GeneratedAd;
  score: ScoreResult;
  gate: PublicationGate;
  claimCheck: ClaimCheck[];
  channelVariants: ChannelVariant[];
  comparison?: ComparisonResult;
  commercialContext: CommercialContext;
  versions: SnapshotVersions;
};
```

The Master is the source of truth for all channel variants.

## AI operations and errors

```ts
type AiOperation = {
  id: Id;
  sessionId: Id;
  task:
    | 'PRECHECK'
    | 'EXTRACT'
    | 'CLARIFY'
    | 'PROFILE'
    | 'STRATEGY'
    | 'GENERATE'
    | 'VALIDATE'
    | 'EVALUATE'
    | 'CHANNEL_ADAPTER'
    | 'EDIT_CLASSIFIER'
    | 'REVISE';
  idempotencyKey: string;
  inputSnapshotId: Id;
  outputSnapshotId?: Id;
  promptVersion: string;
  modelConfigKey: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';
  schemaValid: boolean;
  retryCount: 0 | 1;
  createdAt: ISODateTime;
  completedAt?: ISODateTime;
};

type Annunci10xError = {
  code:
    | 'INVALID_INPUT'
    | 'SCHEMA_INVALID'
    | 'PAYMENT_REQUIRED'
    | 'ENTITLEMENT_MISSING'
    | 'GENERATION_BLOCKED'
    | 'NEEDS_VERIFICATION'
    | 'RATE_LIMITED'
    | 'INTERNAL';
  message: string;
  retryable: boolean;
};
```

AI operations must be idempotent. The idempotency key is derived from task, session, input snapshot, prompt version, and model config key.

No chain-of-thought is requested or stored.

## Commercial contracts

```ts
type Purchase = {
  id: Id;
  sessionId?: Id;
  productCode: ProductCode;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELED';
  provider: 'OPEN_DECISION';
  amount: 'OPEN_DECISION';
  currency: 'OPEN_DECISION';
  createdAt: ISODateTime;
};

type Entitlements = {
  guide: boolean;
  adGeneration: boolean;
  bundle: boolean;
  source: 'PURCHASE' | 'BUNDLE' | 'ADMIN' | 'OPEN_DECISION';
  checkedAt: ISODateTime;
};

type CommercialContext = {
  productCode?: ProductCode;
  entitlements: Entitlements;
  reservedOfferEligible: boolean;
  reservedOfferReason?: 'OWNS_GUIDE' | 'BUNDLE' | 'NONE';
  price: 'OPEN_DECISION';
  discountValue: 'OPEN_DECISION';
};
```

Server-side entitlement is mandatory. A browser flag cannot grant generation.

## Conceptual MVP database

Do not create a migration in this phase.

Conceptual tables:

- `annunci10x_sessions`
- `annunci10x_answers`
- `annunci10x_snapshots`
- `annunci10x_ai_operations`
- `annunci10x_evaluations`
- `annunci10x_outputs`
- `annunci10x_events`

Open decisions:

- `OPEN DECISION`: physical database provider.
- `OPEN DECISION`: authentication and account identity.
- `OPEN DECISION`: retention policy.
- `OPEN DECISION`: payment provider and webhook schema.
