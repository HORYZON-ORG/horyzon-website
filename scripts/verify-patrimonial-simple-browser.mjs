// Synthetic loopback integration only. Requires the native 5C verifier seed.
// The local Auth provider is a fixture, not a claim of real Supabase OTP delivery.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer as httpServer} from 'node:http';
import {spawn} from 'node:child_process';
import {randomUUID,createHmac,timingSafeEqual} from 'node:crypto';
const arg=k=>process.argv.find(x=>x.startsWith('--'+k+'='))?.slice(k.length+3);
for(const k of ['evidence','hub','pg-module','playwright'])assert(arg(k),'Missing '+k);
const root=arg('evidence'),hub=arg('hub'),website=process.cwd();
const f=JSON.parse(await fs.readFile(root+'/browser-fixture-private.json','utf8'));
assert.equal(f.cfg.databaseUrl,'postgres://postgres@127.0.0.1:15439/radar_5a_test');assert.equal(f.cfg.postgrestUrl,'http://127.0.0.1:15440');
const pg=(await import(pathToFileURL(arg('pg-module')).href)).default,db=new pg.Client({connectionString:f.cfg.databaseUrl});await db.connect();
const jwt=claims=>{const unsigned=Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,...claims})).toString('base64url');return unsigned+'.'+createHmac('sha256',f.cfg.secret).update(unsigned).digest('base64url');};
const inbox=new Map(),refreshes=new Map(),requests=[];const logs=[];let child,vite,browser;
const fixture=httpServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://127.0.0.1:17820');assert.equal(req.headers.host,'127.0.0.1:17820');
 res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:17822');res.setHeader('Access-Control-Allow-Headers','authorization,apikey,content-type,accept-profile,content-profile,x-client-info');
 res.setHeader('Access-Control-Allow-Methods','POST,GET,OPTIONS');res.setHeader('Cache-Control','no-store');
 if(req.method==='OPTIONS'){res.end();return;}
 requests.push({method:req.method,path:u.pathname});
 const chunks=[];let size=0;for await(const b of req){size+=b.length;assert(size<300000);chunks.push(b);}const raw=Buffer.concat(chunks).toString();
 const send=(body,status=200)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
 if(u.pathname.startsWith('/rest/v1/')){const r=await fetch(f.cfg.postgrestUrl+u.pathname.slice('/rest/v1'.length),{method:req.method,headers:{...(req.headers.authorization?{Authorization:req.headers.authorization}:{}),'Content-Type':'application/json',...(req.headers['accept-profile']?{'Accept-Profile':req.headers['accept-profile']}:{}),...(req.headers['content-profile']?{'Content-Profile':req.headers['content-profile']}:{})},...(req.method==='GET'?{}:{body:raw})});send(await r.json(),r.status);return;}
 const data=raw?JSON.parse(raw):{};
 const user=async(uid)=>(await db.query('select id,email,email_confirmed_at from auth.users where id=$1 and deleted_at is null and (banned_until is null or banned_until<now())',[uid])).rows[0];
 if(u.pathname==='/auth/v1/otp'){assert(data.email.endsWith('.invalid'));inbox.set(data.email,'123456');send({});return;}
 const tokens=async(uid,sid)=>{const r=randomUUID();refreshes.set(r,{uid,sid});return{access_token:jwt({sub:uid,session_id:sid}),refresh_token:r,token_type:'bearer',expires_in:3600,user:await user(uid)};};
 if(u.pathname==='/auth/v1/verify'){if(inbox.get(data.email)!==data.token){send({error:'invalid'},401);return;}inbox.delete(data.email);let uid=(await db.query('select id from auth.users where email=$1',[data.email])).rows[0]?.id;if(!uid){uid=randomUUID();await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[uid,data.email]);}const sid=randomUUID();await db.query("insert into auth.sessions(id,user_id,not_after) values($1,$2,now()+interval '1 hour')",[sid,uid]);send(await tokens(uid,sid));return;}
 if(u.pathname==='/auth/v1/token'){const r=refreshes.get(data.refresh_token);if(!r){send({},401);return;}refreshes.delete(data.refresh_token);send(await tokens(r.uid,r.sid));return;}
 const token=req.headers.authorization?.slice(7)??'',parts=token.split('.');assert.equal(parts.length,3);const expected=createHmac('sha256',f.cfg.secret).update(parts[0]+'.'+parts[1]).digest(),actual=Buffer.from(parts[2],'base64url');assert(actual.length===expected.length&&timingSafeEqual(actual,expected));const claims=JSON.parse(Buffer.from(parts[1],'base64url'));assert(claims.exp>Date.now()/1000);
 if(u.pathname==='/auth/v1/user'){const v=await user(claims.sub);assert(v);send(v);return;}
 if(u.pathname==='/auth/v1/logout'){await db.query('delete from auth.sessions where id=$1',[claims.session_id]);send({});return;}
 send({},404);
 }catch{res.statusCode=403;res.end('{"error":"fixture-denied"}');}});
