import { randomUUID } from 'node:crypto';
import { RADAR_QUESTIONNAIRE_VERSION, type RadarAnswers, type RadarJourneyStatus } from '../types.ts';
import { createOwnerSecret } from './security.ts';
import type { RadarOwnedSession, RadarOwnership, RadarPersistence, RadarProgressProjection, RadarQualificationInput, RadarResumeProjection, SaveRadarAnswerInput } from './types.ts';

const ANSWER_KEY = /^(amministrazione|produzione|commerciale|marketing|risorse-umane)#[0-4]$|^qualificazione#stagionale$|^ai#(uso|leva|pronti|casoUso)$/;

type MemoryRow = RadarQualificationInput & RadarResumeProjection & { ownerSecretHash: string };

export class RadarRevisionConflictError extends Error {
  constructor() { super('Radar revision conflict.'); this.name = 'RadarRevisionConflictError'; }
}

class MemoryRadarPersistence implements RadarPersistence {
  private readonly rows = new Map<string, MemoryRow>();

  async createAssessment(input: RadarQualificationInput): Promise<RadarOwnedSession> {
    const id = randomUUID();
    const owner = createOwnerSecret();
    this.rows.set(id, { ...input, id, ownerSecretHash: owner.secretHash, status: 'STARTED', answers: { 'qualificazione#stagionale': input.seasonal ? 1 : 0 }, revision: 0, currentStep: 0, answeredCount: 1, progressPercent: 3 });
    return { id, ownerSecret: owner.secret, ownerSecretHash: owner.secretHash, revision: 0 };
  }

  async resumeAssessment(input: RadarOwnership): Promise<RadarResumeProjection> {
    const row = this.owned(input);
    return project(row);
  }

  async saveAnswer(input: SaveRadarAnswerInput): Promise<RadarProgressProjection> {
    if (!ANSWER_KEY.test(input.answerKey)) throw new Error('Invalid Radar answer key.');
    const row = this.owned(input);
    if (row.revision !== input.expectedRevision) throw new RadarRevisionConflictError();
    row.answers = { ...row.answers, [input.answerKey]: input.value };
    row.revision += 1;
    row.currentStep = Math.max(row.currentStep, Math.min(30, input.currentStep));
    row.answeredCount = Object.keys(row.answers).length;
    row.progressPercent = Math.min(100, Math.round((row.answeredCount / 30) * 100));
    row.status = 'IN_PROGRESS';
    return progress(row);
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
    const query = `/rest/v1/radar_assessments?id=eq.${encodeURIComponent(input.assessmentId)}&owner_secret_hash=eq.${encodeURIComponent(input.ownerSecretHash)}&select=id,journey_status,risposte,revision,current_step,answered_count,progress_percent`;
    const rows = await this.request<Record<string, unknown>[]>(query, { method: 'GET' });
    const row = rows[0];
    if (!row) throw new Error('Radar ownership verification failed.');
    return {
      id: String(row.id), status: row.journey_status as RadarJourneyStatus,
      answers: (row.risposte ?? {}) as RadarAnswers, revision: Number(row.revision),
      currentStep: Number(row.current_step), answeredCount: Number(row.answered_count), progressPercent: Number(row.progress_percent),
    };
  }

  async saveAnswer(input: SaveRadarAnswerInput): Promise<RadarProgressProjection> {
    if (!ANSWER_KEY.test(input.answerKey)) throw new Error('Invalid Radar answer key.');
    try {
      return await this.request<RadarProgressProjection>('/rest/v1/rpc/radar_save_answer', { method: 'POST', body: JSON.stringify({ p_assessment_id: input.assessmentId, p_owner_secret_hash: input.ownerSecretHash, p_answer_key: input.answerKey, p_answer_value: input.value, p_expected_revision: input.expectedRevision, p_current_step: input.currentStep }) });
    } catch (error) {
      if (error instanceof Error && error.message.includes('revision conflict')) throw new RadarRevisionConflictError();
      throw error;
    }
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await (this.config.fetchImpl ?? fetch)(`${this.config.url.replace(/\/$/, '')}${path}`, { ...init, headers: { apikey: this.config.serviceRoleKey, Authorization: `Bearer ${this.config.serviceRoleKey}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
    if (!response.ok) throw new Error(`Radar database error: ${await response.text()}`);
    return response.json() as Promise<T>;
  }
}

export function createRadarPersistence(env: Record<string, string | undefined> = process.env): RadarPersistence {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) throw new Error('Radar persistence is not configured.');
  return new SupabaseRadarPersistence({ url, serviceRoleKey });
}

function project(row: MemoryRow): RadarResumeProjection {
  return { id: row.id, status: row.status, answers: structuredClone(row.answers), revision: row.revision, currentStep: row.currentStep, answeredCount: row.answeredCount, progressPercent: row.progressPercent };
}

function progress(row: MemoryRow): RadarProgressProjection {
  return { revision: row.revision, currentStep: row.currentStep, answeredCount: row.answeredCount, progressPercent: row.progressPercent };
}
