import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_REDIRECTS = 4;
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_BYTES = 900_000;
const AUDIT_USER_AGENT = 'Horyzon-AI-Score/1.0 (+https://horyzon.it/ai-score)';

export class SafeFetchError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = 'SafeFetchError';
  }
}

export interface SafeFetchResult {
  url: string;
  status: number;
  headers: Headers;
  body: string;
  redirects: string[];
}

export function normalizeAuditUrl(input: string) {
  const candidate = input.trim();
  if (!candidate) throw new SafeFetchError('Inserisci un URL o dominio valido.');
  const withProtocol = /^[a-z][a-z\d+.-]*:/i.test(candidate) ? candidate : `https://${candidate}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new SafeFetchError('URL non valido.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new SafeFetchError('Sono consentiti solo URL http e https.');
  if (url.username || url.password) throw new SafeFetchError('URL con credenziali embedded non consentiti.');
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  if (!url.pathname) url.pathname = '/';
  return url;
}

export async function safeFetch(input: string | URL, options: { timeoutMs?: number; maxBytes?: number; maxRedirects?: number } = {}): Promise<SafeFetchResult> {
  let url = normalizeAuditUrl(input.toString());
  const redirects: string[] = [];
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    await assertPublicDestination(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: 'manual',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'user-agent': AUDIT_USER_AGENT,
          accept: 'text/html,application/xhtml+xml,text/plain,application/xml;q=0.8,*/*;q=0.2',
        },
      });
    } catch (error) {
      const message = error instanceof Error && error.name === 'AbortError' ? 'Timeout durante la richiesta.' : 'Impossibile raggiungere la destinazione.';
      throw new SafeFetchError(message, 502);
    } finally {
      clearTimeout(timeout);
    }

    if (isRedirect(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new SafeFetchError('Redirect senza destinazione valida.', 502);
      if (hop === maxRedirects) throw new SafeFetchError('Troppi redirect durante la scansione.', 508);
      url = normalizeAuditUrl(new URL(location, url).toString());
      redirects.push(url.toString());
      continue;
    }

    const body = await readLimitedBody(response, options.maxBytes ?? DEFAULT_MAX_BYTES);
    return { url: url.toString(), status: response.status, headers: response.headers, body, redirects };
  }
  throw new SafeFetchError('Troppi redirect durante la scansione.', 508);
}

async function assertPublicDestination(url: URL) {
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) throw new SafeFetchError('Destinazione locale non consentita.');
  const directIpVersion = net.isIP(url.hostname);
  const addresses = directIpVersion ? [{ address: url.hostname, family: directIpVersion }] : await resolveHostname(url.hostname);
  if (!addresses.length) throw new SafeFetchError('DNS resolution non riuscita.', 400);
  for (const address of addresses) {
    if (!isPublicIp(address.address)) throw new SafeFetchError('Destinazione non pubblica non consentita.');
  }
}

async function resolveHostname(hostname: string) {
  try {
    return await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new SafeFetchError('DNS resolution non riuscita.', 400);
  }
}

function isRedirect(status: number) {
  return [301, 302, 303, 307, 308].includes(status);
}

async function readLimitedBody(response: Response, maxBytes: number) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let body = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) throw new SafeFetchError('Risposta troppo grande per l’audit gratuito.', 413);
    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();
  return body;
}

function isPublicIp(ip: string) {
  return net.isIP(ip) === 4 ? isPublicIpv4(ip) : isPublicIpv6(ip);
}

function isPublicIpv4(ip: string) {
  const octets = ip.split('.').map(Number);
  if (octets.length !== 4 || octets.some(octet => Number.isNaN(octet) || octet < 0 || octet > 255)) return false;
  const value = (((octets[0] * 256 + octets[1]) * 256 + octets[2]) * 256 + octets[3]) >>> 0;
  return ![
    [0x00000000, 0xff000000],
    [0x0a000000, 0xff000000],
    [0x64400000, 0xffc00000],
    [0x7f000000, 0xff000000],
    [0xa9fe0000, 0xffff0000],
    [0xac100000, 0xfff00000],
    [0xc0000000, 0xffffff00],
    [0xc0000200, 0xffffff00],
    [0xc0a80000, 0xffff0000],
    [0xc6120000, 0xfffe0000],
    [0xc6336400, 0xffffff00],
    [0xcb007100, 0xffffff00],
    [0xe0000000, 0xf0000000],
    [0xf0000000, 0xf0000000],
  ].some(([range, mask]) => (value & mask) === range);
}

function isPublicIpv6(ip: string) {
  const normalized = ip.toLowerCase();
  if (normalized === '::' || normalized === '::1') return false;
  if (normalized.startsWith('::ffff:')) return isPublicIpv4(normalized.slice(7));
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return false;
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return false;
  if (normalized.startsWith('ff')) return false;
  if (normalized.startsWith('2001:db8')) return false;
  return true;
}
