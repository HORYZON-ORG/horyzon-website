import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
await db.exec(`
  create role anon;
  create role authenticated;
  create role service_role;
  create schema hub;

  create table hub.architect_candidates (
    id uuid primary key default gen_random_uuid(),
    cv_id uuid,
    intake_hash text not null,
    first_name text not null,
    last_name text not null,
    email text not null,
    phone text not null,
    province text not null,
    source_path text not null,
    utm jsonb not null default '{}'::jsonb,
    privacy_version text not null,
    marketing_consent boolean not null default false,
    startup_confirmed_at timestamptz,
    received_at timestamptz not null default now()
  );
  create table hub.architect_candidate_history (
    candidate_id uuid not null references hub.architect_candidates(id),
    kind text not null,
    recorded_at timestamptz not null
  );
  create table hub.architect_startup_pending_leads (
    token_hash text primary key,
    first_name text,
    last_name text,
    email text,
    phone text,
    privacy_version text,
    ip_hash text not null,
    issued_at timestamptz not null default now(),
    expires_at timestamptz not null default now() + interval '7 days',
    confirmed_at timestamptz,
    candidate_id uuid unique references hub.architect_candidates(id),
    video_opened_at timestamptz,
    video_progress_seconds numeric not null default 0,
    video_progress_at timestamptz,
    video_completed_at timestamptz
  );

  insert into hub.architect_startup_pending_leads (
    token_hash, first_name, last_name, email, phone, privacy_version, ip_hash
  ) values (
    '${'e'.repeat(64)}', 'Lead', 'Preesistente', 'legacy@example.invalid',
    '+393331234569', 'patrimonial-pilot-privacy-v1', '${'f'.repeat(64)}'
  );
`);

const migration = await readFile(new URL(
  '../supabase/migrations/20261124160918_architect_startup_utm_attribution.sql',
  import.meta.url,
), 'utf8');
await db.exec(migration);

const legacyPending = await db.query(`select utm
  from hub.architect_startup_pending_leads where token_hash=$1`, ['e'.repeat(64)]);
assert.deepEqual(legacyPending.rows[0].utm, {}, 'pre-migration pending leads receive empty attribution');

const tokenHash = 'a'.repeat(64);
const ipHash = 'b'.repeat(64);
const begin = await db.query(`select hub.architect_startup_lead_begin_v2(
  $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb
) as accepted`, [
  tokenHash, 'Persona', 'Test', 'candidate@example.invalid', '+393331234567',
  'patrimonial-pilot-privacy-v1', ipHash, true,
  JSON.stringify({ utm_source: 'indeed', utm_medium: 'job_board', utm_campaign: 'bari' }),
]);
assert.equal(begin.rows[0].accepted, true);

const invalid = await db.query(`select hub.architect_startup_lead_begin_v2(
  $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb
) as accepted`, [
  'c'.repeat(64), 'Persona', 'Test', 'other@example.invalid', '+393331234568',
  'patrimonial-pilot-privacy-v1', 'd'.repeat(64), true,
  JSON.stringify({ unknown: 'not-allowed' }),
]);
assert.equal(invalid.rows[0].accepted, false);

await db.query('update hub.architect_startup_pending_leads set video_completed_at=now() where token_hash=$1', [tokenHash]);
const confirmed = await db.query('select hub.architect_startup_lead_confirm_v1($1) as accepted', [tokenHash]);
assert.equal(confirmed.rows[0].accepted, true);
const replay = await db.query('select hub.architect_startup_lead_confirm_v1($1) as accepted', [tokenHash]);
assert.equal(replay.rows[0].accepted, true, 'confirmation remains idempotent');

const candidates = await db.query('select utm, source_path from hub.architect_candidates');
assert.equal(candidates.rows.length, 1);
assert.deepEqual(candidates.rows[0].utm, {
  utm_source: 'indeed', utm_medium: 'job_board', utm_campaign: 'bari',
});
assert.equal(candidates.rows[0].source_path, '/candidature/architetti-patrimoniali/startup');
const pending = await db.query('select first_name, email, utm, candidate_id is not null as linked from hub.architect_startup_pending_leads where token_hash=$1', [tokenHash]);
assert.equal(pending.rows[0].first_name, null);
assert.equal(pending.rows[0].email, null);
assert.deepEqual(pending.rows[0].utm, {});
assert.equal(pending.rows[0].linked, true);

const privileges = await db.query(`select
  has_function_privilege('anon','hub.architect_startup_lead_begin_v2(text,text,text,text,text,text,text,boolean,jsonb)','execute') as anon_execute,
  has_function_privilege('authenticated','hub.architect_startup_lead_begin_v2(text,text,text,text,text,text,text,boolean,jsonb)','execute') as authenticated_execute,
  has_function_privilege('service_role','hub.architect_startup_lead_begin_v2(text,text,text,text,text,text,text,boolean,jsonb)','execute') as service_execute,
  has_function_privilege('anon','hub.architect_startup_lead_confirm_v1(text)','execute') as anon_confirm,
  has_function_privilege('authenticated','hub.architect_startup_lead_confirm_v1(text)','execute') as authenticated_confirm,
  has_function_privilege('service_role','hub.architect_startup_lead_confirm_v1(text)','execute') as service_confirm`);
assert.equal(privileges.rows[0].anon_execute, false);
assert.equal(privileges.rows[0].authenticated_execute, false);
assert.equal(privileges.rows[0].service_execute, true);
assert.equal(privileges.rows[0].anon_confirm, false);
assert.equal(privileges.rows[0].authenticated_confirm, false);
assert.equal(privileges.rows[0].service_confirm, true);

await db.close();
console.log('PASS: Startup UTM migration validates, persists, transfers, minimizes and restricts attribution');
