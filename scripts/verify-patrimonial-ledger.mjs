import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { handlePublicLead } from '../src/lib/public-leads/handler.ts';
import { validatePatrimonialV2 } from '../src/lib/public-leads/patrimonial-funnels.ts';
import { canonicalPatrimonialPayload, PATRIMONIAL_V2, PatrimonialClientAttempt, PatrimonialRevisionRequiredError, patrimonialTechnicalStates } from '../src/lib/public-leads/patrimonial-contract.ts';
import { patrimonialFlags, createProductionPatrimonialStore, PatrimonialStoreUnavailableError, PatrimonialStaleLeaseError } from '../src/lib/public-leads/patrimonial-store.ts';
import { patrimonialRetryDecision, recordPatrimonialFailure } from '../src/lib/public-leads/patrimonial-sync.ts';
import { MemoryPatrimonialStoreForTests } from './fixtures/patrimonial-memory-store.ts';
import { pilotForms } from '../src/content/patrimonial-funnels.ts';

// No test in this process may reach a network transport, including a failure
// silently caught by the handler. Provider regressions use a separate local fake.
let externalAttempts = 0;
globalThis.fetch = async () => { externalAttempts++; throw new Error('Network forbidden in ledger verifier'); };
let v2CrmAttempts = 0;
const forbiddenCrm = async () => { v2CrmAttempts++; throw new Error('V2 must not call CRM'); };
const env = { NODE_ENV: 'test', PATRIMONIAL_V2_ENABLED: 'true' };
const start = '2026-10-14T10:00:00.000Z';
const instant = ms => new Date(Date.parse(start) + ms).toISOString();
const options = (store, at = start, overrides = {}) => ({ env, store, now: () => new Date(at), fetchImpl: forbiddenCrm, ...overrides });
const payload = (mode = 'patrimonial-event', requestId = randomUUID()) => ({
  contractVersion: PATRIMONIAL_V2, requestId, mode, sourcePath: pilotForms[mode].path,
  firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: mode === 'architect-path' ? '333 123 4567' : '',
  province: 'Milano', profile: '', message: '', consent: true, marketingConsent: false, utm: {}, website: '',
  ...(mode === 'architect-path' ? { experience: '', goal: '', availability: '' } : {}),
});
const request = (body, headers = {}) => new Request('https://horyzon.it/api/public-leads', {
  method: 'POST', headers: { Origin: 'https://horyzon.it', 'Content-Type': 'application/json', 'Idempotency-Key': body.requestId, ...headers }, body: JSON.stringify(body),
});
const submit = (body, store, at = start, overrides = {}) => handlePublicLead(request(body), options(store, at, overrides));
const counts = store => {
  const s = store.inspectForTests();
  return [s.requests.size, s.intents.size, s.consents.size, s.operations.size, s.events.size];
};
const claimRef = (op, now) => ({ operationId: op.id, leaseToken: op.leaseToken, leaseVersion: op.leaseVersion, now });
const passed = [];

// A/B/C: canonical replay, conflict and a new logical request.
const store = new MemoryPatrimonialStoreForTests();
const original = payload();
const first = await submit(original, store);
assert.equal(first.status, 202);
assert.equal(first.headers.get('cache-control'), 'no-store');
const receipt = await first.json();
assert.deepEqual(receipt, { ok: true, requestId: original.requestId, receiptStatus: 'received', crmStatus: 'pending' });
const sameCanonical = { ...original, email: ' ADA@EXAMPLE.COM ', firstName: ' Ada ', phone: null, profile: null, message: null, utm: { utm_source: ' ' }, clientTimestamp: 'untrusted-time' };
assert.deepEqual(await (await submit(sameCanonical, store, instant(1000))).json(), receipt);
assert.deepEqual(counts(store), [1, 1, 2, 1, 1]);
const saved = await store.getRequest(original.requestId);
assert.equal(saved.receivedAt, start);
assert(!JSON.stringify(saved).includes('untrusted-time'));
assert.equal((await submit({ ...original, province: 'Roma' }, store)).status, 409);
assert.equal((await submit({ ...original, marketingConsent: true }, store)).status, 409);
assert.deepEqual(counts(store), [1, 1, 2, 1, 1]);
const consciousNew = { ...original, requestId: randomUUID() };
assert.equal((await submit(consciousNew, store)).status, 202);
assert.deepEqual(counts(store), [2, 1, 4, 2, 2]);
assert.equal(store.inspectForTests().intents.values().next().value.identityResolved, false);
assert.equal(store.inspectForTests().intents.values().next().value.contactId, null);
assert.equal(store.inspectForTests().requests.get(original.requestId).intentId, store.inspectForTests().requests.get(consciousNew.requestId).intentId);
passed.push('A canonical replay', 'B changed payload 409', 'C new request, provisional intent reuse');

