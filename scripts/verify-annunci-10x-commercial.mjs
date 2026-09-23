import assert from 'node:assert/strict';
import {
  buildAnnunci10xOffers,
  createTestEntitlementProvider,
  getAnnunci10xProductCatalog,
  isVerifiedCommercialSessionClaim,
  resolveAnnunci10xCommercial,
  sanitizeCommercialClientPayload,
} from '../src/lib/annunci-10x/index.ts';

const subject = { kind: 'SESSION', sessionId: 'session-test-commercial' };
const none = {
  guide: false,
  adGenerationCredits: 0,
  source: 'NO_TRUSTED_SOURCE',
  verification: 'SERVER_VERIFIED',
  checkedAt: '2026-09-23T00:00:00.000Z',
};
const guideOwner = { ...none, guide: true, source: 'PURCHASE' };
const creditOwner = { ...none, adGenerationCredits: 2, source: 'PURCHASE' };

const catalog = getAnnunci10xProductCatalog();
assert.deepEqual(catalog.map((item) => item.productCode), ['GUIDE', 'AD_GENERATION', 'GUIDE_PLUS_AD']);
for (const item of catalog) {
  assert.equal(item.status, 'COMING_SOON');
  assert.equal(item.pricingStatus, 'OPEN_DECISION');
  assert.equal(item.purchaseEnabled, false);
  assert.equal('price' in item, false, 'catalog must not expose numeric prices or zero-price semantics');
}

assert.deepEqual(
  buildAnnunci10xOffers({ subject, entitlements: none, flow: 'ANALYZE', journeyState: 'PRODUCT_PAGE' }).map((offer) => offer.productCode),
  ['GUIDE', 'AD_GENERATION', 'GUIDE_PLUS_AD'],
  'ANALYZE without guide shows guide, ad generation and bundle',
);
assert.deepEqual(
  buildAnnunci10xOffers({ subject, entitlements: guideOwner, flow: 'ANALYZE', journeyState: 'PRODUCT_PAGE' }).map((offer) => [offer.productCode, offer.discountReason]),
  [['AD_GENERATION', 'GUIDE_OWNER']],
  'ANALYZE with guide avoids guide and bundle repurchase',
);
assert.deepEqual(
  buildAnnunci10xOffers({ subject, entitlements: none, flow: 'CREATE', journeyState: 'PAYMENT_REQUIRED' }).map((offer) => offer.productCode),
  ['AD_GENERATION', 'GUIDE_PLUS_AD'],
  'CREATE payment required without guide shows ad generation and bundle',
);
assert.deepEqual(
  buildAnnunci10xOffers({ subject, entitlements: guideOwner, flow: 'CREATE', journeyState: 'PAYMENT_REQUIRED' }).map((offer) => [offer.productCode, offer.discountReason]),
  [['AD_GENERATION', 'GUIDE_OWNER']],
  'CREATE payment required with guide shows ad generation owner condition',
);
assert.deepEqual(
  buildAnnunci10xOffers({ subject, entitlements: none, flow: 'CREATE', journeyState: 'COLLECTING' }),
  [],
  'CREATE collecting has no early ad generation paywall',
);
assert.deepEqual(
  buildAnnunci10xOffers({ subject, entitlements: creditOwner, flow: 'CREATE', journeyState: 'COLLECTING' }),
  [],
  'existing credits still do not create an early paywall during collection',
);

for (const offer of buildAnnunci10xOffers({ subject, entitlements: none, flow: 'ANALYZE', journeyState: 'PRODUCT_PAGE' })) {
  assert.equal(offer.pricingStatus, 'OPEN_DECISION');
  assert.equal(offer.purchaseEnabled, false);
  assert.equal(offer.reasonUnavailable, 'PURCHASE_DISABLED');
  assert.equal(JSON.stringify(offer).includes('"price":0'), false);
}

const noEntitlementProvider = createTestEntitlementProvider();
assert.deepEqual(await noEntitlementProvider.get(subject), {
  guide: false,
  adGenerationCredits: 0,
  source: 'TEST',
  verification: 'SERVER_VERIFIED',
  checkedAt: (await noEntitlementProvider.get(subject)).checkedAt,
});

const guideProvider = createTestEntitlementProvider({ guide: true });
assert.equal((await guideProvider.get(subject)).guide, true);

const creditProvider = createTestEntitlementProvider({ adGenerationCredits: 1 });
assert.equal((await creditProvider.consumeAdGenerationCredit({ subject, sessionId: subject.sessionId })).adGenerationCredits, 0);
await assert.rejects(
  () => creditProvider.consumeAdGenerationCredit({ subject, sessionId: subject.sessionId }),
  /No Annunci 10x ad-generation credit/,
);

const bundleProvider = createTestEntitlementProvider();
const bundleEntitlements = await bundleProvider.grant({ subject, productCode: 'GUIDE_PLUS_AD', reason: 'TEST' });
assert.equal(bundleEntitlements.guide, true);
assert.equal(bundleEntitlements.adGenerationCredits, 1);

const maliciousPayload = { guide: true, adGenerationCredits: 100, paid: true, price: 0, discount: 100 };
assert.deepEqual(sanitizeCommercialClientPayload(maliciousPayload), {}, 'client commercial payload is ignored');
const resolved = await resolveAnnunci10xCommercial({
  subject,
  flow: 'ANALYZE',
  journeyState: 'PRODUCT_PAGE',
});
assert.equal(resolved.entitlements.guide, false);
assert.equal(resolved.entitlements.adGenerationCredits, 0);
assert.equal(resolved.checkoutEnabled, false);

assert.equal(isVerifiedCommercialSessionClaim(undefined, undefined), true);
assert.equal(isVerifiedCommercialSessionClaim('session-a', 'session-a'), true);
assert.equal(isVerifiedCommercialSessionClaim('session-a', undefined), false);
assert.equal(isVerifiedCommercialSessionClaim('session-a', 'session-b'), false);

console.log('Annunci 10x commercial verifier passed');
