import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { getAnnunci10xCatalogItem, getAnnunci10xOffer } from './commercial.ts';
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
    verificationId: string;
    recipient: string;
    code: string;
    expiresAt: string;
    firstName?: string | null;
  }): Promise<{ providerRequestId?: string | null }>;
  sendScoreReport(input: ScoreReportEmailInput): Promise<{ providerRequestId?: string | null }>;
}

interface VerificationEmailInput {
  verificationId: string;
  recipient: string;
  code: string;
  expiresAt: string;
  firstName?: string | null;
}

export interface ScoreReportEmailPriorityInput {
  checkId: string;
  label: string;
  reason: string;
  missing: string[];
}

export interface ScoreReportEmailCheckInput {
  checkId: string;
  label: string;
  score: number | null;
  status: 'EVALUATED' | 'MISSING' | 'CONFLICT' | 'UNSUPPORTED' | 'NOT_EVALUABLE';
  statusLabel: string;
  reason: string;
  improvement: string;
}

export interface ScoreReportEmailAreaInput {
  id: string;
  label: string;
  score: number | null;
  evaluatedCheckCount: number;
  totalCheckCount: number;
}

export interface ScoreReportEmailInput {
  deliveryId: string;
  analysisRunId: string;
  recipient: string;
  firstName?: string | null;
  roleTitle: string;
  score: number | null;
  band: string | null;
  coverage: number;
  evaluableCheckCount: number;
  areaScores: ScoreReportEmailAreaInput[];
  checks: ScoreReportEmailCheckInput[];
  interpretation: string;
  priorities: ScoreReportEmailPriorityInput[];
}

export class MockAnnunci10xEmailProvider implements Annunci10xEmailProvider {
  readonly kind = 'MOCK';
  readonly sent: VerificationEmailInput[] = [];
  readonly sentVerificationCodes = this.sent;
  readonly sentScoreReports: ScoreReportEmailInput[] = [];

  async sendVerificationCode(input: VerificationEmailInput): Promise<{ providerRequestId: string }> {
    if (process.env.NODE_ENV === 'production') {
      throw new Annunci10xPublicError('EMAIL_PROVIDER_UNAVAILABLE', 'Provider email non disponibile.', 503);
    }
    this.sent.push(input);
    return { providerRequestId: `mock-${this.sent.length}` };
  }

  async sendScoreReport(input: ScoreReportEmailInput): Promise<{ providerRequestId: string }> {
    if (process.env.NODE_ENV === 'production') {
      throw new Annunci10xPublicError('EMAIL_PROVIDER_UNAVAILABLE', 'Provider email non disponibile.', 503);
    }
    this.sentScoreReports.push(input);
    return { providerRequestId: `mock-score-report-${this.sentScoreReports.length}` };
  }
}

