import {
  claimDigitalCrmJobs, progressDigitalCrm, finishDigitalCrm, saveDigitalOpportunityId,
  type DigitalCrmRow, type DigitalEnv,
} from './store';

type CrmStats = { claimed: number; synced: number; retry: number };
const API_BASE = 'https://services.leadconnectorhq.com';
const VERSION = '2021-07-28';
const OPPORTUNITY_VERSION = 'v3';
const FREQUENCY: Record<string, string> = {
  daily: 'Ogni giorno', weekly: 'Ogni settimana', monthly: 'Ogni mese', other: 'Variabile',
};
async function highLevelPost<T>(token: string, path: string, body: unknown, fetcher: typeof fetch, version: string = VERSION): Promise<T> {
  let response: Response;
  try {
    response = await fetcher(API_BASE + path, {
      method: 'POST', cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(8500),
      headers: {
        Authorization: 'Bearer ' + token, Version: version,
        Accept: 'application/json', 'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch { throw new Error('CRM_NETWORK'); }
  if (!response.ok) throw new Error(response.status === 429 ? 'CRM_RATE_LIMIT' :
    response.status === 401 || response.status === 403 ? 'CRM_PERMISSION' :
    response.status >= 500 ? 'CRM_UNAVAILABLE' : 'CRM_PROVIDER_REVIEW');
  try { return await response.json() as T; } catch { throw new Error('CRM_BAD_RESPONSE'); }
}

async function highLevelGet<T>(token: string, path: string, fetcher: typeof fetch): Promise<T> {
  let response: Response;
  try {
    response=await fetcher(API_BASE + path,{method:'GET',cache:'no-store',redirect:'error',
      signal:AbortSignal.timeout(8500),
      headers:{Authorization:'Bearer '+token,Version:OPPORTUNITY_VERSION,Accept:'application/json'}});
  } catch { throw new Error('CRM_NETWORK'); }
  if(!response.ok) throw new Error(response.status===429?'CRM_RATE_LIMIT':response.status===401||response.status===403?'CRM_PERMISSION':'CRM_OPPORTUNITY_SEARCH');
  try {return await response.json() as T;} catch {throw new Error('CRM_BAD_RESPONSE');}
}
async function findExistingOpportunity(token:string,locationId:string,pipelineId:string,contactId:string,fetcher:typeof fetch):Promise<string|null>{
  const params=new URLSearchParams({locationId,pipelineId,contactId,status:'all',limit:'30'});
  const result=await highLevelGet<{opportunities?:Array<{id?:string;pipelineId?:string;contactId?:string}>}>(
    token,'/opportunities/search?'+params.toString(),fetcher);
  const item=result.opportunities?.find(x=>x.pipelineId===pipelineId && x.contactId===contactId && x.id);
  return item?.id??null;
}

async function pushOne(row: DigitalCrmRow, token: string, locationId: string, env: DigitalEnv, fetcher: typeof fetch): Promise<void> {
  let step = row.crm_step;
  let contactId = row.crm_contact_id;
  if (step === 'upsert') {
    const created = await highLevelPost<{contact?:{id?:string}}>(token, '/contacts/upsert', {
      locationId, firstName: row.first_name, lastName: row.last_name,
      companyName: row.company_name, email: row.email,
      ...(row.phone ? { phone: row.phone } : {}),
      country: 'IT', source: 'Horyzon · Benessere Digitale (horyzon.it)',
    },fetcher);
    if (!created.contact?.id) throw new Error('CRM_BAD_RESPONSE');
    contactId = created.contact.id;
    if (!(await progressDigitalCrm(row,'tags',contactId,env,fetcher))) throw new Error('CRM_STALE_CLAIM');
    step = 'tags';
  }
  if (!contactId) throw new Error('CRM_MISSING_CONTACT');
  const urlId = encodeURIComponent(contactId);
  if (step === 'tags') {
    await highLevelPost(token, '/contacts/' + urlId + '/tags', {
      tags: ['horyzon-benessere-digitale', 'horyzon-digitale-richiesta'],
    }, fetcher);
    if (!(await progressDigitalCrm(row,'note',contactId,env,fetcher))) throw new Error('CRM_STALE_CLAIM');
    step = 'note';
  }
  if (step === 'note') {
    // A request reference helps detect duplicate notes if the provider times out
    // after accepting a write. No lead gets added to marketing campaigns.
    const body = [
      'Benessere Digitale Horyzon · richiesta dal sito',
      'Riferimento: ' + row.request_id,
      'Azienda: ' + row.company_name,
      'Provincia: ' + row.province + ' · territorio suggerito: ' + row.territory,
      'Attività: ' + row.activity,
      'Frequenza: ' + (FREQUENCY[row.frequency] ?? row.frequency),
      'Strumenti: ' + (row.tools || 'Non specificati'),
      'Informativa: ' + row.privacy_version + ' · ricontatto richiesto; nessun consenso marketing.',
      'Dossier operativo: Hub Horyzon / Benessere Digitale',
    ].join('\n');
    await highLevelPost(token,'/contacts/' + urlId + '/notes',{body},fetcher);
    if (!(await progressDigitalCrm(row,'opportunity',contactId,env,fetcher))) throw new Error('CRM_STALE_CLAIM');
    step='opportunity';
  }
  if (step === 'opportunity') {
    const pipelineId=env.DIGITAL_PIPELINE_ID, stageId=env.DIGITAL_PIPELINE_STAGE_NEW_ID;
    if (!pipelineId || !stageId) throw new Error('CRM_PIPELINE_MISSING');
    let opportunityId=row.crm_opportunity_id;
    if(!opportunityId){
      opportunityId=await findExistingOpportunity(token,locationId,pipelineId,contactId,fetcher);
      if(!opportunityId){
        const created=await highLevelPost<{opportunity?:{id?:string}}>(
          token,'/opportunities/',{locationId,pipelineId,pipelineStageId:stageId,
          contactId,name:'Benessere Digitale · '+row.company_name,status:'open'},
          fetcher,OPPORTUNITY_VERSION);
        opportunityId=created.opportunity?.id??null;
      }
      if(!opportunityId) throw new Error('CRM_BAD_RESPONSE');
      if (!(await saveDigitalOpportunityId(row,opportunityId,env,fetcher))) throw new Error('CRM_STALE_CLAIM');
    }
  }
  if (!(await finishDigitalCrm(row,true,contactId,null,env,fetcher))) throw new Error('CRM_STALE_CLAIM');
}

export async function runDigitalCrmDrain(
  options: { requestId?: string | null; limit?: number; env?: DigitalEnv; fetcher?: typeof fetch } = {},
): Promise<CrmStats> {
  const env = options.env ?? process.env;
  if (env.DIGITAL_CRM_SYNC_ENABLED !== 'true') return { claimed: 0, synced: 0, retry: 0 };
  const token = env.HIGHLEVEL_PRIVATE_TOKEN, locationId = env.HIGHLEVEL_LOCATION_ID;
  if (!token || !locationId) return { claimed: 0, synced: 0, retry: 0 };
  const fetcher = options.fetcher ?? fetch;
  const claims = await claimDigitalCrmJobs(options.requestId ?? null, Math.max(1,Math.min(options.limit ?? 8, 12)),env,fetcher);
  const stats = {claimed:claims.length,synced:0,retry:0};
  for (const row of claims) {
    try {
      await pushOne(row,token,locationId,env,fetcher);
      stats.synced++;
    } catch (error) {
      stats.retry++;
      const code = error instanceof Error && /^CRM_[A-Z_]+$/.test(error.message) ? error.message : 'CRM_FAILED';
      // A failed external write must not remove the local record or expose provider output.
      try { await finishDigitalCrm(row,false,null,code,env,fetcher); } catch { /* lease expiry will be recovered by cron */ }
    }
  }
  return stats;
}
