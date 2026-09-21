import {
  AI_VISIBILITY_METHODOLOGY_VERSION,
  visibilityWeights,
} from './methodology';
import type {
  AiVisibilityProvider,
  EntityAnalysis,
  ExternalBrandFootprintResult,
  ExternalFootprintProvider,
  VisibilityScore,
} from './types';

const VISIBILITY_BLOCKER = 'AI Visibility richiede un provider verificabile per interrogare motori AI supportati, registrare prompt, citazioni e fonti. Nessun provider è configurato in questa versione.';
const FOOTPRINT_BLOCKER = 'External Brand Footprint richiede un provider affidabile per menzioni, profili e fonti indipendenti. Nessun provider è configurato in questa versione.';

export class NoopAiVisibilityProvider implements AiVisibilityProvider {
  async measure(input: { auditId: string; domain: string; entity: EntityAnalysis }): Promise<VisibilityScore> {
    return {
      state: 'not_measured',
      score: null,
      methodologyVersion: AI_VISIBILITY_METHODOLOGY_VERSION,
      blocker: VISIBILITY_BLOCKER,
      weights: visibilityWeights,
      prompts: buildVisibilityPromptModel(input.auditId, input.domain, input.entity),
      evidence: [],
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

function buildVisibilityPromptModel(auditId: string, domain: string, entity: EntityAnalysis) {
  const brand = entity.brandName ?? domain;
  const primaryService = entity.services[0] ?? 'servizi del settore';

  return [
    {
      id: `${auditId}-brand`,
      auditId,
      query: `Quali informazioni trovi su ${brand}?`,
      intent: 'brand' as const,
      category: 'brand',
      generatedBy: 'system' as const,
      approved: false,
    },
    {
      id: `${auditId}-service`,
      auditId,
      query: `Quali aziende offrono ${primaryService}?`,
      intent: 'service' as const,
      category: 'service',
      generatedBy: 'system' as const,
      approved: false,
    },
    {
      id: `${auditId}-non-branded`,
      auditId,
      query: `Migliori soluzioni per problemi risolti da ${brand}`,
      intent: 'non_branded' as const,
      category: 'non_branded',
      generatedBy: 'system' as const,
      approved: false,
    },
  ];
}

export const aiVisibilityProvider: AiVisibilityProvider = new NoopAiVisibilityProvider();
export const externalFootprintProvider: ExternalFootprintProvider = new NoopExternalFootprintProvider();
