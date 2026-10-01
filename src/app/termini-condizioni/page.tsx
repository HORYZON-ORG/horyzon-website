import { PageStructuredData } from '@/components/structured-data';
import { SiteFooter, SiteHeader } from '@/components/site-shell';
import { pageMetadata } from '@/content/seo';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = pageMetadata({
  path: '/termini-condizioni',
  title: 'Termini e condizioni',
  description: 'Condizioni di utilizzo di horyzon.it e delle offerte digitali e professionali di Horyzon Consulting.',
  noindex: true,
});

export default function TermsConditionsPage() {
  return <>
    <PageStructuredData
      path="/termini-condizioni"
      name="Termini e condizioni"
      description="Condizioni di utilizzo di horyzon.it e delle offerte digitali e professionali di Horyzon Consulting."
      type="WebPage"
      breadcrumbs={[
        { name: 'Horyzon', path: '/' },
        { name: 'Termini e condizioni', path: '/termini-condizioni' },
      ]}
    />
    <SiteHeader />
    <main id="content" className="inside editorial-page page-legal">
      <section className="inside-hero">
        <div>
          <p className="eyebrow"><span />Horyzon / Informazioni legali</p>
          <h1>Termini e condizioni</h1>
          <p className="page-intro">Condizioni di utilizzo del sito e delle offerte digitali e professionali disponibili tramite Horyzon.</p>
        </div>
      </section>

      <section className="content-section">
        <div className="legal-content">
          <p className="legal-notice"><strong>Ultimo aggiornamento: 1 ottobre 2026.</strong> Le condizioni specifiche mostrate nella pagina di una singola offerta o nel relativo checkout integrano queste condizioni e, in caso di contrasto, prevalgono per quella specifica offerta.</p>

          <h2>1. Titolare del sito e fornitore</h2>
          <p><strong>FELICITÀ srl</strong>, che opera con il marchio Horyzon Consulting, con sede in Viale Papiniano 28, 20123 Milano, P. IVA 05120660757, codice destinatario SDI SU9YNJA. Per comunicazioni relative al sito, agli ordini o a queste condizioni: <a href="mailto:info@horyzon.it">info@horyzon.it</a>.</p>

          <h2>2. Ambito di applicazione</h2>
          <p>Queste condizioni disciplinano l’accesso e l’utilizzo di horyzon.it, degli strumenti gratuiti presenti sul sito e, quando attivati, l’acquisto di prodotti digitali, report, contenuti generati, servizi e altre offerte Horyzon. Alcune offerte sono rivolte principalmente a imprenditori, professionisti e organizzazioni. Se chi acquista agisce come consumatore, restano in ogni caso applicabili i diritti inderogabili previsti dalla normativa a tutela dei consumatori.</p>

          <h2>3. Uso del sito</h2>
          <p>L’utente si impegna a utilizzare il sito in modo lecito, a non comprometterne sicurezza o funzionamento e a non tentare accessi non autorizzati. Le informazioni fornite nei form, nei questionari e nei percorsi guidati devono essere corrette per quanto ragionevolmente noto all’utente.</p>

          <h2>4. Strumenti gratuiti e risultati orientativi</h2>
          <p>Score, questionari, anteprime, autovalutazioni e altri strumenti gratuiti hanno finalità informativa e orientativa. Non costituiscono diagnosi aziendale completa, consulenza legale, fiscale, finanziaria, del lavoro o altra consulenza professionale regolamentata. I risultati dipendono anche dalla qualità e completezza delle informazioni fornite dall’utente.</p>

          <h2>5. Offerte a pagamento</h2>
          <p>Prima dell’acquisto vengono mostrate le caratteristiche essenziali dell’offerta, il prezzo applicabile, gli eventuali oneri aggiuntivi, le modalità di pagamento e le informazioni rilevanti sull’esecuzione. Il prezzo e il contenuto visualizzati al momento dell’ordine prevalgono su prezzi o descrizioni precedenti. Eventuali promozioni si applicano solo per il periodo e alle condizioni indicate.</p>

          <h2>6. Ordine, pagamento e conclusione del contratto</h2>
          <p>L’invio di un ordine richiede le informazioni indicate nel percorso di acquisto. Il contratto relativo a un prodotto o servizio a pagamento si considera concluso quando Horyzon conferma l’accettazione dell’ordine o avvia l’esecuzione dopo la conferma del pagamento, salvo diversa indicazione resa prima dell’acquisto. Il pagamento può essere gestito da prestatori terzi: in tal caso si applicano anche le loro condizioni tecniche e di sicurezza, fermo restando il rapporto contrattuale con Horyzon per l’offerta acquistata.</p>

          <h2>7. Erogazione dei prodotti digitali</h2>
          <p>Tempi, modalità di consegna, accesso o generazione sono indicati nella specifica offerta. Quando il prodotto dipende da informazioni che l’utente deve fornire, l’esecuzione può essere sospesa fino a quando tali informazioni siano sufficienti. In caso di impedimento tecnico significativo, Horyzon può ripetere la generazione, ripristinare l’accesso o adottare un rimedio equivalente coerente con il contratto e con la legge applicabile.</p>

          <h2>8. Annunci 10x</h2>
          <p>Lo Score di Annunci 10x è gratuito. L’offerta a pagamento attualmente pubblicata prevede <strong>7 € per un annuncio, una versione e un canale</strong>; in ogni caso fa fede il prezzo mostrato prima del pagamento. Il testo viene generato sulla base dei fatti confermati dall’utente e non deve essere interpretato come garanzia di candidature, assunzioni, performance o risultati economici.</p>
          <p>Per Annunci 10x Horyzon riconosce inoltre la garanzia commerciale pubblicata nella relativa pagina: se il risultato non è utile, l’acquirente può chiedere il <strong>rimborso integrale entro 14 giorni dalla consegna, senza motivazione</strong>, scrivendo a <a href="mailto:info@horyzon.it">info@horyzon.it</a> dall’indirizzo usato per l’acquisto. Questa garanzia si aggiunge e non sostituisce eventuali diritti inderogabili spettanti al consumatore.</p>

          <h2>9. Radar d’Impresa</h2>
          <p>Il Radar fornisce una prima fotografia guidata dell’impresa sulla base delle risposte fornite. Il profilo dettagliato è un prodotto a pagamento quando il relativo catalogo e checkout sono attivati. Prezzo, contenuto e condizioni dell’acquisto vengono mostrati prima del pagamento. Il Radar non costituisce una valutazione finanziaria, fiscale o legale e non promette autonomia, crescita o risultati entro una data determinata.</p>

          <h2>10. Contenuti generati con sistemi di intelligenza artificiale</h2>
          <p>Alcune funzionalità possono utilizzare sistemi di intelligenza artificiale per analizzare dati forniti dall’utente o produrre bozze e contenuti. Horyzon progetta i flussi affinché non vengano aggiunti fatti non confermati, ma gli output possono comunque richiedere correzioni o verifica umana. L’utente deve controllare il risultato prima di utilizzarlo, pubblicarlo o assumerlo come base di una decisione.</p>

          <h2>11. Responsabilità sui dati e sui contenuti forniti dall’utente</h2>
          <p>L’utente dichiara di avere il diritto di utilizzare e trasmettere a Horyzon i testi, dati e materiali inseriti nei servizi. Non devono essere forniti contenuti illeciti, discriminatori, diffamatori o che violino diritti di terzi. Nel caso di annunci di lavoro, l’utente resta responsabile della correttezza dei fatti relativi alla posizione e della verifica finale dell’annuncio prima della pubblicazione.</p>

          <h2>12. Proprietà intellettuale</h2>
          <p>Il sito, i software, i metodi, i rubric, i questionari, i prompt, i modelli, la grafica e i contenuti Horyzon restano di proprietà di Horyzon o dei rispettivi titolari. L’utente conserva i diritti sui materiali che fornisce. Salvo condizioni diverse della specifica offerta, dopo il pagamento Horyzon concede al cliente una licenza non esclusiva, senza limiti territoriali e per la durata dei diritti applicabili, per utilizzare, modificare, riprodurre e pubblicare il deliverable specificamente realizzato per le proprie finalità personali o aziendali. Restano esclusi dalla licenza i metodi, i software, i template e gli elementi riutilizzabili sottostanti.</p>

          <h2>13. Diritto di recesso dei consumatori</h2>
          <p>Quando l’acquirente è un consumatore e il contratto è concluso a distanza, si applica il diritto di recesso previsto dalla normativa vigente, di regola entro 14 giorni, salvo le eccezioni di legge. Se il consumatore chiede espressamente che un servizio inizi durante il periodo di recesso, si applicano le conseguenze previste dalla legge per la parte già eseguita. Per contenuti digitali non forniti su supporto materiale, l’eventuale perdita del diritto di recesso prima della scadenza del termine opera solo quando ricorrono le condizioni e i consensi espressi richiesti dalla normativa. Le garanzie commerciali più favorevoli pubblicate da Horyzon restano valide.</p>

          <h2>14. Utenti professionali</h2>
          <p>Quando l’acquisto è effettuato per finalità riferibili all’attività imprenditoriale o professionale, non si applicano le disposizioni riservate ai consumatori. Restano applicabili le condizioni specifiche dell’offerta, gli eventuali accordi sottoscritti e le norme inderogabili pertinenti.</p>

          <h2>15. Disponibilità, manutenzione e modifiche</h2>
          <p>Horyzon può aggiornare, correggere o sospendere temporaneamente parti del sito per manutenzione, sicurezza, evoluzione tecnica o obblighi normativi. Tali modifiche non pregiudicano i diritti già maturati su ordini conclusi. In caso di modifica sostanziale di un servizio continuativo a pagamento, il cliente sarà informato secondo quanto previsto dalla legge e dalle condizioni specifiche applicabili.</p>

          <h2>16. Servizi di terzi</h2>
          <p>Il sito può utilizzare o rimandare a servizi di terzi, ad esempio infrastruttura, pagamenti, comunicazioni o piattaforme esterne. Horyzon non controlla i servizi terzi al di fuori delle proprie responsabilità e l’utilizzo diretto di tali servizi può essere soggetto alle condizioni del relativo fornitore.</p>

          <h2>17. Responsabilità</h2>
          <p>Horyzon non garantisce risultati commerciali, finanziari, organizzativi, di recruiting o di posizionamento derivanti dall’uso degli strumenti o dei deliverable. Nulla in queste condizioni limita responsabilità che non possono essere escluse per legge, inclusi i diritti inderogabili dei consumatori e la responsabilità per dolo o colpa grave nei casi in cui l’esclusione non sia consentita.</p>

          <h2>18. Privacy e cookie</h2>
          <p>Il trattamento dei dati personali e l’utilizzo di cookie o tecnologie analoghe sono disciplinati dalle informative dedicate. Consulta la <Link href="/privacy-policy">Privacy Policy</Link> e la <Link href="/cookie-policy">Cookie Policy</Link>. Le preferenze cookie possono essere modificate in qualsiasi momento tramite il comando “Preferenze cookie” presente nel footer.</p>

          <h2>19. Modifiche alle condizioni</h2>
          <p>Horyzon può aggiornare queste condizioni per modifiche normative, tecniche o dei servizi. La versione applicabile a un singolo ordine è quella resa disponibile al momento della conclusione del contratto, salvo modifiche richieste dalla legge o espressamente accettate successivamente dalle parti.</p>

          <h2>20. Legge applicabile, reclami e controversie</h2>
          <p>Queste condizioni sono regolate dalla legge italiana. Il consumatore conserva la competenza territoriale e le altre tutele inderogabili previste dalla normativa applicabile. Per i rapporti con utenti che agiscono esclusivamente nell’esercizio della propria attività imprenditoriale o professionale, salvo diverso accordo scritto, è competente in via esclusiva il Foro di Milano.</p>
          <p>Per reclami o richieste è possibile scrivere a <a href="mailto:info@horyzon.it">info@horyzon.it</a>. Il consumatore può inoltre ricorrere agli strumenti di risoluzione alternativa delle controversie disponibili ai sensi della normativa applicabile, senza pregiudizio del diritto di rivolgersi all’autorità giudiziaria competente.</p>

          <h2>21. Disposizioni finali</h2>
          <p>L’eventuale invalidità o inefficacia di una singola clausola non determina l’invalidità delle restanti disposizioni. Il mancato esercizio di un diritto non costituisce rinuncia. Per una specifica offerta, le informazioni precontrattuali e le condizioni mostrate prima dell’ordine fanno parte del contratto e completano queste condizioni generali.</p>

          <div className="resource-links">
            <Link className="button ghost-dark" href="/privacy-policy">Privacy Policy ↗︎</Link>
            <Link className="button ghost-dark" href="/cookie-policy">Cookie Policy ↗︎</Link>
            <a className="button primary" href="mailto:info@horyzon.it">Contattaci ↗︎</a>
          </div>
        </div>
      </section>
    </main>
    <SiteFooter />
  </>;
}
