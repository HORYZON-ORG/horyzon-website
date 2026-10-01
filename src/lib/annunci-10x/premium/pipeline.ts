import { createHash, randomUUID } from 'node:crypto';
import {
  ANNUNCI10X_DATA_CONTRACT_VERSION,
  ANNUNCI10X_RUBRIC_VERSION,
  ANNUNCI10X_METHOD_VERSION_V2,
  ANNUNCI10X_PROMPT_PACK_VERSION_V2,
  ANNUNCI10X_RUBRIC_VERSION_V2,
  ANNUNCI10X_SCORE_SEMANTICS_VERSION_V2,
  ANNUNCI10X_STRATEGY_VERSION,
} from '../constants.ts';
import { editorialRevisionRequired, evaluatePublicationGate, materialConflict, unconfirmedClaim } from '../gates.ts';
import { runPersistedAnnunci10xEvaluateV2 } from '../ai/evaluate-v2.ts';
import { Annunci10xAiOrchestrator } from '../ai/orchestrator.ts';
import { createFact, validateGeneratedAd } from '../validation.ts';
import type {
  Annunci10xChannelAdapterOutput,
  Annunci10xEditClassifierOutput,
  Annunci10xGenerateOutput,
  Annunci10xReviseOutput,
  Annunci10xValidateOutput,
} from '../ai/schemas.ts';
import type { Annunci10xPersistedScoreResult, Annunci10xReservableCapability, PersistedAnnunci10xSession, PersistedCreditReservation, PersistedEvaluation, PersistedOutput, PersistedSnapshot } from '../persistence/types.ts';
import type { ScoreResultV2 } from '../types-v2.ts';
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
  buildEvaluateInputV2,
  createAnnunci10xRuntimeContext,
  type Annunci10xConfiguredProvider,
  type Annunci10xRuntimeContext,
  type PublicAnnunci10xOperation,
} from '../product-flow.ts';
import { isAnnunci10xAiOperationInProgressError } from '../ai/errors.ts';
import { isAnnunci10xFulfillmentEnabled } from '../commercial.ts';
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

export interface ReservationBackedPremiumGenerationInput {
  sessionId: string;
  sessionSecret: string;
  channel?: PublicationChannel;
  context?: Annunci10xRuntimeContext;
  fulfillmentEnabled?: boolean;
}

export interface PublicAnnunci10xPremiumOutput {
  outputId: string;
  sessionId: string;
  snapshotId: string;
  provider: Annunci10xConfiguredProvider;
  master: GeneratedAd;
  masterText: string;
  channelVariant: ChannelVariant | null;
  score: Annunci10xPersistedScoreResult;
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
    scoreSemanticsVersion: string;
    strategyVersion: string;
    promptVersion: string;
  };
  generatedAt: string;
}

export type Annunci10xPremiumFulfillmentPublicState =
  | 'NONE'
  | 'PAYMENT_CONFIRMED'
  | 'READY_TO_GENERATE'
  | 'PREPARING'
  | 'READY'
  | 'NEEDS_REVIEW';

export interface PublicAnnunci10xPremiumFulfillmentStatus {
  flow: PersistedAnnunci10xSession['flow'] | null;
  state: Annunci10xPremiumFulfillmentPublicState;
  canGenerate: boolean;
  outputAvailable: boolean;
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
    const generatedMaster = prepareMasterForValidation(generated.generatedAd, snapshot.roleCard);

    const firstValidationRaw = await validateMaster({
      orchestrator,
      sessionId: input.sessionId,
      sessionSecret: input.sessionSecret,
      snapshot,
      master: generatedMaster,
      authIdentity,
      provider: context.configuredProvider,
      operations,
      phase: 'initial',
    });
    const firstValidation = normalizeRepairableValidation(firstValidationRaw);

    const revised = await applyAutomaticRevisions({
      orchestrator,
      sessionId: input.sessionId,
      sessionSecret: input.sessionSecret,
      snapshot,
      initialMaster: generatedMaster,
      initialValidation: firstValidation,
      authIdentity,
      provider: context.configuredProvider,
      operations,
    });
    const finalMaster = revised.master;
    const finalValidation = revised.validation;
    const automaticRevisionCount = revised.automaticRevisionCount;

    const evaluateResult = await evaluateGeneratedMasterV2({
      context,
      sessionId: input.sessionId,
      sessionSecret: input.sessionSecret,
      snapshot,
      master: finalMaster,
      channel: input.channel ?? preferredChannel(snapshot),
      identity: stableHash({ snapshotId: snapshot.id, authIdentity, operation: 'EVALUATE_V2', master: finalMaster.sections }),
    });
    operations.push(toPublicOperation(evaluateResult, 'EVALUATE', context.configuredProvider));

