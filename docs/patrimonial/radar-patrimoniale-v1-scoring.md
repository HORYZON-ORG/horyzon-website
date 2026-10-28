# Radar Patrimoniale V1 — Indicatori, valutazione e interpretazioni

Versione **RP-RULES-1.2-draft**, Fase 3C del 18 ottobre 2026, baseline `e11a31b9903fdb8efff31f6d9153bafe6dd854f9`. Specifica metodologica, **nessuna implementazione di scoring**. [Metodologia/fonti](radar-patrimoniale-v1-metodologia.md), [catalogo](radar-patrimoniale-v1-questionario.md), [casi](radar-patrimoniale-v1-profili-test.md), [decisioni storiche 3B](radar-patrimoniale-v1-decisioni-fase-3b.md), [due viste](radar-patrimoniale-v1-doppia-vista.md), [obiettivi](radar-patrimoniale-v1-profilazione-obiettivi.md). Formule e regole diagnostiche A–F/PN della 3B conservate; nuovi controlli R-G soltanto descrittivi del dossier.

## 1. Decisione: nessun voto globale né 0–100 in V1

I costrutti non sono intercambiabili: una casa di valore non compensa rate arretrate, la comprensione dei costi non produce liquidità, il patrimonio ridotto non dimostra cattiva pianificazione. Mancano calibrazione, pesi validati e un costrutto comune che giustifichi la somma. Pertanto: **nessuna media fra le sei aree, nessun peso, nessun percentile di salute patrimoniale**. Non si trasferisce la normalizzazione Likert del Radar d'Impresa.

Le sei valutazioni sono descrittive e hanno la stessa dignità informativa, non una distanza numerica. Non assegnare in fase grafica 0/25/50/75/100 a questi stati: sarebbe uno scoring implicito non approvato. Presentare sei aree con evidenze e limiti; un futuro grafico quantitativo richiederebbe nuova specifica e validazione.

| Stato | Significato ammesso |
| --- | --- |
| ATTENZIONE | Esiste almeno un segnale economico sfavorevole specifico e supportato dalle risposte, secondo le regole H sotto |
| DA_APPROFONDIRE | Aspetto contestuale da verificare, pratica non definita o intervallo che non permette una lettura unica; non equivale a emergenza |
| PRESIDI_DICHIARATI | Le condizioni locali osservate soddisfano i criteri proposti, con dati necessari disponibili; non certifica sicurezza, adeguatezza o veridicità |
| STRUTTURA_DESCRITTA | Le informazioni necessarie descrivono la struttura osservata; non emerge una condizione di approfondimento prevista, ma non sono dimostrati presidi favorevoli. Stato neutro, utilizzato in E |
| NON_VALUTABILE | Mancano basi necessarie, applicabilità non risolta o coerenza sufficiente; riportare comunque singoli fatti utilizzabili |
| NON_APPLICABILE | Esclusione strutturale verificata di una componente, con motivo. In V1 nessuna delle sei aree intere è esclusa automaticamente: composizione senza attività N/A, ma E resta visibile; assenza di debiti non esclude C |

Stato, completezza, qualità e priorità sono campi separati. ATTENZIONE può essere valido anche con copertura parziale se il fatto che lo giustifica è noto; NON_VALUTABILE non deve nascondere arretrati conosciuti. Un rifiuto di risposta non genera da solo ATTENZIONE o DA_APPROFONDIRE.

**Controllo della positività (3B):** A richiede avanzo e contesto R-A-03; B riserva e risposta allo scenario R-B-03; C assenza esplicita di debiti/ritardi oppure pagamenti e contesto descritti R-C-03; D strategie/limiti dichiarati controllati R-D-02; F pratiche e risposta pratica R-F-02. Non basta che la regola sfavorevole sia falsa o indeterminata. E non assegna PRESIDI_DICHIARATI in V1: inventario, liquidabilità e assenza dichiarata di esposizioni comuni non provano adeguatezza o diversificazione effettiva. Eventuali fatti favorevoli locali restano citabili separatamente, senza promuovere l'intera area. STRUTTURA_DESCRITTA non è un gradino di salute.

## 2. Dati e notazione

Perimetro coerente e unità scelta RP-S01; S02 COMPLETE per rapporti fra grandezze e netto complessivo. Un dato parziale è pubblicabile solo come tale; non viene promosso a indicatore del nucleo.

| Simbolo | Dato | Fonte e tempo |
| --- | --- | --- |
| Y | Entrate nette mensili medie disponibili | RP-A01, T12; totale annuo /12 se scelto |
| E | Spese mensili medie di cassa senza rate, esclusi investimenti/trasferimenti | RP-A02, T12 |
| R12 | Rate mensili medie effettivamente pagate, capitale + interessi | RP-C02, T12 |
| Rnow | Rate mensili attualmente dovute, anche se non pagate | RP-C04, Tnow |
| K | Budget essenziale mensile attuale senza rate | RP-B01, Tnow |
| L | Somme accessibili a T0 entro sette giorni secondo il quesito | RP-B02 |
| P | Parte di L accantonata per impegni non rinviabili, non già nel budget | RP-B03, T0 |
| Lf | Riserva libera convenzionale L−P | Derivata, con vincolo 0<=P<=L |
| A_j | Valore della macrovoce patrimoniale non previdenziale j | RP-X04, T0; liquidità = stesso L, non un nuovo valore |
| A | Totale attività considerate non previdenziali | Somma A_j, escluso capitale previdenziale vincolato |
| D | Debiti residui riferibili al perimetro, inclusi arretrati dovuti non già compresi nel capitale | RP-X05, T0; nessun doppio conteggio di scaduti; garanzie per altri non sottratte senza debito certo |
| Ymin | Minimo mensile osservato delle entrate nel medesimo T12 | RP-X01 |

Il patrimonio considerato include abitazione principale e quote economiche conosciute, ma non diritti pensionistici futuri, capitale previdenziale vincolato, TFR non noto o valore del lavoro futuro. Non è un bilancio civilistico completo né un aggregato direttamente confrontabile con quello di un'indagine ufficiale. I capitali previdenziali dichiarati possono apparire separatamente come informazione, senza aggiungerli alla riserva o capitalizzare rendite.

### Periodi, valori annuali e reddito variabile

Flussi T12: annuali /12 e mensili medi T12 sono equivalenti se stesso intervallo e definizioni. Tasse/costi di attività già dedotti da Y non tornano in E. Il solo ultimo mese non sostituisce T12; niente moltiplicazione di una buona mensilità per 12 in presenza di dati incompleti.

