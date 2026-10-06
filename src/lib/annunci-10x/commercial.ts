import type { ProductCode, SessionState } from './types.ts';
import type { Annunci10xPersistenceAdapter, EffectiveEntitlements } from './persistence/types.ts';

export const ANNUNCI10X_COMMERCIAL_VERSION = 'annunci10x-commercial-v3';

export const ANNUNCI10X_OFFER_CODES = ['ANNUNCI10X_REWRITE', 'ANNUNCI10X_CREATE', 'AGENT_RECRUITER'] as const;
export type Annunci10xOfferCode = (typeof ANNUNCI10X_OFFER_CODES)[number];
export type Annunci10xEntitlementCapability = 'REWRITE_CREDIT' | 'CREATE_CREDIT' | 'GUIDE_ACCESS' | 'AGENT_RECRUITER_ACCESS';

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

export const ANNUNCI10X_OFFER_CATALOG: readonly Annunci10xOfferCatalogItem[] = [
  {
    offerCode: 'ANNUNCI10X_REWRITE',
    displayName: 'Annuncio 10x',
    description: 'Potenziamento di un testo esistente. 1 annuncio, 1 versione, 1 canale.',
    price: { amountCents: 0, currency: 'EUR', display: 'Gratis' },
    capabilities: [{ capability: 'REWRITE_CREDIT', quantity: 1 }],
    flows: ['ANALYZE'],
  },
  {
    offerCode: 'ANNUNCI10X_CREATE',
    displayName: 'Annuncio 10x',
    description: 'Creazione di un nuovo annuncio partendo dai fatti del ruolo. 1 annuncio, 1 versione finale, fino a 3 modifiche mirate, 1 canale.',
    price: { amountCents: 0, currency: 'EUR', display: 'Gratis' },
    capabilities: [{ capability: 'CREATE_CREDIT', quantity: 1 }],
    flows: ['CREATE'],
  },
  {
    offerCode: 'AGENT_RECRUITER',
    displayName: 'Agent Recruiter',
    description: 'Guida Annunci 10x + Agent Recruiter.',
    price: { amountCents: 4900, currency: 'EUR', display: '49,00 EUR' },
    capabilities: [
      { capability: 'GUIDE_ACCESS', quantity: 1 },
      { capability: 'AGENT_RECRUITER_ACCESS', quantity: 1 },
    ],
    flows: ['ANALYZE', 'CREATE'],
  },
] as const;

export type Annunci10xProductStatus = 'COMING_SOON';
export type Annunci10xPricingStatus = 'OPEN_DECISION' | 'FIXED';
export type Annunci10xCommercialFlow = 'ANALYZE' | 'CREATE';
export type Annunci10xCommercialSubjectKind = 'ACCOUNT' | 'EMAIL_VERIFIED' | 'PAYMENT_CUSTOMER' | 'SESSION' | 'ANONYMOUS';
export type Annunci10xCommercialDiscountReason = 'NONE' | 'GUIDE_OWNER' | 'BUNDLE';
export type Annunci10xCommercialEligibility = 'AVAILABLE' | 'UNAVAILABLE';
export type Annunci10xCommercialUnavailableReason =
  | 'PURCHASE_DISABLED'
  | 'EMAIL_NOT_VERIFIED'
  | 'FLOW_NOT_APPLICABLE'
  | 'ALREADY_ENTITLED';
export type Annunci10xEntitlementSource = 'NO_TRUSTED_SOURCE' | 'PURCHASE' | 'BUNDLE' | 'ADMIN' | 'TEST';

export interface Annunci10xPrice {
  amountCents: number;
  currency: 'EUR';
  display: string;
}

export interface Annunci10xOfferCapability {
  capability: Annunci10xEntitlementCapability;
  quantity: number;
}

export interface Annunci10xProductCatalogItem {
  productCode: ProductCode;
  displayName: string;
  description: string;
  includedCapabilities: readonly ('GUIDE_ACCESS' | 'AD_GENERATION_CREDIT')[];
  status: Annunci10xProductStatus;
  pricingStatus: 'OPEN_DECISION';
  purchaseEnabled: false;
}

export interface Annunci10xOfferCatalogItem {
  offerCode: Annunci10xOfferCode;
  displayName: string;
  description: string;
  price: Annunci10xPrice;
  capabilities: readonly Annunci10xOfferCapability[];
  flows: readonly Annunci10xCommercialFlow[];
}

export interface Annunci10xCommercialSubject {
  kind: Annunci10xCommercialSubjectKind;
  id?: string;
  sessionId?: string;
}

export interface Annunci10xCommercialEntitlements {
  guide: boolean;
  adGenerationCredits: number;
  rewriteCredits: number;
  createCredits: number;
  agentRecruiterAccess: boolean;
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
  checkoutEnabled?: boolean;
  identityVerified?: boolean;
  agentRecruiterEnabled?: boolean;
}

