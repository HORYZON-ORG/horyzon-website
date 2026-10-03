import type { RadarReport, ReportIndex } from '@/lib/radar/report';
import { RadarGrid, radarPath, radarPoint } from './radar-scope';
import styles from './radar.module.css';

// The Radar report on the page: same content as the PDF, which the person can download and also receives by email.
export const DEBRIEFING_MAILTO = (company: string) => `mailto:info@horyzon.it?subject=${encodeURIComponent(`Debriefing Radar d’Impresa — ${company}`)}`;

const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const number = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });

function ReportRadar({ report }: { report: RadarReport }) {
  const values = report.areas.map((area) => Math.max(0.04, area.score / 100));
  return <svg className={styles.reportRadar} viewBox="-70 -20 540 450" role="img" aria-label={`Profilo: ${report.areas.map((a) => `${a.label} ${a.score}`).join(', ')}`}>
    <RadarGrid labels={false} />
    <path className={styles.reportShape} d={radarPath(values)} />
    {report.areas.map((area, i) => { const [x, y] = radarPoint(i, values[i]!); const [lx, ly] = radarPoint(i, 1.14); const anchor = (['middle', 'start', 'start', 'end', 'end'] as const)[i]; const top = i === 0 ? ly - 30 : i > 1 && i < 4 ? ly + 10 : ly - 8; return <g key={area.id}>
      <circle cx={x} cy={y} r="6" className={styles.reportDot} />
      <text x={lx} y={top} textAnchor={anchor} className={styles.reportAxis}>{area.label.toUpperCase()}</text>
      <text x={lx} y={top + 28} textAnchor={anchor} className={styles.reportValue}>{area.score}</text>
    </g>; })}
  </svg>;
}

function Index({ label, index, children }: { label: string; index: ReportIndex; children?: React.ReactNode }) {
  return <article className={styles.indexCard}>
    <p className={styles.indexLabel}>{label}<span data-band={index.band}>{index.bandLabel}</span></p>
    <p className={styles.indexScore}>{index.score}<small>/100</small></p>
    <h4>{index.reading.title}</h4><p>{index.reading.body}</p>{children}
    <p className={styles.todo}><b>Da fare</b>{index.reading.action}</p>
  </article>;
}

