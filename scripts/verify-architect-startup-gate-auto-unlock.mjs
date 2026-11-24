import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.ARCHITECT_PREVIEW_TEST_ORIGIN ?? 'http://127.0.0.1:3207';
const startupPath = '/candidature/architetti-patrimoniali/startup';
const token = 'F'.repeat(43);
const browser = await chromium.launch({ headless: true });

try {
  for (const [width, method] of [[390, 'manual'], [1366, 'poll'], [390, 'focus']]) {
    const page = await browser.newPage({ viewport: { width, height: 850 }, reducedMotion: 'reduce' });
    await page.route('https://zbpegzd1dv3ut14o.public.blob.vercel-storage.com/**', route => route.abort());
    let mayUnlock = false;
    let checks = 0;
    await page.route('**/api/architect-startup/video-gate', route => {
      checks++;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, remainingSeconds: mayUnlock ? 0 : 661 }),
      });
    });

    await page.goto(origin + startupPath + '#token=' + token, { waitUntil: 'domcontentloaded' });
    const cta = page.getByRole('button', {
      name: 'Ho completato la visione del video e vado avanti',
    });
    await cta.waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForFunction(() => !!document.querySelector('button') &&
      document.querySelector('video') !== null);
    await page.waitForFunction(() => {
      const b = [...document.querySelectorAll('button')].find(x =>
        x.textContent?.includes('Verifica se puoi proseguire'));
      return !!b;
    });
    assert.equal(await cta.isDisabled(), true, 'Initially locked even if video is available');
    assert.equal(await cta.evaluate(el => getComputedStyle(el).backgroundColor),
      'rgb(221, 225, 226)', 'Grey while server wait is active');
    const firstChecks = checks;
    assert.ok(firstChecks >= 1, 'The server gate was queried');

    mayUnlock = true;
    if (method === 'manual') {
      await page.getByRole('button', { name: /Verifica se puoi proseguire/ }).click();
    } else if (method === 'focus') {
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    } else {
      // No reload, no clicks, no focus: the polling watchdog itself must
      // recover a backend gate that has become eligible.
      await page.waitForTimeout(11_500);
    }

    await page.waitForFunction(() => {
      const el = [...document.querySelectorAll('button')].find(b =>
        b.textContent?.includes('Ho completato la visione del video e vado avanti'));
      return el && !el.disabled;
    }, undefined, { timeout: 15000 });
    assert.ok(checks > firstChecks, 'Must recheck the authoritative backend');
    assert.equal(await cta.evaluate(el => getComputedStyle(el).backgroundColor),
      'rgb(216, 255, 66)', 'Green after the server releases the gate');
    assert.equal(await page.getByRole('button', { name: /Verifica se puoi proseguire/ }).count(), 0);
    await cta.click();
    assert.equal(await page.getByRole('button', {
      name: 'Voglio essere ricontattato da un Architetto Patrimoniale Horyzon',
    }).isVisible(), true);
    console.log('PASS Startup ' + width + 'px: server gate auto unlock via ' + method +
      ', no reload, explicit contact CTA, checks=' + checks);
    await page.close();
  }
} finally {
  await browser.close();
}
