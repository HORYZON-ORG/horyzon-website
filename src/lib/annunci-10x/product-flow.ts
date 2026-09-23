import { randomUUID } from 'node:crypto';
import {
  ANNUNCI10X_PROMPT_PACK_VERSION,
  ANNUNCI10X_RUBRIC_VERSION,
  ANNUNCI10X_STRATEGY_VERSION,
  ANNUNCI10X_DATA_CONTRACT_VERSION,
  ANNUNCI10X_METHOD_VERSION,
} from './constants.ts';
import { ANNUNCI10X_RUBRIC } from './rubric.ts';
import { criticalMissingData, evaluatePublicationGate, materialConflict } from './gates.ts';
import { calculateScoreAndGateFromEvaluateOutput } from './ai/orchestrator.ts';
import { Annunci10xAiError } from './ai/errors.ts';
import { MockAnnunci10xProvider } from './ai/mock-provider.ts';
import { OpenAiAnnunci10xProvider } from './ai/openai-provider.ts';
import { Annunci10xAiOrchestrator } from './ai/orchestrator.ts';
import { resolveAnnunci10xCommercial, type Annunci10xCommercialOffer } from './commercial.ts';
import { buildRoleContextPresentation, deriveResultPriorities, deriveResultStrengths, type RoleContextMismatch } from './presentation.ts';
import type { Annunci10xEvaluateOutput, Annunci10xExtractOutput, Annunci10xProfileOutput } from './ai/schemas.ts';
import { createFact } from './validation.ts';
import type { Annunci10xPersistenceAdapter, PersistedAnnunci10xSession, PersistedEvaluation, PersistedSnapshot } from './persistence/types.ts';
import { createAnnunci10xPersistenceAdapter } from './persistence/adapter.ts';
import type { Annunci10xAiProvider } from './ai/provider.ts';
import type { CommercialContext, CommunicationStrategy, EvaluationCheck, PublicationChannel, PublicationGate, RoleCard, RoleProfile, ScoreResult } from './types.ts';

export const ANNUNCI10X_COOKIE_NAME = 'horyzon_annunci10x_session';
export const ANNUNCI10X_MAX_AD_CHARS = 12_000;
export const ANNUNCI10X_MIN_AD_CHARS = 80;

export type Annunci10xConfiguredProvider = 'MOCK' | 'OPENAI';

export interface Annunci10xSessionCookie {
  sessionId: string;
  sessionSecret: string;
}

export interface Annunci10xRuntimeContext {
  persistence: Annunci10xPersistenceAdapter;
  provider: Annunci10xAiProvider;
  configuredProvider: Annunci10xConfiguredProvider;
}

export interface PublicAnnunci10xOperation {
  type: string;
  promptVersion: string;
  model: string;
  provider: Annunci10xConfiguredProvider;
  schemaValid: boolean;
  latencyMs: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  cachedTokens?: number | null;
  providerRequestId?: string | null;
  idempotencyHit: boolean;
}

export interface PublicAnnunci10xAnalysisResult {
  sessionId: string;
  snapshotId: string;
  evaluationId: string;
  score: ScoreResult & { minScore?: number; maxScore?: number; finalScore?: number | null };
  gate: PublicationGate;
  coverage: number;
  roleSummary: {
    title: string;
    titleSource: 'OBSERVED' | 'DECLARED_CONTEXT' | 'UNKNOWN';
    observedTitle: string | null;
    declaredTitle: string | null;
    roleMismatch: RoleContextMismatch;
    companyName: string;
    location: string;
    workMode: string;
    contractType: string;
    missingFacts: string[];
  };
  strengths: string[];
  priorities: string[];
  checks: EvaluationCheck[];
  clarification?: {
    id: string;
    targetPath: string;
    question: string;
    reason: string;
    blocking: boolean;
    canSkip: boolean;
  } | null;
  offers: {
    guideStandalone: 'OPEN_DECISION';
    adGeneration: 'OPEN_DECISION';
    bundle: 'OPEN_DECISION';
    checkoutEnabled: false;
    pricingStatus: 'OPEN_DECISION';
    availableOffers: Annunci10xCommercialOffer[];
    entitlements: {
      guide: boolean;
      adGenerationCredits: number;
      source: string;
    };
  };
  stages: string[];
  operations: PublicAnnunci10xOperation[];
  provider: Annunci10xConfiguredProvider;
  analyzedAt: string;
}

