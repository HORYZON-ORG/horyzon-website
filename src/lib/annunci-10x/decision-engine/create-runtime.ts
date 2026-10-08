import type { GeneratedAd, GeneratedSection, RoleCard } from '../types.ts';
import { buildAnnunci10xBaseAd } from './base-ad.ts';
import { runAnnunci10xHardFactsCheck } from './check.ts';
import { createAnnunci10xTruthLedger } from './ledger.ts';
import { runAnnunci10xPreflight } from './preflight.ts';
import { sanitizeAnnunci10xCandidateMaster } from './sanitize.ts';
import { normalizeForDecision } from './text.ts';
import type {
  Annunci10xBaseAd,
  Annunci10xClientRevisionStatus,
  Annunci10xCreateRuntimeStatus,
  Annunci10xDecisionReport,
  Annunci10xRepairRequest,
  Annunci10xTruthLedger,
} from './types.ts';

export interface Annunci10xDecisionEngineWriterInput {
  roleCard: RoleCard;
  truthLedger: Annunci10xTruthLedger;
  baseAd: Annunci10xBaseAd;
  factualConstraints: string[];
}

export interface Annunci10xDecisionEngineRepairInput extends Annunci10xDecisionEngineWriterInput {
  repairRequest: Annunci10xRepairRequest;
}

export interface Annunci10xDecisionEngineWriterResult {
  master: GeneratedAd;
  providerCallCount?: 0 | 1 | 2;
}

export interface Annunci10xDecisionEngineWriter {
  generate(input: Annunci10xDecisionEngineWriterInput): Promise<Annunci10xDecisionEngineWriterResult>;
  repair?(input: Annunci10xDecisionEngineRepairInput): Promise<Annunci10xDecisionEngineWriterResult>;
}

export interface Annunci10xDecisionEngineCreateRuntimeInput {
  roleCard: RoleCard;
  writer: Annunci10xDecisionEngineWriter;
}

export interface Annunci10xDecisionEngineCreateRuntimeResult {
  status: Annunci10xCreateRuntimeStatus;
  truthLedger: Annunci10xTruthLedger;
  baseAd: Annunci10xBaseAd;
  preflight: Annunci10xDecisionReport['preflight'];
  initialMaster: GeneratedAd | null;
  sanitizedInitialMaster: GeneratedAd | null;
  initialDecisionReport: Annunci10xDecisionReport;
  repairRequest: Annunci10xRepairRequest | null;
  repairResult: GeneratedAd | null;
  sanitizedRepairResult: GeneratedAd | null;
  finalMaster: GeneratedAd | null;
  finalDecisionReport: Annunci10xDecisionReport;
  automaticRevisionCount: 0 | 1;
  providerCallCount: 0 | 1 | 2;
  unknowns: string[];
  blockedReason: string | null;
}

export interface Annunci10xClientRevisionInput {
  master: GeneratedAd;
  roleCard: RoleCard;
  revisionCount: number;
  targetSectionId: string;
  userInstruction: string;
  reviseSection: (input: {
    previousSection: GeneratedSection;
    userInstruction: string;
    revisionNumber: number;
    truthLedger: Annunci10xTruthLedger;
  }) => Promise<GeneratedSection>;
}

export interface Annunci10xClientRevisionResult {
  status: Annunci10xClientRevisionStatus;
  revisionCount: number;
  revisionNumber: number | null;
  targetSection: string | null;
  previousText: string | null;
  newText: string | null;
  master: GeneratedAd;
  decisionReport: Annunci10xDecisionReport | null;
}

