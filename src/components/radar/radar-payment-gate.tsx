'use client';

import { useEffect, useState } from 'react';
import styles from './radar.module.css';

export function RadarPaymentGate({ onPreviewUnlocked, onRestart }: { onPreviewUnlocked: () => Promise<void>; onRestart: () => void }) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checkoutPending, setCheckoutPending] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('checkout') !== 'success') return;
    const timer = window.setInterval(async () => { const response = await fetch('/api/radar/status', { cache: 'no-store' }); if (!response.ok) return; const payload = await response.json(); if (payload.unlocked) { window.clearInterval(timer); await onPreviewUnlocked(); } }, 1500);
    return () => window.clearInterval(timer);
  }, [onPreviewUnlocked]);
  return <section className={styles.panel} aria-labelledby="radar-payment-title">
    <p className={styles.kicker}>Radar completato</p><h2 id="radar-payment-title">Il tuo profilo è pronto.</h2>
    <p>Il risultato dettagliato è un prodotto a pagamento. Il prezzo e l’acquisto saranno disponibili quando il catalogo verrà attivato.</p>
    <button type="button" disabled={checkoutPending} onClick={async () => { setCheckoutPending(true); setError(''); const response = await fetch('/api/radar/checkout', { method: 'POST' }); const payload = await response.json(); if (response.ok && payload.checkoutUrl) { window.location.assign(payload.checkoutUrl); return; } setCheckoutPending(false); setError('Acquisto non ancora attivo.'); }}>{checkoutPending ? 'Apertura pagamento…' : 'Acquista il risultato'}</button>
    <div className={styles.cardFoot}><button type="button" className={styles.restart} onClick={onRestart}>Rifai il test da zero</button><button type="button" className={styles.previewTrigger} aria-expanded={open} onClick={() => setOpen((value) => !value)}>Sblocca anteprima</button></div>
    {open ? <form className={styles.pin} onSubmit={async (event) => { event.preventDefault(); setError(''); const response = await fetch('/api/radar/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) }); if (!response.ok) { setError('PIN non valido o temporaneamente bloccato.'); return; } await onPreviewUnlocked(); }}><label htmlFor="radar-preview-pin">PIN anteprima</label><input id="radar-preview-pin" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} autoComplete="off"/><button type="submit">Apri risultato</button>{error ? <p role="alert">{error}</p> : null}</form> : null}
  </section>;
}
