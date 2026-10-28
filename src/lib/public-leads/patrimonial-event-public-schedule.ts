import { eventSession, type EventSession } from "@/content/patrimonial-event-session";

/**
 * Server-only, fail-closed read of ACTIVE official event editions.
 * No public visitor or client receives the server's Supabase credentials.
 */
type Settings = Readonly<Record<string, string | undefined>>;
type Row = {
  edition_key: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
  capacity: number | null;
  record: { sessions?: { startsAt: string; endsAt: string }[] };
};
const projectUrl = "https://pmkyeqrfkunypfkbjnyg.supabase.co";
export async function publishedEventSession(
  env: Settings = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<EventSession> {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const base = env.SUPABASE_URL?.replace(/\/$/, "");
  if (!key || base !== projectUrl) return eventSession;
  try {
    const url = new URL("/rest/v1/patrimonial_event_editions", projectUrl);
    url.searchParams.set("select", "edition_key,starts_at,ends_at,status,capacity,record");
    url.searchParams.set("event_slug", "eq.quello-che-le-banche-non-dicono");
    url.searchParams.set("status", "eq.ACTIVE");
    url.searchParams.set("starts_at", "gt." + new Date().toISOString());
    url.searchParams.set("order", "starts_at.asc");
    url.searchParams.set("limit", "1");
    const res = await fetchImpl(url.toString(), {
      headers: { apikey: key, Authorization: "Bearer " + key, "Cache-Control": "no-store" },
      cache: "no-store",
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return eventSession;
    const rows: unknown = await res.json();
    if (!Array.isArray(rows) || rows.length !== 1) return eventSession;
    const row = rows[0] as Row;
    const sessions = row.record?.sessions;
    if (row.status !== "ACTIVE" || !Array.isArray(sessions) || sessions.length !== 2
      || typeof row.edition_key !== "string"
      || !/^[a-zA-Z0-9_-]{1,100}$/.test(row.edition_key)
      || !Number.isFinite(Date.parse(row.starts_at))
      || !sessions.every((s) => Number.isFinite(Date.parse(s.startsAt)) && Number.isFinite(Date.parse(s.endsAt)))) return eventSession;
    const capacity = row.capacity;
    // A missing capacity is not an assertion that the meeting is full.
    let taken = 0;
    if (capacity !== null) {
      if (!Number.isInteger(capacity) || capacity < 1) return eventSession;
      const countUrl = new URL("/rest/v1/patrimonial_contact_event_registrations", projectUrl);
      countUrl.searchParams.set("select", "id");
      countUrl.searchParams.set("edition_ref", "eq." + row.edition_key);
      countUrl.searchParams.set("registration_status", "eq.CONFIRMED");
      countUrl.searchParams.set("limit", "1");
      const countRes = await fetchImpl(countUrl.toString(), {
        headers: { apikey: key, Authorization: "Bearer " + key, Prefer: "count=exact", "Cache-Control": "no-store" },
        cache: "no-store",
        signal: AbortSignal.timeout(7000),
      });
      if (!countRes.ok) return eventSession;
      const match = countRes.headers.get("content-range")?.match(/\/(\d+)$/);
      await countRes.body?.cancel().catch(() => {});
      if (!match) return eventSession;
      taken = Number(match[1]);
      if (!Number.isSafeInteger(taken) || taken < 0) return eventSession;
    }
    const format = (iso: string) => new Date(iso).toLocaleDateString("it-IT", {
      timeZone: "Europe/Rome", day: "numeric", month: "long", year: "numeric",
    });
    return {
      status: "CONFIRMED",
      eventDate: sessions[0].startsAt,
      eventLabel: "Due serate: " + format(sessions[0].startsAt) + " e " + format(sessions[1].startsAt),
      seatsTotal: capacity ?? 0,
      seatsTaken: taken,
    };
  } catch {
    // Fallback is honest: never publish a guessed event date.
    return eventSession;
  }
}
