import { contactEffectKinds } from './patrimonial-owner-operations.ts';
import { createHash, randomUUID } from 'node:crypto';
import type { PatrimonialCrmCheckpoint, PatrimonialOutboxOperation, PatrimonialRequest } from './patrimonial-contract.ts';
import { patrimonialFlags, PatrimonialStaleLeaseError, type PatrimonialOperationError, type PatrimonialStore } from './patrimonial-store.ts';
import { checkedPatrimonialContact, PatrimonialCrmError, resolvePatrimonialIdentity, type PatrimonialCrmProvider } from './patrimonial-highlevel.ts';
import type { PatrimonialOpportunityProvider, PatrimonialRemoteOpportunity, PatrimonialOpportunityWrite } from './patrimonial-highlevel.ts';
import { patrimonialOpportunityProjection, patrimonialProviderStatuses, resolvedPatrimonialMapping, type PatrimonialOpportunityIntent, type PatrimonialPipelineMapping } from './patrimonial-routing.ts';
import { PatrimonialConflictError, type PatrimonialOpportunityStore, type PatrimonialOpportunitySyncState } from './patrimonial-store.ts';

// Explicitly invoked worker only; no route/scheduler or production store activation.
export const PATRIMONIAL_LEASE_SECONDS = 60;
export const PATRIMONIAL_MAX_ATTEMPTS = 5;
const backoffMinutes = [1, 5, 30, 120] as const;
export type PatrimonialFailure = {
  kind: 'network' | 'http' | 'unknown'; status?: number;
  // A create may have committed remotely even when no response arrived.
  outcomeUncertain?: boolean; retryAfterSeconds?: number;
};

export function patrimonialRetryDecision(attemptCount: number, failure: PatrimonialFailure, now: string, jitter = Math.random()) {
  const errorCode: PatrimonialOperationError = failure.kind === 'network' ? 'NETWORK'
    : failure.status === 429 ? 'RATE_LIMIT' : failure.status === 400 ? 'SCHEMA'
      : failure.status === 401 || failure.status === 403 ? 'AUTH' : failure.status === 404 ? 'CONFIG'
        : failure.status !== undefined && failure.status >= 500 && failure.status <= 599 ? 'PROVIDER' : 'UNKNOWN';
  if (attemptCount >= PATRIMONIAL_MAX_ATTEMPTS) return { state: 'MANUAL_REVIEW' as const, errorCode };
  if (failure.outcomeUncertain) return { state: 'RECONCILE_REQUIRED' as const, errorCode };
  if (!['NETWORK', 'RATE_LIMIT', 'PROVIDER'].includes(errorCode)) return { state: 'MANUAL_REVIEW' as const, errorCode };
  if (!Number.isInteger(attemptCount) || attemptCount < 1) throw new Error('Invalid attempt count.');
  const delay = backoffMinutes[attemptCount - 1] * 60_000;
  const retryAfter = Number.isFinite(failure.retryAfterSeconds) ? Math.max(0, failure.retryAfterSeconds!) * 1000 : 0;
  const boundedJitter = Number.isFinite(jitter) ? Math.max(0, Math.min(1, jitter)) : 0;
  const nextAttemptAt = new Date(Date.parse(now) + Math.max(delay + Math.floor(delay * .1 * boundedJitter), retryAfter)).toISOString();
  return { state: 'RETRY_SCHEDULED' as const, errorCode, nextAttemptAt };
}

const crmSteps = ['RESOLVE_CONTACT', 'UPSERT_CONTACT', 'ADD_TAGS', 'ADD_NOTE'] as const;
export const patrimonialNoteMarker = (requestId: string) => `horyzon-patrimonial-request:${requestId}`;
export function desiredPatrimonialTags(request: PatrimonialRequest) {
  return ['horyzon-patrimoniale', request.payload.mode === 'architect-path' ? 'percorso-architetto-patrimoniale' : 'evento-patrimoniale', 'pilot'];
}
class PatrimonialWorkerHold extends Error {}
type WorkerOptions = {
  store: PatrimonialStore; provider: PatrimonialCrmProvider;
  env?: () => Record<string, string | undefined>; now?: () => Date; jitter?: number; reconciliationOnly?: boolean;
};

