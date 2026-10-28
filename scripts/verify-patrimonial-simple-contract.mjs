import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {accountConfig} from '../src/lib/patrimonial-radar-server/account-config.ts';
import {handleAccountRadar} from '../src/lib/patrimonial-radar-server/account-http.ts';
assert.equal(accountConfig({}),null);
assert.equal((await handleAccountRadar(new Request('https://horyzon.it/api/patrimonial-radar/session'),{})).status,404);
assert.throws(()=>accountConfig({PATRIMONIAL_RADAR_ACCOUNT_ENABLED:'true'}));
const env={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_PROJECT_ID:'prj_bJvIOswh4GacqtUootXATXeAkSUO',VERCEL_DEPLOYMENT_ID:'synthetic-5d',VERCEL_URL:'preview.example.invalid',PATRIMONIAL_RADAR_ACCOUNT_ENABLED:'true',PATRIMONIAL_RADAR_ACCOUNT_ORIGIN:'https://preview.example.invalid',PATRIMONIAL_RADAR_PUBLISHABLE_KEY:'sb_publishable_synthetic',PATRIMONIAL_RADAR_IDENTITY_SECRET:'synthetic-identity-secret-00000000000000000000'};
assert.equal(accountConfig(env).local,false);assert.throws(()=>accountConfig({...env,PATRIMONIAL_RADAR_ACCOUNT_SUPABASE_URL:'https://untrusted.invalid'}));
assert.throws(()=>accountConfig({...env,VERCEL:'1',PATRIMONIAL_RADAR_ACCOUNT_CONTEXT:'local-test',PATRIMONIAL_RADAR_ACCOUNT_SUPABASE_URL:'http://127.0.0.1:17820'}));
let calls=0;const noNetwork=async()=>{calls++;throw Error('must not fetch');};
const cross=await handleAccountRadar(new Request(env.PATRIMONIAL_RADAR_ACCOUNT_ORIGIN+'/api/patrimonial-radar/identity/request',{method:'POST',headers:{Origin:'https://other.invalid','Content-Type':'application/json'},body:'{}'}),env,noNetwork);assert.equal(cross.status,403);assert.equal(calls,0);
const page=readFileSync('src/app/radar-patrimoniale/page.tsx','utf8');assert(page.includes('accountConfig(process.env)'));assert(page.includes("mode!=='VERIFIED_PERSISTENT'"));assert(page.includes('protectedRemoteConfigured(process.env)'));
const api=readFileSync('src/app/api/patrimonial-radar/[...segments]/route.ts','utf8');assert(api.includes("PATRIMONIAL_RADAR_ACCOUNT_ENABLED === 'true' ? handleAccountRadar(request) : handleRadarBackend(request)"));
const baseline='fddc787630836118e47576944e252f49aff876bc';
for(const folder of ['src/lib/radar','src/lib/patrimonial-radar','public/benessere-patrimoniale','src/components/patrimonial-radar/anonymous-client.tsx','src/lib/patrimonial-radar-server/remote-config.ts','src/lib/patrimonial-radar-server/oidc-provider.ts']){
 const files=execFileSync('git',['ls-tree','-r','--name-only',baseline,'--',folder],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
 // An optional historical module may not exist; all listed files remain pinned.
 for(const file of files){const actual=readFileSync(file),expected=execFileSync('git',['show',baseline+':'+file],{maxBuffer:10000000});assert(/\.(png|jpe?g|webp)$/i.test(file)?actual.equals(expected):actual.toString().replaceAll('\r\n','\n')===expected.toString().replaceAll('\r\n','\n'),file);}
}
const photos=readdirSync('public/benessere-patrimoniale',{recursive:true}).filter(p=>/\.(jpe?g|png|webp)$/i.test(p));assert.equal(photos.length,35);
console.log('PASS default gates closed, origin/project restrictions, legacy fallback, unchanged engine/Radar/35 assets and inactive historical modules');
