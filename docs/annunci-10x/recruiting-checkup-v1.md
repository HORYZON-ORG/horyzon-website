# HORYZON Recruiting — check-up gratuito

Implementazione da revisionare, non ancora pubblicata. Base: `main` 320729d43e509153a63c75730492ce843cc8c3b1, verificata il 19 novembre 2026. Progettazione canonica: https://chatgpt.com/space/page_6dfbf75898c481918aabb47f0fe000e2 (sequenza 4, 16 novembre). Il 22 novembre è stato recuperato lo storico pubblico della chat https://chatgpt.com/c/6afae5b1-6680-83eb-8d23-0eed02cad7ac dal primo prompt di lunedì 16 novembre alle 12:14 fino alle successive approvazioni. La sequenza definitiva consegna il regalo completo prima della telefonata facoltativa; il vecchio Annunci 10x fornisce il motore, non sostituisce il progetto.

## Percorso

`/annunci-10x#valuta` e `/recruiting/check-up-annuncio` usano lo stesso componente e motore. La conferma e il risultato sono incorporati nel percorso, senza creare una seconda richiesta su una pagina grazie separata.

1. Testo, URL pubblico o file PDF/DOCX/TXT. Il file viene letto senza conservarne il binario; l'utente può controllare il testo estratto. Limiti: 3 MB, 20 pagine PDF e 12.000 caratteri; scansioni e PDF protetti restituiscono un errore utile, senza simulare OCR.
2. Nome, cognome, azienda, email, telefono, ruolo ricercato e difficoltà della ricerca. Numero normalizzato, stato ENTERED (non verificato tramite SMS). Consenso marketing facoltativo e separato dal servizio. Verifica email con l'OTP esistente.
3. Analisi originale V2 e riscrittura con il writer e i controlli fattuali esistenti. Per il check-up, l'estrazione conserva le formulazioni effettivamente presenti nella fonte; le informazioni mancanti rimangono dati interni, esclusi dal testo per il candidato. Nessun compenso o condizione viene completato per ipotesi.
4. Rivalutazione della proposta con la stessa griglia V2 a 20 controlli. Il voto del check-up è la media dei criteri valutabili, senza tetti aggiuntivi: N/D è escluso dalla media e resta visibile nella copertura. Nessun incremento minimo imposto.
5. PDF con originale, proposta, confronto completo dei 20 criteri con entrambi i voti e motivazioni, differenze e informazioni mancanti. Download disponibile prima del calendario. Invio di servizio tramite Resend riutilizzando la gestione esistente delle consegne e la sua chiave idempotente.
6. Invito approvato ai 15 minuti, facoltativo, con link Calendly. Nessun checkout e nessuna promozione della guida nel regalo. Il percorso CREATE e la guida commerciale rimangono capacità separate nel codice.

## Salvataggio e ripresa

Nessuna migrazione richiesta: il contesto di contatto del check-up viene salvato nelle risposte private della sessione, associato alla richiesta; telefono e ruolo vengono inviati all'upsert HighLevel, insieme a una nota che distingue numero raccolto da numero verificato. Le UTM sono limitate ai cinque campi noti e conservate con la richiesta.

Il report e il PDF già generati vengono conservati nei metadati privati della richiesta. Nessun contenuto dell'annuncio o dato di contatto passa agli eventi analytics. Le API pubbliche di stato selezionano i soli campi necessari; PDF e risultato richiedono sessione proprietaria e email verificata.

Una ricevuta persistente, un limite atomico nel database e la gestione delle operazioni già presenti evitano generazioni e invii ripetuti durante richieste simultanee o ricaricamenti. La rigenerazione ha tre tentativi; gli invii mantengono il limite esistente. Il PDF codificato viene salvato prima dell'invio, così i tentativi Resend riusano lo stesso allegato. Un tentativo incerto non viene ripetuto automaticamente oltre la durata della chiave idempotente del provider.

La coda in `/api/cron/recruiting-checkups` riprende gli stadi persistiti ogni cinque minuti, anche senza browser. Il token di ripresa è cifrato AES-GCM con chiave derivata e separata dal pepper già usato per l'email; è legato alla richiesta e non appare nelle risposte pubbliche. Il cron usa l'autenticazione esistente. La rotazione del pepper invalida anche i token di ripresa: gestirla insieme alle richieste pendenti. La scadenza della sessione rimane 14 giorni.

## Calendly e stati