// At most one leased effect per invocation. The lease is revalidated before writes.
// A false CRM flag leaves pending work untouched; reconciliation can be read-only.
export async function runPatrimonialCrmOnce(options: WorkerOptions): Promise<string> {
  const { store, provider } = options;
  const env = options.env ?? (() => process.env);
  const timestamp = () => (options.now ?? (() => new Date()))().toISOString();
  const flags = patrimonialFlags(env());
  if (!flags.v2 || (!flags.crmWrite && !options.reconciliationOnly)) return 'HOLD';
  const [operation] = await store.claimOperations({ now: timestamp(), limit: 1, kinds: contactEffectKinds, reconciliationOnly: options.reconciliationOnly });
  if (!operation) return 'IDLE';
  const claim = () => ({ operationId: operation.id, leaseToken: operation.leaseToken!, leaseVersion: operation.leaseVersion, now: timestamp() });
  let effectMayHaveCommitted = false;
  const writeGuard = async () => {
    await store.renewLease(claim());
    const current = patrimonialFlags(env());
    if (!current.v2 || !current.crmWrite || options.reconciliationOnly) throw new PatrimonialWorkerHold();
    provider.assertReady(true);
  };
  const finish = async (checkpoint?: PatrimonialCrmCheckpoint, remoteId?: string, followUps?: PatrimonialOutboxOperation[]) => {
    await store.completeCrmOperation({ ...claim(), checkpoint, remoteId, followUps, reconciliationConfirmed: operation.reconcileRequired });
  };
  try {
    provider.assertReady(!options.reconciliationOnly);
    const request = await store.getRequest(operation.requestId);
    if (!request || (request.crm && request.crm.locationId !== provider.locationId)) throw new PatrimonialCrmError('CONFIG');
    const tags = desiredPatrimonialTags(request);
    if (!options.reconciliationOnly && tags.some(tag => !provider.verifiedTags.has(tag))) throw new PatrimonialCrmError('CONFIG');
    const checkpoint = request.crm;
    if (operation.kind === 'SYNC_REQUEST') {
      const now = timestamp();
      let previous = operation.id;
      const followUps = crmSteps.map(kind => {
        const id = randomUUID();
        const op: PatrimonialOutboxOperation = {
          id, operationKey: `${request.id}:${kind}:v1`, requestId: request.id, intentId: operation.intentId, kind,
          dependsOn: previous, identityLockKey: operation.identityLockKey ?? createHash('sha256').update(request.payload.email).digest('hex'),
          technicalState: 'SYNC_PENDING', createdAt: now, nextAttemptAt: now,
          attemptCount: 0, leaseToken: null, leaseVersion: 0, leaseExpiresAt: null, reconcileRequired: false, lastErrorCode: null,
        };
        previous = id; return op;
      });
      await finish(undefined, undefined, followUps); return 'EXPANDED';
    }
    if (operation.kind === 'RESOLVE_CONTACT') {
      const identity = await resolvePatrimonialIdentity(provider, request.payload);
      if (identity.kind === 'IDENTITY_REVIEW') throw new PatrimonialCrmError('IDENTITY');
      await finish({ locationId: provider.locationId, resolution: identity.kind, contactId: identity.kind === 'REUSE' ? identity.contact.id : null, noteId: null }, identity.kind === 'REUSE' ? identity.contact.id : undefined);
      return 'RESOLVED';
    }
    if (!checkpoint) throw new PatrimonialCrmError('CONFIG');
    if (operation.kind === 'UPSERT_CONTACT') {
      if (checkpoint.contactId) {
        const contact = checkedPatrimonialContact(await provider.getContact(checkpoint.contactId), provider.locationId);
        if (contact.id !== checkpoint.contactId || contact.email !== request.payload.email) throw new PatrimonialCrmError('IDENTITY');
        await finish(checkpoint, checkpoint.contactId); return 'REUSED';
      }
      // Recheck after the original resolve: other requests/funnels may have created
      // this identity meanwhile. The shared identity lock serializes local workers.
      const identity = await resolvePatrimonialIdentity(provider, request.payload);
      if (identity.kind === 'IDENTITY_REVIEW') throw new PatrimonialCrmError('IDENTITY', { outcomeUncertain: operation.reconcileRequired });
      if (identity.kind === 'REUSE') {
        await finish({ ...checkpoint, resolution: 'REUSE', contactId: identity.contact.id }, identity.contact.id); return 'RECONCILED';
      }
      if (operation.reconcileRequired || options.reconciliationOnly) throw new PatrimonialCrmError('UNKNOWN', { outcomeUncertain: true });
      await writeGuard();
      effectMayHaveCommitted = true;
      const contact = checkedPatrimonialContact(await provider.upsertContact({ firstName: request.payload.firstName, lastName: request.payload.lastName, email: request.payload.email, ...(request.payload.phone ? { phone: request.payload.phone } : {}) }), provider.locationId);
      if (contact.email !== request.payload.email || (request.payload.phone && contact.phone !== request.payload.phone)) throw new PatrimonialCrmError('IDENTITY', { outcomeUncertain: true });
      await finish({ ...checkpoint, contactId: contact.id }, contact.id); return 'CREATED';
    }
    const contactId = checkpoint.contactId;
    if (!contactId) throw new PatrimonialCrmError('CONFIG');
    const currentContact = checkedPatrimonialContact(await provider.getContact(contactId), provider.locationId);
    if (currentContact.id !== contactId || currentContact.email !== request.payload.email) throw new PatrimonialCrmError('IDENTITY');
    if (operation.kind === 'ADD_TAGS') {
      if (operation.reconcileRequired || options.reconciliationOnly) {
        const contact = checkedPatrimonialContact(await provider.getContact(contactId), provider.locationId);
        if (!tags.every(tag => contact.tags?.includes(tag))) throw new PatrimonialCrmError('UNKNOWN', { outcomeUncertain: true });
      } else { await writeGuard(); await provider.addTags(contactId, tags); }
      await finish(checkpoint, contactId); return 'TAGGED';
    }
    if (operation.kind === 'ADD_NOTE') {
      if (checkpoint.noteId) { await finish(checkpoint, checkpoint.noteId); return 'NOTE_REUSED'; }
      const marker = patrimonialNoteMarker(request.id);
      if (operation.reconcileRequired || options.reconciliationOnly) {
        if (provider.capabilities.notesRead !== true || !provider.findNoteByRequestMarker) throw new PatrimonialCrmError('CONFIG', { outcomeUncertain: true });
        const note = await provider.findNoteByRequestMarker(contactId, marker);
        if (!note || note.locationId !== provider.locationId || note.contactId !== contactId || note.marker !== marker || !note.id) throw new PatrimonialCrmError('UNKNOWN', { outcomeUncertain: true });
        await finish({ ...checkpoint, noteId: note.id }, note.id); return 'NOTE_RECONCILED';
      }
      const evidence = await store.getConsentEvidence(request.id);
      const privacy = evidence.find(x => x.purpose === 'requested-contact');
      const marketing = evidence.find(x => x.purpose === 'marketing');
      if (!privacy?.choice || !marketing) throw new PatrimonialCrmError('CONFIG');
      const lead = request.payload;
      const body = [marker, `Funnel: ${lead.mode}`, `Source path: ${lead.sourcePath}`, `Ricevuta: ${request.receivedAt}`,
        `Provincia: ${lead.province}`, `Profilo: ${lead.profile || 'Non indicato'}`,
        ...(lead.mode === 'architect-path' ? [`Esperienza: ${lead.experience || 'Non indicata'}`, `Obiettivo: ${lead.goal || 'Non indicato'}`, `Disponibilità: ${lead.availability || 'Non indicata'}`] : []),
        `Privacy / ricontatto: sì · ${privacy.version}`, `Marketing snapshot: ${marketing.choice ? 'sì' : 'no'} · ${marketing.version}`,
        ...Object.entries(lead.utm).map(([key, value]) => `${key}: ${value}`), ...(lead.message ? [`Domanda: ${lead.message}`] : []),
      ].join('\n');
      await writeGuard(); effectMayHaveCommitted = true;
      const note = await provider.addNote(contactId, body);
      if (!note?.id) throw new PatrimonialCrmError('SCHEMA', { outcomeUncertain: true });
      await finish({ ...checkpoint, noteId: note.id }, note.id); return 'NOTED';
    }
    throw new PatrimonialCrmError('CONFIG');
  } catch (error) {
    if (error instanceof PatrimonialStaleLeaseError) return 'STALE';
    try {
      if (error instanceof PatrimonialWorkerHold) { await store.holdOperation(claim()); return 'HOLD'; }
      const crmError = error instanceof PatrimonialCrmError ? error : new PatrimonialCrmError('UNKNOWN', { outcomeUncertain: effectMayHaveCommitted });
      const uncertain = crmError.outcomeUncertain || operation.reconcileRequired || (effectMayHaveCommitted && !crmError.status);
      if (crmError.code === 'IDENTITY') {
        await store.failOperation({ ...claim(), state: 'IDENTITY_REVIEW', errorCode: 'IDENTITY', reconcileRequired: uncertain }); return 'IDENTITY_REVIEW';
      }
      if ((operation.reconcileRequired || !uncertain) && ['AUTH', 'CONFIG', 'SCHEMA', 'UNKNOWN'].includes(crmError.code)) {
        await store.failOperation({ ...claim(), state: 'MANUAL_REVIEW', errorCode: crmError.code, reconcileRequired: uncertain }); return 'MANUAL_REVIEW';
      }
      const decision = await recordPatrimonialFailure(store, operation, {
        kind: crmError.code === 'NETWORK' ? 'network' : crmError.status ? 'http' : 'unknown',
        status: crmError.status, retryAfterSeconds: crmError.retryAfterSeconds, outcomeUncertain: uncertain,
      }, timestamp(), options.jitter);
      // A read-only reconciliation unable to establish the result needs a human,
      // not another blind append or an endless reconciliation loop.
      return decision.state;
    } catch { return 'CHECKPOINT_UNCONFIRMED'; } // lease recovery must reconcile
  }
}

