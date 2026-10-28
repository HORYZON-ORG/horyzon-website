# Radar Patrimoniale V1 — Catalogo delle domande

Versione **RP-Q-1.2-draft**, Fase 3C del 18 ottobre 2026, dalla baseline `e11a31b9903fdb8efff31f6d9153bafe6dd854f9`. Proposta coordinata con [metodologia](radar-patrimoniale-v1-metodologia.md), [scoring](radar-patrimoniale-v1-scoring.md), [casi](radar-patrimoniale-v1-profili-test.md), [due viste](radar-patrimoniale-v1-doppia-vista.md) e [profilazione degli obiettivi](radar-patrimoniale-v1-profilazione-obiettivi.md). Solo specifica: nessun questionario eseguibile. Le 29 domande ordinarie restano invariate; X06 ha versione di domanda 2, X09–X11 sono nuovi approfondimenti facoltativi.

## 1. Convenzioni vincolanti

**29 domande di base:** S01–S04, A01–A05, B01–B04, C01–C04, D01–D02, E01–E04, F01–F06. **11 approfondimenti:** X01–X11. Totale **40 ID**: conservati i 37 precedenti, aggiunti X09/X10/X11; nessun ID riciclato. La versione di ogni risposta distingue X06 v1 da v2, senza riscrivere lo storico. «Base» significa appartenente al percorso ordinario, non obbligo di rivelare il dato. Alcune domande sono condizionali: massimo ordinario 29; i percorsi semplici presentano normalmente circa 25–29 prompt, meno nei casi di zeri reali che escludono interi rami. Le matrici contengono più campi e non vanno contate come una sola interazione nelle prove di durata.

Introduzione esatta proposta: «Scegli se descrivere solo la tua situazione o il bilancio che condividi con altre persone. Mantieni la stessa scelta in tutte le risposte. Puoi indicare una fascia, una stima, “Non so” o “Preferisco non rispondere”. Non inserire nomi, dati sanitari o informazioni di conto. Il percorso è rivolto a persone maggiorenni e usa importi in euro».

### Stati, obbligatorietà e non applicabilità

Per tutti gli item si distingue:

| Stato logico | Etichetta alla persona | Effetto |
| --- | --- | --- |
| VALUE | Una delle risposte o un importo scelto | Valore valido, compreso **0 reale** per gli importi e «nessuno» per gli insiemi |
| UNKNOWN | Non so | Domanda visitata, informazione non disponibile; mai risposta media o errata |
| DECLINED | Preferisco non rispondere | Domanda visitata, dato non acquisito; nessuna penalità numerica |
| NOT_APPLICABLE | Non applicabile | Stato accettato soltanto se il predicato di applicabilità è verificato; mostrare il motivo |
| UNANSWERED | Nessuna risposta ancora fornita | Stato iniziale o domanda saltata; non trasformarlo in uno degli altri |

La scelta «Non applicabile» non consente di nascondere una criticità: se la motivazione non è verificabile, il dato resta dichiarato non applicabile **non confermato**, con applicabilità indeterminata, nessun contributo e nessuna esclusione favorevole dalla completezza. Si può spiegare «Se l'importo è zero, scegli zero». Non si impone di dare un dato economico.

Metadati di percorso separati: applicabile / non applicabile / indeterminato; attivo / inattivo / da riconfermare. Il salto tecnico di una domanda non è rifiuto della persona. Gli item di base richiedono una scelta per il normale avanzamento, ma UNKNOWN e DECLINED consentono di continuare; è sempre possibile chiedere una fotografia parziale con UNANSWERED espliciti. RP-S01 senza scelta del perimetro sospende ogni conclusione che combini importi.

«O» sotto = base, scelta di stato prevista quando applicabile; «F» = approfondimento facoltativo, nessun blocco sul completamento ordinario. Il requisito metodologico per un indicatore non è un obbligo di risposta per ottenere il servizio.

### Importi, tempi e precisione comuni

Tutti gli importi sono EUR non negativi. Interfaccia futura: fascia predefinita oppure importo facoltativo dichiarato, fino ai centesimi; nessun valore precompilato eccetto zero logicamente conseguente a una risposta esplicita. Finito, niente NaN/infinito; separatore italiano normalizzato senza ambiguità. Un valore elevato richiede conferma, non un tetto che escluda persone facoltose.

**FM**, fasce mensili per flussi: `0`; `più di 0 e meno di 500`; `[500,1.000)`; `[1.000,1.500)`; `[1.500,2.000)`; `[2.000,3.000)`; `[3.000,5.000)`; `[5.000,10.000)`; `10.000 o più`. Notazione [a,b) = a incluso, b escluso. L'opzione annuale propone estremi moltiplicati per 12, separando sempre zero; viene normalizzata dividendo per 12, senza midpoint.

**ST**, fasce per stock/accantonamenti: `0`; `(0,1.000)`; `[1.000,5.000)`; `[5.000,10.000)`; `[10.000,25.000)`; `[25.000,50.000)`; `[50.000,100.000)`; `[100.000,250.000)`; `[250.000,500.000)`; `500.000 o più`. Sono granularità privacy **Horyzon**, non soglie di salute. Per X04/X05 si usano ST o valori; una fascia superiore aperta resta senza massimo.

Per ogni valore: periodo, unità e qualità `riportato da un riepilogo / stimato / fascia`; per i valori riportati non si afferma verifica esterna. La fascia è già approssimata. Aiuto comune: «Una stima va bene: scegli quanto è precisa. Se il dato manca, non inventarlo».

- `T0`: data della compilazione per stock e situazione attuale.
- `T12`: ultimi 12 mesi completi antecedenti il mese di T0; esempio compilazione ottobre 2026 → ottobre 2025–settembre 2026. Un valore mensile T12 è la **media dei 12 mesi**, non il solo stipendio di oggi. Avvio recente senza 12 mesi: dichiarare copertura parziale, niente annualizzazione inventata; lettura qualitativa e approfondimento consentiti.
- `Tnow`: mese corrente/budget mensile essenziale a T0, distinto da T12.
- Famiglia: stesso insieme di persone per tutti i campi. Quote individuali sconosciute non vengono divise automaticamente per il numero di persone.

## 2. Contesto

### RP-S01 — Unità di analisi

- **Testo:** «Quale situazione vuoi descrivere?» **Aiuto:** «Scegli una sola unità. Se scegli il nucleo, considera il bilancio che condividete ed evita di contare due volte trasferimenti fra voi».
- **Area/tipo:** contesto trasversale; scelta singola. **Opzioni:** `INDIVIDUAL` Solo la mia; `HOUSEHOLD` Il nucleo con cui condivido il bilancio; più stati comuni. Nessuna unità monetaria.
- **O; comparsa:** sempre, prima degli importi. **Dipendenze:** nessuna.
- **Validazioni:** una scelta; N/A non confermabile. Se cambia, tutti gli importi e le responsabilità diventano da riconfermare prima di riusarli.
- **Diagnosi/motivo:** delimita a chi si riferisce il risultato; non genera una valutazione positiva/negativa.
- **Privacy:** non richiede nominativi o relazione giuridica fra componenti.

### RP-S02 — Copertura del perimetro

- **Testo:** «Per la situazione scelta, quanto sono completi i dati che puoi indicare?» **Aiuto:** «Per esempio: conosci tutte le entrate ma soltanto una parte delle spese?»
- **Area/tipo/opzioni:** contesto; singola: `COMPLETE` Entrate, spese e quote si riferiscono allo stesso perimetro; `PARTIAL` Conosco solo una parte del bilancio; stati comuni. «Non riesco a stabilirlo» è UNKNOWN, non un secondo valore indistinguibile da «Non so».
- **O; comparsa:** sempre dopo S01, anche se non risposto. **Dipendenze:** S01.
- **Validazioni:** non inferire COMPLETE dalla compilazione di molti campi; PARTIAL sospende rapporti trasversali e netto riferito all'intero nucleo. Una revisione esplicita può correggerlo.
- **Diagnosi/motivo:** abilita o limita confronti fra quantità; distingue dettaglio disponibile e perimetro coerente.
- **Privacy:** sola autovalutazione della copertura, nessuna motivazione libera obbligatoria.

