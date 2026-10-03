import { NextResponse, after } from 'next/server';
import { runHighLevelSync, syncRadarLeadCompleted } from '@/lib/radar/highlevel';
import { createService, errorResponse, getSessionCookie } from '../_shared';

export async function POST() {
  try {
    const cookie = await getSessionCookie();
    const service = createService();
    const result = await service.completeAssessment(cookie.assessmentId, cookie.ownerSecret);
    // The completed Radar reaches the CRM with its scores, after the response.
    after(() => runHighLevelSync('completed', async (config) => {
      const { report, owner } = await service.readReport(cookie.assessmentId, cookie.ownerSecret);
      await syncRadarLeadCompleted(config, owner, report);
    }));
    return NextResponse.json({ ok: true, result });
  } catch (error) { return errorResponse(error); }
}