export interface RunFreeAnalysisInput {
  sessionId: string;
  sessionSecret: string;
  rawAdText: string;
  roleHint?: string;
  companyHint?: string;
  channelHint?: PublicationChannel;
  context?: Annunci10xRuntimeContext;
}

export interface AnswerClarificationInput {
  sessionId: string;
  sessionSecret: string;
  targetPath: string;
  clarificationId?: string;
  answer: string;
  context?: Annunci10xRuntimeContext;
}

export function createAnnunci10xRuntimeContext(env: Record<string, string | undefined> = process.env): Annunci10xRuntimeContext {
  const configuredProvider = readConfiguredProvider(env);
  return {
    configuredProvider,
    provider: configuredProvider === 'MOCK' ? new MockAnnunci10xProvider('success') : new OpenAiAnnunci10xProvider(),
    persistence: createAnnunci10xPersistenceAdapter(),
  };
}

export function readConfiguredProvider(env: Record<string, string | undefined> = process.env): Annunci10xConfiguredProvider {
  const configured = env.ANNUNCI10X_AI_PROVIDER?.trim().toUpperCase();
  if (configured === 'MOCK' || configured === 'OPENAI') return configured;
  throw new Annunci10xAiError('AI_PROVIDER_ERROR', 'ANNUNCI10X_AI_PROVIDER must be explicitly set to MOCK or OPENAI.', { retryable: false });
}

