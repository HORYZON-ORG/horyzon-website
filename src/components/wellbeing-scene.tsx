'use client';

import { useEffect, useRef } from 'react';
import styles from './wellbeing.module.css';

type Kind = 'organization' | 'continuity' | 'digital';
const captions: Record<Kind, string> = {
  organization: 'Responsabilità condivise. Una direzione comune.',
  continuity: 'Persona, famiglia e impresa. Una vista completa.',
  digital: 'Dalle informazioni al lavoro. Le persone al centro.',
};

/** Complete static illustration in server HTML; the sequence plays once when it enters view. */
export function WellbeingScene({ kind, words, caption }: { kind: Kind; words: readonly string[]; caption?: string }) {
  const figure = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = figure.current;
    if (!element || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        element.dataset.play = 'true';
        observer.disconnect();
      }
    }, { threshold: 0.25 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [kind]);

  return <figure ref={figure} className={styles.scene} data-wellbeing-scene={kind}>
    <div className={styles.diagram}>
      <svg viewBox="0 0 440 360" aria-hidden="true" focusable="false">
        <g className={styles.grid}><path d="M0 90H440M0 180H440M0 270H440M110 0V360M220 0V360M330 0V360" /></g>
        {kind === 'organization' && <>
          <g className={styles.track}><path d="M220 166V65M220 186H83V263M220 186H357V263" /></g>
          <g className={styles.flow}><path pathLength="1" d="M220 166V65" /><path pathLength="1" d="M220 186H83V263" /><path pathLength="1" d="M220 186H357V263" /></g>
          <g className={styles.node}><rect x="147" y="30" width="146" height="58" rx="12" /><text x="220" y="65">Persone</text></g>
          <g className={styles.core}><rect x="139" y="148" width="162" height="76" rx="16" /><text x="220" y="193">Impresa</text></g>
          <g className={styles.node}><rect x="21" y="263" width="124" height="58" rx="12" /><text x="83" y="298">Ruoli</text><rect x="283" y="263" width="148" height="58" rx="12" /><text x="357" y="298">Decisioni</text></g>
          <g className={styles.signal}><circle cx="220" cy="118" r="5" /><circle cx="83" cy="234" r="5" /><circle cx="357" cy="234" r="5" /></g>
        </>}
        {kind === 'continuity' && <>
          <g className={styles.orbits}><circle cx="220" cy="180" r="157" /><circle cx="220" cy="180" r="112" /><circle cx="220" cy="180" r="66" /></g>
          <g className={styles.flow}><path pathLength="1" d="M63 180A157 157 0 0 1 377 180" /><path pathLength="1" d="M108 180A112 112 0 0 0 332 180" /><path pathLength="1" d="M154 180A66 66 0 0 1 286 180" /></g>
          <g className={styles.node}><rect x="262" y="40" width="126" height="46" rx="10" /><text x="325" y="69">Impresa</text><rect x="47" y="215" width="124" height="46" rx="10" /><text x="109" y="244">Famiglia</text><rect x="192" y="99" width="110" height="46" rx="10" /><text x="247" y="128">Persona</text></g>
          <g className={styles.core}><rect x="141" y="157" width="158" height="52" rx="12" /><text x="220" y="189">Continuità</text></g>
          <g className={styles.signal}><circle cx="220" cy="337" r="5" /><circle cx="332" cy="180" r="5" /><circle cx="154" cy="180" r="5" /></g>
        </>}
        {kind === 'digital' && <>
          <g className={styles.track}><path d="M65 67H220M375 67H220M220 67V284" /></g>
          <g className={styles.flow}><path pathLength="1" d="M65 67H220M375 67H220" /><path pathLength="1" d="M220 67V175" /><path pathLength="1" d="M220 175V284" /></g>
          <g className={styles.node}><rect x="25" y="29" width="105" height="60" rx="12" /><text x="77" y="65">Dati</text><rect x="305" y="29" width="110" height="60" rx="12" /><text x="360" y="65">Attività</text></g>
          <g className={styles.node}><rect x="104" y="130" width="232" height="74" rx="14" /><text x="220" y="160">Strumenti e AI</text><text x="220" y="184" className={styles.small}>Al servizio delle persone</text></g>
          <g className={styles.core}><rect x="93" y="272" width="254" height="58" rx="14" /><text x="220" y="307">Lavoro che scorre</text></g>
          <g className={styles.signal}><circle cx="220" cy="108" r="5" /><circle cx="220" cy="238" r="5" /></g>
        </>}
      </svg>
    </div>
    <figcaption><p className={styles.words}>{words.map(word => <span key={word}>{word}</span>)}</p><p className={styles.caption}>{caption ?? captions[kind]}</p></figcaption>
  </figure>;
}
