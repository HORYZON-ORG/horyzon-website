import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {fork} from 'node:child_process';
import {createServer} from 'node:http';
import {generateKeyPair,exportJWK,importJWK,SignJWT,createLocalJWKSet,decodeJwt} from 'jose';
import {RuntimeLeases} from '../../src/lib/patrimonial-radar-server/runtime-credential.ts';
import {RemoteRadarRpc} from '../../src/lib/patrimonial-radar-server/remote-store.ts';

/** LOCAL ONLY: real crypto + native restricted DB role, synthetic authority. */
export async function oidcFixture(db,cfg,platform,wire){
 const {CredentialBroker,workload}=await import(pathToFileURL(resolve(platform,'services/radar-credential-broker/src/broker.ts')).href);
 await db.query('drop role if exists patrimonial_radar_issuer');
 await db.query(await readFile(resolve(platform,'packages/database/pending/20261026091550_patrimonial_runtime_oidc_broker_candidate.sql'),'utf8'));
 const originId=randomUUID(),issuer='https://broker.synthetic.invalid',deploymentId='dpl_synthetic',deploymentOrigin='https://horyzon-radar-pilot-synthetic-horyzon-consulting.vercel.app';
 const pop=await generateKeyPair('ES256',{extractable:true}),proofJwk=await exportJWK(pop.privateKey),publicProof=await exportJWK(pop.publicKey);
 let oidcPair=await generateKeyPair('RS256'),kid='synthetic-vercel-1',keyset=createLocalJWKSet({keys:[{...await exportJWK(oidcPair.publicKey),kid}]});
 let issuerOutage=false,registrationFailure=false,transportOutage=false,loseResponse=false,clientOffset=0,oidcReads=0;const audit=[],bodies=[];
 const registry={
  origin:id=>db.transaction(c=>c.query('select patrimonial_radar_private.broker_origin($1) value',[id]),'patrimonial_radar_issuer').then(r=>r.rows[0].value),
  register:p=>{if(registrationFailure)throw Error('SYNTHETIC_ISSUER_DOWN');return db.transaction(c=>c.query('select patrimonial_radar_private.broker_register($1) value',[p]),'patrimonial_radar_issuer').then(r=>r.rows[0].value);},
 };
 await db.query(`insert into patrimonial_radar_private.runtime_origins(id,project_id,environment,deployment_id,deployment_origin,source_sha,oidc_issuer,oidc_audience,oidc_subject,runtime_issuer,proof_jwk,approval_ref,expires_at)
 values($1,$2,'preview',$3,$4,$5,$6,$7,$8,$9,$10,'SYNTHETIC_5B4_ONLY',now()+interval '1 hour')`,
 [originId,workload.projectId,deploymentId,deploymentOrigin,'a'.repeat(40),workload.issuer,issuer+'/v1/lease',workload.subject,issuer,publicProof]);
 const broker=new CredentialBroker({issuer,kid:cfg.kid,leaseSeconds:65,signingKey:await importJWK(cfg.privateJwk,'ES256'),registry,
  oidcKey:(...args)=>{if(issuerOutage)throw Error('SYNTHETIC_JWKS_DOWN');return keyset(...args);},audit:e=>audit.push(e)});
 const makeOidc=async(extra={},pair=oidcPair)=>{
  const now=Math.floor(Date.now()/1000);return new SignJWT({owner:workload.owner,owner_id:workload.ownerId,project:workload.project,project_id:workload.projectId,environment:'preview',
    iss:workload.issuer,sub:workload.subject,aud:issuer+'/v1/lease',iat:now,nbf:now,exp:now+7200,...extra}).setProtectedHeader({alg:'RS256',kid}).sign(pair.privateKey);
 };
 const makeBody=async(oidc,extra={},proofKey=pop.privateKey)=>{
  const p={originId,instanceId:randomUUID(),previousTokenId:null,...extra},now=Math.floor(Date.now()/1000);
  const proof=await new SignJWT({...p,htm:'POST',htu:issuer+'/v1/lease',ath:(await import('node:crypto')).createHash('sha256').update(oidc).digest('base64url')})
   .setProtectedHeader({alg:'ES256'}).setAudience(issuer+'/v1/lease').setSubject(p.originId).setJti(randomUUID()).setIssuedAt(now).setNotBefore(now).setExpirationTime(now+30).sign(proofKey);
  return {...p,proof};
 };
 const exchangeFetch=async(url,init)=>{
  assert.equal(url,issuer+'/v1/lease');if(transportOutage)throw Error('SYNTHETIC_NETWORK_DOWN');
  const body=JSON.parse(init.body),oidc=init.headers.Authorization.slice(7);bodies.push({body,oidc});
  try{const lease=await broker.exchange(oidc,body);if(loseResponse){loseResponse=false;throw Error('SYNTHETIC_LOST_RESPONSE');}return Response.json(lease);}catch{return Response.json({error:'EXCHANGE_DENIED'},{status:403});}
 };
 const config={issuer,originId,proofJwk,deploymentId,deploymentOrigin,now:()=>Date.now()+clientOffset,oidc:async()=>{oidcReads++;return makeOidc();},fetchImpl:exchangeFetch};
 const leases=new RuntimeLeases(config),rpc=new RemoteRadarRpc({url:'https://pmkyeqrfkunypfkbjnyg.supabase.co',apiKey:'sb_publishable_synthetic_only',credential:leases.get,fetchImpl:wire});
 const health=async(token)=>{const r=await wire('https://pmkyeqrfkunypfkbjnyg.supabase.co/rest/v1/rpc/patrimonial_radar_runtime_health',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'});return r.ok&&(await r.json()).ok===true;};
 let renewed=false;
 async function renew(force=false){
  if(renewed&&!force)return;renewed=true;
  const before=decodeJwt(await leases.get()).jti;await new Promise(r=>setTimeout(r,6100));await rpc.attest(deploymentId);
  const after=decodeJwt(await leases.get()).jti;assert.notEqual(after,before);assert.equal(await health(await leases.get()),true);
  assert((await db.query('select expires_at<=now()+interval \'31 seconds\' overlap from patrimonial_radar_private.runtime_deployments where token_id=$1',[before])).rows[0].overlap);
  console.log('PASS OIDC renewal during complete flow: new registered jti, bounded predecessor overlap');
 }
 async function negatives(){
  await renew();const checks=[];const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS OIDC '+name);};
  await check('valid cache and concurrent single-flight',async()=>{const current=await leases.get(),before=bodies.length;const tokens=await Promise.all(Array.from({length:8},()=>leases.get()));assert.equal(new Set(tokens).size,1);assert.equal(tokens[0],current);assert.equal(bodies.length,before);assert(await health(tokens[0]));});
  await check('platform key/token refresh and two independent instances',async()=>{
   oidcPair=await generateKeyPair('RS256');kid='synthetic-vercel-2';keyset=createLocalJWKSet({keys:[{...await exportJWK(oidcPair.publicKey),kid}]});
   const a=new RuntimeLeases(config),b=new RuntimeLeases(config);const result=await Promise.all([a.get(),b.get()]);assert.notEqual(decodeJwt(result[0]).jti,decodeJwt(result[1]).jti);assert(await health(result[0]));assert(await health(result[1]));
  });
  await check('two OS processes issue independently through same broker and DB',async()=>{
   const server=createServer(async(req,res)=>{try{const chunks=[];for await(const b of req)chunks.push(b);const value=await broker.exchange(req.headers.authorization.slice(7),JSON.parse(Buffer.concat(chunks)));res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));}catch{res.statusCode=403;res.end('{}');}});
   await new Promise(r=>server.listen(0,'127.0.0.1',r));const local='http://127.0.0.1:'+server.address().port;
   try{
    const child=()=>new Promise(async(resolve,reject)=>{const worker=fork(new URL('../fixtures/runtime-lease-worker.mjs',import.meta.url),[],{execArgv:['--experimental-strip-types'],stdio:['ignore','ignore','ignore','ipc'],windowsHide:true});worker.once('error',reject);worker.once('message',m=>m.ok?resolve(m.jti):reject(Error('CHILD_FAILED')));worker.once('exit',code=>{if(code)reject(Error('CHILD_FAILED'));});worker.send({issuer,originId,proofJwk,deploymentId,deploymentOrigin,oidc:await makeOidc(),local});});
    const result=await Promise.all([child(),child()]);assert.notEqual(result[0],result[1]);
   }finally{await new Promise(r=>server.close(r));}
  });
  await check('wrong project, Production, audience, subject, owner, expired/invalid signature, unapproved origin',async()=>{
   const now=Math.floor(Date.now()/1000);
   for(const extra of [{project_id:'prj_other'},{project:'other'},{environment:'production'},{aud:'other'},{sub:'other'},{owner_id:'team_other'},{exp:now-1},{nbf:now+60}]){const t=await makeOidc(extra);await assert.rejects(broker.exchange(t,await makeBody(t)));}
   const bad=await makeOidc({},await generateKeyPair('RS256'));await assert.rejects(broker.exchange(bad,await makeBody(bad)));
   const t=await makeOidc();await assert.rejects(broker.exchange(t,await makeBody(t,{originId:randomUUID()})));
   // A new Preview with otherwise valid project OIDC cannot reuse the known
   // origin UUID or URL without possession of its independent deployment key.
   await assert.rejects(broker.exchange(t,await makeBody(t,{},(await generateKeyPair('ES256')).privateKey)));
   const body=await makeBody(t);body.instanceId=randomUUID();await assert.rejects(broker.exchange(t,body));
   // Claiming a URL/deployment is not an alternate authorization mechanism.
   await assert.rejects(broker.exchange(t,{...await makeBody(t),deploymentId:'dpl_other'}));
  });
  await check('proof replay and concurrent replay denied atomically',async()=>{const t=await makeOidc(),p=await makeBody(t);const replies=await Promise.allSettled([broker.exchange(t,p),broker.exchange(t,p)]);assert.equal(replies.filter(x=>x.status==='fulfilled').length,1);await assert.rejects(broker.exchange(t,p));});
  await check('issuer outage, renewal failure, no fallback and recovery including lost response',async()=>{
   const v=new RuntimeLeases(config);await v.get();await new Promise(r=>setTimeout(r,6100));
   for(const failure of ['transport','jwks','registry','lost']){
    transportOutage=failure==='transport';issuerOutage=failure==='jwks';registrationFailure=failure==='registry';loseResponse=failure==='lost';
    await assert.rejects(v.get(),{code:'UNAVAILABLE'});transportOutage=false;issuerOutage=false;registrationFailure=false;loseResponse=false;
   }
   clientOffset=0;const recovered=await v.get();assert(await health(recovered));
  });
  await check('valid signature without registration, wrong origin/deployment/ref, expiry and signature fail closed',async()=>{
   const issued=await leases.get(),c=decodeJwt(issued),now=Math.floor(Date.now()/1000),key=await importJWK(cfg.privateJwk,'ES256');
   const sign=extra=>new SignJWT({...c,...extra}).setProtectedHeader({alg:'ES256',kid:cfg.kid}).sign(key);
   for(const extra of [{jti:randomUUID()},{deployment_id:'dpl_other'},{ref:'other'},{origin_id:randomUUID()},{exp:now-1}]){
    assert.equal(await health(await sign(extra)),false);
   }
   assert.equal(await health(issued.slice(0,-6)+'xxxxxx'),false);
  });
  await check('individual revocation and DB expiry are immediate; other leases remain valid',async()=>{
   for(const sql of ['revoked_at=now()',"expires_at=now()-interval '1 second'"]){const token=await new RuntimeLeases(config).get();await db.query('update patrimonial_radar_private.runtime_deployments set '+sql+' where token_id=$1',[decodeJwt(token).jti]);assert.equal(await health(token),false);}
   await rpc.attest(deploymentId);
  });
  await check('only four public RPCs; issuer cannot read tables or administer grants',async()=>{
   const allowed=(await db.query("select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prorettype<>'trigger'::regtype and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e') and has_function_privilege('patrimonial_radar_runtime',p.oid,'EXECUTE') order by 1")).rows.map(r=>r.proname);
   // The canonical Platform baseline also leaves these two context accessors
   // PUBLIC: they read current_setting only, never records or grants. Do not
   // revoke PUBLIC across the shared database as part of a Radar candidate.
   assert.deepEqual(allowed,['app_tenant_id','app_user_id','patrimonial_radar_runtime_command','patrimonial_radar_runtime_event','patrimonial_radar_runtime_foundation','patrimonial_radar_runtime_health']);
   for(const name of ['app_tenant_id','app_user_id']){
    const fn=(await db.query('select prosrc,prosecdef from pg_proc where proname=$1',[name])).rows[0];assert.equal(fn.prosecdef,false);assert.match(fn.prosrc,/current_setting/);assert(!/\b(from|insert|update|delete)\b/i.test(fn.prosrc));
   }
   for(const role of ['patrimonial_radar_runtime','patrimonial_radar_issuer'])for(const table of ['runtime_origins','runtime_deployments','snapshots'])await assert.rejects(db.transaction(c=>c.query('select * from patrimonial_radar_private.'+table),role));
   assert.equal((await db.query("select pg_has_role('authenticator','patrimonial_radar_issuer','MEMBER') member")).rows[0].member,false);
   await assert.rejects(db.query("update patrimonial_radar_private.runtime_origins set source_sha=repeat('b',40) where id=$1",[originId]));
   await assert.rejects(db.query("insert into patrimonial_radar_private.runtime_origins select $1,project_id,environment,'dpl_other',deployment_origin,source_sha,oidc_issuer,oidc_audience,oidc_subject,runtime_issuer,proof_jwk,approval_ref,expires_at,revoked_at from patrimonial_radar_private.runtime_origins where id=$2",[randomUUID(),originId]));
   assert.equal(JSON.stringify(audit).includes('token'),false);assert(audit.some(a=>a.outcome==='DENIED'));
  });
  if(process.argv.includes('--issuer-safety-probe'))await check('5B5 compromised synthetic issuer role escalation and authoritative isolated login containment',async()=>{
   const notDelivered={...config.proofJwk};delete notDelivered.d;
   assert.throws(()=>new RuntimeLeases({...config,proofJwk:notDelivered}),{code:'UNAVAILABLE'});
   const t=await makeOidc();await assert.rejects(broker.exchange(t,{...await makeBody(t),proof:''}));
   const {issuerPrivilegeProbe}=await import(pathToFileURL(resolve(platform,'services/radar-credential-broker/test/native-issuer-probe.mjs')).href);
   await issuerPrivilegeProbe(db,cfg,await leases.get());
  });
  if(process.argv.includes('--infrastructure-probe'))await check('5B6 configured independent ingress and SQL login isolation',async()=>{
   const {infrastructureProbe}=await import(pathToFileURL(resolve(platform,'services/radar-credential-broker/test/native-infrastructure-probe.mjs')).href);
   await infrastructureProbe(db,cfg,await new RuntimeLeases(config).get());
  });
  await check('origin revocation blocks already-issued leases, cached clients and every future exchange',async()=>{
   const token=await leases.get();await db.query('update patrimonial_radar_private.runtime_origins set revoked_at=now() where id=$1',[originId]);assert.equal(await health(token),false);await assert.rejects(rpc.attest(deploymentId),{code:'UNAVAILABLE'});
   const t=await makeOidc();await assert.rejects(broker.exchange(t,await makeBody(t)));await assert.rejects(db.query('update patrimonial_radar_private.runtime_origins set revoked_at=null where id=$1',[originId]));
  });
  return checks;
 }
 async function fingerprint(){
  const result={};for(const table of ['public.patrimonial_contacts','public.patrimonial_requests','public.patrimonial_intents','public.patrimonial_assignments',
   'patrimonial_radar_private.persons','patrimonial_radar_private.assessments','patrimonial_radar_private.receipts','patrimonial_radar_private.snapshots','patrimonial_radar_private.contact_bindings']){
   result[table]=(await db.query("select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) checksum,count(*)::int n from "+table+' t')).rows[0];assert(result[table].n>0);
  }return result;
 }
 return {rpc,renew,negatives,fingerprint,oidcReads:()=>oidcReads};
}
