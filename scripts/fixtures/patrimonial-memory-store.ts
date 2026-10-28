// Test fixture only. Never imported by application code or a production factory.
import { randomUUID } from 'node:crypto';
import type { PatrimonialConsentEvidence, PatrimonialEvent, PatrimonialIntent, PatrimonialOutboxOperation, PatrimonialRequest } from '../../src/lib/public-leads/patrimonial-contract.ts';
import {
  PatrimonialConflictError, PatrimonialReplayExpiredError, PatrimonialStaleLeaseError,
  type PatrimonialClaimInput, type PatrimonialCrmCompletion, type PatrimonialFailureMutation, type PatrimonialMutation,
  type PatrimonialOperationError, type PatrimonialStore, type PatrimonialTransaction,
} from '../../src/lib/public-leads/patrimonial-store.ts';
import { PATRIMONIAL_LEASE_SECONDS, PATRIMONIAL_MAX_ATTEMPTS } from '../../src/lib/public-leads/patrimonial-sync.ts';

type State = {
  requests: Map<string, PatrimonialRequest>; intents: Map<string, PatrimonialIntent>;
  consents: Map<string, PatrimonialConsentEvidence>; operations: Map<string, PatrimonialOutboxOperation>;
  events: Map<string, PatrimonialEvent>;
};
type Hooks = { beforeCommit?: () => void; afterCommit?: () => void };
const initialState = (): State => ({ requests: new Map(), intents: new Map(), consents: new Map(), operations: new Map(), events: new Map() });
function milliseconds(now: string): number {
  const value = Date.parse(now);
  if (!Number.isFinite(value)) throw new Error('Invalid server timestamp.');
  return value;
}
function leaseEnd(now: string, seconds = PATRIMONIAL_LEASE_SECONDS): string {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 600) throw new Error('Invalid lease duration.');
  return new Date(milliseconds(now) + seconds * 1000).toISOString();
}

class MemoryTransaction implements PatrimonialTransaction {
  private state: State;
  private active = true;
  constructor(state: State) { this.state = state; }
  close() { this.active = false; }
  private check() { if (!this.active) throw new Error('Transaction already closed.'); }

