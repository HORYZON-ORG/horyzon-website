import { randomInt, randomUUID } from 'node:crypto';
import { question, QUESTION_IDS } from '../patrimonial-radar/catalog.ts';
import { recordAnswer, resolveAnswers, ordinaryRoute, value } from '../patrimonial-radar/answers.ts';
import { validateValue } from '../patrimonial-radar/validation.ts';
import { diagnose } from '../patrimonial-radar/result.ts';
import { VERSIONS } from '../patrimonial-radar/versions.ts';
import type { AnswerState, QuestionId } from '../patrimonial-radar/types.ts';
import { BACKEND_VERSION, SERVICE_NOTICE_VERSION, RadarBackendError, type Assessment, type EntryMode, type RadarRpc, type SavedAnswer, type RadarEmailProvider, type Snapshot, type VerifiedSession } from './contracts.ts';
import { canonical, contentHash, normalizeEmail, object, opaqueToken, RadarSecrets, revision, validToken, validUuid } from './security.ts';

export class PatrimonialRadarService {
  readonly secrets: RadarSecrets;
  private readonly retentionReviewDays: number | null;
  private readonly rpc: RadarRpc;
  private readonly email: RadarEmailProvider;
  constructor(rpc: RadarRpc, email: RadarEmailProvider, secret: string, options: { retentionReviewDays?: number } = {}) {
    if (typeof window !== 'undefined' || !['SIMULATED','RESEND'].includes(email.kind)) throw new RadarBackendError('UNAVAILABLE');
    this.secrets = new RadarSecrets(secret);
    this.rpc = rpc; this.email = email;
    const days = options.retentionReviewDays;
    if (days !== undefined && (!Number.isSafeInteger(days) || days < 1 || days > 3650)) throw new RadarBackendError('UNAVAILABLE');
    this.retentionReviewDays = days ?? null;
  }
  private invoke<T>(method: string, args: Record<string, unknown>): Promise<T> { return this.rpc.invoke<T>({ contract: BACKEND_VERSION, keyBinding: this.secrets.hash('store-binding-v1', BACKEND_VERSION), method, ...args }); }
  private sessionHash(token: string) {
    if (!validToken(token)) throw new RadarBackendError('UNAUTHENTICATED');
    return this.secrets.hash('session-v1', token);
  }
  private uuid(value: unknown): string { if (!validUuid(value)) throw new RadarBackendError('INVALID'); return value.toLowerCase(); }
  async requestCode(emailInput: unknown, trustedNetworkKey: string) {
    const email = normalizeEmail(emailInput), emailKey = this.secrets.hash('email-v1', email);
    const id = randomUUID(), binding = opaqueToken(), code = String(randomInt(0, 100_000_000)).padStart(8, '0');
    const accepted = await this.invoke<boolean>('request_code', {
      id, emailKey, bindingHash: this.secrets.hash('binding-v1', binding), codeHash: this.secrets.hash('otp-v1', id, code),
      networkKey: this.secrets.hash('network-v1', trustedNetworkKey),
    });
    if (accepted) {
      try {
        await this.email.sendCode({ email, code, expiresInSeconds: 600, challengeId: id });
        await this.invoke('delivery', { id, bindingHash: this.secrets.hash('binding-v1', binding), sent: true });
      } catch {
        try { await this.invoke('delivery', { id, bindingHash: this.secrets.hash('binding-v1', binding), sent: false }); } catch { /* No transport details or codes leave the server. */ }
      }
    }
    // Identical response for existing/new addresses, throttling and delivery failures.
    return { challengeId: id, binding, csrf: this.secrets.csrf(binding), message: 'Se la richiesta può essere elaborata, riceverai un codice temporaneo.' };
  }
  async verifyCode(raw: unknown, binding: string, csrf: unknown, trustedNetworkKey: string) {
    if (!this.secrets.checkCsrf(binding, csrf)) throw new RadarBackendError('FORBIDDEN');
    const body = object(raw, ['challengeId', 'code']), id = this.uuid(body.challengeId);
    if (typeof body.code !== 'string' || !/^\d{8}$/.test(body.code)) throw new RadarBackendError('UNAUTHENTICATED');
    const token = opaqueToken();
    const session = await this.invoke<VerifiedSession>('verify_code', {
      id, bindingHash: this.secrets.hash('binding-v1', binding), codeHash: this.secrets.hash('otp-v1', id, body.code),
      sessionHash: this.sessionHash(token), personId: randomUUID(), networkKey: this.secrets.hash('verify-network-v1', trustedNetworkKey), retentionReviewDays: this.retentionReviewDays,
    });
    return { ...session, token, csrf: this.secrets.csrf(token) };
  }
  async session(token: string): Promise<VerifiedSession> { return this.invoke('session', { sessionHash: this.sessionHash(token) }); }
  async revoke(token: string, allDevices = false): Promise<void> { await this.invoke('revoke', { sessionHash: this.sessionHash(token), allDevices }); }
  async create(token: string, raw: unknown): Promise<{ id: string; revision: number; replay: boolean }> {
    const body = object(raw, ['requestId', 'entryMode','noticeVersion']);
    if(body.noticeVersion!==undefined&&body.noticeVersion!==SERVICE_NOTICE_VERSION)throw new RadarBackendError('INVALID');
    const requestId = this.uuid(body.requestId), entryMode = (body.entryMode ?? 'DIRECT') as EntryMode;
    if (!['DIRECT', 'EVENT', 'POST_EVENT'].includes(entryMode)) throw new RadarBackendError('INVALID');
    return this.invoke('create', { sessionHash: this.sessionHash(token), id: randomUUID(), requestId, entryMode, versions: VERSIONS, payloadHash: contentHash({ entryMode, versions: VERSIONS,...(body.noticeVersion?{noticeVersion:body.noticeVersion}:{}) }), retentionReviewDays: this.retentionReviewDays,...(body.noticeVersion?{noticeVersion:body.noticeVersion}:{}) });
  }
  async read(token: string, idInput: unknown): Promise<Assessment> {
    return this.invoke('read', { sessionHash: this.sessionHash(token), id: this.uuid(idInput) });
  }
  async acknowledgeNotice(token:string,id:unknown,raw:unknown){
    const body=object(raw,['noticeVersion']);if(body.noticeVersion!==SERVICE_NOTICE_VERSION)throw new RadarBackendError('INVALID');
    return this.invoke('acknowledge_notice',{sessionHash:this.sessionHash(token),id:this.uuid(id),noticeVersion:SERVICE_NOTICE_VERSION});
  }
  async resume(token: string, id: unknown) {
    const assessment = await this.read(token, id); this.currentVersion(assessment);
    const resolved = resolveAnswers(assessment.input);
    return { assessment, resolved, ordinaryRoute: ordinaryRoute(resolved) };
  }
  private currentVersion(assessment: Assessment) {
    if (canonical(assessment.versions) !== canonical(VERSIONS)) throw new RadarBackendError('VERSION_MISMATCH');
  }
  async save(token: string, id: unknown, raw: unknown): Promise<SavedAnswer> {
    const body = object(raw, ['requestId', 'expectedRevision', 'questionId', 'state', 'value']);
    const requestId = this.uuid(body.requestId), expectedRevision = revision(body.expectedRevision);
    if (!QUESTION_IDS.includes(body.questionId as QuestionId) || !['VALUE', 'UNKNOWN', 'DECLINED', 'UNANSWERED'].includes(String(body.state)) || (body.state !== 'VALUE' && body.value !== undefined)) throw new RadarBackendError('INVALID');
    const qid = body.questionId as QuestionId, state = body.state as AnswerState;
    if (state === 'VALUE' && validateValue(qid, body.value).length) throw new RadarBackendError('INVALID');
    const assessment = await this.read(token, id); this.currentVersion(assessment);
    const payloadHash = contentHash(body);
    // Replay is checked by the DB before revision/status checks, including after a lost response.
    const replay = await this.invoke<SavedAnswer | null>('receipt', { sessionHash: this.sessionHash(token), id: assessment.id, requestId, payloadHash, kind: 'ANSWER' });
    if (replay) return replay;
    if (assessment.status !== 'DRAFT' || assessment.revision !== expectedRevision) throw new RadarBackendError('CONFLICT');
    const resolved = resolveAnswers(assessment.input);
    if (resolved[qid].applicability === 'NOT_APPLICABLE') throw new RadarBackendError('INVALID');
    const inspectMoney = (item: unknown): void => {
      if (!item || typeof item !== 'object') return;
      if ('currency' in item && item.currency === 'EUR' && (!('asOf' in item) || item.asOf !== assessment.input.asOf || !('scope' in item) || item.scope !== value(resolved, 'RP-S01'))) throw new RadarBackendError('INVALID');
      Object.values(item).forEach(inspectMoney);
    };
    if (state === 'VALUE') inspectMoney(body.value);
    const next = recordAnswer(assessment.input, qid, state, body.value, question(qid).version);
    if (resolveAnswers(next)[qid].issues.length) throw new RadarBackendError('INVALID');
    const previous = assessment.input.answers.filter(a => a.id === qid).at(-1);
    const unchanged = previous && resolved[qid].lifecycle === 'ACTIVE' && previous.state === state && (state !== 'VALUE' || canonical(previous.value) === canonical(body.value));
    return this.invoke('save', { sessionHash: this.sessionHash(token), id: assessment.id, requestId, expectedRevision, payloadHash, answer: unchanged ? null : next.answers.at(-1), questionId: qid, versions: VERSIONS });
  }
  async complete(token: string, id: unknown, raw: unknown): Promise<Snapshot> {
    const body = object(raw, ['requestId', 'expectedRevision']), requestId = this.uuid(body.requestId), expectedRevision = revision(body.expectedRevision);
    const assessment = await this.read(token, id); this.currentVersion(assessment);
    if (assessment.status === 'COMPLETED') {
      const snapshot = await this.snapshot(token, assessment.id);
      if (snapshot.approvedRevision !== expectedRevision) throw new RadarBackendError('CONFLICT');
      return snapshot;
    }
    if (assessment.revision !== expectedRevision) throw new RadarBackendError('CONFLICT');
    const resolved = resolveAnswers(assessment.input);
    // Explicit missing/declined answers are valid. Stale/never confirmed ordinary data are not silently approved.
    if (ordinaryRoute(resolved).some(qid => !resolved[qid].ref || resolved[qid].lifecycle === 'RECONFIRM' || resolved[qid].issues.length)) throw new RadarBackendError('INCOMPLETE');
    const result = diagnose(assessment.input);
    const answerRefs = assessment.input.answers.map(({ id, revision, questionVersion, asOf }) => ({ id, revision, questionVersion, asOf }));
    return this.invoke('complete', {
      sessionHash: this.sessionHash(token), id: assessment.id, requestId, expectedRevision, versions: VERSIONS, snapshotId: randomUUID(),
      inputHash: contentHash(assessment.input), resultHash: contentHash(result), result, answerRefs,
    });
  }
  async snapshot(token: string, id: unknown): Promise<Snapshot> { return this.invoke('snapshot', { sessionHash: this.sessionHash(token), id: this.uuid(id) }); }
  async history(token: string): Promise<{ id: string; revision: number; status: string; createdAt: string; updatedAt: string }[]> { return this.invoke('history', { sessionHash: this.sessionHash(token) }); }
}
