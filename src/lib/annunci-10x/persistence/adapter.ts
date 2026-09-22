import { randomUUID } from 'node:crypto';
import {
  validateCommercialContext,
  validateGeneratedAd,
  validatePublicationGate,
  validateRoleCard,
  validateRoleProfile,
  validateScoreResult,
} from '../validation.ts';
import type { AiOperationStatus } from '../types.ts';
import { assertSafeEventMetadata, createAnnunci10xSessionSecret, hashAnnunci10xSessionSecret } from './security.ts';
import {
  ANNUNCI10X_PERSISTENCE_VERSIONS,
  parseAiOperationRow,
  parseAnswerRow,
  parseEvaluationRow,
  parseEventRow,
  parseOutputRow,
  parseSessionRow,
  parseSnapshotRow,
} from './rows.ts';
import type {
  Annunci10xPersistenceAdapter,
  AppendAnswerInput,
  AppendEventInput,
  AppendSnapshotInput,
  CompleteAiOperationInput,
  CreateSessionInput,
  CreateSessionResult,
  FailAiOperationInput,
  PersistedAiOperation,
  PersistedAnnunci10xSession,
  PersistedAnswer,
  PersistedEvaluation,
  PersistedEvent,
  PersistedOutput,
  PersistedSnapshot,
  SaveEvaluationInput,
  SaveOutputInput,
  StartAiOperationInput,
} from './types.ts';

type DbRow = Record<string, unknown>;

export interface SupabaseRestConfig {
  url: string;
  serviceRoleKey: string;
  fetchImpl?: typeof fetch;
}

export class Annunci10xPersistenceError extends Error {
  readonly causeCode: 'CONFIG' | 'OWNERSHIP' | 'VALIDATION' | 'DATABASE';

  constructor(message: string, causeCode: 'CONFIG' | 'OWNERSHIP' | 'VALIDATION' | 'DATABASE') {
    super(message);
    this.name = 'Annunci10xPersistenceError';
    this.causeCode = causeCode;
  }
}

