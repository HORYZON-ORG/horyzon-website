# Quello che le banche non dicono — event workstream roadmap v1

20 ottobre 2026. Scope: **EVENT WORKSTREAM**.

Questo documento governa solo il funnel `/benessere-patrimoniale/evento`. Non include CV, candidature professionali, selezione, colloqui recruitment, formazione Architetto o attivazione professionale.

## Obiettivo

Gestire il ciclo:

`landing evento → richiesta partecipazione → edizione → conferma → reminder → evento → attendance/no-show → follow-up → eventuale confronto esplicito`

La stessa persona resta un unico contact HighLevel, ma la relazione evento resta distinta dal Percorso Architetto Patrimoniale.

## Stato già pronto

- landing Evento separata e noindex/nofollow;
- form Evento separato;
- contract v2 discriminato `patrimonial-event`;
- eventEditionId previsto solo nel dominio Evento;
- pipeline HighLevel `Evento Benessere Patrimoniale` esistente;
- pipeline `Confronti Benessere Patrimoniale` esistente;
- modello una relationship opportunity per contact + Participation per edizione;
- registration/attendance domain già modellato;
- P3/P3B foundation disponibile per stage/status;
- custom fields evento già censiti in HighLevel.

## Pipeline Evento

E01 Richiesta di partecipazione  
E02 Iscrizione confermata  
E03 Esito da registrare  
E04 Follow-up  
E05 Conclusa

La singola edizione non viene modellata creando una nuova opportunity ogni volta: la granularità vive in Participation.

## Substream Confronto

Un confronto individuale nasce solo da una richiesta esplicita e usa C01–C05.
Non viene creato automaticamente per ogni iscritto, no-show, click o apertura email.

## Lavori rimanenti

### E-A — Edizioni reali

Definire per ogni edizione:

- edition ID;
- titolo snapshot;
- start/end;
- timezone;
- stato;
- capienza;
- modalità di accesso;
- eventuale cutoff iscrizioni.

Nessuna data placeholder va usata per una conferma reale.

### E-B — Conferma e booking/accesso

Definire quando una richiesta può diventare CONFIRMED.
La conferma deve dipendere da edizione reale e regole operative, non solo dal submit.

### E-C — Workflow HighLevel Evento

Workflow separati dal recruitment:

- richiesta ricevuta;
- iscrizione confermata;
- reminder pre-evento;
- reminder giorno evento;
- follow-up attended;
- follow-up no-show;
- eventuale invito a nuova edizione;
- eventuale CTA a confronto individuale esplicito.

### E-D — Attendance

Fonte di verità per edizione:

`UNKNOWN | ATTENDED | NO_SHOW | CANCELLED | NOT_APPLICABLE`

No-show non viene inferito da assenza dati.

### E-E — Metriche Evento

Per edizione e aggregate:

- requests;
- confirmed registrations;
- confirmation rate;
- attendance rate;
- no-show rate;
- cancellation rate;
- follow-up completion;
- repeat participation;
- consultation request rate.

Mostrare sempre N insieme alle percentuali.

### E-F — P3B live

Quando Production/webhook saranno autorizzati:

- stage/status opportunity;
- dedup delivery;
- identity/pipeline verification;
- real payload timestamp shape;
- synthetic smoke.

Gli appointment/event-specific signal richiedono binding verificato prima dell'attribuzione automatica.

## Vincoli

- nessun CV;
- nessun campo candidate eligibility;
- nessun workflow training Architetto;
- nessun passaggio A01–A10;
- nessuna rinomina della pipeline Architetto;
- nessun consenso marketing usato come requisito per i messaggi necessari alla partecipazione richiesta.

## Decisioni operative da raccogliere

1. prossima edizione: data/ora/durata;
2. capienza e criterio di conferma;
3. link/piattaforma dell'evento;
4. presenter/owner;
5. sender/reply-to;
6. canali reminder;
7. timing reminder;
8. policy no-show;
9. CTA e criteri per confronto individuale;
10. fonti/compliance dei contenuti finanziari prima della produzione.

Stato: **roadmap separata; nessuna modifica runtime o HighLevel autorizzata da questo documento**.
