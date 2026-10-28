# Radar Patrimoniale V1 — Advisor Intelligence, Fase 4D.1

Data: 18 ottobre 2026. Ambito: proiezione interna e dashboard **locale con sole fixture sintetiche**. Nessun dossier collegato a persone, operatori o contatti reali.

## 1. Stato iniziale e architettura

Worktree: `C:\Users\emanu\.codex\worktrees\radar-patrimoniale-v1\horyzon-website`, branch `feat/radar-patrimoniale-v1`, HEAD iniziale verificato `640e4101f19248c7e1c86049e3bb66165d68f24f`, working tree inizialmente pulito. Nessun processo Git concorrente o lock rilevato. Nessun fetch Git, push, merge o deploy eseguito in questa fase.

Letti AGENTS/DESIGN, report 4A/4B/4C.1/4C.2, specifiche metodologiche, doppia vista, profilazione obiettivi, dominio canonico, proiezione cliente e contratti di identità/persistenza. Consultati in sola lettura i contratti Hub/staff e le assegnazioni presenti nel checkout originale. Applicate le indicazioni delle skill Supabase e React; consultata la skill Auth per il confine staff. Guide Next installate 16.3.5 lette prima di scrivere la pagina server.

Flusso preparato:

```text
Snapshot canonico immutabile + input approvato completo
   ├─ customerProjection esistente → CustomerResult (invariato)
   └─ advisorProjection server → AdvisorResultProjection → AdvisorDashboard

Oggi: previewSource sintetico → stesso motore 4A → snapshot fixture → Advisor
Domani: adattatore staff + relazione corrente verificata → snapshot autorizzato
        (adattatore reale assente e accesso negato per default)
```

La dashboard è un Server Component, senza fetch, cookie, storage, mutazioni o chiamate CRM. Non introduce un secondo motore diagnostico. La preview è una pagina dinamica distinta, non indicizzabile, senza endpoint Advisor. Il generatore delle fixture usa una sola esecuzione del motore 4A per creare lo snapshot sintetico; la proiezione e la UI non rieseguono la diagnosi.

## 2. Contratto AdvisorResultProjection

Contratto concreto `RP-ADVISOR-4D1-1` in `src/lib/patrimonial-radar-advisor/contracts.ts`. L'interfaccia omonima concettuale della progettazione 4A resta invariata: non viene usata per estendere il payload cliente.

| Campo | Contenuto e provenienza |
| --- | --- |
| `general` | UUID interno persona, assessment, snapshot, revisione approvata, data completamento, T0/T12/Tnow, versioni, perimetro, completezza e qualità canoniche |
| `origin`, identità e assignment | Origine non verificata, sola identità UUID, nessun recapito o responsabile inventato |
| `areas`, `indicators` | Sei stati, tutti gli indicatori, frazioni e intervalli esatti, unità, formule, qualità, riferimenti e motivi del risultato canonico |
| `evidence`, profili e priorità | Evidenze, forze, vulnerabilità, incoerenze, profili e spiegazioni già prodotti dal dominio |
| `goals` | Obiettivi, rango esplicito, primo utilizzo, natura, importi, risorse, vincoli, esperienza, preferenze, controlli e collegamenti inattivi canonici |
| `current`, `answers` | Risposte risolte e intero ledger originale con revisioni, stato, lifecycle corrente, disposizione e contributo distinto |
| `reading` | Cinque domande della Lettura del cliente, base dichiarata/canonica/non disponibile, riferimenti a domande e indicatori |
| `agenda` | Ipotesi di colloquio con regola sorgente, evidenze, answer refs, indicatori e obiettivi pertinenti |
| `futureComparison` | Struttura non implementata, catalogo assente, raccomandazioni vuote, obiettivi/vincoli e prerequisiti del confronto futuro |

La proiezione controlla corrispondenza assessment, UUID persona, versioni, T0, hash input/risultato e riferimenti dell'intero ledger dello snapshot. Restituisce una copia indipendente e non modifica la fonte. Questi controlli assicurano coerenza della fonte, **non sostituiscono l'autorizzazione**: un UUID o un hash non conferisce accesso.

Le fixture di sola metodologia, comprese quelle parziali G, ricevono un envelope snapshot sintetico per la preview. Non rappresentano episodi completati attraverso il workflow DB reale né provano le regole di completamento. Il percorso cliente persistente viene verificato separatamente dalla regressione 4C.2.

## 3. Dashboard realizzata

Dodici sezioni: Panoramica; Lettura del cliente; Sei dimensioni; Dati economici; Patrimonio; Protezione e pianificazione; Obiettivi e vincoli; Punti di attenzione; Preparazione colloquio; Risposte originali; Qualità e limiti; Confronto futuro.

