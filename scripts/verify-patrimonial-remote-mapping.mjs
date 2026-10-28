import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  getPatrimonialRemoteMapping, validatePatrimonialRemoteMapping,
  createPatrimonialRemotePipelineMapping, patrimonialContactCustomFieldIds,
  patrimonialEventFieldsInventoryOnly, PatrimonialMappingConfigError,
} from '../src/lib/public-leads/patrimonial-highlevel-config.ts';
import { createConfiguredPatrimonialHighLevelProvider, PatrimonialCrmError } from '../src/lib/public-leads/patrimonial-highlevel.ts';
import { patrimonialFlags } from '../src/lib/public-leads/patrimonial-store.ts';

// No environment file is loaded and no real fetch is retained, even for tests
// which explicitly enable flags against the injected in-process transport.
let externalCalls = 0;
globalThis.fetch = async () => { externalCalls++; throw new Error('Remote calls forbidden'); };
const passed = [], mapping = getPatrimonialRemoteMapping({});
const ready = validatePatrimonialRemoteMapping(mapping);
assert.equal(ready.remoteMappingReady, true);
assert.deepEqual(ready.counts, { pipelines: 3, stages: 20, tags: 4, contactFields: 4, opportunityFields: 29 });
const ids = [
  ...Object.values(mapping.pipelines).flatMap(p => [p.id, ...Object.values(p.stages).map(s => s.id)]),
  ...['tags', 'contactFields', 'opportunityFields'].flatMap(section => Object.values(mapping[section]).map(f => f.id)),
].sort();
assert.equal(new Set(ids).size, 60);
// Pinned against all 60 IDs in the user-supplied 2026-10-15 resource report.
assert.equal(createHash('sha256').update(ids.join('\n')).digest('hex'), '054be9edf1931679d86b70a842bc6bd51683a5a40f408f78f3f40d1a6a89b496');
// Also pin logical slots and fieldKey associations, not just the set of IDs.
const bindingsFromReport = [
  ...Object.entries(mapping.pipelines).flatMap(([f, p]) => [`pipeline:${f}:${p.id}`, ...Object.entries(p.stages).map(([c, s]) => `stage:${f}:${c}:${s.id}`)]),
  ...Object.entries(mapping.tags).map(([k, v]) => `tag:${k}:${v.id}`),
  ...Object.entries(mapping.contactFields).map(([k, v]) => `contact:${k}:${v.id}:${v.fieldKey}`),
  ...Object.entries(mapping.opportunityFields).map(([k, v]) => `opportunity:${k}:${v.id}:${v.fieldKey}`),
].sort();
assert.equal(createHash('sha256').update(bindingsFromReport.join('\n')).digest('hex'), '3f1da0c4666ace837873b38d9f9afa2f288b53be8366b5a1a380a164178fccb1');
passed.push('1 complete mapping ready; exact resource counts and supplied inventory IDs');
const invalid = (label, change) => {
  const copy = structuredClone(mapping); change(copy);
  assert.equal(validatePatrimonialRemoteMapping(copy).remoteMappingReady, false, label);
  passed.push(label);
};
invalid('2 missing stage rejected', m => { delete m.pipelines.ARCHITECT_PATH.stages.A01; });
invalid('3 missing pipeline rejected', m => { delete m.pipelines.PATRIMONIAL_EVENT; });
invalid('4 missing contact field rejected', m => { delete m.contactFields.hz_province; });
invalid('4 missing opportunity field rejected', m => { delete m.opportunityFields.hz_intent_key; });
invalid('5 missing tag rejected', m => { delete m.tags.pilot; });
invalid('6 duplicate remote ID rejected across resource kinds', m => { m.tags.pilot.id = m.contactFields.hz_province.id; });
invalid('7 wrong stage/funnel rejected', m => { m.pipelines.ARCHITECT_PATH.stages.A01.funnel = 'PATRIMONIAL_EVENT'; });
invalid('7 swapped real stage IDs rejected', m => {
  const a = m.pipelines.ARCHITECT_PATH.stages.A01, e = m.pipelines.PATRIMONIAL_EVENT.stages.E01;
  [a.id, e.id] = [e.id, a.id];
});
invalid('unknown stage rejected', m => { m.pipelines.ARCHITECT_PATH.stages.A11 = { id: 'extra', funnel: 'ARCHITECT_PATH' }; });
invalid('pipeline override cannot silently retain another pipeline stages', m => { m.pipelines.ARCHITECT_PATH.id = 'replacement'; });
invalid('generated fieldKey must not be corrected', m => { m.opportunityFields.hz_architect_eligibility.fieldKey += 'a'; });
for (const bad of [null, [], {}, { pipelines: null, tags: null, contactFields: null, opportunityFields: null }]) assert.equal(validatePatrimonialRemoteMapping(bad).remoteMappingReady, false);
assert.equal(mapping.opportunityFields.hz_architect_availability.fieldKey, 'opportunity.hz__disponibilit');
assert.equal(mapping.opportunityFields.hz_architect_eligibility.fieldKey, 'opportunity.hz__idoneit');
const overrideEnv = { PATRIMONIAL_HIGHLEVEL_REMOTE_IDS_JSON: JSON.stringify({ contactFields: { hz_province: 'fixture-province-id' } }) };
assert.equal(getPatrimonialRemoteMapping(overrideEnv).contactFields.hz_province.id, 'fixture-province-id');
for (const raw of ['', 'invalid', 'null', '[]', JSON.stringify({ unexpected: {} }), JSON.stringify({ tags: { unknown: 'id' } }), JSON.stringify({ stages: { A01: mapping.pipelines.PATRIMONIAL_EVENT.stages.E01.id } }), JSON.stringify({ tags: { pilot: mapping.tags['evento-patrimoniale'].id } })]) {
  assert.throws(() => getPatrimonialRemoteMapping({ PATRIMONIAL_HIGHLEVEL_REMOTE_IDS_JSON: raw }), PatrimonialMappingConfigError);
}
const detached = getPatrimonialRemoteMapping({}); detached.tags.pilot.id = 'changed';
assert.deepEqual(getPatrimonialRemoteMapping({}), mapping);
passed.push('strict optional ID overrides; immutable baseline; exact generated field keys');

