# Annunci 10x - Resend production setup

Questa nota prepara l'attivazione production del provider email transazionale Resend per l'OTP Annunci 10x.

## Obiettivo

Resend serve solo per email transactional/service legate alla verifica email Annunci 10x. In questa fase non invia report Score, nurturing, ricevute, guide o comunicazioni marketing.

## Setup

1. Crea o configura l'account Resend dedicato a Horyzon.

2. Nel dashboard Resend aggiungi il dominio `horyzon.it`.

3. Verifica `horyzon.it` usando esattamente i record DNS mostrati nel dashboard Resend per `horyzon.it`.

   Non hardcodare nel repository valori DKIM, SPF, MX o altri record DNS: devono rimanere quelli mostrati dal dashboard Resend al momento della configurazione.

4. Crea una API key dedicata all'invio transazionale Annunci 10x.

5. Configura le environment variable server-side:

   ```bash
   ANNUNCI10X_EMAIL_PROVIDER=RESEND
   RESEND_API_KEY=<api-key-resend>
   ANNUNCI10X_EMAIL_FROM="Horyzon <noreply@horyzon.it>"
   ANNUNCI10X_EMAIL_REPLY_TO="info@horyzon.it"
   ```

   `ANNUNCI10X_EMAIL_REPLY_TO` e opzionale, ma consigliata.

6. Non usare `onboarding@resend.dev` in production.

7. Non esporre mai `RESEND_API_KEY` al client e non creare variabili `NEXT_PUBLIC_*` per questa chiave.

## Rollback

In production `ANNUNCI10X_EMAIL_PROVIDER` non deve essere impostato a `MOCK`.

Se Resend non e configurato correttamente o non e sano, il sistema deve fallire chiuso con errore controllato di provider email non disponibile. Ripristinare `MOCK` in production non e una procedura di rollback autorizzata.

## Score report activation

Il report Score gratuito e una email transactional/service separata dal marketing. Deve restare disattivato finche la persistence production non e pronta.

1. Applica la migration `20260928113000_annunci10x_score_report_email_deliveries.sql` in production.

2. Verifica che esistano la tabella `public.annunci10x_email_deliveries` e le RPC:
   `annunci10x_claim_email_delivery`,
   `annunci10x_mark_email_delivery_sent`,
   `annunci10x_mark_email_delivery_failed`.

3. Solo dopo la verifica imposta la env server-side:

   ```bash
   ANNUNCI10X_SCORE_REPORT_EMAIL_ENABLED=1
   ```

4. Esegui un unico canary end-to-end:
   OTP -> verification -> analysis READY -> Score -> report email.

5. Se il canary passa, GO. Se fallisce, lascia il flag spento o spegnilo di nuovo e analizza la delivery senza riutilizzare `MOCK` in production.
