import { pageMetadata } from '@/content/seo';
import Link from 'next/link';
export const metadata = pageMetadata({
  path:'/evento/quello-che-le-banche-non-dicono/grazie',
  title:'Richiesta di partecipazione ricevuta',
  description:'Abbiamo ricevuto la tua richiesta per la prossima edizione. Il calendario non è ancora disponibile.',
  noindex:true,
});
export default function Thanks() {
  return <main style={{padding:'clamp(4rem, 8vw, 8rem) 2rem',maxWidth:760,margin:'auto'}}>
    <p style={{fontWeight:700,letterSpacing:'.12em'}}>HORYZON · BENESSERE PATRIMONIALE</p>
    <h1>Abbiamo ricevuto la tua richiesta.</h1>
    <p>Hai manifestato interesse a partecipare alla prossima edizione di «Quello che le banche non dicono».</p>
    <p><strong>Le date non sono ancora state fissate:</strong> questa ricevuta non è una conferma del posto né contiene un link di accesso. Ti contatteremo per questo evento quando saranno disponibili calendario e modalità di partecipazione.</p>
    <p>Ti invieremo anche un riepilogo all’indirizzo email che hai indicato. Se non lo trovi, controlla la cartella spam oppure scrivici: la registrazione della richiesta resta valida.</p>
    <p>Per informazioni puoi scrivere a <a href="mailto:info@horyzon.it">info@horyzon.it</a>.</p>
    <Link href="/evento/quello-che-le-banche-non-dicono">Torna alla pagina dell’evento</Link>
  </main>;
}
