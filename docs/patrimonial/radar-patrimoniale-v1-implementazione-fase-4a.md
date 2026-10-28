# Radar Patrimoniale V1 — Implementazione del dominio, Fase 4A

18 ottobre 2026. Branch locale `feat/radar-patrimoniale-v1`, worktree `C:\Users\emanu\.codex\worktrees\radar-patrimoniale-v1\horyzon-website`. Base verificata e pulita: `899cd20080e321d980887fefce3781a384211223`.

## Esito e limiti

Realizzato un dominio TypeScript puro, deterministico e serializzabile, senza dipendenze aggiunte. I 14 casi T e gli 8 scenari G riproducono le attese delle specifiche. Delle 40 controprove, 35 sono interamente eseguite nel dominio, quattro soltanto nella parte pertinente e una non eseguita perché riguarda autorizzazioni future. Nessun punteggio globale, consiglio finanziario o abbinamento a prodotti.

Le specifiche restano **draft metodologici**: i test dimostrano conformità software agli esempi, non validità scientifica, adeguatezza delle soglie o comprensibilità del linguaggio. Restano le decisioni umane e il pilot indicati nei documenti 3B/3C.

Il verificatore storico `test:patrimonial-live-smoke` fallisce su una baseline precedente all'integrazione: dettaglio e prova di preesistenza sotto. Non è stato indebolito né modificato. Le altre regressioni richieste, typecheck, lint e build passano.

## Fonti vincolanti e versioni

Letti `AGENTS.md`, `DESIGN.md`, le guide Next installate pertinenti all'isolamento in `src/lib`, e i sette documenti metodologici. Prevale la revisione 3C.

| Contratto | Versione implementata |
| --- | --- |
| Motore / risultato | `RP-ENGINE-1.0.0` / `RP-RESULT-1.0.0` |
| Metodologia | `RP-MET-1.2-draft` |
| Questionario | `RP-Q-1.2-draft` |
| Regole | `RP-RULES-1.2-draft` |
| Casi | `RP-CASES-1.2-draft` |
| Obiettivi | `RP-GOALS-1.0-draft` |
| Proiezioni future | `RP-VIEWS-1.1-draft` |

X06 accetta v2 e lo storico v1. Gli altri ID sono v1; versioni sconosciute non contribuiscono. Questa implementazione esegue la versione corrente delle regole; non simula un motore storico differente.

## Architettura e file

Nuovi file in `src/lib/patrimonial-radar/`:

| Modulo | Responsabilità |
| --- | --- |
| `types.ts` | Stati, importi, intervalli, revisioni, obiettivi, risultato e tipi delle proiezioni |
| `versions.ts` | Identità dei contratti |
| `catalog.ts` | 40 ID, 29 ordinari e 11 facoltativi; testi/aiuti/metadati trascritti dalla specifica, variante pensione F02 |
| `validation.ts` | Validazione dei valori e delle matrici, enumerazioni, esclusività, cardinalità e campi ammessi |
| `answers.ts` | Applicabilità, ordine senza cicli, percorso ordinario, append delle revisioni, inattività e riconferma |
| `money.ts` | EUR, centesimi, fasce FM/ST, conversioni, perimetro, date e periodi |
| `intervals.ts` | Frazioni esatte, operazioni, estremi, vincolo P<=L, quote correlate, logica a tre valori |
| `indicators.ts` | Registro degli indicatori, zeri strutturali, sottototali e incoerenze |
| `areas.ts` | Predicati R-A–R-F e sei stati descrittivi locali |
| `profiles.ts` | MESE, FERMI, AFFIDA, COSTRUISCE, misto e indeterminato |
| `goals.ts` | X06 v1/v2, X09–X11, controlli R-G e riferimenti stabili |
| `completeness.ts` | Blocchi ordinari, esclusioni motivate e visite, distinti dalla salute |
| `evidence.ts` | Evidenze, interpretazioni deterministiche, note didattiche e triage deduplicato |
| `result.ts` | Composizione canonica e questioni per il colloquio |
| `index.ts` | Esportazioni pubbliche del dominio |

Altri nuovi file: `scripts/patrimonial-radar-fixtures.mjs`, `scripts/verify-patrimonial-radar.mjs` e questo report. Unico file preesistente modificato: `package.json`, esclusivamente per `test:patrimonial-radar`. Nessuna modifica al lockfile.

