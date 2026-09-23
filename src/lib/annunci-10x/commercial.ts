import type { ProductCode, SessionState } from './types.ts';

export const ANNUNCI10X_COMMERCIAL_VERSION = 'annunci10x-commercial-v1';

export const ANNUNCI10X_PRODUCT_CATALOG: readonly Annunci10xProductCatalogItem[] = [
  {
    productCode: 'GUIDE',
    displayName: 'Guida Annunci 10x',
    description: 'Metodo operativo Annunci 10x per leggere, correggere e progettare annunci migliori.',
    includedCapabilities: ['GUIDE_ACCESS'],
    status: 'COMING_SOON',
    pricingStatus: 'OPEN_DECISION',
    purchaseEnabled: false,
  },
  {
    productCode: 'AD_GENERATION',
    displayName: 'Generazione annuncio',
    description: 'Creazione dell annuncio finale a partire da una RoleCard confermata.',
    includedCapabilities: ['AD_GENERATION_CREDIT'],
    status: 'COMING_SOON',
    pricingStatus: 'OPEN_DECISION',
    purchaseEnabled: false,
  },
  {
    productCode: 'GUIDE_PLUS_AD',
    displayName: 'Guida + generazione',
    description: 'Bundle commerciale previsto per guida e credito di generazione annuncio.',
    includedCapabilities: ['GUIDE_ACCESS', 'AD_GENERATION_CREDIT'],
    status: 'COMING_SOON',
    pricingStatus: 'OPEN_DECISION',
    purchaseEnabled: false,
  },
] as const;

export type Annunci10xProductStatus = 'COMING_SOON';
export type Annunci10xPricingStatus = 'OPEN_DECISION';
export type Annunci10xCommercialFlow = 'ANALYZE' | 'CREATE';
export type Annunci10xCommercialSubjectKind = 'ACCOUNT' | 'EMAIL_VERIFIED' | 'PAYMENT_CUSTOMER' | 'SESSION' | 'ANONYMOUS';
export type Annunci10xCommercialDiscountReason = 'NONE' | 'GUIDE_OWNER' | 'BUNDLE';
export type Annunci10xCommercialEligibility = 'AVAILABLE' | 'UNAVAILABLE';
export type Annunci10xCommercialUnavailableReason = 'PURCHASE_DISABLED' | 'ALREADY_ENTITLED';
export type Annunci10xEntitlementSource = 'NO_TRUSTED_SOURCE' | 'PURCHASE' | 'BUNDLE' | 'ADMIN' | 'TEST';

export interface Annunci10xProductCatalogItem {
  productCode: ProductCode;
  displayName: string;
  description: string;
  includedCapabilities: readonly ('GUIDE_ACCESS' | 'AD_GENERATION_CREDIT')[];
  status: Annunci10xProductStatus;
  pricingStatus: Annunci10xPricingStatus;
  purchaseEnabled: false;
}

export interface Annunci10xCommercialSubject {
  kind: Annunci10xCommercialSubjectKind;
  id?: string;
  sessionId?: string;
}

export interface Annunci10xCommercialEntitlements {
  guide: boolean;
  adGenerationCredits: number;
  source: Annunci10xEntitlementSource;
  verification: 'SERVER_VERIFIED';
  checkedAt: string;
}

export interface Annunci10xEntitlementProvider {
  get(subject: Annunci10xCommercialSubject): Promise<Annunci10xCommercialEntitlements>;
  grant(input: {
    subject: Annunci10xCommercialSubject;
    productCode: ProductCode;
    reason: 'PURCHASE' | 'ADMIN' | 'TEST';
  }): Promise<Annunci10xCommercialEntitlements>;
  consumeAdGenerationCredit(input: {
    subject: Annunci10xCommercialSubject;
    sessionId: string;
  }): Promise<Annunci10xCommercialEntitlements>;
}

export interface Annunci10xOfferEngineInput {
  subject: Annunci10xCommercialSubject;
  entitlements: Annunci10xCommercialEntitlements;
  flow: Annunci10xCommercialFlow;
  journeyState: SessionState | 'PRODUCT_PAGE';
}

export interface Annunci10xCommercialOffer {
  id: string;
  productCode: ProductCode;
  displayName: string;
  description: string;
  includedCapabilities: readonly ('GUIDE_ACCESS' | 'AD_GENERATION_CREDIT')[];
  eligibility: Annunci10xCommercialEligibility;
  pricingStatus: Annunci10xPricingStatus;
  discountReason: Annunci10xCommercialDiscountReason;
  purchaseEnabled: false;
  reasonUnavailable: Annunci10xCommercialUnavailableReason;
}

export interface Annunci10xCommercialState {
  version: typeof ANNUNCI10X_COMMERCIAL_VERSION;
  subject: Annunci10xCommercialSubject;
  entitlements: Annunci10xCommercialEntitlements;
  availableOffers: Annunci10xCommercialOffer[];
  checkoutEnabled: false;
  pricingStatus: Annunci10xPricingStatus;
}

export interface ResolveAnnunci10xCommercialInput {
  subject?: Annunci10xCommercialSubject;
  flow: Annunci10xCommercialFlow;
  journeyState: SessionState | 'PRODUCT_PAGE';
  entitlementProvider?: Annunci10xEntitlementProvider;
}

export function getAnnunci10xProductCatalog(): Annunci10xProductCatalogItem[] {
  return ANNUNCI10X_PRODUCT_CATALOG.map((item) => ({ ...item, includedCapabilities: [...item.includedCapabilities] }));
}

