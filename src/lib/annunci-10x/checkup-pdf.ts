import { createElement as h } from 'react';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Document, Page, Text, View, Link, Image, Svg, Path, Circle, Rect, Line, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import type { CheckupReport } from './checkup.ts';
import { checkupScore } from './checkup.ts';
import { checkupCalendarUrl, CHECKUP_INVITATION } from './checkup-copy.ts';
import { CHECKUP_SCORE_EXPLANATION } from './checkup-improvements.ts';
import type { Annunci10xScoreReport } from './score-report-email.ts';

const s = StyleSheet.create({
  page: { padding: 42, paddingTop: 108, paddingBottom: 58, fontFamily: 'Helvetica', fontSize: 10, lineHeight: 1.45, color: '#163638' },
  header: { position: 'absolute', top: 28, left: 42, right: 42, height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.7, borderBottomColor: '#dbe1df', paddingBottom: 14 },
  logo: { width: 154, height: 36 },
  brand: { fontSize: 8, letterSpacing: 1.4, color: '#486467', textAlign: 'right', lineHeight: 1.6 },
  section: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  icon: { width: 30, height: 30, padding: 6, borderRadius: 7, backgroundColor: '#edf2e5' },
  title: { fontSize: 23, fontFamily: 'Helvetica-Bold', lineHeight: 1.16, marginBottom: 12 },
  heading: { fontSize: 17, fontFamily: 'Helvetica-Bold', marginBottom: 12 },
  sub: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 5 },
  p: { marginBottom: 10 },
  scores: { flexDirection: 'row', gap: 12, marginTop: 10, marginBottom: 14 },
  card: { width: '50%', padding: 14, backgroundColor: '#f0f3ed', borderRadius: 8 },
  cardAfter: { backgroundColor: '#edf2d7', borderWidth: 0.7, borderColor: '#c9d66a' },
  score: { fontSize: 30, lineHeight: 1.2, fontFamily: 'Helvetica-Bold' },
  track: { height: 5, backgroundColor: '#d6dfd8', borderRadius: 3, marginTop: 10 },
  bar: { height: 5, backgroundColor: '#486467', borderRadius: 3 },
  row: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: '#dbe1df' },
  label: { width: '48%', paddingRight: 10 },
  cell: { width: '26%' },
  check: { marginBottom: 7, fontSize: 9.3, lineHeight: 1.3, borderBottomWidth: 0.5, borderBottomColor: '#dbe1df', paddingBottom: 7 },
  checkHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  checkNumber: { width: 25, paddingVertical: 3, textAlign: 'center', fontSize: 9, backgroundColor: '#edf2e5', borderRadius: 4, fontFamily: 'Helvetica-Bold' },
  checkTitle: { flexGrow: 1, flexShrink: 1, fontSize: 10, lineHeight: 1.25, fontFamily: 'Helvetica-Bold', paddingTop: 2 },
  checkScores: { width: 124, flexDirection: 'row', gap: 8 },
  checkScore: { width: 58, textAlign: 'right', fontSize: 9.5, lineHeight: 1.2, paddingTop: 2, color: '#486467' },
  scoreLabel: { fontSize: 7.5, marginBottom: 1 },
  reasons: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  reason: { width: '49%' },
  summary: { fontSize: 9, marginBottom: 6 },
  action: { padding: 14, marginBottom: 15, borderWidth: 0.7, borderColor: '#dbe1df', borderRadius: 6, backgroundColor: '#f8faf5' },
  invitation: { marginTop: 12, paddingTop: 12, borderTopWidth: 0.7, borderTopColor: '#dbe1df' },
  footer: { position: 'absolute', left: 42, right: 42, bottom: 23, height: 20, paddingTop: 7, borderTopWidth: 0.5, borderTopColor: '#dbe1df', flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, lineHeight: 1.2, color: '#627577' },
  link: { color: '#163638', backgroundColor: '#d5e04d', padding: 14, marginTop: 12, marginBottom: 14, borderRadius: 5, fontFamily: 'Helvetica-Bold' },
});
type IconName = 'document' | 'check' | 'rewrite' | 'compare' | 'phone';
function icon(name: IconName) {
  const line = { stroke: '#163638', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<IconName, React.ReactNode[]> = {
    document: [h(Path, { key: 'sheet', d: 'M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6', ...line })],
    check: [h(Circle, { key: 'circle', cx: 12, cy: 12, r: 9, ...line }), h(Path, { key: 'tick', d: 'm8 12 3 3 5-6', ...line })],
    rewrite: [h(Path, { key: 'pencil', d: 'm5 16 10-10 3 3L8 19H5z M13 8l3 3 M4 22h16', ...line })],
    compare: [h(Rect, { key: 'left', x: 3, y: 12, width: 4, height: 9, rx: 1, ...line }), h(Rect, { key: 'middle', x: 10, y: 8, width: 4, height: 13, rx: 1, ...line }), h(Rect, { key: 'right', x: 17, y: 3, width: 4, height: 18, rx: 1, ...line })],
    phone: [h(Path, { key: 'phone', d: 'M7 3H4c-2 9 7 18 16 16v-4l-5-2-2 2-4-4 2-2z', ...line }), h(Line, { key: 'ring', x1: 16, y1: 4, x2: 20, y2: 8, ...line })],
  };
  return h(Svg, { viewBox: '0 0 24 24', width: 18, height: 18 }, ...paths[name]);
}
const clean = (t: string) => t.replace(/→/g, 'a').replace(/[\u2010-\u2015]/g, '-').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const p = (t: string) => h(Text, { style: s.p }, clean(t));
function page(logo: Buffer, title: string, symbol: IconName, children: React.ReactNode[]) {
  return h(Page, { size: 'A4', style: s.page, wrap: true },
    h(View, { style: s.header, fixed: true }, h(Image, { src: { data: logo, format: 'png' }, style: s.logo }), h(Text, { style: s.brand }, 'RECRUITING\nCHECK-UP ANNUNCIO')),
    h(View, { style: s.section, wrap: false }, h(View, { style: s.icon }, icon(symbol)), h(Text, { style: { ...s.heading, marginBottom: 0, flexShrink: 1 } }, title)), ...children,
    h(View, { style: s.footer, fixed: true }, h(Text, null, 'HORYZON Recruiting | Check-up gratuito'), h(Text, null, 'horyzon.it')));
}
function comparisonGrid(before: Annunci10xScoreReport, after: Annunci10xScoreReport, afterLabel: string) {
  const afterById = new Map(after.checks.map(c => [c.checkId, c]));
  return before.checks.map(c => {
    const next = afterById.get(c.checkId);
    const reason = next?.reason ?? 'Valutazione non disponibile.';
    const beforeAction = c.status !== 'NOT_EVALUABLE' && c.score !== 10 ? c.improvement : '';
    const afterAction = next && next.status !== 'NOT_EVALUABLE' && next.score !== 10 ? next.improvement : '';
    return h(View, { key: c.checkId, style: s.check, wrap: false },
      h(View, { style: s.checkHeading }, h(Text, { style: s.checkNumber }, c.checkId), h(Text, { style: s.checkTitle }, c.label),
        h(View, { style: s.checkScores }, ...[{ label: 'Originale', check: c }, { label: afterLabel, check: next }].map(({ label, check }) => h(View, { key: label, style: s.checkScore },
          h(Text, { style: s.scoreLabel }, label), h(Text, null, !check || check.score === null ? check?.statusLabel ?? 'N/D' : `${check.score}/10`))))),
      c.reason === reason
        ? h(Text, { style: { marginBottom: 4 } }, clean(`Motivazione comune: ${c.reason}`))
        : h(View, { style: s.reasons }, h(Text, { style: s.reason }, clean(`Originale: ${c.reason}`)), h(Text, { style: s.reason }, clean(`${afterLabel}: ${reason}`))),
      beforeAction && beforeAction === afterAction
        ? h(Text, null, clean(`Da approfondire: ${beforeAction}`))
        : h(View, null, ...(beforeAction ? [h(Text, { key: 'before' }, clean(`Da approfondire nell’originale: ${beforeAction}`))] : []), ...(afterAction ? [h(Text, { key: 'after' }, clean(`Da approfondire nel testo ${afterLabel.toLowerCase()}: ${afterAction}`))] : [])));
  });
}
export async function renderCheckupPdf(report: CheckupReport): Promise<Buffer> {
  const logo = await readFile(join(process.cwd(), 'public/horyzon-logo-canonical.png'));
  const keptOriginal = report.rewriteSelection?.kind === 'ORIGINAL';
  const afterLabel = keptOriginal ? 'Testo consigliato: originale' : report.rewriteSelection ? 'Testo consigliato' : 'Proposta migliorata';
  const comparison = h(View, { style: s.scores }, ...[{ label: 'Testo attuale', value: report.before.score }, { label: afterLabel, value: report.after.score }].map(({ label, value }, i) => h(View, { key: label, style: i ? [s.card, s.cardAfter] : s.card }, h(Text, null, label), h(Text, { style: s.score }, checkupScore(value)), h(View, { style: s.track }, h(View, { style: [s.bar, { width: `${Math.min(100, Math.max(0, value ?? 0))}%`, ...(i ? { backgroundColor: '#94a936' } : {}) }] })))));
  const doc = h(Document, { title: `Check-up annuncio - ${report.roleTitle}`, author: 'HORYZON Recruiting', creationDate: new Date(report.createdAt), modificationDate: new Date(report.createdAt) },
    page(logo, 'Il check-up del tuo annuncio', 'compare', [...(report.example ? [h(Text, { style: { ...s.summary, fontSize: 7.5 } }, 'FACSIMILE - Annuncio fittizio e valutazioni simulate, solo a scopo dimostrativo.')] : []), h(Text, { style: s.title }, clean(report.roleTitle)), comparison,
      h(Text, { style: s.summary }, report.scoreMethod ? CHECKUP_SCORE_EXPLANATION : 'Stessa griglia V2 di 20 controlli per entrambi i testi. Il voto su 10 è il punteggio su 100 diviso 10; N/D indica un criterio non valutabile. Le informazioni mancanti restano distinte.'),
      h(Text, { style: s.summary }, `Copertura: originale ${report.before.coverage}%; ${report.rewriteSelection ? 'testo consigliato' : 'proposta'} ${report.after.coverage}%.`),
      h(View, { style: s.row }, h(Text, { style: s.label }, 'Area'), h(Text, { style: s.cell }, 'Originale'), h(Text, { style: s.cell }, report.rewriteSelection ? 'Consigliato' : 'Proposta')),
      ...report.before.areaScores.map((a, i) => h(View, { style: s.row, key: a.id }, h(Text, { style: s.label }, a.label), h(Text, { style: s.cell }, checkupScore(a.score)), h(Text, { style: s.cell }, checkupScore(report.after.areaScores[i].score)))),
      ...(report.improvementPlan?.priorities.length ? [h(Text, { style: { ...s.sub, marginTop: 10 } }, 'Le priorità da cui partire'), ...report.improvementPlan.priorities.map((c, i) => h(Text, { key: c.checkId, style: s.summary }, clean(`${i + 1}. ${c.title}: ${c.toAdd}`)))] : []),
      h(Text, { style: { ...s.summary, marginTop: 6 } }, 'Il punteggio valuta chiarezza e completezza del testo. Non misura la qualità dell’azienda o delle persone e non garantisce candidature o assunzioni.')]),
    ...(report.improvementPlan ? [page(logo, 'Come fare un salto concreto', 'rewrite', [
      ...(report.rewriteSelection ? [p(report.rewriteSelection.explanation)] : []),
      p(report.improvementPlan.summary),
      ...report.improvementPlan.priorities.map((c, i) => h(View, { key: c.checkId, style: s.action, wrap: false },
        h(Text, { style: s.sub }, clean(`${i + 1}. ${c.title} - oggi ${c.currentScore}/10`)),
        p(`Valutazione attuale: ${c.currentGap}`),
        p(`Da aggiungere: ${c.toAdd}`),
        p(`Perché conta: ${c.why}`),
        p(`Chiedi all’azienda:\n${c.questions.map(q => `- ${q}`).join('\n')}`),
        p(`Traccia da completare con dati confermati:\n${c.draft}`))),
      p(report.improvementPlan.nextStep),
    ])] : []),
    page(logo, 'Il tuo annuncio originale', 'document', [p(report.originalText)]),
    ...(!keptOriginal || report.improvedText !== report.originalText ? [page(logo, 'La possibile versione migliorata', 'rewrite', [p(report.improvedText), p('La proposta usa i fatti disponibili: non aggiunge compensi, benefit, requisiti o promesse assenti dal testo. Verifica le informazioni prima della pubblicazione.')])] : []),
    ...(!report.improvementPlan ? [page(logo, 'Che cosa cambia e che cosa approfondire', 'compare', [
      ...((report.changes.length ? report.changes : ['I punteggi restano invariati: una diversa formulazione non comporta automaticamente un voto maggiore.']).map(p)),
      h(Text, { style: s.heading }, 'Informazioni utili da chiarire'),
      ...(report.missingInformation.length ? report.missingInformation : ['Non emergono ulteriori informazioni mancanti dai controlli effettuati.']).map(p),
    ])] : []),
    page(logo, 'I 20 criteri: confronto completo', 'check', [
      p(keptOriginal ? 'Il testo consigliato coincide con l’originale: i due voti e le motivazioni si riferiscono allo stesso testo.' : 'Per ogni criterio trovi i due voti. Le motivazioni identiche sono riportate una sola volta; quelle diverse restano affiancate.'),
      ...(report.changes.length ? [h(Text, { style: s.sub }, 'Che cosa cambia'), ...report.changes.map(text => h(Text, { key: text, style: s.summary }, clean(text)))] : []),
      ...comparisonGrid(report.before, report.after, report.rewriteSelection ? 'Consigliato' : 'Proposta'),
      h(View, { style: s.invitation, wrap: false },
        h(View, { style: { ...s.checkHeading, alignItems: 'center' } }, icon('phone'), h(Text, { style: { ...s.sub, marginBottom: 0 } }, 'Un ulteriore passo, se lo desideri')),
        p(CHECKUP_INVITATION[2]),
        h(Link, { src: checkupCalendarUrl(report.analysisRunId), style: s.link }, CHECKUP_INVITATION[3]),
        p('È una telefonata facoltativa. Il PDF è già completo e gratuito; puoi usarlo senza prenotare e senza obbligo di acquisto.'),
        h(Text, { style: s.summary }, 'Angelo Ria Chetta · Analista d’azienda specializzato nelle risorse umane')),
    ]));
  return renderToBuffer(doc);
}
