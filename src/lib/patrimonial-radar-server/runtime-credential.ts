import {randomUUID,createHash} from 'node:crypto';
import {importJWK,SignJWT,decodeJwt,type JWK} from 'jose';
import {RadarBackendError} from './contracts.ts';

type Lease={token:string;tokenId:string;expiresAt:number;deploymentId:string;deploymentOrigin:string};
export type RuntimeCredential=()=>Promise<string>;
type LeaseConfig={issuer:string;originId:string;proofJwk:JWK;deploymentId:string;deploymentOrigin:string;
  oidc:(audience:string)=>Promise<string>;fetchImpl?:typeof fetch;now?:()=>number};
/** Only the short Supabase lease is cached. OIDC is fetched afresh from the
 * platform on every exchange; the DB remains authoritative on every RPC. */
export class RuntimeLeases {
  private lease:Lease|undefined;private inflight:Promise<string>|undefined;
  private instanceId=randomUUID();private previousTokenId:string|null=null;
  private config:LeaseConfig;
  constructor(config:LeaseConfig){
    this.config=config;
    if(typeof window!=='undefined'||!config.issuer.startsWith('https://')||new URL(config.issuer).origin!==config.issuer
      ||!config.proofJwk.d||config.proofJwk.kty!=='EC'||config.proofJwk.crv!=='P-256')throw new RadarBackendError('UNAVAILABLE');
  }
  get:RuntimeCredential=async()=>{
    const now=Math.floor((this.config.now??Date.now)()/1000);
    if(this.lease&&this.lease.expiresAt>now+60)return this.lease.token;
    if(this.inflight)return this.inflight;
    this.lease=undefined;
    this.inflight=this.exchange().catch(()=>{
      // A response can be lost after commit. A new independently proven slot
      // recovers without replaying an ambiguous CAS or using the old JWT.
      this.instanceId=randomUUID();this.previousTokenId=null;
      throw new RadarBackendError('UNAVAILABLE');
    }).finally(()=>{this.inflight=undefined;});
    return this.inflight;
  };
  private async exchange(){
    const now=Math.floor((this.config.now??Date.now)()/1000),audience=this.config.issuer+'/v1/lease';
    const oidc=await this.config.oidc(audience),key=await importJWK(this.config.proofJwk,'ES256');
    const body={originId:this.config.originId,instanceId:this.instanceId,previousTokenId:this.previousTokenId};
    const proof=await new SignJWT({...body,htm:'POST',htu:audience,ath:createHash('sha256').update(oidc).digest('base64url')})
      .setProtectedHeader({alg:'ES256',typ:'JWT'}).setAudience(audience).setSubject(body.originId).setJti(randomUUID())
      .setIssuedAt(now).setNotBefore(now).setExpirationTime(now+30).sign(key);
    const r=await (this.config.fetchImpl??fetch)(audience,{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000),
      headers:{Authorization:'Bearer '+oidc,'Content-Type':'application/json'},body:JSON.stringify({...body,proof})});
    if(!r.ok){await r.body?.cancel();throw Error();}
    const value=await r.text();if(value.length>8192)throw Error();const lease=JSON.parse(value) as Lease;
    const c=decodeJwt(lease.token);
    // Configuration guard only. Supabase/PostgREST verifies the signature; the
    // database verifies the atomic jti/origin authorization, including revoke.
    if(lease.deploymentId!==this.config.deploymentId||lease.deploymentOrigin!==this.config.deploymentOrigin||lease.tokenId!==c.jti
      ||lease.expiresAt!==c.exp||typeof c.exp!=='number'||c.exp<=now+30||c.exp>now+300||c.iss!==this.config.issuer
      ||c.aud!=='authenticated'||c.role!=='patrimonial_radar_runtime'||c.ref!=='pmkyeqrfkunypfkbjnyg'
      ||c.origin_id!==this.config.originId||c.deployment_id!==this.config.deploymentId)throw Error();
    this.lease=lease;this.previousTokenId=lease.tokenId;return lease.token;
  }
}
