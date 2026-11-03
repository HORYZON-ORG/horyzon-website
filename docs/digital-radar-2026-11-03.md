# Radar Benessere Digitale — sito pubblico

Rilasciato in produzione il 3 novembre 2026 sui progetti esistenti, dopo push su main e applicazione della migration autorizzata. Nessuna variabile d'ambiente modificata.

## Contratto con Hub

- Ingresso generale: `/benessere-digitale/radar`.
- Contributi di un'azienda: `/benessere-digitale/radar/[token]`; token di 48 caratteri esadecimali, ottenuto esclusivamente da un comando interno autenticato nell'Hub.
- Ricezione: `POST /api/digital-radar`, JSON con Idempotency-Key coerente con il riferimento dell'invio. Conferma solo dopo la ricevuta della RPC `hub.digital_radar_submit_v1`.
- Dipendenza: migration Hub `20261103110000_digital_wellbeing_radar_links.sql`, applicata nel progetto condiviso e registrata come `20261103110802 / digital_wellbeing_radar_links`. Verificati i nuovi campi, i comandi e i privilegi; la ricezione server non è eseguibile direttamente dal ruolo anonimo.
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

## Rilascio del 3 novembre

Prima pubblicazione: Website `f2ae3108a6837c6d8ef9f33043662929ce75d91e`, Hub `5096db32d5bddb87bbe389a9886ddd043fb8d676`, entrambi READY con i domini di produzione corretti. Vercel ha avviato automaticamente i deploy dopo i push; non è stato necessario creare deploy aggiuntivi, progetti o alias.

Verificati HTTP 200 della pagina e del collegamento dal funnel, controllo Origin (403) e risposta dal database per un link aziendale inesistente (404, nessun salvataggio). Provati ricezione valida, reinvio e contributi del team in una transazione poi annullata; nessuna fixture è rimasta nel database e nessun contatto CRM è stato generato. Nessun runtime error rilevato nella finestra di verifica.

La verifica alla prima apertura ha individuato un intervallo prima dell'inizializzazione in cui i controlli erano già cliccabili: il fix successivo li mantiene disabilitati mostrando «Preparazione del questionario…» fino a quando l'interfaccia è pronta. La regressione è coperta anche con JavaScript disabilitato, oltre alle prove del flusso completo. Gli script privacy esistenti restano invariati.

Il collaudo con sessione Hub autenticata reale e la creazione effettiva di opportunità HighLevel restano da completare; i permessi HighLevel indicati nel resoconto iniziale non sono stati modificati da questo rilascio.
