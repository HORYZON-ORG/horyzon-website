# Radar Patrimoniale V1 — pilot umano controllato e preparazione al rilascio 4P.6

Data: **19 ottobre 2026**. Repository: `HORYZON-ORG/horyzon-website`.

**Kit preparato; pilot umano non avviato.** Nessun volontario contattato, invitato o testato, nessuna risposta reale raccolta e nessun risultato di usabilità inventato. Pronto per la revisione del referente; avvio ancora subordinato alle approvazioni e alla verifica dell'accesso esterno. **Rilascio pubblico NO-GO**, con difetto ETag ancora FAIL.

## Riferimenti letti e perimetro

- [AGENTS.md](../../AGENTS.md), [DESIGN.md](../../DESIGN.md).
- [Report 4P.4B](radar-patrimoniale-v1-preview-ux-review-4p4b.md), catalogo/versioni/validazioni e copy pubblica delle 40 domande, controlli e risultato del candidato.
- Report 4P.5 `radar-patrimoniale-v1-preview-validation-4p5.md` e `vercel-ticket-draft-4p5.md`, letti dalla cartella locale delle evidenze `radar-public-pilot-4p5`. Il [riepilogo storico con hash delle fonti](human-pilot-4p6/historical-4p5-summary.json) rende espliciti provenienza, esiti tecnici e FAIL senza spacciarli per prove nuove.
- Documentazione ufficiale Vercel su condivisione, autenticazione e ruoli, e RFC 9110; fonti puntuali nei piani allegati.

Sorgente della UI: **accd6b70b498cbccb7e1dbedb551e165fa38f820**. Preview esistente: **dpl_WHyLB43axP3D8H9MSqNGEYFRzdxj**, progetto isolato **horyzon-radar-pilot**, team **horyzon-consulting**, piano **Pro**.