### RP-S03 — Situazione delle entrate

- **Testo:** «Da quali situazioni arrivano le entrate del perimetro scelto?» **Aiuto:** «Puoi selezionarne più di una. Per il lavoro autonomo considera il denaro disponibile per la vita personale, non il fatturato».
- **Area/tipo:** contesto/A/F; multipla. **Opzioni:** lavoro dipendente; professione/lavoro autonomo; impresa di cui sei/siete titolari; pensione; rendite/affitti; trasferimenti o sostegno regolare; nessuna entrata; stati comuni.
- **O; comparsa:** sempre. **Dipendenze:** S01.
- **Validazioni:** «nessuna» esclusiva; più fonti non equivalgono a indipendenza. Pensione può coesistere con lavoro; non chiedere il nome della fonte.
- **Diagnosi/motivo:** contestualizza A e la formulazione di F02, non attribuisce punti a ruoli professionali.
- **Privacy:** niente datore di lavoro, impresa, ente specifico o causale assistenziale/sanitaria.

### RP-S04 — Responsabilità economiche

- **Testo:** «Quante altre persone dipendono in misura importante dalle risorse di questo bilancio?» **Aiuto:** «Indica solo un numero approssimativo, senza nomi o informazioni personali».
- **Area/tipo/opzioni:** contesto/D; singola: 0, 1, 2, 3 o più, stati comuni. Unità: persone oltre chi sostiene il bilancio; per nucleo non sommare più volte la stessa persona.
- **O; comparsa:** sempre. **Dipendenze:** S01.
- **Validazioni:** zero reale distinto da sconosciuto; non ricavare scale di equivalenza o reddito equivalente da «3+».
- **Diagnosi/motivo:** interpreta le responsabilità, non aggiusta il reddito con coefficienti inventati. Se D01 omette sostentamento con S04>0, chiedere conferma senza cancellare risposte.
- **Privacy:** niente età, salute o identità dei dipendenti economici.

## 3. A — Equilibrio economico

### RP-A01 — Entrate nette disponibili

- **Testo:** «Negli ultimi 12 mesi, quali sono state le entrate nette disponibili per il bilancio scelto?» **Aiuto:** «Puoi indicare il totale annuo oppure la media mensile. Per attività autonome sottrai costi di lavoro, imposte e contributi. Escludi nuovi prestiti, vendite di beni, prelievi dal patrimonio e trasferimenti interni al nucleo».
- **Area/tipo/opzioni:** A; importo FM con periodo T12 mensile/annuo, valore facoltativo o stati comuni; EUR. Zero è ammesso e non è N/A.
- **O; comparsa:** sempre. **Dipendenze:** S01/S02; contesto S03.
- **Validazioni:** non usare fatturato/utile societario non distribuito; confermare un conflitto «nessuna entrata» con valore positivo. Copertura temporale incompleta segnalata, senza extrapolazione.
- **Diagnosi/motivo:** Y per I-A01/A02, I-C01/C02; base dei flussi, non indicatore di merito personale.
- **Privacy:** importo aggregato e fascia preferita, nessuna fonte nominativa.

### RP-A02 — Spese senza rate

- **Testo:** «Nello stesso periodo, quanto è uscito per le spese del bilancio, escluse le rate di debiti?» **Aiuto:** «Includi affitto, consumi, premi e spese annuali. Le rate intere saranno chieste a parte. Escludi versamenti a risparmio o investimenti, acquisti di attività patrimoniali e trasferimenti interni. Non contare due volte imposte già sottratte dalle entrate».
- **Area/tipo/opzioni:** A; FM o valore, mensile medio/annuo T12, EUR, stati comuni; zero ammesso.
- **O; comparsa:** sempre. **Dipendenze:** S01/S02 e finestra T12 di A01, senza necessità di conoscere il valore A01.
- **Validazioni:** spesa eccezionale di consumo inclusa se sostenuta in T12; acquisto casa escluso dal consumo, non ignorato come esposizione. Non inserire qui rimborso capitale/interessi già compresi nelle rate C02.
- **Diagnosi/motivo:** E per margine di cassa e copertura; impedisce doppio conteggio delle rate.
- **Privacy:** nessun dettaglio di singoli acquisti o beneficiari.

### RP-A03 — Come sono state coperte le uscite

- **Testo:** «Quale situazione descrive meglio il modo in cui sono state coperte le uscite negli ultimi 12 mesi?» **Aiuto:** «Un prelievo dal patrimonio previsto in un piano è diverso dal dover usare risparmi o nuovo credito senza averlo programmato».
- **Area/tipo/opzioni:** A; singola: `COVERED` Le entrate sono bastate senza ricorrere al patrimonio; `PLANNED_DRAW` Ho/abbiamo usato patrimonio secondo un piano; `OCCASIONAL_GAP` Risparmi o nuovo credito non previsti in alcuni mesi; `REPEATED_GAP` Risparmi o nuovo credito non previsti nella maggior parte dei mesi; stati comuni.
- **O; comparsa:** sempre. **Dipendenze:** solo S01; leggibile anche con importi ignoti.
- **Validazioni:** opzione prevalente; «alcuni mesi» non contraddice necessariamente un avanzo annuale. PLANNED_DRAW non prova che il piano durerà.
- **Diagnosi/motivo:** contesto di R-A; evita penalizzare automaticamente pensionati o chi vive consapevolmente del patrimonio.
- **Privacy:** non chiedere causali delle difficoltà o eventi di vita.

### RP-A04 — Regolarità delle entrate

- **Testo:** «Quanto sono state prevedibili le entrate negli ultimi 12 mesi?» **Aiuto:** «Considera anche entrate stagionali: possono variare molto ma essere previste».
- **Area/tipo/opzioni:** A; singola: regolari; variabili ma abbastanza prevedibili; variabili e poco prevedibili; nessuna entrata; stati comuni.
- **O; comparsa:** sempre. **Dipendenze:** S03/A01 per coerenza, non per disponibilità.
- **Validazioni:** non attribuire volatilità numerica all'ordine delle opzioni; se contraddice Y positivo/zero, richiesta di chiarimento.
- **Diagnosi/motivo:** limita generalizzazioni della media; eventuale X01. Non penalizza il lavoro autonomo per categoria.
- **Privacy:** niente calendario degli incassi o nomi dei clienti.

### RP-A05 — Fonte principale

- **Testo:** «Quale quota delle entrate dipende dalla stessa fonte principale?» **Aiuto:** «Per esempio lo stesso lavoro, impresa, pensione o affitto. Non serve indicarne il nome. Più pagamenti della stessa fonte contano insieme».
- **Area/tipo/opzioni:** A; quota autodichiarata: fino al 50%; oltre 50% e fino a 80%; oltre 80% e fino a 100%; stati comuni. Intervalli inclusivi come espressi; zero non è una quota principale se esistono entrate.
- **O; comparsa:** salvo A01=0 reale o S03/A04 «nessuna entrata» coerenti. **Dipendenze:** A01/S03/A04. Con importo reddito ignoto ma esistenza dichiarata, la quota relativa resta acquisibile.
- **Validazioni:** percentuale 0–100, ma 0 incompatibile con un massimo su entrate positive; non dividere il reddito per il numero di fonti.
- **Diagnosi/motivo:** I-A03 dipendenza dichiarata; una sola pensione non diventa automaticamente fragilità.
- **Privacy:** nessuna identificazione della fonte o della persona che paga.

## 4. B — Liquidità e sicurezza

### RP-B01 — Spese essenziali attuali

- **Testo:** «Oggi, quanto servirebbe per un mese di spese essenziali, escluse le rate?» **Aiuto:** «Pensa al minimo realistico per abitazione, alimentazione, utenze, trasporti e altre necessità. Le rate attualmente dovute saranno aggiunte da C04. È un budget attuale, diverso dalla media storica A02».
- **Area/tipo/opzioni:** B; FM mensile Tnow o valore, EUR, stati comuni; zero ammesso con conferma.
- **O; comparsa:** sempre. **Dipendenze:** S01/S02.
- **Validazioni:** nessuna sottrazione di spese già comprese altrove; B01>A02 può dipendere da un cambiamento di periodo e non è un errore bloccante. Zero non genera autonomia infinita.
- **Diagnosi/motivo:** K, insieme a C04, per I-B01; identifica il denominatore senza imporre un budget standard.
- **Privacy:** nessun dettaglio sanitario o di acquisti essenziali.

