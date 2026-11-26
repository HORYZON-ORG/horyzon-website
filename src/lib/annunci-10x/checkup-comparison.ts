import { createHash } from 'node:crypto';
import { Annunci10xAiOrchestrator } from './ai/orchestrator.ts';
import { EVALUATE_PROMPT_V2 } from './ai/prompts/evaluate-v2.ts';
import { ANNUNCI10X_EVALUATE_OUTPUT_SCHEMA_V2, validateEvaluateOutputV2, type Annunci10xEvaluateOutputV2 } from './ai/schemas-v2.ts';
import type { Annunci10xJsonSchema } from './ai/schemas.ts';
import { checkupEvaluationInput, normalizeCheckupEvaluation } from './checkup-evaluation.ts';
import { calculateAnnunci10xScoreV2 } from './score-v2.ts';
import type { Annunci10xRuntimeContext } from './product-flow.ts';
import type { CheckupStrategy } from './checkup-writer.ts';

export const CHECKUP_COMPARISON_VERSION = 'checkup-blind-pair-v1';
const schema = { type: 'object', additionalProperties: false, required: ['a','b'], properties: { a: ANNUNCI10X_EVALUATE_OUTPUT_SCHEMA_V2, b: ANNUNCI10X_EVALUATE_OUTPUT_SCHEMA_V2 } } as Annunci10xJsonSchema;
export function validateCheckupPair(value: unknown): { a: Annunci10xEvaluateOutputV2; b: Annunci10xEvaluateOutputV2 } {
  const v = value as { a: unknown; b: unknown };
  return { a: validateEvaluateOutputV2(v?.a), b: validateEvaluateOutputV2(v?.b) };
}
const prompt = [
  EVALUATE_PROMPT_V2.instructions,
  'OVERRIDE DEL CONTRATTO: valuta i due TARGET anonimi checkupComparison.a e .b. Il JSON contiene a:{checks} e b:{checks}, 20 controlli ciascuno, con la STESSA rubrica e le STESSE ancore. Non sai quale sia stato scritto prima. Non preferire A o B per la posizione.',
  'Confronta criterio per criterio PRIMA di attribuire i voti. Parità di contenuto e di usabilità sul criterio implica parità di voto; ogni differenza richiede una differenza concreta nel testo o nella comprensibilità. Non inventare un incremento minimo e non arrotondare per rendere positivo il confronto.',
  'La completezza fattuale è provata separatamente: i fatti sono conservati e le lacune restano lacune. Può cambiare quanto facilmente il candidato trova e collega lavoro, risultato, requisiti e offerta. Non assegnare punti per sezioni o lunghezza da sole. Un’apertura che esplicita correttamente un contributo prima solo inferibile è evidenza comunicativa valutabile, non un nuovo KPI.',
  'Le intestazioni originali e i qualificatori hanno autorità. Esperienza produttiva richiesta con 5 anni preferiti NON è contraddizione; una durata preferita può convivere con 3 anni obbligatori in manutenzione. Lombardia obbligatoria con Milano preferita è coerente. Non pretendere l’etichetta obbligatorio su ogni riga già sotto Requisiti. Non pretendere classi assenti o una sezione formato/KPI su ogni lavoro.',
  'Se è presente una vera ambiguità originale, preservala e attribuiscila ad AMBEDUE: non inventare una soluzione. Una promessa condizionata resta condizionata. Sede o tempo pieno non dimostrano una modalità di lavoro.',
  'Applicabilità di 16,17,20 e fatti ignoti è condivisa. Per la popolarità UNKNOWN non attribuire una categoria certa. Non penalizzare una ricompensa reale come se fosse prova di candidati improduttivi. Tutte le evidenze e motivazioni devono riferirsi al rispettivo testo, brevi e specifiche.',
].join('\n');

export async function evaluateCheckupPair(input: {
  context: Annunci10xRuntimeContext; sessionId: string; sessionSecret: string; snapshotId: string;
  analysisRunId: string; originalText: string; revisedText: string; strategy: CheckupStrategy | null;
}) {
  const reversed = parseInt(createHash('sha256').update(input.analysisRunId).digest('hex').slice(0,2),16) % 2 === 1;
  const target = (text: string) => checkupEvaluationInput({ target: { kind: 'ORIGINAL_AD', text }, context: {} }, input.originalText);
  const a = target(reversed ? input.revisedText : input.originalText), b = target(reversed ? input.originalText : input.revisedText);
  const result = await new Annunci10xAiOrchestrator(input.context).runTask({
    sessionId: input.sessionId, sessionSecret: input.sessionSecret, operationType: 'EVALUATE', inputSnapshotId: input.snapshotId,
    idempotencyInputIdentityOverride: createHash('sha256').update(input.analysisRunId + input.originalText + input.revisedText + CHECKUP_COMPARISON_VERSION).digest('hex'),
    promptVersionOverride: CHECKUP_COMPARISON_VERSION, systemPromptOverride: prompt, outputSchemaOverride: schema,
    outputSchemaNameOverride: 'annunci10x_checkup_comparison', validateOutputOverride: validateCheckupPair,
    timeoutMs: 180000, schemaRepairRetry: true,
    input: { checkupComparison: { a, b, strategy: input.strategy } },
  });
  const scoreA = calculateAnnunci10xScoreV2(normalizeCheckupEvaluation(a,result.output.a).checks);
  const scoreB = calculateAnnunci10xScoreV2(normalizeCheckupEvaluation(b,result.output.b).checks);
  return { originalScore: reversed ? scoreB : scoreA, revisedScore: reversed ? scoreA : scoreB, version: CHECKUP_COMPARISON_VERSION, originalLabel: reversed ? 'b' : 'a' };
}
