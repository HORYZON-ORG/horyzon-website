import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { architectProfiles } from '../src/content/patrimonial-architect-session.ts';
import { validatePilotLead } from '../src/lib/public-leads/patrimonial-funnels.ts';

// Explicit external browser runtime, no package installation, secret loading or
// service writes. POST /api/public-leads is always fulfilled before the server.
const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const base = new URL(arg('base') ?? 'http://127.0.0.1:3100');
assert(['127.0.0.1', 'localhost'].includes(base.hostname), 'Loopback only');
assert(arg('playwright-module') && arg('artifacts'), 'Explicit browser module and artifact directory required');
const directory = path.resolve(arg('artifacts')); assert(!directory.split(path.sep).includes('tmp'), 'Never use repo tmp');
await mkdir(directory, { recursive: true });
const { chromium } = await import(pathToFileURL(path.resolve(arg('playwright-module'))).href);
const browser = await chromium.launch({ headless: true, ...(arg('executable') ? { executablePath: arg('executable') } : {}) });
const routePath = '/benessere-patrimoniale/percorso-architetto-patrimoniale';
try {
  for (const width of [360, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    const sent = [], errors = []; let fail = width === 1440;
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      // The mandatory CV upload is answered locally too: no storage write.
      if (url.origin === base.origin && url.pathname === '/api/public-leads/cv') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, cvId: 'qa-local-cv' }) });
      if (url.origin === base.origin && url.pathname === '/api/public-leads') {
        assert.equal(request.method(), 'POST'); sent.push(request.postDataJSON());
        await new Promise(resolve => setTimeout(resolve, 150));
        return route.fulfill({ status: fail ? 503 : 200, contentType: 'application/json', body: JSON.stringify(fail ? { ok: false, message: 'Errore di test locale. Riprova.' } : { ok: true, message: 'Richiesta ricevuta.' }) });
      }
      if (url.origin === base.origin && request.method() === 'GET') return route.continue();
      return route.abort();
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(`${base.origin}${routePath}?utm_source=qa-local&utm_campaign=architect-redesign`, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200); assert.equal(response.headers()['x-robots-tag'], 'noindex, nofollow');
    assert.equal(await page.locator('meta[name=robots]').getAttribute('content'), 'noindex, nofollow');
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('h1').count(), 1); assert.equal(await page.locator('section').count(), 11);
    assert.equal(await page.locator('[data-profile]').count(), 5); assert.equal(await page.locator('#richiesta [data-profile]').count(), 5);
    assert.equal(await page.getByText('Anteprima tema').count(), 0); assert.equal(await page.getByRole('button', { name: /Passa al tema/ }).count(), 1); assert.equal(await page.locator('[data-scene]').count(), 3); assert.equal(await page.locator('[data-story]').count(), 4);
    assert.equal(await page.locator('#stickyBar').getAttribute('aria-hidden'), 'true');
    await page.screenshot({ path: path.join(directory, `architect-mobile-${width}-hero.png`) });
    for (const [key, profile] of Object.entries(architectProfiles)) {
      await page.locator(`[data-profile=${key}]`).click();
      assert.equal(await page.locator(`[data-profile=${key}]`).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('[data-bind=sub]').innerText(), profile.sub);
      assert.equal((await page.locator('form[data-pilot-form=architect-path] button[type=submit]').innerText()).trim(), `${profile.cta} →`);
      assert.match(await page.locator(`[data-scene=${profile.scene}]`).getAttribute('class'), /is-mine/);
      assert.match(await page.locator(`[data-story="${profile.story}"]`).getAttribute('class'), /is-mine/);
      assert.equal(await page.locator('[data-scene] [class*=badge]:visible').count(), 1);
      assert.match(await page.locator('#profileNote').innerText(), new RegExp(profile.label));
    }
    for (const [index, section] of (await page.locator('section').all()).entries()) {
      await section.scrollIntoViewIfNeeded();
      const overflow = await section.evaluate(element => [...element.querySelectorAll('*')].filter(child => {
        const r = child.getBoundingClientRect(), style = getComputedStyle(child);
        return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1) && !['absolute', 'fixed'].includes(style.position)
          && !['svg', 'path'].includes(child.tagName.toLowerCase()) && !child.closest('[data-carousel]');
      }).map(child => child.tagName + ':' + child.textContent.slice(0, 50)));
      assert.deepEqual(overflow, [], `Overflow width ${width}, section ${index}`);
      if ([0, 4, 5, 8, 9].includes(index)) await section.screenshot({ path: path.join(directory, `architect-mobile-${width}-section-${index}.png`) });
    }
    for (const name of ['scenes', 'stories']) {
      const carousel = page.locator(`[data-carousel=${name}]`);
      const geometry = await carousel.evaluate(element => ({ display: getComputedStyle(element).display, snap: getComputedStyle(element).scrollSnapType, scroll: element.scrollWidth > element.clientWidth, x: element.getBoundingClientRect().x, right: element.getBoundingClientRect().right }));
      // Le testimonianze sono un carosello a ogni larghezza; le scene diventano carosello solo su mobile.
      assert.equal(geometry.display, width <= 700 || name === 'stories' ? 'flex' : 'grid'); assert.equal(geometry.scroll, width <= 700 || name === 'stories');
      assert(geometry.x >= -1 && geometry.right <= width + 1);
      if (width <= 700) {
        assert.equal(geometry.snap, 'x mandatory');
        await carousel.focus(); await page.keyboard.press('ArrowRight');
        await page.waitForFunction(name => document.querySelector(`[data-carousel=${name}]`).scrollLeft > 0, name);
        await carousel.evaluate(element => element.scrollTo({ left: 0, behavior: 'instant' }));
      }
    }
    assert.equal(await page.locator('[class*=m-only]:visible').count(), width <= 700 ? 2 : 0);
    assert.equal(await page.locator('[class*=m-col]').evaluate(element => getComputedStyle(element).flexDirection), width <= 700 ? 'column' : 'row');
    const flow = await page.locator('[class*=m-vline]').first().boundingBox(); assert(width <= 700 ? flow.height === 44 && flow.width === 2 : flow.width > flow.height);
    assert.equal(await page.locator('[class*=m-vline]').first().evaluate(element => getComputedStyle(element).animationName), 'none', 'Reduced motion disables flow animation');
    const timeline = await page.locator('[class*=m-track]').boundingBox(); assert(width <= 700 ? timeline.height > timeline.width : timeline.width > timeline.height);
    assert.equal(await page.locator('[class*=formGrid]').first().evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length), width <= 700 ? 1 : 2);
    if (width <= 700) {
      const stickyStyle = await page.locator('[class*=m-sticky]').evaluate(element => ({ wrap: getComputedStyle(element).flexWrap, radius: getComputedStyle(element).borderRadius }));
      assert.deepEqual(stickyStyle, { wrap: 'nowrap', radius: '999px' });
      assert.equal(await page.locator('#stickyBar a').evaluate(element => getComputedStyle(element).borderRadius), '999px');
    }
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.waitForFunction(() => [...document.querySelectorAll('img')].every(image => image.complete && image.naturalWidth > 0));
    await page.getByRole('heading', { name: 'Dal lavoro che fai alla professione che ti somiglia.' }).evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForFunction(() => document.querySelector('#stickyBar').getAttribute('aria-hidden') === 'false');
    const sticky = await page.locator('#stickyBar a').boundingBox(); assert(sticky.x >= 0 && sticky.x + sticky.width <= width && sticky.y >= 0 && sticky.y + sticky.height <= 1000);
    await page.locator('#richiesta').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('#stickyBar').getAttribute('aria-hidden') === 'true');
    const form = page.locator('form[data-pilot-form=architect-path]');
    await form.locator('button[type=submit]').click(); assert.equal(sent.length, 0);
    await form.locator('[name=firstName]').fill('Ada'); await form.locator('[name=lastName]').fill('Lovelace');
    await form.locator('[name=email]').fill('architect-browser@example.invalid'); await form.locator('[name=phone]').fill('3331234567');
    await form.locator('[name=consent]').check(); await form.locator('button[type=submit]').click();
    await form.getByText('PASSO 2 DI 2', { exact: true }).waitFor(); assert.equal(sent.length, 0, 'Step 1 must not send');
    assert.equal((await form.locator('button[type=submit]').innerText()).trim(), 'Invia la mia candidatura →');
    assert.equal(await page.locator(':focus').getAttribute('id'), 'architect-path-form-title');
    assert.equal(await form.locator('[name=profile]').inputValue(), 'Altro'); assert.equal(await form.locator('[name=marketingConsent]').isChecked(), false);
    await form.locator('button[type=submit]').click(); assert.equal(sent.length, 0, 'Province required');
    await form.locator('[name=province]').focus(); await page.keyboard.type('Milano'); await form.locator('[name=experience]').selectOption('Sì');
    await form.locator('[name=goal]').selectOption('Sto esplorando'); await form.locator('[name=availability]').selectOption('Part-time');
    await form.locator('[name=message]').fill('Solo verifica UI locale, nessun invio remoto.');
    await form.locator('[name=cv]').setInputFiles({ name: 'cv.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%qa\n') });
    await form.screenshot({ path: path.join(directory, `architect-mobile-${width}-step-2.png`) });
    await form.evaluate(element => { element.requestSubmit(); element.requestSubmit(); });
    if (fail) {
      await form.getByRole('alert').waitFor(); assert.equal(sent.length, 1); assert.equal(await form.locator('[name=province]').inputValue(), 'Milano');
      fail = false; await form.locator('button[type=submit]').click();
    }
    await page.waitForURL(`**${routePath}/grazie`); assert.equal(sent.length, width === 1440 ? 2 : 1);
    for (const payload of sent) {
      const { cvId, ...lead } = payload; assert.equal(cvId, 'qa-local-cv');
      assert(validatePilotLead(lead), 'Existing API contract must accept UI payload');
      assert.equal(lead.profile, 'Altro'); assert.equal(payload.mode, 'architect-path'); assert.equal(payload.sourcePath, routePath);
      assert.equal(payload.consent, true); assert.equal(payload.marketingConsent, false); assert.equal(payload.website, '');
      assert.deepEqual(payload.utm, { utm_source: 'qa-local', utm_campaign: 'architect-redesign' });
    }
    assert.deepEqual(errors, []); await context.close();
    console.log(`PASS ${width}px: evergreen candidature mobile flow, carousels/snap/keyboard, role/roadmap/form/ticket, sections/crops/overflow, profiles, sticky, metadata, required fields, no step-1 POST, UTM payload, double-submit, ${width === 1440 ? 'error/retry, ' : ''}thank-you; all POSTs intercepted locally`);
  }
  const page = await browser.newPage();
  await page.route('**/*', route => new URL(route.request().url()).origin === base.origin && route.request().method() === 'GET' ? route.continue() : route.abort());
  await page.goto(`${base.origin}/benessere-patrimoniale/evento`, { waitUntil: 'networkidle' });
  const eventShell = page.locator('main#content').locator('..');
  assert.equal(await eventShell.locator(':scope > header').count(), 0); assert.equal(await eventShell.locator(':scope > footer').count(), 0);
  assert.equal(await page.locator('[data-event-section=hero]').count(), 1); assert.equal(await page.locator('[data-event-section=footer]').count(), 1);
  assert.equal(await page.locator('[data-profile]').count(), 0); assert.equal(await page.locator('[data-pilot-form=patrimonial-event]').count(), 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${base.origin}${routePath}`, { waitUntil: 'networkidle' });
  await page.locator('[data-profile=dipendente]').click();
  for (const name of ['scenes', 'stories']) {
    await page.locator(`[data-carousel=${name}]`).scrollIntoViewIfNeeded();
    await page.waitForFunction(name => [...document.querySelectorAll(`[data-carousel=${name}] > figure`)].every(element => Number(getComputedStyle(element).opacity) === 1), name);
    await page.locator(`[data-carousel=${name}]`).screenshot({ path: path.join(directory, `architect-mobile-390-motion-${name}.png`) });
  }
  for (const [name, selector] of [['hero', 'section:first-of-type'], ['role', '[class*=m-col]'], ['form', '[data-pilot-form=architect-path]']]) {
    await page.locator(selector).screenshot({ path: path.join(directory, `architect-mobile-390-reference-${name}.png`) });
  }
  await page.close(); console.log('PASS event shell regression; normal-motion carousel cards visible; reference screenshots captured. Zero CRM/Supabase calls; no live smoke.');
} finally { await browser.close(); }
