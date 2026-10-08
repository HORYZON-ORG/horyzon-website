import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import Stripe from 'stripe';

process.env.ANNUNCI10X_EMAIL_VERIFICATION_PEPPER = `${randomUUID()}${randomUUID()}`;

const {
  MemoryAnnunci10xPersistenceAdapter,
  MockAnnunci10xEmailProvider,
  MockAnnunci10xPaymentGateway,
  StripeAnnunci10xPaymentGateway,
  Annunci10xPublicError,
  Annunci10xStripeWebhookRetryableError,
  annunci10xStripeWebhookErrorStatus,
  createAnonymousAnalyzeSession,
  createAnonymousCreateSession,
  createAnnunci10xCheckoutSession,
  createAnnunci10xPaymentGateway,
  createAnnunci10xWebhookGateway,
  hashEmailVerificationCode,
  processAnnunci10xStripeWebhook,
  requestAnnunci10xEmailVerification,
  saveAnnunci10xLeadContact,
  stripeCheckoutIdempotencyKey,
  verifyAnnunci10xEmailCode,
} = await import('../src/lib/annunci-10x/index.ts');

await assertCreateLeadReachability();
await assertCheckoutDisabled();
await assertCheckoutEnabledAndRetry();
await assertClientTamperingAndUnverified();
await assertStripeWrapper();
await assertWebhookVerifierDoesNotRequireApiKey();
await assertPaidWebhookDuplicateAndConcurrent();
await assertMismatchAndLifecycleEvents();
await assertPaymentFailureLifecycle();
await assertTransientRetryAndRouteStatus();
await assertPendingPriceStability();
await assertEffectiveEntitlements();
await assertMigrationAndRoutes();

console.log('Annunci 10x Stripe commerce verifier passed');

async function assertCreateLeadReachability() {
  const context = makeContext();
  const created = await createAnonymousCreateSession(context);
  const session = { sessionId: created.session.id, sessionSecret: created.sessionSecret };
  const saved = await saveAnnunci10xLeadContact({
    session,
    context,
    firstName: 'Ada',
    lastName: 'Lovelace',
    companyName: 'Horyzon Test',
    businessRole: 'HR',
    email: `create.${randomUUID()}@example.com`,
    marketingConsent: false,
  });
  assert.equal(saved.contactSaved, true);
  const provider = new MockAnnunci10xEmailProvider();
  const requested = await requestAnnunci10xEmailVerification({
    session,
    context,
    provider,
    requestFingerprint: 'create-checkout-contact-test',
    env: process.env,
  });
  assert.equal(requested.sent, true);
  assert.equal(provider.sentVerificationCodes.length, 1);
  await verifyAnnunci10xEmailCode({
    session,
    context,
    code: provider.sentVerificationCodes[0].code,
    analysisRunId: null,
    requestFingerprint: 'create-checkout-contact-test',
    env: process.env,
  });
  const gateway = new MockAnnunci10xPaymentGateway();
  await assert.rejects(
    () => createAnnunci10xCheckoutSession({
      session,
      offerCode: 'ANNUNCI10X_CREATE',
      context,
      gateway,
      env: env({ checkoutEnabled: true }),
    }),
    (error) => error.code === 'CHECKOUT_DISABLED' && error.status === 503,
    'free CREATE must not create a Stripe checkout session',
  );
  assert.equal(gateway.checkoutSessions.length, 0);
}

async function assertCheckoutDisabled() {
  const { context, session } = await verifiedSession('ANALYZE');
  const gateway = new MockAnnunci10xPaymentGateway();
  await assert.rejects(
    () => createAnnunci10xCheckoutSession({
      session,
      offerCode: 'ANNUNCI10X_REWRITE',
      context,
      gateway,
      env: env({ checkoutEnabled: false }),
    }),
    (error) => error.code === 'CHECKOUT_DISABLED' && error.status === 503,
  );
  assert.equal(gateway.checkoutSessions.length, 0, 'disabled checkout must not call gateway');
}

