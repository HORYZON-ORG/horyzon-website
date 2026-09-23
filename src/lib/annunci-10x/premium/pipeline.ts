import { createHash, randomUUID } from 'node:crypto';
import {
  ANNUNCI10X_DATA_CONTRACT_VERSION,
  ANNUNCI10X_METHOD_VERSION,
  ANNUNCI10X_PROMPT_PACK_VERSION,
  ANNUNCI10X_RUBRIC_VERSION,
  ANNUNCI10X_STRATEGY_VERSION,
} from '../constants.ts';
import { evaluatePublicationGate, materialConflict, unconfirmedClaim } from '../gates.ts';
import { Annunci10xAiOrchestrator, calculateScoreAndGateFromEvaluateOutput } from '../ai/orchestrator.ts';
import { ANNUNCI10X_RUBRIC } from '../rubric.ts';
import { createFact, validateGeneratedAd } from '../validation.ts';
import type {
  Annunci10xChannelAdapterOutput,
  Annunci10xEditClassifierOutput,
  Annunci10xEvaluateOutput,
  Annunci10xGenerateOutput,
  Annunci10xReviseOutput,
  Annunci10xValidateOutput,
} from '../ai/schemas.ts';
import type { PersistedAnnunci10xSession, PersistedOutput, PersistedSnapshot } from '../persistence/types.ts';
import type {
  ChannelVariant,
  ClaimCheck,
  ComparisonResult,
  Fact,
  GeneratedAd,
  PublicationChannel,
  PublicationGate,
  RoleCard,
  ScoreResult,
} from '../types.ts';
import {
  Annunci10xPublicError,
  createAnnunci10xRuntimeContext,
  type Annunci10xConfiguredProvider,
  type Annunci10xRuntimeContext,
  type PublicAnnunci10xOperation,
} from '../product-flow.ts';
import {
  createProductionGenerationAuthorizationProvider,
  isGeneratableState,
  type GenerationAuthorization,
  type GenerationAuthorizationProvider,
} from './authorization.ts';

export interface Annunci10xPremiumGenerationInput {
  sessionId: string;
  sessionSecret: string;
  channel?: PublicationChannel;
  context?: Annunci10xRuntimeContext;
  authorizationProvider?: GenerationAuthorizationProvider;
}

export interface PublicAnnunci10xPremiumOutput {
  outputId: string;
  sessionId: string;
  snapshotId: string;
  provider: Annunci10xConfiguredProvider;
  master: GeneratedAd;
  masterText: string;
  channelVariant: ChannelVariant | null;
  score: ScoreResult;
  gate: PublicationGate;
  validationState: PublicationGate['status'];
  claimCheck: ClaimCheck[];
  comparison: ComparisonResult | null;
  rationale: string[];
  checklist: string[];
  operations: PublicAnnunci10xOperation[];
  versions: {
    dataContractVersion: string;
    methodVersion: string;
    rubricVersion: string;
    strategyVersion: string;
    promptVersion: string;
  };
  generatedAt: string;
}

export interface PremiumEditInput {
  sessionId: string;
  sessionSecret: string;
  editRequest: string;
  targetPath?: string;
  context?: Annunci10xRuntimeContext;
  authorizationProvider?: GenerationAuthorizationProvider;
}

export interface PublicAnnunci10xPremiumEditResult {
  status: 'EDITORIAL_REVISED' | 'REQUIRES_REGENERATION' | 'CONFIRMATION_REQUIRED';
  intent: Annunci10xEditClassifierOutput['intent'];
  reason: string;
  affectedPaths: string[];
  output?: PublicAnnunci10xPremiumOutput;
  operations: PublicAnnunci10xOperation[];
}

