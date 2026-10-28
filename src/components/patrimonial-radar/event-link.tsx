'use client';
import {useState} from 'react';
import {radarApi} from '@/lib/patrimonial-radar-ui/api';
import styles from './radar.module.css';
/** The invitation is kept only in this tab. It grants no report access and never
 * changes event registration/attendance or consultation/booking state. */
export function EventRadarLink({ticket,csrf,onLinked}:{ticket:string;csrf:string;onLinked:(id:string)=>void}){
 const [candidate,setCandidate]=useState<{id:string;state:string;revision:number}|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function propose(){setBusy(true);try{const r=await radarApi<{id:string;state:string;revision:number}>('/event/propose',{ticket},csrf);setCandidate(r);setMessage(r.state==='CONFLICT'?'La richiesta e la verifica email richiedono una revisione. Nessun collegamento è stato confermato.':'Collegamento candidato: conferma soltanto se la richiesta appartiene al personaggio di prova.');}catch{setMessage('Non è possibile verificare questo riferimento. Nessun collegamento è confermato.');}finally{setBusy(false);}}
 async function confirm(){if(!candidate)return;setBusy(true);try{await radarApi('/event/confirm',{id:candidate.id,expectedRevision:candidate.revision},csrf);onLinked(candidate.id);setCandidate({...candidate,state:'VERIFIED'});setMessage('Collegamento confermato alla richiesta. Lo stato della partecipazione all’evento rimane distinto.');}catch{setMessage('Collegamento non confermato: verifica il riferimento prima di riprovare.');}finally{setBusy(false);}}
 return <section className={styles.panel}><h2>La richiesta dell’evento</h2><p>Puoi collegare una nuova compilazione alla richiesta da cui sei arrivato. Il riferimento e l’email verificata non confermano l’iscrizione, la presenza o una consulenza.</p>{!candidate?<button type="button" className={styles.secondary} disabled={busy} onClick={()=>void propose()}>Verifica il collegamento</button>:candidate.state==='CANDIDATE'?<button type="button" className={styles.secondary} disabled={busy} onClick={()=>void confirm()}>Confermo che questa richiesta mi riguarda</button>:null}{message?<p role="status">{message}</p>:null}</section>;
}
