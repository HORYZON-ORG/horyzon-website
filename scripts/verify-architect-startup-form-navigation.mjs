import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.ARCHITECT_PREVIEW_TEST_ORIGIN ?? 'http://127.0.0.1:3207';
const targetPath = '/candidature/architetti-patrimoniali/startup';
const token = 'C'.repeat(43);
const videoHost = 'zbpegzd1dv3ut14o.public.blob.vercel-storage.com';
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});

try {
  for (const width of [390, 1366]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    const documents = [];

    page.on('response', response => {
      if (response.request().resourceType() === 'document') documents.push({
        pathname: new URL(response.url()).pathname,
        status: response.status(),
        csp: response.headers()['content-security-policy'] ?? '',
      });
    });
    // No external media download needed: this test asserts the HTTP document
    // transition that supplies the correct route-scoped CSP to the browser.
    await page.route(`https://${videoHost}/**`, route => route.abort());
    let submittedUtm = null;
    await page.route('**/api/architect-startup/start', route => {
      submittedUtm = route.request().postDataJSON().utm;
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          nextStep: { href: `${targetPath}#token=${token}` },
        }),
      });
    });
    await page.route('**/api/architect-startup/video-gate', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, remainingSeconds: 661 }),
      }));

    await page.goto(origin + '/candidature/architetti-patrimoniali?utm_source=indeed&utm_medium=job_board&utm_campaign=bari',
      { waitUntil: 'domcontentloaded' });
    const landing = documents.find(entry => entry.pathname === '/candidature/architetti-patrimoniali');
    assert.ok(landing, 'Landing document loaded');
    assert.ok(!landing.csp.includes(videoHost), 'Landing deliberately has narrower media CSP');

    const form = page.locator('form[data-pilot-form="architect-path"]');
    await form.locator('input[name="firstName"]').fill('Test');
    await form.locator('input[name="lastName"]').fill('Navigazione');
    await form.locator('input[name="email"]').fill('navigation-test@example.invalid');
    await form.locator('input[name="phone"]').fill('+393331234567');
    await form.locator('input[name="consent"]').check();
    await form.getByRole('button', { name: /Confermo i recapiti e accedo alla startup/ }).click();

    await page.waitForURL(url =>
      url.pathname === targetPath && url.hash === '#token=' + token,
      { timeout: 15000 });
    await page.locator('video').waitFor({ state: 'visible', timeout: 15000 });
    const startup = documents.find(entry => entry.pathname === targetPath);
    assert.ok(startup, 'Startup must load as a NEW HTTP document, not an RSC client transition');
    assert.equal(startup.status, 200);
    assert.ok(startup.csp.includes(videoHost),
      'Full document navigation must apply Startup CSP authorizing Blob media');
    assert.ok((await page.locator('video').getAttribute('src'))?.includes(videoHost));
    assert.deepEqual(submittedUtm, { utm_source: 'indeed', utm_medium: 'job_board', utm_campaign: 'bari' });
    assert.equal(await page.getByRole('button', {
      name: 'Ho completato la visione del video',
    }).isDisabled(), true, '661s gate remains locked');
    console.log('PASS ' + width + 'px: form -> full Startup document, scoped Blob CSP, token and gate preserved');
    await page.close();
  }
} finally {
  await browser.close();
}
