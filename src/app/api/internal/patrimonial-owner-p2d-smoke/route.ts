import { NextRequest, NextResponse } from 'next/server';
import { SupabasePatrimonialStore } from '@/lib/public-leads/patrimonial-supabase';
import { executePatrimonialAssignment } from '@/lib/public-leads/patrimonial-assignments';
import { PatrimonialHighLevelOwnerProvider } from '@/lib/public-leads/patrimonial-owner-provider';
import { runPatrimonialOwnerSyncOnce } from '@/lib/public-leads/patrimonial-owner-sync';
import { applyPatrimonialCommand, type PatrimonialOpportunityIntent } from '@/lib/public-leads/patrimonial-routing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = 'https://pmkyeqrfkunypfkbjnyg.supabase.co';
const LOCATION_ID = 'wug0aUS5521FsWUoLBXQ';
const CONTACT_ID = '4vILVZBD07YR9GBz8YmE';
const OPPORTUNITY_ID = 'kURMOT0moLjPxio7kjia';
const REMOTE_USER_ID = 'bnrWlUfYInhY7dXN8m4k';
const PIPELINE_ID = 'N2hsjiShcdMbzAITjxOA';
const STAGE_ID = '1506fbbf-c48e-4896-a52e-1464a7105460';
const INTENT_ID = '0c78cb2a-45fb-4e7d-a475-d8f5b266521a';
const FIRST_REQUEST_ID = '4f70453d-c2f1-4e7e-9e29-8a81e364881f';
const GROUP_KEY = 'p2d_owner_worker_smoke_20261018_group_v2';
const BUSINESS_KEY = 'p2d_owner_worker_smoke_20261018_business_v2';
const CONFIRM = 'p2d-worker-smoke-20261018-v2-917b4d';

function smokeEnv() {
  return {
    ...process.env,
    HIGHLEVEL_LOCATION_ID: LOCATION_ID,
    PATRIMONIAL_V2_ENABLED: 'true',
    PATRIMONIAL_ASSIGNMENTS_ENABLED: 'true',
    PATRIMONIAL_CRM_WRITE_ENABLED: 'true',
    PATRIMONIAL_OWNER_SYNC_ENABLED: 'true',
  };
}

