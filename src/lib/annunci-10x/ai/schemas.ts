import { ANNUNCI10X_RUBRIC } from '../rubric.ts';
import { CHECK_STATUSES, PUBLICATION_CHANNELS } from '../constants.ts';
import type {
  ChannelVariant,
  CheckStatus,
  CommunicationStrategy,
  GeneratedAd,
  GeneratedSection,
  PublicationChannel,
  RoleCard,
  RoleProfile,
} from '../types.ts';
import {
  validateChannelVariant,
  validateCommunicationStrategy,
  validateGeneratedAd,
  validateRoleCard,
  validateRoleProfile,
} from '../validation.ts';

export type Annunci10xJsonSchema = {
  type: 'object';
  additionalProperties?: boolean;
  required?: string[];
  properties: Record<string, unknown>;
};

export type Annunci10xAiDetectedType = 'FULL_JOB_AD' | 'SOCIAL_TEASER' | 'INCOMPLETE_AD' | 'NOT_JOB_AD' | 'UNUSABLE';
export type Annunci10xClarifyStatus = 'COMPLETE' | 'NEEDS_CLARIFICATION';
export type Annunci10xValidationResultStatus = 'PASS' | 'NEEDS_REVISION' | 'BLOCK';
export type Annunci10xClaimKind = 'FACT' | 'EDITORIAL' | 'CLAIM';
export type Annunci10xClaimAction = 'KEEP' | 'REMOVE' | 'REQUEST_CONFIRMATION';
export type Annunci10xEditIntent = 'EDITORIAL' | 'FACTUAL' | 'STRATEGIC' | 'UNSUPPORTED_FACT';

export interface Annunci10xPrecheckOutput {
  detectedType: Annunci10xAiDetectedType;
  confidence: number;
  reason: string;
  canRunFullAnalysis: boolean;
}

export interface Annunci10xExtractedFact {
  targetPath: string;
  value: string | number | boolean;
  source: 'EXTRACTED' | 'USER_DECLARED';
  confidence: number;
  evidence?: string;
}

export interface Annunci10xExtractOutput {
  extractedFacts: Annunci10xExtractedFact[];
  possibleConflicts: { targetPath: string; values: string[]; reason: string }[];
}

export interface Annunci10xClarificationOutput {
  status: Annunci10xClarifyStatus;
  clarification?: {
    targetPath: string;
    reason: string;
    question: string;
    helpText?: string | null;
    blocking: boolean;
    canAdvance: boolean;
  };
}

