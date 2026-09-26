import type {
  ANNUNCI10X_RUBRIC_VERSION_V2,
  ANNUNCI10X_SCORE_SEMANTICS_VERSION_V2,
} from './constants.ts';

export const ANNUNCI10X_CHECK_STATUSES_V2 = [
  'EVALUATED',
  'MISSING',
  'UNSUPPORTED',
  'CONFLICT',
  'NOT_EVALUABLE',
] as const;

export const ANNUNCI10X_SCORE_BAND_CODES_V2 = [
  'CRITICAL',
  'WEAK',
  'GOOD_BASE',
  'STRONG',
  'EXCELLENT',
] as const;

export const ANNUNCI10X_ACCELERATOR_SUITABILITY_V2 = [
  'DETERMINISTIC_CANDIDATE',
  'CLOSED_DECISION_CANDIDATE',
  'LLM_COMPLEX',
] as const;

export type EvaluationCheckStatusV2 = (typeof ANNUNCI10X_CHECK_STATUSES_V2)[number];
export type ScoreBandCodeV2 = (typeof ANNUNCI10X_SCORE_BAND_CODES_V2)[number];
export type AcceleratorSuitabilityV2 = (typeof ANNUNCI10X_ACCELERATOR_SUITABILITY_V2)[number];
export type AnchorScoreV2 = 0 | 2 | 4 | 6 | 8 | 10;
export type CheckIdV2 =
  | '01'
  | '02'
  | '03'
  | '04'
  | '05'
  | '06'
  | '07'
  | '08'
  | '09'
  | '10'
  | '11'
  | '12'
  | '13'
  | '14'
  | '15'
  | '16'
  | '17'
  | '18'
  | '19'
  | '20';

export interface RubricAnchorV2 {
  score: AnchorScoreV2;
  description: string;
}

export interface GateRelevanceV2 {
  relevant: boolean;
  notes: string;
}

export interface RubricCheckDefinitionV2 {
  id: CheckIdV2;
  canonicalQuestion: string;
  label: string;
  maxScore: 10;
  anchors: readonly RubricAnchorV2[];
  missingSemantics: string;
  notEvaluableSemantics: string;
  gateRelevance: GateRelevanceV2;
  acceleratorSuitability: AcceleratorSuitabilityV2;
  notes?: readonly string[];
}

export interface RubricValidationResultV2 {
  ok: boolean;
  errors: string[];
}

export interface EvaluationCheckV2 {
  id: CheckIdV2;
  score: number | null;
  status: EvaluationCheckStatusV2;
  evidence: string[];
  reason: string;
  missing: string[];
  confidence: number;
}

export interface ScoreBandDefinitionV2 {
  code: ScoreBandCodeV2;
  label: string;
  min: number;
  max: number;
}

export interface ScoreResultV2 {
  value: number | null;
  max: 100;
  coverage: number;
  evaluableCheckCount: number;
  totalCheckCount: 20;
  band: ScoreBandDefinitionV2 | null;
  checks: EvaluationCheckV2[];
  rubricVersion: typeof ANNUNCI10X_RUBRIC_VERSION_V2;
  scoreSemanticsVersion: typeof ANNUNCI10X_SCORE_SEMANTICS_VERSION_V2;
}
