import {parseScenario,comparison,hours,type Scenario} from './model.ts';
import {serveTempoKit,verifyAccess,type Env} from './access.ts';

const esc=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const num=(v:number)=>new Intl.NumberFormat('it-IT',{maximumFractionDigits:1}).format(v);
const eur=(v:number|null)=>v===null?'—':new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);
function authorizedRequestId(request:Request,category:string,env:Env):string|null{
 const token=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('horyzon-tempo-'+category+'='))?.split('=').slice(1).join('=');
 if(!token||!verifyAccess(token,category,env))return null;
 const id=token.split('.')[2];
 return /^[a-f0-9-]{36}$/.test(id)?id:null;
}
async function readSnapshot(id:string,category:string,env:Env,fetcher:typeof fetch):Promise<Scenario|null>{
 const base=env.SUPABASE_URL??env.NEXT_PUBLIC_SUPABASE_URL,secret=env.SUPABASE_SERVICE_ROLE_KEY;
 if(!base||!secret||secret.startsWith('sb_publishable_'))return null;
 let u:URL;try{u=new URL(base);if(u.protocol!=='https:')return null;}catch{return null;}
 const endpoint=new URL('/rest/v1/tempo_kit_requests',u.origin);
 endpoint.searchParams.set('select','category,snapshot');endpoint.searchParams.set('request_id','eq.'+id);
 endpoint.searchParams.set('category','eq.'+category);endpoint.searchParams.set('limit','1');
 try{
  const res=await fetcher(endpoint,{method:'GET',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(6000),headers:{apikey:secret,'Accept-Profile':'hub',Accept:'application/json',...(secret.startsWith('sb_')?{}:{Authorization:'Bearer '+secret})}});
  if(!res.ok){await res.body?.cancel();return null;}
  const rows=await res.json() as Array<{category?:string;snapshot?:unknown}>;
  if(!Array.isArray(rows)||rows.length!==1||rows[0].category!==category)return null;
  const scenario=parseScenario(rows[0].snapshot);
  return scenario?.category===category?scenario:null;
 }catch{return null;}
}
export function kitComparisonMarkup(s:Scenario):string{
 const c=comparison(s),count=c.kit.taskIds.length,baseline=c.kit.taskIds.reduce((t,id)=>t+hours(s.entries.find(e=>e.id===id)!,s),0);
 const kitPct=baseline>0?num(c.kit.hours/baseline*100):'—';
 const annual=(v:{annualValue:number|null},partial:boolean)=>esc(eur(v.annualValue))+(partial&&v.annualValue!==null?' (parziale)':'');
 const weekly=(v:{weeklyValue:number|null},partial:boolean)=>esc(eur(v.weeklyValue))+(partial&&v.weeklyValue!==null?' (parziale)':'');
 const metric=(v:{hours:number;annualValue:number|null;weeklyValue:number|null},partial:boolean)=>'<p class="tk-fig">'+num(v.hours)+' h / settimana</p><p class="tk-money">'+weekly(v,partial)+' di tempo / settimana</p><p>'+num(v.hours*s.weeks)+' h / anno · '+annual(v,partial)+' di tempo / anno</p>';
 const singlePrice=c.single.price===null?'Prezzo su preventivo':eur(c.single.price)+' setup + IVA';
 const incremental=c.single.annualValue!==null&&c.free.annualValue!==null?eur(c.single.annualValue-c.free.annualValue):'—';
 const labels=c.kit.taskNames.map(name=>'<li>'+esc(name)+'</li>').join('');
 return '<section id="kit-confronto" class="tk-comparison" aria-label="Confronto personalizzato Horyzon">'+
 '<small>IL TUO CONFRONTO DOPO LA REGISTRAZIONE · '+esc(c.categoryName)+'</small><h2 class="tk-title">Tre modi per recuperare tempo.</h2>'+
 '<p class="tk-sub">Basato sulla tua valutazione: opzioni alternative, non cumulabili. Il valore del tempo non è risparmio di cassa garantito.</p><div class="tk-grid">'+
 '<article class="tk-card"><small>01 · FAI DA TE · GRATUITO</small><h3>Il tuo primo passo</h3><p>Attività: <strong>'+esc(c.priority.name)+'</strong></p><p class="tk-percent">'+c.free.pct+'% da verificare</p>'+metric(c.free,c.free.priced<1)+'<p class="tk-price">Prezzo: 0 €</p><p>Applica una micro-soluzione e misura il miglioramento reale.</p></article>'+
 '<article class="tk-card"><small>02 · AUTOMAZIONE SINGOLA</small><h3>Horyzon sulla stessa attività</h3><p>'+esc(c.priority.name)+'</p><p class="tk-percent">'+c.single.pct+'% stimato</p>'+metric(c.single,c.single.priced<1)+'<p class="tk-price">'+esc(singlePrice)+'</p><p>Rispetto al gratuito: '+esc(incremental)+'/anno di ulteriore valore del tempo potenziale.</p></article>'+
 '<article class="tk-card"><small>03 · KIT MULTIATTIVITÀ</small><h3>'+esc(c.kit.name)+'</h3><p>'+count+' attività considerate, '+kitPct+'% medio ponderato sul tempo.</p>'+metric(c.kit,c.kit.priced<count)+'<p class="tk-price">'+esc(eur(c.kit.setup))+' setup + '+esc(eur(c.kit.monthly))+'/mese + IVA</p><p>Primo anno: '+esc(eur(c.kit.firstYear))+' + IVA (strumenti e altre integrazioni esclusi).</p><details><summary>Quali attività comprende?</summary><ul>'+labels+'</ul>'+(c.kit.excluded?'<p>Altre '+c.kit.excluded+' attività escluse dal calcolo.</p>':'')+'</details></article></div>'+
 '<p class="tk-fine">Percentuali e importi sono scenari di progetto, non risultati misurati. Stesse attività nel gratuito e nella singola automazione; il kit amplia il perimetro. Dove manca un costo orario, le cifre economiche sono parziali o non disponibili. Le licenze, i consumi e la fattibilità richiedono verifica; non sommare risultati sovrapposti.</p></section>';
}

