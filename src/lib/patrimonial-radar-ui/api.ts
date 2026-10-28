export class RadarApiError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}
/** Same-origin, memory-only credentials. No payload is logged or persisted by this adapter. */
export async function radarApi<T>(path: string, body?: unknown, csrf?: string): Promise<T> {
  if (!/^\/(referral|session(?:\/revoke)?|identity\/(request|verify)|event\/(propose|confirm|link-assessment)|assessments(?:\/[a-f0-9-]+(?:\/(answer|complete|snapshot|notice))?)?)$/i.test(path)) throw new RadarApiError('INVALID');
  let response: Response;
  try {
    response = await fetch(`/api/patrimonial-radar${path}`, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000), headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Patrimonial-CSRF': csrf ?? '' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  } catch { throw new RadarApiError('NETWORK'); }
  let value;
  try { value = await response.json(); } catch { throw new RadarApiError('UNAVAILABLE'); }
  if (!response.ok) throw new RadarApiError(typeof value.error === 'string' ? value.error : 'UNAVAILABLE');
  return value as T;
}
