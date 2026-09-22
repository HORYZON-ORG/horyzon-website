import { NextResponse } from 'next/server';
import { checkAnnunci10xRateLimit, createContext, getOrCreateSession, toErrorResponse } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const context = createContext();
    const limited = checkAnnunci10xRateLimit(request);
    if (limited) return limited;
    const session = await getOrCreateSession(context);
    return NextResponse.json({
      ok: true,
      session: { id: session.sessionId, created: session.created, entryMode: 'ANALYZE' },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
