import { makeOwnerOperation } from './patrimonial-owner-operations.ts';
import { createHash, randomUUID } from 'node:crypto';
import { PatrimonialConflictError, patrimonialFlags, type PatrimonialAssignmentStore } from './patrimonial-store.ts';

// Server domain only. Public lead-v2, remote ownerId and CRM transport are untouched.
export const assignmentMethods = ['MANUAL', 'ROUND_ROBIN', 'BALANCED_BATCH'] as const;
export type AssignmentMethod = typeof assignmentMethods[number];
export const assignmentExperimentStates = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] as const;
type Metadata = Record<string, string>;
export type AssignmentActor = { type: 'SYSTEM' | 'ADMIN' | 'WORKER'; ref: string };
export type PatrimonialOperator = {
  id: string; operatorKey: string; displayName: string; remoteUserRef: string | null; active: boolean;
  role: string | null; capacity: number | null; sortOrder: number; metadata: Metadata;
  revision: number; createdAt: string; updatedAt: string;
};
export type OperatorPool = { id: string; poolKey: string; name: string; active: boolean; assignmentPolicy: AssignmentMethod; metadata: Metadata; revision: number; createdAt: string; updatedAt: string };
export type PoolMember = { id: string; poolId: string; operatorId: string; active: boolean; weight: number | null; joinedAt: string; leftAt: string | null };
export type LeadQuality = {
  requestId: string | null; funnel: string; source: string | null; medium: string | null; campaign: string | null;
  profile: string | null; maturityLevel: string | null; consultationRequested: boolean | null; attributes: Metadata;
};
export type LeadSnapshot = LeadQuality & { id: string; snapshotKey: string; intentId: string; schemaVersion: 1; capturedAt: string };
export type ProspectAssignment = {
  id: string; assignmentKey: string; intentId: string; operatorId: string; poolId: string | null; experimentId: string | null;
  assignmentMethod: AssignmentMethod; qualitySnapshotId: string | null; assignedAt: string; releasedAt: string | null; releaseReason: string | null;
  assignedByType: AssignmentActor['type']; assignedByRef: string | null; commandKey: string; revision: number; metadata: Metadata; createdAt: string;
};
export type AssignmentExperiment = {
  id: string; experimentKey: string; name: string; status: typeof assignmentExperimentStates[number]; poolId: string | null;
  assignmentMethod: AssignmentMethod; targetPerOperator: number | null; configuration: Metadata; revision: number;
  startedAt: string | null; endedAt: string | null; createdAt: string; updatedAt: string;
};
export type AssignmentIntent = { id: string; kind: string; status: string; revision: number; operatorRevision: number; currentOperatorId: string | null; ownerRef: string | null; quality: LeadQuality; ownerCheckpointRevision?: number; businessKey?: string };
export type AssignmentContext = {
  revision: number; receipt: { payloadHash: string; result: AssignmentResult } | null;
  operators: PatrimonialOperator[]; pools: OperatorPool[]; members: PoolMember[];
  experiments: AssignmentExperiment[]; experimentOperators: { experimentId: string; operatorId: string }[];
  assignments: ProspectAssignment[]; snapshots: LeadSnapshot[]; intents: AssignmentIntent[]; cursors: Record<string, string>;
};
export type AssignmentResult = { operator?: PatrimonialOperator; pool?: OperatorPool; experiment?: AssignmentExperiment; assignments?: ProspectAssignment[]; assignmentStates?: Record<string, ReturnType<typeof assignmentRemoteState>>; released?: string; localState?: 'LOCAL_ASSIGNED'; remoteOwnerState?: 'REMOTE_OWNER_UNMAPPED' | 'REMOTE_OWNER_SYNC_DISABLED' | 'REMOTE_OWNER_SYNC_PENDING'; ownerOperationKeys?: string[]; revision?: number };
export type AssignmentWrite = { kind: 'operator' | 'pool' | 'member' | 'experiment' | 'experimentOperators' | 'snapshot' | 'assignment' | 'release' | 'intentOperator' | 'event' | 'cursor' | 'ownerOperation'; value: Record<string, unknown> };
export type AssignmentPlan = { commandKey: string; payloadHash: string; result: AssignmentResult; writes: AssignmentWrite[]; at: string };
type Base = { commandKey: string; actor: AssignmentActor };
type OperatorInput = Pick<PatrimonialOperator, 'operatorKey' | 'displayName'> & Partial<Pick<PatrimonialOperator, 'remoteUserRef' | 'active' | 'role' | 'capacity' | 'sortOrder' | 'metadata'>>;
type AssignInput = { intentId: string; expectedRevision: number; operatorId?: string; poolId?: string; experimentId?: string; overrideCapacity?: boolean };
export type AssignmentCommand = Base & (
  | { type: 'createOperator'; operator: OperatorInput }
  | { type: 'updateOperator'; operatorId: string; expectedRevision: number; patch: Partial<Omit<OperatorInput, 'operatorKey'>> }
  | { type: 'deactivateOperator'; operatorId: string; expectedRevision: number }
  | { type: 'createPool'; poolKey: string; name: string; assignmentPolicy?: AssignmentMethod }
  | { type: 'setPoolMembership'; poolId: string; expectedRevision: number; operatorIds: string[] }
  | ({ type: 'assignProspect' | 'reassignProspect'; method: 'MANUAL' | 'ROUND_ROBIN' } & AssignInput)
  | { type: 'requestOwnerSync'; intentId: string; expectedRevision: number }
  | { type: 'releaseProspect'; intentId: string; expectedRevision: number; reason: 'MANUAL_RELEASE' | 'INTENT_CLOSED' }
  | { type: 'createAssignmentExperiment'; experimentKey: string; name: string; poolId?: string; method: AssignmentMethod; targetPerOperator?: number; configuration?: Metadata }
  | { type: 'setExperimentOperators'; experimentId: string; expectedRevision: number; operatorIds: string[] }
  | { type: 'activateAssignmentExperiment' | 'pauseAssignmentExperiment' | 'completeAssignmentExperiment'; experimentId: string; expectedRevision: number }
  | { type: 'assignBalancedBatch'; leads: { intentId: string; expectedRevision: number }[]; poolId?: string; experimentId?: string }
);
export class PatrimonialAssignmentError extends Error {
  readonly code: 'DISABLED' | 'INVALID' | 'NOT_ASSIGNABLE' | 'CAPACITY' | 'NO_ELIGIBLE_OPERATOR' | 'EXPERIMENT_STATE';
  constructor(code: PatrimonialAssignmentError['code']) { super(`Patrimonial assignment ${code}`); this.code=code; }
}
const requireAssignment: (value: unknown, code?: PatrimonialAssignmentError['code']) => asserts value = (value, code = 'INVALID') => { if (!value) throw new PatrimonialAssignmentError(code); };
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const key = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_:-]{0,159}$/.test(value);
const label = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 120 && !/[\r\n]/.test(value);
function metadata(value: Metadata = {}): Metadata {
  requireAssignment(value && !Array.isArray(value) && Object.entries(value).every(([k,v]) => ['policyVersion','reasonCode','cohortKey'].includes(k) && key(v)));
  return structuredClone(value);
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    requireAssignment(Object.getPrototypeOf(value)===Object.prototype || Object.getPrototypeOf(value)===null);
    return '{' + Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',') + '}';
  }
  requireAssignment(typeof value!=='number' || Number.isFinite(value));
  return JSON.stringify(value) ?? 'null';
}
export function resolveRemoteOwner(operator: Pick<PatrimonialOperator, 'remoteUserRef'>): string | null { return operator.remoteUserRef; }
export function assignmentRemoteState(operator: Pick<PatrimonialOperator, 'remoteUserRef'>, enqueued=false) {
  return { localState: 'LOCAL_ASSIGNED' as const, remoteOwnerState: resolveRemoteOwner(operator) === null ? 'REMOTE_OWNER_UNMAPPED' as const : enqueued ? 'REMOTE_OWNER_SYNC_PENDING' as const : 'REMOTE_OWNER_SYNC_DISABLED' as const };
}
function revision(actual: number, expected: number) { if (!Number.isInteger(expected) || actual !== expected) throw new PatrimonialConflictError(); }
function validOperator(operator: PatrimonialOperator) {
  requireAssignment(key(operator.operatorKey) && label(operator.displayName) && (operator.remoteUserRef === null || key(operator.remoteUserRef)) && (operator.role === null || key(operator.role)));
  requireAssignment(typeof operator.active === 'boolean' && Number.isInteger(operator.sortOrder) && (operator.capacity === null || Number.isInteger(operator.capacity) && operator.capacity >= 0));
  metadata(operator.metadata);
}
const stableOperators = (operators: PatrimonialOperator[]) => [...operators].sort((a,b) => a.sortOrder - b.sortOrder || a.operatorKey.localeCompare(b.operatorKey, 'en') || a.id.localeCompare(b.id));
const dimensions = ['funnel','profile','source','campaign','maturityLevel','consultationRequested'] as const;
function valueOf(snapshot: LeadQuality, dimension: typeof dimensions[number]) { const value = snapshot[dimension]; return value === null || value === '' ? null : String(value); }