Punti d'ingresso: `recordAnswer(input, id, state, value?, questionVersion?)`, `resolveAnswers(input)`, `ordinaryRoute(resolved)` e `diagnose(input)`. Nessuna lettura di file a runtime, rete, orologio corrente, casualità, variabile di ambiente o importazione da Radar d'Impresa/servizi remoti. Le fixture sono interamente sintetiche.

## Importi, periodi e risposte

`AssessmentInput` contiene una data esplicita `asOf` e un ledger ordinato di revisioni. Ogni revisione porta ID, versione domanda, numero, data, stato e conferme delle dipendenze. `recordAnswer` restituisce un nuovo ledger e non cancella i precedenti. Il risultato conserva riferimenti/stati/disposizioni dello storico; il ledger originale resta necessario per rileggere i vecchi payload. Non è un'implementazione di persistenza.

I cinque stati sono VALUE, UNKNOWN, DECLINED, NOT_APPLICABLE e UNANSWERED. Applicabilità e lifecycle sono campi distinti. Un genitore cambiato rende le conseguenze inattive o da riconfermare; il ritorno a un ramo precedente non riattiva vecchi importi o zeri. Il cambio di fotografia richiede riconferma delle risposte datate. Il cambio di F01 non cancella X06, evitando un ciclo nella riconciliazione degli obiettivi.

Un importo è una stringa decimale non negativa con massimo due decimali, oppure una fascia/intervallo, con EUR, base MONTHLY/ANNUAL/STOCK, T12/Tnow/T0, data, perimetro e qualità dichiarata. `italianAmount` è un adattatore esplicito di formato italiano: il dominio non tenta di indovinare separatori ambigui. Nessun tetto patrimoniale arbitrario. Una copertura temporale parziale non viene annualizzata.

Le frazioni normalizzate usano `bigint` internamente e coppie di stringhe `{numerator, denominator}` nel risultato JSON. Anche un importo annuale non divisibile in dodici centesimi resta esatto. I limiti non finiti sono `null`, con estremo aperto: nessun NaN o Infinity utilizzabile. Zero resta un valore. Un intervallo che include uno zero nel denominatore impedisce il rapporto; un limite inferiore zero aperto permette, quando pertinente, un risultato superiormente illimitato.

Esempio T0 2026-10-18: T12 = 2025-10-01–2026-09-30, Tnow = ottobre 2026. Importi di un'altra data o perimetro non vengono combinati. S02 PARTIAL sospende rapporti trasversali e netto globale; fatti qualitativi indipendenti possono restare descritti.

Gli zeri strutturali sono limitati alle condizioni documentate: rate da C01 NONE; P da L=0; D=0 richiede anche assenza/risoluzione degli arretrati. Classi escluse valgono zero soltanto con inventario completo. Il N/A di una riga X04 è accettato soltanto se la categoria risulta esclusa dall'inventario completo. X03 mantiene distinta la dichiarazione esplicita di irrilevanza di una cella, senza certificare la strategia.

## Indicatori e valutazioni

| Registro | Implementazione |
| --- | --- |
| I-A01 | M, equivalente annuale, m = (1−(E+R12)/Y)×100 |
| I-A02 / A03 / A04 | Copertura, fonte principale qualitativa, scenario Ymin−(K+Rnow) con finestre distinte |
| I-B01 | Lf, fabbisogno corrente T e autonomia; dominio P<=L verificato |
| I-B02 / B03 | Autonomia sulle uscite storiche informativa e scenario qualitativo a 30 giorni |
| I-C01 / C02 / C03 | Incidenza storica, proxy corrente, arretrati dichiarati; nessuna soglia automatica di un terzo |
| I-D01 / D02 | Mappa delle sole esposizioni selezionate, strategie e limiti; nessuna media assicurativa |
| I-E01 | A, D, N, sottototale esplicitamente distinto e capitale previdenziale separato |
| I-E02 / E03 | qL, quote delle classi, Cmax conservativo, immobili aggregati, esposizione percepita distinta |
| I-E04 | Legame dichiarato reddito/patrimonio; nessuna correlazione statistica inferita |
| I-F01–F04 | Obiettivi/revisione, costi/modalità attuale, esito dei singoli quiz, processo di verifica del lungo periodo |

