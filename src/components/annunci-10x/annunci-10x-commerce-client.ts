"use client";

export type Annunci10xOfferCode = 'ANNUNCI10X_REWRITE' | 'ANNUNCI10X_CREATE' | 'AGENT_RECRUITER';
export type Annunci10xEntitlementCapability = 'REWRITE_CREDIT' | 'CREATE_CREDIT' | 'GUIDE_ACCESS' | 'AGENT_RECRUITER_ACCESS';
export type Annunci10xUnavailableReason = 'PURCHASE_DISABLED' | 'EMAIL_NOT_VERIFIED' | 'FLOW_NOT_APPLICABLE' | 'ALREADY_ENTITLED';

export interface Annunci10xCommercialOffer {
  id: string;
  offerCode: Annunci10xOfferCode;
  displayName: string;
  description: string;
  price: {
    amountCents: number;
    currency: 'EUR';
    display: string;
  };
  capabilities: Array<{ capability: Annunci10xEntitlementCapability; quantity: number }>;
  eligibility: 'AVAILABLE' | 'UNAVAILABLE';
  purchaseEnabled: boolean;
  reasonUnavailable?: Annunci10xUnavailableReason;
}

export interface Annunci10xCommercialState {
  version: 'annunci10x-commercial-v3';
  availableOffers: Annunci10xCommercialOffer[];
  checkoutEnabled: boolean;
  pricingStatus: 'FIXED';
  entitlements?: {
    guide: boolean;
    rewriteCredits: number;
    createCredits: number;
    agentRecruiterAccess: boolean;
    source: string;
  };
}

export async function fetchAnnunci10xCommercialOffers(): Promise<Annunci10xCommercialState> {
  const response = await fetch('/api/annunci-10x/commercial/offers', { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.error?.code ?? payload.error?.message ?? 'CHECKOUT_UNAVAILABLE');
  return payload.commercial;
}

export async function startAnnunci10xCheckout(offerCode: Annunci10xOfferCode): Promise<void> {
  const response = await fetch('/api/annunci-10x/commercial/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ offerCode }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok || typeof payload.checkoutUrl !== 'string') {
    throw new Error(payload.error?.code ?? payload.error?.message ?? 'PAYMENT_INVALID');
  }
  window.location.assign(payload.checkoutUrl);
}

export function offerPriceLabel(offer: Annunci10xCommercialOffer): string {
  const amount = offer.price.amountCents / 100;
  return `${Number.isInteger(amount) ? amount : amount.toFixed(2).replace('.', ',')} €`;
}

export function checkoutCtaLabel(offer: Annunci10xCommercialOffer): string {
  if (!offer.purchaseEnabled) return unavailableCtaLabel(offer.reasonUnavailable);
  if (offer.offerCode === 'ANNUNCI10X_REWRITE' || offer.offerCode === 'ANNUNCI10X_CREATE') return 'Paga 7 € e genera il mio annuncio';
  return `Ottieni Guida + Agent Recruiter — ${offerPriceLabel(offer)}`;
}

export function unavailableCtaLabel(reason?: Annunci10xUnavailableReason): string {
  if (reason === 'ALREADY_ENTITLED') return 'Già acquistato';
  if (reason === 'EMAIL_NOT_VERIFIED') return 'Verifica prima la tua email';
  if (reason === 'PURCHASE_DISABLED') return 'Disponibile a breve';
  return 'Pagamento temporaneamente non disponibile';
}

export function customerSafeCheckoutError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : '';
  if (/CHECKOUT_DISABLED|PURCHASE_DISABLED/i.test(message)) return 'Disponibile a breve';
  if (/CHECKOUT_UNAVAILABLE|PAYMENT_UNAVAILABLE/i.test(message)) return 'Pagamento temporaneamente non disponibile';
  if (/EMAIL_VERIFICATION_REQUIRED|EMAIL_NOT_VERIFIED/i.test(message)) return 'Verifica prima la tua email';
  if (/PAYMENT_INVALID|INVALID_INPUT/i.test(message)) return 'Non siamo riusciti ad aprire il pagamento';
  return 'Pagamento temporaneamente non disponibile';
}
