import { createHash, randomUUID } from 'node:crypto';
import { pilotAvailability, pilotExperience, pilotForms, pilotGoals } from '../../content/patrimonial-funnels.ts';
import type { PatrimonialEdition, PatrimonialParticipation } from './patrimonial-contract.ts';
import { PatrimonialConflictError, type PatrimonialOpportunityStore } from './patrimonial-store.ts';

export const patrimonialPipelines = {
  ARCHITECT_PATH: { name: 'Percorso Architetto Patrimoniale', stages: { A01: 'Nuovo interesse', A02: 'Presentazione da prenotare', A03: 'Presentazione prenotata', A04: 'Da qualificare', A05: 'Colloquio da fissare', A06: 'Colloquio fissato', A07: 'Valutazione e prossimo passo', A08: 'Percorso avviato', A09: 'Architetto Patrimoniale attivato', A10: 'Chiuso senza attivazione' } },
  PATRIMONIAL_EVENT: { name: 'Evento Benessere Patrimoniale', stages: { E01: 'Richiesta di partecipazione', E02: 'Iscrizione confermata', E03: 'Esito da registrare', E04: 'Follow-up', E05: 'Conclusa' } },
  PATRIMONIAL_CONSULTATION: { name: 'Confronti Benessere Patrimoniale', stages: { C01: 'Appuntamento richiesto', C02: 'Appuntamento fissato', C03: 'Esito da registrare', C04: 'Approfondimento concordato', C05: 'Concluso' } },
} as const;
export type PatrimonialPipeline = keyof typeof patrimonialPipelines;
export type PatrimonialDomainStatus = 'OPEN' | 'WON' | 'LOST' | 'ABANDONED';
export const patrimonialProviderStatuses = { OPEN: 'open', WON: 'won', LOST: 'lost', ABANDONED: 'abandoned' } as const;
export const patrimonialNextSteps = ['ASSIGN', 'INVITE_PRESENTATION', 'BOOK_PRESENTATION', 'QUALIFY', 'BOOK_INTERVIEW', 'RECORD_OUTCOME', 'AGREE_PATH_START', 'CONFIRM_EDITION', 'RECORD_ATTENDANCE', 'FOLLOW_UP', 'BOOK_CONSULTATION', 'REVIEW', 'NONE'] as const;
export type PatrimonialNextStep = typeof patrimonialNextSteps[number];
export type PatrimonialActor = { id: string; type: 'SYSTEM' | 'OWNER' | 'HOST' | 'BOOKING' | 'INTERVIEWER' | 'APPROVER' };
export const architectCloseReasons = ['NOT_ELIGIBLE', 'NOT_INTERESTED', 'WITHDRAWN', 'UNREACHABLE_AFTER_REVIEW', 'DUPLICATE_MERGED', 'INVALID_REQUEST'] as const;
export const eventCloseReasons = ['ATTENDED_COMPLETE', 'NO_SHOW_CLOSED', 'CANCELLED', 'NOT_INTERESTED', 'EDITION_CANCELLED', 'UNCONFIRMABLE'] as const;
export const consultationCloseReasons = ['INFORMATION_PROVIDED', 'QUALIFIED_FOLLOW_UP', 'NOT_INTERESTED', 'OUT_OF_SCOPE', 'WITHDRAWN'] as const;
type CloseReason = typeof architectCloseReasons[number] | typeof eventCloseReasons[number] | typeof consultationCloseReasons[number];
export type PatrimonialRequestContext = {
  requestId: string; receivedAt: string; source: 'website-pilot' | 'legacy-information' | 'manual-request';
  sourcePath: string; privacyVersion: string; marketingConsent: boolean;
  utm: Partial<Record<'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_content' | 'utm_term', string>>;
};
export type PatrimonialBookingEvidence = { id: string; startsAt: string; confirmed: true };
type DomainEvent = { command: string; revision: number; cycle: number; at: string; actor: PatrimonialActor; evidenceId: string | null; facts: Record<string, string> };
type ArchitectDetails = {
  profile: string; salesExperience: string; goal: string; availability: string; openAnswer: string;
  presentation: PatrimonialBookingEvidence | null; presentationAttendance: 'UNKNOWN' | 'ATTENDED' | 'NO_SHOW' | 'CANCELLED';
  qualified: boolean; interview: PatrimonialBookingEvidence | null; interviewCompleted: boolean;
  interviewOutcome: 'PENDING' | 'PROCEED' | 'DO_NOT_PROCEED' | 'NEEDS_FOLLOW_UP';
  eligibility: 'PENDING' | 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'WITHDRAWN';
};
export type PatrimonialOpportunityIntent = {
  id: string; groupKey: string; businessKey: string; pipeline: PatrimonialPipeline;
  contactId: string; locationId: string; scopeKey: string; cycle: number; revision: number;
  stage: string; status: PatrimonialDomainStatus; ownerId: string | null;
  nextStep: PatrimonialNextStep; nextStepAt: string | null; closeReason: CloseReason | null;
  firstRequest: PatrimonialRequestContext; requestIds: string[]; ownerReviewRequired: boolean;
  architect: ArchitectDetails | null;
  consultation: { originEditionIds: string[]; explicitRequest: true; booking: PatrimonialBookingEvidence | null; completed: boolean; outcome: 'PENDING' | 'INFORMATION_PROVIDED' | 'QUALIFIED_FOLLOW_UP' | 'NOT_INTERESTED' | 'OUT_OF_SCOPE' } | null;
  events: DomainEvent[];
  closedCycles: { cycle: number; businessKey: string; stage: string; status: PatrimonialDomainStatus; reason: CloseReason | null; authorizedBy: PatrimonialActor; evidenceId: string }[];
  remote: { id: string; syncedRevision: number; pipelineId: string; stageId: string; status: string; version: string; assignedTo: string | null } | null;
};
export const patrimonialCommands = ['ARCHITECT_INTEREST_RECEIVED','ARCHITECT_PRESENTATION_INVITED','ARCHITECT_PRESENTATION_BOOKED','ARCHITECT_PRESENTATION_ATTENDED','ARCHITECT_PRESENTATION_NO_SHOW','ARCHITECT_QUALIFIED','ARCHITECT_INTERVIEW_REQUESTED','ARCHITECT_INTERVIEW_BOOKED','ARCHITECT_INTERVIEW_COMPLETED','ARCHITECT_ELIGIBILITY_SET','ARCHITECT_PATH_STARTED','ARCHITECT_ACTIVATED','ARCHITECT_CLOSED','EVENT_REQUEST_RECEIVED','EVENT_EDITION_SELECTED','EVENT_REGISTRATION_CONFIRMED','EVENT_COMPLETED','EVENT_ATTENDANCE_RECORDED','EVENT_PARTICIPATION_CANCELLED','EVENT_FOLLOWUP_STARTED','EVENT_CLOSED','CONSULTATION_REQUESTED','CONSULTATION_BOOKED','CONSULTATION_COMPLETED','CONSULTATION_FOLLOWUP_AGREED','CONSULTATION_CLOSED','CYCLE_REOPEN_AUTHORIZED'] as const;
export type PatrimonialRoutingParticipation = Omit<PatrimonialParticipation, 'editionId'> & {
  editionId: string | null; revision: number; relationId: string; eventSlug: string;
  edition: PatrimonialEdition | null; evidenceIds: string[]; supersededBy?: string;
};
export type PatrimonialCommand = {
  type: typeof patrimonialCommands[number]; expectedRevision: number; actor: PatrimonialActor; at: string;
  nextStep?: PatrimonialNextStep; nextStepAt?: string; evidenceId?: string;
  request?: PatrimonialRequestContext; qualification?: Partial<Pick<ArchitectDetails, 'profile' | 'salesExperience' | 'goal' | 'availability' | 'openAnswer'>>;
  booking?: PatrimonialBookingEvidence; rescheduleRequested?: boolean;
  eligibility?: ArchitectDetails['eligibility']; interviewOutcome?: ArchitectDetails['interviewOutcome'];
  criteriaVersion?: string; agreementEvidence?: string; startedAt?: string;
  reason?: CloseReason; trigger?: 'EXPLICIT_REQUEST' | 'AUTHORIZED_HUMAN'; originEditionId?: string;
  eventSlug?: string; edition?: PatrimonialEdition; participationId?: string; expectedParticipationRevision?: number;
  attendance?: PatrimonialParticipation['attendance']; declined?: boolean;
  confirmation?: { accessConfirmed: true; capacityApproved: true; identityConfirmed: true; purposeConfirmed: true };
};
export class PatrimonialTransitionError extends Error { constructor() { super('Invalid patrimonial domain command or prerequisites.'); } }
const requireDomain: (value: unknown) => asserts value = value => { if (!value) throw new PatrimonialTransitionError(); };
const opaque = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_:-]{1,160}$/.test(value);
const iso = (value: unknown): value is string => typeof value === 'string' && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const architectDefaults = (): ArchitectDetails => ({ profile: '', salesExperience: '', goal: '', availability: '', openAnswer: '', presentation: null, presentationAttendance: 'UNKNOWN', qualified: false, interview: null, interviewCompleted: false, interviewOutcome: 'PENDING', eligibility: 'PENDING' });
function actor(command: PatrimonialCommand, ...types: PatrimonialActor['type'][]) {
  requireDomain(command.actor && opaque(command.actor.id) && types.includes(command.actor.type));
}
function evidence(command: PatrimonialCommand) { requireDomain(opaque(command.evidenceId)); }
function guard(intent: PatrimonialOpportunityIntent, command: PatrimonialCommand, pipeline: PatrimonialPipeline) {
  if (!Number.isInteger(command.expectedRevision) || intent.revision !== command.expectedRevision) throw new PatrimonialConflictError();
  requireDomain(intent.pipeline === pipeline && iso(command.at) && Object.hasOwn(patrimonialPipelines[pipeline].stages, intent.stage));
  requireDomain(intent.stage === 'A09' ? intent.status === 'WON' : intent.stage === 'A10' ? ['LOST','ABANDONED'].includes(intent.status) : ['E05','C05'].includes(intent.stage) ? intent.status !== 'OPEN' : intent.status === 'OPEN');
  const historicalRequest = ['ARCHITECT_INTEREST_RECEIVED','EVENT_REQUEST_RECEIVED','CONSULTATION_REQUESTED'].includes(command.type);
  requireDomain(historicalRequest || !intent.events.length || Date.parse(command.at) >= Math.max(...intent.events.map(event => Date.parse(event.at))));
}
function requestContext(request: PatrimonialRequestContext | undefined): asserts request is PatrimonialRequestContext {
  requireDomain(request && opaque(request.requestId) && iso(request.receivedAt) && typeof request.sourcePath === 'string' && request.sourcePath.length <= 200 && request.sourcePath.startsWith('/') && !/[\r\n]/.test(request.sourcePath)
    && ['website-pilot', 'legacy-information', 'manual-request'].includes(request.source) && typeof request.marketingConsent === 'boolean' && opaque(request.privacyVersion));
  requireDomain(request.utm && Object.entries(request.utm).every(([key, value]) => ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].includes(key) && typeof value === 'string' && value.length <= 100 && !/[\r\n]/.test(value)));
}
function finish(previous: PatrimonialOpportunityIntent, next: PatrimonialOpportunityIntent, command: PatrimonialCommand) {
  requireDomain(Object.hasOwn(patrimonialPipelines[next.pipeline].stages, next.stage));
  if (next.status === 'OPEN') {
    if (command.nextStepAt) next.nextStepAt = command.nextStepAt;
    requireDomain(patrimonialNextSteps.includes(next.nextStep) && next.nextStep !== 'NONE' && iso(next.nextStepAt));
    if (next.stage !== previous.stage || next.nextStep !== previous.nextStep) requireDomain(iso(command.nextStepAt) && Date.parse(command.nextStepAt) > Date.parse(command.at));
  } else { next.nextStep = 'NONE'; next.nextStepAt = null; requireDomain(!command.nextStepAt); }
  requireDomain(command.nextStep === undefined || command.nextStep === next.nextStep);
  next.revision = previous.revision + 1;
  const facts = Object.fromEntries(Object.entries({ bookingId: command.booking?.id, startsAt: command.booking?.startsAt, eligibility: command.eligibility, criteriaVersion: command.criteriaVersion, agreementEvidence: command.agreementEvidence, startedAt: command.startedAt, participationId: command.participationId, editionId: command.edition?.id, attendance: command.attendance, reason: command.reason, requestId: command.request?.requestId, originEditionId: command.originEditionId }).filter((entry): entry is [string,string] => typeof entry[1] === 'string'));
  next.events.push({ command: command.type, revision: next.revision, cycle: next.cycle, at: command.at, actor: structuredClone(command.actor), evidenceId: command.evidenceId ?? null, facts });
  return next;
}
function receive(previous: PatrimonialOpportunityIntent, command: PatrimonialCommand) {
  actor(command, 'SYSTEM', 'OWNER'); requestContext(command.request);
  if (previous.requestIds.includes(command.request.requestId)) return structuredClone(previous);
  const next = structuredClone(previous); next.requestIds.push(command.request.requestId);
  if (next.status !== 'OPEN') next.ownerReviewRequired = true;
  return finish(previous, next, command);
}
function close(next: PatrimonialOpportunityIntent, stage: string, reason: CloseReason | null, status: PatrimonialDomainStatus) {
  next.stage = stage; next.status = status; next.closeReason = reason;
}
function booking(command: PatrimonialCommand) {
  requireDomain(command.booking?.confirmed === true && opaque(command.booking.id) && iso(command.booking.startsAt));
  return structuredClone(command.booking);
}
function reopen(previous: PatrimonialOpportunityIntent, command: PatrimonialCommand) {
  actor(command, 'OWNER'); evidence(command);
  requireDomain(previous.status !== 'OPEN' && !(previous.pipeline === 'ARCHITECT_PATH' && previous.status === 'WON'));
  const next = structuredClone(previous);
  next.closedCycles.push({ cycle: previous.cycle, businessKey: previous.businessKey, stage: previous.stage, status: previous.status, reason: previous.closeReason, authorizedBy: structuredClone(command.actor), evidenceId: command.evidenceId! });
  next.cycle++; next.businessKey = hash([next.groupKey, next.cycle]); next.status = 'OPEN'; next.closeReason = null; next.ownerReviewRequired = false;
  next.stage = next.pipeline === 'ARCHITECT_PATH' ? 'A01' : next.pipeline === 'PATRIMONIAL_EVENT' ? 'E01' : 'C01';
  next.nextStep = next.pipeline === 'ARCHITECT_PATH' ? 'ASSIGN' : next.pipeline === 'PATRIMONIAL_EVENT' ? 'CONFIRM_EDITION' : 'BOOK_CONSULTATION';
  if (next.architect) next.architect = architectDefaults();
  if (next.consultation) { next.consultation.booking = null; next.consultation.completed = false; next.consultation.outcome = 'PENDING'; }
  return finish(previous, next, command);
}