export class SupabaseAnnunci10xPersistenceAdapter implements Annunci10xPersistenceAdapter {
  private readonly url: string;
  private readonly serviceRoleKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: SupabaseRestConfig) {
    assertServerOnly();
    this.url = config.url.replace(/\/$/, '');
    this.serviceRoleKey = config.serviceRoleKey;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    validateCommercialContextOrThrow(input.commercialContext);
    const secret = createAnnunci10xSessionSecret();
    const row = await this.rpc<DbRow>('annunci10x_create_session', {
      p_owner_secret_hash: secret.secretHash,
      p_flow: input.flow,
      p_state: 'STARTED',
      p_selected_channel: input.selectedChannel ?? null,
      p_commercial_context: input.commercialContext,
      p_versions: ANNUNCI10X_PERSISTENCE_VERSIONS,
      p_expires_at: input.expiresAt ?? null,
    });
    return { session: parseSessionRow(row), sessionSecret: secret.secret };
  }

  async getSession(sessionId: string, sessionSecret: string): Promise<PersistedAnnunci10xSession | null> {
    const rows = await this.select('annunci10x_sessions', {
      id: `eq.${sessionId}`,
      owner_secret_hash: `eq.${hashAnnunci10xSessionSecret(sessionSecret)}`,
      select: '*',
      limit: '1',
    });
    return rows[0] ? parseSessionRow(rows[0]) : null;
  }

  async appendAnswer(input: AppendAnswerInput): Promise<PersistedAnswer> {
    await this.requireOwnership(input.sessionId, input.sessionSecret);
    const rows = await this.insert('annunci10x_answers', {
      session_id: input.sessionId,
      interview_step: input.interviewStep,
      question_id: input.questionId,
      clarification_id: input.clarificationId ?? null,
      raw_answer: input.rawAnswer,
    });
    return parseAnswerRow(first(rows, 'append answer'));
  }

  async appendSnapshot(input: AppendSnapshotInput): Promise<PersistedSnapshot> {
    validateRoleCardOrThrow(input.roleCard);
    if (input.roleProfile) validateRoleProfileOrThrow(input.roleProfile);
    const row = await this.rpc<DbRow>('annunci10x_append_snapshot', {
      p_session_id: input.sessionId,
      p_owner_secret_hash: hashAnnunci10xSessionSecret(input.sessionSecret),
      p_role_card: input.roleCard,
      p_role_profile: input.roleProfile ?? null,
      p_communication_strategy: input.communicationStrategy ?? null,
      p_reason: input.reason,
    });
    return parseSnapshotRow(row);
  }

  async getLatestSnapshot(sessionId: string, sessionSecret: string): Promise<PersistedSnapshot | null> {
    await this.requireOwnership(sessionId, sessionSecret);
    const rows = await this.select('annunci10x_snapshots', {
      session_id: `eq.${sessionId}`,
      select: '*',
      order: 'version.desc',
      limit: '1',
    });
    return rows[0] ? parseSnapshotRow(rows[0]) : null;
  }

  async startAiOperation(input: StartAiOperationInput): Promise<PersistedAiOperation> {
    const row = await this.rpc<DbRow>('annunci10x_register_ai_operation', {
      p_session_id: input.sessionId,
      p_owner_secret_hash: hashAnnunci10xSessionSecret(input.sessionSecret),
      p_operation_type: input.operationType,
      p_input_snapshot_id: input.inputSnapshotId ?? null,
      p_prompt_version: input.promptVersion,
      p_idempotency_key: input.idempotencyKey,
      p_model: input.model ?? null,
    });
    return parseAiOperationRow(row);
  }

  async completeAiOperation(input: CompleteAiOperationInput): Promise<PersistedAiOperation> {
    const row = await this.rpc<DbRow>('annunci10x_complete_ai_operation', {
      p_operation_id: input.operationId,
      p_owner_secret_hash: hashAnnunci10xSessionSecret(input.sessionSecret),
      p_output_snapshot_id: input.outputSnapshotId ?? null,
      p_output_payload: input.outputPayload ?? null,
    });
    return parseAiOperationRow(row);
  }

  async failAiOperation(input: FailAiOperationInput): Promise<PersistedAiOperation> {
    const row = await this.rpc<DbRow>('annunci10x_fail_ai_operation', {
      p_operation_id: input.operationId,
      p_owner_secret_hash: hashAnnunci10xSessionSecret(input.sessionSecret),
      p_error_payload: input.errorPayload,
    });
    return parseAiOperationRow(row);
  }

  async saveEvaluation(input: SaveEvaluationInput): Promise<PersistedEvaluation> {
    await this.requireOwnership(input.sessionId, input.sessionSecret);
    validateScoreResultOrThrow(input.score);
    validatePublicationGateOrThrow(input.gate);
    const rows = await this.insert('annunci10x_evaluations', {
      session_id: input.sessionId,
      target: input.target.kind,
      target_ref: input.targetRef,
      target_output_id: input.targetOutputId ?? null,
      checks: input.score.checks,
      score_result: input.score,
      gates: input.gate,
      rubric_version: input.score.rubricVersion,
    });
    return parseEvaluationRow(first(rows, 'save evaluation'));
  }

  async saveOutput(input: SaveOutputInput): Promise<PersistedOutput> {
    await this.requireOwnership(input.sessionId, input.sessionSecret);
    if (input.outputType === 'MASTER') validateGeneratedAdOrThrow(input.generatedContent);
    const rows = await this.insert('annunci10x_outputs', {
      session_id: input.sessionId,
      snapshot_id: input.snapshotId,
      output_type: input.outputType,
      channel: input.channel ?? null,
      generated_content: input.generatedContent,
      parent_master_id: input.parentMasterId ?? null,
      validation_state: input.validationState,
    });
    return parseOutputRow(first(rows, 'save output'));
  }

  async appendEvent(input: AppendEventInput): Promise<PersistedEvent> {
    const metadata = input.metadata ?? {};
    assertSafeEventMetadata(metadata);
    const rows = await this.insert('annunci10x_events', {
      session_id: input.sessionId ?? null,
      event_name: input.eventName,
      metadata,
    });
    return parseEventRow(first(rows, 'append event'));
  }

  private async requireOwnership(sessionId: string, sessionSecret: string): Promise<void> {
    const verified = await this.rpc<boolean>('annunci10x_verify_session_secret', {
      p_session_id: sessionId,
      p_owner_secret_hash: hashAnnunci10xSessionSecret(sessionSecret),
    });
    if (!verified) throw new Annunci10xPersistenceError('Annunci 10x session ownership verification failed.', 'OWNERSHIP');
  }

  private async rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
    const response = await this.fetchImpl(`${this.url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Annunci10xPersistenceError(`Annunci 10x RPC failed: ${fn}`, 'DATABASE');
    return response.json() as Promise<T>;
  }

  private async select(table: string, query: Record<string, string>): Promise<DbRow[]> {
    const response = await this.fetchImpl(`${this.url}/rest/v1/${table}?${new URLSearchParams(query)}`, {
      method: 'GET',
      headers: this.headers(),
    });
    if (!response.ok) throw new Annunci10xPersistenceError(`Annunci 10x select failed: ${table}`, 'DATABASE');
    return response.json() as Promise<DbRow[]>;
  }

  private async insert(table: string, row: DbRow): Promise<DbRow[]> {
    const response = await this.fetchImpl(`${this.url}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...this.headers(), Prefer: 'return=representation' },
      body: JSON.stringify(row),
    });
    if (!response.ok) throw new Annunci10xPersistenceError(`Annunci 10x insert failed: ${table}`, 'DATABASE');
    return response.json() as Promise<DbRow[]>;
  }

  private headers(): Record<string, string> {
    return {
      apikey: this.serviceRoleKey,
      authorization: `Bearer ${this.serviceRoleKey}`,
      'content-type': 'application/json',
    };
  }
}

