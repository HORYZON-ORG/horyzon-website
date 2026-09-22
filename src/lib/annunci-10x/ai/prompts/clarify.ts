import { ANNUNCI10X_ALLOWED_ROLE_CARD_PATHS, ANNUNCI10X_AI_OUTPUT_SCHEMAS } from '../schemas.ts';
import { renderPrompt } from './helpers.ts';
import type { Annunci10xPromptDefinition } from './types.ts';

const invariants = [
  'Return COMPLETE or at most one clarification.',
  `If asking, targetPath must be one of: ${ANNUNCI10X_ALLOWED_ROLE_CARD_PATHS.join(', ')}.`,
  'Ask only if the answer can change a published fact, strategy, score evidence, gate, or channel adaptation.',
  'Do not ask again for information already sufficient; accept UNKNOWN/non lo so.',
] as const;

export const CLARIFY_PROMPT: Annunci10xPromptDefinition = {
  id: 'annunci10x.clarify',
  version: 'annunci10x.clarify.v1',
  operationType: 'CLARIFY',
  outputSchema: ANNUNCI10X_AI_OUTPUT_SCHEMAS.CLARIFY,
  instructions: renderPrompt('CLARIFY', 'Decide the next useful clarification, if any.', invariants),
  invariants,
};
