import {notFound} from 'next/navigation';
import {DigitalRadarForm} from '@/components/digital-radar-form';

export default async function CompanyDigitalRadarPage({params}:{params:Promise<{token:string}>}){
 const {token}=await params;
 if(!/^[a-f0-9]{48}$/.test(token))notFound();
 return <><header className="rbd-header"><p>Il tuo contributo al percorso aziendale.</p><h1>Il lavoro di ogni giorno, raccontato da te.</h1><p>Ogni persona vede una parte diversa dell’azienda. Le tue risposte aiutano a individuare attività e strumenti da migliorare.</p></header><DigitalRadarForm token={token}/></>;
}
