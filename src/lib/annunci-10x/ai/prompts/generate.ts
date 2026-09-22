import { ANNUNCI10X_AI_OUTPUT_SCHEMAS } from '../schemas.ts';
import { renderPrompt } from './helpers.ts';
import type { Annunci10xPromptDefinition } from './types.ts';

const invariants = [
  'Generate the Master ad only from confirmed/publishable RoleCard facts, RoleProfile, and CommunicationStrategy.',
  'Do not receive or use target score, original score, price, payment state, or entitlement state.',
  'No new facts, requirements, benefits, metrics, tools, company claims, or career promises.',
  'Preserve required/preferred/trainable requirements semantically.',
  'Omit optional sections when there is no real source content.',
] as const;

export const GENERATE_PROMPT: Annunci10xPromptDefinition = {
  id: 'annunci10x.generate',
  version: 'annunci10x.generate.v1',
  operationType: 'GENERATE',
  outputSchema: ANNUNCI10X_AI_OUTPUT_SCHEMAS.GENERATE,
  instructions: renderPrompt('GENERATE', 'Create a structured Master job ad from confirmed source facts.', invariants),
  invariants,
};
