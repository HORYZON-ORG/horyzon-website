import { ANNUNCI10X_RUBRIC_CHECKS_V2 } from '../rubric-v2.ts';
import { validateEvaluationChecksV2 } from '../score-v2.ts';
import {
  ANNUNCI10X_CHECK_STATUSES_V2,
  type CheckIdV2,
  type EvaluationCheckV2,
} from '../types-v2.ts';
import type { Annunci10xJsonSchema } from './schemas.ts';

export interface Annunci10xEvaluateOutputV2 {
  checks: EvaluationCheckV2[];
}

const CHECK_IDS_V2 = ANNUNCI10X_RUBRIC_CHECKS_V2.map((definition) => definition.id);
const FORBIDDEN_TOP_LEVEL_FIELDS_V2 = [
  'finalScore',
  'totalScore',
  'coverage',
  'band',
  'gate',
  'publicationStatus',
  'minScore',
  'maxScore',
  'interval',
] as const;

export const ANNUNCI10X_EVALUATE_OUTPUT_SCHEMA_V2 = {
  type: 'object',
  additionalProperties: false,
  required: ['checks'],
  properties: {
    checks: {
      type: 'array',
      minItems: 20,
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'score', 'status', 'evidence', 'reason', 'missing', 'confidence'],
        properties: {
          id: { type: 'string', enum: CHECK_IDS_V2 },
          score: { anyOf: [{ type: 'integer', minimum: 0, maximum: 10 }, { type: 'null' }] },
          status: { type: 'string', enum: ANNUNCI10X_CHECK_STATUSES_V2 },
          evidence: { type: 'array', items: { type: 'string' } },
          reason: { type: 'string' },
          missing: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'integer', minimum: 0, maximum: 100 },
        },
      },
    },
  },
} as const satisfies Annunci10xJsonSchema;

export function validateEvaluateOutputV2(value: unknown): Annunci10xEvaluateOutputV2 {
  const record = requireRecord(value, 'evaluateV2');
  const allowedTopLevel = new Set(['checks']);
  for (const key of Object.keys(record)) {
    if (FORBIDDEN_TOP_LEVEL_FIELDS_V2.includes(key as (typeof FORBIDDEN_TOP_LEVEL_FIELDS_V2)[number])) {
      throw new Error(`evaluateV2 must not include provider-owned field ${key}`);
    }
    if (!allowedTopLevel.has(key)) throw new Error(`evaluateV2 has unknown top-level field ${key}`);
  }

  const rawChecks = requireArray(record.checks, 'evaluateV2.checks');
  const checks = rawChecks.map((rawCheck, index): EvaluationCheckV2 => {
    const item = requireRecord(rawCheck, `evaluateV2.checks[${index}]`);
    const allowedCheckFields = new Set(['id', 'score', 'status', 'evidence', 'reason', 'missing', 'confidence']);
    for (const key of Object.keys(item)) {
      if (!allowedCheckFields.has(key)) throw new Error(`evaluateV2.checks[${index}] has unknown field ${key}`);
    }
    return {
      id: requireCheckId(item.id, `evaluateV2.checks[${index}].id`),
      score: requireScoreOrNull(item.score, `evaluateV2.checks[${index}].score`),
      status: requireStatus(item.status, `evaluateV2.checks[${index}].status`),
      evidence: requireStringArray(item.evidence, `evaluateV2.checks[${index}].evidence`),
      reason: requireString(item.reason, `evaluateV2.checks[${index}].reason`),
      missing: requireStringArray(item.missing, `evaluateV2.checks[${index}].missing`),
      confidence: requireIntegerRange(item.confidence, 0, 100, `evaluateV2.checks[${index}].confidence`),
    };
  });

  const validation = validateEvaluationChecksV2(checks);
  if (!validation.ok) throw new Error(`evaluateV2.checks invalid:\n${validation.errors.join('\n')}`);
  return { checks: checks.map(cloneCheck) };
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

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${path} must be an object`);
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  return value;
}

function requireStringArray(value: unknown, path: string): string[] {
  return requireArray(value, path).map((item, index) => requireString(item, `${path}[${index}]`));
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${path} must be a non-empty string`);
  return value;
}

function requireCheckId(value: unknown, path: string): CheckIdV2 {
  if (typeof value !== 'string' || !CHECK_IDS_V2.includes(value as CheckIdV2)) throw new Error(`${path} is invalid`);
  return value as CheckIdV2;
}

function requireStatus(value: unknown, path: string): EvaluationCheckV2['status'] {
  if (typeof value !== 'string' || !ANNUNCI10X_CHECK_STATUSES_V2.includes(value as EvaluationCheckV2['status'])) throw new Error(`${path} is invalid`);
  return value as EvaluationCheckV2['status'];
}

function requireScoreOrNull(value: unknown, path: string): number | null {
  if (value === null) return null;
  return requireIntegerRange(value, 0, 10, path);
}

function requireIntegerRange(value: unknown, min: number, max: number, path: string): number {
  if (!Number.isInteger(value) || typeof value !== 'number' || value < min || value > max) throw new Error(`${path} must be integer ${min}..${max}`);
  return value;
}
