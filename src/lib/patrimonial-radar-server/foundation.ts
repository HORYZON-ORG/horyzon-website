import { createHash } from 'node:crypto';
import { BACKEND_VERSION, RadarBackendError, type RadarRpc } from './contracts.ts';
import { RadarSecrets, normalizeEmail, opaqueToken, validToken, validUuid, revision } from './security.ts';

export const FOUNDATION_VERSION = 'patrimonial-foundation-5a-1' as const;
export type ReconciliationState = 'CANDIDATE' | 'VERIFIED' | 'CONFLICT' | 'REVOKED';
/** Internal server port; no remote transport or provider fallback is installed. */
export class PatrimonialFoundation {
  private readonly secrets: RadarSecrets;
  private readonly rpc: RadarRpc;
  constructor(rpc: RadarRpc, secret: string) { this.rpc=rpc; this.secrets = new RadarSecrets(secret); }
  private call<T>(method: string, args: Record<string, unknown>) {
    return this.rpc.invoke<T>({ contract: FOUNDATION_VERSION, keyBinding: this.secrets.hash('store-binding-v1', BACKEND_VERSION), method, ...args });
  }
  private session(token: string) {
    if (!validToken(token)) throw new RadarBackendError('UNAUTHENTICATED');
    return this.secrets.hash('session-v1', token);
  }
  /** Only after canonical durable acquisition. SQL rechecks request, source and hash.
   * Token identifies an invitation, never a person or an authorization to a report. */
  async prepareEvent(requestId: string, declaredEmail: string, payloadHash: string) {
    if (!validUuid(requestId) || !/^[a-f0-9]{64}$/.test(payloadHash)) throw new RadarBackendError('INVALID');
    const token = opaqueToken();
    const email=normalizeEmail(declaredEmail);
    await this.call('prepare_event', { requestId, payloadHash, email, emailKey: this.secrets.hash('email-v1', email), ticketHash: createHash('sha256').update(token).digest('hex') });
    // Fragment prevents the reference being sent in HTTP paths/referrers. The UI
    // must remove it before login and send it in a protected POST after OTP.
    return { href: `/radar-patrimoniale#event=${token}`, expiresInSeconds: 86400 };
  }
  async proposeEvent(token: string, ticket: string) {
    if (!validToken(ticket)) throw new RadarBackendError('INVALID');
    return this.call<{ id: string; state: ReconciliationState; revision: number }>('propose_event', { sessionHash: this.session(token), ticketHash: createHash('sha256').update(ticket).digest('hex') });
  }
  async confirmEvent(token: string, id: string, expectedRevision: number) {
    if (!validUuid(id)) throw new RadarBackendError('INVALID');
    return this.call<{ state: ReconciliationState; revision: number }>('confirm_event', { sessionHash: this.session(token), id, expectedRevision: revision(expectedRevision) });
  }
  async linkAssessment(token: string, assessmentId: string, reconciliationId: string) {
    if (![assessmentId,reconciliationId].every(validUuid)) throw new RadarBackendError('INVALID');
    return this.call('link_assessment', { sessionHash: this.session(token), assessmentId, reconciliationId });
  }
}

/** Simulation-only CRM contract. Closed allowlist: no financial fields or dossier.
 * Person/contact identity and internal responsibility are independent authorities. */
export function planPatrimonialCrmSync(input: {
  personId: string; assessmentId: string; approvedRevision: number;
  binding: { state: ReconciliationState; locationId: string; contactId: string; evidenceRef: string; revision: number } | null;
  internalOperatorId: string | null; verifiedRemoteUserId: string | null; observedRemoteOwnerId: string | null;
  assignment: { intentId:string; operatorId:string|null; revision:number };
  capabilityVerified: boolean;
}) {
  if (!validUuid(input.personId) || !validUuid(input.assessmentId)) throw new RadarBackendError('INVALID');
  revision(input.approvedRevision);
  if(!input.assignment||!validUuid(input.assignment.intentId)||input.assignment.operatorId!==input.internalOperatorId)throw new RadarBackendError('INVALID');
  revision(input.assignment.revision);
  const b=input.binding;
  const validRef=(s:string)=>/^[a-zA-Z0-9_:-]{1,160}$/.test(s);
  if (!b || b.state!=='VERIFIED' || ![b.locationId,b.contactId,b.evidenceRef].every(validRef) || !Number.isSafeInteger(b.revision) || b.revision<0)
    return { status:'HOLD_IDENTITY' as const, writes:[] as never[] };
  if (!input.capabilityVerified) return { status:'HOLD_CAPABILITY' as const, writes:[] as never[] };
  if ((input.internalOperatorId !== null && !validUuid(input.internalOperatorId)) || (input.verifiedRemoteUserId !== null && !validRef(input.verifiedRemoteUserId))) throw new RadarBackendError('INVALID');
  return {
    status: input.observedRemoteOwnerId!==input.verifiedRemoteUserId ? 'RECONCILE_OWNER' as const : 'SIMULATION_ONLY' as const,
    idempotencyKey:`radar:${input.assessmentId}:${input.approvedRevision}:${b.revision}:${input.assignment.revision}`,
    metadata:{ contract:'patrimonial-radar-reference-5a-1' as const,source:'HORYZON_WEBSITE' as const,personId:input.personId,assessmentId:input.assessmentId,approvedRevision:input.approvedRevision,assignment:{authority:'P1' as const,intentId:input.assignment.intentId,operatorId:input.assignment.operatorId,revision:input.assignment.revision},highlevel:{state:b.state,locationId:b.locationId,contactId:b.contactId,evidenceRef:b.evidenceRef,revision:b.revision},execution:'SIMULATION_ONLY' as const },
    // A future worker must consume the canonical P2B operation after all its gates.
    ownerProjection:'P2B_REQUIRED' as const, writes:[] as never[],
  };
}