export async function runAnnunci10xDecisionEngineCreateRuntime(
  input: Annunci10xDecisionEngineCreateRuntimeInput,
): Promise<Annunci10xDecisionEngineCreateRuntimeResult> {
  const truthLedger = createAnnunci10xTruthLedger(input.roleCard);
  const baseAd = buildAnnunci10xBaseAd(truthLedger);
  const preflight = runAnnunci10xPreflight(truthLedger);
  const factualConstraints = factualConstraintsForWriter(truthLedger, baseAd);
  const preflightReport = reportFromPreflight(truthLedger, preflight);

  if (!preflight.canGenerate) {
    return {
      status: 'BLOCK',
      truthLedger,
      baseAd,
      preflight,
      initialMaster: null,
      sanitizedInitialMaster: null,
      initialDecisionReport: preflightReport,
      repairRequest: null,
      repairResult: null,
      sanitizedRepairResult: null,
      finalMaster: null,
      finalDecisionReport: preflightReport,
      automaticRevisionCount: 0,
      providerCallCount: 0,
      unknowns: preflightReport.unknowns,
      blockedReason: preflight.reasons.join(' ') || 'Decision Engine preflight blocked generation.',
    };
  }

  const generated = await input.writer.generate({ roleCard: input.roleCard, truthLedger, baseAd, factualConstraints });
  const sanitizedInitialMaster = sanitizeAnnunci10xCandidateMaster(generated.master, truthLedger);
  const initialDecisionReport = runAnnunci10xHardFactsCheck(truthLedger, masterText(sanitizedInitialMaster));

  if (initialDecisionReport.final === 'PASS') {
    return readyResult({
      truthLedger,
      baseAd,
      preflight,
      initialMaster: generated.master,
      sanitizedInitialMaster,
      initialDecisionReport,
      finalMaster: sanitizedInitialMaster,
      providerCallCount: generated.providerCallCount ?? 1,
    });
  }

  if (initialDecisionReport.final === 'BLOCK' || !input.writer.repair) {
    return blockedResult({
      truthLedger,
      baseAd,
      preflight,
      initialMaster: generated.master,
      sanitizedInitialMaster,
      initialDecisionReport,
      finalDecisionReport: initialDecisionReport,
      providerCallCount: generated.providerCallCount ?? 1,
      blockedReason: initialDecisionReport.hardFailures.join('; ') || 'Decision Engine blocked generated master.',
    });
  }

  const repairRequest: Annunci10xRepairRequest = {
    currentMaster: masterText(sanitizedInitialMaster),
    hardFailures: initialDecisionReport.hardFailures,
    repairInstructions: repairInstructionsForDecision(truthLedger, masterText(sanitizedInitialMaster), initialDecisionReport),
    truthLedger,
    baseAd,
  };
  const repaired = await input.writer.repair({ roleCard: input.roleCard, truthLedger, baseAd, factualConstraints, repairRequest });
  const sanitizedRepairResult = sanitizeAnnunci10xCandidateMaster(repaired.master, truthLedger);
  const finalDecisionReport = runAnnunci10xHardFactsCheck(truthLedger, masterText(sanitizedRepairResult));

  if (finalDecisionReport.final === 'PASS') {
    return readyResult({
      truthLedger,
      baseAd,
      preflight,
      initialMaster: generated.master,
      sanitizedInitialMaster,
      initialDecisionReport,
      repairRequest,
      repairResult: repaired.master,
      sanitizedRepairResult,
      finalMaster: sanitizedRepairResult,
      providerCallCount: repaired.providerCallCount ?? 2,
    });
  }

  return blockedResult({
    truthLedger,
    baseAd,
    preflight,
    initialMaster: generated.master,
    sanitizedInitialMaster,
    initialDecisionReport,
    repairRequest,
    repairResult: repaired.master,
    sanitizedRepairResult,
    finalDecisionReport,
    providerCallCount: repaired.providerCallCount ?? 2,
    blockedReason: finalDecisionReport.hardFailures.join('; ') || 'Decision Engine repair did not clear hard factual issues.',
  });
}

export async function applyAnnunci10xClientRevision(input: Annunci10xClientRevisionInput): Promise<Annunci10xClientRevisionResult> {
  if (input.revisionCount >= 3) {
    return {
      status: 'REVISION_LIMIT_REACHED',
      revisionCount: input.revisionCount,
      revisionNumber: null,
      targetSection: null,
      previousText: null,
      newText: null,
      master: input.master,
      decisionReport: null,
    };
  }
  const previousSection = input.master.sections.find((section) => section.id === input.targetSectionId);
  if (!previousSection) {
    return {
      status: 'REVISION_BLOCKED',
      revisionCount: input.revisionCount,
      revisionNumber: null,
      targetSection: input.targetSectionId,
      previousText: null,
      newText: null,
      master: input.master,
      decisionReport: null,
    };
  }
  const revisionNumber = input.revisionCount + 1;
  const truthLedger = createAnnunci10xTruthLedger(input.roleCard);
  const revisedSection = await input.reviseSection({
    previousSection,
    userInstruction: input.userInstruction,
    revisionNumber,
    truthLedger,
  });
  if (normalizeForDecision(revisedSection.body) === normalizeForDecision(previousSection.body)) {
    return {
      status: 'REVISION_BLOCKED',
      revisionCount: input.revisionCount,
      revisionNumber,
      targetSection: previousSection.id,
      previousText: previousSection.body,
      newText: revisedSection.body,
      master: input.master,
      decisionReport: null,
    };
  }
  const candidate: GeneratedAd = {
    ...input.master,
    sections: input.master.sections.map((section) => (section.id === previousSection.id ? revisedSection : section)),
    generatedAt: new Date().toISOString(),
  };
  const decisionReport = runAnnunci10xHardFactsCheck(truthLedger, masterText(candidate));
  if (decisionReport.final !== 'PASS') {
    return {
      status: 'REVISION_BLOCKED',
      revisionCount: input.revisionCount,
      revisionNumber,
      targetSection: previousSection.id,
      previousText: previousSection.body,
      newText: revisedSection.body,
      master: input.master,
      decisionReport,
    };
  }
  return {
    status: 'REVISION_APPLIED',
    revisionCount: revisionNumber,
    revisionNumber,
    targetSection: previousSection.id,
    previousText: previousSection.body,
    newText: revisedSection.body,
    master: candidate,
    decisionReport,
  };
}

