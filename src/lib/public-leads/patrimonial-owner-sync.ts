import { getPatrimonialRemoteMapping } from './patrimonial-highlevel-config.ts';
import { ownerGates, verifiedOwnerUser, type PatrimonialOwnerProvider } from './patrimonial-owner-provider.ts';
import type { OwnerContext, OwnerObservation, OwnerFinish, PatrimonialOwnerStore } from './patrimonial-owner-operations.ts';

// Server invocation only; no public route or scheduler is installed by P2B.
export async function runPatrimonialOwnerSyncOnce(store:PatrimonialOwnerStore,provider:PatrimonialOwnerProvider,
  options:{env?:()=>Record<string,string|undefined>;now?:()=>Date}={}) {
  const env=options.env??(()=>process.env), now=()=> (options.now??(()=>new Date()))().toISOString();
  const enabled=()=>ownerGates(env());
  if(!enabled()) return {state:'DISABLED'};
  const [operation]=await store.claimOwnerOperations({now:now(),limit:1,reconciliationOnly:true});
  const op=operation??(await store.claimOwnerOperations({now:now(),limit:1}))[0];
  if(!op) return {state:'IDLE'};
  const claim={operationId:op.id,leaseToken:op.leaseToken!,leaseVersion:op.leaseVersion,now:now()};
  let dispatched=op.owner.effectMayHaveCommitted;
  const finish=async(outcome:OwnerFinish['outcome'],reason:string,observation?:OwnerObservation)=>{
    await store.finishOwnerOperation({...claim,now:now(),outcome,reason,...(observation?{observation}:{})}); return {state:outcome,reason};
  };
  const identity=(ctx:OwnerContext,row:OwnerObservation)=>{
    const i=ctx.intent, mapping=getPatrimonialRemoteMapping(env());
    return row.id===i.remote?.id && row.locationId===i.locationId && row.locationId===provider.locationId && row.contactId===i.contactId
      && row.pipelineId===mapping.pipelines[i.pipeline].id && i.remote?.pipelineId===row.pipelineId && (row.businessKey===null||row.businessKey===i.businessKey)
      && (typeof row.assignedTo==='string'&&row.assignedTo.length>0 || row.assignedTo===null);
  };
  try {
    let ctx=await store.getOwnerContext(claim);
    if(!ctx.valid) return await finish(dispatched?'HOLD':'SUPERSEDED','STALE_ASSIGNMENT');
    if(!enabled()) return await finish('HOLD','DISABLED');
    if(!ctx.intent.remote?.id) return await finish('HOLD','OPPORTUNITY_NOT_READY');
    if(!provider.capabilities.usersRead || !provider.capabilities.opportunityOwnerRead || !provider.capabilities.opportunityOwnerWrite) return await finish('HOLD','MAPPED_UNVERIFIED');
    let user=await provider.readRemoteUser(op.owner.targetRemoteUserRef);
    if(!verifiedOwnerUser(user,op.owner.targetRemoteUserRef,provider.locationId)) return await finish('HOLD','MAPPED_UNVERIFIED');
    let row=await provider.getOpportunity(ctx.intent.remote.id);
    if(!identity(ctx,row)) return await finish('HOLD','OPPORTUNITY_IDENTITY');
    if(row.assignedTo===op.owner.targetRemoteUserRef) return await finish('CONFIRMED','READ_CONFIRMED',row);
    if(row.assignedTo!==op.owner.expectedOwnerRef || op.owner.expectedOwnerRef===op.owner.targetRemoteUserRef) return await finish('HOLD','REMOTE_CHANGED');
    if(op.reconcileRequired || dispatched) return await finish('REPLAN','OLD_OWNER_READ_CONFIRMED',row);
    await store.renewLease({...claim,now:now(),leaseSeconds:60});
    user=await provider.readRemoteUser(op.owner.targetRemoteUserRef);
    if(!verifiedOwnerUser(user,op.owner.targetRemoteUserRef,provider.locationId)) return await finish('HOLD','MAPPED_UNVERIFIED');
    // Refresh remote drift immediately before the local dispatch boundary.
    row=await provider.getOpportunity(ctx.intent.remote.id);
    if(!identity(ctx,row)) return await finish('HOLD','OPPORTUNITY_IDENTITY');
    if(row.assignedTo===op.owner.targetRemoteUserRef) return await finish('CONFIRMED','READ_CONFIRMED',row);
    if(row.assignedTo!==op.owner.expectedOwnerRef) return await finish('HOLD','REMOTE_CHANGED');
    if(!enabled()) return await finish('HOLD','DISABLED');
    ctx=await store.authorizeOwnerWrite({...claim,now:now()});
    if(!ctx.valid) return await finish('SUPERSEDED','STALE_ASSIGNMENT');
    dispatched=true; // The durable marker committed before any HTTP dispatch.
    if(!enabled()) return await finish('RECONCILE_REQUIRED','DISABLED_AT_DISPATCH');
    await provider.updateOpportunityOwner(row,user);
    const confirmed=await provider.getOpportunity(ctx.intent.remote!.id);
    if(!identity(ctx,confirmed) || confirmed.assignedTo!==op.owner.targetRemoteUserRef) return await finish('RECONCILE_REQUIRED','READ_BACK_UNCONFIRMED');
    if(!enabled()) return await finish('RECONCILE_REQUIRED','DISABLED_AFTER_DISPATCH');
    return await finish('CONFIRMED','READ_BACK_CONFIRMED',confirmed);
  } catch {
    // No inline PUT retry, including a lost checkpoint ACK. Lease loss can also
    // prevent this mutation; the durable dispatch marker survives lease recovery.
    try {return await finish(dispatched?'RECONCILE_REQUIRED':'HOLD',dispatched?'OUTCOME_UNCERTAIN':'MAPPED_UNVERIFIED');}
    catch {return {state:'CHECKPOINT_UNCONFIRMED'};}
  }
}
