import assert from 'node:assert/strict';
import {assertPublicPilotPreservation} from './lib/patrimonial-public-preservation.mjs';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { FakePatrimonialSupabase } from './fixtures/patrimonial-supabase-transport.mjs';
import { SupabasePatrimonialStore } from '../src/lib/public-leads/patrimonial-supabase.ts';
import { patrimonialFlags } from '../src/lib/public-leads/patrimonial-store.ts';
import { getPatrimonialRemoteMapping } from '../src/lib/public-leads/patrimonial-highlevel-config.ts';
import { validatePatrimonialV2 } from '../src/lib/public-leads/patrimonial-funnels.ts';
import { createSmokeRuntime } from './lib/patrimonial-live-smoke-runtime.mjs';
import { createSmokeRun, parseSmokeArgs, publicSmokeReport, runPatrimonialSmoke, syntheticLead, assertSyntheticData, assertSmokeReport, simulateSmokeFailure, smokeMarkdown } from './lib/patrimonial-live-smoke.mjs';
import { parseSmokeBindingsMetadata, validSmokeReportPaths } from './lib/patrimonial-live-smoke-preflight.mjs';
import { createRealPatrimonialBindings, validateRealPatrimonialReadiness, realReadLabels } from './lib/patrimonial-live-smoke-bindings.mjs';
import { smokeEnvPresence } from './lib/patrimonial-live-smoke-env.mjs';
import { smokeContactUpsert, SmokeContactWriteError } from './lib/patrimonial-live-smoke-contact.mjs';
import { highLevelUpsertFixture } from './fixtures/highlevel-contact-upsert.mjs';
import { verifyPatrimonialOpportunityMigration } from './verify-patrimonial-opportunity-sql.mjs';
await verifyPatrimonialOpportunityMigration();

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
const dry = fixture(); assert.equal((await dry.invoke(parseSmokeArgs([]))).result, 'BLOCKED');
assert(dry.run.blockers.includes('HIGHLEVEL_PRIVATE_TOKEN missing')); assert.equal(dry.run.mappingReady, true);
assert.equal(dry.factories, 0); assert.equal(dry.db.calls.length, 0); assert.equal(dry.calls.length, 0); assert(dry.reports.length);
passed.push('1 dry-run checks readiness instead of returning NOT_RUN; missing config blocks with exact names; zero network');
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
const reportPaths = { directory: path.resolve('tmp'), json: path.resolve('tmp/patrimonial-live-smoke-fixture.json'), markdown: path.resolve('tmp/patrimonial-live-smoke-fixture.md') };
assert(validSmokeReportPaths(reportPaths));
let dryRuntimeCalls = 0, dryPersistCalls = 0;
const dryReports = [], dryEnv = { ...httpEnv, ...Object.fromEntries(Object.keys(flags).map(k => [k, 'false'])), PATRIMONIAL_DURABLE_STORE_READY: 'false' };
const dryCheck = (env = dryEnv, bindingMetadata = bindings, paths = reportPaths) => runPatrimonialSmoke({ options: parseSmokeArgs([]), env, run: fresh(),
  reportPaths: paths, preflightBindings: bindingMetadata, persist: async report => { dryPersistCalls++; dryReports.push(report); },
  runtimeFactory: () => { dryRuntimeCalls++; throw new Error('Dry-run cannot construct live runtime'); } });
