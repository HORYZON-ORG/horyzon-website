import { createHash, createPublicKey, verify as cryptoVerify } from 'node:crypto';
import { getPatrimonialRemoteMapping } from './patrimonial-highlevel-config.ts';
import {
  patrimonialPerformanceTrackingEnabled,
  recordPatrimonialPerformanceEvent,
  type PatrimonialPerformanceStore,
  type PatrimonialProviderStatus,
} from './patrimonial-performance.ts';

if (typeof window !== 'undefined') throw new Error('Patrimonial HighLevel performance webhook is server-only.');

export const HIGHLEVEL_GHL_ED25519_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=
-----END PUBLIC KEY-----`;

export const PATRIMONIAL_HIGHLEVEL_WEBHOOK_MAX_BYTES = 64 * 1024;

export type PatrimonialHighLevelWebhookState =
  | 'DISABLED'
  | 'RECORDED'
  | 'IGNORED_LOCATION'
  | 'IGNORED_UNSUPPORTED'
  | 'IGNORED_MISSING_TIMESTAMP'
  | 'IGNORED_UNKNOWN_PIPELINE'
  | 'IGNORED_UNKNOWN_STAGE'
  | 'IGNORED_UNATTRIBUTABLE'
  | 'IGNORED_IDENTITY'
  | 'IGNORED_STATUS_OPEN'
  | 'IGNORED_STATUS_UNKNOWN';

export class PatrimonialHighLevelWebhookError extends Error {
  readonly code: 'SIGNATURE' | 'PAYLOAD' | 'CONFIG';
  constructor(code: PatrimonialHighLevelWebhookError['code']) {
    super(`Patrimonial HighLevel webhook ${code}`);
    this.code = code;
  }
}

type WebhookPayload = Record<string, unknown> & {
  type?: unknown;
  locationId?: unknown;
  id?: unknown;
  contactId?: unknown;
  pipelineId?: unknown;
  pipelineStageId?: unknown;
  status?: unknown;
  timestamp?: unknown;
  webhookId?: unknown;
};

const opaque = (value: unknown, max = 200): value is string =>
  typeof value === 'string' && value.length >= 1 && value.length <= max && !/[\r\n]/.test(value);
const iso = (value: unknown): value is string =>
  typeof value === 'string' && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
const providerStatus = (value: unknown): value is PatrimonialProviderStatus =>
  typeof value === 'string' && ['open','won','lost','abandoned'].includes(value);

export function patrimonialHighLevelPerformanceWebhookEnabled(env: Record<string,string|undefined> = process.env) {
  return env.PATRIMONIAL_HIGHLEVEL_PERFORMANCE_WEBHOOK_ENABLED === 'true';
}

export function verifyPatrimonialHighLevelWebhookSignature(
  rawBody: string,
  signature: string | null,
  publicKeyPem = HIGHLEVEL_GHL_ED25519_PUBLIC_KEY,
) {
  if (!signature || signature === 'N/A' || Buffer.byteLength(rawBody, 'utf8') > PATRIMONIAL_HIGHLEVEL_WEBHOOK_MAX_BYTES) return false;
  try {
    const signatureBuffer = Buffer.from(signature, 'base64');
    if (signatureBuffer.length !== 64) return false;
    return cryptoVerify(null, Buffer.from(rawBody, 'utf8'), createPublicKey(publicKeyPem), signatureBuffer);
  } catch {
    return false;
  }
}

export function parsePatrimonialHighLevelWebhook(rawBody: string): WebhookPayload {
  if (Buffer.byteLength(rawBody, 'utf8') > PATRIMONIAL_HIGHLEVEL_WEBHOOK_MAX_BYTES) throw new PatrimonialHighLevelWebhookError('PAYLOAD');
  let payload: unknown;
  try { payload = JSON.parse(rawBody); } catch { throw new PatrimonialHighLevelWebhookError('PAYLOAD'); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new PatrimonialHighLevelWebhookError('PAYLOAD');
  return payload as WebhookPayload;
}

function remotePipeline(mapping: ReturnType<typeof getPatrimonialRemoteMapping>, pipelineId: string) {
  for (const [funnel,pipeline] of Object.entries(mapping.pipelines)) if (pipeline.id === pipelineId) return { funnel, pipeline };
  return null;
}

const funnelSlug = (funnel: string) =>
  funnel === 'ARCHITECT_PATH' ? 'architect-path'
    : funnel === 'PATRIMONIAL_EVENT' ? 'patrimonial-event'
      : funnel === 'PATRIMONIAL_CONSULTATION' ? 'patrimonial-consultation' : null;

function stageCode(pipeline: { stages: Record<string,{id:string}> }, remoteStageId: string) {
  for (const [code,stage] of Object.entries(pipeline.stages)) if (stage.id === remoteStageId) return code;
  return null;
}

function deliveryIdentity(payload: WebhookPayload, rawBody: string) {
  const webhookId = opaque(payload.webhookId, 200) ? payload.webhookId : null;
  const rawHash = createHash('sha256').update(rawBody).digest('hex');
  const sourceRef = webhookId ?? `body:${rawHash}`;
  const eventKey = `highlevel:webhook:${createHash('sha256').update(sourceRef).digest('hex')}`;
  return { sourceRef, eventKey };
}

export async function ingestPatrimonialHighLevelPerformanceWebhook(options: {
  rawBody: string;
  signature: string | null;
  storeFactory: () => PatrimonialPerformanceStore;
  env?: () => Record<string,string|undefined>;
  publicKeyPem?: string;
}) {
  const env = options.env ?? (() => process.env);
  if (!verifyPatrimonialHighLevelWebhookSignature(options.rawBody, options.signature, options.publicKeyPem)) {
    throw new PatrimonialHighLevelWebhookError('SIGNATURE');
  }
  const payload = parsePatrimonialHighLevelWebhook(options.rawBody);
  const current = env();
  const locationId = current.HIGHLEVEL_LOCATION_ID?.trim();
  if (!locationId) throw new PatrimonialHighLevelWebhookError('CONFIG');

  if (!patrimonialPerformanceTrackingEnabled(current) || !patrimonialHighLevelPerformanceWebhookEnabled(current)) {
    return { ok:true as const, state:'DISABLED' as const };
  }

  if (!opaque(payload.locationId, 160) || payload.locationId !== locationId) {
    return { ok:true as const, state:'IGNORED_LOCATION' as const };
  }
  if (payload.type !== 'OpportunityStageUpdate' && payload.type !== 'OpportunityStatusUpdate') {
    return { ok:true as const, state:'IGNORED_UNSUPPORTED' as const };
  }
  // HighLevel's event-specific opportunity docs do not currently guarantee a
  // timestamp field. dateAdded is opportunity creation time, not event time, so
  // it is never used as a performance timestamp.
  if (!iso(payload.timestamp)) return { ok:true as const, state:'IGNORED_MISSING_TIMESTAMP' as const };
  if (!opaque(payload.id,160) || !opaque(payload.contactId,160) || !opaque(payload.pipelineId,160)) {
    throw new PatrimonialHighLevelWebhookError('PAYLOAD');
  }

  const mapping = getPatrimonialRemoteMapping(current);
  const remote = remotePipeline(mapping, payload.pipelineId);
  if (!remote) return { ok:true as const, state:'IGNORED_UNKNOWN_PIPELINE' as const };

  let eventType: 'STAGE_CHANGED' | 'CLOSED_WON' | 'CLOSED_LOST' | 'CLOSED_ABANDONED';
  let pipelineStageTo: string | null = null;
  const status: PatrimonialProviderStatus | null = providerStatus(payload.status) ? payload.status : null;

  if (payload.type === 'OpportunityStageUpdate') {
    if (!opaque(payload.pipelineStageId,160)) throw new PatrimonialHighLevelWebhookError('PAYLOAD');
    pipelineStageTo = stageCode(remote.pipeline, payload.pipelineStageId);
    if (!pipelineStageTo) return { ok:true as const, state:'IGNORED_UNKNOWN_STAGE' as const };
    eventType = 'STAGE_CHANGED';
  } else {
    if (status === 'open') return { ok:true as const, state:'IGNORED_STATUS_OPEN' as const };
    if (status === 'won') eventType = 'CLOSED_WON';
    else if (status === 'lost') eventType = 'CLOSED_LOST';
    else if (status === 'abandoned') eventType = 'CLOSED_ABANDONED';
    else return { ok:true as const, state:'IGNORED_STATUS_UNKNOWN' as const };
  }

  const store = options.storeFactory();
  const context = await store.resolvePerformanceContext(payload.id, payload.timestamp);
  if (!context) return { ok:true as const, state:'IGNORED_UNATTRIBUTABLE' as const };
  if (context.remoteOpportunityId !== payload.id || context.remoteContactId !== payload.contactId
    || funnelSlug(remote.funnel) !== context.funnel) {
    return { ok:true as const, state:'IGNORED_IDENTITY' as const };
  }

  const { sourceRef,eventKey } = deliveryIdentity(payload, options.rawBody);
  const event = await recordPatrimonialPerformanceEvent(store,{
    eventKey,
    intentId:context.intentId,
    assignmentId:context.assignmentId,
    operatorId:context.operatorId,
    eventType,
    occurredAt:payload.timestamp,
    source:'HIGHLEVEL_WEBHOOK',
    sourceRef,
    providerEventType:payload.type,
    remoteOpportunityId:payload.id,
    remoteContactId:payload.contactId,
    pipelineStageTo,
    providerStatus:status,
    recordedByType:'WEBHOOK',
    recordedByRef:'highlevel-v3',
  },{env});

  return { ok:true as const, state:'RECORDED' as const, eventId:event.id };
}
