import { publicGuideLinks } from '@/content/public-guide';

export const dynamic = 'force-static';
export function GET() {
 const text = [
  '# Horyzon Consulting',
  '> Organizzazione, responsabilità e progresso misurabile. Guida opzionale ai contenuti pubblici, non un requisito di indicizzazione.',
  '## Pagine principali',
  ...publicGuideLinks.map(([name, path, description]) => `- [${name}](https://horyzon.it${path}): ${description}.`),
  '## Optional',
  '- [Sintesi in Markdown](https://horyzon.it/index.md): metodo, definizioni, capacità e limiti.',
  '- [Sitemap](https://horyzon.it/sitemap.xml): pagine pubbliche indicizzabili.',
 ].join('\n\n') + '\n';
 return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex, follow' } });
}
