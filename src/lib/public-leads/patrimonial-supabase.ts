import { randomUUID } from 'node:crypto';
import type { PatrimonialConsentEvidence, PatrimonialEvent, PatrimonialIntent, PatrimonialOutboxOperation, PatrimonialRequest } from './patrimonial-contract.ts';
import type { PatrimonialOpportunityIntent, PatrimonialRoutingParticipation } from './patrimonial-routing.ts';
import type { AssignmentContext, AssignmentPlan } from './patrimonial-assignments.ts';
import {
  PatrimonialConflictError, PatrimonialReplayExpiredError, PatrimonialStaleLeaseError, PatrimonialStoreUnavailableError,
  type PatrimonialStore, type PatrimonialTransaction, type PatrimonialOpportunityStore, type PatrimonialOpportunityTransaction,
  type PatrimonialClaimInput, type PatrimonialCrmCompletion, type PatrimonialFailureMutation, type PatrimonialMutation,
  type PatrimonialOperationError, type PatrimonialOpportunitySyncState,
  type PatrimonialAssignmentStore, type PatrimonialAssignmentTransaction,
} from './patrimonial-store.ts';

export const PATRIMONIAL_STORE_VERSION = 'patrimonial-v2-store-1';
type Config = { url: string; serviceRoleKey: string; fetchImpl?: typeof fetch };
type Command = { method: string; args: unknown[]; tokens?: string[] };
type Expected = Record<string, unknown>;
class SnapshotChanged extends Error {}
const unavailable = () => new PatrimonialStoreUnavailableError('Patrimonial durable store unavailable.');

// A preview runs the journal in a PostgreSQL subtransaction that ALWAYS rolls back.
// The final RPC executes it once, checks previously returned values, and commits
// atomically. Callbacks must contain only store/domain work: a serialization retry
// can rerun them. No transaction/lock survives an RPC or covers a provider fetch.
class RpcTransaction implements PatrimonialTransaction, PatrimonialOpportunityTransaction, PatrimonialAssignmentTransaction {
  readonly commands: Command[] = [];
  readonly expected: Expected = {};
  private active = true;
  private readonly run: (commands: Command[], expected: Expected, preview: boolean) => Promise<unknown[]>;
  constructor(run: (commands: Command[], expected: Expected, preview: boolean) => Promise<unknown[]>) { this.run = run; }
  close() { this.active = false; }
  private add(method: string, args: unknown[], tokenCount = 0) {
    if (!this.active || this.commands.length >= 128) throw unavailable();
    const index = this.commands.length;
    this.commands.push(structuredClone({ method, args, ...(tokenCount ? { tokens: Array.from({ length: tokenCount }, () => randomUUID()) } : {}) }));
    return index;
  }
  private async value<T>(method: string, args: unknown[], tokenCount = 0): Promise<T> {
    const index = this.add(method, args, tokenCount);
    const results = await this.run(this.commands, this.expected, true);
    if (results.length !== this.commands.length || results[index] === undefined) throw unavailable();
    this.expected[index] = structuredClone(results[index]);
    return structuredClone(results[index]) as T;
  }
  private async mutation(method: string, args: unknown[]) { this.add(method, args); }
  getAssignmentContext(commandKey: string, intentIds: string[], experimentId: string | null) { return this.value<AssignmentContext>('getAssignmentContext', [commandKey, intentIds, experimentId]); }
  commitAssignmentPlan(plan: AssignmentPlan, expectedRevision: number) { return this.mutation('commitAssignmentPlan', [plan, expectedRevision]); }
  createOrReplayRequest(input: PatrimonialRequest, now: string) { return this.value<{ request: PatrimonialRequest; replay: boolean }>('createOrReplayRequest', [input, now]); }
  getRequest(id: string) { return this.value<PatrimonialRequest | null>('getRequest', [id]); }
  getOperation(id: string) { return this.value<PatrimonialOutboxOperation | null>('getOperation', [id]); }
  getConsentEvidence(id: string) { return this.value<PatrimonialConsentEvidence[]>('getConsentEvidence', [id]); }
  createOrReuseIntent(input: PatrimonialIntent) { return this.value<PatrimonialIntent>('createOrReuseIntent', [input]); }
  attachIntent(requestId: string, intentId: string) { return this.mutation('attachIntent', [requestId, intentId]); }
  appendConsentEvidence(input: PatrimonialConsentEvidence) { return this.mutation('appendConsentEvidence', [input]); }
  appendEvent(input: PatrimonialEvent) { return this.mutation('appendEvent', [input]); }
  enqueueOperation(input: PatrimonialOutboxOperation) { return this.mutation('enqueueOperation', [input]); }
  claimOperations(input: PatrimonialClaimInput) {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) throw unavailable();
    return this.value<PatrimonialOutboxOperation[]>('claimOperations', [input], input.limit);
  }
  renewLease(input: PatrimonialMutation & { leaseSeconds?: number }) { return this.mutation('renewLease', [input]); }
  completeOperation(input: PatrimonialMutation) { return this.mutation('completeOperation', [input]); }
  completeCrmOperation(input: PatrimonialCrmCompletion) { return this.mutation('completeCrmOperation', [input]); }
  holdOperation(input: PatrimonialMutation) { return this.mutation('holdOperation', [input]); }
  failOperation(input: PatrimonialFailureMutation) { return this.mutation('failOperation', [input]); }
  scheduleRetry(input: PatrimonialMutation & { nextAttemptAt: string; errorCode: PatrimonialOperationError }) { return this.mutation('scheduleRetry', [input]); }
  markManualReview(input: PatrimonialMutation & { errorCode: PatrimonialOperationError }) { return this.mutation('markManualReview', [input]); }
  findOpportunityIntent(key: string) { return this.value<PatrimonialOpportunityIntent | null>('findOpportunityIntent', [key]); }
  getOpportunityIntent(id: string) { return this.value<PatrimonialOpportunityIntent | null>('getOpportunityIntent', [id]); }
  saveOpportunityIntent(intent: PatrimonialOpportunityIntent, revision: number | null) { return this.mutation('saveOpportunityIntent', [intent, revision]); }
  listParticipations(id: string) { return this.value<PatrimonialRoutingParticipation[]>('listParticipations', [id]); }
  saveParticipations(id: string, next: PatrimonialRoutingParticipation[], previous: PatrimonialRoutingParticipation[]) { return this.mutation('saveParticipations', [id, next, previous]); }
  claimOpportunitySync(id: string, revision: number, now: string) { return this.value<{ intent: PatrimonialOpportunityIntent; token: string; reconcileRequired: boolean } | null>('claimOpportunitySync', [id, revision, now], 1); }
  authorizeOpportunityWrite(id: string, revision: number, token: string, now: string) { return this.mutation('authorizeOpportunityWrite', [id, revision, token, now]); }
  finishOpportunitySync(id: string, revision: number, token: string, now: string, state: PatrimonialOpportunitySyncState, remote?: NonNullable<PatrimonialOpportunityIntent['remote']>) { return this.mutation('finishOpportunitySync', [id, revision, token, now, state, remote ?? null]); }
}

