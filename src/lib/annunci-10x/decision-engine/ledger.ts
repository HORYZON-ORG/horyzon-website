import type { Requirement, RoleCard } from '../types.ts';
import type { Annunci10xTruthFact, Annunci10xTruthLedger } from './types.ts';
import { compactText, hasUnknownText, includesEquivalent, normalizeForDecision, splitListLike, unique } from './text.ts';

export function factValue<T>(fact: { value: T } | undefined | null): string {
  if (!fact) return '';
  return typeof fact.value === 'string' ? compactText(fact.value) : String(fact.value);
}

export function isUnknownOptionalFact(value: string): boolean {
  const normalized = normalizeForDecision(value);
  if (!normalized) return true;
  if (/\b(?:non\s+(?:sono\s+)?previst[oaie]|nessun[ao]?\s+\w+\s+previst[oaie])\b/.test(normalized)) return false;
  return /\b(?:non\s+(?:sono\s+stat[ei]\s+)?(?:dichiarat[oaie]|specificat[oaie]|indicat[oaie])|non disponibil[ei]|non\s+sono\s+disponibili|nessuna?\s+informazione\s+fornit[aoie])\b/.test(normalized);
}

export function createAnnunci10xTruthLedger(roleCard: RoleCard): Annunci10xTruthLedger {
  const facts: Annunci10xTruthFact[] = [];
  const addFact = (fact: Omit<Annunci10xTruthFact, 'id'>): void => {
    if (!fact.value || (!fact.publishable && fact.category !== 'BOUNDARY' && fact.category !== 'REQUIREMENT_TRAINABLE')) return;
    facts.push({ ...fact, id: `F${String(facts.length + 1).padStart(2, '0')}` });
  };
  const addDeclaredFact = (fact: Omit<Annunci10xTruthFact, 'id'>): void => {
    if (isUnknownOptionalFact(fact.value)) return;
    addFact(fact);
  };

  addFact({ key: 'role', label: 'Ruolo', value: factValue(roleCard.title), category: 'ROLE', sourcePath: 'roleCard.title', publishable: true });
  addFact({ key: 'mission', label: 'Missione', value: factValue(roleCard.mission), category: 'ACTIVITY', sourcePath: 'roleCard.mission', publishable: true });
  roleCard.outcomes.forEach((item, index) => addFact({ key: `outcome.${index}`, label: 'Risultato', value: factValue(item), category: 'ACTIVITY', sourcePath: `roleCard.outcomes.${index}`, publishable: true }));
  roleCard.responsibilities.forEach((item, index) => addFact({ key: `responsibility.${index}`, label: 'Attività confermate', value: factValue(item), category: 'ACTIVITY', sourcePath: `roleCard.responsibilities.${index}`, publishable: true }));

  roleCard.requirements.forEach((requirement, index) => addRequirementFacts(requirement, index, addFact));

  const context = roleCard.attractionContext;
  addDeclaredFact({ key: 'companyDescription', label: 'Contesto aziendale', value: factValue(context.companyDescription), category: 'COMPANY', sourcePath: 'roleCard.attractionContext.companyDescription', publishable: true });
  addDeclaredFact({ key: 'location', label: 'Sede', value: factValue(context.location), category: 'CONDITION', sourcePath: 'roleCard.attractionContext.location', publishable: true });
  addDeclaredFact({ key: 'workMode', label: 'Modalità', value: factValue(context.workModeDetail) || factValue(context.workMode), category: 'CONDITION', sourcePath: 'roleCard.attractionContext.workMode', publishable: true });
  addDeclaredFact({ key: 'contract', label: 'Contratto', value: factValue(context.contractType), category: 'CONDITION', sourcePath: 'roleCard.attractionContext.contractType', publishable: true });
  addDeclaredFact({ key: 'schedule', label: 'Orario', value: factValue(context.schedule), category: 'CONDITION', sourcePath: 'roleCard.attractionContext.schedule', publishable: true });
  addDeclaredFact({ key: 'shifts', label: 'Turni', value: factValue(context.shifts), category: 'CONDITION', sourcePath: 'roleCard.attractionContext.shifts', publishable: true });
  addDeclaredFact({ key: 'onCall', label: 'Reperibilità', value: factValue(context.onCall), category: 'CONDITION', sourcePath: 'roleCard.attractionContext.onCall', publishable: true });
  addDeclaredFact({ key: 'operatingContext', label: 'Contesto operativo', value: factValue(context.operatingContext), category: 'INTERLOCUTOR', sourcePath: 'roleCard.attractionContext.operatingContext', publishable: true });
  addDeclaredFact({ key: 'autonomy', label: 'Autonomia', value: factValue(context.autonomy), category: 'ACTIVITY', sourcePath: 'roleCard.attractionContext.autonomy', publishable: true });
  addDeclaredFact({ key: 'unexpectedEvents', label: 'Imprevisti', value: factValue(context.unexpectedEvents), category: 'ACTIVITY', sourcePath: 'roleCard.attractionContext.unexpectedEvents', publishable: true });
  context.attractivenessEvidence.forEach((item, index) => {
    const value = cleanAttractivenessFact(factValue(item));
    distinctAttractivenessFacts(value, roleCard).forEach((distinctValue, partIndex) => {
      if (!distinctValue || isUnknownOptionalFact(distinctValue)) return;
      addFact({
        key: `benefit.${index}.${partIndex}`,
        label: 'Benefit / attrattività',
        value: distinctValue,
        category: 'BENEFIT',
        sourcePath: `roleCard.attractionContext.attractivenessEvidence.${index}`,
        publishable: true,
      });
    });
  });

  const compensation = compensationText(roleCard);
  addFact({ key: 'compensation', label: 'Compenso', value: compensation, category: 'COMPENSATION', sourcePath: 'roleCard.compensation', publishable: true });
  addFact({ key: 'application', label: 'Candidatura', value: factValue(roleCard.applicationInstructions), category: 'APPLICATION', sourcePath: 'roleCard.applicationInstructions', publishable: true });

  for (const technology of extractTechnologies(roleCard)) {
    addFact({ key: `technology.${technology}`, label: 'Tecnologia', value: technology, category: 'TECHNOLOGY', sourcePath: 'roleCard.requirements', publishable: true });
  }

  return { version: 'annunci10x.truth-ledger.v1', roleCard, facts };
}

