import type { Annunci10xExtractOutput } from './ai/schemas.ts';
import { buildRoleCardFromExtract } from './product-flow.ts';
import { createFact } from './validation.ts';
import type { AttractionContext, RoleCard } from './types.ts';

/** Preserve source wording. Missing and inferred labels cannot become candidate-facing facts. */
export function buildCheckupRoleCard(text: string, extraction: Annunci10xExtractOutput): RoleCard {
  const base = buildRoleCardFromExtract(text, extraction);
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const source = normalize(text);
  const usable = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 1 && !/^(?:N\/D|UNKNOWN)|da chiarire/i.test(value) && source.includes(normalize(value));
  const facts = extraction.extractedFacts.filter(f => usable(f.value));
  const values = (path: string) => facts.filter(f => f.targetPath === path).map(f => String(f.value).trim());
  const fact = (value: string) => createFact(value, 'EXTRACTED', { sourceId: 'checkup-original', publishable: true, confidence: 82 });
  const first = (path: string) => values(path)[0] ? fact(values(path)[0]) : undefined;
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean);
  const context: AttractionContext = { attractivenessEvidence: values('attractionContext.attractivenessEvidence').map(fact) };
  for (const field of ['companyName','companyDescription','workMode','workModeDetail','location','contractType','schedule','shifts','onCall','operatingContext','autonomy','unexpectedEvents','growth','teamContext'] as const) {
    const value = first(`attractionContext.${field}`);
    if (value) context[field] = value;
  }
  // Exact original sentences retain conditions even when the extractor omits a structured field.
  const explicitLocation = text.match(/\bsede(?: di|:)?\s+([^.!?\n]{2,100})/i)?.[1]?.trim();
  if (!context.location && explicitLocation) context.location = fact(explicitLocation);
  const conditions = sentences.filter(s => /\b(?:contratto|part.time|full.time|turni|orario|retribuzione|stipendio|RAL|presenza|remoto|benefit|affiancamento)\b/i.test(s) && !/^(?:requisiti|richiediamo)/i.test(s));
  if (conditions.length) context.contractType = fact(conditions.join('\n'));
  const literalResponsibilities = values('responsibilities');
  const sourceEvidence = (paths: string[]) => extraction.extractedFacts.filter(f => paths.includes(f.targetPath)).flatMap(f => {
    const evidence = typeof f.evidence === 'string' ? f.evidence.trim().replace(/^["“«]+|["”»]+$/g, '').trim() : '';
    return evidence.length > 1 && text.includes(evidence) ? [evidence] : [];
  });
  const responsibilities = literalResponsibilities.length ? literalResponsibilities : [...new Set(sourceEvidence(['responsibilities']))];
  const requirements = [...values('requirements'), ...values('requirements.label')];
  const evidencedRequirements = sourceEvidence(['requirements', 'requirements.label']);
  const sourceRequirements = requirements.length ? requirements : evidencedRequirements.length ? evidencedRequirements : base.requirements.map(r => r.label.value).filter(usable);
  const unknown = (label: string) => createFact(`N/D - ${label} da chiarire`, 'SYSTEM_INFERRED', { publishable: false });
  const parsedRequirements: RoleCard['requirements'] = [...new Set(sourceRequirements.flatMap(r => r.split(/;|(?=\b(?:preferibil[ei]|gradit[oaie])\b)/i).map(s => s.trim()).filter(Boolean)))].map((value, index) => ({ id: `checkup-req-${index}`, label: fact(value), classification: /\b(?:preferibil[ei]|gradit[oaie]|facoltativ[oaie])\b/i.test(value) ? 'PREFERRED' : 'REQUIRED' }));
  if (!parsedRequirements.some(r => r.classification === 'REQUIRED')) parsedRequirements.push({ id: 'checkup-required-unknown', label: unknown('requisiti'), classification: 'REQUIRED' });
  return {
    title: first('title') ?? base.title,
    mission: first('mission') ?? unknown('missione'), outcomes: values('outcomes').length ? values('outcomes').map(fact) : [unknown('risultato atteso')],
    responsibilities: responsibilities.length ? responsibilities.map(fact)
      : base.responsibilities.some(f => usable(f.value)) ? base.responsibilities.map(f => f.value).filter(usable).map(fact)
        : [unknown('responsabilità')],
    requirements: parsedRequirements,
    compensation: { visibility: { ...createFact('OPEN_DECISION', 'SYSTEM_INFERRED', { publishable: false }), value: 'OPEN_DECISION' } },
    attractionContext: context,
    applicationInstructions: first('applicationInstructions') ?? base.applicationInstructions,
  };
}
