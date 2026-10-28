import {createHmac} from 'node:crypto';
import {accountMacKey} from './account-rpc.ts';
export type AccountReferral={code:string|null;exp:number};
/** The opaque code never authenticates a customer or selects an operator UUID. */
export async function checkAccountReferral(cfg:{url:string;key:string;secret:string},code:string|null,fetchImpl:typeof fetch=fetch):Promise<'VALID'|'REVIEW_REQUIRED'>{
 const envelope=JSON.stringify({purpose:'radar-referral-1',code,issuedAt:Math.floor(Date.now()/1000)});
 const mac=createHmac('sha256',accountMacKey(cfg.secret)).update(envelope).digest('hex');
 try{
  const r=await fetchImpl(cfg.url+'/rest/v1/rpc/patrimonial_radar_referral_check',{method:'POST',headers:{apikey:cfg.key,'Content-Type':'application/json','Content-Profile':'hub','Accept-Profile':'hub'},body:JSON.stringify({p_envelope:envelope,p_mac:mac}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!r.ok){await r.body?.cancel();return 'REVIEW_REQUIRED';}
  const v=await r.json();return v?.ok===true&&v.valid===true?'VALID':'REVIEW_REQUIRED';
 }catch{return 'REVIEW_REQUIRED';}
}
