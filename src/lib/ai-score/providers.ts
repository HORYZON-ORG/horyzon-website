import type {
  AiVisibilityProvider,
  EntityAnalysis,
  ExternalBrandFootprintResult,
  ExternalFootprintProvider,
  VisibilityScore,
} from './types';
import {
  createExternalFootprintProviderRegistry,
  externalFootprintProviderCandidates,
  externalFootprintProfiles,
  generateExternalFootprintQueries,
  measureExternalBrandFootprint,
  scoreExternalFootprintObservations,
} from './external-footprint';
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

export class RegistryExternalFootprintProvider implements ExternalFootprintProvider {
  async measure(input: { auditId: string; domain: string; entity: EntityAnalysis }): Promise<ExternalBrandFootprintResult> {
    return measureExternalBrandFootprint({
      auditId: input.auditId,
      domain: input.domain,
      entity: input.entity,
      profileId: 'FREE_EXTERNAL_FOOTPRINT',
    });
  }
}

export function buildVisibilityPromptModel(auditId: string, domain: string, entity: EntityAnalysis) {
  return generateVisibilityPrompts({
    auditId,
    entity: buildEntityProfile(normalizeDomain(domain) ?? domain, entity),
    profile: visibilityScanProfiles.FREE_QUICK_SCAN,
  });
}

export function buildExternalFootprintQueryModel(auditId: string, domain: string, entity: EntityAnalysis) {
  return generateExternalFootprintQueries({
    auditId,
    entity: buildEntityProfile(normalizeDomain(domain) ?? domain, entity),
    profile: externalFootprintProfiles.FREE_EXTERNAL_FOOTPRINT,
  });
}

export {
  createExternalFootprintProviderRegistry,
  createVisibilityProviderRegistry,
  externalFootprintProviderCandidates,
  externalFootprintProfiles,
  scoreExternalFootprintObservations,
  scoreVisibilityObservations,
  visibilityProviderCandidates,
  visibilityScanProfiles,
};

export const aiVisibilityProvider: AiVisibilityProvider = new RegistryAiVisibilityProvider();
export const externalFootprintProvider: ExternalFootprintProvider = new RegistryExternalFootprintProvider();
