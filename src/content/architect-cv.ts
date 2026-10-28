// Regole CV condivise tra modulo e pagina (il server le ripete in src/lib/public-leads/architect-cv.ts).
export const ARCHITECT_CV_MAX_MB = 5;
/** Controllo lato browser (il server ripete tutto): solo PDF, massimo 5 MB. */
export function architectCvProblem(file: FormDataEntryValue | null): string | null {
  if (!(file instanceof File) || file.size === 0) return 'Allega il tuo curriculum in PDF.';
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return 'Il curriculum deve essere un file PDF.';
  if (file.size > ARCHITECT_CV_MAX_MB * 1024 * 1024) return `Il PDF supera i ${ARCHITECT_CV_MAX_MB} MB. Riducilo e riprova.`;
  return null;
}
