import Image from 'next/image';
import { Cta, HeroIndex, PageFinal, PageHero, Points, Rows, Section } from '@/components/kit';
import { PatrimonialLeadForm } from '@/components/patrimonial-lead-form';
import { patrimonialEvent } from '@/content/patrimonial-funnels';
import { pageMetadata } from '@/content/seo';
import styles from '../../funnel.module.css';

export const metadata = pageMetadata({ path: patrimonialEvent.path, title: patrimonialEvent.title, description: patrimonialEvent.description });

export default function PatrimonialEventPage() {
  const after = patrimonialEvent.phase === 'after';
  const target = after ? '#parliamone' : '#richiesta';
  return <>
    <PageHero className={styles.hero} label="HORYZON / EVENTO ONLINE" title={`${patrimonialEvent.title}.`} lead="Prima di scegliere dove mettere i tuoi soldi, dovresti sapere quali domande fare."
      aside={<HeroIndex caption="Horyzon Benessere Patrimoniale" words={['Patrimonio', 'Domande', 'Consapevolezza']} />}>
      <p>{patrimonialEvent.description}</p><p><strong>Non per dirti dove investire. Per aiutarti a capire meglio.</strong></p>
      <ul className={styles.info}><li>{patrimonialEvent.format}</li><li>{patrimonialEvent.date}</li><li>{patrimonialEvent.time}</li></ul>
      <Cta href={target} arrow="↓">{after ? 'Parliamone' : 'Riserva il tuo posto'}</Cta><p className="rd-note">Partecipazione su registrazione.</p>
    </PageHero>
    <Section tone="cream" split label="PRIMA DI SCEGLIERE, FACCIAMO CHIAREZZA." title="Il problema non è soltanto quanto hai risparmiato." headingId="problema-title" lead="È sapere che cosa sta succedendo a ciò che hai costruito.">
      <div className="rd-prose"><p>Per anni ci hanno insegnato soprattutto a guadagnare, risparmiare e accumulare.</p><p>Molto meno a comprendere come proteggere il valore nel tempo.</p><p>Quando arriva il momento di prendere decisioni sul patrimonio, è facile delegare senza avere abbastanza elementi per fare le domande giuste.</p><p><strong>Questo incontro nasce da qui.</strong></p></div>
    </Section>
    <Section tone="panel" title="Le domande alle quali proveremo a rispondere." headingId="domande-title"><Rows items={patrimonialEvent.questions.map(text => ({ text }))} /><div className="rd-prose"><p>Nessuna formula universale.</p><p>L&apos;obiettivo è darti più elementi per comprendere e scegliere con maggiore consapevolezza.</p></div></Section>
    <Section tone="cream" split title="Questo incontro è per te se..." headingId="per-chi-title"><Points items={patrimonialEvent.forWhom} /></Section>
    <Section tone="ink" split title="Non è un incontro pensato per chi cerca..." headingId="non-per-chi-title"><Points items={patrimonialEvent.notFor} /></Section>
    <Section tone="panel" split label="CHI TI ACCOMPAGNERÀ" title="Frank Cannoletta" headingId="frank-title" lead="Imprenditore & Strategista Horyzon">
      <figure className={styles.portrait}><Image src="/people/frank-no-badge.png" alt="Frank Cannoletta" fill sizes="(max-width:600px) 290px, 380px" /></figure>
      <div className="rd-prose"><p>Frank lavora sull&apos;intersezione tra persona, impresa e patrimonio.</p><p>Durante l&apos;incontro guiderà una lettura semplice dei temi patrimoniali e delle domande che vale la pena porsi prima di scegliere strumenti o interlocutori.</p><p>Il suo compito non è dirti cosa devi fare. È aiutarti a vedere meglio il quadro.</p></div>
    </Section>
    <Section tone="lime" split title="Non una risposta pronta. Un quadro più chiaro." headingId="risultato-title"><Points items={patrimonialEvent.takeaways} /></Section>
    {!after && <Section id="richiesta" tone="cream"><div className={`${styles.form} contact-form-surface`}><PatrimonialLeadForm mode="patrimonial-event" /></div></Section>}
    <PageFinal title={patrimonialEvent.title}><Cta href={target} arrow="↑">{after ? 'Parliamone' : "Partecipa all'evento"}</Cta></PageFinal>
    {after && <Section id="parliamone" tone="cream" title="Parliamone" headingId="parliamone-title"><div className="rd-prose"><p>La possibilità di richiedere un confronto individuale.</p></div><div className="rd-actions"><Cta href="mailto:info@horyzon.it?subject=Confronto%20Benessere%20Patrimoniale">Parliamone</Cta></div></Section>}
  </>;
}
