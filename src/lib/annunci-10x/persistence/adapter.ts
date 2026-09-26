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
  parseAnalysisRunRow,
  parseAiOperationRow,
  parseAnswerRow,
  parseEmailVerificationRow,
  parseEvaluationRow,
  parseEventRow,
  parseLeadRow,
  parseOutputRow,
  parseSessionRow,
  parseSnapshotRow,
} from './rows.ts';
import type {
  Annunci10xPersistenceAdapter,
  AppendAnswerInput,
  AppendEventInput,
  AppendSnapshotInput,
  CheckRateLimitInput,
  CheckRateLimitResult,
  CreateEmailVerificationInput,
  CreateAnalysisRunInput,
  CompleteAiOperationInput,
  CreateSessionInput,
  CreateSessionResult,
  FailAiOperationInput,
  PersistedAnalysisRun,
  PersistedAiOperation,
  PersistedAnnunci10xSession,
  PersistedAnswer,
  PersistedEmailVerification,
  PersistedEvaluation,
  PersistedEvent,
  PersistedLead,
  PersistedOutput,
  PersistedSnapshot,
  SaveEvaluationInput,
  SaveLeadInput,
  SaveOutputInput,
  StartAiOperationInput,
  UpdateAnalysisRunInput,
  UpdateSessionInput,
  VerifyEmailCodeInput,
  VerifyEmailCodeResult,
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

  async updateSession(input: UpdateSessionInput): Promise<PersistedAnnunci10xSession> {
    await this.requireOwnership(input.sessionId, input.sessionSecret);
    const row: DbRow = { updated_at: new Date().toISOString() };
    if (input.state !== undefined) row.state = input.state;
    if (input.selectedChannel !== undefined) row.selected_channel = input.selectedChannel;
    if (input.currentSnapshotId !== undefined) row.current_snapshot_id = input.currentSnapshotId;
    const rows = await this.update('annunci10x_sessions', {
      id: `eq.${input.sessionId}`,
      owner_secret_hash: `eq.${hashAnnunci10xSessionSecret(input.sessionSecret)}`,
    }, row);
    return parseSessionRow(first(rows, 'update session'));
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

  async getAnswers(sessionId: string, sessionSecret: string): Promise<PersistedAnswer[]> {
    await this.requireOwnership(sessionId, sessionSecret);
    const rows = await this.select('annunci10x_answers', {
      session_id: `eq.${sessionId}`,
      select: '*',
      order: 'created_at.asc',
    });
    return rows.map(parseAnswerRow);
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

  async getLatestEvaluation(sessionId: string, sessionSecret: string): Promise<PersistedEvaluation | null> {
    await this.requireOwnership(sessionId, sessionSecret);
    const rows = await this.select('annunci10x_evaluations', {
      session_id: `eq.${sessionId}`,
      select: '*',
      order: 'created_at.desc',
      limit: '1',
    });
    return rows[0] ? parseEvaluationRow(rows[0]) : null;
  }

  async createOrGetAnalysisRun(input: CreateAnalysisRunInput): Promise<PersistedAnalysisRun> {
    const row = await this.rpc<DbRow>('annunci10x_create_or_get_analysis_run', {
      p_session_id: input.sessionId,
      p_owner_secret_hash: hashAnnunci10xSessionSecret(input.sessionSecret),
      p_source_kind: input.sourceKind,
      p_source_status: input.sourceStatus,
      p_original_input: input.originalInput,
      p_source_url: input.sourceUrl ?? null,
      p_fetched_text: input.fetchedText ?? null,
      p_target_text: input.targetText ?? null,
      p_retrieval_metadata: input.retrievalMetadata ?? {},
      p_failure_code: input.failureCode ?? null,
      p_failure_message: input.failureMessage ?? null,
      p_target_kind: input.targetKind,
      p_declared_channel: input.declaredChannel ?? null,
      p_source_hash: input.sourceHash,
      p_input_identity: input.inputIdentity,
      p_method_version: input.methodVersion,
      p_rubric_version: input.rubricVersion,
      p_prompt_version: input.promptVersion,
      p_score_semantics_version: input.scoreSemanticsVersion,
      p_model: input.model,
      p_provider: input.provider,
      p_evaluation_mode: input.evaluationMode,
    });
    return parseAnalysisRunRow(row);
  }

  async getAnalysisRun(analysisRunId: string, sessionSecret: string): Promise<PersistedAnalysisRun | null> {
    const rows = await this.select('annunci10x_analysis_runs', {
      id: `eq.${analysisRunId}`,
      select: '*,annunci10x_sessions!inner(owner_secret_hash,expires_at)',
      'annunci10x_sessions.owner_secret_hash': `eq.${hashAnnunci10xSessionSecret(sessionSecret)}`,
      limit: '1',
    });
    return rows[0] ? parseAnalysisRunRow(rows[0]) : null;
  }

  async getLatestAnalysisRun(sessionId: string, sessionSecret: string): Promise<PersistedAnalysisRun | null> {
    await this.requireOwnership(sessionId, sessionSecret);
    const rows = await this.select('annunci10x_analysis_runs', {
      session_id: `eq.${sessionId}`,
      select: '*',
      order: 'created_at.desc',
      limit: '1',
    });
    return rows[0] ? parseAnalysisRunRow(rows[0]) : null;
  }

  async claimAnalysisRun(analysisRunId: string, sessionSecret: string, leaseSeconds: number): Promise<PersistedAnalysisRun | null> {
    const row = await this.rpc<DbRow | null>('annunci10x_claim_analysis_run', {
      p_analysis_run_id: analysisRunId,
      p_owner_secret_hash: hashAnnunci10xSessionSecret(sessionSecret),
      p_lease_seconds: leaseSeconds,
    });
    return row ? parseAnalysisRunRow(row) : null;
  }

  async updateAnalysisRun(input: UpdateAnalysisRunInput): Promise<PersistedAnalysisRun> {
    const row = await this.rpc<DbRow>('annunci10x_update_analysis_run', {
      p_analysis_run_id: input.analysisRunId,
      p_owner_secret_hash: hashAnnunci10xSessionSecret(input.sessionSecret),
      p_status: input.status ?? null,
      p_stage: input.stage ?? null,
      p_source_status: input.sourceStatus ?? null,
      p_evaluation_id: input.evaluationId ?? null,
      p_result_reference: input.resultReference ?? null,
      p_operation_refs: input.operationRefs ?? null,
      p_retrieval_metadata: input.retrievalMetadata ?? null,
      p_error_payload: input.errorPayload ?? null,
      p_lease_expires_at: input.leaseExpiresAt ?? null,
      p_started_at: input.startedAt ?? null,
      p_completed_at: input.completedAt ?? null,
      p_failed_at: input.failedAt ?? null,
      p_increment_attempt_count: input.incrementAttemptCount ?? false,
    });
    return parseAnalysisRunRow(row);
  }

  async checkRateLimit(input: CheckRateLimitInput): Promise<CheckRateLimitResult> {
    const row = await this.rpc<DbRow>('annunci10x_check_rate_limit', {
      p_scope: input.scope,
      p_subject: input.subject,
      p_limit: input.limit,
      p_window_seconds: input.windowSeconds,
    });
    return parseRateLimitRow(row);
  }

  async saveLead(input: SaveLeadInput): Promise<PersistedLead> {
    const row = await this.rpc<DbRow>('annunci10x_save_lead', {
      p_session_id: input.sessionId,
      p_owner_secret_hash: hashAnnunci10xSessionSecret(input.sessionSecret),
      p_first_name: input.firstName,
      p_last_name: input.lastName,
      p_company_name: input.companyName,
      p_business_role: input.businessRole,
      p_email_normalized: input.emailNormalized,
      p_marketing_consent: input.marketingConsent,
      p_marketing_consent_version: input.marketingConsentVersion,
    });
    return parseLeadRow(row);
  }

  async getLead(sessionId: string, sessionSecret: string): Promise<PersistedLead | null> {
    await this.requireOwnership(sessionId, sessionSecret);
    const rows = await this.select('annunci10x_leads', {
      session_id: `eq.${sessionId}`,
      select: '*',
      limit: '1',
    });
    return rows[0] ? parseLeadRow(rows[0]) : null;
  }

  async createEmailVerification(input: CreateEmailVerificationInput): Promise<PersistedEmailVerification> {
    const row = await this.rpc<DbRow>('annunci10x_create_email_verification', {
      p_verification_id: input.id ?? randomUUID(),
      p_session_id: input.sessionId,
      p_owner_secret_hash: hashAnnunci10xSessionSecret(input.sessionSecret),
      p_lead_id: input.leadId,
      p_email_normalized: input.emailNormalized,
      p_code_hash: input.codeHash,
      p_expires_at: input.expiresAt,
      p_max_attempts: input.maxAttempts,
    });
    return parseEmailVerificationRow(row, { includeHash: true });
  }

  async getActiveEmailVerification(sessionId: string, sessionSecret: string): Promise<PersistedEmailVerification | null> {
    await this.requireOwnership(sessionId, sessionSecret);
    const rows = await this.select('annunci10x_email_verifications', {
      session_id: `eq.${sessionId}`,
      status: 'eq.SENT',
      consumed_at: 'is.null',
      invalidated_at: 'is.null',
      select: '*',
      order: 'created_at.desc',
      limit: '1',
    });
    return rows[0] ? parseEmailVerificationRow(rows[0], { includeHash: true }) : null;
  }

  async markEmailVerificationSent(verificationId: string, sessionSecret: string): Promise<PersistedEmailVerification> {
    const row = await this.rpc<DbRow>('annunci10x_mark_email_verification_sent', {
      p_verification_id: verificationId,
      p_owner_secret_hash: hashAnnunci10xSessionSecret(sessionSecret),
    });
    return parseEmailVerificationRow(row, { includeHash: true });
  }

  async markEmailVerificationFailed(verificationId: string, sessionSecret: string): Promise<PersistedEmailVerification> {
    const row = await this.rpc<DbRow>('annunci10x_mark_email_verification_failed', {
      p_verification_id: verificationId,
      p_owner_secret_hash: hashAnnunci10xSessionSecret(sessionSecret),
    });
    return parseEmailVerificationRow(row, { includeHash: true });
  }

  async verifyEmailCode(input: VerifyEmailCodeInput): Promise<VerifyEmailCodeResult> {
    const row = await this.rpc<DbRow>('annunci10x_verify_email_code', {
      p_session_id: input.sessionId,
      p_owner_secret_hash: hashAnnunci10xSessionSecret(input.sessionSecret),
      p_code_hash: input.codeHash,
    });
    return parseVerifyEmailCodeResult(row);
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

  async getLatestOutput(sessionId: string, sessionSecret: string, outputType?: SaveOutputInput['outputType'], parentMasterId?: string | null): Promise<PersistedOutput | null> {
    await this.requireOwnership(sessionId, sessionSecret);
    const query: Record<string, string> = {
      session_id: `eq.${sessionId}`,
      select: '*',
      order: 'created_at.desc',
      limit: '1',
    };
    if (outputType) query.output_type = `eq.${outputType}`;
    if (parentMasterId !== undefined) query.parent_master_id = parentMasterId === null ? 'is.null' : `eq.${parentMasterId}`;
    const rows = await this.select('annunci10x_outputs', query);
    return rows[0] ? parseOutputRow(rows[0]) : null;
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

  private async update(table: string, query: Record<string, string>, row: DbRow): Promise<DbRow[]> {
    const response = await this.fetchImpl(`${this.url}/rest/v1/${table}?${new URLSearchParams(query)}`, {
      method: 'PATCH',
      headers: { ...this.headers(), Prefer: 'return=representation' },
      body: JSON.stringify(row),
    });
    if (!response.ok) throw new Annunci10xPersistenceError(`Annunci 10x update failed: ${table}`, 'DATABASE');
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
  private analysisRuns = new Map<string, DbRow>();
  private leads = new Map<string, DbRow>();
  private verifications = new Map<string, DbRow>();
  private outputs = new Map<string, DbRow>();
  private evaluations: DbRow[] = [];
  private events: DbRow[] = [];
  private rateLimits = new Map<string, { count: number; resetAt: number }>();

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

  async updateSession(input: UpdateSessionInput): Promise<PersistedAnnunci10xSession> {
    this.requireMemoryOwnership(input.sessionId, input.sessionSecret);
    const row = this.sessions.get(input.sessionId);
    if (!row) throw new Annunci10xPersistenceError('Annunci 10x session not found.', 'OWNERSHIP');
    if (input.state !== undefined) row.state = input.state;
    if (input.selectedChannel !== undefined) row.selected_channel = input.selectedChannel;
    if (input.currentSnapshotId !== undefined) row.current_snapshot_id = input.currentSnapshotId;
    row.updated_at = new Date().toISOString();
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

  async getAnswers(sessionId: string, sessionSecret: string): Promise<PersistedAnswer[]> {
    this.requireMemoryOwnership(sessionId, sessionSecret);
    return this.answers
      .filter((row) => row.session_id === sessionId)
      .sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)))
      .map(parseAnswerRow);
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

  async getLatestEvaluation(sessionId: string, sessionSecret: string): Promise<PersistedEvaluation | null> {
    this.requireMemoryOwnership(sessionId, sessionSecret);
    const row = this.evaluations
      .filter((item) => item.session_id === sessionId)
      .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))[0];
    return row ? parseEvaluationRow(row) : null;
  }

  async createOrGetAnalysisRun(input: CreateAnalysisRunInput): Promise<PersistedAnalysisRun> {
    this.requireMemoryOwnership(input.sessionId, input.sessionSecret);
    const existing = [...this.analysisRuns.values()].find((row) => row.session_id === input.sessionId && row.input_identity === input.inputIdentity);
    if (existing) return parseAnalysisRunRow(existing);
    const now = new Date().toISOString();
    const status = input.sourceStatus === 'READY' ? 'QUEUED' : 'FAILED';
    const row: DbRow = {
      id: randomUUID(),
      session_id: input.sessionId,
      source_kind: input.sourceKind,
      source_status: input.sourceStatus,
      source_url: input.sourceUrl ?? null,
      original_input: input.originalInput,
      fetched_text: input.fetchedText ?? null,
      target_text: input.targetText ?? null,
      retrieval_metadata: input.retrievalMetadata ?? {},
      target_kind: input.targetKind,
      declared_channel: input.declaredChannel ?? null,
      source_hash: input.sourceHash,
      input_identity: input.inputIdentity,
      method_version: input.methodVersion,
      rubric_version: input.rubricVersion,
      prompt_version: input.promptVersion,
      score_semantics_version: input.scoreSemanticsVersion,
      model: input.model,
      provider: input.provider,
      evaluation_mode: input.evaluationMode,
      status,
      stage: 'SOURCE_VALIDATION',
      evaluation_id: null,
      result_reference: null,
      operation_refs: {},
      error_payload: input.failureCode ? { code: input.failureCode, message: input.failureMessage ?? 'Source ingestion failed.' } : null,
      attempt_count: 0,
      lease_expires_at: null,
      created_at: now,
      updated_at: now,
      started_at: null,
      completed_at: null,
      failed_at: status === 'FAILED' ? now : null,
    };
    this.analysisRuns.set(String(row.id), row);
    return parseAnalysisRunRow(row);
  }

  async getAnalysisRun(analysisRunId: string, sessionSecret: string): Promise<PersistedAnalysisRun | null> {
    const row = this.analysisRuns.get(analysisRunId);
    if (!row) return null;
    this.requireMemoryOwnership(String(row.session_id), sessionSecret);
    return parseAnalysisRunRow(row);
  }

  async getLatestAnalysisRun(sessionId: string, sessionSecret: string): Promise<PersistedAnalysisRun | null> {
    this.requireMemoryOwnership(sessionId, sessionSecret);
    const row = [...this.analysisRuns.values()]
      .filter((item) => item.session_id === sessionId)
      .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))[0];
    return row ? parseAnalysisRunRow(row) : null;
  }

  async claimAnalysisRun(analysisRunId: string, sessionSecret: string, leaseSeconds: number): Promise<PersistedAnalysisRun | null> {
    const row = this.analysisRuns.get(analysisRunId);
    if (!row) return null;
    this.requireMemoryOwnership(String(row.session_id), sessionSecret);
    const now = Date.now();
    const leaseExpiresAt = typeof row.lease_expires_at === 'string' ? Date.parse(row.lease_expires_at) : 0;
    if (row.status === 'READY' || row.status === 'FAILED') return null;
    if (row.status === 'RUNNING' && leaseExpiresAt > now) return null;
    row.status = 'RUNNING';
    row.started_at = row.started_at ?? new Date(now).toISOString();
    row.lease_expires_at = new Date(now + leaseSeconds * 1000).toISOString();
    row.attempt_count = Number(row.attempt_count ?? 0) + 1;
    row.updated_at = new Date(now).toISOString();
    return parseAnalysisRunRow(row);
  }

  async updateAnalysisRun(input: UpdateAnalysisRunInput): Promise<PersistedAnalysisRun> {
    const row = this.analysisRuns.get(input.analysisRunId);
    if (!row) throw new Annunci10xPersistenceError('Annunci 10x analysis run not found.', 'OWNERSHIP');
    this.requireMemoryOwnership(String(row.session_id), input.sessionSecret);
    if (input.status !== undefined) row.status = input.status;
    if (input.stage !== undefined) row.stage = input.stage;
    if (input.sourceStatus !== undefined) row.source_status = input.sourceStatus;
    if (input.evaluationId !== undefined) row.evaluation_id = input.evaluationId;
    if (input.resultReference !== undefined) row.result_reference = input.resultReference;
    if (input.operationRefs !== undefined) row.operation_refs = input.operationRefs;
    if (input.retrievalMetadata !== undefined) row.retrieval_metadata = input.retrievalMetadata;
    if (input.errorPayload !== undefined) row.error_payload = input.errorPayload;
    if (input.leaseExpiresAt !== undefined) row.lease_expires_at = input.leaseExpiresAt;
    if (input.startedAt !== undefined) row.started_at = input.startedAt;
    if (input.completedAt !== undefined) row.completed_at = input.completedAt;
    if (input.failedAt !== undefined) row.failed_at = input.failedAt;
    if (input.incrementAttemptCount) row.attempt_count = Number(row.attempt_count ?? 0) + 1;
    row.updated_at = new Date().toISOString();
    return parseAnalysisRunRow(row);
  }

  async checkRateLimit(input: CheckRateLimitInput): Promise<CheckRateLimitResult> {
    const key = `${input.scope}:${input.subject}`;
    const now = Date.now();
    const current = this.rateLimits.get(key);
    if (!current || current.resetAt <= now) {
      const resetAt = now + input.windowSeconds * 1000;
      this.rateLimits.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: Math.max(0, input.limit - 1), retryAfterSeconds: 0, resetAt: new Date(resetAt).toISOString() };
    }
    current.count += 1;
    const allowed = current.count <= input.limit;
    return {
      allowed,
      remaining: Math.max(0, input.limit - current.count),
      retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      resetAt: new Date(current.resetAt).toISOString(),
    };
  }

  async saveLead(input: SaveLeadInput): Promise<PersistedLead> {
    this.requireMemoryOwnership(input.sessionId, input.sessionSecret);
    const now = new Date().toISOString();
    const existing = this.leads.get(input.sessionId);
    const emailChanged = Boolean(existing && existing.email_normalized !== input.emailNormalized);
    const row: DbRow = existing ?? {
      id: randomUUID(),
      session_id: input.sessionId,
      created_at: now,
    };
    row.first_name = input.firstName;
    row.last_name = input.lastName;
    row.company_name = input.companyName;
    row.business_role = input.businessRole;
    row.email_normalized = input.emailNormalized;
    if (!existing || emailChanged) row.email_verified_at = null;
    row.marketing_consent = input.marketingConsent;
    row.marketing_consent_at = input.marketingConsent ? existing?.marketing_consent_at ?? now : null;
    row.marketing_consent_version = input.marketingConsent ? input.marketingConsentVersion : null;
    row.updated_at = now;
    this.leads.set(input.sessionId, row);
    if (emailChanged) this.invalidateActiveMemoryVerifications(input.sessionId, String(existing?.id ?? row.id));
    return parseLeadRow(row);
  }

  async getLead(sessionId: string, sessionSecret: string): Promise<PersistedLead | null> {
    this.requireMemoryOwnership(sessionId, sessionSecret);
    const row = this.leads.get(sessionId);
    return row ? parseLeadRow(row) : null;
  }

  async createEmailVerification(input: CreateEmailVerificationInput): Promise<PersistedEmailVerification> {
    this.requireMemoryOwnership(input.sessionId, input.sessionSecret);
    const lead = this.leads.get(input.sessionId);
    if (!lead || lead.id !== input.leadId || lead.email_normalized !== input.emailNormalized) {
      throw new Annunci10xPersistenceError('Annunci 10x lead ownership verification failed.', 'OWNERSHIP');
    }
    this.invalidateActiveMemoryVerifications(input.sessionId, input.leadId);
    const now = new Date().toISOString();
    const row: DbRow = {
      id: input.id ?? randomUUID(),
      session_id: input.sessionId,
      lead_id: input.leadId,
      email_normalized: input.emailNormalized,
      code_hash: input.codeHash,
      status: 'PENDING_SEND',
      expires_at: input.expiresAt,
      sent_at: null,
      attempt_count: 0,
      max_attempts: input.maxAttempts,
      consumed_at: null,
      invalidated_at: null,
      created_at: now,
      updated_at: now,
    };
    this.verifications.set(String(row.id), row);
    return parseEmailVerificationRow(row, { includeHash: true });
  }

  async getActiveEmailVerification(sessionId: string, sessionSecret: string): Promise<PersistedEmailVerification | null> {
    this.requireMemoryOwnership(sessionId, sessionSecret);
    const row = [...this.verifications.values()]
      .filter((item) => item.session_id === sessionId && item.status === 'SENT' && !item.consumed_at && !item.invalidated_at)
      .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))[0];
    return row ? parseEmailVerificationRow(row, { includeHash: true }) : null;
  }

  async markEmailVerificationSent(verificationId: string, sessionSecret: string): Promise<PersistedEmailVerification> {
    const row = this.findOwnedVerification(verificationId, sessionSecret);
    row.status = 'SENT';
    row.sent_at = new Date().toISOString();
    row.updated_at = row.sent_at;
    return parseEmailVerificationRow(row, { includeHash: true });
  }

  async markEmailVerificationFailed(verificationId: string, sessionSecret: string): Promise<PersistedEmailVerification> {
    const row = this.findOwnedVerification(verificationId, sessionSecret);
    row.status = 'FAILED_SEND';
    row.invalidated_at = new Date().toISOString();
    row.updated_at = row.invalidated_at;
    return parseEmailVerificationRow(row, { includeHash: true });
  }

  async verifyEmailCode(input: VerifyEmailCodeInput): Promise<VerifyEmailCodeResult> {
    this.requireMemoryOwnership(input.sessionId, input.sessionSecret);
    const row = [...this.verifications.values()]
      .filter((item) => item.session_id === input.sessionId && item.status === 'SENT' && !item.consumed_at && !item.invalidated_at)
      .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))[0];
    if (!row) return { outcome: 'VERIFICATION_INVALID', lead: await this.getLead(input.sessionId, input.sessionSecret), verification: null };
    const now = new Date();
    if (Date.parse(String(row.expires_at)) <= now.getTime()) {
      row.status = 'INVALIDATED';
      row.invalidated_at = now.toISOString();
      row.updated_at = row.invalidated_at;
      return { outcome: 'VERIFICATION_EXPIRED', lead: await this.getLead(input.sessionId, input.sessionSecret), verification: parseEmailVerificationRow(row, { includeHash: true }) };
    }
    if (Number(row.attempt_count) >= Number(row.max_attempts)) {
      row.status = 'INVALIDATED';
      row.invalidated_at = now.toISOString();
      row.updated_at = row.invalidated_at;
      return { outcome: 'MAX_ATTEMPTS_REACHED', lead: await this.getLead(input.sessionId, input.sessionSecret), verification: parseEmailVerificationRow(row, { includeHash: true }) };
    }
    if (row.code_hash !== input.codeHash) {
      row.attempt_count = Number(row.attempt_count) + 1;
      if (Number(row.attempt_count) >= Number(row.max_attempts)) {
        row.status = 'INVALIDATED';
        row.invalidated_at = now.toISOString();
        row.updated_at = row.invalidated_at;
        return { outcome: 'MAX_ATTEMPTS_REACHED', lead: await this.getLead(input.sessionId, input.sessionSecret), verification: parseEmailVerificationRow(row, { includeHash: true }) };
      }
      row.updated_at = now.toISOString();
      return { outcome: 'VERIFICATION_INVALID', lead: await this.getLead(input.sessionId, input.sessionSecret), verification: parseEmailVerificationRow(row, { includeHash: true }) };
    }
    row.status = 'CONSUMED';
    row.consumed_at = now.toISOString();
    row.updated_at = row.consumed_at;
    const lead = this.leads.get(input.sessionId);
    if (lead && lead.id === row.lead_id && lead.email_normalized === row.email_normalized) {
      lead.email_verified_at = row.consumed_at;
      lead.updated_at = row.consumed_at;
    }
    return { outcome: 'VERIFIED', lead: lead ? parseLeadRow(lead) : null, verification: parseEmailVerificationRow(row, { includeHash: true }) };
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

  async getLatestOutput(sessionId: string, sessionSecret: string, outputType?: SaveOutputInput['outputType'], parentMasterId?: string | null): Promise<PersistedOutput | null> {
    this.requireMemoryOwnership(sessionId, sessionSecret);
    const row = [...this.outputs.values()]
      .filter((item) => item.session_id === sessionId)
      .filter((item) => !outputType || item.output_type === outputType)
      .filter((item) => parentMasterId === undefined || item.parent_master_id === parentMasterId)
      .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))[0];
    return row ? parseOutputRow(row) : null;
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

  private findOwnedVerification(verificationId: string, sessionSecret: string): DbRow {
    const row = this.verifications.get(verificationId);
    if (!row) throw new Annunci10xPersistenceError('Annunci 10x email verification not found.', 'OWNERSHIP');
    this.requireMemoryOwnership(String(row.session_id), sessionSecret);
    return row;
  }

  private invalidateActiveMemoryVerifications(sessionId: string, leadId: string): void {
    const now = new Date().toISOString();
    for (const row of this.verifications.values()) {
      if (row.session_id === sessionId && row.lead_id === leadId && !row.consumed_at && !row.invalidated_at && (row.status === 'PENDING_SEND' || row.status === 'SENT')) {
        row.status = 'INVALIDATED';
        row.invalidated_at = now;
        row.updated_at = now;
      }
    }
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

function parseRateLimitRow(row: DbRow): CheckRateLimitResult {
  return {
    allowed: row.allowed === true,
    retryAfterSeconds: typeof row.retry_after_seconds === 'number' ? row.retry_after_seconds : 0,
    remaining: typeof row.remaining === 'number' ? row.remaining : 0,
    resetAt: typeof row.reset_at === 'string' ? row.reset_at : new Date().toISOString(),
  };
}

function parseVerifyEmailCodeResult(row: DbRow): VerifyEmailCodeResult {
  const outcome = typeof row.outcome === 'string' ? row.outcome as VerifyEmailCodeResult['outcome'] : 'VERIFICATION_INVALID';
  const lead = row.lead && typeof row.lead === 'object' ? parseLeadRow(row.lead as DbRow) : null;
  const verification = row.verification && typeof row.verification === 'object' ? parseEmailVerificationRow(row.verification as DbRow, { includeHash: true }) : null;
  return { outcome, lead, verification };
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
