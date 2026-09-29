import { NextResponse } from 'next/server';
import { createRadarCommerce, handleRadarStripeEvent, StripeRadarGateway } from '@/lib/radar';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!signature || !webhookSecret || !stripeKey) return NextResponse.json({ ok: false }, { status: 503 });
  try {
    const event = new StripeRadarGateway(stripeKey).constructEvent(await request.text(), signature, webhookSecret);
    const result = await handleRadarStripeEvent(createRadarCommerce(), event);
    return NextResponse.json({ ok: true, processed: result.processed });
  } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
}
