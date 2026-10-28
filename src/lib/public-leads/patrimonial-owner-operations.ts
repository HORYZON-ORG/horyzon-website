import { createHash, randomUUID } from 'node:crypto';
import type { PatrimonialOutboxOperation } from './patrimonial-contract.ts';
import type { AssignmentIntent, PatrimonialOperator, ProspectAssignment } from './patrimonial-assignments.ts';
import type { PatrimonialMutation, PatrimonialClaimInput } from './patrimonial-store.ts';
import type { PatrimonialOpportunityIntent } from './patrimonial-routing.ts';

export const contactEffectKinds = ['SYNC_REQUEST','RESOLVE_CONTACT','UPSERT_CONTACT','ADD_TAGS','ADD_NOTE'] as const;
export const ownerEffectKind = 'ASSIGN_OPPORTUNITY_OWNER' as const;
export type OwnerPayload = {
  assignmentId: string; operatorId: string; operatorRevision: number; assignmentRevision: number;
  registryRevision: number; targetRemoteUserRef: string; expectedOwnerRef: string | null;
  checkpointRevision: number; businessKey: string; effectMayHaveCommitted: boolean;
};
export type OwnerOperation = Omit<PatrimonialOutboxOperation,'kind'|'requestId'> & {
  kind: typeof ownerEffectKind; requestId: string | null; owner: OwnerPayload; outcome?: string;
};
export type OwnerContext = {
  operation: OwnerOperation; valid: boolean;
  intent: Pick<PatrimonialOpportunityIntent,'id'|'locationId'|'contactId'|'pipeline'|'businessKey'|'remote'>;
};
export type OwnerObservation = {
  id: string; locationId: string; contactId: string; pipelineId: string;
  assignedTo: string | null; businessKey: string | null; versionMarker: string | null;
};
export type OwnerFinish = PatrimonialMutation & {
  outcome: 'CONFIRMED'|'SUPERSEDED'|'HOLD'|'RECONCILE_REQUIRED'|'REPLAN'; reason: string;
  observation?: OwnerObservation;
};
export interface PatrimonialOwnerTransaction {
  claimOwnerOperations(input: PatrimonialClaimInput): Promise<OwnerOperation[]>;
  getOwnerContext(input: PatrimonialMutation): Promise<OwnerContext>;
  authorizeOwnerWrite(input: PatrimonialMutation): Promise<OwnerContext>;
  finishOwnerOperation(input: OwnerFinish): Promise<void>;
}
export interface PatrimonialOwnerStore extends PatrimonialOwnerTransaction {
  renewLease(input: PatrimonialMutation & {leaseSeconds?: number}): Promise<void>;
}
export function makeOwnerOperation(intent: AssignmentIntent, assignment: ProspectAssignment, operator: PatrimonialOperator, operatorRevision: number, at: string): OwnerOperation {
  if (!operator.remoteUserRef || !intent.businessKey || !Number.isInteger(intent.ownerCheckpointRevision)) throw new Error('Owner context unavailable');
  const owner: OwnerPayload = {assignmentId:assignment.id,operatorId:operator.id,operatorRevision,assignmentRevision:assignment.revision,
    registryRevision:operator.revision,targetRemoteUserRef:operator.remoteUserRef,expectedOwnerRef:intent.ownerRef,
    checkpointRevision:intent.ownerCheckpointRevision!,businessKey:intent.businessKey,effectMayHaveCommitted:false};
  const operationKey = `owner:v1:${createHash('sha256').update(JSON.stringify([intent.id,owner])).digest('hex')}`;
  return {id:randomUUID(),operationKey,intentId:intent.id,requestId:intent.quality.requestId,kind:ownerEffectKind,
    technicalState:'SYNC_PENDING',createdAt:at,nextAttemptAt:at,attemptCount:0,leaseToken:null,leaseVersion:0,leaseExpiresAt:null,
    reconcileRequired:false,lastErrorCode:null,identityLockKey:`patrimonial-owner:${intent.id}`,owner};
}
