import { randomUUID } from 'node:crypto';
import {
  ANNUNCI10X_DATA_CONTRACT_VERSION,
  ANNUNCI10X_METHOD_VERSION,
  ANNUNCI10X_PROMPT_PACK_VERSION,
  ANNUNCI10X_RUBRIC_VERSION,
  ANNUNCI10X_STRATEGY_VERSION,
} from './constants.ts';
import { Annunci10xAiOrchestrator } from './ai/orchestrator.ts';
import { resolveAnnunci10xCommercial, type Annunci10xCommercialOffer } from './commercial.ts';
import type { Annunci10xProfileOutput, Annunci10xStrategyOutput } from './ai/schemas.ts';
import { deriveAnnunci10xStrategyRules, type StrategyRuleInput } from './strategy-rules.ts';
import { canTransition } from './state-machine.ts';
import { createFact } from './validation.ts';
import type { AppendAnswerInput, PersistedAnnunci10xSession, PersistedAnswer, PersistedSnapshot } from './persistence/types.ts';
import type { CommunicationStrategy, Fact, PublicationChannel, Requirement, RequirementClassification, RoleCard, RoleProfile, SessionState } from './types.ts';
import {
  Annunci10xPublicError,
  createAnnunci10xRuntimeContext,
  createOpenDecisionCommercialContext,
  type Annunci10xConfiguredProvider,
  type Annunci10xRuntimeContext,
  type Annunci10xSessionCookie,
  type PublicAnnunci10xOperation,
} from './product-flow.ts';

export const ANNUNCI10X_CREATE_STEPS = [
  'ROLE_CONTEXT',
  'PRIMARY_CONTRIBUTION',
  'WORK_REALITY',
  'REQUIREMENTS',
  'ATTRACTION',
  'OFFER',
  'CHANNEL_APPLICATION',
] as const;

export type Annunci10xCreateStepId = (typeof ANNUNCI10X_CREATE_STEPS)[number];

export interface PublicAnnunci10xCreateState {
  sessionId: string;
  flow: 'CREATE';
  state: SessionState;
  provider: Annunci10xConfiguredProvider;
  currentStep: Annunci10xCreateStepId | 'SUMMARY' | 'COMMERCIAL';
  completedSteps: Annunci10xCreateStepId[];
  completion: { answered: number; total: number; coverage: number };
  roleCard: PublicCreateRoleCard;
  strategy: PublicCreateStrategy | null;
  clarification: PublicCreateClarification | null;
  canConfirm: boolean;
  paymentRequired: boolean;
  commercial: {
    checkoutEnabled: false;
    price: 'OPEN_DECISION';
    discountValue: 'OPEN_DECISION';
    entitlements: 'SERVER_VERIFIED_OPEN_DECISION';
    pricingStatus: 'OPEN_DECISION';
    availableOffers: Annunci10xCommercialOffer[];
    entitlementSummary: {
      guide: boolean;
      adGenerationCredits: number;
      source: string;
    };
  };
  operations: PublicAnnunci10xOperation[];
  updatedAt: string;
}

export interface PublicCreateRoleCard {
  title: string;
  mission: string;
  outcomes: string[];
  responsibilities: string[];
  requirements: { label: string; classification: string }[];
  location: string;
  workMode: string;
  contractType: string;
  schedule: string;
  compensation: string;
  attractionEvidence: string[];
  channel: PublicationChannel | null;
  missingFacts: string[];
}

export interface PublicCreateStrategy {
  summary: string;
  candidateAngle: string;
  channelPriorities: PublicationChannel[];
  riskNotes: string[];
  missingFacts: string[];
}

export interface PublicCreateClarification {
  id: string;
  targetPath: string;
  question: string;
  reason: string;
  blocking: boolean;
  canAdvance: boolean;
}

export interface StartCreateSessionInput {
  context?: Annunci10xRuntimeContext;
}

export interface AnswerCreateStepInput {
  sessionId: string;
  sessionSecret: string;
  stepId: Annunci10xCreateStepId;
  answer: string;
  context?: Annunci10xRuntimeContext;
}

export interface ClarifyCreateInput {
  sessionId: string;
  sessionSecret: string;
  clarificationId: string;
  answer: string;
  context?: Annunci10xRuntimeContext;
}

export interface EditCreateInput {
  sessionId: string;
  sessionSecret: string;
  targetPath: string;
  value: string;
  context?: Annunci10xRuntimeContext;
}

export interface ConfirmCreateInput {
  sessionId: string;
  sessionSecret: string;
  context?: Annunci10xRuntimeContext;
}

