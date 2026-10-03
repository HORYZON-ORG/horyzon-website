import {
  getAnnunci10xOffer,
  isAnnunci10xCheckoutEnabled,
  isAnnunci10xOfferCode,
  type Annunci10xOfferCode,
} from '../commercial.ts';
import { Annunci10xPublicError, type Annunci10xRuntimeContext, type Annunci10xSessionCookie } from '../product-flow.ts';
import type { PersistedPurchase } from '../persistence/types.ts';
import {
  createAnnunci10xPaymentGateway,
  createAnnunci10xWebhookGateway,
  readStripeWebhookSecret,
  resolveAnnunci10xPublicBaseUrl,
  resolveStripePriceId,
  type Annunci10xPaymentGateway,
  type Annunci10xStripeWebhookEvent,
} from './stripe.ts';

export interface CreateAnnunci10xCheckoutInput {
  session: Annunci10xSessionCookie;
  offerCode: unknown;
  context: Annunci10xRuntimeContext;
  gateway?: Annunci10xPaymentGateway;
  env?: Record<string, string | undefined>;
}

export interface CreateAnnunci10xCheckoutResult {
  purchaseId: string;
  offerCode: Annunci10xOfferCode;
  checkoutUrl: string;
}

export interface ProcessAnnunci10xStripeWebhookInput {
  rawBody: string;
  signature: string | null;
  context: Annunci10xRuntimeContext;
  gateway?: Annunci10xPaymentGateway;
  env?: Record<string, string | undefined>;
}

export interface ProcessAnnunci10xStripeWebhookResult {
  received: true;
  status: 'PROCESSED' | 'IGNORED' | 'FAILED' | 'DUPLICATE';
}

export class Annunci10xStripeWebhookRetryableError extends Error {
  readonly code: string;

  constructor(code = 'PAYMENT_RETRYABLE_PROCESSING_ERROR') {
    super('Retryable Annunci 10x Stripe webhook processing error.');
    this.name = 'Annunci10xStripeWebhookRetryableError';
    this.code = code;
  }
}

class Annunci10xStripeTerminalReconciliationError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'Annunci10xStripeTerminalReconciliationError';
    this.code = code;
  }
}

export function isAnnunci10xStripeWebhookRetryableError(error: unknown): error is Annunci10xStripeWebhookRetryableError {
  return error instanceof Annunci10xStripeWebhookRetryableError;
}

export function annunci10xStripeWebhookErrorStatus(error: unknown): 400 | 500 {
  if (error instanceof Annunci10xPublicError && error.status === 400) return 400;
  return 500;
}

export async function createAnnunci10xCheckoutSession(input: CreateAnnunci10xCheckoutInput): Promise<CreateAnnunci10xCheckoutResult> {
  const env = input.env ?? process.env;
  const offerCode = parseOfferCode(input.offerCode);
  const offer = getAnnunci10xOffer(offerCode);
  const session = await input.context.persistence.getSession(input.session.sessionId, input.session.sessionSecret);
  if (!session) throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione Annunci 10x assente.', 401);
  if (!offer.flows.includes(session.flow)) throw paymentInvalid();
  const lead = await input.context.persistence.getLead(input.session.sessionId, input.session.sessionSecret);
  if (!lead?.emailVerifiedAt) throw new Annunci10xPublicError('EMAIL_VERIFICATION_REQUIRED', 'Verifica la tua email per completare l acquisto.', 403);
  if (!isAnnunci10xCheckoutEnabled(env)) throw new Annunci10xPublicError('CHECKOUT_DISABLED', 'Checkout Annunci 10x temporaneamente non disponibile.', 503);
  if (offerCode === 'AGENT_RECRUITER') {
    const entitlements = await input.context.persistence.getEffectiveEntitlements(input.session.sessionId, input.session.sessionSecret);
    if (entitlements.agentRecruiterAccess) throw paymentInvalid();
  }

  const stripePriceId = resolveStripePriceId(offerCode, env);
  const baseUrl = resolveAnnunci10xPublicBaseUrl(env);
  const purchase = await input.context.persistence.createOrGetPurchase({
    sessionId: input.session.sessionId,
    sessionSecret: input.session.sessionSecret,
    leadId: lead.id,
    offerCode,
    expectedAmountCents: offer.price.amountCents,
    currency: offer.price.currency,
    stripePriceId,
  });
  assertPurchaseConsistentForCheckout({ purchase, offerCode, leadId: lead.id });
  const persistedStripePriceId = purchase.stripePriceId;
  if (!persistedStripePriceId) throw new Annunci10xPublicError('CHECKOUT_UNAVAILABLE', 'Checkout Annunci 10x non disponibile.', 503);
  const gateway = input.gateway ?? createAnnunci10xPaymentGateway(env);
  const checkout = await gateway.createCheckoutSession({
    purchaseId: purchase.id,
    offerCode,
    stripePriceId: persistedStripePriceId,
    customerEmail: lead.emailNormalized,
    successUrl: `${baseUrl}/annunci-10x?checkout=success`,
    cancelUrl: `${baseUrl}/annunci-10x?checkout=cancelled`,
  });
  const attached = await input.context.persistence.attachCheckoutSession({
    purchaseId: purchase.id,
    sessionSecret: input.session.sessionSecret,
    stripeCheckoutSessionId: checkout.id,
  });
  await input.context.persistence.appendEvent({
    sessionId: input.session.sessionId,
    eventName: 'checkout_created',
    metadata: { offerCode: attached.offerCode, purchaseId: attached.id },
  });
  return { purchaseId: attached.id, offerCode: attached.offerCode, checkoutUrl: checkout.url };
}

