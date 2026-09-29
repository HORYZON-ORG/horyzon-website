import { NextResponse } from 'next/server';
import { createRadarCommerce, resolveRadarCatalog, StripeRadarGateway } from '@/lib/radar';
import { createService, errorResponse, getSessionCookie } from '../_shared';

export async function POST() {
  try {
    const session = await getSessionCookie();
    const assessment = await createService().resumeAssessment(session.assessmentId, session.ownerSecret);
    if (assessment.answeredCount < 30 || assessment.status !== 'PAYMENT_REQUIRED') return NextResponse.json({ ok: false, error: { message: 'Completa il Radar prima del pagamento.' } }, { status: 409 });
    const catalog = resolveRadarCatalog();
    const commerce = createRadarCommerce();
    const purchase = await commerce.createPurchase({ assessmentId: session.assessmentId, priceId: catalog.priceId, amountCents: catalog.amountCents });
    const customerEmail = await commerce.getCustomerEmail(session.assessmentId);
    const gateway = new StripeRadarGateway(process.env.STRIPE_SECRET_KEY?.trim() ?? '');
    const checkout = await gateway.createCheckout({ purchaseId: purchase.id, priceId: catalog.priceId, customerEmail, successUrl: `${catalog.baseUrl}/radar?checkout=success#radar-prodotto`, cancelUrl: `${catalog.baseUrl}/radar?checkout=cancel#radar-prodotto` });
    await commerce.attachCheckout(purchase.id, checkout.id);
    return NextResponse.json({ ok: true, checkoutUrl: checkout.url });
  } catch (error) { return errorResponse(error); }
}
