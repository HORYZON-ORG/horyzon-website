import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {writeFile} from 'node:fs/promises';

// Real Next documents and router; only third-party consent responses are inert test stubs.
export async function verifyRealDocuments({base,runtime,executable,artifacts}) {
 const {chromium}=await import(pathToFileURL(path.resolve(runtime)).href);
 const browser=await chromium.launch({headless:true,executablePath:executable});
 const evidence={widths:[],ordinaryConsentRequests:0,anonymousExternalRequests:0,writes:0,routes:[],errors:[]};
 try {
  for(const width of [320,390,768,1440]) {
   const ctx=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});
   const page=await ctx.newPage();const documents=[];
   page.on('pageerror',e=>evidence.errors.push(e.message));
   await ctx.route('**/*',route=>{
    const req=route.request(),url=new URL(req.url());
    if(!['GET','HEAD'].includes(req.method())){evidence.writes++;return route.abort();}
    if(req.isNavigationRequest())documents.push(url.pathname);
    if(url.origin!==base) {
     if(page.url().includes('/radar-patrimoniale'))evidence.anonymousExternalRequests++;
     if(url.hostname.endsWith('iubenda.com')){evidence.ordinaryConsentRequests++;return route.fulfill({contentType:'application/javascript',body:'/* inert consent QA stub; no provider call */'});}
     return route.abort();
    }
    return route.continue();
   });
   const home=await page.goto(base+'/',{waitUntil:'networkidle'});
   assert.equal(home.status(),200);assert.equal((await page.locator('h1').innerText()).replace(/\s+/g,' '),'Far stare bene un’impresa, davvero.');
   assert(await page.locator('script[src*=iubenda]').count()>0);
   assert.equal(await page.locator('html').getAttribute('data-radar-isolated'),null);
   await page.waitForFunction(()=>!!window.next?.router);
   await page.evaluate(()=>{window.syntheticOrdinaryDocument=true;window.next.router.push('/radar-patrimoniale');});
   await page.locator('[data-mode=PUBLIC_ANONYMOUS]').waitFor();
   assert(documents.includes('/radar-patrimoniale'),'Next router must cross roots with a document navigation');
   assert.equal(await page.evaluate(()=>typeof window.syntheticOrdinaryDocument),'undefined');
   assert.equal(await page.evaluate(()=>typeof window._iub),'undefined');
   assert.equal(await page.locator('script[src*=iubenda]').count(),0);
   assert.equal(await page.locator('html').getAttribute('data-radar-isolated'),'true');
   await page.getByRole('button',{name:'Inizia la fotografia',exact:true}).click();
   await page.locator('[data-question-id]').waitFor();
   await page.screenshot({path:path.join(artifacts,'real-entry-'+width+'.png')});
   await page.getByRole('link',{name:'Horyzon, homepage',exact:true}).click();
   await page.waitForURL(base+'/');await page.locator('h1').waitFor();
   await page.waitForLoadState('networkidle');
   assert.equal(documents.filter(p=>p==='/').length,2);
   assert.equal(await page.locator('[data-question-id]').count(),0);
   assert(await page.locator('script[src*=iubenda]').count()>0);
   await page.screenshot({path:path.join(artifacts,'real-home-'+width+'.png')});
   evidence.widths.push({width,documents,ordinaryGlobalCleared:true,exitRestoresOrdinaryShell:true});
   await ctx.close();
  }
  // All moved page types, including both funnel themes, without submitting forms.
  const ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await ctx.route('**/*',route=>{const r=route.request();if(!['GET','HEAD'].includes(r.method())){evidence.writes++;return route.abort();}return new URL(r.url()).origin===base?route.continue():route.fulfill({contentType:'application/javascript',body:'/* inert QA stub */'});});
  const page=await ctx.newPage();
  for(const route of ['/radar','/radar-impresa','/ai-score','/ai-score/methodology','/annunci-10x','/annuncio-10x','/contatti','/frank','/metodo','/le-tre-aree','/collaboratori-vincenti','/termini-condizioni','/v/frank',
   ...['evento','percorso-architetto-patrimoniale'].flatMap(p=>['chiaro','scuro'].map(t=>'/benessere-patrimoniale/'+p+'?tema='+t))]) {
   console.log('CHECK route',route);
   const r=await page.goto(base+route,{waitUntil:'domcontentloaded'});assert.equal(r.status(),200,route);
   assert(await page.locator('h1').count()>0,route+' heading');await page.waitForFunction(()=>document.fonts.status==='loaded');
   const broken=await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.getAttribute('src')));
   assert.deepEqual(broken,[],route+' images');
   assert(await page.locator('meta[name=description]').count()>0,route+' description');
   if(route==='/radar')assert.match(await page.locator('meta[name=robots]').getAttribute('content'),/noindex/);
   if(route.startsWith('/benessere')){await page.locator('[data-theme='+ (route.endsWith('chiaro')?'light':'dark') +']').waitFor();assert.equal(await page.getByRole('button',{name:route.endsWith('chiaro')?'Chiaro':'Scuro',exact:true}).getAttribute('aria-pressed'),'true');}
   if(route.startsWith('/benessere'))await page.screenshot({path:path.join(artifacts,route.includes('architetto')?'architect-'+route.split('=')[1]+'.png':'event-'+route.split('=')[1]+'.png')});
   if(route==='/radar')await page.screenshot({path:path.join(artifacts,'business-radar.png')});
   evidence.routes.push({route,status:r.status(),heading:true,images:true,metadata:true});
  }
  const missing=await page.goto(base+'/__4p3c_missing__',{waitUntil:'domcontentloaded'});assert.equal(missing.status(),404);await page.getByRole('heading',{name:/Un altro orizzonte/}).waitFor();assert(await page.locator('script[src*=iubenda]').count()>0);await page.screenshot({path:path.join(artifacts,'ordinary-404.png')});
  await ctx.close();
  assert.equal(evidence.anonymousExternalRequests,0);assert.equal(evidence.writes,0);assert.deepEqual(evidence.errors,[]);
  await writeFile(path.join(artifacts,'real-document-verification.json'),JSON.stringify(evidence,null,2));
  console.log('PASS real home → Next router → anonymous → home, four widths, fresh documents, ordinary consent restored; moved route/metadata/image smoke and funnel themes');
 }finally{await browser.close();}
}
