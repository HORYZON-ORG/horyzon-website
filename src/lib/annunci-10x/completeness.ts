import type { RoleCard } from './types.ts';

export type CompletenessStatus = 'COMPLETE' | 'GENERABLE_WITH_VERIFICATION' | 'BLOCKED';

export interface CompletenessInput {
  roleCard?: Partial<RoleCard>;
  compensationKnown?: boolean;
  compensationRequired?: boolean;
  compensationNonDisclosed?: boolean;
  workModeConflict?: boolean;
  primaryContributionMissing?: boolean;
  criticalMissingFields?: readonly string[];
  unsupportedGeneratedClaim?: boolean;
}

export interface CompletenessResult {
  status: CompletenessStatus;
  blockingReasons: string[];
  verificationNotes: string[];
}

export function evaluateAnnunci10xCompleteness(input: CompletenessInput): CompletenessResult {
  const blockingReasons: string[] = [];
  const verificationNotes: string[] = [];

  if (input.workModeConflict) blockingReasons.push('workMode has conflicting material information.');
  if (input.primaryContributionMissing || !hasPrimaryContribution(input.roleCard)) {
    blockingReasons.push('primary contribution is missing and needs clarification before complete generation.');
  }
  for (const field of input.criticalMissingFields ?? []) {
    blockingReasons.push(`${field} is critical and missing.`);
  }

  if (input.compensationKnown === false || input.compensationNonDisclosed) {
    if (input.compensationRequired) blockingReasons.push('compensation is required in this context and missing.');
    else verificationNotes.push('compensation is unknown or non-disclosed; generation can continue with verification.');
  }

  if (input.unsupportedGeneratedClaim) {
    verificationNotes.push('unsupported generated claims are handled by validation/gates, not initial completeness.');
  }

  return {
    status: blockingReasons.length ? 'BLOCKED' : verificationNotes.length ? 'GENERABLE_WITH_VERIFICATION' : 'COMPLETE',
    blockingReasons,
    verificationNotes,
  };
}

function hasPrimaryContribution(roleCard: Partial<RoleCard> | undefined): boolean {
  return Boolean(roleCard?.mission?.value || roleCard?.outcomes?.length || roleCard?.responsibilities?.length);
}
