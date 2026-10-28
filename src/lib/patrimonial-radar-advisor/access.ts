import { randomUUID } from 'node:crypto';
import type { AdvisorSource } from './contracts.ts';
import { advisorProjection } from './projection.ts';
import { canonical, contentHash, validUuid } from '../patrimonial-radar-server/security.ts';
export interface AdvisorAccessTarget {personId:string;assessmentId:string}
/** Resolved by a trusted server adapter, never by browser identity/owner claims. */
export interface CurrentAdvisorAuthority extends AdvisorAccessTarget {
  staffUserId:string;operatorId:string;sessionCurrent:boolean;operatorActive:boolean;staffOperatorLinkVerified:boolean;
  sessionId:string;sessionExpiresAt:string;sessionRevision:number;operatorRegistryRevision:number;locationId:string;
  permissionId:string;permissionRevision:number;staffOperatorBindingId:string;staffOperatorBindingRevision:number;
  personContactBindingId:string;personContactBindingRevision:number;
  relationshipScopeId:string;relationshipScopeRevision:number;relationshipPolicyVersion:string;
  permission:'RADAR_ADVISOR_READ'|null;personContactLinkVerified:boolean;contactId:string;
  relation:{kind:'CURRENT_ASSIGNEE'|'UNRESOLVED_SUPERVISION';operatorId:string;revision:number;current:boolean;assignmentId:string;assignmentRevision:number;intentId:string}|null;
}
export interface AdvisorAccessAudit {
  requestId:string;occurredAt:string;action:'RADAR_ADVISOR_READ';outcome:'AUTHORIZED_RELEASE'|'DENIED';
  personId:string|null;assessmentId:string|null;staffUserId:string|null;operatorId:string|null;
  assignmentId:string|null;intentId:string|null;assignmentRevision:number|null;
}
export interface AdvisorAuditReceipt {id:string;requestId:string;outcome:AdvisorAccessAudit['outcome'];authorityHash:string|null}
export interface AdvisorAccessPorts {
  resolveCurrent(request:Request,target:AdvisorAccessTarget):Promise<CurrentAdvisorAuthority|null>;
  loadApproved(target:AdvisorAccessTarget):Promise<AdvisorSource>;
  /** Mandatory future transaction: recheck ALL current authority and commit audit
   * together, or refuse. No financial payload. No real implementation in 4D.2A. */
  commitDecision(input:{request:Request;target:AdvisorAccessTarget;expectedAuthority:CurrentAdvisorAuthority|null;event:AdvisorAccessAudit}):Promise<AdvisorAuditReceipt>;
}
const revision=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
const opaque=(v:unknown)=>typeof v==='string'&&/^[a-zA-Z0-9_:-]{1,160}$/.test(v);
export function permittedAdvisor(a:CurrentAdvisorAuthority|null,t:AdvisorAccessTarget):a is CurrentAdvisorAuthority {
  return !!a&&validUuid(t.personId)&&validUuid(t.assessmentId)&&a.personId===t.personId&&a.assessmentId===t.assessmentId
    &&[a.staffUserId,a.operatorId,a.sessionId,a.permissionId,a.staffOperatorBindingId,a.personContactBindingId,a.relationshipScopeId].every(validUuid)
    &&opaque(a.contactId)&&opaque(a.locationId)&&opaque(a.relationshipPolicyVersion)
    &&a.sessionCurrent===true&&Number.isFinite(Date.parse(a.sessionExpiresAt))&&Date.parse(a.sessionExpiresAt)>Date.now()
    &&a.operatorActive===true&&a.staffOperatorLinkVerified===true&&a.personContactLinkVerified===true&&a.permission==='RADAR_ADVISOR_READ'
    &&[a.sessionRevision,a.operatorRegistryRevision,a.permissionRevision,a.staffOperatorBindingRevision,a.personContactBindingRevision,a.relationshipScopeRevision].every(revision)
    &&a.relation?.kind==='CURRENT_ASSIGNEE'&&a.relation.operatorId===a.operatorId&&a.relation.current===true
    &&validUuid(a.relation.assignmentId)&&validUuid(a.relation.intentId)&&revision(a.relation.revision)&&revision(a.relation.assignmentRevision);
}
/** Still unwired in 4D.2A. No adapter, generic role or unresolved supervision grants access. */
export async function readAuthorizedAdvisor(request:Request,target:AdvisorAccessTarget,ports?:AdvisorAccessPorts) {
  if(typeof window!=='undefined'||!ports||typeof ports.commitDecision!=='function')throw new Error('ADVISOR_ACCESS_DENIED');
  const subject=Object.freeze({personId:target.personId,assessmentId:target.assessmentId}),requestId=randomUUID();
  let first:CurrentAdvisorAuthority|null=null;
  const event=(outcome:AdvisorAccessAudit['outcome']):AdvisorAccessAudit=>({requestId,occurredAt:new Date().toISOString(),action:'RADAR_ADVISOR_READ',outcome,
    personId:validUuid(subject.personId)?subject.personId:null,assessmentId:validUuid(subject.assessmentId)?subject.assessmentId:null,
    staffUserId:first?.staffUserId??null,operatorId:first?.operatorId??null,assignmentId:first?.relation?.assignmentId??null,intentId:first?.relation?.intentId??null,assignmentRevision:first?.relation?.revision??null});
  try {
    if(!validUuid(subject.personId)||!validUuid(subject.assessmentId))throw new Error('DENIED');
    const resolved=await ports.resolveCurrent(request,subject);if(!permittedAdvisor(resolved,subject))throw new Error('DENIED');
    first=structuredClone(resolved); // detach mutable proofs before any awaited read
    const source=await ports.loadApproved(subject);if(source.personId!==subject.personId||source.assessmentId!==subject.assessmentId)throw new Error('DENIED');
    const result=advisorProjection(source);
    const second=await ports.resolveCurrent(request,subject);if(!permittedAdvisor(second,subject)||canonical(first)!==canonical(second))throw new Error('DENIED');
    const receipt=await ports.commitDecision({request,target:subject,expectedAuthority:structuredClone(first),event:event('AUTHORIZED_RELEASE')});
    if(!validUuid(receipt.id)||receipt.requestId!==requestId||receipt.outcome!=='AUTHORIZED_RELEASE'||receipt.authorityHash!==contentHash(first)||!permittedAdvisor(first,subject))throw new Error('DENIED');
    return result;
  } catch {
    try {await ports.commitDecision({request,target:subject,expectedAuthority:null,event:event('DENIED')});} catch { /* Audit unavailable never grants access. No raw causes or payload logs. */ }
    throw new Error('ADVISOR_ACCESS_DENIED');
  }
}