    const gate = gateFromValidation(finalValidation, evaluatePublicationGate());
    const claimCheck = claimCheckFromValidation(finalValidation);
    const comparison = buildComparison(session, finalMaster, evaluateResult.score, previousEvaluationForComparison(await context.persistence.getLatestEvaluation(input.sessionId, input.sessionSecret)));
    const masterToPersist = attachPremiumPayload(finalMaster, {
      comparison,
      claimCheck,
      gate,
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
      score: evaluateResult.score,
      gate: null,
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
      channelVariant = normalizeChannelVariant((channelResult.output as Annunci10xChannelAdapterOutput).channelVariant, snapshot.roleCard);
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
      score: evaluateResult.score,
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

export async function runAnnunci10xReservationBackedPremiumGeneration(input: ReservationBackedPremiumGenerationInput): Promise<PublicAnnunci10xPremiumOutput> {
  const context = input.context ?? createAnnunci10xRuntimeContext();
  const session = await requireOwnedSession(context, input.sessionId, input.sessionSecret);
  if (!(input.fulfillmentEnabled ?? isAnnunci10xFulfillmentEnabled())) {
    throw new Annunci10xPublicError('GENERATION_BLOCKED', 'Generazione temporaneamente non disponibile.', 503);
  }

  const snapshot = await requireGeneratableSnapshot(context, input.sessionId, input.sessionSecret);
  const capability = capabilityForSession(session);
  const existing = await resumeConsumedReservationOutput({ context, session, sessionSecret: input.sessionSecret, capability });
  if (existing) return existing;

  const reservation = await context.persistence.reserveGenerationCredit({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    capability,
    leaseSeconds: 1800,
  });
  if (!reservation) throw new Annunci10xPublicError('PAYMENT_REQUIRED', 'Completa l\'acquisto per generare il tuo Annuncio 10x.', 402);

  const channel = input.channel ?? preferredChannel(snapshot);
  await appendEventBestEffort(context, input.sessionId, 'generation_credit_reserved', { reservationId: reservation.id, capability });
  await appendEventBestEffort(context, input.sessionId, 'generation_started', { flow: session.flow, channel, capability, reservationId: reservation.id });

  let consumed = false;
  try {
    const authIdentity = stableHash({
      reservationId: reservation.id,
      sessionId: session.id,
      snapshotId: snapshot.id,
      capability,
    });
    const generated = await executePremiumPipeline({
      context,
      session,
      sessionSecret: input.sessionSecret,
      snapshot,
      channel,
      authIdentity,
    });

    try {
      await context.persistence.consumeGenerationCredit({
        reservationId: reservation.id,
        sessionSecret: input.sessionSecret,
        outputId: generated.masterOutput.id,
      });
      consumed = true;
    } catch {
      await releaseGenerationCreditBestEffort(context, input.sessionSecret, reservation, capability, 'CONSUME_FAILED');
      throw new Annunci10xPublicError('PAYMENT_REQUIRED', 'Completa l\'acquisto per generare il tuo Annuncio 10x.', 402);
    }

    await appendEventBestEffort(context, input.sessionId, 'generation_credit_consumed', {
      reservationId: reservation.id,
      capability,
      outputId: generated.masterOutput.id,
    });
    await appendEventBestEffort(context, input.sessionId, 'generation_completed', {
      outputId: generated.masterOutput.id,
      evaluationId: generated.evaluation.id,
      gateStatus: generated.gate.status,
      variantOutputId: generated.variantOutput?.id ?? null,
      capability,
    });
    if (session.flow === 'CREATE') {
      await updateSessionBestEffort(context, input.sessionId, input.sessionSecret, generated.gate.status === 'READY' || generated.gate.status === 'READY_WITH_WARNINGS' ? 'OUTPUT_READY' : 'NEEDS_VERIFICATION');
    }

    return publicPremiumOutput({
      session,
      snapshot,
      output: generated.masterOutput,
      master: generated.masterToPersist,
      channelVariant: generated.channelVariant,
      score: generated.score,
      gate: generated.gate,
      claimCheck: generated.claimCheck,
      comparison: generated.comparison,
      operations: generated.operations,
      provider: context.configuredProvider,
    });
  } catch (error) {
    if (isAnnunci10xAiOperationInProgressError(error)) {
      throw new Annunci10xPublicError('GENERATION_BLOCKED', 'Il tuo Annuncio 10x è già in preparazione.', 409);
    }
    if (!consumed) {
      const reasonCode = releaseReasonCode(error);
      await releaseGenerationCreditBestEffort(context, input.sessionSecret, reservation, capability, reasonCode);
      await appendEventBestEffort(context, input.sessionId, 'generation_failed', {
        flow: session.flow,
        capability,
        reservationId: reservation.id,
        reasonCode,
      });
      if (session.flow === 'CREATE') await updateSessionBestEffort(context, input.sessionId, input.sessionSecret, 'ENTITLED');
    }
    throw customerSafeGenerationError(error);
  }
}

export async function resumeAnnunci10xPremiumOutput(input: { sessionId: string; sessionSecret: string; context?: Annunci10xRuntimeContext; fulfillmentEnabled?: boolean }): Promise<PublicAnnunci10xPremiumOutput | null> {
  const context = input.context ?? createAnnunci10xRuntimeContext();
  const session = await requireOwnedSession(context, input.sessionId, input.sessionSecret);
  if (input.fulfillmentEnabled ?? isAnnunci10xFulfillmentEnabled()) {
    return resumeAnnunci10xDeliverableOutput({ sessionId: input.sessionId, sessionSecret: input.sessionSecret, context });
  }
  const output = await context.persistence.getLatestOutput(input.sessionId, input.sessionSecret, 'MASTER');
  if (!output) return null;
  const validation = validateGeneratedAd(output.generatedContent);
  if (!validation.ok) throw new Annunci10xPublicError('INTERNAL', 'Output Annunci 10x non valido.', 500);
  const snapshot = await context.persistence.getLatestSnapshot(input.sessionId, input.sessionSecret);
  const evaluation = await context.persistence.getLatestEvaluation(input.sessionId, input.sessionSecret);
  if (!snapshot || !evaluation) return null;
  const persistedEvaluation = requirePremiumEvaluation(evaluation);
  const payload = readPremiumPayload(validation.value);
  const gate = persistedEvaluation.gate ?? payload.gate;
  if (!gate) throw new Annunci10xPublicError('INTERNAL', 'Gate premium Annunci 10x non valida.', 500);
  const variant = await context.persistence.getLatestOutput(input.sessionId, input.sessionSecret, 'CHANNEL_VARIANT', output.id);
  await context.persistence.appendEvent({ sessionId: input.sessionId, eventName: 'output_viewed', metadata: { outputId: output.id } });
  return publicPremiumOutput({
    session,
    snapshot,
    output,
    master: validation.value,
    channelVariant: variant?.generatedContent as ChannelVariant | null ?? null,
    score: persistedEvaluation.score,
    gate,
    claimCheck: payload.claimCheck,
    comparison: payload.comparison,
    operations: [],
    provider: context.configuredProvider,
  });
}

export async function resumeAnnunci10xDeliverableOutput(input: { sessionId: string; sessionSecret: string; context?: Annunci10xRuntimeContext }): Promise<PublicAnnunci10xPremiumOutput | null> {
  const context = input.context ?? createAnnunci10xRuntimeContext();
  const session = await requireOwnedSession(context, input.sessionId, input.sessionSecret);
  return resumeConsumedReservationOutput({
    context,
    session,
    sessionSecret: input.sessionSecret,
    capability: capabilityForSession(session),
    recordViewEvent: true,
  });
}

export async function getAnnunci10xPremiumFulfillmentStatus(input: {
  sessionId: string;
  sessionSecret: string;
  context?: Annunci10xRuntimeContext;
  fulfillmentEnabled?: boolean;
}): Promise<PublicAnnunci10xPremiumFulfillmentStatus> {
  const context = input.context ?? createAnnunci10xRuntimeContext();
  const session = await requireOwnedSession(context, input.sessionId, input.sessionSecret);
  const capability = capabilityForSession(session);
  const deliverable = await resumeConsumedReservationOutput({
    context,
    session,
    sessionSecret: input.sessionSecret,
    capability,
    recordViewEvent: false,
  });
  if (deliverable) {
    const ready = deliverable.validationState === 'READY' || deliverable.validationState === 'READY_WITH_WARNINGS';
    return {
      flow: session.flow,
      state: ready ? 'READY' : 'NEEDS_REVIEW',
      canGenerate: false,
      outputAvailable: true,
    };
  }

  const latestReservation = await context.persistence.getLatestGenerationReservation(session.id, input.sessionSecret, capability);
  if (latestReservation?.status === 'RESERVED' && Date.parse(latestReservation.leaseExpiresAt) > Date.now()) {
    return { flow: session.flow, state: 'PREPARING', canGenerate: false, outputAvailable: false };
  }

  const entitlements = await context.persistence.getEffectiveEntitlements(session.id, input.sessionSecret);
  const creditCount = capability === 'REWRITE_CREDIT' ? entitlements.rewriteCredits : entitlements.createCredits;
  if (creditCount > 0) {
    const enabled = input.fulfillmentEnabled ?? isAnnunci10xFulfillmentEnabled();
    return {
      flow: session.flow,
      state: enabled ? 'READY_TO_GENERATE' : 'PAYMENT_CONFIRMED',
      canGenerate: enabled,
      outputAvailable: false,
    };
  }

  return { flow: session.flow, state: 'NONE', canGenerate: false, outputAvailable: false };
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
  const master = prepareMasterForValidation({
    ...validation.value,
    sections: mergeRevisedSections(validation.value.sections, revised.revisedSections, revised.changedSectionIds),
    generatedAt: new Date().toISOString(),
  }, snapshot.roleCard);
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
  const evaluate = await evaluateGeneratedMasterV2({
    context,
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    snapshot,
    master,
    channel: preferredChannel(snapshot),
    identity: stableHash({ snapshotId: snapshot.id, outputId: output.id, editRequest: input.editRequest, operation: 'EVALUATE_V2' }),
  });
  operations.push(toPublicOperation(evaluate, 'EVALUATE', context.configuredProvider));
  const gate = gateFromValidation(validate, evaluatePublicationGate());
  const claimCheck = claimCheckFromValidation(validate);
  const comparison = buildComparison(session, master, evaluate.score, previousEvaluationForComparison(await context.persistence.getLatestEvaluation(input.sessionId, input.sessionSecret)));
  const masterToPersist = attachPremiumPayload(master, {
    comparison,
    claimCheck,
    gate,
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
    score: evaluate.score,
    gate: null,
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
      score: evaluate.score,
      gate,
      claimCheck,
      comparison,
      operations,
      provider: context.configuredProvider,
    }),
  };
}

async function executePremiumPipeline(input: {
  context: Annunci10xRuntimeContext;
  session: PersistedAnnunci10xSession;
  sessionSecret: string;
  snapshot: PersistedSnapshot;
  channel: PublicationChannel;
  authIdentity: string;
}): Promise<{
  masterOutput: PersistedOutput;
  evaluation: PersistedEvaluation;
  variantOutput: PersistedOutput | null;
  masterToPersist: GeneratedAd;
  channelVariant: ChannelVariant | null;
  score: Annunci10xPersistedScoreResult;
  gate: PublicationGate;
  claimCheck: ClaimCheck[];
  comparison: ComparisonResult | null;
  operations: PublicAnnunci10xOperation[];
}> {
  const orchestrator = new Annunci10xAiOrchestrator({ provider: input.context.provider, persistence: input.context.persistence });
  const operations: PublicAnnunci10xOperation[] = [];
  const generatedResult = await orchestrator.runTask({
    sessionId: input.session.id,
    sessionSecret: input.sessionSecret,
    operationType: 'GENERATE',
    input: {
      roleCard: input.snapshot.roleCard,
      roleProfile: input.snapshot.roleProfile,
      communicationStrategy: input.snapshot.communicationStrategy,
    },
    inputSnapshotId: input.snapshot.id,
    idempotencyInputIdentityOverride: stableHash({ snapshotId: input.snapshot.id, authIdentity: input.authIdentity, operation: 'GENERATE' }),
  });
  operations.push(toPublicOperation(generatedResult, 'GENERATE', input.context.configuredProvider));
  const generated = generatedResult.output as Annunci10xGenerateOutput;
  const generatedMaster = prepareMasterForValidation(generated.generatedAd, input.snapshot.roleCard);

  const firstValidationRaw = await validateMaster({
    orchestrator,
    sessionId: input.session.id,
    sessionSecret: input.sessionSecret,
    snapshot: input.snapshot,
    master: generatedMaster,
    authIdentity: input.authIdentity,
    provider: input.context.configuredProvider,
    operations,
    phase: 'initial',
  });
  const firstValidation = normalizeRepairableValidation(firstValidationRaw);

  const revised = await applyAutomaticRevisions({
    orchestrator,
    sessionId: input.session.id,
    sessionSecret: input.sessionSecret,
    snapshot: input.snapshot,
    initialMaster: generatedMaster,
    initialValidation: firstValidation,
    authIdentity: input.authIdentity,
    provider: input.context.configuredProvider,
    operations,
  });
  const finalMaster = revised.master;
  const finalValidation = revised.validation;
  const automaticRevisionCount = revised.automaticRevisionCount;

  const evaluateResult = await evaluateGeneratedMasterV2({
    context: input.context,
    sessionId: input.session.id,
    sessionSecret: input.sessionSecret,
    snapshot: input.snapshot,
    master: finalMaster,
    channel: input.channel,
    identity: stableHash({ snapshotId: input.snapshot.id, authIdentity: input.authIdentity, operation: 'EVALUATE_V2', master: finalMaster.sections }),
  });
  operations.push(toPublicOperation(evaluateResult, 'EVALUATE', input.context.configuredProvider));

  const gate = gateFromValidation(finalValidation, evaluatePublicationGate());
  const claimCheck = claimCheckFromValidation(finalValidation);
  const comparison = buildComparison(input.session, finalMaster, evaluateResult.score, await baselineEvaluationForComparison(input.context, input.session, input.sessionSecret));
  const masterToPersist = attachPremiumPayload(finalMaster, {
    comparison,
    claimCheck,
    gate,
    rationale: rationaleFromSnapshot(input.snapshot),
    automaticRevisionCount,
    validationResult: finalValidation.result,
  });
  const masterOutput = await input.context.persistence.saveOutput({
    sessionId: input.session.id,
    sessionSecret: input.sessionSecret,
    snapshotId: input.snapshot.id,
    outputType: 'MASTER',
    generatedContent: masterToPersist,
    validationState: gate.status,
  });

  const evaluation = await input.context.persistence.saveEvaluation({
    sessionId: input.session.id,
    sessionSecret: input.sessionSecret,
    target: { kind: 'GENERATED_MASTER', generatedAdId: finalMaster.id },
    targetRef: finalMaster.id,
    targetOutputId: masterOutput.id,
    score: evaluateResult.score,
    gate: null,
  });

  let variantOutput: PersistedOutput | null = null;
  let channelVariant: ChannelVariant | null = null;
  if (gate.status !== 'BLOCKED') {
    const channelResult = await orchestrator.runTask({
      sessionId: input.session.id,
      sessionSecret: input.sessionSecret,
      operationType: 'CHANNEL_ADAPTER',
      input: { master: finalMaster, roleCard: input.snapshot.roleCard, targetChannel: input.channel },
      inputSnapshotId: input.snapshot.id,
      idempotencyInputIdentityOverride: stableHash({ snapshotId: input.snapshot.id, authIdentity: input.authIdentity, operation: 'CHANNEL_ADAPTER', master: finalMaster.sections, channel: input.channel }),
    });
    operations.push(toPublicOperation(channelResult, 'CHANNEL_ADAPTER', input.context.configuredProvider));
    channelVariant = normalizeChannelVariant((channelResult.output as Annunci10xChannelAdapterOutput).channelVariant, input.snapshot.roleCard);
    variantOutput = await input.context.persistence.saveOutput({
      sessionId: input.session.id,
      sessionSecret: input.sessionSecret,
      snapshotId: input.snapshot.id,
      outputType: 'CHANNEL_VARIANT',
      generatedContent: channelVariant,
      channel: channelVariant.channel,
      parentMasterId: masterOutput.id,
      validationState: gate.status,
    });
    await appendEventBestEffort(input.context, input.session.id, 'channel_variant_created', { channel: channelVariant.channel, masterOutputId: masterOutput.id });
  }

  return {
    masterOutput,
    evaluation,
    variantOutput,
    masterToPersist,
    channelVariant,
    score: evaluateResult.score,
    gate,
    claimCheck,
    comparison,
    operations,
  };
}

async function applyAutomaticRevisions(input: {
  orchestrator: Annunci10xAiOrchestrator;
  sessionId: string;
  sessionSecret: string;
  snapshot: PersistedSnapshot;
  initialMaster: GeneratedAd;
  initialValidation: Annunci10xValidateOutput;
  authIdentity: string;
  provider: Annunci10xConfiguredProvider;
  operations: PublicAnnunci10xOperation[];
}): Promise<{ master: GeneratedAd; validation: Annunci10xValidateOutput; automaticRevisionCount: 0 | 1 | 2 }> {
  let master = input.initialMaster;
  let validation = input.initialValidation;
  let automaticRevisionCount: 0 | 1 | 2 = 0;

  while (
    validation.result === 'NEEDS_REVISION'
    && automaticRevisionCount < 2
    && (automaticRevisionCount === 0 || hasActionableAutoRepair(validation))
  ) {
    const revisionNumber = automaticRevisionCount + 1;
    const revisionResult = await input.orchestrator.runTask({
      sessionId: input.sessionId,
      sessionSecret: input.sessionSecret,
      operationType: 'REVISE',
      input: {
        currentMaster: master,
        roleCard: input.snapshot.roleCard,
        communicationStrategy: input.snapshot.communicationStrategy,
        validationIssues: validation,
      },
      inputSnapshotId: input.snapshot.id,
      idempotencyInputIdentityOverride: stableHash({
        snapshotId: input.snapshot.id,
        authIdentity: input.authIdentity,
        operation: 'REVISE',
        revisionNumber,
        master: master.sections,
      }),
    });
    input.operations.push(toPublicOperation(revisionResult, 'REVISE', input.provider));
    const revision = revisionResult.output as Annunci10xReviseOutput;
    const revisionPlan = enforceEditorialDeletionGuard(master.sections, revision, validation);
    master = prepareMasterForValidation({
      ...master,
      sections: mergeRevisedSections(master.sections, revisionPlan.revisedSections, revisionPlan.changedSectionIds),
      generatedAt: new Date().toISOString(),
    }, input.snapshot.roleCard);
    automaticRevisionCount = revisionNumber as 1 | 2;
    validation = normalizeRepairableValidation(await validateMaster({
      orchestrator: input.orchestrator,
      sessionId: input.sessionId,
      sessionSecret: input.sessionSecret,
      snapshot: input.snapshot,
      master,
      authIdentity: input.authIdentity,
      provider: input.provider,
      operations: input.operations,
      phase: `post-revise-${revisionNumber}`,
    }));
  }

  return { master, validation, automaticRevisionCount };
}

function hasActionableAutoRepair(validation: Annunci10xValidateOutput): boolean {
  if (validation.claims.some((claim) => claim.action === 'REQUEST_CONFIRMATION')) return false;
  return validation.claims.some((claim) => claim.action === 'REMOVE')
    || validation.unsupportedClaims.length > 0
    || validation.contradictions.length > 0
    || validation.omittedCriticalFacts.length > 0
    || validation.alteredRequirements.length > 0;
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
    promptVersionOverride: input.phase.startsWith('post-revise') ? `${ANNUNCI10X_PROMPT_PACK_VERSION_V2}.post-revise` : undefined,
  });
  input.operations.push(toPublicOperation(result, 'VALIDATE', input.provider));
  return result.output as Annunci10xValidateOutput;
}

