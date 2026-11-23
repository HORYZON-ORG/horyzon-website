import { openCheckupSession } from './checkup-queue.ts';
import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import type { Annunci10xPersistenceAdapter } from './persistence/types.ts';
export function verifyCalendlySignature(body: string, header: string, signingKey: string, now = Date.now()): boolean {
  const parts = header.split(',').map(p => p.trim());
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2) ?? '';
  if (!/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 180 || !signingKey) return false;
  const expected = createHmac('sha256', signingKey).update(`${timestamp}.${body}`).digest();
  return parts.filter(p => p.startsWith('v1=')).some(p => {
    const value = p.slice(3);
    if (!/^[a-f0-9]{64}$/i.test(value)) return false;
    const provided = Buffer.from(value, 'hex');
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  });
}
export async function reconcileCheckupBooking(body: unknown, persistence: Annunci10xPersistenceAdapter) {
  const data = body as { event?: string; payload?: { uri?: string; email?: string; tracking?: { utm_content?: string } } };
  if (!['invitee.created', 'invitee.canceled'].includes(data?.event ?? '')) return 'IGNORED';
  const runId = data.payload?.tracking?.utm_content;
  const email = data.payload?.email?.trim().toLowerCase();
  const uri = data.payload?.uri;
  if (!runId || !/^[a-f0-9-]{36}$/i.test(runId) || !email || !uri?.startsWith('https://api.calendly.com/scheduled_events/')) return 'UNMATCHED';
  const target = await persistence.findCheckupBookingTarget(runId, email);
  if (!target) return 'UNMATCHED';
  const identity = createHash('sha256').update(`${data.event}:${uri}`).digest('hex');
  const session = openCheckupSession(target.queueToken, runId);
  if (session.sessionId !== target.sessionId) return 'UNMATCHED';
  const eventName = data.event === 'invitee.created' ? 'booking_confirmed' : 'booking_canceled';
  const prior = await persistence.getEvents(target.sessionId, session.sessionSecret, eventName, identity);
  if (prior.length) return 'DUPLICATE';
  const lease = await persistence.checkRateLimit({ scope: 'recruiting_booking_webhook', subject: identity, limit: 1, windowSeconds: 60 });
  if (!lease.allowed) throw new Error('Booking reconciliation in progress');
  await persistence.appendEvent({ sessionId: target.sessionId, eventName, metadata: { analysisRunId: runId, syncKey: identity, provider: 'CALENDLY' } });
  return 'RECORDED';
}
