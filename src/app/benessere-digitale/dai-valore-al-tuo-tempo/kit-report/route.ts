import {serveTempoKit} from '../../../../lib/tempo-funnel/access.ts';
import {extraKit} from '../../../../lib/tempo-funnel/extra-kits.ts';
export const dynamic='force-dynamic';
export function GET(request:Request){return serveTempoKit(request,'reports',extraKit('reports'));}
