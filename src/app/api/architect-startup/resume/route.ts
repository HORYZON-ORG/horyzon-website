import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getArchitectStartupVideoGate } from '@/lib/public-leads/architect-hub-intake';
import { architectStartupConfirmationEnabled } from '@/lib/public-leads/architect-startup-config';
import {
  ARCHITECT_STARTUP_RESUME_COOKIE, ARCHITECT_STARTUP_TOKEN_PATTERN,
  architectStartupResumeCookieOptions,
} from '@/lib/public-leads/architect-startup-resume';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = {
  'Cache-Control': 'private, no-store',
  'Vary': 'Cookie',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

/** Recover an existing 7-day draft from the SAME browser, without re-entering PII. */
export async function GET(request: Request) {
  if (!architectStartupConfirmationEnabled(process.env))
    return NextResponse.json({ ok: false }, { status: 503, headers });

  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none')
    return NextResponse.json({ ok: false }, { status: 403, headers });

  const store = await cookies();
  const token = store.get(ARCHITECT_STARTUP_RESUME_COOKIE)?.value ?? '';
  if (!ARCHITECT_STARTUP_TOKEN_PATTERN.test(token))
    return NextResponse.json({ ok: false }, { status: 404, headers });

  try {
    // The existing gate validates the token against the private Hub and
    // starts/continues the timer only for unconfirmed, unexpired drafts.
    const remainingSeconds = await getArchitectStartupVideoGate(process.env, token);
    if (remainingSeconds === null) {
      const response = NextResponse.json({ ok: false }, { status: 404, headers });
      response.cookies.set(ARCHITECT_STARTUP_RESUME_COOKIE, '',
        { ...architectStartupResumeCookieOptions(), maxAge: 0 });
      return response;
    }
    return NextResponse.json({ ok: true, token }, { status: 200, headers });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers });
  }
}
