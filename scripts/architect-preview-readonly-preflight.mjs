import { pathToFileURL } from "node:url";
import path from "node:path";

const PROJECT = "https://pmkyeqrfkunypfkbjnyg.supabase.co";
const BRANCH = "feat/patrimonial-pilot-funnels";

/**
 * Real, read-only Preview connectivity test. Never issues POST/DELETE or reads
 * candidate PII; does not print provider responses, keys, or request headers.
 */
export async function checkArchitectPreviewConnection(
  env = process.env,
  fetchImpl = fetch,
) {
  if (env.VERCEL_ENV !== "preview" ||
      env.VERCEL_GIT_COMMIT_REF !== BRANCH ||
      env.PATRIMONIAL_ARCHITECT_READONLY_PREFLIGHT !== "true") {
    return { skipped: true };
  }
  const url = (env.SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url !== PROJECT || !key) throw new Error("ARCHITECT_PREFLIGHT_CONFIGURATION_MISSING");
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    "Cache-Control": "no-store",
  };
  const request = async (uri, extraHeaders = {}) => {
    const r = await fetchImpl(PROJECT + uri, {
      method: "GET", headers: { ...headers, ...extraHeaders },
      redirect: "error", signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (r.status !== 200) throw new Error("ARCHITECT_PREFLIGHT_API_NOT_READY");
    return r.json();
  };

  // A limit=0 query proves the deployed service credential can reach the
  // existing private Hub schema; no candidate records are returned.
  const rows = await request("/rest/v1/architect_candidates?select=id&limit=0", {
    "Accept-Profile": "hub",
  });
  if (!Array.isArray(rows) || rows.length !== 0)
    throw new Error("ARCHITECT_PREFLIGHT_UNEXPECTED_DATA");

  // Confirm the private CV bucket exists without listing or reading any CV.
  const bucket = await request("/storage/v1/bucket/architect-cv");
  if (!bucket || bucket.id !== "architect-cv" || bucket.public !== false)
    throw new Error("ARCHITECT_PREFLIGHT_CV_STORAGE_NOT_PRIVATE");

  return { skipped: false, hub: "OK", cvBucket: "PRIVATE" };
}

if (process.argv[1] &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = await checkArchitectPreviewConnection();
    if (result.skipped) console.log("ARCHITECT_PREFLIGHT: SKIPPED (not enabled on this Preview branch)");
    else console.log("ARCHITECT_PREFLIGHT: PASS (private Hub RPC storage access and CV bucket)");
  } catch {
    console.error("ARCHITECT_PREFLIGHT: FAIL (check Preview Supabase credentials and private Hub permissions)");
    process.exitCode = 1;
  }
}
