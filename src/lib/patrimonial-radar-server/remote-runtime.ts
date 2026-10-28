import {isIP} from 'node:net';
import {getVercelOidcToken} from '@vercel/oidc';
import {RadarBackendError} from './contracts.ts';
import {protectedRemoteConfigured,remoteOrigin} from './remote-config.ts';
import {RemoteRadarRpc} from './remote-store.ts';
import {ResendRadarEmail} from './resend-email.ts';
import {PatrimonialRadarService} from './service.ts';
import {PatrimonialFoundation} from './foundation.ts';
import {createPatrimonialRadarHandler} from './http.ts';
import {RuntimeLeases} from './runtime-credential.ts';
type Env=Readonly<Record<string,string|undefined>>;
const providers=new WeakMap<Env,RuntimeLeases>();
export function remoteRpc(env:Env,fetchImpl:typeof fetch=fetch){
  if(!protectedRemoteConfigured(env))throw new RadarBackendError('UNAVAILABLE');
  try{
    let provider=providers.get(env);
    if(!provider){
      provider=new RuntimeLeases({issuer:env.PATRIMONIAL_RADAR_BROKER_ISSUER??'',originId:env.PATRIMONIAL_RADAR_RUNTIME_ORIGIN_ID??'',
        proofJwk:JSON.parse(env.PATRIMONIAL_RADAR_DEPLOYMENT_PROOF_JWK??'null'),deploymentId:env.VERCEL_DEPLOYMENT_ID??'',
        deploymentOrigin:remoteOrigin(env),
        oidc:audience=>getVercelOidcToken({audience,skipCache:true,expirationBufferMs:30000})});
      providers.set(env,provider);
    }
    return new RemoteRadarRpc({url:env.PATRIMONIAL_RADAR_SUPABASE_URL??'',apiKey:env.PATRIMONIAL_RADAR_PUBLISHABLE_KEY??'',credential:provider.get,fetchImpl});
  }catch{throw new RadarBackendError('UNAVAILABLE');}
}
/** Vercel overwrites x-forwarded-for on direct ingress. No external proxy is
 * supported: such a topology requires a separate trusted-ingress review.
 * Reject lists/missing addresses instead of collapsing all requests to a bucket. */
export function vercelNetworkKey(request:Request):string {
  const ip=request.headers.get('x-forwarded-for')??'';
  if(!isIP(ip))throw new RadarBackendError('UNAVAILABLE');
  return ip.toLowerCase();
}
export async function handleRemoteRadarBackend(request:Request,env:Env):Promise<Response>{
  const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'};
  if(!protectedRemoteConfigured(env))return Response.json({error:'NOT_FOUND'},{status:404,headers});
  try{
    if(new URL(request.url).origin!==remoteOrigin(env))throw new RadarBackendError('FORBIDDEN');
    const rpc=remoteRpc(env);
    await rpc.attest(env.VERCEL_DEPLOYMENT_ID??'');
    const retention=Number(env.PATRIMONIAL_RADAR_RETENTION_REVIEW_DAYS);
    if(!Number.isSafeInteger(retention)||retention<1||retention>3650)throw new RadarBackendError('UNAVAILABLE');
    const email=new ResendRadarEmail({key:env.PATRIMONIAL_RADAR_RESEND_KEY??'',from:env.PATRIMONIAL_RADAR_EMAIL_FROM??'',replyTo:env.PATRIMONIAL_RADAR_EMAIL_REPLY_TO??''});
    const secret=env.PATRIMONIAL_RADAR_IDENTITY_SECRET??'';
    const service=new PatrimonialRadarService(rpc,email,secret,{retentionReviewDays:retention});
    return createPatrimonialRadarHandler(service,{origin:remoteOrigin(env),production:true,enabled:true,foundation:new PatrimonialFoundation(rpc,secret),remoteNetworkKey:vercelNetworkKey})(request);
  }catch(e){const error=e instanceof RadarBackendError?e:new RadarBackendError('UNAVAILABLE');return Response.json({error:error.code},{status:error.status,headers});}
}
