import assert from 'node:assert/strict';
import { prefersMarkdown } from '../src/lib/accept-markdown.ts';

for (const [accept, expected] of [
 [null, false], ['*/*', false], ['text/html', false], ['text/markdown', true],
 ['text/markdown, text/html, */*', true], ['text/html, text/markdown', false],
 ['text/markdown;q=0, */*', false], ['text/markdown;q=0.5, text/html', false],
 ['text/html;q=0.5, text/markdown', true], ['TEXT/MARKDOWN; charset=utf-8', true],
 ['text/markdown;q=bad', false], ['text/markdown;q=2', false],
 ['text/markdown;q=0.8, text/html;q=0, */*', true],
]) assert.equal(prefersMarkdown(accept), expected, accept);

const base = process.argv[2];
if (base) {
 const get = async headers => {
  const response = await fetch(base + '/', { headers, redirect: 'manual' });
  assert.equal(response.status, 200);
  // Vercel's Next static adapter replaces Vary on HTML. Its CDN includes
  // Accept in the cache key by default; downstream caches must revalidate.
  if (!/\baccept\b/i.test(response.headers.get('vary') ?? '')) {
   assert.equal(response.headers.get('server'), 'Vercel');
   assert.match(response.headers.get('cache-control'), /max-age=0/);
   assert.match(response.headers.get('cache-control'), /must-revalidate/);
  }
  assert.match(response.headers.get('vary'), /\brsc\b/i);
  assert(!response.headers.get('x-robots-tag')?.includes('noindex'), 'Negotiation must not noindex the homepage');
  return { response, body: await response.text() };
 };
 for (let repeat = 0; repeat < 2; repeat++) {
  const md = await get({ accept: 'text/markdown' });
  assert.match(md.response.headers.get('vary'), /\baccept\b/i);
  assert.match(md.response.headers.get('content-type'), /^text\/markdown; charset=utf-8$/i);
  assert(md.body.includes('# La tua impresa ha un orizzonte.'));
  assert(md.body.includes('https://hub.horyzon.it/radar'));
  assert(!md.body.includes('<script') && !md.body.includes('self.__next_f'));
  for (const accept of ['text/html', '*/*', 'text/markdown;q=0, text/html']) {
   const html = await get({ accept });
   assert.match(html.response.headers.get('content-type'), /^text\/html/i);
   assert(html.body.includes('<h1'));
   assert(html.body.includes('La tua impresa ha un orizzonte.'));
   assert.notEqual(html.response.headers.get('etag'), md.response.headers.get('etag'));
   for (const [variant, etag] of [['text/html', md.response.headers.get('etag')], ['text/markdown', html.response.headers.get('etag')]]) {
    assert(etag);
    const revalidated = await fetch(base + '/', { headers: { accept: variant, 'if-none-match': etag } });
    assert.equal(revalidated.status, 200, 'A different representation must not return 304');
    assert.match(revalidated.headers.get('content-type'), new RegExp(`^${variant}`));
   }
  }
 }
 const rsc = await fetch(base + '/', { headers: { accept: 'text/markdown', rsc: '1' } });
 assert(!rsc.headers.get('content-type')?.startsWith('text/markdown'), 'RSC must bypass negotiation');
 const direct = await fetch(base + '/home.md');
 assert.equal(direct.status, 200);
 assert.match(direct.headers.get('content-type'), /^text\/markdown/i);
 assert.match(direct.headers.get('x-robots-tag'), /noindex/);
 const head = await fetch(base + '/', { method: 'HEAD', headers: { accept: 'text/markdown' } });
 assert.equal(head.status, 200);
 assert.match(head.headers.get('content-type'), /^text\/markdown/i);
 assert.equal(await head.text(), '');
}
console.log(`Markdown negotiation passed${base ? `: ${base}` : ' (Accept unit cases)'}`);
