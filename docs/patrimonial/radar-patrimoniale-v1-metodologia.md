# Radar Patrimoniale V1 — Metodologia

Versione proposta **RP-MET-1.2-draft**, Fase 3C del 18 ottobre 2026. Stato: specifica da approvare, non prodotto implementato né modello validato. Base tecnica: `ebab303e6e8e5ef2156ab9843d34058b822d755f`; baseline documentale 3B: `e11a31b9903fdb8efff31f6d9153bafe6dd854f9`, branch `feat/radar-patrimoniale-v1`, worktree Radar isolato.

Documenti coordinati: [questionario](radar-patrimoniale-v1-questionario.md), [indicatori e valutazione](radar-patrimoniale-v1-scoring.md), [casi sintetici](radar-patrimoniale-v1-profili-test.md). Identificativi di fonte `Sxx`, domanda `RP-…`, indicatore `I-…`, regola `R-…` e decisione `DEC-…` sono condivisi. Tutte le regole non esplicitamente attribuite a una fonte sono **proposte Horyzon**.

La Fase 3B aggiunge il [registro delle decisioni](radar-patrimoniale-v1-decisioni-fase-3b.md) e il [contratto delle due viste](radar-patrimoniale-v1-doppia-vista.md). Finalità di prodotto aggiornata: preparare il lavoro Horyzon e dare alla persona una sintesi educativa chiara della **medesima analisi**. Client Result e Advisor Intelligence sono proiezioni autorizzate, non motori diversi. I due livelli di raccolta (ordinario/approfondito) sono indipendenti dalle due viste: entrambe possono rappresentare un risultato parziale o approfondito.

La 3C integra la [profilazione degli obiettivi](radar-patrimoniale-v1-profilazione-obiettivi.md): riuso dei dati già presenti, massimo tre obiettivi complessivi ordinati e approfondimento facoltativo di risorse/vincoli, esperienza/aspettative e utilità del colloquio. Obiettivo economico, preferenza, disponibilità dichiarata e capacità effettiva da verificare restano distinti. Il registro 3B è storico e mantiene i propri conteggi.

## 1. Fonti effettive del repository

Letti AGENTS.md, DESIGN.md, i report [2A](radar-patrimoniale-v1-integrazione-fase-2a.md) e [2B](radar-patrimoniale-v1-integrazione-fase-2b.md), i contenuti e la landing Evento correnti, e dominio/tipi/economics/posizionamento/report del Radar d'Impresa v4. Il risultato tecnico di partenza è quello di 2B; il rilievo HTTP Markdown della home resta estraneo a questa progettazione e non viene dichiarato risolto.

L'audit Fase 1 **non è presente in questo worktree**. È stata individuata e letta integralmente la copia effettiva, non tracciata, in `C:/Users/emanu/Desktop/horyzon/horyzon-website/docs/patrimonial/radar-patrimoniale-v1-audit-fase-1.md` (562 righe). Non è stata copiata o riscritta. È un audit storico del 18 ottobre, non una nuova verifica dei servizi remoti. Le sue descrizioni di codice/branch precedenti al merge vanno lette alla luce di 2A/2B.

Il Radar aziendale corrente conserva 34 schermate, cinque reparti, scoring Likert e un fallback numerico per risposte mancanti. Si riprende soltanto il principio di dominio deterministico e risultato tracciabile: **nessuna domanda, soglia, media, fallback 3 o algoritmo aziendale viene trasferito**. Non viene modificato alcun suo file.

Il funnel contiene quattro autoselezioni narrative, categorie professionali distinte, dati illustrativi di rendimento e distribuzioni 50/50 e 70-10-10-10. Sono riferimenti di linguaggio e contesto, mai benchmark, pesi o prova di competenza. Né iscrizione, presenza all'evento o interesse commerciale migliorano la valutazione.

## 2. Scopo educativo e confini

Il Radar restituisce una fotografia delle informazioni dichiarate: flussi di cassa, disponibilità, impegni, esposizioni e pratiche di pianificazione. Non determina merito creditizio, assicurabilità, adeguatezza MiFID, rendimento atteso, probabilità di insolvenza o una quantità ottimale di investimenti.

Sono esclusi raccomandazioni di acquisto/vendita, asset allocation personale, selezione di intermediari/prodotti, rinegoziazioni automatiche, stime attuariali e diagnosi sanitarie. Il confine dipende dal comportamento effettivo, non dalla presenza di un disclaimer. Prima dell'implementazione occorre una revisione professionale del perimetro e dei testi (DEC-06). Le fonti di vigilanza non certificano questo Radar.

Target iniziale: maggiorenni che descrivono un bilancio in euro nel contesto italiano. Nessun obbligo di essere cliente, investitore o partecipante all'evento. Per situazioni multivaluta, transfrontaliere o giuridiche complesse si producono soltanto le letture supportate; niente conversioni implicite o conclusioni normative italiane automatiche.

### Unità di analisi

RP-S01 sceglie **individuale** oppure **nucleo con bilancio condiviso**, anche una coppia senza figli. Ogni importo, responsabilità e quota patrimoniale deve seguire la medesima scelta. Il report la ripete in apertura. Non si deduce la scelta dallo stato civile e non si sommano due compilazioni di persone diverse.

