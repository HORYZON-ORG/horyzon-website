import { createHash, timingSafeEqual } from 'node:crypto';
import { runOpenAIProviderPreflight } from '../../../../../lib/ai-score/internal-preflight.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isAuthorizedInternalPreflightRequest(request)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const report = await runOpenAIProviderPreflight();
  const status = report.eligibility.eligible ? 200 : 409;
  return Response.json(report, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export function isAuthorizedInternalPreflightRequest(request: Request): boolean {
  const expected = process.env.AI_SCORE_INTERNAL_PREFLIGHT_TOKEN;
  const provided = readBearerToken(request.headers.get('authorization'));
  if (!expected?.trim() || !provided) return false;
  return constantTimeStringEqual(provided, expected);
}

function readBearerToken(value: string | null): string | null {
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function constantTimeStringEqual(left: string, right: string): boolean {
  const leftDigest = createHash('sha256').update(left).digest();
  const rightDigest = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}
