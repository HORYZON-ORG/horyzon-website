// Preview-only, zero-write HighLevel integration readiness probe.
// Never logs API tokens, location details, CRM contacts or provider bodies.
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const URL_ROOT='https://services.leadconnectorhq.com';
const BRANCH='feat/patrimonial-pilot-funnels';

export async function checkArchitectHighLevelReadOnly(env=process.env,fetchImpl=fetch){
  if(env.VERCEL_ENV!=='preview'||
      env.VERCEL_GIT_COMMIT_REF!==BRANCH||
      env.PATRIMONIAL_ARCHITECT_HIGHLEVEL_READONLY_PREFLIGHT!=='true')
    return {skipped:true};

  const token=env.HIGHLEVEL_PRIVATE_TOKEN?.trim();
  const locationId=env.HIGHLEVEL_LOCATION_ID?.trim();
  if(!token||!locationId||!/^[A-Za-z0-9_-]{8,100}$/.test(locationId))
    throw new Error('ARCHITECT_HIGHLEVEL_PREFLIGHT_CONFIG_MISSING');

  const res=await fetchImpl(URL_ROOT+'/locations/'+encodeURIComponent(locationId),{
    method:'GET',
    headers:{
      Authorization:'Bearer '+token,
      Version:'v3',
      Accept:'application/json',
      'Cache-Control':'no-store',
    },
    redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)
  });
  // No body or credential logging, regardless of provider response.
  if(!res.ok) throw new Error(
    res.status===401||res.status===403
      ? 'ARCHITECT_HIGHLEVEL_PREFLIGHT_ACCESS_DENIED'
      : 'ARCHITECT_HIGHLEVEL_PREFLIGHT_UNAVAILABLE'
  );
  const data=await res.json();
  if(data?.location?.id!==locationId)
    throw new Error('ARCHITECT_HIGHLEVEL_PREFLIGHT_LOCATION_MISMATCH');
  return {skipped:false,location:'VERIFIED',scope:'locations.readonly'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{
    const r=await checkArchitectHighLevelReadOnly();
    console.log(r.skipped
      ? 'ARCHITECT_HIGHLEVEL_PREFLIGHT: SKIPPED'
      : 'ARCHITECT_HIGHLEVEL_PREFLIGHT: PASS (GET-only token/location binding)');
  }catch(err){
    const known=err instanceof Error ? err.message : '';
    const label=['ARCHITECT_HIGHLEVEL_PREFLIGHT_CONFIG_MISSING',
      'ARCHITECT_HIGHLEVEL_PREFLIGHT_ACCESS_DENIED',
      'ARCHITECT_HIGHLEVEL_PREFLIGHT_UNAVAILABLE',
      'ARCHITECT_HIGHLEVEL_PREFLIGHT_LOCATION_MISMATCH'].includes(known)
        ?known:'ARCHITECT_HIGHLEVEL_PREFLIGHT_FAILED';
    console.error(label);
    process.exitCode=1;
  }
}
