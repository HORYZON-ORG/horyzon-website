import { Annunci10xClient } from '@/components/annunci-10x/annunci-10x-client';
import { AdSheet } from '@/components/annunci-10x/landing/ad-sheet';
import { AnnunciDock } from '@/components/annunci-10x/landing/annunci-dock';
import { CandidateStory } from '@/components/annunci-10x/landing/candidate-story';
import { CreateCta } from '@/components/annunci-10x/landing/create-cta';
import { SITE_URL } from '@/content/seo';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import '@/styles/horyzon-landing.css';
import './annunci-landing.css';

const title = 'Annunci 10x — Score di chiarezza e annuncio pronto a 7 €';
const description = 'Valuta gratis chiarezza e completezza del tuo annuncio. Poi scegli Annuncio 10x: 7 € per un annuncio, una versione e un canale.';
const image = `${SITE_URL}/opengraph-image`;

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: `${SITE_URL}/annunci-10x` },
  robots: { index: false, follow: false, nocache: true },
  openGraph: {
    title,
    description,
    url: `${SITE_URL}/annunci-10x`,
    siteName: 'Horyzon Consulting Recruiting',
    locale: 'it_IT',
    type: 'website',
    images: [image],
  },
  twitter: { card: 'summary_large_image', title, description, images: [image] },
};

// Same structure as /radar: one idea per section, one gesture (the ad under the lens), one lime field.
// The copy states only what the product does; the score itself is never shown or invented here.
const scoreDisclaimer = 'Il punteggio valuta la chiarezza e la completezza delle informazioni disponibili nell’annuncio. Non prevede il numero di candidature né sostituisce la valutazione delle persone.';
const guaranteeCopy = '7 € per un annuncio, una versione e un canale. Dopo la conferma del pagamento generiamo il testo completo e te lo rendiamo disponibile. Se non ti è utile, puoi chiedere il rimborso integrale entro 14 giorni dalla consegna, senza motivazione, scrivendo a info@horyzon.it dall’email usata per l’acquisto.';

const outputs = [
  ['Score', 'Score di chiarezza', 'Un valore su 100, calcolato sui 20 controlli valutabili.'],
  ['Fascia', 'Da Critico a Eccellente', 'Descrive chiarezza e completezza, non la probabilità di assumere.'],
  ['Priorità', 'Aree prioritarie', 'I punti che frenano di più la comprensione del ruolo.'],
  ['Motivo', 'Motivazione', 'Perché quel punto è debole, rispetto a ciò che c’è scritto.'],
  ['Mancanze', 'Informazioni da chiarire', 'I dati che mancano e che solo tu puoi confermare.'],
  ['Report', 'Indicazioni via email', 'Le indicazioni operative arrivano nel report via email.'],
] as const;

const steps = [
  ['Incolla', 'Il testo dell’annuncio o il link pubblico.'],
  ['Verifica', 'Un codice di 6 cifre alla tua email.'],
  ['Score', 'Il risultato qui, il report completo via email.'],
] as const;

const roles = ['operaio di produzione', 'saldatore', 'manutentore meccanico', 'elettricista', 'tecnico installatore', 'magazziniere carrellista', 'autista patente C', 'commerciale B2B', 'impiegato amministrativo', 'addetto alla contabilità', 'cuoco', 'cameriere di sala'];

const faqs = [
  ['Quanto costa?', 'Lo Score è gratuito. Annuncio 10x costa 7 €: un annuncio, una versione e un canale. Puoi arrivarci partendo da un testo esistente o da un brief guidato.'],
  ['Perché mi chiedete l’email?', 'Serve per collegare il report alla tua richiesta e inviartelo. Comunicazioni marketing solo con consenso separato.'],
  ['Mi garantite più candidature?', 'No. Le candidature dipendono da mercato, canale, condizioni e attrattività dell’offerta. Annunci 10x lavora su chiarezza e coerenza dell’annuncio.'],
  ['Usate l’intelligenza artificiale?', 'Sì. L’intelligenza artificiale applica i controlli del metodo. Il sistema è progettato per non riempire informazioni mancanti con fatti professionali inventati.'],
  ['Funziona anche per ruoli operativi?', `Sì. È pensato per i ruoli che assumono davvero le PMI: ${roles.join(', ')}.`],
] as const;

function Cta({ position, children = 'Valuta il mio annuncio' }: { position: string; children?: React.ReactNode }) {
  return <a className="rd-cta" href="#valuta" data-analytics-event="annunci10x_lp_cta_click" data-cta-position={position}>{children}<span aria-hidden="true">↓</span></a>;
}

function Brand() {
  return <Link href="/" className="ax-brand" aria-label="Horyzon Consulting Recruiting"><Image src="/annunci-10x/horyzon-consulting-recruiting-white.png" alt="" width={2048} height={768} sizes="(max-width: 600px) 168px, 220px" aria-hidden="true" unoptimized /></Link>;
}

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as React.CSSProperties;

