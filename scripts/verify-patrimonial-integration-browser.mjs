import assert from 'node:assert/strict';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validatePilotLead } from '../src/lib/public-leads/patrimonial-funnels.ts';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const base = new URL(arg('base') ?? 'http://127.0.0.1:3310');
assert(['127.0.0.1', 'localhost'].includes(base.hostname), 'Loopback only');
assert(arg('playwright-module') && arg('artifacts'), 'Explicit local browser runtime and artifacts required');
const directory = path.resolve(arg('artifacts'));
await mkdir(directory, { recursive: true });
const { chromium } = await import(pathToFileURL(path.resolve(arg('playwright-module'))).href);
const browser = await chromium.launch({ headless: true, ...(arg('executable') ? { executablePath: arg('executable') } : {}) });
let intercepted = 0;
try {
  const photos = (await readdir('public/benessere-patrimoniale', { recursive: true })).filter(file => file.endsWith('.jpg'));
  assert.equal(photos.length, 35);
  const inventory = await browser.newContext();
  for (const file of photos) assert.equal((await inventory.request.get(`${base.origin}/benessere-patrimoniale/${file.replaceAll('\\', '/')}`)).status(), 200, file);
  await inventory.close();
  for (const width of [320, 390, 768, 1440]) for (const theme of ['dark', 'light']) for (const [slug, mode, font] of [
    ['evento', 'patrimonial-event', 'Manrope'],
    ['percorso-architetto-patrimoniale', 'architect-path', 'Space Grotesk'],
  ]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    const sent = [], errors = [];
    let fail = width === 1440 && theme === 'dark';
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base.origin) return route.abort();
      if (url.pathname === '/api/public-leads') {
        assert.equal(request.method(), 'POST');
        sent.push(request.postDataJSON()); intercepted++;
        await new Promise(resolve => setTimeout(resolve, 100));
        return route.fulfill({ status: fail ? 503 : 200, contentType: 'application/json', body: JSON.stringify({ ok: !fail, message: 'Local intercepted test' }) });
      }
      return request.method() === 'GET' ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const root = `/benessere-patrimoniale/${slug}`;
    const response = await page.goto(`${base.origin}${root}?tema=${theme === 'light' ? 'chiaro' : 'scuro'}&utm_source=integration-test`, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    assert.equal(response.headers()['x-robots-tag'], 'noindex, nofollow');
    await page.waitForFunction(expected => document.querySelector('[data-theme]')?.getAttribute('data-theme') === expected, theme);
    assert.equal(await page.locator('h1').count(), 1);
    await page.evaluate(() => document.fonts.ready);
    assert((await page.locator('h1').evaluate(el => getComputedStyle(el).fontFamily)).includes(font));
    const title = await page.locator('h1').innerText();
    if (mode === 'patrimonial-event' && theme === 'light' && width <= 820) {
      const header = page.locator('[data-event-section="hero"] > div').first();
      assert.equal(await header.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(247, 244, 232)', 'Light mobile header stays legible over the dark photo');
      assert(await header.getByRole('link', { name: 'Riserva il posto', exact: true }).isVisible());
    }
    const controls = page.getByRole('group', { name: 'Anteprima tema della pagina' });
    const keyboardToggle = controls.getByRole('button', { name: theme === 'dark' ? 'Chiaro' : 'Scuro', exact: true });
    await keyboardToggle.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(previous => document.querySelector('[data-theme]').getAttribute('data-theme') !== previous, theme);
    await controls.getByRole('button', { name: theme === 'dark' ? 'Scuro' : 'Chiaro', exact: true }).click();
    await controls.getByRole('button', { name: theme === 'dark' ? 'Chiaro' : 'Scuro', exact: true }).click();
    await page.waitForFunction(previous => document.querySelector('[data-theme]').getAttribute('data-theme') !== previous, theme);
    assert.equal(await page.locator('h1').innerText(), title, 'Theme must not change content');
    await controls.getByRole('button', { name: theme === 'dark' ? 'Scuro' : 'Chiaro', exact: true }).click();
    const selector = mode === 'patrimonial-event' ? '[data-event-section]' : 'section';
    assert.equal(await page.locator(selector).count(), mode === 'patrimonial-event' ? 17 : 15);
    for (const section of await page.locator(selector).all()) await section.scrollIntoViewIfNeeded();
    // Long tablet sections can leave lazy images outside the browser's load
    // threshold even after section scrolling. Exercise every image URL as well.
    await page.locator('img').evaluateAll(images => images.forEach(image => { image.loading = 'eager'; }));
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
    const geometry = await page.evaluate(() => ({
      viewport: innerWidth, page: document.documentElement.scrollWidth,
      offenders: [...document.querySelectorAll('body *')].filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.right > innerWidth + 1 && !element.closest('[data-carousel]');
      }).slice(0, 20).map(element => ({ tag: element.tagName, className: String(element.className), width: element.getBoundingClientRect().width, right: element.getBoundingClientRect().right })),
    }));
    if (geometry.page > width + 1) {
      await writeFile(path.join(directory, `${slug}-${theme}-${width}-overflow.json`), JSON.stringify(geometry, null, 2));
      await page.screenshot({ path: path.join(directory, `${slug}-${theme}-${width}-overflow.png`), fullPage: true });
    }
    assert(geometry.page <= width + 1, `Page overflow: ${slug}/${theme}/${width}, page=${geometry.page}px`);
    if (mode === 'patrimonial-event') {
      const stats = page.locator('[data-event-section="speaker"]').getByText('Centinaia', { exact: true });
      assert(await stats.evaluate(el => {
        const range = document.createRange(); range.selectNodeContents(el);
        return range.getBoundingClientRect().right <= el.getBoundingClientRect().right + 1;
      }), 'Speaker statistic text fits its column');
    }
    const scrollers = page.locator('div');
    const scrollChecks = await scrollers.evaluateAll(elements => elements.filter(el => getComputedStyle(el).overflowX === 'auto' && el.scrollWidth > el.clientWidth + 5).map(el => {
      el.scrollTo({ left: el.scrollWidth, behavior: 'instant' });
      const moved = el.scrollLeft > 0;
      el.scrollTo({ left: 0, behavior: 'instant' }); return moved;
    }));
    if (width < 768) assert(scrollChecks.length > 0 && scrollChecks.every(Boolean), 'Intentional mobile scrollers remain operable');
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(directory, `${slug}-${theme}-${width}.png`) });
    const form = page.locator(`form[data-pilot-form="${mode}"]`);
    const submit = form.locator('button[type=submit]');
    await form.locator('[name=firstName]').focus();
    assert.equal(await form.locator('[name=firstName]').evaluate(el => document.activeElement === el), true);
    await page.keyboard.press('Tab');
    assert(await form.evaluate(el => el.contains(document.activeElement)), 'Tab stays in logical form controls');
    await submit.click(); assert.equal(sent.length, 0, 'Invalid first step must not submit');
    for (const [name, value] of [['firstName', 'Ada'], ['lastName', 'Integration'], ['email', 'integration@example.invalid'], ['phone', '3331234567']]) {
      if (await form.locator(`[name=${name}]`).isVisible()) await form.locator(`[name=${name}]`).fill(value);
    }
    await form.locator('[name=consent]').check();
    await submit.click();
    await form.locator('[name=province]').waitFor({ state: 'visible' });
    assert.equal(sent.length, 0, 'First step advances locally');
    await submit.click(); assert.equal(sent.length, 0, 'Second-step required fields must remain enforced');
    if (!(await form.locator('[name=lastName]').inputValue())) await form.locator('[name=lastName]').fill('Integration');
    await form.locator('[name=province]').fill('Milano');
    await form.evaluate(element => { element.requestSubmit(); element.requestSubmit(); });
    if (fail) {
      await form.getByRole('alert').waitFor();
      assert.equal(sent.length, 1, 'Double submit stays deduplicated');
      assert.equal(await form.locator('[name=province]').inputValue(), 'Milano', 'Error retains data');
      fail = false; await submit.click();
    }
    await page.waitForURL(`**${root}/grazie`);
    assert.equal(sent.length, width === 1440 && theme === 'dark' ? 2 : 1);
    for (const payload of sent) {
      assert(validatePilotLead(payload));
      assert.equal(payload.mode, mode); assert.equal(payload.sourcePath, root);
      assert.equal(payload.consent, true); assert.equal(payload.marketingConsent, false);
      assert.deepEqual(payload.utm, { utm_source: 'integration-test' });
    }
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS ${slug}/${theme}/${width}: fonts, theme, sections, loaded images, no overflow, required fields, local micro-step, intercepted submit/retry and thank-you`);
  }
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base.origin || request.method() !== 'GET') return route.abort();
      if (url.pathname.startsWith('/api/radar/')) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ ok: false }) });
      return route.continue();
    });
    const page = await context.newPage();
    assert.equal((await page.goto(`${base.origin}/radar`, { waitUntil: 'networkidle' })).status(), 200);
    assert.equal(await page.locator('#radar-prodotto form').count(), 1);
    assert((await page.locator('h1').evaluate(el => getComputedStyle(el).fontFamily)).includes('Manrope'));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: path.join(directory, `radar-${width}.png`) });
    await page.locator('[data-cta-position="header"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForURL('**#radar-prodotto');
    const firstField = page.locator('#radar-prodotto form input').first();
    await firstField.focus();
    assert(await firstField.evaluate(el => document.activeElement === el), 'Radar qualification is keyboard reachable');
    await context.close();
    console.log(`PASS Radar/${width}: landing, qualification and fonts without creating a session`);
  }
  for (const slug of ['evento', 'percorso-architetto-patrimoniale']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 1000 }, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' });
    await context.route('**/*', route => new URL(route.request().url()).origin === base.origin && route.request().method() === 'GET' ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(`${base.origin}/benessere-patrimoniale/${slug}`, { waitUntil: 'networkidle' });
    const carousel = page.locator('[data-carousel]').first();
    await carousel.scrollIntoViewIfNeeded();
    await carousel.focus(); await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('[data-carousel]').scrollLeft > 0);
    await carousel.evaluate(el => el.scrollTo({ left: 0, behavior: 'instant' }));
    const box = await carousel.boundingBox();
    const cdp = await context.newCDPSession(page);
    const y = Math.min(box.y + box.height / 2, 800);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y }] });
    for (const x of [260, 220, 180, 140, 100]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForFunction(() => document.querySelector('[data-carousel]').scrollLeft > 0);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await carousel.screenshot({ path: path.join(directory, `${slug}-390-motion-touch.png`) });
    await context.close();
    console.log(`PASS ${slug}/390: normal-motion carousel, keyboard arrows and Chromium touch swipe without writes`);
  }
  console.log(`PASS browser inventory: 35/35 original photos HTTP 200; ${intercepted} submissions fulfilled in browser, zero real provider writes.`);
} finally { await browser.close(); }