Tnow e T0 servono alla fotografia attuale. Rnow non sostituisce R12 nel calcolo storico. K+Rnow è il fabbisogno essenziale corrente. Confrontare Rnow con Y medio T12 o Ymin con K attuale è una **lettura indicativa fra periodi diversi**, esplicitata e non una previsione di tenuta futura. Rate non mensili dividono il totale annuo per 12 solo come equivalente: la concentrazione della scadenza resta un limite.

Ymin è un minimo passato, non reddito futuro garantito. Nessuna stima di pensione, rendimento, inflazione futura o probabilità di perdita viene introdotta per colmare dati. Un prelievo dal patrimonio non è reddito corrente; PLANNED_DRAW cambia l'interpretazione del disavanzo, non la sua formula.

### Fasce e intervalli

Una fascia rappresenta l'insieme di valori compatibili, con estremi aperti/chiusi preservati. Non viene sostituita dal centro, da una mediana di popolazione o da una cifra «tipica». Le formule producono un intervallo conservativo. Un segnale è certo rispetto alle risposte solo se vale per **tutte** le combinazioni ammissibili; è possibile se vale per alcune. Un intervallo aperto superiore non viene chiuso artificialmente.

Per grandezze positive con estremi finiti:

- `M = Y−E−R12` ha limiti conservativi `[Y_lo−E_hi−R12_hi, Y_hi−E_lo−R12_lo]`, con gli estremi effettivi coerenti con le fasce.
- `Lf = L−P`, intersecando il dominio con `0<=P<=L`; limiti conservativi `[max(0,L_lo−P_hi), L_hi−P_lo]` quando il dominio non è vuoto. Non usare max per riparare valori puntuali incoerenti.
- Per rapporto N/Z con N>=0 e Z>0: limiti N_lo/Z_hi e N_hi/Z_lo. Se Z può essere zero non si presenta un rapporto numerico che include una divisione indefinita. Estremo infinito può rendere il rapporto soltanto limitato inferiormente o non informativo.
- Per il tasso di margine usare `1−(E+R12)/Y`, non dividere separatamente un M dipendente da Y come se gli input fossero indipendenti.
- Per una quota `A_j / (A_j + somma altre voci)`, limiti `a_lo/(a_lo+altre_hi)` e `a_hi/(a_hi+altre_lo)`; preservare il legame numeratore/denominatore. Se tutti i valori possono essere zero, nessuna quota puntuale.

Un intervallo largo non è evidenza falsa: può essere informazione sufficientemente precisa per un segnale o troppo ampia per decidere una banda. Non chiamarlo intervallo di confidenza. Le risposte qualitative non restringono numericamente le fasce. Se il vincolo P<=L è incompatibile, oppure le definizioni di perimetro non coincidono, l'indicatore coinvolto è non calcolabile con motivo; gli altri non vengono cancellati. M certamente negativo insieme ad A03 COVERED senza spiegazione compatibile richiede chiarimento: nessun dato viene dichiarato confermato scegliendo arbitrariamente fra le due versioni.

Ogni indicatore riporta stato `calcolabile puntuale / calcolabile come intervallo / non calcolabile / non applicabile`, input e revisione utilizzati, periodo/perimetro e motivo del limite. Le osservazioni qualitative non diventano numeri: riportano il loro valore dichiarato e l'eventuale indisponibilità. Questi stati dell'indicatore sono distinti dagli stati descrittivi della valutazione e dai cinque stati della risposta.

## 3. Registro degli indicatori

### I-A01 — Margine di cassa e tasso di margine

- **Formula:** `M=Y−E−R12` EUR/mese; se Y>0, `m=M/Y×100` percentuale. Versione annuale = M×12, soltanto se T12 completo.
- **Input/applicabilità:** A01/A02/C02 e perimetro coerente; R12=0 strutturale solo da C01 esplicito «nessuno» in entrambi i periodi.
- **Missing/estremi:** un input ignoto impedisce il calcolo; Y=0 permette M ma non m. M può essere negativo; non troncare a 0. Y piccolo può dare percentuali molto negative, da mostrare come rapporto con limite esplicito.
- **Limite/giustificazione:** identità di cassa adottata da Horyzon, non tasso di risparmio dei conti nazionali: rate includono capitale, transazioni patrimoniali escluse, valori autodichiarati. M positivo indica avanzo recente, non quanto investire; M negativo con prelievo programmato non prova crisi.

### I-A02 — Copertura delle uscite recenti

- **Formula:** `c=Y/(E+R12)`, volte, medie mensili T12.
- **Input:** come A01, con E+R12>0.
- **Missing/estremi:** denominatore zero → non calcolabile, mai infinito; Y=0 con uscite>0 → c=0. Fasce → intervallo.
- **Limite/giustificazione:** rapporto contabile; c<1 e M<0 descrivono lo stesso squilibrio, **non due voti né due priorità duplicate**. Non aggiunge prova indipendente e non misura sostenibilità futura.

### I-A03 — Dipendenza dalla fonte principale

- **Formula:** quota autodichiarata RP-A05, mantenuta come fascia; nessun importo ricostruito moltiplicandola per una media inventata.
- **Input/applicabilità:** esistenza di entrate e stesso perimetro; fonte non nominativa. Può essere acquisita senza conoscere il totale Y, ma non se le entrate sono realmente nulle.
- **Missing/estremi:** UNKNOWN resta ignoto; nessuna entrata → non applicabile; più fonti non implicano quote uguali.
- **Limite/giustificazione:** indicatore candidato Horyzon di esposizione, non rischio di perdita della fonte. >80% non penalizza da solo una pensione o un contratto stabile.

### I-A04 — Scenario con minimo passato, facoltativo

- **Formula:** `s=Ymin−(K+Rnow)`, EUR/mese; se K+Rnow>0 si può anche mostrare Ymin/(K+Rnow) come rapporto indicativo.
- **Input:** X01/B01/C04; finestre T12/Tnow visibili, non confuse.
- **Missing/estremi:** qualsiasi mancante → non calcolabile; minimo reale 0 ammesso; incoerenza Ymin>Y da chiarire. Mai sostituire Ymin a Y nei risultati storici.
- **Limite/giustificazione:** scenario descrittivo Horyzon su due periodi, non stress test probabilistico né previsione. Può motivare una domanda sulla variabilità, non certificare incapacità di rimborso.