Gli indicatori espongono stato, range/valore, `usable`, motivo, ID delle domande anche mancanti, revisioni effettive, formula, periodo, unità, qualità e versione. I suffissi `.m`, `.annual`, `.Lf`, `.T`, `.A`, `.D`, `.subtotal`, `.pension`, per classe e `.property` distinguono componenti dello stesso indicatore metodologico. Non sono nuovi punteggi. DESCRIBED identifica un fatto qualitativo e non una misura numerica.

Una contraddizione non sceglie il dato più favorevole: il calcolo matematico eventualmente conservato ha `usable:false` e motivo esplicito; le conclusioni dipendenti sono sospese. Un'interfaccia futura deve rispettare questo contratto. Per esempio M<0 insieme a COVERED non alimenta MESE, C o un presidio A; il rapporto rate/reddito indipendente può rimanere utilizzabile. La coerenza fra inventario, capitale previdenziale e applicabilità dei costi è controllata separatamente.

Le aree applicano le regole locali R-A-01–R-F-02 con precedenza ATTENZIONE, DA_APPROFONDIRE e condizioni favorevoli esplicite. E usa soltanto DA_APPROFONDIRE, STRUTTURA_DESCRITTA o NON_VALUTABILE. Nessuna area intera è nascosta perché una componente è N/A. Un patrimonio nullo con debiti noti resta visibile; N negativo non è troncato e non viene chiamato insolvenza.

Evidenze favorevoli locali (ad esempio avanzo storico) non promuovono l'area quando manca il contesto. Un netto positivo è un fatto neutro, incapace di compensare arretrati o poca riserva. Il triage conserva tutte le vulnerabilità e seleziona al massimo tre priorità, con ordine deterministico e deduplicazione del deficit condiviso A/C. Completezza, visita, precisione e stato dell'area restano separati.

## Profili

Predicati TRUE/FALSE/INDETERMINATE, senza convertire i mancanti in FALSE. Per pubblicare un profilo servono S01 noto e S02 COMPLETE. Un solo candidato con altri candidati ancora indeterminati non diventa automaticamente prevalente; due candidati veri producono MIXED.

FERMI ha un canale qualitativo ordinario e un canale quantitativo qL>=80%, con esito della conferma separato. Senza X04 il canale qualitativo può bastare; il 79% può escludere il solo canale quantitativo. Un obiettivo temporizzato, anche secondario, incompatibile con F01 sospende FERMI finché F01 non è riconciliato esplicitamente. Avere molta cassa non è una diagnosi di eccesso né un invito a investirla.

MESE distingue disavanzo non programmato e PLANNED_DRAW. AFFIDA richiede modalità professionale attuale più il gap sui costi applicabile; la sola delega non basta. COSTRUISCE usa pratiche e condizioni documentate, senza richiedere X09–X11. Evento, profilo narrativo selezionato, commissioni e preferenze future non sono input diagnostici.

## Obiettivi e contratto canonico

X06 v2 conserva 1–3 riferimenti stabili, categoria, rango esplicito, primo orizzonte, natura e importo facoltativo. `prioritized` contiene solo ranghi confermati; `definitions` dichiara i dettagli ancora da chiarire. X06 v1 conserva categoria/tempo/importo con rango e natura UNANSWERED. Riordino e rimozione non redistribuiscono G_i: i collegamenti eliminati sono inattivi nel risultato corrente, conservati nel ledger.

X09 distingue Cmin, G0, attribuzioni, risorse solo da verificare e vincoli globali/per obiettivo. Le raccolte hanno propri stati espliciti: una lista non raccolta non viene presentata come assenza confermata. Controlli R-G01–05: riconciliazione F01, P<=Cmin<=L, G0<=L−Cmin, somma G_i<=G0 e distinzione esperienza/preferenze. Fasce indecidibili producono CLARIFY; un G_i ignoto impedisce di certificare la somma. Un desiderio di riserva futura superiore a L richiede chiarimento della definizione, non un'etichetta finanziaria. Nessuna addizione di immobili, credito, redditi futuri o M×mesi a G0.

X10 separa stato dell'esperienza personale, episodi, aspettative e dubbi; nessuna competenza ricavata dal patrimonio del nucleo o dal semplice possesso. X11 ha due campi indipendenti e non aggiorna F01/F03, prenotazioni, deleghe o consensi. R-G06 e l'abbinamento al catalogo restano `DEFERRED_OUT_OF_SCOPE`, non un esito commerciale negativo o positivo.

