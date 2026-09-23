# Annunci 10x data contracts v1

Canonical route: `/annunci-10x`

Legacy route, not part of these contracts: `/annuncio-10x` is `NON TOCCARE`.

These contracts are TypeScript-like pseudotypes. The Phase 1 contract was documentation-only; Phase 3 adds the physical Supabase persistence mapping described at the end of this document.

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
  verification: 'SERVER_VERIFIED';
  checkedAt: ISODateTime;
  serverAuthorityId: Id;
};

type CommercialEntitlements = {
  guide: boolean;
  adGenerationCredits: number;
  source: 'NO_TRUSTED_SOURCE' | 'PURCHASE' | 'BUNDLE' | 'ADMIN' | 'TEST';
  verification: 'SERVER_VERIFIED';
  checkedAt: ISODateTime;
};

type CommercialSubject = {
  kind: 'ACCOUNT' | 'EMAIL_VERIFIED' | 'PAYMENT_CUSTOMER' | 'SESSION' | 'ANONYMOUS';
  id?: Id;
  sessionId?: Id;
};

type CommercialOffer = {
  id: Id;
  productCode: ProductCode;
  displayName: string;
  description: string;
  includedCapabilities: ('GUIDE_ACCESS' | 'AD_GENERATION_CREDIT')[];
  eligibility: 'AVAILABLE' | 'UNAVAILABLE';
  pricingStatus: 'OPEN_DECISION';
  discountReason: 'NONE' | 'GUIDE_OWNER' | 'BUNDLE';
  purchaseEnabled: false;
  reasonUnavailable: 'PURCHASE_DISABLED' | 'ALREADY_ENTITLED';
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

Server-side entitlement is mandatory. A browser flag cannot grant guide access, ad generation credits, `PAID` state, price, or discount. Phase 7 implements the commercial catalog, offer engine, and entitlement provider abstraction in code. The real entitlement source of truth, checkout, webhook handling, payment provider, and prices remain pending.

Read-only commercial API shape:

```txt
GET /api/annunci-10x/commercial/offers
```

The API may use a server-verified session cookie to select the trusted flow/state. Query parameters or client payloads such as `guide=true`, `credits=100`, `paid=true`, or `price=0` are ignored or rejected and cannot mutate trusted state.

## Conceptual MVP database

Phase 1 note: the following table list was conceptual and did not authorize a migration during the foundations phase. Phase 3 now materializes the MVP persistence layer in Supabase with additive, isolated `annunci10x_*` objects.

Conceptual tables:

- `annunci10x_sessions`
- `annunci10x_answers`
- `annunci10x_snapshots`
- `annunci10x_ai_operations`
- `annunci10x_evaluations`
- `annunci10x_outputs`
- `annunci10x_events`

Open decisions:

- Physical database provider: Supabase project `horyzon` (`pmkyeqrfkunypfkbjnyg`, `eu-central-1`).
- `OPEN DECISION`: authentication and account identity.
- `OPEN DECISION`: retention policy.
- `OPEN DECISION`: payment provider and webhook schema.

## Supabase persistence v1

Migration files:

- `supabase/migrations/20260922195436_annunci10x_persistence.sql`
- `supabase/migrations/20260922195633_annunci10x_fk_indexes.sql`

Physical tables:

- `annunci10x_sessions`: anonymous/session-owned root record with SHA-256 owner secret verifier, flow, state, current snapshot pointer, selected channel, version columns, commercial context, timestamps, optional expiry.
- `annunci10x_answers`: raw interview answers. Raw text stays separate from normalized facts and snapshots.
- `annunci10x_snapshots`: append-only normalized state snapshots with monotonic per-session `version`, role card, optional role profile and strategy.
- `annunci10x_ai_operations`: AI operation audit and idempotency ledger. It stores status, model, prompt version, optional snapshot refs, output/error payloads, and never stores chain-of-thought.
- `annunci10x_outputs`: generated Master ads and channel variants. `CHANNEL_VARIANT` rows require a channel and parent Master.
- `annunci10x_evaluations`: score, gate, and evaluation target persistence for original ads, generated Master ads, and channel variants.
- `annunci10x_events`: minimal telemetry with database and runtime guards against raw answers, original/full ad text, compensation, company name, personal data, and PII in metadata.

Access model:

- All Annunci 10x tables have RLS enabled.
- No `anon` or `authenticated` grants are given on Annunci 10x tables or RPC functions.
- No public RLS policies are created intentionally; access is server-only through the Supabase service role.
- The service role receives only the needed table privileges: read/write for mutable server records and insert/read for append-only records.
- Session ownership is verified with an owner secret hash. The browser receives the secret; the database stores only the hash.
- The service-role key must never be exposed through `NEXT_PUBLIC_*` variables or client components.

RPC functions:

- `annunci10x_create_session`: creates a session and returns the row without `owner_secret_hash`.
- `annunci10x_verify_session_secret`: verifies session ownership and expiry.
- `annunci10x_append_snapshot`: locks the session row, computes the next version, appends a snapshot, and updates `current_snapshot_id`.
- `annunci10x_register_ai_operation`: creates or returns an idempotent operation for the same session, task, input snapshot identity, prompt version, and idempotency key.
- `annunci10x_complete_ai_operation`: marks an owned operation as `SUCCEEDED`.
- `annunci10x_fail_ai_operation`: marks an owned operation as `FAILED`.

All Annunci 10x RPC functions are `SECURITY DEFINER`, set `search_path = pg_catalog, public`, revoke default execution from `public`, `anon`, and `authenticated`, and grant execution only to `service_role`.

Runtime adapter:

- `src/lib/annunci-10x/persistence/adapter.ts` provides a server-only Supabase REST/RPC adapter and a memory adapter for deterministic tests.
- `src/lib/annunci-10x/persistence/rows.ts` parses database rows back through the Annunci 10x domain validators before returning them to callers.
- `src/lib/annunci-10x/persistence/security.ts` owns session secret creation, hashing, and safe event metadata validation.

AI runtime persistence:

- Phase 4 uses `annunci10x_ai_operations`; no additional migration is required.
- The orchestrator computes a deterministic idempotency key from session, operation type, input identity, prompt version, and model.
- If an operation with the same idempotency identity is already `SUCCEEDED`, its validated output payload is reused and the provider is not called again.
- Successful operation payloads store sanitized output, provider name, model, prompt id/version, optional provider request id, latency, retry count, and usage metadata.
- Failed operation payloads store sanitized error code/message/retryability/status only.
- Chain-of-thought, API keys, session secrets, raw provider response bodies, payment state, and browser credentials are not persisted in `annunci10x_ai_operations`.

Mapping notes:

- Product `BUILD` entry mode maps to persistence flow `CREATE`; read-side parsing maps `CREATE` back to `entryMode: 'BUILD'`.
- Phase 6 `CREATE` uses seven product macro-steps without changing the physical `annunci10x_answers.interview_step` enum:
  - `ROLE_CONTEXT` -> `ROLE`
  - `PRIMARY_CONTRIBUTION` -> `OUTCOMES`
  - `WORK_REALITY` -> `OUTCOMES`
  - `REQUIREMENTS` -> `REQUIREMENTS`
  - `ATTRACTION` -> `ATTRACTION`
  - `OFFER` -> `CONDITIONS`
  - `CHANNEL_APPLICATION` -> `CHANNEL`
- Raw answers remain in `annunci10x_answers`; normalized facts, profile, and strategy are represented by append-only snapshots. This keeps raw user text separate from AI operation telemetry and avoids a Phase 6 migration.
- Session state updates for `CREATE` use the existing `annunci10x_sessions.state`, `selected_channel`, and `current_snapshot_id` columns through the server-side adapter. No client-side state is authoritative for payment readiness.
- Payment, checkout, webhook schema, authenticated account identity, cross-device resume, and retention duration remain `OPEN DECISION`.
- The current persistence layer is prepared for server-side entitlement data, but it does not implement a payment provider or entitlement source of truth yet.
- Phase 4 adds runtime error codes `AI_PROVIDER_ERROR`, `AI_INVALID_OUTPUT`, `RATE_LIMITED`, and `INTERNAL_ERROR` for provider-facing failures; deterministic domain errors remain separate.
