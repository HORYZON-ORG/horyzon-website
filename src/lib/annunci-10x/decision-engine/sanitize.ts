import type { GeneratedAd, GeneratedSection } from '../types.ts';
import { factValue } from './ledger.ts';
import type { Annunci10xTruthLedger } from './types.ts';

const GENERIC_APPLICATION_CTA = 'Se questa posizione ti interessa, inviaci la tua candidatura.';

const INTERNAL_TITLE_REWRITES = new Map<string, string>([
  ['attivita confermate', 'Cosa farai'],
  ['attivita tipiche incluse nel ruolo', 'Cosa farai'],
  ['requisiti obbligatori', 'Cosa serve'],
  ['requisiti principali', 'Cosa serve'],
  ['requisiti principali obbligatori', 'Cosa serve'],
  ['indispensabili', 'Cosa serve'],
  ['requisiti preferenziali', 'Cosa e gradito'],
  ['requisiti preferiti', 'Cosa e gradito'],
  ['preferenziali', 'Cosa e gradito'],
  ['condizioni confermate', 'Condizioni'],
  ['candidatura', 'Candidatura'],
  ['autonomia', 'Come lavorerai'],
  ['imprevisti e variabilita', 'Nel lavoro quotidiano'],
  ['obiettivo del ruolo', 'Il ruolo'],
]);

const INTERNAL_DROP_TITLE_MARKERS = [
  'vincoli',
  'vincoli interni',
  'apprendibili',
  'apprendibili internamente',
  'elementi apprendibili in sede',
  'trainabile',
  'formabili in sede',
  'do not invent',
  'do_not_invent',
];

const INTERNAL_LINE_PATTERNS = [
  /\bDO[_\s-]?NOT[_\s-]?INVENT\b/i,
  /\b(?:non\s+inventare|non\s+dichiarare)\b/i,
  /\b(?:truth ledger|rolecard|base ad|decision engine|sourcefactids|source fact ids|evidencerefs|evidence refs|fact ids?)\b/i,
  /\bF\d{2,}\b\s*[:=-]/i,
];

const MISSING_DATA_DISCLOSURE_PATTERN = /\b(?:non\s+(?:sono\s+stat[ei]\s+)?dichiarat[oaie]|non\s+(?:sono\s+stat[ei]\s+|vengono\s+|sono\s+)?indicat[oaie]|non\s+abbiamo\s+informazioni|non\s+[eè]\s+specificat[oaie]|non\s+(?:sono\s+)?disponibil[ei]|non\s+sono\s+disponibili\s+dettagli|nessuna?\s+informazione\s+fornit[aoie])\b/i;

export function sanitizeAnnunci10xCandidateMaster(master: GeneratedAd, ledger: Annunci10xTruthLedger): GeneratedAd {
  const stripListMarkers = hasNarrativeBodyProse(master);
  const sections = master.sections
    .map((section) => sanitizeSection(section, ledger, stripListMarkers))
    .filter((section): section is GeneratedSection => {
      if (section.type === 'TITLE') return Boolean(section.title.trim() || section.body.trim());
      return Boolean(section.title.trim() || section.body.trim());
    });
  return { ...master, sections };
}

function sanitizeSection(section: GeneratedSection, ledger: Annunci10xTruthLedger, stripListMarkers: boolean): GeneratedSection {
  const normalizedTitle = normalizeMarker(section.title);
  const dropWholeSection = INTERNAL_DROP_TITLE_MARKERS.includes(normalizedTitle);
  if (dropWholeSection) return { ...section, title: '', body: '' };

  const title = INTERNAL_TITLE_REWRITES.get(normalizedTitle) ?? section.title;
  const genericApplication = section.type === 'APPLICATION'
    && !hasSpecificApplicationInstruction(factValue(ledger.roleCard.applicationInstructions));
  const body = genericApplication
    ? GENERIC_APPLICATION_CTA
    : sanitizeCandidateText(section.body, ledger, stripListMarkers);
  return { ...section, title, body };
}

