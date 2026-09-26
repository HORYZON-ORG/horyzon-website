import { createHash } from 'node:crypto';
import { lookup as dnsLookup } from 'node:dns/promises';
import net from 'node:net';
import { ANNUNCI10X_MAX_AD_CHARS, ANNUNCI10X_MIN_AD_CHARS, Annunci10xPublicError } from './product-flow.ts';
import type { PublicationChannel } from './types.ts';

export type Annunci10xSourceKind = 'PASTED_TEXT' | 'PUBLIC_URL';
export type Annunci10xSourceStatus = 'READY' | 'URL_FETCH_FAILED' | 'INVALID_SOURCE';

export interface Annunci10xSourceInput {
  kind: Annunci10xSourceKind;
  text?: string;
  url?: string;
  declaredChannel?: PublicationChannel;
}

export interface Annunci10xPreparedSource {
  kind: Annunci10xSourceKind;
  sourceStatus: Annunci10xSourceStatus;
  originalInput: string;
  sourceUrl?: string | null;
  fetchedText?: string | null;
  targetText?: string | null;
  sourceHash: string;
  retrievalMetadata: Record<string, unknown>;
  failureCode?: string | null;
  failureMessage?: string | null;
  declaredChannel?: PublicationChannel | null;
}

export interface FetchPublicUrlOptions {
  fetchImpl?: typeof fetch;
  resolveHost?: (hostname: string) => Promise<string[]>;
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
}

const USER_AGENT = 'Horyzon Annunci10x Source Fetcher/1.0 (+https://horyzon.it)';
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_MAX_BYTES = 600_000;
const ALLOWED_CONTENT_TYPES = ['text/html', 'text/plain', 'application/xhtml+xml'];

export async function prepareAnnunci10xSource(input: Annunci10xSourceInput, options: FetchPublicUrlOptions = {}): Promise<Annunci10xPreparedSource> {
  if (input.kind === 'PASTED_TEXT') return preparePastedText(input.text, input.declaredChannel);
  if (input.kind === 'PUBLIC_URL') return preparePublicUrl(input.url, input.declaredChannel, options);
  throw new Annunci10xPublicError('INVALID_INPUT', 'Sorgente annuncio non supportata.', 400);
}

export function preparePastedText(text: unknown, declaredChannel?: PublicationChannel): Annunci10xPreparedSource {
  if (typeof text !== 'string') throw new Annunci10xPublicError('INVALID_INPUT', 'Incolla il testo dell annuncio.', 400);
  const targetText = text.trim().replace(/\r\n/g, '\n');
  if (targetText.length < ANNUNCI10X_MIN_AD_CHARS) throw new Annunci10xPublicError('INVALID_INPUT', 'Il testo e troppo breve per una valutazione utile.', 400);
  if (targetText.length > ANNUNCI10X_MAX_AD_CHARS) throw new Annunci10xPublicError('INVALID_INPUT', 'Il testo supera il limite massimo per l analisi gratuita.', 413);
  return {
    kind: 'PASTED_TEXT',
    sourceStatus: 'READY',
    originalInput: text,
    sourceUrl: null,
    fetchedText: null,
    targetText,
    sourceHash: contentHash(targetText),
    retrievalMetadata: { normalization: 'trim-crlf-only', length: targetText.length },
    declaredChannel: declaredChannel ?? null,
  };
}

export async function preparePublicUrl(url: unknown, declaredChannel?: PublicationChannel, options: FetchPublicUrlOptions = {}): Promise<Annunci10xPreparedSource> {
  if (typeof url !== 'string' || !url.trim()) throw new Annunci10xPublicError('INVALID_INPUT', 'URL annuncio non valido.', 400);
  const originalInput = url.trim();
  try {
    const fetched = await fetchPublicJobAd(originalInput, options);
    const targetText = extractJobAdText(fetched.body);
    if (targetText.length < ANNUNCI10X_MIN_AD_CHARS) {
      return failedUrlSource(originalInput, 'URL_FETCH_FAILED', 'La pagina non contiene abbastanza testo utile.', {
        ...fetched.metadata,
        extraction: 'INSUFFICIENT_TEXT',
      }, declaredChannel);
    }
    return {
      kind: 'PUBLIC_URL',
      sourceStatus: 'READY',
      originalInput,
      sourceUrl: fetched.finalUrl,
      fetchedText: fetched.body,
      targetText: targetText.slice(0, ANNUNCI10X_MAX_AD_CHARS),
      sourceHash: contentHash(targetText),
      retrievalMetadata: { ...fetched.metadata, extraction: 'HTML_TEXT' },
      declaredChannel: declaredChannel ?? null,
    };
  } catch (error) {
    return failedUrlSource(originalInput, 'URL_FETCH_FAILED', publicSourceFailureMessage(error), sanitizeSourceError(error), declaredChannel);
  }
}