async function evaluateGeneratedMasterV2(input: {
  context: Annunci10xRuntimeContext;
  sessionId: string;
  sessionSecret: string;
  snapshot: PersistedSnapshot;
  master: GeneratedAd;
  channel: PublicationChannel;
  identity: string;
}) {
  const roleProfile = input.snapshot.roleProfile;
  const communicationStrategy = input.snapshot.communicationStrategy;
  if (!roleProfile || !communicationStrategy) {
    throw new Annunci10xPublicError('GENERATION_BLOCKED', 'Scheda ruolo, profilo e strategia devono essere completati prima della valutazione.', 409);
  }
  return runPersistedAnnunci10xEvaluateV2({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    provider: input.context.provider,
    persistence: input.context.persistence,
    inputSnapshotId: input.snapshot.id,
    idempotencyInputIdentity: input.identity,
    input: buildEvaluateInputV2({
      rawAdText: masterText(input.master),
      targetKind: 'GENERATED_MASTER',
      channelHint: input.channel,
      roleCard: input.snapshot.roleCard,
      roleProfile,
      communicationStrategy,
    }),
  });
}

function gateFromValidation(validation: Annunci10xValidateOutput, baseGate: PublicationGate): PublicationGate {
  const findings = [];
  if (validation.result === 'NEEDS_REVISION') {
    findings.push(editorialRevisionRequired('La validazione finale richiede ancora una revisione editoriale prima della pubblicazione.', 'WARNING'));
  }
  for (const claim of validation.unsupportedClaims) findings.push(unconfirmedClaim(`Claim non supportato: ${claim}`, validation.result === 'BLOCK' ? 'BLOCKING' : 'WARNING'));
  for (const contradiction of validation.contradictions) findings.push(materialConflict(`Contraddizione: ${contradiction}`, 'BLOCKING'));
  for (const requirement of validation.alteredRequirements) findings.push(materialConflict(`Requisito alterato: ${requirement}`, 'BLOCKING'));
  for (const fact of validation.omittedCriticalFacts) findings.push(unconfirmedClaim(`Fatto critico omesso: ${fact}`, 'WARNING'));
  if (!findings.length) return baseGate;
  return evaluatePublicationGate({ findings, evaluatedAt: baseGate.evaluatedAt });
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

function buildComparison(session: PersistedAnnunci10xSession, master: GeneratedAd, score: Annunci10xPersistedScoreResult, previous: { score: Annunci10xPersistedScoreResult; target: string } | null): ComparisonResult | null {
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
  score: Annunci10xPersistedScoreResult;
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
    masterText: masterText(input.master),
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
  gate: PublicationGate;
  rationale: string[];
  automaticRevisionCount: 0 | 1 | 2;
  validationResult: Annunci10xValidateOutput['result'];
}): GeneratedAd {
  return {
    ...master,
    annunci10xPremium: {
      comparison: payload.comparison,
      claimCheck: payload.claimCheck,
      gate: payload.gate,
      rationale: payload.rationale,
      automaticRevisionCount: payload.automaticRevisionCount,
      validationResult: payload.validationResult,
    },
  } as GeneratedAd;
}