// All canonical fields matter; requestId and runtime timestamp do not.
const canonicalHash = input => createHash('sha256').update(canonicalPatrimonialPayload(validatePatrimonialV2(input))).digest('hex');
const baseHash = canonicalHash(original);
for (const change of [
  { firstName: 'Grace' }, { lastName: 'Hopper' }, { email: 'different@example.com' }, { phone: '+393331234567' },
  { province: 'Torino' }, { profile: 'Privato' }, { message: 'Una domanda' }, { marketingConsent: true },
  { utm: { utm_source: 'source' } }, { utm: { utm_medium: 'medium' } }, { utm: { utm_campaign: 'campaign' } },
  { utm: { utm_content: 'content' } }, { utm: { utm_term: 'term' } }, { eventEditionId: 'edition-requested' },
]) assert.notEqual(canonicalHash({ ...original, ...change }), baseHash, JSON.stringify(change));
assert.equal(canonicalHash({ ...original, requestId: randomUUID(), clientTimestamp: 123 }), baseHash);
assert.equal(canonicalHash({ ...original, eventEditionId: ' ' }), baseHash);
assert.equal(canonicalHash({ ...original, eventEditionId: null }), baseHash);
const architect = payload('architect-path');
assert.equal(canonicalHash({ ...architect, phone: '+39 333 123 4567', experience: null }), canonicalHash(architect));
for(const change of [{ experience: 'Sì' }, { goal: 'Sto esplorando' }, { availability: 'Part-time' }]) assert.notEqual(canonicalHash({ ...architect, ...change }), canonicalHash(architect));
const utmA = { ...original, utm: { utm_campaign: 'test', utm_source: 'test' } };
assert.equal(canonicalHash(utmA), canonicalHash({ ...utmA, utm: { utm_source: 'test', utm_campaign: 'test' } }));
for (const extra of [
  { ownerId: 'forged' }, { contactId: 'forged' }, { opportunityId: 'forged' }, { token: 'forged' },
  { eventEditionId: 'invalid/id' }, { clientTimestamp: {} }, { experience: 'Sì' }, { unknown: true },
  { consent: false }, { marketingConsent: 'false' }, { utm: { unknown: 'x' } }, { website: 'bot' },
]) assert.equal((await submit({ ...original, ...extra }, store)).status, 400, JSON.stringify(extra));
assert.equal(validatePatrimonialV2({ ...architect, eventEditionId: 'not-for-architect' }), null);
assert.equal((await handlePublicLead(request(original, { 'Idempotency-Key': randomUUID() }), options(store))).status, 400);
assert.equal((await handlePublicLead(request(original, { 'Idempotency-Key': '' }), options(store))).status, 400);
assert.equal((await submit({ ...original, requestId: 'not-uuid' }, store)).status, 400);
assert.equal((await submit({ ...original, contractVersion: 'unknown-v3' }, store)).status, 400);
assert.equal((await handlePublicLead(request(original, { Origin: 'https://evil.example' }), options(store))).status, 403);
assert.equal((await handlePublicLead(request(original, { 'Content-Type': 'text/plain' }), options(store))).status, 415);
assert.equal((await submit({ ...original, message: 'x'.repeat(12001) }, store)).status, 413);
passed.push('canonical fields/normalization/allowlist, origin, size and key validation');

