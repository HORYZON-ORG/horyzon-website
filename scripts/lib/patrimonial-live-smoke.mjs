// CLI-only synthetic orchestrator. No imports from this file into application code.
import { createHash, randomUUID } from 'node:crypto';
import { canonicalPatrimonialPayload, isPatrimonialRequestId, PATRIMONIAL_V2 } from '../../src/lib/public-leads/patrimonial-contract.ts';
import { patrimonialConsentEvidence } from '../../src/lib/public-leads/patrimonial-consents.ts';
import { patrimonialFlags } from '../../src/lib/public-leads/patrimonial-store.ts';
import { getPatrimonialRemoteMapping, validatePatrimonialRemoteMapping } from '../../src/lib/public-leads/patrimonial-highlevel-config.ts';
import { receivePatrimonialOpportunity, patrimonialOpportunityProjection } from '../../src/lib/public-leads/patrimonial-routing.ts';
import { patrimonialNoteMarker, recordPatrimonialFailure } from '../../src/lib/public-leads/patrimonial-sync.ts';
import { pilotForms, pilotExperience, pilotGoals, pilotAvailability } from '../../src/content/patrimonial-funnels.ts';
import { preflightPatrimonialSmoke } from './patrimonial-live-smoke-preflight.mjs';
import { realReadLabels } from './patrimonial-live-smoke-bindings.mjs';

const kinds = ['SYNC_REQUEST', 'RESOLVE_CONTACT', 'UPSERT_CONTACT', 'ADD_TAGS', 'ADD_NOTE'];
const fieldKeys = ['hz_intent_key', 'hz_funnel', 'hz_source', 'hz_source_path', 'hz_requested_at', 'hz_privacy_version', 'hz_marketing_consent_snapshot', 'hz_next_step', 'hz_architect_profile', 'hz_architect_sales_experience', 'hz_architect_goal', 'hz_architect_availability'];
const tags = ['horyzon-patrimoniale', 'percorso-architetto-patrimoniale', 'pilot'];
const hash = value => createHash('sha256').update(value).digest('hex');
export class SmokeError extends Error { constructor(code) { super(code); this.code = code; } }
const requireSmoke = (condition, code) => { if (!condition) throw new SmokeError(code); };
const opaque = id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(id);

export function parseSmokeArgs(argv) {
  const options = { mode: 'dry-run', confirm: false, simulate: false, bindings: null, report: null };
  let modes = 0;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (['--dry-run', '--execute', '--verify', '--cleanup'].includes(arg)) { options.mode = arg.slice(2); modes++; }
    else if (arg === '--confirm-live-write') options.confirm = true;
    else if (arg === '--simulate-provider-failure') options.simulate = true;
    else if (['--bindings', '--report'].includes(arg)) { requireSmoke(argv[i + 1] && !argv[i + 1].startsWith('--'), 'INVALID_ARGUMENTS'); options[arg.slice(2)] = argv[++i]; }
    else throw new SmokeError('INVALID_ARGUMENTS');
  }
  requireSmoke(modes <= 1 && (!options.simulate || options.mode === 'dry-run'), 'INVALID_ARGUMENTS');
  requireSmoke(!['verify', 'cleanup'].includes(options.mode) || !!options.report, 'REPORT_REQUIRED');
  requireSmoke(!['dry-run', 'execute'].includes(options.mode) || !options.report, 'INVALID_ARGUMENTS');
  return options;
}

