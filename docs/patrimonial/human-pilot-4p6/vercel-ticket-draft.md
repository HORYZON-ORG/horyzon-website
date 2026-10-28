# Bozza ticket Vercel consolidata 4P.6 — NON INVIATA

Revisione documentale della bozza 4P.4B e dell'addendum 4P.5. **Nessun nuovo test HTTP in 4P.6 e nessuna dichiarazione di risoluzione.** Stato requisito: **FAIL aperto**. Invio e allegati richiedono nuova autorizzazione.

## Oggetto

Next.js 16.3.5, home prerenderizzata: risposta HTML GET/HEAD 304 senza ETag, benché presente nella 200; Markdown condizionale conserva l'ETag.

## Artefatto corrente e ambiente

- Team horyzon-consulting; progetto isolato horyzon-radar-pilot, `prj_bJvIOswh4GacqtUootXATXeAkSUO`.
- Deployment **dpl_WHyLB43axP3D8H9MSqNGEYFRzdxj**, Preview READY; sorgente **accd6b70b498cbccb7e1dbedb551e165fa38f820**.
- Origine: `https://horyzon-radar-pilot-blelmgb7p-horyzon-consulting.vercel.app`.
- Next **16.3.5**, CLI di build Vercel **64.3.1**, regione build **cle1**. CLI operatore **59.25.0**, Node locale **24.17.0**. Regione di build non identifica necessariamente il PoP della risposta.
- Vercel Authentication ALL; nessuna credenziale, cookie, token di accesso o bypass incluso in questa bozza. Nessun dato patrimoniale reale nei test.
- Stesso difetto rilevato sul precedente `dpl_4GSWEdYCy9v4PEgmxz86Zw4zGeDi`, SHA `bbde1aa3721c1f9a1f58bb6f6d6ee17f880be97e`.

## Riproduzione con accesso già autorizzato

Mantenere Deployment Protection. L'operatore usa la propria autenticazione esistente; i precedenti probe hanno impiegato OIDC effimero confinato all'origine del progetto. Non generare link di bypass per il ticket e non allegare header di autenticazione. Un support engineer deve concordare un proprio accesso autorizzato. Le richieste sotto descrivono soltanto i campi rilevanti; nessun comando va inteso come eseguito ora.

```http
GET / HTTP/1.1
Host: horyzon-radar-pilot-blelmgb7p-horyzon-consulting.vercel.app
Accept: text/html
```

Nel collaudo 4P.5: 200 HTML, `ETag: "c46e7bd2a5b0c83c61dc5214abbf0ae7"`. Ripetere usando **l'ETag appena restituito**, non necessariamente quello storico:

```http
GET / HTTP/1.1
Host: horyzon-radar-pilot-blelmgb7p-horyzon-consulting.vercel.app
Accept: text/html
If-None-Match: "c46e7bd2a5b0c83c61dc5214abbf0ae7"
```

Osservato: **304 con corpo vuoto ed ETag assente**. Ripetere gli stessi due passaggi con metodo HEAD: stesso difetto nella 304 HTML.

Ripetere GET e HEAD con `Accept: text/markdown`, leggendo prima il relativo ETag della 200 e poi inviandolo in If-None-Match. ETag storico Markdown `"261ff9d33ac23da20ee4ee7d06318ca2"`: **304 vuota con ETag presente**. Inviare anche ciascun ETag alla rappresentazione opposta: atteso e osservato **200** della rappresentazione richiesta, senza contaminazione nei casi verificati. Provare Accept assente, wildcard, rifiuto di Markdown e alternanza HTML/Markdown.

## Osservato, confronto locale e atteso

Matrice 4P.5: 24 richieste completate; assert ETag HTML GET e HEAD entrambe **FAIL**, preservate. Le condizionali Markdown e incrociate sono PASS. HTML 200 remoto conserva Vary Flight senza Accept; Markdown include Accept. I due probe di normalizzazione RSC differiscono dal server locale: 200 `text/x-component` remoto invece di 307 verso `/?_rsc` locale; contenuto Flight corretto e non Markdown. È un rilievo separato, non una spiegazione provata del difetto 304.

Configurazione di `/` e `/home.md`: `Cache-Control: private, no-store, max-age=0, must-revalidate`; `CDN-Cache-Control: no-store`; `Vercel-CDN-Cache-Control: no-store`. I primi due sono visibili nelle 200 remote; il terzo non è esposto. Si osservano HIT e Age sugli artefatti statici. Nel test locale dello stesso Next, build con modalità anonima ON e OFF: 24+24 probe PASS, **ETag conservato nelle 304 HTML**.

La [RFC 9110 §15.4.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.4.5) richiede l'invio di ETag nella 304 quando il campo sarebbe presente nella corrispondente risposta 200. Si chiede pertanto di preservarlo sia per GET sia per HEAD condizionali. Le assert non sono state allentate; il difetto resta bloccante per il rilascio pubblico.

La differenza è dimostrata al confine dell'hosting. Non è disponibile un origin separato per isolare CDN, adapter o Next; **la causa interna non è provata**. Non si deduce che no-store disabiliti tutto il caching statico della piattaforma. Nessuna risposta è stata riscritta dal client di prova.

## Richieste al supporto

1. Quale livello genera la 304 HTML prerenderizzata e dove viene perso ETag? Esiste una correzione che mantenga l'header senza rinunciare alla distinzione HTML/Markdown?
2. Confermare come sono separate le chiavi di cache delle rappresentazioni su rewrite e come i tre header di cache interagiscono con gli artefatti statici.
3. Chiarire la differenza di Vary/Accept e la normalizzazione RSC, distinguendole dall'obbligo ETag della 304.

Allegati proposti dopo revisione e autorizzazione: matrice selezionata `remote-readable-http.json` del 4P.5 e confronto locale già presente in `preview-ux-4p4b-qa`. Inviare solo metodi, URL senza parametri sensibili, status, header di risposta consentiti, hash/dimensioni e versioni. Rimuovere Cookie, Set-Cookie, Authorization, token, OIDC, header trusted e corpi del questionario. Non inviare l'intero browser profile, HAR non filtrato o archivio sorgente. Nessun ticket o messaggio è stato inviato.