La panoramica presenta motivo del profilo in italiano, stato educativo e tre indicatori canonici (margine, autonomia, netto). Identificativi e dettagli tecnici rimangono espandibili. Il radar mantiene sei settori uguali, simboli e descrizioni testuali: nessun voto globale o poligono quantitativo. Le tabelle espongono tutti gli indicatori, inclusi quelli non calcolabili, con formule/fonti/limiti consultabili. Sotto 760 px diventano righe verticali con etichette e intestazioni accessibili.

Riutilizzati Manrope, JetBrains Mono, palette inchiostro/crema/lime e PNG canonico HYC già presente. Nessuna immagine duplicata, dipendenza o font aggiunto. CSS confinato al modulo Advisor. Navigazione mobile su una riga scorrevole, senza overflow del documento; link, dettagli nativi e focus visibile da tastiera. Nessuna animazione necessaria; reduced motion rispettato.

## 4. Collegamento al canonico

Indicatori, soglie, stati, profili, obiettivi e confronti sono copiati dal medesimo `Snapshot.result` usato dalla vista cliente. I test confrontano gli oggetti completi, non solo i testi visibili. Il renderer formatta importi e frazioni; non stima capitale necessario, non imputa valori mancanti e non usa punti medi delle fasce. Le fasce dichiarate possono essere normalizzate con l'utilità monetaria 4A già esistente per la sola presentazione, mantenendo estremi e qualità.

Non calcolabile, non applicabile, sconosciuto, non comunicato, non risposto e zero restano distinti. Le revisioni superate/inattive/da riconfermare sono consultabili come originali, con contributo escluso; non rientrano nelle conclusioni della dashboard. Lo stato della domanda mostrato nel dettaglio storico è esplicitamente quello corrente nello snapshot.

## 5. Preparazione del colloquio

La sintesi iniziale e i punti di attenzione usano profili, priorità, evidenze favorevoli/materiali, lacune e incoerenze canoniche. Le domande partono dalle `interviewQuestions` esistenti e dalle definizioni obiettivo `TO_CLARIFY`, conservando la regola sorgente e i riferimenti. Non richiedono nuovamente un orizzonte già noto, non trasformano un rifiuto di comunicare in un dato mancante da esigere e distinguono le ipotesi dalle dichiarazioni.

Il responsabile può risalire da evidenza o formula alla revisione originale. Nessuna domanda aggiunta al questionario cliente, nessun bisogno psicologico o rischio personale dedotto, nessuna offerta o operazione suggerita.

## 6. Obiettivi, vincoli ed esigenze

Principale soltanto con rango 1 confermato; fino a tre obiettivi secondo il dominio, senza graduatoria inventata per dati legacy. Scadenza e primo utilizzo, importo e contesto, natura una tantum/continuativa e lacune restano distinti. Riserva da mantenere e quota eventualmente destinabile sono dichiarazioni, non capacità di investimento verificata. Attribuzioni concorrenti, disponibilità, rigidità e conflitti sulle risorse usano esclusivamente i confronti già approvati nel dominio.

Esperienza dichiarata, aspettative, dubbi, risultato desiderato dal colloquio e coinvolgimento futuro rimangono consultabili separatamente. Il futuro catalogo non contiene prodotti, ordinamenti per patrimonio/fragilità/commissioni, matching o raccomandazioni. La valutazione professionale successiva resta separata.

## 7. Test e regressioni

| Verifica | Esito |
| --- | --- |
| `test:patrimonial-radar-advisor` | PASS: 25 fixture, oggetti canonici identici, evidenze/ledger, fasce/stati mancanti, obiettivi/vincoli, nessuna mutazione o payload cliente esteso, ACL simulate e gate |
| `test:patrimonial-radar-advisor-browser` | PASS: quattro gruppi su browser/Next reali, tutti i 25 scenari renderizzati, quattro viewport, tabelle/dettagli da tastiera, produzione con flag ON e dev OFF entrambi 404, zero richieste esterne/scritture/errori pagina |
| `test:patrimonial-radar-browser` | PASS: 12 gruppi E2E 4C.2 con browser, Next e PostgreSQL embedded 17.5 locali, OTP simulato, persistenza, conflitti CAS, revoca, isolamento persone, completamento/hash, payload cliente minimo, quattro viewport |
| `test:patrimonial-radar` | PASS: 72 gruppi; conservati 57 scenari metodologici PASS, 4 PARTIAL CT-26/28/37/40 e CT-27 NOT RUN storici |
| `test:patrimonial-radar-backend` | PASS: 14 gruppi, PostgreSQL embedded 18.6 locale; nessuna prova nativa/PostgREST implicita |
| `test:patrimonial-radar-projection` | PASS: 14 fixture cliente/canonico, allowlist e trasporto locale rigoroso |
| `test:radar` | PASS: 10 gruppi Radar d'Impresa |
| Funnel, ledger, CRM, opportunità, persistenza, mapping remoto | PASS: verificatori locali esistenti, trasporti simulati, nessuna chiamata live |
| `test:patrimonial` e presentazioni Evento/Architetto/tema | PASS: contenuti, form, markup approvato, temi e asset |
| `verify-patrimonial-integration.mjs` | PASS: Radar v4/34 schermate, 35 fotografie identiche, CRM/migration protetti, assignment esclusi |
| `typecheck`, `build` produzione | PASS: TypeScript senza errori, build completa di 145 pagine e route Advisor dinamica |
| Lint globale | PASS con 65 warning preesistenti, 0 errori; nuovo codice verificato separatamente |
| `test:no-platform`, `test:search`, `test:readable` | PASS dopo build; header HTTP verificati separatamente per la preview |

