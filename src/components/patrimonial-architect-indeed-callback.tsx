'use client';

import { useRef, useState, type FormEvent } from 'react';
import type { IndeedProvince } from '@/lib/public-leads/architect-indeed-provinces';
import styles from './patrimonial-architect-startup.module.css';

const endpoint = '/api/architect-startup/indeed-callback';

async function callbackRequest(body: Record<string, unknown>) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.timeout(22000),
    body: JSON.stringify(body),
  });
  const data: { ok?: boolean; token?: string; message?: string } = await response.json();
  if (!response.ok || data.ok !== true) throw new Error(data.message || 'Non è stato possibile completare la richiesta. Riprova.');
  return data;
}

export function useIndeedCallbackSession(enabled: boolean, province: IndeedProvince) {
  const tokenRef = useRef('');
  const openingRef = useRef(false);
  const [token, setToken] = useState('');
  const [sessionError, setSessionError] = useState(false);

  async function begin() {
    if (!enabled || tokenRef.current || openingRef.current) return;
    openingRef.current = true;
    setSessionError(false);
    try {
      const result = await callbackRequest({ action: 'start', ...(province === 'bari' ? {} : { province }) });
      if (typeof result.token !== 'string' || !result.token) throw new Error('Missing session');
      tokenRef.current = result.token;
      setToken(result.token);
    } catch {
      setSessionError(true);
    } finally {
      openingRef.current = false;
    }
  }

  return { token, sessionError, begin };
}

export function IndeedStartupCallbackForm({ token, province }: { token: string; province: IndeedProvince }) {
  const sendingRef = useRef(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || sendingRef.current || status === 'success') return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const fields = new FormData(form);
    sendingRef.current = true;
    setStatus('sending');
    setError('');
    try {
      await callbackRequest({
        action: 'confirm', token,
        ...(province === 'bari' ? {} : { province }),
        fullName: String(fields.get('fullName') ?? '').trim(),
        email: String(fields.get('email') ?? '').trim(),
        contactRequested: true,
      });
      setStatus('success');
    } catch (cause) {
      setError(cause instanceof Error && cause.message && cause.name === 'Error'
        ? cause.message : 'Non riusciamo a inviare la conferma. Riprova senza compilare una nuova candidatura.');
      setStatus('error');
    } finally {
      sendingRef.current = false;
    }
  }

  if (status === 'success') return <div className={styles.success} role="status">
    <strong>Conferma inviata</strong>
    <p>Il team HORYZON ha ricevuto la tua richiesta. Ti ricontatteremo per fissare il colloquio di selezione online.</p>
  </div>;

  return <form className={styles.indeedCallbackForm} onSubmit={submit} aria-label="Conferma la visione della Startup" aria-busy={status === 'sending'}>
    <p className={styles.readyNote}>Hai concluso la Startup. Conferma qui la visione per organizzare il colloquio online.</p>
    <label>Nome e cognome
      <input name="fullName" type="text" autoComplete="name" required minLength={2} maxLength={120} disabled={status === 'sending'} />
    </label>
    <label>Email di contatto
      <input name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} aria-describedby="indeed-email-hint" disabled={status === 'sending'} />
    </label>
    <p id="indeed-email-hint" className={styles.confirmHint}>Se puoi, usa l’indirizzo indicato nel CV. Questi dati servono solo a riconoscere la candidatura e ricontattarti. <a href="https://www.iubenda.com/privacy-policy/64704330" target="_blank" rel="noopener noreferrer">Informativa privacy</a>.</p>
    <button className={styles.confirmButton} disabled={status === 'sending'} type="submit">
      <span className={styles.confirmButtonText}>{status === 'sending' ? 'Invio in corso…' : 'Ho completato la visione e chiedo di essere ricontattato'}</span>
      <span className={styles.confirmArrow} aria-hidden="true">↗</span>
    </button>
    {status === 'error' && <p className={styles.error} role="alert">{error}</p>}
  </form>;
}
