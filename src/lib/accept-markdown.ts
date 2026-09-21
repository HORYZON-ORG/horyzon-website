// Markdown is opt-in. Wildcards alone must keep normal browser HTML.
export function prefersMarkdown(accept: string | null): boolean {
 const ranges = (accept ?? '').toLowerCase().split(',').map((part, index) => {
  const [type, ...parameters] = part.trim().split(';');
  const quality = parameters.map(value => value.trim()).find(value => value.startsWith('q='));
  const q = quality === undefined ? 1 : Number(quality.slice(2));
  return { type: type.trim(), q: Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0, index };
 });
 const markdown = ranges.find(range => range.type === 'text/markdown');
 if (!markdown || markdown.q === 0) return false;
 const html = ranges.find(range => range.type === 'text/html')
  ?? ranges.find(range => range.type === 'text/*')
  ?? ranges.find(range => range.type === '*/*');
 return !html || markdown.q > html.q || (markdown.q === html.q && markdown.index < html.index);
}