const dryPass = await dryCheck();
assert.equal(dryPass.result, 'DRY_RUN_PASS');
for (const key of ['configReady', 'mappingReady', 'storeReady', 'providerBindingReady', 'syntheticGuardReady', 'reportPathReady']) assert.equal(dryPass[key], true, key);
assert.equal(dryPass.liveGuardsEnabled, false, 'Disabled flags are valid for dry-run; never enable them to validate configuration');
assert.equal(dryPass.storeHealthChecked, false); assert.equal(dryPass.writesAttempted, false); assert.deepEqual(dryPass.remoteReads, []);
assert.equal(dryReports.at(-1).mode, 'DRY_RUN'); assert.equal(dryReports.at(-1).status, 'PASS'); assert.equal(dryRuntimeCalls, 0);
for (const name of ['HIGHLEVEL_LOCATION_ID', 'HIGHLEVEL_PRIVATE_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY']) {
  const env = { ...dryEnv }; delete env[name]; const report = await dryCheck(env);
  assert.equal(report.result, 'BLOCKED'); assert(report.blockers.includes(`${name} missing`));
}
const noUrl = { ...dryEnv }; delete noUrl.SUPABASE_URL;
assert((await dryCheck(noUrl)).blockers.includes('SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL missing'));
assert.equal((await dryCheck({ ...noUrl, NEXT_PUBLIC_SUPABASE_URL: 'https://patrimonial.invalid' })).storeReady, true);
assert.equal((await dryCheck({ ...dryEnv, SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_URL: 'https://patrimonial.invalid' })).storeReady, false, 'Present empty server URL does not use fallback');
for (const changes of [{ SUPABASE_URL: 'https://invalid.example/path' }, { SUPABASE_SERVICE_ROLE_KEY: 'sb_publishable_fixture' }, { HIGHLEVEL_LOCATION_ID: 'bad/location' }, { HIGHLEVEL_PRIVATE_TOKEN: 'bad\ntoken' }, { PATRIMONIAL_SYNTHETIC_TEST_ENABLED: 'yes' }]) assert.equal((await dryCheck({ ...dryEnv, ...changes })).result, 'BLOCKED');
const dryMapping = await dryCheck({ ...dryEnv, PATRIMONIAL_HIGHLEVEL_REMOTE_IDS_JSON: '{"stages":{"A01":""}}' });
assert.equal(dryMapping.result, 'BLOCKED'); assert.equal(dryMapping.mappingReady, false);
const dryNoBindings = await dryCheck(dryEnv, null); assert.equal(dryNoBindings.providerBindingReady, false); assert(dryNoBindings.blockers.includes('--bindings missing'));
const incompleteBindings = { ...bindings, opportunities: { ...bindings.opportunities, create: null } };
assert((await dryCheck(dryEnv, incompleteBindings)).blockers.includes('bindings.opportunities.create missing or invalid'));
const invalidPath = await dryCheck(dryEnv, bindings, { ...reportPaths, markdown: path.resolve('outside.md') });
assert.equal(invalidPath.reportPathReady, false); assert.equal(invalidPath.result, 'BLOCKED');
const pureMetadata = parseSmokeBindingsMetadata('export const bindings = { verified: true, locationId: process.env.HIGHLEVEL_LOCATION_ID, request: () => { throw new Error("never execute"); } };', dryEnv);
assert.equal(pureMetadata.locationId, 'fixture-location'); assert.equal(typeof pureMetadata.request, 'function');
for (const source of ['globalThis.fetch("https://invalid.example"); export const bindings = {};', 'import x from "./unreviewed.mjs"; export const bindings = x;', 'export const bindings = makeBindings();', 'export const bindings = { get verified() { throw new Error(); } };']) assert.throws(() => parseSmokeBindingsMetadata(source, dryEnv));
const dryRedacted = publicSmokeReport({ ...dryPass, error: 'fixture-secret', blockers: ['fixture-token'] }, dryEnv);
const dryText = JSON.stringify(dryRedacted) + smokeMarkdown(dryRedacted);
assert(!dryText.includes('fixture-secret')); assert(!dryText.includes('fixture-token'));
assert.equal(dryRuntimeCalls, 0); assert(dryPersistCalls > 0); assert.equal(httpCalls.length, 0); assert.equal(http.db.calls.length, 0);
passed.push('dry-run complete config → DRY_RUN_PASS; specific env/mapping/binding/path blockers; report redacted; zero provider writes or Supabase mutations');
passed.push('binding metadata parsed without import/eval or function invocation; disabled flags remain unchanged; store readiness is configuration only');
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

// Official real alias, with documented wire responses and a fake transport.
// Fixtures never load the workstation's secret file or send native fetches.
const realBindings = createRealPatrimonialBindings(dryEnv), readinessCalls = [];
let failReadiness = null;
const remoteReadFixture = async (value, init) => {
  const url = new URL(value); readinessCalls.push({ pathname: url.pathname, method: init.method });
  assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store');
  if (url.hostname === 'patrimonial.invalid') {
    assert.equal(url.pathname, '/rest/v1/rpc/patrimonial_store_health'); assert.equal(init.body, '{}');
    return Response.json({ version: failReadiness === 'health' ? 'wrong' : 'patrimonial-v2-store-1' });
  }
  assert.equal(init.method, 'GET', 'dry-run HighLevel transport cannot write');
  assert.equal(url.origin, 'https://services.leadconnectorhq.com'); assert.equal(init.headers.Version, '2021-07-28');
  if (url.pathname === '/locations/fixture-location') return Response.json({ location: { id: failReadiness === 'location' ? 'foreign' : 'fixture-location', settings: { allowDuplicateContact: false } } });
  if (url.pathname === '/opportunities/pipelines') return Response.json({ pipelines: Object.values(resources.pipelines).map(p => ({ id: p.id, stages: Object.values(p.stages) })) });
  if (url.pathname.endsWith('/tags')) return Response.json({ tags: Object.values(resources.tags).map(t => ({ ...t, locationId: 'fixture-location', ...(failReadiness === 'mapping' ? { name: 'wrong' } : {}) })) });
  if (url.pathname.endsWith('/customFields')) {
    const model = url.searchParams.get('model');
    return Response.json({ customFields: Object.values(resources[model === 'contact' ? 'contactFields' : 'opportunityFields']).map(f => ({ ...f, model, locationId: 'fixture-location' })) });
  }
  if (url.pathname === '/contacts/') return Response.json(failReadiness === 'identity' ? { contacts: [{ id: 'existing', locationId: 'fixture-location', email: syntheticLead(data).email }], count: 1 } : { contacts: [], count: 0 });
  throw new Error('Unexpected readonly endpoint');
};
const realDry = () => runPatrimonialSmoke({ options: parseSmokeArgs(['--dry-run', '--bindings', 'real']), env: dryEnv, run: fresh(), reportPaths,
  preflightBindings: realBindings, validateRemote: () => validateRealPatrimonialReadiness({ env: dryEnv, lead: syntheticLead(data), fetchImpl: remoteReadFixture }) });
