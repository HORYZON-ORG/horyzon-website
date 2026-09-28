import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

process.env.ANNUNCI10X_EMAIL_VERIFICATION_PEPPER = `${randomUUID()}${randomUUID()}`;

const {
  MemoryAnnunci10xPersistenceAdapter,
  createFact,
  createPersistenceAnnunci10xCommerceEntitlementProvider,
  createProductionGenerationAuthorizationProvider,
  isAnnunci10xFulfillmentEnabled,
  resolveAnnunci10xCommercial,
} = await import('../src/lib/annunci-10x/index.ts');

async function assertRewriteReserveReleaseConsume() {
  const { context, session } = await readyAnalyzeCase();
  assert.equal((await context.persistence.getEffectiveEntitlements(session.sessionId, session.sessionSecret)).rewriteCredits, 1);

  const reserved = await context.persistence.reserveGenerationCredit({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    capability: 'REWRITE_CREDIT',
    leaseSeconds: 1800,
  });
  assert.equal(reserved.status, 'RESERVED');
  assert.equal((await context.persistence.getEffectiveEntitlements(session.sessionId, session.sessionSecret)).rewriteCredits, 0);

  const released = await context.persistence.releaseGenerationCredit({
    reservationId: reserved.id,
    sessionSecret: session.sessionSecret,
    reasonCode: 'AI_FAILED_WITHOUT_PII',
  });
  assert.equal(released.status, 'RELEASED');
  assert.equal(released.releaseReasonCode, 'AI_FAILED_WITHOUT_PII');
  assert.equal((await context.persistence.getEffectiveEntitlements(session.sessionId, session.sessionSecret)).rewriteCredits, 1);

  const second = await context.persistence.reserveGenerationCredit({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    capability: 'REWRITE_CREDIT',
    leaseSeconds: 1800,
  });
  const output = await saveSyntheticOutput(context, session);
  const consumed = await context.persistence.consumeGenerationCredit({
    reservationId: second.id,
    sessionSecret: session.sessionSecret,
    outputId: output.id,
  });
  assert.equal(consumed.status, 'CONSUMED');
  assert.equal(consumed.outputId, output.id);
  assert.equal((await context.persistence.getEffectiveEntitlements(session.sessionId, session.sessionSecret)).rewriteCredits, 0);

  const idempotent = await context.persistence.consumeGenerationCredit({
    reservationId: second.id,
    sessionSecret: session.sessionSecret,
    outputId: output.id,
  });
  assert.equal(idempotent.id, consumed.id);

  await paidPurchase(context, session, 'ANNUNCI10X_REWRITE');
  const third = await context.persistence.reserveGenerationCredit({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    capability: 'REWRITE_CREDIT',
    leaseSeconds: 1800,
  });
  await assert.rejects(
    () => context.persistence.consumeGenerationCredit({
      reservationId: third.id,
      sessionSecret: session.sessionSecret,
      outputId: output.id,
    }),
    /already consumed/,
  );

  const otherOutput = await saveSyntheticOutput(context, session);
  await assert.rejects(
    () => context.persistence.consumeGenerationCredit({
      reservationId: second.id,
      sessionSecret: session.sessionSecret,
      outputId: otherOutput.id,
    }),
    /different output/,
  );
}

async function assertExpiryAndConcurrentReserve() {
  const { context, session } = await readyAnalyzeCase();
  const reserved = await context.persistence.reserveGenerationCredit({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    capability: 'REWRITE_CREDIT',
    leaseSeconds: 60,
  });
  context.persistence.creditReservations.get(reserved.id).lease_expires_at = new Date(Date.now() - 1000).toISOString();

  const next = await context.persistence.reserveGenerationCredit({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    capability: 'REWRITE_CREDIT',
    leaseSeconds: 60,
  });
  assert.notEqual(next.id, reserved.id);
  assert.equal((await context.persistence.getCreditReservationById(reserved.id, session.sessionSecret)).status, 'EXPIRED');
  assert.equal((await context.persistence.getEffectiveEntitlements(session.sessionId, session.sessionSecret)).rewriteCredits, 0);

  const { context: concurrentContext, session: concurrentSession } = await readyAnalyzeCase();
  const [left, right] = await Promise.all([
    concurrentContext.persistence.reserveGenerationCredit({
      sessionId: concurrentSession.sessionId,
      sessionSecret: concurrentSession.sessionSecret,
      capability: 'REWRITE_CREDIT',
      leaseSeconds: 1800,
    }),
    concurrentContext.persistence.reserveGenerationCredit({
      sessionId: concurrentSession.sessionId,
      sessionSecret: concurrentSession.sessionSecret,
      capability: 'REWRITE_CREDIT',
      leaseSeconds: 1800,
    }),
  ]);
  assert.equal(left.id, right.id);
  assert.equal([...concurrentContext.persistence.creditReservations.values()].filter((row) => row.status === 'RESERVED').length, 1);
}

