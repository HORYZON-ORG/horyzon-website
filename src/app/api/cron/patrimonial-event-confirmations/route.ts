import {drainEventConfirmationQueue} from '@/lib/public-leads/patrimonial-event-confirmation-email';
import {timingSafeEqual} from 'node:crypto';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const secret=process.env.CRON_SECRET;
 const header=req.headers.get('authorization')??'';
 const expected='Bearer '+secret;
 if(!secret||header.length!==expected.length||!timingSafeEqual(Buffer.from(header),Buffer.from(expected)))
   return Response.json({ok:false},{status:401,headers:{'Cache-Control':'no-store'}});
 const result=await drainEventConfirmationQueue({limit:12});
 return Response.json({ok:result.status==='PROCESSED',...result},{headers:{'Cache-Control':'no-store'}});
}
