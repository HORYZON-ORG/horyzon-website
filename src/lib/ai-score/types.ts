export type AuditAccessLevel = 'FREE' | 'PREMIUM_AUDIT' | 'OPTIMIZATION_PLAN';
export type AuditPipelineState = 'queued' | 'crawling' | 'analyzing' | 'visibility_check' | 'scoring' | 'completed' | 'partial' | 'failed';
export type AuditMetricState = 'measured' | 'not_measured' | 'partial' | 'failed';
export type EvidenceConfidenceLabel = 'HIGH' | 'MEDIUM' | 'LOW';
export type CheckStatus = 'pass' | 'partial' | 'fail' | 'not_applicable' | 'unknown';
export type EvidenceVerification = 'present' | 'verified' | 'inferred';
export type StructuredDataStatus = 'valid' | 'incomplete' | 'invalid' | 'not_applicable' | 'unknown';
export type OpportunitySeverity = 'critical' | 'important' | 'optimization';

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

export interface AuditEvidence {
  label: string;
  value: string;
  sourceUrl?: string;
  verification: EvidenceVerification;
}

export interface AuditCheck {
  id: string;
  label: string;
  categoryId: ReadinessCategoryId;
  status: CheckStatus;
  pointsEarned: number;
  pointsAvailable: number;
  measured: boolean;
  evidence: AuditEvidence[];
}

export interface CategoryScore {
  id: ReadinessCategoryId;
  label: string;
  weight: number;
  state: AuditMetricState;
  score: number | null;
  pointsEarned: number;
  pointsAvailable: number;
  checksMeasured: number;
  checksApplicable: number;
}

export interface VisibilityPrompt {
  id: string;
  auditId: string;
  query: string;
  intent: 'brand' | 'sector' | 'service' | 'problem' | 'non_branded' | 'competitor';
  category: string;
  generatedBy: 'system' | 'human' | 'provider';
  approved: boolean;
}

export interface VisibilityEvidence {
  promptId: string;
  engine: string;
  timestamp: string;
  brandMentioned: boolean;
  domainCited: boolean;
  citedUrl?: string;
  competitorsMentioned: string[];
  sourcePosition?: number;
  evidence?: string;
  provider: string;
  confidence: number;
}

export interface VisibilityScore {
  state: 'measured' | 'not_measured' | 'partial' | 'failed';
  score: number | null;
  methodologyVersion: string;
  blocker?: string;
  weights: Record<'brandMentionRate' | 'citationRate' | 'promptCoverage' | 'shareOfVoice' | 'crossEngineConsistency' | 'citationSourceDiversity', number>;
  prompts: VisibilityPrompt[];
  evidence: VisibilityEvidence[];
}

export interface EntityAnalysis {
  brandName?: string;
  organizationType?: string;
  description?: string;
  services: string[];
  people: string[];
  locations: string[];
  sameAs: string[];
  ambiguitySignals: string[];
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
}

export interface PremiumAuditPayload {
  categoryScores: CategoryScore[];
  checks: AuditCheck[];
  entityAnalysis: EntityAnalysis;
  visibilityDetail: VisibilityScore;
  potentialScore: number | null;
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
  visibility: VisibilityScore;
  confidence: { value: number; label: EvidenceConfidenceLabel };
  interpretation: string;
  opportunities: { total: number; critical: number; important: number; optimization: number };
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

export type AuditStreamEvent =
  | { type: 'state'; state: AuditPipelineState; label: string }
  | { type: 'result'; audit: FreeAuditResult }
  | { type: 'error'; state: 'failed'; message: string };