Individuale: solo entrate disponibili, spese effettivamente sostenute, beni e debiti riferibili alla persona. Per cointestazioni non assumere divisione a metà: quote economiche sconosciute restano sconosciute. Gli obblighi solidali/garanzie ulteriori sono segnalati separatamente e non convertiti in debito certo. Familiare: includere l'intero perimetro scelto, eliminando trasferimenti interni e duplicazioni; il rispondente può comunque conoscere solo parte dei dati.

RP-S02 distingue perimetro completo, parziale e non ricostruibile. Con dati parziali si mostrano le singole osservazioni, ma si sospendono rapporti che combinerebbero numeratori e denominatori di estensione diversa. Il risultato è «fotografia parziale», mai «famiglia solida» sulla base del solo stipendio di un componente. Un cambiamento di unità apre una revisione con riconferma degli importi: non è comparabile automaticamente con il precedente episodio.

### Contesti da trattare senza scorciatoie

| Contesto | Trattamento |
| --- | --- |
| Dipendente, pensionato | Redditi netti e periodo, senza assumere garanzia perpetua del reddito. Per pensionati la domanda previdenziale riguarda le risorse di lungo periodo e il budget già in pensione |
| Professionista/imprenditore | Reddito personale disponibile dopo costi, imposte e contributi; mai fatturato o utile dell'azienda non distribuito. Partecipazione societaria separata dal reddito; garanzie solo come esposizioni dichiarate |
| Reddito variabile | Media degli ultimi 12 mesi più indicazione della variabilità; eventuale minimo mensile osservato come approfondimento. La media non prova capacità di pagare ogni singola scadenza |
| Nessun investimento | Non applicare il quesito sui costi degli investimenti. Nessuna penalità per non investire; conoscenza e obiettivi restano osservabili |
| Casa prevalente / patrimonio elevato e poca cassa | Separare proprietà, disponibilità immediata e impegni. Valore della casa non sostituisce la riserva |
| Sostegno da altri | Entrate regolari disponibili distinte da prestiti/prelievi. Non inferire assenza di difficoltà da spese dichiarate nulle |
| Dati incompleti o rifiutati | Restituire ciò che è supportato e motivare i vuoti; non spingere a rivelare importi per ottenere un profilo migliore |

## 3. Ricerca: registro delle fonti

Consultazione: **18 ottobre 2026**, solo fonti primarie sotto. Dove la pagina non espone una data verificabile si indica s.d., senza assegnare la data del crawler alla pubblicazione. Le fonti sostengono costrutti e cautele; **non forniscono calibrazione o validazione delle soglie Horyzon**. Non vengono usate medie nazionali per riempire risposte mancanti.