### RP-B02 — Disponibilità accessibili

- **Testo:** «Quale somma è disponibile oggi, o entro sette giorni, senza nuovo debito né vendita a un prezzo incerto?» **Aiuto:** «Considera contanti e somme effettivamente prelevabili. Non includere fidi, carte di credito, casa o investimenti che richiederebbero di accettare una perdita o una penale rilevante. Includi per ora anche gli accantonamenti, che separeremo dopo».
- **Area/tipo/opzioni:** B; ST o valore a T0, EUR, stati comuni, zero reale.
- **O; comparsa:** sempre. **Dipendenze:** S01/S02.
- **Validazioni:** quota riferita al perimetro, non saldo complessivo di conto cointestato se quota ignota; disponibilità incerta → stima/UNKNOWN, non credito utilizzabile.
- **Diagnosi/motivo:** L, liquidità operativa dichiarata, distinta da tutte le attività patrimoniali.
- **Privacy:** niente banca, numero di conto o credenziali.

### RP-B03 — Quota già impegnata

- **Testo:** «Di questa somma, quale parte è già accantonata per uscite non rinviabili?» **Aiuto:** «Considera solo importi già presenti e destinati a impegni noti nei prossimi 12 mesi, non già coperti dal budget mensile. Non sottrarremo nuovamente questi importi dalle spese correnti».
- **Area/tipo/opzioni:** B; ST o valore a T0, EUR, stati comuni; zero = nessun accantonamento di questo tipo.
- **O; comparsa:** se B02 diverso da zero o sconosciuto. **Dipendenze:** B02. B02=0 valido implica P=0 strutturale e salto motivato.
- **Validazioni:** P<=L solo se i valori consentono di verificarlo; intervalli senza alcuna combinazione compatibile producono incoerenza. Non troncare silenziosamente P né sottrarre l'intero costo futuro di un obiettivo.
- **Diagnosi/motivo:** P per riserva libera L−P; nessuna doppia sottrazione nelle formule di cassa storica.
- **Privacy:** solo totale, nessun tipo di impegno obbligatorio.

### RP-B04 — Spesa imprevista

- **Testo:** «Se arrivasse una spesa imprevista pari a un mese delle spese essenziali, rate comprese, come potrebbe affrontarla questo bilancio entro 30 giorni?» **Aiuto:** «È uno scenario educativo, non una richiesta di spesa. Non contare nuovo credito come denaro già disponibile».
- **Area/tipo/opzioni:** B; singola: con somme disponibili senza intaccare impegni già accantonati; solo usando somme già destinate ad altro; vendendo beni/investimenti o chiedendo denaro; non saprei come pagarla; stati comuni.
- **O; comparsa:** sempre; se denominatore B01+C04 non noto, mostrare lo stesso testo senza inventare importo. **Dipendenze:** B01/C04 per l'eventuale cifra, non per raccogliere la percezione.
- **Validazioni:** se L=P=0 e risposta «somme disponibili», richiedere conferma, non imputare una riserva. La disponibilità entro 30 giorni differisce dall'accessibilità in sette giorni: non ogni scostamento è contraddizione.
- **Diagnosi/motivo:** I-B03; risorsa percepita distinta dal calcolo. Scenario Horyzon, non item EU-SILC ufficiale.
- **Privacy:** nessuna identità di potenziali prestatori/familiari.

## 5. C — Indebitamento

### RP-C01 — Presenza di debiti

- **Testo:** «Quali debiti sono aperti oggi o hanno richiesto pagamenti negli ultimi 12 mesi?» **Aiuto:** «Considera il perimetro scelto, anche prestiti informali e pagamenti rateali. Un debito può esistere anche se oggi non paghi rate».
- **Area/tipo/opzioni:** C; multipla: mutuo; prestiti personali/credito al consumo; carte rateali/revolving; altri debiti a rimborso, anche informali; nessuno in entrambi i periodi; stati comuni.
- **O; comparsa:** sempre. **Dipendenze:** S01/S02.
- **Validazioni:** «nessuno» esclusivo e conferma dei due periodi; consente R12=Rnow=0 strutturali, non assenza di arretrati per affitto/utenze. Il residuo totale D è zero strutturale solo se C03 è «nessuno» o «ritardi risolti» e non emergono altri debiti aperti. Con C03 corrente/ignoto non dedurre D=0. Non cancellare C03.
- **Diagnosi/motivo:** applicabilità C02/C04/X05, senza confondere debito, pagamento e rata nulla.
- **Privacy:** non chiedere creditore o numero di contratto.

### RP-C02 — Rate nel periodo storico

- **Testo:** «Quanto è stato pagato complessivamente in rate negli ultimi 12 mesi, per il bilancio scelto?» **Aiuto:** «Includi capitale e interessi, con lo stesso periodo delle entrate. Scegli totale annuo o media mensile. Non ripetere le rate fra le spese A02».
- **Area/tipo/opzioni:** C/A; FM o valore mensile medio/annuo T12, EUR, stati comuni, zero ammesso anche con debito aperto.
- **O condizionale; comparsa:** C01 non è «nessuno» validato; con C01 sconosciuto si può rispondere, senza inferire il tipo di debito. **Dipendenze:** C01, periodo A01.
- **Validazioni:** zero non significa assenza di debiti; differenza da C04 ammessa per estinzioni o nuove rate. Non sommare C02 e C04 nello stesso flusso.
- **Diagnosi/motivo:** R12 per margine e incidenza storica comparabili.
- **Privacy:** totale aggregato, nessun contratto.

### RP-C03 — Ritardi

- **Testo:** «Negli ultimi 12 mesi ci sono stati ritardi per difficoltà di pagamento di rate, affitto o utenze?» **Aiuto:** «Non servono cause personali o importi del singolo ritardo».
- **Area/tipo/opzioni:** C; singola: nessuno; uno o più ritardi poi risolti; ritardi ancora in corso; stati comuni.
- **O; comparsa:** sempre, anche senza prestiti. **Dipendenze:** S01/T12.
- **Validazioni:** ritardo amministrativo non legato a difficoltà non è la risposta richiesta; non determinare numero di giorni o segnalazioni creditizie.
- **Diagnosi/motivo:** I-C03 e priorità di approfondimento; osservazione distinta dall'incidenza rate.
- **Privacy:** niente causali sanitarie, creditori o documentazione di insolvenza.

### RP-C04 — Rate attualmente dovute

- **Testo:** «Quanto è dovuto oggi in rate per un mese ordinario?» **Aiuto:** «È la somma attualmente da pagare, anche se non sei riuscito a pagarla. Includi le rate minime obbligatorie; segnala se sai che cambieranno. Per scadenze non mensili puoi indicare l'equivalente annuo diviso 12, sapendo che non descrive la singola scadenza».
- **Area/tipo/opzioni:** C/B; FM mensile Tnow o valore, EUR, stati comuni; selettore accessorio `cambiamento noto entro 12 mesi: sì/no/non so` senza dettagli. Zero reale ammesso.
- **O condizionale; comparsa:** come C02. **Dipendenze:** C01; B01 usa questo valore senza dipendere dal suo esito.
- **Validazioni:** non inserire rata «pagata» nulla se la rata dovuta è positiva. Equivalente mensile non spiana realmente un pagamento a scadenza. Se «nessuno» C01, zero strutturale e salto.
- **Diagnosi/motivo:** Rnow per autonomia attuale e pressione indicativa I-C02; distingue storico e impegni attuali.
- **Privacy:** somma e indicazione di cambiamento, non tipo contrattuale dettagliato.

## 6. D — Protezione

### RP-D01 — Esposizioni percepite

