# Radar Patrimoniale V1 — Decisioni e revisione Fase 3B

Versione **RP-DEC-3B-1.0-draft**, 18 ottobre 2026. Riferimento iniziale verificato: `67911bfe12c5b9ed78eca0ef5195c266416c8e66`, branch `feat/radar-patrimoniale-v1`, worktree `C:/Users/emanu/.codex/worktrees/radar-patrimoniale-v1/horyzon-website` inizialmente pulito. Revisioni documentali coordinate 1.1, non validazione scientifica o collaudo software.

Documenti: [metodologia](radar-patrimoniale-v1-metodologia.md), [questionario](radar-patrimoniale-v1-questionario.md), [regole](radar-patrimoniale-v1-scoring.md), [casi](radar-patrimoniale-v1-profili-test.md), [doppia vista](radar-patrimoniale-v1-doppia-vista.md).

## 1. Decisioni confermate e nuova finalità di prodotto

Conservati sei dimensioni, 29 domande ordinarie adattive e 8 approfondimenti, ID stabili, definizioni/periodi, formule, fasce senza midpoint, perimetri espliciti, mancanti distinti e risultati parziali. Nessun 0–100, indice globale, peso, portfolio consigliato o trasferimento dello scoring aziendale. Nessun dato personale/finanziario reale utilizzato.

Confermata la proposta di motore deterministico con evidenze/versioni e AI non necessaria. I profili restano facoltativi, non gerarchici, misti/indeterminati ammessi. Contatti/evento/responsabile non entrano nei predicati e non migliorano alcuna area.

La decisione di prodotto aggiunta dall'utente rende centrale la preparazione del lavoro Horyzon: **Client Result** e **Advisor Intelligence** sono due proiezioni autorizzate della stessa analisi. Il risultato cliente minimizza i dettagli senza nascondere fatti materiali; la scheda interna approfondisce soltanto entro l'autorizzazione effettiva. Nessun secondo motore o secondo insieme di risposte.

## 2. Correzioni mirate e motivi

| ID di revisione | Problema della 1.0 | Decisione 3B ed effetto |
| --- | --- | --- |
| D3B-01 | FERMI dipendeva obbligatoriamente da X04 facoltativo | H-PQUAL usa sola cassa nell'inventario completo o E02 liquidità nella banda alta; H-P80 rimane canale quantitativo facoltativo. Entrambi richiedono contesto di riserva/fabbisogno, B04, A03 e obiettivi. Nessuna percentuale dedotta dalla banda qualitativa |
| D3B-02 | Tratto osservato, candidato e profilo finale potevano essere confusi | Distinti tratto, eleggibilità vero/falso/indeterminato, base qualitativa/quantitativa, prevalente/misto/non determinabile. Conferma quantitativa descrive il predicato, non una verifica esterna |
| D3B-03 | CT-13 poteva escludere l'intera area E senza attività, nascondendo D>0 | Solo composizione/quote N/A. A=0 confermato e D=5.000 danno N=−5.000 ed E DA_APPROFONDIRE. Debito aperto noto con residuo ignoto mantiene approfondimento e N non calcolabile; nessuna diagnosi creditizia |
| D3B-04 | R-E-02 trattava assenza di alert come presidio positivo | Introdotto STRUTTURA_DESCRITTA neutro per E. Nessun PRESIDI_DICHIARATI in E V1; nelle altre aree solo requisiti favorevoli espliciti. Netto interamente negativo è evidenza da approfondire, non da compensare con altre aree |
| D3B-05 | Il futuro Radar poteva diventare uno score grafico implicito | Sei settori fissi con nome/stato/evidenza/copertura/approfondimento; nessun raggio numerico, poligono o area che rappresenti salute o disponibilità dati |
| D3B-06 | Ordinario/approfondito poteva confondersi con cliente/operatore | Sono due assi distinti. Entrambe le viste possono rappresentare dati ordinari o approfonditi, anche parziali, con identiche conclusioni |
| D3B-07 | Durata 5–8 minuti non misurata e prompt con molti campi | Target esplicitamente non verificato. Analisi dei passaggi lenti nel questionario, aiuti/ordine più chiari e piano di misurazione senza togliere dati necessari |
| D3B-08 | Fonti COVIP del 2026 non direttamente consolidate | Ricontrollato registro istituzionale, mantenuto limite S09. Nessuna regola previdenziale/fiscale, rendimento o età introdotti. DEC-08 ancora aperta |
| D3B-09 | Sintesi cliente e dossier interno non definiti | Allowlist delle due proiezioni, stessa fotografia/versione, granularità distinta, dettagli nel database protetto, percorso separato per i diritti e controlli su assegnazione corrente |
| D3B-10 | Possibile confusione fra diagnosi e proposta Horyzon | Contratto di un catalogo futuro separato/versionato con quattro esiti, incompatibilità/mancanti espliciti e verifica professionale; nessun incentivo di vendita o raccomandazione individuale automatica |

