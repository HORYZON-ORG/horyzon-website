# Radar Patrimoniale V1 — Client Result e Advisor Intelligence

Versione **RP-VIEWS-1.1-draft**, Fase 3C, 18 ottobre 2026. Baseline `e11a31b9903fdb8efff31f6d9153bafe6dd854f9`, branch `feat/radar-patrimoniale-v1`. **Contratto concettuale da approvare; nessuna vista, API, tabella o integrazione implementata.**

Riferimenti coordinati: [metodologia e fonti](radar-patrimoniale-v1-metodologia.md), [domande](radar-patrimoniale-v1-questionario.md), [indicatori/regole](radar-patrimoniale-v1-scoring.md), [simulazioni](radar-patrimoniale-v1-profili-test.md), [decisioni 3B](radar-patrimoniale-v1-decisioni-fase-3b.md).

Estensione 3C: [obiettivi, vincoli e colloquio](radar-patrimoniale-v1-profilazione-obiettivi.md). Catalogo corrente40 ID (29 ordinari invariati +11 facoltativi), X06 v2 e X09–X11. Il risultato cliente resta sintetico; dati nuovi nel dossier non autorizzano nuove diffusioni. La compatibilità distingue ora cinque esiti, senza riscrivere il registro storico 3B.

## 1. Decisione di prodotto e invarianti

Il Radar prepara il lavoro Horyzon e restituisce alla persona una sintesi chiara. **Un solo insieme di risposte/revisioni alimenta un unico risultato diagnostico versionato**, dal quale derivano due proiezioni autorizzate:

- `ClientResultProjection`: fotografia educativa breve, fedele anche quando parziale.
- `AdvisorResultProjection`: scheda di analisi e preparazione del colloquio, per operatori autorizzati sullo specifico contatto.

Il responsabile, l'evento di provenienza e l'identità sono contesto operativo, non fattori di salute patrimoniale. Il catalogo delle soluzioni è un modulo successivo distinto; non cambia diagnosi, soglie o priorità. Nessuna proiezione è un secondo motore, assegna nuovi punteggi o usa il profilo selezionato al funnel come risposta.

**Due assi indipendenti:** ordinario/approfondito indica i dati disponibili; cliente/operatore indica destinatario e granularità autorizzata. Un ordinario incompleto ha entrambe le viste, con gli stessi mancanti. Un approfondimento aggiunge precisione al risultato condiviso, non autorizza automaticamente più soggetti a leggerlo.

Il calcolo ordinario non richiede nome/recapiti. Il risultato immediato della propria compilazione può essere restituito nel contesto di sessione autorizzato a quella compilazione, secondo un contratto di accesso da definire e collaudare nella fase tecnica. Ciò non autorizza a collegarlo a un contatto per sola email né a esporlo allo staff: collegamento identità, accesso successivo/storico e assegnazione richiedono verifiche distinte. Identità non risolta resta un dato operativo mancante, non un ostacolo a una lettura educativa delle risposte proprie.

## 2. Nucleo comune del risultato

Nomi sotto sono campi concettuali, non tipi TypeScript, contratto HTTP o proposta di schema SQL.

| Elemento condiviso | Contenuto e vincolo |
| --- | --- |
| Identità del risultato | Riferimento interno opaco, revisione, istante di elaborazione e stato bozza/parziale/completo; nessuna chiave di accesso incorporata |
| Versioni | Catalogo domande, regole, formule, testi interpretativi e contratto delle proiezioni; stessi riferimenti in entrambe le viste |
| Fotografia | Unità individuale/nucleo, copertura S02, T0/T12/Tnow; ordinario e disponibilità degli approfondimenti distinti |
| Input | Revisioni di risposta effettivamente utilizzate; risposte inattive/non riconfermate escluse dai calcoli ma conservate nello storico autorizzato |
| Indicatori | Punto/intervallo/non calcolabile/non applicabile, unità, formula, input e motivo dei limiti; nessuna imputazione |
| Sei dimensioni | Stato descrittivo, evidenze favorevoli/sfavorevoli/neutre/mancanti, completezza informativa e qualità separata |
| Interpretazioni | Testi autorizzati, ID di evidenza/regola e limiti. Ogni frase deriva da input identificabili |
| Profili | Candidati vero/falso/indeterminato; prevalente/misto/non determinabile, basi qualitative/quantitative e motivi. Mostrare il profilo al cliente è facoltativo |
| Priorità | Ordine deterministico previsto dalle regole, deduplicato; nessun ordinamento commerciale |
| Storia | Riferimenti alle fotografie precedenti e confronto soltanto se perimetro, periodo e definizioni compatibili |
| Dossier obiettivi | X06 v1/v2, ordine confermato o non raccolto, orizzonti, risorse/vincoli X09, esperienza/aspettative X10 e utilità/coinvolgimento X11; dichiarazioni, confronti R-G e ipotesi separati |

