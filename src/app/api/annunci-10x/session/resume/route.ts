import { NextResponse } from 'next/server';
import { Annunci10xPublicError, resumeAnnunci10xAnalysis } from '@/lib/annunci-10x';
import { checkAnnunci10xRateLimit, createContext, getSessionCookie, toErrorResponse } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const cookie = await getSessionCookie();
    if (!cookie) {
      return NextResponse.json({ ok: true, session: null }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const context = createContext();
    const limited = checkAnnunci10xRateLimit(request, cookie.sessionId);
    if (limited) return limited;
    const existing = await context.persistence.getSession(cookie.sessionId, cookie.sessionSecret);
    if (existing?.flow !== 'ANALYZE') {
      return NextResponse.json({ ok: true, session: null }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const resumed = await resumeAnnunci10xAnalysis(cookie, context);
    if (!resumed.session) throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione non valida.', 401);
    return NextResponse.json({
      ok: true,
      session: { id: resumed.session.id, entryMode: resumed.session.entryMode },
      snapshot: resumed.snapshot ? {
        id: resumed.snapshot.id,
        version: resumed.snapshot.version,
        roleTitle: resumed.snapshot.roleCard.title?.value ?? null,
        createdAt: resumed.snapshot.createdAt,
      } : null,
      evaluation: resumed.evaluation ? {
        id: resumed.evaluation.id,
        score: resumed.evaluation.score,
        gate: resumed.evaluation.gate,
        createdAt: resumed.evaluation.createdAt,
      } : null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
