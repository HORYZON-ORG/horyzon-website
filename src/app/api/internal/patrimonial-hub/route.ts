import {handleLocalHubGateway} from '@/lib/patrimonial-radar-server/hub-gateway';
import {handleRemoteHubGateway} from '@/lib/patrimonial-radar-server/remote-hub';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){return process.env.PATRIMONIAL_RADAR_HUB_CONTEXT==='protected-remote'?handleRemoteHubGateway(request,process.env):handleLocalHubGateway(request);}
