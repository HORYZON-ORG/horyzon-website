import {
  createAnnunci10xEmailProvider,
  type Annunci10xEmailProvider,
  type ScoreReportEmailAreaInput,
  type ScoreReportEmailPriorityInput,
} from './lead-verification.ts';
import type { Annunci10xRuntimeContext, Annunci10xSessionCookie } from './product-flow.ts';
import { getRubricCheckDefinitionV2 } from './rubric-v2.ts';
import { isScoreResultV2 } from './score-v2.ts';
import type { CheckIdV2, EvaluationCheckV2, ScoreBandCodeV2, ScoreResultV2 } from './types-v2.ts';
import type { PersistedAnalysisRun, PersistedEvaluation, PersistedLead, PersistedSnapshot } from './persistence/types.ts';

export const ANNUNCI10X_SCORE_REPORT_EMAIL_LEASE_SECONDS = 120;

export type Annunci10xScoreReportEmailStatus =
  | 'DISABLED'
  | 'NOT_ELIGIBLE'
  | 'UNSUPPORTED_RESULT_VERSION'
  | 'ALREADY_SENT_OR_IN_FLIGHT_OR_EXHAUSTED'
  | 'SENT'
  | 'FAILED';

export interface Annunci10xScoreReport {
  roleTitle: string;
  score: number | null;
  band: string | null;
  coverage: number;
  evaluableCheckCount: number;
  areaScores: ScoreReportEmailAreaInput[];
  interpretation: string;
  priorities: ScoreReportEmailPriorityInput[];
}

export const ANNUNCI10X_SCORE_REPORT_AREA_DEFINITIONS: readonly {
  id: string;
  label: string;
  checkIds: readonly CheckIdV2[];
}[] = [
  { id: 'ROLE_IDENTITY', label: 'Identita del ruolo', checkIds: ['01', '02'] },
  { id: 'REAL_WORK', label: 'Lavoro reale e risultati', checkIds: ['03', '04', '05'] },
  { id: 'ROLE_COHERENCE', label: 'Coerenza con il ruolo', checkIds: ['06', '07', '08', '09'] },
  { id: 'REQUIREMENTS', label: 'Requisiti', checkIds: ['10', '11'] },
  { id: 'OFFER_CONDITIONS', label: 'Offerta e condizioni', checkIds: ['12', '13', '14', '15'] },
  { id: 'COMMUNICATION_APPLICATION', label: 'Comunicazione e candidatura', checkIds: ['16', '17', '18', '19', '20'] },
];

export interface MaybeSendAnnunci10xScoreReportResult {
  status: Annunci10xScoreReportEmailStatus;
  deliveryId?: string;
  attemptCount?: number;
}

const STATUS_SEVERITY: Record<EvaluationCheckV2['status'], number> = {
  MISSING: 0,
  CONFLICT: 1,
  UNSUPPORTED: 2,
  EVALUATED: 3,
  NOT_EVALUABLE: 4,
};

export function isAnnunci10xScoreReportEmailEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const value = env.ANNUNCI10X_SCORE_REPORT_EMAIL_ENABLED?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

export async function maybeSendAnnunci10xScoreReport(input: {
  session: Annunci10xSessionCookie;
  analysisRunId: string;
  context: Annunci10xRuntimeContext;
  provider?: Annunci10xEmailProvider;
  env?: Record<string, string | undefined>;
}): Promise<MaybeSendAnnunci10xScoreReportResult> {
  const env = input.env ?? process.env;
  if (!isAnnunci10xScoreReportEmailEnabled(env)) return { status: 'DISABLED' };

  const run = await input.context.persistence.getAnalysisRun(input.analysisRunId, input.session.sessionSecret);
  if (!isEligibleRun(run)) return { status: 'NOT_ELIGIBLE' };

  const lead = await input.context.persistence.getLead(input.session.sessionId, input.session.sessionSecret);
  if (!lead?.emailVerifiedAt) return { status: 'NOT_ELIGIBLE' };

  const evaluation = await input.context.persistence.getEvaluationById(run.evaluationId, run.sessionId, input.session.sessionSecret);
  if (!evaluation) return { status: 'NOT_ELIGIBLE' };
  if (!isScoreResultV2(evaluation.score)) return { status: 'UNSUPPORTED_RESULT_VERSION' };
  const v2Evaluation = { ...evaluation, score: evaluation.score };

  const snapshot = await input.context.persistence.getLatestSnapshot(input.session.sessionId, input.session.sessionSecret);
  const report = buildAnnunci10xScoreReport({ lead, analysisRun: run, evaluation: v2Evaluation, snapshot });
  const delivery = await input.context.persistence.claimEmailDelivery({
    sessionId: input.session.sessionId,
    sessionSecret: input.session.sessionSecret,
    analysisRunId: run.id,
    kind: 'SCORE_REPORT',
    recipient: lead.emailNormalized,
    leaseSeconds: ANNUNCI10X_SCORE_REPORT_EMAIL_LEASE_SECONDS,
  });
  if (!delivery) return { status: 'ALREADY_SENT_OR_IN_FLIGHT_OR_EXHAUSTED' };

  try {
    const provider = input.provider ?? createAnnunci10xEmailProvider(env);
    const sent = await provider.sendScoreReport({
      deliveryId: delivery.id,
      recipient: delivery.recipientNormalized,
      firstName: lead.firstName,
      ...report,
    });
    const marked = await input.context.persistence.markEmailDeliverySent({
      deliveryId: delivery.id,
      sessionSecret: input.session.sessionSecret,
      provider: provider.kind,
      providerRequestId: sent.providerRequestId ?? null,
    });
    await input.context.persistence.appendEvent({
      sessionId: input.session.sessionId,
      eventName: 'score_report_email_sent',
      metadata: { kind: 'SCORE_REPORT', attemptCount: marked.attemptCount, resultVersion: 'V2' },
    });
    return { status: 'SENT', deliveryId: delivery.id, attemptCount: marked.attemptCount };
  } catch {
    let attemptCount = delivery.attemptCount;
    try {
      const marked = await input.context.persistence.markEmailDeliveryFailed({
        deliveryId: delivery.id,
        sessionSecret: input.session.sessionSecret,
        errorCode: 'EMAIL_PROVIDER_UNAVAILABLE',
      });
      attemptCount = marked.attemptCount;
    } catch {
      // Keep the customer-facing flow healthy; the delivery attempt itself already failed.
    }
    await input.context.persistence.appendEvent({
      sessionId: input.session.sessionId,
      eventName: 'score_report_email_failed',
      metadata: { kind: 'SCORE_REPORT', attemptCount, resultVersion: 'V2' },
    });
    return { status: 'FAILED', deliveryId: delivery.id, attemptCount };
  }
}

