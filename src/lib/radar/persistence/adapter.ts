import { randomUUID } from 'node:crypto';
import { isRadarComplete, radarSteps } from '../domain.ts';
import { validOwnerEconomicsAnswer } from '../owner-economics.ts';
import { RADAR_QUESTIONNAIRE_VERSION, type RadarAnswers, type RadarJourneyStatus } from '../types.ts';
import { createOwnerSecret } from './security.ts';
import type { RadarAccessEventInput, RadarAdviceRow, RadarReportOwnerContext, RadarOwnedSession, RadarOwnership, RadarPersistence, RadarProgressProjection, RadarQualificationInput, RadarResumeProjection, RadarStaffRecord, SaveRadarAnswerInput } from './types.ts';

function validateAnswer(input: SaveRadarAnswerInput): void {
  if (!radarSteps().some((step) => step.id === input.answerKey)) throw new Error('Invalid Radar answer key.');
  if (input.answerKey.startsWith('economia#') && !validOwnerEconomicsAnswer(input.answerKey, input.value)) throw new Error('Invalid Radar economic answer.');
}

type MemoryRow = RadarQualificationInput & RadarResumeProjection & { ownerSecretHash: string };

export class RadarNotFoundError extends Error {
  constructor() { super('Radar assessment not found.'); this.name = 'RadarNotFoundError'; }
}

export class RadarRevisionConflictError extends Error {
  constructor() { super('Radar revision conflict.'); this.name = 'RadarRevisionConflictError'; }
}

class MemoryRadarPersistence implements RadarPersistence {
  private readonly rows = new Map<string, MemoryRow>();
  private readonly accessEvents: Array<RadarAccessEventInput & { createdAt: number }> = [];

  async createAssessment(input: RadarQualificationInput): Promise<RadarOwnedSession> {
    const id = randomUUID();
    const owner = createOwnerSecret();
    this.rows.set(id, { ...input, id, questionnaireVersion: RADAR_QUESTIONNAIRE_VERSION, ownerSecretHash: owner.secretHash, status: 'STARTED', answers: { 'qualificazione#stagionale': input.seasonal ? 1 : 0 }, revision: 0, currentStep: 0, answeredCount: 1, progressPercent: 3 });
    return { id, ownerSecret: owner.secret, ownerSecretHash: owner.secretHash, revision: 0 };
  }

  async resumeAssessment(input: RadarOwnership): Promise<RadarResumeProjection> {
    const row = this.owned(input);
    return project(row);
  }

  async saveAnswer(input: SaveRadarAnswerInput): Promise<RadarProgressProjection> {
    validateAnswer(input);
    const row = this.owned(input);
    if (row.revision !== input.expectedRevision) throw new RadarRevisionConflictError();
    row.answers = { ...row.answers, [input.answerKey]: input.value };
    row.revision += 1;
    row.currentStep = Math.max(row.currentStep, Math.min(radarSteps(row.questionnaireVersion).length, input.currentStep));
    row.answeredCount = Object.keys(row.answers).length;
    row.progressPercent = Math.min(100, Math.round((row.answeredCount / radarSteps(row.questionnaireVersion).length) * 100));
    row.status = 'IN_PROGRESS';
    return progress(row);
  }

  async completeAssessment(input: RadarOwnership): Promise<RadarResumeProjection> {
    const row = this.owned(input);
    if (!isRadarComplete(row.answers, row.questionnaireVersion)) throw new Error('Radar is not complete.');
    row.status = 'PAYMENT_REQUIRED';
    row.currentStep = radarSteps(row.questionnaireVersion).length;
    row.progressPercent = 100;
    return project(row);
  }

  async appendAccessEvent(input: RadarAccessEventInput): Promise<void> { this.accessEvents.push({ ...input, createdAt: Date.now() }); }
  async countRecentPreviewDenials(assessmentId: string): Promise<number> {
    const threshold = Date.now() - 10 * 60_000;
    return this.accessEvents.filter((event) => event.assessmentId === assessmentId && event.eventType === 'PREVIEW_DENIED' && event.createdAt >= threshold).length;
  }

  async readReportContext(input: RadarOwnership): Promise<RadarReportOwnerContext> {
    const row = this.owned(input);
    return { aziendaNome: row.aziendaNome, referenteNome: row.referenteNome, referenteEmail: row.referenteEmail, referenteTelefono: row.referenteTelefono, settore: row.settore, numeroDipendenti: row.numeroDipendenti, volumeAffari: row.volumeAffari, completedAt: null };
  }

  readonly advice: RadarAdviceRow[] = [];
  async listAdvice(): Promise<RadarAdviceRow[]> { return this.advice; }

  private readonly emailed = new Set<string>();
  async claimReportEmail(assessmentId: string): Promise<boolean> {
    if (this.emailed.has(assessmentId)) return false;
    this.emailed.add(assessmentId);
    return true;
  }

  async markCompletedFree(input: RadarOwnership): Promise<void> {
    const row = this.owned(input);
    if (!isRadarComplete(row.answers, row.questionnaireVersion)) throw new Error('Radar is not complete.');
    row.status = 'COMPLETED';
  }

