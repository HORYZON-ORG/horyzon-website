import { NextResponse } from 'next/server';
import { Annunci10xPublicError, processAnnunci10xStripeWebhook } from '@/lib/annunci-10x';
import { createContext } from '../../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const result = await processAnnunci10xStripeWebhook({
      rawBody,
      signature: request.headers.get('stripe-signature'),
      context: createContext(),
    });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Annunci10xPublicError && error.status === 400) {
      return NextResponse.json({ ok: false, error: { code: error.code, message: error.message } }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ ok: false, error: { code: 'PAYMENT_INVALID', message: 'Webhook Stripe non valido.' } }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
}
