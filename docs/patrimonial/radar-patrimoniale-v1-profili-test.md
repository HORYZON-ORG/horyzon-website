# Radar Patrimoniale V1 — Persone simulate e controprove

Versione **RP-CASES-1.2-draft**, Fase 3C del 18 ottobre 2026, baseline `e11a31b9903fdb8efff31f6d9153bafe6dd854f9`. Coordinato con [metodologia](radar-patrimoniale-v1-metodologia.md), [domande](radar-patrimoniale-v1-questionario.md), [regole](radar-patrimoniale-v1-scoring.md), [due viste](radar-patrimoniale-v1-doppia-vista.md) e [obiettivi](radar-patrimoniale-v1-profilazione-obiettivi.md). Conservate le 14 simulazioni diagnostiche e 28 controprove 3B; aggiunti otto scenari G01–G08 e CT-29–CT-40. Totale 22 schede/scenari e 40 controprove, non campione di validazione.

**Queste sono 14 analisi progettuali su dati interamente fittizi**, di cui le prime 12 coprono i casi richiesti. Importi e letture sono esempi ragionati delle formule/regole proposte, con verifica aritmetica; non risultati ottenuti eseguendo un motore Radar Patrimoniale, non evidenze di validità scientifica e non test software PASS. Nessun contatto reale, chiamata CRM o dato remoto.

In 3C le 14 fixture T restano identiche: i nuovi approfondimenti sono UNANSWERED se non esplicitati. X06 storico rimane v1 quando non raccolto nuovamente, senza rango inventato. Gli otto scenari G riguardano il modulo: non si assumono risposte complete delle sei aree dove non indicate; dati ereditati da una T sono tali soltanto quando esplicitamente richiamati.

## 1. Convenzioni delle simulazioni

T0 = 18 ottobre 2026; flussi T12 = ottobre 2025–settembre 2026; budget/rate attuali a T0. EUR; tutti gli importi puntuali sotto sono **stime dichiarate**, non dati verificati da Horyzon. Valori mensili medi T12, eccetto stock in euro. R=R12=Rnow salvo nota esplicita. Asset totali al lordo del debito, previdenza vincolata esclusa; inventario X04 confermato completo quando si riportano A/N. D è residuo a T0; nessun debito fuori perimetro viene inventato.

Per non ripetere 37 risposte, questa è la base comune esplicita delle fixture, sovrascritta da ciascun caso:

- S01 individuale; S02 COMPLETE; S04 zero persone economicamente dipendenti; S03 dipendente salvo diversa indicazione nel caso. A03 COVERED; A04 regolare; A05 fonte >80%.
- B04 somme disponibili senza intaccare impegni; C03 nessun ritardo; C04 cambiamenti noti no. C01 nessuno nei casi R=D=0, altrimenti debiti indicati nel caso; rate storiche e attuali non vengono sommate.
- D01 disponibilità di casa/beni essenziali; D02 CHECKED per una strategia dichiarata (non necessariamente assicurativa), salvo variazione. Non è un'adeguatezza certificata.
- F01 HORIZON; F02 CHECKED; F03 decisione diretta; F04 EXPLAIN se esistono strumenti finanziari/previdenziali applicabili, altrimenti N/A validato; F05 EXPOSURE corretto; F06 ultimi tre mesi.
- E01 segue le attività nominate; E02 quota/tipo e E03/E04 sono esplicitati nei casi, non dedotti automaticamente dall'inventario.
- X01/X02/X03/X06/X07/X08 non svolti, salvo indicazione. Assenza di X02 non prova assenza di garanzie. X04/X05 disponibili nei casi numerici; C01 nessuno insieme a C03 nessuno/risolto e assenza di altri debiti aperti consente D=0 strutturale senza X05. I-F04 conserva il dato qualitativo F02, ma non una fonte/data dettagliata X08.

Sigle dei risultati: **P** PRESIDI_DICHIARATI, **S** STRUTTURA_DESCRITTA (neutro, usato in E), **A** ATTENZIONE, **D** DA_APPROFONDIRE, **NV** NON_VALUTABILE, **NA** NON_APPLICABILE della componente. Non sono numeri o gradini di una scala. Una P descrive solo il perimetro osservato; E non assegna P nella V1. Un'area D per concentrazione non equivale a difficoltà di pagamento. Ogni lettura alimenta entrambe le proiezioni senza ricalcolo; esempi di granularità nella sezione finale.

## 2. Dodici situazioni richieste

### T01 — Giovane lavoratore, reddito modesto e avanzo regolare

**Risposte:** S03 dipendente. Y=1.600; E=1.200; R=0; K=1.100; L=12.000; P=2.000; A=12.000 (solo liquidità); D=0. F01 HORIZON, obiettivo di riserva, F02 CHECKED su informazioni di lungo periodo; nessun investimento, F04 N/A. E02 >=75%, tipo liquidità; E03 tutte; E04 no. Nessun dato familiare identificativo.

**Calcolabile:** M=400 €/mese, m=25%; copertura uscite 1,33 volte; Lf=10.000, autonomia essenziale 9,09 mesi; rate 0%; N=12.000, qL=100%. Cmax inventariale 100% liquidità, senza inferire una sola banca. **Non calcolabile/non svolto:** scenario minimo X01, limiti contrattuali X03, esercizio X07 e fonte/data dettagliata X08; non sono necessari al risultato ordinario.

**Atteso:** A/B/C/D/E/F = **P/P/P/P/S/P**, con limiti dichiarati; profilo prevalente **PN-COSTRUISCE**. FERMI è falso perché esiste un obiettivo con orizzonte; AFFIDA falso per decisione diretta; MESE falso. Punti di forza: avanzo, riserva e abitudini; E descritta senza attestare adeguatezza. Nessuna vulnerabilità economica specifica emersa; da non affermare assenza di ogni rischio.

**Errore da evitare:** premiare meno il metodo perché il reddito è basso, oppure penalizzare la sola cassa o suggerire investimenti per «diversificare il punteggio».

### T02 — Nucleo con mutuo e pagamenti regolari

**Risposte:** S01 HOUSEHOLD, S04 due; S03 dipendenti; A05 oltre 50% e fino a 80%. Y=4.000; E=2.500; R=800 (mutuo); K=1.800; L=20.000; P=5.000. X04: casa 300.000, strumenti finanziari 90.000, L 20.000; A=410.000; X05 D=180.000. E02 50–<75%, tipo immobile; E03 25–<50%; E04 no. D01 casa e sostentamento, entrambe D02 CHECKED. F01 DEFINED, F04 EXPLAIN; C03 nessuno e nessun cambiamento noto.

