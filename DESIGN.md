# Horyzon — Un’impresa, un orizzonte

## Direzione
La reference fornita dal committente è l’unica anchor: pietra blu notte, ponti sinuosi, strutture frammentate, luce radente dorata, acqua e foschia. Il viaggio attraversa un paesaggio architettonico, mai una città futuristica. La scena occupa il viewport; i contenuti HTML restano indipendenti e leggibili. Il marchio esistente rimane invariato nella forma.

## Storyboard
1. **Vedere** (0–20%): primo piano scuro, elementi disallineati, orizzonte aperto a destra. Titolo e due azioni.
2. **Comprendere** (20–40%): la camera avanza tra i livelli. Persone, ruoli, processi, patrimonio, dati e competenze diventano oggetto dell’ascolto.
3. **Collegare** (40–65%): tre ponti in profondità rappresentano organizzazione, patrimonio e digitale. Le strutture ruotano verso il percorso; i tre approfondimenti sono link HTML.
4. **Accompagnare** (65–85%): maggiore stabilità e luce, metodo in otto passaggi. Nessuna metrica o testimonianza inventata.
5. **Evolvere** (85–100%): camera oltre la frammentazione, paesaggio più aperto. CTA verso /contatti e canale info@horyzon.it già presenti.

## Sistema visivo
Palette del brand, la stessa dei post social (01_Brand/Linee-guida): inchiostro petrolio #07171d, pannelli #102229, crema #f7f4e8, sabbia #efede6 per i fondi chiari, lime #d8ff42 per accenti e CTA, lime logo #d9e65f per il punto, oliva #5f7010 per accenti su fondo chiaro, ruggine #9d4d34 solo per i segnali di problema. Niente oro. Un solo carattere di display: Manrope 800 con tracking stretto (–0,04em), i corsivi diventano colore lime (Manrope non ha corsivo); JetBrains Mono maiuscolo spaziato per etichette; corpo >=16px. `--font-serif` resta come alias di Manrope per le regole esistenti. Logo: sempre il canonico HYC (Wordmark di site-shell), mai marchi disegnati a mano. Pietra ruvida, metallo scuro e parapetti sottili; trasparenza limitata. Nessun suono necessario.

## Architettura
Conservare Next.js App Router, React 19, routing e contenuti esistenti. React Three Fiber + drei per canvas, caricamento GLB Meshopt e qualità adattiva. Timeline unica normalizzata dallo scroll nativo, senza Lenis/GSAP aggiuntivi. Configurazione, camera, paesaggio, lifecycle e fallback separati. Modello architettonico generato da script riproducibile; instancing per strutture ripetute. Nessun download 3D sulle pagine interne.

## Responsive e accessibilità
Desktop: testo editoriale a sinistra, profondità e luce a destra. Mobile: campo verticale, camera più vicina, meno geometrie, dpr ridotto, header sticky con safe areas e menu tastiera. CTA >=44px. Nessuna informazione esclusiva del canvas. Reduced motion: immagine statica e tutti i contenuti, nessun viaggio/canvas. Lo stesso fallback copre assenza WebGL, errori e contesto perso. Rendering su richiesta, fermo quando il documento non è visibile e quando il viaggio esce dallo schermo.

## Budget prima dell’implementazione
- HTML e CTA disponibili senza attendere WebGL; nessun layout shift introdotto dal canvas.
- Fallback WebP <=350KB desktop, <=150KB mobile; modello Meshopt <=250KB.
- JS 3D separato e lazy; budget chunk 3D complessivo <=400KB gzip (da misurare).
- DPR massimo 1.5 desktop, 1.25 mobile, minimo 1; riduzione automatica sotto prestazioni adeguate.
- <=100 draw call, <=100k triangoli desktop; <=60k mobile; nessuna ombra dinamica o postprocessing multipass.
- Obiettivo 50–60fps desktop e >=30fps mobile moderno; misurazioni di laboratorio non equivalgono a device reali.
- Nessuna allocazione per frame: vettori, colori e matrici riutilizzati.
- LCP obiettivo <=2.5s, CLS <=0.1, Lighthouse performance >=85/accessibilità >=95: obiettivi, non risultati dichiarati senza misurazione.

## Preservazione e confini
Conservare URL, team, libri, autovalutazione, biglietti digitali, vCard, redirect, sitemap, robots e contatti. Le informative legali esistenti sono provvisorie: nessuna attestazione di conformità aggiunta. Il committente ha autorizzato il push su main a lavoro completato; non modificare domini.

## Livello cinetico della home
Splash HYC (`hyc-splash.tsx`): primo piano del monogramma, zoom indietro, il logo atterra nel wordmark dell'header; una volta per sessione, solo a caricamento completo. Sopra il viaggio video, `home-motion.tsx` aggiunge: titoli divisi in parole che salgono dalle maschere (corsivi per ultimi), linea d'orizzonte in basso con il punto lime del logo come navigazione, Radar con le sei aree (profilo illustrativo, nessun valore), tre benesseri che entrano uno alla volta, "Come lavoriamo" fermo sullo schermo con tre tappe su una linea, alba progressiva della scena, sole lime che sorge sotto l'ultimo titolo. Tutto è condizionato a `html.kinetic`: con reduced motion o senza JS la home resta il layout statico completo, e l'HTML server e l'export Markdown non cambiano.

