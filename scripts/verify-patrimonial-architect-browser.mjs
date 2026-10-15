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
  for (const width of [390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    const sent = [], errors = []; let fail = width === 1440;
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
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
    assert.equal(await page.locator('h1').count(), 1); assert.equal(await page.locator('section').count(), 15);
    assert.equal(await page.locator('[data-profile]').count(), 5); assert.equal(await page.locator('[data-scene]').count(), 3); assert.equal(await page.locator('[data-story]').count(), 3);
    assert.equal(await page.locator('#stickyBar').getAttribute('aria-hidden'), 'true');
    const floating = await page.locator('[class*=s027]').boundingBox(); assert(floating.x >= 0 && floating.x + floating.width <= width);
    await page.screenshot({ path: path.join(directory, `architect-${width}-hero.png`) });
    for (const [key, profile] of Object.entries(architectProfiles)) {
      await page.locator(`[data-profile=${key}]`).click();
      assert.equal(await page.locator(`[data-profile=${key}]`).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('[data-bind=sub]').innerText(), profile.sub); assert.equal(await page.locator('[data-bind=cta]').innerText(), profile.cta);
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
          && !['svg', 'path'].includes(child.tagName.toLowerCase());
      }).map(child => child.tagName + ':' + child.textContent.slice(0, 50)));
      assert.deepEqual(overflow, [], `Overflow width ${width}, section ${index}`);
      if ([0, 4, 5, 8, 11].includes(index)) await section.screenshot({ path: path.join(directory, `architect-${width}-section-${index}.png`) });
    }
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.waitForFunction(() => [...document.querySelectorAll('img')].every(image => image.complete && image.naturalWidth > 0));
    await page.getByRole('heading', { name: 'Forse ti è già successo.' }).evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForFunction(() => document.querySelector('#stickyBar').getAttribute('aria-hidden') === 'false');
    const sticky = await page.locator('#stickyBar a').boundingBox(); assert(sticky.x >= 0 && sticky.x + sticky.width <= width && sticky.y >= 0 && sticky.y + sticky.height <= 1000);
    await page.locator('#richiesta').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('#stickyBar').getAttribute('aria-hidden') === 'true');
    const form = page.locator('form[data-pilot-form=architect-path]');
    await form.getByRole('button', { name: 'Sì, riservo il mio posto' }).click(); assert.equal(sent.length, 0);
    await form.locator('[name=firstName]').fill('Ada'); await form.locator('[name=lastName]').fill('Lovelace');
    await form.locator('[name=email]').fill('architect-browser@example.invalid'); await form.locator('[name=phone]').fill('3331234567');
    await form.locator('[name=consent]').check(); await form.getByRole('button', { name: 'Sì, riservo il mio posto' }).click();
    await form.getByText('PASSO 2 DI 2', { exact: true }).waitFor(); assert.equal(sent.length, 0, 'Step 1 must not send');
    assert.equal(await page.locator(':focus').getAttribute('id'), 'architect-path-form-title');
    assert.equal(await form.locator('[name=profile]').inputValue(), 'Altro'); assert.equal(await form.locator('[name=marketingConsent]').isChecked(), false);
    await form.getByRole('button', { name: 'Sì, riservo il mio posto' }).click(); assert.equal(sent.length, 0, 'Province required');
    await form.locator('[name=province]').focus(); await page.keyboard.type('Milano'); await form.locator('[name=experience]').selectOption('Sì');
    await form.locator('[name=goal]').selectOption('Sto esplorando'); await form.locator('[name=availability]').selectOption('Part-time');
    await form.locator('[name=message]').fill('Solo verifica UI locale, nessun invio remoto.');
    await form.screenshot({ path: path.join(directory, `architect-${width}-step-2.png`) });
    await form.evaluate(element => { element.requestSubmit(); element.requestSubmit(); });
    if (fail) {
      await form.getByRole('alert').waitFor(); assert.equal(sent.length, 1); assert.equal(await form.locator('[name=province]').inputValue(), 'Milano');
      fail = false; await form.getByRole('button', { name: 'Sì, riservo il mio posto' }).click();
    }
    await page.waitForURL(`**${routePath}/grazie`); assert.equal(sent.length, width === 1440 ? 2 : 1);
    for (const payload of sent) {
      assert(validatePilotLead(payload), 'Existing API contract must accept UI payload');
      assert.equal(payload.profile, 'Altro'); assert.equal(payload.mode, 'architect-path'); assert.equal(payload.sourcePath, routePath);
      assert.equal(payload.consent, true); assert.equal(payload.marketingConsent, false); assert.equal(payload.website, '');
      assert.deepEqual(payload.utm, { utm_source: 'qa-local', utm_campaign: 'architect-redesign' });
    }
    assert.deepEqual(errors, []); await context.close();
    console.log(`PASS ${width}px: sections/crops/overflow, profiles, sticky, metadata, required fields, no step-1 POST, complete mapped payload, double-submit, ${width === 1440 ? 'error/retry, ' : ''}thank-you; all POSTs intercepted locally`);
  }
  const page = await browser.newPage();
  await page.route('**/*', route => new URL(route.request().url()).origin === base.origin && route.request().method() === 'GET' ? route.continue() : route.abort());
  await page.goto(`${base.origin}/benessere-patrimoniale/evento`, { waitUntil: 'networkidle' });
  const eventShell = page.locator('main#content').locator('..');
  assert.equal(await eventShell.locator(':scope > header').count(), 1); assert.equal(await eventShell.locator(':scope > footer').count(), 1);
  assert.equal(await page.locator('[data-profile]').count(), 0); assert.equal(await page.locator('[data-pilot-form=patrimonial-event]').count(), 1);
  await page.close(); console.log('PASS event retains shared header/footer and standard form. Zero CRM/Supabase calls; no live smoke.');
} finally { await browser.close(); }
