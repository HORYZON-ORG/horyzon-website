import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

process.env.ANNUNCI10X_EMAIL_VERIFICATION_PEPPER = `${randomUUID()}${randomUUID()}`;

const {
  Annunci10xPublicError,
  MemoryAnnunci10xPersistenceAdapter,
  MockAnnunci10xEmailProvider,
  ResendAnnunci10xEmailProvider,
  createAnonymousAnalyzeSession,
  createAnnunci10xEmailProvider,
  requestAnnunci10xEmailVerification,
  resendOtpIdempotencyKey,
  saveAnnunci10xLeadContact,
} = await import('../src/lib/annunci-10x/index.ts');

assert.equal(createAnnunci10xEmailProvider({ NODE_ENV: 'development' }).kind, 'MOCK', 'development missing provider defaults to MOCK');
assert.equal(createAnnunci10xEmailProvider({ NODE_ENV: 'test', ANNUNCI10X_EMAIL_PROVIDER: 'MOCK' }).kind, 'MOCK', 'test MOCK provider is allowed');
assertProviderBlocked({ NODE_ENV: 'production', ANNUNCI10X_EMAIL_PROVIDER: 'MOCK' }, 'production MOCK is blocked');
assertProviderBlocked({ NODE_ENV: 'production' }, 'production missing provider is blocked');
assertProviderBlocked({ NODE_ENV: 'production', ANNUNCI10X_EMAIL_PROVIDER: 'RESEND' }, 'RESEND missing API key is blocked');
assertProviderBlocked({ NODE_ENV: 'production', ANNUNCI10X_EMAIL_PROVIDER: 'RESEND', RESEND_API_KEY: 're_test_secret' }, 'RESEND missing sender is blocked');
assertProviderBlocked({ NODE_ENV: 'test', ANNUNCI10X_EMAIL_PROVIDER: 'INVALID' }, 'invalid provider is blocked');
assert.equal(createAnnunci10xEmailProvider({
  NODE_ENV: 'production',
  ANNUNCI10X_EMAIL_PROVIDER: 'RESEND',
  RESEND_API_KEY: 're_test_secret',
  ANNUNCI10X_EMAIL_FROM: 'Horyzon <noreply@example.com>',
}).kind, 'RESEND', 'production RESEND with complete config is allowed');

const verificationId = '11111111-1111-4111-8111-111111111111';
assert.equal(resendOtpIdempotencyKey(verificationId), `annunci10x-otp/${verificationId}`);
assert.equal(resendOtpIdempotencyKey(verificationId), resendOtpIdempotencyKey(verificationId), 'same verificationId gives same idempotency key');
assert.notEqual(resendOtpIdempotencyKey(verificationId), resendOtpIdempotencyKey('22222222-2222-4222-8222-222222222222'), 'new verificationId gives new idempotency key');

const secretApiKey = 're_synthetic_secret_do_not_leak';
const captured = [];
const provider = new ResendAnnunci10xEmailProvider({
  apiKey: secretApiKey,
  from: 'Horyzon <noreply@example.com>',
  replyTo: 'info@example.com',
  fetchImpl: async (url, init) => {
    captured.push({ url, init });
    assert.equal(url, 'https://api.resend.com/emails');
    return Response.json({ id: 'resend-email-id-123' }, { status: 200 });
  },
  timeoutMs: 50,
});
const firstSend = await provider.sendVerificationCode({
  verificationId,
  recipient: 'ada@example.com',
  code: '123456',
  expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  firstName: '<Ada & Team>',
});
assert.equal(firstSend.providerRequestId, 'resend-email-id-123');
assert.equal(captured.length, 1);
const request = captured[0];
assert.equal(request.init.method, 'POST');
assert.equal(request.init.headers.Authorization, `Bearer ${secretApiKey}`);
assert.equal(request.init.headers['Content-Type'], 'application/json');
assert.equal(request.init.headers['Idempotency-Key'], `annunci10x-otp/${verificationId}`);
const body = JSON.parse(request.init.body);
assert.equal(body.from, 'Horyzon <noreply@example.com>');
assert.deepEqual(body.to, ['ada@example.com']);
assert.equal(body.reply_to, 'info@example.com');
assert.equal(body.subject, 'Il tuo codice Annunci 10x');
assert.match(body.text, /123456/);
assert.match(body.html, /123456/);
assert.doesNotMatch(body.html, /<Ada & Team>/, 'firstName is escaped in HTML');
assert.match(body.html, /&lt;Ada &amp; Team&gt;/, 'escaped firstName appears in HTML');
assert.doesNotMatch(body.text, new RegExp(verificationId), 'verificationId is not customer-facing text');
assert.doesNotMatch(body.html, new RegExp(verificationId), 'verificationId is not customer-facing HTML');
assert.doesNotMatch(JSON.stringify(request.init.headers), /123456/, 'OTP appears only in email body, not headers');
assert.match(body.text, /Score, miglioramento e creazione dell’annuncio sono gratuiti/);
assert.match(body.text, /Guida Annunci 10X è separata e costa 49 €/);
assert.match(body.html, /Score, miglioramento e creazione dell’annuncio sono gratuiti/);
assert.match(body.html, /Guida Annunci 10X è separata e costa 49 €/);
for (const forbidden of [/(\D|^)7 €/i, /(\D|^)9 €/i, /newsletter/i, /marketing/i]) {
  assert.doesNotMatch(body.text, forbidden, `OTP email text must not include ${forbidden}`);
  assert.doesNotMatch(body.html, forbidden, `OTP email HTML must not include ${forbidden}`);
}

