# Website refresh — 15 September 2026

Source: HORYZON-ORG/horyzon-website, main 9354dd8c4f2327b9a9ccd5cb1ffd88c612e7e190.
The complete two-commit Git history was retrieved through the authenticated GitHub connector, reconstructed with verified object SHAs and cloned locally. A full fetch, fast-forward-only pull and ancestry check were performed against that verified snapshot. GitHub main must be rechecked before publishing; updates must never force the branch.

## Content and routes

- Source archive: uploaded public_html snapshot. Nested ZIP backups were excluded.
- All archived HTML paths are represented in src/data/archive.json, including existing English, French and German content. These translations are carried forward, not newly translated or editorially reviewed.
- Dedicated pages: three areas, method, people, library, assessment, contacts, partner network, company identity, three professional profiles and three digital contact cards.
- Nine area detail pages and Management Umano are restored.
- /conoscenza → /biblioteca; /indice-horyzon → /misura. Existing /horyzon#metodo and #persone anchors remain available.
- Frank's old download.php and named VCF links redirect to the new contact route.
- Lucio's archived profile remains reachable; he is not added to the new people directory. Gianni Mazzotta is intentionally deferred as requested.
- Assessments are newly authored orientation questions, not a validated index or financial advice. Answers remain only in React memory.

## Sources and identity

- Frank: public_html/frank/index.html and public_html/v/frank/Frank-Cannoletta.vcf. Email frank.cannoletta@horyzon.it; +39 348 169 8762.
- Angelo: public_html/horyzon/index.html and https://angeloria.it/chi-sono/; founder, business analysis, Human Management, author. The verified public email info@angeloria.it is used. His Horyzon email and phone were not found and must be supplied before adding them.
- Gianluca: information explicitly provided by the owner and existing project context. +39 380 363 2578. Personal Horyzon email was not available in this session, so it was not guessed. No title or publication date invented for his book.
- Existing Angelo and Frank portraits and three book covers were resized to WebP. No artificial portraits.
- Company details supplied by owner: FELICITÀ srl, VAT 05120660757, Viale Papiniano 28, 20123 Milano, SDI SU9YNJA.
- Privacy/cookie pages are explicit placeholders and noindexed. Complete and review them before switching the official domain.

## Design and behavior

Shared sticky header outside transformed content; viewport-fit and safe-area padding; touch menu with Escape dismissal; responsive horizon illustration; mouse/tap/keyboard method controls; reduced-motion support. No added trackers, external embeds or form backends.

## Remaining editorial inputs

Gianluca portrait and verified Horyzon email; Angelo Horyzon email and phone; book details when ready; legal text validation. Physical Chrome mobile toolbar behavior requires a check on a real device.

## Verification completed

- Production build and TypeScript passed; ESLint passed.
- 113 prerendered public routes returned HTTP 200. Next internal error routes excluded.
- 16 primary pages checked at 390px: no horizontal overflow; one H1 per page.
- Sticky header verified at viewport heights 650, 780 and 844; menu opening and Escape dismissal passed.
- Method selection, all six assessment answers, result and reload reset passed.
- Three valid vCards; Frank browser download confirmed.
- Reduced-motion content visible; no browser application errors.
- Desktop, mobile and method screenshots visually inspected using Chromium 153.
