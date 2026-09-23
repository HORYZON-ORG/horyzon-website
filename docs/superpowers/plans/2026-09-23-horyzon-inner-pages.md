# Horyzon Inner Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every Italian secondary page a clear editorial role, a more compact desktop presentation and a search-friendly path back to Horyzon’s principal journeys.

**Architecture:** Keep the route and metadata ownership in `src/app/[...slug]/page.tsx`, but replace its generic content branch with three focused presentational families: areas, service details and authority/profile pages. A typed service map adds only the copy and relationships that the old `archive.json` model cannot express; the existing data remains canonical for route titles, intros and metadata.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, existing CSS, Next Image/Link, existing static verification scripts.

**Spec:** `docs/superpowers/specs/2026-09-23-horyzon-inner-pages-design.md`

## Global Constraints

- Change only the Italian public website; do not rewrite non-Italian routes.
- Keep all existing public URLs, FAQ JSON-LD and FAQ count of exactly five on eligible pages.
- Preserve product truth: Radar reads five areas; Platform exposes configured evidence and progress; AI supports work but does not replace responsibility.
- Do not promise automatic growth, profitability, fixed-timeline owner autonomy, full automation or unverified integrations.
- Keep home, legal pages, AI Score and Annunci 10x outside the contained inner-page frame.
- Use no new dependency, video, CMS, migration, production-data change or Vercel configuration.
- Desktop uses a contained page frame; tablet and mobile are full-width with readable side padding.
- Follow direct-`main` release discipline: fetch, fast-forward before edits, validate, push without force, compare `HEAD` to `origin/main`, then verify deployment separately when the release is requested.

## Review Focus

- A nested service URL must retain its parent breadcrumb, its existing FAQ/JSON-LD and a return route to its area.
- A service route missing editorial content must fail deterministically during the build checks instead of falling back to a generic page.
- The desktop frame must not constrain home, legal pages, AI Score or Annunci 10x.
- At 390 px no service diagnostic row, long Italian heading or CTA may overflow horizontally.
- Reduced-motion users must see the full area/service story without relying on animation or a hover state.

---

### Task 1: Define the editorial route contract

**Files:**
- Create: `src/content/editorial-routes.ts`
- Modify: `scripts/verify-editorial.mjs`

**Interfaces:**
- Consumes: the current service routes in `src/data/archive.json` and the three area roots in `src/data/pages.ts`.
- Produces: `serviceEditorial: Record<ServiceRoute, ServiceEditorial>` and `isServiceRoute(route: string): route is ServiceRoute`.

- [ ] **Step 1: Write the failing static contract check**

Add the route list and assertions to `scripts/verify-editorial.mjs` before creating the content map:

```js
const serviceRoutes = [
 'benessere-organizzativo/analisi-organizzativa',
 'benessere-organizzativo/sviluppo-imprenditoriale',
 'benessere-organizzativo/human-management',
 'benessere-patrimoniale/visione-patrimoniale',
 'benessere-patrimoniale/imprenditori',
 'benessere-patrimoniale/professionisti',
 'benessere-digitale/imprese',
 'benessere-digitale/competenze',
 'benessere-digitale/italia-digitale',
];
for (const route of serviceRoutes) {
 const html = await readFile(`.next/server/app/${route}.html`, 'utf8');
 assert(html.includes('service-editorial'), `${route}: diagnostic story missing`);
 assert(html.includes('Quando diventa urgente'), `${route}: urgency section missing`);
 assert(html.includes('Cosa diventa visibile'), `${route}: evidence section missing`);
 assert(html.includes(`href="/${route.split('/')[0]}"`), `${route}: area return missing`);
}
```

- [ ] **Step 2: Run the check to confirm it fails before the feature exists**

Run: `npm run build && node scripts/verify-editorial.mjs`

Expected: failure containing `diagnostic story missing` for the first service route.

- [ ] **Step 3: Create the typed content contract**

Create `src/content/editorial-routes.ts` with these interfaces and all nine route entries:

