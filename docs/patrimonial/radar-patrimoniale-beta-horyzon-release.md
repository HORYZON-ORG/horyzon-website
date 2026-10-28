# Radar Patrimoniale — piano operativo beta horyzon.it

27 ottobre 2026, Europe/Rome. **Preparazione locale conclusa. Attivazione remota non eseguita e ancora NO-GO finché i prerequisiti sotto non sono verificati/approvati.**

Destinazione unica: **https://horyzon.it/radar-patrimoniale**. Nessuna nuova Preview o nuovo progetto. La pagina è non pubblicizzata e noindex; i dati sono accessibili soltanto dopo Auth e autorizzazione server/DB. Un URL poco noto e noindex non sono un controllo di accesso.

## 1. Artefatti coordinati

Nuovi checkout isolati sotto:

`C:/Users/emanu/.codex/visualizations/2026/10/18/01a14e5a-6067-71a0-a210-f3859cab8329/radar-beta-release/`

Branch locale nei quattro repository: `codex/radar-beta-release`.

| Prodotto | SHA codice da autorizzare | main riletto e preservato |
| --- | --- | --- |
| Website | `c4f8b1784dd4b609564d66cd922a9ca8cffca6ac` | `9146f6372b19fdac6db1770d05f6b0ca10c1f1e5` |
| Platform / sole candidate SQL | `2c61a2f0c1555ff3c7b094770b9af15d5312f529` | `2fdcaed683391631267bb681705b3a1fd4ef5e31` |
| Hub | `4aab9fb201022bd4af3827a5ea2f6cca5b3bfaed` | `80f5b2e6caf7775db726877fef1b5d5fb8403e1a` |
| Architetti | `346ca914b2fec1d1756fe26babe29ad0d3cce01b` | `2d954b7bc380cd02342f9dcf04b526a42de92c39` |

Questo report e le evidenze sono un successivo commit documentale Website: il suo SHA viene indicato nella consegna; il codice eseguibile è quello della tabella.
Platform non richiede un deployment dei suoi servizi per questa beta: consegna la catena SQL e conserva il main corrente.

Website parte da `80195ced7fdeb2b43dd230a48e9668229e137fb5`; Platform da `dc61c8060fc676f514159fb32fba1ed2aa905ebd`. Hub/portale partono dai main correnti e integrano i rami Radar già sviluppati. Nessun lavoro non committato o ramo commerciale incompleto importato.

**Riconciliazione:** Platform conserva entrambi gli export contratti, incluso accounting e riferimento Radar. Hub conserva riepiloghi rete, avvisi, contatori, selezione Architetti, inviti e training insieme alle due viste Radar. Un solo conflitto testuale nel portale, negli import di ContactDetail: mantenuti call-outcomes, ContactEventContext e ContactRadar. App e resto del dettaglio sono stati composti preservando gli esiti chiamata correnti. Nessuna strategia ours/theirs globale.

I **47 checkout preesistenti risultano invariati** in HEAD, branch, diff e hash dei non tracciati; cache ignorate escluse dalla certificazione. [Conservazione](beta-release-evidence/preservation.json), [inventario degli artefatti](beta-release-evidence/artifacts.json). I rami main locali/remoti non sono stati modificati.

Il rilascio Website pubblicherà l'intero artefatto consolidato rispetto al main, compresi layout e funnel precedentemente integrati: non è un aggiornamento remoto di un singolo file. I conteggi/file sono nell'inventario. Le pagine ordinarie e Radar d'Impresa restano protetti dai verificatori di preservazione.

## 2. Modifiche indispensabili

### Website

