import { createHash } from 'node:crypto';
import { PATRIMONIAL_PILOT_PRIVACY_VERSION, pilotForms } from '../../content/patrimonial-funnels.ts';
import type { PilotLead } from './patrimonial-funnels.ts';

type ArchitectLead = Extract<PilotLead, { mode: 'architect-path' }>;
type Env = Record<string, string | undefined>;

function settings(env: Env) {
  if (env.PATRIMONIAL_ARCHITECT_HUB_INTAKE_ENABLED !== 'true') return null;
  const url = (env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL)?.trim().replace(/\/+$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  // In deployed environments a wrong project would silently separate CVs and applications.
  // Tests intentionally use a synthetic local store only.
  const officialProjectUrl = 'https://pmkyeqrfkunypfkbjnyg.supabase.co';
  if (!url || !key || (env.NODE_ENV !== 'test' && url !== officialProjectUrl)) throw new Error('architect_hub_intake_not_configured');
  return { url, key };
}

async function invokeHub(
  env: Env,
  functionName: 'architect_candidate_intake_v1' | 'architect_candidate_crm_v1',
  params: Record<string, unknown>,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const cfg = settings(env);
  if (!cfg) return null;
  const response = await fetchImpl(`${cfg.url}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Profile': 'hub',
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      Accept: 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(10000),
  });
  // Never surface the response body (it may contain provider/database details).
  if (!response.ok) throw new Error('architect_hub_rpc_failed');
  return response.json().catch(() => null);
}

/** Server-only. Replayed submissions with the same CV and payload return the same candidate ID. */
export async function registerArchitectCandidate(
  env: Env,
  cvId: string,
  lead: ArchitectLead,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!settings(env)) return false; // explicit preview-gated cutover
  const data = {
    ...lead,
    sourcePath: pilotForms['architect-path'].path,
    privacyVersion: PATRIMONIAL_PILOT_PRIVACY_VERSION,
  };
  const hash = createHash('sha256').update(JSON.stringify({ cvId, data })).digest('hex');
  const result = await invokeHub(env, 'architect_candidate_intake_v1', {
    p_cv_id: cvId, p_hash: hash, p_data: data,
  }, fetchImpl);
  if (typeof result !== 'string' || !/^[0-9a-f-]{36}$/i.test(result)) {
    throw new Error('architect_hub_receipt_missing');
  }
  return true;
}

/** CRM is a projection: failure must never remove the private candidate record or CV. */
export async function markArchitectCandidateCrm(
  env: Env,
  cvId: string,
  contactId: string | null,
  success: boolean,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!settings(env)) return;
  await invokeHub(env, 'architect_candidate_crm_v1', {
    p_cv_id: cvId, p_contact_id: contactId, p_success: success,
  }, fetchImpl);
}
