import { checkupCalendarUrl } from './checkup-copy.ts';
import { CHECKUP_SCORE_METHOD, meanCheckupReport, buildCheckupImprovementPlan, type CheckupImprovementPlan } from './checkup-improvements.ts';
import { Annunci10xPublicError, type Annunci10xRuntimeContext, type Annunci10xSessionCookie } from './product-flow.ts';
import { buildAnnunci10xScoreReport, type Annunci10xScoreReport } from './score-report-email.ts';
import { createAnnunci10xEmailProvider, type Annunci10xEmailProvider } from './lead-verification.ts';
import { generateAnnunci10xCheckupOutput } from './premium/pipeline.ts';
import { isScoreResultV2 } from './score-v2.ts';
import { CHECKUP_VERSION, CHECKUP_INVITATION, getCheckupContact } from './checkup-contact.ts';
import type { PersistedAnalysisRun } from './persistence/types.ts';
import type { GeneratedAd } from './types.ts';

export interface CheckupReport {
  scoreMethod?: typeof CHECKUP_SCORE_METHOD;
  improvementPlan?: CheckupImprovementPlan;
  example?: boolean;
  version: typeof CHECKUP_VERSION;
  analysisRunId: string;
  createdAt: string;
  roleTitle: string;
  originalText: string;
  improvedText: string;
  before: Annunci10xScoreReport;
  after: Annunci10xScoreReport;
  changes: string[];
  missingInformation: string[];
}
export interface CheckupReceipt {
  status: 'PREPARING' | 'PDF_READY' | 'EMAIL_ACCEPTED' | 'EMAIL_ERROR' | 'FAILED';
  attempts: number;
  emailExhausted?: boolean;
  report?: CheckupReport;
  pdfBase64?: string;
  outputId?: string;
}
export type CheckupInput = { session: Annunci10xSessionCookie; analysisRunId: string; context: Annunci10xRuntimeContext; provider?: Annunci10xEmailProvider; env?: Record<string, string | undefined> };
const active = new Map<string, Promise<CheckupReceipt>>();

export async function readCheckup(input: CheckupInput) {
  const run = await ownedReadyRun(input);
  return { run, receipt: run.retrievalMetadata.checkup as CheckupReceipt | undefined };
}