function readPremiumPayload(master: GeneratedAd): { comparison: ComparisonResult | null; claimCheck: ClaimCheck[]; gate: PublicationGate | null; rationale: string[] } {
  const payload = (master as GeneratedAd & { annunci10xPremium?: unknown }).annunci10xPremium;
  if (typeof payload !== 'object' || payload === null) return { comparison: null, claimCheck: [], gate: null, rationale: [] };
  const record = payload as { comparison?: ComparisonResult | null; claimCheck?: ClaimCheck[]; gate?: PublicationGate | null; rationale?: string[] };
  return {
    comparison: record.comparison ?? null,
    claimCheck: Array.isArray(record.claimCheck) ? record.claimCheck : [],
    gate: record.gate ?? null,
    rationale: Array.isArray(record.rationale) ? record.rationale : [],
  };
}

async function requireOwnedSession(context: Annunci10xRuntimeContext, sessionId: string, sessionSecret: string): Promise<PersistedAnnunci10xSession> {
  const session = await context.persistence.getSession(sessionId, sessionSecret);
  if (!session) throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione Annunci 10x non valida o scaduta.', 401);
  return session;
}

function capabilityForSession(session: PersistedAnnunci10xSession): Annunci10xReservableCapability {
  if (session.flow === 'ANALYZE') return 'REWRITE_CREDIT';
  if (session.flow === 'CREATE') return 'CREATE_CREDIT';
  throw new Annunci10xPublicError('GENERATION_BLOCKED', 'Sessione non compatibile con la generazione Annunci 10x.', 409);
}

