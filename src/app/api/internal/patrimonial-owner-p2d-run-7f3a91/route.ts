import { NextRequest } from 'next/server';
import { GET as runP2D } from '../patrimonial-owner-p2d-smoke/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== 'preview') return new Response(null, { status: 404 });
  const url = new URL(request.url);
  url.pathname = '/api/internal/patrimonial-owner-p2d-smoke';
  url.search = '';
  url.searchParams.set('confirm', 'p2d-worker-smoke-20261018-v2-917b4d');
  return runP2D(new NextRequest(url, { headers: request.headers }));
}
