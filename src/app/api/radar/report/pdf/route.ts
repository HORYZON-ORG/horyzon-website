import { errorResponse } from '../../_shared';
import { authorizedRadarReport } from '../../_report';
import { renderRadarReportPdf } from '@/lib/radar/report-pdf';

export async function GET() {
  try {
    const { report } = await authorizedRadarReport();
    const pdf = await renderRadarReportPdf(report);
    const slug = report.company.aziendaNome.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'impresa';
    return new Response(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="radar-impresa-${slug}.pdf"`, 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
