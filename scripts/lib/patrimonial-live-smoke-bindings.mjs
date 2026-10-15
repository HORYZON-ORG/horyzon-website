// CLI-only, fixed-origin HighLevel API 2021-07-28 bindings. No top-level I/O.
// HTTP contracts: https://marketplace.gohighlevel.com/docs/2021-07-28/ghl/
// contacts/{get-contacts,create-contact,upsert-contact,get-contact,get-all-notes,delete-contact}/
// opportunities/{search-opportunity,get-opportunity,create-opportunity,delete-opportunity}/
// locations/{get-location,get-location-tags,get-custom-fields}/
import { SupabasePatrimonialStore } from '../../src/lib/public-leads/patrimonial-supabase.ts';
import { getPatrimonialRemoteMapping } from '../../src/lib/public-leads/patrimonial-highlevel-config.ts';

const base = 'https://services.leadconnectorhq.com';
const searchLimit = 100;
const opaque = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const requireSchema = condition => { if (!condition) throw new Error('BINDING_RESPONSE_SCHEMA_INVALID'); };
const binding = (request, decode) => ({ verified: true, request, decode });
const route = (pathname, params) => `${pathname}?${new URLSearchParams(params)}`;
const encodeId = id => { requireSchema(opaque(id)); return encodeURIComponent(id); };

// Bounded complete searches suffice for one new synthetic identity. Never treat
// an incomplete page or unknown total as an empty inventory. HighLevel may
// include navigation cursors even when the exact total is already exhausted.
function completePage(body, rows, total) {
  const totals = [body.meta?.total, body.count].filter(value => value !== undefined);
  const additionalRecords = [body.hasMore, body.meta?.hasMore, body.hasNextPage, body.meta?.hasNextPage].some(value => value === true);
  requireSchema(Array.isArray(rows) && Number.isInteger(total) && total >= 0 && total === rows.length && rows.length <= searchLimit
    && totals.every(value => Number.isInteger(value) && value === total) && !additionalRecords);
}

