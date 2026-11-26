import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { handleIndeedStartupCallback, indeedStartupCallbackReady } from "../src/lib/public-leads/architect-indeed-callback.ts";

const initial = 1_795_608_000_000;
const soonEnough = initial + 438_000;
const url = "https://horyzon.it/api/architect-startup/indeed-callback";
const rpc = "https://pmkyeqrfkunypfkbjnyg.supabase.co/rest/v1/rpc/annunci10x_check_rate_limit";
const resend = "https://api.resend.com/emails";
const env = {
  NODE_ENV: "production",
  VERCEL: "1",
  ARCHITECT_INDEED_CALLBACK_ENABLED: "true",
  ARCHITECT_INDEED_CALLBACK_SECRET: "synthetic-session-secret-for-unit-tests",
  ANNUNCI10X_EMAIL_FROM: "Horyzon Testing <notifiche@horyzon.it>",
  RESEND_API_KEY: "re_synthetic_nonproduction_key",
  SUPABASE_SERVICE_ROLE_KEY: "synthetic_nonproduction_db_key",
  SUPABASE_URL: "https://pmkyeqrfkunypfkbjnyg.supabase.co/",
};
const candidate = {
  action: "confirm",
  fullName: "  Àda    Esempio  ",
  email: "  ada@EXAMPLE.ORG  ",
  contactRequested: true,
};
const allProvincesEnv = { ...env, ARCHITECT_INDEED_CALLBACK_EXTRA_PROVINCES: "lecce, brindisi,taranto" };

function request(payload, { headers = {}, customUrl = url, method = "POST", raw = false } = {}) {
  return new Request(customUrl, {
    method,
    headers: {
      Origin: "https://horyzon.it",
      "Content-Type": "application/json",
      ...headers,
    },
    ...(method === "POST" ? { body: raw ? payload : JSON.stringify(payload) } : {}),
  });
}

function tester({ settings = env, time = initial, rate, mail } = {}) {
  const calls = [];
  const deps = {
    now: () => time,
    fetch: async (path, init) => {
      assert.ok(path === rpc || path === resend, "no external destinations");
      const body = JSON.parse(init.body);
      calls.push({ path, headers: new Headers(init.headers), body });
      if (path === rpc) return rate ? rate(body) : Response.json({ allowed: true });
      return mail ? mail() : Response.json({ id: "synthetic-message" });
    },
  };
  return { calls, handle: (req) => handleIndeedStartupCallback(req, settings, deps) };
}

async function begin({ settings = env, province, reuseCookie } = {}) {
  const isolated = tester({ settings });
  const response = await isolated.handle(request({ action: "start", province }, {
    headers: reuseCookie ? { Cookie: reuseCookie } : {},
  }));
  assert.equal(response.status, 200);
  const { ok, token } = await response.json();
  assert.equal(ok, true);
  assert.match(token, /^v1\.\d{13}\.[\w-]{22}\.[\w-]{43}$/);
  assert.match(response.headers.get("set-cookie"), /HttpOnly; SameSite=Lax; Secure/);
  assert.match(response.headers.get("set-cookie"), /Max-Age=86400/);
  assert.match(response.headers.get("set-cookie"), /Path=\/api\/architect-startup\/indeed-callback/);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(isolated.calls.length, 0);
  return { token, cookie: response.headers.get("set-cookie").split(";")[0] };
}

test("requires explicit enablement and an approved mail and database configuration", async () => {
  assert.equal(indeedStartupCallbackReady(env), true);
  assert.equal(indeedStartupCallbackReady({ ...env, ARCHITECT_INDEED_CALLBACK_EMAIL_FROM: "" }), true);
  const variants = [
    { ARCHITECT_INDEED_CALLBACK_ENABLED: undefined },
    { ARCHITECT_INDEED_CALLBACK_SECRET: "short" },
    { ANNUNCI10X_EMAIL_FROM: "someone@external.example" },
    { ANNUNCI10X_EMAIL_FROM: undefined },
    { ANNUNCI10X_EMAIL_FROM: "Unsafe\r\nAlias <notifiche@horyzon.it>" },
    { SUPABASE_SERVICE_ROLE_KEY: undefined },
    { SUPABASE_URL: "https://pmkyeqrfkunypfkbjnyg.supabase.co.external.example" },
    { RESEND_API_KEY: "re_" },
  ];
  for (const variant of variants) {
    const settings = { ...env, ...variant };
    assert.equal(indeedStartupCallbackReady(settings), false);
    const isolated = tester({ settings });
    assert.equal((await isolated.handle(request({ action: "start" }))).status, 503);
    assert.equal(isolated.calls.length, 0);
  }
});