export function transitionArchitect(intent: PatrimonialOpportunityIntent, command: PatrimonialCommand): PatrimonialOpportunityIntent {
  guard(intent, command, 'ARCHITECT_PATH');
  if (command.type === 'ARCHITECT_INTEREST_RECEIVED') {
    const next = receive(intent, command);
    if (next.revision !== intent.revision && next.status === 'OPEN' && command.qualification) {
      for (const [key, value] of Object.entries(command.qualification)) {
        requireDomain(['profile','salesExperience','goal','availability','openAnswer'].includes(key) && typeof value === 'string' && value.length <= (key === 'openAnswer' ? 1500 : 120));
        const choices = key === 'profile' ? pilotForms['architect-path'].profiles : key === 'salesExperience' ? pilotExperience : key === 'goal' ? pilotGoals : key === 'availability' ? pilotAvailability : null;
        requireDomain(!choices || !value.trim() || (choices as readonly string[]).includes(value.trim()));
        if (value.trim()) (next.architect as unknown as Record<string, unknown>)[key] = value.trim();
      }
    }
    return next;
  }
  if (command.type === 'CYCLE_REOPEN_AUTHORIZED') return reopen(intent, command);
  requireDomain(intent.status === 'OPEN' && intent.architect);
  const next = structuredClone(intent), details = next.architect!;
  switch (command.type) {
    case 'ARCHITECT_PRESENTATION_INVITED':
      actor(command, 'OWNER'); evidence(command); requireDomain(intent.stage === 'A01' && intent.ownerId);
      next.stage = 'A02'; next.nextStep = 'BOOK_PRESENTATION'; break;
    case 'ARCHITECT_PRESENTATION_BOOKED':
      actor(command, 'BOOKING', 'OWNER'); requireDomain(intent.stage === 'A02'); details.presentation = booking(command);
      details.presentationAttendance = 'UNKNOWN'; next.stage = 'A03'; next.nextStep = 'RECORD_ATTENDANCE'; break;
    case 'ARCHITECT_PRESENTATION_ATTENDED':
    case 'ARCHITECT_PRESENTATION_NO_SHOW':
      actor(command, 'HOST', 'OWNER'); evidence(command); requireDomain(intent.stage === 'A03' && details.presentation && Date.parse(command.at) >= Date.parse(details.presentation.startsAt));
      details.presentationAttendance = command.type === 'ARCHITECT_PRESENTATION_ATTENDED' ? 'ATTENDED' : 'NO_SHOW';
      if (details.presentationAttendance === 'ATTENDED') { next.stage = 'A04'; next.nextStep = 'QUALIFY'; }
      else if (command.rescheduleRequested === true) { next.stage = 'A02'; next.nextStep = 'BOOK_PRESENTATION'; }
      else next.nextStep = 'REVIEW';
      break;
    case 'ARCHITECT_QUALIFIED':
      actor(command, 'OWNER'); evidence(command); requireDomain(intent.stage === 'A04' && details.presentationAttendance === 'ATTENDED'); details.qualified = true; next.nextStep = 'REVIEW'; break;
    case 'ARCHITECT_INTERVIEW_REQUESTED':
      actor(command, 'OWNER'); evidence(command); requireDomain(intent.stage === 'A04' && details.qualified); next.stage = 'A05'; next.nextStep = 'BOOK_INTERVIEW'; break;
    case 'ARCHITECT_INTERVIEW_BOOKED':
      actor(command, 'BOOKING', 'OWNER'); requireDomain(intent.stage === 'A05'); details.interview = booking(command); next.stage = 'A06'; next.nextStep = 'RECORD_OUTCOME'; break;
    case 'ARCHITECT_INTERVIEW_COMPLETED':
      actor(command, 'INTERVIEWER', 'OWNER'); evidence(command); requireDomain(intent.stage === 'A06' && details.interview && Date.parse(command.at) >= Date.parse(details.interview.startsAt));
      requireDomain(command.interviewOutcome === undefined || ['PENDING','PROCEED','DO_NOT_PROCEED','NEEDS_FOLLOW_UP'].includes(command.interviewOutcome));
      details.interviewCompleted = true; details.interviewOutcome = command.interviewOutcome ?? 'PENDING'; next.stage = 'A07'; next.nextStep = 'REVIEW'; break;
    case 'ARCHITECT_ELIGIBILITY_SET':
      actor(command, 'APPROVER', 'OWNER'); evidence(command); requireDomain(['A04','A05','A07'].includes(intent.stage) && ['PENDING','ELIGIBLE','NOT_ELIGIBLE','WITHDRAWN'].includes(command.eligibility ?? ''));
      details.eligibility = command.eligibility!;
      if (details.eligibility === 'ELIGIBLE') { requireDomain(intent.stage === 'A07' && details.interviewCompleted); next.nextStep = 'AGREE_PATH_START'; }
      else if (details.eligibility === 'NOT_ELIGIBLE') close(next, 'A10', 'NOT_ELIGIBLE', 'LOST');
      else if (details.eligibility === 'WITHDRAWN') close(next, 'A10', 'WITHDRAWN', 'ABANDONED');
      else next.nextStep = 'REVIEW';
      break;
    case 'ARCHITECT_PATH_STARTED':
      actor(command, 'APPROVER'); evidence(command); requireDomain(intent.stage === 'A07' && details.eligibility === 'ELIGIBLE' && opaque(command.agreementEvidence) && iso(command.startedAt) && Date.parse(command.startedAt) <= Date.parse(command.at));
      next.stage = 'A08'; next.nextStep = 'REVIEW'; break;
    case 'ARCHITECT_ACTIVATED':
      actor(command, 'APPROVER'); evidence(command); requireDomain(intent.stage === 'A08' && details.eligibility === 'ELIGIBLE' && opaque(command.criteriaVersion)); close(next, 'A09', null, 'WON'); break;
    case 'ARCHITECT_CLOSED':
      actor(command, 'OWNER', 'APPROVER'); evidence(command); requireDomain(architectCloseReasons.includes(command.reason as typeof architectCloseReasons[number]));
      if (command.reason === 'NOT_ELIGIBLE') details.eligibility = 'NOT_ELIGIBLE';
      close(next, 'A10', command.reason!, command.reason === 'WITHDRAWN' ? 'ABANDONED' : 'LOST'); break;
    default: throw new PatrimonialTransitionError();
  }
  return finish(intent, next, command);
}