async function assertExpiredConsumePersistsAndRestoresCredit() {
  const { context, session } = await readyAnalyzeCase();
  const reserved = await context.persistence.reserveGenerationCredit({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    capability: 'REWRITE_CREDIT',
    leaseSeconds: 60,
  });
  context.persistence.creditReservations.get(reserved.id).lease_expires_at = new Date(Date.now() - 1000).toISOString();
  const output = await saveSyntheticOutput(context, session);
  const expired = await context.persistence.consumeGenerationCredit({
    reservationId: reserved.id,
    sessionSecret: session.sessionSecret,
    outputId: output.id,
  });
  assert.equal(expired.status, 'EXPIRED');
  assert.equal(expired.outputId, null);
  assert.ok(expired.expiredAt);
  assert.equal((await context.persistence.getCreditReservationById(reserved.id, session.sessionSecret)).status, 'EXPIRED');
  assert.equal((await context.persistence.getEffectiveEntitlements(session.sessionId, session.sessionSecret)).rewriteCredits, 1);
}

async function assertWrongFlowAndReadiness() {
  const analyze = await readyAnalyzeCase();
  await assert.rejects(
    () => analyze.context.persistence.reserveGenerationCredit({
      sessionId: analyze.session.sessionId,
      sessionSecret: analyze.session.sessionSecret,
      capability: 'CREATE_CREDIT',
      leaseSeconds: 1800,
    }),
    /ANALYZE sessions/,
  );

  const notReady = await verifiedSession('ANALYZE');
  await paidPurchase(notReady.context, notReady.session, 'ANNUNCI10X_REWRITE');
  await assert.rejects(
    () => notReady.context.persistence.reserveGenerationCredit({
      sessionId: notReady.session.sessionId,
      sessionSecret: notReady.session.sessionSecret,
      capability: 'REWRITE_CREDIT',
      leaseSeconds: 1800,
    }),
    /READY analysis run/,
  );
  await markAnalysisReady(notReady.context, notReady.session);
  assert.equal((await notReady.context.persistence.reserveGenerationCredit({
    sessionId: notReady.session.sessionId,
    sessionSecret: notReady.session.sessionSecret,
    capability: 'REWRITE_CREDIT',
    leaseSeconds: 1800,
  })).status, 'RESERVED');

  const create = await readyCreateCase('PAYMENT_REQUIRED');
  await assert.rejects(
    () => create.context.persistence.reserveGenerationCredit({
      sessionId: create.session.sessionId,
      sessionSecret: create.session.sessionSecret,
      capability: 'REWRITE_CREDIT',
      leaseSeconds: 1800,
    }),
    /CREATE sessions/,
  );
}

async function assertCreateCreditReadiness() {
  const collecting = await readyCreateCase('COLLECTING');
  await assert.rejects(
    () => collecting.context.persistence.reserveGenerationCredit({
      sessionId: collecting.session.sessionId,
      sessionSecret: collecting.session.sessionSecret,
      capability: 'CREATE_CREDIT',
      leaseSeconds: 1800,
    }),
    /not ready/,
  );

  const ready = await readyCreateCase('PAYMENT_REQUIRED');
  assert.equal((await ready.context.persistence.getEffectiveEntitlements(ready.session.sessionId, ready.session.sessionSecret)).createCredits, 1);
  const reserved = await ready.context.persistence.reserveGenerationCredit({
    sessionId: ready.session.sessionId,
    sessionSecret: ready.session.sessionSecret,
    capability: 'CREATE_CREDIT',
    leaseSeconds: 1800,
  });
  assert.equal(reserved.status, 'RESERVED');
  assert.equal((await ready.context.persistence.getEffectiveEntitlements(ready.session.sessionId, ready.session.sessionSecret)).createCredits, 0);
  await ready.context.persistence.releaseGenerationCredit({
    reservationId: reserved.id,
    sessionSecret: ready.session.sessionSecret,
    reasonCode: 'USER_CANCELLED',
  });
  assert.equal((await ready.context.persistence.getEffectiveEntitlements(ready.session.sessionId, ready.session.sessionSecret)).createCredits, 1);
}

