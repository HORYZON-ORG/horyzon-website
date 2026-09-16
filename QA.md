# Verifica del redesign Horyzon

## Esito automatico
+- `npm run lint`: passato.
+- `npm run typecheck`: passato.
+- `npm run build`: passato; 116 route prerenderizzate, incluse pagine precedenti, vCard, sitemap, robots e manifest.
+- `npm test`: passato; GLB validato senza errori o warning, decodifica Meshopt riuscita, 9 mesh e 12.960 triangoli. Verificati 16 link/asset della homepage, contenuti HTML delle cinque scene, canonical e route essenziali preservate.
+- GLB: 73.296 byte; fallback desktop circa 132 KB, mobile circa 48 KB.
+
+## Browser Chrome remoto
+Le dimensioni sono state verificate in un frame con viewport reale alle misure indicate, senza modificare lo zoom dei contenuti. L’harness locale non fa parte del prodotto.
+
+| Viewport | Overflow orizzontale | Header | Immagini |
+|---|---|---|---|
+| 1440×900 | assente | top 0, altezza 84 | caricate |
+| 1024×768 | assente | top 0, altezza 84 | caricate |
+| 768×1024 | assente | top 0, altezza 76 | caricate |
+| 390×844 | assente | top 0, altezza 76 | caricate |
+| 390×560 | assente | top 0, altezza 76 | caricate |
+
+Verificati: link “Scopri il percorso”, menu mobile apertura/chiusura, Escape, header fisso durante scroll, navigazione a Contatti e ritorno a scroll 0, recapiti mailto esistenti, interazione Ascolto/Misura/Azione, autovalutazione Digitale (6 risposte, risultato generato da tastiera). Nessun messaggio email inviato.
+
+## Limiti espliciti
+Il Chrome remoto restituisce `GL_VENDOR = Disabled, GL_RENDERER = Disabled`: non è possibile verificare la resa GPU, gli shader in esecuzione o gli fps del viaggio. È stato verificato invece il fallback WebGL e aggiunto un controllo di disponibilità prima di montare il canvas. La validazione del modello non sostituisce una prova visiva del 3D.
+
+Reduced motion implementato mediante media query e mancato montaggio del canvas; controllo sorgente, senza emulazione di sistema nel browser disponibile. La verifica 390×560 simula uno spazio verticale ridotto, ma non costituisce una prova su Chrome Android fisico con barre native. Lighthouse e Core Web Vitals non misurati: i valori in DESIGN.md rimangono obiettivi.
+
+Le informative privacy/cookie del repository rimangono dichiaratamente provvisorie. Nessun nuovo tracker o servizio di raccolta dati è stato aggiunto.
