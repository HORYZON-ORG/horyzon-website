import { NextRequest, NextResponse } from 'next/server';
import { Annunci10xPublicError, isVerifiedCommercialSessionClaim, resolveAnnunci10xCommercial, sanitizeCommercialClientPayload } from '@/lib/annunci-10x';
import { checkAnnunci10xRateLimit, createContext, getSessionCookie, toErrorResponse } from '../../_shared';
import type { Annunci10xCommercialFlow, SessionState } from '@/lib/annunci-10x';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    sanitizeCommercialClientPayload(Object.fromEntries(request.nextUrl.searchParams));
    const context = createContext();
    const cookie = await getSessionCookie();
    const claimedSessionId = request.nextUrl.searchParams.get('sessionId');
    if (!isVerifiedCommercialSessionClaim(claimedSessionId, cookie?.sessionId)) {
      throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione commerciale non verificata.', 401);
    }
    const limited = checkAnnunci10xRateLimit(request, cookie?.sessionId);
    if (limited) return limited;

    const session = cookie ? await context.persistence.getSession(cookie.sessionId, cookie.sessionSecret) : null;
    const flow = session?.flow ?? parseFlow(request.nextUrl.searchParams.get('flow'));
    const journeyState = session?.state ?? parseJourneyState(request.nextUrl.searchParams.get('journeyState'), flow);
    const subject = session
      ? { kind: 'SESSION' as const, sessionId: session.id }
      : { kind: 'ANONYMOUS' as const };
    const commercial = await resolveAnnunci10xCommercial({ subject, flow, journeyState });

    return NextResponse.json({ ok: true, commercial }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

function parseFlow(value: string | null): Annunci10xCommercialFlow {
  return value === 'CREATE' ? 'CREATE' : 'ANALYZE';
}

function parseJourneyState(value: string | null, flow: Annunci10xCommercialFlow): SessionState | 'PRODUCT_PAGE' {
  if (flow === 'ANALYZE') return 'PRODUCT_PAGE';
  return value === 'PAYMENT_REQUIRED' ? 'PAYMENT_REQUIRED' : 'COLLECTING';
}