async function assertRefundBeforeConsume() {
  const { context, session, purchase } = await readyAnalyzeCase();
  const reserved = await context.persistence.reserveGenerationCredit({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    capability: 'REWRITE_CREDIT',
    leaseSeconds: 1800,
  });
  await context.persistence.markPurchaseRefunded({ purchaseId: purchase.id, stripePaymentIntentId: 'pi_refunded_before_consume' });
  const output = await saveSyntheticOutput(context, session);
  await assert.rejects(
    () => context.persistence.consumeGenerationCredit({
      reservationId: reserved.id,
      sessionSecret: session.sessionSecret,
      outputId: output.id,
    }),
    /paid purchase/,
  );
  assert.equal((await context.persistence.getEffectiveEntitlements(session.sessionId, session.sessionSecret)).rewriteCredits, 0);
}

async function assertAgentAccessUnaffected() {
  const { context, session } = await verifiedSession('CREATE');
  await paidPurchase(context, session, 'AGENT_RECRUITER');
  const before = await context.persistence.getEffectiveEntitlements(session.sessionId, session.sessionSecret);
  assert.equal(before.guideAccess, true);
  assert.equal(before.agentRecruiterAccess, true);
  await appendSnapshot(context, session);
  await context.persistence.updateSession({ sessionId: session.sessionId, sessionSecret: session.sessionSecret, state: 'PAYMENT_REQUIRED' });
  await paidPurchase(context, session, 'ANNUNCI10X_CREATE');
  const reservation = await context.persistence.reserveGenerationCredit({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    capability: 'CREATE_CREDIT',
    leaseSeconds: 1800,
  });
  assert.equal(reservation.status, 'RESERVED');
  const after = await context.persistence.getEffectiveEntitlements(session.sessionId, session.sessionSecret);
  assert.equal(after.guideAccess, true);
  assert.equal(after.agentRecruiterAccess, true);
}

async function assertCheckoutOffVisibility() {
  const { context, session } = await readyAnalyzeCase();
  const commercial = await resolveAnnunci10xCommercial({
    subject: { kind: 'SESSION', sessionId: session.sessionId },
    flow: 'ANALYZE',
    journeyState: 'PRODUCT_PAGE',
    checkoutEnabled: false,
    identityVerified: true,
    entitlementProvider: createPersistenceAnnunci10xCommerceEntitlementProvider({
      persistence: context.persistence,
      sessionId: session.sessionId,
      sessionSecret: session.sessionSecret,
    }),
  });
  assert.equal(commercial.entitlements.rewriteCredits, 1);
  assert.equal(commercial.availableOffers.every((offer) => offer.purchaseEnabled === false), true);

  await paidPurchase(context, session, 'AGENT_RECRUITER');
  const agentCommercial = await resolveAnnunci10xCommercial({
    subject: { kind: 'SESSION', sessionId: session.sessionId },
    flow: 'ANALYZE',
    journeyState: 'PRODUCT_PAGE',
    checkoutEnabled: false,
    identityVerified: true,
    entitlementProvider: createPersistenceAnnunci10xCommerceEntitlementProvider({
      persistence: context.persistence,
      sessionId: session.sessionId,
      sessionSecret: session.sessionSecret,
    }),
  });
  assert.equal(agentCommercial.entitlements.agentRecruiterAccess, true);
  assert.equal(agentCommercial.availableOffers.find((offer) => offer.offerCode === 'AGENT_RECRUITER').reasonUnavailable, 'ALREADY_ENTITLED');
}

