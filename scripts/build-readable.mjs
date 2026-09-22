import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import TurndownService from 'turndown';

// Extract the actual prerendered page on every build, never a parallel copy.
const html = await readFile('.next/server/app/index.html', 'utf8');
const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
assert(body && /<h1\b/.test(body), 'Homepage must be prerendered before generating Markdown');
const converter = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
converter.remove(['script', 'style', 'svg', 'canvas', 'video', 'noscript', 'button', 'input', 'select']);
converter.addRule('inlineSpacing', { filter: ['span', 'label'], replacement: content => content ? ` ${content} ` : '' });
converter.addRule('images', {
 filter: 'img',
 replacement: (_content, node) => node.getAttribute('alt') ? `![${node.getAttribute('alt')}](${new URL(node.getAttribute('src'), 'https://horyzon.it').href})` : '',
});
converter.addRule('absoluteLinks', {
 filter: node => node.nodeName === 'A' && node.hasAttribute('href'),
 replacement: (content, node) => {
  const label = content.replace(/^#{1,6}\s+/gm, '').replace(/\s+/g, ' ').trim();
  const separator = /\n/.test(content) || node.parentNode.nodeName === 'NAV' ? '\n\n' : ' ';
  return label ? `${separator}[${label}](${new URL(node.getAttribute('href'), 'https://horyzon.it').href})${separator}` : '';
 },
});
converter.addRule('decorative', { filter: node => node.getAttribute('aria-hidden') === 'true' || node.hasAttribute('hidden'), replacement: () => '' });
const markdown = converter.turndown(body).trim() + '\n';
assert(/^# Far stare bene un’impresa, _?davvero\._?$/m.test(markdown));
assert(!markdown.includes('self.__next_f'));
await writeFile('public/home.md', markdown);
console.log(`Homepage Markdown: ${Buffer.byteLength(markdown)} bytes, derived from ${Buffer.byteLength(html)} bytes of HTML`);