export async function createAnonymousAnalyzeSession(context: Annunci10xRuntimeContext): Promise<{ session: PersistedAnnunci10xSession; sessionSecret: string }> {
  const created = await context.persistence.createSession({
    flow: 'ANALYZE',
    commercialContext: createOpenDecisionCommercialContext(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
  });
  await context.persistence.appendEvent({
    sessionId: created.session.id,
    eventName: 'session_started',
    metadata: { entryMode: 'ANALYZE', provider: context.configuredProvider },
  });
  await context.persistence.appendEvent({
    sessionId: created.session.id,
    eventName: 'flow_selected',
    metadata: { flow: 'ANALYZE' },
  });
  return created;
}

export async function runFreeAnnunci10xAnalysis(input: RunFreeAnalysisInput): Promise<PublicAnnunci10xAnalysisResult> {
  const context = input.context ?? createAnnunci10xRuntimeContext();
  assertRawAd(input.rawAdText);
  await requireOwnedSession(context, input.sessionId, input.sessionSecret, 'ANALYZE');
  await context.persistence.appendEvent({ sessionId: input.sessionId, eventName: 'original_ad_submitted', metadata: { lengthBucket: bucketLength(input.rawAdText) } });

  const orchestrator = new Annunci10xAiOrchestrator({ provider: context.provider, persistence: context.persistence });
  const operations: PublicAnnunci10xOperation[] = [];
  const originalAd = {
    id: `original-${stableShortId(input.rawAdText)}`,
    sessionId: input.sessionId,
    type: 'PASTED_TEXT' as const,
    rawText: input.rawAdText,
    uploadedAt: new Date().toISOString(),
    immutable: true as const,
  };

  const precheck = await orchestrator.runTask({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    operationType: 'PRECHECK',
    input: { rawText: input.rawAdText, declaredChannel: input.channelHint ?? 'LINKEDIN', roleHint: input.roleHint ?? null, companyHint: input.companyHint ?? null, entryMode: 'ANALYZE' },
  });
  operations.push(toPublicOperation(precheck, 'PRECHECK', context.configuredProvider));
  await context.persistence.appendEvent({ sessionId: input.sessionId, eventName: 'precheck_completed', metadata: { detectedType: precheck.output.detectedType, canRunFullAnalysis: precheck.output.canRunFullAnalysis } });

  if (!precheck.output.canRunFullAnalysis || precheck.output.detectedType === 'NOT_JOB_AD' || precheck.output.detectedType === 'UNUSABLE') {
    throw new Annunci10xPublicError('INVALID_INPUT', precheck.output.reason || 'Il testo non contiene abbastanza elementi per analizzare un annuncio.', 422);
  }

  const extract = await orchestrator.runTask({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    operationType: 'EXTRACT',
    input: { originalAd, existingRoleCard: null },
  });
  operations.push(toPublicOperation(extract, 'EXTRACT', context.configuredProvider));

  const roleCard = buildRoleCardFromExtract(input.rawAdText, extract.output as Annunci10xExtractOutput, input.roleHint, input.companyHint);
  const initialSnapshot = await context.persistence.appendSnapshot({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    roleCard,
    reason: 'INITIAL_EXTRACTION',
  });

  const profileTask = await orchestrator.runTask({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    operationType: 'PROFILE',
    input: { roleCard, originalAd },
    inputSnapshotId: initialSnapshot.id,
  });
  operations.push(toPublicOperation(profileTask, 'PROFILE', context.configuredProvider));
  const roleProfile = buildRoleProfile(roleCard, profileTask.output as Annunci10xProfileOutput);

  const strategyTask = await orchestrator.runTask({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    operationType: 'STRATEGY',
    input: { roleCard, roleProfile, channel: input.channelHint ?? 'LINKEDIN' },
    inputSnapshotId: initialSnapshot.id,
  });
  operations.push(toPublicOperation(strategyTask, 'STRATEGY', context.configuredProvider));
  const communicationStrategy = normalizeStrategy(strategyTask.output.communicationStrategy, input.sessionId);

  const snapshot = await context.persistence.appendSnapshot({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    roleCard,
    roleProfile,
    communicationStrategy,
    reason: 'INITIAL_EXTRACTION',
  });

  const evaluate = await orchestrator.runTask({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    operationType: 'EVALUATE',
    input: { target: { kind: 'ORIGINAL_AD', originalAdId: originalAd.id }, originalAd, roleCard, roleProfile, communicationStrategy, rubric: ANNUNCI10X_RUBRIC },
    inputSnapshotId: snapshot.id,
  });
  operations.push(toPublicOperation(evaluate, 'EVALUATE', context.configuredProvider));

  const { score, gate } = scoreAndGate(evaluate.output as Annunci10xEvaluateOutput, extract.output as Annunci10xExtractOutput);
  const evaluation = await context.persistence.saveEvaluation({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    target: { kind: 'ORIGINAL_AD', originalAdId: originalAd.id },
    targetRef: originalAd.id,
    score,
    gate,
  });

  const clarify = await orchestrator.runTask({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    operationType: 'CLARIFY',
    input: { currentStep: 'CONDITIONS', roleCard, roleProfile, unresolvedConflicts: extract.output.possibleConflicts, score },
    inputSnapshotId: snapshot.id,
  });
  operations.push(toPublicOperation(clarify, 'CLARIFY', context.configuredProvider));

  await context.persistence.appendEvent({ sessionId: input.sessionId, eventName: 'analysis_completed', metadata: { coverage: score.coverage, gateStatus: gate.status } });
  if (clarify.output.status === 'NEEDS_CLARIFICATION') {
    await context.persistence.appendEvent({ sessionId: input.sessionId, eventName: 'clarification_requested', metadata: { targetPath: clarify.output.clarification?.targetPath ?? 'unknown' } });
  }

  return await publicResult({
    sessionId: input.sessionId,
    snapshot,
    evaluation,
    score,
    gate,
    roleCard,
    declaredRole: input.roleHint,
    clarification: clarify.output.status === 'NEEDS_CLARIFICATION' && clarify.output.clarification ? {
      id: `clarification-${stableShortId(clarify.output.clarification.targetPath)}`,
      targetPath: clarify.output.clarification.targetPath,
      question: clarify.output.clarification.question,
      reason: clarify.output.clarification.reason,
      blocking: clarify.output.clarification.blocking,
      canSkip: clarify.output.clarification.canAdvance,
    } : null,
    operations,
    provider: context.configuredProvider,
  });
}

export async function answerAnnunci10xClarification(input: AnswerClarificationInput): Promise<PublicAnnunci10xAnalysisResult> {
  const context = input.context ?? createAnnunci10xRuntimeContext();
  if (!input.answer.trim()) throw new Annunci10xPublicError('INVALID_INPUT', 'Inserisci una risposta o salta la domanda.', 400);
  const session = await requireOwnedSession(context, input.sessionId, input.sessionSecret, 'ANALYZE');
  const latest = await context.persistence.getLatestSnapshot(input.sessionId, input.sessionSecret);
  if (!latest) throw new Annunci10xPublicError('INVALID_INPUT', 'Nessuna analisi da aggiornare.', 409);

  await context.persistence.appendAnswer({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    interviewStep: stepFromPath(input.targetPath),
    questionId: input.targetPath,
    clarificationId: input.clarificationId,
    rawAnswer: input.answer,
  });

  const roleCard = applyAnswerToRoleCard(latest.roleCard, input.targetPath, input.answer);
  const snapshot = await context.persistence.appendSnapshot({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    roleCard,
    roleProfile: latest.roleProfile ? { ...latest.roleProfile, roleCard } : null,
    communicationStrategy: latest.communicationStrategy ?? null,
    reason: 'USER_ANSWER',
  });

  const orchestrator = new Annunci10xAiOrchestrator({ provider: context.provider, persistence: context.persistence });
  const operations: PublicAnnunci10xOperation[] = [];
  const evaluate = await orchestrator.runTask({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    operationType: 'EVALUATE',
    input: { target: { kind: 'ORIGINAL_AD', originalAdId: `clarified-${snapshot.id}` }, roleCard, roleProfile: latest.roleProfile, communicationStrategy: latest.communicationStrategy, rubric: ANNUNCI10X_RUBRIC },
    inputSnapshotId: snapshot.id,
    promptVersionOverride: `${ANNUNCI10X_PROMPT_PACK_VERSION}.clarified`,
  });
  operations.push(toPublicOperation(evaluate, 'EVALUATE', context.configuredProvider));
  const { score, gate } = scoreAndGate(evaluate.output as Annunci10xEvaluateOutput, { extractedFacts: [], possibleConflicts: [] });
  const evaluation = await context.persistence.saveEvaluation({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    target: { kind: 'ORIGINAL_AD', originalAdId: `clarified-${snapshot.id}` },
    targetRef: `clarified-${snapshot.id}`,
    score,
    gate,
  });
  await context.persistence.appendEvent({ sessionId: session.id, eventName: 'analysis_completed', metadata: { coverage: score.coverage, gateStatus: gate.status, afterClarification: true } });

  return await publicResult({ sessionId: input.sessionId, snapshot, evaluation, score, gate, roleCard, clarification: null, operations, provider: context.configuredProvider });
}

export async function resumeAnnunci10xAnalysis(cookie: Annunci10xSessionCookie, context: Annunci10xRuntimeContext): Promise<{ session: PersistedAnnunci10xSession; snapshot: PersistedSnapshot | null; evaluation: PersistedEvaluation | null }> {
  const session = await requireOwnedSession(context, cookie.sessionId, cookie.sessionSecret, 'ANALYZE');
  const snapshot = await context.persistence.getLatestSnapshot(cookie.sessionId, cookie.sessionSecret);
  const evaluation = await context.persistence.getLatestEvaluation(cookie.sessionId, cookie.sessionSecret);
  await context.persistence.appendEvent({ sessionId: cookie.sessionId, eventName: 'analysis_resumed', metadata: { hasSnapshot: Boolean(snapshot), hasEvaluation: Boolean(evaluation) } });
  return { session, snapshot, evaluation };
}

export function encodeAnnunci10xCookie(value: Annunci10xSessionCookie): string {
  return `${value.sessionId}.${value.sessionSecret}`;
}

export function decodeAnnunci10xCookie(value: string | undefined): Annunci10xSessionCookie | null {
  if (!value) return null;
  const [sessionId, sessionSecret, ...extra] = value.split('.');
  if (extra.length || !sessionId || !sessionSecret || sessionSecret.length < 32) return null;
  return { sessionId, sessionSecret };
}

export function createOpenDecisionCommercialContext(): CommercialContext {
  const now = new Date().toISOString();
  return {
    productCode: 'AD_GENERATION',
    entitlements: {
      guide: false,
      adGeneration: false,
      bundle: false,
      source: 'OPEN_DECISION',
      verification: 'SERVER_VERIFIED',
      checkedAt: now,
      serverAuthorityId: 'annunci10x-open-decision',
    },
    reservedOfferEligible: false,
    reservedOfferReason: 'NONE',
    price: 'OPEN_DECISION',
    discountValue: 'OPEN_DECISION',
  };
}

export class Annunci10xPublicError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'Annunci10xPublicError';
    this.code = code;
    this.status = status;
  }
}

