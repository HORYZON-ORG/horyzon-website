# Horyzon Site Narrative Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Italian Horyzon public narrative around the real Radar, five-department transformation method, Hub Blueprint workflow and Platform governance model.

**Architecture:** Keep the existing Next.js static site and its cinematic homepage, but move product truth and public copy into typed content modules and focused visual components. Hub and Platform remain read-only sources; the website links to the public Hub Radar and explains authenticated Platform capabilities without embedding or duplicating either application.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS, static generation, Node verification scripts.

**Spec:** `docs/superpowers/specs/2026-09-16-horyzon-site-narrative-design.md`

## Global Constraints

- Work only in `C:\repos\horyzon-website`; Hub and Platform are read-only.
- Branch is `main`; do not create branches or pull requests and never force-push.
- Before edits run `git fetch --all --prune`, `git pull --ff-only`, inspect status and verify `HEAD...origin/main` ancestry.
- Canonical Radar target is exactly `https://hub.horyzon.it/radar`.
- Never pass name, email, telephone, company or other personal data in Radar query parameters.
- Distinguish available capabilities, configured engagement work and future direction.
- Do not guarantee owner independence, profitability, complete automation or unverified integrations.
- Preserve legal, regulatory and investment-risk language.
- Preserve the existing scroll video only on the homepage; no video on internal pages.
- Do not add dependencies unless the existing stack cannot satisfy a verified requirement.
- Every implementation task ends with focused tests and a small local commit; push and production deployment require separate user authorization.

---

## File map

**Create**

- `src/content/product-truth.ts` — canonical public URLs, capability states and shared vocabulary.
- `src/content/site-narrative.ts` — typed Italian narrative for the homepage, method, five departments and Platform.
- `src/components/radar-story.tsx` — accessible, data-free five-axis Radar explanation.
- `src/components/business-organism.tsx` — five-department interactive editorial model.
- `src/components/operating-journey.tsx` — nine-stage Horyzon method.
- `src/components/platform-story.tsx` — Hub → work environment → Platform governance diagram.
- `src/components/product-status.tsx` — available/configured/evolving capability legend.
- `src/app/narrative.css` — styles scoped to new narrative components.
- `scripts/verify-narrative.mjs` — production-output assertions for routes, copy boundaries and Radar links.

**Modify**

- `src/components/experience.tsx` — new homepage sequence and Radar entry points.
- `src/components/journey/journey.tsx` only if chapter timing must change after content-height verification.
- `src/app/journey.css` — homepage chapter placement and responsive styling.
- `src/app/layout.tsx` — import narrative stylesheet and update site metadata.
- `src/app/[...slug]/page.tsx` — route new narrative pages and profile/contact integrations.
- `src/components/inner-editorial.tsx` — preserve area structure while using the revised hierarchy.
- `src/components/site-shell.tsx` — add Radar and Platform navigation without overflowing mobile menu.
- `src/data/people.ts` — responsibility-first Frank copy using only verified information.
- `src/app/sitemap.ts` — add `/radar-impresa` and `/piattaforma`.
- `scripts/verify-editorial.mjs` — include new public routes.
- `package.json` — run narrative verification from `npm test`.

---

### Task 1: Canonical product truth and narrative contracts

**Files:**
- Create: `src/content/product-truth.ts`
- Create: `src/content/site-narrative.ts`
- Create: `scripts/verify-narrative.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `RADAR_URL`, `CapabilityState`, `productCapabilities`, `departments`, `operatingJourney`.
- Consumers: all later components and routes.

- [ ] **Step 1: Write the failing production verification**

Create `scripts/verify-narrative.mjs` with assertions that initially fail because the new routes and copy do not exist:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const radarUrl = 'https://hub.horyzon.it/radar';
for (const route of ['', 'radar-impresa', 'piattaforma', 'frank', 'contatti']) {
  const file = route ? `.next/server/app/${route}.html` : '.next/server/app/index.html';
  const html = await readFile(file, 'utf8');
  assert(html.includes(radarUrl), `${route || 'home'}: canonical Radar link missing`);
  assert(!/hub\.horyzon\.it\/radar\?/.test(html), `${route || 'home'}: Radar URL must not contain query data`);
}
const radar = await readFile('.next/server/app/radar-impresa.html', 'utf8');
for (const label of ['Amministrazione', 'Produzione', 'Commerciale', 'Marketing', 'Persone']) {
  assert(radar.includes(label), `radar-impresa: missing ${label}`);
}
console.log('Narrative checks passed.');
```

