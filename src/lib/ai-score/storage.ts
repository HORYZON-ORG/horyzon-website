import type { AuditRepository, InternalAuditResult } from './types';

/**
 * Persistence is intentionally abstracted: the current website repo does not
 * expose a database, durable KV store, or sanctioned backend connection.
 * Production can replace this adapter without changing the audit engine.
 */
export class NoopAuditRepository implements AuditRepository {
  async findRecent(): Promise<InternalAuditResult | null> {
    return null;
  }

  async save(): Promise<void> {
    return;
  }
}

export const auditRepository = new NoopAuditRepository();
