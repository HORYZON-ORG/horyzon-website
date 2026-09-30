import { calculateRadarScores, isRadarComplete } from './domain.ts';
import { lockedRadarProjection, unlockedRadarProjection } from './public-projection.ts';
import { createPreviewToken, timingSafePinMatch, verifyPreviewToken } from './preview.ts';
import { hashOwnerSecret } from './persistence/security.ts';
import type { RadarPersistence, RadarQualificationInput, SaveRadarAnswerInput } from './persistence/types.ts';

export class RadarAccessError extends Error {
  readonly status: number;
  constructor(message: string, status = 403) { super(message); this.name = 'RadarAccessError'; this.status = status; }
}

export function createRadarService(config: { persistence: RadarPersistence; previewPin?: string; previewEnabled?: boolean; tokenSecret?: string }) {
  const tokenSecret = config.tokenSecret?.trim();
  return {
    createAssessment: (input: RadarQualificationInput) => config.persistence.createAssessment(input),
    resumeAssessment: (assessmentId: string, ownerSecret: string) => config.persistence.resumeAssessment({ assessmentId, ownerSecretHash: hashOwnerSecret(ownerSecret) }),
    saveAnswer: (input: Omit<SaveRadarAnswerInput, 'ownerSecretHash'> & { ownerSecret: string }) => config.persistence.saveAnswer({ ...input, ownerSecretHash: hashOwnerSecret(input.ownerSecret) }),
    async completeAssessment(assessmentId: string, ownerSecret: string) {
      const session = await config.persistence.completeAssessment({ assessmentId, ownerSecretHash: hashOwnerSecret(ownerSecret) });
      return lockedRadarProjection({ status: 'PAYMENT_REQUIRED', answeredCount: session.answeredCount });
    },
    async grantPreview(input: { assessmentId: string; ownerSecret: string; pin: string; ipKey: string }) {
      if (!config.previewEnabled || !config.previewPin || !tokenSecret) throw new RadarAccessError('Anteprima non disponibile.', 404);
      const session = await config.persistence.resumeAssessment({ assessmentId: input.assessmentId, ownerSecretHash: hashOwnerSecret(input.ownerSecret) });
      if (!isRadarComplete(session.answers, session.questionnaireVersion)) throw new RadarAccessError('Il Radar non è completo.', 409);
      const recentDenials = await config.persistence.countRecentPreviewDenials(input.assessmentId);
      if (recentDenials >= 5) throw new RadarAccessError('Troppi tentativi. Riprova più tardi.', 423);
      if (!timingSafePinMatch(input.pin, config.previewPin)) {
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
    async readOwnedResult(assessmentId: string, ownerSecret: string) {
      const session = await config.persistence.resumeAssessment({ assessmentId, ownerSecretHash: hashOwnerSecret(ownerSecret) });
      await config.persistence.appendAccessEvent({ assessmentId, accessSource: 'PURCHASE', eventType: 'RESULT_OPENED' });
      return unlockedRadarProjection({ status: 'COMPLETED', answeredCount: session.answeredCount, scores: calculateRadarScores(session.answers) });
    },
  };
}
