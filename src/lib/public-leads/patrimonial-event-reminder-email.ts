// Transactional reminders are dispatched at their due time, not pre-scheduled with
// the provider. The protected database claim supplies the latest approved event URL.
import { eventEmailReady, renderEventEmailFrame } from './patrimonial-event-confirmation-email.ts';
import { EVENT_PAGE } from './patrimonial-event-calendar.ts';

type Config = Readonly<Record<string, string | undefined>>;
type Kind = 'DAY_BEFORE' | 'HALF_HOUR';
type Claim = {
  registrationId: string; kind: Kind; recipient: string; firstName: string;
  leaseToken: string; sendAt: string; eventStartsAt: string; joinUrl: string;
};
const uuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const escapeHtml = (v: string) => v.replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
function validMeetingUrl(input: unknown): input is string {
  if (typeof input !== 'string' || input.length > 2048 || input.length < 20) return false;
  try {
    const url = new URL(input);
    return url.protocol === 'https:' && url.username === '' && url.password === ''
      && url.port === '' && /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(url.hostname)
      && !/\s|[<>]/.test(input);
  } catch { return false; }
}
async function rpc<T>(name: string, payload: Record<string, unknown>, env: Config, fetchImpl: typeof fetch): Promise<T> {
  const root = env.SUPABASE_URL?.replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!root || !key || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(root))
    throw Error('EVENT_REMINDER_STORE_UNAVAILABLE');
  const response = await fetchImpl(root + '/rest/v1/rpc/' + name, {
    method: 'POST', headers: {
      apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json',
    }, body: JSON.stringify(payload), cache: 'no-store', redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw Error('EVENT_REMINDER_RPC_FAILED');
  }
  return await response.json() as T;
}

