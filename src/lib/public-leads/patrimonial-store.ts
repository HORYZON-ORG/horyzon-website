import type { PatrimonialConsentEvidence, PatrimonialCrmCheckpoint, PatrimonialEvent, PatrimonialIntent, PatrimonialOutboxOperation, PatrimonialRequest } from './patrimonial-contract.ts';
import type { PatrimonialOpportunityIntent, PatrimonialRoutingParticipation } from './patrimonial-routing.ts';

export type PatrimonialClaim = { operationId: string; leaseToken: string; leaseVersion: number };
export type PatrimonialOperationError = 'NETWORK' | 'RATE_LIMIT' | 'PROVIDER' | 'SCHEMA' | 'AUTH' | 'CONFIG' | 'IDENTITY' | 'UNKNOWN';
export type PatrimonialClaimInput = { now: string; limit: number; leaseSeconds?: number; reconciliationOnly?: boolean };
export type PatrimonialMutation = PatrimonialClaim & { now: string };
export type PatrimonialFailureMutation = PatrimonialMutation & {
  errorCode: PatrimonialOperationError; state: 'IDENTITY_REVIEW' | 'RECONCILE_REQUIRED' | 'MANUAL_REVIEW' | 'REJECTED'; reconcileRequired?: boolean;
};
export type PatrimonialCrmCompletion = PatrimonialMutation & {
  checkpoint?: PatrimonialCrmCheckpoint; remoteId?: string;
  followUps?: PatrimonialOutboxOperation[]; reconciliationConfirmed?: boolean;
};

// All methods on a transaction operate against the same snapshot. Production
// implementations MUST use DB transactions/unique constraints, not successive fetches.
export interface PatrimonialTransaction {
  createOrReplayRequest(input: PatrimonialRequest, now: string): Promise<{ request: PatrimonialRequest; replay: boolean }>;
  getRequest(requestId: string): Promise<PatrimonialRequest | null>;
  getOperation(operationId: string): Promise<PatrimonialOutboxOperation | null>;
  getConsentEvidence(requestId: string): Promise<PatrimonialConsentEvidence[]>;
  createOrReuseIntent(input: PatrimonialIntent): Promise<PatrimonialIntent>;
  attachIntent(requestId: string, intentId: string): Promise<void>;
  appendConsentEvidence(input: PatrimonialConsentEvidence): Promise<void>;
  appendEvent(input: PatrimonialEvent): Promise<void>;
  enqueueOperation(input: PatrimonialOutboxOperation): Promise<void>;
  // Atomic per-intent claim. Expired leases require reconciliation; unresolved
  // uncertain operations block newer work for the same intent, even at max attempts.
  claimOperations(input: PatrimonialClaimInput): Promise<PatrimonialOutboxOperation[]>;
  // Every worker mutation must check token, version AND unexpired lease.
  renewLease(input: PatrimonialMutation & { leaseSeconds?: number }): Promise<void>;
  completeOperation(input: PatrimonialMutation): Promise<void>;
  // Checkpoint + remote ID + completion + dependent effects are one commit.
  // A stale claim cannot save a remote ID or release dependent work.
  completeCrmOperation(input: PatrimonialCrmCompletion): Promise<void>;
  holdOperation(input: PatrimonialMutation): Promise<void>;
  failOperation(input: PatrimonialFailureMutation): Promise<void>;
  scheduleRetry(input: PatrimonialMutation & { nextAttemptAt: string; errorCode: PatrimonialOperationError }): Promise<void>;
  markManualReview(input: PatrimonialMutation & { errorCode: PatrimonialOperationError }): Promise<void>;
}

export interface PatrimonialStore extends PatrimonialTransaction {
  readonly kind: 'durable' | 'test-memory';
  // Must resolve ONLY after the acquisition has committed. Thrown post-commit
  // failures are recoverable through replay; never compensate by deleting rows.
  transaction<T>(work: (tx: PatrimonialTransaction) => Promise<T>): Promise<T>;
}

export class PatrimonialConflictError extends Error {}
export class PatrimonialReplayExpiredError extends Error {}
export class PatrimonialStaleLeaseError extends Error {}
export class PatrimonialStoreUnavailableError extends Error {}

// Separate resolved business aggregates; the existing provisional lead/CRM ledger
// remains unchanged. All saves are CAS; participation uniqueness is contact+edition,
// or contact+eventSlug for a generic PENDING_EDITION record. Never hold DB locks
// across provider fetches. Production implementation remains unconfigured.
export type PatrimonialOpportunitySyncState = 'SYNC_PENDING' | 'SYNCED' | 'MANUAL_REVIEW' | 'RECONCILE_REQUIRED';
export interface PatrimonialOpportunityTransaction {
  findOpportunityIntent(groupKey: string): Promise<PatrimonialOpportunityIntent | null>;
  getOpportunityIntent(id: string): Promise<PatrimonialOpportunityIntent | null>;
  saveOpportunityIntent(intent: PatrimonialOpportunityIntent, expectedRevision: number | null): Promise<void>;
  listParticipations(relationId: string): Promise<PatrimonialRoutingParticipation[]>;
  saveParticipations(relationId: string, next: PatrimonialRoutingParticipation[], previous: PatrimonialRoutingParticipation[]): Promise<void>;
  claimOpportunitySync(id: string, expectedRevision: number, now: string): Promise<{ intent: PatrimonialOpportunityIntent; token: string; reconcileRequired: boolean } | null>;
  authorizeOpportunityWrite(id: string, expectedRevision: number, token: string, now: string): Promise<void>;
  finishOpportunitySync(id: string, expectedRevision: number, token: string, now: string, state: PatrimonialOpportunitySyncState, remote?: NonNullable<PatrimonialOpportunityIntent['remote']>): Promise<void>;
}
export interface PatrimonialOpportunityStore {
  transaction<T>(work: (tx: PatrimonialOpportunityTransaction) => Promise<T>): Promise<T>;
}

// Supabase boundary intentionally unimplemented/non-activatable in this phase.
// No credentials are read, no fetch exists, no production memory fallback.
export function createProductionPatrimonialStore(): PatrimonialStore {
  throw new PatrimonialStoreUnavailableError('A verified durable patrimonial adapter is not installed.');
}

export function patrimonialFlags(env: Record<string, string | undefined> = process.env) {
  const enabled = (key: string) => env[key] === 'true';
  return {
    v2: enabled('PATRIMONIAL_V2_ENABLED'),
    crmWrite: enabled('PATRIMONIAL_CRM_WRITE_ENABLED'),
    opportunityWrite: enabled('PATRIMONIAL_OPPORTUNITY_WRITE_ENABLED'),
    booking: enabled('PATRIMONIAL_BOOKING_ENABLED'),
    messages: enabled('PATRIMONIAL_MESSAGES_ENABLED'),
    webhook: enabled('PATRIMONIAL_WEBHOOK_ENABLED'),
  };
}
