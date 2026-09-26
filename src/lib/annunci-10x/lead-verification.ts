import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { Annunci10xPublicError, type Annunci10xRuntimeContext, type Annunci10xSessionCookie } from './product-flow.ts';
import type {
  Annunci10xBusinessRole,
  PersistedLead,
  ResultEligibility,
} from './persistence/types.ts';

export const ANNUNCI10X_MARKETING_CONSENT_VERSION = 'annunci10x-marketing-consent-v1';
export const ANNUNCI10X_OTP_TTL_SECONDS = boundedInt(process.env.ANNUNCI10X_EMAIL_VERIFICATION_TTL_SECONDS, 60 * 10, 60, 60 * 60);
export const ANNUNCI10X_OTP_RESEND_COOLDOWN_SECONDS = boundedInt(process.env.ANNUNCI10X_EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS, 60, 15, 15 * 60);
export const ANNUNCI10X_OTP_PENDING_SEND_GRACE_SECONDS = boundedInt(process.env.ANNUNCI10X_EMAIL_VERIFICATION_PENDING_GRACE_SECONDS, 15, 5, 120);
export const ANNUNCI10X_OTP_MAX_ATTEMPTS = boundedInt(process.env.ANNUNCI10X_EMAIL_VERIFICATION_MAX_ATTEMPTS, 5, 1, 10);
export const ANNUNCI10X_OTP_SEND_LIMIT = boundedInt(process.env.ANNUNCI10X_EMAIL_VERIFICATION_SEND_LIMIT, 5, 1, 20);
export const ANNUNCI10X_OTP_SEND_WINDOW_SECONDS = boundedInt(process.env.ANNUNCI10X_EMAIL_VERIFICATION_SEND_WINDOW_SECONDS, 60 * 60, 60, 24 * 60 * 60);
export const ANNUNCI10X_OTP_VERIFY_LIMIT = boundedInt(process.env.ANNUNCI10X_EMAIL_VERIFICATION_VERIFY_LIMIT, 12, 1, 60);
export const ANNUNCI10X_OTP_VERIFY_WINDOW_SECONDS = boundedInt(process.env.ANNUNCI10X_EMAIL_VERIFICATION_VERIFY_WINDOW_SECONDS, 60 * 10, 60, 60 * 60);

export interface SaveLeadContactInput {
  session: Annunci10xSessionCookie;
  firstName: unknown;
  lastName: unknown;
  companyName: unknown;
  businessRole: unknown;
  email: unknown;
  marketingConsent?: unknown;
  context: Annunci10xRuntimeContext;
}

export interface RequestEmailVerificationInput {
  session: Annunci10xSessionCookie;
  context: Annunci10xRuntimeContext;
  provider?: Annunci10xEmailProvider;
  requestFingerprint: string;
  env?: Record<string, string | undefined>;
}

export interface VerifyEmailInput {
  session: Annunci10xSessionCookie;
  code: unknown;
  context: Annunci10xRuntimeContext;
  analysisRunId?: string | null;
  requestFingerprint: string;
  env?: Record<string, string | undefined>;
}

export interface Annunci10xEmailProvider {
  readonly kind: string;
  sendVerificationCode(input: {
    recipient: string;
    code: string;
    expiresAt: string;
    firstName?: string | null;
  }): Promise<{ providerRequestId?: string | null }>;
}

export class MockAnnunci10xEmailProvider implements Annunci10xEmailProvider {
  readonly kind = 'MOCK';
  readonly sent: Array<{ recipient: string; code: string; expiresAt: string; firstName?: string | null }> = [];

  async sendVerificationCode(input: { recipient: string; code: string; expiresAt: string; firstName?: string | null }): Promise<{ providerRequestId: string }> {
    if (process.env.NODE_ENV === 'production') {
      throw new Annunci10xPublicError('EMAIL_PROVIDER_UNAVAILABLE', 'Provider email non disponibile.', 503);
    }
    this.sent.push(input);
    return { providerRequestId: `mock-${this.sent.length}` };
  }
}