export async function processAnnunci10xStripeWebhook(input: ProcessAnnunci10xStripeWebhookInput): Promise<ProcessAnnunci10xStripeWebhookResult> {
  if (!input.signature) throw new Annunci10xPublicError('PAYMENT_INVALID', 'Firma Stripe non valida.', 400);
  const env = input.env ?? process.env;
  const gateway = input.gateway ?? createAnnunci10xWebhookGateway(env);
  let event: Annunci10xStripeWebhookEvent;
  try {
    event = await gateway.constructWebhookEvent(input.rawBody, input.signature, readStripeWebhookSecret(env));
  } catch {
    throw new Annunci10xPublicError('PAYMENT_INVALID', 'Firma Stripe non valida.', 400);
  }
  const claim = await input.context.persistence.claimStripeEvent({
    stripeEventId: event.id,
    eventType: event.type,
    objectId: stripeObjectId(event.object),
  });
  if (!claim) return { received: true, status: 'DUPLICATE' };

  try {
    const status = await processClaimedEvent(event, input.context);
    await input.context.persistence.markStripeEvent({ stripeEventId: event.id, status });
    return { received: true, status };
  } catch (error) {
    const terminal = isTerminalReconciliationError(error);
    try {
      await input.context.persistence.markStripeEvent({
        stripeEventId: event.id,
        status: 'FAILED',
        errorCode: errorCode(error),
      });
    } catch {
      throw new Annunci10xStripeWebhookRetryableError('PAYMENT_EVENT_MARK_FAILED');
    }
    if (terminal) return { received: true, status: 'FAILED' };
    throw new Annunci10xStripeWebhookRetryableError(errorCode(error));
  }
}

async function processClaimedEvent(event: Annunci10xStripeWebhookEvent, context: Annunci10xRuntimeContext): Promise<'PROCESSED' | 'IGNORED'> {
  if (event.type === 'checkout.session.completed') return processCheckoutCompleted(event, context);
  if (event.type === 'checkout.session.expired') return processCheckoutExpired(event, context);
  if (event.type === 'payment_intent.payment_failed') return processPaymentFailed(event, context);
  if (event.type === 'charge.refunded') return processChargeRefunded(event, context);
  return 'IGNORED';
}

async function processCheckoutCompleted(event: Annunci10xStripeWebhookEvent, context: Annunci10xRuntimeContext): Promise<'PROCESSED'> {
  const checkoutSessionId = requiredString(event.object.id, 'CHECKOUT_SESSION_ID_MISSING');
  if (event.object.payment_status !== 'paid') throw terminalError('CHECKOUT_NOT_PAID');
  const amountTotal = requiredInteger(event.object.amount_total, 'CHECKOUT_AMOUNT_INVALID');
  const currency = requiredString(event.object.currency, 'CHECKOUT_CURRENCY_INVALID').toLowerCase();
  const purchase = await context.persistence.getPurchaseByCheckoutSessionId(checkoutSessionId);
  if (!purchase) throw terminalError('PURCHASE_NOT_FOUND');
  prevalidatePaidCheckout({ purchase, checkoutSessionId, amountTotal, currency });
  await context.persistence.completePaidPurchase({
    purchaseId: purchase.id,
    stripeCheckoutSessionId: checkoutSessionId,
    amountCents: amountTotal,
    currency,
    stripePaymentIntentId: optionalString(event.object.payment_intent),
    stripeCustomerId: optionalString(event.object.customer),
  });
  await appendPurchaseEvent(context, purchase, 'purchase_paid');
  return 'PROCESSED';
}

async function processCheckoutExpired(event: Annunci10xStripeWebhookEvent, context: Annunci10xRuntimeContext): Promise<'PROCESSED' | 'IGNORED'> {
  const purchase = await context.persistence.markPurchaseCanceled({ stripeCheckoutSessionId: requiredString(event.object.id, 'CHECKOUT_SESSION_ID_MISSING') });
  return purchase ? 'PROCESSED' : 'IGNORED';
}

