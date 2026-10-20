# Architect Candidate Intake — roadmap v1

20 ottobre 2026. Branch `feat/patrimonial-pilot-funnels`.

Obiettivo aggiornato: il Percorso Architetto Patrimoniale non è più una sessione temporanea da prenotare. È una candidatura evergreen che può ricevere traffico da Indeed, altri job board, campagne o link diretti. La persona conosce il ruolo sulla landing, guarda i contenuti introduttivi, invia la candidatura e viene poi gestita in HighLevel lungo selezione, follow-up, contenuti, formazione, incontri e colloquio.

Il funnel Evento Benessere Patrimoniale resta separato e non viene trasformato in recruitment.

## Stato applicato subito

Sul branch sono già state riallineate le parti che non richiedono nuovi servizi o scritture CRM:

- landing: candidatura sempre aperta, senza countdown/posti/sessione;
- sezione 09: da “presentazione da prenotare” a contenuto da conoscere prima della candidatura;
- sezione finale: candidatura come passaggio successivo, non prenotazione;
- form: linguaggio recruitment-native, recapiti + profilo in due passaggi;
- thank-you: candidatura registrata, valutazione umana e nessun ingresso automatico;
- UTM già preservate; `utm_source=indeed` può distinguere traffico Indeed senza un nuovo campo pubblico;
- nota CRM pilot: `Tipo pratica: candidatura` e `Origine candidatura`;
- nota CRM durable v2 già predisposta con la stessa semantica;
- gate fail-closed `PATRIMONIAL_ARCHITECT_CANDIDATE_V2_ENABLED`: default false. Permette il futuro cutover dal pilot diretto al ledger durable senza cambiare di nuovo la UI.

Il form resta intenzionalmente sul percorso pilot corrente finché il cutover durable non è completo.

## Stato reale HighLevel letto il 20 ottobre 2026

Pipeline esistente `Percorso Architetto Patrimoniale`:

1. Nuovo interesse
2. Presentazione da prenotare
3. Presentazione prenotata
4. Da qualificare
5. Colloquio da fissare
6. Colloquio fissato
7. Valutazione e prossimo passo
8. Percorso avviato
9. Architetto Patrimoniale attivato
10. Chiuso senza attivazione

La struttura dal punto 4 in avanti è ancora coerente con il nuovo progetto. I primi tre stage hanno semantica legata alla vecchia sessione e vanno ridisegnati.

Workflow HighLevel disponibili nella Location: **0**.

Custom fields: esistono già UTM, source, profilo professionale, esperienza, obiettivo, disponibilità, motivazione, colloquio, idoneità e altri campi patrimoniali. **Non esiste ancora un campo CV/curriculum**.

## Architettura obiettivo

`Indeed/job board/campagna → landing evergreen → contenuti introduttivi → candidatura → CV privato → durable intake → unico contatto HighLevel → una opportunity Architetto → workflow candidate follow-up → colloquio/formazione → avvio/attivazione → P3/P4 analytics`

Una persona rimane un solo contatto HighLevel. Eventuali partecipazioni all'evento, confronti patrimoniali e candidatura Architetto restano opportunity/pratiche separate.

## Fase A — CV e candidatura completa

Da implementare prima del cutover.

### A1. File intake sicuro

Non aggiungere un semplice input file al form finché il backend non è pronto.

Proposta:

1. il client prepara il requestId già usato dal contratto durable;
2. la richiesta testuale viene acquisita atomicamente;
3. dopo la receipt, un endpoint separato riceve il CV associato allo stesso requestId;
4. il file viene salvato in storage privato, mai con URL pubblico;
5. il ledger registra solo riferimento, digest, mime/estensione, size e stato tecnico;
6. il worker, dopo identity resolution, collega il documento al contatto HighLevel;
7. retry idempotente, nessun doppio file e nessun overwrite ambiguo.

Allowlist iniziale suggerita: PDF, DOC, DOCX. Limite operativo suggerito: 10 MB, da confermare. Nome file del candidato non va usato come chiave di identità.

### A2. HighLevel CV

Creare un custom field contatto dedicato, preferibilmente FILE_UPLOAD:

`HZ | Curriculum candidato`

Prima di creare il campo vanno verificati schema API e comportamento upload/read-back nella Location. Nessun campo inventato o creato automaticamente durante il submit pubblico.

### A3. Stati documento

Minimo:

- `NOT_RECEIVED`
- `RECEIVED`
- `REMOTE_SYNC_PENDING`
- `REMOTE_SYNCED`
- `MANUAL_REVIEW`

La candidatura può esistere senza CV solo come stato incompleto esplicito; non va persa né duplicata.

## Fase B — Cutover al durable intake

Oggi la landing usa ancora, per default:

`form → /api/public-leads → HighLevel contact upsert → tags → note`

Questo è utile come pilot, ma non crea la pratica/opportunity con tutte le garanzie P1/P2/P3.

Il cutover deve diventare:

`form → patrimonial-lead-v2 (o sua estensione attachment-safe) → Supabase request ledger → identity worker → contact → resolved Architetto intent → opportunity sync → assignment/owner sync → P3 tracking`

Prerequisiti:

- Production/Preview durable-store env corretti;
- provider HighLevel contact bindings verificati;
- implementazione reale di search/create/update opportunity generica, oggi ancora stub;
- worker/scheduler operativo;
- smoke sintetico candidatura completa;
- solo dopo: `PATRIMONIAL_ARCHITECT_CANDIDATE_V2_ENABLED=true`.

