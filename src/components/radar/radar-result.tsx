import type { RadarScores } from '@/lib/radar/types';
import styles from './radar.module.css';

const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const number = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });

export function RadarResult({ scores }: { scores: RadarScores }) {
  const economics = scores.ownerEconomics;
  return <section className={styles.panel} aria-labelledby="radar-result-title">
    <p className={styles.kicker}>Il tuo Radar</p>
    <h2 id="radar-result-title">Indice globale: {scores.global}/100</h2>
    {economics ? <article className={styles.hourlyResult} aria-labelledby="radar-hourly-title">
      <h3 id="radar-hourly-title">Quanto rende ogni ora che lavori?</h3>
      <p className={styles.hourlyValue}>{euro.format(economics.hourlyProfit)}<span> / ora</span></p>
      <p>Utile aziendale prima delle tasse per ogni tua ora lavorata.</p>
      <dl className={styles.hourlyDetails}>
        <div><dt>Utile medio mensile</dt><dd>{euro.format(economics.monthlyProfit)}</dd></div>
        <div><dt>Ore medie mensili</dt><dd>{number.format(economics.monthlyHours)}</dd></div>
      </dl>
      <p>{economics.hourlyProfit < 0 ? 'L’azienda è in perdita: le ore che dedichi oggi non generano un utile positivo.' : economics.hourlyProfit === 0 ? 'Con i dati inseriti, le tue ore di lavoro non generano utile aziendale.' : economics.hourlyProfit < 10 ? 'Con i dati inseriti, ogni tua ora di lavoro corrisponde a meno di 10 € di utile aziendale prima delle tasse.' : 'Questo valore mette in relazione il risultato economico dell’impresa con il tempo che le dedichi.'}</p>
      <p className={styles.hourlyNote}>Calcolo: utile mensile ÷ ore mensili. Convertiamo l’utile annuale dividendo per 12 e le ore settimanali moltiplicando per 52 ÷ 12. È una stima basata sui dati dichiarati: non rappresenta il tuo stipendio, i dividendi o il reddito personale netto. Eventuali compensi già inclusi nei costi non vengono sommati all’utile.</p>
    </article> : <p>Utile per ora non disponibile: questo Radar non contiene i dati su ore lavorate e utile.</p>}
    <div className={styles.results}>{scores.areas.map((area) => <article key={area.id}><span>{area.label}</span><strong>{area.score}</strong></article>)}</div>
    <p>Autonomia dal titolare: <strong>{scores.ownerAutonomy}/100</strong></p>
    <p>Preparazione AI: <strong>{scores.ai}/100</strong></p>
  </section>;
}
