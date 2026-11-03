# Radar Benessere Digitale — sito pubblico

Implementazione locale su main, non pubblicata. Nessuna modifica remota o alle variabili d'ambiente.

## Contratto con Hub

- Ingresso generale: `/benessere-digitale/radar`.
- Contributi di un'azienda: `/benessere-digitale/radar/[token]`; token di 48 caratteri esadecimali, ottenuto esclusivamente da un comando interno autenticato nell'Hub.
- Ricezione: `POST /api/digital-radar`, JSON con Idempotency-Key coerente con il riferimento dell'invio. Conferma solo dopo la ricevuta della RPC `hub.digital_radar_submit_v1`.
- Dipendenza: migration Hub `20261103110000_digital_wellbeing_radar_links.sql`, preparata ma non applicata. Il codice Website va attivato soltanto dopo la migration e il relativo collaudo autorizzato.
- Dati: aziende e osservazioni Hub già esistenti; coda CRM digitale già esistente per il ricontatto esplicito. Nessuna nuova tabella Website e nessuna modifica ai Radar d'Impresa/Patrimoniale.

## Comportamento

Tre passaggi: azienda/ruolo, attività concreta con strumenti/frequenza/tempi facoltativi, autovalutazione e invio. Nome facoltativo, contatto facoltativo nell'ingresso pubblico; il link aziendale non chiede un ricontatto CRM. Le risposte sono per il percorso aziendale, senza iscrizione marketing. Le risposte «Non so» sono escluse dai punteggi, senza rimpiazzarle con 0 o 1. Le sei dimensioni restano compatibili con il dossier esistente.

Il riferimento rimane identico quando si riprovano le stesse risposte dopo un'interruzione. Risposte cambiate sono un nuovo invio. Un guasto CRM non può annullare il salvataggio. Schede pubbliche indipendenti non sono unite mediante nomi o email non verificati; il link aziendale è il mezzo per aggiungere contributi allo stesso dossier.

Le pagine non sono indicizzabili e impostano referrer no-referrer. Nessuna API pubblica restituisce risposte precedenti, contatti, id dossier o token aziendali. Il funnel precedente e il suo modulo restano disponibili.

## Test

`npm run test:digital-radar` verifica dominio/HTTP e regressione del funnel esistente. La prova SQL integrata parte dal checkout Hub:

```powershell
node --no-warnings --experimental-strip-types tests/digital-radar.database.mjs C:/tmp/hz-main
```

Sostituire l'ultimo parametro con il percorso del Website. Sono utilizzate soltanto fixture locali.

Browser: `scripts/verify-digital-radar-browser.mjs` richiede Playwright e un server locale; accetta `PLAYWRIGHT_MODULE_PATH`, `PLAYWRIGHT_CHANNEL` e `DIGITAL_RADAR_TEST_URL` (default `http://127.0.0.1:3311`). Intercetta gli invii e blocca richieste esterne; non esegue test su produzione. Copre schermi da 390/1280 px, avanzamento da tastiera, campi facoltativi, errore di rete, reinvio identico e superficie del link aziendale.

Per l'attivazione restano separate autorizzazione migration, pubblicazione sui progetti esistenti, verifica READY/commit/domini/runtime e collaudo remoto. I permessi HighLevel opportunità indicati nel collaudo del 3 novembre restano da risolvere.