function checkedEdition(edition: PatrimonialEdition | undefined, at: string) {
  requireDomain(edition && opaque(edition.id) && opaque(edition.eventSlug) && edition.status === 'ACTIVE' && Number.isInteger(edition.revision) && edition.revision >= 0 && iso(edition.startsAt) && iso(edition.endsAt) && Date.parse(edition.endsAt) > Date.parse(edition.startsAt) && Date.parse(edition.startsAt) > Date.parse(at) && edition.title.trim().length > 0);
  try { new Intl.DateTimeFormat('it', { timeZone: edition.timeZone }).format(); } catch { throw new PatrimonialTransitionError(); }
  return structuredClone(edition);
}
export function transitionEvent(intent: PatrimonialOpportunityIntent, participations: PatrimonialRoutingParticipation[], command: PatrimonialCommand) {
  guard(intent, command, 'PATRIMONIAL_EVENT');
  requireDomain(participations.every(p => p.relationId === intent.id && p.contactId === intent.contactId));
  let next = structuredClone(intent);
  const records = structuredClone(participations);
  if (command.type === 'CYCLE_REOPEN_AUTHORIZED') return { intent: reopen(intent, command), participations: records };
  if (command.type === 'EVENT_REQUEST_RECEIVED') {
    actor(command, 'SYSTEM', 'OWNER'); requestContext(command.request); requireDomain(opaque(command.eventSlug));
    if (intent.requestIds.includes(command.request.requestId)) return { intent: next, participations: records };
    next = receive(intent, command);
    let generic = records.find(p => p.eventSlug === command.eventSlug && p.editionId === null && p.status === 'PENDING_EDITION');
    if (generic) { generic.requestIds.push(command.request.requestId); generic.revision++; }
    else { generic = { id: randomUUID(), relationId: intent.id, contactId: intent.contactId, eventSlug: command.eventSlug!, editionId: null, edition: null, revision: 0, requestIds: [command.request.requestId], status: 'PENDING_EDITION', attendance: 'UNKNOWN', evidenceIds: [] }; records.push(generic); }
    return { intent: next, participations: records };
  }
  requireDomain(intent.status === 'OPEN');
  const part = records.find(p => p.id === command.participationId);
  const currentPart = () => {
    requireDomain(part);
    if (part.revision !== command.expectedParticipationRevision) throw new PatrimonialConflictError();
    return part;
  };
  switch (command.type) {
    case 'EVENT_EDITION_SELECTED': {
      actor(command, 'OWNER', 'SYSTEM'); evidence(command);
      const selected = checkedEdition(command.edition, command.at);
      const generic = currentPart(); requireDomain(generic.status === 'PENDING_EDITION' && generic.eventSlug === selected.eventSlug && generic.editionId === null);
      const existing = records.find(p => p.editionId === selected.id);
      if (existing) {
        requireDomain(existing.status !== 'CANCELLED' && existing.status !== 'DECLINED');
        existing.requestIds = [...new Set([...existing.requestIds, ...generic.requestIds])]; existing.revision++;
        generic.status = 'DECLINED'; generic.attendance = 'NOT_APPLICABLE'; generic.supersededBy = existing.id; generic.revision++;
      } else { generic.editionId = selected.id; generic.edition = selected; generic.status = 'PENDING_CONFIRMATION'; generic.revision++; generic.evidenceIds.push(command.evidenceId!); }
      break;
    }
    case 'EVENT_REGISTRATION_CONFIRMED': {
      actor(command, 'OWNER', 'BOOKING'); evidence(command); const selected = currentPart();
      requireDomain(selected.edition && selected.status === 'PENDING_CONFIRMATION' && command.confirmation?.accessConfirmed === true && command.confirmation.capacityApproved === true && command.confirmation.identityConfirmed === true && command.confirmation.purposeConfirmed === true);
      checkedEdition(selected.edition, command.at);
      selected.status = 'CONFIRMED'; selected.revision++; selected.evidenceIds.push(command.evidenceId!);
      if (intent.stage === 'E01') { next.stage = 'E02'; next.nextStep = 'RECORD_ATTENDANCE'; }
      break;
    }
    case 'EVENT_COMPLETED': {
      actor(command, 'HOST', 'OWNER'); evidence(command); const selected = currentPart();
      requireDomain(['E02','E03','E04'].includes(intent.stage) && selected.status === 'CONFIRMED' && selected.edition && Date.parse(selected.edition.endsAt) <= Date.parse(command.at));
      if (intent.stage === 'E02') { next.stage = 'E03'; next.nextStep = 'RECORD_ATTENDANCE'; }
      break;
    }
    case 'EVENT_ATTENDANCE_RECORDED': {
      actor(command, 'HOST', 'OWNER'); evidence(command); const selected = currentPart();
      requireDomain(['ATTENDED','NO_SHOW'].includes(command.attendance ?? '') && selected.status === 'CONFIRMED' && selected.edition && selected.edition.status !== 'CANCELLED' && Date.parse(selected.edition.endsAt) <= Date.parse(command.at));
      selected.attendance = command.attendance!; selected.revision++; selected.evidenceIds.push(command.evidenceId!); break;
    }
    case 'EVENT_PARTICIPATION_CANCELLED': {
      actor(command, 'OWNER'); evidence(command); const selected = currentPart();
      selected.status = command.declined ? 'DECLINED' : 'CANCELLED'; selected.attendance = command.declined ? 'NOT_APPLICABLE' : 'CANCELLED'; selected.revision++; selected.evidenceIds.push(command.evidenceId!); break;
    }
    case 'EVENT_FOLLOWUP_STARTED':
      actor(command, 'OWNER'); evidence(command); requireDomain(intent.stage === 'E03' && records.some(p => ['ATTENDED','NO_SHOW'].includes(p.attendance))); next.stage = 'E04'; next.nextStep = 'FOLLOW_UP'; break;
    case 'EVENT_CLOSED': {
      actor(command, 'OWNER'); evidence(command); requireDomain(eventCloseReasons.includes(command.reason as typeof eventCloseReasons[number]));
      requireDomain(records.length > 0 && records.every(p => ['CANCELLED','DECLINED'].includes(p.status) || (p.status === 'CONFIRMED' && ['ATTENDED','NO_SHOW'].includes(p.attendance))));
      if (command.reason === 'ATTENDED_COMPLETE') requireDomain(intent.stage === 'E04' && records.some(p => p.attendance === 'ATTENDED'));
      if (command.reason === 'NO_SHOW_CLOSED') requireDomain(intent.stage === 'E04' && records.some(p => p.attendance === 'NO_SHOW'));
      if (command.reason === 'EDITION_CANCELLED') requireDomain(records.every(p => p.edition ? p.edition.status === 'CANCELLED' : p.status === 'CANCELLED'));
      if (command.reason === 'CANCELLED') requireDomain(records.every(p => p.status === 'CANCELLED'));
      close(next, 'E05', command.reason!, command.reason === 'ATTENDED_COMPLETE' ? 'WON' : ['CANCELLED','EDITION_CANCELLED'].includes(command.reason!) ? 'ABANDONED' : 'LOST'); break;
    }
    default: throw new PatrimonialTransitionError();
  }
  return { intent: finish(intent, next, command), participations: records };
}

