/** 4D.2B PROPOSAL ONLY. No database writer, grant, identity verifier or runtime adapter. */
import { contentHash, validUuid } from '../patrimonial-radar-server/security.ts';
export const ACCESS_CONTRACTS_PROPOSAL='RP-ACCESS-4D2B-DRAFT-1' as const;
type State='ACTIVE'|'REVOKED'|'CONFLICT';
interface Lifecycle {id:string;revision:number;state:State;evidenceId:string;changedBy:string;changedAt:string}
export interface StaffOperatorBindingProposal extends Lifecycle {issuerKey:string;staffUserId:string;operatorId:string}
export interface AdvisorPermissionProposal extends Lifecycle {staffBindingId:string;permission:'RADAR_ADVISOR_READ';locationId:string;expiresAt:string|null}
export interface PersonContactBindingProposal extends Lifecycle {
  personId:string;locationId:string;contactId:string;method:'OPERATOR_APPROVED_EVIDENCE';acknowledgmentEvidenceId:string;
}
export interface BindingCatalogProposal {staff:StaffOperatorBindingProposal[];permissions:AdvisorPermissionProposal[];persons:PersonContactBindingProposal[]}
export interface ChangeAuditProposal {recordId:string;kind:keyof BindingCatalogProposal;operation:'REVOKE'|'SUSPEND_CONFLICT';actorId:string;fromRevision:number;toRevision:number;at:string;evidenceId:string}
const revision=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
const opaque=(v:unknown)=>typeof v==='string'&&/^[a-zA-Z0-9_:-]{1,160}$/.test(v);
const time=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT.+(?:Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v));
const keys=(o:object,expected:string[])=>Object.keys(o).sort().join('|')===[...expected].sort().join('|');
const baseKeys=['id','revision','state','evidenceId','changedBy','changedAt'];
const base=(r:Lifecycle)=>[r.id,r.evidenceId,r.changedBy].every(validUuid)&&revision(r.revision)&&['ACTIVE','REVOKED','CONFLICT'].includes(r.state)&&time(r.changedAt);
const unique=<T,>(rows:T[],key:(r:T)=>string)=>new Set(rows.map(key)).size===rows.length;
/** Validates proposed record shapes and uniqueness, NOT the truth of evidence or
 * approval authority. Future DB FKs/constraints and approved workflow are mandatory. */