// D: concurrent request commits; no transient receipt before all acquisition rows.
const concurrentStore = new MemoryPatrimonialStoreForTests();
const concurrentPayload = payload();
const concurrent = await Promise.all(Array.from({ length: 12 }, () => submit(concurrentPayload, concurrentStore)));
assert(concurrent.every(r => r.status === 202));
assert.deepEqual(await Promise.all(concurrent.map(r => r.json())), Array(12).fill({ ...receipt, requestId: concurrentPayload.requestId }));
assert.deepEqual(counts(concurrentStore), [1, 1, 2, 1, 1]);
const detached = await concurrentStore.getRequest(concurrentPayload.requestId);
detached.payload.email = 'mutated@example.com';
assert.equal((await concurrentStore.getRequest(concurrentPayload.requestId)).payload.email, concurrentPayload.email);
passed.push('D concurrent double submit and detached snapshots');
const raceStore = new MemoryPatrimonialStoreForTests();
const racePayload = payload();
const race = await Promise.all([submit(racePayload, raceStore), submit({ ...racePayload, message: 'Different body' }, raceStore)]);
assert.deepEqual(race.map(r => r.status).sort(), [202, 409]);
assert.deepEqual(counts(raceStore), [1, 1, 2, 1, 1]);

// E/F/G: atomic claim, renewal, expiration and fencing of every old worker mutation.
const claims = await Promise.all(Array.from({ length: 10 }, () => concurrentStore.claimOperations({ now: start, limit: 1 })));
assert.equal(claims.flat().length, 1);
const old = claims.flat()[0];
assert.equal(old.attemptCount, 1); assert.equal(old.leaseVersion, 1);
await concurrentStore.renewLease({ ...claimRef(old, instant(30_000)), leaseSeconds: 60 });
assert.equal((await concurrentStore.claimOperations({ now: instant(61_000), limit: 1 })).length, 0);
const [renewed] = await concurrentStore.claimOperations({ now: instant(91_000), limit: 1 });
assert.equal(renewed.id, old.id); assert.equal(renewed.attemptCount, 2);
assert.equal(renewed.leaseVersion, 2); assert.notEqual(renewed.leaseToken, old.leaseToken);
assert.equal(renewed.reconcileRequired, true);
for (const mutation of [
  () => concurrentStore.completeOperation(claimRef(old, instant(92_000))),
  () => concurrentStore.renewLease(claimRef(old, instant(92_000))),
  () => concurrentStore.failOperation({ ...claimRef(old, instant(92_000)), errorCode: 'NETWORK', state: 'RECONCILE_REQUIRED' }),
  () => concurrentStore.scheduleRetry({ ...claimRef(old, instant(92_000)), errorCode: 'NETWORK', nextAttemptAt: instant(150_000) }),
  () => concurrentStore.markManualReview({ ...claimRef(old, instant(92_000)), errorCode: 'UNKNOWN' }),
]) await assert.rejects(mutation, PatrimonialStaleLeaseError);
await assert.rejects(() => concurrentStore.completeOperation({ ...claimRef(renewed, instant(92_000)), leaseVersion: old.leaseVersion }), PatrimonialStaleLeaseError);
await assert.rejects(() => concurrentStore.completeOperation({ ...claimRef(renewed, instant(92_000)), leaseToken: old.leaseToken }), PatrimonialStaleLeaseError);
await assert.rejects(() => concurrentStore.completeOperation(claimRef(renewed, instant(92_000))), /Reconciliation/);
await assert.rejects(() => concurrentStore.scheduleRetry({ ...claimRef(renewed, instant(92_000)), nextAttemptAt: instant(150_000), errorCode: 'NETWORK' }), /uncertain/);
await concurrentStore.markManualReview({ ...claimRef(renewed, instant(92_000)), errorCode: 'UNKNOWN' });
assert.equal(concurrentStore.inspectForTests().operations.get(old.id).technicalState, 'MANUAL_REVIEW');
assert.equal((await concurrentStore.claimOperations({ now: instant(900_000), limit: 1 })).length, 0);
passed.push('E atomic concurrent lease', 'F expired lease reclaimed for reconciliation', 'G stale worker fenced');

