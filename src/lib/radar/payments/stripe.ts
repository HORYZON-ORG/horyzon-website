import { randomBytes } from 'node:crypto';
import Stripe from 'stripe';

export interface RadarStripeEvent { id: string; type: string; object: Record<string, unknown> }

export class StripeRadarGateway {
  private readonly client: Stripe;
  constructor(secretKey: string) { if (!secretKey) throw new Error('Stripe Radar non configurato.'); this.client = new Stripe(secretKey); }
  async createCheckout(input: { purchaseId: string; priceId: string; customerEmail: string; successUrl: string; cancelUrl: string }) {
    const metadata = { radar_purchase_id: input.purchaseId, radar_offer_code: 'RADAR_IMPRESA_REPORT' };
    const session = await this.client.checkout.sessions.create({
      mode: 'payment', line_items: [{ price: input.priceId, quantity: 1 }], customer_email: input.customerEmail,
      success_url: input.successUrl, cancel_url: input.cancelUrl, client_reference_id: input.purchaseId, metadata,
      payment_intent_data: { metadata }, integration_identifier: `horyzon_radar_${randomBytes(4).toString('hex')}`,
    } as Stripe.Checkout.SessionCreateParams, { idempotencyKey: radarCheckoutIdempotencyKey(input.purchaseId) });
    if (!session.url) throw new Error('Stripe Checkout non disponibile.');
    return { id: session.id, url: session.url };
  }
  constructEvent(rawBody: string, signature: string, secret: string): RadarStripeEvent {
    const event = this.client.webhooks.constructEvent(rawBody, signature, secret);
    return { id: event.id, type: event.type, object: event.data.object as unknown as Record<string, unknown> };
  }
}

export function radarCheckoutIdempotencyKey(purchaseId: string): string { return `radar-checkout/${purchaseId}`; }