export class MemoryAnnunci10xPersistenceAdapter implements Annunci10xPersistenceAdapter {
  private sessions = new Map<string, DbRow & { owner_secret_hash: string }>();
  private answers: DbRow[] = [];
  private snapshots: DbRow[] = [];
  private operations = new Map<string, DbRow>();
  private outputs = new Map<string, DbRow>();
  private evaluations: DbRow[] = [];
  private events: DbRow[] = [];

  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    validateCommercialContextOrThrow(input.commercialContext);
    const secret = createAnnunci10xSessionSecret();
    const now = new Date().toISOString();
    const row = {
      id: randomUUID(),
      owner_secret_hash: secret.secretHash,
      flow: input.flow,
      state: 'STARTED',
      current_snapshot_id: null,
      selected_channel: input.selectedChannel ?? null,
      method_version: ANNUNCI10X_PERSISTENCE_VERSIONS.methodVersion,
      rubric_version: ANNUNCI10X_PERSISTENCE_VERSIONS.rubricVersion,
      strategy_version: ANNUNCI10X_PERSISTENCE_VERSIONS.strategyVersion,
      prompt_pack_version: ANNUNCI10X_PERSISTENCE_VERSIONS.promptVersion,
      data_contract_version: ANNUNCI10X_PERSISTENCE_VERSIONS.dataContractVersion,
      commercial_context: input.commercialContext,
      created_at: now,
      updated_at: now,
      expires_at: input.expiresAt ?? null,
    };
    this.sessions.set(row.id, row);
    return { session: parseSessionRow(row), sessionSecret: secret.secret };
  }

  async getSession(sessionId: string, sessionSecret: string): Promise<PersistedAnnunci10xSession | null> {
    const row = this.sessions.get(sessionId);
    if (!row || row.owner_secret_hash !== hashAnnunci10xSessionSecret(sessionSecret)) return null;
    return parseSessionRow(row);
  }

  async appendAnswer(input: AppendAnswerInput): Promise<PersistedAnswer> {
    this.requireMemoryOwnership(input.sessionId, input.sessionSecret);
    const row = {
      id: randomUUID(),
      session_id: input.sessionId,
      interview_step: input.interviewStep,
      question_id: input.questionId,
      clarification_id: input.clarificationId ?? null,
      raw_answer: input.rawAnswer,
      created_at: new Date().toISOString(),
    };
    this.answers.push(row);
    return parseAnswerRow(row);
  }

  async appendSnapshot(input: AppendSnapshotInput): Promise<PersistedSnapshot> {
    this.requireMemoryOwnership(input.sessionId, input.sessionSecret);
    validateRoleCardOrThrow(input.roleCard);
    if (input.roleProfile) validateRoleProfileOrThrow(input.roleProfile);
    const version = this.snapshots.filter((row) => row.session_id === input.sessionId).length + 1;
    const row = {
      id: randomUUID(),
      session_id: input.sessionId,
      version,
      role_card: input.roleCard,
      role_profile: input.roleProfile ?? null,
      communication_strategy: input.communicationStrategy ?? null,
      reason: input.reason,
      created_at: new Date().toISOString(),
    };
    this.snapshots.push(row);
    const session = this.sessions.get(input.sessionId);
    if (session) {
      session.current_snapshot_id = row.id;
      session.updated_at = new Date().toISOString();
    }
    return parseSnapshotRow(row);
  }

  async getLatestSnapshot(sessionId: string, sessionSecret: string): Promise<PersistedSnapshot | null> {
    this.requireMemoryOwnership(sessionId, sessionSecret);
    const row = this.snapshots
      .filter((item) => item.session_id === sessionId)
      .sort((left, right) => Number(right.version) - Number(left.version))[0];
    return row ? parseSnapshotRow(row) : null;
  }

  async startAiOperation(input: StartAiOperationInput): Promise<PersistedAiOperation> {
    this.requireMemoryOwnership(input.sessionId, input.sessionSecret);
    const identity = input.inputSnapshotId ?? '00000000-0000-0000-0000-000000000000';
    const key = `${input.sessionId}:${input.operationType}:${identity}:${input.promptVersion}:${input.idempotencyKey}`;
    const existing = this.operations.get(key);
    if (existing) return parseAiOperationRow(existing);
    const row = operationRow({
      sessionId: input.sessionId,
      operationType: input.operationType,
      status: 'RUNNING',
      inputSnapshotId: input.inputSnapshotId ?? null,
      promptVersion: input.promptVersion,
      idempotencyKey: input.idempotencyKey,
      model: input.model ?? null,
    });
    this.operations.set(key, row);
    return parseAiOperationRow(row);
  }

  async completeAiOperation(input: CompleteAiOperationInput): Promise<PersistedAiOperation> {
    const row = this.findOwnedOperation(input.operationId, input.sessionSecret);
    row.status = 'SUCCEEDED';
    row.output_snapshot_id = input.outputSnapshotId ?? null;
    row.output_payload = input.outputPayload ?? null;
    row.completed_at = new Date().toISOString();
    row.error_payload = null;
    return parseAiOperationRow(row);
  }

  async failAiOperation(input: FailAiOperationInput): Promise<PersistedAiOperation> {
    const row = this.findOwnedOperation(input.operationId, input.sessionSecret);
    row.status = 'FAILED';
    row.completed_at = new Date().toISOString();
    row.error_payload = input.errorPayload;
    return parseAiOperationRow(row);
  }

  async saveEvaluation(input: SaveEvaluationInput): Promise<PersistedEvaluation> {
    this.requireMemoryOwnership(input.sessionId, input.sessionSecret);
    validateScoreResultOrThrow(input.score);
    validatePublicationGateOrThrow(input.gate);
    const row = {
      id: randomUUID(),
      session_id: input.sessionId,
      target: input.target.kind,
      target_ref: input.targetRef,
      target_output_id: input.targetOutputId ?? null,
      checks: input.score.checks,
      score_result: input.score,
      gates: input.gate,
      rubric_version: input.score.rubricVersion,
      created_at: new Date().toISOString(),
    };
    this.evaluations.push(row);
    return parseEvaluationRow(row);
  }

  async saveOutput(input: SaveOutputInput): Promise<PersistedOutput> {
    this.requireMemoryOwnership(input.sessionId, input.sessionSecret);
    if (input.outputType === 'MASTER') validateGeneratedAdOrThrow(input.generatedContent);
    if (input.outputType === 'CHANNEL_VARIANT' && (!input.parentMasterId || !this.outputs.has(input.parentMasterId))) {
      throw new Annunci10xPersistenceError('Channel variant requires an existing master output.', 'VALIDATION');
    }
    const row = {
      id: randomUUID(),
      session_id: input.sessionId,
      snapshot_id: input.snapshotId,
      output_type: input.outputType,
      channel: input.channel ?? null,
      generated_content: input.generatedContent,
      parent_master_id: input.parentMasterId ?? null,
      validation_state: input.validationState,
      created_at: new Date().toISOString(),
    };
    this.outputs.set(row.id, row);
    return parseOutputRow(row);
  }

  async appendEvent(input: AppendEventInput): Promise<PersistedEvent> {
    const metadata = input.metadata ?? {};
    assertSafeEventMetadata(metadata);
    const row = {
      id: randomUUID(),
      session_id: input.sessionId ?? null,
      event_name: input.eventName,
      metadata,
      created_at: new Date().toISOString(),
    };
    this.events.push(row);
    return parseEventRow(row);
  }

  private requireMemoryOwnership(sessionId: string, sessionSecret: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.owner_secret_hash !== hashAnnunci10xSessionSecret(sessionSecret)) {
      throw new Annunci10xPersistenceError('Annunci 10x session ownership verification failed.', 'OWNERSHIP');
    }
  }

  private findOwnedOperation(operationId: string, sessionSecret: string): DbRow {
    for (const row of this.operations.values()) {
      if (row.id === operationId) {
        this.requireMemoryOwnership(String(row.session_id), sessionSecret);
        return row;
      }
    }
    throw new Annunci10xPersistenceError('Annunci 10x operation not found.', 'OWNERSHIP');
  }
}