export default function Annunci10xPage() {
  return <div className="rd ax">
    <a className="ax-skip" href="#content">Salta al contenuto</a>
    <header className="rd-header"><Brand /><Cta position="header">Valuta gratis</Cta></header>

    <main id="content" data-page="annunci-10x">
      <section id="ax-hero" className="rd-hero ax-hero" aria-labelledby="ax-hero-title">
        <div className="rd-hero-copy">
          <p className="rd-label rd-rise" style={delay(0)}>Annunci 10x <i>·</i> Score gratuito <i>·</i> 2 minuti</p>
          <h1 id="ax-hero-title"><span className="rd-mask"><span className="rd-line" style={delay(120)}>Il tuo annuncio riceve CV.</span></span> <span className="rd-mask"><span className="rd-line rd-accent" style={delay(320)}>Ma sono quelli giusti?</span></span></h1>
          <p className="rd-lead rd-rise" style={delay(620)}>Lo Score di chiarezza ti mostra che cosa capisce davvero un candidato quando legge il tuo annuncio.</p>
          <div className="rd-actions rd-rise" style={delay(760)}><Cta position="hero" /><a className="rd-link" href="#ax-story-title">Prima fammi vedere</a></div>
        </div>
        <AdSheet className="ax-hero-sheet" scan />
      </section>

      <CandidateStory />

      <section className="rd-map" aria-labelledby="ax-map-title">
        <header className="rd-reveal"><p className="rd-label">Il risultato</p><h2 id="ax-map-title">Non un voto. <span>Una lista di priorità.</span></h2></header>
        <ul className="rd-tiles">
          {outputs.map(([tag, heading, text], index) => <li key={heading} className="rd-tile rd-reveal" style={{ '--i': index } as React.CSSProperties}><span className="rd-tile-tag">{tag}</span><h3>{heading}</h3><p>{text}</p></li>)}
        </ul>
        <p className="rd-map-note">{scoreDisclaimer}</p>
      </section>

      <section id="valuta" className="rd-product" aria-labelledby="ax-product-title">
        <header className="rd-product-head">
          <p className="rd-label">Tocca a te</p>
          <h2 id="ax-product-title">Che cosa capisce <em>chi lo legge?</em></h2>
          <ol className="rd-steps">{steps.map(([step, text]) => <li key={step}><b>{step}</b><span>{text}</span></li>)}</ol>
        </header>
        <Annunci10xClient />
        <p className="rd-product-note">Gratis <i>·</i> nessuna carta di credito <i>·</i> <Link href="/privacy-policy">Privacy ↗︎</Link></p>
      </section>

      <section id="annuncio-10x" className="ax-price" aria-labelledby="ax-price-title">
        <div className="ax-price-figure">
          <p className="rd-label">Annuncio 10x</p>
          <strong>7 €</strong>
          <ul><li>1 annuncio</li><li>1 versione</li><li>1 canale</li></ul>
        </div>
        <div className="ax-price-copy">
          <h2 id="ax-price-title">Poi, se serve, <em>lo scriviamo noi.</em></h2>
          <p>Parti dal risultato dello Score o, se il testo non esiste ancora, da un brief guidato sui fatti del ruolo. Generiamo il testo completo dopo il pagamento, senza aggiungere fatti che non hai confermato.</p>
          <CreateCta className="rd-cta" position="price">Non ho ancora un annuncio: crealo a 7 €<span aria-hidden="true">↑</span></CreateCta>
          <p className="ax-guarantee">{guaranteeCopy}</p>
        </div>
      </section>

      <section className="rd-faq" aria-labelledby="ax-faq-title">
        <h2 id="ax-faq-title">Prima di iniziare.</h2>
        <div>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true" /></summary><p>{answer}</p></details>)}</div>
      </section>

      <section id="ax-final" className="rd-final" aria-labelledby="ax-final-title">
        <p className="rd-label">Il prossimo passo</p>
        <h2 id="ax-final-title">Prima di pagare un altro annuncio, <em>scopri che cosa non si capisce.</em></h2>
        <Cta position="final" />
        <CreateCta className="rd-link" position="final">Non ho ancora un annuncio</CreateCta>
      </section>
    </main>

    <footer className="rd-footer ax-footer">
      <div><Brand /><p>FELICITÀ srl · Viale Papiniano 28, 20123 Milano · P.IVA 05120660757 · SDI SU9YNJA</p></div>
      <nav aria-label="Link legali Annunci 10x"><Link href="/privacy-policy">Privacy</Link><Link href="/cookie-policy">Cookie</Link><a href="mailto:info@horyzon.it">info@horyzon.it</a></nav>
    </footer>
    <AnnunciDock />
  </div>;
}