async function assertCheckoutEnabledAndRetry() {
  const { context, session, lead } = await verifiedSession('ANALYZE');
  const gateway = new MockAnnunci10xPaymentGateway();
  const first = await createAnnunci10xCheckoutSession({
    session,
    offerCode: 'AGENT_RECRUITER',
    context,
    gateway,
    env: env({ checkoutEnabled: true }),
  });
  assert.equal(first.offerCode, 'AGENT_RECRUITER');
  assert.match(first.checkoutUrl, /^https:\/\/checkout\.stripe\.test/);
  assert.equal(gateway.checkoutSessions.length, 1);
  assert.equal(gateway.checkoutSessions[0].stripePriceId, 'price_agent_test');
  assert.equal(gateway.checkoutSessions[0].customerEmail, lead.emailNormalized);
  assert.equal(gateway.checkoutSessions[0].successUrl, 'https://horyzon.test/annunci-10x?checkout=success');
  assert.equal(gateway.checkoutSessions[0].cancelUrl, 'https://horyzon.test/annunci-10x?checkout=cancelled');

  const purchase = await context.persistence.getPurchaseByCheckoutSessionId(gateway.checkoutSessions[0].purchaseId.startsWith('missing') ? 'missing' : `cs_test_${first.purchaseId.replaceAll('-', '').slice(0, 24)}`);
  assert.ok(purchase);
  assert.equal(purchase.status, 'PENDING');
  assert.equal(purchase.expectedAmountCents, 4900);
  assert.equal(purchase.currency, 'EUR');

  const second = await createAnnunci10xCheckoutSession({
    session,
    offerCode: 'AGENT_RECRUITER',
    context,
    gateway,
    env: env({ checkoutEnabled: true }),
  });
  assert.equal(second.purchaseId, first.purchaseId, 'retry reuses same pending purchase');
  assert.equal(gateway.checkoutSessions.length, 2);
  assert.equal(stripeCheckoutIdempotencyKey(gateway.checkoutSessions[0].purchaseId), stripeCheckoutIdempotencyKey(gateway.checkoutSessions[1].purchaseId));
}

async function assertClientTamperingAndUnverified() {
  const { context, session } = await verifiedSession('ANALYZE');
  const gateway = new MockAnnunci10xPaymentGateway();
  const malicious = {
    offerCode: 'AGENT_RECRUITER',
    amountCents: 1,
    currency: 'USD',
    stripePriceId: 'price_fake',
    paid: true,
    entitlements: ['AGENT_RECRUITER_ACCESS'],
    successUrl: 'https://evil.example/success',
    customerEmail: 'evil@example.com',
  };
  await createAnnunci10xCheckoutSession({
    session,
    offerCode: malicious.offerCode,
    context,
    gateway,
    env: env({ checkoutEnabled: true }),
  });
  assert.equal(gateway.checkoutSessions[0].stripePriceId, 'price_agent_test');
  assert.equal(gateway.checkoutSessions[0].customerEmail.endsWith('@example.com'), true);
  assert.equal(gateway.checkoutSessions[0].successUrl, 'https://horyzon.test/annunci-10x?checkout=success');

  const unverified = await unverifiedSession();
  const blockedGateway = new MockAnnunci10xPaymentGateway();
  await assert.rejects(
    () => createAnnunci10xCheckoutSession({
      session: unverified.session,
      offerCode: 'AGENT_RECRUITER',
      context: unverified.context,
      gateway: blockedGateway,
      env: env({ checkoutEnabled: true }),
    }),
    (error) => error.code === 'EMAIL_VERIFICATION_REQUIRED',
  );
  assert.equal(blockedGateway.checkoutSessions.length, 0);
}

