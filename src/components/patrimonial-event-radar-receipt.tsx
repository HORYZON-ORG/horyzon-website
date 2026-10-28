'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

/** Optional continuation after a committed receipt. The capability is short-lived,
 * kept in memory, and removed from the address bar. It grants no dossier access. */
export function EventRadarReceipt() {
  const [href, setHref] = useState('');
  useEffect(() => {
    // Read after the navigation frame installs the fragment. Strict Mode may
    // cancel this mount, so consume the fragment only inside the live callback.
    const frame = requestAnimationFrame(() => {
      const match = window.location.hash.match(/^#radar=([A-Za-z0-9_-]{43})$/);
      if (!match) return;
      window.history.replaceState(null, '', window.location.pathname);
      setHref(`/radar-patrimoniale#event=${match[1]}`);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  if (!href) return null;
  return <section className="rd-form" aria-label="Prosegui dopo la richiesta Evento">
    <h2>Una fotografia prima dell’evento.</h2>
    <p>La richiesta è stata registrata; la partecipazione non è ancora confermata. Se vuoi, prosegui con il Radar: verifica la stessa email e conferma il collegamento alla richiesta. Il collegamento scade dopo 24 ore.</p>
    <Link className="rd-cta" href={href} prefetch={false}>Prosegui con il Radar Patrimoniale</Link>
  </section>;
}