export async function fetchPublicJobAd(url: string, options: FetchPublicUrlOptions = {}): Promise<{ finalUrl: string; body: string; metadata: Record<string, unknown> }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let current = parseAllowedPublicUrl(url);
  const redirects: string[] = [];

  for (let attempt = 0; attempt <= maxRedirects; attempt += 1) {
    await assertPublicHostname(current.hostname, options.resolveHost);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        credentials: 'omit',
        cache: 'no-store',
        headers: {
          accept: 'text/html,text/plain,application/xhtml+xml;q=0.9,*/*;q=0.1',
          'user-agent': USER_AGENT,
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (isRedirect(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new SourceFetchError('URL_FETCH_FAILED', 'Redirect without location.');
      if (attempt === maxRedirects) throw new SourceFetchError('URL_TOO_MANY_REDIRECTS', 'Too many redirects.');
      current = parseAllowedPublicUrl(new URL(location, current).toString());
      redirects.push(current.toString());
      continue;
    }

    if (!response.ok) throw new SourceFetchError('URL_FETCH_FAILED', `Fetch failed with status ${response.status}.`);
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) throw new SourceFetchError('URL_CONTENT_TYPE_UNSUPPORTED', 'Unsupported content type.');
    const body = await readLimitedText(response, maxBytes);
    return {
      finalUrl: current.toString(),
      body,
      metadata: {
        finalUrl: current.toString(),
        redirectCount: redirects.length,
        redirects,
        contentType,
        byteLength: new TextEncoder().encode(body).byteLength,
      },
    };
  }
  throw new SourceFetchError('URL_TOO_MANY_REDIRECTS', 'Too many redirects.');
}

export function extractJobAdText(htmlOrText: string): string {
  const jsonLd = extractJobPostingJsonLd(htmlOrText);
  if (jsonLd) return compactText(jsonLd);
  const semantic = firstMatch(htmlOrText, [
    /<main\b[^>]*>([\s\S]*?)<\/main>/i,
    /<article\b[^>]*>([\s\S]*?)<\/article>/i,
    /<[^>]+(?:class|id)=["'][^"']*(?:job-description|jobDescription|description|annuncio|offerta)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
  ]);
  return compactText(stripHtml(semantic ?? htmlOrText));
}

export function createAnalysisInputIdentity(input: {
  sourceHash: string;
  targetKind: string;
  declaredChannel?: PublicationChannel | null;
  methodVersion: string;
  rubricVersion: string;
  promptVersion: string;
  scoreSemanticsVersion: string;
  model: string;
  evaluationMode: string;
}): string {
  return `a10x_run_${stableHash(input)}`;
}

function failedUrlSource(originalInput: string, code: string, message: string, metadata: Record<string, unknown>, declaredChannel?: PublicationChannel): Annunci10xPreparedSource {
  return {
    kind: 'PUBLIC_URL',
    sourceStatus: 'URL_FETCH_FAILED',
    originalInput,
    sourceUrl: originalInput,
    fetchedText: null,
    targetText: null,
    sourceHash: contentHash(originalInput),
    retrievalMetadata: metadata,
    failureCode: code,
    failureMessage: message,
    declaredChannel: declaredChannel ?? null,
  };
}

function parseAllowedPublicUrl(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new SourceFetchError('URL_INVALID', 'Invalid URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new SourceFetchError('URL_SCHEME_BLOCKED', 'Blocked URL scheme.');
  if (!parsed.hostname || isInternalHostname(parsed.hostname)) throw new SourceFetchError('URL_HOST_BLOCKED', 'Blocked hostname.');
  return parsed;
}

async function assertPublicHostname(hostname: string, resolveHost: FetchPublicUrlOptions['resolveHost']): Promise<void> {
  const literal = net.isIP(hostname);
  const addresses = literal ? [hostname] : await (resolveHost ?? defaultResolveHost)(hostname);
  if (!addresses.length) throw new SourceFetchError('URL_DNS_FAILED', 'Hostname did not resolve.');
  for (const address of addresses) {
    if (!isPublicIp(address)) throw new SourceFetchError('URL_PRIVATE_ADDRESS_BLOCKED', 'Resolved address is not public.');
  }
}

async function defaultResolveHost(hostname: string): Promise<string[]> {
  const results = await dnsLookup(hostname, { all: true, verbatim: true });
  return results.map((item) => item.address);
}

function isInternalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  return normalized === 'localhost' || normalized.endsWith('.localhost') || !normalized.includes('.');
}

function isPublicIp(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

function isPublicIpv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  return !(a >= 240);
}

function isPublicIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === '::1' || normalized === '::') return false;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return false;
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return false;
  if (normalized.startsWith('ff')) return false;
  if (normalized.startsWith('2001:db8')) return false;
  return true;
}