export class SupabasePatrimonialStore implements PatrimonialStore, PatrimonialOpportunityStore, PatrimonialAssignmentStore {
  readonly kind = 'durable' as const;
  private readonly url: string;
  private readonly key: string;
  private readonly fetchImpl: typeof fetch;
  constructor(config: Config) {
    if (typeof window !== 'undefined') throw unavailable();
    let url: URL;
    try { url = new URL(config.url); } catch { throw unavailable(); }
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) || url.username || url.password || url.search || url.hash || url.pathname !== '/' || !config.serviceRoleKey?.trim() || /^sb_publishable_/i.test(config.serviceRoleKey)) throw unavailable();
    this.url = url.origin; this.key = config.serviceRoleKey.trim(); this.fetchImpl = config.fetchImpl ?? fetch;
  }
  private async rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.url}/rest/v1/rpc/${name}`, {
        method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000),
        headers: { apikey: this.key, ...(!this.key.startsWith('sb_') ? { Authorization: `Bearer ${this.key}` } : {}), 'Content-Type': 'application/json', 'Accept-Profile': 'public', 'Content-Profile': 'public' },
        body: JSON.stringify(body),
      });
    } catch { throw unavailable(); } // Never retry an ambiguous commit internally.
    if (!response.ok) {
      let error: { code?: string; message?: string } = {};
      try { error = await response.json(); } catch { /* No provider body is exposed. */ }
      if (response.status === 409 && error?.code === 'PT409') {
        if (error.message === 'PATRIMONIAL_SNAPSHOT_CHANGED') throw new SnapshotChanged();
        if (error.message === 'PATRIMONIAL_CONFLICT') throw new PatrimonialConflictError();
        if (error.message === 'PATRIMONIAL_STALE_LEASE') throw new PatrimonialStaleLeaseError();
      }
      if (response.status === 410 && error?.code === 'PT410' && error.message === 'PATRIMONIAL_REPLAY_EXPIRED') throw new PatrimonialReplayExpiredError();
      throw unavailable();
    }
    try { return await response.json() as T; } catch { throw unavailable(); }
  }
  async health(): Promise<void> {
    const value = await this.rpc<{ version?: string }>('patrimonial_store_health', {});
    if (value?.version !== PATRIMONIAL_STORE_VERSION) throw unavailable();
  }
  async transaction<T>(work: (tx: PatrimonialTransaction & PatrimonialOpportunityTransaction & PatrimonialAssignmentTransaction) => Promise<T>): Promise<T> {
    await this.health();
    for (let attempt = 0; attempt < 4; attempt++) {
      const run = async (commands: Command[], expected: Expected, preview: boolean) => {
        const name = !preview && commands.some(command => command.method === 'createOrReplayRequest') ? 'acquire_patrimonial_request_v2' : 'patrimonial_store_transaction';
        const results = await this.rpc<unknown[]>(name, { p_commands: commands, p_expected: expected, ...(name === 'patrimonial_store_transaction' ? { p_preview: preview } : {}) });
        if (!Array.isArray(results)) throw unavailable();
        return results;
      };
      const tx = new RpcTransaction(run);
      try {
        const result = structuredClone(await work(tx));
        if (tx.commands.length) await run(tx.commands, tx.expected, false);
        return result;
      } catch (error) {
        if (!(error instanceof SnapshotChanged)) throw error;
        if (attempt === 3) throw unavailable();
      } finally { tx.close(); }
    }
    throw unavailable();
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
