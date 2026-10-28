# Accesso individuale e rilascio futuro — piano 4P.6

19 ottobre 2026. **Solo letture e preparazione; nessun accesso nuovo, invito, modifica o rilascio eseguito.** Le autorizzazioni future non sono implicite in questo piano.

## Destinazione verificata

| Voce | Esito della lettura 4P.6 |
| --- | --- |
| Team | `horyzon-consulting`, `team_LsT2CKLXy6aIHfeH9SPKpDIz`, piano **Pro** |
| Progetto isolato | `horyzon-radar-pilot`, `prj_bJvIOswh4GacqtUootXATXeAkSUO` |
| Artefatto fissato | `dpl_WHyLB43axP3D8H9MSqNGEYFRzdxj`, READY, sorgente `accd6b70b498cbccb7e1dbedb551e165fa38f820` |
| URL da usare nel piano | `https://horyzon-radar-pilot-blelmgb7p-horyzon-consulting.vercel.app/radar-patrimoniale` |
| Ambiente | Preview nel dashboard e `project.targets.preview`; il dettaglio API restituisce `target:null`, non Production |
| Protezione | Vercel Authentication **ALL**; Share mostra **Only people with access** e attualmente il team Horyzon |
| Collaborazione | Share mostra «Add team members or emails…»; commenti non abilitati nella finestra letta |
| Separazione | Nessun Git collegato; Shared IDs vuoti; zero bypass persistenti; esattamente sette variabili, tutte Preview |
| Deployment conservati | Quattro, senza nuovi tentativi. Production del pilota ancora `dpl_7RDwRCmd7fYc6UE28jJYHyAcvVcz` |
| Produzione aziendale | Progetto `horyzon-website`, `prj_EWAOevQbWZqhKddTuD6l8GWSIYHM`; Production ancora `dpl_Cnj429btQQebBFEdQ8re36cNyqEG` |

Dashboard del deployment aperto in sola lettura e finestra Share esaminata senza digitare indirizzi, premere Copy Link, abilitare commenti o modificare il selettore. Analytics e Speed Insights indicati «Not Enabled». Nessun elenco di persone o recapiti esportato.

## Modalità valutate

