import type { PersistedAnswer } from './persistence/types.ts';
import type { RoleCard } from './types.ts';

export type CreateConflictStepId =
  | 'ROLE_CONTEXT'
  | 'PRIMARY_CONTRIBUTION'
  | 'WORK_REALITY'
  | 'REQUIREMENTS'
  | 'ATTRACTION'
  | 'OFFER'
  | 'CHANNEL_APPLICATION';

export interface PublicCreateConflict {
  id: string;
  targetPath: string;
  label: string;
  canonicalValue: string;
  conflictingValue: string;
  sourceStep: CreateConflictStepId;
  sourceLabel: string;
  resolution: string;
}

const STEP_BY_QUESTION: Record<string, CreateConflictStepId> = {
  'create.role_context': 'ROLE_CONTEXT',
  'create.primary_contribution': 'PRIMARY_CONTRIBUTION',
  'create.work_reality': 'WORK_REALITY',
  'create.requirements': 'REQUIREMENTS',
  'create.attraction': 'ATTRACTION',
  'create.offer': 'OFFER',
  'create.channel_application': 'CHANNEL_APPLICATION',
};

const STEP_LABEL: Record<CreateConflictStepId, string> = {
  ROLE_CONTEXT: 'Ruolo e azienda',
  PRIMARY_CONTRIBUTION: 'Risultato principale',
  WORK_REALITY: 'Lavoro reale',
  REQUIREMENTS: 'Requisiti',
  ATTRACTION: 'Benefit e formazione',
  OFFER: 'Condizioni',
  CHANNEL_APPLICATION: 'Candidatura',
};

type ConflictKind = 'LOCATION' | 'WORK_MODE' | 'CONTRACT' | 'SCHEDULE' | 'POLARITY' | 'COMPENSATION' | 'APPLICATION';

export function deriveCreateConflicts(answers: PersistedAnswer[], roleCard: RoleCard): PublicCreateConflict[] {
  const result: PublicCreateConflict[] = [];
  const latest = latestAnswers(answers);

  for (const answer of latest) {
    const step = STEP_BY_QUESTION[answer.questionId];
    if (!step) continue;

    if (step !== 'OFFER') {
      pushConflict(result, 'attractionContext.location', 'Sede', valueOf(roleCard.attractionContext.location), extractLocation(answer.rawAnswer), step, 'LOCATION');
      pushConflict(result, 'attractionContext.workMode', 'Modalità di lavoro', valueOf(roleCard.attractionContext.workModeDetail ?? roleCard.attractionContext.workMode), extractWorkMode(answer.rawAnswer), step, 'WORK_MODE');
      pushConflict(result, 'attractionContext.contractType', 'Contratto', valueOf(roleCard.attractionContext.contractType), extractContract(answer.rawAnswer), step, 'CONTRACT');
      pushConflict(result, 'attractionContext.schedule', 'Orario', valueOf(roleCard.attractionContext.schedule), extractSchedule(answer.rawAnswer), step, 'SCHEDULE');
      pushConflict(result, 'attractionContext.shifts', 'Turni', valueOf(roleCard.attractionContext.shifts), extractShifts(answer.rawAnswer), step, 'POLARITY');
      pushConflict(result, 'attractionContext.onCall', 'Reperibilità', valueOf(roleCard.attractionContext.onCall), extractOnCall(answer.rawAnswer), step, 'POLARITY');
      pushConflict(result, 'compensation.amountText', 'Retribuzione', valueOf(roleCard.compensation?.amountText), extractCompensation(answer.rawAnswer), step, 'COMPENSATION');
    }

    if (step !== 'CHANNEL_APPLICATION') {
      pushConflict(result, 'applicationInstructions', 'Candidatura', valueOf(roleCard.applicationInstructions), extractApplication(answer.rawAnswer), step, 'APPLICATION');
    }
  }

  const unique = new Map<string, PublicCreateConflict>();
  for (const conflict of result) {
    const key = conflict.targetPath + '|' + normalize(conflict.conflictingValue) + '|' + conflict.sourceStep;
    unique.set(key, conflict);
  }
  return Array.from(unique.values());
}

