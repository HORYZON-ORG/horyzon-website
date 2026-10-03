'use client';

import { calculateRadarScores } from '@/lib/radar/domain';
import type { RadarAnswers } from '@/lib/radar/types';
import styles from './radar-processing.module.css';

// Shown between the last answer and the result: the radar draws itself with the company's own answers
// while the report is computed. Pure CSS timing, ~3.6s; RadarClient keeps it on screen at least that long.
export const RADAR_PROCESSING_MS = 3600;

const STEPS = ['Leggo le risposte dei cinque reparti', 'Misuro l’autonomia dal titolare', 'Calcolo quanto rende ogni tua ora', 'Scelgo le tre priorità dei prossimi 90 giorni', 'Impagino il tuo report'];

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 112;

function point(index: number, ratio: number): [number, number] {
  const angle = (-90 + index * 72) * (Math.PI / 180);
  return [CENTER + Math.cos(angle) * RADIUS * ratio, CENTER + Math.sin(angle) * RADIUS * ratio];
}

const polygon = (ratios: number[]) => ratios.map((ratio, index) => point(index, ratio).map((value) => value.toFixed(1)).join(',')).join(' ');

export function RadarProcessing({ answers, aziendaNome }: { answers: RadarAnswers; aziendaNome?: string }) {
  const areas = calculateRadarScores(answers).areas;
  // A zero score would collapse onto the centre: keep a small floor so every department stays visible.
  const ratios = areas.map((area) => Math.max(0.1, area.score / 100));
  const short = (label: string) => (label === 'Risorse Umane' ? 'Persone' : label === 'Amministrazione' ? 'Amministraz.' : label);

  return (
    <section className={styles.stage} aria-labelledby="radar-processing-title" aria-live="polite">
      <div className={styles.copy}>
        <p className={styles.kicker}>Radar completato</p>
        <h2 id="radar-processing-title">Sto elaborando il profilo{aziendaNome ? <> di <em>{aziendaNome}</em></> : null}.</h2>
        <ol className={styles.steps}>
          {STEPS.map((step, index) => (
            <li key={step} style={{ '--i': index } as React.CSSProperties}>
              <span className={styles.mark} aria-hidden="true" />
              {step}
            </li>
          ))}
        </ol>
        <div className={styles.progress} role="progressbar" aria-label="Elaborazione del Radar"><i /></div>
      </div>

      <svg className={styles.radar} viewBox={`-64 -6 ${SIZE + 128} ${SIZE + 12}`} role="img" aria-label="Il profilo della tua impresa prende forma">
        <defs>
          <linearGradient id="radar-sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#d8ff42" stopOpacity="0" />
            <stop offset="1" stopColor="#d8ff42" stopOpacity=".42" />
          </linearGradient>
          <radialGradient id="radar-glow">
            <stop offset="0" stopColor="#d8ff42" stopOpacity=".22" />
            <stop offset="1" stopColor="#d8ff42" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={CENTER} cy={CENTER} r={RADIUS + 26} fill="url(#radar-glow)" className={styles.glow} />
        {[0.25, 0.5, 0.75, 1].map((ratio, index) => (
          <polygon key={ratio} points={polygon([ratio, ratio, ratio, ratio, ratio])} className={styles.ring} style={{ '--i': index } as React.CSSProperties} />
        ))}
        {areas.map((area, index) => {
          const [x, y] = point(index, 1);
          return <line key={area.id} x1={CENTER} y1={CENTER} x2={x} y2={y} className={styles.axis} style={{ '--i': index } as React.CSSProperties} />;
        })}
        <g className={styles.sweep}>
          <path d={`M${CENTER},${CENTER} L${CENTER + RADIUS},${CENTER} A${RADIUS},${RADIUS} 0 0,0 ${(CENTER + Math.cos(-0.7) * RADIUS).toFixed(1)},${(CENTER + Math.sin(-0.7) * RADIUS).toFixed(1)} Z`} fill="url(#radar-sweep)" />
        </g>
        <polygon points={polygon(ratios)} className={styles.shape} />
        {ratios.map((ratio, index) => {
          const [x, y] = point(index, ratio);
          return <circle key={areas[index]!.id} cx={x} cy={y} r="4.5" className={styles.dot} style={{ '--i': index } as React.CSSProperties} />;
        })}
        {areas.map((area, index) => {
          const [x, y] = point(index, 1.2);
          return <text key={area.id} x={x} y={y} className={styles.label} textAnchor={Math.abs(x - CENTER) < 4 ? 'middle' : x > CENTER ? 'start' : 'end'} dominantBaseline="middle" style={{ '--i': index } as React.CSSProperties}>{short(area.label)}</text>;
        })}
        <circle cx={CENTER} cy={CENTER} r="5" className={styles.core} />
      </svg>
    </section>
  );
}