export function masterText(master: GeneratedAd): string {
  return master.sections
    .map((section) => [section.title, section.body].map((value) => value.trim()).filter(Boolean).join('\n'))
    .filter(Boolean)
    .join('\n\n');
}

function factualConstraintsForWriter(ledger: Annunci10xTruthLedger, baseAd: Annunci10xBaseAd): string[] {
  return [
    'Preserva la realta. Migliora la comunicazione.',
    'Sviluppa solo facts, parafrasi o spiegazioni semanticamente autorizzate dal Truth Ledger.',
    'Non completare il mondo attorno ai facts con processi, strumenti, condizioni, benefit, canali o conseguenze plausibili ma non dichiarati.',
    ...baseAd.internalBoundaries.map((fact) => fact.value),
    ...ledger.facts
      .filter((fact) => !fact.publishable && fact.category !== 'BOUNDARY')
      .map((fact) => `${fact.label}: ${fact.value}`),
  ].filter(Boolean);
}

function repairInstructionsForDecision(
  truthLedger: Annunci10xTruthLedger,
  currentMaster: string,
  decisionReport: Annunci10xDecisionReport,
): Annunci10xRepairRequest['repairInstructions'] {
  if (!decisionReport.violations.entityExpansion && !decisionReport.violations.numericDrift) return [];
  return [
    ...entityCanonicalizationInstructions(truthLedger, currentMaster),
    ...exactNumberCanonicalizationInstructions(truthLedger, currentMaster),
  ];
}

