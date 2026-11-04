'use client';

import { useRef, useState, type FormEvent } from 'react';

import { digitalScenes, useDigitalSelection } from './digital-storyboard';

type Status = 'idle' | 'sending' | 'done' | 'error';
const privacyUrl = 'https://www.iubenda.com/privacy-policy/64704330';

export function DigitalLeadForm() {
  const selection = useDigitalSelection();
  const chosen = digitalScenes.filter(scene => selection?.selected.includes(scene.id));
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  // Keep the same UUID on retries; a network timeout must not create a second lead.
  const requestId = useRef<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending' || status === 'done') return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const firstName = String(values.get('firstName') ?? '').trim();
    const lastName = String(values.get('lastName') ?? '').trim();
    const company = String(values.get('company') ?? '').trim();
    const email = String(values.get('email') ?? '').trim();
    const phone = String(values.get('phone') ?? '').trim();
    const province = String(values.get('province') ?? '').trim();
    const notes = String(values.get('activity') ?? '').trim();
    const priority = String(values.get('priority') ?? '');
    const activity = chosen.length ? `Attività richieste: ${chosen.map(x => x.label).join(', ')}. Priorità: ${priority || chosen[0].label}. Note: ${notes || 'Da approfondire insieme.'}` : notes;
    const frequency = String(values.get('frequency') ?? '');
    const tools = String(values.get('tools') ?? '').trim();
    const website = String(values.get('website') ?? '');
    const consent = values.get('consent') === 'on';
    if (!consent) { setStatus('error'); setMessage('Leggi e accetta l’informativa per inviare la richiesta.'); return; }
    if (!requestId.current) requestId.current = crypto.randomUUID();
    setStatus('sending');
    setMessage('');
    try {
      const response = await fetch('/api/digital-leads', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestId.current },
        body: JSON.stringify({
          requestId: requestId.current, firstName, lastName, company, email,
          phone, province, activity, frequency, tools, website, consent,
        }),
      });
      const body: { ok?: boolean; message?: string } = await response.json();
      if (!response.ok || !body.ok) {
        setStatus('error');
        setMessage(body.message || 'Non riusciamo a confermare la ricezione. Riprova oppure scrivici a info@horyzon.it.');
        return;
      }
      selection?.complete();
      setStatus('done');
      setMessage('Richiesta registrata. Ti ricontatteremo per conoscere meglio l’attività che vuoi semplificare.');
    } catch {
      setStatus('error');
      setMessage('La connessione si è interrotta. Puoi riprovare: manterremo lo stesso riferimento per evitare duplicati.');
    }
  }

  return (
    <div className="bd-form-wrap">
      {status === 'done' ? (
        <div className="bd-form-success" role="status" aria-live="polite">
          <span className="bd-form-success-icon" aria-hidden="true">✓</span>
          <h3>Da qui si comincia.</h3>
          <p>{message}</p>
        </div>
      ) : (
        <form className="bd-lead-form" onSubmit={submit} aria-label="Richiesta Horyzon Automazioni">
          <div className="bd-form-heading">
            <h3>Partiamo dalla tua automazione.</h3>
            <p>Indica il processo, gli strumenti che usi e la priorità. Ti ricontatteremo per definire il passo successivo.</p>
          </div>
          <fieldset className="bd-chosen"><legend>Le automazioni che vuoi valutare</legend><p>Puoi aggiungere o togliere una scelta anche qui.</p><div>{digitalScenes.map(scene => <button type="button" key={scene.id} aria-pressed={selection?.selected.includes(scene.id) ?? false} onClick={() => selection?.toggle(scene.id)}>{selection?.selected.includes(scene.id) ? '✓ ' : '＋ '}{scene.label}</button>)}</div></fieldset>
          {chosen.length > 0 && <label>Da quale vuoi partire? <span aria-hidden="true">*</span><select name="priority" key={chosen.map(x => x.id).join(',')} required defaultValue=""><option value="" disabled>Scegli la priorità</option>{chosen.map(scene => <option key={scene.id} value={scene.label}>{scene.label}</option>)}</select></label>}
          <div className="bd-form-grid">
            <label>Nome <span aria-hidden="true">*</span><input name="firstName" autoComplete="given-name" required minLength={2} maxLength={80} placeholder="Il tuo nome" /></label>
            <label>Cognome <span aria-hidden="true">*</span><input name="lastName" autoComplete="family-name" required minLength={2} maxLength={80} placeholder="Il tuo cognome" /></label>
            <label>Azienda <span aria-hidden="true">*</span><input name="company" autoComplete="organization" required minLength={2} maxLength={150} placeholder="Nome dell’azienda" /></label>
            <label>Provincia <span aria-hidden="true">*</span><input name="province" autoComplete="address-level2" required minLength={2} maxLength={80} placeholder="Es. Lecce, Bari, Milano" /></label>
            <label>Email di lavoro <span aria-hidden="true">*</span><input type="email" name="email" autoComplete="email" required maxLength={254} placeholder="nome@azienda.it" /></label>
            <label>Telefono (facoltativo)<input type="tel" name="phone" autoComplete="tel" inputMode="tel" maxLength={35} placeholder="+39 ..." /></label>
          </div>
          <label>{chosen.length ? 'C’è qualcos’altro che vorresti raccontarci? (facoltativo)' : 'Quale attività vorresti semplificare? *'}<textarea name="activity" minLength={chosen.length ? undefined : 20} maxLength={700} required={!chosen.length} rows={4} placeholder="Per esempio: ogni giorno leggiamo decine di email e ricopiamo gli stessi dati nei preventivi..."/></label>
          <div className="bd-form-grid">
            <label>Quanto spesso si ripete? <span aria-hidden="true">*</span><select name="frequency" required defaultValue=""><option value="" disabled>Seleziona</option><option value="daily">Ogni giorno</option><option value="weekly">Ogni settimana</option><option value="monthly">Ogni mese</option><option value="other">Dipende dall’attività</option></select></label>
            <label>Programmi utilizzati (facoltativo)<input name="tools" maxLength={200} placeholder="Es. Outlook, Excel, gestionale..." /></label>
          </div>
          <div className="bd-honeypot" aria-hidden="true"><label>Lascia vuoto<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
          <label className="bd-form-consent"><input type="checkbox" name="consent" required /><span>Ho letto l’<a href={privacyUrl} target="_blank" rel="noopener noreferrer">informativa privacy</a> e chiedo a Horyzon di ricontattarmi per questa richiesta. <strong>*</strong> Nessuna iscrizione automatica a newsletter.</span></label>
          <button type="submit" className="bd-button bd-form-submit" disabled={status === 'sending'}>{status === 'sending' ? 'Invio in corso…' : 'Voglio valutare le mie automazioni'} <span aria-hidden="true">↗</span></button>
          {message && <p className="bd-form-feedback" role="alert" aria-live="assertive">{message}</p>}
          <p className="bd-form-small">I campi con * sono obbligatori. Non inserire password, documenti riservati o dati dei tuoi clienti.</p>
        </form>
      )}
    </div>
  );
}
