import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib';
import type { IncomingHttpHeaders, IncomingMessage, RequestOptions } from 'node:http';
import { AI_SCORE_LIMITS } from './limits';
import { abortable } from './deadline';

export const AUDIT_USER_AGENT = 'HoryzonAIScoreBot/1.0 (+https://horyzon.it/ai-score/methodology)';

type PinnedLookupOptions = { all?: boolean } | null | undefined;
type PinnedLookupAddress = { address: string; family: 4 | 6 };
type PinnedLookupCallback = (error: NodeJS.ErrnoException | null, address: string | PinnedLookupAddress[], family?: number) => void;
type PinnedLookup = (hostname: string, options: PinnedLookupOptions, callback: PinnedLookupCallback) => void;
type PinnedRequestOptions = RequestOptions & { lookup: PinnedLookup; servername?: string };

export class UnsafeAuditUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeAuditUrlError';
  }
}

export interface SafeFetchResult {
  url: string;
  status: number;
  headers: Headers;
  body: string;
  redirects: string[];
}

export interface SafeFetchOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

const METADATA_IP = '169.254.169.254';
const RESERVED_HOSTS = new Set(['localhost', 'localhost.localdomain', 'ip6-localhost', 'ip6-loopback']);

export function normalizeAuditUrl(rawInput: string): URL {
  const trimmed = rawInput.trim();
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;

  try {
    url = new URL(withProtocol);
  } catch {
    throw new UnsafeAuditUrlError('URL non valido. Inserisci un dominio pubblico o un URL completo.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new UnsafeAuditUrlError('Sono consentiti solo URL http e https.');
  }

  if (url.username || url.password) {
    throw new UnsafeAuditUrlError('URL con credenziali incorporate non consentiti.');
  }

  url.hash = '';
  const hostname = stripIpv6Brackets(url.hostname).toLowerCase();
  if (!hostname || RESERVED_HOSTS.has(hostname) || hostname.endsWith('.localhost')) {
    throw new UnsafeAuditUrlError('Destinazione locale non consentita.');
  }
  if (net.isIP(hostname) && !isPublicIp(hostname)) throw new UnsafeAuditUrlError('Destinazione non pubblica non consentita.');

  return url;
}

export async function safeFetch(rawInput: string | URL, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const maxRedirects = options.maxRedirects ?? AI_SCORE_LIMITS.maxRedirects;
  const redirects: string[] = [];
  let current = typeof rawInput === 'string' ? normalizeAuditUrl(rawInput) : normalizeAuditUrl(rawInput.toString());

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    options.signal?.throwIfAborted();
    const response = await fetchOnceWithPinnedDns(current, {
      timeoutMs: options.timeoutMs ?? AI_SCORE_LIMITS.timeoutMs,
      maxBytes: options.maxBytes ?? AI_SCORE_LIMITS.maxBytesPerPage,
      signal: options.signal,
    });

    if (isRedirect(response.status)) {
      const location = response.headers.get('location');
      if (!location) return { ...response, redirects };
      if (redirectCount === maxRedirects) {
        throw new UnsafeAuditUrlError('Limite redirect superato durante la scansione.');
      }
      const next = normalizeAuditUrl(new URL(location, current).toString());
      redirects.push(next.toString());
      current = next;
      continue;
    }

    return { ...response, redirects };
  }

  throw new UnsafeAuditUrlError('Limite redirect superato durante la scansione.');
}

