import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.ARCHITECT_BROWSER_TEST_ORIGIN || 'http://127.0.0.1:3205';
const path = '/benessere-patrimoniale/percorso-architetto-patrimoniale';
const file = Buffer.from((await readFile(new URL('./fixtures/architect-cv-horyzon-qa.b64', import.meta.url),'utf8')).trim(), 'base64');
assert.equal(file.subarray(0,5).toString('ascii'), '%PDF-');
const cvId = 'd56936f3-ec2b-4aab-8b7b-33ff82e9c56a';

async function runCase(browser, viewport) {
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  let uploads=0, intake=0, lastPayload=null;
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));

  // Block every real network call to the Website candidate endpoints.
  await page.route('**/api/public-leads/cv',async route=>{
    uploads++;
    const req=route.request();
    assert.equal(req.method(),'POST');
    assert.equal(req.headers()['content-type'],'application/pdf');
    assert.deepEqual(req.postDataBuffer(),file,'browser sent exact test PDF');
    await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({ok:true,cvId})});
  });
  await page.route('**/api/public-leads',async route=>{
    intake++;
    const req=route.request();
    assert.equal(req.method(),'POST');
    lastPayload=req.postDataJSON();
    assert.equal(lastPayload.mode,'architect-path');
    assert.equal(lastPayload.cvId,cvId);
    assert.equal(lastPayload.firstName,'Andrea');
    assert.equal(lastPayload.lastName,'Collaudo');
    assert.equal(lastPayload.email,'andrea.collaudo@example.invalid');
    assert.equal(lastPayload.consent,true);
    assert.equal(lastPayload.marketingConsent,false);
    assert.equal(lastPayload.province,'Bari');
    assert.equal(lastPayload.utm?.utm_source,'horyzon-qa-browser');
    await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({ok:true,message:'Candidatura ricevuta.'})});
  });

  try{
    await page.goto(base+path+'?tema=scuro&utm_source=horyzon-qa-browser',
      {waitUntil:'domcontentloaded',timeout:90000});
    const form=page.locator('form[data-pilot-form="architect-path"]');
    await form.waitFor({state:'visible',timeout:45000});
    await form.locator('[name="firstName"]').fill('Andrea');
    await form.locator('[name="lastName"]').fill('Collaudo');
    await form.locator('[name="email"]').fill('andrea.collaudo@example.invalid');
    await form.locator('[name="phone"]').fill('3331234567');
    await form.locator('[name="consent"]').check();
    await form.locator('button[type="submit"]').click();
    try {
      await form.locator('[name="province"]').waitFor({state:'visible',timeout:16000});
    } catch (err) {
      const state=await form.evaluate(el=>({
        step:el.querySelector('.formProgress')?.textContent?.slice(0,100)??'unknown',
        fieldsets:[...el.querySelectorAll('fieldset')].map(f=>({
          hidden:f.hidden,disabled:f.disabled,
          invalid:[...f.querySelectorAll('input[required]')].filter(i=>!i.checkValidity()).map(i=>i.name)
        })),
        submitDisabled:el.querySelector('button[type="submit"]')?.disabled,
      }));
      console.error('ARCHITECT_BROWSER_STEP1_DIAGNOSTIC',JSON.stringify({
        viewport:viewport.width+'x'+viewport.height,
        state,url:new URL(page.url()).pathname,
        pageErrors:errors.length,
      }));
      throw err;
    }
    assert.equal(intake,0,'no candidate before second step');
    assert.equal(uploads,0,'no CV before second step');

    await form.locator('[name="province"]').fill('Bari');
    await form.locator('[name="message"]').fill('COLLAUDO FINTIZIO - NESSUNA COMUNICAZIONE');
    await form.locator('input[type="file"][name="cv"]').setInputFiles({
      name:'CV_Architetto_Patrimoniale_TEST_E2E.pdf',mimeType:'application/pdf',buffer:file,
    });
    await form.locator('button[type="submit"]').click();
    await page.waitForURL(new RegExp('/benessere-patrimoniale/percorso-architetto-patrimoniale/grazie(?:[?#]|$)'),{timeout:30000});
    assert.equal(uploads,1,'exactly one CV uploaded');
    assert.equal(intake,1,'exactly one candidate intake');
    assert.equal(lastPayload.sourcePath,path);
    assert.deepEqual(errors,[],'browser errors');
    console.log('ARCHITECT_BROWSER: PASS '+viewport.width+'x'+viewport.height+' (two steps, CV, consent, UTM, thank-you; API intercepted)');
  }finally{
    await context.close();
  }
}

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
  await runCase(browser,{width:1280,height:800});
  await runCase(browser,{width:390,height:844});
} finally {
  await browser.close();
}
