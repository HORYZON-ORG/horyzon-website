import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const testUrl = new URL(process.env.ARCHITECT_PREVIEW_TEST_ORIGIN ?? 'http://127.0.0.1:3207');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(testUrl.hostname), 'Use a local test server only');
const origin = testUrl.origin;
const landingPath = '/candidature/architetti-patrimoniali';
const introPath = `${landingPath}/indeed`;
const startupPath = `${landingPath}/startup`;
const startupSearch = '?canale=indeed';
const callbackPath = '/api/architect-startup/indeed-callback';
const callbackTitle = 'Ho completato la visione e chiedo di essere ricontattato';
const sessionToken = 'fixture-session';
const videoHost = 'zbpegzd1dv3ut14o.public.blob.vercel-storage.com';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});

try {
  for (const width of [390, 1366]) {
    const page = await browser.newPage({ viewport: { width, height: 850 }, reducedMotion: 'reduce' });
    const documents = [];
    const legacyApiRequests = [];
    const callbackRequests = [];

    page.on('response', response => {
      if (response.request().resourceType() === 'document') {
        documents.push({
          url: new URL(response.url()),
          status: response.status(),
          csp: response.headers()['content-security-policy'] ?? '',
        });
      }
    });
    page.on('request', request => {
      const { pathname } = new URL(request.url());
      if (pathname.startsWith('/api/architect-startup/') && pathname !== callbackPath) legacyApiRequests.push(pathname);
    });
    // Isolate the browser from production. The new pilot API is simulated;
    // any legacy application, progress or confirmation call remains blocked.
    await page.route(url => url.origin !== origin || url.pathname.startsWith('/api/'), route => route.abort());
    let confirmationAttempts = 0;
    await page.route(origin + callbackPath, route => {
      assert.equal(route.request().method(), 'POST');
      const body = route.request().postDataJSON();
      callbackRequests.push(body);
      if (body.action === 'start') {
        return route.fulfill({ status: 200, json: { ok: true, token: sessionToken } });
      }
      assert.equal(body.action, 'confirm');
      confirmationAttempts += 1;
      if (width === 390 && confirmationAttempts === 1) {
        return route.fulfill({ status: 503, json: { ok: false, message: 'Invio temporaneamente non disponibile.' } });
      }
      return route.fulfill({ status: 200, json: { ok: true } });
    });
    // The play control still drives the UI and starts the session, but no
    // production media is fetched or played by the browser in this test.
    await page.addInitScript(() => {
      Object.defineProperty(HTMLMediaElement.prototype, 'play', {
        configurable: true,
        value() {
          this.dispatchEvent(new Event('play'));
          return Promise.resolve();
        },
      });
    });

    await page.goto(origin + introPath, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Conosci il progetto HORYZON' }).waitFor();
    const intro = documents.find(entry => entry.url.pathname === introPath);
    assert.equal(intro?.status, 200);
    assert.match(await page.locator('video').getAttribute('src') ?? '', /\/frank-architetto-patrimoniale\.mp4$/);
    assert.equal(await page.locator('form, input[type="file"], a[href*="#richiesta"]').count(), 0,
      'The Indeed video page must never ask for a second application or CV');
    assert.equal(await page.locator('a[href*="messages.indeed.com"]').count(), 0);

    const openStartup = page.getByRole('link', { name: 'Guarda il video della Startup' });
    assert.equal(await openStartup.getAttribute('href'), startupPath + startupSearch);
    await openStartup.click();
    await page.waitForURL(url => url.pathname === startupPath && url.search === startupSearch && !url.hash);
    const startup = documents.find(entry => entry.url.pathname === startupPath);
    assert.equal(startup?.status, 200, 'Use a new HTTP document rather than a client transition');
    assert.ok(startup.csp.includes(videoHost), 'The new document must authorize the Startup media through its CSP');
    const longVideo = page.locator('video');
    await longVideo.waitFor({ state: 'visible' });
    assert.ok((await longVideo.getAttribute('src'))?.includes(videoHost));
    assert.equal(await page.locator('form, input[type="file"], a[href*="#richiesta"]').count(), 0);

    // Verify hydration before injecting a fixture playback event; no real media
    // is downloaded or played in the test and no Indeed message is ever sent.
    const speed = page.getByRole('button', { name: 'Riproduzione a 1,25 volte' });
    await speed.click();
    await page.getByRole('button', { name: 'Riproduzione a 1,25 volte', pressed: true }).waitFor();
    const callbackForm = page.getByRole('form', { name: 'Conferma la visione della Startup' });
    assert.deepEqual(callbackRequests, [], 'Opening the page must not create or confirm a session');
    assert.equal(await callbackForm.count(), 0, 'Do not show the callback form before completing the video');
    const sessionStarted = page.waitForResponse(response => response.url() === origin + callbackPath && response.ok());
    await page.getByRole('button', { name: 'Riproduci la presentazione Startup Horyzon' }).click();
    await sessionStarted;
    assert.deepEqual(callbackRequests, [{ action: 'start' }], 'Playback starts only a session with no personal data');
    await longVideo.evaluate(element => {
      Object.defineProperty(element, 'currentTime', { configurable: true, get: () => 512 });
      element.dispatchEvent(new Event('timeupdate'));
    });
    await page.getByRole('progressbar', { name: 'Avanzamento della presentazione' }).and(
      page.locator('[aria-valuenow="512"]'),
    ).waitFor();
    assert.equal(await callbackForm.count(), 0, 'Partial playback must not show the callback form');
    await longVideo.evaluate(element => {
      Object.defineProperty(element, 'currentTime', { configurable: true, get: () => 660.73 });
      element.dispatchEvent(new Event('ended'));
    });
    await callbackForm.waitFor({ state: 'visible' });
    const name = callbackForm.getByLabel('Nome e cognome');
    const email = callbackForm.getByLabel('Email di contatto');
    assert.equal(await callbackForm.locator('input').count(), 2, 'Collect only name and email');
    assert.equal(await page.locator('input[type="file"], a[href*="#richiesta"], a[href*="messages.indeed.com"]').count(), 0);
    await name.fill('  Candidato Test  ');
    await email.fill('qa-candidato@example.invalid');
    assert.deepEqual(callbackRequests, [{ action: 'start' }], 'Neither completion nor field entry may request contact');

    const confirm = callbackForm.getByRole('button', { name: callbackTitle });
    const expectedConfirm = {
      action: 'confirm', token: sessionToken, fullName: 'Candidato Test',
      email: 'qa-candidato@example.invalid', contactRequested: true,
    };
    await confirm.click();
    if (width === 390) {
      await callbackForm.getByRole('alert').filter({ hasText: 'Invio temporaneamente non disponibile.' }).waitFor({ state: 'visible' });
      assert.equal(await name.inputValue(), '  Candidato Test  ');
      assert.equal(await email.inputValue(), 'qa-candidato@example.invalid');
      assert.deepEqual(callbackRequests, [{ action: 'start' }, expectedConfirm]);
      await confirm.click();
    }
    await page.getByText('Conferma inviata', { exact: true }).waitFor({ state: 'visible' });
    assert.deepEqual(callbackRequests, width === 390
      ? [{ action: 'start' }, expectedConfirm, expectedConfirm]
      : [{ action: 'start' }, expectedConfirm]);
    assert.deepEqual(legacyApiRequests, [], 'Indeed mode must not call any legacy candidate API');
    assert.equal(await page.locator('a[href*="messages.indeed.com"]').count(), 0, 'Stay on the Horyzon site');
    assert.equal(new URL(page.url()).pathname, startupPath);
    console.log(`PASS ${width}px: Indeed intro -> Startup -> explicit callback, no duplicate application or CV`);
    await page.close();
  }
} finally {
  await browser.close();
}
