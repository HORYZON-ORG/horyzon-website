// PDF of the Radar report (@react-pdf/renderer, server only). Brand: petrol ink cover, cream pages, lime on ink
// chips, Manrope 800 headings, JetBrains Mono labels. Fonts and logos are read from this folder at render time
// (next.config traces them into the /api/radar functions).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Circle, Document, Font, G, Image, Line, Link, Page, Polygon, StyleSheet, Svg, Text, View, renderToBuffer } from '@react-pdf/renderer';
import type { RadarReport, ReportQuestion } from './report.ts';

const HERE = path.join(process.cwd(), 'src', 'lib', 'radar');
let fontsReady = false;
function registerFonts() {
  if (fontsReady) return;
  Font.register({ family: 'Manrope', fonts: [400, 600, 800].map((fontWeight) => ({ src: path.join(HERE, 'fonts', `manrope-latin-${fontWeight}-normal.woff`), fontWeight })) });
  Font.register({ family: 'Mono', src: path.join(HERE, 'fonts', 'jetbrains-mono-latin-500-normal.woff') });
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
}

const C = { ink: '#07171D', ink2: '#102229', cream: '#F7F4E8', sand: '#EFEDE6', lime: '#D8FF42', dot: '#D9E65F', rust: '#9D4D34', muted: '#5A6868', line: '#D9D6CB' };
const BAND_COLOR = { critico: C.rust, da_consolidare: '#8A7A1F', solido: '#4F6B12' } as const;

const s = StyleSheet.create({
  cover: { backgroundColor: C.ink, color: C.cream, padding: 48, fontFamily: 'Manrope' },
  page: { backgroundColor: C.cream, color: C.ink, paddingTop: 44, paddingBottom: 56, paddingHorizontal: 44, fontFamily: 'Manrope', fontSize: 10, lineHeight: 1.45 },
  label: { fontFamily: 'Mono', fontSize: 7.5, letterSpacing: 1.4, textTransform: 'uppercase', color: C.muted, marginBottom: 6 },
  labelLime: { fontFamily: 'Mono', fontSize: 8, letterSpacing: 1.6, textTransform: 'uppercase', color: C.lime },
  h1: { fontSize: 34, fontWeight: 800, letterSpacing: -1, lineHeight: 1.05 },
  h2: { fontSize: 20, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.25, marginBottom: 12 },
  h3: { fontSize: 12.5, fontWeight: 800, marginBottom: 3 },
  body: { fontSize: 10, color: '#23363C' },
  chip: { alignSelf: 'flex-start', backgroundColor: C.ink, color: C.lime, fontFamily: 'Mono', fontSize: 7.5, letterSpacing: 1, textTransform: 'uppercase', paddingVertical: 3, paddingHorizontal: 6, borderRadius: 3, marginBottom: 6 },
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 12, marginBottom: 8, backgroundColor: '#FFFDF5' },
  action: { marginTop: 5, paddingTop: 5, borderTopWidth: 1, borderTopColor: C.line, fontSize: 9.5 },
  runningHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -24, marginBottom: 14, fontFamily: 'Mono', fontSize: 7, color: C.muted },
});

function RadarChart({ report, size, dark }: { report: RadarReport; size: number; dark?: boolean }) {
  const c = size / 2, r = size * 0.3;
  const pt = (i: number, v: number) => { const a = ((-90 + i * 72) * Math.PI) / 180; return [c + Math.cos(a) * r * v, c + Math.sin(a) * r * v] as const; };
  const ring = (v: number) => report.areas.map((_, i) => pt(i, v).join(',')).join(' ');
  const shape = report.areas.map((area, i) => pt(i, Math.max(0.04, area.score / 100)).join(',')).join(' ');
  const grid = dark ? '#35505A' : C.line, text = dark ? C.cream : C.ink;
  return <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
    {[1, 0.75, 0.5, 0.25].map((v) => <Polygon key={v} points={ring(v)} stroke={grid} strokeWidth={0.8} fill="none" />)}
    {report.areas.map((_, i) => { const [x, y] = pt(i, 1); return <Line key={i} x1={c} y1={c} x2={x} y2={y} stroke={grid} strokeWidth={0.6} />; })}
    <Polygon points={shape} fill={dark ? C.lime : C.ink} fillOpacity={dark ? 0.22 : 0.12} stroke={dark ? C.lime : C.ink} strokeWidth={1.6} />
    {report.areas.map((area, i) => { const [x, y] = pt(i, Math.max(0.04, area.score / 100)); return <Circle key={area.id} cx={x} cy={y} r={2.6} fill={dark ? C.lime : C.ink} />; })}
    {report.areas.map((area, i) => {
      const [x, y] = pt(i, 1.22);
      return <G key={area.id}><Text x={x} y={y - 2} textAnchor="middle" style={{ fontSize: 7, fontFamily: 'Mono', fill: text }}>{area.label.toUpperCase()}</Text><Text x={x} y={y + 9} textAnchor="middle" style={{ fontSize: 10, fontWeight: 800, fill: dark ? C.lime : C.ink }}>{String(area.score)}</Text></G>;
    })}
  </Svg>;
}

