import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {parseDigitalRadar,radarScores} from '../src/lib/digital-radar/contract.ts';

const browserModule=process.env.PLAYWRIGHT_MODULE_PATH;
const {chromium}=await import(browserModule?pathToFileURL(browserModule).href:'playwright');
const base=process.env.DIGITAL_RADAR_TEST_URL??'http://127.0.0.1:3311';
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname),'browser fixture tests are local-only');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:900}});
  await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
  const page=await context.newPage();
  let attempt=0;const bodies=[];
  await page.route('**/api/digital-radar',async route=>{
   const body=route.request().postDataJSON();bodies.push(body);attempt++;
   const parsed=parseDigitalRadar(body,route.request().headers()['idempotency-key']);
   assert(parsed,'the real browser payload satisfies the server contract');
   if(attempt===1)return route.abort('failed');
   return route.fulfill({status:202,contentType:'application/json',body:JSON.stringify({ok:true,scores:radarScores(parsed.payload.answers)})});
  });
  await page.goto(base+'/benessere-digitale/radar');
  await page.locator('input[name=company]').fill('Impresa Prova');
  await page.locator('input[name=province]').fill('Lecce');
  await page.locator('input[name=role]').fill('Amministrazione');
  await page.locator('input[name=role]').press('Enter');
  await page.locator('textarea[name=activity]').waitFor({state:'visible'});
  await page.locator('textarea[name=activity]').fill('Preparo preventivi copiando richieste email in Excel.');
  await page.locator('input[name=tools]').fill('Excel e Outlook');
  await page.locator('select[name=frequency]').selectOption('daily');
  await page.getByRole('button',{name:'Continua',exact:true}).click();
  for(const [name,value] of Object.entries({dati:'3',processi:'2',strumenti:'3',competenze:'2',cultura:'4',sponsor:'unknown'}))await page.locator(`select[name=${name}]`).selectOption(value);
  await page.locator('input[name=consent]').check();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,`no horizontal overflow at ${width}`);
  await page.getByRole('button',{name:'Salva le risposte',exact:true}).click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.getByText('Risposte salvate',{exact:true}).count(),0,'a failed request is not a success');
  await page.getByRole('button',{name:'Riprova invio',exact:true}).click();
  await page.getByText('Risposte salvate',{exact:true}).waitFor();
  assert.equal(bodies[0].requestId,bodies[1].requestId,'network retry preserves request identity');
  assert.equal(bodies[1].answers.sponsor,null);
  assert.equal(bodies[1].contact,null);
  assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'noindex, nofollow');
  assert.equal(await page.locator('meta[name=referrer]').getAttribute('content'),'no-referrer');
  if(process.env.DIGITAL_RADAR_SCREENSHOT_DIR)await page.screenshot({path:process.env.DIGITAL_RADAR_SCREENSHOT_DIR+`/radar-receipt-${width}.png`,fullPage:true});
  // The company entry asks no company/contact fields and carries only its capability token.
  await page.goto(base+'/benessere-digitale/radar/'+'a'.repeat(48));
  assert.equal(await page.locator('input[name=company]').count(),0);
  assert.equal(await page.locator('input[name=email]').count(),0);
  assert.equal(await page.locator('input[name=name]').getAttribute('required'),null);
  await page.locator('input[name=role]').fill('Produzione');
  await page.getByRole('button',{name:'Continua',exact:true}).click();
  await page.locator('textarea[name=activity]').fill('Ricopio manualmente i dati degli ordini nel gestionale.');
  await page.locator('select[name=frequency]').selectOption('other');
  await page.getByRole('button',{name:'Continua',exact:true}).click();
  for(const name of ['dati','processi','strumenti','competenze','cultura','sponsor'])await page.locator(`select[name=${name}]`).selectOption('unknown');
  assert.equal(await page.locator('input[name=email]').count(),0);
  await page.locator('input[name=consent]').check();
  await page.getByRole('button',{name:'Salva le risposte',exact:true}).click();
  await page.getByText('Risposte salvate',{exact:true}).waitFor();
  assert.equal(bodies.at(-1).token,'a'.repeat(48));
  assert.equal(bodies.at(-1).name,'');
  assert.equal(bodies.at(-1).contact,null);
  assert.equal(await page.locator('.rbd-score').count(),0,'all unknown shows no numeric score');
  // Explicit public contact request remains optional and validates its own fields.
  await page.goto(base+'/benessere-digitale/radar');
  await page.locator('input[name=company]').fill('Impresa Ricontatto');
  await page.locator('input[name=province]').fill('Bari');
  await page.locator('input[name=role]').fill('Titolare');
  await page.getByRole('button',{name:'Continua',exact:true}).click();
  await page.locator('textarea[name=activity]').fill('Preparo preventivi copiando richieste email in Excel.');
  await page.locator('select[name=frequency]').selectOption('weekly');
  await page.getByRole('button',{name:'Continua',exact:true}).click();
  for(const name of ['dati','processi','strumenti','competenze','cultura','sponsor'])await page.locator(`select[name=${name}]`).selectOption('3');
  await page.getByLabel('Vorrei essere ricontattato da Horyzon per approfondire.').check();
  await page.locator('input[name=firstName]').fill('Ada');
  await page.locator('input[name=lastName]').fill('Lovelace');
  await page.locator('input[name=email]').fill('ada@example.test');
  await page.locator('input[name=consent]').check();
  await page.getByRole('button',{name:'Salva le risposte',exact:true}).click();
  await page.getByText('Risposte salvate',{exact:true}).waitFor();
  assert.equal(bodies.at(-1).contact.email,'ada@example.test');
  await context.close();
 }
 console.log('PASS digital Radar browser: mobile/desktop, keyboard steps, anonymous mode, retry identity, private link surface.');
}finally{await browser.close();}
