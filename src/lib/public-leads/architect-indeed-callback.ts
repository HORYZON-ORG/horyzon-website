import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

type Env = Record<string, string | undefined>;
type Dependencies = { fetch?: typeof fetch; now?: () => number };

const SESSION_COOKIE = "horyzon_architect_indeed";
const COOKIE_PATH = "/api/architect-startup/indeed-callback";
// This measures minimum elapsed time, not whether someone watched the video.
const MIN_ELAPSED_MS = 438_000;
const MAX_ELAPSED_MS = 24 * 60 * 60 * 1_000;
const MAX_BODY_BYTES = 2_048;
const SUPABASE_ORIGIN = "https://pmkyeqrfkunypfkbjnyg.supabase.co";
const MAIL_RECIPIENT = "angelo.ria.chetta@horyzon.it";
const OFFICIAL_ORIGINS = new Set(["https://horyzon.it", "https://www.horyzon.it"]);
const NONCE = /^[A-Za-z0-9_-]{22}$/;
const SIGNATURE = /^[A-Za-z0-9_-]{43}$/;
const CONTROL_CHARS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
const UNAVAILABLE = "La richiesta di ricontatto non è disponibile al momento. Riprova più tardi.";

function getConfig(env: Env) {
  const secret = env.ARCHITECT_INDEED_CALLBACK_SECRET;
  const from = env.ARCHITECT_INDEED_CALLBACK_EMAIL_FROM?.trim() || env.ANNUNCI10X_EMAIL_FROM?.trim();
  const apiKey = env.RESEND_API_KEY?.trim();
  const supabase = (env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL)?.trim().replace(/\/+$/, "");
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (env.ARCHITECT_INDEED_CALLBACK_ENABLED !== "true" || !secret || secret.trim().length < 32
    || !from || !isHoryzonSender(from) || !apiKey?.startsWith("re_") || apiKey.length <= 3
    || supabase !== SUPABASE_ORIGIN || !serviceRole) {
    return null;
  }
  return { secret, from, apiKey, serviceRole };
}

export function indeedStartupCallbackReady(env: Env = process.env): boolean {
  return getConfig(env) !== null;
}

function isHoryzonSender(value: string) {
  if (value.length > 160 || CONTROL_CHARS.test(value)) return false;
  const address = value.match(/^[^<>]+ <([^<>]+)>$/u)?.[1] ?? value;
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@horyzon\.it$/i.test(address);
}

function respond(payload: Record<string, unknown>, status = 200, extras: HeadersInit = {}) {
  const headers = new Headers(extras);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return Response.json(payload, { status, headers });
}

function fail(status: number, message: string, extras?: HeadersInit) {
  return respond({ ok: false, message }, status, extras);
}

function isAllowedOrigin(request: Request, env: Env) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin !== url.origin) return false;
  if (OFFICIAL_ORIGINS.has(origin)) return true;
  return env.NODE_ENV !== "production" && url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function readPayload(request: Request): Promise<Record<string, unknown> | Response> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return fail(415, "Formato della richiesta non valido.");
  }
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) > MAX_BODY_BYTES) {
    return fail(413, "La richiesta è troppo lunga.");
  }
  const reader = request.body?.getReader();
  if (!reader) return fail(400, "Richiesta non valida.");
  try {
    let size = 0;
    let json = "";
    const decoder = new TextDecoder("utf-8", { fatal: true });
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        void reader.cancel().catch(() => {});
        return fail(413, "La richiesta è troppo lunga.");
      }
      json += decoder.decode(value, { stream: true });
    }
    json += decoder.decode();
    const parsed: unknown = JSON.parse(json);
    return isObject(parsed) ? parsed : fail(400, "Richiesta non valida.");
  } catch {
    return fail(400, "Richiesta non valida.");
  } finally {
    reader.releaseLock();
  }
}

function existingCookie(request: Request) {
  const value = request.headers.get("cookie")?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return value && NONCE.test(value) ? value : null;
}

function mac(secret: string, purpose: string, value: string) {
  return createHmac("sha256", secret).update(`${purpose}\n${value}`).digest("base64url");
}

function startSession(request: Request, secret: string, now: number) {
  const browser = existingCookie(request) ?? randomBytes(16).toString("base64url");
  const payload = `v1.${now}.${randomBytes(16).toString("base64url")}`;
  const token = `${payload}.${mac(secret, "architect-indeed-session-bari", `${payload}.${browser}`)}`;
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return respond({ ok: true, token }, 200, {
    "Set-Cookie": `${SESSION_COOKIE}=${browser}; Path=${COOKIE_PATH}; Max-Age=${MAX_ELAPSED_MS / 1000}; HttpOnly; SameSite=Lax${secure}`,
  });
}

function verifySession(request: Request, secret: string, token: unknown, now: number) {
  const browser = existingCookie(request);
  if (!browser || typeof token !== "string" || token.length > 96) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [version, issuedAt, nonce, signature] = parts;
  if (version !== "v1" || !/^\d{13}$/.test(issuedAt) || !NONCE.test(nonce) || !SIGNATURE.test(signature)) return null;
  const expected = mac(secret, "architect-indeed-session-bari", `${version}.${issuedAt}.${nonce}.${browser}`);
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const elapsed = now - Number(issuedAt);
  if (elapsed < 0 || elapsed > MAX_ELAPSED_MS) return null;
  return { token, elapsed };
}