export async function runAnnunci10xPremiumGeneration(input: Annunci10xPremiumGenerationInput): Promise<PublicAnnunci10xPremiumOutput> {
  const context = input.context ?? createAnnunci10xRuntimeContext();
  const session = await requireOwnedSession(context, input.sessionId, input.sessionSecret);
  const authorizationProvider = input.authorizationProvider ?? createProductionGenerationAuthorizationProvider();
  const authorization = await authorizationProvider.authorize({ session, productCode: 'AD_GENERATION' });
  if (authorization.status !== 'AUTHORIZED') {
    throw generationDenied(authorization);
  }
  if (!isGeneratableState(session.state)) {
    throw new Annunci10xPublicError('GENERATION_BLOCKED', 'La sessione non e in uno stato generabile.', 409);
  }

  const snapshot = await requireGeneratableSnapshot(context, input.sessionId, input.sessionSecret);
  await context.persistence.updateSession({ sessionId: input.sessionId, sessionSecret: input.sessionSecret, state: 'GENERATING' });
  await context.persistence.appendEvent({
    sessionId: input.sessionId,
    eventName: 'generation_started',
    metadata: { flow: session.flow, channel: input.channel ?? preferredChannel(snapshot) },
  });

  const consumed = await authorizationProvider.consume({ session, authorization });
  if (consumed.status !== 'AUTHORIZED') throw generationDenied(consumed);

  const orchestrator = new Annunci10xAiOrchestrator({ provider: context.provider, persistence: context.persistence });
  const operations: PublicAnnunci10xOperation[] = [];
  const authIdentity = stableHash({ authorization: consumed.identity, sessionId: session.id, snapshotId: snapshot.id });

  try {
    const generatedResult = await orchestrator.runTask({
      sessionId: input.sessionId,
      sessionSecret: input.sessionSecret,
      operationType: 'GENERATE',
      input: {
        roleCard: snapshot.roleCard,
        roleProfile: snapshot.roleProfile,
        communicationStrategy: snapshot.communicationStrategy,
      },
      inputSnapshotId: snapshot.id,
      idempotencyInputIdentityOverride: stableHash({ snapshotId: snapshot.id, authIdentity, operation: 'GENERATE' }),
    });
    operations.push(toPublicOperation(generatedResult, 'GENERATE', context.configuredProvider));
    const generated = generatedResult.output as Annunci10xGenerateOutput;

    const firstValidation = await validateMaster({
      orchestrator,
      sessionId: input.sessionId,
      sessionSecret: input.sessionSecret,
      snapshot,
      master: generated.generatedAd,
      authIdentity,
      provider: context.configuredProvider,
      operations,
      phase: 'initial',
    });

    let finalMaster = generated.generatedAd;
    let finalValidation = firstValidation;
    let automaticRevisionCount: 0 | 1 = 0;
    if (firstValidation.result === 'NEEDS_REVISION') {
      const revisionResult = await orchestrator.runTask({
        sessionId: input.sessionId,
        sessionSecret: input.sessionSecret,
        operationType: 'REVISE',
        input: {
          currentMaster: generated.generatedAd,
          roleCard: snapshot.roleCard,
          communicationStrategy: snapshot.communicationStrategy,
          validationIssues: firstValidation,
        },
        inputSnapshotId: snapshot.id,
        idempotencyInputIdentityOverride: stableHash({ snapshotId: snapshot.id, authIdentity, operation: 'REVISE', masterId: generated.generatedAd.id }),
      });
      operations.push(toPublicOperation(revisionResult, 'REVISE', context.configuredProvider));
      const revision = revisionResult.output as Annunci10xReviseOutput;
      finalMaster = {
        ...generated.generatedAd,
        sections: revision.revisedSections,
        generatedAt: new Date().toISOString(),
      };
      automaticRevisionCount = 1;
      finalValidation = await validateMaster({
        orchestrator,
        sessionId: input.sessionId,
        sessionSecret: input.sessionSecret,
        snapshot,
        master: finalMaster,
        authIdentity,
        provider: context.configuredProvider,
        operations,
        phase: 'post-revise',
      });
    }

    const evaluateResult = await orchestrator.runTask({
      sessionId: input.sessionId,
      sessionSecret: input.sessionSecret,
      operationType: 'EVALUATE',
      input: {
        target: { kind: 'GENERATED_MASTER', generatedAdId: finalMaster.id },
        generatedAd: finalMaster,
        roleCard: snapshot.roleCard,
        roleProfile: snapshot.roleProfile,
        communicationStrategy: snapshot.communicationStrategy,
        channel: input.channel ?? preferredChannel(snapshot),
        rubric: ANNUNCI10X_RUBRIC,
      },
      inputSnapshotId: snapshot.id,
      idempotencyInputIdentityOverride: stableHash({ snapshotId: snapshot.id, authIdentity, operation: 'EVALUATE', master: finalMaster.sections }),
    });
    operations.push(toPublicOperation(evaluateResult, 'EVALUATE', context.configuredProvider));

    const deterministic = calculateScoreAndGateFromEvaluateOutput(evaluateResult.output as Annunci10xEvaluateOutput);
    const gate = gateFromValidation(finalValidation, deterministic.gate);
    const claimCheck = claimCheckFromValidation(finalValidation);
    const comparison = buildComparison(session, finalMaster, deterministic.score, await context.persistence.getLatestEvaluation(input.sessionId, input.sessionSecret));
    const masterToPersist = attachPremiumPayload(finalMaster, {
      comparison,
      claimCheck,
      rationale: rationaleFromSnapshot(snapshot),
      automaticRevisionCount,
      validationResult: finalValidation.result,
    });
    const masterOutput = await context.persistence.saveOutput({
      sessionId: input.sessionId,
      sessionSecret: input.sessionSecret,
      snapshotId: snapshot.id,
      outputType: 'MASTER',
      generatedContent: masterToPersist,
      validationState: gate.status,
    });

    const evaluation = await context.persistence.saveEvaluation({
      sessionId: input.sessionId,
      sessionSecret: input.sessionSecret,
      target: { kind: 'GENERATED_MASTER', generatedAdId: finalMaster.id },
      targetRef: finalMaster.id,
      targetOutputId: masterOutput.id,
      score: deterministic.score,
      gate,
    });

    let variantOutput: PersistedOutput | null = null;
    let channelVariant: ChannelVariant | null = null;
    if (gate.status !== 'BLOCKED') {
      const channelResult = await orchestrator.runTask({
        sessionId: input.sessionId,
        sessionSecret: input.sessionSecret,
        operationType: 'CHANNEL_ADAPTER',
        input: { master: finalMaster, roleCard: snapshot.roleCard, targetChannel: input.channel ?? preferredChannel(snapshot) },
        inputSnapshotId: snapshot.id,
        idempotencyInputIdentityOverride: stableHash({ snapshotId: snapshot.id, authIdentity, operation: 'CHANNEL_ADAPTER', master: finalMaster.sections, channel: input.channel ?? preferredChannel(snapshot) }),
      });
      operations.push(toPublicOperation(channelResult, 'CHANNEL_ADAPTER', context.configuredProvider));
      channelVariant = (channelResult.output as Annunci10xChannelAdapterOutput).channelVariant;
      variantOutput = await context.persistence.saveOutput({
        sessionId: input.sessionId,
        sessionSecret: input.sessionSecret,
        snapshotId: snapshot.id,
        outputType: 'CHANNEL_VARIANT',
        generatedContent: channelVariant,
        channel: channelVariant.channel,
        parentMasterId: masterOutput.id,
        validationState: gate.status,
      });
      await context.persistence.appendEvent({
        sessionId: input.sessionId,
        eventName: 'channel_variant_created',
        metadata: { channel: channelVariant.channel, masterOutputId: masterOutput.id },
      });
    }

    await context.persistence.updateSession({
      sessionId: input.sessionId,
      sessionSecret: input.sessionSecret,
      state: gate.status === 'READY' || gate.status === 'READY_WITH_WARNINGS' ? 'OUTPUT_READY' : 'NEEDS_VERIFICATION',
    });
    await context.persistence.appendEvent({
      sessionId: input.sessionId,
      eventName: 'generation_completed',
      metadata: { outputId: masterOutput.id, evaluationId: evaluation.id, gateStatus: gate.status, variantOutputId: variantOutput?.id ?? null },
    });

    return publicPremiumOutput({
      session,
      snapshot,
      output: masterOutput,
      master: masterToPersist,
      channelVariant,
      score: deterministic.score,
      gate,
      claimCheck,
      comparison,
      operations,
      provider: context.configuredProvider,
    });
  } catch (error) {
    await context.persistence.updateSession({ sessionId: input.sessionId, sessionSecret: input.sessionSecret, state: 'ERROR' });
    await context.persistence.appendEvent({ sessionId: input.sessionId, eventName: 'generation_failed', metadata: { reason: error instanceof Error ? error.name : 'unknown' } });
    throw error;
  }
}

