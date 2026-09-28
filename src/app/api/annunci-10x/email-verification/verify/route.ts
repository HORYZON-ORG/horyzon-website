import { after, NextResponse } from 'next/server';
import { Annunci10xPublicError, maybeSendAnnunci10xScoreReport, verifyAnnunci10xEmailCode } from '@/lib/annunci-10x';
import { clientFingerprint, createContext, getSessionCookie, readJsonBody, toErrorResponse } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const cookie = await getSessionCookie();
    if (!cookie) throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione Annunci 10x assente.', 401);
    const payload = await readJsonBody(request);
    const context = createContext();
    const analysisRunId = typeof payload.analysisRunId === 'string' ? payload.analysisRunId : null;
    const result = await verifyAnnunci10xEmailCode({
      session: cookie,
      context,
      code: payload.code,
      analysisRunId,
      requestFingerprint: clientFingerprint(request),
    });
    if (result.resultEligible && analysisRunId) {
      after(async () => {
        try {
          await maybeSendAnnunci10xScoreReport({ session: cookie, analysisRunId, context });
        } catch {
          // Score report delivery is retry-safe and must not affect OTP verification.
        }
      });
    }
    return NextResponse.json({
      ok: true,
      verified: result.verified,
      resultEligible: result.resultEligible,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
