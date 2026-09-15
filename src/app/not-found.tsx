import Link from 'next/link';
import {SiteHeader,SiteFooter} from '@/components/site-shell';
export default function NotFound(){return <><SiteHeader/><main id="content" className="inside"><section className="inside-hero"><p className="eyebrow">404 / Cambiamo prospettiva</p><h1>Un altro orizzonte<br/>ti aspetta.</h1><p>Questa pagina non esiste. Riparti dalla visione Horyzon.</p><Link href="/" className="button primary">Torna alla home ↗</Link></section></main><SiteFooter/></>}
