import { createHash } from 'node:crypto';
import { callHighLevel, highLevelConfig } from '../radar/highlevel.ts';
import type { Annunci10xPersistenceAdapter } from './persistence/types.ts';
import type { Annunci10xSessionCookie } from './product-flow.ts';

export type AnnunciCrmStatus = 'SYNCED' | 'NOT_CONFIGURED' | 'PENDING' | 'PARTIAL' | 'UNCERTAIN' | 'FAILED';
type Receipt = { version: number; stage: 'CONTACT' | 'TAGS' | 'DONE' | 'INITIAL'; contactId?: string; noteUncertain: boolean; status: AnnunciCrmStatus };
type Input = { session: Annunci10xSessionCookie; persistence: Annunci10xPersistenceAdapter; env?: Record<string, string | undefined>; fetchImpl?: typeof fetch };
const pending = new Map<string, Promise<{ status: AnnunciCrmStatus }>>();
const eventName = 'annunci10x_crm_sync';
class ProviderHttpError extends Error {
  readonly status: number;
  constructor(status: number) { super('CRM request rejected'); this.status = status; }
}
class NotSentError extends Error {}

/** CRM receipt is independent from verification, results, payments and entitlements. */
export async function syncAnnunci10xLead(input: Input): Promise<{ status: AnnunciCrmStatus }> {
  const config = highLevelConfig(input.env ?? process.env);
  if (!config) return { status: 'NOT_CONFIGURED' };
  try {
    const owner = await input.persistence.getSession(input.session.sessionId, input.session.sessionSecret);
    const lead = await input.persistence.getLead(input.session.sessionId, input.session.sessionSecret);
    if (!owner || !lead || !['ANALYZE', 'CREATE'].includes(owner.flow)) return { status: 'FAILED' };
    const syncKey = createHash('sha256').update(JSON.stringify([lead.id, lead.firstName, lead.lastName, lead.emailNormalized, lead.companyName, lead.businessRole, lead.marketingConsent, lead.marketingConsentVersion, lead.emailVerifiedAt ?? null])).digest('hex');
    const key = `${input.session.sessionId}:${syncKey}`;
    const running = pending.get(key);
    if (running) return running;
    const work = (async () => {
      let receipt: Receipt = { version: 0, stage: 'INITIAL', noteUncertain: false, status: 'PENDING' };
      const refresh = async () => {
        let latest = receipt;
        const events = await input.persistence.getEvents(input.session.sessionId, input.session.sessionSecret, eventName, syncKey);
        for (const event of events) if (typeof event.metadata.version === 'number' && event.metadata.version > latest.version) latest = event.metadata as unknown as Receipt;
        return latest;
      };
      receipt = await refresh();
      if (receipt.status === 'SYNCED') return { status: 'SYNCED' as const };
      if (receipt.noteUncertain) return { status: 'UNCERTAIN' as const };
      // Existing atomic database rate limiter supplies a cross-worker lease; no new table/RPC.
      const lease = await input.persistence.checkRateLimit({ scope: 'annunci10x_crm_sync', subject: key, limit: 1, windowSeconds: 60 });
      if (!lease.allowed) return { status: 'PENDING' as const };
      const leaseExpiry = Date.parse(lease.resetAt);
      if (!Number.isFinite(leaseExpiry) || leaseExpiry <= Date.now() + 5000) return { status: 'PENDING' as const };
      const deadline = Math.min(Date.now() + 25000, leaseExpiry - 5000);
      // Re-read after acquiring the lease: another worker may have completed
      // while this worker was waiting on a stale read or database connection.
      receipt = await refresh();
      if (receipt.status === 'SYNCED') return { status: 'SYNCED' as const };
      if (receipt.noteUncertain) return { status: 'UNCERTAIN' as const };
      const record = async (patch: Partial<Receipt>) => {
        if (Date.now() >= deadline) throw new NotSentError('CRM deadline exceeded');
        const next = { ...receipt, ...patch, version: receipt.version + 1 };
        await input.persistence.appendEvent({ sessionId: input.session.sessionId, eventName, metadata: { ...next, syncKey } });
        receipt = next;
      };
      const fetchImpl: typeof fetch = async (url, init) => {
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new NotSentError('CRM deadline exceeded');
        const response = await (input.fetchImpl ?? fetch)(url, { ...init, signal: AbortSignal.timeout(Math.min(5000, remaining)) });
        if (!response.ok) throw new ProviderHttpError(response.status);
        return response;
      };
      const crm = { ...config, fetchImpl };
      try {
        if (!receipt.contactId) {
          const result = await callHighLevel<{ contact?: { id?: string } }>(crm, '/contacts/upsert', {
            locationId: config.locationId, firstName: lead.firstName, lastName: lead.lastName, email: lead.emailNormalized,
            ...(lead.companyName ? { companyName: lead.companyName } : {}),
          });
          if (!result.contact?.id) throw new Error('CRM contact acknowledgement missing');
          await record({ contactId: result.contact.id, stage: 'CONTACT', status: 'PARTIAL' });
        }
        if (receipt.stage === 'CONTACT') {
          await callHighLevel(crm, `/contacts/${encodeURIComponent(receipt.contactId!)}/tags`, { tags: ['horyzon-annunci-10x', `annunci10x-${owner.flow.toLowerCase()}`] });
          await record({ stage: 'TAGS' });
        }
        // Persist uncertainty before the non-idempotent POST. A timeout or lost
        // receipt must not cause an automatic second note on the same submission.
        await record({ noteUncertain: true });
        const note = await callHighLevel<{ note?: { id?: string } }>(crm, `/contacts/${encodeURIComponent(receipt.contactId!)}/notes`, { body: [
          `Annunci 10x · richiesta ${owner.flow === 'ANALYZE' ? 'analisi annuncio' : 'creazione annuncio'}`,
          'Provenienza: horyzon.it/annunci-10x', `Ricevuta: ${lead.createdAt}`,
          `Ruolo dichiarato: ${lead.businessRole ?? 'non indicato'}`,
          `Email verificata al momento della sincronizzazione: ${lead.emailVerifiedAt ? 'sì' : 'no'}`,
          `Consenso marketing: ${lead.marketingConsent ? 'espresso' : 'non espresso'}`,
          `Versione consenso: ${lead.marketingConsentVersion ?? 'non disponibile'}`,
          ...(lead.marketingConsentAt ? [`Data consenso: ${lead.marketingConsentAt}`] : []),
          'Richiesta del risultato; nessuna campagna o iscrizione attivata da questo collegamento.',
        ].join('\n') });
        if (!note.note?.id) throw new Error('CRM note acknowledgement missing');
        await record({ stage: 'DONE', status: 'SYNCED', noteUncertain: false });
        return { status: 'SYNCED' as const };
      } catch (error) {
        // A server error/408 may follow a committed note; only a definite
        // client rejection or a locally unsent request permits another POST.
        const definiteRejection=error instanceof ProviderHttpError && error.status>=400 && error.status<500 && error.status!==408;
        const uncertain = receipt.noteUncertain && !definiteRejection && !(error instanceof NotSentError);
        const status: AnnunciCrmStatus = uncertain ? 'UNCERTAIN' : receipt.contactId ? 'PARTIAL' : 'FAILED';
        await record({ status, noteUncertain: uncertain }).catch(() => undefined);
        return { status };
      }
    })();
    pending.set(key, work);
    try { return await work; } finally { pending.delete(key); }
  } catch {
    // Never log provider bodies, keys, contact details or ownership secrets.
    return { status: 'FAILED' };
  }
}
