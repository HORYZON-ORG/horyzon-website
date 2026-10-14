import type { PatrimonialOutboxOperation } from './patrimonial-contract.ts';
import type { PatrimonialOperationError, PatrimonialStore } from './patrimonial-store.ts';

// Pure scheduling only: no worker route, scheduler or provider transport exists.
export const PATRIMONIAL_LEASE_SECONDS = 60;
export const PATRIMONIAL_MAX_ATTEMPTS = 5;
const backoffMinutes = [1, 5, 30, 120] as const;
export type PatrimonialFailure = {
  kind: 'network' | 'http' | 'unknown'; status?: number;
  // A create may have committed remotely even when no response arrived.
  outcomeUncertain?: boolean; retryAfterSeconds?: number;
};

export function patrimonialRetryDecision(attemptCount: number, failure: PatrimonialFailure, now: string, jitter = Math.random()) {
  const errorCode: PatrimonialOperationError = failure.kind === 'network' ? 'NETWORK'
    : failure.status === 429 ? 'RATE_LIMIT' : failure.status === 400 ? 'SCHEMA'
      : failure.status === 401 || failure.status === 403 ? 'AUTH' : failure.status === 404 ? 'CONFIG'
        : failure.status !== undefined && failure.status >= 500 && failure.status <= 599 ? 'PROVIDER' : 'UNKNOWN';
  if (attemptCount >= PATRIMONIAL_MAX_ATTEMPTS) return { state: 'MANUAL_REVIEW' as const, errorCode };
  if (failure.outcomeUncertain) return { state: 'RECONCILE_REQUIRED' as const, errorCode };
  if (!['NETWORK', 'RATE_LIMIT', 'PROVIDER'].includes(errorCode)) return { state: 'MANUAL_REVIEW' as const, errorCode };
  if (!Number.isInteger(attemptCount) || attemptCount < 1) throw new Error('Invalid attempt count.');
  const delay = backoffMinutes[attemptCount - 1] * 60_000;
  const retryAfter = Number.isFinite(failure.retryAfterSeconds) ? Math.max(0, failure.retryAfterSeconds!) * 1000 : 0;
  const boundedJitter = Number.isFinite(jitter) ? Math.max(0, Math.min(1, jitter)) : 0;
  const nextAttemptAt = new Date(Date.parse(now) + Math.max(delay + Math.floor(delay * .1 * boundedJitter), retryAfter)).toISOString();
  return { state: 'RETRY_SCHEDULED' as const, errorCode, nextAttemptAt };
}

export async function recordPatrimonialFailure(store: PatrimonialStore, operation: PatrimonialOutboxOperation, failure: PatrimonialFailure, now: string, jitter?: number) {
  if (!operation.leaseToken) throw new Error('Missing claim token.');
  const claim = { operationId: operation.id, leaseToken: operation.leaseToken, leaseVersion: operation.leaseVersion, now };
  const decision = patrimonialRetryDecision(operation.attemptCount, failure, now, jitter);
  if (decision.state === 'RETRY_SCHEDULED') await store.scheduleRetry({ ...claim, nextAttemptAt: decision.nextAttemptAt, errorCode: decision.errorCode });
  else await store.failOperation({ ...claim, state: decision.state, errorCode: decision.errorCode, reconcileRequired: operation.reconcileRequired || failure.outcomeUncertain === true });
  return decision;
}
