import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { FakePatrimonialSupabase } from './fixtures/patrimonial-supabase-transport.mjs';
import { SupabasePatrimonialStore } from '../src/lib/public-leads/patrimonial-supabase.ts';
import { patrimonialFlags } from '../src/lib/public-leads/patrimonial-store.ts';
import { getPatrimonialRemoteMapping } from '../src/lib/public-leads/patrimonial-highlevel-config.ts';
import { validatePatrimonialV2 } from '../src/lib/public-leads/patrimonial-funnels.ts';
import { createSmokeRuntime } from './lib/patrimonial-live-smoke-runtime.mjs';
import { createSmokeRun, parseSmokeArgs, publicSmokeReport, runPatrimonialSmoke, syntheticLead, assertSyntheticData, assertSmokeReport, simulateSmokeFailure, smokeMarkdown } from './lib/patrimonial-live-smoke.mjs';

// Never import or invoke the live CLI. All reports are captured in memory; no
// files under tmp/ are created, read, modified, enumerated or cleaned by tests.
let externalCalls = 0;
globalThis.fetch = async () => { externalCalls++; throw new Error('External network forbidden'); };
const flags = { PATRIMONIAL_SYNTHETIC_TEST_ENABLED: 'true', PATRIMONIAL_V2_ENABLED: 'true', PATRIMONIAL_CRM_WRITE_ENABLED: 'true', PATRIMONIAL_OPPORTUNITY_WRITE_ENABLED: 'true' };
const passed = [], mode = (name, extra = {}) => ({ mode: name, confirm: true, simulate: false, ...extra });
const fresh = () => createSmokeRun(new Date('2026-10-14T21:00:00.000Z'));

function fixture() {
  const db = new FakePatrimonialSupabase(), run = fresh(), people = new Map(), opportunities = new Map(), notes = [], calls = [], reports = [];
  const store = new SupabasePatrimonialStore({ url: 'https://patrimonial.invalid', serviceRoleKey: 'fixture-secret', fetchImpl: db.fetch.bind(db) });
  const ctx = { db, store, run, people, opportunities, notes, calls, reports, env: { ...flags }, fail: null, reads: false, factories: 0 };
  const log = (name, args) => { calls.push({ name, args: structuredClone(args) }); };
  const crm = {
    locationId: 'fixture-location', capabilities: { notesRead: false }, assertReady() {},
    async findContactsByEmail(email) { log('lookup', email); return [...people.values()].filter(c => c.email === email).map(c => structuredClone(c)); },
    async upsertContact(input) { log('create-contact', input); assert(!Object.hasOwn(input, 'phone')); const contact = { id: 'fixture-contact', locationId: crm.locationId, phone: null, tags: [], ...input }; people.set(contact.id, contact); return structuredClone(contact); },
    async getContact(id) { log('read-contact', id); return structuredClone(people.get(id) ?? null); },
    async addTags(id, tags) { log('tags', tags); people.get(id).tags = [...tags]; },
    async addNote(id, body) { log('note', body); const note = { id: 'fixture-note', contactId: id, locationId: crm.locationId, marker: body.split('\n')[0], body }; notes.push(note); if (ctx.fail === 'note-lost') throw new Error('fixture-private-token secret@example.com'); return { id: note.id }; },
    async findNoteByRequestMarker(id, marker) { const matches = notes.filter(n => n.contactId === id && n.marker === marker); assert(matches.length <= 1); return structuredClone(matches[0] ?? null); },
  };
  const provider = {
    async searchOpportunities(query) { log('search-opportunities', query); return [...opportunities.values()].filter(o => o.contactId === query.contactId && o.pipelineId === query.pipelineId).map(o => structuredClone(o)); },
    async createOpportunity(input) { log('create-opportunity', input); const row = { ...input, id: 'fixture-opportunity', version: 'fixture-version' }; opportunities.set(row.id, row); if (ctx.fail === 'opportunity-lost') throw new Error('lost-response'); return structuredClone(row); },
    async getOpportunity(id) { log('read-opportunity', id); return structuredClone(opportunities.get(id) ?? null); },
    async deleteOpportunity(id) { log('delete-opportunity', id); opportunities.delete(id); },
  };
  const runtime = { store, crm, opportunities: provider,
    async audit(r) { const state = db.inspect(); return { provisionalExists: state.provisional.has(r.provisionalId), contactId: state.provisional.get(r.provisionalId)?.contactId,
      opportunityId: state.opportunities.get(r.intentId)?.remote?.id, domainEventsPresent: state.events.has(`${r.requestId}:received`) && state.opportunities.get(r.intentId)?.events.length > 0 }; },
    async deleteContact(id) { log('delete-contact', id); people.delete(id); },
    async listContactOpportunities(id) { return { complete: true, opportunities: [...opportunities.values()].filter(o => o.contactId === id) }; },
  };
  ctx.runtime = runtime; ctx.crm = crm;
  ctx.invoke = (options = mode('execute'), report = run) => runPatrimonialSmoke({ options, env: ctx.env, run: report, now: () => new Date(db.now), persist: async r => reports.push(structuredClone(r)),
    runtimeFactory: async () => { ctx.factories++; return runtime; } });
  return ctx;
}

