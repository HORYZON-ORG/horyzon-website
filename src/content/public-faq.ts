export type PublicFaq = { question: string; answer: string };

// These answers are public statements of the current offer. They deliberately
// distinguish an assessment, configured work, and outcomes that cannot be promised.
export const publicFaqs: Record<string, readonly PublicFaq[]> = {
 '/': [
  { question: 'Come capire se Horyzon è adatta alla mia azienda?', answer: 'Se il lavoro rallenta tra decisioni accentrate, ruoli poco chiari o strumenti scollegati, un primo confronto aiuta a capire se il percorso Horyzon risponde alla tua priorità.' },
  { question: 'Come può una PMI migliorare la propria organizzazione?', answer: 'Horyzon parte dalla situazione concreta: legge ruoli, processi, dipendenze e priorità, poi definisce un percorso con responsabilità, strumenti e verifiche.' },
  { question: 'Come si individua il reparto prioritario in azienda?', answer: 'Il Radar d’Impresa osserva Amministrazione, Produzione, Commerciale, Marketing e Persone insieme a maturità dei processi, autonomia dal titolare e adozione dell’AI. Il risultato prepara un confronto, non decide automaticamente.' },
  { question: 'Come ridurre la dipendenza dell’azienda dal titolare?', answer: 'Il percorso rende progressivamente condivisi ruoli, responsabilità, procedure e indicatori. Non esistono tempi o risultati garantiti: ogni attivazione richiede evidenze e verifiche.' },
  { question: 'L’intelligenza artificiale sostituisce le decisioni aziendali?', answer: 'No. L’AI sostiene il lavoro delle persone negli ambienti approvati; responsabilità, verifica e decisione restano umane.' },
 ],
 '/horyzon': [
  { question: 'La mia azienda cresce, ma l’organizzazione fatica a seguirla: da dove parto?', answer: 'Si parte da ciò che si ripete: ritardi, errori, decisioni ferme e responsabilità incerte. Horyzon aiuta a mettere in relazione questi segnali e scegliere una priorità su cui lavorare.' },
  { question: 'Che cosa fa Horyzon Consulting?', answer: 'Horyzon collega organizzazione, abilitazione digitale e continuità finanziaria per aiutare l’impresa a trasformare una priorità reale in lavoro verificabile.' },
  { question: 'Da dove comincia un percorso con Horyzon?', answer: 'Può iniziare dal Radar d’Impresa, da un debrief di un risultato già ottenuto oppure da un confronto sul collo di bottiglia che oggi limita il lavoro.' },
  { question: 'Horyzon lavora solo sulla tecnologia?', answer: 'No. Tecnologia e AI sono abilitori: il nucleo del percorso resta l’organizzazione, con ruoli, processi, responsabilità e decisioni condivise.' },
  { question: 'Horyzon garantisce risultati o autonomia entro una data?', answer: 'No. Obiettivi, accessi, responsabilità e prove dipendono dal contesto dell’azienda e vengono verificati durante il percorso.' },
 ],
 '/metodo': [
  { question: 'Posso iniziare senza cambiare tutta l’organizzazione?', answer: 'Il percorso individua una priorità e definisce i primi passi nel contesto reale dell’impresa. Il coinvolgimento delle altre aree viene valutato in base alle dipendenze che emergono.' },
  { question: 'Come lavora Horyzon con le aziende?', answer: 'Il metodo collega nove passaggi: destinazione, lettura del presente, organizzazione obiettivo, persone, divario, priorità, programma operativo, attivazione e verifica.' },
  { question: 'Come viene scelta la priorità di un percorso aziendale?', answer: 'La priorità nasce dalle evidenze raccolte sul sistema azienda e dal vincolo che oggi limita maggiormente il lavoro; non viene scelta da un questionario in automatico.' },
  { question: 'Che cosa succede dopo il Radar d’Impresa?', answer: 'Il debrief interpreta il profilo e avvia, quando serve, l’approfondimento di evidenze, responsabilità e reparto prioritario.' },
  { question: 'Quando vengono attivate integrazioni e strumenti?', answer: 'Solo dopo approvazione, configurazione, verifica degli accessi e prove nel contesto della singola azienda.' },
 ],
 '/radar-impresa': [
  { question: 'Il Radar è utile se so già qual è il problema?', answer: 'Può aiutare a leggere il problema insieme agli altri reparti e preparare il confronto con Horyzon. Un sintomo noto può avere cause che coinvolgono ruoli, processi o decisioni in più aree.' },
  { question: 'Che cos’è il Radar d’Impresa?', answer: 'È una prima autovalutazione guidata di Amministrazione, Produzione, Commerciale, Marketing e Persone. Rende leggibili maturità dei processi, autonomia dal titolare e adozione dell’AI.' },
  { question: 'Il risultato del Radar è già un piano operativo?', answer: 'No. Il risultato orienta un confronto: il debrief interpreta il profilo, mentre evidenze, responsabilità e priorità vengono approfondite nel percorso Horyzon.' },
  { question: 'Qual è la differenza tra Horyzon Hub e Platform?', answer: 'Hub raccoglie evidenze della discovery e produce un Blueprint versionato da riesaminare. Platform rende leggibili KPI, snapshot, report e stato delle attivazioni.' },
  { question: 'Le integrazioni sono già attive per ogni azienda?', answer: 'No. Accessi, autorizzazioni, configurazione e prove devono essere verificati per la singola azienda prima dell’attivazione.' },
 ],
 '/ai-score': [
  { question: 'Il mio sito è online: perché potrebbe essere difficile da capire per un’AI?', answer: 'Un sito può mostrare bene immagini e animazioni ma offrire poco testo leggibile, informazioni poco chiare sull’azienda o contenuti difficili da raggiungere. AI Score aiuta a individuare i segnali da approfondire.' },
  { question: 'Che cos’è Horyzon AI Score?', answer: 'È una lettura del sito basata su segnali misurabili di accessibilità, comprensibilità e citabilità per sistemi AI, con metodologia Horyzon pubblicata e versionata.' },
  { question: 'Un AI Score alto garantisce citazioni nelle risposte AI?', answer: 'No. Lo score distingue predisposizione tecnica e visibilità reale: una buona base non garantisce che un sistema AI citi il sito in ogni risposta.' },
  { question: 'Quali aspetti considera AI Score?', answer: 'Considera, tra gli altri, accessibilità HTTP, contenuto leggibile, entità e dati strutturati, fonti ed evidenze, qualità tecnica e policy per i crawler AI.' },
  { question: 'Dove posso leggere la metodologia di AI Score?', answer: 'La pagina della metodologia spiega versioni, categorie, segnali e limiti della valutazione.' },
 ],
 '/le-tre-aree': [
  { question: 'Perché risolvere un problema in un reparto non basta sempre?', answer: 'Perché il lavoro passa da un reparto all’altro. Una vendita, per esempio, coinvolge la capacità di produrre, le informazioni amministrative e le responsabilità delle persone. Horyzon osserva queste relazioni prima di definire l’intervento.' },
  { question: 'Quali reparti considera Horyzon per leggere un’impresa?', answer: 'Amministrazione, Produzione, Commerciale, Marketing e Persone: ogni reparto ha una funzione distinta e influenza gli altri.' },
  { question: 'Perché analizzare l’azienda come un sistema?', answer: 'Perché un sintomo in un reparto può dipendere da ruoli, processi, dati o decisioni che coinvolgono l’intera organizzazione.' },
  { question: 'Quali sono le aree di intervento di Horyzon?', answer: 'Il nucleo organizzativo è sostenuto da abilitazione digitale e continuità finanziaria, per rendere il lavoro più chiaro, usabile e verificabile.' },
  { question: 'Come capire da quale area iniziare?', answer: 'Il Radar e la discovery aiutano a leggere il presente; la priorità viene definita sulle evidenze raccolte, non su una categoria scelta a priori.' },
 ],
 '/piattaforma': [
  { question: 'Come posso condividere con il team lo stato delle priorità?', answer: 'Nel percorso Horyzon si definiscono responsabilità e informazioni utili ai diversi ruoli. La Platform offre una vista dedicata all’azienda con indicatori e avanzamento dei flussi configurati.' },
  { question: 'Che cos’è Horyzon Platform?', answer: 'È lo spazio dedicato alla tua azienda per leggere indicatori, report, priorità e avanzamento dei flussi configurati.' },
  { question: 'La Platform esegue automaticamente il lavoro nei sistemi del cliente?', answer: 'No. I sistemi approvati svolgono il lavoro operativo; la Platform rende leggibili indicatori, evidenze e stato dei flussi attivati.' },
  { question: 'Le integrazioni della Platform sono già disponibili per tutte le aziende?', answer: 'No. Ogni sincronizzazione richiede autorizzazioni, configurazione, accessi e prove verificati per la singola azienda.' },
  { question: 'Come vengono gestiti dati e accessi nella Platform?', answer: 'La vista è tenant-isolata e ruoli, informazioni disponibili e attivazioni dipendono dalla configurazione approvata nel percorso aziendale.' },
 ],
 '/contatti': [
  { question: 'Posso chiedere aiuto anche se non so ancora quale soluzione mi serve?', answer: 'Sì. Descrivi una situazione concreta che vorresti migliorare. Il primo confronto serve a comprenderla e valutare insieme un possibile passo successivo.' },
  { question: 'Come posso contattare Horyzon Consulting?', answer: 'Puoi iniziare dal Radar, richiedere un debrief oppure scrivere a info@horyzon.it descrivendo il reparto o il collo di bottiglia prioritario.' },
  { question: 'Che cosa conviene indicare nel primo contatto?', answer: 'È utile descrivere il contesto dell’impresa, la priorità percepita e ciò che oggi limita il lavoro: aiuta a scegliere il punto d’ingresso più utile.' },
  { question: 'Il modulo di contatto salva i miei dati sul sito?', answer: 'No. Il modulo prepara un messaggio nel client email dell’utente: il sito non invia né conserva i dati inseriti nel modulo.' },
  { question: 'Devo completare il Radar prima di chiedere un confronto?', answer: 'No. Il Radar è un possibile punto di partenza; puoi anche chiedere un confronto diretto sulla priorità aziendale.' },
 ],
};
