import {RadarBackendError,type RadarRpc} from './contracts.ts';
import {unwrap} from './store.ts';
import {RADAR_PROJECT_REF,RADAR_REMOTE_CONTRACT} from './remote-config.ts';
import type {RuntimeCredential} from './runtime-credential.ts';

/** Least privilege token for a NOLOGIN/NOBYPASSRLS role with EXECUTE on
 * purpose-limited RPCs only. The runtime has no Supabase issuer signing key,
 * service-role credential, raw SQL or table endpoint. PostgREST verifies JWT. */
export class RemoteRadarRpc implements RadarRpc {
  private readonly base:string;
  private readonly apiKey:string;
  private readonly credential:RuntimeCredential;
  private readonly fetchImpl:typeof fetch;
  constructor(config:{url:string;apiKey:string;runtimeToken?:string;credential?:RuntimeCredential;fetchImpl?:typeof fetch}){
    if(typeof window!=='undefined'||config.url!=='https://'+RADAR_PROJECT_REF+'.supabase.co'
      ||!config.apiKey.startsWith('sb_publishable_'))throw new RadarBackendError('UNAVAILABLE');
    if((!!config.runtimeToken)===(!!config.credential))throw new RadarBackendError('UNAVAILABLE');
    if(config.runtimeToken)try{
      const parts=config.runtimeToken.split('.');
      const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
      // This is a configuration guard, NOT signature verification; the database
      // validates signature/role/expiry and the revocable deployment registry.
      if(parts.length!==3||claims.role!=='patrimonial_radar_runtime'||claims.ref!==RADAR_PROJECT_REF
        ||typeof claims.jti!=='string'||typeof claims.exp!=='number'||claims.exp<=Date.now()/1000
        ||claims.exp>Date.now()/1000+3600)throw Error();
    }catch{throw new RadarBackendError('UNAVAILABLE');}
    // Explicit token injection is retained for isolated legacy contract tests.
    // The production factory supplies ONLY the renewable provider.
    this.base=config.url;this.apiKey=config.apiKey;this.credential=config.credential??(async()=>config.runtimeToken!);this.fetchImpl=config.fetchImpl??fetch;
  }
  private async call<T>(fn:string,body:Record<string,unknown>):Promise<T>{
    try{
      const token=await this.credential();
      const r=await this.fetchImpl(this.base+'/rest/v1/rpc/'+fn,{
        method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),
        headers:{apikey:this.apiKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),
      });
      if(!r.ok){await r.body?.cancel();throw new RadarBackendError('UNAVAILABLE');}
      return unwrap<T>(await r.json());
    }catch(e){if(e instanceof RadarBackendError)throw e;throw new RadarBackendError('UNAVAILABLE');}
  }
  async attest(deploymentId:string){
    const health=await this.call<{contract:string;projectRef:string;deploymentId:string}>('patrimonial_radar_runtime_health',{});
    if(health.contract!==RADAR_REMOTE_CONTRACT||health.projectRef!==RADAR_PROJECT_REF||health.deploymentId!==deploymentId)throw new RadarBackendError('UNAVAILABLE');
  }
  async invoke<T>(command:Readonly<Record<string,unknown>>):Promise<T>{
    const fn=command.contract==='patrimonial-foundation-5a-1'?'patrimonial_radar_runtime_foundation':'patrimonial_radar_runtime_command';
    return this.call<T>(fn,{p_command:command});
  }
  /** Purpose-limited acquisition. No caller-supplied ledger command or function. */
  async acquireEvent<T>(request:unknown,consents:unknown):Promise<T>{
    return this.call<T>('patrimonial_radar_runtime_event',{p_request:request,p_consents:consents});
  }
}
