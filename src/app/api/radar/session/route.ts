import { NextResponse } from 'next/server';
import { createService, errorResponse, readJson, setSessionCookie } from '../_shared';

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const text = (key: string) => typeof body[key] === 'string' ? String(body[key]).trim() : '';
    const input = { aziendaNome: text('aziendaNome'), referenteNome: text('referenteNome'), referenteEmail: text('referenteEmail'), referenteTelefono: text('referenteTelefono'), settore: text('settore'), volumeAffari: text('volumeAffari'), numeroDipendenti: text('numeroDipendenti'), seasonal: body.seasonal === true };
    if (Object.entries(input).some(([key, value]) => key !== 'seasonal' && !value)) return NextResponse.json({ ok: false, error: { message: 'Compila tutti i campi.' } }, { status: 400 });
    const created = await createService().createAssessment(input);
    await setSessionCookie({ assessmentId: created.id, ownerSecret: created.ownerSecret });
    return NextResponse.json({ ok: true, session: { id: created.id, revision: created.revision } }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