**Calcolabile:** M=700, m=17,5%; copertura 1,21; Lf=15.000; autonomia 15.000/(1.800+800)=5,77 mesi; incidenza rate 20%; N=230.000, qL=4,88%. **Non calcolabile/non svolto:** effettiva adeguatezza assicurativa, entrate future e capacità bancaria di rimborso, oltre ai moduli facoltativi comuni.

**Atteso:** **P/P/P/P/S/P**, profilo **PN-COSTRUISCE**. Punti di forza: pagamenti regolari dichiarati, margine e riserva; E è neutra, non «portafoglio protetto». Il caso è «sostenibile» soltanto nel senso colloquiale della situazione simulata corrente: il report non approva il mutuo.

**Errore da evitare:** trattare la rata al 20% come garanzia di credito approvabile o confrontare reddito familiare con il solo debito individuale.

### T03 — Nucleo con debiti elevati e ritardi in corso

**Risposte:** HOUSEHOLD, S04 due, dipendenti. Y=3.000; E=2.000; R=1.600 (mutuo e credito al consumo); K=1.500; L=1.000; P=0. A03 REPEATED_GAP; B04 «non saprei come pagarla»; C03 ritardi in corso. Casa 140.000 + L=1.000 → A=141.000; D=95.000. E02 >=75%, immobile; E03 <25%; E04 no. D02 GAP per sostentamento; F01 IDEA, F02 ROUGH, F03 diretta, F04 N/A.

**Calcolabile:** M=−600, m=−20%; copertura 0,83; Lf=1.000; autonomia 0,32 mesi; rate 53,33%; N=46.000, qL=0,71%. **Non calcolabile/non svolto:** giorni/ammontare dei ritardi, rischio di insolvenza, durata di una difficoltà o debito potenziale non dichiarato; approfondimenti comuni assenti.

**Atteso:** **A/A/A/D/D/D**, profilo **PN-MESE**. Priorità: ritardi in corso, poi disavanzo/riserva (senza duplicare il medesimo deficit in A e C). Fatto patrimoniale descrittivo: il netto considerato risulta positivo; non è un presidio né compensa i pagamenti difficili. Vulnerabilità: ritmo di cassa e responsabilità senza strategia definita.

**Errore da evitare:** mediare la casa e gli arretrati in un voto rassicurante, oppure classificare legalmente la persona come insolvente.

### T04 — Molta liquidità senza obiettivi definiti

**Risposte:** dipendente, Y=4.500; E=2.000; R=0; K=1.500; L=200.000; P=20.000. Altri strumenti finanziari 20.000 → A=220.000; D=0. E02 >=75% liquidità (non un emittente identificato); E03 tutte dichiarate; E04 no. A03 COVERED; F01 NONE, F02 ROUGH, F03 diretta, F04 EXPLAIN. Nessun X06 con esigenza vicina.

**Calcolabile:** M=2.500, m=55,56%; Lf=180.000; autonomia 120 mesi; rate 0%; N=220.000; qL=90,91%. **Non calcolabile/non svolto:** erosione futura del potere d'acquisto, rendimento perso, eccesso «ottimale» di cassa, concentrazione per banca, moduli comuni non risposti.

**Atteso:** **P/P/P/P/S/D**, profilo **PN-FERMI**, base qualitativa e quantitativa concordanti; conferma H-P80 sui valori dichiarati, non verifica esterna. È una lettura narrativa di liquidità da collegare agli obiettivi, non una criticità di liquidità o una raccomandazione a investire. Se F01 viene aggiornato a un obiettivo con orizzonte, il profilo FERMI non è più eleggibile a parità di importi. Senza X04 resta eleggibile qualitativamente (CT-21), mentre A/N/quote non sono pubblicati come totali.

**Errore da evitare:** «stai perdendo X euro», oppure usare i rendimenti illustrativi del funnel per prescrivere un prodotto.

### T05 — Patrimonio immobiliare alto, poca riserva libera

**Risposte:** redditi da lavoro e affitti, A04 prevedibile; Y=3.500; E=2.800; R=500; K=2.000; L=4.000; P=2.000. Immobili 1.200.000 → A=1.204.000, D=100.000. A03 OCCASIONAL_GAP, B04 vendita/denaro esterno; C03 nessuno. E02 >=75% immobile; E03 <25%; E04 no. D02 UNREVIEWED; F01 IDEA, F02 ROUGH, decisione diretta, costi N/A.

**Calcolabile:** M=200, m=5,71%; Lf=2.000; autonomia 0,8 mesi; rate 14,29%; N=1.104.000; qL=0,33%. **Non calcolabile/non svolto:** tempo/prezzo reale di vendita, imposte di realizzo e copertura degli imprevisti futuri.

**Atteso:** **D/A/P/D/D/D**, profilo **non determinabile: nessuna corrispondenza**. Forza: avanzo medio e pagamenti regolari; vulnerabilità: bassa riserva rispetto alle necessità correnti, illiquidità e presidi da verificare. La disponibilità dell'immobile non alza B.

**Errore da evitare:** trattare un milione di patrimonio netto stimato come un milione disponibile, o suggerire automaticamente di vendere un immobile.

### T06 — Investitore che dichiara diversificazione, costi poco compresi

**Risposte:** Y=5.000; E=2.800; R=200; K=1.800; L=25.000; P=5.000. Strumenti finanziari 375.000, altro immobile 100.000 → A=500.000; D=20.000. E02 <50% per singola esposizione, tipo emittente finanziario; E03 almeno metà non tutte; E04 no. F01 HORIZON, F02 CHECKED, F03 confronto con professionista, F04 NOT_FOUND, F05 corretto, F06 recente. La diversificazione è una dichiarazione, non verificata dai singoli sottostanti.

**Calcolabile:** M=2.000, m=40%; Lf=20.000; autonomia 10 mesi; rate 4%; N=480.000; qL=5%; Cmax di inventario 75% «strumenti finanziari». **Non calcolabile/non svolto:** costo effettivo del portafoglio, correlazioni, volatilità e reale diversificazione, né X07/X08 dettagliati.