const locationId = 'fixture-location', contact = { id: 'fixture-contact', locationId, email: 'fixture@example.test', phone: null };
const flags = { HIGHLEVEL_LOCATION_ID: locationId, HIGHLEVEL_PRIVATE_TOKEN: 'fixture-token', PATRIMONIAL_V2_ENABLED: 'true', PATRIMONIAL_CRM_WRITE_ENABLED: 'true', PATRIMONIAL_OPPORTUNITY_WRITE_ENABLED: 'true' };
const config = createPatrimonialRemotePipelineMapping(locationId, flags);
for (const [funnel, pipeline] of Object.entries(config.pipelines)) {
  assert.equal(pipeline.pipelineId, mapping.pipelines[funnel].id);
  for (const [code, stage] of Object.entries(pipeline.stages)) assert.equal(stage, mapping.pipelines[funnel].stages[code].id);
  for (const [logical, id] of Object.entries(pipeline.fields)) assert.equal(id, mapping.opportunityFields[logical].id);
}
assert.equal(Object.keys(config.pipelines.ARCHITECT_PATH.fields).length, 24);
assert.equal(Object.keys(config.pipelines.PATRIMONIAL_EVENT.fields).length, 14);
assert.equal(Object.keys(config.pipelines.PATRIMONIAL_CONSULTATION.fields).length, 16);
for (const key of patrimonialEventFieldsInventoryOnly()) assert(!Object.hasOwn(config.pipelines.PATRIMONIAL_EVENT.fields, key));
assert.deepEqual(config.closeReason, { mode: 'UNRESOLVED', key: null });
assert.throws(() => createPatrimonialRemotePipelineMapping('other-location', flags), PatrimonialMappingConfigError);
assert.deepEqual(patrimonialContactCustomFieldIds({ hz_province: 'Milano' }, mapping), [{ id: mapping.contactFields.hz_province.id, value: 'Milano' }]);
assert.throws(() => patrimonialContactCustomFieldIds({ unknown: 'value' }, mapping), PatrimonialMappingConfigError);

