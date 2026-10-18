import { createHash } from 'node:crypto';

export const patrimonialPerformanceEventTypes = [
  'OWNERSHIP_TAKEN',
  'CONTACT_ATTEMPTED',
  'CONTACT_ESTABLISHED',
  'APPOINTMENT_BOOKED',
  'APPOINTMENT_RESCHEDULED',
  'APPOINTMENT_CANCELLED',
  'APPOINTMENT_ATTENDED',
  'APPOINTMENT_NO_SHOW',
  'FOLLOW_UP_STARTED',
  'STAGE_CHANGED',
  'CLOSED_WON',
  'CLOSED_LOST',
  'CLOSED_ABANDONED',
] as const;

export const patrimonialPerformanceSources = [
  'HORYZON_INTERNAL',
  'HIGHLEVEL_WEBHOOK',
  'HIGHLEVEL_RECONCILIATION',
  'MANUAL',
] as const;

export const patrimonialPerformanceRecorderTypes = ['SYSTEM','ADMIN','WORKER','WEBHOOK','OPERATOR'] as const;
export const patrimonialPerformanceChannels = ['CALL','VOICEMAIL','SMS','EMAIL','WHATSAPP','SOCIAL','CHAT','OTHER'] as const;
export const patrimonialAppointmentStatuses = ['new','confirmed','cancelled','showed','noshow','invalid','completed','active'] as const;
export const patrimonialProviderStatuses = ['open','won','lost','abandoned'] as const;

export type PatrimonialPerformanceEventType = typeof patrimonialPerformanceEventTypes[number];
export type PatrimonialPerformanceSource = typeof patrimonialPerformanceSources[number];
export type PatrimonialPerformanceRecorderType = typeof patrimonialPerformanceRecorderTypes[number];
export type PatrimonialPerformanceChannel = typeof patrimonialPerformanceChannels[number];
export type PatrimonialAppointmentStatus = typeof patrimonialAppointmentStatuses[number];
export type PatrimonialProviderStatus = typeof patrimonialProviderStatuses[number];

export type PatrimonialPerformanceEventInput = Readonly<{
  eventKey: string;
  intentId: string;
  assignmentId: string;
  operatorId: string;
  eventType: PatrimonialPerformanceEventType;
  occurredAt: string;
  source: PatrimonialPerformanceSource;
  sourceRef?: string | null;
  providerEventType?: string | null;
  remoteOpportunityId?: string | null;
  remoteContactId?: string | null;
  remoteAppointmentId?: string | null;
  pipelineStageFrom?: string | null;
  pipelineStageTo?: string | null;
  providerStatus?: PatrimonialProviderStatus | null;
  appointmentStatus?: PatrimonialAppointmentStatus | null;
  channel?: PatrimonialPerformanceChannel | null;
  recordedByType: PatrimonialPerformanceRecorderType;
  recordedByRef?: string | null;
}>;

export type PatrimonialPerformanceEventWrite = PatrimonialPerformanceEventInput & {
  payloadHash: string;
  schemaVersion: 1;
};

export type PatrimonialPerformanceEvent = PatrimonialPerformanceEventWrite & {
  id: string;
  recordedAt: string;
};

export type PatrimonialPerformanceContext = Readonly<{
  intentId: string;
  assignmentId: string;
  operatorId: string;
  qualitySnapshotId: string | null;
  experimentId: string | null;
  funnel: string;
  remoteContactId: string;
  remoteOpportunityId: string;
}>;

export interface PatrimonialPerformanceStore {
  performanceHealth(): Promise<void>;
  recordPerformanceEvent(input: PatrimonialPerformanceEventWrite): Promise<PatrimonialPerformanceEvent>;
  resolvePerformanceContext(remoteOpportunityId: string, occurredAt: string): Promise<PatrimonialPerformanceContext | null>;
}

export class PatrimonialPerformanceError extends Error {
  readonly code: 'DISABLED' | 'INVALID';
  constructor(code: PatrimonialPerformanceError['code']) {
    super(`Patrimonial performance ${code}`);
    this.code = code;
  }
}

const uuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const key = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,199}$/.test(value);
const line = (value: unknown, max = 200): value is string =>
  typeof value === 'string' && value.length >= 1 && value.length <= max && !/[\r\n]/.test(value);
const iso = (value: unknown): value is string =>
  typeof value === 'string' && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
const optionalLine = (value: unknown, max = 200) => value == null || line(value, max);

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return '{' + Object.entries(value as Record<string,unknown>)
      .filter(([,v]) => v !== undefined)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([k,v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',') + '}';
  }
  if (typeof value === 'number' && !Number.isFinite(value)) throw new PatrimonialPerformanceError('INVALID');
  return JSON.stringify(value) ?? 'null';
}

export function patrimonialPerformanceTrackingEnabled(env: Record<string,string|undefined> = process.env) {
  return env.PATRIMONIAL_PERFORMANCE_TRACKING_ENABLED === 'true';
}

