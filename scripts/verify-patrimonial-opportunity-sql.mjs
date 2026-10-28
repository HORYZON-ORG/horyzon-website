// Opt-in real PostgreSQL/WASM test, entirely local and in memory. The explicit
// module path points to a separately installed PGlite; no repo dependency/env.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { postCrmFixture } from './fixtures/patrimonial-post-crm.mjs';
import { SupabasePatrimonialStore } from '../src/lib/public-leads/patrimonial-supabase.ts';
import { PatrimonialConflictError, PatrimonialStoreUnavailableError } from '../src/lib/public-leads/patrimonial-store.ts';
import { receivePatrimonialOpportunity } from '../src/lib/public-leads/patrimonial-routing.ts';

const originalPath = 'supabase/migrations/20261014225059_patrimonial_lead_v2.sql';
const forward = 'supabase/migrations/20261015100912_patrimonial_opportunity_jsonb_precedence.sql';
export async function verifyPatrimonialOpportunityMigration() {
  const original = (await readFile(originalPath, 'utf8')).replaceAll('\r\n', '\n'), corrected = (await readFile(forward, 'utf8')).replaceAll('\r\n', '\n');
  const extract = sql => sql.match(/create (?:or replace )?function public\.patrimonial_execute_command\(p_command jsonb\) returns jsonb[\s\S]*?\n\$\$;/)[0];
  let expected = extract(original).replace('create function', 'create or replace function');
  for (const [from, to] of [
    ["v_input->'requestIds' @> v_parent.record->'requestIds'", "(v_input->'requestIds') @> (v_parent.record->'requestIds')"],
    ["v_input->'events' @> v_parent.record->'events'", "(v_input->'events') @> (v_parent.record->'events')"],
    ["v_parent.record->'requestIds' @> v_item->'requestIds'", "(v_parent.record->'requestIds') @> (v_item->'requestIds')"],
  ]) { assert.equal(expected.split(from).length, 2); expected = expected.replace(from, to); }
  assert.equal(extract(corrected), expected, 'only three containment operands may change in the existing RPC');
  const outside = corrected.replace(extract(corrected), '').replace(/^--.*$/gm, '').trim();
  assert.equal(outside, 'begin;\n\n\n\ncommit;');
  assert(corrected.includes('security invoker set search_path = pg_catalog, public'));
  console.log('PASS forward SQL contract: only JSONB operand parentheses changed; no schema/data/grant/RLS changes');
}

