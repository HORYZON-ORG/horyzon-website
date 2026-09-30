import { ANNUNCI10X_AI_OUTPUT_SCHEMAS } from '../schemas.ts';
import { renderPrompt } from './helpers.ts';
import type { Annunci10xPromptDefinition } from './types.ts';

export const ANNUNCI10X_GENERATE_PROMPT_VERSION = 'annunci10x.generate.v7';

const invariants = [
  'Generate the Master ad only from confirmed/publishable RoleCard facts, RoleProfile, and CommunicationStrategy.',
  'Do not receive or use target score, original score, price, payment state, or entitlement state.',
  'The goal is not to make the ad sound more promotional. The goal is to help a candidate understand and imagine the real work.',
  'No new facts, requirements, benefits, metrics, tools, company claims, career promises, work rhythms, frequencies, people, or conditions.',
  'You may connect confirmed facts editorially, but never invent chronology, frequency, causality, or a typical day that the source does not support.',
  'Candidate-facing copy must never mention the source document or internal process: no references to the ad, source text, page, score, rubric, validation, Annunci 10X, publication readiness, or internal data conflicts.',
  'If a fact is unresolved, contradictory, uncertain, or not publishable, omit it from candidate-facing copy. Do not explain the uncertainty inside the Master and do not choose the most plausible value.',
  'Preserve required/preferred/trainable requirements semantically and keep unnecessary barriers out.',
  'Tie soft skills to the concrete activity, responsibility, interaction, or condition that makes them relevant when that link is supported.',
  'Represent routine, pressure, shifts, travel, physical effort, responsibility, and other demanding conditions faithfully when confirmed. Do not glamourize routine and do not hide difficulty.',
  'Use only concrete, supportable reasons to consider the offer. Do not add generic prestige, culture, growth, or employer-brand slogans.',
  'Every generated section must be traceable through sourceFactIds/sourcePaths to facts actually supplied in the input.',
  'Preserve confirmed compensation ranges, variable components, hybrid-work details, and application instructions exactly in meaning; do not shorten "30.000-36.000" to "30".',
  'Every paragraph must add a distinct supported fact or a distinct supported relationship between facts. Remove repetition before removing useful detail.',
  'Omit optional sections when there is no real source content. Prefer a shorter truthful ad over padded copy.',
  'TITLE is structural: put the job title in title and use an empty string for body. Never duplicate the title in body.',
  'Do not include both OPENING and MISSION when they communicate the same candidate-facing idea. Keep only the section that adds the clearest distinct supported value.',
  'A bounded onboarding/training fact stays bounded. For example, two weeks of shadowing must never become regular, ongoing, recurring, or permanent interaction.',
  'If confirmed shifts or on-call availability are present, including negative values such as no shifts/no on-call, state them explicitly in CONDITIONS because they are candidate compatibility facts.',
  'A confirmed mission/outcome must remain explicitly visible in candidate-facing copy. Do not delete it merely to reduce repetition; instead remove the redundant wording around it.',
  'When confirmed, operating context, autonomy, and unexpected events/variability are real-work facts. Surface them concretely without inventing cadence or chronology.',
] as const;

export const GENERATE_PROMPT: Annunci10xPromptDefinition = {
  id: 'annunci10x.generate',
  version: ANNUNCI10X_GENERATE_PROMPT_VERSION,
  operationType: 'GENERATE',
  outputSchema: ANNUNCI10X_AI_OUTPUT_SCHEMAS.GENERATE,
  instructions: renderGeneratePrompt(),
  invariants,
};

