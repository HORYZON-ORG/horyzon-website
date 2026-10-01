import {
  createAnnunci10xEmailProvider,
  type Annunci10xEmailProvider,
  type ScoreReportEmailAreaInput,
  type ScoreReportEmailCheckInput,
  type ScoreReportEmailPriorityInput,
} from './lead-verification.ts';
import type { Annunci10xRuntimeContext, Annunci10xSessionCookie } from './product-flow.ts';
import { getRubricCheckDefinitionV2 } from './rubric-v2.ts';
import { isScoreResultV2 } from './score-v2.ts';
import type { AnchorScoreV2, CheckIdV2, EvaluationCheckV2, RubricCheckDefinitionV2, ScoreBandCodeV2, ScoreResultV2 } from './types-v2.ts';
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
  analysisRunId: string;
  roleTitle: string;
  score: number | null;
  band: string | null;
  coverage: number;
  evaluableCheckCount: number;
  areaScores: ScoreReportEmailAreaInput[];
  checks: ScoreReportEmailCheckInput[];
  interpretation: string;
  priorities: ScoreReportEmailPriorityInput[];
}

export const ANNUNCI10X_SCORE_REPORT_AREA_DEFINITIONS: readonly {
  id: string;
  label: string;
  checkIds: readonly CheckIdV2[];
}[] = [
  { id: 'ROLE_IDENTITY', label: 'Identità del ruolo', checkIds: ['01', '02'] },
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

const CUSTOMER_FACING_CHECK_LABELS_V2: Record<CheckIdV2, string> = {
  '01': 'Riconoscibilità del titolo',
  '02': 'Livello, perimetro e responsabilità',
  '03': 'Concretezza delle attività',
  '04': 'Risultato osservabile del ruolo',
  '05': 'Contesto operativo',
  '06': 'Priorità delle informazioni',
  '07': 'Fedeltà routine e sfide',
  '08': 'Visibilità delle condizioni impegnative',
  '09': 'Adeguatezza tecnica del linguaggio',
  '10': 'Classificazione dei requisiti',
  '11': 'Rilevanza dei requisiti',
  '12': 'Sede e modalità di lavoro',
  '13': 'Contratto, orari e tempi',
  '14': 'Chiarezza del compenso',
  '15': "Ragioni concrete dell'offerta",
  '16': 'Fit struttura-canale',
  '17': 'Coerenza testo-campi-destinazione',
  '18': 'Leggibilità e scansione',
  '19': 'Concretezza del linguaggio',
  '20': 'Chiarezza candidatura',
};

const CUSTOMER_FACING_MISSING_SUGGESTIONS_V2: Record<CheckIdV2, readonly string[]> = {
  '01': ['Rendi il titolo del ruolo chiaro, specifico e riconoscibile per chi cerca quel lavoro.'],
  '02': ['Chiarisci livello, responsabilità principali, autonomia e perimetro operativo.'],
  '03': ['Descrivi le attività concrete che la persona svolgerà nella pratica quotidiana.'],
  '04': ['Esplicita quale risultato concreto deve produrre la persona nel ruolo.'],
  '05': ['Indica contesto operativo, interlocutori principali e ambiente di lavoro.'],
  '06': ['Porta in evidenza le informazioni più importanti per decidere se candidarsi.'],
  '07': ['Racconta ritmo di lavoro, routine, imprevisti e sfide rilevanti senza abbellirli.'],
  '08': ['Rendi visibili condizioni impegnative, responsabilità materiali o richieste particolari quando contano.'],
  '09': ['Adatta il linguaggio tecnico al livello reale del ruolo e alla persona che deve leggerlo.'],
  '10': ['Separa chiaramente ciò che è indispensabile da ciò che è preferenziale o apprendibile.'],
  '11': ['Collega ogni requisito importante alle attività, ai risultati o alle condizioni del lavoro.'],
  '12': ['Indica con chiarezza sede e modalità di lavoro.'],
  '13': ['Specifica contratto, orari, turni, durata o tempi rilevanti per la decisione.'],
  '14': ['Se disponibile, rendi chiaro il compenso o la relativa fascia.'],
  '15': ["Aggiungi ragioni concrete e verificabili per cui una persona dovrebbe considerare l'offerta."],
  '16': ["Adatta struttura, lunghezza e ordine dell'annuncio al canale di pubblicazione."],
  '17': ['Allinea testo, campi del portale e destinazione di candidatura sugli stessi fatti.'],
  '18': ['Rendi il testo più facile da leggere con sezioni, ordine e gerarchia chiari.'],
  '19': ['Sostituisci formule vaghe o ripetitive con parole concrete e specifiche del ruolo.'],
  '20': ['Spiega esattamente come e dove candidarsi.'],
};

const CUSTOMER_FACING_MISSING_REASONS_V2: Record<CheckIdV2, string> = {
  '01': 'Nel testo manca un titolo abbastanza chiaro e riconoscibile per identificare subito il ruolo.',
  '02': 'Nel testo mancano informazioni sufficienti su livello, responsabilità e perimetro del ruolo.',
  '03': 'Le attività quotidiane non sono ancora descritte in modo abbastanza concreto.',
  '04': 'Il risultato atteso del ruolo non è ancora espresso in modo chiaro.',
  '05': 'Il contesto operativo non è ancora abbastanza comprensibile per chi legge.',
  '06': 'Le informazioni decisive non emergono con sufficiente priorità.',
  '07': 'Ritmo di lavoro, routine o sfide rilevanti non sono ancora rappresentati in modo chiaro.',
  '08': 'Le condizioni impegnative rilevanti non sono ancora abbastanza visibili.',
  '09': 'Il dettaglio tecnico necessario non emerge con sufficiente chiarezza.',
  '10': 'La distinzione tra requisiti indispensabili, preferenziali e apprendibili non è ancora chiara.',
  '11': 'I requisiti non sono ancora collegati in modo sufficiente al lavoro reale.',
  '12': 'Sede e modalità di lavoro non sono ancora indicate con sufficiente chiarezza.',
  '13': 'Contratto, orari o tempi rilevanti non sono ancora abbastanza chiari.',
  '14': 'Il compenso, o il modo in cui viene gestito, non è ancora abbastanza chiaro.',
  '15': "L'offerta non contiene ancora ragioni concrete e verificabili per essere valutata.",
  '16': 'La struttura non risulta ancora abbastanza adatta al canale di pubblicazione.',
  '17': 'Testo, campi o destinazione non risultano ancora abbastanza allineati.',
  '18': 'Il testo non è ancora abbastanza facile da leggere e scandire.',
  '19': 'Il linguaggio resta troppo generico, ripetitivo o poco concreto.',
  '20': 'Il percorso di candidatura non è ancora sufficientemente chiaro.',
};

const CUSTOMER_FACING_ANCHOR_OVERRIDES_V2: Partial<Record<CheckIdV2, Partial<Record<AnchorScoreV2, string>>>> = {
  '02': {
    4: 'Alcune responsabilità sono comprensibili, ma livello, autonomia o confini del ruolo richiedono ancora interpretazione.',
  },
  '04': {
    4: 'Il risultato del ruolo non è ancora espresso in modo sufficientemente chiaro: il candidato deve ricostruirlo dalle attività descritte.',
  },
  '10': {
    2: 'I requisiti non sono ancora separati con sufficiente chiarezza tra indispensabili, preferenziali e apprendibili.',
  },
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
  const score = input.evaluation.score;
  return {
    analysisRunId: input.analysisRun.id,
    roleTitle: cleanReportText(input.snapshot?.roleCard.title?.value, 140) || 'Il tuo annuncio',
    score: score.value,
    band: score.band?.label ?? null,
    coverage: score.coverage,
    evaluableCheckCount: score.evaluableCheckCount,
    areaScores: calculateAnnunci10xScoreReportAreas(score.checks),
    checks: score.checks.map(buildCustomerFacingCheckV2),
    interpretation: interpretAnnunci10xScoreBand(score.band?.code ?? null),
    priorities: selectPriorityChecks(score.checks).map(buildCustomerFacingPriorityV2),
  };
}

export function buildCustomerFacingCheckV2(check: EvaluationCheckV2): ScoreReportEmailCheckInput {
  const definition = getRubricCheckDefinitionV2(check.id);
  return {
    checkId: check.id,
    label: cleanReportText(CUSTOMER_FACING_CHECK_LABELS_V2[check.id] ?? definition.label, 160),
    score: check.score,
    status: check.status,
    statusLabel: customerFacingStatusLabel(check.status),
    reason: customerFacingPriorityReasonV2(check, definition),
    improvement: cleanReportText(CUSTOMER_FACING_MISSING_SUGGESTIONS_V2[check.id][0], 300),
  };
}

export function buildCustomerFacingPriorityV2(check: EvaluationCheckV2): ScoreReportEmailPriorityInput {
  const presentation = buildCustomerFacingCheckV2(check);
  return {
    checkId: presentation.checkId,
    label: presentation.label,
    reason: presentation.reason,
    missing: presentation.improvement ? [presentation.improvement] : [],
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

function customerFacingStatusLabel(status: EvaluationCheckV2['status']): string {
  if (status === 'EVALUATED') return 'Valutato';
  if (status === 'MISSING') return 'Mancante';
  if (status === 'CONFLICT') return 'Da chiarire';
  if (status === 'UNSUPPORTED') return 'Non supportato';
  return 'N/D';
}

function customerFacingPriorityReasonV2(check: EvaluationCheckV2, definition: RubricCheckDefinitionV2): string {
  let reason: string;
  switch (check.status) {
    case 'EVALUATED':
      reason = customerFacingEvaluatedReasonV2(check, definition);
      break;
    case 'MISSING':
      reason = CUSTOMER_FACING_MISSING_REASONS_V2[check.id] ?? definition.missingSemantics;
      break;
    case 'CONFLICT':
      reason = 'Nel testo emergono informazioni non completamente coerenti su questo punto.';
      break;
    case 'UNSUPPORTED':
      reason = "Questa informazione non risulta sufficientemente supportata dai fatti presenti nell'annuncio.";
      break;
    case 'NOT_EVALUABLE':
      reason = definition.notEvaluableSemantics;
      break;
    default:
      reason = 'Informazione insufficiente per descrivere il punto critico.';
  }
  return cleanCustomerFacingText(reason, 600);
}

function customerFacingEvaluatedReasonV2(check: EvaluationCheckV2, definition: RubricCheckDefinitionV2): string {
  if (check.score === null) return CUSTOMER_FACING_MISSING_REASONS_V2[check.id] ?? definition.missingSemantics;
  const score = check.score;
  const sortedAnchors = [...definition.anchors].sort((left, right) => left.score - right.score);
  const anchor = sortedAnchors
    .filter((item) => item.score <= score)
    .at(-1) ?? sortedAnchors[0];
  return CUSTOMER_FACING_ANCHOR_OVERRIDES_V2[check.id]?.[anchor.score] ?? anchor.description;
}

function cleanCustomerFacingText(value: string, maxLength: number): string {
  const localized = localizeItalianPresentationText(value);
  if (hasTechnicalProviderLanguage(localized)) return 'Informazione insufficiente per descrivere il punto critico.';
  return cleanReportText(localized, maxLength) || 'Informazione insufficiente per descrivere il punto critico.';
}

function localizeItalianPresentationText(value: string): string {
  const replacements: readonly (readonly [string | RegExp, string])[] = [
    [/\bIdentita\b/g, 'Identità'],
    [/\bRiconoscibilita\b/g, 'Riconoscibilità'],
    [/\battivita\b/g, 'attività'],
    [/\bAttivita\b/g, 'Attività'],
    [/\bresponsabilita\b/g, 'responsabilità'],
    [/\bResponsabilita\b/g, 'Responsabilità'],
    [/\bmodalita\b/g, 'modalità'],
    [/\bModalita\b/g, 'Modalità'],
    [/\bpriorita\b/g, 'priorità'],
    [/\bPriorita\b/g, 'Priorità'],
    [/\bfedelta\b/g, 'fedeltà'],
    [/\bFedelta\b/g, 'Fedeltà'],
    [/\bvisibilita\b/g, 'visibilità'],
    [/\bVisibilita\b/g, 'Visibilità'],
    [/\bleggibilita\b/g, 'leggibilità'],
    [/\bLeggibilita\b/g, 'Leggibilità'],
    [/\bspecificita\b/g, 'specificità'],
    [/\bambiguita\b/g, 'ambiguità'],
    [/\brealta\b/g, 'realtà'],
    [/\bpiu\b/g, 'più'],
    [/\bcio\b/g, 'ciò'],
    [/\bperlopiu\b/g, 'perlopiù'],
    [/\bcliche\b/g, 'cliché'],
    [/\bdifficolta\b/g, 'difficoltà'],
    [/\bTecnicalita\b/g, 'Tecnicità'],
    [/\btecnicalita\b/g, 'tecnicità'],
    [/\bcandidati target\b/g, 'candidati ideali'],
    [/\bcandidato-facing\b/g, 'pensato per chi legge'],
    [/\brole-specific\b/g, 'specifico del ruolo'],
    [/\bsearch-friendly\b/g, 'facile da cercare'],
    [/\bkeyword stuffing\b/g, 'accumulo artificiale di parole chiave'],
    [/\bcorporate filler\b/g, 'frasi aziendali generiche'],
    [/\bclaim\b/g, 'affermazioni'],
    [/\baudit\/meta voice\b/g, 'tono di revisione interna'],
    [/\bfiller\b/g, 'riempitivi'],
    [/\bsource commentary\b/g, 'commenti sul testo di partenza'],
    [/\bL offerta\b/g, "L'offerta"],
    [/\bl offerta\b/g, "l'offerta"],
    [/\bl opportunita\b/g, "l'opportunità"],
    [/\ball ingresso\b/g, "all'ingresso"],
    [/\bl ordine\b/g, "l'ordine"],
    [/\bL enfasi\b/g, "L'enfasi"],
    [/\bdell offerta\b/g, "dell'offerta"],
  ];
  return replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

function hasTechnicalProviderLanguage(value: string): boolean {
  return /\b(target evidence|unsupported claim|check\s+\d{1,2}|provider|target|rubric|score semantics)\b/i.test(value);
}

function cleanReportText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength).trimEnd();
}