### I-B01 — Riserva libera e autonomia essenziale

- **Formula:** `Lf=L−P`; `T=K+Rnow`; se T>0, `a=Lf/T`, mesi senza nuove entrate, ai costi essenziali attuali.
- **Input:** B01/B02/B03/C04, stesso perimetro. Nessuna nuova liquidità attribuita a casa, fido o investimenti con prezzo incerto.
- **Missing/estremi:** P ignoto non è zero. B02=0 reale implica P=0 strutturale, Lf=0; se T>0 allora a=0. T=0 → rapporto non calcolabile e domanda sul budget, non autonomia infinita. P>L puntuale → incoerenza, non Lf=0 automatico.
- **Limite/giustificazione:** rapporto di stock/flusso scelto da Horyzon; soglie H sotto sperimentali. Non considera inflazione futura, entrate da lavoro successive, indennizzi, tempi effettivi di liquidazione o spese straordinarie imprevedibili.

### I-B02 — Autonomia sul totale uscite recenti

- **Formula:** `a_full=Lf/(E+R12)`, mesi al ritmo medio T12 se il denominatore>0.
- **Input:** Lf calcolabile e E/R12; stesso perimetro, stock T0 e ritmo storico esplicitati.
- **Missing/estremi:** come B01; niente dato con denominatore nullo.
- **Limite/giustificazione:** controprospettiva informativa, **non un secondo punteggio**. Non si somma a B01 e non sostituisce il suo budget essenziale.

### I-B03 — Capacità dichiarata di affrontare l'imprevisto

- **Formula:** nessuna; risposta RP-B04 con scenario e tempi ripetuti nel report.
- **Input/applicabilità:** anche senza importi, come dichiarazione qualitativa; se T non noto non inventare la cifra dello scenario.
- **Missing/estremi:** UNKNOWN/DECLINED non diventano «non può pagare». Discordanza con B01 → verifica della finestra 7/30 giorni e del perimetro.
- **Limite/fonte:** spunto dal tema resilienza S01/S11; importo relativo e regole sono Horyzon. Non equiparare all'indicatore ufficiale EU-SILC.

### I-C01 — Incidenza storica delle rate

- **Formula:** `d12=R12/Y×100`, percentuale su medie dello stesso T12.
- **Input:** C02/A01, perimetro coerente. R12 zero strutturale da C01 ammesso.
- **Missing/estremi:** Y=0 → non calcolabile anche se R12=0; mostrare separatamente zero rate o rate positive senza rapporto. d12>100 ammesso, non troncato. Non sottrarre rate una seconda volta da Y prima del rapporto.
- **Limite/fonte:** rapporto di cassa, non probabilità di default. Il riferimento educativo S04 di circa 1/3 per rata mutuo non è usato come soglia automatica sul totale rate e non prova concessione di credito.

### I-C02 — Pressione attuale indicativa

- **Formula:** `dnow=Rnow/Y×100` se Y>0; corrente contro media T12, denominatori e date espliciti.
- **Input:** C04/A01 e indicazione accessoria di cambiamenti già noti.
- **Missing/estremi:** nessun calcolo con Y ignoto/nullo; C04=0 con debito aperto non elimina l'esposizione. Nessuna annualizzazione di un nuovo reddito non osservato.
- **Limite/giustificazione:** proxy Horyzon, non stessa base temporale di C01; si descrive il cambiamento, non una «rata sostenibile». Garanzie o scadenze X02 limitano la lettura anche con rapporto basso.

### I-C03 — Segnali di pagamento

- **Formula:** nessuna; C03 distingue assenza, ritardi risolti e in corso.
- **Input:** C03, indipendente dal possesso di prestiti.
- **Missing/estremi:** nessuna risposta non significa nessun ritardo; non dedurre giorni, segnalazioni o gravità legale.
- **Limite/fonte:** tema delle difficoltà nei pagamenti S10/S11; la lettura puntuale Horyzon non è l'indice statistico ufficiale.

### I-D01 / I-D02 — Esposizioni e comprensione dei presidi

- **Formula:** mappa di ogni esposizione D01 con stato D02; X03 aggiunge aspetti da verificare. Nessuna media, conteggio di polizze o euro di copertura ottimale.
- **Input/applicabilità:** righe effettivamente selezionate e strategie note; il tipo di presidio non riceve un peso.
- **Missing/estremi:** riga ignota mantiene il vuoto; «nessuna esposizione individuata» non equivale a area non applicabile o ben protetta. Un presidio parziale non viene duplicato per apparire completo.
- **Limite/fonti:** S07/S08 sostengono attenzione a bisogni e condizioni; criteri D sono proposte Horyzon. Non avendo esaminato i contratti né stimato fabbisogni, non si certifica adeguatezza.

### I-E01 — Attività, debiti e patrimonio netto considerato

- **Formula:** `A=somma A_j`; `N=A−D`, EUR a T0. Elencare accanto capitale previdenziale separato e voci escluse, se note.
- **Input:** X04 completo per tutte le macroclassi applicabili (incluso stesso L di B02); oppure A=0 strutturale da E01 che esclude esplicitamente tutte le attività non previdenziali, inventario confermato completo e B02=0 coerente. X05 completo o D=0 strutturale da C01 nessuno con C03 nessuno/risolto e nessun altro debito aperto; S02 COMPLETE.
- **Missing/estremi:** una voce attiva ignota impedisce A totale; se D manca N non è calcolabile anche se A lo è. Un subtotale noto può essere mostrato come subtotale, mai come totale. N negativo è ammesso. A=0 non significa D=0.
- **Limite/giustificazione:** identità patrimoniale applicata a un inventario ristretto e stimato; non è valutazione professionale. Quote societarie non liquide e obblighi solidali/garanzie non quantificati rimangono limiti, non valori arbitrari.

### I-E02 — Incidenza della liquidità

- **Formula:** `qL=L/A×100` se A>0 e inventario completo. Usare L lordo, non Lf: gli accantonamenti sono ancora attività possedute.
- **Input:** B02 e X04, stessa data/perimetro; L contato una volta.
- **Missing/estremi:** A=0 confermato → composizione e quote non applicabili per assenza di attività; A ignoto o fascia che include zero → quote non calcolabili, non N/A. Manca una classe → nessuna percentuale del totale. Intervalli come §2.
- **Limite/giustificazione:** quota descrittiva Horyzon, **nessun livello ottimale**. 100% cassa può essere coerente con una riserva o un obiettivo vicino; non implica automaticamente «soldi fermi».

