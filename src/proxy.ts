import { NextRequest, NextResponse } from 'next/server';
import { prefersMarkdown } from './lib/accept-markdown';

export function proxy(request: NextRequest) {
 const markdown = ['GET', 'HEAD'].includes(request.method)
  && prefersMarkdown(request.headers.get('accept'));
 const response = markdown
  ? NextResponse.rewrite(new URL('/home.md', request.url))
  : NextResponse.next();
 response.headers.set('Vary', 'Accept, RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch');
 if (markdown) {
  response.headers.set('Content-Type', 'text/markdown; charset=utf-8');
  response.headers.set('Link', '<https://horyzon.it>; rel="canonical"');
 }
 return response;
}

// Match before Next strips Flight headers from the proxy's Request object.
export const config = { matcher: [{ source: '/', missing: [
 { type: 'header', key: 'rsc' },
 { type: 'header', key: 'next-router-prefetch' },
 { type: 'header', key: 'next-router-segment-prefetch' },
] }] };