R-E-02 non cambia formule: A−D resta l'identità proposta. A=0 strutturale può derivare dall'inventario che esclude tutte le attività non previdenziali, confermato completo e coerente con B02=0; non occorre obbligare X04 a elencare zeri. Non si estende questa deduzione a inventari mancanti o parziali. D=0 conserva i requisiti specifici C01/C03 e assenza di altri debiti aperti.

## 3. Alternative considerate e scartate

| Alternativa | Perché scartata |
| --- | --- |
| Rendere X04 obbligatorio o aggiungere nuove domande per FERMI | Imporrebbe il patrimonio completo per un risultato educativo; il catalogo ordinario contiene già un tratto qualitativo utile |
| Trasformare E02 «tre quarti o più» in qL>=80% | Percentuali diverse e strumenti di misura diversi; falsa precisione. Il 75–<80% può sostenere il solo canale qualitativo, esplicitamente etichettato |
| Abbandonare ogni profilo senza inventario monetario | Perderebbe letture ordinarie supportate e sospenderebbe inutilmente altre classificazioni. Rimane necessaria X04 per una conferma quantitativa non già deducibile da zeri strutturali |
| Classificare FERMI per la sola cassa | Ignorerebbe riserva, accantonamenti, obiettivi e necessità vicine. Nessuna indicazione «cassa eccessiva» o surplus investibile |
| E intera N/A con A=0 | Nasconderebbe debiti e netto negativo; non applicabilità della composizione non equivale a assenza di posizione economica |
| Conservare PRESIDI come sinonimo di inventario compilato | Comunicherebbe approvazione non dimostrata. Stato neutro aggiunto senza uno score o una scala più complessa |
| Un voto per disegnare il poligono Radar | Distanze artificiali fra categorie; la riconoscibilità radiale non richiede coordinate quantitative |
| Due motori o ricalcolo più favorevole per il cliente | Divergenza delle conclusioni e perdita di tracciabilità. Le viste selezionano/dettagliano lo stesso risultato |
| Nascondere nel browser i dettagli già inviati | Non protegge i dati. Proiezione minima prodotta entro il confine autorizzato |
| Usare owner CRM/email del browser come permesso | Non prova l'assegnazione effettiva e confonde identificatori interni/remoti; necessaria autorità server corrente |
| Inserire il dossier nel CRM o una graduatoria di prodotti per commissioni | Diffusione non necessaria e conflitto con la finalità di analisi; solo sintesi operativa minima e confronto separato con verifica umana |

## 4. Regole ancora sperimentali e rischi residui

Restano Horyzon non validate: H-B1/H-B3 (1 e 3 mesi), H-E75 (concentrazione percepita marcata), H-P80 e nuovo H-PQUAL (canali narrativi), H-F12 (recenza), condizioni dei profili, stati favorevoli locali e ordine delle priorità. Le formule contabili sono riproducibili sulle definizioni scelte ma non validano queste soglie. Mantenere versione e base di evidenza nei risultati futuri.

Rischi principali: «presidio dichiarato» percepito come certificato; stato neutro percepito come insufficienza; FERMI interpretato come invito a investire; assenza di un obiettivo dichiarato confusa con assenza di bisogni reali; dati puntuali confusi con dati verificati; patrimonio netto negativo interpretato come insolvenza; riepilogo cliente troppo breve che omette un limite; operatori che trasformano ipotesi in fatti; assegnazioni obsolete che mantengono accessi; confronto con catalogo percepito come raccomandazione. Le cautele testuali non sostituiscono prove di comprensione e controlli effettivi.

