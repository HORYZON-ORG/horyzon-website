import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.ARCHITECT_PREVIEW_TEST_ORIGIN ?? 'http://127.0.0.1:3207';
const path = '/candidature/architetti-patrimoniali/startup';
const token = 'F'.repeat(43);
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});

try {
  for (const width of [390, 1366]) {
    const page = await browser.newPage({ viewport: { width, height: 850 }, reducedMotion: 'reduce' });
    await page.route('https://zbpegzd1dv3ut14o.public.blob.vercel-storage.com/**', route => route.abort());
    let authorizeCompletion = false;
    let attempted = 0;
    await page.route('**/api/architect-startup/video-progress', route => {
      const input = route.request().postDataJSON();
      if (input.complete) attempted++;
      const completed = Boolean(input.complete && authorizeCompletion);
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, completed, positionSeconds: completed ? 660.73 : 0 }),
      });
    });
    await page.goto(origin + path + '#token=' + token, { waitUntil: 'domcontentloaded' });
    const button = page.getByRole('button', { name: 'Ho completato la visione del video' });
    await button.waitFor({ state: 'visible', timeout: 15000 });
    assert.equal(await button.isDisabled(), true);
    await page.waitForTimeout(1500);
    assert.equal(await button.isDisabled(), true, 'No timed unlock before completion');

    const video = page.locator('video');
    await video.evaluate(element => {
      Object.defineProperty(element, 'currentTime', { configurable: true, get: () => 660.73 });
      element.dispatchEvent(new Event('ended'));
    });
    await page.waitForFunction(() =>
      [...document.querySelectorAll('button')].some(b => b.textContent?.includes('Verifica completamento video')),
      undefined, { timeout: 15000 });
    assert.equal(await button.isDisabled(), true, 'A rejected video completion cannot unlock UI');
    assert.equal(attempted, 1, 'Finish checkpoint requested');
    authorizeCompletion = true;
    await page.getByRole('button', { name: /Verifica completamento video/ }).click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll('button')].some(b =>
        b.textContent?.includes('Ho completato la visione del video') && !b.disabled),
      undefined, { timeout: 15000 });
    assert.equal(await button.evaluate(el => getComputedStyle(el).backgroundColor),
      'rgb(216, 255, 66)');
    assert.equal(attempted, 2, 'Explicit end-of-video retry can recover a failed receipt');
    console.log('PASS ' + width + 'px: no timer, no unauthorized finish, end-event retry unlock');
    await page.close();
  }
} finally {
  await browser.close();
}