export function getAnnunci10xCatalogItem(productCode: ProductCode): Annunci10xProductCatalogItem {
  const item = ANNUNCI10X_PRODUCT_CATALOG.find((catalogItem) => catalogItem.productCode === productCode);
  if (!item) throw new Error(`Unknown Annunci 10x product: ${productCode}`);
  return { ...item, includedCapabilities: [...item.includedCapabilities] };
}

export async function resolveAnnunci10xCommercial(input: ResolveAnnunci10xCommercialInput): Promise<Annunci10xCommercialState> {
  const subject = input.subject ?? { kind: 'ANONYMOUS' };
  const provider = input.entitlementProvider ?? createOpenDecisionEntitlementProvider();
  const entitlements = await provider.get(subject);
  return {
    version: ANNUNCI10X_COMMERCIAL_VERSION,
    subject,
    entitlements: normalizeEntitlements(entitlements),
    availableOffers: buildAnnunci10xOffers({
      subject,
      entitlements: normalizeEntitlements(entitlements),
      flow: input.flow,
      journeyState: input.journeyState,
    }),
    checkoutEnabled: false,
    pricingStatus: 'OPEN_DECISION',
  };
}

export function buildAnnunci10xOffers(input: Annunci10xOfferEngineInput): Annunci10xCommercialOffer[] {
  if (input.flow === 'CREATE' && input.journeyState === 'COLLECTING') return [];

  const ownsGuide = input.entitlements.guide;
  if (input.flow === 'ANALYZE') {
    return ownsGuide
      ? [offerFor('AD_GENERATION', 'GUIDE_OWNER')]
      : [offerFor('GUIDE', 'NONE'), offerFor('AD_GENERATION', 'NONE'), offerFor('GUIDE_PLUS_AD', 'BUNDLE')];
  }

  if (input.flow === 'CREATE' && input.journeyState === 'PAYMENT_REQUIRED') {
    return ownsGuide
      ? [offerFor('AD_GENERATION', 'GUIDE_OWNER')]
      : [offerFor('AD_GENERATION', 'NONE'), offerFor('GUIDE_PLUS_AD', 'BUNDLE')];
  }

  return [];
}

export function createOpenDecisionEntitlementProvider(): Annunci10xEntitlementProvider {
  return {
    async get() {
      return noneEntitled('NO_TRUSTED_SOURCE');
    },
    async grant() {
      throw new Error('Annunci 10x commercial grant is not public before payment implementation.');
    },
    async consumeAdGenerationCredit() {
      throw new Error('Annunci 10x ad-generation credits cannot be consumed before entitlement implementation.');
    },
  };
}

export function createTestEntitlementProvider(seed: Partial<Pick<Annunci10xCommercialEntitlements, 'guide' | 'adGenerationCredits' | 'source'>> = {}): Annunci10xEntitlementProvider {
  let current = normalizeEntitlements({
    guide: seed.guide ?? false,
    adGenerationCredits: seed.adGenerationCredits ?? 0,
    source: seed.source ?? 'TEST',
    verification: 'SERVER_VERIFIED',
    checkedAt: new Date().toISOString(),
  });
  return {
    async get() {
      return current;
    },
    async grant(input) {
      current = normalizeEntitlements({
        guide: current.guide || input.productCode === 'GUIDE' || input.productCode === 'GUIDE_PLUS_AD',
        adGenerationCredits: current.adGenerationCredits + (input.productCode === 'AD_GENERATION' || input.productCode === 'GUIDE_PLUS_AD' ? 1 : 0),
        source: input.reason === 'TEST' ? 'TEST' : input.reason,
        verification: 'SERVER_VERIFIED',
        checkedAt: new Date().toISOString(),
      });
      return current;
    },
    async consumeAdGenerationCredit() {
      if (current.adGenerationCredits < 1) throw new Error('No Annunci 10x ad-generation credit available.');
      current = normalizeEntitlements({
        ...current,
        adGenerationCredits: current.adGenerationCredits - 1,
        checkedAt: new Date().toISOString(),
      });
      return current;
    },
  };
}

export function sanitizeCommercialClientPayload(payload: unknown): Record<string, never> {
  void payload;
  return {};
}

export function isVerifiedCommercialSessionClaim(claimedSessionId: string | null | undefined, trustedSessionId: string | null | undefined): boolean {
  return !claimedSessionId || claimedSessionId === trustedSessionId;
}

function offerFor(productCode: ProductCode, discountReason: Annunci10xCommercialDiscountReason): Annunci10xCommercialOffer {
  const product = getAnnunci10xCatalogItem(productCode);
  return {
    id: `annunci10x-offer-${productCode.toLowerCase()}`,
    productCode,
    displayName: product.displayName,
    description: product.description,
    includedCapabilities: product.includedCapabilities,
    eligibility: 'AVAILABLE',
    pricingStatus: 'OPEN_DECISION',
    discountReason,
    purchaseEnabled: false,
    reasonUnavailable: 'PURCHASE_DISABLED',
  };
}

function noneEntitled(source: Annunci10xEntitlementSource): Annunci10xCommercialEntitlements {
  return normalizeEntitlements({
    guide: false,
    adGenerationCredits: 0,
    source,
    verification: 'SERVER_VERIFIED',
    checkedAt: new Date().toISOString(),
  });
}

function normalizeEntitlements(entitlements: Annunci10xCommercialEntitlements): Annunci10xCommercialEntitlements {
  return {
    guide: Boolean(entitlements.guide),
    adGenerationCredits: Math.max(0, Math.floor(Number(entitlements.adGenerationCredits) || 0)),
    source: entitlements.source,
    verification: 'SERVER_VERIFIED',
    checkedAt: entitlements.checkedAt,
  };
}
