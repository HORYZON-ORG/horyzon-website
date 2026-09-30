'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { motion, useMotionValueEvent, useScroll, useTransform } from 'motion/react';
import { AD_DOUBTS, AdSheet } from './ad-sheet';

// "Leggi il tuo annuncio come un candidato": the same mechanism as the Radar owner story. While the
// section is pinned, one vague sentence of the ad at a time turns rust and the candidate's doubt appears
// next to it. With reduced motion, and in the server HTML, it is a plain list with every doubt visible.
const STAGES = AD_DOUBTS.length + 2;
const CTA = { href: '#valuta', 'data-analytics-event': 'annunci10x_lp_cta_click', 'data-cta-position': 'story' } as const;

const motionQuery = '(prefers-reduced-motion: no-preference)';
function subscribe(callback: () => void) { const query = window.matchMedia(motionQuery); query.addEventListener('change', callback); return () => query.removeEventListener('change', callback); }
const useLive = () => useSyncExternalStore(subscribe, () => window.matchMedia(motionQuery).matches, () => false);

function Intro() {
  return <><p className="rd-label">L’esperimento</p><h2 id="ax-story-title">Leggi il tuo annuncio <em>come un candidato.</em></h2></>;
}

function Closing() {
  return <><p className="rd-label">Lo Score di chiarezza</p><p className="rd-story-signal">Se il candidato giusto ha dubbi, <em>si candida qualcun altro.</em></p></>;
}

function DoubtLabel({ area }: { area: string }) {
  return <span className="rd-label rd-label-down">{area} <span>non chiaro</span></span>;
}

function LiveStory() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [stage, setStage] = useState(0);
  useMotionValueEvent(scrollYProgress, 'change', (p) => { const next = Math.min(STAGES - 1, Math.floor(p * STAGES)); if (next !== stage) setStage(next); });
  const bar = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const active = stage >= 1 && stage <= AD_DOUBTS.length ? stage - 1 : null;
  const last = stage === STAGES - 1;
  return <section ref={ref} className="rd-story ax-story is-live" aria-labelledby="ax-story-title" style={{ '--stages': STAGES } as React.CSSProperties}>
    <div className="rd-story-stage">
      <AdSheet className="ax-story-sheet" active={active} />
      <div className="rd-story-copy">
        <div className={stage === 0 ? 'rd-story-line is-on' : 'rd-story-line'}><Intro /><p className="rd-story-hint">Scorri e guarda che cosa si chiede.</p></div>
        {AD_DOUBTS.map((item, i) => <div key={item.area} className={stage === i + 1 ? 'rd-story-line is-on' : 'rd-story-line'} aria-hidden={stage !== i + 1}><DoubtLabel area={item.area} /><p className="rd-story-signal">{item.doubt}</p></div>)}
        <div className={last ? 'rd-story-line is-on' : 'rd-story-line'}><Closing /><a className="rd-cta" {...CTA} tabIndex={last ? 0 : -1}>Scoprilo in 2 minuti<span aria-hidden="true">↓</span></a></div>
      </div>
      <motion.span className="rd-story-progress" style={{ scaleX: bar }} aria-hidden="true" />
    </div>
    <ul className="sr-only">{AD_DOUBTS.map((item) => <li key={item.area}>{item.phrase} {item.area}: {item.doubt}</li>)}</ul>
  </section>;
}

function StaticStory() {
  return <section className="rd-story ax-story" aria-labelledby="ax-story-title">
    <div className="rd-story-stage">
      <AdSheet className="ax-story-sheet" />
      <div className="rd-story-copy">
        <Intro />
        <ul className="rd-story-list">{AD_DOUBTS.map((item) => <li key={item.area}><DoubtLabel area={item.area} />{item.doubt}</li>)}</ul>
        <Closing />
        <a className="rd-cta" {...CTA}>Scoprilo in 2 minuti<span aria-hidden="true">↓</span></a>
      </div>
    </div>
  </section>;
}

export function CandidateStory() {
  return useLive() ? <LiveStory /> : <StaticStory />;
}