export function createRealPatrimonialBindings(env) {
  const locationId = env.HIGHLEVEL_LOCATION_ID, resources = getPatrimonialRemoteMapping(env);
  const contact = raw => {
    requireSchema(raw && opaque(raw.id) && raw.locationId === locationId);
    return { id: raw.id, locationId: raw.locationId, firstName: raw.firstName, lastName: raw.lastName,
      email: raw.email?.trim().toLowerCase() ?? null, phone: raw.phone || null, tags: raw.tags ?? [] };
  };
  const lookup = binding((value, location) => {
    requireSchema(location === locationId);
    return { method: 'GET', path: route('/contacts/', { locationId, query: value, limit: String(searchLimit) }) };
  }, body => {
    completePage(body, body.contacts, body.meta?.total ?? body.count);
    return { complete: true, contacts: body.contacts.map(contact) };
  });
  const opportunity = raw => {
    requireSchema(raw && opaque(raw.id) && raw.locationId === locationId && opaque(raw.contactId)
      && opaque(raw.pipelineId) && opaque(raw.pipelineStageId) && Array.isArray(raw.customFields));
    const version = raw.updatedAt ?? raw.dateUpdated;
    requireSchema(typeof version === 'string' && Number.isFinite(Date.parse(version)));
    const fields = Object.create(null);
    for (const field of raw.customFields) {
      requireSchema(opaque(field.id) && !Object.hasOwn(fields, field.id));
      fields[field.id] = field.fieldValue ?? field.field_value;
    }
    return { id: raw.id, locationId: raw.locationId, contactId: raw.contactId, pipelineId: raw.pipelineId,
      pipelineStageId: raw.pipelineStageId, status: raw.status, version, customFields: fields };
  };
  const search = binding(query => {
    requireSchema(query.locationId === locationId && opaque(query.contactId) && (!query.pipelineId || opaque(query.pipelineId)));
    return { method: 'GET', path: route('/opportunities/search', { location_id: locationId, contact_id: query.contactId,
      ...(query.pipelineId ? { pipeline_id: query.pipelineId } : {}), status: 'all', limit: String(searchLimit), page: '1' }) };
  }, body => {
    completePage(body, body.opportunities, body.meta?.total);
    return { complete: true, opportunities: body.opportunities.map(opportunity) };
  });
  return {
    // Review covers the CLI's effects only, never claims that remote workflows
    // have been disabled. No workflow/message endpoint is bound or invoked.
    verified: true, sideEffectsReviewed: true, locationId,
    contacts: { upsert: binding((input, location) => {
      requireSchema(location === locationId && input.firstName === 'Horyzon' && input.lastName === 'Synthetic Test'
        && /^patrimonial-test\+[a-f0-9-]{36}@example\.invalid$/.test(input.email) && !input.phone
        && Buffer.byteLength(input.email.split('@')[0]) <= 64);
      // HighLevel v2021-07-28 requires camelCase and locationId (not first_name).
      // Omit source/tags/customFields/DND so reuse cannot overwrite those fields.
      return { method: 'POST', path: '/contacts/upsert', body: { locationId, firstName: input.firstName, lastName: input.lastName, email: input.email } };
    }, body => {
      requireSchema(body && typeof body.new === 'boolean' && opaque(body.contact?.id));
      return { contact: body.contact, disposition: body.new ? 'CREATED' : 'REUSED_UPDATED' };
    }), capabilities: { contactsRead: true, contactsWrite: true, tagsWrite: true, notesWrite: true, notesRead: true }, bindings: {
      email: lookup, phone: lookup,
      contact: binding(id => ({ method: 'GET', path: `/contacts/${encodeId(id)}` }), body => contact(body.contact)),
      create: { ...binding((input, location) => {
        requireSchema(location === locationId && input.firstName === 'Horyzon' && input.lastName === 'Synthetic Test'
          && /^patrimonial-test\+[a-f0-9-]{36}@example\.invalid$/.test(input.email) && !input.phone);
        return { method: 'POST', path: '/contacts/', body: { locationId, firstName: input.firstName, lastName: input.lastName, email: input.email, dnd: true } };
      }, body => contact(body.contact)), createOnly: true },
      noteLookup: binding(id => ({ method: 'GET', path: `/contacts/${encodeId(id)}/notes` }), body => {
        requireSchema(Array.isArray(body.notes) && !body.meta?.nextPageUrl);
        return { complete: true, notes: body.notes.map(note => {
          requireSchema(opaque(note.id) && opaque(note.contactId) && typeof note.body === 'string');
          return { id: note.id, contactId: note.contactId, locationId, marker: note.body.split('\n')[0] };
        }) };
      }),
    } },
    tags: binding(location => { requireSchema(location === locationId); return { method: 'GET', path: `/locations/${encodeId(location)}/tags` }; }, body => {
      requireSchema(Array.isArray(body.tags) && body.tags.every(tag => opaque(tag.id) && tag.locationId === locationId && typeof tag.name === 'string'));
      return { complete: true, tags: body.tags.map(tag => ({ id: tag.id, name: tag.name, locationId: tag.locationId })) };
    }),
    opportunities: { verified: true, search,
      get: binding(id => ({ method: 'GET', path: `/opportunities/${encodeId(id)}` }), body => opportunity(body.opportunity)),
      create: binding(input => {
        const pipeline = resources.pipelines.ARCHITECT_PATH;
        requireSchema(input.locationId === locationId && input.pipelineId === pipeline.id && input.pipelineStageId === pipeline.stages.A01.id
          && input.status === 'open' && opaque(input.contactId) && Object.keys(input.customFields).length === 12);
        const allowed = new Set(Object.values(resources.opportunityFields).map(field => field.id));
        requireSchema(Object.keys(input.customFields).every(id => allowed.has(id)));
        return { method: 'POST', path: '/opportunities/', body: { locationId, contactId: input.contactId, pipelineId: input.pipelineId,
          pipelineStageId: input.pipelineStageId, status: 'open', name: `SYNTHETIC TEST ${input.customFields[resources.opportunityFields.hz_intent_key.id]}`,
          customFields: Object.entries(input.customFields).map(([id, field_value]) => ({ id, field_value })) } };
      }, body => opportunity(body.opportunity)),
      delete: binding(id => ({ method: 'DELETE', path: `/opportunities/${encodeId(id)}` }), () => null),
    },
    contactDelete: binding(id => ({ method: 'DELETE', path: `/contacts/${encodeId(id)}` }), () => null),
    contactOpportunities: binding((contactId, location) => search.request({ contactId, locationId: location }), search.decode),
  };
}

// Labels alone are safe report data; never persist URLs, headers or raw bodies.
export const realReadLabels = ['SUPABASE patrimonial_store_health (read-only RPC)', 'HIGHLEVEL GET location',
  'HIGHLEVEL GET pipelines', 'HIGHLEVEL GET tags', 'HIGHLEVEL GET contact customFields',
  'HIGHLEVEL GET opportunity customFields', 'HIGHLEVEL GET synthetic contact search'];

