# Patrimonial owner sync — P2B v1

18 ottobre 2026. HEAD iniziale dfd2e7b7b7d4af301c0429bd2ba75fa4c12b4739, branch feat/patrimonial-pilot-funnels. **Code-complete locale/mock; non attivato live.** Nessun contatto/opportunity creato o aggiornato, nessuna migrazione/SQL remota, env o scope modificato. Nessun deploy manuale o produzione, merge/main push. P1 resta non applicata al remoto.

## Architettura e gate

Il percorso server è assignment → remote_user_ref → runtime user verification → lookup opportunity ID → confronto owner → dispatch marker persistito → PUT assignedTo → GET indipendente → checkpoint CAS locale.

- patrimonial-owner-operations.ts: effect e payload senza PII, key SHA256 deterministica per intent/assignment/revisioni/target/checkpoint.
- patrimonial-owner-provider.ts: readRemoteUser, getOpportunity, updateOpportunityOwner; nessuna create, full update, stage/status/value/customFields write.
- patrimonial-owner-sync.ts: runPatrimonialOwnerSyncOnce, una operation per invocazione. Nessun endpoint pubblico, scheduler o attivazione automatica.
- Adapter Supabase e journal esistenti; nessuna seconda coda o repository in memoria di produzione.

I quattro gate obbligatori sono PATRIMONIAL_V2_ENABLED, PATRIMONIAL_ASSIGNMENTS_ENABLED, PATRIMONIAL_CRM_WRITE_ENABLED, PATRIMONIAL_OWNER_SYNC_ENABLED. Tutti default false. opportunityWrite non è richiesto e non abilita il percorso owner. Il provider ricontrolla token/location immutati e gate a ogni HTTP; il worker li ricontrolla prima della dispatch e dopo read-back.

La proof server del binding è assente di default: runtimeTokenVerified, verifiedLocationId, versione v3, usersRead, opportunityOwnerRead, opportunityOwnerWrite, ownerOnlyUpdate, nullableAssignedTo. Non è esposta al client né dedotta dall'audit MCP. La granularità owner non modifica capability globali. Generic search/create/update opportunity restano stub CONFIG, byte-identici. Il codice legacy sync è immutato salvo kinds dei claim contatto.

## Outbox, assignment e recupero

Effect ASSIGN_OPPORTUNITY_OWNER nella stessa patrimonial_outbox_operations, con identity lock per intent e operation_key univoca. L'operation contiene intent/assignment/operator ID interni, revisione proiezione operator, revisione assignment, revisione registro operator, remote_user_ref target, expected owner_ref, owner checkpoint revision, businessKey e timestamp. Non contiene nome, email, telefono o foto utente.

assignProspect/reassignProspect (anche le assegnazioni batch) aggiungono il comando ownerOperation allo stesso piano atomico solo con assignments + ownerSync true e mapping presente. L'enqueue non certifica l'utente. Mapping assente → LOCAL_ASSIGNED / REMOTE_OWNER_UNMAPPED; flag false → nessun enqueue. Un errore di enqueue annulla anche l'assignment.

requestOwnerSync è un comando server ADMIN/SYSTEM con commandKey e expected operatorRevision; nessuna route pubblica. Serve a mapping/abilitazione successivi e recovery. Replay della stessa commandKey restituisce ricevuta; stessa operationKey non duplica righe. Una nuova richiesta trusted può riaprire MANUAL_REVIEW/REJECTED dello stesso target con fence incrementata e audit; se una dispatch potrebbe essere avvenuta conserva la necessità di reconciliation. Un checkpoint cambiato genera una nuova versione deterministica del piano, non altera retroattivamente la precedente.

CRM claim: solo SYNC_REQUEST, RESOLVE_CONTACT, UPSERT_CONTACT, ADD_TAGS, ADD_NOTE. Owner claim: solo ASSIGN_OPPORTUNITY_OWNER; il default SQL resta contatti, i kind sconosciuti o owner mescolato a contatti sono rifiutati. Il comando journal claimOwnerOperations esiste solo in P2B: con SQL precedente fallisce e rollbacka, invece di lasciare ignorare kinds al vecchio claim. Il worker cerca prima RECONCILE_REQUIRED, poi pending/retry/lease scadute. Lease, token, versione, expiry server e limite cinque tentativi sono quelli dell'outbox esistente.

