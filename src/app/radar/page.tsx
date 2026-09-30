import { PageStructuredData } from '@/components/structured-data';
import { pageMetadata } from '@/content/seo';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Wordmark } from '@/components/site-shell';
import { OwnerStory } from '@/components/radar/owner-story';
import { RadarClient } from '@/components/radar/radar-client';
import { RadarDock } from '@/components/radar/radar-dock';
import { RadarScope } from '@/components/radar/radar-scope';
import '@/styles/horyzon-landing.css';

export const metadata: Metadata = pageMetadata({ path: '/radar', title: 'Inizia il Radar d’Impresa', description: 'Una prima fotografia guidata di cinque reparti, processi, autonomia dal titolare e uso dell’intelligenza artificiale.', noindex: true });

const outputs = [
  ['Profilo', 'Profilo sulle cinque aree', 'Dove l’impresa è solida e dove è scoperta.'],
  ['Processi', 'Maturità dei processi', 'Quanto il lavoro poggia su metodi condivisi.'],
  ['Autonomia', 'Autonomia dal titolare', 'Quanto l’impresa va avanti senza di te.'],
  ['Sintesi', 'Indice globale', 'Struttura e autonomia in un solo valore.'],
  ['AI', 'Intelligenza artificiale', 'Quanto l’AI è presente e se il team è pronto.'],
  ['Priorità', 'Area forte e area prioritaria', 'Su cosa puoi contare. Da dove partire.'],
] as const;

const steps = [
  ['Contesto', 'Azienda, settore, dimensione.'],
  ['Domande', 'Una alla volta, sui cinque reparti e sull’AI.'],
  ['Profilo', 'Indici, area forte e area prioritaria.'],
] as const;

const faqs = [
  ['Quanto tempo richiede?', 'Circa 8 minuti. Le risposte vengono salvate mentre procedi, quindi puoi riprendere più tardi.'],
  ['Il risultato è gratuito?', 'No. Il profilo viene calcolato al termine e si sblocca dopo il pagamento. Il prezzo è mostrato prima dell’acquisto.'],
  ['Devo avere dati finanziari a portata di mano?', 'No. Rispondi in base a ciò che accade oggi nella tua impresa. Non inserire dati di clienti, dipendenti o altre informazioni sensibili.'],
  ['È una diagnosi completa?', 'No. È una prima fotografia guidata. Una diagnosi completa richiede confronto, numeri e osservazione dei processi reali. Non è una valutazione finanziaria, fiscale o legale.'],
  ['Per chi è pensato?', 'Per chi ha già un’impresa con clienti e collaboratori e sente che troppe decisioni dipendono ancora da sé. Il Radar non promette autonomia o crescita entro una data: indica da dove partire.'],
] as const;

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as React.CSSProperties;

function Cta({ position, children = 'Inizia il Radar' }: { position: string; children?: React.ReactNode }) {
  return <a className="rd-cta" href="#radar-prodotto" data-analytics-event="radar_lp_cta_click" data-cta-position={position}>{children}<span aria-hidden="true">↓</span></a>;
}

export default function CommercialRadarPage() {
  return <div className="radar-commercial rd">
    <PageStructuredData path="/radar" name="Inizia il Radar d’Impresa" description="Una prima fotografia guidata di cinque reparti, processi, autonomia dal titolare e uso dell’intelligenza artificiale." />
    <header className="rd-header"><Wordmark /><Cta position="header">Inizia</Cta></header>

    <main id="content">
      <section id="rd-hero" className="rd-hero" aria-labelledby="rd-hero-title">
        <div className="rd-hero-copy">
          <p className="rd-label rd-rise" style={delay(0)}>Radar d’Impresa <i>·</i> 5 reparti <i>·</i> 8 minuti</p>
          <h1 id="rd-hero-title"><span className="rd-mask"><span className="rd-line" style={delay(120)}>La tua azienda funziona.</span></span> <span className="rd-mask"><span className="rd-line rd-accent" style={delay(320)}>Ma funziona perché ci sei tu.</span></span></h1>
          <p className="rd-lead rd-rise" style={delay(620)}>Il Radar ti mostra dove l’impresa sta in piedi da sola e dove aspetta ancora te.</p>
          <div className="rd-actions rd-rise" style={delay(760)}><Cta position="hero" /><a className="rd-link" href="#rd-story-title">Prima fammi vedere</a></div>
        </div>
        <RadarScope className="rd-hero-scope" />
      </section>

      <OwnerStory />

      <section className="rd-map" aria-labelledby="rd-map-title">
        <header className="rd-reveal"><p className="rd-label">Il risultato</p><h2 id="rd-map-title">Non un’etichetta. <span>Una mappa.</span></h2></header>
        <ul className="rd-tiles">
          {outputs.map(([tag, title, text], index) => <li key={title} className="rd-tile rd-reveal" style={{ '--i': index } as React.CSSProperties}><span className="rd-tile-tag">{tag}</span><h3>{title}</h3><p>{text}</p></li>)}
        </ul>
        <p className="rd-map-note">Il risultato non sostituisce l’analisi di numeri e processi reali.</p>
      </section>

      <section id="radar-prodotto" className="rd-product" aria-labelledby="rd-product-title">
        <header className="rd-product-head">
          <p className="rd-label">Tocca a te</p>
          <h2 id="rd-product-title">Da dove parte <em>la tua impresa?</em></h2>
          <ol className="rd-steps">{steps.map(([title, text]) => <li key={title}><b>{title}</b><span>{text}</span></li>)}</ol>
        </header>
        <RadarClient />
        <p className="rd-product-note">Salvataggio progressivo <i>·</i> Risultato a pagamento, prezzo mostrato prima dell’acquisto <i>·</i> <Link href="/privacy-policy">Privacy ↗︎</Link></p>
      </section>

      <section className="rd-frank" aria-labelledby="rd-frank-title">
        <figure className="rd-frank-photo"><Image src="/people/frank-no-badge.png" alt="Frank Cannoletta" fill sizes="(max-width: 850px) 70vw, 34vw" /></figure>
        <div className="rd-reveal">
          <p className="rd-label">Frank Cannoletta · Horyzon</p>
          <h2 id="rd-frank-title" className="sr-only">Perché abbiamo costruito il Radar</h2>
          <blockquote>“Il Radar serve a rendere visibile la situazione di oggi. Il lavoro utile comincia quando la colleghiamo <em>agli obiettivi dell’impresa.</em>”</blockquote>
          <Link className="rd-link" href="/metodo">Come lavora Horyzon ↗︎</Link>
        </div>
      </section>

      <section className="rd-faq" aria-labelledby="rd-faq-title">
        <h2 id="rd-faq-title">Prima di iniziare.</h2>
        <div>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true" /></summary><p>{answer}</p></details>)}</div>
      </section>

      <section id="rd-final" className="rd-final" aria-labelledby="rd-final-title">
        <RadarScope className="rd-final-scope" />
        <p className="rd-label">Il prossimo passo</p>
        <h2 id="rd-final-title">Prima di aggiungere un altro strumento, <em>scegli dove intervenire.</em></h2>
        <Cta position="final" />
        <Link className="rd-link" href="/radar-impresa">Preferisci capire prima il metodo?</Link>
      </section>
    </main>

    <footer className="rd-footer"><Wordmark /><nav aria-label="Informazioni"><Link href="/radar-impresa">Radar d’Impresa</Link><Link href="/privacy-policy">Privacy</Link><a href="mailto:info@horyzon.it">info@horyzon.it</a></nav></footer>
    <RadarDock />
  </div>;
}
