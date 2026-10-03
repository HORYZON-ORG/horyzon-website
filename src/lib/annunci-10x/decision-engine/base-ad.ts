import type { Annunci10xBaseAd, Annunci10xTruthFact, Annunci10xTruthLedger } from './types.ts';
import { factsByCategory, publishableRequirementItems } from './ledger.ts';

export function buildAnnunci10xBaseAd(ledger: Annunci10xTruthLedger): Annunci10xBaseAd {
  const sections: Annunci10xBaseAd['sections'] = [];
  const addSection = (id: string, title: string, facts: Annunci10xTruthFact[], mapValue: (fact: Annunci10xTruthFact) => string = (fact) => fact.value): void => {
    const lines = facts.map(mapValue).filter(Boolean);
    if (lines.length === 0) return;
    sections.push({ id, title, lines, factIds: facts.map((fact) => fact.id) });
  };

  addSection('role', 'RUOLO', factsByCategory(ledger, 'ROLE'));
  addSection('company', 'CONTESTO', factsByCategory(ledger, 'COMPANY'));
  addSection('activities', 'ATTIVITA CONFERMATE', factsByCategory(ledger, 'ACTIVITY'), bullet);
  addSection('interlocutors', 'INTERLOCUTORI / CONTESTO OPERATIVO', factsByCategory(ledger, 'INTERLOCUTOR'), bullet);
  addSection('required', 'REQUISITI OBBLIGATORI', factsByCategory(ledger, 'REQUIREMENT_REQUIRED'), requirementBullets);
  addSection('preferred', 'REQUISITI PREFERENZIALI', factsByCategory(ledger, 'REQUIREMENT_PREFERRED'), requirementBullets);
  addSection('conditions', 'CONDIZIONI', factsByCategory(ledger, 'CONDITION'), (fact) => `${fact.label}: ${fact.value}`);
  addSection('compensation', 'COMPENSO', factsByCategory(ledger, 'COMPENSATION'));
  addSection('benefits', 'BENEFIT / ATTRATTIVITA DICHIARATI', factsByCategory(ledger, 'BENEFIT'), bullet);
  addSection('application', 'CANDIDATURA', factsByCategory(ledger, 'APPLICATION'));

  return {
    version: 'annunci10x.base-ad.v1',
    sections,
    text: sections.map((section) => `${section.title}\n${section.lines.join('\n')}`).join('\n\n'),
    internalBoundaries: factsByCategory(ledger, 'BOUNDARY'),
  };
}

function bullet(fact: Annunci10xTruthFact): string {
  return `- ${fact.value}`;
}

function requirementBullets(fact: Annunci10xTruthFact): string {
  const items = publishableRequirementItems(fact.value);
  return items.length > 1 ? items.map((item) => `- ${item}`).join('\n') : `- ${fact.value}`;
}
