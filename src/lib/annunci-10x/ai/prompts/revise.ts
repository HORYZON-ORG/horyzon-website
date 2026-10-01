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
  'When an EDITORIAL validation claim uses action REMOVE for duplicated OPENING/MISSION content, actually delete one duplicated section: include its id in changedSectionIds and omit that id from revisedSections. Do not merely paraphrase both sections.',
  'TITLE is structural: its body should be an empty string. If validation flags a duplicated TITLE body, return the TITLE section with body empty.',
  'If validation flags an invented frequency or broadened duration, remove the invented cadence and restore only the bounded confirmed fact. Example: two-week onboarding stays two-week onboarding; never rewrite it as regular or ongoing interaction.',
  'Do not omit confirmed shifts or on-call availability while revising CONDITIONS, including explicit negative values such as no shifts and no on-call.',
  'Never solve repetition by deleting the only explicit confirmed mission/outcome. Keep one clear outcome statement and remove the redundant surrounding section/text instead.',
  'Preserve confirmed company context, operating context, autonomy, and unexpected events/variability when revising candidate-facing work-reality sections.',
  'Do not assume that retaining a sourceFactId preserves a fact: its meaning must remain visible in title/body copy after the revision.',
  'When Fact.notes records a resolved canonical conflict, preserve only the canonical value and remove any discarded alternative from revised candidate-facing copy.',
] as const;

export const REVISE_PROMPT: Annunci10xPromptDefinition = {
  id: 'annunci10x.revise',
  version: 'annunci10x.revise.v7',
  operationType: 'REVISE',
  outputSchema: ANNUNCI10X_AI_OUTPUT_SCHEMAS.REVISE,
  instructions: [
    renderPrompt('REVISE', 'Apply one targeted revision after factual or editorial validation, preserving only supported candidate-facing content.', invariants),
    '',
    'Revision priorities:',
    '- If validation flags source/audit/meta language, remove it completely and rewrite the affected passage directly for the candidate.',
    '- If validation flags repetition, keep the strongest occurrence and remove or merge the others. For OPENING/MISSION duplication, deletion is preferred over two paraphrases.',
    '- If validation flags template filler, replace it with a role-specific supported relationship or delete it.',
    '- If validation flags a material unresolved fact, remove the public claim rather than selecting one value. Do not surface "dato da chiarire" inside the Master.',
    '- If validation flags list-like responsibilities and source facts support relationships, rewrite the affected responsibility section as concise connected prose without inventing order or frequency.',
    '- Preserve confirmed conditions, compensation, requirements, and application instructions exactly in meaning.',
  ].join('\n'),
  invariants,
};
