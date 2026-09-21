import { createHash } from 'node:crypto';
import type { InternalAuditResult } from './types';

export const AI_SCORE_LIMITS = {
  maxPages: 6,
  maxConcurrency: 2,
  maxRedirects: 4,
  timeoutMs: 8_000,
  maxBytesPerPage: 750_000,
  perIpWindowMs: 10 * 60 * 1000,
  perIpMaxRequests: 6,
  globalConcurrentAudits: 3,
  duplicateCacheTtlMs: 30 * 60 * 1000,
};

type Bucket = { resetAt: number; count: number };
type CacheEntry = { expiresAt: number; audit: InternalAuditResult };

const buckets = new Map<string, Bucket>();
const duplicateCache = new Map<string, CacheEntry>();
let activeAudits = 0;

export function auditCacheKey(url: string): string {
  return createHash('sha256').update(url.trim().toLowerCase()).digest('hex');
}

export function checkRateLimit(key: string, now = Date.now()): { allowed: true } | { allowed: false; retryAfter: number; reason: string } {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { resetAt: now + AI_SCORE_LIMITS.perIpWindowMs, count: 1 });
    return { allowed: true };
  }

  if (bucket.count >= AI_SCORE_LIMITS.perIpMaxRequests) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      reason: 'Troppe analisi avviate da questo indirizzo. Riprova tra qualche minuto.',
    };
  }

  bucket.count += 1;
  return { allowed: true };
}

export async function withAuditSlot<T>(run: () => Promise<T>): Promise<T> {
  if (activeAudits >= AI_SCORE_LIMITS.globalConcurrentAudits) {
    throw new Error('Il servizio è momentaneamente occupato. Riprova tra poco.');
  }

  activeAudits += 1;
  try {
    return await run();
  } finally {
    activeAudits = Math.max(0, activeAudits - 1);
  }
}

export function readDuplicateCache(cacheKey: string, now = Date.now()): InternalAuditResult | null {
  const entry = duplicateCache.get(cacheKey);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    duplicateCache.delete(cacheKey);
    return null;
  }
  return entry.audit;
}

export function writeDuplicateCache(cacheKey: string, audit: InternalAuditResult, now = Date.now()): void {
  duplicateCache.set(cacheKey, {
    audit,
    expiresAt: now + AI_SCORE_LIMITS.duplicateCacheTtlMs,
  });
}
