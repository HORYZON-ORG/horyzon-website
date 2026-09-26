import { NextResponse } from 'next/server';
import { Annunci10xPublicError, requestAnnunci10xEmailVerification } from '@/lib/annunci-10x';
import { clientFingerprint, createContext, getSessionCookie, toErrorResponse } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const cookie = await getSessionCookie();
    if (!cookie) throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione Annunci 10x assente.', 401);
    const context = createContext();
    const result = await requestAnnunci10xEmailVerification({
      session: cookie,
      context,
      requestFingerprint: clientFingerprint(request),
    });
    return NextResponse.json({
      ok: true,
      sent: result.sent,
      expiresInSeconds: result.expiresInSeconds,
      resendAfterSeconds: result.resendAfterSeconds,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