export function createAnnunci10xPersistenceAdapter(): SupabaseAnnunci10xPersistenceAdapter {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Annunci10xPersistenceError('Supabase server-side environment is not configured for Annunci 10x persistence.', 'CONFIG');
  return new SupabaseAnnunci10xPersistenceAdapter({ url, serviceRoleKey });
}

function operationRow(input: {
  sessionId: string;
  operationType: string;
  status: AiOperationStatus;
  inputSnapshotId: string | null;
  promptVersion: string;
  idempotencyKey: string;
  model: string | null;
}): DbRow {
  return {
    id: randomUUID(),
    session_id: input.sessionId,
    operation_type: input.operationType,
    status: input.status,
    input_snapshot_id: input.inputSnapshotId,
    output_snapshot_id: null,
    output_payload: null,
    model: input.model,
    prompt_version: input.promptVersion,
    idempotency_key: input.idempotencyKey,
    started_at: new Date().toISOString(),
    completed_at: null,
    error_payload: null,
  };
}

function first(rows: DbRow[], label: string): DbRow {
  if (!rows[0]) throw new Annunci10xPersistenceError(`Annunci 10x ${label} did not return a row.`, 'DATABASE');
  return rows[0];
}

function validateCommercialContextOrThrow(value: unknown): void {
  const validation = validateCommercialContext(value);
  if (!validation.ok) throw new Annunci10xPersistenceError(validation.errors.join('; '), 'VALIDATION');
}

