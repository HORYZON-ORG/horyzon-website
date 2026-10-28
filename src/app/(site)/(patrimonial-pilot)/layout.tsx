import type { Metadata } from 'next';
import { PatrimonialPilotShell } from '@/components/patrimonial-pilot-shell';
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default function PatrimonialPilotLayout({ children }: { children: React.ReactNode }) {
  return <PatrimonialPilotShell>{children}</PatrimonialPilotShell>;
}
