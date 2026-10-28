import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {accountConfig} from '../src/lib/patrimonial-radar-server/account-config.ts';
import {patrimonialRadarMode} from '../src/lib/patrimonial-radar-ui/public-mode.ts';
const output=process.argv.find(v=>v.startsWith('--output='))?.slice(9);
const env={VERCEL:'1',VERCEL_ENV:'preview',VERCEL_PROJECT_ID:'prj_bJvIOswh4GacqtUootXATXeAkSUO',VERCEL_URL:'synthetic-pilot.example.invalid',VERCEL_DEPLOYMENT_ID:'synthetic-deployment',PATRIMONIAL_RADAR_ACCOUNT_ENABLED:'true',PATRIMONIAL_RADAR_ACCOUNT_ORIGIN:'https://synthetic-pilot.example.invalid',PATRIMONIAL_RADAR_PUBLISHABLE_KEY:'sb_publishable_synthetic_5d',PATRIMONIAL_RADAR_IDENTITY_SECRET:'SYNTHETIC_ONLY_5D_NO_REAL_CREDENTIAL_000000000000'};
const preview=!!accountConfig(env),mode=patrimonialRadarMode(env);
const root=readFileSync('src/app/radar-patrimoniale/layout.tsx','utf8');
const document=readFileSync('src/app/site-document.tsx','utf8');
assert(root.includes('isolated={anonymous || identified}'));
assert(document.includes('!isolated ?'));
assert(document.includes('iubenda-autoblocking'));
const result={scope:'LOCAL_PURE_CONFIG_PROBE_NO_NETWORK',sourceCommit:'47c2bac00913589852ebfc4df82e5e2526f69449',checks:[
 {name:'native account preview recognized',status:preview?'PASS':'FAIL'},
 {name:'native account participates in isolated root mode',status:preview&&mode==='VERIFIED_PERSISTENT'?'PASS':'FAIL',observedMode:mode,implication:'Layout isolation and Proxy marker do not recognize the native account path with only its required settings. Static Next CSP still restricts third-party execution; no real exfiltration demonstrated.'},
 {name:'native account refuses Production context',status:accountConfig({...env,VERCEL_ENV:'production'})?'FAIL':'PASS'},
 {name:'native account refuses another Vercel project',status:accountConfig({...env,VERCEL_PROJECT_ID:'synthetic-other-project'})?'FAIL':'PASS'}
 ],realAuth:'NOT_RUN',remoteWrites:0};
if(output)writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));if(result.checks.some(c=>c.status==='FAIL'))process.exitCode=1;
