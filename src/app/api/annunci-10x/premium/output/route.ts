import { NextResponse } from 'next/server';
import { Annunci10xPublicError, resumeAnnunci10xPremiumOutput } from '@/lib/annunci-10x';
import { checkAnnunci10xRateLimit, createContext, getSessionCookie, toErrorResponse } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const context = createContext();
    const cookie = await getSessionCookie();
    if (!cookie) return NextResponse.json({ ok: true, result: null }, { headers: { 'Cache-Control': 'no-store' } });
    const limited = checkAnnunci10xRateLimit(request, cookie.sessionId);
    if (limited) return limited;
    const session = await context.persistence.getSession(cookie.sessionId, cookie.sessionSecret);
    if (!session) throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione Annunci 10x non valida o scaduta.', 401);
    const result = await resumeAnnunci10xPremiumOutput({ sessionId: cookie.sessionId, sessionSecret: cookie.sessionSecret, context });
    return NextResponse.json({ ok: true, result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
