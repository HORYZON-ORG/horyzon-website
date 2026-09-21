import type { AuditRepository, InternalAuditResult } from './types';

/**
 * Persistence is intentionally abstracted: the current website repo does not
 * expose a database, durable KV store, or sanctioned backend connection.
 * Production can replace this adapter without changing the audit engine.
 */
export class NoopAuditRepository implements AuditRepository {
  async findRecent(_cacheKey: string): Promise<InternalAuditResult | null> {
    return null;
  }

  async save(_cacheKey: string, _audit: InternalAuditResult): Promise<void> {
    return;
  }
}

export const auditRepository: AuditRepository = new NoopAuditRepository();