async function main() {
  await verifyPatrimonialOpportunityMigration();
  assert.equal(process.argv[2], '--pglite-module');
  assert(process.argv[3] && process.argv.length === 4, 'explicit local PGlite module required');
  const modulePath = path.resolve(process.argv[3]);
  assert(path.isAbsolute(modulePath) && !modulePath.startsWith(path.resolve('tmp') + path.sep));
  const { PGlite } = await import(pathToFileURL(modulePath).href);
  globalThis.fetch = () => { throw new Error('Remote network forbidden'); };
  const pg = await PGlite.create(), fixture = postCrmFixture(), trace = [], failures = [];
  const original = await readFile(originalPath, 'utf8');
  // The forward migration is selected explicitly by the test, never applied remotely.
  try {
    await pg.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    await pg.exec(original);
    const command = (method, args) => pg.query('select public.patrimonial_execute_command($1::jsonb)', [JSON.stringify({ method, args })]);
    await command('createOrReplayRequest', [fixture.request, fixture.request.receivedAt]);
    await command('createOrReuseIntent', [fixture.provisional]);
    await command('attachIntent', [fixture.request.id, fixture.provisional.id]);
    for (const consent of fixture.consents) await command('appendConsentEvidence', [consent]);
    for (const op of fixture.operations) {
      if (op.kind !== 'UPSERT_CONTACT') { await command('enqueueOperation', [op]); continue; }
      const leaseToken = '00000000-0000-4000-8000-000000000003';
      await command('enqueueOperation', [{ ...op, technicalState: 'SYNCING', leaseToken, leaseExpiresAt: new Date(Date.now() + 60000).toISOString() }]);
      // Use the actual checkpoint RPC to populate relational contact/location
      // columns as well as record.crm, exactly as the completed live CRM effect.
      await command('completeCrmOperation', [{ operationId: op.id, leaseToken, leaseVersion: 1, now: new Date().toISOString(),
        checkpoint: fixture.request.crm, remoteId: fixture.seed.contact.id }]);
    }
    await command('appendEvent', [fixture.event]);
    const audit = async () => ({
      request: (await pg.query('select request_id,intent_id,contact_ref,record from public.patrimonial_requests')).rows,
      provisional: (await pg.query("select id,location_ref,remote_contact_id,record from public.patrimonial_intents where kind='PROVISIONAL'")).rows,
      operations: (await pg.query('select id,status,remote_id,record from public.patrimonial_outbox_operations order by id')).rows,
      consents: (await pg.query('select record from public.patrimonial_consent_evidence order by evidence_key')).rows,
    });
    const before = await audit();
    assert.equal(before.operations.length, 5); assert(before.operations.every(row => row.record.technicalState === 'SYNCED'));
    assert.equal(before.provisional[0].record.identityResolved, true); assert.equal(before.request[0].record.crm.noteId, 'fixture-note');
    assert.equal(before.provisional[0].remote_contact_id, fixture.seed.contact.id);
    assert.equal(before.provisional[0].location_ref, fixture.seed.contact.locationId); assert(before.request[0].contact_ref);
    const functionProperties = async () => (await pg.query("select prosecdef,proconfig,proacl::text from pg_proc where oid='public.patrimonial_execute_command(jsonb)'::regprocedure")).rows;
    const properties = await functionProperties();
    await pg.exec('set role service_role');
    const store = new SupabasePatrimonialStore({ url: 'https://patrimonial.invalid', serviceRoleKey: 'fixture-secret', fetchImpl: async (url, init) => {
      const name = String(url).split('/').at(-1), body = JSON.parse(init.body);
      assert(['patrimonial_store_health', 'patrimonial_store_transaction'].includes(name));
      if (body.p_commands) trace.push(body.p_commands.map(c => c.method));
      try {
        const result = await pg.query(name === 'patrimonial_store_health' ? 'select public.patrimonial_store_health() as result'
          : 'select public.patrimonial_store_transaction($1::jsonb,$2::jsonb,$3::boolean) as result',
        name === 'patrimonial_store_health' ? [] : [JSON.stringify(body.p_commands), JSON.stringify(body.p_expected), body.p_preview ?? false]);
        return Response.json(result.rows[0].result);
      } catch (error) {
        failures.push({ code: error.code, message: error.message, where: error.where });
        return Response.json({ code: error.code, message: error.message }, { status: error.code === 'PT409' ? 409 : 400 });
      }
    } });
    await assert.rejects(receivePatrimonialOpportunity(store, fixture.seed), PatrimonialStoreUnavailableError);
    assert.equal(failures.at(-1).code, '42883'); assert.equal(failures.at(-1).message, 'operator does not exist: boolean -> unknown');
    assert(failures.at(-1).where.includes('patrimonial_execute_command(jsonb) line 97 at IF'));
    assert.deepEqual(trace.at(-1), ['findOpportunityIntent', 'listParticipations', 'saveOpportunityIntent']);
    assert.deepEqual(await audit(), before);
    assert.equal((await pg.query("select count(*)::int as n from public.patrimonial_intents where kind='OPPORTUNITY'")).rows[0].n, 0);
    console.log('PASS BEFORE FIX: exact 42883 at saveOpportunityIntent IF; complete post-CRM fixture unchanged, no OPPORTUNITY committed');
    await pg.exec('reset role');
    await pg.exec(await readFile(forward.trim(), 'utf8'));
    assert.deepEqual(await functionProperties(), properties, 'invoker/search_path/ACL unchanged');
    await pg.exec('set role service_role');
    const intent = await receivePatrimonialOpportunity(store, fixture.seed);
    assert.equal(intent.revision, 1); assert.equal(intent.stage, 'A01'); assert.equal(intent.status, 'OPEN'); assert.equal(intent.nextStep, 'ASSIGN'); assert.equal(intent.remote, null);
    const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
    assert.equal(intent.groupKey, hash([fixture.seed.contact.locationId, fixture.seed.contact.id, 'ARCHITECT_PATH', fixture.seed.scopeKey]));
    assert.equal(intent.businessKey, hash([intent.groupKey, 1])); assert.deepEqual(intent.firstRequest, fixture.seed.request);
    assert.deepEqual(intent.requestIds, [fixture.request.id]); assert.equal(intent.events.length, 1); assert.deepEqual(intent.events[0].actor, fixture.seed.actor);
    const row = (await pg.query("select * from public.patrimonial_intents where kind='OPPORTUNITY'")).rows[0];
    assert.equal(row.group_key, intent.groupKey); assert.equal(row.business_key, intent.businessKey); assert.equal(row.location_ref, intent.locationId);
    assert.equal(row.remote_contact_id, intent.contactId); assert.equal(row.scope_key, intent.scopeKey); assert.equal(row.record.revision, row.revision);
    assert.equal(row.record.stage, row.stage); assert.equal(row.record.status, row.status); assert.equal(row.next_step, 'ASSIGN'); assert.equal(row.sync_state, 'SYNC_PENDING');
    assert.equal(new Date(row.next_step_at).toISOString(), fixture.seed.nextStepAt);
    assert.deepEqual(await audit(), before, 'request/provisional/consents/outbox remain unchanged');
    assert.equal((await receivePatrimonialOpportunity(store, fixture.seed)).revision, 1, 'replay never creates another intent');
    const followRequest = { ...fixture.request, id: '00000000-0000-4000-8000-000000000020' };
    await command('createOrReplayRequest', [followRequest, followRequest.receivedAt]);
    const updated = await receivePatrimonialOpportunity(store, { ...fixture.seed, request: { ...fixture.seed.request, requestId: followRequest.id } });
    assert.equal(updated.id, intent.id); assert.equal(updated.revision, 2); assert.equal(updated.events.length, 2);
    await assert.rejects(store.transaction(tx => tx.saveOpportunityIntent({ ...updated, revision: 3, events: [] }, 2)), PatrimonialConflictError);
    console.log('PASS AFTER FIX: OPPORTUNITY revision=1/A01/OPEN/ASSIGN/remote=null; record/SQL invariants, replay, revision=2 and immutable history guards; original audit preserved');
    console.log('PASS LOCAL ONLY: PostgreSQL WASM in memory; migration applied only to this ephemeral DB; zero live reads/writes/retries/cleanup');
  } finally { await pg.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