// No provider calls. Every callback can rerun after the store's snapshot CAS conflict.
export async function executePatrimonialAssignment(store: PatrimonialAssignmentStore, input: AssignmentCommand, options: { env?: () => Record<string,string | undefined>; now?: () => Date } = {}): Promise<AssignmentResult> {
  const enabled = () => patrimonialFlags((options.env ?? (() => process.env))()).assignments;
  requireAssignment(enabled(), 'DISABLED');
  const command = structuredClone(input);
  requireAssignment(['createOperator','updateOperator','deactivateOperator','createPool','setPoolMembership','assignProspect','reassignProspect','releaseProspect','createAssignmentExperiment','setExperimentOperators','activateAssignmentExperiment','pauseAssignmentExperiment','completeAssignmentExperiment','assignBalancedBatch','requestOwnerSync'].includes(command.type));
  if ('overrideCapacity' in command) requireAssignment(typeof command.overrideCapacity === 'boolean');
  requireAssignment(key(command.commandKey) && command.actor && ['SYSTEM','ADMIN','WORKER'].includes(command.actor.type) && key(command.actor.ref));
  const hash = createHash('sha256').update(canonical(command)).digest('hex');
  const intentIds = command.type === 'assignBalancedBatch' ? command.leads.map(x => x.intentId) : 'intentId' in command ? [command.intentId] : [];
  requireAssignment(intentIds.every(uuid) && new Set(intentIds).size === intentIds.length);
  const experimentId = 'experimentId' in command ? command.experimentId ?? null : null;
  if (experimentId) requireAssignment(uuid(experimentId));
  const at = (options.now ?? (() => new Date()))().toISOString();
  return store.transaction(async tx => {
    requireAssignment(enabled(), 'DISABLED');
    const state = await tx.getAssignmentContext(command.commandKey, intentIds, experimentId);
    if (state.receipt) { if (state.receipt.payloadHash !== hash) throw new PatrimonialConflictError(); return state.receipt.result; }
    const writes: AssignmentWrite[] = [];
    const put = (kind: AssignmentWrite['kind'], value: object) => writes.push({ kind, value: value as Record<string, unknown> });
    const event = (name: string, intentId: string | null, metadataValue: Record<string, unknown>, eventRevision: number, experiment: string | null = null) => put('event', { id:randomUUID(), eventKey:`assignment:${command.commandKey}:${writes.length}`, name, intentId, experimentId:experiment, revision:eventRevision, at, actor:command.actor, metadata:{ ...metadataValue, revisionSpace:'assignment' } });
    const admin = () => requireAssignment(command.actor.type === 'ADMIN');
    const operatorById = (id: string) => { requireAssignment(uuid(id)); const found = state.operators.find(x => x.id === id); requireAssignment(found); return found; };
    const poolById = (id: string) => { requireAssignment(uuid(id)); const found = state.pools.find(x => x.id === id); requireAssignment(found?.active); return found; };
    const experimentById = (id: string) => { const found = state.experiments.find(x => x.id === id); requireAssignment(found, 'EXPERIMENT_STATE'); return found; };
    const activeCount = (id: string) => state.assignments.filter(x => x.operatorId === id && x.releasedAt === null).length;
    let result: AssignmentResult = {};
    const enqueueOwner = (intent: AssignmentIntent, assignment: ProspectAssignment, operator: PatrimonialOperator, operatorRevision: number, recover=false) => {
      if (!patrimonialFlags((options.env ?? (()=>process.env))()).ownerSync || !operator.remoteUserRef) return null;
      const operation=makeOwnerOperation(intent,assignment,operator,operatorRevision,at);
      put('ownerOperation',{operation,recover}); return operation.operationKey;
    };
    switch (command.type) {
      case 'requestOwnerSync': {
        requireAssignment(['ADMIN','SYSTEM'].includes(command.actor.type));
        const intent=state.intents.find(i=>i.id===command.intentId); requireAssignment(intent && intent.kind==='OPPORTUNITY' && intent.status==='OPEN','NOT_ASSIGNABLE');
        revision(intent.operatorRevision,command.expectedRevision);
        const assignment=state.assignments.find(a=>a.intentId===intent.id && a.releasedAt===null && a.operatorId===intent.currentOperatorId);
        requireAssignment(assignment,'NOT_ASSIGNABLE'); const operator=operatorById(assignment.operatorId); requireAssignment(operator.active,'NO_ELIGIBLE_OPERATOR');
        const op=enqueueOwner(intent,assignment,operator,intent.operatorRevision,true);
        result={...assignmentRemoteState(operator),...(op?{remoteOwnerState:'REMOTE_OWNER_SYNC_PENDING' as const,ownerOperationKeys:[op]}:{})};
        break;
      }
      case 'createOperator': {
        admin(); const v = command.operator;
        requireAssignment(v && !state.operators.some(x => x.operatorKey === v.operatorKey));
        const operator: PatrimonialOperator = { id:randomUUID(), operatorKey:v.operatorKey, displayName:v.displayName, remoteUserRef:v.remoteUserRef ?? null, active:v.active ?? true, role:v.role ?? null, capacity:v.capacity ?? null, sortOrder:v.sortOrder ?? 0, metadata:metadata(v.metadata), revision:0, createdAt:at, updatedAt:at };
        validOperator(operator); put('operator', operator); result = { operator }; break;
      }
      case 'updateOperator':
      case 'deactivateOperator': {
        admin(); const old = operatorById(command.operatorId); revision(old.revision, command.expectedRevision);
        const patch = command.type === 'deactivateOperator' ? {active:false} : command.patch;
        requireAssignment(patch && Object.keys(patch).every(k => ['displayName','remoteUserRef','active','role','capacity','sortOrder','metadata'].includes(k)));
        const operator = { ...old, ...patch, revision:old.revision + 1, updatedAt:at }; validOperator(operator);
        put('operator', operator); result = {operator}; break;
      }
      case 'createPool': {
        admin(); requireAssignment(key(command.poolKey) && label(command.name) && !state.pools.some(x => x.poolKey === command.poolKey));
        const pool: OperatorPool = { id:randomUUID(), poolKey:command.poolKey, name:command.name, active:true, assignmentPolicy:command.assignmentPolicy ?? 'ROUND_ROBIN', metadata:{}, revision:0, createdAt:at, updatedAt:at };
        requireAssignment(assignmentMethods.includes(pool.assignmentPolicy)); put('pool', pool); result = {pool}; break;
      }
      case 'setPoolMembership': {
        admin(); const pool = poolById(command.poolId); revision(pool.revision, command.expectedRevision);
        requireAssignment(new Set(command.operatorIds).size === command.operatorIds.length); command.operatorIds.forEach(operatorById);
        for (const member of state.members.filter(x => x.poolId === pool.id && x.active && !command.operatorIds.includes(x.operatorId))) put('member', { ...member, active:false, leftAt:at });
        for (const id of command.operatorIds) if (!state.members.some(x => x.poolId === pool.id && x.operatorId === id && x.active)) put('member', { id:randomUUID(), poolId:pool.id, operatorId:id, active:true, weight:null, joinedAt:at, leftAt:null });
        const next = { ...pool, revision:pool.revision + 1, updatedAt:at }; put('pool', next); result = {pool:next}; break;
      }
      case 'createAssignmentExperiment': {
        admin(); requireAssignment(key(command.experimentKey) && label(command.name) && assignmentMethods.includes(command.method) && !state.experiments.some(x => x.experimentKey === command.experimentKey));
        if (command.poolId) poolById(command.poolId);
        requireAssignment(command.targetPerOperator === undefined || Number.isInteger(command.targetPerOperator) && command.targetPerOperator > 0);
        const experiment: AssignmentExperiment = { id:randomUUID(), experimentKey:command.experimentKey, name:command.name, status:'DRAFT', poolId:command.poolId ?? null, assignmentMethod:command.method, targetPerOperator:command.targetPerOperator ?? null, configuration:{ ...metadata(command.configuration), policyVersion:'marginal-balance-v1' }, revision:0, startedAt:null, endedAt:null, createdAt:at, updatedAt:at };
        put('experiment', experiment); event('assignment_experiment_created', null, {experimentId:experiment.id}, 0, experiment.id); result={experiment}; break;
      }
      case 'setExperimentOperators': {
        admin(); const experiment=experimentById(command.experimentId); revision(experiment.revision,command.expectedRevision);
        requireAssignment(experiment.status === 'DRAFT', 'EXPERIMENT_STATE');
        requireAssignment(command.operatorIds.length > 0 && new Set(command.operatorIds).size === command.operatorIds.length);
        for (const id of command.operatorIds) requireAssignment(operatorById(id).active && (!experiment.poolId || state.members.some(m => m.poolId === experiment.poolId && m.operatorId === id && m.active)));
        put('experimentOperators', {experimentId:experiment.id,operatorIds:command.operatorIds});
        const next={...experiment,revision:experiment.revision+1,updatedAt:at};put('experiment',next);result={experiment:next};break;
      }
      case 'activateAssignmentExperiment':
      case 'pauseAssignmentExperiment':
      case 'completeAssignmentExperiment': {
        admin(); const experiment=experimentById(command.experimentId); revision(experiment.revision,command.expectedRevision);
        const members=state.experimentOperators.filter(x=>x.experimentId===experiment.id);
        if(command.type==='activateAssignmentExperiment') {
          requireAssignment(['DRAFT','PAUSED'].includes(experiment.status) && members.length > 0,'EXPERIMENT_STATE');
          if(experiment.poolId) poolById(experiment.poolId);
          for(const member of members) requireAssignment(operatorById(member.operatorId).active && (!experiment.poolId || state.members.some(m=>m.poolId===experiment.poolId&&m.operatorId===member.operatorId&&m.active)));
        } else requireAssignment(command.type==='pauseAssignmentExperiment' ? experiment.status==='ACTIVE' : ['ACTIVE','PAUSED'].includes(experiment.status),'EXPERIMENT_STATE');
        const next: AssignmentExperiment={...experiment,status:command.type==='activateAssignmentExperiment'?'ACTIVE':command.type==='pauseAssignmentExperiment'?'PAUSED':'COMPLETED',startedAt:command.type==='activateAssignmentExperiment'?(experiment.startedAt??at):experiment.startedAt,endedAt:command.type==='completeAssignmentExperiment'?at:null,revision:experiment.revision+1,updatedAt:at};
        put('experiment',next);event(command.type==='activateAssignmentExperiment'?'assignment_experiment_activated':command.type==='pauseAssignmentExperiment'?'assignment_experiment_paused':'assignment_experiment_completed',null,{experimentId:experiment.id},next.revision,experiment.id);result={experiment:next};break;
      }
      default: {
        const method: AssignmentMethod = command.type === 'assignBalancedBatch' ? 'BALANCED_BATCH' : command.type === 'releaseProspect' ? 'MANUAL' : command.method;
        requireAssignment(assignmentMethods.includes(method));
        if(method==='MANUAL') admin();
        const experiment=experimentId?experimentById(experimentId):null;
        if(experiment) requireAssignment(experiment.status==='ACTIVE' && experiment.assignmentMethod===method,'EXPERIMENT_STATE');
        const poolId = 'poolId' in command ? command.poolId ?? experiment?.poolId ?? null : null;
        requireAssignment(!experiment || (poolId ?? null) === experiment.poolId,'EXPERIMENT_STATE');
        if(poolId) poolById(poolId);
        const leads=command.type==='assignBalancedBatch'?command.leads:[{intentId:command.intentId,expectedRevision:command.expectedRevision}];
        requireAssignment(leads.length>0);
        const produced: ProspectAssignment[]=[];
        for(const lead of [...leads].sort((a,b)=>a.intentId.localeCompare(b.intentId))) {
          const intent=state.intents.find(x=>x.id===lead.intentId);requireAssignment(intent?.kind==='OPPORTUNITY','NOT_ASSIGNABLE');revision(intent.operatorRevision,lead.expectedRevision);
          const current=state.assignments.find(x=>x.intentId===intent.id && x.releasedAt===null);
          requireAssignment((current?.operatorId??null)===intent.currentOperatorId,'NOT_ASSIGNABLE');
          if(command.type==='releaseProspect') {
            requireAssignment(current && ['MANUAL_RELEASE','INTENT_CLOSED'].includes(command.reason),'NOT_ASSIGNABLE');
            put('release',{id:current.id,expectedRevision:current.revision,releasedAt:at,releaseReason:command.reason});
            put('intentOperator',{id:intent.id,expectedRevision:intent.operatorRevision,currentOperatorId:null,businessRevision:intent.revision});
            event('prospect_released',intent.id,{assignmentId:current.id,operatorId:current.operatorId,reason:command.reason},intent.operatorRevision+1,current.experimentId);result={released:current.id,revision:intent.operatorRevision+1};continue;
          }
          requireAssignment(intent.status==='OPEN','NOT_ASSIGNABLE');
          requireAssignment(command.type==='reassignProspect'?!!current:!current,'NOT_ASSIGNABLE');
          const eligible=stableOperators(state.operators.filter(operator=>operator.active && (!poolId || state.members.some(m=>m.poolId===poolId&&m.operatorId===operator.id&&m.active)) && (!experiment || state.experimentOperators.some(m=>m.experimentId===experiment.id&&m.operatorId===operator.id)) && (!experiment?.targetPerOperator || state.assignments.filter(x=>x.experimentId===experiment.id&&x.operatorId===operator.id).length < experiment.targetPerOperator)));
          let operator: PatrimonialOperator | undefined;
          if (method==='MANUAL') requireAssignment('operatorId' in command && uuid(command.operatorId));
          if(method==='MANUAL' && 'operatorId' in command) {
            requireAssignment(command.operatorId); operator=eligible.find(x=>x.id===command.operatorId);requireAssignment(operator,'NO_ELIGIBLE_OPERATOR');
            requireAssignment(operator.capacity===null || activeCount(operator.id)-(current?.operatorId===operator.id?1:0)<operator.capacity || command.overrideCapacity===true,'CAPACITY');
          } else {
            requireAssignment(!('overrideCapacity' in command) || command.overrideCapacity!==true);
            const available=eligible.filter(x=>x.capacity===null || activeCount(x.id)-(current?.operatorId===x.id?1:0)<x.capacity);
            requireAssignment(available.length>0,'NO_ELIGIBLE_OPERATOR');
            if(method==='ROUND_ROBIN') {
              const scope=poolId??'global', last=state.cursors[scope];
              const ordered=eligible.map(x=>x.id), index=ordered.indexOf(last);
              operator=Array.from({length:ordered.length},(_,i)=>eligible[(index+1+i)%eligible.length]).find(x=>available.some(a=>a.id===x.id));
              requireAssignment(operator);state.cursors[scope]=operator.id;put('cursor',{scope,operatorId:operator.id});
            } else {
              const cohort=state.assignments.filter(x=>experiment?x.experimentId===experiment.id:x.commandKey===command.commandKey);
              const counts=(id:string)=>cohort.filter(x=>x.operatorId===id).length;
              const score=(id:string)=>dimensions.reduce((sum,dimension)=>{
                const category=valueOf(intent.quality,dimension);if(category===null)return sum;
                const number=cohort.filter(a=>a.operatorId===id && state.snapshots.some(s=>s.id===a.qualitySnapshotId && valueOf(s,dimension)===category)).length;
                return sum+2*number+1; // delta of marginal squared counts, no Cartesian micro-strata
              },0);
              operator=[...available].sort((a,b)=>counts(a.id)-counts(b.id)||score(a.id)-score(b.id)||eligible.indexOf(a)-eligible.indexOf(b))[0];
            }
          }
          requireAssignment(operator);
          if(current) { put('release',{id:current.id,expectedRevision:current.revision,releasedAt:at,releaseReason:'REASSIGNED'});current.releasedAt=at; }
          const q=intent.quality;
          const snapshot: LeadSnapshot={requestId:q.requestId,funnel:q.funnel,source:q.source,medium:q.medium,campaign:q.campaign,profile:q.profile,maturityLevel:q.maturityLevel,consultationRequested:q.consultationRequested,attributes:structuredClone(q.attributes),id:randomUUID(),snapshotKey:`${command.commandKey}:${intent.id}`,intentId:intent.id,schemaVersion:1,capturedAt:at};
          // A strict projection: direct caller payloads/message are never copied.
          requireAssignment(snapshot.maturityLevel===null && snapshot.consultationRequested===null && Object.keys(snapshot.attributes).length===0);
          const assignment: ProspectAssignment={id:randomUUID(),assignmentKey:`${command.commandKey}:${intent.id}`,intentId:intent.id,operatorId:operator.id,poolId,experimentId:experiment?.id??null,assignmentMethod:method,qualitySnapshotId:snapshot.id,assignedAt:at,releasedAt:null,releaseReason:null,assignedByType:command.actor.type,assignedByRef:command.actor.ref,commandKey:command.commandKey,revision:0,metadata:{policyVersion:'marginal-balance-v1'},createdAt:at};
          if ('overrideCapacity' in command && command.overrideCapacity === true) assignment.metadata.reasonCode='capacity-override';
          put('snapshot',snapshot);put('assignment',assignment);put('intentOperator',{id:intent.id,expectedRevision:intent.operatorRevision,currentOperatorId:operator.id,businessRevision:intent.revision});
          event(current?'prospect_reassigned':'prospect_assigned',intent.id,{assignmentId:assignment.id,operatorId:operator.id,previousAssignmentId:current?.id??null,qualitySnapshotId:snapshot.id,method},intent.operatorRevision+1,experiment?.id??null);
          const ownerKey=enqueueOwner(intent,assignment,operator,intent.operatorRevision+1);
          state.assignments.push(assignment);state.snapshots.push(snapshot);produced.push(assignment);
          result={assignments:produced,assignmentStates:Object.fromEntries(produced.map(a=>[a.id,assignmentRemoteState(operatorById(a.operatorId),writes.some(w=>w.kind==='ownerOperation' && (w.value.operation as {owner:{assignmentId:string}}).owner.assignmentId===a.id))])),...(produced.length===1?assignmentRemoteState(operator):{}),...(ownerKey?{remoteOwnerState:'REMOTE_OWNER_SYNC_PENDING' as const}:{}),ownerOperationKeys:writes.filter(w=>w.kind==='ownerOperation').map(w=>(w.value.operation as {operationKey:string}).operationKey)};
        }
      }
    }
    requireAssignment(enabled(),'DISABLED');
    if(writes.some(w=>w.kind==='ownerOperation')) requireAssignment(patrimonialFlags((options.env ?? (()=>process.env))()).ownerSync,'DISABLED');
    await tx.commitAssignmentPlan({commandKey:command.commandKey,payloadHash:hash,result,writes,at},state.revision);
    return result;
  });
}
