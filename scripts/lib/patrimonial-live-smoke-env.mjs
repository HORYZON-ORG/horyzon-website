import { readFile } from 'node:fs/promises';
import path from 'node:path';
import nextEnv from '@next/env';

// Only this CLI loads the secret file. Never log parser errors or file contents.
// @next/env preserves variables already present in the process, including empty.
export async function loadSmokeEnv({ cwd = process.cwd(), read = readFile } = {}) {
  let contents;
  try { contents = await read(path.join(cwd, '.env.local'), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return process.env; throw new Error('LOCAL_ENV_UNREADABLE'); }
  let failed = false;
  nextEnv.processEnv([{ path: '.env.local', contents, env: {} }], cwd, { info() {}, error() { failed = true; } }, true);
  if (failed) throw new Error('LOCAL_ENV_INVALID');
  return process.env;
}

export function smokeEnvPresence(env) {
  return Object.fromEntries(['HIGHLEVEL_LOCATION_ID', 'HIGHLEVEL_PRIVATE_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL']
    .map(name => [name, (name.includes(' / ') ? env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL : env[name])?.trim() ? 'PRESENT' : 'MISSING']));
}