Il verificatore UI 4B ammette solo il nuovo blocco header Advisor prima di confrontare integralmente la configurazione protetta: le guardie su UI cliente, motore e API restano attive. Il verificatore Advisor confronta questi percorsi con `640e410...` e richiede assenza di modifiche a 4A, server/cliente esistenti, SQL, CRM, asset e lockfile.

Comandi delle sei regressioni patrimoniali: `test:patrimonial-funnels`, `test:patrimonial-ledger`, `test:patrimonial-crm`, `test:patrimonial-opportunities`, `test:patrimonial-persistence`, `test:patrimonial-remote-mapping`. Eseguiti anche `test:patrimonial-radar-ui`, i due verificatori di presentazione e `verify-patrimonial-theme.mjs`. Lint mirato dei nuovi moduli, pagina, componenti e verificatori: zero errori e zero warning.

**Limite storico separato:** `test:patrimonial-live-smoke` conserva il FAIL preesistente della guardia Git globale su `c61ed43...`; non modificato né rieseguito né promosso a PASS. Mai avviato lo smoke operativo `smoke:patrimonial`.

## 8. QA desktop e mobile

Browser reale Edge/Chromium headless su Next locale, viewport 320/390/768/1440. Fixture soltanto sintetiche: T01–T14, G01–G08 e varianti RECONFIRM/INACTIVE/LEGACY. Screenshot di panoramica, radar, economia, tabelle e obiettivi; controlli di overflow del documento, apertura dettagli da tastiera, focus e link interni, caricamento font/logo, revisione originale e tracciabilità.

Artefatti esterni al repository: `C:\Users\emanu\.codex\visualizations\2026\10\18\01a14e5a-6067-71a0-a210-f3859cab8329\radar-patrimoniale-4d1`. `verification.json` elenca i quattro gruppi PASS e i 25 screenshot dell'ultima esecuzione. La regressione cliente è nella directory sorella `radar-patrimoniale-4d1-customer-regression`. Ispezionati screenshot desktop, mobile, tablet, tabelle, obiettivi, fasce e legacy; l'ispezione integra i test automatici. Viewport emulati e tastiera non equivalgono a dispositivi fisici, tutte le famiglie browser o un audit completo screen reader.

## 9. Isolamento e gate

Preview `/internal/radar-patrimoniale/advisor-preview`: richiede **entrambi** `PATRIMONIAL_RADAR_ADVISOR_PREVIEW_ENABLED=true` e `PATRIMONIAL_RADAR_ADVISOR_PREVIEW_CONTEXT=synthetic-local`, solo development/test, fuori da Vercel. Default OFF e rifiuto in produzione anche con flag true. Nessun file env modificato. Parametro ammesso esclusivamente `scenario` da lista fissa; UUID persona, token, altri parametri e valori duplicati rifiutati. Nessuna ricerca di persona, nessun cookie cliente/staff consumato, nessun adattatore reale importato.

Header dedicati: noindex/nofollow, referrer assente, CSP locale, richiesta `no-store, private`. In **Next dev** il framework sostituisce Cache-Control con `no-cache, must-revalidate`: osservato via HTTP e verificato senza direttive public/s-maxage; non si dichiara che il dev server invii no-store. La pagina può comunque renderizzare soltanto fixture e in produzione risponde 404 prima di costruirle.

Nessun endpoint Advisor creato, API cliente invariata e verificata in regressione. Browser con storage/beacon vietati, richieste esterne e metodi di scrittura bloccati dal harness; l'esito verifica che non vengano tentati. Il risultato canonico reale non è caricato nella preview né passato alla vista pubblica.