const realPass = await realDry(); assert.equal(realPass.result, 'DRY_RUN_PASS');
for (const key of ['storeReady', 'mappingReady', 'providerBindingReady', 'storeHealthChecked']) assert.equal(realPass[key], true);
assert.equal(realPass.writesAttempted, false); assert.equal(realPass.storeReadinessScope, 'REMOTE_HEALTH');
assert.deepEqual(publicSmokeReport(realPass, dryEnv).remoteReads, realReadLabels);
for (const [fail, blocker, callCount] of [['health', 'SUPABASE_STORE_HEALTH_FAILED', 1], ['location', 'HIGHLEVEL_LOCATION_MISMATCH', 2],
  ['mapping', 'HIGHLEVEL_TAG_MAPPING_MISMATCH', 4], ['identity', 'UNEXPECTED_EXISTING_SYNTHETIC_IDENTITY', 7]]) {
  failReadiness = fail; readinessCalls.length = 0;
  const blocked = await realDry(); assert.equal(blocked.result, 'BLOCKED'); assert.deepEqual(blocked.blockers, [blocker]); assert.equal(readinessCalls.length, callCount);
}
failReadiness = null; readinessCalls.length = 0;
const noRealEnv = await runPatrimonialSmoke({ options: parseSmokeArgs([]), env: {}, reportPaths, preflightBindings: realBindings,
  validateRemote: () => { throw new Error('Missing local configuration must not reach network'); } });
assert.equal(noRealEnv.result, 'BLOCKED'); assert.equal(readinessCalls.length, 0);
for (const body of [{ contacts: [], count: 1 }, { contacts: [] }]) assert.throws(() => realBindings.contacts.bindings.email.decode(body));
assert.throws(() => realBindings.opportunities.search.decode({ opportunities: [], meta: { total: 1 } }));
const pageContact = { id: 'fixture-contact', locationId: 'fixture-location', firstName: 'Horyzon', lastName: 'Synthetic Test', email: 'page@example.invalid', phone: null };
const navigation = { nextPageUrl: 'https://services.leadconnectorhq.com/contacts/?next=2', nextPage: '2' };
const contactPage = (rows, total, meta = {}) => ({ contacts: rows, meta: { total, ...navigation, ...meta } });
const decodeContactPage = body => realBindings.contacts.bindings.email.decode(body);
assert.equal(decodeContactPage(contactPage([pageContact], 1)).complete, true, 'A exact total 1 with navigation is complete');
assert.equal(decodeContactPage(contactPage([], 0)).complete, true, 'B exact total 0 with navigation is complete');
assert.throws(() => decodeContactPage(contactPage([pageContact], 2)), 'C missing row rejected');
assert.throws(() => decodeContactPage(contactPage(Array(100).fill(pageContact), 101)), 'D 100/101 rejected');
assert.throws(() => decodeContactPage({ contacts: [], meta: navigation }), 'E unknown total with navigation rejected');
assert.throws(() => decodeContactPage(contactPage([pageContact], 0)), 'F rows exceeding total rejected');
const pageOpportunity = { id: 'fixture-opportunity', locationId: 'fixture-location', contactId: pageContact.id,
  pipelineId: resources.pipelines.ARCHITECT_PATH.id, pipelineStageId: resources.pipelines.ARCHITECT_PATH.stages.A01.id,
  status: 'open', updatedAt: '2026-10-15T10:20:55.564Z', customFields: [] };
assert.equal(realBindings.opportunities.search.decode({ opportunities: [pageOpportunity], meta: { total: 1, ...navigation } }).complete, true, 'G exact opportunity total with navigation is complete');
for (const total of [undefined, null, -1, 1.5, '1', NaN, Infinity]) assert.throws(() => decodeContactPage(contactPage([pageContact], total)));
assert.throws(() => decodeContactPage(contactPage(Array(101).fill(pageContact), 101)), 'rows over requested limit rejected');
assert.throws(() => decodeContactPage({ ...contactPage([pageContact], 1), count: 2 }), 'conflicting totals rejected');
for (const evidence of [{ meta: { total: 1, hasMore: true } }, { hasMore: true }, { meta: { total: 1, hasNextPage: true } }, { hasNextPage: true }]) {
  assert.throws(() => decodeContactPage({ ...contactPage([pageContact], 1), ...evidence }), 'explicit evidence of additional records rejected');
}
for (const [rows, total] of [[[], 1], [[pageOpportunity], 2], [Array(100).fill(pageOpportunity), 101], [[pageOpportunity], 0], [Array(101).fill(pageOpportunity), 101]]) {
  assert.throws(() => realBindings.opportunities.search.decode({ opportunities: rows, meta: { total, ...navigation } }));
}
assert.throws(() => realBindings.opportunities.search.decode({ opportunities: [], meta: navigation }));
assert.equal(decodeContactPage({ contacts: [pageContact], count: 1, nextPageUrl: navigation.nextPageUrl }).complete, true, 'documented count fallback remains valid');
passed.push('complete search pages A–G: trustworthy totals override navigation hints; partial/unknown/invalid/conflicting totals, overflow and explicit more-record evidence stay rejected for contacts/opportunities');
assert.throws(() => realBindings.contactDelete.request('../foreign'));
assert.equal(realBindings.contacts.bindings.create.request(syntheticLead(data), 'fixture-location').body.dnd, true);
assert.throws(() => realBindings.contacts.bindings.create.request({ ...syntheticLead(data), email: 'real@example.com' }, 'fixture-location'));
const bindingText = JSON.stringify(publicSmokeReport({ ...realPass, remoteReads: [...realReadLabels, 'fixture-token'], blockers: ['fixture-secret'] }, dryEnv));
assert(!bindingText.includes('fixture-token')); assert(!bindingText.includes('fixture-secret'));
passed.push('real alias readonly preflight: actual health, location, all mapping resources and fresh synthetic identity; immediate fail-closed blockers; zero mutation');

