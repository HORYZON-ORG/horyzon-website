// CLI-only contact upsert. The application's create-only provider is unchanged.
import { checkedPatrimonialContact, PatrimonialCrmError } from '../../src/lib/public-leads/patrimonial-highlevel.ts';

const base = 'https://services.leadconnectorhq.com';
export class SmokeContactWriteError extends PatrimonialCrmError {
  constructor(code, diagnostic) {
    super(code, { status: diagnostic.httpStatus ?? undefined, outcomeUncertain: diagnostic.outcomeUncertain, retryAfterSeconds: diagnostic.retryAfterSeconds });
    this.contactDiagnostic = { ...diagnostic, code };
  }
}

export async function smokeContactUpsert({ input, env, binding, guard, getContact, fetchImpl = globalThis.fetch }) {
  const started = performance.now();
  let phase = 'PREPARE', httpStatus = null, writeDispatched = false;
  const diagnostic = (outcomeUncertain, extra = {}) => ({ phase, httpStatus, writeDispatched, outcomeUncertain,
    elapsedMs: Math.max(0, Math.round(performance.now() - started)), ...extra });
  const fail = (code, uncertain = false, extra) => { throw new SmokeContactWriteError(code, diagnostic(uncertain, extra)); };
  let spec, body;
  try {
    guard();
    if (binding?.verified !== true) fail('CONFIG');
    spec = binding.request(input, env.HIGHLEVEL_LOCATION_ID);
    if (spec.method !== 'POST' || spec.path !== '/contacts/upsert') fail('CONFIG');
    body = JSON.stringify(spec.body); // All local validation/serialization before dispatch.
  } catch (error) { if (error instanceof SmokeContactWriteError) throw error; fail('SCHEMA'); }
  let response;
  try { guard(); } catch { fail('CONFIG'); }
  try {
    phase = 'DISPATCH'; writeDispatched = true;
    response = await fetchImpl(base + spec.path, { method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${env.HIGHLEVEL_PRIVATE_TOKEN}`, Version: '2021-07-28', Accept: 'application/json', 'Content-Type': 'application/json' }, body });
  } catch { fail('NETWORK', writeDispatched); }
  phase = 'HTTP_RESPONSE'; httpStatus = response.status;
  if (!response.ok) {
    const retry = response.headers.get('retry-after');
    const seconds = retry === null ? undefined : /^\d+$/.test(retry.trim()) ? Number(retry)
      : Math.max(0, Math.ceil((Date.parse(retry) - Date.now()) / 1000));
    const retryAfterSeconds = Number.isFinite(seconds) ? seconds : undefined;
    await response.body?.cancel().catch(() => undefined);
    const code = httpStatus === 429 ? 'RATE_LIMIT' : [401, 403].includes(httpStatus) ? 'AUTH'
      : httpStatus === 404 ? 'CONFIG' : httpStatus === 409 ? 'IDENTITY' : httpStatus >= 500 ? 'PROVIDER' : 'SCHEMA';
    // A 5xx after sending a write provides no proof that it did not commit.
    fail(code, httpStatus >= 500, { retryAfterSeconds });
  }
  phase = 'DECODE';
  let decoded;
  try { decoded = binding.decode(await response.json()); }
  catch { fail('SCHEMA', true); }
  let contact = decoded.contact;
  try {
    // A valid 2xx with contact.id/new is confirmed via a scoped GET when the
    // response omits detail fields. Never manufacture location/identity values.
    if (contact.locationId === undefined || [contact.firstName, contact.lastName, contact.email].some(value => typeof value !== 'string')) {
      phase = 'READ_BACK'; contact = await getContact(contact.id);
      if (contact.id !== decoded.contact.id) fail('IDENTITY', true);
    }
    contact = checkedPatrimonialContact({ ...contact, phone: contact.phone || null }, env.HIGHLEVEL_LOCATION_ID);
    if (contact.email !== input.email || contact.phone) fail('IDENTITY', true);
  } catch (error) { if (error instanceof SmokeContactWriteError) throw error; fail('SCHEMA', true); }
  phase = 'CONFIRMED';
  return { ...contact, disposition: decoded.disposition, contactDiagnostic: diagnostic(false) };
}