Il link contiene soltanto un identificativo opaco della richiesta nelle UTM, senza nome, email o telefono. `booking_click` è distinto da `booking_confirmed`. Il webhook preparato in `/api/annunci-10x/calendly/webhook` richiede firma HMAC valida e timestamp entro tre minuti. Riconcilia solo richiesta + email verificata corrispondente; callback senza riferimento rimangono non riconciliate. Duplicati e cancellazioni sono distinti.

Il 23 novembre è stata configurata e collaudata una sottoscrizione Calendly verso l'ambiente di prova, con credenziale di firma dedicata. Prenotazione e cancellazione reali sono state riconciliate con la richiesta; l'appuntamento tecnico è stato annullato e l'orario è tornato disponibile. Il collegamento di produzione resta da configurare al rilascio approvato.

Il risultato distingue PDF pronto, invio accettato, errore email ed errore di preparazione. EMAIL_ACCEPTED non significa consegnato. Senza conferma del provider il sito non dichiara la consegna effettiva. Il webhook di recapito Resend e la vista operativa CRM per gli stati successivi non sono inclusi in questa modifica.

## Verifiche

- `npm run test:recruiting-checkup`: logica con database in memoria, provider AI/email simulati; telefono, file, OTP, griglie, PDF, ripresa, concorrenza, retry email, proprietà della sessione, coda cifrata e callback Calendly firmate.
- `node scripts/verify-recruiting-checkup-browser.mjs`: interfaccia locale reale su 1440 e 390 pixel; risposte API simulate. Il modulo Playwright e il browser possono essere indicati con CHECKUP_PLAYWRIGHT_MODULE e CHECKUP_BROWSER_EXECUTABLE. Avviare prima il sito sulla porta 3100.
- TypeScript, controlli pertinenti del motore esistente e ispezione visiva del PDF. La compilazione ordinaria dell’intero sito incontra un problema preesistente nel caricamento dei font Google della pagina Collaboratori Vincenti; la verifica completa viene eseguita anche con font locali sostitutivi soltanto nell’ambiente di collaudo, senza modificare i font del prodotto. Il facsimile usa annuncio fittizio e valutazioni simulate, dichiarati nel documento.
- La vecchia verifica statica `verify-annunci-10x-funnel-v2.mjs` punta a percorsi precedenti ai route groups e al copy della landing superata: non è una prova del nuovo percorso.

Le prove simulate non certificano la qualità di un'analisi OpenAI reale, il recapito in una casella normale, la sincronizzazione del contatto su HighLevel o una prenotazione Calendly effettiva.

## Video e autorevolezza — anteprima del 22 novembre

Angelo ha scelto il video 51 di Frank e autorizzato l'adattamento del finale, l'inserimento nel funnel e l'anteprima prima della pubblicazione. Il video compare dopo la spiegazione del regalo e prima della presentazione di Angelo. Mantiene i primi 7,55 secondi con la voce originale; il precedente invito a ricevere lo score e poi eventualmente riscrivere viene eliminato. Una chiusura grafica presenta il PDF completo e il successivo confronto facoltativo. Nessuna voce sintetica o attribuzione a Frank di nuove frasi pronunciate.

Il player usa file locale ottimizzato, poster, controlli nativi, riproduzione su richiesta, sottotitoli italiani e trascrizione. Nessun iframe o caricamento del video completo prima dell'avvio. Il video non è un passaggio obbligatorio per usare il form.

La frase sul rapporto con Performia riprende la progettazione approvata: HORYZON Recruiting integra metodo e strumenti specialistici Performia nel proprio lavoro con le imprese. Il documento commerciale viene allineato a questo nuovo percorso; non vengono introdotti risultati, primati, qualifiche o certificazioni del punteggio automatico.

Preparati anche adattamenti locali per Meta: stesso contenuto e offerta, finale «Scopri di più» invece di «Carica l'annuncio qui sotto», formati verticali 9:16 e 4:5. Nessun caricamento o avvio di campagne. Sorgenti e dettagli di montaggio: `docs/recruiting/checkup-video-51.md`.

## Collaudi del 22 novembre — esiti parziali, nessun via libera al rilascio