// Provider-error fixtures, not captured live bodies. Only cleanup's nullable
// GET of this exact contact may normalize a clearly identified 400 absence.
const contactAbsent400 = (id = 'fixture-contact') => ({ message: `Contact with id ${id} not found`, error: 'Bad Request', statusCode: 400 });
const nullableCalls = [];
const nullableRuntime = (response, bound = createRealPatrimonialBindings(httpEnv)) => createSmokeRuntime({ env: httpEnv, bindings: bound, guard() {},
  fetchImpl: async (url, init) => { nullableCalls.push({ path: new URL(url).pathname, method: init.method }); return response(); } });
assert.equal(await nullableRuntime(() => new Response(null, { status: 404 })).readContact('fixture-contact'), null, 'A nullable contact 404 is absent');
for (const body of [contactAbsent400(), { message: 'Contact not found' }, { message: 'Resource not found', statusCode: 400 },
  { message: 'Contact does not exist.' }, { message: 'Contact with id "fixture-contact" not found' }]) {
  assert.equal(await nullableRuntime(() => Response.json(body, { status: 400 })).readContact('fixture-contact'), null, 'B explicit contact/resource-not-found 400 is absent');
}
for (const body of [{}, null, [], { message: 'Bad Request' }, { message: 'Contact field not found' },
  { message: 'Contact not found; invalid location' }, contactAbsent400('other-contact'), contactAbsent400('FIXTURE-CONTACT'),
  { message: ['Contact not found'] }, { message: 'Contact not found', statusCode: 500 }]) {
  await assert.rejects(nullableRuntime(() => Response.json(body, { status: 400 })).readContact('fixture-contact'),
    error => error.code === 'PROVIDER' && error.status === 400 && !error.outcomeUncertain, 'C generic/ambiguous/inconsistent/foreign-ID 400 remains an error');
}
await assert.rejects(nullableRuntime(() => new Response('{broken', { status: 400 })).readContact('fixture-contact'), error => error.code === 'PROVIDER' && error.status === 400);
for (const [status, code] of [[401, 'AUTH'], [500, 'PROVIDER']]) {
  await assert.rejects(nullableRuntime(() => Response.json(contactAbsent400(), { status })).readContact('fixture-contact'),
    error => error.code === code && error.status === status, 'D/E auth/server errors remain errors');
}
await assert.rejects(nullableRuntime(() => Response.json({ message: 'Resource not found' }, { status: 400 })).opportunities.getOpportunity('fixture-opportunity'),
  error => error.code === 'PROVIDER' && error.status === 400, 'F opportunity 400 is never normalized');
await assert.rejects(nullableRuntime(() => Response.json(contactAbsent400(), { status: 400 })).crm.getContact('fixture-contact'),
  error => error.code === 'SCHEMA' && error.status === 400, 'application/non-nullable contact read unchanged');
await assert.rejects(nullableRuntime(() => Response.json(contactAbsent400(), { status: 400 })).deleteContact('fixture-contact'),
  error => error.code === 'PROVIDER' && error.status === 400 && error.outcomeUncertain, 'DELETE 400 is not normalized');
for (const suffix of ['/notes', '?invalid=true']) {
  const bound = createRealPatrimonialBindings(httpEnv);
  bound.contacts.bindings.contact.request = id => ({ method: 'GET', path: `/contacts/${id}${suffix}` });
  await assert.rejects(nullableRuntime(() => Response.json(contactAbsent400(), { status: 400 }), bound).readContact('fixture-contact'),
    error => error.code === 'PROVIDER' && error.status === 400, 'only exact contact detail endpoint is eligible');
}
assert(nullableCalls.every(call => ['GET', 'DELETE'].includes(call.method))); // All transports above are injected fakes.
passed.push('nullable contact A–F: 404/explicit 400 absence only for exact cleanup GET; generic/malformed/foreign-ID 400, auth/server, opportunities, non-nullable reads and deletes fail closed');

