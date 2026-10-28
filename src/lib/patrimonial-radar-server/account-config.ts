import {RadarBackendError} from './contracts.ts';
export type AccountEnv=Readonly<Record<string,string|undefined>>;
export const ACCOUNT_PREVIEW_PROJECT='prj_bJvIOswh4GacqtUootXATXeAkSUO';
export const ACCOUNT_WEBSITE_PROJECT='prj_EWAOevQbWZqhKddTuD6l8GWSIYHM';
export const ACCOUNT_WEBSITE_TEAM='team_LsT2CKLXy6aIHfeH9SPKpDIz';
export const ACCOUNT_BETA_ORIGIN='https://horyzon.it';
export function accountConfig(env:AccountEnv){
 if(env.PATRIMONIAL_RADAR_ACCOUNT_ENABLED!=='true')return null;
 const production=env.VERCEL_ENV==='production'||env.VERCEL_TARGET_ENV==='production';
 // Production remains refused unless every explicit Website beta fence matches.
 const beta=production&&env.PATRIMONIAL_RADAR_BETA_ENABLED==='true'
  &&env.PATRIMONIAL_RADAR_ACCOUNT_CONTEXT==='website-beta'
  &&env.VERCEL==='1'&&env.VERCEL_ENV==='production'
  &&(!env.VERCEL_TARGET_ENV||env.VERCEL_TARGET_ENV==='production')
  &&env.VERCEL_PROJECT_ID===ACCOUNT_WEBSITE_PROJECT
  // Project ownership was checked remotely. ORG_ID is optional CLI metadata,
  // not a documented automatic runtime variable; reject a mismatch if supplied.
  &&(!env.VERCEL_ORG_ID||env.VERCEL_ORG_ID===ACCOUNT_WEBSITE_TEAM)
  &&!!env.VERCEL_DEPLOYMENT_ID&&env.PATRIMONIAL_RADAR_ACCOUNT_ORIGIN===ACCOUNT_BETA_ORIGIN;
 if(production&&!beta)return null;
 if(!beta&&env.VERCEL&&(env.VERCEL!=='1'||env.VERCEL_ENV!=='preview'||env.VERCEL_PROJECT_ID!==ACCOUNT_PREVIEW_PROJECT||!env.VERCEL_DEPLOYMENT_ID))return null;
 try{
  const url=new URL(env.PATRIMONIAL_RADAR_ACCOUNT_SUPABASE_URL??'https://pmkyeqrfkunypfkbjnyg.supabase.co');
  const local=env.PATRIMONIAL_RADAR_ACCOUNT_CONTEXT==='local-test'&&!env.VERCEL&&env.VERCEL_ENV!=='production';
  if(!local&&env.VERCEL!=='1')throw Error();
  // VERCEL_URL is provider configuration, never Host / Forwarded / request input.
  // A future immutable deployment needs no pre-created alias or wildcard origin.
  const origin=new URL(beta?ACCOUNT_BETA_ORIGIN:local?env.PATRIMONIAL_RADAR_ACCOUNT_ORIGIN??'':'https://'+(env.VERCEL_URL??''));
  if(!local&&!beta&&(origin.hostname!==env.VERCEL_URL||origin.port||
    (env.PATRIMONIAL_RADAR_ACCOUNT_ORIGIN!==undefined&&env.PATRIMONIAL_RADAR_ACCOUNT_ORIGIN!==origin.origin)))throw Error();
  if(local?(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||origin.protocol!=='http:'||origin.hostname!=='127.0.0.1'):(url.origin!=='https://pmkyeqrfkunypfkbjnyg.supabase.co'||origin.protocol!=='https:'))throw Error();
  for(const u of [url,origin])if(u.pathname!=='/'||u.search||u.hash||u.username||u.password)throw Error();
  const key=env.PATRIMONIAL_RADAR_PUBLISHABLE_KEY??'',secret=env.PATRIMONIAL_RADAR_IDENTITY_SECRET??'';
  if(!key.startsWith('sb_publishable_')||secret.length<32)throw Error();
  const betaEmails=beta?(env.PATRIMONIAL_RADAR_BETA_EMAILS??'').split(',').map(x=>x.trim().toLowerCase()):[];
  if(beta&&(betaEmails.length>20||!betaEmails.length||betaEmails.some(x=>x.length>254||x.includes('*')||!/^[-a-z0-9.!#$%&'+/=?^_`{|}~]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(x))||new Set(betaEmails).size!==betaEmails.length))throw Error();
  return{url:url.origin,origin:origin.origin,key,secret,local,beta,betaEmails};
 }catch{throw new RadarBackendError('UNAVAILABLE');}
}
