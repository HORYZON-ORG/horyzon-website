import { NextResponse } from 'next/server';
import { runFreeAnnunci10xAnalysis } from '@/lib/annunci-10x';
import { checkAnnunci10xRateLimit, createContext, getOrCreateSession, readJsonBody, toErrorResponse } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const context = createContext();
    const session = await getOrCreateSession(context);
    const limited = checkAnnunci10xRateLimit(request, session.sessionId);
    if (limited) return limited;
    const payload = await readJsonBody(request);
    const rawAdText = typeof payload.rawAdText === 'string' ? payload.rawAdText : '';
    const roleHint = typeof payload.roleHint === 'string' ? payload.roleHint : undefined;
    const companyHint = typeof payload.companyHint === 'string' ? payload.companyHint : undefined;
    const result = await runFreeAnnunci10xAnalysis({
      sessionId: session.sessionId,
      sessionSecret: session.sessionSecret,
      rawAdText,
      roleHint,
      companyHint,
      context,
    });
    return NextResponse.json({ ok: true, result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