Per FERMI, H-PQUAL e H-P80 sono un'alternativa dichiarata, non due voti. Discordanze realmente incompatibili richiedono chiarimento, mentre qL=79% e banda percepita >=75% possono coesistere. Mancata esecuzione di X04 non rende falso un canale quantitativo: lo lascia non svolto/indeterminato e non impedisce l'altro canale vero. Requisiti comuni mancanti restano indeterminati anche con X04 completo.

## 5. Contratto informativo del Radar grafico

Sei settori di dimensione uguale, ordine A–F e geometria fissa. Per ciascuno: dimensione, stato descrittivo, evidenza principale e limite, disponibilità ordinaria n/d con applicabilità incerta separata, approfondimento e motivo. Settore presente anche senza dati. Stato neutro e non valutabilità con etichette esplicite; nessun raggio/riempimento proporzionale o poligono quantitativo.

Accessibilità: nome completo e informazione equivalente in elenco/tabella, lettura senza colori, legenda dei simboli, ordine lineare A–F, eventuali controlli da tastiera. Riduzione movimento e cambio tema non tolgono informazioni. L'evidenza principale segue le priorità del motore e non elimina ulteriori fatti materiali. Il [contratto metodologico](radar-patrimoniale-v1-metodologia.md) è la definizione completa; nessuna pagina o mockup creati.

## 6. Ordinario, approfondimento e due proiezioni

| Scelta | Cosa cambia | Cosa resta identico |
| --- | --- | --- |
| Ordinario → approfondito | Dati opzionali, precisione, A/D/N e distribuzione solo quando supportati; nuova revisione e storia conservata | Sei dimensioni, formule, definizioni e nessuna imputazione; nessun obbligo patrimoniale per il risultato educativo |
| Cliente → operatore autorizzato | Granularità: breve sintesi contro dossier con risposte, revisioni, importi, formule, identità/assegnazione/origine e agenda | Identità della fotografia, stati, evidenze, candidati e limiti materiali |
| Risultato → modulo soluzioni futuro | Confronto separato con catalogo verificato/versionato e giudizio umano | Il risultato diagnostico non cambia in base a catalogo, ricavi o commissioni |

Il cliente non riceve automaticamente tutte le cifre, ma la riduzione non limita l'accesso autorizzato ai propri dati. Il responsabile proviene dalle assegnazioni effettive; nessuna risoluzione per email o ID del browser. HighLevel riceverebbe solo disponibilità/riferimento opaco e minimo contesto operativo autorizzato, mai profili o dettagli economici. Modalità e quattro esiti del catalogo sono nella [doppia vista](radar-patrimoniale-v1-doppia-vista.md).

## 7. Riesame fonti e stato delle evidenze

Registro S01–S12 ricontrollato nella metodologia: dieci riferimenti direttamente accessibili; S06 e S09 limitati a indicizzazione istituzionale nei tentativi 3B. S01 confermato nella scheda e nel PDF ufficiali. S09 non chiuso: aggiornamenti 2026 individuati e avvisi di revisione ancora presenti, apertura diretta non riuscita. Non si promuove una guida identificata come aprile 2026 a testo consolidato dopo le novità successive.

Per il nuovo contratto sono consultati anche il testo primario GDPR su EUR-Lex e la documentazione ufficiale Supabase RLS, collegati nella doppia vista. Sono riferimenti di progettazione, non audit privacy o verifica remota. Nessun nuovo parametro normativo o investimento individuale deriva da questa lettura. Il tentativo di leggere l'indice changelog Markdown Supabase non è stato supportato dal lettore web; nessuna implementazione/API o dipendenza viene introdotta sulla sua base.

## 8. Simulazioni, controprove e controlli documentali

**Esito progettuale:** le 14 simulazioni sono mantenute. T01/T02/T04/T06/T09/T10/T12 hanno E S anziché P; le altre sette mantengono E D/NV. Nessun input o importo delle 14 fixture cambiato, nessun profilo originario alterato. CT-13 e CT-17 correggono rispettivamente non applicabilità e logica dei canali FERMI; le altre controprove conservano i comportamenti utili.

