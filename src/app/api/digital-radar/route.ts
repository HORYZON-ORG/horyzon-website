import {after} from 'next/server';
import {handleDigitalRadar} from '@/lib/digital-radar/handler';
import {runDigitalCrmDrain} from '@/lib/digital-leads/crm';

export const runtime='nodejs';
export const maxDuration=25;
export async function POST(request:Request){
 return handleDigitalRadar(request,{scheduleCrm:(requestId)=>{
  after(async()=>{try{await runDigitalCrmDrain({requestId,limit:1});}catch{/* Existing durable cron retries. */}});
 }});
}
