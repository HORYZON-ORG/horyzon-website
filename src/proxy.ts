import { NextRequest, NextResponse } from 'next/server';
import { patrimonialRadarMode } from './lib/patrimonial-radar-ui/public-mode';
import { prefersMarkdown } from './lib/accept-markdown';
import {accountConfig} from './lib/patrimonial-radar-server/account-config';

export function proxy(request: NextRequest) {
 if(request.nextUrl.pathname==='/radar-patrimoniale') {
  try {
   const account=accountConfig(process.env);
   if(account?.beta&&request.nextUrl.origin!==account.origin)return new NextResponse(null,{status:404,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'}});
  }catch{return new NextResponse(null,{status:404,headers:{'Cache-Control':'private, no-store'}});}
  const requestHeaders=new Headers(request.headers);
  requestHeaders.delete('x-horyzon-radar-document');
  const anonymous=patrimonialRadarMode(process.env)==='PUBLIC_ANONYMOUS';
  const identified=patrimonialRadarMode(process.env)==='VERIFIED_PERSISTENT';
  if(anonymous) requestHeaders.set('x-horyzon-radar-document','anonymous');
  if(identified) requestHeaders.set('x-horyzon-radar-document','identified');
  const isolated=NextResponse.next({request:{headers:requestHeaders}});
  isolated.headers.set('Cache-Control','no-store, private');
  isolated.headers.set('CDN-Cache-Control','private, no-store');
  isolated.headers.set('Vercel-CDN-Cache-Control','private, no-store');
  if(identified) isolated.headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'"+(process.env.NODE_ENV==='development'?" 'unsafe-eval'":"")+"; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'"+(process.env.NODE_ENV==='development'?" ws: wss:":"")+"; worker-src 'none'; form-action 'self'; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'");
  if(anonymous) isolated.headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'"+(process.env.NODE_ENV==='development'?" 'unsafe-eval'":"")+"; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src "+(process.env.NODE_ENV==='development'?"'self' ws: wss:":"'none'")+"; worker-src 'none'; form-action 'none'; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'");
  return isolated;
 }
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
] }, '/radar-patrimoniale'] };