export async function validateRealPatrimonialReadiness({ env, lead, fetchImpl = globalThis.fetch }) {
  const state = { storeReady: false, mappingReady: false, providerBindingReady: false, storeHealthChecked: false,
    storeReadinessScope: 'REMOTE_HEALTH', remoteReads: [], blockers: [] };
  let step = 'SUPABASE_STORE_HEALTH_FAILED';
  try {
    const supabaseOrigin = new URL(env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL).origin;
    const store = new SupabasePatrimonialStore({ url: supabaseOrigin, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY, fetchImpl: (url, init) => {
      requireSchema(url === `${supabaseOrigin}/rest/v1/rpc/patrimonial_store_health` && init.method === 'POST' && init.body === '{}');
      state.remoteReads.push(realReadLabels[0]); return fetchImpl(url, init);
    } });
    state.storeHealthChecked = true; await store.health(); state.storeReady = true;
    const locationId = env.HIGHLEVEL_LOCATION_ID, locationPath = `/locations/${encodeId(locationId)}`;
    const read = async (pathname, label) => {
      requireSchema(pathname.startsWith('/') && !pathname.startsWith('//') && new URL(pathname, base).origin === base);
      state.remoteReads.push(label);
      const response = await fetchImpl(new URL(pathname, base).href, { method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${env.HIGHLEVEL_PRIVATE_TOKEN}`, Version: '2021-07-28', Accept: 'application/json' } });
      if (!response.ok) { const status = response.status; await response.body?.cancel(); step += `_HTTP_${status}`; throw new Error('READ_FAILED'); }
      return response.json();
    };
    step = 'HIGHLEVEL_LOCATION_READ_FAILED';
    const location = (await read(locationPath, realReadLabels[1])).location;
    step = 'HIGHLEVEL_LOCATION_MISMATCH'; requireSchema(location?.id === locationId);
    step = 'HIGHLEVEL_CREATE_ONLY_DUPLICATE_GUARD_UNVERIFIED'; requireSchema(location.settings?.allowDuplicateContact === false);
    const resources = getPatrimonialRemoteMapping(env);
    step = 'HIGHLEVEL_PIPELINE_MAPPING_MISMATCH';
    const pipelines = (await read(route('/opportunities/pipelines', { locationId }), realReadLabels[2])).pipelines;
    requireSchema(Array.isArray(pipelines));
    for (const pipeline of Object.values(resources.pipelines)) {
      const matches = pipelines.filter(p => p.id === pipeline.id); requireSchema(matches.length === 1 && Array.isArray(matches[0].stages));
      for (const stage of Object.values(pipeline.stages)) requireSchema(matches[0].stages.filter(s => s.id === stage.id).length === 1);
    }
    step = 'HIGHLEVEL_TAG_MAPPING_MISMATCH';
    const tags = (await read(`${locationPath}/tags`, realReadLabels[3])).tags; requireSchema(Array.isArray(tags));
    for (const tag of Object.values(resources.tags)) requireSchema(tags.filter(t => t.id === tag.id && t.name === tag.name && t.locationId === locationId).length === 1
      && tags.filter(t => t.name === tag.name).length === 1);
    for (const [section, model, label] of [['contactFields', 'contact', realReadLabels[4]], ['opportunityFields', 'opportunity', realReadLabels[5]]]) {
      step = `HIGHLEVEL_${model.toUpperCase()}_FIELD_MAPPING_MISMATCH`;
      const fields = (await read(route(`${locationPath}/customFields`, { model }), label)).customFields;
      requireSchema(Array.isArray(fields));
      for (const field of Object.values(resources[section])) requireSchema(fields.filter(f => f.id === field.id && f.fieldKey === field.fieldKey && f.locationId === locationId && f.model === model).length === 1);
    }
    state.mappingReady = true;
    step = 'HIGHLEVEL_SYNTHETIC_IDENTITY_LOOKUP_FAILED';
    const bindings = createRealPatrimonialBindings(env), spec = bindings.contacts.bindings.email.request(lead.email, locationId);
    const page = bindings.contacts.bindings.email.decode(await read(spec.path, realReadLabels[6]));
    step = 'UNEXPECTED_EXISTING_SYNTHETIC_IDENTITY'; requireSchema(page.contacts.length === 0);
    state.providerBindingReady = true;
  } catch { state.blockers.push(step); }
  return state;
}