```ts
export const serviceRoutes = [
 'benessere-organizzativo/analisi-organizzativa',
 'benessere-organizzativo/sviluppo-imprenditoriale',
 'benessere-organizzativo/human-management',
 'benessere-patrimoniale/visione-patrimoniale',
 'benessere-patrimoniale/imprenditori',
 'benessere-patrimoniale/professionisti',
 'benessere-digitale/imprese',
 'benessere-digitale/competenze',
 'benessere-digitale/italia-digitale',
] as const;

export type ServiceRoute = (typeof serviceRoutes)[number];
export type ServiceEditorial = {
 parent: 'benessere-organizzativo' | 'benessere-patrimoniale' | 'benessere-digitale';
 urgency: readonly string[];
 interventions: readonly string[];
 evidence: readonly string[];
 nextLabel: string;
};

export function isServiceRoute(route: string): route is ServiceRoute {
 return serviceRoutes.includes(route as ServiceRoute);
}
```

For each entry, write three recognizable urgency signals, three concrete interventions and three visible forms of evidence. Keep content specific to the route. For example, `analisi-organizzativa` includes decision queues, overlapping responsibilities and work returning to the owner; its evidence includes an agreed responsibility map, named decision owners and a recurring operating review.

- [ ] **Step 4: Run TypeScript and the static verification**

Run: `npm run typecheck && npm run build && node scripts/verify-editorial.mjs`

Expected: TypeScript passes; editorial check still fails only because no component renders the new contract yet.

- [ ] **Step 5: Commit the contract and failing integration check**

```bash
git add src/content/editorial-routes.ts scripts/verify-editorial.mjs
git commit -m "feat: define service editorial content"
```

### Task 2: Build the service-detail diagnostic family

**Files:**
- Create: `src/components/service-editorial.tsx`
- Modify: `src/app/[...slug]/page.tsx`
- Modify: `src/app/atlas.css`

**Interfaces:**
- Consumes: `ServiceEditorial`, `ServiceRoute` and `isServiceRoute` from `src/content/editorial-routes.ts`; route title and intro from the existing archive data.
- Produces: `ServiceEditorialPage({ route, title, intro, content }): React.ReactElement` with `.service-editorial`, `.service-diagnostic`, `.service-interventions` and `.service-evidence` sections.

- [ ] **Step 1: Write the focused component implementation**

Create the component with a static narrative sequence:

```tsx
export function ServiceEditorialPage({ route, title, intro, content }: Props) {
 return <div className="service-editorial" id="pagina-contenuti">
  <section className="service-diagnostic" aria-labelledby="service-urgent">
   <p className="section-kicker">Quando diventa urgente</p>
   <h2 id="service-urgent">{title} merita attenzione quando il lavoro comincia a tornare indietro.</h2>
   <ul>{content.urgency.map((item, index) => <li key={item}><span>0{index + 1}</span>{item}</li>)}</ul>
  </section>
  <section className="service-interventions" aria-labelledby="service-work">
   <p className="section-kicker">Su cosa lavoriamo</p>
   <h2 id="service-work">Diamo una forma praticabile alla priorità.</h2>
   <ol>{content.interventions.map(item => <li key={item}>{item}</li>)}</ol>
  </section>
  <section className="service-evidence" aria-labelledby="service-visible">
   <p className="section-kicker">Cosa diventa visibile</p>
   <h2 id="service-visible">Decisioni e progressi che il team può riconoscere.</h2>
   <ul>{content.evidence.map(item => <li key={item}>{item}</li>)}</ul>
   <Link href={`/${content.parent}`} className="text-link">← {content.nextLabel}</Link>
  </section>
 </div>;
}
```

- [ ] **Step 2: Route service paths before the generic archive branch**

In `src/app/[...slug]/page.tsx`, import the contract and component. After the area-page branch and before the generic archive branch, render the service family only when `isServiceRoute(key)` is true. Pass `archive[key].title`, `archive[key].intro`, and `serviceEditorial[key]`. Do not alter `PageStructuredData`, breadcrumb or `FaqSection` rendering.

- [ ] **Step 3: Add responsive diagnostic styling**

Add scoped CSS in `src/app/atlas.css`:

```css
.editorial-page .service-editorial{background:var(--atlas-paper)}
.editorial-page .service-diagnostic,.editorial-page .service-interventions,.editorial-page .service-evidence{padding:clamp(72px,9vw,150px) clamp(26px,7vw,112px)}
.editorial-page .service-diagnostic{background:var(--atlas-night);color:#f2eee3}
.editorial-page .service-diagnostic li{display:grid;grid-template-columns:72px minmax(0,1fr);gap:24px;border-top:1px solid #d8bb8740;padding:22px 0;font-size:clamp(20px,2.2vw,34px)}
.editorial-page .service-evidence{background:var(--atlas-mist)}
@media(max-width:760px){.editorial-page .service-diagnostic li{grid-template-columns:42px minmax(0,1fr);font-size:20px}.editorial-page .service-diagnostic,.editorial-page .service-interventions,.editorial-page .service-evidence{padding-inline:6vw}}
```

Keep all lists and links visible without animation. Add a reduced-motion rule only if an animation is introduced.

- [ ] **Step 4: Run the build and expected static check**

Run: `npm run typecheck && npx eslint src/components/service-editorial.tsx "src/app/[...slug]/page.tsx" && npm run build && node scripts/verify-editorial.mjs`

Expected: all nine service routes pass the new assertions and still have one `<h1>` each.

- [ ] **Step 5: Commit the service-detail family**

```bash
git add src/components/service-editorial.tsx "src/app/[...slug]/page.tsx" src/app/atlas.css scripts/verify-editorial.mjs
git commit -m "feat: redesign service detail pages"
```

### Task 3: Make the three area pages materially distinct

**Files:**
- Modify: `src/components/inner-editorial.tsx`
- Modify: `src/data/pages.ts`
- Modify: `src/app/atlas.css`
- Modify: `scripts/verify-editorial.mjs`

**Interfaces:**
- Consumes: area roots and their children as currently resolved in `src/app/[...slug]/page.tsx`.
- Produces: `AreaEditorial` with a per-area `theme`, `question`, `outcome`, `firstStep` and visible route labels.

- [ ] **Step 1: Add a failing assertion for unique area identities**

Add the exact checks:

```js
for (const [route, phrase] of [
 ['benessere-organizzativo', 'Il lavoro deve potersi muovere anche senza di te.'],
 ['benessere-patrimoniale', 'Proteggere ciò che hai costruito richiede una vista completa.'],
 ['benessere-digitale', 'La tecnologia vale quando libera capacità nel lavoro reale.'],
]) {
 const html = await readFile(`.next/server/app/${route}.html`, 'utf8');
 assert(html.includes(phrase), `${route}: unique area question missing`);
 assert(html.includes('area-first-step'), `${route}: first-step section missing`);
}
```

- [ ] **Step 2: Run the check to confirm it fails**

Run: `npm run build && node scripts/verify-editorial.mjs`

Expected: failure containing `unique area question missing`.

- [ ] **Step 3: Replace generic area copy with approved, distinct copy**

In `src/components/inner-editorial.tsx`, extend `directions` with a `firstStep` and use it in the final area CTA. Use these exact area questions:

- Organizzativo: `Il lavoro deve potersi muovere anche senza di te.`
- Patrimoniale: `Proteggere ciò che hai costruito richiede una vista completa.`
- Digitale: `La tecnologia vale quando libera capacità nel lavoro reale.`

Update the three area `intro` and `body` values in `src/data/pages.ts` so the first paragraph answers the question directly and the second states the relationship with the other two areas. Do not introduce financial advice or technology guarantees.

- [ ] **Step 4: Give each area a visual variation within the shared structure**

Use the page data attribute already present on `<main>` and add distinct area treatments:

```css
.editorial-page[data-page="benessere-organizzativo"] .area-first-step{background:radial-gradient(circle at 50% 110%,#31554c,#071722 55%)}
.editorial-page[data-page="benessere-patrimoniale"] .area-first-step{background:linear-gradient(135deg,#433d30,#0d2025)}
.editorial-page[data-page="benessere-digitale"] .area-first-step{background:linear-gradient(135deg,#102d38,#31554c)}
```

Use different image crop/radius and service-row pacing selectors per area. Keep contrast sufficient and avoid page-specific JavaScript.

- [ ] **Step 5: Run checks and commit**

Run: `npm run typecheck && npx eslint src/components/inner-editorial.tsx src/data/pages.ts && npm run build && node scripts/verify-editorial.mjs`

Commit:

```bash
git add src/components/inner-editorial.tsx src/data/pages.ts src/app/atlas.css scripts/verify-editorial.mjs
git commit -m "feat: differentiate Horyzon business areas"
```

### Task 4: Reframe authority and profile pages around contribution

**Files:**
- Create: `src/components/authority-editorial.tsx`
- Modify: `src/data/people.ts`
- Modify: `src/app/[...slug]/page.tsx`
- Modify: `src/app/atlas.css`
- Modify: `scripts/verify-editorial.mjs`

**Interfaces:**
- Consumes: `people`, page key and existing archive copy.
- Produces: `PersonContribution({ name, role, responsibilities, stages, nextAction })` and `AuthorityReading({ route, sections, related })`.

- [ ] **Step 1: Add the missing structured profile fields**

Extend the person data type with:

```ts
responsibilities: readonly string[];
methodStages: readonly string[];
nextAction: { href: string; label: string };
```

Give every visible person page two or three concrete responsibilities, one or two relevant method stages, and an existing internal next action. Do not invent credentials, case studies or outcomes.

- [ ] **Step 2: Write the profile and authority components**

Render responsibilities before biography:

```tsx
<section className="person-contribution" aria-labelledby="person-contribution-title">
 <p className="section-kicker">Dove intervengo</p>
 <h2 id="person-contribution-title">Le decisioni che posso aiutarti a rendere più chiare.</h2>
 <ul>{responsibilities.map(item => <li key={item}>{item}</li>)}</ul>
 <p className="person-method">Nel percorso: {methodStages.join(' · ')}</p>
 <Link className="text-link" href={nextAction.href}>{nextAction.label} ↗</Link>
</section>
```

For `horyzon`, `impresa`, `economia`, `umanita`, `biblioteca` and `libro/management-umano`, use `AuthorityReading` to display a short lead, the existing source sections, and no more than three related internal links. Existing book purchase links remain unchanged.

- [ ] **Step 3: Route these content families without changing legal pages**

In `src/app/[...slug]/page.tsx`, render `PersonContribution` in the existing `person` branch before the biography section. Render `AuthorityReading` only for the listed authority routes. Preserve the existing legal branch exactly.

- [ ] **Step 4: Add static assertions and responsive CSS**

Add checks for `person-contribution` on `/angelo` and `/gianluca`, plus `authority-reading` on `/horyzon` and `/libro/management-umano`. Add CSS with a two-column grid above 760 px and one-column stacked reading layout below it. Use visible focus styles on all new links.

- [ ] **Step 5: Validate and commit**

Run: `npm run typecheck && npx eslint src/components/authority-editorial.tsx src/data/people.ts "src/app/[...slug]/page.tsx" && npm run build && node scripts/verify-editorial.mjs`

Commit:

```bash
git add src/components/authority-editorial.tsx src/data/people.ts "src/app/[...slug]/page.tsx" src/app/atlas.css scripts/verify-editorial.mjs
git commit -m "feat: make people and authority pages editorial"
```

### Task 5: Apply the contained desktop frame

**Files:**
- Modify: `src/components/site-shell.tsx`
- Modify: `src/app/atlas.css`
- Modify: `src/app/journey.css`
- Modify: `scripts/verify-editorial.mjs`

**Interfaces:**
- Consumes: `.editorial-page`, `SiteHeader` and `SiteFooter` currently shared by public pages.
- Produces: `.site-frame` around the header, inner content and footer, with `data-frame="contained"` only on eligible non-home public layouts.

- [ ] **Step 1: Add a static frame/exclusion check**

Add exact assertions:

```js
for (const route of ['benessere-organizzativo', 'benessere-digitale/imprese', 'horyzon', 'angelo', 'metodo']) {
 const html = await readFile(`.next/server/app/${route}.html`, 'utf8');
 assert(html.includes('site-frame'), `${route}: contained frame missing`);
}
for (const route of ['ai-score', 'annunci-10x', 'privacy-policy', 'cookie-policy']) {
 const html = await readFile(`.next/server/app/${route}.html`, 'utf8');
 assert(!html.includes('site-frame'), `${route}: contained frame must be excluded`);
}
```

- [ ] **Step 2: Implement a frame that does not alter route semantics**