function assertRawAd(rawAdText: string): void {
  const length = rawAdText.trim().length;
  if (length < ANNUNCI10X_MIN_AD_CHARS) throw new Annunci10xPublicError('INVALID_INPUT', 'Il testo e troppo breve per una valutazione utile.', 400);
  if (length > ANNUNCI10X_MAX_AD_CHARS) throw new Annunci10xPublicError('INVALID_INPUT', 'Il testo supera il limite massimo per l analisi gratuita.', 413);
}

async function requireOwnedSession(context: Annunci10xRuntimeContext, sessionId: string, sessionSecret: string, flow?: 'ANALYZE' | 'CREATE'): Promise<PersistedAnnunci10xSession> {
  const session = await context.persistence.getSession(sessionId, sessionSecret);
  if (!session) throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione Annunci 10x non valida o scaduta.', 401);
  if (flow && session.flow !== flow) throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione Annunci 10x non compatibile con questo percorso.', 409);
  return session;
}

function buildRoleCardFromExtract(rawText: string, extract: Annunci10xExtractOutput, roleHint?: string, companyHint?: string): RoleCard {
  const facts = new Map(extract.extractedFacts.map((fact) => [fact.targetPath, fact]));
  const extractedTitle = facts.get('title')?.value;
  const title = extractedTitle
    ? stringFact(extractedTitle, 'EXTRACTED', 'original-title')
    : roleHint
      ? stringFact(roleHint, 'USER_DECLARED', 'role-hint')
      : stringFact(guessTitle(rawText), 'EXTRACTED', 'original-title');
  const responsibility = stringFact(facts.get('responsibilities')?.value ?? guessResponsibility(rawText), 'EXTRACTED', 'original-responsibility');
  const mission = stringFact(guessMission(rawText), 'SYSTEM_INFERRED', 'mission-nd', false);
  const requirement = stringFact(guessRequirement(rawText), 'EXTRACTED', 'original-requirement');
  return {
    title,
    mission,
    outcomes: [stringFact(guessOutcome(rawText), 'SYSTEM_INFERRED', 'outcome-nd', false)],
    responsibilities: [responsibility],
    requirements: [{ id: 'req-1', label: requirement, classification: 'REQUIRED' }],
    compensation: {
      visibility: stringFact(hasCompensation(rawText) ? 'PUBLIC' : 'OPEN_DECISION', hasCompensation(rawText) ? 'EXTRACTED' : 'SYSTEM_INFERRED', 'compensation-visibility', hasCompensation(rawText)) as never,
      amountText: hasCompensation(rawText) ? stringFact(guessCompensation(rawText), 'EXTRACTED', 'compensation') : undefined,
    },
    attractionContext: {
      companyName: companyHint ? stringFact(companyHint, 'USER_DECLARED', 'company-hint') : undefined,
      workMode: findWorkMode(rawText),
      location: findLocation(rawText),
      contractType: findContract(rawText),
      schedule: findSchedule(rawText),
      attractivenessEvidence: [],
    },
  };
}