export async function resumeAnnunci10xPremiumOutput(input: { sessionId: string; sessionSecret: string; context?: Annunci10xRuntimeContext }): Promise<PublicAnnunci10xPremiumOutput | null> {
  const context = input.context ?? createAnnunci10xRuntimeContext();
  const session = await requireOwnedSession(context, input.sessionId, input.sessionSecret);
  const output = await context.persistence.getLatestOutput(input.sessionId, input.sessionSecret, 'MASTER');
  if (!output) return null;
  const validation = validateGeneratedAd(output.generatedContent);
  if (!validation.ok) throw new Annunci10xPublicError('INTERNAL', 'Output Annunci 10x non valido.', 500);
  const snapshot = await context.persistence.getLatestSnapshot(input.sessionId, input.sessionSecret);
  const evaluation = await context.persistence.getLatestEvaluation(input.sessionId, input.sessionSecret);
  if (!snapshot || !evaluation) return null;
  const variant = await context.persistence.getLatestOutput(input.sessionId, input.sessionSecret, 'CHANNEL_VARIANT', output.id);
  await context.persistence.appendEvent({ sessionId: input.sessionId, eventName: 'output_viewed', metadata: { outputId: output.id } });
  return publicPremiumOutput({
    session,
    snapshot,
    output,
    master: validation.value,
    channelVariant: variant?.generatedContent as ChannelVariant | null ?? null,
    score: evaluation.score,
    gate: evaluation.gate,
    claimCheck: readPremiumPayload(validation.value).claimCheck,
    comparison: readPremiumPayload(validation.value).comparison,
    operations: [],
    provider: context.configuredProvider,
  });
}