- **Testo:** «Quali responsabilità economiche meritano una verifica in caso di imprevisto?» **Aiuto:** «Non indicare condizioni di salute. Considera conseguenze economiche, non il nome di una polizza».
- **Area/tipo/opzioni:** D; multipla: continuità delle entrate da lavoro; sostentamento di altre persone; disponibilità di casa o beni essenziali; responsabilità economiche verso terzi; nessuna esposizione rilevante individuata; stati comuni.
- **O; comparsa:** sempre. **Dipendenze:** S03/S04 solo per richieste di coerenza, mai per preselezione di coperture.
- **Validazioni:** «nessuna» esclusiva, non prova che il rischio sia assente. S04>0 senza sostentamento richiede conferma, non deduzione automatica.
- **Diagnosi/motivo:** perimetro di I-D01; non calcola probabilità o necessità assicurativa.
- **Privacy:** niente diagnosi, abitudini sanitarie o identità dei beneficiari.

### RP-D02 — Presidi dichiarati

- **Testo:** «Per ciascuna responsabilità indicata, quale strategia è stata individuata?» **Aiuto:** «Può essere una protezione pubblica, aziendale, contrattuale, privata o una riserva scelta consapevolmente. Avere una polizza non basta a sapere cosa copre».
- **Area/tipo/opzioni:** D; matrice delle sole righe D01 selezionate. Ogni riga: `CHECKED` Strategia individuata e limiti principali controllati; `UNREVIEWED` Strategia presente ma limiti non controllati; `GAP` Esigenza individuata, risposta non ancora definita; UNKNOWN; DECLINED; N/A motivato. Nessun importo.
- **O condizionale; comparsa:** almeno una esposizione in D01. **Dipendenze:** D01. D01 ignoto → offrire chiarimento, non creare righe fittizie. «Nessuna» → salto e area non attestabile, non «protetto».
- **Validazioni:** valutare riga per riga; CHECKED è una dichiarazione, non audit contrattuale; nessuna proporzione «polizze possedute/necessarie».
- **Diagnosi/motivo:** distingue presidio compreso, da verificare o mancante. Eventuale X03.
- **Privacy:** niente nomi delle coperture, numeri polizza, beneficiari o motivi sanitari.

## 7. E — Struttura patrimoniale

### RP-E01 — Attività presenti

- **Testo:** «Quali attività fanno parte oggi del patrimonio del perimetro scelto?» **Aiuto:** «Segna solo ciò che esiste oggi. Valori e quote saranno facoltativi. Non includere redditi futuri o il valore teorico di pensioni non ancora erogate».
- **Area/tipo/opzioni:** E; multipla: liquidità B02; strumenti finanziari non previdenziali; abitazione principale; altri immobili; partecipazione nella propria attività; metalli o beni da collezione con valore stimabile; cripto-attività; altre attività valutabili; posizione previdenziale vincolata con capitale noto; nessuna attività; stati comuni.
- **O; comparsa:** sempre. **Dipendenze:** B02 per coerenza, non per obbligare a conoscere il valore.
- **Validazioni:** «nessuna» esclusiva; B02>0 implica necessità di confermare la voce liquidità. B02=0 non implica patrimonio zero. Non includere gli stessi beni sia nell'impresa sia direttamente, se già nel valore della quota. La conferma di completezza dell'inventario già prevista è esplicita: classi omesse non sono automaticamente assenti. E01 che esclude tutte le attività non previdenziali, con inventario confermato e B02=0 coerente, permette A=0 strutturale senza X04; mai D=0 automatico. Composizione N/A non esclude l'area E o i debiti.
- **Diagnosi/motivo:** applicabilità costi e approfondimenti; presenza di classi non equivale a diversificazione efficace.
- **Privacy:** nessun ISIN, indirizzo, wallet o nome d'impresa.

### RP-E02 — Concentrazione percepita

- **Testo:** «Considerando le attività non previdenziali, quanta parte è nella stessa principale esposizione?» **Aiuto:** «Per esempio un solo immobile, un'impresa o strumenti legati allo stesso emittente. Conta l'esposizione economica, non il numero di prodotti».
- **Area/tipo/opzioni:** E; quota (meno della metà; dalla metà a meno di tre quarti; tre quarti o più; stati comuni) e tipo generico dell'esposizione (liquidità; immobile; propria impresa; emittente finanziario; altro; non so). Quota stimata, non censimento verificato; due campi nello stesso prompt.
- **O condizionale; comparsa:** E01 contiene attività non previdenziali; se E01 incerto, domanda facoltativamente rispondibile come stima. **Dipendenze:** E01.
- **Validazioni:** se sola liquidità, la quota può descrivere la macrovoce liquidità ma non un'unica banca: lo specifica il tipo. Nessun nome necessario; distinguere questa quota dal calcolo per macroclasse X04. Tipo non noto non permette di applicare la regola H-E75 automaticamente.
- **Diagnosi/motivo:** segnale qualitativo di concentrazione; non significa automaticamente investimento sbagliato. E02 «tre quarti o più», tipo liquidità, può sostenere il tratto ordinario H-PQUAL, senza trasformarlo in qL>=80%. Il profilo richiede anche obiettivi non definiti e contesto di fabbisogno/accantonamenti secondo lo scoring.
- **Privacy:** categoria generica, niente soggetto emittente identificabile.

### RP-E03 — Liquidabilità percepita

- **Testo:** «Se ti servissero entro 30 giorni, quanta parte di queste attività non previdenziali potresti trasformare in denaro senza incertezza rilevante sul ricavo?» **Aiuto:** «Una casa o una quota d'impresa di valore non sono automaticamente somme disponibili. Anche un titolo vendibile può avere un valore incerto».
- **Area/tipo/opzioni:** E; singola: meno di un quarto; da un quarto a meno della metà; almeno metà ma non tutte; tutte; stati comuni.
- **O condizionale; comparsa:** come E02. **Dipendenze:** E01.
- **Validazioni:** non equiparare a L entro sette giorni; discordanza è da chiarire, non da correggere d'ufficio. Se sola cassa prelevabile e quota «meno di un quarto», richiedere verifica del perimetro.
- **Diagnosi/motivo:** illiquidità percepita e limite del dato monetario; non autorizza vendite.
- **Privacy:** nessun bene identificabile o valore richiesto.

### RP-E04 — Esposizioni comuni

- **Testo:** «Una parte importante delle entrate e del patrimonio dipende dalla stessa attività o dallo stesso rischio economico?» **Aiuto:** «Per esempio lavoro nella propria impresa e quota dell'impresa, oppure reddito e beni concentrati nello stesso mercato. Non indicare nomi».
- **Area/tipo/opzioni:** E/A; singola: sì; no; stati comuni. «Parte importante» resta autovalutazione qualitativa, non percentuale implicita.
- **O condizionale; comparsa:** attività non previdenziali presenti, come E02. **Dipendenze:** E01/A01; contesto A05/S03.
- **Validazioni:** ruolo imprenditore non equivale a sì; assenza di risposta non equivale a indipendenza. Reddito nullo reale → N/A confermato per il legame reddito/patrimonio, non per E intera.
- **Diagnosi/motivo:** I-E04 esposizione condivisa, non probabilità di perdita.
- **Privacy:** non identificare datore, area geografica puntuale o settore sensibile.

## 8. F — Pianificazione e consapevolezza

### RP-F01 — Obiettivi

- **Testo:** «Come sono stati definiti gli obiettivi economici dei prossimi anni per il bilancio scelto?» **Aiuto:** «Può essere un obiettivo piccolo: affrontare un imprevisto, una spesa, un cambiamento o le esigenze della pensione».
- **Area/tipo/opzioni:** F; singola: `NONE` Nessun obiettivo definito; `IDEA` Un'idea, senza tempo né importo; `HORIZON` Un obiettivo con orizzonte; `DEFINED` Un obiettivo con tempo e risorse da verificare/già stimate; stati comuni. X06 raccoglie dettagli facoltativi.
- **O; comparsa:** sempre. **Dipendenze:** S01.
- **Validazioni:** NONE è valore reale, non N/A; non richiede un obiettivo di investimento né un importo elevato. Un'esigenza vicina con tempo noto appartiene a HORIZON anche se manca la cifra: esplicitarlo nell'aiuto, senza nuova domanda. X06 che rivela un obiettivo temporizzato richiede riconciliazione esplicita, non lascia attiva una lettura FERMI basata sull'assenza di obiettivi.
- **Diagnosi/motivo:** I-F01; pianificazione distinta dal valore del patrimonio.
- **Privacy:** nessun testo libero su eventi personali.