- [ ] **Step 2: Add the test command and verify the expected failure**

Change `package.json` so `test` ends with `&& node scripts/verify-narrative.mjs`.

Run: `npm run build; npm test`

Expected: existing checks pass, then `verify-narrative.mjs` fails on the missing route or canonical link.

- [ ] **Step 3: Implement canonical typed content**

Create `src/content/product-truth.ts` with these public contracts:

```ts
export const RADAR_URL = 'https://hub.horyzon.it/radar' as const;
export type CapabilityState = 'available' | 'configured' | 'direction';
export type ProductCapability = {
  state: CapabilityState;
  title: string;
  description: string;
};
export const capabilityLabels: Record<CapabilityState, string> = {
  available: 'Disponibile oggi',
  configured: 'Configurato nel percorso',
  direction: 'Direzione evolutiva',
};
```

Populate `productCapabilities` only with facts established in the approved spec. Create `src/content/site-narrative.ts` with:

```ts
export type DepartmentId = 'administration' | 'production' | 'sales' | 'marketing' | 'people';
export type Department = {
  id: DepartmentId;
  name: string;
  purpose: string;
  signals: readonly string[];
  destination: string;
};
export const departments: readonly Department[] = [
  { id: 'administration', name: 'Amministrazione', purpose: 'Rendere leggibili cassa, margini, budget e continuità.', signals: ['Decisioni di spesa senza budget', 'Margini non disponibili per prodotto o servizio'], destination: 'Numeri condivisi e decisioni sostenute da un piano.' },
  { id: 'production', name: 'Produzione', purpose: 'Trasformare la promessa commerciale in qualità replicabile.', signals: ['Qualità dipendente dal titolare', 'Errori gestiti caso per caso'], destination: 'Standard chiari e servizio stabile anche in assenza del fondatore.' },
  { id: 'sales', name: 'Commerciale', purpose: 'Costruire un metodo di vendita trasferibile e misurabile.', signals: ['Trattative concentrate sul titolare', 'Risultati affidati alle iniziative individuali'], destination: 'Un processo commerciale che il team sa applicare e migliorare.' },
  { id: 'marketing', name: 'Marketing', purpose: 'Alimentare il commerciale con domanda coerente e continuativa.', signals: ['Dipendenza dal passaparola', 'Posizionamento non riconoscibile'], destination: 'Una proposta chiara e un flusso osservabile di opportunità qualificate.' },
  { id: 'people', name: 'Persone', purpose: 'Dare a ruoli, responsabilità e crescita una struttura comprensibile.', signals: ['Decisioni che risalgono sempre al titolare', 'Inserimenti senza percorso'], destination: 'Persone che conoscono il proprio contributo e dispongono degli strumenti per esprimerlo.' },
];
export const operatingJourney = [
  { title: 'Definire la destinazione', description: 'Mete e obiettivi chiariscono l’orizzonte dell’impresa.' },
  { title: 'Leggere il presente', description: 'Radar e discovery rendono visibile il punto di partenza.' },
  { title: 'Disegnare l’organizzazione obiettivo', description: 'L’organigramma ideale mostra ruoli e responsabilità necessari.' },
  { title: 'Mappare persone e responsabilità', description: 'La struttura reale viene confrontata con quella necessaria.' },
  { title: 'Misurare il divario', description: 'Emergono mancanze, dipendenze e vincoli prioritari.' },
  { title: 'Scegliere il reparto prioritario', description: 'Il percorso concentra energia sul collo di bottiglia più rilevante.' },
  { title: 'Costruire il programma operativo', description: 'Procedure, ruoli, strumenti e indicatori diventano un piano verificabile.' },
  { title: 'Attivare con prove', description: 'Ogni capacità avanza solo quando accessi, test e responsabilità sono confermati.' },
  { title: 'Verificare e continuare', description: 'Risultati e scostamenti orientano il ciclo successivo.' },
] as const;
```