// Serialize different requests for the same provisional intent as well.
const serialized = await store.claimOperations({ now: start, limit: 100 });
assert.equal(serialized.length, 1);
await store.completeOperation(claimRef(serialized[0], instant(1000)));
const secondForIntent = await store.claimOperations({ now: instant(2000), limit: 100 });
assert.equal(secondForIntent.length, 1);
passed.push('per-intent worker serialization');

const siblingStore = new MemoryPatrimonialStoreForTests();
const siblingPayload = payload();
await submit(siblingPayload, siblingStore);
await submit({ ...siblingPayload, requestId: randomUUID() }, siblingStore);
const [uncertainSibling] = await siblingStore.claimOperations({ now: start, limit: 2 });
const [reclaimedSibling] = await siblingStore.claimOperations({ now: instant(61000), limit: 2 });
assert.equal(reclaimedSibling.id, uncertainSibling.id);
assert.equal(reclaimedSibling.reconcileRequired, true);
await siblingStore.failOperation({ ...claimRef(reclaimedSibling, instant(62000)), state: 'RECONCILE_REQUIRED', errorCode: 'NETWORK' });
assert.equal((await siblingStore.claimOperations({ now: instant(180000), limit: 2 })).length, 0);
passed.push('uncertain expired operation blocks fresh work on the same intent');

// H/I: four backoffs, total five attempts; no retry for auth/config/schema.
const retryStore = new MemoryPatrimonialStoreForTests();
const retryPayload = payload();
await submit(retryPayload, retryStore);
let retryTime = start;
for(let attempt = 1; attempt <= 5; attempt++) {
  const [operation] = await retryStore.claimOperations({ now: retryTime, limit: 1 });
  assert.equal(operation.attemptCount, attempt);
  const decision = await recordPatrimonialFailure(retryStore, operation, { kind: 'network', outcomeUncertain: false }, retryTime, 0);
  if (attempt < 5) {
    assert.equal(decision.state, 'RETRY_SCHEDULED');
    assert.equal(Date.parse(decision.nextAttemptAt) - Date.parse(retryTime), [1, 5, 30, 120][attempt - 1] * 60_000);
    assert.equal((await retryStore.claimOperations({ now: retryTime, limit: 1 })).length, 0);
    retryTime = decision.nextAttemptAt;
  } else assert.equal(decision.state, 'MANUAL_REVIEW');
}
assert.equal((await retryStore.claimOperations({ now: instant(86400000), limit: 1 })).length, 0);
for(const status of [400, 401, 403, 404, 422]) assert.equal(patrimonialRetryDecision(1, { kind: 'http', status }, start, 0).state, 'MANUAL_REVIEW');
for(const failure of [{ kind: 'network' }, { kind: 'http', status: 429 }, { kind: 'http', status: 500 }, { kind: 'http', status: 503 }]) assert.equal(patrimonialRetryDecision(1, failure, start, 0).state, 'RETRY_SCHEDULED');
assert.equal(patrimonialRetryDecision(1, { kind: 'http', status: 503, outcomeUncertain: true }, start, 0).state, 'RECONCILE_REQUIRED');
assert.equal(patrimonialRetryDecision(1, { kind: 'network', outcomeUncertain: true }, start, 0).state, 'RECONCILE_REQUIRED');
assert.equal(patrimonialRetryDecision(1, { kind: 'http', status: 429, retryAfterSeconds: 600 }, start, 0).nextAttemptAt, instant(600000));
assert.equal(patrimonialRetryDecision(1, { kind: 'network' }, start, 1).nextAttemptAt, instant(66000));
const exhaustedStore = new MemoryPatrimonialStoreForTests();
const exhaustedPayload = payload();
await submit(exhaustedPayload, exhaustedStore);
let exhaustedTime = start;
for(let attempt = 1; attempt <= 5; attempt++) {
  const [operation] = await exhaustedStore.claimOperations({ now: exhaustedTime, limit: 1 });
  const decision = await recordPatrimonialFailure(exhaustedStore, operation, { kind: 'network', outcomeUncertain: attempt === 5 }, exhaustedTime, 0);
  if(attempt < 5) exhaustedTime = decision.nextAttemptAt;
}
await submit({ ...exhaustedPayload, requestId: randomUUID() }, exhaustedStore, exhaustedTime);
assert.equal([...exhaustedStore.inspectForTests().operations.values()].find(op=>op.attemptCount === 5).reconcileRequired, true);
assert.equal((await exhaustedStore.claimOperations({ now: instant(86400000), limit: 2 })).length, 0);
passed.push('H retry/backoff/Retry-After and uncertain outcome hold', 'I five attempts → MANUAL_REVIEW');

