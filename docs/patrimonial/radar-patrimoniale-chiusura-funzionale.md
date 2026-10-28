# Radar Patrimoniale — chiusura funzionale locale

27 ottobre 2026, Europe/Rome.

**PASS della candidata funzionale locale. NO-GO per attivazione remota/pubblica.**
Il percorso **HTTP Evento v2 → registrazione → identità verificata → Radar → responsabile P1** è PASS con Next, PostgreSQL e PostgREST nativi locali. L'iscrizione non è simulata invocando direttamente SQL.
Auth/OTP sono sintetici: questo risultato non dimostra la consegna email o l'operatività del provider reale.

L'ultima indicazione dell'utente limita questa consegna alla chiusura funzionale dell'allegato: **nessuna preparazione del codice per Production**, nessuna nuova Preview, nessuna gestione commerciale. Le protezioni Production 5D restano invariate.

## 1. Baseline, SHA e conservazione

Worktree nuovi e indipendenti:

`C:/Users/emanu/.codex/visualizations/2026/10/18/01a14e5a-6067-71a0-a210-f3859cab8329/radar-functional-closure/{website,platform}`

Branch locale: `codex/radar-functional-closure`.

| Repository | Baseline richiesta | SHA codice conclusivo |
| --- | --- | --- |
| Website | `e49865d88c8b46aba3197f819c5db5ee51cbd1a2` | `d38b8fdc8c43534c3594768533a05d2a8247e25e` |
| Platform | `d57f3a47f88c4b26dd2b21f4e7758fb67bee3811` | `dc61c8060fc676f514159fb32fba1ed2aa905ebd` |
| Architetti | `e84f91804a8a529e351f7eb54df9933cb3031530` | invariato |
| Hub | `0f65332ef3e7f38938320f49ec79f0df6dcd4d93` | invariato |

Questo report, il contratto e le evidenze sono un successivo commit documentale Website. Il suo SHA è indicato nella consegna; gli SHA codice verificati restano quelli della tabella.

**45/45 checkout preesistenti invariati alla verifica finale:** HEAD, branch, diff, stato e hash dei non tracciati. Il Website originario conserva HEAD `b242752102542e5280bba8b6ba0c4aecf9fcd722`, branch `feat/patrimonial-pilot-funnels` e 2.772 file non tracciati. Nessun reset, clean, stash o commit del lavoro concorrente. Nessun processo Git di scrittura rilevato nel preflight. [Inventario finale](functional-closure-evidence/preservation.json).

La CLI Supabase ha creato un nuovo cache vuoto `supabase/.temp/cli-latest` nel cwd originario durante la preparazione del nome della candidata: era assente dall'inventario ed è stato rimosso. Nessun file preesistente cancellato o spostato. Non si certifica il contenuto delle cache ignorate; dipendenze e cluster di prova sono copie indipendenti.

## 2. Funzioni concluse e modifica minima

Sono riutilizzati acquisizione account nativa, riconciliazione dell'identità verificata, registro referral unico, P1, snapshot immutabili, storico e RPC Hub/portale. Nessun nuovo motore, domanda, algoritmo di assegnazione, CRM, broker o servizio.

- Evento da A: acquisizione HTTP canonica, referral e operatore persistiti, stesso contatto dopo verifica email e Radar assegnato ad A.
- Radar da link A: attribuzione P1 esistente, nessuna autorizzazione finanziaria conferita dal codice.
- Radar diretto conosciuto: stesso contatto e responsabile valido.
- Radar diretto nuovo: report privato salvato, contatto verificato e metadati per **Radar Patrimoniale → Da assegnare**.
- Cliente di B da link A: provenienza conservata, B non sostituito.
- Compilazioni successive: nuovi assessment/report sulla stessa persona e contatto; snapshot precedenti immutabili.
- Ambiguità, identità discordanti e referral revocati: revisione conservativa; nessuna associazione arbitraria.

Due soli sorgenti applicativi Website modificati:

1. `src/app/(site)/(patrimonial-pilot)/benessere-patrimoniale/evento/grazie/page.tsx`: ricevuta esatta «Abbiamo ricevuto la tua richiesta di partecipazione all'evento.», senza promessa di conferma, prosecuzione Radar o CTA nel contenuto. Marchio/footer legale conservati.
2. `src/content/patrimonial-funnels.ts`: stesso messaggio di successo, soltanto per Evento.

Aggiornati i quattro pin corrispondenti nei due manifest già esistenti, senza rimuovere assert. Aggiunto un solo verificatore incrementale `scripts/verify-patrimonial-radar-handoff.mjs`.

