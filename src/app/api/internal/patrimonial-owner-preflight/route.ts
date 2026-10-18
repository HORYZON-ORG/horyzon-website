import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.VERCEL_ENV !== 'preview') {
    return NextResponse.json({ ok: false, reason: 'preview_only' }, { status: 404 });
  }

  const token = process.env.HIGHLEVEL_PRIVATE_TOKEN?.trim();
  const locationId = process.env.HIGHLEVEL_LOCATION_ID?.trim();
  if (!token || !locationId) {
    return NextResponse.json({
      ok: false,
      tokenPresent: Boolean(token),
      locationPresent: Boolean(locationId),
    }, { status: 503 });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Version: 'v3',
    Accept: 'application/json',
  };

  const usersUrl = new URL('https://services.leadconnectorhq.com/users/');
  usersUrl.searchParams.set('locationId', locationId);

  const oppsUrl = new URL('https://services.leadconnectorhq.com/opportunities/search');
  oppsUrl.searchParams.set('location_id', locationId);
  oppsUrl.searchParams.set('limit', '1');
  oppsUrl.searchParams.set('status', 'all');

  const [usersRes, oppsRes] = await Promise.all([
    fetch(usersUrl, { method: 'GET', headers, cache: 'no-store', signal: AbortSignal.timeout(10000) }),
    fetch(oppsUrl, { method: 'GET', headers, cache: 'no-store', signal: AbortSignal.timeout(10000) }),
  ]);

  let membershipVerified = false;
  let usersCount: number | null = null;
  if (usersRes.ok) {
    try {
      const body = await usersRes.json() as { users?: Array<{ deleted?: boolean; roles?: { locationIds?: string[] } }> };
      const users = Array.isArray(body.users) ? body.users : [];
      usersCount = users.length;
      membershipVerified = users.some(user =>
        user?.deleted === false &&
        Array.isArray(user.roles?.locationIds) &&
        user.roles.locationIds.includes(locationId)
      );
    } catch {}
  }

  let opportunityCount: number | null = null;
  if (oppsRes.ok) {
    try {
      const body = await oppsRes.json() as { meta?: { total?: number }, opportunities?: unknown[] };
      opportunityCount = typeof body.meta?.total === 'number'
        ? body.meta.total
        : Array.isArray(body.opportunities) ? body.opportunities.length : null;
    } catch {}
  }

  return NextResponse.json({
    ok: usersRes.ok && oppsRes.ok && membershipVerified,
    tokenPresent: true,
    locationPresent: true,
    usersRead: { status: usersRes.status, count: usersCount, membershipVerified },
    opportunitiesRead: { status: oppsRes.status, count: opportunityCount },
  }, {
    status: usersRes.ok && oppsRes.ok && membershipVerified ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
