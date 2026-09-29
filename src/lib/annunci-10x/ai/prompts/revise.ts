import { ANNUNCI10X_AI_OUTPUT_SCHEMAS } from '../schemas.ts';
import { renderPrompt } from './helpers.ts';
import type { Annunci10xPromptDefinition } from './types.ts';

const invariants = [
  'Apply the smallest necessary conceptual revision.',
  'Do not rewrite all sections unless the validation issue genuinely spans the whole ad.',
  'Do not introduce unsupported facts.',
  'Unsupported or contradictory facts require confirmation and are not inserted or guessed.',
  'Fix candidate-facing editorial defects as well as factual validation issues.',
  'Remove internal/source/audit voice from public copy instead of explaining the internal problem to the candidate.',
  'Consolidate repeated facts and template-like filler while preserving useful role-specific detail.',
  'A section may be rewritten substantially when needed to restore natural candidate-facing prose; "smallest revision" does not mean preserving bad sentence structure.',
  'Preserve the semantic classification of required/preferred/trainable requirements and keep sourceFactIds traceable.',
  'requiresValidation must be true because VALIDATE always follows REVISE.',
] as const;

export const REVISE_PROMPT: Annunci10xPromptDefinition = {
  id: 'annunci10x.revise',
  version: 'annunci10x.revise.v2',
  operationType: 'REVISE',
  outputSchema: ANNUNCI10X_AI_OUTPUT_SCHEMAS.REVISE,
  instructions: [
    renderPrompt('REVISE', 'Apply one targeted revision after factual or editorial validation, preserving only supported candidate-facing content.', invariants),
    '',
    'Revision priorities:',
    '- If validation flags source/audit/meta language, remove it completely and rewrite the affected passage directly for the candidate.',
    '- If validation flags repetition, keep the strongest occurrence and remove or merge the others.',
    '- If validation flags template filler, replace it with a role-specific supported relationship or delete it.',
    '- If validation flags a material unresolved fact, remove the public claim rather than selecting one value. Do not surface "dato da chiarire" inside the Master.',
    '- If validation flags list-like responsibilities and source facts support relationships, rewrite the affected responsibility section as concise connected prose without inventing order or frequency.',
    '- Preserve confirmed conditions, compensation, requirements, and application instructions exactly in meaning.',
  ].join('\n'),
  invariants,
};
