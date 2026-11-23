import { createHash, createHmac, randomBytes } from 'node:crypto';
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
  functionName: 'architect_candidate_intake_v1' | 'architect_candidate_crm_v1' | 'architect_candidate_startup_issue_v1' | 'architect_candidate_startup_confirm_v1' | 'architect_startup_lead_begin_v1' | 'architect_startup_lead_confirm_v1' | 'architect_startup_video_gate_v1',
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
): Promise<string | null> {
  if (!settings(env)) return null; // explicit preview-gated cutover
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
  return result;
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


/** Generates a 256-bit, short-lived access link only after durable candidate intake. */
export async function issueArchitectStartupLink(
  env: Env,
  candidateId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(candidateId)) throw new Error('invalid_architect_candidate_id');
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const ok = await invokeHub(env, 'architect_candidate_startup_issue_v1', {
    p_candidate_id: candidateId, p_token_hash: tokenHash,
  }, fetchImpl);
  if (ok !== true) throw new Error('architect_startup_link_not_issued');
  // Fragment avoids propagating a bearer token via page requests or Referer headers.
  return `/candidature/architetti-patrimoniali/startup#token=${token}`;
}


/** A private 7-day draft only: no candidate exists in Selezione before video confirmation. */
export async function beginArchitectStartupLead(
  env: Env,
  lead: { firstName: string; lastName: string; email: string; phone: string; privacyVersion: string },
  sourceIp: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const cfg = settings(env);
  if (!cfg) throw new Error('architect_startup_unavailable');
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const today = new Date().toISOString().slice(0, 10);
  const ipHash = createHmac('sha256', cfg.key)
    .update(`startup-minimal-v1:${today}:${sourceIp.slice(0, 80)}`).digest('hex');
  const ok = await invokeHub(env, 'architect_startup_lead_begin_v1', {
    p_token_hash: tokenHash,
    p_first_name: lead.firstName,
    p_last_name: lead.lastName,
    p_email: lead.email,
    p_phone: lead.phone,
    p_privacy_version: lead.privacyVersion,
    p_ip_hash: ipHash,
    p_consent: true,
  }, fetchImpl);
  if (ok !== true) throw new Error('architect_startup_draft_rejected');
  return `/candidature/architetti-patrimoniali/startup#token=${token}`;
}

/** The server starts the invisible gate at first page open. Refreshing does not restart it. */
export async function getArchitectStartupVideoGate(
  env: Env,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<number | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const hash = createHash('sha256').update(token).digest('hex');
  const remaining = await invokeHub(env, 'architect_startup_video_gate_v1', {
    p_token_hash: hash,
  }, fetchImpl);
  if (typeof remaining !== 'number' || !Number.isInteger(remaining) ||
    remaining < 0 || remaining > 661) return null;
  return remaining;
}

/** Idempotent declaration of interest; not evidence of a complete video watch. */
export async function confirmArchitectStartupInterest(
  env: Env,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const hash = createHash('sha256').update(token).digest('hex');
  // New minimal flow creates the dossier here. Legacy CV-based tokens still work.
  if (await invokeHub(env, 'architect_startup_lead_confirm_v1', {
    p_token_hash: hash,
  }, fetchImpl) === true) return true;
  return await invokeHub(env, 'architect_candidate_startup_confirm_v1', {
    p_token_hash: hash,
  }, fetchImpl) === true;
}
