import Link from 'next/link';
import { serviceRoutes, type ServiceEditorial, type ServiceRoute } from '@/content/editorial-routes';
import { RADAR_URL } from '@/content/product-truth';
import { pages } from '@/data/pages';
import archive from '@/data/archive.json';
import { Cta, PageFinal, PageHero, Points, Rows, Section, TextLink, Tiles } from './kit';
import { PageStructuredData } from './structured-data';
import { SiteFooter, SiteHeader } from './site-shell';
import { WellbeingScene } from './wellbeing-scene';
import { servicePresentation } from '@/content/service-presentation';
import styles from './wellbeing.module.css';

type Props = { route: ServiceRoute; title: string; intro: string; content: ServiceEditorial };
const sceneKinds = {
  'benessere-organizzativo': 'organization',
  'benessere-patrimoniale': 'continuity',
  'benessere-digitale': 'digital',
} as const;

export function ServiceEditorialPage({ route, title, intro, content }: Props) {
  const presentation = servicePresentation[route];
  const parentLabel = pages[content.parent].kicker.replace(/^\d+\s*·\s*/, '');
  const siblings = serviceRoutes.filter(item => item.startsWith(`${content.parent}/`) && item !== route);
  return <>
    <PageStructuredData path={`/${route}`} name={title} description={intro} breadcrumbs={[
      { name: 'Horyzon', path: '/' }, { name: 'I tre benesseri', path: '/le-tre-aree' },
      { name: parentLabel, path: `/${content.parent}` }, { name: title, path: `/${route}` },
    ]} />
    <SiteHeader />
    <main id="content" className={`rd rd-page editorial-page site-frame service-editorial ${styles.page}`} data-page={route} data-service={route}>
      <PageHero crumbs={[
        { name: 'Horyzon', href: '/' }, { name: 'I tre benesseri', href: '/le-tre-aree' },
        { name: parentLabel, href: `/${content.parent}` }, { name: title },
      ]} label={parentLabel} title={title} lead={intro}
        aside={<WellbeingScene key={route} kind={sceneKinds[content.parent]} words={presentation.words} caption={presentation.caption} />}>
        <Cta href="#quando-serve" arrow="↓">Scopri il percorso</Cta>
        <TextLink href="/contatti">Parliamone ↗︎</TextLink>
      </PageHero>

      <nav className={`${styles.navigation} ${styles.serviceNavigation}`} aria-label="In questo approfondimento">
        <Link className={styles.overview} href={`/${content.parent}`}>← {content.nextLabel}</Link>
        <div><a href="#quando-serve">Quando serve</a><a href="#percorso">Il percorso</a><a href="#risultati">Cosa cambia</a></div>
      </nav>

      <Section id="quando-serve" tone="cream" split label="Quando diventa urgente" title={presentation.question} headingId="service-urgent">
        <div className="rd-reveal"><Points items={content.urgency} /></div>
      </Section>

      <Section id="percorso" tone="panel" split label="Su cosa lavoriamo" title={presentation.workTitle} headingId="service-work"
        lead="Il percorso prende forma a partire dalla situazione reale, con responsabilità e passaggi comprensibili.">
        <Rows items={content.interventions.map(text => ({ text }))} />
      </Section>

      <Section id="risultati" tone="cream" split label="Cosa diventa visibile" title={presentation.evidenceTitle} headingId="service-visible">
        <div className={`rd-reveal ${styles.focus}`}><Points items={content.evidence} /><p className={styles.serviceOutcome}>{presentation.caption}</p></div>
      </Section>

      <Section id="primo-passo" tone="lime" label="Il prossimo passo" title={<>Mettiamo a fuoco <span className="rd-lime-chip">da dove partire.</span></>}
        headingId="service-start" lead="Il Radar d’Impresa offre una prima lettura dell’organizzazione. Per approfondire questo percorso possiamo partire anche da una conversazione.">
        <div className="rd-actions"><Cta href="/contatti">Parliamo del tuo percorso</Cta><TextLink href={RADAR_URL}>Inizia il Radar ↗︎</TextLink></div>
        {content.parent === 'benessere-patrimoniale' && <p className={styles.note}>Un orientamento da approfondire con i professionisti competenti. I contenuti non costituiscono consulenza finanziaria, fiscale o legale personalizzata né promessa di rendimento.</p>}
      </Section>

      <Section tone="ink" label={parentLabel} title="Continua a esplorare quest’area." headingId="service-related">
        <Tiles columns={2} items={siblings.map(sibling => ({ title: archive[sibling].title, text: archive[sibling].intro, href: `/${sibling}`, more: 'Scopri il percorso' }))} />
      </Section>
      <PageFinal title="Una priorità chiara. Un passo concreto." text="Raccontaci ciò che vorresti cambiare: il primo lavoro è capire insieme che cosa merita attenzione.">
        <Cta href="/contatti">Parliamone</Cta><TextLink href={`/${content.parent}`}>Torna all’area ↗︎</TextLink>
      </PageFinal>
    </main>
    <SiteFooter />
  </>;
}
