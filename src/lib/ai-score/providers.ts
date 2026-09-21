import type {
  AiVisibilityProvider,
  EntityAnalysis,
  ExternalBrandFootprintResult,
  ExternalFootprintProvider,
  VisibilityScore,
} from './types';
import {
  buildEntityProfile,
  createVisibilityProviderRegistry,
  generateVisibilityPrompts,
  measureAiVisibility,
  normalizeDomain,
  scoreVisibilityObservations,
  visibilityProviderCandidates,
  visibilityScanProfiles,
} from './visibility';

const FOOTPRINT_BLOCKER = 'External Brand Footprint richiede un provider affidabile per menzioni, profili e fonti indipendenti. Nessun provider e configurato in questa versione.';

export class RegistryAiVisibilityProvider implements AiVisibilityProvider {
  async measure(input: { auditId: string; domain: string; entity: EntityAnalysis }): Promise<VisibilityScore> {
    return measureAiVisibility({
      auditId: input.auditId,
      domain: input.domain,
      entity: input.entity,
      profileId: 'FREE_QUICK_SCAN',
    });
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

export function buildVisibilityPromptModel(auditId: string, domain: string, entity: EntityAnalysis) {
  return generateVisibilityPrompts({
    auditId,
    entity: buildEntityProfile(normalizeDomain(domain) ?? domain, entity),
    profile: visibilityScanProfiles.FREE_QUICK_SCAN,
  });
}

export {
  createVisibilityProviderRegistry,
  scoreVisibilityObservations,
  visibilityProviderCandidates,
  visibilityScanProfiles,
};

export const aiVisibilityProvider: AiVisibilityProvider = new RegistryAiVisibilityProvider();
export const externalFootprintProvider: ExternalFootprintProvider = new NoopExternalFootprintProvider();
