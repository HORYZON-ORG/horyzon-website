import { ANNUNCI10X_RUBRIC_VERSION_V2 } from './constants.ts';
import { getScoreBandV2 } from './score-v2.ts';
import type { Annunci10xRuntimeContext, Annunci10xSessionCookie } from './product-flow.ts';
import { Annunci10xPublicError, createAnnunci10xRuntimeContext } from './product-flow.ts';
import { getAnnunci10xResultEligibility } from './lead-verification.ts';
import type {
  Annunci10xAnalysisRunStage,
  PersistedAnalysisRun,
  PersistedEvaluation,
} from './persistence/types.ts';
import type { ScoreResult } from './types.ts';

export type FreeResultVersion = 'V1_COMPAT' | 'V2';

export interface FreeAnnunci10xResult {
  analysisRunId: string;
  resultVersion: FreeResultVersion;
  score: {
    value: number | null;
    max: 100;
    range?: { min: number; max: number };
    coverage: number;
  };
  band: { code: string; label: string } | null;
  interpretation: string;
  nextAction: {
    type: 'REWRITE_EXISTING_AD';
    label: 'Migliora questo annuncio';
  };
}

export async function getGatedAnnunci10xFreeResult(input: {
  session: Annunci10xSessionCookie;
  analysisRunId: string;
  context?: Annunci10xRuntimeContext;
}): Promise<FreeAnnunci10xResult> {
  const context = input.context ?? createAnnunci10xRuntimeContext();
  const run = await context.persistence.getAnalysisRun(input.analysisRunId, input.session.sessionSecret);
  if (!run) throw new Annunci10xPublicError('NOT_FOUND', 'Analisi non trovata.', 404);

  const eligibility = await getAnnunci10xResultEligibility({ session: input.session, analysisRunId: run.id, context });
  if (!eligibility.analysisReady) throw new Annunci10xPublicError('ANALYSIS_NOT_READY', 'Il risultato non e ancora pronto.', 409);
  if (!eligibility.emailVerified) throw new Annunci10xPublicError('EMAIL_VERIFICATION_REQUIRED', 'Verifica la tua email per visualizzare il risultato.', 403);
  if (!eligibility.resultEligible || !run.evaluationId) throw new Annunci10xPublicError('RESULT_NOT_AVAILABLE', 'Il risultato non e disponibile per questa analisi.', 409);

  const evaluation = await context.persistence.getEvaluationById(run.evaluationId, run.sessionId, input.session.sessionSecret);
  if (!evaluation) throw new Annunci10xPublicError('RESULT_NOT_AVAILABLE', 'Il risultato non e disponibile per questa analisi.', 409);

  await context.persistence.appendEvent({
    sessionId: input.session.sessionId,
    eventName: 'result_revealed',
    metadata: { resultVersion: resultVersionForScore(evaluation.score) },
  });

  return buildFreeAnnunci10xResult({ analysisRun: run, evaluation });
}

export function buildFreeAnnunci10xResult(input: {
  analysisRun: Pick<PersistedAnalysisRun, 'id'>;
  evaluation: Pick<PersistedEvaluation, 'score'>;
}): FreeAnnunci10xResult {
  const score = input.evaluation.score;
  const resultVersion = resultVersionForScore(score);
  const range = score.interval ? { min: score.interval.min, max: score.interval.max } : undefined;
  const v2Band = resultVersion === 'V2' ? getScoreBandV2(score.value) : null;
  const band = v2Band ? { code: v2Band.code, label: v2Band.label } : null;

  return {
    analysisRunId: input.analysisRun.id,
    resultVersion,
    score: {
      value: typeof score.value === 'number' ? score.value : null,
      max: 100,
      ...(range ? { range } : {}),
      coverage: score.coverage,
    },
    band,
    interpretation: interpretationForResult(resultVersion, score, band),
    nextAction: {
      type: 'REWRITE_EXISTING_AD',
      label: 'Migliora questo annuncio',
    },
  };
}

export function progressLabelForAnalysisStage(stage: Annunci10xAnalysisRunStage): string {
  if (stage === 'SOURCE_VALIDATION' || stage === 'PRECHECK' || stage === 'EXTRACT') return 'Stiamo leggendo il tuo annuncio';
  if (stage === 'PROFILE' || stage === 'STRATEGY') return 'Stiamo ricostruendo il ruolo';
  if (stage === 'EVALUATE' || stage === 'CLARIFY') return 'Stiamo verificando i criteri Annunci 10x';
  return 'Il risultato e pronto';
}

function resultVersionForScore(score: ScoreResult): FreeResultVersion {
  return score.rubricVersion === ANNUNCI10X_RUBRIC_VERSION_V2 ? 'V2' : 'V1_COMPAT';
}

function interpretationForResult(
  resultVersion: FreeResultVersion,
  score: ScoreResult,
  band: FreeAnnunci10xResult['band'],
): string {
  if (resultVersion === 'V2') {
    if (!band) return 'Non ci sono abbastanza elementi valutabili per assegnare una fascia.';
    if (band.code === 'CRITICAL') return "L'annuncio non rende ancora chiara la realta del ruolo.";
    if (band.code === 'WEAK') return "L'annuncio contiene alcuni fatti utili, ma lascia incertezza materiale.";
    if (band.code === 'GOOD_BASE') return "L'annuncio e utilizzabile, con margini chiari di precisione.";
    if (band.code === 'STRONG') return "L'annuncio e chiaro, coerente e orientato alla decisione del candidato.";
    return "L'annuncio e molto completo e coerente rispetto ai criteri Annunci 10x.";
  }
  if (score.interval) return 'Risultato calcolato con semantica V1: il range viene preservato senza applicare fasce V2.';
  if (typeof score.value === 'number') return 'Risultato calcolato con semantica V1. La valutazione completa resta protetta dal gate email.';
  return 'Risultato V1 non esprimibile con un punteggio singolo.';
}