assert.equal(parseSmokeArgs([]).mode, 'dry-run');
for (const argv of [['--execute', '--verify'], ['--execute', '--simulate-provider-failure'], ['--cleanup'], ['--unexpected'], ['--report', 'x']]) assert.throws(() => parseSmokeArgs(argv));
const dry = fixture(); assert.equal((await dry.invoke(parseSmokeArgs([]))).result, 'NOT_RUN');
assert.equal(dry.factories, 0); assert.equal(dry.db.calls.length, 0); assert.equal(dry.calls.length, 0); assert(dry.reports.length);
passed.push('1 dry-run default: zero runtime construction, DB or CRM calls; in-memory report only');
for (const key of Object.keys(flags)) {
  const off = fixture(); off.env[key] = 'false'; assert.equal((await off.invoke()).error, 'LIVE_FLAGS_REQUIRED'); assert.equal(off.factories, 0);
}
assert(Object.values(patrimonialFlags({})).every(v => v === false));
passed.push('2 execute requires synthetic/V2/CRM/opportunity flags; defaults stay false');
const unconfirmed = fixture(); assert.equal((await unconfirmed.invoke(mode('execute', { confirm: false }))).error, 'LIVE_CONFIRM_REQUIRED'); assert.equal(unconfirmed.factories, 0);
passed.push('3 execute without CLI confirmation aborts before dependencies');
const missing = fixture(); missing.env.PATRIMONIAL_HIGHLEVEL_REMOTE_IDS_JSON = JSON.stringify({ stages: { A01: '' } });
assert.equal((await missing.invoke()).error, 'MAPPING_NOT_READY'); assert.equal(missing.factories, 0);
passed.push('4 invalid/missing mapping aborts before DB');
const unavailable = fixture(); unavailable.db.failHealth = true;
assert.equal((await unavailable.invoke()).result, 'FAIL'); assert.equal(unavailable.calls.length, 0); assert.equal(unavailable.db.inspect().requests.size, 0);
passed.push('5 store unavailable: zero acquisitions or CRM writes');
const data = fresh(), payload = syntheticLead(data);
assertSyntheticData(payload, data); assert.equal(validatePatrimonialV2({ ...payload, requestId: data.requestId }), null, 'public Architect phone requirement stays unchanged');
for (const changes of [{ email: 'person@example.com' }, { phone: '+393331234567' }, { firstName: 'Ada' }, { mode: 'patrimonial-event' }, { marketingConsent: true }, { experience: 'invalid' }]) assert.throws(() => assertSyntheticData({ ...payload, ...changes }, data));
passed.push('6 exact synthetic data only; no phone, invalid-domain email; public parser unchanged');
const existing = fixture(); existing.people.set('existing', { id: 'existing', email: syntheticLead(existing.run).email });
assert.equal((await existing.invoke()).error, 'EXISTING_CONTACT_REFUSED'); assert.equal(existing.db.inspect().requests.size, 0); assert(!existing.calls.some(c => c.name.startsWith('create')));
passed.push('8 any pre-existing contact refused before acquisition, even synthetic-looking');

