import {createHash,createHmac} from 'node:crypto';
import type {RadarRpc} from './contracts.ts';
import {RadarBackendError} from './contracts.ts';import {RadarSecrets} from './security.ts';import {unwrap} from './store.ts';
export interface AccountProfile{firstName:string;lastName:string;email:string;}
export const accountMacKey=(secret:string)=>createHash('sha256').update('account-rpc-5c\0'+secret).digest();
export function accountToken(secret:string,uid:string,sid:string){return createHmac('sha256',secret).update(JSON.stringify(['account-session-5c',uid,sid])).digest('base64url');}
/** Native Auth bearer is still required. MAC only attests the existing server engine's
 * validated command; it never issues identities, roles or cross-user authority. */
type AccountRpcConfig={url:string;key:string;secret:string;token:string;uid:string;sid:string;profile:AccountProfile;referralCode?:string|null;fetchImpl?:typeof fetch};
export class AccountRadarRpc implements RadarRpc{
 private readonly config:AccountRpcConfig;
 constructor(config:AccountRpcConfig){this.config=config;}
 async invoke<T>(command:Readonly<Record<string,unknown>>):Promise<T>{
  const c=this.config,secrets=new RadarSecrets(c.secret);
  const envelope=JSON.stringify({subject:c.uid,sessionId:c.sid,issuedAt:Math.floor(Date.now()/1000),profile:{...c.profile,emailKey:secrets.hash('email-v1',c.profile.email)},command,...(command.method==='create'&&c.referralCode!==undefined?{referralCode:c.referralCode}:{})});
  const mac=createHmac('sha256',accountMacKey(c.secret)).update(envelope).digest('hex');
  const r=await(c.fetchImpl??fetch)(c.url+'/rest/v1/rpc/patrimonial_radar_account_command',{method:'POST',headers:{apikey:c.key,Authorization:'Bearer '+c.token,'Content-Type':'application/json','Content-Profile':'hub','Accept-Profile':'hub'},body:JSON.stringify({p_envelope:envelope,p_mac:mac}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!r.ok){await r.body?.cancel();throw new RadarBackendError(r.status===401?'UNAUTHENTICATED':r.status===403?'FORBIDDEN':'UNAVAILABLE');}
  return unwrap<T>(await r.json());
 }
}
