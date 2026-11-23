import { NextResponse } from 'next/server';
import { extractCheckupFile, CHECKUP_MAX_FILE_BYTES } from '@/lib/annunci-10x/checkup-file';
import { Annunci10xPublicError } from '@/lib/annunci-10x';
import { createContext, getOrCreateSession, checkAnnunci10xPersistentStartLimit, toErrorResponse } from '../_shared';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const context = createContext();
    const session = await getOrCreateSession(context);
    const limited = await checkAnnunci10xPersistentStartLimit(context, request, session.sessionId);
    if (limited) return limited;
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) throw new Annunci10xPublicError('INVALID_INPUT', 'Origine non valida.', 403);
    if (!request.headers.get('content-type')?.startsWith('multipart/form-data')) throw new Annunci10xPublicError('INVALID_INPUT', 'Carica un file PDF, DOCX o TXT.', 400);
    const reader = request.body?.getReader();
    if (!reader) throw new Annunci10xPublicError('INVALID_INPUT', 'File assente.', 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > CHECKUP_MAX_FILE_BYTES + 20_000) { await reader.cancel(); throw new Annunci10xPublicError('INVALID_INPUT', 'Il file deve essere inferiore a 3 MB.', 413); }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), { headers: { 'content-type': request.headers.get('content-type')! } }).formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new Annunci10xPublicError('INVALID_INPUT', 'File assente.', 400);
    const text = await extractCheckupFile(file);
    return NextResponse.json({ ok: true, text }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return toErrorResponse(error); }
}