function normalizeEmail(input: unknown): string | null {
  if (typeof input !== "string" || CONTROL_CHARS.test(input)) return null;
  const email = input.trim();
  if (email.length > 254) return null;
  const [local, domain, extra] = email.split("@");
  if (extra !== undefined || !local || !domain || local.length > 64 || local.includes("..")
    || !/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/i.test(local) || local.startsWith(".") || local.endsWith(".")
    || !domain.includes(".") || !domain.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) {
    return null;
  }
  return `${local}@${domain.toLowerCase()}`;
}

function normalizeName(input: unknown): string | null {
  if (typeof input !== "string" || CONTROL_CHARS.test(input)) return null;
  const name = input.trim().replace(/\s+/g, " ");
  return name.length >= 2 && name.length <= 120 ? name : null;
}

function trustedSource(request: Request, env: Env) {
  // Vercel sets this header; never trust a caller-supplied X-Forwarded-For.
  if (env.VERCEL !== "1") return "unknown";
  const address = request.headers.get("x-vercel-forwarded-for")?.trim().toLowerCase();
  if (!address || !isIP(address)) return "unknown";
  return new URL(isIP(address) === 6 ? `http://[${address}]` : `http://${address}`).hostname;
}

async function rateLimit(fetcher: typeof fetch, key: string, scope: string, subject: string, limit: number, seconds: number) {
  const response = await fetcher(`${SUPABASE_ORIGIN}/rest/v1/rpc/annunci10x_check_rate_limit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Profile": "public",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ p_scope: scope, p_subject: subject, p_limit: limit, p_window_seconds: seconds }),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(3_000),
  });
  if (!response.ok) throw new Error("Rate limit service unavailable");
  const result: unknown = await response.json();
  if (!isObject(result) || typeof result.allowed !== "boolean") throw new Error("Invalid rate limit response");
  if (!result.allowed) {
    const retryAfter = Number(result.retry_after_seconds);
    return fail(429, "Troppe richieste di ricontatto. Riprova più tardi.", {
      "Retry-After": String(Number.isSafeInteger(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, seconds) : 60),
    });
  }
  return null;
}

export async function handleIndeedStartupCallback(request: Request, env: Env = process.env, dependencies: Dependencies = {}) {
  const config = getConfig(env);
  if (!config) return fail(503, UNAVAILABLE);
  if (request.method !== "POST") return fail(405, "Metodo non consentito.", { Allow: "POST" });
  if (!isAllowedOrigin(request, env)) return fail(403, "Origine della richiesta non consentita.");
  const payload = await readPayload(request);
  if (payload instanceof Response) return payload;
  const now = (dependencies.now ?? Date.now)();
  if (payload.action === "start") return startSession(request, config.secret, now);
  if (payload.action !== "confirm" || payload.contactRequested !== true) {
    return fail(400, "Conferma esplicitamente che desideri essere ricontattato.");
  }
  const fullName = normalizeName(payload.fullName);
  const email = normalizeEmail(payload.email);
  if (!fullName || !email) return fail(400, "Inserisci nome, cognome e un indirizzo email valido.");
  const session = verifySession(request, config.secret, payload.token, now);
  if (!session) return fail(409, "Sessione non valida o scaduta. Ricarica la pagina e avvia nuovamente il video.");
  if (session.elapsed < MIN_ELAPSED_MS) {
    return fail(409, "È troppo presto per confermare. Attendi la fine del video e riprova.");
  }

  const fetcher = dependencies.fetch ?? fetch;
  try {
    const source = mac(config.secret, "architect-indeed-source-bari", trustedSource(request, env));
    const emailKey = mac(config.secret, "architect-indeed-email-bari", email.toLowerCase());
    // The RPC permits underscores, not hyphens, in scope names.
    const limited = await rateLimit(fetcher, config.serviceRole, "architect_indeed_ip", source, 8, 3_600)
      ?? await rateLimit(fetcher, config.serviceRole, "architect_indeed_email", emailKey, 3, 86_400)
      ?? await rateLimit(fetcher, config.serviceRole, "architect_indeed_global", "bari", 50, 86_400);
    if (limited) return limited;

    const sent = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        "Idempotency-Key": `architect-indeed-bari-v1-${mac(config.secret, "architect-indeed-send-bari", session.token)}`,
      },
      body: JSON.stringify({
        from: config.from,
        to: [MAIL_RECIPIENT],
        subject: "Startup HORYZON · richiesta di ricontatto da Indeed (Bari)",
        text: [
          "Nuova richiesta di ricontatto dalla pagina Startup, pilota Indeed Bari.",
          `Nome e cognome dichiarati: ${fullName}`,
          `Email dichiarata: ${email}`,
          "",
          "La persona ha confermato di voler essere ricontattata. Verifica la candidatura su Indeed prima di smistare la richiesta.",
        ].join("\n"),
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    if (!sent.ok) return fail(503, UNAVAILABLE);
    const result: unknown = await sent.json();
    if (!isObject(result) || typeof result.id !== "string" || !result.id.trim()) return fail(503, UNAVAILABLE);
    return respond({ ok: true });
  } catch {
    return fail(503, UNAVAILABLE);
  }
}