### I-E03 — Concentrazione dell'inventario

- **Formula:** `q_j=A_j/A`; `Cmax=max(q_j)` per A>0. Per l'esposizione immobiliare complessiva riportare anche `(casa+altri immobili)/A`. RP-E02 resta una misura percepita distinta, mai sostituita da Cmax.
- **Input:** X04 completo, A>0. Non contare la previdenza vincolata nel denominatore ordinario.
- **Missing/estremi:** inventario incompleto → niente quote rinormalizzate delle sole classi note. A=0 confermato → composizione/quote N/A; A non noto o potenzialmente zero → non calcolabili. N=0/negativo non invalida quote su A lordo positivo, ma ne limita l'interpretazione. Non dividere le quote per il netto.
- **Limite/fonte:** tassonomia di inventario, non analisi delle classi di rischio: la voce «strumenti finanziari» può contenere molti sottostanti diversi. Cmax elevato **non è da solo una prova di cattiva diversificazione**. S06 giustifica distinguere esposizione effettiva e numero di prodotti, non una ripartizione ottimale.

### I-E04 — Dipendenza comune reddito/patrimonio

- **Formula:** nessuna; risposta RP-E04, contestualizzata da A05 e tipo di attività E01 senza inferire correlazioni statistiche.
- **Input:** presenza di entrate e patrimonio; con reddito realmente nullo il legame reddituale è N/A.
- **Missing/estremi:** imprenditore non significa automaticamente sì; nessuna risposta non significa indipendenza.
- **Limite/giustificazione:** esposizione dichiarata Horyzon da approfondire, non concentrazione misurata con dati di mercato.

### I-F01 / I-F02 / I-F03 / I-F04 — Pianificazione e conoscenze

- **I-F01:** livelli dichiarati F01, revisione F06 e dettaglio facoltativo X06 v1/v2 con provenienza e rango confermato. X09–X11 aggiungono risorse/vincoli e contesto del colloquio senza punteggio. Nessuna formula di rendimento, rata-obiettivo o punteggio per ammontare; F01 non certifica che tutti gli obiettivi siano finanziati.
- **I-F02:** risposta F04 sui costi con modalità decisionale F03; non è dimostrazione oggettiva. F04 N/A se nessuna posizione finanziaria/previdenziale applicabile, non voto massimo automatico.
- **I-F03:** esito per singolo quesito F05 (corretto EXPOSURE) e X07 (corretto 20 euro). Mostrare «risposta al quesito», non «alfabetizzazione X%». UNKNOWN/DECLINED separati dall'errore; il quiz facoltativo non abbassa la completezza ordinaria se non svolto.
- **I-F04:** confronto delle risorse di lungo periodo dichiarato F02, fonte/data X08 se disponibili. Non contiene previsione previdenziale né giudizio di sufficienza.
- **Missing/limiti/fonti:** ogni item ignoto resta tale; N/A validi esclusi solo dal proprio quesito. S01/S05/S12 sostengono distinguere autovalutazione e piccola prova pratica. Le regole F non sono la scala OECD e non sono confrontabili con il suo punteggio. Per S09 la consultazione parziale impone verifica aggiornata prima di testi previdenziali definitivi.

## 4. Qualità, completezza e dati mancanti

### Nessuna imputazione

Non usare zero, 3/5, media o risposta precedente per UNKNOWN/DECLINED/UNANSWERED. Zero strutturale ammesso solo per conseguenza logica di una risposta valida: C01 nessuno → R12/Rnow=0; per D=0 servono anche C03 nessuno/risolto e nessun altro debito aperto; B02 zero → P=0. C03 corrente/ignoto non permette D=0 per il solo fatto che non esistano prestiti. Per X04, una classe non selezionata equivale a zero soltanto dopo conferma di inventario completo. Un ramo con genitore ignoto ha applicabilità indeterminata, non «non applicabile».

### Due conteggi distinti

**Avanzamento:** quanti prompt attivi sono stati visitati e hanno ricevuto uno stato esplicito. Un rifiuto può completare la visita.

**Disponibilità informativa ordinaria:** blocchi diagnostici risolti / blocchi necessari applicabili; mostrata come conteggio, eventualmente percentuale arrotondata, mai come salute o affidabilità statistica. Un blocco richiede tutti i suoi input validi o zeri strutturali; fascia valida è informazione disponibile anche se troppo larga per una conclusione unica. UNKNOWN, DECLINED, UNANSWERED e incoerenti non lo risolvono.

Operativamente il denominatore include i blocchi applicabili noti **e quelli con applicabilità indeterminata**; esclude solo i non richiesti con motivo verificato. Il numeratore include soltanto i blocchi risolti con applicabilità nota. Denominatore zero → conteggio non applicabile, non 100%. Eventuale percentuale = numeratore/denominatore ×100, arrotondata soltanto per la presentazione. Questa convenzione conservativa è Horyzon e deve restare visibile accanto al numero dei blocchi di applicabilità incerta.

| Area | Blocchi informativi ordinari |
| --- | --- |
| A | margine (A01+A02+C02); finanziamento uscite (A03); variabilità (A04); fonte principale (A05 quando applicabile) |
| B | fabbisogno essenziale (B01+C04); riserva libera (B02+B03); imprevisto dichiarato (B04) |
| C | presenza (C01); rate storiche (C02+A01 quando debiti rilevanti, oppure assenza strutturale dichiarata); ritardi (C03); impegni correnti (C04+A01 per la proxy quando pertinente, oppure assenza strutturale dichiarata) |
| D | esposizioni (D01); presidi (D02: tutte le righe applicabili). D01 nessuna risolve solo la mappa, senza certificare la protezione |
| E | inventario (E01); concentrazione percepita (E02 se applicabile); liquidabilità (E03 se applicabile); legame reddito/patrimonio (E04 se applicabile) |
| F | obiettivo (F01); lungo periodo (F02); modalità decisionale (F03); costi (F04 se applicabile); quesito (F05); revisione (F06) |