export function validateBindingCatalogProposal(c:BindingCatalogProposal) {
  try {
    if(!keys(c,['staff','permissions','persons'])||![c.staff,c.permissions,c.persons].every(Array.isArray))throw Error();
    for(const r of c.staff)if(!keys(r,[...baseKeys,'issuerKey','staffUserId','operatorId'])||!base(r)||!opaque(r.issuerKey)||![r.staffUserId,r.operatorId].every(validUuid))throw Error();
    for(const r of c.permissions)if(!keys(r,[...baseKeys,'staffBindingId','permission','locationId','expiresAt'])||!base(r)||!validUuid(r.staffBindingId)||r.permission!=='RADAR_ADVISOR_READ'||!opaque(r.locationId)||(r.expiresAt!==null&&!time(r.expiresAt))||!c.staff.some(s=>s.id===r.staffBindingId))throw Error();
    for(const r of c.persons)if(!keys(r,[...baseKeys,'personId','locationId','contactId','method','acknowledgmentEvidenceId'])||!base(r)||![r.personId,r.acknowledgmentEvidenceId].every(validUuid)||!opaque(r.locationId)||!opaque(r.contactId)||r.method!=='OPERATOR_APPROVED_EVIDENCE')throw Error();
    for(const rows of [c.staff,c.permissions,c.persons])if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error();
    // A suspended conflict still reserves its subject; resolution must revoke it
    // explicitly before a replacement can become eligible. No first-row wins.
    const staff=c.staff.filter(r=>r.state!=='REVOKED'),persons=c.persons.filter(r=>r.state!=='REVOKED'),permissions=c.permissions.filter(r=>r.state!=='REVOKED');
    if(!unique(staff,r=>`${r.issuerKey}/${r.staffUserId}`)||!unique(staff,r=>r.operatorId)||!unique(persons,r=>r.personId)||!unique(persons,r=>`${r.locationId}/${r.contactId}`)||!unique(permissions,r=>`${r.staffBindingId}/${r.locationId}/${r.permission}`))throw Error();
    return {proposalVersion:ACCESS_CONTRACTS_PROPOSAL,validation:'VALID_SHAPE' as const,authorizesAccess:false as const,catalogFingerprint:contentHash(c)};
  } catch {throw new Error('ACCESS_CONTRACT_PROPOSAL_INVALID');}
}
export function evaluateBindingCandidate(c:BindingCatalogProposal,t:{issuerKey:string;staffUserId:string;operatorId:string;personId:string;locationId:string;contactId:string},now:string) {
  const result=(status:'CANDIDATE_ONLY'|'DENIED',reason:string,refs:object[]=[])=>({proposalVersion:ACCESS_CONTRACTS_PROPOSAL,authorizesAccess:false as const,status,reason,refs});
  try {
    validateBindingCatalogProposal(c);
    if(!time(now))return result('DENIED','INVALID_TIME');
    const staff=c.staff.filter(r=>r.issuerKey===t.issuerKey&&r.staffUserId===t.staffUserId&&r.state!=='REVOKED');
    if(staff.length!==1||staff[0].state!=='ACTIVE'||staff[0].operatorId!==t.operatorId)return result('DENIED','STAFF_BINDING');
    const grant=c.permissions.filter(r=>r.staffBindingId===staff[0].id&&r.locationId===t.locationId&&r.permission==='RADAR_ADVISOR_READ'&&r.state!=='REVOKED');
    if(grant.length!==1||grant[0].state!=='ACTIVE'||grant[0].expiresAt!==null&&Date.parse(grant[0].expiresAt)<=Date.parse(now))return result('DENIED','PERMISSION');
    const person=c.persons.filter(r=>r.personId===t.personId&&r.state!=='REVOKED');
    if(person.length!==1||person[0].state!=='ACTIVE'||person[0].locationId!==t.locationId||person[0].contactId!==t.contactId)return result('DENIED','PERSON_CONTACT_BINDING');
    return result('CANDIDATE_ONLY','REQUIRES_APPROVED_MANAGEMENT_AND_EVIDENCE_WORKFLOW',[{staffBindingId:staff[0].id,revision:staff[0].revision},{permissionId:grant[0].id,revision:grant[0].revision},{personBindingId:person[0].id,revision:person[0].revision}]);
  } catch {return result('DENIED','INVALID_CATALOG');}
}
/** Pure CAS plan, never persisted here. No create/verify/grant operation exists. */
export function planBindingRestriction(c:BindingCatalogProposal,input:{kind:keyof BindingCatalogProposal;id:string;expectedRevision:number;operation:'REVOKE'|'SUSPEND_CONFLICT';actorId:string;evidenceId:string;at:string}) {
  const before=validateBindingCatalogProposal(c);
  if(!['staff','permissions','persons'].includes(input.kind)||!['REVOKE','SUSPEND_CONFLICT'].includes(input.operation)||![input.id,input.actorId,input.evidenceId].every(validUuid)||!revision(input.expectedRevision)||!time(input.at))throw new Error('ACCESS_CONTRACT_PROPOSAL_INVALID');
  const next=structuredClone(c),record=next[input.kind].find(r=>r.id===input.id);
  if(!record||record.revision!==input.expectedRevision||record.state==='REVOKED')throw new Error('ACCESS_CONTRACT_PROPOSAL_CONFLICT');
  if(Date.parse(input.at)<Date.parse(record.changedAt)||record.revision>=Number.MAX_SAFE_INTEGER)throw new Error('ACCESS_CONTRACT_PROPOSAL_INVALID');
  record.state=input.operation==='REVOKE'?'REVOKED':'CONFLICT';record.revision++;record.changedBy=input.actorId;record.changedAt=input.at;
  const after=validateBindingCatalogProposal(next);
  const audit:ChangeAuditProposal={recordId:record.id,kind:input.kind,operation:input.operation,actorId:input.actorId,fromRevision:input.expectedRevision,toRevision:record.revision,at:input.at,evidenceId:input.evidenceId};
  return {authorizesAccess:false as const,expectedCatalogFingerprint:before.catalogFingerprint,nextCatalogFingerprint:after.catalogFingerprint,next,audit};
}
/** Normalized evidence contract, NOT auth.sessions columns or a JWT decoder. */
export interface StaffSessionEvidenceProposal {
  issuerKey:string;userId:string;sessionId:string;signatureVerified:boolean;issuerAudienceVerified:boolean;
  credentialExpiresAt:string;authority:{mode:'SAME_DATABASE_TRANSACTION'|'EXTERNAL_INDEPENDENT';databaseIdentity:string;userId:string;sessionId:string;sessionPresent:boolean;userActive:boolean;effectiveExpiresAt:string;policyEvaluated:boolean}|null;
}
export function assessStaffSessionProposal(s:StaffSessionEvidenceProposal|null,expected:{issuerKey:string;databaseIdentity:string},now:string) {
  const result=(status:'CURRENT_CANDIDATE'|'DENIED',reason:string)=>({proposalVersion:ACCESS_CONTRACTS_PROPOSAL,authorizesAccess:false as const,status,reason});
  if(!s||!time(now)||!opaque(expected.issuerKey)||s.signatureVerified!==true||s.issuerAudienceVerified!==true||s.issuerKey!==expected.issuerKey||![s.userId,s.sessionId].every(validUuid)||!time(s.credentialExpiresAt)||Date.parse(s.credentialExpiresAt)<=Date.parse(now))return result('DENIED','IDENTITY_OR_CREDENTIAL');
  const a=s.authority;
  if(!a||a.mode!=='SAME_DATABASE_TRANSACTION'||!opaque(expected.databaseIdentity)||a.databaseIdentity!==expected.databaseIdentity)return result('DENIED','ATOMIC_AUTHORITY_UNAVAILABLE');
  if(a.userId!==s.userId||a.sessionId!==s.sessionId||a.sessionPresent!==true||a.userActive!==true||a.policyEvaluated!==true||!time(a.effectiveExpiresAt)||Date.parse(a.effectiveExpiresAt)<=Date.parse(now))return result('DENIED','SESSION_NOT_CURRENT');
  return result('CURRENT_CANDIDATE','REQUIRES_APPROVED_AUTH_IMPLEMENTATION');
}