const good = fixture(), foreignId = crypto.randomUUID();
// A foreign row can never be claimed or mutated: the harness never uses the
// installed global claimOperations RPC, including its max-attempt side effects.
good.db.state.operations.set(foreignId, { id: foreignId, requestId: crypto.randomUUID(), technicalState: 'SYNC_PENDING', attemptCount: 5 });
const foreignBefore = structuredClone(good.db.state.operations.get(foreignId));
assert.equal((await good.invoke()).result, 'PASS');
assert.deepEqual(good.db.inspect().operations.get(foreignId), foreignBefore);
assert(!good.db.calls.some(call => call.body.p_commands?.some(command => command.method === 'claimOperations')));
assert.equal(good.run.replay, true); assert.equal(good.people.size, 1); assert.equal(good.opportunities.size, 1); assert.equal(good.notes.length, 1);
assert.deepEqual(good.run.effects, Object.fromEntries(['SYNC_REQUEST', 'RESOLVE_CONTACT', 'UPSERT_CONTACT', 'ADD_TAGS', 'ADD_NOTE'].map(k => [k, 'SYNCED'])));
assert.equal(Object.keys(good.opportunities.get(good.run.opportunityId).customFields).length, 12);
for (const phrase of ['SYNTHETIC TEST', good.run.requestId, good.run.runId, 'ARCHITECT_PATH', good.run.timestamp, 'NO PRODUCTION LEAD']) assert(good.notes[0].body.includes(phrase));
assert.equal(good.run.verification.note, 'SKIPPED'); assert(good.run.warnings.includes('NOTE_READ_SKIPPED'));
const beforeReads = good.calls.filter(c => ['create-contact', 'create-opportunity', 'note', 'tags'].includes(c.name)).length;
assert.equal((await good.invoke(mode('verify'))).result, 'PASS');
assert.equal(good.calls.filter(c => ['create-contact', 'create-opportunity', 'note', 'tags'].includes(c.name)).length, beforeReads);
good.crm.capabilities.notesRead = true; assert.equal((await good.invoke(mode('verify'))).verification.note, 'PASS');
const again = await good.invoke(); assert.equal(again.error, 'EXISTING_RUN_REFUSED'); assert.equal(good.notes.length, 1);
passed.push('9 one request replay, one contact/opportunity/note; scoped outbox only; verify performs no writes');