captured.length = 0;
await provider.sendVerificationCode({
  verificationId,
  recipient: 'ada@example.com',
  code: '123456',
  expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  firstName: 'Ada',
});
assert.equal(captured[0].init.headers['Idempotency-Key'], `annunci10x-otp/${verificationId}`, 'repeated send uses the same key');

const failingProvider = new ResendAnnunci10xEmailProvider({
  apiKey: secretApiKey,
  from: 'Horyzon <noreply@example.com>',
  fetchImpl: async () => Response.json({ message: 'raw provider failure with re_synthetic_secret_do_not_leak' }, { status: 500 }),
});
await assert.rejects(
  () => failingProvider.sendVerificationCode({
    verificationId: randomUUID(),
    recipient: 'ada@example.com',
    code: '654321',
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    firstName: 'Ada',
  }),
  (error) => error instanceof Annunci10xPublicError && error.code === 'EMAIL_PROVIDER_UNAVAILABLE' && error.status === 503 && !String(error.message).includes(secretApiKey),
);

const timeoutProvider = new ResendAnnunci10xEmailProvider({
  apiKey: secretApiKey,
  from: 'Horyzon <noreply@example.com>',
  fetchImpl: (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
  }),
  timeoutMs: 1,
});
await assert.rejects(
  () => timeoutProvider.sendVerificationCode({
    verificationId: randomUUID(),
    recipient: 'ada@example.com',
    code: '111111',
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    firstName: 'Ada',
  }),
  (error) => error instanceof Annunci10xPublicError && error.code === 'EMAIL_PROVIDER_UNAVAILABLE' && error.status === 503,
);

const flowContext = makeContext();
const flowCreated = await createAnonymousAnalyzeSession(flowContext);
const flowSession = { sessionId: flowCreated.session.id, sessionSecret: flowCreated.sessionSecret };
await saveAnnunci10xLeadContact({
  session: flowSession,
  context: flowContext,
  firstName: 'Ada',
  lastName: 'Lovelace',
  companyName: 'Horyzon',
  businessRole: 'HR',
  email: 'ada.flow@example.com',
});
const flowResult = await requestAnnunci10xEmailVerification({
  session: flowSession,
  context: flowContext,
  provider: flowContext.emailProvider,
  requestFingerprint: 'resend-flow',
  env: process.env,
});
assert.equal(flowResult.sent, true);
const persisted = await flowContext.persistence.getActiveEmailVerification(flowSession.sessionId, flowSession.sessionSecret);
assert.ok(persisted);
assert.equal(flowContext.emailProvider.sent.length, 1);
assert.equal(flowContext.emailProvider.sent[0].verificationId, persisted.id, 'request flow passes the persisted verificationId');
assert.match(flowContext.emailProvider.sent[0].code, /^\d{6}$/);

const sanitizedReport = JSON.stringify({
  provider: provider.kind,
  providerRequestId: firstSend.providerRequestId,
  publicError: { code: 'EMAIL_PROVIDER_UNAVAILABLE', message: 'Provider email non disponibile.' },
  idempotencyKey: resendOtpIdempotencyKey(verificationId),
});
for (const forbidden of [secretApiKey, 'Authorization', 'sessionSecret', 'codeHash', '123456']) {
  assert.doesNotMatch(sanitizedReport, new RegExp(escapeRegExp(forbidden)), `sanitized report leaked ${forbidden}`);
}

console.log('Annunci 10x Resend verifier passed');

function assertProviderBlocked(env, message) {
  assert.throws(
    () => createAnnunci10xEmailProvider(env),
    (error) => error instanceof Annunci10xPublicError && error.code === 'EMAIL_PROVIDER_UNAVAILABLE' && error.status === 503,
    message,
  );
}

function makeContext() {
  return {
    persistence: new MemoryAnnunci10xPersistenceAdapter(),
    provider: { run: async () => { throw new Error('not used'); } },
    configuredProvider: 'MOCK',
    emailProvider: new MockAnnunci10xEmailProvider(),
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
