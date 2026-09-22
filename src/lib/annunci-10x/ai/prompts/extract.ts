import { ANNUNCI10X_ALLOWED_ROLE_CARD_PATHS, ANNUNCI10X_AI_OUTPUT_SCHEMAS } from '../schemas.ts';
import { renderPrompt } from './helpers.ts';
import type { Annunci10xPromptDefinition } from './types.ts';

const invariants = [
  `targetPath must be one of: ${ANNUNCI10X_ALLOWED_ROLE_CARD_PATHS.join(', ')}.`,
  'Extract only facts present in originalAd or userAnswers.',
  'Do not infer profession defaults such as shifts, benefits, contract, tools, technologies, or salary.',
  'Do not promote EXTRACTED facts to USER_CONFIRMED.',
] as const;

export const EXTRACT_PROMPT: Annunci10xPromptDefinition = {
  id: 'annunci10x.extract',
  version: 'annunci10x.extract.v1',
  operationType: 'EXTRACT',
  outputSchema: ANNUNCI10X_AI_OUTPUT_SCHEMAS.EXTRACT,
  instructions: renderPrompt('EXTRACT', 'Extract explicit role facts and possible conflicts.', invariants),
  invariants,
};