function latestAnswers(answers: PersistedAnswer[]): PersistedAnswer[] {
  const latest = new Map<string, PersistedAnswer>();
  for (const answer of answers) latest.set(answer.questionId, answer);
  return Array.from(latest.values());
}

function pushConflict(
  target: PublicCreateConflict[],
  targetPath: string,
  label: string,
  canonicalValue: string,
  conflictingValue: string,
  sourceStep: CreateConflictStepId,
  kind: ConflictKind,
): void {
  if (!canonicalValue || !conflictingValue) return;
  if (!valuesConflict(canonicalValue, conflictingValue, kind)) return;

  target.push({
    id: slug(targetPath) + '-' + sourceStep.toLowerCase(),
    targetPath,
    label,
    canonicalValue,
    conflictingValue,
    sourceStep,
    sourceLabel: STEP_LABEL[sourceStep],
    resolution: 'Abbiamo mantenuto "' + canonicalValue + '" perché il campo "' + label + '" è la fonte canonica per questo dato.',
  });
}

function valueOf(fact: { value?: unknown } | undefined): string {
  if (fact?.value == null) return '';
  const value = String(fact.value).trim();
  return /^(?:n\/d|da definire|da chiarire|open_decision)$/i.test(value) ? '' : value;
}

function extractLocation(text: string): string {
  const labeled = text.match(/(?:^|[\n.;])\s*(?:sede|localita|località|zona)\s*[:\-]\s*([^\n.;]{2,80})/i);
  if (labeled?.[1]) return clean(labeled[1]);
  const mention = text.match(/\bsede\s+(?:a|di)\s+([^\n.;]{2,80}?)(?=\s+(?:e\s+)?(?:RAL|compenso|retribuzione|stipendio)\b|[\n.;]|$)/i);
  return clean(mention?.[1]);
}

function extractWorkMode(text: string): string {
  const labeled = text.match(/(?:^|[\n.;])\s*(?:modalita|modalità)(?:\s+di\s+lavoro)?\s*[:\-]\s*([^\n.;]{2,100})/i);
  if (labeled?.[1]) return clean(labeled[1]);
  const mention = text.match(/\b(in presenza|in sede|ibrid[oa]|da remoto|remoto|smart working)\b/i);
  return clean(mention?.[1]);
}

function extractContract(text: string): string {
  const labeled = text.match(/(?:^|[\n.;])\s*contratto\s*[:\-]\s*([^\n.;]{2,100})/i);
  if (labeled?.[1]) return clean(labeled[1]);
  const mention = text.match(/\b(tempo indeterminato|tempo determinato|apprendistato|stage|tirocinio|collaborazione)\b/i);
  return clean(mention?.[1]);
}

function extractSchedule(text: string): string {
  const labeled = text.match(/(?:^|[\n.;])\s*orario\s*[:\-]\s*([^\n.;]{2,120})/i);
  if (labeled?.[1]) return clean(labeled[1]);
  const mention = text.match(/\b(?:lunedi|lunedì|martedi|martedì|mercoledi|mercoledì|giovedi|giovedì|venerdi|venerdì|sabato|domenica)[^\n.;]{0,80}\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}/i);
  return clean(mention?.[0]);
}

function extractShifts(text: string): string {
  const match = text.match(/(?:^|[\n.;])\s*turni\s*[:\-]\s*([^\n.;]{2,120})/i);
  return clean(match?.[1]);
}

function extractOnCall(text: string): string {
  const match = text.match(/(?:^|[\n.;])\s*reperibilit(?:a|à)\s*[:\-]\s*([^\n.;]{2,120})/i);
  return clean(match?.[1]);
}

function extractCompensation(text: string): string {
  const ral = text.match(/\bRAL\s*[:\-]?\s*(\d[\d.,]*(?:\s*[-–]\s*\d[\d.,]*)?(?:\s*(?:EUR|euro|€))?)/i);
  if (ral?.[1]) return clean('RAL ' + ral[1]);
  const labeled = text.match(/(?:^|[\n.;])\s*(?:compenso|stipendio|retribuzione)\s*[:\-]\s*([^\n.;]{1,90})/i);
  return clean(labeled?.[1]);
}

function extractApplication(text: string): string {
  return clean(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]);
}