export function createAnnunci10xEmailProvider(env: Record<string, string | undefined> = process.env): Annunci10xEmailProvider {
  const configured = env.ANNUNCI10X_EMAIL_PROVIDER?.trim().toUpperCase();
  if (configured === 'MOCK' && env.NODE_ENV !== 'production') return new MockAnnunci10xEmailProvider();
  if (!configured && env.NODE_ENV !== 'production') return new MockAnnunci10xEmailProvider();
  throw new Annunci10xPublicError('EMAIL_PROVIDER_UNAVAILABLE', 'Provider email non disponibile.', 503);
}

export async function saveAnnunci10xLeadContact(input: SaveLeadContactInput): Promise<{
  lead: PersistedLead;
  contactSaved: true;
  verificationRequired: true;
  emailVerified: boolean;
}> {
  const normalized = normalizeLeadContact(input);
  const lead = await input.context.persistence.saveLead({
    sessionId: input.session.sessionId,
    sessionSecret: input.session.sessionSecret,
    ...normalized,
  });
  await input.context.persistence.appendEvent({
    sessionId: input.session.sessionId,
    eventName: 'contact_saved',
    metadata: { businessRole: lead.businessRole, marketingConsent: lead.marketingConsent },
  });
  return {
    lead,
    contactSaved: true,
    verificationRequired: true,
    emailVerified: Boolean(lead.emailVerifiedAt),
  };
}

export async function requestAnnunci10xEmailVerification(input: RequestEmailVerificationInput): Promise<{
  sent: boolean;
  expiresInSeconds: number;
  resendAfterSeconds: number;
}> {
  const env = input.env ?? process.env;
  const pepper = readPepper(env);
  const provider = input.provider ?? createAnnunci10xEmailProvider(env);
  const lead = await requireCurrentLead(input.context, input.session);

  const open = await input.context.persistence.getOpenEmailVerification(input.session.sessionId, input.session.sessionSecret);
  const pendingGrace = open?.status === 'PENDING_SEND' ? remainingSeconds(open.createdAt, ANNUNCI10X_OTP_PENDING_SEND_GRACE_SECONDS) : 0;
  if (open && pendingGrace > 0) {
    return { sent: false, expiresInSeconds: secondsUntil(open.expiresAt), resendAfterSeconds: pendingGrace };
  }
  const cooldown = open?.status === 'SENT' && open.sentAt ? remainingSeconds(open.sentAt, ANNUNCI10X_OTP_RESEND_COOLDOWN_SECONDS) : 0;
  if (open && cooldown > 0) {
    return { sent: false, expiresInSeconds: secondsUntil(open.expiresAt), resendAfterSeconds: cooldown };
  }

  const rate = await input.context.persistence.checkRateLimit({
    scope: 'annunci10x_email_send',
    subject: privateSubject('send', input.session.sessionId, lead.emailNormalized, input.requestFingerprint),
    limit: ANNUNCI10X_OTP_SEND_LIMIT,
    windowSeconds: ANNUNCI10X_OTP_SEND_WINDOW_SECONDS,
  });
  if (!rate.allowed) {
    throw new Annunci10xPublicError('RATE_LIMITED', 'Troppe richieste di verifica. Riprova piu tardi.', 429);
  }

  const code = generateSixDigitOtp();
  const expiresAt = new Date(Date.now() + ANNUNCI10X_OTP_TTL_SECONDS * 1000).toISOString();
  const verificationId = randomUUID();
  const verification = await input.context.persistence.createEmailVerification({
    id: verificationId,
    sessionId: input.session.sessionId,
    sessionSecret: input.session.sessionSecret,
    leadId: lead.id,
    emailNormalized: lead.emailNormalized,
    codeHash: hashEmailVerificationCode(pepper, verificationId, lead.emailNormalized, code),
    expiresAt,
    maxAttempts: ANNUNCI10X_OTP_MAX_ATTEMPTS,
    pendingGraceSeconds: ANNUNCI10X_OTP_PENDING_SEND_GRACE_SECONDS,
  });
  if (verification.id !== verificationId) {
    return {
      sent: false,
      expiresInSeconds: secondsUntil(verification.expiresAt),
      resendAfterSeconds: remainingSeconds(verification.createdAt, ANNUNCI10X_OTP_PENDING_SEND_GRACE_SECONDS),
    };
  }

  try {
    await provider.sendVerificationCode({ recipient: lead.emailNormalized, code, expiresAt, firstName: lead.firstName });
    await input.context.persistence.markEmailVerificationSent(verification.id, input.session.sessionSecret);
  } catch (error) {
    try {
      await input.context.persistence.markEmailVerificationFailed(verification.id, input.session.sessionSecret);
    } catch {
      // The provider outcome is already unsafe for this OTP; surface one controlled public error.
    }
    if (error instanceof Annunci10xPublicError) throw error;
    throw new Annunci10xPublicError('EMAIL_PROVIDER_UNAVAILABLE', 'Provider email non disponibile.', 503);
  }

  await input.context.persistence.appendEvent({
    sessionId: input.session.sessionId,
    eventName: 'email_verification_requested',
    metadata: { outcome: 'SENT' },
  });
  return { sent: true, expiresInSeconds: ANNUNCI10X_OTP_TTL_SECONDS, resendAfterSeconds: ANNUNCI10X_OTP_RESEND_COOLDOWN_SECONDS };
}

