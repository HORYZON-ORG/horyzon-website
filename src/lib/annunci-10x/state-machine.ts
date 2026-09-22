import type { Clarification, RoleCard, SessionState } from './types.ts';
import { hasMinimumRoleCard } from './validation.ts';

export interface Annunci10xTransitionContext {
  flow: 'CREATE' | 'ANALYZE' | 'GUIDE';
  roleCard?: RoleCard;
  openClarifications?: Clarification[];
}

export interface TransitionResult {
  allowed: boolean;
  reason?: string;
}

const DEFAULT_TRANSITIONS: Partial<Record<SessionState, SessionState[]>> = {
  STARTED: ['COLLECTING', 'PRECHECKED'],
  PRECHECKED: ['ANALYZING', 'COLLECTING'],
  ANALYZING: ['ANALYSIS_READY', 'ERROR'],
  ANALYSIS_READY: ['CLARIFYING', 'READY_FOR_PURCHASE'],
  CLARIFYING: ['COLLECTING', 'ROLE_CARD_READY', 'NEEDS_VERIFICATION'],
  COLLECTING: ['ROLE_CARD_READY', 'ABANDONED', 'ERROR'],
  ROLE_CARD_READY: ['USER_CONFIRMED', 'COLLECTING'],
  USER_CONFIRMED: ['PAYMENT_REQUIRED', 'ENTITLED', 'NEEDS_VERIFICATION'],
  PAYMENT_REQUIRED: ['PURCHASE_PENDING', 'ENTITLED'],
  PURCHASE_PENDING: ['ENTITLED', 'ERROR'],
  ENTITLED: ['GENERATING'],
  GENERATING: ['OUTPUT_READY', 'NEEDS_VERIFICATION', 'ERROR'],
  OUTPUT_READY: ['NEEDS_VERIFICATION'],
  NEEDS_VERIFICATION: ['COLLECTING', 'CLARIFYING'],
};

export function canTransition(from: SessionState, to: SessionState, context: Annunci10xTransitionContext): TransitionResult {
  if (context.flow === 'GUIDE') {
    return { allowed: false, reason: 'Guide purchase is independent from the editorial state machine.' };
  }

  if (context.flow === 'CREATE' && from === 'COLLECTING' && to === 'PAYMENT_REQUIRED') {
    return { allowed: false, reason: 'Create flow cannot require payment before role card confirmation.' };
  }

  if (context.flow === 'CREATE' && from === 'ROLE_CARD_READY' && to === 'USER_CONFIRMED') {
    return hasMinimumRoleCard(context.roleCard)
      ? { allowed: true }
      : { allowed: false, reason: 'RoleCard does not satisfy the minimum documented conditions.' };
  }

  if (context.flow === 'CREATE' && from === 'USER_CONFIRMED' && to === 'PAYMENT_REQUIRED') {
    if (!hasMinimumRoleCard(context.roleCard)) {
      return { allowed: false, reason: 'RoleCard does not satisfy the minimum documented conditions.' };
    }
    if (hasOpenBlockingClarifications(context.openClarifications)) {
      return { allowed: false, reason: 'Blocking clarifications are still open.' };
    }
    return { allowed: true };
  }

  const allowedTargets = DEFAULT_TRANSITIONS[from] ?? [];
  return allowedTargets.includes(to)
    ? { allowed: true }
    : { allowed: false, reason: `Transition ${from} -> ${to} is not allowed.` };
}

export function hasOpenBlockingClarifications(clarifications: Clarification[] | undefined): boolean {
  return Boolean(clarifications?.some((clarification) => clarification.blocking && !clarification.answered));
}