test("accepts only the matching Horyzon origin and JSON POST under the size limit", async () => {
  const { handle, calls } = tester();
  for (const [options, status] of [
    [{ headers: { Origin: "https://external.example" } }, 403],
    [{ headers: { Origin: "https://www.horyzon.it" } }, 403],
    [{ customUrl: "https://external.example/api", headers: { Origin: "https://external.example" } }, 403],
    [{ customUrl: "http://localhost:3000/api", headers: { Origin: "http://localhost:3000" } }, 403],
    [{ headers: { "Content-Type": "text/plain" } }, 415],
    [{ method: "GET" }, 405],
    [{ headers: { "Content-Length": "2049" } }, 413],
  ]) {
    assert.equal((await handle(request({ action: "start" }, options))).status, status);
  }
  assert.equal((await handle(request("{broken", { raw: true }))).status, 400);
  assert.equal((await handle(request(null))).status, 400);
  assert.equal((await handle(request({ action: "start", comment: "é".repeat(1100) }))).status, 413);
  assert.equal(calls.length, 0);
});

test("uses an expiring browser-bound session and requires explicit valid contact details", async () => {
  const { token, cookie } = await begin();
  const { handle, calls } = tester({ time: soonEnough });
  const next = await handle(request({ action: "start" }, { headers: { Cookie: cookie } }));
  assert.equal(next.headers.get("set-cookie").split(";")[0], cookie, "repeated play does not change the browser");

  for (const invalid of [
    { contactRequested: "true" },
    { contactRequested: false },
    { fullName: undefined },
    { fullName: "A" },
    { fullName: "A".repeat(121) },
    { fullName: "Ada\r\nBcc: X" },
    { email: undefined },
    { email: "ada@example.org\r\n" },
    { email: "ada@localhost" },
    { email: "ada@example.org, attacker@example.org" },
  ]) {
    const response = await handle(request({ ...candidate, token, ...invalid }, { headers: { Cookie: cookie } }));
    assert.equal(response.status, 400);
  }
  assert.equal((await handle(request({ ...candidate, token }))).status, 409);
  const tamperedToken = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
  const confirmation = (session) => request({ ...candidate, token: session }, { headers: { Cookie: cookie } });
  assert.equal((await handle(confirmation(tamperedToken))).status, 409);
  assert.equal((await tester({ time: soonEnough - 1 }).handle(confirmation(token))).status, 409);
  assert.equal((await tester({ time: initial - 1 }).handle(confirmation(token))).status, 409);
  assert.equal((await tester({ time: initial + 86_400_001 }).handle(confirmation(token))).status, 409);
  assert.equal(calls.length, 0);
});

