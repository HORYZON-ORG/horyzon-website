import Link from 'next/link';
import { RADAR_URL } from '@/content/product-truth';
import { SiteHeader, SiteFooter } from './site-shell';
import { Journey } from './journey/journey';
import { ChapterNavigation } from './journey/chapter-navigation';
import { BackToTopButton } from './journey/back-to-top-button';
import { FaqSection } from './faq-section';
import { publicFaqs } from '@/content/public-faq';

const wellbeingPaths = [
 { number: '01', title: 'Benessere organizzativo', text: 'Persone, ruoli e processi che sanno dove andare e come contribuire.', href: '/benessere-organizzativo' },
 { number: '02', title: 'Benessere patrimoniale', text: 'Più consapevolezza per proteggere ciò che hai costruito e scegliere con lucidità.', href: '/benessere-patrimoniale' },
 { number: '03', title: 'Benessere digitale', text: 'Tecnologia e AI che semplificano il lavoro, senza togliere controllo alle persone.', href: '/benessere-digitale' },
] as const;

export function Experience() {
 return <><SiteHeader/><ChapterNavigation/><BackToTopButton/><main id="content" className="horyzon-home"><div className="journey-story" id="percorso"><Journey/><div className="journey-content">
  <section className="journey-chapter chapter-hero" id="orizzonte" aria-labelledby="hero-title"><div className="chapter-copy"><p className="chapter-label">HORYZON CONSULTING <span>/</span> IMPRESA · ECONOMIA · UMANITÀ</p><h1 id="hero-title">Far stare bene un’impresa, <em>davvero.</em></h1><p className="chapter-intro">Aiutiamo imprenditori e aziende a lavorare con più chiarezza, più equilibrio e più futuro.</p><div className="journey-actions"><a className="journey-button" href={RADAR_URL}>Inizia il Radar <span aria-hidden="true">↗</span></a><Link className="journey-link" href="#tre-benesseri">Scopri i tre benesseri</Link></div></div><div className="chapter-caption"><span>ORGANIZZATIVO · PATRIMONIALE · DIGITALE</span><span>DAL PRESENTE AL PROSSIMO PASSO</span></div></section>
  <section className="journey-chapter chapter-current" id="radar" aria-labelledby="radar-title"><div className="chapter-copy"><p className="chapter-label">01 / IL PUNTO DI PARTENZA</p><h2 id="radar-title">Prima di cambiare, capiamo <em>da dove partire.</em></h2><p className="chapter-intro">Il Radar aiuta a leggere la situazione della tua impresa e a individuare ciò che oggi merita più attenzione.</p><div className="journey-actions"><a className="journey-button" href={RADAR_URL}>Inizia il Radar <span aria-hidden="true">↗</span></a><Link className="journey-link" href="/radar-impresa">Scopri come funziona</Link></div></div></section>
  <section className="journey-chapter chapter-dimensions" id="tre-benesseri" aria-labelledby="wellbeing-title"><div className="chapter-copy"><p className="chapter-label">02 / I TRE BENESSERI</p><h2 id="wellbeing-title">Tre benesseri. <em>Una direzione.</em></h2><p className="chapter-intro">Un’impresa cresce quando persone, patrimonio e strumenti lavorano insieme.</p><div className="dimension-paths wellbeing-paths">{wellbeingPaths.map(path=><Link href={path.href} key={path.href}><span className="dimension-number">{path.number}</span><div><h3>{path.title}</h3><p>{path.text}</p></div><span className="dimension-arrow" aria-hidden="true">↗</span></Link>)}</div></div></section>
  <section className="journey-chapter chapter-method" id="come-lavoriamo" aria-labelledby="method-title"><div className="chapter-copy"><p className="chapter-label">03 / COME LAVORIAMO</p><h2 id="method-title">Dalla chiarezza al <em>cambiamento.</em></h2><p className="chapter-intro">Partiamo dalla realtà di oggi, scegliamo la priorità e la trasformiamo in un percorso concreto.</p><ol className="journey-method">{['Capire','Scegliere','Far accadere'].map((stage,index)=><li key={stage}><span>{String(index+1).padStart(2,'0')}</span>{stage}</li>)}</ol><div className="journey-actions"><Link href="/metodo" className="journey-link">Scopri come lavoriamo <span aria-hidden="true">↗</span></Link></div></div></section>
  <section className="journey-chapter chapter-arrival" id="parliamone" aria-labelledby="arrival-title"><div className="chapter-copy"><p className="chapter-label">04 / IL PROSSIMO PASSO</p><h2 id="arrival-title">Il tuo prossimo orizzonte comincia <em>da qui.</em></h2><p className="chapter-intro">Non serve avere già tutte le risposte. Serve iniziare dalla domanda giusta.</p><div className="journey-actions"><Link className="journey-button" href="/contatti">Parliamo della tua impresa <span aria-hidden="true">↗</span></Link></div></div></section>
  <FaqSection items={publicFaqs['/']} variant="dark" />
 </div></div></main><SiteFooter/></>;
}
