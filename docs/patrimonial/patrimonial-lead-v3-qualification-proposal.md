# Patrimonial lead-v3 qualification — proposta, non implementata

18 ottobre 2026. `patrimonial-lead-v2`, frontend ed endpoint restano invariati. Nessun contratto/endpoint v3 è attivo. Questa proposta risolve in futuro il gap dei segnali oggi serializzati in message, senza parser retroattivi.

## Payload proposto

```ts
type QualificationV1 = {
  schemaVersion: 1;
  profile: AudienceProfile | null;
  maturityLevel: 'BASE' | 'RISPARMIO' | 'INVESTIMENTI' | 'DIVERSIFICAZIONE' | null;
  consultationRequested: boolean | null;
  instruments: Array<{ instrumentId: InstrumentId; knowledgeLevel: KnowledgeLevel }>;
};
// Nuovo discriminante pubblico da validare separatamente:
// contractVersion: 'patrimonial-lead-v3'; qualification: QualificationV1
```

Le etichette maturity sono proposte, non una rimappatura automatica delle quattro scene correnti: tassonomia da approvare e versionare. AudienceProfile/InstrumentId/KnowledgeLevel saranno enum allowlist server in coerenza con il contenuto pubblicato, senza campi arbitrari. Profilo pubblico legacy e quello preciso devono avere un mapping esplicito. Non usare il profilo per inferire patrimonio o idoneità.

NULL significa non osservato/non chiesto; false richiede una risposta esplicita, non assenza di una frase. instruments vuoto significa nessuna selezione osservata, non incompetenza. Niente importi dei calcolatori, testo libero, recapiti o nuovi consensi dentro qualification.

## Validazione e compatibilità da progettare prima dell'attivazione

- Discriminated union v2/v3 con validator separato, unknown fields rifiutati, UUID/requestId e consensi esistenti preservati. Limite strumenti pari al catalogo versionato, niente duplicati, enum/lunghezze/dimensione payload limitati.
- Canonicalizzazione idempotente che includa ogni nuovo campo e schemaVersion, ordini instrumentId e rappresenti NULL/false distintamente. Test same key/same body replay, key diversa/variante, conflitto stesso requestId con qualification cambiata e ACK perso.
- Ricevuta browser compatibile e migrazione esplicita del client in una fase autorizzata; nessun fallback silenzioso di v3 a v2 e nessuna ridenominazione v2.
- Evoluzione schema snapshot versionata per maturity/consultation/strumenti; eventi riferiti allo snapshot, niente note CRM come fonte canonica. Gli snapshot P1 storici rimangono immutabili/NULL.
- Fonte del segnale dichiarata, captured_at server, minimizzazione, accesso/retention da approvare. UTM future preferibilmente codici di campagne curati, evitando copia libera nelle dimensioni analitiche.

## Separazione dagli effetti operativi

consultationRequested true è una richiesta dichiarata: non crea da sola booking, appuntamento confermato, messaggio o conversione. Il dominio risolto conserva prerequisiti/evidence/actor e consensi per ogni transizione. Nessun collegamento implicito con current_operator_id → owner_ref. L'eventuale owner-sync P2 deve seguire l'outbox esistente e verificare mapping utente/location, permessi e reconciliation.

Prima di implementare: approvare tassonomie e finalità; aggiornare validator/canonicalizzazione/contratto/fixture; verificare compatibilità v2 e mapping CRM separato; solo dopo rollout esplicito. Nessuna di queste attivazioni fa parte di P1.
