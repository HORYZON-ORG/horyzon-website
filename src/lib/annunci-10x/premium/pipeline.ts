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
import {
  applyAnnunci10xClientRevision,
  runAnnunci10xDecisionEngineCreateRuntime,
  type Annunci10xDecisionEngineWriter,
} from '../decision-engine/create-runtime.ts';
import type { Annunci10xDecisionReport } from '../decision-engine/types.ts';
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
  CommunicationStrategy,
  ComparisonResult,
  Fact,
  GeneratedAd,
  GeneratedSection,
  PublicationChannel,
  PublicationGate,
  RoleCard,
  RoleProfile,
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
  clientRevisionCount: number;
  clientRevisionLimit: 3;
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
  status:
    | 'EDITORIAL_REVISED'
    | 'REQUIRES_REGENERATION'
    | 'CONFIRMATION_REQUIRED'
    | 'REVISION_APPLIED'
    | 'REVISION_BLOCKED'
    | 'REVISION_LIMIT_REACHED';
  intent: Annunci10xEditClassifierOutput['intent'];
  reason: string;
  affectedPaths: string[];
  revisionCount?: number;
  revisionLimit?: 3;
  output?: PublicAnnunci10xPremiumOutput;
  operations: PublicAnnunci10xOperation[];
}

export type Annunci10xNarrativeSufficiencyStatus = 'SUFFICIENT' | 'INSUFFICIENT';

export interface Annunci10xNarrativeSufficiencyQuestion {
  id: string;
  stepId: 'WORK_REALITY' | 'REQUIREMENTS' | 'ATTRACTION' | 'OFFER';
  fieldKey: string;
  question: string;
  reason: string;
  priority: 'MEDIUM' | 'HIGH';
}

export interface Annunci10xNarrativeSufficiencyResult {
  status: Annunci10xNarrativeSufficiencyStatus;
  summary: string;
  sufficientSignals: string[];
  gaps: string[];
  questions: Annunci10xNarrativeSufficiencyQuestion[];
}

const DECISION_ENGINE_WRITER_PROMPT_VERSION = `${ANNUNCI10X_PROMPT_PACK_VERSION_V2}.decision-engine-writer.v5`;
const DECISION_ENGINE_REPAIR_PROMPT_VERSION = `${ANNUNCI10X_PROMPT_PACK_VERSION_V2}.decision-engine-repair.v3`;

const DECISION_ENGINE_WRITER_PROMPT = [
  'Sei il Writer Annunci 10x. Scrivi copy recruiting finale, non materiale da rielaborare.',
  'Obiettivo: far capire a una persona reale che lavoro fara, in quale contesto, con quali responsabilita e condizioni, usando soltanto fatti confermati.',
  'Regola centrale: Preserva la realta. Migliora la comunicazione.',
  'Truth Ledger, Base Ad e factualConstraints sono le uniche fonti fattuali. communicationStrategy guida tono e priorita ma non autorizza fatti nuovi.',
  'Scrivi per il candidato, non per un sistema HR: niente voce da scheda, audit, report, rubric, database o nota redazionale.',
  'Struttura editoriale di default: massimo 6 sezioni candidate-facing: TITLE, OPENING, RESPONSIBILITIES, REQUIREMENTS, CONDITIONS, APPLICATION.',
  'Una settima sezione e ammessa solo se contiene un fatto distinto e utile che non puo essere integrato senza perdita nelle sei sezioni principali.',
  'Non creare sezioni autonome MISSION, CONTEXT o GROWTH se missione, interlocutori, autonomia, variabilita o attrattivita possono essere integrate naturalmente in OPENING, RESPONSIBILITIES, REQUIREMENTS o CONDITIONS.',
  'Non creare mai una sezione Benefit / Attrattivita quando contiene solo modalita di lavoro, orario, esperienza preferenziale, contratto, compenso o altri fatti gia presenti altrove.',
  'TITLE: usa il titolo esatto del ruolo nel body. Nient altro.',
  'OPENING: 2-4 frasi naturali. Deve far capire subito contesto aziendale, ruolo e risultato del lavoro. Non iniziare con slogan, domande generiche o frasi da employer branding. Se non esiste un motivo supportato per dire "unisciti al team", non dirlo.',
  'RESPONSIBILITIES: e la sezione piu importante. Trasforma le attivita confermate in 2-4 paragrafi collegati, non in una lista di micro-task. Spiega come le attivita stanno insieme, usando solo relazioni gia supportate dai facts. Integra qui interlocutori, autonomia e gestione degli imprevisti quando pertinenti.',
  'Non inventare sequenze, frequenze o una giornata tipo. Evita "ogni giorno", "quotidianamente", "spesso", "regolarmente" se non confermati.',
  'REQUIREMENTS: scrivi un breve paragrafo di fit candidato. Distingui chiaramente obbligatori e preferenziali, ma evita etichette da modulo come "Obbligatori:" e "Preferenziale:" quando puoi esprimerli in prosa naturale.',
  'Collega soft skill e requisiti alle attivita concrete che li rendono rilevanti. Non limitarti a un elenco di aggettivi.',
  'CONDITIONS: sii compatto e preciso. Preserva esattamente sede, modalita, orario, contratto, compenso, turni e reperibilita nel significato e nei numeri.',
  'APPLICATION: se il percorso e generico, usa una CTA neutra e umana. Non inventare CV, email, form, colloqui, tempi di risposta o step di selezione.',
  'Ogni fatto importante va detto una volta nel punto migliore. Se una sezione ripete contenuto gia presente, fondila nella sezione piu naturale e ometti quella ridondante.',
  'Non pubblicare TRAINABLE, vincoli interni, dati mancanti o frasi come non dichiarato/non specificato. Omettili.',
  'Non aggiungere processi, strumenti, benefit, condizioni, canali, esiti, livelli contrattuali, step di selezione, frequenze o conseguenze operative non autorizzati.',
  'Evita slogan generici: ambiente dinamico, opportunita unica, crescita, team fantastico, leader di mercato, fare la differenza, ruolo strategico, se non supportati.',
  'Evita titoli o formule interne come Missione, Contesto operativo, Benefit / Attrattivita dichiarati, Requisiti obbligatori, Requisiti preferenziali, Elementi concreti da valorizzare.',
  'Preferisci titoli naturali: Il ruolo, Cosa farai, Cosa cerchiamo, Condizioni di lavoro, Candidatura.',
  'Prima di finalizzare, rileggi come candidato: deve sembrare un annuncio gia pubblicato da un azienda seria, non una trascrizione dei campi raccolti.',
  'Restituisci soltanto JSON valido nello schema richiesto.',
].join('\n');

const DECISION_ENGINE_REPAIR_PROMPT = [
  'Sei il Reviser chirurgico Annunci 10x.',
  'Ricevi un Master, Truth Ledger, Base Ad e hardFailures del Decision Engine.',
  'Correggi solo i claim indicati come non grounded o mancanti. Non riscrivere inutilmente il resto.',
  'Preserva il tono umano, la continuita narrativa e la struttura compatta del Master.',
  'Non creare nuove sezioni MISSION, CONTEXT o GROWTH se il fatto puo essere ripristinato dentro OPENING, RESPONSIBILITIES, REQUIREMENTS o CONDITIONS.',
  'Non creare una sezione Benefit / Attrattivita se ripete modalita di lavoro, orario, esperienza preferenziale, contratto, compenso o altri fatti gia presenti.',
  'Se un fatto manca, aggiungilo nel punto piu naturale con formulazione fedele. Se un claim e inventato, rimuovi o sostituisci soltanto quel concetto usando evidence reale.',
  'Non trasformare il Master in una checklist o in una scheda HR. Non accorciare automaticamente il resto del Master e non introdurre nuovi fatti.',
  'Restituisci soltanto le sezioni modificate nello schema REVISE.',
].join('\n');

const CLIENT_REVISION_LIMIT = 3 as const;
const DECISION_ENGINE_CLIENT_REVISION_PROMPT_VERSION = `${ANNUNCI10X_PROMPT_PACK_VERSION_V2}.decision-engine-client-revision`;
const DECISION_ENGINE_CLIENT_REVISION_PROMPT = [
  'Sei l\'editor di Annunci 10x.',
  'Devi riscrivere esclusivamente la sezione indicata dal cliente, senza cambiare titolo, id, tipo o struttura delle altre sezioni.',
  'Usa il Truth Ledger come unica fonte fattuale. Non aggiungere fatti, condizioni, strumenti, benefit, interlocutori o processi non dichiarati.',
  'Segui la richiesta editoriale del cliente finche non altera la realta confermata.',
  'Restituisci nello schema REVISE una sola revisedSection: quella target. changedSectionIds deve contenere solo il suo id.',
  'Preserva un testo candidate-facing naturale, discorsivo e pronto da pubblicare.',
].join('\n');

