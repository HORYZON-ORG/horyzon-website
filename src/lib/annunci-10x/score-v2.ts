import {
  ANNUNCI10X_RUBRIC_VERSION_V2,
  ANNUNCI10X_SCORE_SEMANTICS_VERSION_V2,
} from './constants.ts';
import { ANNUNCI10X_RUBRIC_CHECKS_V2 } from './rubric-v2.ts';
import {
  ANNUNCI10X_CHECK_STATUSES_V2,
  type CheckIdV2,
  type EvaluationCheckV2,
  type RubricValidationResultV2,
  type ScoreBandDefinitionV2,
  type ScoreResultV2,
} from './types-v2.ts';

export const ANNUNCI10X_SCORE_BANDS_V2: readonly ScoreBandDefinitionV2[] = [
  { code: 'CRITICAL', label: 'Critico', minInclusive: 0, maxExclusive: 50 },
  { code: 'WEAK', label: 'Debole', minInclusive: 50, maxExclusive: 70 },
  { code: 'GOOD_BASE', label: 'Buona base', minInclusive: 70, maxExclusive: 85 },
  { code: 'STRONG', label: 'Forte', minInclusive: 85, maxExclusive: 95 },
  { code: 'EXCELLENT', label: 'Eccellente', minInclusive: 95, maxExclusive: null },
] as const;

const CHECK_COUNT_V2 = 20;

export function getScoreBandV2(score: number | null): ScoreBandDefinitionV2 | null {
  if (score === null) return null;
  if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error(`V2 final score out of range: ${score}`);
  if (score < 50) return ANNUNCI10X_SCORE_BANDS_V2[0];
  if (score < 70) return ANNUNCI10X_SCORE_BANDS_V2[1];
  if (score < 85) return ANNUNCI10X_SCORE_BANDS_V2[2];
  if (score < 95) return ANNUNCI10X_SCORE_BANDS_V2[3];
  return ANNUNCI10X_SCORE_BANDS_V2[4];
}

export function validateEvaluationChecksV2(checks: readonly EvaluationCheckV2[]): RubricValidationResultV2 {
  const errors: string[] = [];
  const expectedIds = new Set(ANNUNCI10X_RUBRIC_CHECKS_V2.map((definition) => definition.id));
  const seenIds = new Set<string>();

  if (checks.length !== CHECK_COUNT_V2) errors.push(`Expected 20 V2 checks, received ${checks.length}`);

  for (const [index, check] of checks.entries()) {
    const path = `checks[${index}]`;
    if (!expectedIds.has(check.id)) errors.push(`${path}.id is unknown: ${check.id}`);
    if (seenIds.has(check.id)) errors.push(`Duplicate V2 check input: ${check.id}`);
    seenIds.add(check.id);

    if (!ANNUNCI10X_CHECK_STATUSES_V2.includes(check.status)) errors.push(`${path}.status is invalid: ${String(check.status)}`);
    if (!Array.isArray(check.evidence) || !check.evidence.every((item) => typeof item === 'string')) errors.push(`${path}.evidence must be string[]`);
    if (!Array.isArray(check.missing) || !check.missing.every((item) => typeof item === 'string')) errors.push(`${path}.missing must be string[]`);
    if (typeof check.reason !== 'string' || !check.reason.trim()) errors.push(`${path}.reason must be non-empty`);
    if (!Number.isInteger(check.confidence) || check.confidence < 0 || check.confidence > 100) errors.push(`${path}.confidence must be integer 0..100`);

    if (check.status === 'NOT_EVALUABLE') {
      if (check.score !== null) errors.push(`${path}.score must be null when status is NOT_EVALUABLE`);
    } else {
      const score = check.score;
      if (!Number.isInteger(score) || score === null || score < 0 || score > 10) errors.push(`${path}.score must be integer 0..10 when status is ${check.status}`);
      if (check.status === 'MISSING' && score !== 0) errors.push(`${path}.score must be 0 when status is MISSING`);
    }
  }

  for (const id of expectedIds) {
    if (!seenIds.has(id)) errors.push(`Missing V2 check input: ${id}`);
  }

  return { ok: errors.length === 0, errors };
}

export function calculateAnnunci10xScoreV2(checks: readonly EvaluationCheckV2[]): ScoreResultV2 {
  const validation = validateEvaluationChecksV2(checks);
  if (!validation.ok) throw new Error(`Invalid Annunci 10x V2 score input:\n${validation.errors.join('\n')}`);

  const checksById = new Map<CheckIdV2, EvaluationCheckV2>();
  for (const check of checks) checksById.set(check.id, cloneCheck(check));

  const orderedChecks = ANNUNCI10X_RUBRIC_CHECKS_V2.map((definition) => {
    const check = checksById.get(definition.id);
    if (!check) throw new Error(`Missing validated V2 check ${definition.id}`);
    return check;
  });

  const evaluable = orderedChecks.filter((check) => check.score !== null);
  const evaluableCheckCount = evaluable.length;
  const coverage = (evaluableCheckCount / CHECK_COUNT_V2) * 100;
  const value = evaluableCheckCount === 0
    ? null
    : (100 * evaluable.reduce((sum, check) => sum + (check.score ?? 0), 0)) / (10 * evaluableCheckCount);

  return {
    value,
    max: 100,
    coverage,
    evaluableCheckCount,
    totalCheckCount: CHECK_COUNT_V2,
    band: getScoreBandV2(value),
    checks: orderedChecks,
    rubricVersion: ANNUNCI10X_RUBRIC_VERSION_V2,
    scoreSemanticsVersion: ANNUNCI10X_SCORE_SEMANTICS_VERSION_V2,
  };
}

function cloneCheck(check: EvaluationCheckV2): EvaluationCheckV2 {
  return {
    id: check.id,
    score: check.score,
    status: check.status,
    evidence: [...check.evidence],
    reason: check.reason,
    missing: [...check.missing],
    confidence: check.confidence,
  };
}