  async readStaffRecord(assessmentId: string): Promise<RadarStaffRecord> {
    const row = this.rows.get(assessmentId);
    if (!row) throw new RadarNotFoundError();
    return { id: row.id, questionnaireVersion: row.questionnaireVersion, status: row.status, answers: structuredClone(row.answers), context: { aziendaNome: row.aziendaNome, referenteNome: row.referenteNome, referenteEmail: row.referenteEmail, referenteTelefono: row.referenteTelefono, settore: row.settore, numeroDipendenti: row.numeroDipendenti, volumeAffari: row.volumeAffari, completedAt: null } };
  }

  private owned(input: RadarOwnership): MemoryRow {
    const row = this.rows.get(input.assessmentId);
    if (!row || row.ownerSecretHash !== input.ownerSecretHash) throw new Error('Radar ownership verification failed.');
    return row;
  }
}

export function createMemoryRadarPersistence(): RadarPersistence {
  return new MemoryRadarPersistence();
}

export class SupabaseRadarPersistence implements RadarPersistence {
  private readonly config: { url: string; serviceRoleKey: string; fetchImpl?: typeof fetch };

  constructor(config: { url: string; serviceRoleKey: string; fetchImpl?: typeof fetch }) {
    this.config = config;
  }

  async createAssessment(input: RadarQualificationInput): Promise<RadarOwnedSession> {
    const owner = createOwnerSecret();
    const rows = await this.request<Record<string, unknown>[]>('/rest/v1/radar_assessments?select=id,revision', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        azienda_nome: input.aziendaNome,
        referente_nome: input.referenteNome,
        referente_email: input.referenteEmail,
        referente_telefono: input.referenteTelefono,
        settore: input.settore,
        volume_affari: input.volumeAffari,
        numero_dipendenti: input.numeroDipendenti,
        token: randomUUID().replaceAll('-', ''),
        owner_secret_hash: owner.secretHash,
        questionnaire_version: RADAR_QUESTIONNAIRE_VERSION,
        risposte: { 'qualificazione#stagionale': input.seasonal ? 1 : 0 },
        answered_count: 1,
        progress_percent: 3,
      }),
    });
    const row = rows[0];
    if (!row || typeof row.id !== 'string') throw new Error('Radar database create failed.');
    return { id: row.id, ownerSecret: owner.secret, ownerSecretHash: owner.secretHash, revision: Number(row.revision ?? 0) };
  }

  async resumeAssessment(input: RadarOwnership): Promise<RadarResumeProjection> {
    const query = `/rest/v1/radar_assessments?id=eq.${encodeURIComponent(input.assessmentId)}&owner_secret_hash=eq.${encodeURIComponent(input.ownerSecretHash)}&select=id,questionnaire_version,journey_status,risposte,revision,current_step,answered_count,progress_percent`;
    const rows = await this.request<Record<string, unknown>[]>(query, { method: 'GET' });
    const row = rows[0];
    if (!row) throw new Error('Radar ownership verification failed.');
    return {
      questionnaireVersion: String(row.questionnaire_version ?? 'radar-v1'), id: String(row.id), status: row.journey_status as RadarJourneyStatus,
      answers: (row.risposte ?? {}) as RadarAnswers, revision: Number(row.revision),
      currentStep: Number(row.current_step), answeredCount: Number(row.answered_count), progressPercent: Number(row.progress_percent),
    };
  }

  async saveAnswer(input: SaveRadarAnswerInput): Promise<RadarProgressProjection> {
    validateAnswer(input);
    try {
      return await this.request<RadarProgressProjection>('/rest/v1/rpc/radar_save_answer', { method: 'POST', body: JSON.stringify({ p_assessment_id: input.assessmentId, p_owner_secret_hash: input.ownerSecretHash, p_answer_key: input.answerKey, p_answer_value: input.value, p_expected_revision: input.expectedRevision, p_current_step: input.currentStep }) });
    } catch (error) {
      if (error instanceof Error && error.message.includes('revision conflict')) throw new RadarRevisionConflictError();
      throw error;
    }
  }

  async completeAssessment(input: RadarOwnership): Promise<RadarResumeProjection> {
    return this.request<RadarResumeProjection>('/rest/v1/rpc/radar_complete_assessment', { method: 'POST', body: JSON.stringify({ p_assessment_id: input.assessmentId, p_owner_secret_hash: input.ownerSecretHash }) });
  }

  async appendAccessEvent(input: RadarAccessEventInput): Promise<void> {
    await this.request('/rest/v1/radar_access_events', { method: 'POST', body: JSON.stringify({ assessment_id: input.assessmentId, access_source: input.accessSource, event_type: input.eventType }) });
  }

  async countRecentPreviewDenials(assessmentId: string): Promise<number> {
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const rows = await this.request<Array<{ id: string }>>(`/rest/v1/radar_access_events?assessment_id=eq.${encodeURIComponent(assessmentId)}&access_source=eq.PREVIEW&event_type=eq.PREVIEW_DENIED&created_at=gte.${encodeURIComponent(since)}&select=id`, { method: 'GET' });
    return rows.length;
  }

  async readReportContext(input: RadarOwnership): Promise<RadarReportOwnerContext> {
    const rows = await this.request<Record<string, unknown>[]>(`/rest/v1/radar_assessments?id=eq.${encodeURIComponent(input.assessmentId)}&owner_secret_hash=eq.${encodeURIComponent(input.ownerSecretHash)}&select=azienda_nome,referente_nome,referente_email,referente_telefono,settore,numero_dipendenti,volume_affari,completato_il,payment_gate_at`, { method: 'GET' });
    const row = rows[0];
    if (!row) throw new Error('Radar ownership verification failed.');
    const text = (value: unknown) => typeof value === 'string' ? value : '';
    return { aziendaNome: text(row.azienda_nome), referenteNome: text(row.referente_nome), referenteEmail: text(row.referente_email), referenteTelefono: text(row.referente_telefono), settore: text(row.settore), numeroDipendenti: text(row.numero_dipendenti), volumeAffari: text(row.volume_affari), completedAt: text(row.completato_il) || text(row.payment_gate_at) || null };
  }

  async listAdvice(): Promise<RadarAdviceRow[]> {
    return this.request<RadarAdviceRow[]>('/rest/v1/radar_advice?select=kind,subject,band,title,body,action', { method: 'GET' });
  }

  async claimReportEmail(assessmentId: string): Promise<boolean> {
    const rows = await this.request<unknown[]>(`/rest/v1/radar_assessments?id=eq.${encodeURIComponent(assessmentId)}&report_emailed_at=is.null&select=id`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ report_emailed_at: new Date().toISOString() }) });
    return Array.isArray(rows) && rows.length > 0;
  }

  // The Hub reads `stato` and `completato_il` (its own quiz wrote them), so a free completion fills them too.
  async markCompletedFree(input: RadarOwnership): Promise<void> {
    const now = new Date().toISOString();
    const rows = await this.request<unknown[]>(`/rest/v1/radar_assessments?id=eq.${encodeURIComponent(input.assessmentId)}&owner_secret_hash=eq.${encodeURIComponent(input.ownerSecretHash)}&journey_status=in.(PAYMENT_REQUIRED,COMPLETED)&select=id`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ journey_status: 'COMPLETED', stato: 'completato', completato_il: now, result_unlocked_at: now, last_activity_at: now }) });
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('Radar free completion failed.');
  }

  async readStaffRecord(assessmentId: string): Promise<RadarStaffRecord> {
    const rows = await this.request<Record<string, unknown>[]>(`/rest/v1/radar_assessments?id=eq.${encodeURIComponent(assessmentId)}&select=id,questionnaire_version,journey_status,risposte,azienda_nome,referente_nome,referente_email,referente_telefono,settore,numero_dipendenti,volume_affari,completato_il,payment_gate_at`, { method: 'GET' });
    const row = rows[0];
    if (!row) throw new RadarNotFoundError();
    const text = (value: unknown) => typeof value === 'string' ? value : '';
    return {
      id: String(row.id), questionnaireVersion: String(row.questionnaire_version ?? 'radar-v1'), status: row.journey_status as RadarJourneyStatus, answers: (row.risposte ?? {}) as RadarAnswers,
      context: { aziendaNome: text(row.azienda_nome), referenteNome: text(row.referente_nome), referenteEmail: text(row.referente_email), referenteTelefono: text(row.referente_telefono), settore: text(row.settore), numeroDipendenti: text(row.numero_dipendenti), volumeAffari: text(row.volume_affari), completedAt: text(row.completato_il) || text(row.payment_gate_at) || null },
    };
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await (this.config.fetchImpl ?? fetch)(`${this.config.url.replace(/\/$/, '')}${path}`, { ...init, headers: { apikey: this.config.serviceRoleKey, Authorization: `Bearer ${this.config.serviceRoleKey}`, 'Content-Type': 'application/json', 'Accept-Profile': 'hub', 'Content-Profile': 'hub', ...(init.headers ?? {}) } });
    if (!response.ok) throw new Error(`Radar database error: ${await response.text()}`);
    // Inserts come back as 201 with an empty body.
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
}

export function createRadarPersistence(env: Record<string, string | undefined> = process.env): RadarPersistence {
  const url = (env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) throw new Error('Radar persistence is not configured.');
  return new SupabaseRadarPersistence({ url, serviceRoleKey });
}

function project(row: MemoryRow): RadarResumeProjection {
  return { questionnaireVersion: row.questionnaireVersion, id: row.id, status: row.status, answers: structuredClone(row.answers), revision: row.revision, currentStep: row.currentStep, answeredCount: row.answeredCount, progressPercent: row.progressPercent };
}

function progress(row: MemoryRow): RadarProgressProjection {
  return { revision: row.revision, currentStep: row.currentStep, answeredCount: row.answeredCount, progressPercent: row.progressPercent };
}
