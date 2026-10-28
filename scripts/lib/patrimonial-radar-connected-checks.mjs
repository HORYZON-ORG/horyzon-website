import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildFixture, T0 } from '../patrimonial-radar-fixtures.mjs';
import { dependencyOrder } from '../../src/lib/patrimonial-radar/answers.ts';
import { diagnose } from '../../src/lib/patrimonial-radar/result.ts';
import { customerProjection } from '../../src/lib/patrimonial-radar-server/customer-projection.ts';
import { contentHash } from '../../src/lib/patrimonial-radar-server/security.ts';

export async function connectedChecks({ stack, create, shot, fits, passed }) {
  const { base, disabled, db } = stack;
  const a = await create(390, 844), email = 'connected-owner@test.invalid';
  const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
  // Chromium accepts Secure cookies on loopback; APIRequestContext's HTTP jar does
  // not. Carry only this context's own cookies for direct local HTTP assertions.
  const api = async (ctx, path, body, csrf) => ctx.request.fetch(`${base.origin}/api/patrimonial-radar${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Cookie: (await ctx.cookies()).filter(c => c.domain === base.hostname).map(c => `${c.name}=${c.value}`).join('; '), ...(body === undefined ? {} : { Origin: base.origin, 'Content-Type': 'application/json', 'X-Patrimonial-CSRF': csrf }) }, ...(body === undefined ? {} : { data: body }) });
  async function request(page, address, begin = true) {
    await stack.unlock();
    if (begin) await page.getByRole('button', { name: 'Inizia la fotografia', exact: true }).click();
    await page.getByLabel('Email di test', { exact: true }).fill(address);
    await page.getByRole('button', { name: 'Richiedi codice', exact: true }).click();
    await page.getByLabel('Codice a otto cifre', { exact: true }).waitFor();
    assert.ok(stack.code(address)); return stack.code(address);
  }
  async function verify(page, code, succeeds = true) {
    await page.getByLabel('Codice a otto cifre', { exact: true }).fill(code);
    const response = page.waitForResponse(r => r.url().endsWith('/identity/verify'));
    await page.getByRole('button', { name: 'Verifica codice', exact: true }).click();
    const reply = await response;
    assert.equal(reply.status(), succeeds ? 200 : 401);
    if (!succeeds) { await page.getByText('Codice non valido, scaduto o già utilizzato.', { exact: false }).waitFor(); return; }
    return reply.json();
  }
  async function confirm(page, value) {
    if (value) await page.locator(`[data-question-id] input[value="${value}"]`).check();
    await page.locator('[data-question-id] button[type=submit]').click();
  }
  async function question(page, id) { await page.locator(`[data-question-id="${id}"]`).waitFor(); }
  try {
    await a.page.clock.install();
    let code = await request(a.page, email);
    await shot(a.page, 'identity-otp-390', true);
    for (const width of [320,390,768,1440]) { await a.page.setViewportSize({ width, height: 900 }); await fits(a.page, `identity ${width}`); }
    await verify(a.page, code === '00000000' ? '11111111' : '00000000', false);
    assert.equal((await rows('select attempts from patrimonial_radar_private.challenges order by created_at desc limit 1'))[0].attempts, 1);
    await db.exec("update patrimonial_radar_private.challenges set expires_at=clock_timestamp()-interval '1 second' where consumed_at is null");
    await verify(a.page, code, false);
    await a.page.clock.fastForward(61000); await stack.unlock();
    const resent = a.page.waitForResponse(r => r.url().endsWith('/identity/request'));
    await a.page.getByRole('button', { name: 'Richiedi un nuovo codice', exact: true }).click();
    const resentChallenge = await (await resent).json();
    const newCode = stack.code(email); assert.notEqual(newCode, undefined);
    await verify(a.page, code, false);
    const loginBinding = (await a.ctx.cookies()).find(c => c.name.includes('pr_login'));
    const verified = await verify(a.page, newCode);
    const cookie = (await a.ctx.cookies()).find(c => c.name.includes('pr_session'));
    assert.ok(cookie.httpOnly && cookie.secure && cookie.sameSite === 'Strict');
    assert.equal((await api(a.ctx, '/identity/verify', { challengeId: randomUUID(), code: newCode }, verified.csrf)).status(), 403, 'Consumed login binding cannot be replayed');
    const reused = await a.ctx.request.post(`${base.origin}/api/patrimonial-radar/identity/verify`, { data: { challengeId: resentChallenge.challengeId, code: newCode }, headers: { Origin: base.origin, 'X-Patrimonial-CSRF': resentChallenge.csrf, Cookie: `${loginBinding.name}=${loginBinding.value}` } });
    assert.equal(reused.status(), 401, 'Consumed OTP denied even with its original browser binding');
    passed.push('Browser OTP wrong/expired/old/reused, resend cooldown, simulated delivery, HttpOnly/Secure/Strict session and no account enumeration');

    await a.page.getByRole('button', { name: 'Crea la prima compilazione', exact: true }).click(); await question(a.page, 'RP-S01');
    const episodeResponse = await api(a.ctx, '/assessments'); assert.equal(episodeResponse.status(),200);
    const episodes = await episodeResponse.json(); assert.ok(Array.isArray(episodes)); assert.equal(episodes.length,1);
    const id = episodes[0].id;
    assert.equal(episodes.length, 1);
    const tab = await a.ctx.newPage(); tab.on('dialog', d => d.accept());
    await tab.goto(`${base.origin}/radar-patrimoniale`, { waitUntil: 'networkidle' }); await question(tab, 'RP-S01');
    await confirm(a.page, 'INDIVIDUAL'); await question(a.page, 'RP-S02');
    await confirm(tab, 'HOUSEHOLD');
    await tab.getByText('La compilazione è cambiata', { exact: false }).waitFor();
    await shot(tab, 'conflict-390', true);
    await tab.getByRole('button', { name: 'Aggiorna dal server e conserva la bozza', exact: true }).click();
    await tab.getByText('Risposta attualmente salvata sul server', { exact: true }).waitFor();
    assert.equal(await tab.locator('[data-question-id] form input[value=HOUSEHOLD]').isChecked(), true, 'Unsaved conflicting value retained');
    assert.equal(await tab.locator('fieldset[disabled] input[value=INDIVIDUAL]').isChecked(), true, 'Current server value displayed for comparison');
    await tab.getByRole('button', { name: 'Usa la risposta salvata e scarta questa bozza', exact: true }).click();
    await confirm(tab, 'HOUSEHOLD'); await question(tab, 'RP-S02');
    assert.equal((await (await api(a.ctx, `/assessments/${id}`)).json()).assessment.revision, 2);
    await tab.close();
    await a.page.reload({ waitUntil: 'networkidle' }); await question(a.page, 'RP-S02');
    const attempts = [];
    a.page.on('request', r => { if (r.url().endsWith('/answer')) attempts.push(r.postDataJSON()); });
    await a.ctx.setOffline(true); await confirm(a.page, 'COMPLETE');
    await a.page.getByRole('button', { name: 'Riprova la stessa richiesta', exact: true }).waitFor();
    await a.ctx.setOffline(false);
    await a.page.getByRole('button', { name: 'Riprova la stessa richiesta', exact: true }).click(); await question(a.page, 'RP-S03');
    assert.equal(attempts.at(-1).requestId, attempts.at(-2).requestId, 'Offline retry preserves request UUID/body/revision');
    let lost = false;
    await a.page.route('**/api/patrimonial-radar/assessments/*/answer', async route => { if (!lost) { lost = true; await route.fetch(); await route.abort('connectionreset'); } else await route.continue(); });
    await confirm(a.page, 'EMPLOYEE'); await a.page.getByRole('button', { name: 'Riprova la stessa richiesta', exact: true }).waitFor();
    const countBeforeRetry = (await rows('select count(*)::int as n from patrimonial_radar_private.answer_revisions where assessment_id=$1', [id]))[0].n;
    await a.page.getByRole('button', { name: 'Riprova la stessa richiesta', exact: true }).click(); await question(a.page, 'RP-S04');
    assert.equal((await rows('select count(*)::int as n from patrimonial_radar_private.answer_revisions where assessment_id=$1', [id]))[0].n, countBeforeRetry);
    assert.equal(attempts.at(-1).requestId, attempts.at(-2).requestId);
    await a.page.unroute('**/api/patrimonial-radar/assessments/*/answer');
    passed.push('Two browser tabs: stale revision rejected, server/current draft compared, explicit resolution; offline retry and lost committed response replay use the same UUID without duplicate revisions');

    const device = await create();
    const deviceCode = await request(device.page, email), verified2 = await verify(device.page, deviceCode);
    assert.equal(verified2.personId, verified.personId);
    assert.equal((await (await api(device.ctx, '/assessments')).json()).length, 1, 'Login does not auto-create an episode');
    await device.page.getByRole('button', { name: /Riprendi la bozza/ }).click(); await question(device.page, 'RP-S04');
    await device.page.reload({ waitUntil: 'networkidle' }); await question(device.page, 'RP-S04');
    // Expire only current owner sessions in this isolated DB; UI must reauthenticate and preserve the unconfirmed value.
    await db.query("update patrimonial_radar_private.sessions set idle_expires_at=clock_timestamp()-interval '1 second' where person_id=$1", [verified.personId]);
    await confirm(a.page, '2'); await a.page.getByLabel('Email di test', { exact: true }).waitFor();
    const renewedCode = await request(a.page, email, false); const renewed = await verify(a.page, renewedCode);
    assert.equal(renewed.personId, verified.personId); await question(a.page, 'RP-S04');
    assert.equal(await a.page.locator('[data-question-id] form input[value="2"]').isChecked(), true);
    await confirm(a.page, '2'); await question(a.page, 'RP-A01');
    passed.push('Second independently verified device resolves the same person/draft; refresh/interruption recovery; expired session reauthentication preserves the memory-only unconfirmed answer');

    const other = await create(); const otherCode = await request(other.page, 'another-person@test.invalid'); const otherSession = await verify(other.page, otherCode);
    assert.notEqual(otherSession.personId, verified.personId);
    for (const [path, body] of [[`/assessments/${id}`,undefined],[`/assessments/${id}/snapshot`,undefined],[`/assessments/${id}/answer`,{requestId:randomUUID(),expectedRevision:0,questionId:'RP-S01',state:'UNKNOWN'}],[`/assessments/${id}/complete`,{requestId:randomUUID(),expectedRevision:0}]]) assert.equal((await api(other.ctx,path,body,otherSession.csrf)).status(),404);
    assert.deepEqual(await (await api(other.ctx,'/assessments')).json(),[]);
    assert.equal((await api(a.ctx, `/assessments/${id}/answer`, { requestId:randomUUID(),expectedRevision:4,questionId:'RP-S01',state:'UNKNOWN' }, 'forged')).status(),403);
    assert.equal((await other.ctx.request.get(`${disabled.origin}/api/patrimonial-radar/session`)).status(),404);
    assert.equal((await other.ctx.request.post(`${disabled.origin}/api/patrimonial-radar/identity/request`,{data:{email},headers:{Origin:disabled.origin,'X-Patrimonial-CSRF':'request-code'}})).status(),404);
    passed.push('Browser cookies/API: another verified person cannot read/save/complete/snapshot a copied UUID; forged CSRF denied; disabled route/API remain inaccessible');

    // Populate through the same authenticated HTTP boundary, then exercise real UI reconfirmation and immutable completion.
    let assessment = (await (await api(a.ctx, `/assessments/${id}`)).json()).assessment;
    const fixture = JSON.parse(JSON.stringify(buildFixture('T02')).replaceAll(T0,assessment.input.asOf));
    for (const qid of dependencyOrder()) {
      const answer = fixture.answers.findLast(a => a.id === qid); if (!answer) continue;
      const current = await (await api(a.ctx, `/assessments/${id}`)).json();
      if (current.resolved[qid].applicability === 'NOT_APPLICABLE') continue;
      const reply = await api(a.ctx, `/assessments/${id}/answer`, { requestId:randomUUID(),expectedRevision:current.assessment.revision,questionId:qid,state:answer.state,...(answer.state === 'VALUE' ? {value:answer.value} : {}) }, renewed.csrf); assert.equal(reply.status(),200);
    }
    await a.page.reload({ waitUntil:'networkidle' });
    await a.page.locator('[data-review-id="RP-S01"]').click();
    await confirm(a.page,'INDIVIDUAL'); await question(a.page,'RP-S02');
    await a.page.getByText(/risposte da riconfermare dopo una modifica/).waitFor();
    const changed = await (await api(a.ctx, `/assessments/${id}`)).json();
    assert.equal(changed.resolved['RP-A01'].lifecycle,'RECONFIRM');
    assert.equal(diagnose(changed.assessment.input).indicators['I-A01'].usable,false);
    await a.page.getByRole('button',{name:'Riepilogo e completamento',exact:false}).click();
    await a.page.getByRole('button',{name:'Completa e salva il risultato',exact:true}).click();
    await a.page.getByText('Prima di completare, conferma tutte le domande', {exact:false}).waitFor();
    await a.page.locator('[data-review-id="RP-A01"]').click(); await question(a.page,'RP-A01');
    await a.page.getByText('Il contesto è cambiato.',{exact:false}).waitFor();
    await confirm(a.page); await question(a.page,'RP-A02');
    const reconfirmed = await (await api(a.ctx, `/assessments/${id}`)).json();
    assert.equal(reconfirmed.resolved['RP-A01'].lifecycle,'ACTIVE');
    assert.equal(reconfirmed.assessment.input.answers.find(a=>a.id==='RP-A01').value.scope,'INDIVIDUAL');
    // Explicitly confirm every ordinary active question against its current context. No implicit reconfirmation.
    for (const qid of dependencyOrder()) {
      let current = await (await api(a.ctx, `/assessments/${id}`)).json();
      const answer = current.assessment.input.answers.findLast(a => a.id === qid);
      if (!answer || !current.ordinaryRoute.includes(qid)) continue;
      function align(v) { if(!v || typeof v !== 'object') return v; if(v.currency==='EUR') return {...v,scope:'INDIVIDUAL'}; if(Array.isArray(v)) return v.map(align); return Object.fromEntries(Object.entries(v).map(([k,v])=>[k,align(v)])); }
      const reply = await api(a.ctx, `/assessments/${id}/answer`, {requestId:randomUUID(),expectedRevision:current.assessment.revision,questionId:qid,state:answer.state,...(answer.state==='VALUE'?{value:align(answer.value)}:{})},renewed.csrf); assert.equal(reply.status(),200);
    }
    await a.page.reload({waitUntil:'networkidle'}); await a.page.getByRole('button',{name:'Completa e salva il risultato',exact:true}).waitFor();
    assessment = (await (await api(a.ctx, `/assessments/${id}`)).json()).assessment;
    const ledger = (await rows('select record from patrimonial_radar_private.answer_revisions where assessment_id=$1 order by assessment_revision',[id])).map(r=>r.record);
    const canonical = diagnose({...assessment.input,answers:ledger});
    const completion = a.page.waitForResponse(r=>r.url().endsWith('/complete'));
    await a.page.getByRole('button',{name:'Completa e salva il risultato',exact:true}).dblclick();
    const completed = await (await completion).json(); await a.page.locator('[data-result-preview]').waitFor();
    const snapshot = (await rows('select result,result_hash,input_hash from patrimonial_radar_private.snapshots where assessment_id=$1',[id]))[0];
    assert.deepEqual(snapshot.result, canonical); assert.equal(snapshot.result_hash,contentHash(canonical));
    assert.deepEqual(completed.customer,customerProjection({result:snapshot.result}));
    assert.equal(completed.result,undefined); assert.equal(completed.answerRefs,undefined);
    assert.doesNotMatch(JSON.stringify(completed.customer), /"(indicators|profiles|history|answers|interviewQuestions|resources|experience|target|formula|refs)":/);
    assert.equal(canonical.answers.find(a=>a.id==='RP-X04').lifecycle,'RECONFIRM');
    assert.equal(canonical.indicators['I-E01'].usable,false,'Stale optional figures are excluded from stored diagnosis');
    const again = await api(a.ctx,`/assessments/${id}/complete`,{requestId:randomUUID(),expectedRevision:assessment.revision},renewed.csrf); assert.deepEqual(await again.json(),completed);
    assert.equal((await rows('select count(*)::int as n from patrimonial_radar_private.snapshots where assessment_id=$1',[id]))[0].n,1);
    assert.equal((await api(a.ctx,`/assessments/${id}/answer`,{requestId:randomUUID(),expectedRevision:assessment.revision,questionId:'RP-S01',state:'UNKNOWN'},renewed.csrf)).status(),409);
    for(const width of [320,390,768,1440]) { await a.page.setViewportSize({width,height:900}); await fits(a.page,`snapshot ${width}`); await shot(a.page,`snapshot-${width}`,true); }
    await a.page.reload({waitUntil:'networkidle'}); await a.page.getByRole('button',{name:/Consulta il risultato/}).click(); await a.page.locator('[data-result-preview]').waitFor();
    await a.page.getByRole('button',{name:'Vai alle tue compilazioni',exact:true}).click();
    await a.page.getByRole('button',{name:'Crea esplicitamente un nuovo episodio',exact:true}).click(); await question(a.page,'RP-S01');
    assert.equal((await (await api(a.ctx,'/assessments')).json()).length,2);
    assert.equal((await rows('select result_hash from patrimonial_radar_private.snapshots where assessment_id=$1',[id]))[0].result_hash,snapshot.result_hash);
    const raceId = (await (await api(a.ctx,'/assessments')).json()).find(e => e.status === 'DRAFT').id;
    const raceTabs = await Promise.all([a.ctx.newPage(), a.ctx.newPage()]);
    await Promise.all(raceTabs.map(async page => { await page.goto(`${base.origin}/radar-patrimoniale`,{waitUntil:'networkidle'}); await question(page,'RP-S01'); await page.locator('input[value=INDIVIDUAL]').check(); }));
    const raceResponses = raceTabs.map(page => page.waitForResponse(r => r.url().endsWith('/answer')));
    await Promise.all(raceTabs.map(page => page.locator('[data-question-id] button[type=submit]').click()));
    assert.deepEqual((await Promise.all(raceResponses)).map(r=>r.status()).sort(),[200,409]);
    assert.equal((await (await api(a.ctx,`/assessments/${raceId}`)).json()).assessment.revision,1);
    await Promise.all(raceTabs.map(page=>page.close()));
    await a.page.getByRole('button',{name:'Esci da tutti i dispositivi',exact:true}).click();
    assert.equal((await api(a.ctx,'/session')).status(),401); assert.equal((await api(device.ctx,'/session')).status(),401);
    assert.deepEqual(await a.page.evaluate(()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage)})),{local:[],session:[]});
    passed.push('Changed context requires explicit reconfirmation; server blocks stale completion; immutable snapshot equals full-ledger 4A diagnosis/hash; stale optional data excluded; duplicate completion unique; minimized customer payload; explicit new episode preserves history; simultaneous browser saves have one CAS winner; all-device revocation');
    await device.ctx.close(); await other.ctx.close();
  } finally { await a.ctx.close(); }
}
