import { NextResponse } from 'next/server';
import { renderRadarReportPdf } from '@/lib/radar/report-pdf';
import { bearerToken, staffOrigins, verifyRadarStaff } from '@/lib/radar/staff-auth';
import { createService, errorResponse } from '../../../_shared';

// The Hub downloads a Radar report PDF by assessment id, with the staff member's Supabase session (cross-origin).
function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') ?? '';
  if (!staffOrigins().includes(origin)) return {};
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Authorization', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Expose-Headers': 'Content-Disposition', 'Access-Control-Max-Age': '600', Vary: 'Origin' };
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request: Request) {
  const cors = corsHeaders(request);
  try {
    await verifyRadarStaff(bearerToken(request.headers.get('authorization')));
    const id = new URL(request.url).searchParams.get('id') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: { message: 'Radar non valido.' } }, { status: 400, headers: cors });
    const report = await createService().readStaffReport(id);
    const pdf = await renderRadarReportPdf(report);
    const slug = report.company.aziendaNome.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'impresa';
    return new Response(new Uint8Array(pdf), { headers: { ...cors, 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="radar-impresa-${slug}.pdf"`, 'Cache-Control': 'no-store' } });
  } catch (error) {
    const response = errorResponse(error);
    for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
    return response;
  }
}
