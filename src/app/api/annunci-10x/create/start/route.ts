import { NextResponse } from 'next/server';
import { startAnnunci10xCreate } from '@/lib/annunci-10x';
import { checkAnnunci10xRateLimit, createContext, setSessionCookie, toErrorResponse } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const context = createContext();
    const limited = checkAnnunci10xRateLimit(request);
    if (limited) return limited;
    const started = await startAnnunci10xCreate({ context });
    await setSessionCookie(started.cookie);
    return NextResponse.json({ ok: true, result: started.result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
