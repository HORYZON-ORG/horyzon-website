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
Notte #081521, grafite #17252d, minerale #3e5968, teal #628780, avorio #f2eee3, oro #d9bf8f, corallo #c88976 (solo piccoli dettagli). Manrope e Cormorant Garamond esistenti: serif editoriale per titoli, sans per azioni e testo; corpo >=16px. Pietra ruvida, metallo scuro e parapetti sottili; trasparenza limitata. Nessun suono necessario.

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
