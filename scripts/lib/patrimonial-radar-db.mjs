import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { unwrap } from '../../src/lib/patrimonial-radar-server/store.ts';
import { RadarBackendError } from '../../src/lib/patrimonial-radar-server/contracts.ts';

export const radarMigration = 'supabase/migrations/20261018191940_patrimonial_radar_identity_sessions.sql';
const override = process.argv.find(arg=>arg.startsWith('--pg-module='))?.slice('--pg-module='.length);
export const { PGlite } = override ? await import(pathToFileURL(resolve(override)).href) : await import('@electric-sql/pglite');
export async function createRadarDatabase(options = {}) {
  // Real PostgreSQL WASM, ephemeral by default. This module is test-only, never imported by Next.
  const db = await PGlite.create(options);
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(await readFile('supabase/migrations/20261014225059_patrimonial_lead_v2.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261015100912_patrimonial_opportunity_jsonb_precedence.sql', 'utf8'));
  const before = (await db.query("select proname, pg_get_functiondef(oid) as definition from pg_proc where pronamespace='public'::regnamespace order by proname")).rows;
  await db.exec(await readFile(radarMigration, 'utf8'));
  return { db, rpc: radarDatabaseRpc(db), before };
}
export function radarDatabaseRpc(db) {
  return { async invoke(command) {
    let reply;
    try {
      reply = await db.transaction(async tx => {
        await tx.exec('set local role service_role');
        return (await tx.query('select public.patrimonial_radar_command($1::jsonb) as reply', [JSON.stringify(command)])).rows[0].reply;
      });
    } catch { throw new RadarBackendError('UNAVAILABLE'); }
    // Important: OTP rejection must commit its attempt counter before throwing to the caller.
    return unwrap(reply);
  } };
}