| ID | Titolo, ente, data e URL | Principio utilizzato | Limite di applicabilità / verifica |
| --- | --- | --- | --- |
| S01 | OECD/INFE, [Toolkit for Measuring Financial Literacy, Inclusion and Well-Being 2026](https://www.oecd.org/en/publications/oecd-infe-toolkit-for-measuring-financial-literacy-inclusion-and-well-being-2026_92f2d439-en.html), 13/01/2026; [PDF](https://www.oecd.org/content/dam/oecd/en/publications/reports/2026/01/oecd-infe-toolkit-for-measuring-financial-literacy-inclusion-and-well-being-2026_6e8d9566/92f2d439-en.pdf), sezioni 1–3, in particolare pp. 6 e 23 | Distinguere conoscenze, atteggiamenti, comportamenti e benessere; gestire risposte non note/rifiutate; osservare resilienza a perdita di reddito | Questionario per indagini comparabili, non validazione di un test commerciale abbreviato. Le fasce temporali del toolkit sono modalità di risposta, non una soglia universale di sicurezza. Consultati introduzione, metodo e item pertinenti |
| S02 | OECD, [G20 policy note on financial well-being](https://www.oecd.org/en/publications/g20-policy-note-on-financial-well-being_7332c99d-en.html), 21/11/2024 | Benessere più ampio della ricchezza: bisogni correnti, shock, obiettivi e componente soggettiva | Quadro concettuale; non autorizza una media delle sei aree. Consultate scheda, sintesi e definizione richiamata in S01 |
| S03 | Banca d'Italia, Loschiavo/Tullio/di Salvatore, [Le fragilità finanziarie delle famiglie italiane: un'analisi su redditi, patrimoni finanziari e debiti, TD 1452](https://www.bancaditalia.it/pubblicazioni/temi-discussione/2024/2024-1452/index.html), 23/04/2024; versione scientifica segnalata nel 2025 | Considerare separatamente reddito, ricchezza finanziaria e debito; la fragilità può essere multidimensionale | Sintesi istituzionale di ricerca su IBF 2000–2020. Non è una stima attuale della persona né una scala del Radar; nessun coefficiente del paper è importato |
| S04 | Banca d'Italia, L'economia per tutti, [Mutuo ipotecario](https://economiapertutti.bancaditalia.it/aree-tematiche/prestiti/mutuo-ipotecario/index.html), s.d. | La sostenibilità dipende dalla capacità di rimborso; indicazione educativa di circa un terzo del reddito per la rata del mutuo | Non è un limite legale o una classificazione universale del totale debiti. Il Radar mostra il rapporto ma non assegna esito automatico a 1/3 |
| S05 | CONSOB, [Rapporto 2024 sulle scelte di investimento delle famiglie italiane](https://www.consob.it/documents/11973/287812/rf2024.pdf), luglio 2024, pp. 2–5 e sintesi | Distinguere possesso di attività, conoscenze, attitudini e decisioni; attenzione alle autovalutazioni | Campione di 2.011 decisori finanziari investitori, con esclusione di chi detiene soltanto strumenti di base o soli piani previdenziali. Non generalizzare le percentuali a tutti i destinatari del Radar |
| S06 | CONSOB, [La diversificazione](https://www.consob.it/web/investor-education/la-diversificazione), s.d. | Numero di prodotti diverso da diversificazione effettiva; caratteristiche comuni, obiettivi e orizzonte contano | Principio educativo; non prescrive percentuali ottimali. Una tassonomia patrimoniale aggregata non osserva correlazioni o rischio del singolo strumento. Ricontrollo 3B: apertura diretta bloccata da protezione automatica; testo istituzionale indicizzato reperito, non nuova verifica diretta completa |
| S07 | IVASS, [Indagine – Conoscenze e comportamenti assicurativi](https://www.ivass.it/consumatori/imparaconivass/indagine-conoscenza-assicurativa/), microdati maggio 2021, pagina aggiornata 30/06/2023 | Esplorare percezione dei bisogni e comprensione, oltre al possesso di polizze | Consultati pagina e struttura del questionario. Dati storici, non indice di adeguatezza delle coperture del singolo |
| S08 | IVASS, [Le polizze connesse a mutui e finanziamenti, Guida n. 7](https://www.ivass.it/consumatori/imparaconivass/guide/Guida_7_Polizze_connesse_mutui_e_finanziamenti_versione_web.pdf?language_id=3), s.d.; PDF pp. 5–7 | La comprensione di condizioni ed esclusioni conta, non solo l'esistenza di un contratto | Guida di un ambito specifico; nessuna estensione automatica a tutte le coperture. Nel Radar non si raccolgono motivi sanitari di esclusione |
| S09 | COVIP, [Come pianificare il proprio risparmio previdenziale](https://www.covip.it/sites/default/files/come_pianificare_il_proprio_risparmio_previdenziale_0.pdf), indicazione editoriale 13/06/2025; [Guida introduttiva](https://www.covip.it/per-il-cittadino/educazione-previdenziale/guida-introduttiva-alla-previdenza-complementare), [PDF identificato come 14 aprile 2026](https://www.covip.it/sites/default/files/guida_introduttiva_alla_previdenza_complementare_-_14_aprile_2026.pdf) | Riferimento per il tema previdenziale e la verifica delle informazioni; nessun parametro operativo importato | **Consultazione ancora parziale in 3B:** pagina/PDF non apribili direttamente; testo ufficiale indicizzato segnala contenuti in revisione per novità dal 1° luglio 2026. Il nome del PDF non prova un consolidamento successivo. Nessuna regola fiscale, prestazione, aliquota, età o soglia viene adottata; revisione previdenziale aggiornata necessaria |
| S10 | ISTAT, [Condizioni di vita e reddito delle famiglie – Anni 2024–2025](https://www.istat.it/wp-content/uploads/2026/03/REPORT-REDDITO-CONDIZIONI-DI-VITA.pdf), 02/04/2026, pp. 1–2 e glossario | Distinguere anno delle condizioni di vita e anno dei redditi; difficoltà economica non coincidente con sola ricchezza | Fonte campionaria di popolazione, con redditi 2024 e condizioni 2025. Nessuna soglia di povertà nazionale viene assegnata alla persona con fasce semplificate |
| S11 | Eurostat, [Poverty and social exclusion – metadata](https://ec.europa.eu/eurostat/cache/metadata/EN/tipspo_esms.htm), s.d., §3.4 | Difficoltà a sostenere spese e arretrati sono concetti diversi; gli indici ufficiali hanno più componenti | Non riprodurre un indicatore EU-SILC con un solo quesito. Lo scenario RP-B04, rapportato alle spese della persona, è una proposta Horyzon, non l'item monetario ufficiale |
| S12 | ESMA, [Guidelines on certain aspects of the MiFID II suitability requirements, ESMA35-43-3172](https://www.esma.europa.eu/sites/default/files/2023-04/ESMA35-43-3172_Guidelines_on_certain_aspects_of_the_MiFID_II_suitability_requirements.pdf), 03/04/2023, §§46–47 | Cautela su autovalutazioni; domande pratiche e controlli di coerenza riducono alcuni errori | Linee guida per servizi regolamentati, non base normativa per qualificare il Radar come tale. Si riprende una cautela metodologica, non un test di adeguatezza |

Nessuna percentuale di prevalenza è necessaria al motore. Ulteriori pagine Banca d'Italia/Eurostat 2026 sono state ricercate per aggiornamento, senza trasformare i loro dati aggregati in soglie personali. EBA non è stata utilizzata: non serve importare criteri di concessione del credito in una lettura educativa domestica.

### Ricontrollo delle fonti in Fase 3B

Il 18 ottobre 2026 sono stati riaperti i 12 riferimenti: S01–S05, S07–S08 e S10–S12 accessibili; S06 con blocco diretto ma testo ufficiale indicizzato; S09 ancora limitato come sopra. Per S01 confermati scheda, DOI `10.1787/92f2d439-en`, data 13 gennaio 2026 e PDF di 66 pagine; restano pertinenti separazione conoscenze/comportamenti/atteggiamenti e gestione delle mancate risposte, non una certificazione del Radar.

Per S09 l'[indice comunicazioni COVIP](https://www.covip.it/la-covip-e-la-sua-attivita/comunicazioni/altre-comunicazioni), disponibile tramite indicizzazione istituzionale, elenca provvedimenti di giugno e luglio 2026, fra cui la [circolare del 16 luglio 2026 n. 4524](https://www.covip.it/normativa/fondi-pensione/atti-generali-covip/circolare-del-16-luglio-2026-prot-n-4524). Verificata l'esistenza dei riferimenti nell'indice, **non** la lettura integrale diretta o l'applicabilità alla persona. Guida e FAQ riportano ancora l'avviso di revisione: un PDF di aprile non basta per chiudere DEC-08. RP-F02/X08 restano domande sul processo di verifica, senza regole di accesso, benefici fiscali, rendimenti o importi previdenziali.

### Evidenza esterna e scelte proprie

Consolidato: definizioni contabili dei rapporti una volta stabiliti input/periodo, differenza stock/flussi, distinzione fra conoscenza dichiarata e prestazione a un quesito. Non consolidato per questo prodotto: soglie di triage, affidabilità delle dichiarazioni online, profili narrativi, classificazione a sei dimensioni, durata e comprensione dei testi. Tutti questi aspetti richiedono validazione Horyzon. Nessun «validato da OCSE/CONSOB».

## 4. Sei dimensioni: contratto diagnostico

### A — Equilibrio economico

- **Obiettivo/misura:** descrivere margine di cassa recente, ricorso non programmato a risorse esterne e regolarità delle entrate; non stimare ricchezza futura.
- **Indicatori:** I-A01 margine e tasso di margine, I-A02 copertura delle uscite, I-A03 dipendenza dalla fonte principale, I-A04 scenario sul minimo osservato facoltativo.
- **Indispensabili:** perimetro coerente; RP-A01/A02 e RP-C02 per i rapporti; A03/A04 e A05 quando applicabile per la lettura completa. **Facoltativi:** X01 e note strutturate di precisione.
- **Applicabilità:** anche pensioni, redditi nulli, prelievi programmati. Con Y=0 si mostra il margine in euro se calcolabile, non una percentuale.
- **Non valutabilità/limiti:** quantità mancanti o perimetro parziale impediscono i rapporti; restano singole osservazioni. Media annuale non rappresenta i mesi difficili. Non è il tasso di risparmio dei conti nazionali.
- **Ammesso:** «Le uscite recenti superano le entrate dichiarate». **Vietato:** «Sei incapace di risparmiare», «puoi investire X al mese» o equiparare un prelievo pensionistico pianificato a crisi.

### B — Liquidità e sicurezza

- **Obiettivo/misura:** risorse accessibili senza nuovo debito o vendita a prezzo incerto, al netto degli accantonamenti dichiarati, rapportate alle uscite essenziali attuali.
- **Indicatori:** I-B01 riserva libera/autonomia, I-B02 copertura del totale uscite recenti, I-B03 risposta allo scenario imprevisto.
- **Indispensabili:** RP-B01/B02/B03 e RP-C04 per autonomia; B04 per il confronto soggettivo. **Facoltativi:** verifica successiva degli importi approssimati.
- **Applicabilità:** tutti; casa, affidamenti e investimenti vendibili con perdita non diventano riserva certa. Non si definisce «rischio zero» di un deposito.
- **Non valutabilità/limiti:** spese essenziali nulle o ignote rendono non calcolabile il rapporto; dati ad ampio intervallo possono non sostenere una banda unica. È autonomia convenzionale senza nuove entrate, non previsione di esaurimento.
- **Ammesso:** «La riserva libera copre meno di un mese delle uscite essenziali dichiarate». **Vietato:** prescrivere una riserva universale o confondere patrimonio immobiliare con cassa.

### C — Indebitamento

- **Obiettivo/misura:** descrivere rate storiche/attuali, arretrati e impegni, non il merito creditizio.
- **Indicatori:** I-C01 incidenza storica rate, I-C02 pressione attuale indicativa, I-C03 segnali di ritardo; stock debiti per I-E01 solo nell'approfondimento.
- **Indispensabili:** RP-C01/C03; C02/C04 quando applicabili e A01 per rapporti. **Facoltativi:** X02/X05.
- **Applicabilità:** C01 «nessuno negli ultimi 12 mesi né aperto oggi» consente zeri strutturali per rate; il debito residuo totale è zero strutturale solo se C03 esclude anche arretrati ancora aperti. Eventuali arretrati di utenze/affitto restano rilevanti e richiedono il residuo X05 per il netto. No debiti non significa altre cinque aree positive.
- **Non valutabilità/limiti:** credito revolving, rate differite e garanzie possono non essere catturati dal pagamento medio; non imputare zero a debiti non conosciuti. Rapporti con reddito nullo non sono percentuali infinite.
- **Ammesso:** «Sono dichiarati ritardi in corso». **Vietato:** «Mutuo approvabile/sostenibile per la banca» o «assenza di debito = salute patrimoniale».

### D — Protezione

- **Obiettivo/misura:** esposizioni individuate e presenza dichiarata di una strategia compresa: protezioni pubbliche, contrattuali, aziendali, private o riserva consapevole.
- **Indicatori:** I-D01 mappa esposizione/presidio; I-D02 verifica dei limiti facoltativa.
- **Indispensabili:** RP-D01 e D02 sulle esposizioni selezionate. **Facoltativi:** X03.
- **Applicabilità:** bisogni differenti per persona/nucleo, responsabilità e fonte di reddito; nessuna presunzione di obbligo di acquistare una polizza. «Nessuna esposizione percepita» non prova non applicabilità dell'intera area.
- **Non valutabilità/limiti:** non conosciamo contratti, esclusioni reali, massimali necessari o sostegni effettivamente ottenibili. Anche «documento consultato» resta un'autodichiarazione.
- **Ammesso:** «Per questa responsabilità non hai ancora individuato una risposta». **Vietato:** «Sei assicurato adeguatamente», dedurre salute, assicurabilità o un prodotto necessario.

### E — Struttura patrimoniale

- **Obiettivo/misura:** composizione dichiarata, concentrazioni percepite/quantificabili, legame fra reddito e patrimonio, liquidabilità.
- **Indicatori:** I-E01 attività/debiti/patrimonio netto parziale, I-E02 quota liquidità, I-E03 concentrazione per macroclasse, I-E04 esposizione comune reddito/patrimonio.
- **Indispensabili:** RP-E01/E02/E03/E04 per letture qualitative. **Facoltativi:** X04/X05 per importi e rapporti.
- **Applicabilità:** anche sola liquidità, sola casa o nessuna attività con debiti. Con A=0 confermato solo composizione/quote sono non applicabili; N resta A−D se entrambi noti. A=0 e D=5.000 danno N=−5.000 ed E DA_APPROFONDIRE, non area esclusa. Con debito aperto noto ma residuo ignoto resta l'approfondimento e N non calcolabile; nessuna diagnosi di insolvenza. Previdenza vincolata e diritti pensionistici restano separati dal patrimonio considerato.
- **Non valutabilità/limiti:** valori stimati, quote non note e categorie aggregate non danno una misura di rischio/correlazione. Il numero di categorie non produce punti. Debiti ignoti impediscono il netto, non necessariamente la composizione lorda completa.
- **Ammesso:** «Una parte elevata è nella stessa attività da cui deriva il reddito». **Vietato:** ordinare vendite, suggerire quote ideali o premiare metalli/ETF/immobili/cripto.

R-E-02 distingue **STRUTTURA_DESCRITTA** (neutro), **DA_APPROFONDIRE** e **NON_VALUTABILE**. Nessun PRESIDI_DICHIARATI nell'area E in V1: assenza di alert e inventario compilato non dimostrano un presidio. Le altre aree mantengono PRESIDI solo con i requisiti favorevoli espliciti delle rispettive regole. Stato, fatti favorevoli locali e disponibilità dei dati rimangono separati.

### F — Pianificazione e consapevolezza

- **Obiettivo/misura:** obiettivi, controllo periodico, attenzione alle risorse di lungo periodo, comprensione dichiarata dei costi e risposta a piccoli quesiti pratici.
- **Indicatori:** I-F01 obiettivi/revisione, I-F02 costi e stile decisionale, I-F03 risposte ai quesiti, I-F04 verifica previdenziale; contesto facoltativo X09–X11 senza voto aggiuntivo.
- **Indispensabili:** RP-F01/F02/F03/F05/F06; F04 se investimenti applicabili. **Facoltativi:** X06 v2, X07/X08 e X09–X11 per il dossier, senza requisiti aggiuntivi per PRESIDI o profili.
- **Applicabilità:** anche senza investimenti o previdenza complementare. Per pensionati F02 non chiede di aderire a forme previdenziali nuove.
- **Non valutabilità/limiti:** un quesito non misura tutta l'alfabetizzazione; autostima/documenti dichiarati non provano comprensione. Nessun calcolo di pensione adeguata.
- **Ammesso:** «Hai indicato un obiettivo con un orizzonte». **Vietato:** «Sei un investitore esperto», «la tua pensione sarà sufficiente» o trattare delega come incompetenza.

## 5. Risposte, evidenze e adattività

Il catalogo definisce cinque stati distinti: valore, non so, preferisco non rispondere, non applicabile validato, non ancora risposto. Zero è un valore. Applicabilità indeterminata e domanda inattiva sono metadati del percorso, non valori da sostituire con zero.

Qualità delle evidenze e completezza sono due informazioni diverse. Un importo stimato può essere completo ma impreciso; una fascia larga può risolvere solo un segnale. Non si assegna una probabilità di verità. Si distinguono dato puntuale riportato, stima, fascia, dichiarazione qualitativa, incoerenza e data di riferimento; anche un dato copiato da un documento non è verificato da Horyzon.

Il percorso ordinario contiene **29 ID di base** (4 contesto, A5/B4/C4/D2/E4/F6), di cui alcuni condizionali; **11 approfondimenti** separati in 3C (prima 8). Totale 40 ID: X06 v2 arricchisce il dettaglio preesistente, X09/X10/X11 colmano lacune non già raccolte. In uno scenario semplice senza debiti/investimenti appaiono circa 25–26 quesiti; il massimo ordinario è 29, invariato. Sono prompt, non singoli campi: matrici e fino a tre obiettivi richiedono tempo effettivo da misurare. Non esigere il modulo facoltativo per il risultato o un profilo migliore.

Dopo l'evento si possono rivedere risposte e aggiungere approfondimenti, preservando le precedenti revisioni e la loro data. Nessuna ricompilazione obbligatoria integrale, nessun miglioramento automatico «per aver partecipato». Il confronto storico richiede stesso perimetro, definizioni e versioni compatibili; i flussi di periodi sovrapposti non sono osservazioni indipendenti.

FERMI può essere determinabile senza X04 mediante H-PQUAL e i requisiti ordinari del [registro profili](radar-patrimoniale-v1-scoring.md). Si espone la prevalenza di liquidità **dichiarata**, senza convertirla in una percentuale; H-P80 resta il distinto canale quantitativo facoltativo. Obiettivi temporizzati, fabbisogno corrente e accantonamenti impediscono di trattare automaticamente la sola cassa come «inerzia». Un tratto osservato non equivale a profilo prevalente: candidati indeterminati e profili misti restano espliciti.

### Due livelli di raccolta e risultato

| Livello | Contenuto disponibile | Limiti da dichiarare |
| --- | --- | --- |
| Radar ordinario | 29 ID adattivi, sei aree, indicatori supportati, evidenze favorevoli e approfondimenti, eventuale profilo educativo. Risultato immediato anche con dati parziali | B02/B03 richiedono solo una disponibilità aggregata/fascia se la persona vuole indicarla; non è richiesto l'inventario monetario completo. A, N e distribuzione possono non essere calcolabili: spiegare input mancanti, non fabbricare totali |
| Approfondimento patrimoniale e obiettivi | X04 valori delle attività, X05 residuo, A/N quando calcolabili, quote con inventario completo e A>0; X01–X03/X06–X11 aggiungono contesto secondo scelta. X06 v2 ordina fino a tre obiettivi, X09 risorse/vincoli comuni, X10 esperienza/aspettative, X11 utilità e coinvolgimento futuro | Nessun obbligo di X04 per gli obiettivi, di importi per il colloquio o di modulo completo per il risultato. Disponibilità dichiarata non è capacità verificata; nuova revisione conserva storico/input/versioni |

I due livelli non corrispondono a cliente e operatore: l'operatore vede anche i mancanti di un ordinario, il cliente riceve una sintesi fedele anche di un approfondito. Nessun obbligo di comunicare tutto il patrimonio per ottenere il risultato educativo.

X09 riprende L/P una sola volta e distingue Cmin (quota attuale da preservare, incluso P), G0 (quota attuale eventualmente destinabile dichiarata) e G_i attribuite dalla persona, senza duplicare G0 su ogni obiettivo. Gli eventuali confronti sono descrittivi, non capitale investibile o riserva adeguata. Risorse illiquide/future non vengono aggiunte a G0. X10 descrive il rispondente e non tutti i membri del nucleo; X11 non modifica la modalità attuale F03 o la richiesta di prenotazione. F01 e altri dati si correggono solo con revisione esplicita; contraddizioni pertinenti sospendono le letture incompatibili, non vengono ignorate.

## 6. Forma del risultato: struttura informativa, non layout

1. **Fotografia:** unità, data stock, finestra flussi, ruoli e limiti del perimetro; esempio «Le risposte descrivono il vostro bilancio condiviso».
2. **Sei dimensioni:** struttura radiale a sei settori, ciascuno con stato, evidenza e copertura; contratto sotto. Nessun poligono che rappresenti assenze come zero o distanze prive di unità. La realizzazione grafica è rinviata.
3. **Indicatori:** valori/intervalli e denominatori comprensibili; non «punteggio patrimonio».
4. **Punti di forza:** fatti favorevoli supportati, con limiti locali.
5. **Vulnerabilità:** segnali distinti dalle semplici cose non conosciute; nessuna diagnosi di crisi personale.
6. **Completezza:** conteggio dei blocchi necessari risolti, mancanti e non applicabili; qualità separata.
7. **Patrimonio:** distribuzione solo se categorie complete e denominatore positivo; altrimenti elenco parziale esplicitamente tale. Netto soltanto con debiti conosciuti.
8. **Profilo educativo:** prevalente, misto o non determinabile; facoltativo per la persona, sempre spiegato, separato dalla scelta all'evento.
9. **Questioni da approfondire:** domande concrete legate alle evidenze; nessuna operazione finanziaria prescritta.
10. **Evoluzione:** solo confronti comparabili, variazioni delle risposte e loro limiti; niente attribuzione causale all'evento o al servizio.

Testo introduttivo proposto: «Questa è una fotografia delle informazioni che hai indicato. Dove mancano dati, lo segnaliamo. Le letture aiutano a capire quali domande approfondire; non decidono acquisti, vendite o prodotti per te».

### Contratto informativo radiale, comune alle due viste

Sei settori di uguale ampiezza e raggio fisso, nell'ordine A Equilibrio economico, B Liquidità e sicurezza, C Indebitamento, D Protezione, E Struttura patrimoniale, F Pianificazione e consapevolezza. La geometria identifica le dimensioni, **non** salute, completezza o ricchezza. Nessuna coordinata derivata da ATTENZIONE/PRESIDI/STRUTTURA_DESCRITTA; niente poligono, media, riempimento percentuale o area proporzionale alle risposte.

Ogni settore contiene: ID/nome dimensione; stato descrittivo con etichetta comprensibile; evidenza principale valida con relativo limite; disponibilità ordinaria «n blocchi su d, u con applicabilità da chiarire»; necessità di approfondimento con motivo o «nessun aspetto specifico emerso nei dati disponibili». Quest'ultima frase non certifica assenza di rischio. In mancanza di evidenza: «Informazioni insufficienti», motivo e dati utili; il settore rimane visibile. Evidenza scelta secondo le priorità deterministiche, mai convenienza commerciale; altre evidenze materiali rimangono nella sintesi accanto al Radar, non vengono tagliate dall'unico richiamo per settore.

Etichetta accessibile completa, esempio: «Struttura patrimoniale. Struttura descritta. Composizione dichiarata disponibile, adeguatezza non valutata. Quattro blocchi su quattro; importi patrimoniali non forniti». Tabelle/elenco testuale adiacenti riportano le stesse sei dimensioni e informazioni, leggibili senza colore, grafica, movimento o puntamento. Colore solo ridondante; stati distinti anche per testo/simbolo con legenda, controlli eventualmente interattivi utilizzabili da tastiera. Tema chiaro/scuro e reduced motion non cambiano il significato. Nessuna pagina viene disegnata in 3B.

### Sintesi cliente e scheda interna

La sequenza sopra descrive il risultato comune completo, non dieci blocchi da esporre automaticamente alla persona. `ClientResultProjection`: fotografia breve, sei settori, uno/due punti di forza **se supportati**, principali approfondimenti e mancanti materiali, invito facoltativo al colloquio. `AdvisorResultProjection`: medesime conclusioni con risposte/revisioni, importi disponibili, formule, perimetri, motivi e domande per il colloquio. Identità, evento e responsabile sono contesto operativo separato dai predicati diagnostici. Dettagli economici nel database Horyzon protetto; nessun loro trasferimento in note CRM generiche, email o URL. Accesso ai dati della persona attraverso un percorso distinto e autorizzato. Specifica completa nella [doppia vista](radar-patrimoniale-v1-doppia-vista.md).

## 7. Motore interpretativo e uso eventuale dell'AI

V1 proposta: calcolo, evidenze e testi essenziali deterministici. Ogni conclusione porta ID regola, ID risposte/revisioni, formula se presente, valore/intervallo, contesto, mancanti e versione del testo. Lo stesso insieme di evidenze produce le stesse conclusioni. Le correzioni aggiornano il risultato, senza riscrivere silenziosamente quello storico.

AI soltanto come ipotesi successiva (DEC-07), disattivata per la baseline proposta: riceverebbe evidenze già calcolate e minimizzate, mai dati identificativi o campi liberi familiari. Può riformulare un elenco autorizzato di affermazioni; non aggiungere numeri, soglie, diagnosi, classificazioni o strumenti. Ogni frase deve citare un'evidenza presente; controllo di numeri/affermazioni, blocco raccomandazioni e fallback al testo deterministico in caso di errore, timeout o contenuto non consentito. Il testo AI non diventa prova. Nessun invio a provider in questa fase.

## 8. Minimizzazione e rischi di interpretazione

Non raccogliere nome/recapiti per fare i calcoli; nessun IBAN, credenziale, identificativo familiare, nome del datore/consulente, indirizzo dell'immobile, diagnosi o testo sanitario. Le responsabilità sono categorie economiche; nessun campo libero necessario. Niente documenti caricati o screenshot di conti. La scheda interna può collegare l'identità già autorizzata del contatto mediante relazione server verificata, senza nuove domande personali o usare email come autorizzazione. L'analisi non segmenta la persona per vendite/commissioni. Il futuro confronto con un catalogo di soluzioni è separato dal motore, solo potenziale pertinenza da verificare e mai raccomandazione individuale automatica; contratto nella doppia vista. Scelte di accesso, finalità e conservazione richiedono approvazione e successiva implementazione dedicata.

Effetti da verificare: memoria selettiva, desiderabilità sociale, incomprensione di netto/lordo, confusione fatturato/reddito, stagionalità, arrotondamenti, quote di proprietà, sovrastima di liquidabilità, conoscenza sopravvalutata, patrimonio d'impresa sovrastimato e soglie percepite come prescrizioni. Le fasce migliorano la minimizzazione ma riducono la precisione. La frequenza dei «non so» è un segnale di disponibilità dei dati, non un difetto personale.

## 9. Decisioni proposte e approvazioni necessarie

| ID | Proposta | Approvazione prima della realizzazione |
| --- | --- | --- |
| DEC-01 | Singolo/nucleo scelto esplicitamente; niente rapporti fra perimetri parziali incompatibili | Product owner e revisore metodologico |
| DEC-02 | Valutazioni descrittive; nessun 0–100 e nessuna media/indice globale | Product owner; eventuale futuro score richiede nuova validazione |
| DEC-03 | Fasce/intervalli, soglie H sperimentali e gestione prudente delle frontiere | Revisore metodologico; pilot di sensibilità e comprensione |
| DEC-04 | 29 ordinari +11 facoltativi in 3C (prima 8); durata 5–8 minuti solo ipotesi per ordinario | Ricerca utenti; misurare anche carico dei campi facoltativi e adeguare durata/flusso ai dati reali |
| DEC-05 | Profili narrativi facoltativi, non gerarchici, misti/indeterminati consentiti | Product/editoriale; verifica che non vengano percepiti come giudizi |
| DEC-06 | Perimetro educativo, minimizzazione, informative e modalità d'uso del risultato | Responsabili del servizio, privacy e professionisti competenti; non è un'autorizzazione già ottenuta |
| DEC-07 | Nessuna AI necessaria in V1; eventuale sola spiegazione vincolata | Decisione separata su utilità, qualità, dati e fornitori |
| DEC-08 | Previdenza solo informativa/processuale; verifica diretta aggiornata COVIP prima dei testi definitivi | Revisore previdenziale; chiudere limite di accesso S09 |
| DEC-09 | Due proiezioni autorizzate dello stesso risultato; sintesi materiale fedele e accesso separato ai dati | Responsabili servizio/privacy/sicurezza; policy dei ruoli, assegnazioni e revoche da approvare |
| DEC-10 | Compatibilità con catalogo versionato separata dalla diagnosi e riservata alla valutazione umana | Professionisti competenti per ciascuna categoria, responsabili servizio/privacy; nessuna attivazione automatica |
| DEC-11 | Modulo obiettivi facoltativo, 29+11 ID, X06 v2 e tre obiettivi complessivi; R-G descrittive, cinque esiti catalogo | Product/metodologia/ricerca utenti e privacy/professionisti: utilità dei campi, carico reale, rispondente/nucleo, confine delle valutazioni e nessun nuovo uso commerciale implicito |

## 10. Criteri di accettazione e prossimi studi

- Ogni domanda ha tutti i campi richiesti; dipendenze acicliche; cambio a monte disattiva conclusioni obsolete. Stesso ID non cambia significato senza versione nuova.
- Ogni formula è ricostruibile dalle sole risposte; nessuna imputazione, midpoint o valore nazionale sostitutivo. Nessun risultato infinito per denominatore nullo.
- Sei valutazioni locali motivate, copertura/qualità separate, evidenze sfavorevoli non compensate dalla ricchezza. Area non valutabile visibile.
- La specifica corrente comprende 22 simulazioni (14 diagnostiche conservate + G01–G08) e 40 controprove (28 della 3B + CT-29–40). Attese progettuali, non performance software; controllo della coerenza senza inventare dati per la persona.
- Pilot proposto: 12–18 interviste cognitive con ruoli e perimetri differenti, poi prova temporizzata indicativamente >=50 persone, stratificata per alfabetizzazione/perimetro/reddito variabile. Sono numerosità operative proposte, non garanzia di potenza statistica.
- Accettazione tempi proposta: mediana ordinario <=8 minuti; registrare P75, interruzioni e richieste di aiuto; se P75 supera 8 minuti, rivedere il percorso o dichiarare una durata diversa. Le matrici opzionali non entrano nel tempo pubblicizzato.
- Impatto 3C non misurato: solo X11 circa 20–45 secondi; un obiettivo essenziale con X11 circa 45–90 secondi; modulo con risorse/vincoli e parte esperienza circa 2–4 minuti; dettaglio massimo circa 4–7 minuti o più, oltre l'ordinario. Contare campi/righe e ricerca esterna, non soltanto i tre nuovi ID. Modalità minima e rinvio facoltativo al colloquio nella specifica obiettivi.
- Prima dell'uso pubblico: risolvere le confusioni sistematiche emerse, revisione indipendente di soglie e linguaggio, verifica perimetro/periodo; non discriminare per mancata disponibilità di dati o ruolo. Soglie e tassi d'errore non validati devono restare espliciti.
- La Fase 3 ha introdotto quattro Markdown; la 3B aggiorna solo quelli e aggiunge decisioni/doppia vista in docs/patrimonial. Nessuna pagina, API, scoring eseguibile, migrazione o integrazione; nessun contatto reale, push o deploy.
- La 3C aggiorna solo cinque specifiche correnti e aggiunge la profilazione obiettivi; il registro storico 3B resta intatto. Nessuna modifica al percorso ordinario, alle formule A–F o al confine dei due risultati; classificazione preliminare del catalogo distingue incompatibilità e non pertinenza, con cinque esiti e nessuna proposta individuale automatica.

## 11. Verifiche della consegna documentale

La Fase 3 ha controllato 37 ID (29+8), 14 casi e 20 controprove. La revisione 3B conserva domande e formule, aggiorna i casi interessati e porta le controprove a 28. I controlli documentali di consegna sono registrati nelle [decisioni 3B](radar-patrimoniale-v1-decisioni-fase-3b.md); l'accessibilità del futuro Radar e le autorizzazioni restano criteri da collaudare in implementazione.

Il diff 3B rispetto a `67911bf` è limitato ai sei documenti autorizzati: nessun sorgente applicativo o file delle assegnazioni modificato. I contratti delle assegnazioni disponibili nel checkout originale sono stati consultati in sola lettura, senza importarli. Non sono stati rieseguiti build e suite applicative perché non è stato cambiato codice; i risultati 2B sono evidenza storica separata. Il controllo documentale non è esecuzione del futuro motore, validazione psicometrica né approvazione professionale. Il commit locale dedicato è identificato nella consegna finale.

Per la 3C si verificano 40 ID, invarianza dei 29 ordinari e delle formule, versionamento X06, riferimenti/dipendenze e coerenza di 22 simulazioni/40 controprove. Controlli di consegna e limiti nella [profilazione obiettivi](radar-patrimoniale-v1-profilazione-obiettivi.md). Nessun test applicativo o browser eseguito per il diff documentale; nessuna prova di autorizzazione remota o validazione scientifica implicita.
