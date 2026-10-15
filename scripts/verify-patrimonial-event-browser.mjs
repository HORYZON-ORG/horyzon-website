import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { eventScenes, eventProfiles, eventFormTitle, eventCalculator } from '../src/content/patrimonial-event-content.ts';
import { validatePilotLead } from '../src/lib/public-leads/patrimonial-funnels.ts';

// Loopback-only verification: every POST is fulfilled before the local server.
const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const base = new URL(arg('base') ?? 'http://127.0.0.1:3100');
assert(['localhost', '127.0.0.1'].includes(base.hostname));
assert(arg('playwright-module') && arg('artifacts'));
const directory = path.resolve(arg('artifacts')); assert(!directory.split(path.sep).includes('tmp'));
await mkdir(directory, { recursive: true });
const { chromium } = await import(pathToFileURL(path.resolve(arg('playwright-module'))).href);
const browser = await chromium.launch({ headless: true, ...(arg('executable') ? { executablePath: arg('executable') } : {}) });
const routePath = '/benessere-patrimoniale/evento';
try {
  for (const width of [360, 390, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    const sent = [], errors = []; let fail = width === 1440;
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin === base.origin && url.pathname === '/api/public-leads') {
        assert.equal(request.method(), 'POST'); sent.push(request.postDataJSON());
        await new Promise(resolve => setTimeout(resolve, 150));
        return route.fulfill({ status: fail ? 503 : 200, contentType: 'application/json', body: JSON.stringify(fail ? { ok: false, message: 'Errore di test locale. Riprova.' } : { ok: true }) });
      }
      if (url.origin === base.origin && request.method() === 'GET') return route.continue();
      return route.abort();
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(`${base.origin}${routePath}?utm_source=qa-local&utm_campaign=event-redesign`, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200); assert.equal(response.headers()['x-robots-tag'], 'noindex, nofollow');
    assert.equal(await page.locator('meta[name=robots]').getAttribute('content'), 'noindex, nofollow');
    await page.evaluate(() => document.fonts.ready);
    assert.match(await page.locator('h1').evaluate(element => getComputedStyle(element).fontFamily), /Manrope/);
    assert.match(await page.locator('[data-session-status]').evaluate(element => getComputedStyle(element).fontFamily), /Manrope/);
    assert.equal(await page.locator('h1').count(), 1); assert.equal(await page.locator('footer').count(), 1);
    assert.equal(await page.locator('[data-event-section]').count(), 18);
    assert.equal(await page.locator('[data-session-status]').getAttribute('data-session-status'), 'PLACEHOLDER');
    assert.equal(await page.locator('[data-demo=false]').count(), 0);
    const second = await page.locator('[data-bind="cd.s"]').innerText();
    await page.waitForFunction(previous => document.querySelector('[data-bind="cd.s"]').textContent !== previous, second);
    assert.equal(await page.locator('[data-event-section=request] [data-bind="cd.d"]').innerText(), await page.locator('[data-event-section=hero] [data-bind="cd.d"]').innerText());
    assert.equal(await page.locator('[data-event-section=sticky] [data-bind="cd.d"]').innerText(), await page.locator('[data-event-section=hero] [data-bind="cd.d"]').innerText());

    assert.match(await page.locator('[class*=s017]').evaluate(element => getComputedStyle(element).fontFamily), /JetBrains Mono/);
    assert.equal(await page.locator('h1').evaluate(element => getComputedStyle(element).fontWeight), '800');
    assert.equal(await page.locator('[data-carousel]').count(), 4);
    for (const carousel of await page.locator('[data-carousel]').all()) {
      const state = await carousel.evaluate(element => {
        const css = getComputedStyle(element), r = element.getBoundingClientRect(), card = element.firstElementChild.getBoundingClientRect();
        return { display:css.display, snap:css.scrollSnapType, overflow:css.overflowX, width:r.width, cardWidth:card.width, left:r.left, right:r.right, count:element.children.length };
      });
      assert(state.left >= -1 && state.right <= width + 1);
      if (width <= 820) {
        assert.equal(state.display, 'flex'); assert.equal(state.overflow, 'auto'); assert.equal(state.snap, 'x mandatory');
        assert(Math.abs(state.cardWidth - (state.width - 48) * .84) < 2);
        await carousel.focus(); await page.keyboard.press('ArrowRight');
        await page.waitForFunction(label => document.querySelector(`[data-carousel="${label}"]`).scrollLeft > 0, await carousel.getAttribute('data-carousel'));
        await carousel.evaluate(element => { element.scrollLeft = 0; });
      } else assert.equal(state.display, 'grid');
    }
    for (const hint of await page.locator('[class*=swipe-hint]').all()) assert.equal(await hint.isVisible(), width <= 820);
    assert.equal(await page.locator('[class*=swipe-hint]').count(), 4);
    const timeline = await page.locator('[class*=tl-grid]').evaluate(element => ({ columns:getComputedStyle(element).gridTemplateColumns.split(' ').filter(value => parseFloat(value) > 0).length, line:getComputedStyle(element,'::before').content }));
    assert.equal(timeline.columns, width <= 820 ? 1 : 5);
    assert.equal(timeline.line, width <= 820 ? '""' : 'none');
    assert.equal(await page.locator('[class*=tl-item]').count(), 5);
    if (width <= 820) {
      const clock = await page.locator('[class*=cd-row]').evaluate(element => [...element.children].map(child => child.getBoundingClientRect().top));
      assert.equal(new Set(clock).size, 1);
      assert.equal(await page.locator('[class*=hero-inner]').evaluate(element => getComputedStyle(element).paddingTop), '250px');
      assert.equal(await page.locator('[class*=portrait]').evaluate(element => element.getBoundingClientRect().height), 320);
    }
    const mainCta = page.locator('[data-event-section=hero] a[href="#richiesta"]').nth(1);
    assert.equal(await mainCta.evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(216, 255, 66)');
    assert.equal(await mainCta.evaluate(element => getComputedStyle(element).color), 'rgb(7, 23, 29)');
    assert.equal(await mainCta.evaluate(element => getComputedStyle(element).borderRadius), '6px');
    assert.equal(await page.locator('[class*=load-2]').evaluate(element => getComputedStyle(element).animationName), 'none');

    const form = page.locator('form[data-pilot-form=patrimonial-event]');
    assert.equal(await form.evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(16, 34, 41)');
    assert.match(await form.locator('[name=phone]').locator('..').innerText(), /Cellulare.*facoltativo/is);
    assert.equal(await form.locator('[name=phone]').getAttribute('required'), null);
    assert.equal(await form.locator('[name=lastName]').isVisible(), false); assert.equal(await form.locator('[name=province]').isVisible(), false);
    await page.evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0); });
    await page.screenshot({ path: path.join(directory, `event-mobile-${width}-hero.png`) });
    for (const scene of eventScenes) {
      await page.locator(`[data-scene=${scene.id}]`).click();
      assert.equal(await page.locator(`[data-scene=${scene.id}]`).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator(`[data-scene=${scene.id}]`).evaluate(element => getComputedStyle(element).borderTopColor), 'rgb(7, 23, 29)');
      assert.equal(await page.locator(`[data-scene=${scene.id}] [class*=tick]`).evaluate(element => getComputedStyle(element).opacity), '1');
      for (const key of ['kicker', 'answer', 'detail', 'cta']) assert.equal(await page.locator(`[data-bind="cur.${key}"]`).innerText(), scene[key]);
      assert.equal(await form.locator(`[data-event-profile="${scene.profile}"]`).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('[data-bind=formTitle]').innerText(), eventFormTitle(scene.profile));
    }
    for (const profile of eventProfiles) {
      await form.locator(`[data-event-profile="${profile.label}"]`).click();
      assert.equal(await form.locator('[name=profile]').inputValue(), profile.value);
      assert.equal(await page.locator('[data-bind=formTitle]').innerText(), eventFormTitle(profile.label));
    }
    for (const amount of [50000, 100000, 250000, 500000]) {
      await page.locator(`[data-preset="${amount}"]`).click();
      assert.equal(await page.locator('#capitale').inputValue(), String(amount));
      for (const key of ['amount', 'real', 'lost', 'perDay']) assert.equal(await page.locator(`[data-bind="calc.${key}"]`).innerText(), eventCalculator(amount)[key]);
    }
    await page.locator('#capitale').focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#capitale').inputValue(), '20000');
    await page.locator('[data-preset="100000"]').click();
    await page.locator('[data-scene=impresa]').click();
    for (const section of await page.locator('[data-event-section]').all()) {
      await section.scrollIntoViewIfNeeded();
      const overflow = await section.evaluate(element => [...element.querySelectorAll('*')].filter(child => {
        const r = child.getBoundingClientRect(), style = getComputedStyle(child);
        return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1) && !['absolute', 'fixed'].includes(style.position)
          && !['svg', 'path'].includes(child.tagName.toLowerCase())
          && !child.closest('[data-carousel]');
      }).map(child => child.tagName + ':' + child.textContent.slice(0, 50)));
      assert.deepEqual(overflow, [], `Overflow ${width}px: ${await section.getAttribute('data-event-section')}`);
    }
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.waitForFunction(() => [...document.querySelectorAll('img')].every(image => image.complete && image.naturalWidth > 0));
    assert.equal(await page.locator('[class*=pyr-list]').isVisible(), width <= 820);
    assert.equal(await page.locator('[class*=pyr-label]').first().isVisible(), width > 820);
    assert.equal(await page.locator('[class*=hero-chip]').evaluate(element => getComputedStyle(element).position), width <= 820 ? 'static' : 'absolute');
    const sticky = page.locator('[data-event-section=sticky]');
    assert.equal(await sticky.evaluate(element => getComputedStyle(element).position), 'sticky');
    assert.equal(await sticky.locator('[class*=sticky-hide-m]').isVisible(), width > 820);
    const box = await sticky.getByRole('link').boundingBox(); assert(box.x >= 0 && box.x + box.width <= width && (width <= 820 ? Math.abs(box.width - (width - 48)) < 2 : box.width <= 320));
    for (const detail of await page.locator('details').all()) {
      await detail.locator('summary').focus(); await page.keyboard.press('Enter'); assert.equal(await detail.getAttribute('open'), '');
      await page.keyboard.press('Enter'); assert.equal(await detail.getAttribute('open'), null);
    }
    for (const name of ['scenes', 'calculator', 'pyramid', 'questions', 'gold-comparison', 'agenda', 'speaker', 'bonuses', 'request', 'faq', 'closing', 'footer']) {
      await page.mouse.move(0, 0);
      await page.locator(`[data-event-section=${name}]`).screenshot({ path: path.join(directory, `event-mobile-${width}-${name}.png`) });
    }
    await form.getByRole('button', { name: 'Riserva il mio posto gratuito', exact: true }).click(); assert.equal(sent.length, 0);
    await form.locator('[name=firstName]').fill('Ada'); await form.locator('[name=email]').fill('event-browser@example.invalid');
    await form.locator('[name=consent]').check();
    await form.getByRole('button', { name: 'Riserva il mio posto gratuito', exact: true }).click();
    await form.getByRole('heading', { name: 'Ci manca solo questo', exact: true }).waitFor(); assert.equal(sent.length, 0);
    assert.equal(await page.locator(':focus').getAttribute('id'), 'patrimonial-event-form-title');
    await form.getByRole('button', { name: 'Conferma la richiesta', exact: true }).click(); assert.equal(sent.length, 0);
    await form.locator('[name=lastName]').fill('Lovelace');
    await form.getByRole('button', { name: 'Conferma la richiesta', exact: true }).click(); assert.equal(sent.length, 0);
    await form.locator('[name=province]').fill('Milano');
    await form.getByRole('button', { name: '← Torna ai recapiti', exact: true }).click();
    assert.equal(await page.locator(':focus').getAttribute('name'), 'firstName');
    assert.equal(await form.locator('[name=firstName]').inputValue(), 'Ada'); assert.equal(await form.locator('[name=email]').inputValue(), 'event-browser@example.invalid');
    await form.locator('[data-event-profile="Genitore / famiglia"]').click();
    await form.getByRole('button', { name: 'Riserva il mio posto gratuito', exact: true }).click(); assert.equal(sent.length, 0);
    assert.equal(await form.locator('[name=lastName]').inputValue(), 'Lovelace'); assert.equal(await form.locator('[name=province]').inputValue(), 'Milano');
    await form.screenshot({ path: path.join(directory, `event-mobile-${width}-micro-step.png`) });
    await form.evaluate(element => { element.requestSubmit(); element.requestSubmit(); });
    if (fail) {
      await form.getByRole('alert').waitFor(); assert.equal(sent.length, 1); assert.equal(await form.locator('[name=province]').inputValue(), 'Milano');
      fail = false; await form.getByRole('button', { name: 'Conferma la richiesta', exact: true }).click();
    }
    await page.waitForURL(`**${routePath}/grazie`); assert.equal(sent.length, width === 1440 ? 2 : 1);
    for (const payload of sent) {
      assert(validatePilotLead(payload), 'Existing API must accept UI payload');
      assert.equal(payload.mode, 'patrimonial-event'); assert.equal(payload.sourcePath, routePath);
      assert.equal(payload.profile, 'Altro'); assert.equal(payload.firstName, 'Ada'); assert.equal(payload.lastName, 'Lovelace'); assert.equal(payload.province, 'Milano');
      assert.equal(payload.phone, ''); assert.equal(payload.consent, true); assert.equal(payload.marketingConsent, false); assert.equal(payload.website, ''); assert.equal(payload.message, '');
      assert.equal(payload.eventEditionId, undefined); assert.deepEqual(payload.utm, { utm_source: 'qa-local', utm_campaign: 'event-redesign' });
    }
    const shell = page.locator('main#content').locator('..');
    assert.equal(await shell.locator(':scope > header').count(), 1); assert.equal(await shell.locator(':scope > footer').count(), 1);
    assert.deepEqual(errors, []); await context.close();
    console.log(`PASS event ${width}px: four snap carousels/keyboard, timeline, mobile hero, palette,  18 sections, fonts/assets, scenes/profiles/title, calculator, clock, FAQ/keyboard, sticky, no overflow, micro-step/no early POST, retained fields, complete payload, double-submit, ${width === 1440 ? 'error/retry, ' : ''}thank-you. All POSTs intercepted; zero service writes.`);
  }

  const touch = await browser.newContext({viewport:{width:390,height:900},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  await touch.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    return url.origin === base.origin && request.method() === 'GET' ? route.continue() : route.abort();
  });
  const motion = await touch.newPage(); await motion.goto(`${base.origin}${routePath}`, {waitUntil:'networkidle'});
  assert.notEqual(await motion.locator('[class*=load-2]').evaluate(element => getComputedStyle(element).animationName), 'none');
  assert(await motion.evaluate(() => matchMedia('(hover:none)').matches));
  await motion.locator('[data-scene=impresa]').click();
  assert.equal(await motion.locator('[data-scene=impresa]').getAttribute('aria-pressed'), 'true');
  for (const name of ['hero','scenes','questions','agenda','request']) {
    const section=motion.locator(`[data-event-section=${name}]`); await section.scrollIntoViewIfNeeded();
    await section.screenshot({path:path.join(directory, `event-mobile-motion-390-${name}.png`)});
  }
  assert(await motion.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await touch.close();
  console.log('PASS event touch/motion: source animations enabled, selected scene stable, no page overflow; zero service writes.');
} finally { await browser.close(); }
