'use client';

import { useEffect, useRef } from 'react';
import type { VisionRoute } from '@/content/vision';
import styles from './vision.module.css';

export function VisionScene({ page, caption }: { page: VisionRoute; caption: string }) {
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
  }, [page]);

  return <figure ref={figure} className={styles.scene} data-vision-scene={page}>
    <div className={styles.diagram}>
      <svg viewBox="0 0 440 380" aria-hidden="true" focusable="false">
        <g className={styles.grid}><path d="M0 95H440M0 190H440M0 285H440M110 0V380M220 0V380M330 0V380" /></g>
        {page === 'horyzon' && <>
          <g className={styles.guides}><circle cx="220" cy="190" r="145" /><path d="M220 60L80 295H360Z" /></g>
          <g className={styles.flow}><path pathLength="1" d="M220 174V73" /><path pathLength="1" d="M185 213L89 284" /><path pathLength="1" d="M255 213L351 284" /></g>
          <g className={styles.node}><rect x="152" y="35" width="136" height="52" rx="12" /><text x="220" y="67">Impresa</text><rect x="20" y="280" width="138" height="52" rx="12" /><text x="89" y="312">Economia</text><rect x="284" y="280" width="134" height="52" rx="12" /><text x="351" y="312">Umanità</text></g>
          <g className={styles.core}><rect x="136" y="165" width="168" height="62" rx="14" /><text x="220" y="202">Orizzonte</text></g>
          <g className={styles.signal}><circle cx="220" cy="129" r="5" /><circle cx="124" cy="258" r="5" /><circle cx="318" cy="258" r="5" /></g>
        </>}
        {page === 'impresa' && <>
          <g className={styles.guides}><path d="M220 90V185H76V251M220 185V251M220 185H364V251" /></g>
          <g className={styles.flow}><path pathLength="1" d="M220 90V185H76V251" /><path pathLength="1" d="M220 185V251" /><path pathLength="1" d="M220 185H364V251" /></g>
          <g className={styles.core}><rect x="137" y="50" width="166" height="62" rx="14" /><text x="220" y="87">Impresa</text></g>
          <g className={styles.node}><rect x="17" y="251" width="118" height="56" rx="12" /><text x="76" y="285">Persone</text><rect x="161" y="251" width="118" height="56" rx="12" /><text x="220" y="285">Processi</text><rect x="305" y="251" width="118" height="56" rx="12" /><text x="364" y="285">Valore</text></g>
          <g className={styles.signal}><circle cx="76" cy="220" r="5" /><circle cx="220" cy="220" r="5" /><circle cx="364" cy="220" r="5" /></g>
        </>}
        {page === 'economia' && <>
          <g className={styles.guides}><circle cx="220" cy="188" r="127" /><circle cx="220" cy="188" r="80" /></g>
          <g className={styles.flow}><path pathLength="1" d="M220 61A127 127 0 0 1 330 251" /><path pathLength="1" d="M330 251A127 127 0 0 1 110 251" /><path pathLength="1" d="M110 251A127 127 0 0 1 220 61" /></g>
          <g className={styles.node}><rect x="158" y="35" width="124" height="50" rx="12" /><text x="220" y="66">Risorse</text><rect x="281" y="250" width="118" height="50" rx="12" /><text x="340" y="281">Scelte</text><rect x="40" y="250" width="118" height="50" rx="12" /><text x="99" y="281">Valore</text></g>
          <g className={styles.core}><rect x="149" y="158" width="142" height="62" rx="14" /><text x="220" y="195">Comunità</text></g>
          <g className={styles.signal}><circle cx="335" cy="133" r="5" /><circle cx="220" cy="315" r="5" /><circle cx="104" cy="133" r="5" /></g>
        </>}
        {page === 'umanita' && <>
          <g className={styles.rings}><circle cx="220" cy="128" r="103" /><circle cx="159" cy="228" r="103" /><circle cx="281" cy="228" r="103" /></g>
          <g className={styles.node}><rect x="167" y="46" width="106" height="44" rx="10" /><text x="220" y="74">Mente</text><rect x="65" y="262" width="106" height="44" rx="10" /><text x="118" y="290">Corpo</text><rect x="269" y="262" width="106" height="44" rx="10" /><text x="322" y="290">Spirito</text></g>
          <g className={styles.core}><rect x="147" y="169" width="146" height="60" rx="14" /><text x="220" y="205">Persona</text></g>
          <g className={styles.signal}><circle cx="220" cy="117" r="5" /><circle cx="128" cy="222" r="5" /><circle cx="313" cy="222" r="5" /></g>
        </>}
      </svg>
    </div>
    <figcaption className={styles.caption}>{caption}</figcaption>
  </figure>;
}
