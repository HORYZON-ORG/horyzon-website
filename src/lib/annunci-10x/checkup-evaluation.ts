import type { Annunci10xEvaluateInputV2 } from './ai/evaluate-v2.ts';
import type { Annunci10xEvaluateOutputV2 } from './ai/schemas-v2.ts';
import { hasCheckupPlaceholderDestination } from './checkup-source.ts';

export function checkupEvaluationInput(input: Annunci10xEvaluateInputV2, originalText: string): Annunci10xEvaluateInputV2 {
  const applicationExpected = /\b(?:candidatur[ae]|candidati|candidarsi|invia(?:re|ci|te)?)\b|https?:\/\/|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(originalText);
  return {
    target: { ...input.target, channel: input.target.channel === 'CUSTOM' ? null : input.target.channel,
      structuredFields: null,
      applicationDestination: input.target.text.match(/https?:\/\/[^\s<>]+|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] ?? null },
    context: { ...input.context, checkupProtocol: { version: 'checkup-evidence-v1', applicationExpected } },
  };
}

/** Target-bundle availability must not change merely because the same ad was rewritten. */
export function normalizeCheckupEvaluation(input: Annunci10xEvaluateInputV2, output: Annunci10xEvaluateOutputV2): Annunci10xEvaluateOutputV2 {
  const protocol = input.context?.checkupProtocol;
  if (!protocol || protocol.version !== 'checkup-evidence-v1') return output;
  return { ...output, checks: output.checks.map(c => {
    if (c.id === '16' && !input.target.channelPolicy) return { ...c, score: null, status: 'NOT_EVALUABLE' as const,
      reason: 'Nessuna policy del canale fornita: questo controllo resta N/D per entrambi i testi.', evidence: [], missing: [] };
    if (c.id === '17' && !input.target.structuredFields) return { ...c, score: null, status: 'NOT_EVALUABLE' as const,
      reason: 'Sono disponibili testi, senza campi del portale verificabili separatamente.', evidence: [], missing: [] };
    if (c.id === '20' && hasCheckupPlaceholderDestination(input.target.text)) return { ...c, score: 2, status: 'EVALUATED' as const,
      reason: 'Le istruzioni contengono un recapito segnaposto, non utilizzabile per candidarsi.', evidence: ['Recapito segnaposto'], missing: ['Recapito reale di candidatura'] };
    if (c.id === '20' && !protocol.applicationExpected) return { ...c, score: null, status: 'NOT_EVALUABLE' as const,
      reason: 'Il canale di candidatura esterno al testo non è stato fornito: non viene attribuito un difetto al portale.', evidence: [], missing: [] };
    return c;
  }) };
}
