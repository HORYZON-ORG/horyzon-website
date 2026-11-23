import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import type { Annunci10xRuntimeContext, Annunci10xSessionCookie } from './product-flow.ts';
import { runAnnunci10xAnalysisRun } from './analysis-run.ts';
import { prepareCheckup } from './checkup.ts';
import type { PersistedAnalysisRun } from './persistence/types.ts';

function key(env: Record<string, string | undefined>) {
  const secret = env.ANNUNCI10X_EMAIL_VERIFICATION_PEPPER;
  if (!secret || secret.length < 32) throw new Error('Check-up queue encryption unavailable');
  return Buffer.from(hkdfSync('sha256', secret, 'horyzon-recruiting', 'checkup-queue-v1', 32));
}
export function sealCheckupSession(session: Annunci10xSessionCookie, runId: string, env = process.env): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(env), iv);
  cipher.setAAD(Buffer.from(runId));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(b => b.toString('base64url')).join('.');
}
export function openCheckupSession(token: string, runId: string, env = process.env): Annunci10xSessionCookie {
  const [iv, tag, data] = token.split('.').map(s => Buffer.from(s, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', key(env), iv);
  decipher.setAAD(Buffer.from(runId)); decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'));
}
/** One persisted stage per job per pass; the cron resumes without an open browser. */
export async function processCheckupQueue(context: Annunci10xRuntimeContext, env = process.env) {
  const jobs = await context.persistence.listQueuedCheckups(12);
  let processed = 0;
  const deadline = Date.now() + 150_000;
  for (const job of jobs) {
    if (Date.now() > deadline) break;
    try {
      const session = openCheckupSession(String(job.retrievalMetadata.checkupQueueToken), job.id, env);
      const owned = await context.persistence.getSession(session.sessionId, session.sessionSecret);
      if (!owned || owned.id !== job.sessionId) continue;
      if (job.status === 'QUEUED' || job.status === 'RUNNING') {
        await runAnnunci10xAnalysisRun({ session, context, analysisRunId: job.id });
      } else if (job.status === 'READY') {
        const lead = await context.persistence.getLead(session.sessionId, session.sessionSecret);
        if (lead?.emailVerifiedAt) {
          const receipt = await prepareCheckup({ session, context, analysisRunId: job.id, env });
          if (receipt.emailExhausted || receipt.status === 'EMAIL_ACCEPTED' || (receipt.status === 'FAILED' && receipt.attempts >= 3)) {
            const current = await context.persistence.getAnalysisRun(job.id, session.sessionSecret);
            await context.persistence.updateAnalysisRun({ analysisRunId: job.id, sessionSecret: session.sessionSecret,
              retrievalMetadata: { ...current!.retrievalMetadata, checkupQueueDone: true } });
          }
        }
      }
      if (job.status === 'READY') {
        const current = await context.persistence.getAnalysisRun(job.id, session.sessionSecret);
        await context.persistence.updateAnalysisRun({ analysisRunId: job.id, sessionSecret: session.sessionSecret, retrievalMetadata: current!.retrievalMetadata });
      }
      processed++;
    } catch {
      // No contact, content, token or session secret is emitted to logs or analytics.
    }
  }
  return { processed };
}
export function isQueuedCheckup(run: PersistedAnalysisRun) {
  return run.retrievalMetadata.checkupVersion === 'recruiting-checkup-v1' && !!run.retrievalMetadata.checkupQueueToken && run.retrievalMetadata.checkupQueueDone !== true && run.status !== 'FAILED';
}
