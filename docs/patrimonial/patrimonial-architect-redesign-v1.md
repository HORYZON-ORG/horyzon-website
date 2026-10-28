# Redesign del Percorso Architetto Patrimoniale

Rotta: `/benessere-patrimoniale/percorso-architetto-patrimoniale`. Baseline: `77138d5f2fc0a84a980a143c62652132072528fd`.

Riferimento approvato: `index.html`, titolo “Percorso Architetto Patrimoniale — Horyzon (proposta v2)”, SHA-256 `5bd93c0b1308a6220ecca56e2223d95deef567b8563f89068dc72979ae39a007`. I 12 JPG forniti sono copiati senza modifiche in `public/benessere-patrimoniale/percorso-architetto/` (2.393.532 byte complessivi). Nessuna immagine generata o ritoccata in questa fase.

## Componenti e isolamento

- `patrimonial-architect-landing.tsx`: trascrizione React delle 15 section HTML, con barra iniziale, selezione profilo, footer e sticky CTA: tutte le 19 parti richieste. Stati di profilo e IntersectionObserver sono locali; il timer della sessione è isolato in un provider con cleanup.
- `patrimonial-architect.module.css`: dichiarazioni dell'HTML convertite in classi locali, stesse palette, spaziature, ombre e animazioni. Solo su schermi stretti la card flottante rientra nel viewport e le annotazioni del blueprint si dispongono sotto il diagramma. Nessun CSS globale modificato.
- `patrimonial-architect-session.ts`: configurazione pubblica unica della sessione e copy/mappatura dei cinque profili. Space Grotesk, IBM Plex Sans e IBM Plex Mono sono caricati via `next/font/google` soltanto per la rotta Architetto.
- `PatrimonialPilotShell`: shell route-aware. Solo la rotta Architetto esatta usa il nuovo header/footer; evento ed entrambe le thank-you conservano la shell precedente. Nessuna nuova voce pubblica o sitemap.
- `ArchitectApplicationForm`: presentazione a due passi del `PilotLeadForm` esistente. Il markup standard dei form legacy/evento e il trasporto rimangono invariati.

## Profilo e modulo

I cinque pulsanti aggiornano aria-pressed, sottotitolo, CTA, scena evidenziata, attenuazione delle altre scene, testimonianza e profilo nel form. Commerciale, Imprenditore, Dipendente e Professionista corrispondono ai valori omonimi di `pilotForms`; “Sto esplorando” invia `Altro`. Anche il select del form aggiorna la selezione della pagina.

Passo 1: nome, cognome, email, telefono e privacy obbligatoria. Il passaggio al passo 2 è esclusivamente locale. I campi del passo 2 sono disabilitati fino a quel momento; i recapiti restano montati e vengono conservati tornando indietro. Passo 2: provincia obbligatoria secondo il contratto corrente; profilo, esperienza, obiettivo, disponibilità, risposta aperta e marketing facoltativi. Il marketing parte da false. Il submit completo usa la stessa funzione precedente, inclusi anti double-submit, timeout 35s, UTM, honeypot, errori, eventuale contratto v2/attempt/receipt e redirect alla thank-you già esistente. Questa fase non abilita v2 o altri flag.

I due verificatori CRM/persistence che bloccavano qualsiasi modifica al file frontend ora richiamano `verify-patrimonial-form-presentation.mjs`: il submit originale, attribution, query legacy e markup standard restano confrontati con la baseline precedente al redesign. Le protezioni dei file backend restano attive. Nessuna modifica all'infrastruttura live smoke.

## Placeholder e contenuti

La sessione è `PLACEHOLDER`: data null, label da confermare, posti totali/prenotati null. Sono mostrati `[N]` e trattini nel countdown, barra a zero senza percentuali inventate; nessun intervallo attivo finché non esiste una sessione confermata. La barra iniziale dichiara PILOT/PLACEHOLDER. I ritratti sono esplicitamente immagini AI provvisorie (alt e nota visibile nel footer), non foto del team.

Restano `[N]`, `[N]%`, `[DURATA]`, `[DATA SUCCESSIVA]`, `[NOME FONDATORE]`, `[Ruolo]`, nomi/città e testimonianze, risposte economiche/compliance e nota sul perimetro del ruolo. Il pulsante video fondatore è disabilitato e identificato come contenuto da fornire. Nessun player, testimonianza o promessa inventati. I link privacy/cookie usano le destinazioni reali già presenti nel repository. I 67 blocchi statici di copy confrontati nel browser coincidono con il riferimento, normalizzando solo gli spazi HTML.

## Verifica locale

- `test:patrimonial`: PASS.
- `test:patrimonial-persistence`: PASS, incluse suite ledger, CRM, opportunities e funnel importate; zero chiamate esterne.
- `test:patrimonial-remote-mapping`: PASS, trasporti fittizi.
- `verify-patrimonial-funnels.mjs --http=http://127.0.0.1:3100`: PASS, quattro rotte pilot HTTP 200/noindex/nofollow, parent pubblico invariato.
- Typecheck via API TypeScript con sola esclusione in memoria di `tmp/`, no emit/incremental: zero diagnostiche. Nessuna modifica al tsconfig.
- ESLint sui file pertinenti e `git diff --check`.
- Chrome headless reale a 390, 768 e 1440px: sezioni, immagini caricate, card, overflow, cinque profili, sticky visibile fuori hero/form e interamente nel viewport, tastiera/focus al passo 2, campi obbligatori, zero POST al passo 1, payload valido, doppio submit, errore/retry a dati conservati, redirect. Il POST è sempre intercettato e risposto nel browser prima del server. Tutte le richieste browser esterne sono bloccate.

Il verificatore browser richiede un runtime Playwright già disponibile esternamente al progetto, senza installazioni o nuove dipendenze:

```text
node --no-warnings --experimental-strip-types scripts/verify-patrimonial-architect-browser.mjs --playwright-module=<percorso-assoluto-playwright/index.mjs> --executable=<chrome> --artifacts=<directory-fuori-tmp> --base=http://127.0.0.1:3100
```

API public-leads, contract, store Supabase, provider HighLevel, mapping, outbox, routing, consensi, idempotenza/replay e smoke infrastructure sono invariati. Nessuna chiamata live HighLevel/Supabase, acquisizione, opportunity, cleanup, modifica env o deploy manuale.
