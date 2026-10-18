import { PatrimonialCrmError } from './patrimonial-highlevel.ts';
import { patrimonialFlags } from './patrimonial-store.ts';
import { getPatrimonialRemoteMapping } from './patrimonial-highlevel-config.ts';
import type { OwnerObservation } from './patrimonial-owner-operations.ts';

export type RemoteOwnerUser = {remoteUserId:string;locationIds:string[];deleted:boolean;role:string|null;type:string|null};
export type OwnerCapabilities = {usersRead:boolean;opportunityOwnerRead:boolean;opportunityOwnerWrite:boolean};
export interface PatrimonialOwnerProvider {
  readonly locationId: string;
  readonly capabilities: OwnerCapabilities;
  readRemoteUser(id:string): Promise<RemoteOwnerUser>;
  getOpportunity(id:string): Promise<OwnerObservation>;
  updateOpportunityOwner(opportunity:OwnerObservation,user:RemoteOwnerUser): Promise<void>;
}
// Trusted server construction only. External inventory is NOT runtime evidence.
export type OwnerBindingProof = {
  runtimeTokenVerified:true; verifiedLocationId:string; version:'v3';
  usersRead:true; opportunityOwnerRead:true; opportunityOwnerWrite:true;
  ownerOnlyUpdate:true; nullableAssignedTo:boolean; omittedAssignedToMeansUnassigned:boolean;
};
export const ownerGates = (env:Record<string,string|undefined>) => {
  const f=patrimonialFlags(env); return f.v2 && f.assignments && f.crmWrite && f.ownerSync;
};
const idValid = (id:unknown): id is string => typeof id==='string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id);
const schema = (): never => {throw new PatrimonialCrmError('SCHEMA');};
export function verifiedOwnerUser(user:RemoteOwnerUser,id:string,locationId:string): boolean {
  return !!user && user.remoteUserId===id && user.deleted===false && Array.isArray(user.locationIds) && user.locationIds.includes(locationId);
}
export function resolveOwnerUserMapping(ref:string|null,user:RemoteOwnerUser|null,locationId:string): 'UNMAPPED'|'MAPPED_UNVERIFIED'|'MAPPED_VERIFIED' {
  return ref===null?'UNMAPPED':user&&verifiedOwnerUser(user,ref,locationId)?'MAPPED_VERIFIED':'MAPPED_UNVERIFIED';
}
export class PatrimonialHighLevelOwnerProvider implements PatrimonialOwnerProvider {
  readonly locationId:string;
  readonly capabilities:OwnerCapabilities;
  private readonly users = new WeakSet<object>();
  private readonly opportunities = new WeakSet<object>();
  private readonly env:()=>Record<string,string|undefined>;
  private readonly fetchImpl:typeof fetch;
  private readonly proof?:Readonly<OwnerBindingProof>;
  private readonly token:string;
  constructor(options:{env?:()=>Record<string,string|undefined>;fetchImpl?:typeof fetch;proof?:OwnerBindingProof}={}) {
    if(typeof window!=='undefined') throw new PatrimonialCrmError('CONFIG');
    this.env=options.env??(()=>process.env); this.fetchImpl=options.fetchImpl??fetch;
    this.proof=options.proof?Object.freeze({...options.proof}):undefined;
    this.locationId=this.env().HIGHLEVEL_LOCATION_ID?.trim()??''; this.token=this.env().HIGHLEVEL_PRIVATE_TOKEN?.trim()??'';
    const p=this.proof, ready=!!p && p.runtimeTokenVerified===true && p.version==='v3' && p.verifiedLocationId===this.locationId && !!this.token && !/[\r\n]/.test(this.token) && idValid(this.locationId);
    this.capabilities=Object.freeze({usersRead:ready&&p!.usersRead===true,opportunityOwnerRead:ready&&p!.opportunityOwnerRead===true,opportunityOwnerWrite:ready&&p!.opportunityOwnerWrite===true&&p!.ownerOnlyUpdate===true});
  }
  private guard(write=false) {
    const env=this.env();
    if(!ownerGates(env) || env.HIGHLEVEL_PRIVATE_TOKEN?.trim()!==this.token || env.HIGHLEVEL_LOCATION_ID?.trim()!==this.locationId
      || !this.capabilities.usersRead || !this.capabilities.opportunityOwnerRead || (write&&!this.capabilities.opportunityOwnerWrite)) throw new PatrimonialCrmError('CONFIG');
  }
  private async request(path:string,body?:{assignedTo:string}):Promise<unknown> {
    this.guard(body!==undefined);
    let response:Response;
    try {response=await this.fetchImpl(`https://services.leadconnectorhq.com${path}`,{method:body?'PUT':'GET',
      headers:{Authorization:`Bearer ${this.token}`,Version:'v3','Content-Type':'application/json'},
      ...(body?{body:JSON.stringify(body)}:{}),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});
    } catch {throw new PatrimonialCrmError('NETWORK',{outcomeUncertain:!!body});}
    if(!response.ok) throw new PatrimonialCrmError(response.status===401||response.status===403?'AUTH':'PROVIDER',{status:response.status,outcomeUncertain:!!body&&response.status>=500});
    if(body) return null; // Never use an update response as independent read evidence.
    try {return await response.json();} catch {return schema();}
  }
  async readRemoteUser(id:string):Promise<RemoteOwnerUser> {
    if(!idValid(id)) return schema();
    const raw=await this.request(`/users/${encodeURIComponent(id)}`) as Record<string,unknown>;
    const roles=raw?.roles as Record<string,unknown>|undefined;
    if(raw?.id!==id || typeof raw.deleted!=='boolean' || !Array.isArray(roles?.locationIds) || !roles.locationIds.every(idValid)) return schema();
    const result:RemoteOwnerUser={remoteUserId:id,deleted:raw.deleted,locationIds:[...roles.locationIds],role:typeof roles.role==='string'?roles.role:null,type:typeof roles.type==='string'?roles.type:null};
    Object.freeze(result.locationIds); Object.freeze(result); this.users.add(result); return result;
  }
  async getOpportunity(id:string):Promise<OwnerObservation> {
    if(!idValid(id)) return schema();
    const body=await this.request(`/opportunities/${encodeURIComponent(id)}`) as {opportunity?:Record<string,unknown>};
    const raw=body?.opportunity;
    if(!raw || raw.id!==id || raw.locationId!==this.locationId || !idValid(raw.contactId) || !idValid(raw.pipelineId)) return schema();
    const hasAssignedTo=Object.hasOwn(raw,'assignedTo');
    let assignedTo: unknown;
    if(hasAssignedTo) {
      assignedTo=raw.assignedTo;
      if(!(idValid(assignedTo) || assignedTo===null&&this.proof?.nullableAssignedTo===true)) return schema();
    } else {
      if(this.proof?.omittedAssignedToMeansUnassigned!==true) return schema();
      assignedTo=null;
    }
    let businessKey:string|null=null;
    if(raw.customFields!==undefined) {
      if(!Array.isArray(raw.customFields)) return schema();
      const field=getPatrimonialRemoteMapping(this.env()).opportunityFields.hz_intent_key;
      const matches=raw.customFields.filter((v:unknown)=>v && typeof v==='object' && ((v as {id?:unknown}).id===field.id || (v as {key?:unknown}).key===field.fieldKey));
      if(matches.length>1 || matches.length===1 && (typeof matches[0].fieldValue!=='string' || !matches[0].fieldValue)) return schema();
      businessKey=matches[0]?.fieldValue??null;
    }
    const marker=raw.version??raw.updatedAt??raw.dateUpdated;
    if(marker!==undefined && (typeof marker!=='string'||!marker)) return schema();
    const result:OwnerObservation={id,locationId:this.locationId,contactId:raw.contactId,pipelineId:raw.pipelineId,assignedTo:assignedTo as string|null,businessKey,versionMarker:typeof marker==='string'?marker:null};
    Object.freeze(result); this.opportunities.add(result); return result;
  }
  async updateOpportunityOwner(opportunity:OwnerObservation,user:RemoteOwnerUser):Promise<void> {
    this.guard(true);
    if(!this.opportunities.has(opportunity) || !this.users.has(user) || !verifiedOwnerUser(user,user.remoteUserId,this.locationId) || !idValid(user.remoteUserId) || opportunity.locationId!==this.locationId) throw new PatrimonialCrmError('CONFIG');
    await this.request(`/opportunities/${encodeURIComponent(opportunity.id)}`,{assignedTo:user.remoteUserId});
  }
}
