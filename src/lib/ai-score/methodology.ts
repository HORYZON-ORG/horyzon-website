import type { AuditCheck, CategoryScore, EvidenceConfidenceLabel, InternalAuditResult, ReadinessCategoryDefinition, ReadinessCategoryId } from './types';

export const AI_READINESS_METHODOLOGY_VERSION = 'horyzon-ai-readiness-v1';
export const AI_SCORE_DISPLAY_METHODOLOGY = 'Horyzon AI Score methodology v1.0';
export const AI_VISIBILITY_METHODOLOGY_VERSION = 'horyzon-ai-visibility-v1';

export const readinessCategories: ReadinessCategoryDefinition[] = [
  { id: 'crawlability_indexability', label: 'Crawlability & Indexability', weight: 15, description: 'Disponibilita, crawlability, indexability, robots, sitemap, redirect e contenuto leggibile dai crawler.' },
  { id: 'content_quality_citability', label: 'Content Quality & Citability', weight: 20, description: 'Chiarezza, profondita, struttura, fonti, passaggi citabili e rapporto tra contenuto utile e boilerplate.' },
  { id: 'entity_semantic_clarity', label: 'Entity & Semantic Clarity', weight: 15, description: 'Ricostruibilita di brand, organizzazione, servizi, persone, luoghi e relazioni semantiche.' },
  { id: 'structured_data', label: 'Structured Data', weight: 10, description: 'Presenza, validita e pertinenza dei dati strutturati rispetto al contenuto visibile.' },
  { id: 'authority_trust_evidence', label: 'Authority, Trust & Evidence', weight: 15, description: 'Segnali di responsabilita editoriale, contatti, pagine istituzionali, fonti e prove verificabili.' },
  { id: 'technical_quality_ux', label: 'Technical Quality & UX', weight: 10, description: 'Qualita tecnica osservabile: HTTPS, metadata, viewport, semantica HTML, immagini e security headers.' },
  { id: 'freshness_maintenance', label: 'Freshness & Content Maintenance', weight: 5, description: 'Date, lastmod, segnali di manutenzione e contenuti potenzialmente aggiornati.' },
  { id: 'ai_agent_readiness', label: 'AI / Agent Readiness', weight: 5, description: 'Policy per crawler AI, navigazione semantica, machine readability, llms.txt e protocolli agentici quando pertinenti.' },
  { id: 'external_brand_footprint', label: 'External Brand Footprint', weight: 5, description: 'Presenza esterna del brand quando esistono provider affidabili.' },
];

export const visibilityWeights = {
  brandMentionRate: 25,
  citationRate: 25,
  promptCoverage: 20,
  shareOfVoice: 15,
  crossEngineConsistency: 10,
  citationSourceDiversity: 5,
} as const;

export const accessLevels = ['FREE', 'PREMIUM_AUDIT', 'OPTIMIZATION_PLAN'] as const;

const categoryById = new Map<ReadinessCategoryId, ReadinessCategoryDefinition>(readinessCategories.map(category => [category.id, category]));

export function confidenceLabel(value: number): EvidenceConfidenceLabel {
  if (value >= 80) return 'HIGH';
  if (value >= 50) return 'MEDIUM';
  return 'LOW';
}

export function calculateCategoryScores(checks: AuditCheck[]): CategoryScore[] {
  return readinessCategories.map(category => {
    const categoryChecks = checks.filter(check => check.categoryId === category.id);
    const applicable = categoryChecks.filter(check => check.status !== 'not_applicable');
    const measured = applicable.filter(check => check.measured);
    const pointsAvailable = measured.reduce((total, check) => total + check.pointsAvailable, 0);
    const pointsEarned = measured.reduce((total, check) => total + check.pointsEarned, 0);
    const score = pointsAvailable > 0 ? Math.round((pointsEarned / pointsAvailable) * category.weight) : null;
    return {
      id: category.id,
      label: category.label,
      weight: category.weight,
      state: measured.length === 0 ? 'not_measured' : measured.length < applicable.length ? 'partial' : 'measured',
      score,
      pointsEarned,
      pointsAvailable,
      checksMeasured: measured.length,
      checksApplicable: applicable.length,
    };
  });
}

export function calculateReadinessScore(categories: CategoryScore[]) {
  const measured = categories.filter(category => category.score !== null);
  const measuredWeight = measured.reduce((total, category) => total + category.weight, 0);
  if (measured.length === 0 || measuredWeight === 0) return { state: 'not_measured' as const, score: null };
  const earned = measured.reduce((total, category) => total + (category.score ?? 0), 0);
  const normalized = Math.round((earned / measuredWeight) * 100);
  return { state: measured.length < categories.length ? 'partial' as const : 'measured' as const, score: Math.max(0, Math.min(100, normalized)) };
}

export function calculateEvidenceConfidence(checks: AuditCheck[], measuredCategoryCount: number) {
  const applicable = checks.filter(check => check.status !== 'not_applicable');
  const measured = applicable.filter(check => check.measured);
  const measuredRatio = applicable.length ? measured.length / applicable.length : 0;
  const verifiedEvidence = measured.flatMap(check => check.evidence).filter(evidence => evidence.verification === 'verified').length;
  const evidenceCount = measured.flatMap(check => check.evidence).length;
  const verifiedRatio = evidenceCount ? verifiedEvidence / evidenceCount : 0;
  const categoryCoverage = readinessCategories.length ? measuredCategoryCount / readinessCategories.length : 0;
  const value = Math.round((measuredRatio * 45) + (verifiedRatio * 25) + (categoryCoverage * 30));
  return { value: Math.max(0, Math.min(100, value)), label: confidenceLabel(value) };
}

export function categoryWeight(categoryId: ReadinessCategoryId) {
  const category = categoryById.get(categoryId);
  if (!category) throw new Error(`Unknown AI Score category: ${categoryId}`);
  return category.weight;
}

export function projectFreeResult(audit: InternalAuditResult) {
  const { premium: _premium, ...free } = audit;
  void _premium;
  return free;
}
