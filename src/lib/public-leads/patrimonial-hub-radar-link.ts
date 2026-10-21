type RadarStatus = 'STARTED' | 'IN_PROGRESS' | 'COMPLETED';
type TrustedRadarBinding = {
  // Only a trusted Radar server adapter may produce these fields, after verifying
  // the session/OTP and resolving the email against the Horyzon contact registry.
  assessmentId: string;
  contactId: string;
  registrationId: string | null;
  questionnaireVersion: string;
  status: RadarStatus;
  completedAt: string | null;
};
const isUuid = (v: unknown): v is string => typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

type RadarLinkReceipt = { contactId?: unknown; assessmentId?: unknown; status?: unknown };

/**
 * Internal, OFF-by-default adapter. Never call this from a public form or from
 * an unverified email query. A Radar 5A backend must first prove ownership
 * and return a contact binding from its authenticated identity resolver.
 *
 * No Radar answers are sent to the CRM or copied into the event tables.
 */
export async function saveVerifiedRadarReferenceInHub(input: {
  binding: TrustedRadarBinding;
  env: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}): Promise<'DISABLED' | 'LINKED'> {
  const { binding, env } = input;
  if (env.HORYZON_HUB_RADAR_LINK_ENABLED !== 'true') return 'DISABLED';
  if (!isUuid(binding.assessmentId) || !isUuid(binding.contactId) ||
      (binding.registrationId !== null && !isUuid(binding.registrationId)) ||
      typeof binding.questionnaireVersion !== 'string' ||
      !/^[a-zA-Z0-9_.:-]{1,100}$/.test(binding.questionnaireVersion) ||
      !(['STARTED','IN_PROGRESS','COMPLETED'] as const).includes(binding.status) ||
      (binding.status === 'COMPLETED'
        ? !binding.completedAt || !Number.isFinite(Date.parse(binding.completedAt))
        : binding.completedAt !== null))
    throw new Error('RADAR_BINDING_INVALID');
  const root = (env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!root || !key) throw new Error('RADAR_LINK_CONFIG');
  let endpoint: URL;
  try {
    endpoint = new URL('/rest/v1/rpc/architetti_radar_link', root);
    if (endpoint.protocol !== 'https:' || !endpoint.hostname.endsWith('.supabase.co') ||
      endpoint.username || endpoint.password || endpoint.port)
      throw new Error('Invalid destination');
  } catch { throw new Error('RADAR_LINK_CONFIG'); }
  let response: Response;
  try {
    response = await (input.fetchImpl ?? fetch)(endpoint.toString(), {
      method: 'POST', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(10000),
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_link: {
        contactId: binding.contactId,
        assessmentId: binding.assessmentId,
        registrationId: binding.registrationId,
        questionnaireVersion: binding.questionnaireVersion,
        status: binding.status,
        completedAt: binding.completedAt,
      } }),
    });
  } catch { throw new Error('RADAR_LINK_UNCONFIRMED'); }
  if (!response.ok) {
    void response.body?.cancel().catch(() => undefined);
    throw new Error('RADAR_LINK_UNCONFIRMED');
  }
  let result: RadarLinkReceipt;
  try { result = (await response.json()) as RadarLinkReceipt; }
  catch { throw new Error('RADAR_LINK_UNCONFIRMED'); }
  if (result.contactId !== binding.contactId ||
      result.assessmentId !== binding.assessmentId || result.status !== binding.status)
    throw new Error('RADAR_LINK_UNCONFIRMED');
  return 'LINKED';
}