### RP-F02 — Risorse di lungo periodo

- **Testo ordinario:** «Sono state verificate le risorse che potrebbero sostenere le spese di questo bilancio in pensione o nel lungo periodo?» **Variante se S03 include pensione senza redditi da lavoro dipendente/professione/impresa:** «Sono state confrontate le risorse già disponibili in pensione con le esigenze del prossimo periodo di vita?» **Aiuto:** «Non serve indicare l'importo della pensione né aderire a un fondo. Una simulazione o un documento non garantiscono il futuro».
- **Area/tipo/opzioni:** F; singola: `CHECKED` Confronto fatto usando informazioni ufficiali o contrattuali datate; `ROUGH` Solo un'idea/stima non verificata; `NOT_REVIEWED` Non ho/abbiamo ancora fatto il confronto; stati comuni.
- **O; comparsa:** sempre. **Dipendenze:** S03 determina solo la variante del testo; se ignoto o nucleo con lavoro e pensione usare testo ordinario, che copre anche il lungo periodo dei componenti ancora al lavoro.
- **Validazioni:** nessun N/A per il solo fatto di essere già pensionato o non avere previdenza complementare. CHECKED non significa copertura sufficiente. X08 può precisare fonte/data.
- **Diagnosi/motivo:** I-F04, processo di verifica, nessuna proiezione previdenziale automatica.
- **Privacy:** niente età precisa, ente nominativo, invalidità o importi pensionistici.

### RP-F03 — Stile decisionale

- **Testo:** «Come vengono prese le principali decisioni economiche e patrimoniali del bilancio scelto?» **Aiuto:** «Affidarsi a un professionista e decidere in autonomia sono modalità diverse, non una graduatoria».
- **Area/tipo/opzioni:** F; singola: soprattutto direttamente; con confronto e decisione condivisa con un professionista; delegando prevalentemente a un professionista; decide soprattutto un'altra persona del bilancio; stati comuni.
- **O; comparsa:** sempre. **Dipendenze:** S01.
- **Validazioni:** non inferire consulenza remunerata, competenza, capacità giuridica o autorizzazioni del soggetto esterno.
- **Diagnosi/motivo:** contesto I-F02 e profilo «chi si affida», distinto dall'autoselezione del funnel.
- **Privacy:** nessun nome di consulente o familiare.

### RP-F04 — Comprensione dei costi

- **Testo:** «Per gli investimenti del bilancio scelto, riesci a individuare e spiegare i costi complessivi, anche confrontandoti con chi li segue?» **Aiuto:** «Comprendere i costi è diverso dal sapere che esiste una commissione. Non devi comunicarci documenti o contratti».
- **Area/tipo/opzioni:** F; singola: `EXPLAIN` So/sappiamo individuarli e spiegarli su un riepilogo; `FOUND` Li ho/abbiamo individuati ma non so/sappiamo spiegarli; `NOT_FOUND` Non li ho/abbiamo individuati; stati comuni.
- **O condizionale; comparsa:** E01 include strumenti finanziari non previdenziali o posizione previdenziale con capitale. Se E01 ignoto, offrire il quesito senza presumere investimenti; applicabilità resta indeterminata. **Dipendenze:** E01.
- **Validazioni:** sola liquidità o sola casa non rende obbligatorio il quesito. N/A confermato se non esistono queste posizioni; possesso di cripto/collezioni da solo non prova costi di strumenti finanziari trattati dal quesito.
- **Diagnosi/motivo:** I-F02 autovalutazione dei costi; risposta non prova conoscenza effettiva. X07 aggiunge un esercizio limitato.
- **Privacy:** nessun nome, documento o ammontare di commissione reale.

### RP-F05 — Un esempio pratico

- **Testo:** «Una persona possiede diversi investimenti tutti legati alla stessa impresa. Quale affermazione è più corretta?» **Aiuto:** «È un esempio generale: non valuta i tuoi investimenti».
- **Area/tipo/opzioni:** F; singola: `COUNT` Il numero di investimenti basta a eliminare la concentrazione; `EXPOSURE` La dipendenza dalla stessa impresa può rimanere; UNKNOWN; DECLINED. N/A non confermabile per il solo fatto di non investire.
- **O; comparsa:** sempre. **Dipendenze:** nessuna economica.
- **Validazioni:** corretta EXPOSURE; UNKNOWN/DECLINED non sono errori; non produrre voto globale di alfabetizzazione.
- **Diagnosi/motivo:** I-F03, verifica limitata di una nozione (S06/S12). Spiegazione educativa anche se non risposto.
- **Privacy:** nessun dato della persona.

### RP-F06 — Revisione del bilancio

- **Testo:** «Quando sono stati confrontati l'ultima volta entrate, spese e obiettivi di questo bilancio?» **Aiuto:** «Conta una verifica concreta, anche semplice; non occorre un software o un consulente».
- **Area/tipo/opzioni:** F; singola: negli ultimi tre mesi; tra quattro e dodici mesi fa; oltre dodici mesi fa; mai; stati comuni.
- **O; comparsa:** sempre. **Dipendenze:** S01, non dipende da avere già un obiettivo.
- **Validazioni:** «mai» è un valore; il confine di 12 mesi è una regola organizzativa proposta, non attestazione istituzionale.
- **Diagnosi/motivo:** I-F01, comportamento dichiarato e criteri del profilo «chi costruisce».
- **Privacy:** periodo generico, nessun dettaglio delle decisioni prese.

## 9. Approfondimenti facoltativi, anche dopo l'evento

### RP-X01 — Mese con entrate minori

- **Testo:** «Qual è stato il mese con le entrate nette più basse negli ultimi 12 mesi, considerando solo l'importo?» **Aiuto:** «Non serve il nome del mese. È un dato passato, non una previsione».
- **Area/tipo/opzioni:** A; FM mensile o valore EUR T12, stati comuni, zero ammesso.
- **F; comparsa:** A04 variabile o scelta esplicita di approfondire; **dipendenze:** A01/A04 e perimetro.
- **Validazioni:** minimo non superiore alla media se esistono valori coerenti; intervalli incompatibili → chiarire. Non usarlo come previsione delle entrate prossime.
- **Diagnosi/motivo:** I-A04 confronta scenario di minimo osservato e uscite essenziali attuali, con date diverse dichiarate.
- **Privacy:** nessuna data o fonte specifica dell'incasso.

### RP-X02 — Condizioni ed esposizioni ulteriori

- **Testo:** «Ci sono condizioni che rendono incompleto il solo dato delle rate?» **Aiuto:** «Segnala solo la presenza; non indicare persone o importi delle garanzie».
- **Area/tipo/opzioni:** C; multipla: garanzie personali per debiti altrui; debiti cointestati con obblighi ulteriori alla quota indicata; rate variabili; sospensioni o pagamenti finali importanti; cambiamenti di rata già noti; nessuna di queste; stati comuni.
- **F; comparsa:** C01 con debiti, S03 impresa/autonomo o richiesta libera; **dipendenze:** C01/S03/C04.
- **Validazioni:** «nessuna» esclusiva; esistenza di garanzia non diventa stock di debito certo; mancata risposta non significa nessuna condizione.
- **Diagnosi/motivo:** limite di I-C02/I-E01 e priorità di verifica contrattuale, non stima del debito potenziale.
- **Privacy:** niente garanti, debitori, banche o condizioni sanitarie.

### RP-X03 — Limiti dei presidi

- **Testo:** «Per le strategie di protezione indicate, quali aspetti riesci a verificare?» **Aiuto:** «Per una polizza: limiti, esclusioni, franchigie e durata. Per una riserva o un sostegno diverso: disponibilità, durata e spese coperte. Non descrivere motivi sanitari».
- **Area/tipo/opzioni:** D; matrice delle righe D01: limiti/disponibilità; condizioni di utilizzo; durata; corrispondenza al bisogno. Ciascuna cella: verificato; da verificare; UNKNOWN; DECLINED; N/A motivato.
- **F; comparsa:** almeno un presidio in D02; **dipendenze:** D01/D02.
- **Validazioni:** celle N/A solo per aspetti non pertinenti al tipo di strategia, senza supporre un contratto. Non ricavare «adeguato» dal numero di spunte.
- **Diagnosi/motivo:** I-D02 dettaglia cosa verificare; non attribuisce punti al possesso di una polizza.
- **Privacy:** nessun documento, dato sanitario o beneficiario.