export interface Annunci10xProfileOutput {
  challengeRoutine: { label: 'ROUTINE' | 'CHALLENGE' | 'MIXED' | 'UNKNOWN'; rationale: string; evidencePaths: string[]; confidence: number; needsConfirmation: boolean };
  qualification: { level: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN'; rationale: string; evidencePaths: string[]; confidence: number; needsConfirmation: boolean };
  demand: { level: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN'; rationale: string; evidencePaths: string[]; confidence: number; needsConfirmation: boolean };
  technicality: { level: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN'; rationale: string; evidencePaths: string[]; confidence: number; needsConfirmation: boolean };
}

export interface Annunci10xStrategyOutput {
  communicationStrategy: CommunicationStrategy;
  primaryStructure: string;
  openingStrategy: string;
  levers: string[];
  editorialLength: 'SHORT' | 'MEDIUM' | 'LONG';
  rationale: string;
  publicSummary: string;
}

export interface Annunci10xGenerateOutput {
  generatedAd: GeneratedAd;
  title: string;
  metadata: Record<string, string>;
  fullText: string;
  sourcePaths: string[];
}

export interface Annunci10xValidateOutput {
  claims: {
    id: string;
    kind: Annunci10xClaimKind;
    claim: string;
    supported: boolean;
    sourcePaths: string[];
    action: Annunci10xClaimAction;
  }[];
  unsupportedClaims: string[];
  contradictions: string[];
  omittedCriticalFacts: string[];
  alteredRequirements: string[];
  result: Annunci10xValidationResultStatus;
}

export interface Annunci10xEvaluateOutput {
  checks: { id: string; status: CheckStatus; evidence: string[]; reason: string; suggestion: string }[];
}

export interface Annunci10xChannelAdapterOutput {
  channelVariant: ChannelVariant;
}

export interface Annunci10xEditClassifierOutput {
  intent: Annunci10xEditIntent;
  affectedPaths: string[];
  requiresConfirmation: boolean;
  reason: string;
}

export interface Annunci10xReviseOutput {
  revisedSections: GeneratedSection[];
  changedSectionIds: string[];
  changeSummary: string;
  requiresValidation: true;
}

export type Annunci10xAiOutputByOperation = {
  PRECHECK: Annunci10xPrecheckOutput;
  EXTRACT: Annunci10xExtractOutput;
  CLARIFY: Annunci10xClarificationOutput;
  PROFILE: Annunci10xProfileOutput;
  STRATEGY: Annunci10xStrategyOutput;
  GENERATE: Annunci10xGenerateOutput;
  VALIDATE: Annunci10xValidateOutput;
  EVALUATE: Annunci10xEvaluateOutput;
  CHANNEL_ADAPTER: Annunci10xChannelAdapterOutput;
  EDIT_CLASSIFIER: Annunci10xEditClassifierOutput;
  REVISE: Annunci10xReviseOutput;
};

export const ANNUNCI10X_ALLOWED_ROLE_CARD_PATHS = [
  'title',
  'mission',
  'outcomes',
  'responsibilities',
  'requirements',
  'requirements.label',
  'requirements.classification',
  'compensation.amountText',
  'compensation.visibility',
  'compensation.currency',
  'compensation.cadence',
  'attractionContext.companyName',
  'attractionContext.companyDescription',
  'attractionContext.workMode',
  'attractionContext.location',
  'attractionContext.contractType',
  'attractionContext.schedule',
  'attractionContext.growth',
  'attractionContext.teamContext',
  'attractionContext.attractivenessEvidence',
] as const;

export const ANNUNCI10X_AI_OUTPUT_SCHEMAS = {
  PRECHECK: objectSchema(['detectedType', 'confidence', 'reason', 'canRunFullAnalysis'], {
    detectedType: enumSchema(['FULL_JOB_AD', 'SOCIAL_TEASER', 'INCOMPLETE_AD', 'NOT_JOB_AD', 'UNUSABLE']),
    confidence: numberSchema(),
    reason: stringSchema(),
    canRunFullAnalysis: booleanSchema(),
  }),
  EXTRACT: objectSchema(['extractedFacts', 'possibleConflicts'], {
    extractedFacts: arraySchema(objectSchema(['targetPath', 'value', 'source', 'confidence'], {
      targetPath: stringSchema(),
      value: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
      source: enumSchema(['EXTRACTED', 'USER_DECLARED']),
      confidence: numberSchema(),
      evidence: nullableStringSchema(),
    })),
    possibleConflicts: arraySchema(objectSchema(['targetPath', 'values', 'reason'], {
      targetPath: stringSchema(),
      values: arraySchema(stringSchema()),
      reason: stringSchema(),
    })),
  }),
  CLARIFY: objectSchema(['status'], {
    status: enumSchema(['COMPLETE', 'NEEDS_CLARIFICATION']),
    clarification: {
      anyOf: [
        objectSchema(['targetPath', 'reason', 'question', 'blocking', 'canAdvance'], {
          targetPath: stringSchema(),
          reason: stringSchema(),
          question: stringSchema(),
          helpText: nullableStringSchema(),
          blocking: booleanSchema(),
          canAdvance: booleanSchema(),
        }),
        { type: 'null' },
      ],
    },
  }),
  PROFILE: objectSchema(['challengeRoutine', 'qualification', 'demand', 'technicality'], {
    challengeRoutine: profileAspectSchema(['ROUTINE', 'CHALLENGE', 'MIXED', 'UNKNOWN']),
    qualification: profileAspectSchema(['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN']),
    demand: profileAspectSchema(['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN']),
    technicality: profileAspectSchema(['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN']),
  }),
  STRATEGY: objectSchema(['communicationStrategy', 'primaryStructure', 'openingStrategy', 'levers', 'editorialLength', 'rationale', 'publicSummary'], {
    communicationStrategy: { type: 'object', additionalProperties: true },
    primaryStructure: stringSchema(),
    openingStrategy: stringSchema(),
    levers: arraySchema(stringSchema()),
    editorialLength: enumSchema(['SHORT', 'MEDIUM', 'LONG']),
    rationale: stringSchema(),
    publicSummary: stringSchema(),
  }),
  GENERATE: objectSchema(['generatedAd', 'title', 'metadata', 'sections', 'fullText', 'sourcePaths'], {
    generatedAd: { type: 'object', additionalProperties: true },
    title: stringSchema(),
    metadata: { type: 'object', additionalProperties: { type: 'string' } },
    sections: arraySchema({ type: 'object', additionalProperties: true }),
    fullText: stringSchema(),
    sourcePaths: arraySchema(stringSchema()),
  }),
  VALIDATE: objectSchema(['claims', 'unsupportedClaims', 'contradictions', 'omittedCriticalFacts', 'alteredRequirements', 'result'], {
    claims: arraySchema(objectSchema(['id', 'kind', 'claim', 'supported', 'sourcePaths', 'action'], {
      id: stringSchema(),
      kind: enumSchema(['FACT', 'EDITORIAL', 'CLAIM']),
      claim: stringSchema(),
      supported: booleanSchema(),
      sourcePaths: arraySchema(stringSchema()),
      action: enumSchema(['KEEP', 'REMOVE', 'REQUEST_CONFIRMATION']),
    })),
    unsupportedClaims: arraySchema(stringSchema()),
    contradictions: arraySchema(stringSchema()),
    omittedCriticalFacts: arraySchema(stringSchema()),
    alteredRequirements: arraySchema(stringSchema()),
    result: enumSchema(['PASS', 'NEEDS_REVISION', 'BLOCK']),
  }),
  EVALUATE: objectSchema(['checks'], {
    checks: arraySchema(objectSchema(['id', 'status', 'evidence', 'reason', 'suggestion'], {
      id: stringSchema(),
      status: enumSchema(CHECK_STATUSES),
      evidence: arraySchema(stringSchema()),
      reason: stringSchema(),
      suggestion: stringSchema(),
    })),
  }),
  CHANNEL_ADAPTER: objectSchema(['channelVariant'], {
    channelVariant: { type: 'object', additionalProperties: true },
  }),
  EDIT_CLASSIFIER: objectSchema(['intent', 'affectedPaths', 'requiresConfirmation', 'reason'], {
    intent: enumSchema(['EDITORIAL', 'FACTUAL', 'STRATEGIC', 'UNSUPPORTED_FACT']),
    affectedPaths: arraySchema(stringSchema()),
    requiresConfirmation: booleanSchema(),
    reason: stringSchema(),
  }),
  REVISE: objectSchema(['revisedSections', 'changedSectionIds', 'changeSummary', 'requiresValidation'], {
    revisedSections: arraySchema({ type: 'object', additionalProperties: true }),
    changedSectionIds: arraySchema(stringSchema()),
    changeSummary: stringSchema(),
    requiresValidation: { type: 'boolean', const: true },
  }),
} as const satisfies Record<string, Annunci10xJsonSchema>;

export function validateAiOutputForOperation(operationType: keyof Annunci10xAiOutputByOperation, value: unknown): Annunci10xAiOutputByOperation[keyof Annunci10xAiOutputByOperation] {
  if (operationType === 'PRECHECK') return validatePrecheckOutput(value);
  if (operationType === 'EXTRACT') return validateExtractOutput(value);
  if (operationType === 'CLARIFY') return validateClarifyOutput(value);
  if (operationType === 'PROFILE') return validateProfileOutput(value);
  if (operationType === 'STRATEGY') return validateStrategyOutput(value);
  if (operationType === 'GENERATE') return validateGenerateOutput(value);
  if (operationType === 'VALIDATE') return validateValidateOutput(value);
  if (operationType === 'EVALUATE') return validateEvaluateOutput(value);
  if (operationType === 'CHANNEL_ADAPTER') return validateChannelAdapterOutput(value);
  if (operationType === 'EDIT_CLASSIFIER') return validateEditClassifierOutput(value);
  return validateReviseOutput(value);
}

export function validatePrecheckOutput(value: unknown): Annunci10xPrecheckOutput {
  const record = requireRecord(value, 'precheck');
  if (!oneOf(record.detectedType, ['FULL_JOB_AD', 'SOCIAL_TEASER', 'INCOMPLETE_AD', 'NOT_JOB_AD', 'UNUSABLE'])) throw new Error('precheck.detectedType is invalid');
  requirePercent(record.confidence, 'precheck.confidence');
  requireString(record.reason, 'precheck.reason');
  requireBoolean(record.canRunFullAnalysis, 'precheck.canRunFullAnalysis');
  return record as unknown as Annunci10xPrecheckOutput;
}

export function validateExtractOutput(value: unknown): Annunci10xExtractOutput {
  const record = requireRecord(value, 'extract');
  const facts = requireArray(record.extractedFacts, 'extract.extractedFacts');
  for (const [index, fact] of facts.entries()) {
    const item = requireRecord(fact, `extract.extractedFacts[${index}]`);
    assertAllowedRoleCardPath(String(item.targetPath), `extract.extractedFacts[${index}].targetPath`);
    if (!oneOf(item.source, ['EXTRACTED', 'USER_DECLARED'])) throw new Error(`extract.extractedFacts[${index}].source is invalid`);
    requirePercent(item.confidence, `extract.extractedFacts[${index}].confidence`);
    if (!['string', 'number', 'boolean'].includes(typeof item.value)) throw new Error(`extract.extractedFacts[${index}].value is invalid`);
  }
  for (const [index, conflict] of requireArray(record.possibleConflicts, 'extract.possibleConflicts').entries()) {
    const item = requireRecord(conflict, `extract.possibleConflicts[${index}]`);
    assertAllowedRoleCardPath(String(item.targetPath), `extract.possibleConflicts[${index}].targetPath`);
    requireStringArray(item.values, `extract.possibleConflicts[${index}].values`);
    requireString(item.reason, `extract.possibleConflicts[${index}].reason`);
  }
  return record as unknown as Annunci10xExtractOutput;
}

export function validateClarifyOutput(value: unknown): Annunci10xClarificationOutput {
  const record = requireRecord(value, 'clarify');
  if (!oneOf(record.status, ['COMPLETE', 'NEEDS_CLARIFICATION'])) throw new Error('clarify.status is invalid');
  if (record.status === 'COMPLETE') return { status: 'COMPLETE' };
  const clarification = requireRecord(record.clarification, 'clarify.clarification');
  assertAllowedRoleCardPath(String(clarification.targetPath), 'clarify.clarification.targetPath');
  requireString(clarification.reason, 'clarify.clarification.reason');
  requireString(clarification.question, 'clarify.clarification.question');
  requireBoolean(clarification.blocking, 'clarify.clarification.blocking');
  requireBoolean(clarification.canAdvance, 'clarify.clarification.canAdvance');
  return record as unknown as Annunci10xClarificationOutput;
}

export function validateProfileOutput(value: unknown): Annunci10xProfileOutput {
  const record = requireRecord(value, 'profile');
  requireProfileAspect(record.challengeRoutine, ['ROUTINE', 'CHALLENGE', 'MIXED', 'UNKNOWN'], 'profile.challengeRoutine');
  requireProfileAspect(record.qualification, ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'], 'profile.qualification');
  requireProfileAspect(record.demand, ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'], 'profile.demand');
  requireProfileAspect(record.technicality, ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'], 'profile.technicality');
  return record as unknown as Annunci10xProfileOutput;
}

export function validateStrategyOutput(value: unknown): Annunci10xStrategyOutput {
  const record = requireRecord(value, 'strategy');
  const strategy = validateCommunicationStrategy(record.communicationStrategy);
  if (!strategy.ok) throw new Error(`strategy.communicationStrategy invalid: ${strategy.errors.join('; ')}`);
  requireString(record.publicSummary, 'strategy.publicSummary');
  return record as unknown as Annunci10xStrategyOutput;
}

export function validateGenerateOutput(value: unknown): Annunci10xGenerateOutput {
  const record = requireRecord(value, 'generate');
  const ad = validateGeneratedAd(record.generatedAd);
  if (!ad.ok) throw new Error(`generate.generatedAd invalid: ${ad.errors.join('; ')}`);
  requireString(record.fullText, 'generate.fullText');
  requireStringArray(record.sourcePaths, 'generate.sourcePaths');
  return record as unknown as Annunci10xGenerateOutput;
}

export function validateValidateOutput(value: unknown): Annunci10xValidateOutput {
  const record = requireRecord(value, 'validate');
  if (!oneOf(record.result, ['PASS', 'NEEDS_REVISION', 'BLOCK'])) throw new Error('validate.result is invalid');
  requireStringArray(record.unsupportedClaims, 'validate.unsupportedClaims');
  requireStringArray(record.contradictions, 'validate.contradictions');
  requireStringArray(record.omittedCriticalFacts, 'validate.omittedCriticalFacts');
  requireStringArray(record.alteredRequirements, 'validate.alteredRequirements');
  for (const [index, claim] of requireArray(record.claims, 'validate.claims').entries()) {
    const item = requireRecord(claim, `validate.claims[${index}]`);
    if (!oneOf(item.kind, ['FACT', 'EDITORIAL', 'CLAIM'])) throw new Error(`validate.claims[${index}].kind is invalid`);
    if (!oneOf(item.action, ['KEEP', 'REMOVE', 'REQUEST_CONFIRMATION'])) throw new Error(`validate.claims[${index}].action is invalid`);
    requireBoolean(item.supported, `validate.claims[${index}].supported`);
    requireStringArray(item.sourcePaths, `validate.claims[${index}].sourcePaths`);
  }
  return record as unknown as Annunci10xValidateOutput;
}

export function validateEvaluateOutput(value: unknown): Annunci10xEvaluateOutput {
  const record = requireRecord(value, 'evaluate');
  const checks = requireArray(record.checks, 'evaluate.checks');
  if (checks.length !== ANNUNCI10X_RUBRIC.checks.length) throw new Error(`evaluate.checks must contain exactly ${ANNUNCI10X_RUBRIC.checks.length} checks`);
  const ids = new Set<string>();
  for (const [index, check] of checks.entries()) {
    const item = requireRecord(check, `evaluate.checks[${index}]`);
    const id = requireString(item.id, `evaluate.checks[${index}].id`);
    if ('score' in item || 'points' in item || 'finalScore' in item) throw new Error('evaluate output must not include arbitrary score fields');
    if (!ANNUNCI10X_RUBRIC.checks.some((definition) => definition.id === id)) throw new Error(`evaluate.checks[${index}].id is unknown`);
    if (ids.has(id)) throw new Error(`evaluate.checks duplicate id ${id}`);
    ids.add(id);
    if (!oneOf(item.status, CHECK_STATUSES)) throw new Error(`evaluate.checks[${index}].status is invalid`);
    requireStringArray(item.evidence, `evaluate.checks[${index}].evidence`);
    requireString(item.reason, `evaluate.checks[${index}].reason`);
    requireString(item.suggestion, `evaluate.checks[${index}].suggestion`);
  }
  return record as unknown as Annunci10xEvaluateOutput;
}

export function validateChannelAdapterOutput(value: unknown, master?: GeneratedAd): Annunci10xChannelAdapterOutput {
  const record = requireRecord(value, 'channelAdapter');
  const variant = validateChannelVariant(record.channelVariant, master);
  if (!variant.ok) throw new Error(`channelAdapter.channelVariant invalid: ${variant.errors.join('; ')}`);
  return record as unknown as Annunci10xChannelAdapterOutput;
}

export function validateEditClassifierOutput(value: unknown): Annunci10xEditClassifierOutput {
  const record = requireRecord(value, 'editClassifier');
  if (!oneOf(record.intent, ['EDITORIAL', 'FACTUAL', 'STRATEGIC', 'UNSUPPORTED_FACT'])) throw new Error('editClassifier.intent is invalid');
  requireStringArray(record.affectedPaths, 'editClassifier.affectedPaths');
  requireBoolean(record.requiresConfirmation, 'editClassifier.requiresConfirmation');
  requireString(record.reason, 'editClassifier.reason');
  return record as unknown as Annunci10xEditClassifierOutput;
}

export function validateReviseOutput(value: unknown): Annunci10xReviseOutput {
  const record = requireRecord(value, 'revise');
  for (const [index, section] of requireArray(record.revisedSections, 'revise.revisedSections').entries()) {
    const candidate = validateGeneratedAd({
      id: 'validation-master',
      sessionId: 'validation-session',
      kind: 'MASTER',
      sections: [section],
      sourceOfTruth: true,
      generatedAt: '2026-09-22T00:00:00.000Z',
      promptVersion: 'annunci10x-prompts-v1',
    });
    if (!candidate.ok) throw new Error(`revise.revisedSections[${index}] invalid: ${candidate.errors.join('; ')}`);
  }
  requireStringArray(record.changedSectionIds, 'revise.changedSectionIds');
  requireString(record.changeSummary, 'revise.changeSummary');
  if (record.requiresValidation !== true) throw new Error('revise.requiresValidation must be true');
  return record as unknown as Annunci10xReviseOutput;
}

export function validatePromptRoleCard(value: unknown): RoleCard {
  const validation = validateRoleCard(value);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  return validation.value;
}

export function validatePromptRoleProfile(value: unknown): RoleProfile {
  const validation = validateRoleProfile(value);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  return validation.value;
}

export function isPublicationChannel(value: unknown): value is PublicationChannel {
  return oneOf(value, PUBLICATION_CHANNELS);
}

function objectSchema(required: string[], properties: Record<string, unknown>): Annunci10xJsonSchema {
  return { type: 'object', additionalProperties: false, required, properties };
}

function profileAspectSchema(values: readonly string[]): unknown {
  return objectSchema(['level', 'rationale', 'evidencePaths', 'confidence', 'needsConfirmation'], {
    label: enumSchema(values),
    level: enumSchema(values),
    rationale: stringSchema(),
    evidencePaths: arraySchema(stringSchema()),
    confidence: numberSchema(),
    needsConfirmation: booleanSchema(),
  });
}

function enumSchema(values: readonly string[]): unknown {
  return { type: 'string', enum: values };
}

function stringSchema(): unknown {
  return { type: 'string' };
}

function nullableStringSchema(): unknown {
  return { anyOf: [{ type: 'string' }, { type: 'null' }] };
}

function booleanSchema(): unknown {
  return { type: 'boolean' };
}

function numberSchema(): unknown {
  return { type: 'number', minimum: 0, maximum: 100 };
}

function arraySchema(items: unknown): unknown {
  return { type: 'array', items };
}

function assertAllowedRoleCardPath(value: string, path: string): void {
  if (!ANNUNCI10X_ALLOWED_ROLE_CARD_PATHS.includes(value as (typeof ANNUNCI10X_ALLOWED_ROLE_CARD_PATHS)[number])) throw new Error(`${path} is not an allowed RoleCard path`);
}

function requireProfileAspect(value: unknown, values: readonly string[], path: string): void {
  const record = requireRecord(value, path);
  const label = record.label ?? record.level;
  if (!oneOf(label, values)) throw new Error(`${path}.level is invalid`);
  requireString(record.rationale, `${path}.rationale`);
  requireStringArray(record.evidencePaths, `${path}.evidencePaths`);
  requirePercent(record.confidence, `${path}.confidence`);
  requireBoolean(record.needsConfirmation, `${path}.needsConfirmation`);
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${path} must be an object`);
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  return value;
}

function requireStringArray(value: unknown, path: string): string[] {
  const items = requireArray(value, path);
  for (const [index, item] of items.entries()) requireString(item, `${path}[${index}]`);
  return items as string[];
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${path} must be a non-empty string`);
  return value;
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${path} must be boolean`);
  return value;
}

function requirePercent(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) throw new Error(`${path} must be 0-100`);
  return value;
}

function oneOf<const T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}
