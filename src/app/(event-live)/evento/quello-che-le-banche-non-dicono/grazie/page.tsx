import { pageMetadata } from '@/content/seo';
import Link from 'next/link';
import { eventGoogleCalendarUrl, EVENT_ICS_URL } from '@/lib/public-leads/patrimonial-event-calendar';
export const metadata = pageMetadata({
  path:'/evento/quello-che-le-banche-non-dicono/grazie',
  title:'Iscrizione confermata · Quello che le banche non dicono',
  description:'La tua iscrizione è confermata. 9 dicembre 2026, ore 21:00, online.',
  noindex:true,
});
export default function Thanks() {
  return <main style={{padding:'clamp(4rem, 8vw, 8rem) 2rem',maxWidth:760,margin:'auto'}}>
    <p style={{fontWeight:700,letterSpacing:'.12em'}}>HORYZON · BENESSERE PATRIMONIALE</p>
    <h1>La tua iscrizione è confermata!</h1>
    <p>Ti aspettiamo a «Quello che le banche non dicono» <strong>mercoledì 9 dicembre 2026, dalle 21:00 alle 22:00 (ora italiana)</strong>.</p>
    <p>L’incontro è online, gratuito, dura 60 minuti e include uno spazio per le domande. Riceverai un’email di conferma e due promemoria: il giorno prima alle 21:00 e 30 minuti prima, alle 20:30.</p>
    <p>Aggiungi l’appuntamento al calendario:</p>
    <p style={{display:'flex',flexWrap:'wrap',gap:16}}>
      <a href={eventGoogleCalendarUrl()} target="_blank" rel="noopener noreferrer">Google Calendar ↗</a>
      <a href={EVENT_ICS_URL}>Apple, Outlook o altro calendario (.ics) ↓</a>
    </p>
    <p>Le indicazioni per accedere all’evento saranno comunicate via email. Se non ricevi il riepilogo, controlla anche lo spam o scrivi a <a href="mailto:info@horyzon.it">info@horyzon.it</a>.</p>
    <Link href="/evento/quello-che-le-banche-non-dicono">Torna alla pagina dell’evento</Link>
  </main>;
}
