import { createHash } from 'node:crypto';
import { planPatrimonialCrmSync } from './foundation.ts';
import { RadarBackendError } from './contracts.ts';
import { validUuid, revision } from './security.ts';

/** Pure simulation. Inputs come from the verified registries, never an owner
 * imported from HighLevel. The output has no provider transport or dossier. */
export function planClientRadarCrmSync(input: {
  radar: Parameters<typeof planPatrimonialCrmSync>[0];
  contactBinding: { personId: string; hubContactId: string; state: string; revision: number };
  requestIds: string[]; participationIds: string[]; assignmentHistoryIds: string[];
}) {
  const b=input.contactBinding;
  if(!validUuid(b.hubContactId)||b.personId!==input.radar.personId)throw new RadarBackendError('INVALID');
  revision(b.revision);
  const refs=(values:string[])=>{if(values.length>500||values.some(v=>!validUuid(v)))throw new RadarBackendError('INVALID');return [...new Set(values)].sort();};
  const references={hubContactId:b.hubContactId,personId:b.personId,contactBindingRevision:b.revision,
    requestIds:refs(input.requestIds),participationIds:refs(input.participationIds),assignmentHistoryIds:refs(input.assignmentHistoryIds)};
  if(b.state!=='VERIFIED')return {status:'HOLD_CONTACT_BINDING' as const,writes:[]};
  const radar=planPatrimonialCrmSync(input.radar);
  if(!('metadata' in radar))return radar;
  const metadata={contract:'patrimonial-client-reference-5b1r-1',references,radar:radar.metadata,
    ownerAuthority:'P1',financialCopy:false,pipelineProjection:'P2B_REVIEW_REQUIRED',execution:'SIMULATION_ONLY'};
  return {...radar,metadata,idempotencyKey:'client-radar:'+createHash('sha256').update(JSON.stringify(metadata)).digest('hex'),writes:[]};
}
