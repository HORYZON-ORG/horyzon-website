export type Annunci10xAnalysisStage =
  | 'SOURCE_VALIDATION'
  | 'PRECHECK'
  | 'EXTRACT'
  | 'PROFILE'
  | 'STRATEGY'
  | 'EVALUATE'
  | 'CLARIFY'
  | 'COMPLETE';

export type Annunci10xAnalysisStatus = 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED';

export const ANNUNCI10X_LOADER_LOGO_PATH = '/annunci-10x/horyzon-loader-logo.png';

export const ANNUNCI10X_ANALYSIS_STAGE_PROGRESS: Record<Annunci10xAnalysisStage, number> = {
  SOURCE_VALIDATION: 10,
  PRECHECK: 18,
  EXTRACT: 30,
  PROFILE: 45,
  STRATEGY: 62,
  EVALUATE: 82,
  CLARIFY: 94,
  COMPLETE: 100,
};

const ANNUNCI10X_ANALYSIS_STAGE_LABELS: Record<Annunci10xAnalysisStage, string> = {
  SOURCE_VALIDATION: "Leggiamo l'annuncio",
  PRECHECK: "Controlliamo i dati disponibili",
  EXTRACT: "Isoliamo le informazioni utili",
  PROFILE: "Ricostruiamo il ruolo",
  STRATEGY: "Mettiamo a fuoco la promessa di lavoro",
  EVALUATE: "Applichiamo i 20 controlli",
  CLARIFY: "Prepariamo il risultato",
  COMPLETE: "Analisi completata",
};

export function clampAnnunci10xProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function annunci10xProgressForAnalysisStage({
  stage,
  status,
  previous = 0,
}: {
  stage?: Annunci10xAnalysisStage;
  status?: Annunci10xAnalysisStatus;
  previous?: number;
}): { progress: number; label: string; complete: boolean } {
  if (status === 'READY' || stage === 'COMPLETE') {
    return { progress: 100, label: ANNUNCI10X_ANALYSIS_STAGE_LABELS.COMPLETE, complete: true };
  }

  if (status === 'FAILED') {
    return { progress: clampAnnunci10xProgress(previous), label: 'Analisi non completata', complete: false };
  }

  const nextProgress = stage ? ANNUNCI10X_ANALYSIS_STAGE_PROGRESS[stage] : ANNUNCI10X_ANALYSIS_STAGE_PROGRESS.SOURCE_VALIDATION;
  const nextLabel = stage ? ANNUNCI10X_ANALYSIS_STAGE_LABELS[stage] : ANNUNCI10X_ANALYSIS_STAGE_LABELS.SOURCE_VALIDATION;

  return {
    progress: Math.max(clampAnnunci10xProgress(previous), nextProgress),
    label: nextLabel,
    complete: false,
  };
}
