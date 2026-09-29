import { randomUUID } from 'node:crypto';
import type { RadarStripeEvent } from './stripe.ts';

export const RADAR_OFFER_CODE = 'RADAR_IMPRESA_REPORT' as const;
export const RADAR_CAPABILITY = 'RADAR_RESULT_ACCESS' as const;

export class RadarCheckoutError extends Error { constructor(message: string) { super(message); this.name = 'RadarCheckoutError'; } }

export interface RadarCatalog { offerCode: typeof RADAR_OFFER_CODE; capability: typeof RADAR_CAPABILITY; priceId: string; amountCents: number; currency: 'EUR'; baseUrl: string }
export interface RadarPurchase { id: string; assessmentId: string; checkoutSessionId?: string; paymentIntentId?: string; status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELED' | 'REFUNDED' }

export interface RadarCommerceStore {
  createPurchase(input: { assessmentId: string; priceId: string; amountCents: number }): Promise<RadarPurchase>;
  attachCheckout(purchaseId: string, checkoutSessionId: string): Promise<void>;
  claimEvent(event: RadarStripeEvent): Promise<boolean>;
  findByCheckout(id: string): Promise<RadarPurchase | null>;
  findByPayment(id: string): Promise<RadarPurchase | null>;
  markPaid(purchase: RadarPurchase, paymentIntentId: string, customerId?: string): Promise<number>;
  markRefunded(purchase: RadarPurchase): Promise<void>;
  hasAccess(assessmentId: string): boolean | Promise<boolean>;
  getCustomerEmail(assessmentId: string): Promise<string>;
}

export function resolveRadarCatalog(env: Record<string, string | undefined> = process.env): RadarCatalog {
  if (env.RADAR_CHECKOUT_ENABLED !== '1') throw new RadarCheckoutError('Checkout Radar non disponibile.');
  const priceId = env.RADAR_STRIPE_PRICE_REPORT?.trim();
  const amountCents = Number(env.RADAR_PRICE_AMOUNT_CENTS);
  const baseUrl = env.RADAR_PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
  if (!priceId || !Number.isInteger(amountCents) || amountCents <= 0 || !baseUrl) throw new RadarCheckoutError('Catalogo Radar non configurato.');
  const parsed = new URL(baseUrl);
  if (env.NODE_ENV === 'production' && parsed.protocol !== 'https:') throw new RadarCheckoutError('URL Radar non sicuro.');
  return { offerCode: RADAR_OFFER_CODE, capability: RADAR_CAPABILITY, priceId, amountCents, currency: 'EUR', baseUrl };
}

export async function handleRadarStripeEvent(store: RadarCommerceStore, event: RadarStripeEvent): Promise<{ processed: boolean; grantsCreated: number }> {
  if (!await store.claimEvent(event)) return { processed: false, grantsCreated: 0 };
  if ((event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') && event.object.payment_status === 'paid') {
    const checkoutId = String(event.object.id ?? '');
    const purchase = await store.findByCheckout(checkoutId);
    if (!purchase) return { processed: true, grantsCreated: 0 };
    const grantsCreated = await store.markPaid(purchase, String(event.object.payment_intent ?? ''), typeof event.object.customer === 'string' ? event.object.customer : undefined);
    return { processed: true, grantsCreated };
  }
  if (event.type === 'charge.refunded') {
    const purchase = await store.findByPayment(String(event.object.payment_intent ?? ''));
    if (purchase) await store.markRefunded(purchase);
  }
  return { processed: true, grantsCreated: 0 };
}

export function createMemoryRadarCommerce() {
  const purchases = new Map<string, RadarPurchase>(); const events = new Set<string>(); const access = new Set<string>();
  return {
    addPurchase(purchase: RadarPurchase) { purchases.set(purchase.id, purchase); },
    async createPurchase(input: { assessmentId: string }) { const purchase = { id: randomUUID(), assessmentId: input.assessmentId, status: 'PENDING' as const }; purchases.set(purchase.id, purchase); return purchase; },
    async attachCheckout(id: string, checkoutSessionId: string) { const item = purchases.get(id); if (item) item.checkoutSessionId = checkoutSessionId; },
    async claimEvent(event: RadarStripeEvent) { if (events.has(event.id)) return false; events.add(event.id); return true; },
    async findByCheckout(id: string) { return [...purchases.values()].find((item) => item.checkoutSessionId === id) ?? null; },
    async findByPayment(id: string) { return [...purchases.values()].find((item) => item.paymentIntentId === id) ?? null; },
    async markPaid(purchase: RadarPurchase, paymentIntentId: string) { purchase.status = 'PAID'; purchase.paymentIntentId = paymentIntentId; const created = access.has(purchase.assessmentId) ? 0 : 1; access.add(purchase.assessmentId); return created; },
    async markRefunded(purchase: RadarPurchase) { purchase.status = 'REFUNDED'; access.delete(purchase.assessmentId); },
    hasAccess(assessmentId: string) { return access.has(assessmentId); },
    async getCustomerEmail() { return 'customer@example.com'; },
  } satisfies RadarCommerceStore & { addPurchase(purchase: RadarPurchase): void };
}

export class SupabaseRadarCommerce implements RadarCommerceStore {
  constructor(privateConfig: { url: string; serviceRoleKey: string; fetchImpl?: typeof fetch }) { this.config = privateConfig; }
  private readonly config: { url: string; serviceRoleKey: string; fetchImpl?: typeof fetch };
  async createPurchase(input: { assessmentId: string; priceId: string; amountCents: number }) { const existing = await this.request<Record<string, unknown>[]>(`/rest/v1/radar_purchases?assessment_id=eq.${input.assessmentId}&offer_code=eq.${RADAR_OFFER_CODE}&status=eq.PENDING&select=id,assessment_id,status,stripe_checkout_session_id,stripe_payment_intent_id`, { method: 'GET' }); if (existing[0]) return parsePurchase(existing[0]); const rows = await this.request<Record<string, unknown>[]>('/rest/v1/radar_purchases?select=id,assessment_id,status', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ assessment_id: input.assessmentId, offer_code: RADAR_OFFER_CODE, expected_amount_cents: input.amountCents, stripe_price_id: input.priceId }) }); return parsePurchase(rows[0]); }
  async attachCheckout(id: string, checkoutSessionId: string) { await this.request(`/rest/v1/radar_purchases?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ stripe_checkout_session_id: checkoutSessionId, checkout_created_at: new Date().toISOString() }) }); }
  async claimEvent(event: RadarStripeEvent) { const response = await this.raw('/rest/v1/radar_stripe_events?on_conflict=stripe_event_id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: JSON.stringify({ stripe_event_id: event.id, event_type: event.type, object_id: typeof event.object.id === 'string' ? event.object.id : null }) }); const rows = await response.json() as unknown[]; return rows.length > 0; }
  async findByCheckout(id: string) { return this.find(`stripe_checkout_session_id=eq.${encodeURIComponent(id)}`); }
  async findByPayment(id: string) { return this.find(`stripe_payment_intent_id=eq.${encodeURIComponent(id)}`); }
  async markPaid(purchase: RadarPurchase, paymentIntentId: string, customerId?: string) { await this.request('/rest/v1/rpc/radar_grant_paid_access', { method: 'POST', body: JSON.stringify({ p_purchase_id: purchase.id, p_payment_intent_id: paymentIntentId, p_customer_id: customerId ?? null }) }); return purchase.status === 'PAID' ? 0 : 1; }
  async markRefunded(purchase: RadarPurchase) { await this.request(`/rest/v1/radar_purchases?id=eq.${purchase.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'REFUNDED', refunded_at: new Date().toISOString() }) }); await this.request(`/rest/v1/radar_entitlement_grants?purchase_id=eq.${purchase.id}`, { method: 'PATCH', body: JSON.stringify({ revoked_at: new Date().toISOString() }) }); }
  async hasAccess(assessmentId: string) { const rows = await this.request<unknown[]>(`/rest/v1/radar_entitlement_grants?assessment_id=eq.${assessmentId}&revoked_at=is.null&select=id`, { method: 'GET' }); return rows.length > 0; }
  async getCustomerEmail(assessmentId: string) { const rows = await this.request<Array<{ referente_email?: unknown }>>(`/rest/v1/radar_assessments?id=eq.${assessmentId}&select=referente_email`, { method: 'GET' }); const email = rows[0]?.referente_email; if (typeof email !== 'string' || !email) throw new Error('Email Radar non disponibile.'); return email; }
  private async find(query: string) { const rows = await this.request<Record<string, unknown>[]>(`/rest/v1/radar_purchases?${query}&select=id,assessment_id,status,stripe_checkout_session_id,stripe_payment_intent_id`, { method: 'GET' }); return rows[0] ? parsePurchase(rows[0]) : null; }
  private async raw(path: string, init: RequestInit) { const response = await (this.config.fetchImpl ?? fetch)(`${this.config.url.replace(/\/$/, '')}${path}`, { ...init, headers: { apikey: this.config.serviceRoleKey, Authorization: `Bearer ${this.config.serviceRoleKey}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } }); if (!response.ok) throw new Error(`Radar commerce database error: ${await response.text()}`); return response; }
  private async request<T = unknown>(path: string, init: RequestInit): Promise<T> { const response = await this.raw(path, init); const text = await response.text(); return (text ? JSON.parse(text) : undefined) as T; }
}

export function createRadarCommerce(env: Record<string, string | undefined> = process.env): SupabaseRadarCommerce { const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim(); const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim(); if (!url || !key) throw new RadarCheckoutError('Persistenza commerciale Radar non configurata.'); return new SupabaseRadarCommerce({ url, serviceRoleKey: key }); }

function parsePurchase(row: Record<string, unknown> | undefined): RadarPurchase { if (!row || typeof row.id !== 'string' || typeof row.assessment_id !== 'string') throw new Error('Acquisto Radar non valido.'); return { id: row.id, assessmentId: row.assessment_id, status: row.status as RadarPurchase['status'], checkoutSessionId: typeof row.stripe_checkout_session_id === 'string' ? row.stripe_checkout_session_id : undefined, paymentIntentId: typeof row.stripe_payment_intent_id === 'string' ? row.stripe_payment_intent_id : undefined }; }