Le due proiezioni devono riferirsi **alla stessa revisione** quando confrontate. Se una è precedente, indicare esplicitamente data/versione, senza presentarle come simultanee. Una nuova risposta genera nuova revisione e conseguenze, non riscrive la fotografia precedente. Cambio di testo o regola non rietichetta silenziosamente un vecchio risultato. Annullamenti/rettifiche e obblighi di conservazione richiedono policy approvate: «storico» non significa conservazione indefinita.

## 3. Client Result: contenuto esatto della sintesi ordinaria

Ordine e limiti editoriali proposti, da verificare con utenti:

1. **Fotografia generale:** due/tre frasi su perimetro, data e natura completa/parziale. Nessun giudizio globale «solido» o «fragile» ricavato dalla somma delle aree.
2. **Radar delle sei dimensioni:** nome, stato in linguaggio semplice, evidenza principale, disponibilità informativa e approfondimento; sei settori fissi secondo il contratto metodologico. Elenco/tabella alternativa con gli stessi contenuti.
3. **Uno o due punti di forza supportati:** una frase per fatto locale, con periodo/limite quando determinante. Se non ci sono evidenze sufficienti, dichiararlo e non riempire lo spazio con «hai completato il questionario». STRUTTURA_DESCRITTA non è di per sé un punto di forza.
4. **Principali aspetti da approfondire:** fino a tre in apertura secondo le priorità del motore, testo breve e concreto. Se ulteriori fatti materiali cambiano la lettura, mantenerli accessibili nella stessa sintesi attraverso una sezione chiaramente disponibile; il limite editoriale non autorizza a nasconderli.
5. **Informazioni insufficienti significative:** spiegare cosa impediscono di dire, senza chiedere cifre per migliorare un voto. Esempio: «Il patrimonio netto non è calcolabile perché il residuo dei debiti non è disponibile». Non elencare automaticamente ogni campo omesso privo di effetto sulla sintesi.
6. **Profilo educativo eventuale:** se mostrato, etichetta neutra, base dichiarata qualitativa/quantitativa e limite; misto e non determinabile ammessi. Nessuna percentuale inventata o segmento di vendita.
7. **Invito facoltativo al colloquio:** «Se vuoi, puoi approfondire questi punti con Horyzon». Nessuna urgenza costruita da patrimonio, difficoltà o soglie sperimentali; nessuna prenotazione, consenso o opportunità CRM impliciti.
8. **Accesso distinto ai dati:** indicazione del percorso autorizzato per consultazione/richiesta dei propri dati e chiarimenti; separato dalla proposta di colloquio.

Non mostrare automaticamente formule, matrici, cronologia completa, importi di tutte le voci, identificatori tecnici o note interne. La minimizzazione avviene **nella proiezione server**, non spedendo un oggetto Advisor completo al browser e nascondendone i campi con CSS.

Per gli obiettivi: eventuale principale solo se rango confermato, uno/due vincoli materiali e domanda utile da chiarire, senza nuova sezione tecnica. X06 v1 privo di ordine diventa «un obiettivo indicato», non automaticamente «il principale». Obiettivi ignoti non sono inventati; un conflitto materiale fra risorse dichiarate e attribuzioni resta comprensibile nella sintesi. Nessuna completezza del modulo è necessaria per il risultato educativo o l'invito facoltativo.

La sintesi deve comunque rendere visibili i fatti materiali: ritardi dichiarati in corso, riserva breve, deficit non programmato quando supportato, debito senza attività o netto negativo noto, incoerenza/perimetro parziale che impedisce una conclusione. Può esprimerli senza mostrare cifre esatte. Non è ammesso dire «nessuna anomalia» eliminando questi fatti. Se un numero è indispensabile alla comprensione, la policy editoriale ne consente il minimo necessario con unità e limite; mai una cifra priva di provenienza. Non si promette che tutti i risultati abbiano due forze o un profilo.

