import assert from 'node:assert/strict';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {getVercelOidcToken} from '@vercel/oidc';import {generateKeyPair,SignJWT} from 'jose';
import {remoteRpc} from '../src/lib/patrimonial-radar-server/remote-runtime.ts';
import {remoteOrigin,protectedRemoteConfigured} from '../src/lib/patrimonial-radar-server/remote-config.ts';
import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';
const lock=JSON.parse(readFileSync('package-lock.json')),baseline=JSON.parse(execFileSync('git',['show','0bf7c32b0380879284a0836d46ab6a9b04c41f4f:package-lock.json']));
for(const [name,value] of Object.entries(baseline.packages).filter(([name])=>name))for(const field of ['version','resolved','integrity'])assert.equal(lock.packages[name]?.[field],value[field],name+'/'+field);
assert.equal(lock.packages['node_modules/@vercel/oidc'].version,'4.0.0');assert.equal(lock.packages['node_modules/jose'].version,'6.2.12');
console.log('PASS every pre-existing lockfile package keeps version/source/integrity; SDK and JOSE exactly pinned');
const folder=await mkdtemp(join(tmpdir(),'radar-oidc-synthetic-')),file=join(folder,'oidc'),priorFile=process.env.VERCEL_OIDC_TOKEN_FILE,priorToken=process.env.VERCEL_OIDC_TOKEN;
try{
 const {privateKey}=await generateKeyPair('RS256'),now=Math.floor(Date.now()/1000);
 const token=n=>new SignJWT({exp:now+7200,iat:now,synthetic:n}).setProtectedHeader({alg:'RS256'}).sign(privateKey);
 const a=await token(1),b=await token(2);process.env.VERCEL_OIDC_TOKEN_FILE=file;process.env.VERCEL_OIDC_TOKEN=a;
 await writeFile(file,a);assert.equal(await getVercelOidcToken(),a);await writeFile(file,b);assert.equal(await getVercelOidcToken(),b);
 await writeFile(file,'');await assert.rejects(getVercelOidcToken());process.env.VERCEL_OIDC_TOKEN_FILE=join(folder,'missing');await assert.rejects(getVercelOidcToken());
 console.log('PASS SDK4 actual rotating-file reads and empty/missing file fail closed, no env fallback');
 const env={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_PROJECT_ID:'prj_bJvIOswh4GacqtUootXATXeAkSUO',VERCEL_DEPLOYMENT_ID:'dpl_synthetic',VERCEL_URL:'horyzon-radar-pilot-synthetic-horyzon-consulting.vercel.app',
  PATRIMONIAL_RADAR_BACKEND_ENABLED:'true',PATRIMONIAL_RADAR_BACKEND_CONTEXT:'protected-remote',PATRIMONIAL_RADAR_FOUNDATION_CONTEXT:'protected-remote',
  PATRIMONIAL_RADAR_MODE:'VERIFIED_PERSISTENT',PATRIMONIAL_RADAR_VERIFIED_PERSISTENT_ENABLED:'true',PATRIMONIAL_RADAR_SUPABASE_URL:'https://pmkyeqrfkunypfkbjnyg.supabase.co',
  PATRIMONIAL_RADAR_ACTIVATION_APPROVAL_REF:'SYNTHETIC_ONLY',PATRIMONIAL_RADAR_NOTICE_APPROVAL:'RP-SERVICE-5A-DRAFT-1',PATRIMONIAL_RADAR_RUNTIME_TOKEN:a};
 assert(protectedRemoteConfigured(env));assert.equal(remoteOrigin(env),'https://'+env.VERCEL_URL);assert.equal(protectedRemoteConfigured({...env,PATRIMONIAL_RADAR_REMOTE_ORIGIN:'https://evil.invalid'}),false);
 assert.throws(()=>remoteRpc(env),{code:'UNAVAILABLE'});assert.equal(protectedRemoteConfigured({}),false);
 console.log('PASS production factory ignores legacy static token; absent broker/proof remains closed; derived origin is configuration only');
}finally{
 if(priorFile===undefined)delete process.env.VERCEL_OIDC_TOKEN_FILE;else process.env.VERCEL_OIDC_TOKEN_FILE=priorFile;
 if(priorToken===undefined)delete process.env.VERCEL_OIDC_TOKEN;else process.env.VERCEL_OIDC_TOKEN=priorToken;
 await rm(folder,{recursive:true,force:true});
}
