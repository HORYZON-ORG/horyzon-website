import type { RoleCard } from '../types.ts';

export type Annunci10xDecision = 'PASS' | 'FAIL' | 'UNKNOWN';

export type Annunci10xFinalDecision = 'PASS' | 'FIX_REQUIRED' | 'BLOCK';

export type Annunci10xDecisionKey =
  | 'roleKnown'
  | 'companyContextKnown'
  | 'activitiesKnown'
  | 'requirementsKnown'
  | 'criticalContradictionsAbsent'
  | 'compensationCoherent'
  | 'contractCoherent'
  | 'applicationKnown';

export interface Annunci10xTruthFact {
  id: string;
  key: string;
  label: string;
  value: string;
  category:
    | 'ROLE'
    | 'COMPANY'
    | 'ACTIVITY'
    | 'REQUIREMENT_REQUIRED'
    | 'REQUIREMENT_PREFERRED'
    | 'REQUIREMENT_TRAINABLE'
    | 'BOUNDARY'
    | 'CONDITION'
    | 'COMPENSATION'
    | 'BENEFIT'
    | 'APPLICATION'
    | 'INTERLOCUTOR'
    | 'TECHNOLOGY';
  sourcePath: string;
  publishable: boolean;
}

export interface Annunci10xTruthLedger {
  version: 'annunci10x.truth-ledger.v1';
  roleCard: RoleCard;
  facts: Annunci10xTruthFact[];
}

export interface Annunci10xBaseAd {
  version: 'annunci10x.base-ad.v1';
  text: string;
  sections: Array<{
    id: string;
    title: string;
    lines: string[];
    factIds: string[];
  }>;
  internalBoundaries: Annunci10xTruthFact[];
}

export interface Annunci10xDecisionReport {
  preflight: {
    canGenerate: boolean;
    decisions: Record<Annunci10xDecisionKey, Annunci10xDecision>;
    reasons: string[];
  };
  preservation: {
    role: Annunci10xDecision;
    companyContext: Annunci10xDecision;
    location: Annunci10xDecision;
    workMode: Annunci10xDecision;
    schedule: Annunci10xDecision;
    contract: Annunci10xDecision;
    compensation: Annunci10xDecision;
    experience: Annunci10xDecision;
    technologies: Annunci10xDecision;
    requiredRequirements: Annunci10xDecision;
    preferredRequirements: Annunci10xDecision;
    benefits: Annunci10xDecision;
    application: Annunci10xDecision;
  };
  violations: {
    inventedBenefit: boolean;
    inventedTechnology: boolean;
    inventedApplicationProcess: boolean;
    requirementPromotion: boolean;
    preferredConsequence: boolean;
    trainablePromise: boolean;
    missingDataDisclosure: boolean;
    internalStructureLeak: boolean;
    mechanicalApplicationPlaceholder: boolean;
    conditionNegotiability: boolean;
    schedulePreferenceInference: boolean;
    employerBrandExpansion: boolean;
    entityExpansion: boolean;
    numericDrift: boolean;
    relationPurposeExpansion: boolean;
    responsibilityExpansion: boolean;
  };
  hardFailures: string[];
  unknowns: string[];
  warnings: string[];
  final: Annunci10xFinalDecision;
}

export interface Annunci10xRepairRequest {
  currentMaster: string;
  hardFailures: string[];
  repairInstructions: Array<{
    kind: 'ENTITY_CANONICALIZATION' | 'EXACT_NUMBER_CANONICALIZATION' | 'GROUNDED_RESPONSIBILITY_REWRITE';
    unsupportedText: string;
    canonicalText: string;
    instruction: string;
  }>;
  truthLedger: Annunci10xTruthLedger;
  baseAd: Annunci10xBaseAd;
}

export type Annunci10xCreateRuntimeStatus = 'READY_FOR_CLIENT' | 'BLOCK';

export type Annunci10xClientRevisionStatus =
  | 'REVISION_APPLIED'
  | 'REVISION_BLOCKED'
  | 'REVISION_LIMIT_REACHED';