`CanonicalResult` contiene versioni, perimetro/periodi, risposte risolte e riferimenti storici, indicatori, aree, evidenze, vulnerabilità/priorità, incoerenze, completezza, qualità, profili, dossier obiettivi e questioni per il colloquio. Ogni regola/evidenza porta i riferimenti alle revisioni pertinenti; le condizioni mancanti non ricevono revisioni inventate. `ClientResultProjection` e `AdvisorResultProjection` sono **solo tipi**: nessun builder, endpoint, autorizzazione o vista realizzato.

## Test del nuovo dominio

Comando: `npm run test:patrimonial-radar`.

**72 gruppi di assert eseguiti senza errori**, di cui 61 scenari metodologici eseguiti (57 completi, quattro parziali) e 11 gruppi aggiuntivi. CT-27 è esplicitamente NOT RUN, non incluso nei 72 eseguiti.

| Casi | Esito | Copertura |
| --- | --- | --- |
| T01–T14 | PASS | Tutti gli stati A–F e profili; valori puntuali, tassi, autonomia, N, qL, rate; T11 senza rapporti globali; T14 estremi aperti |
| G01–G08 | PASS | Scenari obiettivi, vincoli, disponibilità, sovrapposizioni, zero e mancanti; nessun completamento delle aree non raccolte |
| CT-01–CT-25 | PASS | Tutte le variazioni di dominio e relative attese |
| CT-26 | PARZIALE | Materialità del fatto canonico A=0/D>0 verificata; parità effettiva delle viste rinviata |
| CT-27 | NON ESEGUITO | Assegnazioni, revoca e accesso: richiede implementazione server e identità autorizzata, fuori 4A |
| CT-28 | PARZIALE | Invarianza da catalogo/commissioni esterni verificata; enforcement futuro su catalogo/CRM non realizzato |
| CT-29–CT-36 | PASS | Identità delle righe, stati indipendenti, somme, esperienza e partecipazione futura, riconciliazione F01 |
| CT-37 | PARZIALE | Orizzonte e accesso dichiarati conservati; nessun prodotto/contratto su cui eseguire il futuro matcher |
| CT-38–CT-39 | PASS | Valori illiquidi separati da G0, rimozione/riordino, migrazione logica X06 v1/v2 |
| CT-40 | PARZIALE | Riutilizzo e stati del dominio verificati; minimizzazione delle viste/CRM e autorizzazioni rinviate |

I casi parziali non sono dichiarati interamente PASS. Per completarli servono implementazioni delle proiezioni e fixture dei payload per CT-26, soggetti/ruoli/assegnazioni/revoche per CT-27, contratti di integrazione del catalogo e CRM per CT-28/40, catalogo prodotti verificato con liquidabilità/costi/vincoli e regole di confronto per CT-37. I documenti non autorizzano a inventare questi componenti nella 4A.

Gli 11 gruppi aggiuntivi coprono metadati/versioni/assenza cicli; centesimi e importi molto grandi; annuali/fasce annuali; formato italiano; date; zeri/estremi aperti/unbounded; soglie esatte; payload invalidi/campi inattesi; N/A verificabili; revisioni e perimetro; coerenza di protezione e fonti; patrimonio/previdenza; indipendenza dei campi facoltativi; serializzazione, immutabilità dell'input e stabilità. Gli assert attesi provengono dalle specifiche, non sono snapshot prodotti dal motore.

## Regressioni eseguite

| Comando/verificatore | Esito |
| --- | --- |
| `npm run test:patrimonial-radar` | PASS, 72 gruppi come sopra |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, 0 errori; 65 warning preesistenti, nessuno nei nuovi file |
| `npm run test:radar` | PASS, inclusi dominio v4, persistenza, API, client, report, Stripe, free CRM e operations locali |
| `npm run test:patrimonial` | PASS |
| `npm run test:patrimonial-funnels` | PASS |
| `npm run test:patrimonial-ledger` | PASS |
| `npm run test:patrimonial-crm` | PASS |
| `npm run test:patrimonial-opportunities` | PASS |
| `npm run test:patrimonial-persistence` | PASS, trasporto finto e SQL statico; nessuna migrazione eseguita |
| `npm run test:patrimonial-remote-mapping` | PASS, nessuna chiamata remota |
| `verify-patrimonial-form-presentation.mjs` | PASS |
| `verify-patrimonial-event-presentation.mjs` | PASS |
| `verify-patrimonial-architect-presentation.mjs` | PASS |
| `verify-patrimonial-theme.mjs` | PASS |
| `verify-patrimonial-integration.mjs` | PASS: 34 schermate Radar v4, 56 file Radar, 11 file CRM funnel, 20 migrazioni e 35 foto preservati |
| `npm run build` | PASS, inclusa generazione Markdown esistente |
| `npm run test:no-platform`, `test:search`, `test:readable` | PASS; headers HTTP reali non verificati da questi controlli |
| `npm run test:patrimonial-live-smoke` | FAIL PREESISTENTE: guardia Git globale storica, descritta sotto |