Esempio sintetico, CT-23: «Le risposte indicano debiti e nessuna attività nel perimetro scelto. Anche la riserva disponibile va chiarita. Sono aspetti da approfondire; questi dati non permettono una valutazione di insolvenza». Nessuna richiesta automatica di acquisto o prodotto.

## 4. Advisor Intelligence: scheda completa autorizzata

| Sezione | Contenuti da rendere disponibili | Limiti obbligatori |
| --- | --- | --- |
| Contatto e responsabilità | Identità verificata del contatto collegato; recapiti solo se già autorizzati e necessari al ruolo; responsabile attuale risolto dal sistema delle assegnazioni e revisione della relazione | Identità non risolta → stato esplicito, nessun collegamento per sola email. Owner CRM e operatore interno non sono equivalenti |
| Origine | Evento/edizione e funnel di provenienza, riferimenti operativi già verificati; stato dell'evidenza | Interesse/iscrizione/presenza distinti; non inventare partecipazione da una provenienza. Provenienza non cambia diagnosi |
| Compilazione | Bozza/parziale/completo, avanzamento dei prompt, disponibilità dei blocchi per area, profondità facoltativa | Avanzamento non equivale a completezza informativa; mancanti non sono risposte negative |
| Risposte | Valore originale, stato, data/perimetro/periodo, versione domanda, provenienza e revisioni; inattive e da riconfermare distinguibili | UNKNOWN, DECLINED, UNANSWERED, N/A validato e zero separati. Una nota non modifica una risposta |
| Quadro economico | Entrate, uscite, rate storiche/attuali, K, L, P, Lf; stock A/D/N e inventario se disponibili | Puntuale dichiarato o riportato da riepilogo, stima e fascia distinti. «Esatto» riguarda la precisione del numero, non la verifica esterna. Totali parziali denominati subtotali |
| Indicatori e formule | Valore/intervallo, input/revisioni, formula, denominatore, unità, data, predicato e limite | Non calcolabilità con motivo; nessun midpoint, capitale futuro inventato o grafico numerico dello stato |
| Sei analisi | Stato, tutte le evidenze, priorità, completezza e qualità; fatti favorevoli, vulnerabilità, contesto e anomalie separati | La stessa area può contenere forza locale e aspetto da verificare; assenza di alert non genera PRESIDI |
| Esposizioni | Concentrazione percepita, macroquote se calcolabili, reddito/patrimonio comuni, garanzie dichiarate, limiti dei presidi | Garanzia non è debito certo; macroclasse non è singolo emittente; nessuna correlazione o copertura necessaria stimata |
| Obiettivi/esigenze | F01 e X06 v1/v2: fino a tre obiettivi totali, ordine della persona, primo utilizzo e natura una tantum/continuativa, eventuali importi e limiti | Rango v1 non inventato; F01 non prova tutti gli obiettivi finanziati. Esigenza dichiarata distinta da ipotesi; niente bisogni commerciali o informazioni familiari sensibili inferite |
| Risorse e vincoli | L/P già dichiarati e revisioni, X09 Cmin/G0/G_i, altre categorie da verificare, vincoli globali/per obiettivo e rigidità | Quota attuale dichiarata distinta da capacità effettiva; P non sottratto due volte, G0 non duplicato per riga; patrimonio alto non supera un vincolo |
| Esperienza/aspettative/servizio | X10 del rispondente con episodi/recenza e dubbi; F03 attuale; X11 finalità del colloquio e coinvolgimento futuro | Possesso del nucleo non è esperienza personale; familiarità non è competenza o appropriatezza; X11 non cambia F03 e non conferisce delega/consenso |
| Profilo | Tutti i candidati e motivi, base FERMI qualitativa/quantitativa, misto/indeterminato | Non usare per assegnazioni, accesso, urgenza commerciale o valutazione del consulente |
| Da verificare | Informazioni insufficienti, contraddizioni, domande per il colloquio, limiti delle fonti | Priorità ai fatti attuali; nessun completamento tramite dati medi o informazioni CRM non confermate |
| Storia | Fotografie/revisioni e variazioni confrontabili con versioni, fonti e limiti | Perimetro diverso → confronto sospeso; incremento di patrimonio non equivale a benessere migliore |

