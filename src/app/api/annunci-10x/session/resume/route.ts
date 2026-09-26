import { NextResponse } from 'next/server';
import { getAnnunci10xResultEligibility, progressLabelForAnalysisStage, toPublicAnalysisRunStatus } from '@/lib/annunci-10x';
import { checkAnnunci10xRateLimit, createContext, getSessionCookie, toErrorResponse } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const cookie = await getSessionCookie();
    if (!cookie) {
      return NextResponse.json({ ok: true, session: null, analysisRun: null }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const context = createContext();
    const limited = checkAnnunci10xRateLimit(request, cookie.sessionId);
    if (limited) return limited;
    const session = await context.persistence.getSession(cookie.sessionId, cookie.sessionSecret);
    if (session?.flow !== 'ANALYZE') {
      return NextResponse.json({ ok: true, session: null, analysisRun: null }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const run = await context.persistence.getLatestAnalysisRun(cookie.sessionId, cookie.sessionSecret);
    const lead = await context.persistence.getLead(cookie.sessionId, cookie.sessionSecret);
    const eligibility = run
      ? await getAnnunci10xResultEligibility({ session: cookie, analysisRunId: run.id, context })
      : { analysisReady: false, emailVerified: Boolean(lead?.emailVerifiedAt), resultEligible: false };

    return NextResponse.json({
      ok: true,
      session: { id: session.id, entryMode: session.entryMode },
      analysisRun: run ? {
        id: run.id,
        status: run.status,
        sourceStatus: run.sourceStatus,
        ready: run.status === 'READY',
        failureCode: toPublicAnalysisRunStatus(run).failureCode,
        progressLabel: progressLabelForAnalysisStage(run.stage),
        contactSaved: Boolean(lead),
        emailVerified: eligibility.emailVerified,
        resultEligible: eligibility.resultEligible,
      } : null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