// J: failure before commit rolls back every row, including partial acquisition.
const failedStore = new MemoryPatrimonialStoreForTests({ beforeCommit: () => { throw new Error('test DB unavailable'); } });
const failed = await submit(payload(), failedStore);
assert.equal(failed.status, 503); assert.equal((await failed.json()).ok, false);
assert.deepEqual(counts(failedStore), [0, 0, 0, 0, 0]);
const midStore = new MemoryPatrimonialStoreForTests();
const interrupted = new Proxy(midStore, { get(target, key) {
  if(key === 'transaction') return work => target.transaction(tx => work(new Proxy(tx, { get(inner, method) {
    if(method === 'enqueueOperation') return () => { throw new Error('Outbox insert failed after consent and intent'); };
    const value = Reflect.get(inner, method); return typeof value === 'function' ? value.bind(inner) : value;
  } })));
  const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
} });
assert.equal((await submit(payload(), interrupted)).status, 503);
assert.deepEqual(counts(midStore), [0, 0, 0, 0, 0]);
passed.push('J pre-commit and mid-transaction failure → no receipt/rows');

// K: commit succeeds but acknowledgement is lost; same key recovers original receipt.
let loseAcknowledgement = true;
const uncertainStore = new MemoryPatrimonialStoreForTests({ afterCommit: () => {
  if (loseAcknowledgement) { loseAcknowledgement = false; throw new Error('Commit acknowledgement lost'); }
} });
const uncertainPayload = payload();
assert.equal((await submit(uncertainPayload, uncertainStore)).status, 503);
assert.deepEqual(counts(uncertainStore), [1, 1, 2, 1, 1]);
const recovered = await submit(uncertainPayload, uncertainStore, instant(60_000));
assert.equal(recovered.status, 202);
assert.deepEqual(await recovered.json(), { ...receipt, requestId: uncertainPayload.requestId });
assert.deepEqual(counts(uncertainStore), [1, 1, 2, 1, 1]);
assert.equal((await submit(uncertainPayload, uncertainStore, instant(90 * 86400000))).status, 410);
assert.deepEqual(counts(uncertainStore), [1, 1, 2, 1, 1]);
passed.push('K post-commit failure recovered by replay, expired key not reacquired');

