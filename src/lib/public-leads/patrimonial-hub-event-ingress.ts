import { createHash } from 'node:crypto';
import { PATRIMONIAL_PILOT_PRIVACY_VERSION } from '../../content/patrimonial-funnels.ts';
import type { PilotLead } from './patrimonial-funnels.ts';

type EventLead = Extract<PilotLead, { mode: 'patrimonial-event' }>;
type HubIngressResponse = { contactId?: unknown; registrationId?: unknown; state?: unknown };
const uuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const remoteId = (v: string) => /^[a-zA-Z0-9_-]{1,128}$/.test(v);

/**
 * A disabled-by-default post-CRM bridge. The Hub UUID belongs to Supabase;
 * the HighLevel Contact ID is an external reference, never the person PK.
 *
 * Only for legacy/pilot EVENT submissions after successful HighLevel upsert.
 * No live migration or public activation is implied by including this module.
 */
export async function recordEventLeadInHub(input: {
  lead: EventLead;
  highlevelContactId: string;
  highlevelLocationId: string;
  source: string;
  env: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}): Promise<'DISABLED' | 'RECORDED'> {
  const { lead, highlevelContactId, highlevelLocationId, env } = input;
  if (env.HORYZON_HUB_EVENT_INGRESS_ENABLED !== 'true') return 'DISABLED';
  const base = (env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key || !remoteId(highlevelContactId) || !remoteId(highlevelLocationId))
    throw new Error('HUB_INGRESS_CONFIG');
  let endpoint: URL;
  try {
    endpoint = new URL('/rest/v1/rpc/architetti_event_ingest', base);
    if (endpoint.protocol !== 'https:' || !endpoint.hostname.endsWith('.supabase.co') ||
      endpoint.username || endpoint.password || endpoint.port) throw new Error('Invalid Hub endpoint');
  } catch { throw new Error('HUB_INGRESS_CONFIG'); }

  // In V2 this key will be the accepted request UUID. Pilot 2A has none:
  // canonicalized content creates a stable retry key, without storing PII in it.
  const fingerprint = createHash('sha256').update(JSON.stringify({
    mode: lead.mode, firstName: lead.firstName, lastName: lead.lastName,
    email: lead.email, phone: lead.phone, province: lead.province,
    profile: lead.profile, message: lead.message, marketingConsent: lead.marketingConsent,
    qualification: lead.qualification ?? null,
    utm: Object.fromEntries(Object.entries(lead.utm).sort(([a],[b]) => a.localeCompare(b))),
  })).digest('hex');
  const eventId = `webinar:${fingerprint.slice(0,56)}`;
  const payload = {
    eventId, locationId: highlevelLocationId, externalContactId: highlevelContactId,
    fullName: `${lead.firstName} ${lead.lastName}`, email: lead.email,
    phone: lead.phone || null, source: input.source,
    sourcePath: '/benessere-patrimoniale/evento',
    editionId: null, // No real edition configured; never invent a booking.
    province: lead.province, profile: lead.profile || null, message: lead.message || null,
    utm: lead.utm, consent: true, marketingConsent: lead.marketingConsent,
    privacyVersion: PATRIMONIAL_PILOT_PRIVACY_VERSION,
    ...(lead.qualification ? { qualification: lead.qualification } : {}),
  };
  let response: Response;
  try {
    response = await (input.fetchImpl ?? fetch)(endpoint.toString(), {
      method: 'POST', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(10000),
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_event: payload }),
    });
  } catch { throw new Error('HUB_INGRESS_UNCONFIRMED'); }
  if (!response.ok) {
    void response.body?.cancel().catch(() => undefined);
    throw new Error('HUB_INGRESS_UNCONFIRMED');
  }
  let receipt: HubIngressResponse;
  try { receipt = (await response.json()) as HubIngressResponse; }
  catch { throw new Error('HUB_INGRESS_UNCONFIRMED'); }
  if (!uuid(receipt?.contactId) || !uuid(receipt?.registrationId) ||
      !['PENDING_EDITION','REQUESTED'].includes(String(receipt?.state)))
    throw new Error('HUB_INGRESS_UNCONFIRMED');
  return 'RECORDED';
}
