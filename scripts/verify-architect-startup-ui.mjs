import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.ARCHITECT_PREVIEW_TEST_ORIGIN ?? 'http://127.0.0.1:3207';
const startupPath = '/candidature/architetti-patrimoniali/startup';
const token = 'A'.repeat(43);
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [390, 1366]) {
    const page = await browser.newPage({ viewport: { width, height: 860 }, reducedMotion: 'reduce' });
    await page.route('https://drive.google.com/**', route =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Video test</title>' }));

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
    console.log('PASS Startup gate ' + width + 'px: 661s grey lock, server ready lime, explicit two-step consent');
    await page.close();

    const anonymous = await browser.newPage({ viewport: { width, height: 860 }, reducedMotion: 'reduce' });
    await anonymous.route('https://drive.google.com/**', route =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Video test</title>' }));
    await anonymous.goto(origin + startupPath, { waitUntil: 'domcontentloaded' });
    const anonButton = anonymous.getByRole('button', { name: 'Ho completato la visione del video e vado avanti' });
    await anonButton.waitFor({ state: 'visible', timeout: 15000 });
    assert.equal(await anonButton.isDisabled(), true, 'No-token visitor cannot bypass server gate');
    await anonymous.close();
  }
} finally {
  await browser.close();
}
