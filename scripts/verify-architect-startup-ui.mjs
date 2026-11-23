import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.ARCHITECT_PREVIEW_TEST_ORIGIN ?? 'http://127.0.0.1:3207';
const startupPath = '/candidature/architetti-patrimoniali/startup';
const token = 'A'.repeat(43);
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [390, 1366]) {
    const page = await browser.newPage({ viewport: { width, height: 860 }, reducedMotion: 'reduce' });
    // The provider does not expose video ended events; prevent real video requests in smoke tests.
    await page.route('https://drive.google.com/**', route =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Video test</title>' }));
    await page.goto(origin + startupPath + '#token=' + token, { waitUntil: 'domcontentloaded' });
    const button = page.getByRole('button', { name: 'Ho preso visione della Startup Horyzon. Voglio essere ricontattato' });
    const checkbox = page.getByRole('checkbox', { name: 'Ho terminato di vedere il video della Startup.' });
    await checkbox.waitFor({ state: 'visible', timeout: 15000 });
    assert.equal(await button.isDisabled(), true, 'CTA must start locked and grey');
    assert.equal(await button.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(221, 225, 226)');
    assert.equal(await page.getByRole('heading', { name: 'Ti riconosci in questo progetto?' }).isVisible(), true);
    assert.equal(await page.getByText('La scheda in Selezione Architetti viene creata solo se premi').count(), 0);
    await page.getByRole('button', { name: 'Vai al video Startup Horyzon' }).click();
    assert.equal(new URL(page.url()).hash, '#token=' + token, 'Header must not erase candidate token');
    await checkbox.check();
    await page.getByText('Ora puoi inviare la tua adesione.', { exact: false }).waitFor();
    assert.equal(await button.isEnabled(), true, 'Explicit watch attestation unlocks button');
    assert.equal(await button.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(216, 255, 66)', 'Ready button is lime');
    await page.getByRole('button', { name: /Rivedi la presentazione/ }).click();
    assert.equal(new URL(page.url()).hash, '#token=' + token, 'Footer must not erase candidate token');
    await checkbox.uncheck();
    assert.equal(await button.isDisabled(), true, 'Unchecked attestation relocks the CTA');
    console.log('PASS Startup visual + gate ' + width + 'px: grey / lime, header/footer scroll, token retained');
    await page.close();

    const anonymous = await browser.newPage({ viewport: { width, height: 860 }, reducedMotion: 'reduce' });
    await anonymous.route('https://drive.google.com/**', route =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Video test</title>' }));
    await anonymous.goto(origin + startupPath, { waitUntil: 'domcontentloaded' });
    const anonymousButton = anonymous.getByRole('button', { name: 'Ho preso visione della Startup Horyzon. Voglio essere ricontattato' });
    await anonymousButton.waitFor({ state: 'visible', timeout: 15000 });
    assert.equal(await anonymousButton.isDisabled(), true, 'A direct visit without candidate link cannot submit');
    assert.equal(await anonymous.getByRole('checkbox', { name: 'Ho terminato di vedere il video della Startup.' }).count(), 0);
    await anonymous.close();
  }
} finally {
  await browser.close();
}
