// Real browser and Next; fixtures only. No database or staff adapters are configured.
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {PREVIEW_CASES,previewSource} from '../src/lib/patrimonial-radar-advisor/preview-fixtures.ts';
import {advisorProjection} from '../src/lib/patrimonial-radar-advisor/projection.ts';
const arg=k=>process.argv.find(a=>a.startsWith(`--${k}=`))?.slice(k.length+3);
assert.ok(arg('playwright-module')&&arg('artifacts'));
const {chromium}=await import(pathToFileURL(path.resolve(arg('playwright-module'))).href);
const browser=await chromium.launch({headless:true,...(arg('executable')?{executablePath:arg('executable')}:{})});
const directory=path.resolve(arg('artifacts'));await mkdir(directory,{recursive:true});
let child;const logs=[],passed=[],screenshots=[];let external=0,writes=0;const errors=[];
const routePath='/internal/radar-patrimoniale/advisor-preview';
async function stop(){if(child&&child.exitCode===null){child.kill();await once(child,'exit');}child=null;}
async function start(mode,enabled){
 const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
 const origin=`http://127.0.0.1:${port}`;
 const env=Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','ComSpec','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
 Object.assign(env,{NODE_ENV:mode,NEXT_TELEMETRY_DISABLED:'1',PATRIMONIAL_RADAR_ADVISOR_PREVIEW_ENABLED:String(enabled),PATRIMONIAL_RADAR_ADVISOR_PREVIEW_CONTEXT:'synthetic-local'});
 child=spawn(process.execPath,['node_modules/next/dist/bin/next',mode==='production'?'start':'dev','--hostname','127.0.0.1','--port',String(port)],{env,cwd:process.cwd(),windowsHide:true,stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',b=>logs.push(b.toString()));child.stderr.on('data',b=>logs.push(b.toString()));
 for(let n=0;n<100;n++){if(child.exitCode!==null)throw Error('Local preview server exited');try{const r=await fetch(`${origin}/api/patrimonial-radar/session`);if(r.status===404)return origin;}catch{}await new Promise(r=>setTimeout(r,200));}
 throw Error('Local preview server did not become ready');
}
async function shot(page,name){const file=`${name}.png`;await page.screenshot({path:path.join(directory,file)});screenshots.push(file);}
async function fits(page,note){const size=await page.evaluate(()=>({width:innerWidth,page:document.documentElement.scrollWidth}));assert.ok(size.page<=size.width+1,`${note}: ${size.page}/${size.width}`);}
try {
 const origin=await start('development',true),ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await ctx.addInitScript(()=>{const forbidden=()=>{throw Error('Advisor preview forbids browser persistence');};Storage.prototype.setItem=forbidden;Storage.prototype.removeItem=forbidden;Storage.prototype.clear=forbidden;navigator.sendBeacon=forbidden;});
 await ctx.route('**/*',r=>{const req=r.request(),url=new URL(req.url());if(url.origin!==origin){external++;return r.abort();}if(!['GET','HEAD'].includes(req.method())){writes++;return r.abort();}return r.continue();});
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto(`${origin}${routePath}?scenario=G05`,{waitUntil:'networkidle'});
 // Next dev overrides configured no-store with mandatory revalidation (base-server).
 // Only synthetic data can render here; production is checked below and must return 404.
 assert.equal(response.status(),200);assert.match(response.headers()['x-robots-tag'],/noindex/);assert.match(response.headers()['cache-control'],/no-cache, must-revalidate/);assert.doesNotMatch(response.headers()['cache-control'],/public|s-maxage/);assert.doesNotMatch(response.headers()['content-security-policy'],/iubenda/);
 await page.locator('[data-advisor-dashboard]').waitFor();assert.equal(await page.locator('[data-advisor-goal]').count(),2);
 assert.match(await page.locator('h1').evaluate(el=>getComputedStyle(el).fontFamily),/Manrope/);
 assert.equal(await page.locator('img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)),true);
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});await page.evaluate(()=>window.scrollTo(0,0));await fits(page,`overview ${width}`);await shot(page,`overview-${width}`);
  for(const id of ['radar','economy','assets','goals','interview','answers']){await page.locator(`#${id}`).evaluate(el=>el.scrollIntoView({block:'start'}));await fits(page,`${id} ${width}`);if(['economy','goals','radar'].includes(id))await shot(page,`${id}-${width}`);}
  const table=page.locator('#economy table');const widths=await table.evaluate(el=>({table:el.getBoundingClientRect().width,caption:el.querySelector('caption').getBoundingClientRect().width}));assert.ok(widths.caption>=widths.table-1,'Table caption uses the full readable width');
  const row=table.locator('tbody tr').first();await row.evaluate(el=>el.scrollIntoView({block:'start'}));await shot(page,`table-${width}`);
  const formula=row.locator('summary').last();await formula.focus();await page.keyboard.press('Enter');assert.equal(await formula.evaluate(el=>el.parentElement.open),true);await fits(page,`expanded indicator ${width}`);await page.keyboard.press('Enter');
  const summary=page.locator('#answers > details > summary').first();await summary.focus();await page.keyboard.press('Enter');assert.equal(await summary.evaluate(el=>el.parentElement.open),true);await fits(page,`expanded original ${width}`);await page.keyboard.press('Enter');
  await page.getByRole('navigation',{name:'Sezioni del dossier'}).getByRole('link',{name:'Obiettivi e vincoli',exact:true}).focus();const focus=await page.evaluate(()=>getComputedStyle(document.activeElement).outlineWidth);assert.ok(parseFloat(focus)>=3);await page.keyboard.press('Enter');assert.equal(new URL(page.url()).hash,'#goals');
 }
 passed.push('Browser rendering G05: two ranked goals/shared-resource conflict, 320/390/768/1440, readable stacked tables/cards, expanded originals, keyboard details/navigation/focus, original logo/fonts and no overflow');
 for(const scenario of PREVIEW_CASES){
  await page.goto(`${origin}${routePath}?scenario=${scenario}`,{waitUntil:'networkidle'});const p=advisorProjection(previewSource(scenario));
  assert.equal(await page.locator('[data-advisor-sector]').count(),6);
  for(const [area,value] of Object.entries(p.areas))assert.equal(await page.locator(`[data-advisor-sector=${area}]`).getAttribute('data-state'),value.state);
  assert.equal(await page.locator('[data-indicator]').count(),Object.keys(p.indicators).length);assert.equal(await page.locator('#answers > details').count(),p.answers.length);
  if(scenario==='T14'){assert.ok(await page.getByText('Fascia dichiarata',{exact:false}).count());await page.locator('#economy').evaluate(el=>el.scrollIntoView({block:'start'}));await shot(page,'bands-1440');}
  if(['G06','RECONFIRM','INACTIVE','LEGACY'].includes(scenario)){await page.setViewportSize({width:390,height:844});await fits(page,scenario);await shot(page,`${scenario.toLowerCase()}-390`);await page.setViewportSize({width:1440,height:1000});}
 }
 passed.push('25 rendered canonical fixtures: same six states, complete indicator and original revision inventory, missing data/bands, goals, inactive/reconfirm/legacy distinctions');
 for(const query of ['?personId=11111111-1111-4111-8111-111111111111','?scenario=real','?scenario=T02&scenario=T01']){const r=await ctx.request.get(`${origin}${routePath}${query}`);assert.equal(r.status(),404);assert.ok(!(await r.text()).includes('data-advisor-dashboard'));}
 for(const endpoint of ['/api/patrimonial-radar/advisor','/api/patrimonial-radar/assessments/00000000-0000-4000-8000-000000000002/advisor'])assert.equal((await ctx.request.get(`${origin}${endpoint}`)).status(),404);
 assert.deepEqual(errors,[],'No browser/hydration errors');assert.deepEqual(await page.evaluate(()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage)})),{local:[],session:[]});assert.equal(writes,0,'No attempted writes');assert.equal(external,0,'No attempted external calls');
 passed.push('Only allowlisted scenario selector; copied UUID/unknown/repeated query rejected, no Advisor API, zero writes/external calls/storage or uncaught page errors');
 await ctx.close();await stop();
 for(const [mode,enabled] of [['production',true],['development',false]]){
  const base=await start(mode,enabled),context=await browser.newContext();const r=await context.request.get(`${base}${routePath}?scenario=G05`);assert.equal(r.status(),404);const html=await r.text();assert.ok(!html.includes('data-advisor-dashboard'));assert.ok(!html.includes('11111111-1111-4111-8111-111111111111'));await context.close();await stop();
 }
 passed.push('Actual Next production refuses enabled dev flag; development default/OFF refuses preview, no fixture/person/snapshot dossier in 404 HTML');
 await writeFile(path.join(directory,'verification.json'),JSON.stringify({passed,screenshots,fixtures:PREVIEW_CASES,network:{external,writes},errors},null,2));
 console.log(passed.map(p=>`PASS ${p}`).join('\n'));
} catch(error){for(const page of browser.contexts().flatMap(c=>c.pages()))try{await shot(page,'failure');}catch{}throw error;}finally{await browser.close();await stop();}
