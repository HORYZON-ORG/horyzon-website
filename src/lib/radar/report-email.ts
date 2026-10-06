// Sends the Radar report PDF to the person who filled it in, through Resend (same account as Annunci 10x).
import type { RadarReport } from './report.ts';

export interface RadarReportEmailInput { to: string; name: string; report: RadarReport; pdf: Buffer }

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function buildRadarReportEmail(input: RadarReportEmailInput, from: string, replyTo?: string) {
  const first = input.name.trim().split(/\s+/)[0] ?? '';
  const { report } = input;
  const priorities = report.priorities.map((p, i) => `<li style="margin:0 0 8px"><b>${i + 1}. ${escape(p.advice.title)}</b> <span style="color:#5A6868">(${escape(p.area)})</span></li>`).join('');
  const html = `<div style="font-family:Manrope,Arial,sans-serif;background:#F7F4E8;padding:32px;color:#07171D">
<div style="max-width:560px;margin:0 auto;background:#FFFDF5;border-radius:12px;padding:32px">
<p style="font-family:monospace;letter-spacing:2px;font-size:11px;text-transform:uppercase;color:#5A6868;margin:0 0 12px">Radar d’Impresa</p>
<h1 style="font-size:24px;margin:0 0 16px">${first ? `Ciao ${escape(first)}, ` : ''}ecco il report di ${escape(report.company.aziendaNome)}.</h1>
<p style="font-size:15px;line-height:1.55">Indice globale <b>${report.global.score}/100</b> · ${escape(report.global.reading.title)}.<br>Reparto più solido: <b>${escape(report.strongest.label)}</b>. Reparto prioritario: <b>${escape(report.weakest.label)}</b>.</p>
${priorities ? `<p style="font-size:15px;margin:20px 0 8px"><b>Le tre priorità dei prossimi 90 giorni</b></p><ol style="padding:0;list-style:none;font-size:14px">${priorities}</ol>` : ''}
<p style="font-size:15px;line-height:1.55">Trovi il report completo, reparto per reparto, nel PDF allegato.</p>
<p style="margin:24px 0"><a href="mailto:info@horyzon.it?subject=${encodeURIComponent(`Debriefing Radar d’Impresa — ${report.company.aziendaNome}`)}" style="background:#D8FF42;color:#07171D;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:6px;display:inline-block">Prenota il debriefing con un nostro consulente</a></p>
<p style="font-size:12px;color:#5A6868">Una fotografia guidata basata sulle tue risposte: non è una diagnosi completa né una valutazione finanziaria, fiscale o legale.</p>
</div><p style="text-align:center;font-size:12px;color:#5A6868">Horyzon Consulting · horyzon.it</p></div>`;
  const text = `Ecco il report del Radar d’Impresa di ${report.company.aziendaNome}.\nIndice globale ${report.global.score}/100. Reparto prioritario: ${report.weakest.label}.\nIl report completo è nel PDF allegato.\nPrenota il debriefing con un nostro consulente: scrivi a info@horyzon.it`;
  const slug = report.company.aziendaNome.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'impresa';
  return {
    from, to: [input.to], ...(replyTo ? { reply_to: replyTo } : {}),
    subject: `Il tuo Radar d’Impresa — ${report.company.aziendaNome}`, html, text,
    attachments: [{ filename: `radar-impresa-${slug}.pdf`, content: input.pdf.toString('base64') }],
  };
}

/** Returns false (and sends nothing) when the email provider is not configured. */
export async function sendRadarReportEmail(input: RadarReportEmailInput, env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = (env.RADAR_EMAIL_FROM ?? env.ANNUNCI10X_EMAIL_FROM)?.trim();
  if (!apiKey || !from || !input.to.includes('@')) return false;
  const replyTo = (env.RADAR_EMAIL_REPLY_TO ?? env.ANNUNCI10X_EMAIL_REPLY_TO)?.trim();
  const response = await fetchImpl('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(buildRadarReportEmail(input, from, replyTo)), signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Radar report email failed: ${response.status}`);
  return true;
}

export function radarReportEmailConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.RESEND_API_KEY?.trim() && (env.RADAR_EMAIL_FROM ?? env.ANNUNCI10X_EMAIL_FROM)?.trim());
}
