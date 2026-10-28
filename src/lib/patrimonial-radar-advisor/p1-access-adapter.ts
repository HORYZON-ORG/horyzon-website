import type { AdvisorAccessPorts, AdvisorAccessTarget, CurrentAdvisorAuthority } from './access.ts';
import { permittedAdvisor } from './access.ts';

/** Read-only subsets of P1 AssignmentContext joined to OPPORTUNITY.record.
 * No assignment engine, writer, database mapping or provider-owner inference. */
export interface P1AdvisorReadModel {
  capabilities:{contract:string;base:string|null;assignmentManagement:string|null};
  operators:{id:string;active:boolean;revision:number;remoteUserRef:string|null}[];
  intents:{id:string;kind:string;status:string;currentOperatorId:string|null;operatorRevision:number;ownerRef:string|null;record:{contactId:string;locationId:string}}[];
  assignments:{id:string;intentId:string;operatorId:string;releasedAt:string|null;revision:number}[];
}
type VerifiedBinding={id:string;revision:number;state:'VERIFIED'|'UNRESOLVED'|'REVOKED'};
/** Future trusted proof ports; NOT persisted or derived from integration_links,
 * email, mutable metadata, remote_user_ref or a generic superadmin role. */
export interface AdvisorIdentityFacts {
  session:{staffUserId:string;sessionId:string;expiresAt:string;revision:number;current:boolean;verified:boolean}|null;
  staffOperatorBindings:(VerifiedBinding&{staffUserId:string;operatorId:string})[];
  permissions:{id:string;staffUserId:string;operatorId:string;permission:string;revision:number;active:boolean}[];
  personContactBindings:(VerifiedBinding&{personId:string;contactId:string;locationId:string})[];
  /** Explicit trusted policy/evidence selects the assignment scope for THIS
   * dossier. P1 has no contact-wide Advisor policy. Never choose first/any. */
  relationshipScopes:(VerifiedBinding&{personId:string;assessmentId:string;contactId:string;locationId:string;intentId:string;policyVersion:string})[];
}
export interface AdvisorAuthorityFacts {identity:AdvisorIdentityFacts;p1:P1AdvisorReadModel}
export interface P1AdvisorAdapterPorts {
  readCurrentFacts(request:Request,target:AdvisorAccessTarget):Promise<AdvisorAuthorityFacts|null>;
  loadApproved:AdvisorAccessPorts['loadApproved'];
  commitDecision:AdvisorAccessPorts['commitDecision'];
}
const one=<T,>(items:T[]):T|null=>items.length===1?items[0]:null;
/** Pure projection of current verified facts. Missing/ambiguous/stale => deny. */
export function authorityFromP1(facts:AdvisorAuthorityFacts|null,target:AdvisorAccessTarget):CurrentAdvisorAuthority|null {
  if(typeof window!=='undefined'||!facts)return null;
  try {
    const {identity:i,p1}=facts,s=i.session,c=p1.capabilities;
    if(c.contract!=='patrimonial-runtime-capabilities-v1'||c.base!=='patrimonial-v2-store-1'||c.assignmentManagement!=='p1-v1'||!s||s.verified!==true||s.current!==true)return null;
    const staff=one(i.staffOperatorBindings.filter(b=>b.staffUserId===s.staffUserId&&b.state!=='REVOKED'));
    const person=one(i.personContactBindings.filter(b=>b.personId===target.personId&&b.state!=='REVOKED'));
    if(!staff||staff.state!=='VERIFIED'||!person||person.state!=='VERIFIED')return null;
    if(i.staffOperatorBindings.filter(b=>b.operatorId===staff.operatorId&&b.state!=='REVOKED').length!==1||i.personContactBindings.filter(b=>b.contactId===person.contactId&&b.locationId===person.locationId&&b.state!=='REVOKED').length!==1)return null;
    const permission=one(i.permissions.filter(p=>p.staffUserId===s.staffUserId&&p.operatorId===staff.operatorId&&p.permission==='RADAR_ADVISOR_READ'&&p.active===true));
    const scope=one(i.relationshipScopes.filter(b=>b.personId===target.personId&&b.assessmentId===target.assessmentId&&b.state!=='REVOKED'));
    if(!permission||!scope||scope.state!=='VERIFIED'||scope.contactId!==person.contactId||scope.locationId!==person.locationId)return null;
    const operator=one(p1.operators.filter(o=>o.id===staff.operatorId)),intent=one(p1.intents.filter(t=>t.id===scope.intentId));
    if(!operator||!intent||intent.kind!=='OPPORTUNITY'||intent.status!=='OPEN'||intent.record.contactId!==person.contactId||intent.record.locationId!==person.locationId||intent.currentOperatorId!==operator.id)return null;
    const assignment=one(p1.assignments.filter(a=>a.intentId===intent.id&&a.releasedAt===null));
    if(!assignment||assignment.operatorId!==operator.id)return null;
    const proof:CurrentAdvisorAuthority={...target,staffUserId:s.staffUserId,sessionId:s.sessionId,sessionExpiresAt:s.expiresAt,sessionRevision:s.revision,sessionCurrent:s.current,
      operatorId:operator.id,operatorActive:operator.active,operatorRegistryRevision:operator.revision,contactId:person.contactId,locationId:person.locationId,
      staffOperatorLinkVerified:true,personContactLinkVerified:true,permission:'RADAR_ADVISOR_READ',permissionId:permission.id,permissionRevision:permission.revision,
      staffOperatorBindingId:staff.id,staffOperatorBindingRevision:staff.revision,personContactBindingId:person.id,personContactBindingRevision:person.revision,
      relationshipScopeId:scope.id,relationshipScopeRevision:scope.revision,relationshipPolicyVersion:scope.policyVersion,
      relation:{kind:'CURRENT_ASSIGNEE',operatorId:operator.id,revision:intent.operatorRevision,current:true,assignmentId:assignment.id,assignmentRevision:assignment.revision,intentId:intent.id}};
    return permittedAdvisor(proof,target)?structuredClone(proof):null;
  } catch {return null;}
}
/** Trusted ports only; never installed in runtime. Missing bindings/audit have no fallback. */
export function p1AdvisorAccessPorts(ports:P1AdvisorAdapterPorts):AdvisorAccessPorts {
  if(typeof window!=='undefined')throw new Error('ADVISOR_ACCESS_DENIED');
  return {resolveCurrent:async(request,target)=>authorityFromP1(await ports.readCurrentFacts(request,target),target),loadApproved:ports.loadApproved,commitDecision:ports.commitDecision};
}