const bindings = {
  email: { verified: true, request: () => ({ method: 'GET', path: '/contacts/fixture-search' }), decode: () => ({ contacts: [], complete: true }) },
  phone: { verified: true, request: () => ({ method: 'GET', path: '/contacts/fixture-search' }), decode: () => ({ contacts: [], complete: true }) },
  contact: { verified: true, request: id => ({ method: 'GET', path: `/contacts/${id}` }), decode: body => body.contact },
  create: { verified: true, createOnly: true, request: () => ({ method: 'POST', path: '/contacts/' }), decode: body => body.contact },
};
const capabilities = { contactsRead: true, contactsWrite: true, tagsWrite: true, notesWrite: true, calendarsRead: true, usersRead: true, workflowsRead: true, bookingWrite: true, webhookRead: true, lostReasonsRead: true, messagingWrite: true };
const calls = [];
const options = { verifiedLocationId: locationId, env: () => flags, capabilities, bindings, fetchImpl: async (url, init) => {
  calls.push({ path: new URL(url).pathname, method: init.method, body: init.body ? JSON.parse(init.body) : null });
  return Response.json(init.method === 'GET' ? { contact } : {});
} };
const provider = createConfiguredPatrimonialHighLevelProvider(options);
assert.equal(provider.remoteMappingReady, true);
assert.deepEqual(provider.remoteResources, mapping);
assert.deepEqual(provider.pipelineMapping, config);
assert.deepEqual(provider.contactCustomFieldIds({ hz_province: 'Milano' }), [{ id: mapping.contactFields.hz_province.id, value: 'Milano' }]);
for (const capability of ['calendarsRead', 'workflowsRead', 'usersRead', 'bookingWrite', 'webhookRead', 'lostReasonsRead', 'messagingWrite']) assert.equal(provider.capabilities[capability], 'UNKNOWN');
assert.throws(() => createConfiguredPatrimonialHighLevelProvider({ ...options, env: () => ({ PATRIMONIAL_HIGHLEVEL_REMOTE_IDS_JSON: 'invalid' }) }), error => error.code === 'CONFIG');
passed.push('8 provider consumes central mapping; fields by ID; Event inventory separate; unverified capabilities UNKNOWN');

const tagInventory = Object.values(mapping.tags).map(tag => ({ ...tag, locationId }));
let inventoryReads = 0;
const inventoryBinding = tags => ({ verified: true, read: async () => { inventoryReads++; return { complete: true, tags }; } });
for (const binding of [undefined, inventoryBinding([]), inventoryBinding([{ ...tagInventory.find(t => t.name === 'pilot'), id: 'wrong-id' }]), inventoryBinding([{ ...tagInventory.find(t => t.name === 'pilot'), locationId: 'wrong-location' }]), inventoryBinding([tagInventory.find(t => t.name === 'pilot'), tagInventory.find(t => t.name === 'pilot')]), { verified: true, read: async () => ({ complete: false, tags: tagInventory }) }]) {
  await assert.rejects(() => createConfiguredPatrimonialHighLevelProvider({ ...options, verifiedTagInventory: binding }).addTags(contact.id, ['pilot']), error => error instanceof PatrimonialCrmError && error.code === 'CONFIG');
  assert.equal(calls.length, 0);
}
const valid = createConfiguredPatrimonialHighLevelProvider({ ...options, verifiedTagInventory: inventoryBinding(tagInventory) });
await valid.addTags(contact.id, ['pilot']);
assert.deepEqual(calls, [{ path: '/contacts/fixture-contact', method: 'GET', body: null }, { path: '/contacts/fixture-contact/tags', method: 'POST', body: { tags: ['pilot'] } }]);
calls.length = 0;
await assert.rejects(() => valid.addTags(contact.id, ['unknown-tag']), error => error.code === 'CONFIG');
assert.equal(calls.length, 0);
passed.push('missing/deleted/mismatched/duplicate tags block POST; no tag auto-create; existing tag endpoint uses verified names');