Non estendere il vecchio pilot con nuove write dirette se il durable path può diventare la sorgente canonica.

## Fase C — Pipeline recruitment

Non usare gli stage per rappresentare ogni email/video inviato: pipeline = stato della candidatura; workflow = comunicazioni/contenuti.

Proposta di semantica per i dieci stage esistenti, mantenendo gli stessi ID per evitare nuova struttura:

| Codice | Nuova semantica proposta |
| --- | --- |
| A01 | Nuova candidatura |
| A02 | Da esaminare |
| A03 | Pre-qualificata |
| A04 | Da qualificare |
| A05 | Colloquio da fissare |
| A06 | Colloquio fissato |
| A07 | Valutazione e prossimo passo |
| A08 | Percorso avviato |
| A09 | Architetto Patrimoniale attivato |
| A10 | Chiuso senza attivazione |

A01–A03 richiedono rinomina/aggiornamento HighLevel e allineamento delle transizioni dominio. A04–A10 possono essere mantenuti quasi invariati.

Il CV e lo stato dei contenuti non devono determinare da soli uno stage senza una regola esplicita.

## Fase D — Workflow HighLevel candidature

Attualmente non esiste nessun workflow nella Location.

Workflow minimo suggerito:

### W1 — Candidatura ricevuta

Trigger: opportunity entra in A01.

- conferma ricezione;
- nessuna promessa di accettazione;
- task interno/assegnazione al responsabile;
- eventuale reminder interno se non presa in carico.

### W2 — Pre-qualificata

Trigger: passaggio ad A03.

- invio contenuto/video successivo;
- CTA al prossimo step;
- reminder se non completato;
- uscita automatica dal workflow se candidatura chiusa.

### W3 — Colloquio

Trigger: A05/A06.

- link prenotazione o conferma incontro;
- reminder;
- show/no-show;
- follow-up dopo esito.

### W4 — Percorso avviato

Trigger: A08.

- sequenza formazione;
- lezioni/video/materiali;
- incontri previsti;
- avanzamento non basato soltanto sull'apertura di un'email.

Contenuti, tempi, mittente, canali e calendari devono essere definiti prima della configurazione definitiva.

## Fase E — Sorgente Indeed e job board

Nessuna integrazione Indeed è necessaria per iniziare.

Link consigliato nell'annuncio:

`/benessere-patrimoniale/percorso-architetto-patrimoniale?utm_source=indeed&utm_medium=job_board&utm_campaign=architetto_patrimoniale`

Il sistema già conserva UTM source/medium/campaign. La nota CRM pilot ora mostra anche `Origine candidatura`.

Futuro: tassonomia server curata per evitare che valori UTM liberi diventino categorie analitiche incontrollate.

## Fase F — Metriche

Separare acquisition, recruitment e performance operatore.

### Acquisition

- visite landing;
- origine/utm;
- video start / completion quando i video saranno realmente integrati;
- form start;
- candidatura ricevuta;
- CV ricevuto;
- candidatura completa.

### Recruitment

- candidatura → presa in carico;
- candidatura → pre-qualifica;
- colloquio fissato;
- show/no-show colloquio;
- idonea/non idonea/ritirata;
- percorso avviato;
- Architetto attivato;
- tempo mediano fra i passaggi.

### Operatore

P3 resta il livello corretto dopo l'assegnazione: ownership, first contact, booking, show/no-show, follow-up, stage changes, won/lost. Mostrare sempre N + percentuali + tempi, non un singolo “punteggio operatore”.

Applicazione ricevuta e CV sono fatti pre-assignment: non vanno forzati dentro il ledger P3 esistente che richiede assignment/operator. P4 combinerà request/document facts e P3.

## Fase G — Privacy e retention

La finalità “gestione candidatura/selezione” deve restare distinta dal marketing.

- comunicazioni necessarie alla candidatura non dipendono dal consenso marketing;
- marketing facoltativo resta separato;
- CV accessibile solo server/team autorizzato;
- definire retention candidature non proseguite e documenti;
- niente CV in note CRM o URL pubblici;
- audit del download/accesso se il CV viene conservato anche fuori HighLevel.

## Decisioni necessarie prima delle fasi operative successive

1. formati e limite CV;
2. retention CV/candidature chiuse;
3. contenuti/video esatti e loro ordine;
4. quali passaggi richiedono azione umana;
5. calendario/owner dei colloqui;
6. definizione esatta di “pre-qualificata”, “percorso avviato” e “Architetto attivato”;
7. email/SMS/WhatsApp da usare e mittenti;
8. eventuale rinomina definitiva A01–A03;
9. se il CV deve restare anche in Supabase o essere eliminato dopo conferma HighLevel.

## Stato finale di questa fase

READY:
- landing evergreen;
- candidatura copy;
- UTM/Indeed attribution di base;
- HighLevel contact/tag/note pilot;
- pipeline esistente;
- durable architecture P1/P2/P3;
- gate per cutover v2.

NOT READY:
- CV;
- opportunity creation dal nuovo intake;
- workflow HighLevel;
- contenuti/reminder;
- live candidate metrics end-to-end;
- Production cutover.

Nessuna modifica a main/Production o ai workflow HighLevel è compresa in questa fase.