export async function requestAnnunci10xPremiumEdit(input: PremiumEditInput): Promise<PublicAnnunci10xPremiumEditResult> {
  const context = input.context ?? createAnnunci10xRuntimeContext();
  const session = await requireOwnedSession(context, input.sessionId, input.sessionSecret);
  const authorizationProvider = input.authorizationProvider ?? createProductionGenerationAuthorizationProvider();
  const authorization = await authorizationProvider.authorize({ session, productCode: 'AD_GENERATION' });
  if (authorization.status !== 'AUTHORIZED') throw generationDenied(authorization);
  const output = await context.persistence.getLatestOutput(input.sessionId, input.sessionSecret, 'MASTER');
  const snapshot = await requireGeneratableSnapshot(context, input.sessionId, input.sessionSecret);
  if (!output) throw new Annunci10xPublicError('INVALID_INPUT', 'Nessun output premium da modificare.', 409);
  const validation = validateGeneratedAd(output.generatedContent);
  if (!validation.ok) throw new Annunci10xPublicError('INTERNAL', 'Output premium non valido.', 500);
  if (!input.editRequest.trim()) throw new Annunci10xPublicError('INVALID_INPUT', 'Inserisci una modifica.', 400);

  const orchestrator = new Annunci10xAiOrchestrator({ provider: context.provider, persistence: context.persistence });
  const operations: PublicAnnunci10xOperation[] = [];
  const classifier = await orchestrator.runTask({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    operationType: 'EDIT_CLASSIFIER',
    input: { editRequest: input.editRequest, roleCard: snapshot.roleCard, currentMaster: validation.value },
    inputSnapshotId: snapshot.id,
    idempotencyInputIdentityOverride: stableHash({ snapshotId: snapshot.id, outputId: output.id, editRequest: input.editRequest, operation: 'EDIT_CLASSIFIER' }),
  });
  operations.push(toPublicOperation(classifier, 'EDIT_CLASSIFIER', context.configuredProvider));
  const classified = classifier.output as Annunci10xEditClassifierOutput;

  if (classified.intent === 'UNSUPPORTED_FACT') {
    await context.persistence.appendEvent({ sessionId: input.sessionId, eventName: 'output_edit_requested', metadata: { intent: classified.intent, result: 'confirmation_required' } });
    return { status: 'CONFIRMATION_REQUIRED', intent: classified.intent, reason: classified.reason, affectedPaths: classified.affectedPaths, operations };
  }

  if (classified.intent === 'FACTUAL' || classified.intent === 'STRATEGIC') {
    const roleCard = applyPremiumEditToRoleCard(snapshot.roleCard, input.targetPath ?? classified.affectedPaths[0] ?? 'mission', input.editRequest);
    await context.persistence.appendAnswer({
      sessionId: input.sessionId,
      sessionSecret: input.sessionSecret,
      interviewStep: stepFromPath(input.targetPath ?? classified.affectedPaths[0] ?? ''),
      questionId: `premium.edit.${stableHash(input.editRequest).slice(0, 12)}`,
      rawAnswer: input.editRequest,
    });
    await context.persistence.appendSnapshot({
      sessionId: input.sessionId,
      sessionSecret: input.sessionSecret,
      roleCard,
      roleProfile: snapshot.roleProfile ? { ...snapshot.roleProfile, roleCard } : null,
      communicationStrategy: snapshot.communicationStrategy,
      reason: 'POST_GENERATION_EDIT',
    });
    await context.persistence.updateSession({ sessionId: input.sessionId, sessionSecret: input.sessionSecret, state: 'NEEDS_VERIFICATION' });
    await context.persistence.appendEvent({ sessionId: input.sessionId, eventName: 'output_edit_requested', metadata: { intent: classified.intent, result: 'requires_regeneration' } });
    return { status: 'REQUIRES_REGENERATION', intent: classified.intent, reason: classified.reason, affectedPaths: classified.affectedPaths, operations };
  }

  const revision = await orchestrator.runTask({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    operationType: 'REVISE',
    input: { currentMaster: validation.value, roleCard: snapshot.roleCard, communicationStrategy: snapshot.communicationStrategy, editRequest: input.editRequest },
    inputSnapshotId: snapshot.id,
    idempotencyInputIdentityOverride: stableHash({ snapshotId: snapshot.id, outputId: output.id, editRequest: input.editRequest, operation: 'REVISE' }),
  });
  operations.push(toPublicOperation(revision, 'REVISE', context.configuredProvider));
  const revised = revision.output as Annunci10xReviseOutput;
  const master: GeneratedAd = { ...validation.value, sections: revised.revisedSections, generatedAt: new Date().toISOString() };
  const validate = await validateMaster({
    orchestrator,
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    snapshot,
    master,
    authIdentity: stableHash({ sessionId: session.id, outputId: output.id, editRequest: input.editRequest }),
    provider: context.configuredProvider,
    operations,
    phase: 'edit',
  });
  const evaluate = await orchestrator.runTask({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    operationType: 'EVALUATE',
    input: { target: { kind: 'GENERATED_MASTER', generatedAdId: master.id }, generatedAd: master, roleCard: snapshot.roleCard, roleProfile: snapshot.roleProfile, communicationStrategy: snapshot.communicationStrategy, channel: preferredChannel(snapshot), rubric: ANNUNCI10X_RUBRIC },
    inputSnapshotId: snapshot.id,
    idempotencyInputIdentityOverride: stableHash({ snapshotId: snapshot.id, outputId: output.id, editRequest: input.editRequest, operation: 'EVALUATE' }),
  });
  operations.push(toPublicOperation(evaluate, 'EVALUATE', context.configuredProvider));
  const deterministic = calculateScoreAndGateFromEvaluateOutput(evaluate.output as Annunci10xEvaluateOutput);
  const gate = gateFromValidation(validate, deterministic.gate);
  const claimCheck = claimCheckFromValidation(validate);
  const comparison = buildComparison(session, master, deterministic.score, await context.persistence.getLatestEvaluation(input.sessionId, input.sessionSecret));
  const masterToPersist = attachPremiumPayload(master, {
    comparison,
    claimCheck,
    rationale: rationaleFromSnapshot(snapshot),
    automaticRevisionCount: 1,
    validationResult: validate.result,
  });
  const saved = await context.persistence.saveOutput({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    snapshotId: snapshot.id,
    outputType: 'MASTER',
    generatedContent: masterToPersist,
    validationState: gate.status,
  });
  await context.persistence.saveEvaluation({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    target: { kind: 'GENERATED_MASTER', generatedAdId: master.id },
    targetRef: master.id,
    targetOutputId: saved.id,
    score: deterministic.score,
    gate,
  });
  await context.persistence.appendEvent({ sessionId: input.sessionId, eventName: 'output_revised', metadata: { outputId: saved.id, intent: classified.intent } });
  return {
    status: 'EDITORIAL_REVISED',
    intent: classified.intent,
    reason: classified.reason,
    affectedPaths: classified.affectedPaths,
    operations,
    output: await publicPremiumOutput({
      session,
      snapshot,
      output: saved,
      master: masterToPersist,
      channelVariant: null,
      score: deterministic.score,
      gate,
      claimCheck,
      comparison,
      operations,
      provider: context.configuredProvider,
    }),
  };
}