Con C01 nessuno si descrivono i blocchi rate come risolti per assenza strutturale anche se il rapporto 0/0 non si calcola; non si stampa uno 0% se Y=0. E senza attività: E02/E03/E04 sono componenti N/A motivate; inventario assente confermato può risolvere il solo blocco E01 (1/1 applicabile), senza attribuire merito. Aggiungere sempre il limite sulla posizione debitoria e sulla disponibilità quantitativa: 1/1 ordinario non significa netto calcolabile o assenza di debiti. Applicabilità indeterminata va contata separatamente e non tolta in modo favorevole dal denominatore. Il totale dei blocchi, se mostrato, va accompagnato da quelli per area: non prova che tutte e sei siano valutabili.

**Approfondimento quantitativo:** disponibilità di X04/X05 e dati accessori riportata separatamente; «questionario ordinario completo» non significa patrimonio netto calcolabile. I blocchi condivisi fra aree non sono evidenze indipendenti e non formano un indice globale.

**Modulo obiettivi 3C:** disponibilità di X06 v2 e X09–X11 separata dai blocchi ordinari. 40 ID (29+11) non significa 40 obblighi di risposta. Nessuna esperienza/aspettativa o cifra facoltativa aggiunge requisiti per PRESIDI/COSTRUISCE; un dato nuovo effettivamente contraddittorio richiede chiarimento, non resta ignorato. Rango degli obiettivi non cambia l'ordine del triage e non diventa priorità commerciale.

**Qualità:** riportare origine dichiarata, fascia/stima/puntuale, finestra, ampiezza intervallo, coerenza e perimetro. Nessun coefficiente probabilistico. Se un valore ha un'incoerenza irrisolta, sospendere solo le conclusioni che lo usano; evidenze indipendenti restano visibili.

## 5. Regole locali di valutazione

Tutte le seguenti sono **regole Horyzon sperimentali**, da sottoporre a revisione e pilot. Non hanno soglie diagnostiche validate da enti pubblici. Regole favorevoli richiedono tutti i dati locali indicati, non basta l'assenza di segnali negativi.

| ID | Predicato e risultato locale | Limite / spiegazione |
| --- | --- | --- |
| R-A-01 | M interamente <0, A03 noto diverso da PLANNED_DRAW → A ATTENZIONE. Oppure A03=REPEATED_GAP → ATTENZIONE anche senza importi | «Uscite non coperte dalle entrate recenti» oppure «ricorso non programmato nella maggior parte dei mesi». Se A03 ignoto e M<0, soltanto DA_APPROFONDIRE: il motivo del disavanzo è da capire |
| R-A-02 | M<0 con PLANNED_DRAW → A DA_APPROFONDIRE, senza dire che il piano è errato. M tocca/attraversa zero, M=0 o OCCASIONAL_GAP o entrate poco prevedibili → DA_APPROFONDIRE | Zero è un confine contabile, non una soglia di benessere. Le diverse condizioni si spiegano separatamente |
| R-A-03 | M interamente >0; A03 COVERED; A04 regolare o prevedibile; A05 noto quando applicabile; perimetro coerente → A PRESIDI_DICHIARATI | Avanzo recente e contesto conosciuto, non capacità futura garantita. Altrimenti, in assenza di segnali interpretabili e dati necessari, NON_VALUTABILE |
| R-B-01 | Autonomia interamente <1 mese → B ATTENZIONE; compreso zero con fabbisogno>0. B04 «non saprei come pagarla» → ATTENZIONE come dichiarazione, non prova contabile | **H-B1**, un ciclo mensile di spese, scelta di triage. Non è soglia OECD né fabbisogno universale |
| R-B-02 | Autonomia fra 1 incluso e 3 escluso; intervallo che attraversa 1 o 3; oppure B04 richiede altri accantonamenti/vendite/nuovo denaro → DA_APPROFONDIRE | **H-B3**, tre mesi come punto operativo sperimentale. Non suggerisce di comprare/vendere né prescrive 3/6 mesi a tutti |
| R-B-03 | Autonomia interamente >=3 e B04 «somme disponibili» coerente, tutti gli input noti → PRESIDI_DICHIARATI | Descrive il cuscinetto a quei costi, non immunità agli shock. Con dati insufficienti e nessun segnale supportato → NON_VALUTABILE |
| R-C-01 | C03 ritardi in corso → C ATTENZIONE. Oppure rate R12>0 certe e M interamente <0 senza PLANNED_DRAW e con A03 noto → ATTENZIONE contestuale | Nessuna etichetta di insolvenza o merito creditizio. Se stesso squilibrio già in A, una sola priorità condivisa |
| R-C-02 | Ritardi risolti, cambiamenti di rata noti, condizioni/garanzie X02 dichiarate, intervallo del margine che include sia deficit sia non deficit o numeri attuali non interpretabili → DA_APPROFONDIRE | Nessun automatismo da d12=30/33/40%. Non si stima il futuro dei tassi |
| R-C-03 | C01 nessuno, C03 nessuno → PRESIDI_DICHIARATI limitatamente all'assenza di debiti/ritardi; oppure debiti descritti, rate e reddito quantificabili, C03 nessuno, contesto di M non deficitario e nessun cambiamento noto → PRESIDI_DICHIARATI | Non significa tutte le altre aree solide. Con dati mancanti che impediscono queste letture e senza altro segnale → NON_VALUTABILE |
| R-D-01 | Almeno una riga D02 GAP o UNREVIEWED, oppure limite esplicitamente non controllato in X03 → D DA_APPROFONDIRE | Una risposta non definita è una questione da verificare, non diagnosi di sottoassicurazione. Indicare la riga specifica |
| R-D-02 | Esposizioni D01 note e almeno una pertinente; tutte le righe D02 CHECKED, nessuna contraddizione pertinente → PRESIDI_DICHIARATI | «Strategie e limiti principali dichiarati come controllati». Con soli sconosciuti o nessuna esposizione percepita → NON_VALUTABILE |
| R-E-01 | E02 almeno 75% in una singola esposizione **non meramente nella macrovoce liquidità**; E04 sì; oppure E03 <25% liquidabile con autonomia I-B01 <1 mese → E DA_APPROFONDIRE | **H-E75**, criterio editoriale di attenzione a una concentrazione marcata, non limite di investimento. La sola prevalenza di cassa o Cmax di una macrovoce non dimostrano rischio e non attivano da soli la regola |
| R-E-02 | A=0 confermato e debito aperto noto (C01/C03 o X05), oppure N interamente <0 calcolabile → DA_APPROFONDIRE. Altrimenti inventario E01 e risposte E applicabili noti, nessuna condizione R-E-01 e nessun segnale patrimoniale precedente → STRUTTURA_DESCRITTA, mai PRESIDI_DICHIARATI. Informazioni necessarie insufficienti → NON_VALUTABILE | Con A=0, solo composizione/quote sono N/A: N=A−D resta calcolabile se D noto; D ignoto non è zero. Per A=0, STRUTTURA_DESCRITTA richiede anche D=0 confermato; debito ignoto senza evidenza positiva di presenza → NON_VALUTABILE con fatto «nessuna attività dichiarata». Netto negativo non è diagnosi di insolvenza |
| R-F-01 | F01 NONE/IDEA, F02 ROUGH/NOT_REVIEWED, F04 FOUND/NOT_FOUND se applicabile, F05 COUNT, F06 oltre12/mai → F DA_APPROFONDIRE | Specificare il singolo aspetto. **H-F12**, dodici mesi come recenza operativa, non termine legale. UNKNOWN non è una risposta errata |
| R-F-02 | F01 HORIZON/DEFINED, F02 CHECKED, F03 noto, F04 EXPLAIN o N/A confermato, F05 EXPOSURE, F06 entro12 → PRESIDI_DICHIARATI | Attesta soltanto comportamenti/risposte dichiarati. Se mancano requisiti e non c'è un gap esplicito → NON_VALUTABILE. X07 errato aggiunge una nota didattica, non un voto globale né declassamento automatico |

