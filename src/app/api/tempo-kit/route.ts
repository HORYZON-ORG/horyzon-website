import {handleTempoKit,readiness} from '../../../lib/tempo-funnel/handler.ts';
export const runtime='nodejs';
export const maxDuration=30;
export const GET=()=>readiness();
export function POST(request:Request){return handleTempoKit(request);}
