import { ANNUNCI10X_RUBRIC_VERSION_V2 } from './constants.ts';
import { getScoreBandV2 } from './score-v2.ts';
import type { Annunci10xRuntimeContext, Annunci10xSessionCookie } from './product-flow.ts';
import { Annunci10xPublicError, createAnnunci10xRuntimeContext } from './product-flow.ts';
import { getAnnunci10xResultEligibility } from './lead-verification.ts';
import type {
  Annunci10xAnalysisRunStage,
  Annunci10xPersistedScoreResult,
  PersistedAnalysisRun,
  PersistedEvaluation,
} from './persistence/types.ts';

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
    label: 'Annuncio 10x';
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
  if (!eligibility.analysisReady) throw new Annunci10xPublicError('ANALYSIS_NOT_READY', 'Il risultato non è ancora pronto.', 409);
  if (!eligibility.emailVerified) throw new Annunci10xPublicError('EMAIL_VERIFICATION_REQUIRED', 'Verifica la tua email per visualizzare il risultato.', 403);
  if (!eligibility.resultEligible || !run.evaluationId) throw new Annunci10xPublicError('RESULT_NOT_AVAILABLE', 'Il risultato non è disponibile per questa analisi.', 409);

  const evaluation = await context.persistence.getEvaluationById(run.evaluationId, run.sessionId, input.session.sessionSecret);
  if (!evaluation) throw new Annunci10xPublicError('RESULT_NOT_AVAILABLE', 'Il risultato non è disponibile per questa analisi.', 409);

  const session = await context.persistence.getSession(input.session.sessionId, input.session.sessionSecret);
  if (!session || session.flow !== 'ANALYZE') throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione Annunci 10x non valida.', 401);
  if (['STARTED', 'ANALYSIS_READY', 'READY_FOR_PURCHASE'].includes(session.state)) {
    await context.persistence.updateSession({
      sessionId: input.session.sessionId,
      sessionSecret: input.session.sessionSecret,
      state: 'ENTITLED',
      currentSnapshotId: session.currentSnapshotId ?? undefined,
    });
    await context.persistence.appendEvent({
      sessionId: input.session.sessionId,
      eventName: 'free_generation_unlocked',
      metadata: { flow: 'ANALYZE', analysisRunId: run.id },
    });
  }

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
  const range = 'interval' in score && score.interval ? { min: score.interval.min, max: score.interval.max } : undefined;
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
      label: 'Annuncio 10x',
    },
  };
}

export function progressLabelForAnalysisStage(stage: Annunci10xAnalysisRunStage): string {
  if (stage === 'SOURCE_VALIDATION' || stage === 'PRECHECK' || stage === 'EXTRACT') return 'Stiamo leggendo il tuo annuncio';
  if (stage === 'PROFILE' || stage === 'STRATEGY') return 'Stiamo ricostruendo il ruolo';
  if (stage === 'EVALUATE' || stage === 'CLARIFY') return 'Stiamo verificando i criteri Annunci 10x';
  return 'Il risultato è pronto';
}

function resultVersionForScore(score: Annunci10xPersistedScoreResult): FreeResultVersion {
  return score.rubricVersion === ANNUNCI10X_RUBRIC_VERSION_V2 ? 'V2' : 'V1_COMPAT';
}

function interpretationForResult(
  resultVersion: FreeResultVersion,
  score: Annunci10xPersistedScoreResult,
  band: FreeAnnunci10xResult['band'],
): string {
  if (resultVersion === 'V2') {
    if (!band) return 'Non ci sono abbastanza elementi valutabili per assegnare una fascia.';
    if (band.code === 'CRITICAL') return "L'annuncio non rende ancora chiara la realtà del ruolo.";
    if (band.code === 'WEAK') return "L'annuncio contiene alcuni fatti utili, ma lascia incertezza materiale.";
    if (band.code === 'GOOD_BASE') return "L'annuncio è utilizzabile, con margini chiari di precisione.";
    if (band.code === 'STRONG') return "L'annuncio è chiaro, coerente e orientato alla decisione del candidato.";
    return "L'annuncio è molto completo e coerente rispetto ai criteri Annunci 10x.";
  }
  if ('interval' in score && score.interval) return 'Il risultato offre una prima lettura della chiarezza e completezza del tuo annuncio.';
  if (typeof score.value === 'number') return 'Il risultato offre una prima lettura della chiarezza e completezza del tuo annuncio.';
  return 'Non ci sono abbastanza elementi per esprimere un risultato completo.';
}
