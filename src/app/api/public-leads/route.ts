import { handlePublicLead } from '@/lib/public-leads/handler';
import { localEventRadarPort } from '@/lib/patrimonial-radar-server/runtime';
import {remoteEventIntakePort} from '@/lib/patrimonial-radar-server/event-intake';
export const runtime = 'nodejs';
export async function POST(request: Request) { return handlePublicLead(request, {eventRadarNextStep:localEventRadarPort(),eventIntake:remoteEventIntakePort()}); }