const kitComparisonStyles="<style>\n.tk-comparison{color:#19382b;background:#f0f5e7;padding:24px;max-width:1100px;margin:24px auto;border-radius:18px;border:1px solid #b4cca1;font:14px/1.55 Arial,sans-serif}\n.tk-comparison *{box-sizing:border-box}.tk-title{font-size:27px;font-weight:800;color:#19382b;margin:8px 0}.tk-sub{font-size:12px;color:#526d55;margin:0 0 18px}\n.tk-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.tk-card{border:1px solid #d1deca;border-radius:13px;background:#fffefa;padding:17px;min-width:0}\n.tk-card:first-child{background:#f4fae8;border-color:#a1bb7b}.tk-card h3{font:bold 18px/1.3 Arial,sans-serif;color:#1b3d2c;margin:12px 0}\n.tk-card>small{font-size:10px;font-weight:800;letter-spacing:.06em;color:#62884b}.tk-card p{font:13px/1.5 Arial,sans-serif;color:#425747;margin:9px 0}\n.tk-percent{font:bold 29px/1.3 Arial,sans-serif!important;color:#234e31!important}.tk-fig{font:bold 23px/1.2 Arial,sans-serif!important;color:#183d2a!important;margin:15px 0 7px!important}.tk-money{font-weight:800!important;color:#245134!important}.tk-price{border-top:1px solid #d6e0cc;padding-top:10px;font-weight:800!important;color:#1b3d2c!important}\n.tk-card details{font-size:12px;color:#364e3b}.tk-card summary{cursor:pointer;text-decoration:underline}.tk-card ul{padding-left:18px}.tk-card li{margin:4px 0}\n.tk-fine{font:11px/1.6 Arial,sans-serif;color:#536d57;margin:16px 0 0}\n@media(max-width:850px){.tk-grid{grid-template-columns:1fr}.tk-comparison{margin:16px 0;padding:18px}}\n@media print{.tk-card{break-inside:avoid}.tk-comparison{box-shadow:none}}\n</style>";

export async function serveTempoKitWithComparison(request:Request,category:string,html:string,env:Env=process.env,fetcher:typeof fetch=fetch):Promise<Response>{
 const original=serveTempoKit(request,category,html,env);
 if(original.status!==200)return original;
 const id=authorizedRequestId(request,category,env);
 if(!id)return original;
 const scenario=await readSnapshot(id,category,env,fetcher);
 if(!scenario)return original;
 const block=kitComparisonMarkup(scenario);
 const firstEnd=html.indexOf('</section>',html.indexOf('<main>'));
 const inserted=firstEnd>=0?html.slice(0,firstEnd+10)+block+html.slice(firstEnd+10):html.replace('</main>',block+'</main>');
 return new Response(inserted.replace('</head>',kitComparisonStyles+'</head>'),{status:200,headers:original.headers});
}