const guard = fixture(); await guard.invoke();
const noCleanupConfirm = fixture(); assert.equal((await noCleanupConfirm.invoke(mode('cleanup', { confirm: false }))).error, 'LIVE_CONFIRM_REQUIRED'); assert.equal(noCleanupConfirm.factories, 0);
const tampered = structuredClone(guard.run); tampered.contactCreatedByRun = false;
assert.equal((await guard.invoke(mode('cleanup'), tampered)).error, 'CLEANUP_OWNERSHIP_REFUSED'); assert(!guard.calls.some(c => c.name.startsWith('delete')));
guard.people.get(guard.run.contactId).email = 'real@example.com';
assert.equal((await guard.invoke(mode('cleanup'))).error, 'CONTACT_SCOPE_MISMATCH'); assert(!guard.calls.some(c => c.name.startsWith('delete')));
const wrongOpportunity = fixture(); await wrongOpportunity.invoke(); wrongOpportunity.opportunities.get(wrongOpportunity.run.opportunityId).pipelineId = 'foreign-pipeline';
assert.equal((await wrongOpportunity.invoke(mode('cleanup'))).error, 'OPPORTUNITY_SCOPE_MISMATCH'); assert(!wrongOpportunity.calls.some(c => c.name.startsWith('delete')));
const foreignRelation = fixture(); await foreignRelation.invoke(); foreignRelation.opportunities.set('foreign', { id: 'foreign', contactId: foreignRelation.run.contactId, pipelineId: 'foreign-pipeline' });
assert.equal((await foreignRelation.invoke(mode('cleanup'))).error, 'CLEANUP_FOREIGN_RELATION_REFUSED'); assert(foreignRelation.people.size === 1); assert(foreignRelation.opportunities.has('foreign'));
const noDelete = fixture(); await noDelete.invoke(); delete noDelete.runtime.deleteContact; delete noDelete.runtime.opportunities.deleteOpportunity;
await noDelete.invoke(mode('cleanup')); assert.equal(noDelete.run.cleanup.contact, 'MANUAL_CLEANUP_REQUIRED'); assert(noDelete.run.warnings.includes('MANUAL_CLEANUP_REQUIRED'));
const clean = fixture(); await clean.invoke(); const counts = clean.db.inspect(); await clean.invoke(mode('cleanup'));
assert.equal(clean.run.result, 'PASS'); assert.equal(clean.run.cleanup.contact, 'DELETED'); assert.equal(clean.run.cleanup.opportunity, 'DELETED');
assert.equal(clean.people.size, 0); assert.equal(clean.opportunities.size, 0); assert.equal(clean.db.inspect().requests.size, counts.requests.size); assert.equal(clean.db.inspect().consents.size, counts.consents.size); assert.equal(clean.db.inspect().events.size, counts.events.size);
assert.deepEqual(clean.calls.filter(c => c.name.startsWith('delete')).map(c => c.name), ['delete-opportunity', 'delete-contact']);
await clean.invoke(mode('cleanup')); assert.equal(clean.run.result, 'PASS'); assert.equal(clean.run.cleanup.contact, 'ALREADY_ABSENT');
passed.push('7 cleanup ownership/email/store guards; optional delete; opportunity first; audit retained; repeat cleanup idempotent');

const lost = fixture(); lost.fail = 'note-lost';
assert.equal((await lost.invoke()).result, 'FAIL'); assert.equal(lost.run.effects.ADD_NOTE, 'RECONCILE_REQUIRED'); assert.equal(lost.notes.length, 1);
await lost.invoke(); assert.equal(lost.notes.length, 1, 'interrupted execution cannot blindly repeat a note');
const uncertain = fixture(); uncertain.fail = 'opportunity-lost'; await uncertain.invoke(); assert.equal(uncertain.opportunities.size, 1); assert.equal(uncertain.run.result, 'FAIL');
await uncertain.invoke(); assert.equal(uncertain.opportunities.size, 1);
assert.deepEqual(await simulateSmokeFailure(), { localOnly: true, retrySchedule: true, noDuplicateEffect: true, reconcileRequired: true });
const simulated = fixture(); const simulatedResult = await simulated.invoke(mode('dry-run', { simulate: true })); assert.equal(simulatedResult.result, 'PASS'); assert.equal(simulated.factories, 0);
passed.push('failure injection local only: retry schedule, uncertain effect reconciles, no duplicate write');

const redacted = publicSmokeReport({ ...good.run, rawResponse: 'must-not-appear', secret: 'must-not-appear', error: 'test-private-token', contactId: 'test-service-secret',
  effects: { ...good.run.effects, rawResponse: 'must-not-appear' }, verification: { ...good.run.verification, providerBody: 'must-not-appear' }, warnings: ['must-not-appear'] }, { HIGHLEVEL_PRIVATE_TOKEN: 'test-private-token', SUPABASE_SERVICE_ROLE_KEY: 'test-service-secret' });
