// Decorative Radar for the "punto di partenza" chapter: the six areas the Radar listens to (see
// DESIGN.md), a sweep and an abstract profile. No values: the shape is illustrative, not a result.
// Static without JS/reduced motion; under html.kinetic it draws in and sweeps once it is in view.

const AREAS = ['Persone', 'Ruoli', 'Processi', 'Patrimonio', 'Dati', 'Competenze'] as const;
const PROFILE = [.78, .62, .86, .55, .7, .9];
const R = 220;

const at = (angle: number, radius: number) => {
 const a = angle * Math.PI / 180;
 return [Math.sin(a) * radius, -Math.cos(a) * radius] as const;
};

export function RadarScene() {
 const points = PROFILE.map((v, i) => at(i * 60, v * R));
 return <div className="radar-scene" data-kin-watch aria-hidden="true">
  <svg viewBox="-280 -280 560 560">
   {[.25, .5, .75, 1].map(k => <circle key={k} className="radar-ring" r={R * k}/>)}
   {AREAS.map((area, i) => {
    const [x, y] = at(i * 60, R);
    const [lx, ly] = at(i * 60, R + 26);
    return <g key={area}>
     <line className="radar-axis" x1="0" y1="0" x2={x} y2={y}/>
     <text className="radar-label" x={lx} y={ly + 4} textAnchor={Math.abs(lx) < 1 ? 'middle' : lx > 0 ? 'start' : 'end'}>{area}</text>
    </g>;
   })}
   <polygon className="radar-profile" pathLength={1} points={points.map(p => p.join(',')).join(' ')}/>
   {points.map(([x, y], i) => <circle key={i} className="radar-node" cx={x} cy={y} r="5" style={{ '--a': i * 60 } as React.CSSProperties}/>)}
  </svg>
  <span className="radar-sweep"/>
 </div>;
}