test("sends a single internal email only after rate checks and uses a stable idempotency key", async () => {
  const { token, cookie } = await begin();
  const { handle, calls } = tester({ time: soonEnough });
  const confirm = () => request(
    { ...candidate, token, to: "untrusted@example.org", phone: "not required", cv: "not accepted" },
    { headers: { Cookie: cookie, "x-vercel-forwarded-for": "2001:db8::12", "x-forwarded-for": "192.0.2.5" } },
  );
  const first = await handle(confirm());
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { ok: true });
  assert.deepEqual(calls.map(({ path }) => path), [rpc, rpc, rpc, resend]);
  assert.deepEqual(calls.slice(0, 3).map(({ body }) => body.p_scope), [
    "architect_indeed_ip", "architect_indeed_email", "architect_indeed_global",
  ]);
  assert.match(calls[0].body.p_subject, /^[\w-]{43}$/);
  assert.match(calls[1].body.p_subject, /^[\w-]{43}$/);
  assert.equal(calls[2].body.p_subject, "bari");
  assert.deepEqual(calls[3].body.to, ["angelo.ria.chetta@horyzon.it"]);
  assert.equal(calls[3].body.from, env.ANNUNCI10X_EMAIL_FROM);
  assert.match(calls[3].body.text, /Nome e cognome dichiarati: Àda Esempio/);
  assert.match(calls[3].body.text, /Email dichiarata: ada@example.org/);
  assert.match(calls[3].body.text, /Verifica la candidatura su Indeed/);
  assert.doesNotMatch(JSON.stringify(calls[3].body), /reply_to|not accepted|not required|untrusted|attachments/);
  assert.match(calls[3].headers.get("idempotency-key"), /^architect-indeed-bari-v1-[\w-]{43}$/);
  assert.equal((await handle(confirm())).status, 200);
  assert.equal(calls[3].headers.get("idempotency-key"), calls[7].headers.get("idempotency-key"));
  assert.notEqual(calls[3].headers.get("authorization"), calls[0].headers.get("authorization"));
});

test("does not trust user forwarded IP addresses; fails closed for denied or unavailable services", async () => {
  const { token, cookie } = await begin();
  const confirm = (address = "192.0.2.20") => request({ ...candidate, token }, {
    headers: { Cookie: cookie, "x-forwarded-for": address },
  });

  const quota = tester({
    time: soonEnough,
    rate: () => Response.json({ allowed: false, retry_after_seconds: 81 }),
  });
  const limited = await quota.handle(confirm());
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "81");
  await quota.handle(confirm("192.0.2.21"));
  assert.equal(quota.calls[0].body.p_subject, quota.calls[1].body.p_subject);
  assert.ok(quota.calls.every(({ path }) => path === rpc));

  const dbError = tester({ time: soonEnough, rate: () => Response.json({}, { status: 500 }) });
  assert.equal((await dbError.handle(confirm())).status, 503);
  assert.equal(dbError.calls.length, 1);
  const malformedRate = tester({ time: soonEnough, rate: () => Response.json({ allowed: "true" }) });
  assert.equal((await malformedRate.handle(confirm())).status, 503);
  assert.equal(malformedRate.calls.length, 1);
  const mailError = tester({ time: soonEnough, mail: () => Response.json({}, { status: 401 }) });
  assert.equal((await mailError.handle(confirm())).status, 503);
  const mailNotAccepted = tester({ time: soonEnough, mail: () => Response.json({ id: "" }) });
  assert.equal((await mailNotAccepted.handle(confirm())).status, 503);
});

test("keeps the three new provinces off until enabled and rejects malformed province values", async () => {
  const normal = tester();
  const { token, cookie } = await begin();
  const confirm = (province) => request({ ...candidate, token, province }, { headers: { Cookie: cookie } });
  for (const province of ["lecce", "brindisi", "taranto"]) {
    assert.equal(indeedStartupCallbackReady(env, province), false);
    assert.equal(indeedStartupCallbackReady(allProvincesEnv, province), true);
    assert.equal((await normal.handle(request({ action: "start", province }))).status, 503);
    assert.equal((await normal.handle(confirm(province))).status, 503);
  }
  assert.equal(indeedStartupCallbackReady(env, "bari"), true);
  assert.equal(indeedStartupCallbackReady({ ...allProvincesEnv, ARCHITECT_INDEED_CALLBACK_ENABLED: "false" }, "lecce"), false);

  const allEnabled = tester({ settings: allProvincesEnv, time: soonEnough });
  for (const province of [null, ["lecce"], {}, 42, "", "Bari", " Brindisi", "foggia", "__proto__", "constructor"]) {
    assert.equal((await allEnabled.handle(request({ action: "start", province }))).status, 400);
    assert.equal((await allEnabled.handle(confirm(province))).status, 400);
  }
  assert.equal(normal.calls.length, 0);
  assert.equal(allEnabled.calls.length, 0);
});