const rendered = JSON.stringify(redacted) + smokeMarkdown(redacted);
for (const token of ['test-private-token', 'test-service-secret', 'rawResponse', 'must-not-appear', 'leaseToken']) assert(!rendered.includes(token));
assert.throws(() => assertSmokeReport({ ...good.run, requestId: 'invalid' }));
assert.throws(() => assertSmokeReport({ ...good.run, initialContactCount: { rawResponse: 'must-not-appear' } }));
passed.push('10 JSON/Markdown report allowlist and secret redaction; no lease tokens/provider bodies');

let bindingCalls = 0;
assert.throws(() => createSmokeRuntime({ env: {}, bindings: {}, guard: () => {}, fetchImpl: async () => { bindingCalls++; } }));
assert.equal(bindingCalls, 0);
// Exercise the actual CLI runtime adapter as well as orchestration. Every URL
// goes to this in-process emulator; no native/global fetch is used.
const http = fixture(), resources = getPatrimonialRemoteMapping({}), httpCalls = [];
const binding = (request, decode = body => body) => ({ verified: true, request, decode });
const httpEnv = { ...flags, HIGHLEVEL_LOCATION_ID: 'fixture-location', HIGHLEVEL_PRIVATE_TOKEN: 'fixture-token',
  SUPABASE_URL: 'https://patrimonial.invalid', SUPABASE_SERVICE_ROLE_KEY: 'fixture-secret', PATRIMONIAL_DURABLE_STORE_READY: 'true' };
const bindings = { verified: true, sideEffectsReviewed: true, locationId: 'fixture-location', contacts: {
  capabilities: { contactsRead: true, contactsWrite: true, tagsWrite: true, notesWrite: true },
  bindings: {
    email: binding(email => ({ method: 'GET', path: `/contacts/fixture-search?email=${encodeURIComponent(email)}` })),
    phone: binding(() => ({ method: 'GET', path: '/contacts/fixture-search?phone=none' })),
    contact: binding(id => ({ method: 'GET', path: `/contacts/${id}` }), body => body.contact),
    create: { ...binding((input, locationId) => ({ method: 'POST', path: '/contacts/', body: { ...input, locationId } }), body => body.contact), createOnly: true },
  } }, tags: binding(() => ({ method: 'GET', path: '/locations/fixture-location/tags' })),
  opportunities: { verified: true,
    search: binding(query => ({ method: 'POST', path: '/opportunities/fixture-search', body: query })),
    get: binding(id => ({ method: 'GET', path: `/opportunities/${id}` }), body => body.opportunity),
    create: binding(input => ({ method: 'POST', path: '/opportunities/', body: input }), body => body.opportunity),
    delete: binding(id => ({ method: 'DELETE', path: `/opportunities/${id}` })),
  }, contactDelete: binding(id => ({ method: 'DELETE', path: `/contacts/${id}` })),
  contactOpportunities: binding(id => ({ method: 'POST', path: '/opportunities/fixture-search', body: { contactId: id } })),
};
const fakeHttp = async (value, init) => {
  const url = new URL(value); httpCalls.push({ path: url.pathname, method: init.method });
  assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store'); assert(init.signal);
  const body = init.body ? JSON.parse(init.body) : {};
  if (url.hostname === 'patrimonial.invalid') {
    if (url.pathname.includes('/rpc/')) return http.db.fetch(value, init);
    assert.equal(init.method, 'GET'); const state = http.db.inspect(), id = url.searchParams.get('id')?.slice(3);
    if (url.pathname.endsWith('/patrimonial_intents')) {
      const p = state.provisional.get(id), o = state.opportunities.get(id);
      return Response.json(p ? [{ id, kind: 'PROVISIONAL', remote_contact_id: p.contactId }] : o ? [{ id, kind: 'OPPORTUNITY', remote_opportunity_id: o.remote?.id, sync_state: 'SYNCED' }] : []);
    }
    if (url.pathname.endsWith('/patrimonial_domain_events')) return Response.json([{ event_key: 'fixture-event' }]);
    throw new Error('Unexpected Supabase endpoint');
  }
  assert.equal(url.origin, 'https://services.leadconnectorhq.com');
  if (url.pathname === '/contacts/fixture-search') return Response.json({ complete: true, contacts: [...http.people.values()].filter(c => c.email === url.searchParams.get('email')) });
  if (url.pathname === '/locations/fixture-location/tags') return Response.json({ complete: true, tags: Object.values(resources.tags).map(t => ({ ...t, locationId: 'fixture-location' })) });
  if (url.pathname === '/contacts/' && init.method === 'POST') { const c = await http.crm.upsertContact(body); return Response.json({ contact: c }); }
  if (url.pathname.endsWith('/tags')) { await http.crm.addTags('fixture-contact', body.tags); return Response.json({}); }
  if (url.pathname.endsWith('/notes')) { const note = await http.crm.addNote('fixture-contact', body.body); return Response.json(note); }
  if (url.pathname === '/contacts/fixture-contact') {
    if (init.method === 'DELETE') { await http.runtime.deleteContact('fixture-contact'); return new Response(null, { status: 204 }); }
    const c = http.people.get('fixture-contact'); return c ? Response.json({ contact: c }) : Response.json({}, { status: 404 });
  }
  if (url.pathname === '/opportunities/fixture-search') return Response.json({ complete: true, opportunities: [...http.opportunities.values()].filter(o => o.contactId === body.contactId && (!body.pipelineId || o.pipelineId === body.pipelineId)) });
  if (url.pathname === '/opportunities/' && init.method === 'POST') return Response.json({ opportunity: await http.runtime.opportunities.createOpportunity(body) });
  if (url.pathname === '/opportunities/fixture-opportunity') {
    if (init.method === 'DELETE') { await http.runtime.opportunities.deleteOpportunity('fixture-opportunity'); return new Response(null, { status: 204 }); }
    const o = http.opportunities.get('fixture-opportunity'); return o ? Response.json({ opportunity: o }) : Response.json({}, { status: 404 });
  }
  throw new Error('Unexpected HTTP path');
};
const throughHttp = options => runPatrimonialSmoke({ options, env: httpEnv, run: http.run, now: () => new Date(http.db.now),
  persist: async report => http.reports.push(report), runtimeFactory: ({ guard }) => createSmokeRuntime({ env: httpEnv, bindings, guard, fetchImpl: fakeHttp }) });