Note di lavoro future, se autorizzate, devono avere autore, data e categoria «domanda / informazione da verificare / riscontro professionale». Sono un livello distinto dalle dichiarazioni. Non trasformarle in fatti diagnostici o in nuove risposte attribuite alla persona. Una rettifica richiede provenienza e revisione esplicite, preservando l'originale secondo policy; niente ricalcolo nascosto da testo libero.

Il dossier deve rendere disponibili tutti i nove blocchi 3C: situazione dichiarata; forze/vulnerabilità; obiettivi ordinati; orizzonti; risorse/vincoli; esperienza/aspettative; mancanti/incoerenze; domande utili al colloquio; eventuali categorie di temi/servizi da esaminare successivamente. Ogni elemento è marcato **dichiarazione / confronto calcolato / ipotesi da verificare**. Le categorie future non sono prodotti raccomandati né necessità del cliente. Esempi sintetici DS-01–03 nel documento obiettivi.

## 5. Contratto delle due proiezioni e differenze di granularità

| Campo/proprietà concettuale | ClientResultProjection | AdvisorResultProjection |
| --- | --- | --- |
| Riferimento/revisione/versioni del risultato | Collegamento interno alla stessa fotografia; data e limiti comprensibili | Riferimenti completi per tracciabilità |
| Perimetro e tempi | Riassunto essenziale | Definizioni e copertura di ogni input |
| Dimensioni | Tutte e sei, stato/evidenza principale/copertura/approfondimento | Stessi stati, tutte le evidenze e dipendenze |
| Forze e vulnerabilità | Selezione breve, senza omettere fatti materiali | Elenco completo e motivato |
| Risposte originali e cronologia | Escluse dalla sintesi ordinaria; percorso separato di accesso ai dati | Presenti entro scopo/ruolo autorizzati |
| Importi, formule, matrici | Non inclusi automaticamente; solo minimo necessario alla sintesi | Disponibili se acquisiti; distinti precisione, mancanza, qualità e perimetro |
| Identità/evento/assegnazione | Nessun recapito di terzi o identificatore interno necessario alla diagnosi | Contesto operativo verificato, separato dal nucleo diagnostico |
| Informazioni mancanti | Quelle significative per non equivocare | Tutte con stato originale, motivo e conseguenze |
| Domande per colloquio | Principali temi, invito facoltativo | Agenda motivata collegata alle evidenze |
| Modulo obiettivi 3C | Principale confermato e limiti materiali, senza matrici automatiche | Obiettivi/ranghi, risorse/vincoli comuni, esperienza/aspettative e finalità del servizio con provenienza e mancanti |
| Catalogo soluzioni futuro | Nessuna proposta automatica | Modulo separato, potenziale pertinenza e revisione professionale, non raccomandazioni diagnostiche |

Entrambe le proiezioni hanno un allowlist esplicito dei campi; nuovi campi nel risultato non diventano automaticamente visibili. La prima non deve contenere una copia nascosta della seconda in HTML, JSON di idratazione, risposte di rete, metadati, analytics o errori. I nomi delle proiezioni non implicano l'uso di viste SQL.

## 6. Autorizzazioni, assegnazioni e protezione

### Autorità effettiva, controllata sul server

L'identità autenticata deve essere collegata al soggetto/contatto corretto con relazione verificata e finalità approvata. Possedere un ID risultato, un riferimento HighLevel, un'email, un URL o il ruolo generico «staff» non autorizza il dettaglio. Il browser non decide `owner`, `operator`, `contact`, privilegi o perimetro leggibile.

Per AdvisorResultProjection servono **entrambi**: ruolo/scopo autorizzati e relazione effettiva corrente col contatto, oppure delega/supervisione esplicita approvata e auditabile. Assenza di responsabile, identità ambigua, assegnazioni discordanti o autorizzazione non risolta → dettaglio negato, riesame da funzione autorizzata; niente assegnazione automatica creata dal Radar per sbloccare la pagina. Supporto operativo e operatori assegnati non ricevono lo stesso accesso per default.