Organigramma (`org-chart.tsx`, dal manuale "Le basi dell'organizzazione d'impresa"): direzione generale e cinque reparti (risorse umane, marketing, amministrazione, produzione, commerciale), ciascuno con funzioni e prodotto; sugli schermi grandi si costruisce in scena fissa e si adatta all'altezza disponibile. Segnali sul video (`signal-field.tsx`): canvas decorativo, fermo fuori schermo, DPR entro il budget. Carte in vetro scuro per la leggibilità; etichette in JetBrains Mono. Le frecce ↗ usano la variante testo (U+FE0E) per non diventare emoji su iOS.


## Pagina /radar
Landing a pagamento (noindex) costruita su un solo gesto: il Radar. Hero con radar vivo (fascio che ruota, cinque reparti, il punto lime "tu" al centro), poi l'esperimento "Immagina un mese senza di te": sezione sticky guidata dallo scroll (`owner-story.tsx`) in cui il punto esce dal radar e i reparti che dipendono dal titolare si piegano uno alla volta, in ruggine. Seguono il risultato su campo lime (come il carosello 03), il questionario, Frank, FAQ e chiusura. Barra CTA flottante (`radar-dock.tsx`) nascosta su hero, questionario e chiusura. Forme sempre illustrative, nessun punteggio inventato. Con reduced motion o senza JS: stesse parole, radar statico, nessuna sticky.

## Pagina /annunci-10x
Landing (noindex, nofollow) costruita come /radar e sullo stesso kit (`src/styles/horyzon-landing.css`, classi `rd-*`); le parti proprie stanno in `annunci-landing.css` (classi `ax-*`). Un solo gesto: un annuncio di lavoro com’è sui portali (`ad-sheet.tsx`): azienda (“La tua azienda”), titolo grande, griglia dei dati chiave (orari, stipendio, contratto) e bottone “Candidati”. Il ruolo illustrativo è cameriere/a di sala, scelto perché rende riconoscibili le frasi vaghe senza introdurre prove pubbliche nuove. Nell’hero è l’annuncio vago: cinque frasi tipiche sottolineate dal ghirigoro ruggine del correttore, dati chiave “da definire”, una linea lime che lo scorre. Segue l’esperimento “Lo stesso annuncio, riscritto riga per riga” (`candidate-story.tsx`, stesso meccanismo sticky di `owner-story.tsx`): a ogni tappa una frase viene barrata e sostituita da un fatto, il dato chiave corrispondente diventa lime e a lato si nomina l’errore (“‘Commisurata all’esperienza’ non è una cifra.”); all’ultima tappa l’annuncio è chiaro. L’annuncio chiaro è un esempio illustrativo e la pagina lo dice accanto. Poi il risultato su campo lime, “Tocca a te” con i tre passi e lo Score gratuito (`Annunci10xClient`); le altre isole client servono solo a storia scroll, dock e apertura del percorso Create. Segue il blocco Annuncio 10x gratuito, sei FAQ (la prima per chi deve sostituire una persona) e chiusura. Creazione da brief e miglioramento di un annuncio esistente non richiedono pagamento né carta di credito; la verifica email resta necessaria prima della generazione. Lo Score gratuito (`annunci-10x-analyze-flow.tsx`) è una colonna di card separate, mai annidate: i tre passi (Incolla, Verifica, Score), il modulo crema che dopo l’invio si richiude in una riga, una striscia scura di avanzamento senza logo, i moduli contatto e codice, il report (numero grande, scala a cinque fasce, interpretazione, una sola avvertenza) e sotto l’offerta di riscrittura su inchiostro, l’unica con la CTA lime. Dopo email verificata e analisi pronta, il report transazionale via Resend include anche tutti i 20 controlli con voto 0–10/N/D, stato, lettura e indicazione operativa; ogni ciclo esplicito “Analizza un altro annuncio” usa una nuova identità di richiesta così da non riutilizzare un vecchio run o una vecchia email. Barra flottante (`annunci-dock.tsx`) nascosta su hero, Score, prezzo e chiusura. Mai uno Score mostrato o inventato fuori dal risultato reale; nessuna foto stock. Con reduced motion o senza JS: stesse parole, annuncio chiaro statico accanto all’elenco dei cinque errori, nessuna sticky. Il logo resta il PNG Recruiting approvato.


## Pagina /ai-score
AI Score usa lo stesso sistema visivo di /annunci-10x e /radar: inchiostro, crema e lime, Manrope 800, JetBrains Mono per etichette, CTA lime e card ad alto contrasto. L’hero usa una scansione AI illustrativa senza punteggi inventati; il form gratuito resta l’azione primaria. La sezione metodologia della landing ha intestazione centrata e campo lime. `/ai-score/methodology` usa lo stesso kit `rd-*`, alternando hero scuro, campo lime, sezioni crema/sabbia e pannelli scuri; i contenuti metodologici e gli stati reali non vengono alterati per ragioni estetiche.
