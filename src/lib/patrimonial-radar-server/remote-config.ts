/** Safe to import in server gates/proxy: configuration checks only, no keys read
 * into public props. Approval references are operator configuration, not proof
 * that this code authorizes activation. All defaults remain OFF. */
export const RADAR_PROJECT_REF='pmkyeqrfkunypfkbjnyg';
export const RADAR_REMOTE_CONTRACT='radar-activation-5b2-1';
type Env=Readonly<Record<string,string|undefined>>;
export function remoteOrigin(env:Env):string{
  const derived='https://'+(env.VERCEL_URL??'');
  if(env.PATRIMONIAL_RADAR_REMOTE_ORIGIN&&env.PATRIMONIAL_RADAR_REMOTE_ORIGIN!==derived)return '';
  return derived;
}
export function protectedRemoteConfigured(env:Env):boolean {
  try{
    // Routing configuration only; exact origin authority belongs to the broker
    // registry and the separately provisioned deployment proof credential.
    const origin=new URL(remoteOrigin(env));
    return env.PATRIMONIAL_RADAR_BACKEND_ENABLED==='true'
      && env.PATRIMONIAL_RADAR_BACKEND_CONTEXT==='protected-remote'
      && env.PATRIMONIAL_RADAR_FOUNDATION_CONTEXT==='protected-remote'
      && env.VERCEL==='1' && env.VERCEL_ENV==='preview'
      && env.VERCEL_PROJECT_ID==='prj_bJvIOswh4GacqtUootXATXeAkSUO'
      && !!env.VERCEL_DEPLOYMENT_ID
      && origin.protocol==='https:' && origin.hostname===env.VERCEL_URL
      && origin.pathname==='/'&&!origin.port&&!origin.search&&!origin.hash&&!origin.username&&!origin.password
      && env.PATRIMONIAL_RADAR_SUPABASE_URL==='https://'+RADAR_PROJECT_REF+'.supabase.co'
      && env.PATRIMONIAL_RADAR_MODE==='VERIFIED_PERSISTENT'
      && env.PATRIMONIAL_RADAR_VERIFIED_PERSISTENT_ENABLED==='true'
      && env.PATRIMONIAL_RADAR_PUBLIC_ANONYMOUS_ENABLED!=='true'
      && ['PATRIMONIAL_CRM_WRITE_ENABLED','PATRIMONIAL_OPPORTUNITY_WRITE_ENABLED',
        'PATRIMONIAL_BOOKING_ENABLED','PATRIMONIAL_MESSAGES_ENABLED','PATRIMONIAL_WEBHOOK_ENABLED',
        'PATRIMONIAL_ASSIGNMENTS_ENABLED','PATRIMONIAL_OWNER_SYNC_ENABLED',
        'PATRIMONIAL_HIGHLEVEL_PERFORMANCE_WEBHOOK_ENABLED'].every(key=>env[key]!=='true')
      && env.PATRIMONIAL_RADAR_ACTIVATION_APPROVAL_REF!==undefined
      && /^[A-Za-z0-9:_-]{8,160}$/.test(env.PATRIMONIAL_RADAR_ACTIVATION_APPROVAL_REF)
      && env.PATRIMONIAL_RADAR_NOTICE_APPROVAL==='RP-SERVICE-5A-DRAFT-1';
  }catch{return false;}
}
