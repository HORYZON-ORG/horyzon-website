import { ANNUNCI10X_AI_OUTPUT_SCHEMAS } from '../schemas.ts';
import { renderPrompt } from './helpers.ts';
import type { Annunci10xPromptDefinition } from './types.ts';

const invariants = [
  'Respect deterministic strategyRules supplied in input.',
  'Choose structure, opening, levers, length, rationale, and publicSummary.',
  'publicSummary is user-facing before payment in CREATE flow.',
  'Do not write the ad and do not invent company attractiveness.',
  'Do not set a numeric score target.',
  'Choose editorialLength from the richness of confirmed facts and candidate decision complexity, not from seniority, prestige, or a desire to sound premium.',
  'Never choose LONG to compensate for missing facts. Missing evidence must stay missing.',
  'Choose a structure that fits the role reality rather than reusing one fixed template across roles.',
  'Levers must be concrete and supportable from RoleCard/RoleProfile; generic employer-brand language is not a lever.',
] as const;

export const STRATEGY_PROMPT: Annunci10xPromptDefinition = {
  id: 'annunci10x.strategy',
  version: 'annunci10x.strategy.v2',
  operationType: 'STRATEGY',
  outputSchema: ANNUNCI10X_AI_OUTPUT_SCHEMAS.STRATEGY,
  instructions: [
    renderPrompt('STRATEGY', 'Convert role profile and deterministic strategy constraints into a CommunicationStrategy.', invariants),
    '',
    'Structure selection guidance:',
    '- WORKFLOW_FIRST: operational/process roles where understanding the relationship between activities is decisive.',
    '- OUTCOME_FIRST: roles where ownership, result, or business/service effect is the clearest organizing principle.',
    '- CONDITIONS_FIRST: roles where shifts, travel, physical demands, location, or availability are major fit filters.',
    '- RELATIONSHIP_FIRST: service, coordination, account, or commercial roles where interactions and handoffs define the work.',
    '- TECHNICAL_REALITY_FIRST: specialist roles where tools, systems, tolerances, methods, or technical responsibility are central.',
    '- Use another concise structure name when none of these fits. The label is internal; the generated ad must remain natural.',
    '',
    'Length selection guidance:',
    '- SHORT when facts are limited or the work is simple enough to explain without repetition.',
    '- MEDIUM when there are multiple distinct activities, requirements, conditions, or interactions that materially help self-selection.',
    '- LONG only when verified source depth genuinely supports a richer operating picture and multiple candidate decisions.',
    '',
    'Opening strategy:',
    '- Point to the most concrete supported responsibility, workflow, result, or compatibility factor.',
    '- Do not plan a generic emotional hook, employer slogan, or invented day-in-the-life scene.',
  ].join('\n'),
  invariants,
};