export function createSmokeRun(now = new Date()) {
  const runId = randomUUID(), requestId = randomUUID(), timestamp = now.toISOString();
  return { version: 'patrimonial-live-smoke-1', runId, requestId, timestamp, mode: 'dry-run', result: 'NOT_RUN',
    contactId: null, opportunityId: null, provisionalId: null, intentId: null, locationId: null,
    initialContactCount: null, contactCreatedByRun: false, executed: false, replay: false,
    operations: Object.fromEntries(kinds.map(kind => [kind, randomUUID()])),
    effects: Object.fromEntries(kinds.map(kind => [kind, 'PLANNED'])), verification: {},
    cleanup: { opportunity: 'NOT_REQUESTED', contact: 'NOT_REQUESTED', audit: 'PRESERVED' }, warnings: [], error: null };
}
export function syntheticLead(run) {
  return { contractVersion: PATRIMONIAL_V2, mode: 'architect-path', sourcePath: pilotForms['architect-path'].path,
    firstName: 'Horyzon', lastName: 'Synthetic Test', email: `patrimonial-test+${Date.parse(run.timestamp)}-${run.runId}@example.invalid`, phone: '',
    province: 'TEST', profile: pilotForms['architect-path'].profiles[0], experience: 'No', goal: 'Sto esplorando', availability: 'Part-time',
    message: `SYNTHETIC TEST ${run.runId}; requestId=${run.requestId}; ARCHITECT_PATH; ${run.timestamp}; NO PRODUCTION LEAD`,
    consent: true, marketingConsent: false, utm: {}, eventEditionId: null };
}
export function assertSyntheticData(lead, run) {
  requireSmoke(isPatrimonialRequestId(run.runId) && isPatrimonialRequestId(run.requestId) && Number.isFinite(Date.parse(run.timestamp)), 'INVALID_TEST_DATA');
  requireSmoke(JSON.stringify(lead) === JSON.stringify(syntheticLead(run)), 'INVALID_TEST_DATA');
  requireSmoke(!lead.phone && lead.email.endsWith('@example.invalid') && lead.marketingConsent === false
    && pilotForms['architect-path'].profiles.includes(lead.profile) && pilotExperience.includes(lead.experience)
    && pilotGoals.includes(lead.goal) && pilotAvailability.includes(lead.availability), 'INVALID_TEST_DATA');
}
export function assertSmokeReport(run) {
  requireSmoke(run?.version === 'patrimonial-live-smoke-1', 'INVALID_REPORT');
  assertSyntheticData(syntheticLead(run), run);
  requireSmoke(new Date(run.timestamp).toISOString() === run.timestamp && ['dry-run', 'DRY_RUN', 'execute', 'verify', 'cleanup'].includes(run.mode)
    && ['PASS', 'FAIL', 'NOT_RUN', 'DRY_RUN_PASS', 'BLOCKED'].includes(run.result) && [run.executed, run.replay, run.contactCreatedByRun].every(v => typeof v === 'boolean')
    && (run.initialContactCount === null || (Number.isInteger(run.initialContactCount) && run.initialContactCount >= 0)), 'INVALID_REPORT');
  requireSmoke(kinds.every(k => isPatrimonialRequestId(run.operations?.[k])) && new Set(Object.values(run.operations)).size === kinds.length, 'INVALID_REPORT');
  requireSmoke([run.contactId, run.opportunityId, run.provisionalId, run.intentId, run.locationId].every(v => v === null || opaque(v)), 'INVALID_REPORT');
  requireSmoke(run.cleanup && typeof run.cleanup === 'object' && Array.isArray(run.warnings), 'INVALID_REPORT');
}
export function assertLiveSmoke(options, env) {
  const flags = patrimonialFlags(env);
  requireSmoke(env.PATRIMONIAL_SYNTHETIC_TEST_ENABLED === 'true' && flags.v2 && flags.crmWrite && flags.opportunityWrite, 'LIVE_FLAGS_REQUIRED');
  requireSmoke(!flags.booking && !flags.messages && !flags.webhook, 'UNRELATED_FLAGS_ENABLED');
  requireSmoke(!['execute', 'cleanup'].includes(options.mode) || options.confirm === true, 'LIVE_CONFIRM_REQUIRED');
}

