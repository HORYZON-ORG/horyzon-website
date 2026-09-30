import { ANNUNCI10X_AI_OUTPUT_SCHEMAS } from '../schemas.ts';
import { renderPrompt } from './helpers.ts';
import type { Annunci10xPromptDefinition } from './types.ts';

const invariants = [
  'Master is the source of truth.',
  'You may shorten, reorder, change opening, adapt hierarchy, or adapt CTA.',
  'Do not change facts, compensation, location, contract, requirements, benefits, or nature of work.',
  'Do not drop a confirmed usable application destination; preserve CTA meaning when adapting.',
  'introducedFactIds must remain empty.',
  'TITLE is structural: preserve the role title in title and set the TITLE section body to an empty string. Do not duplicate the title in body.',
  'Preserve confirmed shifts and on-call availability explicitly, including negative values such as no shifts and no on-call.',
] as const;

export const CHANNEL_ADAPTER_PROMPT: Annunci10xPromptDefinition = {
  id: 'annunci10x.channel_adapter',
  version: 'annunci10x.channel_adapter.v4',
  operationType: 'CHANNEL_ADAPTER',
  outputSchema: ANNUNCI10X_AI_OUTPUT_SCHEMAS.CHANNEL_ADAPTER,
  instructions: renderPrompt('CHANNEL_ADAPTER', 'Adapt a Master ad to a target channel without introducing facts.', invariants),
  invariants,
};
