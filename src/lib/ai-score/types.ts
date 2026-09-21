export type AuditAccessLevel = 'FREE' | 'PREMIUM_AUDIT' | 'OPTIMIZATION_PLAN';
export type AuditPipelineState = 'queued' | 'crawling' | 'analyzing' | 'visibility_check' | 'scoring' | 'completed' | 'partial' | 'failed';
export type AuditMetricState = 'measured' | 'not_measured' | 'partial' | 'failed';
export type EvidenceConfidenceLabel = 'HIGH' | 'MEDIUM' | 'LOW';
export type CheckStatus = 'pass' | 'partial' | 'fail' | 'not_applicable' | 'unknown';
export type EvidenceVerification = 'present' | 'verified' | 'inferred';
export type EvidenceVerificationLevel = 'direct' | 'derived' | 'heuristic' | 'external' | 'provider' | 'not_measured';
export type EvidenceSourceType = 'html' | 'http' | 'robots' | 'sitemap' | 'structured_data' | 'headers' | 'provider' | 'derived';
export type StructuredDataStatus = 'valid' | 'incomplete' | 'invalid' | 'not_applicable' | 'unknown';
export type OpportunitySeverity = 'critical' | 'important' | 'optimization';
export type PageClassification = 'home' | 'about' | 'contact' | 'service' | 'product' | 'article' | 'legal' | 'other';
export type PotentialScoreState = 'not_calculated' | 'calculated';
export type ProviderMeasurementState = 'measured' | 'not_measured' | 'partial' | 'failed';
export type CheckWeightClass = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type ReadinessCoverageLabel = 'complete' | 'partial' | 'limited';
export type VisibilityPromptCategory = 'BRANDED' | 'CATEGORY' | 'SERVICE' | 'PROBLEM' | 'DISCOVERY' | 'COMPARISON';
export type VisibilityPromptIntent = 'branded' | 'category' | 'service' | 'problem' | 'recommendation_discovery' | 'competitor';
export type VisibilityPromptStatus = 'generated' | 'not_generated' | 'approved' | 'rejected' | 'invalid';
export type VisibilityObservationStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'SKIPPED' | 'NOT_CONFIGURED';

export type ReadinessCategoryId =
  | 'crawlability_indexability'
  | 'content_quality_citability'
  | 'entity_semantic_clarity'
  | 'structured_data'
  | 'authority_trust_evidence'
  | 'technical_quality_ux'
  | 'freshness_maintenance'
  | 'ai_agent_readiness'
  | 'external_brand_footprint';

export interface ReadinessCategoryDefinition {
  id: ReadinessCategoryId;
  label: string;
  weight: number;
  description: string;
}

export interface AuditCheckDefinition {
  id: string;
  categoryId: ReadinessCategoryId;
  label: string;
  description: string;
  weight: number;
  weightClass: CheckWeightClass;
  evidenceRequirements: string[];
  aggregation: 'site' | 'page_sample' | 'provider' | 'derived';
}

export interface AuditEvidence {
  id?: string;
  checkId?: string;
  label: string;
  value: string;
  sourceUrl?: string;
  sourceType?: EvidenceSourceType;
  pageType?: PageClassification;
  excerpt?: string;
  collectedAt?: string;
  confidence?: number;
  verification: EvidenceVerification;
  verificationLevel?: EvidenceVerificationLevel;
}

export interface AuditCheck {
  id: string;
  label: string;
  categoryId: ReadinessCategoryId;
  status: CheckStatus;
  pointsEarned: number;
  pointsAvailable: number;
  weightClass?: CheckWeightClass;
  measured: boolean;
  evidence: AuditEvidence[];
  definitionVersion?: string;
  aggregation?: AuditCheckDefinition['aggregation'];
}

export interface CategoryScore {
  id: ReadinessCategoryId;
  label: string;
  weight: number;
  state: AuditMetricState;
  score: number | null;
  pointsEarned: number;
  pointsAvailable: number;
  coverage: number;
  checksMeasured: number;
  checksApplicable: number;
}

export interface ReadinessCoverage {
  value: number;
  label: ReadinessCoverageLabel;
  measuredWeight: number;
  applicableWeight: number;
  measuredChecks: number;
  applicableChecks: number;
}

