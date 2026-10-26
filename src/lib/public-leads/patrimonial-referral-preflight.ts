// Server-only referral preflight. A browser can carry an opaque code but cannot
// decide its owner. A protected Supabase RPC verifies active network membership.
// Referrals fail closed BEFORE any HighLevel contact is written.
export async function validateArchitectEventReferral(input: {
  code: string;
  env: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const { code, env } = input;
  if (!/^[0-9a-f]{32}$/.test(code) || env.HORYZON_HUB_EVENT_INGRESS_ENABLED !== 'true')
    throw new Error('REFERRAL_VALIDATION_UNAVAILABLE');
  const root = (env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!root || !key) throw new Error('REFERRAL_VALIDATION_UNAVAILABLE');
  let url: URL;
  try {
    url = new URL('/rest/v1/rpc/architetti_referral_validate', root);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') ||
      url.username || url.password || url.port) throw new Error('Untrusted Supabase endpoint');
  } catch { throw new Error('REFERRAL_VALIDATION_UNAVAILABLE'); }
  let response: Response;
  try {
    response = await (input.fetchImpl ?? fetch)(url.toString(), {
      method: 'POST', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(10000),
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_code: code }),
    });
  } catch { throw new Error('REFERRAL_VALIDATION_UNAVAILABLE'); }
  if (!response.ok) {
    void response.body?.cancel().catch(() => undefined);
    throw new Error('REFERRAL_VALIDATION_UNAVAILABLE');
  }
  try {
    const receipt: unknown = await response.json();
    if (!receipt || typeof receipt !== 'object' || (receipt as { valid?: unknown }).valid !== true)
      throw new Error('Invalid receipt');
  } catch { throw new Error('REFERRAL_VALIDATION_UNAVAILABLE'); }
}