async function processPaymentFailed(event: Annunci10xStripeWebhookEvent, context: Annunci10xRuntimeContext): Promise<'PROCESSED' | 'IGNORED'> {
  requiredString(event.object.id, 'PAYMENT_INTENT_ID_MISSING');
  const purchaseId = purchaseIdFromMetadata(event.object);
  if (!purchaseId) return 'IGNORED';
  const purchase = await context.persistence.getPurchaseById(purchaseId);
  if (!purchase) return 'IGNORED';
  await context.persistence.appendEvent({
    sessionId: purchase.sessionId,
    eventName: 'payment_attempt_failed',
    metadata: { offerCode: purchase.offerCode, purchaseId: purchase.id },
  });
  return 'PROCESSED';
}

async function processChargeRefunded(event: Annunci10xStripeWebhookEvent, context: Annunci10xRuntimeContext): Promise<'PROCESSED' | 'IGNORED'> {
  const purchase = await context.persistence.markPurchaseRefunded({
    stripePaymentIntentId: requiredString(event.object.payment_intent, 'PAYMENT_INTENT_ID_MISSING'),
    purchaseId: purchaseIdFromMetadata(event.object),
  });
  if (purchase) await appendPurchaseEvent(context, purchase, 'purchase_refunded');
  return purchase ? 'PROCESSED' : 'IGNORED';
}

async function appendPurchaseEvent(context: Annunci10xRuntimeContext, purchase: PersistedPurchase, eventName: 'purchase_paid' | 'purchase_refunded'): Promise<void> {
  await context.persistence.appendEvent({
    sessionId: purchase.sessionId,
    eventName,
    metadata: { offerCode: purchase.offerCode, purchaseId: purchase.id },
  });
}

function parseOfferCode(value: unknown): Annunci10xOfferCode {
  if (isAnnunci10xOfferCode(value)) return value;
  throw paymentInvalid();
}

function stripeObjectId(object: Record<string, unknown>): string | null {
  return optionalString(object.id);
}

function purchaseIdFromMetadata(object: Record<string, unknown>): string | null {
  const metadata = object.metadata;
  if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) return null;
  return optionalString((metadata as Record<string, unknown>).annunci10x_purchase_id);
}

function requiredString(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw terminalError(code);
  return value;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function requiredInteger(value: unknown, code: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw terminalError(code);
  return value;
}

function errorCode(error: unknown): string {
  const message = error instanceof Annunci10xStripeTerminalReconciliationError ? error.code
    : error instanceof Annunci10xStripeWebhookRetryableError ? error.code
      : error instanceof Error ? error.message : 'PAYMENT_RECONCILIATION_FAILED';
  return message.replace(/[^A-Z0-9_]/gi, '_').toUpperCase().slice(0, 80) || 'PAYMENT_RECONCILIATION_FAILED';
}

function assertPurchaseConsistentForCheckout(input: {
  purchase: PersistedPurchase;
  offerCode: Annunci10xOfferCode;
  leadId: string;
}): void {
  if (
    input.purchase.offerCode !== input.offerCode
    || input.purchase.leadId !== input.leadId
    || input.purchase.currency !== 'EUR'
    || input.purchase.expectedAmountCents <= 0
    || !input.purchase.stripePriceId
  ) {
    throw new Annunci10xPublicError('CHECKOUT_UNAVAILABLE', 'Checkout Annunci 10x non disponibile.', 503);
  }
}

function prevalidatePaidCheckout(input: {
  purchase: PersistedPurchase;
  checkoutSessionId: string;
  amountTotal: number;
  currency: string;
}): void {
  if (input.purchase.stripeCheckoutSessionId !== input.checkoutSessionId) throw terminalError('CHECKOUT_SESSION_MISMATCH');
  if (input.purchase.expectedAmountCents !== input.amountTotal) throw terminalError('CHECKOUT_AMOUNT_MISMATCH');
  if (input.currency !== 'eur' || input.purchase.currency.toLowerCase() !== input.currency) throw terminalError('CHECKOUT_CURRENCY_MISMATCH');
  if (input.purchase.status !== 'PENDING' && input.purchase.status !== 'PAID') throw terminalError('PURCHASE_STATUS_INCOMPATIBLE');
}

function terminalError(code: string): Annunci10xStripeTerminalReconciliationError {
  return new Annunci10xStripeTerminalReconciliationError(code);
}

function isTerminalReconciliationError(error: unknown): error is Annunci10xStripeTerminalReconciliationError {
  return error instanceof Annunci10xStripeTerminalReconciliationError;
}

function paymentInvalid(): Annunci10xPublicError {
  return new Annunci10xPublicError('PAYMENT_INVALID', 'Pagamento Annunci 10x non valido.', 400);
}
