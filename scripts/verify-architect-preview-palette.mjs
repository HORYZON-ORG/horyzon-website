import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const ROOT = process.env.ARCHITECT_PREVIEW_TEST_ORIGIN ?? 'http://127.0.0.1:3206';
const route = '/benessere-patrimoniale/percorso-architetto-patrimoniale';
const lime = 'rgb(216, 255, 66)';
const ink = 'rgb(7, 23, 29)';
const browser = await chromium.launch({ headless: true });
try {
  for (const [theme,query] of [['dark',''],['light','?tema=chiaro']]) {
    for (const width of [390,1440]) {
      const page = await browser.newPage({ viewport:{ width,height:900 }, reducedMotion:'reduce' });
      await page.goto(ROOT+route+query, { waitUntil:'networkidle' });
      await page.locator('[data-theme]').waitFor();
      // The client theme may hydrate after the server returns its default.
      await page.waitForFunction(t => document.querySelector('[data-theme]')?.getAttribute('data-theme') === t, theme);
      const result = await page.evaluate(() => {
        const figure = document.querySelector('figure[role="img"][aria-label*="Tavola"]');
        const building = figure?.firstElementChild?.firstElementChild;
        const roof=building?.children?.[0], columns=building?.children?.[1], foundation=building?.children?.[2];
        const nav=document.querySelector('button[aria-label="Testimonianza successiva"]');
        const cta=document.querySelector('a[href="#richiesta"]');
        const title=document.querySelector('h1 span');
        const css = el => el ? getComputedStyle(el) : null;
        return {
          theme:document.querySelector('[data-theme]')?.getAttribute('data-theme'),
          cta:css(cta)?.backgroundColor,
          roof:css(roof)?.backgroundImage,
          columns:columns?.children?.length ?? 0,
          pillarBorder:css(columns?.firstElementChild)?.borderTopColor,
          pillarBackground:css(columns?.firstElementChild)?.backgroundColor,
          foundation:css(foundation)?.backgroundColor,
          nav:css(nav)?.backgroundColor,
          titleColor:css(title)?.color,
          titleHighlight:css(title)?.backgroundImage,
          limeToken:css(document.documentElement)?.getPropertyValue('--lime')?.trim()
        };
      });
      assert.equal(result.theme,theme,JSON.stringify(result));
      assert.equal(result.limeToken.toLowerCase(),'#d8ff42',JSON.stringify(result));
      assert.equal(result.cta,lime,'CTA must remain neon lime: '+JSON.stringify(result));
      assert.equal(result.foundation,lime,'Foundation must remain neon lime: '+JSON.stringify(result));
      assert.match(result.roof,/216, 255, 66/,'Roof must include neon lime: '+JSON.stringify(result));
      assert.equal(result.columns,3,'Architect building must contain three columns');
      assert.equal(result.pillarBorder,lime,'Columns must have lime outlines: '+JSON.stringify(result));
      assert.equal(result.nav,theme==='dark'?ink:lime,'Carousel buttons cannot be blank white');
      if (theme === 'dark') assert.equal(result.titleColor,lime,'Dark hero title needs lime emphasis');
      else assert.match(result.titleHighlight,/216, 255, 66/,'Light hero text needs lime underline');
      await page.screenshot({ path:`/tmp/architect-preview-${theme}-${width}.png`, fullPage:true });
      console.log(`PASS architect preview color tokens, building, buttons and CTA: ${theme} / ${width}px`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
