import { NextRequest, NextResponse } from 'next/server';
import {
  Annunci10xPublicError,
  MockAnnunci10xPaymentGateway,
  createAnnunci10xCheckoutSession,
  processAnnunci10xStripeWebhook,
} from '@/lib/annunci-10x';
import { createContext, getSessionCookie, toErrorResponse } from '../../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const E2E_TOKEN = 'annunci10x-e2e-20261003';
const TEST_EMAIL = 'delivered@resend.dev';

export async function POST(request: NextRequest) {
  try {
    if (process.env.VERCEL_ENV !== 'preview') {
      return new NextResponse(null, { status: 404 });
    }
    if (request.headers.get('x-annunci10x-e2e-token') !== E2E_TOKEN) {
      return new NextResponse(null, { status: 404 });
    }

    const cookie = await getSessionCookie();
    if (!cookie) throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione Annunci 10x assente.', 401);

    const context = createContext();
    const session = await context.persistence.getSession(cookie.sessionId, cookie.sessionSecret);
    if (!session || session.flow !== 'CREATE') {
      throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione CREATE non valida.', 409);
    }

    const lead = await context.persistence.getLead(cookie.sessionId, cookie.sessionSecret);
    if (!lead?.emailVerifiedAt || lead.emailNormalized !== TEST_EMAIL) {
      throw new Annunci10xPublicError('EMAIL_VERIFICATION_REQUIRED', 'Harness E2E disponibile solo per il destinatario test verificato.', 403);
    }

    const gateway = new MockAnnunci10xPaymentGateway();
    const webhookSecret = 'annunci10x-preview-e2e-secret';
    const env = {
      ...process.env,
      ANNUNCI10X_CHECKOUT_ENABLED: '1',
      ANNUNCI10X_STRIPE_PRICE_CREATE: 'price_test_annunci10x_create',
      ANNUNCI10X_PUBLIC_BASE_URL: request.nextUrl.origin,
      STRIPE_WEBHOOK_SECRET: webhookSecret,
    };

    const checkout = await createAnnunci10xCheckoutSession({
      session: cookie,
      offerCode: 'ANNUNCI10X_CREATE',
      context,
      gateway,
      env,
    });

    const checkoutSessionId = `cs_test_${checkout.purchaseId.replaceAll('-', '').slice(0, 24)}`;
    const event = {
      id: `evt_test_${checkout.purchaseId.replaceAll('-', '').slice(0, 24)}`,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: checkoutSessionId,
          payment_status: 'paid',
          amount_total: 700,
          currency: 'eur',
          payment_intent: `pi_test_${checkout.purchaseId.replaceAll('-', '').slice(0, 24)}`,
          customer: 'cus_test_annunci10x_e2e',
          metadata: { annunci10x_purchase_id: checkout.purchaseId },
        },
      },
    };

    const reconciliation = await processAnnunci10xStripeWebhook({
      rawBody: JSON.stringify(event),
      signature: `mock-signature:${webhookSecret}`,
      context,
      gateway,
      env,
    });

    const entitlements = await context.persistence.getEffectiveEntitlements(cookie.sessionId, cookie.sessionSecret);

    return NextResponse.json({
      ok: true,
      result: {
        purchaseId: checkout.purchaseId,
        offerCode: checkout.offerCode,
        mockCheckoutUrl: checkout.checkoutUrl,
        reconciliation,
        createCredits: entitlements.createCredits,
        successUrl: `${request.nextUrl.origin}/annunci-10x?checkout=success`,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