Use a small wrapper component or layout class in `site-shell.tsx`; do not duplicate header or footer navigation. The inner page wraps header, `<main>` and footer in the frame, while special pages keep their current shell. Keep `<main id="content">` as the only page landmark.

- [ ] **Step 3: Add desktop and mobile CSS**

```css
@media(min-width:1000px){
 body:has(.editorial-page){background:#d8ddd7}
 .site-frame{width:min(1440px,calc(100vw - 56px));margin:28px auto;box-shadow:0 24px 70px #07172220;overflow:clip}
}
@media(max-width:999px){.site-frame{width:100%;margin:0;box-shadow:none}}
```

Keep the home outside this selector. Add a fallback neutral body background where `:has()` is unavailable; the visual frame itself must still work.

- [ ] **Step 4: Test keyboard and responsive behavior**

Run: `npm run build && node scripts/verify-editorial.mjs && node --no-warnings --experimental-strip-types scripts/verify-mobile-controls.mjs`

Open a representative area and service page at 1440 px and 390 px. Tab through header, hero CTA, diagnostic return link, FAQ and footer. Confirm no horizontal overflow and a visible focus ring.

- [ ] **Step 5: Commit the frame**

```bash
git add src/components/site-shell.tsx src/app/atlas.css src/app/journey.css scripts/verify-editorial.mjs
git commit -m "feat: contain desktop editorial pages"
```

### Task 6: Complete SEO/readability and release verification

**Files:**
- Modify: `src/content/public-faq.ts` only if a rewritten service page needs an answer made more specific.
- Modify: `scripts/verify-search.mjs` only if its explicit route set must include the newly tested service family.

**Interfaces:**
- Consumes: final static build output, existing FAQ and JSON-LD rendering.
- Produces: a verified public site with unchanged eligible FAQ counts and readable representations.

- [ ] **Step 1: Add any needed FAQ-specific assertions**

For each of the nine service routes, assert the built page includes `FAQPage` and exactly five question schema entries. If `verify-search.mjs` already derives this from `publicFaqs`, reuse that helper rather than duplicating a second parser.

- [ ] **Step 2: Run the complete local release suite**

Run:

```bash
npm run typecheck
npm run lint
npm run build
node scripts/verify-editorial.mjs
node scripts/verify-narrative.mjs
npm run test:search
npm run test:readable
```

Expected: all newly touched verification passes. If the unrelated pre-existing `npm test` AI Score expectation remains stale, report it separately without changing it solely to produce a green result.

- [ ] **Step 3: Visual review the complete family set**

Review desktop and 390 px mobile for:

1. `/benessere-organizzativo`
2. `/benessere-digitale/imprese`
3. `/horyzon`
4. `/angelo`
5. `/metodo`

Confirm one heading, no overflow, readable CTA labels, route returns, five FAQs, no inner-page video and no real customer data.

- [ ] **Step 4: Reconcile and publish only after the work is clean**

Run:

```bash
git fetch --all --prune
git pull --ff-only
git status --short --branch
git push origin main
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

Expected: clean working tree and identical local/remote SHA. If `main` moved, inspect the incoming diff, rebase or fast-forward safely, rerun affected checks, then push without force.

- [ ] **Step 5: Verify the production result when deployment is included**

Confirm Vercel reports `READY`, the deployed SHA matches the final remote SHA, `horyzon.it` points to the deployment and no runtime errors appear. Run the live search and readability checks against production.

## Self-Review

### Spec coverage

- Three page families: Tasks 2–4.
- New copy and no unsupported promises: Tasks 1, 3 and 4.
- Contained desktop frame with required exclusions: Task 5.
- Existing routes, FAQ and JSON-LD: Tasks 2 and 6.
- Responsive, keyboard and reduced-motion checks: Tasks 2, 4–6.
- Search/readability and direct-main release discipline: Task 6.

### Consistency checks

- `ServiceRoute`, `ServiceEditorial`, `serviceEditorial` and `isServiceRoute` are defined in Task 1 and consumed with the same names in Task 2.
- Authority work does not alter the legal branch or external publication availability.
- The frame check uses a concrete `.site-frame` marker and explicit excluded routes.
- No task creates a dependency, migration, video, CMS or external service.