export function transitionConsultation(intent: PatrimonialOpportunityIntent, command: PatrimonialCommand) {
  guard(intent, command, 'PATRIMONIAL_CONSULTATION');
  if (command.type === 'CONSULTATION_REQUESTED') {
    requireDomain(command.trigger === 'EXPLICIT_REQUEST' || (command.trigger === 'AUTHORIZED_HUMAN' && command.actor.type === 'OWNER'));
    const next = receive(intent, command);
    if (command.originEditionId) { requireDomain(opaque(command.originEditionId)); if (next.revision === intent.revision && !next.consultation!.originEditionIds.includes(command.originEditionId)) throw new PatrimonialConflictError(); next.consultation!.originEditionIds = [...new Set([...next.consultation!.originEditionIds, command.originEditionId])]; }
    return next;
  }
  if (command.type === 'CYCLE_REOPEN_AUTHORIZED') return reopen(intent, command);
  requireDomain(intent.status === 'OPEN' && intent.consultation?.explicitRequest);
  const next = structuredClone(intent), details = next.consultation!;
  switch (command.type) {
    case 'CONSULTATION_BOOKED':
      actor(command, 'OWNER', 'BOOKING'); requireDomain(intent.stage === 'C01' && intent.ownerId); details.booking = booking(command); next.stage = 'C02'; next.nextStep = 'RECORD_OUTCOME'; break;
    case 'CONSULTATION_COMPLETED':
      actor(command, 'OWNER'); evidence(command); requireDomain(intent.stage === 'C02' && details.booking && Date.parse(command.at) >= Date.parse(details.booking.startsAt)); details.completed = true; next.stage = 'C03'; next.nextStep = 'RECORD_OUTCOME'; break;
    case 'CONSULTATION_FOLLOWUP_AGREED':
      actor(command, 'OWNER'); evidence(command); requireDomain(intent.stage === 'C03' && details.completed); details.outcome = 'QUALIFIED_FOLLOW_UP'; next.stage = 'C04'; next.nextStep = 'FOLLOW_UP'; break;
    case 'CONSULTATION_CLOSED':
      actor(command, 'OWNER'); evidence(command); requireDomain(consultationCloseReasons.includes(command.reason as typeof consultationCloseReasons[number]));
      if (['INFORMATION_PROVIDED','QUALIFIED_FOLLOW_UP'].includes(command.reason!)) requireDomain(details.completed && ['C03','C04'].includes(intent.stage));
      if (command.reason === 'QUALIFIED_FOLLOW_UP') requireDomain(intent.stage === 'C04');
      if (command.reason !== 'WITHDRAWN') details.outcome = command.reason as typeof details.outcome;
      close(next, 'C05', command.reason!, ['INFORMATION_PROVIDED','QUALIFIED_FOLLOW_UP'].includes(command.reason!) ? 'WON' : command.reason === 'WITHDRAWN' ? 'ABANDONED' : 'LOST'); break;
    default: throw new PatrimonialTransitionError();
  }
  return finish(intent, next, command);
}

