# Radar Patrimoniale V1 — Preview e UX, Fase 4P.4B

19 ottobre 2026. **Preview esistente collaudata: questionario e isolamento PASS, non conformità ETag ancora FAIL. Nuova UI locale diretta PASS: 29+11, browser anonimo/persistente, build ON/OFF e 31 suite. Nessun deployment o push.**

## A. Preview Vercel attuale: codice precedente

Team horyzon-consulting, progetto isolato horyzon-radar-pilot, project ID prj_bJvIOswh4GacqtUootXATXeAkSUO. Deployment **dpl_4GSWEdYCy9v4PEgmxz86Zw4zGeDi**, SHA **bbde1aa3721c1f9a1f58bb6f6d6ee17f880be97e**, URL [Preview protetta](https://horyzon-radar-pilot-hazxj4qio-horyzon-consulting.vercel.app). READY iniziale e finale; target Preview confermato dal progetto, raw target null. È rimasta online la vecchia interfaccia a quattro opzioni durante tutti questi test.

Letti AGENTS, DESIGN e report 4P.3D e 4P.4. Preflight: Authentication ALL, nessun Git collegato, zero Shared e credenziali operative, esattamente i sette flag Preview attesi. PUBLIC_ANONYMOUS e relativo enabled attivi; VERIFIED_PERSISTENT, backend, demo e Advisor disattivati; VERCEL_PREVIEW_FEEDBACK_ENABLED=0. Nessuna variabile modificata. CLI e OIDC effimero, solo memoria e header sulla singola origine; nessun bypass persistente o indebolimento delle protezioni. Prova finale senza autenticazione: **302 verso Vercel**, no-store e noindex.

### HTTP e diagnosi CDN

Completate **24/24 richieste controllate**. Le assert ETag originali restano attive: il runner raccoglie tutte le non conformità anziché interrompere la raccolta. Nessun errore viene convertito in PASS e nessuna risposta remota viene riscritta. Una prima raccolta aveva raggiunto RSC ma non gestiva nel client l'assenza del redirect; il runner è stato corretto per acquisire anche il ventiquattresimo campione, conservando le assert sul comportamento atteso.

| Caso | Esito osservato |
| --- | --- |
| GET HTML, Markdown, Accept assente/wildcard/rifiuto Markdown | PASS, corretta rappresentazione |
| HEAD HTML e Markdown | PASS, body vuoto e header coerenti con GET |
| /home.md diretto, canonical e robots Preview | PASS |
| Sei alternanze sullo stesso URL | PASS, stessi body/hash/ETag per ciascuna rappresentazione |
| ETag dell'altra rappresentazione, GET e HEAD | PASS: 200 corretto, mai 304 dell'altra rappresentazione |
| ETag HTML corrispondente, GET e HEAD | **FAIL: 304 senza ETag** |
| ETag Markdown corrispondente, GET e HEAD | PASS: 304 vuota con ETag corretto |
| Richiesta RSC senza parametro tecnico | Vercel: 200 Flight diretto; locale: 307 verso /?_rsc. Due assert del confronto locale registrano la differenza |
| Richiesta RSC con parametro tecnico | PASS: 200 text/x-component, non Markdown |

La matrice non è globalmente PASS: sono conservati **due fallimenti ETag** e **due differenze relative al redirect RSC locale**. Il secondo gruppo è una differenza di normalizzazione di piattaforma; non è stato osservato un contenuto RSC errato. La non conformità ETag resta aperta anche se non è stata osservata una violazione della riservatezza.

Il 200 HTML espone ETag "ebc9de34c79291d59a1caa85e5310adf"; il 200 Markdown "6a69be6a16d859ab4375dd3ad51cfa0e". La 304 HTML perde ETag sia per GET sia per HEAD. Nel server Next locale 16.3.5, le stesse verifiche ON/OFF mantengono l'ETag: **48/48 richieste locali PASS**. La differenza è quindi osservata nel percorso della piattaforma remota; non è stata isolata la responsabilità di un singolo livello interno e non è stato interrogato un origin separato dalla CDN.

HTML remoto 200 conserva Vary con i quattro token Flight e senza Accept; Markdown conserva anche Accept. Cache-Control private/no-store/max-age=0/must-revalidate e CDN-Cache-Control no-store presenti nei 200; Vercel-CDN-Cache-Control non è esposto al client. Il requisito ETag è sostanziale anche secondo [RFC 9110 §15.4.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4.5); non è stata eliminata l'assert per adattarsi alla piattaforma.

Interpretazione dei campioni: **HIT** indica un oggetto servito dalla cache Vercel; **MISS** un mancato hit; **PRERENDER** la risposta da artefatto prerenderizzato; **Age** rappresenta i secondi di permanenza dell'oggetto nella cache, non l'età di risposte economiche. Vercel documenta il [caching automatico dei file statici](https://vercel.com/docs/caching/cdn-cache#static-files-caching). Di conseguenza, no-store downstream non dimostra l'assenza della conservazione interna degli artefatti statici. HIT non è da solo prova di contaminazione: nella matrice completata hash, tipo e condizionali distinguono sempre HTML e Markdown. Il risultato non certifica tutte le regioni CDN o qualunque futura configurazione.

[Matrice completa e assert fallite](preview-ux-4p4b-qa/remote-readable-http.json). [Bozza ticket Vercel](preview-ux-4p4b-qa/vercel-ticket-draft.md), **non inviata**: include riproduzione, confronto locale, metadati e domande sulla 304 dell'artefatto prerenderizzato; nessuna credenziale.

### Browser e riservatezza della Preview precedente

**PASS** tutte le 29 domande ordinarie e 11 facoltative con controlli reali, fasce/importi e conversione annuale, zero, UNKNOWN/DECLINED, obiettivi multipli con priorità esplicita, sei dimensioni confrontate con il motore, ritorno e riconferme, perdita integrale dello stato al refresh. PASS 320/390/768/1440 e landscape, focus visibile e tastiera, reduced motion, font Manrope e immagini caricate.

Browser questionario: **126 richieste tecniche, 0 invii, 0 richieste esterne, zero errori**. Nessun payload economico in URL/body/log. Storage, beacon, IndexedDB e registrazione service worker sono attivamente vietati nel test: nessun tentativo osservato. Nessun Iubenda, toolbar/insights o global Iubenda nel documento anonimo; CSP connect-src 'none', form-action 'none', worker-src 'none', frame-src 'none' e no-store effettivi. I gate GET sessione/assessments e Advisor restituiscono 404. Nessuna email, chiamata a HighLevel, Supabase o Resend.

Navigazione reale home → router Next → Radar → logo home PASS alle quattro larghezze: sempre documenti nuovi, global ordinario eliminato all'ingresso, shell ordinaria ripristinata in uscita. La home non ha una nuova CTA pubblica al pilota: il test usa l'istanza reale del router, senza aggiungere link alla produzione. Gli script ordinari Iubenda sono stati realmente caricati via GET nel test remoto; **otto POST Iubenda a idb.iubenda.com/csdata, tutti mentre il documento era /, sono stati bloccati dall'automazione**. Zero richieste esterne o scritture nel documento anonimo. Questi tentativi della home sono distinti dalla privacy del questionario e non vengono nascosti. Nessun dato economico era presente nella home.

[Browser remoto](preview-ux-4p4b-qa/remote-browser.json), [navigazione e richieste ordinarie](preview-ux-4p4b-qa/remote-navigation.json), [gate](preview-ux-4p4b-qa/remote-gates.json), [protezione non autenticata](preview-ux-4p4b-qa/unauthenticated-protection.json). Accessibilità verificata tramite semantica, controlli nativi e tastiera; nessuna sessione manuale con lettore di schermo o certificazione privacy dichiarata.

## B. Nuova interfaccia: soltanto locale

Worktree C:/Users/emanu/.codex/worktrees/radar-public-pilot/horyzon-website, branch feat/radar-patrimoniale-public-pilot, partenza bbde1aa3721c1f9a1f58bb6f6d6ee17f880be97e. Il nuovo SHA del commit locale è riportato nella consegna e nella ricevuta esterna di fase; si ricava anche da git log -1 --format=%H -- docs/patrimonial/radar-patrimoniale-v1-preview-ux-review-4p4b.md. **Nessuno dei test remoti sopra riguarda questo nuovo codice.**

Prima, ogni domanda mostrava il blocco VALUE/UNKNOWN/DECLINED/UNANSWERED, con “Indico una risposta” e “Da completare”. Alcuni dettagli erano nascosti dietro ulteriori selettori di intenzione.

Ora tutti i widget principali sono immediatamente disponibili; “Non so” e “Preferisco non rispondere” appaiono sotto i campi come azioni testuali secondarie, con stato premuto e segno visibile indipendente dal colore. Nessun pulsante “Indico una risposta” o scelta “Da completare”. Una domanda mai toccata resta UNANSWERED; l'interazione con il campo produce VALUE. Le scelte UNKNOWN/DECLINED rimuovono il payload della bozza precedente; il campo resta visibile e una nuova risposta normale sostituisce direttamente la scelta. Deselezionare un'azione secondaria già attiva riporta alla disponibilità non dichiarata, senza inventare valori.

Conferma esplicita e pulsante successivo sono conservati; nessun avanzamento automatico, popup o animazione nuova. Una bozza modificata non sostituisce la risposta confermata finché non viene confermata; riepilogo e risultato continuano a usare solo risposte confermate e segnalano bozze/riconferme. Gli stati mancanti non portano una precedente cifra nella nuova risposta confermata. Zero rimane un valore esplicito distinto da assenza di dato.

| Componenti/file | Modifica |
| --- | --- |
| answer-fields.tsx, secondary-answers.tsx | Composizione condivisa dei 40 widget e delle sole due azioni secondarie; nessuno stato persistente o trasporto |
| anonymous-client.tsx, radar-client.tsx | Entrambi usano il componente condiviso; default UNANSWERED; testi di aiuto coerenti |
| controls.tsx | Importi annidati sempre disponibili; select con risposte dirette e azioni mancanti secondarie |
| goals-fields.tsx | Risorse, vincoli, esperienze e aspettative visibili senza selettore di intenzione; VALUE implicito al primo edit; payload scartati sui cambi di stato |
| presentation.ts | Solo etichetta riepilogo VALUE: “Risposta indicata”; formule e funzioni invariate |
| radar.module.css | Solo stili aggiunti per le azioni secondarie, target minimo 44 px e stato testuale |
| Test browser/guardie/pin | Aggiornate solo aspettative UI storiche; copertura, valori canonici e assert HTTP conservati |

Nessuna modifica a question-fields.tsx, ID/catalogo, fasce economiche, soglie, dipendenze, motore 4A, sei settori, proiezione Advisor, schema, API/server, routing o dipendenze. Verificato con diff contro lo SHA iniziale. Le guardie mantengono le baseline storiche; i cambiamenti UI sono vincolati a hash esatti nel manifest, comprese le due nuove componenti e il CSS. Il test negativo continua a rifiutare mutazioni non approvate. Nessuna eccezione generica a una directory o aggiornamento delle baseline di dominio a HEAD.

### Confronti prima/dopo

| Caso | Prima: Preview bbde1aa | Dopo: nuova UI locale |
| --- | --- | --- |
| Domanda a 320 px | [Prima](preview-ux-4p4b-qa/before-320.png) | [Dopo](preview-ux-4p4b-qa/after-320.png) |
| Domanda a 390 px | [Prima](preview-ux-4p4b-qa/before-390.png) | [Dopo](preview-ux-4p4b-qa/after-390.png) |
| Obiettivi desktop | [Prima](preview-ux-4p4b-qa/before-goals.png) | [Dopo](preview-ux-4p4b-qa/after-goals.png) |

Screenshot sintetici esaminati visivamente, inclusa domanda 320 e risorse 390. Nessun overflow o sovrapposizione nei quattro viewport; nomi accessibili degli input, label, fieldset/legend, aria-pressed, focus e touch target verificati nel browser. Le azioni secondarie permettono di riprendere direttamente i campi, senza un nuovo passaggio preliminare. Nessuna prova manuale NVDA/VoiceOver eseguita.

### Test locali

| Verifica | Esito |
| --- | --- |
| Build anonimo ON: 145 pagine, home statica e Readable genuino | PASS, HTML 90184 byte, Markdown 5796 byte |
| Build OFF: 145 pagine, home statica e Readable genuino | PASS, HTML 90149 byte, Markdown 5796 byte |
| HTTP locale ON/OFF | PASS 24+24 richieste, incluse 304 HTML con ETag e condizionali incrociate |
| Gate ON/OFF e flag persistenti pubblici forgiati | PASS: API GET/POST e Advisor 404, anonimo raggiungibile solo nella modalità prevista |
| Typecheck e lint | PASS; lint 0 errori, 65 warning preesistenti |
| 31 gruppi di regressione | PASS: motore/public/projection/UI/backend simulato, Advisor/accessi/contratti/linking, Radar, funnel/leads, ledger, CRM, opportunità, persistenza, mapping remoto, no-platform, search, Readable, Annunci/AI Score, integrazione/presentazioni/temi/build/editorial/narrative |
| Browser anonimo 29+11 e tutte le tipologie | PASS, anche equivalenza degli stati diagnostici con input canonico T02 |
| Transizioni UI obbligatorie | PASS risposta diretta, UNANSWERED mai compilata, UNKNOWN→VALUE, VALUE→DECLINED→VALUE, zero, ritorno, bozza dopo conferma, cambi dipendenti e riconferme, risultato incompleto/completo |
| Browser persistente simulato | PASS 29+11, recupero dopo refresh, OTP simulato, due dispositivi, CAS/conflitti, retry UUID, CSRF/IDOR, snapshot immutabile identico al motore e revoca |
| Responsive, tastiera, immagini/font, navigazione e isolamento | PASS 320/390/768/1440, landscape e reduced motion |
| Radar d'Impresa e funnel | PASS: Radar v4/34 schermate, 35 fotografie byte-identiche, Evento/Architetto e temi conservati |

Anonimo locale: **144 richieste tecniche, 0 invii, 0 esterne**, zero storage/errori. Persistente simulato: **567 richieste, 112 scritture autenticate solo locali, 0 esterne**, zero storage browser/errori. Le scritture sono nello stack PGlite/OTP effimero già previsto, non su Supabase o provider reali. Il test di navigazione locale usa stub inerti dei soli script ordinari Iubenda; quello remoto sopra ha invece eseguito i GET reali, bloccando i POST.

Conservate le evidenze dei tentativi iniziali: alcuni verificatori cercavano il selettore di intenzione rimosso o il vecchio testo UNKNOWN; quattro guardie segnalavano il CSS non ancora incluso nella pin esatta. Dopo l'adeguamento mirato sono PASS. Nessuna UI alterata per soddisfare baseline grafiche vecchie e nessun assert di dominio/ETag rimosso.

[Regressioni finali](preview-ux-4p4b-qa/regressions.json), [browser anonimo locale](preview-ux-4p4b-qa/local-anonymous.json), [persistente](preview-ux-4p4b-qa/local-persistent.json), [navigazione](preview-ux-4p4b-qa/local-navigation.json), [confine sintetico](preview-ux-4p4b-qa/local-boundary.json), [HTTP ON](preview-ux-4p4b-qa/on-http.json), [HTTP OFF](preview-ux-4p4b-qa/off-http.json), [build ON](preview-ux-4p4b-qa/build-on.json), [build OFF](preview-ux-4p4b-qa/build-off.json).

## C. Conservazione e readiness

I due worktree originali, HEAD, differenze e contenuti di tutti i file non tracciati sono invariati. I due documenti 4P.2 non committati restano disponibili e identici, esclusi dal nuovo commit. Nessun secret, file env, tmp o configurazione locale incluso. Nessun push, merge, quarto deployment, migrazione, email, modifica HighLevel/Supabase/Resend o attivazione Advisor.

Il progetto pilota conserva esattamente i tre deployment iniziali, stessi stati/target/URL/SHA e configurazione: vecchia Production READY, Preview ERROR storica e Preview attuale READY. Authentication ALL, sette flag immutati, zero bypass persistenti, zero Shared/Git. Produzione horyzon-website invariata: dpl_Cnj429btQQebBFEdQ8re36cNyqEG, SHA 9146f6372b19fdac6db1770d05f6b0ca10c1f1e5; nessuna modifica a horyzon.it. [Preservazione](preview-ux-4p4b-qa/preservation.json).

| Decisione | Esito e condizioni |
| --- | --- |
| GO tecnico locale della nuova UX | **GO**, tutte le verifiche pertinenti PASS e dominio invariato |
| GO complessivo per un nuovo deployment Preview | **NO-GO per una candidata dichiarata conforme**: resta aperto il contratto ETag della piattaforma. La UI è tecnicamente pronta, ma nessun nuovo deployment è autorizzato da questa fase |
| GO volontari | **NO-GO**: requisito ETag aperto; nuova UI non ancora collaudata online |
| GO pubblicazione su horyzon.it | **NO-GO**: nessuna autorizzazione, requisiti remoti ancora aperti |

Per proseguire: chiarire e risolvere il comportamento 304 con la piattaforma, senza sopprimere l'assert; ottenere autorizzazione esplicita per un eventuale nuovo deployment del nuovo SHA e ripetere su quell'artefatto HTTP, browser e privacy. Il PASS della vecchia UI online non è trasferibile automaticamente alla nuova. Bozza ticket non inviata; nessuna pubblicazione. Fermata dopo report e commit locale verificato.

Log e screenshot completi separati in C:/Users/emanu/.codex/visualizations/2026/10/18/01a14e5a-6067-71a0-a210-f3859cab8329/radar-public-pilot-4p4b: remote-browser (Preview precedente), local-browser (nuova UI), persistent (stack simulato), on/off (build/HTTP). Nessun token o stato di autenticazione browser esportato.
