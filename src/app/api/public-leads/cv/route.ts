import { handleArchitectCvUpload } from '@/lib/public-leads/architect-cv-upload';
export const runtime = 'nodejs';
export async function POST(request: Request) { return handleArchitectCvUpload(request); }