Il live-smoke **verificatore locale** è stato letto prima dell'esecuzione: usa trasporti finti e vieta fetch esterni. Il comando operativo `smoke:patrimonial` non è stato eseguito. A riga 535 il verificatore richiede `git diff --exit-code c61ed43d1a1811069cbf0ecc6c21498bea76c03d -- src .gitignore`. La stessa condizione è falsa già fra `c61ed43...` e il commit iniziale `899cd20...`: 74 file, 3.862 inserimenti e 363 rimozioni precedenti alla 4A. Non è un errore introdotto dal motore. Lo script stampa i risultati aggregati solo dopo questa guardia: non si dichiara PASS dell'intera suite né dei controlli successivi non raggiunti. La correzione della baseline è un intervento separato da rivedere, non un assert da eliminare per ottenere verde.

I warning lint riguardano file invariati di Radar d'Impresa, AI Score e Annunci 10x (variabili non usate, hook e alt PDF). Nessun warning nuovo. Nessun controllo browser reale in 4A: il dominio non introduce UI. I verificatori di presentazione e la build non sono presentati come una nuova verifica visiva. Il rilievo HTTP Markdown della home resta fuori perimetro e non è stato corretto incidentalmente.

## Scelte tecniche e decisioni aperte

I documenti non definivano un formato di trasporto eseguibile. Sono quindi esplicitati enum tecnici, campi `Field<T>`, indici delle fasce, riferimenti delle revisioni e suffissi del registro. Queste scelte non cambiano testi, soglie o risultati attesi. Il campo opzionale C01 `openNow` disambigua un debito corrente da uno soltanto pagato in T12: senza questo dato non si presume che ogni debito storico sia ancora aperto. Rate correnti positive, arretrati o residuo positivo anche parziale costituiscono invece fatti sufficienti di presenza. Non è stata aggiunta una domanda ordinaria.

Cmax per fasce è un inviluppo conservativo del massimo delle quote, non una stima puntuale né un vincolo aggiuntivo sulle fasce. La composizione finanziaria non identifica singoli emittenti. Le risposte in conflitto mantengono l'aritmetica per audit con `usable:false`; nessuna conclusione favorevole deve ignorare quel flag.

Restano da chiudere: revisione professionale dei predicati e delle interpretazioni; pilot cognitivo e durata; verifica delle fonti previdenziali già segnalata; decisioni privacy/servizio; autorizzazioni effettive e minimizzazione delle future proiezioni; eventuale catalogo verificato, solo in fase espressamente autorizzata. Nessuno di questi punti è trasformato in un finto test software PASS.

## Conservazione e readiness

Nessun file del checkout originale è stato modificato o importato da questa fase. Il lavoro concorrente sulle assegnazioni non è stato consolidato né spostato. Non si dichiara che quel checkout sia immobile durante altre attività: si conferma l'isolamento di questa implementazione.

Radar d'Impresa, funnel, immagini, backend operativo, migrazioni, flag, configurazioni e routing restano invariati rispetto alla base della 4A. Nessun nuovo percorso `/radar-patrimoniale`, API, database, worker, AI, automazione o raccomandazione. Nessun push, merge su main, deploy o scrittura remota.

**Readiness 4B:** base tecnica disponibile per la fase successiva, con contratti e limiti espliciti. Non è un'autorizzazione a esporre dati reali o a promuovere la metodologia draft come validata. Le proiezioni e le autorizzazioni dovranno essere implementate e testate nella fase pertinente; resta aperto il verificatore smoke storico. Il commit locale della 4A è identificato nella consegna della chat e nel log Git, senza inserire nel file un hash autoreferenziale.
