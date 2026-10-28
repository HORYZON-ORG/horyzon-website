import { handleRadarBackend } from '@/lib/patrimonial-radar-server/runtime';
import { handleAccountRadar } from '@/lib/patrimonial-radar-server/account-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const handler = (request: Request) => process.env.PATRIMONIAL_RADAR_ACCOUNT_ENABLED === 'true' ? handleAccountRadar(request) : handleRadarBackend(request);
export const GET = handler;
export const POST = handler;
