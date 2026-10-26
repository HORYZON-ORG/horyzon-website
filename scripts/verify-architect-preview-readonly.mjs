import assert from "node:assert/strict";
import { checkArchitectPreviewConnection } from "./architect-preview-readonly-preflight.mjs";

const preview = {
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "feat/patrimonial-pilot-funnels",
  PATRIMONIAL_ARCHITECT_READONLY_PREFLIGHT: "true",
  SUPABASE_URL: "https://pmkyeqrfkunypfkbjnyg.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-only-no-secret",
};

let calls = [];
const fake = async (uri, opts) => {
  calls.push({ uri, opts });
  assert.equal(opts.method, "GET", "preflight must be read-only");
  assert.equal(opts.headers.apikey, "fixture-only-no-secret");
  assert.equal(opts.redirect, "error");
  if (uri.includes("/rest/v1/architect_candidates"))
    return Response.json([]);
  return Response.json({ id: "architect-cv", public: false });
};
assert.deepEqual(await checkArchitectPreviewConnection({}, async () => {
  throw new Error("skip cannot call provider");
}), { skipped: true });

assert.deepEqual(await checkArchitectPreviewConnection(preview, fake), {
  skipped: false, hub: "OK", cvBucket: "PRIVATE",
});
assert.equal(calls.length, 2);
assert.equal(new URL(calls[0].uri).hostname, "pmkyeqrfkunypfkbjnyg.supabase.co");
assert.equal(new Headers(calls[0].opts.headers).get("Accept-Profile"), "hub");
assert.equal(calls[1].uri.endsWith("/storage/v1/bucket/architect-cv"), true);

await assert.rejects(() => checkArchitectPreviewConnection(
  { ...preview, SUPABASE_URL: "https://attacker.example" }, fake,
), /CONFIGURATION_MISSING/);
await assert.rejects(() => checkArchitectPreviewConnection(
  { ...preview, SUPABASE_SERVICE_ROLE_KEY: "" }, fake,
), /CONFIGURATION_MISSING/);
await assert.rejects(() => checkArchitectPreviewConnection(preview, async () =>
  new Response("unauthorized", { status: 401 })
), /API_NOT_READY/);
await assert.rejects(() => checkArchitectPreviewConnection(preview, async uri =>
  uri.includes("/rest/v1/") ? Response.json([]) : Response.json({ id: "architect-cv", public: true })
), /STORAGE_NOT_PRIVATE/);
await assert.rejects(() => checkArchitectPreviewConnection(preview, async uri =>
  uri.includes("/rest/v1/") ? Response.json([{ id: "unexpected" }]) : Response.json({})
), /UNEXPECTED_DATA/);

console.log("PASS: architect Preview preflight is read-only, scope-bound, private and fail-closed");