function buildRoleProfile(roleCard: RoleCard, profile: Annunci10xProfileOutput): RoleProfile {
  const levelFact = (value: string, sourceId: string) => createFact(value, 'SYSTEM_INFERRED', { sourceId, publishable: false, confidence: 70 }) as never;
  return {
    roleCard,
    rolePopularity: levelFact(profile.demand.level === 'UNKNOWN' ? 'UNKNOWN' : 'MEDIUM', 'profile-demand'),
    companyAttractiveness: levelFact('UNKNOWN', 'profile-company'),
    challengeLevel: levelFact(profile.challengeRoutine.label === 'CHALLENGE' ? 'HIGH' : profile.challengeRoutine.label === 'ROUTINE' ? 'LOW' : 'MEDIUM', 'profile-challenge'),
    routineLevel: levelFact(profile.challengeRoutine.label === 'ROUTINE' ? 'HIGH' : profile.challengeRoutine.label === 'CHALLENGE' ? 'LOW' : 'MEDIUM', 'profile-routine'),
    qualificationLevel: levelFact(profile.qualification.level, 'profile-qualification'),
    commitmentLevel: levelFact('UNKNOWN', 'profile-commitment'),
    technicality: levelFact(profile.technicality.level, 'profile-technicality'),
  };
}

function normalizeStrategy(strategy: CommunicationStrategy, sessionId: string): CommunicationStrategy {
  return {
    ...strategy,
    id: strategy.id || randomUUID(),
    sessionId,
    versions: versions(),
  };
}

