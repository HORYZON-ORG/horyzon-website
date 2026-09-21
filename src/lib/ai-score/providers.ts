import {
  AI_VISIBILITY_METHODOLOGY_VERSION,
  visibilityWeights,
} from './methodology';
import type {
  AiVisibilityProvider,
  EntityAnalysis,
  ExternalBrandFootprintResult,
  ExternalFootprintProvider,
  VisibilityMetricBreakdown,
  VisibilityObservation,
  VisibilityPrompt,
  VisibilityProviderCandidate,
  VisibilityScore,
} from './types';

const VISIBILITY_BLOCKER = 'AI Visibility richiede un provider verificabile per interrogare motori AI supportati, registrare prompt, citazioni e fonti. Nessun provider è configurato in questa versione.';
const FOOTPRINT_BLOCKER = 'External Brand Footprint richiede un provider affidabile per menzioni, profili e fonti indipendenti. Nessun provider è configurato in questa versione.';

export const visibilityProviderCandidates: VisibilityProviderCandidate[] = [
  {
    id: 'openai_web_search',
    label: 'OpenAI Responses API web_search',
    surface: 'grounded_search',
    evidenceAvailable: ['answer text', 'source urls', 'citations when returned', 'timestamp', 'model/provider metadata'],
    requiresCredential: true,
    blocker: 'Richiede API key, controllo costi e definizione dei prompt autorizzati.',
  },
  {
    id: 'gemini_grounding_google_search',
    label: 'Gemini API grounding with Google Search',
    surface: 'grounded_search',
    evidenceAvailable: ['answer text', 'grounding metadata', 'source urls', 'search query metadata'],
    requiresCredential: true,
    blocker: 'Richiede API key, billing e normalizzazione delle citazioni restituite.',
  },
  {
    id: 'perplexity_search_or_agent_api',
    label: 'Perplexity Search / Agent API',
    surface: 'answer_engine',
    evidenceAvailable: ['answer text', 'ranked results or citations depending on endpoint', 'source urls'],
    requiresCredential: true,
    blocker: 'Richiede scelta endpoint, API key e limiti di costo per prompt set.',
  },
  {
    id: 'bing_web_search_api',
    label: 'Microsoft Bing Web Search API',
    surface: 'search_api',
    evidenceAvailable: ['ranked web results', 'source urls', 'snippets'],
    requiresCredential: true,
    blocker: 'Misura fonti web, non la presenza in Copilot consumer; utile come provider ausiliario.',
  },
];

const emptyMetricBreakdown: VisibilityMetricBreakdown = {
  brandMentionRate: null,
  citationRate: null,
  promptCoverage: null,
  shareOfVoice: null,
  crossEngineConsistency: null,
  citationSourceDiversity: null,
};

export class NoopAiVisibilityProvider implements AiVisibilityProvider {
  async measure(input: { auditId: string; domain: string; entity: EntityAnalysis }): Promise<VisibilityScore> {
    const prompts = buildVisibilityPromptModel(input.auditId, input.domain, input.entity);

    return {
      state: 'not_measured',
      score: null,
      methodologyVersion: AI_VISIBILITY_METHODOLOGY_VERSION,
      blocker: VISIBILITY_BLOCKER,
      weights: visibilityWeights,
      prompts,
      evidence: [],
      observations: [],
      metricBreakdown: emptyMetricBreakdown,
      providerCandidates: visibilityProviderCandidates,
    };
  }
}

export class NoopExternalFootprintProvider implements ExternalFootprintProvider {
  async measure(_input: { auditId: string; domain: string; entity: EntityAnalysis }): Promise<ExternalBrandFootprintResult> {
    return {
      state: 'not_measured',
      provider: 'none',
      blocker: FOOTPRINT_BLOCKER,
      brandMentions: null,
      independentSources: null,
      officialProfiles: [],
      evidence: [],
    };
  }
}

export function buildVisibilityPromptModel(auditId: string, domain: string, entity: EntityAnalysis): VisibilityPrompt[] {
  const brand = entity.brandName?.trim() || domain;
  const services = entity.services.length > 0 ? entity.services.slice(0, 4) : ['servizi offerti'];
  const audience = entity.audience[0] ?? 'aziende';
  const location = entity.locations[0] ?? 'Italia';

  const candidates: Array<Omit<VisibilityPrompt, 'id' | 'auditId' | 'generatedBy' | 'approved' | 'status'>> = [
    { query: `Quali informazioni verificabili trovi su ${brand}?`, intent: 'branded', category: 'branded_discovery' },
    { query: `${brand} servizi principali e fonti`, intent: 'branded', category: 'branded_sources' },
    { query: `Alternative a ${brand} per ${services[0]}`, intent: 'competitor', category: 'competitor_context' },
    { query: `Aziende specializzate in ${services[0]} per ${audience}`, intent: 'category', category: 'category_discovery' },
    { query: `Migliori partner per ${services[0]} in ${location}`, intent: 'recommendation_discovery', category: 'recommendation' },
    { query: `Come scegliere un fornitore per ${services[0]}`, intent: 'problem', category: 'buyer_question' },
    { query: `Soluzioni per migliorare ${services[0]} nelle aziende`, intent: 'problem', category: 'problem_solution' },
    { query: `${services[0]} consulenza esempi casi studio`, intent: 'service', category: 'service_evidence' },
    { query: `${services[0]} metodologie e risultati misurabili`, intent: 'service', category: 'service_methodology' },
    { query: `Fonti indipendenti su ${brand}`, intent: 'branded', category: 'external_sources' },
    ...services.slice(1).map((service) => ({ query: `Aziende che offrono ${service}`, intent: 'service' as const, category: 'secondary_service' })),
  ];

  return dedupePrompts(candidates)
    .slice(0, 14)
    .map((item, index) => ({
      id: `${auditId}-visibility-${String(index + 1).padStart(2, '0')}`,
      auditId,
      query: item.query,
      intent: item.intent,
      category: item.category,
      generatedBy: 'system',
      approved: false,
      status: 'generated',
    }));
}

