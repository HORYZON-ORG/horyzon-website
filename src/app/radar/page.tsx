import { PageStructuredData } from '@/components/structured-data';
import { pageMetadata } from '@/content/seo';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { RadarStory } from '@/components/radar-story';
import { RADAR_URL } from '@/content/product-truth';
import './radar-commercial.css';

export const metadata: Metadata = pageMetadata({ path: '/radar', title: 'Inizia il Radar d’Impresa', description: 'Una prima fotografia guidata di cinque reparti, processi, autonomia dal titolare e uso dell’intelligenza artificiale.', noindex: true });

const signals = [
  'Le decisioni importanti tornano sempre sulla tua scrivania.',
  'Le trattative migliori hanno ancora bisogno della tua presenza.',
  'Le procedure esistono soprattutto nella testa delle persone.',
  'I numeri arrivano troppo tardi per orientare le decisioni.',
  'Strumenti e AI vengono usati, ma non dentro un sistema comune.',
] as const;

const departments = [
  ['Amministrazione', 'Cassa, margini, budget e continuità operativa.'],
  ['Produzione', 'Procedure, qualità, gestione degli errori e soddisfazione del cliente.'],
  ['Commerciale', 'Metodo di vendita, continuità delle entrate e trattative delegabili.'],
  ['Marketing', 'Posizionamento, reputazione e flusso costante di opportunità.'],
  ['Persone', 'Ruoli, responsabilità, selezione, crescita e continuità.'],
] as const;

const outputs = [
  ['Profilo sulle cinque aree', 'Un Radar leggibile dei reparti osservati.'],
  ['Maturità dei processi', 'Quanto il lavoro poggia su metodi condivisi e ripetibili.'],
  ['Autonomia dal titolare', 'Quanto l’impresa opera senza il tuo intervento diretto.'],
  ['Indice globale', 'Una sintesi bilanciata di struttura organizzativa e autonomia.'],
  ['Intelligenza artificiale', 'Quanto l’AI è presente e quanto il team è pronto a usarla.'],
  ['Area forte e area prioritaria', 'Il punto su cui puoi contare e quello da approfondire per primo.'],
] as const;

const steps = [
  ['Racconti il contesto', 'Indichi azienda, settore, dimensione e i riferimenti necessari a leggere il risultato.'],
  ['Completi il Radar', 'Rispondi a una domanda alla volta sulle cinque aree, sulla stagionalità e sull’uso dell’AI.'],
  ['Vedi il profilo', 'Leggi gli indici, l’area più solida, quella prioritaria e l’interpretazione settoriale.'],
  ['Scegli se approfondire', 'Il risultato prepara un confronto con Horyzon, senza generare automaticamente un piano.'],
] as const;

const faqs = [
  ['Quanto tempo richiede?', 'L’interfaccia attuale indica circa 8 minuti. Il tempo può variare in base al ritmo di risposta.'],
  ['Devo avere dati finanziari a portata di mano?', 'No. È un’autovalutazione guidata: rispondi in base a ciò che accade oggi nella tua impresa.'],
  ['Ricevo subito il risultato?', 'Sì. Al termine vedi il profilo sulle cinque aree, gli indici di processo e autonomia, l’area più solida, quella prioritaria e la lettura sull’AI.'],
  ['Le domande cambiano in base al settore?', 'Le domande organizzative principali sono comuni. Il risultato usa una lettura settoriale per rendere più concreto il contesto.'],
  ['È una diagnosi completa?', 'No. È una prima fotografia. Una diagnosi completa richiede confronto, evidenze, numeri e osservazione dei processi reali.'],
  ['Il Radar promette che l’azienda funzionerà senza di me?', 'No. Misura segnali di maturità e autonomia. Ridurre la dipendenza dal titolare richiede scelte, responsabilità e lavoro nel tempo.'],
] as const;

function RadarCta({ position, label = 'Inizia il Radar d’Impresa' }: { position: string; label?: string }) {
  return <a className="radar-commercial-cta" href={RADAR_URL} data-analytics-event="radar_lp_cta_click" data-cta-position={position}>{label}<span aria-hidden="true">↗</span></a>;
}