### Ordine di valutazione e frontiere

Prima validare perimetro, risposte e contraddizioni; poi costruire solo evidenze valide. All'interno di un'area, ATTENZIONE prevale sugli altri stati se ha un'evidenza indipendente utilizzabile; DA_APPROFONDIRE prevale su una lettura favorevole o neutra quando esiste il relativo segnale; PRESIDI solo con tutti i requisiti. E usa STRUTTURA_DESCRITTA se soddisfa R-E-02, senza graduarla rispetto a PRESIDI. In mancanza, NON_VALUTABILE; N/A soltanto su esclusione strutturale della componente. Un input incoerente non autorizza una regola sfavorevole che dipenda proprio da quel valore.

Frontiere H-B: 0 e 0,99 mesi → <1; esattamente 1 → fascia 1–<3; esattamente 3 → requisito quantitativo della fascia >=3. Un intervallo [0,5;4] non è né «sicuro» né certamente <1: DA_APPROFONDIRE per precisione insufficiente, non punizione del dato in fascia. Per H-E75 esattamente 75% appartiene alla banda alta; manca informazione sul tipo di esposizione → nessuna attribuzione automatica. Nessuna sfumatura grafica può trasformare questi confini sperimentali in certificazioni.

## 6. Punti di forza, fragilità, anomalie e priorità

Un'area può contenere entrambi: «rate senza ritardi dichiarati» e «concentrazione nell'impresa da chiarire». Nessuna selezione deve sopprimere un fatto importante perché esiste un punto di forza altrove.

Schema di evidenza progettuale: `ID / regola-versione / tipo (forza, vulnerabilità, contesto, mancante, anomalia) / risposte-revisioni / indicatore e periodo / stato input / predicato vero o indeterminato / testo autorizzato / limite`. Non è un contratto API implementato.

| Evidenza | Esempio di testo deterministico | Domanda conseguente |
| --- | --- | --- |
| I-A01 M>0 | «Nel periodo indicato, le entrate superano spese e rate di circa [valore/intervallo] al mese» | «Il ritmo è rimasto simile nei mesi con entrate più basse?» |
| I-B01 a<1 | «La riserva libera dichiarata copre meno di un mese del budget essenziale attuale, rate comprese» | «Il budget e gli accantonamenti includono tutti gli impegni dello stesso perimetro?» |
| C03 attuale | «Hai indicato ritardi di pagamento ancora in corso» | «Quali informazioni aggregate sugli impegni servono per comprenderli meglio?» Non chiedere le cause sanitarie |
| D02 GAP | «Per [categoria di responsabilità] non hai ancora individuato una risposta» | «Quali risorse o condizioni hai già verificato?» |
| E04 sì | «Hai indicato un legame importante fra la fonte di reddito e il patrimonio» | «Quali conseguenze economiche avrebbero un imprevisto nella stessa attività?» |
| R-E-02, A=0 e D>0 noto | «Non risultano attività nel perimetro dichiarato, mentre sono presenti debiti; la posizione va approfondita» | «Il perimetro e il residuo includono tutte le voci, senza duplicazioni?» N e importi sono dettagli interni disponibili, non obbligatori nella sintesi cliente |
| R-E-02, struttura descritta | «Le risposte descrivono come è composto il patrimonio; non consentono di valutarne l'adeguatezza» | «Quali aspetti richiedono informazioni più precise?» Nessun punto di forza inventato dalla sola assenza di alert |
| F04 NOT_FOUND | «Non hai ancora individuato i costi complessivi delle posizioni indicate» | «Dove sono riepilogati e quali voci comprendono?» |
| Campo sconosciuto | «Il patrimonio netto non è calcolabile perché manca il debito residuo» | «Vuoi aggiungerlo, lasciarlo non noto o mantenere il risultato parziale?» |
| P>L incompatibile | «Le fasce di disponibilità e accantonamenti non risultano compatibili» | «Si riferiscono alla stessa data e alle stesse somme?» |

**Priorità, senza punteggio:** (1) fatti di difficoltà attuale esplicita: ritardi in corso e incapacità dichiarata di affrontare il fabbisogno; (2) disavanzo non programmato/riserve brevi supportati; (3) impegni in cambiamento, esposizioni e presidi da verificare; (4) dati da chiarire e conoscenze/obiettivi da approfondire. È un ordine di lettura Horyzon, non gravità clinica o finanziaria validata. Si possono mostrare fino a tre priorità iniziali, lasciando consultabili tutte le altre. In parità: ordine di categoria, poi ID regola stabile; non potenziale commerciale o patrimonio più alto.

Se un'incoerenza impedisce una lettura, la relativa verifica va anteposta a quella conclusione. Segnali indipendenti di pagamento non vengono nascosti da una discussione sui dati. A01/A02 e rate che producono lo stesso deficit confluiscono in una sola priorità, con più riferimenti.

## 7. Quattro profili narrativi: classificazione distinta

Non sono livelli progressivi, segmenti di vendita o giudizi sulle capacità. Il profilo scelto al funnel non entra nei predicati. Ogni candidato ha tre esiti: vero / falso / indeterminato. S01 noto e S02 COMPLETE sono prerequisiti per pubblicare un profilo derivato. Nessun profilo è necessario per pubblicare il risultato.

