import type { Annunci10xDecision, Annunci10xDecisionKey, Annunci10xDecisionReport, Annunci10xTruthLedger } from './types.ts';
import { compensationText, factValue, factsByCategory } from './ledger.ts';
import { hasUnknownText } from './text.ts';

export function runAnnunci10xPreflight(ledger: Annunci10xTruthLedger): Annunci10xDecisionReport['preflight'] {
  const roleCard = ledger.roleCard;
  const decisions: Record<Annunci10xDecisionKey, Annunci10xDecision> = {
    roleKnown: decideKnown(factValue(roleCard.title)),
    companyContextKnown: decideKnown(factValue(roleCard.attractionContext.companyDescription)),
    activitiesKnown: factsByCategory(ledger, 'ACTIVITY').some((fact) => fact.value.split(/\s+/).length >= 5) ? 'PASS' : 'FAIL',
    requirementsKnown: factsByCategory(ledger, 'REQUIREMENT_REQUIRED').length > 0 ? 'PASS' : 'FAIL',
    criticalContradictionsAbsent: 'PASS',
    compensationCoherent: decideCoherentCompensation(compensationText(roleCard)),
    contractCoherent: decideKnown(factValue(roleCard.attractionContext.contractType)),
    applicationKnown: decideKnown(factValue(roleCard.applicationInstructions)),
  };
  const reasons: string[] = [];
  if (decisions.roleKnown === 'FAIL') reasons.push('Ruolo non sufficientemente dichiarato.');
  if (decisions.activitiesKnown === 'FAIL') reasons.push('Attività o contributo principale troppo poveri per descrivere il lavoro.');
  if (decisions.requirementsKnown === 'FAIL') reasons.push('Requisiti indispensabili assenti o non distinguibili.');
  if (decisions.compensationCoherent === 'FAIL') reasons.push('Compenso incoerente o numericamente ambiguo.');
  if (decisions.contractCoherent === 'FAIL') reasons.push('Contratto assente o non coerente.');
  const blocking: Annunci10xDecisionKey[] = ['roleKnown', 'activitiesKnown', 'requirementsKnown', 'criticalContradictionsAbsent', 'compensationCoherent', 'contractCoherent'];
  const canGenerate = blocking.every((key) => decisions[key] !== 'FAIL');
  return { canGenerate, decisions, reasons };
}

function decideKnown(value: string): Annunci10xDecision {
  if (!value || hasUnknownText(value)) return 'FAIL';
  return 'PASS';
}

function decideCoherentCompensation(value: string): Annunci10xDecision {
  if (!value) return 'UNKNOWN';
  const normalized = value.replace(/[–—]/g, '-');
  const numbers = normalized.match(/\d[\d.,]*/g) ?? [];
  if (numbers.length === 1 && /-|range|tra|da/i.test(normalized)) return 'FAIL';
  return 'PASS';
}
