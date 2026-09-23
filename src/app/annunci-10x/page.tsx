import { Annunci10xClient } from '@/components/annunci-10x/annunci-10x-client';
import { SiteFooter, SiteHeader } from '@/components/site-shell';
import { SITE_URL } from '@/content/seo';
import type { Metadata } from 'next';

const description = 'Annunci 10x analizza annunci di lavoro esistenti con score, copertura, gate di pubblicazione e chiarimenti guidati.';

export const metadata: Metadata = {
  title: { absolute: 'ANNUNCI 10x — Horyzon' },
  description,
  alternates: { canonical: `${SITE_URL}/annunci-10x` },
  robots: { index: false, follow: false, nocache: true },
  openGraph: {
    title: 'ANNUNCI 10x — Horyzon',
    description,
    url: `${SITE_URL}/annunci-10x`,
    siteName: 'Horyzon Consulting',
    locale: 'it_IT',
    type: 'website',
  },
};

export default function Annunci10xPage() {
  return <>
    <SiteHeader />
    <main id="content" className="inside editorial-page narrative-page" data-page="annunci-10x">
      <section className="inside-hero">
        <div className="page-heading">
          <p className="eyebrow"><span />Horyzon / prodotto riservato</p>
          <h1>ANNUNCI 10x</h1>
          <p className="page-intro">Analizza annunci di lavoro, separa fatti e incertezze, misura la pubblicabilita e trasforma i dubbi in domande utili.</p>
          <p className="page-intro">Analyze funziona ora. Create guida la raccolta da zero fino alla conferma della scheda e alla schermata commerciale pre-payment. Nessun checkout e nessun prezzo sono attivi in questa fase.</p>
        </div>
      </section>

      <section className="narrative-section">
        <Annunci10xClient />
      </section>

      <section className="narrative-section">
        <header>
          <p className="section-kicker">Metodo</p>
          <h2>Score e pubblicazione restano due cose diverse.</h2>
          <p className="narrative-lede">Il punteggio misura la forza dell annuncio sui venti controlli della rubrica. Il gate dice se l annuncio e pubblicabile, da verificare o bloccato per conflitti e informazioni critiche.</p>
        </header>
      </section>

      <section className="narrative-section">
        <header>
          <p className="section-kicker">Cosa fa</p>
          <h2>Rende visibili fatti, vuoti e rischi.</h2>
          <p className="narrative-lede">Estrae soltanto fatti presenti, valuta la copertura, mostra priorita e suggerisce un chiarimento alla volta quando serve aumentare affidabilita.</p>
        </header>
      </section>

      <section className="narrative-section">
        <header>
          <p className="section-kicker">Cosa non fa</p>
          <h2>Non inventa condizioni e non pubblica al posto tuo.</h2>
          <p className="narrative-lede">Non usa web search, non calcola lo score nel provider AI, non genera l annuncio finale senza entitlement server-side e non sostituisce una verifica legale o contrattuale.</p>
        </header>
      </section>
    </main>
    <SiteFooter />
  </>;
}
