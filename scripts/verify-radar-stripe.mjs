import assert from 'node:assert/strict';
import { createMemoryRadarCommerce, handleRadarStripeEvent, resolveRadarCatalog, RadarCheckoutError } from '../src/lib/radar/payments/commerce.ts';
import { radarCheckoutIdempotencyKey } from '../src/lib/radar/payments/stripe.ts';

assert.throws(() => resolveRadarCatalog({ RADAR_CHECKOUT_ENABLED: '0' }), RadarCheckoutError);
assert.throws(() => resolveRadarCatalog({ RADAR_CHECKOUT_ENABLED: '1', RADAR_STRIPE_PRICE_REPORT: 'price_test', RADAR_PRICE_AMOUNT_CENTS: '0', RADAR_PUBLIC_BASE_URL: 'https://horyzon.it' }), RadarCheckoutError);
assert.deepEqual(resolveRadarCatalog({ RADAR_CHECKOUT_ENABLED: '1', RADAR_STRIPE_PRICE_REPORT: 'price_test', RADAR_PRICE_AMOUNT_CENTS: '7900', RADAR_PUBLIC_BASE_URL: 'https://horyzon.it' }), { offerCode: 'RADAR_IMPRESA_REPORT', capability: 'RADAR_RESULT_ACCESS', priceId: 'price_test', amountCents: 7900, currency: 'EUR', baseUrl: 'https://horyzon.it' });
assert.equal(radarCheckoutIdempotencyKey('purchase-1'), 'radar-checkout/purchase-1');

const store = createMemoryRadarCommerce();
store.addPurchase({ id: 'purchase-1', assessmentId: 'assessment-1', checkoutSessionId: 'cs_1', status: 'PENDING' });
const paidEvent = { id: 'evt_paid', type: 'checkout.session.completed', object: { id: 'cs_1', payment_status: 'paid', payment_intent: 'pi_1', customer: 'cus_1' } };
assert.deepEqual(await handleRadarStripeEvent(store, paidEvent), { processed: true, grantsCreated: 1 });
assert.deepEqual(await handleRadarStripeEvent(store, paidEvent), { processed: false, grantsCreated: 0 });
assert.equal(store.hasAccess('assessment-1'), true);
await handleRadarStripeEvent(store, { id: 'evt_refund', type: 'charge.refunded', object: { payment_intent: 'pi_1' } });
assert.equal(store.hasAccess('assessment-1'), false);

console.log('Paid Radar Stripe verifier passed');
