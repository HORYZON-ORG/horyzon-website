import { ANNUNCI10X_AI_OUTPUT_SCHEMAS } from '../schemas.ts';
import { renderPrompt } from './helpers.ts';
import type { Annunci10xPromptDefinition } from './types.ts';

const invariants = [
  'Profile the role without judging the role or candidate quality.',
  'Do not infer popularity or demand from job title alone.',
  'UNKNOWN remains UNKNOWN when evidence is insufficient.',
  'Qualification and demand are separate dimensions.',
  'MIXED routine/challenge is valid.',
] as const;

export const PROFILE_PROMPT: Annunci10xPromptDefinition = {
  id: 'annunci10x.profile',
  version: 'annunci10x.profile.v1',
  operationType: 'PROFILE',
  outputSchema: ANNUNCI10X_AI_OUTPUT_SCHEMAS.PROFILE,
  instructions: renderPrompt('PROFILE', 'Produce role profiling signals from the RoleCard.', invariants),
  invariants,
};