function assertFulfillmentFlag() {
  for (const value of [undefined, '0', 'false', 'no']) {
    assert.equal(isAnnunci10xFulfillmentEnabled({ ANNUNCI10X_FULFILLMENT_ENABLED: value }), false);
  }
  for (const value of ['1', 'true', 'yes']) {
    assert.equal(isAnnunci10xFulfillmentEnabled({ ANNUNCI10X_FULFILLMENT_ENABLED: value }), true);
  }
}

async function assertProductionAuthorizationFailClosed() {
  const { context, session } = await readyCreateCase('PAYMENT_REQUIRED');
  const persistedSession = await context.persistence.getSession(session.sessionId, session.sessionSecret);
  const provider = createProductionGenerationAuthorizationProvider();
  const authorization = await provider.authorize({ session: persistedSession, productCode: 'AD_GENERATION' });
  assert.equal(authorization.status, 'NOT_AUTHORIZED');
  assert.equal(authorization.remainingCredits, 0);
}

async function assertMigration() {
  const sql = await readFile('supabase/migrations/20260928180000_annunci10x_generation_credit_reservations.sql', 'utf8');
  for (const required of [
    'create table if not exists public.annunci10x_credit_reservations',
    "capability in ('REWRITE_CREDIT', 'CREATE_CREDIT')",
    "status in ('RESERVED', 'CONSUMED', 'RELEASED', 'EXPIRED')",
    'quantity = 1',
    'annunci10x_credit_reservations_active_session_capability_uidx',
    'annunci10x_credit_reservations_output_uidx',
    'annunci10x_credit_reservations_session_idx',
    'annunci10x_credit_reservations_grant_idx',
    'annunci10x_credit_reservations_status_lease_idx',
    'annunci10x_credit_reservations_output_idx',
    'alter table public.annunci10x_credit_reservations enable row level security',
    'revoke all on table public.annunci10x_credit_reservations from public, anon, authenticated',
    'grant select, insert, update on table public.annunci10x_credit_reservations to service_role',
    'annunci10x_reserve_generation_credit',
    'annunci10x_consume_generation_credit',
    'annunci10x_release_generation_credit',
    'annunci10x_get_effective_entitlements',
    'security definer',
    'set search_path = pg_catalog, public',
    'grant execute on function public.annunci10x_reserve_generation_credit(uuid, text, text, integer) to service_role',
    'grant execute on function public.annunci10x_consume_generation_credit(uuid, text, uuid) to service_role',
    'grant execute on function public.annunci10x_release_generation_credit(uuid, text, text) to service_role',
    "v_session.flow = 'ANALYZE'",
    "v_session.flow = 'CREATE'",
    "p.status = 'PAID'",
    "v_purchase.status <> 'PAID'",
    "r.status = 'CONSUMED'",
    "r.status = 'RESERVED'",
    "status = 'EXPIRED'",
    "status = 'RELEASED'",
  ]) {
    assert.match(sql, new RegExp(escapeRegExp(required), 'i'), `reservation migration missing ${required}`);
  }
  const tableDefinition = sql.slice(sql.indexOf('create table if not exists public.annunci10x_credit_reservations'), sql.indexOf('create index if not exists annunci10x_credit_reservations_session_idx'));
  assert.doesNotMatch(sql, /grant\s+delete/i, 'reservation table must not grant DELETE');
  assert.doesNotMatch(tableDefinition, /email|first_name|last_name|company_name|prompt|job_ad|stripe_customer|payment_intent|card/i, 'reservation table must not store PII, raw prompts, or payment artifacts');
  assert.match(sql, /p_lease_seconds < 60 or p_lease_seconds > 1800/i);
  assert.match(sql, /if v_reservation\.lease_expires_at <= v_now then[\s\S]*status = 'EXPIRED'[\s\S]*return to_jsonb\(v_reservation\);[\s\S]*end if;/i);
  assert.doesNotMatch(sql, /raise exception 'generation credit reservation expired'/i);
}