/** Durable receipt + cross-worker lease. Reloads return the saved gift, never a new request. */
export async function prepareCheckup(input: CheckupInput): Promise<CheckupReceipt> {
  const key = `${input.session.sessionId}:${input.analysisRunId}`;
  const running = active.get(key);
  if (running) return running;
  const work = prepare(input).finally(() => active.delete(key));
  active.set(key, work);
  return work;
}
async function prepare(input: CheckupInput): Promise<CheckupReceipt> {
  let { run, receipt } = await readCheckup(input);
  if (receipt?.report && receipt.pdfBase64) return sendGift(input, run, receipt);
  if ((receipt?.attempts ?? 0) >= 3) return receipt!;
  const lease = await input.context.persistence.checkRateLimit({ scope: 'annunci10x_checkup', subject: run.id, limit: 1, windowSeconds: 360 });
  if (!lease.allowed) return receipt ?? { status: 'PREPARING', attempts: 0 };
  ({ run, receipt } = await readCheckup(input));
  if (receipt?.report && receipt.pdfBase64) return sendGift(input, run, receipt);
  const state: CheckupReceipt = { status: 'PREPARING', attempts: (receipt?.attempts ?? 0) + 1 };
  await saveReceipt(input, run, state);
  try {
    const { persistence } = input.context;
    const lead = await persistence.getLead(run.sessionId, input.session.sessionSecret);
    const contact = await getCheckupContact(input.context, input.session, run.id);
    if (!lead?.companyName || contact?.email !== lead.emailNormalized) throw new Error('checkup contact missing');
    const session = await persistence.getSession(run.sessionId, input.session.sessionSecret);
    const snapshotId = run.operationRefs.CONTEXT_SNAPSHOT;
    const snapshot = typeof snapshotId === 'string' ? await persistence.getSnapshotById(snapshotId, run.sessionId, input.session.sessionSecret) : null;
    const original = await persistence.getEvaluationById(run.evaluationId!, run.sessionId, input.session.sessionSecret);
    if (!session || !snapshot || !original || !isScoreResultV2(original.score)) throw new Error('checkup source missing');
    // Recover a committed Master after interruption between output save and receipt save.
    let output = await persistence.getLatestOutput(run.sessionId, input.session.sessionSecret, 'MASTER');
    let after = output?.snapshotId === snapshot.id ? await persistence.getEvaluationByOutputId(output.id, run.sessionId, input.session.sessionSecret) : null;
    if (!output || output.snapshotId !== snapshot.id || !after || !isScoreResultV2(after.score)) {
      const generated = await generateAnnunci10xCheckupOutput({ context: input.context, session, sessionSecret: input.session.sessionSecret, snapshot, analysisRunId: run.id });
      output = generated.masterOutput;
      after = generated.evaluation;
    }
    if (!isScoreResultV2(after.score)) throw new Error('checkup requires V2');
    const beforeReport = meanCheckupReport(buildAnnunci10xScoreReport({ lead, analysisRun: run, evaluation: { ...original, score: original.score }, snapshot }));
    const afterReport = meanCheckupReport(buildAnnunci10xScoreReport({ lead, analysisRun: run, evaluation: { ...after, score: after.score }, snapshot }));
    const master = output.generatedContent as GeneratedAd;
    const improvedText = master.sections.map(s => [s.title, s.body].filter(Boolean).join('\n')).join('\n\n');
    const report: CheckupReport = {
      scoreMethod: CHECKUP_SCORE_METHOD,
      improvementPlan: buildCheckupImprovementPlan(beforeReport, afterReport),
      version: CHECKUP_VERSION, analysisRunId: run.id, createdAt: output.createdAt,
      roleTitle: beforeReport.roleTitle, originalText: run.targetText!, improvedText,
      before: beforeReport, after: afterReport,
      changes: beforeReport.checks.flatMap((c, i) => {
        const next = afterReport.checks[i];
        return c.score === next.score && c.status === next.status ? [] : [`${c.label}: ${label(c.score)} → ${label(next.score)}. ${next.reason}`];
      }),
      missingInformation: beforeReport.checks.filter(c => ['MISSING', 'CONFLICT', 'UNSUPPORTED'].includes(c.status) || (c.score !== null && c.score <= 4)).map(c => c.improvement),
    };
    const { renderCheckupPdf } = await import('./checkup-pdf.ts');
    const pdf = await renderCheckupPdf(report);
    const ready: CheckupReceipt = { ...state, status: 'PDF_READY', report, outputId: output.id, pdfBase64: pdf.toString('base64') };
    await saveReceipt(input, run, ready);
    await persistence.appendEvent({ sessionId: run.sessionId, eventName: 'checkup_pdf_generated', metadata: { analysisRunId: run.id, version: CHECKUP_VERSION } });
    return await sendGift(input, run, ready);
  } catch {
    const current = await input.context.persistence.getAnalysisRun(run.id, input.session.sessionSecret);
    const persisted = current?.retrievalMetadata.checkup as CheckupReceipt | undefined;
    if (persisted?.report && persisted.pdfBase64) return persisted;
    const failed: CheckupReceipt = { ...state, status: 'FAILED' };
    await saveReceipt(input, run, failed);
    return failed;
  }
}
async function sendGift(input: CheckupInput, run: PersistedAnalysisRun, receipt: CheckupReceipt): Promise<CheckupReceipt> {
  if (receipt.status === 'EMAIL_ACCEPTED') return receipt;
  const env = input.env ?? process.env;
  if (!['1', 'true', 'yes'].includes(env.ANNUNCI10X_SCORE_REPORT_EMAIL_ENABLED?.toLowerCase() ?? '')) return receipt;
  const lead = await input.context.persistence.getLead(run.sessionId, input.session.sessionSecret);
  if (!lead?.emailVerifiedAt || !receipt.report || !receipt.pdfBase64) return receipt;
  const existing = await input.context.persistence.getEmailDelivery(run.sessionId, input.session.sessionSecret, run.id, lead.emailNormalized);
  if (existing?.status === 'SENT') {
    const accepted: CheckupReceipt = { ...receipt, status: 'EMAIL_ACCEPTED' };
    await saveReceipt(input, run, accepted);
    return accepted;
  }
  // Resend retains idempotency keys for 24 hours. Never retry an uncertain old send outside that window.
  if (existing && (Date.now() - Date.parse(existing.createdAt) > 23 * 60 * 60 * 1000 || (existing.status === 'FAILED' && existing.attemptCount >= 5))) {
    const exhausted: CheckupReceipt = { ...receipt, status: 'EMAIL_ERROR', emailExhausted: true };
    await saveReceipt(input, run, exhausted);
    return exhausted;
  }
  const delivery = await input.context.persistence.claimEmailDelivery({ ...input.session, analysisRunId: run.id, kind: 'SCORE_REPORT', recipient: lead.emailNormalized, leaseSeconds: 120 });
  if (!delivery) return receipt;
  try {
    const provider = input.provider ?? createAnnunci10xEmailProvider(env);
    const sent = await provider.sendScoreReport({
      ...receipt.report.before, deliveryId: delivery.id, recipient: delivery.recipientNormalized, firstName: lead.firstName,
      checkup: { afterScore: receipt.report.after.score, pdfBase64: receipt.pdfBase64 },
    });
    await input.context.persistence.markEmailDeliverySent({ deliveryId: delivery.id, sessionSecret: input.session.sessionSecret, provider: provider.kind, providerRequestId: sent.providerRequestId ?? null });

  } catch {
    await input.context.persistence.markEmailDeliveryFailed({ deliveryId: delivery.id, sessionSecret: input.session.sessionSecret, errorCode: 'EMAIL_PROVIDER_UNAVAILABLE' });
    const failed: CheckupReceipt = { ...receipt, status: 'EMAIL_ERROR', emailExhausted: delivery.attemptCount >= 5 };
    await saveReceipt(input, run, failed);
    return failed;
  }
  const accepted: CheckupReceipt = { ...receipt, status: 'EMAIL_ACCEPTED' };
  await saveReceipt(input, run, accepted);
  return accepted;
}
async function saveReceipt(input: CheckupInput, run: PersistedAnalysisRun, receipt: CheckupReceipt) {
  await input.context.persistence.updateAnalysisRun({ analysisRunId: run.id, sessionSecret: input.session.sessionSecret, retrievalMetadata: { ...run.retrievalMetadata, checkup: receipt } });
}
async function ownedReadyRun(input: CheckupInput) {
  const run = await input.context.persistence.getAnalysisRun(input.analysisRunId, input.session.sessionSecret);
  const lead = await input.context.persistence.getLead(input.session.sessionId, input.session.sessionSecret);
  if (!run || run.sessionId !== input.session.sessionId) throw new Annunci10xPublicError('NOT_FOUND', 'Richiesta non trovata.', 404);
  if (!lead?.emailVerifiedAt) throw new Annunci10xPublicError('EMAIL_VERIFICATION_REQUIRED', 'Verifica la tua email.', 403);
  if (run.status !== 'READY' || !run.evaluationId || !run.targetText || run.evaluationMode !== 'V2_PUBLIC') throw new Annunci10xPublicError('ANALYSIS_NOT_READY', 'Analisi ancora in corso.', 409);
  return run;
}
function label(value: number | null) { return value === null ? 'N/D' : `${value}/10`; }
export function checkupScore(value: number | null) { return value === null ? 'N/D' : `${(value / 10).toLocaleString('it-IT', { maximumFractionDigits: 1 })}/10`; }
export function checkupEmail(input: { analysisRunId: string; firstName?: string | null; roleTitle: string; score: number | null; afterScore: number | null; pdfBase64: string; from: string; replyTo?: string | null }) {
  const greeting = `Buongiorno${input.firstName ? ` ${input.firstName.replace(/[\r\n]/g, ' ')}` : ''},`;
  const calendarUrl = checkupCalendarUrl(input.analysisRunId);
  const comparison = `Testo attuale: ${checkupScore(input.score)}. Proposta: ${checkupScore(input.afterScore)}. Stessi 20 criteri; conversione dal punteggio su 100: valore diviso 10.`;
  const text = [greeting, '', CHECKUP_INVITATION[0], 'La valutazione è automatica e riguarda chiarezza e completezza del testo.', comparison, '', ...CHECKUP_INVITATION.slice(1, 3), '', CHECKUP_INVITATION[3], calendarUrl, '', 'Il PDF allegato è gratuito. La telefonata è facoltativa e non è necessaria per ricevere o usare il risultato.', '', 'Un saluto,', 'Angelo Ria Chetta', 'HORYZON Recruiting'].join('\n\n');
  const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]!);
  return { from: input.from, to: [], ...(input.replyTo ? { reply_to: input.replyTo } : {}), subject: `Il check-up del tuo annuncio per ${input.roleTitle.replace(/[\r\n]/g, ' ')}`, text,
    html: `<div style="font:16px/1.6 Arial;color:#173334;max-width:640px;margin:auto">${text.split('\n\n').filter(p => p !== calendarUrl).map(p => p === CHECKUP_INVITATION[3] ? `<p><a href="${calendarUrl}" style="background:#d5e04d;color:#173334;padding:12px 16px;display:inline-block">${esc(p)}</a></p>` : `<p>${esc(p)}</p>`).join('')}</div>`,
    attachments: [{ filename: 'check-up-annuncio.pdf', content: input.pdfBase64, content_type: 'application/pdf' }],
  };
}