**Atteso:** **P/P/P/P/S/D**, profilo **PN-AFFIDA**. Punti di forza: cassa/regolarità; contesto neutro: struttura descritta; punto da approfondire: reperimento/spiegazione dei costi. Il 75% nella macrovoce finanziaria non attiva automaticamente R-E-01: non equivale a un singolo emittente e non prova adeguatezza.

**Errore da evitare:** confondere consulente con scarsa capacità, o assegnare maggiore competenza perché possiede molti strumenti.

### T07 — Imprenditore con reddito e patrimonio legati all'impresa

**Risposte:** S03 impresa, Y=6.000 di reddito personale disponibile, **non fatturato**; E=3.500; R=500; K=2.500; L=20.000; P=10.000. Quota d'impresa stimata 800.000 + casa 300.000 + L → A=1.120.000; D=200.000. A04 variabile prevedibile; A05 >80%. E02 50–<75%, propria impresa; E03 <25%; E04 sì. X02 garanzie personali dichiarate, senza importo; D02 UNREVIEWED. F01 HORIZON, F02 CHECKED, F03 diretta, F04 N/A (nessuna posizione finanziaria/previdenziale applicabile), F05 corretto, F06 recente.

**Calcolabile:** M=2.000, m=33,33%; Lf=10.000; autonomia 3,33 mesi; rate 8,33%; N considerato=920.000, qL=1,79%. **Non calcolabile:** obbligazioni contingenti garantite, valore verificato dell'impresa e loro impatto sul netto; questi limiti restano accanto al netto considerato. Scenario X01 non svolto.

**Atteso:** **P/P/D/D/D/P**; profilo **PN-COSTRUISCE**, limitato alle abitudini, non «patrimonio sicuro». Forze: metodo/avanzo; approfondimenti: garanzie, protezione e rischio economico comune.

**Errore da evitare:** aggiungere fatturato o utile societario a Y, sottrarre una garanzia con importo inventato, o nascondere la concentrazione perché il profilo narrativo è favorevole.

### T08 — Pensionato con reddito regolare e obiettivi

**Risposte:** pensione, Y=2.200; E=1.400; R=0; K=1.300; L=30.000; P=5.000; casa 180.000 → A=210.000; D=0. E02 >=75% immobile; E03 <25%; E04 no. F01 HORIZON, F02 CHECKED sul confronto risorse/budget già in pensione, F03 diretta, F04 N/A, F05 corretto, F06 recente.

**Calcolabile:** M=800, m=36,36%; Lf=25.000; autonomia 19,23 mesi; rate 0%; N=210.000; qL=14,29%. **Non calcolabile/non svolto:** adeguatezza futura della pensione, spese sanitarie o longevità; niente inferenza da età non raccolta.

**Atteso:** **P/P/P/P/D/P**, profilo **PN-COSTRUISCE**. La concentrazione nella casa è da contestualizzare ma non annulla la riserva o prescrive vendite. La sola fonte pensione >80% non attiva fragilità A.

**Errore da evitare:** chiedere adesioni previdenziali per ottenere F positivo, o classificare la casa come disponibile in pochi giorni.

### T09 — Professionista con entrate irregolari

**Risposte:** professionista, Y=4.000; E=2.500; R=500; K=1.800; L=15.000; P=3.000. A03 OCCASIONAL_GAP; A04 variabile poco prevedibile; A05 >80%. X01 Ymin=500. L + strumenti finanziari 15.000 → A=30.000, D=20.000. E02 50–<75%, tipo altro; E03 tutte dichiarate; E04 no. D02 UNREVIEWED; F01 IDEA, F02 ROUGH, decisione diretta, F04 EXPLAIN, F05 corretto, F06 recente.

**Calcolabile:** M=1.000, m=25%; Lf=12.000; autonomia 5,22 mesi; rate 12,5%; N=10.000; qL=50%; scenario I-A04=500−(1.800+500)=−1.800 €/mese. **Non calcolabile:** distribuzione futura degli incassi o probabilità di mancato pagamento; nessun reddito inventato per i prossimi mesi.

**Atteso:** **D/P/P/D/S/D**, profilo **non determinabile: nessuna corrispondenza**. C P riguarda pagamenti recenti e dati osservati, non tenuta al prossimo mese basso. Il limite è evidenziato da A e dallo scenario, senza cambiare il passato. Forze: riserva e avanzo medio; E descritta senza giudizio positivo; vulnerabilità contestuali: irregolarità e pratiche non verificate.

**Errore da evitare:** usare la sola media annuale per dichiarare un budget futuro sostenibile, oppure classificare tutti i professionisti come fragili.

### T10 — Persona senza investimenti

**Risposte:** dipendente, Y=1.800; E=1.400; R=0; K=1.200; L=6.000; P=0. Solo liquidità, A=N=6.000. E02 >=75%, tipo liquidità; E03 tutte; E04 no. F01 HORIZON per spesa programmata, F02 ROUGH, F03 diretta, F04 N/A validato, F05 corretto, F06 recente.

**Calcolabile:** M=400, m=22,22%; Lf=6.000; autonomia 5 mesi; rate 0%; qL=100%. **Non applicabile:** comprensione dei costi di posizioni che non possiede. **Non calcolabile/non svolto:** futuro rendimento o efficienza di un portafoglio inesistente, moduli opzionali comuni.

**Atteso:** **P/P/P/P/S/D**, profilo **non determinabile: nessuna corrispondenza** (COSTRUISCE non soddisfa F02; FERMI escluso da obiettivo con orizzonte). Il solo non investire non peggiora alcuna area; E neutra come negli altri inventari descritti. F D riguarda la verifica di lungo periodo, non la mancata adesione a prodotti.

**Errore da evitare:** trasformare F04 N/A in ignoranza, oppure considerare qL=100% automaticamente «soldi fermi».

### T11 — Nucleo con dati molto incompleti

**Risposte:** HOUSEHOLD e S02 PARTIAL. Conosce la fascia di entrate di un solo componente: Y [2.000,3.000), non del nucleo intero. A02 UNKNOWN, A03 UNKNOWN, A04 UNKNOWN; B01 UNKNOWN, B02 DECLINED, B03 UNANSWERED, B04 UNKNOWN. C01/C03 UNKNOWN, C02/C04 non ricostruibili. D01 UNKNOWN, E01 UNKNOWN, E02/E03/E04 indeterminati. F01 IDEA; F02 UNKNOWN, F03 UNANSWERED, F04 indeterminato, F05 UNKNOWN, F06 DECLINED. X04/X05 non forniti.

