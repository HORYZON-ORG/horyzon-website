import { NextResponse } from 'next/server';
import { Annunci10xPublicError, answerAnnunci10xCreateStep } from '@/lib/annunci-10x';
import { checkAnnunci10xRateLimit, createContext, getSessionCookie, readJsonBody, toErrorResponse } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const context = createContext();
    const cookie = await getSessionCookie();
    if (!cookie) throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione Annunci 10x assente.', 401);
    const limited = checkAnnunci10xRateLimit(request, cookie.sessionId);
    if (limited) return limited;
    const payload = await readJsonBody(request);
    const stepId = typeof payload.stepId === 'string' ? payload.stepId : '';
    const answer = typeof payload.answer === 'string' ? payload.answer : '';
    const result = await answerAnnunci10xCreateStep({
      sessionId: cookie.sessionId,
      sessionSecret: cookie.sessionSecret,
      stepId: stepId as never,
      answer,
      context,
    });
    return NextResponse.json({ ok: true, result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
