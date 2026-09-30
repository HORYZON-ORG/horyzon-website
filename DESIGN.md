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
Landing (noindex, nofollow) costruita come /radar e sullo stesso kit (`src/styles/horyzon-landing.css`, classi `rd-*`); le parti proprie stanno in `annunci-landing.css` (classi `ax-*`). Un solo gesto: l’annuncio sotto la lente, un foglio color crema con le cinque frasi vaghe tipiche degli annunci sottolineate dal ghirigoro ruggine del correttore (`ad-sheet.tsx`); nell’hero una linea lime lo scorre come il fascio del radar. Segue l’esperimento “Leggi il tuo annuncio come un candidato” (`candidate-story.tsx`, stesso meccanismo sticky di `owner-story.tsx`): una frase alla volta va a fuoco e compare il dubbio del candidato. Poi il risultato su campo lime, “Tocca a te” con i tre passi e lo Score gratuito (unico componente client della pagina, `Annunci10xClient`), il prezzo di Annuncio 10x con la garanzia, Frank, cinque FAQ e chiusura. Barra flottante (`annunci-dock.tsx`) nascosta su hero, Score, prezzo e chiusura. Mai uno Score mostrato o inventato fuori dal risultato reale; nessuna foto stock. Con reduced motion o senza JS: stesse parole, foglio statico, nessuna sticky. Il logo resta il PNG Recruiting approvato.
