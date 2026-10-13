import Link from 'next/link';
import { pages } from '@/data/pages';
import archive from '@/data/archive.json';
import { RADAR_URL } from '@/content/product-truth';
import { PageStructuredData } from '@/components/structured-data';
import { SiteFooter, SiteHeader } from '@/components/site-shell';
import { Cta, PageFinal, PageHero, Points, Section, TextLink, Tiles } from '@/components/kit';
import { WellbeingScene } from './wellbeing-scene';
import styles from './wellbeing.module.css';
import { patrimonialContact } from '@/content/patrimonial';

const areas = {
  'benessere-organizzativo': {
    label: 'Benessere organizzativo', short: 'Organizzativo', kind: 'organization',
    question: 'Il lavoro deve potersi muovere anche senza di te.',
    outcome: 'Più chiarezza nel lavoro. Più spazio per le persone.',
    firstStep: 'Leggiamo dove ruoli, decisioni e processi stanno trattenendo energia.',
    words: ['Persone', 'Ruoli', 'Relazioni'],
    services: ['analisi-organizzativa', 'sviluppo-imprenditoriale', 'human-management'],
  },
  'benessere-patrimoniale': {
    label: 'Benessere patrimoniale', short: 'Patrimoniale', kind: 'continuity',
    question: 'Proteggere ciò che hai costruito richiede una vista completa.',
    outcome: 'Una visione d’insieme, prima della prossima decisione.',
    firstStep: 'Mettiamo in relazione ciò che conta prima di scegliere strumenti e interlocutori.',
    words: ['Protezione', 'Equilibrio', 'Continuità'],
    services: ['visione-patrimoniale', 'imprenditori', 'professionisti'],
  },
  'benessere-digitale': {
    label: 'Benessere digitale', short: 'Digitale', kind: 'digital',
    question: 'La tecnologia vale quando libera capacità nel lavoro reale.',
    outcome: 'Strumenti utili. Persone preparate. Controllo delle scelte.',
    firstStep: 'Partiamo dai passaggi di lavoro in cui dati, strumenti e persone devono tornare a collaborare.',
    words: ['Dati', 'Strumenti', 'Competenze'],
    services: ['imprese', 'competenze', 'italia-digitale'],
  },
} as const;

type Area = keyof typeof areas;
export function isWellbeingArea(value: string): value is Area {
  return Object.hasOwn(areas, value);
}

