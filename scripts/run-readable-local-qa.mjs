import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import path from 'node:path';

const [mode,directory]=process.argv.slice(2);
assert(['on','off'].includes(mode)&&directory,'Use on|off and artifact directory');
await mkdir(directory,{recursive:true});
const env=Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','ComSpec','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
Object.assign(env,{NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',VERCEL_PREVIEW_FEEDBACK_ENABLED:'0'});
if(mode==='on')Object.assign(env,{VERCEL:'1',VERCEL_ENV:'preview',PATRIMONIAL_RADAR_MODE:'PUBLIC_ANONYMOUS',PATRIMONIAL_RADAR_PUBLIC_ANONYMOUS_ENABLED:'true',PATRIMONIAL_RADAR_VERIFIED_PERSISTENT_ENABLED:'false',PATRIMONIAL_RADAR_BACKEND_ENABLED:'false',PATRIMONIAL_RADAR_ADVISOR_PREVIEW_ENABLED:'false',PATRIMONIAL_RADAR_DEMO_ENABLED:'false'});
const probe=createServer();probe.listen(0,'localhost');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
const base='http://localhost:'+port;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','localhost','--port',String(port)],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
const log=createWriteStream(path.join(directory,'server.log'));server.stdout.pipe(log);server.stderr.pipe(log);
try {
 let ready=false;
 for(let n=0;n<100;n++) {
  assert.equal(server.exitCode,null,'Owned server exited');
  try{if((await fetch(base+'/')).status===200){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,150));
 }
 assert(ready,'Owned server not ready');
 const gates=[];
 for(const p of ['/radar-patrimoniale','/api/patrimonial-radar/session','/api/patrimonial-radar/assessments','/internal/radar-patrimoniale/advisor-preview']) {
  for(const method of p.startsWith('/api/')?['GET','POST']:['GET']) {
   const r=await fetch(base+p,{method,headers:{'x-horyzon-radar-document':'forged'}});
   assert.equal(r.status,p==='/radar-patrimoniale'&&mode==='on'?200:404);
   const body=await r.text();
   if(p==='/radar-patrimoniale'&&mode==='on') {
    assert.match(r.headers.get('cache-control'),/no-store/);
    assert.match(r.headers.get('content-security-policy'),/connect-src 'none'/);
    assert.equal(r.headers.get('referrer-policy'),'no-referrer');
    assert(body.includes('data-radar-isolated="true"'));assert(!/https:\/\/(?:cdn|cs).iubenda.com/.test(body));
   } else assert(!body.includes('Inizia la fotografia'));
   gates.push({path:p,method,status:r.status});
  }
 }
 await writeFile(path.join(directory,'gates.json'),JSON.stringify({mode,gates},null,2));
 const output=createWriteStream(path.join(directory,'readable.log'));
 const child=spawn(process.execPath,['--no-warnings','--experimental-strip-types','scripts/verify-readable.mjs',base,'--artifacts='+directory],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.pipe(output);child.stderr.pipe(output);
 const exitCode=await new Promise(r=>child.on('exit',r));output.end();assert.equal(exitCode,0,'Readable HTTP matrix failed; see readable.log');
 const matrix=JSON.parse(await readFile(path.join(directory,'readable-http.json'),'utf8'));
 const html=await readFile('.next/server/app/index.html'),md=await readFile('public/home.md'),prerender=JSON.parse(await readFile('.next/prerender-manifest.json','utf8'));
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 assert(prerender.routes['/'],'Real home remains prerendered');
 assert.equal(matrix.requests.find(r=>r.label==='GET HTML').bodySha256,hash(html),'HTTP HTML equals the actual prerendered home');
 assert.equal(matrix.requests.find(r=>r.label==='GET Markdown').bodySha256,hash(md),'HTTP Markdown equals actual postbuild output');
 const unaffected=[];
 for(const route of ['/radar','/contatti']) {
  const r=await fetch(base+route);assert.equal(r.status,200);assert.equal(r.headers.get('cdn-cache-control'),null);assert.equal(r.headers.get('vercel-cdn-cache-control'),null);
  assert.equal(r.headers.get('cache-control'),'s-maxage=31536000','Other route caching unchanged');
  unaffected.push({path:route,status:r.status,cacheControl:r.headers.get('cache-control')});
 }
 await writeFile(path.join(directory,'static-content.json'),JSON.stringify({mode,homePrerendered:true,htmlBytes:html.length,markdownBytes:md.length,htmlSha256:hash(html),markdownSha256:hash(md),httpBodiesMatchRealArtifacts:true,unaffected},null,2));
 console.log('PASS '+mode+': full actual Readable HTTP matrix, genuine static artifacts, unrelated route caching and Radar/API/Advisor gates');
} finally {
 if(server.exitCode===null){server.kill();await once(server,'exit');}
}
