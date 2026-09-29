import { ANNUNCI10X_AI_OUTPUT_SCHEMAS } from '../schemas.ts';
import { renderPrompt } from './helpers.ts';
import type { Annunci10xPromptDefinition } from './types.ts';

export const ANNUNCI10X_GENERATE_PROMPT_VERSION = 'annunci10x.generate.v2';

const invariants = [
  'Generate the Master ad only from confirmed/publishable RoleCard facts, RoleProfile, and CommunicationStrategy.',
  'Do not receive or use target score, original score, price, payment state, or entitlement state.',
  'The goal is not to make the ad sound more promotional. The goal is to help a candidate understand and imagine the real work.',
  'No new facts, requirements, benefits, metrics, tools, company claims, career promises, work rhythms, frequencies, people, or conditions.',
  'You may connect confirmed facts editorially, but never invent chronology, frequency, causality, or a typical day that the source does not support.',
  'Preserve required/preferred/trainable requirements semantically and keep unnecessary barriers out.',
  'Tie soft skills to the concrete activity, responsibility, interaction, or condition that makes them relevant when that link is supported.',
  'Represent routine, pressure, shifts, travel, physical effort, responsibility, and other demanding conditions faithfully when confirmed. Do not glamourize routine and do not hide difficulty.',
  'Use only concrete, supportable reasons to consider the offer. Do not add generic prestige, culture, growth, or employer-brand slogans.',
  'Do not resolve contradictory or uncertain material facts by choosing the most plausible value. Never turn UNKNOWN into a publishable claim.',
  'Every generated section must be traceable through sourceFactIds/sourcePaths to facts actually supplied in the input.',
  'Omit optional sections when there is no real source content. Prefer a shorter truthful ad over padded copy.',
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
    '- TITLE: use a recognizable, search-friendly role title. Add specialization/location only when supported and useful.',
    '- OPENING: use 2-4 natural sentences to establish role identity, purpose, and the most decision-relevant reality. No employer-brand slogans.',
    '- MISSION: explain what should work better because this role exists, but only when a supported mission/outcome exists. Never manufacture an outcome from a task list.',
    '- RESPONSIBILITIES: do not dump bullets. Group related activities into a readable work flow or operating picture. Use short narrative paragraphs first, then bullets only when they improve scanning.',
    '- CONTEXT: when supported, explain who the person interacts with, where handoffs happen, what environment/tools matter, and the level of autonomy.',
    '- REQUIREMENTS: separate indispensable, preferred, and trainable items according to source semantics. Explain why a requirement matters when the source supports that connection.',
    '- CONDITIONS: make location, work mode, contract, schedule, shifts, travel, availability, and compensation easy to find. Do not bury compatibility filters.',
    '- OFFER/GROWTH: include only concrete and verifiable support, onboarding, benefits, stability, flexibility, equipment, training, compensation, or growth facts.',
    '- APPLICATION: make the next action exact and usable only when a verified destination/instruction exists.',
    '',
    'Descriptive-writing rules:',
    '- Help the reader understand what the work feels like operationally through relationships between confirmed facts, not through fictional storytelling.',
    '- Prefer concrete verbs and specific nouns. Explain how activities connect to responsibilities and outcomes.',
    '- Avoid empty adjectives such as dinamico, stimolante, leader, prestigioso, giovane, ambizioso, or opportunita di crescita unless the underlying claim is supported and useful.',
    '- Do not write giornata tipo, ogni giorno, prima/dopo, usually, often, or specific sequences unless cadence/sequence is actually supported.',
    '- Do not repeat the same fact across multiple sections just to increase length.',
    '',
    'Length guidance:',
    '- SHORT: aim for about 350-450 words when source depth supports it.',
    '- MEDIUM: aim for about 450-600 words when source depth supports it.',
    '- LONG: aim for about 600-750 words when source depth supports it.',
    '- These are editorial targets, not quotas. If the confirmed facts do not support the range, write less rather than adding filler or inferred detail.',
    '',
    'The final fullText must read as a coherent Italian job ad for a candidate, not as a rubric, audit report, or internal Horyzon document.',
  ].join('\n');
}