export type PatrimonialInterestSeed = {
  pipeline: PatrimonialPipeline; contact: { id: string; locationId: string; identityResolved: true };
  scopeKey: string; request: PatrimonialRequestContext; actor: PatrimonialActor; nextStepAt: string;
  ownerId?: string; eventSlug?: string; trigger?: 'EXPLICIT_REQUEST' | 'AUTHORIZED_HUMAN'; originEditionId?: string;
  qualification?: PatrimonialCommand['qualification'];
};
export async function receivePatrimonialOpportunity(store: PatrimonialOpportunityStore, seed: PatrimonialInterestSeed) {
  requireDomain(seed.contact.identityResolved === true && opaque(seed.contact.id) && opaque(seed.contact.locationId) && opaque(seed.scopeKey) && (seed.ownerId === undefined || opaque(seed.ownerId))); requestContext(seed.request);
  const groupKey = hash([seed.contact.locationId, seed.contact.id, seed.pipeline, seed.pipeline === 'PATRIMONIAL_EVENT' ? 'event-relationship' : seed.scopeKey]);
  return store.transaction(async tx => {
    const current = await tx.findOpportunityIntent(groupKey);
    const command: PatrimonialCommand = { type: seed.pipeline === 'ARCHITECT_PATH' ? 'ARCHITECT_INTEREST_RECEIVED' : seed.pipeline === 'PATRIMONIAL_EVENT' ? 'EVENT_REQUEST_RECEIVED' : 'CONSULTATION_REQUESTED', expectedRevision: current?.revision ?? 0, actor: seed.actor, at: seed.request.receivedAt, request: seed.request, eventSlug: seed.eventSlug, trigger: seed.trigger, originEditionId: seed.originEditionId, qualification: seed.qualification };
    let intent: PatrimonialOpportunityIntent = current ?? {
      id: randomUUID(), groupKey, businessKey: hash([groupKey, 1]), pipeline: seed.pipeline, contactId: seed.contact.id, locationId: seed.contact.locationId,
      scopeKey: seed.pipeline === 'PATRIMONIAL_EVENT' ? 'event-relationship' : seed.scopeKey, cycle: 1, revision: 0, stage: seed.pipeline === 'ARCHITECT_PATH' ? 'A01' : seed.pipeline === 'PATRIMONIAL_EVENT' ? 'E01' : 'C01', status: 'OPEN', ownerId: seed.ownerId ?? null,
      nextStep: seed.pipeline === 'ARCHITECT_PATH' ? 'ASSIGN' : seed.pipeline === 'PATRIMONIAL_EVENT' ? 'CONFIRM_EDITION' : 'BOOK_CONSULTATION', nextStepAt: seed.nextStepAt, closeReason: null,
      firstRequest: structuredClone(seed.request), requestIds: [], ownerReviewRequired: false, architect: seed.pipeline === 'ARCHITECT_PATH' ? architectDefaults() : null,
      consultation: seed.pipeline === 'PATRIMONIAL_CONSULTATION' ? { originEditionIds: [], explicitRequest: true, booking: null, completed: false, outcome: 'PENDING' } : null, events: [], closedCycles: [], remote: null,
    };
    requireDomain(current || (iso(intent.nextStepAt) && Date.parse(intent.nextStepAt) > Date.parse(command.at)));
    const participation = await tx.listParticipations(intent.id);
    let updatedParticipations: PatrimonialRoutingParticipation[] | undefined;
    if (seed.pipeline === 'ARCHITECT_PATH') intent = transitionArchitect(intent, command);
    else if (seed.pipeline === 'PATRIMONIAL_CONSULTATION') intent = transitionConsultation(intent, command);
    else { const result = transitionEvent(intent, participation, command); intent = result.intent; updatedParticipations = result.participations; }
    if (!current || intent.revision !== current.revision) await tx.saveOpportunityIntent(intent, current?.revision ?? null);
    if (updatedParticipations) await tx.saveParticipations(intent.id, updatedParticipations, participation);
    return intent;
  });
}
export async function applyPatrimonialCommand(store: PatrimonialOpportunityStore, id: string, command: PatrimonialCommand) {
  return store.transaction(async tx => {
    const intent = await tx.getOpportunityIntent(id); requireDomain(intent);
    let next: PatrimonialOpportunityIntent;
    if (intent.pipeline === 'ARCHITECT_PATH') next = transitionArchitect(intent, command);
    else if (intent.pipeline === 'PATRIMONIAL_CONSULTATION') next = transitionConsultation(intent, command);
    else { const records = await tx.listParticipations(id); const result = transitionEvent(intent, records, command); next = result.intent; await tx.saveParticipations(id, result.participations, records); }
    if (next.revision !== intent.revision) await tx.saveOpportunityIntent(next, intent.revision);
    return next;
  });
}