**Calcolabile:** soltanto descrizione delle risposte qualitative note, es. obiettivo ancora senza orizzonte. **Non calcolabile:** tutti i rapporti economici del nucleo, autonomia, stock totali e netto; non usare la fascia individuale come denominatore familiare. Nessun dato inventato per il partner o per L.

**Atteso:** **NV/NV/NV/NV/NV/D**, profilo **non determinabile: perimetro e dati insufficienti**. F D deriva da IDEA esplicito, non dai rifiuti. Se anche F01 diventa DECLINED, F passa a NV, non a peggiore salute. Priorità: chiarire perimetro e ciò che si desidera approfondire.

**Errore da evitare:** un voto medio per i vuoti, un profilo basato sul funnel o un messaggio negativo perché non si comunicano saldi.

### T12 — Situazione economica solida, assenza di pianificazione

**Risposte:** redditi regolari, Y=8.000; E=3.000; R=1.000; K=2.500; L=100.000; P=20.000. Strumenti 400.000, casa 300.000, altri immobili 200.000 → A=1.000.000, D=150.000. E02 <50%, tipo emittente finanziario; E03 almeno metà non tutte dichiarato; E04 no. Presidi D02 CHECKED. F01 NONE, F02 NOT_REVIEWED, F03 diretta, F04 EXPLAIN, F05 corretto, F06 mai.

**Calcolabile:** M=4.000, m=50%; Lf=80.000; autonomia 22,86 mesi; rate 12,5%; N=850.000, qL=10%; quota immobili aggregata 50%. **Non calcolabile:** obiettivi/tempi non dichiarati, adeguatezza futura delle risorse e utilità di scelte d'investimento.

**Atteso:** **P/P/P/P/S/D**, profilo **non determinabile: nessuna corrispondenza**. Forze economiche visibili, gap F non compensato da un patrimonio alto; nessun indice globale che lo nasconda. FERMI ha entrambi i canali falsi: inventario non di sola cassa, E02 <50% di tipo emittente finanziario e qL<80%; COSTRUISCE falso per obiettivi/revisione assenti.

**Errore da evitare:** dedurre pianificazione o competenza dalla sola ricchezza, oppure ridurre il netto per una «penalità» qualitativa.

## 3. Due casi aggiuntivi

### T13 — Profilo misto e patrimonio netto negativo

**Risposte:** Y=3.000; E=3.200; R=400; K=2.000; L=5.000; P=1.000. Strumenti 15.000 → A=20.000; D=30.000. A03 REPEATED_GAP; C03 ritardi risolti; D02 GAP. E02 >=75% in un emittente finanziario dichiarato; E03 almeno metà non tutte; E04 no. F01 IDEA, F02 ROUGH, F03 delega a professionista, F04 NOT_FOUND, F05 COUNT, F06 oltre12 mesi.

**Calcolabile:** M=−600 (−20%); Lf=4.000; autonomia 1,67 mesi; rate 13,33%; N=−10.000; qL=25%. **Non calcolabile:** gravità legale dei debiti, costi effettivi, efficacia della delega e moduli opzionali comuni.

**Atteso:** **A/D/A/D/D/D**. **Misto PN-MESE + PN-AFFIDA**, con due motivazioni indipendenti. Non scegliere uno «più basso», non far dipendere l'esito dalla selezione Evento. Il rapporto rate relativamente contenuto non nasconde il disavanzo; il netto negativo è mostrato senza troncamento.

**Errore da evitare:** mediare due profili, attribuire la difficoltà al consulente o dedurre scarsa capacità personale dalla delega.

### T14 — Fasce che attraversano i confini

**Risposte:** S02 COMPLETE; A01 Y=[2.000,3.000), A02 E=[1.500,2.000), C02 R12=[500,1.000), C04 Rnow=[500,1.000); K=[1.000,1.500); L=[5.000,10.000), P=1.000 puntuale. Tutte le fasce sono previste dal catalogo. A03 COVERED, A04 regolare, C03 nessuno, B04 somme disponibili. E01 liquidità e strumenti; E02/E03 UNKNOWN, E04 no; X04/X05 assenti. F01 HORIZON, F02 CHECKED, F03 diretta, F04 EXPLAIN, F05 corretto, F06 recente.

**Calcolabile come intervallo:** inviluppi conservativi M da circa −1.000 a 1.000 €/mese, m da circa −50% a 33,33%; Lf da 4.000 a meno di 9.000; fabbisogno da 1.500 a meno di 2.500; autonomia compresa in un inviluppo circa 1,6–6 mesi; rate fra circa 16,67% e 50%. Gli estremi aperti originali restano nel dato: l'inviluppo testuale non afferma che ogni estremo sia raggiungibile. **Non calcolabile:** netto, distribuzione completa e confronto puntuale di patrimonio.

**Atteso:** **D/D/D/P/NV/P**. La fascia autonomia attraversa 3 ma non giustifica ATTENZIONE <1. C resta da approfondire per contesto del margine non univoco, senza applicare un limite percentuale universale alle rate. Profilo **non determinabile**: nessun candidato certamente vero; COSTRUISCE richiede autonomia sicuramente >=3, MESE non è dimostrato da una fascia che include un disavanzo. La risposta qualitativa COVERED non restringe artificialmente i numeri.

**Errore da evitare:** midpoint che produrrebbe una falsa certezza, e falsa precisione «autonomia 3,4 mesi». Ulteriori valori puntuali possono risolvere il dubbio, ma non sono richiesti per un profilo migliore.

## 4. Controprove metodologiche, non test di codice

