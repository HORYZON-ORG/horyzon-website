import { isAuthorizedInternalPreflightRequest } from '../../../../../lib/ai-score/internal-preflight-auth.ts';
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