## Verifica utente e opportunity

UNMAPPED quando il ref manca; MAPPED_UNVERIFIED finché il runtime non restituisce exact ID, deleted=false e membership nella Location canonica; solo allora MAPPED_VERIFIED. La normalizzazione conserva soltanto remoteUserId, locationIds, deleted, role/type nullable. Non logga body o PII. Utente mancante/deleted/membership errata/stato omesso → HOLD/MANUAL_REVIEW, nessun altro operatore scelto.

GET /users/:id e GET /opportunities/:id usano il token runtime canonico. Il contratto GET user pubblico non mostra deleted; il decoder richiede comunque disponibilità esplicita: prima del live deve essere dimostrata con quel token/endpoint. Nessun default permissivo.

Opportunity senza intent.remote.id → HOLD OPPORTUNITY_NOT_READY, nessuna search/create. Si confrontano ID, Location, contatto, pipeline canonica e cache, business identity hz_intent_key se presente. Marker version/updatedAt/dateUpdated stringa eventualmente normalizzato, senza fingere CAS. assignedTo deve essere stringa non vuota oppure null solo con proof nullable esplicita; omissione/empty/malformed falliscono. Due letture limitano drift prima della dispatch; PUT contiene ESCLUSIVAMENTE assignedTo=remote_user_ref verificato. Risposta PUT mai usata come read-back.

## Stale, drift e concorrenza

Prima del write si rileggono assignment attiva, current_operator_id, operator e mapping, tutte le revisioni, stato active, checkpoint e business identity. Si rinnova lease e si ripete il GET utente. authorizeOwnerWrite verifica ancora il contesto nel journal e persiste effectMayHaveCommitted=true PRIMA dell'HTTP.

Reassign/release chiudono atomicamente le vecchie operation non ancora dispatched come SYNCED/outcome SUPERSEDED, con evento e fence incrementata. X pending → reassign Y → nessun PUT X, solo Y eleggibile. Un predecessore forse dispatched diventa MANUAL_REVIEW/STALE_UNCERTAIN: blocca il successore per quell'intent finché una gestione trusted non risolve l'incertezza. Non si ricicla una vecchia lease né si cancella la traccia. Se il vecchio worker è già partito, le sue mutazioni DB falliscono col fencing.

Remote target già presente → nessun PUT, checkpoint dalla lettura verificata. Remote uguale al checkpoint (incluso null/null con decoder autorizzato) → piano possibile. Terzo owner o checkpoint già target ma remoto diverso → REMOTE_CHANGED/MANUAL_REVIEW, nessuna sovrascrittura. Stage/status/business revision restano fuori dall'owner write.

## Timeout e checkpoint

Qualunque errore dopo la dispatch boundary, 5xx/timeout/network o read-back fallita/mismatch → RECONCILE_REQUIRED; mai retry PUT immediato. Il prossimo tentativo legge prima: target → checkpoint senza secondo PUT; owner precedente → REPLAN persistito, solo una futura invocazione può rileggere e ripianificare; terzo owner → manual review. Persa lease o ACK del checkpoint → CHECKPOINT_UNCONFIRMED, senza scrittura ripetuta; il marker persistito guida il recovery. Non si mantiene un lock DB durante HTTP.

Il finish CONFIRMED verifica atomicamente lease/fence, assignment/registry/target e owner_checkpoint_revision attesa, identity della lettura e owner target. Aggiorna SQL owner_ref + record.ownerId + cache remote.assignedTo + evidenza minima con observedAt/operationId e incrementa SOLO owner_checkpoint_revision. Non modifica current_operator_id, operator_revision, stage, status o business revision. Il salvataggio legacy rifiuta ownerId obsoleto dopo un checkpoint e preserva i check remote esistenti. Se il contesto cambia durante l'HTTP non può attestare falsamente successo.