### RP-X04 — Importi del patrimonio

- **Testo:** «Vuoi indicare fasce o stime di valore delle attività che hai selezionato?» **Aiuto:** «Usa valori riferiti a oggi e alle quote del perimetro scelto. Non contare due volte un immobile già compreso nel valore della tua attività. La liquidità riprende B02: la sommiamo una sola volta».
- **Area/tipo/opzioni:** E; matrice ST/valore EUR a T0, qualità per riga, UNKNOWN/DECLINED/N/A. Righe: L; strumenti finanziari non previdenziali; casa principale; altri immobili; quota propria attività; metalli/collezioni; cripto; altre attività; capitale previdenziale vincolato separato.
- **F; comparsa:** scelta esplicita ed E01; **dipendenze:** E01/B02/S01/S02.
- **Validazioni:** attività escluse da E01 sono zero solo se inventario confermato completo. Nessuna riga omessa diventa zero. Capitale previdenziale fuori dal totale ordinario; pensione futura/TFR non noto non capitalizzati. Una riga B02 modificata aggiorna la stessa risposta e la revisione, non crea un secondo saldo.
- **Diagnosi/motivo:** attività considerate per I-E01/E02/E03; consente distribuzione monetaria quando completa e A>0. Non è necessaria per ricevere il risultato ordinario né per un profilo FERMI qualificato come qualitativo; è necessaria per il canale/conferma quantitativa H-P80 e per quote monetarie non deducibili da zeri strutturali. Nessun premio per aver comunicato più patrimonio.
- **Privacy:** niente indirizzi, conti, wallet o identificativi societari.

### RP-X05 — Debito residuo

- **Testo:** «Quanto resta complessivamente dovuto oggi per i debiti del perimetro scelto?» **Aiuto:** «Considera il capitale ancora da rimborsare e altri importi già scaduti e dovuti. Non contare due volte arretrati già compresi nel residuo. Non sommare le rate future: contengono anche interessi. Per debiti condivisi non assumere una quota se non la conosci. Le garanzie per altri non sono debito certo da sottrarre automaticamente».
- **Area/tipo/opzioni:** C/E; ST o valore EUR T0, totale residuo; selettore `tutti i debiti del perimetro / solo una parte`, qualità e stati comuni. Zero reale possibile.
- **F; comparsa:** C01 diverso da «nessuno», oppure C03 corrente/ignoto, oppure richiesta libera; **dipendenze:** C01/C03/S01/S02. Zero strutturale solo se C01 nessuno e C03 nessuno/risolto, con altri debiti aperti esclusi: altrimenti X05 mancante impedisce N, non viene sostituito con zero.
- **Validazioni:** zero residuo compatibile con C02>0 per debito estinto; incompatibile con debito o arretrati ancora aperti dichiarati senza spiegazione. Perimetro parziale impedisce il netto complessivo. Non usare capitale iniziale o somma rate come residuo.
- **Diagnosi/motivo:** D per I-E01; nessun dato → netto non calcolabile, non patrimonio lordo presentato come netto.
- **Privacy:** totale aggregato, nessun creditore.

### RP-X06 — Obiettivi ordinati (versione 2)

- **Testo:** «Che cosa vorresti ottenere concretamente con le risorse di questo bilancio? Se hai più obiettivi, mettili nell'ordine che conta per te». **Aiuto:** «Ne basta uno; puoi indicarne fino a tre in totale, compreso il principale. Per ciascuno pensa a quando potrebbero servire per la prima volta le risorse. Importi e dettagli sono facoltativi; non verranno proposti prodotti o versamenti».
- **Area/tipo/opzioni:** F; lista di 1–3 righe con riferimento stabile e ordine esplicito. Categoria: riserva per imprevisti; spesa programmata; acquistare/adattare abitazione; ridurre impegni debitori; sostenere esigenze economiche di altre persone; cambiamento lavorativo; lungo periodo/pensione; futuro passaggio di risorse familiari; altro da chiarire senza testo libero. Orizzonte per riga: 0–12 mesi / oltre12–36 / oltre36, oppure mesi facoltativi (0 = adesso). Natura: una tantum / continuativa / UNKNOWN / DECLINED. Eventuale importo complessivo ST/valore EUR, qualità e stati comuni per ciascun campo; importo di un'esigenza continuativa può restare ignoto, senza capitalizzazione automatica.
- **F; comparsa:** su richiesta dopo l'ordinario, anche con F01 NONE/UNKNOWN. Nessun obbligo di X04/X05 o colloquio prenotato. **Dipendenze:** S01/F01 per contesto e coerenza, non per imporre una risposta; X06 non richiede X09–X11.
- **Validazioni:** massimo tre obiettivi complessivi, rango1–3 univoco quando confermato dalla persona; ordine UNKNOWN/DECLINED/UNANSWERED ammesso, con righe dichiarate ma nessun principale attribuito. Non ordinare per importo o interesse commerciale. F01 NONE noto si riusa come livello generale, non si ripete la domanda né si inventa una lista esaustiva vuota. X06 UNKNOWN/DECLINED/UNANSWERED distinti da «nessun obiettivo definito». Orizzonte è primo bisogno, non periodo di immobilizzo accettato. Se X06 chiarisce F01, proporre revisione esplicita; con obiettivo temporizzato noto sospendere letture incompatibili, incluso FERMI, finché riconciliate. X06 v1 conserva dati/versione: possibile mostrarlo come obiettivo già dichiarato, senza assegnargli d'ufficio rango principale o natura. Riordino mantiene i riferimenti di riga; rimozione disattiva solo attribuzioni/vincoli collegati nella nuova revisione.
- **Diagnosi/motivo:** dettaglio I-F01 e dossier degli obiettivi, non prova di finanziabilità; nessun rendimento o rata-obiettivo. Preferenze del servizio X11 distinte dagli obiettivi economici.
- **Privacy:** categorie aggregate, niente racconti familiari, salute, nomi dei destinatari, asset identificabili o dettagli successori/giuridici.

### RP-X07 — Esercizio sui costi

- **Testo:** «In un semplice esercizio, un costo del 2% su un importo mantenuto a 1.000 euro per un anno equivale a quanti euro?» **Aiuto:** «Considera soltanto questa percentuale e questa base costante. Non è un rendimento, una previsione né il costo totale di un tuo investimento».
- **Area/tipo/opzioni:** F; singola: 2 euro; 20 euro; 200 euro; UNKNOWN; DECLINED. Unità: euro; N/A non confermabile perché l'esercizio non richiede possesso di prodotti.
- **F; comparsa:** su scelta esplicita; **dipendenze:** nessuna economica.
- **Validazioni:** corretta 20; non estrarre un voto di alfabetizzazione o contraddire automaticamente l'autovalutazione F04. Un errore suggerisce una spiegazione, non un giudizio.
- **Diagnosi/motivo:** I-F03, piccola verifica di calcolo distinta dalla conoscenza reale dei costi.
- **Privacy:** nessun dato reale e nessun prodotto nominato.

### RP-X08 — Fonte della verifica previdenziale