- Production resta negata per default. L'unica eccezione richiede ACCOUNT_ENABLED=true, BETA_ENABLED=true, context=website-beta, VERCEL=1, VERCEL_ENV=production, target Production se presente, deployment ID e **ID Website ufficiale esatto**. Origine configurata esattamente `https://horyzon.it`.
- Appartenenza del progetto al team Horyzon verificata via metadati remoti. VERCEL_ORG_ID non è presunto automatico: se fornito viene verificato, ma l'autorità runtime obbligatoria è l'ID univoco del progetto. Le [variabili di sistema documentate](https://vercel.com/docs/environment-variables/system-environment-variables) richiedono l'accesso abilitato nelle impostazioni Vercel; verificare VERCEL_PROJECT_ID/DEPLOYMENT_ID/ENV prima dell'apertura.
- Whitelist server di **1–20 email esatte**, normalizzate, senza wildcard o duplicati; vuota/malformata chiude il gate. Nessuna email reale è stata scelta o inserita. Controllo prima di inviare OTP, alla verifica del challenge e su ogni richiesta con email confermata restituita da Auth. Non usa user_metadata per autorizzare.
- Cookie Secure/HttpOnly/SameSite Strict, Origin, provenienza, CSRF, sessione viva, HMAC, RPC/RLS/P1 e rate limit Auth esistenti conservati. La beta richiede anche il marker CSRF request-code prima dell'OTP.
- Ammesse soltanto le route native account: identity/request, identity/verify, referral, session, session/revoke, assessments e relative read/answer/notice/complete/snapshot. Nessuna apertura di Event propose/confirm, Advisor sperimentale o API amministrative.
- Proxy conserva l'isolamento Radar e nega l'alias non canonico nella beta. Origine controllata nuovamente dal server API, senza sostituirla con Host/Forwarded ricevuti dal client.
- Risposte account con Cache-Control, CDN-Cache-Control e Vercel-CDN-Cache-Control private/no-store; documento Radar isolato e CSP same-origin. Nessuna modifica alla policy della home o al ramo HTML/Markdown della Proxy.
- noindex/nofollow/nocache già presenti, esclusione sitemap ora esplicita. Nessun nuovo collegamento in homepage, menu, footer o CTA pubbliche. Il vecchio componente di prosecuzione Evento non è renderizzato nella ricevuta esclusiva.
- Il gate account Production **non abilita la landing Evento v2**, nemmeno se altri flag fossero già presenti. Attivare l'Evento non fa parte di questa autorizzazione Radar.

`.env.example` mantiene entrambi i flag false e campi credenziali/email vuoti. Aggiornati soltanto i pin espliciti dei sorgenti rivisti; nessun assert di preservazione eliminato.

### Hub e portale

Nessuna nuova funzione commerciale. Il filtro “Da assegnare” Hub legge M6: soltanto report COMPLETED con assignmentState=UNASSIGNED; REVIEW non è una pratica distribuibile. “Assegnati” usa ASSIGNED. Nessun algoritmo di prelievo o writer P1 aggiunto.

Metadati, dossier e storico restano quelli canonici. Le RPC personali impongono propria competenza, sessione e Advisor corrente. Il contratto handoff è conservato, correggendo una descrizione: il comando person riceve **personId**, report riceve caseId.

HighLevel, chiamate, appuntamenti, messaggi e contratti non sono attivati dal Radar. Le funzioni commerciali già presenti sui main sono conservate e non vengono estese.

## 3. Destinazioni reali e rollback fissati

Team: `horyzon-consulting`, ID `team_LsT2CKLXy6aIHfeH9SPKpDIz`.

| Destinazione esistente | Project ID | Production READY prima della beta |
| --- | --- | --- |
| horyzon.it / horyzon-website | `prj_EWAOevQbWZqhKddTuD6l8GWSIYHM` | `dpl_Cnj429btQQebBFEdQ8re36cNyqEG`, SHA main Website sopra |
| hub.horyzon.it / horyzon-hub | `prj_RltJaUziQT9bOGVwWQueRb2KfEjv` | `dpl_5MoFbRm3gcemNmXtRXoD5kpNkat2`, SHA main Hub sopra |
| architetti.horyzon.it / horyzon-architetti | `prj_aDUoQsf1VpNjNXYyuk4JJ0SPtfg7` | `dpl_DrHeCtfwKSSeFSJKtBvuC92dQ1gc`, SHA main portale sopra |

Verificati target effettivo production, alias e SHA degli attuali tre artefatti. Il latestDeployment del progetto Website era una Preview diversa: **non** è il riferimento di produzione/rollback. La destinazione horyzon.it risolve al deployment della tabella.

Node configurato: Website/Hub 24.x, portale 22.x. [Metadati Vercel e variabili](beta-release-evidence/vercel.json): soltanto nomi, scope e presenza; nessun valore o secret registrato.

I nuovi nomi Radar account/beta non risultano configurati in Production Website. SUPABASE_URL e SERVICE_ROLE già presenti servono ad altri prodotti e non vanno rimossi o riutilizzati come credenziale del browser Radar. Hub e portale hanno nominalmente le variabili publishable/URL necessarie; destinazione effettiva e validità saranno verificate senza esporne i valori. Il percorso Radar non richiede il vecchio gateway pilota, Trusted Sources o broker.

## 4. Catena database esatta

Supabase condiviso: **pmkyeqrfkunypfkbjnyg**.
Il catalogo aggiornato conferma schema Radar ancora assente, authenticated con USAGE hub e senza USAGE public, anon senza USAGE public, pgcrypto in extensions e le colonne Auth necessarie.
Le cinque definizioni guardate da M2 e i tre ingressi richiesti da M5 coincidono con i fingerprint candidati; guardia P1 corpo `753e1a961d78bb0f7faf0fdd026452f9`. [Preflight in lettura](beta-release-evidence/remote-catalog.json).

Installati i prerequisiti Architetti/referral, inclusi 0056 (versione remota 20261020184209), event_radar_contact_link e le versioni 20261026180004/180721/181058. Non riapplicarli. Non usare migration up/db push indiscriminati.

| Ordine | Repository / file | SHA256 UTF-8 LF |
| --- | --- | --- |
| M1 | Website `supabase/migrations/20261018191940_patrimonial_radar_identity_sessions.sql` | `4b121673988723f407017a0ef1720dbe2bcb7b0002c6a0d88d012472c8923543` |
| M2-5D | Platform `packages/database/pending/20261026160057_patrimonial_radar_preview_foundation.sql` | `83a9c7077324d1e98f991622d9bacc008e30aa54467d618f29c8984f81e7f7ca` |
| M3-5D | Platform `packages/database/pending/20261026160106_patrimonial_radar_preview_auth.sql` | `2c509fbb8f484745ce961241803f33081fa9865dfbe33967957856b6273f8191` |
| M4 | Platform `packages/database/pending/20261026220758_patrimonial_radar_architect_referrals.sql` | `66a40de3f7f6ac9a97d7002bc8077347ceea5e2a440e7ba2fe4376f869faf5fa` |
| M5 | Platform `packages/database/pending/20261027080238_patrimonial_event_v2_referral.sql` | `31fbc20426c1892f50d33791fe4756df49b82fcbef72480103367ed23dbacff1` |
| M6 | Platform `packages/database/pending/20261027092211_patrimonial_radar_handoff_metadata.sql` | `3d87df92b24cf517d545715f53d90b8d43577a92a6dea1e7f77959ca67079c15` |

Tutte **byte-preservate**, nessuna nuova migration aggiunta. [Manifest SQL](beta-release-evidence/migration-chain.json).
M2 amplia vincoli/kind RADAR, guardia/commit P1 e avvolge funzioni rete; M5 modifica tre ingressi Evento e il vincolo provider. **Hanno impatto condiviso.** L'assenza di seed attivi e i gate OFF non eliminano rischi di lock, DDL o regressione.
M6 aggiunge metadati, senza nuove tabelle o assegnazioni. Non installare alternative storiche M2/M3 o tutte le migration 5B.

## 5. Backup, Auth e segreti: stato reale

**Backup recuperabile: NON VERIFICATO. Restore: NOT RUN.**
La dashboard Supabase è arrivata al login; è stato richiesto l'accesso al referente. Il connettore legge il catalogo ma non dimostra data/stato/retention/PITR del backup o una prova di ripristino. Non è stato esportato alcun dato cliente. Questo è un blocco prima di qualunque SQL remoto.

Il responsabile DB deve attestare ID/data backup, finestra recuperabile, RPO/RTO e procedura di ripristino; una prova di restore che crei/modifichi risorse richiede autorizzazione distinta. Salvare anche definizioni e ACL precedenti dei componenti toccati da M2/M5 in custodia protetta.

**Auth/SMTP reali: NON VERIFICATI. Nessun account, OTP o segreto reale creato.**
Prima della finestra leggere i valori non sensibili e preparare un diff soltanto se necessario:

- Email provider/signup/conferma attivi e sessioni con durata, refresh rotation e revoca compatibili; non cambiare globalmente Site URL o redirect condivisi per un flusso OTP che non usa redirect.
- SMTP esistente configurato, mittente autorizzato e budget/limiti di invio adeguati; nessun nuovo provider scelto. Non provare un invio senza destinatario e autorizzazione.
- Template signup e Magic Link devono consegnare un codice Token utilizzabile, non soltanto un link. La UI accetta 6–8 cifre, challenge locale massimo 10 minuti; confermare durata OTP e rate limit effettivi. Un eventuale cambiamento dei template è condiviso con gli altri prodotti e va approvato sul diff.
- Verificare email_confirmed_at, sessione reale/refresh e revoca dopo il rilascio con le sole caselle approvate. Le [istruzioni Supabase OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless) distinguono template OTP da Magic Link.

HMAC: responsabile segreti genera, **solo dopo autorizzazione**, un identitySecret dedicato e casuale (almeno 32 byte di entropia), tramite custodia sicura. Nessuna chiave globale Supabase, service-role browser, valore in Git/chat/log/argomenti CLI.
Solo Production Website riceve PATRIMONIAL_RADAR_IDENTITY_SECRET. Il DB riceve la derivazione già implementata: SHA256(UTF8("account-rpc-5c" + NUL + identitySecret)), 32 byte. Inserimento in account_gate con **enabled=false**, tramite connessione amministrativa autorizzata e parametro binario, senza query testuale con il segreto o log dei parametri. Nessuna credenziale viene richiesta in chat.

Servono inoltre email esatte dei collaboratori e UID/operator_id staff nominativi con permessi LIST/PERSON/ASSIGN/ADVISOR strettamente necessari, a scadenza e con assegnazione P1 valida. Non inventare identità, creare account privilegiati o dedurre Advisor dal referral.
Informativa/retention del flusso persistente devono essere approvate dal referente competente; nessuna attestazione legale aggiunta.

## 6. Flag e arresto

Configurazione proposta **solo Production del Website ufficiale**, dopo approvazione:

| Nome server | Valore / custodia |
| --- | --- |
| PATRIMONIAL_RADAR_ACCOUNT_ENABLED | true soltanto nella finestra autorizzata |
| PATRIMONIAL_RADAR_BETA_ENABLED | true soltanto nella finestra autorizzata; ora assente/OFF |
| PATRIMONIAL_RADAR_ACCOUNT_CONTEXT | website-beta |
| PATRIMONIAL_RADAR_ACCOUNT_ORIGIN | https://horyzon.it |
| PATRIMONIAL_RADAR_ACCOUNT_SUPABASE_URL | https://pmkyeqrfkunypfkbjnyg.supabase.co |
| PATRIMONIAL_RADAR_BETA_EMAILS | Elenco esatto approvato, server-only, niente wildcard o dominio generico |
| PATRIMONIAL_RADAR_PUBLISHABLE_KEY | Chiave publishable dello stesso progetto; valore non acquisito |
| PATRIMONIAL_RADAR_IDENTITY_SECRET | Secret dedicato custodito e mai passato come --env KEY=value |

Nessuna variabile Shared, NEXT_PUBLIC o VITE per whitelist/HMAC. Non modificare flag HighLevel o altri prodotti per “spegnere tutto”: questo percorso non li invoca. Non configurare i vecchi gate remoti/pilota.

**Arresto immediato**, amministratore DB autorizzato:

```sql
begin;
update patrimonial_radar_private.account_gate set enabled=false where singleton;
commit;
```

Questo nega nuove operazioni Radar anche ad artefatti già attivi e chiude anche la lettura Radar Hub/Advisor finché il gate resta OFF. Non cancella report o storico e non spegne il sito o la gestione commerciale preesistente.
Impostare poi BETA_ENABLED=false per i futuri artefatti e fare rollback dei deployment indicati sotto. Una modifica di env Vercel **non cambia l'ambiente congelato dei deployment già esistenti**: da sola non è un arresto immediato.

## 7. Unica finestra operativa proposta — NON ESEGUITA

Responsabile rilascio coordina queste operazioni; ogni riga richiede autorizzazione sulla destinazione indicata.

1. **Prerequisiti:** accesso dashboard in lettura, backup/restore attestati, Auth/SMTP/template esaminati, email collaboratori e staff approvati, accettazione del debito HTTP e del typecheck Hub sotto. Rileggere main e alias immediatamente prima della finestra; se avanzati, fermarsi per non sovrascrivere un nuovo rilascio concorrente.
2. **Supabase pmkyeqrfkunypfkbjnyg:** applicare soltanto i sei file/hash della tabella, in ordine, con operazione apply_migration riferita a quel progetto e query pari al blob approvato. Dopo ciascuno verificare esito/history, gate OFF, ACL senza USAGE public generale, integrità P1/Evento e assenza di nuovi privilegi generali; interrompere su drift/errore. Nessuna riapplicazione automatica.
3. **HMAC e staff:** seed parametrizzato account_gate (singleton=true, mac_key=$1, enabled=false); grant nominativi approvati nel registro permessi, con scadenza. Nessun valore sensibile nel piano o nei log.
4. **Vercel Website:** configurare soltanto gli otto nomi server sopra, con flag true esclusivamente dopo l'approvazione e whitelist fornita. Verificare variabili di sistema documentate. Gate SQL resta false durante tutta la preparazione e i tre deploy. Hub/portale conservano la configurazione Auth corrente verificata; eventuali differenze richiedono approvazione puntuale.
5. **Deploy Production dei tre artefatti esistenti**, una sola versione coordinata, senza push o Preview necessari. CLI installata verificata 59.25.0; comandi preparati, non eseguiti:

```powershell
$releaseRoot = 'C:/Users/emanu/.codex/visualizations/2026/10/18/01a14e5a-6067-71a0-a210-f3859cab8329/radar-beta-release'
vercel deploy "$releaseRoot/hub" --prod --project prj_RltJaUziQT9bOGVwWQueRb2KfEjv --scope horyzon-consulting --yes
vercel deploy "$releaseRoot/architetti" --prod --project prj_aDUoQsf1VpNjNXYyuk4JJ0SPtfg7 --scope horyzon-consulting --yes
vercel deploy "$releaseRoot/website" --prod --project prj_EWAOevQbWZqhKddTuD6l8GWSIYHM --scope horyzon-consulting --yes
```

   Prima di ogni comando verificare commit esatto e checkout pulito. Non usare --temporary, creare progetti, importare Git o caricare .env locali. Subito dopo verificare project ID, target=production, READY, alias e SHA/fingerprint sorgenti dell'artefatto. Non basta l'URL restituito. Nessun deploy Platform necessario.
6. **Apertura:** solo quando i tre artefatti e tutti i prerequisiti sono confermati, UPDATE account_gate SET enabled=true WHERE singleton. È una scrittura remota distinta, da approvare esplicitamente. La pagina rimane sullo stesso URL, noindex e non promossa.
7. **Collaudo effettivo dei collaboratori:** primo OTP autorizzato, Radar inventato, risultato e salvataggio, secondo assessment/storico, contatto e responsabile/coda, entrambe le viste Hub e portale, Advisor consentito/negato e revoca. Registrare soltanto ID/esiti e anomalie sintetiche; verificare rete/log/storage/cache senza conservare risposte personali. Nessuna comunicazione commerciale o HighLevel.

Per un nuovo deployment non basta il nome del branch: la CLI deve caricare esclusivamente i checkout/commit della tabella, con inventario file e assenza di credenziali temporanee. I merge locali non sono merge su main; un push non è richiesto dal piano e non è autorizzato.

### Rollback pronto, da autorizzare insieme alla finestra

Prima account_gate=false, poi:

```powershell
vercel rollback dpl_Cnj429btQQebBFEdQ8re36cNyqEG --scope horyzon-consulting --yes
vercel rollback dpl_5MoFbRm3gcemNmXtRXoD5kpNkat2 --scope horyzon-consulting --yes
vercel rollback dpl_DrHeCtfwKSSeFSJKtBvuC92dQ1gc --scope horyzon-consulting --yes
```

Riconfermare prima che questi siano ancora i corretti predecessori. Impostare BETA_ENABLED=false per i futuri deploy; verificare home, /radar, Evento, Hub/Rete e portale. Conservare contatti, assessment, snapshot e audit. Nessun DROP schema, down distruttivo o restore globale come rollback ordinario. Un ripristino del DB condiviso è un incidente con impatto su tutti i prodotti e richiede la procedura di backup approvata.

## 8. Verifiche essenziali effettuate

| Verifica | Esito |
| --- | --- |
| Otto gruppi beta: gate, whitelist prima/dopo Auth, CSRF, refresh, cookie, route, kill, cache | **PASS**, trasporto Auth/RPC simulato, zero rete |
| 5D originale, senza assert modificati | **4/4 PASS**, Production generica e altri progetti restano negati |
| Website build / typecheck / lint modifiche | **PASS**, 0 errori/warning lint |
| Next build reale locale: isolamento HTML/CSP, soli script same-origin, API no-store, home e /radar conservati, sitemap nascosta | **PASS**; non è una prova del runtime Vercel Production |
| Verificatore esistente public/layout/preservazione | **PASS**, nessun nuovo programma diagnostico |
| Hub integrato | **203 PASS**, 952 assert, 28 file; build PASS; lint file interessati 0 errori/1 warning ereditato |
| Hub typecheck globale | **FAIL 86**: 82 storici e 4 nei file network-metrics del main corrente, non introdotti dal Radar |
| Hub lint globale storico | 513 errori / 15 warning già documentati, non ripetuto o dichiarato risolto |
| Portale npm run check finale | **PASS**: 58 test/14 file, 50 assert PostgreSQL, typecheck, lint 0 errori/3 warning ereditati, build |
| Preflight M2/M5 e ACL remoti | **PASS dei metadati controllati**, nessun DDL eseguito |
| Backup recuperabile, restore, SMTP e OTP effettivi | **NON VERIFICATO / NOT RUN** |

Primo check portale fermato da copia incompleta della topologia pnpm, ripristinata offline dal lockfile senza cambiarlo; poi timeout isolato del test runtime a 5 secondi. Lo stesso test e il successivo check integrale passano senza cambiare assert o timeout. Platform importa da main una riga vuota finale storica nella migration training_history: conservata per non riscrivere lo storico. Dettagli e hash dei log nelle [evidenze](beta-release-evidence/manifest.json).

Riutilizzati senza ripartenza da zero i 68 test nativi e gli 11 incrementali già PASS: nessuna modifica al motore, questionario, protocollo di persistenza, referral/P1 o catena SQL. Il controllo React ha preservato autorizzazione server, reset dei dossier su cambio contesto e separazione dei dati finanziari; nessun nuovo effetto o caricamento commerciale.

ETag HTML 304 mancante e **Vary: Accept restano FAIL aperti**, non ritestati né corretti. L'eventuale accettazione per la beta nominativa deve essere esplicita; nessun GO all'indicizzazione/pubblicazione generale. Non equiparare questi difetti della cache pubblica a un'autorizzazione a cache condivisa delle risposte finanziarie, che rimangono private/no-store.

## 9. Decisione e sole autorizzazioni mancanti

**Candidati locali consolidati, gate OFF. NO-GO operativo attuale** per backup/restore e Auth/SMTP non verificati, assenza dell'elenco collaboratori/staff e mancanza dell'autorizzazione alle scritture. Il FAIL globale Hub è visibile: il referente deve accettarlo formalmente per questa finestra o richiederne la correzione, senza confonderlo con un PASS.

Per procedere servono soltanto:

1. Accesso dashboard per completare le letture già autorizzate e attestazione backup/restore; nessuna nuova architettura.
2. Email esatte dei collaboratori, casella OTP autorizzata, UID/operator_id/permessi/scadenze staff, approvazione informativa/retention.
3. Approvazione esplicita del pacchetto operativo: sei SQL/hash sul progetto Supabase indicato; HMAC/grant e configurazioni effettivamente necessarie; tre Production sui progetti esistenti agli SHA indicati; apertura gate; numero/destinatari degli OTP di collaudo; arresto/rollback sopra. Eventuali modifiche Auth/SMTP devono prima avere un diff leggibile: nessuna delega generica a modificarle.

**Nessun push, deploy, migration remota, modifica Auth/SMTP, secret reale, grant, email, HighLevel o produzione eseguito.** Nessuna Preview o progetto creato. L'attività termina con questo pacchetto e la richiesta delle sole autorizzazioni operative.
