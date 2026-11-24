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
      // Test native player lifecycle deterministically without downloading 227 MB.
      HTMLMediaElement.prototype.play = function() {
        this.dispatchEvent(new Event('play'));
        return Promise.resolve();
      };
      HTMLMediaElement.prototype.pause = function() {
        this.dispatchEvent(new Event('pause'));
      };
    });

    let requests = 0;
    await page.route('**/api/architect-startup/video-gate', route => {
      requests++;
      // The second response represents the same server-side timer after 661 s.
      // No real waiting and no access to the production database.
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, remainingSeconds: requests === 1 ? 661 : 0 }),
      });
    });

    const firstReceipt = page.waitForResponse(r => r.url().includes('/api/architect-startup/video-gate'));
    await page.goto(origin + startupPath + '#token=' + token, { waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('video').count(), 1, 'Native HTML5 video player is used');
    assert.equal(await page.locator('iframe[src*="drive.google.com"]').count(), 0, 'Google Drive iframe removed');
    assert.equal(await page.getByRole('heading', { name: /Un progetto da conoscere.*Una scelta da fare consapevolmente/ }).count(), 1, 'Compact title before the video');
    assert.equal(await page.locator('.unused-hero').count(), 0);
    assert.equal(await page.locator('video').getAttribute('poster'), null, 'Old skyline poster removed');
    // The video card must sit entirely on the cream canvas, with balanced space
    // above the video and below the decision panel (before the footer).
    const layout = await page.evaluate(() => {
      const intro = document.querySelector('section[aria-labelledby="startup-video-title"]');
      const presentation = document.querySelector('#startup-video');
      const blocks = presentation?.querySelectorAll(':scope > div');
      const footer = document.querySelector('footer');
      if (!intro || !blocks || blocks.length < 2 || !footer) return null;
      return {
        topGap: blocks[0].getBoundingClientRect().top - intro.getBoundingClientRect().bottom,
        bottomGap: footer.getBoundingClientRect().top - blocks[blocks.length - 1].getBoundingClientRect().bottom,
      };
    });
    assert.ok(layout, 'Startup hero, video, decision and footer are present');
    const targetGap = width <= 750 ? 42 : 64;
    assert.ok(Math.abs(layout.topGap - targetGap) <= 3, 'Video should be separated from hero by ' + targetGap + 'px');
    assert.ok(Math.abs(layout.topGap - layout.bottomGap) <= 4, 'Top and bottom spacing should be visually balanced');
    const cover = page.getByRole('button', { name: 'Riproduci la presentazione Startup Horyzon' });
    await cover.waitFor({ state: 'visible' });
    assert.equal(await page.getByRole('heading', { name: 'Ti riconosci in questo progetto?' }).count(), 1);
    await cover.click();
    await cover.waitFor({ state: 'hidden' });
    assert.equal(await page.locator('video').evaluate(v => v.controls), true, 'Controls available while playing');
    await page.locator('video').evaluate(v => v.pause());
    await cover.waitFor({ state: 'visible' });
    assert.equal(await page.locator('video').evaluate(v => v.controls), false, 'Branded cover returns on pause');
    await firstReceipt;

    const button = page.getByRole('button', { name: 'Ho completato la visione del video e vado avanti' });
    await button.waitFor({ state: 'visible', timeout: 15000 });
    assert.equal(await button.isDisabled(), true, '661s server gate locks the CTA');
    assert.equal(await button.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(221, 225, 226)');
    assert.equal(await page.getByRole('heading', { name: 'Ti riconosci in questo progetto?' }).isVisible(), true);
    assert.equal(await page.getByRole('checkbox', { name: /terminato di vedere/i }).count(), 0, 'No manual bypass checkbox');
    assert.equal(await page.getByRole('button', { name: 'Voglio essere ricontattato da un Architetto Patrimoniale Horyzon' }).count(), 0, 'Contact consent only after attestation');

    await page.getByRole('button', { name: 'Vai al video Startup Horyzon' }).click();
    assert.equal(new URL(page.url()).hash, '#token=' + token, 'Header must not erase candidate token');
    const secondReceipt = page.waitForResponse(r => r.url().includes('/api/architect-startup/video-gate'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await secondReceipt;
    await button.waitFor({ state: 'visible' });
    await page.waitForFunction(() => {
      const el = [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Ho completato la visione del video e vado avanti'));
      return el && !el.disabled;
    });
    assert.equal(await button.isEnabled(), true, 'Server says elapsed: CTA enabled');
    assert.equal(await button.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(216, 255, 66)');
    await page.getByRole('button', { name: /Rivedi la presentazione/ }).click();
    assert.equal(new URL(page.url()).hash, '#token=' + token, 'Footer must not erase candidate token');

    await button.click();
    const finalButton = page.getByRole('button', { name: 'Voglio essere ricontattato da un Architetto Patrimoniale Horyzon' });
    await finalButton.waitFor();
    assert.equal(await finalButton.isEnabled(), true);
    assert.equal(await page.getByText('Hai confermato la visione.', { exact: false }).count(), 1);
    console.log('PASS Startup ' + width + 'px: branded video cover/play/pause, 661s gate, contact opt-in');
    await page.close();

    const anonymous = await browser.newPage({ viewport: { width, height: 860 }, reducedMotion: 'reduce' });
    await anonymous.route('https://zbpegzd1dv3ut14o.public.blob.vercel-storage.com/**', route => route.abort());
    await anonymous.goto(origin + startupPath, { waitUntil: 'domcontentloaded' });
    const anonButton = anonymous.getByRole('button', { name: 'Ho completato la visione del video e vado avanti' });
    await anonButton.waitFor({ state: 'visible', timeout: 15000 });
    assert.equal(await anonButton.isDisabled(), true, 'No-token visitor cannot bypass server gate');
    await anonymous.close();

    // Candidate returns later to the plain Startup URL in the same browser.
    // A secure cookie is verified by the server (mocked here) and restores the
    // unique bearer link without asking for contact details again.
    const returnPage = await browser.newPage({ viewport: { width, height: 860 }, reducedMotion: 'reduce' });
    await returnPage.route('https://zbpegzd1dv3ut14o.public.blob.vercel-storage.com/**', route => route.abort());
    let resumeCalls = 0;
    await returnPage.route('**/api/architect-startup/resume', route => {
      resumeCalls++;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, token }),
      });
    });
    await returnPage.route('**/api/architect-startup/video-gate', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, remainingSeconds: 0 }),
    }));
    await returnPage.goto(origin + startupPath, { waitUntil: 'domcontentloaded' });
    await returnPage.waitForFunction((expected) =>
      window.location.hash === '#token=' + expected, token, { timeout: 15000 });
    assert.equal(resumeCalls, 1, 'Only one same-browser resume check is needed');
    await returnPage.waitForFunction(() => {
      const button = [...document.querySelectorAll('button')].find(
        node => node.textContent?.includes('Ho completato la visione del video e vado avanti'));
      return button && !button.disabled;
    }, undefined, { timeout: 15000 });
    assert.equal(await returnPage.getByRole('button', {
      name: 'Ho completato la visione del video e vado avanti',
    }).isEnabled(), true, 'Recovered candidate retains completed server timer');
    assert.equal(await returnPage.locator('input[name="email"]').count(), 0,
      'Resume does not ask for PII a second time');
    await returnPage.close();
    console.log('PASS Startup same-browser return ' + width + 'px: candidate link restored without new form');
  }
} finally {
  await browser.close();
}