export interface Annunci10xCommercialOffer {
  id: string;
  offerCode: Annunci10xOfferCode;
  displayName: string;
  description: string;
  price: Annunci10xPrice;
  capabilities: Annunci10xOfferCapability[];
  eligibility: Annunci10xCommercialEligibility;
  purchaseEnabled: boolean;
  reasonUnavailable?: Annunci10xCommercialUnavailableReason;
}

export interface Annunci10xCommercialState {
  version: typeof ANNUNCI10X_COMMERCIAL_VERSION;
  subject: Annunci10xCommercialSubject;
  entitlements: Annunci10xCommercialEntitlements;
  availableOffers: Annunci10xCommercialOffer[];
  checkoutEnabled: boolean;
  pricingStatus: 'FIXED';
}

export interface ResolveAnnunci10xCommercialInput {
  subject?: Annunci10xCommercialSubject;
  flow: Annunci10xCommercialFlow;
  journeyState: SessionState | 'PRODUCT_PAGE';
  entitlementProvider?: Annunci10xEntitlementProvider;
  checkoutEnabled?: boolean;
  identityVerified?: boolean;
  agentRecruiterEnabled?: boolean;
}

export function isAnnunci10xOfferCode(value: unknown): value is Annunci10xOfferCode {
  return ANNUNCI10X_OFFER_CODES.includes(value as Annunci10xOfferCode);
}

export function getAnnunci10xProductCatalog(): Annunci10xProductCatalogItem[] {
  return ANNUNCI10X_PRODUCT_CATALOG.map((item) => ({ ...item, includedCapabilities: [...item.includedCapabilities] }));
}

export function getAnnunci10xCatalogItem(productCode: ProductCode): Annunci10xProductCatalogItem {
  const item = ANNUNCI10X_PRODUCT_CATALOG.find((catalogItem) => catalogItem.productCode === productCode);
  if (!item) throw new Error(`Unknown Annunci 10x product: ${productCode}`);
  return { ...item, includedCapabilities: [...item.includedCapabilities] };
}

export function getAnnunci10xOfferCatalog(): Annunci10xOfferCatalogItem[] {
  return ANNUNCI10X_OFFER_CATALOG.map(cloneOfferCatalogItem);
}

export function getAnnunci10xOffer(offerCode: Annunci10xOfferCode): Annunci10xOfferCatalogItem {
  const item = ANNUNCI10X_OFFER_CATALOG.find((catalogItem) => catalogItem.offerCode === offerCode);
  if (!item) throw new Error(`Unknown Annunci 10x offer: ${offerCode}`);
  return cloneOfferCatalogItem(item);
}

export function isAnnunci10xCheckoutEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const value = env.ANNUNCI10X_CHECKOUT_ENABLED?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

export function isAnnunci10xFulfillmentEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const value = env.ANNUNCI10X_FULFILLMENT_ENABLED?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

export function isAnnunci10xAgentRecruiterEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const value = env.ANNUNCI10X_AGENT_RECRUITER_ENABLED?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

export async function resolveAnnunci10xCommercial(input: ResolveAnnunci10xCommercialInput): Promise<Annunci10xCommercialState> {
  const subject = input.subject ?? { kind: 'ANONYMOUS' };
  const provider = input.entitlementProvider ?? createOpenDecisionEntitlementProvider();
  const entitlements = normalizeEntitlements(await provider.get(subject));
  const checkoutEnabled = Boolean(input.checkoutEnabled);
  return {
    version: ANNUNCI10X_COMMERCIAL_VERSION,
    subject,
    entitlements,
    availableOffers: buildAnnunci10xOffers({
      subject,
      entitlements,
      flow: input.flow,
      journeyState: input.journeyState,
      checkoutEnabled,
      identityVerified: Boolean(input.identityVerified),
      agentRecruiterEnabled: input.agentRecruiterEnabled ?? isAnnunci10xAgentRecruiterEnabled(),
    }),
    checkoutEnabled,
    pricingStatus: 'FIXED',
  };
}

