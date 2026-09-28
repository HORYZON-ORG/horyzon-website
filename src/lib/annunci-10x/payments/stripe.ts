import Stripe from 'stripe';
import { Annunci10xPublicError } from '../product-flow.ts';
import type { Annunci10xOfferCode } from '../commercial.ts';

export interface CreateCheckoutSessionInput {
  purchaseId: string;
  offerCode: Annunci10xOfferCode;
  stripePriceId: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CreatedCheckoutSession {
  id: string;
  url: string;
}

export interface Annunci10xPaymentGateway {
  readonly kind: 'STRIPE' | 'MOCK';
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreatedCheckoutSession>;
  constructWebhookEvent(rawBody: string, signature: string, webhookSecret: string): Promise<Annunci10xStripeWebhookEvent>;
}

export interface Annunci10xStripeWebhookEvent {
  id: string;
  type: string;
  object: Record<string, unknown>;
}

type StripeLikeClient = {
  checkout: {
    sessions: {
      create(input: Record<string, unknown>, options?: Record<string, unknown>): Promise<{ id?: unknown; url?: unknown }>;
    };
  };
  webhooks: {
    constructEvent(rawBody: string, signature: string, webhookSecret: string): unknown;
  };
};

export class StripeAnnunci10xPaymentGateway implements Annunci10xPaymentGateway {
  readonly kind = 'STRIPE';
  private readonly client: StripeLikeClient;

  constructor(input: { secretKey?: string | null; client?: StripeLikeClient }) {
    if (input.client) {
      this.client = input.client;
      return;
    }
    const secretKey = input.secretKey?.trim();
    if (!secretKey) throw checkoutUnavailable();
    this.client = new Stripe(secretKey);
  }

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreatedCheckoutSession> {
    const metadata = {
      annunci10x_purchase_id: input.purchaseId,
      annunci10x_offer_code: input.offerCode,
    };
    const session = await this.client.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: input.stripePriceId, quantity: 1 }],
      payment_method_collection: 'if_required',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.purchaseId,
      customer_email: input.customerEmail,
      metadata,
      payment_intent_data: { metadata },
    }, {
      idempotencyKey: stripeCheckoutIdempotencyKey(input.purchaseId),
    });
    if (typeof session.id !== 'string' || typeof session.url !== 'string') throw checkoutUnavailable();
    return { id: session.id, url: session.url };
  }

  async constructWebhookEvent(rawBody: string, signature: string, webhookSecret: string): Promise<Annunci10xStripeWebhookEvent> {
    const event = this.client.webhooks.constructEvent(rawBody, signature, webhookSecret);
    return normalizeStripeEvent(event);
  }
}

export class MockAnnunci10xPaymentGateway implements Annunci10xPaymentGateway {
  readonly kind = 'MOCK';
  readonly checkoutSessions: CreateCheckoutSessionInput[] = [];
  readonly constructedEvents: string[] = [];
  failCreateCheckout = false;

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreatedCheckoutSession> {
    if (this.failCreateCheckout) throw checkoutUnavailable();
    this.checkoutSessions.push(input);
    return {
      id: `cs_test_${input.purchaseId.replaceAll('-', '').slice(0, 24)}`,
      url: `https://checkout.stripe.test/session/${input.purchaseId}`,
    };
  }

  async constructWebhookEvent(rawBody: string, signature: string, webhookSecret: string): Promise<Annunci10xStripeWebhookEvent> {
    if (!signature || signature !== `mock-signature:${webhookSecret}`) throw new Error('Invalid signature');
    this.constructedEvents.push(rawBody);
    return normalizeStripeEvent(JSON.parse(rawBody));
  }
}

export function createAnnunci10xPaymentGateway(env: Record<string, string | undefined> = process.env): Annunci10xPaymentGateway {
  return new StripeAnnunci10xPaymentGateway({ secretKey: env.STRIPE_SECRET_KEY });
}

export function stripeCheckoutIdempotencyKey(purchaseId: string): string {
  return `annunci10x-checkout/${purchaseId}`;
}

export function resolveStripePriceId(offerCode: Annunci10xOfferCode, env: Record<string, string | undefined> = process.env): string {
  const key = offerCode === 'ANNUNCI10X_REWRITE'
    ? 'ANNUNCI10X_STRIPE_PRICE_REWRITE'
    : offerCode === 'ANNUNCI10X_CREATE'
      ? 'ANNUNCI10X_STRIPE_PRICE_CREATE'
      : 'ANNUNCI10X_STRIPE_PRICE_AGENT_RECRUITER';
  const priceId = env[key]?.trim();
  if (!priceId) throw checkoutUnavailable();
  return priceId;
}

export function resolveAnnunci10xPublicBaseUrl(env: Record<string, string | undefined> = process.env): string {
  const value = env.ANNUNCI10X_PUBLIC_BASE_URL?.trim();
  if (!value) throw checkoutUnavailable();
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw checkoutUnavailable();
  }
  if (env.NODE_ENV === 'production' && parsed.protocol !== 'https:') throw checkoutUnavailable();
  parsed.hash = '';
  parsed.search = '';
  return parsed.toString().replace(/\/$/, '');
}

export function readStripeWebhookSecret(env: Record<string, string | undefined> = process.env): string {
  const secret = env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) throw checkoutUnavailable();
  return secret;
}

function normalizeStripeEvent(value: unknown): Annunci10xStripeWebhookEvent {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid Stripe event');
  const record = value as Record<string, unknown>;
  const data = record.data as { object?: unknown } | undefined;
  const object = data?.object;
  if (typeof record.id !== 'string' || typeof record.type !== 'string' || typeof object !== 'object' || object === null || Array.isArray(object)) {
    throw new Error('Invalid Stripe event');
  }
  return { id: record.id, type: record.type, object: object as Record<string, unknown> };
}

function checkoutUnavailable(): Annunci10xPublicError {
  return new Annunci10xPublicError('CHECKOUT_UNAVAILABLE', 'Checkout Annunci 10x non disponibile.', 503);
}