export async function createAnonymousCreateSession(context: Annunci10xRuntimeContext): Promise<{ session: PersistedAnnunci10xSession; sessionSecret: string }> {
  const created = await context.persistence.createSession({
    flow: 'CREATE',
    commercialContext: createOpenDecisionCommercialContext(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
  });
  const session = await context.persistence.updateSession({
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    state: 'COLLECTING',
  });
  await context.persistence.appendEvent({ sessionId: session.id, eventName: 'session_started', metadata: { entryMode: 'CREATE', provider: context.configuredProvider } });
  await context.persistence.appendEvent({ sessionId: session.id, eventName: 'flow_selected', metadata: { flow: 'CREATE' } });
  await context.persistence.appendEvent({ sessionId: session.id, eventName: 'interview_step_started', metadata: { flow: 'CREATE', step: ANNUNCI10X_CREATE_STEPS[0] } });
  return { session, sessionSecret: created.sessionSecret };
}

export async function startAnnunci10xCreate(input: StartCreateSessionInput = {}): Promise<{ cookie: Annunci10xSessionCookie; result: PublicAnnunci10xCreateState }> {
  const context = input.context ?? createAnnunci10xRuntimeContext();
  const created = await createAnonymousCreateSession(context);
  const result = await publicCreateState({
    context,
    sessionId: created.session.id,
    sessionSecret: created.sessionSecret,
    operations: [],
  });
  return {
    cookie: { sessionId: created.session.id, sessionSecret: created.sessionSecret },
    result,
  };
}

export async function answerAnnunci10xCreateStep(input: AnswerCreateStepInput): Promise<PublicAnnunci10xCreateState> {
  const context = input.context ?? createAnnunci10xRuntimeContext();
  const answer = input.answer.trim();
  if (!answer) throw new Annunci10xPublicError('INVALID_INPUT', 'Inserisci una risposta per continuare.', 400);
  assertCreateStep(input.stepId);
  const session = await requireCreateSession(context, input.sessionId, input.sessionSecret);
  if (session.state === 'PAYMENT_REQUIRED') throw new Annunci10xPublicError('INVALID_INPUT', 'La scheda e gia stata confermata.', 409);

  await context.persistence.appendAnswer({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    interviewStep: mapCreateStepToPersistence(input.stepId),
    questionId: createQuestionId(input.stepId),
    rawAnswer: answer,
  });
  await context.persistence.appendEvent({
    sessionId: input.sessionId,
    eventName: 'answer_saved',
    metadata: { flow: 'CREATE', step: input.stepId, lengthBucket: bucketLength(answer), answerKind: isUnknownAnswer(answer) ? 'UNKNOWN' : 'TEXT' },
  });

  const operations: PublicAnnunci10xOperation[] = [];
  const orchestrator = new Annunci10xAiOrchestrator({ provider: context.provider, persistence: context.persistence });
  const currentAnswers = await context.persistence.getAnswers(input.sessionId, input.sessionSecret);
  const previousSnapshot = await context.persistence.getLatestSnapshot(input.sessionId, input.sessionSecret);
  const extract = await orchestrator.runTask({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    operationType: 'EXTRACT',
    input: {
      userAnswers: [{ stepId: input.stepId, answer }],
      existingRoleCard: previousSnapshot?.roleCard ?? null,
    },
    inputSnapshotId: previousSnapshot?.id ?? null,
    promptVersionOverride: `${ANNUNCI10X_PROMPT_PACK_VERSION}.create.${input.stepId.toLowerCase()}`,
  });
  operations.push(toPublicOperation(extract, 'EXTRACT', context.configuredProvider));

  const roleCard = buildCreateRoleCard(currentAnswers);
  let snapshot = await context.persistence.appendSnapshot({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    roleCard,
    roleProfile: previousSnapshot?.roleProfile ? { ...previousSnapshot.roleProfile, roleCard } : null,
    communicationStrategy: previousSnapshot?.communicationStrategy ?? null,
    reason: 'USER_ANSWER',
  });
  await context.persistence.updateSession({ sessionId: input.sessionId, sessionSecret: input.sessionSecret, currentSnapshotId: snapshot.id });

  const localClarification = deriveBlockingClarification(currentAnswers);
  if (localClarification) {
    const clarify = await orchestrator.runTask({
      sessionId: input.sessionId,
      sessionSecret: input.sessionSecret,
      operationType: 'CLARIFY',
      input: { currentStep: input.stepId, roleCard, unresolvedConflicts: [{ targetPath: localClarification.targetPath, values: ['remoto', 'presenza'], reason: localClarification.reason }] },
      inputSnapshotId: snapshot.id,
      promptVersionOverride: `${ANNUNCI10X_PROMPT_PACK_VERSION}.create.clarify`,
    });
    operations.push(toPublicOperation(clarify, 'CLARIFY', context.configuredProvider));
    await context.persistence.updateSession({ sessionId: input.sessionId, sessionSecret: input.sessionSecret, state: 'CLARIFYING' });
    await context.persistence.appendEvent({ sessionId: input.sessionId, eventName: 'clarification_requested', metadata: { targetPath: localClarification.targetPath, step: input.stepId } });
  } else if (isRoleCardReady(currentAnswers, roleCard)) {
    const enriched = await enrichCreateArtifacts({ context, sessionId: input.sessionId, sessionSecret: input.sessionSecret, roleCard, snapshot, operations });
    snapshot = enriched.snapshot;
    await context.persistence.updateSession({ sessionId: input.sessionId, sessionSecret: input.sessionSecret, state: 'ROLE_CARD_READY', currentSnapshotId: snapshot.id });
    await context.persistence.appendEvent({ sessionId: input.sessionId, eventName: 'role_card_ready', metadata: { flow: 'CREATE', coverage: 100 } });
  } else {
    await context.persistence.updateSession({ sessionId: input.sessionId, sessionSecret: input.sessionSecret, state: 'COLLECTING', currentSnapshotId: snapshot.id });
  }

  return publicCreateState({ context, sessionId: input.sessionId, sessionSecret: input.sessionSecret, operations });
}

export async function clarifyAnnunci10xCreate(input: ClarifyCreateInput): Promise<PublicAnnunci10xCreateState> {
  const context = input.context ?? createAnnunci10xRuntimeContext();
  const answer = input.answer.trim();
  if (!answer) throw new Annunci10xPublicError('INVALID_INPUT', 'Rispondi al chiarimento o indica che non lo sai.', 400);
  await requireCreateSession(context, input.sessionId, input.sessionSecret);
  const answers = await context.persistence.getAnswers(input.sessionId, input.sessionSecret);
  const clarification = deriveBlockingClarification(answers);
  if (!clarification || clarification.id !== input.clarificationId) throw new Annunci10xPublicError('INVALID_INPUT', 'Chiarimento non attivo.', 409);

  await context.persistence.appendAnswer({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    interviewStep: 'CONDITIONS',
    questionId: `create.clarify.${clarification.targetPath}`,
    clarificationId: input.clarificationId,
    rawAnswer: answer,
  });
  await context.persistence.appendEvent({ sessionId: input.sessionId, eventName: 'clarification_answered', metadata: { targetPath: clarification.targetPath, answerKind: isUnknownAnswer(answer) ? 'UNKNOWN' : 'TEXT' } });

  const allAnswers = await context.persistence.getAnswers(input.sessionId, input.sessionSecret);
  const roleCard = buildCreateRoleCard(allAnswers);
  let snapshot = await context.persistence.appendSnapshot({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    roleCard,
    reason: 'USER_ANSWER',
  });
  const operations: PublicAnnunci10xOperation[] = [];
  if (isRoleCardReady(allAnswers, roleCard)) {
    const enriched = await enrichCreateArtifacts({ context, sessionId: input.sessionId, sessionSecret: input.sessionSecret, roleCard, snapshot, operations });
    snapshot = enriched.snapshot;
    await context.persistence.updateSession({ sessionId: input.sessionId, sessionSecret: input.sessionSecret, state: 'ROLE_CARD_READY', currentSnapshotId: snapshot.id });
  } else {
    await context.persistence.updateSession({ sessionId: input.sessionId, sessionSecret: input.sessionSecret, state: 'COLLECTING', currentSnapshotId: snapshot.id });
  }
  return publicCreateState({ context, sessionId: input.sessionId, sessionSecret: input.sessionSecret, operations });
}

export async function editAnnunci10xCreate(input: EditCreateInput): Promise<PublicAnnunci10xCreateState> {
  const context = input.context ?? createAnnunci10xRuntimeContext();
  const value = input.value.trim();
  if (!value) throw new Annunci10xPublicError('INVALID_INPUT', 'Inserisci il nuovo valore.', 400);
  const session = await requireCreateSession(context, input.sessionId, input.sessionSecret);
  if (!['ROLE_CARD_READY', 'USER_CONFIRMED', 'PAYMENT_REQUIRED'].includes(session.state)) {
    throw new Annunci10xPublicError('INVALID_INPUT', 'La scheda non e ancora pronta per modifiche puntuali.', 409);
  }
  const latest = await context.persistence.getLatestSnapshot(input.sessionId, input.sessionSecret);
  if (!latest) throw new Annunci10xPublicError('INVALID_INPUT', 'Nessuna scheda da modificare.', 409);

  const operations: PublicAnnunci10xOperation[] = [];
  let editIntent = 'STRUCTURED_FIELD';
  if (!isDeterministicEditTarget(input.targetPath)) {
    const orchestrator = new Annunci10xAiOrchestrator({ provider: context.provider, persistence: context.persistence });
    const classified = await orchestrator.runTask({
      sessionId: input.sessionId,
      sessionSecret: input.sessionSecret,
      operationType: 'EDIT_CLASSIFIER',
      input: { editRequest: `${input.targetPath}: ${value}`, roleCard: latest.roleCard, currentMaster: null },
      inputSnapshotId: latest.id,
    });
    operations.push(toPublicOperation(classified, 'EDIT_CLASSIFIER', context.configuredProvider));
    editIntent = typeof classified.output.intent === 'string' ? classified.output.intent : 'CLASSIFIED_EDIT';
  }

  await context.persistence.appendAnswer({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    interviewStep: stepFromPath(input.targetPath),
    questionId: `create.edit.${input.targetPath}`,
    rawAnswer: value,
  });
  const roleCard = applyEditToRoleCard(latest.roleCard, input.targetPath, value);
  const snapshot = await context.persistence.appendSnapshot({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    roleCard,
    roleProfile: latest.roleProfile ? { ...latest.roleProfile, roleCard } : null,
    communicationStrategy: latest.communicationStrategy ?? null,
    reason: 'USER_EDIT',
  });
  await context.persistence.updateSession({ sessionId: input.sessionId, sessionSecret: input.sessionSecret, state: 'ROLE_CARD_READY', currentSnapshotId: snapshot.id });
  await context.persistence.appendEvent({ sessionId: input.sessionId, eventName: 'role_card_edited', metadata: { targetPath: input.targetPath, intent: editIntent } });
  return publicCreateState({ context, sessionId: input.sessionId, sessionSecret: input.sessionSecret, operations });
}

export async function confirmAnnunci10xCreate(input: ConfirmCreateInput): Promise<PublicAnnunci10xCreateState> {
  const context = input.context ?? createAnnunci10xRuntimeContext();
  const session = await requireCreateSession(context, input.sessionId, input.sessionSecret);
  const answers = await context.persistence.getAnswers(input.sessionId, input.sessionSecret);
  const latest = await context.persistence.getLatestSnapshot(input.sessionId, input.sessionSecret);
  const roleCard = confirmRoleCard(latest?.roleCard ?? buildCreateRoleCard(answers));
  const blocking = deriveBlockingClarification(answers);
  if (!isRoleCardReady(answers, roleCard)) throw new Annunci10xPublicError('INVALID_INPUT', 'Completa tutti gli step prima della conferma.', 409);
  if (blocking) throw new Annunci10xPublicError('INVALID_INPUT', 'Risolvi il chiarimento bloccante prima della conferma.', 409);

  const toConfirmed = canTransition(session.state, 'USER_CONFIRMED', { flow: 'CREATE', roleCard, openClarifications: [] });
  if (!toConfirmed.allowed && session.state !== 'USER_CONFIRMED') throw new Annunci10xPublicError('INVALID_INPUT', toConfirmed.reason ?? 'Transizione non consentita.', 409);
  await context.persistence.updateSession({ sessionId: input.sessionId, sessionSecret: input.sessionSecret, state: 'USER_CONFIRMED' });
  const snapshot = await context.persistence.appendSnapshot({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    roleCard,
    roleProfile: latest?.roleProfile ? { ...latest.roleProfile, roleCard } : null,
    communicationStrategy: latest?.communicationStrategy ?? null,
    reason: 'USER_CONFIRMATION',
  });
  const toPayment = canTransition('USER_CONFIRMED', 'PAYMENT_REQUIRED', { flow: 'CREATE', roleCard, openClarifications: [] });
  if (!toPayment.allowed) throw new Annunci10xPublicError('INVALID_INPUT', toPayment.reason ?? 'Pre-payment non disponibile.', 409);
  await context.persistence.updateSession({ sessionId: input.sessionId, sessionSecret: input.sessionSecret, state: 'PAYMENT_REQUIRED', currentSnapshotId: snapshot.id });
  await context.persistence.appendEvent({ sessionId: input.sessionId, eventName: 'user_confirmed', metadata: { flow: 'CREATE' } });
  await context.persistence.appendEvent({ sessionId: input.sessionId, eventName: 'payment_required', metadata: { checkoutEnabled: false, price: 'OPEN_DECISION' } });
  return publicCreateState({ context, sessionId: input.sessionId, sessionSecret: input.sessionSecret, operations: [] });
}

export async function resumeAnnunci10xCreate(cookie: Annunci10xSessionCookie, context: Annunci10xRuntimeContext): Promise<PublicAnnunci10xCreateState | null> {
  const session = await context.persistence.getSession(cookie.sessionId, cookie.sessionSecret);
  if (!session || session.flow !== 'CREATE') return null;
  await context.persistence.appendEvent({ sessionId: cookie.sessionId, eventName: 'create_resumed', metadata: { hasCurrentSnapshot: Boolean(session.currentSnapshotId) } });
  return publicCreateState({ context, sessionId: cookie.sessionId, sessionSecret: cookie.sessionSecret, operations: [] });
}

async function publicCreateState(input: {
  context: Annunci10xRuntimeContext;
  sessionId: string;
  sessionSecret: string;
  operations: PublicAnnunci10xOperation[];
}): Promise<PublicAnnunci10xCreateState> {
  const session = await requireCreateSession(input.context, input.sessionId, input.sessionSecret);
  const answers = await input.context.persistence.getAnswers(input.sessionId, input.sessionSecret);
  const snapshot = await input.context.persistence.getLatestSnapshot(input.sessionId, input.sessionSecret);
  const roleCard = snapshot?.roleCard ?? buildCreateRoleCard(answers);
  const completedSteps = completedCreateSteps(answers);
  const clarification = deriveBlockingClarification(answers);
  const ready = isRoleCardReady(answers, roleCard) && !clarification;
  const commercial = await resolveAnnunci10xCommercial({
    subject: { kind: 'SESSION', sessionId: input.sessionId },
    flow: 'CREATE',
    journeyState: session.state,
  });
  return {
    sessionId: input.sessionId,
    flow: 'CREATE',
    state: session.state,
    provider: input.context.configuredProvider,
    currentStep: session.state === 'PAYMENT_REQUIRED' ? 'COMMERCIAL' : ready ? 'SUMMARY' : nextCreateStep(completedSteps),
    completedSteps,
    completion: {
      answered: completedSteps.length,
      total: ANNUNCI10X_CREATE_STEPS.length,
      coverage: Math.round((completedSteps.length / ANNUNCI10X_CREATE_STEPS.length) * 100),
    },
    roleCard: publicRoleCard(roleCard, session.selectedChannel ?? channelFromAnswers(answers)),
    strategy: snapshot?.communicationStrategy ? publicStrategy(snapshot.communicationStrategy) : null,
    clarification,
    canConfirm: session.state === 'ROLE_CARD_READY' && ready,
    paymentRequired: session.state === 'PAYMENT_REQUIRED',
    commercial: {
      checkoutEnabled: false,
      price: 'OPEN_DECISION',
      discountValue: 'OPEN_DECISION',
      entitlements: 'SERVER_VERIFIED_OPEN_DECISION',
      pricingStatus: commercial.pricingStatus,
      availableOffers: commercial.availableOffers,
      entitlementSummary: {
        guide: commercial.entitlements.guide,
        adGenerationCredits: commercial.entitlements.adGenerationCredits,
        source: commercial.entitlements.source,
      },
    },
    operations: input.operations,
    updatedAt: session.updatedAt,
  };
}

async function enrichCreateArtifacts(input: {
  context: Annunci10xRuntimeContext;
  sessionId: string;
  sessionSecret: string;
  roleCard: RoleCard;
  snapshot: PersistedSnapshot;
  operations: PublicAnnunci10xOperation[];
}): Promise<{ snapshot: PersistedSnapshot }> {
  const orchestrator = new Annunci10xAiOrchestrator({ provider: input.context.provider, persistence: input.context.persistence });
  const profileTask = await orchestrator.runTask({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    operationType: 'PROFILE',
    input: { roleCard: input.roleCard },
    inputSnapshotId: input.snapshot.id,
  });
  input.operations.push(toPublicOperation(profileTask, 'PROFILE', input.context.configuredProvider));
  const roleProfile = buildRoleProfile(input.roleCard, profileTask.output as Annunci10xProfileOutput);
  const strategyTask = await orchestrator.runTask({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    operationType: 'STRATEGY',
    input: { roleCard: input.roleCard, roleProfile, strategyRules: strategyRulesFromProfile(roleProfile), channel: 'LINKEDIN' },
    inputSnapshotId: input.snapshot.id,
  });
  input.operations.push(toPublicOperation(strategyTask, 'STRATEGY', input.context.configuredProvider));
  const strategy = normalizeStrategy((strategyTask.output as Annunci10xStrategyOutput).communicationStrategy, input.sessionId);
  const snapshot = await input.context.persistence.appendSnapshot({
    sessionId: input.sessionId,
    sessionSecret: input.sessionSecret,
    roleCard: input.roleCard,
    roleProfile,
    communicationStrategy: strategy,
    reason: 'USER_ANSWER',
  });
  return { snapshot };
}

async function requireCreateSession(context: Annunci10xRuntimeContext, sessionId: string, sessionSecret: string): Promise<PersistedAnnunci10xSession> {
  const session = await context.persistence.getSession(sessionId, sessionSecret);
  if (!session) throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione Annunci 10x non valida o scaduta.', 401);
  if (session.flow !== 'CREATE') throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione non compatibile con Crea da zero.', 409);
  return session;
}

function buildCreateRoleCard(answers: PersistedAnswer[]): RoleCard {
  const role = answerFor(answers, 'ROLE_CONTEXT');
  const contribution = answerFor(answers, 'PRIMARY_CONTRIBUTION');
  const work = answerFor(answers, 'WORK_REALITY');
  const requirements = answerFor(answers, 'REQUIREMENTS');
  const attraction = answerFor(answers, 'ATTRACTION');
  const offer = answerFor(answers, 'OFFER');
  const clarificationWorkMode = answerForQuestion(answers, 'create.clarify.attractionContext.workMode');
  const title = clean(extractAfter(role, ['ruolo', 'figura', 'cerco', 'cerchiamo'])) || clean(role.split(/[.\n]/)[0]) || 'Ruolo da chiarire';
  const mission = clean(extractAfter(contribution, ['risultato principale', 'missione', 'obiettivo', 'contributo'])) || clean(contribution.split(/[.\n]/)[0]) || 'N/D - contributo da chiarire';
  const responsibility = clean(extractAfter(work, ['attivita reali', 'attività reali', 'attivita', 'attività'])) || clean(work.split(/[.\n]/)[0]) || 'N/D - lavoro quotidiano da chiarire';
  const channel = channelFromAnswers(answers);
  return {
    title: fact(title, sourceFor(role), 'create-role-title', Boolean(role)),
    mission: fact(mission, sourceFor(contribution), 'create-mission', Boolean(contribution)),
    outcomes: [fact(mission, sourceFor(contribution), 'create-outcome', Boolean(contribution))],
    responsibilities: [fact(responsibility, sourceFor(work), 'create-responsibility', Boolean(work))],
    requirements: requirementsFromText(requirements),
    compensation: {
      visibility: fact(hasCompensation(offer) ? 'PUBLIC' : 'OPEN_DECISION', hasCompensation(offer) ? 'USER_DECLARED' : 'SYSTEM_INFERRED', 'create-compensation-visibility', hasCompensation(offer)) as never,
      amountText: hasCompensation(offer) ? fact(extractCompensation(offer), 'USER_DECLARED', 'create-compensation') : undefined,
    },
    attractionContext: {
      companyName: extractCompany(role) ? fact(extractCompany(role), 'USER_DECLARED', 'create-company') : undefined,
      companyDescription: clean(role) ? fact(clean(role), 'USER_DECLARED', 'create-company-description') : undefined,
      workMode: workModeFromText(clarificationWorkMode || offer || work),
      location: locationFromText(role || offer || work),
      contractType: contractFromText(offer),
      schedule: scheduleFromText(offer || work),
      attractivenessEvidence: [fact(clean(attraction) || 'N/D - elemento attrattivo da chiarire', sourceFor(attraction), 'create-attraction', Boolean(attraction))],
      teamContext: clean(extractAfter(work, ['team', 'squadra'])) ? fact(clean(extractAfter(work, ['team', 'squadra'])), 'USER_DECLARED', 'create-team') : undefined,
    },
    ...(channel ? {} : {}),
  };
}

function isRoleCardReady(answers: PersistedAnswer[], roleCard: RoleCard): boolean {
  return completedCreateSteps(answers).length === ANNUNCI10X_CREATE_STEPS.length
    && Boolean(roleCard.title && roleCard.mission && roleCard.outcomes.length && roleCard.responsibilities.length && roleCard.requirements.some((item) => item.classification === 'REQUIRED'));
}

function deriveBlockingClarification(answers: PersistedAnswer[]): PublicCreateClarification | null {
  if (answerForQuestion(answers, 'create.clarify.attractionContext.workMode')) return null;
  const text = `${answerFor(answers, 'WORK_REALITY')} ${answerFor(answers, 'OFFER')}`.toLowerCase();
  if (!/remot|smart working/.test(text) || !/presenza|in sede/.test(text)) return null;
  return {
    id: 'clarification-work-mode',
    targetPath: 'attractionContext.workMode',
    question: 'La posizione e in presenza, ibrida o da remoto?',
    reason: 'Nel percorso sono presenti indicazioni incompatibili sulla modalita di lavoro.',
    blocking: true,
    canAdvance: false,
  };
}

function confirmRoleCard(roleCard: RoleCard): RoleCard {
  const confirm = <T>(value: Fact<T> | undefined): Fact<T> | undefined => value ? { ...value, source: 'USER_CONFIRMED', status: 'CONFIRMED', confidence: Math.max(value.confidence ?? 80, 90), publishable: value.source !== 'SYSTEM_INFERRED' } : value;
  return {
    ...roleCard,
    title: confirm(roleCard.title),
    mission: confirm(roleCard.mission),
    outcomes: roleCard.outcomes.map((item) => confirm(item) as Fact<string>),
    responsibilities: roleCard.responsibilities.map((item) => confirm(item) as Fact<string>),
    requirements: roleCard.requirements.map((item) => ({ ...item, label: confirm(item.label) as Fact<string> })),
    compensation: roleCard.compensation ? {
      ...roleCard.compensation,
      amountText: confirm(roleCard.compensation.amountText),
      visibility: confirm(roleCard.compensation.visibility) as never,
    } : undefined,
    attractionContext: {
      ...roleCard.attractionContext,
      companyName: confirm(roleCard.attractionContext.companyName),
      companyDescription: confirm(roleCard.attractionContext.companyDescription),
      workMode: confirm(roleCard.attractionContext.workMode),
      location: confirm(roleCard.attractionContext.location),
      contractType: confirm(roleCard.attractionContext.contractType),
      schedule: confirm(roleCard.attractionContext.schedule),
      teamContext: confirm(roleCard.attractionContext.teamContext),
      attractivenessEvidence: roleCard.attractionContext.attractivenessEvidence.map((item) => confirm(item) as Fact<string>),
    },
  };
}

function applyEditToRoleCard(roleCard: RoleCard, targetPath: string, value: string): RoleCard {
  const next = fact(value, 'USER_DECLARED', `create-edit-${stableShortId(targetPath)}`);
  if (targetPath === 'title') return { ...roleCard, title: next };
  if (targetPath === 'mission') return { ...roleCard, mission: next, outcomes: [next] };
  if (targetPath === 'responsibilities') return { ...roleCard, responsibilities: [next] };
  if (targetPath === 'requirements') return { ...roleCard, requirements: [{ id: 'req-create-1', label: next, classification: 'REQUIRED' }] };
  if (targetPath === 'attractionContext.location') return { ...roleCard, attractionContext: { ...roleCard.attractionContext, location: next } };
  if (targetPath === 'attractionContext.workMode') return { ...roleCard, attractionContext: { ...roleCard.attractionContext, workMode: next } };
  if (targetPath === 'attractionContext.contractType') return { ...roleCard, attractionContext: { ...roleCard.attractionContext, contractType: next } };
  if (targetPath === 'compensation.amountText') return { ...roleCard, compensation: { ...roleCard.compensation, visibility: fact('PUBLIC', 'USER_DECLARED', 'create-edit-compensation-visibility') as never, amountText: next } };
  return { ...roleCard, attractionContext: { ...roleCard.attractionContext, attractivenessEvidence: [next] } };
}

function isDeterministicEditTarget(targetPath: string): boolean {
  return [
    'title',
    'mission',
    'responsibilities',
    'requirements',
    'attractionContext.location',
    'attractionContext.workMode',
    'attractionContext.contractType',
    'compensation.amountText',
  ].includes(targetPath);
}

function buildRoleProfile(roleCard: RoleCard, profile: Annunci10xProfileOutput): RoleProfile {
  const levelFact = (value: string, sourceId: string) => createFact(value, 'SYSTEM_INFERRED', { sourceId, publishable: false, confidence: 70 }) as never;
  return {
    roleCard,
    rolePopularity: levelFact(profile.demand.level === 'UNKNOWN' ? 'UNKNOWN' : 'MEDIUM', 'create-profile-demand'),
    companyAttractiveness: levelFact('UNKNOWN', 'create-profile-company'),
    challengeLevel: levelFact(profile.challengeRoutine.label === 'CHALLENGE' ? 'HIGH' : profile.challengeRoutine.label === 'ROUTINE' ? 'LOW' : 'MEDIUM', 'create-profile-challenge'),
    routineLevel: levelFact(profile.challengeRoutine.label === 'ROUTINE' ? 'HIGH' : profile.challengeRoutine.label === 'CHALLENGE' ? 'LOW' : 'MEDIUM', 'create-profile-routine'),
    qualificationLevel: levelFact(profile.qualification.level, 'create-profile-qualification'),
    commitmentLevel: levelFact('MEDIUM', 'create-profile-commitment'),
    technicality: levelFact(profile.technicality.level, 'create-profile-technicality'),
  };
}

function strategyRulesFromProfile(roleProfile: RoleProfile): ReturnType<typeof deriveAnnunci10xStrategyRules> {
  return deriveAnnunci10xStrategyRules({
    rolePopularity: textValue(roleProfile.rolePopularity) as StrategyRuleInput['rolePopularity'],
    demand: textValue(roleProfile.rolePopularity) as StrategyRuleInput['demand'],
    workReality: textValue(roleProfile.challengeLevel) === 'HIGH' ? 'CHALLENGE' : textValue(roleProfile.routineLevel) === 'HIGH' ? 'ROUTINE' : 'MIXED',
    qualification: textValue(roleProfile.qualificationLevel) as StrategyRuleInput['qualification'],
    technicality: textValue(roleProfile.technicality) as StrategyRuleInput['technicality'],
    companyAttractiveness: textValue(roleProfile.companyAttractiveness) as StrategyRuleInput['companyAttractiveness'],
    offerStrength: 'MEDIUM',
  });
}

function normalizeStrategy(strategy: CommunicationStrategy, sessionId: string): CommunicationStrategy {
  return {
    ...strategy,
    id: strategy.id || randomUUID(),
    sessionId,
    versions: versions(),
  };
}

function publicRoleCard(roleCard: RoleCard, channel: PublicationChannel | null): PublicCreateRoleCard {
  return {
    title: textValue(roleCard.title),
    mission: textValue(roleCard.mission),
    outcomes: roleCard.outcomes.map(textValue),
    responsibilities: roleCard.responsibilities.map(textValue),
    requirements: roleCard.requirements.map((item) => ({ label: textValue(item.label), classification: item.classification })),
    location: textValue(roleCard.attractionContext.location),
    workMode: textValue(roleCard.attractionContext.workMode),
    contractType: textValue(roleCard.attractionContext.contractType),
    schedule: textValue(roleCard.attractionContext.schedule),
    compensation: roleCard.compensation?.amountText ? textValue(roleCard.compensation.amountText) : textValue(roleCard.compensation?.visibility),
    attractionEvidence: roleCard.attractionContext.attractivenessEvidence.map(textValue),
    channel,
    missingFacts: missingFacts(roleCard),
  };
}

function publicStrategy(strategy: CommunicationStrategy): PublicCreateStrategy {
  return {
    summary: strategy.summary,
    candidateAngle: strategy.candidateAngle,
    channelPriorities: strategy.channelPriorities,
    riskNotes: strategy.riskNotes,
    missingFacts: strategy.missingFacts.map((item) => item.question),
  };
}

function completedCreateSteps(answers: PersistedAnswer[]): Annunci10xCreateStepId[] {
  return ANNUNCI10X_CREATE_STEPS.filter((step) => Boolean(answerFor(answers, step)));
}

function nextCreateStep(completed: Annunci10xCreateStepId[]): Annunci10xCreateStepId {
  return ANNUNCI10X_CREATE_STEPS.find((step) => !completed.includes(step)) ?? ANNUNCI10X_CREATE_STEPS[ANNUNCI10X_CREATE_STEPS.length - 1];
}

function answerFor(answers: PersistedAnswer[], stepId: Annunci10xCreateStepId): string {
  return [...answers].reverse().find((answer) => answer.questionId === createQuestionId(stepId))?.rawAnswer ?? '';
}

function answerForQuestion(answers: PersistedAnswer[], questionId: string): string {
  return [...answers].reverse().find((answer) => answer.questionId === questionId)?.rawAnswer ?? '';
}

function createQuestionId(stepId: Annunci10xCreateStepId): string {
  return `create.${stepId.toLowerCase()}`;
}

function mapCreateStepToPersistence(stepId: Annunci10xCreateStepId): AppendAnswerInput['interviewStep'] {
  if (stepId === 'ROLE_CONTEXT') return 'ROLE';
  if (stepId === 'PRIMARY_CONTRIBUTION' || stepId === 'WORK_REALITY') return 'OUTCOMES';
  if (stepId === 'REQUIREMENTS') return 'REQUIREMENTS';
  if (stepId === 'ATTRACTION') return 'ATTRACTION';
  if (stepId === 'OFFER') return 'CONDITIONS';
  return 'CHANNEL';
}

function assertCreateStep(stepId: string): asserts stepId is Annunci10xCreateStepId {
  if (!ANNUNCI10X_CREATE_STEPS.includes(stepId as Annunci10xCreateStepId)) throw new Annunci10xPublicError('INVALID_INPUT', 'Step Crea da zero non valido.', 400);
}

function stepFromPath(path: string): AppendAnswerInput['interviewStep'] {
  if (path.includes('compensation') || path.includes('contract') || path.includes('schedule')) return 'CONDITIONS';
  if (path.includes('requirements')) return 'REQUIREMENTS';
  if (path.includes('attraction')) return 'ATTRACTION';
  if (path.includes('responsibilities') || path.includes('mission')) return 'OUTCOMES';
  return 'ROLE';
}

const requirementLabelMap: { classification: RequirementClassification; labels: string[] }[] = [
  { classification: 'REQUIRED', labels: ['indispensabili', 'indispensabile', 'obbligatori', 'obbligatorio', 'required'] },
  { classification: 'PREFERRED', labels: ['preferenziali', 'preferenziale', 'preferibili', 'preferibile', 'preferred'] },
  { classification: 'TRAINABLE', labels: ['apprendibili', 'apprendibile', 'formabili', 'formabile', 'trainable'] },
  { classification: 'DISQUALIFYING', labels: ['disqualifying', 'vincoli escludenti', 'vincolo escludente', 'vincoli', 'vincolo'] },
];

function requirementsFromText(text: string): Requirement[] {
  const requirements = requirementLabelMap.flatMap((definition) => {
    const value = extractLabeledSegment(text, definition.labels);
    if (!value || isUnknownAnswer(value)) return [];
    return [{
      id: `req-create-${definition.classification.toLowerCase()}`,
      label: fact(value, 'USER_DECLARED', `create-requirement-${definition.classification.toLowerCase()}`),
      classification: definition.classification,
    }];
  });
  if (requirements.some((item) => item.classification === 'REQUIRED')) return requirements;
  const fallback = clean(text.split(/[.\n]/)[0]) || 'Requisiti da chiarire';
  return [{
    id: 'req-create-required',
    label: fact(fallback, sourceFor(text), 'create-requirement-required', Boolean(text)),
    classification: 'REQUIRED',
  }];
}

function extractLabeledSegment(text: string, labels: string[]): string {
  const normalized = text.replace(/\r/g, '\n');
  const allLabels = requirementLabelMap.flatMap((definition) => definition.labels).map(escapeRegExp).join('|');
  for (const label of labels) {
    const expression = new RegExp(`(?:^|[\\n.;])\\s*${escapeRegExp(label)}\\s*[:\\-]\\s*([\\s\\S]*?)(?=(?:[\\n.;]\\s*(?:${allLabels})\\s*[:\\-])|$)`, 'i');
    const match = normalized.match(expression);
    if (match?.[1]) return clean(match[1]);
  }
  return '';
}

function channelFromAnswers(answers: PersistedAnswer[]): PublicationChannel | null {
  const value = answerFor(answers, 'CHANNEL_APPLICATION').toLowerCase();
  if (/indeed/.test(value)) return 'INDEED';
  if (/ats/.test(value)) return 'ATS';
  if (/mail|email/.test(value)) return 'EMAIL';
  if (/custom|altro/.test(value)) return 'CUSTOM';
  if (/linkedin|linked ?in/.test(value)) return 'LINKEDIN';
  return null;
}

function fact(value: string, source: 'USER_DECLARED' | 'SYSTEM_INFERRED', sourceId: string, publishable = source !== 'SYSTEM_INFERRED'): Fact<string> {
  return createFact(clean(value) || 'N/D', source, { sourceId, publishable, confidence: source === 'SYSTEM_INFERRED' ? 35 : 82 });
}

function sourceFor(value: string): 'USER_DECLARED' | 'SYSTEM_INFERRED' {
  return value.trim() ? 'USER_DECLARED' : 'SYSTEM_INFERRED';
}

function textValue(factValue: { value?: unknown } | undefined): string {
  return factValue?.value ? String(factValue.value) : 'N/D';
}

function missingFacts(roleCard: RoleCard): string[] {
  const missing: string[] = [];
  if (!roleCard.attractionContext.location) missing.push('Sede');
  if (!roleCard.attractionContext.contractType) missing.push('Contratto');
  if (!roleCard.compensation?.amountText) missing.push('Compenso');
  if (!roleCard.attractionContext.workMode) missing.push('Modalita di lavoro');
  return missing;
}

function workModeFromText(text: string): Fact<string> | undefined {
  if (!text.trim()) return undefined;
  if (/ibrid[oa]/i.test(text)) return fact('Ibrido', 'USER_DECLARED', 'create-work-mode');
  if (/remot|smart working/i.test(text) && /presenza|in sede/i.test(text)) return fact('Da chiarire', 'SYSTEM_INFERRED', 'create-work-mode-conflict', false);
  if (/remot|smart working/i.test(text)) return fact('Remoto', 'USER_DECLARED', 'create-work-mode');
  if (/presenza|in sede/i.test(text)) return fact('In presenza', 'USER_DECLARED', 'create-work-mode');
  return undefined;
}

function locationFromText(text: string): Fact<string> | undefined {
  const match = text.match(/\b(?:a|sede di|zona)\s+([A-ZÀ-Ü][a-zà-ü]+(?:\s[A-ZÀ-Ü][a-zà-ü]+)?)/);
  return match?.[1] ? fact(match[1], 'USER_DECLARED', 'create-location') : undefined;
}

function contractFromText(text: string): Fact<string> | undefined {
  const match = text.match(/(tempo indeterminato|tempo determinato|part-?time|full-?time|stage|apprendistato|collaborazione|contratto [^\n.]{3,80})/i);
  return match?.[1] ? fact(match[1], 'USER_DECLARED', 'create-contract') : undefined;
}

function scheduleFromText(text: string): Fact<string> | undefined {
  const match = text.match(/(?:orario|turni|lunedi|lunedì|venerdi|venerdì|weekend)[^\n.]{0,100}/i);
  return match?.[0] ? fact(match[0], 'USER_DECLARED', 'create-schedule') : undefined;
}

function extractCompany(text: string): string {
  const match = text.match(/(?:azienda|societa|società|impresa)\s+([^.\n]{3,80})/i);
  return clean(match?.[1]);
}

function extractAfter(text: string, labels: string[]): string {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}[:\\s]+([^\\n.]{3,180})`, 'i'));
    if (match?.[1]) return clean(match[1]);
  }
  return '';
}

function hasCompensation(text: string): boolean {
  if (/(?:compenso|ral|stipendio|retribuzione)[^\n.]{0,60}(?:non lo so|da definire|n\/d)/i.test(text)) return false;
  return /\b(?:ral|stipendio|compenso|retribuzione|euro|€)\b/i.test(text);
}

function extractCompensation(text: string): string {
  const match = text.match(/(?:ral|stipendio|compenso|retribuzione)[^\n.]{0,120}|(?:€|euro)\s?[\d.,]+[^\n.]*/i);
  return clean(match?.[0]) || 'Compenso indicato';
}

function isUnknownAnswer(answer: string): boolean {
  return /non lo so|da chiarire|n\/d/i.test(answer);
}

function clean(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().replace(/[;:,.]+$/, '');
}

function bucketLength(text: string): string {
  const length = text.length;
  if (length < 80) return 'short';
  if (length < 400) return 'medium';
  return 'long';
}

function stableShortId(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
  return Math.abs(hash).toString(36);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