  async createOrReplayRequest(input: PatrimonialRequest, now: string) {
    this.check();
    const existing = this.state.requests.get(input.id);
    if (existing) {
      if (existing.payloadHash !== input.payloadHash) throw new PatrimonialConflictError();
      if (milliseconds(now) >= milliseconds(existing.replayExpiresAt)) throw new PatrimonialReplayExpiredError();
      return { request: structuredClone(existing), replay: true };
    }
    this.state.requests.set(input.id, structuredClone(input));
    return { request: structuredClone(input), replay: false };
  }
  async getRequest(requestId: string) {
    this.check();
    return structuredClone(this.state.requests.get(requestId) ?? null);
  }
  async getOperation(operationId: string) {
    this.check();
    return structuredClone(this.state.operations.get(operationId) ?? null);
  }
  async getConsentEvidence(requestId: string) {
    this.check();
    return structuredClone([...this.state.consents.values()].filter(x => x.requestId === requestId));
  }
  async createOrReuseIntent(input: PatrimonialIntent) {
    this.check();
    const existing = [...this.state.intents.values()].find(x => x.provisionalKey === input.provisionalKey);
    if (existing) return structuredClone(existing);
    this.state.intents.set(input.id, structuredClone(input));
    return structuredClone(input);
  }
  async attachIntent(requestId: string, intentId: string) {
    this.check();
    const request = this.state.requests.get(requestId);
    if (!request || !this.state.intents.has(intentId)) throw new Error('Missing acquisition row.');
    if (request.intentId && request.intentId !== intentId) throw new Error('Intent cannot be replaced.');
    request.intentId = intentId;
    request.technicalState = 'SYNC_PENDING';
    this.state.intents.get(intentId)!.technicalState = 'SYNC_PENDING';
  }
  async appendConsentEvidence(input: PatrimonialConsentEvidence) {
    this.check();
    if (!this.state.requests.has(input.requestId)) throw new Error('Missing request.');
    if ([...this.state.consents.values()].some(x => x.requestId === input.requestId && x.purpose === input.purpose)) return;
    this.state.consents.set(input.id, structuredClone(input));
  }
  async appendEvent(input: PatrimonialEvent) {
    this.check();
    if (!this.state.requests.has(input.requestId) || !this.state.intents.has(input.intentId)) throw new Error('Missing acquisition row.');
    if ([...this.state.events.values()].some(x => x.name === input.name && x.requestId === input.requestId)) return;
    this.state.events.set(input.id, structuredClone(input));
  }
  async enqueueOperation(input: PatrimonialOutboxOperation) {
    this.check();
    if (!this.state.requests.has(input.requestId) || !this.state.intents.has(input.intentId)) throw new Error('Missing acquisition row.');
    if ([...this.state.operations.values()].some(x => x.operationKey === input.operationKey)) return;
    this.state.operations.set(input.id, structuredClone(input));
  }
  async claimOperations(input: PatrimonialClaimInput) {
    this.check();
    const now = milliseconds(input.now);
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) throw new Error('Invalid claim limit.');
    const expiresAt = leaseEnd(input.now, input.leaseSeconds);
    const lockKey = (x: PatrimonialOutboxOperation) => x.identityLockKey ?? x.intentId;
    const activeIntents = new Set([...this.state.operations.values()].filter(x =>
      (x.technicalState === 'SYNCING' && milliseconds(x.leaseExpiresAt!) > now)
      || (x.technicalState === 'RECONCILE_REQUIRED' && !input.reconciliationOnly)
      || x.technicalState === 'IDENTITY_REVIEW' || x.technicalState === 'MANUAL_REVIEW',
    ).map(lockKey));
    const claimed: PatrimonialOutboxOperation[] = [];
    const expiredClaim = (x: PatrimonialOutboxOperation) => x.technicalState === 'SYNCING' && milliseconds(x.leaseExpiresAt!) <= now;
    // An expired uncertain operation takes priority over new work for that intent.
    const due = [...this.state.operations.values()].sort((a, b) => Number(expiredClaim(b)) - Number(expiredClaim(a)) || a.nextAttemptAt.localeCompare(b.nextAttemptAt) || a.id.localeCompare(b.id));
    for (const operation of due) {
      const expired = operation.technicalState === 'SYNCING' && milliseconds(operation.leaseExpiresAt!) <= now;
      const reconciling = input.reconciliationOnly && operation.technicalState === 'RECONCILE_REQUIRED';
      if (input.reconciliationOnly ? !reconciling : (!expired && !['SYNC_PENDING', 'RETRY_SCHEDULED'].includes(operation.technicalState))) continue;
      if (operation.dependsOn && this.state.operations.get(operation.dependsOn)?.technicalState !== 'SYNCED') continue;
      if (milliseconds(operation.nextAttemptAt) > now || activeIntents.has(lockKey(operation))) continue;
      if (expired) operation.reconcileRequired = true;
      if (operation.attemptCount >= PATRIMONIAL_MAX_ATTEMPTS) {
        operation.technicalState = 'MANUAL_REVIEW';
        operation.leaseToken = null; operation.leaseExpiresAt = null;
        if (operation.reconcileRequired) activeIntents.add(lockKey(operation));
        this.projectRequest(operation); continue;
      }
      operation.technicalState = 'SYNCING'; operation.attemptCount++;
      operation.leaseVersion++; operation.leaseToken = randomUUID(); operation.leaseExpiresAt = expiresAt;
      activeIntents.add(lockKey(operation)); this.projectRequest(operation);
      claimed.push(structuredClone(operation));
      if (claimed.length >= input.limit) break;
    }
    return claimed;
  }
  private owned(input: PatrimonialMutation) {
    this.check();
    const operation = this.state.operations.get(input.operationId);
    if (!operation || operation.technicalState !== 'SYNCING' || operation.leaseToken !== input.leaseToken || operation.leaseVersion !== input.leaseVersion || milliseconds(operation.leaseExpiresAt!) <= milliseconds(input.now)) throw new PatrimonialStaleLeaseError();
    return operation;
  }
  private projectRequest(operation: PatrimonialOutboxOperation) {
    const siblings = [...this.state.operations.values()].filter(x => x.requestId === operation.requestId);
    const request = this.state.requests.get(operation.requestId)!;
    const blocked = siblings.find(x => ['IDENTITY_REVIEW', 'RECONCILE_REQUIRED', 'MANUAL_REVIEW', 'REJECTED'].includes(x.technicalState));
    request.technicalState = blocked?.technicalState ?? (siblings.every(x => x.technicalState === 'SYNCED') ? 'SYNCED' : operation.technicalState === 'SYNCED' ? 'SYNC_PENDING' : operation.technicalState);
    const intent = this.state.intents.get(operation.intentId)!;
    const requests = [...this.state.requests.values()].filter(x => x.intentId === intent.id);
    const blockedRequest = requests.find(x => ['IDENTITY_REVIEW', 'RECONCILE_REQUIRED', 'MANUAL_REVIEW', 'REJECTED'].includes(x.technicalState));
    intent.technicalState = blockedRequest?.technicalState ?? (requests.every(x => x.technicalState === 'SYNCED') ? 'SYNCED' : request.technicalState === 'SYNCED' ? 'SYNC_PENDING' : request.technicalState);
  }
  private release(operation: PatrimonialOutboxOperation) {
    operation.leaseToken = null; operation.leaseExpiresAt = null;
    this.projectRequest(operation);
  }
  async renewLease(input: PatrimonialMutation & { leaseSeconds?: number }) {
    const operation = this.owned(input);
    operation.leaseExpiresAt = leaseEnd(input.now, input.leaseSeconds);
  }
  async completeOperation(input: PatrimonialMutation) {
    const operation = this.owned(input);
    if (operation.reconcileRequired) throw new Error('Reconciliation is required before completion.');
    operation.technicalState = 'SYNCED'; this.release(operation);
  }
  async completeCrmOperation(input: PatrimonialCrmCompletion) {
    const operation = this.owned(input);
    if (operation.reconcileRequired && !input.reconciliationConfirmed) throw new Error('Reconciliation is required before completion.');
    const request = this.state.requests.get(operation.requestId)!;
    if (input.checkpoint) {
      if (request.crm?.locationId && request.crm.locationId !== input.checkpoint.locationId) throw new Error('Location cannot change.');
      if (request.crm?.contactId && request.crm.contactId !== input.checkpoint.contactId) throw new Error('Contact cannot change without review.');
      request.crm = structuredClone(input.checkpoint);
      const intent = this.state.intents.get(operation.intentId)!;
      if (intent.contactId && input.checkpoint.contactId && intent.contactId !== input.checkpoint.contactId) throw new Error('Intent identity conflict.');
      if (input.checkpoint.contactId) {
        intent.contactId = input.checkpoint.contactId; intent.identityResolved = true;
      }
    }
    if (input.remoteId) operation.remoteId = input.remoteId;
    for (const followUp of input.followUps ?? []) await this.enqueueOperation(followUp);
    operation.reconcileRequired = false;
    operation.technicalState = 'SYNCED'; this.release(operation);
  }
  async holdOperation(input: PatrimonialMutation) {
    const operation = this.owned(input);
    operation.technicalState = operation.reconcileRequired ? 'RECONCILE_REQUIRED' : 'SYNC_PENDING';
    this.release(operation);
  }
  async failOperation(input: PatrimonialFailureMutation) {
    const operation = this.owned(input);
    operation.technicalState = input.state; operation.lastErrorCode = input.errorCode;
    if (input.state === 'RECONCILE_REQUIRED' || input.reconcileRequired) operation.reconcileRequired = true;
    this.release(operation);
  }
  async scheduleRetry(input: PatrimonialMutation & { nextAttemptAt: string; errorCode: PatrimonialOperationError }) {
    const operation = this.owned(input);
    if (operation.reconcileRequired) throw new Error('Cannot retry an uncertain operation blindly.');
    if (milliseconds(input.nextAttemptAt) <= milliseconds(input.now)) throw new Error('Retry must be in the future.');
    operation.lastErrorCode = input.errorCode;
    if (operation.attemptCount >= PATRIMONIAL_MAX_ATTEMPTS) operation.technicalState = 'MANUAL_REVIEW';
    else { operation.technicalState = 'RETRY_SCHEDULED'; operation.nextAttemptAt = input.nextAttemptAt; }
    this.release(operation);
  }
  async markManualReview(input: PatrimonialMutation & { errorCode: PatrimonialOperationError }) {
    return this.failOperation({ ...input, state: 'MANUAL_REVIEW' });
  }
}

