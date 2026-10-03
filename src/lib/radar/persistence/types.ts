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

export interface RadarReportOwnerContext { aziendaNome: string; referenteNome: string; referenteEmail: string; referenteTelefono: string; settore: string; numeroDipendenti: string; volumeAffari: string; completedAt: string | null }
/** One assessment read by id alone, for staff tools that authorised the caller themselves. */
export interface RadarStaffRecord { id: string; questionnaireVersion: string; status: RadarJourneyStatus; answers: RadarAnswers; context: RadarReportOwnerContext }
export interface RadarAdviceRow { kind: string; subject: string; band: string; title: string | null; body: string | null; action: string | null }

export interface RadarPersistence {
  createAssessment(input: RadarQualificationInput): Promise<RadarOwnedSession>;
  resumeAssessment(input: RadarOwnership): Promise<RadarResumeProjection>;
  saveAnswer(input: SaveRadarAnswerInput): Promise<RadarProgressProjection>;
  completeAssessment(input: RadarOwnership): Promise<RadarResumeProjection>;
  appendAccessEvent(input: RadarAccessEventInput): Promise<void>;
  countRecentPreviewDenials(assessmentId: string): Promise<number>;
  readReportContext(input: RadarOwnership): Promise<RadarReportOwnerContext>;
  listAdvice(): Promise<RadarAdviceRow[]>;
  /** True only for the first caller: the report email goes out once per assessment. */
  claimReportEmail(assessmentId: string): Promise<boolean>;
  /** Free Radar: the completed assessment opens its result without a purchase. */
  markCompletedFree(input: RadarOwnership): Promise<void>;
  readStaffRecord(assessmentId: string): Promise<RadarStaffRecord>;
}