// O and production guard: no memory fallback, even if all reserved flags are true.
assert.throws(() => createProductionPatrimonialStore(), PatrimonialStoreUnavailableError);
const flagNames = ['V2', 'CRM_WRITE', 'OPPORTUNITY_WRITE', 'BOOKING', 'MESSAGES', 'WEBHOOK'].map(n => `PATRIMONIAL_${n}_ENABLED`);
assert(Object.values(patrimonialFlags({})).every(v => v === false));
for(const value of ['false', '1', 'TRUE', ' true ', '', 'yes']) assert(Object.values(patrimonialFlags(Object.fromEntries(flagNames.map(n=>[n,value])))).every(v => v === false));
const allTrue = Object.fromEntries(flagNames.map(n => [n, 'true']));
assert(Object.values(patrimonialFlags(allTrue)).every(v => v === true));
const disabledStore = new MemoryPatrimonialStoreForTests();
assert.equal((await submit(payload(), disabledStore, start, { env: { NODE_ENV: 'test' } })).status, 503);
assert.deepEqual(counts(disabledStore), [0, 0, 0, 0, 0]);
assert.equal((await submit(payload(), undefined)).status, 503);
assert.equal((await submit(payload(), disabledStore, start, { env: { ...allTrue, NODE_ENV: 'production' } })).status, 503);
assert.deepEqual(counts(disabledStore), [0, 0, 0, 0, 0]);
assert.equal((await submit(payload(), disabledStore, start, { env: { ...allTrue, NODE_ENV: 'test' } })).status, 202);
for(let i = 0; i < 6; i++) {
  const r = await handlePublicLead(request(payload(), { 'x-forwarded-for': '192.0.2.233' }), options(undefined, start, { env: { ...env, NODE_ENV: 'production' } }));
  assert.equal(r.status, i < 5 ? 503 : 429);
}
passed.push('O false flags and unavailable production adapter fail closed; rate limit');

// N: assert separately from legacy fake CRM regressions.
assert.equal(v2CrmAttempts, 0); assert.equal(externalAttempts, 0);
passed.push('N zero CRM/provider/network calls from v2, even with all flags true');

