'use client';

import { useEffect, useState } from 'react';

// Floating "Inizia il Radar" bar: appears once the hero has scrolled away and hides while the
// questionnaire or the final call to action are on screen, so it never covers the product itself.
export function RadarDock() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) seen.set(entry.target.id, entry.isIntersecting);
      setVisible(!seen.get('rd-hero') && !seen.get('radar-prodotto') && !seen.get('rd-final'));
    }, { threshold: 0.05 });
    for (const id of ['rd-hero', 'radar-prodotto', 'rd-final']) { const element = document.getElementById(id); if (element) { seen.set(id, true); observer.observe(element); } }
    return () => observer.disconnect();
  }, []);
  return <div className={visible ? 'rd-dock is-visible' : 'rd-dock'} aria-hidden={!visible}>
    <span className="rd-dock-meta">Radar d’Impresa <b>· 8 min</b></span>
    <a className="rd-cta" href="#radar-prodotto" tabIndex={visible ? 0 : -1} data-analytics-event="radar_lp_cta_click" data-cta-position="dock">Inizia<span aria-hidden="true">↓</span></a>
  </div>;
}
