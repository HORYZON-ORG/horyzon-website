import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const LOCAL = process.env.ARCHITECT_PREVIEW_TEST_ORIGIN ?? 'http://127.0.0.1:3206';
const REFERENCE = 'https://horyzon-website-git-feat-patrimonial-ccaac5-horyzon-consulting.vercel.app';
const ROUTE = '/benessere-patrimoniale/percorso-architetto-patrimoniale';
const browser = await chromium.launch({headless:true});

async function inspect(base, theme, width, label) {
  const page = await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  await page.goto(base+ROUTE+'?tema='+theme,{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('[data-theme]').waitFor({timeout:15000});
  await page.waitForFunction(() => document.querySelector('[data-theme]')?.getAttribute('data-theme') === 'light',null,{timeout:20000});
  const result = await page.evaluate(() => {
    const fig=document.querySelector('figure[role="img"][aria-label*="Tavola"]');
    const inner=fig?.firstElementChild?.firstElementChild;
    const roof=inner?.children?.[0], pillars=inner?.children?.[1], foundation=inner?.children?.[2];
    const style=el=>el?getComputedStyle(el):null;
    const rgb=(el,k)=>style(el)?.[k]??null;
    const hero=document.querySelector('h1 span');
    const nav=document.querySelector('button[aria-label="Testimonianza successiva"]');
    const submit=document.querySelector('form[data-pilot-form="architect-path"] button[type="submit"]');
    const cta=document.querySelector('section a[href="#richiesta"]');
    const frame=document.querySelector('[data-theme]');
    const root=document.querySelector('div[class*="page_"]');
    return {
      theme:frame?.getAttribute('data-theme'),
      ink:style(root)?.getPropertyValue('--ink').trim(),
      lime:style(root)?.getPropertyValue('--lime').trim(),
      accent:style(root)?.getPropertyValue('--accent-stroke').trim(),
      roofGradient:rgb(roof,'backgroundImage'),
      roofColor:rgb(roof,'color'),
      pillarCount:pillars?.children?.length??0,
      pillarBorder:rgb(pillars?.firstElementChild,'borderTopColor'),
      pillarFill:rgb(pillars?.firstElementChild,'backgroundColor'),
      foundationFill:rgb(foundation,'backgroundColor'),
      navFill:rgb(nav,'backgroundColor'),
      navText:rgb(nav,'color'),
      submitFill:rgb(submit,'backgroundColor'),
      submitText:rgb(submit,'color'),
      heroColor:rgb(hero,'color'),
      ctaFill:rgb(cta,'backgroundColor'),
      frameFill:rgb(frame,'backgroundColor')
    };
  });

    const diagnostics = await page.evaluate(() => {
      const fig=document.querySelector('figure[role="img"][aria-label*="Tavola"]');
      const roof=fig?.firstElementChild?.firstElementChild?.children?.[0];
      const styles = [...document.styleSheets].flatMap(sheet => {
        try { return [...sheet.cssRules].flatMap(rule => rule.cssRules ? [...rule.cssRules] : [rule]).filter(rule => rule.selectorText && /s093|s096|navBtn|s023/.test(rule.selectorText)).slice(0,15).map(rule => ({selector:rule.selectorText,css:rule.cssText.slice(0,300)})); } catch { return []; }
      }).slice(0,30);
      return {roofClass:roof?.className, figureClass:fig?.className,cssSheets:document.styleSheets.length, matching:styles,rootColor:getComputedStyle(document.documentElement).getPropertyValue('--lime'), bodyClass:document.body.className};
    });
    console.log('DEBUG '+label+' '+width+' '+JSON.stringify(diagnostics).slice(0,14000));

  await page.screenshot({path:`/tmp/architect-${label}-chiaro-${width}.png`,fullPage:true});
  await page.close();
  return result;
}

try {
  for(const width of [390,1440]) {
    const reference=await inspect(REFERENCE,'chiaro',width,'reference');
    const current=await inspect(LOCAL,'chiaro',width,'restored');
    const checked=['theme','lime','accent','roofGradient','roofColor','pillarCount','pillarBorder','pillarFill','foundationFill','navFill','navText','submitFill','submitText','heroColor','ctaFill'];
    for(const key of checked) {
      assert.equal(current[key],reference[key],`Design mismatch at ${width}px, ${key}: ${JSON.stringify({reference,current})}`);
    }
    assert.equal(current.theme,'light');
    assert.equal(current.pillarCount,3);
    console.log(`PASS reference-matched light theme computed styles at ${width}px`);
  }
} finally { await browser.close(); }
