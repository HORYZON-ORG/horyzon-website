'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { patrimonialInterest, patrimonialInterests, type PatrimonialInterest } from '@/content/patrimonial';

export function PatrimonialLeadForm() {
  const params = useSearchParams();
  const selected = patrimonialInterest(params.get('interesse')) ?? 'evento-patrimoniale';
  const requested = patrimonialInterest(params.get('interesse'));
  useEffect(() => {
    if (!requested) return;
    const frame = requestAnimationFrame(() => document.getElementById('richiesta-patrimoniale')?.scrollIntoView({ block: 'start', behavior: 'instant' }));
    return () => cancelAnimationFrame(frame);
  }, [requested]);
  return <LeadForm key={selected} initialInterest={selected} />;
}
function LeadForm({ initialInterest }: { initialInterest: PatrimonialInterest }) {
  const [interest, setInterest] = useState(initialInterest);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [notice, setNotice] = useState('');
  const content = patrimonialInterests[interest];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending' || status === 'success') return;
    const data = new FormData(event.currentTarget);
    setStatus('sending'); setNotice('');
    try {
      const response = await fetch('/api/public-leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(35000), body: JSON.stringify({ interest, name: data.get('name'), email: data.get('email'), phone: data.get('phone'), message: data.get('message'), consent: data.get('consent') === 'on', website: data.get('website') }) });
      const result = await response.json();
      if (!response.ok || result.ok !== true) { setStatus('error'); setNotice(typeof result.message === 'string' ? result.message : 'Invio non confermato. Riprova oppure scrivici.'); return; }
      setStatus('success'); setNotice('Richiesta ricevuta. Ti ricontatteremo per il percorso che hai scelto.');
    } catch { setStatus('error'); setNotice('Invio non confermato. Riprova oppure scrivici via email.'); }
  }
  return <form className="rd-form" onSubmit={submit} aria-labelledby="patrimonial-contact-title">
    <fieldset disabled={status === 'sending' || status === 'success'} className="patrimonial-form-fields">
      <legend>Di quale percorso vuoi informazioni?</legend>
      <div className="patrimonial-interest-options">{Object.entries(patrimonialInterests).map(([key, item]) => <label key={key}><input type="radio" name="interest-choice" value={key} checked={interest === key} onChange={() => { setInterest(key as PatrimonialInterest); setStatus('idle'); setNotice(''); }} />{item.label}</label>)}</div>
      <h3 id="patrimonial-contact-title">{content.title}</h3><p>{content.intro}</p>
      <div className="rd-form-fields"><label>Nome e cognome<input name="name" autoComplete="name" required maxLength={120} /></label><label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label></div>
      <label>Telefono <span>(facoltativo)</span><input name="phone" type="tel" autoComplete="tel" maxLength={40} /></label>
      <label>{interest === 'percorso-consulenti' ? 'La tua esperienza e che cosa cerchi' : 'Che cosa vorresti approfondire'} <span>(facoltativo)</span><textarea name="message" rows={4} maxLength={1500} /></label>
      <div hidden><label>Sito web<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label className="patrimonial-consent"><input name="consent" type="checkbox" required /> <span>Ho letto l’<Link href="/privacy-policy">informativa privacy</Link> e chiedo di essere ricontattato per questa richiesta.</span></label>
      <p className="rd-form-note">I dati della richiesta sono trasmessi al CRM HighLevel di Horyzon per gestire il ricontatto. Questo modulo non iscrive a campagne marketing e non prenota un posto all’evento.</p>
      <button type="submit" className="rd-cta">{status === 'sending' ? 'Invio in corso…' : status === 'success' ? 'Richiesta ricevuta' : 'Invia la richiesta'} <span aria-hidden="true">↗︎</span></button>
    </fieldset>
    {notice && <p role={status === 'error' ? 'alert' : 'status'} className="rd-form-note">{notice}</p>}
    <p className="rd-form-note">Preferisci scriverci? <a href={`mailto:info@horyzon.it?subject=${encodeURIComponent(content.subject)}`}>Contattaci via email ↗︎</a>.</p>
  </form>;
}
