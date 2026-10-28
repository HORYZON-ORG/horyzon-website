import assert from 'node:assert/strict';
import {assertPublicPilotPreservation} from './lib/patrimonial-public-preservation.mjs';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PGlite, createRadarDatabase, radarDatabaseRpc } from './lib/patrimonial-radar-db.mjs';
import { PatrimonialRadarService } from '../src/lib/patrimonial-radar-server/service.ts';
import { RadarBackendError, BACKEND_VERSION } from '../src/lib/patrimonial-radar-server/contracts.ts';
import { contentHash, normalizeEmail, opaqueToken, RadarSecrets } from '../src/lib/patrimonial-radar-server/security.ts';
import { LocalSupabaseRadarRpc } from '../src/lib/patrimonial-radar-server/store.ts';
import { createPatrimonialRadarHandler } from '../src/lib/patrimonial-radar-server/http.ts';
import { backendLocalTestEnabled, handleRadarBackend } from '../src/lib/patrimonial-radar-server/runtime.ts';
import { diagnose } from '../src/lib/patrimonial-radar/result.ts';
import { dependencyOrder } from '../src/lib/patrimonial-radar/answers.ts';
import { point } from '../src/lib/patrimonial-radar/intervals.ts';
import { VERSIONS } from '../src/lib/patrimonial-radar/versions.ts';
import { buildFixture, T0 } from './patrimonial-radar-fixtures.mjs';

