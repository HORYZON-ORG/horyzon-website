/** Local PROPOSED workflow review only. No identity verification, management
 * authority, grant writer, database adapter or release of an Advisor dossier.
 * Inputs are synthetic/trusted-port models, never an HTTP authorization body. */
import {
  assessStaffSessionProposal, evaluateBindingCandidate, validateBindingCatalogProposal,
} from './access-contracts-proposal.ts';
import type { BindingCatalogProposal, StaffSessionEvidenceProposal } from './access-contracts-proposal.ts';
import { evaluateRelationshipPolicyProposal } from './relationship-policy-proposal.ts';
import type { RelationshipInventoryProposal } from './relationship-policy-proposal.ts';
import { contentHash } from '../patrimonial-radar-server/security.ts';

export interface ControlledLinkingReviewProposal {
  subject: {issuerKey:string;staffUserId:string;operatorId:string;personId:string;assessmentId:string;locationId:string;contactId:string};
  session: StaffSessionEvidenceProposal|null;
  expectedSessionAuthority: {issuerKey:string;databaseIdentity:string};
  catalog: BindingCatalogProposal;
  relationships: RelationshipInventoryProposal;
  now: string;
}
const requiredImplementations = [
  'AUTHORITATIVE_STAFF_SESSION_VERIFIER',
  'EXPLICIT_MANAGEMENT_APPROVER_AND_P1_BINDING_WRITER',
  'SPECIFIC_ADVISOR_GRANT_WRITER',
  'CONTEXTUAL_PERSON_CONTACT_EVIDENCE_WRITER',
  'APPROVED_EPISODE_SCOPE_REPOSITORY',
  'ATOMIC_DECISION_AUDIT_AND_REVOCATION_FENCING',
] as const;

/** Compose the existing local models and reject cross-subject proof mixing.
 * Even a completely consistent review cannot prove any real approval/evidence
 * or satisfy the missing atomic audit contract. No supervisor/email shortcut. */
export function reviewControlledLinkingProposal(input: ControlledLinkingReviewProposal) {
  const finish = (status:'CANDIDATE_ONLY'|'DENIED', reason:string, fingerprint:string|null=null) => ({
    policyStatus:'PROPOSED' as const, authorizesAccess:false as const,
    status, reason, fingerprint, requiredImplementations:[...requiredImplementations],
  });
  try {
    const {subject,session,catalog,relationships,now} = input;
    if(assessStaffSessionProposal(session,input.expectedSessionAuthority,now).status!=='CURRENT_CANDIDATE') return finish('DENIED','STAFF_SESSION');
    if(session!.userId!==subject.staffUserId||session!.issuerKey!==subject.issuerKey) return finish('DENIED','STAFF_SUBJECT_MISMATCH');
    const catalogProof=validateBindingCatalogProposal(catalog);
    const bindings=evaluateBindingCandidate(catalog,subject,now);
    if(bindings.status!=='CANDIDATE_ONLY') return finish('DENIED',bindings.reason);
    for(const key of ['personId','assessmentId','locationId','contactId','operatorId'] as const) {
      if(relationships[key]!==subject[key]) return finish('DENIED','RELATION_SUBJECT_MISMATCH');
    }
    const relation=evaluateRelationshipPolicyProposal(relationships);
    if(relation.status!=='CANDIDATE_ONLY') return finish('DENIED',relation.reason);
    return finish('CANDIDATE_ONLY','AUTHORITATIVE_WORKFLOW_AND_ATOMIC_AUDIT_NOT_IMPLEMENTED',contentHash({
      subject,catalog:catalogProof.catalogFingerprint,inventory:relation.inventoryFingerprint,
      sessionId:session!.sessionId,credentialExpiresAt:session!.credentialExpiresAt,
      sessionExpiresAt:session!.authority!.effectiveExpiresAt,now,
    }));
  } catch { return finish('DENIED','INVALID_LOCAL_REVIEW'); }
}
