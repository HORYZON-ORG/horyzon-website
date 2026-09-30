import type { RadarAnswer, RadarAnswers, RadarJourneyStatus } from '../types.ts';

export interface RadarQualificationInput {
  aziendaNome: string;
  referenteNome: string;
  referenteEmail: string;
  referenteTelefono: string;
  settore: string;
  volumeAffari: string;
  numeroDipendenti: string;
  seasonal: boolean;
}

export interface RadarOwnedSession {
  id: string;
  ownerSecret: string;
  ownerSecretHash: string;
  revision: number;
}

export interface RadarOwnership { assessmentId: string; ownerSecretHash: string }
export interface RadarResumeProjection { questionnaireVersion: string; id: string; status: RadarJourneyStatus; answers: RadarAnswers; revision: number; currentStep: number; answeredCount: number; progressPercent: number }
export interface RadarProgressProjection { revision: number; currentStep: number; answeredCount: number; progressPercent: number }
export interface SaveRadarAnswerInput extends RadarOwnership { answerKey: string; value: RadarAnswer; expectedRevision: number; currentStep: number }
export interface RadarAccessEventInput { assessmentId: string; accessSource: 'PURCHASE' | 'PREVIEW'; eventType: 'PREVIEW_GRANTED' | 'PREVIEW_DENIED' | 'RESULT_OPENED' }

export interface RadarPersistence {
  createAssessment(input: RadarQualificationInput): Promise<RadarOwnedSession>;
  resumeAssessment(input: RadarOwnership): Promise<RadarResumeProjection>;
  saveAnswer(input: SaveRadarAnswerInput): Promise<RadarProgressProjection>;
  completeAssessment(input: RadarOwnership): Promise<RadarResumeProjection>;
  appendAccessEvent(input: RadarAccessEventInput): Promise<void>;
  countRecentPreviewDenials(assessmentId: string): Promise<number>;
}