export function factsByCategory(ledger: Annunci10xTruthLedger, category: Annunci10xTruthFact['category']): Annunci10xTruthFact[] {
  return ledger.facts.filter((fact) => fact.category === category);
}

export function compensationText(roleCard: RoleCard): string {
  const compensation = roleCard.compensation;
  if (!compensation) return '';
  const amount = factValue(compensation.amountText);
  const min = compensation.minAmount?.value;
  const max = compensation.maxAmount?.value;
  const currency = factValue(compensation.currency) || 'EUR';
  if (amount) return amount;
  if (typeof min === 'number' && typeof max === 'number') return `${min}-${max} ${currency}`;
  if (typeof min === 'number') return `${min} ${currency}`;
  return '';
}

function addRequirementFacts(
  requirement: Requirement,
  index: number,
  addFact: (fact: Omit<Annunci10xTruthFact, 'id'>) => void,
): void {
  const value = factValue(requirement.label);
  if (!value) return;
  if (requirement.classification === 'REQUIRED') {
    addFact({ key: `required.${index}`, label: 'Requisito obbligatorio', value, category: 'REQUIREMENT_REQUIRED', sourcePath: `roleCard.requirements.${index}`, publishable: true });
  } else if (requirement.classification === 'PREFERRED') {
    if (!hasUnknownText(value)) addFact({ key: `preferred.${index}`, label: 'Requisito preferenziale', value, category: 'REQUIREMENT_PREFERRED', sourcePath: `roleCard.requirements.${index}`, publishable: true });
  } else if (requirement.classification === 'TRAINABLE') {
    if (!hasUnknownText(value)) addFact({ key: `trainable.${index}`, label: 'Apprendibile internamente', value, category: 'REQUIREMENT_TRAINABLE', sourcePath: `roleCard.requirements.${index}`, publishable: false });
  } else {
    addFact({ key: `boundary.${index}`, label: 'Vincolo interno', value, category: 'BOUNDARY', sourcePath: `roleCard.requirements.${index}`, publishable: false });
  }
}

