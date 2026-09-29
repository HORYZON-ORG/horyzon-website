import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { RADAR_PREVIEW_COOKIE, createService, errorResponse, getSessionCookie } from '../_shared';

export async function GET() {
  try {
    const session = await getSessionCookie();
    const store = await cookies();
    const previewToken = store.get(RADAR_PREVIEW_COOKIE)?.value ?? '';
    const result = await createService().readPreviewResult(session.assessmentId, session.ownerSecret, previewToken);
    return NextResponse.json({ ok: true, result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