async function assertStripeWrapper() {
  const calls = [];
  const gateway = new StripeAnnunci10xPaymentGateway({
    client: {
      checkout: {
        sessions: {
          async create(payload, options) {
            calls.push({ payload, options });
            return { id: 'cs_fake', url: 'https://checkout.stripe.test/fake' };
          },
        },
      },
      webhooks: {
        constructEvent(rawBody) {
          return JSON.parse(rawBody);
        },
      },
    },
  });
  const created = await gateway.createCheckoutSession({
    purchaseId: 'purchase-123',
    offerCode: 'AGENT_RECRUITER',
    stripePriceId: 'price_agent_test',
    customerEmail: 'verified@example.com',
    successUrl: 'https://horyzon.test/annunci-10x?checkout=success',
    cancelUrl: 'https://horyzon.test/annunci-10x?checkout=cancelled',
  });
  assert.equal(created.id, 'cs_fake');
  assert.equal(calls[0].options.idempotencyKey, 'annunci10x-checkout/purchase-123');
  assert.deepEqual(calls[0].payload.payment_method_types, ['card']);
  assert.equal(calls[0].payload.payment_method_collection, 'if_required');
  assert.deepEqual(calls[0].payload.metadata, {
    annunci10x_purchase_id: 'purchase-123',
    annunci10x_offer_code: 'AGENT_RECRUITER',
  });
  assert.deepEqual(calls[0].payload.payment_intent_data.metadata, {
    annunci10x_purchase_id: 'purchase-123',
    annunci10x_offer_code: 'AGENT_RECRUITER',
  });
  assert.equal(calls[0].payload.customer_email, 'verified@example.com');
  assert.equal(JSON.stringify(calls[0].payload).includes('sessionSecret'), false);
  assert.equal(JSON.stringify(calls[0].payload).includes('RoleCard'), false);
}


async function assertWebhookVerifierDoesNotRequireApiKey() {
  assert.throws(
    () => createAnnunci10xPaymentGateway({}),
    (error) => error.code === 'CHECKOUT_UNAVAILABLE',
    'checkout gateway must still require STRIPE_SECRET_KEY',
  );

  const webhookSecret = 'whsec_annunci10x_test';
  const rawBody = stripeEvent({
    id: 'evt_webhook_only_gateway',
    type: 'checkout.session.expired',
    object: { id: 'cs_test_webhook_only' },
  });
  const signer = new Stripe('sk_test_annunci10x_signer');
  const signature = signer.webhooks.generateTestHeaderString({ payload: rawBody, secret: webhookSecret });
  const webhookGateway = createAnnunci10xWebhookGateway({});
  const event = await webhookGateway.constructWebhookEvent(rawBody, signature, webhookSecret);
  assert.equal(event.id, 'evt_webhook_only_gateway');
  assert.equal(event.type, 'checkout.session.expired');

  await assert.rejects(
    () => webhookGateway.createCheckoutSession({
      purchaseId: 'purchase-webhook-only',
      offerCode: 'ANNUNCI10X_CREATE',
      stripePriceId: 'price_create_test',
      customerEmail: 'verified@example.com',
      successUrl: 'https://horyzon.test/success',
      cancelUrl: 'https://horyzon.test/cancel',
    }),
    (error) => error.code === 'CHECKOUT_UNAVAILABLE',
    'webhook-only gateway must never create checkout sessions',
  );
}

async function assertPaidWebhookDuplicateAndConcurrent() {
  const { context, session } = await verifiedSession('ANALYZE');
  const checkout = await createCheckout(context, session, 'AGENT_RECRUITER');
  const raw = stripeEvent({
    id: 'evt_paid_once',
    type: 'checkout.session.completed',
    object: {
      id: checkout.sessionId,
      payment_status: 'paid',
      amount_total: 4900,
      currency: 'eur',
      payment_intent: 'pi_paid_once',
      customer: 'cus_paid_once',
    },
  });
  const first = await processWebhook(context, raw);
  assert.equal(first.status, 'PROCESSED');
  const purchase = await context.persistence.getPurchaseByCheckoutSessionId(checkout.sessionId);
  assert.equal(purchase.status, 'PAID');
  assert.equal((await context.persistence.getEffectiveEntitlements(session.sessionId, session.sessionSecret)).agentRecruiterAccess, true);

  const duplicate = await processWebhook(context, raw);
  assert.equal(duplicate.status, 'DUPLICATE');
  assert.equal((await context.persistence.getEffectiveEntitlements(session.sessionId, session.sessionSecret)).agentRecruiterAccess, true);

  const concurrent = await Promise.all([processWebhook(context, raw), processWebhook(context, raw)]);
  assert.deepEqual(concurrent.map((item) => item.status), ['DUPLICATE', 'DUPLICATE']);
}

