// Real transports are constructed only after CLI flags/confirmation pass.
// HTTP schemas not certified by the supplied inventory must be bound explicitly
// by a trusted, reviewed server module. No endpoint discovery or guessed routes.
import { SupabasePatrimonialStore } from '../../src/lib/public-leads/patrimonial-supabase.ts';
import { createConfiguredPatrimonialHighLevelProvider, PatrimonialCrmError } from '../../src/lib/public-leads/patrimonial-highlevel.ts';
import { SmokeError } from './patrimonial-live-smoke.mjs';
import { smokeContactUpsert } from './patrimonial-live-smoke-contact.mjs';

const base = 'https://services.leadconnectorhq.com';
const requireBinding = condition => { if (!condition) throw new SmokeError('VERIFIED_BINDINGS_REQUIRED'); };
export function createSmokeRuntime({ env, bindings, guard, fetchImpl = globalThis.fetch }) {
  guard();
  requireBinding(bindings?.verified === true && bindings.sideEffectsReviewed === true && bindings.locationId === env.HIGHLEVEL_LOCATION_ID
    && bindings.contacts?.bindings?.create?.createOnly === true && bindings.tags?.verified === true
    && bindings.opportunities?.verified === true && ['search', 'get', 'create'].every(key => bindings.opportunities[key]?.verified === true));
  requireBinding(env.PATRIMONIAL_DURABLE_STORE_READY === 'true' && !!env.SUPABASE_SERVICE_ROLE_KEY && !!env.HIGHLEVEL_PRIVATE_TOKEN);
  const guardedFetch = (url, init) => { guard(); return fetchImpl(url, init); };
  const store = new SupabasePatrimonialStore({ url: env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY, fetchImpl: guardedFetch });
  const request = async (binding, args, methods, prefix, missing = false) => {
    requireBinding(binding?.verified === true && typeof binding.request === 'function' && typeof binding.decode === 'function');
    const spec = binding.request(...args); let url;
    try { url = new URL(spec.path, base); } catch { throw new SmokeError('INVALID_HTTP_BINDING'); }
    requireBinding(typeof spec.path === 'string' && spec.path.startsWith(prefix) && url.origin === base && url.pathname.startsWith(prefix)
      && !url.username && !url.password && !url.hash && !/[\r\n]/.test(spec.path) && methods.includes(spec.method)
      && !(spec.method === 'GET' && spec.body !== undefined)
      && (spec.method !== 'DELETE' || url.pathname === prefix || url.pathname === prefix + '/'));
    guard(); let response;
    try { response = await guardedFetch(url.toString(), { method: spec.method, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${env.HIGHLEVEL_PRIVATE_TOKEN}`, Version: '2021-07-28', Accept: 'application/json', 'Content-Type': 'application/json' },
      ...(spec.body === undefined ? {} : { body: JSON.stringify(spec.body) }) }); }
    catch { throw new PatrimonialCrmError('NETWORK', { outcomeUncertain: !['GET'].includes(spec.method) }); }
    if (missing && response.status === 404) { await response.body?.cancel(); return null; }
    if (!response.ok) { const status = response.status; await response.body?.cancel(); throw new PatrimonialCrmError(status === 429 ? 'RATE_LIMIT' : status === 401 || status === 403 ? 'AUTH' : 'PROVIDER', { status, outcomeUncertain: spec.method !== 'GET' }); }
    if (spec.method === 'DELETE') { await response.body?.cancel(); return null; }
    try { return binding.decode(await response.json()); } catch { throw new SmokeError('INVALID_PROVIDER_RESPONSE'); }
  };
  const crm = createConfiguredPatrimonialHighLevelProvider({ ...bindings.contacts, env: () => env, verifiedLocationId: bindings.locationId, fetchImpl: guardedFetch,
    verifiedTagInventory: { verified: true, read: location => request(bindings.tags, [location], ['GET'], '/locations/') } });
  // Explicit CLI opt-in only; no prototype or application provider mutation.
  if (bindings.contacts.upsert) crm.upsertContact = input => smokeContactUpsert({ input, env, binding: bindings.contacts.upsert,
    guard: () => { guard(); crm.assertReady(true); }, getContact: id => crm.getContact(id), fetchImpl });
  // Resolve nullable reads only for cleanup. The existing contact provider still
  // requires a real, scoped contact for all contact/tag/note effects.
  const readContact = id => request(bindings.contacts.bindings.contact, [id], ['GET'], '/contacts/', true);
  const opportunities = {
    searchOpportunities: async query => {
      const page = await request(bindings.opportunities.search, [query], ['GET', 'POST'], '/opportunities/');
      requireBinding(page?.complete === true && Array.isArray(page.opportunities)); return page.opportunities;
    },
    getOpportunity: id => request(bindings.opportunities.get, [id], ['GET'], '/opportunities/', true),
    createOpportunity: input => request(bindings.opportunities.create, [input], ['POST'], '/opportunities/'),
    ...(bindings.opportunities.delete?.verified === true ? { deleteOpportunity: id => request(bindings.opportunities.delete, [id], ['DELETE'], `/opportunities/${encodeURIComponent(id)}`) } : {}),
  };
  // Direct Data API reads only: the installed schema/column names are known from
  // the local migration. All mutations continue through the existing SQL RPCs.
  const audit = async run => {
    const url = new URL(env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL), key = env.SUPABASE_SERVICE_ROLE_KEY;
    const get = async (table, params) => {
      const target = new URL(`/rest/v1/${table}`, url.origin); target.search = new URLSearchParams(params).toString();
      const response = await guardedFetch(target.toString(), { method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000),
        headers: { apikey: key, ...(!key.startsWith('sb_') ? { Authorization: `Bearer ${key}` } : {}), 'Accept-Profile': 'public' } });
      if (!response.ok) { await response.body?.cancel(); throw new SmokeError('AUDIT_READ_FAILED'); }
      const rows = await response.json(); requireBinding(Array.isArray(rows)); return rows;
    };
    const provisional = await get('patrimonial_intents', { select: 'id,kind,remote_contact_id', id: `eq.${run.provisionalId}` });
    const intent = await get('patrimonial_intents', { select: 'id,kind,remote_opportunity_id,sync_state', id: `eq.${run.intentId}` });
    const received = await get('patrimonial_domain_events', { select: 'event_key', request_id: `eq.${run.requestId}`, intent_id: `eq.${run.provisionalId}`, event_name: 'eq.request_received' });
    const events = await get('patrimonial_domain_events', { select: 'event_key', request_id: `eq.${run.requestId}`, intent_id: `eq.${run.intentId}` });
    return { provisionalExists: provisional.length === 1 && provisional[0].kind === 'PROVISIONAL', contactId: provisional[0]?.remote_contact_id,
      opportunityId: intent.length === 1 && intent[0].kind === 'OPPORTUNITY' && intent[0].sync_state === 'SYNCED' ? intent[0].remote_opportunity_id : null,
      domainEventsPresent: received.length === 1 && events.length >= 1 };
  };
  return { store, crm, readContact, opportunities, audit,
    ...(bindings.contactDelete?.verified === true ? { deleteContact: id => request(bindings.contactDelete, [id], ['DELETE'], `/contacts/${encodeURIComponent(id)}`) } : {}),
    ...(bindings.contactOpportunities?.verified === true ? { listContactOpportunities: async id => {
      const page = await request(bindings.contactOpportunities, [id, bindings.locationId], ['GET', 'POST'], '/opportunities/');
      requireBinding(page?.complete === true && Array.isArray(page.opportunities)); return page;
    } } : {}),
  };
}