function scoreAndGate(output: Annunci10xEvaluateOutput, extract: Annunci10xExtractOutput): { score: ScoreResult & { minScore?: number; maxScore?: number; finalScore?: number | null }; gate: PublicationGate } {
  const deterministic = calculateScoreAndGateFromEvaluateOutput(output);
  const findings = [];
  for (const conflict of extract.possibleConflicts) findings.push(materialConflict(conflict.reason, 'BLOCKING'));
  const missingCritical = output.checks.filter((check) => check.status === 'MISSING' && ['12', '13', '20'].includes(check.id));
  for (const check of missingCritical) findings.push(criticalMissingData(check.reason || `Informazione critica mancante: ${check.id}`, 'WARNING'));
  return {
    score: deterministic.score,
    gate: findings.length ? evaluatePublicationGate({ findings }) : deterministic.gate,
  };
}

async function publicResult(input: {
  sessionId: string;
  snapshot: PersistedSnapshot;
  evaluation: PersistedEvaluation;
  score: ScoreResult & { minScore?: number; maxScore?: number; finalScore?: number | null };
  gate: PublicationGate;
  roleCard: RoleCard;
  declaredRole?: string | null;
  clarification: PublicAnnunci10xAnalysisResult['clarification'];
  operations: PublicAnnunci10xOperation[];
  provider: Annunci10xConfiguredProvider;
}): Promise<PublicAnnunci10xAnalysisResult> {
  const observedTitle = input.roleCard.title?.source === 'EXTRACTED' || input.roleCard.title?.source === 'USER_CONFIRMED'
    ? textValue(input.roleCard.title)
    : null;
  const roleContext = buildRoleContextPresentation({
    declaredRole: input.declaredRole ?? (input.roleCard.title?.source === 'USER_DECLARED' ? textValue(input.roleCard.title) : null),
    observedRole: observedTitle,
  });
  const commercial = await resolveAnnunci10xCommercial({
    subject: { kind: 'SESSION', sessionId: input.sessionId },
    flow: 'ANALYZE',
    journeyState: 'PRODUCT_PAGE',
  });
  return {
    sessionId: input.sessionId,
    snapshotId: input.snapshot.id,
    evaluationId: input.evaluation.id,
    score: input.score,
    gate: input.gate,
    coverage: input.score.coverage,
    roleSummary: {
      title: roleContext.displayTitle,
      titleSource: roleContext.displayTitleSource,
      observedTitle: roleContext.observedTitle,
      declaredTitle: roleContext.declaredTitle,
      roleMismatch: roleContext.mismatch,
      companyName: textValue(input.roleCard.attractionContext.companyName),
      location: textValue(input.roleCard.attractionContext.location),
      workMode: textValue(input.roleCard.attractionContext.workMode),
      contractType: textValue(input.roleCard.attractionContext.contractType),
      missingFacts: missingFacts(input.roleCard),
    },
    strengths: deriveResultStrengths(input.score.checks),
    priorities: deriveResultPriorities(input.score.checks),
    checks: input.score.checks,
    clarification: input.clarification,
    offers: {
      guideStandalone: 'OPEN_DECISION',
      adGeneration: 'OPEN_DECISION',
      bundle: 'OPEN_DECISION',
      checkoutEnabled: false,
      pricingStatus: commercial.pricingStatus,
      availableOffers: commercial.availableOffers,
      entitlements: {
        guide: commercial.entitlements.guide,
        adGenerationCredits: commercial.entitlements.adGenerationCredits,
        source: commercial.entitlements.source,
      },
    },
    stages: ['PRECHECK', 'EXTRACT', 'PROFILE', 'STRATEGY', 'EVALUATE', 'CLARIFY'],
    operations: input.operations,
    provider: input.provider,
    analyzedAt: new Date().toISOString(),
  };
}