Contratto da rispettare: risolvere il responsabile dalle assegnazioni effettive. I documenti `patrimonial-assignment-management-v1.md` (P1) e `patrimonial-owner-sync-readiness-v1.md` (P2A), consultati in sola lettura in `C:/Users/emanu/Desktop/horyzon/horyzon-website/docs/patrimonial/` al HEAD osservato `dfd2e7b7b7d4af301c0429bd2ba75fa4c12b4739`, distinguono `current_operator_id` (responsabilità interna) da `owner_ref`/`ownerId` (riferimento CRM) e `remote_user_ref` (mapping eventuale); owner-sync non è autorizzazione alla scheda. Serve inoltre una relazione verificata fra identità autenticata staff e operatore interno: la sola presenza nel registro operatori non dimostra questa relazione. Al commit Radar di riferimento questi nuovi moduli **non sono integrati**: la specifica non attesta né un resolver disponibile qui né attivazione remota. Nessuna copia del codice concorrente e nessuna nuova regola di assegnazione.

Riassegnazione, release, disattivazione o revoca devono essere rispettate su ogni nuova lettura/esportazione; ricontrollare l'autorità al confine dell'operazione, non affidarsi a un vecchio owner in cache/JWT. Separare fotografia storica della responsabilità e permesso corrente: essere stato assegnato non dà accesso permanente allo storico. Anche le viste cliente, gli allegati e il percorso di accesso ai dati richiedono autorizzazione sul soggetto corretto. Le sessioni anonime di compilazione, se future, non ricevono una scheda contatto per il solo fatto di conoscere un recapito.

### Protezione dei dettagli

I dettagli economici restano nel database Horyzon protetto. Futuri accessi applicativi e database devono applicare il minimo privilegio sul singolo soggetto e sulle operazioni; credenziali privilegiate solo server, nessun dato economico nei log ordinari o nei messaggi di errore. La [documentazione ufficiale Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), consultata il 18/10/2026, distingue privilegi e policy per riga; autenticazione da sola non prova il diritto sulla riga. Proiezioni o funzioni privilegiate non devono aggirare il confine. Non è stata scritta alcuna policy, eseguita query o verificata la configurazione remota in 3B.

Evitare cache condivise, indicizzazione, analytics con valori economici, stato sensibile persistito nel browser, download pubblici e prefetch di schede non autorizzate. La futura implementazione deve specificare protezione in transito/a riposo, sessioni, audit degli accessi e degli export, cancellazione/rettifica, tempi di conservazione e recupero. Audit operativo: riferimenti opachi, attore, azione, esito e tempo; non duplicare intere risposte nei log. I controlli sono requisiti da collaudare, non sicurezza già dimostrata.

### Accesso della persona ai propri dati

La sintesi ridotta non limita i diritti della persona. Prevedere un percorso distinto dal colloquio commerciale, con verifica proporzionata dell'identità, gestione autorizzata della richiesta, consegna attraverso canale protetto e registrazione dell'esito. Deve poter rendere comprensibili dati, revisioni, risultati e logica pertinente, nei limiti applicabili; proteggere eventuali dati di terzi nel bilancio condiviso senza attribuire a un componente l'accesso automatico ai dati personali di tutti. Nessun obbligo di colloquio, acquisto o consenso commerciale per esercitare i diritti.

Riferimento primario: [GDPR, Regolamento (UE) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj/ita), in particolare artt. 5, 12, 15, 25 e 32, consultato il 18/10/2026. Sono riferimenti per minimizzazione, trasparenza, accesso e protezione: non attestano conformità del futuro prodotto. Base giuridica, titolarità/responsabili, informative, eventuale valutazione d'impatto, bilanci condivisi, retention e gestione delle annotazioni professionali richiedono valutazione privacy prima della raccolta/uso effettivo.

## 7. HighLevel: sintesi operativa minima, nessun dossier economico

Allowlist concettuale proposta per un **futuro** effetto dedicato, da approvare prima dell'implementazione:

- Riferimento opaco alla scheda interna, privo di dati e di potere di accesso.
- Stato operativo di disponibilità della scheda e sua revisione/data; evitare di duplicare risposte e storia.
- Richiesta esplicita di colloquio, soltanto se realmente espressa e utilizzabile secondo le autorizzazioni del canale.
- Riferimento a evento/edizione già verificato, solo se necessario al flusso operativo approvato.

