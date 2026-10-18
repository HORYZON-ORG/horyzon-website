# Patrimonial owner sync readiness — P2A/P2B v1

18 ottobre 2026. Repository HORYZON-ORG/horyzon-website, branch feat/patrimonial-pilot-funnels. P2B parte da dfd2e7b7b7d4af301c0429bd2ba75fa4c12b4739. **Implementazione locale autorizzata; attivazione remota BLOCKED.** P1 e P2B non applicate al remoto. Nessuna write HighLevel, remote SQL, modifica env/token/scope o attivazione flag.

## Provenienza

- E1: audit esterno reale riportato dall'utente dopo P2A. Users inventory, Location identity e membership di almeno un utente sono VERIFIED. Gli scope users.readonly e locations.readonly funzionano nella connessione dell'audit. Non abbiamo ripetuto quelle chiamate e non assumiamo che il token dell'app coincida.
- E2: codice locale e contratto pubblico ufficiale HighLevel. Catalogo canonico in patrimonial-highlevel-config.ts; nessun nuovo ID reale, nome o email inserito.
- E3: test locali P2A del planner e P2B del worker/adapter/SQL/HTTP simulato. Non certificano risposte o permessi live.

Il precedente 401 Users di P2A è evidenza storica superata nell'audit esterno. Rimane da provare la credenziale runtime. Il planner P2A è immutato e continua ad avere executionAllowed=false; il nuovo esecutore è un modulo server separato.

## Matrice aggiornata

| Capability | Stato | Evidenza e limite |
| --- | --- | --- |
| Connessione esterna HighLevel | VERIFIED | E1, letture reali; non dimostra token app |
| Location identity | VERIFIED | E1, sub-account Horyzon corretto; nessun ID copiato nel repo |
| Pipelines/stages read | VERIFIED | E1, tre pipeline; E2 catalogo canonico |
| Users inventory | VERIFIED | E1: id, deleted, role/type, roles.locationIds presenti |
| User/location membership | VERIFIED | E1: almeno un utente appartiene alla Location corretta; worker deve verificare ogni target corrente |
| users.readonly / locations.readonly esterni | VERIFIED | E1; capability runtime restano false senza proof dedicata |
| Opportunity search | VERIFIED | E1: endpoint riuscito, **0 righe**; owner worker non usa search |
| Opportunity non vuota / GET runtime | UNVERIFIED | Nessuna risposta live con identity completa; decoder dedicato implementato e testato solo mock |
| assignedTo live response | UNVERIFIED | String/null/missing non provati live; decoder distingue i tre casi |
| Update assignedTo schema | VERIFIED | E1 ed E2; schema non prova permesso né successo live |
| Owner write permission runtime | UNVERIFIED | Nessuna write eseguita; binding senza proof non disponibile |
| Owner round-trip / read-back | UNVERIFIED | Solo test E3, nessuna opportunity sintetica creata |
| Timeout reconciliation live | UNVERIFIED | E3 prova policy read-first e fencing; comportamento provider live ignoto |
| Owner clear | UNVERIFIED / UNSUPPORTED | Nessuna null/empty/omitted write consentita |
| Utente deleted/assente/membership persa | PARTIALLY_VERIFIED | E1 espone deleted e membership; E3 prova HOLD, non comportamento remoto di un owner già assegnato |
| Search pagination completeness | UNVERIFIED | Zero righe non prova paginazione; worker usa solo lookup ID |
| Provider conditional update/CAS | UNVERIFIED | Nessuna CAS documentata/provata; marker non usato come precondizione HTTP |

## Confini runtime

Il provider owner è distinto da PatrimonialHighLevelProvider. Gli stub searchOpportunities/createOpportunity/updateOpportunity restano CONFIG e byte-identici. Non si promuove opportunitiesWrite globale. Il legacy sync resta identico salvo il filtro esplicito dei cinque effect contatto al claim; nessun owner locale viene introdotto in quel percorso.

Il nuovo provider richiede proof server esplicita riferita al token runtime corrente e Location canonica. Senza proof, capability granulari false. Il GET utente richiede deleted boolean e roles.locationIds; omissione dello stato, anche se ammessa da una risposta API, produce HOLD. Il GET user pubblico documentato non mostra deleted: la compatibilità della risposta runtime è dunque un blocco esplicito, non risolta assumendo active=true.

Il PUT dedicato invia soltanto assignedTo. Il body obbligatorio dello schema ufficiale non rende obbligatori gli altri singoli campi. Riferimenti verificati il 18 ottobre 2026: [update opportunity](https://marketplace.gohighlevel.com/docs/ghl/opportunities/update-opportunity/index.html), [get opportunity](https://marketplace.gohighlevel.com/docs/ghl/opportunities/get-opportunity/index.html), [get user](https://marketplace.gohighlevel.com/docs/ghl/users/get-user/index.html), [versioning](https://marketplace.gohighlevel.com/docs/Versioning/index.html). Il binding dedicato usa v3; non cambia il transport contatti esistente.

## Readiness e verifica

Owner-readiness 1–14 resta locale/puro. Owner-sync A–AE usa database PostgreSQL WASM effimero, quattro migration, adapter RPC produzione e HTTP sintetico; nessun dato reale, nessuna rete. I test mantengono byte-identici UI, asset, contratti pubblici, generic provider e tutte le migration precedenti. I vecchi controlli di immutabilità dei backend sono aggiornati solo per consentire l'implementazione P2B autorizzata; il legacy sync è confrontato esattamente tranne il filtro claim dichiarato.

Prima dello smoke remoto servono P1 + P2B applicate con autorizzazione separata, verifica del token runtime e relativi scope/decoder, una opportunity sintetica univoca, round-trip assignedTo autorizzato e accettazione/mitigazione della race residua. Nessuna di queste condizioni viene dichiarata soddisfatta dai mock. Il [documento P2B](patrimonial-owner-sync-p2b-v1.md) descrive implementazione e piano futuro.
