import { ANNUNCI10X_AI_OUTPUT_SCHEMAS } from '../schemas.ts';
import { renderPrompt } from './helpers.ts';
import type { Annunci10xPromptDefinition } from './types.ts';

const invariants = [
  'Classify edit requests as EDITORIAL, FACTUAL, STRATEGIC, or UNSUPPORTED_FACT.',
  'Unsupported market/company claims require confirmation and must not be inserted.',
  'Use affectedPaths to point at RoleCard or output sections affected by the edit.',
] as const;

export const EDIT_CLASSIFIER_PROMPT: Annunci10xPromptDefinition = {
  id: 'annunci10x.edit_classifier',
  version: 'annunci10x.edit_classifier.v1',
  operationType: 'EDIT_CLASSIFIER',
  outputSchema: ANNUNCI10X_AI_OUTPUT_SCHEMAS.EDIT_CLASSIFIER,
  instructions: renderPrompt('EDIT_CLASSIFIER', 'Classify the user edit request before any revision.', invariants),
  invariants,
};
