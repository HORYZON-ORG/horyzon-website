import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.ARCHITECT_PREVIEW_TEST_ORIGIN ?? 'http://127.0.0.1:3207';
const startupPath = '/candidature/architetti-patrimoniali/startup';
const token = 'A'.repeat(43);
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 390, 1366]) {
    const page = await browser.newPage({ viewport: { width, height: 860 }, reducedMotion: 'reduce' });
    await page.route('https://zbpegzd1dv3ut14o.public.blob.vercel-storage.com/**', route => route.abort());
    await page.addInitScript(() => {
      HTMLMediaElement.prototype.play = function() {
        this.dispatchEvent(new Event('play'));
        return Promise.resolve();
      };
      HTMLMediaElement.prototype.pause = function() {
        this.dispatchEvent(new Event('pause'));
      };
    });
    let completed = false;
    let finishReceipts = 0;
    await page.route('**/api/architect-startup/video-progress', route => {
      const input = route.request().postDataJSON();
      if (input.complete === true) {
        finishReceipts++;
        completed = true;
      }
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, completed, positionSeconds: completed ? 660.73 : 0 }),
      });
    });

    await page.goto(origin + startupPath + '#token=' + token, { waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('video').count(), 1, 'Native HTML5 video');
    assert.equal(await page.locator('iframe[src*="drive.google.com"]').count(), 0);
    assert.equal(await page.getByRole('heading', { name: /Un progetto da conoscere.*Una scelta da fare consapevolmente/ }).count(), 1);
    assert.equal(await page.locator('video').getAttribute('poster'), null, 'No old skyline poster');
    const layout = await page.evaluate(() => {
      const intro = document.querySelector('section[aria-labelledby="startup-video-title"]');
      const presentation = document.querySelector('#startup-video');
      const blocks = presentation?.querySelectorAll(':scope > div');
      const footer = document.querySelector('footer');
      if (!intro || !blocks || blocks.length < 2 || !footer) return null;
      return {
        top: blocks[0].getBoundingClientRect().top - intro.getBoundingClientRect().bottom,
        bottom: footer.getBoundingClientRect().top - blocks[blocks.length - 1].getBoundingClientRect().bottom,
      };
    });
    assert.ok(layout, 'Video and decision stay in cream canvas');
    assert.ok(Math.abs(layout.top - (width <= 750 ? 42 : 64)) <= 3);
    assert.ok(Math.abs(layout.top - layout.bottom) <= 4);

    const video = page.locator('video');
    assert.equal(await video.evaluate(el => el.controls), false, 'Native scrubbing disabled');
    assert.equal(await page.locator('input[type="range"]').count(), 0, 'No draggable progress slider');
    assert.equal(await page.getByRole('button', { name: /avanti di 10 secondi|salta avanti/i }).count(), 0);
    const cta = page.getByRole('button', { name: 'Ho completato la visione del video e vado avanti' });
    await cta.waitFor({ state: 'visible' });
    assert.equal(await cta.isDisabled(), true, 'No timer-only unlock');
    assert.equal(await cta.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(221, 225, 226)');

    for (const rate of ['1', '1,1', '1,25', '1,5']) {
      await page.getByRole('button', { name: 'Riproduzione a ' + rate + ' volte' }).click();
      const expected = Number(rate.replace(',', '.'));
      assert.equal(await video.evaluate(el => el.playbackRate), expected);
    }
    assert.equal(await page.getByRole('button', { name: 'Riproduzione a 1,5 volte' }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('button', { name: 'Torna indietro di 10 secondi' }).isVisible(), true);

    const cover = page.getByRole('button', { name: 'Riproduci la presentazione Startup Horyzon' });
    await cover.waitFor({ state: 'visible' });
    await cover.click();
    await cover.waitFor({ state: 'hidden' });
    await video.evaluate(el => el.pause());
    await cover.waitFor({ state: 'visible' });
    assert.equal(await video.evaluate(el => el.controls), false, 'Native scrubber never appears');

    // A real onEnded event (never elapsed wall time) starts the final receipt.
    await video.evaluate(el => {
      Object.defineProperty(el, 'currentTime', { configurable: true, get: () => 660.73 });
      el.dispatchEvent(new Event('ended'));
    });
    await page.waitForFunction(() => {
      const b = [...document.querySelectorAll('button')].find(x =>
        x.textContent?.includes('Ho completato la visione del video e vado avanti'));
      return b && !b.disabled;
    }, undefined, { timeout: 15000 });
    assert.equal(finishReceipts, 1, 'onEnded sends exactly one completion receipt');
    assert.equal(await cta.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(216, 255, 66)');
    await cta.click();
    assert.equal(await page.getByRole('button', {
      name: 'Voglio essere ricontattato da un Architetto Patrimoniale Horyzon',
    }).isVisible(), true);
    console.log('PASS Startup native video ' + width + 'px: no seeking, four speeds, back-10 and onEnded unlock');
    await page.close();
  }
} finally {
  await browser.close();
}
