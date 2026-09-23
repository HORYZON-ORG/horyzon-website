import { ANNUNCI10X_RUBRIC } from '../../rubric.ts';
import { ANNUNCI10X_AI_OUTPUT_SCHEMAS } from '../schemas.ts';
import { renderPrompt } from './helpers.ts';
import type { Annunci10xPromptDefinition } from './types.ts';

const invariants = [
  `Return exactly ${ANNUNCI10X_RUBRIC.checks.length} checks, one for each rubric check id.`,
  'Do not calculate total score, finalScore, points, or publication status.',
  'MISSING and NOT_EVALUABLE are different: missing expected information is MISSING; not applicable/not determinable is NOT_EVALUABLE.',
  'Evidence and suggestions can inform deterministic TypeScript scoring but cannot replace it.',
  'Evaluate the requested target, not the surrounding context: ORIGINAL_AD uses originalAd.rawText, GENERATED_MASTER uses generatedAd/master sections, CHANNEL_VARIANT uses channelVariant sections.',
  'RoleCard, RoleProfile, CommunicationStrategy, declared role, declared company, and clarification answers are context only unless their facts are visibly present in the target text.',
  'Do not turn context into PASS evidence for the original ad. A missing original-ad fact remains MISSING or NOT_EVALUABLE even if context later contains that fact.',
  'For ORIGINAL_AD, cite evidence from the original ad text when assigning PASS or PARTIAL. If evidence only comes from context, do not assign PASS.',
  'Activities are not automatically observable outcomes; company name alone is not attractiveness evidence; a requirements list is not automatically a required/preferred/trainable split.',
  'If channel is absent, UNKNOWN, or generic CUSTOM and the target has no channel-specific constraints, channel checks should not be automatic PASS.',
  'Check 04 requires an observable result/effect/outcome in the target. A list of tasks or tools alone is MISSING for check 04.',
  'Check 10 requires explicit separation of indispensable, preferred, trainable, or disqualifying requirements. A single "Requisiti:" list is MISSING for check 10.',
  'Check 13 is PASS only with concrete schedule/cadence such as hours, days, shift windows, or precise time commitment. "part-time" plus generic "turni" is PARTIAL, not PASS.',
  'Check 15 is PASS only for concrete, verified reasons to choose the offer. Company name or a single generic support phrase is at most PARTIAL.',
  'Check 20 is PASS only when the application destination is usable: an email address, URL, form/platform, named contact, or equivalent precise destination. "via email con CV" without address is PARTIAL.',
  'For checks 16 and 17, UNKNOWN or CUSTOM channel without structured destination fields is NOT_EVALUABLE unless the target itself contains channel-specific structure.',
] as const;

export const EVALUATE_PROMPT: Annunci10xPromptDefinition = {
  id: 'annunci10x.evaluate',
  version: 'annunci10x.evaluate.v3',
  operationType: 'EVALUATE',
  outputSchema: ANNUNCI10X_AI_OUTPUT_SCHEMAS.EVALUATE,
  instructions: renderPrompt('EVALUATE', 'Prepare check statuses and evidence for deterministic scoring.', invariants),
  invariants,
};
