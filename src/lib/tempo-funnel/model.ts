// Horyzon scope-based scenarios, not measured performance. Prices: strategic review 09-11-2026.
export const taskCatalog:Record<string,{name:string;category:string;pct:number;service:string;scope:string}>={"triage": {"name": "Leggere e smistare", "category": "email", "pct": 80, "service": "B01", "scope": "Classificazione e assegnazione automatiche; controllo delle eccezioni."}, "reply": {"name": "Preparare le risposte", "category": "email", "pct": 60, "service": "B02", "scope": "Bozza AI su risposte ricorrenti; revisione e invio restano alla persona."}, "archive": {"name": "Archiviare e ritrovare", "category": "email", "pct": 70, "service": "D01", "scope": "Ricerca e classificazione assistite; verifica del documento trovato."}, "emailorder": {"name": "Raccogliere gli ordini", "category": "email", "pct": 70, "service": "C01", "scope": "Estrazione di prodotti e quantità; conferma dei dati prima di registrare."}, "follow": {"name": "Riprendere le richieste", "category": "email", "pct": 80, "service": "A03", "scope": "Sequenza e promemoria su stato CRM; gestione umana delle risposte."}, "emailall": {"name": "Gestire una richiesta completa", "category": "email", "pct": 60, "service": "B01 + B02", "scope": "Smistamento, bozza e archivio; conferma finale e richieste complesse restano umane."}, "extract": {"name": "Estrarre dati dai documenti", "category": "docs", "pct": 75, "service": "C01", "scope": "Campi da documenti standard; conferma e correzione delle eccezioni."}, "invoice": {"name": "Preparare le fatture", "category": "docs", "pct": 75, "service": "C02", "scope": "Bozza da ordini strutturati; controllo e conferma dal gestionale."}, "checkinvoice": {"name": "Controllare le fatture ricevute", "category": "docs", "pct": 50, "service": "C01 · estensione", "scope": "Confronti documentali assistiti; verifica contabile e discrepanze alla persona."}, "file": {"name": "Organizzare i documenti", "category": "docs", "pct": 80, "service": "D01 · estensione", "scope": "Regole di rinomina e archivio; verifica delle classificazioni dubbie."}, "due": {"name": "Seguire le scadenze", "category": "docs", "pct": 80, "service": "A03 · adattamento", "scope": "Controllo scadenze e promemoria; decisioni su pagamenti alla persona."}, "quote": {"name": "Preparare i preventivi", "category": "sales", "pct": 60, "service": "A06", "scope": "Bozza da modello e listino; prezzi, completezza e approvazione umani."}, "crm": {"name": "Aggiornare i contatti", "category": "sales", "pct": 85, "service": "A01 + C03", "scope": "Mappatura e sincronizzazione di dati strutturati; verifica duplicati ed errori."}, "proposal": {"name": "Comporre offerte e proposte", "category": "sales", "pct": 50, "service": "Preventivo Assistant · estensione", "scope": "Prima bozza e documenti; strategia e condizioni commerciali alla persona."}, "visits": {"name": "Riordinare i sopralluoghi", "category": "sales", "pct": 60, "service": "C06 · adattamento", "scope": "Sintesi da note e foto autorizzate; verifica tecnica del sopralluogo umana."}, "pipeline": {"name": "Controllare le trattative", "category": "sales", "pct": 65, "service": "D04 · adattamento", "scope": "Raccolta stati e priorità; valutazione commerciale umana."}, "book": {"name": "Fissare gli appuntamenti", "category": "calendar", "pct": 85, "service": "A05", "scope": "Booking e conferme su calendario compatibile; casi fuori regola alla persona."}, "move": {"name": "Modificare gli appuntamenti", "category": "calendar", "pct": 75, "service": "A05 · estensione", "scope": "Riprogrammazione guidata e notifiche; conflitti ed eccezioni umani."}, "remind": {"name": "Ricordare gli appuntamenti", "category": "calendar", "pct": 90, "service": "A04", "scope": "Promemoria con template approvati; controllo esiti e casi non consegnati."}, "call": {"name": "Preparare e riordinare le chiamate", "category": "calendar", "pct": 50, "service": "C06 · adattamento", "scope": "Contesto e note assistite; la conversazione non è inclusa nel tempo recuperato."}, "minutes": {"name": "Scrivere i verbali", "category": "calendar", "pct": 65, "service": "C06", "scope": "Trascrizione e sintesi; revisione di decisioni e incarichi."}, "order": {"name": "Registrare gli ordini", "category": "ops", "pct": 85, "service": "C03 · adattamento", "scope": "Ordine già strutturato trasferito via API; controllo e scarti umani."}, "status": {"name": "Aggiornare lo stato dei lavori", "category": "ops", "pct": 80, "service": "C04", "scope": "Stati e notifiche dai sistemi; aggiornamento della fonte e anomalie umani."}, "supplier": {"name": "Preparare richieste ai fornitori", "category": "ops", "pct": 50, "service": "Preventivo Assistant · adattamento", "scope": "Bozze e confronti; selezione e negoziazione restano umane."}, "handoff": {"name": "Passare informazioni tra reparti", "category": "ops", "pct": 75, "service": "C03", "scope": "Trasferimento tra strumenti compatibili; conferma delle informazioni critiche."}, "procedures": {"name": "Preparare le procedure", "category": "ops", "pct": 45, "service": "Procedure Assistant · estensione", "scope": "Bozza ordinata di istruzioni; validazione del responsabile."}, "ideas": {"name": "Organizzare il piano editoriale", "category": "marketing", "pct": 35, "service": "Social Assistant · estensione", "scope": "Idee e calendario assistiti; scelta editoriale umana."}, "content": {"name": "Preparare i contenuti", "category": "marketing", "pct": 50, "service": "Social Assistant · estensione", "scope": "Bozze testuali e adattamenti; creatività, fonti e approvazione umane."}, "publish": {"name": "Pubblicare i contenuti", "category": "marketing", "pct": 85, "service": "D03", "scope": "Programmazione di contenuti già approvati; verifica pubblicazione ed errori."}, "reviews": {"name": "Gestire le recensioni", "category": "marketing", "pct": 60, "service": "B05", "scope": "Bozza di risposta; verifica e approvazione del titolare."}, "newsletter": {"name": "Preparare le comunicazioni", "category": "marketing", "pct": 50, "service": "Social Assistant · adattamento", "scope": "Bozza comunicazione; revisione contenuti e destinatari."}, "search": {"name": "Cercare informazioni interne", "category": "people", "pct": 60, "service": "D01", "scope": "Ricerca su archivio autorizzato e ordinato; verifica delle fonti."}, "onboard": {"name": "Preparare l’ingresso dei nuovi assunti", "category": "people", "pct": 40, "service": "D02", "scope": "Materiali e checklist per ruolo; affiancamento e tutor restano umani."}, "faq": {"name": "Rispondere a domande ricorrenti", "category": "people", "pct": 60, "service": "Procedure Assistant", "scope": "Risposte da procedure approvate; escalation dei casi incerti."}, "training": {"name": "Preparare materiali formativi", "category": "people", "pct": 40, "service": "Onboarding · estensione", "scope": "Bozze e organizzazione materiali; progettazione e verifica umane."}, "report": {"name": "Preparare il report periodico", "category": "reports", "pct": 75, "service": "C05", "scope": "Raccolta e report da fonti ordinate; verifica numeri e commento."}, "kpi": {"name": "Aggiornare gli indicatori", "category": "reports", "pct": 85, "service": "D04", "scope": "Aggiornamento automatico degli indicatori; controllo fonte e anomalie."}, "tasks": {"name": "Ricostruire attività e scadenze", "category": "reports", "pct": 60, "service": "Report Assistant · adattamento", "scope": "Riepilogo delle scadenze; assegnazioni e priorità confermate dalla persona."}, "compare": {"name": "Confrontare documenti e versioni", "category": "reports", "pct": 65, "service": "Document Assistant · estensione", "scope": "Differenze evidenziate; valutazione e accettazione delle modifiche umane."}};
export const categoryNames:Record<string,string>={"email": "Email e richieste", "docs": "Documenti e fatture", "sales": "Commerciale", "calendar": "Chiamate e agenda", "ops": "Ordini e operatività", "marketing": "Marketing e social", "people": "Persone e conoscenza", "reports": "Report e controllo"};
export const servicePrices:Record<string,number>={"A01": 390, "A02": 790, "A03": 490, "A04": 390, "A05": 490, "A06": 1290, "B01": 990, "B02": 690, "B03": 990, "B04": 1490, "B05": 390, "B06": 2990, "C01": 1490, "C02": 1290, "C03": 1190, "C04": 490, "C05": 890, "C06": 390, "D01": 1490, "D02": 690, "D03": 490, "D04": 990, "D05": 2490};
export const kitPaths:Record<string,string>={email:'kit-email',docs:'kit-documenti',sales:'kit-commerciale',calendar:'kit-agenda',ops:'kit-operativita',marketing:'kit-marketing',people:'kit-persone',reports:'kit-report'};
export type Entry={id:string;volume:number;minutes:number;rate:number|null;period:'day'|'week'|'month';scope:'company'|'person';people:number};
export type Scenario={entries:Entry[];days:number;weeks:number;category:string};
export function parseScenario(raw:unknown):Scenario|null{
 if(!raw||typeof raw!=='object')return null;const v=raw as Record<string,unknown>;
 if(!Array.isArray(v.entries)||!v.entries.length||v.entries.length>39||!Number.isInteger(v.days)||Number(v.days)<1||Number(v.days)>7||!Number.isInteger(v.weeks)||Number(v.weeks)<1||Number(v.weeks)>52||typeof v.category!=='string'||!categoryNames[v.category])return null;
 const entries:Entry[]=[],ids=new Set<string>();
 for(const value of v.entries){if(!value||typeof value!=='object')return null;const e=value as Entry;
  if(!taskCatalog[e.id]||ids.has(e.id)||!['day','week','month'].includes(e.period)||!['company','person'].includes(e.scope)||![e.volume,e.minutes].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=100000)||(e.rate!==null&&(typeof e.rate!=='number'||!Number.isFinite(e.rate)||e.rate<0||e.rate>100000))||!Number.isInteger(e.people)||e.people<1||e.people>10000)return null;
  ids.add(e.id);entries.push({id:e.id,volume:e.volume,minutes:e.minutes,rate:e.rate,period:e.period,scope:e.scope,people:e.scope==='person'?e.people:1});
 }
 if(ids.has('emailall')&&entries.some(e=>e.id!=='emailall'&&taskCatalog[e.id].category==='email'))return null;
 if(!entries.some(e=>taskCatalog[e.id].category===v.category))return null;
 return {entries,days:Number(v.days),weeks:Number(v.weeks),category:v.category};
}
export function hours(e:Entry,s:Pick<Scenario,'days'>){return e.volume*(e.period==='day'?s.days:e.period==='month'?12/52:1)*e.minutes/60*(e.scope==='person'?e.people:1);}
export function comparison(s:Scenario){
 const ranked=[...s.entries].sort((a,b)=>hours(b,s)*(b.rate??1)-hours(a,s)*(a.rate??1));
 const priority=ranked.find(e=>taskCatalog[e.id].category===s.category)!;
 const rows=[priority,...ranked.filter(e=>e.id!==priority.id)].slice(0,8);
 const roles=new Set(rows.map(e=>taskCatalog[e.id].category)).size;
 const tier=rows.length<=2&&roles===1?{name:'Kit Start',limit:2,setup:1990,monthly:290}:rows.length<=4&&roles<=2?{name:'Kit Team',limit:4,setup:3990,monthly:390}:rows.length<=6?{name:'Kit Business',limit:6,setup:6490,monthly:590}:{name:'Kit Control',limit:8,setup:9900,monthly:790};
 const metric=(entries:Entry[],free=false)=>{let h=0,cost=0,priced=0;for(const e of entries){const r=free ? 0.1 :taskCatalog[e.id].pct/100;h+=hours(e,s)*r;if(e.rate!==null){cost+=hours(e,s)*r*e.rate;priced++;}}return {hours:h,weeklyValue:priced?cost:null,annualValue:priced?cost*s.weeks:null,priced};};
 const service=taskCatalog[priority.id];
 return {category:s.category,categoryName:categoryNames[s.category],priority:{id:priority.id,name:service.name,baselineHours:hours(priority,s)},free:{...metric([priority],true),pct:10,price:0},single:{...metric([priority]),pct:service.pct,service:service.service,scope:service.scope,price:servicePrices[service.service]??null},kit:{...metric(rows),...tier,firstYear:tier.setup+tier.monthly*12,taskIds:rows.map(e=>e.id),taskNames:rows.map(e=>taskCatalog[e.id].name),excluded:s.entries.length-rows.length},modelVersion:'tempo-offers-v1-2026-11-09'};
}
export function scenarioText(s:Scenario){
 const c=comparison(s),weeks=s.weeks;
 const n=(v:number)=>v.toLocaleString('it-IT',{maximumFractionDigits:1});
 const money=(v:number|null)=>v===null?'non disponibile (costo orario mancante)':new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);
 const price=c.single.price===null?'da definire in preventivo':money(c.single.price)+' + IVA';
 const kitHours=c.kit.taskIds.reduce((total,id)=>total+hours(s.entries.find(e=>e.id===id)!,s),0);
 const kitPct=kitHours>0?n(c.kit.hours/kitHours*100):'—';
 const partialKit=c.kit.priced<c.kit.taskIds.length;
 const partialNote=partialKit?' NOTA: una o più attività del kit non hanno un costo orario: le stime monetarie sono parziali.':'';
 const monthValue=(v:{annualValue:number|null})=>money(v.annualValue===null?null:v.annualValue/12);
 const yearValue=(v:{annualValue:number|null})=>money(v.annualValue);
 const periodName:Record<string,string>={day:'al giorno',week:'a settimana',month:'al mese'};
 const annualHours=(v:{hours:number})=>n(v.hours*weeks);
 return [
  'IL TUO CONFRONTO PERSONALIZZATO · HORYZON',
  'Area: '+c.categoryName,
  'Prima attività da migliorare: '+c.priority.name,
  '',
  '1 · SOLUZIONE GRATUITA · COSTO ZERO',
  'Intervento fai-da-te sulla singola attività: '+c.priority.name,
  'Obiettivo indicativo: '+c.free.pct+'% del tempo (da misurare, non garantito).',
  'Tempo potenzialmente recuperabile: '+n(c.free.hours*weeks/12)+' ore/mese, '+annualHours(c.free)+' ore/anno.',
  'Valore del tempo: '+monthValue(c.free)+'/mese, '+yearValue(c.free)+'/anno.',
  '',
  '2 · AUTOMAZIONE SINGOLA HORYZON',
  'Attività: '+c.priority.name+'. Recupero complessivo stimato: '+c.single.pct+'%.',
  'Tempo potenzialmente recuperabile: '+n(c.single.hours*weeks/12)+' ore/mese, '+annualHours(c.single)+' ore/anno.',
  'Valore del tempo: '+monthValue(c.single)+'/mese, '+yearValue(c.single)+'/anno.',
  'Prezzo iniziale: '+price+'. Canoni, strumenti e assistenza eventuali da preventivare.',
  'Perimetro: '+c.single.scope,
  '',
  '3 · KIT HORYZON · '+c.kit.name.toUpperCase(),
  'Attività comprese in questo scenario: '+c.kit.taskIds.length+'. Recupero medio ponderato: '+kitPct+'%.',
  ...c.kit.taskNames.map(name=>' • '+name),
  'Tempo potenzialmente recuperabile: '+n(c.kit.hours*weeks/12)+' ore/mese, '+annualHours(c.kit)+' ore/anno.',
  'Valore del tempo: '+monthValue(c.kit)+'/mese, '+yearValue(c.kit)+'/anno.'+partialNote,
  'Prezzo indicativo: '+money(c.kit.setup)+' di setup + '+money(c.kit.monthly)+'/mese + IVA.',
  'Costo del primo anno: '+money(c.kit.firstYear)+' + IVA, esclusi strumenti ed eventuali integrazioni.',
  c.kit.excluded?'Altre '+c.kit.excluded+' attività selezionate non sono incluse nel calcolo del kit.':'',
  '',
  'PARAMETRI DA TE INSERITI',
  ...s.entries.map(e=>taskCatalog[e.id].name+': '+n(e.volume)+' casi '+periodName[e.period]+', '+n(e.minutes)+' minuti/caso, '+n(hours(e,s)*weeks/12)+' ore/mese, '+(e.rate===null?'costo orario non specificato':money(e.rate)+'/ora')),
  'Settimane lavorative/anno: '+weeks+'. Media mensile = totale annuo / 12.',
  '',
  'IMPORTANTE: questi sono tre scenari ALTERNATIVI, non cumulativi. Le percentuali sono ipotesi Horyzon da verificare sul tuo processo. Il valore del tempo recuperabile non corrisponde automaticamente a risparmio di cassa. Dove manca il costo orario, la stima economica è parziale o non disponibile. Prezzi non vincolanti, fattibilità, licenze e integrazioni da confermare.'
 ].filter(Boolean).join('\n');
}

