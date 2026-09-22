import { ANNUNCI10X_AI_OUTPUT_SCHEMAS } from '../schemas.ts';
import { renderPrompt } from './helpers.ts';
import type { Annunci10xPromptDefinition } from './types.ts';

const invariants = [
  'Respect deterministic strategyRules supplied in input.',
  'Choose structure, opening, levers, length, rationale, and publicSummary.',
  'publicSummary is user-facing before payment in CREATE flow.',
  'Do not write the ad and do not invent company attractiveness.',
  'Do not set a numeric score target.',
] as const;

export const STRATEGY_PROMPT: Annunci10xPromptDefinition = {
  id: 'annunci10x.strategy',
  version: 'annunci10x.strategy.v1',
  operationType: 'STRATEGY',
  outputSchema: ANNUNCI10X_AI_OUTPUT_SCHEMAS.STRATEGY,
  instructions: renderPrompt('STRATEGY', 'Convert role profile and deterministic strategy constraints into a CommunicationStrategy.', invariants),
  invariants,
};
