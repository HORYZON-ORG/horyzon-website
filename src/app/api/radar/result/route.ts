import { NextResponse, after } from 'next/server';
import { radarReportEmailConfigured, sendRadarReportEmail } from '@/lib/radar/report-email';
import { renderRadarReportPdf } from '@/lib/radar/report-pdf';
import { errorResponse } from '../_shared';
import { authorizedRadarReport } from '../_report';

export async function GET() {
  try {
    const { service, assessmentId, result, report, recipient } = await authorizedRadarReport();
    // The first time the report opens, its PDF goes to the person who filled in the Radar.
    if (radarReportEmailConfigured()) after(async () => {
      try {
        if (!(await service.claimReportEmail(assessmentId))) return;
        await sendRadarReportEmail({ to: recipient.email, name: recipient.name, report, pdf: await renderRadarReportPdf(report) });
      } catch (error) { console.error('Radar report email failed', { message: error instanceof Error ? error.message : 'unknown' }); }
    });
    return NextResponse.json({ ok: true, result, report }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