Write every record with concrete language from the spec; do not use filler labels or future-feature claims.

- [ ] **Step 4: Run static checks**

Run: `npm run typecheck; npm run lint`

Expected: both exit 0.

- [ ] **Step 5: Commit**

```powershell
git add package.json scripts/verify-narrative.mjs src/content/product-truth.ts src/content/site-narrative.ts
git commit -m "feat: add canonical Horyzon narrative contracts"
```

### Task 2: Radar explanatory page

**Files:**
- Create: `src/components/radar-story.tsx`
- Create: `src/components/product-status.tsx`
- Create: `src/app/narrative.css`
- Modify: `src/app/[...slug]/page.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/sitemap.ts`
- Modify: `scripts/verify-editorial.mjs`

**Interfaces:**
- Consumes: `RADAR_URL`, `departments`, `productCapabilities`.
- Produces: static `/radar-impresa` page with direct Hub CTA.

- [ ] **Step 1: Extend route tests before implementation**

Add `radar-impresa` to `scripts/verify-editorial.mjs` and assert one `h1`, no `<video>`, the canonical Radar URL, five department names, and explanatory labels for process maturity, owner autonomy, overall profile and AI adoption.

Run: `npm run build; npm test`

Expected: failure because `/radar-impresa` is not generated.

- [ ] **Step 2: Build the accessible Radar visual**

Export this interface from `src/components/radar-story.tsx`:

```ts
export function RadarStory(): React.JSX.Element;
```

Render an SVG pentagon with labelled axes and a neutral example polygon. Include a text alternative listing all five departments. Do not display a score, company name or synthetic customer result.

- [ ] **Step 3: Build capability-status language**

Export:

```ts
export function ProductStatus({ state, children }: {
  state: CapabilityState;
  children: React.ReactNode;
}): React.JSX.Element;
```

Use text labels in addition to color, so status is not color-dependent.

- [ ] **Step 4: Route `/radar-impresa`**

Add the route to the existing special-page map and render, in order: definition, five departments, outputs, sector interpretation, after-completion flow, limitations and final CTA. Use a plain external `<a href={RADAR_URL}>Inizia il Radar</a>` with no query parameters.

- [ ] **Step 5: Style and register the page**

Import `narrative.css` after existing site styles. Scope selectors under `.narrative-page`. Add `/radar-impresa` to the sitemap and editorial verification route list.

- [ ] **Step 6: Verify and commit**

Run: `npm run lint; npm run typecheck; npm run build; npm test`

Expected: all exit 0 and narrative verification now fails only on the remaining pages.

```powershell
git add src/components/radar-story.tsx src/components/product-status.tsx src/app/narrative.css src/app/layout.tsx 'src/app/[...slug]/page.tsx' src/app/sitemap.ts scripts/verify-editorial.mjs
git commit -m "feat: explain the Radar d'Impresa"
```

### Task 3: Homepage narrative and Radar entry points

**Files:**
- Modify: `src/components/experience.tsx`
- Modify: `src/app/journey.css`
- Modify: `src/components/journey/journey.tsx` only if measured chapter timing requires it.

**Interfaces:**
- Consumes: `RADAR_URL`, `departments`, `operatingJourney`.
- Produces: cinematic homepage with direct Radar actions and the approved narrative sequence.

- [ ] **Step 1: Add homepage assertions**

Extend `verify-narrative.mjs` to require two canonical Radar links on the homepage and the phrases identifying five departments, target organization, priority department and measurable progress.

Run: `npm run build; npm test`

Expected: homepage narrative assertions fail.

- [ ] **Step 2: Refactor `Experience` into named sections**

Keep the current `Journey`, header, footer and contact scene. Replace anonymous inline arrays with imported typed content. The visible sequence must be: horizon, current-state problem, Radar, business organism, operating journey, infrastructure, measurable progress, final action.