**Otto controprove aggiunte:** CT-21 ordinario FERMI; CT-22 canale/conferma quantitativa e incertezza; CT-23 A=0/D>0 con indipendenza dei flussi; CT-24 struttura descritta senza falsa positività; CT-25 misto qualitativo più AFFIDA e obiettivo vicino; CT-26 parità/materialità delle proiezioni; CT-27 assegnazione/revoca; CT-28 catalogo e assenza di incentivi. Le 28 righe sono attese documentali, non risultati PASS di un motore eseguito.

Controlli documentali eseguiti con esito conforme: 37 ID unici e invariati (29+8); campi di catalogo e riferimenti definiti; 14 fixture, 28 controprove uniche nella tabella dedicata, accordo fra testi e tabella degli stati; righe delle formule, input e calcoli pubblicati delle fixture preservati rispetto a `67911bf`; 37 link Markdown locali risolti; nessun whitespace finale; diff limitato ai sei Markdown. Ricontrollo aritmetico separato: 12 fixture puntuali, T11 senza rapporti del nucleo, inviluppi T14 e frontiere CT-04/13/22/23 coerenti. Gli script di controllo sono stati eseguiti temporaneamente dalla shell, senza aggiungere codice al repository o implementare un classificatore.

Nessun test applicativo/build/browser eseguito per questo diff solo documentale; le verifiche delle proiezioni, autorizzazioni e grafica saranno obbligatorie in implementazione, non sono dichiarate eseguite ora. Le 28 controprove restano attese ragionate, non 28 test software PASS. Controllo Git finale e commit locale documentale sono riportati nella consegna.

Nel checkout originale è stata osservata attività concorrente successiva alla lettura iniziale: file delle assegnazioni/store/sync modificati e nuovi file owner-sync/migrazione/temporanei. Nessuno di questi file è stato modificato, spostato, consolidato o importato da questa attività; non si dichiara il checkout immobile mentre un altro lavoro vi prosegue. L'isolamento del worktree Radar permette di completare la consegna documentale senza riconciliare quel lavoro.

## 9. Accettazione futura e approvazioni umane

Prima della realizzazione: revisione indipendente dei predicati corretti e dei casi, prove cognitive sul linguaggio degli stati e su FERMI, tempi misurati del percorso (5–8 minuti non verificati), chiusura della verifica previdenziale. Le fonti non certificano il Radar.

Accettazione tecnica futura: parità delle proiezioni sullo stesso risultato, materiale cliente non omesso, assenza di dettagli Advisor nei payload cliente, prove di isolamento fra contatti/operatori e revoche, storico comparabile, catalogo con quattro esiti e incompatibilità/mancanti espliciti. Il Radar a sei settori deve restare comprensibile senza colori e punteggi; nessun trigger commerciale o owner write da completamento. Criteri dettagliati nella doppia vista.

| Decisioni ancora da approvare | Figure competenti / contenuto |
| --- | --- |
| DEC-01–05, D3B-01–07 | Product owner/revisione metodologica e ricerca utenti: perimetro, soglie/canali, neutralità, profili, durata e comprensione |
| DEC-06, DEC-09 | Responsabili servizio/privacy/sicurezza: finalità e basi giuridiche, informative, collegamento identità, bilanci condivisi, ruoli/deleghe/revoche, diritti, retention/export/audit e minimizzazione CRM |
| DEC-08 | Professionista previdenziale: fonti vigenti direttamente verificate e testi definitivi; nessuna cifra normativa adottata ora |
| DEC-10 | Figure abilitate secondo ogni soluzione/categoria: classificazione, rischi/costi/vincoli, condizioni di incompatibilità, processo di proposta e conflitti. Il catalogo non autorizza la consulenza |
| DEC-07 | Eventuale AI futura: utilità, qualità, dati e fornitori; resta fuori dalla baseline proposta |

Queste sono approvazioni necessarie **prima dell'uso/implementazione pertinente**, non permessi mancanti per completare le specifiche. La consegna si ferma alla documentazione: nessun codice, Radar d'Impresa, funnel, asset, schema, migrazione, flag, CRM o assegnazione modificati; nessun push o deploy.