export async function runAnnunci10xPremiumGeneration(input: Annunci10xPremiumGenerationInput): Promise<PublicAnnunci10xPremiumOutput> {
  const context = input.context ?? createAnnunci10xRuntimeContext();
  const session = await requireOwnedSession(context, input.sessionId, input.sessionSecret);
  const lead = await context.persistence.getLead(input.sessionId, input.sessionSecret);
  if (!lead?.emailVerifiedAt) {
    throw new Annunci10xPublicError('EMAIL_VERIFICATION_REQUIRED', 'Verifica la tua email per generare gratuitamente il tuo Annuncio 10x.', 403);
  }
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

  const authIdentity = stableHash({ authorization: consumed.identity, sessionId: session.id, snapshotId: snapshot.id });

  try {
    const generated = await executePremiumPipeline({
      context,
      session,
      sessionSecret: input.sessionSecret,
      snapshot,
      channel: input.channel ?? preferredChannel(snapshot),
      authIdentity,
    });

    await context.persistence.updateSession({
      sessionId: input.sessionId,
      sessionSecret: input.sessionSecret,
      state: generated.gate.status === 'READY' || generated.gate.status === 'READY_WITH_WARNINGS' ? 'OUTPUT_READY' : 'NEEDS_VERIFICATION',
    });
    await context.persistence.appendEvent({
      sessionId: input.sessionId,
      eventName: 'generation_completed',
      metadata: {
        outputId: generated.masterOutput.id,
        evaluationId: generated.evaluation.id,
        gateStatus: generated.gate.status,
        variantOutputId: generated.variantOutput?.id ?? null,
      },
    });

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
    const blocked = error instanceof Annunci10xPublicError && error.code === 'GENERATION_BLOCKED';
    await context.persistence.updateSession({ sessionId: input.sessionId, sessionSecret: input.sessionSecret, state: blocked ? 'NEEDS_VERIFICATION' : 'ENTITLED' });
    const errorRecord = typeof error === 'object' && error !== null
      ? error as { causeCode?: unknown; message?: unknown }
      : {};
    await context.persistence.appendEvent({
      sessionId: input.sessionId,
      eventName: 'generation_failed',
      metadata: {
        reason: error instanceof Error ? error.name : 'unknown',
        causeCode: typeof errorRecord.causeCode === 'string' ? errorRecord.causeCode : null,
        detail: typeof errorRecord.message === 'string' ? errorRecord.message.slice(0, 240) : null,
      },
    });
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
  const output = await context.persistence.getLatestOutput(session.id, input.sessionSecret, 'MASTER');
  if (output) {
    const ready = output.validationState === 'READY' || output.validationState === 'READY_WITH_WARNINGS';
    return {
      flow: session.flow,
      state: ready ? 'READY' : 'NEEDS_REVIEW',
      canGenerate: false,
      outputAvailable: true,
    };
  }

  if (session.state === 'GENERATING') {
    return { flow: session.flow, state: 'PREPARING', canGenerate: false, outputAvailable: false };
  }

  const lead = await context.persistence.getLead(session.id, input.sessionSecret);
  const enabled = input.fulfillmentEnabled ?? isAnnunci10xFulfillmentEnabled();
  if (lead?.emailVerifiedAt && isGeneratableState(session.state)) {
    return {
      flow: session.flow,
      state: enabled ? 'READY_TO_GENERATE' : 'NONE',
      canGenerate: enabled,
      outputAvailable: false,
    };
  }

  return { flow: session.flow, state: 'NONE', canGenerate: false, outputAvailable: false };
}
export async function requestAnnunci10xPremiumEdit(input: PremiumEditInput): Promise<PublicAnnunci10xPremiumEditResult> {
  const context = input.context ?? createAnnunci10xRuntimeContext();
  const session = await requireOwnedSession(context, input.sessionId, input.sessionSecret);
  if (!input.editRequest.trim()) throw new Annunci10xPublicError('INVALID_INPUT', 'Inserisci una modifica.', 400);

  if (session.flow === 'CREATE') {
    const output = await requireCreateRevisionOutput(context, session, input.sessionSecret);
    const snapshot = await context.persistence.getSnapshotById(output.snapshotId, session.id, input.sessionSecret);
    if (!snapshot) throw new Annunci10xPublicError('INTERNAL', 'Snapshot Annunci 10x non disponibile.', 500);
    const validation = validateGeneratedAd(output.generatedContent);
    if (!validation.ok) throw new Annunci10xPublicError('INTERNAL', 'Output premium non valido.', 500);
    return requestAnnunci10xCreateClientRevision({
      context,
      session,
      sessionSecret: input.sessionSecret,
      output,
      snapshot,
      master: validation.value,
      editRequest: input.editRequest,
      targetSectionId: input.targetPath,
    });
  }

  const authorizationProvider = input.authorizationProvider ?? createProductionGenerationAuthorizationProvider();
  const authorization = await authorizationProvider.authorize({ session, productCode: 'AD_GENERATION' });
  if (authorization.status !== 'AUTHORIZED') throw generationDenied(authorization);
  const output = await context.persistence.getLatestOutput(input.sessionId, input.sessionSecret, 'MASTER');
  const snapshot = await requireGeneratableSnapshot(context, input.sessionId, input.sessionSecret);
  if (!output) throw new Annunci10xPublicError('INVALID_INPUT', 'Nessun output premium da modificare.', 409);
  const validation = validateGeneratedAd(output.generatedContent);
  if (!validation.ok) throw new Annunci10xPublicError('INTERNAL', 'Output premium non valido.', 500);

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

  const groundedNarrativePlan = buildGroundedNarrativePlan(snapshot.roleCard, snapshot.roleProfile ?? null, snapshot.communicationStrategy ?? null);
  const revision = await orchestrator.runTask({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    operationType: 'REVISE',
    input: {
      currentMaster: validation.value,
      roleCard: snapshot.roleCard,
      communicationStrategy: snapshot.communicationStrategy,
      groundedNarrativePlan,
      editRequest: input.editRequest,
    },
    inputSnapshotId: snapshot.id,
    idempotencyInputIdentityOverride: stableHash({ snapshotId: snapshot.id, outputId: output.id, editRequest: input.editRequest, operation: 'REVISE', groundedNarrativePlan }),
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
    groundedNarrativePlan,
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


async function requireCreateRevisionOutput(
  context: Annunci10xRuntimeContext,
  session: PersistedAnnunci10xSession,
  sessionSecret: string,
): Promise<PersistedOutput> {
  const output = await context.persistence.getLatestOutput(session.id, sessionSecret, 'MASTER');
  if (!output) {
    throw new Annunci10xPublicError('INVALID_INPUT', 'La revisione è disponibile solo per un Annuncio 10x già generato.', 409);
  }
  return output;
}

async function resolveLatestMasterFromConsumedReservation(
  context: Annunci10xRuntimeContext,
  session: PersistedAnnunci10xSession,
  sessionSecret: string,
  reservation: PersistedCreditReservation,
): Promise<PersistedOutput | null> {
  if (!reservation.outputId) return null;
  const reservedOutput = await context.persistence.getOutputById(reservation.outputId, session.id, sessionSecret);
  if (!reservedOutput || reservedOutput.outputType !== 'MASTER') return null;
  if (session.flow !== 'CREATE') return reservedOutput;

  const latestMaster = await context.persistence.getLatestOutput(session.id, sessionSecret, 'MASTER');
  if (!latestMaster || latestMaster.id === reservedOutput.id) return reservedOutput;
  if (latestMaster.snapshotId !== reservedOutput.snapshotId) return reservedOutput;
  if (Date.parse(latestMaster.createdAt) < Date.parse(reservedOutput.createdAt)) return reservedOutput;
  return latestMaster;
}


async function requestAnnunci10xCreateClientRevision(input: {
  context: Annunci10xRuntimeContext;
  session: PersistedAnnunci10xSession;
  sessionSecret: string;
  output: PersistedOutput;
  snapshot: PersistedSnapshot;
  master: GeneratedAd;
  editRequest: string;
  targetSectionId?: string;
}): Promise<PublicAnnunci10xPremiumEditResult> {
  const targetSectionId = input.targetSectionId?.trim() ?? '';
  if (!targetSectionId || !input.master.sections.some((section) => section.id === targetSectionId)) {
    throw new Annunci10xPublicError('INVALID_INPUT', 'Seleziona la sezione da modificare.', 400);
  }

  const payload = readPremiumPayload(input.master);
  const revisionCount = payload.clientRevisionCount;
  if (revisionCount >= CLIENT_REVISION_LIMIT) {
    return {
      status: 'REVISION_LIMIT_REACHED',
      intent: 'EDITORIAL',
      reason: 'Hai utilizzato le 3 modifiche incluse per questo annuncio.',
      affectedPaths: [targetSectionId],
      revisionCount,
      revisionLimit: CLIENT_REVISION_LIMIT,
      operations: [],
    };
  }

  const evaluation = await input.context.persistence.getEvaluationByOutputId(
    input.output.id,
    input.session.id,
    input.sessionSecret,
  );
  if (!evaluation) throw new Annunci10xPublicError('INTERNAL', 'Valutazione premium non disponibile.', 500);
  const persistedEvaluation = requirePremiumEvaluation(evaluation);
  const currentGate = persistedEvaluation.gate ?? payload.gate;
  if (!currentGate) throw new Annunci10xPublicError('INTERNAL', 'Gate premium Annunci 10x non valida.', 500);

  const orchestrator = new Annunci10xAiOrchestrator({
    provider: input.context.provider,
    persistence: input.context.persistence,
  });
  const operations: PublicAnnunci10xOperation[] = [];
  const editorialMaster: GeneratedAd = {
    id: input.master.id,
    sessionId: input.master.sessionId,
    kind: input.master.kind,
    sections: input.master.sections.map((section) => ({ ...section, sourceFactIds: [...section.sourceFactIds] })),
    sourceOfTruth: input.master.sourceOfTruth,
    generatedAt: input.master.generatedAt,
    promptVersion: input.master.promptVersion,
  };

  const revision = await applyAnnunci10xClientRevision({
    master: input.master,
    roleCard: input.snapshot.roleCard,
    revisionCount,
    targetSectionId,
    userInstruction: input.editRequest,
    reviseSection: async ({ previousSection, userInstruction, revisionNumber, truthLedger }) => {
      const result = await orchestrator.runTask({
        sessionId: input.session.id,
        sessionSecret: input.sessionSecret,
        operationType: 'REVISE',
        input: {
          currentMaster: editorialMaster,
          roleCard: input.snapshot.roleCard,
          truthLedger,
          targetSection: {
            id: previousSection.id,
            title: previousSection.title,
            body: previousSection.body,
          },
          editRequest: userInstruction,
          revisionNumber,
        },
        inputSnapshotId: input.snapshot.id,
        idempotencyInputIdentityOverride: stableHash({
          snapshotId: input.snapshot.id,
          outputId: input.output.id,
          targetSectionId: previousSection.id,
          editRequest: userInstruction,
          revisionNumber,
          operation: 'DECISION_ENGINE_CLIENT_REVISION',
        }),
        promptVersionOverride: DECISION_ENGINE_CLIENT_REVISION_PROMPT_VERSION,
        systemPromptOverride: DECISION_ENGINE_CLIENT_REVISION_PROMPT,
      });
      operations.push(toPublicOperation(result, 'REVISE', input.context.configuredProvider));
      const revised = result.output as Annunci10xReviseOutput;
      const candidate = revised.revisedSections.find((section) => section.id === previousSection.id)
        ?? revised.revisedSections[0];
      if (!candidate?.body?.trim()) {
        throw new Annunci10xPublicError('GENERATION_BLOCKED', 'La modifica non ha prodotto una sezione valida.', 409);
      }
      return {
        ...previousSection,
        body: candidate.body.trim(),
        sourceFactIds: [...new Set([...previousSection.sourceFactIds, ...candidate.sourceFactIds])],
      } satisfies GeneratedSection;
    },
  });

  if (revision.status === 'REVISION_LIMIT_REACHED') {
    return {
      status: revision.status,
      intent: 'EDITORIAL',
      reason: 'Hai utilizzato le 3 modifiche incluse per questo annuncio.',
      affectedPaths: [targetSectionId],
      revisionCount: revision.revisionCount,
      revisionLimit: CLIENT_REVISION_LIMIT,
      operations,
    };
  }

  if (revision.status !== 'REVISION_APPLIED' || !revision.decisionReport) {
    await appendEventBestEffort(input.context, input.session.id, 'client_revision_blocked', {
      outputId: input.output.id,
      targetSectionId,
      revisionNumber: revision.revisionNumber,
      hardFailures: revision.decisionReport?.hardFailures ?? [],
    });
    return {
      status: 'REVISION_BLOCKED',
      intent: 'EDITORIAL',
      reason: 'La modifica cambierebbe informazioni confermate. Prova a chiedere una riscrittura di tono o chiarezza senza cambiare i fatti.',
      affectedPaths: [targetSectionId],
      revisionCount,
      revisionLimit: CLIENT_REVISION_LIMIT,
      operations,
    };
  }

  const nextGate = gateFromDecisionReport(revision.decisionReport, currentGate);
  if (nextGate.status === 'BLOCKED') {
    return {
      status: 'REVISION_BLOCKED',
      intent: 'EDITORIAL',
      reason: 'La modifica non supera il controllo dei fatti confermati.',
      affectedPaths: [targetSectionId],
      revisionCount,
      revisionLimit: CLIENT_REVISION_LIMIT,
      operations,
    };
  }

  const claimCheck = claimCheckFromDecisionReport(revision.decisionReport);
  const masterToPersist = attachPremiumPayload(revision.master, {
    comparison: payload.comparison,
    claimCheck,
    gate: nextGate,
    rationale: payload.rationale,
    automaticRevisionCount: payload.automaticRevisionCount,
    clientRevisionCount: revision.revisionCount,
    validationResult: 'PASS',
    decisionEngine: {
      ...(payload.decisionEngine ?? {}),
      clientRevision: {
        revisionNumber: revision.revisionNumber,
        targetSectionId,
        decisionReport: revision.decisionReport,
        updatedAt: new Date().toISOString(),
      },
    },
  });

  const saved = await input.context.persistence.saveOutput({
    sessionId: input.session.id,
    sessionSecret: input.sessionSecret,
    snapshotId: input.snapshot.id,
    outputType: 'MASTER',
    generatedContent: masterToPersist,
    validationState: nextGate.status,
  });

  await input.context.persistence.saveEvaluation({
    sessionId: input.session.id,
    sessionSecret: input.sessionSecret,
    target: { kind: 'GENERATED_MASTER', generatedAdId: revision.master.id },
    targetRef: revision.master.id,
    targetOutputId: saved.id,
    score: persistedEvaluation.score,
    gate: null,
  });
  await appendEventBestEffort(input.context, input.session.id, 'client_revision_applied', {
    previousOutputId: input.output.id,
    outputId: saved.id,
    targetSectionId,
    revisionNumber: revision.revisionNumber,
  });

  return {
    status: 'REVISION_APPLIED',
    intent: 'EDITORIAL',
    reason: 'Modifica applicata.',
    affectedPaths: [targetSectionId],
    revisionCount: revision.revisionCount,
    revisionLimit: CLIENT_REVISION_LIMIT,
    operations,
    output: await publicPremiumOutput({
      session: input.session,
      snapshot: input.snapshot,
      output: saved,
      master: masterToPersist,
      channelVariant: null,
      score: persistedEvaluation.score,
      gate: nextGate,
      claimCheck,
      comparison: payload.comparison,
      operations,
      provider: input.context.configuredProvider,
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
  assertNarrativeSufficiencyForGeneration(input.snapshot.roleCard, input.snapshot.roleProfile ?? null, input.snapshot.communicationStrategy ?? null);
  const runtime = await runAnnunci10xDecisionEngineCreateRuntime({
    roleCard: input.snapshot.roleCard,
    writer: decisionEngineWriter({
      orchestrator,
      sessionId: input.session.id,
      sessionSecret: input.sessionSecret,
      snapshot: input.snapshot,
      authIdentity: input.authIdentity,
      provider: input.context.configuredProvider,
      operations,
    }),
  });

  if (runtime.status !== 'READY_FOR_CLIENT' || !runtime.finalMaster) {
    await appendEventBestEffort(input.context, input.session.id, 'generation_blocked', {
      reason: runtime.blockedReason,
      finalDecision: runtime.finalDecisionReport.final,
      hardFailures: runtime.finalDecisionReport.hardFailures,
      unknowns: runtime.finalDecisionReport.unknowns,
      decisionEngineDebug: {
        baseAdText: runtime.baseAd.text,
        initialMasterText: runtime.initialMaster ? masterText(runtime.initialMaster) : null,
        sanitizedInitialMasterText: runtime.sanitizedInitialMaster ? masterText(runtime.sanitizedInitialMaster) : null,
        initialDecisionReportJson: JSON.stringify(runtime.initialDecisionReport),
        repairRequest: runtime.repairRequest ? {
          currentMaster: runtime.repairRequest.currentMaster,
          hardFailures: runtime.repairRequest.hardFailures,
        } : null,
        repairResultText: runtime.repairResult ? masterText(runtime.repairResult) : null,
        sanitizedRepairResultText: runtime.sanitizedRepairResult ? masterText(runtime.sanitizedRepairResult) : null,
        finalMasterText: runtime.finalMaster ? masterText(runtime.finalMaster) : null,
        finalDecisionReportJson: JSON.stringify(runtime.finalDecisionReport),
        finalDecision: runtime.status,
        unknowns: runtime.unknowns,
        providerCallCount: runtime.providerCallCount,
      },
    });
    throw new Annunci10xPublicError('GENERATION_BLOCKED', runtime.blockedReason ?? 'Decision Engine ha bloccato la generazione.', 409);
  }

  const finalMaster = runtime.finalMaster;
  const finalValidation = validationFromDecisionReport(runtime.finalDecisionReport);
  const automaticRevisionCount = runtime.automaticRevisionCount;

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

  const gate = gateFromDecisionReport(runtime.finalDecisionReport, evaluatePublicationGate());
  const claimCheck = claimCheckFromDecisionReport(runtime.finalDecisionReport);
  const comparison = buildComparison(input.session, finalMaster, evaluateResult.score, await baselineEvaluationForComparison(input.context, input.session, input.sessionSecret));
  const masterToPersist = attachPremiumPayload(finalMaster, {
    comparison,
    claimCheck,
    gate,
    rationale: rationaleFromSnapshot(input.snapshot),
    automaticRevisionCount,
    validationResult: finalValidation.result,
    decisionEngine: {
      truthLedger: runtime.truthLedger,
      baseAd: runtime.baseAd,
      initialMaster: runtime.initialMaster,
      sanitizedInitialMaster: runtime.sanitizedInitialMaster,
      initialDecisionReport: runtime.initialDecisionReport,
      repairRequest: runtime.repairRequest,
      repairResult: runtime.repairResult,
      sanitizedRepairResult: runtime.sanitizedRepairResult,
      finalMaster,
      finalDecisionReport: runtime.finalDecisionReport,
      finalDecision: runtime.status,
      unknowns: runtime.unknowns,
      providerCallCount: runtime.providerCallCount,
      createdAt: new Date().toISOString(),
    },
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

function decisionEngineWriter(input: {
  orchestrator: Annunci10xAiOrchestrator;
  sessionId: string;
  sessionSecret: string;
  snapshot: PersistedSnapshot;
  authIdentity: string;
  provider: Annunci10xConfiguredProvider;
  operations: PublicAnnunci10xOperation[];
}): Annunci10xDecisionEngineWriter {
  let currentMaster: GeneratedAd | null = null;
  return {
    async generate(writerInput) {
      const generatedResult = await input.orchestrator.runTask({
        sessionId: input.sessionId,
        sessionSecret: input.sessionSecret,
        operationType: 'GENERATE',
        input: {
          roleCard: writerInput.roleCard,
          truthLedger: writerInput.truthLedger,
          baseAd: writerInput.baseAd,
          factualConstraints: writerInput.factualConstraints,
        },
        inputSnapshotId: input.snapshot.id,
        idempotencyInputIdentityOverride: stableHash({
          snapshotId: input.snapshot.id,
          authIdentity: input.authIdentity,
          operation: 'DECISION_ENGINE_GENERATE',
          truthLedger: writerInput.truthLedger.facts,
          baseAd: writerInput.baseAd.sections,
        }),
        promptVersionOverride: DECISION_ENGINE_WRITER_PROMPT_VERSION,
        systemPromptOverride: DECISION_ENGINE_WRITER_PROMPT,
      });
      input.operations.push(toPublicOperation(generatedResult, 'GENERATE', input.provider));
      const generated = generatedResult.output as Annunci10xGenerateOutput;
      currentMaster = prepareMasterForValidation(generated.generatedAd, input.snapshot.roleCard);
      return { master: currentMaster };
    },
    async repair(repairInput) {
      if (!currentMaster) throw new Annunci10xPublicError('GENERATION_BLOCKED', 'Repair richiesto senza Master iniziale.', 409);
      const revisionResult = await input.orchestrator.runTask({
        sessionId: input.sessionId,
        sessionSecret: input.sessionSecret,
        operationType: 'REVISE',
        input: {
          currentMaster,
          roleCard: repairInput.roleCard,
          truthLedger: repairInput.truthLedger,
          baseAd: repairInput.baseAd,
          factualConstraints: repairInput.factualConstraints,
          repairRequest: repairInput.repairRequest,
        },
        inputSnapshotId: input.snapshot.id,
        idempotencyInputIdentityOverride: stableHash({
          snapshotId: input.snapshot.id,
          authIdentity: input.authIdentity,
          operation: 'DECISION_ENGINE_REPAIR',
          master: currentMaster.sections,
          hardFailures: repairInput.repairRequest.hardFailures,
        }),
        promptVersionOverride: DECISION_ENGINE_REPAIR_PROMPT_VERSION,
        systemPromptOverride: DECISION_ENGINE_REPAIR_PROMPT,
      });
      input.operations.push(toPublicOperation(revisionResult, 'REVISE', input.provider));
      const revised = revisionResult.output as Annunci10xReviseOutput;
      currentMaster = prepareMasterForValidation({
        ...currentMaster,
        sections: mergeRevisedSections(currentMaster.sections, revised.revisedSections, revised.changedSectionIds),
        generatedAt: new Date().toISOString(),
      }, input.snapshot.roleCard);
      return { master: currentMaster };
    },
  };
}

function validationFromDecisionReport(report: Annunci10xDecisionReport): Annunci10xValidateOutput {
  const unsupportedClaims = report.hardFailures.filter((failure) => failure.startsWith('Violation:'));
  const omittedCriticalFacts = report.hardFailures.filter((failure) => failure.startsWith('Preservation failed:'));
  const result: Annunci10xValidateOutput['result'] = report.final === 'PASS' ? 'PASS' : report.final === 'BLOCK' ? 'BLOCK' : 'NEEDS_REVISION';
  return {
    claims: [
      ...unsupportedClaims.map((claim, index) => ({
        id: `decision-unsupported-${index + 1}`,
        kind: 'CLAIM' as const,
        claim,
        supported: false,
        sourcePaths: [],
        action: 'REMOVE' as const,
      })),
      ...omittedCriticalFacts.map((claim, index) => ({
        id: `decision-missing-${index + 1}`,
        kind: 'FACT' as const,
        claim,
        supported: false,
        sourcePaths: [],
        action: 'REQUEST_CONFIRMATION' as const,
      })),
    ],
    unsupportedClaims,
    contradictions: [],
    omittedCriticalFacts,
    alteredRequirements: report.violations.requirementPromotion ? ['Requisiti preferenziali trasformati in obbligatori.'] : [],
    result,
  };
}

function gateFromDecisionReport(report: Annunci10xDecisionReport, baseGate: PublicationGate): PublicationGate {
  const validation = validationFromDecisionReport(report);
  return gateFromValidation(validation, baseGate);
}

function claimCheckFromDecisionReport(report: Annunci10xDecisionReport): ClaimCheck[] {
  if (report.final === 'PASS') {
    return [
      { id: randomUUID(), claim: 'Decision Engine: facts critici preservati.', status: 'SUPPORTED', sourceFactIds: [], publishable: true },
      ...report.unknowns.map((unknown) => ({
        id: randomUUID(),
        claim: `Decision Engine UNKNOWN non bloccante: ${unknown}`,
        status: 'NEEDS_CONFIRMATION' as const,
        sourceFactIds: [],
        publishable: false,
      })),
    ];
  }
  return claimCheckFromValidation(validationFromDecisionReport(report));
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
  groundedNarrativePlan: GroundedNarrativePlan;
}): Promise<{ master: GeneratedAd; validation: Annunci10xValidateOutput; automaticRevisionCount: 0 | 1 | 2 | 3 }> {
  let master = input.initialMaster;
  let validation = input.initialValidation;
  let automaticRevisionCount: 0 | 1 | 2 | 3 = 0;
  const automaticRevisionLimit = input.provider === 'OPENAI' ? 3 : 2;

  while (
    validation.result === 'NEEDS_REVISION'
    && automaticRevisionCount < automaticRevisionLimit
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
        groundedNarrativePlan: input.groundedNarrativePlan,
        validationIssues: validation,
      },
      inputSnapshotId: input.snapshot.id,
      idempotencyInputIdentityOverride: stableHash({
        snapshotId: input.snapshot.id,
        authIdentity: input.authIdentity,
        operation: 'REVISE',
        revisionNumber,
        master: master.sections,
        groundedNarrativePlan: input.groundedNarrativePlan,
      }),
    });
    input.operations.push(toPublicOperation(revisionResult, 'REVISE', input.provider));
    const revision = revisionResult.output as Annunci10xReviseOutput;
    const revisionPlan = enforceEditorialDeletionGuard(master.sections, revision, validation, input.snapshot.roleCard);
    master = prepareMasterForValidation({
      ...master,
      sections: mergeRevisedSections(master.sections, revisionPlan.revisedSections, revisionPlan.changedSectionIds),
      generatedAt: new Date().toISOString(),
    }, input.snapshot.roleCard);
    automaticRevisionCount = revisionNumber as 1 | 2 | 3;
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
      groundedNarrativePlan: input.groundedNarrativePlan,
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

export function assessAnnunci10xNarrativeSufficiency(
  roleCard: RoleCard,
  _roleProfile: RoleProfile | null = null,
  _strategy: CommunicationStrategy | null = null,
): Annunci10xNarrativeSufficiencyResult {
  const context = roleCard.attractionContext;
  const title = factValue(roleCard.title) || 'questa posizione';
  const mission = factValue(roleCard.mission);
  const outcomes = factValues(roleCard.outcomes).join(' ');
  const responsibilities = factValues(roleCard.responsibilities).join(' ');
  const operatingContext = factValue(context.operatingContext);
  const autonomy = factValue(context.autonomy);
  const unexpectedEvents = factValue(context.unexpectedEvents);
  const companyDescription = factValue(context.companyDescription);
  const attractiveness = factValues(context.attractivenessEvidence).join(' ');
  const requirements = roleCard.requirements;
  const combinedWork = compactJoin([mission, outcomes, responsibilities, operatingContext, autonomy, unexpectedEvents]);
  const required = requirements.filter((requirement) => requirement.classification === 'REQUIRED' && factValue(requirement.label));
  const preferred = requirements.filter((requirement) => requirement.classification === 'PREFERRED' && factValue(requirement.label));
  const trainable = requirements.filter((requirement) => requirement.classification === 'TRAINABLE' && factValue(requirement.label));
  const disqualifying = requirements.filter((requirement) => requirement.classification === 'DISQUALIFYING' && factValue(requirement.label));

  const sufficientSignals: string[] = [];
  const gaps: string[] = [];
  const questions: Annunci10xNarrativeSufficiencyQuestion[] = [];
  const hardBlockers: string[] = [];
  const hardQuestions: Annunci10xNarrativeSufficiencyQuestion[] = [];
  const addSignal = (signal: string): void => { sufficientSignals.push(signal); };
  const addGap = (gap: string): void => { gaps.push(gap); };
  const addQuestion = (question: Annunci10xNarrativeSufficiencyQuestion): void => {
    if (questions.length >= 4) return;
    if (questions.some((item) => item.fieldKey === question.fieldKey)) return;
    questions.push(question);
  };
  const addHardBlocker = (gap: string, question: Annunci10xNarrativeSufficiencyQuestion): void => {
    hardBlockers.push(gap);
    if (!hardQuestions.some((item) => item.fieldKey === question.fieldKey)) hardQuestions.push(question);
  };

  if (hasConcreteWork(roleCard)) addSignal('Il ruolo contiene attività concrete e un risultato operativo comprensibile.');
  else {
    const gap = 'Le attività o il risultato atteso sono troppo generici per raccontare cosa fa davvero la persona.';
    const question = {
      id: 'narrative.concrete_work',
      stepId: 'WORK_REALITY',
      fieldKey: 'responsibilities',
      question: `Quali sono le 3-5 attività più concrete che ${title} svolge in una settimana normale?`,
      reason: 'Serve trasformare il ruolo da etichetta o elenco generico a lavoro osservabile.',
      priority: 'HIGH',
    } satisfies Annunci10xNarrativeSufficiencyQuestion;
    addGap(gap);
    addQuestion(question);
    addHardBlocker(gap, question);
  }

  if (hasConnectedWorkFlow(responsibilities, operatingContext, autonomy, unexpectedEvents)) addSignal('Le attività principali sono collegate da contesto, autonomia o gestione degli imprevisti.');
  else {
    addGap('Le attività sono presenti, ma il ledger non spiega abbastanza come si collegano tra loro.');
    addQuestion({
      id: 'narrative.activity_connections',
      stepId: 'WORK_REALITY',
      fieldKey: 'activityConnections',
      question: `Come si collegano tra loro le attività principali di ${title}: da dove parte il lavoro e cosa deve risultare fatto bene alla fine?`,
      reason: 'Il Writer può sviluppare una narrazione solo se conosce il filo operativo tra le attività.',
      priority: 'HIGH',
    });
  }

  if (hasNarrativeInteractions(operatingContext, autonomy, responsibilities)) addSignal('Gli interlocutori sono descritti con un minimo di dinamica operativa.');
  else {
    addGap('Il ledger nomina o sottintende interlocutori, ma non spiega come avviene l’interazione nel lavoro reale.');
    addQuestion({
      id: 'narrative.interactions',
      stepId: 'WORK_REALITY',
      fieldKey: 'operatingContext',
      question: interactionQuestion(title, combinedWork),
      reason: 'Senza questa informazione il testo tende a inventare passaggi, processi o responsabilità plausibili.',
      priority: 'HIGH',
    });
  }

  if (hasProblemHandlingDetail(unexpectedEvents, autonomy)) addSignal('Gli imprevisti sono collegati ad azioni concrete o modalità di gestione.');
  else {
    addGap('Gli imprevisti non spiegano abbastanza che cosa deve fare concretamente la persona quando qualcosa non torna.');
    addQuestion({
      id: 'narrative.problem_handling',
      stepId: 'WORK_REALITY',
      fieldKey: 'unexpectedEvents',
      question: `Quando emerge un problema operativo o qualcosa non torna nel lavoro di ${title}, cosa deve fare concretamente questa persona?`,
      reason: 'Serve evitare che il Writer completi gli imprevisti con procedure o conseguenze non dichiarate.',
      priority: 'HIGH',
    });
  }

  if (hasAttentionDetail(combinedWork, requirements)) addSignal('Le responsabilità che richiedono attenzione sono ancorate a fatti concreti.');
  else {
    addGap('Il ledger indica qualità desiderate, ma non chiarisce abbastanza dove l’attenzione fa davvero la differenza.');
    addQuestion({
      id: 'narrative.attention',
      stepId: 'WORK_REALITY',
      fieldKey: 'attentionResponsibilities',
      question: `Quali aspetti del lavoro di ${title} richiedono più attenzione e perché?`,
      reason: 'Una spiegazione candidate-facing può parlare di precisione o affidabilità solo se sa a cosa si applicano.',
      priority: 'MEDIUM',
    });
  }

  if (required.length > 0 && (preferred.length > 0 || trainable.length > 0 || disqualifying.length > 0 || requirements.length === required.length)) {
    addSignal('La distinzione dei requisiti è sufficiente per non irrigidire preferenze o apprendibili.');
  } else {
    const gap = 'La distinzione tra indispensabile, preferenziale e apprendibile non è abbastanza chiara.';
    const question = {
      id: 'narrative.requirements',
      stepId: 'REQUIREMENTS',
      fieldKey: 'requirements',
      question: `Tra i requisiti di ${title}, cosa è davvero indispensabile dal primo giorno e cosa invece può essere imparato o resta solo preferenziale?`,
      reason: 'Serve preservare la severità corretta dei requisiti nel testo candidato.',
      priority: 'HIGH',
    } satisfies Annunci10xNarrativeSufficiencyQuestion;
    addGap(gap);
    addQuestion(question);
    if (requirements.length === 0) addHardBlocker(gap, question);
  }

  if (hasImportantConditions(roleCard)) addSignal('Le condizioni principali sono sufficientemente dichiarate o dichiarate come non disponibili.');
  else {
    addGap('Mancano condizioni importanti per orientare il candidato.');
    addQuestion({
      id: 'narrative.conditions',
      stepId: 'OFFER',
      fieldKey: 'conditions',
      question: `Quali condizioni concrete deve conoscere subito chi valuta ${title}: sede, modalità, orario, contratto e retribuzione?`,
      reason: 'Le condizioni candidate-facing non vanno completate per inferenza.',
      priority: 'HIGH',
    });
  }

  if (hasNarrativeSubstance({ companyDescription, operatingContext, autonomy, unexpectedEvents, attractiveness })) {
    addSignal('Ci sono elementi reali sufficienti per raccontare il ruolo senza ridurlo a lista.');
  } else {
    addGap('Ci sono pochi elementi distintivi o narrativi reali: un testo lungo rischia ripetizione o overreach.');
    addQuestion({
      id: 'narrative.attraction',
      stepId: 'ATTRACTION',
      fieldKey: 'attractivenessEvidence',
      question: `Se dovessi convincere un buon candidato a scegliere ${title} rispetto a una posizione simile, quale elemento reale gli racconteresti?`,
      reason: 'Serve una leva reale, non inventata, per rendere il testo più umano e persuasivo.',
      priority: 'MEDIUM',
    });
  }

  if (!hasMinimumGenerationConditions(roleCard)) {
    const gap = 'Mancano condizioni minime sufficienti per orientare il candidato senza completamenti sostanziali.';
    const question = {
      id: 'narrative.minimum_conditions',
      stepId: 'OFFER',
      fieldKey: 'minimumConditions',
      question: `Quali condizioni minime sono certe per ${title}: sede, modalità, contratto, orario o retribuzione?`,
      reason: 'Senza almeno alcune condizioni concrete l’annuncio rischia di completare l’offerta per inferenza.',
      priority: 'HIGH',
    } satisfies Annunci10xNarrativeSufficiencyQuestion;
    addGap(gap);
    addQuestion(question);
    addHardBlocker(gap, question);
  }

  const status = hardBlockers.length > 0 ? 'INSUFFICIENT' : 'SUFFICIENT';
  return {
    status,
    summary: status === 'SUFFICIENT'
      ? 'Il Truth Ledger contiene abbastanza fatti reali per generare un annuncio utile e fedele; eventuali gap residui sono enrichment non bloccanti.'
      : 'Il Truth Ledger non contiene ancora abbastanza fatti reali per generare un annuncio utile e fedele senza completamenti sostanziali.',
    sufficientSignals,
    gaps: status === 'SUFFICIENT' ? gaps : hardBlockers,
    questions: status === 'SUFFICIENT' ? questions.slice(0, 4) : hardQuestions.slice(0, 4),
  };
}

function assertNarrativeSufficiencyForGeneration(roleCard: RoleCard, roleProfile: RoleProfile | null, strategy: CommunicationStrategy | null): void {
  const sufficiency = assessAnnunci10xNarrativeSufficiency(roleCard, roleProfile, strategy);
  if (sufficiency.status === 'SUFFICIENT') return;
  const questions = sufficiency.questions.map((question, index) => `${index + 1}. ${question.question}`).join(' ');
  throw new Annunci10xPublicError(
    'GENERATION_BLOCKED',
    `Servono alcuni chiarimenti sulla realta del ruolo prima di generare un Annuncio 10x approfondito. ${questions}`,
    409,
  );
}

function hasConcreteWork(roleCard: RoleCard): boolean {
  const responsibilities = factValues(roleCard.responsibilities).join(' ');
  const mission = factValue(roleCard.mission);
  const outcomes = factValues(roleCard.outcomes).join(' ');
  const workText = compactJoin([responsibilities, mission, outcomes]);
  return wordCount(workText) >= 18 && hasConcreteVerb(workText) && (Boolean(mission) || factValues(roleCard.outcomes).length > 0);
}

function hasConnectedWorkFlow(responsibilities: string, operatingContext: string, autonomy: string, unexpectedEvents: string): boolean {
  const workText = compactJoin([responsibilities, operatingContext, autonomy, unexpectedEvents]);
  if (wordCount(workText) < 35) return false;
  if (!hasConcreteVerb(workText)) return false;
  const connectorCount = countMatches(workText, /\b(per|quando|mentre|cosi|così|finché|affinche|affinché|contribuendo|in modo da|prima|dopo|durante|alla fine|risultato|obiettivo|collaborando|confrontandosi)\b/gi);
  const listPressure = countMatches(responsibilities, /[;]/g);
  return connectorCount >= 3 || (connectorCount >= 2 && listPressure <= 3);
}

function hasNarrativeInteractions(operatingContext: string, autonomy: string, responsibilities: string): boolean {
  const contextText = compactJoin([operatingContext, autonomy, responsibilities]);
  if (!hasInteractionNoun(contextText)) return true;
  const interactionDetail = countMatches(contextText, /\b(collabora(?:re|ndo)?|confronta(?:rsi|ndosi)?|coordina(?:rsi|ndosi)?|comunica(?:re|ndo)?|segnala(?:re|ndo)?|chiarisce|allinea(?:re|ndo)?|riceve|trasmette|verifica con|decide con|lavora con)\b/gi);
  const explanatory = countMatches(contextText, /\b(quando|per|su|con|tra|insieme|quando serve|se serve|in quali|nei momenti)\b/gi);
  return interactionDetail >= 2 && explanatory >= 3;
}

function hasProblemHandlingDetail(unexpectedEvents: string, autonomy: string): boolean {
  const problemText = compactJoin([unexpectedEvents, autonomy]);
  if (!unexpectedEvents || wordCount(unexpectedEvents) < 8) return false;
  const problemTerms = countMatches(unexpectedEvents, /\b(problemi?|imprevist[ioe]|errori?|differenze?|bug|feedback|anomali[ae]|urgenz[ae]|dubbi|chiarire|blocchi?|incidenti?)\b/gi);
  const actionTerms = countMatches(problemText, /\b(analizza(?:re|ndo)?|verifica(?:re|ndo)?|chiarisce|risolve(?:re|ndo)?|corregge|segnala(?:re|ndo)?|documenta(?:re|ndo)?|registra(?:re|ndo)?|aggiorna(?:re|ndo)?|blocca(?:re|ndo)?|isola(?:re|ndo)?|avvisa(?:re|ndo)?|concorda(?:re|ndo)?|controlla(?:re|ndo)?|comunica(?:re|ndo)?|confronta(?:rsi|ndosi)?)\b/gi);
  return problemTerms >= 1 && actionTerms >= 2;
}

function hasAttentionDetail(combinedWork: string, requirements: RoleCard['requirements']): boolean {
  const attentionRequired = requirements.some((requirement) => /attenzione|precisione|affidabilit|puntualit|qualit|ordine|accuratezza/i.test(factValue(requirement.label)));
  if (!attentionRequired) return true;
  const attentionAnchors = countMatches(combinedWork, /\b(quantit|ordine|correttezza|controll|verifica|debugging|qualit|codice|errori?|preparazione|manutenzione|cliente|fattur|document)\b/gi);
  const whyTerms = countMatches(combinedWork, /\b(per|affinche|affinché|cosi|così|risultato|contribuendo|mantenere|garantire|evitare|allineat[eo])\b/gi);
  return attentionAnchors >= 3 && whyTerms >= 2;
}

function hasImportantConditions(roleCard: RoleCard): boolean {
  const context = roleCard.attractionContext;
  const conditionValues = [
    factValue(context.location),
    factValue(context.workMode),
    factValue(context.contractType),
    factValue(context.schedule),
    factValue(context.shifts),
    factValue(context.onCall),
    compensationMessage(roleCard),
  ].filter(Boolean);
  return conditionValues.length >= 4;
}

function hasMinimumGenerationConditions(roleCard: RoleCard): boolean {
  const context = roleCard.attractionContext;
  const conditionValues = [
    factValue(context.location),
    factValue(context.workMode),
    factValue(context.contractType),
    factValue(context.schedule),
    factValue(context.shifts),
    factValue(context.onCall),
    compensationMessage(roleCard),
  ].filter((value) => Boolean(value) && !isUnknownFactText(value));
  return conditionValues.length >= 2;
}

function isUnknownFactText(value: string): boolean {
  return /\b(?:non dichiarat[aoie]?|non specificat[aoie]?|non indicat[aoie]?|non disponibil[ei]|da definire)\b/i.test(value.trim());
}

function hasNarrativeSubstance(values: { companyDescription: string; operatingContext: string; autonomy: string; unexpectedEvents: string; attractiveness: string }): boolean {
  const narrativeText = compactJoin([values.companyDescription, values.operatingContext, values.autonomy, values.unexpectedEvents, values.attractiveness]);
  const distinctAreas = [values.companyDescription, values.operatingContext, values.autonomy, values.unexpectedEvents, values.attractiveness].filter((value) => wordCount(value) >= 6).length;
  const explanatoryTerms = countMatches(narrativeText, /\b(per|quando|con|insieme|collabor|confront|segnal|chiar|perche|perché|in modo da|contribuendo)\b/gi);
  return distinctAreas >= 3 && explanatoryTerms >= 4;
}

function interactionQuestion(title: string, text: string): string {
  const interlocutors = namedInterlocutors(text);
  if (interlocutors.length >= 2) {
    return `Come interagisce normalmente ${title} con ${joinItalianList(interlocutors.slice(0, 3))}: che informazioni scambia e in quali momenti?`;
  }
  if (interlocutors.length === 1) {
    return `Come interagisce normalmente ${title} con ${interlocutors[0]}: che informazioni scambia e in quali momenti?`;
  }
  return `Con chi interagisce davvero ${title} durante il lavoro e per quali passaggi concreti?`;
}

function namedInterlocutors(text: string): string[] {
  const candidates = [
    'autisti',
    'ufficio ordini',
    'responsabile prodotto',
    'responsabile logistico',
    'sviluppatori',
    'team',
    'fornitori',
    'clienti',
    'reparti interni',
    'amministrazione',
    'acquisti',
    'colleghi',
  ];
  const normalized = text.toLowerCase();
  return candidates.filter((candidate) => normalized.includes(candidate));
}

function joinItalianList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} e ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`;
}

function hasConcreteVerb(text: string): boolean {
  return /\b(gestire|gestisce|sviluppare|sviluppa|mantenere|mantiene|preparare|prepara|ricevere|riceve|controllare|controlla|verificare|verifica|collaborare|collabora|analizzare|analizza|risolvere|risolve|aggiornare|aggiorna|coordinare|coordina|registrare|registra|caricare|carica|scaricare|scarica|supportare|supporta|elaborare|elabora|organizzare|organizza|contattare|presentare|seguire|rispondere|comprendere|fornire|segnalare|distribuire|comunicare|intervenire|sostituire|manutenzione|diagnosi|ricerca|interventi|sostituzione)\b/i.test(text);
}

function isListLikeWork(text: string): boolean {
  const separators = countMatches(text, /[;,]/g);
  const connectors = countMatches(text, /\b(per|quando|mentre|cosi|così|in modo da|contribuendo|alla fine|risultato|obiettivo)\b/gi);
  return separators >= 6 && wordCount(text) >= 14 && connectors <= 2;
}

function hasInteractionNoun(text: string): boolean {
  return /\b(team|collegh|responsabile|clienti|fornitori|autisti|ufficio|repart|amministrazione|acquisti|sviluppatori|prodotto|stakeholder|commerciale|candidati)\b/i.test(text);
}

function wordCount(text: string): number {
  return (text.match(/\b[\p{L}\p{N}][\p{L}\p{N}'’.-]*\b/gu) ?? []).length;
}

function countMatches(text: string, pattern: RegExp): number {
  return (text.match(pattern) ?? []).length;
}

function buildGroundedNarrativePlan(roleCard: RoleCard, roleProfile: RoleProfile | null, strategy: CommunicationStrategy | null): GroundedNarrativePlan {
  const context = roleCard.attractionContext;
  const required = roleCard.requirements.filter((requirement) => requirement.classification === 'REQUIRED');
  const preferred = roleCard.requirements.filter((requirement) => requirement.classification === 'PREFERRED');
  const disqualifying = roleCard.requirements.filter((requirement) => requirement.classification === 'DISQUALIFYING');
  const trainable = roleCard.requirements.filter((requirement) => requirement.classification === 'TRAINABLE');
  const facts = buildEvidencePlanFacts(roleCard, strategy);
  const refs = (...paths: string[]): string[] => evidenceRefsForPaths(facts, paths);
  const blocks: GroundedNarrativeBlock[] = [];
  const addBlock = (block: GroundedNarrativeBlock): void => {
    if (block.supportingFactIds.length > 0 || block.targetSection === 'APPLICATION') blocks.push(block);
  };

  addBlock({
    id: 'plan-title',
    targetSection: 'TITLE',
    paragraphGoal: 'Presentare il ruolo con il titolo confermato senza duplicarlo nel body.',
    supportingFactIds: refs('roleCard.title'),
    candidateMessage: compactJoin([factValue(roleCard.title)]),
    allowedInterpretations: ['Usa un titolo chiaro e cercabile; aggiungi sede o specializzazione solo se sono facts confermati e utili.'],
    disallowedAdditions: defaultDisallowedAdditions(),
  });

  addBlock({
    id: 'plan-opening',
    targetSection: 'OPENING',
    paragraphGoal: 'Aprire il testo facendo capire ruolo, contesto confermato e risultato atteso, senza trasformare il contesto in employer branding inventato.',
    supportingFactIds: [
      ...refs(
        'roleCard.title',
        'roleCard.mission',
        'roleCard.outcomes',
        'roleCard.attractionContext.companyDescription',
        'roleCard.attractionContext.location',
        'roleCard.attractionContext.workMode',
      ),
    ],
    candidateMessage: compactJoin([
      factValue(roleCard.mission),
      factValue(context.companyDescription),
      factValue(context.location),
      strategy?.candidateAngle,
    ]),
    allowedInterpretations: [
      'Puoi spiegare perché il risultato del ruolo conta per il lavoro, usando solo missione, outcome e contesto confermati.',
      'Puoi collegare sede, modalità e contesto aziendale quando questi facts aiutano il candidato a orientarsi.',
    ],
    disallowedAdditions: [
      ...defaultDisallowedAdditions(),
      'Non aggiungere crescita aziendale, cultura, prestigio, clienti, mercati o posizionamento se non presenti nei facts.',
    ],
  });

  addBlock({
    id: 'plan-work-reality',
    targetSection: 'RESPONSIBILITIES',
    paragraphGoal: 'Sviluppare il lavoro reale in modo discorsivo: attività, strumenti, interlocutori, autonomia, variabilità e risultato operativo confermati.',
    supportingFactIds: [
      ...refs(
        'roleCard.responsibilities',
        'roleCard.mission',
        'roleCard.outcomes',
        'roleCard.attractionContext.operatingContext',
        'roleCard.attractionContext.autonomy',
        'roleCard.attractionContext.unexpectedEvents',
        'roleCard.attractionContext.teamContext',
        'roleCard.attractionContext.attractivenessEvidence',
      ),
    ],
    candidateMessage: compactJoin([
      factValues(roleCard.responsibilities).join('; '),
      factValue(context.operatingContext),
      factValue(context.autonomy),
      factValue(context.unexpectedEvents),
    ]),
    allowedInterpretations: [
      'Puoi spiegare relazioni operative direttamente supportate: cosa si controlla, cosa si prepara, chi collabora, quando serve segnalare un problema o coordinarsi.',
      'Puoi sviluppare il significato di debugging, REST API, code review, controllo quantita, preparazione ordini o collaborazione restando al livello esatto del fact.',
      'Puoi rendere comprensibile il perche di precisione, coordinamento, autonomia o attenzione quando questi derivano dai facts presenti nello stesso blocco.',
    ],
    disallowedAdditions: [
      ...defaultDisallowedAdditions(),
      'Non aggiungere nuovi processi, fasi operative, strumenti, documenti, responsabilita, conseguenze operative, ownership tecniche o interlocutori non elencati nei facts del blocco.',
      'Non trasformare una parola tecnica in ecosistema: un fact su REST API resta REST API; un fact su debugging resta analisi e risoluzione di problemi tecnici.',
      'Non aggiungere chiarimento requisiti, progettazione soluzioni, verifica integrazioni, architettura, regressioni, QA/test, release/deploy, servizi esterni, endpoint o query se non presenti nei facts.',
      'Non trasformare un fact logistico in procedure, documenti, imballaggio, sicurezza o tempi garantiti se quei facts non sono presenti.',
      'Non aggiungere controlli sullo stato dei prodotti, consegne, picchi/urgenze operative o procedure specifiche se non presenti nei facts.',
    ],
  });

  addBlock({
    id: 'plan-candidate-fit',
    targetSection: 'REQUIREMENTS',
    paragraphGoal: 'Chiarire cosa serve davvero e cosa e preferenziale, mantenendo la severita originale dei requisiti.',
    supportingFactIds: [
      ...refs(
        'roleCard.requirements.REQUIRED',
        'roleCard.requirements.PREFERRED',
        'roleCard.requirements.DISQUALIFYING',
      ),
    ],
    candidateMessage: compactJoin([
      required.map((item) => factValue(item.label)).filter(Boolean).join('; '),
      preferred.map((item) => factValue(item.label)).filter(Boolean).join('; '),
      disqualifying.map((item) => factValue(item.label)).filter(Boolean).join('; '),
    ]),
    allowedInterpretations: [
      'Puoi spiegare perche un requisito e utile nel lavoro solo se il collegamento e sostenuto da responsabilita, strumenti o contesto operativo confermati.',
      'Puoi distinguere richiesto, preferenziale ed escludente senza aumentare o ridurre la severita del requisito.',
    ],
    disallowedAdditions: [
      ...defaultDisallowedAdditions(),
      'Non pubblicare fatti TRAINABLE come preferenze, non-barriere o promesse di formazione salvo diverso fact pubblico esplicito.',
      trainable.length ? `Facts TRAINABLE da non trasformare in requisiti pubblici: ${trainable.map((item) => factValue(item.label)).filter(Boolean).join('; ')}.` : '',
    ].filter(Boolean),
  });

  addBlock({
    id: 'plan-conditions',
    targetSection: 'CONDITIONS',
    paragraphGoal: 'Rendere facili da trovare sede, modalita, contratto, orario, turni, reperibilita e retribuzione confermati.',
    supportingFactIds: [
      ...refs(
        'roleCard.attractionContext.location',
        'roleCard.attractionContext.workMode',
        'roleCard.attractionContext.workModeDetail',
        'roleCard.attractionContext.contractType',
        'roleCard.attractionContext.schedule',
        'roleCard.attractionContext.shifts',
        'roleCard.attractionContext.onCall',
        'roleCard.compensation',
      ),
    ],
    candidateMessage: compactJoin([
      factValue(context.location),
      factValue(context.workMode),
      factValue(context.workModeDetail),
      factValue(context.contractType),
      factValue(context.schedule),
      factValue(context.shifts),
      factValue(context.onCall),
      compensationMessage(roleCard),
    ]),
    allowedInterpretations: [
      'Puoi raggruppare le condizioni in una sezione leggibile, preservando il significato esatto e citando anche valori negativi confermati come turni non previsti o reperibilita non prevista.',
      'Se la retribuzione e aperta o dipende dall esperienza, puoi dirlo senza inventare importi, livelli o CCNL specifici non forniti.',
    ],
    disallowedAdditions: [
      ...defaultDisallowedAdditions(),
      'Non inventare RAL, livelli, CCNL specifici, minimo tabellare, benefit, flessibilita, trasferte, turni o reperibilita.',
    ],
  });

  addBlock({
    id: 'plan-offer',
    targetSection: 'OFFER',
    paragraphGoal: 'Presentare solo supporti, benefit, formazione, crescita o elementi di attrattivita confermati.',
    supportingFactIds: [
      ...refs(
        'roleCard.attractionContext.growth',
        'roleCard.attractionContext.attractivenessEvidence',
      ),
    ],
    candidateMessage: compactJoin([
      factValue(context.growth),
      factValues(context.attractivenessEvidence).join('; '),
    ]),
    allowedInterpretations: [
      'Puoi spiegare il valore pratico di un benefit o supporto confermato, senza trasformarlo in promessa piu ampia.',
      'Una formazione o affiancamento con durata confermata resta limitata a quella durata.',
    ],
    disallowedAdditions: [
      ...defaultDisallowedAdditions(),
      'Non aggiungere benefit, crescita, cultura, team giovane, stabilita, formazione continuativa o carriera se non confermati.',
    ],
  });

  addBlock({
    id: 'plan-application',
    targetSection: 'APPLICATION',
    paragraphGoal: 'Chiudere con una candidatura naturale e priva di passaggi inventati.',
    supportingFactIds: refs('roleCard.applicationInstructions'),
    candidateMessage: factValue(roleCard.applicationInstructions) || 'CTA neutra se non esiste una destinazione concreta.',
    allowedInterpretations: [
      'Se esiste una destinazione o istruzione concreta, usala esattamente nel significato.',
      'Se non esiste una destinazione concreta, usa solo una CTA neutra come invito a candidarsi.',
    ],
    disallowedAdditions: [
      ...defaultDisallowedAdditions(),
      'Non aggiungere CV, LinkedIn, lettera, colloqui, ricontatto, tempi di risposta, step di selezione o canale specifico se non confermati.',
    ],
  });

  return {
    version: 'annunci10x.evidence-plan.v1',
    purpose: 'Positive grounding and claim-evidence map for broad candidate-facing prose: the writer may develop only the meaning of KNOWN_FACT and MUST_MENTION_FACT items through the narrative blocks below.',
    facts,
    globalBoundary: [
      'Only KNOWN_FACT and MUST_MENTION_FACT entries are evidence. DO_NOT_INVENT entries are absent or unknown information that must not be completed by inference.',
      'omittedCriticalFact can refer only to a MUST_MENTION_FACT that exists in this facts array and is absent from the candidate-facing Master. UNKNOWN or missing information is not an omitted fact.',
      'Develop meaning, not the surrounding world: a sentence is acceptable only when it is a confirmed fact, a faithful paraphrase, or an allowed interpretation in a block supported by the listed facts.',
      'Do not create new entities, processes, tools, responsibilities, conditions, candidate-process steps, operational consequences, cadence, chronology, or causal claims outside the plan.',
      `Strategy angle: ${strategy?.candidateAngle ?? 'not available'}. Use it only when supported by listed facts.`,
      `Role profile emphasis: ${roleProfile ? JSON.stringify({
        challenge: roleProfile.challengeLevel?.value ?? null,
        routine: roleProfile.routineLevel?.value ?? null,
        qualification: roleProfile.qualificationLevel?.value ?? null,
        commitment: roleProfile.commitmentLevel?.value ?? null,
        technicality: roleProfile.technicality?.value ?? null,
      }) : 'not available'}. This is tonal guidance, not a source of new public facts.`,
    ],
    blocks,
  };
}

function defaultDisallowedAdditions(): string[] {
  return [
    'Niente nuovi processi, strumenti, persone, documenti, metriche, responsabilita, condizioni, benefit, promesse o passaggi di selezione non presenti nei facts di supporto.',
    'Niente cronologia, frequenza, giornata tipo o causalita operativa se non confermate.',
    'Niente linguaggio interno, audit, source metadata, campi tecnici, placeholder o informazioni mancanti candidate-facing.',
  ];
}

function buildEvidencePlanFacts(roleCard: RoleCard, strategy: CommunicationStrategy | null): EvidencePlanFact[] {
  const facts: Omit<EvidencePlanFact, 'id'>[] = [];
  const critical = collectCriticalCandidateFacts(roleCard);
  const criticalKeys = new Set(critical.map((fact) => semanticCandidateTokens(fact.expected).join('|')));
  const addKnown = (path: string, fact: Fact<unknown> | string | null | undefined, fallbackStatus: EvidencePlanFact['status'] = 'KNOWN_FACT'): void => {
    const value = factValue(fact);
    if (!value || isUnknownCandidateValue(value) || isNonCandidateFacingFact(value)) return;
    const key = semanticCandidateTokens(value).join('|');
    facts.push({
      path,
      value,
      status: criticalKeys.has(key) ? 'MUST_MENTION_FACT' : fallbackStatus,
      sourceFactIds: sourceFactIds(fact),
    });
  };
  const addKnownArray = (path: string, items: readonly Fact<unknown>[]): void => {
    items.forEach((fact, index) => addKnown(`${path}[${index}]`, fact));
  };

  addKnown('roleCard.title', roleCard.title);
  addKnown('roleCard.mission', roleCard.mission);
  addKnownArray('roleCard.outcomes', roleCard.outcomes);
  addKnownArray('roleCard.responsibilities', roleCard.responsibilities);
  for (const requirement of roleCard.requirements) {
    if (requirement.classification === 'TRAINABLE') {
      addKnown(`roleCard.requirements.TRAINABLE.${requirement.id}`, requirement.label, 'DO_NOT_INVENT');
      continue;
    }
    addKnown(`roleCard.requirements.${requirement.classification}.${requirement.id}`, requirement.label);
  }
  addKnown('roleCard.attractionContext.companyName', roleCard.attractionContext.companyName);
  addKnown('roleCard.attractionContext.companyDescription', roleCard.attractionContext.companyDescription);
  addKnown('roleCard.attractionContext.workMode', roleCard.attractionContext.workMode);
  addKnown('roleCard.attractionContext.workModeDetail', roleCard.attractionContext.workModeDetail);
  addKnown('roleCard.attractionContext.location', roleCard.attractionContext.location);
  addKnown('roleCard.attractionContext.contractType', roleCard.attractionContext.contractType);
  addKnown('roleCard.attractionContext.schedule', roleCard.attractionContext.schedule);
  addKnown('roleCard.attractionContext.shifts', roleCard.attractionContext.shifts);
  addKnown('roleCard.attractionContext.onCall', roleCard.attractionContext.onCall);
  addKnown('roleCard.attractionContext.operatingContext', roleCard.attractionContext.operatingContext);
  addKnown('roleCard.attractionContext.autonomy', roleCard.attractionContext.autonomy);
  addKnown('roleCard.attractionContext.unexpectedEvents', roleCard.attractionContext.unexpectedEvents);
  addKnown('roleCard.attractionContext.growth', roleCard.attractionContext.growth);
  addKnown('roleCard.attractionContext.teamContext', roleCard.attractionContext.teamContext);
  addKnownArray('roleCard.attractionContext.attractivenessEvidence', roleCard.attractionContext.attractivenessEvidence);
  if (roleCard.compensation) {
    addKnown('roleCard.compensation.amountText', roleCard.compensation.amountText);
    addKnown('roleCard.compensation.minAmount', roleCard.compensation.minAmount);
    addKnown('roleCard.compensation.maxAmount', roleCard.compensation.maxAmount);
    addKnown('roleCard.compensation.currency', roleCard.compensation.currency);
    addKnown('roleCard.compensation.cadence', roleCard.compensation.cadence);
    addKnown('roleCard.compensation.visibility', roleCard.compensation.visibility);
  }
  addKnown('roleCard.applicationInstructions', roleCard.applicationInstructions);

  for (const missing of strategy?.missingFacts ?? []) {
    facts.push({
      path: `communicationStrategy.missingFacts.${missing.id}`,
      value: `${missing.fieldKey}: ${missing.question}`,
      status: 'DO_NOT_INVENT',
      sourceFactIds: [missing.id],
    });
  }

  const seen = new Set<string>();
  return facts
    .filter((fact) => {
      const key = `${fact.status}:${fact.path}:${semanticCandidateTokens(fact.value).join('|')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((fact, index) => ({ id: `F${String(index + 1).padStart(2, '0')}`, ...fact }));
}

function evidenceRefsForPaths(facts: readonly EvidencePlanFact[], paths: readonly string[]): string[] {
  return facts
    .filter((fact) => fact.status !== 'DO_NOT_INVENT' && paths.some((path) => fact.path === path || fact.path.startsWith(`${path}[`) || fact.path.startsWith(`${path}.`)))
    .map((fact) => fact.id);
}

function sourceFactIds(fact: Fact<unknown> | string | null | undefined): string[] {
  if (typeof fact !== 'object' || fact === null || !('sourceId' in fact)) return [];
  return fact.sourceId ? [fact.sourceId] : [];
}

function factValue(fact: Fact<unknown> | string | null | undefined): string {
  if (!fact) return '';
  const value = typeof fact === 'string' ? fact : fact.value;
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function factValues(facts: readonly Fact<unknown>[]): string[] {
  return facts.map((fact) => factValue(fact)).filter(Boolean);
}

function factRefs(path: string, fact: Fact<unknown> | string | null | undefined): string[] {
  const value = factValue(fact);
  if (!value) return [];
  const sourceId = typeof fact === 'object' && fact !== null && 'sourceId' in fact ? fact.sourceId : undefined;
  return [sourceId ? `${path}#${sourceId}` : `${path}: ${value}`];
}

function factArrayRefs(path: string, facts: readonly Fact<unknown>[]): string[] {
  return facts.flatMap((fact, index) => factRefs(`${path}[${index}]`, fact));
}

function requirementRefs(path: string, requirements: RoleCard['requirements']): string[] {
  return requirements.flatMap((requirement) => factRefs(`${path}.${requirement.id}.${requirement.classification}`, requirement.label));
}

function compensationRefs(roleCard: RoleCard): string[] {
  const compensation = roleCard.compensation;
  if (!compensation) return [];
  return [
    ...factRefs('roleCard.compensation.amountText', compensation.amountText),
    ...factRefs('roleCard.compensation.minAmount', compensation.minAmount),
    ...factRefs('roleCard.compensation.maxAmount', compensation.maxAmount),
    ...factRefs('roleCard.compensation.currency', compensation.currency),
    ...factRefs('roleCard.compensation.cadence', compensation.cadence),
    ...factRefs('roleCard.compensation.visibility', compensation.visibility),
  ];
}

function compensationMessage(roleCard: RoleCard): string {
  const compensation = roleCard.compensation;
  if (!compensation) return '';
  return compactJoin([
    factValue(compensation.amountText),
    [factValue(compensation.minAmount), factValue(compensation.maxAmount)].filter(Boolean).join('-'),
    factValue(compensation.currency),
    factValue(compensation.cadence),
    factValue(compensation.visibility),
  ]);
}

function compactJoin(values: Array<string | null | undefined>): string {
  return values.map((value) => value?.trim()).filter(Boolean).join(' | ');
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
  groundedNarrativePlan: GroundedNarrativePlan;
}): Promise<Annunci10xValidateOutput> {
  const result = await input.orchestrator.runTask({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    operationType: 'VALIDATE',
    input: {
      generatedAd: input.master,
      roleCard: input.snapshot.roleCard,
      roleProfile: input.snapshot.roleProfile,
      communicationStrategy: input.snapshot.communicationStrategy,
      groundedNarrativePlan: input.groundedNarrativePlan,
    },
    inputSnapshotId: input.snapshot.id,
    idempotencyInputIdentityOverride: stableHash({ snapshotId: input.snapshot.id, authIdentity: input.authIdentity, operation: 'VALIDATE', phase: input.phase, master: input.master.sections, groundedNarrativePlan: input.groundedNarrativePlan }),
    promptVersionOverride: input.phase.startsWith('post-revise') ? `${ANNUNCI10X_PROMPT_PACK_VERSION_V2}.post-revise` : undefined,
  });
  input.operations.push(toPublicOperation(result, 'VALIDATE', input.provider));
  return applyDeterministicOutputValidation(result.output as Annunci10xValidateOutput, input.master, input.snapshot.roleCard, input.provider, input.groundedNarrativePlan);
}

type GroundedNarrativePlan = {
  version: 'annunci10x.evidence-plan.v1';
  purpose: string;
  facts: EvidencePlanFact[];
  globalBoundary: string[];
  blocks: GroundedNarrativeBlock[];
};

type EvidencePlanFact = {
  id: string;
  path: string;
  value: string;
  status: 'KNOWN_FACT' | 'MUST_MENTION_FACT' | 'DO_NOT_INVENT';
  sourceFactIds: string[];
};

type GroundedNarrativeBlock = {
  id: string;
  targetSection: string;
  paragraphGoal: string;
  supportingFactIds: string[];
  candidateMessage: string;
  allowedInterpretations: string[];
  disallowedAdditions: string[];
};

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
    clientRevisionCount: payload.clientRevisionCount,
    clientRevisionLimit: CLIENT_REVISION_LIMIT,
  };
}

function attachPremiumPayload(master: GeneratedAd, payload: {
  comparison: ComparisonResult | null;
  claimCheck: ClaimCheck[];
  gate: PublicationGate;
  rationale: string[];
  automaticRevisionCount: 0 | 1 | 2 | 3;
  clientRevisionCount?: number;
  validationResult: Annunci10xValidateOutput['result'];
  decisionEngine?: Record<string, unknown>;
}): GeneratedAd {
  return {
    ...master,
    annunci10xPremium: {
      comparison: payload.comparison,
      claimCheck: payload.claimCheck,
      gate: payload.gate,
      rationale: payload.rationale,
      automaticRevisionCount: payload.automaticRevisionCount,
      clientRevisionCount: payload.clientRevisionCount ?? 0,
      validationResult: payload.validationResult,
      decisionEngine: payload.decisionEngine ?? null,
    },
  } as GeneratedAd;
}

function readPremiumPayload(master: GeneratedAd): {
  comparison: ComparisonResult | null;
  claimCheck: ClaimCheck[];
  gate: PublicationGate | null;
  rationale: string[];
  automaticRevisionCount: 0 | 1 | 2 | 3;
  clientRevisionCount: number;
  decisionEngine: Record<string, unknown> | null;
} {
  const payload = (master as GeneratedAd & { annunci10xPremium?: unknown }).annunci10xPremium;
  if (typeof payload !== 'object' || payload === null) {
    return { comparison: null, claimCheck: [], gate: null, rationale: [], automaticRevisionCount: 0, clientRevisionCount: 0, decisionEngine: null };
  }
  const record = payload as {
    comparison?: ComparisonResult | null;
    claimCheck?: ClaimCheck[];
    gate?: PublicationGate | null;
    rationale?: string[];
    automaticRevisionCount?: number;
    clientRevisionCount?: number;
    decisionEngine?: Record<string, unknown> | null;
  };
  const automaticRevisionCount = Math.max(0, Math.min(3, Number(record.automaticRevisionCount ?? 0))) as 0 | 1 | 2 | 3;
  const clientRevisionCount = Math.max(0, Math.min(CLIENT_REVISION_LIMIT, Number(record.clientRevisionCount ?? 0)));
  return {
    comparison: record.comparison ?? null,
    claimCheck: Array.isArray(record.claimCheck) ? record.claimCheck : [],
    gate: record.gate ?? null,
    rationale: Array.isArray(record.rationale) ? record.rationale : [],
    automaticRevisionCount,
    clientRevisionCount,
    decisionEngine: record.decisionEngine && typeof record.decisionEngine === 'object' ? record.decisionEngine : null,
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
  const output = await resolveLatestMasterFromConsumedReservation(
    input.context,
    input.session,
    input.sessionSecret,
    reservation,
  );
  if (!output) return null;
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
  return {
    ...normalized,
    sections: normalizeCandidateFacingSections(normalized.sections, roleCard),
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

function normalizeCandidateFacingSections(sections: GeneratedAd['sections'], roleCard: RoleCard): GeneratedAd['sections'] {
  const candidateSections = sections
    .filter((section) => section.type !== 'CLAIM_CHECK')
    .map((section) => ({
      ...section,
      body: removeNonCandidateFacingLines(section.body.replace(/\\n/g, '\n')),
    }))
    .filter((section) => section.type === 'TITLE' || section.body.trim());

  const title = candidateSections.find((section) => section.type === 'TITLE') ?? canonicalTitleSection(roleCard);
  const rest = candidateSections.filter((section) => section !== title);
  return title ? [title, ...rest] : rest;
}

function canonicalTitleSection(roleCard: RoleCard): GeneratedAd['sections'][number] | null {
  const title = publishableFact(roleCard.title);
  return title ? canonicalSection('generated-role-title', 'TITLE', title.value, '', title.sourceIds) : null;
}

function removeNonCandidateFacingLines(body: string): string {
  return body
    .split('\n')
    .filter((line) => !isMissingDataDisclosure(line))
    .join('\n')
    .trim();
}

function applyDeterministicOutputValidation(
  validation: Annunci10xValidateOutput,
  master: GeneratedAd,
  roleCard: RoleCard,
  provider: Annunci10xConfiguredProvider,
  groundedNarrativePlan: GroundedNarrativePlan,
): Annunci10xValidateOutput {
  const baseValidation = normalizeKnownFactOmissions(normalizeValidationResultConsistency(normalizeRepairableEditorialRequirementLabels(validation)), groundedNarrativePlan);
  const editorialClaims = detectCandidateFacingEditorialIssues(master, roleCard, provider);
  const omittedCriticalFacts = detectOmittedCriticalCandidateFacts(master, roleCard);
  const unsupportedCandidateClaimFindings = detectUnsupportedCandidateClaimFindings(master, roleCard);
  const unsupportedCandidateClaims = unsupportedCandidateClaimFindings.map((finding) => finding.claim);
  if (!editorialClaims.length && !omittedCriticalFacts.length && !unsupportedCandidateClaimFindings.length) return baseValidation;

  const nextClaims = [
    ...baseValidation.claims,
    ...editorialClaims,
    ...unsupportedCandidateClaimFindings.map((finding, index) => ({
      id: `deterministic-unsupported-claim-${index + 1}`,
      kind: 'CLAIM' as const,
      claim: finding.claim,
      supported: false,
      sourcePaths: finding.sourcePaths,
      action: 'REMOVE' as const,
    })),
  ];
  const result: Annunci10xValidateOutput['result'] = baseValidation.result === 'BLOCK' ? 'BLOCK' : 'NEEDS_REVISION';
  return {
    ...baseValidation,
    claims: nextClaims,
    unsupportedClaims: uniqueStrings([...baseValidation.unsupportedClaims, ...unsupportedCandidateClaims]),
    omittedCriticalFacts: uniqueStrings([...baseValidation.omittedCriticalFacts, ...omittedCriticalFacts]),
    result,
  };
}

function normalizeKnownFactOmissions(validation: Annunci10xValidateOutput, groundedNarrativePlan: GroundedNarrativePlan): Annunci10xValidateOutput {
  const claims = validation.claims.filter((claim) => !isUnknownMissingFactClaim(claim, groundedNarrativePlan) && !isNonActionableEditorialConfirmation(claim));
  const omittedCriticalFacts = validation.omittedCriticalFacts.filter((fact) => isKnownMustMentionOmission(fact, groundedNarrativePlan));
  const removedUnknownMissingIssues = claims.length !== validation.claims.length || omittedCriticalFacts.length !== validation.omittedCriticalFacts.length;
  if (!removedUnknownMissingIssues) return validation;
  const next = { ...validation, claims, omittedCriticalFacts };
  return normalizeValidationOutcome(next);
}

function normalizeValidationOutcome(validation: Annunci10xValidateOutput): Annunci10xValidateOutput {
  if (validation.result === 'BLOCK') return validation;
  const hasIssue = validation.unsupportedClaims.length > 0
    || validation.contradictions.length > 0
    || validation.omittedCriticalFacts.length > 0
    || validation.alteredRequirements.length > 0
    || validation.claims.some((claim) => claim.action === 'REMOVE' || claim.action === 'REQUEST_CONFIRMATION' || claim.supported === false);
  return hasIssue ? { ...validation, result: 'NEEDS_REVISION' } : { ...validation, result: 'PASS' };
}

function isUnknownMissingFactClaim(claim: Annunci10xValidateOutput['claims'][number], groundedNarrativePlan: GroundedNarrativePlan): boolean {
  if (claim.sourcePaths.some((path) => /generatedAd\.sections|\bsec-|^s[-_]/i.test(path))) return false;
  const referencedFacts = factsReferencedByClaim(claim, groundedNarrativePlan);
  if (referencedFacts.some((fact) => fact.status === 'MUST_MENTION_FACT' || fact.status === 'KNOWN_FACT')) return false;
  if (referencedFacts.length > 0 && referencedFacts.every((fact) => fact.status === 'DO_NOT_INVENT')) return true;
  if (claim.sourcePaths.some((path) => /communicationStrategy\.missingFacts|missingFacts|#mf-|#miss-/i.test(path)) && isMissingUnknownConfirmationText(claim.claim)) return true;
  if (claim.action !== 'REQUEST_CONFIRMATION') return false;
  return isMissingUnknownConfirmationText(claim.claim);
}

function isNonActionableEditorialConfirmation(claim: Annunci10xValidateOutput['claims'][number]): boolean {
  if (claim.kind !== 'EDITORIAL' || claim.action !== 'REQUEST_CONFIRMATION') return false;
  if (claim.supported === false) return false;
  if (claim.sourcePaths.some((path) => /generatedAd\.sections|\bsec-|^s[-_]/i.test(path))) return false;
  return /\b(?:si\s+potrebbe|potrebbe\s+essere\s+utile|relativamente\s+compress[oa]|leggermente|aiutare\s+il\s+candidato\s+a\s+immaginare\s+meglio)\b/i.test(claim.claim)
    && !/\b(?:rimuovere|remove|sostituire|replace|contraddizione|non\s+supportat|inventat|omess[oa]|alterat[oa]|placeholder|CTA|canale)\b/i.test(claim.claim);
}

function factsReferencedByClaim(claim: Annunci10xValidateOutput['claims'][number], groundedNarrativePlan: GroundedNarrativePlan): EvidencePlanFact[] {
  const ids = new Set<string>();
  for (const path of claim.sourcePaths) {
    const direct = path.match(/\bF\d{2,}\b/gi) ?? [];
    for (const id of direct) ids.add(id.toUpperCase());
  }
  return groundedNarrativePlan.facts.filter((fact) => ids.has(fact.id.toUpperCase()));
}

function isMissingUnknownConfirmationText(value: string): boolean {
  return /\b(?:manca|mancano|assente|assenti|non\s+[eè]\s+specificat|non\s+[eè]\s+fornit|non\s+dichiarat|da\s+chiarire|missingFacts|mf-\d+|miss-\d+|confermare\s+se|se\s+si\s+vuole\s+pubblicare|valutare\s+se\s+fornire|troncato)\b/i.test(value)
    && /\b(?:orario|schedule|reperibilit[aà]|on[-\s]?call|benefit|formazione|budget\s+formazione|team\s+size|dimensione\s+(?:e\s+composizione\s+del\s+)?team|strumenti\s+di\s+sviluppo|delivery|CI\/CD|deployment|test\s+framework|processo\s+di\s+selezione|fasi\s+della\s+selezione|tempistiche|dettagli\s+tecnici\s+aggiuntivi)\b/i.test(value);
}

function isKnownMustMentionOmission(omission: string, groundedNarrativePlan: GroundedNarrativePlan): boolean {
  const normalized = omission.toLowerCase();
  if (/\b(?:missingFacts?|mf-\d+|miss-\d+|non\s+[eè]\s+fornit|non\s+[eè]\s+specificat|non\s+dichiarat|manca|mancano|da\s+chiarire)\b/i.test(omission)) return false;
  const omissionTokens = new Set(semanticCandidateTokens(omission));
  return groundedNarrativePlan.facts.some((fact) => {
    if (fact.status !== 'MUST_MENTION_FACT') return false;
    if (fact.id && normalized.includes(fact.id.toLowerCase())) return true;
    const factTokens = semanticCandidateTokens(fact.value);
    if (!factTokens.length) return false;
    const overlap = factTokens.filter((token) => omissionTokens.has(token)).length;
    return overlap >= Math.min(3, factTokens.length);
  });
}

function normalizeValidationResultConsistency(validation: Annunci10xValidateOutput): Annunci10xValidateOutput {
  if (validation.result !== 'PASS') return validation;
  const hasRepairableIssue = validation.unsupportedClaims.length > 0
    || validation.contradictions.length > 0
    || validation.omittedCriticalFacts.length > 0
    || validation.alteredRequirements.length > 0
    || validation.claims.some((claim) => claim.action === 'REMOVE' || claim.action === 'REQUEST_CONFIRMATION' || claim.supported === false);
  return hasRepairableIssue ? { ...validation, result: 'NEEDS_REVISION' } : validation;
}

function normalizeRepairableEditorialRequirementLabels(validation: Annunci10xValidateOutput): Annunci10xValidateOutput {
  const repairableAltered = validation.alteredRequirements.filter(isRepairableRequirementLabelIssue);
  const hasRepairableClaims = validation.claims.some((claim) => isRepairableRequirementLabelIssue(claim.claim) || isRepairableUnsupportedCopyIssue(claim.claim) || isGeneratedUnsupportedClaim(claim));
  if (!repairableAltered.length && !hasRepairableClaims) return validation;
  const remainingAltered = validation.alteredRequirements.filter((item) => !isRepairableRequirementLabelIssue(item));
  const claims = validation.claims.map((claim) => isRepairableRequirementLabelIssue(claim.claim)
    ? {
      ...claim,
      kind: 'EDITORIAL' as const,
      supported: false,
      action: 'REMOVE' as const,
    }
    : isRepairableUnsupportedCopyIssue(claim.claim)
      ? {
        ...claim,
        action: 'REMOVE' as const,
      }
      : isGeneratedUnsupportedClaim(claim)
        ? {
          ...claim,
          action: 'REMOVE' as const,
        }
      : claim);
  return {
    ...validation,
    claims,
    alteredRequirements: remainingAltered,
    result: validation.result === 'BLOCK' ? 'NEEDS_REVISION' : validation.result,
  };
}

function isGeneratedUnsupportedClaim(claim: Annunci10xValidateOutput['claims'][number]): boolean {
  if (claim.supported !== false || claim.action !== 'REQUEST_CONFIRMATION') return false;
  if (claim.sourcePaths.some((path) => /communicationStrategy\.missingFacts|missingFacts|#mf-|#miss-/i.test(path))) return false;
  return claim.sourcePaths.some((path) => /generatedAd\.sections|\bsec-|^s[-_]/i.test(path));
}

function isRepairableRequirementLabelIssue(value: string): boolean {
  return /requisiti\s+selettivi|label.*requisit|intestazione.*requisit|percezione.*obbligator/i.test(value);
}

function isRepairableUnsupportedCopyIssue(value: string): boolean {
  return /\b(?:regolarmente|quotidian[aoe]|ogni\s+giorno|spesso)\b.*(?:non\s+confermat|altera|frequenza)|frequenza\s+non\s+confermat|coordinare\s+le\s+release|release.*non\s+confermat|canale\s+dell[’']annuncio|documentazione\s+di\s+trasporto|DDT|bolle|confezion|imball|pack(?:ing)?|boxing|wrapping|consegn[ae]|procedure\s+(?:operative|specifiche|di\s+gestione)|altri\s+reparti|in\s+sicurezza|in\s+modo\s+sicur[oaie]?|sicur[oaie]|sicurezza.*non\s+(?:è\s+)?presente|\btest\b|controlli\s+applicativi|test\s+automation|QA|servizi\s+esterni|discrepanze\s+tra\s+client|end-to-end|regression|regressioni|incident(?:i|e)?\s+prod|TRAINABLE|apprendibil|procedure\s+interne|architettura\s+delle\s+applicazioni|prodotti\s+aziendali|tecnologie\s+preferenziali|non\s+sono\s+stat[ei]\s+dichiarat[ei]|non\s+vengono\s+indicat[ei]|non\s+abbiamo\s+informazioni|non\s+[eè]\s+specificat[oaie]|non\s+sono\s+disponibili\s+dettagli|assenza\s+di\s+dato|missing-data|concordat[ioa]?\s+con\s+l[’']azienda|negoziabil|flessibil|definibil|tempi\s+di\s+inserimento|processo\s+(?:commerciale\s+)?strutturat[oa]|pensat[oa]\s+per\s+chi\s+preferisce/i.test(value);
}

function detectCandidateFacingEditorialIssues(master: GeneratedAd, roleCard: RoleCard, provider: Annunci10xConfiguredProvider): Annunci10xValidateOutput['claims'] {
  const findings: Annunci10xValidateOutput['claims'] = [];
  const hasConfirmedTraining = roleHasConfirmedTraining(roleCard);
  const hasConfirmedSafety = roleHasConfirmedSafety(roleCard);
  const allLines = master.sections
    .flatMap((section) => `${section.title}\n${section.body}`.split('\n'))
    .map((line) => line.trim())
    .filter(Boolean);
  const listLikeLines = allLines.filter((line) => /^\s*(?:[-*•]|\d+[.)]\s+|[A-ZÀ-Ü][A-Za-zÀ-ü ]{1,32}:)/.test(line)).length;
  if (allLines.length >= 6 && listLikeLines / allLines.length >= 0.6) {
    findings.push(editorialFinding('master-structure', 'Il Master è principalmente una lista o scheda di campi: serve prosa candidate-facing che spieghi il lavoro, non solo una RoleCard formattata.'));
  }
  const criticalFactCount = collectCriticalCandidateFacts(roleCard).length;
  const totalWords = countWords(masterText(master));
  const applyDepthGuard = provider === 'OPENAI';
  const hasRichSource = criticalFactCount >= 14;
  if (applyDepthGuard && hasRichSource && totalWords < 450) {
    findings.push(editorialFinding('master-depth', 'Il Master è factualmente corretto ma troppo sintetico rispetto ai fatti disponibili: deve sviluppare meglio lavoro, contesto, attività, requisiti e condizioni per aiutare il candidato a immaginare il ruolo. Per un input ricco, il testo finale non deve restare una sintesi breve o una scheda compatta.'));
    for (const section of master.sections) {
      if (section.type === 'OPENING' && countWords(section.body) < 90) {
        findings.push(editorialFinding(section.id, 'L’apertura è troppo breve per il contesto confermato: deve introdurre ruolo, azienda/contesto e risultato del lavoro con più continuità candidate-facing.'));
      }
      if (section.type === 'RESPONSIBILITIES' && countWords(section.body) < 190) {
        findings.push(editorialFinding(section.id, 'La sezione responsabilità è troppo compressa per i fatti disponibili: deve sviluppare attività, strumenti, interlocutori, problemi operativi e risultato del lavoro in prosa più completa.'));
      }
      if (section.type === 'REQUIREMENTS' && countWords(section.body) < 110) {
        findings.push(editorialFinding(section.id, 'La sezione requisiti/fit candidato è troppo schematica: deve spiegare perché competenze e qualità confermate contano nel lavoro reale senza inventare nuovi requisiti.'));
      }
    }
  }
  for (const section of master.sections) {
    const visible = `${section.title}\n${section.body}`;
    if (applyDepthGuard && hasCondensedResponsibilitySection(section, roleCard)) {
      findings.push(editorialFinding(section.id, 'La sezione responsabilità condensa troppi fatti in poco spazio: deve spiegare operativamente come attività, strumenti, interlocutori e problemi si collegano nel lavoro reale.'));
    }
    if (hasDuplicatedResponsibilityList(section, master.sections)) {
      findings.push(editorialFinding(section.id, 'Il Master duplica le responsabilità: una sezione descrittiva è seguita da una lista "Attività principali" che ripete gli stessi punti invece di integrarli in prosa.'));
    }
    if (hasDanglingListLeadIn(section)) {
      findings.push(editorialFinding(section.id, 'Il Master introduce una lista separata con una frase sospesa invece di integrare le attività nella sezione in modo fluido.'));
    }
    if (hasHrRequirementBlock(section)) {
      findings.push(editorialFinding(section.id, 'Il Master usa sottoblocchi requisiti da scheda HR: deve spiegare il fit del candidato in prosa, preservando le classificazioni senza trasformarle in elenco meccanico.'));
    }
    if (hasGenericCompanyFirstOpening(section, roleCard)) {
      findings.push(editorialFinding(section.id, 'L’apertura usa un template generico azienda + cerchiamo invece di valorizzare il contesto e il risultato del ruolo già confermati.'));
    }
    if (hasInternalRoleCardHeading(section.title) || hasInternalRoleCardHeading(section.body)) {
      findings.push(editorialFinding(section.id, 'Il Master espone etichette interne della RoleCard invece di trasformarle in copy candidate-facing.'));
    }
    if (/\b(?:Non dichiarat[ioaie]|Non specificat[ioaie]|Non disponibile|non sono stat[ioaie] dichiarat[ioaie]|non vengono indicat[ie]|non abbiamo informazioni|non [eè] specificat[oaie]|non sono disponibili dettagli|nessuna tecnologia preferenziale ulteriore|missing fields?|factual preservation|sourceFactIds|RoleCard|rubric|score|confidence|reasoning)\b/i.test(visible)) {
      findings.push(editorialFinding(section.id, 'Il Master espone placeholder, missing data o termini interni non pubblicabili.'));
    }
    if (!hasConfirmedSafety && /\b(?:in\s+sicurezza|in\s+modo\s+sicur[oaie]?|sicurezz[ao]?|sicur[oaie]|DPI|antinfortunistich[eo]|normativ[ae]\s+di\s+sicurezza|procedure\s+(?:di\s+)?sicurezza|procedure\s+di\s+gestione)\b/i.test(visible)) {
      findings.push(editorialFinding(section.id, 'Il Master introduce sicurezza, DPI, procedure o responsabilità safety non confermate dalla Truth Ledger: rimuovere il claim e preservare solo attività, strumenti o condizioni confermate.'));
    }
    if (/\b(?:l['’ ]?annuncio|il testo|la pagina|il portale|dato da chiarire|prima della pubblicazione)\b/i.test(visible)) {
      findings.push(editorialFinding(section.id, 'Il Master parla del documento sorgente o del processo invece di parlare al candidato.'));
    }
    if (hasUnsupportedConditionNegotiability(visible, roleCard)) {
      findings.push(editorialFinding(section.id, 'Il Master presenta condizioni già dichiarate come concordate, negoziabili, flessibili o definibili senza supporto: pubblicare direttamente i facts confermati senza aggiungere una sfumatura negoziale.'));
    }
    if (hasUnsupportedPreferredRequirementConsequence(visible, roleCard)) {
      findings.push(editorialFinding(section.id, 'Il Master aggiunge una conseguenza operativa o un vantaggio pratico a partire da un requisito preferenziale senza supporto esplicito: mantenere il requisito come preferenziale senza inventare effetti.'));
    }
    if (hasUnsupportedCollaborationProcess(visible, roleCard)) {
      findings.push(editorialFinding(section.id, 'Il Master trasforma collaborazione o coordinamento confermati in un processo strutturato non dichiarato: conservare la collaborazione senza inventare procedure o passaggi.'));
    }
    if (hasUnsupportedScheduleEvaluation(visible, roleCard)) {
      findings.push(editorialFinding(section.id, 'Il Master deduce preferenze o compatibilità personali dall’orario dichiarato: mantenere l’orario come condizione senza aggiungere valutazioni non supportate.'));
    }
    if (/\b(?:candidatura|candidat[ioe]|candidarsi|invio candidatura).{0,80}(?:tramite il canale dell[’']annuncio|canale indicato nell[’']annuncio|nell[’']annuncio)\b/i.test(visible)
      || /\b(?:utilizza|usa|segui).{0,40}\bcanale\s+(?:indicato|previsto)\s+nell[’']annuncio\b/i.test(visible)) {
      findings.push(editorialFinding(section.id, 'La CTA è meccanica: deve indicare un invito naturale alla candidatura senza citare il canale come placeholder.'));
    }
    if (!hasConfirmedTraining && /\b(?:si\s+apprend(?:e|ono)\s+sul\s+posto|apprendibil[ei]\s+(?:sul\s+posto|in\s+sede)|vengono\s+acquisit[ie]\s+nel\s+ruolo|viene\s+acquisit[oa]\s+nel\s+ruolo|acquisit[ie]\s+nel\s+ruolo|formabili\s+in\s+sede|formazione\s+in\s+sede|training\s+in\s+sede)\b/i.test(visible)) {
      findings.push(editorialFinding(section.id, 'Il Master trasforma elementi interni apprendibili in una promessa pubblica di apprendimento/formazione non confermata.'));
    }
    if (exposesTrainableAsCandidateCopy(visible, roleCard)) {
      findings.push(editorialFinding(section.id, 'Il Master pubblica elementi TRAINABLE interni invece di tenerli fuori dal copy candidate-facing.'));
    }
    const repeatedTemplateFragments = (visible.match(/\b(?:sviluppi, mantieni e migliori|ti occuperai di|la persona si occuper[aà]|preferenze:|trainabile:|apprendibile sul posto:|formabili in sede:|conoscenze che si apprendono|elementi apprendibili)\b/gi) ?? []).length;
    if (repeatedTemplateFragments > 1) {
      findings.push(editorialFinding(section.id, 'Il Master usa linguaggio da template o scheda HR invece di copy naturale per il candidato.'));
    }
  }
  return dedupeClaims(findings);
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function hasCondensedResponsibilitySection(section: GeneratedAd['sections'][number], roleCard: RoleCard): boolean {
  if (section.type !== 'RESPONSIBILITIES') return false;
  const realWorkFacts = [
    ...roleCard.responsibilities.map((fact) => fact.value),
    roleCard.attractionContext.operatingContext?.value,
    roleCard.attractionContext.autonomy?.value,
    roleCard.attractionContext.unexpectedEvents?.value,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  if (realWorkFacts.length < 4) return false;
  const body = section.body.trim();
  const paragraphCount = body.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean).length;
  const wordCount = countWords(body);
  const sentenceCount = body.split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean).length;
  const bulletCount = (body.match(/^\s*(?:[-*•]|\d+[.)]\s+)/gm) ?? []).length;
  const colonLabelCount = (body.match(/(?:^|\n)\s*[A-ZÀ-Ü][A-Za-zÀ-ü ]{1,32}\s*:/g) ?? []).length;
  const hasNarrativeDevelopment = /\b(?:quando|perch[eé]|per questo|serve|significa|collabor|coordina|segnal|confront|contribu|ti occuperai|lavorerai|nel ruolo|una parte importante|l[’']obiettivo|il risultato|in modo che)\b/i.test(body);
  const hasListLikeSerialization = bulletCount >= 3 || colonLabelCount >= 3 || /;\s*[^.;:]+;\s*[^.;:]+/.test(body);

  if (hasListLikeSerialization && wordCount < 180) return true;
  if (paragraphCount <= 1 && sentenceCount <= 2 && wordCount < 140 && !hasNarrativeDevelopment) return true;
  return false;
}

function hasUnsupportedConditionNegotiability(value: string, roleCard: RoleCard): boolean {
  const known = knownCandidateText(roleCard);
  if (/\b(?:contratt[oi]|orario|turni|reperibilit[aà]|modalit[aà]|sede).{0,90}\b(?:concordat[ioa]?\s+con\s+l[’']azienda|negoziabil[ei]|flessibil[ei]|definibil[ei])\b/i.test(value)
    && !/\b(?:concordat[ioa]?\s+con\s+l[’']azienda|negoziabil[ei]|flessibil[ei]|definibil[ei])\b/i.test(known)) return true;
  if (/\b(?:concordat[ioa]?\s+con\s+l[’']azienda|negoziabil[ei]|flessibil[ei]|definibil[ei])\b.{0,90}\b(?:contratt[oi]|orario|turni|reperibilit[aà]|modalit[aà]|sede)\b/i.test(value)
    && !/\b(?:concordat[ioa]?\s+con\s+l[’']azienda|negoziabil[ei]|flessibil[ei]|definibil[ei])\b/i.test(known)) return true;
  return false;
}

function hasUnsupportedPreferredRequirementConsequence(value: string, roleCard: RoleCard): boolean {
  const preferredRequirements = roleCard.requirements.filter((requirement) => requirement.classification === 'PREFERRED');
  if (!preferredRequirements.length) return false;
  const known = knownCandidateText(roleCard);
  if (/\b(?:plus|gradit[ioa]|preferibil[ei]|preferenzial[ei]|non\s+obbligator[ioa])\b.{0,180}\b(?:riduc|acceler|facilit|vantagg|miglior).{0,80}\b(?:tempi?\s+di\s+inserimento|inserimento|autonomia|produttivit[aà]|performance)\b/i.test(value)
    && !/\b(?:riduc|acceler|facilit|tempi?\s+di\s+inserimento|inserimento)\b/i.test(known)) return true;
  return splitSentences(value).some((sentence) => {
    if (!hasPreferredRequirementReference(sentence, preferredRequirements)) return false;
    return hasPreferredRequirementConsequencePhrase(sentence) && !hasPreferredRequirementConsequencePhrase(known);
  });
}

function splitSentences(value: string): string[] {
  return value.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
}

function hasPreferredRequirementReference(sentence: string, preferredRequirements: RoleCard['requirements']): boolean {
  if (/\b(?:plus|gradit[ioa]|preferibil[ei]|preferenzial[ei]|valore\s+aggiunto|non\s+obbligator[ioa]|non\s+vincolant[ei])\b/i.test(sentence)) return true;
  const sentenceTokens = new Set(semanticCandidateTokens(sentence));
  return preferredRequirements.some((requirement) => {
    const requirementTokens = semanticCandidateTokens(requirement.label.value);
    if (!requirementTokens.length) return false;
    const overlap = requirementTokens.filter((token) => sentenceTokens.has(token)).length;
    return overlap >= Math.min(2, requirementTokens.length)
      || (overlap >= 1 && hasPreferredRequirementConsequencePhrase(sentence));
  });
}

function hasPreferredRequirementConsequencePhrase(value: string): boolean {
  return /\b(?:riduc|acceler|facilit|vantagg|miglior|consent|permett|aiut|rend(?:e|ono|ere)).{0,120}\b(?:tempi?\s+di\s+inserimento|inserimento|integrazione|autonomia|produttivit[aà]|performance|operativ[ioa]|operativi|attivit[aà]\s+operative|lavoro)\b/i.test(value)
    || /\b(?:tempi?\s+di\s+inserimento|inserimento|integrazione|autonomia|produttivit[aà]|performance|operativ[ioa]|operativi|attivit[aà]\s+operative|lavoro)\b.{0,120}\b(?:riduc|acceler|facilit|vantagg|miglior|consent|permett|aiut|rend(?:e|ono|ere))\b/i.test(value)
    || /\bperch[eé]\s+(?:aiut|facilit|riduc|acceler|miglior|consent|permett|rappresent)\b/i.test(value);
}

function hasUnsupportedCollaborationProcess(value: string, roleCard: RoleCard): boolean {
  const known = knownCandidateText(roleCard);
  const hasCollaborationFact = /\b(?:collabor|coordina|confront|team|responsabile|ufficio|autist|marketing|delivery)\b/i.test(known);
  if (!hasCollaborationFact) return false;
  if (/\b(?:collabor|coordina|confront).{0,140}\b(?:processo\s+(?:commerciale\s+)?strutturat[oa]|passaggi\s+codificat[ioe]|procedura\s+strutturat[ae]|workflow\s+strutturat[oa])\b/i.test(value)
    && !/\b(?:processo\s+(?:commerciale\s+)?strutturat[oa]|passaggi\s+codificat[ioe]|procedura\s+strutturat[ae]|workflow\s+strutturat[oa])\b/i.test(known)) return true;
  return false;
}

function hasUnsupportedScheduleEvaluation(value: string, roleCard: RoleCard): boolean {
  if (!publishableFact(roleCard.attractionContext.schedule)) return false;
  const known = knownCandidateText(roleCard);
  if (/\b(?:orario|lun(?:ed[iì])?|venerd[iì]|full[-\s]?time|part[-\s]?time|diurno)\b.{0,130}\b(?:pensat[oa]\s+per\s+chi\s+preferisce|adatt[oa]\s+a\s+chi\s+cerca|compatibil[ei]\s+con|ideale\s+per\s+chi)\b/i.test(value)
    && !/\b(?:pensat[oa]\s+per\s+chi\s+preferisce|adatt[oa]\s+a\s+chi\s+cerca|compatibil[ei]\s+con|ideale\s+per\s+chi)\b/i.test(known)) return true;
  return false;
}

function knownCandidateText(roleCard: RoleCard): string {
  return collectCriticalCandidateFacts(roleCard).map((fact) => fact.expected).join(' ');
}

function hasDuplicatedResponsibilityList(
  section: GeneratedAd['sections'][number],
  sections: GeneratedAd['sections'],
): boolean {
  if (section.type !== 'RESPONSIBILITIES') return false;
  const bulletCount = (section.body.match(/^\s*(?:[-*•]|\d+[.)]\s+)/gm) ?? []).length;
  if (bulletCount < 4) return false;
  if (!/\b(?:attivit[aà]\s+principal[ie]|responsabilit[aà]\s+principal[ie]|compiti\s+principal[ie])\b/i.test(section.title)) return false;
  const sourceIds = new Set(section.sourceFactIds ?? []);
  return sections.some((other) => {
    if (other.id === section.id || other.type !== 'RESPONSIBILITIES') return false;
    if ((other.body.match(/^\s*(?:[-*•]|\d+[.)]\s+)/gm) ?? []).length >= 4) return false;
    return (other.sourceFactIds ?? []).some((sourceId) => sourceIds.has(sourceId));
  });
}

function hasDanglingListLeadIn(section: GeneratedAd['sections'][number]): boolean {
  return /\b(?:attivit[aà]|compiti|responsabilit[aà])\s+(?:tipiche\s+)?(?:incluse\s+nel\s+ruolo|principal[ie])\s*:\s*$/i.test(section.body.trim());
}

function hasHrRequirementBlock(section: GeneratedAd['sections'][number]): boolean {
  const visible = `${section.title}\n${section.body}`;
  const hasRequirementLabel = /\b(?:Requisiti\s+(?:principali|richiesti|preferit[ioe]|obbligator[ioe])|Plus|Preferibil[ei]|Obbligator[ioe]|Indispensabil[ei])\b/i.test(visible);
  const bulletCount = (section.body.match(/^\s*(?:[-*•]|\d+[.)]\s+)/gm) ?? []).length;
  const colonLabelCount = (section.body.match(/^\s*(?:Requisiti\s+(?:principali|richiesti|preferit[ioe]|obbligator[ioe])|Plus|Preferibil[ei]|Obbligator[ioe]|Indispensabil[ei])\s*:/gim) ?? []).length;
  return hasRequirementLabel && (bulletCount >= 2 || colonLabelCount > 0);
}

function hasGenericCompanyFirstOpening(section: GeneratedAd['sections'][number], roleCard: RoleCard): boolean {
  if (section.type !== 'OPENING') return false;
  if (!publishableFact(roleCard.attractionContext.operatingContext) && !publishableFact(roleCard.mission)) return false;
  return /\bSiamo\s+(?:una|un|il|la)?\s*(?:PMI|azienda|societ[aà]|realta)\b.{0,140}\bcerchiamo\b/i.test(section.body);
}

function hasInternalRoleCardHeading(value: string): boolean {
  return /(^|\n)\s*(?:Missione del ruolo|Obiettivo del ruolo|Contesto operativo(?:\s+e\s+autonomia)?|Autonomia|Imprevisti e variabilit[aà]|Apprendibil[ei](?:\s+sul\s+posto|\s+in\s+sede)?|Elementi apprendibili in sede|Conoscenze che si apprendono(?:\s+sul\s+posto)?|Trainabile|Formabili in sede|Vincoli|negative constraints|Preferenze|Benefit|Turni|Reperibilit[aà])\s*:/im.test(value)
    || /^(?:Missione del ruolo|Obiettivo del ruolo|Contesto operativo(?:\s+e\s+autonomia)?|Autonomia|Imprevisti e variabilit[aà]|Apprendibil[ei](?:\s+sul\s+posto|\s+in\s+sede)?|Elementi apprendibili in sede|Conoscenze che si apprendono(?:\s+sul\s+posto)?|Trainabile|Formabili in sede|Vincoli|negative constraints|Preferenze)$/i.test(value.trim());
}

function isMissingDataDisclosure(value: string): boolean {
  return /^\s*(?:Vincoli|Benefit|Turni|Reperibilit[aà]|Preferenze|Trainabile|Formabili in sede|Apprendibil[ei](?:\s+sul\s+posto)?|Offerta|Crescita|Formazione)\s*:\s*(?:Non dichiarat[ioaie]|Non specificat[ioaie]|Non disponibile|N\/D|Da definire|Da chiarire|non sono stat[ioaie] dichiarat[ioaie]|nessuna tecnologia preferenziale ulteriore)/i.test(value)
    || /^\s*(?:Non dichiarat[ioaie]|Non specificat[ioaie]|Non disponibile|Non sono stat[ioaie] dichiarat[ioaie])/i.test(value);
}

function editorialFinding(sectionId: string, claim: string): Annunci10xValidateOutput['claims'][number] {
  return {
    id: `deterministic-editorial-${stableHash(`${sectionId}:${claim}`).slice(0, 10)}`,
    kind: 'EDITORIAL',
    claim,
    supported: true,
    sourcePaths: [sectionId],
    action: 'REMOVE',
  };
}

function detectOmittedCriticalCandidateFacts(master: GeneratedAd, roleCard: RoleCard): string[] {
  return collectCriticalCandidateFacts(roleCard)
    .filter((fact) => !isCandidateFactSemanticallyRepresented(master, fact.expected, fact.sourceIds, fact.kind))
    .map((fact) => `${fact.label}: ${fact.expected}`);
}

type CriticalCandidateFact = { label: string; expected: string; sourceIds: string[]; kind: string };

function collectCriticalCandidateFacts(roleCard: RoleCard): CriticalCandidateFact[] {
  const facts: CriticalCandidateFact[] = [];
  const add = (label: string, fact: Fact<string> | undefined, kind = label) => {
    const candidate = publishableFact(fact);
    if (!candidate) return;
    if (isNonCandidateFacingFact(candidate.value)) return;
    facts.push({ label, expected: candidate.value, sourceIds: candidate.sourceIds, kind });
  };
  add('title', roleCard.title, 'title');
  add('mission', roleCard.mission, 'mission');
  if (!publishableFact(roleCard.mission)) {
    for (const [index, fact] of roleCard.outcomes.entries()) add(`outcome ${index + 1}`, fact, 'outcome');
  }
  for (const [index, fact] of roleCard.responsibilities.entries()) add(`responsibility ${index + 1}`, fact, 'responsibility');
  for (const requirement of roleCard.requirements) {
    if (requirement.classification === 'DISQUALIFYING' && /nessun|non\s+sono|non\s+previst|non\s+dichiar/i.test(String(requirement.label.value ?? ''))) continue;
    if (requirement.classification === 'TRAINABLE') continue;
    add(`requirement ${requirement.classification.toLowerCase()} ${requirement.id}`, requirement.label, `requirement:${requirement.classification.toLowerCase()}`);
  }
  add('companyDescription', roleCard.attractionContext.companyDescription, 'companyDescription');
  add('operatingContext', roleCard.attractionContext.operatingContext, 'operatingContext');
  add('autonomy', roleCard.attractionContext.autonomy, 'autonomy');
  add('unexpectedEvents', roleCard.attractionContext.unexpectedEvents, 'unexpectedEvents');
  add('location', roleCard.attractionContext.location, 'location');
  add('workMode', roleCard.attractionContext.workModeDetail ?? roleCard.attractionContext.workMode, 'workMode');
  add('contract', roleCard.attractionContext.contractType, 'contract');
  add('schedule', roleCard.attractionContext.schedule, 'schedule');
  add('shifts', roleCard.attractionContext.shifts, 'shifts');
  add('onCall', roleCard.attractionContext.onCall, 'onCall');
  add('compensation', roleCard.compensation?.amountText, 'compensation');
  for (const [index, fact] of roleCard.attractionContext.attractivenessEvidence.entries()) add(`offerta confermata ${index + 1}`, fact, `offer:${index + 1}`);
  add('applicationInstructions', roleCard.applicationInstructions, 'applicationInstructions');
  const seen = new Set<string>();
  return facts.filter((fact) => {
    const key = semanticCandidateTokens(fact.expected).join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isNonCandidateFacingFact(value: string): boolean {
  return isMissingDataDisclosure(value)
    || /^(?:Non sono stat[ioaie] dichiarat[ioaie]|Non dichiarat[ioaie]|Non specificat[ioaie]|Non disponibile|N\/D)$/i.test(value.trim())
    || /^(?:Candidatura:\s*)?(?:Candidatura\s+)?tramite il canale dell[’']annuncio\.?$/i.test(value.trim())
    || /^nessun[aoei]?\s+(?:benefit|tecnologia preferenziale|percorso|formazione|crescita).*(?:dichiarat|specificat)/i.test(value.trim());
}

type UnsupportedCandidateClaimFinding = { claim: string; sourcePaths: string[] };

function detectUnsupportedCandidateClaimFindings(master: GeneratedAd, roleCard: RoleCard): UnsupportedCandidateClaimFinding[] {
  const text = masterText(master);
  const known = collectCriticalCandidateFacts(roleCard).map((fact) => fact.expected).join(' ');
  const findings: UnsupportedCandidateClaimFinding[] = [];
  const offerTerms = ['buoni pasto', 'ticket restaurant', 'welfare', 'bonus', 'assicurazione sanitaria', 'auto aziendale', 'telefono aziendale', 'laptop'];
  findings.push(...offerTerms
    .filter((term) => new RegExp(term, 'i').test(text) && !new RegExp(term, 'i').test(known))
    .map((term) => ({ claim: `Benefit o dotazione non supportata: ${term}`, sourcePaths: [] })));

  const unsupportedPatterns: Array<{ label: string; pattern: RegExp; supportPattern?: RegExp }> = [
    { label: 'canale LinkedIn', pattern: /\bLinkedIn\b/i },
    { label: 'invio CV/curriculum', pattern: /\b(?:CV|curriculum)\b/i },
    { label: 'lettera o presentazione', pattern: /\b(?:lettera di presentazione|presentazione)\b/i },
    { label: 'ricontatto o callback', pattern: /\b(?:ti ricontatteremo|verrai ricontattat[oaie]|sarai ricontattat[oaie]|ricontatto)\b/i },
    { label: 'colloquio o iter di selezione', pattern: /\b(?:colloqui?|iter di selezione|processo di selezione|step successiv[io]|prossim[io] step|tempi di risposta|feedback)\b/i },
    { label: 'azienda in crescita', pattern: /\b(?:azienda|realta|societa)\s+in\s+crescita\b/i },
    { label: 'ambiente o cultura non supportati', pattern: /\b(?:ambiente dinamico|team giovane|contesto stimolante|cultura aziendale|talento verr[aà]\s+valorizzato|valorizzare il tuo talento)\b/i },
    { label: 'prestigio non supportato', pattern: /\b(?:leader di settore|clienti prestigiosi|realta prestigiosa)\b/i },
    { label: 'formazione o onboarding non supportati', pattern: /\b(?:formazione|onboarding|affiancamento|training|si\s+apprend(?:e|ono)\s+sul\s+posto|vengono\s+acquisit[ie]\s+nel\s+ruolo|viene\s+acquisit[oa]\s+nel\s+ruolo|acquisit[ie]\s+nel\s+ruolo)\b/i },
    { label: 'opportunita di crescita non supportata', pattern: /\b(?:opportunit[aà]|percorso|possibilit[aà])\s+di\s+crescita\b/i },
    { label: 'richiesta esperienza/disponibilita nella CTA non supportata', pattern: /\b(?:indica|indicando|specifica|specificando|riporta|riportando).{0,80}\b(?:esperienz[ae]|disponibilit[aà])\b/i },
    { label: 'progettazione REST API non supportata', pattern: /\b(?:progettazion[ei]|progettare|disegnare|design).{0,40}\bREST\s+API\b|\bREST\s+API\b.{0,40}\b(?:progettazion[ei]|progettare|disegnare|design)\b/i, supportPattern: /\b(?:progettazion[ei]|progettare|disegnare|design).{0,40}\bREST\s+API\b|\bREST\s+API\b.{0,40}\b(?:progettazion[ei]|progettare|disegnare|design)\b/i },
    { label: 'mantenimento database SQL non supportato', pattern: /\b(?:mantenimento|manutenzione|mantenere|gestione|gestire).{0,40}\bdatabase\s+SQL\b|\bdatabase\s+SQL\b.{0,40}\b(?:mantenimento|manutenzione|mantenere|gestione|gestire)\b/i, supportPattern: /\b(?:mantenimento|manutenzione|mantenere|gestione|gestire).{0,40}\bdatabase\s+SQL\b|\bdatabase\s+SQL\b.{0,40}\b(?:mantenimento|manutenzione|mantenere|gestione|gestire)\b/i },
    { label: 'regressioni non supportate', pattern: /\bregression[ei]\b/i, supportPattern: /\bregression[ei]\b/i },
    { label: 'decisioni architetturali non supportate', pattern: /\b(?:decisioni|scelte|allineare|allineamento|confronto).{0,60}\barchitettural[ie]\b|\barchitettural[ie]\b.{0,60}\b(?:decisioni|scelte|allineare|allineamento|confronto)\b/i, supportPattern: /\b(?:decisioni|scelte|allineare|allineamento|confronto).{0,60}\barchitettural[ie]\b|\barchitettural[ie]\b.{0,60}\b(?:decisioni|scelte|allineare|allineamento|confronto)\b/i },
    { label: 'decisioni tecniche non supportate', pattern: /\bprendere\s+decisioni\s+tecniche\b|\bdecisioni\s+tecniche\b/i, supportPattern: /\bprendere\s+decisioni\s+tecniche\b|\bdecisioni\s+tecniche\b/i },
    { label: 'procedure operative non supportate', pattern: /\bprocedure\s+(?:operative|specifiche|di\s+gestione)\b/i, supportPattern: /\bprocedure\s+(?:operative|specifiche|di\s+gestione)\b/i },
    { label: 'CCNL specifico inventato', pattern: /\bCCNL\s+(?:Commercio|Metalmeccanico|Terziario|Turismo|Logistica)\b/i, supportPattern: /\bCCNL\s+(?:Commercio|Metalmeccanico|Terziario|Turismo|Logistica)\b/i },
    { label: 'livello CCNL inventato', pattern: /\b(?:livello\s+\d+|[1-9][°º]\s*livello)\b/i },
    { label: 'minimo tabellare inventato', pattern: /\bminim[io]\s+tabellar[ei]\b/i },
  ];
  for (const item of unsupportedPatterns) {
    const supportPattern = item.supportPattern ?? item.pattern;
    if (item.pattern.test(text) && !supportPattern.test(known)) findings.push({ claim: `Claim non supportato: ${item.label}`, sourcePaths: [] });
  }
  findings.push(...detectUnsupportedEntitySetExpansions(master, roleCard));
  findings.push(...detectUngroundedOperationalRelationObjects(master, roleCard));
  return uniqueClaimFindings(findings);
}

function detectUnsupportedCandidateClaims(master: GeneratedAd, roleCard: RoleCard): string[] {
  return detectUnsupportedCandidateClaimFindings(master, roleCard).map((finding) => finding.claim);
}

function detectUnsupportedEntitySetExpansions(master: GeneratedAd, roleCard: RoleCard): UnsupportedCandidateClaimFinding[] {
  const known = knownCandidateText(roleCard);
  const concreteEntities = groundedSpecificInterlocutors(roleCard);
  if (!concreteEntities.length) return [];
  const findings: UnsupportedCandidateClaimFinding[] = [];
  for (const section of master.sections) {
    const sentences = `${section.title}. ${section.body}`
      .split(/(?<=[.!?])\s+|\n+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
    for (const sentence of sentences) {
      if (!hasUnsupportedEntitySetExpansion(sentence, known)) continue;
      findings.push({
        claim: `Claim non supportato: categoria di interlocutori più ampia delle entità dichiarate nella frase "${sentence}". Sostituire la categoria ampia con ${joinItalianList(concreteEntities)} o rimuoverla.`,
        sourcePaths: [section.id],
      });
    }
  }
  return findings;
}

function hasUnsupportedEntitySetExpansion(value: string, knownCandidateFacts: string): boolean {
  return ENTITY_SET_EXPANSION_PATTERNS.some((pattern) => pattern.test(value) && !pattern.test(knownCandidateFacts));
}

const ENTITY_SET_EXPANSION_PATTERNS = [
  /\b(?:altr[ie]|divers[ie]|vari[eo]|pi[uù])\s+reparti\b/i,
  /\breparti\s+aziendali\b/i,
  /\b(?:altr[ie]|divers[ie]|vari[eo]|pi[uù])\s+team\b/i,
  /\bteam\s+aziendali\b/i,
  /\b(?:funzioni|aree)\s+aziendali\b/i,
  /\b(?:diverse|varie)\s+(?:funzioni|aree)\s+dell[’']azienda\b/i,
  /\bstakeholder(?:\s+(?:interni|esterni|tecnici|business|aziendali|interni\s+ed\s+esterni|tecnici\s+e\s+business))?\b/i,
];

function detectUngroundedOperationalRelationObjects(master: GeneratedAd, roleCard: RoleCard): UnsupportedCandidateClaimFinding[] {
  const knownTokens = new Set(semanticCandidateTokens(knownCandidateText(roleCard)));
  const findings: UnsupportedCandidateClaimFinding[] = [];
  for (const section of master.sections) {
    const sentences = `${section.title}. ${section.body}`
      .split(/(?<=[.!?])\s+|\n+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
    for (const sentence of sentences) {
      if (!OPERATIONAL_RELATION_SENTENCE_PATTERN.test(sentence)) continue;
      for (const { verb, phrase } of extractOperationalRelationPurposeClauses(sentence)) {
        const unsupported = unsupportedOperationalObjectTokens(phrase, knownTokens);
        const purposeSupported = operationalRelationPurposeSupported(verb, phrase, roleCard);
        if (!unsupported.length && purposeSupported) continue;
        findings.push({
          claim: `Outcome o oggetto operativo non supportato nella frase "${sentence}": ${(unsupported.length ? unsupported : semanticCandidateTokens(`${verb} ${phrase}`)).join(', ')}. Sostituire con concetti presenti nel Truth Ledger o rimuovere il dettaglio.`,
          sourcePaths: [section.id],
        });
      }
    }
  }
  return findings;
}

const OPERATIONAL_RELATION_SENTENCE_PATTERN = /\b(?:collabor|coordina|confront|chiarir|chiarisc|verific|segnal|interlocutor|ufficio|autist|team|responsabile)/i;

function extractOperationalRelationObjectPhrases(sentence: string): string[] {
  return extractOperationalRelationPurposeClauses(sentence).map((clause) => clause.phrase);
}

function extractOperationalRelationPurposeClauses(sentence: string): Array<{ verb: string; phrase: string }> {
  const phrases: Array<{ verb: string; phrase: string }> = [];
  const patterns = [
    /\bper\s+(gestire|chiarire|verificare|coordinare|seguire|organizzare|monitorare|garantire|controllare|risolvere|decidere|definire)\s+([^.;:]+)/gi,
  ];
  for (const pattern of patterns) {
    for (const match of sentence.matchAll(pattern)) {
      const verb = String(match[1] ?? '').trim();
      const phrase = String(match[2] ?? '').trim();
      if (verb && phrase) phrases.push({ verb, phrase });
    }
  }
  return phrases;
}

function operationalRelationPurposeSupported(verb: string, phrase: string, roleCard: RoleCard): boolean {
  if (isHighAgencyRelationPurposeVerb(verb) && !hasExplicitRelationPurposeFact(verb, phrase, roleCard)) return false;
  const purposeTokens = semanticCandidateTokens(`${verb} ${phrase}`).filter((token) => !RELATION_PURPOSE_NEUTRAL_TOKENS.has(token));
  if (!purposeTokens.length) return true;
  return collectCriticalCandidateFacts(roleCard).some((fact) => {
    const factTokens = new Set(semanticCandidateTokens(fact.expected));
    return purposeTokens.every((token) => operationalObjectTokenSupported(token, factTokens));
  });
}

function isHighAgencyRelationPurposeVerb(verb: string): boolean {
  return /\b(?:gestire|coordinare|organizzare|monitorare|garantire|controllare|risolvere|decidere|definire)\b/i.test(verb);
}

function hasExplicitRelationPurposeFact(verb: string, phrase: string, roleCard: RoleCard): boolean {
  const expectedPurpose = normalizeRelationPurposeComparable(`${verb} ${phrase}`);
  return collectCriticalCandidateFacts(roleCard).some((fact) => normalizeRelationPurposeComparable(fact.expected).includes(expectedPurpose));
}

function normalizeRelationPurposeComparable(value: string): string {
  return normalizeCandidateFactComparableText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(?:il|lo|la|i|gli|le|un|uno|una|con|per|di|del|della|delle|dei|degli)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function unsupportedOperationalObjectTokens(phrase: string, knownTokens: Set<string>): string[] {
  return semanticCandidateTokens(phrase)
    .filter((token) => !RELATION_PURPOSE_NEUTRAL_TOKENS.has(token))
    .filter((token) => !operationalObjectTokenSupported(token, knownTokens));
}

const RELATION_PURPOSE_NEUTRAL_TOKENS = new Set([
  'attivita', 'aziend', 'azienda', 'bisogno', 'chiari', 'chiarimenti', 'collabor', 'confront',
  'corrett', 'emergono', 'eventuali', 'necess', 'operativ', 'problemi',
  'quando', 'richieste', 'serve', 'servono', 'situaz', 'team',
]);

function operationalObjectTokenSupported(token: string, knownTokens: Set<string>): boolean {
  if (knownTokens.has(token)) return true;
  if (token === 'discrep' && (knownTokens.has('differe') || knownTokens.has('errori'))) return true;
  if (token === 'differe' && knownTokens.has('discrep')) return true;
  return OPERATIONAL_TOKEN_EQUIVALENCE_GROUPS.some((group) => group.has(token) && [...group].some((equivalent) => knownTokens.has(equivalent)));
}

const OPERATIONAL_TOKEN_EQUIVALENCE_GROUPS = [
  new Set(['program', 'previst', 'pianif', 'comunicat']),
  new Set(['discrep', 'differe', 'errori']),
];

function uniqueClaimFindings(items: readonly UnsupportedCandidateClaimFinding[]): UnsupportedCandidateClaimFinding[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.claim}:${item.sourcePaths.join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return item.claim.trim().length > 0;
  });
}

function roleHasConfirmedTraining(roleCard: RoleCard): boolean {
  const known = [
    ...roleCard.attractionContext.attractivenessEvidence.map((fact) => fact.value),
  ].filter(Boolean).join(' ');
  return /\b(?:formazione|onboarding|affiancamento|training|passaggio di consegne|tutoraggio|mentoring)\b/i.test(known);
}

function roleHasConfirmedSafety(roleCard: RoleCard): boolean {
  return /\b(?:in\s+sicurezza|in\s+modo\s+sicur[oaie]?|sicurezz[ao]?|sicur[oaie]|DPI|antinfortunistich[eo]|normativ[ae]\s+di\s+sicurezza|procedure\s+(?:di\s+)?sicurezza|procedure\s+di\s+gestione)\b/i.test(JSON.stringify(roleCard));
}

function exposesTrainableAsCandidateCopy(value: string, roleCard: RoleCard): boolean {
  const suspectSentences = value
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((item) => item.trim())
    .filter((item) => /\b(?:familiarit[aà]|conoscenza\s+utile|utile\s+(?:la\s+)?familiarit[aà]|non\s+serve|non\s+[eè]\s+necessario|non\s+[eè]\s+richiest[ao]|apprend|acquisit|procedure interne|architettura|flusso|processi interni|strumenti proprietari)\b/i.test(item))
    .filter((item) => !isPreferredCandidateFacingSentence(item, roleCard));
  if (!suspectSentences.length) return false;
  return roleCard.requirements
    .filter((requirement) => requirement.classification === 'TRAINABLE')
    .some((requirement) => suspectSentences.some((sentence) => {
      const candidateTokens = new Set(semanticCandidateTokens(sentence));
      const tokens = semanticCandidateTokens(requirement.label.value);
      if (!tokens.length) return false;
      const overlap = tokens.filter((token) => candidateTokens.has(token)).length;
      return overlap >= Math.min(2, tokens.length);
    }));
}

function isPreferredCandidateFacingSentence(sentence: string, roleCard: RoleCard): boolean {
  if (!/\b(?:preferibil[ei]|preferit[ioae]|gradit[ioae]|plus|non obbligator[ioae]|non sono obbligator[ioae]|rappresentano un vantaggio)\b/i.test(sentence)) return false;
  const sentenceTokens = new Set(semanticCandidateTokens(sentence));
  return roleCard.requirements
    .filter((requirement) => requirement.classification === 'PREFERRED')
    .some((requirement) => {
      const tokens = semanticCandidateTokens(requirement.label.value);
      if (!tokens.length) return false;
      const overlap = tokens.filter((token) => sentenceTokens.has(token)).length;
      return overlap >= Math.min(2, tokens.length);
    });
}

function dedupeClaims(claims: Annunci10xValidateOutput['claims']): Annunci10xValidateOutput['claims'] {
  const seen = new Set<string>();
  return claims.filter((claim) => {
    const key = `${claim.claim}:${claim.sourcePaths.join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueStrings(items: readonly string[]): string[] {
  return [...new Set(items.filter((item) => item.trim().length > 0))];
}

type CanonicalFact = { value: string; sourceIds: string[] };

function publishableFact(fact: Fact<string> | undefined): CanonicalFact | null {
  if (!fact?.publishable) return null;
  const value = String(fact.value ?? '').trim();
  if (!value || isUnknownCandidateValue(value)) return null;
  return { value, sourceIds: fact.sourceId ? [fact.sourceId] : [] };
}

function isUnknownCandidateValue(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === 'n/d'
    || normalized.startsWith('n/d -')
    || normalized === 'da definire'
    || normalized === 'da chiarire'
    || normalized === 'non dichiarato'
    || normalized === 'non dichiarata'
    || normalized === 'non dichiarati'
    || normalized === 'non dichiarate'
    || normalized === 'non specificato'
    || normalized === 'non specificata'
    || normalized === 'non specificati'
    || normalized === 'non specificate'
    || normalized === 'non disponibile'
    || normalized === 'non lo so'
    || normalized.startsWith('non lo so /')
    || normalized === 'open_decision';
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
  roleCard: RoleCard,
): Pick<Annunci10xReviseOutput, 'revisedSections' | 'changedSectionIds'> {
  const revisedSections = [...revision.revisedSections];
  const changedSectionIds = [...revision.changedSectionIds];
  const revisedIds = new Set(revisedSections.map((section) => section.id));
  const changedIds = new Set(changedSectionIds);

  for (const claim of validation.claims) {
    const cited = sectionsReferencedByClaim(currentSections, claim);
    if (claim.action === 'REMOVE' && isUngroundedOperationalRelationClaim(claim.claim)) {
      const targets = cited.length ? cited : currentSections.filter((section) => sectionHasUngroundedOperationalRelation(section, roleCard));
      for (const section of targets) {
        const replacement = repairUngroundedOperationalRelationSection(section, claim.claim, roleCard);
        if (!replacement || replacement.body === section.body) continue;
        upsertRevisedSection(revisedSections, changedSectionIds, revisedIds, changedIds, replacement);
      }
      continue;
    }
    if (claim.action === 'REMOVE' && isUnsupportedEntitySetExpansionClaim(claim.claim)) {
      const targets = cited.length ? cited : currentSections.filter((section) => sectionHasUnsupportedEntitySetExpansion(section, roleCard));
      for (const section of targets) {
        const replacement = repairEntitySetExpansionSection(section, roleCard);
        if (!replacement || replacement.body === section.body) continue;
        upsertRevisedSection(revisedSections, changedSectionIds, revisedIds, changedIds, replacement);
      }
      continue;
    }
    if (claim.action === 'REMOVE' && (isMissingDataDisclosureClaim(claim.claim) || cited.some((section) => containsMissingDataDisclosure(section.body)))) {
      const targets = cited.length ? cited : currentSections.filter((section) => containsMissingDataDisclosure(section.body));
      for (const section of targets) {
        const replacement = repairMissingDataDisclosureSection(section);
        if (!replacement || replacement.body === section.body) continue;
        upsertRevisedSection(revisedSections, changedSectionIds, revisedIds, changedIds, replacement);
      }
      continue;
    }
    if (claim.action === 'REMOVE' && (isPreferredRequirementConsequenceClaim(claim.claim) || cited.some((section) => hasUnsupportedPreferredRequirementConsequence(section.body, roleCard)))) {
      const targets = cited.length ? cited : currentSections.filter((section) => hasUnsupportedPreferredRequirementConsequence(section.body, roleCard));
      for (const section of targets) {
        const replacement = repairPreferredRequirementConsequenceSection(section, roleCard);
        if (!replacement || replacement.body === section.body) continue;
        upsertRevisedSection(revisedSections, changedSectionIds, revisedIds, changedIds, replacement);
      }
      continue;
    }
    if (claim.kind !== 'EDITORIAL' || claim.action !== 'REMOVE') continue;
    const ctaCandidates = cited.length ? cited : currentSections;
    const application = ctaCandidates.find((section) => section.type === 'APPLICATION' && isMechanicalApplicationCta(section.body));
    if (application && isMechanicalApplicationCtaClaim(claim.claim)) {
      const replacement = {
        ...application,
        body: 'Se questa posizione ti interessa, inviaci la tua candidatura.',
      };
      upsertRevisedSection(revisedSections, changedSectionIds, revisedIds, changedIds, replacement);
      continue;
    }
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

  for (const originalSection of currentSections) {
    const section = revisedSections.find((item) => item.id === originalSection.id) ?? originalSection;
    if (section.type === 'APPLICATION' && isMechanicalApplicationCta(section.body)) {
      upsertRevisedSection(revisedSections, changedSectionIds, revisedIds, changedIds, {
        ...section,
        body: 'Se questa posizione ti interessa, inviaci la tua candidatura.',
      });
      continue;
    }
    const withoutUngroundedRelationPurpose = repairUngroundedOperationalRelationSectionFromEvidence(section, roleCard);
    if (withoutUngroundedRelationPurpose && withoutUngroundedRelationPurpose.body !== section.body) {
      upsertRevisedSection(revisedSections, changedSectionIds, revisedIds, changedIds, withoutUngroundedRelationPurpose);
      continue;
    }
    const withoutEntitySetExpansion = repairEntitySetExpansionSection(section, roleCard);
    if (withoutEntitySetExpansion && withoutEntitySetExpansion.body !== section.body) {
      upsertRevisedSection(revisedSections, changedSectionIds, revisedIds, changedIds, withoutEntitySetExpansion);
      continue;
    }
    const withoutDisclosure = repairMissingDataDisclosureSection(section);
    if (withoutDisclosure && withoutDisclosure.body !== section.body) {
      upsertRevisedSection(revisedSections, changedSectionIds, revisedIds, changedIds, withoutDisclosure);
      continue;
    }
    const withoutPreferredConsequence = repairPreferredRequirementConsequenceSection(section, roleCard);
    if (withoutPreferredConsequence && withoutPreferredConsequence.body !== section.body) {
      upsertRevisedSection(revisedSections, changedSectionIds, revisedIds, changedIds, withoutPreferredConsequence);
    }
  }

  return { revisedSections, changedSectionIds };
}

function sectionsReferencedByClaim(
  sections: GeneratedAd['sections'],
  claim: Annunci10xValidateOutput['claims'][number],
): GeneratedAd['sections'] {
  return sections.filter((section) => claim.sourcePaths.some((path) => path === section.id || path.startsWith(`${section.id}.`) || path.includes(section.id)));
}

function upsertRevisedSection(
  revisedSections: GeneratedAd['sections'],
  changedSectionIds: string[],
  revisedIds: Set<string>,
  changedIds: Set<string>,
  replacement: GeneratedAd['sections'][number],
): void {
  const replacementIndex = revisedSections.findIndex((section) => section.id === replacement.id);
  if (replacementIndex >= 0) revisedSections[replacementIndex] = replacement;
  else revisedSections.push(replacement);
  revisedIds.add(replacement.id);
  if (!changedIds.has(replacement.id)) {
    changedSectionIds.push(replacement.id);
    changedIds.add(replacement.id);
  }
}

function sectionHasUngroundedOperationalRelation(section: GeneratedAd['sections'][number], roleCard: RoleCard): boolean {
  return detectUngroundedOperationalRelationObjects({
    id: 'section-check',
    sessionId: 'section-check',
    kind: 'MASTER',
    sections: [section],
    sourceOfTruth: true,
    generatedAt: '',
    promptVersion: '',
  }, roleCard).length > 0;
}

function isUngroundedOperationalRelationClaim(value: string): boolean {
  return /\bOutcome o oggetto operativo non supportato\b/i.test(value);
}

function sectionHasUnsupportedEntitySetExpansion(section: GeneratedAd['sections'][number], roleCard: RoleCard): boolean {
  return detectUnsupportedEntitySetExpansions({
    id: 'section-check',
    sessionId: 'section-check',
    kind: 'MASTER',
    sections: [section],
    sourceOfTruth: true,
    generatedAt: '',
    promptVersion: '',
  }, roleCard).length > 0;
}

function isUnsupportedEntitySetExpansionClaim(value: string): boolean {
  return /\bcategoria di interlocutori pi[uù] ampia\b|interlocutori o reparti non supportati/i.test(value);
}

function isMissingDataDisclosureClaim(value: string): boolean {
  return /\b(?:missing[-\s]?data|placeholder|dato\s+mancante|lacune?|non\s+sono\s+stat[ei]\s+dichiarat[ei]|non\s+vengono\s+indicat[ei]|non\s+abbiamo\s+informazioni|non\s+[eè]\s+specificat[oaie]|non\s+sono\s+disponibili\s+dettagli|informazioni\s+non\s+(?:presenti|disponibili|fornite)|condizioni\s+economiche\s+specifiche|benefit)\b/i.test(value);
}

function containsMissingDataDisclosure(value: string): boolean {
  return splitSentences(value).some(isMissingDataDisclosureSentence)
    || value.split('\n').some((line) => isMissingDataDisclosureSentence(line));
}

function repairMissingDataDisclosureSection(section: GeneratedAd['sections'][number]): GeneratedAd['sections'][number] | null {
  const repairedBody = removeSentences(section.body, isMissingDataDisclosureSentence);
  return repairedBody === section.body ? null : { ...section, body: repairedBody };
}

function isMissingDataDisclosureSentence(value: string): boolean {
  return /\b(?:non\s+sono\s+stat[ei]\s+dichiarat[ei]|non\s+vengono\s+indicat[ei]|non\s+abbiamo\s+informazioni|non\s+[eè]\s+specificat[oaie]|non\s+sono\s+disponibili\s+dettagli|informazioni\s+non\s+(?:presenti|disponibili|fornite)|dettagli\s+non\s+(?:presenti|disponibili|forniti)|nessun[oa]\s+benefit\s+dichiarat[oa]|benefit\s+non\s+dichiarat[ioaie]|condizioni\s+economiche\s+specifiche\s+o\s+benefit)\b/i.test(value);
}

function isPreferredRequirementConsequenceClaim(value: string): boolean {
  return /\b(?:requisit[io]\s+preferenzial[ei]|preferred|gradit[ioa]|non\s+obbligator[ioa]|valore\s+aggiunto|facilit|tempi?\s+di\s+inserimento|inserimento\s+operativ[oa]|vantaggio\s+pratico)\b/i.test(value);
}

function repairPreferredRequirementConsequenceSection(
  section: GeneratedAd['sections'][number],
  roleCard: RoleCard,
): GeneratedAd['sections'][number] | null {
  const repairedBody = repairSentences(section.body, (sentence) => {
    if (!hasUnsupportedPreferredRequirementConsequence(sentence, roleCard)) return sentence;
    return removePreferredRequirementConsequence(sentence, roleCard);
  });
  return repairedBody === section.body ? null : { ...section, body: repairedBody };
}

function removePreferredRequirementConsequence(sentence: string, roleCard: RoleCard): string {
  const preferredRequirements = roleCard.requirements.filter((requirement) => requirement.classification === 'PREFERRED');
  const colonIndex = sentence.indexOf(':');
  if (colonIndex >= 0) {
    const beforeColon = sentence.slice(0, colonIndex).trim();
    const afterColon = sentence.slice(colonIndex + 1);
    if (hasPreferredRequirementReference(beforeColon, preferredRequirements) && hasPreferredRequirementConsequencePhrase(afterColon)) {
      return ensureSentencePunctuation(beforeColon);
    }
  }
  const consequenceStart = sentence.search(/\s(?:,?\s*perch[eé]\s+|e\s+)?(?:entrambi|quest[ioa] requisit[io]|quest[ea] competenz[ae]|quest[oa] element[oi]|il\s+patentino|l['’]esperienza)?\s*(?:possono?|pu[oò]|potranno|serve|servono|aiutano?|aiuta|facilitano?|facilita|riduce|riducono|accelera|accelerano|consente|consentono|permette|permettono|rappresenta|rappresentano|rendono|rende|rendere)\b/i);
  if (consequenceStart > 0) {
    const candidate = sentence.slice(0, consequenceStart).replace(/[,:;\s]+$/, '').trim();
    if (hasPreferredRequirementReference(candidate, preferredRequirements)) return ensureSentencePunctuation(candidate);
  }
  if (hasPreferredRequirementConsequencePhrase(sentence)) return '';
  return sentence;
}

function removeSentences(value: string, shouldRemove: (sentence: string) => boolean): string {
  return repairSentences(value, (sentence) => shouldRemove(sentence) ? '' : sentence);
}

function repairSentences(value: string, repair: (sentence: string) => string): string {
  return value
    .split(/(\n+)/)
    .map((part) => part.includes('\n')
      ? part
      : splitSentences(part).map(repair).filter(Boolean).join(' '))
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function ensureSentencePunctuation(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function repairUngroundedOperationalRelationSection(
  section: GeneratedAd['sections'][number],
  claim: string,
  roleCard: RoleCard,
): GeneratedAd['sections'][number] | null {
  const unsupportedTokens = unsupportedTokensFromOperationalClaim(claim);
  if (!unsupportedTokens.length) return null;
  const supportedObjectText = groundedOperationalObjectText(roleCard);
  if (!supportedObjectText) return null;
  const repairedBody = section.body
    .split(/(\n+)/)
    .map((part) => part.includes('\n') ? part : repairUngroundedOperationalRelationText(part, unsupportedTokens, supportedObjectText))
    .join('');
  return repairedBody === section.body ? null : { ...section, body: repairedBody };
}

function repairUngroundedOperationalRelationSectionFromEvidence(
  section: GeneratedAd['sections'][number],
  roleCard: RoleCard,
): GeneratedAd['sections'][number] | null {
  let repaired = repairUnsupportedRelationPurposeClauses(section, roleCard) ?? section;
  for (const finding of detectUngroundedOperationalRelationObjects({
    id: 'section-check',
    sessionId: 'section-check',
    kind: 'MASTER',
    sections: [repaired],
    sourceOfTruth: true,
    generatedAt: '',
    promptVersion: '',
  }, roleCard)) {
    repaired = repairUngroundedOperationalRelationSection(repaired, finding.claim, roleCard) ?? repaired;
  }
  return repaired.body === section.body ? null : repaired;
}

function repairEntitySetExpansionSection(
  section: GeneratedAd['sections'][number],
  roleCard: RoleCard,
): GeneratedAd['sections'][number] | null {
  const repairedBody = repairSentences(section.body, (sentence) => {
    if (!hasUnsupportedEntitySetExpansion(sentence, knownCandidateText(roleCard))) return sentence;
    return groundedEntitySetReplacementSentence(sentence, roleCard);
  });
  return repairedBody === section.body ? null : { ...section, body: repairedBody };
}

function groundedEntitySetReplacementSentence(sentence: string, roleCard: RoleCard): string {
  const entities = groundedSpecificInterlocutors(roleCard);
  if (!entities.length) return sentence;
  const entityList = joinItalianList(entities);
  if (/\bscambi\s+operativi\b/i.test(sentence)) return `Nel lavoro avrai scambi operativi con ${entityList}.`;
  if (/\bcollabor/i.test(sentence)) return `Collaborerai con ${entityList}.`;
  if (/\bconfront/i.test(sentence)) return `Ti confronterai con ${entityList}.`;
  return `Nel lavoro interagirai con ${entityList}.`;
}

function groundedSpecificInterlocutors(roleCard: RoleCard): string[] {
  const known = knownCandidateText(roleCard).toLowerCase();
  const candidates = [
    'altri sviluppatori',
    'responsabile prodotto',
    'responsabile logistico',
    'responsabile commerciale',
    'responsabile amministrativo',
    'responsabile di sala',
    'autisti',
    'ufficio amministrativo',
    'ufficio ordini',
    'sviluppatori',
    'fornitori',
    'clienti',
    'cucina',
    'bar',
    'amministrazione',
    'commerciale',
    'acquisti',
    'colleghi',
  ];
  const found: string[] = [];
  for (const candidate of candidates) {
    if (!new RegExp(`\\b${escapeRegExp(candidate).replace(/\s+/g, '\\s+')}\\b`, 'i').test(known)) continue;
    if (found.some((item) => item.includes(candidate) || candidate.includes(item))) {
      if (candidate.length > Math.max(...found.filter((item) => item.includes(candidate) || candidate.includes(item)).map((item) => item.length))) {
        for (let index = found.length - 1; index >= 0; index -= 1) {
          if (found[index]?.includes(candidate) || candidate.includes(found[index] ?? '')) found.splice(index, 1);
        }
        found.push(candidate);
      }
      continue;
    }
    found.push(candidate);
  }
  return found.slice(0, 4);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function repairUnsupportedRelationPurposeClauses(
  section: GeneratedAd['sections'][number],
  roleCard: RoleCard,
): GeneratedAd['sections'][number] | null {
  const repairedBody = repairSentences(section.body, (sentence) => {
    if (!OPERATIONAL_RELATION_SENTENCE_PATTERN.test(sentence)) return sentence;
    let repaired = sentence;
    for (const match of sentence.matchAll(/\s+per\s+(gestire|chiarire|verificare|coordinare|seguire|organizzare|monitorare|garantire|controllare|risolvere|decidere|definire)\s+[^.;:!?]+/gi)) {
      const fullMatch = String(match[0] ?? '');
      const verb = String(match[1] ?? '');
      const phrase = fullMatch.replace(/^\s+per\s+\S+\s+/i, '').trim();
      if (!verb || !phrase || operationalRelationPurposeSupported(verb, phrase, roleCard)) continue;
      repaired = repaired.replace(fullMatch, '');
    }
    return repaired.replace(/\s{2,}/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();
  });
  return repairedBody === section.body ? null : { ...section, body: repairedBody };
}

function repairUngroundedOperationalRelationText(value: string, unsupportedTokens: readonly string[], supportedObjectText: string): string {
  return value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => {
      if (!sentenceContainsAnySemanticToken(sentence, unsupportedTokens)) return sentence;
      const repairedProcess = sentence.replace(
        /\bper\s+(?:risolvere|gestire|decidere|definire|coordinare|organizzare|monitorare|garantire|controllare)\s+[^.;:!?]+/i,
        `per chiarire ${supportedObjectText}`,
      );
      if (repairedProcess !== sentence) return repairedProcess;
      return sentence.replace(
        /\bper\s+(?:chiarire|verificare|seguire)\s+[^.;:!?]+/i,
        `per chiarire ${supportedObjectText}`,
      );
    })
    .join(' ');
}

function unsupportedTokensFromOperationalClaim(claim: string): string[] {
  const match = claim.match(/:\s*([^".]+)\.\s+Sostituire/i);
  if (!match) return [];
  return semanticCandidateTokens(match[1]);
}

function sentenceContainsAnySemanticToken(sentence: string, tokens: readonly string[]): boolean {
  const sentenceTokens = new Set(semanticCandidateTokens(sentence));
  return tokens.some((token) => sentenceTokens.has(token));
}

function groundedOperationalObjectText(roleCard: RoleCard): string {
  const known = knownCandidateText(roleCard);
  const supported: string[] = [];
  if (/\bquantit[aà]\b/i.test(known)) supported.push('quantità');
  if (/\barticol[io]\b/i.test(known)) supported.push('articoli');
  if (/\bdiscrepanz[ae]\b|\bdifferenz[ae]\b/i.test(known)) supported.push('discrepanze');
  if (!supported.length && /\bordini?\b/i.test(known)) supported.push('ordini');
  if (!supported.length) return '';
  if (supported.length === 1) return supported[0]!;
  return `${supported.slice(0, -1).join(', ')} o ${supported[supported.length - 1]}`;
}

function isMechanicalApplicationCtaClaim(value: string): boolean {
  return /\b(?:CTA|candidatura|candidarsi|chiusura|application).{0,120}(?:canale dell[’']annuncio|canale indicato|placeholder|meccanic[ao])\b/i.test(value)
    || /\bCTA\s+(?:[eè]\s+)?meccanic[ao]\b/i.test(value)
    || /\b(?:canale dell[’']annuncio|canale indicato nell[’']annuncio)\b/i.test(value);
}

function isMechanicalApplicationCta(value: string): boolean {
  const normalized = value.trim();
  return /^(?:Candidatura:\s*)?(?:Candidatura\s+)?tramite il canale dell[’']annuncio\.?$/i.test(normalized)
    || /^(?:Per candidarti,\s*)?(?:utilizza|usa|segui)\s+il\s+canale\s+(?:indicato|previsto)\s+nell[’']annuncio\.?$/i.test(normalized)
    || /\b(?:candidatura|candidat[ioe]|candidarsi|invio candidatura).{0,80}(?:tramite il canale dell[’']annuncio|canale indicato nell[’']annuncio|nell[’']annuncio)\b/i.test(normalized);
}

function normalizeEditorialText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

const CANDIDATE_FACT_STOP_WORDS = new Set([
  'alla', 'alle', 'allo', 'anche', 'come', 'con', 'dalla', 'dalle', 'dello', 'della', 'delle', 'degli',
  'dentro', 'dopo', 'durante', 'essere', 'fino', 'gli', 'nella', 'nelle', 'nello', 'oltre', 'per', 'piu',
  'sono', 'sulla', 'sulle', 'sullo', 'tra', 'una', 'uno', 'questa', 'questo', 'azienda', 'ruolo',
]);

function isCandidateFactSemanticallyRepresented(master: GeneratedAd, expected: string, sourceIds: readonly string[], kind = ''): boolean {
  const expectedTokens = semanticCandidateTokens(expected);
  if (!expectedTokens.length) return true;

  const allText = masterText(master);
  const linkedText = sourceIds.length
    ? master.sections
      .filter((section) => section.sourceFactIds.some((sourceId) => sourceIds.includes(sourceId)))
      .map((section) => `${section.title} ${section.body}`)
      .join(' ')
    : '';

  const isCompositeRequirement = kind.startsWith('requirement:');
  const linkedRatio = kind === 'mission' || kind === 'outcome' ? 0.25 : isCompositeRequirement ? 0.25 : 0.35;
  const globalRatio = kind === 'mission' || kind === 'outcome' ? 0.32 : isCompositeRequirement ? 0.35 : 0.5;

  return candidateTextCoversFact(linkedText, expectedTokens, expected, linkedRatio)
    || candidateTextCoversFact(allText, expectedTokens, expected, globalRatio);
}

function candidateTextCoversFact(candidateText: string, expectedTokens: readonly string[], expectedRaw: string, ratio: number): boolean {
  if (!candidateText.trim()) return false;
  const comparableExpected = normalizeCandidateFactComparableText(expectedRaw);
  const comparableCandidate = normalizeCandidateFactComparableText(candidateText);
  const candidateTokens = new Set(semanticCandidateTokens(comparableCandidate));
  const expectedNumbers = [...new Set((comparableExpected.match(/\b\d+(?:[.,]\d+)?\b/g) ?? []).map((value) => value.toLowerCase()))];
  const candidateNumbers = new Set((comparableCandidate.match(/\b\d+(?:[.,]\d+)?\b/g) ?? []).map((value) => value.toLowerCase()));
  if (expectedNumbers.some((value) => !candidateNumbers.has(value))) return false;

  const overlap = expectedTokens.filter((token) => candidateTokens.has(token)).length;
  const required = expectedTokens.length <= 3
    ? Math.min(2, expectedTokens.length)
    : Math.max(2, Math.ceil(expectedTokens.length * ratio));
  return overlap >= required;
}

function semanticCandidateTokens(value: string): string[] {
  const normalized = normalizeCandidateFactComparableText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const tokens = normalized.match(/[a-z0-9]+/g) ?? [];
  return [...new Set(tokens
    .filter((token) => (/^\d+$/.test(token) || token.length >= 3) && !CANDIDATE_FACT_STOP_WORDS.has(token))
    .map((token) => /^\d+$/.test(token) || token.length <= 7 ? token : token.slice(0, 7)))];
}

function normalizeCandidateFactComparableText(value: string): string {
  return value
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, '-')
    .replace(/\u00a0/g, ' ');
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
