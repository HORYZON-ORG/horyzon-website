import Image from 'next/image';
import type { Metadata } from 'next';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import { PageStructuredData } from '@/components/structured-data';
import { FaqSection } from '@/components/faq-section';
import { Cta, TextLink, PageHero, Section, Tiles, Rows, PageFinal } from '@/components/kit';
import { recruitingTitle, recruitingDescription, recruitingContact, recruitingFaqs } from '@/content/recruiting';
import { pageMetadata } from '@/content/seo';
import { PerformiaMap } from './performia-map';
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
    aside={<figure className={`rd-index ${styles.heroIndex}`}><figcaption>Dalla ricerca al lavoro insieme</figcaption><ol>
     <li><a href="#definire-ruolo"><b aria-hidden="true">01</b><span>Chiarire il ruolo</span></a></li>
     <li><a href="#valutare-persone"><b aria-hidden="true">02</b><span>Valutare le persone</span></a></li>
     <li><a href="#curare-inserimento"><b aria-hidden="true">03</b><span>Curare l’inserimento</span></a></li>
    </ol><p>Esperienza Horyzon, metodologia e strumenti Performia.</p></figure>}>
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
     { id: 'definire-ruolo', title: 'Definire il ruolo', text: 'Mettere a fuoco risultati attesi, responsabilità, requisiti e condizioni concrete della proposta.' },
     { title: 'Attrarre candidature pertinenti', text: 'Lavorare sul messaggio dell’annuncio e sulla sua coerenza con il ruolo e con le persone che vuoi raggiungere.' },
     { id: 'valutare-persone', title: 'Valutare con metodo', text: 'Approfondire risultati prodotti, motivazione, conoscenze e caratteristiche rilevanti per il lavoro, integrando colloqui e strumenti concordati.' },
     { id: 'curare-inserimento', title: 'Preparare l’inserimento', text: 'Chiarire aspettative, affiancamento e momenti di verifica perché la scelta possa tradursi in un contributo riconoscibile.' },
    ]} />
   </Section>

   <Section tone="ink" label="Il ruolo di Performia" title="Approfondire ciò che il curriculum non racconta." headingId="recruiting-performia">
    <div className="rd-prose"><p>Nel lavoro di selezione utilizziamo la metodologia e gli strumenti Performia International. Il suo approccio considera quattro dimensioni: risultati prodotti, personalità, motivazione e conoscenze.</p><p>La scelta degli strumenti dipende dal ruolo e dal percorso concordato. Le informazioni raccolte sostengono il confronto e la valutazione; la decisione di assunzione resta dell’azienda.</p></div>
    <div className={styles.performiaMedia}>
     <article className={styles.performiaCard}>
      <h3>Il carro di Performia</h3>
      <p>Chi sta davvero facendo avanzare il tuo team? Il carro mostra come il contributo di ciascuno cambia il lavoro di tutti.</p>
      <video className={styles.cartVideo} controls playsInline preload="none"
       aria-label="Il carro di Performia, video originale in inglese"
       poster="https://performia.com/media/mvtayfzl-1rjc49gn.webp"
       src="https://performia.com/media/mvtaycut-4wtdne.mp4" />
      <p className={styles.mediaNote}>The Cart · Video originale in inglese</p>
     </article>
     <article className={styles.performiaCard}>
      <h3>Performia nel mondo</h3>
      <p>Esplora le sedi della rete internazionale. Scegli un Paese sulla mappa o dal menu.</p>
      <PerformiaMap />
      <ul className={styles.performiaStats} aria-label="Performia International in numeri">
       <li>Dal 2001</li><li>Oltre 26 Paesi</li><li>Oltre 25 lingue</li>
      </ul>
     </article>
    </div>
    <Cta href={recruitingContact}>Parliamo della persona che stai cercando</Cta>
   </Section>

   <Section tone="cream" label="Le persone" title="Un confronto con chi lavora su persone e impresa." headingId="recruiting-persone">
    <div className={styles.profile}><Image src="/people/angelo.webp" width={120} height={120} sizes="120px" alt="Angelo Ria Chetta" className={styles.portrait} />
     <div><h3>Angelo Ria Chetta</h3><p>Autore, ricercatore e imprenditore. Specialista in benessere imprenditoriale e organizzativo.</p><p>Si occupa di recruiting, selezione, inserimento, organizzazione e valorizzazione delle persone.</p><div className={styles.profileActions}><TextLink href="/angelo">Conosci meglio Angelo ↗︎</TextLink><TextLink href="/persone">Le competenze del gruppo Horyzon ↗︎</TextLink></div></div>
    </div>
   </Section>

   <Section tone="sand" label="Una cultura delle persone" title="Aziende attraenti per campioni e talenti." headingId="recruiting-libro">
    <div className={styles.book}><Image src="/books/aziende-attraenti-2026.webp" width={846} height={1200} sizes="(max-width:600px) 240px, (max-width:900px) 280px, 320px" alt="Copertina del libro Aziende attraenti per campioni e talenti di Angelo Ria Chetta" />
     <div className="rd-prose"><p>Per imprenditori, manager e responsabili delle persone: attrattività, organizzazione, selezione, inserimento e crescita dei collaboratori.</p><p>Ricevi gratuitamente la copia digitale in PDF su angeloria.it lasciando la tua email. Gli aggiornamenti promozionali sono facoltativi.</p><Cta href="https://angeloria.it/ricevi-il-pdf-aziende-attraenti-per-campioni-e-talenti/">Ricevi il libro gratuitamente in PDF</Cta></div>
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