Il proprietario ha approvato l'anteprima e richiesto i collaudi prima di pubblicare. È stata eseguita una prova reale del servizio Annunci 10x attualmente online, che usa ancora `main` 320729d: sessione HTTP 200; contatto di collaudo HTTP 200 con `crmStatus=SYNCED`; richiesta codice email HTTP 200. Il messaggio è stato trovato nella casella del proprietario con DKIM, SPF e DMARC validi. Il contatto, i due tag e la nota di servizio sono stati riletti dal CRM. Nessun consenso marketing espresso. Questo verifica la configurazione in uso dal servizio online; non dimostra la consegna del nuovo PDF completo dal codice locale non pubblicato.

Calendly: evento attivo, gratuito, italiano, telefonata in uscita da 15 minuti; disponibilità lette per il 25 novembre. Prenotazione, cancellazione e notifica firmata al nuovo endpoint restano da collaudare. Lo strumento Calendly disponibile non espone la gestione dei webhook. Una richiesta di nuovi collegamenti tecnici è stata respinta dal controllo automatico perché richiede consenso esplicito; è stata chiesta autorizzazione al proprietario. Nessun nuovo collegamento è stato creato.

Cookie: Iubenda annotava anche i contenitori script generati da Next prima dell'hydration. Il bootstrap statico ora mantiene un sottoalbero posseduto dal provider; il blocco automatico rimane sincrono prima delle risorse della pagina. Le annotazioni del provider sui soli media pubblici del funnel e sul JSON-LD non vengono riconciliate come attributi applicativi. Dopo una ricarica reale non compaiono errori o warning in console; pannello privacy, rifiuto dei cookie facoltativi e salvataggio delle preferenze funzionano. Dopo il rifiuto, il video si riproduce e il modulo accetta l'esempio. Nessuna disattivazione del blocco automatico o esenzione generale dei tracciamenti.

TypeScript, lint dei file modificati e controllo degli spazi del diff superati. Restano necessari il collaudo del nuovo percorso con PDF ricevuto e prenotazione riconciliata in un ambiente collegato ai servizi effettivi. Nessuna pubblicazione eseguita e nessuna dichiarazione di completamento end-to-end.

## Collaudi reali del 23 novembre — PDF, CRM e Calendly superati in prova

Ambiente separato Vercel con target `staging`, collegato ai servizi effettivi su esplicita autorizzazione del proprietario. Sono state riutilizzate le configurazioni autorizzate di OpenAI, Resend, HighLevel e database senza esporne i valori; il segreto per la verifica email e la chiave di firma webhook sono dedicati alla prova. Checkout disabilitato. Questa verifica usa un annuncio fittizio e il contatto di collaudo del proprietario, non dati di candidati o prospect.

- PDF: caricamento TXT reale, analisi e riscrittura OpenAI reali, email verificata con codice ricevuto, PDF completo ricevuto nella casella Gmail autorizzata. Allegato di 9 pagine, 24.225 byte, con originale fedele, proposta e gli stessi 20 criteri prima/dopo; tutte le pagine renderizzate e controllate visivamente. DKIM, SPF e DMARC validi. Il PDF è arrivato prima della prenotazione e non richiede il calendario.
- CRM: contatto riletto da HighLevel con telefono normalizzato, ruolo, difficoltà, attribuzione e nota che conferma l'email verificata. Nessun consenso marketing aggiunto. Il telefono è raccolto, non verificato tramite SMS.
- Calendly: prenotazione reale di 15 minuti creata e confermata; callback autentica firmata riconciliata con il check-up. Successiva cancellazione reale confermata sia da Calendly sia dal funnel; zero invitati attivi e fascia nuovamente disponibile. Notifiche di conferma e cancellazione ricevute nella casella di prova. Le richieste prive di firma sono rifiutate con HTTP 401.
- Duplicati: report, download e ripresa ripetuti riusano il medesimo output e PDF, con hash invariato. Una sola consegna email effettiva, una sola conferma e una sola cancellazione registrate per la richiesta finale. Il tentativo di rendering fallito prima della correzione non ha prodotto un secondo invio.

Correzioni emerse sul runtime effettivo: durata massima della route portata a 300 secondi; conservazione dell'evidenza testuale originale quando l'estrazione AI parafrasa un'attività; inclusione dei moduli font standard di PDFKit nel pacchetto server. Superati regressioni pertinenti, TypeScript, lint e compilazione dell'ambiente di prova. I test browser locali e delle altre varianti di file rimangono prove con risposte simulate; non vengono confusi con il percorso reale appena eseguito.