async function validateMaster(input: {
  orchestrator: Annunci10xAiOrchestrator;
  sessionId: string;
  sessionSecret: string;
  snapshot: PersistedSnapshot;
  master: GeneratedAd;
  authIdentity: string;
  provider: Annunci10xConfiguredProvider;
  operations: PublicAnnunci10xOperation[];
  phase: string;
}): Promise<Annunci10xValidateOutput> {
  const result = await input.orchestrator.runTask({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    operationType: 'VALIDATE',
    input: { generatedAd: input.master, roleCard: input.snapshot.roleCard },
    inputSnapshotId: input.snapshot.id,
    idempotencyInputIdentityOverride: stableHash({ snapshotId: input.snapshot.id, authIdentity: input.authIdentity, operation: 'VALIDATE', phase: input.phase, master: input.master.sections }),
    promptVersionOverride: input.phase === 'post-revise' ? `${ANNUNCI10X_PROMPT_PACK_VERSION}.post-revise` : undefined,
  });
  input.operations.push(toPublicOperation(result, 'VALIDATE', input.provider));
  return result.output as Annunci10xValidateOutput;
}

function gateFromValidation(validation: Annunci10xValidateOutput, deterministic: PublicationGate): PublicationGate {
  const findings = [];
  for (const claim of validation.unsupportedClaims) findings.push(unconfirmedClaim(`Claim non supportato: ${claim}`, validation.result === 'BLOCK' ? 'BLOCKING' : 'WARNING'));
  for (const contradiction of validation.contradictions) findings.push(materialConflict(`Contraddizione: ${contradiction}`, 'BLOCKING'));
  for (const requirement of validation.alteredRequirements) findings.push(materialConflict(`Requisito alterato: ${requirement}`, 'BLOCKING'));
  for (const fact of validation.omittedCriticalFacts) findings.push(unconfirmedClaim(`Fatto critico omesso: ${fact}`, 'WARNING'));
  if (!findings.length) return deterministic;
  return evaluatePublicationGate({ findings, evaluatedAt: deterministic.evaluatedAt });
}

