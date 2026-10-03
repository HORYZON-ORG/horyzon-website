import { cookies } from 'next/headers';
import { NextResponse, after } from 'next/server';
import { runHighLevelSync, syncRadarLeadStarted } from '@/lib/radar/highlevel';
import { RADAR_PREVIEW_COOKIE, RADAR_PREVIEW_COOKIE_PATH, RADAR_SESSION_COOKIE, createService, errorResponse, readJson, setSessionCookie } from '../_shared';

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const text = (key: string) => typeof body[key] === 'string' ? String(body[key]).trim() : '';
    const input = { aziendaNome: text('aziendaNome'), referenteNome: text('referenteNome'), referenteEmail: text('referenteEmail'), referenteTelefono: text('referenteTelefono'), settore: text('settore'), volumeAffari: text('volumeAffari'), numeroDipendenti: text('numeroDipendenti'), seasonal: body.seasonal === true };
    if (Object.entries(input).some(([key, value]) => key !== 'seasonal' && !value)) return NextResponse.json({ ok: false, error: { message: 'Compila tutti i campi.' } }, { status: 400 });
    const created = await createService().createAssessment(input);
    await setSessionCookie({ assessmentId: created.id, ownerSecret: created.ownerSecret });
    // A started Radar is already a lead: the CRM can follow up whoever stops halfway.
    after(() => runHighLevelSync('started', (config) => syncRadarLeadStarted(config, input)));
    return NextResponse.json({ ok: true, session: { id: created.id, revision: created.revision } }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}


// "Rifai il test da zero": this browser forgets its Radar. The saved assessment stays in the database.
export async function DELETE() {
  const store = await cookies();
  store.delete(RADAR_SESSION_COOKIE);
  store.delete({ name: RADAR_PREVIEW_COOKIE, path: RADAR_PREVIEW_COOKIE_PATH });
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
