// Real browser, synthetic data, loopback only. No production accounts or transports.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { diagnose } from '../src/lib/patrimonial-radar/result.ts';
import { connectedChecks } from './lib/patrimonial-radar-connected-checks.mjs';
import { startRadarBrowserStack } from './lib/patrimonial-radar-browser-stack.mjs';
import { buildFixture, T0 } from './patrimonial-radar-fixtures.mjs';
const arg = key => process.argv.find(v => v.startsWith(`--${key}=`))?.slice(key.length + 3);
assert(arg('playwright-module') && arg('artifacts'), 'Explicit runtime and artifact directory required');
const stack = await startRadarBrowserStack();
const { base, disabled } = stack;
for (const url of [base, disabled].filter(Boolean)) assert(['127.0.0.1', 'localhost'].includes(url.hostname), 'Loopback only');
const directory = path.resolve(arg('artifacts')); await mkdir(directory, { recursive: true });
const { chromium } = await import(pathToFileURL(path.resolve(arg('playwright-module'))).href);
const browser = await chromium.launch({ headless: true, ...(arg('executable') ? { executablePath: arg('executable') } : {}) });
const passed = [], screenshots = [], requests = [], errors = [], consoles = [], observed = new Set();
let external = 0, writes = 0, identitySerial = 0;
async function create(width = 1440, height = 1000, reducedMotion = 'reduce') {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion });
  await ctx.addInitScript(() => {
    const forbidden = () => { throw new Error('Browser test: persistence is forbidden'); };
    Storage.prototype.setItem = forbidden; Storage.prototype.removeItem = forbidden; Storage.prototype.clear = forbidden;
    navigator.sendBeacon = forbidden;
  });
  await ctx.route('**/*', route => {
    const r = route.request(), url = new URL(r.url());
    if (url.origin !== base.origin) { external++; return route.abort(); }
    requests.push({ method: r.method(), url: r.url(), body: r.postData() });
    if (!['GET', 'HEAD'].includes(r.method())) { writes++; assert.equal(url.pathname.startsWith('/api/patrimonial-radar/'), true); }
    return route.continue();
  });
  const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => consoles.push(m.text()));
  const response = await page.goto(`${base.origin}/radar-patrimoniale`, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200); assert.match(response.headers()['x-robots-tag'], /noindex, nofollow/);
  const csp = response.headers()['content-security-policy']; assert.ok(csp); assert.doesNotMatch(csp, /iubenda/); assert.match(csp, /form-action 'none'/);
  assert.equal(await page.locator('meta[name=robots]').getAttribute('content'), 'noindex, nofollow, nocache');
  page.on('dialog', d => d.accept()); return { ctx, page };
}
async function login(page, email = `browser-${++identitySerial}@test.invalid`, create = true) {
  await stack.unlock();
  await page.getByRole('button', { name: 'Inizia la fotografia', exact: true }).click();
  await page.getByLabel('Email di test', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Richiedi codice', exact: true }).click();
  await page.getByLabel('Codice a otto cifre', { exact: true }).waitFor();
  assert.ok(stack.code(email), 'OTP available only to the Node simulated provider');
  await page.getByLabel('Codice a otto cifre', { exact: true }).fill(stack.code(email));
  await page.getByRole('button', { name: 'Verifica codice', exact: true }).click();
  if (create) await page.getByRole('button', { name: 'Crea la prima compilazione', exact: true }).click();
  await page.locator(create ? '[data-question-id]' : 'h1').waitFor(); return email;
}
async function shot(page, name, fullPage = false) { const file = `${name}.png`; const scroll = await page.evaluate(() => scrollY); if (fullPage) await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(directory, file), fullPage }); if (fullPage) await page.evaluate(y => window.scrollTo(0, y), scroll); screenshots.push(file); }
async function fits(page, note) { const g = await page.evaluate(() => ({ width: innerWidth, page: document.documentElement.scrollWidth, hidden: getComputedStyle(document.documentElement).overflowX === 'hidden' || getComputedStyle(document.body).overflowX === 'hidden' })); assert.ok(g.page <= g.width + 1, `${note}: width ${g.page}/${g.width}`); assert.equal(g.hidden, false, 'No overflow hidden on document'); }
async function smallScreens(page, name) { for (const width of [320, 390, 768]) { await page.setViewportSize({ width, height: 844 }); await fits(page, `${name} ${width}`); await shot(page, `${name}-${width}`, true); } await page.setViewportSize({ width: 1440, height: 1000 }); }
async function active(page) { return page.locator('[data-question-id]').getAttribute('data-question-id'); }
async function chooseValue(page) { const form=page.locator('[data-question-id] form'); assert.equal(await form.getByRole('button',{name:'Indico una risposta',exact:true}).count(),0); assert.equal(await form.getByRole('button',{name:'Da completare',exact:true}).count(),0); const fields=form.locator('input,select'); assert.ok(await fields.count()>0 || await form.getByRole('button',{name:'+ Aggiungi un obiettivo',exact:true}).count()===1,'Primary controls immediately present'); if(await fields.count())assert(await fields.first().isVisible()); assert.deepEqual(await fields.evaluateAll(nodes=>nodes.filter(n=>!n.labels?.length&&!n.getAttribute('aria-label')&&!n.getAttribute('aria-labelledby')).map(n=>n.tagName)),[],'Every input has an accessible name'); }
async function continueQuestion(page) { const id = await active(page); observed.add(id); await page.locator('[data-question-id] button[type=submit]').click(); await page.waitForFunction(id => document.querySelector('[data-question-id]')?.getAttribute('data-question-id') !== id || document.querySelector('[data-question-id] [role=alert]'), id); assert.equal(await page.locator('[data-question-id] [role=alert]').count(), 0, `No form error at ${id}`); }
async function moneyInput(scope, amount) { await scope.getByRole('button', { name: 'Un importo', exact: true }).click(); await scope.getByRole('textbox').fill(String(amount).replace('.', ',')); }
async function moneyField(page, title, amount) { const el = page.locator('[data-money-field]').filter({ has: page.getByText(title, { exact: true }) }); await moneyInput(el, amount); }
async function openOptional(page, id) { await page.locator(`[data-optional-id="${id}"]`).click(); assert.equal(await active(page), id); await chooseValue(page); }
async function saveOptional(page) { observed.add(await active(page)); await page.getByRole('button', { name: 'Conferma approfondimento', exact: true }).click(); await page.waitForFunction(() => !document.querySelector('[data-question-id]') || document.querySelector('[data-question-id] [role=alert]')); assert.equal(await page.locator('[data-question-id] [role=alert]').count(), 0); }
async function assertStates(page, expected) { for (const [area, data] of Object.entries(expected.areas)) assert.equal(await page.locator(`[data-area="${area}"]`).getAttribute('data-state'), data.state, area); assert.equal(await page.locator('[data-sector]').count(), 6); assert.equal(await page.locator('svg polygon').count(), 0); }
try {
  if (disabled) { const c = await browser.newContext(); const r = await c.request.get(`${disabled.origin}/radar-patrimoniale`); assert.equal(r.status(), 404); assert.ok(!(await r.text()).includes('Inizia la fotografia')); await c.close(); passed.push('Server feature flag OFF: HTTP 404 and no questionnaire'); }
  if (!process.argv.includes('--connected-only')) {
  const { ctx, page } = await create();
  await page.evaluate(() => document.fonts.ready);
  assert.match(await page.locator('h1').evaluate(el => getComputedStyle(el).fontFamily), /Manrope/);
  await fits(page, 'desktop intro'); await shot(page, 'intro-desktop-1440');
  await login(page);
  const ordinaryOrder = ['S01','S02','S03','S04','A01','A02','A03','A04','A05','C01','C02','C03','C04','B01','B02','B03','B04','D01','D02','E01','E02','E03','E04','F01','F02','F03','F04','F05','F06'];
  for (const short of ordinaryOrder) {
    const id = `RP-${short}`; assert.equal(await active(page), id); assert.equal(await page.locator('h1').evaluate(el => document.activeElement === el), true, 'Heading receives focus'); await chooseValue(page);
    const form = page.locator('[data-question-id] form');
    if (['A01','A02','C02','B01','B02','B03'].includes(short)) {
      const values = { A01: 4000, A02: 2500, C02: 800, B01: 1800, B02: 20000, B03: 5000 };
      if (short === 'A01') { await form.getByRole('combobox', { name: 'Fascia · Importo', exact: true }).selectOption('5'); await form.getByRole('combobox', { name: 'Come esprimere il dato', exact: true }).selectOption('ANNUAL'); }
      await moneyInput(form, short === 'A01' ? 48000 : values[short]);
      if (short === 'A01') { await form.getByRole('textbox').fill('-1'); assert.equal(await form.getByRole('textbox').getAttribute('aria-invalid'), 'true'); await form.getByRole('textbox').fill('48000'); assert.equal(await form.getByRole('textbox').getAttribute('aria-invalid'), null); }
    } else if (short === 'C01') { await form.locator('input[value=MORTGAGE]').check(); await form.getByRole('combobox').selectOption('true'); }
    else if (short === 'C04') { await moneyInput(form, 800); await form.getByRole('combobox', { name: 'Ci sono cambiamenti di rata già noti?', exact: true }).selectOption('NO'); }
    else if (short === 'D01') { await form.locator('input[value=HOME]').check(); await form.locator('input[value=SUPPORT]').check(); }
    else if (short === 'D02') { for (const select of await form.getByRole('combobox').all()) await select.selectOption('CHECKED'); }
    else if (short === 'E01') { for (const c of ['CASH','FINANCIAL','HOME']) await form.locator(`input[value=${c}]`).check(); await form.getByRole('checkbox', { name: /Confermo che l’inventario/ }).check(); }
    else if (short === 'E02') { await form.locator('input[value=GE50_LT75]').check(); await form.getByRole('combobox').selectOption('PROPERTY'); }
    else {
      const codes = { S01:'HOUSEHOLD', S02:'COMPLETE', S03:'EMPLOYEE', S04:'2', A03:'COVERED', A04:'REGULAR', A05:'GT50_LE80', C03:'NONE', B04:'OWN_AVAILABLE', E03:'GE25_LT50', E04:'NO', F01:'DEFINED', F02:'CHECKED', F03:'DIRECT', F04:'EXPLAIN', F05:'EXPOSURE', F06:'WITHIN3' };
      await form.locator(`input[value="${codes[short]}"]`).check();
    }
    if (short === 'S02') { await page.getByRole('button', { name: '← Precedente', exact: true }).click(); assert.equal(await active(page), 'RP-S01'); await continueQuestion(page); assert.equal(await active(page), id); assert.equal(await form.locator('input[value=COMPLETE]').isChecked(), true, 'Previous/next preserves an unconfirmed draft'); }
    await fits(page, id);
    if (short === 'D02') { await shot(page, 'matrix-desktop-1440', true); await smallScreens(page, 'matrix'); }
    await continueQuestion(page);
  }
  const asOf = await page.locator('[data-assessment-date]').getAttribute('data-assessment-date');
  const expectedInput = JSON.parse(JSON.stringify(buildFixture('T02')).replaceAll(T0, asOf));
  assert.ok(await page.getByRole('heading', { name: 'Prima di completare.', exact: true }).isVisible()); await shot(page, 'review-desktop-1440', true);
  passed.push('All 29 ordinary questions through real controls, including annual conversion, bands, matrices and focus; stored snapshot states equal engine T02');
  await page.getByRole('button', { name: 'Approfondisci, se vuoi', exact: false }).click(); assert.equal(await page.locator('[data-optional-id]').count(), 11);
  for (let n = 1; n <= 11; n++) {
    const id = `RP-X${String(n).padStart(2,'0')}`; await openOptional(page, id); const form = page.locator('[data-question-id] form');
    if (n === 1) await moneyInput(form, 500);
    if (n === 2) await form.locator('input[value=NONE]').check();
    if (n === 3) for (const select of await form.getByRole('combobox').all()) await select.selectOption('CHECKED');
    if (n === 4) { await moneyField(page, 'Strumenti finanziari non previdenziali', 90000); await moneyField(page, 'Abitazione principale', 300000); await form.getByRole('checkbox', { name: 'Questo riepilogo comprende tutte le attività selezionate' }).check(); assert.equal(await form.getByRole('textbox').count(), 2, 'Cash is never duplicated'); }
    if (n === 5) { await moneyInput(form, 180000); await form.getByRole('checkbox', { name: /L’importo comprende tutti/ }).check(); }
    if (n === 6) {
      for (const category of ['HOUSING','RESERVE']) { await form.getByRole('button', { name: '+ Aggiungi un obiettivo', exact: true }).click(); const row = form.locator('[data-goal-id]').last(); await row.getByRole('combobox', { name: 'Che cosa vorresti ottenere?', exact: true }).selectOption(category); await row.getByRole('combobox', { name: 'Quando potrebbero servire per la prima volta le risorse?', exact: true }).selectOption(category === 'HOUSING' ? 'OVER12_TO36' : 'WITHIN12'); await row.getByRole('combobox', { name: 'È un’esigenza una tantum o continuativa?', exact: true }).selectOption('ONCE'); }
      assert.equal(await form.getByRole('combobox', { name: 'Priorità scelta da te', exact: true }).first().inputValue(), '');
      await form.getByRole('button', { name: 'Conferma quest’ordine di priorità', exact: true }).click(); await shot(page, 'goals-desktop-1440', true);
    }
    if (n === 7) await form.locator('input[value="20"]').check();
    if (n === 8) { await form.getByRole('combobox', { name: 'Fonte della verifica', exact: true }).selectOption('OFFICIAL'); await form.getByRole('combobox', { name: 'A quando risale?', exact: true }).selectOption('WITHIN12'); }
    if (n === 9) {
      await moneyField(page, 'Quota della liquidità attuale da mantenere per riserva e impegni', 10000); await moneyField(page, 'Quota attuale eventualmente destinabile a tutti gli obiettivi', 8000);

      await moneyField(page, 'Quota per 1. Acquistare o adattare l’abitazione', 5000); await moneyField(page, 'Quota per 2. Riserva per imprevisti', 1000);
      await form.getByRole('button', { name: '+ Aggiungi un vincolo', exact: true }).click();
      await form.getByRole('combobox', { name: 'Che cosa deve essere rispettato?', exact: true }).selectOption('ACCESS'); await form.getByRole('combobox', { name: 'Entro quando devono essere accessibili le risorse?', exact: true }).selectOption('DAYS7'); await form.getByRole('combobox', { name: 'Quanto è vincolante per te?', exact: true }).selectOption('HARD');
    }
    if (n === 10) { await form.locator('input[value=CASH]').check(); await form.getByRole('combobox', { name: 'Che esperienza vuoi segnalare?', exact: true }).selectOption('READ_COMPARED'); await form.getByRole('combobox', { name: 'Quando? Facoltativo', exact: true }).selectOption('WITHIN12'); await form.locator('input[value=AVAILABILITY]').check(); await form.locator('input[value=ACCESS]').check(); }
    if (n === 11) { await form.getByRole('combobox', { name: 'Il risultato principale che desideri dall’incontro', exact: true }).selectOption('RESOURCES_CONSTRAINTS'); await form.getByRole('combobox', { name: 'Come vorresti partecipare alle decisioni future?', exact: true }).selectOption('UNDERSTAND_FIRST'); }
    await fits(page, id); if ([6,9,10].includes(n)) await smallScreens(page, `optional-x${n}`); await saveOptional(page);
  }
  assert.equal(observed.size, 40); await page.getByRole('button', { name: 'Torna al riepilogo', exact: false }).click(); await page.getByRole('button', { name: 'Completa e salva il risultato', exact: true }).click(); await page.locator('[data-result-preview]').waitFor(); await assertStates(page, diagnose(expectedInput)); await shot(page, 'result-desktop-1440', true);
  assert.ok(await page.getByText('Principale · Acquistare o adattare l’abitazione', { exact: true }).isVisible());
  passed.push('All 11 optional widgets: stocks, protection, two explicitly ranked goals, resource allocations/constraint, experience, service preferences; no effect on unrelated area states');
  await page.getByRole('button', { name: 'Vai alle tue compilazioni', exact: true }).click(); await page.getByRole('button', { name: 'Crea esplicitamente un nuovo episodio', exact: true }).click(); await page.locator('input[value=HOUSEHOLD]').check(); await continueQuestion(page); await page.getByRole('button', { name: '← Precedente', exact: true }).click(); await page.locator('input[value=INDIVIDUAL]').check(); await continueQuestion(page);
  await page.reload({ waitUntil: 'networkidle' }); await page.locator('[data-question-id]').waitFor();
  assert.equal(await active(page), 'RP-S02');
  await page.getByRole('button', { name: '← Precedente', exact: true }).click(); assert.equal(await page.locator('input[value=INDIVIDUAL]').isChecked(), true);
  assert.equal(await page.locator('[data-result-preview]').count(), 0);
  assert.deepEqual(await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) })), { local: [], session: [] }); passed.push('Refresh resumes the persisted draft and explicit new episode preserves immutable history; storage writes actively forbidden');
  await ctx.close();

  // Separate synthetic path: real zeros and missing answers must stay distinct.
  const z = await create(390, 844); await login(z.page);
  const visited = [];
  while (await z.page.locator('[data-question-id]').count()) {
    const id = await active(z.page); visited.push(id); const form = z.page.locator('[data-question-id] form');
    if (['RP-S01','RP-S02','RP-A01','RP-C01','RP-C03','RP-B02','RP-D01','RP-E01'].includes(id)) {
      await chooseValue(z.page);
      if (id === 'RP-A01' || id === 'RP-B02') await moneyInput(form, 0);
      else if (id === 'RP-C01') await form.locator('input[value=NONE]').check();
      else if (id === 'RP-E01') { await form.locator('input[value=NONE]').check(); await form.getByRole('checkbox', { name: /Confermo che l’inventario/ }).check(); }
      else await form.locator(`input[value=${({ 'RP-S01':'INDIVIDUAL', 'RP-S02':'COMPLETE', 'RP-C03':'CURRENT', 'RP-D01':'NONE' })[id]}]`).check();
    } else if(id !== 'RP-F01') await z.page.locator('[data-answer-scope=question]').getByRole('button', { name: id === 'RP-S04' ? 'Preferisco non rispondere' : 'Non so', exact: true }).click();
    await fits(z.page, id); if (visited.length === 3) await shot(z.page, 'question-mobile-390', true); await continueQuestion(z.page);
  }
  for (const id of ['RP-A05','RP-C02','RP-C04','RP-B03','RP-D02','RP-E02','RP-E03','RP-E04','RP-F04']) assert.ok(!visited.includes(id), `${id} skipped by engine`);
  await z.page.getByRole('button', { name: 'Completa e salva il risultato', exact: true }).click(); await z.page.locator('[data-result-preview]').waitFor();
  assert.equal(await z.page.locator('[data-area=C]').getAttribute('data-state'), 'ATTENZIONE'); assert.equal(await z.page.locator('[data-area=A]').getAttribute('data-state'), 'NON_VALUTABILE'); await shot(z.page, 'result-mobile-390', true); await z.ctx.close(); passed.push('Adaptive zero/no debts/no assets/no perceived exposure path: structural questions skipped; arrears attention retained while missing money stays unavailable');

  for (const width of [320,390,768,1440]) {
    const r = await create(width, width === 390 ? 844 : 1000, width === 768 ? 'no-preference' : 'reduce'); await fits(r.page, `intro ${width}`); await shot(r.page, `intro-${width}`);
    assert.equal(await r.page.locator('img').evaluateAll(imgs => imgs.every(i => i.complete && i.naturalWidth > 0)), true);
    await login(r.page); await chooseValue(r.page); await fits(r.page, `question ${width}`);
    await r.page.locator('input[value=INDIVIDUAL]').focus(); await r.page.keyboard.press('Space'); await r.page.keyboard.press('Tab');
    assert.equal(await r.page.evaluate(() => document.activeElement !== document.body), true);
    const focus = await r.page.evaluate(() => ({ style: getComputedStyle(document.activeElement).outlineStyle, width: parseFloat(getComputedStyle(document.activeElement).outlineWidth) })); assert.notEqual(focus.style, 'none'); assert.ok(focus.width >= 2, 'Visible keyboard focus');
    assert.ok((await r.page.locator('button[type=submit]').boundingBox()).height >= 44, 'Comfortable main touch target');
    if (width !== 768) assert.equal(await r.page.locator('[data-question-id]').evaluate(el => getComputedStyle(el).animationName), 'none', 'Reduced motion disables question transition');
    if (width === 320) { await shot(r.page, 'question-mobile-320', true); await r.page.setViewportSize({ width: 844, height: 390 }); await fits(r.page, 'landscape'); }
    await r.page.getByRole('button', { name: 'Riepilogo e completamento', exact: false }).click(); await fits(r.page, `preview ${width}`); assert.ok(await r.page.getByRole('heading', { name: 'Prima di completare.', exact: true }).isVisible()); await r.ctx.close();
  }
  passed.push('320/390/768/1440, landscape, native keyboard controls/focus, loaded original image, reduced motion and non-color textual descriptions');
  }
  await connectedChecks({ stack, create, shot, fits, passed });
  assert.ok(writes > (process.argv.includes('--connected-only') ? 8 : 40), 'Confirmed responses saved through authenticated local API'); assert.equal(external, 0, 'Route CSP prevents inherited third-party scripts before requests'); assert.ok(requests.filter(r => r.body).every(r => new URL(r.url).pathname.startsWith('/api/patrimonial-radar/'))); assert.ok(requests.every(r => !new URL(r.url).searchParams.has('answers'))); assert.deepEqual(errors, []);
  assert.ok(!consoles.some(c => /48000|180000|90000/.test(c)), 'Financial inputs never enter console logs');
  assert.ok(!/48000|180000|90000|"amount"/.test(stack.logs.join('')), 'No financial answers in Next server logs');
  stack.assertSafeLogs();
  passed.push('Authenticated same-origin local writes only, zero external network requests, zero storage writes, zero uncaught browser errors; no financial data in URLs/logs');
  await writeFile(path.join(directory, 'verification.json'), JSON.stringify({ passed, screenshots, ordinaryAndOptionalQuestionsExercised: [...observed], network: { requests: requests.length, writes, external }, errors }, null, 2));
  console.log(passed.map(p => `PASS ${p}`).join('\n')); console.log(`Screenshots: ${directory}`);
} catch (error) { for (const [i, page] of browser.contexts().flatMap(c => c.pages()).entries()) { try { await shot(page, `failure-${i}`, true); } catch {} } throw error; } finally { await browser.close(); await stack.stop(); }