export function validatePatrimonialPerformanceInput(input: PatrimonialPerformanceEventInput): PatrimonialPerformanceEventInput {
  if (!input || !key(input.eventKey) || !uuid(input.intentId) || !uuid(input.assignmentId) || !uuid(input.operatorId)
    || !patrimonialPerformanceEventTypes.includes(input.eventType) || !iso(input.occurredAt)
    || !patrimonialPerformanceSources.includes(input.source) || !patrimonialPerformanceRecorderTypes.includes(input.recordedByType)) {
    throw new PatrimonialPerformanceError('INVALID');
  }
  for (const [value,max] of [
    [input.sourceRef,200],[input.providerEventType,80],[input.remoteOpportunityId,160],[input.remoteContactId,160],
    [input.remoteAppointmentId,160],[input.pipelineStageFrom,160],[input.pipelineStageTo,160],[input.recordedByRef,160],
  ] as const) if (!optionalLine(value,max)) throw new PatrimonialPerformanceError('INVALID');

  if (input.providerStatus != null && !patrimonialProviderStatuses.includes(input.providerStatus)) throw new PatrimonialPerformanceError('INVALID');
  if (input.appointmentStatus != null && !patrimonialAppointmentStatuses.includes(input.appointmentStatus)) throw new PatrimonialPerformanceError('INVALID');
  if (input.channel != null && !patrimonialPerformanceChannels.includes(input.channel)) throw new PatrimonialPerformanceError('INVALID');

  const providerSource = input.source === 'HIGHLEVEL_WEBHOOK' || input.source === 'HIGHLEVEL_RECONCILIATION';
  if (providerSource && (!input.sourceRef || !input.providerEventType
    || (!input.remoteOpportunityId && !input.remoteContactId && !input.remoteAppointmentId))) throw new PatrimonialPerformanceError('INVALID');

  if (input.eventType === 'STAGE_CHANGED' && !input.pipelineStageTo) throw new PatrimonialPerformanceError('INVALID');
  if (input.eventType.startsWith('APPOINTMENT_') && !input.remoteAppointmentId) throw new PatrimonialPerformanceError('INVALID');
  if (input.eventType === 'APPOINTMENT_BOOKED' && input.appointmentStatus != null && !['new','confirmed','active'].includes(input.appointmentStatus)) throw new PatrimonialPerformanceError('INVALID');
  if (input.eventType === 'APPOINTMENT_ATTENDED' && input.appointmentStatus != null && !['showed','completed'].includes(input.appointmentStatus)) throw new PatrimonialPerformanceError('INVALID');
  if (input.eventType === 'APPOINTMENT_NO_SHOW' && input.appointmentStatus != null && input.appointmentStatus !== 'noshow') throw new PatrimonialPerformanceError('INVALID');
  if (input.eventType === 'APPOINTMENT_CANCELLED' && input.appointmentStatus != null && input.appointmentStatus !== 'cancelled') throw new PatrimonialPerformanceError('INVALID');
  if (input.eventType === 'CLOSED_WON' && input.providerStatus != null && input.providerStatus !== 'won') throw new PatrimonialPerformanceError('INVALID');
  if (input.eventType === 'CLOSED_LOST' && input.providerStatus != null && input.providerStatus !== 'lost') throw new PatrimonialPerformanceError('INVALID');
  if (input.eventType === 'CLOSED_ABANDONED' && input.providerStatus != null && input.providerStatus !== 'abandoned') throw new PatrimonialPerformanceError('INVALID');

  return structuredClone(input);
}

export function makePatrimonialPerformanceEvent(input: PatrimonialPerformanceEventInput): PatrimonialPerformanceEventWrite {
  const valid = validatePatrimonialPerformanceInput(input);
  const normalized: PatrimonialPerformanceEventInput = {
    ...valid,
    sourceRef: valid.sourceRef ?? null,
    providerEventType: valid.providerEventType ?? null,
    remoteOpportunityId: valid.remoteOpportunityId ?? null,
    remoteContactId: valid.remoteContactId ?? null,
    remoteAppointmentId: valid.remoteAppointmentId ?? null,
    pipelineStageFrom: valid.pipelineStageFrom ?? null,
    pipelineStageTo: valid.pipelineStageTo ?? null,
    providerStatus: valid.providerStatus ?? null,
    appointmentStatus: valid.appointmentStatus ?? null,
    channel: valid.channel ?? null,
    recordedByRef: valid.recordedByRef ?? null,
  };
  const payloadHash = createHash('sha256').update(canonical(normalized)).digest('hex');
  return Object.freeze({ ...normalized, payloadHash, schemaVersion: 1 as const });
}

export async function recordPatrimonialPerformanceEvent(
  store: PatrimonialPerformanceStore,
  input: PatrimonialPerformanceEventInput,
  options: { env?: () => Record<string,string|undefined> } = {},
) {
  const env = options.env ?? (() => process.env);
  if (!patrimonialPerformanceTrackingEnabled(env())) throw new PatrimonialPerformanceError('DISABLED');
  return store.recordPerformanceEvent(makePatrimonialPerformanceEvent(input));
}

// A provider webhook may be a signal without being safe attribution evidence.
// Opportunity events carry an opportunity ID and can be resolved safely by the
// store. Contact/message and appointment events do not identify the patrimonial
// practice, so P3 v1 does not infer an assignment from contactId/calendarId alone.
export const patrimonialHighLevelPerformanceReadiness = Object.freeze({
  OpportunityStageUpdate: 'RESOLVABLE_BY_OPPORTUNITY_ID',
  OpportunityStatusUpdate: 'RESOLVABLE_BY_OPPORTUNITY_ID',
  OpportunityAssignedToUpdate: 'NOT_OWNERSHIP_ACCEPTANCE',
  OutboundMessage: 'NEEDS_PRACTICE_BINDING',
  InboundMessage: 'NEEDS_PRACTICE_BINDING',
  AppointmentCreate: 'NEEDS_CALENDAR_OR_PRACTICE_BINDING',
  AppointmentUpdate: 'NEEDS_CALENDAR_OR_PRACTICE_BINDING',
} as const);
