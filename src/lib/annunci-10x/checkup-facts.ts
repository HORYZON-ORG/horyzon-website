import type { Annunci10xExtractOutput } from './ai/schemas.ts';
import { buildRoleCardFromExtract } from './product-flow.ts';
import { checkupSourceUnits } from './checkup-source.ts';
import { createFact } from './validation.ts';
import type { AttractionContext, RoleCard } from './types.ts';

/** Preserve the original facts AND the labels that determine their meaning. */
export function buildCheckupRoleCard(text: string, extraction: Annunci10xExtractOutput): RoleCard {
  const units = checkupSourceUnits(text);
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const source = normalize(text);
  const literal = (s: unknown): s is string => typeof s === 'string' && s.trim().length > 1 && !/^(?:N\/D|UNKNOWN)|da chiarire/i.test(s) && source.includes(normalize(s));
  const grounded = extraction.extractedFacts.flatMap(f => {
    const evidence = f.evidence?.trim().replace(/^["“«]+|["”»]+$/g, '').trim();
    return literal(f.value) ? [{ ...f, value: String(f.value).trim() }]
      : evidence && text.includes(evidence) ? [{ ...f, value: evidence }] : [];
  });
  const base = buildRoleCardFromExtract(text, { ...extraction, extractedFacts: grounded });
  const values = (path: string) => grounded.filter(f => f.targetPath === path).map(f => String(f.value));
  const fact = (s: string) => createFact(s, 'EXTRACTED', { sourceId: 'checkup-original', publishable: true, confidence: 90 });
  const first = (path: string) => values(path)[0] ? fact(values(path)[0]) : undefined;
  const unknown = (label: string) => createFact('N/D - ' + label + ' da chiarire', 'SYSTEM_INFERRED', { publishable: false });
  const context: AttractionContext = { attractivenessEvidence: [] };
  for (const field of ['companyName','companyDescription','workMode','workModeDetail','location','contractType','schedule','shifts','onCall','operatingContext','autonomy','unexpectedEvents','growth','teamContext'] as const) {
    const value = first('attractionContext.' + field);
    if (value) context[field] = value;
  }
  const locations = [...text.matchAll(/\bsede(?:\s+di\s+(?:lavoro|riferimento))?\s*:\s*([^\n]+)/gi)].map(m => m[1].trim().replace(/^[-•]\s*/, ''));
  const location = locations.find(s => !/^(?:in presenza|di persona|lavoro|full.time|tempo pieno)\.?$/i.test(s));
  if (location) context.location = fact(location);
  if (!context.location) {
    const header = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean)[1];
    if (header && /,\s*(?:Lombardia|Piemonte|Veneto|Lazio|Toscana|Puglia|Emilia|Liguria)|\([A-Z]{2}\)/.test(header)) context.location = fact(header);
  }
  const joinMatching = (pattern: RegExp) => units.filter(u => pattern.test(u.text)).map(u => u.text).join('\n');
  const contract = joinMatching(/\bcontratto\b|\bCCNL\b|\btempo (?:in)?determinato\b/i);
  if (contract) context.contractType = fact(contract);
  const schedule = joinMatching(/\borari[oa]\b|\bturn[io]\b|\b\d+\s*ore\b|dal lunedi|dal lunedì|sabato|festiv/i);
  if (schedule) context.schedule = fact(schedule);
  const offer = [...units.filter(u => u.area === 'OFFER').map(u => u.text), ...values('attractionContext.attractivenessEvidence')];
  context.attractivenessEvidence = [...new Set(offer)].map(fact);
  const sourceRequirements = units.filter(u => u.area === 'REQUIRED' || u.area === 'PREFERRED');
  const fallbackRequirements = [...values('requirements'), ...values('requirements.label')];
  const requirements: RoleCard['requirements'] = (sourceRequirements.length ? sourceRequirements.map(u => ({ text: u.text, preferred: u.area === 'PREFERRED' }))
    : fallbackRequirements.map(s => ({ text: s, preferred: /preferibil\w*|preferenzial\w*|gradit\w*|facoltativ\w*|\bplus\b/i.test(s) })))
    .map((u, i) => ({ id: 'checkup-req-' + i, label: fact(u.text), classification: u.preferred ? 'PREFERRED' : 'REQUIRED' }));
  const activities = units.filter(u => u.area === 'ACTIVITIES').map(u => u.text);
  const responsibilities = activities.length ? activities : values('responsibilities');
  const compensation = joinMatching(/\b(?:RAL|retribuzion\w*|stipendio|compens[oi]|provvigional\w*|bonus|premi[oi])\b|[€$£]/i);
  const application = units.filter(u => u.area === 'APPLICATION').map(u => u.text).join('\n');
  return {
    title: first('title') ?? base.title,
    mission: first('mission') ?? unknown('missione'), outcomes: values('outcomes').length ? values('outcomes').map(fact) : [unknown('risultato atteso')],
    responsibilities: responsibilities.length ? responsibilities.map(fact) : [unknown('attività')],
    requirements: requirements.some(r => r.classification === 'REQUIRED') ? requirements : [...requirements, { id: 'checkup-req-unknown', label: unknown('requisito richiesto'), classification: 'REQUIRED' }],
    compensation: compensation ? { visibility: createFact('PUBLIC' as const, 'EXTRACTED', { publishable: true }), amountText: fact(compensation) }
      : { visibility: createFact('OPEN_DECISION' as const, 'SYSTEM_INFERRED', { publishable: false }) },
    attractionContext: context,
    applicationInstructions: application ? fact(application) : first('applicationInstructions'),
  };
}
