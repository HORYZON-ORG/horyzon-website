import type { AiOperationType } from '../../types.ts';
import { CHANNEL_ADAPTER_PROMPT } from './channel-adapter.ts';
import { CLARIFY_PROMPT } from './clarify.ts';
import { EDIT_CLASSIFIER_PROMPT } from './edit-classifier.ts';
import { EVALUATE_PROMPT } from './evaluate.ts';
import { EXTRACT_PROMPT } from './extract.ts';
import { GENERATE_PROMPT } from './generate.ts';
import { PRECHECK_PROMPT } from './precheck.ts';
import { PROFILE_PROMPT } from './profile.ts';
import { REVISE_PROMPT } from './revise.ts';
import { STRATEGY_PROMPT } from './strategy.ts';
import type { Annunci10xPromptDefinition } from './types.ts';
import { VALIDATE_PROMPT } from './validate.ts';

export const ANNUNCI10X_PROMPT_REGISTRY = {
  PRECHECK: PRECHECK_PROMPT,
  EXTRACT: EXTRACT_PROMPT,
  CLARIFY: CLARIFY_PROMPT,
  PROFILE: PROFILE_PROMPT,
  STRATEGY: STRATEGY_PROMPT,
  GENERATE: GENERATE_PROMPT,
  VALIDATE: VALIDATE_PROMPT,
  EVALUATE: EVALUATE_PROMPT,
  CHANNEL_ADAPTER: CHANNEL_ADAPTER_PROMPT,
  EDIT_CLASSIFIER: EDIT_CLASSIFIER_PROMPT,
  REVISE: REVISE_PROMPT,
} as const satisfies Record<AiOperationType, Annunci10xPromptDefinition>;

export function getAnnunci10xPrompt(operationType: AiOperationType): Annunci10xPromptDefinition {
  return ANNUNCI10X_PROMPT_REGISTRY[operationType];
}

export * from './core-policy.ts';
export * from './evaluate-v2.ts';
export type { Annunci10xPromptDefinition } from './types.ts';
