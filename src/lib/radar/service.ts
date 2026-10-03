import { calculateRadarScores, isRadarComplete } from './domain.ts';
import { mergeAdvice, type RadarAdvice } from './advice.ts';
import { buildRadarReport } from './report.ts';
import { lockedRadarProjection, unlockedRadarProjection } from './public-projection.ts';
import { createPreviewToken, timingSafePinMatch, verifyPreviewToken } from './preview.ts';
import { hashOwnerSecret } from './persistence/security.ts';
import type { RadarAdviceRow, RadarPersistence, RadarQualificationInput, RadarReportOwnerContext, SaveRadarAnswerInput } from './persistence/types.ts';
import type { RadarAnswers } from './types.ts';

export class RadarAccessError extends Error {
  readonly status: number;
  constructor(message: string, status = 403) { super(message); this.name = 'RadarAccessError'; this.status = status; }
}

function composeReport(answers: RadarAnswers, owner: RadarReportOwnerContext, rows: RadarAdviceRow[]) {
  return buildRadarReport({ scores: calculateRadarScores(answers), answers, advice: mergeAdvice(rows as Partial<RadarAdvice>[]), context: { aziendaNome: owner.aziendaNome, referenteNome: owner.referenteNome, settore: owner.settore, numeroDipendenti: owner.numeroDipendenti, volumeAffari: owner.volumeAffari, completedAt: owner.completedAt } });
}

/** `freeAccess`: the Radar is a free lead magnet, so a completed assessment opens its result without purchase or PIN. */
export function createRadarService(config: { persistence: RadarPersistence; previewPin?: string; previewEnabled?: boolean; tokenSecret?: string; freeAccess?: boolean }) {
  const tokenSecret = config.tokenSecret?.trim();
  const freeAccess = config.freeAccess === true;
  return {
    freeAccess,
    createAssessment: (input: RadarQualificationInput) => config.persistence.createAssessment(input),
    resumeAssessment: (assessmentId: string, ownerSecret: string) => config.persistence.resumeAssessment({ assessmentId, ownerSecretHash: hashOwnerSecret(ownerSecret) }),
    saveAnswer: (input: Omit<SaveRadarAnswerInput, 'ownerSecretHash'> & { ownerSecret: string }) => config.persistence.saveAnswer({ ...input, ownerSecretHash: hashOwnerSecret(input.ownerSecret) }),
    async completeAssessment(assessmentId: string, ownerSecret: string) {
      const ownership = { assessmentId, ownerSecretHash: hashOwnerSecret(ownerSecret) };
      const session = await config.persistence.completeAssessment(ownership);
      if (freeAccess) await config.persistence.markCompletedFree(ownership);
      // Scores never travel with completion: the client reads them from /api/radar/result.
      return lockedRadarProjection({ status: freeAccess ? 'COMPLETED' : 'PAYMENT_REQUIRED', answeredCount: session.answeredCount });
    },
    async grantPreview(input: { assessmentId: string; ownerSecret: string; pin: string; ipKey: string }) {
      if (!config.previewEnabled || !config.previewPin || !tokenSecret) throw new RadarAccessError('Anteprima non disponibile.', 404);
      const session = await config.persistence.resumeAssessment({ assessmentId: input.assessmentId, ownerSecretHash: hashOwnerSecret(input.ownerSecret) });
      if (!isRadarComplete(session.answers, session.questionnaireVersion)) throw new RadarAccessError('Il Radar non è completo.', 409);
      const recentDenials = await config.persistence.countRecentPreviewDenials(input.assessmentId);
      if (recentDenials >= 5) throw new RadarAccessError('Troppi tentativi. Riprova più tardi.', 423);
      if (!timingSafePinMatch(input.pin.trim(), config.previewPin.trim())) {
        await config.persistence.appendAccessEvent({ assessmentId: input.assessmentId, accessSource: 'PREVIEW', eventType: 'PREVIEW_DENIED' });
        throw new RadarAccessError('PIN non valido.');
      }
      await config.persistence.appendAccessEvent({ assessmentId: input.assessmentId, accessSource: 'PREVIEW', eventType: 'PREVIEW_GRANTED' });
      return { source: 'PREVIEW' as const, token: createPreviewToken(input.assessmentId, tokenSecret) };
    },
    verifyPreviewGrant: (token: string, assessmentId: string) => Boolean(tokenSecret && verifyPreviewToken(token, assessmentId, tokenSecret)),
    async readPreviewResult(assessmentId: string, ownerSecret: string, previewToken: string) {
      if (!tokenSecret || !verifyPreviewToken(previewToken, assessmentId, tokenSecret)) throw new RadarAccessError('Risultato non autorizzato.', 402);
      const session = await config.persistence.resumeAssessment({ assessmentId, ownerSecretHash: hashOwnerSecret(ownerSecret) });
      await config.persistence.appendAccessEvent({ assessmentId, accessSource: 'PREVIEW', eventType: 'RESULT_OPENED' });
      return unlockedRadarProjection({ status: 'COMPLETED', answeredCount: session.answeredCount, scores: calculateRadarScores(session.answers) });
    },
    /** The full report. Call only after readPreviewResult or readOwnedResult authorised the request. */
    async readReport(assessmentId: string, ownerSecret: string) {
      const ownership = { assessmentId, ownerSecretHash: hashOwnerSecret(ownerSecret) };
      const [session, owner, rows] = await Promise.all([
        config.persistence.resumeAssessment(ownership),
        config.persistence.readReportContext(ownership),
        config.persistence.listAdvice().catch(() => []),
      ]);
      return { report: composeReport(session.answers, owner, rows), recipient: { email: owner.referenteEmail, name: owner.referenteNome }, owner };
    },
    claimReportEmail: (assessmentId: string) => config.persistence.claimReportEmail(assessmentId),
    async readFreeResult(assessmentId: string, ownerSecret: string) {
      if (!freeAccess) throw new RadarAccessError('Risultato non autorizzato.', 402);
      const session = await config.persistence.resumeAssessment({ assessmentId, ownerSecretHash: hashOwnerSecret(ownerSecret) });
      if (!isRadarComplete(session.answers, session.questionnaireVersion)) throw new RadarAccessError('Il Radar non è completo.', 409);
      return unlockedRadarProjection({ status: 'COMPLETED', answeredCount: session.answeredCount, scores: calculateRadarScores(session.answers) });
    },
    /** The report of any assessment, by id. Call only after verifying a Hub staff session (staff-auth.ts). */
    async readStaffReport(assessmentId: string) {
      const [record, rows] = await Promise.all([config.persistence.readStaffRecord(assessmentId), config.persistence.listAdvice().catch(() => [])]);
      if (!isRadarComplete(record.answers, record.questionnaireVersion)) throw new RadarAccessError('Il Radar non è ancora completo.', 409);
      return composeReport(record.answers, record.context, rows);
    },
    async readOwnedResult(assessmentId: string, ownerSecret: string) {
      const session = await config.persistence.resumeAssessment({ assessmentId, ownerSecretHash: hashOwnerSecret(ownerSecret) });
      await config.persistence.appendAccessEvent({ assessmentId, accessSource: 'PURCHASE', eventType: 'RESULT_OPENED' });
      return unlockedRadarProjection({ status: 'COMPLETED', answeredCount: session.answeredCount, scores: calculateRadarScores(session.answers) });
    },
  };
}