URL fissato della prova proposta: [Radar Patrimoniale nella Preview protetta](https://horyzon-radar-pilot-blelmgb7p-horyzon-consulting.vercel.app/radar-patrimoniale). Non è un invito o un link di bypass. L'accesso richiede un account autorizzato.

Lavoro documentale nel worktree `C:\Users\emanu\.codex\worktrees\radar-public-pilot\horyzon-website`, branch `feat/radar-patrimoniale-public-pilot`. Il codice della Preview rimane quello del commit di riferimento; un eventuale commit locale di questa fase contiene soltanto il kit documentale. Nessuna modifica di codice, domande, formule, assert, dipendenze, flag o configurazioni.

## Materiali pronti

| Allegato | Uso |
| --- | --- |
| [Tre scenari sintetici](human-pilot-4p6/scenari.md) | A: nucleo con due stipendi e mutuo; B: autonomo con entrate variabili e riserva ridotta; C: pensione/affitto, nessun debito, patrimonio soprattutto immobiliare. Tutti inventati, con fatti per le 40 definizioni e una carta di correzione. Consegnare una sola scheda per persona. |
| [Protocollo per volontari e facilitatore](human-pilot-4p6/protocollo-volontari.md) | Lettura autonoma dell'introduzione, percorso, due azioni di mancata risposta, revisione, risultato, approfondimenti facoltativi e feedback separato. Proposta per 5–8 persone, senza registrazioni. |
| [Scheda feedback vuota](human-pilot-4p6/scheda-feedback.md) | Chiarezza, fiducia, difficoltà, durata percepita, navigazione, utilità e comprensione dei limiti. Nessun campo economico o recapito. |
| [Checklist editoriale/privacy](human-pilot-4p6/editoriale-privacy.md) | Introduzione, tutte le 40 domande con punti specifici, messaggi dei risultati e separazione fra risposte, log di accesso e feedback. Approvazioni tutte aperte. |
| [Piano di accesso e rilascio](human-pilot-4p6/accesso-rilascio.md) | Modalità individuale esterna, rischio team Viewer, prove di isolamento da autorizzare, confronto main, layout/route, home no-store, SEO/a11y e rollback. |
| [Bozza ticket Vercel rivista, NON INVIATA](human-pilot-4p6/vercel-ticket-draft.md) | Deployment corrente, Next, riproduzioni GET/HEAD HTML/Markdown, confronto locale e obbligo RFC; causa interna non dimostrata. |
| [Trascrizione sintetica tecnica](human-pilot-4p6/scenarios.synthetic.json) e [validazione](human-pilot-4p6/scenario-validation.json) | Controllo interno ripetibile dei soli scenari, non raccolta delle compilazioni. Non consegnare stati tecnici o risultati attesi ai volontari. |
| [Verifiche in sola lettura 4P.6](human-pilot-4p6/read-only-verification.json) | Identità, ambiente, protezione, nomi/scope/presenza dei flag e stato invariato dei progetti. Nessun segreto. |

I tre scenari contengono unità di bilancio, periodo, entrate/spese e rate distinte, liquidità/accantonamenti, protezioni, patrimonio, pianificazione, obiettivi e campi composti degli approfondimenti. Ogni caso include almeno un «Non so» e un «Preferisco non rispondere»; nessuno deve sostituire i dati mancanti del personaggio con i propri. I desideri sugli obiettivi non sono dichiarazioni di finanziabilità.

A/B hanno 29 domande ordinarie applicabili. C ne ha **27**: nessun debito rende le due sulle rate non pertinenti e anche il residuo facoltativo è escluso. Non forzare 40 schermate quando il percorso adattivo le esclude; sono 40 definizioni coperte dalle schede, non 40 risposte obbligatorie. Tutti gli approfondimenti applicabili possono essere visitati su base volontaria.

## Verifiche effettivamente eseguite in 4P.6

| Controllo nuovo | Esito e limite |
| --- | --- |
| Stato dei worktree e sorgente | HEAD iniziale del pubblico accd6b7; conservati i due documenti 4P.2 già non tracciati e il lavoro concorrente negli altri checkout. Snapshot/hash prima e dopo per i file esistenti; aggiunti soltanto i documenti elencati in questo kit. |
| Main remoto corrente | **9146f6372b19fdac6db1770d05f6b0ca10c1f1e5** tramite ls-remote; già disponibile localmente. Merge-base coincidente; **0 commit solo main / 56 solo candidato**. Nessun fetch, merge, test di integrazione o cambio di ref remoto. |
| Vercel API GET e dashboard | Team/progetto/READY/SHA corretti. Dashboard indica Preview e project.targets.preview punta al deployment richiesto; dettaglio target null non interpretato come Production. Quattro deployment presenti, primo Production conservato. |
| Autenticazione e collaborazione | Auth ALL, Share «Only people with access», controllo per email individuali presente; commenti, Analytics e Speed Insights non abilitati nella vista letta. Nessun indirizzo inserito o Copy Link premuto. Non provato un nuovo grant esterno. |
| Ambiente | Sette variabili Preview presenti e corrispondenti al contratto anonimo; nessuna Shared collegata, nessun Git o bypass persistente. Valori segreti non esportati. Produzione del sito aziendale invariata. |
| Scenari offline | **PASS 3/3**, 40 ID unici per caso, tipi validi, periodi/perimetri coerenti, nessuna incoerenza di input; diagnose ripetuto identico e revisione F06 validata. Nessun browser, storage o servizio remoto usato da questa verifica. |
| Chiarimenti dei casi | B produce intenzionalmente `R-G01: CLARIFY`: l'idea inizialmente generica viene specificata negli approfondimenti. È registrato, non cancellato per ottenere PASS. Nessun giudizio sul volontario e nessuna validazione metodologica implicita. |
| Documentazione | Collegamenti locali, copertura delle 40 righe editoriali, integrità dei file esistenti e diff limitato ai documenti controllati prima della consegna. |

Il controllo offline ha usato Node 24.17.0 e le funzioni esistenti `validateValue`, `dependencyOrder`, `recordAnswer`, `resolveAnswers`, `diagnose`. Ogni VALUE è validato; l'input è confermato nell'ordine delle dipendenze e valutato due volte. La carta di correzione modifica solo F06 da «tra quattro e dodici mesi» a «negli ultimi tre mesi». Il JSON della validazione include l'hash della trascrizione per individuare modifiche successive. Nessuna nuova regola o test applicativo introdotto.

### Esiti tecnici precedenti, non rieseguiti ora

4P.4B documenta build ON/OFF, typecheck/lint (0 errori, 65 warning preesistenti) e 31 gruppi di regressione PASS, inclusi Radar d'Impresa **v4/34 schermate**, funnel Evento/Architetto e **35 fotografie preservate**, ledger/CRM/opportunità/persistenza/mapping. Non sono nuovi test di questa fase.

4P.5 ha verificato in browser reale tutte le **29+11** domande della UI semplificata, transizioni di mancata risposta, modifica/conferma e risultato deterministico, 320/390/768/1440 px, tastiera/focus e isolamento del documento. Nel questionario: **144 richieste tecniche, 0 invii e 0 esterne**, storage non usato, gate backend/Advisor 404, nessun analytics/session replay/toolbar. La prova di navigazione ordinaria aveva bloccato otto POST Iubenda della sola home: distinzione mantenuta nella revisione privacy. Non è stata svolta una sessione manuale NVDA/VoiceOver.

Questi risultati non dimostrano comprensibilità, naturalezza o rassicurazione percepita. **Nessuna prova umana e nessun nuovo collaudo browser funzionale effettuato in 4P.6**; il browser è servito solo a leggere dashboard e finestra Share. Build/typecheck/lint non ripetuti per documentazione soltanto. Andranno ripetuti se il codice o la configurazione cambiano in una fase successiva.

## Accesso: proposta pronta, autorizzazione mancante

Il team è Pro. La modalità proposta è il **collaboratore esterno individuale via Share del deployment**, mantenendo Vercel Authentication ALL. La documentazione ufficiale dichiara che non aggiunge la persona al team; la relativa UI è visibile. Le richieste di accesso approvate sono un'alternativa documentata, ma possono avere ambito di branch. Verificare il grant effettivo e mantenere congelato il progetto durante il pilot.

**Non invitare come Pro Viewer del team:** renderebbe visibili tutti i progetti/deployment del team e alcune informazioni di performance, anche quelli estranei al Radar. Le limitazioni su log e configurazioni non risolvono il requisito di separazione. Nessun nuovo membro, ruolo, link di bypass, account condiviso o token permanente è stato creato.

Prima di iniziare: approvazione nominativa e temporale fuori dal repository, un grant esterno esplicitamente autorizzato, prova negativa sugli altri progetti, assenza di membership e di script/toolbar introdotti dal grant; poi eventuale estensione ai soli volontari approvati. Revoca finale da includere nell'autorizzazione. Il [piano operativo](human-pilot-4p6/accesso-rilascio.md) distingue la capacità verificata dall'effettiva abilitazione, ancora non eseguita.

## Difetto HTTP aperto

**FAIL: GET e HEAD HTML 304 senza ETag**, mentre il campo è presente nella corrispondente 200 e nelle 304 Markdown. Rilievo dell'artefatto accd6b7 già riprodotto in 4P.5. La bozza consolidata riporta versione Next 16.3.5, deployment ID/URL/SHA, richieste di riproduzione, confronto locale e [RFC 9110 §15.4.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4.5). Nessun assert modificato e nessuna causa interna CDN/adapter dimostrata.

La limitazione riguarda la negoziazione/condizionali della home e non dimostra un trasferimento delle risposte del questionario. Per questo il report precedente proponeva un pilot ristretto con dati inventati e accettazione umana della limitazione; tale accettazione manca ancora. Il ticket rimane **non inviato**. Non si considera conforme l'intero artefatto e il difetto resta un gate per il pubblico.

## Readiness e approvazioni mancanti

| Ambito | Decisione attuale |
| --- | --- |
| Strumenti del pilot | **PRONTI PER REVISIONE**: scenari, consegne, feedback e checklist completi; nessuna raccolta avviata. |
| Avvio 5–8 volontari | **IN ATTESA**: responsabile pilot, partecipazione volontaria, testo/editoriale/privacy, accessi individuali e collaudo di isolamento, accettazione temporanea FAIL HTTP. |
| Risultati qualitativi | **NON DISPONIBILI**: nessun dato o testimonianza attribuibile a volontari. |
| Ticket Vercel | **BOZZA RIVISTA, NON INVIATA**; invio da autorizzare. |
| Integrazione futura | **PIANO PREPARATO**: ascendenza compatibile col main letto, ma review del delta di 56 commit, configurazione produzione e regressioni finali ancora da approvare/eseguire. |
| Pubblicazione horyzon.it | **NO-GO**: difetto HTTP aperto, feedback umano e approvazioni mancanti; nessuna autorizzazione di rilascio. |

Il rilascio futuro deve mantenere `/radar` per Radar d'Impresa e usare `/radar-patrimoniale` per il nuovo percorso, nel progetto aziendale corretto. Le modifiche ai layout e alla negoziazione non sono neutrali per il resto del sito: la policy no-store riguarda anche la home; l'eventuale caching statico interno rimane distinto. Prima del pubblico servono SEO/navigazione/accessibilità, revisione privacy/editoriale e piano di rollback dell'intera release con configurazioni, non soltanto un interruttore o la rimozione di un link.

## Preservazione e arresto

Nessun deploy, push, merge, migrazione, pubblicazione, invito, modifica Vercel, invio ticket/email o operazione su Supabase/HighLevel. Nessuna modifica a main, al sito horyzon.it, ai deployment precedenti o ai workspace delle assegnazioni e del Radar integrato. Il lavoro concorrente rimane disponibile nelle directory originarie; i due file 4P.2 preesistenti non sono inclusi nel kit o in eventuali commit.

Fase conclusa con la sola preparazione e le letture documentate. Il passo successivo richiede una nuova decisione esplicita sulle approvazioni mancanti; non avvia automaticamente il pilot o il rilascio.