La prova finale usa l'URL immutabile `https://horyzon-website-oh1wous0z-horyzon-consulting.vercel.app`. Il callback Calendly di prova è sul precedente deployment immutabile `https://horyzon-website-hdeypg9jm-horyzon-consulting.vercel.app`, con la medesima configurazione di prova e lo stesso codice di riconciliazione. Non usare l'alias generico del progetto per questi collaudi: può essere riassegnato da rilasci indipendenti. Evidenze locali e riferimenti tecnici sono conservati in `.work/recruiting-live-2026-11-22/` nella cartella del progetto, fuori dal repository.

## Rilascio autorizzato il 23 novembre

Angelo ha autorizzato l'allineamento del testo Calendly, il collegamento di produzione, la pubblicazione sul sito aggiornato e la verifica online. Ha richiesto inoltre intestazione HORYZON e iconografia nel check-up. Il PDF ora usa il logo canonico su ogni pagina, icone vettoriali di sezione, schede dei punteggi con indicatori proporzionali e una griglia più leggibile. Anche il facsimile pubblico usa la stessa veste grafica. Le ricevute già consegnate restano immutate, senza generazioni o invii automatici duplicati.

Il testo Calendly è stato aggiornato e riletto: il check-up è già completo e la telefonata rimane facoltativa. Una chiave di firma distinta è configurata per la produzione. Le modifiche recruiting sono integrate con `main` aggiornato a `0638af9`, conservando Startup, video e interventi sull'evento già pubblicati. Gli esiti effettivi del rilascio e delle prove online sono registrati nella cartella di lavoro privata `recruiting-release-2026-11-23`.

## Controlli del rilascio

- L'anteprima del video 51 e il rilascio sono approvati; i collaudi reali in prova sono superati.
- Descrizione pubblica Calendly allineata alla sequenza PDF già ricevuto → telefonata facoltativa.
- Sul rilascio approvato, configurare la sottoscrizione e la credenziale Calendly di produzione, quindi verificare il collegamento sull'URL definitivo. La sottoscrizione di prova non è un'attivazione del collegamento in produzione.
- Integrare le modifiche sullo stato aggiornato del sito: altri lavori hanno avanzato `main` durante i collaudi; non promuovere direttamente il vecchio snapshot di staging.
- Nessuna promessa di due minuti o prestazioni generalizzate da un singolo caso: tempi e costi richiedono una misurazione rappresentativa.
- Nessun acquisto di dominio o modifica DNS necessario; l'autorizzazione al rilascio proviene dalla richiesta esplicita di Angelo, non da questo file.

Fonti tecniche di integrazione: https://developer.calendly.com/api-docs/overview/webhooks/webhook-signatures e https://calendly.com/help/how-to-source-track-your-calendly-embed-with-utm-parameters.

## Voto e interventi prioritari — 26 novembre 2026

Su richiesta di Angelo, i nuovi report del check-up usano `mean-evaluable-checks-v1`: la media dei singoli criteri valutabili, senza il tetto a 6,9. Il calcolo è applicato allo stesso modo a originale, riscrittura, PDF, pagina di risultato ed email. I punteggi e le griglie delle valutazioni già persistite dal motore Annunci 10x restano immutati; i PDF già consegnati non vengono rigenerati o reinviati automaticamente.

Prima delle griglie, il PDF presenta «Come fare un salto concreto»: fino a tre priorità ordinate per il punteggio della proposta e limitate agli aspetti che richiedono informazioni fattuali. Per ciascuna mostra il dato da aggiungere, il motivo, le domande da porre all’azienda e una traccia da completare con informazioni confermate. Compenso, orario e altri aspetti già completi non diventano false lacune. Le tracce restano distinte dal testo per il candidato; nessun importo, benefit o requisito viene inventato. Un annuncio senza lacune fattuali non riceve priorità artificiali né un incremento minimo garantito.

Verifica mirata: `npm run test:recruiting-checkup`. I test coprono il precedente blocco a 6,9, l’esclusione di N/D dalla media, la conservazione delle vecchie valutazioni, priorità pertinenti e deduplicazione di generazione e invio. I provider delle regressioni sono simulati; i collaudi effettivi con OpenAI, Resend e Gmail sono documentati separatamente nella cartella di lavoro privata.

Il testo consigliato viene scelto dopo la seconda valutazione. Se la riscrittura ottiene un voto inferiore, il report conserva l’originale come raccomandazione, con la sua effettiva griglia; indica esplicitamente anche il punteggio della riscrittura scartata. PDF, pagina ed email spiegano la scelta. Nessun voto della riscrittura viene rialzato per farlo apparire migliore e le priorità si riferiscono al testo realmente consigliato.