export async function recordPatrimonialFailure(store: PatrimonialStore, operation: PatrimonialOutboxOperation, failure: PatrimonialFailure, now: string, jitter?: number) {
  if (!operation.leaseToken) throw new Error('Missing claim token.');
  const claim = { operationId: operation.id, leaseToken: operation.leaseToken, leaseVersion: operation.leaseVersion, now };
  const decision = patrimonialRetryDecision(operation.attemptCount, failure, now, jitter);
  if (decision.state === 'RETRY_SCHEDULED') await store.scheduleRetry({ ...claim, nextAttemptAt: decision.nextAttemptAt, errorCode: decision.errorCode });
  else await store.failOperation({ ...claim, state: decision.state, errorCode: decision.errorCode, reconcileRequired: operation.reconcileRequired || failure.outcomeUncertain === true });
  return decision;
}

// Separate, explicit opportunity sync. The contact worker/ledger above is unchanged.
// Real HighLevel opportunity methods remain stubs; only fake providers execute writes.
export async function syncPatrimonialOpportunity(options: {
  store: PatrimonialOpportunityStore; provider: PatrimonialOpportunityProvider; mapping: PatrimonialPipelineMapping;
  intentId: string; expectedRevision: number; env?: () => Record<string, string | undefined>; now?: () => Date;
}): Promise<'HOLD' | 'SYNCED' | 'MANUAL_REVIEW' | 'RECONCILE_REQUIRED' | 'CONFLICT'> {
  const { store, provider, mapping } = options;
  const env = options.env ?? (() => process.env);
  const timestamp = () => (options.now ?? (() => new Date()))().toISOString();
  const enabled = () => { const f = patrimonialFlags(env()); return f.v2 && f.crmWrite && f.opportunityWrite; };
  if (!enabled()) return 'HOLD';
  const intent = await store.transaction(tx => tx.getOpportunityIntent(options.intentId));
  if (!intent) return 'MANUAL_REVIEW';
  if (intent.revision !== options.expectedRevision) return 'CONFLICT';
  const entry = resolvedPatrimonialMapping(mapping, intent);
  if (!entry || !entry.stages[intent.stage] || provider.capabilities.opportunitiesRead !== true || provider.capabilities.opportunitiesWrite !== true) return 'HOLD';
  if (provider.locationId !== intent.locationId) return 'MANUAL_REVIEW';
  let claimed: { intent: PatrimonialOpportunityIntent; token: string; reconcileRequired: boolean } | null;
  try { claimed = await store.transaction(tx => tx.claimOpportunitySync(intent.id, intent.revision, timestamp())); }
  catch (error) { if (error instanceof PatrimonialConflictError) return 'CONFLICT'; throw error; }
  if (!claimed) return 'HOLD';
  const query = { locationId: intent.locationId, contactId: intent.contactId, pipelineId: entry.pipelineId! };
  const keyField = entry.fields.hz_intent_key!;
  const projection = patrimonialOpportunityProjection(intent);
  const input: PatrimonialOpportunityWrite = { ...query, pipelineStageId: entry.stages[intent.stage]!, status: patrimonialProviderStatuses[intent.status],
    customFields: Object.fromEntries(Object.entries(projection).map(([key, value]) => [entry.fields[key]!, value])),
    ...(intent.ownerId ? { assignedTo: intent.ownerId } : {}),
    closeReason: intent.closeReason ? { mode: mapping.closeReason.mode as 'NATIVE' | 'CUSTOM', key: mapping.closeReason.key!, value: intent.closeReason } : null,
  };
  let writeStarted = false;
  const finish = async (state: PatrimonialOpportunitySyncState, remote?: PatrimonialRemoteOpportunity) => {
    await store.transaction(tx => tx.finishOpportunitySync(intent.id, intent.revision, claimed!.token, timestamp(), state, remote ? {
      id: remote.id, syncedRevision: intent.revision, pipelineId: remote.pipelineId, stageId: remote.pipelineStageId, status: remote.status, version: remote.version, assignedTo: remote.assignedTo ?? null,
    } : undefined));
    return state === 'SYNC_PENDING' ? 'HOLD' as const : state;
  };
  const checked = (row: PatrimonialRemoteOpportunity) => {
    if (!row || !row.id || !row.version || row.locationId !== query.locationId || row.contactId !== query.contactId || row.pipelineId !== query.pipelineId || !row.customFields || !row.pipelineStageId || !['open','won','lost','abandoned'].includes(row.status)) throw new PatrimonialCrmError('CONFIG');
    return row;
  };
  const compatible = (row: PatrimonialRemoteOpportunity) => row.customFields[keyField] === intent.businessKey || (intent.remote?.id === row.id && intent.closedCycles.some(c => c.businessKey === row.customFields[keyField]));
  const matches = (row: PatrimonialRemoteOpportunity) => row.pipelineStageId === input.pipelineStageId && row.status === input.status && (!input.assignedTo || row.assignedTo === input.assignedTo) && Object.entries(input.customFields).every(([key, value]) => row.customFields[key] === value) && (input.closeReason === null ? row.closeReason == null : !input.closeReason || (row.closeReason?.key === input.closeReason.key && row.closeReason.value === input.closeReason.value));
  const lookup = async () => {
    const rows = await provider.searchOpportunities(query);
    if (!Array.isArray(rows) || rows.length > 1) throw new PatrimonialCrmError('IDENTITY');
    return rows[0] ? checked(rows[0]) : null;
  };
  const authorize = async () => {
    if (!enabled() || !resolvedPatrimonialMapping(mapping, intent) || provider.locationId !== intent.locationId) throw new PatrimonialWorkerHold();
    await store.transaction(tx => tx.authorizeOpportunityWrite(intent.id, intent.revision, claimed!.token, timestamp()));
    if (!enabled()) throw new PatrimonialWorkerHold();
    writeStarted = true;
  };
  try {
    const row = await lookup();
    if (!row) {
      if (claimed.reconcileRequired || intent.remote) return await finish('MANUAL_REVIEW');
      await authorize();
      try {
        const created = checked(await provider.createOpportunity(input));
        if (!compatible(created) || !matches(created)) return await finish('RECONCILE_REQUIRED');
        return await finish('SYNCED', created);
      } catch (error) {
        // A 409 or uncertain create can mean the first create already committed.
        // Reconcile one exact business key; an empty result never permits re-create.
        if (error instanceof PatrimonialCrmError && (error.status === 409 || error.outcomeUncertain)) {
          const existing = await lookup();
          if (existing && compatible(existing) && matches(existing)) return await finish('SYNCED', existing);
          return await finish(existing ? 'MANUAL_REVIEW' : 'RECONCILE_REQUIRED');
        }
        throw error;
      }
    }
    if (!compatible(row)) return await finish('MANUAL_REVIEW');
    if (matches(row)) return await finish('SYNCED', row);
    if (!intent.remote || claimed.reconcileRequired || row.id !== intent.remote.id || row.version !== intent.remote.version || row.pipelineStageId !== intent.remote.stageId || row.status !== intent.remote.status || (row.assignedTo ?? null) !== intent.remote.assignedTo) return await finish('MANUAL_REVIEW');
    await authorize();
    const updated = checked(await provider.updateOpportunity(row.id, { ...input, expectedProviderVersion: row.version }));
    if (!matches(updated)) return await finish('RECONCILE_REQUIRED');
    return await finish('SYNCED', updated);
  } catch (error) {
    if (error instanceof PatrimonialConflictError || error instanceof PatrimonialStaleLeaseError) return 'CONFLICT';
    try {
      if (error instanceof PatrimonialWorkerHold) return await finish('SYNC_PENDING');
      const uncertain = writeStarted && (!(error instanceof PatrimonialCrmError) || error.outcomeUncertain || (error.status !== undefined && error.status >= 500));
      return await finish(uncertain ? 'RECONCILE_REQUIRED' : 'MANUAL_REVIEW');
    } catch { return 'RECONCILE_REQUIRED'; } // lease + dispatch marker survive lost ACK
  }
}