**Unica candidata nuova Platform, M6:** arricchimento amministrativo `rows[].handoff` della RPC `hub.patrimonial_radar_simple_command(jsonb)`. Le RPC precedenti non rendevano disponibili al lettore amministrativo la provenienza privata M4 e completed_at senza aprire il risultato Advisor. Nessuna tabella nuova: legge identificativi, riferimenti Evento, fonte, stato reale del report e timestamp canonici.

M6 delega tutte le operazioni all'implementazione 5D originale; arricchisce soltanto la lista già autorizzata. Preserva filtri, campi, totali, audit e lock P1. Ingresso SECURITY DEFINER con search_path=pg_catalog, controllo sessione/gate, permessi correnti originari, nessun target scelto dai dati client per l'arricchimento, EXECUTE selettivo authenticated e vecchio ingresso rinominato non invocabile dai ruoli API. Nessun USAGE public generale.

La classificazione ASSIGNED/UNASSIGNED/REVIEW è una lettura degli stati esistenti, non un nuovo registro o writer. REVIEW non elimina il proprietario precedente e non sostituisce i controlli Advisor. [Contratto operativo completo](radar-patrimoniale-handoff-hub.md).

Hub e portale non sono modificati in questo task: niente selezione commerciale, “Ricevi il prossimo Radar”, avvisi 72 ore, telefonate, appuntamenti, trattative o HighLevel. Il task parallelo può leggere il campo additivo secondo il contratto; le interfacce precedenti continuano a funzionare.

## 3. Prove precedenti riutilizzate

Letti i report [HTTP Evento v2](radar-patrimoniale-evento-v2-http-completion.md), [5D](radar-patrimoniale-fase-5d-preview-release.md), [referral](radar-patrimoniale-architect-referrals.md) e la documentazione 5C da essi richiamata.

Verificati nuovamente gli hash dei **13 file** del [manifest HTTP precedente](evento-v2-radar-evidence/manifest.json). Non è stato ricostruito il database da zero: copiata la fixture PostgreSQL arrestata dopo M1–M5, mantenendo i casi sintetici già verificati, quindi applicata soltanto M6 nella copia.

| Evidenza ereditata | Esito precedente | Stato in questa attività |
| --- | --- | --- |
| Native OIDC/account/ACL/referral/HTTP | **68/68 PASS** | Evidenze verificate; non rieseguite integralmente |
| Catena HTTP Evento v2 completa | **PASS** | Ripetuto un nuovo caso HTTP end-to-end nella prova incrementale |
| Website | **19/19 suite PASS** | Conservate come evidenza precedente; ripetute le prove pertinenti sotto |
| Hub | **201 PASS**, 941 assert, 27 file | Codice invariato, suite non ripetuta |
| Portale Architetti | **56 PASS**, 13 file, 50 assert PostgreSQL | Codice invariato, suite non ripetuta |

Questi numeri non vengono sommati ai nuovi test né presentati come un'esecuzione nuova dei quattro repository.

## 4. Prove eseguite ora

PostgreSQL **17.6**, PostgREST **16.5**, Next **16.3.5**, solo loopback, email .invalid, OTP sintetico e chiavi sintetiche già presenti nella fixture.

| Controllo attuale | Esito |
| --- | --- |
| Verificatore incrementale handoff | **11/11 PASS** |
| M6 su copia M1–M5: P1, numero contatti e snapshot preservati | **PASS** |
| Baseline SQL sconosciuta/già avvolta: rifiuto atomico e rollback | **PASS** |
| Verificatore 5D originale byte-invariato | **4/4 PASS**: isolamento, Preview, rifiuto Production e altro progetto |
| Presentazione Evento, form condiviso/Architetto e temi | **PASS**, 35 fotografie preservate |
| `npm run test:patrimonial` | **PASS** |
| `npm run test:patrimonial-funnels` | **PASS** |
| `npm run typecheck` | **PASS** |
| ESLint sui sorgenti modificati e nuovo verificatore | **PASS**, 0 errori / 0 warning |
| `npm run build` | **PASS**; warning metadataBase su route preesistenti conservato |
| Browser reale ricevuta | **PASS**, 1280×720, contenuto esatto e shell legale |
| Conservazione dei checkout | **45/45 PASS** |

Le 11 verifiche coprono: integrità delle evidenze; ricevuta esclusiva; Evento A via vero HTTP, contatto e Radar A; Radar link A e successivo diretto noto con due report immutabili; diretto nuovo in coda; B preservato e casi in review; identici ID nelle viste Hub/Rete/portale; Advisor improprio/operatore estraneo/account/anon/sessione scaduta negati; metadati senza risposte e contratto precedente conservato; ACL e P1 invariati; assenza di transizioni commerciali.