async function assertStaticWiring() {
  const route = await readFile('src/app/api/annunci-10x/commercial/offers/route.ts', 'utf8');
  assert.match(route, /const checkoutEnabled = isAnnunci10xCheckoutEnabled\(\)/);
  assert.match(route, /entitlementProvider:\s*session\s*\?/s);
  assert.doesNotMatch(route, /entitlementProvider:\s*checkoutEnabled && session/s);

  const createFlow = await readFile('src/lib/annunci-10x/create-flow.ts', 'utf8');
  assert.match(createFlow, /const checkoutEnabled = isAnnunci10xCheckoutEnabled\(\)/);
  assert.match(createFlow, /entitlementProvider:\s*createPersistenceAnnunci10xCommerceEntitlementProvider/s);
  assert.doesNotMatch(createFlow, /entitlementProvider:\s*checkoutEnabled\s*\?/s);

  const premiumAuth = await readFile('src/lib/annunci-10x/premium/authorization.ts', 'utf8');
  assert.match(premiumAuth, /createProductionGenerationAuthorizationProvider\(\)[\s\S]*NOT_AUTHORIZED/s);
  assert.doesNotMatch(premiumAuth, /isAnnunci10xFulfillmentEnabled|reserveGenerationCredit|consumeGenerationCredit/s);
}

async function readyAnalyzeCase() {
  const value = await verifiedSession('ANALYZE');
  await appendSnapshot(value.context, value.session);
  const purchase = await paidPurchase(value.context, value.session, 'ANNUNCI10X_REWRITE');
  await markAnalysisReady(value.context, value.session);
  return { ...value, purchase };
}

async function readyCreateCase(state) {
  const value = await verifiedSession('CREATE');
  await appendSnapshot(value.context, value.session);
  await value.context.persistence.updateSession({ sessionId: value.session.sessionId, sessionSecret: value.session.sessionSecret, state });
  const purchase = await paidPurchase(value.context, value.session, 'ANNUNCI10X_CREATE');
  return { ...value, purchase };
}

async function verifiedSession(flow) {
  const context = { persistence: new MemoryAnnunci10xPersistenceAdapter() };
  const created = await context.persistence.createSession({
    flow,
    selectedChannel: 'LINKEDIN',
    commercialContext,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  });
  const session = { sessionId: created.session.id, sessionSecret: created.sessionSecret };
  const lead = await context.persistence.saveLead({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    firstName: 'Ada',
    lastName: 'Lovelace',
    companyName: 'Horyzon Test',
    businessRole: 'HR',
    emailNormalized: `ada.${randomUUID()}@example.com`,
    marketingConsent: false,
    marketingConsentVersion: 'test',
  });
  const verificationId = randomUUID();
  await context.persistence.createEmailVerification({
    id: verificationId,
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    leadId: lead.id,
    emailNormalized: lead.emailNormalized,
    codeHash: 'synthetic-hash',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    maxAttempts: 5,
    pendingGraceSeconds: 1,
  });
  await context.persistence.markEmailVerificationSent(verificationId, session.sessionSecret);
  await context.persistence.verifyEmailCode({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    verificationId,
    codeMatches: true,
  });
  return { context, session, lead };
}

async function paidPurchase(context, session, offerCode) {
  const lead = await context.persistence.getLead(session.sessionId, session.sessionSecret);
  const expectedAmountCents = offerCode === 'ANNUNCI10X_REWRITE' ? 700 : offerCode === 'ANNUNCI10X_CREATE' ? 900 : 4900;
  const purchase = await context.persistence.createOrGetPurchase({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    leadId: lead.id,
    offerCode,
    expectedAmountCents,
    currency: 'EUR',
    stripePriceId: `price_${offerCode.toLowerCase()}`,
  });
  const checkoutId = `cs_${purchase.id.replaceAll('-', '').slice(0, 24)}`;
  await context.persistence.attachCheckoutSession({
    purchaseId: purchase.id,
    sessionSecret: session.sessionSecret,
    stripeCheckoutSessionId: checkoutId,
  });
  return context.persistence.completePaidPurchase({
    purchaseId: purchase.id,
    stripeCheckoutSessionId: checkoutId,
    amountCents: expectedAmountCents,
    currency: 'eur',
    stripePaymentIntentId: `pi_${purchase.id.replaceAll('-', '').slice(0, 24)}`,
  });
}