async function resumeConsumedReservationOutput(input: {
  context: Annunci10xRuntimeContext;
  session: PersistedAnnunci10xSession;
  sessionSecret: string;
  capability: Annunci10xReservableCapability;
  recordViewEvent?: boolean;
}): Promise<PublicAnnunci10xPremiumOutput | null> {
  const reservation = await input.context.persistence.getLatestConsumedGenerationReservation(input.session.id, input.sessionSecret, input.capability);
  if (!reservation?.outputId) return null;
  const output = await input.context.persistence.getOutputById(reservation.outputId, input.session.id, input.sessionSecret);
  if (!output || output.outputType !== 'MASTER') return null;
  const validation = validateGeneratedAd(output.generatedContent);
  if (!validation.ok) throw new Annunci10xPublicError('INTERNAL', 'Output Annunci 10x non valido.', 500);
  const snapshot = await input.context.persistence.getSnapshotById(output.snapshotId, input.session.id, input.sessionSecret);
  const evaluation = await input.context.persistence.getEvaluationByOutputId(output.id, input.session.id, input.sessionSecret);
  if (!snapshot || !evaluation) return null;
  const persistedEvaluation = requirePremiumEvaluation(evaluation);
  const payload = readPremiumPayload(validation.value);
  const gate = persistedEvaluation.gate ?? payload.gate;
  if (!gate) throw new Annunci10xPublicError('INTERNAL', 'Gate premium Annunci 10x non valida.', 500);
  const variant = await input.context.persistence.getLatestOutput(input.session.id, input.sessionSecret, 'CHANNEL_VARIANT', output.id);
  if (input.recordViewEvent !== false) await appendEventBestEffort(input.context, input.session.id, 'output_viewed', { outputId: output.id });
  return publicPremiumOutput({
    session: input.session,
    snapshot,
    output,
    master: validation.value,
    channelVariant: variant?.generatedContent as ChannelVariant | null ?? null,
    score: persistedEvaluation.score,
    gate,
    claimCheck: payload.claimCheck,
    comparison: payload.comparison,
    operations: [],
    provider: input.context.configuredProvider,
  });
}