export interface CrawledPage {
  url: string;
  finalUrl: string;
  statusCode: number;
  depth: number;
  classification: PageClassification;
  classificationConfidence: number;
  title?: string;
  h1: string[];
  wordCount: number;
  internalLinks: string[];
  fetchedAt: string;
}

export interface CrawlSummary {
  requestedLimit: number;
  pagesFetched: number;
  pagesFailed: number;
  duplicateUrlsSkipped: number;
  classifications: Partial<Record<PageClassification, number>>;
  pages: CrawledPage[];
}

export interface ConfidenceBreakdown {
  score: number;
  label: EvidenceConfidenceLabel;
  checksCoverage: number;
  evidenceQuality: number;
  categoryCoverage: number;
  crawlCoverage: number;
  visibilityCoverage: number;
  externalCoverage: number;
  appliedFormulaVersion: string;
}

export interface EntityProfileField<T> {
  value: T;
  evidenceIds?: string[];
  source?: 'readiness_audit' | 'provider' | 'human' | 'unknown';
}

export interface EntityProfile {
  organizationName?: EntityProfileField<string>;
  alternateNames: EntityProfileField<string[]>;
  domain: string;
  canonicalDomain: string;
  description?: EntityProfileField<string>;
  industry?: EntityProfileField<string>;
  services: EntityProfileField<string[]>;
  products: EntityProfileField<string[]>;
  expertise: EntityProfileField<string[]>;
  audiences: EntityProfileField<string[]>;
  problemsSolved: EntityProfileField<string[]>;
  locations: EntityProfileField<string[]>;
  people: EntityProfileField<string[]>;
  competitors?: EntityProfileField<string[]>;
}

export interface VisibilityPrompt {
  id: string;
  auditId?: string;
  query: string;
  normalizedQuery?: string;
  category: VisibilityPromptCategory | string;
  intent: VisibilityPromptIntent;
  branded?: boolean;
  locationSpecific?: boolean;
  source?: 'entity_profile' | 'human' | 'provider' | 'test_fixture';
  generationMethod?: 'deterministic_v1' | 'manual' | 'provider';
  generatedBy: 'system' | 'human' | 'provider';
  approved: boolean;
  status: VisibilityPromptStatus;
  createdAt?: string;
  validationErrors?: string[];
}

export interface VisibilitySource {
  url: string;
  normalizedUrl: string;
  domain: string;
  title?: string;
  providerReference?: string;
}

export interface VisibilityObservation {
  id?: string;
  auditId?: string;
  promptId: string;
  providerId?: string;
  surface?: string;
  engine: string;
  model?: string;
  query?: string;
  startedAt?: string;
  completedAt?: string;
  timestamp: string;
  status?: VisibilityObservationStatus;
  brandMentioned: boolean;
  brandMentionEvidence?: string;
  domainCited: boolean;
  citedUrl?: string;
  citedUrls?: string[];
  sources?: VisibilitySource[];
  competitorsMentioned: string[];
  sourcePosition?: number;
  evidence?: string;
  rawResponseReference?: string;
  errorCode?: string;
  provider: string;
  confidence: number;
}

export type VisibilityEvidence = VisibilityObservation;

export interface VisibilityMetricBreakdown {
  brandMentionRate: number | null;
  citationRate: number | null;
  promptCoverage: number | null;
  shareOfVoice: number | null;
  crossEngineConsistency: number | null;
  citationSourceDiversity: number | null;
}

export interface VisibilityCoverage {
  value: number;
  plannedPrompts: number;
  generatedPrompts: number;
  executedPrompts: number;
  successfulObservations: number;
  plannedProviders: number;
  measuredProviders: number;
  metricAvailability: number;
}

export interface VisibilityProviderCandidate {
  id: string;
  label: string;
  surface: 'answer_engine' | 'grounded_search' | 'search_api' | 'future_candidate';
  evidenceAvailable: string[];
  requiresCredential: boolean;
  blocker: string;
}

export interface VisibilityProviderStatus {
  id: string;
  label: string;
  surface: string;
  configured: boolean;
  enabled: boolean;
  liveCalls: number;
}

