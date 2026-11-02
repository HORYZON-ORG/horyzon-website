import type { DigitalSubmission } from './contract';

export type DigitalReceipt = { id: string; replay: boolean };
export type DigitalCrmRow = {
  id: string; request_id: string; first_name: string; last_name: string;
  company_name: string; email: string; phone: string | null; province: string;
  activity: string; frequency: string; tools: string; territory: string;
  privacy_version: string; crm_contact_id: string | null;
  crm_step: 'upsert' | 'tags' | 'note' | 'opportunity' | 'done';
  crm_opportunity_id: string | null;
  crm_lease_token: string; crm_attempts: number;
};
export class DigitalStoreError extends Error {
  constructor(public readonly code: string) { super(code); }
}
export type DigitalEnv = Record<string, string | undefined>;

async function digitalRpc<T>(name: string, args: Record<string, unknown>, env: DigitalEnv, fetcher: typeof fetch = fetch): Promise<T> {
  const origin = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!origin || !key || /^sb_publishable_/.test(key)) throw new DigitalStoreError('STORE_NOT_CONFIGURED');
  let parsed: URL;
  try { parsed = new URL(origin); } catch { throw new DigitalStoreError('STORE_NOT_CONFIGURED'); }
  if (parsed.protocol !== 'https:' && !(env.NODE_ENV === 'test' && parsed.hostname === 'localhost')) throw new DigitalStoreError('STORE_NOT_CONFIGURED');
  const headers: Record<string,string> = {
    apikey: key, 'Content-Type': 'application/json', 'Accept': 'application/json',
    'Accept-Profile': 'hub', 'Content-Profile': 'hub',
    ...(key.startsWith('sb_') ? {} : { Authorization: 'Bearer ' + key }),
  };
  let response: Response;
  try {
    response = await fetcher(new URL('/rest/v1/rpc/' + name, parsed.origin), {
      method: 'POST', cache: 'no-store', redirect: 'error', headers,
      signal: AbortSignal.timeout(9000), body: JSON.stringify(args),
    });
  } catch { throw new DigitalStoreError('STORE_UNAVAILABLE'); }
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { message?: string; code?: string };
    if (error.message === 'DIGITAL_RATE_LIMIT') throw new DigitalStoreError('RATE_LIMIT');
    if (error.message === 'DIGITAL_REPLAY_CONFLICT') throw new DigitalStoreError('REPLAY_CONFLICT');
    if (error.message === 'DIGITAL_INVALID_INPUT') throw new DigitalStoreError('INVALID_INPUT');
    throw new DigitalStoreError('STORE_UNAVAILABLE');
  }
  try { return await response.json() as T; } catch { throw new DigitalStoreError('STORE_UNAVAILABLE'); }
}

export function acquireDigitalLead(submission: DigitalSubmission, rateKey: string, env: DigitalEnv = process.env, fetcher?: typeof fetch): Promise<DigitalReceipt> {
  return digitalRpc('digital_intake_submit_v1', {
    p_request_id: submission.requestId, p_hash: submission.hash,
    p_payload: submission.payload, p_bucket: rateKey,
  }, env, fetcher);
}
export function claimDigitalCrmJobs(requestId: string | null, limit: number, env: DigitalEnv = process.env, fetcher?: typeof fetch): Promise<DigitalCrmRow[]> {
  return digitalRpc('digital_crm_claim_v1',{p_request_id:requestId,p_limit:limit},env,fetcher);
}
export function progressDigitalCrm(row: DigitalCrmRow, nextStep: 'tags' | 'note' | 'opportunity', contactId: string, env: DigitalEnv = process.env, fetcher?: typeof fetch): Promise<boolean> {
  return digitalRpc('digital_crm_progress_v1',{p_id:row.id,p_token:row.crm_lease_token,p_step:nextStep,p_contact_id:contactId},env,fetcher);
}
export function finishDigitalCrm(row: DigitalCrmRow, success: boolean, contactId: string | null, errorCode: string | null, env: DigitalEnv = process.env, fetcher?: typeof fetch): Promise<boolean> {
  return digitalRpc('digital_crm_finish_v1',{p_id:row.id,p_token:row.crm_lease_token,p_success:success,p_contact_id:contactId,p_error:errorCode},env,fetcher);
}
