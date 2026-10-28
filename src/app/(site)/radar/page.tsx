import { PageStructuredData } from '@/components/structured-data';
import { pageMetadata } from '@/content/seo';
import type { Metadata } from 'next';
import Image from 'next/image';
import { CompanyChart } from '@/components/radar/company-chart';
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
  ['Tempo e utile', 'Quanto rende la tua ora', 'La tua quota di utile prima delle tasse diviso le ore che lavori, accanto al tuo stipendio.'],
  ['Priorità', 'Area forte e area prioritaria', 'Su cosa puoi contare. Da dove partire.'],
] as const;

const steps = [
  ['Contesto', 'Azienda, settore, dimensione.'],
  ['Domande', 'Cinque reparti, AI, ore, utile, stipendio e soci.'],
  ['Profilo', 'Indici, utile per ora e area prioritaria.'],
] as const;

const faqs = [
  ['Quanto tempo richiede?', 'Circa 8 minuti. Le risposte vengono salvate mentre procedi, quindi puoi riprendere più tardi.'],
  ['Il risultato è gratuito?', 'Sì. Il profilo completo si apre appena rispondi all’ultima domanda e puoi scaricarlo in PDF, senza costi e senza carta di credito.'],
  ['Devo avere dati finanziari a portata di mano?', 'Servono il fatturato annuo, una stima dell’utile aziendale prima delle tasse, le tue ore medie di lavoro, lo stipendio che ti prendi (se te lo prendi) e la tua quota, se hai dei soci. L’utile è ciò che resta dopo tutti i costi: il solo fatturato non basta.'],
  ['È una diagnosi completa?', 'No. È una prima fotografia guidata. Una diagnosi completa richiede confronto, numeri e osservazione dei processi reali. Non è una valutazione finanziaria, fiscale o legale.'],
  ['Per chi è pensato?', 'Per chi ha già un’impresa con clienti e collaboratori e sente che troppe decisioni dipendono ancora da sé. Il Radar non promette autonomia o crescita entro una data: indica da dove partire.'],
] as const;

// The landing is a closed funnel (call 5 Oct 2026): no link leads to other Horyzon pages, so the logo is not a
// link and the only way out is the privacy notice, which opens in a new tab. Traffic sources come from utm_*.
function Logo() {
  return <span className="wordmark" aria-label="Horyzon Consulting"><span className="wordmark-logo-wrap"><Image className="wordmark-logo" src="/horyzon-logo-canonical.png" alt="Horyzon Consulting" width={1670} height={390} sizes="(max-width: 850px) 138px, 178px" /></span></span>;
}
const PRIVACY = { href: '/privacy-policy', target: '_blank', rel: 'noopener' } as const;

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as React.CSSProperties;

function Cta({ position, children = 'Inizia il Radar' }: { position: string; children?: React.ReactNode }) {
  return <a className="rd-cta" href="#radar-prodotto" data-analytics-event="radar_lp_cta_click" data-cta-position={position}>{children}<span aria-hidden="true">↓</span></a>;
}

export default function CommercialRadarPage() {
  return <div className="radar-commercial rd">
    <PageStructuredData path="/radar" name="Inizia il Radar d’Impresa" description="Una prima fotografia guidata di cinque reparti, processi, autonomia dal titolare e uso dell’intelligenza artificiale." />
    <header className="rd-header"><Logo /><Cta position="header">Inizia</Cta></header>

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

      <section className="rd-company" aria-labelledby="rd-company-title">
        <header className="rd-company-head rd-reveal">
          <p className="rd-label">Cosa misura il Radar</p>
          <h2 id="rd-company-title">Un’azienda non è il suo titolare. <span>È un sistema di reparti.</span></h2>
          <p className="rd-company-def"><b>Un’azienda è un’organizzazione che trasforma il lavoro di più persone in valore per i clienti.</b> Anche la più piccola svolge cinque funzioni, che ci sia o no qualcuno dedicato a ciascuna: tenere i conti, produrre, vendere, farsi conoscere, guidare le persone. In un’azienda tradizionale, però, sono tutte schiacciate sul titolare.</p>
        </header>
        <CompanyChart />
        <p className="rd-company-foot">Il Radar misura ogni reparto con cinque domande: <b>quanto è organizzato e quanto va avanti senza di te</b>. Poi guarda l’intelligenza artificiale e i tuoi numeri: ore lavorate, utile, stipendio e quota nei soci.</p>
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
        <p className="rd-product-note">Salvataggio progressivo <i>·</i> Risultato gratuito, subito al termine <i>·</i> <a {...PRIVACY}>Privacy ↗︎</a></p>
      </section>

      <section className="rd-frank" aria-labelledby="rd-frank-title">
        <figure className="rd-frank-photo"><Image src="/people/frank-no-badge.png" alt="Frank Cannoletta" fill sizes="(max-width: 850px) 70vw, 34vw" /></figure>
        <div className="rd-reveal">
          <p className="rd-label">Frank Cannoletta · Horyzon</p>
          <h2 id="rd-frank-title" className="sr-only">Perché abbiamo costruito il Radar</h2>
          <blockquote>“Il Radar serve a rendere visibile la situazione di oggi. Il lavoro utile comincia quando la colleghiamo <em>agli obiettivi dell’impresa.</em>”</blockquote>
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
      </section>
    </main>

    <footer className="rd-footer"><Logo /><nav aria-label="Informazioni"><a {...PRIVACY}>Privacy</a><a href="mailto:info@horyzon.it">info@horyzon.it</a></nav></footer>
    <RadarDock />
  </div>;
}