async function baselineEvaluationForComparison(context: Annunci10xRuntimeContext, session: PersistedAnnunci10xSession, sessionSecret: string): Promise<{ score: Annunci10xPersistedScoreResult; target: string } | null> {
  if (session.flow !== 'ANALYZE') return null;
  const run = await context.persistence.getLatestAnalysisRun(session.id, sessionSecret);
  if (!run || run.status !== 'READY' || !run.evaluationId) return null;
  return previousEvaluationForComparison(await context.persistence.getEvaluationById(run.evaluationId, session.id, sessionSecret));
}

async function appendEventBestEffort(context: Annunci10xRuntimeContext, sessionId: string, eventName: string, metadata: Record<string, unknown>): Promise<void> {
  try {
    await context.persistence.appendEvent({ sessionId, eventName, metadata });
  } catch {
    // Events are observability only and must not decide fulfillment.
  }
}

async function updateSessionBestEffort(context: Annunci10xRuntimeContext, sessionId: string, sessionSecret: string, state: PersistedAnnunci10xSession['state']): Promise<void> {
  try {
    await context.persistence.updateSession({ sessionId, sessionSecret, state });
  } catch {
    // Session state is not the fulfillment authority after a credit is consumed.
  }
}

async function releaseGenerationCreditBestEffort(
  context: Annunci10xRuntimeContext,
  sessionSecret: string,
  reservation: PersistedCreditReservation,
  capability: Annunci10xReservableCapability,
  reasonCode: string,
): Promise<void> {
  try {
    const released = await context.persistence.releaseGenerationCredit({ reservationId: reservation.id, sessionSecret, reasonCode });
    if (released.status === 'RELEASED') {
      await appendEventBestEffort(context, reservation.sessionId, 'generation_credit_released', { reservationId: reservation.id, capability, reasonCode });
    } else if (released.status === 'EXPIRED') {
      await appendEventBestEffort(context, reservation.sessionId, 'generation_credit_expired', { reservationId: reservation.id, capability, reasonCode });
    }
  } catch {
    // A failed release must not leak internals to the browser.
  }
}

function releaseReasonCode(error: unknown): string {
  if (error instanceof Annunci10xPublicError) return sanitizeReasonCode(error.code);
  if (error instanceof Error && error.name) return sanitizeReasonCode(error.name);
  return 'GENERATION_FAILED';
}

function sanitizeReasonCode(value: string): string {
  return value.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 80) || 'GENERATION_FAILED';
}

