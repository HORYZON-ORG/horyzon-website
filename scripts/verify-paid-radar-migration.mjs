import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationPath = process.argv[2];
assert(migrationPath, 'migration path is required');
const sql = (await readFile(migrationPath, 'utf8')).toLowerCase();

for (const fragment of [
  'hub.radar_purchases',
  'hub.radar_entitlement_grants',
  'hub.radar_stripe_events',
  'hub.radar_access_events',
  'owner_secret_hash',
  'progress_percent',
  'radar_save_answer',
  'radar_grant_paid_access',
  'revoke all',
]) assert(sql.includes(fragment), `missing migration contract: ${fragment}`);

assert(!/grant\s+[\s\S]{0,120}\s+to\s+(anon|authenticated)\b/i.test(sql), 'Radar commerce must not grant browser roles');
assert(sql.includes('force row level security'), 'Radar commerce tables must force RLS');

console.log('Paid Radar migration verifier passed');
