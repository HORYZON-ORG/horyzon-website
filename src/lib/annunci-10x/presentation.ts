import type { EvaluationCheck, PublicationGate } from './types.ts';

export type RoleContextMismatchStatus = 'MATCH' | 'POSSIBLE_MISMATCH' | 'UNKNOWN';
export type DisplayRoleSource = 'OBSERVED' | 'DECLARED_CONTEXT' | 'UNKNOWN';

export interface RoleContextMismatch {
  status: RoleContextMismatchStatus;
  declaredRole: string | null;
  observedRole: string | null;
  message: string | null;
  evidence: string[];
}

export interface RoleContextPresentation {
  displayTitle: string;
  displayTitleSource: DisplayRoleSource;
  observedTitle: string | null;
  declaredTitle: string | null;
  mismatch: RoleContextMismatch;
}

export interface PublicationCopy {
  label: string;
  description: string;
}

export function buildRoleContextPresentation(input: {
  declaredRole?: string | null;
  observedRole?: string | null;
}): RoleContextPresentation {
  const declaredRole = cleanRole(input.declaredRole);
  const observedRole = cleanRole(input.observedRole);
  const mismatch = detectRoleContextMismatch({ declaredRole, observedRole });

  if (observedRole) {
    return {
      displayTitle: observedRole,
      displayTitleSource: 'OBSERVED',
      observedTitle: observedRole,
      declaredTitle: declaredRole,
      mismatch,
    };
  }

  if (declaredRole) {
    return {
      displayTitle: declaredRole,
      displayTitleSource: 'DECLARED_CONTEXT',
      observedTitle: null,
      declaredTitle: declaredRole,
      mismatch,
    };
  }

  return {
    displayTitle: 'Ruolo da chiarire',
    displayTitleSource: 'UNKNOWN',
    observedTitle: null,
    declaredTitle: null,
    mismatch,
  };
}

export function detectRoleContextMismatch(input: {
  declaredRole?: string | null;
  observedRole?: string | null;
}): RoleContextMismatch {
  const declaredRole = cleanRole(input.declaredRole);
  const observedRole = cleanRole(input.observedRole);
  if (!declaredRole || !observedRole) return mismatch('UNKNOWN', declaredRole, observedRole, null, []);

  const declaredTokens = roleTokens(declaredRole);
  const observedTokens = roleTokens(observedRole);
  if (!declaredTokens.length || !observedTokens.length) return mismatch('UNKNOWN', declaredRole, observedRole, null, []);

  const declaredConcepts = expandRoleConcepts(declaredTokens);
  const observedConcepts = expandRoleConcepts(observedTokens);
  const overlap = declaredConcepts.filter((token) => observedConcepts.includes(token));
  if (overlap.length > 0) return mismatch('MATCH', declaredRole, observedRole, null, overlap);

  const message = `Nel campo Ruolo hai indicato "${declaredRole}", mentre l'annuncio sembra riferirsi a "${observedRole}". Verifica quale informazione è corretta.`;
  return mismatch('POSSIBLE_MISMATCH', declaredRole, observedRole, message, [
    `Ruolo dichiarato: ${declaredRole}`,
    `Ruolo osservato nell'annuncio: ${observedRole}`,
  ]);
}

export function deriveResultStrengths(checks: readonly EvaluationCheck[], limit = 4): string[] {
  return checks.filter((check) => check.status === 'PASS').slice(0, limit).map((check) => check.label);
}

export function deriveResultPriorities(checks: readonly EvaluationCheck[], limit = 3): string[] {
  const byStatus = (statuses: readonly EvaluationCheck['status'][]) => checks.filter((check) => statuses.includes(check.status));
  return [
    ...byStatus(['CONFLICT']),
    ...byStatus(['MISSING']),
    ...byStatus(['PARTIAL']),
    ...byStatus(['NOT_EVALUABLE']),
  ].slice(0, limit).map((check) => check.label);
}

export function priorityHeading(count: number): string {
  if (count <= 0) return 'Priorità';
  if (count === 1) return 'Priorità principale';
  return 'Priorità';
}

export function publicationCopy(status: PublicationGate['status'] | string): PublicationCopy {
  if (status === 'BLOCKED') {
    return {
      label: 'Blocco rilevato',
      description: "Correggi le criticità indicate prima di pubblicare l'annuncio.",
    };
  }
  if (status === 'NEEDS_VERIFICATION' || status === 'READY_WITH_WARNINGS') {
    return {
      label: 'Verifiche necessarie',
      description: 'Ci sono informazioni che devono essere confermate prima della pubblicazione.',
    };
  }
  return {
    label: 'Nessun blocco critico rilevato',
    description: "L'annuncio può comunque avere informazioni incomplete o aree da migliorare. Controlla Score e Priorità prima di pubblicarlo.",
  };
}

export function formatAnnunci10xScore(score: {
  value: number | null;
  interval?: { min: number; max: number };
}): string {
  if (typeof score.value === 'number') return `${formatDecimal(score.value)} / 100`;
  if (score.interval) return `${formatDecimal(score.interval.min)}–${formatDecimal(score.interval.max)} / 100`;
  return 'N/D';
}

export function formatCheckScore(score: number | null, maxScore: number): string {
  if (score === null) return 'N/D';
  return `${formatDecimal(score)}/${formatDecimal(maxScore)}`;
}

function mismatch(
  status: RoleContextMismatchStatus,
  declaredRole: string | null,
  observedRole: string | null,
  message: string | null,
  evidence: string[],
): RoleContextMismatch {
  return { status, declaredRole, observedRole, message, evidence };
}

function cleanRole(value: string | null | undefined): string | null {
  const cleaned = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!cleaned || /^n\/?d$/i.test(cleaned) || /da chiarire|unknown/i.test(cleaned)) return null;
  return cleaned;
}

function roleTokens(value: string): string[] {
  return normalize(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !GENERIC_ROLE_TOKENS.has(token));
}

function expandRoleConcepts(tokens: string[]): string[] {
  const concepts = new Set<string>();
  for (const token of tokens) {
    concepts.add(token);
    const aliases = ROLE_TOKEN_ALIASES[token];
    if (aliases) for (const alias of aliases) concepts.add(alias);
  }
  return [...concepts].sort();
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function formatDecimal(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace('.', ',');
}

const GENERIC_ROLE_TOKENS = new Set([
  'addetto',
  'addetta',
  'assistant',
  'figura',
  'impiegato',
  'impiegata',
  'junior',
  'manager',
  'operatore',
  'operatrice',
  'persona',
  'responsabile',
  'ruolo',
  'senior',
  'specialist',
  'specialista',
]);

const ROLE_TOKEN_ALIASES: Record<string, string[]> = {
  care: ['assistenza', 'supporto'],
  commerciale: ['sales', 'vendite'],
  sales: ['commerciale', 'vendite'],
  supporto: ['assistenza', 'care'],
  vendite: ['commerciale', 'sales'],
};