function validateRoleCardOrThrow(value: unknown): void {
  const validation = validateRoleCard(value);
  if (!validation.ok) throw new Annunci10xPersistenceError(validation.errors.join('; '), 'VALIDATION');
}

function validateRoleProfileOrThrow(value: unknown): void {
  const validation = validateRoleProfile(value);
  if (!validation.ok) throw new Annunci10xPersistenceError(validation.errors.join('; '), 'VALIDATION');
}

function validateScoreResultOrThrow(value: unknown): void {
  const validation = validateScoreResult(value);
  if (!validation.ok) throw new Annunci10xPersistenceError(validation.errors.join('; '), 'VALIDATION');
}

function validatePublicationGateOrThrow(value: unknown): void {
  const validation = validatePublicationGate(value);
  if (!validation.ok) throw new Annunci10xPersistenceError(validation.errors.join('; '), 'VALIDATION');
}

function validateGeneratedAdOrThrow(value: unknown): void {
  const validation = validateGeneratedAd(value);
  if (!validation.ok) throw new Annunci10xPersistenceError(validation.errors.join('; '), 'VALIDATION');
}

function assertServerOnly(): void {
  if (typeof window !== 'undefined') {
    throw new Annunci10xPersistenceError('Annunci 10x persistence adapter is server-only.', 'CONFIG');
  }
}
