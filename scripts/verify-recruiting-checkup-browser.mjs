import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CHECKUP_PLAYWRIGHT_MODULE ?? 'playwright');
const report = JSON.parse(await readFile('output/recruiting-checkup-qa/report-sintetico.json', 'utf8'));
const runId = report.analysisRunId;
const pdf = await readFile('output/recruiting-checkup-qa/checkup-esempio-sintetico.pdf');
const browser = await chromium.launch({ headless: true, ...(process.env.CHECKUP_BROWSER_EXECUTABLE ? { executablePath: process.env.CHECKUP_BROWSER_EXECUTABLE } : {}) });
const failures = [];
for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  const page = await browser.newPage({ viewport });
  const key = viewport.width < 500 ? 'mobile' : 'desktop';
  let started = false, verified = false, requests = 0, savedContact;
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/iubenda/, r => r.abort());
  const run = () => ({ id: runId, status: 'READY', ready: true, stage: 'COMPLETE', sourceStatus: 'READY', contactSaved: !!savedContact, emailVerified: verified, resultEligible: verified });
  await page.route('**/api/annunci-10x/**', async route => {
    const req = route.request(); const path = new URL(req.url()).pathname;
    const fulfill = body => route.fulfill({ json: body });
    if (path.endsWith('/session/resume')) return fulfill({ ok: true, analysisRun: started ? run() : null });
    if (path.endsWith('/source-file')) return fulfill({ ok: true, text: report.originalText });
    if (path === '/api/annunci-10x/analysis') { const body = req.postDataJSON(); assert.equal(body.checkup, true); started = true; requests++; return fulfill({ ok: true, run: run() }); }
    if (path.endsWith('/contact')) { savedContact = req.postDataJSON(); assert.ok(savedContact.phone); assert.ok(savedContact.companyName); assert.equal(savedContact.analysisRunId, runId); return fulfill({ ok: true, emailVerified: false }); }
    if (path.endsWith('/email-verification/request')) return fulfill({ ok: true, sent: true, expiresInSeconds: 600, resendAfterSeconds: 60 });
    if (path.endsWith('/email-verification/verify')) { assert.equal(req.postDataJSON().code, '123456'); verified = true; return fulfill({ ok: true, resultEligible: true }); }
    if (path.endsWith('/result')) return fulfill({ ok: true, result: { analysisRunId: runId, resultVersion: 'V2', checkup: true, score: { value: report.before.score, max: 100, coverage: report.before.coverage } } });
    if (path.endsWith('/pdf')) return route.fulfill({ contentType: 'application/pdf', body: pdf });
    if (path.includes('/checkup/')) return fulfill({ ok: true, status: 'EMAIL_ACCEPTED', report });
    return fulfill({ ok: true, run: run() });
  });
  await page.goto('http://127.0.0.1:3100/recruiting/check-up-annuncio?utm_source=synthetic-browser', { waitUntil: 'networkidle' });
  await page.locator('img[alt="Angelo Ria Chetta"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `output/recruiting-checkup-qa/landing-${key}.png`, fullPage: true });
  assert.equal(await page.locator('a[href*="calendly.com"]').count(), 0);
  const input = page.locator('#annunci10x-source-text');
  await input.fill(report.originalText);
  await page.getByRole('button', { name: 'Invia il mio annuncio per il check-up gratuito', exact: true }).click();
  await page.locator('#analyze-lead-first-name').fill('Ada');
  await page.locator('#analyze-lead-last-name').fill('Test sintetico');
  await page.locator('#analyze-lead-email').fill('ada.checkup@example.com');
  await page.locator('#analyze-lead-phone').fill('02 1234 5678');
  await page.locator('#analyze-lead-company').fill('Azienda dimostrativa');
  await page.locator('#analyze-lead-role-sought').fill('Addetto customer care');
  await page.getByRole('button', { name: 'Continua', exact: true }).click();
  await page.getByRole('button', { name: 'Invia codice', exact: true }).click();
  await page.locator('#analyze-lead-otp').fill('123456');
  await page.getByRole('button', { name: 'Verifica email', exact: true }).click();
  await page.getByRole('link', { name: 'Scarica il PDF completo gratuito', exact: true }).waitFor();
  assert.equal(savedContact.marketingConsent, false);
  const calendar = page.getByRole('link', { name: 'Prenota i tuoi 15 minuti gratuiti.', exact: true });
  assert.ok((await calendar.getAttribute('href')).includes(runId));
  assert.ok(!(await calendar.getAttribute('href')).includes('ada'));
  await page.locator('[aria-live="polite"]').last().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `output/recruiting-checkup-qa/result-${key}.png`, fullPage: true });
  const overflows = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(overflows.scroll <= overflows.width + 1, JSON.stringify(overflows));
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Scarica il PDF completo gratuito', exact: true }).waitFor();
  assert.equal(requests, 1, 'Reload must not create a new analysis');
  assert.deepEqual(errors, []);
  await page.close();
}
await browser.close();
await writeFile('output/recruiting-checkup-qa/browser-verification.json', JSON.stringify({ status: 'PASS', viewportWidths: [1440,390], mode: 'real local UI; synthetic API responses; no external messages, booking or live AI calls', errors: failures }, null, 2));
console.log('PASS: local browser desktop/mobile, contact and OTP forms, complete gift before optional calendar, reload without new request, no horizontal overflow or page errors. API responses mocked.');
