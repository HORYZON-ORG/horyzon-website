import assert from 'node:assert/strict';
import {
  ANNUNCI10X_COMMERCIAL_VERSION,
  buildAnnunci10xOffers,
  createTestEntitlementProvider,
  getAnnunci10xOfferCatalog,
  getAnnunci10xProductCatalog,
  isVerifiedCommercialSessionClaim,
  resolveAnnunci10xCommercial,
  sanitizeCommercialClientPayload,
} from '../src/lib/annunci-10x/index.ts';

const subject = { kind: 'SESSION', sessionId: 'session-test-commercial' };
const none = {
  guide: false,
  adGenerationCredits: 0,
  rewriteCredits: 0,
  createCredits: 0,
  agentRecruiterAccess: false,
  source: 'NO_TRUSTED_SOURCE',
  verification: 'SERVER_VERIFIED',
  checkedAt: '2026-09-23T00:00:00.000Z',
};
const agentOwner = { ...none, guide: true, agentRecruiterAccess: true, source: 'PURCHASE' };

const legacyCatalog = getAnnunci10xProductCatalog();
assert.deepEqual(legacyCatalog.map((item) => item.productCode), ['GUIDE', 'AD_GENERATION', 'GUIDE_PLUS_AD']);
for (const item of legacyCatalog) {
  assert.equal(item.status, 'COMING_SOON');
  assert.equal(item.pricingStatus, 'OPEN_DECISION');
  assert.equal(item.purchaseEnabled, false);
}

const offerCatalog = getAnnunci10xOfferCatalog();
assert.deepEqual(offerCatalog.map((item) => item.offerCode), ['ANNUNCI10X_REWRITE', 'ANNUNCI10X_CREATE', 'AGENT_RECRUITER']);
assert.deepEqual(offerCatalog.map((item) => item.price.amountCents), [700, 900, 4900]);
assert.ok(offerCatalog.every((item) => item.price.currency === 'EUR'));
assert.deepEqual(offerCatalog.find((item) => item.offerCode === 'AGENT_RECRUITER').capabilities.map((item) => item.capability), ['GUIDE_ACCESS', 'AGENT_RECRUITER_ACCESS']);

assert.deepEqual(
  buildAnnunci10xOffers({ subject, entitlements: none, flow: 'ANALYZE', journeyState: 'PRODUCT_PAGE', checkoutEnabled: false, identityVerified: true }).map((offer) => [offer.offerCode, offer.purchaseEnabled, offer.reasonUnavailable]),
  [
    ['ANNUNCI10X_REWRITE', false, 'PURCHASE_DISABLED'],
    ['AGENT_RECRUITER', false, 'PURCHASE_DISABLED'],
  ],
);
assert.deepEqual(
  buildAnnunci10xOffers({ subject, entitlements: none, flow: 'ANALYZE', journeyState: 'PRODUCT_PAGE', checkoutEnabled: true, identityVerified: true }).map((offer) => [offer.offerCode, offer.purchaseEnabled]),
  [
    ['ANNUNCI10X_REWRITE', true],
    ['AGENT_RECRUITER', true],
  ],
);
assert.deepEqual(
  buildAnnunci10xOffers({ subject, entitlements: none, flow: 'CREATE', journeyState: 'COLLECTING', checkoutEnabled: true, identityVerified: true }).map((offer) => offer.offerCode),
  ['ANNUNCI10X_CREATE', 'AGENT_RECRUITER'],
);
assert.deepEqual(
  buildAnnunci10xOffers({ subject, entitlements: agentOwner, flow: 'ANALYZE', journeyState: 'PRODUCT_PAGE', checkoutEnabled: true, identityVerified: true }).find((offer) => offer.offerCode === 'AGENT_RECRUITER').reasonUnavailable,
  'ALREADY_ENTITLED',
);

const noEntitlementProvider = createTestEntitlementProvider();
assert.equal((await noEntitlementProvider.get(subject)).rewriteCredits, 0);
const creditProvider = createTestEntitlementProvider({ adGenerationCredits: 1 });
assert.equal((await creditProvider.consumeAdGenerationCredit({ subject, sessionId: subject.sessionId })).adGenerationCredits, 0);
await assert.rejects(
  () => creditProvider.consumeAdGenerationCredit({ subject, sessionId: subject.sessionId }),
  /No Annunci 10x ad-generation credit/,
);

const maliciousPayload = { guide: true, adGenerationCredits: 100, paid: true, price: 0, discount: 100 };
assert.deepEqual(sanitizeCommercialClientPayload(maliciousPayload), {}, 'client commercial payload is ignored');
const resolved = await resolveAnnunci10xCommercial({
  subject,
  flow: 'ANALYZE',
  journeyState: 'PRODUCT_PAGE',
  checkoutEnabled: false,
  identityVerified: false,
});
assert.equal(resolved.version, ANNUNCI10X_COMMERCIAL_VERSION);
assert.equal(resolved.checkoutEnabled, false);
assert.equal(resolved.pricingStatus, 'FIXED');
assert.equal(resolved.availableOffers[0].price.amountCents, 700);
assert.equal(resolved.availableOffers[0].purchaseEnabled, false);

assert.equal(isVerifiedCommercialSessionClaim(undefined, undefined), true);
assert.equal(isVerifiedCommercialSessionClaim('session-a', 'session-a'), true);
assert.equal(isVerifiedCommercialSessionClaim('session-a', undefined), false);
assert.equal(isVerifiedCommercialSessionClaim('session-a', 'session-b'), false);

console.log('Annunci 10x commercial verifier passed');
