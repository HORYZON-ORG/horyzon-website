import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { advisorPreviewEnabled } from '@/lib/patrimonial-radar-advisor/preview-gate';
import { PREVIEW_CASES, previewSource, type PreviewCase } from '@/lib/patrimonial-radar-advisor/preview-fixtures';
import { advisorProjection } from '@/lib/patrimonial-radar-advisor/projection';
import { AdvisorDashboard } from '@/components/patrimonial-radar-advisor/advisor-dashboard';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Advisor Intelligence · Fixture locali',robots:{index:false,follow:false,nocache:true}};
export default async function AdvisorPreview({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  if(!advisorPreviewEnabled(process.env))notFound();
  const params=await searchParams;
  if(Object.keys(params).some(k=>k!=='scenario')||Array.isArray(params.scenario)||params.scenario&&!PREVIEW_CASES.includes(params.scenario as PreviewCase))notFound();
  const scenario=(params.scenario??'T02') as PreviewCase;
  return <AdvisorDashboard scenario={scenario} projection={advisorProjection(previewSource(scenario))} fixtureSelector={<details style={{margin:'16px auto',maxWidth:1360,padding:'12px 24px',background:'#102229',color:'#f7f4e8'}}><summary style={{minHeight:44,cursor:'pointer'}}>Scenario sintetico: {scenario}</summary><nav aria-label="Fixture sintetiche" style={{display:'flex',flexWrap:'wrap',gap:12}}>{PREVIEW_CASES.map(id=><Link key={id} href={`/internal/radar-patrimoniale/advisor-preview?scenario=${id}`} prefetch={false} aria-current={id===scenario?'page':undefined} style={{padding:10,minHeight:44}}>{id}</Link>)}</nav></details>}/>;
}
