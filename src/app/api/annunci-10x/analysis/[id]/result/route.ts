import { after, NextResponse } from 'next/server';
import { getGatedAnnunci10xFreeResult, maybeSendAnnunci10xScoreReport } from '@/lib/annunci-10x';
import { createContext, getSessionCookie, toErrorResponse } from '../../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookie = await getSessionCookie();
    if (!cookie) {
      return NextResponse.json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Sessione Annunci 10x assente.' } }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }
    const { id } = await params;
    const context = createContext();
    const result = await getGatedAnnunci10xFreeResult({ session: cookie, analysisRunId: id, context });
    after(async () => {
      try {
        await maybeSendAnnunci10xScoreReport({ session: cookie, analysisRunId: id, context });
      } catch {
        // Score report delivery is recovery-safe and must not affect result rendering.
      }
    });
    return NextResponse.json({ ok: true, result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
