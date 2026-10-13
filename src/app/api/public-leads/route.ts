import { handlePublicLead } from '@/lib/public-leads/handler';
export const runtime = 'nodejs';
export async function POST(request: Request) { return handlePublicLead(request); }
