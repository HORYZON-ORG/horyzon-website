import styles from './radar.module.css';

const AREAS = ['Equilibrio', 'Liquidità', 'Debiti', 'Protezione', 'Patrimonio', 'Pianificazione'];
const C = 260;
const point = (r: number, deg: number) => {
  const a = (deg - 90) * Math.PI / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)].map(n => n.toFixed(2));
};

/** Decorative instrument drawn in code: six equal sectors, no values, no score. */
export function RadarInstrument() {
  return <figure className={styles.instrument} aria-hidden="true">
    <svg viewBox="-34 -6 588 532" focusable="false">
      <defs>
        <radialGradient id="pr-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#d9e65f" stopOpacity=".16" />
          <stop offset=".55" stopColor="#d9e65f" stopOpacity=".03" />
          <stop offset="1" stopColor="#d9e65f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pr-sweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d9e65f" stopOpacity="0" />
          <stop offset="1" stopColor="#d9e65f" stopOpacity=".22" />
        </linearGradient>
      </defs>
      <circle cx={C} cy={C} r="230" fill="url(#pr-glow)" />
      {[210, 160, 110, 60].map((r, i) => <circle key={r} cx={C} cy={C} r={r} className={i === 0 ? styles.ringOuter : styles.ring} />)}
      {Array.from({ length: 72 }, (_, i) => {
        const [x1, y1] = point(210, i * 5), [x2, y2] = point(i % 6 === 0 ? 198 : 204, i * 5);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={styles.tick} />;
      })}
      {AREAS.map((_, i) => { const [x, y] = point(210, i * 60); return <line key={i} x1={C} y1={C} x2={x} y2={y} className={styles.spoke} />; })}
      <g className={styles.sweep}><path d={`M${C} ${C} L${point(210, -38).join(' ')} A210 210 0 0 1 ${C} ${C - 210} Z`} fill="url(#pr-sweep)" /><line x1={C} y1={C} x2={C} y2={C - 210} className={styles.sweepLine} /></g>
      {AREAS.map((name, i) => { const deg = i * 60 + 30, side = deg === 90 ? 'start' : deg === 270 ? 'end' : 'middle', [x, y] = point(side === 'middle' ? 250 : 224, deg); return <text key={name} x={x} y={y} className={styles.instrumentLabel} textAnchor={side} dominantBaseline="middle">{name.toUpperCase()}</text>; })}
      <circle cx={C} cy={C} r="9" className={styles.instrumentDot} />
      <circle cx={C} cy={C} r="20" className={styles.instrumentHalo} />
    </svg>
  </figure>;
}
