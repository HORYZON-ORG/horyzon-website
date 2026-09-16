import Image from 'next/image';
import Link from 'next/link';

const directions: Record<string, { label: string; words: string[]; question: string; outcome: string }> = {
 'benessere-organizzativo': { label: 'Benessere organizzativo', words: ['Persone', 'Ruoli', 'Relazioni'], question: 'L’azienda cresce. L’organizzazione riesce a seguirla?', outcome: 'Più chiarezza nel lavoro. Più spazio per le persone.' },
 'benessere-patrimoniale': { label: 'Benessere patrimoniale', words: ['Protezione', 'Equilibrio', 'Continuità'], question: 'Le scelte di oggi proteggono ciò che vuoi costruire domani?', outcome: 'Una visione d’insieme, prima della prossima decisione.' },
 'benessere-digitale': { label: 'Benessere digitale', words: ['Dati', 'Strumenti', 'Competenze'], question: 'La tecnologia semplifica il lavoro o aggiunge complessità?', outcome: 'Strumenti utili. Persone preparate. Controllo delle scelte.' },
};
const disciplinePosition: Record<string, string> = {
 'benessere-organizzativo': 'È il nucleo della trasformazione: organigramma, leadership, ruoli, processi, delega, routine e standard fanno evolvere il titolare da collo di bottiglia a guida strategica.',
 'benessere-digitale': 'È lo strato abilitante: strumenti scelti sui processi reali, ChatGPT Work organizzato per ruoli, permessi, output strutturati ed evidenze rendono il modello utilizzabile senza sostituire la responsabilità umana.',
 'benessere-patrimoniale': 'Protegge continuità e valore: visibilità finanziaria, resilienza e allineamento tra impresa, titolare e famiglia richiedono coordinamento con professionisti qualificati.',
};

export function EditorialVisual({ page }: { page: string }) {
 const area = directions[page.split('/')[0]];
 const library = page === 'biblioteca' || page.includes('libro/');
 const human = page === 'persone' || page === 'entra-in-horyzon';
 const words = area?.words ?? (library ? ['Leggere', 'Comprendere', 'Evolvere'] : human ? ['Competenze', 'Incontri', 'Prospettive'] : ['Ascolto', 'Direzione', 'Cambiamento']);
 return <figure className={`editorial-visual ${library ? 'visual-library' : human ? 'visual-people' : 'visual-landscape'}`}>
  <div className="editorial-image"><Image src={library ? '/books/management.webp' : human ? '/people/angelo.webp' : '/journey/horizon.webp'} alt={library ? 'Management Umano, di Angelo Ria Chetta' : human ? 'Angelo Ria Chetta, fondatore di Horyzon' : ''} fill sizes="(max-width:850px) 90vw, 42vw" priority/>
   {!library && !human && <span className="visual-horizon" aria-hidden="true"/>}
  </div>
  <figcaption><span>{area?.label ?? (library ? 'La biblioteca Horyzon' : human ? 'Il valore degli incontri' : 'Una direzione condivisa')}</span><p>{words.map(word => <span key={word}>{word}</span>)}</p></figcaption>
 </figure>;
}

type Service = { title: string; intro: string; href: string };
export function AreaEditorial({ area, body, points, services }: { area: string; body: string[]; points: string[]; services: Service[] }) {
 const direction = directions[area];
 return <>
  <nav className="area-subnav" aria-label="In questa pagina"><span>{direction.label}</span><a href="#comprendere">Il punto di partenza</a><a href="#ambiti">Come interveniamo</a><a href="#primo-passo">Il prossimo passo</a></nav>
  <section className="area-introduction" id="comprendere"><div><p className="section-kicker">Riconoscere il punto di partenza</p><h2>{direction.question}</h2></div><div className="area-narrative"><p><strong>{disciplinePosition[area]}</strong></p>{body.map(text => <p key={text}>{text}</p>)}<div className="area-signature"><span aria-hidden="true">↗</span><p>{direction.outcome}</p></div></div></section>
  <section className="area-services" id="ambiti"><header><p className="section-kicker">Dall’ascolto al lavoro concreto</p><h2>Un percorso.<br/>Più modi di fare la differenza.</h2></header><div>{services.map((service, i) => <Link className="service-row" href={service.href} key={service.href}><span className="service-number">0{i + 1}</span><div><h3>{service.title}</h3><p>{service.intro}</p></div><span className="service-open" aria-label="Approfondisci">↗</span></Link>)}</div></section>
  <section className="area-focus"><div><p className="section-kicker">Ciò che mettiamo a fuoco</p><h2>La visione diventa<br/>attenzione ai dettagli.</h2><p>Le priorità si definiscono insieme, a partire dalla realtà della tua azienda.</p></div><ul>{points.map(point => <li key={point}><span aria-hidden="true">↗</span>{point}</li>)}</ul></section>
  <section className="area-first-step" id="primo-passo"><p className="section-kicker">Cominciamo da qui</p><h2>Prima di cambiare,<br/>guardiamoci dentro.</h2><p>Una breve autovalutazione per osservare il presente e individuare un primo tema da approfondire.</p><Link href="/misura" className="button primary">Trova il tuo punto di partenza <span aria-hidden="true">↗</span></Link><Link href="/contatti" className="text-link">Preferisci parlarne con noi?</Link></section>
 </>;
}
