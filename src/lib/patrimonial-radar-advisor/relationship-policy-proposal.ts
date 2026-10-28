/** Local evaluation of a DRAFT policy, never an authorization or scope proof. */
import { contentHash, validUuid } from '../patrimonial-radar-server/security.ts';
import { ACCESS_CONTRACTS_PROPOSAL } from './access-contracts-proposal.ts';
export interface DossierRelationProposal {
  id:string;kind:string;pipeline:string;status:string;stage:string;cycle:number;revision:number;
  locationId:string;contactId:string;currentOperatorId:string|null;operatorRevision:number;
  consultation:{explicitRequest:boolean}|null;
}
export interface RelationshipInventoryProposal {
  personId:string;assessmentId:string;locationId:string;contactId:string;operatorId:string;
  completeness:'COMPLETE'|'PARTIAL'|'UNKNOWN';
  relations:DossierRelationProposal[];
  operators:{id:string;active:boolean;revision:number}[];
  assignments:{id:string;intentId:string;operatorId:string;releasedAt:string|null;revision:number}[];
  participations:{id:string;relationId:string;contactId:string;editionId:string|null;status:string;attendance:string;revision:number}[];
  /** Independent, explicit proposed evidence of pertinent PURPOSE + episode scope.
   * Registration/OTP/owner alone cannot populate this future trusted proof. */
  purposeEvidence:{id:string;intentId:string;cycle:number;revision:number;state:'VERIFIED'|'UNRESOLVED'|'REVOKED';assessmentIds:string[];participationId:string|null}[];
}
const revision=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
const opaque=(v:unknown)=>typeof v==='string'&&/^[a-zA-Z0-9_:-]{1,160}$/.test(v);
const unique=(rows:{id:string}[])=>new Set(rows.map(r=>r.id)).size===rows.length;
export function evaluateRelationshipPolicyProposal(input:RelationshipInventoryProposal) {
  let fingerprint:string|null=null;
  const finish=(status:'CANDIDATE_ONLY'|'DENIED'|'DECISION_REQUIRED',reason:string,refs:object[]=[])=>({proposalVersion:ACCESS_CONTRACTS_PROPOSAL,policyStatus:'PROPOSED' as const,authorizesAccess:false as const,status,reason,refs,inventoryFingerprint:fingerprint});
  try {
    if(input.completeness!=='COMPLETE')return finish('DENIED','INCOMPLETE_INVENTORY');
    if(![input.personId,input.assessmentId,input.operatorId].every(validUuid)||!opaque(input.locationId)||!opaque(input.contactId))return finish('DENIED','INVALID_SUBJECT');
    for(const rows of [input.relations,input.operators,input.assignments,input.participations,input.purposeEvidence])if(!Array.isArray(rows)||!unique(rows)||!rows.every(r=>validUuid(r.id)))return finish('DENIED','AMBIGUOUS_INVENTORY');
    const sorted=<T extends {id:string}>(rows:T[])=>[...rows].sort((a,b)=>a.id.localeCompare(b.id));
    fingerprint=contentHash({...input,relations:sorted(input.relations),operators:sorted(input.operators),assignments:sorted(input.assignments),participations:sorted(input.participations),purposeEvidence:sorted(input.purposeEvidence)});
    // The authoritative query must return the complete contact inventory. A foreign
    // row is a source mismatch, not a reason to silently filter the collection.
    if(input.relations.some(r=>r.locationId!==input.locationId||r.contactId!==input.contactId||r.kind!=='OPPORTUNITY'||!revision(r.revision)||!revision(r.operatorRevision)||!Number.isSafeInteger(r.cycle)||r.cycle<1||!['ARCHITECT_PATH','PATRIMONIAL_EVENT','PATRIMONIAL_CONSULTATION'].includes(r.pipeline)))return finish('DENIED','RELATION_SOURCE_MISMATCH');
    const relevant=input.relations.filter(r=>r.pipeline!=='ARCHITECT_PATH');
    if(relevant.some(r=>!['OPEN','WON','LOST','ABANDONED'].includes(r.status)))return finish('DENIED','INVALID_RELATION_STATUS');
    const open=relevant.filter(r=>r.status==='OPEN').sort((a,b)=>a.id.localeCompare(b.id));
    if(relevant.some(r=>r.status!=='OPEN'&&(r.currentOperatorId!==null||input.assignments.some(a=>a.intentId===r.id&&a.releasedAt===null))))return finish('DECISION_REQUIRED','CLOSED_WITH_UNRELEASED_ASSIGNMENT');
    if(!open.length)return finish('DENIED','NO_ACTIVE_EVENT_OR_CONSULTATION');
    const responsible=new Set(open.map(r=>r.currentOperatorId));
    if(responsible.has(null))return finish('DENIED','NO_CURRENT_ASSIGNMENT');
    if(responsible.size>1)return finish('DECISION_REQUIRED','DIFFERENT_CURRENT_RESPONSIBLES');
    if(!responsible.has(input.operatorId))return finish('DENIED','OTHER_OPERATOR');
    const refs:object[]=[];
    for(const r of open){
      const operators=input.operators.filter(o=>o.id===r.currentOperatorId),assignments=input.assignments.filter(a=>a.intentId===r.id&&a.releasedAt===null);
      if(operators.length!==1||operators[0].active!==true||!revision(operators[0].revision)||assignments.length!==1||assignments[0].operatorId!==r.currentOperatorId||!revision(assignments[0].revision))return finish('DENIED','INVALID_OR_DISABLED_ASSIGNMENT');
      const proofs=input.purposeEvidence.filter(p=>p.intentId===r.id&&p.cycle===r.cycle&&p.state!=='REVOKED');
      if(proofs.length!==1||proofs[0].state!=='VERIFIED'||!revision(proofs[0].revision))return finish('DECISION_REQUIRED','PURPOSE_NOT_VERIFIED');
      const p=proofs[0];
      if(!p.assessmentIds.every(validUuid)||new Set(p.assessmentIds).size!==p.assessmentIds.length||!p.assessmentIds.includes(input.assessmentId))return finish('DECISION_REQUIRED','EPISODE_HISTORY_NOT_IN_SCOPE');
      if(r.pipeline==='PATRIMONIAL_EVENT'){
        if(!['E01','E02','E03','E04'].includes(r.stage))return finish('DENIED','INVALID_EVENT_STAGE');
        const participants=input.participations.filter(v=>v.relationId===r.id&&v.id===p.participationId);
        if(participants.length!==1||participants[0].contactId!==input.contactId||!revision(participants[0].revision))return finish('DECISION_REQUIRED','EVENT_PARTICIPATION_NOT_SCOPED');
        const part=participants[0];
        if(['CANCELLED','DECLINED'].includes(part.status)||['CANCELLED','NOT_APPLICABLE'].includes(part.attendance))return finish('DENIED','EVENT_PARTICIPATION_INACTIVE');
        if(part.attendance==='NO_SHOW')return finish('DECISION_REQUIRED','EVENT_NO_SHOW_PURPOSE');
        if(part.status!=='CONFIRMED'||!opaque(part.editionId)||!['UNKNOWN','ATTENDED'].includes(part.attendance))return finish('DECISION_REQUIRED','EVENT_NOT_CONFIRMED');
        refs.push({participationId:part.id,participationRevision:part.revision});
      } else if(!['C01','C02','C03','C04'].includes(r.stage)||r.consultation?.explicitRequest!==true||p.participationId!==null)return finish('DENIED','CONSULTATION_NOT_EXPLICIT_OR_SCOPED');
      refs.push({intentId:r.id,cycle:r.cycle,businessRevision:r.revision,operatorRevision:r.operatorRevision,assignmentId:assignments[0].id,assignmentRevision:assignments[0].revision,operatorRegistryRevision:operators[0].revision,purposeEvidenceId:p.id,purposeRevision:p.revision});
    }
    return finish('CANDIDATE_ONLY','REQUIRES_PRODUCT_APPROVAL_AND_ALL_OTHER_ACCESS_CONTRACTS',refs);
  } catch {return {proposalVersion:ACCESS_CONTRACTS_PROPOSAL,policyStatus:'PROPOSED' as const,authorizesAccess:false as const,status:'DENIED' as const,reason:'INVALID_INVENTORY',refs:[],inventoryFingerprint:null};}
}
