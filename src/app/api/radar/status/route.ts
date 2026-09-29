import { NextResponse } from 'next/server';
import { createRadarCommerce } from '@/lib/radar';
import { errorResponse, getSessionCookie } from '../_shared';

export async function GET() {
  try { const session = await getSessionCookie(); const unlocked = await createRadarCommerce().hasAccess(session.assessmentId); return NextResponse.json({ ok: true, unlocked, source: unlocked ? 'PURCHASE' : null }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return errorResponse(error); }
}