const real = fixture(), realHttpCalls = [];
const wireOpportunity = row => row && ({ ...row, updatedAt: '2026-10-15T00:00:00.000Z', customFields: Object.entries(row.customFields).map(([id, fieldValue]) => ({ id, fieldValue })) });
const realHttp = async (value, init) => {
  const url = new URL(value), body = init.body ? JSON.parse(init.body) : {};
  realHttpCalls.push({ method: init.method, path: url.pathname });
  if (url.hostname === 'patrimonial.invalid') {
    if (url.pathname.includes('/rpc/')) return real.db.fetch(value, init);
    const r = real.run;
    if (url.pathname.endsWith('/patrimonial_intents')) return Response.json(url.searchParams.get('id') === `eq.${r.provisionalId}`
      ? [{ id: r.provisionalId, kind: 'PROVISIONAL', remote_contact_id: r.contactId }]
      : [{ id: r.intentId, kind: 'OPPORTUNITY', remote_opportunity_id: r.opportunityId, sync_state: 'SYNCED' }]);
    if (url.pathname.endsWith('/patrimonial_domain_events')) return Response.json([{ event_key: 'fixture-event' }]);
  }
  if (url.pathname.endsWith('/tags') && init.method === 'GET') return remoteReadFixture(value, init);
  if (url.pathname === '/contacts/' && init.method === 'GET') {
    const contacts = [...real.people.values()].filter(c => c.email === url.searchParams.get('query'));
    return Response.json({ contacts, meta: { total: contacts.length, ...navigation } });
  }
  if (url.pathname === '/contacts/upsert' && init.method === 'POST') {
    assert.deepEqual(Object.keys(body).sort(), ['locationId', 'firstName', 'lastName', 'email'].sort());
    assert(!Object.hasOwn(body, 'phone'));
    const contact = await real.crm.upsertContact(body);
    return Response.json({ new: true, contact, traceId: 'fixture-trace' });
  }
  if (url.pathname === '/contacts/fixture-contact') {
    if (init.method === 'DELETE') { await real.runtime.deleteContact('fixture-contact'); return new Response(null, { status: 204 }); }
    const contact = await real.crm.getContact('fixture-contact'); return contact ? Response.json({ contact }) : Response.json(contactAbsent400(), { status: 400 });
  }
  if (url.pathname === '/contacts/fixture-contact/tags') { await real.crm.addTags('fixture-contact', body.tags); return Response.json({}); }
  if (url.pathname === '/contacts/fixture-contact/notes') {
    if (init.method === 'GET') return Response.json({ notes: real.notes });
    return Response.json({ note: await real.crm.addNote('fixture-contact', body.body) });
  }
  if (url.pathname === '/opportunities/search') {
    const rows = [...real.opportunities.values()].filter(o => o.contactId === url.searchParams.get('contact_id') && (!url.searchParams.has('pipeline_id') || o.pipelineId === url.searchParams.get('pipeline_id')));
    return Response.json({ opportunities: rows.map(wireOpportunity), meta: { total: rows.length, ...navigation } });
  }
  if (url.pathname === '/opportunities/' && init.method === 'POST') {
    assert(body.name.startsWith('SYNTHETIC TEST ')); assert.equal(body.customFields.length, 12);
    return Response.json({ opportunity: wireOpportunity(await real.runtime.opportunities.createOpportunity({ ...body, customFields: Object.fromEntries(body.customFields.map(f => [f.id, f.field_value])) })) });
  }
  if (url.pathname === '/opportunities/fixture-opportunity') {
    if (init.method === 'DELETE') { await real.runtime.opportunities.deleteOpportunity('fixture-opportunity'); return new Response(null, { status: 204 }); }
    const row = await real.runtime.opportunities.getOpportunity('fixture-opportunity'); return row ? Response.json({ opportunity: wireOpportunity(row) }) : new Response(null, { status: 404 });
  }
  throw new Error('Unexpected real binding endpoint');
};
const throughReal = options => runPatrimonialSmoke({ options, env: httpEnv, run: real.run, now: () => new Date(real.db.now),
  persist: async report => real.reports.push(report), runtimeFactory: ({ guard }) => createSmokeRuntime({ env: httpEnv, bindings: createRealPatrimonialBindings(httpEnv), guard, fetchImpl: realHttp }) });
assert.equal((await throughReal(mode('execute'))).result, 'PASS');
assert.equal(real.run.verification.note, 'PASS'); assert.equal(real.notes.length, 1); assert.equal(real.people.size, 1); assert.equal(real.opportunities.size, 1);
const writesBeforeVerify = realHttpCalls.filter(c => c.method !== 'GET' && !c.path.includes('/rpc/')).length;
assert.equal((await throughReal(mode('verify'))).result, 'PASS'); assert.equal(realHttpCalls.filter(c => c.method !== 'GET' && !c.path.includes('/rpc/')).length, writesBeforeVerify);
// Resume an execute report that failed only at the final readonly search. The
// source report is immutable, no source file is loaded, and no live CLI is run.
const failedSource = { ...structuredClone(real.run), mode: 'execute', result: 'FAIL', error: 'CRM_SCHEMA', verification: {} };
const originalSource = structuredClone(failedSource), beforeResume = real.db.inspect(), beforeResumeCalls = realHttpCalls.length, beforeResumeRpc = real.db.calls.length;
const resumed = await runPatrimonialSmoke({ options: parseSmokeArgs(['--verify', '--bindings', 'real', '--report', 'tmp/patrimonial-live-smoke-fixture.json']),
  env: httpEnv, run: structuredClone(failedSource), now: () => new Date(real.db.now), persist: async () => {},
  runtimeFactory: ({ guard }) => createSmokeRuntime({ env: httpEnv, bindings: createRealPatrimonialBindings(httpEnv), guard, fetchImpl: realHttp }) });