export default function CommercialRadarPage() {
  return <div className="radar-commercial"><PageStructuredData path="/radar" name="Inizia il Radar d’Impresa" description="Una prima fotografia guidata di cinque reparti, processi, autonomia dal titolare e uso dell’intelligenza artificiale." />
    <header className="radar-commercial-header">
      <Link className="radar-commercial-brand" href="/" aria-label="Horyzon, homepage"><span aria-hidden="true"/><strong>HORYZON</strong></Link>
      <RadarCta position="header" label="Inizia" />
    </header>

    <main id="content">
      <section className="radar-commercial-hero">
        <div className="radar-commercial-hero-copy">
          <p className="radar-commercial-context">Radar d’Impresa Horyzon</p>
          <h1>La tua azienda funziona. Ma troppo spesso funziona perché ci sei tu.</h1>
          <p className="radar-commercial-intro">Il Radar d’Impresa ti aiuta a vedere dove l’organizzazione è già solida e dove decisioni, persone e processi dipendono ancora dalla tua presenza.</p>
          <div className="radar-commercial-actions"><RadarCta position="hero"/><a href="#che-cosa-misura">Guarda prima che cosa misura</a></div>
          <p className="radar-commercial-proof">Circa 8 minuti <span/> Risultato immediato <span/> Nessuna risposta giusta o sbagliata</p>
          <p className="radar-commercial-caveat">È una prima fotografia guidata, non una diagnosi automatica e non una promessa di risultato.</p>
        </div>
        <div className="radar-commercial-hero-radar" aria-hidden="true">
          <span className="radar-commercial-axis axis-a"/><span className="radar-commercial-axis axis-b"/><span className="radar-commercial-axis axis-c"/><span className="radar-commercial-axis axis-d"/><span className="radar-commercial-axis axis-e"/>
          <span className="radar-commercial-ring ring-one"/><span className="radar-commercial-ring ring-two"/><span className="radar-commercial-ring ring-three"/>
          <span className="radar-commercial-core">5</span>
        </div>
      </section>

      <section className="radar-commercial-signals" aria-labelledby="signals-title">
        <div><p className="radar-commercial-context">Il problema che si vede ogni giorno</p><h2 id="signals-title">Se ti assenti, che cosa rallenta per primo?</h2><p>La dipendenza dal titolare non si misura soltanto nelle ore lavorate. Si vede nei punti in cui l’organizzazione aspetta ancora te.</p></div>
        <ol>{signals.map((signal,index)=><li key={signal}><span>{String(index+1).padStart(2,'0')}</span>{signal}</li>)}</ol>
      </section>

      <section id="che-cosa-misura" className="radar-commercial-measure" aria-labelledby="measure-title">
        <header><p className="radar-commercial-context">Che cosa misura</p><h2 id="measure-title">Cinque aree. Una sola impresa.</h2><p>Ogni asse osserva un reparto e il suo grado di organizzazione. Il profilo finale rende visibili gli squilibri per scegliere dove approfondire.</p></header>
        <div className="radar-commercial-measure-layout"><RadarStory/><div className="radar-commercial-departments">{departments.map(([name,description])=><article key={name}><h3>{name}</h3><p>{description}</p></article>)}</div></div>
        <div className="radar-commercial-centered"><RadarCta position="measure" label="Scopri da quale reparto partire"/></div>
      </section>

      <section className="radar-commercial-output" aria-labelledby="output-title">
        <header><p className="radar-commercial-context">Il risultato</p><h2 id="output-title">Alla fine non ricevi un’etichetta. Ricevi una mappa.</h2><p>Il risultato separa ciò che spesso viene confuso: quanto sono strutturati i processi e quanto l’operatività dipende ancora dal titolare.</p></header>
        <div className="radar-commercial-output-list">{outputs.map(([title,description],index)=><article key={title} className={index===0?'featured':undefined}><span>{String(index+1).padStart(2,'0')}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div>
        <p className="radar-commercial-note">Il risultato è visibile subito. Non sostituisce l’analisi di documenti, numeri e processi reali.</p>
      </section>

      <section className="radar-commercial-video" aria-labelledby="video-title">
        <figure><Image src="/people/frank.webp" alt="Frank Cannoletta" fill sizes="(max-width: 850px) 92vw, 52vw"/><figcaption>Il video di Frank sarà inserito qui dopo la registrazione e la revisione finale.</figcaption></figure>
        <div><p className="radar-commercial-context">Il volto del debriefing</p><h2 id="video-title">Perché abbiamo costruito il Radar</h2><p>Frank spiega perché il punto di partenza viene prima delle soluzioni e come leggere il risultato senza trasformarlo in un giudizio sull’imprenditore.</p><blockquote>“Il Radar serve a rendere visibile la situazione di oggi. Il lavoro utile comincia quando la colleghiamo agli obiettivi dell’impresa.”</blockquote><RadarCta position="video" label="Inizia la tua fotografia d’impresa"/><p className="radar-commercial-fine">Il questionario si apre nell’ambiente Horyzon Hub.</p></div>
      </section>

      <section className="radar-commercial-steps" aria-labelledby="steps-title">
        <header><p className="radar-commercial-context">Come funziona</p><h2 id="steps-title">Dal primo segnale a una priorità concreta.</h2></header>
        <ol>{steps.map(([title,description],index)=><li key={title}><span>{String(index+1).padStart(2,'0')}</span><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol>
      </section>

      <section className="radar-commercial-system" aria-labelledby="system-title">
        <p className="radar-commercial-context">Dopo la fotografia</p><h2 id="system-title">Il Radar indica dove guardare. Il lavoro comincia da lì.</h2>
        <div><p>Il profilo viene letto insieme agli obiettivi dell’imprenditore. Il primo risultato utile non è una lista infinita di interventi, ma una priorità: il reparto o il processo che merita attenzione per primo.</p><p>Quando esistono le condizioni per proseguire, Horyzon collega diagnosi, organizzazione, persone, procedure, strumenti digitali e intelligenza artificiale in un percorso verificabile.</p><p>Blueprint e attivazione distinguono ciò che è previsto da ciò che è realmente configurato e testato. La Platform rende visibili gli elementi appropriati all’azienda senza sostituire responsabilità e decisioni umane.</p></div>
        <Link href="/metodo">Come lavora Horyzon <span aria-hidden="true">↗</span></Link>
      </section>

      <section className="radar-commercial-fit" aria-labelledby="fit-title">
        <div><p className="radar-commercial-context">A chi serve</p><h2 id="fit-title">È un buon punto di partenza se…</h2><ul><li>hai già un’impresa con clienti, persone o collaboratori;</li><li>senti che troppe decisioni dipendono ancora da te;</li><li>vuoi scegliere una priorità prima di aggiungere strumenti;</li><li>sei disposto a rispondere sulla situazione reale.</li></ul></div>
        <div><p className="radar-commercial-context">Limiti chiari</p><h2>Non è pensato per…</h2><ul><li>ottenere una valutazione finanziaria, fiscale o legale;</li><li>ricevere un piano automatico senza confronto;</li><li>garantire autonomia, redditività o crescita entro una data;</li><li>sostituire un’analisi completa dei processi aziendali.</li></ul></div>
      </section>

      <section className="radar-commercial-trust" aria-labelledby="trust-title">
        <div><p className="radar-commercial-context">Dati e fiducia</p><h2 id="trust-title">Il contesto serve a leggere il risultato, non a giudicare l’impresa.</h2></div>
        <div><p>Prima del Radar ti vengono chiesti nome, azienda, settore, dimensione, stagionalità, telefono ed email. Servono a creare il profilo e contestualizzare la lettura.</p><p>Non inserire dati di clienti, dipendenti o altre informazioni sensibili nelle risposte.</p><Link href="/privacy-policy">Leggi l’informativa privacy <span aria-hidden="true">↗</span></Link></div>
      </section>

      <section className="radar-commercial-faq" aria-labelledby="faq-title">
        <header><p className="radar-commercial-context">Domande frequenti</p><h2 id="faq-title">Prima di iniziare.</h2></header>
        <div>{faqs.map(([question,answer])=><details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
      </section>

      <section className="radar-commercial-final" aria-labelledby="final-title">
        <div className="radar-commercial-final-radar" aria-hidden="true"/>
        <p className="radar-commercial-context">Il prossimo passo</p><h2 id="final-title">Prima di aggiungere un altro strumento, scegli dove intervenire.</h2><p>Completa il Radar e guarda la tua impresa attraverso cinque aree che devono funzionare insieme.</p><RadarCta position="final"/><p className="radar-commercial-proof">Circa 8 minuti <span/> Risultato immediato <span/> Apertura su Horyzon Hub</p><Link href="/radar-impresa">Preferisci capire prima il metodo? Leggi la pagina Radar d’Impresa.</Link>
      </section>
    </main>

    <footer className="radar-commercial-footer"><Link className="radar-commercial-brand" href="/"><span aria-hidden="true"/><strong>HORYZON</strong></Link><nav aria-label="Informazioni"><Link href="/radar-impresa">Radar d’Impresa</Link><Link href="/privacy-policy">Privacy</Link><a href="mailto:info@horyzon.it">info@horyzon.it</a></nav></footer>
  </div>;
}