Nessun reddito, spesa, debito, patrimonio, quota, profilo diagnostico, stato di vulnerabilità, matrice, risposta, nota del colloquio o documento finanziario nelle note CRM generiche. La sintesi HighLevel non è ClientResultProjection né AdvisorResultProjection. Non dedurre fragilità dall'etichetta operativa o inserire numeri in codici/nome attività. Nei messaggi/email eventualmente autorizzati solo comunicazione operativa e accesso autenticato; niente dettagli finanziari o allegati pubblici. URL privi di valori economici, identità in query e token bearer che conferiscano accesso alla scheda.

Un riferimento opaco non sostituisce i controlli dell'utente che lo apre. La consegna al CRM non assegna un operatore, non cambia owner/stage, non crea contatti/opportunità per il solo completamento. Futuro invio mediante ledger/outbox esistenti, con contratto dedicato/versionato, idempotenza e autorizzazione: il risultato locale non dipende dalla disponibilità del CRM. Atomicità risultato/evento e riassegnazioni concorrenti saranno progettate e provate nella fase tecnica; nessun effetto o flag viene aggiunto/attivato ora.

## 8. Preparazione del colloquio

Agenda interna proposta, senza imporre azioni economiche:

1. Confermare perimetro, periodi e ciò che la persona desidera approfondire; distinguere la richiesta effettiva dal profilo educativo.
2. Rileggere fatti materiali attuali e incoerenze che potrebbero cambiare l'interpretazione, senza diagnosi di crisi o merito creditizio.
3. Selezionare domande collegate agli ID di evidenza: «Queste rate sono pagate o dovute?», «Le somme accantonate coprono già una spesa vicina?», «Quali limiti della strategia hai controllato?». Nessuna domanda sanitaria o nominativa necessaria.
4. Distinguere risposte della persona, informazioni da verificare e riscontri professionali. Confermare eventuali rettifiche e generare revisione; niente modifica retroattiva silenziosa.
5. Solo dopo aver chiarito l'esigenza, valutare se occorra una figura abilitata o un servizio, anche esterno. «Nessuna soluzione Horyzon identificata» è un esito legittimo; il colloquio non deve concludersi con una vendita.

Riuso 3C: aprire con il riepilogo di ciò che è già noto, chiedendo solo i chiarimenti utili a cambiare la lettura. Non ripetere redditi/inventario/protezioni già coerenti; non sollecitare nuovamente un dato rifiutato come requisito del colloquio. Chiarire priorità non confermate, primo utilizzo, vincoli non negoziabili e risorse attribuite due volte prima di discutere categorie di soluzioni. Preferenza futura diversa da F03 non è una contraddizione: descrive un tempo/scopo diverso. L'agenda non risolve d'ufficio le incompatibilità né converte un'ipotesi in fatto.

Le domande non diventano nuovi campi obbligatori del Radar. Un operatore non può convertire un'ipotesi («forse serve liquidità») in esigenza dichiarata o concludere adeguatezza sulla base del solo profilo FERMI.

## 9. Modulo futuro di compatibilità con le soluzioni Horyzon

**Solo contratto concettuale separato**, nessun catalogo reale acquisito, prodotto candidato inventato o algoritmo implementato. Scopo: aiutare un operatore autorizzato a individuare temi potenzialmente pertinenti da sottoporre a verifica professionale. Non è test di adeguatezza, raccomandazione individuale o autorizzazione a proporre/acquistare uno strumento finanziario.

### Scheda versionata di catalogo necessaria

Ogni soluzione richiede ID/versione, titolare della scheda, stato bozza/verificata/ritirata, data e fonti di verifica, periodo di validità, più:

| Voce | Contenuto richiesto prima di un confronto utilizzabile |
| --- | --- |
| Descrizione | Prodotto o servizio concreto, finalità e confini; niente claim o rendimenti presunti |
| Classificazione | Categoria giuridica/regolamentare, giurisdizione e verifica professionale documentata. «Da verificare» non equivale a non regolamentato |
| Destinatari e finalità | Per quali esigenze documentate può essere pertinente; eventuali esclusioni; distinguere servizio educativo e attività professionale regolamentata |
| Rischi e limiti | Rischi pertinenti, cose che non risolve, limiti delle evidenze e conflitti da gestire |
| Costi e vincoli | Costi per la persona, condizioni, durata, obblighi, uscita, eventuale indisponibilità delle risorse e informazioni non ancora verificate |
| Orizzonte | Eventuale durata richiesta e compatibilità da verificare con l'orizzonte effettivamente dichiarato, senza inferirlo dall'età o dal ruolo |
| Esigenze collegabili | Riferimenti a esigenze/evidenze ammesse dal Radar, motivazione e input aggiuntivi eventualmente necessari |
| Incompatibilità | Condizioni note che escludono la coerenza, fonte e versione; nessuna compensazione con altri punti o ricavi |
| Autorizzazioni | Figure abilitate, verifiche e documentazione richieste per la specifica categoria; chi approva la scheda e chi può formulare una proposta |

Scheda mancante, scaduta, ritirata o classificazione non verificata non dà una proposta utilizzabile. Non aggiungere al Radar nuove domande personali soltanto per popolare il catalogo; eventuali informazioni richieste da un servizio regolamentato appartengono a un processo separato autorizzato. Nessuna percentuale di portafoglio o soglia commerciale viene ricavata dai profili narrativi.

### Input e output del confronto

Input concettuali: riferimento alla revisione del risultato; obiettivi/esigenze e utilità del servizio **dichiarati**, priorità della persona, primo utilizzo delle risorse, risorse/vincoli/rigidità, esperienza/aspettative pertinenti con tutti i limiti; versione del catalogo/verifiche; contesto professionale autorizzato. Non servono nome/recapiti. Ipotesi dell'operatore separate dai fatti. Patrimonio elevato o difficoltà economiche non sono priorità commerciale; una possibilità di vendita non diventa necessità del cliente. Nessun obiettivo inventato per far corrispondere una scheda.

Ogni esito deve riportare soluzione/versione se identificata, esigenza/evidenze usate, informazioni mancanti, incompatibilità e verifiche professionali richieste, autore/data dell'eventuale valutazione umana. Nessun punteggio, ordinamento per ricavi, commissioni, conversione o probabilità di vendita. Costi effettivi per il cliente possono essere un vincolo da verificare; il beneficio commerciale Horyzon non è un criterio diagnostico o di pertinenza.

| Esito ammesso | Significato e condizione |
| --- | --- |
| Soluzione potenzialmente pertinente, da verificare | Soluzione identificata e scheda verificata corrente; esigenza dichiarata coerente con la finalità; nessuna incompatibilità nota e informazioni minime per il confronto presenti. Nessuna attestazione di adeguatezza o raccomandazione |
| Non valutabile per informazioni insufficienti | Obiettivi/tempi, vincoli pertinenti o classificazione/costi/rischi/verifica del catalogo non consentono il confronto. Esporre il dato mancante, non scegliere la soluzione più redditizia |
| Incompatibile con i vincoli conosciuti | Contrasto certo con un vincolo non negoziabile dichiarato, per esempio indisponibilità oltre il primo utilizzo richiesto. Motivo e basi espliciti; altri ignoti non cancellano un'incompatibilità certa |
| Non pertinente agli obiettivi dichiarati | Finalità nota senza collegamento con obiettivi o utilità del servizio espressi. Non equivale a incapacità economica o insufficienza di informazioni; con obiettivi ignoti la non pertinenza non è automatica |
| Nessuna soluzione del catalogo identificata | Esito di insieme riferito a versione/perimetro del catalogo consultabile, senza candidata identificata dopo il confronto. Catalogo assente/non leggibile/incompleto → confronto insufficiente, non prova di assenza. Nessuna conclusione sul mercato o obbligo di cambiare l'esigenza |

Per la candidata conservare tutti i motivi, con esito principale: incompatibilità certa, non pertinenza certa, insufficienza sostanziale, altrimenti pertinenza potenziale. Nessun ignoto trattato come assenza di vincolo o obiettivo; nessun vincolo compensato con promozioni/rendimenti. A livello di insieme distinguere catalogo senza candidata identificabile da confronto sospeso per dati non disponibili. Più candidate senza vincitore automatico. La precedente voce 3B «non coerente» resta storica: la versione 3C distingue i due motivi senza riclassificare il passato d'ufficio. L'operatore può motivare rinvio o assenza di proposta, non trasformare il potenziale in raccomandazione tramite un bottone o testo generato.

