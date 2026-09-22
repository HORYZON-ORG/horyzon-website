import { ANNUNCI10X_AI_OUTPUT_SCHEMAS } from '../schemas.ts';
import { renderPrompt } from './helpers.ts';
import type { Annunci10xPromptDefinition } from './types.ts';

const invariants = [
  'Be adversarial toward GENERATE.',
  'Actively find what the generator added without authorization.',
  'Detect unsupported claims, contradictions, omitted critical facts, and altered requirements.',
  'Do not rewrite the full ad.',
  'Return PASS, NEEDS_REVISION, or BLOCK.',
] as const;

export const VALIDATE_PROMPT: Annunci10xPromptDefinition = {
  id: 'annunci10x.validate',
  version: 'annunci10x.validate.v1',
  operationType: 'VALIDATE',
  outputSchema: ANNUNCI10X_AI_OUTPUT_SCHEMAS.VALIDATE,
  instructions: renderPrompt('VALIDATE', 'Validate generated content against confirmed facts.', invariants),
  invariants,
};