async function assertMismatchAndLifecycleEvents() {
  const amountCase = await verifiedSession('ANALYZE');
  const amountCheckout = await createCheckout(amountCase.context, amountCase.session, 'AGENT_RECRUITER');
  const amountResult = await processWebhook(amountCase.context, stripeEvent({
    id: 'evt_bad_amount',
    type: 'checkout.session.completed',
    object: { id: amountCheckout.sessionId, payment_status: 'paid', amount_total: 1, currency: 'eur' },
  }));
  assert.equal(amountResult.status, 'FAILED');
  assert.equal((await amountCase.context.persistence.getPurchaseByCheckoutSessionId(amountCheckout.sessionId)).status, 'PENDING');
  assert.equal((await amountCase.context.persistence.getEffectiveEntitlements(amountCase.session.sessionId, amountCase.session.sessionSecret)).agentRecruiterAccess, false);

  const currencyCase = await verifiedSession('ANALYZE');
  const currencyCheckout = await createCheckout(currencyCase.context, currencyCase.session, 'AGENT_RECRUITER');
  const currencyResult = await processWebhook(currencyCase.context, stripeEvent({
    id: 'evt_bad_currency',
    type: 'checkout.session.completed',
    object: { id: currencyCheckout.sessionId, payment_status: 'paid', amount_total: 4900, currency: 'usd' },
  }));
  assert.equal(currencyResult.status, 'FAILED');

  const invalidCase = await verifiedSession('ANALYZE');
  const invalidCheckout = await createCheckout(invalidCase.context, invalidCase.session, 'AGENT_RECRUITER');
  await assert.rejects(
    () => processAnnunci10xStripeWebhook({
      rawBody: stripeEvent({ id: 'evt_invalid_signature', type: 'checkout.session.expired', object: { id: invalidCheckout.sessionId } }),
      signature: 'bad-signature',
      context: invalidCase.context,
      gateway: new MockAnnunci10xPaymentGateway(),
      env: env({ checkoutEnabled: false }),
    }),
    (error) => error.code === 'PAYMENT_INVALID' && error.status === 400,
  );
  assert.equal((await invalidCase.context.persistence.getPurchaseByCheckoutSessionId(invalidCheckout.sessionId)).status, 'PENDING');

  const expiredCase = await verifiedSession('ANALYZE');
  const expiredCheckout = await createCheckout(expiredCase.context, expiredCase.session, 'AGENT_RECRUITER');
  assert.equal((await processWebhook(expiredCase.context, stripeEvent({ id: 'evt_expired', type: 'checkout.session.expired', object: { id: expiredCheckout.sessionId } }))).status, 'PROCESSED');
  assert.equal((await expiredCase.context.persistence.getPurchaseByCheckoutSessionId(expiredCheckout.sessionId)).status, 'CANCELED');

}