export async function verifyAnnunci10xEmailCode(input: VerifyEmailInput): Promise<{
  verified: boolean;
  resultEligible: boolean;
  outcome: string;
}> {
  const env = input.env ?? process.env;
  const pepper = readPepper(env);
  const code = normalizeOtpCode(input.code);
  const lead = await requireCurrentLead(input.context, input.session);
  const active = await input.context.persistence.getActiveEmailVerification(input.session.sessionId, input.session.sessionSecret);
  if (!active) {
    throw new Annunci10xPublicError('VERIFICATION_INVALID', 'Codice non valido.', 400);
  }

  const rate = await input.context.persistence.checkRateLimit({
    scope: 'annunci10x_email_verify',
    subject: privateSubject('verify', input.session.sessionId, lead.id, input.requestFingerprint),
    limit: ANNUNCI10X_OTP_VERIFY_LIMIT,
    windowSeconds: ANNUNCI10X_OTP_VERIFY_WINDOW_SECONDS,
  });
  if (!rate.allowed) {
    throw new Annunci10xPublicError('RATE_LIMITED', 'Troppi tentativi ravvicinati. Riprova piu tardi.', 429);
  }

  const candidateHash = hashEmailVerificationCode(pepper, active.id, active.emailNormalized, code);
  const codeMatches = Boolean(active.codeHash && constantTimeHashEquals(active.codeHash, candidateHash));
  const result = await input.context.persistence.verifyEmailCode({
    sessionId: input.session.sessionId,
    sessionSecret: input.session.sessionSecret,
    verificationId: active.id,
    codeMatches,
  });

  if (result.outcome !== 'VERIFIED') {
    await input.context.persistence.appendEvent({
      sessionId: input.session.sessionId,
      eventName: 'email_verification_failed',
      metadata: { outcome: result.outcome },
    });
    const codeName = result.outcome === 'VERIFICATION_EXPIRED' ? 'VERIFICATION_EXPIRED' : 'VERIFICATION_INVALID';
    throw new Annunci10xPublicError(codeName, result.outcome === 'VERIFICATION_EXPIRED' ? 'Codice scaduto.' : 'Codice non valido.', 400);
  }

  await input.context.persistence.appendEvent({
    sessionId: input.session.sessionId,
    eventName: 'email_verified',
    metadata: { outcome: 'VERIFIED' },
  });
  const eligibility = await getAnnunci10xResultEligibility({ session: input.session, analysisRunId: input.analysisRunId ?? null, context: input.context });
  return { verified: true, resultEligible: eligibility.resultEligible, outcome: result.outcome };
}

