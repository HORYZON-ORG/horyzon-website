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
interface RecoveryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export function createRecoveryEnvelope(input: Omit<RadarRecoveryEnvelope, 'version' | 'updatedAt'>): RadarRecoveryEnvelope {
  return { version: 1, ...input, updatedAt: new Date().toISOString() };
}

export function recoveryStorageKey(assessmentId: string): string { return `horyzon:radar:recovery:${assessmentId}`; }
export function activeRecoveryStorageKey(): string { return 'horyzon:radar:recovery:active'; }

export function saveRecovery(storage: RecoveryStorage, envelope: RadarRecoveryEnvelope): void {
  storage.setItem(recoveryStorageKey(envelope.assessmentId), JSON.stringify(envelope));
  storage.setItem(activeRecoveryStorageKey(), envelope.assessmentId);
}

export function loadActiveRecovery(storage: RecoveryStorage, questionnaireVersion: string): RadarRecoveryEnvelope | null {
  const assessmentId = storage.getItem(activeRecoveryStorageKey());
  if (!assessmentId) return null;
  try {
    const raw = storage.getItem(recoveryStorageKey(assessmentId));
    if (!raw) return null;
    const envelope = JSON.parse(raw) as RadarRecoveryEnvelope;
    return shouldRestoreRecovery(envelope, { assessmentId, questionnaireVersion }) ? envelope : null;
  } catch {
    return null;
  }
}

export function clearRecovery(storage: RecoveryStorage, assessmentId: string): void {
  storage.removeItem(recoveryStorageKey(assessmentId));
  if (storage.getItem(activeRecoveryStorageKey()) === assessmentId) storage.removeItem(activeRecoveryStorageKey());
}

export function shouldRestoreRecovery(envelope: RadarRecoveryEnvelope, current: { assessmentId: string; questionnaireVersion: string }): boolean {
  return envelope.version === 1 && envelope.assessmentId === current.assessmentId && envelope.questionnaireVersion === current.questionnaireVersion;
}