async function fetchOnceWithPinnedDns(url: URL, options: Required<Pick<SafeFetchOptions, 'timeoutMs' | 'maxBytes'>> & Pick<SafeFetchOptions, 'signal'>): Promise<Omit<SafeFetchResult, 'redirects'>> {
  const signal = AbortSignal.any([AbortSignal.timeout(options.timeoutMs), ...(options.signal ? [options.signal] : [])]);
  const address = await abortable(resolvePublicAddress(url), signal);
  const transport = url.protocol === 'https:' ? https : http;
  const lookup: PinnedLookup = (_hostname, lookupOptions, callback) => {
    if (lookupOptions?.all) {
      callback(null, [{ address: address.address, family: address.family }]);
      return;
    }
    callback(null, address.address, address.family);
  };

  return new Promise((resolve, reject) => {
    const requestOptions: PinnedRequestOptions = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      signal,
      timeout: options.timeoutMs,
      lookup,
      headers: {
        Host: url.host,
        'User-Agent': AUDIT_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
        'Accept-Encoding': 'identity',
      },
    };

    if (url.protocol === 'https:') {
      requestOptions.servername = stripIpv6Brackets(url.hostname);
    }

    const req = transport.request(requestOptions, (res: IncomingMessage) => {
      const chunks: Buffer[] = [];
      let total = 0;
      const encoding = String(res.headers['content-encoding'] ?? 'identity').toLowerCase();
      if (!['identity','gzip','deflate','br'].includes(encoding)) {
        req.destroy(new UnsafeAuditUrlError('Il sito invia una risposta compressa non supportata dalla scansione.'));
        res.resume();
        return;
      }
      const decoder = encoding === 'gzip' ? createGunzip() : encoding === 'deflate' ? createInflate() : encoding === 'br' ? createBrotliDecompress() : null;
      const body = decoder ? res.pipe(decoder) : res;
      if (decoder) {
        let encodedBytes=0;
        res.on('data',(chunk:Buffer)=>{encodedBytes+=chunk.length;if(encodedBytes>options.maxBytes)req.destroy(new UnsafeAuditUrlError('Risposta compressa troppo grande per l’audit gratuito.'));});
        res.on('error',error=>decoder.destroy(error));
      }

      body.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > options.maxBytes) {
          req.destroy(new UnsafeAuditUrlError('Risposta troppo grande per l’audit gratuito.'));
          return;
        }
        chunks.push(chunk);
      });

      body.on('end', () => {
        resolve({
          url: url.toString(),
          status: res.statusCode ?? 0,
          headers: toHeaders(res.headers),
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
      body.on('error', reject);
      res.on('aborted', () => { decoder?.destroy(); reject(new UnsafeAuditUrlError('La risposta del sito è stata interrotta.')); });
    });

    req.on('socket', (socket) => {
      socket.on('connect', () => {
        const remoteAddress = socket.remoteAddress;
        if (remoteAddress && !isPublicIp(remoteAddress)) {
          req.destroy(new UnsafeAuditUrlError('La destinazione risolta non è pubblica.'));
        }
      });
      socket.on('secureConnect', () => {
        const remoteAddress = socket.remoteAddress;
        if (remoteAddress && !isPublicIp(remoteAddress)) {
          req.destroy(new UnsafeAuditUrlError('La destinazione TLS risolta non è pubblica.'));
        }
      });
    });

    req.on('timeout', () => req.destroy(new UnsafeAuditUrlError('Timeout durante la scansione.')));
    req.on('error', reject);
    req.end();
  });
}

export async function resolvePublicAddress(url: URL): Promise<{ address: string; family: 4 | 6 }> {
  const hostname = stripIpv6Brackets(url.hostname).toLowerCase();
  const directFamily = net.isIP(hostname);

  if (directFamily) {
    if (!isPublicIp(hostname)) {
      throw new UnsafeAuditUrlError('Destinazione non pubblica non consentita.');
    }
    return { address: hostname, family: directFamily as 4 | 6 };
  }

  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  const publicRecords = records.filter((record) => isPublicIp(record.address));
  if (publicRecords.length !== records.length || publicRecords.length === 0) {
    throw new UnsafeAuditUrlError('La destinazione risolve verso indirizzi non pubblici.');
  }

  return {
    address: publicRecords[0].address,
    family: publicRecords[0].family as 4 | 6,
  };
}

export function isPublicIp(rawAddress: string): boolean {
  const address = stripIpv6Brackets(rawAddress).toLowerCase();
  const mappedV4 = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedV4) return isPublicIp(mappedV4[1]);
  const mappedHex = address.match(/^::ffff:([\da-f]{1,4}):([\da-f]{1,4})$/);
  if (mappedHex) {
    const high=parseInt(mappedHex[1],16),low=parseInt(mappedHex[2],16);
    return isPublicIpv4(`${high>>8}.${high&255}.${low>>8}.${low&255}`);
  }

  const family = net.isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

function isPublicIpv4(address: string): boolean {
  const parts = address.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  if (address === METADATA_IP) return false;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && parts[2] === 0) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && parts[2] === 2) return false;
  if (a === 198 && b === 51 && parts[2] === 100) return false;
  if (a === 203 && b === 0 && parts[2] === 113) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a >= 224) return false;
  return true;
}

function isPublicIpv6(address: string): boolean {
  // Only global unicast; transition/tunnel and mapped private destinations
  // must not reach an internal network before the post-connect check.
  const first=parseInt(address.split(':')[0] || '0',16);
  if (first<0x2000 || first>0x3fff || address.startsWith('2002:') || /^2001:0{1,4}:/.test(address)) return false;
  if (address === '::' || address === '::1') return false;
  if (address.startsWith('fc') || address.startsWith('fd')) return false;
  if (address.startsWith('fe8') || address.startsWith('fe9') || address.startsWith('fea') || address.startsWith('feb')) return false;
  if (address.startsWith('ff')) return false;
  if (address.startsWith('2001:db8:')) return false;
  if (address.startsWith('2001:2:') || /^2001:[12][0-9a-f]:/.test(address)) return false;
  return true;
}

function stripIpv6Brackets(hostname: string): string {
  return hostname.replace(/^\[/, '').replace(/\]$/, '');
}

function isRedirect(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

function toHeaders(source: IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value)) headers.set(key, value.join(', '));
    else if (typeof value === 'string') headers.set(key, value);
  }
  return headers;
}