async function assertPaymentFailureLifecycle() {
  const failureCase = await verifiedSession('ANALYZE');
  const checkout = await createCheckout(failureCase.context, failureCase.session, 'AGENT_RECRUITER');
  const failed = await processWebhook(failureCase.context, stripeEvent({
    id: 'evt_payment_failed_once',
    type: 'payment_intent.payment_failed',
    object: { id: 'pi_failed_once', metadata: { annunci10x_purchase_id: checkout.purchaseId, annunci10x_offer_code: 'AGENT_RECRUITER' } },
  }));
  assert.equal(failed.status, 'PROCESSED');
  let purchase = await failureCase.context.persistence.getPurchaseByCheckoutSessionId(checkout.sessionId);
  assert.equal(purchase.status, 'PENDING');
  assert.equal(purchase.failedAt, null);
  assert.equal((await failureCase.context.persistence.getEffectiveEntitlements(failureCase.session.sessionId, failureCase.session.sessionSecret)).agentRecruiterAccess, false);
  assert.equal(failureCase.context.persistence.stripeEvents.get('evt_payment_failed_once').status, 'PROCESSED');

  const repeated = await processWebhook(failureCase.context, stripeEvent({
    id: 'evt_payment_failed_twice',
    type: 'payment_intent.payment_failed',
    object: { id: 'pi_failed_twice', metadata: { annunci10x_purchase_id: checkout.purchaseId, annunci10x_offer_code: 'AGENT_RECRUITER' } },
  }));
  assert.equal(repeated.status, 'PROCESSED');
  purchase = await failureCase.context.persistence.getPurchaseByCheckoutSessionId(checkout.sessionId);
  assert.equal(purchase.status, 'PENDING');
  assert.equal((await failureCase.context.persistence.getEffectiveEntitlements(failureCase.session.sessionId, failureCase.session.sessionSecret)).agentRecruiterAccess, false);
  assert.equal(failureCase.context.persistence.stripeEvents.get('evt_payment_failed_twice').status, 'PROCESSED');

  const paidAfterFailure = await processWebhook(failureCase.context, stripeEvent({
    id: 'evt_paid_after_failure',
    type: 'checkout.session.completed',
    object: {
      id: checkout.sessionId,
      payment_status: 'paid',
      amount_total: 4900,
      currency: 'eur',
      payment_intent: 'pi_paid_after_failure',
    },
  }));
  assert.equal(paidAfterFailure.status, 'PROCESSED');
  purchase = await failureCase.context.persistence.getPurchaseByCheckoutSessionId(checkout.sessionId);
  assert.equal(purchase.status, 'PAID');
  assert.equal((await failureCase.context.persistence.getEffectiveEntitlements(failureCase.session.sessionId, failureCase.session.sessionSecret)).agentRecruiterAccess, true);

  const expiredCase = await verifiedSession('ANALYZE');
  const expiredCheckout = await createCheckout(expiredCase.context, expiredCase.session, 'AGENT_RECRUITER');
  assert.equal((await processWebhook(expiredCase.context, stripeEvent({
    id: 'evt_failure_before_expiry',
    type: 'payment_intent.payment_failed',
    object: { id: 'pi_failure_before_expiry', metadata: { annunci10x_purchase_id: expiredCheckout.purchaseId, annunci10x_offer_code: 'AGENT_RECRUITER' } },
  }))).status, 'PROCESSED');
  assert.equal((await expiredCase.context.persistence.getPurchaseByCheckoutSessionId(expiredCheckout.sessionId)).status, 'PENDING');
  assert.equal((await processWebhook(expiredCase.context, stripeEvent({
    id: 'evt_expired_after_failure',
    type: 'checkout.session.expired',
    object: { id: expiredCheckout.sessionId },
  }))).status, 'PROCESSED');
  assert.equal((await expiredCase.context.persistence.getPurchaseByCheckoutSessionId(expiredCheckout.sessionId)).status, 'CANCELED');
  assert.equal((await expiredCase.context.persistence.getEffectiveEntitlements(expiredCase.session.sessionId, expiredCase.session.sessionSecret)).agentRecruiterAccess, false);
}

