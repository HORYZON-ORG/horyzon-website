// Synthetic reconstruction of the second run's post-CRM state. No env, network
// or tmp inputs; the remote location is intentionally replaced by a fixture ID.
import { createHash } from 'node:crypto';
import { canonicalPatrimonialPayload } from '../../src/lib/public-leads/patrimonial-contract.ts';
import { patrimonialConsentEvidence } from '../../src/lib/public-leads/patrimonial-consents.ts';
import { createSmokeRun, syntheticLead } from '../lib/patrimonial-live-smoke.mjs';

export function postCrmFixture() {
  const run = createSmokeRun(new Date('2026-10-15T09:57:53.300Z'));
  run.runId = '00000000-0000-4000-8000-000000000001';
  run.requestId = '309eda48-e7d7-44a6-9e21-4dc21758aded';
  const provisionalId = '00000000-0000-4000-8000-000000000002';
  const contactId = 'I2b3PgshYo5zYHK1qg8w', locationId = 'fixture-location', payload = syntheticLead(run);
  const digest = value => createHash('sha256').update(value).digest('hex');
  const checkpoint = { locationId, contactId, resolution: 'NEW', noteId: 'fixture-note' };
  const request = { id: run.requestId, contractVersion: payload.contractVersion, payload,
    payloadHash: digest(canonicalPatrimonialPayload(payload)), receivedAt: run.timestamp,
    replayExpiresAt: '2027-01-13T09:57:53.300Z', technicalState: 'SYNC_PENDING', intentId: provisionalId, crm: checkpoint,
    receipt: { ok: true, requestId: run.requestId, receiptStatus: 'received', crmStatus: 'pending' } };
  const provisional = { id: provisionalId, provisionalKey: digest(JSON.stringify([payload.mode, payload.email, null])), mode: payload.mode,
    requestedEditionId: null, contactId, opportunityId: null, identityResolved: true, technicalState: 'SYNC_PENDING', createdAt: run.timestamp };
  const operations = ['SYNC_REQUEST', 'RESOLVE_CONTACT', 'UPSERT_CONTACT', 'ADD_TAGS', 'ADD_NOTE'].map((kind, index) => ({
    id: `00000000-0000-4000-8000-00000000001${index}`, operationKey: `${run.requestId}:${kind}:v1`, kind,
    requestId: run.requestId, intentId: provisionalId, technicalState: 'SYNCED', createdAt: run.timestamp,
    nextAttemptAt: run.timestamp, attemptCount: 1, leaseToken: null, leaseVersion: 1, leaseExpiresAt: null,
    reconcileRequired: false, lastErrorCode: null, ...(kind === 'UPSERT_CONTACT' || kind === 'ADD_TAGS' ? { remoteId: contactId } : kind === 'ADD_NOTE' ? { remoteId: 'fixture-note' } : {}),
  }));
  const consents = patrimonialConsentEvidence(request);
  const event = { id: `${run.requestId}:received`, name: 'request_received', requestId: run.requestId,
    intentId: provisionalId, occurredAt: run.timestamp, contractVersion: payload.contractVersion };
  const seed = { pipeline: 'ARCHITECT_PATH', contact: { id: contactId, locationId, identityResolved: true }, scopeKey: `synthetic:${run.runId}`,
    request: { requestId: run.requestId, receivedAt: run.timestamp, source: 'website-pilot', sourcePath: payload.sourcePath,
      privacyVersion: consents[0].version, marketingConsent: false, utm: {} }, actor: { id: `synthetic:${run.runId}`, type: 'SYSTEM' },
    nextStepAt: '2026-10-16T09:57:53.300Z', qualification: { profile: 'Imprenditore', salesExperience: 'No', goal: 'Sto esplorando', availability: 'Part-time' } };
  return { request, provisional, operations, consents, event, seed };
}
