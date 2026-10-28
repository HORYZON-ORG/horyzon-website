import type { Metadata } from "next";
import Link from "next/link";
import { JobAdBuilder } from "@/components/job-ad-builder";
import { PageStructuredData } from "@/components/structured-data";
import { SiteFooter, SiteHeader } from "@/components/site-shell";
import { pageMetadata } from "@/content/seo";
import styles from "./annuncio-10x.module.css";

const description = "Crea o migliora un annuncio di lavoro partendo dal ruolo, dai risultati attesi e dalle condizioni reali offerte dall’azienda.";

const faqs = [
  { question: "Serve avere già un annuncio?", answer: "No. Puoi partire da un testo esistente oppure compilare un brief guidato per costruire l’annuncio da zero." },
  { question: "Il risultato garantisce più candidature?", answer: "No. Annuncio 10x migliora chiarezza, completezza e coerenza del testo, ma non può garantire il numero o la qualità delle candidature." },
  { question: "Quali informazioni devo preparare?", answer: "Ruolo, risultati attesi, attività reali, competenze indispensabili e condizioni concrete come sede, orario e contratto." },
  { question: "Posso modificare il testo ottenuto?", answer: "Sì. L’output è una base operativa da verificare e adattare prima della pubblicazione." },
  { question: "Dove conviene pubblicare l’annuncio?", answer: "Dipende dal ruolo, dalla zona e dal tipo di candidato. La versione completa includerà una checklist per scegliere i canali più coerenti." },
] as const;

export const metadata: Metadata = pageMetadata({ path: "/annuncio-10x", title: "Annuncio 10x", description, noindex: true });

export default function Annuncio10xPage() {
  return <>
    <PageStructuredData path="/annuncio-10x" name="Annuncio 10x" description={description} breadcrumbs={[{ name: "Horyzon", path: "/" }, { name: "Annuncio 10x", path: "/annuncio-10x" }]} faqs={faqs} />
    <SiteHeader />
    <main id="content" className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Horyzon / Strumenti per le imprese</p>
          <h1>Trova candidati migliori partendo da un annuncio migliore.</h1>
          <p className={styles.lead}>Trasforma informazioni frammentarie in un annuncio chiaro, concreto e pronto da verificare. Parti da un testo esistente oppure costruiscilo da zero.</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="#prova">Prova il prototipo <span aria-hidden="true">↓</span></Link>
            <span>Versione di validazione · nessun pagamento</span>
          </div>
        </div>
        <div className={styles.heroPanel} aria-label="Contenuto dell’output">
          <p>Il tuo output</p>
          <ol><li><span>01</span> Annuncio riscritto</li><li><span>02</span> Informazioni mancanti</li><li><span>03</span> Osservazioni principali</li><li><span>04</span> Checklist di pubblicazione</li></ol>
          <div><strong>Un annuncio non deve riempire uno spazio.</strong><span>Deve rendere comprensibili ruolo, aspettative e contesto.</span></div>
        </div>
      </section>

      <section className={styles.problem}>
        <p className={styles.kicker}>Il problema</p>
        <div><h2>Molti annunci chiedono tutto.<br />E spiegano troppo poco.</h2><p>Poche candidature o profili incoerenti spesso nascono prima della selezione: quando il ruolo è descritto con formule generiche, requisiti indistinti e condizioni lasciate implicite.</p></div>
        <ul><li><span>Ruolo</span><strong>Cosa deve produrre davvero?</strong></li><li><span>Persona</span><strong>Cosa è indispensabile?</strong></li><li><span>Contesto</span><strong>Perché dovrebbe scegliere voi?</strong></li></ul>
      </section>

      <JobAdBuilder />

      <section className={styles.beforeAfter}>
        <header><p className={styles.kicker}>Prima e dopo</p><h2>Da una richiesta generica a un ruolo riconoscibile.</h2></header>
        <div className={styles.comparison}>
          <article><span>Prima</span><h3>Cerchiamo commerciale dinamico</h3><p>Azienda leader cerca figura commerciale automunita, con ottime capacità relazionali, problem solving e forte motivazione. Richiesta esperienza nel settore.</p></article>
          <article><span>Dopo</span><h3>Commerciale B2B per sviluppare clienti nel territorio</h3><p>Nei primi sei mesi costruirai un portafoglio di PMI nell’area assegnata, dalla prima relazione alla proposta. Avrai obiettivi condivisi, affiancamento iniziale e condizioni esplicite.</p></article>
        </div>
      </section>

      <section className={styles.method}>
        <div><p className={styles.kicker}>Il metodo Horyzon</p><h2>Prima la realtà del ruolo. Poi le parole.</h2></div>
        <p>Lo strumento guida l’azienda a distinguere risultati, attività, requisiti e condizioni. L’output non sostituisce la selezione e non promette assunzioni: rende più chiaro il primo incontro tra impresa e candidato.</p>
      </section>

      <section className={styles.faq} aria-labelledby="faq-title">
        <header><p className={styles.kicker}>Domande frequenti</p><h2 id="faq-title">Prima di iniziare.</h2></header>
        <div>{faqs.map((faq) => <details key={faq.question}><summary>{faq.question}<span aria-hidden="true">+</span></summary><p>{faq.answer}</p></details>)}</div>
      </section>
    </main>
    <SiteFooter />
  </>;
}