export interface ResendAnnunci10xEmailProviderConfig {
  apiKey: string;
  from: string;
  replyTo?: string | null;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class ResendAnnunci10xEmailProvider implements Annunci10xEmailProvider {
  readonly kind = 'RESEND';
  private readonly apiKey: string;
  private readonly from: string;
  private readonly replyTo: string | null;
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(config: ResendAnnunci10xEmailProviderConfig) {
    this.apiKey = config.apiKey;
    this.from = config.from;
    this.replyTo = cleanOptionalConfig(config.replyTo);
    this.endpoint = config.endpoint ?? 'https://api.resend.com/emails';
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 12_000;
    if (!this.apiKey || !this.from) throw emailProviderUnavailable();
  }

  async sendVerificationCode(input: VerificationEmailInput): Promise<{ providerRequestId?: string | null }> {
    const idempotencyKey = resendOtpIdempotencyKey(input.verificationId);
    const payload = buildResendOtpPayload({
      from: this.from,
      replyTo: this.replyTo,
      recipient: input.recipient,
      code: input.code,
      expiresAt: input.expiresAt,
      firstName: input.firstName,
    });
    return this.sendPayload(payload, idempotencyKey);
  }

  async sendScoreReport(input: ScoreReportEmailInput): Promise<{ providerRequestId?: string | null }> {
    return this.sendPayload(buildResendScoreReportPayload({
      from: this.from,
      replyTo: this.replyTo,
      ...input,
    }), resendScoreReportIdempotencyKey(input.deliveryId));
  }

  private async sendPayload(payload: Record<string, unknown>, idempotencyKey: string): Promise<{ providerRequestId?: string | null }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) throw emailProviderUnavailable();
      const data = await safeJson(response);
      return { providerRequestId: typeof data.id === 'string' ? data.id : null };
    } catch {
      throw emailProviderUnavailable();
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createAnnunci10xEmailProvider(env: Record<string, string | undefined> = process.env): Annunci10xEmailProvider {
  const configured = env.ANNUNCI10X_EMAIL_PROVIDER?.trim().toUpperCase();
  if (configured === 'RESEND') {
    const apiKey = cleanRequiredConfig(env.RESEND_API_KEY);
    const from = cleanRequiredConfig(env.ANNUNCI10X_EMAIL_FROM);
    if (!apiKey || !from) throw emailProviderUnavailable();
    return new ResendAnnunci10xEmailProvider({
      apiKey,
      from,
      replyTo: env.ANNUNCI10X_EMAIL_REPLY_TO,
    });
  }
  if (configured === 'MOCK' && env.NODE_ENV !== 'production') return new MockAnnunci10xEmailProvider();
  if (!configured && env.NODE_ENV !== 'production') return new MockAnnunci10xEmailProvider();
  throw emailProviderUnavailable();
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
    metadata: { businessRole: lead.businessRole ?? 'NOT_PROVIDED', marketingConsent: lead.marketingConsent },
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
    await provider.sendVerificationCode({ verificationId: verification.id, recipient: lead.emailNormalized, code, expiresAt, firstName: lead.firstName });
    await input.context.persistence.markEmailVerificationSent(verification.id, input.session.sessionSecret);
  } catch (error) {
    try {
      await input.context.persistence.markEmailVerificationFailed(verification.id, input.session.sessionSecret);
    } catch {
      // The provider outcome is already unsafe for this OTP; surface one controlled public error.
    }
    if (error instanceof Annunci10xPublicError) throw error;
    throw emailProviderUnavailable();
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
    companyName: cleanOptionalText(input.companyName, 'Azienda', 160),
    businessRole: normalizeOptionalBusinessRole(input.businessRole),
    emailNormalized: normalizeEmailAddress(input.email),
    marketingConsent: input.marketingConsent === true,
    marketingConsentVersion: ANNUNCI10X_MARKETING_CONSENT_VERSION,
  };
}

function normalizeOptionalBusinessRole(value: unknown): Annunci10xBusinessRole | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && !value.trim()) return null;
  if (value === 'OWNER_ENTREPRENEUR' || value === 'HR' || value === 'INTERNAL_RECRUITER' || value === 'CONSULTANT' || value === 'OTHER') return value;
  throw new Annunci10xPublicError('INVALID_INPUT', 'Ruolo aziendale non valido.', 400);
}

function cleanText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string') throw new Annunci10xPublicError('INVALID_INPUT', `${label} non valido.`, 400);
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned.length > maxLength) throw new Annunci10xPublicError('INVALID_INPUT', `${label} non valido.`, 400);
  return cleaned;
}

