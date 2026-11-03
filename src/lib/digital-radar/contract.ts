import {createHash} from 'node:crypto';
import {parseDigitalSubmission,digitalTerritory,DIGITAL_PRIVACY_VERSION} from '../digital-leads/contract.ts';
import {RADAR_DIMENSIONS,type RadarAnswers} from './questions.ts';

export type RadarPayload={mode:'public'|'company';company:string|null;province:string|null;token:string|null;name:string;role:string;
 activity:string;tools:string;frequency:'daily'|'weekly'|'monthly'|'other';minutes:number|null;occurrences:number|null;
 answers:RadarAnswers;contact:{first_name:string;last_name:string;email:string;phone:string|null}|null;
 privacy_version:string;territory:string|null};
export type RadarSubmission={requestId:string;hash:string;payload:RadarPayload};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const clean=(v:unknown,max:number)=>typeof v==='string'&&v.length<=max?v.trim().replace(/\s+/g,' '):null;
const digest=(v:string)=>createHash('sha256').update(v).digest('hex');
const metric=(v:unknown)=>v===null||v===undefined?null:typeof v==='number'&&Number.isInteger(v)&&v>=0&&v<=100000?v:undefined;

export function radarScores(answers:RadarAnswers){
 const dimensions:Record<string,number>={};
 for(const question of RADAR_DIMENSIONS){const value=answers[question.id];if(value!==null)dimensions[question.dimension]=value;}
 const values=Object.values(dimensions);
 return {dimensions,coverage:values.length,mean:values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length*100)/100:null};
}

export function parseDigitalRadar(input:unknown,headerId:string|null):RadarSubmission|null{
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const v=input as Record<string,unknown>;
 if(typeof v.requestId!=='string'||!uuid.test(v.requestId)||v.requestId.toLowerCase()!==headerId?.toLowerCase()||v.consent!==true||v.website)return null;
 const name=clean(v.name??'',160),role=clean(v.role,160),activity=clean(v.activity,1200),tools=clean(v.tools??'',200);
 const minutes=metric(v.minutes),occurrences=metric(v.occurrences);
 if(name===null||!role||!activity||activity.length<20||tools===null||minutes===undefined||occurrences===undefined||!['daily','weekly','monthly','other'].includes(String(v.frequency)))return null;
 if(!v.answers||typeof v.answers!=='object'||Array.isArray(v.answers)||Object.keys(v.answers).length!==6)return null;
 const raw=v.answers as Record<string,unknown>,answers={} as RadarAnswers;
 for(const question of RADAR_DIMENSIONS){const value=raw[question.id];if(value!==null&&!(typeof value==='number'&&Number.isInteger(value)&&value>=1&&value<=5))return null;answers[question.id]=value as number|null;}
 const hasToken=v.token!==undefined&&v.token!==null;
 const token=hasToken?clean(v.token,48):null;
 if(hasToken&&(!token||!/^[a-f0-9]{48}$/.test(token)||v.contact))return null;
 const company=hasToken?null:clean(v.company,150),province=hasToken?null:clean(v.province,80);
 if(!hasToken&&(!company||company.length<2||!province||province.length<2))return null;
 let contact:RadarPayload['contact']=null;
 if(v.contact!==undefined&&v.contact!==null){
  if(typeof v.contact!=='object'||Array.isArray(v.contact))return null;
  const c=v.contact as Record<string,unknown>;
  const parsed=parseDigitalSubmission({requestId:v.requestId,firstName:c.firstName,lastName:c.lastName,email:c.email,phone:c.phone??'',company,province,activity,tools,frequency:v.frequency,consent:true,website:''},headerId);
  if(!parsed)return null;
  const p=parsed.payload;contact={first_name:p.first_name,last_name:p.last_name,email:p.email,phone:p.phone};
 }
 const payload:RadarPayload={mode:hasToken?'company':'public',company,province,token,name,role,activity,tools,
  frequency:v.frequency as RadarPayload['frequency'],minutes,occurrences,answers,contact,privacy_version:DIGITAL_PRIVACY_VERSION,
  territory:province?digitalTerritory(province):null};
 return {requestId:v.requestId.toLowerCase(),hash:digest(JSON.stringify(payload)),payload};
}