export function WellbeingPage({ area }: { area: Area }) {
  const direction = areas[area];
  const content = pages[area];
  return <>
    <PageStructuredData path={`/${area}`} name={content.title} description={content.intro} breadcrumbs={[
      { name: 'Horyzon', path: '/' }, { name: 'I tre benesseri', path: '/le-tre-aree' }, { name: direction.label, path: `/${area}` },
    ]} />
    <SiteHeader />
    <main id="content" className={`rd rd-page editorial-page site-frame ${styles.page}`} data-page={area}>
      <PageHero crumbs={[{ name: 'Horyzon', href: '/' }, { name: 'I tre benesseri', href: '/le-tre-aree' }, { name: direction.short }]}
        label={direction.label} title={content.title} lead={content.intro}
        aside={<WellbeingScene key={direction.kind} kind={direction.kind} words={direction.words} />}>
        <Cta href={area === 'benessere-patrimoniale' ? '#evento' : '#comprendere'} arrow="↓">{area === 'benessere-patrimoniale' ? 'Scopri l’evento' : 'Scopri il percorso'}</Cta>
        <TextLink href={area === 'benessere-patrimoniale' ? '/entra-in-horyzon#percorso-consulenti' : '/contatti'}>{area === 'benessere-patrimoniale' ? 'Scopri il percorso consulenti ↗︎' : 'Parliamone ↗︎'}</TextLink>
      </PageHero>

      <nav className={styles.navigation} aria-label="I tre benesseri">
        <Link href="/le-tre-aree" className={styles.overview}>Un’unica impresa</Link>
        <div>{Object.entries(areas).map(([href, item]) => <Link key={href} href={`/${href}`} aria-current={area === href ? 'page' : undefined}>{item.short}</Link>)}</div>
      </nav>

      <Section id="comprendere" tone="cream" split label="Il punto di partenza" title={direction.question} headingId="comprendere-title">
        <div className="rd-prose rd-reveal">{content.body.map(text => <p key={text}>{text}</p>)}</div>
      </Section>

      {area === 'benessere-patrimoniale' && <>
        <Section id="evento" tone="panel" label="Per persone, famiglie e imprese" title="Quello che le banche non dicono" headingId="patrimonio-evento" lead="Un evento online in preparazione, a cura di Frank Cannoletta, per fare spazio alle domande su oro fisico e diversificazione.">
          <Tiles items={[
            { title: 'Capire prima di scegliere', text: 'Cultura patrimoniale, obiettivi e domande utili per orientare un confronto consapevole.' },
            { title: 'Approfondire l’oro fisico', text: 'Caratteristiche, costi, custodia e rischi: nessun investimento è privo di rischi e il valore dell’oro può diminuire.' },
            { title: 'Un confronto personale', text: 'Dopo l’incontro, chi vuole approfondire potrà chiedere un appuntamento. Le esigenze individuali e le attività riservate si valutano con i professionisti competenti.' },
          ]} />
          <p className="rd-note">Stiamo preparando un ciclo di incontri online a cadenza mensile. Data, programma e modalità della prima edizione saranno comunicati quando definiti. La richiesta di informazioni non prenota un posto.</p>
          <div className="rd-actions"><Cta href={patrimonialContact('evento-patrimoniale')}>Ricevi informazioni sull’evento</Cta><TextLink href="/frank">Conosci Frank ↗︎</TextLink></div>
          <p className="rd-note">Per approfondire rischi e caratteristiche: <a href="https://economiapertutti.bancaditalia.it/notizie-e-rubriche/notizie/cosa-sapere-prima-di-comprare-oro/">la guida della Banca d’Italia sull’oro</a>.</p>
        </Section>
        <Section tone="cream" split label="Per chi vuole entrare nella rete" title="Vuoi conoscere il percorso consulenti?" headingId="patrimonio-rete" lead="Una strada distinta per chi vuole contribuire alla cultura patrimoniale e lavorare nella relazione con le persone."><div className="rd-prose"><p>Presentazione introduttiva Horyzon, colloquio e valutazione di un possibile ingresso. Formazione, affiancamento, responsabilità e condizioni si approfondiscono prima di scegliere.</p><p>Se hai esperienza nel network marketing o nella vendita, raccontaci il tuo percorso. Non sono promessi guadagni né un ingresso automatico.</p><Cta href="/entra-in-horyzon#percorso-consulenti">Scopri il percorso consulenti</Cta></div></Section>
      </>}

      <Section tone="panel" split label="Che cosa osserviamo" title="Le cose che fanno la differenza." headingId="osserviamo-title"
        lead="La priorità non si indovina: si costruisce insieme, a partire da ciò che accade davvero.">
        <div className={`rd-reveal ${styles.focus}`}><Points items={content.points} /><p className={styles.outcome}>{direction.outcome}</p></div>
      </Section>

      <Section id="ambiti" tone="cream" label="Come possiamo aiutare" title="Un percorso che parte dalla tua realtà." headingId="ambiti-title">
        <ul className="rd-rows">{direction.services.map(child => {
          const href = `${area}/${child}`;
          const service = archive[href as keyof typeof archive];
          return <li key={href}><Link href={`/${href}`} className={`rd-row rd-reveal ${styles.service}`} data-wellbeing-service="">
            <div><h3>{service.title}</h3><p>{service.intro}</p></div>
            <span className={styles.serviceLink}>Approfondisci <span className="rd-row-go" aria-hidden="true">↗︎</span></span>
          </Link></li>;
        })}</ul>
      </Section>

      <Section id="primo-passo" tone="lime" label="Cominciamo da qui" title={<>Prima di cambiare, <span className="rd-lime-chip">facciamo chiarezza.</span></>}
        lead={direction.firstStep} headingId="primo-passo-title">
        <div className="rd-actions"><Cta href={area === 'benessere-patrimoniale' ? patrimonialContact('evento-patrimoniale') : RADAR_URL}>{area === 'benessere-patrimoniale' ? 'Chiedi informazioni' : 'Inizia il Radar'}</Cta><TextLink href="/contatti">Preferisci parlarne con noi? ↗︎</TextLink></div>
        {area === 'benessere-patrimoniale' && <p className={styles.note}>Un orientamento da approfondire con i professionisti competenti. I contenuti non costituiscono consulenza finanziaria, fiscale o legale personalizzata né promessa di rendimento.</p>}
      </Section>

      <PageFinal title="Diamo forma al prossimo passo." text="Partiamo da ciò che oggi assorbe tempo, limita la crescita o rende più difficili le decisioni.">
        <Cta href="/contatti">Parliamone</Cta><TextLink href="/metodo">Scopri come lavoriamo ↗︎</TextLink>
      </PageFinal>
    </main>
    <SiteFooter />
  </>;
}
