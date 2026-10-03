# Radar d’Impresa — rilascio e rollback

## Ordine di attivazione

1. Verificare che Website e Hub siano allineati a `main` e che i working tree siano puliti.
2. Confrontare lo stato reale del database condiviso con le migration versionate.
3. Applicare la migration additiva `20260929101224_paid_radar_foundation.sql` solo con autorizzazione esplicita; non manipola risposte esistenti.
4. Configurare i secret server del Website e il catalogo Stripe di test, lasciando i flag a `0`.
5. Distribuire il Website e verificare stato Vercel `READY`, commit effettivamente distribuito, dominio `horyzon.it` e assenza di runtime errors.
6. Provare creazione, ripresa, autosalvataggio, refresh, abbandono e visibilità del progresso nell’Hub.
7. Provare pagamento test, webhook duplicato, sessione scaduta, pagamento fallito e rimborso.
8. Attivare `RADAR_PREVIEW_ENABLED=1` solo per il collaudo interno del PIN; non inserire il PIN nei log o nel client.
9. Attivare `RADAR_CHECKOUT_ENABLED=1` solo dopo approvazione di prezzo e catalogo.
10. Solo dopo verifica completa, attivare `VITE_RADAR_WEBSITE_CUTOVER=1` nell’Hub e ridistribuire l’Hub.

## Evidenze minime

- Website: test Radar, test completi, typecheck, lint e build.
- Hub: test, typecheck, lint e build; lista dei percorsi incompleti con avanzamento e ultimo aggiornamento.
- Supabase: migration presente e applicata nel progetto condiviso, senza un nuovo progetto o tabelle duplicate.
- Stripe: evento firmato registrato una sola volta e grant coerente con acquisto/rimborso.
- Vercel: deployment `READY`, SHA corretto, dominio di produzione e prova runtime nel browser.

## Rollback

Impostare prima `RADAR_CHECKOUT_ENABLED=0`, mantenendo attivo il webhook per riconciliare sessioni già emesse. Riportare `VITE_RADAR_WEBSITE_CUTOVER=0` per riaprire temporaneamente il percorso storico nell’Hub. Non eliminare acquisti, eventi, grant o assessment: sono evidenze operative. Un rollback del codice non richiede una migration distruttiva; eventuali colonne e tabelle additive restano inattive.

## Radar gratuito (lead magnet)

Il Radar è gratuito: al termine del questionario il risultato si apre subito, l’assessment passa a `journey_status = COMPLETED` (e `stato = completato` per l’Hub) e il report PDF parte via email se Resend è configurato. Checkout e PIN restano nel codice ma non vengono mostrati. Per tornare al risultato a pagamento impostare `RADAR_PAID_ACCESS=1` e ridistribuire; tutto il resto della procedura sopra resta valido.

## HighLevel

Ogni Radar diventa un contatto HighLevel (API v2, `services.leadconnectorhq.com`):

- all’avvio: upsert del contatto (nome, email, telefono in formato E.164, azienda) e tag `radar-impresa`, `radar-avviato`;
- al completamento: tag `radar-completato`, `radar-indice-<critico|da-consolidare|solido>`, `radar-utile-ora-<…>` e una nota con punteggi, utile per ora, priorità e link all’Hub.

Variabili server del Website: `HIGHLEVEL_PRIVATE_TOKEN` (Private Integration token del sub-account, scope contatti in scrittura) e `HIGHLEVEL_LOCATION_ID`. Senza entrambe l’integrazione è spenta; un errore HighLevel viene solo registrato nei log e non blocca il Radar. Le automazioni (email, SMS, pipeline) si costruiscono in HighLevel con trigger “Contact Tag added”.

## PDF dall’Hub

`GET /api/radar/staff/report/pdf?id=<assessment>` restituisce il report PDF di qualsiasi Radar completo. Richiede l’header `Authorization: Bearer <sessione Supabase dell’Hub>` di un utente con ruolo `superadmin` in `hub.user_roles` (stessa regola della RLS). CORS consentito a `https://hub.horyzon.it`, configurabile con `RADAR_STAFF_ORIGINS` (lista separata da virgole).