function toPublicOperation(result: { operation: { promptVersion: string }; model: string; provider: string; usage?: { inputTokens?: number | null; outputTokens?: number | null; totalTokens?: number | null; cachedTokens?: number | null }; providerRequestId?: string | null; latencyMs: number; idempotencyHit: boolean }, type: string, provider: Annunci10xConfiguredProvider): PublicAnnunci10xOperation {
  return {
    type,
    promptVersion: result.operation.promptVersion,
    model: result.model,
    provider,
    schemaValid: true,
    latencyMs: result.latencyMs,
    inputTokens: result.usage?.inputTokens,
    outputTokens: result.usage?.outputTokens,
    totalTokens: result.usage?.totalTokens,
    cachedTokens: result.usage?.cachedTokens,
    providerRequestId: result.providerRequestId ?? null,
    idempotencyHit: result.idempotencyHit,
  };
}

function applyAnswerToRoleCard(roleCard: RoleCard, targetPath: string, answer: string): RoleCard {
  const fact = stringFact(answer, 'USER_DECLARED', `answer-${stableShortId(targetPath)}`);
  if (targetPath === 'attractionContext.contractType') return { ...roleCard, attractionContext: { ...roleCard.attractionContext, contractType: fact } };
  if (targetPath === 'attractionContext.location') return { ...roleCard, attractionContext: { ...roleCard.attractionContext, location: fact } };
  if (targetPath === 'attractionContext.workMode') return { ...roleCard, attractionContext: { ...roleCard.attractionContext, workMode: fact } };
  if (targetPath === 'compensation.amountText') return { ...roleCard, compensation: { visibility: stringFact('PUBLIC', 'USER_DECLARED', 'answer-compensation-visibility') as never, amountText: fact } };
  return { ...roleCard, outcomes: [...roleCard.outcomes, fact] };
}

function stringFact(value: unknown, source: 'EXTRACTED' | 'USER_DECLARED' | 'SYSTEM_INFERRED', sourceId: string, publishable = source !== 'SYSTEM_INFERRED') {
  return createFact(String(value || 'N/D').trim() || 'N/D', source, { sourceId, publishable, confidence: source === 'SYSTEM_INFERRED' ? 35 : 82 });
}

function textValue(fact: { value?: unknown } | undefined): string {
  return fact?.value ? String(fact.value) : 'N/D';
}

function missingFacts(roleCard: RoleCard): string[] {
  const missing: string[] = [];
  if (!roleCard.attractionContext.location) missing.push('Sede');
  if (!roleCard.attractionContext.contractType) missing.push('Contratto');
  if (!roleCard.compensation?.amountText) missing.push('Compenso');
  if (!roleCard.attractionContext.workMode) missing.push('Modalita di lavoro');
  return missing;
}