assert(Object.values(patrimonialFlags({})).every(value => value === false));
for (const disabled of [{}, { ...flags, PATRIMONIAL_V2_ENABLED: 'false' }, { ...flags, PATRIMONIAL_CRM_WRITE_ENABLED: 'false' }]) {
  const beforeReads = inventoryReads;
  const off = createConfiguredPatrimonialHighLevelProvider({ ...options, env: () => disabled, verifiedTagInventory: inventoryBinding(tagInventory) });
  await assert.rejects(() => off.addTags(contact.id, ['pilot']), error => error.code === 'CONFIG');
  await assert.rejects(() => off.upsertContact({ firstName: 'Fixture', lastName: 'Only', email: 'fixture@example.test' }), error => error.code === 'CONFIG');
  await assert.rejects(() => off.addNote(contact.id, 'fixture'), error => error.code === 'CONFIG');
  assert.equal(inventoryReads, beforeReads); assert.equal(calls.length, 0);
}
await assert.rejects(() => valid.createOpportunity({}), error => error.code === 'CONFIG');
await assert.rejects(() => valid.searchOpportunities({}), error => error.code === 'CONFIG');
await assert.rejects(() => valid.updateOpportunity('fixture', {}), error => error.code === 'CONFIG');
assert.equal(calls.length, 0);
passed.push('9 default/false flags cause zero writes and zero inventory fetches; opportunity transport still closed');

// Source-only client import graph: no build/dev, network or reads under tmp/.
const configFile = path.resolve('src/lib/public-leads/patrimonial-highlevel-config.ts');
const files = execFileSync('rg', ['--files', 'src', '-g', '*.ts', '-g', '*.tsx', '-g', '*.js', '-g', '*.jsx'], { encoding: 'utf8' }).trim().split(/\r?\n/).map(file => path.resolve(file));
const graph = new Map(), clients = [];
for (const file of files) {
  const source = readFileSync(file, 'utf8'), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true), edges = [];
  if (ast.statements.some(s => ts.isExpressionStatement(s) && ts.isStringLiteral(s.expression) && s.expression.text === 'use client')) clients.push(file);
  if (file !== configFile) for (const id of ids) assert(!source.includes(id), `Remote ID outside config: ${file}`);
  const add = specifier => {
    const base = specifier.startsWith('.') ? path.resolve(path.dirname(file), specifier) : specifier.startsWith('@/') ? path.resolve('src', specifier.slice(2)) : null;
    if (!base) return;
    const target = [base, ...['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'].map(ext => base + ext)].find(candidate => existsSync(candidate) && files.includes(candidate));
    if (target) edges.push(target);
  };
  const visit = node => {
    if ((ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) || (ts.isExportDeclaration(node) && !node.isTypeOnly)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) add(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) add(node.arguments[0].text);
    ts.forEachChild(node, visit);
  };
  visit(ast); graph.set(file, edges);
}
for (const client of clients) {
  const visited = new Set(), queue = [client];
  while (queue.length) {
    const file = queue.pop(); if (visited.has(file)) continue; visited.add(file);
    assert.notEqual(file, configFile, `Server mapping reachable from client ${client}`);
    queue.push(...(graph.get(file) ?? []));
  }
}
assert.equal(externalCalls, 0);
passed.push('server IDs have one source; mapping unreachable from client runtime import graph');
// Includes static migration verification, persistence, opportunities, CRM, ledger,
// legacy/2A behavior and protected Radar sources. Every transport is local/fake.
await import('./verify-patrimonial-persistence.mjs');
passed.push('10 persistence', '11 CRM', '12 opportunities', '13 legacy', '14 2A', '15 Radar');
assert.equal(externalCalls, 0);
console.log(passed.map(message => `PASS ${message}`).join('\n'));
console.log('Patrimonial remote mapping ready: 3 pipelines, 20 stages, 33 fields, 4 tags. Zero actual remote calls; all default flags false.');