| ID | Variazione isolata | Esito progettuale atteso |
| --- | --- | --- |
| CT-01 | B02=0 reale, P=0 conseguente, K+Rnow=1.000 | Autonomia 0, B ATTENZIONE; diverso da B02 UNKNOWN/DECLINED/UNANSWERED, che non produce zero |
| CT-02 | K=0 e Rnow=0 con Lf>0 | Autonomia non calcolabile per denominatore nullo; niente infinito o «massima sicurezza» |
| CT-03 | P=6.000 e L=5.000 puntuali | Anomalia, Lf/autonomia non calcolabili finché non chiariti; niente correzione silenziosa con max(0,L−P) |
| CT-04 | T=1.000 e Lf=999/1.000/2.999/3.000 | Autonomia 0,999/1/2,999/3; rispettivamente criterio quantitativo ATTENZIONE / DA_APPROFONDIRE / DA_APPROFONDIRE / requisito per PRESIDI; quest'ultimo richiede anche B04 e coerenza |
| CT-05 | Y=0, E=500, R12=100 | Margine −600; tasso di margine e incidenza rate non calcolabili. Nessuno 0% o percentuale infinita |
| CT-06 | C01 nessuno, Y=0, C03 nessuno; poi C03 passa a ritardi in corso | Prima: assenza dichiarata, rapporto 0/0 non calcolabile. Dopo: C ATTENZIONE, D non è più zero strutturale; senza X05 N non calcolabile. A/B non ereditano esito favorevole |
| CT-07 | C01 passa da debiti a nessuno e poi torna debiti | Risposte dipendenti prima inattive, poi da riconfermare; zero strutturale non resta attivo dopo il secondo cambiamento |
| CT-08 | T04 con F01 HORIZON e obiettivo vicino confermato | FERMI falso a parità di cassa; niente pressione a investire una liquidità destinata a scopi precisi |
| CT-09 | T06 cambia F03 da professionista a diretta, costi ancora NOT_FOUND | F rimane D; AFFIDA diventa falso. Il gap costi non è causato dalla delega |
| CT-10 | T07 aumenta il valore della quota d'impresa mantenendo L e flussi | A/N aumentano, B non cambia, E04 sì resta approfondimento. Nessun miglioramento automatico del «punteggio» |
| CT-11 | Pensionato con Y=2.000, E=2.500, R=0, A03 PLANNED_DRAW, riserva nota | M=−500 ma PN-MESE non deriva dal solo disavanzo; A D per verificare il piano, non giudizio di crisi o sostenibilità attuariale |
| CT-12 | Inventario con L=10.000, FI=UNKNOWN, casa=200.000 | Subtotale noto 210.000 esplicito; A totale, quote e N complessivo non calcolabili; niente percentuali che sommino a 100% sulle sole voci note |
| CT-13 | Inventario completo A=0, D=5.000, stesso perimetro/data | N=−5.000 calcolabile, composizione/quote N/A, **area E DA_APPROFONDIRE** per debiti senza attività dichiarate e netto negativo. Nessuna diagnosi di insolvenza o merito creditizio. D ignoto con debito aperto noto mantiene E D ma N non calcolabile; D ignoto senza presenza risolta lascia E NV; D=0 confermato dà E S, non P |
| CT-14 | M puntuale <0 ma A03 COVERED senza spiegazioni compatibili | Chiarire coerenza/definizioni; non trattare entrambe le dichiarazioni come confermate. Le conclusioni dipendenti sono sospese, non scelto il dato più favorevole |
| CT-15 | F05 UNKNOWN → COUNT | Da mancanza di evidenza a risposta non corretta sul singolo quesito; non da 0 a voto negativo globale. Mostrare spiegazione, nessuna misura di competenza personale |
| CT-16 | E02 passa dalla fascia 50–<75% alla fascia >=75%, tipo immobile | Cambia il segnale H-E75: DA_APPROFONDIRE nella seconda condizione, non un consiglio di vendita. La percentuale puntuale rimane sconosciuta |
| CT-17 | qL attraversa 80% oppure autonomia attraversa 3 per PN-FERMI | qL incerto lascia H-P80 indeterminato, ma un H-PQUAL vero e requisiti comuni veri permettono il candidato qualitativo, senza percentuale confermata. Se anche H-PQUAL non risolto, candidato indeterminato. Autonomia che attraversa 3 lascia indeterminato il requisito comune anche con qL noto; salvo altro requisito falso. Nessun arrotondamento per forzare |
| CT-18 | Stesso dataset, sola modifica del profilo autoselezionato Evento o presenza all'evento | Nessuna modifica a indicatori, stati o profilo derivato |
| CT-19 | Cambia solo la finestra/perimetro fra due episodi | Bloccare il confronto non omogeneo; non presentare automaticamente miglioramento/peggioramento |
| CT-20 | X07 corretto o errato, tutto il resto invariato | Nota didattica del singolo esercizio; nessun ricalcolo automatico dei costi reali o della solidità economica |
| CT-21 | T04 con tutte le risposte ordinarie ma X04 non svolto; X05 non necessario per D=0 strutturale | H-PQUAL vero da E01/E02, a=120 e B04 coerente, A03 COVERED, F01 NONE; altri candidati falsi → **FERMI prevalente qualitativo**. A/N/qL non calcolati, H-P80 non svolto. E S da risposte qualitative complete, nessun presidio patrimoniale. M, Lf, autonomia e rate invariati rispetto a T04 |
| CT-22 | T04 con E02 UNKNOWN: prima X04 assente, poi X04 completo (L=200.000, FI=20.000) | Prima prevalenza non risolta, candidato FERMI indeterminato; dopo A=220.000, qL=90,91%, H-P80 vero → **FERMI quantitativo determinabile**, altri candidati falsi. E rimane NV per E02 mancante, non diventa P. Aggiunta X04 non cambia M/autonomia. Variante qL=79% con E02 liquidità >=75% coerente: H-P80 falso, H-PQUAL vero e requisiti comuni veri conservano il candidato qualitativo, senza chiamarlo confermato quantitativamente |
| CT-23 | S02 COMPLETE, E01 nessuna attività confermata, L=P=0, Y=1.500, E=1.000, R12=Rnow=0, K=900; C01 altro debito aperto, C03 nessuno, X05 D=5.000 completo | A=0 strutturale senza X04, N=−5.000; quote N/A, **E D** con fatto debitorio visibile in entrambe le viste. M=500, autonomia=0 e B ATTENZIONE. D passa a 6.000: cambia N a −6.000, non M/Lf/autonomia/rate. Debito presente non significa ritardo o insolvenza |
| CT-24 | T02, inventario e risposte E completi, nessun R-E-01, nessuna prova ulteriore di adeguatezza | **E S**, non P: struttura descritta e limiti espliciti, nessuna forza inventata per assenza di alert. Avanzo, riserva e pagamenti restano forze locali A/B/C; stessi indicatori numerici. Se E02 diventa DECLINED senza altri segnali, E NV: rifiuto non è peggioramento economico |
| CT-25 | CT-21 con F03 professionista e F04 NOT_FOUND per FI già presenti in E01 | FERMI qualitativo e AFFIDA veri → **misto**; MESE/COSTRUISCE falsi. Non scegliere il profilo per potenziale vendita; indicatori A/B/C/E invariati. Un obiettivo vicino aggiunto e riconciliato in F01 HORIZON esclude FERMI a parità di liquidità, lasciando AFFIDA |
| CT-26 | Stesso risultato CT-23 proiettato a cliente/operatore | Stesso ID/revisione/versione e stato E D. Cliente: «Sono presenti debiti senza attività dichiarate; la posizione va chiarita», senza mostrare automaticamente tutti gli importi. Operatore autorizzato: A=0, D=5.000, N=−5.000, formula/input/limiti. Nessuna sintesi «nessuna anomalia» o forza inventata; accesso ai dati della persona disponibile nel percorso separato |
| CT-27 | Stesso risultato, assegnazione effettiva passa da operatore fittizio OP-A a OP-B o viene revocata; browser invia vecchio owner/email | Conclusioni e risposte invariate. Nuova lettura dettagliata di OP-A negata salvo distinta autorizzazione corrente; OP-B ammesso solo con ruolo/scopo verificati. Nessuna fiducia nel browser, nel riferimento opaco o in vecchie credenziali in cache. È un criterio futuro da collaudare, non una prova ACL eseguita |
| CT-28 | Stessa esigenza/risultato; nel catalogo futuro cambia una commissione commerciale, poi mancano verifiche della soluzione, infine nessuna candidata è identificata | La commissione non modifica diagnosi o pertinenza. Scheda non verificata → non valutabile per informazioni insufficienti; catalogo senza candidata sufficientemente identificata → nessuna soluzione del catalogo identificata. Incompatibilità certa → incompatibile con vincoli, non compensabile con ricavi (specificazione 3C del precedente «non coerente»). Nessuna raccomandazione automatica, nessuna scrittura CRM |
| CT-29 | Stessi tre obiettivi e importi; cambia solo l'ordine confermato | Cambiano agenda/ranghi; riferimenti, G_i e vincoli rimangono con le rispettive righe. M/autonomia/A/D/N, F01/F03 e profili invariati se gli altri dati non cambiano. Nessuna redistribuzione per posizione |
| CT-30 | G0=0 reale, poi UNKNOWN, DECLINED o UNANSWERED | Zero dichiara nessuna quota attuale destinabile di L; gli altri stati non lo dichiarano. Confronto di capienza non calcolabile coi mancanti; nessun patrimonio/obiettivo inventato e nessuna penalità diagnostica |
| CT-31 | G0=15.000, G_1=10.000 e G_2=8.000 nello stesso fondo; poi G_2=UNKNOWN; variante G0 in fascia | Prima 18.000>15.000: attribuzione eccedente 3.000 da chiarire. Dopo non dichiarare capienza sufficiente né sommare ignoto come zero. Variante L=40.000/P=5.000/Cmin=10.000/G0=[10.000,25.000), attribuzioni 18.000: la fascia permette entrambe le letture, capienza da chiarire senza midpoint. Nessuna ridistribuzione |
| CT-32 | Due obiettivi una tantum in date diverse e uno continuativo senza importo complessivo | Non sommare costi come impegno simultaneo o capitalizzare il continuativo. Risorse attuali non dimostrano capacità futura; M×mesi/rendimento/nuovo credito non colmano il dato. Attribuzioni attuali dallo stesso G0 restano comunque un solo fondo |
| CT-33 | E01 indica strumenti del nucleo, X10 non fornito; poi X10 «detenuti con decisioni affidate ad altri» | Prima nessuna esperienza personale dedotta dal possesso; dopo soltanto episodio dichiarato, non competenza o appropriatezza. Quiz/costi e loro risultati non vengono migliorati |
| CT-34 | F03 delega attuale, X11 desiderio di capire e decidere direttamente | Nessuna contraddizione automatica fra oggi e prossimo incontro. F03/PN-AFFIDA non cambiano; agenda aggiornata. X11 non conferisce né revoca deleghe e non prenota nulla |
| CT-35 | T04 acquisisce X06 v2 con un obiettivo temporizzato, anche soltanto secondario, F01 resta provvisoriamente NONE | Lettura FERMI incompatibile sospesa e chiarimento F01 proposto. Dopo revisione esplicita HORIZON, FERMI falso. Importi, M/autonomia/N invariati; il rango principale non nasconde il bisogno vicino del secondario. Nessun aggiornamento nascosto o «rendimento perso» |
| CT-36 | F01 NONE noto e X06 non svolto; confronto con F01/X06 UNKNOWN o DECLINED | Riutilizzare il primo come livello dichiarato di definizione, non come lista vuota esaustiva. Negli altri nessuna assenza di obiettivi imputata. X11 può chiedere utilità del colloquio senza ripetere F01 o imporre cifre |
| CT-37 | Scheda candidata fittizia: indisponibilità24 mesi contro bisogno entro12 e vincolo d'accesso non negoziabile; altra con finalità estranea; terza non verificata | Prima incompatibile, seconda non pertinente solo se obiettivi/finalità noti, terza insufficiente. Schede illustrative, nessun prodotto Horyzon attestato. Con obiettivi ignoti non assegnare «non pertinente» per default. Catalogo consultabile senza candidata → nessuna soluzione identificata; catalogo assente/incompleto → confronto insufficiente, non prova di assenza |
| CT-38 | Aumenta solo la stima di un'attività non liquida, G0/vincoli/obiettivi invariati | A/N cambiano se inventario completo; G0 e capienza del fondo non aumentano, nessuna priorità commerciale. Una vulnerabilità non attiva un suggerimento di vendita o un prodotto per «risolverla» |
| CT-39 | Una riga X06 con G_i/vincoli viene eliminata o una v1 viene ripresa in v2; ordine v2 non noto | Rimozione disattiva i legami nella nuova revisione, non cancella lo storico né redistribuisce soldi. Ripresa v1 conserva categoria/tempo/importo e provenienza, rango principale/natura/secondari non inventati. Anche in v2 ordine UNKNOWN/DECLINED/UNANSWERED conserva gli obiettivi senza un principale presunto |
| CT-40 | Modulo ripreso con dati già noti e alcuni rifiutati; confronto delle due proiezioni/CRM | Riutilizzare riferimenti correnti, chiedere solo chiarimenti pertinenti e facoltativi; niente rivelazione ripetuta forzata. Advisor distingue fatti/confronti/ipotesi; cliente conserva i limiti materiali; nessun campo X06/X09–X11 amplia l'allowlist HighLevel o finisce in URL/email/log generici |

