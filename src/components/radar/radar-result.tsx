import type { RadarScores } from '@/lib/radar';
import styles from './radar.module.css';

export function RadarResult({ scores }: { scores: RadarScores }) {
  return <section className={styles.panel} aria-labelledby="radar-result-title"><p className={styles.kicker}>Il tuo Radar</p><h2 id="radar-result-title">Indice globale: {scores.global}/100</h2><div className={styles.results}>{scores.areas.map((area) => <article key={area.id}><span>{area.label}</span><strong>{area.score}</strong></article>)}</div><p>Autonomia dal titolare: <strong>{scores.ownerAutonomy}/100</strong></p><p>Preparazione AI: <strong>{scores.ai}/100</strong></p></section>;
}
