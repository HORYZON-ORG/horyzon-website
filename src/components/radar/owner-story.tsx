'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { motion, useMotionValueEvent, useScroll, useTransform } from 'motion/react';
import { RadarGrid, radarPath, radarPoint } from './radar-scope';

// "Immagina un mese senza di te": the owner (the lime dot of the logo) leaves the centre of the radar and,
// one signal at a time, the departments that still depend on them fold inwards. Scroll-driven and sticky
// when motion is allowed; with reduced motion, and in the server HTML, it is a plain list with the final shape.
const SIGNALS = [
  { axis: 4, text: 'Le decisioni importanti tornano sempre sulla tua scrivania.' },
  { axis: 2, text: 'Le trattative migliori hanno ancora bisogno della tua presenza.' },
  { axis: 1, text: 'Le procedure esistono soprattutto nella testa delle persone.' },
  { axis: 0, text: 'I numeri arrivano troppo tardi per orientare le decisioni.' },
  { axis: 3, text: 'Le nuove opportunità passano ancora dal tuo nome.' },
] as const;
const AXIS_NAME = ['Amministrazione', 'Produzione', 'Commerciale', 'Marketing', 'Persone'];
const FULL = [0.86, 0.8, 0.9, 0.78, 0.84];
const LOW = [0.36, 0.42, 0.22, 0.4, 0.28];
const STAGES = SIGNALS.length + 2;
const clamp = (n: number) => Math.min(1, Math.max(0, n));

function shapeAt(progress: number) {
  return FULL.map((full, axis) => {
    const order = SIGNALS.findIndex((signal) => signal.axis === axis);
    const t = clamp((progress * STAGES - (order + 1)) / 0.55);
    const eased = 1 - Math.pow(1 - t, 3);
    return full + (LOW[axis]! - full) * eased;
  });
}

const motionQuery = '(prefers-reduced-motion: no-preference)';
function subscribe(callback: () => void) { const query = window.matchMedia(motionQuery); query.addEventListener('change', callback); return () => query.removeEventListener('change', callback); }
const useLive = () => useSyncExternalStore(subscribe, () => window.matchMedia(motionQuery).matches, () => false);

function Radar({ collapsed, shape, dot }: { collapsed: readonly number[]; shape: React.ReactNode; dot: React.ReactNode }) {
  return <svg className="rd-story-radar" viewBox="-70 -20 540 450" aria-hidden="true"><RadarGrid collapsed={collapsed} /><path className="rd-ghost" d={radarPath(FULL)} />{shape}{dot}</svg>;
}

function LiveStory() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [stage, setStage] = useState(0);
  useMotionValueEvent(scrollYProgress, 'change', (p) => { const next = Math.min(STAGES - 1, Math.floor(p * STAGES)); if (next !== stage) setStage(next); });
  const d = useTransform(scrollYProgress, (p) => radarPath(shapeAt(p)));
  const leave = useTransform(scrollYProgress, [0.04, 0.13], [0, 1]);
  const dotX = useTransform(leave, (t) => t * 300);
  const dotOpacity = useTransform(leave, [0.7, 1], [1, 0]);
  const bar = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const collapsed = SIGNALS.slice(0, Math.max(0, stage)).map((signal) => signal.axis);
  const [cx, cy] = radarPoint(0, 0);
  return <section ref={ref} className="rd-story is-live" aria-labelledby="rd-story-title" style={{ '--stages': STAGES } as React.CSSProperties}>
    <div className="rd-story-stage">
      <Radar collapsed={collapsed} shape={<motion.path className="rd-shape rd-shape-live" d={d} />} dot={<motion.g style={{ x: dotX, opacity: dotOpacity }}><circle className="rd-you-ring" cx={cx} cy={cy} r="13" /><circle className="rd-you" cx={cx} cy={cy} r="9" /><text className="rd-you-label" x={cx} y={cy - 22} textAnchor="middle">TU</text></motion.g>} />
      <div className="rd-story-copy">
        <div className={stage === 0 ? 'rd-story-line is-on' : 'rd-story-line'}><p className="rd-label">L’esperimento</p><h2 id="rd-story-title">Immagina un mese <em>senza di te.</em></h2><p className="rd-story-hint">Scorri e guarda che cosa succede.</p></div>
        {SIGNALS.map((signal, i) => <div key={signal.axis} className={stage === i + 1 ? 'rd-story-line is-on' : 'rd-story-line'} aria-hidden={stage !== i + 1}><p className="rd-label rd-label-down">{AXIS_NAME[signal.axis]} <span>rallenta</span></p><p className="rd-story-signal">{signal.text}</p></div>)}
        <div className={stage === STAGES - 1 ? 'rd-story-line is-on' : 'rd-story-line'}><p className="rd-label">Il Radar d’Impresa</p><p className="rd-story-signal">Se ti assenti, che cosa rallenta <em>per primo?</em></p><a className="rd-cta" href="#radar-prodotto" data-analytics-event="radar_lp_cta_click" data-cta-position="story" tabIndex={stage === STAGES - 1 ? 0 : -1}>Scoprilo in 8 minuti<span aria-hidden="true">↓</span></a></div>
      </div>
      <motion.span className="rd-story-progress" style={{ scaleX: bar }} aria-hidden="true" />
    </div>
    <ul className="sr-only">{SIGNALS.map((signal) => <li key={signal.axis}>{AXIS_NAME[signal.axis]}: {signal.text}</li>)}</ul>
  </section>;
}

function StaticStory() {
  const [cx, cy] = radarPoint(0, 0);
  return <section className="rd-story" aria-labelledby="rd-story-title">
    <div className="rd-story-stage">
      <Radar collapsed={SIGNALS.map((signal) => signal.axis)} shape={<path className="rd-shape" d={radarPath(LOW)} />} dot={<g transform="translate(300 0)" opacity="0"><circle className="rd-you" cx={cx} cy={cy} r="9" /></g>} />
      <div className="rd-story-copy">
        <p className="rd-label">L’esperimento</p><h2 id="rd-story-title">Immagina un mese <em>senza di te.</em></h2>
        <ul className="rd-story-list">{SIGNALS.map((signal) => <li key={signal.axis}><span className="rd-label rd-label-down">{AXIS_NAME[signal.axis]} <span>rallenta</span></span>{signal.text}</li>)}</ul>
        <p className="rd-story-signal">Se ti assenti, che cosa rallenta <em>per primo?</em></p>
        <a className="rd-cta" href="#radar-prodotto" data-analytics-event="radar_lp_cta_click" data-cta-position="story">Scoprilo in 8 minuti<span aria-hidden="true">↓</span></a>
      </div>
    </div>
  </section>;
}

export function OwnerStory() {
  return useLive() ? <LiveStory /> : <StaticStory />;
}
