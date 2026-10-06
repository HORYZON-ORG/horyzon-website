import { cookies } from 'next/headers';
import { NextResponse, after } from 'next/server';
import { runHighLevelSync, syncRadarLeadStarted } from '@/lib/radar/highlevel';
import { RADAR_PREVIEW_COOKIE, RADAR_PREVIEW_COOKIE_PATH, RADAR_SESSION_COOKIE, createService, errorResponse, readJson, setSessionCookie } from '../_shared';

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const text = (key: string, max = 200) => typeof body[key] === 'string' ? String(body[key]).trim().slice(0, max) : '';
    // Exact annual turnover (call 5 Oct 2026); the formatted text keeps volume_affari readable in the Hub and the report.
    const turnover = Number(String(body.volumeAffariEuro ?? '').replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.'));
    const volumeAffariEuro = Number.isFinite(turnover) && turnover >= 0 && String(body.volumeAffariEuro ?? '').trim() !== '' ? Math.round(turnover) : null;
    const volumeAffari = volumeAffariEuro === null ? text('volumeAffari') : `${new Intl.NumberFormat('it-IT').format(volumeAffariEuro)} €`;
    const required = { aziendaNome: text('aziendaNome'), referenteNome: text('referenteNome'), referenteEmail: text('referenteEmail'), referenteTelefono: text('referenteTelefono'), settore: text('settore'), descrizioneAttivita: text('descrizioneAttivita', 400), volumeAffari, numeroDipendenti: text('numeroDipendenti') };
    if (Object.values(required).some((value) => !value)) return NextResponse.json({ ok: false, error: { message: 'Compila tutti i campi.' } }, { status: 400 });
    const input = { ...required, volumeAffariEuro, fonteUtm: utmFrom(body.utm), seasonal: body.seasonal === true };
    const created = await createService().createAssessment(input);
    await setSessionCookie({ assessmentId: created.id, ownerSecret: created.ownerSecret });
    // A started Radar is already a lead: the CRM can follow up whoever stops halfway.
    after(() => runHighLevelSync('started', (config) => syncRadarLeadStarted(config, input)));
    return NextResponse.json({ ok: true, session: { id: created.id, revision: created.revision } }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}


// utm_source, utm_medium, utm_campaign, utm_content, utm_term of the landing link: short strings only.
function utmFrom(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    const raw = (value as Record<string, unknown>)[key];
    if (typeof raw === 'string' && raw.trim()) out[key] = raw.trim().slice(0, 100);
  }
  return Object.keys(out).length ? out : null;
}

// "Rifai il test da zero": this browser forgets its Radar. The saved assessment stays in the database.
export async function DELETE() {
  const store = await cookies();
  store.delete(RADAR_SESSION_COOKIE);
  store.delete({ name: RADAR_PREVIEW_COOKIE, path: RADAR_PREVIEW_COOKIE_PATH });
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