function sanitizeCandidateText(value: string, ledger: Annunci10xTruthLedger, stripListMarkers: boolean): string {
  const lines = value
    .split(/\r?\n/)
    .flatMap((line) => sanitizeLine(line, ledger, stripListMarkers))
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sanitizeLine(line: string, ledger: Annunci10xTruthLedger, stripListMarkers: boolean): string[] {
  const trimmed = line.trim();
  if (!trimmed) return [];
  if (INTERNAL_LINE_PATTERNS.some((pattern) => pattern.test(trimmed))) return [];
  if (MISSING_DATA_DISCLOSURE_PATTERN.test(trimmed)) return [];

  const isListItem = /^\s*[-•]\s+/.test(trimmed);
  const headingOnly = normalizeMarker(trimmed.replace(/[:：]+$/g, ''));
  if (!isListItem && INTERNAL_DROP_TITLE_MARKERS.includes(headingOnly)) return [];
  if (!isListItem && INTERNAL_TITLE_REWRITES.has(headingOnly) && isBodyHeadingMarker(trimmed)) return [];

  const candidateLine = stripListMarkers ? trimmed.replace(/^\s*[-•]\s+/, '').trim() : trimmed;
  const prefixed = stripOrRewriteInternalPrefix(candidateLine);
  if (!prefixed) return [];

  return [sanitizeApplicationPlaceholder(prefixed, ledger)];
}

function isBodyHeadingMarker(value: string): boolean {
  const trimmed = value.trim();
  if (/[:：]$/.test(trimmed)) return true;
  const letters = trimmed.replace(/[^A-ZÀ-Ùa-zà-ù]/g, '');
  if (!letters) return false;
  const upperLetters = trimmed.replace(/[^A-ZÀ-Ù]/g, '');
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  return wordCount > 1 && upperLetters.length / letters.length >= 0.75;
}

function hasNarrativeBodyProse(master: GeneratedAd): boolean {
  return master.sections
    .flatMap((section) => section.body.split(/\r?\n/))
    .map((line) => line.trim())
    .some((line) => line.length >= 80
      && !/^\s*[-•]\s+/.test(line)
      && !INTERNAL_LINE_PATTERNS.some((pattern) => pattern.test(line))
      && !MISSING_DATA_DISCLOSURE_PATTERN.test(line));
}

function stripOrRewriteInternalPrefix(value: string): string {
  const match = value.match(/^([A-ZÀ-Ùa-zà-ù\s()/_-]{3,48})\s*:\s*(.+)$/);
  if (!match) return value;

  const label = normalizeMarker(match[1] ?? '');
  const content = (match[2] ?? '').trim();
  if (!content) return '';
  if (INTERNAL_DROP_TITLE_MARKERS.includes(label)) return '';

  if (label === 'indispensabili' || label === 'requisiti obbligatori' || label === 'requisiti principali' || label === 'requisiti principali obbligatori') {
    return `Sono richiesti: ${content}`;
  }
  if (label === 'preferenziali' || label === 'requisiti preferenziali' || label === 'requisiti preferiti') {
    return `Sono graditi, ma non obbligatori: ${content}`;
  }
  if (label === 'autonomia' || label === 'imprevisti e variabilita' || label === 'obiettivo del ruolo') {
    return content;
  }
  if (label === 'attivita confermate' || label === 'attivita tipiche incluse nel ruolo') {
    return content;
  }
  if (label === 'candidatura') {
    return content;
  }

  return value;
}

function sanitizeApplicationPlaceholder(value: string, ledger: Annunci10xTruthLedger): string {
  if (hasSpecificApplicationInstruction(factValue(ledger.roleCard.applicationInstructions))) return value;
  if (/\b(?:candidatura|candidati|per candidarti|utilizza|usa).{0,80}\b(?:canale dell['’]?\s*annuncio|canale indicato nell['’]?\s*annuncio|tramite il canale(?: indicato)?)\b/i.test(value)) {
    return GENERIC_APPLICATION_CTA;
  }
  return value
    .replace(/\b(?:candidatura\s+)?tramite\s+il\s+canale\s+dell['’]?\s*annuncio\b\.?/gi, GENERIC_APPLICATION_CTA)
    .replace(/\bcandidati\s+tramite\s+il\s+canale\s+dell['’]?\s*annuncio\b\.?/gi, GENERIC_APPLICATION_CTA)
    .replace(/\bcanale\s+indicato\s+nell['’]?\s*annuncio\b/gi, 'candidatura');
}

function hasSpecificApplicationInstruction(value: string): boolean {
  const normalized = normalizeMarker(value);
  if (!normalized) return false;
  if (/^(?:candidatura\s+)?tramite il canale(?: dell annuncio)?(?:\b|[,.;])/.test(normalized)) return false;
  return /@|https?:\/\/|www\.|\blinkedin\b|\bform\b|\bcv\b|\bcurriculum\b|\boggetto\b|\bemail\b|\bmail\b|\blettera\b|\bdocument[oi]\b/.test(value.toLowerCase());
}

function normalizeMarker(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/[_/-]+/g, ' ')
    .replace(/[()]/g, ' ')
    .replace(/[^a-z0-9\s']/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\bobbligatori\b/g, 'obbligatori');
}
