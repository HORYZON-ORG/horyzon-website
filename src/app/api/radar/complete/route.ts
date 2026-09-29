import { NextResponse } from 'next/server';
import { createService, errorResponse, getSessionCookie } from '../_shared';

export async function POST() {
  try {
    const cookie = await getSessionCookie();
    const result = await createService().completeAssessment(cookie.assessmentId, cookie.ownerSecret);
    return NextResponse.json({ ok: true, result });
  } catch (error) { return errorResponse(error); }
}