const { db, rpc, before } = await createRadarDatabase();
const secret = opaqueToken(), messages = [], passed = [];
const provider = { kind: 'SIMULATED', async sendCode(input) { messages.push(structuredClone(input)); } };
const service = () => new PatrimonialRadarService(rpc, provider, secret, { retentionReviewDays: 30 });
let app = service();
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
async function fails(work, code) { await assert.rejects(work, e => e instanceof RadarBackendError && e.code === code, code); }
async function unlock(email) { await db.query("update patrimonial_radar_private.rate_limits set window_start=clock_timestamp()-interval '2 minutes' where rate_key=$1", [`request-email-short:${app.secrets.hash('email-v1', normalizeEmail(email))}`]); }
async function challenge(email, network = randomUUID()) { const request = await app.requestCode(email, network); return { ...request, code: messages.at(-1)?.code, network }; }
async function login(email) { await unlock(email); const c = await challenge(email); return app.verifyCode({ challengeId: c.challengeId, code: c.code }, c.binding, c.csrf, c.network); }
const count = async table => Number((await one(`select count(*) as n from patrimonial_radar_private.${table}`)).n);
async function fill(token, assessmentId, fixture = 'T02') {
  let assessment = await app.read(token, assessmentId);
  const input = JSON.parse(JSON.stringify(buildFixture(fixture)).replaceAll(T0, assessment.input.asOf));
  for (const qid of dependencyOrder()) {
    const answer = input.answers.filter(a => a.id === qid).at(-1); if (!answer) continue;
    const resolved = await app.resume(token, assessmentId);
    if (resolved.resolved[qid].applicability === 'NOT_APPLICABLE') continue;
    const saved = await app.save(token, assessmentId, { requestId: randomUUID(), expectedRevision: assessment.revision, questionId: qid, state: answer.state, ...(answer.state === 'VALUE' ? { value: answer.value } : {}) });
    assessment = { ...assessment, revision: saved.revision };
  }
  return app.read(token, assessmentId);
}
const nativeFetch = globalThis.fetch;
let external = 0;
globalThis.fetch = (url, options) => { if (!['localhost','127.0.0.1','[::1]'].includes(new URL(String(url)).hostname)) { external++; throw new Error('Fixture: external network forbidden'); } return nativeFetch(url, options); };
try {
  const version = (await one('select version() as version')).version; console.log(`DATABASE ${version}`);
  assert.equal(normalizeEmail('  Alice+test@Example.invalid  '), 'alice+test@example.invalid');
  assert.throws(() => normalizeEmail('x\r\ny@example.invalid'), RadarBackendError);
  assert.equal(new RadarSecrets(secret).checkCsrf(opaqueToken(), 'invalid'), false);
  const alice = await login('alice@example.invalid');
  assert.match(alice.personId, /^[a-f0-9-]{36}$/); assert.notEqual(alice.personId, alice.token);
  const again = await login('ALICE@example.invalid'); assert.equal(again.personId, alice.personId); assert.notEqual(again.token, alice.token);
  const bob = await login('bob@example.invalid'); assert.notEqual(bob.personId, alice.personId); assert.equal(await count('persons'), 2);
  passed.push('Stable UUID person, unique verified email key, normalization, two devices and a second isolated person');

  const rawDb = JSON.stringify((await db.query('select * from patrimonial_radar_private.challenges')).rows);
  assert.ok(!rawDb.includes(messages[0].code)); assert.ok(!rawDb.includes('alice@'));
  const sessions = JSON.stringify((await db.query('select * from patrimonial_radar_private.sessions')).rows); assert.ok(!sessions.includes(alice.token));
  const invalid = await challenge('invalid@example.invalid');
  const wrong = invalid.code === '99999999' ? '99999998' : '99999999';
  for (let n = 0; n < 5; n++) await fails(() => app.verifyCode({ challengeId: invalid.challengeId, code: wrong }, invalid.binding, invalid.csrf, invalid.network), 'UNAUTHENTICATED');
  assert.equal((await one('select attempts from patrimonial_radar_private.challenges where id=$1', [invalid.challengeId])).attempts, 5);
  app = service(); // A new application instance cannot reset persistent attempts.
  await fails(() => app.verifyCode({ challengeId: invalid.challengeId, code: invalid.code }, invalid.binding, invalid.csrf, invalid.network), 'UNAUTHENTICATED');
  const expired = await challenge('expired@example.invalid');
  await db.query("update patrimonial_radar_private.challenges set expires_at=clock_timestamp()-interval '1 second' where id=$1", [expired.challengeId]);
  await fails(() => app.verifyCode({ challengeId: expired.challengeId, code: expired.code }, expired.binding, expired.csrf, expired.network), 'UNAUTHENTICATED');
  const atomic = await challenge('atomic@example.invalid');
  const attempts = await Promise.allSettled([1,2].map(() => app.verifyCode({ challengeId: atomic.challengeId, code: atomic.code }, atomic.binding, atomic.csrf, atomic.network)));
  assert.equal(attempts.filter(v => v.status === 'fulfilled').length, 1);
  await fails(() => app.verifyCode({ challengeId: atomic.challengeId, code: atomic.code }, atomic.binding, atomic.csrf, atomic.network), 'UNAUTHENTICATED');
  const old = await challenge('resend@example.invalid'); await unlock('resend@example.invalid'); const fresh = await challenge('resend@example.invalid');
  await fails(() => app.verifyCode({ challengeId: old.challengeId, code: old.code }, old.binding, old.csrf, old.network), 'UNAUTHENTICATED');
  await app.verifyCode({ challengeId: fresh.challengeId, code: fresh.code }, fresh.binding, fresh.csrf, fresh.network);
  const bound = await challenge('binding@example.invalid');
  await fails(() => app.verifyCode({ challengeId: bound.challengeId, code: bound.code }, opaqueToken(), bound.csrf, bound.network), 'FORBIDDEN');
  const foreignBinding=opaqueToken(); await fails(()=>app.verifyCode({challengeId:bound.challengeId,code:bound.code},foreignBinding,app.secrets.csrf(foreignBinding),bound.network),'UNAUTHENTICATED');
  passed.push('OTP: hashed, wrong, expired, replayed, five persisted attempts, one atomic winner, resend revokes the older code and browser binding prevents login CSRF');

  const throttled = await challenge('throttle@example.invalid'); const beforeMail = messages.length;
  const suppressed = await app.requestCode('throttle@example.invalid', randomUUID()); assert.equal(messages.length, beforeMail); assert.equal(suppressed.message, throttled.message);
  for (let i = 1; i <= 5; i++) { await unlock('throttle@example.invalid'); await app.requestCode('throttle@example.invalid', randomUUID()); }
  assert.equal(messages.length, beforeMail + 4, 'Five per email in thirty minutes');
  const ip = randomUUID(), beforeIp = messages.length;
  for (let i = 0; i < 21; i++) await app.requestCode(`ip${i}@example.invalid`, ip);
  assert.equal(messages.length, beforeIp + 20);
  const failingProvider = new PatrimonialRadarService(rpc, { kind: 'SIMULATED', async sendCode() { throw new Error('fixture provider-secret'); } }, secret);
  const failed = await failingProvider.requestCode('failure@example.invalid', randomUUID()); assert.equal(failed.message, suppressed.message);
  assert.equal((await one('select delivery from patrimonial_radar_private.challenges where id=$1', [failed.challengeId])).delivery, 'FAILED');
  passed.push('Persistent email cooldown, email/network rate limits and generic accepted responses on throttling or simulated delivery failure');

  const expiredSession = await login('expired-session@example.invalid');
  await db.query("update patrimonial_radar_private.sessions set expires_at=clock_timestamp()-interval '1 second' where token_hash=$1", [app.secrets.hash('session-v1', expiredSession.token)]);
  await fails(() => app.session(expiredSession.token), 'UNAUTHENTICATED');
  const idle = await login('idle@example.invalid');
  await db.query("update patrimonial_radar_private.sessions set idle_expires_at=clock_timestamp()-interval '1 second' where token_hash=$1", [app.secrets.hash('session-v1', idle.token)]);
  await fails(() => app.session(idle.token), 'UNAUTHENTICATED');
  const revocable = await login('revocable@example.invalid'); await app.revoke(revocable.token); await fails(() => app.session(revocable.token), 'UNAUTHENTICATED');
  passed.push('Absolute and idle expiry plus server-side revocation enforced against the database');

  const requestId = randomUUID();
  const created = await app.create(alice.token, { requestId, entryMode: 'DIRECT' });
  const replayCreate = await app.create(again.token, { requestId, entryMode: 'DIRECT' }); assert.equal(replayCreate.id, created.id); assert.equal(replayCreate.replay, true);
  await fails(() => app.create(alice.token, { requestId, entryMode: 'EVENT' }), 'CONFLICT');
  const otherEpisode = await app.create(alice.token, { requestId: randomUUID(), entryMode: 'POST_EVENT' }); assert.notEqual(otherEpisode.id, created.id);
  assert.equal((await app.read(again.token, created.id)).id, created.id);
  for (const work of [() => app.read(bob.token, created.id), () => app.snapshot(bob.token, created.id), () => app.save(bob.token, created.id, { requestId: randomUUID(), expectedRevision: 0, questionId: 'RP-S01', state: 'VALUE', value: 'INDIVIDUAL' }), () => app.complete(bob.token, created.id, { requestId: randomUUID(), expectedRevision: 0 })]) await fails(work, 'NOT_FOUND');
  await fails(() => app.read(opaqueToken(), created.id), 'UNAUTHENTICATED');
  assert.equal((await app.history(bob.token)).length, 0); assert.equal((await app.history(alice.token)).length, 2);
  passed.push('Idempotent episode creation, explicit new episode, cross-device resume; cross-person read/save/snapshot/complete and guessed credentials denied');

  const saveBody = { requestId: randomUUID(), expectedRevision: 0, questionId: 'RP-S01', state: 'VALUE', value: 'HOUSEHOLD' };
  const firstSave = await app.save(alice.token, created.id, saveBody); assert.equal(firstSave.revision, 1);
  const repeated = await app.save(again.token, created.id, saveBody); assert.equal(repeated.revision, 1); assert.equal(repeated.replay, true);
  await fails(() => app.save(alice.token, created.id, { ...saveBody, value: 'INDIVIDUAL' }), 'CONFLICT');
  const unchanged = await app.save(alice.token, created.id, { ...saveBody, requestId: randomUUID(), expectedRevision: 1 }); assert.equal(unchanged.revision, 1);
  const race = await Promise.allSettled(['RP-S02','RP-S04'].map(qid => app.save(qid === 'RP-S02' ? alice.token : again.token, created.id, { requestId: randomUUID(), expectedRevision: 1, questionId: qid, state: 'UNKNOWN' })));
  assert.equal(race.filter(v => v.status === 'fulfilled').length, 1); assert.ok(race.some(v => v.status === 'rejected' && v.reason.code === 'CONFLICT'));
  assert.equal((await app.read(alice.token, created.id)).revision, 2);
  passed.push('Repeated save and lost-response replay, changed-key conflict, unchanged confirmation no-op; two device writes with one CAS winner');

  const completedEpisode = await app.create(alice.token, { requestId: randomUUID() });
  const approved = await fill(alice.token, completedEpisode.id);
  const completionBody = { requestId: randomUUID(), expectedRevision: approved.revision };
  const completions = await Promise.all([app.complete(alice.token, completedEpisode.id, completionBody), app.complete(again.token, completedEpisode.id, completionBody)]);
  assert.equal(completions[0].id, completions[1].id);
  const snapshot = completions[0]; assert.equal(snapshot.inputHash, contentHash(approved.input)); assert.equal(snapshot.resultHash, contentHash(diagnose(approved.input))); assert.deepEqual(snapshot.result, diagnose(approved.input)); assert.deepEqual(snapshot.versions, VERSIONS);
  assert.deepEqual(await app.complete(alice.token, completedEpisode.id, { requestId: randomUUID(), expectedRevision: approved.revision }), snapshot);
  await fails(() => app.complete(alice.token, completedEpisode.id, { requestId: randomUUID(), expectedRevision: approved.revision - 1 }), 'CONFLICT');
  await fails(() => app.save(alice.token, completedEpisode.id, { requestId: randomUUID(), expectedRevision: approved.revision + 1, questionId: 'RP-S01', state: 'UNKNOWN' }), 'CONFLICT');
  assert.equal((await one('select count(*) as n from patrimonial_radar_private.snapshots where assessment_id=$1', [completedEpisode.id])).n, 1);
  assert.equal(await count('integration_links'), 0);
  passed.push('Server completion equals the 4A engine exactly, pins approved revision and versions, deterministic hashes, unique immutable result, duplicate completion replay, no CRM dependency or queue');

  const mutable = await app.create(alice.token, { requestId: randomUUID() }); let current = await fill(alice.token, mutable.id);
  await app.save(alice.token, mutable.id, { requestId: randomUUID(), expectedRevision: current.revision, questionId: 'RP-C01', state: 'VALUE', value: { kinds: ['NONE'] } });
  let resumed = await app.resume(alice.token, mutable.id); assert.equal(resumed.resolved['RP-C02'].lifecycle, 'INACTIVE'); assert.equal(resumed.resolved['RP-C02'].value, undefined); assert.deepEqual(diagnose(resumed.assessment.input).indicators['I-C01'].range, point('0'), 'Verified absence uses structural zero, never the inactive historical instalment');
  await fails(() => app.save(alice.token, mutable.id, { requestId: randomUUID(), expectedRevision: resumed.assessment.revision, questionId: 'RP-C02', state: 'UNKNOWN' }), 'INVALID');
  await app.save(alice.token, mutable.id, { requestId: randomUUID(), expectedRevision: resumed.assessment.revision, questionId: 'RP-S01', state: 'VALUE', value: 'INDIVIDUAL' });
  resumed = await app.resume(again.token, mutable.id); assert.equal(resumed.resolved['RP-A01'].lifecycle, 'RECONFIRM'); assert.equal(resumed.resolved['RP-A01'].value, undefined);
  await fails(() => app.complete(alice.token, mutable.id, { requestId: randomUUID(), expectedRevision: resumed.assessment.revision }), 'INCOMPLETE');
  await fails(() => app.save(alice.token, mutable.id, { requestId: randomUUID(), expectedRevision: resumed.assessment.revision, questionId: 'RP-S01', state: 'NOT_APPLICABLE' }), 'INVALID');
  await db.query("update patrimonial_radar_private.assessments set versions='{}' where id=$1", [mutable.id]); await fails(() => app.resume(alice.token, mutable.id), 'VERSION_MISMATCH');
  passed.push('Conditional answers become inactive without deleting history; perimeter changes require reconfirmation; stale ordinary completion and methodology mismatch are blocked');

  const rollbackEpisode = await app.create(alice.token, { requestId: randomUUID() }); current = await fill(alice.token, rollbackEpisode.id, 'T01');
  await db.exec("create function public.pr_fixture_failure() returns trigger language plpgsql as $$ begin if new.action='COMPLETED' then raise exception 'FIXTURE_ROLLBACK'; end if; return new; end $$; create trigger pr_fixture_failure before insert on patrimonial_radar_private.audit_events for each row execute function public.pr_fixture_failure();");
  await fails(() => app.complete(alice.token, rollbackEpisode.id, { requestId: randomUUID(), expectedRevision: current.revision }), 'UNAVAILABLE');
  assert.equal((await app.read(alice.token, rollbackEpisode.id)).status, 'DRAFT'); assert.equal((await one('select count(*) as n from patrimonial_radar_private.snapshots where assessment_id=$1', [rollbackEpisode.id])).n, 0);
  await db.exec('drop trigger pr_fixture_failure on patrimonial_radar_private.audit_events; drop function public.pr_fixture_failure();');
  passed.push('Real SQL failure after snapshot insertion rolls back snapshot, completion state, receipt and audit atomically');

  const saveVersusComplete = await Promise.allSettled([
    app.complete(alice.token, rollbackEpisode.id, { requestId:randomUUID(), expectedRevision:current.revision }),
    app.save(again.token, rollbackEpisode.id, { requestId:randomUUID(), expectedRevision:current.revision, questionId:'RP-S04', state:'UNKNOWN' }),
  ]);
  assert.equal(saveVersusComplete.filter(v=>v.status==='fulfilled').length,1); assert.ok(saveVersusComplete.some(v=>v.status==='rejected' && v.reason.code==='CONFLICT'));
  const revokedAtCommit=await login('revoke-at-commit@example.invalid'), revokedEpisode=await app.create(revokedAtCommit.token,{requestId:randomUUID()});
  const revocableInput=await fill(revokedAtCommit.token,revokedEpisode.id,'T01');
  const fencedService=new PatrimonialRadarService({async invoke(command){if(command.method==='complete') await app.revoke(revokedAtCommit.token); return rpc.invoke(command);}},provider,secret);
  await fails(()=>fencedService.complete(revokedAtCommit.token,revokedEpisode.id,{requestId:randomUUID(),expectedRevision:revocableInput.revision}),'UNAUTHENTICATED');
  assert.equal((await one('select count(*) as n from patrimonial_radar_private.snapshots where assessment_id=$1',[revokedEpisode.id])).n,0);
  const badSecret = new PatrimonialRadarService(rpc, provider, opaqueToken());
  const peopleBefore = await count('persons'); await fails(()=>badSecret.requestCode('alice@example.invalid',randomUUID()),'UNAVAILABLE'); assert.equal(await count('persons'),peopleBefore);
  const contextDraft=await app.create(bob.token,{requestId:randomUUID()});
  await app.save(bob.token,contextDraft.id,{requestId:randomUUID(),expectedRevision:0,questionId:'RP-S01',state:'VALUE',value:'INDIVIDUAL'});
  const context=await app.read(bob.token,contextDraft.id), money=JSON.parse(JSON.stringify(buildFixture('T02')).replaceAll(T0,context.input.asOf)).answers.find(a=>a.id==='RP-A01').value;
  await fails(()=>app.save(bob.token,contextDraft.id,{requestId:randomUUID(),expectedRevision:1,questionId:'RP-A01',state:'VALUE',value:money}),'INVALID');
  await app.save(bob.token,contextDraft.id,{requestId:randomUUID(),expectedRevision:1,questionId:'RP-A01',state:'VALUE',value:{...money,scope:'INDIVIDUAL'}});
  passed.push('Save versus complete has one CAS winner; session revoked after read is denied again at commit; secret replacement fails closed without duplicate identities; foreign monetary scope is rejected');

  const flags = (await db.query("select c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='patrimonial_radar_private' and c.relkind='r'")).rows;
  assert.equal(flags.length, 12); assert.ok(flags.every(r => r.relrowsecurity && r.relforcerowsecurity));
  assert.equal((await one("select has_function_privilege('anon','public.patrimonial_radar_command(jsonb)','execute') as a, has_function_privilege('authenticated','public.patrimonial_radar_command(jsonb)','execute') as b")).a, false);
  for (const role of ['anon','authenticated']) {
    const privileges = await one("select has_schema_privilege($1,'patrimonial_radar_private','usage') as usage, has_function_privilege($1,'public.patrimonial_radar_command(jsonb)','execute') as execute", [role]); assert.equal(privileges.usage, false); assert.equal(privileges.execute, false);
    await assert.rejects(db.transaction(async tx => { await tx.exec(`set local role ${role}`); await tx.query('select public.patrimonial_radar_command($1)', [JSON.stringify({ contract: BACKEND_VERSION, method: 'session' })]); }), e => e.code === '42501');
    const marker = new Error('rollback-fixture-grants');
    await assert.rejects(db.transaction(async tx => { await tx.exec(`grant usage on schema patrimonial_radar_private to ${role}; grant select on all tables in schema patrimonial_radar_private to ${role}; set local role ${role}`); for (const table of ['persons','verified_emails','assessments','answer_revisions','snapshots','sessions']) assert.equal(Number((await tx.query(`select count(*) as n from patrimonial_radar_private.${table}`)).rows[0].n), 0, 'Forced RLS still hides rows even under accidental SELECT grants'); throw marker; }), e => e === marker);
  }
  await assert.rejects(db.query('update patrimonial_radar_private.snapshots set result=result where assessment_id=$1', [completedEpisode.id]), e => e.code === 'PT409');
  for (const sql of ['update patrimonial_radar_private.sessions set person_id=person_id','update patrimonial_radar_private.assessments set person_id=person_id','update patrimonial_radar_private.verified_emails set person_id=person_id']) await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role service_role');await tx.exec(sql);}),e=>e.code==='42501');
  for (const original of before) assert.equal((await one('select pg_get_functiondef(oid) as definition from pg_proc where pronamespace=\'public\'::regnamespace and proname=$1', [original.proname])).definition, original.definition);
  // UUIDs can contain digit sequences such as 4000: validate the actual audit contract,
  // rather than matching synthetic money substrings inside random identifiers.
  const auditRows = (await db.query('select * from patrimonial_radar_private.audit_events')).rows;
  assert.ok(auditRows.length > 0);
  for (const event of auditRows) {
    assert.deepEqual(Object.keys(event).sort(), ['id','person_id','assessment_id','action','revision','occurred_at'].sort());
    for (const key of ['id','person_id','assessment_id']) if (event[key] !== null) assert.match(event[key], /^[0-9a-f-]{36}$/);
    assert.ok(['IDENTITY_VERIFIED','ASSESSMENT_CREATED','ANSWER_SAVED','COMPLETED','SESSION_REVOKED'].includes(event.action));
    assert.ok(event.revision === null || Number.isSafeInteger(event.revision));
    assert.ok(Number.isFinite(new Date(event.occurred_at).getTime()));
  }
  assert.doesNotMatch(JSON.stringify(auditRows), /amount|alice@|code_hash|token_hash/);
  passed.push('Real SQL privileges and FORCE RLS on twelve tables, anon/authenticated RPC denial, row denial despite temporary SELECT grants, immutable snapshots and existing CRM functions unchanged');

  assert.equal(backendLocalTestEnabled({}), false); assert.equal(backendLocalTestEnabled({ PATRIMONIAL_RADAR_BACKEND_ENABLED: 'true', PATRIMONIAL_RADAR_BACKEND_CONTEXT: 'local-test', VERCEL: '1' }), false);
  const off = await handleRadarBackend(new Request('http://127.0.0.1/api/patrimonial-radar/session'), {}); assert.equal(off.status, 404);
  assert.throws(() => new LocalSupabaseRadarRpc({ url: 'https://project.supabase.co', serverKey: 'fixture' }), RadarBackendError);
  let calls = 0;
  const transport = new LocalSupabaseRadarRpc({ url: 'http://127.0.0.1:54321', serverKey: 'fixture-server-key', fetchImpl: async () => { calls++; return Response.json({ error: 'fixture-secret 4000' }, { status: 500 }); } });
  await fails(() => transport.invoke({ method: 'complete' }), 'UNAVAILABLE'); assert.equal(calls, 1, 'No ambiguous retry');
  passed.push('Default OFF, Vercel denied, remote database URLs rejected, transport details sanitized and no automatic retry of ambiguous commits');

  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening'); const origin = `http://127.0.0.1:${server.address().port}`;
  const handler = createPatrimonialRadarHandler(app, { origin, production: false, enabled: true });
  server.on('request', async (req, res) => { try { const chunks = []; for await (const chunk of req) chunks.push(chunk); const response = await handler(new Request(`${origin}${req.url}`, { method: req.method, headers: req.headers, ...(!['GET','HEAD'].includes(req.method) ? { body: Buffer.concat(chunks) } : {}) })); res.statusCode = response.status; for (const [key,value] of response.headers) if (key !== 'set-cookie') res.setHeader(key,value); res.setHeader('Set-Cookie', response.headers.getSetCookie()); res.end(Buffer.from(await response.arrayBuffer())); } catch { res.statusCode=500; res.end(); } });
  try {
    const url = path => `${origin}/api/patrimonial-radar${path}`;
    const post = (path, body, headers = {}) => fetch(url(path), { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    assert.equal((await post('/identity/request', { email:'http@example.invalid' })).status, 403);
    const challengeResponse = await post('/identity/request', { email:'http@example.invalid' }, { 'X-Patrimonial-CSRF':'request-code' }); assert.equal(challengeResponse.status, 202);
    const challengeJson = await challengeResponse.json(), bindingCookie = challengeResponse.headers.getSetCookie()[0].split(';')[0]; assert.match(challengeResponse.headers.getSetCookie()[0], /HttpOnly; SameSite=Strict/); assert.ok(!('binding' in challengeJson)); assert.ok(!('code' in challengeJson));
    const verify = await post('/identity/verify', { challengeId: challengeJson.challengeId, code: messages.at(-1).code }, { Cookie: bindingCookie, 'X-Patrimonial-CSRF': challengeJson.csrf }); assert.equal(verify.status, 200);
    const identity = await verify.json(), sessionCookie = verify.headers.getSetCookie().find(c => c.startsWith('pr_session=')).split(';')[0]; assert.ok(!('token' in identity));
    assert.equal((await fetch(url('/session'), { headers:{ Cookie: sessionCookie } })).status, 200);
    assert.equal((await post('/assessments', { requestId:randomUUID() }, { Cookie: sessionCookie })).status, 403);
    assert.equal((await post('/assessments', { requestId:randomUUID() }, { Cookie: sessionCookie, Origin:'https://evil.invalid', 'X-Patrimonial-CSRF':identity.csrf })).status, 403);
    assert.equal((await post('/assessments', { requestId:randomUUID(), personId:bob.personId }, { Cookie: sessionCookie, 'X-Patrimonial-CSRF':identity.csrf })).status, 400);
    const httpCreated = await post('/assessments', { requestId:randomUUID() }, { Cookie:sessionCookie, 'X-Patrimonial-CSRF':identity.csrf }); assert.equal(httpCreated.status, 201); const httpId=(await httpCreated.json()).id;
    for (const [expectedRevision,value] of [[0,'HOUSEHOLD'],[1,'INDIVIDUAL']]) assert.equal((await post(`/assessments/${httpId}/answer`,{requestId:randomUUID(),expectedRevision,questionId:'RP-S01',state:'VALUE',value},{Cookie:sessionCookie,'X-Patrimonial-CSRF':identity.csrf})).status,200);
    const httpDraft=await (await fetch(url(`/assessments/${httpId}`),{headers:{Cookie:sessionCookie}})).json(); assert.equal(httpDraft.assessment.input.answers.length,1); assert.equal(httpDraft.assessment.input.answers[0].revision,2); assert.equal(httpDraft.resolved['RP-S01'].value,undefined);
    const snapshotReply=await fetch(url(`/assessments/${completedEpisode.id}/snapshot`),{headers:{Cookie:`pr_session=${alice.token}`}}); assert.equal(snapshotReply.status,200); const snapshotMetadata=await snapshotReply.json(); assert.equal(snapshotMetadata.id,snapshot.id); assert.equal(snapshotMetadata.result,undefined); assert.equal(snapshotMetadata.answerRefs,undefined); assert.equal(snapshotMetadata.customer.projectionVersion,'RP-CLIENT-4C2-1'); assert.doesNotMatch(JSON.stringify(snapshotMetadata.customer), /"(indicators|profiles|history|answers|interviewQuestions|resources|experience|target|formula|refs)":/);
    const completedReply=await post(`/assessments/${completedEpisode.id}/complete`,completionBody,{Cookie:`pr_session=${alice.token}`,'X-Patrimonial-CSRF':app.secrets.csrf(alice.token)}); assert.equal(completedReply.status,200); assert.deepEqual(await completedReply.json(),snapshotMetadata);
    const stolen = await fetch(url(`/assessments/${httpId}`), { headers:{ Cookie:`pr_session=${bob.token}` } }); assert.equal(stolen.status, 404); assert.deepEqual(await stolen.json(), { error:'NOT_FOUND' }); assert.match(stolen.headers.get('cache-control'), /no-store/);
    assert.equal((await fetch(`${url('/session')}?token=${alice.token}`)).status, 400);
    assert.equal((await post('/identity/verify', { challengeId:challengeJson.challengeId, code:'12345678' }, { Cookie:bindingCookie, 'X-Patrimonial-CSRF':challengeJson.csrf })).status, 401);
    const secureHandler=createPatrimonialRadarHandler(app,{ origin,production:true,enabled:true }); const secure=await secureHandler(new Request(url('/identity/request'),{ method:'POST',headers:{ Origin:origin,'Content-Type':'application/json','X-Patrimonial-CSRF':'request-code' },body:JSON.stringify({ email:'secure-cookie@example.invalid' }) })); assert.match(secure.headers.get('set-cookie'), /__Host-pr_login=.*Path=\/; HttpOnly; SameSite=Strict; Max-Age=600; Secure/);
    const secureChallenge=await secure.json(), secureBinding=secure.headers.getSetCookie()[0].split(';')[0];
    const secureVerified=await secureHandler(new Request(url('/identity/verify'),{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:secureBinding,'X-Patrimonial-CSRF':secureChallenge.csrf},body:JSON.stringify({challengeId:secureChallenge.challengeId,code:messages.at(-1).code})})); assert.equal(secureVerified.status,200); assert.match(secureVerified.headers.getSetCookie().find(c=>c.startsWith('__Host-pr_session=')),/HttpOnly; SameSite=Strict; Max-Age=\d+; Secure/);
    const oversized=await post('/assessments',{requestId:randomUUID(),extra:'x'.repeat(70_000)},{Cookie:sessionCookie,'X-Patrimonial-CSRF':identity.csrf}); assert.equal(oversized.status,400);
    assert.equal((await fetch(url('/session'),{headers:{Cookie:sessionCookie,'Sec-Fetch-Site':'same-site'}})).status,403);
    const revoke=await post('/session/revoke',{ allDevices:true },{ Cookie:sessionCookie,'X-Patrimonial-CSRF':identity.csrf }); assert.equal(revoke.status,200); assert.equal((await fetch(url('/session'),{headers:{Cookie:sessionCookie}})).status,401);
  } finally { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
  passed.push('Real loopback HTTP boundary: HttpOnly/Strict cookies, Secure production prefix, CSRF and Origin, generic OTP responses, no bearer/code response, rejected client person IDs and URL tokens, owner-only reads, revoke');

  await app.revoke(alice.token, true); await fails(() => app.session(again.token), 'UNAUTHENTICATED');
  const dump=await db.dumpDataDir(); const restored=await PGlite.create({loadDataDir:dump});
  try {
    const restarted=new PatrimonialRadarService(radarDatabaseRpc(restored),provider,secret);
    assert.equal((await restarted.session(bob.token)).personId,bob.personId);
    assert.equal((await restarted.read(bob.token,contextDraft.id)).revision,2);
    await fails(()=>restarted.session(alice.token),'UNAUTHENTICATED');
    await fails(()=>restarted.verifyCode({challengeId:invalid.challengeId,code:invalid.code},invalid.binding,invalid.csrf,invalid.network),'UNAUTHENTICATED');
    const sent=messages.length; await restarted.requestCode('throttle@example.invalid',randomUUID()); assert.equal(messages.length,sent);
  } finally { await restored.close(); }
  passed.push('Cold database restore preserves verified person, draft, session revocation, exhausted OTP attempts and rate limits');
  assert.equal(external, 0);
  const source = ['service.ts','security.ts','store.ts','http.ts','runtime.ts'].map(f=>readFileSync(`src/lib/patrimonial-radar-server/${f}`,'utf8')).join('\n');
  assert.doesNotMatch(source, /console\.|localStorage|sessionStorage|\/api\/radar\b|public-leads|Resend|HighLevel/);
  assertPublicPilotPreservation('90592d99f3bf930a968cadab71ea312abfacc858',['src/lib/patrimonial-radar','src/lib/radar','src/components/radar','src/lib/public-leads','public']);
  console.log(passed.map(message=>`PASS ${message}`).join('\n'));
  console.log(`PASS ${passed.length} groups; real local PostgreSQL WASM (single connection, not native multi-connection MVCC); simulated email, zero external calls. No remote migration or live smoke.`);
} finally { globalThis.fetch=nativeFetch; await db.close(); }