assert.equal(resumed.result, 'PASS'); assert.equal(resumed.requestId, failedSource.requestId); assert.equal(resumed.runId, failedSource.runId);
assert.deepEqual(failedSource, originalSource); assert.deepEqual(real.db.inspect(), beforeResume);
assert(realHttpCalls.slice(beforeResumeCalls).filter(c => !c.path.includes('/rpc/')).every(c => c.method === 'GET'));
assert(real.db.calls.slice(beforeResumeRpc).every(c => !c.body.p_commands || c.body.p_commands.every(command => ['getRequest', 'getConsentEvidence', 'getOperation', 'getOpportunityIntent'].includes(command.method))));
passed.push('failed execute report with executed/replay/IDs resumes verify using same identity, no report edits, only read RPC commands/GETs and unchanged durable state');
const auditBeforeCleanup = real.db.inspect(), beforeCleanupCalls = realHttpCalls.length;
assert.equal((await throughReal(mode('cleanup'))).result, 'PASS'); assert.equal(real.run.cleanup.contact, 'DELETED'); assert.equal(real.run.cleanup.opportunity, 'DELETED');
assert.deepEqual(real.db.inspect(), auditBeforeCleanup, 'cleanup preserves all durable audit and historical remote IDs');
assert.deepEqual(realHttpCalls.slice(beforeCleanupCalls).filter(call => call.method === 'DELETE').map(call => call.path), ['/opportunities/fixture-opportunity', '/contacts/fixture-contact']);
passed.push('real wire bindings complete local execute/replay/verify/notes/12 custom fields/controlled cleanup through existing durable store and CRM adapters');
// Historical cleanup failure equivalent: both assets already absent, opportunity
// confirmed deleted, contact checkpoint not saved after the old 400 read-back.
const cleanupSource = { ...structuredClone(failedSource), mode: 'cleanup', result: 'FAIL', error: 'CRM_PROVIDER',
  cleanup: { opportunity: 'DELETED', contact: 'NOT_REQUESTED', audit: 'PRESERVED' } };
const originalCleanupSource = structuredClone(cleanupSource), beforeAbsentCalls = realHttpCalls.length;
const absentCleanup = await runPatrimonialSmoke({ options: mode('cleanup'), env: httpEnv, run: structuredClone(cleanupSource),
  now: () => new Date(real.db.now), persist: async () => {},
  runtimeFactory: ({ guard }) => createSmokeRuntime({ env: httpEnv, bindings: createRealPatrimonialBindings(httpEnv), guard, fetchImpl: realHttp }) });
assert.equal(absentCleanup.result, 'PASS'); assert.equal(absentCleanup.cleanup.contact, 'ALREADY_ABSENT'); assert.equal(absentCleanup.cleanup.opportunity, 'ALREADY_ABSENT');
assert.equal(absentCleanup.requestId, cleanupSource.requestId); assert.equal(absentCleanup.runId, cleanupSource.runId);
assert.deepEqual(cleanupSource, originalCleanupSource); assert.deepEqual(real.db.inspect(), auditBeforeCleanup);
assert(realHttpCalls.slice(beforeAbsentCalls).filter(call => !call.path.includes('/rpc/')).every(call => call.method === 'GET'));
passed.push('deleted-contact 400 read-back yields DELETED/PASS; historical cleanup checkpoint equivalent yields ALREADY_ABSENT/PASS without new deletes, source report edits or audit changes');

// Upsert contract and error boundaries, entirely in-memory. No live CLI retry.
const upsertInput = syntheticLead(fresh()), upsert = createRealPatrimonialBindings(httpEnv).contacts.upsert;
assert.equal(upsertInput.email.split('@')[0].length, 53);
const legacyRun = { ...fresh(), version: 'patrimonial-live-smoke-1' };
assertSmokeReport(legacyRun); assert.equal(syntheticLead(legacyRun).email.split('@')[0].length, 67, 'old report identity preserved');
assert.throws(() => upsert.request(syntheticLead(legacyRun), 'fixture-location'), 'legacy overlong input refused before write');
const spec = upsert.request({ ...upsertInput, phone: '', tags: ['foreign'], source: 'foreign', customFields: { bad: 'bad' } }, 'fixture-location');
assert.deepEqual(spec, { method: 'POST', path: '/contacts/upsert', body: { locationId: 'fixture-location', firstName: 'Horyzon', lastName: 'Synthetic Test', email: upsertInput.email } });
let upsertCalls = 0;
const contactCall = (fetchImpl, input = upsertInput, getContact = async () => highLevelUpsertFixture(input).contact) => smokeContactUpsert({ input, env: httpEnv, binding: upsert, guard() {}, getContact,
  fetchImpl: async (url, init) => {
    upsertCalls++; assert.equal(url, 'https://services.leadconnectorhq.com/contacts/upsert');
    assert.equal(init.method, 'POST'); assert.equal(init.headers.Version, '2021-07-28'); assert.equal(init.headers.Authorization, 'Bearer fixture-token');
    assert.equal(init.headers['Content-Type'], 'application/json'); assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store'); assert(init.signal);
    assert(!Object.hasOwn(JSON.parse(init.body), 'phone')); return fetchImpl(url, init);
  } });
