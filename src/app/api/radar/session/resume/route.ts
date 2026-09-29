import { NextResponse } from 'next/server';
import { createService, errorResponse, getSessionCookie } from '../../_shared';

export async function GET() {
  try {
    const cookie = await getSessionCookie();
    const session = await createService().resumeAssessment(cookie.assessmentId, cookie.ownerSecret);
    return NextResponse.json({ ok: true, session });
  } catch (error) { return errorResponse(error); }
}
