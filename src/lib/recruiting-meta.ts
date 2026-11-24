// Only this funnel may send explicit, consented events. Never pass form values here.
export const RECRUITING_META_PATH = '/recruiting/check-up-annuncio';
export const RECRUITING_META_CONSENT_EVENT = 'horyzon:advertising-consent';
type FunnelEvent = 'CheckupStarted' | 'Lead' | 'CheckupPdfDownload' | 'CheckupBookingClick';
type PixelStatus = 'disabled' | 'awaiting-consent' | 'blocked-url' | 'loading' | 'ready' | 'error';
interface PixelQueue {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  loaded: boolean;
  version: string;
  push?: PixelQueue;
}
declare global {
  interface Window {
    fbq?: PixelQueue;
    _fbq?: PixelQueue;
    horyzonAdvertisingConsent?: boolean;
    _iub?: { cs?: { api?: { isPreferenceExpressed?: () => boolean; getPreferences?: () => unknown } } };
  }
}

export function advertisingConsent(preference: unknown): boolean {
  if (!preference || typeof preference !== 'object') return false;
  const p = preference as { purposes?: Record<string, unknown>; consent?: unknown };
  return p.purposes ? p.purposes['5'] === true : p.consent === true;
}

// Meta reads the page URL itself. Do not initialize on recovery links or arbitrary
// query values, which might contain a report reference or user-entered information.
export function safeRecruitingMetaUrl(href: string): boolean {
  const url = new URL(href);
  if (url.pathname !== RECRUITING_META_PATH || (url.hash && url.hash !== '#valuta')) return false;
  const allowed: Record<string, readonly string[]> = {
    utm_source: ['meta'], utm_medium: ['paid_social'], utm_campaign: ['recruiting_checkup_v1'],
    utm_content: ['video51_poche_candidature', 'video51_fuori_target'],
  };
  return Array.from(url.searchParams).every(([key, value]) => key === 'fbclid'
    ? /^[a-zA-Z0-9_-]{1,500}$/.test(value)
    : allowed[key]?.includes(value) === true);
}

export function createRecruitingMetaTracker(pixelId: string, win: Window, status: (value: PixelStatus) => void = () => {}) {
  let consent = false;
  let loaded = false;
  let initialized = false;
  let loading = false;
  let pageViewed = false;
  const sent = new Set<string>();
  const pending = new Map<string, () => void>();
  const validId = /^\d{8,25}$/.test(pixelId);
  const permitted = () => consent && validId && safeRecruitingMetaUrl(win.location.href);
  const updateStatus = () => status(!validId ? 'disabled' : !safeRecruitingMetaUrl(win.location.href) ? 'blocked-url' : !consent ? 'awaiting-consent' : loaded ? 'ready' : 'loading');

  function activate() {
    if (!permitted() || !loaded || !win.fbq) return;
    if (!initialized) {
      win.fbq('set', 'autoConfig', false, pixelId);
      win.fbq('init', pixelId); // No advanced-matching data.
      initialized = true;
    }
    win.fbq('consent', 'grant');
    if (!pageViewed) {
      win.fbq('trackSingle', pixelId, 'PageView');
      pageViewed = true;
    }
    for (const send of pending.values()) send();
    pending.clear();
    updateStatus();
  }

  function load() {
    if (loading || loaded || !permitted()) return;
    loading = true;
    if (!win.fbq) {
      const queue = ((...args: unknown[]) => queue.callMethod ? queue.callMethod(...args) : queue.queue.push(args)) as PixelQueue;
      queue.queue = []; queue.loaded = true; queue.version = '2.0'; queue.push = queue;
      win.fbq = queue; win._fbq = queue;
    }
    // Nothing is initialized or queued for transmission before the load callback
    // rechecks consent. Revoking while the library is downloading discards events.
    win.fbq('consent', 'revoke');
    const script = win.document.createElement('script');
    script.id = 'horyzon-recruiting-meta-library';
    script.async = true;
    script.referrerPolicy = 'strict-origin';
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    script.onload = () => { loaded = true; loading = false; activate(); updateStatus(); };
    script.onerror = () => { loading = false; pending.clear(); status('error'); };
    win.document.head.appendChild(script);
  }

  function setConsent(allowed: boolean) {
    consent = allowed === true;
    if (!consent) {
      pending.clear();
      if (initialized) win.fbq?.('consent', 'revoke');
    } else if (loaded) activate();
    else load();
    updateStatus();
  }

  async function track(event: FunnelEvent, runId: string) {
    if (!permitted() || !/^[a-zA-Z0-9-]{8,100}$/.test(runId)) return;
    const key = `hz-meta:${pixelId}:${event}:${runId}`;
    if (sent.has(key)) return;
    try { if (win.sessionStorage.getItem(key)) { sent.add(key); return; } } catch { /* Storage may be unavailable. */ }
    // Reserve synchronously, so concurrent effects cannot enqueue duplicates.
    sent.add(key);
    try {
      const digest = await win.crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
      const eventID = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      const send = () => {
        if (!permitted() || !loaded || !initialized) { sent.delete(key); return; }
        win.fbq?.(event === 'Lead' ? 'trackSingle' : 'trackSingleCustom', pixelId, event,
          { content_name: 'HORYZON Recruiting Check-up', content_category: 'business_service' }, { eventID });
        try { win.sessionStorage.setItem(key, '1'); } catch { /* In-memory deduplication remains active. */ }
      };
      if (!permitted()) { sent.delete(key); return; }
      if (loaded) send();
      else pending.set(key, send);
    } catch { sent.delete(key); /* Tracking cannot prevent the check-up. */ }
  }

  return {
    setConsent,
    started: (id: string) => track('CheckupStarted', id),
    completed: (id: string, createdAt: string) => {
      const age = Date.now() - Date.parse(createdAt);
      // Reopening an old PDF is not a new lead.
      return Number.isFinite(age) && age >= -60000 && age <= 30 * 60000 ? track('Lead', id) : Promise.resolve();
    },
    download: (id: string) => track('CheckupPdfDownload', id),
    bookingClick: (id: string) => track('CheckupBookingClick', id),
  };
}

let tracker: ReturnType<typeof createRecruitingMetaTracker> | undefined;
export function recruitingMetaTracker() { return tracker; }
export function initializeRecruitingMeta(pixelId: string, status: (value: PixelStatus) => void) {
  if (!tracker) tracker = createRecruitingMetaTracker(pixelId, window, status);
  return tracker;
}
