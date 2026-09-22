import { ANNUNCI10X_RUBRIC } from '../../rubric.ts';
import { ANNUNCI10X_AI_OUTPUT_SCHEMAS } from '../schemas.ts';
import { renderPrompt } from './helpers.ts';
import type { Annunci10xPromptDefinition } from './types.ts';

const invariants = [
  `Return exactly ${ANNUNCI10X_RUBRIC.checks.length} checks, one for each rubric check id.`,
  'Do not calculate total score, finalScore, points, or publication status.',
  'MISSING and NOT_EVALUABLE are different: missing expected information is MISSING; not applicable/not determinable is NOT_EVALUABLE.',
  'Evidence and suggestions can inform deterministic TypeScript scoring but cannot replace it.',
] as const;

export const EVALUATE_PROMPT: Annunci10xPromptDefinition = {
  id: 'annunci10x.evaluate',
  version: 'annunci10x.evaluate.v1',
  operationType: 'EVALUATE',
  outputSchema: ANNUNCI10X_AI_OUTPUT_SCHEMAS.EVALUATE,
  instructions: renderPrompt('EVALUATE', 'Prepare check statuses and evidence for deterministic scoring.', invariants),
  invariants,
};