test("cannot use a session to confirm another province; each enabled province tells only Angelo and shares the same quotas", async () => {
  const { token: bariToken, cookie: sharedCookie } = await begin();
  const { handle, calls } = tester({ settings: allProvincesEnv, time: soonEnough });
  const confirm = (token, province) => request({
    ...candidate,
    token,
    province,
    to: "another-recipient@example.org",
  }, { headers: { Cookie: sharedCookie, "x-vercel-forwarded-for": "192.0.2.15" } });
  assert.equal((await handle(confirm(bariToken, "brindisi"))).status, 409);
  assert.equal(calls.length, 0);

  for (const [province, label] of [["bari", "Bari"], ["brindisi", "Brindisi"], ["lecce", "Lecce"], ["taranto", "Taranto"]]) {
    const session = province === "bari" ? { token: bariToken, cookie: sharedCookie }
      : await begin({ settings: allProvincesEnv, province, reuseCookie: sharedCookie });
    assert.equal(session.cookie, sharedCookie);
    const mailCallsBefore = calls.length;
    for (const wrongProvince of ["bari", "brindisi", "lecce", "taranto"].filter((value) => value !== province)) {
      assert.equal((await handle(confirm(session.token, wrongProvince))).status, 409);
    }
    if (province !== "bari") assert.equal((await handle(confirm(session.token, undefined))).status, 409);
    assert.equal(calls.length, mailCallsBefore);
    const response = await handle(confirm(session.token, province));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    const [ip, email, global, mail] = calls.slice(mailCallsBefore);
    assert.deepEqual([ip.path, email.path, global.path, mail.path], [rpc, rpc, rpc, resend]);
    assert.deepEqual([ip.body, email.body, global.body], calls.slice(0, 3).map(({ body }) => body));
    assert.equal(global.body.p_limit, 50);
    assert.deepEqual(mail.body.to, ["angelo.ria.chetta@horyzon.it"]);
    assert.equal(mail.body.subject, `Startup HORYZON · richiesta di ricontatto da Indeed (${label})`);
    assert.match(mail.body.text, new RegExp(`pilota Indeed ${label}`));
    assert.match(mail.headers.get("idempotency-key"), new RegExp(`^architect-indeed-${province}-v1-[\\w-]{43}$`));
  }
});

test("accepts legacy Bari tokens with the original idempotency key and unchanged contents", async () => {
  const legacyCookie = "A".repeat(22);
  const legacyPayload = `v1.${initial}.${"B".repeat(22)}`;
  const legacyHmac = (purpose, value) => createHmac("sha256", env.ARCHITECT_INDEED_CALLBACK_SECRET)
    .update(`${purpose}\n${value}`).digest("base64url");
  const token = `${legacyPayload}.${legacyHmac("architect-indeed-session-bari", `${legacyPayload}.${legacyCookie}`)}`;
  const { handle, calls } = tester({ settings: allProvincesEnv, time: soonEnough });
  const confirmation = (province) => request({ ...candidate, token, province }, {
    headers: { Cookie: `horyzon_architect_indeed=${legacyCookie}` },
  });
  assert.equal((await handle(confirmation(undefined))).status, 200);
  assert.equal((await handle(confirmation("bari"))).status, 200);
  const expectedKey = `architect-indeed-bari-v1-${legacyHmac("architect-indeed-send-bari", token)}`;
  assert.equal(calls[3].headers.get("idempotency-key"), expectedKey);
  assert.equal(calls[7].headers.get("idempotency-key"), expectedKey);
  assert.deepEqual(calls[3].body, calls[7].body);
  assert.equal(calls[3].body.subject, "Startup HORYZON · richiesta di ricontatto da Indeed (Bari)");
  assert.equal(calls[3].body.text, [
    "Nuova richiesta di ricontatto dalla pagina Startup, pilota Indeed Bari.",
    "Nome e cognome dichiarati: Àda Esempio",
    "Email dichiarata: ada@example.org",
    "",
    "La persona ha confermato di voler essere ricontattata. Verifica la candidatura su Indeed prima di smistare la richiesta.",
  ].join("\n"));
});
