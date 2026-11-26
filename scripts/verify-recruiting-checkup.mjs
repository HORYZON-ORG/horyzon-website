import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createElement } from 'react';
import { Document, Page, Text, renderToBuffer } from '@react-pdf/renderer';
import { zipSync, strToU8 } from 'fflate';
import { MemoryAnnunci10xPersistenceAdapter, MockAnnunci10xProvider, createAnonymousAnalyzeSession, startAnnunci10xAnalysisRun, runAnnunci10xAnalysisRun, saveAnnunci10xLeadContact, requestAnnunci10xEmailVerification, verifyAnnunci10xEmailCode, MockAnnunci10xEmailProvider, buildResendScoreReportPayload } from '../src/lib/annunci-10x/index.ts';
import { sealCheckupSession, openCheckupSession, processCheckupQueue } from '../src/lib/annunci-10x/checkup-queue.ts';
import { verifyCalendlySignature, reconcileCheckupBooking } from '../src/lib/annunci-10x/checkup-booking.ts';
import { renderCheckupPdf } from '../src/lib/annunci-10x/checkup-pdf.ts';
import { prepareCheckup, readCheckup, checkupScore } from '../src/lib/annunci-10x/checkup.ts';
import { buildCheckupRoleCard } from '../src/lib/annunci-10x/checkup-facts.ts';
import { normalizeCheckupContact } from '../src/lib/annunci-10x/checkup-contact.ts';
import { extractCheckupFile } from '../src/lib/annunci-10x/checkup-file.ts';
import { validateRoleCard } from '../src/lib/annunci-10x/validation.ts';
process.env.ANNUNCI10X_EMAIL_VERIFICATION_PEPPER = randomUUID() + randomUUID();
process.env.ANNUNCI10X_SCORE_REPORT_EMAIL_ENABLED = '0';
const ad = `Cerchiamo un addetto customer care per la sede di Bari. La persona gestirà richieste clienti, ticket e aggiornamento CRM. Contratto part-time, presenza in sede, affiancamento iniziale. Requisiti: italiano scritto chiaro, precisione, disponibilità al lavoro su turni. Candidatura via email con CV aggiornato.`;
// Real-provider regression: a valid paraphrase must retain the exact source evidence.
const paraphrasedDuties = buildCheckupRoleCard(ad, { extractedFacts: [{ targetPath: 'responsibilities', value: 'Gestire richieste clienti, ticket e aggiornamento CRM.', source: 'EXTRACTED', evidence: '"La persona gestirà richieste clienti, ticket e aggiornamento CRM."', confidence: 0.95 }], possibleConflicts: [] });
assert.equal(validateRoleCard(paraphrasedDuties).ok, true);
assert.equal(paraphrasedDuties.responsibilities[0].value, 'La persona gestirà richieste clienti, ticket e aggiornamento CRM.');
const requirementsSentence = 'Cerchiamo una persona con almeno un anno di esperienza nel servizio clienti, italiano scritto e parlato chiaro, uso di email, fogli di calcolo e CRM, precisione e capacità di organizzare le priorità.';
const requirementsExtraction = { targetPath: 'requirements', value: 'Almeno un anno di esperienza nel servizio clienti; italiano scritto e parlato chiaro; uso di email, fogli di calcolo e CRM; precisione; capacità di organizzare le priorità.', source: 'EXTRACTED', evidence: requirementsSentence, confidence: 0.95 };
const paraphrasedRequirements = buildCheckupRoleCard(requirementsSentence, { extractedFacts: [requirementsExtraction], possibleConflicts: [] });
assert.equal(paraphrasedRequirements.requirements[0].label.value, requirementsSentence, 'paraphrased requirements must retain the exact original evidence');
assert.equal(paraphrasedRequirements.requirements[0].label.publishable, true);
const unsupportedRequirements = buildCheckupRoleCard(ad, { extractedFacts: [{ ...requirementsExtraction, evidence: 'Esperienza pluriennale richiesta.' }], possibleConflicts: [] });
assert.equal(unsupportedRequirements.requirements.some(r => /pluriennale/.test(r.label.value)), false, 'evidence absent from the source must not become a requirement');
const unspecifiedDuties = buildCheckupRoleCard('Cerchiamo un addetto customer care. Candidatura via email.', { extractedFacts: [], possibleConflicts: [] });
assert.equal(validateRoleCard(unspecifiedDuties).ok, true);
assert.equal(unspecifiedDuties.responsibilities[0].source, 'SYSTEM_INFERRED');
assert.equal(unspecifiedDuties.responsibilities[0].publishable, false);
const negativeConditions = buildCheckupRoleCard('Cerchiamo un addetto customer care. Contratto part-time, smart working non previsto. Requisiti: italiano scritto chiaro; gradita esperienza. Candidatura via email.', { extractedFacts: [], possibleConflicts: [] });
assert.equal(negativeConditions.attractionContext.workMode, undefined);
assert.match(negativeConditions.attractionContext.contractType.value, /smart working non previsto/);
assert.equal(negativeConditions.requirements.find(r => /gradita/.test(r.label.value)).classification, 'PREFERRED');
const valid = { phone: '02 1234 5678', roleSought: 'Addetto customer care', difficulty: 'FEW_APPLICATIONS' };
assert.equal(normalizeCheckupContact(valid, 'test@example.com').phone, '+390212345678');
assert.equal(normalizeCheckupContact({ ...valid, phone: '0041 44 668 18 00' }, 'test@example.com').phoneStatus, 'ENTERED');
for (const phone of ['foo', '123', '+39 12345', '02 1234 5678 ext 123']) assert.throws(() => normalizeCheckupContact({ ...valid, phone }, 'test@example.com'));
assert.equal(checkupScore(null), 'N/D'); assert.equal(checkupScore(67), '6,7/10');
assert.equal(await extractCheckupFile(new File([ad], 'annuncio.txt')), ad);
const sourcePdf = await renderToBuffer(createElement(Document, null, createElement(Page, null, createElement(Text, null, ad))));
assert.match(await extractCheckupFile(new File([sourcePdf], 'annuncio.pdf')), /customer care/);
await assert.rejects(() => extractCheckupFile(new File(['%PDF-1.4 broken'], 'annuncio.pdf')));
await assert.rejects(() => extractCheckupFile(new File([ad], 'annuncio.exe')));
await assert.rejects(() => extractCheckupFile(new File([new Uint8Array(3_000_001)], 'big.txt')));
const docx = zipSync({ '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'), 'word/document.xml': strToU8(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${ad}</w:t></w:r></w:p></w:body></w:document>`) });
assert.match(await extractCheckupFile(new File([docx], 'annuncio.docx')), /customer care/);
const calls = [];
const provider = new MockAnnunci10xProvider('success');
const originalGenerate = provider.executeStructuredTask.bind(provider);
provider.executeStructuredTask = async (...args) => {
  calls.push(args[0]);
  const result = await originalGenerate(...args);
  if (args[0].outputSchemaName === 'annunci10x_checkup_comparison') {
    const modify = (output, text) => ({ checks: output.checks.map(c => ({ ...c, score: c.id === '10' ? 2 : text.includes('Il lavoro, in breve') ? 6 : 8, status: 'EVALUATED', missing: [] })) });
    const pair = args[0].input.checkupComparison;
    return { ...result, output: { a: modify(result.output.a,pair.a.target.text), b: modify(result.output.b,pair.b.target.text) } };
  }
  if (args[0].operationType === 'EVALUATE') {
    return { ...result, output: { ...result.output, checks: result.output.checks.map(c => ({ ...c, score: c.id === '10' ? 2 : 8, status: 'EVALUATED', missing: [] })) } };
  }
  // Reproduce the real classifier refusal: missing conditions must be evaluated.
  return args[0].operationType === 'PRECHECK'
    ? { ...result, output: { detectedType: 'INCOMPLETE_AD', confidence: 90, reason: 'Company and compensation are missing.', canRunFullAnalysis: false } }
    : result;
};
const context = { persistence: new MemoryAnnunci10xPersistenceAdapter(), provider, configuredProvider: 'MOCK' };
const created = await createAnonymousAnalyzeSession(context);
const session = { sessionId: created.session.id, sessionSecret: created.sessionSecret };
const started = await startAnnunci10xAnalysisRun({ session, source: { kind: 'PASTED_TEXT', text: ad }, context, requestNonce: 'synthetic-checkup-test', evaluationMode: 'V2_PUBLIC' });
const same = await startAnnunci10xAnalysisRun({ session, source: { kind: 'PASTED_TEXT', text: ad }, context, requestNonce: 'synthetic-checkup-test', evaluationMode: 'V2_PUBLIC' });
assert.equal(same.run.id, started.run.id);
await context.persistence.updateAnalysisRun({ analysisRunId: started.run.id, sessionSecret: session.sessionSecret, retrievalMetadata: { ...started.run.retrievalMetadata, checkupVersion: 'recruiting-checkup-v1', attribution: { utm_source: 'synthetic-test' } } });
let run;
for (let i = 0; i < 10; i++) { run = await runAnnunci10xAnalysisRun({ session, context, analysisRunId: started.run.id }); if (run?.status === 'READY' || run?.status === 'FAILED') break; }
assert.equal(run.status, 'READY', JSON.stringify(run.errorPayload));
const input = { session, context, analysisRunId: run.id };
await assert.rejects(() => prepareCheckup(input), /Verifica/);
await saveAnnunci10xLeadContact({ session, context, firstName: 'Ada', lastName: 'Test sintetico', email: 'ada.checkup@example.com', companyName: 'Azienda dimostrativa', businessRole: null, marketingConsent: false });
const emailProvider = new MockAnnunci10xEmailProvider();
await requestAnnunci10xEmailVerification({ session, context, provider: emailProvider, requestFingerprint: 'test', env: process.env });
await assert.rejects(() => verifyAnnunci10xEmailCode({ session, context, code: '000000', analysisRunId: run.id, requestFingerprint: 'test', env: process.env }));
await verifyAnnunci10xEmailCode({ session, context, code: emailProvider.sent[0].code, analysisRunId: run.id, requestFingerprint: 'test', env: process.env });
const lead = await context.persistence.getLead(session.sessionId, session.sessionSecret);
await context.persistence.appendAnswer({ ...session, interviewStep: 'ROLE', questionId: `checkup-contact:${run.id}`, rawAnswer: JSON.stringify(normalizeCheckupContact(valid, lead.emailNormalized)) });
const env = { ANNUNCI10X_SCORE_REPORT_EMAIL_ENABLED: '1', ANNUNCI10X_EMAIL_VERIFICATION_PEPPER: process.env.ANNUNCI10X_EMAIL_VERIFICATION_PEPPER };
let failEmail = true;
const flaky = { kind: 'MOCK', sendScoreReport: async data => { if (failEmail) throw Error('synthetic mail failure'); return emailProvider.sendScoreReport(data); } };
const first = await prepareCheckup({ ...input, env, provider: flaky });
assert.equal(first.status, 'EMAIL_ERROR'); assert.ok(first.report && first.pdfBase64);
assert.equal(first.report.before.score, (17 * 8 + 2) / 18 * 10, 'exclude unavailable channel checks without capping the mean at 69');
assert.equal(first.report.after.score, first.report.before.score);
assert.equal(first.report.rewriteSelection.kind, 'ORIGINAL');
assert.equal(first.report.rewriteSelection.evaluatedRewriteScore, (17 * 6 + 2) / 18 * 10);
assert.equal(first.report.improvedText, ad, 'a worse candidate must not be presented as an improved text');
assert.equal(first.report.improvementPlan.priorities[0].checkId, '10');
const afterCalls = calls.length;
failEmail = false;
const [a, b] = await Promise.all([prepareCheckup({ ...input, env, provider: flaky }), prepareCheckup({ ...input, env, provider: flaky })]);
assert.equal(a.status, 'EMAIL_ACCEPTED'); assert.equal(b.status, 'EMAIL_ACCEPTED');
assert.equal(emailProvider.sentScoreReports.length, 1); assert.equal(calls.length, afterCalls);
const saved = await readCheckup(input);
assert.equal(saved.receipt.report.originalText, ad); assert.equal(saved.receipt.report.before.checks.length, 20); assert.equal(saved.receipt.report.after.checks.length, 20);
assert.equal(saved.receipt.pdfBase64, first.pdfBase64);
const delivered = emailProvider.sentScoreReports[0];
const payload = buildResendScoreReportPayload({ ...delivered, from: 'Test <noreply@example.com>' });
assert.ok(payload.attachments[0].content.startsWith('JVBER'));
assert.match(payload.text, /15 minuti/); assert.doesNotMatch(payload.text, /49 €|9 euro|validazione/); assert.match(payload.text, /facoltativa/);
assert.match(payload.text, /Testo consigliato \(originale\)/);
assert.match(payload.text, /La riscrittura valutata ha ottenuto/);
assert.doesNotMatch(saved.receipt.report.improvedText, /€|euro|benefit|smart working|N\/D|da chiarire|di gestirà/i);
assert.match(saved.receipt.report.improvedText, /email con CV/i);
const unowned = await createAnonymousAnalyzeSession(context);
await assert.rejects(() => readCheckup({ ...input, session: { sessionId: unowned.session.id, sessionSecret: unowned.sessionSecret } }));
const token = sealCheckupSession(session, run.id);
assert.deepEqual(openCheckupSession(token, run.id), session);
assert.throws(() => openCheckupSession(token, randomUUID()));
const current = await context.persistence.getAnalysisRun(run.id, session.sessionSecret);
await context.persistence.updateAnalysisRun({ analysisRunId: run.id, sessionSecret: session.sessionSecret, retrievalMetadata: { ...current.retrievalMetadata, checkupQueueToken: token } });
await processCheckupQueue(context, env);
assert.equal((await context.persistence.getAnalysisRun(run.id, session.sessionSecret)).retrievalMetadata.checkupQueueDone, true);
const body = JSON.stringify({ event: 'invitee.created', payload: { email: lead.emailNormalized, uri: 'https://api.calendly.com/scheduled_events/test/invitees/synthetic', tracking: { utm_content: run.id } } });
const signingKey = randomUUID() + randomUUID();
const timestamp = Math.floor(Date.now()/1000);
const signature = createHmac('sha256', signingKey).update(`${timestamp}.${body}`).digest('hex');
assert.equal(verifyCalendlySignature(body, `t=${timestamp},v1=${signature}`, signingKey), true);
assert.equal(verifyCalendlySignature(body + ' ', `t=${timestamp},v1=${signature}`, signingKey), false);
assert.equal(verifyCalendlySignature(body, `t=${timestamp},v1=${signature}`, signingKey, Date.now()+181000), false);
assert.equal(await reconcileCheckupBooking(JSON.parse(body), context.persistence), 'RECORDED');
assert.equal(await reconcileCheckupBooking(JSON.parse(body), context.persistence), 'DUPLICATE');
assert.equal(await reconcileCheckupBooking({ event: 'invitee.created', payload: { email: 'other@example.com', uri: 'https://api.calendly.com/scheduled_events/test/invitees/other', tracking: { utm_content: run.id } } }, context.persistence), 'UNMATCHED');
// A new job advances through the persisted queue without any browser polling.
const queuedOwner = await createAnonymousAnalyzeSession(context);
const queuedSession = { sessionId: queuedOwner.session.id, sessionSecret: queuedOwner.sessionSecret };
const queued = await startAnnunci10xAnalysisRun({ session: queuedSession, source: { kind: 'PASTED_TEXT', text: ad }, context, requestNonce: 'queued-synthetic-test', evaluationMode: 'V2_PUBLIC' });
await context.persistence.updateAnalysisRun({ analysisRunId: queued.run.id, sessionSecret: queuedSession.sessionSecret, retrievalMetadata: { ...queued.run.retrievalMetadata, checkupVersion: 'recruiting-checkup-v1', checkupQueueToken: sealCheckupSession(queuedSession, queued.run.id) } });
for (let i=0; i<6; i++) await processCheckupQueue(context, { ANNUNCI10X_SCORE_REPORT_EMAIL_ENABLED: '0', ANNUNCI10X_EMAIL_VERIFICATION_PEPPER: process.env.ANNUNCI10X_EMAIL_VERIFICATION_PEPPER });
assert.equal((await context.persistence.getAnalysisRun(queued.run.id, queuedSession.sessionSecret)).status, 'READY');
for (const [detectedType, canRunFullAnalysis, checkup] of [
  ['NOT_JOB_AD', true, true], ['UNUSABLE', true, true], ['SOCIAL_TEASER', false, true], ['INCOMPLETE_AD', false, false],
]) {
  const rejectedProvider = new MockAnnunci10xProvider();
  const execute = rejectedProvider.executeStructuredTask.bind(rejectedProvider);
  rejectedProvider.executeStructuredTask = async request => {
    const result = await execute(request);
    return request.operationType === 'PRECHECK'
      ? { ...result, output: { detectedType, confidence: 90, reason: 'Readiness regression case.', canRunFullAnalysis } }
      : result;
  };
  const rejectedContext = { persistence: new MemoryAnnunci10xPersistenceAdapter(), provider: rejectedProvider, configuredProvider: 'MOCK' };
  const owner = await createAnonymousAnalyzeSession(rejectedContext);
  const rejectedSession = { sessionId: owner.session.id, sessionSecret: owner.sessionSecret };
  const attempt = await startAnnunci10xAnalysisRun({ session: rejectedSession, source: { kind: 'PASTED_TEXT', text: ad }, context: rejectedContext, evaluationMode: 'V2_PUBLIC' });
  if (checkup) await rejectedContext.persistence.updateAnalysisRun({ analysisRunId: attempt.run.id, sessionSecret: rejectedSession.sessionSecret, retrievalMetadata: { checkupVersion: 'recruiting-checkup-v1' } });
  const rejected = await runAnnunci10xAnalysisRun({ session: rejectedSession, context: rejectedContext, analysisRunId: attempt.run.id });
  assert.equal(rejected.status, 'FAILED', `${detectedType}, checkup=${checkup}: invalid sources and other flows retain their guard`);
}
await mkdir('output/recruiting-checkup-qa', { recursive: true });
await writeFile('output/recruiting-checkup-qa/checkup-esempio-sintetico.pdf', await renderCheckupPdf({ ...first.report, example: true }));
await writeFile('output/recruiting-checkup-qa/report-sintetico.json', JSON.stringify(first.report, null, 2));
await writeFile('output/recruiting-checkup-qa/email-esempio.html', payload.html);
console.log('PASS: phone normalization; TXT/DOCX and malformed files; request reuse; OTP; same 20 criteria; complete PDF; email retry; concurrent reload without repeated generation/send; ownership; optional call; encrypted background queue; signed booking reconciliation and deduplication. All external providers mocked.');
