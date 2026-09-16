'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';

export function JourneyContactForm() {
 const [prepared, setPrepared] = useState(false);
 function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const body = `Nome: ${String(data.get('name')).trim()}\nEmail: ${String(data.get('email')).trim()}\n\n${String(data.get('message')).trim()}`;
  window.location.href = `mailto:info@horyzon.it?subject=${encodeURIComponent('Parliamo della mia azienda')}&body=${encodeURIComponent(body)}`;
  setPrepared(true);
 }
 return <form className="journey-contact" onSubmit={submit} aria-labelledby="contact-title">
  <p className="chapter-label">IL PROSSIMO PASSO, INSIEME</p>
  <h3 id="contact-title">Parliamo della tua azienda.</h3>
  <p>Raccontaci da dove parti e che cosa vorresti cambiare.</p>
  <div className="contact-fields">
   <label>Il tuo nome<input name="name" autoComplete="name" required maxLength={120}/></label>
   <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
  </div>
  <label>Come possiamo aiutarti?<textarea name="message" rows={4} required maxLength={1500} placeholder="Un’esigenza, un’idea, una domanda…"/></label>
  <p className="contact-note">Si aprirà la tua app email con una bozza da inviare a <a href="mailto:info@horyzon.it">info@horyzon.it</a>. <Link href="/privacy-policy">Informazioni privacy</Link>.</p>
  <button type="submit" className="journey-button">Prepara la richiesta <span aria-hidden="true">↗</span></button>
  {prepared && <p role="status" className="contact-note">La richiesta non è ancora inviata: conferma l’invio nella tua app email. Se non si apre, puoi scrivere direttamente a info@horyzon.it.</p>}
 </form>;
}
