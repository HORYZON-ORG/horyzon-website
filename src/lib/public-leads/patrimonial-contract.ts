import type { PilotMode, PilotUtm } from '../../content/patrimonial-funnels.ts';
import type { PilotLead } from './patrimonial-funnels.ts';

// Browser-safe contract. No credentials, environment access or provider transport.
export const PATRIMONIAL_V2 = 'patrimonial-lead-v2' as const;
export const patrimonialTechnicalStates = ['RECEIVED', 'IDENTITY_REVIEW', 'SYNC_PENDING', 'SYNCING', 'RETRY_SCHEDULED', 'RECONCILE_REQUIRED', 'SYNCED', 'MANUAL_REVIEW', 'REJECTED'] as const;
export type PatrimonialTechnicalState = typeof patrimonialTechnicalStates[number];
export type PatrimonialV2Lead = PilotLead & { contractVersion: typeof PATRIMONIAL_V2; sourcePath: string; eventEditionId: string | null; referralCode?: string };
export type PatrimonialReceipt = { ok: true; requestId: string; receiptStatus: 'received'; crmStatus: 'pending' };
export type PatrimonialRequest = {
  id: string; contractVersion: typeof PATRIMONIAL_V2; payloadHash: string; payload: PatrimonialV2Lead;
  receivedAt: string; replayExpiresAt: string; intentId: string | null;
  technicalState: PatrimonialTechnicalState; receipt: PatrimonialReceipt;
  crm?: PatrimonialCrmCheckpoint;
};
export type PatrimonialCrmCheckpoint = {
  locationId: string; resolution: 'NEW' | 'REUSE'; contactId: string | null; noteId: string | null;
};
export type PatrimonialIntent = {
  id: string; provisionalKey: string; mode: PilotMode; requestedEditionId: string | null;
  // An email match is only a provisional grouping, never verified CRM identity.
  contactId: string | null; opportunityId: string | null; identityResolved: boolean;
  technicalState: PatrimonialTechnicalState; createdAt: string;
};
export type PatrimonialConsentEvidence = {
  id: string; requestId: string; purpose: 'requested-contact' | 'marketing';
  choice: boolean; version: string; policyPath: '/privacy-policy'; sourcePath: string;
  channel: 'form'; receivedAt: string; mode: PilotMode;
};
export type PatrimonialOutboxOperation = {
  id: string; operationKey: string; requestId: string; intentId: string;
  kind: 'SYNC_REQUEST' | 'RESOLVE_CONTACT' | 'UPSERT_CONTACT' | 'ADD_TAGS' | 'ADD_NOTE';
  technicalState: PatrimonialTechnicalState; createdAt: string; nextAttemptAt: string;
  attemptCount: number; leaseToken: string | null; leaseVersion: number; leaseExpiresAt: string | null;
  reconcileRequired: boolean; lastErrorCode: string | null;
  dependsOn?: string; remoteId?: string;
  identityLockKey?: string;
};
export type PatrimonialEvent = {
  id: string; name: 'request_received'; requestId: string; intentId: string;
  occurredAt: string; contractVersion: typeof PATRIMONIAL_V2;
};
export type PatrimonialEdition = {
  id: string; eventSlug: string; title: string; revision: number; startsAt: string; endsAt: string;
  timeZone: string; status: 'DRAFT' | 'ACTIVE' | 'CANCELLED' | 'COMPLETED';
};
export type PatrimonialParticipation = {
  id: string; contactId: string; editionId: string; requestIds: string[];
  status: 'REQUESTED' | 'PENDING_EDITION' | 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'CANCELLED' | 'DECLINED';
  attendance: 'UNKNOWN' | 'ATTENDED' | 'NO_SHOW' | 'CANCELLED' | 'NOT_APPLICABLE';
};

export function isPatrimonialRequestId(value: unknown): value is string {
  // Client uses crypto.randomUUID (v4); reject nil and non-RFC variant UUIDs.
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// Fixed field order, optional text represented by '', edition by null, UTM sorted.
// requestId, client timestamp and runtime fields deliberately do not participate.
export function canonicalPatrimonialPayload(lead: PatrimonialV2Lead): string {
  const utm: PilotUtm = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const) {
    if (lead.utm[key]) utm[key] = lead.utm[key];
  }
  return JSON.stringify({
    contractVersion: PATRIMONIAL_V2, mode: lead.mode, sourcePath: lead.sourcePath,
    firstName: lead.firstName, lastName: lead.lastName, email: lead.email, phone: lead.phone,
    province: lead.province, profile: lead.profile, message: lead.message,
    ...(lead.mode === 'architect-path' ? { experience: lead.experience, goal: lead.goal, availability: lead.availability } : {}),
    consent: lead.consent, marketingConsent: lead.marketingConsent, utm, eventEditionId: lead.eventEditionId,
    ...(lead.mode === 'patrimonial-event' && lead.referralCode !== undefined ? { referralCode: lead.referralCode } : {}),
  });
}

export class PatrimonialRevisionRequiredError extends Error {
  constructor() { super('A changed submission requires an explicit new attempt.'); }
}
type OpaqueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

// Only an opaque UUID is persisted; payload comparison lives in this instance.
// After reload the stored UUID is retried; the server rejects changed data (409).
export class PatrimonialClientAttempt {
  private requestId: string | null = null;
  private snapshot: string | null = null;
  private readonly key: string;
  private readonly storage?: OpaqueStorage;
  private readonly uuid: () => string;

  constructor(mode: PilotMode, storage?: OpaqueStorage, uuid: () => string = () => crypto.randomUUID()) {
    this.key = `horyzon:patrimonial:${mode}:v2-request`;
    this.storage = storage;
    this.uuid = uuid;
    try {
      const stored = storage?.getItem(this.key);
      if (isPatrimonialRequestId(stored)) this.requestId = stored.toLowerCase();
    } catch { /* Storage is optional; the in-memory attempt still works. */ }
  }

  prepare(payload: unknown): string {
    const snapshot = JSON.stringify(payload);
    if (this.snapshot !== null && snapshot !== this.snapshot) throw new PatrimonialRevisionRequiredError();
    if (!this.requestId) this.requestId = this.uuid().toLowerCase();
    if (!isPatrimonialRequestId(this.requestId)) throw new Error('Secure request identifier unavailable.');
    this.snapshot = snapshot;
    try { this.storage?.setItem(this.key, this.requestId); } catch { /* Keep same ID in memory. */ }
    return this.requestId;
  }

  beginNewAttempt(): void {
    this.requestId = null;
    this.snapshot = null;
    try { this.storage?.removeItem(this.key); } catch { /* Optional storage. */ }
  }

  acceptReceipt(status: number, value: unknown): value is PatrimonialReceipt {
    if (status !== 202 || !value || typeof value !== 'object') return false;
    const receipt = value as Partial<PatrimonialReceipt>;
    if (receipt.ok !== true || receipt.requestId !== this.requestId || receipt.receiptStatus !== 'received' || receipt.crmStatus !== 'pending') return false;
    try {
      if (this.storage?.getItem(this.key) === this.requestId) this.storage.removeItem(this.key);
    } catch { /* Receipt remains valid without storage. */ }
    return true;
  }
}
