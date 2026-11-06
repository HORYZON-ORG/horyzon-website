'use client';

import {useRef,useState,useSyncExternalStore,type FormEvent} from 'react';
import {RADAR_DIMENSIONS} from '@/lib/digital-radar/questions';

const employeeOptions=[['1-9','Da 1 a 9'],['10-49','Da 10 a 49'],['50-249','Da 50 a 249'],['250+','250 o più']];

type Receipt={coverage:number;mean:number|null;dimensions:Record<string,number>};
const frequencyOptions=[['daily','Ogni giorno'],['weekly','Ogni settimana'],['monthly','Ogni mese'],['other','Variabile / non so']];
const subscribeToInitialization=()=>()=>{};
const initializedOnClient=()=>true;
const initializingOnServer=()=>false;

// bookingUrl is the HighLevel calendar shown after a contact request; without it the receipt stays as before.
export function DigitalRadarForm({token,bookingUrl}:{token?:string;bookingUrl?:string|null}){
 const ready=useSyncExternalStore(subscribeToInitialization,initializedOnClient,initializingOnServer);
 const [step,setStep]=useState(0),[status,setStatus]=useState<'idle'|'sending'|'error'|'done'>('idle');
 const [error,setError]=useState(''),[contact,setContact]=useState(false),[receipt,setReceipt]=useState<Receipt|null>(null);
 const formRef=useRef<HTMLFormElement>(null),pending=useRef<{fingerprint:string;requestId:string}|null>(null);
 const busy=status==='sending';
 function next(){
  if(!ready||busy)return;
  const current=formRef.current?.querySelector<HTMLFieldSetElement>(`[data-step="${step}"]`);
  const fields=current?.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>('input,select,textarea');
  if(fields)for(const field of fields){if(!field.reportValidity())return;}
  setStep(s=>s+1);setError('');
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!ready||busy)return;
  // Enter in an earlier step advances rather than silently submitting hidden fields.
  if(step<2){next();return;}
  const form=event.currentTarget;
  if(!form.reportValidity())return;
  const values=new FormData(form);
  const text=(key:string)=>String(values.get(key)??'').trim();
  const optionalNumber=(key:string)=>text(key)===''?null:Number(text(key));
  const answers=Object.fromEntries(RADAR_DIMENSIONS.map(q=>[q.id,text(q.id)==='unknown'?null:Number(text(q.id))]));
  const body={...(token?{token}:{company:text('company'),province:text('province'),companySite:text('companySite'),sector:text('sector'),employees:text('employees')}),name:text('name'),role:text('role'),
   activity:text('activity'),tools:text('tools'),frequency:text('frequency'),minutes:optionalNumber('minutes'),occurrences:optionalNumber('occurrences'),answers,
   contact:!token&&contact?{firstName:text('firstName'),lastName:text('lastName'),email:text('email'),phone:text('phone')}:null,
   consent:values.get('consent')==='on',website:text('website')};
  const fingerprint=JSON.stringify(body);
  if(pending.current?.fingerprint!==fingerprint)pending.current={fingerprint,requestId:crypto.randomUUID()};
  const requestId=pending.current.requestId;
  setStatus('sending');setError('');
  try{
   const response=await fetch('/api/digital-radar',{method:'POST',credentials:'same-origin',cache:'no-store',
    headers:{'Content-Type':'application/json','Idempotency-Key':requestId},body:JSON.stringify({...body,requestId})});
   const result=await response.json() as {ok?:boolean;message?:string;scores?:Receipt};
   if(!response.ok||!result.ok||!result.scores){setStatus('error');setError(result.message??'Non possiamo confermare il salvataggio. Riprova.');return;}
   setReceipt(result.scores);setStatus('done');
  }catch{setStatus('error');setError('La connessione si è interrotta. Riprova: le stesse risposte mantengono lo stesso riferimento per evitare duplicati.');}
 }
 if(status==='done'&&receipt)return <section className="rbd-receipt" aria-live="polite">
  <p className="rbd-confirmed">Risposte salvate</p><h2>Il primo quadro del tuo lavoro.</h2>
  {receipt.mean===null?<p>Hai indicato «Non so» su tutte le dimensioni: il punteggio resta da approfondire.</p>:<>
   <p className="rbd-score"><strong>{receipt.mean.toLocaleString('it-IT',{maximumFractionDigits:2})}</strong><span> / 5</span></p>
   <p>Autovalutazione sulle {receipt.coverage} dimensioni compilate, su 6. Le risposte «Non so» sono escluse dal calcolo.</p>
   <dl className="rbd-results">{Object.entries(receipt.dimensions).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value} / 5</dd></div>)}</dl>
  </>}
  <p>{token?'Il tuo contributo si aggiunge al dossier aziendale. Le risposte degli altri partecipanti restano riservate.':contact?'La richiesta di ricontatto è registrata insieme alle risposte.':'La scheda aziendale è stata registrata. Nessun ricontatto è stato richiesto.'}</p>
  <p className="rbd-small">Il punteggio descrive le risposte dichiarate: fattibilità e risparmi richiedono una verifica sul lavoro reale.</p>
  {!token&&contact&&bookingUrl&&<div className="rbd-booking">
   <h3>Scegli subito quando sentirci</h3>
   <p>Una call conoscitiva di 30 minuti, online, per guardare insieme le risposte e l’attività che vorresti semplificare. Se preferisci, puoi anche non prenotare: ti ricontattiamo noi.</p>
   <iframe src={bookingUrl} title="Calendario per prenotare la call conoscitiva con Horyzon" loading="lazy"/>
  </div>}
 </section>;
 return <form ref={formRef} className="rbd-form" onSubmit={submit} noValidate onKeyDown={event=>{
  if(event.key==='Enter'&&step<2&&event.target instanceof HTMLInputElement&&event.target.type!=='checkbox'){
   event.preventDefault();next();
  }
 }}>
  <nav className="rbd-steps" aria-label="Avanzamento del questionario">{['Azienda e ruolo','Lavoro quotidiano','Radar e invio'].map((label,i)=><span key={label} aria-current={step===i?'step':undefined}>{i+1}. {label}</span>)}</nav>
  <fieldset data-step="0" hidden={step!==0} disabled={!ready||busy}>
   <legend>{token?'Il tuo punto di vista':'Partiamo dalla tua azienda'}</legend>
   <p className="rbd-help">{token?'Questo link raccoglie i contributi della stessa azienda. Puoi rispondere senza indicare il nome.':'La compilazione crea una scheda aziendale per il percorso Benessere Digitale. Puoi lasciare i contatti alla fine, se desideri essere ricontattato.'}</p>
   {!token&&<><div className="rbd-grid"><label>Nome azienda<input name="company" autoComplete="organization" required minLength={2} maxLength={150}/></label><label>Provincia<input name="province" required minLength={2} maxLength={80} placeholder="Es. Lecce"/></label></div>
    <div className="rbd-grid"><label>Sito web dell’azienda <span>(facoltativo)</span><input name="companySite" inputMode="url" autoComplete="url" maxLength={200} placeholder="Es. azienda.it"/></label><label>Settore <span>(facoltativo)</span><input name="sector" minLength={2} maxLength={120} placeholder="Es. edilizia, studio commerciale"/></label></div>
    <label>Quante persone lavorano in azienda? <span>(facoltativo)</span><select name="employees" defaultValue=""><option value="">Preferisco non indicarlo</option>{employeeOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></>}
   <label>Il tuo ruolo o reparto<input name="role" required maxLength={160} placeholder="Es. titolare, segreteria, amministrazione"/></label>
   <label>Come ti chiami? <span>(facoltativo)</span><input name="name" autoComplete="name" maxLength={160}/></label>
  </fieldset>
  <fieldset data-step="1" hidden={step!==1} disabled={!ready||busy}>
   <legend>Quale attività vorresti semplificare?</legend>
   <label>Descrivi un’attività concreta<textarea name="activity" required minLength={20} maxLength={1200} rows={4} placeholder="Es. ricevo le richieste via email e ricopio prodotti e quantità in Excel per preparare i preventivi."/></label>
   <label>Quali programmi utilizzi? <span>(facoltativo)</span><input name="tools" maxLength={200} placeholder="Es. Excel, Outlook, nome del gestionale"/></label>
   <label>Quanto spesso svolgi questa attività?<select name="frequency" required defaultValue=""><option value="" disabled>Scegli la frequenza</option>{frequencyOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   <div className="rbd-grid"><label>Minuti per completarla una volta <span>(facoltativo)</span><input name="minutes" type="number" min={0} max={100000} step={1} inputMode="numeric"/></label><label>Quante volte nel periodo scelto? <span>(facoltativo)</span><input name="occurrences" type="number" min={0} max={100000} step={1} inputMode="numeric"/></label></div>
   <p className="rbd-help">Lascia vuoti i tempi che non conosci. Non inserire password, dati di clienti o documenti riservati.</p>
  </fieldset>
  <fieldset data-step="2" hidden={step!==2} disabled={!ready||busy}>
   <legend>Come lavorate oggi</legend><p className="rbd-help">Rispondi dal tuo punto di vista. «Non so» è una risposta utile.</p>
   {RADAR_DIMENSIONS.map(question=><label className="rbd-question" key={question.id}>{question.title}<select name={question.id} required defaultValue=""><option value="" disabled>Scegli la risposta più vicina alla tua esperienza</option>{question.choices.map((choice,i)=><option key={choice} value={i+1}>{choice}</option>)}<option value="unknown">Non so / non riguarda il mio lavoro</option></select></label>)}
   {!token&&<div className="rbd-contact"><label className="rbd-check"><input type="checkbox" checked={contact} onChange={e=>setContact(e.target.checked)}/><span>Vorrei essere ricontattato da Horyzon per approfondire.</span></label>{contact&&<>
    <div className="rbd-grid"><label>Nome del referente<input name="firstName" required minLength={2} maxLength={80} autoComplete="given-name"/></label><label>Cognome del referente<input name="lastName" required minLength={2} maxLength={80} autoComplete="family-name"/></label></div>
    <label>Email del referente<input name="email" type="email" required maxLength={254} autoComplete="email"/></label><label>Telefono <span>(facoltativo)</span><input name="phone" type="tel" maxLength={35} autoComplete="tel"/></label>
   </>}</div>}
   <label className="rbd-check"><input name="consent" type="checkbox" required/><span>Ho letto l’<a href="https://www.iubenda.com/privacy-policy/64704330" target="_blank" rel="noopener noreferrer">informativa privacy</a> sul trattamento delle risposte per il percorso Benessere Digitale{!token?' e per l’eventuale ricontatto richiesto':''}. Nessuna iscrizione a comunicazioni promozionali.</span></label>
  </fieldset>
  <label className="rbd-trap" aria-hidden="true">Sito web<input name="website" tabIndex={-1} autoComplete="off"/></label>
  {error&&<p role="alert" className="rbd-error">{error}</p>}
  <div className="rbd-actions">{step>0&&<button type="button" className="rbd-back" disabled={!ready||busy} onClick={()=>{setStep(s=>s-1);setError('');}}>Indietro</button>}{step<2?<button type="button" disabled={!ready||busy} onClick={next}>Continua</button>:<button type="submit" disabled={!ready||busy}>{busy?'Salvataggio in corso…':status==='error'?'Riprova invio':'Salva le risposte'}</button>}</div>
  <p className="rbd-small" role="status">{ready?`Passaggio ${step+1} di 3. La conferma finale compare solo dopo il salvataggio.`:'Preparazione del questionario…'}</p>
 </form>;
}