function claimCheckFromValidation(validation: Annunci10xValidateOutput): ClaimCheck[] {
  if (!validation.claims.length && !validation.unsupportedClaims.length) {
    return [{ id: randomUUID(), claim: 'Nessun claim non supportato rilevato.', status: 'SUPPORTED', sourceFactIds: [], publishable: true }];
  }
  return validation.claims.map((claim) => ({
    id: claim.id || randomUUID(),
    claim: claim.claim,
    status: claim.supported ? 'SUPPORTED' : 'UNSUPPORTED',
    sourceFactIds: claim.sourcePaths,
    publishable: claim.supported,
  }));
}

function buildComparison(session: PersistedAnnunci10xSession, master: GeneratedAd, score: ScoreResult, previous: { score: ScoreResult; target: string } | null): ComparisonResult | null {
  if (session.flow !== 'ANALYZE') return null;
  return {
    originalAdId: previous?.target === 'ORIGINAL_AD' ? 'original-ad-from-session' : 'original-ad-from-analysis',
    generatedAdId: master.id,
    changes: [
      { type: 'REWRITTEN', label: 'Struttura annuncio', before: 'Annuncio originale analizzato', after: 'Master generato su scheda ruolo e strategia' },
      { type: 'CLARIFIED', label: 'Copertura rubric', before: scoreLabel(previous?.score), after: scoreLabel(score) },
    ],
    improvements: ['Messaggio riorganizzato intorno a fatti verificati e strategia di comunicazione.'],
    regressionsToReview: score.coverage < 100 ? ['Alcuni controlli restano N/D: rivedere le informazioni mancanti prima della pubblicazione.'] : [],
  };
}

