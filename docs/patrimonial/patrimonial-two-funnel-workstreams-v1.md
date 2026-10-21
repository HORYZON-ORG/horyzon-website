# Benessere Patrimoniale — two-funnel workstreams v1

20 ottobre 2026. Branch `feat/patrimonial-pilot-funnels`.

Da questo punto il progetto Benessere Patrimoniale è governato come **un core condiviso + due workstream separati**.

## Regola principale

I due funnel condividono infrastruttura e identità, ma **non condividono il processo business**.

- Workstream A — **Percorso Architetto Patrimoniale**: recruitment/candidatura evergreen.
- Workstream B — **Quello che le banche non dicono**: evento/partecipazione per edizione.

CV, selezione, formazione e attivazione professionale appartengono esclusivamente al Workstream A.
Edizione, capienza, iscrizione, presenza/no-show evento e follow-up post-evento appartengono esclusivamente al Workstream B.

## Fino a dove restano insieme

Il confine condiviso termina dopo l'acquisizione tecnica della persona/richiesta e la risoluzione dell'identità CRM.

Core condiviso:

1. stessa Location HighLevel;
2. un solo contatto HighLevel per persona risolta;
3. request ID / idempotenza;
4. validazione form e anti-abuso;
5. privacy evidence e marketing consent separato;
6. UTM/source attribution;
7. Supabase durable request ledger;
8. identity resolution NEW/REUSE/REVIEW;
9. contact create/reuse;
10. tag/note tecnici;
11. outbox, retry, lease, reconciliation;
12. owner/operator foundation riutilizzabile quando il singolo workstream ne ha bisogno;
13. P3 technical performance ledger e webhook infrastructure riutilizzabili per stage/status attribuibili;
14. noindex/nofollow, theme frame e isolamento SEO dei due funnel.

**Punto di separazione:** appena la richiesta è classificata in modo affidabile come `architect-path` oppure `patrimonial-event`, ogni fatto business successivo segue solo il proprio dominio.

## Workstream A — Percorso Architetto Patrimoniale

Dominio: candidatura e percorso professionale.

Dati/fatti esclusivi:

- CV/curriculum e relativo storage;
- profilo professionale;
- esperienza commerciale/relazionale;
- obiettivo professionale;
- disponibilità;
- motivazione candidatura;
- source job board/Indeed;
- stato candidatura;
- pre-qualifica;
- colloquio;
- idoneità;
- percorso di formazione;
- attivazione Architetto Patrimoniale.

Pipeline: `ARCHITECT_PATH / A01–A10`.

Workflow dedicati: conferma candidatura, contenuti/video, reminder candidatura, colloquio, formazione, incontri e onboarding.

Metriche dedicate: landing→candidatura, CV completion, pre-qualification, interview, show/no-show colloquio, path started, activation.

**Divieto:** nessun CV, stato candidatura o formazione deve essere scritto in Participation/Event Edition o usato per muovere E01–E05.

## Workstream B — Quello che le banche non dicono

Dominio: evento e partecipazione.

Dati/fatti esclusivi:

- event slug;
- edition ID;
- data/ora/fuso;
- capacità/accesso;
- registration status;
- conferma iscrizione;
- attendance;
- no-show/cancellazione;
- reminder evento;
- follow-up post-evento;
- eventuale richiesta esplicita di confronto individuale.

Pipeline relazione evento: `PATRIMONIAL_EVENT / E01–E05`.
Granularità per edizione: `Participation`.
Pipeline confronto eventuale: `PATRIMONIAL_CONSULTATION / C01–C05`.

Metriche dedicate: request→confirmed, attendance/show rate, no-show, follow-up, repeat edition participation, explicit consultation request.

**Divieto:** nessun CV, recruitment stage, idoneità professionale o formazione Architetto entra nel dominio Evento.

## Componenti che restano condivisi ma con payload discriminato

Il contratto `patrimonial-lead-v2` resta una union discriminata da `mode`.

Già oggi:

- `experience`, `goal`, `availability` sono ammessi solo per `architect-path`;
- `eventEditionId` è vietato per `architect-path` ed è semantica Evento;
- i profili ammessi sono distinti per funnel;
- tag HighLevel sono distinti;
- source path è verificato contro il funnel;
- opportunity pipeline viene risolta dal dominio e non dal browser.

Quando sarà introdotto il CV, il suo riferimento/document contract deve essere **architect-only** e il parser Evento deve rifiutarlo.

## Regola sui workflow HighLevel

Nessun workflow generico “Benessere Patrimoniale” deve governare entrambi i funnel dopo il punto di split.

Sono ammessi componenti riutilizzabili tecnici (template sender, helper, throttling), ma i workflow business devono essere distinti:

- prefisso consigliato `ARCH |` per recruitment Architetto;
- prefisso consigliato `EVENT |` per Quello che le banche non dicono;
- prefisso `CONSULT |` per confronti individuali derivati dall'evento.

Uno stage di un funnel non deve essere trigger di un workflow dell'altro.

## Regola sui dati HighLevel

Contact = persona condivisa.
Opportunity/Participation = contesto business separato.

Sul contatto possono stare solo fatti realmente globali: anagrafica, provincia dichiarata, consensi globali risolti e riferimenti tecnici condivisi.

Sul record Architetto stanno recruitment/qualification/training facts.
Sul record Evento/Participation stanno edition/registration/attendance facts.

Non copiare l'ultimo stato di un funnel sul contatto come se descrivesse la persona in assoluto.

## Regola sulle metriche/dashboard

La futura dashboard P4 deve avere almeno tre viste separate:

1. **Overview condivisa**: acquisition source, volume richieste, contact identity/technical health.
2. **Architetto**: funnel recruitment e operator/recruiter performance.
3. **Evento**: registration/attendance/follow-up per edizione.

Non sommare “WON” di A, E e C come un'unica vendita. Hanno significati diversi.

## Modifiche condivise future

Una modifica può stare nel core solo se è semanticamente valida per entrambi i funnel senza condizioni business nascoste.

Esempi core:
- miglioramento idempotenza;
- nuova strategia retry;
- sicurezza webhook;
- contact identity;
- UTM validation;
- audit tecnico.

Esempi NON core:
- CV;
- calendar event edition;
- training lesson;
- candidate qualification;
- attendance;
- capacity.

## Governance dei prossimi lavori

Ogni nuova task deve dichiarare uno scope:

- `SHARED CORE`
- `ARCHITECT WORKSTREAM`
- `EVENT WORKSTREAM`
- `CONSULTATION SUBSTREAM`

Se una modifica tocca due scope, deve specificare quali invarianti condivisi preserva e deve avere test di non-regressione sull'altro funnel.

Nessuna modifica a un workstream deve essere motivata solo dalla comodità di riuso se introduce semantica dell'altro funnel.