## 10. Dipendenze Hub e assegnazioni

`src/lib/radar/staff-auth.ts` autentica lo staff Supabase e verifica `hub.user_roles`/superadmin per il Radar d'Impresa. Non viene modificato o riutilizzato come autorizzazione generale ai dossier patrimoniali.

I contratti assignment esaminati in sola lettura nel checkout originale a `b242752...` distinguono `current_operator_id` interno, revisione CAS `operator_revision`, `owner_ref`/owner del contatto HighLevel, owner opportunità e `remote_user_ref` opzionale. Non sono equivalenti. Non importate implementazioni, migration o modifiche concorrenti.

Nel branch manca il binding verificato fra identità Hub autenticata e operatore interno e fra persona Radar e contatto soggetto alla relazione corrente. Mancano inoltre regole esplicite di supervisione. È stato quindi costruito **soltanto** `AdvisorAccessPorts` e `readAuthorizedAdvisor`, mai collegati a runtime/API: sessione corrente, operatore attivo, link verificati, permesso specifico `RADAR_ADVISOR_READ`, relazione effettiva corrente/revisione e soggetto esatto sono necessari. Adapter assente o relazione assente → accesso negato prima della lettura. Supervisione non risolta e generico ruolo superadmin non autorizzano.

Il confine risolve l'autorità prima e dopo il caricamento e ne richiede identità completa: revoca/riassegnazione rilevata nega la restituzione. I test simulano questi cambiamenti e soggetti errati. Questo doppio controllo **non certifica atomicità DB né elimina ogni race futura**: adattatore reale, controllo transazionale/RLS, revoca fra processi e audit di accesso restano da implementare/verificare in 4D.2 secondo il contratto autorevole delle assegnazioni.

## 11. File della fase

- `src/lib/patrimonial-radar-advisor/contracts.ts`
- `src/lib/patrimonial-radar-advisor/projection.ts`
- `src/lib/patrimonial-radar-advisor/access.ts`
- `src/lib/patrimonial-radar-advisor/formatting.ts`
- `src/lib/patrimonial-radar-advisor/preview-gate.ts`
- `src/lib/patrimonial-radar-advisor/preview-fixtures.ts`
- `src/components/patrimonial-radar-advisor/advisor-dashboard.tsx`
- `src/components/patrimonial-radar-advisor/advisor.module.css`
- `src/app/internal/radar-patrimoniale/advisor-preview/page.tsx`
- `scripts/verify-patrimonial-radar-advisor.mjs`
- `scripts/verify-patrimonial-radar-advisor-browser.mjs`
- `scripts/verify-patrimonial-radar-ui.mjs` (guardia additiva header)
- `next.config.ts` (soli header preview)
- `package.json` (soli due comandi test)
- Questo report.

Nessuna modifica a dipendenze/lockfile, dominio diagnostico, percorso cliente, migrazioni, configurazioni remote, segreti, routing CRM, HighLevel, immagini, font o regole assignment.

## 12. Commit locale e checkout originale

Il commit locale della fase è identificato nella consegna e con `git log -1 -- docs/patrimonial/radar-patrimoniale-v1-advisor-intelligence-fase-4d1.md`, senza hash autoreferenziale nel documento.

Checkout originale mai scritto, spostato, ripulito, consolidato o importato. Stato iniziale: branch `feat/patrimonial-pilot-funnels`, HEAD `b242752102542e5280bba8b6ba0c4aecf9fcd722`, soli non tracciati audit Fase 1 e `tmp/`. Ricontrollo finale: stesso branch/HEAD e stessi due percorsi non tracciati. Nessuna modifica a main.

## 13. Readiness 4D.2 e limiti residui

Base locale pronta per sviluppare l'accesso Advisor autenticato: proiezione, dashboard riutilizzabile, contratto astratto restrittivo, fixture e regressioni disponibili. **Non pronta per dati/operatori reali.** Il dossier non è collegato ad alcuno staff o contatto.

Prerequisiti 4D.2: contratto assignment consolidato e binding verificati; permesso specifico e supervisione esplicita; revoca/riassegnazione atomiche con audit; adattatore server autorizzato e prove negative reali fra operatori/contatti; PostgreSQL nativo multiconnessione/PostgREST e piano migration già aperti in 4C.2; policy privacy/retention/recupero identità e validazione metodologica/professionale separate. Le simulazioni 4D.1 non promuovono questi punti a PASS.

Nessuna raccomandazione di investimento, catalogo attivo, invio email, scrittura Supabase remota, modifica HighLevel, flag pubblico attivato, push, deploy o merge. Fine della Fase 4D.1.