La service-role è un confine trusted: le prove passate a finish sono prodotte dal worker; SQL non può certificare crittograficamente una risposta HTTP. Nessun anon/authenticated può invocare i nuovi helper o scrivere le tabelle.

## Race residua e clear

**READ → WRITE → READ-BACK, senza CAS remoto verificato.** Nessun expectedProviderVersion, If-Match o atomicità HighLevel inventata. Una modifica umana tra l'ultimo GET e il PUT può ancora essere sovrascritta; anche assignment/flag possono cambiare tra l'ultimo controllo locale e l'HTTP. I controlli/fencing minimizzano la finestra e impediscono checkpoint falsi, ma non annullano un effetto remoto già partito. Prima del live questa limitazione deve essere accettata o mitigata ulteriormente (provider CAS provata/coordinamento operativo). Letture dopo timeout non provano che un vecchio HTTP non possa terminare ancora più tardi; nessun retry nello stesso giro, recovery controllato e rischio residuo da accettare.

OWNER CLEAR = UNSUPPORTED / UNVERIFIED. Nessun assignedTo:null, stringa vuota o omissione come clear. releaseProspect è solo locale. Non si assume equivalenza tra null/empty/missing.

## Migration e verifica locale

Nuova migration CLI: 20261018163245_patrimonial_owner_sync.sql. Estende CHECK effect_type, aggiunge indice owner, filtro claim, checkpoint revision/evidence e helper/dispatcher INVOKER con execute solo service_role. Nessun seed. FORCE RLS/grant service-role delle tabelle ereditati e verificati; migration precedenti immutate. **Non applicata remoto.** Anche 20261018094926_patrimonial_assignment_management.sql NON applicata remoto.

npm run test:patrimonial-owner-sync copre A–AE (31 casi richiesti), SQL reale in PostgreSQL WASM effimero con quattro migration, adapter produzione, HTTP mock, claim isolation, concorrenza di due worker, lease scaduta/fence, read-back separata, stale X→Y, PII e privilegi. Extra: mapping states, missing/empty/null decoder, identity mismatch, utente non interpretabile, mancanza opportunity, riassegnazione tra read e dispatch, recovery esplicito. PGlite verifica interleaving e funzioni native; non è uno stress test di cluster distribuito. Zero chiamate esterne.

Verifiche finali PASS: owner-sync A–AE, owner-readiness, assignment-management, persistence, CRM, opportunities, remote-mapping; typecheck senza emissione con tmp esclusa solo in memoria; ESLint file toccati a zero warning; git diff --check. Presentation prima/dopo: PRE-EXISTING BASELINE FAILURE con firme identiche. Evento: Protected baseline changed: src/app/(patrimonial-pilot)/benessere-patrimoniale/percorso-architetto-patrimoniale/page.tsx. Architetto: No behavioral change: src/content/patrimonial-architect-session.ts. Nessuna modifica UI, fix overflow Evento 4px, repin test o inclusione di tmp/Radar.

## Blocchi di attivazione e smoke futuro — non eseguito

Restano necessari: autorizzazione e applicazione P1 + P2B, prova token runtime/scopes/Location e shape decoder (incluso deleted e assignedTo), opportunity sintetica identificata univocamente, round-trip owner autorizzato, gestione/accettazione race/CAS. Nessuna attivazione tramite questo commit.

Futuro smoke, con autorizzazione separata e soli dati sintetici:

1. Creare/identificare prospect sintetico e una sola opportunity nelle pipeline patrimoniali, registrando identity.
2. Associare operatore interno a user HighLevel VERIFIED con credenziale runtime.
3. Assegnare localmente, verificare una operation, eseguire UNA owner write.
4. Rileggere assignedTo; verificare owner_ref/ownerId/checkpoint e invarianti business.
5. Ripetere idempotentemente; verificare assenza di operation/write duplicate.
6. Se esiste altro user controllato, riassegnare, rileggere e confermare checkpoint.
7. Pulire solo contatto/opportunity sintetici HighLevel; preservare audit locale.

Riferimenti provider e nuova evidenza esterna: [readiness](patrimonial-owner-sync-readiness-v1.md). Nessuna connessione live o credenziale necessaria per le verifiche locali.
