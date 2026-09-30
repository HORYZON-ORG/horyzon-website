// Radar screen for the /radar landing: five department axes, an illustrative profile and a sweep beam.
// Pure SVG + CSS (src/styles/horyzon-landing.css): the sweep and the blips run without JavaScript and stop with
// reduced motion. The shape is illustrative, never a real company or score.
export const RADAR_AXES = ['Amministrazione', 'Produzione', 'Commerciale', 'Marketing', 'Persone'] as const;

const C = 200;
const R = 150;

export function radarPoint(axis: number, value: number): [number, number] {
  const angle = ((-90 + axis * 72) * Math.PI) / 180;
  return [C + Math.cos(angle) * R * value, C + Math.sin(angle) * R * value];
}

export function radarPath(values: readonly number[]): string {
  return values.map((value, axis) => radarPoint(axis, value).map((n) => n.toFixed(1)).join(',')).map((p, i) => `${i ? 'L' : 'M'}${p}`).join('') + 'Z';
}

const ring = (scale: number) => radarPath([scale, scale, scale, scale, scale]);
const LABEL_ANCHOR = ['middle', 'start', 'start', 'end', 'end'] as const;

export function RadarGrid({ collapsed = [], labels = true }: { collapsed?: readonly number[]; labels?: boolean }) {
  return <>
    <g className="rd-grid">
      {[1, 0.75, 0.5, 0.25].map((scale) => <path key={scale} d={ring(scale)} />)}
      {RADAR_AXES.map((axis, i) => { const [x, y] = radarPoint(i, 1); return <line key={axis} x1={C} y1={C} x2={x} y2={y} />; })}
    </g>
    {labels ? <g className="rd-axis-labels">
      {RADAR_AXES.map((axis, i) => {
        const [x, y] = radarPoint(i, 1.13);
        return <text key={axis} x={x} y={i === 0 ? y - 4 : i > 1 && i < 4 ? y + 14 : y + 4} textAnchor={LABEL_ANCHOR[i]} className={collapsed.includes(i) ? 'is-down' : undefined}>{axis.toUpperCase()}</text>;
      })}
    </g> : null}
  </>;
}

const HERO_SHAPE = [0.82, 0.7, 0.9, 0.58, 0.76] as const;

export function RadarScope({ className = '' }: { className?: string }) {
  return <div className={`rd-scope ${className}`} aria-hidden="true">
    <svg viewBox="-70 -20 540 450">
      <RadarGrid />
      <path className="rd-shape" d={radarPath(HERO_SHAPE)} />
      {HERO_SHAPE.map((value, i) => { const [x, y] = radarPoint(i, value); return <circle key={i} className="rd-blip" style={{ '--i': i } as React.CSSProperties} cx={x} cy={y} r="5" />; })}
      <circle className="rd-you-ring" cx={C} cy={C} r="11" />
      <circle className="rd-you" cx={C} cy={C} r="8" />
    </svg>
    <span className="rd-sweep" />
  </div>;
}
