import { generateIncisiveCheckupMaster } from './checkup-editor.ts';
import type { Annunci10xRuntimeContext } from './product-flow.ts';
import type { PersistedSnapshot } from './persistence/types.ts';
import type { GeneratedAd, GeneratedSection } from './types.ts';
import { checkupSourceUnits, type CheckupSourceUnit } from './checkup-source.ts';

export const CHECKUP_WRITER_VERSION = 'checkup-performia-full-rewrite-v6.3';
export interface CheckupStrategy { qualification: string; rhythm: string; popularity: string; technicality: string }
export interface CheckupSourceAudit { sourceId: string; status: 'PRESERVED' | 'MISSING' | 'ALTERED'; evidence: string[]; reason: string }
export interface CheckupQuality {
  version: typeof CHECKUP_WRITER_VERSION;
  status: 'VERIFIED' | 'ORIGINAL_RETAINED';
  mode?: 'FULL_REWRITE' | 'SOURCE_COMPOSITION';
  strategy: CheckupStrategy | null;
  issues: string[];
  attempts: number;
  coverage?: { total: number; retained: number; method: 'EXACT_SOURCE_UNITS' | 'SEMANTIC_SOURCE_AUDIT' };
  sourceAudit?: CheckupSourceAudit[];
  editorialChange?: { eligible: number; rewritten: number; ratio: number };
  rejectedText?: string;
}
export interface CheckupComposition { strategy: CheckupStrategy; opening: {text: string; sourceIds: string[]}[]; order: string[] }

const labels: Record<CheckupSourceUnit['area'], { type: GeneratedSection['type']; title: string }> = {
  CONTEXT: { type: 'CONTEXT', title: 'L’azienda e il contesto' }, ACTIVITIES: { type: 'RESPONSIBILITIES', title: 'Il lavoro e il contributo richiesto' },
  REQUIRED: { type: 'REQUIREMENTS', title: 'Requisiti' }, PREFERRED: { type: 'REQUIREMENTS', title: 'Elementi preferenziali' },
  OFFER: { type: 'CONDITIONS', title: 'L’offerta' }, CONDITIONS: { type: 'CONDITIONS', title: 'Condizioni e sede' }, APPLICATION: { type: 'APPLICATION', title: 'Candidatura' },
};

/** AI chooses emphasis; facts, qualifications and original heading scope remain immutable. */
export function composeCheckupSections(originalText: string, proposal: CheckupComposition, useOpening = true): GeneratedSection[] {
  const units = checkupSourceUnits(originalText);
  const title = units[0]?.text.length < 180 ? units[0] : null;
  const sections: GeneratedSection[] = [];
  const add = (type: GeneratedSection['type'], title: string, body: string, ids: string[]) => sections.push({ id: 'checkup-section-' + sections.length, key: 'checkup-section-' + sections.length, type, title, body, sourceFactIds: ids });
  if (title) add('TITLE', 'Posizione', title.text, [title.id]);
  if (useOpening && proposal.opening.length) add('OPENING', 'Il lavoro, in breve', proposal.opening.map(s => s.text.trim()).join(' '), [...new Set(proposal.opening.flatMap(s => s.sourceIds))]);
  // Keep original blocks intact. The model orders blocks, never changes requirement scope.
  const blocks: { key: string; units: CheckupSourceUnit[] }[] = [];
  for (const u of units.filter(u => u !== title)) {
    const key = (u.heading ?? '') + ':' + u.area;
    const existing = blocks.find(b => b.key === key);
    if (existing) existing.units.push(u); else blocks.push({ key, units: [u] });
  }
  const position = new Map(proposal.order.map((id,i) => [id,i]));
  blocks.sort((a,b) => Math.min(...a.units.map(u=>position.get(u.id) ?? 100000)) - Math.min(...b.units.map(u=>position.get(u.id) ?? 100000)));
  for (const block of blocks) {
    const first = block.units[0], label = labels[first.area];
    add(label.type, first.heading?.replace(/:$/, '') || label.title, [...new Set(block.units.map(u => u.text))].join('\n'), block.units.map(u => u.id));
  }
  return sections;
}
export function checkupCoverageIssues(originalText: string, sections: GeneratedSection[]): string[] {
  const units = checkupSourceUnits(originalText), core = sections.filter(s => s.type !== 'OPENING');
  return units.flatMap(u => core.filter(s => s.sourceFactIds.includes(u.id) && s.body.includes(u.text) && (!u.heading || s.title === u.heading.replace(/:$/, ''))).length === 1 ? [] : ['Unità non conservata esattamente una volta: ' + u.id]);
}

export async function generateFaithfulCheckupMaster(input: {
  context: Annunci10xRuntimeContext; sessionId: string; sessionSecret: string;
  snapshot: PersistedSnapshot; analysisRunId: string; originalText: string;
}): Promise<{master: GeneratedAd; quality: CheckupQuality}> {
  return generateIncisiveCheckupMaster({...input,version:CHECKUP_WRITER_VERSION});
}
