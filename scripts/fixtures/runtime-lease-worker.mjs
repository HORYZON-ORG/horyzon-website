import {RuntimeLeases} from '../../src/lib/patrimonial-radar-server/runtime-credential.ts';
import {decodeJwt} from 'jose';
process.once('message',async c=>{try{
 const provider=new RuntimeLeases({...c,oidc:async()=>c.oidc,fetchImpl:async(url,init)=>{if(url!==c.issuer+'/v1/lease')throw Error();return fetch(c.local,init);}});
 const token=await provider.get();process.send({ok:true,jti:decodeJwt(token).jti},()=>process.exit(0));
}catch{process.send({ok:false},()=>process.exit(1));}});
