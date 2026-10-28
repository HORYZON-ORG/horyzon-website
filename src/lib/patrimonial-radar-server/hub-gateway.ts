import {advisorProjection} from '../patrimonial-radar-advisor/projection.ts';
import type {AdvisorSource} from '../patrimonial-radar-advisor/contracts.ts';
import {RadarBackendError} from './contracts.ts';
import {object,validUuid,revision} from './security.ts';
import {FOUNDATION_VERSION} from './foundation.ts';
import {unwrap} from './store.ts';

export function validateHubCommand(value:unknown):Record<string,unknown>{
  const v=object(value,['method','id','filters','operatorId','expectedRevision','requestId']);
  if(!['list','person','report','assign','reassign','release'].includes(String(v.method)))throw new RadarBackendError('INVALID');
  if(v.method!=='list'&&!validUuid(v.id))throw new RadarBackendError('INVALID');
  if(v.method==='list'){
    const f=object(v.filters??{},['status','origin','operatorId','from','to','search','sort','eventLinked']);
    if(Object.values(f).some(x=>typeof x!=='string'||x.length>120))throw new RadarBackendError('INVALID');
    if(f.status&&!['DRAFT','COMPLETED'].includes(String(f.status))||f.origin&&!['DIRECT','EVENT'].includes(String(f.origin))||f.operatorId&&f.operatorId!=='UNASSIGNED'&&!validUuid(f.operatorId)||f.sort&&!['NEWEST','OLDEST'].includes(String(f.sort))||f.eventLinked&&!['true','false'].includes(String(f.eventLinked)))throw new RadarBackendError('INVALID');
    return {method:'list',filters:f};
  }
  if(['assign','reassign','release'].includes(String(v.method))){
    if(!validUuid(v.requestId)||v.method!=='release'&&!validUuid(v.operatorId))throw new RadarBackendError('INVALID');
    revision(v.expectedRevision);
  }
  return v;
}
/** Local-only server transport. JWT verification and live session/permission/P1
 * decisions happen in PostgREST + the database, not in a hidden React component. */
export class LocalPatrimonialHubGateway {
  private readonly url:string;
  private readonly fetchImpl:typeof fetch;
  constructor(url:string,fetchImpl:typeof fetch=fetch){
    const u=new URL(url);
    if(typeof window!=='undefined'||u.protocol!=='http:'||u.hostname!=='127.0.0.1'||u.pathname!=='/'||u.search||u.hash||u.username||u.password)throw new RadarBackendError('UNAVAILABLE');
    this.url=u.origin;this.fetchImpl=fetchImpl;
  }
  async command(token:string,raw:unknown){
    const command=validateHubCommand(raw);
    if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)||token.length>12000)throw new RadarBackendError('UNAUTHENTICATED');
    try{
      const response=await this.fetchImpl(this.url+'/rpc/patrimonial_radar_command',{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Content-Profile':'hub','Accept-Profile':'hub'},body:JSON.stringify({p_command:{contract:FOUNDATION_VERSION,...command}})});
      if(response.status===401)throw new RadarBackendError('UNAUTHENTICATED');
      if(response.status===403)throw new RadarBackendError('FORBIDDEN');
      if(!response.ok)throw new RadarBackendError('UNAVAILABLE');
      const data=unwrap<unknown>(await response.json());
      return command.method==='report'?{projection:advisorProjection(data as AdvisorSource),caseId:command.id}:data;
    }catch(e){if(e instanceof RadarBackendError)throw e;throw new RadarBackendError('UNAVAILABLE');}
  }
}
export async function handleLocalHubGateway(request:Request,env:Readonly<Record<string,string|undefined>>=process.env){
  const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'};
  if(env.PATRIMONIAL_RADAR_HUB_CONTEXT!=='local-test'||env.VERCEL||env.VERCEL_ENV==='production')return Response.json({error:'NOT_FOUND'},{status:404,headers});
  try{
    const origin=new URL(env.PATRIMONIAL_RADAR_HUB_LOCAL_ORIGIN??'');
    if(origin.hostname!=='127.0.0.1'||origin.protocol!=='http:'||request.method!=='POST'||request.headers.get('origin')!==origin.origin||request.headers.get('x-patrimonial-hub')!=='5a'||request.headers.get('content-type')?.split(';')[0]!=='application/json'||new URL(request.url).search)throw new RadarBackendError('FORBIDDEN');
    const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];if(!token)throw new RadarBackendError('UNAUTHENTICATED');
    const reader=request.body?.getReader();if(!reader)throw new RadarBackendError('INVALID');
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>16384){await reader.cancel();throw new RadarBackendError('INVALID');}chunks.push(part.value);}
    let body:unknown;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new RadarBackendError('INVALID');}
    const gateway=new LocalPatrimonialHubGateway(env.PATRIMONIAL_RADAR_HUB_LOCAL_POSTGREST??'');
    return Response.json(await gateway.command(token,body),{headers});
  }catch(e){const error=e instanceof RadarBackendError?e:new RadarBackendError('UNAVAILABLE');return Response.json({error:error.code},{status:error.status,headers});}
}
