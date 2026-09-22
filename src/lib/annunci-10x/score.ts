import { ANNUNCI10X_RUBRIC_VERSION } from './constants.ts';
import { ANNUNCI10X_RUBRIC, getRubricCheckDefinition } from './rubric.ts';
import type { CheckStatus, EvaluationCheck, ScoreResult } from './types.ts';

export type ScoreBandId = 'INSUFFICIENT' | 'NEEDS_REINFORCEMENT' | 'USABLE_BASE' | 'GOOD_COMPLETENESS';

export interface ScoreBandDefinition {
  id: ScoreBandId;
  min: number;
  max: number;
  label: string;
  experimental: true;
}

export type ScoreBandAssessment =
  | { kind: 'DEFINITE'; band: ScoreBandDefinition }
  | { kind: 'RANGE'; minBand: ScoreBandDefinition; maxBand: ScoreBandDefinition; bands: ScoreBandDefinition[] };

export interface RubricCheckInput {
  id: string;
  status: CheckStatus;
  evidence?: string[];
  gateImpact?: EvaluationCheck['gateImpact'];
  rubricVersion?: string;
  score?: number | null;
}

export interface Annunci10xScoreResult extends ScoreResult {
  finalScore: number | null;
  minScore: number;
  maxScore: number;
  band: ScoreBandAssessment;
}

export const ANNUNCI10X_SCORE_BANDS: readonly ScoreBandDefinition[] = [
  { id: 'INSUFFICIENT', min: 0, max: 39, label: 'informazioni/coerenza insufficienti', experimental: true },
  { id: 'NEEDS_REINFORCEMENT', min: 40, max: 59, label: 'struttura da rafforzare', experimental: true },
  { id: 'USABLE_BASE', min: 60, max: 79, label: 'base utilizzabile con priorita', experimental: true },
  { id: 'GOOD_COMPLETENESS', min: 80, max: 100, label: 'buona completezza/coerenza', experimental: true },
] as const;

export function getPointsForCheckStatus(status: CheckStatus, maxPoints = 5): number | null {
  if (status === 'PASS') return maxPoints;
  if (status === 'PARTIAL') return maxPoints / 2;
  if (status === 'MISSING' || status === 'CONFLICT') return 0;
  return null;
}

export function calculateAnnunci10xScore(checks: readonly RubricCheckInput[]): Annunci10xScoreResult {
  assertCompleteRubricInput(checks);

  let observedScore = 0;
  let unknownMax = 0;
  const scoredChecks: EvaluationCheck[] = checks
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((input) => {
      const definition = getRubricCheckDefinition(input.id);
      const score = getPointsForCheckStatus(input.status, definition.maxPoints);
      if (score === null) unknownMax += definition.maxPoints;
      else observedScore += score;
      return {
        id: definition.id,
        label: definition.label,
        score,
        maxScore: definition.maxPoints,
        status: input.status,
        evidence: input.evidence ?? [],
        gateImpact: input.gateImpact ?? (input.status === 'CONFLICT' ? 'WARNING' : 'NONE'),
      };
    });

  const minScore = roundToHalf(observedScore);
  const maxScore = roundToHalf(observedScore + unknownMax);
  const coverage = roundToHalf(((ANNUNCI10X_RUBRIC.totalMaxPoints - unknownMax) / ANNUNCI10X_RUBRIC.totalMaxPoints) * 100);
  const hasInterval = minScore !== maxScore;
  const finalScore = hasInterval ? null : minScore;

  return {
    value: finalScore,
    finalScore,
    minScore,
    maxScore,
    max: 100,
    interval: hasInterval ? { min: minScore, max: maxScore } : undefined,
    coverage,
    checks: scoredChecks,
    rubricVersion: ANNUNCI10X_RUBRIC_VERSION,
    band: assessScoreBand(minScore, maxScore),
  };
}

export function assessScoreBand(minScore: number, maxScore = minScore): ScoreBandAssessment {
  const minBand = getScoreBand(minScore);
  const maxBand = getScoreBand(maxScore);
  if (minBand.id === maxBand.id) return { kind: 'DEFINITE', band: minBand };
  const bands = ANNUNCI10X_SCORE_BANDS.filter((band) => band.min <= maxScore && minScore <= band.max);
  return { kind: 'RANGE', minBand, maxBand, bands };
}

export function getScoreBand(score: number): ScoreBandDefinition {
  if (score < 0 || score > 100 || !Number.isFinite(score)) throw new Error(`Score out of range: ${score}`);
  if (score < 40) return ANNUNCI10X_SCORE_BANDS[0];
  if (score < 60) return ANNUNCI10X_SCORE_BANDS[1];
  if (score < 80) return ANNUNCI10X_SCORE_BANDS[2];
  return ANNUNCI10X_SCORE_BANDS[3];
}

function assertCompleteRubricInput(checks: readonly RubricCheckInput[]): void {
  if (checks.length !== ANNUNCI10X_RUBRIC_CHECK_COUNT) throw new Error(`Expected 20 rubric checks, received ${checks.length}`);
  const ids = new Set<string>();
  for (const input of checks) {
    if (ids.has(input.id)) throw new Error(`Duplicate rubric check input: ${input.id}`);
    ids.add(input.id);
    if (input.rubricVersion !== undefined && input.rubricVersion !== ANNUNCI10X_RUBRIC_VERSION) throw new Error(`Invalid rubric version for check ${input.id}`);
    const definition = getRubricCheckDefinition(input.id);
    if (!definition.allowedStatuses.includes(input.status)) throw new Error(`Invalid status ${input.status} for check ${input.id}`);
  }
  for (const definition of ANNUNCI10X_RUBRIC.checks) {
    if (!ids.has(definition.id)) throw new Error(`Missing rubric check input: ${definition.id}`);
  }
}

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

const ANNUNCI10X_RUBRIC_CHECK_COUNT = 20;