function entityCanonicalizationInstructions(
  truthLedger: Annunci10xTruthLedger,
  currentMaster: string,
): Annunci10xRepairRequest['repairInstructions'] {
  const instructions: Annunci10xRepairRequest['repairInstructions'] = [];
  const seen = new Set<string>();
  const teamPattern = /\b(?:(il|lo|la|i|gli|le|l['’])\s+)?team\s+di\s+([a-zà-ù]+(?:\s+(?!e\b|con\b|il\b|lo\b|la\b|i\b|gli\b|le\b)[a-zà-ù]+){0,2})\b/gi;
  for (const match of currentMaster.matchAll(teamPattern)) {
    const unsupportedText = (match[0] ?? '').trim();
    const scope = (match[2] ?? '').trim();
    const canonical = canonicalEntityForScope(truthLedger, scope);
    if (!unsupportedText || !canonical) continue;
    const canonicalText = withMatchingArticle(match[1], canonical);
    const key = `${normalizeForDecision(unsupportedText)}=>${normalizeForDecision(canonicalText)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    instructions.push({
      kind: 'ENTITY_CANONICALIZATION',
      unsupportedText,
      canonicalText,
      instruction: `Sostituisci "${unsupportedText}" con "${canonicalText}". Sostituisci l'astrazione non supportata con l'entita canonica gia dichiarata. Non modificare il resto della frase salvo necessita grammaticale.`,
    });
  }
  return instructions;
}

function canonicalEntityForScope(truthLedger: Annunci10xTruthLedger, scope: string): string | null {
  const normalizedScope = normalizeForDecision(scope);
  if (!normalizedScope) return null;
  const candidates = truthLedger.facts
    .filter((fact) => fact.publishable && fact.category !== 'BOUNDARY')
    .flatMap((fact) => extractCanonicalEntitiesForScope(fact.value, normalizedScope));
  return candidates[0] ?? null;
}

function exactNumberCanonicalizationInstructions(
  truthLedger: Annunci10xTruthLedger,
  currentMaster: string,
): Annunci10xRepairRequest['repairInstructions'] {
  const instructions: Annunci10xRepairRequest['repairInstructions'] = [];
  const seen = new Set<string>();
  const exactEntities = exactCountEntities(truthLedger);
  for (const entity of exactEntities) {
    const approximate = [
      new RegExp(`\\b(?:un\\s+)?team\\s+di\\s+circa\\s+${entity.count}\\s+${escapeRegExp(entity.noun)}\\b`, 'i'),
      new RegExp(`\\bcirca\\s+${entity.count}\\s+${escapeRegExp(entity.noun)}\\b`, 'i'),
      ...(entity.count === '12' ? [new RegExp(`\\b(?:un\\s+)?team\\s+di\\s+(?:una\\s+)?(?:decina|dozzina)\\s+di\\s+${escapeRegExp(entity.noun)}\\b`, 'i')] : []),
      ...(entity.count === '12' ? [new RegExp(`\\b(?:una\\s+)?(?:decina|dozzina)\\s+di\\s+${escapeRegExp(entity.noun)}\\b`, 'i')] : []),
    ];
    for (const pattern of approximate) {
      const match = currentMaster.match(pattern);
      const unsupportedText = match?.[0]?.trim();
      if (!unsupportedText) continue;
      const key = `${normalizeForDecision(unsupportedText)}=>${normalizeForDecision(entity.canonical)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      instructions.push({
        kind: 'EXACT_NUMBER_CANONICALIZATION',
        unsupportedText,
        canonicalText: entity.canonical,
        instruction: `Preserva esattamente il numero e la relazione canonica: la persona coordina ${entity.canonical}. Rimuovi categorie organizzative o approssimazioni non presenti nel Truth Ledger. Non modificare il resto del Master.`,
      });
    }
  }
  return instructions;
}

function exactCountEntities(truthLedger: Annunci10xTruthLedger): Array<{ count: string; noun: string; canonical: string }> {
  const entities: Array<{ count: string; noun: string; canonical: string }> = [];
  const seen = new Set<string>();
  const pattern = /\b(\d{1,3})\s+(operatori|operatrici|addetti|addette|sviluppatori|sviluppatrici|tecnici|tecniche|persone|risorse)\b/gi;
  for (const fact of truthLedger.facts.filter((item) => item.publishable && item.category !== 'COMPENSATION' && item.category !== 'BOUNDARY')) {
    const value = normalizeForDecision(fact.value);
    for (const match of value.matchAll(pattern)) {
      const count = match[1] ?? '';
      const noun = match[2] ?? '';
      const canonical = `${count} ${noun}`;
      const key = normalizeForDecision(canonical);
      if (isApproximateCount(value, match.index ?? 0)) continue;
      if (!count || !noun || seen.has(key)) continue;
      seen.add(key);
      entities.push({ count, noun, canonical });
    }
  }
  return entities;
}

function isApproximateCount(value: string, matchIndex: number): boolean {
  const prefix = value.slice(Math.max(0, matchIndex - 32), matchIndex);
  return /\b(?:circa|piu o meno|all'?incirca|approssimativamente)\s*$/.test(prefix);
}

function extractCanonicalEntitiesForScope(value: string, normalizedScope: string): string[] {
  const canonicalNouns = [
    'operatori',
    'operatrici',
    'addetti',
    'addette',
    'tecnici',
    'tecniche',
    'sviluppatori',
    'sviluppatrici',
    'responsabili',
    'uffici',
    'autisti',
    'clienti',
    'fornitori',
  ];
  const normalizedValue = normalizeForDecision(value);
  return canonicalNouns.flatMap((noun) => {
    const pattern = new RegExp(`\\b${noun}\\s+di\\s+${escapeRegExp(normalizedScope)}\\b`, 'i');
    const match = normalizedValue.match(pattern);
    return match?.[0] ? [match[0]] : [];
  });
}

function withMatchingArticle(article: string | undefined, canonical: string): string {
  if (!article) return canonical;
  if (/^(operatori|addetti|tecnici|sviluppatori|responsabili|uffici|autisti|clienti|fornitori)\b/i.test(canonical)) {
    return `gli ${canonical}`;
  }
  if (/^(operatrici|addette|tecniche|sviluppatrici)\b/i.test(canonical)) {
    return `le ${canonical}`;
  }
  return canonical;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readyResult(input: {
  truthLedger: Annunci10xTruthLedger;
  baseAd: Annunci10xBaseAd;
  preflight: Annunci10xDecisionReport['preflight'];
  initialMaster: GeneratedAd;
  sanitizedInitialMaster: GeneratedAd;
  initialDecisionReport: Annunci10xDecisionReport;
  repairRequest?: Annunci10xRepairRequest | null;
  repairResult?: GeneratedAd | null;
  sanitizedRepairResult?: GeneratedAd | null;
  finalMaster: GeneratedAd;
  providerCallCount: 0 | 1 | 2;
}): Annunci10xDecisionEngineCreateRuntimeResult {
  const finalDecisionReport = runAnnunci10xHardFactsCheck(input.truthLedger, masterText(input.finalMaster));
  return {
    status: 'READY_FOR_CLIENT',
    truthLedger: input.truthLedger,
    baseAd: input.baseAd,
    preflight: input.preflight,
    initialMaster: input.initialMaster,
    sanitizedInitialMaster: input.sanitizedInitialMaster,
    initialDecisionReport: input.initialDecisionReport,
    repairRequest: input.repairRequest ?? null,
    repairResult: input.repairResult ?? null,
    sanitizedRepairResult: input.sanitizedRepairResult ?? null,
    finalMaster: input.finalMaster,
    finalDecisionReport,
    automaticRevisionCount: input.providerCallCount === 2 ? 1 : 0,
    providerCallCount: input.providerCallCount,
    unknowns: finalDecisionReport.unknowns,
    blockedReason: null,
  };
}

function blockedResult(input: {
  truthLedger: Annunci10xTruthLedger;
  baseAd: Annunci10xBaseAd;
  preflight: Annunci10xDecisionReport['preflight'];
  initialMaster: GeneratedAd | null;
  sanitizedInitialMaster?: GeneratedAd | null;
  initialDecisionReport: Annunci10xDecisionReport;
  repairRequest?: Annunci10xRepairRequest | null;
  repairResult?: GeneratedAd | null;
  sanitizedRepairResult?: GeneratedAd | null;
  finalDecisionReport: Annunci10xDecisionReport;
  providerCallCount: 0 | 1 | 2;
  blockedReason: string;
}): Annunci10xDecisionEngineCreateRuntimeResult {
  return {
    status: 'BLOCK',
    truthLedger: input.truthLedger,
    baseAd: input.baseAd,
    preflight: input.preflight,
    initialMaster: input.initialMaster,
    sanitizedInitialMaster: input.sanitizedInitialMaster ?? null,
    initialDecisionReport: input.initialDecisionReport,
    repairRequest: input.repairRequest ?? null,
    repairResult: input.repairResult ?? null,
    sanitizedRepairResult: input.sanitizedRepairResult ?? null,
    finalMaster: null,
    finalDecisionReport: input.finalDecisionReport,
    automaticRevisionCount: input.providerCallCount === 2 ? 1 : 0,
    providerCallCount: input.providerCallCount,
    unknowns: input.finalDecisionReport.unknowns,
    blockedReason: input.blockedReason,
  };
}

function reportFromPreflight(
  ledger: Annunci10xTruthLedger,
  preflight: Annunci10xDecisionReport['preflight'],
): Annunci10xDecisionReport {
  return {
    preflight,
    preservation: {
      role: preflight.decisions.roleKnown,
      companyContext: preflight.decisions.companyContextKnown,
      location: 'UNKNOWN',
      workMode: 'UNKNOWN',
      schedule: 'UNKNOWN',
      contract: preflight.decisions.contractCoherent,
      compensation: preflight.decisions.compensationCoherent,
      experience: 'UNKNOWN',
      technologies: 'UNKNOWN',
      requiredRequirements: preflight.decisions.requirementsKnown,
      preferredRequirements: 'UNKNOWN',
      benefits: 'UNKNOWN',
      application: preflight.decisions.applicationKnown,
    },
    violations: {
      inventedBenefit: false,
      inventedTechnology: false,
      inventedApplicationProcess: false,
      requirementPromotion: false,
      preferredConsequence: false,
      trainablePromise: false,
      missingDataDisclosure: false,
      internalStructureLeak: false,
      mechanicalApplicationPlaceholder: false,
      conditionNegotiability: false,
      schedulePreferenceInference: false,
      employerBrandExpansion: false,
      entityExpansion: false,
      numericDrift: false,
      relationPurposeExpansion: false,
      responsibilityExpansion: false,
    },
    hardFailures: preflight.canGenerate ? [] : preflight.reasons,
    unknowns: ledger.facts.length ? [] : ['truthLedger'],
    warnings: preflight.reasons,
    final: preflight.canGenerate ? 'PASS' : 'BLOCK',
  };
}