function customerSafeGenerationError(error: unknown): Error {
  if (error instanceof Annunci10xPublicError) return error;
  return new Annunci10xPublicError('GENERATION_BLOCKED', 'Generazione temporaneamente non disponibile.', 503);
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

function mergeRevisedSections(
  currentSections: GeneratedAd['sections'],
  revisedSections: GeneratedAd['sections'],
  changedSectionIds: readonly string[],
): GeneratedAd['sections'] {
  const revisedById = new Map(revisedSections.map((section) => [section.id, section]));
  const changedIds = new Set([...changedSectionIds, ...revisedSections.map((section) => section.id)]);
  const merged = currentSections.flatMap((section) => {
    if (!changedIds.has(section.id)) return [section];
    const replacement = revisedById.get(section.id);
    return replacement ? [replacement] : [];
  });
  const knownIds = new Set(currentSections.map((section) => section.id));
  return [...merged, ...revisedSections.filter((section) => !knownIds.has(section.id))];
}

function preferredChannel(snapshot: PersistedSnapshot): PublicationChannel {
  return snapshot.communicationStrategy?.channelPriorities[0] ?? 'LINKEDIN';
}

function masterText(master: GeneratedAd): string {
  return master.sections.map((section) => [section.title, section.body].filter((part) => part.trim().length > 0).join('\n')).join('\n\n');
}

function normalizeGeneratedMaster(master: GeneratedAd): GeneratedAd {
  return {
    ...master,
    sections: master.sections.map((section) => section.type === 'TITLE' && normalizeEditorialText(section.body) === normalizeEditorialText(section.title)
      ? { ...section, body: '' }
      : section),
  };
}

function prepareMasterForValidation(master: GeneratedAd, roleCard: RoleCard): GeneratedAd {
  const normalized = normalizeGeneratedMaster(master);
  const title = normalized.sections.find((section) => section.type === 'TITLE');
  const opening = normalized.sections.find((section) => section.type === 'OPENING');
  const claimChecks = normalized.sections.filter((section) => section.type === 'CLAIM_CHECK');

  const canonicalSections = [
    canonicalMissionSection(roleCard),
    canonicalResponsibilitiesSection(roleCard),
    canonicalContextSection(roleCard),
    canonicalRequirementsSection(roleCard),
    canonicalConditionsSection(roleCard),
    canonicalGrowthSection(roleCard),
    canonicalApplicationSection(roleCard),
  ].filter((section): section is GeneratedAd['sections'][number] => Boolean(section));

  return {
    ...normalized,
    sections: [
      ...(title ? [title] : []),
      ...(opening ? [opening] : []),
      ...canonicalSections,
      ...claimChecks,
    ],
  };
}

function normalizeChannelVariant(variant: ChannelVariant, roleCard: RoleCard): ChannelVariant {
  const normalized: ChannelVariant = {
    ...variant,
    sections: variant.sections.map((section) => section.type === 'TITLE' && normalizeEditorialText(section.body) === normalizeEditorialText(section.title)
      ? { ...section, body: '' }
      : section),
  };
  const ensured = prepareMasterForValidation({
    id: normalized.masterAdId,
    sessionId: 'channel-variant',
    kind: 'MASTER',
    sections: normalized.sections,
    sourceOfTruth: true,
    generatedAt: new Date().toISOString(),
    promptVersion: 'channel-variant-normalization',
  }, roleCard);
  return { ...normalized, sections: ensured.sections };
}

function canonicalMissionSection(roleCard: RoleCard): GeneratedAd['sections'][number] | null {
  const mission = publishableFact(roleCard.mission) ?? roleCard.outcomes.map(publishableFact).find(Boolean) ?? null;
  if (!mission) return null;
  return canonicalSection('confirmed-role-mission', 'MISSION', 'Obiettivo del ruolo', mission.value, mission.sourceIds);
}

function canonicalResponsibilitiesSection(roleCard: RoleCard): GeneratedAd['sections'][number] | null {
  const facts = roleCard.responsibilities.map(publishableFact).filter((item): item is CanonicalFact => Boolean(item));
  if (!facts.length) return null;
  return canonicalSection(
    'confirmed-role-responsibilities',
    'RESPONSIBILITIES',
    'Cosa farai',
    facts.map((fact) => fact.value).join('\n'),
    facts.flatMap((fact) => fact.sourceIds),
  );
}

function canonicalContextSection(roleCard: RoleCard): GeneratedAd['sections'][number] | null {
  const facts = [
    labeledCanonicalFact('Azienda', roleCard.attractionContext.companyDescription),
    labeledCanonicalFact('Contesto operativo', roleCard.attractionContext.operatingContext),
    labeledCanonicalFact('Autonomia', roleCard.attractionContext.autonomy),
    labeledCanonicalFact('Imprevisti e variabilità', roleCard.attractionContext.unexpectedEvents),
  ].filter((item): item is CanonicalFact => Boolean(item));
  if (!facts.length) return null;
  return canonicalSection(
    'confirmed-role-reality',
    'CONTEXT',
    'Come si lavora davvero',
    facts.map((fact) => fact.value).join('\n'),
    facts.flatMap((fact) => fact.sourceIds),
  );
}

function canonicalRequirementsSection(roleCard: RoleCard): GeneratedAd['sections'][number] | null {
  const labels: Record<RoleCard['requirements'][number]['classification'], string> = {
    REQUIRED: 'Indispensabili',
    PREFERRED: 'Preferenziali',
    TRAINABLE: 'Apprendibili',
    DISQUALIFYING: 'Vincoli',
  };
  const facts = roleCard.requirements.flatMap((requirement) => {
    const fact = publishableFact(requirement.label);
    return fact ? [{ ...fact, value: `${labels[requirement.classification]}: ${fact.value}` }] : [];
  });
  if (!facts.length) return null;
  return canonicalSection(
    'confirmed-role-requirements',
    'REQUIREMENTS',
    'Requisiti',
    facts.map((fact) => fact.value).join('\n'),
    facts.flatMap((fact) => fact.sourceIds),
  );
}

function canonicalConditionsSection(roleCard: RoleCard): GeneratedAd['sections'][number] | null {
  const workMode = publishableFact(roleCard.attractionContext.workModeDetail) ?? publishableFact(roleCard.attractionContext.workMode);
  const facts = [
    labeledCanonicalFact('Sede', roleCard.attractionContext.location),
    workMode ? { ...workMode, value: `Modalità: ${workMode.value}` } : null,
    labeledCanonicalFact('Contratto', roleCard.attractionContext.contractType),
    labeledCanonicalFact('Orario', roleCard.attractionContext.schedule),
    labeledCanonicalFact('Turni', roleCard.attractionContext.shifts),
    labeledCanonicalFact('Reperibilità', roleCard.attractionContext.onCall),
    labeledCanonicalFact('Retribuzione', roleCard.compensation?.amountText),
  ].filter((item): item is CanonicalFact => Boolean(item));
  if (!facts.length) return null;
  return canonicalSection(
    'confirmed-role-conditions',
    'CONDITIONS',
    'Condizioni',
    facts.map((fact) => fact.value).join('\n'),
    facts.flatMap((fact) => fact.sourceIds),
  );
}

function canonicalGrowthSection(roleCard: RoleCard): GeneratedAd['sections'][number] | null {
  const facts = roleCard.attractionContext.attractivenessEvidence.flatMap((fact) => {
    const candidate = publishableFact(fact);
    if (!candidate) return [];
    const safe = candidate.value
      .split(/[\n.]+/)
      .map((part) => part.trim())
      .filter((part) => part && !isUnknownCandidateValue(part))
      .join('. ');
    return safe ? [{ ...candidate, value: safe }] : [];
  });
  if (!facts.length) return null;
  return canonicalSection(
    'confirmed-role-growth',
    'GROWTH',
    'Cosa offre l’azienda',
    facts.map((fact) => fact.value).join('\n'),
    facts.flatMap((fact) => fact.sourceIds),
  );
}

function canonicalApplicationSection(roleCard: RoleCard): GeneratedAd['sections'][number] | null {
  const application = publishableFact(roleCard.applicationInstructions);
  if (!application) return null;
  return canonicalSection('confirmed-role-application', 'APPLICATION', 'Come candidarsi', application.value, application.sourceIds);
}

type CanonicalFact = { value: string; sourceIds: string[] };

function publishableFact(fact: Fact<string> | undefined): CanonicalFact | null {
  if (!fact?.publishable) return null;
  const value = String(fact.value ?? '').trim();
  if (!value || isUnknownCandidateValue(value)) return null;
  return { value, sourceIds: fact.sourceId ? [fact.sourceId] : [] };
}

function labeledCanonicalFact(label: string, fact: Fact<string> | undefined): CanonicalFact | null {
  const candidate = publishableFact(fact);
  return candidate ? { ...candidate, value: `${label}: ${candidate.value}` } : null;
}

function isUnknownCandidateValue(value: string): boolean {
  return /(?:^|\b)(?:n\/d|da definire|da chiarire|non lo so|open_decision)(?:\b|$)/i.test(value);
}

function canonicalSection(
  id: string,
  type: GeneratedAd['sections'][number]['type'],
  title: string,
  body: string,
  sourceFactIds: string[],
): GeneratedAd['sections'][number] {
  return {
    id,
    type,
    key: id,
    title,
    body: body.trim(),
    sourceFactIds: [...new Set(sourceFactIds)],
  };
}

function normalizeRepairableValidation(validation: Annunci10xValidateOutput): Annunci10xValidateOutput {
  if (validation.result !== 'BLOCK') return validation;
  if (validation.alteredRequirements.length || validation.omittedCriticalFacts.length) return validation;
  if (validation.claims.some((claim) => claim.action === 'REQUEST_CONFIRMATION')) return validation;
  if (!validation.unsupportedClaims.length && !validation.contradictions.length) return validation;
  return { ...validation, result: 'NEEDS_REVISION' };
}

function enforceEditorialDeletionGuard(
  currentSections: GeneratedAd['sections'],
  revision: Annunci10xReviseOutput,
  validation: Annunci10xValidateOutput,
): Pick<Annunci10xReviseOutput, 'revisedSections' | 'changedSectionIds'> {
  const revisedSections = [...revision.revisedSections];
  const changedSectionIds = [...revision.changedSectionIds];
  const revisedIds = new Set(revisedSections.map((section) => section.id));
  const changedIds = new Set(changedSectionIds);

  for (const claim of validation.claims) {
    if (claim.kind !== 'EDITORIAL' || claim.action !== 'REMOVE') continue;
    const cited = currentSections.filter((section) => claim.sourcePaths.includes(section.id));
    const opening = cited.find((section) => section.type === 'OPENING');
    const mission = cited.find((section) => section.type === 'MISSION');
    if (!opening || !mission) continue;

    const alreadyDeletesOne = [opening, mission].some((section) => changedIds.has(section.id) && !revisedIds.has(section.id));
    if (alreadyDeletesOne) continue;

    const touchedOpening = changedIds.has(opening.id);
    const touchedMission = changedIds.has(mission.id);
    const removeId = touchedMission && !touchedOpening ? opening.id : mission.id;
    if (!changedIds.has(removeId)) {
      changedSectionIds.push(removeId);
      changedIds.add(removeId);
    }
    const replacementIndex = revisedSections.findIndex((section) => section.id === removeId);
    if (replacementIndex >= 0) revisedSections.splice(replacementIndex, 1);
    revisedIds.delete(removeId);
  }

  return { revisedSections, changedSectionIds };
}

function normalizeEditorialText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

const CANDIDATE_FACT_STOP_WORDS = new Set([
  'alla', 'alle', 'allo', 'anche', 'come', 'con', 'dalla', 'dalle', 'dello', 'della', 'delle', 'degli',
  'dentro', 'dopo', 'durante', 'essere', 'fino', 'gli', 'nella', 'nelle', 'nello', 'oltre', 'per', 'piu',
  'sono', 'sulla', 'sulle', 'sullo', 'tra', 'una', 'uno', 'questa', 'questo', 'azienda', 'ruolo',
]);

function isCandidateFactSemanticallyRepresented(master: GeneratedAd, expected: string, sourceIds: readonly string[]): boolean {
  const expectedTokens = semanticCandidateTokens(expected);
  if (!expectedTokens.length) return true;

  const allText = masterText(master);
  const linkedText = sourceIds.length
    ? master.sections
      .filter((section) => section.sourceFactIds.some((sourceId) => sourceIds.includes(sourceId)))
      .map((section) => `${section.title} ${section.body}`)
      .join(' ')
    : '';

  return candidateTextCoversFact(linkedText, expectedTokens, expected, 0.35)
    || candidateTextCoversFact(allText, expectedTokens, expected, 0.5);
}

function candidateTextCoversFact(candidateText: string, expectedTokens: readonly string[], expectedRaw: string, ratio: number): boolean {
  if (!candidateText.trim()) return false;
  const candidateTokens = new Set(semanticCandidateTokens(candidateText));
  const expectedNumbers = [...new Set((expectedRaw.match(/\b\d+(?:[.,]\d+)?\b/g) ?? []).map((value) => value.toLowerCase()))];
  const candidateNumbers = new Set((candidateText.match(/\b\d+(?:[.,]\d+)?\b/g) ?? []).map((value) => value.toLowerCase()));
  if (expectedNumbers.some((value) => !candidateNumbers.has(value))) return false;

  const overlap = expectedTokens.filter((token) => candidateTokens.has(token)).length;
  const required = expectedTokens.length <= 3
    ? Math.min(2, expectedTokens.length)
    : Math.max(2, Math.ceil(expectedTokens.length * ratio));
  return overlap >= required;
}

function semanticCandidateTokens(value: string): string[] {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const tokens = normalized.match(/[a-z0-9]+/g) ?? [];
  return [...new Set(tokens
    .filter((token) => (/^\d+$/.test(token) || token.length >= 3) && !CANDIDATE_FACT_STOP_WORDS.has(token))
    .map((token) => /^\d+$/.test(token) || token.length <= 7 ? token : token.slice(0, 7)))];
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

function previousEvaluationForComparison(evaluation: PersistedEvaluation | null): { score: Annunci10xPersistedScoreResult; target: string } | null {
  if (!evaluation || !(isV2Evaluation(evaluation) || isV1Evaluation(evaluation))) return null;
  return { score: evaluation.score, target: evaluation.target };
}

function requirePremiumEvaluation(evaluation: PersistedEvaluation): PersistedEvaluation & { score: Annunci10xPersistedScoreResult } {
  if (!(isV2Evaluation(evaluation) || isV1Evaluation(evaluation))) {
    throw new Annunci10xPublicError('INTERNAL', 'Evaluation premium Annunci 10x non valida.', 500);
  }
  return evaluation;
}

function isV1Evaluation(evaluation: PersistedEvaluation): evaluation is PersistedEvaluation & { score: ScoreResult; gate: PublicationGate } {
  return evaluation.score.rubricVersion === ANNUNCI10X_RUBRIC_VERSION && evaluation.gate !== null;
}

function isV2Evaluation(evaluation: PersistedEvaluation): evaluation is PersistedEvaluation & { score: ScoreResultV2; gate: null } {
  return evaluation.score.rubricVersion === ANNUNCI10X_RUBRIC_VERSION_V2 && evaluation.gate === null;
}

function scoreLabel(score?: Annunci10xPersistedScoreResult): string {
  if (!score) return 'N/D';
  if (typeof score.value === 'number') return `${score.value}/100`;
  if ('interval' in score && score.interval) return `${score.interval.min}-${score.interval.max}/100`;
  return 'N/D';
}

function versions(): PublicAnnunci10xPremiumOutput['versions'] {
  return {
    dataContractVersion: ANNUNCI10X_DATA_CONTRACT_VERSION,
    methodVersion: ANNUNCI10X_METHOD_VERSION_V2,
    rubricVersion: ANNUNCI10X_RUBRIC_VERSION_V2,
    scoreSemanticsVersion: ANNUNCI10X_SCORE_SEMANTICS_VERSION_V2,
    strategyVersion: ANNUNCI10X_STRATEGY_VERSION,
    promptVersion: ANNUNCI10X_PROMPT_PACK_VERSION_V2,
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