function RunningHeader({ report }: { report: RadarReport }) {
  return <View style={s.runningHeader} fixed><Text>Radar d’Impresa · {report.company.aziendaNome}</Text><Text>horyzon.it</Text></View>;
}

function Bar({ score }: { score: number }) {
  return <View style={{ height: 5, backgroundColor: C.line, borderRadius: 3, marginVertical: 5 }}><View style={{ width: `${Math.max(3, score)}%`, height: 5, backgroundColor: C.ink, borderRadius: 3 }} /></View>;
}

function Gap({ item }: { item: ReportQuestion }) {
  return <View style={s.card} wrap={false}>
    <Text style={[s.label, { color: BAND_COLOR[item.band] }]}>{item.autonomy ? 'Autonomia dal titolare · ' : ''}Hai risposto: {item.answerLabel}</Text>
    <Text style={{ fontSize: 9, color: C.muted, marginBottom: 4 }}>“{item.question}”</Text>
    <Text style={s.h3}>{item.advice.title}</Text>
    <Text style={s.body}>{item.advice.body}</Text>
    <Text style={s.action}><Text style={{ fontWeight: 800 }}>Da fare: </Text>{item.advice.action}</Text>
  </View>;
}

const date = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
const euro = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

function ReportDocument({ report }: { report: RadarReport }) {
  return <Document title={`Radar d’Impresa — ${report.company.aziendaNome}`} author="Horyzon Consulting" language="it">
    <Page size="A4" style={s.cover}>
      <Image src={{ data: readFileSync(path.join(HERE, 'assets', 'logo-crema.png')), format: 'png' }} style={{ width: 150 }} />
      <View style={{ marginTop: 70 }}>
        <Text style={s.labelLime}>Radar d’Impresa · Report</Text>
        <Text style={[s.h1, { marginTop: 14, fontSize: 40 }]}>{report.company.aziendaNome}</Text>
        <Text style={{ marginTop: 10, fontSize: 11, color: '#B9C4C2' }}>{[report.company.referenteNome, report.company.settore, report.company.numeroDipendenti && `${report.company.numeroDipendenti} dipendenti`].filter(Boolean).join(' · ')}</Text>
        <Text style={{ marginTop: 4, fontSize: 9, color: '#8FA0A0', fontFamily: 'Mono' }}>{date(report.generatedAt)}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 36 }}>
        <RadarChart report={report} size={300} dark />
        <View style={{ marginLeft: 16, flex: 1 }}>
          <Text style={s.labelLime}>Indice globale</Text>
          <Text style={{ fontSize: 64, fontWeight: 800, color: C.lime, letterSpacing: -2 }}>{report.global.score}<Text style={{ fontSize: 18, color: C.cream }}>/100</Text></Text>
          <Text style={{ fontSize: 13, fontWeight: 800 }}>{report.global.reading.title}</Text>
          <Text style={{ fontSize: 9.5, color: '#B9C4C2', marginTop: 4 }}>{report.global.reading.body}</Text>
        </View>
      </View>
      <Text style={{ position: 'absolute', bottom: 40, left: 48, right: 48, fontSize: 8, color: '#8FA0A0' }}>Una fotografia guidata, basata sulle risposte date. Non è una diagnosi completa né una valutazione finanziaria, fiscale o legale.</Text>
    </Page>

    <Page size="A4" style={s.page}>
      <RunningHeader report={report} />
      <Text style={s.label}>Sintesi</Text>
      <Text style={s.h2}>Dove sei oggi</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        {[['Reparto più solido', report.strongest.label, report.strongest.score], ['Reparto prioritario', report.weakest.label, report.weakest.score], ['Organizzazione', 'Maturità dei reparti', report.organizationalMaturity]].map(([label, value, score]) =>
          <View key={String(label)} style={[s.card, { flex: 1 }]}><Text style={s.label}>{label}</Text><Text style={s.h3}>{value}</Text><Text style={{ fontSize: 18, fontWeight: 800 }}>{score}</Text></View>)}
      </View>
      <Text style={[s.label, { marginTop: 4 }]}>Prossimi 90 giorni</Text>
      <Text style={s.h2}>Le tre priorità</Text>
      {report.priorities.length ? report.priorities.map((priority, i) => <View key={priority.question} style={[s.card, { flexDirection: 'row' }]} wrap={false}>
        <Text style={{ fontSize: 22, fontWeight: 800, width: 28 }}>{i + 1}</Text>
        <View style={{ flex: 1 }}><Text style={s.label}>{priority.area}</Text><Text style={s.h3}>{priority.advice.title}</Text><Text style={s.body}>{priority.advice.action}</Text></View>
      </View>) : <Text style={s.body}>Nessuna risposta sotto “Molto”: lavora sulla crescita del reparto prioritario.</Text>}
      <Text style={[s.label, { marginTop: 10 }]}>Gli indici</Text>
      <View style={s.card} wrap={false}>
        <Text style={s.chip}>Autonomia dal titolare · {report.autonomy.score}/100</Text>
        <Text style={s.h3}>{report.autonomy.reading.title}</Text><Text style={s.body}>{report.autonomy.reading.body}</Text>
        <Text style={[s.body, { marginTop: 5 }]}>{report.autonomy.gapReading}</Text>
        <Text style={s.action}><Text style={{ fontWeight: 800 }}>Da fare: </Text>{report.autonomy.reading.action}</Text>
      </View>
      {report.economics ? <View style={s.card} wrap={false}>
        <Text style={s.chip}>Utile per ora lavorata · {euro(report.economics.hourlyProfit)}</Text>
        <Text style={s.h3}>{report.economics.reading.title}</Text><Text style={s.body}>{report.economics.reading.body}</Text>
        <Text style={[s.body, { marginTop: 4, color: C.muted, fontSize: 8.5 }]}>Utile medio mensile {euro(report.economics.monthlyProfit)} · {Math.round(report.economics.monthlyHours)} ore al mese. Stima sui dati dichiarati, non è il tuo reddito personale.</Text>
        <Text style={s.action}><Text style={{ fontWeight: 800 }}>Da fare: </Text>{report.economics.reading.action}</Text>
      </View> : null}
      <View style={s.card} wrap={false}>
        <Text style={s.chip}>Intelligenza artificiale · {report.ai.score}/100</Text>
        <Text style={s.h3}>{report.ai.reading.title}</Text><Text style={s.body}>{report.ai.reading.body}</Text>
        {report.ai.uses.length ? <Text style={[s.body, { marginTop: 4, fontSize: 8.5, color: C.muted }]}>Usi indicati: {report.ai.uses.join(', ')}.</Text> : null}
        <Text style={s.action}><Text style={{ fontWeight: 800 }}>Da fare: </Text>{report.ai.reading.action}</Text>
      </View>
      <Text style={[s.label, { marginTop: 14 }]} break>Reparto per reparto</Text>
      <Text style={s.h2}>Cosa funziona, cosa manca</Text>
      {report.areas.map((area) => <View key={area.id} style={{ marginBottom: 14 }}>
        <View wrap={false}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6 }}>
            <Text style={{ fontSize: 16, fontWeight: 800 }}>{area.label}</Text>
            <Text style={{ fontSize: 16, fontWeight: 800 }}>{area.score}<Text style={{ fontSize: 9, color: C.muted }}>/100 · {area.bandLabel}</Text></Text>
          </View>
          <Bar score={area.score} />
          <Text style={s.h3}>{area.reading.title}</Text>
          <Text style={[s.body, { marginBottom: 6 }]}>{area.reading.body}</Text>
          {area.strengths.length ? <Text style={[s.body, { marginBottom: 6, fontSize: 9 }]}><Text style={{ fontWeight: 800 }}>Punti di forza: </Text>{area.strengths.map((item) => item.advice.title).join(' · ')}</Text> : null}
        </View>
        {area.gaps.map((item) => <Gap key={item.key} item={item} />)}
      </View>)}
      {report.seasonal ? <Text style={[s.body, { fontSize: 9, color: C.muted }]}>La tua attività è stagionale: leggi cassa, persone e vendite pensando ai mesi di picco e a quelli di calo.</Text> : null}
    </Page>

    <Page size="A4" style={[s.cover, { justifyContent: 'center' }]}>
      <Text style={s.labelLime}>Il passo successivo</Text>
      <Text style={[s.h1, { marginTop: 14 }]}>Leggiamo insieme il tuo Radar.</Text>
      <Text style={{ marginTop: 14, fontSize: 12, color: '#CFD7D5', lineHeight: 1.5 }}>Nel debriefing con Frank Cannoletta colleghiamo questi risultati agli obiettivi della tua impresa e scegliamo da dove partire, con un piano per i prossimi 90 giorni.</Text>
      <View style={{ marginTop: 26, alignSelf: 'flex-start', backgroundColor: C.lime, borderRadius: 6, paddingVertical: 10, paddingHorizontal: 16 }}>
        <Link src={`mailto:info@horyzon.it?subject=${encodeURIComponent(`Debriefing Radar d’Impresa — ${report.company.aziendaNome}`)}`} style={{ color: C.ink, fontWeight: 800, fontSize: 12, textDecoration: 'none' }}>Prenota il debriefing: scrivi a info@horyzon.it</Link>
      </View>
      <Text style={{ marginTop: 40, fontSize: 9, color: '#8FA0A0' }}>Horyzon Consulting · info@horyzon.it · horyzon.it</Text>
    </Page>
  </Document>;
}

export async function renderRadarReportPdf(report: RadarReport): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<ReportDocument report={report} />);
}