export function buildAnnunci10xOffers(input: Annunci10xOfferEngineInput): Annunci10xCommercialOffer[] {
  return ANNUNCI10X_OFFER_CATALOG
    .filter((item) => item.flows.includes(input.flow))
    .filter((item) => item.offerCode !== 'AGENT_RECRUITER' || Boolean(input.agentRecruiterEnabled))
    .map((item) => offerFor(item, input));
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

export function createPersistenceAnnunci10xCommerceEntitlementProvider(input: {
  persistence: Annunci10xPersistenceAdapter;
  sessionId: string;
  sessionSecret: string;
}): Annunci10xEntitlementProvider {
  return {
    async get() {
      return entitlementsFromEffective(await input.persistence.getEffectiveEntitlements(input.sessionId, input.sessionSecret), 'PURCHASE');
    },
    async grant() {
      throw new Error('Annunci 10x commerce grants are created only by paid purchase reconciliation.');
    },
    async consumeAdGenerationCredit() {
      throw new Error('Annunci 10x V2 commerce credits are not consumable in this phase.');
    },
  };
}

export function createTestEntitlementProvider(seed: Partial<Pick<Annunci10xCommercialEntitlements, 'guide' | 'adGenerationCredits' | 'rewriteCredits' | 'createCredits' | 'agentRecruiterAccess' | 'source'>> = {}): Annunci10xEntitlementProvider {
  let current = normalizeEntitlements({
    guide: seed.guide ?? false,
    adGenerationCredits: seed.adGenerationCredits ?? 0,
    rewriteCredits: seed.rewriteCredits ?? 0,
    createCredits: seed.createCredits ?? 0,
    agentRecruiterAccess: seed.agentRecruiterAccess ?? false,
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
        ...current,
        guide: current.guide || input.productCode === 'GUIDE' || input.productCode === 'GUIDE_PLUS_AD',
        adGenerationCredits: current.adGenerationCredits + (input.productCode === 'AD_GENERATION' || input.productCode === 'GUIDE_PLUS_AD' ? 1 : 0),
        source: input.reason === 'TEST' ? 'TEST' : input.reason,
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

function offerFor(item: Annunci10xOfferCatalogItem, input: Annunci10xOfferEngineInput): Annunci10xCommercialOffer {
  const unavailableReason = unavailableReasonFor(item, input);
  return {
    id: `annunci10x-offer-${item.offerCode.toLowerCase()}`,
    offerCode: item.offerCode,
    displayName: item.displayName,
    description: item.description,
    price: { ...item.price },
    capabilities: item.capabilities.map((capability) => ({ ...capability })),
    eligibility: unavailableReason ? 'UNAVAILABLE' : 'AVAILABLE',
    purchaseEnabled: !unavailableReason,
    ...(unavailableReason ? { reasonUnavailable: unavailableReason } : {}),
  };
}

function unavailableReasonFor(item: Annunci10xOfferCatalogItem, input: Annunci10xOfferEngineInput): Annunci10xCommercialUnavailableReason | null {
  if (!item.flows.includes(input.flow)) return 'FLOW_NOT_APPLICABLE';
  if (item.offerCode === 'ANNUNCI10X_REWRITE' || item.offerCode === 'ANNUNCI10X_CREATE') return 'PURCHASE_DISABLED';
  if (item.offerCode === 'AGENT_RECRUITER' && input.entitlements.agentRecruiterAccess) return 'ALREADY_ENTITLED';
  if (!input.checkoutEnabled) return 'PURCHASE_DISABLED';
  if (!input.identityVerified || input.subject.kind === 'ANONYMOUS') return 'EMAIL_NOT_VERIFIED';
  return null;
}

function noneEntitled(source: Annunci10xEntitlementSource): Annunci10xCommercialEntitlements {
  return normalizeEntitlements({
    guide: false,
    adGenerationCredits: 0,
    rewriteCredits: 0,
    createCredits: 0,
    agentRecruiterAccess: false,
    source,
    verification: 'SERVER_VERIFIED',
    checkedAt: new Date().toISOString(),
  });
}

function entitlementsFromEffective(effective: EffectiveEntitlements, source: Annunci10xEntitlementSource): Annunci10xCommercialEntitlements {
  return normalizeEntitlements({
    guide: effective.guideAccess,
    adGenerationCredits: 0,
    rewriteCredits: effective.rewriteCredits,
    createCredits: effective.createCredits,
    agentRecruiterAccess: effective.agentRecruiterAccess,
    source,
    verification: 'SERVER_VERIFIED',
    checkedAt: effective.checkedAt,
  });
}

function normalizeEntitlements(entitlements: Annunci10xCommercialEntitlements): Annunci10xCommercialEntitlements {
  return {
    guide: Boolean(entitlements.guide),
    adGenerationCredits: Math.max(0, Math.floor(Number(entitlements.adGenerationCredits) || 0)),
    rewriteCredits: Math.max(0, Math.floor(Number(entitlements.rewriteCredits) || 0)),
    createCredits: Math.max(0, Math.floor(Number(entitlements.createCredits) || 0)),
    agentRecruiterAccess: Boolean(entitlements.agentRecruiterAccess),
    source: entitlements.source,
    verification: 'SERVER_VERIFIED',
    checkedAt: entitlements.checkedAt,
  };
}

function cloneOfferCatalogItem(item: Annunci10xOfferCatalogItem): Annunci10xOfferCatalogItem {
  return {
    ...item,
    price: { ...item.price },
    capabilities: item.capabilities.map((capability) => ({ ...capability })),
    flows: [...item.flows],
  };
}
