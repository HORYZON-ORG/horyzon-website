'use client';

import { useState } from 'react';
import styles from './radar.module.css';

export function RadarPaymentGate({ onPreviewUnlocked }: { onPreviewUnlocked: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  return <section className={styles.panel} aria-labelledby="radar-payment-title">
    <p className={styles.kicker}>Radar completato</p><h2 id="radar-payment-title">Il tuo profilo è pronto.</h2>
    <p>Il risultato dettagliato è un prodotto a pagamento. Il prezzo e l’acquisto saranno disponibili quando il catalogo verrà attivato.</p>
    <button type="button" disabled>Acquisto non ancora attivo</button>
    <button type="button" className={styles.previewTrigger} onClick={() => setOpen((value) => !value)}>Sblocca anteprima</button>
    {open ? <form className={styles.pin} onSubmit={async (event) => { event.preventDefault(); setError(''); const response = await fetch('/api/radar/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) }); if (!response.ok) { setError('PIN non valido o temporaneamente bloccato.'); return; } await onPreviewUnlocked(); }}><label htmlFor="radar-preview-pin">PIN anteprima</label><input id="radar-preview-pin" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} autoComplete="off"/><button type="submit">Apri risultato</button>{error ? <p role="alert">{error}</p> : null}</form> : null}
  </section>;
}
