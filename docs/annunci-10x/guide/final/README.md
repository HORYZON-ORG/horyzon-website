# Annunci 10x Guide PDF V1

Status:

- `DESIGN_V1_COMPLETE`
- `PDF_V1_RENDERED`
- `PDF_V1_QA_PASSED`
- `PDF_V1_1_RENDERED`
- `PDF_V1_1_QA_PASSED`
- `PRICE_OPEN`
- `CTA_OPEN`
- `PUBLIC_URL_OPEN`

## Outputs

- `output/Annunci_10x_Guida_v1.pdf`
- `output/Annunci_10x_Checklist_v1.pdf`
- `output/Annunci_10x_Scheda_v1.pdf`
- `output/build-manifest.json`
- `output/Annunci_10x_Guida_v1.1.pdf`
- `output/Annunci_10x_Checklist_v1.1.pdf`
- `output/Annunci_10x_Scheda_v1.1.pdf`
- `output/build-manifest-v1.1.json`

Page count:

- Guide: 24 pages.
- Checklist: 3 pages.
- Scheda: 1 page.
- Guide v1.1: 28 pages.
- Checklist v1.1: 4 pages.
- Scheda v1.1: 2 pages.

Generated: September 2026.

Checksums and file sizes are recorded in `output/build-manifest.json`.

## Source

- `source/build_guide_pdf.py`

The source renders all pages through ReportLab with searchable text and vector diagrams. It does not rasterize complete pages.

## Build Process

From the repository root:

```powershell
& 'C:\Users\emanu\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' 'docs\annunci-10x\guide\final\source\build_guide_pdf.py'
```

For v1.1:

```powershell
& 'C:\Users\emanu\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' 'docs\annunci-10x\guide\final\source\build_guide_pdf_v1_1.py'
```

## Font Choice

The PDF uses Ubuntu R/M/B/L from the bundled Codex Poppler runtime:

`C:\Users\emanu\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\share\fonts`

No font files are committed to the repository. The font family is open, readable, and embedded by ReportLab during PDF generation.

## Visual Decisions

- A4 portrait.
- Calm editorial grid.
- Horyzon-derived palette: night, paper, gold, teal, ink, neutral line colors.
- Minimal headers/footers.
- Cover without public CTA or price.
- Diagrams are explanatory and vector-based.
- Checklist and Scheda pages avoid heavy filled backgrounds for normal printing.

## Open Decisions

- Final public distribution URL.
- Commercial CTA destination.
- Price and bundle decisions.
- Checkout and entitlement linkage.

## Source Content Version

Based on:

- `docs/annunci-10x/guide/guide-content-v1.md`
- `docs/annunci-10x/guide/checklist-v1.md`
- `docs/annunci-10x/guide/guide-content-v1.1.md`
- `docs/annunci-10x/guide/checklist-v1.1.md`

Rendered product versions: `v1`, `v1.1`.
Current editorial release: `v1.1`.

## QA Status

- Automatic PDF validation: passed.
- Visual page-by-page QA: passed.
- Forbidden-term scan: passed.
- Method integrity check: passed.
- Runtime/app changes: none.
- V1.1 visual QA: passed on 34 rendered pages.
- V1.1 forbidden-term and accent scan: passed.
- V1.1 safe-margin QA: passed.
