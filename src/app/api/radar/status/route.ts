import { NextResponse } from 'next/server';
import { createRadarCommerce } from '@/lib/radar';
import { errorResponse, getSessionCookie, radarFreeAccess } from '../_shared';

export async function GET() {
  try { const session = await getSessionCookie(); if (radarFreeAccess()) return NextResponse.json({ ok: true, unlocked: true, source: 'FREE' }, { headers: { 'Cache-Control': 'no-store' } }); const unlocked = await createRadarCommerce().hasAccess(session.assessmentId); return NextResponse.json({ ok: true, unlocked, source: unlocked ? 'PURCHASE' : null }, { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return errorResponse(error); }
}
