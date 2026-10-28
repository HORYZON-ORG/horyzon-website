import {advisorProjection} from '../patrimonial-radar-advisor/projection.ts';
import type {AdvisorSource} from '../patrimonial-radar-advisor/contracts.ts';
import {RadarBackendError} from './contracts.ts';
import {RADAR_PROJECT_REF,protectedRemoteConfigured,remoteOrigin} from './remote-config.ts';
import {unwrap} from './store.ts';
import {validateHubCommand} from './hub-gateway.ts';
type Env=Readonly<Record<string,string|undefined>>;
/** Uses the staff's signed provider JWT, never the runtime token/service role.
 * Auth verifies issuer/signature; SQL independently checks live auth.sessions,
 * explicit grants, verified contact binding and current P1 assignment. */
export async function remoteHubReport(token:string,command:unknown,apiKey:string,fetchImpl:typeof fetch=fetch){
  const c=validateHubCommand(command);
  if(c.method!=='report')throw new RadarBackendError('FORBIDDEN');
  if(!apiKey.startsWith('sb_publishable_')||!/^\w[\w-]*\.[\w-]+\.[\w-]+$/.test(token)||token.length>12000)throw new RadarBackendError('UNAUTHENTICATED');
  const base='https://'+RADAR_PROJECT_REF+'.supabase.co';
  const user=await fetchImpl(base+'/auth/v1/user',{headers:{apikey:apiKey,Authorization:'Bearer '+token},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
  if(!user.ok){await user.body?.cancel();throw new RadarBackendError('UNAUTHENTICATED');}
  const identity=await user.json();
  if(!identity?.id)throw new RadarBackendError('UNAUTHENTICATED');
  const r=await fetchImpl(base+'/rest/v1/rpc/patrimonial_radar_command',{method:'POST',headers:{apikey:apiKey,Authorization:'Bearer '+token,'Content-Type':'application/json','Content-Profile':'hub','Accept-Profile':'hub'},body:JSON.stringify({p_command:{contract:'patrimonial-foundation-5a-1',...c}}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
  if(!r.ok){await r.body?.cancel();throw new RadarBackendError(r.status===401?'UNAUTHENTICATED':r.status===403?'FORBIDDEN':'UNAVAILABLE');}
  return {caseId:c.id,projection:advisorProjection(unwrap<AdvisorSource>(await r.json()))};
}
export async function handleRemoteHubGateway(request:Request,env:Env){
  const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'};
  if(!protectedRemoteConfigured(env)||env.PATRIMONIAL_RADAR_HUB_CONTEXT!=='protected-remote')return Response.json({error:'NOT_FOUND'},{status:404,headers});
  try{
    if(request.method!=='POST'||new URL(request.url).origin!==remoteOrigin(env)||new URL(request.url).search
      ||request.headers.get('origin')!=='https://hub.horyzon.it'||request.headers.get('x-patrimonial-hub')!=='5a'
      ||request.headers.get('content-type')?.split(';')[0]!=='application/json')throw new RadarBackendError('FORBIDDEN');
    const reader=request.body?.getReader();if(!reader)throw new RadarBackendError('INVALID');
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>16384){await reader.cancel();throw new RadarBackendError('INVALID');}chunks.push(part.value);}
    const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];if(!token)throw new RadarBackendError('UNAUTHENTICATED');
    const raw=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return Response.json(await remoteHubReport(token,raw,env.PATRIMONIAL_RADAR_PUBLISHABLE_KEY??''),{headers});
  }catch(e){const error=e instanceof RadarBackendError?e:new RadarBackendError('UNAVAILABLE');return Response.json({error:error.code},{status:error.status,headers});}
}