async function publicPremiumOutput(input: {
  session: PersistedAnnunci10xSession;
  snapshot: PersistedSnapshot;
  output: PersistedOutput;
  master: GeneratedAd;
  channelVariant: ChannelVariant | null;
  score: ScoreResult;
  gate: PublicationGate;
  claimCheck: ClaimCheck[];
  comparison: ComparisonResult | null;
  operations: PublicAnnunci10xOperation[];
  provider: Annunci10xConfiguredProvider;
}): Promise<PublicAnnunci10xPremiumOutput> {
  const payload = readPremiumPayload(input.master);
  return {
    outputId: input.output.id,
    sessionId: input.session.id,
    snapshotId: input.snapshot.id,
    provider: input.provider,
    master: input.master,
    masterText: input.master.sections.map((section) => `${section.title}\n${section.body}`).join('\n\n'),
    channelVariant: input.channelVariant,
    score: input.score,
    gate: input.gate,
    validationState: input.output.validationState,
    claimCheck: input.claimCheck.length ? input.claimCheck : payload.claimCheck,
    comparison: input.comparison ?? payload.comparison,
    rationale: payload.rationale.length ? payload.rationale : rationaleFromSnapshot(input.snapshot),
    checklist: checklistFromGate(input.gate, input.claimCheck),
    operations: input.operations,
    versions: versions(),
    generatedAt: input.output.createdAt,
  };
}

function attachPremiumPayload(master: GeneratedAd, payload: {
  comparison: ComparisonResult | null;
  claimCheck: ClaimCheck[];
  rationale: string[];
  automaticRevisionCount: 0 | 1;
  validationResult: Annunci10xValidateOutput['result'];
}): GeneratedAd {
  return {
    ...master,
    annunci10xPremium: {
      comparison: payload.comparison,
      claimCheck: payload.claimCheck,
      rationale: payload.rationale,
      automaticRevisionCount: payload.automaticRevisionCount,
      validationResult: payload.validationResult,
    },
  } as GeneratedAd;
}

function readPremiumPayload(master: GeneratedAd): { comparison: ComparisonResult | null; claimCheck: ClaimCheck[]; rationale: string[] } {
  const payload = (master as GeneratedAd & { annunci10xPremium?: unknown }).annunci10xPremium;
  if (typeof payload !== 'object' || payload === null) return { comparison: null, claimCheck: [], rationale: [] };
  const record = payload as { comparison?: ComparisonResult | null; claimCheck?: ClaimCheck[]; rationale?: string[] };
  return {
    comparison: record.comparison ?? null,
    claimCheck: Array.isArray(record.claimCheck) ? record.claimCheck : [],
    rationale: Array.isArray(record.rationale) ? record.rationale : [],
  };
}

async function requireOwnedSession(context: Annunci10xRuntimeContext, sessionId: string, sessionSecret: string): Promise<PersistedAnnunci10xSession> {
  const session = await context.persistence.getSession(sessionId, sessionSecret);
  if (!session) throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione Annunci 10x non valida o scaduta.', 401);
  return session;
}

async function requireGeneratableSnapshot(context: Annunci10xRuntimeContext, sessionId: string, sessionSecret: string): Promise<PersistedSnapshot> {
  const snapshot = await context.persistence.getLatestSnapshot(sessionId, sessionSecret);
  if (!snapshot?.roleProfile || !snapshot.communicationStrategy) {
    throw new Annunci10xPublicError('GENERATION_BLOCKED', 'Scheda ruolo, profilo e strategia devono essere completati prima della generazione.', 409);
  }
  return snapshot;
}