function valuesConflict(canonical: string, alternative: string, kind: ConflictKind): boolean {
  if (kind === 'LOCATION') return locationConflict(canonical, alternative);
  if (kind === 'WORK_MODE') return workModeConflict(canonical, alternative);
  if (kind === 'CONTRACT') return contractConflict(canonical, alternative);
  if (kind === 'SCHEDULE') return scheduleConflict(canonical, alternative);
  if (kind === 'POLARITY') return polarityConflict(canonical, alternative);
  if (kind === 'COMPENSATION') return compensationConflict(canonical, alternative);
  return applicationConflict(canonical, alternative);
}

function locationConflict(canonical: string, alternative: string): boolean {
  const left = words(canonical).filter((word) => word !== 'sede' && word !== 'zona');
  const right = words(alternative).filter((word) => word !== 'sede' && word !== 'zona');
  if (!left.length || !right.length) return !looselyEqual(canonical, alternative);
  return !left.some((word) => right.includes(word));
}

function workModeConflict(canonical: string, alternative: string): boolean {
  const left = workModeCategory(canonical);
  const right = workModeCategory(alternative);
  return left !== 'UNKNOWN' && right !== 'UNKNOWN' ? left !== right : !looselyEqual(canonical, alternative);
}

function contractConflict(canonical: string, alternative: string): boolean {
  const left = contractCategory(canonical);
  const right = contractCategory(alternative);
  return left !== 'UNKNOWN' && right !== 'UNKNOWN' && left !== right;
}

function scheduleConflict(canonical: string, alternative: string): boolean {
  const left: string[] = canonical.match(/\b\d{1,2}(?::\d{2})\b/g) ?? [];
  const right: string[] = alternative.match(/\b\d{1,2}(?::\d{2})\b/g) ?? [];
  return left.length >= 2 && right.length >= 2 && right.some((value) => !left.includes(value));
}

function polarityConflict(canonical: string, alternative: string): boolean {
  return isNegative(canonical) !== isNegative(alternative);
}

function compensationConflict(canonical: string, alternative: string): boolean {
  const left = numbers(canonical);
  const right = numbers(alternative);
  if (left.length && right.length) return right.some((value) => !left.includes(value));
  return !looselyEqual(canonical, alternative);
}

function applicationConflict(canonical: string, alternative: string): boolean {
  const left = canonical.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase();
  const right = alternative.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase();
  return Boolean(left && right && left !== right);
}

function workModeCategory(value: string): 'HYBRID' | 'REMOTE' | 'ONSITE' | 'UNKNOWN' {
  if (/ibrid/i.test(value)) return 'HYBRID';
  if (/remot|smart working/i.test(value) && !/presenza|in sede/i.test(value)) return 'REMOTE';
  if (/presenza|in sede/i.test(value) && !/remot|smart working/i.test(value)) return 'ONSITE';
  return 'UNKNOWN';
}

function contractCategory(value: string): string {
  const normalized = normalize(value);
  if (normalized.includes('tempo indeterminato')) return 'INDETERMINATO';
  if (normalized.includes('tempo determinato')) return 'DETERMINATO';
  if (normalized.includes('apprendistato')) return 'APPRENDISTATO';
  if (normalized.includes('stage') || normalized.includes('tirocinio')) return 'STAGE';
  if (normalized.includes('collaborazione')) return 'COLLABORAZIONE';
  return 'UNKNOWN';
}

function numbers(value: string): number[] {
  const result: number[] = [];
  for (const match of value.matchAll(/\b(\d{1,3}(?:[.,]\d{3})+|\d+)(\s*k)?\b/gi)) {
    const parsed = Number(match[1].replace(/[.,](?=\d{3}\b)/g, ''));
    if (Number.isFinite(parsed)) result.push(match[2] ? parsed * 1000 : parsed);
  }
  return result;
}

function words(value: string): string[] {
  return normalize(value).split(' ').filter((word) => word.length >= 3);
}

function isNegative(value: string): boolean {
  return /\b(?:non|nessun|nessuna|senza)\b/i.test(value);
}

function looselyEqual(left: string, right: string): boolean {
  const a = normalize(left);
  const b = normalize(right);
  return a === b || a.includes(b) || b.includes(a);
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9@.]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function clean(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().replace(/[;:,.]+$/, '');
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