export const commonOpportunityFields = ['hz_intent_key','hz_funnel','hz_source','hz_source_path','hz_utm_source','hz_utm_medium','hz_utm_campaign','hz_utm_content','hz_utm_term','hz_requested_at','hz_privacy_version','hz_marketing_consent_snapshot','hz_next_step','hz_next_step_at'] as const;
export const architectOpportunityFields = ['hz_architect_profile','hz_architect_sales_experience','hz_architect_goal','hz_architect_availability','hz_architect_open_answer','hz_architect_presentation_date','hz_architect_presentation_attended','hz_architect_interview_date','hz_architect_interview_outcome','hz_architect_eligibility'] as const;
export const consultationOpportunityFields = ['hz_origin_event_edition','hz_consultation_outcome'] as const;
export const logicalOpportunityFields = (pipeline: PatrimonialPipeline) => [...commonOpportunityFields, ...(pipeline === 'ARCHITECT_PATH' ? architectOpportunityFields : pipeline === 'PATRIMONIAL_CONSULTATION' ? consultationOpportunityFields : [])];
export type PatrimonialPipelineMapping = {
  locationId: string | null;
  pipelines: Record<PatrimonialPipeline, { pipelineId: string | null; stages: Record<string, string | null>; fields: Record<string, string | null> }>;
  closeReason: { mode: 'UNRESOLVED' | 'NATIVE' | 'CUSTOM'; key: string | null };
};
export function unresolvedPatrimonialPipelineMapping(): PatrimonialPipelineMapping {
  return { locationId: null, pipelines: Object.fromEntries(Object.entries(patrimonialPipelines).map(([key, value]) => [key, { pipelineId: null, stages: Object.fromEntries(Object.keys(value.stages).map(stage => [stage, null])), fields: Object.fromEntries(logicalOpportunityFields(key as PatrimonialPipeline).map(field => [field, null])) }])) as PatrimonialPipelineMapping['pipelines'], closeReason: { mode: 'UNRESOLVED', key: null } };
}
export function resolvedPatrimonialMapping(mapping: PatrimonialPipelineMapping, intent: PatrimonialOpportunityIntent) {
  const entry = mapping.pipelines[intent.pipeline];
  const pipelineIds = Object.values(mapping.pipelines).map(pipeline => pipeline.pipelineId).filter(opaque);
  if (new Set(pipelineIds).size !== pipelineIds.length) return null;
  const ids = entry && Object.keys(patrimonialPipelines[intent.pipeline].stages).map(stage => entry.stages[stage]);
  const fields = entry && logicalOpportunityFields(intent.pipeline).map(key => entry.fields[key]);
  if (mapping.locationId !== intent.locationId || !entry || !opaque(entry.pipelineId) || !ids?.every(opaque) || new Set(ids).size !== ids.length || !fields?.every(opaque) || new Set(fields).size !== fields.length || mapping.closeReason.mode === 'UNRESOLVED' || !opaque(mapping.closeReason.key)) return null;
  return entry;
}
export function patrimonialOpportunityProjection(intent: PatrimonialOpportunityIntent): Record<string, string> {
  const r = intent.firstRequest;
  const result: Record<string, string> = { hz_intent_key: intent.businessKey, hz_funnel: intent.pipeline === 'ARCHITECT_PATH' ? 'architect-path' : intent.pipeline === 'PATRIMONIAL_EVENT' ? 'patrimonial-event' : 'patrimonial-consultation', hz_source: r.source, hz_source_path: r.sourcePath,
    ...Object.fromEntries(['source','medium','campaign','content','term'].map(name => [`hz_utm_${name}`, r.utm[`utm_${name}` as keyof typeof r.utm] ?? ''])), hz_requested_at: r.receivedAt, hz_privacy_version: r.privacyVersion, hz_marketing_consent_snapshot: r.marketingConsent ? 'GRANTED_THIS_REQUEST' : 'NOT_GRANTED_THIS_REQUEST', hz_next_step: intent.nextStep, hz_next_step_at: intent.nextStepAt ?? '' };
  const a = intent.architect;
  if (a) Object.assign(result, { hz_architect_profile: a.profile, hz_architect_sales_experience: a.salesExperience, hz_architect_goal: a.goal, hz_architect_availability: a.availability, hz_architect_open_answer: a.openAnswer, hz_architect_presentation_date: a.presentation?.startsAt ?? '', hz_architect_presentation_attended: a.presentationAttendance, hz_architect_interview_date: a.interview?.startsAt ?? '', hz_architect_interview_outcome: a.interviewOutcome, hz_architect_eligibility: a.eligibility });
  if (intent.consultation) Object.assign(result, { hz_origin_event_edition: intent.consultation.originEditionIds[0] ?? '', hz_consultation_outcome: intent.consultation.outcome });
  // No hz_event_* mirrors: edition/registration/attendance remain in participation.
  return result;
}