function generationDenied(authorization: GenerationAuthorization): Annunci10xPublicError {
  const code = authorization.status === 'INVALID_STATE' ? 'GENERATION_BLOCKED' : authorization.status === 'ALREADY_CONSUMED' ? 'GENERATION_BLOCKED' : 'PAYMENT_REQUIRED';
  const status = authorization.status === 'NOT_AUTHORIZED' ? 402 : 409;
  return new Annunci10xPublicError(code, authorization.reason, status);
}

function preferredChannel(snapshot: PersistedSnapshot): PublicationChannel {
  return snapshot.communicationStrategy?.channelPriorities[0] ?? 'LINKEDIN';
}

function rationaleFromSnapshot(snapshot: PersistedSnapshot): string[] {
  const strategy = snapshot.communicationStrategy;
  return [
    strategy?.summary,
    strategy?.candidateAngle,
    ...(strategy?.reasons ?? []).map((reason) => reason.label),
  ].filter((item): item is string => Boolean(item)).slice(0, 5);
}

function checklistFromGate(gate: PublicationGate, claimCheck: ClaimCheck[]): string[] {
  return [
    ...gate.blockingReasons,
    ...gate.warnings,
    ...claimCheck.filter((claim) => claim.status !== 'SUPPORTED').map((claim) => claim.claim),
  ].slice(0, 8);
}

function applyPremiumEditToRoleCard(roleCard: RoleCard, targetPath: string, value: string): RoleCard {
  const next = fact(value, 'USER_DECLARED', `premium-edit-${stableHash(`${targetPath}:${value}`).slice(0, 10)}`);
  if (targetPath.includes('location')) return { ...roleCard, attractionContext: { ...roleCard.attractionContext, location: next } };
  if (targetPath.includes('workMode')) return { ...roleCard, attractionContext: { ...roleCard.attractionContext, workMode: next } };
  if (targetPath.includes('contract')) return { ...roleCard, attractionContext: { ...roleCard.attractionContext, contractType: next } };
  if (targetPath.includes('requirements')) return { ...roleCard, requirements: [{ id: 'req-premium-edit', label: next, classification: 'REQUIRED' }] };
  if (targetPath.includes('responsibilities')) return { ...roleCard, responsibilities: [next] };
  if (targetPath.includes('title')) return { ...roleCard, title: next };
  return { ...roleCard, mission: next, outcomes: [next] };
}

function stepFromPath(path: string) {
  if (path.includes('compensation') || path.includes('contract') || path.includes('schedule')) return 'CONDITIONS';
  if (path.includes('requirements')) return 'REQUIREMENTS';
  if (path.includes('attraction') || path.includes('location') || path.includes('workMode')) return 'ATTRACTION';
  if (path.includes('responsibilities') || path.includes('mission')) return 'OUTCOMES';
  return 'ROLE';
}

function fact(value: string, source: 'USER_DECLARED' | 'SYSTEM_INFERRED', sourceId: string): Fact<string> {
  return createFact(value.trim() || 'N/D', source, { sourceId, publishable: source !== 'SYSTEM_INFERRED', confidence: source === 'SYSTEM_INFERRED' ? 35 : 82 });
}

function scoreLabel(score?: ScoreResult): string {
  if (!score) return 'N/D';
  if (typeof score.value === 'number') return `${score.value}/100`;
  if (score.interval) return `${score.interval.min}-${score.interval.max}/100`;
  return 'N/D';
}

function versions(): PublicAnnunci10xPremiumOutput['versions'] {
  return {
    dataContractVersion: ANNUNCI10X_DATA_CONTRACT_VERSION,
    methodVersion: ANNUNCI10X_METHOD_VERSION,
    rubricVersion: ANNUNCI10X_RUBRIC_VERSION,
    strategyVersion: ANNUNCI10X_STRATEGY_VERSION,
    promptVersion: ANNUNCI10X_PROMPT_PACK_VERSION,
  };
}

function toPublicOperation(
  result: {
    operation: { promptVersion: string };
    model: string;
    provider: string;
    usage?: { inputTokens?: number | null; outputTokens?: number | null; totalTokens?: number | null; cachedTokens?: number | null };
    providerRequestId?: string | null;
    latencyMs: number;
    idempotencyHit: boolean;
  },
  type: string,
  provider: Annunci10xConfiguredProvider,
): PublicAnnunci10xOperation {
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

function stableHash(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
