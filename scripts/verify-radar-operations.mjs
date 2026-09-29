import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const setup = await readFile(new URL('../docs/radar/stripe-setup.md', import.meta.url), 'utf8');
const operations = await readFile(new URL('../docs/radar/operations.md', import.meta.url), 'utf8');

for (const fragment of ['RADAR_CHECKOUT_ENABLED=0', 'RADAR_PREVIEW_ENABLED=0', 'RADAR_STRIPE_PRICE_REPORT', 'RADAR_PRICE_AMOUNT_CENTS', 'checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.expired', 'payment_intent.payment_failed', 'charge.refunded']) {
  assert.ok(setup.includes(fragment), `stripe setup is missing ${fragment}`);
}
for (const fragment of ['migration', 'rollback', 'Hub', 'Website', 'READY', 'runtime']) {
  assert.ok(operations.toLowerCase().includes(fragment.toLowerCase()), `operations guide is missing ${fragment}`);
}

console.log('Paid Radar operations verifier passed');