for (const created of [true, false]) {
  const result = await contactCall(() => Response.json(highLevelUpsertFixture(upsertInput, created)));
  assert.equal(result.id, 'fixture-contact'); assert.equal(result.disposition, created ? 'CREATED' : 'REUSED_UPDATED');
  assert.equal(result.contactDiagnostic.phase, 'CONFIRMED'); assert.equal(result.contactDiagnostic.outcomeUncertain, false);
}
let hydrateCalls = 0;
assert.equal((await contactCall(() => Response.json({ new: true, contact: { id: 'fixture-contact' } }), upsertInput,
  async id => { hydrateCalls++; assert.equal(id, 'fixture-contact'); return highLevelUpsertFixture(upsertInput).contact; })).id, 'fixture-contact');
assert.equal(hydrateCalls, 1, '2xx minimal response is read back, not rejected because fake/full shape differs');
for (const [status, code, uncertain] of [[400, 'SCHEMA', false], [401, 'AUTH', false], [403, 'AUTH', false], [422, 'SCHEMA', false], [429, 'RATE_LIMIT', false], [500, 'PROVIDER', true]]) {
  const callsBefore = upsertCalls;
  await assert.rejects(contactCall(() => Response.json({ message: 'fixture-secret raw validation body' }, { status, headers: { 'retry-after': '60' } })), error => {
    assert(error instanceof SmokeContactWriteError); assert.equal(error.code, code); assert.equal(error.status, status); assert.equal(error.outcomeUncertain, uncertain);
    assert.equal(error.contactDiagnostic.phase, 'HTTP_RESPONSE'); assert(!JSON.stringify(error).includes('raw validation body')); return true;
  });
  assert.equal(upsertCalls, callsBefore + 1, 'transport never retries');
}
await assert.rejects(contactCall(async () => { throw new DOMException('fixture-secret', 'TimeoutError'); }), error => error.code === 'NETWORK' && error.outcomeUncertain);
await assert.rejects(contactCall(() => new Response('{broken', { status: 200 })), error => error.code === 'SCHEMA' && error.outcomeUncertain);
const callsBeforeInvalid = upsertCalls;
await assert.rejects(contactCall(() => { throw new Error('must not dispatch'); }, { ...upsertInput, email: 'real@example.com' }), error => error.code === 'SCHEMA' && !error.outcomeUncertain && !error.contactDiagnostic.writeDispatched);
assert.equal(upsertCalls, callsBeforeInvalid);
const timeoutRun = fixture();
timeoutRun.crm.upsertContact = input => contactCall(async () => { throw new DOMException('fixture-secret', 'TimeoutError'); }, input);
await timeoutRun.invoke(); assert.equal(timeoutRun.run.effects.UPSERT_CONTACT, 'RECONCILE_REQUIRED');
assert.equal(timeoutRun.run.contactDiagnostic.phase, 'DISPATCH'); assert.equal(timeoutRun.run.contactDiagnostic.httpStatus, null);
assert.equal(timeoutRun.db.inspect().operations.get(timeoutRun.run.operations.UPSERT_CONTACT).lastErrorCode, 'NETWORK');
let guardedSends = 0, guardCalls = 0;
await assert.rejects(smokeContactUpsert({ input: upsertInput, env: httpEnv, binding: upsert, getContact() {},
  guard() { if (++guardCalls === 2) throw new Error('local guard stopped'); }, fetchImpl: () => { guardedSends++; } }),
error => error.code === 'CONFIG' && !error.outcomeUncertain && !error.contactDiagnostic.writeDispatched);
assert.equal(guardedSends, 0);
const checkpointLost = fixture(), completeBefore = checkpointLost.store.completeCrmOperation.bind(checkpointLost.store);
checkpointLost.store.completeCrmOperation = async input => {
  if (input.operationId === checkpointLost.run.operations.UPSERT_CONTACT) throw new Error('checkpoint unavailable');
  return completeBefore(input);
};
checkpointLost.store.failOperation = async () => { throw new Error('checkpoint still unavailable'); };
await checkpointLost.invoke(); assert.equal(checkpointLost.run.effects.UPSERT_CONTACT, 'RECONCILE_REQUIRED');
assert.equal(checkpointLost.people.size, 1); assert.equal(checkpointLost.run.contactId, 'fixture-contact');
await checkpointLost.invoke(); assert.equal(checkpointLost.people.size, 1, 'lost checkpoint never repeats contact write');
for (const [status, state, code] of [[400, 'MANUAL_REVIEW', 'SCHEMA'], [401, 'MANUAL_REVIEW', 'AUTH'], [403, 'MANUAL_REVIEW', 'AUTH'], [429, 'RETRY_SCHEDULED', 'RATE_LIMIT'], [500, 'RECONCILE_REQUIRED', 'PROVIDER']]) {
  const ctx = fixture();
  ctx.crm.upsertContact = input => contactCall(() => Response.json({ ignored: 'fixture-secret' }, { status }), input);
  const result = await ctx.invoke(); assert.equal(result.result, 'FAIL'); assert.equal(result.effects.UPSERT_CONTACT, state);
  const operation = ctx.db.inspect().operations.get(ctx.run.operations.UPSERT_CONTACT);
  assert.equal(operation.lastErrorCode, code); assert.equal(operation.reconcileRequired, state === 'RECONCILE_REQUIRED');
  assert.equal(publicSmokeReport(result, httpEnv).effects.UPSERT_CONTACT, state); assert.equal(result.error, `CRM_${code}`);
}
const localSchema = fixture();
localSchema.crm.upsertContact = input => contactCall(() => { throw new Error('never'); }, { ...input, email: 'real@example.com' });
await localSchema.invoke(); assert.equal(localSchema.run.effects.UPSERT_CONTACT, 'MANUAL_REVIEW'); assert.equal(localSchema.db.inspect().operations.get(localSchema.run.operations.UPSERT_CONTACT).lastErrorCode, 'SCHEMA');
const reuse = fixture();
reuse.crm.upsertContact = input => contactCall(() => Response.json(highLevelUpsertFixture(input, false)), input);
await reuse.invoke(); assert.equal(reuse.run.contactId, 'fixture-contact'); assert.equal(reuse.run.contactCreatedByRun, false);
assert.equal(reuse.run.contactDisposition, 'REUSED_UPDATED'); assert.equal(reuse.run.effects.UPSERT_CONTACT, 'MANUAL_REVIEW'); assert(!reuse.calls.some(c => c.name.startsWith('delete')));
const diagnosticReport = publicSmokeReport({ ...reuse.run, contactDiagnostic: { phase: 'HTTP_RESPONSE', httpStatus: 400, code: 'SCHEMA', elapsedMs: 10,
  writeDispatched: true, outcomeUncertain: false, rawBody: 'must-not-appear', headers: 'fixture-token' } }, httpEnv);
