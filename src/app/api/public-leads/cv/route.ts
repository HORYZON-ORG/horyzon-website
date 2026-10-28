import { handleArchitectCvUpload } from '@/lib/public-leads/architect-cv-upload';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  // Do not accumulate orphan private PDFs if the Hub intake is not enabled.
  if (process.env.PATRIMONIAL_ARCHITECT_HUB_INTAKE_ENABLED !== 'true')
    return Response.json({ ok:false, message:'La candidatura non è temporaneamente disponibile.' }, { status:503, headers:{ 'Cache-Control':'no-store' } });
  return handleArchitectCvUpload(request);
}
