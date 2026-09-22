import { ANNUNCI10X_AI_OUTPUT_SCHEMAS } from '../schemas.ts';
import { renderPrompt } from './helpers.ts';
import type { Annunci10xPromptDefinition } from './types.ts';

const invariants = [
  'Apply the smallest necessary revision.',
  'Do not rewrite all sections unless the validation issue requires it.',
  'Do not introduce unsupported facts.',
  'Unsupported facts require confirmation and are not inserted.',
  'requiresValidation must be true because VALIDATE always follows REVISE.',
] as const;

export const REVISE_PROMPT: Annunci10xPromptDefinition = {
  id: 'annunci10x.revise',
  version: 'annunci10x.revise.v1',
  operationType: 'REVISE',
  outputSchema: ANNUNCI10X_AI_OUTPUT_SCHEMAS.REVISE,
  instructions: renderPrompt('REVISE', 'Apply one targeted revision after validation or an allowed edit.', invariants),
  invariants,
};