La documentazione [Sharing a Preview Deployment](https://vercel.com/docs/deployments/sharing-deployments), consultata il 19 ottobre 2026, descrive l'aggiunta individuale di collaboratori esterni senza inserirli nel team, disponibile su Pro. In presenza di protezione occorre un account Vercel personale; l'accesso è revocabile da Share. Questa è la modalità proposta. Non selezionare «Anyone with the link»: genera un collegamento che aggira la protezione.

La pagina [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication) prevede anche richieste di accesso approvabili per utenti autenticati. La documentazione descrive l'accesso concesso come riferito all'ultima distribuzione di uno specifico branch: non promettere quindi un grant necessariamente limitato a un unico artefatto immutabile. Usare l'URL del deployment fissato, verificare l'ambito effettivo indicato da Share/Access e congelare ulteriori deployment del pilota durante il test. Anche approvare una richiesta è una scrittura remota, oggi non autorizzata. Non avviare richieste di prova adesso.

| Alternativa | Valutazione |
| --- | --- |
| Collaboratore esterno individuale via Share | **Proposta**: niente appartenenza al team; account proprio; accesso revocabile. Ambito e isolamento da confermare con un account esterno dopo autorizzazione. |
| Richiesta di accesso individuale | Possibile percorso alternativo documentato; approvazione manuale nominativa e verifica dell'ambito. Nessuna approvazione automatica. |
| Nuovo membro Pro Viewer del team | **Escluso**: visibilità su tutti i progetti e deployment del team, oltre a dati di performance/analytics accessibili al ruolo. Potrebbe includere horyzon-website e progetti estranei al Radar. |
| Member, Owner, Developer, Billing | **Esclusi**: ambito o poteri ulteriori non necessari ai volontari. |
| Contributor + Project Viewer / access group | La separazione per progetto è descritta per Enterprise; non è la soluzione disponibile da assumere sul team Pro attuale. Nessun upgrade proposto per questo pilot. |
| Link di bypass, password/account condivisi, token di automazione o OIDC ai volontari | **Esclusi**: non sono il piano di accesso umano individuale richiesto. Nessuna eccezione pubblica o Trusted Sources nuova. |

Il rischio dei ruoli deriva dalla documentazione [Access Roles](https://vercel.com/docs/rbac/access-roles): il Pro Viewer osserva tutti i progetti e deployment, pur non avendo accesso a log, configurazioni sensibili o fatturazione dettagliata; Contributor con ruoli assegnati per progetto è Enterprise. Le limitazioni del Viewer non lo rendono adatto a isolare i volontari nel team aziendale. Non sono stati aggiunti o modificati ruoli per provarlo.

## Passi successivi, solo dopo nuova autorizzazione

1. Il referente approva nominativi/indirizzi fuori dal repository, scopo, finestra temporale, testo di partecipazione e limitazione HTTP. Nessun invio automatico di inviti.
2. Un amministratore apre **Share di questo deployment**, controlla URL esatto, grant individuale esterno e «Only people with access». Verifica nell'anteprima del grant che non sia un invito al team o un accesso ad altri progetti. Se l'ambito non è verificabile, fermarsi e chiedere chiarimento a Vercel; niente fallback a Viewer del team.
3. Autorizzare inizialmente una sola persona esterna designata, soltanto dopo il consenso esplicito a quell'operazione. L'invito Share invia una email: va compreso nella nuova autorizzazione. Nessun token o segreto nel messaggio.
4. Con quell'account individuale verificare: login necessario, Radar accessibile, assenza di membership nel team, indisponibilità di dashboard/codice/log/env degli altri progetti e di horyzon-website. Provare l'URL di un progetto estraneo già noto al referente senza esportarne il contenuto. Il volontario non deve vedere risorse aziendali estranee. Verificare quale accesso sia concesso agli altri artefatti/branch del solo pilota. La verifica non è stata eseguita in 4P.6 perché richiede un grant nuovo.
5. Verificare sulla stessa sessione esterna che il questionario non riceva toolbar/commenti/strumenti di acquisizione; non abilitare la toolbar per facilitare il feedback. Se il grant introduce uno script incompatibile, interrompere prima della compilazione e documentare; nessuna modifica automatica della protezione.
6. Dopo esito positivo, ripetere i grant strettamente individuali per il gruppo approvato, senza cambiare Auth ALL, Shared, flag, branch Git o artefatto. Inviare soltanto l'URL fissato; nessun link firmato/condivisibile pubblicamente.
7. Al termine della finestra approvata revocare i grant esterni singolarmente, senza toccare i membri già autorizzati; verificare il diniego con l'account revocato. Anche la revoca è un'attività futura da autorizzare insieme agli inviti. Non modificare il primo deployment.

È verificata la disponibilità documentata e visibile della modalità; **non è ancora collaudato l'accesso di un nuovo volontario esterno**, né la revoca. Questa è una condizione di avvio, non un PASS acquisito.

## Integrazione futura su horyzon.it

Destinazione di prodotto: `https://horyzon.it/radar-patrimoniale`. Conservare `/radar` come Radar d'Impresa e le sue 34 schermate. Non promuovere il progetto pilota, collegargli il dominio aziendale o trasformarlo nel progetto di produzione. L'integrazione futura va preparata nel repository e nel normale progetto horyzon-website, con un'autorizzazione di rilascio distinta.

### Compatibilità con main verificata ora

`git ls-remote origin refs/heads/main` restituisce **9146f6372b19fdac6db1770d05f6b0ca10c1f1e5**; l'oggetto era già disponibile localmente. Nessun fetch o spostamento di ref effettuato. Il merge-base col candidato accd6b7 coincide con main; differenza `main...candidate`: **0 commit solo main, 56 solo candidato**. Compatibilità di ascendenza confermata; non è un test di merge/build sulla futura versione di main e non dimostra che tutti i 56 commit siano da rilasciare insieme.

Il candidato contiene, oltre al Radar, funnel, ledger/CRM/outbox, contratti e fondazioni locali/Advisor, documentazione e dipendenze. Confrontare semanticamente l'intero diff prima del rilascio. Non abilitare backend/Advisor, routing o migrazioni solo perché i file entrano in main. Verificare separatamente che i flag già presenti in produzione non rendano attive funzionalità importate; non copiare l'ambiente di produzione nel pilota. Se il main cambia, ripetere confronto e collaudo su un ramo di rilascio isolato, preservando i worktree esistenti. Nessuna analisi di conflitti simulata con merge in 4P.6.

### Rischi e gate di approvazione

| Area | Rischio concreto | Controllo richiesto prima del rilascio |
| --- | --- | --- |
| Layout e route | Riorganizzazione delle pagine in `(site)`, due documenti radice, `site-document.tsx`, `global-not-found` sperimentale. Cambiano confini di layout e navigazioni complete. | Verificare mappa URL prima/dopo, 404, redirect, font/assets/CSS, canonical, cookie/consenso, ingresso da home e da link profondo, uscita col logo, back/forward, refresh e tastiera. Preservare contenuti ordinari byte identici dove previsto. |
| Proxy e isolamento | Marker di documento e CSP anonima specifica; uno shell ordinario con script di consenso non deve sopravvivere all'ingresso. | Ripetere browser reale su artefatto finale: nessuno script Iubenda/toolbar/analytics nel Radar; zero invii di risposte, nessuno storage; marker non falsificabile dal client. Provare HTML e Flight separatamente. |
| Home no-store | La policy aggiunta vale per `/` e `/home.md`, non soltanto per il Radar. Riduce riuso downstream/browser, con possibili costi e tempi maggiori; non elimina necessariamente la cache interna degli artefatti statici. | Approvazione esplicita dell'effetto sulla home. Confrontare latenza/cache e Readable su più richieste/PoP; home ancora statica e build-readable originale riuscito. Evitare una promessa di CDN totalmente disattivata. Non rimuovere la policy senza una soluzione verificata per la negoziazione. |
| HTTP e negoziazione | 304 HTML senza ETag **FAIL**; 200 HTML remoto non conserva Accept nel Vary. Differenza RSC remoto 200 Flight vs redirect locale separata dal difetto. | Ticket da autorizzare; correzione dimostrata e matrice GET/HEAD/Accept/ETag fino a PASS, senza indebolire assert. Verificare rappresentazioni e cache sull'artefatto finale. La deroga del pilot non vale per il pubblico. |
| Attivazione | In produzione la sola presenza della route non deve aprire funzionalità persistenti. Flag contraddittori devono fallire chiusi. | Approvare inventario dei flag di produzione senza leggere segreti e piano anonimo soltanto. Backend, persistenza, Advisor e demo OFF; nessun Shared nuovo, migrazione o credenziale CRM/email. Nessuna modifica di flag oggi. |
| Radar d'Impresa | `/radar`, asset/font PDF e API operative non devono cambiare comportamento. | Ripetere suite v4/34 schermate, PDF e percorsi più recenti, senza scritture remote. Tenere `/radar-patrimoniale` distinto anche nelle etichette di navigazione. |
| Funnel e operatività | Merge più ampio della sola UI; possibili effetti su temi, ledger, outbox e routing esistente. | Test Evento/Architetto e 35 fotografie, ledger/CRM/opportunità/persistenza/mapping in locale simulato; nessuno smoke reale, nessuna modifica di responsabili o regole operative. |
| SEO | Oggi Radar `noindex,nofollow,nocache` e non elencato nella sitemap; protezione Preview non è una politica SEO pubblica. | Decidere con l'editor se restare noindex anche all'avvio pubblico. Se approvata indicizzazione, modificare in fase distinta sia metadata sia header e sitemap, canonical finale HTTPS e OG; mai indicizzare risultati, risposte o parametri. Non aggiungere CTA pubbliche prima del GO. |
| Navigazione | Due Radar possono essere confusi; il cambio documento elimina la compilazione anonima. | Etichette esplicite «Radar d'Impresa» / «Radar Patrimoniale», link corretti desktop/mobile, avviso perdita dati chiaro; nessun dato nei link o nelle query. Verificare link `/radar` e hub già esistenti. |
| Accessibilità | Verifiche automatiche precedenti non sostituiscono lettore di schermo o usabilità. | Focus/tastiera, zoom 200%, reflow 320 px, contrasto e stati non solo colore, errori/fieldset/legend, domande lunghe e risultato SVG; prova manuale NVDA/VoiceOver da svolgere, non dichiarata PASS. |
| Editoriale/privacy | «Senza registrazione» del questionario può confondersi con login Vercel; dati tecnici non equivalgono ad assenza assoluta di dati personali. | Approvare testi e distinzione accesso piattaforma/risposte, finalità e tempi delle note del pilot, ruoli dei fornitori. Nessuna conformità legale certificata. |

Le note sul caching statico derivano dalla [documentazione Vercel CDN](https://vercel.com/docs/caching/cdn-cache#static-files-caching): gli artefatti statici possono essere conservati dalla piattaforma per la vita del deployment. HIT/Age non dimostrano da soli contaminazione. Il [contratto degli header di cache](https://vercel.com/docs/caching/cache-control-headers) va valutato separatamente dal comportamento del browser e dalla verifica delle rappresentazioni. Nessuna modifica della home viene proposta come eseguita ora.

### Sequenza di rilascio da approvare in una fase successiva

- [ ] Acquisire feedback reale dei 5–8 volontari, inclusi problemi e parti non provate; approvare eventuali correzioni con nuovo SHA identificato.
- [ ] Chiudere il difetto ETag con evidenze; rivedere Vary/Accept e cache. Nessuna deroga pubblica implicita.
- [ ] Verificare di nuovo main, produzione e stato dei worktree; preparare un ramo di rilascio isolato e una review completa del delta, senza trascinare lavoro concorrente.
- [ ] Rivedere dipendenze, configurazioni, route, regressioni v4/funnel/CRM e guardie OFF/ON; typecheck, lint e build nell'ambiente finale. Eventuali test remoti con scritture richiedono un altro scope, non sono parte di questo piano.
- [ ] Verificare metadata/canonical/noindex/sitemap, navigazione, accessibilità e privacy sul risultato integrato. Nessun consenso o risposta economica nei log/analytics.
- [ ] Fissare progetto e dominio di produzione corretti, SHA da rilasciare, piano flag e identificativo precedente per rollback, approvazioni tecniche/editoriali e del responsabile di rilascio.
- [ ] Chiedere autorizzazione esplicita prima di push, merge, modifica flag o deployment. Oggi nessuna di queste azioni è autorizzata.

### Rollback proposto

Prima del futuro rilascio registrare la **Production effettivamente attiva allora**, SHA, alias/domino e configurazione; non assumere che l'ID letto oggi sia ancora il precedente corretto. Oggi il riferimento è `dpl_Cnj429btQQebBFEdQ8re36cNyqEG` sul progetto horyzon-website. Preservare l'artefatto precedente e verificare l'ammissibilità del rollback nel piano del team, senza promuoverlo adesso.

Trigger: errori delle route ordinarie, regressione v4, script o risposte fuori dal Radar anonimo, gate aperti, 404 anomale, corruzione della negoziazione o errore grave di accessibilità. Dopo approvazione del rilascio includere autorizzazione e responsabilità per ripristinare l'intera release precedente, non soltanto nascondere il link. Un rollback di codice/deployment non ripristina automaticamente configurazioni o env: preparare il confronto e l'eventuale ripristino autorizzato dei soli flag/config cambiati. Nessuna migrazione deve essere necessaria per questo rilascio anonimo.

Dopo rollback controllare home HTML/Markdown, `/radar`, contatti, funnel/asset, navigazione, 404, API/gate e dominio; se necessario una disattivazione del Radar va esplicitamente autorizzata e verificata secondo la natura build/runtime dei flag, senza presumere effetto immediato. Nessuna modifica a DNS, CRM, Supabase o assegnazioni come rimedio automatico. Conservare solo evidenze tecniche senza risposte. Nessun rollback è stato eseguito in questa fase.