export function scoreVisibilityObservations(input: {
  domain: string;
  prompts: VisibilityPrompt[];
  observations: VisibilityObservation[];
}): VisibilityScore {
  const completed = input.observations.filter((observation) => observation.confidence > 0);
  if (completed.length === 0) {
    return {
      state: 'not_measured',
      score: null,
      methodologyVersion: AI_VISIBILITY_METHODOLOGY_VERSION,
      blocker: VISIBILITY_BLOCKER,
      weights: visibilityWeights,
      prompts: input.prompts,
      evidence: [],
      observations: [],
      metricBreakdown: emptyMetricBreakdown,
      providerCandidates: visibilityProviderCandidates,
    };
  }

  const promptIds = new Set(input.prompts.map((prompt) => prompt.id));
  const observedPromptIds = new Set(completed.map((observation) => observation.promptId).filter((id) => promptIds.has(id)));
  const mentioned = completed.filter((observation) => observation.brandMentioned).length;
  const cited = completed.filter((observation) => observation.domainCited || isDomainCitation(observation.citedUrl, input.domain)).length;
  const engines = new Set(completed.map((observation) => observation.engine));
  const citedDomains = new Set(completed.map((observation) => normalizeDomainForCitation(observation.citedUrl)).filter(Boolean));
  const competitorMentions = completed.reduce((sum, observation) => sum + observation.competitorsMentioned.length, 0);

  const metricBreakdown: VisibilityMetricBreakdown = {
    brandMentionRate: Math.round((mentioned / completed.length) * 100),
    citationRate: Math.round((cited / completed.length) * 100),
    promptCoverage: input.prompts.length > 0 ? Math.round((observedPromptIds.size / input.prompts.length) * 100) : null,
    shareOfVoice: mentioned + competitorMentions > 0 ? Math.round((mentioned / (mentioned + competitorMentions)) * 100) : null,
    crossEngineConsistency: engines.size > 1 ? Math.round((mentioned / completed.length) * 100) : null,
    citationSourceDiversity: cited > 0 ? Math.min(100, citedDomains.size * 20) : 0,
  };

  const weighted = Object.entries(visibilityWeights).reduce((sum, [key, weight]) => {
    const value = metricBreakdown[key as keyof VisibilityMetricBreakdown];
    return value === null ? sum : sum + (value / 100) * weight;
  }, 0);
  const availableWeight = Object.entries(visibilityWeights).reduce((sum, [key, weight]) => {
    const value = metricBreakdown[key as keyof VisibilityMetricBreakdown];
    return value === null ? sum : sum + weight;
  }, 0);
  const score = availableWeight > 0 ? Math.round((weighted / availableWeight) * 100) : null;

  return {
    state: engines.size > 1 && observedPromptIds.size === input.prompts.length ? 'measured' : 'partial',
    score,
    methodologyVersion: AI_VISIBILITY_METHODOLOGY_VERSION,
    weights: visibilityWeights,
    prompts: input.prompts,
    evidence: completed,
    observations: completed,
    metricBreakdown,
    providerCandidates: visibilityProviderCandidates,
  };
}

export function isDomainCitation(citedUrl: string | undefined, domain: string): boolean {
  const citedDomain = normalizeDomainForCitation(citedUrl);
  const normalizedDomain = normalizeDomainForCitation(`https://${domain}`);
  if (!citedDomain || !normalizedDomain) return false;
  return citedDomain === normalizedDomain || citedDomain.endsWith(`.${normalizedDomain}`);
}

export function normalizeDomainForCitation(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./i, '').toLowerCase() || null;
  }
}

function dedupePrompts<T extends { query: string }>(prompts: T[]): T[] {
  const seen = new Set<string>();
  return prompts.filter((prompt) => {
    const key = prompt.query.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const aiVisibilityProvider: AiVisibilityProvider = new NoopAiVisibilityProvider();
export const externalFootprintProvider: ExternalFootprintProvider = new NoopExternalFootprintProvider();