async function restRows(secret: string, path: string) {
  const headers: Record<string,string> = { apikey: secret, Accept: 'application/json' };
  if (!secret.startsWith('sb_')) headers.Authorization = `Bearer ${secret}`;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('REST_READ_FAILED');
  return await response.json() as Array<Record<string,unknown>>;
}

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== 'preview' || request.nextUrl.searchParams.get('confirm') !== CONFIRM) {
    return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 });
  }
  const supabaseSecret = process.env.PATRIMONIAL_SMOKE_SUPABASE_SECRET?.trim();
  const highLevelToken = process.env.HIGHLEVEL_PRIVATE_TOKEN?.trim();
  if (!supabaseSecret || !highLevelToken) {
    return NextResponse.json({
      ok:false, reason:'runtime_config_missing',
      supabaseSecretPresent:Boolean(supabaseSecret), highLevelTokenPresent:Boolean(highLevelToken),
    }, { status:503, headers:{'Cache-Control':'no-store'} });
  }
  const keyKind = supabaseSecret.startsWith('sb_secret_') ? 'secret'
    : supabaseSecret.startsWith('sb_publishable_') ? 'publishable'
      : supabaseSecret.startsWith('eyJ') ? 'legacy-jwt' : 'unknown';
  if (keyKind !== 'secret' && keyKind !== 'legacy-jwt') {
    return NextResponse.json({ ok:false, reason:'smoke_supabase_key_not_server_secret', keyKind }, { status:503, headers:{'Cache-Control':'no-store'} });
  }

  const env = smokeEnv;
  const now = new Date();
  const receivedAt = now.toISOString();
  const nextStepAt = new Date(now.getTime() + 86_400_000).toISOString();
  const seed: PatrimonialOpportunityIntent = {
    id: INTENT_ID,
    groupKey: GROUP_KEY,
    businessKey: BUSINESS_KEY,
    pipeline: 'ARCHITECT_PATH',
    contactId: CONTACT_ID,
    locationId: LOCATION_ID,
    scopeKey: 'p2d_owner_worker_smoke_v2',
    cycle: 1,
    revision: 1,
    stage: 'A01',
    status: 'OPEN',
    ownerId: null,
    nextStep: 'ASSIGN',
    nextStepAt,
    closeReason: null,
    firstRequest: {
      requestId: FIRST_REQUEST_ID,
      receivedAt,
      source: 'manual-request',
      sourcePath: '/internal/patrimonial-owner-p2d-smoke',
      privacyVersion: 'p2d-smoke-v1',
      marketingConsent: false,
      utm: {},
    },
    requestIds: [],
    ownerReviewRequired: false,
    architect: {
      profile: '', salesExperience: '', goal: '', availability: '', openAnswer: '',
      presentation: null, presentationAttendance: 'UNKNOWN', qualified: false,
      interview: null, interviewCompleted: false, interviewOutcome: 'PENDING', eligibility: 'PENDING',
    },
    consultation: null,
    events: [],
    closedCycles: [],
    remote: {
      id: OPPORTUNITY_ID,
      syncedRevision: 1,
      pipelineId: PIPELINE_ID,
      stageId: STAGE_ID,
      status: 'open',
      version: '2026-10-18T20:08:55.257Z',
      assignedTo: null,
    },
  };

  const provider = new PatrimonialHighLevelOwnerProvider({
    env,
    proof: {
      runtimeTokenVerified: true,
      verifiedLocationId: LOCATION_ID,
      version: 'v3',
      usersRead: true,
      opportunityOwnerRead: true,
      opportunityOwnerWrite: true,
      ownerOnlyUpdate: true,
      nullableAssignedTo: false,
      omittedAssignedToMeansUnassigned: true,
    },
  });

  const actor = { type: 'ADMIN' as const, ref: 'p2d_smoke' };

  try {
    const store = new SupabasePatrimonialStore({ url: SUPABASE_URL, serviceRoleKey: supabaseSecret });
    await store.ownerSyncHealth();

    const persisted = await store.transaction(async tx => {
      const existing = await tx.getOpportunityIntent(INTENT_ID);
      if (existing) {
        if (existing.businessKey !== BUSINESS_KEY || existing.contactId !== CONTACT_ID || existing.remote?.id !== OPPORTUNITY_ID) throw new Error('SEED_IDENTITY_CONFLICT');
        return existing;
      }
      await tx.saveOpportunityIntent(seed, null);
      return seed;
    });
    if (persisted.status !== 'OPEN' || persisted.stage !== 'A01') throw new Error('SEED_STATE_INVALID');

    const created = await executePatrimonialAssignment(store, {
      type: 'createOperator',
      commandKey: 'p2d_create_operator_20261018_v2',
      actor,
      operator: {
        operatorKey: 'p2d_owner_smoke_20261018_v2',
        displayName: 'P2D Synthetic Operator',
        remoteUserRef: REMOTE_USER_ID,
        metadata: { reasonCode: 'synthetic_smoke' },
      },
    }, { env });
    const operator = created.operator;
    if (!operator || operator.remoteUserRef !== REMOTE_USER_ID) throw new Error('OPERATOR_CREATE_FAILED');

    const assignmentResult = await executePatrimonialAssignment(store, {
      type: 'assignProspect',
      commandKey: 'p2d_assign_20261018_v2',
      actor,
      method: 'MANUAL',
      intentId: INTENT_ID,
      expectedRevision: 0,
      operatorId: operator.id,
    }, { env });
    if (assignmentResult.remoteOwnerState !== 'REMOTE_OWNER_SYNC_PENDING') throw new Error('OWNER_NOT_ENQUEUED');

    const before = await provider.getOpportunity(OPPORTUNITY_ID);
    if (before.assignedTo !== null || before.contactId !== CONTACT_ID || before.pipelineId !== PIPELINE_ID) throw new Error('REMOTE_PRECONDITION_FAILED');

    const firstRun = await runPatrimonialOwnerSyncOnce(store, provider, { env });
    if (firstRun.state !== 'CONFIRMED') throw new Error(`WORKER_${firstRun.state}`);

    const secondRun = await runPatrimonialOwnerSyncOnce(store, provider, { env });
    if (secondRun.state !== 'IDLE') throw new Error(`IDEMPOTENCY_${secondRun.state}`);

    const after = await provider.getOpportunity(OPPORTUNITY_ID);
    if (after.assignedTo !== REMOTE_USER_ID) throw new Error('REMOTE_READBACK_FAILED');

    const intentRows = await restRows(supabaseSecret,
      `patrimonial_intents?id=eq.${INTENT_ID}&select=id,owner_ref,current_operator_id,operator_revision,owner_checkpoint_revision,revision,stage,status,record`);
    const outboxRows = await restRows(supabaseSecret,
      `patrimonial_outbox_operations?intent_id=eq.${INTENT_ID}&effect_type=eq.ASSIGN_OPPORTUNITY_OWNER&select=id,status,attempt_count,lease_version,record`);
    const assignmentRows = await restRows(supabaseSecret,
      `patrimonial_assignments?intent_id=eq.${INTENT_ID}&select=id,operator_id,released_at,release_reason,revision`);
    const operatorRows = await restRows(supabaseSecret,
      `patrimonial_operators?id=eq.${operator.id}&select=id,active,revision,remote_user_ref,metadata`);

    const row = intentRows[0];
    const record = row?.record as Record<string,unknown> | undefined;
    const remote = record?.remote as Record<string,unknown> | undefined;
    const opRecord = outboxRows[0]?.record as Record<string,unknown> | undefined;
    const checkpointOk = row?.owner_ref === REMOTE_USER_ID
      && record?.ownerId === REMOTE_USER_ID
      && remote?.assignedTo === REMOTE_USER_ID
      && row?.owner_checkpoint_revision === 1
      && row?.current_operator_id === operator.id
      && row?.operator_revision === 1
      && row?.revision === 1
      && row?.stage === 'A01'
      && row?.status === 'OPEN';
    const outboxOk = outboxRows.length === 1
      && outboxRows[0]?.status === 'SYNCED'
      && opRecord?.technicalState === 'SYNCED'
      && opRecord?.outcome === 'CONFIRMED';
    const assignmentOk = assignmentRows.length === 1
      && assignmentRows[0]?.operator_id === operator.id
      && assignmentRows[0]?.released_at === null;
    const operatorOk = operatorRows.length === 1
      && operatorRows[0]?.active === true
      && operatorRows[0]?.remote_user_ref === REMOTE_USER_ID;

    if (!checkpointOk || !outboxOk || !assignmentOk || !operatorOk) throw new Error('LOCAL_CHECKPOINT_FAILED');

    const current = await store.transaction(tx => tx.getOpportunityIntent(INTENT_ID));
    if (!current) throw new Error('INTENT_MISSING_AFTER_CHECKPOINT');
    const cleanupAt = new Date().toISOString();
    if (current.status === 'OPEN') {
      await applyPatrimonialCommand(store, INTENT_ID, {
        type: 'ARCHITECT_CLOSED',
        expectedRevision: current.revision,
        actor: { id: 'p2d_smoke', type: 'OWNER' },
        at: cleanupAt,
        evidenceId: 'p2d_smoke_cleanup_20261018_v2',
        reason: 'INVALID_REQUEST',
      });
    }

    await executePatrimonialAssignment(store, {
      type: 'releaseProspect',
      commandKey: 'p2d_release_20261018_v2',
      actor,
      intentId: INTENT_ID,
      expectedRevision: 1,
      reason: 'INTENT_CLOSED',
    }, { env });

    await executePatrimonialAssignment(store, {
      type: 'deactivateOperator',
      commandKey: 'p2d_deactivate_operator_20261018_v2',
      actor,
      operatorId: operator.id,
      expectedRevision: 0,
    }, { env });

    const cleanedIntent = (await restRows(supabaseSecret,
      `patrimonial_intents?id=eq.${INTENT_ID}&select=owner_ref,current_operator_id,operator_revision,owner_checkpoint_revision,revision,stage,status,close_reason`))[0];
    const cleanedAssignment = (await restRows(supabaseSecret,
      `patrimonial_assignments?intent_id=eq.${INTENT_ID}&select=released_at,release_reason,revision`))[0];
    const cleanedOperator = (await restRows(supabaseSecret,
      `patrimonial_operators?id=eq.${operator.id}&select=active,revision`))[0];

    const localCleanupOk = cleanedIntent?.current_operator_id === null
      && cleanedIntent?.operator_revision === 2
      && cleanedIntent?.owner_ref === REMOTE_USER_ID
      && cleanedIntent?.owner_checkpoint_revision === 1
      && cleanedIntent?.revision === 2
      && cleanedIntent?.stage === 'A10'
      && cleanedIntent?.status === 'LOST'
      && cleanedIntent?.close_reason === 'INVALID_REQUEST'
      && cleanedAssignment?.release_reason === 'INTENT_CLOSED'
      && typeof cleanedAssignment?.released_at === 'string'
      && cleanedOperator?.active === false
      && cleanedOperator?.revision === 1;

    return NextResponse.json({
      ok: localCleanupOk,
      phase: 'p2d-complete',
      keyKind,
      workerState: firstRun.state,
      idempotencyState: secondRun.state,
      remoteReadBack: true,
      checkpointOk,
      outboxOk,
      assignmentOk,
      operatorOk,
      localCleanupOk,
      invariant: {
        businessRevisionBeforeCleanup: 1,
        ownerCheckpointRevision: 1,
        operatorRevisionAfterCleanup: 2,
      },
    }, {
      status: localCleanupOk ? 200 : 409,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'UNKNOWN';
    return NextResponse.json({ ok:false, phase:'p2d', keyKind, reason }, { status:503, headers:{'Cache-Control':'no-store'} });
  }
}
