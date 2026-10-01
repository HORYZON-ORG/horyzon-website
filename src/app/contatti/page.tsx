import { PageStructuredData } from '@/components/structured-data'; import { FaqSection } from '@/components/faq-section'; import { publicFaqs } from '@/content/public-faq';
import { pageMetadata } from '@/content/seo';
import type { Metadata } from 'next'; import { JourneyContactForm } from '@/components/journey/contact-form'; import { SiteFooter, SiteHeader } from '@/components/site-shell'; import { RADAR_URL } from '@/content/product-truth';
import { PageHero, Section, Tiles } from '@/components/kit';
export const metadata: Metadata = pageMetadata({ path: '/contatti', title: 'Contatti', description: 'Inizia il Radar o raccontaci che cosa oggi rende più difficile lavorare nella tua impresa.' });
// The form sits in the hero, next to the question; the three ways in follow on cream, the company data on the panel.
export default function ContactPage(){return <><PageStructuredData path="/contatti" name="Contatti" description="Inizia il Radar o raccontaci che cosa oggi rende più difficile lavorare nella tua impresa." type="ContactPage" breadcrumbs={[{ name: 'Horyzon', path: '/' }, { name: 'Contatti', path: '/contatti' }]} faqs={publicFaqs['/contatti']} /><SiteHeader/><main id="content" className="rd rd-page editorial-page narrative-page" data-page="contatti">
 <PageHero crumbs={[{ name: 'Horyzon', href: '/' }, { name: 'Contatti' }]} label="Il prossimo passo" title={<>Che cosa vorresti <em>cambiare?</em></>} lead="Raccontaci ciò che oggi assorbe tempo, rallenta il lavoro o rende difficile una decisione. Il primo passo è capirlo insieme." aside={<div className="contact-form-surface"><JourneyContactForm/><p className="rd-note">Il modulo prepara un messaggio nel tuo client email: il sito non invia né conserva i dati.</p></div>}><p className="rd-note" style={{ margin: 0 }}>Il primo passo è una conversazione.</p></PageHero>
 <Section tone="cream" label="Cominciamo da qui" title="Da dove vuoi cominciare?" headingId="contatti-percorsi">
  <Tiles items={[
   { tag: '01', title: 'Inizia il Radar', text: 'Un primo sguardo per capire dove l’impresa oggi ha più bisogno di attenzione.', href: RADAR_URL, more: 'Inizia il Radar' },
   { tag: '02', title: 'Parliamo del risultato', text: 'Hai completato il Radar? Guardiamo insieme ciò che emerge.', href: 'mailto:info@horyzon.it?subject=Parliamo%20del%20mio%20Radar', more: 'Parliamo del risultato' },
   { tag: '03', title: 'Raccontaci che cosa ti blocca', text: 'Non serve sapere già quale soluzione ti serve.', href: 'mailto:info@horyzon.it?subject=Vorrei%20parlare%20della%20mia%20impresa', more: 'Parliamone' },
  ]} />
 </Section>
 <Section tone="panel" className="contact-company" split title="FELICITÀ srl" headingId="contatti-societa"><p className="rd-statement" style={{ fontSize: 'clamp(24px,2.4vw,36px)' }}>Viale Papiniano 28 · 20123 Milano<br/>P. IVA 05120660757 · SDI SU9YNJA</p><div className="rd-actions"><a className="rd-cta" href="mailto:info@horyzon.it">info@horyzon.it <span aria-hidden="true">↗︎</span></a></div></Section>
 <FaqSection items={publicFaqs['/contatti']} />
</main><SiteFooter/></>}