L'acquisizione Evento crea legittimamente **un intent PROVISIONAL di ricevuta**, collegato alla request canonica. Il test verifica esattamente quello, nessuna nuova opportunità commerciale, intent precedenti invariati, tabelle attività/contratti invariate e nessuna presenza ATTENDED. Gli intent Radar mantengono stage/next_step/ID remoti null e MANUAL_REVIEW; trasporto HighLevel e invio email commerciale **zero**.

Evidenze: [risultati e ID sintetici](functional-closure-evidence/handoff.json), [rehearsal M6](functional-closure-evidence/m6-rehearsal.json), [diniego baseline SQL](functional-closure-evidence/m6-negative.json), [check complessivi](functional-closure-evidence/checks.json), [pin ricevuta](functional-closure-evidence/receipt-pins.json), [browser](functional-closure-evidence/receipt.jpg).

I tentativi iniziali restano documentati: build non ancora pronta, pin secondari obsoleti, fixture Advisor priva di operator_id, nome errato del parametro p_contact e aspettativa iniziale troppo ampia sugli intent PROVISIONAL. Corretti fixture/contratto del nuovo test, non ACL o assert storici. [Dettagli](functional-closure-evidence/execution-notes.json), [hash dei log integrali fuori Git](functional-closure-evidence/log-hashes.json).

**Non ripetuti:** browser completo Radar mobile/desktop, audit esaustivo rete/storage e UI Hub/portale; restano le evidenze precedenti, senza nuove certificazioni. Il browser di questa attività controlla esclusivamente la ricevuta. Radar d'Impresa v4 (34 schermate), motore, questionario, asset, font, CSS, Proxy, CSP e gestione temi sono byte-invariati rispetto alla baseline, oltre ai controlli di presentazione ripetuti.

Restano visibili i problemi globali storici Hub: **82 errori typecheck, 513 errori e 15 warning lint**; portale: **3 warning lint**. Non corretti o riclassificati, né ritestati sui main avanzati.

## 5. Catena SQL candidata approvabile

Ordine **M1 → M2-5D → M3-5D → M4 → M5 → M6**. SHA256 su UTF-8 LF:

| Passo / repository / file | SHA256 |
| --- | --- |
| M1 Website: `supabase/migrations/20261018191940_patrimonial_radar_identity_sessions.sql` | `4b121673988723f407017a0ef1720dbe2bcb7b0002c6a0d88d012472c8923543` |
| M2-5D Platform: `packages/database/pending/20261026160057_patrimonial_radar_preview_foundation.sql` | `83a9c7077324d1e98f991622d9bacc008e30aa54467d618f29c8984f81e7f7ca` |
| M3-5D Platform: `packages/database/pending/20261026160106_patrimonial_radar_preview_auth.sql` | `2c509fbb8f484745ce961241803f33081fa9865dfbe33967957856b6273f8191` |
| M4 Platform: `packages/database/pending/20261026220758_patrimonial_radar_architect_referrals.sql` | `66a40de3f7f6ac9a97d7002bc8077347ceea5e2a440e7ba2fe4376f869faf5fa` |
| M5 Platform: `packages/database/pending/20261027080238_patrimonial_event_v2_referral.sql` | `31fbc20426c1892f50d33791fe4756df49b82fcbef72480103367ed23dbacff1` |
| M6 Platform: `packages/database/pending/20261027092211_patrimonial_radar_handoff_metadata.sql` | `3d87df92b24cf517d545715f53d90b8d43577a92a6dea1e7f77959ca67079c15` |

M1–M5 sono invariati; verificare gli hash sui blob Git se autocrlf è attivo. M6 controlla la presenza di M5 e il corpo dell'ingresso 5D atteso (`md5(prosrc)=08f825daa8a86adf9a8334fc042ce2e2`), e abortisce su drift. Non aggirare il controllo per applicarla a un dispatcher modificato dal task parallelo.

La catena è candidata, **non applicata sul remoto**. Le migration referral già installate, riprodotte dalle fixture, sono prerequisiti e non vanno riapplicate. M2/M3 storiche alternative e tutte le 5B non sono cumulative.
M2 estende esplicitamente i vincoli e P1 al kind RADAR: non è una modifica globale “innocua”; usare l'analisi 5D e verificare definizioni/ACL prima e dopo ogni passo.
M5 modifica le tre funzioni di ingest già documentate e il provider ammesso, senza nuovi trigger ledger. M6 non modifica P1, Evento, trigger, tabelle, policy RLS, chiavi o gate.

[Catena precedente](functional-closure-evidence/migration-chain-inherited.json), [hash M6](functional-closure-evidence/m6.json).

## 6. Main e lavoro commerciale concorrente

Ref GitHub osservate in sola lettura, scaricate soltanto nei nuovi cache Git isolati:

| Repository | main verificato |
| --- | --- |
| Website | `9146f6372b19fdac6db1770d05f6b0ca10c1f1e5` |
| Platform | `2fdcaed683391631267bb681705b3a1fd4ef5e31` |
| Hub | `80f5b2e6caf7775db726877fef1b5d5fb8403e1a` |
| Architetti | `2d954b7bc380cd02342f9dcf04b526a42de92c39` |

Website contiene il main osservato. Platform diverge dal comune `78eb49e709938fe287723d340e88a2ffd8855b67`; sul percorso complessivo c'è sovrapposizione in `packages/contracts/src/index.ts`. M6 è un file SQL nuovo e non modifica quel file.

Hub main ha aggiunto riepiloghi rete, avvisi recupero contatti e contatori appuntamenti/contratti. Le modifiche Radar preesistenti e main si sovrappongono in `NetworkWorkspace.tsx` e `src/lib/architetti.ts`.
Il portale main ha aggiunto esiti chiamata guidati, terminologia italiana e CI; sovrapposizioni con il Radar in `src/App.tsx` e `src/ContactDetail.tsx`.

**Nessun merge tentato e nessun conflitto Git risolto in questo task.** Questi avanzamenti sono conservati, non sostituiti dai vecchi checkout Radar né importati alla cieca. Il contratto additivo non implementa la loro logica commerciale. La composizione finale degli artefatti con i main concorrenti richiede revisione esplicita di quei file e regressioni: compatibilità dell'artefatto unificato **NOT RUN**, nessun GO per distribuire automaticamente i vecchi Hub/portale sopra i main correnti.

[Confronto dei merge-base e file sovrapposti](functional-closure-evidence/compatibility.json), [inventario delle modifiche di questa attività](functional-closure-evidence/code.json). Nessun messaggio o modifica inviato al task parallelo.

## 7. Prerequisiti remoti e arresto

| Prerequisito / responsabile | Stato e operazione futura da autorizzare |
| --- | --- |
| Artefatti — referenti Website/Hub/Architetti | Approvare SHA coordinati preservando i main; nessun push/deploy eseguito |
| Database — amministratore Supabase Horyzon | Rileggere catalogo, migration installate, ACL e P1/Evento correnti; questa attività riusa il preflight precedente, non certifica il database remoto attuale |
| Backup/restore — amministratore DB | Dimostrare backup recuperabile e ripristino; NOT RUN, prima di qualsiasi SQL remoto |
| SQL M1–M6 — amministratore DB + referente | Approvare soltanto file/hash necessari al catalogo reale, un passo per volta con gate chiusi e controlli P1/Evento/ACL; nessun grant/migration remoti eseguiti |
| Auth/SMTP — referente provider | Configurazione reale, casella aziendale autorizzata, registrazione/OTP, conferma, refresh e revoca; NOT RUN, nessun account o invio reale |
| HMAC — responsabile segreti | Chiave server dedicata e gate SQL corrispondente, consegna protetta e rotazione; nessuna chiave reale creata/configurata |
| Staff — referente Horyzon | Permessi nominativi LIST/PERSON/ASSIGN/ADVISOR a scadenza e P1 validi; nessun grant reale |
| Collaudo protetto — referente rilascio | Approvare destinazione/artefatti e accessi prima di qualsiasi scrittura; test reali email, storico, Hub/Rete/portale, dinieghi e revoca con dati inventati; NOT RUN |
| Privacy/retention — referente competente | Approvare informative, dati tecnici separati dalle risposte e conservazione; nessuna attestazione legale aggiunta |

Rollback operativo futuro, da approvare: chiudere i gate server/SQL Radar e ripristinare gli artefatti autorizzati precedenti, verificando disponibilità sito/Evento/P1 e diniego Radar. Conservare persone, snapshot, audit e assegnazioni: nessun down distruttivo o riassegnazione automatica. L'eventuale ripristino DB deve seguire il backup verificato. M6 è additiva e il vecchio client può ignorare handoff; non è necessario cancellare report per tornare al client precedente.

**FAIL HTTP ancora aperti:** ETag assente su HTML 304 e contratto Markdown `Vary: Accept`; non ritestati o dichiarati risolti. Policy no-store della home invariata, ticket non inviato. Nessun GO pubblico.

Consegna finale: candidata locale conclusa per acquisizione, identità, storico e passaggio dei riferimenti al sistema Horyzon; distribuzione e gestione commerciale restano al task parallelo. Provider reale e composizione dei main sono prerequisiti verificabili del collaudo autorizzato, non risultati acquisiti.

**Nessun push, merge main, deploy, migration/grant remoto, credenziale reale, email/WhatsApp, scrittura HighLevel o modifica di produzione.** Tutti i soli servizi locali e tab di verifica creati vengono chiusi alla consegna. L'attività si arresta qui.

Manifest delle nuove evidenze: [14 file con SHA256](functional-closure-evidence/manifest.json).