## 5. Sintesi delle attese e limiti

| Caso | A | B | C | D | E | F | Profilo atteso |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T01 | P | P | P | P | S | P | COSTRUISCE |
| T02 | P | P | P | P | S | P | COSTRUISCE |
| T03 | A | A | A | D | D | D | MESE |
| T04 | P | P | P | P | S | D | FERMI, base qualitativa e quantitativa |
| T05 | D | A | P | D | D | D | Non determinabile, nessuna corrispondenza |
| T06 | P | P | P | P | S | D | AFFIDA |
| T07 | P | P | D | D | D | P | COSTRUISCE, senza promessa di sicurezza |
| T08 | P | P | P | P | D | P | COSTRUISCE |
| T09 | D | P | P | D | S | D | Non determinabile, nessuna corrispondenza |
| T10 | P | P | P | P | S | D | Non determinabile, nessuna corrispondenza |
| T11 | NV | NV | NV | NV | NV | D | Non determinabile, dati/perimetro |
| T12 | P | P | P | P | S | D | Non determinabile, nessuna corrispondenza |
| T13 | A | D | A | D | D | D | Misto MESE + AFFIDA |
| T14 | D | D | D | P | NV | P | Non determinabile, intervalli |

La ripetizione di alcuni esiti non dimostra discriminazione sufficiente del modello: è un aspetto da studiare nel pilot. I casi controllano coerenza logica e numerica, non sensibilità/specificità, stabilità temporale o efficacia educativa. La precisione a due decimali qui serve alla revisione delle formule; nel report rivolto alla persona usare arrotondamenti comprensibili senza spostare le soglie.

