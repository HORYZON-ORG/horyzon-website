import { Annunci10xAnalyzeFlow } from '@/components/annunci-10x/annunci-10x-analyze-flow';
import flowStyles from '@/components/annunci-10x/annunci-10x.module.css';
import { SITE_URL } from '@/content/seo';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import '@/styles/horyzon-landing.css';
import './annunci-landing.css';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const metadata: Metadata = {
  title: { absolute: 'Check-up gratuito dell’annuncio | HORYZON Recruiting' },
  description: 'Ricevi un PDF gratuito con valutazione automatica, proposta migliorata e confronto dei punteggi. Poi scegli se prenotare 15 minuti con Angelo.',
  alternates: { canonical: `${SITE_URL}/recruiting/check-up-annuncio` },
  robots: { index: false, follow: false, nocache: true },
};
const faqs = [
  ['Il check-up è davvero gratuito?', 'Sì. La valutazione automatica, la proposta migliorata e il PDF sono gratuiti. Se lo desideri puoi prenotare anche 15 minuti con Angelo, senza obbligo di acquisto.'],
  ['Che cosa contiene la versione migliorata?', 'Una riscrittura basata sulle informazioni presenti nel tuo annuncio. I dati che mancano vengono segnalati: non inventiamo condizioni dell’offerta. La telefonata facoltativa può aiutare a completarli.'],
  ['Quanto tempo richiede?', 'Puoi compilare la richiesta direttamente qui. Vedrai lo stato reale dell’elaborazione e dell’invio. Il sistema non attribuisce ad Angelo una revisione personale: la valutazione è automatica.'],
  ['Come si svolgono i 15 minuti?', 'È una telefonata. Prenoti l’orario e lasci il numero: Angelo ti chiamerà per parlare della figura cercata, dei risultati attesi e delle condizioni offerte.'],
  ['Posso richiederlo se non ho ancora scritto l’annuncio?', 'Questo check-up parte da un testo esistente. Se devi costruire l’annuncio da zero, scrivi ad angelo.ria.chetta@horyzon.it per spiegare l’esigenza.'],
  ['Il check-up mi garantisce di trovare il candidato?', 'La revisione aiuta a rendere più chiaro e coerente il messaggio. L’esito della ricerca dipende anche dal ruolo, dalle condizioni offerte, dai canali e dal processo di selezione.'],
] as const;
function Cta() { return <a className="rd-cta" href="#valuta">Richiedi il check-up gratuito del tuo annuncio<span aria-hidden="true">↓</span></a>; }
function Brand() { return <Link href="/" className="ax-brand" aria-label="HORYZON Recruiting"><Image src="/annunci-10x/horyzon-consulting-recruiting-white.png" alt="" width={2048} height={768} sizes="220px" unoptimized suppressHydrationWarning /></Link>; }
export default function Annunci10xPage() {
  return <div className="rd ax ck">
    <a className="ax-skip" href="#content">Salta al contenuto</a>
    <header className="rd-header"><Brand /><a className="rd-link" href="#valuta">Check-up gratuito ↓</a></header>
    <main id="content" data-page="recruiting-checkup">
      <section className="rd-hero ax-hero" aria-labelledby="ax-hero-title">
        <div className="rd-hero-copy">
          <p className="rd-label">HORYZON Recruiting · Check-up gratuito dell’annuncio</p>
          <h1 id="ax-hero-title">Cerchi una persona. <span className="rd-accent">Il tuo annuncio le dà un buon motivo per candidarsi?</span></h1>
          <p className="rd-lead">Quando arrivano poche candidature, oppure molte ma lontane dal profilo cercato, vale la pena partire da ciò che l’annuncio comunica.</p>
          <p>Carica il tuo annuncio per il check-up automatico gratuito. Ricevi via email un PDF con il voto motivato, una possibile versione migliorata e le informazioni che possono renderla più precisa.</p>
          <div className="rd-actions"><Cta /></div>
          <p>Un annuncio · PDF gratuito via email · 15 minuti facoltativi con Angelo</p>
        </div>
        <aside className="rd-tile" aria-label="Contenuto del regalo">
          <p className="rd-label">Dall’attuale al possibile</p><h2>Il tuo annuncio, letto con criteri espliciti.</h2>
          <ol><li>Valutazione motivata su 20 controlli</li><li>Una proposta fedele ai fatti disponibili</li><li>Confronto dei voti, senza risultati preassegnati</li><li>PDF completo da scaricare e conservare</li></ol>
          <p>Il regalo non dipende dalla prenotazione di una telefonata.</p>
        </aside>
      </section>
      <section className="rd-map" aria-labelledby="situazioni-title">
        <header><p className="rd-label">Ti riconosci?</p><h2 id="situazioni-title">Partiamo da ciò che <span>l’annuncio comunica.</span></h2></header>
        <ul className="rd-tiles">{[
          ['Poche risposte', 'Pubblichi e arrivano poche risposte.', 'La ricerca resta aperta e il lavoro continua a ricadere su chi è già in azienda.'],
          ['Fuori target', 'Ricevi candidature poco pertinenti.', 'Dedichi tempo a leggere CV e fare colloqui, ma fai fatica a riconoscere le persone adatte.'],
          ['Ricerca ferma', 'Hai già cambiato l’annuncio più volte.', 'Non è ancora chiaro che cosa debba cambiare nel messaggio, nella proposta o nella definizione del ruolo.'],
        ].map(([tag, title, text]) => <li className="rd-tile" key={tag}><span className="rd-tile-tag">{tag}</span><h3>{title}</h3><p>{text}</p></li>)}</ul>
      </section>
      <section className="rd-map" aria-labelledby="regalo-title">
        <header><p className="rd-label">Che cosa riceverai</p><h2 id="regalo-title">Un risultato utile, <span>già nel PDF.</span></h2></header>
        <p>Testo originale, griglia e voto, criticità motivate, possibile versione migliorata, seconda valutazione e differenze. Ogni testo viene valutato con gli stessi 20 controlli. Il voto su 10 deriva dal punteggio su 100 diviso 10.</p>
        <p>La proposta non inventa stipendio, benefit, requisiti o condizioni. Gli elementi da chiarire sono indicati a parte. Anche un annuncio già buono può mantenere il proprio voto.</p>
        <p><a className="rd-link" href="/annunci-10x/checkup-esempio.pdf" target="_blank" rel="noopener noreferrer">Guarda un facsimile del PDF ↗</a> · Annuncio fittizio e valutazioni simulate, a scopo dimostrativo.</p>
        <p className="rd-map-note">È una valutazione automatica di chiarezza e completezza. Non misura la qualità dell’azienda o delle persone e non garantisce candidature o assunzioni.</p>
      </section>
      <section className="ck-video-section" aria-labelledby="checkup-video-title">
        <div className="ck-video-copy">
          <p className="rd-label">Il punto da cui partire</p>
          <h2 id="checkup-video-title">Quanto è chiaro<br />il tuo annuncio?</h2>
          <p className="ck-video-lead">«Dinamico e motivato» dice poco sul lavoro che una persona farà. Frank parte da qui: rendere riconoscibili il ruolo e ciò che richiede.</p>
        </div>
        <div className="ck-video-detail">
          <p>Il check-up mette a confronto il testo attuale e una versione migliorata, con valutazioni motivate e modifiche spiegate. Ricevi tutto nel PDF gratuito via email.</p>
          <p>HORYZON Recruiting integra metodo e strumenti specialistici Performia nel proprio lavoro con le imprese.</p>
          <p className="ck-video-note">Il regalo è già completo. I 15 minuti con Angelo sono un approfondimento successivo e facoltativo.</p>
          <Cta />
        </div>
        <figure className="ck-video-figure">
          <video className="ck-video" width={720} height={1280} controls playsInline preload="none" poster="/recruiting/checkup-51/poster.jpg" aria-label="Frank presenta il check-up gratuito dell’annuncio" suppressHydrationWarning>
            <source src="/recruiting/checkup-51/checkup-51.mp4" type="video/mp4" />
            <track src="/recruiting/checkup-51/captions-it.vtt" kind="captions" srcLang="it" label="Italiano" />
            Puoi <a href="/recruiting/checkup-51/checkup-51.mp4">guardare il video del check-up gratuito</a> oppure leggere il testo qui sotto.
          </video>
          <figcaption>Frank · Check-up gratuito dell’annuncio · 23 secondi</figcaption>
          <details className="ck-video-transcript"><summary>Leggi il contenuto del video</summary><p>Ma il tuo annuncio di lavoro, quanto è chiaro davvero? Spesso dice «dinamico e motivato», ma non dice cosa farà la persona.</p><p>Dall’attuale al possibile: ricevi un PDF gratuito via email con valutazione motivata, versione migliorata e confronto dei voti.</p><p>Il regalo è già completo. Se vuoi approfondire, puoi scegliere 15 minuti gratuiti con Angelo: un confronto facoltativo per partire dal lavoro già fatto.</p><p>Carica l’annuncio qui sotto. Nessun obbligo di acquisto.</p></details>
        </figure>
      </section>
      <section className="ax-price" aria-labelledby="angelo-title">
        <Image src="/people/angelo.webp" alt="Angelo Ria Chetta" width={320} height={480} style={{ width: '100%', maxWidth: 320, height: 'auto', borderRadius: 12 }} suppressHydrationWarning />
        <div className="ax-price-copy"><p className="rd-label">Chi puoi incontrare dopo il check-up</p><h2 id="angelo-title">Angelo Ria Chetta</h2><p>Analista d’azienda specializzato nelle risorse umane. Autore, ricercatore e imprenditore, specialista in benessere imprenditoriale e organizzativo.</p><p>Nel lavoro di recruiting collega annuncio, risultati attesi dal ruolo, selezione e inserimento. È autore di <em>Aziende attraenti per campioni e talenti</em>.</p><p>Puoi scegliere 15 minuti gratuiti per partire dal lavoro già fatto e individuare ulteriori miglioramenti.</p></div>
      </section>
      <section className="rd-map" aria-labelledby="come-title"><header><h2 id="come-title">Come funziona</h2></header><ol><li><strong>Carica l’annuncio.</strong> Allega PDF, DOCX o TXT, incolla il testo oppure usa un link pubblico. Indica email e telefono.</li><li><strong>Ricevi il PDF.</strong> Verifica l’email con il codice: il sistema prepara il confronto e lo invia alla tua casella.</li><li><strong>Scegli se approfondire.</strong> Dopo il regalo puoi prenotare 15 minuti con Angelo.</li></ol></section>
      <section id="valuta" className="rd-product" aria-labelledby="ax-product-title"><header className="rd-product-head"><p className="rd-label">Richiedi il tuo check-up</p><h2 id="ax-product-title">Hai un annuncio aperto? <em>Partiamo da quello.</em></h2></header><div className={flowStyles.flowRoot}><Annunci10xAnalyzeFlow /></div></section>
      <section className="rd-faq" aria-labelledby="faq-title"><h2 id="faq-title">Domande frequenti</h2><div>{faqs.map(([q, a]) => <details key={q}><summary>{q}<span aria-hidden="true" /></summary><p>{a}</p></details>)}</div></section>
      <section className="rd-final"><h2>Il primo passo è <em>il tuo annuncio.</em></h2><Cta /></section>
    </main>
    <footer className="rd-footer ax-footer"><div><Brand /><p>FELICITÀ srl · Viale Papiniano 28, 20123 Milano · P.IVA 05120660757 · SDI SU9YNJA</p></div><nav aria-label="Link legali"><Link href="/privacy-policy">Privacy</Link><Link href="/cookie-policy">Cookie</Link><a href="mailto:info@horyzon.it">info@horyzon.it</a></nav><p>Impresa, Economia e Umanità al servizio del Sistema Italia.</p></footer>
  </div>;
}