export function renderGeneratePrompt(): string {
  return [
    renderPrompt(
      'GENERATE',
      'Create a factual, descriptive Master job ad that helps a candidate understand the role and mentally picture the real work.',
      invariants,
    ),
    '',
    'Editorial construction:',
    '- TITLE: use a recognizable, search-friendly role title. Add specialization/location only when supported and useful. The TITLE section body must be an empty string; the title field is the visible title.',
    '- OPENING: use 2-3 natural, role-specific sentences. Establish the responsibility or work reality that matters most; do not manufacture a cinematic hook.',
    '- MISSION: explain what should work better because this role exists, but only when a supported mission/outcome exists. Never manufacture an outcome from a task list. If OPENING already communicates the same mission/outcome, omit MISSION instead of paraphrasing it.',
    '- RESPONSIBILITIES: build an operating picture from confirmed activities. Show relationships, handoffs, or phases only when supported. Prefer short narrative paragraphs; use bullets for compact comparable facts, not as the default storytelling device.',
    '- CONTEXT: when supported, explain who the person interacts with, what environment/tools matter, where handoffs happen, the level of autonomy, and the known unexpected events or operational variability.',
    '- REQUIREMENTS: separate indispensable, preferred, and trainable items according to source semantics. Explain why a requirement matters only when the source supports that connection.',
    '- CONDITIONS: make location, work mode, contract, schedule, shifts, travel, availability, and compensation easy to find. Do not bury compatibility filters.',
    '- OFFER/GROWTH: include only concrete and verifiable support, onboarding, benefits, stability, flexibility, equipment, training, compensation, or growth facts. Preserve stated training/onboarding duration exactly in meaning; do not turn a limited period into an ongoing relationship.',
    '- APPLICATION: make the next action exact and usable only when a verified destination/instruction exists.',
    '',
    'Candidate-facing voice:',
    '- Write as the final employer-facing job ad. Never say "l annuncio", "il testo", "la pagina", "il portale indica", "dato da chiarire", "prima della pubblicazione", or describe internal QA/scoring decisions.',
    '- Do not expose contradictions or missing-data analysis to the candidate. Leave unresolved facts out; downstream validation/gating handles them.',
    '- Speak directly to the candidate when useful, but do not start every paragraph with "ti occuperai" or "dovrai". Vary sentence structure naturally.',
    '- Avoid repeated template transitions such as "questo significa che", "non si tratta solo di", or "una parte del lavoro". Use them only when they add a specific factual relationship.',
    '- If a paragraph could fit an unrelated role after swapping only the job title, rewrite it to be more role-specific or delete it.',
    '',
    'Structure and density:',
    '- Do not force the same headings on every role. Choose the smallest set of sections that makes this role easy to understand, usually 4-8 candidate-facing sections.',
    '- Merge tiny adjacent sections when they explain the same decision. Avoid a heading followed by only one generic sentence.',
    '- Each section must answer a candidate question: what is this role, what will I actually do, what result matters, who/what do I interact with, what must I bring, what conditions will I accept, why consider it, how do I apply.',
    '- Useful detail is welcome. Repetition, source commentary, generic explanation, and filler are not.',
    '',
    'Descriptive-writing rules:',
    '- Help the reader understand what the work feels like operationally through relationships between confirmed facts, not through fictional storytelling.',
    '- Prefer concrete verbs and specific nouns. Explain how activities connect to responsibilities and outcomes.',
    '- Avoid empty adjectives such as dinamico, stimolante, leader, prestigioso, giovane, ambizioso, or opportunita di crescita unless the underlying claim is supported and useful.',
    '- Do not write giornata tipo, ogni giorno, prima/dopo, usually, often, or specific sequences unless cadence/sequence is actually supported.',
    '',
    'Length guidance:',
    '- Length follows source richness and candidate decision complexity, not seniority or prestige.',
    '- SHORT: aim for about 350-450 words when source depth supports it.',
    '- MEDIUM: aim for about 450-600 words when source depth supports it.',
    '- LONG: aim for about 600-750 words only when there are enough distinct confirmed facts to sustain the detail.',
    '- These are editorial targets, not quotas. If the confirmed facts do not support the range, write less rather than adding filler or inferred detail.',
    '',
    'The final fullText must read as a coherent Italian job ad for a candidate, never as a rubric, audit report, source commentary, or internal Horyzon document.',
  ].join('\n');
}
