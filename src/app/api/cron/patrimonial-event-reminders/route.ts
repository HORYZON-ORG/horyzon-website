import { timingSafeEqual } from 'node:crypto';
import { drainEventReminders } from '@/lib/public-leads/patrimonial-event-reminder-email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// Runs each minute: a missing meeting link never produces a provider message.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get('authorization') ?? '';
  const expected = 'Bearer ' + secret;
  if (!secret || header.length !== expected.length
    || !timingSafeEqual(Buffer.from(header), Buffer.from(expected))) {
    return Response.json({ ok: false }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const reminders = await drainEventReminders({ limit: 30 });
  return Response.json({
    ok: reminders.status === 'PROCESSED' && reminders.failed === 0,
    reminders,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
