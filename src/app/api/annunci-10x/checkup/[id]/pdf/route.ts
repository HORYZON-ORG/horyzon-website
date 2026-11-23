import { readCheckup } from '@/lib/annunci-10x/checkup';
import { Annunci10xPublicError } from '@/lib/annunci-10x';
import { createContext, getSessionCookie, toErrorResponse } from '../../../_shared';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionCookie();
    if (!session) throw new Annunci10xPublicError('INVALID_INPUT', 'Sessione assente.', 401);
    const { receipt } = await readCheckup({ session, analysisRunId: (await params).id, context: createContext() });
    if (!receipt?.pdfBase64) throw new Annunci10xPublicError('ANALYSIS_NOT_READY', 'PDF ancora in preparazione.', 409);
    return new Response(new Uint8Array(Buffer.from(receipt.pdfBase64, 'base64')), { headers: {
      'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="check-up-annuncio.pdf"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) { return toErrorResponse(error); }
}