// Construct only known report fields. Provider responses, errors, env and lease
// tokens never enter the report. Redact configured credentials even in IDs.
export function publicSmokeReport(run, env = {}) {
  const keys = ['version', 'runId', 'requestId', 'timestamp', 'mode', 'result', 'contactId', 'opportunityId', 'provisionalId', 'intentId', 'locationId', 'initialContactCount', 'contactCreatedByRun', 'executed', 'replay', 'operations', 'effects', 'verification', 'cleanup', 'warnings', 'error'];
  const value = Object.fromEntries(keys.filter(k => Object.hasOwn(run, k)).map(k => [k, run[k]]));
  value.operations = Object.fromEntries(kinds.map(k => [k, run.operations?.[k] ?? null]));
  const states = new Set(['PLANNED', 'SYNCED', 'RECONCILE_REQUIRED', 'MANUAL_REVIEW']);
  value.effects = Object.fromEntries(kinds.map(k => [k, states.has(run.effects?.[k]) ? run.effects[k] : 'PLANNED']));
  const checks = ['request', 'intent', 'consentEvidence', 'outboxSynced', 'remoteIds', 'domainEvents', 'contact', 'opportunity', 'noDuplicateContact', 'noDuplicateOpportunity', 'replay', 'localOnly', 'retrySchedule', 'noDuplicateEffect', 'reconcileRequired'];
  value.verification = Object.fromEntries(checks.filter(k => typeof run.verification?.[k] === 'boolean').map(k => [k, run.verification[k]]));
  if (['PASS', 'SKIPPED'].includes(run.verification?.note)) value.verification.note = run.verification.note;
  const cleanupStates = new Set(['NOT_REQUESTED', 'DELETED', 'ALREADY_ABSENT', 'MANUAL_CLEANUP_REQUIRED']);
  value.cleanup = { opportunity: cleanupStates.has(run.cleanup?.opportunity) ? run.cleanup.opportunity : 'NOT_REQUESTED',
    contact: cleanupStates.has(run.cleanup?.contact) ? run.cleanup.contact : 'NOT_REQUESTED', audit: 'PRESERVED' };
  value.warnings = (run.warnings ?? []).filter(w => ['LIVE_NOT_EXECUTED', 'VERIFIED_BINDINGS_REQUIRED', 'NOTE_READ_SKIPPED', 'MANUAL_CLEANUP_REQUIRED'].includes(w));
  if (run.result === 'DRY_RUN_PASS' || run.result === 'BLOCKED') {
    value.mode = 'DRY_RUN'; value.status = run.result === 'DRY_RUN_PASS' ? 'PASS' : 'BLOCKED';
    for (const key of ['configReady', 'mappingReady', 'storeReady', 'providerBindingReady', 'syntheticGuardReady', 'reportPathReady', 'liveGuardsEnabled']) value[key] = run[key] === true;
    value.mappingChecks = Object.fromEntries(['architectPath', 'a01', 'tags', 'customFields'].map(k => [k, run.mappingChecks?.[k] === true]));
    value.storeReadinessScope = run.storeReadinessScope === 'REMOTE_HEALTH' ? 'REMOTE_HEALTH' : 'LOCAL_CONFIG_ONLY';
    value.storeHealthChecked = run.storeHealthChecked === true;
    value.remoteReads = (run.remoteReads ?? []).filter(label => realReadLabels.includes(label)); value.writesAttempted = false;
    value.blockers = Array.isArray(run.blockers) ? run.blockers.filter(b => typeof b === 'string') : ['dry-run pre-flight failed'];
  }
  let text = JSON.stringify(value);
  for (const [key, secret] of Object.entries(env)) if (/(?:TOKEN|SECRET|KEY|PASSWORD|AUTHORIZATION)/i.test(key) && typeof secret === 'string' && secret.length) {
    for (const variant of new Set([secret, encodeURIComponent(secret), Buffer.from(secret).toString('base64')])) text = text.replaceAll(JSON.stringify(variant).slice(1, -1), '[REDACTED]');
  }
  return JSON.parse(text);
}
export function smokeMarkdown(report) {
  return `# Patrimonial synthetic smoke\n\nResult: ${report.result}\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n`;
}
function candidate(run, lead) {
  return { id: run.requestId, contractVersion: PATRIMONIAL_V2, payload: lead, payloadHash: hash(canonicalPatrimonialPayload(lead)), receivedAt: run.timestamp,
    replayExpiresAt: new Date(Date.parse(run.timestamp) + 90 * 86400000).toISOString(), technicalState: 'RECEIVED', intentId: null,
    receipt: { ok: true, requestId: run.requestId, receiptStatus: 'received', crmStatus: 'pending' } };
}
function freshOperation(run, kind, now, intentId) {
  // Fresh synthetic effects are born leased, one at a time, in the same atomic
  // commit as their predecessor's completion. Never claim the global queue.
  return { id: run.operations[kind], operationKey: `${run.requestId}:${kind}:v1`, kind, requestId: run.requestId, intentId,
    identityLockKey: hash(syntheticLead(run).email), technicalState: 'SYNCING', createdAt: now, nextAttemptAt: now,
    attemptCount: 1, leaseToken: randomUUID(), leaseVersion: 1, leaseExpiresAt: new Date(Date.parse(now) + 60000).toISOString(), reconcileRequired: false, lastErrorCode: null };
}
async function acquire(runtime, run, lead, timestamp, first = false) {
  return runtime.store.transaction(async tx => {
    const found = await tx.createOrReplayRequest(candidate(run, lead), timestamp);
    if (found.replay) return found;
    requireSmoke(first, 'REPLAY_FAILED');
    const intent = await tx.createOrReuseIntent({ id: randomUUID(), provisionalKey: hash(JSON.stringify([lead.mode, lead.email, null])), mode: lead.mode,
      requestedEditionId: null, contactId: null, opportunityId: null, identityResolved: false, technicalState: 'IDENTITY_REVIEW', createdAt: run.timestamp });
    for (const consent of patrimonialConsentEvidence(candidate(run, lead))) await tx.appendConsentEvidence(consent);
    await tx.attachIntent(run.requestId, intent.id);
    await tx.enqueueOperation(freshOperation(run, 'SYNC_REQUEST', timestamp, intent.id));
    await tx.appendEvent({ id: `${run.requestId}:received`, name: 'request_received', requestId: run.requestId, intentId: intent.id, occurredAt: run.timestamp, contractVersion: PATRIMONIAL_V2 });
    return found;
  });
}
function checkedContact(contact, run, lead) {
  requireSmoke(contact && opaque(contact.id) && contact.locationId === run.locationId && contact.email === lead.email
    && contact.firstName === lead.firstName && contact.lastName === lead.lastName && !contact.phone, 'CONTACT_SCOPE_MISMATCH');
  return contact;
}
function opportunityInput(run, intent, resources) {
  const projection = patrimonialOpportunityProjection(intent);
  return { locationId: run.locationId, contactId: run.contactId, pipelineId: resources.pipelines.ARCHITECT_PATH.id,
    pipelineStageId: resources.pipelines.ARCHITECT_PATH.stages.A01.id, status: 'open',
    customFields: Object.fromEntries(fieldKeys.map(key => [resources.opportunityFields[key].id, projection[key]])) };
}
function checkedOpportunity(row, expected) {
  requireSmoke(row && opaque(row.id) && typeof row.version === 'string' && !!row.version
    && row.locationId === expected.locationId && row.contactId === expected.contactId && row.pipelineId === expected.pipelineId
    && row.pipelineStageId === expected.pipelineStageId && row.status === 'open'
    && Object.entries(expected.customFields).every(([key, value]) => row.customFields?.[key] === value), 'OPPORTUNITY_SCOPE_MISMATCH');
  return row;
}
async function localEvidence(runtime, run, lead) {
  const evidence = await runtime.store.transaction(async tx => {
    const request = await tx.getRequest(run.requestId), consents = await tx.getConsentEvidence(run.requestId), operations = [];
    // The RPC journal is sequential: concurrent preview calls are not supported.
    for (const kind of kinds) operations.push(await tx.getOperation(run.operations[kind]));
    return { request, consents, operations, intent: run.intentId ? await tx.getOpportunityIntent(run.intentId) : null };
  });
  const request = evidence.request;
  requireSmoke(request?.payloadHash === candidate(run, lead).payloadHash && canonicalPatrimonialPayload(request.payload) === canonicalPatrimonialPayload(lead)
    && request.intentId === run.provisionalId && request.crm?.locationId === run.locationId && request.crm?.contactId === run.contactId, 'STORE_EVIDENCE_MISMATCH');
  requireSmoke(evidence.operations.every((op, i) => op?.id === run.operations[kinds[i]] && op.kind === kinds[i] && op.requestId === run.requestId && op.intentId === run.provisionalId && op.technicalState === 'SYNCED'), 'OUTBOX_NOT_SYNCED');
  requireSmoke(evidence.consents.length === 2 && evidence.consents.some(c => c.purpose === 'requested-contact' && c.choice === true)
    && evidence.consents.some(c => c.purpose === 'marketing' && c.choice === false), 'CONSENT_EVIDENCE_MISSING');
  requireSmoke(evidence.intent?.scopeKey === `synthetic:${run.runId}` && evidence.intent.contactId === run.contactId && evidence.intent.locationId === run.locationId
    && evidence.intent.pipeline === 'ARCHITECT_PATH' && evidence.intent.stage === 'A01' && evidence.intent.status === 'OPEN'
    && evidence.intent.requestIds.includes(run.requestId) && evidence.intent.remote?.id === run.opportunityId, 'INTENT_EVIDENCE_MISMATCH');
  const audit = await runtime.audit(run);
  requireSmoke(audit.provisionalExists === true && audit.opportunityId === run.opportunityId && audit.contactId === run.contactId && audit.domainEventsPresent === true, 'AUDIT_EVIDENCE_MISSING');
  return evidence;
}
async function verify(runtime, run, lead, resources) {
  const evidence = await localEvidence(runtime, run, lead);
  const contact = checkedContact(await runtime.crm.getContact(run.contactId), run, lead);
  requireSmoke(tags.every(tag => contact.tags?.includes(tag)), 'TAGS_MISSING');
  checkedOpportunity(await runtime.opportunities.getOpportunity(run.opportunityId), opportunityInput(run, evidence.intent, resources));
  const matches = await runtime.crm.findContactsByEmail(lead.email);
  requireSmoke(matches.length === 1 && matches[0].id === run.contactId, 'CONTACT_DUPLICATED');
  const opportunities = await runtime.opportunities.searchOpportunities({ locationId: run.locationId, contactId: run.contactId, pipelineId: resources.pipelines.ARCHITECT_PATH.id });
  requireSmoke(opportunities.length === 1 && opportunities[0].id === run.opportunityId, 'OPPORTUNITY_DUPLICATED');
  let note = 'SKIPPED';
  if (runtime.crm.capabilities.notesRead === true) {
    const found = await runtime.crm.findNoteByRequestMarker(run.contactId, patrimonialNoteMarker(run.requestId));
    requireSmoke(found?.id === evidence.request.crm.noteId && found.contactId === run.contactId && found.locationId === run.locationId, 'NOTE_VERIFICATION_FAILED'); note = 'PASS';
  } else if (!run.warnings.includes('NOTE_READ_SKIPPED')) run.warnings.push('NOTE_READ_SKIPPED');
  run.verification = { request: true, intent: true, consentEvidence: true, outboxSynced: true, remoteIds: true, domainEvents: true, contact: true, opportunity: true, noDuplicateContact: true, noDuplicateOpportunity: true, note, replay: run.replay };
}

