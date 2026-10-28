import { resolveRemoteOwner, type PatrimonialOperator } from './patrimonial-assignments.ts';
import type { PatrimonialOpportunityQuery } from './patrimonial-highlevel.ts';

// P2A pure specifications only. No transport, store, outbox dispatch or executor.
// A mapping/evidence object is NOT a credential or an authorization to write.
export type PatrimonialOwnerMappingState = 'UNMAPPED' | 'MAPPED_UNVERIFIED' | 'MAPPED_VERIFIED';
type OperatorIdentity = Readonly<Pick<PatrimonialOperator, 'id' | 'active' | 'remoteUserRef'>>;
export type PatrimonialRemoteUserEvidence = Readonly<{
  remoteUserId: string;
  locationId: string;
  locationMembershipVerified: boolean;
  active: boolean | null;
  role: string | null;
  readAt: string;
  evidenceRef: string;
  source: 'LOCATION_USERS_READ';
}>;
type MappingResolution = Readonly<{
  state: PatrimonialOwnerMappingState;
  remoteOwnerTarget: string | null;
  reason: 'UNMAPPED' | 'USER_EVIDENCE_UNVERIFIED' | 'USER_UNAVAILABLE' | 'USER_AVAILABILITY_UNVERIFIED' | 'LOCAL_OPERATOR_INACTIVE' | null;
}>;

const opaque = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(v);
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const iso = (v: unknown): v is string => typeof v === 'string' && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v));

// Only a future trusted server reader may supply evidence. A hand-entered,
// syntactically valid remote_user_ref alone never becomes MAPPED_VERIFIED.
// Fixture evidence proves local behavior, not live users/location permissions.
export function resolvePatrimonialOwnerTarget(operator: OperatorIdentity | null, locationId: string, evidence: PatrimonialRemoteUserEvidence | null): MappingResolution {
  const candidate = operator ? resolveRemoteOwner(operator) : null;
  if (candidate === null) return { state: 'UNMAPPED', remoteOwnerTarget: null, reason: 'UNMAPPED' };
  if (!operator || !uuid(operator.id) || !opaque(candidate) || candidate === operator.id || !opaque(locationId)
    || !evidence || evidence.source !== 'LOCATION_USERS_READ' || evidence.remoteUserId !== candidate
    || evidence.locationId !== locationId || evidence.locationMembershipVerified !== true
    || !iso(evidence.readAt) || !opaque(evidence.evidenceRef)
    || !(evidence.active === null || typeof evidence.active === 'boolean')
    || !(evidence.role === null || opaque(evidence.role))) {
    return { state: 'MAPPED_UNVERIFIED', remoteOwnerTarget: null, reason: 'USER_EVIDENCE_UNVERIFIED' };
  }
  if (operator.active !== true) return { state: 'MAPPED_VERIFIED', remoteOwnerTarget: null, reason: 'LOCAL_OPERATOR_INACTIVE' };
  if (evidence.active === false) return { state: 'MAPPED_VERIFIED', remoteOwnerTarget: null, reason: 'USER_UNAVAILABLE' };
  if (evidence.active === null) return { state: 'MAPPED_VERIFIED', remoteOwnerTarget: null, reason: 'USER_AVAILABILITY_UNVERIFIED' };
  return { state: 'MAPPED_VERIFIED', remoteOwnerTarget: candidate, reason: null };
}

// Normalized read evidence for local fixtures/future verified adapters. This is
// NOT a decoder of a proven HighLevel wire envelope or an HTTP binding.
export type PatrimonialOwnerReadScope = Readonly<PatrimonialOpportunityQuery & { opportunityId: string }>;
export type PatrimonialOwnerObservation = Readonly<PatrimonialOwnerReadScope & {
  assignedTo: string | null;
  version: string | null;
}>;
export class PatrimonialOwnerReadinessError extends Error {
  readonly code: 'SCHEMA' | 'IDENTITY' | 'INCOMPLETE';
  constructor(code: PatrimonialOwnerReadinessError['code']) { super(`Patrimonial owner readiness ${code}`); this.code=code; }
}
function requireRead(value: unknown, code: PatrimonialOwnerReadinessError['code'] = 'SCHEMA'): asserts value {
  if (!value) throw new PatrimonialOwnerReadinessError(code);
}
function record(v: unknown): v is Record<string, unknown> { return v !== null && typeof v === 'object' && !Array.isArray(v); }

// Explicit null and omitted assignedTo remain distinct wire shapes. HighLevel v3
// has been observed omitting assignedTo on an unassigned synthetic opportunity;
// that omission is normalized to null only under an explicit verified contract.
export function checkedPatrimonialOwnerRead(page: unknown, scope: PatrimonialOwnerReadScope, contract: Readonly<{ nullableAssignedTo: boolean; omittedAssignedToMeansUnassigned?: boolean }> = { nullableAssignedTo: false, omittedAssignedToMeansUnassigned: false }): PatrimonialOwnerObservation | null {
  requireRead([scope.locationId,scope.contactId,scope.pipelineId,scope.opportunityId].every(opaque), 'IDENTITY');
  requireRead(record(page) && Array.isArray(page.opportunities));
  requireRead(page.complete === true && (page.nextCursor === undefined || page.nextCursor === null), 'INCOMPLETE');
  requireRead(page.opportunities.length <= 1, 'IDENTITY');
  if (page.opportunities.length === 0) return null;
  const row: unknown = page.opportunities[0];
  requireRead(record(row));
  requireRead(row.locationId === scope.locationId && row.contactId === scope.contactId
    && row.pipelineId === scope.pipelineId && row.opportunityId === scope.opportunityId, 'IDENTITY');
  const hasAssignedTo = Object.hasOwn(row, 'assignedTo');
  if (hasAssignedTo) requireRead(opaque(row.assignedTo) || (contract.nullableAssignedTo === true && row.assignedTo === null));
  else requireRead(contract.omittedAssignedToMeansUnassigned === true);
  requireRead(Object.hasOwn(row, 'version') && (row.version === null || opaque(row.version)));
  // Strict projection: no remote profiles, contacts or raw response retained.
  return { locationId:scope.locationId, contactId:scope.contactId, pipelineId:scope.pipelineId, opportunityId:scope.opportunityId,
    assignedTo:(hasAssignedTo ? row.assignedTo : null) as string | null, version:row.version as string | null };
}

