import { handleDigitalLead } from '@/lib/digital-leads/handler';

export const runtime = 'nodejs';
export const maxDuration = 25;
export async function POST(request: Request) { return handleDigitalLead(request); }