| ID | Richiamo narrativo e formulazione neutra proposta | Predicato di eleggibilità Horyzon |
| --- | --- | --- |
| PN-MESE | «Chi rincorre il mese» → **Equilibrio corrente da ricostruire** | A03 REPEATED_GAP; oppure M interamente <0 e A03 valore noto in COVERED/OCCASIONAL_GAP/REPEATED_GAP. PLANNED_DRAW esclude questa inferenza; ritardo isolato da solo non basta |
| PN-FERMI | «Chi ha i soldi fermi» → **Liquidità da collegare agli obiettivi** | Requisiti comuni: autonomia B interamente >=3 con B01/B02/B03/C04 coerenti, B04 somme disponibili senza intaccare impegni, A03 COVERED, F01 NONE/IDEA e nessun obiettivo con orizzonte già dichiarato in X06 da riconciliare. In più almeno uno dei due canali di evidenza definiti sotto. Nessuna quantità ottimale di cassa o indicazione a investire |
| PN-AFFIDA | «Chi si affida» → **Confronto sui costi da rendere più chiaro** | F03 confronto/delega con professionista e F04 valore FOUND/NOT_FOUND. Fiducia/delega da sola non basta e non è debolezza. F04 UNKNOWN rende il candidato indeterminato, non vero |
| PN-COSTRUISCE | «Chi costruisce» → **Abitudini di pianificazione presenti** | F01 HORIZON/DEFINED, F02 CHECKED, F06 entro12 mesi, F05 EXPOSURE, F04 EXPLAIN o N/A confermato, A03 COVERED o PLANNED_DRAW, autonomia B>=3 certa, C03 nessuno. Non richiede strumenti specifici, quantità di patrimonio, delega/assenza di delega o punteggio E favorevole |

**Selezione:** esattamente un candidato vero e tutti gli altri falsi → prevalente. Due o più veri → misto, riportando nomi e motivazioni dei candidati veri senza sceglierne uno per peso. Nessun vero → non determinabile (motivo: nessuna corrispondenza / dati insufficienti). Un solo vero con altri indeterminati → non determinabile come prevalente; si può mostrare «questo tratto è osservato, non basta a definire un profilo». Non convertire indeterminato in falso per forzare una classe.

### FERMI: tratto ordinario e conferma quantitativa

- **Canale qualitativo H-PQUAL:** E01 noto e inventario confermato completo; B02 positivo e sola liquidità fra le attività non previdenziali, oppure E02 nella banda «tre quarti o più» con tipo liquidità. Si descrive «liquidità prevalente dichiarata», senza attribuire una percentuale puntuale né affermare qL>=80%. Il solo possesso di cassa è un tratto osservabile, non il profilo: devono essere veri anche tutti i requisiti comuni. Il canale usa domande già presenti, nessun nuovo ID.
- **Canale quantitativo H-P80:** X04 completo, A>0 e qL interamente >=80%. È una soglia narrativa sperimentale mantenuta dalla 1.0, non una soglia istituzionale né una verifica della correttezza dei valori. Consente il profilo se i requisiti comuni sono veri anche quando la prevalenza qualitativa non è determinabile. La sola concentrazione per macroclasse non prova una concentrazione bancaria.
- **Combinazione:** eleggibilità = requisiti comuni E (H-PQUAL O H-P80), con logica vero/falso/indeterminato. Un canale certamente vero risolve l'alternativa anche se l'altro non è svolto. Entrambi falsi escludono; nessun vero e almeno un indeterminato lasciano il profilo indeterminato, salvo un requisito comune falso. Un dato quantitativo discordante in modo incompatibile con l'inventario richiede chiarimento; non scegliere il canale più favorevole. Il 75–<80% può soddisfare la banda qualitativa senza soddisfare H-P80: non è una contraddizione né una promozione numerica.
- **Livello pubblicabile:** solo tratto osservato quando mancano requisiti; candidato vero quando il predicato è risolto; prevalente/misto solo dopo confronto con gli altri tre candidati. Ogni candidato vero registra base qualitativa / quantitativa / entrambe e lo stato della conferma H-P80 (non svolta, confermata, esclusa, indeterminata). «Confermata» riguarda il predicato sui dati dichiarati, non una verifica esterna.
- **Esigenze correnti:** B03 distingue gli accantonamenti non rinviabili e l'autonomia usa L−P; B04 verifica la disponibilità senza intaccarli. F01 con orizzonte esclude il profilo, anche al 100% di cassa. Qualunque obiettivo temporizzato già noto in X06 lo sospende/esclude fino a riconciliazione esplicita di F01; un obiettivo vicino non viene mai ignorato. X06 non svolto non prova assenza di esigenze: il testo dice «nelle risposte disponibili non sono ancora definiti gli obiettivi», non «cassa inutilizzata». Non si quantifica un surplus investibile.

Un candidato può diventare falso già per un requisito sicuramente non soddisfatto; altrimenti input necessario ignoto → indeterminato, rispettando l'alternativa fra i due canali FERMI. Non serve X04 per escludere FERMI quando F01 è HORIZON, né per confermarne il candidato qualitativo quando tutti i requisiti ordinari sono soddisfatti. La conferma di una percentuale, invece, richiede sempre X04 completo. Il profilo può essere misto anche se una sua base è qualitativa: nessuna precedenza del canale quantitativo.

Rischi: liquidità motivata scambiata per inerzia; pensionato con decumulo pianificato scambiato per difficoltà; fiducia nel consulente scambiata per incompetenza; persona con metodo scambiata per «patrimonio sicuro». Ogni profilo deve esporre le evidenze necessarie e un limite esplicito; può convivere con vulnerabilità in altre aree. Non usarlo per owner, offerta, urgenza commerciale o criteri di accesso.

## 8. Sensibilità, accettazione e riuso nel tempo