// Future intent-specific plan, not an outbox union member or enqueueable effect.
export type PatrimonialOwnerSyncPlan = Readonly<{
  intentId: string;
  operatorId: string;
  expectedOperatorRevision: number;
  opportunityId: string;
  remoteUserRef: string;
  expectedOwnerRef: string | null;
  targetOwnerRef: string;
  expectedOpportunityVersion: string;
}>;
type OwnerRead =
  | { kind: 'NOT_READ' }
  | { kind: 'UNCERTAIN_TIMEOUT' }
  | { kind: 'COMPLETE'; page: unknown; contract?: { nullableAssignedTo: boolean; omittedAssignedToMeansUnassigned?: boolean } };
export type PatrimonialOwnerReadinessInput = Readonly<{
  intentId: string;
  currentOperatorId: string | null;
  operatorRevision: number;
  operator: OperatorIdentity | null;
  remoteUserEvidence: PatrimonialRemoteUserEvidence | null;
  scope: PatrimonialOwnerReadScope;
  expectedOwnerRef: string | null;
  expectedOpportunityVersion: string | null;
  ownerSyncEnabled?: boolean;
  operation?: 'ASSIGN' | 'CLEAR';
  read: OwnerRead;
}>;
type HoldReason = NonNullable<MappingResolution['reason']> | 'OWNER_SYNC_DISABLED' | 'OWNER_CLEAR_UNVERIFIED'
  | 'IDENTITY' | 'SCHEMA' | 'INCOMPLETE' | 'OPPORTUNITY_NOT_FOUND' | 'VERSION_UNVERIFIED' | 'REMOTE_CHANGED';
type PlanOnly = { phase: 'P2A_PLAN_ONLY'; executionAllowed: false; mappingState: PatrimonialOwnerMappingState };
export type PatrimonialOwnerReadinessResult = PlanOnly & (
  | { action: 'HOLD'; reason: HoldReason }
  | { action: 'RECONCILE_REQUIRED'; reason: 'READ_BEFORE_RETRY'; requiresReadBeforeRetry: true }
  | { action: 'IDEMPOTENT_SUCCESS' | 'WRITE_REQUIRED'; plan: PatrimonialOwnerSyncPlan }
);

export function planPatrimonialOwnerSync(input: PatrimonialOwnerReadinessInput): PatrimonialOwnerReadinessResult {
  const mapping = resolvePatrimonialOwnerTarget(input.operator, input.scope.locationId, input.remoteUserEvidence);
  const base: PlanOnly = { phase: 'P2A_PLAN_ONLY', executionAllowed: false, mappingState: mapping.state };
  const hold = (reason: HoldReason): PatrimonialOwnerReadinessResult => ({ ...base, action: 'HOLD', reason });
  if (input.ownerSyncEnabled !== true) return hold('OWNER_SYNC_DISABLED');
  if (input.operation === 'CLEAR') return hold('OWNER_CLEAR_UNVERIFIED');
  if (!uuid(input.intentId) || !uuid(input.currentOperatorId) || input.operator?.id !== input.currentOperatorId
    || !Number.isSafeInteger(input.operatorRevision) || input.operatorRevision < 0
    || (input.expectedOwnerRef !== null && !opaque(input.expectedOwnerRef))) return hold('IDENTITY');
  if (mapping.remoteOwnerTarget === null) return hold(mapping.reason ?? 'USER_EVIDENCE_UNVERIFIED');
  // An uncertain prior dispatch never falls through into another write plan.
  // Caller must supply a NEW complete observation after reconciliation reads.
  if (input.read.kind !== 'COMPLETE') return { ...base, action: 'RECONCILE_REQUIRED', reason: 'READ_BEFORE_RETRY', requiresReadBeforeRetry: true };
  let row: PatrimonialOwnerObservation | null;
  try { row = checkedPatrimonialOwnerRead(input.read.page, input.scope, input.read.contract); }
  catch (error) { if (error instanceof PatrimonialOwnerReadinessError) return hold(error.code); throw error; }
  if (!row) return hold('OPPORTUNITY_NOT_FOUND');
  if (!opaque(input.expectedOpportunityVersion) || !opaque(row.version)) return hold('VERSION_UNVERIFIED');
  const plan: PatrimonialOwnerSyncPlan = {
    intentId: input.intentId, operatorId: input.currentOperatorId, expectedOperatorRevision: input.operatorRevision,
    opportunityId: row.opportunityId, remoteUserRef: mapping.remoteOwnerTarget, expectedOwnerRef: input.expectedOwnerRef,
    targetOwnerRef: mapping.remoteOwnerTarget, expectedOpportunityVersion: row.version,
  };
  if (row.assignedTo === plan.targetOwnerRef) return { ...base, action: 'IDEMPOTENT_SUCCESS', plan };
  // A human edit or changed version must not be overwritten by an old checkpoint.
  if (row.assignedTo !== input.expectedOwnerRef || row.version !== input.expectedOpportunityVersion) return hold('REMOTE_CHANGED');
  return { ...base, action: 'WRITE_REQUIRED', plan };
}