function cleanAttractivenessFact(value: string): string {
  const cleaned = value
    .replace(/\bBenefit\s*:\s*/gi, '')
    .replace(/\bElementi concreti da valorizzare\s*:\s*/gi, '')
    .replace(/\bFormazione\/crescita\s*:\s*/gi, '')
    .replace(/\bFormazione e crescita concreta\s*:\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim().replace(/[.!?]+$/g, ''))
    .filter((sentence) => sentence && !isMissingAttractivenessDisclosure(sentence))
    .join('. ');
}

function distinctAttractivenessFacts(value: string, roleCard: RoleCard): string[] {
  if (!value) return [];
  const clauses = value
    .split(/[;\n]|(?<=[.!?])\s+/g)
    .map((clause) => clause.trim().replace(/[.!?]+$/g, ''))
    .filter(Boolean);

  const context = roleCard.attractionContext;
  const preferredRequirements = roleCard.requirements
    .filter((requirement) => requirement.classification === 'PREFERRED')
    .map((requirement) => factValue(requirement.label))
    .filter(Boolean);
  const referenceValues = [
    factValue(context.workModeDetail) || factValue(context.workMode),
    factValue(context.schedule),
    factValue(context.contractType),
    factValue(context.location),
    factValue(context.shifts),
    factValue(context.onCall),
    compensationText(roleCard),
    ...preferredRequirements,
  ].filter(Boolean);

  const hasWorkMode = Boolean(factValue(context.workModeDetail) || factValue(context.workMode));
  const hasSchedule = Boolean(factValue(context.schedule));
  const hasContract = Boolean(factValue(context.contractType));
  const hasLocation = Boolean(factValue(context.location));
  const hasShifts = Boolean(factValue(context.shifts));
  const hasOnCall = Boolean(factValue(context.onCall));
  const hasCompensation = Boolean(compensationText(roleCard));
  const hasPreferred = preferredRequirements.length > 0;

  return clauses.filter((clause) => {
    const normalized = normalizeForDecision(clause);
    if (!normalized) return false;
    if (referenceValues.some((reference) => includesEquivalent(reference, clause) || includesEquivalent(clause, reference))) return false;
    if (hasWorkMode && /\b(?:modalita|ibrid|remot|ufficio|presenza)\b/.test(normalized)) return false;
    if (hasPreferred && /\besperien/.test(normalized) && /\b(?:prefer|gradit|non obblig)/.test(normalized)) return false;
    if (hasSchedule && /\b(?:orario|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b/.test(normalized)) return false;
    if (hasContract && /\bcontratt/.test(normalized)) return false;
    if (hasCompensation && /\b(?:ral|retribu|compenso)\b/.test(normalized)) return false;
    if (hasLocation && /\b(?:sede|luogo|localit)\b/.test(normalized)) return false;
    if (hasShifts && /\bturn/.test(normalized)) return false;
    if (hasOnCall && /\breperibil/.test(normalized)) return false;
    return true;
  });
}

function isMissingAttractivenessDisclosure(value: string): boolean {
  if (/\b(?:non\s+(?:sono\s+)?previst[oaie]|nessun[ao]?\s+\w+\s+previst[oaie])\b/i.test(value)) return false;
  return /\b(?:non\s+(?:sono\s+stat[ei]\s+)?(?:dichiarat[ie]|indicat[ie]|specificat[ie])|non\s+(?:vengono|sono)\s+indicat[ie]|non\s+sono\s+disponibili|nessun[ao]?\s+(?:benefit|formazione|percorso)|da\s+definire)\b/i.test(value);
}

function extractTechnologies(roleCard: RoleCard): string[] {
  const known = ['typescript', 'react', 'node.js', 'node', 'sql', 'rest api', 'git', 'crm', 'wms', 'plc'];
  const text = [
    ...roleCard.requirements
      .filter((item) => item.classification !== 'DISQUALIFYING')
      .map((item) => factValue(item.label)),
    ...roleCard.responsibilities.map(factValue),
    ...roleCard.outcomes.map(factValue),
    factValue(roleCard.mission),
    factValue(roleCard.attractionContext.operatingContext),
    factValue(roleCard.attractionContext.unexpectedEvents),
  ].join(' ').toLowerCase();
  return unique(known.filter((technology) => text.includes(technology))).flatMap((technology) => technology === 'node' && text.includes('node.js') ? [] : [technology]);
}

export function publishableRequirementItems(value: string): string[] {
  return splitListLike(value).filter((item) => item && !hasUnknownText(item));
}
