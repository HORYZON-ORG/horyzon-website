import { ANNUNCI10X_AI_OUTPUT_SCHEMAS } from '../schemas.ts';
import { renderPrompt } from './helpers.ts';
import type { Annunci10xPromptDefinition } from './types.ts';

const invariants = [
  'Be adversarial toward GENERATE.',
  'Actively find what the generator added without authorization.',
  'Detect unsupported claims, contradictions, omitted critical facts, altered requirements, and candidate-facing editorial defects.',
  'Do not rewrite the full ad.',
  'The generated Master must read like a final candidate-facing job ad, not like an audit, rubric, source summary, or internal QA note.',
  'Flag source-document/meta language such as references to the ad, source text, page, score, rubric, validation, publication readiness, or facts "to clarify".',
  'Flag repetitive template scaffolding, duplicated facts, section proliferation, generic filler, and explanatory paragraphs that add no distinct supported fact.',
  'Flag invented chronology, frequency, causality, typical-day details, or inferred relationships not supported by RoleCard/RoleProfile.',
  'If unresolved or contradictory data appears in candidate-facing copy, do not accept the generator choosing a side or explaining the conflict publicly.',
  'Use claims with kind EDITORIAL for editorial defects; use CLAIM/FACT for factual issues. Editorial issues can require NEEDS_REVISION even when all facts are supported.',
  'Return BLOCK only when the defect cannot be safely repaired from confirmed RoleCard facts and user confirmation is genuinely required. If an unsupported embellishment, invented frequency, broadened duration, or contradictory phrasing can be safely deleted or restored to the exact confirmed fact, return NEEDS_REVISION, not BLOCK. PASS only when both factual safety and candidate-facing quality are acceptable.',
] as const;

export const VALIDATE_PROMPT: Annunci10xPromptDefinition = {
  id: 'annunci10x.validate',
  version: 'annunci10x.validate.v4',
  operationType: 'VALIDATE',
  outputSchema: ANNUNCI10X_AI_OUTPUT_SCHEMAS.VALIDATE,
  instructions: [
    renderPrompt('VALIDATE', 'Validate generated content against confirmed facts and candidate-facing editorial quality.', invariants),
    '',
    'Editorial checks:',
    '- No internal/source voice: the Master must not say things like "l annuncio indica", "il testo richiede", "la pagina riporta", "dato da chiarire", or "prima della pubblicazione".',
    '- No audit voice: do not expose scoring, verification, conflict resolution, missing-data analysis, or Annunci 10X process to candidates.',
    '- No template echo: repeated phrases such as "questo significa che", "una parte del lavoro", or "non si tratta solo" should be flagged when they make the ad feel formulaic rather than role-specific.',
    '- No redundant explanation: the same salary, schedule, activity, requirement, or result should not be restated in multiple sections without a distinct purpose.',
    '- TITLE is structural. An empty TITLE body is intentional and valid because the visible role title lives in the title field; do not flag the empty body as missing content.',
    '- No list-only fallback when confirmed facts support a clearer relationship between activities; conversely, do not invent a workflow merely to sound immersive.',
    '- Requirements must preserve their source classification. Generic soft skills should be linked to a supported work reason when the generator claims that relationship.',
    '- Conditions and concrete offer facts present in RoleCard must not be hidden by narrative prose. Confirmed shifts and on-call availability, including explicit negative values, are material candidate conditions and should be present.',
    '- Treat words such as regularly, ongoing, recurring, always, usually, every day, or similar frequency/duration expansions as unsupported when the RoleCard only confirms a bounded onboarding/training period.',
    '- Concision is not the goal by itself. Useful supported detail is positive; filler and source commentary are negative.',
    '',
    'When creating an EDITORIAL claim entry, keep claim concise, identify the affected section in sourcePaths when possible, and use REMOVE for text that should disappear or REQUEST_CONFIRMATION only when factual confirmation is genuinely required.',
  ].join('\n'),
  invariants,
};
