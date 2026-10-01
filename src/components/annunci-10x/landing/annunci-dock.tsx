'use client';

import { useEffect, useState } from 'react';

// Floating "Valuta" bar, same behaviour as the Radar dock: it appears once the hero has scrolled away and
// hides while the free Score, the price or the final call to action are on screen.
const WATCHED = ['ax-hero', 'valuta', 'annuncio-10x', 'ax-final'];

export function AnnunciDock() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) seen.set(entry.target.id, entry.isIntersecting);
      setVisible(WATCHED.every((id) => !seen.get(id)));
    }, { threshold: 0.05 });
    for (const id of WATCHED) { const element = document.getElementById(id); if (element) { seen.set(id, true); observer.observe(element); } }
    return () => observer.disconnect();
  }, []);
  return <div className={visible ? 'rd-dock is-visible' : 'rd-dock'} aria-hidden={!visible}>
    <span className="rd-dock-meta">Score gratuito <b>· 2 min</b></span>
    <a className="rd-cta" href="#valuta" tabIndex={visible ? 0 : -1} data-analytics-event="annunci10x_lp_cta_click" data-cta-position="dock">Valuta<span aria-hidden="true">↓</span></a>
  </div>;
}
