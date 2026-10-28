import {createHash} from 'node:crypto';
import {RadarBackendError} from './contracts.ts';
import type {PatrimonialRequest,PatrimonialReceipt} from '../public-leads/patrimonial-contract.ts';
import {canonicalPatrimonialPayload} from '../public-leads/patrimonial-contract.ts';
import {validatePatrimonialV2} from '../public-leads/patrimonial-funnels.ts';
import {patrimonialConsentEvidence} from '../public-leads/patrimonial-consents.ts';
import type {RemoteRadarRpc} from './remote-store.ts';
import {protectedRemoteConfigured} from './remote-config.ts';
import {remoteRpc} from './remote-runtime.ts';
import {PatrimonialConflictError,PatrimonialReplayExpiredError} from '../public-leads/patrimonial-store.ts';
export type EventIntakePort=(request:PatrimonialRequest)=>Promise<PatrimonialReceipt>;
export class RemoteEventIntake {
 private readonly rpc:RemoteRadarRpc;
 constructor(rpc:RemoteRadarRpc){this.rpc=rpc;}
  async acquire(request:PatrimonialRequest):Promise<PatrimonialReceipt>{
    const lead=validatePatrimonialV2(request.payload);
    if(!lead||lead.mode!=='patrimonial-event'
      ||createHash('sha256').update(canonicalPatrimonialPayload(lead)).digest('hex')!==request.payloadHash)
      throw new RadarBackendError('INVALID');
  let receipt:PatrimonialReceipt;
  try{receipt=await this.rpc.acquireEvent<PatrimonialReceipt>(request,patrimonialConsentEvidence(request));}
  catch(e){
   if(e instanceof RadarBackendError&&e.code==='CONFLICT')throw new PatrimonialConflictError();
   if(e instanceof RadarBackendError&&e.code==='REPLAY_EXPIRED')throw new PatrimonialReplayExpiredError();
   throw e;
  }
    if(receipt?.ok!==true||receipt.requestId!==request.id||receipt.receiptStatus!=='received'||receipt.crmStatus!=='pending')
      throw new RadarBackendError('UNAVAILABLE');
    return receipt;
  }
}
export function remoteEventIntakePort(env:Readonly<Record<string,string|undefined>>=process.env):EventIntakePort|undefined {
  if(!protectedRemoteConfigured(env)||env.PATRIMONIAL_EVENT_RADAR_CONTEXT!=='protected-remote'||env.PATRIMONIAL_V2_ENABLED!=='true')return undefined;
  return async request=>{
    const rpc=remoteRpc(env);await rpc.attest(env.VERCEL_DEPLOYMENT_ID??'');
    return new RemoteEventIntake(rpc).acquire(request);
  };
}
