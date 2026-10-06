'use client';

import { useEffect, useRef, useState } from 'react';

// "Come è composta un'azienda" (call 5 Oct 2026): the organisation chart starts imploded on the owner, every
// department piled on top of them with tangled lines (the traditional company, where everything goes through you),
// then opens into five departments, each with what the Radar measures there. It plays when it scrolls into view
// and can be replayed; with reduced motion it is simply the open chart.
const DEPARTMENTS = [
  { name: 'Amministrazione', measures: 'Cassa, budget, margini, controllo della spesa' },
  { name: 'Produzione', measures: 'Procedure, qualità, reclami, inserimento dei nuovi' },
  { name: 'Commerciale', measures: 'Clienti acquisiti e persi, processo di vendita, entrate ricorrenti' },
  { name: 'Marketing', measures: 'Cliente ideale, contatti costanti, reputazione' },
  { name: 'Persone', measures: 'Selezione, ruoli chiari, clima, persone chiave' },
] as const;

// Tangled offsets (in % of the box) and tilts: the departments pile up on the owner, slightly askew.
const TANGLE = [[-38, 26, -9], [30, 40, 7], [-12, 58, 4], [42, 12, -6], [-46, 52, 11]] as const;

// On phones the open chart is two columns plus one: [left, top] of each department's centre.
const MOBILE = [['27%', '24%'], ['73%', '24%'], ['27%', '47%'], ['73%', '47%'], ['50%', '70%']] as const;

export function CompanyChart() {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let timer = 0;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { timer = window.setTimeout(() => setOpen(true), 0); return () => window.clearTimeout(timer); }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      timer = window.setTimeout(() => setOpen(true), 700);
      observer.disconnect();
    }, { threshold: 0.45 });
    observer.observe(node);
    return () => { observer.disconnect(); window.clearTimeout(timer); };
  }, []);

  const replay = () => { setOpen(false); window.setTimeout(() => setOpen(true), 900); };

  return <div ref={ref} className={open ? 'rd-co-chart is-open' : 'rd-co-chart'}>
    <p className="rd-co-state" aria-live="polite">{open ? 'Azienda organizzata: cinque reparti, ognuno con il suo metodo' : 'Azienda tradizionale: tutto passa da te'}</p>
    <div className="rd-co-board">
      <svg className="rd-co-lines" viewBox="0 0 1000 420" preserveAspectRatio="none" aria-hidden="true">
        <g className="rd-co-tangle">
          <path d="M500 50 C 300 260, 760 140, 420 300 S 650 380, 560 200 S 260 330, 470 160" />
          <path d="M500 50 C 700 250, 240 180, 610 320 S 330 360, 400 210" />
          <path d="M500 50 C 520 330, 380 240, 680 260 S 450 120, 520 340" />
        </g>
        <g className="rd-co-tree">
          <path d="M500 50 V 160 M100 160 H 900 M100 160 V 252 M300 160 V 252 M500 160 V 252 M700 160 V 252 M900 160 V 252" pathLength={1} />
        </g>
      </svg>
      <div className="rd-co-owner"><span className="rd-co-dot" aria-hidden="true" />Titolare</div>
      {DEPARTMENTS.map((department, index) => {
        const [dx, dy, rotate] = TANGLE[index]!;
        return <div key={department.name} className="rd-co-dept" style={{ '--i': index, '--dx': `${dx}%`, '--dy': `${dy}%`, '--r': `${rotate}deg`, '--mx': MOBILE[index]![0], '--my': MOBILE[index]![1] } as React.CSSProperties}>
          <b>{department.name}</b><span>{department.measures}</span>
        </div>;
      })}
    </div>
    <button type="button" className="rd-co-replay" onClick={replay} disabled={!open}>Guarda di nuovo</button>
  </div>;
}