async function assertTransientRetryAndRouteStatus() {
  assert.equal(annunci10xStripeWebhookErrorStatus(new Annunci10xPublicError('PAYMENT_INVALID', 'Firma Stripe non valida.', 400)), 400);
  assert.equal(annunci10xStripeWebhookErrorStatus(new Annunci10xStripeWebhookRetryableError()), 500);

  const terminalCase = await verifiedSession('ANALYZE');
  const terminalCheckout = await createCheckout(terminalCase.context, terminalCase.session, 'AGENT_RECRUITER');
  const terminal = await processWebhook(terminalCase.context, stripeEvent({
    id: 'evt_terminal_amount',
    type: 'checkout.session.completed',
    object: { id: terminalCheckout.sessionId, payment_status: 'paid', amount_total: 1, currency: 'eur' },
  }));
  assert.equal(terminal.status, 'FAILED');

  const transientCase = await verifiedSession('ANALYZE');
  const transientCheckout = await createCheckout(transientCase.context, transientCase.session, 'AGENT_RECRUITER');
  const originalComplete = transientCase.context.persistence.completePaidPurchase.bind(transientCase.context.persistence);
  let failedOnce = false;
  transientCase.context.persistence.completePaidPurchase = async (input) => {
    if (!failedOnce) {
      failedOnce = true;
      throw new Error('DATABASE_TIMEOUT');
    }
    return originalComplete(input);
  };
  const raw = stripeEvent({
    id: 'evt_transient_retry',
    type: 'checkout.session.completed',
    object: { id: transientCheckout.sessionId, payment_status: 'paid', amount_total: 4900, currency: 'eur', payment_intent: 'pi_transient_retry' },
  });
  await assert.rejects(
    () => processWebhook(transientCase.context, raw),
    (error) => error instanceof Annunci10xStripeWebhookRetryableError,
  );
  let eventRow = transientCase.context.persistence.stripeEvents.get('evt_transient_retry');
  assert.equal(eventRow.status, 'FAILED');
  assert.equal(eventRow.attempt_count, 1);
  assert.equal((await transientCase.context.persistence.getPurchaseByCheckoutSessionId(transientCheckout.sessionId)).status, 'PENDING');

  const retry = await processWebhook(transientCase.context, raw);
  assert.equal(retry.status, 'PROCESSED');
  eventRow = transientCase.context.persistence.stripeEvents.get('evt_transient_retry');
  assert.equal(eventRow.status, 'PROCESSED');
  assert.equal(eventRow.attempt_count, 2);
  assert.equal((await transientCase.context.persistence.getPurchaseByCheckoutSessionId(transientCheckout.sessionId)).status, 'PAID');
}

async function assertPendingPriceStability() {
  const { context, session } = await verifiedSession('ANALYZE');
  const gateway = new MockAnnunci10xPaymentGateway();
  const first = await createAnnunci10xCheckoutSession({
    session,
    offerCode: 'AGENT_RECRUITER',
    context,
    gateway,
    env: env({ checkoutEnabled: true, agentPrice: 'price_agent_old' }),
  });
  const second = await createAnnunci10xCheckoutSession({
    session,
    offerCode: 'AGENT_RECRUITER',
    context,
    gateway,
    env: env({ checkoutEnabled: true, agentPrice: 'price_agent_new' }),
  });
  assert.equal(second.purchaseId, first.purchaseId);
  assert.equal(gateway.checkoutSessions[0].stripePriceId, 'price_agent_old');
  assert.equal(gateway.checkoutSessions[1].stripePriceId, 'price_agent_old');
  assert.equal(stripeCheckoutIdempotencyKey(gateway.checkoutSessions[0].purchaseId), stripeCheckoutIdempotencyKey(gateway.checkoutSessions[1].purchaseId));
}

async function assertEffectiveEntitlements() {
  const { context, session } = await verifiedSession('CREATE');
  const rewrite = await createCheckout(context, session, 'AGENT_RECRUITER');
  await processWebhook(context, stripeEvent({
    id: 'evt_agent_paid',
    type: 'checkout.session.completed',
    object: { id: rewrite.sessionId, payment_status: 'paid', amount_total: 4900, currency: 'eur', payment_intent: 'pi_agent' },
  }));
  let entitlements = await context.persistence.getEffectiveEntitlements(session.sessionId, session.sessionSecret);
  assert.equal(entitlements.guideAccess, true);
  assert.equal(entitlements.agentRecruiterAccess, true);

  const refundedCase = await verifiedSession('ANALYZE');
  const refunded = await createCheckout(refundedCase.context, refundedCase.session, 'AGENT_RECRUITER');
  await processWebhook(refundedCase.context, stripeEvent({
    id: 'evt_refund_paid',
    type: 'checkout.session.completed',
    object: { id: refunded.sessionId, payment_status: 'paid', amount_total: 4900, currency: 'eur', payment_intent: 'pi_refund', metadata: { annunci10x_purchase_id: refunded.purchaseId } },
  }));
  assert.equal((await refundedCase.context.persistence.getEffectiveEntitlements(refundedCase.session.sessionId, refundedCase.session.sessionSecret)).agentRecruiterAccess, true);
  await processWebhook(refundedCase.context, stripeEvent({
    id: 'evt_refunded',
    type: 'charge.refunded',
    object: { id: 'ch_refunded', payment_intent: 'pi_refund' },
  }));
  assert.equal((await refundedCase.context.persistence.getPurchaseByCheckoutSessionId(refunded.sessionId)).status, 'REFUNDED');
  assert.equal((await refundedCase.context.persistence.getEffectiveEntitlements(refundedCase.session.sessionId, refundedCase.session.sessionSecret)).agentRecruiterAccess, false);

  const ignored = await processWebhook(refundedCase.context, stripeEvent({ id: 'evt_ignored', type: 'customer.created', object: { id: 'cus_ignored' } }));
  assert.equal(ignored.status, 'IGNORED');
}

