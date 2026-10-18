import { NextRequest, NextResponse } from 'next/server';
import { PatrimonialHighLevelOwnerProvider, verifiedOwnerUser } from '@/lib/public-leads/patrimonial-owner-provider';

export const dynamic = 'force-dynamic';

const opportunityId = 'Vx3HwbODfJ2dh3bZqJD3';
const contactId = 'OLM3IRbrvv2y5tS6t1SL';
const remoteUserId = 'bnrWlUfYInhY7dXN8m4k';
const pipelineId = 'N2hsjiShcdMbzAITjxOA';
const confirmation = 'owner-smoke-20261018-v1-7c91f2';

function runtimeEnv() {
  return {
    ...process.env,
    PATRIMONIAL_V2_ENABLED: 'true',
    PATRIMONIAL_ASSIGNMENTS_ENABLED: 'true',
    PATRIMONIAL_CRM_WRITE_ENABLED: 'true',
    PATRIMONIAL_OWNER_SYNC_ENABLED: 'true',
  };
}

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json({ ok: false, reason: 'preview_only' }, { status: 404 });
  }
  const locationId = process.env.HIGHLEVEL_LOCATION_ID?.trim();
  if (!locationId || !process.env.HIGHLEVEL_PRIVATE_TOKEN?.trim()) {
    return NextResponse.json({ ok: false, reason: 'runtime_config_missing' }, { status: 503 });
  }

  const provider = new PatrimonialHighLevelOwnerProvider({
    env: runtimeEnv,
    proof: {
      runtimeTokenVerified: true,
      verifiedLocationId: locationId,
      version: 'v3',
      usersRead: true,
      opportunityOwnerRead: true,
      opportunityOwnerWrite: true,
      ownerOnlyUpdate: true,
      nullableAssignedTo: false,
      omittedAssignedToMeansUnassigned: true,
    },
  });

  try {
    const user = await provider.readRemoteUser(remoteUserId);
    const before = await provider.getOpportunity(opportunityId);
    const identityOk = verifiedOwnerUser(user, remoteUserId, locationId)
      && before.id === opportunityId
      && before.contactId === contactId
      && before.pipelineId === pipelineId
      && before.locationId === locationId;

    if (!identityOk || before.assignedTo !== null) {
      return NextResponse.json({
        ok: false,
        phase: 'read',
        identityOk,
        unassignedNormalized: before.assignedTo === null,
      }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    }

    if (request.nextUrl.searchParams.get('mode') !== 'write') {
      return NextResponse.json({
        ok: true,
        phase: 'read',
        identityOk: true,
        unassignedNormalized: true,
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (request.nextUrl.searchParams.get('confirm') !== confirmation) {
      return NextResponse.json({ ok: false, reason: 'confirmation_required' }, { status: 403 });
    }

    await provider.updateOpportunityOwner(before, user);
    const after = await provider.getOpportunity(opportunityId);
    const readBackOk = after.id === opportunityId
      && after.contactId === contactId
      && after.pipelineId === pipelineId
      && after.locationId === locationId
      && after.assignedTo === remoteUserId;

    return NextResponse.json({
      ok: readBackOk,
      phase: 'write',
      payloadScope: 'assignedTo-only',
      readBackOk,
    }, {
      status: readBackOk ? 200 : 409,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'UNKNOWN';
    return NextResponse.json({ ok: false, phase: 'provider', code }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
