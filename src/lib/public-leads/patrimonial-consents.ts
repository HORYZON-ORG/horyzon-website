import { PATRIMONIAL_PILOT_MARKETING_VERSION, PATRIMONIAL_PILOT_PRIVACY_VERSION } from '../../content/patrimonial-funnels.ts';
import type { PatrimonialConsentEvidence, PatrimonialRequest } from './patrimonial-contract.ts';

export function patrimonialConsentEvidence(request: PatrimonialRequest): PatrimonialConsentEvidence[] {
  const common = {
    requestId: request.id, sourcePath: request.payload.sourcePath, receivedAt: request.receivedAt,
    mode: request.payload.mode, channel: 'form' as const, policyPath: '/privacy-policy' as const,
  };
  return [
    { ...common, id: `${request.id}:requested-contact`, purpose: 'requested-contact', choice: true, version: PATRIMONIAL_PILOT_PRIVACY_VERSION },
    // A false snapshot is NOT a withdrawal of an earlier effective grant.
    { ...common, id: `${request.id}:marketing`, purpose: 'marketing', choice: request.payload.marketingConsent, version: PATRIMONIAL_PILOT_MARKETING_VERSION },
  ];
}