function stepFromPath(path: string): 'ROLE' | 'OUTCOMES' | 'REQUIREMENTS' | 'CONDITIONS' | 'ATTRACTION' | 'CHANNEL' {
  if (path.includes('compensation') || path.includes('contract') || path.includes('schedule')) return 'CONDITIONS';
  if (path.includes('requirements')) return 'REQUIREMENTS';
  if (path.includes('attraction')) return 'ATTRACTION';
  return 'ROLE';
}

function guessTitle(text: string): string {
  const match = text.match(/(?:cerchiamo|selezioniamo|ricerchiamo)\s+(?:un|una)?\s*([^\n.,;]{3,80})/i);
  return clean(match?.[1]) || clean(text.split(/\n|\.|,/)[0]) || 'Ruolo da chiarire';
}

function guessResponsibility(text: string): string {
  const match = text.match(/(?:attivita|mansioni|responsabilita|ti occuperai di)[:\s]+([^\n.]{8,140})/i);
  return clean(match?.[1]) || 'Attivita operative indicate nel testo originale';
}

function guessMission(text: string): string {
  const match = text.match(/(?:missione|obiettivo|scopo)[:\s]+([^\n.]{8,140})/i);
  return clean(match?.[1]) || 'N/D - missione da chiarire';
}

function guessOutcome(text: string): string {
  const match = text.match(/(?:obiettivo|risultato|garantire|sviluppare)\s+([^\n.]{8,140})/i);
  return clean(match?.[0]) || 'N/D - risultato atteso da chiarire';
}

function guessRequirement(text: string): string {
  const match = text.match(/(?:requisiti|richiediamo|serve|necessaria|necessario)[:\s]+([^\n.]{5,140})/i);
  return clean(match?.[1]) || 'Requisiti da chiarire';
}

function hasCompensation(text: string): boolean {
  return /\b(?:ral|stipendio|compenso|retribuzione|euro|€)\b/i.test(text);
}

function guessCompensation(text: string): string {
  const match = text.match(/(?:ral|stipendio|compenso|retribuzione)[^\n.]{0,120}|(?:€|euro)\s?[\d.,]+[^\n.]*/i);
  return clean(match?.[0]) || 'Compenso indicato nel testo';
}

function findWorkMode(text: string) {
  if (/ibrid[oa]/i.test(text)) return stringFact('Ibrido', 'EXTRACTED', 'work-mode');
  if (/remoto|smart working/i.test(text)) return stringFact('Remoto', 'EXTRACTED', 'work-mode');
  if (/presenza|in sede/i.test(text)) return stringFact('In presenza', 'EXTRACTED', 'work-mode');
  return undefined;
}

function findLocation(text: string) {
  const match = text.match(/\b(?:a|sede di|zona)\s+([A-ZÀ-Ü][a-zà-ü]+(?:\s[A-ZÀ-Ü][a-zà-ü]+)?)/);
  return match?.[1] ? stringFact(match[1], 'EXTRACTED', 'location') : undefined;
}

function findContract(text: string) {
  const match = text.match(/(tempo indeterminato|tempo determinato|part-?time|full-?time|stage|apprendistato|collaborazione)/i);
  return match?.[1] ? stringFact(match[1], 'EXTRACTED', 'contract') : undefined;
}

function findSchedule(text: string) {
  const match = text.match(/(?:orario|turni|lunedi|lunedì)[^\n.]{0,100}/i);
  return match?.[0] ? stringFact(match[0], 'EXTRACTED', 'schedule') : undefined;
}

function clean(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().replace(/[;:,.]+$/, '');
}

function bucketLength(text: string): string {
  const length = text.length;
  if (length < 500) return 'short';
  if (length < 2_000) return 'medium';
  return 'long';
}

function stableShortId(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
  return Math.abs(hash).toString(36);
}

function versions() {
  return {
    dataContractVersion: ANNUNCI10X_DATA_CONTRACT_VERSION,
    methodVersion: ANNUNCI10X_METHOD_VERSION,
    rubricVersion: ANNUNCI10X_RUBRIC_VERSION,
    strategyVersion: ANNUNCI10X_STRATEGY_VERSION,
    promptVersion: ANNUNCI10X_PROMPT_PACK_VERSION,
  };
}