// A single queue serializes snapshot/commit, including independently queued workers.
// No method leaks live references or a usable transaction after commit.
export class MemoryPatrimonialStoreForTests implements PatrimonialStore {
  readonly kind = 'test-memory' as const;
  private state = initialState();
  private queue: Promise<void> = Promise.resolve();
  private hooks: Hooks;
  constructor(hooks: Hooks = {}) { this.hooks = hooks; }
  inspectForTests() { return structuredClone(this.state); }
  async transaction<T>(work: (tx: PatrimonialTransaction) => Promise<T>): Promise<T> {
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>(resolve => { release = resolve; });
    await previous;
    const draft = structuredClone(this.state);
    const tx = new MemoryTransaction(draft);
    try {
      const result = structuredClone(await work(tx));
      this.hooks.beforeCommit?.();
      this.state = draft;
      this.hooks.afterCommit?.();
      return result;
    } finally { tx.close(); release(); }
  }
  createOrReplayRequest(input: PatrimonialRequest, now: string) { return this.transaction(tx => tx.createOrReplayRequest(input, now)); }
  getRequest(id: string) { return this.transaction(tx => tx.getRequest(id)); }
  getOperation(id: string) { return this.transaction(tx => tx.getOperation(id)); }
  getConsentEvidence(id: string) { return this.transaction(tx => tx.getConsentEvidence(id)); }
  createOrReuseIntent(input: PatrimonialIntent) { return this.transaction(tx => tx.createOrReuseIntent(input)); }
  attachIntent(requestId: string, intentId: string) { return this.transaction(tx => tx.attachIntent(requestId, intentId)); }
  appendConsentEvidence(input: PatrimonialConsentEvidence) { return this.transaction(tx => tx.appendConsentEvidence(input)); }
  appendEvent(input: PatrimonialEvent) { return this.transaction(tx => tx.appendEvent(input)); }
  enqueueOperation(input: PatrimonialOutboxOperation) { return this.transaction(tx => tx.enqueueOperation(input)); }
  claimOperations(input: PatrimonialClaimInput) { return this.transaction(tx => tx.claimOperations(input)); }
  renewLease(input: PatrimonialMutation & { leaseSeconds?: number }) { return this.transaction(tx => tx.renewLease(input)); }
  completeOperation(input: PatrimonialMutation) { return this.transaction(tx => tx.completeOperation(input)); }
  completeCrmOperation(input: PatrimonialCrmCompletion) { return this.transaction(tx => tx.completeCrmOperation(input)); }
  holdOperation(input: PatrimonialMutation) { return this.transaction(tx => tx.holdOperation(input)); }
  failOperation(input: PatrimonialFailureMutation) { return this.transaction(tx => tx.failOperation(input)); }
  scheduleRetry(input: PatrimonialMutation & { nextAttemptAt: string; errorCode: PatrimonialOperationError }) { return this.transaction(tx => tx.scheduleRetry(input)); }
  markManualReview(input: PatrimonialMutation & { errorCode: PatrimonialOperationError }) { return this.transaction(tx => tx.markManualReview(input)); }
}
