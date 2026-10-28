import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {writeFile} from 'node:fs/promises';
/** Synthetic retained-layout fixture: no actual third-party code is executed. */
export async function verifyDocumentBoundary({base,runtime,executable,artifacts}) {
 const {chromium}=await import(pathToFileURL(path.resolve(runtime)).href);
 const browser=await chromium.launch({headless:true,executablePath:executable});
 let documents=0,external=0,writes=0,exitDocument=false;
 try {
  const ctx=await browser.newContext();
  await ctx.addInitScript(()=>{const forbidden=()=>{throw Error('Storage forbidden');};Storage.prototype.setItem=forbidden;navigator.sendBeacon=forbidden;IDBFactory.prototype.open=forbidden;});
  await ctx.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin!==base){external++;return route.abort();}
   if(!['GET','HEAD'].includes(request.method())){writes++;return route.abort();}
   if(request.isNavigationRequest()&&url.pathname==='/radar-patrimoniale') {
    documents++;
    if(documents===1){const response=await route.fetch();const html=(await response.text()).replace('data-radar-isolated="true"','data-radar-isolated="false"').replace('<head>','<head><script>window._iub={syntheticLegacy:true};window.syntheticLegacyDocument=true;</script>');return route.fulfill({response,body:html});}
   }
   if(request.isNavigationRequest()&&url.pathname==='/'){exitDocument=true;return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body>Ordinary document fixture</body></html>'});}
   return route.continue();
  });
  const page=await ctx.newPage();await page.goto(base+'/radar-patrimoniale');await page.locator('[data-mode=PUBLIC_ANONYMOUS]').waitFor();
  assert.equal(documents,2,'Unisolated retained layout requires a new document');
  assert.equal(await page.evaluate(()=>typeof window._iub),'undefined');assert.equal(await page.evaluate(()=>typeof window.syntheticLegacyDocument),'undefined');
  await page.getByRole('button',{name:'Inizia la fotografia',exact:true}).click();await page.locator('[data-question-id]').waitFor();
  await page.locator('input[value=INDIVIDUAL]').check();await page.locator('[data-question-id] button[type=submit]').click();await page.locator('[data-question-id=RP-S02]').waitFor();
  await page.getByRole('button',{name:'Preferisco non rispondere',exact:true}).click();await page.locator('[data-question-id] button[type=submit]').click();await page.locator('[data-question-id=RP-S03]').waitFor();
  await page.getByRole('button',{name:'← Precedente',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Preferisco non rispondere',exact:true}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'Non so',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Non so',exact:true}).getAttribute('aria-pressed'),'true');await page.getByText('Il dato resterà sconosciuto, senza sostituirlo con una stima. Puoi cambiare scelta compilando il campo sopra.',{exact:true}).waitFor();

  await page.getByRole('link',{name:'Horyzon, homepage',exact:true}).click();await page.getByText('Ordinary document fixture').waitFor();assert(exitDocument);assert.equal(await page.evaluate(()=>document.querySelector('[data-question-id]')),null);
  assert.equal(external,0);assert.equal(writes,0);await ctx.close();
  await writeFile(path.join(artifacts,'boundary-verification.json'),JSON.stringify({documents,external,writes,entryReload:true,legacyGlobalCleared:true,exitDocument,declinedVsUnknown:true},null,2));
  console.log('PASS document privacy boundary: retained-layout fixture forces a fresh document before controls; inherited global cleared; exit also full document; DECLINED saved/revisited distinctly from UNKNOWN; zero external calls/writes');
 } finally {await browser.close();}
}
