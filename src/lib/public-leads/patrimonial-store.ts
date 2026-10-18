import type { PatrimonialConsentEvidence, PatrimonialCrmCheckpoint, PatrimonialEvent, PatrimonialIntent, PatrimonialOutboxOperation, PatrimonialRequest } from './patrimonial-contract.ts';
import type { PatrimonialOpportunityIntent, PatrimonialRoutingParticipation } from './patrimonial-routing.ts';
import { SupabasePatrimonialStore } from './patrimonial-supabase.ts';
import type { AssignmentContext, AssignmentPlan } from './patrimonial-assignments.ts';

export type PatrimonialClaim = { operationId: string; leaseToken: string; leaseVersion: number };
export type PatrimonialOperationError = 'NETWORK' | 'RATE_LIMIT' | 'PROVIDER' | 'SCHEMA' | 'AUTH' | 'CONFIG' | 'IDENTITY' | 'UNKNOWN';
export type PatrimonialClaimInput = { now: string; limit: number; leaseSeconds?: number; reconciliationOnly?: boolean; kinds?: readonly PatrimonialOutboxOperation['kind'][] };
export type PatrimonialMutation = PatrimonialClaim & { now: string };
export type PatrimonialFailureMutation = PatrimonialMutation & {
  errorCode: PatrimonialOperationError; state: 'IDENTITY_REVIEW' | 'RECONCILE_REQUIRED' | 'MANUAL_REVIEW' | 'REJECTED'; reconcileRequired?: boolean;
};
export type PatrimonialCrmCompletion = PatrimonialMutation & {
  checkpoint?: PatrimonialCrmCheckpoint; remoteId?: string;
  followUps?: PatrimonialOutboxOperation[]; reconciliationConfirmed?: boolean;
};

// Callbacks contain only store/domain work and may rerun on a snapshot conflict.
// Production validates their observed values and commits all effects in one DB
// transaction; a series of independently committed REST writes is not sufficient.
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
export class PatrimonialCapabilityUnavailableError extends PatrimonialStoreUnavailableError {
  readonly code = 'PATRIMONIAL_CAPABILITY_UNAVAILABLE';
  readonly capability: 'assignmentManagement' | 'ownerSync';
  constructor(capability: 'assignmentManagement' | 'ownerSync') { super(`Patrimonial capability unavailable: ${capability}`); this.capability=capability; }
}

// Separate resolved business aggregates; the existing provisional lead/CRM ledger
// remains unchanged. All saves are CAS; participation uniqueness is contact+edition,
// or contact+eventSlug for a generic PENDING_EDITION record. Never hold DB locks
// across provider fetches. Deployment/readiness is not enabled by this interface.
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

// Uses the same durable journal, preview/CAS and commit boundary as lead-v2.
// Assignment revision is independent of the CRM/lifecycle aggregate revision.
export interface PatrimonialAssignmentTransaction {
  getAssignmentContext(commandKey: string, intentIds: string[], experimentId: string | null): Promise<AssignmentContext>;
  commitAssignmentPlan(plan: AssignmentPlan, expectedRevision: number): Promise<void>;
}
export interface PatrimonialAssignmentStore {
  transaction<T>(work: (tx: PatrimonialAssignmentTransaction) => Promise<T>): Promise<T>;
}

// Readiness must be explicitly approved AFTER the local migration is applied and
// verified in a future phase. Missing config never falls back to memory or 2A.
export function createProductionPatrimonialStore(env: Record<string, string | undefined> = process.env): SupabasePatrimonialStore {
  const url = (env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (env.PATRIMONIAL_DURABLE_STORE_READY !== 'true' || !url || !serviceRoleKey) throw new PatrimonialStoreUnavailableError('Patrimonial durable store is not ready.');
  return new SupabasePatrimonialStore({ url, serviceRoleKey });
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
    assignments: enabled('PATRIMONIAL_ASSIGNMENTS_ENABLED'),
    ownerSync: enabled('PATRIMONIAL_OWNER_SYNC_ENABLED'),
  };
}