## PDF compatto — 26 novembre 2026

Su richiesta di Angelo, la prima pagina raccoglie voti, copertura, aree e interventi prioritari. Le due griglie sono riunite in un confronto unico dei 20 criteri: entrambi i voti restano visibili, le motivazioni diverse sono affiancate e quelle identiche vengono riportate una sola volta. Restano anche le indicazioni da approfondire. Il confronto usa l’identificativo del criterio, senza dipendere dall’ordine delle due liste.

Originale, testo consigliato, domande all’azienda e tracce da completare rimangono completi. Quando viene consigliato l’originale esatto, il testo non viene ripetuto una seconda volta. L’invito facoltativo ai 15 minuti chiude la griglia, senza una pagina dedicata. Il caso reale salvato e il facsimile passano da 12 a 8 pagine; la variante che mantiene l’originale occupa 7 pagine. Annunci o motivazioni più lunghi possono richiedere pagine aggiuntive: il contenuto non viene troncato.

La verifica del nuovo layout riusa gli stessi dati salvati, senza una nuova valutazione OpenAI o un invio email. Controllati contenuti completi, voti invariati, link Calendly e rendering di tutte le pagine. Le ricevute già consegnate restano immutate.

## Menzione Performia nel PDF — 26 novembre 2026

Su richiesta di Angelo, la prima pagina include una breve menzione con il logo Performia originale già utilizzato nei materiali HORYZON, mantenendo HORYZON come marchio principale. Testo: «HORYZON, esclusivista Performia in Italia. Metodo e strumenti per la selezione e lo sviluppo delle persone. Performia opera dal 2001 in oltre 26 Paesi.» La dichiarazione di esclusiva proviene direttamente dal proprietario in questa chat; il sito ufficiale indica HORYZON come riferimento per l’Italia, senza dettagliare pubblicamente l’esclusiva.

I dati internazionali sono stati verificati il 26 novembre su https://performia.com/en-it/about-us e https://performia.com/en-it/contact-us: fondazione nel 2001 e attività in oltre 26 Paesi. Si usa quindi «dal 2001», anziché i 30 anni inizialmente indicati. La menzione descrive il rapporto professionale e non attribuisce a Performia la certificazione del voto automatico del check-up.

Il logo locale è incluso nei pacchetti delle API e della coda di preparazione PDF. Il facsimile usa la medesima menzione; le ricevute già consegnate restano immutate.

## Correzione del metodo e della fedeltà — 26 novembre 2026

La riscrittura del check-up usa l'annuncio originale completo come autorità, con inventario delle informazioni e strategia esplicita su quattro aree: qualificazione del ruolo, routine/cambiamento, desiderabilità effettiva e tecnicità. Riferimenti: materiale Performia `THEORY_WRITING_ADS` e chat «PRODUTTIVITÀ E ANNUNCI SELEZIONE AD». I 20 controlli e il voto rimangono una griglia HORYZON, senza attribuire a Performia una certificazione della scala numerica.

La proposta conserva contesto aziendale, mansioni, requisiti obbligatori e preferenziali, importi e condizioni, benefit, strumenti, territorio, contratto e candidatura. Un controllo indipendente confronta il testo completo con la proposta; un secondo tentativo ripara omissioni o aggiunte. Se la fedeltà non è confermata, viene mantenuto l'originale senza presentarlo come riscrittura riuscita. Il PDF completo viene comunque preparato e consegnato prima dell'invito facoltativo.

La scheda intermedia conserva compensi pubblici, prove testuali e intestazioni preferenziali. I controlli sul canale e sui campi del portale restano N/D quando tali elementi non sono disponibili. Un recapito segnaposto resta un difetto concreto e una priorità, senza un indirizzo inventato. Nessun incremento di voto viene preassegnato.

Verifiche locali: `npm run test:recruiting-checkup` include regressioni simulate sulla fedeltà, riparazione, fallback, N/D, candidatura e deduplicazione. Il confronto reale usa nuovamente i dieci testi congelati in `.work/benchmark-annunci-reali-2026-11-26/fonti/*-valutato.txt`, esclusivamente nell'anteprima della PR 112. Esiti e decisione di pubblicazione restano separati: nessuna attivazione Meta.

