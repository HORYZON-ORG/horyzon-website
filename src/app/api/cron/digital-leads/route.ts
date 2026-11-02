import { handleDigitalCrmCron } from '@/lib/digital-leads/handler';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: Request) { return handleDigitalCrmCron(request); }
