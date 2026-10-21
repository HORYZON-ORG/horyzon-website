import { NextResponse } from 'next/server';
import {
  ingestPatrimonialHighLevelPerformanceWebhook,
  PatrimonialHighLevelWebhookError,
} from '@/lib/public-leads/patrimonial-performance-highlevel';
import {
  createProductionPatrimonialStore,
  PatrimonialConflictError,
  PatrimonialStoreUnavailableError,
} from '@/lib/public-leads/patrimonial-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function POST(request: Request) {
  let rawBody: string;
  try { rawBody = await request.text(); }
  catch { return NextResponse.json({ ok:false }, { status:400, headers:{'Cache-Control':'no-store'} }); }

  try {
    const result = await ingestPatrimonialHighLevelPerformanceWebhook({
      rawBody,
      signature: request.headers.get('x-ghl-signature'),
      storeFactory: () => createProductionPatrimonialStore(),
    });
    return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    if (error instanceof PatrimonialHighLevelWebhookError) {
      const status = error.code === 'SIGNATURE' ? 401 : error.code === 'PAYLOAD' ? 400 : 503;
      return NextResponse.json({ ok:false, code:error.code }, { status, headers:{'Cache-Control':'no-store'} });
    }
    // A verified delivery whose idempotency key conflicts with different
    // semantics is acknowledged but requires human review; blind webhook retry
    // cannot repair that state.
    if (error instanceof PatrimonialConflictError) {
      return NextResponse.json({ ok:true, state:'MANUAL_REVIEW' }, { status:200, headers:{'Cache-Control':'no-store'} });
    }
    if (error instanceof PatrimonialStoreUnavailableError) {
      return NextResponse.json({ ok:false, code:'STORE_UNAVAILABLE' }, { status:503, headers:{'Cache-Control':'no-store'} });
    }
    return NextResponse.json({ ok:false, code:'RETRYABLE_PROCESSING_ERROR' }, { status:503, headers:{'Cache-Control':'no-store'} });
  }
}
