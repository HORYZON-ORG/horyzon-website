'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { motion, useMotionValueEvent, useScroll, useTransform } from 'motion/react';
import { AD_FINAL_STEP, AD_REWRITES, AdSheet } from './ad-sheet';

// "Lo stesso annuncio, riscritto riga per riga": the same pinned mechanism as the Radar owner story. One
// vague sentence at a time is struck through and replaced by a fact, the key facts fill in, and at the end
// the visitor is looking at a better ad than the one they started from. With reduced motion, and in the
// server HTML, it is a plain list of the five errors next to the finished ad.
const STAGES = AD_FINAL_STEP + 1;
const CTA = { href: '#valuta', 'data-analytics-event': 'annunci10x_lp_cta_click', 'data-cta-position': 'story' } as const;
const EXAMPLE_NOTE = 'Esempio illustrativo: i dati veri li metti tu, noi li rendiamo chiari.';

const motionQuery = '(prefers-reduced-motion: no-preference)';
function subscribe(callback: () => void) { const query = window.matchMedia(motionQuery); query.addEventListener('change', callback); return () => query.removeEventListener('change', callback); }
const useLive = () => useSyncExternalStore(subscribe, () => window.matchMedia(motionQuery).matches, () => false);

const number = (index: number) => String(index + 1).padStart(2, '0');

function Intro() {
  return <><p className="rd-label">L’esperimento</p><h2 id="ax-story-title">Lo stesso annuncio, <em>riscritto riga per riga.</em></h2></>;
}

function Closing() {
  return <><p className="rd-label">Il risultato</p><p className="rd-story-signal">Stesso lavoro. <em>Ora si capisce.</em></p><p className="ax-story-note">{EXAMPLE_NOTE}</p></>;
}

function ErrorLine({ index }: { index: number }) {
  const line = AD_REWRITES[index]!;
  return <><p className="rd-label">{number(index)} · {line.area}</p><p className="rd-story-signal">{line.error[0]}<em>{line.error[1]}</em></p><p className="ax-story-note">{line.note}</p></>;
}

function LiveStory() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [stage, setStage] = useState(0);
  useMotionValueEvent(scrollYProgress, 'change', (p) => { const next = Math.min(STAGES - 1, Math.floor(p * STAGES)); if (next !== stage) setStage(next); });
  const bar = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const last = stage === STAGES - 1;
  return <section ref={ref} className="rd-story ax-story is-live" aria-labelledby="ax-story-title" style={{ '--stages': STAGES } as React.CSSProperties}>
    <div className="rd-story-stage">
      <AdSheet className="ax-story-sheet" step={stage} />
      <div className="rd-story-copy">
        <div className={stage === 0 ? 'rd-story-line is-on' : 'rd-story-line'}><Intro /><p className="rd-story-hint">Scorri: ogni frase vaga lascia il posto a un fatto.</p></div>
        {AD_REWRITES.map((line, i) => <div key={line.area} className={stage === i + 1 ? 'rd-story-line is-on' : 'rd-story-line'} aria-hidden={stage !== i + 1}><ErrorLine index={i} /></div>)}
        <div className={last ? 'rd-story-line is-on' : 'rd-story-line'}><Closing /><a className="rd-cta" {...CTA} tabIndex={last ? 0 : -1}>Valuta il tuo annuncio<span aria-hidden="true">↓</span></a></div>
      </div>
      <motion.span className="rd-story-progress" style={{ scaleX: bar }} aria-hidden="true" />
    </div>
    <ul className="sr-only">{AD_REWRITES.map((line) => <li key={line.area}>{line.area}. Prima: {line.before} Dopo: {line.after.join('')}</li>)}</ul>
  </section>;
}

function StaticStory() {
  return <section className="rd-story ax-story" aria-labelledby="ax-story-title">
    <div className="rd-story-stage">
      <AdSheet className="ax-story-sheet" step={AD_FINAL_STEP} />
      <div className="rd-story-copy">
        <Intro />
        <ul className="rd-story-list">{AD_REWRITES.map((line, i) => <li key={line.area}><span className="rd-label">{number(i)} · {line.area}</span>{line.error[0]}{line.error[1]} <span className="ax-story-was">Prima: {line.before} Dopo: {line.after.join('')}</span></li>)}</ul>
        <Closing />
        <a className="rd-cta" {...CTA}>Valuta il tuo annuncio<span aria-hidden="true">↓</span></a>
      </div>
    </div>
  </section>;
}

export function CandidateStory() {
  return useLive() ? <LiveStory /> : <StaticStory />;
}
