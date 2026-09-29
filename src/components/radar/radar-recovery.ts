import type { RadarAnswers } from '@/lib/radar/types';

export interface RadarRecoveryEnvelope {
  version: 1;
  questionnaireVersion: string;
  assessmentId: string;
  revision: number;
  currentStep: number;
  answers: RadarAnswers;
  updatedAt: string;
}
export function createRecoveryEnvelope(input: Omit<RadarRecoveryEnvelope, 'version' | 'updatedAt'>): RadarRecoveryEnvelope {
  return { version: 1, ...input, updatedAt: new Date().toISOString() };
}

export function recoveryStorageKey(assessmentId: string): string { return `horyzon:radar:recovery:${assessmentId}`; }

export function shouldRestoreRecovery(envelope: RadarRecoveryEnvelope, current: { assessmentId: string; questionnaireVersion: string }): boolean {
  return envelope.version === 1 && envelope.assessmentId === current.assessmentId && envelope.questionnaireVersion === current.questionnaireVersion;
}