// L/M: existing contracts retain exact response shape and upsert/tag/note behavior.
let regressionCalls = [];
const crm = async (url, init) => {
  regressionCalls.push({ url, body: JSON.parse(init.body) });
  return new Response(JSON.stringify(url.endsWith('/upsert') ? { contact: { id: 'fixture-contact' } } : {}), { status: 200 });
};
const legacy = { name: 'Ada Lovelace', email: 'ADA@example.com', phone: '', message: '', consent: true, website: '', interest: 'evento-patrimoniale' };
const legacyEnv = { NODE_ENV: 'test', HIGHLEVEL_PRIVATE_TOKEN: 'fixture-token', HIGHLEVEL_LOCATION_ID: 'fixture-location' };
const plainRequest = body => new Request('https://horyzon.it/api/public-leads', { method: 'POST', headers: { Origin: 'https://horyzon.it', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const legacyResponse = await handlePublicLead(plainRequest(legacy), { env: legacyEnv, fetchImpl: crm, now: () => new Date(start) });
assert.equal(legacyResponse.status, 200);
assert.deepEqual(await legacyResponse.json(), { ok: true, message: 'Richiesta ricevuta. Horyzon ti ricontatterà per questo percorso.' });
assert.equal(regressionCalls.length, 3);
assert.deepEqual(regressionCalls[1].body.tags, ['horyzon-benessere-patrimoniale', 'horyzon-evento-patrimoniale']);
for(const mode of ['architect-path', 'patrimonial-event']) {
  const pilot = payload(mode);
  delete pilot.contractVersion; delete pilot.requestId;
  regressionCalls = [];
  const pilotResponse = await handlePublicLead(plainRequest(pilot), { env: legacyEnv, fetchImpl: crm, now: () => new Date(start) });
  assert.equal(pilotResponse.status, 200);
  assert.deepEqual(await pilotResponse.json(), { ok: true, message: pilotForms[mode].success });
  assert.equal(regressionCalls.length, 3);
  assert.deepEqual(regressionCalls[1].body.tags, ['horyzon-patrimoniale', mode === 'architect-path' ? 'percorso-architetto-patrimoniale' : 'evento-patrimoniale', 'pilot']);
}
passed.push('L legacy unchanged', 'M both 2A pilot modes unchanged');

const separationStore = new MemoryPatrimonialStoreForTests();
await submit(payload('architect-path'), separationStore);
await submit(payload(), separationStore);
await submit({ ...payload(), eventEditionId: 'edition-requested', marketingConsent: true }, separationStore);
assert.equal(separationStore.inspectForTests().intents.size, 3);
assert.equal([...separationStore.inspectForTests().consents.values()].filter(c=>c.purpose === 'marketing' && c.choice).length, 1);
assert.equal([...separationStore.inspectForTests().consents.values()].filter(c=>c.purpose === 'marketing' && !c.choice).length, 2);
assert([...separationStore.inspectForTests().consents.values()].every(c=>c.receivedAt === start && c.channel === 'form' && c.policyPath === '/privacy-policy'));
assert([...separationStore.inspectForTests().intents.values()].every(i=>i.contactId === null && i.opportunityId === null && !i.identityResolved));
passed.push('funnel/edition provisional isolation and per-request consent evidence');

// P: exercise the exact client attempt helper used by the form, including reload,
// changing data, invalid receipts, storage denial and explicit new request.
const stored = new Map();
const storageWrites = [];
const storage = { getItem: k => stored.get(k) ?? null, setItem: (k,v) => { storageWrites.push([k,v]); stored.set(k,v); }, removeItem: k => stored.delete(k) };
const attempt = new PatrimonialClientAttempt('patrimonial-event', storage);
const sensitive = { email: 'ada@example.com', message: 'Private response', marketingConsent: false };
const attemptId = attempt.prepare(sensitive);
assert.equal(attempt.prepare(sensitive), attemptId);
assert.throws(() => attempt.prepare({ ...sensitive, message: 'Changed response' }), PatrimonialRevisionRequiredError);
assert.equal(attempt.acceptReceipt(200, { ...receipt, requestId: attemptId }), false);
assert.equal(attempt.acceptReceipt(202, { ...receipt, requestId: randomUUID() }), false);
assert.equal(attempt.acceptReceipt(202, { ok: true, requestId: attemptId }), false);
const afterReload = new PatrimonialClientAttempt('patrimonial-event', storage);
assert.equal(afterReload.prepare(sensitive), attemptId);
assert.equal(afterReload.acceptReceipt(202, { ...receipt, requestId: attemptId }), true);
assert.equal(stored.size, 0);
attempt.beginNewAttempt();
assert.notEqual(attempt.prepare({ ...sensitive, message: 'Changed response' }), attemptId);
for(const [key,value] of storageWrites) {
  assert.equal(key, 'horyzon:patrimonial:patrimonial-event:v2-request');
  assert.match(value, /^[0-9a-f-]{36}$/);
}
assert(!JSON.stringify(storageWrites).includes('example.com'));
assert(!JSON.stringify(storageWrites).includes('Private response'));
const deniedStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } };
const deniedAttempt = new PatrimonialClientAttempt('architect-path', deniedStorage);
assert.equal(deniedAttempt.prepare(sensitive), deniedAttempt.prepare(sensitive));
const clientSource = await readFile('src/components/patrimonial-lead-form.tsx', 'utf8');
assert(clientSource.includes('if (!v2) pilotAttribution(mode)'));
assert(clientSource.includes('utm: pilotAttribution(mode, !v2)'));
assert(clientSource.includes('acceptReceipt(response.status, result)'));
assert(clientSource.includes('beginNewAttempt()'));
const storeSource = await readFile('src/lib/public-leads/patrimonial-store.ts', 'utf8');
assert(!/fetch\(|MemoryPatrimonialStoreForTests/.test(storeSource));
assert.equal(patrimonialTechnicalStates.length, 9);
passed.push('P UUID-only sessionStorage, stable retries/reload, explicit revision, receipt gate');

assert.equal(externalAttempts, 0);
assert.equal(v2CrmAttempts, 0);
console.log(passed.map(x => `PASS ${x}`).join('\n'));
console.log('Patrimonial ledger: all required A–P cases passed. Memory is test-only; production adapter disabled. Zero external calls; legacy/2A transports were local fakes. No migration applied.');
