# AI Score: report dettagliato e archivio locale

Il risultato gratuito ora include i controlli, le evidenze, il riepilogo delle pagine e le priorità già calcolate dalla stessa scansione. Il pulsante “Vedi analisi dettagliata” apre un report consultabile, con ricerca e filtri per stato. L’apertura, la riapertura e l’esportazione non attivano provider o scansioni.

## Salvataggio scelto dall’utente

- Archivio versionato nel browser, fino a 20 report recenti e 3,5 MB complessivi. Quando si raggiungono i limiti vengono mantenuti i report più recenti.
- URL con identificativo del report per riaprirlo nello stesso browser; non è un link cloud condivisibile.
- Esportazione JSON e importazione per trasferire il report fra browser o dispositivi. L’importazione verifica formato, versione, dimensione e struttura prima del rendering.
- Errori di spazio, accesso allo storage o archivio corrotto sono visibili. Il risultato corrente resta disponibile ed esportabile; un errore non viene presentato come salvataggio riuscito.
- Cancellare i dati del browser cancella l’archivio locale. Nessuna migration, variabile d’ambiente o nuova persistenza server viene introdotta.
- I riepiloghi precedenti privi di dettagli vengono segnalati come tali. Non si ricostruiscono evidenze mancanti e non si rilancia automaticamente la scansione.

## Lettura dei risultati

- Le categorie mostrano il contributo in punti rispetto al proprio peso, non un falso punteggio su 100.
- Le priorità esistenti sono ordinate per severità e perdita di punti del controllo; non modificano formula, pesi o punteggi. Tutti i controlli restano consultabili anche oltre le 18 priorità iniziali selezionate dal motore.
- Evidenze dirette, derivate, indicative e provider sono etichettate. Le fonti ammettono solo HTTP/HTTPS senza credenziali; testo ed estratti sono renderizzati come testo.
- Controlli non misurati e non applicabili sono distinti dai problemi rilevati.
- Il report dichiara campione HTML senza rendering JavaScript, osservazioni valide/copertura AI, servizi non osservati, presenza esterna e punteggio futuro non verificati. Una ricerca fallita non viene interpretata come assenza del brand.

## Verifica

`npm run test:ai-score` include ora il test del report: payload fresco e da cache, conservazione delle evidenze, riapertura, deduplicazione, esportazione/importazione, limiti, priorità, fonti non sicure, file corrotti e quota esaurita. Usa esclusivamente fetch/provider simulati, senza costi o modifiche a dati esterni.

Verifica browser sulla build di produzione: desktop 1440×1000 e mobile 390×844; apertura/chiusura, filtri, ricerca, evidenze da tastiera, salvataggio automatico su risposta simulata, reload, esportazione e importazione. Le dimensioni simulano viewport responsive, non dispositivi fisici.

La precedente singola scansione reale non è stata ripetuta. I fixture usati per verificare la nuova interfaccia non costituiscono una nuova analisi del sito Horyzon.