function cleanOptionalText(value: unknown, label: string, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Annunci10xPublicError('INVALID_INPUT', `${label} non valido.`, 400);
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  if (cleaned.length > maxLength) throw new Annunci10xPublicError('INVALID_INPUT', `${label} non valido.`, 400);
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

export function resendOtpIdempotencyKey(verificationId: string): string {
  return `annunci10x-otp/${verificationId}`;
}

export function resendScoreReportIdempotencyKey(deliveryId: string): string {
  return `annunci10x-score-report/${deliveryId}`;
}

export function buildResendOtpPayload(input: {
  from: string;
  replyTo?: string | null;
  recipient: string;
  code: string;
  expiresAt: string;
  firstName?: string | null;
}): Record<string, unknown> {
  const firstName = cleanOptionalEmailName(input.firstName);
  const greeting = firstName ? `Ciao ${firstName},` : 'Ciao,';
  const minutes = Math.max(1, Math.ceil((Date.parse(input.expiresAt) - Date.now()) / 60_000));
  const text = [
    greeting,
    '',
    'questo è il codice per visualizzare il tuo Score di chiarezza Annunci 10x:',
    '',
    input.code,
    '',
    `Il codice scade tra ${minutes} minuti.`,
    '',
    'Se non hai richiesto questa analisi, puoi ignorare questa email.',
    '',
    'Horyzon',
  ].join('\n');
  const html = [
    '<div style="font-family:Arial,sans-serif;color:#102229;line-height:1.55">',
    `<p>${escapeHtml(greeting)}</p>`,
    '<p>questo è il codice per visualizzare il tuo Score di chiarezza Annunci 10x:</p>',
    `<p style="font-size:28px;font-weight:700;letter-spacing:0.08em">${input.code}</p>`,
    `<p>Il codice scade tra ${minutes} minuti.</p>`,
    '<p>Se non hai richiesto questa analisi, puoi ignorare questa email.</p>',
    '<p>Horyzon</p>',
    '</div>',
  ].join('');
  const payload: Record<string, unknown> = {
    from: input.from,
    to: [input.recipient],
    subject: 'Il tuo codice Annunci 10x',
    html,
    text,
  };
  if (input.replyTo) payload.reply_to = input.replyTo;
  return payload;
}

export function buildResendScoreReportPayload(input: ScoreReportEmailInput & {
  from: string;
  replyTo?: string | null;
}): Record<string, unknown> {
  const firstName = cleanOptionalEmailName(input.firstName);
  const greeting = firstName ? `Ciao ${firstName},` : 'Ciao,';
  const scoreLabel = input.score === null ? 'N/D' : `${formatScoreValue(input.score)}/100`;
  const subject = input.score === null
    ? 'Il tuo report Annunci 10X è pronto'
    : `Il tuo Score Annunci 10X: ${formatScoreValue(input.score)}/100 — ecco cosa migliorare`;
  const coverageLine = input.coverage < 100
    ? `Abbiamo potuto valutare ${input.evaluableCheckCount} controlli su 20, perché nel testo mancano alcune informazioni.`
    : null;
  const disclaimer = 'Il punteggio valuta la chiarezza e la completezza delle informazioni disponibili nell’annuncio. Non prevede il numero di candidature né sostituisce la valutazione delle persone.';
  const publicBaseUrl = cleanPublicBaseUrl(process.env.ANNUNCI10X_PUBLIC_BASE_URL);
  const annunci10xUrl = publicBaseUrl ? `${publicBaseUrl}/annunci-10x` : null;
  const analysisUrl = annunci10xUrl
    ? `${annunci10xUrl}?analysis=${encodeURIComponent(input.analysisRunId)}#valuta`
    : null;
  const guideSectionUrl = publicBaseUrl ? `${publicBaseUrl}/annunci-10x#guida-annunci-10x` : null;
  const guidePreviewUrl = publicBaseUrl ? `${publicBaseUrl}/annunci-10x/annunci-10x-anteprima.pdf` : null;
  const rewriteOffer = getAnnunci10xOffer('ANNUNCI10X_REWRITE');
  const rewritePrice = formatCommercialPrice(rewriteOffer.price);
  const guide = getAnnunci10xCatalogItem('GUIDE');
  const guidePrice = '49 €';
  const guideDescription = 'La guida operativa per leggere, correggere e scrivere annunci piu chiari partendo dai fatti confermati del ruolo.';
  const areaTextLines = input.areaScores.flatMap((area) => [
    `- ${area.label}: ${formatAreaScore(area)} (${area.evaluatedCheckCount}/${area.totalCheckCount} controlli valutabili)`,
  ]);
  const priorityTextLines = input.priorities.length
    ? input.priorities.flatMap((priority, index) => [
      `${index + 1}. ${priority.label}`,
      `   Perché conta: ${priority.reason}`,
      ...(priority.missing.length ? [`   Da chiarire: ${priority.missing.join('; ')}`] : []),
      '',
    ])
    : ['Non emergono priorità specifiche dai controlli valutabili.', ''];
  const text = [
    greeting,
    '',
    `il tuo annuncio "${input.roleTitle}" ha ottenuto questo Score Annunci 10X:`,
    '',
    scoreLabel,
    input.band ?? 'Fascia non assegnata',
    '',
    input.interpretation,
    '',
    'Punteggi per area',
    ...areaTextLines,
    '',
    'Le 3 priorità su cui intervenire',
    '',
    ...priorityTextLines,
    ...(coverageLine ? [coverageLine, ''] : []),
    disclaimer,
    '',
    `${rewriteOffer.displayName} — ${rewritePrice}`,
    '1 annuncio · 1 versione · 1 canale',
    `Migliora questo annuncio — ${rewritePrice}`,
    ...(analysisUrl ? [analysisUrl, ''] : ['Riapri Annunci 10X dal sito Horyzon.', '']),
    `${guide.displayName} — ${guidePrice}`,
    guideDescription,
    `Scopri la Guida Annunci 10X — ${guidePrice}`,
    ...(guideSectionUrl ? [guideSectionUrl] : ['Riapri la sezione Guida Annunci 10X dal sito Horyzon.']),
    'Anteprima',
    ...(guidePreviewUrl ? [guidePreviewUrl, ''] : ['']),
    'Horyzon',
    'Annunci 10X',
  ].join('\n');
  const areaHtml = input.areaScores.map((area) => [
    '<tr>',
    `<td style="padding:12px 0;border-bottom:1px solid #dce4d3"><strong>${escapeHtml(area.label)}</strong><div style="font-size:13px;color:#5c6a60">${area.evaluatedCheckCount}/${area.totalCheckCount} controlli valutabili</div></td>`,
    `<td align="right" style="padding:12px 0;border-bottom:1px solid #dce4d3;font-weight:700">${escapeHtml(formatAreaScore(area))}</td>`,
    '</tr>',
  ].join('')).join('');
  const priorityHtml = input.priorities.map((priority) => [
    '<li style="margin-bottom:14px">',
    `<strong>${escapeHtml(priority.label)}</strong>`,
    `<div><strong>Perché conta:</strong> ${escapeHtml(priority.reason)}</div>`,
    priority.missing.length
      ? `<div><strong>Da chiarire:</strong> ${escapeHtml(priority.missing.join('; '))}</div>`
      : '',
    '</li>',
  ].join('')).join('');
  const prioritySectionHtml = priorityHtml
    ? `<ol style="padding-left:22px;margin:0">${priorityHtml}</ol>`
    : '<p style="margin:0">Non emergono priorità specifiche dai controlli valutabili.</p>';
  const rewriteButton = analysisUrl
    ? `<a href="${escapeHtml(analysisUrl)}" style="display:inline-block;background:#c8f531;color:#102229;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:6px">Migliora questo annuncio — ${escapeHtml(rewritePrice)}</a>`
    : `<strong>Migliora questo annuncio — ${escapeHtml(rewritePrice)}</strong>`;
  const guideButton = guideSectionUrl
    ? `<a href="${escapeHtml(guideSectionUrl)}" style="display:inline-block;background:#c8f531;color:#102229;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:6px">Scopri la Guida Annunci 10X — ${escapeHtml(guidePrice)}</a>`
    : `<strong>Scopri la Guida Annunci 10X — ${escapeHtml(guidePrice)}</strong>`;
  const guidePreviewButton = guidePreviewUrl
    ? `<a href="${escapeHtml(guidePreviewUrl)}" style="display:inline-block;color:#102229;font-weight:700;margin-left:12px">Anteprima</a>`
    : '';
  const html = [
    '<!doctype html>',
    '<html lang="it" dir="ltr">',
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Il tuo report Annunci 10X</title></head>',
    '<body style="margin:0;background:#07171d;padding:24px 12px;font-family:Arial,sans-serif;color:#102229">',
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0">Il tuo mini-report Annunci 10X con score, aree e priorità.</div>',
    '<main style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dce4d3;border-radius:8px;overflow:hidden">',
    '<section style="background:#102229;color:#ffffff;padding:28px 28px 24px">',
    '<div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#c8f531;font-weight:700">Annunci 10X</div>',
    '<h1 style="font-size:26px;line-height:1.2;margin:10px 0 10px">Il tuo Score Annunci 10X</h1>',
    `<p style="margin:0 0 8px;color:#ffffff"><strong>Annuncio:</strong> ${escapeHtml(input.roleTitle)}</p>`,
    `<p style="margin:0;color:#dce4d3">${escapeHtml(greeting)} ecco la lettura sintetica dell’analisi V2.</p>`,
    '</section>',
    '<section style="padding:28px">',
    `<div style="font-size:42px;line-height:1;font-weight:800;margin:0 0 6px">${escapeHtml(scoreLabel)}</div>`,
    `<div style="font-size:18px;font-weight:700;margin-bottom:14px">${escapeHtml(input.band ?? 'Fascia non assegnata')}</div>`,
    `<p style="margin:0 0 22px;line-height:1.55">${escapeHtml(input.interpretation)}</p>`,
    '<h2 style="font-size:18px;margin:0 0 12px">Punteggi per area</h2>',
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-bottom:24px">${areaHtml}</table>`,
    '<h2 style="font-size:18px;margin:0 0 12px">Le 3 priorità su cui intervenire</h2>',
    prioritySectionHtml,
    coverageLine ? `<p style="margin:18px 0 0;color:#5c6a60">${escapeHtml(coverageLine)}</p>` : '',
    `<p style="margin:22px 0 0;color:#5c6a60;font-size:13px;line-height:1.5">${escapeHtml(disclaimer)}</p>`,
    '</section>',
    '<section style="padding:24px 28px;background:#f4f7ef;border-top:1px solid #dce4d3">',
    `<h2 style="font-size:18px;margin:0 0 8px">${escapeHtml(rewriteOffer.displayName)} — ${escapeHtml(rewritePrice)}</h2>`,
    '<p style="margin:0 0 16px;line-height:1.5">1 annuncio · 1 versione · 1 canale. Puoi riaprire Annunci 10X e procedere dal flusso esistente.</p>',
    `<p style="margin:0 0 22px">${rewriteButton}</p>`,
    `<h2 style="font-size:18px;margin:0 0 8px">${escapeHtml(guide.displayName)} — ${escapeHtml(guidePrice)}</h2>`,
    `<p style="margin:0 0 16px;line-height:1.5">${escapeHtml(guideDescription)}</p>`,
    `<p style="margin:0">${guideButton}${guidePreviewButton}</p>`,
    '</section>',
    '<footer style="padding:20px 28px;color:#5c6a60;font-size:13px">Horyzon<br>Annunci 10X</footer>',
    '</main>',
    '</body>',
    '</html>',
  ].join('');
  const payload: Record<string, unknown> = {
    from: input.from,
    to: [input.recipient],
    subject,
    html,
    text,
  };
  if (input.replyTo) payload.reply_to = input.replyTo;
  return payload;
}

function formatAreaScore(area: ScoreReportEmailAreaInput): string {
  return area.score === null ? 'N/D' : `${formatScoreValue(area.score)}/100`;
}

function formatCommercialPrice(price: { amountCents: number; currency: string }): string {
  if (price.currency !== 'EUR') return `${(price.amountCents / 100).toFixed(2)} ${price.currency}`;
  const euros = price.amountCents / 100;
  const amount = Number.isInteger(euros)
    ? String(euros)
    : euros.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${amount} €`;
}

function cleanRequiredConfig(value: string | undefined): string {
  return value?.trim() ?? '';
}

function cleanOptionalConfig(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned || null;
}

function cleanOptionalEmailName(value: string | null | undefined): string | null {
  const cleaned = value?.replace(/\s+/g, ' ').trim();
  return cleaned || null;
}

function cleanPublicBaseUrl(value: string | undefined): string | null {
  const cleaned = value?.trim().replace(/\/+$/, '');
  if (!cleaned || !/^https?:\/\/[^/\s]+/i.test(cleaned)) return null;
  return cleaned;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatScoreValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

async function safeJson(response: Response): Promise<{ id?: unknown }> {
  try {
    const parsed = await response.json();
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as { id?: unknown } : {};
  } catch {
    return {};
  }
}

function emailProviderUnavailable(): Annunci10xPublicError {
  return new Annunci10xPublicError('EMAIL_PROVIDER_UNAVAILABLE', 'Provider email non disponibile.', 503);
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
