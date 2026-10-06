import { NextRequest, NextResponse } from 'next/server';
import { Annunci10xPublicError, createAnnunci10xCheckoutSession } from '@/lib/annunci-10x';
import { checkAnnunci10xRateLimit, createContext, getSessionCookie, readJsonBody, toErrorResponse } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const cookie = await getSessionCookie();
    if (!cookie) throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione Annunci 10x assente.', 401);
    const limited = checkAnnunci10xRateLimit(request, cookie.sessionId);
    if (limited) return limited;
    const payload = await readJsonBody(request);
    if (payload.offerCode === 'ANNUNCI10X_REWRITE' || payload.offerCode === 'ANNUNCI10X_CREATE') {
      throw new Annunci10xPublicError('INVALID_INPUT', 'Creazione e miglioramento Annunci 10x sono gratuiti e non richiedono pagamento.', 409);
    }
    const result = await createAnnunci10xCheckoutSession({
      session: cookie,
      offerCode: payload.offerCode,
      context: createContext(),
    });
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