export async function getAnnunci10xResultEligibility(input: {
  session: Annunci10xSessionCookie;
  context: Annunci10xRuntimeContext;
  analysisRunId?: string | null;
}): Promise<ResultEligibility> {
  const lead = await input.context.persistence.getLead(input.session.sessionId, input.session.sessionSecret);
  const run = input.analysisRunId
    ? await input.context.persistence.getAnalysisRun(input.analysisRunId, input.session.sessionSecret)
    : await input.context.persistence.getLatestAnalysisRun(input.session.sessionId, input.session.sessionSecret);
  const analysisReady = Boolean(run && run.status === 'READY' && run.sourceStatus === 'READY' && run.evaluationId && run.resultReference);
  const emailVerified = Boolean(lead?.emailVerifiedAt);
  return { analysisReady, emailVerified, resultEligible: analysisReady && emailVerified };
}

export function normalizeEmailAddress(value: unknown): string {
  if (typeof value !== 'string') throw new Annunci10xPublicError('INVALID_INPUT', 'Email aziendale non valida.', 400);
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || /\s/.test(email)) throw new Annunci10xPublicError('INVALID_INPUT', 'Email aziendale non valida.', 400);
  if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) throw new Annunci10xPublicError('INVALID_INPUT', 'Email aziendale non valida.', 400);
  return email;
}

export function generateSixDigitOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashEmailVerificationCode(pepper: string, verificationId: string, emailNormalized: string, code: string): string {
  return createHmac('sha256', pepper).update(`${verificationId}:${emailNormalized}:${code}`).digest('hex');
}

export function constantTimeHashEquals(expected: string, actual: string): boolean {
  const left = Buffer.from(expected, 'hex');
  const right = Buffer.from(actual, 'hex');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function normalizeLeadContact(input: SaveLeadContactInput) {
  return {
    firstName: cleanText(input.firstName, 'Nome', 80),
    lastName: cleanText(input.lastName, 'Cognome', 80),
    companyName: cleanText(input.companyName, 'Azienda', 160),
    businessRole: normalizeBusinessRole(input.businessRole),
    emailNormalized: normalizeEmailAddress(input.email),
    marketingConsent: input.marketingConsent === true,
    marketingConsentVersion: ANNUNCI10X_MARKETING_CONSENT_VERSION,
  };
}

function normalizeBusinessRole(value: unknown): Annunci10xBusinessRole {
  if (value === 'OWNER_ENTREPRENEUR' || value === 'HR' || value === 'INTERNAL_RECRUITER' || value === 'CONSULTANT' || value === 'OTHER') return value;
  throw new Annunci10xPublicError('INVALID_INPUT', 'Ruolo aziendale non valido.', 400);
}

function cleanText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string') throw new Annunci10xPublicError('INVALID_INPUT', `${label} non valido.`, 400);
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned.length > maxLength) throw new Annunci10xPublicError('INVALID_INPUT', `${label} non valido.`, 400);
  return cleaned;
}

function normalizeOtpCode(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{6}$/.test(value)) throw new Annunci10xPublicError('VERIFICATION_INVALID', 'Codice non valido.', 400);
  return value;
}

function readPepper(env: Record<string, string | undefined>): string {
  const pepper = env.ANNUNCI10X_EMAIL_VERIFICATION_PEPPER;
  if (!pepper || pepper.length < 32) throw new Annunci10xPublicError('EMAIL_VERIFICATION_UNAVAILABLE', 'Verifica email non disponibile.', 503);
  return pepper;
}

async function requireCurrentLead(context: Annunci10xRuntimeContext, session: Annunci10xSessionCookie): Promise<PersistedLead> {
  const lead = await context.persistence.getLead(session.sessionId, session.sessionSecret);
  if (!lead) throw new Annunci10xPublicError('INVALID_INPUT', 'Completa i dati di contatto prima della verifica.', 409);
  return lead;
}

function secondsUntil(iso: string): number {
  return Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 1000));
}

function remainingSeconds(fromIso: string, windowSeconds: number): number {
  return Math.max(0, Math.ceil((Date.parse(fromIso) + windowSeconds * 1000 - Date.now()) / 1000));
}

function privateSubject(scope: string, ...parts: string[]): string {
  return createHash('sha256').update([scope, ...parts].join(':')).digest('hex');
}

function boundedInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = value ? Number.parseInt(value, 10) : fallback;
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}
