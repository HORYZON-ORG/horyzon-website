# Radar d’Impresa — configurazione Stripe

Il checkout resta fail-closed finché prezzo e account Stripe non sono stati approvati. Il codice è pronto, ma nessuna chiave deve essere salvata nel repository.

## Catalogo test

Creare in modalità test un prodotto `Radar d’Impresa` con metadata `horyzon_offer_code=RADAR_IMPRESA_REPORT`. Quando il prezzo sarà deciso, aggiungere un prezzo una tantum in EUR e copiare esclusivamente il relativo identificativo `price_...` in `RADAR_STRIPE_PRICE_REPORT`.

Comandi equivalenti, da eseguire solo con Stripe CLI autenticata sull’account corretto:

```powershell
stripe products create --name "Radar d'Impresa" --metadata horyzon_offer_code=RADAR_IMPRESA_REPORT
stripe prices create --product prod_REPLACE --currency eur --unit-amount AMOUNT_CENTS
```

Configurazione server richiesta:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RADAR_STRIPE_PRICE_REPORT`
- `RADAR_PRICE_AMOUNT_CENTS`, identico all’importo Stripe
- `RADAR_PUBLIC_BASE_URL=https://horyzon.it`
- `RADAR_CHECKOUT_ENABLED=0` fino al collaudo esplicito
- `RADAR_PREVIEW_ENABLED=0` fino al collaudo esplicito
- `RADAR_PREVIEW_PIN` nel secret store server, mai nel client
- `RADAR_COOKIE_SECRET`, casuale e lungo almeno 32 caratteri

Il webhook `/api/radar/stripe/webhook` deve ricevere:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.expired`
- `payment_intent.payment_failed`
- `charge.refunded`

Il fulfillment è idempotente e concede accesso solo dopo firma valida, stato pagato e corrispondenza di purchase ID, valuta e importo atteso. Un rimborso revoca il grant.

## Stato attuale

Al 29 settembre 2026, sulla macchina di sviluppo non risultano Stripe CLI, credenziali Stripe o price ID configurati. Per questo il prodotto esterno non è stato creato: il repository rimane correttamente disabilitato e non contiene segreti.
