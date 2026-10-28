import type { Area, AreaState, Goal, Scope } from '../patrimonial-radar/types.ts';

/** Explicit wire allowlist. No answers, indicators, matrices or Advisor fields. */
export interface CustomerResult {
  projectionVersion: 'RP-CLIENT-4C2-1';
  asOf: string; scope: Scope | null; partial: boolean;
  areas: Record<Area, { state: AreaState; evidence: { text: string; limitation: string }[]; resolved: number; applicable: number }>;
  strengths: string[]; priorities: string[]; further: string[]; limitations: string[];
  incoherent: boolean; reconfirmCount: number; inactiveCount: number;
  goals: { category: Goal['category']; rank: Goal['rank']; horizon: Goal['horizon']; clarify: boolean }[];
  goalChecks: { title: string; status: 'COHERENT' | 'CLARIFY' | 'INSUFFICIENT' }[];
}
export interface CustomerSnapshot {
  id: string; assessmentId: string; approvedRevision: number; completedAt: string;
  customer: CustomerResult;
}
