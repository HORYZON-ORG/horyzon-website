# Annunci 10x Stripe production setup

This document describes the future activation path for Annunci 10x checkout. The code foundation is fail-closed by default and does not require live Stripe calls while the feature flag is disabled.

## Feature flag

- `ANNUNCI10X_CHECKOUT_ENABLED=0` blocks creation of new checkout sessions.
- `ANNUNCI10X_CHECKOUT_ENABLED=1` enables checkout creation only when the session is valid and the lead email is already verified.
- Webhook reconciliation must remain active even when the feature flag is disabled, because already-issued checkout sessions can complete later.

## Environment variables

- `STRIPE_SECRET_KEY`: server-side Stripe API key for checkout session creation.
- `STRIPE_WEBHOOK_SECRET`: signing secret for the Annunci 10x webhook endpoint.
- `ANNUNCI10X_PUBLIC_BASE_URL`: canonical HTTPS base URL used for success and cancel redirects.
- `ANNUNCI10X_STRIPE_PRICE_REWRITE`: Stripe price id for `ANNUNCI10X_REWRITE`.
- `ANNUNCI10X_STRIPE_PRICE_CREATE`: Stripe price id for `ANNUNCI10X_CREATE`.
- `ANNUNCI10X_STRIPE_PRICE_AGENT_RECRUITER`: Stripe price id for `AGENT_RECRUITER`.

Do not expose Stripe secret values to the browser. Do not accept amount, currency, price id, redirect URL, customer email, or entitlement data from the browser.

## Catalog

| Offer code | Price | Capability grants |
| --- | ---: | --- |
| `ANNUNCI10X_REWRITE` | 7,00 EUR | `REWRITE_CREDIT` x1 |
| `ANNUNCI10X_CREATE` | 9,00 EUR | `CREATE_CREDIT` x1 |
| `AGENT_RECRUITER` | 49,00 EUR | `GUIDE_ACCESS` x1, `AGENT_RECRUITER_ACCESS` x1 |

## Product and price mapping

Create one Stripe product or a product group that can host these recurring catalog entries as one-time payment prices. Store only the resulting Price IDs in the environment variables above. The application resolves the price server-side from the offer code.

## Webhook endpoint

- Endpoint: `/api/annunci-10x/commercial/stripe/webhook`
- Runtime: Node.js
- Body handling: raw `request.text()` before signature verification
- Required header: `stripe-signature`

Supported event types:

- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.payment_failed`
- `charge.refunded`

Unsupported events are acknowledged and ignored.

## Activation order

1. Apply the Supabase migration.
2. Verify RLS, RPC grants, constraints, and indexes.
3. Create Stripe products and one-time prices.
4. Configure the three Annunci 10x Stripe price IDs.
5. Configure `STRIPE_SECRET_KEY`.
6. Create the Stripe webhook endpoint.
7. Configure `STRIPE_WEBHOOK_SECRET`.
8. Keep `ANNUNCI10X_CHECKOUT_ENABLED=0`.
9. Deploy.
10. Execute a controlled canary.
11. Set `ANNUNCI10X_CHECKOUT_ENABLED=1`.
12. Run a real test purchase.
13. Verify purchase state, grants, and effective entitlements.
14. Mark activation GO only after reconciliation is verified.

## Canary

Use a low-risk internal session with a verified test email. Confirm that checkout creation uses the expected Stripe price, that `checkout.session.completed` marks the purchase `PAID`, and that the entitlement RPC returns only the expected effective grants.

## Rollback

Set `ANNUNCI10X_CHECKOUT_ENABLED=0`.

This blocks new checkout sessions. Continue accepting webhook events for already-issued checkout sessions. Do not delete purchases, entitlement grants, or Stripe event rows during rollback.