export function RadarResult({ report, onRestart }: { report: RadarReport; onRestart: () => void }) {
  const economics = report.economics;
  return <section className={`${styles.panel} ${styles.report}`} aria-labelledby="radar-result-title">
    <p className={styles.kicker}><span>Il tuo Radar · {report.company.aziendaNome}</span><span className={styles.counter}>{new Date(report.generatedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</span></p>
    <div className={styles.reportHero}>
      <div>
        <h2 id="radar-result-title">Indice globale <em>{report.global.score}</em>/100</h2>
        <p className={styles.reportLead}><b>{report.global.reading.title}.</b> {report.global.reading.body}</p>
        <dl className={styles.reportFacts}>
          <div><dt>Reparto più solido</dt><dd>{report.strongest.label} · {report.strongest.score}</dd></div>
          <div><dt>Reparto prioritario</dt><dd>{report.weakest.label} · {report.weakest.score}</dd></div>
        </dl>
        <div className={styles.reportActions}><a className={styles.download} href="/api/radar/report/pdf" download>Scarica il report PDF</a><span>Ti inviamo lo stesso PDF anche via email.</span></div>
      </div>
      <ReportRadar report={report} />
    </div>

    <h3 className={styles.reportH3}>Le tre priorità dei prossimi 90 giorni</h3>
    {report.priorities.length ? <ol className={styles.priorities}>{report.priorities.map((priority) => <li key={priority.question}>
      <p className={styles.indexLabel}>{priority.area}</p><h4>{priority.advice.title}</h4><p>{priority.advice.action}</p>
    </li>)}</ol> : <p>Nessuna risposta sotto “Molto”: lavora sulla crescita del reparto prioritario.</p>}

    <h3 className={styles.reportH3}>Gli indici</h3>
    <div className={styles.indexGrid}>
      <Index label="Autonomia dal titolare" index={report.autonomy}><p className={styles.gapNote}>{report.autonomy.gapReading}</p></Index>
      <Index label="Intelligenza artificiale" index={report.ai}>{report.ai.uses.length ? <p className={styles.gapNote}>Usi indicati: {report.ai.uses.join(', ')}.</p> : null}</Index>
    </div>
    {economics ? <article className={styles.hourlyResult} aria-labelledby="radar-hourly-title">
      <h3 id="radar-hourly-title">Quanto rende ogni ora che lavori?</h3>
      <p className={styles.hourlyValue}>{euro.format(economics.hourlyProfit)}<span> / ora</span></p>
      <dl className={styles.hourlyDetails}>
        <div><dt>Utile medio mensile</dt><dd>{euro.format(economics.monthlyProfit)}</dd></div>
        <div><dt>Ore medie mensili</dt><dd>{number.format(economics.monthlyHours)}</dd></div>
      </dl>
      <h4>{economics.reading.title}</h4><p>{economics.reading.body}</p>
      <p className={styles.todo}><b>Da fare</b>{economics.reading.action}</p>
      <p className={styles.hourlyNote}>Calcolo: utile mensile ÷ ore mensili. Convertiamo l’utile annuale dividendo per 12 e le ore settimanali moltiplicando per 52 ÷ 12. È una stima basata sui dati dichiarati: non rappresenta il tuo stipendio, i dividendi o il reddito personale netto.</p>
    </article> : <p className={styles.gapNote}>Utile per ora non disponibile: questo Radar non contiene i dati su ore lavorate e utile.</p>}

    <h3 className={styles.reportH3}>Reparto per reparto</h3>
    <div className={styles.areas}>{report.areas.map((area) => <details key={area.id} open={area.label === report.weakest.label}>
      <summary><span>{area.label}</span><span className={styles.areaMeter} aria-hidden="true"><i style={{ width: `${Math.max(3, area.score)}%` }} /></span><b>{area.score}</b><span data-band={area.band}>{area.bandLabel}</span></summary>
      <div className={styles.areaBody}>
        <h4>{area.reading.title}</h4><p>{area.reading.body}</p>
        {area.strengths.length ? <p className={styles.strengths}><b>Punti di forza</b>{area.strengths.map((item) => item.advice.title).join(' · ')}</p> : null}
        {area.gaps.map((item) => <article key={item.key} className={styles.gap}>
          <p className={styles.indexLabel}><span data-band={item.band}>Hai risposto: {item.answerLabel}</span>{item.autonomy ? <span>Autonomia dal titolare</span> : null}</p>
          <p className={styles.question}>“{item.question}”</p>
          <h4>{item.advice.title}</h4><p>{item.advice.body}</p>
          <p className={styles.todo}><b>Da fare</b>{item.advice.action}</p>
        </article>)}
      </div>
    </details>)}</div>
    {report.seasonal ? <p className={styles.gapNote}>La tua attività è stagionale: leggi cassa, persone e vendite pensando ai mesi di picco e a quelli di calo.</p> : null}

    <aside className={styles.debriefing}>
      <p className={styles.indexLabel}>Il passo successivo</p>
      <h3>Leggiamo insieme il tuo Radar.</h3>
      <p>Nel debriefing con Frank Cannoletta colleghiamo questi risultati agli obiettivi della tua impresa e scegliamo da dove partire, con un piano per i prossimi 90 giorni.</p>
      <a href={DEBRIEFING_MAILTO(report.company.aziendaNome)}>Prenota il debriefing con Frank</a>
    </aside>
    <p className={styles.gapNote}>Una fotografia guidata basata sulle tue risposte: non è una diagnosi completa né una valutazione finanziaria, fiscale o legale.</p>
    <div className={styles.cardFoot}><button type="button" className={styles.restart} onClick={onRestart}>Rifai il test da zero</button></div>
  </section>;
}