assert.equal((await throughHttp(mode('execute'))).result, 'PASS');
assert.equal((await throughHttp(mode('cleanup'))).result, 'PASS');
assert.equal(http.run.cleanup.contact, 'DELETED'); assert.equal(http.run.cleanup.opportunity, 'DELETED');
assert(httpCalls.some(c => c.method === 'DELETE')); assert(httpCalls.some(c => c.path.endsWith('/patrimonial_domain_events')));
passed.push('real runtime adapter exercised with verified fixture bindings and HTTP emulator; scoped audit reads and delete 404 handling');
const cli = readFileSync('scripts/run-patrimonial-live-smoke.mjs', 'utf8');
assert(cli.includes("'wx'")); assert(cli.includes('assertLiveSmoke(options, env)')); assert(cli.includes('import.meta.url ===')); assert(!/unlink|rmSync|readdir|\.env\.local/.test(cli));
assert.equal(getPatrimonialRemoteMapping({}).pipelines.ARCHITECT_PATH.stages.A01.funnel, 'ARCHITECT_PATH');
execFileSync('git', ['diff', '--exit-code', 'c61ed43d1a1811069cbf0ecc6c21498bea76c03d', '--', 'src', 'supabase', '.gitignore'], { stdio: 'pipe' });
assert.equal(externalCalls, 0);
console.log(passed.map(message => `PASS ${message}`).join('\n'));
console.log('Live smoke harness prepared and verified locally. Live CLI NOT executed; zero actual remote calls and zero tmp writes.');