export interface VisibilityScore {
  state: ProviderMeasurementState;
  score: number | null;
  coverage?: number;
  coverageDetail?: VisibilityCoverage;
  methodologyVersion: string;
  blocker?: string;
  scanProfileId?: string;
  weights: Record<'brandMentionRate' | 'citationRate' | 'promptCoverage' | 'shareOfVoice' | 'crossEngineConsistency' | 'citationSourceDiversity', number>;
  prompts: VisibilityPrompt[];
  evidence: VisibilityEvidence[];
  observations?: VisibilityObservation[];
  metricBreakdown?: VisibilityMetricBreakdown;
  providerCandidates?: VisibilityProviderCandidate[];
  providerStatuses?: VisibilityProviderStatus[];
}

export interface ExternalBrandFootprintResult {
  state: ProviderMeasurementState;
  provider: string;
  measuredAt?: string;
  blocker?: string;
  brandMentions: number | null;
  independentSources: number | null;
  officialProfiles: string[];
  evidence: AuditEvidence[];
}

export interface EntityAnalysis {
  brandName?: string;
  organizationType?: string;
  description?: string;
  services: string[];
  products: string[];
  audience: string[];
  people: string[];
  locations: string[];
  sameAs: string[];
  ambiguitySignals: string[];
  sourcePages: string[];
}

export interface RemediationItem {
  checkId: string;
  title: string;
  whyItMatters: string;
  howToFix?: string;
  verification?: string;
  priority: OpportunitySeverity;
  effort: 'low' | 'medium' | 'high';
  expectedImpact: 'low' | 'medium' | 'high';
  evidenceIds: string[];
  confidence: number;
  scoreImpact: number;
}

export interface PotentialScore {
  state: PotentialScoreState;
  score: number | null;
  blocker?: string;
  calculatedFromFindingIds: string[];
}

export interface PremiumAuditPayload {
  categoryScores: CategoryScore[];
  checks: AuditCheck[];
  crawlSummary: CrawlSummary;
  entityAnalysis: EntityAnalysis;
  externalBrandFootprint: ExternalBrandFootprintResult;
  visibilityDetail: VisibilityScore;
  potentialScore: PotentialScore;
  remediationSummary: RemediationItem[];
}

export interface FreeAuditResult {
  auditId: string;
  accessLevel: AuditAccessLevel;
  domain: string;
  finalUrl: string;
  analyzedAt: string;
  methodologyVersion: string;
  readiness: { state: AuditMetricState; score: number | null };
  readinessCoverage?: ReadinessCoverage;
  visibility: VisibilityScore;
  confidence: ConfidenceBreakdown & { value: number };
  interpretation: string;
  opportunities: { total: number; critical: number; important: number; optimization: number };
  signalsAnalyzed: number;
  pagesAnalyzed: number;
  status: Extract<AuditPipelineState, 'completed' | 'partial' | 'failed'>;
  notice?: string;
  locked: {
    premiumAudit: true;
    optimizationPlan: true;
    availableLevels: AuditAccessLevel[];
    priceConfigured: false;
  };
}

export interface InternalAuditResult extends FreeAuditResult {
  premium: PremiumAuditPayload;
}

export interface CostEstimate {
  providerId: string;
  requestCount: number;
  estimatedCost: number;
  currency: 'USD' | 'EUR';
}

export interface VisibilityExecutionContext {
  auditId: string;
  entity: EntityProfile;
  profileId: string;
  timeoutMs: number;
  startedAt: string;
}

export interface AiVisibilityProviderAdapter {
  id: string;
  label: string;
  surface: string;
  enabled: boolean;
  isConfigured(): boolean;
  estimateCost?(prompts: VisibilityPrompt[]): Promise<CostEstimate>;
  execute(prompt: VisibilityPrompt, context: VisibilityExecutionContext): Promise<VisibilityObservation>;
}

export interface AiVisibilityProvider {
  measure(input: { auditId: string; domain: string; entity: EntityAnalysis }): Promise<VisibilityScore>;
}

export interface ExternalFootprintProvider {
  measure(input: { auditId: string; domain: string; entity: EntityAnalysis }): Promise<ExternalBrandFootprintResult>;
}

export interface AuditRepository {
  findRecent(cacheKey: string): Promise<InternalAuditResult | null>;
  save(cacheKey: string, audit: InternalAuditResult): Promise<void>;
}

export type AuditStreamEvent =
  | { type: 'state'; state: AuditPipelineState; label: string }
  | { type: 'result'; audit: FreeAuditResult }
  | { type: 'error'; state: 'failed'; message: string };
