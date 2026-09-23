# Guida Annunci 10x

Stato:

- `CONTENT_V1_COMPLETE`
- `EDITORIALLY_REVIEWED`
- `METHODOLOGY_CHECKED`
- `PDF_NOT_YET_DESIGNED`

## Scopo

Questa cartella contiene il contenuto canonico V1 della Guida Annunci 10x, prodotto informativo standalone collegato al dominio Annunci 10x.

La guida e autonoma: una persona deve poterla usare anche senza accedere alla pagina prodotto o al percorso online.

## File

- `guide-content-v1.md`: contenuto completo della guida, con metodo, esempi, template, score, gate e placeholder visuali.
- `checklist-v1.md`: checklist operativa stampabile e griglia rapida dei 20 controlli.
- `README.md`: stato editoriale, fonti, vincoli e prossime fasi.

## Fonti metodologiche

Contenuto verificato rispetto a:

- `docs/annunci-10x/product-contract-v1.md`
- `docs/annunci-10x/method-v1.md`
- `docs/annunci-10x/data-contracts-v1.md`
- `docs/annunci-10x/prompt-pack-v1.md`
- `docs/annunci-10x/ux-contract-v1.md`
- `src/lib/annunci-10x/rubric.ts`
- `src/lib/annunci-10x/score.ts`
- `src/lib/annunci-10x/gates.ts`
- `src/lib/annunci-10x/strategy-rules.ts`
- `src/lib/annunci-10x/completeness.ts`
- `src/lib/annunci-10x/fixtures.ts`

La rubrica pubblicata nella guida usa le 8 dimensioni e i 20 controlli attualmente implementati nel dominio Annunci 10x.

## Vincoli editoriali rispettati

- Nessun prezzo, sconto, pagamento o checkout.
- Nessuna URL pubblica o CTA definitiva.
- Placeholder ammesso: `[CTA ANNUNCI 10x — DA INSERIRE AL LANCIO]`.
- Nessuna promessa di risultato garantito.
- Nessun posizionamento come prodotto magico o sostituto della conoscenza del ruolo.
- Esempi segnati come fittizi.
- Distinzione tra fatti, inferenze, informazioni mancanti e informazioni confermate.
- Separazione tra score e controllo di pubblicazione.
- Separazione tra Master e varianti di canale.

## Vincoli applicativi

Questa fase non modifica:

- route;
- componenti;
- API;
- provider;
- persistenza;
- schema dati;
- environment;
- deployment configuration;
- legacy `/annuncio-10x`.

## Open decision

- Titolo commerciale finale della guida.
- Sottotitolo di copertina.
- Formato fisico o digitale finale.
- Griglia editoriale e numero pagine.
- Tipografia e palette.
- Cover.
- Layout dei visual placeholder.
- Gerarchia callout.
- Eventuale impaginazione della checklist.
- CTA definitiva e destinazione commerciale.

## FASE 9B suggerita

La fase successiva dovrebbe occuparsi di design e produzione PDF, senza riscrivere arbitrariamente il metodo:

- title page e copertina;
- indice impaginato;
- griglia di pagina;
- tipografia;
- palette;
- componenti visuali per `[VISUAL]`, `[BOX]`, `[EXERCISE]`;
- esempi visuali prima/dopo;
- checklist stampabile;
- footer, numerazione e branding;
- esportazione PDF;
- verifica pagina per pagina.
