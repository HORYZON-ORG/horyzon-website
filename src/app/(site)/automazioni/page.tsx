import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { PageStructuredData } from '@/components/structured-data';
import { DigitalLeadForm } from '@/components/digital-lead-form';
import { DigitalJourney, DigitalStoryboard } from '@/components/digital-storyboard';
import { AutomationCost, AutomationDemo } from '@/components/automation-tools';
import '../benessere-digitale/digital.css';
import '../benessere-digitale/premium.css';
import '../architetti-digitali/funnel.css';
import './automations.css';

export const metadata: Metadata = {
  title: 'Horyzon Automazioni | Meno lavoro manuale, più controllo in azienda',
  description: 'Email, preventivi, documenti, ordini e attività: scopri le automazioni che possiamo progettare per la tua azienda. Prova un esempio e richiedi una valutazione del tuo processo.',
  alternates: { canonical: 'https://horyzon.it/automazioni' },
};
const faq = [
  ['È un software che devo imparare a usare?', 'Horyzon Automazioni è un servizio di progettazione e realizzazione. Partiamo dai programmi e dai processi che avete già e definiamo le connessioni possibili, i controlli e l’affiancamento necessario.'],
  ['Quanto costa e cosa viene compreso?', 'Dopo aver approfondito il processo, definiamo una proposta con attività, integrazioni, tempi, costi e modalità di verifica. Licenze, manutenzione ed eventuale assistenza continuativa vengono esplicitate nella proposta.'],
  ['Quante ore riuscirò a recuperare?', 'Dipende dal processo, dai volumi e dai controlli che devono restare alle persone. Prima osserviamo il lavoro attuale, poi misuriamo il comportamento della soluzione sui casi concordati. Il calcolatore mostra il tempo impegnato oggi, non un risparmio garantito.'],
  ['Le automazioni inviano email o prendono decisioni da sole?', 'Le regole si definiscono sul processo. Per attività come offerte, risposte e registrazioni prevediamo i passaggi di verifica concordati; invii e azioni esterne richiedono autorizzazioni e controlli adeguati al caso.'],
  ['Dobbiamo cambiare tutti i nostri programmi?', 'Verifichiamo prima cosa consentono quelli esistenti. Quando un collegamento non è possibile, valutiamo insieme un percorso alternativo e lo rendiamo esplicito nella proposta.'],
  ['Possiamo partire da una sola automazione?', 'Sì. Un processo circoscritto consente di capire la fattibilità, provare su casi reali e valutare l’utilità prima di estendere il progetto.'],
];
export default function AutomationsPage() {
  return <>
    <PageStructuredData path="/automazioni" name="Horyzon Automazioni" description="Automazioni progettate sui processi delle aziende" breadcrumbs={[{name:'Horyzon',path:'/'},{name:'Benessere Digitale',path:'/benessere-digitale'},{name:'Horyzon Automazioni',path:'/automazioni'}]} />
    <header className="ad-header"><div><Link href="/benessere-digitale" aria-label="Horyzon, Benessere Digitale"><Image src="/horyzon-logo-canonical.png" alt="Horyzon Consulting" width={1670} height={390} sizes="165px"/></Link><span>HORYZON AUTOMAZIONI</span><a href="#parliamone">Valuta il tuo processo <span aria-hidden="true">↗</span></a></div></header>
    <DigitalJourney><main id="content" className="bd ad-funnel au-funnel">
      <section className="bd-hero bd-hero-story au-hero" aria-labelledby="automation-title">
        <Image src="/digital-story/automazioni-hero.webp" alt="Due professionisti lavorano insieme su un processo aziendale al computer." fill priority sizes="100vw" className="bd-hero-photo"/>
        <div className="bd-hero-overlay"/>
        <div className="bd-wrap bd-hero-story-inner"><p className="bd-hero-eyebrow"><span className="bd-hero-dot"/> HORYZON AUTOMAZIONI</p><div><p className="bd-hero-pretitle">PER LE AZIENDE CHE FANNO ANCORA TROPPI PASSAGGI A MANO</p><h1 id="automation-title">Il tuo team<br/>ha altro da fare.<br/><em>Automatizziamo<br/>ciò che si ripete.</em></h1><p className="bd-lead">Email da smistare. Preventivi da ricostruire. Dati da ricopiare. Progettiamo automazioni sui tuoi processi, per ridurre i passaggi manuali e preparare il lavoro che il tuo team deve controllare.</p><div className="bd-actions"><a href="#attivita" className="bd-button">Trova la tua automazione <span aria-hidden="true">↓</span></a><a href="#esempio" className="bd-textlink">Prova un esempio ↗</a></div><ul className="bd-hero-assurance" aria-label="Come lavoriamo"><li>Un processo da cui partire</li><li>Proposta prima del progetto</li><li>Verifica sui casi reali</li></ul></div><div className="bd-hero-bottom"><p><span>IL PRIMO PASSO È RICONOSCERE DOVE SI PERDE TEMPO</span>Sette processi. Scegli quelli che ti riguardano.</p><a href="#tempo" aria-label="Calcola il tempo impegnato oggi"><b aria-hidden="true">↓</b></a></div></div>
      </section>
      <AutomationCost/>
      <DigitalStoryboard/>
      <AutomationDemo/>
      <section className="bd-section au-delivery" id="come-funziona"><div className="bd-wrap"><p className="bd-kicker">COSA ACQUISTI CON HORYZON AUTOMAZIONI</p><h2>Un processo progettato.<br/><em>Un’automazione da usare.</em></h2><p className="bd-method-lead">Gli Architetti Digitali Horyzon seguono il passaggio dalla tua esigenza al lavoro quotidiano. Ogni progetto definisce cosa automatizzare, cosa verificare e chi se ne occupa.</p><div className="bd-timeline"><article><b>01 / ANALISI</b><div><h3>Mettiamo a fuoco il processo.</h3><p>Osserviamo input, volumi, strumenti e controlli. Individuiamo il passaggio su cui ha senso intervenire.</p></div></article><article><b>02 / PROPOSTA</b><div><h3>Sai cosa verrà realizzato.</h3><p>Ambito, integrazioni, tempi, costi e criteri di verifica vengono definiti prima dell’avvio.</p></div></article><article><b>03 / REALIZZAZIONE</b><div><h3>Costruiamo e proviamo.</h3><p>Configuriamo il flusso e lo testiamo sui casi concordati, con i controlli e le autorizzazioni previsti.</p></div></article><article><b>04 / UTILIZZO</b><div><h3>Il team sa come usarlo.</h3><p>Consegniamo le indicazioni operative e verifichiamo il risultato. Assistenza e manutenzione seguono le condizioni concordate.</p></div></article></div><div className="au-delivery-note"><span>IL CRITERIO È L’UTILITÀ.</span><p>Confrontiamo passaggi manuali, tempi, errori e utilizzo effettivo. Se il processo non si presta all’automazione, lo chiariamo nella valutazione.</p></div></div></section>
      <section className="bd-section ad-expect au-first"><div className="bd-wrap"><p className="bd-kicker">PERCHÉ COMINCIARE ADESSO</p><h2>Il prossimo ordine arriverà.<br/><em>Deve fare lo stesso giro?</em></h2><div className="ad-expect-grid"><p>Il motivo per valutare un’automazione è nel lavoro che si ripete. Partire da un processo oggi permette di capire quali passaggi potrebbero essere evitati la prossima volta.</p><ul><li>Scegli un’attività frequente e circoscritta.</li><li>Raccontaci come la gestite e quali programmi usate.</li><li>Valutiamo fattibilità e priorità, poi definiamo l’eventuale proposta.</li></ul></div><a href="#parliamone" className="bd-button">Voglio valutare il mio processo <span aria-hidden="true">↗</span></a></div></section>
      <section className="bd-section ad-faq"><div className="bd-wrap"><p className="bd-kicker">PRIMA DI DECIDERE</p><h2>Le risposte per<br/><em>fare un passo concreto.</em></h2>{faq.map(([q,a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></section>
      <section className="bd-section bd-contact" id="parliamone"><div className="bd-wrap bd-contact-inner"><p className="bd-kicker">LA TUA RICHIESTA · HORYZON AUTOMAZIONI</p><h2>Scegli il lavoro da cambiare.<br/><em>Cominciamo da lì.</em></h2><p>Le automazioni selezionate arrivano insieme alla tua richiesta. Ti ricontatteremo per approfondire il processo e capire quale intervento proporre.</p><DigitalLeadForm/><p className="bd-footnote">Inviare la richiesta non avvia un progetto né comporta un acquisto. Fattibilità, condizioni e risultati attesi vengono definiti sul tuo processo.</p></div></section>
    </main></DigitalJourney>
    <footer className="ad-footer"><div><Link href="/benessere-digitale">La visione Horyzon: Benessere Digitale ↗</Link><p>Horyzon Consulting · FELICITÀ srl · P. IVA 05120660757</p><nav aria-label="Informazioni legali"><a href="https://www.iubenda.com/privacy-policy/64704330">Privacy</a><a href="https://www.iubenda.com/privacy-policy/64704330/cookie-policy">Cookie</a><Link href="/termini-condizioni">Termini e condizioni</Link></nav></div></footer>
  </>;
}