- Stesso input valido + stessa versione → stesse formule, evidenze, stati, motivazioni, ordine e candidati. La UI non può aggiustare il risultato.
- Passare da numero a fascia che contiene quel numero non può produrre una conclusione più precisa; può aumentare l'incertezza. Non è garanzia di stessa etichetta, perché manca informazione.
- Modificare un solo input può cambiare più aree che lo condividono (es. Rnow per B/C), ma deve lasciare invariati gli indicatori non dipendenti. No compensazioni globali.
- Aggiungere una categoria di investimento, cambiare ruolo professionale, dichiarare alta ricchezza o partecipare all'evento non migliora automaticamente un risultato.
- Dati mancanti, zeri e N/A devono produrre esiti diversi; eliminare un dato non può far apparire un presidio prima non dimostrato.
- Documentare la sensibilità a 1/3 mesi, 75/80% e 12 mesi nelle controprove; il cambio di versione delle soglie deve essere visibile nello storico. Il report precedente rimane rappresentazione del suo input/versione.
- «Miglioramento» storico solo per indicatori comparabili, stesso perimetro e definizioni. Fasce sovrapposte → variazione non determinabile; stock maggiori non provano migliore benessere. Risposte a un quiz ripetuto possono riflettere apprendimento dell'item.
- Nessun coefficiente/soglia è attribuito alla fonte sbagliata. Soglie H e criteri profili richiedono approvazione DEC-02/03/05 e test di comprensione prima dell'implementazione.

## 9. Unico risultato e due proiezioni

Formule, stati, evidenze, candidati e limiti sopra appartengono a un unico risultato versionato. `ClientResultProjection` ne seleziona una sintesi comprensibile; `AdvisorResultProjection` ne espone le evidenze agli operatori autorizzati. Nessuna proiezione ricalcola o migliora un esito. Informazioni materiali (ritardi, netto negativo se noto, limiti che cambiano la lettura) non possono sparire dalla sintesi per ragioni commerciali; possono essere espresse senza mostrare tutti gli importi. Il contratto dettagliato, incluse autorizzazioni e compatibilità futura con le soluzioni, è nella [specifica delle due viste](radar-patrimoniale-v1-doppia-vista.md).

## 10. Controlli del dossier obiettivi, senza nuovi voti

Le regole R-G sono proposte Horyzon di coerenza/preparazione, non nuova area, scala o motore commerciale. Usano i campi della [specifica obiettivi](radar-patrimoniale-v1-profilazione-obiettivi.md), versioni e stati originari; nessuna raccomandazione individuale. Gli esiti sono «coerente nei dati disponibili / da chiarire / informazioni insufficienti», riferiti allo specifico confronto, non alla salute della persona. Ordine degli obiettivi, fatti economici e utilità del colloquio sono tre ordinamenti/contesti distinti.

| ID | Controllo ed evidenza consentita | Limite / indipendenza |
| --- | --- | --- |
| R-G-01 | 1–3 obiettivi totali quando dichiarati, rango univoco se confermato, riferimenti stabili e primo bisogno delle risorse. Ordine mancante in v1/v2 mantiene le righe senza principale. X06 v1 ripreso con provenienza | Non creare obiettivi da patrimonio, professione, vulnerabilità o interesse all'evento. Se X06 rivela tempo/obiettivo incompatibile con F01, sospendere la lettura dipendente e proporre revisione esplicita; F01 non si migliora automaticamente |
| R-G-02 | Cmin è quota attuale di L da preservare, incluso P: verificare 0<=P<=Cmin<=L soltanto con dati utilizzabili e stesso perimetro/data | Non sottrarre P due volte, non sostituire Cmin mancante con P/tre mesi. Se si tratta di un desiderio futuro di riserva superiore a L, chiarire la definizione e registrarlo come obiettivo, non trattarlo come capacità o errore economico |
| R-G-03 | G0 dichiarato quota dell'attuale L; confronto con L−Cmin se calcolabile. G0 oltre quel residuo con ambiti coerenti → differenza da chiarire | Residuo contabile rispetto a un minimo scelto, non capitale investibile/riserva adeguata. B01/B02 e autonomia non vengono sostituiti; altre attività, nuovi prestiti, M×mesi e redditi attesi non sono aggiunti a G0 |
| R-G-04 | Verificare che le attribuzioni G_i non impegnino più volte lo stesso G0; totale sicuramente superiore → incoerenza di attribuzione da chiarire | UNKNOWN non è zero, nessuna ripartizione uguale o automatica. Importi-obiettivo maggiori di G0 sono soltanto confronto con risorse attuali: scadenze e natura continuativa possono differire, nessuna impossibilità futura dedotta né finanziamento ipotizzato |
| R-G-05 | Rendere visibili vincoli/rigidità, esperienza concreta/recenza e aspettative/dubbi dichiarati, F03 attuale e X11 futuro separati. Distinguere fatti, confronti e ipotesi | Nessun punto o competenza dedotta da possesso/delega, quiz o familiarità; nessuna capacità di perdita da una preferenza. Nessun cambiamento di F03/PN-AFFIDA per X11. Le aspettative da chiarire non sono errori al quiz |
| R-G-06 | Confronto futuro con catalogo: potenzialmente pertinente / insufficiente / incompatibile con vincoli / non pertinente agli obiettivi, più esito di insieme nessuna soluzione identificata | Incompatibilità certa e non pertinenza certa richiedono basi; ignoto non è falso. Nessun ranking per patrimonio/commissioni; nessuna selezione individuale di strumenti o sostituzione di verifiche regolamentate. Contratto nella doppia vista |

Intervalli: preservare gli estremi e le dipendenze, perché Cmin/G0/G_i fanno riferimento alla stessa L e allo stesso fondo, non a copie indipendenti. Conclusione certa soltanto se valida per tutte le combinazioni ammissibili. Fasce che permettono sia coerenza sia incompatibilità → «da chiarire», non violazione certa; perimetro/tempo incompatibili o input mancanti → confronto non calcolabile con motivo. Mai midpoint, clipping o inferenza di zero da un rifiuto.

Riordinare obiettivi, cambiare X10 o cambiare il coinvolgimento desiderato in X11 non altera M, Lf/autonomia, A/D/N o quiz; le attribuzioni seguono riferimenti, non posizioni. Un nuovo impegno realmente non rinviabile può chiarire B03/C04 soltanto con revisione esplicita, propagando allora le dipendenze normali. Non sottrarre una spesa-obiettivo desiderata come se fosse già dovuta. La compilazione di X06/X09–X11 non sana contraddizioni o dimostra capacità effettiva.

Le 14 simulazioni diagnostiche e le 28 controprove 3B sono preservate, con CT-28 aggiornata alla nomenclatura degli esiti 3C; G01–G08 e CT-29–40 aggiungono attese del modulo. Sono casi documentali, non esecuzione di questo controllo in software o validazione della qualità delle risposte.