export async function runPatrimonialSmoke({ options, env = {}, run = createSmokeRun(), runtimeFactory, persist = async () => {}, now = () => new Date(), reportPaths, preflightBindings, loadPreflightBindings, validateRemote }) {
  assertSmokeReport(run); run.mode = options.mode; run.error = null;
  const save = async () => persist(publicSmokeReport(run, env));
  try {
    await save();
    if (options.simulate) { requireSmoke(options.mode === 'dry-run', 'INVALID_ARGUMENTS'); run.verification = await simulateSmokeFailure(); run.result = 'PASS'; await save(); return run; }
    if (options.mode === 'dry-run') {
      const readiness = await preflightPatrimonialSmoke({ env, reportPaths, bindings: preflightBindings, loadBindings: loadPreflightBindings,
        syntheticGuard: () => assertSyntheticData(syntheticLead(run), run), validateRemote });
      Object.assign(run, readiness); run.result = readiness.blockers.length ? 'BLOCKED' : 'DRY_RUN_PASS';
      run.warnings = ['LIVE_NOT_EXECUTED']; await save(); return run;
    }
    assertLiveSmoke(options, env);
    let resources;
    try { resources = getPatrimonialRemoteMapping(env); } catch { throw new SmokeError('MAPPING_NOT_READY'); }
    requireSmoke(validatePatrimonialRemoteMapping(resources).remoteMappingReady, 'MAPPING_NOT_READY');
    const guard = () => assertLiveSmoke(options, env);
    const runtime = await runtimeFactory({ guard, resources });
    requireSmoke(runtime?.store?.kind === 'durable', 'DURABLE_STORE_REQUIRED');
    await runtime.store.health();
    runtime.crm.assertReady(options.mode !== 'verify');
    requireSmoke(opaque(runtime.crm.locationId), 'LOCATION_REQUIRED');
    requireSmoke(run.locationId === null || run.locationId === runtime.crm.locationId, 'LOCATION_MISMATCH'); run.locationId = runtime.crm.locationId;
    const lead = syntheticLead(run); assertSyntheticData(lead, run);
    if (options.mode === 'execute') {
      requireSmoke(!run.executed && !await runtime.store.getRequest(run.requestId), 'EXISTING_RUN_REFUSED');
      const initial = await runtime.crm.findContactsByEmail(lead.email); run.initialContactCount = initial.length;
      requireSmoke(initial.length === 0, 'EXISTING_CONTACT_REFUSED'); await save();
      guard(); await acquire(runtime, run, lead, now().toISOString(), true); run.executed = true;
      run.provisionalId = (await runtime.store.getRequest(run.requestId)).intentId; await save();
      for (const [index, kind] of kinds.entries()) {
        const op = await runtime.store.getOperation(run.operations[kind]);
        requireSmoke(op?.requestId === run.requestId && op.kind === kind && op.intentId === run.provisionalId && op.technicalState === 'SYNCING' && op.leaseToken, 'OPERATION_SCOPE_MISMATCH');
        const claim = () => ({ operationId: op.id, leaseToken: op.leaseToken, leaseVersion: op.leaseVersion, now: now().toISOString() });
        let checkpoint = (await runtime.store.getRequest(run.requestId)).crm, remoteId, writeStarted = false;
        try {
          guard(); await runtime.store.renewLease(claim());
          if (kind === 'RESOLVE_CONTACT') {
            requireSmoke((await runtime.crm.findContactsByEmail(lead.email)).length === 0, 'EXISTING_CONTACT_REFUSED');
            checkpoint = { locationId: run.locationId, resolution: 'NEW', contactId: null, noteId: null };
          }
          if (kind === 'UPSERT_CONTACT') {
            requireSmoke((await runtime.crm.findContactsByEmail(lead.email)).length === 0, 'EXISTING_CONTACT_REFUSED');
            guard(); writeStarted = true;
            const contact = checkedContact(await runtime.crm.upsertContact({ firstName: lead.firstName, lastName: lead.lastName, email: lead.email }), run, lead);
            run.contactId = contact.id; run.contactCreatedByRun = true; remoteId = contact.id; checkpoint = { ...checkpoint, contactId: contact.id }; await save();
          }
          if (kind === 'ADD_TAGS' || kind === 'ADD_NOTE') {
            checkedContact(await runtime.crm.getContact(run.contactId), run, lead); guard();
            if (kind === 'ADD_TAGS') { await runtime.crm.addTags(run.contactId, tags); remoteId = run.contactId; }
            else {
              const body = `${patrimonialNoteMarker(run.requestId)}\n${lead.message}`;
              writeStarted = true; const note = await runtime.crm.addNote(run.contactId, body);
              requireSmoke(opaque(note?.id), 'NOTE_VERIFICATION_FAILED'); checkpoint = { ...checkpoint, noteId: note.id }; remoteId = note.id;
            }
          }
          guard(); await runtime.store.completeCrmOperation({ ...claim(), checkpoint, remoteId,
            ...(index + 1 < kinds.length ? { followUps: [freshOperation(run, kinds[index + 1], now().toISOString(), run.provisionalId)] } : {}) });
          run.effects[kind] = 'SYNCED'; await save();
        } catch (error) {
          const uncertain = writeStarted || error?.outcomeUncertain === true;
          try { await runtime.store.failOperation({ ...claim(), state: uncertain ? 'RECONCILE_REQUIRED' : 'MANUAL_REVIEW', errorCode: 'UNKNOWN', reconcileRequired: uncertain }); } catch { /* A lost checkpoint is never retried blindly. */ }
          run.effects[kind] = uncertain ? 'RECONCILE_REQUIRED' : 'MANUAL_REVIEW'; throw error;
        }
      }
      guard();
      const intent = await receivePatrimonialOpportunity(runtime.store, { pipeline: 'ARCHITECT_PATH', contact: { id: run.contactId, locationId: run.locationId, identityResolved: true },
        scopeKey: `synthetic:${run.runId}`, request: { requestId: run.requestId, receivedAt: run.timestamp, source: 'website-pilot', sourcePath: lead.sourcePath,
          privacyVersion: patrimonialConsentEvidence(candidate(run, lead))[0].version, marketingConsent: false, utm: {} },
        actor: { id: `synthetic:${run.runId}`, type: 'SYSTEM' }, nextStepAt: new Date(Date.parse(run.timestamp) + 86400000).toISOString(),
        qualification: { profile: lead.profile, salesExperience: lead.experience, goal: lead.goal, availability: lead.availability } });
      run.intentId = intent.id; await save();
      const claimed = await runtime.store.transaction(tx => tx.claimOpportunitySync(intent.id, intent.revision, now().toISOString()));
      requireSmoke(claimed && !claimed.reconcileRequired, 'OPPORTUNITY_RECONCILIATION_REQUIRED');
      const expected = opportunityInput(run, intent, resources);
      let dispatched = false;
      try {
        const matches = await runtime.opportunities.searchOpportunities({ locationId: run.locationId, contactId: run.contactId, pipelineId: expected.pipelineId });
        requireSmoke(matches.length === 0, 'EXISTING_OPPORTUNITY_REFUSED');
        guard(); await runtime.store.transaction(tx => tx.authorizeOpportunityWrite(intent.id, intent.revision, claimed.token, now().toISOString())); guard();
        dispatched = true; const opportunity = checkedOpportunity(await runtime.opportunities.createOpportunity(expected), expected);
        run.opportunityId = opportunity.id; await save();
        checkedOpportunity(await runtime.opportunities.getOpportunity(opportunity.id), expected);
        guard(); await runtime.store.transaction(tx => tx.finishOpportunitySync(intent.id, intent.revision, claimed.token, now().toISOString(), 'SYNCED', {
          id: opportunity.id, syncedRevision: intent.revision, pipelineId: opportunity.pipelineId, stageId: opportunity.pipelineStageId, status: opportunity.status, version: opportunity.version, assignedTo: null }));
      } catch (error) {
        try { await runtime.store.transaction(tx => tx.finishOpportunitySync(intent.id, intent.revision, claimed.token, now().toISOString(), dispatched ? 'RECONCILE_REQUIRED' : 'MANUAL_REVIEW')); } catch { /* Preserve dispatch marker. */ }
        throw error;
      }
      const replay = await acquire(runtime, run, lead, now().toISOString());
      requireSmoke(replay.replay === true && replay.request.receipt.requestId === run.requestId && replay.request.intentId === run.provisionalId, 'REPLAY_FAILED');
      run.replay = true; await verify(runtime, run, lead, resources);
    } else {
      requireSmoke(run.executed && run.contactId && run.opportunityId && run.intentId && run.provisionalId && run.replay, 'EXECUTED_REPORT_REQUIRED');
      if (options.mode === 'verify') await verify(runtime, run, lead, resources);
      else if (options.mode === 'cleanup') {
        const evidence = await localEvidence(runtime, run, lead);
        requireSmoke(run.contactCreatedByRun === true && run.initialContactCount === 0 && evidence.request.crm.resolution === 'NEW'
          && evidence.operations.find(o => o.kind === 'UPSERT_CONTACT').remoteId === run.contactId, 'CLEANUP_OWNERSHIP_REFUSED');
        const readContact = id => runtime.readContact ? runtime.readContact(id) : runtime.crm.getContact(id);
        const contact = await readContact(run.contactId);
        if (contact) checkedContact(contact, run, lead);
        const opportunity = await runtime.opportunities.getOpportunity(run.opportunityId);
        if (opportunity) checkedOpportunity(opportunity, opportunityInput(run, evidence.intent, resources));
        if (!opportunity) run.cleanup.opportunity = 'ALREADY_ABSENT';
        else if (runtime.opportunities.deleteOpportunity) { guard(); await runtime.opportunities.deleteOpportunity(run.opportunityId); requireSmoke(!await runtime.opportunities.getOpportunity(run.opportunityId), 'CLEANUP_NOT_CONFIRMED'); run.cleanup.opportunity = 'DELETED'; }
        else run.cleanup.opportunity = 'MANUAL_CLEANUP_REQUIRED';
        await save();
        if (!contact) run.cleanup.contact = 'ALREADY_ABSENT';
        else if (!['DELETED', 'ALREADY_ABSENT'].includes(run.cleanup.opportunity) || !runtime.deleteContact || !runtime.listContactOpportunities) run.cleanup.contact = 'MANUAL_CLEANUP_REQUIRED';
        else {
          const remaining = await runtime.listContactOpportunities(run.contactId);
          requireSmoke(remaining.complete === true && remaining.opportunities.length === 0, 'CLEANUP_FOREIGN_RELATION_REFUSED');
          checkedContact(await readContact(run.contactId), run, lead); guard(); await runtime.deleteContact(run.contactId);
          requireSmoke(!await readContact(run.contactId), 'CLEANUP_NOT_CONFIRMED'); run.cleanup.contact = 'DELETED';
        }
        if (Object.values(run.cleanup).includes('MANUAL_CLEANUP_REQUIRED')) run.warnings.push('MANUAL_CLEANUP_REQUIRED');
      } else throw new SmokeError('INVALID_ARGUMENTS');
    }
    run.result = 'PASS';
  } catch (error) {
    run.result = options.mode === 'dry-run' && !options.simulate ? 'BLOCKED' : 'FAIL';
    run.error = error instanceof SmokeError ? error.code : 'SMOKE_FAILED';
    if (run.result === 'BLOCKED') run.blockers = ['dry-run pre-flight or report generation failed'];
  }
  await save(); return run;
}

export async function simulateSmokeFailure() {
  const time = '2026-10-15T10:00:00.000Z', operations = new Map(), effects = new Set();
  const op = { id: randomUUID(), leaseToken: randomUUID(), leaseVersion: 1, attemptCount: 1, reconcileRequired: false };
  const store = { async scheduleRetry(input) { operations.set(input.operationId, { state: 'RETRY_SCHEDULED', ...input }); }, async failOperation(input) { operations.set(input.operationId, input); } };
  const retry = await recordPatrimonialFailure(store, op, { kind: 'http', status: 429 }, time, 0);
  requireSmoke(retry.state === 'RETRY_SCHEDULED' && Date.parse(retry.nextAttemptAt) > Date.parse(time), 'LOCAL_SIMULATION_FAILED');
  effects.add(op.id); // Simulate a committed create whose response was lost.
  const uncertain = await recordPatrimonialFailure(store, op, { kind: 'network', outcomeUncertain: true }, time, 0);
  requireSmoke(uncertain.state === 'RECONCILE_REQUIRED' && effects.size === 1, 'LOCAL_SIMULATION_FAILED');
  return { localOnly: true, retrySchedule: true, noDuplicateEffect: true, reconcileRequired: true };
}