export function eventReminderContent(kind: Kind, firstName: string, joinUrl: string, eventStartsAt: string) {
  if ((kind === 'HALF_HOUR' && !validMeetingUrl(joinUrl)) || !Number.isFinite(Date.parse(eventStartsAt)))
    throw Error('EVENT_REMINDER_INVALID_LINK_OR_TIME');
  const first = firstName.replace(/[\r\n<>]/g, ' ').trim().slice(0, 80);
  const greeting = first ? 'Ciao ' + first + ',' : 'Ciao,';
  const isDayBefore = kind === 'DAY_BEFORE';
  const date = new Date(eventStartsAt);
  const day = date.toLocaleDateString('it-IT', {
    timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const time = date.toLocaleTimeString('it-IT', {
    timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit',
  });
  const subject = isDayBefore
    ? 'Domani alle ' + time + ' | Quello che le banche non dicono'
    : 'Tra 30 minuti inizia l’evento Horyzon · ecco il link';
  const intro = isDayBefore
    ? 'Domani ci vediamo online per «Quello che le banche non dicono».'
    : 'Tra poco inizia «Quello che le banche non dicono». Ti aspettiamo!';
  const text = [
    greeting, intro,
    'Evento online gratuito · ' + day + ' · ore ' + time + ' (ora italiana).',
    ...(isDayBefore ? ['Riceverai il link di accesso 30 minuti prima dell’inizio.'] : ['PARTECIPA ALL’EVENTO: ' + joinUrl, 'Ti consigliamo di aprire il link qualche minuto prima dell’inizio.']),
    'Questa è una comunicazione relativa alla tua iscrizione, non un messaggio promozionale.',
    'Horyzon Benessere Patrimoniale · ' + EVENT_PAGE,
  ].join('\n\n');
  const html = renderEventEmailFrame({
    preheader: isDayBefore ? 'Riceverai il link di accesso 30 minuti prima dell’inizio.' : 'Il tuo link per partecipare tra poco.',
    eyebrow: isDayBefore ? 'PROMEMORIA · DOMANI' : 'PROMEMORIA · 30 MINUTI',
    headline: isDayBefore ? 'Ci vediamo domani.' : 'Tra poco si comincia.',
    bodyHtml: [
      '<p style="font-size:18px;font-weight:700;color:#0B222A;margin:0 0 13px">' + escapeHtml(greeting) + '</p>',
      '<p style="font-size:16px;line-height:26px;color:#3A4C52;margin:0 0 22px">' + escapeHtml(intro) + '</p>',
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F3EB;border:1px solid #E4E5D7"><tr><td style="padding:22px">',
      '<p style="font-size:12px;font-weight:800;color:#64794A;margin:0 0 8px;text-transform:uppercase">' + escapeHtml(day) + '</p>',
      '<p style="font-size:31px;font-weight:800;color:#0B222A;margin:0 0 8px">ORE ' + escapeHtml(time) + '</p>',
      '<p style="font-size:13px;line-height:20px;margin:0;color:#4C6165">Online · Gratuito · 60 minuti più eventuali domande</p>',
      '</td></tr></table>',
      ...(isDayBefore ? ['<p style="font-size:15px;line-height:24px;color:#0B222A">Riceverai il link di accesso 30 minuti prima dell’inizio.</p>'] : [
      '<p style="font-size:15px;font-weight:700;color:#0B222A;margin:25px 0 13px">Questo è il tuo link di accesso all’evento:</p>',
      '<a class="email-button" href="' + escapeHtml(joinUrl) + '" style="display:block;padding:18px 19px;background:#CCEB59;color:#0B222A;font-size:15px;font-weight:800;text-decoration:none;text-align:center">PARTECIPA ALL’EVENTO &nbsp; ›</a>',
      '<p style="font-size:13px;line-height:21px;color:#526368;margin:15px 0 22px">Se il pulsante non funziona, apri questo indirizzo:<br><a href="' + escapeHtml(joinUrl) + '" style="color:#245F66;word-break:break-all">' + escapeHtml(joinUrl) + '</a></p>',
      '<p style="font-size:13px;line-height:20px;color:#64727A;margin:0">Apri il link qualche minuto prima dell’inizio. Per assistenza scrivi a info@horyzon.it.</p>',
      ]),
    ].join(''),
  });
  return { subject, text, html };
}

export async function sendOneEventReminder(options: {
  registrationId?: string | null; env?: Config; fetchImpl?: typeof fetch;
} = {}): Promise<'SENT' | 'FAILED' | 'NONE' | 'NOT_CONFIGURED'> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!eventEmailReady(env)) return 'NOT_CONFIGURED';
  let claim: Claim | null;
  try {
    claim = await rpc<Claim | null>('patrimonial_event_reminder_claim', {
      p_registration_id: options.registrationId ?? null,
    }, env, fetchImpl);
  } catch { return 'FAILED'; }
  if (!claim) return 'NONE';
  if (!uuid(claim.registrationId) || !uuid(claim.leaseToken)
    || !['DAY_BEFORE', 'HALF_HOUR'].includes(claim.kind)
    || typeof claim.recipient !== 'string' || claim.recipient.length > 254
    || !claim.recipient.includes('@') || !Number.isFinite(Date.parse(claim.sendAt))
    || (claim.kind === 'HALF_HOUR' && !validMeetingUrl(claim.joinUrl)) || !Number.isFinite(Date.parse(claim.eventStartsAt)))
    return 'FAILED';
  let success = false;
  let providerId: string | null = null;
  try {
    const content = eventReminderContent(claim.kind, claim.firstName, claim.joinUrl, claim.eventStartsAt);
    const from = env.PATRIMONIAL_EVENT_EMAIL_FROM ?? env.ANNUNCI10X_EMAIL_FROM ?? 'Horyzon <noreply@horyzon.it>';
    const replyTo = env.PATRIMONIAL_EVENT_EMAIL_REPLY_TO ?? env.ANNUNCI10X_EMAIL_REPLY_TO ?? 'info@horyzon.it';
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST', headers: {
        Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json',
        'Idempotency-Key': 'horyzon-event-' + claim.kind.toLowerCase() + '-' + claim.registrationId,
      },
      body: JSON.stringify({
        from, to: [claim.recipient], reply_to: replyTo, ...content,
      }),
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(12000),
    });
    if (response.ok) {
      const result = await response.json() as { id?: unknown };
      providerId = typeof result.id === 'string' ? result.id : null;
      success = Boolean(providerId);
    } else await response.body?.cancel().catch(() => {});
  } catch { /* The database lease makes a failed send retryable. */ }
  try {
    const finished = await rpc<boolean>('patrimonial_event_reminder_finish', {
      p_registration_id: claim.registrationId, p_kind: claim.kind,
      p_lease_token: claim.leaseToken, p_success: success,
      p_provider_message_id: providerId,
    }, env, fetchImpl);
    if (!finished) return 'FAILED';
  } catch { return 'FAILED'; }
  return success ? 'SENT' : 'FAILED';
}

export async function drainEventReminders(options: {
  limit?: number; env?: Config; fetchImpl?: typeof fetch;
} = {}) {
  const limit = Math.max(1, Math.min(40, options.limit ?? 20));
  let sent = 0;
  let failed = 0;
  if (!eventEmailReady(options.env ?? process.env)) return { status: 'NOT_CONFIGURED', sent, failed };
  for (let i = 0; i < limit; i++) {
    const result = await sendOneEventReminder({ env: options.env, fetchImpl: options.fetchImpl });
    if (result === 'NONE') break;
    if (result === 'SENT') sent++;
    else {
      failed++;
      if (result === 'NOT_CONFIGURED') break;
    }
  }
  return { status: 'PROCESSED', sent, failed };
}
