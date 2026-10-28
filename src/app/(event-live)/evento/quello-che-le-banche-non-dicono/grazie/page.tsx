import { pageMetadata } from '@/content/seo';
import Link from 'next/link';
export const metadata = pageMetadata({path:'/evento/quello-che-le-banche-non-dicono/grazie',title:'Richiesta ricevuta',description:'Informazioni sulla tua richiesta di partecipazione all’evento.',noindex:true});
export default function Thanks() {return <main style={{padding:'8rem 2rem',maxWidth:760,margin:'auto'}}><h1>Grazie per il tuo interesse.</h1><p>Le informazioni sull’evento saranno disponibili nella pagina ufficiale.</p><Link href="/evento/quello-che-le-banche-non-dicono">Torna all’evento</Link></main>}
