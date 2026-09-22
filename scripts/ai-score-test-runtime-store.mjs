#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { SupabaseProviderRuntimeStore } from '../src/lib/ai-score/runtime-store.ts';

const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. No provider calls were made.');
  process.exit(2);
}

process.env.AI_SCORE_RATE_LIMIT_HMAC_SECRET ||= `phase-6b1-local-${randomUUID()}`;

const runId = randomUUID().replace(/-/g, '').slice(0, 16);
const providerId = `phase6b1_test_${runId}`;
const mode = 'TEST_ONLY';
const at = new Date();
const date = at.toISOString().slice(0, 10);
const store = new SupabaseProviderRuntimeStore({ url: supabaseUrl, serviceRoleKey });
const touchedBuckets = new Set();
let cleanupStatus = 'not_started';

try {
  const first = await store.reserveBudget({
    providerId,
    mode,
    at,
    estimatedCostUsd: 0.07,
    estimatedRequests: 1,
    estimatedObservations: 1,
    providerDailyBudgetUsd: 0.10,
    globalDailyBudgetUsd: 0.10,
  });
  assert(first.allowed, 'first reservation should pass');

  const second = await store.reserveBudget({
    providerId,
    mode,
    at,
    estimatedCostUsd: 0.07,
    estimatedRequests: 1,
    estimatedObservations: 1,
    providerDailyBudgetUsd: 0.10,
    globalDailyBudgetUsd: 0.10,
  });
  assert(!second.allowed, 'second reservation should be denied by budget');

  const reconciliationLower = await store.reconcileBudget({
    providerId,
    mode,
    at,
    estimatedCostUsd: 0.07,
    actualCostUsd: 0.05,
    success: true,
    latencyMs: 10,
  });
  assert(reconciliationLower.success, 'lower actual reconciliation should record success');

  const third = await store.reserveBudget({
    providerId,
    mode,
    at,
    estimatedCostUsd: 0.04,
    estimatedRequests: 1,
    estimatedObservations: 1,
    providerDailyBudgetUsd: 0.10,
    globalDailyBudgetUsd: 0.10,
  });
  assert(third.allowed, 'reservation after lower reconciliation should pass');

  const reconciliationHigher = await store.reconcileBudget({
    providerId,
    mode,
    at,
    estimatedCostUsd: 0.04,
    actualCostUsd: 0.05,
    success: true,
    latencyMs: 12,
  });
  assert(reconciliationHigher.success, 'higher actual reconciliation should record success');

  const fourth = await store.reserveBudget({
    providerId,
    mode,
    at,
    estimatedCostUsd: 0.01,
    estimatedRequests: 1,
    estimatedObservations: 1,
    providerDailyBudgetUsd: 0.50,
    globalDailyBudgetUsd: 0.50,
  });
  assert(fourth.allowed, 'reservation for actual-unavailable case should pass');

  const reconciliationUnavailable = await store.reconcileBudget({
    providerId,
    mode,
    at,
    estimatedCostUsd: 0.01,
    actualCostUsd: null,
    success: false,
    latencyMs: 14,
  });
  assert(!reconciliationUnavailable.success, 'actual-unavailable failed request should retain a failed outcome');

  await store.recordProviderSuccess(providerId, at);
  await store.recordProviderFailure(providerId, { errorCode: 'provider_500', failureClass: 'PROVIDER', at });
  await store.recordProviderFailure(providerId, { errorCode: 'provider_500', failureClass: 'PROVIDER', at });
  const open = await store.recordProviderFailure(providerId, { errorCode: 'provider_500', failureClass: 'PROVIDER', at });
  assert(open.circuitState === 'OPEN', 'third provider failure should open circuit');
  const halfOpen = await store.tryHalfOpen(providerId, at);
  assert(halfOpen.circuitState === 'HALF_OPEN', 'half-open transition should persist');
  const closed = await store.recordProviderSuccess(providerId, at);
  assert(closed.circuitState === 'CLOSED' && closed.consecutiveFailures === 0, 'success should close circuit');

  const clientLimitResults = [];
  for (let index = 0; index < 4; index += 1) {
    const result = await store.checkRateLimit({
      scope: 'client',
      rawIdentifier: `127.0.0.1:${runId}`,
      at,
      limit: 3,
      windowSeconds: 60,
    });
    touchedBuckets.add(result.bucketKey);
    clientLimitResults.push(result.allowed);
  }
  assert(clientLimitResults.join(',') === 'true,true,true,false', 'client rate limit should allow under/at limit and deny over limit');

  const domainLimitResults = [];
  for (let index = 0; index < 3; index += 1) {
    const result = await store.checkRateLimit({
      scope: 'domain',
      rawIdentifier: `example-${runId}.com`,
      at,
      limit: 2,
      windowSeconds: 60,
    });
    touchedBuckets.add(result.bucketKey);
    domainLimitResults.push(result.allowed);
  }
  assert(domainLimitResults.join(',') === 'true,true,false', 'domain rate limit should deny over limit');

  const nextWindow = await store.checkRateLimit({
    scope: 'client',
    rawIdentifier: `127.0.0.1:${runId}`,
    at: new Date(at.getTime() + 65_000),
    limit: 3,
    windowSeconds: 60,
  });
  touchedBuckets.add(nextWindow.bucketKey);
  assert(nextWindow.allowed, 'new rate-limit window should allow request');
  assert([...touchedBuckets].every((bucket) => !bucket.includes('127.0.0.1') && !bucket.includes('example-')), 'rate limit buckets must not contain raw identifiers');

  cleanupStatus = await cleanupTestData({ providerId, mode, date, bucketKeys: [...touchedBuckets] });

  console.log(JSON.stringify({
    ok: true,
    providerId,
    runtimeStore: { kind: store.kind, persistent: store.persistent },
    tests: {
      usageRead: true,
      atomicReservation: { firstAllowed: first.allowed, secondAllowed: second.allowed, secondReason: second.reason },
      globalBudget: second.globalBudgetUsd === 0.10,
      providerBudget: second.dailyBudgetUsd === 0.10,
      reconciliation: { lowerActual: true, higherActual: true, actualUnavailable: true, failedRequestRetainedCost: true },
      circuit: ['CLOSED', 'OPEN', 'HALF_OPEN', 'CLOSED'],
      rateLimit: { client: clientLimitResults, domain: domainLimitResults, newWindow: nextWindow.allowed },
      hmac: { rawIdentifiersStored: false },
    },
    cleanupStatus,
    providerCalls: 0,
  }, null, 2));
} catch (error) {
  cleanupStatus = await cleanupTestData({ providerId, mode, date, bucketKeys: [...touchedBuckets] }).catch(() => 'failed');
  console.error(JSON.stringify({
    ok: false,
    providerId,
    cleanupStatus,
    error: error instanceof Error ? error.message : String(error),
    providerCalls: 0,
  }, null, 2));
  process.exit(1);
}

async function cleanupTestData({ providerId, mode: runtimeMode, date: budgetDate, bucketKeys }) {
  const results = [];
  results.push(await deleteRows('provider_daily_usage', `budget_date=eq.${encodeURIComponent(budgetDate)}&mode=eq.${encodeURIComponent(runtimeMode)}&provider_id=in.(${encodeURIComponent(providerId)},__global__)`));
  results.push(await deleteRows('provider_runtime_state', `provider_id=eq.${encodeURIComponent(providerId)}`));
  for (const bucketKey of bucketKeys) {
    results.push(await deleteRows('ai_score_rate_limit', `bucket_key=eq.${encodeURIComponent(bucketKey)}`));
  }
  return results.every(Boolean) ? 'completed' : 'partial';
}

async function deleteRows(table, filter) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      prefer: 'return=minimal',
    },
  });
  return response.ok;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
