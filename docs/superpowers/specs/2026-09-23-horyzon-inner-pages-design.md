# Horyzon inner-page editorial redesign

## Purpose

Turn the Italian public site from a collection of 33 individual URLs into six clear paths for an entrepreneur. Preserve the URLs, their search value, FAQs and structured data, while giving every page a clear role in a compact, immersive experience.

The user wants an editorial site rather than a generic AI consulting catalogue: fewer repeated explanations, stronger questions, visual variety, and desktop pages that sit inside a slightly more contained frame. Mobile remains fluid and easy to read.

## Scope

This increment affects the Italian public website only. It does not change Hub, Platform, customer data, URLs, translations, legal/regulatory wording, or the Annunci 10x product work already present on `main`.

The 33 Italian URLs remain public. They are grouped in the experience as:

1. **Start and decide** — Radar, Metodo, Sistema impresa, Platform, Persone and Contatti.
2. **Improve a business area** — Benessere organizzativo, digitale and patrimoniale plus their detailed pages.
3. **Learn and connect** — Horyzon, Impresa, Economia, Umanità, Biblioteca, Management Umano, individual profiles and Partner Network.

## Content model

### Main paths

The main pages keep their existing specialised storytelling components. Their copy must answer a single practical question and lead to one next action. They use the same contained desktop frame, without changing the immersive homepage treatment.

### Area pages

Each area is a long-form editorial landing page:

1. a concrete tension an entrepreneur recognizes;
2. a brief explanation of the desired condition;
3. three related interventions displayed as a route, not as a card grid;
4. one useful first action.

The three pages share the structure but use distinct language, pacing, visual asset treatment and colour emphasis so they do not feel templated.

### Service-detail pages

The nine detailed pages become short, decision-oriented pages. Their shared sequence is:

1. **When this becomes urgent** — recognizable signals;
2. **What we work on** — a small set of concrete interventions;
3. **What becomes visible** — evidence, routines or decisions that improve;
4. **Where the path continues** — return to the area or begin a conversation.

The page intro and FAQ remain direct answers to search questions. Long repeated prose and generic claims are removed.

### Authority and people pages

People pages lead with the decisions and method stages each person supports, then their biography. Horyzon, the three manifesto pages, Biblioteca and Management Umano become quiet editorial reading pages with clear related-route links. The library stays focused on available publications only.

## Copy rules

- Write to an Italian SME owner who is looking for clarity, not consulting jargon.
- Begin with a problem, question or choice; follow immediately with the practical consequence.
- Prefer `ruolo`, `reparto`, `procedura`, `indicatore`, `decisione`, `responsabilità` and `evidenza`.
- Preserve product truth: Radar reads five business areas; Platform makes progress and evidence visible; AI supports work without replacing responsibility.
- Do not promise automatic growth, profitability, full automation, fixed-timeline owner autonomy or unverified integrations.
- Keep each FAQ at five questions and answers, using it as a retrieval layer rather than duplicated body copy.

## Visual system

### Frame

On desktop, public inner pages use a `max-width` page frame with visible outer margins and a subtle outer canvas. Individual story sections may still bleed to the frame edges when they need impact. The header and footer align to the same frame. At tablet and mobile widths the frame becomes full width with the current generous side padding.

### Page families

- **Main paths:** existing bespoke diagrams and story sections, refined into the new frame.
- **Areas:** a sticky question/answer relationship, large type and directional service rows.
- **Service details:** an editorial diagnostic composition with numbered signals and a visible continuation line.
- **Authority:** text, imagery, pull-quotes and related reading; no dense component catalogue.
- **Profiles:** a responsibility map and human portrait, alternating media/copy on large screens.

The visual vocabulary remains navy, ivory, muted gold, editorial serif headings, thin structural lines, restrained scroll motion, no new video for inner pages, and full reduced-motion support.

## Architecture

1. Move the generic route branches into small presentational components for area, service-detail and authority/profile families.
2. Introduce a typed editorial content map for service signals, interventions, evidence and related destination. The existing route data remains the canonical source for metadata and all existing paths.
3. Add a shared contained-frame layer in the existing inner-page CSS. It must not affect home, legal pages, AI Score or Annunci 10x.
4. Keep existing FAQ and JSON-LD output on every eligible route.
5. Keep public navigation as the six current primary paths and use contextual return routes on secondary pages.

## Accessibility and resilience

- Semantic heading order, visible keyboard focus and descriptive link labels.
- Decorative images stay empty-alt; informational visuals receive a useful accessible label.
- All interaction is optional and usable as static content.
- No layout needs JavaScript to reveal the route, copy or CTA.

## Verification

- `npm run typecheck`, targeted ESLint, production build and editorial/narrative verification.
- Extend deterministic checks for every service-detail content entry and the desktop frame exclusions.
- Visual review at desktop and 390 px mobile for one page from each family, including keyboard focus and reduced motion.
- Verify sitemap, structured data, FAQ count and readable Markdown after the content pass.
- Before publishing, rebase safely on any concurrent `main` work; push only a clean fast-forward and confirm the deployed SHA and production runtime state.

## Delivery order

1. Establish content families and reusable page components.
2. Rewrite and redesign the three area landings.
3. Rewrite and redesign the nine detailed service pages.
4. Refine authority and profile pages.
5. Apply the global contained desktop frame and complete visual/search verification.

## Non-goals

- Reducing or deleting public URLs.
- Translating or rewriting non-Italian routes.
- New video production, a CMS, external design-library installation, Hub/Platform changes, migrations, data changes or Vercel configuration.
