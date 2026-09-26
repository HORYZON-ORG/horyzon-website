import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json({
    ok: false,
    error: {
      code: 'ANALYSIS_FLOW_MOVED',
      message: 'Usa il nuovo flusso di analisi.',
    },
  }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}
