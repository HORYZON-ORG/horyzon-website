"use client";

export type PremiumFulfillmentState = 'NONE' | 'READY_TO_GENERATE' | 'PREPARING' | 'READY' | 'NEEDS_REVIEW';
export type PremiumFulfillmentFlow = 'ANALYZE' | 'CREATE' | null;
export type PremiumSection = { id: string; title: string; body: string };
export type PremiumChannelVariant = { channel: string; sections: PremiumSection[] } | null;
export const ANNUNCI10X_FULFILLMENT_REFRESH_EVENT = 'annunci10x:fulfillment-refresh';
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
  clientRevisionCount: number;
  clientRevisionLimit: number;
}

export interface PremiumEditResult {
  status:
    | 'EDITORIAL_REVISED'
    | 'REQUIRES_REGENERATION'
    | 'CONFIRMATION_REQUIRED'
    | 'REVISION_APPLIED'
    | 'REVISION_BLOCKED'
    | 'REVISION_LIMIT_REACHED';
  reason: string;
  affectedPaths: string[];
  revisionCount?: number;
  revisionLimit?: number;
  output?: PremiumOutput;
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


export async function requestAnnunci10xPremiumEdit(input: { editRequest: string; targetSectionId: string }): Promise<PremiumEditResult> {
  const response = await fetch('/api/annunci-10x/premium/edit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ editRequest: input.editRequest, targetPath: input.targetSectionId }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    const error = new Error(payload.error?.message ?? payload.error?.code ?? 'PREMIUM_EDIT_UNAVAILABLE') as Error & { code?: string };
    error.code = payload.error?.code;
    throw error;
  }
  return payload.result;
}
