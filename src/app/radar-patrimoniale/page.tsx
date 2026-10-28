import { patrimonialRadarMode } from '@/lib/patrimonial-radar-ui/public-mode';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { patrimonialRadarDemoEnabled } from '@/lib/patrimonial-radar-ui/demo-gate';
import { PatrimonialRadarClient } from '@/components/patrimonial-radar/radar-client';
import { backendLocalTestEnabled } from '@/lib/patrimonial-radar-server/runtime';
import {protectedRemoteConfigured} from '@/lib/patrimonial-radar-server/remote-config';
import {accountConfig} from '@/lib/patrimonial-radar-server/account-config';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Radar Patrimoniale · Conosci la tua situazione',
  description: 'Un percorso educativo con email verificata per conoscere risorse e priorità. Compilazioni e report conservati per la consultazione autorizzata.',
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: '/radar-patrimoniale' },
};
export default async function PatrimonialRadarPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const raw=(await searchParams).ref;
  const referralCode=raw===undefined?undefined:typeof raw==='string'&&/^[0-9a-f]{32}$/.test(raw)?raw:null;
  const account=accountConfig(process.env);
  if(account)return <PatrimonialRadarClient asOf={new Date().toISOString().slice(0,10)} foundation protectedService={!account.local} accountAuth referralCode={referralCode} />;
  const mode=patrimonialRadarMode(process.env);
  const remote=protectedRemoteConfigured(process.env);
  if (mode!=='VERIFIED_PERSISTENT' || (!remote && (!patrimonialRadarDemoEnabled(process.env) || !backendLocalTestEnabled(process.env)))) notFound();
  return <PatrimonialRadarClient asOf={new Date().toISOString().slice(0, 10)} foundation={remote || process.env.PATRIMONIAL_RADAR_FOUNDATION_CONTEXT === 'local-test'} protectedService={remote} />;
}