async function markAnalysisReady(context, session) {
  const run = await context.persistence.createOrGetAnalysisRun({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    sourceKind: 'PASTED_TEXT',
    sourceStatus: 'READY',
    originalInput: 'Annuncio sintetico completo.',
    targetText: 'Annuncio sintetico completo.',
    targetKind: 'ORIGINAL_AD',
    sourceHash: randomUUID(),
    inputIdentity: randomUUID(),
    methodVersion: 'test-method',
    rubricVersion: 'annunci10x-rubric-v1',
    promptVersion: 'test-prompt',
    scoreSemanticsVersion: 'test-score',
    model: 'mock',
    provider: 'MOCK',
    evaluationMode: 'V2_PUBLIC',
  });
  await context.persistence.updateAnalysisRun({
    analysisRunId: run.id,
    sessionSecret: session.sessionSecret,
    status: 'READY',
    stage: 'COMPLETE',
    sourceStatus: 'READY',
    evaluationId: randomUUID(),
    completedAt: new Date().toISOString(),
  });
}

async function appendSnapshot(context, session) {
  return context.persistence.appendSnapshot({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    roleCard,
    reason: 'USER_CONFIRMATION',
  });
}

async function saveSyntheticOutput(context, session) {
  const snapshot = await context.persistence.getLatestSnapshot(session.sessionId, session.sessionSecret)
    ?? await appendSnapshot(context, session);
  return context.persistence.saveOutput({
    sessionId: session.sessionId,
    sessionSecret: session.sessionSecret,
    snapshotId: snapshot.id,
    outputType: 'MASTER',
    generatedContent: syntheticGeneratedAd(session.sessionId),
    validationState: 'READY',
  });
}

function syntheticGeneratedAd(sessionId) {
  return {
    id: randomUUID(),
    sessionId,
    kind: 'MASTER',
    sections: [{
      id: 'section-title',
      type: 'TITLE',
      key: 'title',
      title: 'Titolo',
      body: 'Addetto pulizie uffici',
      sourceFactIds: ['fact-title'],
    }],
    sourceOfTruth: true,
    generatedAt: new Date().toISOString(),
    promptVersion: 'test-prompt',
  };
}

const now = '2026-09-28T00:00:00.000Z';
const fact = (value, sourceId) => createFact(value, 'USER_CONFIRMED', { sourceId, publishable: true, confidence: 95 });
const roleCard = {
  title: fact('Addetto pulizie uffici', 'fact-title'),
  mission: fact('Mantenere puliti uffici e spazi comuni', 'fact-mission'),
  outcomes: [fact('Garantire spazi ordinati a inizio giornata', 'fact-outcome')],
  responsibilities: [fact('Pulizia uffici, corridoi e spazi comuni', 'fact-responsibility')],
  requirements: [{ id: 'req-1', label: fact('Precisione e puntualita', 'fact-req'), classification: 'REQUIRED' }],
  compensation: { visibility: fact('OPEN_DECISION', 'fact-compensation') },
  attractionContext: {
    workMode: fact('In presenza', 'fact-work-mode'),
    location: fact('Bari', 'fact-location'),
    contractType: fact('Part-time', 'fact-contract'),
    schedule: fact('Mattina dal lunedi al venerdi', 'fact-schedule'),
    attractivenessEvidence: [fact('Orari definiti e affiancamento iniziale', 'fact-attraction')],
  },
};

const commercialContext = {
  productCode: 'AD_GENERATION',
  entitlements: {
    guide: false,
    adGeneration: false,
    bundle: false,
    source: 'OPEN_DECISION',
    verification: 'SERVER_VERIFIED',
    checkedAt: now,
    serverAuthorityId: 'annunci10x-open-decision',
  },
  reservedOfferEligible: false,
  reservedOfferReason: 'NONE',
  price: 'OPEN_DECISION',
  discountValue: 'OPEN_DECISION',
};

await assertMigration();
await assertRewriteReserveReleaseConsume();
await assertExpiredConsumePersistsAndRestoresCredit();
await assertExpiryAndConcurrentReserve();
await assertWrongFlowAndReadiness();
await assertCreateCreditReadiness();
await assertRefundBeforeConsume();
await assertAgentAccessUnaffected();
await assertCheckoutOffVisibility();
await assertFulfillmentFlag();
await assertProductionAuthorizationFailClosed();
await assertStaticWiring();

console.log('Annunci 10x credit reservations verifier passed');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
