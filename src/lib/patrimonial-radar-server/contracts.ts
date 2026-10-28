import type { AnswerRevision, AssessmentInput, CanonicalResult } from '../patrimonial-radar/types.ts';
import type { VERSIONS } from '../patrimonial-radar/versions.ts';

export const BACKEND_VERSION = 'patrimonial-radar-backend-1' as const;
export const SERVICE_NOTICE_VERSION = 'RP-SERVICE-5A-DRAFT-1' as const;
export type Versions = typeof VERSIONS;
export type EntryMode = 'DIRECT' | 'EVENT' | 'POST_EVENT';
export type FailureCode = 'INVALID' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'REPLAY_EXPIRED' | 'VERSION_MISMATCH' | 'INCOMPLETE' | 'UNAVAILABLE';
const status: Record<FailureCode, number> = { INVALID: 400, UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, REPLAY_EXPIRED: 410, VERSION_MISMATCH: 409, INCOMPLETE: 422, UNAVAILABLE: 503 };
export class RadarBackendError extends Error {
  readonly status: number;
  readonly code: FailureCode;
  constructor(code: FailureCode) { super(code); this.name = 'RadarBackendError'; this.code = code; this.status = status[code]; }
}
export interface VerifiedSession { personId: string; expiresAt: string }
export interface Assessment {
  id: string; revision: number; status: 'DRAFT' | 'COMPLETED'; entryMode: EntryMode;
  versions: Versions; input: AssessmentInput; createdAt: string; updatedAt: string;
}
export interface Snapshot {
  id: string; assessmentId: string; approvedRevision: number; versions: Versions;
  inputHash: string; resultHash: string; result: CanonicalResult;
  answerRefs: { id: string; revision: number; questionVersion: number; asOf: string }[];
  completedAt: string;
}
export interface SavedAnswer { revision: number; answerRevision: number; replay: boolean }
/** Only trusted server adapters implement this port; commands never come from HTTP bodies. */
export interface RadarRpc {
  invoke<T>(command: Readonly<Record<string, unknown>>): Promise<T>;
}
export interface SimulatedEmailProvider {
  readonly kind: 'SIMULATED';
  sendCode(input: OtpDelivery): Promise<void>;
}
export interface OtpDelivery { email: string; code: string; expiresInSeconds: number; challengeId?: string }
export interface TransactionalEmailProvider {
  readonly kind: 'RESEND';
  sendCode(input: OtpDelivery): Promise<void>;
}
export type RadarEmailProvider = SimulatedEmailProvider | TransactionalEmailProvider;
export type AnswerRecord = AnswerRevision;
