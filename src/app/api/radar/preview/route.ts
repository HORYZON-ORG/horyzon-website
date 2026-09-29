import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { RADAR_PREVIEW_COOKIE, clientIp, createService, errorResponse, getSessionCookie, readJson } from '../_shared';

export async function POST(request: Request) {
  try {
    const [cookie, body] = await Promise.all([getSessionCookie(), readJson(request)]);
    if (typeof body.pin !== 'string') return NextResponse.json({ ok: false, error: { message: 'PIN non valido.' } }, { status: 400 });
    const grant = await createService().grantPreview({ assessmentId: cookie.assessmentId, ownerSecret: cookie.ownerSecret, pin: body.pin, ipKey: clientIp(request) });
    const store = await cookies();
    store.set(RADAR_PREVIEW_COOKIE, grant.token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/radar', maxAge: 15 * 60 });
    return NextResponse.json({ ok: true, unlocked: true, source: grant.source });
  } catch (error) { return errorResponse(error); }
}