Accettazione prima dell'implementazione: revisione indipendente delle 14 fixture diagnostiche e degli otto scenari obiettivi (22 schede/scenari), delle 40 controprove e della distinzione fatti/confronti/ipotesi; verifica linguistica dei motivi di ogni stato; nessuna motivazione usa un dato non raccolto. Mancanti, misto e nessuna corrispondenza ammessi. Queste attese non sono risultati software già certificati.

## 6. Esiti della revisione 3B e granularità delle due viste

Le 14 simulazioni conservano input e aritmetica della 1.0. Cambiano i soli esiti E prima erroneamente positivi: T01/T02/T04/T06/T09/T10/T12 da P a S. T03/T05/T07/T08/T13 rimangono D; T11/T14 NV. Profili originari invariati, con motivazione dei canali FERMI esplicitata; CT-21/22 dimostrano progettualmente l'assenza della dipendenza obbligatoria da X04. CT-13/23 correggono l'esclusione indebita dell'intera E. CT-17 distingue incertezza del canale quantitativo e incertezza di un requisito comune. Le 20 controprove originali non sono rimosse; CT-21–24 coprono i quattro casi aggiuntivi richiesti, CT-25–28 aggiungono profilo misto, fedeltà delle proiezioni, autorizzazioni e catalogo.

| Fixture | Client Result: testo sintetico ammesso | Advisor Intelligence: evidenze aggiuntive autorizzate |
| --- | --- | --- |
| T03 | «Hai indicato ritardi ancora in corso e una riserva breve rispetto alle spese essenziali. Sono i primi aspetti da chiarire». Nessun punto di forza patrimoniale inventato | Risposte originali, M=−600, a≈0,32, C03, A/D/N, regole e priorità senza duplicazione, domande sul perimetro; nessuna qualificazione di insolvenza |
| T04/CT-21 | «La liquidità è prevalente nelle risposte disponibili; gli obiettivi non sono ancora definiti». Avanzo/riserva come forze se supportati; non «cassa da investire» | Base qualitativa e conferma quantitativa separata; nella CT-21 niente A/N/qL inventati; F01, P e autonomia contestualizzano il colloquio |
| T11 | «Questa fotografia è parziale. Alcune informazioni del bilancio condiviso mancano; puoi scegliere cosa chiarire». Nessuna forza generica da riempitivo | Distinti UNKNOWN, DECLINED, UNANSWERED e applicabilità indeterminata; singolo reddito non usato come denominatore del nucleo; domande senza richiesta di dati del partner identificabili |
| CT-23 | «Sono presenti debiti senza attività dichiarate. La posizione va approfondita» | Netto negativo con formula e importi; assenza di attività distinta da mancanza di informazioni; stesso fatto materiale del cliente |

Questi sono confronti documentali su dati sintetici, non schermate prodotte da software. Identità/assegnazioni fittizie non partecipano a formule o profili. La selezione sintetica non cambia stati o nasconde limiti; matrice completa disponibile solo attraverso la corretta autorizzazione, incluso il percorso distinto per i diritti della persona.

## 7. Otto scenari aggiuntivi sugli obiettivi (Fase 3C)

T0 e stati sono quelli del catalogo. I dati sono tutti fittizi. Queste schede non inventano un catalogo reale: le categorie menzionate sono temi da esaminare al colloquio, non offerte o raccomandazioni. In assenza di una scheda reale verificata non si dichiara una soluzione Horyzon identificata. F01 temporizzato, quando indicato, è una revisione esplicita; non deriva dal solo completamento del modulo.

### G01 — Stesso patrimonio, obiettivi diversi

**Dati:** due varianti di T04 con identici flussi, L/P, A=220.000 e D=0. Entrambe confermano F01 HORIZON. X06 v2 rango1: nella prima una spesa programmata entro12 mesi, nella seconda organizzare risorse di lungo periodo oltre36 mesi. Stesso Cmin=50.000 e G0=20.000, nessuna attribuzione aggiuntiva; il primo caso richiede accesso entro7 giorni non negoziabile, il secondo non esprime questo vincolo. X11 ricostruire risorse/vincoli oppure organizzare lungo periodo, rispettivamente.

**Atteso:** M=2.500, autonomia120 e N=220.000 identici; FERMI escluso in entrambe per F01 con orizzonte. Cambiano temi/limiti del colloquio, non il valore della persona. «Oltre36» non equivale a consenso a perdite o immobilizzo. Nessun prodotto dedotto dal patrimonio o dall'orizzonte.

### G02 — Stesso obiettivo, disponibilità economiche diverse

**Dati:** nucleo di T02, obiettivo rango1 spesa per abitazione entro36 mesi, 30.000. Variante A conserva L=20.000/P=5.000, Cmin=10.000, G0=8.000. Variante B ha L=10.000/P=5.000, Cmin=8.000, G0=1.000; casa300.000 e FI90.000 invariati, X04 riconfermato. X11 verificare risorse/vincoli in entrambe.

