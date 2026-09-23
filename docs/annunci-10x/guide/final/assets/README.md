# Assets

No external bitmap assets are required for the PDF v1.

All diagrams and page visuals are generated as vector drawing commands by `../source/build_guide_pdf.py`.

Brand references used read-only from the repository:

- `public/horyzon-logo-canonical.png`
- `public/favicon.svg`
- site CSS palette and typography variables

No font files are committed. The build script uses open fonts available in the bundled Codex/Poppler runtime and embeds them in the generated PDFs.