- [ ] **Step 3: Add direct actions**

Hero actions:

```tsx
<a className="journey-button" href={RADAR_URL}>Inizia il Radar <span aria-hidden="true">↗</span></a>
<Link className="journey-link" href="/radar-impresa">Scopri che cosa misura</Link>
```

Repeat the direct Radar action in the diagnostic chapter. Add a short note that the assessment opens in Horyzon Hub.

- [ ] **Step 4: Align scroll timing after real rendering**

Run the production preview. Inspect the transition at desktop 1440×900 and mobile 390×844. Change chapter min-heights or Journey timing only when text and scene transitions visibly drift; do not change the video asset.

- [ ] **Step 5: Verify and commit**

Run: `npm run lint; npm run typecheck; npm run build; npm test`

```powershell
git add src/components/experience.tsx src/app/journey.css src/components/journey/journey.tsx
git commit -m "feat: center the homepage on Radar and business autonomy"
```

### Task 4: Business organism, method and Platform truth

**Files:**
- Create: `src/components/business-organism.tsx`
- Create: `src/components/operating-journey.tsx`
- Create: `src/components/platform-story.tsx`
- Modify: `src/app/[...slug]/page.tsx`
- Modify: `src/components/inner-editorial.tsx`
- Modify: `src/app/narrative.css`
- Modify: `src/app/sitemap.ts`

**Interfaces:**
- Consumes: `departments`, `operatingJourney`, `productCapabilities`.
- Produces: `/piattaforma`, revised `/metodo`, `/le-tre-aree` and core area narratives.

- [ ] **Step 1: Add failing route assertions**

Require `/piattaforma` to contain Hub, ChatGPT Work, Platform, KPI, report, synchronization and activation language. Require `/metodo` to contain all nine stage titles. Require `/le-tre-aree` to explain the hierarchy organizational core → digital enablement → financial continuity.

- [ ] **Step 2: Implement `BusinessOrganism`**

Export:

```ts
export function BusinessOrganism({ compact = false }: { compact?: boolean }): React.JSX.Element;
```

Use semantic links and buttons, not five identical cards. On interaction, expose purpose, warning signals and destination for one department. All content remains available without JavaScript through the initial markup.

- [ ] **Step 3: Implement `OperatingJourney`**

Export:

```ts
export function OperatingJourney({ compact = false }: { compact?: boolean }): React.JSX.Element;
```

Render a true ordered sequence of nine stages. Use numbering because the content is sequential.

- [ ] **Step 4: Implement `PlatformStory`**

Render four bounded layers: Hub discovery and Blueprint; approved work environment and company systems; Horyzon MCP structured outputs; Platform dashboard and activation evidence. State explicitly that Platform does not directly operate every external customer system.

- [ ] **Step 5: Integrate pages and metadata**

Route `/piattaforma`, revise `/metodo`, `/le-tre-aree`, `/benessere-organizzativo`, `/benessere-digitale` and `/benessere-patrimoniale`. Preserve regulatory copy in patrimonial routes.

- [ ] **Step 6: Verify and commit**

Run: `npm run lint; npm run typecheck; npm run build; npm test`

```powershell
git add src/components/business-organism.tsx src/components/operating-journey.tsx src/components/platform-story.tsx src/components/inner-editorial.tsx src/app/narrative.css 'src/app/[...slug]/page.tsx' src/app/sitemap.ts
git commit -m "feat: explain the Horyzon operating system"
```

### Task 5: Frank, people and contact conversion paths

**Files:**
- Modify: `src/data/people.ts`
- Modify: `src/app/[...slug]/page.tsx`
- Modify: `src/components/site-shell.tsx`
- Modify: `src/app/narrative.css`

**Interfaces:**
- Consumes: `RADAR_URL` and existing `people` model.
- Produces: Radar actions from Frank, contact and navigation.

- [ ] **Step 1: Add profile/contact assertions**