**Atteso:** M=700 e rate20% invariati. Autonomia cambia da5,77 a1,92 mesi perché cambia L; A/N da410.000/230.000 a400.000/220.000. Le conseguenze B/PN-COSTRUISCE seguono le dipendenze 3B, non il budget obiettivo. G0<=L−Cmin in entrambe. 30.000 supera la quota attuale in entrambi i casi, ma non si deduce impossibilità futura né un prestito necessario. Nessuna graduatoria commerciale per8.000 contro1.000.

### G03 — Necessità di liquidità a breve termine

**Dati:** solo modulo, perimetro individuale completo. L=30.000/P=5.000; Cmin=15.000; G0=10.000. F01 HORIZON; X06 rango1 spesa programmata entro12 mesi, una tantum8.000; G_1=8.000. X09 accesso entro7 giorni non negoziabile. X11 capire disponibilità/risorse; X10 dubbio sui tempi di accesso.

**Atteso:** G0<=15.000 e attribuzione8.000<=10.000. Chiarire quando, nella fascia0–12, serve la prima somma; non assumere12 mesi. Una condizione fittizia di indisponibilità24 mesi non supera il vincolo, anche se presentata come redditizia. Gli altri indicatori non raccolti restano non calcolabili, nessun quadro patrimoniale totale inventato.

### G04 — Obiettivo di lungo periodo

**Dati:** individuale completo; L=40.000/P=5.000; Cmin=25.000; G0=10.000. F01 HORIZON; X06 rango1 organizzare risorse di lungo periodo/pensione oltre36 mesi, esigenza continuativa senza capitale complessivo noto; G_1 non attribuito. X10 vorrebbe risultati elevati senza rischio e non conosce i vincoli; X11 capire informazioni e professionisti necessari.

**Atteso:** G0<=15.000 ma non esiste un importo-obiettivo da finanziare calcolabile. Aspettativa da chiarire, non tolleranza alta o capacità di perdita, nessuna promessa di rendimento/previsione previdenziale. Tema del colloquio: risorse, periodicità e limiti; nessuna classe di strumenti selezionata automaticamente dall'orizzonte.

### G05 — Più obiettivi incompatibili con le risorse dichiarate

**Dati:** individuale completo; L=30.000/P=5.000; Cmin=15.000; G0=15.000. F01 HORIZON. X06 rango1 abitazione10.000 e rango2 sostegno di altre persone8.000, entrambi una tantum entro12 mesi con prima esigenza nello stesso periodo. Attribuiti G_1=10.000 e G_2=8.000 dallo stesso G0; nessuna ulteriore fonte dichiarata.

**Atteso:** il fondo attuale è impegnato per18.000 contro15.000, eccedenza3.000 da chiarire. Non tagliare il secondo obiettivo, ridistribuire i soldi, inventare redditi/rendimenti/credito o diagnosticare insolvenza. Agenda: rivedere attribuzioni o precisare fonti/tempi reali. Se gli orizzonti cambiano, non sommare costi come contemporanei; il vincolo sul singolo fondo attuale resta.

### G06 — Obiettivi ancora sconosciuti

**Dati:** F01 UNKNOWN, X06 UNKNOWN, X09 DECLINED, X10 UNANSWERED. X11 chiarire gli obiettivi e capire alternative senza decidere ora. Nessun importo e nessuna categoria di strumenti dichiarati. Variante: F01 NONE già noto e nessun dettaglio X06 richiesto.

**Atteso:** UNKNOWN/rifiuto/non risposto distinti; niente G0=0, orizzonte lungo o preferenza per prodotti semplici imputati. Nel secondo caso riusare «nessun obiettivo definito» senza richiederlo di nuovo, non inventare una lista esaustiva. Chiarire obiettivi è finalità esplicita del servizio, non un obiettivo di investimento. Senza catalogo consultabile il confronto è insufficiente, non un esito negativo sull'intero catalogo; una candidata finanziaria non è «non pertinente» solo perché gli obiettivi sono ignoti.

### G07 — Patrimonio elevato con forti vincoli

**Dati:** T12, A=1.000.000/N=850.000, L=100.000/P=20.000. Conferma esplicita F01 HORIZON, obiettivo di lungo periodo; Cmin=100.000, G0=0. Vincoli: non intaccare riserva/impegni, non usare abitazione/impresa, non assumere nuovo debito, tutti non negoziabili e globali. Altri strumenti già dichiarati possono essere «da esaminare», senza importo aggiunto a G0.

**Atteso:** residuo rispetto a Cmin=0 e G0=0 coerente; nessuna disponibilità attuale di quella cassa destinata agli obiettivi. Valore di casa/FI non diventa disponibilità entro la scadenza né supera i vincoli. Nessuna priorità commerciale aumentata dal milione. Obiettivo futuro non provato impossibile: disponibilità di altre risorse richiede verifica separata. Gli indicatori patrimoniali originali non cambiano per la sola preferenza.

### G08 — Nessun investimento con buona pianificazione

**Dati:** T01, solo liquidità L=12.000/P=2.000, F01 HORIZON e pratiche F già dichiarate. X06 v2 rango1 riserva per imprevisti entro12 mesi; Cmin=8.000, G0=1.000, G_1=1.000. X10 nessuna esperienza da segnalare; X11 capire e decidere direttamente, chiarire risorse/vincoli.

**Atteso:** G0<=4.000, quote non duplicate; M=400, autonomia9,09 e N=12.000 originari invariati. F04 N/A validato e PN-COSTRUISCE conservati; non investire o non avere esperienza non peggiora la pianificazione. La scelta di riserva non raccomanda un prodotto e non viene sottratta di nuovo da Lf; se un impegno cambia davvero B03 si richiede revisione esplicita.

## 8. Sintesi delle controprove 3C

Gli otto scenari distinguono obiettivo, preferenza, disponibilità dichiarata e capacità da verificare. Le 12 nuove controprove verificano le conseguenze attese su ordine/mancanti/fondi/tempi/esperienza/stile decisionale/versioni/proiezioni. Le 14 fixture e formule originarie restano comparabili alla 3B; i G derivati esplicitamente da T introducono solo le variazioni dichiarate, con conseguenze condivise visibili (esempio L in G02). Nessuna attesa viene presentata come test software, appropriatezza o validazione scientifica.