Nel check-up le motivazioni riportano ora il giudizio specifico salvato per ciascun annuncio, dopo la pulizia del testo destinato al cliente. Gli esempi standard delle ancore (per esempio «clienti e CRM») non sostituiscono più la motivazione di un ruolo diverso. La presentazione degli altri percorsi resta separata. I dieci PDF sono stati anche reimpaginati dalle valutazioni reali già salvate: voti, selezioni e testi invariati, nessuna nuova chiamata AI o email. Questo replay di presentazione è distinto dalle dieci prove reali e dalle ricevute originali conservate.


### Revisione del motore dalla teoria originale Performia — 26 novembre 2026

Verificato `001_THEORY_WRITING_ADS.pdf`, 6 pagine, SHA-256 `dfc896a2b8afd573b975c5dd5dd84f67323f696331ad6648dd312f22170456a9`. La teoria distingue routine/cambiamento e difficoltà/popolarità del lavoro; considera formazione e supporto ricompense legittime. Non prescrive una scala ufficiale da venti controlli: la rubrica e la media numerica restano HORYZON.

Il motore v5 produce una nuova apertura sostenuta da riferimenti puntuali, sottoposta a verifica indipendente, e ordina i blocchi originali. Il nucleo conserva letteralmente ogni unità, con intestazioni, qualificatori, tecnicismi, compensi, condizioni, candidatura e privacy. Una nuova apertura respinta non elimina la composizione sicura. La copertura è verificata dal programma, senza affidarsi alle sole dichiarazioni del modello.

Il confronto usa un’unica valutazione dei due testi con ordine A/B variabile e stessi venti controlli. Non è un esperimento cieco su candidati umani e non prova più candidature. Il punteggio originale del confronto viene salvato separatamente dall’analisi iniziale e collegato al report; la ripresa dopo un’interruzione conserva lo stesso abbinamento. Nessun incremento minimo preassegnato. Pubblicazione e campagna Meta restano sospese fino alla revisione degli esiti reali.


### Esito del nuovo confronto reale — 26–27 novembre 2026

Anteprima della PR 112, versione del motore `checkup-performia-source-composition-v5.2`. Stessi dieci input congelati: quattro voti maggiori, sei uguali, nessuno minore; incremento medio +0,072/10. Conservate 244/244 unità della fonte. Nove aperture nuove e una composizione senza apertura ammessa (Carsaniga). Il risultato corregge la fedeltà, ma non dimostra ancora un salto forte di valore editoriale.

Dieci PDF reali ricevuti e controllati; per ogni richiesta finale un Master, un PDF e un solo invio. Quattro prove preliminari escluse, più una prima analisi Humanitas fallita senza PDF. La successiva è stata completata al terzo tentativo dopo la correzione del recupero delle sole operazioni fallite, mantenendo il riuso delle operazioni riuscite. La modifica di recupero non cambia testi o rubrica dei nove confronti già completati.

Esiti completi: `.work/benchmark-performia-teoria-2026-11-26/esito-finale.json` nella cartella del progetto; report e pacchetto in `output/`. Codice finale di anteprima `7d07ebc27146e8a5062c2efbef712867d63d9c90`. PR ancora in bozza: nessuna pubblicazione né attivazione Meta. Questo confronto non ripete prenotazione e cancellazione Calendly.


### Riscrittura integrale secondo Performia — 27 novembre 2026

Il writer v6 sostituisce il precedente limite di apertura più riordino con la riscrittura di attività, contributo, contesto, requisiti e proposta al candidato. Le clausole economiche, i benefici condizionati e le informative sono protetti; nomi, tecnicismi, numeri, vincoli e classificazioni rimangono obbligatori. Il motore può esplicitare l’esito funzionale già implicato dalle attività, senza inventare mansioni, KPI o promesse.

La verifica indipendente controlla ogni unità sorgente, con evidenze rintracciabili nel nuovo testo e ricerca di fatti aggiunti. Il controllo di trasformazione rifiuta una semplice apertura seguita dalla copia della maggioranza dei blocchi riscrivibili. Una correzione può riparare gli errori; se la fedeltà non viene confermata, il servizio mantiene l’originale e lo dichiara. La rubrica e il confronto A/B restano gli stessi: nessun aumento minimo.

Il nuovo confronto usa ancora i dieci input congelati e i servizi reali nell’anteprima protetta. Protocollo e risultati in `.work/benchmark-riscrittura-incisiva-2026-11-27` nella cartella del progetto. Non pubblicare né attivare la campagna prima della revisione degli esiti.
