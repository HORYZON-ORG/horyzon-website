import { Cta, HeroIndex, PageFinal, PageHero, Points, Rows, Section, Tiles } from '@/components/kit';
import { PatrimonialLeadForm } from '@/components/patrimonial-lead-form';
import { architectPath, patrimonialBrand } from '@/content/patrimonial-funnels';
import { pageMetadata } from '@/content/seo';
import styles from '../../funnel.module.css';

export const metadata = pageMetadata({ path: architectPath.path, title: patrimonialBrand.path, description: architectPath.description });

export default function ArchitectPathPage() {
  return <>
    <PageHero className={styles.hero} label="HORYZON / IL PROSSIMO PASSO PROFESSIONALE" title={architectPath.title} lead={architectPath.description}
      aside={<HeroIndex caption={patrimonialBrand.path} words={['Comprendere', 'Accompagnare', 'Crescere']} note={patrimonialBrand.network} />}>
      <p>Il primo passo non è decidere se entrare.<br />È capire il progetto, conoscere il ruolo e verificare se può esserci un punto d&apos;incontro.</p>
      <Cta href="#apertura" arrow="↓">Scopri il percorso</Cta>
      <p className="rd-note">Presentazione introduttiva Horyzon e successiva valutazione individuale.</p>
    </PageHero>
    <Section id="apertura" tone="cream" split label="DA DOVE VUOI COMINCIARE?" title="Stai cercando soltanto un nuovo lavoro o un percorso che possa crescere insieme a te?" headingId="apertura-title">
      <div className="rd-prose"><p>Ci sono momenti in cui cambiare attività non significa semplicemente cambiare azienda.</p><p>Significa trovare un progetto nel quale esperienza, capacità relazionali e voglia di crescere possano acquisire un significato nuovo.</p><p>Horyzon sta sviluppando un percorso professionale dedicato al Benessere Patrimoniale.</p><p><strong>Non cerchiamo semplicemente persone a cui affidare un prodotto.</strong></p></div>
    </Section>
    <Section tone="panel" label="PRIMA IL RUOLO. POI L'OPPORTUNITÀ." title="Che cosa fa un Architetto Patrimoniale?" headingId="ruolo-title" lead="L'Architetto Patrimoniale accompagna persone e imprenditori in un primo percorso di maggiore consapevolezza sul patrimonio e sulla diversificazione.">
      <div className="rd-prose"><p>Il suo lavoro parte dall&apos;ascolto.</p></div><Tiles items={architectPath.roles} />
    </Section>
    <Section tone="cream" split label="IL PROSSIMO PASSO, INSIEME." title="Non devi scegliere oggi. Devi prima capire." headingId="percorso-title"><Rows items={architectPath.steps} /></Section>
    <Section tone="ink" split title="Potrebbe essere il tuo percorso se..." headingId="per-chi-title"><Points items={architectPath.forWhom} /></Section>
    <Section tone="sand" split title="Probabilmente non è il percorso giusto se..." headingId="non-per-chi-title"><Points items={architectPath.notFor} /></Section>
    <Section tone="panel" label={patrimonialBrand.network} title="Non solo formazione. Un percorso accompagnato." headingId="contenuti-title"><Tiles columns={2} items={architectPath.includes} /></Section>
    <Section id="presentazione" tone="lime" split label="PRIMA DI CANDIDARTI DAVVERO" title="Scopri Horyzon e il Percorso Architetto Patrimoniale." headingId="presentazione-title">
      <Points items={architectPath.presentation} /><p className="rd-note">Durata indicativa: 30–40 minuti<br />Online · Live nella prima fase</p><div className="rd-actions"><Cta href="#richiesta" arrow="↓">Voglio partecipare alla presentazione</Cta></div>
    </Section>
    <Section id="richiesta" tone="cream"><div className={`${styles.form} contact-form-surface`}><PatrimonialLeadForm mode="architect-path" /></div></Section>
    <PageFinal title="Ogni percorso comincia da una conversazione." text="Se senti che potrebbe esserci qualcosa da approfondire, il primo passo è semplice: conosciamoci."><Cta href="#richiesta" arrow="↑">Scopri il percorso</Cta></PageFinal>
  </>;
}
