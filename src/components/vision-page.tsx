import Image from 'next/image';
import Link from 'next/link';
import { visionPages, visionRoutes, type VisionRoute } from '@/content/vision';
import { publicFaqs } from '@/content/public-faq';
import { RADAR_URL } from '@/content/product-truth';
import { people } from '@/data/people';
import archive from '@/data/archive.json';
import { PageStructuredData } from './structured-data';
import { SiteHeader, SiteFooter } from './site-shell';
import { Cta, PageHero, PageFinal, Section, TextLink, Tiles } from './kit';
import { FaqSection } from './faq-section';
import { VisionScene } from './vision-scene';
import styles from './vision.module.css';

const labels: Record<VisionRoute, string> = { horyzon: 'Horyzon', impresa: 'Impresa', economia: 'Economia', umanita: 'Umanità' };

export function VisionPage({ route }: { route: VisionRoute }) {
  const content = visionPages[route];
  const isHome = route === 'horyzon';
  const faqs = publicFaqs[`/${route}`];
  return <>
    <PageStructuredData path={`/${route}`} name={content.title} description={content.intro} type={isHome ? 'AboutPage' : 'WebPage'} faqs={faqs}
      breadcrumbs={[{ name: 'Horyzon', path: '/' }, ...(!isHome ? [{ name: 'La nostra visione', path: '/horyzon' }] : []), { name: labels[route], path: `/${route}` }]} />
    <SiteHeader />
    <main id="content" className={`rd rd-page editorial-page site-frame ${styles.page}`} data-page={route}>
      <PageHero className={styles.hero} crumbs={[{ name: 'Horyzon', href: '/' }, ...(!isHome ? [{ name: 'La nostra visione', href: '/horyzon' }] : []), { name: labels[route] }]}
        label={content.label} title={content.title} lead={content.intro} aside={<VisionScene key={route} page={route} caption={content.sceneCaption} />}>
        <Cta href="#visione" arrow="↓">Scopri la visione</Cta><TextLink href="/contatti">Parliamone ↗︎</TextLink>
      </PageHero>
      <nav className={styles.navigation} aria-label="La visione Horyzon">
        {visionRoutes.map(page => <Link href={`/${page}`} key={page} aria-current={page === route ? 'page' : undefined}>{labels[page]}</Link>)}
      </nav>
      <Section id="visione" tone="cream" split label={content.label} title={content.sectionTitle} headingId="vision-title">
        <div className="rd-prose rd-reveal">{content.sectionLead && <p>{content.sectionLead}</p>}{content.body.map(text => <p key={text}>{text}</p>)}</div>
      </Section>
      <Section id="prospettive" tone="panel" label="Le prospettive" title={content.perspectivesTitle} headingId="perspectives-title">
        <Tiles items={content.perspectives.map(item => ({ ...item, ...(item.href ? { more: 'Esplora la prospettiva' } : {}) }))} />
      </Section>
      <Section id={isHome ? 'metodo' : 'azione'} tone="lime" label="Dalla visione all’azione" title={content.statement} headingId="vision-action"
        lead={isHome ? 'Ascolto, misura e azione: partiamo dalla realtà dell’impresa e diamo una forma concreta alla priorità.' : 'La visione prende forma nelle persone, nelle responsabilità e nei passaggi di lavoro. I tre benesseri e il metodo Horyzon collegano queste prospettive.'}>
        <div className="rd-actions"><Cta href={isHome ? '/metodo' : '/le-tre-aree'}>{isHome ? 'Scopri come lavoriamo' : 'Esplora i tre benesseri'}</Cta><TextLink href={RADAR_URL}>Inizia il Radar ↗︎</TextLink></div>
      </Section>
      {isHome ? <Section id="persone" tone="ink" label="Casa Horyzon" title="Competenze diverse. Una responsabilità condivisa." headingId="vision-people"
        lead={archive.horyzon.sections[1].text[0]}>
        <ul className={styles.people}>{Object.entries(people).map(([slug, person]) => <li key={slug}>
          <Link href={`/${slug}`} className={`rd-tile rd-reveal ${styles.person}`}>
            {person.image ? <Image src={person.image} alt={person.name} width={96} height={112} sizes="(max-width:600px) 72px, 96px" className={styles.portrait} /> : <div className={styles.initials} aria-hidden="true">{person.initials}</div>}
            <div><h3>{person.name}</h3><p className={styles.role}>{person.role}</p></div>
            <p className={styles.personIntro}>{person.intro}</p><span className="rd-tile-more">Conosci il profilo ↗︎</span>
          </Link>
          <Link href={`/v/${slug}`} className={`rd-link ${styles.cardLink}`}>Biglietto digitale ↗︎</Link>
        </li>)}</ul>
        <div className={`rd-actions ${styles.morePeople}`}><TextLink href="/persone">Tutte le persone ↗︎</TextLink><TextLink href="/entra-in-horyzon">Entra in Horyzon ↗︎</TextLink></div>
      </Section> : <Section tone="ink" label="La visione Horyzon" title="Ogni prospettiva sostiene le altre." headingId="vision-connections">
        <Tiles columns={2} items={visionRoutes.filter(page => page !== 'horyzon' && page !== route).map(page => ({ title: labels[page], text: visionPages[page].intro, href: `/${page}`, more: 'Continua a esplorare' }))} />
        <div className={`rd-actions ${styles.morePeople}`}><TextLink href="/horyzon">← Torna a Horyzon</TextLink></div>
      </Section>}
      {faqs && <FaqSection items={faqs} />}
      <PageFinal title="Un orizzonte comune comincia da un confronto." text="Partiamo dalle persone, dalla realtà dell’impresa e da ciò che vorresti rendere possibile.">
        <Cta href="/contatti">Parliamone</Cta><TextLink href={isHome ? '/entra-in-horyzon' : '/metodo'}>{isHome ? 'Entra in Horyzon ↗︎' : 'Scopri come lavoriamo ↗︎'}</TextLink>
      </PageFinal>
    </main>
    <SiteFooter />
  </>;
}
