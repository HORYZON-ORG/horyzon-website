import type { PublicationGate, PublicationGateCode, PublicationStatus } from './types.ts';

export type GateSeverity = 'BLOCKING' | 'WARNING';

export interface GateFinding {
  code: Exclude<PublicationGateCode, 'NO_BLOCKERS' | 'LOW_COVERAGE'>;
  severity: GateSeverity;
  message: string;
}

export interface PublicationGateInput {
  findings?: readonly GateFinding[];
  evaluatedAt?: string;
}

export const ANNUNCI10X_GATE_RULES = {
  G1: {
    code: 'MATERIAL_CONFLICT',
    label: 'Contraddizione materiale su condizioni o fatti centrali.',
  },
  G2: {
    code: 'UNCONFIRMED_CLAIM',
    label: 'Claim fattuale non supportato o non confermato.',
  },
  G3: {
    code: 'CRITICAL_MISSING_DATA',
    label: 'Informazione critica ancora mancante.',
  },
  G4: {
    code: 'INVALID_CTA',
    label: 'Candidatura non comprensibile o non utilizzabile.',
  },
  G5: {
    code: 'CHANNEL_INCONSISTENCY',
    label: 'Divergenza tra testo, campi, destinazione o variante.',
  },
} as const;

export function evaluatePublicationGate(input: PublicationGateInput = {}): PublicationGate {
  const findings = input.findings ?? [];
  const blocking = findings.filter((finding) => finding.severity === 'BLOCKING');
  const warnings = findings.filter((finding) => finding.severity === 'WARNING');
  const status: PublicationStatus = blocking.length ? 'BLOCKED' : warnings.length ? 'NEEDS_VERIFICATION' : 'READY';

  return {
    status,
    codes: findings.length ? unique(findings.map((finding) => finding.code)) : ['NO_BLOCKERS'],
    blockingReasons: blocking.map((finding) => finding.message),
    warnings: warnings.map((finding) => finding.message),
    evaluatedAt: input.evaluatedAt ?? new Date().toISOString(),
  };
}

export function materialConflict(message: string, severity: GateSeverity = 'BLOCKING'): GateFinding {
  return { code: 'MATERIAL_CONFLICT', severity, message };
}

export function unconfirmedClaim(message: string, severity: GateSeverity = 'BLOCKING'): GateFinding {
  return { code: 'UNCONFIRMED_CLAIM', severity, message };
}

export function criticalMissingData(message: string, severity: GateSeverity = 'BLOCKING'): GateFinding {
  return { code: 'CRITICAL_MISSING_DATA', severity, message };
}

export function invalidCta(message: string, severity: GateSeverity = 'BLOCKING'): GateFinding {
  return { code: 'INVALID_CTA', severity, message };
}

export function channelInconsistency(message: string, severity: GateSeverity = 'BLOCKING'): GateFinding {
  return { code: 'CHANNEL_INCONSISTENCY', severity, message };
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}
