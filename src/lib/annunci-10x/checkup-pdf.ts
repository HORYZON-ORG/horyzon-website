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
  title: { fontSize: 27, fontFamily: 'Helvetica-Bold', lineHeight: 1.16, marginBottom: 16 },
  heading: { fontSize: 17, fontFamily: 'Helvetica-Bold', marginBottom: 12 },
  sub: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 5 },
  p: { marginBottom: 10 },
  scores: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 18 },
  card: { width: '50%', padding: 18, backgroundColor: '#f0f3ed', borderRadius: 8 },
  cardAfter: { backgroundColor: '#edf2d7', borderWidth: 0.7, borderColor: '#c9d66a' },
  score: { fontSize: 30, lineHeight: 1.2, fontFamily: 'Helvetica-Bold' },
  track: { height: 5, backgroundColor: '#d6dfd8', borderRadius: 3, marginTop: 10 },
  bar: { height: 5, backgroundColor: '#486467', borderRadius: 3 },
  steps: { flexDirection: 'row', gap: 10, marginTop: 6, marginBottom: 20 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 6, flexGrow: 1, fontSize: 8.5 },
  row: { flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: '#dbe1df' },
  label: { width: '48%', paddingRight: 10 },
  cell: { width: '26%' },
  check: { marginBottom: 9, fontSize: 9.3, borderBottomWidth: 0.5, borderBottomColor: '#dbe1df', paddingBottom: 8 },
  checkHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 5 },
  checkNumber: { width: 25, paddingVertical: 3, textAlign: 'center', fontSize: 9, backgroundColor: '#edf2e5', borderRadius: 4, fontFamily: 'Helvetica-Bold' },
  checkTitle: { flexGrow: 1, flexShrink: 1, fontSize: 10.5, fontFamily: 'Helvetica-Bold', paddingTop: 2 },
  checkScore: { width: 72, textAlign: 'right', fontSize: 9, paddingTop: 3, color: '#486467' },
  action: { padding: 14, marginBottom: 15, borderWidth: 0.7, borderColor: '#dbe1df', borderRadius: 6, backgroundColor: '#f8faf5' },
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
function grid(report: Annunci10xScoreReport) {
  return report.checks.map(c => h(View, { key: c.checkId, style: s.check, wrap: false },
    h(View, { style: s.checkHeading }, h(Text, { style: s.checkNumber }, c.checkId), h(Text, { style: s.checkTitle }, c.label), h(Text, { style: s.checkScore }, c.score === null ? c.statusLabel : `${c.score}/10`)),
    h(Text, { style: { marginBottom: 4 } }, clean(c.reason)), c.status !== 'NOT_EVALUABLE' && c.score !== 10 ? h(Text, null, clean(`Da approfondire: ${c.improvement}`)) : null));
}
export async function renderCheckupPdf(report: CheckupReport): Promise<Buffer> {
  const logo = await readFile(join(process.cwd(), 'public/horyzon-logo-canonical.png'));
  const comparison = h(View, { style: s.scores }, ...[{ label: 'Testo attuale', value: report.before.score }, { label: 'Proposta migliorata', value: report.after.score }].map(({ label, value }, i) => h(View, { key: label, style: i ? [s.card, s.cardAfter] : s.card }, h(Text, null, label), h(Text, { style: s.score }, checkupScore(value)), h(View, { style: s.track }, h(View, { style: [s.bar, { width: `${Math.min(100, Math.max(0, value ?? 0))}%`, ...(i ? { backgroundColor: '#94a936' } : {}) }] })))));
  const doc = h(Document, { title: `Check-up annuncio - ${report.roleTitle}`, author: 'HORYZON Recruiting', creationDate: new Date(report.createdAt), modificationDate: new Date(report.createdAt) },
    page(logo, 'Il check-up del tuo annuncio', 'compare', [...(report.example ? [p('FACSIMILE - Annuncio fittizio e valutazioni simulate, solo a scopo dimostrativo.')] : []), h(Text, { style: s.title }, clean(report.roleTitle)), p('Valutazione automatica, proposta e confronto'), comparison,
      h(View, { style: s.steps }, ...([['check', 'Valutazione'], ['rewrite', 'Riscrittura'], ['compare', 'Confronto']] as const).map(([name, label]) => h(View, { key: name, style: s.step }, icon(name), h(Text, null, label)))),
      p(report.scoreMethod ? CHECKUP_SCORE_EXPLANATION : 'Stessa griglia V2 di 20 controlli per entrambi i testi. Il voto su 10 è il punteggio su 100 diviso 10; N/D indica un criterio non valutabile. Le informazioni mancanti restano distinte.'),
      p(`Copertura: originale ${report.before.coverage}%; proposta ${report.after.coverage}%.`),
      h(View, { style: s.row }, h(Text, { style: s.label }, 'Area'), h(Text, { style: s.cell }, 'Originale'), h(Text, { style: s.cell }, 'Proposta')),
      ...report.before.areaScores.map((a, i) => h(View, { style: s.row, key: a.id }, h(Text, { style: s.label }, a.label), h(Text, { style: s.cell }, checkupScore(a.score)), h(Text, { style: s.cell }, checkupScore(report.after.areaScores[i].score)))),
      p('Il punteggio valuta chiarezza e completezza del testo. Non misura la qualità dell’azienda o delle persone e non garantisce candidature o assunzioni.'),
      ...(report.improvementPlan?.priorities.length ? [p(`Per il prossimo salto: ${report.improvementPlan.priorities.map(c => c.title).join('; ')}.`)] : [])]),
    ...(report.improvementPlan ? [page(logo, 'Come fare un salto concreto', 'rewrite', [
      p(report.improvementPlan.summary),
      ...(report.changes.length ? [h(Text, { style: s.sub }, 'Che cosa cambia con la riscrittura'), ...report.changes.map(p)] : []),
      ...report.improvementPlan.priorities.map((c, i) => h(View, { key: c.checkId, style: s.action, wrap: false },
        h(Text, { style: s.sub }, clean(`${i + 1}. ${c.title} - oggi ${c.currentScore}/10`)),
        p(`Punto da migliorare: ${c.currentGap}`),
        p(`Da aggiungere: ${c.toAdd}`),
        p(`Perché conta: ${c.why}`),
        p(`Chiedi all’azienda:\n${c.questions.map(q => `- ${q}`).join('\n')}`),
        p(`Traccia da completare con dati confermati:\n${c.draft}`))),
      p(report.improvementPlan.nextStep),
    ])] : []),
    page(logo, 'Il tuo annuncio originale', 'document', [p(report.originalText)]),
    page(logo, 'Valutazione del testo originale', 'check', grid(report.before)),
    page(logo, 'La possibile versione migliorata', 'rewrite', [p(report.improvedText), p('La proposta usa i fatti disponibili: non aggiunge compensi, benefit, requisiti o promesse assenti dal testo. Verifica le informazioni prima della pubblicazione.')]),
    page(logo, 'Valutazione della proposta', 'check', grid(report.after)),
    ...(!report.improvementPlan ? [page(logo, 'Che cosa cambia e che cosa approfondire', 'compare', [
      ...((report.changes.length ? report.changes : ['I punteggi restano invariati: una diversa formulazione non comporta automaticamente un voto maggiore.']).map(p)),
      h(Text, { style: s.heading }, 'Informazioni utili da chiarire'),
      ...(report.missingInformation.length ? report.missingInformation : ['Non emergono ulteriori informazioni mancanti dai controlli effettuati.']).map(p),
    ])] : []),
    page(logo, 'Un ulteriore passo, se lo desideri', 'phone', [...CHECKUP_INVITATION.slice(0, 3).map(p),
      h(Link, { src: checkupCalendarUrl(report.analysisRunId), style: s.link }, CHECKUP_INVITATION[3]),
      p('È una telefonata facoltativa. Il PDF è già completo e gratuito; puoi usarlo senza prenotare e senza obbligo di acquisto.'),
      p('Angelo Ria Chetta · Analista d’azienda specializzato nelle risorse umane'),
    ]));
  return renderToBuffer(doc);
}