async function readLimitedText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) throw new SourceFetchError('URL_RESPONSE_TOO_LARGE', 'Response too large.');
    return text;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) throw new SourceFetchError('URL_RESPONSE_TOO_LARGE', 'Response too large.');
      chunks.push(value);
    }
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(concat(chunks, total));
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buffer;
}

function extractJobPostingJsonLd(html: string): string | null {
  const blocks = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of blocks) {
    const content = block.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '');
    try {
      const parsed = JSON.parse(decodeHtml(content));
      const posting = findJobPosting(parsed);
      if (posting) return jobPostingToText(posting);
    } catch {
      continue;
    }
  }
  return null;
}

function findJobPosting(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  const type = value['@type'];
  const types = Array.isArray(type) ? type.map(String) : [String(type ?? '')];
  if (types.some((item) => item.toLowerCase() === 'jobposting')) return value;
  const graph = value['@graph'];
  return graph ? findJobPosting(graph) : null;
}

function jobPostingToText(posting: Record<string, unknown>): string {
  return [
    field(posting.title),
    stripHtml(field(posting.description)),
    field(isRecord(posting.hiringOrganization) ? posting.hiringOrganization.name : null),
    field(posting.employmentType),
    field(posting.jobLocation),
    field(posting.baseSalary),
  ].filter(Boolean).join('\n');
}

function field(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(field).filter(Boolean).join(' ');
  if (isRecord(value)) return Object.values(value).map(field).filter(Boolean).join(' ');
  if (value === null || value === undefined) return '';
  return String(value);
}

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function stripHtml(html: string): string {
  return decodeHtml(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function decodeHtml(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

function compactText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function contentHash(text: string): string {
  return stableHash(text.trim().replace(/\s+/g, ' '));
}

function stableHash(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sanitizeSourceError(error: unknown): Record<string, unknown> {
  if (error instanceof SourceFetchError) return { code: error.code };
  if (error instanceof DOMException && error.name === 'AbortError') return { code: 'URL_FETCH_TIMEOUT' };
  return { code: 'URL_FETCH_FAILED' };
}

function publicSourceFailureMessage(error: unknown): string {
  if (error instanceof SourceFetchError && error.code === 'URL_PRIVATE_ADDRESS_BLOCKED') return 'URL non accessibile per motivi di sicurezza.';
  if (error instanceof SourceFetchError && error.code === 'URL_CONTENT_TYPE_UNSUPPORTED') return 'La pagina non contiene HTML o testo analizzabile.';
  if (error instanceof SourceFetchError && error.code === 'URL_RESPONSE_TOO_LARGE') return 'La pagina e troppo grande per l analisi automatica.';
  if (error instanceof DOMException && error.name === 'AbortError') return 'Timeout durante il recupero dell URL.';
  return 'URL non accessibile. Incolla il testo dell annuncio.';
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

class SourceFetchError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SourceFetchError';
    this.code = code;
  }
}
