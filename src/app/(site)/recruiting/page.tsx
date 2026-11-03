import Image from 'next/image';
import type { Metadata } from 'next';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import { PageStructuredData } from '@/components/structured-data';
import { FaqSection } from '@/components/faq-section';
import { Cta, TextLink, PageHero, HeroIndex, Section, Tiles, Rows, PageFinal } from '@/components/kit';
import { recruitingTitle, recruitingDescription, recruitingContact, recruitingFaqs } from '@/content/recruiting';
import { pageMetadata } from '@/content/seo';
import styles from './recruiting.module.css';

export const metadata: Metadata = pageMetadata({ path: '/recruiting', title: recruitingTitle, description: recruitingDescription });

export default function RecruitingPage() {
 return <><PageStructuredData path="/recruiting" name={recruitingTitle} description={recruitingDescription} faqs={recruitingFaqs}
  breadcrumbs={[{ name: 'Horyzon', path: '/' }, { name: 'Benessere organizzativo', path: '/benessere-organizzativo' }, { name: 'Recruiting', path: '/recruiting' }]} />
  <SiteHeader />
  <main id="content" className={`rd rd-page editorial-page site-frame ${styles.page}`} data-page="recruiting">
   <PageHero crumbs={[{ name: 'Horyzon', href: '/' }, { name: 'Benessere organizzativo', href: '/benessere-organizzativo' }, { name: 'Recruiting' }]}
    label="Horyzon Consulting · Recruiting" title={<>Le persone giuste. <em>Un’impresa più forte.</em></>}
    lead="Affianchiamo imprenditori e aziende nella selezione e nell’inserimento delle persone. Partiamo dal contributo che serve all’impresa e costruiamo un percorso per valutarlo."
    aside={<HeroIndex caption="Dalla ricerca al lavoro insieme" words={['Chiarire il ruolo', 'Valutare le persone', 'Curare l’inserimento']} note="Esperienza Horyzon, metodologia e strumenti Performia." />}>
    <Cta href={recruitingContact}>Parliamo della persona che stai cercando</Cta>
    <TextLink href="#metodo-recruiting">Scopri come lavoriamo ↓</TextLink>
   </PageHero>

   <Section tone="cream" label="Quando serve" title="Quale difficoltà stai incontrando?" headingId="recruiting-problemi">
    <Tiles items={[
     { title: 'Arrivano candidature poco pertinenti', text: 'Molti curriculum, poche persone coerenti con il ruolo e con ciò che l’azienda offre.' },
     { title: 'Il colloquio convince. Il lavoro meno.', text: 'È difficile distinguere una buona presentazione dalle capacità e dai risultati da approfondire.' },
     { title: 'L’inserimento non funziona', text: 'Aspettative, responsabilità e affiancamento restano impliciti. La difficoltà riappare dopo la scelta.' },
    ]} />
   </Section>

   <Section tone="panel" split label="La nostra specializzazione" title="Recruiting e organizzazione devono parlarsi." headingId="recruiting-approccio">
    <div className="rd-prose"><p>La ricerca di una persona comincia da una domanda: quale contributo deve portare all’impresa?</p><p>Colleghiamo selezione, inserimento, organizzazione e valorizzazione delle persone. Un ruolo chiaro aiuta a cercare meglio; un’organizzazione preparata aiuta la persona a contribuire.</p><p>Il primo confronto serve a distinguere ciò che manca: candidature, criteri di valutazione, competenze oppure chiarezza nel lavoro.</p></div>
   </Section>

   <Section id="metodo-recruiting" tone="cream" label="Come lavoriamo" title="Dal ruolo da coprire alla persona che contribuisce." headingId="recruiting-metodo"
    lead="Il percorso viene definito sulla tua esigenza. Attività, responsabilità e condizioni si chiariscono prima di iniziare.">
    <Rows items={[
     { title: 'Definire il ruolo', text: 'Mettere a fuoco risultati attesi, responsabilità, requisiti e condizioni concrete della proposta.' },
     { title: 'Attrarre candidature pertinenti', text: 'Lavorare sul messaggio dell’annuncio e sulla sua coerenza con il ruolo e con le persone che vuoi raggiungere.' },
     { title: 'Valutare con metodo', text: 'Approfondire risultati prodotti, motivazione, conoscenze e caratteristiche rilevanti per il lavoro, integrando colloqui e strumenti concordati.' },
     { title: 'Preparare l’inserimento', text: 'Chiarire aspettative, affiancamento e momenti di verifica perché la scelta possa tradursi in un contributo riconoscibile.' },
    ]} />
   </Section>

   <Section tone="ink" split label="Il ruolo di Performia" title="Approfondire ciò che il curriculum non racconta." headingId="recruiting-performia">
    <div className="rd-prose"><p>Nel lavoro di selezione utilizziamo la metodologia e gli strumenti Performia International. Il suo approccio considera quattro dimensioni: risultati prodotti, personalità, motivazione e conoscenze.</p><p>La scelta degli strumenti dipende dal ruolo e dal percorso concordato. Le informazioni raccolte sostengono il confronto e la valutazione; la decisione di assunzione resta dell’azienda.</p><TextLink href="https://performia.com/en-it/about-us">Conosci la metodologia Performia ↗︎</TextLink></div>
   </Section>

   <Section tone="cream" label="Le persone" title="Un confronto con chi lavora su persone e impresa." headingId="recruiting-persone">
    <div className={styles.profile}><Image src="/people/angelo.webp" width={120} height={120} sizes="120px" alt="Angelo Ria Chetta" className={styles.portrait} />
     <div><h3>Angelo Ria Chetta</h3><p>Autore, ricercatore e imprenditore. Specialista in benessere imprenditoriale e organizzativo.</p><p>Si occupa di recruiting, selezione, inserimento, organizzazione e valorizzazione delle persone.</p><TextLink href="/angelo">Conosci Angelo ↗︎</TextLink></div>
    </div>
    <div className="rd-actions"><TextLink href="/persone">Le competenze del gruppo Horyzon ↗︎</TextLink></div>
   </Section>

   <Section tone="sand" split label="Una cultura delle persone" title="Aziende attraenti per campioni e talenti." headingId="recruiting-libro">
    <div className={styles.book}><Image src="/books/aziende-attraenti-2026.webp" width={846} height={1200} sizes="(max-width:600px) 110px, 160px" alt="Copertina del libro Aziende attraenti per campioni e talenti di Angelo Ria Chetta" />
     <div className="rd-prose"><p>Per imprenditori, manager e responsabili delle persone: attrattività, organizzazione, selezione, inserimento e crescita dei collaboratori.</p><p>Ricevi gratuitamente la copia digitale in PDF su angeloria.it lasciando la tua email. Gli aggiornamenti promozionali sono facoltativi.</p><Cta href="https://angeloria.it/ricevi-il-pdf-aziende-attraenti-per-campioni-e-talenti/">Ricevi il libro gratuitamente in PDF</Cta><TextLink href="https://angeloria.it/anteprima-aziende-attraenti/">Leggi la presentazione del libro ↗︎</TextLink></div>
    </div>
   </Section>

   <Section tone="panel" split label="Un primo strumento" title="Vuoi partire dall’annuncio?" headingId="recruiting-annuncio">
    <div className="rd-prose"><p>Con Annunci 10x puoi valutare chiarezza e completezza del tuo annuncio e lavorare sulla sua formulazione. È un primo passo per rendere esplicita l’offerta: non valuta i candidati e non prevede il numero di candidature.</p><TextLink href="/annunci-10x">Esplora Annunci 10x ↗︎</TextLink></div>
   </Section>

   <FaqSection items={recruitingFaqs} />
   <PageFinal title="Quale persona manca oggi alla tua impresa?" text="Raccontaci ruolo, sede di lavoro e difficoltà che stai incontrando. Mettiamo a fuoco il passo utile per la tua ricerca.">
    <Cta href={recruitingContact}>Parliamo della persona che stai cercando</Cta>
   </PageFinal>
  </main><SiteFooter /></>;
}
