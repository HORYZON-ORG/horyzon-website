// Verbatim metadata from RP-Q-1.2-draft. No runtime file/document dependency.
import type { QuestionDefinition, QuestionId } from "./types.ts";
export const QUESTION_CATALOG = [
  {
    "id": "RP-S01",
    "version": 1,
    "text": "Quale situazione vuoi descrivere?",
    "help": "Scegli una sola unità. Se scegli il nucleo, considera il bilancio che condividete ed evita di contare due volte trasferimenti fra voi",
    "area": "CONTEXT",
    "optional": false,
    "type": "**Area/tipo:** contesto trasversale; scelta singola. **Opzioni:** `INDIVIDUAL` Solo la mia; `HOUSEHOLD` Il nucleo con cui condivido il bilancio; più stati comuni. Nessuna unità monetaria.",
    "options": [
      "INDIVIDUAL",
      "HOUSEHOLD"
    ],
    "optionContract": "**Area/tipo:** contesto trasversale; scelta singola. **Opzioni:** `INDIVIDUAL` Solo la mia; `HOUSEHOLD` Il nucleo con cui condivido il bilancio; più stati comuni. Nessuna unità monetaria.",
    "applicability": "**O; comparsa:** sempre, prima degli importi. **Dipendenze:** nessuna.",
    "dependencies": [],
    "reconfirmOn": [],
    "validations": "**Validazioni:** una scelta; N/A non confermabile. Se cambia, tutti gli importi e le responsabilità diventano da riconfermare prima di riusarli.",
    "unit": null,
    "period": null,
    "indicators": [],
    "privacy": "**Privacy:** non richiede nominativi o relazione giuridica fra componenti."
  },
  {
    "id": "RP-S02",
    "version": 1,
    "text": "Per la situazione scelta, quanto sono completi i dati che puoi indicare?",
    "help": "Per esempio: conosci tutte le entrate ma soltanto una parte delle spese?",
    "area": "CONTEXT",
    "optional": false,
    "type": "**Area/tipo/opzioni:** contesto; singola: `COMPLETE` Entrate, spese e quote si riferiscono allo stesso perimetro; `PARTIAL` Conosco solo una parte del bilancio; stati comuni. «Non riesco a stabilirlo» è UNKNOWN, non un secondo valore indistinguibile da «Non so».",
    "options": [
      "COMPLETE",
      "PARTIAL"
    ],
    "optionContract": "**Area/tipo/opzioni:** contesto; singola: `COMPLETE` Entrate, spese e quote si riferiscono allo stesso perimetro; `PARTIAL` Conosco solo una parte del bilancio; stati comuni. «Non riesco a stabilirlo» è UNKNOWN, non un secondo valore indistinguibile da «Non so».",
    "applicability": "**O; comparsa:** sempre dopo S01, anche se non risposto. **Dipendenze:** S01.",
    "dependencies": [
      "RP-S01"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** non inferire COMPLETE dalla compilazione di molti campi; PARTIAL sospende rapporti trasversali e netto riferito all'intero nucleo. Una revisione esplicita può correggerlo.",
    "unit": null,
    "period": null,
    "indicators": [],
    "privacy": "**Privacy:** sola autovalutazione della copertura, nessuna motivazione libera obbligatoria."
  },
  {
    "id": "RP-S03",
    "version": 1,
    "text": "Da quali situazioni arrivano le entrate del perimetro scelto?",
    "help": "Puoi selezionarne più di una. Per il lavoro autonomo considera il denaro disponibile per la vita personale, non il fatturato",
    "area": "CONTEXT",
    "optional": false,
    "type": "**Area/tipo:** contesto/A/F; multipla. **Opzioni:** lavoro dipendente; professione/lavoro autonomo; impresa di cui sei/siete titolari; pensione; rendite/affitti; trasferimenti o sostegno regolare; nessuna entrata; stati comuni.",
    "options": [
      "EMPLOYEE",
      "PROFESSIONAL",
      "BUSINESS",
      "PENSION",
      "RENT",
      "TRANSFERS",
      "NONE"
    ],
    "optionContract": "**Area/tipo:** contesto/A/F; multipla. **Opzioni:** lavoro dipendente; professione/lavoro autonomo; impresa di cui sei/siete titolari; pensione; rendite/affitti; trasferimenti o sostegno regolare; nessuna entrata; stati comuni.",
    "applicability": "**O; comparsa:** sempre. **Dipendenze:** S01.",
    "dependencies": [
      "RP-S01"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** «nessuna» esclusiva; più fonti non equivalgono a indipendenza. Pensione può coesistere con lavoro; non chiedere il nome della fonte.",
    "unit": null,
    "period": null,
    "indicators": [],
    "privacy": "**Privacy:** niente datore di lavoro, impresa, ente specifico o causale assistenziale/sanitaria."
  },
  {
    "id": "RP-S04",
    "version": 1,
    "text": "Quante altre persone dipendono in misura importante dalle risorse di questo bilancio?",
    "help": "Indica solo un numero approssimativo, senza nomi o informazioni personali",
    "area": "CONTEXT",
    "optional": false,
    "type": "**Area/tipo/opzioni:** contesto/D; singola: 0, 1, 2, 3 o più, stati comuni. Unità: persone oltre chi sostiene il bilancio; per nucleo non sommare più volte la stessa persona.",
    "options": [
      "0",
      "1",
      "2",
      "3+"
    ],
    "optionContract": "**Area/tipo/opzioni:** contesto/D; singola: 0, 1, 2, 3 o più, stati comuni. Unità: persone oltre chi sostiene il bilancio; per nucleo non sommare più volte la stessa persona.",
    "applicability": "**O; comparsa:** sempre. **Dipendenze:** S01.",
    "dependencies": [
      "RP-S01"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** zero reale distinto da sconosciuto; non ricavare scale di equivalenza o reddito equivalente da «3+».",
    "unit": "PERSONS",
    "period": null,
    "indicators": [],
    "privacy": "**Privacy:** niente età, salute o identità dei dipendenti economici."
  },
  {
    "id": "RP-A01",
    "version": 1,
    "text": "Negli ultimi 12 mesi, quali sono state le entrate nette disponibili per il bilancio scelto?",
    "help": "Puoi indicare il totale annuo oppure la media mensile. Per attività autonome sottrai costi di lavoro, imposte e contributi. Escludi nuovi prestiti, vendite di beni, prelievi dal patrimonio e trasferimenti interni al nucleo",
    "area": "A",
    "optional": false,
    "type": "**Area/tipo/opzioni:** A; importo FM con periodo T12 mensile/annuo, valore facoltativo o stati comuni; EUR. Zero è ammesso e non è N/A.",
    "options": [],
    "optionContract": "**Area/tipo/opzioni:** A; importo FM con periodo T12 mensile/annuo, valore facoltativo o stati comuni; EUR. Zero è ammesso e non è N/A.",
    "applicability": "**O; comparsa:** sempre. **Dipendenze:** S01/S02; contesto S03.",
    "dependencies": [
      "RP-S01",
      "RP-S02",
      "RP-S03"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** non usare fatturato/utile societario non distribuito; confermare un conflitto «nessuna entrata» con valore positivo. Copertura temporale incompleta segnalata, senza extrapolazione.",
    "unit": "EUR",
    "period": "T12",
    "indicators": [
      "I-A01",
      "I-A02",
      "I-C01",
      "I-C02"
    ],
    "privacy": "**Privacy:** importo aggregato e fascia preferita, nessuna fonte nominativa."
  },
  {
    "id": "RP-A02",
    "version": 1,
    "text": "Nello stesso periodo, quanto è uscito per le spese del bilancio, escluse le rate di debiti?",
    "help": "Includi affitto, consumi, premi e spese annuali. Le rate intere saranno chieste a parte. Escludi versamenti a risparmio o investimenti, acquisti di attività patrimoniali e trasferimenti interni. Non contare due volte imposte già sottratte dalle entrate",
    "area": "A",
    "optional": false,
    "type": "**Area/tipo/opzioni:** A; FM o valore, mensile medio/annuo T12, EUR, stati comuni; zero ammesso.",
    "options": [],
    "optionContract": "**Area/tipo/opzioni:** A; FM o valore, mensile medio/annuo T12, EUR, stati comuni; zero ammesso.",
    "applicability": "**O; comparsa:** sempre. **Dipendenze:** S01/S02 e finestra T12 di A01, senza necessità di conoscere il valore A01.",
    "dependencies": [
      "RP-S01",
      "RP-S02",
      "RP-A01"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** spesa eccezionale di consumo inclusa se sostenuta in T12; acquisto casa escluso dal consumo, non ignorato come esposizione. Non inserire qui rimborso capitale/interessi già compresi nelle rate C02.",
    "unit": "EUR",
    "period": "T12",
    "indicators": [
      "I-A01",
      "I-A02",
      "I-B02"
    ],
    "privacy": "**Privacy:** nessun dettaglio di singoli acquisti o beneficiari."
  },
  {
    "id": "RP-A03",
    "version": 1,
    "text": "Quale situazione descrive meglio il modo in cui sono state coperte le uscite negli ultimi 12 mesi?",
    "help": "Un prelievo dal patrimonio previsto in un piano è diverso dal dover usare risparmi o nuovo credito senza averlo programmato",
    "area": "A",
    "optional": false,
    "type": "**Area/tipo/opzioni:** A; singola: `COVERED` Le entrate sono bastate senza ricorrere al patrimonio; `PLANNED_DRAW` Ho/abbiamo usato patrimonio secondo un piano; `OCCASIONAL_GAP` Risparmi o nuovo credito non previsti in alcuni mesi; `REPEATED_GAP` Risparmi o nuovo credito non previsti nella maggior parte dei mesi; stati comuni.",
    "options": [
      "COVERED",
      "PLANNED_DRAW",
      "OCCASIONAL_GAP",
      "REPEATED_GAP"
    ],
    "optionContract": "**Area/tipo/opzioni:** A; singola: `COVERED` Le entrate sono bastate senza ricorrere al patrimonio; `PLANNED_DRAW` Ho/abbiamo usato patrimonio secondo un piano; `OCCASIONAL_GAP` Risparmi o nuovo credito non previsti in alcuni mesi; `REPEATED_GAP` Risparmi o nuovo credito non previsti nella maggior parte dei mesi; stati comuni.",
    "applicability": "**O; comparsa:** sempre. **Dipendenze:** solo S01; leggibile anche con importi ignoti.",
    "dependencies": [
      "RP-S01"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** opzione prevalente; «alcuni mesi» non contraddice necessariamente un avanzo annuale. PLANNED_DRAW non prova che il piano durerà.",
    "unit": null,
    "period": null,
    "indicators": [
      "I-A01"
    ],
    "privacy": "**Privacy:** non chiedere causali delle difficoltà o eventi di vita."
  },
  {
    "id": "RP-A04",
    "version": 1,
    "text": "Quanto sono state prevedibili le entrate negli ultimi 12 mesi?",
    "help": "Considera anche entrate stagionali: possono variare molto ma essere previste",
    "area": "A",
    "optional": false,
    "type": "**Area/tipo/opzioni:** A; singola: regolari; variabili ma abbastanza prevedibili; variabili e poco prevedibili; nessuna entrata; stati comuni.",
    "options": [
      "REGULAR",
      "PREDICTABLE_VARIABLE",
      "UNPREDICTABLE",
      "NO_INCOME"
    ],
    "optionContract": "**Area/tipo/opzioni:** A; singola: regolari; variabili ma abbastanza prevedibili; variabili e poco prevedibili; nessuna entrata; stati comuni.",
    "applicability": "**O; comparsa:** sempre. **Dipendenze:** S03/A01 per coerenza, non per disponibilità.",
    "dependencies": [
      "RP-S03",
      "RP-A01"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** non attribuire volatilità numerica all'ordine delle opzioni; se contraddice Y positivo/zero, richiesta di chiarimento.",
    "unit": null,
    "period": null,
    "indicators": [
      "I-A04"
    ],
    "privacy": "**Privacy:** niente calendario degli incassi o nomi dei clienti."
  },
  {
    "id": "RP-A05",
    "version": 1,
    "text": "Quale quota delle entrate dipende dalla stessa fonte principale?",
    "help": "Per esempio lo stesso lavoro, impresa, pensione o affitto. Non serve indicarne il nome. Più pagamenti della stessa fonte contano insieme",
    "area": "A",
    "optional": false,
    "type": "**Area/tipo/opzioni:** A; quota autodichiarata: fino al 50%; oltre 50% e fino a 80%; oltre 80% e fino a 100%; stati comuni. Intervalli inclusivi come espressi; zero non è una quota principale se esistono entrate.",
    "options": [
      "LE50",
      "GT50_LE80",
      "GT80"
    ],
    "optionContract": "**Area/tipo/opzioni:** A; quota autodichiarata: fino al 50%; oltre 50% e fino a 80%; oltre 80% e fino a 100%; stati comuni. Intervalli inclusivi come espressi; zero non è una quota principale se esistono entrate.",
    "applicability": "**O; comparsa:** salvo A01=0 reale o S03/A04 «nessuna entrata» coerenti. **Dipendenze:** A01/S03/A04. Con importo reddito ignoto ma esistenza dichiarata, la quota relativa resta acquisibile.",
    "dependencies": [
      "RP-A01",
      "RP-S03",
      "RP-A04"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** percentuale 0–100, ma 0 incompatibile con un massimo su entrate positive; non dividere il reddito per il numero di fonti.",
    "unit": null,
    "period": null,
    "indicators": [
      "I-A03"
    ],
    "privacy": "**Privacy:** nessuna identificazione della fonte o della persona che paga."
  },
  {
    "id": "RP-B01",
    "version": 1,
    "text": "Oggi, quanto servirebbe per un mese di spese essenziali, escluse le rate?",
    "help": "Pensa al minimo realistico per abitazione, alimentazione, utenze, trasporti e altre necessità. Le rate attualmente dovute saranno aggiunte da C04. È un budget attuale, diverso dalla media storica A02",
    "area": "B",
    "optional": false,
    "type": "**Area/tipo/opzioni:** B; FM mensile Tnow o valore, EUR, stati comuni; zero ammesso con conferma.",
    "options": [],
    "optionContract": "**Area/tipo/opzioni:** B; FM mensile Tnow o valore, EUR, stati comuni; zero ammesso con conferma.",
    "applicability": "**O; comparsa:** sempre. **Dipendenze:** S01/S02.",
    "dependencies": [
      "RP-S01",
      "RP-S02"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** nessuna sottrazione di spese già comprese altrove; B01>A02 può dipendere da un cambiamento di periodo e non è un errore bloccante. Zero non genera autonomia infinita.",
    "unit": "EUR",
    "period": "Tnow",
    "indicators": [
      "I-B01",
      "I-A04"
    ],
    "privacy": "**Privacy:** nessun dettaglio sanitario o di acquisti essenziali."
  },
  {
    "id": "RP-B02",
    "version": 1,
    "text": "Quale somma è disponibile oggi, o entro sette giorni, senza nuovo debito né vendita a un prezzo incerto?",
    "help": "Considera contanti e somme effettivamente prelevabili. Non includere fidi, carte di credito, casa o investimenti che richiederebbero di accettare una perdita o una penale rilevante. Includi per ora anche gli accantonamenti, che separeremo dopo",
    "area": "B",
    "optional": false,
    "type": "**Area/tipo/opzioni:** B; ST o valore a T0, EUR, stati comuni, zero reale.",
    "options": [],
    "optionContract": "**Area/tipo/opzioni:** B; ST o valore a T0, EUR, stati comuni, zero reale.",
    "applicability": "**O; comparsa:** sempre. **Dipendenze:** S01/S02.",
    "dependencies": [
      "RP-S01",
      "RP-S02"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** quota riferita al perimetro, non saldo complessivo di conto cointestato se quota ignota; disponibilità incerta → stima/UNKNOWN, non credito utilizzabile.",
    "unit": "EUR",
    "period": "T0",
    "indicators": [
      "I-B01",
      "I-B02",
      "I-E01",
      "I-E02",
      "I-E03"
    ],
    "privacy": "**Privacy:** niente banca, numero di conto o credenziali."
  },
  {
    "id": "RP-B03",
    "version": 1,
    "text": "Di questa somma, quale parte è già accantonata per uscite non rinviabili?",
    "help": "Considera solo importi già presenti e destinati a impegni noti nei prossimi 12 mesi, non già coperti dal budget mensile. Non sottrarremo nuovamente questi importi dalle spese correnti",
    "area": "B",
    "optional": false,
    "type": "**Area/tipo/opzioni:** B; ST o valore a T0, EUR, stati comuni; zero = nessun accantonamento di questo tipo.",
    "options": [],
    "optionContract": "**Area/tipo/opzioni:** B; ST o valore a T0, EUR, stati comuni; zero = nessun accantonamento di questo tipo.",
    "applicability": "**O; comparsa:** se B02 diverso da zero o sconosciuto. **Dipendenze:** B02. B02=0 valido implica P=0 strutturale e salto motivato.",
    "dependencies": [
      "RP-B02"
    ],
    "reconfirmOn": [
      "RP-S01",
      "RP-B02"
    ],
    "validations": "**Validazioni:** P<=L solo se i valori consentono di verificarlo; intervalli senza alcuna combinazione compatibile producono incoerenza. Non troncare silenziosamente P né sottrarre l'intero costo futuro di un obiettivo.",
    "unit": "EUR",
    "period": "T0",
    "indicators": [
      "I-B01",
      "I-B02"
    ],
    "privacy": "**Privacy:** solo totale, nessun tipo di impegno obbligatorio."
  },
  {
    "id": "RP-B04",
    "version": 1,
    "text": "Se arrivasse una spesa imprevista pari a un mese delle spese essenziali, rate comprese, come potrebbe affrontarla questo bilancio entro 30 giorni?",
    "help": "È uno scenario educativo, non una richiesta di spesa. Non contare nuovo credito come denaro già disponibile",
    "area": "B",
    "optional": false,
    "type": "**Area/tipo/opzioni:** B; singola: con somme disponibili senza intaccare impegni già accantonati; solo usando somme già destinate ad altro; vendendo beni/investimenti o chiedendo denaro; non saprei come pagarla; stati comuni.",
    "options": [
      "OWN_AVAILABLE",
      "EARMARKED",
      "SELL_OR_BORROW",
      "CANNOT_PAY"
    ],
    "optionContract": "**Area/tipo/opzioni:** B; singola: con somme disponibili senza intaccare impegni già accantonati; solo usando somme già destinate ad altro; vendendo beni/investimenti o chiedendo denaro; non saprei come pagarla; stati comuni.",
    "applicability": "**O; comparsa:** sempre; se denominatore B01+C04 non noto, mostrare lo stesso testo senza inventare importo. **Dipendenze:** B01/C04 per l'eventuale cifra, non per raccogliere la percezione.",
    "dependencies": [
      "RP-B01",
      "RP-C04"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** se L=P=0 e risposta «somme disponibili», richiedere conferma, non imputare una riserva. La disponibilità entro 30 giorni differisce dall'accessibilità in sette giorni: non ogni scostamento è contraddizione.",
    "unit": null,
    "period": null,
    "indicators": [
      "I-B03"
    ],
    "privacy": "**Privacy:** nessuna identità di potenziali prestatori/familiari."
  },
  {
    "id": "RP-C01",
    "version": 1,
    "text": "Quali debiti sono aperti oggi o hanno richiesto pagamenti negli ultimi 12 mesi?",
    "help": "Considera il perimetro scelto, anche prestiti informali e pagamenti rateali. Un debito può esistere anche se oggi non paghi rate",
    "area": "C",
    "optional": false,
    "type": "**Area/tipo/opzioni:** C; multipla: mutuo; prestiti personali/credito al consumo; carte rateali/revolving; altri debiti a rimborso, anche informali; nessuno in entrambi i periodi; stati comuni.",
    "options": [
      "MORTGAGE",
      "CONSUMER",
      "REVOLVING",
      "OTHER",
      "NONE"
    ],
    "optionContract": "**Area/tipo/opzioni:** C; multipla: mutuo; prestiti personali/credito al consumo; carte rateali/revolving; altri debiti a rimborso, anche informali; nessuno in entrambi i periodi; stati comuni.",
    "applicability": "**O; comparsa:** sempre. **Dipendenze:** S01/S02.",
    "dependencies": [
      "RP-S01"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** «nessuno» esclusivo e conferma dei due periodi; consente R12=Rnow=0 strutturali, non assenza di arretrati per affitto/utenze. Il residuo totale D è zero strutturale solo se C03 è «nessuno» o «ritardi risolti» e non emergono altri debiti aperti. Con C03 corrente/ignoto non dedurre D=0. Non cancellare C03.",
    "unit": null,
    "period": null,
    "indicators": [
      "I-C01",
      "I-C02",
      "I-E01"
    ],
    "privacy": "**Privacy:** non chiedere creditore o numero di contratto."
  },
  {
    "id": "RP-C02",
    "version": 1,
    "text": "Quanto è stato pagato complessivamente in rate negli ultimi 12 mesi, per il bilancio scelto?",
    "help": "Includi capitale e interessi, con lo stesso periodo delle entrate. Scegli totale annuo o media mensile. Non ripetere le rate fra le spese A02",
    "area": "C",
    "optional": false,
    "type": "**Area/tipo/opzioni:** C/A; FM o valore mensile medio/annuo T12, EUR, stati comuni, zero ammesso anche con debito aperto.",
    "options": [],
    "optionContract": "**Area/tipo/opzioni:** C/A; FM o valore mensile medio/annuo T12, EUR, stati comuni, zero ammesso anche con debito aperto.",
    "applicability": "**O condizionale; comparsa:** C01 non è «nessuno» validato; con C01 sconosciuto si può rispondere, senza inferire il tipo di debito. **Dipendenze:** C01, periodo A01.",
    "dependencies": [
      "RP-C01",
      "RP-S01",
      "RP-S02"
    ],
    "reconfirmOn": [
      "RP-S01",
      "RP-C01"
    ],
    "validations": "**Validazioni:** zero non significa assenza di debiti; differenza da C04 ammessa per estinzioni o nuove rate. Non sommare C02 e C04 nello stesso flusso.",
    "unit": "EUR",
    "period": "T12",
    "indicators": [
      "I-A01",
      "I-A02",
      "I-B02",
      "I-C01"
    ],
    "privacy": "**Privacy:** totale aggregato, nessun contratto."
  },
  {
    "id": "RP-C03",
    "version": 1,
    "text": "Negli ultimi 12 mesi ci sono stati ritardi per difficoltà di pagamento di rate, affitto o utenze?",
    "help": "Non servono cause personali o importi del singolo ritardo",
    "area": "C",
    "optional": false,
    "type": "**Area/tipo/opzioni:** C; singola: nessuno; uno o più ritardi poi risolti; ritardi ancora in corso; stati comuni.",
    "options": [
      "NONE",
      "RESOLVED",
      "CURRENT"
    ],
    "optionContract": "**Area/tipo/opzioni:** C; singola: nessuno; uno o più ritardi poi risolti; ritardi ancora in corso; stati comuni.",
    "applicability": "**O; comparsa:** sempre, anche senza prestiti. **Dipendenze:** S01/T12.",
    "dependencies": [
      "RP-S01"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** ritardo amministrativo non legato a difficoltà non è la risposta richiesta; non determinare numero di giorni o segnalazioni creditizie.",
    "unit": null,
    "period": null,
    "indicators": [
      "I-C03",
      "I-E01"
    ],
    "privacy": "**Privacy:** niente causali sanitarie, creditori o documentazione di insolvenza."
  },
  {
    "id": "RP-C04",
    "version": 1,
    "text": "Quanto è dovuto oggi in rate per un mese ordinario?",
    "help": "È la somma attualmente da pagare, anche se non sei riuscito a pagarla. Includi le rate minime obbligatorie; segnala se sai che cambieranno. Per scadenze non mensili puoi indicare l'equivalente annuo diviso 12, sapendo che non descrive la singola scadenza",
    "area": "C",
    "optional": false,
    "type": "**Area/tipo/opzioni:** C/B; FM mensile Tnow o valore, EUR, stati comuni; selettore accessorio `cambiamento noto entro 12 mesi: sì/no/non so` senza dettagli. Zero reale ammesso.",
    "options": [],
    "optionContract": "**Area/tipo/opzioni:** C/B; FM mensile Tnow o valore, EUR, stati comuni; selettore accessorio `cambiamento noto entro 12 mesi: sì/no/non so` senza dettagli. Zero reale ammesso.",
    "applicability": "**O condizionale; comparsa:** come C02. **Dipendenze:** C01; B01 usa questo valore senza dipendere dal suo esito.",
    "dependencies": [
      "RP-C01",
      "RP-S01",
      "RP-S02"
    ],
    "reconfirmOn": [
      "RP-S01",
      "RP-C01"
    ],
    "validations": "**Validazioni:** non inserire rata «pagata» nulla se la rata dovuta è positiva. Equivalente mensile non spiana realmente un pagamento a scadenza. Se «nessuno» C01, zero strutturale e salto.",
    "unit": "EUR",
    "period": "Tnow",
    "indicators": [
      "I-A04",
      "I-B01",
      "I-C02"
    ],
    "privacy": "**Privacy:** somma e indicazione di cambiamento, non tipo contrattuale dettagliato."
  },
  {
    "id": "RP-D01",
    "version": 1,
    "text": "Quali responsabilità economiche meritano una verifica in caso di imprevisto?",
    "help": "Non indicare condizioni di salute. Considera conseguenze economiche, non il nome di una polizza",
    "area": "D",
    "optional": false,
    "type": "**Area/tipo/opzioni:** D; multipla: continuità delle entrate da lavoro; sostentamento di altre persone; disponibilità di casa o beni essenziali; responsabilità economiche verso terzi; nessuna esposizione rilevante individuata; stati comuni.",
    "options": [
      "INCOME",
      "SUPPORT",
      "HOME",
      "LIABILITY",
      "NONE"
    ],
    "optionContract": "**Area/tipo/opzioni:** D; multipla: continuità delle entrate da lavoro; sostentamento di altre persone; disponibilità di casa o beni essenziali; responsabilità economiche verso terzi; nessuna esposizione rilevante individuata; stati comuni.",
    "applicability": "**O; comparsa:** sempre. **Dipendenze:** S03/S04 solo per richieste di coerenza, mai per preselezione di coperture.",
    "dependencies": [
      "RP-S01",
      "RP-S04",
      "RP-S03"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** «nessuna» esclusiva, non prova che il rischio sia assente. S04>0 senza sostentamento richiede conferma, non deduzione automatica.",
    "unit": null,
    "period": null,
    "indicators": [
      "I-D01"
    ],
    "privacy": "**Privacy:** niente diagnosi, abitudini sanitarie o identità dei beneficiari."
  },
  {
    "id": "RP-D02",
    "version": 1,
    "text": "Per ciascuna responsabilità indicata, quale strategia è stata individuata?",
    "help": "Può essere una protezione pubblica, aziendale, contrattuale, privata o una riserva scelta consapevolmente. Avere una polizza non basta a sapere cosa copre",
    "area": "D",
    "optional": false,
    "type": "**Area/tipo/opzioni:** D; matrice delle sole righe D01 selezionate. Ogni riga: `CHECKED` Strategia individuata e limiti principali controllati; `UNREVIEWED` Strategia presente ma limiti non controllati; `GAP` Esigenza individuata, risposta non ancora definita; UNKNOWN; DECLINED; N/A motivato. Nessun importo.",
    "options": [
      "CHECKED",
      "UNREVIEWED",
      "GAP"
    ],
    "optionContract": "**Area/tipo/opzioni:** D; matrice delle sole righe D01 selezionate. Ogni riga: `CHECKED` Strategia individuata e limiti principali controllati; `UNREVIEWED` Strategia presente ma limiti non controllati; `GAP` Esigenza individuata, risposta non ancora definita; UNKNOWN; DECLINED; N/A motivato. Nessun importo.",
    "applicability": "**O condizionale; comparsa:** almeno una esposizione in D01. **Dipendenze:** D01. D01 ignoto → offrire chiarimento, non creare righe fittizie. «Nessuna» → salto e area non attestabile, non «protetto».",
    "dependencies": [
      "RP-D01"
    ],
    "reconfirmOn": [
      "RP-S01",
      "RP-D01"
    ],
    "validations": "**Validazioni:** valutare riga per riga; CHECKED è una dichiarazione, non audit contrattuale; nessuna proporzione «polizze possedute/necessarie».",
    "unit": null,
    "period": null,
    "indicators": [
      "I-D01"
    ],
    "privacy": "**Privacy:** niente nomi delle coperture, numeri polizza, beneficiari o motivi sanitari."
  },
  {
    "id": "RP-E01",
    "version": 1,
    "text": "Quali attività fanno parte oggi del patrimonio del perimetro scelto?",
    "help": "Segna solo ciò che esiste oggi. Valori e quote saranno facoltativi. Non includere redditi futuri o il valore teorico di pensioni non ancora erogate",
    "area": "E",
    "optional": false,
    "type": "**Area/tipo/opzioni:** E; multipla: liquidità B02; strumenti finanziari non previdenziali; abitazione principale; altri immobili; partecipazione nella propria attività; metalli o beni da collezione con valore stimabile; cripto-attività; altre attività valutabili; posizione previdenziale vincolata con capitale noto; nessuna attività; stati comuni.",
    "options": [
      "CASH",
      "FINANCIAL",
      "HOME",
      "OTHER_PROPERTY",
      "BUSINESS",
      "VALUABLES",
      "CRYPTO",
      "OTHER",
      "PENSION",
      "NONE"
    ],
    "optionContract": "**Area/tipo/opzioni:** E; multipla: liquidità B02; strumenti finanziari non previdenziali; abitazione principale; altri immobili; partecipazione nella propria attività; metalli o beni da collezione con valore stimabile; cripto-attività; altre attività valutabili; posizione previdenziale vincolata con capitale noto; nessuna attività; stati comuni.",
    "applicability": "**O; comparsa:** sempre. **Dipendenze:** B02 per coerenza, non per obbligare a conoscere il valore.",
    "dependencies": [
      "RP-S01"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** «nessuna» esclusiva; B02>0 implica necessità di confermare la voce liquidità. B02=0 non implica patrimonio zero. Non includere gli stessi beni sia nell'impresa sia direttamente, se già nel valore della quota. La conferma di completezza dell'inventario già prevista è esplicita: classi omesse non sono automaticamente assenti. E01 che esclude tutte le attività non previdenziali, con inventario confermato e B02=0 coerente, permette A=0 strutturale senza X04; mai D=0 automatico. Composizione N/A non esclude l'area E o i debiti.",
    "unit": null,
    "period": null,
    "indicators": [
      "I-E01",
      "I-E03",
      "I-F02"
    ],
    "privacy": "**Privacy:** nessun ISIN, indirizzo, wallet o nome d'impresa."
  },
  {
    "id": "RP-E02",
    "version": 1,
    "text": "Considerando le attività non previdenziali, quanta parte è nella stessa principale esposizione?",
    "help": "Per esempio un solo immobile, un'impresa o strumenti legati allo stesso emittente. Conta l'esposizione economica, non il numero di prodotti",
    "area": "E",
    "optional": false,
    "type": "**Area/tipo/opzioni:** E; quota (meno della metà; dalla metà a meno di tre quarti; tre quarti o più; stati comuni) e tipo generico dell'esposizione (liquidità; immobile; propria impresa; emittente finanziario; altro; non so). Quota stimata, non censimento verificato; due campi nello stesso prompt.",
    "options": [
      "LT50",
      "GE50_LT75",
      "GE75"
    ],
    "optionContract": "**Area/tipo/opzioni:** E; quota (meno della metà; dalla metà a meno di tre quarti; tre quarti o più; stati comuni) e tipo generico dell'esposizione (liquidità; immobile; propria impresa; emittente finanziario; altro; non so). Quota stimata, non censimento verificato; due campi nello stesso prompt.",
    "applicability": "**O condizionale; comparsa:** E01 contiene attività non previdenziali; se E01 incerto, domanda facoltativamente rispondibile come stima. **Dipendenze:** E01.",
    "dependencies": [
      "RP-E01"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** se sola liquidità, la quota può descrivere la macrovoce liquidità ma non un'unica banca: lo specifica il tipo. Nessun nome necessario; distinguere questa quota dal calcolo per macroclasse X04. Tipo non noto non permette di applicare la regola H-E75 automaticamente.",
    "unit": null,
    "period": null,
    "indicators": [
      "I-E03"
    ],
    "privacy": "**Privacy:** categoria generica, niente soggetto emittente identificabile."
  },
  {
    "id": "RP-E03",
    "version": 1,
    "text": "Se ti servissero entro 30 giorni, quanta parte di queste attività non previdenziali potresti trasformare in denaro senza incertezza rilevante sul ricavo?",
    "help": "Una casa o una quota d'impresa di valore non sono automaticamente somme disponibili. Anche un titolo vendibile può avere un valore incerto",
    "area": "E",
    "optional": false,
    "type": "**Area/tipo/opzioni:** E; singola: meno di un quarto; da un quarto a meno della metà; almeno metà ma non tutte; tutte; stati comuni.",
    "options": [
      "LT25",
      "GE25_LT50",
      "GE50_NOT_ALL",
      "ALL"
    ],
    "optionContract": "**Area/tipo/opzioni:** E; singola: meno di un quarto; da un quarto a meno della metà; almeno metà ma non tutte; tutte; stati comuni.",
    "applicability": "**O condizionale; comparsa:** come E02. **Dipendenze:** E01.",
    "dependencies": [
      "RP-E01"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** non equiparare a L entro sette giorni; discordanza è da chiarire, non da correggere d'ufficio. Se sola cassa prelevabile e quota «meno di un quarto», richiedere verifica del perimetro.",
    "unit": null,
    "period": null,
    "indicators": [
      "I-E03"
    ],
    "privacy": "**Privacy:** nessun bene identificabile o valore richiesto."
  },
  {
    "id": "RP-E04",
    "version": 1,
    "text": "Una parte importante delle entrate e del patrimonio dipende dalla stessa attività o dallo stesso rischio economico?",
    "help": "Per esempio lavoro nella propria impresa e quota dell'impresa, oppure reddito e beni concentrati nello stesso mercato. Non indicare nomi",
    "area": "E",
    "optional": false,
    "type": "**Area/tipo/opzioni:** E/A; singola: sì; no; stati comuni. «Parte importante» resta autovalutazione qualitativa, non percentuale implicita.",
    "options": [
      "YES",
      "NO"
    ],
    "optionContract": "**Area/tipo/opzioni:** E/A; singola: sì; no; stati comuni. «Parte importante» resta autovalutazione qualitativa, non percentuale implicita.",
    "applicability": "**O condizionale; comparsa:** attività non previdenziali presenti, come E02. **Dipendenze:** E01/A01; contesto A05/S03.",
    "dependencies": [
      "RP-E01",
      "RP-S03",
      "RP-A01"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** ruolo imprenditore non equivale a sì; assenza di risposta non equivale a indipendenza. Reddito nullo reale → N/A confermato per il legame reddito/patrimonio, non per E intera.",
    "unit": null,
    "period": null,
    "indicators": [
      "I-E04"
    ],
    "privacy": "**Privacy:** non identificare datore, area geografica puntuale o settore sensibile."
  },
  {
    "id": "RP-F01",
    "version": 1,
    "text": "Come sono stati definiti gli obiettivi economici dei prossimi anni per il bilancio scelto?",
    "help": "Può essere un obiettivo piccolo: affrontare un imprevisto, una spesa, un cambiamento o le esigenze della pensione",
    "area": "F",
    "optional": false,
    "type": "**Area/tipo/opzioni:** F; singola: `NONE` Nessun obiettivo definito; `IDEA` Un'idea, senza tempo né importo; `HORIZON` Un obiettivo con orizzonte; `DEFINED` Un obiettivo con tempo e risorse da verificare/già stimate; stati comuni. X06 raccoglie dettagli facoltativi.",
    "options": [
      "NONE",
      "IDEA",
      "HORIZON",
      "DEFINED"
    ],
    "optionContract": "**Area/tipo/opzioni:** F; singola: `NONE` Nessun obiettivo definito; `IDEA` Un'idea, senza tempo né importo; `HORIZON` Un obiettivo con orizzonte; `DEFINED` Un obiettivo con tempo e risorse da verificare/già stimate; stati comuni. X06 raccoglie dettagli facoltativi.",
    "applicability": "**O; comparsa:** sempre. **Dipendenze:** S01.",
    "dependencies": [
      "RP-S01"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** NONE è valore reale, non N/A; non richiede un obiettivo di investimento né un importo elevato. Un'esigenza vicina con tempo noto appartiene a HORIZON anche se manca la cifra: esplicitarlo nell'aiuto, senza nuova domanda. X06 che rivela un obiettivo temporizzato richiede riconciliazione esplicita, non lascia attiva una lettura FERMI basata sull'assenza di obiettivi.",
    "unit": null,
    "period": null,
    "indicators": [
      "I-F01"
    ],
    "privacy": "**Privacy:** nessun testo libero su eventi personali."
  },
  {
    "id": "RP-F02",
    "version": 1,
    "text": "Sono state verificate le risorse che potrebbero sostenere le spese di questo bilancio in pensione o nel lungo periodo?",
    "variants": [{ "when": "PENSION_WITHOUT_EMPLOYEE_PROFESSIONAL_BUSINESS", "text": "Sono state confrontate le risorse già disponibili in pensione con le esigenze del prossimo periodo di vita?" }],
    "help": "Non serve indicare l'importo della pensione né aderire a un fondo. Una simulazione o un documento non garantiscono il futuro",
    "area": "F",
    "optional": false,
    "type": "**Area/tipo/opzioni:** F; singola: `CHECKED` Confronto fatto usando informazioni ufficiali o contrattuali datate; `ROUGH` Solo un'idea/stima non verificata; `NOT_REVIEWED` Non ho/abbiamo ancora fatto il confronto; stati comuni.",
    "options": [
      "CHECKED",
      "ROUGH",
      "NOT_REVIEWED"
    ],
    "optionContract": "**Area/tipo/opzioni:** F; singola: `CHECKED` Confronto fatto usando informazioni ufficiali o contrattuali datate; `ROUGH` Solo un'idea/stima non verificata; `NOT_REVIEWED` Non ho/abbiamo ancora fatto il confronto; stati comuni.",
    "applicability": "**O; comparsa:** sempre. **Dipendenze:** S03 determina solo la variante del testo; se ignoto o nucleo con lavoro e pensione usare testo ordinario, che copre anche il lungo periodo dei componenti ancora al lavoro.",
    "dependencies": [
      "RP-S01",
      "RP-S03"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** nessun N/A per il solo fatto di essere già pensionato o non avere previdenza complementare. CHECKED non significa copertura sufficiente. X08 può precisare fonte/data.",
    "unit": null,
    "period": null,
    "indicators": [
      "I-F04"
    ],
    "privacy": "**Privacy:** niente età precisa, ente nominativo, invalidità o importi pensionistici."
  },
  {
    "id": "RP-F03",
    "version": 1,
    "text": "Come vengono prese le principali decisioni economiche e patrimoniali del bilancio scelto?",
    "help": "Affidarsi a un professionista e decidere in autonomia sono modalità diverse, non una graduatoria",
    "area": "F",
    "optional": false,
    "type": "**Area/tipo/opzioni:** F; singola: soprattutto direttamente; con confronto e decisione condivisa con un professionista; delegando prevalentemente a un professionista; decide soprattutto un'altra persona del bilancio; stati comuni.",
    "options": [
      "DIRECT",
      "WITH_PROFESSIONAL",
      "DELEGATED_PROFESSIONAL",
      "OTHER_HOUSEHOLD"
    ],
    "optionContract": "**Area/tipo/opzioni:** F; singola: soprattutto direttamente; con confronto e decisione condivisa con un professionista; delegando prevalentemente a un professionista; decide soprattutto un'altra persona del bilancio; stati comuni.",
    "applicability": "**O; comparsa:** sempre. **Dipendenze:** S01.",
    "dependencies": [
      "RP-S01"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** non inferire consulenza remunerata, competenza, capacità giuridica o autorizzazioni del soggetto esterno.",
    "unit": null,
    "period": null,
    "indicators": [
      "I-F02"
    ],
    "privacy": "**Privacy:** nessun nome di consulente o familiare."
  },
  {
    "id": "RP-F04",
    "version": 1,
    "text": "Per gli investimenti del bilancio scelto, riesci a individuare e spiegare i costi complessivi, anche confrontandoti con chi li segue?",
    "help": "Comprendere i costi è diverso dal sapere che esiste una commissione. Non devi comunicarci documenti o contratti",
    "area": "F",
    "optional": false,
    "type": "**Area/tipo/opzioni:** F; singola: `EXPLAIN` So/sappiamo individuarli e spiegarli su un riepilogo; `FOUND` Li ho/abbiamo individuati ma non so/sappiamo spiegarli; `NOT_FOUND` Non li ho/abbiamo individuati; stati comuni.",
    "options": [
      "EXPLAIN",
      "FOUND",
      "NOT_FOUND"
    ],
    "optionContract": "**Area/tipo/opzioni:** F; singola: `EXPLAIN` So/sappiamo individuarli e spiegarli su un riepilogo; `FOUND` Li ho/abbiamo individuati ma non so/sappiamo spiegarli; `NOT_FOUND` Non li ho/abbiamo individuati; stati comuni.",
    "applicability": "**O condizionale; comparsa:** E01 include strumenti finanziari non previdenziali o posizione previdenziale con capitale. Se E01 ignoto, offrire il quesito senza presumere investimenti; applicabilità resta indeterminata. **Dipendenze:** E01.",
    "dependencies": [
      "RP-E01"
    ],
    "reconfirmOn": [
      "RP-S01",
      "RP-E01"
    ],
    "validations": "**Validazioni:** sola liquidità o sola casa non rende obbligatorio il quesito. N/A confermato se non esistono queste posizioni; possesso di cripto/collezioni da solo non prova costi di strumenti finanziari trattati dal quesito.",
    "unit": null,
    "period": null,
    "indicators": [
      "I-F02"
    ],
    "privacy": "**Privacy:** nessun nome, documento o ammontare di commissione reale."
  },
  {
    "id": "RP-F05",
    "version": 1,
    "text": "Una persona possiede diversi investimenti tutti legati alla stessa impresa. Quale affermazione è più corretta?",
    "help": "È un esempio generale: non valuta i tuoi investimenti",
    "area": "F",
    "optional": false,
    "type": "**Area/tipo/opzioni:** F; singola: `COUNT` Il numero di investimenti basta a eliminare la concentrazione; `EXPOSURE` La dipendenza dalla stessa impresa può rimanere; UNKNOWN; DECLINED. N/A non confermabile per il solo fatto di non investire.",
    "options": [
      "COUNT",
      "EXPOSURE"
    ],
    "optionContract": "**Area/tipo/opzioni:** F; singola: `COUNT` Il numero di investimenti basta a eliminare la concentrazione; `EXPOSURE` La dipendenza dalla stessa impresa può rimanere; UNKNOWN; DECLINED. N/A non confermabile per il solo fatto di non investire.",
    "applicability": "**O; comparsa:** sempre. **Dipendenze:** nessuna economica.",
    "dependencies": [],
    "reconfirmOn": [],
    "validations": "**Validazioni:** corretta EXPOSURE; UNKNOWN/DECLINED non sono errori; non produrre voto globale di alfabetizzazione.",
    "unit": null,
    "period": null,
    "indicators": [
      "I-F03"
    ],
    "privacy": "**Privacy:** nessun dato della persona."
  },
  {
    "id": "RP-F06",
    "version": 1,
    "text": "Quando sono stati confrontati l'ultima volta entrate, spese e obiettivi di questo bilancio?",
    "help": "Conta una verifica concreta, anche semplice; non occorre un software o un consulente",
    "area": "F",
    "optional": false,
    "type": "**Area/tipo/opzioni:** F; singola: negli ultimi tre mesi; tra quattro e dodici mesi fa; oltre dodici mesi fa; mai; stati comuni.",
    "options": [
      "WITHIN3",
      "FOUR_TO12",
      "OVER12",
      "NEVER"
    ],
    "optionContract": "**Area/tipo/opzioni:** F; singola: negli ultimi tre mesi; tra quattro e dodici mesi fa; oltre dodici mesi fa; mai; stati comuni.",
    "applicability": "**O; comparsa:** sempre. **Dipendenze:** S01, non dipende da avere già un obiettivo.",
    "dependencies": [
      "RP-S01"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** «mai» è un valore; il confine di 12 mesi è una regola organizzativa proposta, non attestazione istituzionale.",
    "unit": null,
    "period": null,
    "indicators": [
      "I-F01"
    ],
    "privacy": "**Privacy:** periodo generico, nessun dettaglio delle decisioni prese."
  },
  {
    "id": "RP-X01",
    "version": 1,
    "text": "Qual è stato il mese con le entrate nette più basse negli ultimi 12 mesi, considerando solo l'importo?",
    "help": "Non serve il nome del mese. È un dato passato, non una previsione",
    "area": "A",
    "optional": true,
    "type": "**Area/tipo/opzioni:** A; FM mensile o valore EUR T12, stati comuni, zero ammesso.",
    "options": [],
    "optionContract": "**Area/tipo/opzioni:** A; FM mensile o valore EUR T12, stati comuni, zero ammesso.",
    "applicability": "**F; comparsa:** A04 variabile o scelta esplicita di approfondire; **dipendenze:** A01/A04 e perimetro.",
    "dependencies": [
      "RP-A01",
      "RP-A04",
      "RP-S01",
      "RP-S02"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** minimo non superiore alla media se esistono valori coerenti; intervalli incompatibili → chiarire. Non usarlo come previsione delle entrate prossime.",
    "unit": "EUR",
    "period": "T12",
    "indicators": [
      "I-A04"
    ],
    "privacy": "**Privacy:** nessuna data o fonte specifica dell'incasso."
  },
  {
    "id": "RP-X02",
    "version": 1,
    "text": "Ci sono condizioni che rendono incompleto il solo dato delle rate?",
    "help": "Segnala solo la presenza; non indicare persone o importi delle garanzie",
    "area": "C",
    "optional": true,
    "type": "**Area/tipo/opzioni:** C; multipla: garanzie personali per debiti altrui; debiti cointestati con obblighi ulteriori alla quota indicata; rate variabili; sospensioni o pagamenti finali importanti; cambiamenti di rata già noti; nessuna di queste; stati comuni.",
    "options": [
      "GUARANTEE",
      "JOINT_OBLIGATIONS",
      "VARIABLE_RATE",
      "BALLOON_OR_MORATORIUM",
      "KNOWN_CHANGE",
      "NONE"
    ],
    "optionContract": "**Area/tipo/opzioni:** C; multipla: garanzie personali per debiti altrui; debiti cointestati con obblighi ulteriori alla quota indicata; rate variabili; sospensioni o pagamenti finali importanti; cambiamenti di rata già noti; nessuna di queste; stati comuni.",
    "applicability": "**F; comparsa:** C01 con debiti, S03 impresa/autonomo o richiesta libera; **dipendenze:** C01/S03/C04.",
    "dependencies": [
      "RP-C01",
      "RP-S03",
      "RP-C04"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** «nessuna» esclusiva; esistenza di garanzia non diventa stock di debito certo; mancata risposta non significa nessuna condizione.",
    "unit": null,
    "period": null,
    "indicators": [
      "I-C02"
    ],
    "privacy": "**Privacy:** niente garanti, debitori, banche o condizioni sanitarie."
  },
  {
    "id": "RP-X03",
    "version": 1,
    "text": "Per le strategie di protezione indicate, quali aspetti riesci a verificare?",
    "help": "Per una polizza: limiti, esclusioni, franchigie e durata. Per una riserva o un sostegno diverso: disponibilità, durata e spese coperte. Non descrivere motivi sanitari",
    "area": "D",
    "optional": true,
    "type": "**Area/tipo/opzioni:** D; matrice delle righe D01: limiti/disponibilità; condizioni di utilizzo; durata; corrispondenza al bisogno. Ciascuna cella: verificato; da verificare; UNKNOWN; DECLINED; N/A motivato.",
    "options": [],
    "optionContract": "**Area/tipo/opzioni:** D; matrice delle righe D01: limiti/disponibilità; condizioni di utilizzo; durata; corrispondenza al bisogno. Ciascuna cella: verificato; da verificare; UNKNOWN; DECLINED; N/A motivato.",
    "applicability": "**F; comparsa:** almeno un presidio in D02; **dipendenze:** D01/D02.",
    "dependencies": [
      "RP-D01",
      "RP-D02"
    ],
    "reconfirmOn": [
      "RP-S01",
      "RP-D01",
      "RP-D02"
    ],
    "validations": "**Validazioni:** celle N/A solo per aspetti non pertinenti al tipo di strategia, senza supporre un contratto. Non ricavare «adeguato» dal numero di spunte.",
    "unit": null,
    "period": null,
    "indicators": [
      "I-D02"
    ],
    "privacy": "**Privacy:** nessun documento, dato sanitario o beneficiario."
  },
  {
    "id": "RP-X04",
    "version": 1,
    "text": "Vuoi indicare fasce o stime di valore delle attività che hai selezionato?",
    "help": "Usa valori riferiti a oggi e alle quote del perimetro scelto. Non contare due volte un immobile già compreso nel valore della tua attività. La liquidità riprende B02: la sommiamo una sola volta",
    "area": "E",
    "optional": true,
    "type": "**Area/tipo/opzioni:** E; matrice ST/valore EUR a T0, qualità per riga, UNKNOWN/DECLINED/N/A. Righe: L; strumenti finanziari non previdenziali; casa principale; altri immobili; quota propria attività; metalli/collezioni; cripto; altre attività; capitale previdenziale vincolato separato.",
    "options": [],
    "optionContract": "**Area/tipo/opzioni:** E; matrice ST/valore EUR a T0, qualità per riga, UNKNOWN/DECLINED/N/A. Righe: L; strumenti finanziari non previdenziali; casa principale; altri immobili; quota propria attività; metalli/collezioni; cripto; altre attività; capitale previdenziale vincolato separato.",
    "applicability": "**F; comparsa:** scelta esplicita ed E01; **dipendenze:** E01/B02/S01/S02.",
    "dependencies": [
      "RP-E01",
      "RP-B02",
      "RP-S01",
      "RP-S02"
    ],
    "reconfirmOn": [
      "RP-S01",
      "RP-E01"
    ],
    "validations": "**Validazioni:** attività escluse da E01 sono zero solo se inventario confermato completo. Nessuna riga omessa diventa zero. Capitale previdenziale fuori dal totale ordinario; pensione futura/TFR non noto non capitalizzati. Una riga B02 modificata aggiorna la stessa risposta e la revisione, non crea un secondo saldo.",
    "unit": "EUR",
    "period": "T0",
    "indicators": [
      "I-E01",
      "I-E02",
      "I-E03"
    ],
    "privacy": "**Privacy:** niente indirizzi, conti, wallet o identificativi societari."
  },
  {
    "id": "RP-X05",
    "version": 1,
    "text": "Quanto resta complessivamente dovuto oggi per i debiti del perimetro scelto?",
    "help": "Considera il capitale ancora da rimborsare e altri importi già scaduti e dovuti. Non contare due volte arretrati già compresi nel residuo. Non sommare le rate future: contengono anche interessi. Per debiti condivisi non assumere una quota se non la conosci. Le garanzie per altri non sono debito certo da sottrarre automaticamente",
    "area": "C",
    "optional": true,
    "type": "**Area/tipo/opzioni:** C/E; ST o valore EUR T0, totale residuo; selettore `tutti i debiti del perimetro / solo una parte`, qualità e stati comuni. Zero reale possibile.",
    "options": [],
    "optionContract": "**Area/tipo/opzioni:** C/E; ST o valore EUR T0, totale residuo; selettore `tutti i debiti del perimetro / solo una parte`, qualità e stati comuni. Zero reale possibile.",
    "applicability": "**F; comparsa:** C01 diverso da «nessuno», oppure C03 corrente/ignoto, oppure richiesta libera; **dipendenze:** C01/C03/S01/S02. Zero strutturale solo se C01 nessuno e C03 nessuno/risolto, con altri debiti aperti esclusi: altrimenti X05 mancante impedisce N, non viene sostituito con zero.",
    "dependencies": [
      "RP-C01",
      "RP-C03",
      "RP-S01",
      "RP-S02"
    ],
    "reconfirmOn": [
      "RP-S01",
      "RP-C01"
    ],
    "validations": "**Validazioni:** zero residuo compatibile con C02>0 per debito estinto; incompatibile con debito o arretrati ancora aperti dichiarati senza spiegazione. Perimetro parziale impedisce il netto complessivo. Non usare capitale iniziale o somma rate come residuo.",
    "unit": "EUR",
    "period": "T0",
    "indicators": [
      "I-E01"
    ],
    "privacy": "**Privacy:** totale aggregato, nessun creditore."
  },
  {
    "id": "RP-X06",
    "version": 2,
    "text": "Che cosa vorresti ottenere concretamente con le risorse di questo bilancio? Se hai più obiettivi, mettili nell'ordine che conta per te",
    "help": "Ne basta uno; puoi indicarne fino a tre in totale, compreso il principale. Per ciascuno pensa a quando potrebbero servire per la prima volta le risorse. Importi e dettagli sono facoltativi; non verranno proposti prodotti o versamenti",
    "area": "GOALS",
    "optional": true,
    "type": "**Area/tipo/opzioni:** F; lista di 1–3 righe con riferimento stabile e ordine esplicito. Categoria: riserva per imprevisti; spesa programmata; acquistare/adattare abitazione; ridurre impegni debitori; sostenere esigenze economiche di altre persone; cambiamento lavorativo; lungo periodo/pensione; futuro passaggio di risorse familiari; altro da chiarire senza testo libero. Orizzonte per riga: 0–12 mesi / oltre12–36 / oltre36, oppure mesi facoltativi (0 = adesso). Natura: una tantum / continuativa / UNKNOWN / DECLINED. Eventuale importo complessivo ST/valore EUR, qualità e stati comuni per ciascun campo; importo di un'esigenza continuativa può restare ignoto, senza capitalizzazione automatica.",
    "options": [
      "RESERVE",
      "PLANNED_EXPENSE",
      "HOUSING",
      "REDUCE_DEBT",
      "SUPPORT",
      "WORK_CHANGE",
      "LONGTERM",
      "FAMILY_PASSAGE",
      "OTHER_CLARIFY"
    ],
    "optionContract": "**Area/tipo/opzioni:** F; lista di 1–3 righe con riferimento stabile e ordine esplicito. Categoria: riserva per imprevisti; spesa programmata; acquistare/adattare abitazione; ridurre impegni debitori; sostenere esigenze economiche di altre persone; cambiamento lavorativo; lungo periodo/pensione; futuro passaggio di risorse familiari; altro da chiarire senza testo libero. Orizzonte per riga: 0–12 mesi / oltre12–36 / oltre36, oppure mesi facoltativi (0 = adesso). Natura: una tantum / continuativa / UNKNOWN / DECLINED. Eventuale importo complessivo ST/valore EUR, qualità e stati comuni per ciascun campo; importo di un'esigenza continuativa può restare ignoto, senza capitalizzazione automatica.",
    "applicability": "**F; comparsa:** su richiesta dopo l'ordinario, anche con F01 NONE/UNKNOWN. Nessun obbligo di X04/X05 o colloquio prenotato. **Dipendenze:** S01/F01 per contesto e coerenza, non per imporre una risposta; X06 non richiede X09–X11.",
    "dependencies": [
      "RP-S01",
      "RP-F01"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** massimo tre obiettivi complessivi, rango1–3 univoco quando confermato dalla persona; ordine UNKNOWN/DECLINED/UNANSWERED ammesso, con righe dichiarate ma nessun principale attribuito. Non ordinare per importo o interesse commerciale. F01 NONE noto si riusa come livello generale, non si ripete la domanda né si inventa una lista esaustiva vuota. X06 UNKNOWN/DECLINED/UNANSWERED distinti da «nessun obiettivo definito». Orizzonte è primo bisogno, non periodo di immobilizzo accettato. Se X06 chiarisce F01, proporre revisione esplicita; con obiettivo temporizzato noto sospendere letture incompatibili, incluso FERMI, finché riconciliate. X06 v1 conserva dati/versione: possibile mostrarlo come obiettivo già dichiarato, senza assegnargli d'ufficio rango principale o natura. Riordino mantiene i riferimenti di riga; rimozione disattiva solo attribuzioni/vincoli collegati nella nuova revisione.",
    "unit": "EUR",
    "period": "T0",
    "indicators": [
      "I-F01"
    ],
    "privacy": "**Privacy:** categorie aggregate, niente racconti familiari, salute, nomi dei destinatari, asset identificabili o dettagli successori/giuridici."
  },
  {
    "id": "RP-X07",
    "version": 1,
    "text": "In un semplice esercizio, un costo del 2% su un importo mantenuto a 1.000 euro per un anno equivale a quanti euro?",
    "help": "Considera soltanto questa percentuale e questa base costante. Non è un rendimento, una previsione né il costo totale di un tuo investimento",
    "area": "F",
    "optional": true,
    "type": "**Area/tipo/opzioni:** F; singola: 2 euro; 20 euro; 200 euro; UNKNOWN; DECLINED. Unità: euro; N/A non confermabile perché l'esercizio non richiede possesso di prodotti.",
    "options": [
      "2",
      "20",
      "200"
    ],
    "optionContract": "**Area/tipo/opzioni:** F; singola: 2 euro; 20 euro; 200 euro; UNKNOWN; DECLINED. Unità: euro; N/A non confermabile perché l'esercizio non richiede possesso di prodotti.",
    "applicability": "**F; comparsa:** su scelta esplicita; **dipendenze:** nessuna economica.",
    "dependencies": [],
    "reconfirmOn": [],
    "validations": "**Validazioni:** corretta 20; non estrarre un voto di alfabetizzazione o contraddire automaticamente l'autovalutazione F04. Un errore suggerisce una spiegazione, non un giudizio.",
    "unit": "EUR",
    "period": null,
    "indicators": [
      "I-F03"
    ],
    "privacy": "**Privacy:** nessun dato reale e nessun prodotto nominato."
  },
  {
    "id": "RP-X08",
    "version": 1,
    "text": "Su quali informazioni si basa l'ultima verifica delle risorse di lungo periodo, e a quando risale?",
    "help": "Basta la categoria della fonte e il periodo, senza importi o documenti",
    "area": "F",
    "optional": true,
    "type": "**Area/tipo/opzioni:** F; fonte (comunicazione ufficiale dell'ente; comunicazione contrattuale di una forma previdenziale; stima personale o simulazione non verificata; nessuna verifica) e data per fascia ultimi 12 mesi / oltre 12 mesi / non nota; stati comuni per campo.",
    "options": [
      "OFFICIAL",
      "CONTRACTUAL",
      "UNVERIFIED",
      "NONE"
    ],
    "optionContract": "**Area/tipo/opzioni:** F; fonte (comunicazione ufficiale dell'ente; comunicazione contrattuale di una forma previdenziale; stima personale o simulazione non verificata; nessuna verifica) e data per fascia ultimi 12 mesi / oltre 12 mesi / non nota; stati comuni per campo.",
    "applicability": "**F; comparsa:** richiesta libera o F02 CHECKED/ROUGH; **dipendenze:** F02.",
    "dependencies": [
      "RP-F02"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** fonte non verificata non conferma CHECKED; chiedere una revisione esplicita, senza correggere automaticamente. Nessuna stima dell'assegno o dei benefici fiscali.",
    "unit": null,
    "period": null,
    "indicators": [
      "I-F04"
    ],
    "privacy": "**Privacy:** niente importi, età, codice ente personale, prestazioni sanitarie o documenti."
  },
  {
    "id": "RP-X09",
    "version": 1,
    "text": "Quali risorse vorresti eventualmente destinare agli obiettivi e che cosa deve restare disponibile?",
    "help": "Riprendiamo liquidità, impegni e attività già indicati: non devi ricompilare il patrimonio. La quota da mantenere include gli accantonamenti già dichiarati. Puoi indicare i vincoli senza cifre; non stiamo verificando un capitale investibile",
    "area": "GOALS",
    "optional": true,
    "type": "**Area/tipo/opzioni:** contesto obiettivi/B/E/F, senza voto. Riepilogo condiviso con riferimenti ai dati esistenti. Importi facoltativi ST/valore EUR a T0: Cmin, quota attuale di L da mantenere per riserva e impegni incluso P; G0, quota di L eventualmente destinabile oggi complessivamente; G_i per fino a tre righe X06 soltanto se la persona vuole attribuire parti di G0. Altre risorse da verificare: categorie già E01/X04 o categoria generica se mancanti, nessuna / alcune da esaminare / stati comuni; nessun secondo valore. Fino a tre vincoli: accesso immediato/entro7/entro30 giorni/entro orizzonte della riga; non intaccare riserva o impegni; niente nuovo debito; non usare abitazione/attività d'impresa; altri da chiarire senza testo libero. Per ciascuno: globale o riferimento obiettivo, non negoziabile / preferenza da discutere / stato ignoto. Campi indipendenti con stati comuni pertinenti.",
    "options": [],
    "optionContract": "**Area/tipo/opzioni:** contesto obiettivi/B/E/F, senza voto. Riepilogo condiviso con riferimenti ai dati esistenti. Importi facoltativi ST/valore EUR a T0: Cmin, quota attuale di L da mantenere per riserva e impegni incluso P; G0, quota di L eventualmente destinabile oggi complessivamente; G_i per fino a tre righe X06 soltanto se la persona vuole attribuire parti di G0. Altre risorse da verificare: categorie già E01/X04 o categoria generica se mancanti, nessuna / alcune da esaminare / stati comuni; nessun secondo valore. Fino a tre vincoli: accesso immediato/entro7/entro30 giorni/entro orizzonte della riga; non intaccare riserva o impegni; niente nuovo debito; non usare abitazione/attività d'impresa; altri da chiarire senza testo libero. Per ciascuno: globale o riferimento obiettivo, non negoziabile / preferenza da discutere / stato ignoto. Campi indipendenti con stati comuni pertinenti.",
    "applicability": "**F; comparsa:** scelta esplicita dopo X06 oppure per chiarire vincoli anche senza obiettivi; in quest'ultimo caso solo parte globale, attribuzioni inattive. **Dipendenze:** S01/S02 e B02/B03 per confronti, X06 per righe/ordini, E01/X04 per riferimenti; nessuno è obbligo di nuova rivelazione. Mancanti non bloccano le scelte qualitative.",
    "dependencies": [
      "RP-S01",
      "RP-S02",
      "RP-B02",
      "RP-B03",
      "RP-X06",
      "RP-E01",
      "RP-X04"
    ],
    "reconfirmOn": [
      "RP-S01"
    ],
    "validations": "**Validazioni:** stessa data/perimetro, nessun duplicato delle revisioni esistenti. Se valori utilizzabili, verificare 0<=P<=Cmin<=L, G0<=L−Cmin e somma G_i<=G0. Se Cmin esprime un obiettivo di riserva futura superiore a L, chiarire l'ambito prima del confronto: non correggere il desiderio o chiamarlo insolvenza. Fasce incompatibili richiedono chiarimento; predicati non decidibili restano incerti. Non sottrarre P due volte, tagliare importi o imputare zero a mancanti/righe non attribuite. G0 è quota dell'attuale L: risorse illiquide, credito e redditi futuri non vi entrano. Un nuovo impegno può richiedere revisione esplicita B03, non una sottrazione nascosta. Tre vincoli non costituiscono una lista esaustiva.",
    "unit": "EUR",
    "period": "T0",
    "indicators": [
      "R-G02",
      "R-G03",
      "R-G04"
    ],
    "privacy": "**Privacy:** nessun conto, intermediario, bene identificabile, fonte familiare nominativa, motivo sanitario o documento. Riutilizzo dei dati e consenso al colloquio distinti."
  },
  {
    "id": "RP-X10",
    "version": 1,
    "text": "Quali esperienze e dubbi vorresti far conoscere prima di parlarne insieme?",
    "help": "Puoi segnalare fino a tre argomenti. Non è un esame: aver posseduto qualcosa non dimostra di conoscerne tutti i rischi. Puoi saltare qualunque dettaglio",
    "area": "GOALS",
    "optional": true,
    "type": "**Area/tipo/opzioni:** contesto personale/F, senza voto. Categorie: conti/depositi e risparmio disponibile; titoli obbligazionari; azioni; fondi/ETF; soluzioni assicurative; previdenza complementare; cripto-attività; altri strumenti di cui chiarire il funzionamento; nessuna esperienza da segnalare; stati comuni. Per fino a tre categorie scelte, esperienza: solo sentita nominare / letta o confrontata senza operazioni / detenuta con decisioni affidate ad altri / partecipazione a scelta o gestione; facoltativa recenza ultimi12 mesi / oltre12 / non nota. Aspettative multiple: capire rischi-costi-vincoli prima di decidere; mantenere risorse disponibili quando servono; capire quali risultati sono incerti; desiderare rendimento certo senza oscillazioni; desiderare risultati elevati con accesso immediato e assenza di rischio; nessuna aspettativa ancora definita. Dubbi multipli: costi, accesso alle risorse, perdita, funzionamento, impegni contrattuali, altro da chiarire. Stati distinti per campo.",
    "options": [
      "CASH",
      "BONDS",
      "EQUITY",
      "FUNDS_ETF",
      "INSURANCE",
      "PENSION",
      "CRYPTO",
      "OTHER_CLARIFY",
      "NONE"
    ],
    "optionContract": "**Area/tipo/opzioni:** contesto personale/F, senza voto. Categorie: conti/depositi e risparmio disponibile; titoli obbligazionari; azioni; fondi/ETF; soluzioni assicurative; previdenza complementare; cripto-attività; altri strumenti di cui chiarire il funzionamento; nessuna esperienza da segnalare; stati comuni. Per fino a tre categorie scelte, esperienza: solo sentita nominare / letta o confrontata senza operazioni / detenuta con decisioni affidate ad altri / partecipazione a scelta o gestione; facoltativa recenza ultimi12 mesi / oltre12 / non nota. Aspettative multiple: capire rischi-costi-vincoli prima di decidere; mantenere risorse disponibili quando servono; capire quali risultati sono incerti; desiderare rendimento certo senza oscillazioni; desiderare risultati elevati con accesso immediato e assenza di rischio; nessuna aspettativa ancora definita. Dubbi multipli: costi, accesso alle risorse, perdita, funzionamento, impegni contrattuali, altro da chiarire. Stati distinti per campo.",
    "applicability": "**F; comparsa:** scelta di preparare esperienza/aspettative, anche senza investimenti o obiettivi. Parti esperienza/aspettative/dubbi indipendenti e saltabili. **Dipendenze:** stesso rispondente e contesto della compilazione; F04/F05/X07 restano evidenze separate; E01 non abilita né precompila l'esperienza.",
    "dependencies": [],
    "reconfirmOn": [],
    "validations": "**Validazioni:** esperienza del rispondente, non di tutti i componenti del nucleo. «Nessuna esperienza» esclusiva per la lista e diversa da UNKNOWN/DECLINED/UNANSWERED; categorie omesse non diventano incompetenza. «Nessuna aspettativa ancora definita» esclusiva nella lista delle aspettative; un contrasto fra desideri va chiarito, non risolto scegliendo una preferenza d'ufficio. Nessuna scala dai tipi di esperienza o recenza, nessuna classe di rischio dalle categorie. Aspettative di assenza di rischio/rendimento garantito non sono promesse né errori al quiz: restano da chiarire; nessuna stima di rendimento o tolleranza alle perdite.",
    "unit": null,
    "period": null,
    "indicators": [
      "R-G05"
    ],
    "privacy": "**Privacy:** niente storico transazioni, importi investiti ripetuti, nomi di prodotti/professionisti, informazioni di terzi o testo libero. Escluso da note CRM generiche."
  },
  {
    "id": "RP-X11",
    "version": 1,
    "text": "Che cosa renderebbe utile per te un incontro con Horyzon, e come vorresti partecipare alle decisioni?",
    "help": "Puoi voler soltanto capire meglio la situazione. Questa scelta non prenota un incontro, non conferisce deleghe e non impegna a una proposta",
    "area": "GOALS",
    "optional": true,
    "type": "**Area/tipo/opzioni:** contesto servizio; due scelte indipendenti. Risultato principale: chiarire obiettivi / ricostruire risorse e vincoli / capire esposizioni e protezioni / comprendere costi e funzionamento / organizzare lungo periodo / capire informazioni e figure professionali necessarie prima di valutare soluzioni / altro da chiarire. Coinvolgimento futuro: capire e decidere direttamente / confrontarsi e decidere insieme / valutare una delega dopo aver compreso condizioni e responsabilità / capire prima le alternative senza decidere ora / da chiarire. Stati comuni per entrambe; nessuna unità monetaria.",
    "options": [
      "CLARIFY_GOALS",
      "RESOURCES_CONSTRAINTS",
      "PROTECTION",
      "COST_FUNCTION",
      "LONGTERM",
      "INFORMATION_PROFESSIONALS",
      "OTHER_CLARIFY"
    ],
    "optionContract": "**Area/tipo/opzioni:** contesto servizio; due scelte indipendenti. Risultato principale: chiarire obiettivi / ricostruire risorse e vincoli / capire esposizioni e protezioni / comprendere costi e funzionamento / organizzare lungo periodo / capire informazioni e figure professionali necessarie prima di valutare soluzioni / altro da chiarire. Coinvolgimento futuro: capire e decidere direttamente / confrontarsi e decidere insieme / valutare una delega dopo aver compreso condizioni e responsabilità / capire prima le alternative senza decidere ora / da chiarire. Stati comuni per entrambe; nessuna unità monetaria.",
    "applicability": "**F; comparsa:** su richiesta dopo l'ordinario, anche con X06/X09/X10 assenti/rifiutati, senza ripetere la domanda sugli obiettivi. **Dipendenze:** contesto del rispondente; F03 può essere mostrato come modalità attuale, mai come risposta alla preferenza futura.",
    "dependencies": [
      "RP-F03"
    ],
    "reconfirmOn": [],
    "validations": "**Validazioni:** un risultato principale espresso, nessuna priorità dedotta dal patrimonio; «da chiarire» è volontà dichiarata distinta da mancante. Nessun aggiornamento F03/F01 o profilo AFFIDA da questa risposta; richiesta esplicita/prenotazione/consenso restano altro processo autorizzato.",
    "unit": null,
    "period": null,
    "indicators": [
      "R-G05"
    ],
    "privacy": "**Privacy:** scelte aggregate senza nomi, motivazioni personali o recapiti nuovi; finalità/dubbi non sono etichette commerciali per HighLevel."
  }
] as const satisfies readonly QuestionDefinition[];
export const QUESTION_IDS: readonly QuestionId[] = QUESTION_CATALOG.map(q => q.id);
export const question = (id: QuestionId): QuestionDefinition => QUESTION_CATALOG.find(q => q.id === id)!;
export function questionText(id: QuestionId, incomeRoles: readonly string[] | null): string {
  const q = question(id);
  return id === "RP-F02" && incomeRoles?.includes("PENSION") && !incomeRoles.some(r => ["EMPLOYEE", "PROFESSIONAL", "BUSINESS"].includes(r)) ? q.variants![0].text : q.text;
}