const wait=async(url,expected)=>{for(let i=0;i<150;i++){if(child?.exitCode!==null&&child?.exitCode!==undefined)throw Error('Next exited');try{const r=await fetch(url);if(r.status===expected)return;}catch{}await new Promise(r=>setTimeout(r,200));}throw Error('Local server timeout: '+url);};
const results=[];const check=async(n,fn)=>{await fn();results.push(n);console.log('PASS '+n);};
try{
 await new Promise(r=>fixture.listen(17820,'127.0.0.1',r));
 const env={...process.env,NEXT_TELEMETRY_DISABLED:'1',PATRIMONIAL_RADAR_ACCOUNT_ENABLED:'true',PATRIMONIAL_RADAR_ACCOUNT_CONTEXT:'local-test',PATRIMONIAL_RADAR_ACCOUNT_ORIGIN:'http://127.0.0.1:17821',PATRIMONIAL_RADAR_ACCOUNT_SUPABASE_URL:'http://127.0.0.1:17820',PATRIMONIAL_RADAR_PUBLISHABLE_KEY:'sb_publishable_synthetic',PATRIMONIAL_RADAR_IDENTITY_SECRET:f.secret};delete env.VERCEL;delete env.VERCEL_ENV;
 child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','17821'],{cwd:website,env,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>logs.push(b.toString()));child.stderr.on('data',b=>logs.push(b.toString()));
 await wait('http://127.0.0.1:17821/api/patrimonial-radar/session',401);
 const dir=root+'/tools/browser-harness';await fs.mkdir(dir,{recursive:true});
 await fs.writeFile(dir+'/index.html','<!doctype html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><p>COLLAUDO LOCALE · dati sintetici · Auth simulata</p><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await fs.writeFile(dir+'/auth.ts','const sessione={user:{id:'+JSON.stringify(f.advisorB.uid)+'}};export function useAuth(){return {sessione};}');
 await fs.writeFile(dir+'/main.tsx',`import React from 'react';import{createRoot}from'react-dom/client';import{SimplePatrimonialRadar}from'${hub}/src/components/patrimonial/SimplePatrimonialRadar';import{ClientRadarDetails}from'${hub}/src/components/architetti/ClientRadarDetails';import{simpleRadarCommand}from'${hub}/src/lib/patrimonial-radar-simple';import{supabase}from'${hub}/src/integrations/supabase/client';import'${hub}/src/styles.css';await supabase.auth.setSession({access_token:${JSON.stringify(f.advisorB.token)},refresh_token:'synthetic-no-refresh'});const rows=await simpleRadarCommand({method:'list'});createRoot(document.getElementById('root')!).render(location.search.includes('client')?<ClientRadarDetails contactId=${JSON.stringify(f.contactId)} operators={rows.operators.map(o=>({id:o.id,display_name:o.name}))}/>:<SimplePatrimonialRadar/>);`);
 const {createServer}=await import(pathToFileURL(hub+'/node_modules/vite/dist/node/index.js').href),react=(await import(pathToFileURL(hub+'/node_modules/@vitejs/plugin-react/dist/index.js').href)).default,tailwind=(await import(pathToFileURL(hub+'/node_modules/@tailwindcss/vite/dist/index.mjs').href)).default;
 vite=await createServer({configFile:false,root:dir,cacheDir:root+'/tools/vite-cache',publicDir:false,define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('http://127.0.0.1:17820'),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify('sb_publishable_synthetic'),'import.meta.env.VITE_SUPABASE_SCHEMA':JSON.stringify('hub')},server:{host:'127.0.0.1',port:17822,strictPort:true,fs:{allow:[root,path.dirname(hub)]}},resolve:{dedupe:['react','react-dom'],alias:[{find:'@/lib/authRole',replacement:dir+'/auth.ts'},{find:'@',replacement:hub+'/src'},{find:'react-dom',replacement:hub+'/node_modules/react-dom'},{find:'react',replacement:hub+'/node_modules/react'}]},plugins:[react(),tailwind()]});await vite.listen();
 const {chromium}=await import(pathToFileURL(arg('playwright')).href);browser=await chromium.launch({executablePath:arg('chrome')??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const shots=root+'/browser-evidence';await fs.mkdir(shots,{recursive:true});
 for(const [device,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const ctx=await browser.newContext({viewport});const network=[],blocked=[];await ctx.route('**/*',route=>{const u=new URL(route.request().url());if(!['127.0.0.1','localhost'].includes(u.hostname)){blocked.push(u.origin);return route.abort();}network.push(u.pathname);return route.continue();});const page=await ctx.newPage();let snapshotId;
  await check(device+' account OTP and complete questionnaire',async()=>{
   await page.goto('http://127.0.0.1:17821/radar-patrimoniale');await page.getByRole('checkbox').check();await page.getByRole('button',{name:/Inizia la fotografia/}).click();await page.getByLabel('Nome',{exact:true}).fill('Browser');await page.getByLabel('Cognome',{exact:true}).fill(device);const email='browser-'+device+'-'+randomUUID()+'@example.invalid';await page.getByLabel('Email di test',{exact:true}).fill(email);await page.screenshot({path:shots+'/'+device+'-identity.png',fullPage:true});await page.getByRole('button',{name:'Richiedi codice',exact:true}).click();await page.getByLabel('Codice ricevuto via email').waitFor();await page.getByLabel('Codice ricevuto via email').fill(inbox.get(email));await page.getByRole('button',{name:'Verifica codice',exact:true}).click();await page.getByRole('button',{name:'Crea la prima compilazione',exact:true}).click();await page.locator('[data-question-id]').waitFor();
   let n=0;while(await page.locator('[data-question-id]').count()){
    assert(n++<45);const box=page.locator('[data-question-id]');const id=await box.getAttribute('data-question-id');await box.locator('[data-answer-scope="question"]').getByRole('button',{name:n===2?'Preferisco non rispondere':'Non so',exact:true}).click();if(n===3)await page.screenshot({path:shots+'/'+device+'-question.png',fullPage:true});await box.getByRole('button',{name:/Conferma e/}).click();await page.waitForFunction(old=>!document.querySelector('[data-question-id]')||document.querySelector('[data-question-id]').getAttribute('data-question-id')!==old,id);
   }
   await page.getByRole('button',{name:'Completa e salva il risultato',exact:true}).click();await page.locator('[data-result-preview]').waitFor();await page.screenshot({path:shots+'/'+device+'-result.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const storage=await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}));assert(!JSON.stringify(storage).includes('RP-S01'));assert(!network.some(p=>/highlevel|crm|email|advisor/.test(p)));const cookies=await ctx.cookies();assert(cookies.filter(c=>c.name.startsWith('pr_')).every(c=>c.httpOnly));
  });
  await check(device+' independent Hub list and canonical Advisor',async()=>{await page.goto('http://127.0.0.1:17822/');await page.getByRole('heading',{name:'Radar Patrimoniale',exact:true}).waitFor();const row=page.locator('[data-case-id="'+f.caseId+'"]');await row.getByRole('button',{name:'Dettagli e storico'}).click();await page.getByRole('button',{name:'Apri analisi Advisor',exact:true}).click();await page.locator('[data-advisor-report]').waitFor();snapshotId=await page.locator('[data-advisor-report]').getAttribute('data-snapshot-id');assert(snapshotId);await page.screenshot({path:shots+'/'+device+'-hub.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));});
  await check(device+' Clienti reads the same canonical dossier',async()=>{await page.goto('http://127.0.0.1:17822/?client');await page.locator('[data-case-id="'+f.caseId+'"]').getByRole('button',{name:'Apri dossier riservato',exact:true}).click();await page.getByRole('region',{name:'Dossier Advisor'}).waitFor();assert.equal(await page.getByRole('region',{name:'Dossier Advisor'}).getAttribute('data-snapshot-id'),snapshotId);await page.screenshot({path:shots+'/'+device+'-client.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));});
  assert.equal(blocked.length,0,"No external request may be attempted");await ctx.close();
 }
 assert(!logs.join('').includes(f.secret));assert(!logs.join('').includes('123456'));await fs.writeFile(root+'/browser-result.json',JSON.stringify({status:'PASS_SYNTHETIC_LOCAL_BROWSER',checks:results,auth:'FIXTURE_NOT_REAL_SUPABASE_AUTH',remoteWrites:0,requests:requests.map(r=>r.path)},null,2));
}catch(error){await fs.writeFile(root+'/browser-failure.log',String(error)+'\n'+logs.join('').replaceAll(f.secret,'[redacted]'));throw error;}
finally{await browser?.close();await vite?.close();child?.kill();fixture.closeAllConnections();await new Promise(r=>fixture.close(r));await db.end();}
