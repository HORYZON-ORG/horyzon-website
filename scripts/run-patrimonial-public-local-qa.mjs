import {verifyRealDocuments} from './lib/patrimonial-real-document-checks.mjs';
import {verifyDocumentBoundary} from './lib/patrimonial-public-boundary-checks.mjs';
// Local process-only flags, no env files or remote configuration.
import {spawn} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import path from 'node:path';
const artifacts=process.argv[2];
const arg=key=>process.argv.find(v=>v.startsWith('--'+key+'='))?.slice(key.length+3);
const runtime=arg('playwright-module'),executable=arg('executable');
if(!artifacts||!runtime||!executable)throw Error('Artifact directory and explicit browser/runtime paths required');
const env=Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const children=[];
async function start(port,flags){const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','localhost','--port',String(port)],{env:{...env,NODE_ENV:'production',...flags},stdio:['ignore','pipe','pipe'],windowsHide:true});children.push(child);const log=createWriteStream(path.join(artifacts,`server-${port}.log`));child.stdout.pipe(log);child.stderr.pipe(log);for(let i=0;i<100;i++){try{const r=await fetch(`http://localhost:${port}/radar-patrimoniale`);if([200,404].includes(r.status))return;}catch{}await new Promise(r=>setTimeout(r,300));}throw Error('Local server unavailable');}
try{
 const base='http://localhost:3361',off='http://localhost:3362';
 await start(3361,{PATRIMONIAL_RADAR_MODE:'PUBLIC_ANONYMOUS',PATRIMONIAL_RADAR_PUBLIC_ANONYMOUS_ENABLED:'true',PATRIMONIAL_RADAR_VERIFIED_PERSISTENT_ENABLED:'false',PATRIMONIAL_RADAR_BACKEND_ENABLED:'false',PATRIMONIAL_RADAR_ADVISOR_PREVIEW_ENABLED:'false',PATRIMONIAL_RADAR_DEMO_ENABLED:'false',VERCEL_PREVIEW_FEEDBACK_ENABLED:'0',VERCEL:'1',VERCEL_ENV:'preview'});
 await start(3362,{PATRIMONIAL_RADAR_MODE:'VERIFIED_PERSISTENT',PATRIMONIAL_RADAR_VERIFIED_PERSISTENT_ENABLED:'true',PATRIMONIAL_RADAR_DEMO_ENABLED:'true',PATRIMONIAL_RADAR_DEMO_CONTEXT:'local-test',PATRIMONIAL_RADAR_BACKEND_ENABLED:'true',PATRIMONIAL_RADAR_BACKEND_CONTEXT:'local-test',PATRIMONIAL_RADAR_ADVISOR_PREVIEW_ENABLED:'true',PATRIMONIAL_RADAR_ADVISOR_PREVIEW_CONTEXT:'synthetic-local',VERCEL:'1',VERCEL_ENV:'production'});
 for(const origin of [base,off])for(const url of ['/api/patrimonial-radar/session','/api/patrimonial-radar/assessments','/internal/radar-patrimoniale/advisor-preview'])for(const method of url.includes('/api/')?['GET','POST']:['GET']){const r=await fetch(origin+url,{method});if(r.status!==404)throw Error('Public protected endpoint not hidden: '+method+' '+url+' '+r.status);}
 const md=await fetch(base+'/',{headers:{Accept:'text/markdown'}});if(!md.ok||!md.headers.get('content-type')?.includes('text/markdown'))throw Error('Home Markdown regression');
 const home=await(await fetch(base+'/',{headers:{'x-horyzon-radar-document':'anonymous'}})).text();if(home.includes('data-radar-isolated="true"'))throw Error('Browser forged ordinary isolation');if(!home.includes('iubenda'))throw Error('Legacy shell changed');
 const csp=await fetch(base+'/radar-patrimoniale');if(!(csp.headers.get('content-security-policy')??'').includes("connect-src 'none'"))throw Error('Anonymous CSP missing');
 const html=await csp.text();if(html.includes('https://cdn.iubenda.com')||html.includes('https://cs.iubenda.com'))throw Error('Consent script leaked into anonymous document');
 if(!process.argv.includes('--boundary-only')) {
 const child=spawn(process.execPath,['--no-warnings','--experimental-strip-types','scripts/verify-patrimonial-radar-public-browser.mjs',`--base=${base}`,`--disabled-base=${off}`,`--playwright-module=${runtime}`,`--executable=${executable}`,`--artifacts=${artifacts}`],{env,stdio:'inherit',windowsHide:true});
 const code=await new Promise(r=>child.on('exit',r));if(code!==0)throw Error('Browser QA failed');
 }
 await verifyDocumentBoundary({base,runtime,executable,artifacts});
 await verifyRealDocuments({base,runtime,executable,artifacts});
 const child=spawn(process.execPath,['--no-warnings','--experimental-strip-types','scripts/verify-readable.mjs',base],{env,stdio:'inherit',windowsHide:true});
 if(await new Promise(r=>child.on('exit',r))!==0)throw Error('Readable HTTP negotiation failed');
 console.log('PASS production build: anonymous on Preview-shaped environment; protected GET/POST and Advisor 404 even with forged public persistent flags; home HTML/Markdown preserved');
} finally {for(const child of children)child.kill();}
