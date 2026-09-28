"use client";

export type PremiumFulfillmentState = 'NONE' | 'PAYMENT_CONFIRMED' | 'READY_TO_GENERATE' | 'PREPARING' | 'READY' | 'NEEDS_REVIEW';
export type PremiumFulfillmentFlow = 'ANALYZE' | 'CREATE' | null;
export type PremiumSection = { id: string; title: string; body: string };
export type PremiumChannelVariant = { channel: string; sections: PremiumSection[] } | null;
export type PremiumCheckoutNotice = 'success' | 'cancelled' | null;

export const PAYMENT_VERIFY_POLL_MS = 1500;
export const MAX_PAYMENT_VERIFY_ATTEMPTS = 12;
export const PAYMENT_VERIFY_TIMEOUT_MESSAGE = 'Stiamo ancora verificando il pagamento. Puoi aggiornare lo stato tra qualche secondo.';

export interface PremiumFulfillmentStatus {
  flow: PremiumFulfillmentFlow;
  state: PremiumFulfillmentState;
  canGenerate: boolean;
  outputAvailable: boolean;
}

export interface PremiumOutput {
  outputId: string;
  sessionId: string;
  snapshotId: string;
  master: { sections: PremiumSection[] };
  channelVariant: PremiumChannelVariant;
  validationState: 'READY' | 'READY_WITH_WARNINGS' | 'NEEDS_VERIFICATION' | 'BLOCKED';
  checklist: string[];
  rationale: string[];
}

export function shouldPollAnnunci10xPaymentVerification(checkoutNotice: PremiumCheckoutNotice, state: PremiumFulfillmentState | null | undefined): boolean {
  return checkoutNotice === 'success' && state === 'NONE';
}

export function isAnnunci10xPaymentVerificationStopState(state: PremiumFulfillmentState): boolean {
  return state === 'PAYMENT_CONFIRMED' || state === 'READY_TO_GENERATE' || state === 'PREPARING' || state === 'READY' || state === 'NEEDS_REVIEW';
}

export function shouldReturnToAnnunci10xCreate(checkoutNotice: PremiumCheckoutNotice, flow: PremiumFulfillmentFlow): boolean {
  return (checkoutNotice === 'success' || checkoutNotice === 'cancelled') && flow === 'CREATE';
}

export async function fetchAnnunci10xFulfillmentStatus(): Promise<PremiumFulfillmentStatus> {
  const response = await fetch('/api/annunci-10x/premium/status', { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.error?.code ?? payload.error?.message ?? 'FULFILLMENT_STATUS_UNAVAILABLE');
  return payload.fulfillment;
}

export async function fetchAnnunci10xPremiumOutput(): Promise<PremiumOutput | null> {
  const response = await fetch('/api/annunci-10x/premium/output', { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.error?.code ?? payload.error?.message ?? 'PREMIUM_OUTPUT_UNAVAILABLE');
  return payload.result;
}

export async function generateAnnunci10xPremiumOutput(input: { channel?: string } = {}): Promise<PremiumOutput> {
  const body = typeof input.channel === 'string' && input.channel.trim() ? { channel: input.channel } : {};
  const response = await fetch('/api/annunci-10x/premium/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    const error = new Error(payload.error?.message ?? payload.error?.code ?? 'PREMIUM_GENERATION_UNAVAILABLE') as Error & { code?: string };
    error.code = payload.error?.code;
    throw error;
  }
  return payload.result;
}