async function assertMigrationAndRoutes() {
  const sql = await readFile('supabase/migrations/20260928143000_annunci10x_stripe_commerce_foundation.sql', 'utf8');
  for (const required of [
    'create table if not exists public.annunci10x_purchases',
    'create table if not exists public.annunci10x_entitlement_grants',
    'create table if not exists public.annunci10x_stripe_events',
    'annunci10x_purchases_one_pending_offer_idx',
    'annunci10x_purchases_checkout_session_uidx',
    'annunci10x_purchases_payment_intent_uidx',
    'alter table public.annunci10x_purchases enable row level security',
    'alter table public.annunci10x_entitlement_grants enable row level security',
    'alter table public.annunci10x_stripe_events enable row level security',
    'security definer',
    'set search_path = pg_catalog, public',
    'annunci10x_create_or_get_purchase',
    'annunci10x_attach_checkout_session',
    'annunci10x_claim_stripe_event',
    'annunci10x_mark_stripe_event',
    'annunci10x_complete_paid_purchase',
    'annunci10x_get_effective_entitlements',
    'grant select, insert, update on table public.annunci10x_purchases to service_role',
    'grant select, insert on table public.annunci10x_entitlement_grants to service_role',
    'grant select, insert, update on table public.annunci10x_stripe_events to service_role',
  ]) {
    assert.match(sql, new RegExp(escapeRegExp(required), 'i'), `migration missing ${required}`);
  }
  assert.doesNotMatch(sql, /payload|raw_payload|event_json|request_body/i, 'raw Stripe payload columns are forbidden');
  assert.doesNotMatch(sql, /grant\s+delete/i, 'DELETE grants are forbidden');
  assert.match(sql, /annunci10x_purchases_session_idx/i);
  assert.match(sql, /annunci10x_entitlement_grants_purchase_idx/i);
  assert.match(sql, /annunci10x_stripe_events_event_id_idx/i);

  const checkoutRoute = await readFile('src/app/api/annunci-10x/commercial/checkout/route.ts', 'utf8');
  assert.match(checkoutRoute, /payload\.offerCode/);
  assert.doesNotMatch(checkoutRoute, /amountCents|stripePriceId|successUrl|customerEmail/);
  const webhookRoute = await readFile('src/app/api/annunci-10x/commercial/stripe/webhook/route.ts', 'utf8');
  assert.match(webhookRoute, /request\.text\(\)/);
  assert.match(webhookRoute, /stripe-signature/);
  assert.match(webhookRoute, /annunci10xStripeWebhookErrorStatus/);
  assert.doesNotMatch(webhookRoute, /request\.json\(\)/);
  const contactRoute = await readFile('src/app/api/annunci-10x/contact/route.ts', 'utf8');
  assert.match(contactRoute, /session\.flow !== 'ANALYZE' && session\.flow !== 'CREATE'/);
  const commerceRuntime = await readFile('src/lib/annunci-10x/payments/commerce.ts', 'utf8');
  assert.doesNotMatch(commerceRuntime, /markPurchaseFailed\(/, 'payment_intent.payment_failed must not mark purchases FAILED');
  const stripeRuntime = await readFile('src/lib/annunci-10x/payments/stripe.ts', 'utf8');
  assert.match(stripeRuntime, /payment_method_types:\s*\['card'\]/);
}

async function verifiedSession(flow) {
  const context = makeContext();
  const created = flow === 'CREATE'
    ? await createAnonymousCreateSession(context)
    : await createAnonymousAnalyzeSession(context);
  const session = { sessionId: created.session.id, sessionSecret: created.sessionSecret };
  await saveAnnunci10xLeadContact({
    session,
    context,
    firstName: 'Ada',
    lastName: 'Lovelace',
    companyName: 'Horyzon Test',
    businessRole: 'HR',
    email: `ada.${randomUUID()}@example.com`,
    marketingConsent: false,
  });
  const lead = await context.persistence.getLead(session.sessionId, session.sessionSecret);
  await verifyWithSyntheticOtp(context, session, lead.emailNormalized);
  return { context, session, lead };
}

async function unverifiedSession() {
  const context = makeContext();
  const created = await createAnonymousAnalyzeSession(context);
  const session = { sessionId: created.session.id, sessionSecret: created.sessionSecret };
  await saveAnnunci10xLeadContact({
    session,
    context,
    firstName: 'Ada',
    lastName: 'Lovelace',
    companyName: 'Horyzon Test',
    businessRole: 'HR',
    email: `ada.${randomUUID()}@example.com`,
    marketingConsent: false,
  });
  return { context, session };
}

async function createCheckout(context, session, offerCode) {
  const gateway = new MockAnnunci10xPaymentGateway();
  const result = await createAnnunci10xCheckoutSession({
    session,
    offerCode,
    context,
    gateway,
    env: env({ checkoutEnabled: true }),
  });
  return { purchaseId: result.purchaseId, sessionId: gateway.checkoutSessions.at(-1).purchaseId ? `cs_test_${result.purchaseId.replaceAll('-', '').slice(0, 24)}` : 'missing' };
}

async function processWebhook(context, rawBody) {
  return processAnnunci10xStripeWebhook({
    rawBody,
    signature: 'mock-signature:whsec_test',
    context,
    gateway: new MockAnnunci10xPaymentGateway(),
    env: env({ checkoutEnabled: false }),
  });
}

async function verifyWithSyntheticOtp(context, session, email) {
  const lead = await context.persistence.getLead(session.sessionId, session.sessionSecret);
  const id = randomUUID();
  await context.persistence.createEmailVerification({
    id,
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    leadId: lead.id,
    emailNormalized: email,
    codeHash: hashEmailVerificationCode(process.env.ANNUNCI10X_EMAIL_VERIFICATION_PEPPER, id, email, '042019'),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    maxAttempts: 5,
    pendingGraceSeconds: 15,
  });
  await context.persistence.markEmailVerificationSent(id, session.sessionSecret);
  await verifyAnnunci10xEmailCode({ session, context, code: '042019', analysisRunId: null, requestFingerprint: 'stripe-commerce-test', env: process.env });
}

function makeContext() {
  return {
    persistence: new MemoryAnnunci10xPersistenceAdapter(),
    provider: { run: async () => { throw new Error('not used'); } },
    configuredProvider: 'MOCK',
    emailProvider: new MockAnnunci10xEmailProvider(),
  };
}

function env({ checkoutEnabled, rewritePrice = 'price_rewrite_test', agentPrice = 'price_agent_test' }) {
  return {
    NODE_ENV: 'test',
    ANNUNCI10X_CHECKOUT_ENABLED: checkoutEnabled ? '1' : '0',
    ANNUNCI10X_PUBLIC_BASE_URL: 'https://horyzon.test',
    ANNUNCI10X_STRIPE_PRICE_REWRITE: rewritePrice,
    ANNUNCI10X_STRIPE_PRICE_CREATE: 'price_create_test',
    ANNUNCI10X_STRIPE_PRICE_AGENT_RECRUITER: agentPrice,
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    STRIPE_SECRET_KEY: 'sk_test_not_used',
  };
}

function stripeEvent({ id, type, object }) {
  return JSON.stringify({ id, type, data: { object } });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