assert(!JSON.stringify(diagnosticReport).includes('must-not-appear')); assert(!JSON.stringify(diagnosticReport).includes('fixture-token'));
passed.push('upsert documented 2xx new/reuse/minimal responses; 400/401/403 deterministic; 429 scheduled only; 500/timeout ambiguous; local schema zero send; safe diagnostics; no source/tag/custom-field overwrite');

// Isolated process tests @next/env precedence using an injected in-memory file.
// The actual secret file is never opened, changed or echoed by tests.
execFileSync(process.execPath, ['--input-type=module', '-e', `
  import assert from 'node:assert/strict';
  import { loadSmokeEnv, smokeEnvPresence } from './scripts/lib/patrimonial-live-smoke-env.mjs';
  process.env.SMOKE_FIXTURE_PRECEDENCE = 'process';
  process.env.SMOKE_FIXTURE_EMPTY = '';
  await loadSmokeEnv({ read: async () => 'SMOKE_FIXTURE_PRECEDENCE=file\\nSMOKE_FIXTURE_EMPTY=file\\nSMOKE_FIXTURE_NEW=file' });
  assert.equal(process.env.SMOKE_FIXTURE_PRECEDENCE, 'process');
  assert.equal(process.env.SMOKE_FIXTURE_EMPTY, '');
  assert.equal(process.env.SMOKE_FIXTURE_NEW, 'file');
  assert(Object.values(smokeEnvPresence({})).every(v => v === 'MISSING'));
`], { stdio: 'pipe' });
assert.equal(smokeEnvPresence({ SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_URL: 'https://fallback.invalid' })['SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL'], 'MISSING');
passed.push('Next env loader uses only injected local file; process values including empty win; presence diagnostics reveal no values');
const cli = readFileSync('scripts/run-patrimonial-live-smoke.mjs', 'utf8');
assert(cli.includes("'wx'")); assert(cli.includes('assertLiveSmoke(options, env)')); assert(cli.includes('import.meta.url ===')); assert(!/unlink|rmSync|readdir|\.env\.local/.test(cli));
assert.equal(getPatrimonialRemoteMapping({}).pipelines.ARCHITECT_PATH.stages.A01.funnel, 'ARCHITECT_PATH');
assertPublicPilotPreservation('33724abcfc04ebf6b073f14cf5039948a83a4cb4',['src','.gitignore','supabase']);
const changedSqlPaths = execFileSync('git', ['diff', '--name-only', '33724abcfc04ebf6b073f14cf5039948a83a4cb4', '--', 'supabase'], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
const reviewedSql=JSON.parse(readFileSync('scripts/fixtures/patrimonial-foundation-source-manifest.json','utf8'));
assert(changedSqlPaths.every(p => reviewedSql[p]), 'only pinned additive 5A migrations; historical migrations and Supabase config unchanged');
assert.equal(externalCalls, 0);
console.log(passed.map(message => `PASS ${message}`).join('\n'));
console.log('Live smoke harness prepared and verified locally. Live CLI NOT executed; zero actual remote calls and zero tmp writes.');