- **Testo:** «Su quali informazioni si basa l'ultima verifica delle risorse di lungo periodo, e a quando risale?» **Aiuto:** «Basta la categoria della fonte e il periodo, senza importi o documenti».
- **Area/tipo/opzioni:** F; fonte (comunicazione ufficiale dell'ente; comunicazione contrattuale di una forma previdenziale; stima personale o simulazione non verificata; nessuna verifica) e data per fascia ultimi 12 mesi / oltre 12 mesi / non nota; stati comuni per campo.
- **F; comparsa:** richiesta libera o F02 CHECKED/ROUGH; **dipendenze:** F02.
- **Validazioni:** fonte non verificata non conferma CHECKED; chiedere una revisione esplicita, senza correggere automaticamente. Nessuna stima dell'assegno o dei benefici fiscali.
- **Diagnosi/motivo:** I-F04 con data/provenienza; aggiornamento informativo, non misura della sufficienza della pensione.
- **Privacy:** niente importi, età, codice ente personale, prestazioni sanitarie o documenti.

### RP-X09 — Risorse e vincoli dichiarati

- **Testo:** «Quali risorse vorresti eventualmente destinare agli obiettivi e che cosa deve restare disponibile?» **Aiuto:** «Riprendiamo liquidità, impegni e attività già indicati: non devi ricompilare il patrimonio. La quota da mantenere include gli accantonamenti già dichiarati. Puoi indicare i vincoli senza cifre; non stiamo verificando un capitale investibile».
- **Area/tipo/opzioni:** contesto obiettivi/B/E/F, senza voto. Riepilogo condiviso con riferimenti ai dati esistenti. Importi facoltativi ST/valore EUR a T0: Cmin, quota attuale di L da mantenere per riserva e impegni incluso P; G0, quota di L eventualmente destinabile oggi complessivamente; G_i per fino a tre righe X06 soltanto se la persona vuole attribuire parti di G0. Altre risorse da verificare: categorie già E01/X04 o categoria generica se mancanti, nessuna / alcune da esaminare / stati comuni; nessun secondo valore. Fino a tre vincoli: accesso immediato/entro7/entro30 giorni/entro orizzonte della riga; non intaccare riserva o impegni; niente nuovo debito; non usare abitazione/attività d'impresa; altri da chiarire senza testo libero. Per ciascuno: globale o riferimento obiettivo, non negoziabile / preferenza da discutere / stato ignoto. Campi indipendenti con stati comuni pertinenti.
- **F; comparsa:** scelta esplicita dopo X06 oppure per chiarire vincoli anche senza obiettivi; in quest'ultimo caso solo parte globale, attribuzioni inattive. **Dipendenze:** S01/S02 e B02/B03 per confronti, X06 per righe/ordini, E01/X04 per riferimenti; nessuno è obbligo di nuova rivelazione. Mancanti non bloccano le scelte qualitative.
- **Validazioni:** stessa data/perimetro, nessun duplicato delle revisioni esistenti. Se valori utilizzabili, verificare 0<=P<=Cmin<=L, G0<=L−Cmin e somma G_i<=G0. Se Cmin esprime un obiettivo di riserva futura superiore a L, chiarire l'ambito prima del confronto: non correggere il desiderio o chiamarlo insolvenza. Fasce incompatibili richiedono chiarimento; predicati non decidibili restano incerti. Non sottrarre P due volte, tagliare importi o imputare zero a mancanti/righe non attribuite. G0 è quota dell'attuale L: risorse illiquide, credito e redditi futuri non vi entrano. Un nuovo impegno può richiedere revisione esplicita B03, non una sottrazione nascosta. Tre vincoli non costituiscono una lista esaustiva.
- **Diagnosi/motivo:** disponibilità/preferenze dichiarate e controlli R-G sul dossier; non capacità effettiva, adeguatezza della riserva o capacità di perdita. Nessun automatismo su priorità commerciale o stati A–F.
- **Privacy:** nessun conto, intermediario, bene identificabile, fonte familiare nominativa, motivo sanitario o documento. Riutilizzo dei dati e consenso al colloquio distinti.

### RP-X10 — Esperienza, aspettative e dubbi

- **Testo:** «Quali esperienze e dubbi vorresti far conoscere prima di parlarne insieme?» **Aiuto:** «Puoi segnalare fino a tre argomenti. Non è un esame: aver posseduto qualcosa non dimostra di conoscerne tutti i rischi. Puoi saltare qualunque dettaglio».
- **Area/tipo/opzioni:** contesto personale/F, senza voto. Categorie: conti/depositi e risparmio disponibile; titoli obbligazionari; azioni; fondi/ETF; soluzioni assicurative; previdenza complementare; cripto-attività; altri strumenti di cui chiarire il funzionamento; nessuna esperienza da segnalare; stati comuni. Per fino a tre categorie scelte, esperienza: solo sentita nominare / letta o confrontata senza operazioni / detenuta con decisioni affidate ad altri / partecipazione a scelta o gestione; facoltativa recenza ultimi12 mesi / oltre12 / non nota. Aspettative multiple: capire rischi-costi-vincoli prima di decidere; mantenere risorse disponibili quando servono; capire quali risultati sono incerti; desiderare rendimento certo senza oscillazioni; desiderare risultati elevati con accesso immediato e assenza di rischio; nessuna aspettativa ancora definita. Dubbi multipli: costi, accesso alle risorse, perdita, funzionamento, impegni contrattuali, altro da chiarire. Stati distinti per campo.
- **F; comparsa:** scelta di preparare esperienza/aspettative, anche senza investimenti o obiettivi. Parti esperienza/aspettative/dubbi indipendenti e saltabili. **Dipendenze:** stesso rispondente e contesto della compilazione; F04/F05/X07 restano evidenze separate; E01 non abilita né precompila l'esperienza.
- **Validazioni:** esperienza del rispondente, non di tutti i componenti del nucleo. «Nessuna esperienza» esclusiva per la lista e diversa da UNKNOWN/DECLINED/UNANSWERED; categorie omesse non diventano incompetenza. «Nessuna aspettativa ancora definita» esclusiva nella lista delle aspettative; un contrasto fra desideri va chiarito, non risolto scegliendo una preferenza d'ufficio. Nessuna scala dai tipi di esperienza o recenza, nessuna classe di rischio dalle categorie. Aspettative di assenza di rischio/rendimento garantito non sono promesse né errori al quiz: restano da chiarire; nessuna stima di rendimento o tolleranza alle perdite.
- **Diagnosi/motivo:** spiegazioni pertinenti senza dedurre capacità effettiva, conoscenza verificata, appropriatezza o profilo MiFID; nessun cambiamento a I-F03 o alle regole favorevoli per avere compilato X10.
- **Privacy:** niente storico transazioni, importi investiti ripetuti, nomi di prodotti/professionisti, informazioni di terzi o testo libero. Escluso da note CRM generiche.

### RP-X11 — Utilità del colloquio e coinvolgimento desiderato

- **Testo:** «Che cosa renderebbe utile per te un incontro con Horyzon, e come vorresti partecipare alle decisioni?» **Aiuto:** «Puoi voler soltanto capire meglio la situazione. Questa scelta non prenota un incontro, non conferisce deleghe e non impegna a una proposta».
- **Area/tipo/opzioni:** contesto servizio; due scelte indipendenti. Risultato principale: chiarire obiettivi / ricostruire risorse e vincoli / capire esposizioni e protezioni / comprendere costi e funzionamento / organizzare lungo periodo / capire informazioni e figure professionali necessarie prima di valutare soluzioni / altro da chiarire. Coinvolgimento futuro: capire e decidere direttamente / confrontarsi e decidere insieme / valutare una delega dopo aver compreso condizioni e responsabilità / capire prima le alternative senza decidere ora / da chiarire. Stati comuni per entrambe; nessuna unità monetaria.
- **F; comparsa:** su richiesta dopo l'ordinario, anche con X06/X09/X10 assenti/rifiutati, senza ripetere la domanda sugli obiettivi. **Dipendenze:** contesto del rispondente; F03 può essere mostrato come modalità attuale, mai come risposta alla preferenza futura.
- **Validazioni:** un risultato principale espresso, nessuna priorità dedotta dal patrimonio; «da chiarire» è volontà dichiarata distinta da mancante. Nessun aggiornamento F03/F01 o profilo AFFIDA da questa risposta; richiesta esplicita/prenotazione/consenso restano altro processo autorizzato.
- **Diagnosi/motivo:** agenda e utilità attesa, non necessità di acquisto o accettazione di rischio. Nessun punteggio diagnostico.
- **Privacy:** scelte aggregate senza nomi, motivazioni personali o recapiti nuovi; finalità/dubbi non sono etichette commerciali per HighLevel.

## 10. Percorso e cambiamenti a monte

Ordine proposto: S → A → C → B → D → E → F. C precede B perché C04 serve al denominatore corrente; A resta visitabile prima di C ma i suoi rapporti non sono finali finché manca C02. Approfondimenti raccolti dopo l'ordinario, raggruppati per interesse, senza imporli per ottenere una fotografia.

### Comprensibilità e durata da misurare

**5–8 minuti resta un'ipotesi non verificata**, non una promessa pubblicabile. Con 25–29 prompt e varie matrici, 8 minuti lasciano in media circa 17–19 secondi per prompt, compresa introduzione/correzioni: il reperimento degli importi può superare da solo questo budget. Nessuna stima di tempo per item sotto è un risultato misurato.

| Passaggio potenzialmente lento | Miglioramento proposto senza eliminare dati necessari | Cosa osservare nel pilot |
| --- | --- | --- |
| S01/S02 e quote condivise | Un solo richiamo persistente del perimetro; esempio non nominativo. Distinguere subito perimetro parziale da informazione non nota | Confusione singolo/nucleo e richieste di aiuto |
| A01/A02/C02, ricostruzione di 12 mesi | Periodo identico e ben visibile; scelta annuo/media mensile, fasce subito disponibili, esempi su netto e rate in aiuto progressivo. Non chiedere estratti o calcoli dettagliati | Tempo di ricerca esterno, doppio conteggio, uso errato del solo ultimo mese |
| C04/B01, periodo corrente diverso | Conservare C prima di B; riepilogo «rate attuali già considerate». Separare linguaggio «pagato negli ultimi 12 mesi» e «dovuto oggi» | Scambio R12/Rnow e K/E |
| B02/B03, liquidità e impegni | Mostrare stessa disponibilità dichiarata, chiedere solo la parte già impegnata; distinguere riserva da totale. Zero esplicito, non precompilato | Errori P>L e doppia sottrazione |
| D01/D02, matrice responsabilità/presidi | Una riga per esposizione selezionata; spiegazione concreta di CHECKED/UNREVIEWED/GAP. Non confondere «non so» e «non controllato» | Tempo per riga, omissioni, comprensione dei limiti |
| E01/E02/E03, inventario e liquidabilità | Conservare ordine inventario→esposizione→30 giorni; aiuto sulla differenza macrovoce/sottostante. Valori patrimoniali rinviati a X04 | Confusione vendibilità/prezzo certo, banca/macrovoce, completezza inventario |
| F01/F02/F04/F05 | Obiettivo vicino già temporizzato = HORIZON; formulazione pensionato già prevista; quiz presentato come esempio, non esame | Tempo di lettura, ansia da risposta corretta e comprensione costi |
| X04/X05 e matrici opzionali | Dopo il risultato ordinario; riprendere B02 senza duplicarlo, ripresa per sezioni e mancanti ammessi | Misurare separatamente durata/abbandono; non contarli nei 5–8 minuti |

Conservare i 29 ID ordinari: nessuna domanda aggiunta o rimossa per raggiungere il tempo. In 3C il totale diventa 29+11 per le nuove lacune facoltative. X06 v2 sostituisce v1; X09–X11 sono progressivi e successivi al risultato ordinario. Stime non misurate: solo X11 circa 20–45 secondi; un obiettivo essenziale e X11 circa 45–90 secondi; risorse/vincoli e parte X10 circa 2–4 minuti; massimo con tre obiettivi/esperienze e vincoli circa 4–7 minuti o più. Sono tempi del modulo opzionale, non osservati o inclusi nei 5–8 minuti. Il [documento obiettivi](radar-patrimoniale-v1-profilazione-obiettivi.md) espone il carico reale di righe/campi.

Registrare durata totale, tempo attivo, pause/reperimento esterno, revisioni, abbandoni, campi effettivi e domande ripetute per percorso/perimetro. Interviste cognitive prima della prova temporizzata, con fasce e «non so/rifiuto» ammessi; se il target non regge, correggere la durata comunicata o rinviare dettagli al colloquio senza perdere vincoli materiali. Non attribuire maggiore competenza a chi risponde più velocemente.

| Evento | Effetto metodologico obbligatorio |
| --- | --- |
| S01 cambia | Riconferma di tutte le risposte riferite al perimetro; sospensione delle conclusioni collegate |
| S02 passa a parziale | Rapporti trasversali e netto globale sospesi; osservazioni qualitative conservate con limite |
| C01 diventa nessuno validato | C02/C04 inattivi con rate zero; C03 rimane attivo. X05 è inattivo con D zero solo se C03 esclude arretrati aperti e non emergono altri debiti, altrimenti resta approfondibile |
| C03 diventa ritardi in corso o non noto | Rimuovere l'eventuale D=0 derivato dalla precedente assenza; se X05 non è disponibile, N non calcolabile. I dati storici delle rate non vengono riscritti |
| C01 torna a debiti | Non riutilizzare zeri derivati; chiedere C02/C04 e, se desiderato, X05. Vecchie risposte richiedono riconferma |
| B02 passa a zero | P zero strutturale, X04 liquidità collegata; non dedurre zero sulle altre attività |
| E01 elimina una categoria | Righe X04/costi dipendenti inattive e fuori calcolo; non attribuire automaticamente N/A all'intera F |
| D01 cambia | Riallineare righe D02/X03; nessuna conclusione basata su una riga nascosta |
| X06 v1 viene ripreso in v2 | Conservare categoria/importo/tempo e provenienza; rango/natura non raccolti, non inventati. Chiedere solo nuovi dettagli pertinenti e facoltativi |
| X06 riordina/elimina una riga | Riferimenti stabili; G_i/vincoli seguono la riga, non la posizione. Alla rimozione inattivi nella nuova revisione, senza redistribuzione automatica |
| X09 cambia Cmin/G0 o rivela un impegno | Ricalcolare solo R-G; proporre eventuale rettifica esplicita B03/C04 se pertinente. Non sottrarre un obiettivo desiderato come spesa già dovuta |
| X10/X11 cambiano | Aggiornare agenda e contesto, non formule economiche, F03 o profili; aspettative non modificano quiz o capacità effettiva |
| Un'ipotesi economica viene corretta dopo evento | Nuova revisione e ricalcolo delle sole conseguenze; altri dati riconfermati se stesso periodo/perimetro |

Dipendenza di comparsa e dipendenza di formula sono distinte; nessun ciclo B↔C o A↔C. Le incoerenze non vengono «risolte» preferendo il numero più favorevole. In assenza di chiarimento: conservare la risposta come dichiarazione, marcare le quantità coinvolte non utilizzabili per quel calcolo e produrre una domanda di approfondimento.

## 11. Ripresa dopo l'evento e criteri di accettazione

Mantenere versioni e date delle risposte precedenti, proporre X01–X11 pertinenti e non ancora svolte senza ripetere i dati già noti; UNKNOWN/DECLINED non diventano richieste insistenti. Riconfermare solo importi/contesti cambiati. Cambiare T0 porta a nuova fotografia; non trattare stock vecchi e nuovi come simultanei. Nessuna iscrizione, autoselezione del funnel o profilo professionale viene letta come risposta a questo catalogo.

Accettazione della specifica: 40 ID unici, 29+11 correnti coerenti nei documenti, conteggi 29+8 conservati solo come storia esplicita della 3B; stati e zero distinguibili; ogni prompt ha testo/aiuto/area/tipo/opzioni/obbligatorietà/comparsa/dipendenze/validazioni/diagnosi/motivo/privacy; esempi con reddito nullo, nessun debito, nessun investimento e perimetro parziale; niente upload o campi identificativi. Tempi e comprensione devono essere verificati con il pilot, compreso il modulo obiettivi facoltativo e la differenza fra desiderio e capacità effettiva.

## 12. Raccolta unica per le due viste

La scelta della vista non cambia il catalogo, i valori, lo stato di risposta o la disponibilità del risultato. ClientResultProjection non riceve automaticamente la matrice economica completa; AdvisorResultProjection mostra dati e revisioni solo entro l'autorizzazione effettiva. Identità del contatto, evento di origine e responsabile sono collegamenti operativi server, non nuove domande o input per lo scoring. Se assenti/non verificati restano tali. Il colloquio può proporre chiarimenti delle stesse risposte: una nota dell'operatore o un'ipotesi non diventa VALUE né sostituisce la dichiarazione originaria; occorre revisione esplicita con provenienza e data. Percorso di accesso ai dati distinto dalla sintesi e specificato nella [doppia vista](radar-patrimoniale-v1-doppia-vista.md).