Eventuali proposte commerciali/professionali sono formulate dalle figure abilitate secondo la categoria e le regole applicabili, in un processo separato con informazioni, verifiche e documentazione proprie. I quesiti F04/F05 e il profilo non sostituiscono valutazioni regolamentate. Riferimento metodologico S12 ESMA: cautela nell'uso delle autovalutazioni, non autorizzazione al servizio. AI non necessaria né abilitata; nessun invio di dossier a provider.

Anche X10/X11 restano dichiarazioni preparatorie: non sostituiscono adeguatezza, appropriatezza, capacità di perdita, tolleranza al rischio o requisiti della categoria. Il solo Radar non autorizza shortlist individuali di strumenti finanziari. Per X09 disponibilità dichiarata e residuo rispetto alla riserva scelta non sono capacità economica effettiva verificata; somme illiquide o future non diventano cassa. Nessun dato nuovo del modulo amplia l'allowlist HighLevel, le note, le email o gli URL.

## 10. Decisioni aperte e criteri della futura implementazione

Approvazioni ancora necessarie: perimetro educativo/professionale; linguaggio e soglie sperimentali; informativa e basi giuridiche per calcolo, gestione contatto e confronto soluzioni; ruolo degli operatori/deleghe/revoche; trattamento dei bilanci condivisi e dei diritti; retention, export e audit; significato della sintesi CRM; classificazione e revisione di ogni soluzione; testi previdenziali aggiornati. Sono gate futuri, non una richiesta di approvazione per completare questa revisione documentale.

Accettazione da collaudare nella fase tecnica:

- Identici input/versioni producono gli stessi stati, indicatori, candidati e conclusioni nelle due viste. Le formule non vengono replicate nelle proiezioni; test di parità per tutte le 14 fixture e CT-26.
- Sintesi cliente leggibile con 0/1/2 forze effettivamente supportate, sei settori senza punteggio, mancanti/materialità preservati, alternativa testuale e temi accessibili. Nessun dato Advisor nascosto nel payload cliente.
- Controlli positivi/negativi per due soggetti e due operatori fittizi, riassegnazione/revoca/sessione scaduta, accesso incrociato a storico/export e ID opachi copiati. Identità/owner inviati dal browser ignorati come autorità; test anche al confine database.
- Responsabile risolto dalle assegnazioni effettive; differenza operatore interno/owner CRM rispettata, conflitto o assegnazione assente gestiti senza nuovi automatismi. Nessuna dipendenza da owner-sync per autorizzare il dettaglio.
- Precisione/importi/mancanti e revisione originali conservati; osservazioni dell'operatore non diventano risposte; confronti storici bloccati se non omogenei.
- Allowlist CRM verificata su payload, note, URL, log e notifiche; nessun dato economico o profilo, nessuna nuova opportunità/owner write dal semplice completamento. Retry/versioni non risincronizzano una sintesi obsoleta.
- Percorso separato per i diritti della persona, senza acquisto/colloquio obbligatori; controllo dei dati di terzi e consegna protetta secondo policy approvata.
- Catalogo con tutti i cinque esiti 3C, non pertinenza distinta da incompatibilità, metadati/versioni verificabili e gestione insufficienza/scadenza; cambi di commissione/patrimonio non cambiano diagnosi/ordine commerciale (CT-28 e CT-38). Nessuna raccomandazione individuale automatica.
- X06 v1/v2 e X09–X11: ordine confermato, vincoli rispettati, fondi non duplicati, esperienza del rispondente separata dal possesso, agenda senza domande ripetitive. Tutti G01–G08 e CT-29–40 revisionati come attese documentali; tempi e comprensione da misurare.

In 3B/3C questi sono **requisiti documentati**, non test browser, prove ACL, verifiche del database o validazione scientifica. Non sono state effettuate scritture Supabase/HighLevel, migrazioni, modifiche alle assegnazioni, push o deploy. L'aggiornamento del modulo/categorie/finalità richiede anche approvazione DEC-11, oltre ai gate già documentati.