export function buildAnnunci10xScoreReport(input: {
  lead: PersistedLead;
  analysisRun: PersistedAnalysisRun;
  evaluation: PersistedEvaluation & { score: ScoreResultV2 };
  snapshot?: PersistedSnapshot | null;
}): Annunci10xScoreReport {
  void input.lead;
  void input.analysisRun;
  const score = input.evaluation.score;
  return {
    roleTitle: cleanReportText(input.snapshot?.roleCard.title?.value, 140) || 'Il tuo annuncio',
    score: score.value,
    band: score.band?.label ?? null,
    coverage: score.coverage,
    evaluableCheckCount: score.evaluableCheckCount,
    areaScores: calculateAnnunci10xScoreReportAreas(score.checks),
    interpretation: interpretAnnunci10xScoreBand(score.band?.code ?? null),
    priorities: selectPriorityChecks(score.checks).map((check) => ({
      checkId: check.id,
      label: getRubricCheckDefinitionV2(check.id).label,
      reason: cleanReportText(check.reason, 600) || 'Informazione insufficiente per descrivere il punto critico.',
      missing: check.missing.map((item) => cleanReportText(item, 300)).filter(Boolean).slice(0, 3),
    })),
  };
}

export function calculateAnnunci10xScoreReportAreas(checks: readonly EvaluationCheckV2[]): ScoreReportEmailAreaInput[] {
  const checksById = new Map(checks.map((check) => [check.id, check]));
  return ANNUNCI10X_SCORE_REPORT_AREA_DEFINITIONS.map((area) => {
    const evaluableChecks = area.checkIds
      .map((checkId) => checksById.get(checkId))
      .filter((check): check is EvaluationCheckV2 => check !== undefined && check.score !== null);
    const totalScore = evaluableChecks.reduce((sum, check) => sum + (check.score ?? 0), 0);
    return {
      id: area.id,
      label: area.label,
      score: evaluableChecks.length ? (100 * totalScore) / (10 * evaluableChecks.length) : null,
      evaluatedCheckCount: evaluableChecks.length,
      totalCheckCount: area.checkIds.length,
    };
  });
}

export function interpretAnnunci10xScoreBand(code: ScoreBandCodeV2 | null): string {
  switch (code) {
    case 'CRITICAL':
      return 'L’annuncio lascia scoperte informazioni essenziali: prima di sponsorizzarlo conviene chiarire ruolo, lavoro reale e proposta.';
    case 'WEAK':
      return 'La struttura di base c’è, ma alcune informazioni decisive sono ancora troppo generiche o implicite: migliorare questi punti può rendere l’annuncio più comprensibile.';
    case 'GOOD_BASE':
      return 'L’annuncio ha una base leggibile: intervenire sulle aree più deboli può renderlo più concreto e facile da valutare per chi legge.';
    case 'STRONG':
      return 'L’annuncio è già solido: le priorità servono a togliere ambiguità residue e a rendere più netta la proposta.';
    case 'EXCELLENT':
      return 'L’annuncio è molto completo: gli interventi utili sono soprattutto di rifinitura, coerenza e precisione.';
    default:
      return 'Il report usa solo i controlli valutabili del metodo V2; quando mancano informazioni, alcune aree restano senza punteggio.';
  }
}

function isEligibleRun(run: PersistedAnalysisRun | null): run is PersistedAnalysisRun & { evaluationId: string } {
  return Boolean(
    run
    && run.status === 'READY'
    && run.sourceStatus === 'READY'
    && run.evaluationId
    && run.resultReference
  );
}

function selectPriorityChecks(checks: readonly EvaluationCheckV2[]): EvaluationCheckV2[] {
  return checks
    .filter((check) => check.status !== 'NOT_EVALUABLE')
    .sort(comparePriorityChecks)
    .slice(0, 3);
}

function comparePriorityChecks(left: EvaluationCheckV2, right: EvaluationCheckV2): number {
  const leftScore = left.score === null ? Number.NEGATIVE_INFINITY : left.score;
  const rightScore = right.score === null ? Number.NEGATIVE_INFINITY : right.score;
  if (leftScore !== rightScore) return leftScore - rightScore;
  const severity = STATUS_SEVERITY[left.status] - STATUS_SEVERITY[right.status];
  if (severity !== 0) return severity;
  return left.id.localeCompare(right.id);
}

function cleanReportText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength).trimEnd();
}
