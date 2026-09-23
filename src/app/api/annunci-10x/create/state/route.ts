import { NextResponse } from 'next/server';
import { resumeAnnunci10xCreate } from '@/lib/annunci-10x';
import { checkAnnunci10xRateLimit, createContext, getSessionCookie, toErrorResponse } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const cookie = await getSessionCookie();
    if (!cookie) return NextResponse.json({ ok: true, result: null }, { headers: { 'Cache-Control': 'no-store' } });
    const context = createContext();
    const limited = checkAnnunci10xRateLimit(request, cookie.sessionId);
    if (limited) return limited;
    const result = await resumeAnnunci10xCreate(cookie, context);
    return NextResponse.json({ ok: true, result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