Require the canonical Radar link in Frank and contact HTML. Require Frank's page to contain responsibility for the debrief, goals, target organization and priority department. Assert that no new credential, case study or guaranteed result is present.

- [ ] **Step 2: Rewrite Frank around verified responsibilities**

Keep existing verified identity fields. Rewrite intro, skills and body to describe his role in interpreting the Radar and turning goals into an operating programme. Do not add qualifications absent from the current source material.

- [ ] **Step 3: Add actions**

On Frank: direct Hub action plus internal method explanation. On contact: three paths — start Radar, request debrief, describe a priority department. Retain the mail-client contact flow.

- [ ] **Step 4: Update navigation**

Add `Radar d'Impresa` and `Platform` while keeping desktop navigation within the existing header and preserving the mobile menu. Remove or relocate a lower-priority top-level item if necessary; footer retains the complete route set.

- [ ] **Step 5: Verify and commit**

Run: `npm run lint; npm run typecheck; npm run build; npm test`

```powershell
git add src/data/people.ts 'src/app/[...slug]/page.tsx' src/components/site-shell.tsx src/app/narrative.css
git commit -m "feat: connect Frank and contact journeys to the Radar"
```

### Task 6: Metadata, site-wide copy consistency and accessibility

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/manifest.ts`
- Modify: `src/app/opengraph-image.tsx`
- Modify: `src/app/sitemap.ts`
- Modify: `src/data/archive.json` only for current Italian public entries directly affected by the approved narrative.
- Modify: `scripts/verify-narrative.mjs`

**Interfaces:**
- Produces: consistent discoverability and vocabulary across the Italian public site.

- [ ] **Step 1: Update metadata assertions**

Assert the production homepage title/description mention business diagnosis, organization and measurable evolution. Assert new routes appear in the sitemap output.

- [ ] **Step 2: Normalize principal Italian copy**

Replace vague copy in the main Italian institutional routes with the approved vocabulary. Do not rewrite legal pages or silently change German, English and French archive entries.

- [ ] **Step 3: Accessibility review in source**

Verify one `h1` per route, ordered heading levels, descriptive external links, visible focus, non-color status labels, SVG title/description, and reduced-motion behavior.

- [ ] **Step 4: Run the full automated gate**

Run: `npm run lint; npm run typecheck; npm run build; npm test; git diff --check`

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```powershell
git add src/app/layout.tsx src/app/manifest.ts src/app/opengraph-image.tsx src/app/sitemap.ts src/data/archive.json scripts/verify-narrative.mjs
git commit -m "feat: align Horyzon site metadata and public copy"
```

### Task 7: Browser verification and release-ready evidence

**Files:**
- Modify only files needed to fix defects found during verification.

**Interfaces:**
- Produces: locally verified website and exact release evidence; no push or deployment.

- [ ] **Step 1: Start a production preview**

Run: `npm run build` then `npm run start -- --port 3110`. If port 3110 is occupied, stop and select one explicit unused port before starting the preview.

- [ ] **Step 2: Desktop visual review**

At 1440×900 inspect home, Radar, method, Platform, Frank and contact. Confirm no overlaps, text clipping, broken sticky sections, video bleed or generic repeated-card rhythm.

- [ ] **Step 3: Mobile visual review**

At 390×844 inspect the same routes. Confirm the horizon remains framed, external Radar actions are visible, diagrams stack in reading order, menu remains usable and there is no horizontal overflow.

- [ ] **Step 4: Interaction review**

Verify keyboard access, department interaction, reduced-motion behavior and that every Radar action resolves to exactly `https://hub.horyzon.it/radar` without personal-data parameters. Do not submit a real assessment during website QA.

- [ ] **Step 5: Final automated verification**

Run: `npm run lint; npm run typecheck; npm run build; npm test; git status --short; git log --oneline origin/main..HEAD`.

Expected: checks pass; worktree is clean after any final fix commit; local commits are listed and no remote push has occurred.

- [ ] **Step 6: Report release state**

Provide the local preview URL, commit list, checks executed, pages visually inspected and explicit statement that Hub/Platform were not modified and production was not deployed.
