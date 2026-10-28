# Radar Patrimoniale — MVP semplificato

27 ottobre 2026, Europe/Rome. Preparazione esclusivamente locale. **Catena beta ridotta da sei a cinque migration: M1 → M2-5D → M3-5D → M4 → M6 rivista. M5 rinviata.** Nessuna nuova infrastruttura o nuova funzione di prodotto.

URL definitivo: **https://horyzon.it/radar-patrimoniale**, non pubblicizzato, escluso dalla sitemap, noindex. Whitelist temporanea, verifica email, isolamento HTML e interruttore restano quelli già preparati. Nessun flag reale attivato.

Questo documento sostituisce la catena SQL e i riferimenti agli artefatti del precedente piano beta; ne conserva destinazioni, prerequisiti e rollback. Il completamento funzionale locale non dimostra ricezione OTP o funzionamento sul gateway Supabase reale.

## 1. Baseline e conservazione

Quattro nuovi worktree nel percorso:

`C:/Users/emanu/.codex/visualizations/2026/10/18/01a14e5a-6067-71a0-a210-f3859cab8329/radar-mvp/`

Branch locale `codex/radar-mvp`. Nessun merge eseguito in questa attività.

| Repository | Baseline verificata | Artefatto locale |
| --- | --- | --- |
| Website | `ea9f6db54ae58bb09e3f6d9e666552ea148999fc` | `aca59e55f16d97d2a82f564cbb480292fc9cd0e6`: solo rehearsal aggiunto, runtime identico alla baseline; report/evidenze in commit documentale successivo, SHA nella consegna |
| Platform | `2c61a2f0c1555ff3c7b094770b9af15d5312f529` | `c17d9e99504d2a3a213bd5a4c1b1ee01e05fbcd6` |
| Hub | `4aab9fb201022bd4af3827a5ea2f6cca5b3bfaed` | `b9040f46ff5b06fed40e5d52f1591c503d78b62d` |
| Architetti | `346ca914b2fec1d1756fe26babe29ad0d3cce01b` | Invariato, stesso SHA |

**51 checkout preesistenti conservati:** confronto HEAD, branch, diff, stato e hash dei file non tracciati. Cache ignorate escluse da questa certificazione. Nessun reset, clean, stash o commit del lavoro concorrente. [Evidenza di conservazione](mvp-semplificato-evidence/checkout-preservation.json).

## 2. Modello Radar d'Impresa riutilizzato

Esaminati nell'Hub `RadarAdmin.tsx`, `radar-admin.ts`, `radar.functions.ts`, `radar-impresa.tsx`, il client Supabase e il DDL `hub.radar_assessments` in `20260909210000_hub_schema_ddl.sql`. Le prime migration storiche citano public; il client corrente seleziona lo schema configurato, hub in produzione. Non abbiamo cambiato nessuno di questi sorgenti o la tabella.

Il modello gestionale utile è già semplice: un elenco di compilazioni con identità/data/stato, apertura del risultato, collegamento amministrativo all'anagrafica e conservazione dello storico. `RadarAdmin` carica la lista tramite `radarListQuery`; il dettaglio e il PDF operano sul singolo assessment. `assegnaAzienda` collega company_id. Il percorso pubblico storico in `radar.functions.ts` usa un token e un client privilegiato server; il salvataggio può conservare precedenti tentativi in `_storico`, mentre la rianalisi amministrativa crea un'altra riga.

Per il Patrimoniale manteniamo lo stesso modello elenco → report → persona/storico, con queste differenze necessarie:

| Aspetto | Radar Patrimoniale mantenuto |
| --- | --- |
| Identità del compilatore | Supabase Auth con email verificata; sessione reale verificata anche nel DB, non un token pubblico come autorità del dossier |
| Persistenza | Una persona, più assessment e snapshot immutabili; risposte revisionate, replay/CAS e risultato canonico già implementati |
| Collegamento | contact_bindings verificato, con coda delle ambiguità; nessuna fusione finanziaria per sola uguaglianza dell'email |
| Responsabilità | Contatto esistente + proiezione e registro P1 già canonici; nessun nuovo registro di responsabili |
| Lettura dei dossier | Titolare sul proprio assessment; operatore assegnato con permesso Advisor corrente. LIST/PERSON non implicano Advisor |
| Browser e API | Cookie Secure/HttpOnly/Strict, Origin/CSRF, HMAC server e RPC ristrette nello schema hub; nessuna service-role nel browser |

Una tabella unica con accesso pubblico via token ridurrebbe la riservatezza e riscriverebbe il motore funzionante. Non è stata adottata. Restano RLS, revoche selettive, sessioni vive e search_path controllati; la distinzione fra privilegi e RLS è coerente con la [documentazione Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

## 3. Analisi concreta delle sei migration

L'[inventario SQL](mvp-semplificato-evidence/sql-inventory.json) elenca per ciascun file tutte le tabelle create, le funzioni dichiarate e gli ALTER TABLE espliciti. I rimpiazzi dinamici P1/Evento sono descritti sotto; il solo conteggio degli oggetti non li rappresenta.

**M1 — mantenuta integra.** Crea 12 tabelle private. Il percorso account riutilizza settings, persons, sessions, assessments, answer_revisions, receipts, snapshots, audit_events e le funzioni authorize/assessment_json/snapshot_json/public.patrimonial_radar_command. verified_emails è anche un controllo contro identità precedenti. challenges/rate_limits e i rami request_code/delivery/verify_code appartengono al vecchio OTP, non al provider Auth della beta; integration_links non è un prerequisito operativo del flusso diretto. Sono conservati come compatibilità interna, non promossi a nuovi servizi. Estrarli richiederebbe riscrivere il dispatcher e i tipi SQL che vi fanno riferimento, senza ridurre i confini operativi della beta.

**M2-5D — mantenuta integra.** Crea 14 tabelle, incluse cases, service_notice_acknowledgements, contact_bindings, contact_requests, contact_commands, mailbox_reviews e i registri Hub di permessi/audit. Sono necessari open_case, pilot_enabled, il dispatcher con verifica dell'informativa, network_assign_intents, le RPC Hub e gli adattamenti command/snapshot/client_detail della rete. Riusa public.patrimonial_contacts, operators, intents, assignments e patrimonial_assignment_commit.

M2 tocca componenti condivisi: estende kind/funnel di intents e funnel dei lead snapshot, aggiunge il vincolo RADAR minimale, estende guardia/commit P1 e avvolge funzioni rete/capabilities. **Non è priva di impatto.** I fingerprint iniziali restano obbligatori e gli altri flussi vengono delegati alle funzioni precedenti. Non aggiunge trigger alle richieste Evento operative.

Le strutture event_invitations, reconciliations, reconciliation_history, assessment_origins, highlevel_bindings e i rami prepare_event/propose_event/confirm_event/link_assessment non servono per iniziare un Radar diretto. Restano inattivi e incorporati nel contratto preesistente: list/person e i dispatcher referenziano questi tipi/tabelle anche quando vuoti. Non abbiamo creato una M2 riscritta per eliminare oggetti inattivi: allargherebbe inutilmente il cambiamento su P1, audit e rete. Nessun seed, invito Evento o binding HighLevel è richiesto.

**M3-5D — mantenuta integra.** Sei tabelle account_gate, account_profiles, account_sessions, account_reviews, account_link_audit e account_staff_receipts. account_reconcile lega l'identità Auth alla persona, crea/riusa il contatto solo con evidenze compatibili e sospende i casi ambigui. account_case_received prende il responsabile dal contatto verificato e usa network_assign_intents/P1. hub.patrimonial_radar_account_command e simple_command conservano HMAC, controlli della sessione, idempotenza, autorizzazione e coda manuale. Nessun USAGE generale su public: authenticated usa hub, anon non legge tabelle private.

**M4 — mantenuta integra.** Una tabella privata append-only assessment_referrals e cinque ingressi/helper: referral_check, referral_hold_case, attribute_referral, wrapper account_command e architetti_personal_radar. Riusa codici e validatore referral già installati. La provenienza è separata dalla responsabilità corrente: un contatto di B non passa ad A perché arriva dal suo link. Il portale già usa questa RPC, perciò non va riscritto. Il registro della provenienza non è un secondo registro di assegnazione.

**M5 — rinviata integralmente per questa beta.** Non crea tabelle Radar. Adatta ingest/ingest_event/ingest_event_referred, amplia il provider ammesso a website-v2 e introduce acquire_patrimonial_event_referral_v2. Serve all'iscrizione HTTP Evento v2 con referral, non al Radar diretto né al suo referral. Non applicandola evitiamo adesso quei cambiamenti condivisi. Il relativo file resta conservato e collaudato dalle evidenze precedenti; il percorso HTTP Evento v2 referral non è dichiarato disponibile nella catena ridotta. La landing Evento non è abilitata dal gate beta.

**M6 — candidata non applicata, rivista soltanto nel preflight.** Il controllo dell'esistenza della RPC M5 era una dipendenza di baseline superflua: il corpo M6 non la invoca e legge soltanto tabelle già installate o create da M1–M4. Ora richiede esplicitamente assessment_referrals, attribute_referral, contact_event_registrations e la stessa impronta del dispatcher M3. Il preflight rifiuta M4 mancante. Nessuna modifica al corpo dell'enrichment, ai controlli sessione/P1, all'audit sottostante, alle revoche o a EXECUTE. Non crea tabelle, assegnazioni o workflow.

Conserviamo M6 perché distingue responsabilità coerente, assenza di responsabile e revisione necessaria anche in presenza di contatto/proiezioni discordanti o operatore non più valido. Sostituirla con il solo controllo client `operatorId == null` perderebbe queste garanzie. Le informazioni Evento già esistenti possono essere lette senza installare il nuovo ingresso M5 e non sono necessarie per un nuovo Radar diretto.

**Non unificate migration e non riscritte migration applicate.** M1–M5 sono byte-identiche alla baseline; solo il preflight della candidata M6 cambia. Nessuna creazione di un nuovo registro SQL.

## 4. Catena minima da autorizzare

Supabase esistente `pmkyeqrfkunypfkbjnyg`. Prerequisiti già verificati nella preparazione precedente: schema Radar assente, registri P1/contatti/rete e referral installati, authenticated USAGE hub ma non public, anon senza USAGE public, pgcrypto in extensions. In questa attività è stato riprodotto il catalogo con fixture locali: **nessuna nuova verifica del catalogo remoto o scrittura remota**. Prima del rilascio riconfermare drift, history, ACL e backup.

| Ordine | Repository e file | SHA256 del testo UTF-8 LF |
| --- | --- | --- |
| M1 | Website `supabase/migrations/20261018191940_patrimonial_radar_identity_sessions.sql` | `4b121673988723f407017a0ef1720dbe2bcb7b0002c6a0d88d012472c8923543` |
| M2-5D | Platform `packages/database/pending/20261026160057_patrimonial_radar_preview_foundation.sql` | `83a9c7077324d1e98f991622d9bacc008e30aa54467d618f29c8984f81e7f7ca` |
| M3-5D | Platform `packages/database/pending/20261026160106_patrimonial_radar_preview_auth.sql` | `2c509fbb8f484745ce961241803f33081fa9865dfbe33967957856b6273f8191` |
| M4 | Platform `packages/database/pending/20261026220758_patrimonial_radar_architect_referrals.sql` | `66a40de3f7f6ac9a97d7002bc8077347ceea5e2a440e7ba2fe4376f869faf5fa` |
| M6 rivista | Platform `packages/database/pending/20261027092211_patrimonial_radar_handoff_metadata.sql` | `bc555225d3001b4fa47ba115d09a0d735abf272ba714e65bdcdd42044064d1dd` |

La vecchia M6 con hash `3d87df92b24cf517d545715f53d90b8d43577a92a6dea1e7f77959ca67079c15` non è quella del piano ridotto. M5 non è nell'elenco di applicazione. Vietato eseguire un runner su tutti i pending: non installare alternative storiche M2/M3 o duplicare prerequisiti già applicati. Non è necessaria una nuova migration che contenga le cinque precedenti.

## 5. Gestione Hub e portale

L'elenco conserva persona, email, data, stato di compilazione, numero di Radar e filtri email/data/responsabile. Mostra ora esplicitamente **architetto responsabile e stato assegnazione**. Tre situazioni: Assegnato, Da assegnare, Da verificare, con vista Tutti. Rimossi i due filtri separati Completati/In corso; lo stato di compilazione rimane su ogni riga. I casi Da verificare prevalgono sull'apparente assegnazione; un handoff assente non finisce nella coda distribuibile. La coda contiene soltanto report completati UNASSIGNED.

Il pulsante **Apri report** nell'elenco apre il dossier già esistente, attraverso la stessa RPC e gli stessi controlli Advisor. Dettagli e storico conserva la cronologia per persona. Nessun report è calcolato o autorizzato dal client; restano reset del dossier al cambio sessione/contesto, guardia contro risposte obsolete e rimozione del dettaglio quando la finestra perde visibilità.

La scelta del responsabile e la revisione dei collegamenti restano i comandi canonici esistenti. Nessuna nuova funzione chiamate/appuntamenti/contratti/WhatsApp. Se un contatto ha un responsabile verificato, il nuovo Radar lo proietta in P1; se non lo ha, la lista lo rende Da assegnare. P1 resta il registro per intent e il controllo di coerenza: sostituirlo con una lettura diretta del contatto aggirerebbe audit, CAS, revoche e Advisor.

**Portale Architetti interamente invariato.** Le prove native confermano che la sua RPC personale restituisce lo stesso report canonico e nega gli altri operatori. Nessun file commerciale o dashboard riscritto. Radar d'Impresa, questionario Patrimoniale, motore, Website HTML/Proxy/CSP, asset, dipendenze e lockfile sono byte-preservati. [Confronto dei runtime](mvp-semplificato-evidence/preserved-runtime.json).

## 6. Verifiche essenziali ed esiti

| Verifica | Risultato effettivo |
| --- | --- |
| Rehearsal PostgreSQL 17.6 / PostgREST 16.5 | **8 gruppi PASS** sulla catena completa ridotta, M5 assente |
| Compilazione diretta e salvataggio | PASS: risposte presenti, snapshot persistito, report nell'Hub, nessuna nuova iscrizione Evento |
| Referral Radar e report nelle viste canoniche | PASS: stesso contatto/responsabile P1, assessment/report identici in Hub, Clienti e RPC portale |
| Seconda compilazione | PASS: una persona/un contatto, due report distinti, storico conservato e snapshot immutabili |
| Assegnazione/coda | PASS: nuovo utente senza owner UNASSIGNED; owner B preservato su link A; codice invalido REVIEW |
| Riservatezza e revoca | PASS: altri account/operatori e admin senza Advisor negati; sessione/grant revocati negati; niente accesso diretto privato o USAGE public generale |
| Confine Evento condiviso | PASS: definizioni/ACL di tre ingressi invariati, provider ancora highlevel; M5 non installata |
| Gate OFF | PASS: letture/creazioni negate, cinque snapshot conservati; fixture arrestata al termine |
| Hub filtri MVP | **5 test PASS**, 17 assert; build PASS, formattazione PASS, lint modifiche 0 errori/1 warning cleanup già ereditato |
| Hub typecheck globale | **FAIL 86**, stessi errori precedenti; zero nei tre file interessati. I tre errori iniziali nel nuovo test erano una fixture optional mal tipizzata, corretta senza cambiare assert |
| Preflight 5D originale | **4/4 PASS**, assert invariati |
| Verificatore beta esistente | **8/8 PASS**, assert invariati, trasporto sintetico senza rete esterna |
| Radar d'Impresa e portale | Byte-identici alla baseline; risultati precedenti riutilizzati, nessuna nuova campagna generale |
| Browser reale / Supabase Auth / SMTP / OTP reali | **NOT RUN** in questa attività; build e fixture non sostituiscono questi controlli |
| ETag HTML 304 e Vary: Accept | **FAIL aperti ereditati**, non corretti né dichiarati risolti |

Evidenze: [native](mvp-semplificato-evidence/native.json), [esiti](mvp-semplificato-evidence/checks.json), [hash dei log](mvp-semplificato-evidence/log-hashes.json).

È stato rilevato anche un FAIL già presente nella baseline: `verify-patrimonial-account-gates-5d.mjs` esegue sette controlli PASS e fallisce nell'ultimo confronto byte della Proxy contro il commit `15560b...`, precedente al gate beta e agli header cache approvati. Riprodotto sul checkout beta originale con lo stesso esito. **Test e assert non modificati.** Il suo FAIL storico resta visibile; non è il preflight originale a quattro assert, che passa. [Evidenza comparativa](mvp-semplificato-evidence/historical-verifier.json).

La nuova sonda locale PostgREST ha inizialmente atteso un codice sbagliato per il diniego anonimo: il gateway restituisce 401/42501, non 403. Corretto soltanto quel contratto della nuova sonda e atteso il caricamento effettivo della cache. Le otto prove funzionali sono poi PASS. Nessun risultato umano/provider inventato.

Rehearsal ripetibile esclusivamente in database sintetico dedicato e su loopback:

```powershell
node --no-warnings --experimental-strip-types scripts/verify-patrimonial-radar-mvp.mjs --network-platform=../platform --pg-module=../../fase-5a/tools/node_modules/pg/lib/index.js --local-config=../tools/local-test-access.json --evidence=../native-result.json
```

Riusa baseline, ACL reali riprodotti e fixture del motore precedenti; non usa servizi Auth/email reali. Il database è vincolato a `127.0.0.1:15449/radar_5d_test`, PostgREST a `127.0.0.1:15450`. Il bootstrap locale fuori dai repository non è un componente distribuibile o un prerequisito di produzione.

## 7. File effettivamente modificati

- Platform: soltanto `packages/database/pending/20261027092211_patrimonial_radar_handoff_metadata.sql` — due commenti e dipendenze del preflight; corpo e ACL identici.
- Hub: `src/components/patrimonial/SimplePatrimonialRadar.tsx`, `src/lib/patrimonial-radar-view.ts`, `src/lib/patrimonial-radar-view.test.ts` — tre stati, indicazioni esplicite e apertura report; test dei casi realmente distinti.
- Website: `scripts/verify-patrimonial-radar-mvp.mjs`, questo report e i JSON di evidenza associati. Nessuna modifica al runtime o ai test precedenti.
- Architetti: nessuno.

Non eliminato il codice storico M5 o i rami inattivi soltanto per diminuire il conteggio dei file. **Eliminati dal piano di attivazione** la migration M5, i suoi adattamenti condivisi e qualsiasi dipendenza da iscrizione Evento v2/HighLevel; **ridotti nella gestione** i filtri ai tre stati richiesti. Nessun nuovo broker, container, progetto o servizio a pagamento.

## 8. Operazioni minime per pubblicare — non eseguite

Destinazioni esistenti, nessuna Preview:

| Servizio | Destinazione |
| --- | --- |
| Supabase | `pmkyeqrfkunypfkbjnyg` |
| Website | `prj_EWAOevQbWZqhKddTuD6l8GWSIYHM`, horyzon.it |
| Hub | `prj_RltJaUziQT9bOGVwWQueRb2KfEjv`, hub.horyzon.it |
| Architetti | `prj_aDUoQsf1VpNjNXYyuk4JJ0SPtfg7`, architetti.horyzon.it |

Team Vercel verificato nella preparazione beta: horyzon-consulting, `team_LsT2CKLXy6aIHfeH9SPKpDIz`. Rileggere main/alias/progetti prima della finestra per non sovrascrivere rilasci concorrenti.

1. Completare le verifiche reali rimaste aperte: backup recuperabile e restore attestato, catalogo/fingerprint/ACL, configurazione Auth/SMTP/template OTP, elenco esatto dei collaboratori e staff con permessi nominativi/Advisor, privacy e retention. Non inventare identità o cambiare impostazioni Auth condivise senza un diff approvato. Restano da gestire formalmente i FAIL HTTP e Hub sopra.
2. Dopo autorizzazione specifica, applicare **solo i cinque file/hash del §4**, nell'ordine indicato, con gate OFF e controlli dopo ogni file. Nessun runner indiscriminato, M5, trigger Evento globale o nuova infrastruttura.
3. Dopo autorizzazione, predisporre HMAC dedicato server/DB con la derivazione esistente, seed account_gate enabled=false e soli permessi nominativi necessari. Nessun segreto in Git/chat/browser o argomenti CLI. Non cambiare HighLevel.
4. Configurare soltanto Production Website: ACCOUNT_ENABLED, BETA_ENABLED, ACCOUNT_CONTEXT=website-beta, ACCOUNT_ORIGIN=https://horyzon.it, ACCOUNT_SUPABASE_URL del progetto, BETA_EMAILS, PUBLISHABLE_KEY e IDENTITY_SECRET, tutti con prefisso PATRIMONIAL_RADAR_. Nessuna variabile Shared. I flag true vanno nell'artefatto approvato, mentre il gate SQL resta false fino alla verifica dei tre deployment.
5. Un solo rilascio coordinato degli artefatti Hub/Architetti/Website del §1 sugli attuali progetti. Il portale invariato va riutilizzato; nessun deployment Platform necessario. Nessun push o merge richiesto dal piano.
6. Dopo READY e verifica degli artefatti/origini, autorizzare separatamente l'apertura del gate SQL e il primo OTP verso la casella aziendale approvata. Collaboratori con dati patrimoniali inventati: OTP, compilazione, salvataggio/storico, report Hub/portale, P1/coda e diniego Advisor. Nessuna comunicazione commerciale.

Arresto immediato già esistente:

```sql
update patrimonial_radar_private.account_gate set enabled=false where singleton;
```

Nega operazioni Radar anche sui deployment già creati e chiude anche le letture Hub/Advisor; non cancella report, contatti o storico. Il flag Vercel false vale per i futuri artefatti, non sostituisce questo arresto immediato.

Rollback applicativo predisposto nel piano precedente: Website `dpl_Cnj429btQQebBFEdQ8re36cNyqEG`, Hub `dpl_5MoFbRm3gcemNmXtRXoD5kpNkat2`, Architetti `dpl_DrHeCtfwKSSeFSJKtBvuC92dQ1gc`, da riconfermare come predecessori prima del rilascio. Prima gate OFF, poi rollback autorizzato; nessun DROP, cancellazione assessment o restore globale come rollback ordinario. M2 mantiene un impatto condiviso anche senza M5: backup e responsabilità DB restano indispensabili.

**Esito: MVP locale consolidato e più semplice da attivare; NO-GO operativo finché i prerequisiti reali e le autorizzazioni non sono completati.** Nessun push, merge, deployment, migration remota, modifica Auth, secret reale, grant reale, email o modifica di produzione eseguito. L'attività termina qui, senza nuove fasi di progettazione.
